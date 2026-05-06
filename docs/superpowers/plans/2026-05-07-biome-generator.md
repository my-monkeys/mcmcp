# Biome Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a procedural Minecraft biome terrain generator to mcmcp — 5 biomes (plains, forest, desert, taiga, mesa), real multi-octave simplex noise, Poisson-distributed trees from JSON templates, biome-specific cluster/layer features. Trigger surfaces: MCP tool `generate_biome` + viewer panel.

**Architecture:** Pure-TS pipeline in 5 sequential passes (heightmap → terrain → surface → water → features). Library lives in `web/src/lib/biome/` and is mirrored in `mcp/src/biome/` per the repo's existing pattern (litematic.ts, bg2template.ts duplicate the same way). Tree templates ship as small hand-authored JSON files; no NBT runtime parsing.

**Tech Stack:** TypeScript, no new heavy deps. Adds nothing to the npm install — `@supabase/supabase-js` is already present for batch writes.

**Spec:** `docs/superpowers/specs/2026-05-07-biome-generator-design.md`

**Tree templates note:** The spec mentioned bundling MC structure NBTs at runtime. To avoid asset-redistribution questions and to keep the runtime path simple, this plan implements trees as small hand-authored JSON templates (~30-80 lines per species, recognizable shapes). The pipeline is ready to swap to NBT-loaded templates later if desired — the in-memory shape is the same.

**Testing approach:** No test framework added. Verification per task = `pnpm exec tsc --noEmit` + `pnpm lint` + `pnpm build`. End-to-end verification = generate a biome in `pnpm dev`, inspect the live viewer, export `.litematic`, load in Minecraft. The pure-utility files (rng, noise, poisson) get small node-tsx assertion scripts that are NOT committed.

---

## Phase 0 — Branch + scaffolding

### Task 0.1: Feature branch + base directories

**Files:**
- Create: `web/src/lib/biome/` (directory)
- Create: `web/src/lib/biome/features/` (directory)
- Create: `web/src/lib/biome/biomes/` (directory)
- Create: `web/public/templates/` (directory)
- Create: `web/public/templates/trees/` (directory)
- Create: `mcp/src/biome/` (directory)
- Create: `mcp/src/biome/features/` (directory)
- Create: `mcp/src/biome/biomes/` (directory)
- Create: `mcp/templates/trees/` (directory)

- [ ] **Step 1: Create feature branch**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp
git checkout main
git pull origin main
git checkout -b feat/biome-generator
```

- [ ] **Step 2: Create the directory tree**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp
mkdir -p web/src/lib/biome/features web/src/lib/biome/biomes web/public/templates/trees
mkdir -p mcp/src/biome/features mcp/src/biome/biomes mcp/templates/trees
```

- [ ] **Step 3: Add a placeholder so empty directories are tracked**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp
touch web/public/templates/trees/.gitkeep mcp/templates/trees/.gitkeep
```

- [ ] **Step 4: Commit**

```bash
git add web/src/lib/biome web/public/templates mcp/src/biome mcp/templates
git commit -m "chore(biome): scaffold directories"
```

---

## Phase 1 — Foundation utilities (web)

These four files are pure functions with no Supabase / DOM dependency. They form the bedrock for the pipeline.

### Task 1.1: Types

**Files:**
- Create: `web/src/lib/biome/types.ts`

- [ ] **Step 1: Write the types module**

```ts
// web/src/lib/biome/types.ts

export type BiomeName = 'plains' | 'forest' | 'desert' | 'taiga' | 'mesa';

export type Region = {
  x1: number; y1: number; z1: number;
  x2: number; y2: number; z2: number;
};

export type Placement = {
  x: number;
  y: number;
  z: number;
  block: string;
};

export type GenerateOptions = {
  biome: BiomeName;
  size: { x: number; y: number; z: number };
  seed?: number;
  region?: Region;
};

export type HeightmapConfig = {
  base: number;        // baseline surface Y
  amplitude: number;   // peak-to-trough variation
  octaves: number;     // 3 (smooth) to 5 (jagged)
  frequency: number;   // noise scale, e.g. 0.05
};

export type BlockRules = {
  surface: string;          // e.g. 'grass_block'
  subsurface: string;       // e.g. 'dirt'
  subsurfaceDepth: number;  // typically 4
  fill: string;             // e.g. 'stone'
  deep: string | null;      // bedrock or null
  beach: string | null;     // shore block or null
};

export type TreeFeature = {
  kind: 'tree';
  template: string;       // 'oak' | 'birch' | 'spruce'
  minDistance: number;    // Poisson minimum distance
  probability: number;    // [0..1] per Poisson point
};

export type ClusterFeature = {
  kind: 'cluster';
  block: string;          // e.g. 'short_grass'
  density: number;        // [0..1] per surface cell
};

export type LayerFeature = {
  kind: 'layer';
  bands: { y: number; block: string }[];
};

export type FeatureConfig = TreeFeature | ClusterFeature | LayerFeature;

export type BiomeConfig = {
  heightmap: HeightmapConfig;
  blocks: BlockRules;
  seaLevel: number | null;   // null = no water (desert, mesa)
  features: FeatureConfig[];
};

export type TreeTemplate = {
  width: number;
  height: number;
  depth: number;
  // Trunk base is at (anchorX, 0, anchorZ); placements are relative offsets.
  anchorX: number;
  anchorZ: number;
  blocks: Placement[];
};
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp/web
pnpm exec tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp
git add web/src/lib/biome/types.ts
git commit -m "feat(biome): types module"
```

---

### Task 1.2: Seedable PRNG

**Files:**
- Create: `web/src/lib/biome/rng.ts`

- [ ] **Step 1: Write the RNG**

```ts
// web/src/lib/biome/rng.ts

/**
 * mulberry32 — fast, deterministic, seedable PRNG. Produces 32-bit fractions
 * uniformly distributed in [0, 1). Same seed → same sequence forever.
 */
export type Rng = {
  next(): number;
  int(min: number, max: number): number;     // [min, max] inclusive
  bool(p: number): boolean;                  // probability p of true
  pick<T>(items: readonly T[]): T;
};

export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int(min: number, max: number): number {
      return Math.floor(next() * (max - min + 1)) + min;
    },
    bool(p: number): boolean {
      return next() < p;
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error('pick from empty array');
      return items[Math.floor(next() * items.length)]!;
    },
  };
}
```

- [ ] **Step 2: Quick determinism sanity check (NOT committed)**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp/web
cat > /tmp/check-rng.ts <<'EOF'
import { createRng } from './src/lib/biome/rng.ts';
const a = createRng(42);
const b = createRng(42);
const aSeq = [a.next(), a.next(), a.next()];
const bSeq = [b.next(), b.next(), b.next()];
console.log('a', aSeq);
console.log('b', bSeq);
console.log('match', JSON.stringify(aSeq) === JSON.stringify(bSeq));
EOF
pnpm exec tsx /tmp/check-rng.ts
rm /tmp/check-rng.ts
```

