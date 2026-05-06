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
