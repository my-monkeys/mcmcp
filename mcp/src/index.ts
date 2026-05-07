#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SchematicStore,
  ensureInBounds,
  ensureRegionInBounds,
  isMcVersion,
  regionVolume,
  SUPPORTED_MC_VERSIONS,
  type BlockInput,
  type McVersion,
  type Region,
} from './store.js';
import { buildLitematic } from './litematic.js';
import { buildBg2Template } from './bg2template.js';
import { generateBiome, type BiomeName } from './biome/index.js';

const SUPABASE_URL = process.env.MCMCP_SUPABASE_URL ?? 'https://klliwmgdyuatstjvzzbb.supabase.co';
const SUPABASE_KEY =
  process.env.MCMCP_SUPABASE_ANON_KEY ?? 'sb_publishable_xUIUglzmwDQc91YAZXhXJQ_BZeMCaS1';
const ENV_SESSION = process.env.MCMCP_SESSION_ID?.toUpperCase();
const VIEWER_ORIGIN = process.env.MCMCP_VIEWER_ORIGIN ?? 'http://localhost:3000';
const EXPORT_DIR = process.env.MCMCP_EXPORT_DIR ?? join(homedir(), 'Downloads', 'mcmcp-exports');

// --- Block ID validation ---

const VALIDATION_VERSION = process.env.MCMCP_VALIDATION_VERSION ?? '1.21';
const __dir = dirname(fileURLToPath(import.meta.url));
// From compiled dist/index.js: __dir = mcp/dist/ → mcp/ → repo-root/
const REPO_ROOT = join(__dir, '..', '..');
const DEFAULT_MANIFEST_PATH = join(REPO_ROOT, 'web', 'public', 'textures', VALIDATION_VERSION, 'manifest.json');
const MANIFEST_PATH = process.env.MCMCP_MANIFEST_PATH ?? DEFAULT_MANIFEST_PATH;

let validBlocks: Set<string> | null = null;

try {
  const raw = readFileSync(MANIFEST_PATH, 'utf8');
  const manifest = JSON.parse(raw) as { blocks: Record<string, unknown> };
  validBlocks = new Set(Object.keys(manifest.blocks));
  console.error(`mcmcp: loaded block manifest from ${MANIFEST_PATH} (${validBlocks.size} blocks)`);
} catch (e) {
  console.error(`mcmcp: WARNING — could not load block manifest at ${MANIFEST_PATH}; block id validation disabled. ${e}`);
}

/** Strip minecraft: prefix and [state] suffix to get the bare block id. */
function normalizeBlockId(id: string): string {
  return id.replace(/^minecraft:/, '').replace(/\[.*\]$/, '');
}

/** Return up to 3 suggestions for an unknown block id using prefix/edit-distance heuristics. */
function suggest(norm: string, valid: Set<string>): string[] {
  const prefix = norm.slice(0, 4);
  const byPrefix = [...valid].filter((v) => v.startsWith(prefix));
  if (byPrefix.length > 0) return byPrefix.slice(0, 3);
  // Fallback: character-position diff, top-3
  const scored = [...valid].map((v) => {
    let dist = 0;
    const a = norm, b = v;
    const maxLen = Math.max(a.length, b.length);
    for (let i = 0; i < maxLen; i++) if (a[i] !== b[i]) dist++;
    return { v, dist };
  });
  scored.sort((a, b) => a.dist - b.dist);
  return scored.slice(0, 3).map((s) => s.v);
}

/** Validate a single block id. Returns an error string, or null if valid. */
function validateBlockId(raw: string): string | null {
  if (validBlocks === null) return null; // validation disabled
  const norm = normalizeBlockId(raw);
  if (norm === 'air') return null;
  if (validBlocks.has(norm)) return null;
  const hints = suggest(norm, validBlocks);
  return `Unknown block id "${raw}" (normalized: "${norm}"). Did you mean: ${hints.join(', ')}?`;
}

