// web/src/lib/biome/biomes/index.ts
import type { BiomeConfig, BiomeName } from '../types';
import { PlainsConfig } from './plains';
import { ForestConfig } from './forest';
import { DesertConfig } from './desert';
import { TaigaConfig } from './taiga';
import { MesaConfig } from './mesa';

export const BIOMES: Record<BiomeName, BiomeConfig> = {
  plains: PlainsConfig,
  forest: ForestConfig,
  desert: DesertConfig,
  taiga: TaigaConfig,
  mesa: MesaConfig,
};