Expected: `match true`, identical 3-number sequences.

- [ ] **Step 3: Typecheck + commit**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp/web
pnpm exec tsc --noEmit
cd /Users/maxim/Documents/my-monkey/mcmcp
git add web/src/lib/biome/rng.ts
git commit -m "feat(biome): seedable mulberry32 PRNG"
```

---

### Task 1.3: 2D simplex noise + multi-octave fbm

**Files:**
- Create: `web/src/lib/biome/noise.ts`

- [ ] **Step 1: Write the noise module**

This is a port of Stefan Gustavson's 2D simplex noise (public domain). Permutation table is seeded via the RNG so noise is deterministic per seed.

```ts
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
  // Build a Fisher-Yates shuffled 256-entry permutation, then double it.
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

/**
 * Fractal Brownian motion. Sums `octaves` layers of noise at increasing
 * frequencies and decreasing amplitudes. Output normalized to roughly [-1, 1].
 */
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
```

- [ ] **Step 2: Sanity check (NOT committed)**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp/web
cat > /tmp/check-noise.ts <<'EOF'
import { createRng } from './src/lib/biome/rng.ts';
import { createNoise2D, fbm } from './src/lib/biome/noise.ts';
const noise = createNoise2D(createRng(42));
let min = Infinity, max = -Infinity;
for (let x = 0; x < 64; x++) for (let z = 0; z < 64; z++) {
  const v = fbm(noise, x, z, 4, 0.05);
  if (v < min) min = v;
  if (v > max) max = v;
}
console.log('fbm range over 64x64', { min, max });
EOF
pnpm exec tsx /tmp/check-noise.ts
rm /tmp/check-noise.ts
```

Expected: `min` and `max` should fall within roughly [-1, 1].

- [ ] **Step 3: Typecheck + commit**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp/web
pnpm exec tsc --noEmit
cd /Users/maxim/Documents/my-monkey/mcmcp
git add web/src/lib/biome/noise.ts
git commit -m "feat(biome): 2D simplex noise + fbm"
```

---

### Task 1.4: Poisson-disk sampling

**Files:**
- Create: `web/src/lib/biome/poisson.ts`

- [ ] **Step 1: Write Bridson's Poisson-disk algorithm in 2D**

```ts
// web/src/lib/biome/poisson.ts
import type { Rng } from './rng';

export type Point2D = { x: number; z: number };

/**
 * Bridson's algorithm — produces a set of points with uniform density and
 * minimum distance `minDistance` from each other, inside [0, width) × [0, depth).
 *
 * Deterministic with respect to `rng`.
 */
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
```

- [ ] **Step 2: Sanity check (NOT committed)**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp/web
cat > /tmp/check-poisson.ts <<'EOF'
import { createRng } from './src/lib/biome/rng.ts';
import { poissonDisk2D } from './src/lib/biome/poisson.ts';
const rng = createRng(42);
const pts = poissonDisk2D(64, 64, 8, rng);
console.log('points', pts.length);
// Verify minimum distance
let minSq = Infinity;
for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
  const dx = pts[i].x - pts[j].x, dz = pts[i].z - pts[j].z;
  const d = dx * dx + dz * dz;
  if (d < minSq) minSq = d;
}
console.log('min distance achieved', Math.sqrt(minSq), '(should be >= 8)');
EOF
pnpm exec tsx /tmp/check-poisson.ts
rm /tmp/check-poisson.ts
```

Expected: ~50-80 points in 64×64 with minDistance=8, achieved minimum distance ≥ 8.

