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
    terrainDepth: 6,
  },
  seaLevel: null,
  features: [
    { kind: 'cluster', block: 'cactus',     density: 0.005, requiresSurface: ['sand'] },
    { kind: 'cluster', block: 'dead_bush',  density: 0.01,  requiresSurface: ['sand'] },
  ],
};
