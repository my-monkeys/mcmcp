# Biome Generator — Design Spec

**Date:** 2026-05-07
**Scope:** `web/src/lib/biome/`, `mcp/src/biome/`, viewer panel, MCP tool
**Status:** Approved by user, ready for implementation plan

## Goal

Add a procedural biome terrain generator to mcmcp. Given a session zone and a biome name, the generator fills the zone with terrain, surface blocks, water, and biome-appropriate features (trees, flowers, grass, cactus, etc.) — producing a recognizable Minecraft biome the user can immediately see in the live viewer and export as `.litematic` or BG2 template.

The generator is invoked from two entry points: a new MCP tool `generate_biome` (Claude can call it) and a new "Generate biome" panel in the viewer (humans can click it).

## Fidelity target — "Niveau 2"

The user explicitly asked for ~70-80% Minecraft fidelity. This means:
- **Real multi-octave noise** for heightmap (own simplex implementation, MIT-licensed Stefan Gustavson port)
- **Real Minecraft tree structure NBTs** loaded at runtime (oak, birch, spruce, jungle, acacia)
- **Per-biome surface rules** (top / subsurface / fill / beach blocks)
- **Poisson-disk sampling** for natural tree distribution
- **NOT** porting Minecraft's full density-function / surface-rule grammar engine — that would be Niveau 3-4 effort and overkill for 5 biomes.

## MVP biomes

Five vanilla overworld biomes:

| Biome | Distinguishing features |
|---|---|
| `plains` | Flat-ish grass, occasional oaks, dandelions, poppies, short grass |
| `forest` | Hilly grass, dense oak + birch trees, ferns, grass |
| `desert` | Flat-to-dunes red/yellow sand, scattered cactus + dead bush, no water |
| `taiga` | Hilly grass + podzol, dense spruce trees, ferns, snowy tinge optional |
| `mesa` | Steep red sand + terracotta with horizontal banded layers, dead bushes, no trees |

## Out of scope

- **Cave carving** (Worley/Perlin worms). Future work.
- **Ore distribution** under the surface (coal/iron/copper/diamond). Future work.
- **Structures** (villages, dungeons, mansions, igloos). Separate system.
- **Mob spawning data** — runtime concern, not present in `.litematic`.
- **Fog/sky/grass tint colors** — purely cosmetic in MC, no effect on exported schematics.
- **Multi-biome blending** in one zone. One biome per generation.
- **Bedrock floor pattern** — not visible enough to justify the code.
- **Beyond 5 biomes** — pack extension is its own follow-up project.

## Architecture

### File layout

```
web/src/lib/biome/
  index.ts                # public API: generateBiome(opts) → Placement[]
  types.ts                # Placement, BiomeConfig, FeatureConfig, GenerateOptions
  noise.ts                # 2D simplex noise + multi-octave fbm helper
  rng.ts                  # mulberry32-style seedable RNG
  poisson.ts              # 2D Poisson-disk sampling
  pipeline.ts             # the 5 passes
  trees.ts                # NBT template loader + cache
  features/
    trees.ts              # tree feature: Poisson + template placement
    clusters.ts           # cluster features: flowers, grass, cactus, dead_bush
    layers.ts             # mesa-specific banded terracotta layers
  biomes/
    plains.ts             # BiomeConfig per biome
    forest.ts
    desert.ts
    taiga.ts
    mesa.ts
    index.ts              # registry { plains: PlainsConfig, ... }

web/public/templates/trees/
  oak.nbt                 # vanilla MC structure NBTs (extracted from game assets)
  birch.nbt
  spruce.nbt              # only what the 5 MVP biomes need; acacia/jungle added when biomes need them

mcp/src/biome/             # mirror for the Node-side MCP tool
  index.ts                # re-exports
  types.ts                # same shapes
  noise.ts, rng.ts, poisson.ts, pipeline.ts, trees.ts
  features/
  biomes/
```

The duplication between `web/` and `mcp/` follows the existing repo pattern (`litematic.ts`, `bg2template.ts`). Future cleanup could extract `@my-monkey/biome-core` as a shared package — out of scope here.

