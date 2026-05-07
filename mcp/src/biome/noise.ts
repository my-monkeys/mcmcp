// web/src/lib/biome/noise.ts
import type { Rng } from './rng';

const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;

const GRAD2: ReadonlyArray<readonly [number, number]> = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [1, 0], [-1, 0],
  [0, 1], [0, -1], [0, 1], [0, -1],
];

export type Noise2D = (x: number, y: number) => number;

export function createNoise2D(rng: Rng): Noise2D {
  const p = new Uint8Array(512);
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i++) base[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = rng.int(0, i);
    const tmp = base[i]!;
    base[i] = base[j]!;
    base[j] = tmp;
  }
  for (let i = 0; i < 512; i++) p[i] = base[i & 255]!;

  const dot = (g: readonly [number, number], x: number, y: number) => g[0] * x + g[1] * y;

  return (xin: number, yin: number): number => {
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const X0 = i - t, Y0 = j - t;
    const x0 = xin - X0, y0 = yin - Y0;

    let i1: number, j1: number;
    if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }

    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2, y2 = y0 - 1.0 + 2.0 * G2;

    const ii = i & 255, jj = j & 255;
    const gi0 = p[ii + p[jj]!]! % 12;
    const gi1 = p[ii + i1 + p[jj + j1]!]! % 12;
    const gi2 = p[ii + 1 + p[jj + 1]!]! % 12;

    let n0 = 0, n1 = 0, n2 = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) { t0 *= t0; n0 = t0 * t0 * dot(GRAD2[gi0]!, x0, y0); }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) { t1 *= t1; n1 = t1 * t1 * dot(GRAD2[gi1]!, x1, y1); }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) { t2 *= t2; n2 = t2 * t2 * dot(GRAD2[gi2]!, x2, y2); }

    return 70.0 * (n0 + n1 + n2);
  };
}

export function fbm(
  noise: Noise2D,
  x: number,
  y: number,
  octaves: number,
  frequency: number,
  persistence = 0.5,
  lacunarity = 2.0,
): number {
  let total = 0;
  let amplitude = 1;
  let freq = frequency;
  let maxAmp = 0;
  for (let i = 0; i < octaves; i++) {
    total += noise(x * freq, y * freq) * amplitude;
    maxAmp += amplitude;
    amplitude *= persistence;
    freq *= lacunarity;
  }
  return total / maxAmp;
}
