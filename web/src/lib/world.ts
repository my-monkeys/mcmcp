import * as THREE from 'three';
import { blockKey, type BlockKey } from './types';
import type { TextureLibrary } from './textureLibrary';
import type { ManifestEntry } from './textures';
import { crossGeometry, cubeGeometry, flatGeometry, slabGeometry, stairsGeometry, type StairFacing } from './geometries';

function normalizeBlockType(raw: string): string {
  return raw.replace(/^minecraft:/, '').split('[')[0]!.trim();
}

type ColumnAxis = 'x' | 'y' | 'z';

/** Parse the axis state property from a raw block string like "oak_log[axis=x]". */
function parseAxis(raw: string): ColumnAxis {
  const match = /\[.*?\baxis=([xyz])\b/.exec(raw);
  if (!match) return 'y';
  const v = match[1];
  if (v === 'x' || v === 'y' || v === 'z') return v;
  return 'y';
}

function parseStateProps(raw: string): Record<string, string> {
  const m = /\[([^\]]+)\]/.exec(raw);
  if (!m) return {};
  const out: Record<string, string> = {};
  for (const pair of m[1]!.split(',')) {
    const eq = pair.indexOf('=');
    if (eq <= 0) continue;
    out[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
  }
  return out;
}

const STAIR_FACINGS: ReadonlyArray<StairFacing> = ['north', 'south', 'east', 'west'];

function isStairFacing(v: string): v is StairFacing {
  return (STAIR_FACINGS as readonly string[]).includes(v);
}

function geometryFor(entry: ManifestEntry | null, stateKey: string): THREE.BufferGeometry {
  if (!entry) return cubeGeometry();
  if (entry.type === 'cross') return crossGeometry();
  if (entry.type === 'flat') return flatGeometry();
  if (!stateKey) return cubeGeometry();
  if (entry.type === 'slab' || entry.type === 'slab_top') {
    if (stateKey === 't=double') return cubeGeometry();
    return slabGeometry(stateKey === 't=top' ? 'top' : 'bottom');
  }
  if (entry.type === 'stairs') {
    const facing = stateKey.includes('f=s') ? 'south'
      : stateKey.includes('f=e') ? 'east'
      : stateKey.includes('f=w') ? 'west'
      : 'north';
    const half = stateKey.includes('h=t') ? 'top' : 'bottom';
    return stairsGeometry(facing, half);
  }
  return cubeGeometry();
}

/**
 * Canonical state key per shape type. Empty string for cube-like blocks
 * (one bucket per block id). Non-empty for slab / stairs (one bucket per
 * geometric variant — the geometry differs, the materials don't).
 */
function shapeStateKey(entry: ManifestEntry | null, props: Record<string, string>): string {
  if (!entry) return '';
  if (entry.type === 'slab' || entry.type === 'slab_top') {
    const t = props.type === 'top' || entry.type === 'slab_top' ? 'top'
      : props.type === 'double' ? 'double'
      : 'bottom';
    return `t=${t}`;
  }
  if (entry.type === 'stairs') {
    const facing = props.facing && isStairFacing(props.facing) ? props.facing : 'north';
    const half = props.half === 'top' ? 'top' : 'bottom';
    return `f=${facing[0]},h=${half[0]}`;
  }
  return '';
}

type InstanceLocation = {
  type: string;
  bucketKey: string;
  index: number;
  /** Column axis rotation. Always 'y' for non-column blocks. */
  rotation: ColumnAxis;
};

type TypeBucket = {
  /** Base block id (without state). Used to aggregate inventory counts. */
  type: string;
  /** Compound key into the buckets map (`type` for cubes, `type#state` for shapes). */
  bucketKey: string;
  mesh: THREE.InstancedMesh;
  capacity: number;
  count: number;
  /** instance index -> "x,y,z" so we can swap-and-pop */
  keyByIndex: BlockKey[];
  /** Material[] used by the InstancedMesh (kept for grow). */
  materials: THREE.Material | THREE.Material[];
  /** Geometry used by the InstancedMesh (kept for grow). Cube for cube blocks, custom for slab/stairs. */
  geometry: THREE.BufferGeometry;
};

type SpawnAnimState = {
  /** Performance.now() at spawn. */
  startedAt: number;
};

type RemoveAnimState = {
  startedAt: number;
};

const INITIAL_CAPACITY = 256;
const SPAWN_DURATION_MS = 220;
const REMOVE_DURATION_MS = 180;

const TMP_MATRIX = new THREE.Matrix4();
const TMP_POS = new THREE.Vector3();
const TMP_QUAT = new THREE.Quaternion();
const TMP_SCALE = new THREE.Vector3();
const AXIS_X = new THREE.Vector3(0, 0, 1); // 90° around Z so the column's top face points to +X
const AXIS_Z = new THREE.Vector3(1, 0, 0); // 90° around X so the column's top face points to +Z

/** Slight overshoot ease for a satisfying pop-in. t in [0..1] → scale in [0..1]. */
function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const x = t - 1;
  return 1 + c3 * x * x * x + c1 * x * x;
}

