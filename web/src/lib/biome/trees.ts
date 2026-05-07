// web/src/lib/biome/trees.ts
import type { Placement, TreeTemplate } from './types';

const cache = new Map<string, TreeTemplate>();

export async function loadTreeTemplate(name: string): Promise<TreeTemplate> {
  const cached = cache.get(name);
  if (cached) return cached;
  const res = await fetch(`/templates/trees/${name}.json`);
  if (!res.ok) throw new Error(`Tree template "${name}" not found (HTTP ${res.status})`);
  const tpl = (await res.json()) as TreeTemplate;
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
