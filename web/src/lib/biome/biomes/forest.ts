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
    terrainDepth: 6,
  },
  seaLevel: 28,
  rivers: { threshold: 0.14, frequency: 0.015, bankWidth: 0.05 },
  features: [
    { kind: 'tree',    template: 'oak',          minDistance: 4, probability: 0.7, requiresSurface: ['grass_block'] },
    { kind: 'tree',    template: 'birch',        minDistance: 5, probability: 0.4, requiresSurface: ['grass_block'] },
    { kind: 'cluster', block: 'short_grass',     density: 0.22, requiresSurface: ['grass_block'] },
    { kind: 'cluster', block: 'fern',            density: 0.05, requiresSurface: ['grass_block'] },
  ],
};
