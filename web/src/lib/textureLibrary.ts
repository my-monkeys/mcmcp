import * as THREE from 'three';
import { entryToFaces, faceTinted, tintColorFor, type Manifest, type ManifestEntry } from './textures';

function normalizeBlockType(raw: string): string {
  return raw.replace(/^minecraft:/, '').split('[')[0]!.trim();
}

// Renames between MC versions — incoming legacy ids resolve to their modern
// counterpart so old sessions keep rendering.
const BLOCK_ID_ALIASES: Record<string, string> = {
  grass: 'short_grass',           // renamed in 1.20
  chest: 'oak_planks',            // entity-rendered; closest cube
  trapped_chest: 'oak_planks',
  ender_chest: 'obsidian',
  spawner: 'iron_bars',
  conduit: 'prismarine',
  decorated_pot: 'terracotta',
};

// Entity-rendered families (beds, banners, shulker_boxes…) have no block model.
// Map them to the matching colored wool/concrete so they render as a cube of
// the right color rather than a hash-colored placeholder.
const ID_PATTERN_ALIASES: ReadonlyArray<readonly [RegExp, string]> = [
  [/^(.+)_bed$/, '_wool'],
  [/^(.+)_banner$/, '_wool'],
  [/^(.+)_wall_banner$/, '_wool'],
  [/^(.+)_shulker_box$/, '_concrete'],
] as const;

function resolveBlockId(id: string): string {
  const direct = BLOCK_ID_ALIASES[id];
  if (direct) return direct;
  for (const [re, suffix] of ID_PATTERN_ALIASES) {
    const m = re.exec(id);
    if (m) return `${m[1]}${suffix}`;
  }
  return id;
}

/** Deterministic hue from a string so every unknown block gets a distinct, stable color. */
function hashColor(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  // HSL → RGB (standard formula): S=0.6, L=0.55 — vivid enough to see, dark enough to read labels on.
  const S = 0.6;
  const L = 0.55;
  const a = S * Math.min(L, 1 - L);
  function f(n: number): number {
    const k = (n + hue / 30) % 12;
    return L - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  }
  const r = Math.round(f(0) * 255);
  const g = Math.round(f(8) * 255);
  const blue = Math.round(f(4) * 255);
  return (r << 16) | (g << 8) | blue;
}

const GRASS_TINT = 0x7cbd6b;

/**
 * Load the per-version manifest, fetch every referenced texture once, then
 * build Material[6] arrays per block id on demand.
 *
 * Materials are cached by `textureName:tintHex` so that two different blocks
 * referencing the same tinted texture share the same Material instance.
 */
export class TextureLibrary {
  private manifest: Manifest | null = null;
  private textures = new Map<string, THREE.Texture>();
  /** Names of textures whose source PNG has any alpha < 1 — these need alphaTest to avoid black fragments. */
  private alphaTextures = new Set<string>();
  private materialByKey = new Map<string, THREE.Material>();
  private materialsByBlock = new Map<string, THREE.Material[]>();
  private fallbackByBlock = new Map<string, THREE.Material>();

  constructor(private readonly version: string = '1.21') {}

  get availableBlocks(): string[] {
    return this.manifest ? Object.keys(this.manifest.blocks).sort() : [];
  }

  textureUrl(name: string): string {
    return `/textures/${this.version}/block/${name}.png`;
  }

  async preload(): Promise<void> {
    const manifestUrl = `/textures/${this.version}/manifest.json`;
    const res = await fetch(manifestUrl);
    if (!res.ok) throw new Error(`Failed to load manifest at ${manifestUrl}: HTTP ${res.status}`);
    this.manifest = (await res.json()) as Manifest;

    const referenced = new Set<string>();
    for (const entry of Object.values(this.manifest.blocks)) {
      for (const face of entryToFaces(entry)) referenced.add(face);
    }
    referenced.add('grass_block_side_overlay'); // for the grass-style composite

    const loader = new THREE.TextureLoader();
    await Promise.all(
      Array.from(referenced).map(async (name) => {
        try {
          const tex = await loader.loadAsync(this.textureUrl(name));
          this.configurePixelTexture(tex);
          if (hasTransparency(tex.image as HTMLImageElement | undefined)) {
            this.alphaTextures.add(name);
          }
          this.textures.set(name, tex);
        } catch {
          // Missing texture — keep the library running, fallback materials will fill in.
        }
      })
    );

    // Pre-bake the grass_block side composite (gray base + tinted overlay).
    const baseImg = this.textures.get('grass_block_side')?.image as HTMLImageElement | undefined;
    const overlayImg = this.textures.get('grass_block_side_overlay')?.image as HTMLImageElement | undefined;
    if (baseImg && overlayImg) {
      const composite = compositeOverlay(baseImg, overlayImg, GRASS_TINT);
      this.configurePixelTexture(composite);
      this.textures.get('grass_block_side')?.dispose();
      this.textures.set('grass_block_side', composite);
    }
  }