/** Mirror of easeOutBack: block "winds up" then shrinks. t in [0..1] → scale in [1..0]. Values briefly exceed 1 near t=0 — intentional wind-up, mirroring easeOutBack's overshoot near t=1. */
function easeInBack(t: number): number {
  const s = 1.70158;
  return 1 - (t * t * (s + 1) - t * s);
}

function spawnAnimScale(anim: SpawnAnimState, now: number): number {
  const t = (now - anim.startedAt) / SPAWN_DURATION_MS;
  return t >= 1 ? 1 : easeOutBack(Math.max(0, t));
}

function removeAnimScale(startedAt: number, now: number): number {
  const t = (now - startedAt) / REMOVE_DURATION_MS;
  return t >= 1 ? 0 : easeInBack(Math.max(0, t));
}

export class World {
  readonly group: THREE.Group;
  private buckets = new Map<string, TypeBucket>();
  private locations = new Map<BlockKey, InstanceLocation>();
  private spawnAnimations = new Map<BlockKey, SpawnAnimState>();
  private removeAnimations = new Map<BlockKey, RemoveAnimState>();
  /** Visible Y range, inclusive. Out-of-range instances are rendered at scale 0. */
  private minY = -Infinity;
  private maxY = Infinity;

  constructor(private readonly textures: TextureLibrary) {
    this.group = new THREE.Group();
    this.group.name = 'world';
  }