- [ ] **Step 3: Typecheck + commit**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp/web
pnpm exec tsc --noEmit
cd /Users/maxim/Documents/my-monkey/mcmcp
git add web/src/lib/biome/poisson.ts
git commit -m "feat(biome): Bridson Poisson-disk sampling"
```

---

## Phase 2 — Tree templates

### Task 2.1: Author tree template JSONs

**Files:**
- Create: `web/public/templates/trees/oak.json`
- Create: `web/public/templates/trees/birch.json`
- Create: `web/public/templates/trees/spruce.json`

The format matches `TreeTemplate` from `types.ts`. Coordinates are relative to the trunk base at (anchorX, 0, anchorZ). Y increases upward. The trunk's bottom block sits at the surface position when placed.

- [ ] **Step 1: Write `oak.json`**

A small standard oak: 5-tall trunk, irregular canopy. ~24 blocks total.

```json
{
  "width": 5,
  "height": 7,
  "depth": 5,
  "anchorX": 2,
  "anchorZ": 2,
  "blocks": [
    { "x": 2, "y": 0, "z": 2, "block": "oak_log" },
    { "x": 2, "y": 1, "z": 2, "block": "oak_log" },
    { "x": 2, "y": 2, "z": 2, "block": "oak_log" },
    { "x": 2, "y": 3, "z": 2, "block": "oak_log" },
    { "x": 2, "y": 4, "z": 2, "block": "oak_log" },

    { "x": 1, "y": 4, "z": 1, "block": "oak_leaves" },
    { "x": 1, "y": 4, "z": 2, "block": "oak_leaves" },
    { "x": 1, "y": 4, "z": 3, "block": "oak_leaves" },
    { "x": 2, "y": 4, "z": 1, "block": "oak_leaves" },
    { "x": 2, "y": 4, "z": 3, "block": "oak_leaves" },
    { "x": 3, "y": 4, "z": 1, "block": "oak_leaves" },
    { "x": 3, "y": 4, "z": 2, "block": "oak_leaves" },
    { "x": 3, "y": 4, "z": 3, "block": "oak_leaves" },

    { "x": 0, "y": 5, "z": 2, "block": "oak_leaves" },
    { "x": 1, "y": 5, "z": 1, "block": "oak_leaves" },
    { "x": 1, "y": 5, "z": 2, "block": "oak_leaves" },
    { "x": 1, "y": 5, "z": 3, "block": "oak_leaves" },
    { "x": 2, "y": 5, "z": 0, "block": "oak_leaves" },
    { "x": 2, "y": 5, "z": 1, "block": "oak_leaves" },
    { "x": 2, "y": 5, "z": 2, "block": "oak_leaves" },
    { "x": 2, "y": 5, "z": 3, "block": "oak_leaves" },
    { "x": 2, "y": 5, "z": 4, "block": "oak_leaves" },
    { "x": 3, "y": 5, "z": 1, "block": "oak_leaves" },
    { "x": 3, "y": 5, "z": 2, "block": "oak_leaves" },
    { "x": 3, "y": 5, "z": 3, "block": "oak_leaves" },
    { "x": 4, "y": 5, "z": 2, "block": "oak_leaves" },

    { "x": 1, "y": 6, "z": 2, "block": "oak_leaves" },
    { "x": 2, "y": 6, "z": 1, "block": "oak_leaves" },
    { "x": 2, "y": 6, "z": 2, "block": "oak_leaves" },
    { "x": 2, "y": 6, "z": 3, "block": "oak_leaves" },
    { "x": 3, "y": 6, "z": 2, "block": "oak_leaves" }
  ]
}
```

- [ ] **Step 2: Write `birch.json`**

A taller, slimmer trunk than oak. 7-tall trunk, more compact canopy.

```json
{
  "width": 5,
  "height": 9,
  "depth": 5,
  "anchorX": 2,
  "anchorZ": 2,
  "blocks": [
    { "x": 2, "y": 0, "z": 2, "block": "birch_log" },
    { "x": 2, "y": 1, "z": 2, "block": "birch_log" },
    { "x": 2, "y": 2, "z": 2, "block": "birch_log" },
    { "x": 2, "y": 3, "z": 2, "block": "birch_log" },
    { "x": 2, "y": 4, "z": 2, "block": "birch_log" },
    { "x": 2, "y": 5, "z": 2, "block": "birch_log" },
    { "x": 2, "y": 6, "z": 2, "block": "birch_log" },

    { "x": 1, "y": 5, "z": 2, "block": "birch_leaves" },
    { "x": 3, "y": 5, "z": 2, "block": "birch_leaves" },
    { "x": 2, "y": 5, "z": 1, "block": "birch_leaves" },
    { "x": 2, "y": 5, "z": 3, "block": "birch_leaves" },

    { "x": 1, "y": 6, "z": 1, "block": "birch_leaves" },
    { "x": 1, "y": 6, "z": 2, "block": "birch_leaves" },
    { "x": 1, "y": 6, "z": 3, "block": "birch_leaves" },
    { "x": 2, "y": 6, "z": 1, "block": "birch_leaves" },
    { "x": 2, "y": 6, "z": 3, "block": "birch_leaves" },
    { "x": 3, "y": 6, "z": 1, "block": "birch_leaves" },
    { "x": 3, "y": 6, "z": 2, "block": "birch_leaves" },
    { "x": 3, "y": 6, "z": 3, "block": "birch_leaves" },
    { "x": 0, "y": 6, "z": 2, "block": "birch_leaves" },
    { "x": 4, "y": 6, "z": 2, "block": "birch_leaves" },
    { "x": 2, "y": 6, "z": 0, "block": "birch_leaves" },
    { "x": 2, "y": 6, "z": 4, "block": "birch_leaves" },

    { "x": 1, "y": 7, "z": 2, "block": "birch_leaves" },
    { "x": 3, "y": 7, "z": 2, "block": "birch_leaves" },
    { "x": 2, "y": 7, "z": 1, "block": "birch_leaves" },
    { "x": 2, "y": 7, "z": 3, "block": "birch_leaves" },
    { "x": 2, "y": 7, "z": 2, "block": "birch_leaves" },

    { "x": 2, "y": 8, "z": 2, "block": "birch_leaves" }
  ]
}
```

- [ ] **Step 3: Write `spruce.json`**

A tall conifer: 8-block trunk with stepped tapered canopy ("Christmas tree" silhouette).

```json
{
  "width": 5,
  "height": 10,
  "depth": 5,
  "anchorX": 2,
  "anchorZ": 2,
  "blocks": [
    { "x": 2, "y": 0, "z": 2, "block": "spruce_log" },
    { "x": 2, "y": 1, "z": 2, "block": "spruce_log" },
    { "x": 2, "y": 2, "z": 2, "block": "spruce_log" },
    { "x": 2, "y": 3, "z": 2, "block": "spruce_log" },
    { "x": 2, "y": 4, "z": 2, "block": "spruce_log" },
    { "x": 2, "y": 5, "z": 2, "block": "spruce_log" },
    { "x": 2, "y": 6, "z": 2, "block": "spruce_log" },
    { "x": 2, "y": 7, "z": 2, "block": "spruce_log" },

    { "x": 0, "y": 3, "z": 2, "block": "spruce_leaves" },
    { "x": 4, "y": 3, "z": 2, "block": "spruce_leaves" },
    { "x": 2, "y": 3, "z": 0, "block": "spruce_leaves" },
    { "x": 2, "y": 3, "z": 4, "block": "spruce_leaves" },
    { "x": 1, "y": 3, "z": 1, "block": "spruce_leaves" },
    { "x": 1, "y": 3, "z": 3, "block": "spruce_leaves" },
    { "x": 3, "y": 3, "z": 1, "block": "spruce_leaves" },
    { "x": 3, "y": 3, "z": 3, "block": "spruce_leaves" },

    { "x": 1, "y": 4, "z": 2, "block": "spruce_leaves" },
    { "x": 3, "y": 4, "z": 2, "block": "spruce_leaves" },
    { "x": 2, "y": 4, "z": 1, "block": "spruce_leaves" },
    { "x": 2, "y": 4, "z": 3, "block": "spruce_leaves" },
    { "x": 1, "y": 4, "z": 1, "block": "spruce_leaves" },
    { "x": 3, "y": 4, "z": 3, "block": "spruce_leaves" },

    { "x": 1, "y": 5, "z": 2, "block": "spruce_leaves" },
    { "x": 3, "y": 5, "z": 2, "block": "spruce_leaves" },
    { "x": 2, "y": 5, "z": 1, "block": "spruce_leaves" },
    { "x": 2, "y": 5, "z": 3, "block": "spruce_leaves" },

    { "x": 1, "y": 6, "z": 2, "block": "spruce_leaves" },
    { "x": 3, "y": 6, "z": 2, "block": "spruce_leaves" },
    { "x": 2, "y": 6, "z": 1, "block": "spruce_leaves" },
    { "x": 2, "y": 6, "z": 3, "block": "spruce_leaves" },

    { "x": 2, "y": 7, "z": 1, "block": "spruce_leaves" },
    { "x": 2, "y": 7, "z": 3, "block": "spruce_leaves" },
    { "x": 1, "y": 7, "z": 2, "block": "spruce_leaves" },
    { "x": 3, "y": 7, "z": 2, "block": "spruce_leaves" },

    { "x": 2, "y": 8, "z": 2, "block": "spruce_leaves" },
    { "x": 2, "y": 9, "z": 2, "block": "spruce_leaves" }
  ]
}
```

- [ ] **Step 4: Mirror to mcp**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp
cp web/public/templates/trees/oak.json web/public/templates/trees/birch.json web/public/templates/trees/spruce.json mcp/templates/trees/
```