/** Validate multiple block ids atomically. Returns an error string if any are invalid. */
function validateBlockIds(ids: string[]): string | null {
  for (const id of ids) {
    const err = validateBlockId(id);
    if (err) return err;
  }
  return null;
}

const store = new SchematicStore(SUPABASE_URL, SUPABASE_KEY);

// Active session for the lifetime of the MCP process. Starts from the env
// var (if any), can be changed live via the `use_session` tool, and is
// always overridable per-call by passing a `session_id` argument.
let activeSession: string | undefined = ENV_SESSION;

const server = new McpServer(
  { name: 'mcmcp-schematic', version: '0.1.0' },
  {
    instructions:
      'Build Minecraft schematics block by block. Always call create_zone first (or pass an existing session_id from the viewer). ' +
      'Block coordinates are zero-based: (0,0,0) is one corner of the zone, y is up. ' +
      'Block names are short Minecraft IDs without the minecraft: prefix, e.g. "stone", "oak_planks", "glass". Use "air" to clear a block. ' +
      'Prefer set_blocks for batches (whole layers, walls, large fills) — single set_block calls are slow.',
  }
);

const text = (s: string) => ({ content: [{ type: 'text' as const, text: s }] });
const error = (s: string) => ({ content: [{ type: 'text' as const, text: s }], isError: true });

const resolveSession = (provided?: string): string => {
  const id = provided ?? activeSession;
  if (!id) {
    throw new Error(
      'No active session. Call use_session({ session_id }) first, or pass session_id as a tool argument, or set MCMCP_SESSION_ID in the MCP env.'
    );
  }
  return id.toUpperCase();
};