  /** Hide every block whose y is outside [min, max]. Cheap re-pass over instances. */
  setYRange(min: number, max: number): void {
    this.minY = min;
    this.maxY = max;
    const now = performance.now();
    for (const bucket of this.buckets.values()) {
      for (let i = 0; i < bucket.count; i++) {
        const key = bucket.keyByIndex[i]!;
        const [xs, ys, zs] = key.split(',');
        const x = Number(xs), y = Number(ys), z = Number(zs);
        const rotation = this.locations.get(key)?.rotation ?? 'y';
        const visible = y >= min && y <= max;
        if (!visible) {
          this.writeMatrix(bucket, i, x, y, z, 0, rotation);
        } else {
          const removeAnim = this.removeAnimations.get(key);
          if (removeAnim) {
            const scale = Math.max(0.001, removeAnimScale(removeAnim.startedAt, now));
            this.writeMatrix(bucket, i, x, y, z, scale, rotation);
          } else {
            const anim = this.spawnAnimations.get(key);
            const scale = anim ? Math.max(0.001, spawnAnimScale(anim, now)) : 1;
            this.writeMatrix(bucket, i, x, y, z, scale, rotation);
          }
        }
      }
      bucket.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  private isVisibleY(y: number): boolean {
    return y >= this.minY && y <= this.maxY;
  }

  get blockCount(): number {
    let n = 0;
    for (const b of this.buckets.values()) n += b.count;
    return n;
  }

  /** Per-type instance counts. Multiple shape buckets of the same block id are summed. */
  getMaterials(): Array<{ id: string; count: number }> {
    const totals = new Map<string, number>();
    for (const bucket of this.buckets.values()) {
      if (bucket.count === 0) continue;
      totals.set(bucket.type, (totals.get(bucket.type) ?? 0) + bucket.count);
    }
    const out = Array.from(totals, ([id, count]) => ({ id, count }));
    out.sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
    return out;
  }

  get hasPendingAnimations(): boolean {
    return this.spawnAnimations.size > 0 || this.removeAnimations.size > 0;
  }

  /**
   * Place a block. If `animate` is true (the default for live realtime
   * inserts), it pops in over ~220ms. Initial bulk loads should pass false.
   */
  setBlock(x: number, y: number, z: number, rawType: string, animate = false): void {
    const type = normalizeBlockType(rawType);
    const key = blockKey(x, y, z);
    const existing = this.locations.get(key);

    if (type === 'air') {
      if (existing) this.startRemoveAnimation(key);
      return;
    }

    // Determine axis rotation — only meaningful for column-type blocks.
    const entry = this.textures.getEntry(type);
    const parsedAxis = parseAxis(rawType);
    const rotation: ColumnAxis = entry?.type === 'column' ? parsedAxis : 'y';

    // Shape state (slab type=top, stairs facing/half) routes the block to a
    // separate bucket whose InstancedMesh uses a different geometry.
    const stateKey = shapeStateKey(entry, parseStateProps(rawType));
    const bucketKey = stateKey ? `${type}#${stateKey}` : type;

    // If currently fading out, cancel the fade-out and perform a synchronous remove
    // before inserting the new block so we don't leave a stale instance behind.
    const wasRemoving = this.removeAnimations.delete(key);
    if (existing) {
      if (
        !wasRemoving &&
        existing.bucketKey === bucketKey &&
        existing.rotation === rotation &&
        !animate
      ) return;
      this.removeAt(key, existing);
    }

    const bucket = this.getOrCreateBucket(type, bucketKey, entry, stateKey);
    if (bucket.count >= bucket.capacity) this.growBucket(bucket);

    const idx = bucket.count;
    const visible = this.isVisibleY(y);
    const initialScale = !visible ? 0 : animate ? 0.001 : 1;
    this.writeMatrix(bucket, idx, x, y, z, initialScale, rotation);
    bucket.mesh.count = idx + 1;
    bucket.keyByIndex[idx] = key;
    bucket.count = idx + 1;

    this.locations.set(key, { type, bucketKey, index: idx, rotation });
    if (animate && visible) {
      this.spawnAnimations.set(key, { startedAt: performance.now() });
    } else {
      this.spawnAnimations.delete(key);
    }
  }

  removeBlock(x: number, y: number, z: number): void {
    const key = blockKey(x, y, z);
    if (this.locations.has(key)) this.startRemoveAnimation(key);
  }

  clear(): void {
    for (const bucket of this.buckets.values()) {
      bucket.count = 0;
      bucket.mesh.count = 0;
      bucket.keyByIndex.length = 0;
      bucket.mesh.instanceMatrix.needsUpdate = true;
    }
    this.locations.clear();
    this.spawnAnimations.clear();
    this.removeAnimations.clear();
  }

  /** Advance pop-in and pop-out animations. Call from the rAF loop. */
  tick(now: number): void {
    if (this.spawnAnimations.size === 0 && this.removeAnimations.size === 0) return;
    const dirtyBuckets = new Set<TypeBucket>();

    for (const [key, anim] of this.spawnAnimations) {
      // Re-fetch each frame: swap-and-pop in removeAt may have shifted loc.index for any bucket.
      const loc = this.locations.get(key);
      if (!loc) { this.spawnAnimations.delete(key); continue; }
      const bucket = this.buckets.get(loc.bucketKey);
      if (!bucket) { this.spawnAnimations.delete(key); continue; }
      const [xs, ys, zs] = key.split(',');
      const x = Number(xs), y = Number(ys), z = Number(zs);
      if (!this.isVisibleY(y)) { this.spawnAnimations.delete(key); continue; }
      const t = (now - anim.startedAt) / SPAWN_DURATION_MS;
      if (t >= 1) {
        this.writeMatrix(bucket, loc.index, x, y, z, 1, loc.rotation);
        this.spawnAnimations.delete(key);
      } else {
        this.writeMatrix(bucket, loc.index, x, y, z, Math.max(0.001, easeOutBack(t)), loc.rotation);
      }
      dirtyBuckets.add(bucket);
    }

    for (const [key, removeAnim] of this.removeAnimations) {
      const loc = this.locations.get(key);
      if (!loc) { this.removeAnimations.delete(key); continue; }
      const bucket = this.buckets.get(loc.bucketKey);
      if (!bucket) { this.removeAnimations.delete(key); continue; }
      const [xs, ys, zs] = key.split(',');
      const x = Number(xs), y = Number(ys), z = Number(zs);
      const t = (now - removeAnim.startedAt) / REMOVE_DURATION_MS;
      if (!this.isVisibleY(y) || t >= 1) {
        this.removeAnimations.delete(key);
        this.removeAt(key, loc);
      } else {
        this.writeMatrix(bucket, loc.index, x, y, z, Math.max(0.001, easeInBack(t)), loc.rotation);
        dirtyBuckets.add(bucket);
      }
    }

    for (const b of dirtyBuckets) b.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Bounding box that fits all blocks (or null if empty). */
  computeBounds(): THREE.Box3 | null {
    if (this.locations.size === 0) return null;
    const box = new THREE.Box3();
    let first = true;
    for (const key of this.locations.keys()) {
      const [xs, ys, zs] = key.split(',');
      const x = Number(xs), y = Number(ys), z = Number(zs);
      if (first) {
        box.setFromCenterAndSize(new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5), new THREE.Vector3(1, 1, 1));
        first = false;
      } else {
        box.expandByPoint(new THREE.Vector3(x, y, z));
        box.expandByPoint(new THREE.Vector3(x + 1, y + 1, z + 1));
      }
    }
    return box;
  }

  dispose(): void {
    for (const bucket of this.buckets.values()) {
      this.group.remove(bucket.mesh);
      bucket.mesh.dispose();
    }
    this.buckets.clear();
    this.locations.clear();
    this.spawnAnimations.clear();
    this.removeAnimations.clear();
    // Materials are owned by TextureLibrary; don't dispose them here.
  }

  private writeMatrix(bucket: TypeBucket, index: number, x: number, y: number, z: number, scale: number, rotation: ColumnAxis = 'y'): void {
    TMP_POS.set(x + 0.5, y + 0.5, z + 0.5);
    if (rotation === 'x') {
      TMP_QUAT.setFromAxisAngle(AXIS_X, Math.PI / 2);
    } else if (rotation === 'z') {
      TMP_QUAT.setFromAxisAngle(AXIS_Z, Math.PI / 2);
    } else {
      TMP_QUAT.identity();
    }
    TMP_SCALE.setScalar(scale);
    TMP_MATRIX.compose(TMP_POS, TMP_QUAT, TMP_SCALE);
    bucket.mesh.setMatrixAt(index, TMP_MATRIX);
    bucket.mesh.instanceMatrix.needsUpdate = true;
  }

  private getOrCreateBucket(
    type: string,
    bucketKey: string,
    entry: ManifestEntry | null,
    stateKey: string
  ): TypeBucket {
    const existing = this.buckets.get(bucketKey);
    if (existing) return existing;
    const materials = this.textures.getMaterials(type);
    const geometry = geometryFor(entry, stateKey);
    const mesh = new THREE.InstancedMesh(geometry, materials, INITIAL_CAPACITY);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.name = `blocks:${bucketKey}`;
    const bucket: TypeBucket = {
      type, bucketKey, mesh, capacity: INITIAL_CAPACITY, count: 0, keyByIndex: [], materials, geometry,
    };
    this.buckets.set(bucketKey, bucket);
    this.group.add(mesh);
    return bucket;
  }

  private growBucket(bucket: TypeBucket): void {
    const newCapacity = bucket.capacity * 2;
    const oldMesh = bucket.mesh;
    const newMesh = new THREE.InstancedMesh(bucket.geometry, bucket.materials, newCapacity);
    newMesh.frustumCulled = false;
    newMesh.name = oldMesh.name;
    for (let i = 0; i < bucket.count; i++) {
      oldMesh.getMatrixAt(i, TMP_MATRIX);
      newMesh.setMatrixAt(i, TMP_MATRIX);
    }
    newMesh.count = bucket.count;
    newMesh.instanceMatrix.needsUpdate = true;

    this.group.remove(oldMesh);
    oldMesh.dispose();
    this.group.add(newMesh);
    bucket.mesh = newMesh;
    bucket.capacity = newCapacity;
  }

  private startRemoveAnimation(key: BlockKey): void {
    // Cancel any in-progress pop-in; the block is at whatever partial scale it has now.
    this.spawnAnimations.delete(key);
    this.removeAnimations.set(key, { startedAt: performance.now() });
  }

  private removeAt(key: BlockKey, loc: InstanceLocation): void {
    const bucket = this.buckets.get(loc.bucketKey);
    if (!bucket) return;
    this.spawnAnimations.delete(key);
    this.locations.delete(key);
    const lastIdx = bucket.count - 1;
    if (loc.index !== lastIdx) {
      // Swap-and-pop: move last instance into the freed slot.
      bucket.mesh.getMatrixAt(lastIdx, TMP_MATRIX);
      bucket.mesh.setMatrixAt(loc.index, TMP_MATRIX);
      const movedKey = bucket.keyByIndex[lastIdx]!;
      bucket.keyByIndex[loc.index] = movedKey;
      const movedLoc = this.locations.get(movedKey);
      if (movedLoc) movedLoc.index = loc.index;
    }
    bucket.keyByIndex.length = lastIdx;
    bucket.count = lastIdx;
    bucket.mesh.count = lastIdx;
    bucket.mesh.instanceMatrix.needsUpdate = true;
  }
}