- [ ] **Step 5: Commit**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp
git add web/public/templates/trees mcp/templates/trees
git commit -m "feat(biome): tree templates (oak, birch, spruce) as JSON"
```

---

### Task 2.2: Tree template loader (web)

**Files:**
- Create: `web/src/lib/biome/trees.ts`

- [ ] **Step 1: Write the loader with cache**

```ts
// web/src/lib/biome/trees.ts
import type { Placement, TreeTemplate } from './types';

const cache = new Map<string, TreeTemplate>();

/**
 * Load a tree template by name. Templates live in `/templates/trees/<name>.json`.
 * Cached after first load — second call is synchronous from memory.
 */
export async function loadTreeTemplate(name: string): Promise<TreeTemplate> {
  const cached = cache.get(name);
  if (cached) return cached;
  const res = await fetch(`/templates/trees/${name}.json`);
  if (!res.ok) throw new Error(`Tree template "${name}" not found (HTTP ${res.status})`);
  const tpl = (await res.json()) as TreeTemplate;
  cache.set(name, tpl);
  return tpl;
}

/**
 * Place a tree template into the world at base position (bx, by, bz). The
 * template's `anchor*` is the trunk base in template-local coords; `by` is the
 * Y of the surface block on which the trunk sits (the first log goes at by+1).
 *
 * `rotation` is 0/1/2/3 = 0°/90°/180°/270° around vertical axis.
 */
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
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp/web
pnpm exec tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp
git add web/src/lib/biome/trees.ts
git commit -m "feat(biome): tree template loader (web/fetch)"
```

---

## Phase 3 — Pipeline (web)

### Task 3.1: Pipeline orchestrator with the 5 passes

**Files:**
- Create: `web/src/lib/biome/pipeline.ts`

- [ ] **Step 1: Write the pipeline**

```ts
// web/src/lib/biome/pipeline.ts
import type {
  BiomeConfig,
  GenerateOptions,
  Placement,
  Region,
} from './types';
import type { Rng } from './rng';
import { createRng } from './rng';
import { createNoise2D, fbm, type Noise2D } from './noise';
import { placeTree, loadTreeTemplate } from './trees';
import { poissonDisk2D } from './poisson';

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

/**
 * Build a heightmap: for each (x, z) in the region, sample fbm and convert
 * to a surface Y. Surface Y is clamped to the region's vertical bounds.
 */
function heightmapPass(
  cfg: BiomeConfig,
  noise: Noise2D,
  region: Region,
): Map<string, number> {
  const out = new Map<string, number>();
  const { base, amplitude, octaves, frequency } = cfg.heightmap;
  for (let x = region.x1; x <= region.x2; x++) {
    for (let z = region.z1; z <= region.z2; z++) {
      const n = fbm(noise, x, z, octaves, frequency);   // ~[-1, 1]
      const y = clamp(Math.round(base + amplitude * n), region.y1, region.y2);
      out.set(`${x},${z}`, y);
    }
  }
  return out;
}

/**
 * Fill stone/subsurface column for each (x, z), up to surfaceY - 1.
 * Mutates `cells` in place.
 */
function terrainFillPass(
  cfg: BiomeConfig,
  cells: Map<Cell, string>,
  heightmap: Map<string, number>,
  region: Region,
): void {
  const { fill, subsurface, subsurfaceDepth, deep } = cfg.blocks;
  for (let x = region.x1; x <= region.x2; x++) {
    for (let z = region.z1; z <= region.z2; z++) {
      const surfaceY = heightmap.get(`${x},${z}`)!;
      for (let y = region.y1; y < surfaceY; y++) {
        const depthFromSurface = surfaceY - y;
        if (deep && y === region.y1) {
          cells.set(cellKey(x, y, z), deep);
        } else if (depthFromSurface <= subsurfaceDepth) {
          cells.set(cellKey(x, y, z), subsurface);
        } else {
          cells.set(cellKey(x, y, z), fill);
        }
      }
    }
  }
}

