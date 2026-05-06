import nbt from 'prismarine-nbt';
import { gzipSync } from 'node:zlib';
import type { BlockRow, Session } from './store.js';

/**
 * Litematica .litematic encoder. Produces a gzipped NBT buffer compatible with
 * the Litematica mod's import (Schematic version 6, non-straddling block-state
 * packing as introduced in MC 1.16+).
 *
 * References:
 *   - https://github.com/maruohon/litematica/blob/master/src/main/java/fi/dy/masa/litematica/schematic/LitematicaSchematic.java
 *   - https://github.com/Lunatrius/Schematica (legacy format kept for reference)
 *
 * Coordinate convention: same as Minecraft. y is up, +x east, +z south.
 * BlockStates index order: i = (y * size_z + z) * size_x + x.
 */

const SCHEMATIC_VERSION = 6;

// Mojang's data version per release. https://minecraft.wiki/w/Data_version
const DATA_VERSION_BY_MC: Record<string, number> = {
  '1.20': 3463,
  '1.21': 3953,
};

function dataVersionFor(mcVersion: string): number {
  return DATA_VERSION_BY_MC[mcVersion] ?? 3953;
}

export type ExportOptions = {
  name?: string;
  author?: string;
  description?: string;
  regionName?: string;
};

type BlockState = { name: string; properties?: Record<string, string> };

const RE_STATE = /^([a-z0-9_:]+)(?:\[([^\]]+)\])?$/;

function parseBlockState(raw: string): BlockState {
  const trimmed = raw.trim();
  const m = trimmed.match(RE_STATE);
  if (!m) throw new Error(`Invalid block id "${raw}"`);
  const head = m[1]!;
  const id = head.includes(':') ? head : `minecraft:${head}`;
  if (!m[2]) return { name: id };
  const properties: Record<string, string> = {};
  for (const pair of m[2].split(',')) {
    const [k, v] = pair.split('=');
    if (k && v) properties[k.trim()] = v.trim();
  }
  return { name: id, properties };
}

function stateKey(s: BlockState): string {
  if (!s.properties) return s.name;
  const sorted = Object.keys(s.properties).sort();
  return `${s.name}[${sorted.map((k) => `${k}=${s.properties![k]}`).join(',')}]`;
}

function bitsPerEntryFor(paletteSize: number): number {
  // Litematica enforces a minimum of 2 bits per entry.
  const min = 2;
  const need = Math.max(1, Math.ceil(Math.log2(Math.max(2, paletteSize))));
  return Math.max(min, need);
}

/**
 * Pack indices into 64-bit longs using the non-straddling layout (entries
 * never cross long boundaries). Returns one [hi32, lo32] tuple per long, ready
 * to feed into prismarine-nbt's LongArray.
 */
function packBlockStates(indices: number[], bitsPerEntry: number): [number, number][] {
  const entriesPerLong = Math.floor(64 / bitsPerEntry);
  const numLongs = Math.ceil(indices.length / entriesPerLong);
  const longs = new Array<bigint>(numLongs).fill(0n);
  const bpe = BigInt(bitsPerEntry);
  for (let i = 0; i < indices.length; i++) {
    const longIdx = Math.floor(i / entriesPerLong);
    const bitOffset = BigInt(i % entriesPerLong) * bpe;
    longs[longIdx]! |= BigInt(indices[i]!) << bitOffset;
  }
  return longs.map((b) => {
    // Two's-complement wrap to int32 for hi/lo halves (prismarine-nbt expects signed).
    const hi = Number((b >> 32n) & 0xffffffffn) | 0;
    const lo = Number(b & 0xffffffffn) | 0;
    return [hi, lo] as [number, number];
  });
}

const intTag = (v: number): nbt.Int => ({ type: 'int', value: v });
const stringTag = (v: string): nbt.String => ({ type: 'string', value: v });
const longTag = (v: bigint): nbt.Long => {
  const hi = Number((v >> 32n) & 0xffffffffn) | 0;
  const lo = Number(v & 0xffffffffn) | 0;
  return { type: 'long', value: [hi, lo] };
};