  getMaterials(rawBlockType: string): THREE.Material[] {
    const id = normalizeBlockType(rawBlockType);
    const cached = this.materialsByBlock.get(id);
    if (cached) return cached;

    const entry = this.manifest?.blocks[resolveBlockId(id)];
    if (!entry) {
      const fb = this.getFallback(id);
      const mats: THREE.Material[] = [fb, fb, fb, fb, fb, fb];
      this.materialsByBlock.set(id, mats);
      return mats;
    }

    const faces = entryToFaces(entry);
    const tint = tintColorFor(id);
    const mats = faces.map((textureName, faceIdx) => {
      // grass_block side already has the tint baked into the composite; don't double-tint.
      const isCompositedSide = id === 'grass_block' && textureName === 'grass_block_side';
      const useTint = !isCompositedSide && faceTinted(entry, faceIdx) ? tint : 0xffffff;
      return this.materialFor(textureName, useTint);
    });
    this.materialsByBlock.set(id, mats);
    return mats;
  }

  private materialFor(textureName: string, tintHex: number): THREE.Material {
    const key = `${textureName}:${tintHex.toString(16)}`;
    const cached = this.materialByKey.get(key);
    if (cached) return cached;

    const tex = this.textures.get(textureName);
    if (!tex) {
      const m = new THREE.MeshLambertMaterial({ color: 0xff00ff });
      this.materialByKey.set(key, m);
      return m;
    }
    // Auto-detected at load time — covers flowers, doors, iron bars, glass
    // panes, ladders, etc. without enumerating texture names.
    const hasAlpha = this.alphaTextures.has(textureName);
    const isWater = textureName === 'water_still' || textureName === 'water_flow';
    const m = new THREE.MeshLambertMaterial({
      map: tex,
      color: tintHex,
      transparent: hasAlpha || isWater,
      alphaTest: hasAlpha && !isWater ? 0.5 : 0,
      opacity: isWater ? 0.6 : 1,
      depthWrite: !isWater,
      // Cutout textures (cross blocks especially: two crossed planes) need both
      // sides visible. Closed cube cutouts don't change visually but it costs
      // nothing extra since the back face is always behind a front face.
      side: hasAlpha && !isWater ? THREE.DoubleSide : THREE.FrontSide,
    });
    this.materialByKey.set(key, m);
    return m;
  }

  private configurePixelTexture(tex: THREE.Texture): void {
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = false;
    const img = tex.image as { width?: number; height?: number } | undefined;
    if (img && typeof img.width === 'number' && typeof img.height === 'number' && img.height > img.width) {
      const frames = img.height / img.width;
      tex.repeat.y = 1 / frames;
      tex.offset.y = 1 - 1 / frames;
    }
    tex.needsUpdate = true;
  }

  private getFallback(type: string): THREE.Material {
    const cached = this.fallbackByBlock.get(type);
    if (cached) return cached;
    const m = new THREE.MeshLambertMaterial({ color: hashColor(type) });
    this.fallbackByBlock.set(type, m);
    return m;
  }

  dispose(): void {
    for (const tex of this.textures.values()) tex.dispose();
    for (const m of this.materialByKey.values()) m.dispose();
    for (const m of this.fallbackByBlock.values()) m.dispose();
    this.textures.clear();
    this.materialByKey.clear();
    this.materialsByBlock.clear();
    this.fallbackByBlock.clear();
  }

  /** Used by the block palette UI to find the icon texture for a block id. */
  iconTextureFor(blockId: string): string | null {
    const entry = this.manifest?.blocks[resolveBlockId(blockId)];
    if (!entry) return null;
    const faces = entryToFaces(entry);
    return faces[2]!; // top face — most recognizable for a block icon
  }

  /** Returns true if the block id is a column type (logs, basalt, etc.) that respects the axis property. */
  isColumn(blockId: string): boolean {
    const entry = this.manifest?.blocks[resolveBlockId(blockId)];
    return entry?.type === 'column';
  }

  getEntry(blockId: string): ManifestEntry | null {
    return this.manifest?.blocks[resolveBlockId(blockId)] ?? null;
  }
}

/**
 * True if any pixel of the image has alpha < 250. Used at load time to flag
 * cutout textures (flowers, doors, iron bars, panes…) so their materials get
 * `transparent: true` + `alphaTest: 0.5` instead of rendering black where the
 * source PNG is transparent.
 */
function hasTransparency(img: HTMLImageElement | undefined): boolean {
  if (!img || !img.width || !img.height) return false;
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return false;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, img.width, img.height).data;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i]! < 250) return true;
  }
  return false;
}

/** Multiply an alpha overlay by a tint color, then draw it on top of a base image. */
function compositeOverlay(
  baseImg: HTMLImageElement,
  overlayImg: HTMLImageElement,
  tintHex: number
): THREE.CanvasTexture {
  const w = baseImg.width;
  const h = baseImg.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(baseImg, 0, 0, w, h);

  const tmp = document.createElement('canvas');
  tmp.width = w;
  tmp.height = h;
  const tctx = tmp.getContext('2d')!;
  tctx.imageSmoothingEnabled = false;
  tctx.drawImage(overlayImg, 0, 0, w, h);
  const data = tctx.getImageData(0, 0, w, h);
  const r = (tintHex >> 16) & 0xff;
  const g = (tintHex >> 8) & 0xff;
  const b = tintHex & 0xff;
  for (let i = 0; i < data.data.length; i += 4) {
    data.data[i] = (data.data[i]! * r) >> 8;
    data.data[i + 1] = (data.data[i + 1]! * g) >> 8;
    data.data[i + 2] = (data.data[i + 2]! * b) >> 8;
  }
  tctx.putImageData(data, 0, 0);
  ctx.drawImage(tmp, 0, 0);
  return new THREE.CanvasTexture(canvas);
}