function surfacePass(
  cfg: BiomeConfig,
  cells: Map<Cell, string>,
  heightmap: Map<string, number>,
  region: Region,
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
  cfg: BiomeConfig,
  cells: Map<Cell, string>,
  heightmap: Map<string, number>,
  region: Region,
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

async function featurePass(
  cfg: BiomeConfig,
  cells: Map<Cell, string>,
  heightmap: Map<string, number>,
  region: Region,
  rng: Rng,
): Promise<void> {
  const w = region.x2 - region.x1 + 1;
  const d = region.z2 - region.z1 + 1;
  const seaLevel = cfg.seaLevel;

  for (const f of cfg.features) {
    if (f.kind === 'tree') {
      const tpl = await loadTreeTemplate(f.template);
      const points = poissonDisk2D(w, d, f.minDistance, rng);
      for (const p of points) {
        if (!rng.bool(f.probability)) continue;
        const x = region.x1 + Math.floor(p.x);
        const z = region.z1 + Math.floor(p.z);
        const surfaceY = heightmap.get(`${x},${z}`);
        if (surfaceY === undefined) continue;
        if (seaLevel !== null && surfaceY < seaLevel) continue;  // no trees in water
        if (surfaceY + tpl.height > region.y2) continue;          // no trees that exceed zone
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
      for (let x = region.x1; x <= region.x2; x++) {
        for (let z = region.z1; z <= region.z2; z++) {
          if (!rng.bool(f.density)) continue;
          const surfaceY = heightmap.get(`${x},${z}`)!;
          if (seaLevel !== null && surfaceY < seaLevel) continue;
          const aboveY = surfaceY + 1;
          if (aboveY > region.y2) continue;
          // Don't overwrite an existing solid block above (e.g., tree trunk).
          if (cells.has(cellKey(x, aboveY, z))) continue;
          cells.set(cellKey(x, aboveY, z), f.block);
        }
      }
    } else if (f.kind === 'layer') {
      // For each cell currently set to fill or subsurface, replace at exact y.
      const replaceable = new Set([cfg.blocks.fill, cfg.blocks.subsurface]);
      for (const band of f.bands) {
        if (band.y < region.y1 || band.y > region.y2) continue;
        for (let x = region.x1; x <= region.x2; x++) {
          for (let z = region.z1; z <= region.z2; z++) {
            const k = cellKey(x, band.y, z);
            const cur = cells.get(k);
            if (cur && replaceable.has(cur)) {
              cells.set(k, band.block);
            }
          }
        }
      }
    }
  }
}

/**
 * Run the full pipeline: heightmap → terrain → surface → water → features.
 * Returns the deduplicated placements list.
 */
export async function runPipeline(
  cfg: BiomeConfig,
  opts: GenerateOptions,
): Promise<Placement[]> {
  const region = effectiveRegion(opts);
  const seed = opts.seed ?? Date.now();
  const rng = createRng(seed);
  const noise = createNoise2D(createRng(seed ^ 0x9e3779b1));   // separate stream

  const cells = new Map<Cell, string>();
  const heightmap = heightmapPass(cfg, noise, region);
  terrainFillPass(cfg, cells, heightmap, region);
  surfacePass(cfg, cells, heightmap, region);
  waterPass(cfg, cells, heightmap, region);
  await featurePass(cfg, cells, heightmap, region, rng);

  const out: Placement[] = [];
  for (const [k, block] of cells) {
    const [x, y, z] = k.split(',').map(Number) as [number, number, number];
    out.push({ x, y, z, block });
  }
  return out;
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp/web
pnpm exec tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp
git add web/src/lib/biome/pipeline.ts
git commit -m "feat(biome): pipeline with 5 passes (heightmap, terrain, surface, water, features)"
```

---

## Phase 4 — Biome configs

### Task 4.1: Plains, Forest, Desert configs

**Files:**
- Create: `web/src/lib/biome/biomes/plains.ts`
- Create: `web/src/lib/biome/biomes/forest.ts`
- Create: `web/src/lib/biome/biomes/desert.ts`

- [ ] **Step 1: Write `plains.ts`**

```ts
// web/src/lib/biome/biomes/plains.ts
import type { BiomeConfig } from '../types';

export const PlainsConfig: BiomeConfig = {
  heightmap: { base: 32, amplitude: 4, octaves: 3, frequency: 0.05 },
  blocks: {
    surface: 'grass_block',
    subsurface: 'dirt',
    subsurfaceDepth: 4,
    fill: 'stone',
    deep: null,
    beach: 'sand',
  },
  seaLevel: 31,
  features: [
    { kind: 'tree',    template: 'oak',          minDistance: 12, probability: 0.3 },
    { kind: 'cluster', block: 'short_grass',     density: 0.18 },
    { kind: 'cluster', block: 'dandelion',       density: 0.012 },
    { kind: 'cluster', block: 'poppy',           density: 0.008 },
  ],
};
```

- [ ] **Step 2: Write `forest.ts`**

```ts
// web/src/lib/biome/biomes/forest.ts
import type { BiomeConfig } from '../types';

export const ForestConfig: BiomeConfig = {
  heightmap: { base: 34, amplitude: 8, octaves: 4, frequency: 0.05 },
  blocks: {
    surface: 'grass_block',
    subsurface: 'dirt',
    subsurfaceDepth: 4,
    fill: 'stone',
    deep: null,
    beach: 'sand',
  },
  seaLevel: 31,
  features: [
    { kind: 'tree',    template: 'oak',          minDistance: 4, probability: 0.7 },
    { kind: 'tree',    template: 'birch',        minDistance: 5, probability: 0.4 },
    { kind: 'cluster', block: 'short_grass',     density: 0.22 },
    { kind: 'cluster', block: 'fern',            density: 0.05 },
  ],
};
```

- [ ] **Step 3: Write `desert.ts`**

```ts
// web/src/lib/biome/biomes/desert.ts
import type { BiomeConfig } from '../types';

export const DesertConfig: BiomeConfig = {
  heightmap: { base: 33, amplitude: 6, octaves: 3, frequency: 0.04 },
  blocks: {
    surface: 'sand',
    subsurface: 'sand',
    subsurfaceDepth: 4,
    fill: 'sandstone',
    deep: null,
    beach: null,
  },
  seaLevel: null,
  features: [
    { kind: 'cluster', block: 'cactus',     density: 0.005 },
    { kind: 'cluster', block: 'dead_bush',  density: 0.01 },
  ],
};
```

- [ ] **Step 4: Typecheck + commit**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp/web
pnpm exec tsc --noEmit
cd /Users/maxim/Documents/my-monkey/mcmcp
git add web/src/lib/biome/biomes/plains.ts web/src/lib/biome/biomes/forest.ts web/src/lib/biome/biomes/desert.ts
git commit -m "feat(biome): plains, forest, desert configs"
```

---

### Task 4.2: Taiga, Mesa configs + registry

**Files:**
- Create: `web/src/lib/biome/biomes/taiga.ts`
- Create: `web/src/lib/biome/biomes/mesa.ts`
- Create: `web/src/lib/biome/biomes/index.ts`

- [ ] **Step 1: Write `taiga.ts`**

```ts
// web/src/lib/biome/biomes/taiga.ts
import type { BiomeConfig } from '../types';

export const TaigaConfig: BiomeConfig = {
  heightmap: { base: 36, amplitude: 12, octaves: 4, frequency: 0.04 },
  blocks: {
    surface: 'grass_block',
    subsurface: 'dirt',
    subsurfaceDepth: 4,
    fill: 'stone',
    deep: null,
    beach: 'gravel',
  },
  seaLevel: 31,
  features: [
    { kind: 'tree',    template: 'spruce',       minDistance: 5, probability: 0.7 },
    { kind: 'cluster', block: 'fern',            density: 0.12 },
    { kind: 'cluster', block: 'large_fern',      density: 0.04 },
  ],
};
```

- [ ] **Step 2: Write `mesa.ts`**

```ts
// web/src/lib/biome/biomes/mesa.ts
import type { BiomeConfig } from '../types';

export const MesaConfig: BiomeConfig = {
  heightmap: { base: 36, amplitude: 24, octaves: 5, frequency: 0.04 },
  blocks: {
    surface: 'red_sand',
    subsurface: 'red_sand',
    subsurfaceDepth: 3,
    fill: 'terracotta',
    deep: null,
    beach: null,
  },
  seaLevel: null,
  features: [
    { kind: 'layer', bands: [
      { y: 38, block: 'orange_terracotta' },
      { y: 42, block: 'yellow_terracotta' },
      { y: 47, block: 'white_terracotta' },
      { y: 52, block: 'brown_terracotta' },
      { y: 56, block: 'light_gray_terracotta' },
    ] },
    { kind: 'cluster', block: 'dead_bush', density: 0.01 },
  ],
};
```

- [ ] **Step 3: Write the registry `biomes/index.ts`**

```ts
// web/src/lib/biome/biomes/index.ts
import type { BiomeConfig, BiomeName } from '../types';
import { PlainsConfig } from './plains';
import { ForestConfig } from './forest';
import { DesertConfig } from './desert';
import { TaigaConfig } from './taiga';
import { MesaConfig } from './mesa';

export const BIOMES: Record<BiomeName, BiomeConfig> = {
  plains: PlainsConfig,
  forest: ForestConfig,
  desert: DesertConfig,
  taiga: TaigaConfig,
  mesa: MesaConfig,
};
```

- [ ] **Step 4: Typecheck + commit**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp/web
pnpm exec tsc --noEmit
cd /Users/maxim/Documents/my-monkey/mcmcp
git add web/src/lib/biome/biomes/taiga.ts web/src/lib/biome/biomes/mesa.ts web/src/lib/biome/biomes/index.ts
git commit -m "feat(biome): taiga + mesa configs + biome registry"
```

---

## Phase 5 — Public API (web)

### Task 5.1: Public entry point + integration smoke

**Files:**
- Create: `web/src/lib/biome/index.ts`

- [ ] **Step 1: Write the public API**

```ts
// web/src/lib/biome/index.ts
import type { GenerateOptions, Placement } from './types';
import { runPipeline } from './pipeline';
import { BIOMES } from './biomes';

export type { BiomeName, GenerateOptions, Placement, Region } from './types';

export async function generateBiome(opts: GenerateOptions): Promise<Placement[]> {
  const cfg = BIOMES[opts.biome];
  if (!cfg) throw new Error(`Unknown biome "${opts.biome}"`);
  return runPipeline(cfg, opts);
}
```

- [ ] **Step 2: Typecheck + build**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp/web
pnpm exec tsc --noEmit
pnpm build
```

Expected: clean. The build will tree-shake the lib since nothing imports it yet.

- [ ] **Step 3: Commit**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp
git add web/src/lib/biome/index.ts
git commit -m "feat(biome): public generateBiome API"
```

---

## Phase 6 — Viewer panel

### Task 6.1: BiomePanel component

**Files:**
- Create: `web/src/app/s/[id]/BiomePanel.tsx`

- [ ] **Step 1: Write the component (without wiring yet)**

```tsx
// web/src/app/s/[id]/BiomePanel.tsx
'use client';

import { useState } from 'react';
import type { BiomeName } from '@/lib/biome';

const BIOMES: { value: BiomeName; label: string }[] = [
  { value: 'plains',  label: 'Plains' },
  { value: 'forest',  label: 'Forest' },
  { value: 'desert',  label: 'Desert' },
  { value: 'taiga',   label: 'Taiga' },
  { value: 'mesa',    label: 'Mesa' },
];

type Props = {
  hasExistingBlocks: boolean;
  busy: boolean;
  status: string | null;
  onGenerate: (biome: BiomeName, seed: number) => void;
};

export function BiomePanel({ hasExistingBlocks, busy, status, onGenerate }: Props) {
  const [biome, setBiome] = useState<BiomeName>('plains');
  const [seed, setSeed] = useState<number>(() => Math.floor(Math.random() * 0x7fffffff));
  const [confirmOpen, setConfirmOpen] = useState(false);

  const trigger = () => {
    if (hasExistingBlocks) {
      setConfirmOpen(true);
      return;
    }
    onGenerate(biome, seed);
  };

  const confirm = () => {
    setConfirmOpen(false);
    onGenerate(biome, seed);
  };

  return (
    <div className="bg-zinc-900/80 backdrop-blur border border-zinc-800 rounded-lg px-4 py-3 text-xs space-y-3 min-w-56">
      <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Generate biome</div>

      <label className="flex items-center justify-between gap-2">
        <span className="text-zinc-400">Biome</span>
        <select
          value={biome}
          onChange={(e) => setBiome(e.target.value as BiomeName)}
          className="bg-zinc-800/60 border border-zinc-700 rounded px-2 py-0.5 text-xs outline-none focus:border-blue-500"
        >
          {BIOMES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
        </select>
      </label>

      <label className="flex items-center justify-between gap-2">
        <span className="text-zinc-400">Seed</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value) || 0)}
            className="bg-zinc-800/60 border border-zinc-700 rounded px-2 py-0.5 text-xs outline-none focus:border-blue-500 w-24 tabular-nums"
          />
          <button
            onClick={() => setSeed(Math.floor(Math.random() * 0x7fffffff))}
            className="text-zinc-500 hover:text-zinc-200"
            title="Random seed"
          >🎲</button>
        </div>
      </label>

      <button
        onClick={trigger}
        disabled={busy}
        className="w-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded px-3 py-1.5 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {busy ? 'Generating…' : 'Generate biome →'}
      </button>

      {status && <div className="text-[10px] text-zinc-500 text-center">{status}</div>}

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 max-w-md text-sm space-y-4">
            <div className="font-semibold">Replace all blocks in the zone?</div>
            <p className="text-zinc-400">
              This will overwrite every existing block. The action cannot be undone from the viewer.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmOpen(false)}
                className="px-3 py-1.5 rounded border border-zinc-700 hover:bg-zinc-800 text-xs"
              >Cancel</button>
              <button
                onClick={confirm}
                className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white text-xs"
              >Replace and generate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp/web
pnpm exec tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp
git add web/src/app/s/'[id]'/BiomePanel.tsx
git commit -m "feat(viewer): BiomePanel component (UI only, not wired)"
```

---

### Task 6.2: Wire BiomePanel into the viewer

**Files:**
- Modify: `web/src/app/s/[id]/Viewer.tsx`

- [ ] **Step 1: Add the import + state + handler**

Open `web/src/app/s/[id]/Viewer.tsx`. Near the top of the imports section (after the other component imports), add:

```tsx
import { BiomePanel } from './BiomePanel';
import { generateBiome, type BiomeName } from '@/lib/biome';
```

Inside the `Viewer` component body, after the existing `const [bg2State, ...] = useState(...)` line, add:

```tsx
const [biomeBusy, setBiomeBusy] = useState(false);
const [biomeStatus, setBiomeStatus] = useState<string | null>(null);

const handleGenerateBiome = async (biome: BiomeName, seed: number) => {
  setBiomeBusy(true);
  setBiomeStatus('Generating…');
  try {
    const region = selectionEnabled ? selection : undefined;
    const placements = await generateBiome({
      biome,
      size: { x: session.size_x, y: session.size_y, z: session.size_z },
      seed,
      region,
    });
    setBiomeStatus(`Writing ${placements.length} blocks…`);

    const BATCH = 1000;
    for (let i = 0; i < placements.length; i += BATCH) {
      const slice = placements.slice(i, i + BATCH);
      const rows = slice.map((p) => ({
        session_id: session.id,
        x: p.x, y: p.y, z: p.z,
        block_type: p.block,
      }));
      const { error: e } = await supabase
        .from('mcmcp_blocks')
        .upsert(rows, { onConflict: 'session_id,x,y,z' });
      if (e) throw e;
      setBiomeStatus(`Writing ${Math.min(i + BATCH, placements.length)} / ${placements.length}…`);
    }
    setBiomeStatus(`Generated ${biome} (${placements.length} blocks)`);
    setTimeout(() => setBiomeStatus(null), 3000);
  } catch (e) {
    setBiomeStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    setBiomeBusy(false);
  }
};
```

- [ ] **Step 2: Render the panel**

In the same file, find the JSX block on the right side that contains the Recenter / Download buttons (search for `{exporting ? 'Exporting…'`). Below the existing BG2 button block (right after `</button>` closing the BG2 button), insert:

```tsx
<BiomePanel
  hasExistingBlocks={count > 0}
  busy={biomeBusy}
  status={biomeStatus}
  onGenerate={handleGenerateBiome}
/>
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp/web
pnpm exec tsc --noEmit
pnpm build
```

Expected: clean. Build registers the page successfully.

- [ ] **Step 4: Manual smoke (optional, requires dev server)**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp/web
pnpm dev
```

Visit `http://localhost:3000/s/<existing-session-id>`, scroll to the right-side panels, find "Generate biome", select Plains, click Generate. Watch the canvas fill block-by-block via realtime sync. If the zone wasn't empty, the confirmation modal should appear first.

- [ ] **Step 5: Commit**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp
git add web/src/app/s/'[id]'/Viewer.tsx
git commit -m "feat(viewer): wire BiomePanel — generates biome, batches Supabase upsert"
```

---

## Phase 7 — MCP mirror

The web lib needs to be mirrored in `mcp/src/biome/` with one difference: the tree loader reads from disk (not fetch). Everything else is identical.

### Task 7.1: Mirror types, rng, noise, poisson, biomes

**Files:**
- Create: `mcp/src/biome/types.ts`
- Create: `mcp/src/biome/rng.ts`
- Create: `mcp/src/biome/noise.ts`
- Create: `mcp/src/biome/poisson.ts`
- Create: `mcp/src/biome/biomes/plains.ts`
- Create: `mcp/src/biome/biomes/forest.ts`
- Create: `mcp/src/biome/biomes/desert.ts`
- Create: `mcp/src/biome/biomes/taiga.ts`
- Create: `mcp/src/biome/biomes/mesa.ts`
- Create: `mcp/src/biome/biomes/index.ts`

- [ ] **Step 1: Copy the files via shell**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp
cp web/src/lib/biome/types.ts    mcp/src/biome/types.ts
cp web/src/lib/biome/rng.ts      mcp/src/biome/rng.ts
cp web/src/lib/biome/noise.ts    mcp/src/biome/noise.ts
cp web/src/lib/biome/poisson.ts  mcp/src/biome/poisson.ts
cp web/src/lib/biome/biomes/plains.ts  mcp/src/biome/biomes/plains.ts
cp web/src/lib/biome/biomes/forest.ts  mcp/src/biome/biomes/forest.ts
cp web/src/lib/biome/biomes/desert.ts  mcp/src/biome/biomes/desert.ts
cp web/src/lib/biome/biomes/taiga.ts   mcp/src/biome/biomes/taiga.ts
cp web/src/lib/biome/biomes/mesa.ts    mcp/src/biome/biomes/mesa.ts
cp web/src/lib/biome/biomes/index.ts   mcp/src/biome/biomes/index.ts
```

- [ ] **Step 2: Build mcp to verify**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp/mcp
pnpm build
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp
git add mcp/src/biome/types.ts mcp/src/biome/rng.ts mcp/src/biome/noise.ts mcp/src/biome/poisson.ts mcp/src/biome/biomes
git commit -m "feat(mcp): mirror biome types, rng, noise, poisson, configs"
```

---

### Task 7.2: Node-side tree loader

**Files:**
- Create: `mcp/src/biome/trees.ts`

The Node-side loader reads JSON from disk. Templates are bundled in `mcp/templates/trees/`. The path resolution mirrors how the existing `mcp/src/index.ts` resolves the manifest path.

- [ ] **Step 1: Write the loader**

```ts
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
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp/mcp
pnpm build
```

- [ ] **Step 3: Commit**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp
git add mcp/src/biome/trees.ts
git commit -m "feat(mcp): tree template loader (filesystem)"
```

---

### Task 7.3: MCP pipeline + public API

**Files:**
- Create: `mcp/src/biome/pipeline.ts`
- Create: `mcp/src/biome/index.ts`

The MCP pipeline is identical to the web pipeline EXCEPT:
- It imports `loadTreeTemplate` from `./trees.js` (the synchronous Node loader)
- The `featurePass` and `runPipeline` functions become synchronous (no `await`).

- [ ] **Step 1: Write `mcp/src/biome/pipeline.ts`**

```ts
// mcp/src/biome/pipeline.ts
import type { BiomeConfig, GenerateOptions, Placement, Region } from './types.js';
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
  const { fill, subsurface, subsurfaceDepth, deep } = cfg.blocks;
  for (let x = region.x1; x <= region.x2; x++) {
    for (let z = region.z1; z <= region.z2; z++) {
      const surfaceY = heightmap.get(`${x},${z}`)!;
      for (let y = region.y1; y < surfaceY; y++) {
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

function featurePass(
  cfg: BiomeConfig, cells: Map<Cell, string>, heightmap: Map<string, number>, region: Region, rng: Rng,
): void {
  const w = region.x2 - region.x1 + 1;
  const d = region.z2 - region.z1 + 1;
  const seaLevel = cfg.seaLevel;

  for (const f of cfg.features) {
    if (f.kind === 'tree') {
      const tpl = loadTreeTemplate(f.template);
      const points = poissonDisk2D(w, d, f.minDistance, rng);
      for (const p of points) {
        if (!rng.bool(f.probability)) continue;
        const x = region.x1 + Math.floor(p.x);
        const z = region.z1 + Math.floor(p.z);
        const surfaceY = heightmap.get(`${x},${z}`);
        if (surfaceY === undefined) continue;
        if (seaLevel !== null && surfaceY < seaLevel) continue;
        if (surfaceY + tpl.height > region.y2) continue;
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
      for (let x = region.x1; x <= region.x2; x++) {
        for (let z = region.z1; z <= region.z2; z++) {
          if (!rng.bool(f.density)) continue;
          const surfaceY = heightmap.get(`${x},${z}`)!;
          if (seaLevel !== null && surfaceY < seaLevel) continue;
          const aboveY = surfaceY + 1;
          if (aboveY > region.y2) continue;
          if (cells.has(cellKey(x, aboveY, z))) continue;
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

  const cells = new Map<Cell, string>();
  const heightmap = heightmapPass(cfg, noise, region);
  terrainFillPass(cfg, cells, heightmap, region);
  surfacePass(cfg, cells, heightmap, region);
  waterPass(cfg, cells, heightmap, region);
  featurePass(cfg, cells, heightmap, region, rng);

  const out: Placement[] = [];
  for (const [k, block] of cells) {
    const [x, y, z] = k.split(',').map(Number) as [number, number, number];
    out.push({ x, y, z, block });
  }
  return out;
}
```

- [ ] **Step 2: Write `mcp/src/biome/index.ts`**

```ts
// mcp/src/biome/index.ts
import type { GenerateOptions, Placement } from './types.js';
import { runPipeline } from './pipeline.js';
import { BIOMES } from './biomes/index.js';

export type { BiomeName, GenerateOptions, Placement, Region } from './types.js';

export function generateBiome(opts: GenerateOptions): Placement[] {
  const cfg = BIOMES[opts.biome];
  if (!cfg) throw new Error(`Unknown biome "${opts.biome}"`);
  return runPipeline(cfg, opts);
}
```

- [ ] **Step 3: Build mcp**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp/mcp
pnpm build
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp
git add mcp/src/biome/pipeline.ts mcp/src/biome/index.ts
git commit -m "feat(mcp): biome pipeline + public generateBiome API"
```

---

### Task 7.4: Register `generate_biome` MCP tool

**Files:**
- Modify: `mcp/src/index.ts`

- [ ] **Step 1: Add the import**

Open `mcp/src/index.ts`. Find the line `import { buildBg2Template } from './bg2template.js';` and add immediately below:

```ts
import { generateBiome, type BiomeName } from './biome/index.js';
```

- [ ] **Step 2: Register the tool**

Find the existing `server.registerTool('export_bg2_template', ...)` block and add this NEW registration immediately after its closing `);`:

```ts
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
      session_id: z.string().length(6).optional(),
    },
  },
  async ({ biome, seed, force, region, session_id }) => {
    try {
      const id = resolveSession(session_id);
      const session = await store.getSession(id);
      const existing = await store.getAll(id);
      if (existing.length > 0 && !force) {
        return error(
          `Zone has ${existing.length} existing blocks. Pass force: true to overwrite.`,
        );
      }
      const placements = generateBiome({
        biome: biome as BiomeName,
        size: { x: session.size_x, y: session.size_y, z: session.size_z },
        seed,
        region,
      });
      const written = await store.setBlocks(
        id,
        placements.map((p) => ({ x: p.x, y: p.y, z: p.z, block: p.block })),
      );
      return text(
        `Generated biome ${biome} (seed ${seed ?? '<random>'}). ` +
          `Wrote ${written.written} blocks.`,
      );
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  },
);
```

- [ ] **Step 3: Build mcp**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp/mcp
pnpm build
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp
git add mcp/src/index.ts
git commit -m "feat(mcp): register generate_biome tool"
```

