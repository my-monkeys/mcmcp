// mcp/src/biome/trees.ts
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Placement, TreeTemplate } from './types.js';

const __dir = dirname(fileURLToPath(import.meta.url));
// From compiled dist/biome/trees.js: __dir = mcp/dist/biome → mcp/dist → mcp/
const MCP_ROOT = join(__dir, '..', '..');
const TEMPLATES_DIR = process.env.MCMCP_TREE_TEMPLATES_DIR ?? join(MCP_ROOT, 'templates', 'trees');

const cache = new Map<string, TreeTemplate>();

export function loadTreeTemplate(name: string): TreeTemplate {
  const cached = cache.get(name);
  if (cached) return cached;
  const path = join(TEMPLATES_DIR, `${name}.json`);
  const raw = readFileSync(path, 'utf8');
  const tpl = JSON.parse(raw) as TreeTemplate;
  cache.set(name, tpl);
  return tpl;
}

export function placeTree(
  tpl: TreeTemplate,
  bx: number,
  by: number,
  bz: number,
  rotation: 0 | 1 | 2 | 3,
): Placement[] {
  const out: Placement[] = [];
  for (const b of tpl.blocks) {
    const lx = b.x - tpl.anchorX;
    const lz = b.z - tpl.anchorZ;
    let rx: number, rz: number;
    switch (rotation) {
      case 0: rx = lx;   rz = lz;   break;
      case 1: rx = -lz;  rz = lx;   break;
      case 2: rx = -lx;  rz = -lz;  break;
      case 3: rx = lz;   rz = -lx;  break;
    }
    out.push({ x: bx + rx, y: by + 1 + b.y, z: bz + rz, block: b.block });
  }
  return out;
}