### Public API

```ts
// web/src/lib/biome/index.ts and mcp/src/biome/index.ts

export type BiomeName = 'plains' | 'forest' | 'desert' | 'taiga' | 'mesa';

export type Region = { x1: number; y1: number; z1: number; x2: number; y2: number; z2: number };

export type GenerateOptions = {
  biome: BiomeName;
  size: { x: number; y: number; z: number };  // session zone size
  seed?: number;                               // default = Date.now()
  region?: Region;                             // sub-region; default = full zone
};

export type Placement = { x: number; y: number; z: number; block: string };

export function generateBiome(opts: GenerateOptions): Placement[];
```

The function is **pure**: same inputs (biome + size + seed + region) always produce the same `Placement[]` at the same indices. No I/O, no globals.

## Pipeline — 5 sequential passes

Each pass mutates a `Map<BlockKey, string>` keyed by `(x,y,z)`. Final pass outputs the `Placement[]`.

### Pass 1 — Heightmap

For each `(x, z)` column inside `region`, compute `surfaceY = base + amplitude * fbm(x, z, octaves, frequency)` where `fbm` is fractal Brownian motion (multi-octave summed simplex noise). `base`, `amplitude`, `octaves`, `frequency` come from `BiomeConfig.heightmap`.

`surfaceY` is clamped to `[0, size.y - 1]`.

### Pass 2 — Terrain fill

For each column, fill `y = 0` up to `y = surfaceY - 1`:
- The top `subsurfaceDepth` blocks (typically 4) are `blocks.subsurface` (dirt / sand / red_sand depending on biome).
- Below that, all the way to `y = 0`, are `blocks.fill` (typically `stone`).

If `blocks.deep` is non-null, `y = 0` becomes `blocks.deep`. We default to `null` (no bedrock) — bedrock is invisible in builds and its random pattern isn't worth the code.

### Pass 3 — Surface

The block at `y = surfaceY` becomes `blocks.surface` (`grass_block` / `sand` / `podzol` / `red_sand`).

Beach exception: if `blocks.beach` is set AND `surfaceY < seaLevel + 2`, the surface becomes `blocks.beach` instead. Used by plains/forest to put sand at lake edges.

### Pass 4 — Water

If `BiomeConfig.seaLevel !== null`, for each `(x, z)` where `surfaceY < seaLevel`, fill `y = surfaceY + 1` up to `y = seaLevel` with `water`.

Desert and mesa have `seaLevel: null` — no water at all. Plains/forest/taiga have a sea level that produces occasional ponds in the dips of the heightmap.

### Pass 5 — Features

Iterate `BiomeConfig.features` in order. Three `kind`s:

- **`tree`** — Poisson-disk sample positions across the surface plane with `minDistance` (per-biome, typically 4-12). For each accepted point, draw `random < probability` to place; if yes, look up the surface Y at that point, load the cached NBT template, randomly rotate 0/90/180/270°, and append the template's placements offset by the tree's base position.
- **`cluster`** — for each surface cell, `random < density` → place `block` one cell above the surface. Used for flowers, short grass, ferns, cactus, dead bush.
- **`layer`** — mesa-specific. For listed `bands: [{ y, block }]`, replace any cell at exactly `y` and currently a `red_sand` / `terracotta` with the banded color. Produces the horizontal stripes characteristic of mesas.