---

## Phase 8 — Final smoke + ship

### Task 8.1: Manual smoke + push

- [ ] **Step 1: Restart dev server fresh**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp/web
pnpm dev
```

- [ ] **Step 2: Smoke each biome in the viewer**

Visit `http://localhost:3000`, create a fresh 64×64×64 session, then for each biome (Plains, Forest, Desert, Taiga, Mesa):

1. Open the session viewer.
2. In the Generate biome panel, pick the biome and click Generate.
3. (If zone non-empty) confirm the modal.
4. Watch the canvas fill via realtime sync. Inspect:
   - **Plains**: gentle hills, grass, occasional oak tree, scattered flowers.
   - **Forest**: hillier, dense oaks + birches, ferns, grasses.
   - **Desert**: low dunes of sand on sandstone, occasional cactus + dead bush, no water.
   - **Taiga**: rolling hills, dense spruces, lots of ferns, gravel beaches near water.
   - **Mesa**: tall steep peaks, red sand surface, horizontal terracotta layers visible in cliff faces, no water, no trees.
5. Click "Download .litematic" and load in-game (Litematica mod) to confirm exports load and look right.

- [ ] **Step 3: Smoke determinism**

Generate Plains with seed 42 twice (in two fresh sessions). Block count and positions should be identical. (Block count is shown in the top-left panel.)

