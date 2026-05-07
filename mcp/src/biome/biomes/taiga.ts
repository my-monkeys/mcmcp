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
    terrainDepth: 6,
  },
  seaLevel: 28,
  rivers: { threshold: 0.10, frequency: 0.018, bankWidth: 0.06 },
  features: [
    { kind: 'tree',    template: 'spruce',       minDistance: 5, probability: 0.7 },
    { kind: 'cluster', block: 'fern',            density: 0.12 },
    { kind: 'cluster', block: 'large_fern',      density: 0.04 },
  ],
};
