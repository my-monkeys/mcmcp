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
