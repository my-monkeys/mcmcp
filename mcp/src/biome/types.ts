// web/src/lib/biome/types.ts

export type BiomeName = 'plains' | 'forest' | 'desert' | 'taiga' | 'mesa';

export type Region = {
  x1: number; y1: number; z1: number;
  x2: number; y2: number; z2: number;
};

export type Placement = {
  x: number;
  y: number;
  z: number;
  block: string;
};

export type GenerateOptions = {
  biome: BiomeName;
  size: { x: number; y: number; z: number };
  seed?: number;
  region?: Region;
};

export type HeightmapConfig = {
  base: number;
  amplitude: number;
  octaves: number;
  frequency: number;
};

export type BlockRules = {
  surface: string;
  subsurface: string;
  subsurfaceDepth: number;
  fill: string;
  deep: string | null;
  beach: string | null;
};

export type TreeFeature = {
  kind: 'tree';
  template: string;
  minDistance: number;
  probability: number;
};

export type ClusterFeature = {
  kind: 'cluster';
  block: string;
  density: number;
};

export type LayerFeature = {
  kind: 'layer';
  bands: { y: number; block: string }[];
};

export type FeatureConfig = TreeFeature | ClusterFeature | LayerFeature;

export type BiomeConfig = {
  heightmap: HeightmapConfig;
  blocks: BlockRules;
  seaLevel: number | null;
  features: FeatureConfig[];
};

export type TreeTemplate = {
  width: number;
  height: number;
  depth: number;
  anchorX: number;
  anchorZ: number;
  blocks: Placement[];
};