- [ ] **Step 4: Smoke "force" guard via MCP**

If you have an MCP client connected (Claude Desktop / Claude Code), ask Claude to `generate_biome` on a session that already has blocks WITHOUT `force: true`. The tool should return an error message explicitly mentioning the existing block count. Then ask with `force: true` — it should succeed.

- [ ] **Step 5: Final gates**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp/web
pnpm exec tsc --noEmit
pnpm lint
pnpm build
cd /Users/maxim/Documents/my-monkey/mcmcp/mcp
pnpm build
```

Expected: typecheck clean, build clean. Lint may show 5 pre-existing errors in `server.js` / `MaterialsPanel.tsx` (unrelated to this branch).

- [ ] **Step 6: Push the branch**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp
git push -u origin feat/biome-generator
```

- [ ] **Step 7: Open PR (optional, user-driven)**

If the user asks for a PR:

```bash
gh pr create --title "feat: biome generator (5 biomes, MCP tool + viewer panel)" --body "$(cat <<'EOF'
## Summary
- Adds a procedural Minecraft biome terrain generator covering 5 biomes: plains, forest, desert, taiga, mesa.
- Pure-TS pipeline (heightmap → terrain → surface → water → features) with simplex noise, Poisson-distributed trees, and biome-specific clusters/layers.
- MCP tool `generate_biome` and a viewer panel both call into the shared library.

Spec: `docs/superpowers/specs/2026-05-07-biome-generator-design.md`
Plan: `docs/superpowers/plans/2026-05-07-biome-generator.md`

## Test plan
- [ ] Each of the 5 biomes generates a recognizable result in the viewer
- [ ] Same seed + biome + size → identical output
- [ ] `force: true` is required to overwrite (MCP) / confirmation modal shown (viewer)
- [ ] `.litematic` exports load correctly into Litematica in-game
- [ ] `pnpm build` clean for both web and mcp
EOF
)"
```

