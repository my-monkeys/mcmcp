// mcp/src/biome/pipeline.ts
import type { BiomeConfig, GenerateOptions, Placement, Region, RiversConfig } from './types.js';
import type { Rng } from './rng.js';
import { createRng } from './rng.js';
import { createNoise2D, fbm, type Noise2D } from './noise.js';
import { placeTree, loadTreeTemplate } from './trees.js';
import { poissonDisk2D } from './poisson.js';

type Cell = string;
const cellKey = (x: number, y: number, z: number): Cell => `${x},${y},${z}`;

function effectiveRegion(opts: GenerateOptions): Region {
  if (opts.region) return opts.region;
  return {
    x1: 0, y1: 0, z1: 0,
    x2: opts.size.x - 1, y2: opts.size.y - 1, z2: opts.size.z - 1,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function heightmapPass(cfg: BiomeConfig, noise: Noise2D, region: Region): Map<string, number> {
  const out = new Map<string, number>();
  const { base, amplitude, octaves, frequency } = cfg.heightmap;
  for (let x = region.x1; x <= region.x2; x++) {
    for (let z = region.z1; z <= region.z2; z++) {
      const n = fbm(noise, x, z, octaves, frequency);
      const y = clamp(Math.round(base + amplitude * n), region.y1, region.y2);
      out.set(`${x},${z}`, y);
    }
  }
  return out;
}

function terrainFillPass(
  cfg: BiomeConfig, cells: Map<Cell, string>, heightmap: Map<string, number>, region: Region,
): void {
  const { fill, subsurface, subsurfaceDepth, deep, terrainDepth } = cfg.blocks;
  for (let x = region.x1; x <= region.x2; x++) {
    for (let z = region.z1; z <= region.z2; z++) {
      const surfaceY = heightmap.get(`${x},${z}`)!;
      const minY = Math.max(region.y1, surfaceY - terrainDepth);
      for (let y = minY; y < surfaceY; y++) {
        const depthFromSurface = surfaceY - y;
        if (deep && y === region.y1) cells.set(cellKey(x, y, z), deep);
        else if (depthFromSurface <= subsurfaceDepth) cells.set(cellKey(x, y, z), subsurface);
        else cells.set(cellKey(x, y, z), fill);
      }
    }
  }
}

function surfacePass(
  cfg: BiomeConfig, cells: Map<Cell, string>, heightmap: Map<string, number>, region: Region,
): void {
  const { surface, beach } = cfg.blocks;
  const seaLevel = cfg.seaLevel;
  for (let x = region.x1; x <= region.x2; x++) {
    for (let z = region.z1; z <= region.z2; z++) {
      const y = heightmap.get(`${x},${z}`)!;
      let block = surface;
      if (beach && seaLevel !== null && y < seaLevel + 2) block = beach;
      cells.set(cellKey(x, y, z), block);
    }
  }
}

function waterPass(
  cfg: BiomeConfig, cells: Map<Cell, string>, heightmap: Map<string, number>, region: Region,
): void {
  if (cfg.seaLevel === null) return;
  const sea = cfg.seaLevel;
  for (let x = region.x1; x <= region.x2; x++) {
    for (let z = region.z1; z <= region.z2; z++) {
      const surfaceY = heightmap.get(`${x},${z}`)!;
      if (surfaceY >= sea) continue;
      for (let y = surfaceY + 1; y <= sea && y <= region.y2; y++) {
        cells.set(cellKey(x, y, z), 'water');
      }
    }
  }
}

function riverPass(
  cfg: BiomeConfig,
  cells: Map<Cell, string>,
  heightmap: Map<string, number>,
  region: Region,
  riverNoise: Noise2D,
  rivers: RiversConfig,
): void {
  const r = rivers;
  const bank = cfg.blocks.beach;
  const bankOuter = bank && r.bankWidth ? r.threshold + r.bankWidth : null;
  for (let x = region.x1; x <= region.x2; x++) {
    for (let z = region.z1; z <= region.z2; z++) {
      const v = Math.abs(riverNoise(x * r.frequency, z * r.frequency));
      const surfaceY = heightmap.get(`${x},${z}`)!;
      if (v < r.threshold) {
        cells.set(cellKey(x, surfaceY, z), 'water');
        const bedY = surfaceY - 1;
        if (bedY >= region.y1) {
          const k = cellKey(x, bedY, z);
          const cur = cells.get(k);
          if (cur === cfg.blocks.subsurface || cur === cfg.blocks.fill) {
            cells.set(k, 'dirt');
          }
        }
      } else if (bank && bankOuter !== null && v < bankOuter) {
        cells.set(cellKey(x, surfaceY, z), bank);
      }
    }
  }
}

function featurePass(
  cfg: BiomeConfig, cells: Map<Cell, string>, heightmap: Map<string, number>, region: Region, rng: Rng,
): void {
  const w = region.x2 - region.x1 + 1;
  const d = region.z2 - region.z1 + 1;
  const seaLevel = cfg.seaLevel;

  for (const f of cfg.features) {
    if (f.kind === 'tree') {
      const tpl = loadTreeTemplate(f.template);
      const allow = f.requiresSurface ? new Set(f.requiresSurface) : null;
      const points = poissonDisk2D(w, d, f.minDistance, rng);
      for (const p of points) {
        if (!rng.bool(f.probability)) continue;
        const x = region.x1 + Math.floor(p.x);
        const z = region.z1 + Math.floor(p.z);
        const surfaceY = heightmap.get(`${x},${z}`);
        if (surfaceY === undefined) continue;
        if (seaLevel !== null && surfaceY < seaLevel) continue;
        if (surfaceY + tpl.height > region.y2) continue;
        if (allow) {
          const surfaceCell = cells.get(cellKey(x, surfaceY, z));
          if (!surfaceCell || !allow.has(surfaceCell)) continue;
        }
        const rotation = (rng.int(0, 3) as 0 | 1 | 2 | 3);
        for (const placement of placeTree(tpl, x, surfaceY, z, rotation)) {
          if (
            placement.x < region.x1 || placement.x > region.x2 ||
            placement.z < region.z1 || placement.z > region.z2 ||
            placement.y < region.y1 || placement.y > region.y2
          ) continue;
          cells.set(cellKey(placement.x, placement.y, placement.z), placement.block);
        }
      }
    } else if (f.kind === 'cluster') {
      const allow = f.requiresSurface ? new Set(f.requiresSurface) : null;
      for (let x = region.x1; x <= region.x2; x++) {
        for (let z = region.z1; z <= region.z2; z++) {
          if (!rng.bool(f.density)) continue;
          const surfaceY = heightmap.get(`${x},${z}`)!;
          if (seaLevel !== null && surfaceY < seaLevel) continue;
          const aboveY = surfaceY + 1;
          if (aboveY > region.y2) continue;
          if (cells.has(cellKey(x, aboveY, z))) continue;
          if (allow) {
            const surfaceCell = cells.get(cellKey(x, surfaceY, z));
            if (!surfaceCell || !allow.has(surfaceCell)) continue;
          }
          cells.set(cellKey(x, aboveY, z), f.block);
        }
      }
    } else if (f.kind === 'layer') {
      const replaceable = new Set([cfg.blocks.fill, cfg.blocks.subsurface]);
      for (const band of f.bands) {
        if (band.y < region.y1 || band.y > region.y2) continue;
        for (let x = region.x1; x <= region.x2; x++) {
          for (let z = region.z1; z <= region.z2; z++) {
            const k = cellKey(x, band.y, z);
            const cur = cells.get(k);
            if (cur && replaceable.has(cur)) cells.set(k, band.block);
          }
        }
      }
    }
  }
}

export function runPipeline(cfg: BiomeConfig, opts: GenerateOptions): Placement[] {
  const region = effectiveRegion(opts);
  const seed = opts.seed ?? Date.now();
  const rng = createRng(seed);
  const noise = createNoise2D(createRng(seed ^ 0x9e3779b1));
  const riverNoise = createNoise2D(createRng(seed ^ 0xfeedface));

  const cells = new Map<Cell, string>();
  const heightmap = heightmapPass(cfg, noise, region);
  terrainFillPass(cfg, cells, heightmap, region);
  surfacePass(cfg, cells, heightmap, region);
  waterPass(cfg, cells, heightmap, region);
  if (opts.rivers && cfg.rivers) {
    const effectiveRivers: RiversConfig = { ...cfg.rivers, ...(opts.riverOverride ?? {}) };
    riverPass(cfg, cells, heightmap, region, riverNoise, effectiveRivers);
  }
  featurePass(cfg, cells, heightmap, region, rng);

  const out: Placement[] = [];
  for (const [k, block] of cells) {
    const [x, y, z] = k.split(',').map(Number) as [number, number, number];
    out.push({ x, y, z, block });
  }
  return out;
}
