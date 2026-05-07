// web/src/lib/biome/index.ts
import type { BiomeName, GenerateOptions, Placement, RiversConfig } from './types';
import { runPipeline } from './pipeline';
import { BIOMES } from './biomes';

export type { BiomeName, GenerateOptions, Placement, Region, RiversConfig } from './types';

export async function generateBiome(opts: GenerateOptions): Promise<Placement[]> {
  const cfg = BIOMES[opts.biome];
  if (!cfg) throw new Error(`Unknown biome "${opts.biome}"`);
  return runPipeline(cfg, opts);
}

/** Returns the default river config for a biome, or null if it has none. */
export function getBiomeRivers(biome: BiomeName): RiversConfig | null {
  return BIOMES[biome]?.rivers ?? null;
}