Features run in declared order, so later features overwrite earlier ones at the same cell — but this rarely happens in practice (trees have base on grass; flowers go above grass; trees and flowers don't overlap because Poisson keeps trees apart).

## BiomeConfig schema

```ts
type BiomeConfig = {
  heightmap: {
    base: number;             // baseline surface Y (e.g. 32)
    amplitude: number;        // peak-to-trough variation (e.g. 4 for plains, 24 for mesa)
    octaves: number;          // 3 for smooth, 5 for jagged
    frequency: number;        // noise scale, e.g. 0.05
  };
  blocks: {
    surface: string;          // 'grass_block', 'sand', 'red_sand', ...
    subsurface: string;       // 'dirt', 'sand', 'red_sand', ...
    subsurfaceDepth: number;  // typically 4
    fill: string;             // 'stone', 'terracotta', ...
    deep: string | null;      // bedrock or null
    beach: string | null;     // sand at sea level edges, or null
  };
  seaLevel: number | null;    // null = no water (desert, mesa)
  features: FeatureConfig[];
};

type FeatureConfig =
  | { kind: 'tree';    template: string; minDistance: number; probability: number }
  | { kind: 'cluster'; block: string;    density: number }
  | { kind: 'layer';   bands: { y: number; block: string }[] };
```

### Sample config — `plains.ts`

```ts
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
    { kind: 'tree',    template: 'oak',         minDistance: 12, probability: 0.3 },
    { kind: 'cluster', block: 'short_grass',    density: 0.18 },
    { kind: 'cluster', block: 'dandelion',      density: 0.012 },
    { kind: 'cluster', block: 'poppy',          density: 0.008 },
  ],
};
```

### Sample config — `mesa.ts`

```ts
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
    ]},
    { kind: 'cluster', block: 'dead_bush', density: 0.01 },
  ],
};
```

The other three configs follow the same shape with biome-appropriate tuning.

## Tree templates

`web/public/templates/trees/*.nbt` contain the structure NBTs extracted from vanilla Minecraft assets. Specifically:

- `oak.nbt` — `assets/minecraft/structures/oak/...` (small standard oak) — used by `plains`, `forest`
- `birch.nbt` — birch standard — used by `forest`
- `spruce.nbt` — spruce standard — used by `taiga`

`desert` and `mesa` have no trees in the MVP. Acacia and jungle templates are added later when those biomes ship.

These are version-stable across MC 1.16+ for the small variants we ship.

**Loader** (`trees.ts`):

```ts
async function loadTreeTemplate(name: string, version: string): Promise<TreeTemplate>;
```

The template is parsed once via `prismarine-nbt`, transformed into a `{ blocks: Placement[], width, height, depth }` shape, and cached per (name, version). Subsequent loads return the cached value.

**Trick for performance**: at build time we can pre-parse all bundled NBTs into a JSON sidecar (`oak.json`, `birch.json`, ...) so runtime is a fast `fetch + JSON.parse` instead of NBT-parsing. Decision deferred to implementation.

**Rotation**: when placing a tree, we rotate the placements list by 0/90/180/270° around the trunk's vertical axis. The Y of each placement stays unchanged; (x, z) gets the rotation transform. Rotation 0 = identity.

## Trigger surfaces

### MCP tool — `generate_biome`

Registered alongside the existing tools in `mcp/src/index.ts`:

```ts
server.registerTool('generate_biome', {
  title: 'Generate a Minecraft biome into the session zone',
  description:
    'Procedurally fill the current session with terrain and decorations matching a chosen biome ' +
    '(plains, forest, desert, taiga, mesa). Operates on the full zone (or selection if set). ' +
    'Refuses if the zone already contains blocks unless force=true.',
  inputSchema: {
    biome: z.enum(['plains', 'forest', 'desert', 'taiga', 'mesa']),
    seed: z.number().int().optional(),
    force: z.boolean().default(false),
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
}, async ({ biome, seed, force, region, session_id }) => {
  const id = resolveSession(session_id);
  const session = await store.getSession(id);
  const existing = await store.getAll(id);
  if (existing.length > 0 && !force) {
    return error(`Zone has ${existing.length} blocks. Pass force: true to overwrite.`);
  }
  const placements = generateBiome({
    biome,
    size: { x: session.size_x, y: session.size_y, z: session.size_z },
    seed,
    region,
  });
  await store.setBlocks(id, placements.map(p => ({ x: p.x, y: p.y, z: p.z, block: p.block })));
  return text(`Generated ${placements.length} blocks for biome ${biome} (seed ${seed ?? '<random>'}).`);
});
```

If existing blocks are present and `force` is not set, returns an error explicitly listing the count.

### Viewer panel

A new `BiomePanel.tsx` component renders below the existing export buttons in the top-right area:

```
┌─────────────────────────┐
│ Generate biome          │
│                         │
│ [ Biome: Plains ▾   ]   │
│ [ Seed: 1234567   🎲 ]  │
│                         │
│ [ Generate biome → ]    │
└─────────────────────────┘
```

On click, the panel reads the existing `SelectionPanel` state from `Viewer.tsx`:
- If a selection is active, generation runs on that selection's region.
- Otherwise, generation runs on the full zone.

Then:
1. If `count > 0` for the targeted region, show a confirmation modal: *"This will replace all blocks in the zone (N blocks). Continue?"*
2. On confirmation, show "Generating..." progress, call `generateBiome(opts)` synchronously (it's pure CPU work, runs in a few seconds).
3. Batch the placements into chunks of 1000 and `supabase.from('mcmcp_blocks').upsert(...)` for each. The viewer's existing realtime subscription paints them as they arrive.
4. On success, toast "Generated <biome> (N blocks)".

The component reuses the existing zinc-themed UI styling already present in the viewer.

## Performance & realtime

- `generateBiome` for a 64×128×64 zone produces 100k-300k placements in 2-5s on a modern laptop.
- Supabase batch upsert: 1000 rows per request, ~30ms per batch → ~30s end-to-end for 100k blocks, ~90s for 300k. Acceptable for MVP.
- Realtime sync streams placements into the viewer as batches commit, so visual feedback is continuous.
- For 256×256×256 zones (worst case), generation alone may take 10-20s; total time can hit 5-10 min. We cap user expectations in the panel ("This may take a few minutes for large zones").

## Determinism

Same `(biome, size, seed, region)` always yields the same `Placement[]` at the same indices. Achieved by:
- Single seedable PRNG (`mulberry32`) for all randomness.
- Noise permutations seeded from the same RNG.
- Poisson-disk sampler uses the same RNG.
- Feature loops iterate cells in deterministic order (z outer, y middle, x inner — matches our existing conventions).

## Risks & mitigations

1. **NBT parse latency in browser** — `prismarine-nbt` cold start can be 100-300ms.
   *Mitigation:* pre-parse bundled NBTs to JSON sidecars at build time.
2. **Poisson-disk performance on big zones** — 256×256 surface plane = up to 65k candidate cells.
   *Mitigation:* cap iterations; degrade to grid sampling beyond a threshold (still works, just less natural distribution).
3. **Supabase batch write rate** — too many parallel batches can rate-limit.
   *Mitigation:* sequential batch writes, fixed concurrency=1, batch size 1000.
4. **NBT redistribution legality** — vanilla MC structure NBTs are extracted assets. Distributing them in `public/` could be challenged.
   *Mitigation:* if challenged, fall back to procedural tree generation (parametric trunk + branches) — a few hundred extra lines but no asset distribution. Not blocking for MVP.
5. **Realtime flooding the viewer** — too many concurrent block insertions could lag the renderer.
   *Mitigation:* the viewer's existing batching already handles streamed inserts; if jank appears, throttle batch commits server-side.

## Estimate

~2 weeks of dev:
- Infra (noise, rng, poisson, types, pipeline framework): 2-3 days
- Tree NBT loader + 4-5 templates extracted from the game: 1-2 days
- The 5 BiomeConfig + visual tweaking iteration: 3-4 days
- MCP tool + viewer panel + confirmation modal: 1-2 days
- In-game visual testing via `.litematic` exports: 1-2 days

## Acceptance

- The 5 biomes (`plains`, `forest`, `desert`, `taiga`, `mesa`) are selectable from both MCP tool and viewer panel.
- Each generation produces terrain that is visually recognizable as the chosen biome when loaded in-game (tested via `.litematic` export).
- `force: true` is required to overwrite existing blocks via MCP; the viewer shows a confirmation modal in the same situation.
- Same seed + biome + size always produces identical output (deterministic).
- Performance: under 30s end-to-end for a 64×128×64 zone, under 2 min for 64×256×64.
- `pnpm exec tsc --noEmit` and `pnpm build` are clean for both `web/` and `mcp/`.
- No new heavy dependencies (`prismarine-nbt` and `@supabase/supabase-js` are already present).
