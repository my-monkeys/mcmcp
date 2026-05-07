// web/src/lib/biome/poisson.ts
import type { Rng } from './rng';

export type Point2D = { x: number; z: number };

export function poissonDisk2D(
  width: number,
  depth: number,
  minDistance: number,
  rng: Rng,
  k = 30,
): Point2D[] {
  const cellSize = minDistance / Math.SQRT2;
  const gridW = Math.ceil(width / cellSize);
  const gridD = Math.ceil(depth / cellSize);
  const grid: (Point2D | null)[] = new Array(gridW * gridD).fill(null);
  const cellOf = (x: number, z: number) => Math.floor(z / cellSize) * gridW + Math.floor(x / cellSize);

  const points: Point2D[] = [];
  const active: Point2D[] = [];

  const first = { x: rng.next() * width, z: rng.next() * depth };
  points.push(first);
  active.push(first);
  grid[cellOf(first.x, first.z)] = first;

  while (active.length > 0) {
    const idx = rng.int(0, active.length - 1);
    const center = active[idx]!;
    let placed = false;

    for (let attempt = 0; attempt < k; attempt++) {
      const angle = rng.next() * Math.PI * 2;
      const radius = minDistance * (1 + rng.next());
      const candidate = {
        x: center.x + Math.cos(angle) * radius,
        z: center.z + Math.sin(angle) * radius,
      };
      if (candidate.x < 0 || candidate.x >= width || candidate.z < 0 || candidate.z >= depth) continue;

      const cx = Math.floor(candidate.x / cellSize);
      const cz = Math.floor(candidate.z / cellSize);
      let ok = true;
      for (let oz = -2; oz <= 2 && ok; oz++) {
        for (let ox = -2; ox <= 2 && ok; ox++) {
          const nx = cx + ox, nz = cz + oz;
          if (nx < 0 || nx >= gridW || nz < 0 || nz >= gridD) continue;
          const neighbor = grid[nz * gridW + nx];
          if (!neighbor) continue;
          const dx = neighbor.x - candidate.x, dz = neighbor.z - candidate.z;
          if (dx * dx + dz * dz < minDistance * minDistance) ok = false;
        }
      }

      if (ok) {
        points.push(candidate);
        active.push(candidate);
        grid[cz * gridW + cx] = candidate;
        placed = true;
        break;
      }
    }

    if (!placed) active.splice(idx, 1);
  }

  return points;
}
