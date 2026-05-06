import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { World } from './world';
import { TextureLibrary } from './textureLibrary';

export type SceneHandles = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  world: World;
  textures: TextureLibrary;
  fitToBounds: () => void;
  setZone: (sx: number, sy: number, sz: number) => void;
  /** Show only blocks whose y is in [minY, maxY] inclusive. */
  setYRange: (minY: number, maxY: number) => void;
  destroy: () => void;
};

export async function createScene(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  version: string = '1.21',
): Promise<SceneHandles> {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111317);
  scene.fog = new THREE.Fog(0x111317, 120, 600);

  const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 2000);
  camera.position.set(20, 24, 28);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  scene.add(new THREE.AmbientLight(0xffffff, 0.65));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(60, 100, 40);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x88aaff, 0.25);
  fill.position.set(-40, 30, -60);
  scene.add(fill);

  let groundGrid = new THREE.GridHelper(64, 64, 0x303640, 0x1d2026);
  scene.add(groundGrid);

  const textures = new TextureLibrary(version);
  await textures.preload();

  const world = new World(textures);
  scene.add(world.group);

  const zoneOutline = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
    new THREE.LineBasicMaterial({ color: 0x4a90ff, transparent: true, opacity: 0.5 })
  );
  zoneOutline.visible = false;
  scene.add(zoneOutline);

  const setZone = (sx: number, sy: number, sz: number) => {
    zoneOutline.geometry.dispose();
    zoneOutline.geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(sx, sy, sz));
    zoneOutline.position.set(sx / 2, sy / 2, sz / 2);
    zoneOutline.visible = true;
    const max = Math.max(sx, sz);
    const grid = Math.max(16, Math.ceil(max / 16) * 16) * 2;
    scene.remove(groundGrid);
    groundGrid.geometry.dispose();
    (groundGrid.material as THREE.Material).dispose();
    groundGrid = new THREE.GridHelper(grid, grid, 0x303640, 0x1d2026);
    groundGrid.position.set(sx / 2, 0, sz / 2);
    scene.add(groundGrid);
  };

  const setYRange = (minY: number, maxY: number) => {
    // Out-of-range instances are rendered with scale=0 (invisible point).
    // No clipping planes — that would produce x-ray "ghost" faces.
    world.setYRange(minY, maxY);
  };

  const fitToBounds = () => {
    const bounds = world.computeBounds();
    if (!bounds) return;
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z) * 0.9 + 6;
    controls.target.copy(center);
    camera.position.copy(center).add(new THREE.Vector3(radius, radius * 0.8, radius));
    camera.updateProjectionMatrix();
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
    controls.update();
    world.tick(now);
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(tick);

  const destroy = () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    controls.dispose();
    world.dispose();
    textures.dispose();
    renderer.dispose();
  };

  return { renderer, scene, camera, controls, world, textures, fitToBounds, setZone, setYRange, destroy };
}
