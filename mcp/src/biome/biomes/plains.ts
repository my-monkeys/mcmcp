// web/src/lib/biome/biomes/plains.ts
import type { BiomeConfig } from '../types';

export const PlainsConfig: BiomeConfig = {
  // Very gentle terrain: 2 octaves + small amplitude keeps it flat without
  // the high-freq spikes that 3+ octaves were producing.
  heightmap: { base: 32, amplitude: 2, octaves: 2, frequency: 0.03 },
  blocks: {
    surface: 'grass_block',
    subsurface: 'dirt',
    subsurfaceDepth: 4,
    fill: 'stone',
    deep: null,
    beach: 'sand',
    terrainDepth: 6,
  },
  // sea level well below the heightmap baseline (32) so water only fills
  // the rare deep dips — produces the occasional pond, not blanket flooding.
  seaLevel: 26,
  rivers: { threshold: 0.14, frequency: 0.015, bankWidth: 0.06 },
  features: [
    { kind: 'tree',    template: 'oak',          minDistance: 12, probability: 0.3, requiresSurface: ['grass_block'] },
    { kind: 'cluster', block: 'short_grass',     density: 0.18,  requiresSurface: ['grass_block'] },
    { kind: 'cluster', block: 'dandelion',       density: 0.012, requiresSurface: ['grass_block'] },
    { kind: 'cluster', block: 'poppy',           density: 0.008, requiresSurface: ['grass_block'] },
  ],
};