const xyzCompound = (x: number, y: number, z: number): nbt.Compound => ({
  type: 'compound',
  value: { x: intTag(x), y: intTag(y), z: intTag(z) },
});

export type LitematicResult = {
  buffer: Buffer;
  totalBlocks: number;
  paletteSize: number;
  bitsPerEntry: number;
};

export function buildLitematic(
  session: Session,
  rows: BlockRow[],
  opts: ExportOptions = {}
): LitematicResult {
  const sx = session.size_x;
  const sy = session.size_y;
  const sz = session.size_z;
  const volume = sx * sy * sz;

  // Build palette. Index 0 is always air.
  const air: BlockState = { name: 'minecraft:air' };
  const palette: BlockState[] = [air];
  const paletteIndex = new Map<string, number>();
  paletteIndex.set(stateKey(air), 0);

  // Dense indices array, default 0 (air).
  const indices = new Array<number>(volume).fill(0);
  let totalBlocks = 0;
  for (const row of rows) {
    if (
      row.x < 0 || row.x >= sx ||
      row.y < 0 || row.y >= sy ||
      row.z < 0 || row.z >= sz
    ) continue;
    const state = parseBlockState(row.block_type);
    if (state.name === 'minecraft:air') continue;
    const k = stateKey(state);
    let idx = paletteIndex.get(k);
    if (idx === undefined) {
      idx = palette.length;
      palette.push(state);
      paletteIndex.set(k, idx);
    }
    const flat = (row.y * sz + row.z) * sx + row.x;
    indices[flat] = idx;
    totalBlocks++;
  }

  const bpe = bitsPerEntryFor(palette.length);
  const packed = packBlockStates(indices, bpe);

  const paletteList: nbt.List<nbt.TagType.Compound> = {
    type: 'list',
    value: {
      type: 'compound',
      value: palette.map((p) => {
        const c: nbt.Compound['value'] = { Name: stringTag(p.name) };
        if (p.properties && Object.keys(p.properties).length > 0) {
          const propsCompound: nbt.Compound = {
            type: 'compound',
            value: Object.fromEntries(Object.entries(p.properties).map(([k, v]) => [k, stringTag(v)])),
          };
          c.Properties = propsCompound;
        }
        return c;
      }),
    },
  };

  const emptyCompoundList: nbt.List<nbt.TagType.Compound> = {
    type: 'list',
    value: { type: 'compound', value: [] },
  };

  const blockStatesArray: nbt.LongArray = { type: 'longArray', value: packed };

  const region: nbt.Compound = {
    type: 'compound',
    value: {
      Position: xyzCompound(0, 0, 0),
      Size: xyzCompound(sx, sy, sz),
      BlockStatePalette: paletteList,
      BlockStates: blockStatesArray,
      TileEntities: emptyCompoundList,
      Entities: emptyCompoundList,
      PendingBlockTicks: emptyCompoundList,
      PendingFluidTicks: emptyCompoundList,
    },
  };

  const regionName = opts.regionName ?? 'Main';
  const now = BigInt(Date.now());

  const root: nbt.NBT = {
    type: 'compound',
    name: '',
    value: {
      Version: intTag(SCHEMATIC_VERSION),
      MinecraftDataVersion: intTag(dataVersionFor(session.mc_version)),
      Metadata: {
        type: 'compound',
        value: {
          Author: stringTag(opts.author ?? 'mcmcp'),
          Description: stringTag(opts.description ?? `Built via mcmcp session ${session.id}`),
          Name: stringTag(opts.name ?? `mcmcp ${session.id}`),
          RegionCount: intTag(1),
          TimeCreated: longTag(now),
          TimeModified: longTag(now),
          TotalBlocks: intTag(totalBlocks),
          TotalVolume: intTag(volume),
          EnclosingSize: xyzCompound(sx, sy, sz),
        },
      },
      Regions: {
        type: 'compound',
        value: { [regionName]: region },
      },
    },
  };

  const uncompressed = nbt.writeUncompressed(root, 'big');
  const buffer = gzipSync(uncompressed);
  return { buffer, totalBlocks, paletteSize: palette.length, bitsPerEntry: bpe };
}