---

## Self-review notes

- **Spec coverage:** All 5 biomes present (Phases 4 & 7.1). All 5 pipeline passes implemented (Phase 3 / Task 7.3). Tree templates ship as JSON for the 3 species the MVP needs (Phase 2). Both trigger surfaces wired (Phase 6 viewer + Phase 7.4 MCP). The `force` gate and confirmation modal both implemented (Phase 6.1 + 7.4). Determinism by seeded RNG (Task 1.2) + noise seeded from RNG (Task 1.3). Performance acceptable per spec (batched 1000-row upserts in viewer; MCP single batched call via `store.setBlocks`).

- **Spec deviation:** Spec called for runtime NBT loading via prismarine-nbt; plan ships hand-authored JSON instead. Same in-memory `TreeTemplate` shape, simpler runtime, no asset-redistribution question. The spec acknowledges this fallback as acceptable. If the user wants real NBT-derived trees later, only `loadTreeTemplate` and the bundled JSON files need to change — the rest is decoupled.

- **Placeholder scan:** No "TBD"/"TODO"/"similar to Task N" placeholders. Each task contains complete code blocks.

- **Type consistency:** `BiomeConfig` / `Placement` / `TreeTemplate` defined in Task 1.1 are the same names used in pipeline (Task 3.1 / 7.3), tree loader (Task 2.2 / 7.2), biome configs (Tasks 4.x / 7.1), and public API (Task 5.1 / 7.3). `generateBiome` signature is `(opts: GenerateOptions) → Placement[]` everywhere (`Promise<Placement[]>` in web because of fetch, sync in mcp because of fs).