server.registerTool(
  'use_session',
  {
    title: 'Switch the active session',
    description:
      'Set the active session_id used by every subsequent tool call (until changed again). ' +
      'Call this once after the user opens a new session in the viewer and pastes the 6-char ID. ' +
      'You can still override per-call by passing session_id explicitly.',
    inputSchema: {
      session_id: z
        .string()
        .length(6)
        .regex(/^[A-Za-z2-9]+$/)
        .describe('The 6-char session id from the viewer (case-insensitive).'),
    },
  },
  async ({ session_id }) => {
    try {
      const id = session_id.toUpperCase();
      const session = await store.getSession(id);
      activeSession = id;
      return text(
        `Active session is now ${id} (${session.size_x}×${session.size_y}×${session.size_z}, mc=${session.mc_version}). ` +
          `Viewer: ${VIEWER_ORIGIN}/s/${id}`
      );
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  }
);

server.registerTool(
  'current_session',
  {
    title: 'Show the active session',
    description: 'Return the active session_id, its zone size, and how many blocks it currently holds.',
    inputSchema: {},
  },
  async () => {
    try {
      if (!activeSession) {
        return text('No active session. Call use_session, create_zone, or pass session_id explicitly to other tools.');
      }
      const session = await store.getSession(activeSession);
      const rows = await store.getAll(activeSession);
      return text(
        `session=${activeSession} size=${session.size_x}×${session.size_y}×${session.size_z} mc=${session.mc_version} blocks=${rows.length}\n` +
          `Viewer: ${VIEWER_ORIGIN}/s/${activeSession}`
      );
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  }
);

server.registerTool(
  'set_version',
  {
    title: 'Change the Minecraft version of the active session',
    description:
      `Update the active session's Minecraft version. The viewer reloads its texture pack to match. ` +
      `Supported: ${SUPPORTED_MC_VERSIONS.join(', ')}.`,
    inputSchema: {
      mc_version: z.enum(SUPPORTED_MC_VERSIONS),
      session_id: z.string().length(6).optional(),
    },
  },
  async ({ mc_version, session_id }) => {
    try {
      const id = resolveSession(session_id);
      const session = await store.setSessionVersion(id, mc_version);
      return text(`Session ${id} now targets Minecraft ${session.mc_version}.`);
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  }
);

server.registerTool(
  'create_zone',
  {
    title: 'Create or reset a build zone',
    description:
      'Creates a new schematic session of the given dimensions, or resets the existing session_id. ' +
      'Returns the session_id and a viewer URL. Sessions auto-expire after 24h.',
    inputSchema: {
      size_x: z.number().int().min(1).max(256).describe('Width along X (east-west)'),
      size_y: z.number().int().min(1).max(256).describe('Height along Y (up)'),
      size_z: z.number().int().min(1).max(256).describe('Depth along Z (north-south)'),
      session_id: z
        .string()
        .length(6)
        .regex(/^[A-Z2-9]+$/)
        .optional()
        .describe('Existing session id to reset. If omitted, a new one is generated.'),
      mc_version: z
        .enum(SUPPORTED_MC_VERSIONS)
        .optional()
        .describe(`Minecraft version this build targets. Default: 1.21. Supported: ${SUPPORTED_MC_VERSIONS.join(', ')}.`),
    },
  },
  async ({ size_x, size_y, size_z, session_id, mc_version }) => {
    try {
      const desired = session_id?.toUpperCase() ?? activeSession;
      const session = await store.createSession(size_x, size_y, size_z, desired, mc_version);
      activeSession = session.id;
      return text(
        `Zone ready and now active. session_id=${session.id} size=${session.size_x}×${session.size_y}×${session.size_z} mc=${session.mc_version}\n` +
          `Open in browser: ${VIEWER_ORIGIN}/s/${session.id}`
      );
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  }
);

server.registerTool(
  'set_block',
  {
    title: 'Set or clear a single block',
    description:
      'Place one block at (x,y,z). Use block="air" to clear. Coordinates must be inside the zone. Slow for large patterns — use set_blocks instead.',
    inputSchema: {
      x: z.number().int().describe('X coordinate, 0-based, increases east'),
      y: z.number().int().describe('Y coordinate, 0-based, increases up'),
      z: z.number().int().describe('Z coordinate, 0-based, increases south'),
      block: z.string().min(1).describe('Block id, e.g. "stone", "oak_planks", "air"'),
      session_id: z.string().length(6).optional(),
    },
  },
  async ({ x, y, z, block, session_id }) => {
    try {
      const validErr = validateBlockId(block);
      if (validErr) return error(validErr);
      const id = resolveSession(session_id);
      const session = await store.getSession(id);
      const inputs: BlockInput[] = [{ x, y, z, block }];
      ensureInBounds(session, inputs);
      const { written, cleared } = await store.setBlocks(id, inputs);
      return text(written > 0 ? `Placed ${block} at (${x},${y},${z}).` : `Cleared block at (${x},${y},${z}). (${cleared} removed)`);
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  }
);

server.registerTool(
  'set_blocks',
  {
    title: 'Set or clear a batch of blocks',
    description:
      'Place or clear many blocks at once (e.g. a whole layer). All coordinates must be inside the zone — the call fails atomically if any are out of bounds. block="air" clears that position.',
    inputSchema: {
      blocks: z
        .array(
          z.object({
            x: z.number().int(),
            y: z.number().int(),
            z: z.number().int(),
            block: z.string().min(1),
          })
        )
        .min(1)
        .max(50000)
        .describe('Array of { x, y, z, block } entries.'),
      session_id: z.string().length(6).optional(),
    },
  },
  async ({ blocks, session_id }) => {
    try {
      const validErr = validateBlockIds(blocks.map((b) => b.block));
      if (validErr) return error(validErr);
      const id = resolveSession(session_id);
      const session = await store.getSession(id);
      ensureInBounds(session, blocks as BlockInput[]);
      const { written, cleared } = await store.setBlocks(id, blocks as BlockInput[]);
      return text(`Done. Placed ${written}, cleared ${cleared}. Total ${blocks.length}.`);
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  }
);

server.registerTool(
  'fill_region',
  {
    title: 'Fill a cuboid with one block type',
    description:
      'Fill every position in the inclusive cuboid (x1,y1,z1)..(x2,y2,z2) with the given block. ' +
      'Coordinates can be in any order. block="air" clears the region. Existing blocks are overwritten.',
    inputSchema: {
      x1: z.number().int(), y1: z.number().int(), z1: z.number().int(),
      x2: z.number().int(), y2: z.number().int(), z2: z.number().int(),
      block: z.string().min(1).describe('Block id, e.g. "stone", "glass", "air".'),
      session_id: z.string().length(6).optional(),
    },
  },
  async ({ x1, y1, z1, x2, y2, z2, block, session_id }) => {
    try {
      const validErr = validateBlockId(block);
      if (validErr) return error(validErr);
      const id = resolveSession(session_id);
      const session = await store.getSession(id);
      const region: Region = { x1, y1, z1, x2, y2, z2 };
      const norm = ensureRegionInBounds(session, region);
      const vol = regionVolume(norm);
      const { written, cleared } = await store.fillRegion(id, norm, block);
      return text(
        `Filled (${norm.x1},${norm.y1},${norm.z1})..(${norm.x2},${norm.y2},${norm.z2}) ` +
          `with ${block} (volume=${vol}). Placed ${written}, cleared ${cleared}.`
      );
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  }
);

server.registerTool(
  'fill_layer',
  {
    title: 'Fill an entire layer with one block type',
    description:
      'Fill a whole plane of the zone. axis="y" (a horizontal floor/ceiling), "x" (a wall east-west), or "z" (a wall north-south). ' +
      'index is the coordinate along that axis. Equivalent to a fill_region spanning the full zone on the other two axes.',
    inputSchema: {
      axis: z.enum(['x', 'y', 'z']).describe('Axis the layer is perpendicular to.'),
      index: z.number().int().describe('Coordinate along that axis.'),
      block: z.string().min(1),
      session_id: z.string().length(6).optional(),
    },
  },
  async ({ axis, index, block, session_id }) => {
    try {
      const validErr = validateBlockId(block);
      if (validErr) return error(validErr);
      const id = resolveSession(session_id);
      const session = await store.getSession(id);
      const region: Region =
        axis === 'y'
          ? { x1: 0, y1: index, z1: 0, x2: session.size_x - 1, y2: index, z2: session.size_z - 1 }
          : axis === 'x'
            ? { x1: index, y1: 0, z1: 0, x2: index, y2: session.size_y - 1, z2: session.size_z - 1 }
            : { x1: 0, y1: 0, z1: index, x2: session.size_x - 1, y2: session.size_y - 1, z2: index };
      const norm = ensureRegionInBounds(session, region);
      const { written, cleared } = await store.fillRegion(id, norm, block);
      return text(`Filled layer ${axis}=${index} with ${block}. Placed ${written}, cleared ${cleared}.`);
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  }
);

server.registerTool(
  'replace',
  {
    title: 'Replace one block type with another',
    description:
      'Swap every from_block with to_block in the session, optionally restricted to a cuboid region. ' +
      'to_block="air" deletes the matching blocks. This is one DB round-trip — fast for large fills.',
    inputSchema: {
      from_block: z.string().min(1),
      to_block: z.string().min(1),
      x1: z.number().int().optional(),
      y1: z.number().int().optional(),
      z1: z.number().int().optional(),
      x2: z.number().int().optional(),
      y2: z.number().int().optional(),
      z2: z.number().int().optional(),
      session_id: z.string().length(6).optional(),
    },
  },
  async ({ from_block, to_block, x1, y1, z1, x2, y2, z2, session_id }) => {
    try {
      const validErr = validateBlockIds([from_block, to_block]);
      if (validErr) return error(validErr);
      const id = resolveSession(session_id);
      const session = await store.getSession(id);
      const regionGiven = [x1, y1, z1, x2, y2, z2].some((v) => v !== undefined);
      const regionAllGiven = [x1, y1, z1, x2, y2, z2].every((v) => v !== undefined);
      if (regionGiven && !regionAllGiven) {
        return error('Region requires all six bounds (x1,y1,z1,x2,y2,z2) or none.');
      }
      let region: Region | undefined;
      if (regionAllGiven) {
        region = ensureRegionInBounds(session, { x1: x1!, y1: y1!, z1: z1!, x2: x2!, y2: y2!, z2: z2! });
      }
      const { replaced, cleared } = await store.replaceBlocks(id, from_block, to_block, region);
      const where = region
        ? ` in region (${region.x1},${region.y1},${region.z1})..(${region.x2},${region.y2},${region.z2})`
        : '';
      return text(`Replaced ${from_block}→${to_block}${where}. Updated ${replaced}, deleted ${cleared}.`);
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  }
);

server.registerTool(
  'get_region',
  {
    title: 'Read all blocks inside a cuboid (dense 3D array)',
    description:
      'Return a dense 3D array for the inclusive cuboid (x1,y1,z1)..(x2,y2,z2). ' +
      'Indexed as array[y-y1][z-z1][x-x1]: outer index is Y (height layer), middle is Z (row), inner is X (column). ' +
      'Every cell contains a block id string; empty positions are "air". ' +
      'The text header reports: region coords, dimensions sx×sy×sz, total_cells, and non_air count.',
    inputSchema: {
      x1: z.number().int(), y1: z.number().int(), z1: z.number().int(),
      x2: z.number().int(), y2: z.number().int(), z2: z.number().int(),
      session_id: z.string().length(6).optional(),
    },
  },
  async ({ x1, y1, z1, x2, y2, z2, session_id }) => {
    try {
      const id = resolveSession(session_id);
      const session = await store.getSession(id);
      const norm = ensureRegionInBounds(session, { x1, y1, z1, x2, y2, z2 });
      const rows = await store.getRegion(id, norm);

      const sx = norm.x2 - norm.x1 + 1;
      const sy = norm.y2 - norm.y1 + 1;
      const sz = norm.z2 - norm.z1 + 1;

      const dense: string[][][] = Array.from({ length: sy }, () =>
        Array.from({ length: sz }, () => Array<string>(sx).fill('air'))
      );
      for (const r of rows) {
        dense[r.y - norm.y1]![r.z - norm.z1]![r.x - norm.x1] = r.block_type;
      }

      const header =
        `region=(${norm.x1},${norm.y1},${norm.z1})..(${norm.x2},${norm.y2},${norm.z2}) ` +
        `size=${sx}×${sy}×${sz} total_cells=${sx * sy * sz} non_air=${rows.length}`;
      return text(`${header}\n${JSON.stringify(dense)}`);
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  }
);

server.registerTool(
  'get_layer',
  {
    title: 'Read all blocks in one layer (dense 2D array)',
    description:
      'Return a dense 2D array for the plane axis=index. Array shape depends on axis: ' +
      'axis="y" → array[z][x] (top-down view, z=rows, x=cols, both 0-based); ' +
      'axis="x" → array[y][z] (west side view, y=rows, z=cols, low-to-high); ' +
      'axis="z" → array[y][x] (north side view, y=rows, x=cols, low-to-high). ' +
      'Every cell is a block id string; empty positions are "air". ' +
      'Header format: layer axis=Y index=N size=A×B non_air=M.',
    inputSchema: {
      axis: z.enum(['x', 'y', 'z']),
      index: z.number().int(),
      session_id: z.string().length(6).optional(),
    },
  },
  async ({ axis, index, session_id }) => {
    try {
      const id = resolveSession(session_id);
      const session = await store.getSession(id);
      const region: Region =
        axis === 'y'
          ? { x1: 0, y1: index, z1: 0, x2: session.size_x - 1, y2: index, z2: session.size_z - 1 }
          : axis === 'x'
            ? { x1: index, y1: 0, z1: 0, x2: index, y2: session.size_y - 1, z2: session.size_z - 1 }
            : { x1: 0, y1: 0, z1: index, x2: session.size_x - 1, y2: session.size_y - 1, z2: index };
      const norm = ensureRegionInBounds(session, region);
      const rows = await store.getRegion(id, norm);

      let dense: string[][];
      let dimA: number;
      let dimB: number;

      if (axis === 'y') {
        // array[z][x]
        dimA = session.size_z;
        dimB = session.size_x;
        dense = Array.from({ length: dimA }, () => Array<string>(dimB).fill('air'));
        for (const r of rows) {
          dense[r.z]![r.x] = r.block_type;
        }
      } else if (axis === 'x') {
        // array[y][z]
        dimA = session.size_y;
        dimB = session.size_z;
        dense = Array.from({ length: dimA }, () => Array<string>(dimB).fill('air'));
        for (const r of rows) {
          dense[r.y]![r.z] = r.block_type;
        }
      } else {
        // axis === 'z': array[y][x]
        dimA = session.size_y;
        dimB = session.size_x;
        dense = Array.from({ length: dimA }, () => Array<string>(dimB).fill('air'));
        for (const r of rows) {
          dense[r.y]![r.x] = r.block_type;
        }
      }

      const header = `layer axis=${axis.toUpperCase()} index=${index} size=${dimA}×${dimB} non_air=${rows.length}`;
      return text(`${header}\n${JSON.stringify(dense)}`);
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  }
);

server.registerTool(
  'get_all',
  {
    title: 'Read all blocks in the session',
    description:
      'Return every placed block with its coordinates and type, plus the zone size. Use this to inspect the current state.',
    inputSchema: {
      session_id: z.string().length(6).optional(),
    },
  },
  async ({ session_id }) => {
    try {
      const id = resolveSession(session_id);
      const session = await store.getSession(id);
      const rows = await store.getAll(id);
      const summary = `session=${id} size=${session.size_x}×${session.size_y}×${session.size_z} blocks=${rows.length}`;
      const blocks = rows.map((r) => ({ x: r.x, y: r.y, z: r.z, block: r.block_type }));
      return {
        content: [{ type: 'text' as const, text: `${summary}\n${JSON.stringify(blocks)}` }],
      };
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  }
);

server.registerTool(
  'export_litematic',
  {
    title: 'Export the session as a .litematic file',
    description:
      'Encode the current session as a Litematica schematic (.litematic) and write it to disk. ' +
      'Compatible with the Litematica mod (Minecraft 1.16+). Returns the absolute path of the saved file. ' +
      'Drop the file into your Minecraft "schematics" folder to load it.',
    inputSchema: {
      name: z.string().min(1).max(64).optional().describe('Schematic display name (defaults to "mcmcp <session>").'),
      author: z.string().min(1).max(64).optional(),
      description: z.string().max(512).optional(),
      output_path: z
        .string()
        .optional()
        .describe('Absolute path for the .litematic file. Defaults to ~/Downloads/mcmcp-exports/<session>-<ts>.litematic.'),
      session_id: z.string().length(6).optional(),
    },
  },
  async ({ name, author, description, output_path, session_id }) => {
    try {
      const id = resolveSession(session_id);
      const session = await store.getSession(id);
      const rows = await store.getAll(id);
      const result = buildLitematic(session, rows, { name, author, description });

      let target = output_path;
      if (!target) {
        await mkdir(EXPORT_DIR, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
        target = join(EXPORT_DIR, `${id}-${stamp}.litematic`);
      }
      await writeFile(target, result.buffer);

      return text(
        `Exported ${result.totalBlocks} blocks (palette=${result.paletteSize}, bits/entry=${result.bitsPerEntry}, ` +
          `${result.buffer.length} bytes gzipped) to:\n${target}`
      );
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  }
);

server.registerTool(
  'export_bg2_template',
  {
    title: 'Export the session as a Building Gadgets 2 template',
    description:
      'Encode the current session as a Building Gadgets 2 (BG2) Template JSON and write it to disk. ' +
      'Returns the absolute path of the saved file. The user opens the file, copies its contents, ' +
      'and pastes them into BG2\'s Template Manager "Load from JSON" input in-game.',
    inputSchema: {
      name: z.string().min(1).max(64).optional().describe('Template display name (defaults to "mcmcp <session>").'),
      output_path: z
        .string()
        .optional()
        .describe('Absolute path for the .json file. Defaults to ~/Downloads/mcmcp-exports/<session>-<ts>-bg2.json.'),
      session_id: z.string().length(6).optional(),
    },
  },
  async ({ name, output_path, session_id }) => {
    try {
      const id = resolveSession(session_id);
      const session = await store.getSession(id);
      const rows = await store.getAll(id);
      const result = buildBg2Template(session, rows, { name });

      let target = output_path;
      if (!target) {
        await mkdir(EXPORT_DIR, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
        target = join(EXPORT_DIR, `${id}-${stamp}-bg2.json`);
      }
      await writeFile(target, result.json, 'utf8');

      return text(
        `Exported ${result.totalBlocks} blocks (palette=${result.paletteSize}, ${result.json.length} bytes JSON) ` +
          `as a BG2 template to:\n${target}\n\n` +
          `To use: open the file, copy its contents, then paste into the Template Manager in Minecraft (BG2).`
      );
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  }
);

server.registerTool(
  'generate_biome',
  {
    title: 'Generate a Minecraft biome into the session zone',
    description:
      'Procedurally fill the current session with terrain and decorations matching a chosen biome ' +
      '(plains, forest, desert, taiga, mesa). Operates on the full zone, or on `region` if provided. ' +
      'Refuses if the zone already contains blocks unless force=true.',
    inputSchema: {
      biome: z.enum(['plains', 'forest', 'desert', 'taiga', 'mesa']),
      seed: z.number().int().optional(),
      force: z.boolean().default(false).describe('Required if zone has existing blocks.'),
      region: z.object({
        x1: z.number().int().nonnegative(),
        y1: z.number().int().nonnegative(),
        z1: z.number().int().nonnegative(),
        x2: z.number().int().nonnegative(),
        y2: z.number().int().nonnegative(),
        z2: z.number().int().nonnegative(),
      }).optional().describe('Sub-region of the zone. Defaults to the full zone.'),
      rivers: z.boolean().default(false).describe('Carve serpentine river channels (plains/forest/taiga only).'),
      session_id: z.string().length(6).optional(),
    },
  },
  async ({ biome, seed, force, region, rivers, session_id }) => {
    try {
      const id = resolveSession(session_id);
      const session = await store.getSession(id);
      if (region) {
        const inBounds =
          region.x2 < session.size_x &&
          region.y2 < session.size_y &&
          region.z2 < session.size_z &&
          region.x1 <= region.x2 &&
          region.y1 <= region.y2 &&
          region.z1 <= region.z2;
        if (!inBounds) {
          return error(
            `Region out of bounds for session ${id} (size ${session.size_x}×${session.size_y}×${session.size_z}).`,
          );
        }
      }
      const existing = await store.getAll(id);
      if (existing.length > 0 && !force) {
        return error(
          `Zone has ${existing.length} existing blocks. Pass force: true to overwrite.`,
        );
      }
      const resolvedSeed = seed ?? Date.now();
      const placements = generateBiome({
        biome: biome as BiomeName,
        size: { x: session.size_x, y: session.size_y, z: session.size_z },
        seed: resolvedSeed,
        region,
        rivers,
      });
      const written = await store.setBlocks(
        id,
        placements.map((p) => ({ x: p.x, y: p.y, z: p.z, block: p.block })),
      );
      return text(
        `Generated biome ${biome} (seed ${resolvedSeed}). ` +
          `Wrote ${written.written} blocks.`,
      );
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`mcmcp-schematic MCP ready. session=${ENV_SESSION ?? '<from-args>'} viewer=${VIEWER_ORIGIN}`);
}

main().catch((err) => {
  console.error('mcmcp-schematic MCP failed to start:', err);
  process.exit(1);
});
