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
  /** Opt-in. When true and the biome has a `rivers` config, the pipeline
   * carves serpentine river channels using a separate noise stream. */
  rivers?: boolean;
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
  /** Total depth of fill below the surface. Limits how deep the stone column
   * goes; cells below `surfaceY - terrainDepth` are left as air. Keeps the
   * generated biome a thin slab on top of empty space rather than a giant
   * stone cube. */
  terrainDepth: number;
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

export type RiversConfig = {
  /** River noise threshold around 0. Lower = thinner channels. ~0.04 is a
   * narrow stream (~1 block); ~0.10 is a meaningful river (~3-5 blocks). */
  threshold: number;
  /** Noise frequency. Lower = larger meanders, wider apart. ~0.02-0.04 looks
   * natural for our zone sizes. */
  frequency: number;
  /** Optional. Width of the bank strip alongside the river (in noise units).
   * Cells where `threshold < |noise| < threshold + bankWidth` get the biome's
   * beach block (sand / gravel) on the surface. */
  bankWidth?: number;
};

export type BiomeConfig = {
  heightmap: HeightmapConfig;
  blocks: BlockRules;
  seaLevel: number | null;
  features: FeatureConfig[];
  /** When set, the pipeline can carve rivers if `opts.rivers` is true. */
  rivers?: RiversConfig;
};

export type TreeTemplate = {
  width: number;
  height: number;
  depth: number;
  anchorX: number;
  anchorZ: number;
  blocks: Placement[];
};
