import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Geometries for non-cube blocks. Each instance is centered at the block
 * origin (0,0,0) just like a regular cube — InstancedMesh's matrix translates
 * it to (x+0.5, y+0.5, z+0.5).
 *
 * UV note: we use BoxGeometry's default UVs which assume the texture occupies
 * the full face. For half-height side faces (slabs / stair bases) the side
 * texture is therefore stretched. Vanilla MC uses the bottom (or top) half of
 * the texture instead. We accept the squish for now — recognizable enough.
 */

const CUBE = new THREE.BoxGeometry(1, 1, 1);

export function cubeGeometry(): THREE.BoxGeometry {
  return CUBE;
}

export function slabGeometry(half: 'bottom' | 'top'): THREE.BufferGeometry {
  const offsetY = half === 'top' ? 0.25 : -0.25;
  return new THREE.BoxGeometry(1, 0.5, 1).translate(0, offsetY, 0);
}

/**
 * Thin horizontal disc at the bottom of the block — used by carpets, lily
 * pads, pressure plates, etc. Material should be DoubleSide so the disc shows
 * from above and below.
 */
export function flatGeometry(): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  // y = -0.5 + 1/64 ≈ -0.484 to match vanilla's lily_pad y=0.25/16 offset.
  const y = -0.484;
  const positions = new Float32Array([
    -0.5, y, -0.5,
     0.5, y, -0.5,
     0.5, y,  0.5,
    -0.5, y,  0.5,
  ]);
  const uvs = new Float32Array([0, 0,  1, 0,  1, 1,  0, 1]);
  const indices = [0, 1, 2,  0, 2, 3];
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.addGroup(0, 6, 0);
  return geo;
}

/**
 * Two diagonal planes intersecting at the block center — the canonical
 * Minecraft "cross" rendering for flowers, grasses, ferns, saplings, etc.
 * Each plane spans a unit cube's diagonal. Materials must be DoubleSide so
 * both sides of each plane render.
 *
 * Both groups use materialIndex 0; pair this with a Material[6] whose [0] is
 * the cross texture (entryToFaces produces 6 copies for cross entries).
 */
export function crossGeometry(): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array([
    // plane 1: SW-bottom, NE-bottom, NE-top, SW-top
    -0.5, -0.5, -0.5,
     0.5, -0.5,  0.5,
     0.5,  0.5,  0.5,
    -0.5,  0.5, -0.5,
    // plane 2: NW-bottom, SE-bottom, SE-top, NW-top
    -0.5, -0.5,  0.5,
     0.5, -0.5, -0.5,
     0.5,  0.5, -0.5,
    -0.5,  0.5,  0.5,
  ]);
  const uvs = new Float32Array([
    0, 0,  1, 0,  1, 1,  0, 1,
    0, 0,  1, 0,  1, 1,  0, 1,
  ]);
  const indices = [
    0, 1, 2,  0, 2, 3,
    4, 5, 6,  4, 6, 7,
  ];
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.addGroup(0, 6, 0);
  geo.addGroup(6, 6, 0);
  return geo;
}

export type StairFacing = 'north' | 'south' | 'east' | 'west';

export function stairsGeometry(facing: StairFacing, half: 'bottom' | 'top'): THREE.BufferGeometry {
  const baseY = half === 'top' ? 0.25 : -0.25;
  const stepY = half === 'top' ? -0.25 : 0.25;

  // Base: half-height block covering the full footprint.
  const base = new THREE.BoxGeometry(1, 0.5, 1).translate(0, baseY, 0);

  // Step: half-height, half-footprint, on the side the stair "faces".
  // facing=north → high half is to the north (-Z).
  let stepW = 1, stepD = 1, stepX = 0, stepZ = 0;
  switch (facing) {
    case 'north': stepD = 0.5; stepZ = -0.25; break;
    case 'south': stepD = 0.5; stepZ = 0.25; break;
    case 'east':  stepW = 0.5; stepX = 0.25; break;
    case 'west':  stepW = 0.5; stepX = -0.25; break;
  }
  const step = new THREE.BoxGeometry(stepW, 0.5, stepD).translate(stepX, stepY, stepZ);

  // mergeGeometries preserves per-face groups (so Material[6] still maps correctly).
  return mergeGeometries([base, step], true) ?? base;
}
