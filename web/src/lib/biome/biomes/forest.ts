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
