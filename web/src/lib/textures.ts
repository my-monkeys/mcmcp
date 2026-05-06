// Manifest types — the build script (web/scripts/build-texture-pack.mjs)
// emits a JSON file that maps block ids to per-face texture references.

export type ManifestEntry =
  | { type: 'all'; all: string; tint?: TintFace[] }
  | { type: 'column'; top: string; side: string; tint?: TintFace[] }
  | { type: 'bottom_top'; top: string; side: string; bottom: string; tint?: TintFace[] }
  | { type: 'directional'; up: string; down: string; north: string; south: string; east: string; west: string }
  | { type: 'cross'; all: string; tint?: TintFace[] }
  | { type: 'flat'; all: string; tint?: TintFace[] }
  | { type: 'slab' | 'slab_top' | 'stairs'; top: string; side: string; bottom: string }
  | { type: 'fence' | 'wall'; all: string };

export type TintFace = 'all' | 'top' | 'side' | 'bottom';

export type Manifest = {
  version: string;
  generatedAt: string;
  blocks: Record<string, ManifestEntry>;
};

/** Order of face materials in a Three.js BoxGeometry: [+X, -X, +Y (top), -Y (bottom), +Z, -Z]. */
export type FaceOrder = readonly [string, string, string, string, string, string];

/**
 * Resolve a manifest entry into the 6 face textures expected by BoxGeometry.
 * Returns the texture file names (no extension, no folder prefix).
 */
export function entryToFaces(entry: ManifestEntry): FaceOrder {
  switch (entry.type) {
    case 'all':
    case 'cross':
    case 'flat':
    case 'fence':
    case 'wall':
      return [entry.all, entry.all, entry.all, entry.all, entry.all, entry.all] as const;
    case 'column':
      return [entry.side, entry.side, entry.top, entry.top, entry.side, entry.side] as const;
    case 'bottom_top':
    case 'slab':
    case 'slab_top':
    case 'stairs':
      return [entry.side, entry.side, entry.top, entry.bottom, entry.side, entry.side] as const;
    case 'directional':
      return [entry.east, entry.west, entry.up, entry.down, entry.south, entry.north] as const;
  }
}

/** True if a face index (0..5) gets a tint per the entry's `tint` field. */
export function faceTinted(entry: ManifestEntry, faceIndex: number): boolean {
  if (entry.type === 'directional') return false;
  const tint = (entry as { tint?: TintFace[] }).tint;
  if (!tint || tint.length === 0) return false;
  if (tint.includes('all')) return true;
  // Face mapping: 0/1/4/5 = side, 2 = top, 3 = bottom
  if (faceIndex === 2 && tint.includes('top')) return true;
  if (faceIndex === 3 && tint.includes('bottom')) return true;
  if ((faceIndex === 0 || faceIndex === 1 || faceIndex === 4 || faceIndex === 5) && tint.includes('side')) return true;
  return false;
}

/** Tint color for a block id. Foliage default; grass family uses the grass tint. */
export function tintColorFor(blockId: string): number {
  // Plains-biome tints, mirroring the most common look.
  const FOLIAGE = 0x59ae30;
  const GRASS = 0x7cbd6b;
  if (
    blockId === 'grass_block' ||
    blockId === 'grass' ||
    blockId === 'short_grass' ||
    blockId === 'tall_grass' ||
    blockId === 'fern' ||
    blockId === 'large_fern' ||
    blockId === 'sugar_cane' ||
    blockId === 'pink_petals' ||
    blockId.endsWith('_grass')
  ) return GRASS;
  if (blockId === 'lily_pad') return 0x208030;
  return FOLIAGE;
}

