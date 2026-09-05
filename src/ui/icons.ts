import * as THREE from 'three';
import { def } from '../world/tiles';
import { GEM_GEOS, gemClassOf, gemScaleOf } from '../world/gemshapes';

// Real 3D ore icons: each gem is rendered once by a tiny offscreen renderer
// and cached as a data URL, then used as a plain <img> anywhere in the UI.

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let gem: THREE.Mesh;
let mat: THREE.MeshStandardMaterial;
const cache = new Map<number, string>();

function setup(): void {
  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(96, 96);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(32, 1, 0.1, 10);
  camera.position.set(1.5, 1.2, 2.3);
  camera.lookAt(0, 0, 0);
  mat = new THREE.MeshStandardMaterial({ roughness: 0.18, metalness: 0.5, flatShading: true, vertexColors: true });
  gem = new THREE.Mesh(GEM_GEOS[0], mat);
  gem.rotation.set(0.45, 0.55, 0.1);
  scene.add(gem);
  const key = new THREE.DirectionalLight(0xffffff, 2.6);
  key.position.set(2, 3, 4);
  const rim = new THREE.DirectionalLight(0x8ab0ff, 1.2);
  rim.position.set(-3, 1, -2);
  scene.add(key, rim, new THREE.AmbientLight(0xffffff, 0.55));
}

export function oreIcon(t: number): string {
  const hit = cache.get(t);
  if (hit) return hit;
  if (!renderer) setup();
  const color = def(t).gem || 0x999999;
  mat.color.setHex(color);
  mat.emissive.setHex(color);
  mat.emissiveIntensity = 0.22;
  // each resource keeps its in-world shape and proportions
  gem.geometry = GEM_GEOS[gemClassOf(t)];
  gem.rotation.set(0.4, 0.7, 0.15);
  gem.scale.setScalar(2.9 * gemScaleOf(t));
  renderer!.render(scene, camera);
  const url = renderer!.domElement.toDataURL();
  cache.set(t, url);
  return url;
}

/** css color for an ore's glow halo */
export function oreGlow(t: number): string {
  return '#' + (def(t).gem || 0x999999).toString(16).padStart(6, '0');
}
