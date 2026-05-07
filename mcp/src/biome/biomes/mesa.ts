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
    terrainDepth: 24,
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
