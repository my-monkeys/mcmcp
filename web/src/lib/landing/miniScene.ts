import * as THREE from 'three';
import { World } from '@/lib/world';
import { TextureLibrary } from '@/lib/textureLibrary';

type Placement = { x: number; y: number; z: number; type: string };

function buildPlacements(): Placement[] {
  const out: Placement[] = [];
  // 5x5 grass floor
  for (let x = -2; x <= 2; x++) {
    for (let z = -2; z <= 2; z++) {
      out.push({ x, y: 0, z, type: 'grass_block' });
    }
  }
  // 3x3 hollow tower 8 high (cobblestone shell)
  for (let y = 1; y <= 8; y++) {
    for (let x = -1; x <= 1; x++) {
      for (let z = -1; z <= 1; z++) {
        const isEdge = Math.abs(x) === 1 || Math.abs(z) === 1;
        if (isEdge) out.push({ x, y, z, type: 'cobblestone' });
      }
    }
  }
  // 4 corner crenellations
  out.push({ x: -1, y: 9, z: -1, type: 'cobblestone' });
  out.push({ x: 1, y: 9, z: -1, type: 'cobblestone' });
  out.push({ x: -1, y: 9, z: 1, type: 'cobblestone' });
  out.push({ x: 1, y: 9, z: 1, type: 'cobblestone' });
  // torch on centre top
  out.push({ x: 0, y: 9, z: 0, type: 'torch' });
  return out;
}

export type MiniScene = {
  setProgress: (p: number) => void;
  destroy: () => void;
};

export async function createMiniScene(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  version: string = '1.21',
): Promise<MiniScene> {
  const scene = new THREE.Scene();
  scene.background = null;

  const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 200);
  camera.position.set(10, 8, 14);
  camera.lookAt(0, 4, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(20, 30, 10);
  scene.add(sun);

  const textures = new TextureLibrary(version);
  await textures.preload();

  const world = new World(textures);
  scene.add(world.group);

  const placements = buildPlacements();
  let placedCount = 0;

  const setProgress = (p: number): void => {
    const target = Math.max(0, Math.min(placements.length, Math.floor(p * placements.length)));
    if (target > placedCount) {
      for (let i = placedCount; i < target; i++) {
        const placement = placements[i];
        if (!placement) continue;
        world.setBlock(placement.x, placement.y, placement.z, placement.type, true);
      }
    } else if (target < placedCount) {
      // scrubbed backward: rebuild from scratch
      world.clear();
      for (let i = 0; i < target; i++) {
        const placement = placements[i];
        if (!placement) continue;
        world.setBlock(placement.x, placement.y, placement.z, placement.type, false);
      }
    }
    placedCount = target;

    // gentle camera orbit on the last 5% of progress
    const orbit = Math.max(0, (p - 0.95) / 0.05);
    const angle = Math.PI / 4 + orbit * Math.PI * 0.4;
    const radius = 14;
    camera.position.set(Math.sin(angle) * radius, 8 + orbit * 2, Math.cos(angle) * radius);
    camera.lookAt(0, 4, 0);
  };

  const onResize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(onResize);
  ro.observe(container);

  let raf = 0;
  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    world.tick(now);
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(tick);

  const destroy = () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    world.dispose();
    textures.dispose();
    renderer.dispose();
  };

  return { setProgress, destroy };
}
