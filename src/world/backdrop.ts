import * as THREE from 'three';
import { WORLD_W, WORLD_ROWS, CORE_ROW, PAD_X0, PAD_X1 } from '../config';
import { backwallColor, T } from './tiles';
import type { Terrain } from './terrain';
import { ACTIVE, worldById } from './worlds';
import { STRUCTURE_BUILDERS } from './structures';
import { hdrBasic } from '../fx/post';

// Backwall, sky, surface rig set-dressing, the Ember, and depth-graded atmosphere.

// ---------- backwall: carved-cave interior behind the tile field ----------
/**
 * The cave's far wall sits a value step behind the rock and in front of true
 * void: the light that lands on it takes the world's own hue (a cold world's
 * cavity never goes beige under the warm lamp), and the open cavity's air
 * hazes it in that hue, thickest deep in a cavern and thinning toward its rim,
 * so the space reads as depth rather than a flat plane. Kept dark: the lamp
 * still does the work. Atmosphere drives the hue with depth.
 */
const backwallU = {
  uCavity: { value: new THREE.Color(0, 0, 0) },
  uCool: { value: 0 },
  /** v (uv) where the core's chamber starts: its light keeps its own hue */
  uCoreV: { value: 0 },
  uDepth: { value: null as THREE.Texture | null },
};
/** linear luminance the cavity's haze is held to, deep in an open cavern */
const CAVITY_LUM = 0.024;
const LUMW = [0.2126, 0.7152, 0.0722] as const;

export function createBackwall(scene: THREE.Scene, terrain: Terrain): void {
  const EXTRA = 30; // rows past the world bottom so the camera never sees void
  const H = WORLD_ROWS + EXTRA;
  const cv = document.createElement('canvas');
  cv.width = WORLD_W; cv.height = H;
  const g = cv.getContext('2d')!;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < WORLD_W; x++) {
      g.fillStyle = backwallColor(x, Math.min(y, WORLD_ROWS - 1));
      g.fillRect(x, y, 1, 1);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;

  // how far each open cell lies from the cavity's rim (rock), in tiles, 0..1
  // over four tiles; rows are stored bottom-up to match the plane's uvs
  const REACH = 4;
  const dist = new Float32Array(WORLD_W * H).fill(REACH);
  const open = (x: number, y: number) => y >= 0 && y < WORLD_ROWS && terrain.get(x, y) === T.AIR;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < WORLD_W; x++) {
      if (!open(x, y)) { dist[y * WORLD_W + x] = 0; continue; }
      let d = REACH;
      for (let dy = -REACH; dy <= REACH; dy++) {
        for (let dx = -REACH; dx <= REACH; dx++) {
          const e = Math.hypot(dx, dy);
          if (e >= d) continue;
          const sx = x + dx, sy = y + dy;
          // the sky above the field is open air, the world's sides are rock
          if (sy < 0) continue;
          if (sx < 0 || sx >= WORLD_W || !open(sx, sy)) d = e;
        }
      }
      dist[y * WORLD_W + x] = d;
    }
  }
  const depth = new Uint8Array(WORLD_W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < WORLD_W; x++) {
      const t = Math.max(0, dist[y * WORLD_W + x] - 0.5) / (REACH - 0.5);
      depth[(H - 1 - y) * WORLD_W + x] = Math.round(255 * t * t * (3 - 2 * t));
    }
  }
  const dtex = new THREE.DataTexture(depth, WORLD_W, H, THREE.RedFormat, THREE.UnsignedByteType);
  dtex.magFilter = THREE.LinearFilter;
  dtex.minFilter = THREE.LinearFilter;
  dtex.needsUpdate = true;
  backwallU.uDepth.value = dtex;
  // a cold world re-hues more of the warm lamp's light on its far wall
  backwallU.uCool.value = ACTIVE.hazard.cold ? 0.6 : 0.3;
  backwallU.uCoreV.value = 1 - (CORE_ROW - 12) / H;

  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 1 });
  mat.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, backwallU);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform vec3 uCavity;
uniform float uCool;
uniform float uCoreV;
uniform sampler2D uDepth;`)
      .replace('#include <opaque_fragment>', `{
		const vec3 LW = vec3(0.2126, 0.7152, 0.0722);
		float dep = texture2D(uDepth, vMapUv).r;
		// the light landing here takes the world's hue (luminance kept)
		vec3 hue = uCavity / max(dot(uCavity, LW), 1e-5);
		float cool = uCool * smoothstep(uCoreV - 0.02, uCoreV + 0.01, vMapUv.y);
		outgoingLight = mix(outgoingLight, dot(outgoingLight, LW) * hue, cool);
		// farther back reads hazier: less of the lamp's contrast, more of the air
		outgoingLight = outgoingLight * (1.0 - 0.35 * dep) + uCavity * (0.35 + 0.65 * dep);
	}
	#include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'backwall-cavity-v1';
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_W, H), mat);
  // extra height so the camera never sees past the world's bottom edge
  mesh.position.set(WORLD_W / 2, -H / 2, -0.62);
  scene.add(mesh);
}

// ---------- sky: dusk gradient + sun + ridge silhouette ----------
export function createSky(scene: THREE.Scene): void {
  const cv = document.createElement('canvas');
  cv.width = 2; cv.height = 256;
  const g = cv.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, ACTIVE.sky.top);
  grad.addColorStop(0.42, ACTIVE.sky.mid);
  grad.addColorStop(0.84, ACTIVE.sky.low);
  grad.addColorStop(1, ACTIVE.sky.horizon);
  g.fillStyle = grad;
  g.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(340, 130),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, fog: false })
  );
  sky.position.set(WORLD_W / 2, 42, -60);
  scene.add(sky);

  // low, huge sun (a pale disc on the colder worlds) — SITE 297 gets none:
  // the only sky in the game with nothing in it
  if (!ACTIVE.husk) {
    const sun = new THREE.Mesh(
      new THREE.CircleGeometry(7, 48),
      new THREE.MeshBasicMaterial({ color: ACTIVE.sky.sun, toneMapped: false, fog: false })
    );
    sun.position.set(WORLD_W / 2 - 14, 10.5, -58);
    scene.add(sun);
    const halo = new THREE.Mesh(
      new THREE.CircleGeometry(16, 48),
      new THREE.MeshBasicMaterial({
        color: ACTIVE.sky.halo, transparent: true, opacity: 0.22,
        blending: THREE.AdditiveBlending, toneMapped: false, fog: false, depthWrite: false,
      })
    );
    halo.position.copy(sun.position).z -= 0.5;
    scene.add(halo);
  }

  // silhouette ridge line
  // distant colony skyline on the horizon: domes, tanks, slabs, masts
  createSkyline(scene);
}

/** skyline mast beacons: hot enough to bloom */
const BEACON = new THREE.MeshBasicMaterial({ color: 0xff4d29, toneMapped: false });
hdrBasic(BEACON, 2.2);

function createSkyline(scene: THREE.Scene): void {
  // flat painterly silhouettes: unlit, hazed toward the sky by distance
  const near = new THREE.MeshBasicMaterial({ color: 0x342647, toneMapped: false });
  const far = new THREE.MeshBasicMaterial({ color: 0x453454, toneMapped: false });
  const winMat = new THREE.MeshBasicMaterial({ color: 0xffb066, toneMapped: false });
  hdrBasic(winMat, 1.7);
  const g = new THREE.Group();

  interface S { kind: 'dome' | 'tank' | 'slab' | 'mast'; x: number; s: number; z: number; win?: number; }
  const items: S[] = [
    { kind: 'dome', x: -12, s: 3.2, z: -42, win: 3 },
    { kind: 'slab', x: -6, s: 1.6, z: -42, win: 2 },
    { kind: 'mast', x: -2, s: 5.5, z: -42 },
    { kind: 'tank', x: 4, s: 1.8, z: -42 },
    { kind: 'dome', x: 10, s: 2.2, z: -42, win: 2 },
    { kind: 'dome', x: 26, s: 4.0, z: -44, win: 4 },
    { kind: 'slab', x: 33, s: 2.2, z: -42, win: 3 },
    { kind: 'mast', x: 37, s: 6.5, z: -42 },
    { kind: 'tank', x: 44, s: 2.4, z: -43 },
    { kind: 'dome', x: 54, s: 2.8, z: -42, win: 3 },
    { kind: 'slab', x: 62, s: 1.8, z: -42, win: 2 },
    { kind: 'dome', x: 72, s: 3.6, z: -44, win: 3 },
    { kind: 'mast', x: 78, s: 4.5, z: -42 },
    // very far layer
    { kind: 'dome', x: 16, s: 5.0, z: -54 },
    { kind: 'slab', x: 46, s: 3.4, z: -54 },
    { kind: 'dome', x: 66, s: 4.2, z: -55 },
  ];

  // the colony's big relay, silhouetted on the far ridge — the assay dish is
  // the small cousin of this, and the pair sells the scale of the settlement
  {
    const relayX = 66, relayZ = -50;
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, 7, 6), far)
      .translateX(relayX).translateY(3.5).translateZ(relayZ));
    const bigDish = new THREE.Mesh(
      new THREE.SphereGeometry(2.4, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), far);
    bigDish.position.set(relayX, 7.2, relayZ);
    bigDish.rotation.x = -2.35;
    g.add(bigDish);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 6), BEACON);
    beacon.position.set(relayX, 8.4, relayZ);
    g.add(beacon);
  }

  for (const it of items) {
    const mat = it.z < -48 ? far : near;
    let m: THREE.Mesh;
    if (it.kind === 'dome') {
      m = new THREE.Mesh(new THREE.SphereGeometry(it.s, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat);
      m.position.set(it.x, 0, it.z);
    } else if (it.kind === 'tank') {
      m = new THREE.Mesh(new THREE.CylinderGeometry(it.s * 0.5, it.s * 0.5, it.s * 1.6, 12), mat);
      m.position.set(it.x, it.s * 0.8, it.z);
    } else if (it.kind === 'slab') {
      m = new THREE.Mesh(new THREE.BoxGeometry(it.s * 2.4, it.s, it.s), mat);
      m.position.set(it.x, it.s / 2, it.z);
    } else {
      m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, it.s, 6), mat);
      m.position.set(it.x, it.s / 2, it.z);
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), BEACON);
      beacon.position.set(it.x, it.s + 0.1, it.z);
      g.add(beacon);
    }
    g.add(m);
    // lit windows keep the silhouettes alive
    for (let w = 0; w < (it.win ?? 0); w++) {
      const dot = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.09), winMat);
      const zFront = it.z + (it.kind === 'dome' ? it.s * 1.02 : it.kind === 'slab' ? it.s / 2 + 0.03 : it.s * 0.55);
      dot.position.set(
        it.x + (w - (it.win! - 1) / 2) * (it.s * 0.32),
        it.kind === 'dome' ? it.s * 0.22 : it.s * (0.3 + (w % 2) * 0.25),
        zFront
      );
      g.add(dot);
    }
  }
  scene.add(g);
}

// ---------- surface rig: buildings + docking pads ----------
export interface Dock { key: 'fuel' | 'trade' | 'garage' | 'assay' | 'quarters'; label: string; x0: number; x1: number; }
export const DOCKS: Dock[] = [
  // home stands west of the pad — work is everything east of it
  { key: 'quarters', label: 'THE QUARTERS', x0: 5, x1: 9 },
  { key: 'fuel', label: 'FUEL DEPOT', x0: 17, x1: 22 },
  { key: 'trade', label: 'TRADE POST', x0: 28, x1: 33 },
  { key: 'garage', label: 'GARAGE', x0: 39, x1: 44 },
  { key: 'assay', label: 'ASSAY OFFICE', x0: 50, x1: 54 },
];

const BODY = new THREE.MeshStandardMaterial({ color: 0x3f3352, roughness: 0.8 });
const BODY2 = new THREE.MeshStandardMaterial({ color: 0x52446b, roughness: 0.8 });
const METAL = new THREE.MeshStandardMaterial({ color: 0x2a2438, roughness: 0.45, metalness: 0.6 });
const PADMAT = new THREE.MeshStandardMaterial({ color: 0x4a4f5e, roughness: 0.5, metalness: 0.3 });
const PANEL = new THREE.MeshStandardMaterial({ color: 0x1c2c50, roughness: 0.25, metalness: 0.7 });
const PAD = new THREE.MeshStandardMaterial({ color: 0x4a3f60, roughness: 0.65 });

function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

function cyl(r: number, h: number, mat: THREE.Material, x: number, y: number, z: number, seg = 18): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat);
  m.position.set(x, y, z);
  return m;
}

function halfDome(r: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), mat);
  m.position.set(x, y, z);
  return m;
}

function glowDot(color: number, x: number, y: number, z: number, s = 0.09): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(s, 8, 8),
    new THREE.MeshBasicMaterial({ color, toneMapped: false }));
  m.position.set(x, y, z);
  return m;
}

export function createSurface(scene: THREE.Scene): void {
  const g = new THREE.Group();

  // distant ground apron: the terrain the colony actually stands on,
  // stretching from just behind the tile field out to the horizon
  const groundColor = new THREE.Color(ACTIVE.rockColors[0]).multiplyScalar(0.5);
  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(280, 78),
    new THREE.MeshStandardMaterial({ color: groundColor, roughness: 1 })
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(WORLD_W / 2, -0.03, -39.4); // covers z ≈ [-78.4, -0.4]
  g.add(apron);

  // ---- the landing pad: home plate, spawn & tow target ----
  {
    // flush plate — the pod's skids rest right on it, never inside it
    const px = (PAD_X0 + PAD_X1 + 1) / 2; // center of the protected columns
    g.add(box(4.3, 0.04, 2.5, PADMAT, px, 0.02, 0));
    const stripMat = new THREE.MeshBasicMaterial({ color: 0xff9a3c, toneMapped: false });
    for (const s of [-1, 1]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 1.9), stripMat);
      bar.position.set(px + s * 1.55, 0.05, 0);
      g.add(bar);
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.045, 8, 32), stripMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(px, 0.05, 0);
    g.add(ring);
    for (const [sx, sz] of [[-1.9, -1], [1.9, -1], [-1.9, 1], [1.9, 1]] as const) {
      g.add(glowDot(0x3ce6c8, px + sx, 0.09, sz, 0.06));
    }
  }

  for (const dock of DOCKS) {
    const cx = (dock.x0 + dock.x1) / 2;
    // warm practical light spilling from each building
    const practical = new THREE.PointLight(0xffa04c, 14, 10, 1.8);
    practical.position.set(cx, 2.6, 1.4);
    g.add(practical);
    // dock apron: a flush plate so the pod sits ON it, not in it
    const pad = box(dock.x1 - dock.x0, 0.04, 2.2, PAD, cx, 0.02, 0);
    g.add(pad);
    for (const side of [-1, 1]) {
      const lamp = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.07, 2.0),
        new THREE.MeshBasicMaterial({ color: 0x3ce6c8, toneMapped: false })
      );
      lamp.position.set(cx + side * (dock.x1 - dock.x0) / 2, 0.06, 0);
      g.add(lamp);
    }

    // the structure itself — built in structures.ts, planted at dock center.
    // Pushed back so the plinths clear the tile field: a shaft dug at a dock
    // column must stay readable from the play camera, not vanish behind a
    // slab that bridges its mouth.
    const building = STRUCTURE_BUILDERS[dock.key]();
    building.position.set(cx, 0, -0.45);
    g.add(building);
  }

  // habitat domes + solar racks between the working buildings
  g.add(halfDome(1.4, BODY2, 36.2, 0, -4.5));
  g.add(glowDot(0xffb066, 36.2, 0.5, -3.12, 0.06));
  g.add(halfDome(0.95, BODY, 13.5, 0, -4));
  g.add(glowDot(0xffb066, 13.5, 0.35, -3.07, 0.05));
  // the west rack starts at 0.5 so it clears the quarters' slab at x≈4.55
  for (const baseX of [0.5, 58.5]) {
    for (let i = 0; i < 3; i++) {
      const panel = box(1.35, 0.05, 0.95, PANEL, baseX + i * 1.6, 0.75, -2.6);
      panel.rotation.z = 0.45;
      g.add(panel);
      g.add(cyl(0.05, 0.7, METAL, baseX + i * 1.6, 0.35, -2.6, 6));
    }
  }

  // scattered masts + props for silhouette interest
  const mastMat = new THREE.MeshStandardMaterial({ color: 0x171221, roughness: 0.9 });
  for (const [mx, mh] of [[6, 5.5], [11, 3.2], [60, 4.6], [47, 2.4]] as const) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, mh, 6), mastMat);
    mast.position.set(mx, mh / 2, -2.5);
    g.add(mast);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), BEACON);
    beacon.position.set(mx, mh + 0.1, -2.5);
    g.add(beacon);
  }

  scene.add(g);
}

// ---------- the buried star fragment (per-world core) ----------
export interface Ember {
  group: THREE.Group;
  light: THREE.PointLight;
  update(t: number, camRow: number): void;
  x: number;
  y: number;
  /** 0..1 — the Communion drives this as the pilot closes; pulse, halo, ring and shaft all follow */
  excite: number;
  /** the fragment has been extracted: the cradle stands empty */
  taken: boolean;
}

const SHARDS = 12;
const shardM = new THREE.Matrix4();
const shardP = new THREE.Vector3();
const shardQ = new THREE.Quaternion();
const shardS = new THREE.Vector3();
const shardE = new THREE.Euler();

function haloTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.28)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(cv);
}

const smooth = (e0: number, e1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** a soft white alpha field, `fn(u, v)` 0..1 with v = 0 at the bottom */
function fieldTexture(w: number, h: number, fn: (u: number, v: number) => number): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d')!;
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = Math.min(1, Math.max(0, fn((x + 0.5) / w, 1 - (y + 0.5) / h)));
      const i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(a * 255);
    }
  }
  g.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(cv);
}

/**
 * The fragment's body: a low-poly crystal, not a ball. A detail-2
 * icosahedron pulled taller than wide and tapered to its tips, every corner
 * pushed in or out a little (shared corners move together, so it stays
 * closed), and a fixed value per facet that turns with it.
 */
function crystalGeometry(r: number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(r, 2);
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  const h = (a: number, b: number, c: number, k: number): number => {
    const v = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719 + k * 4.31) * 43758.5453;
    return v - Math.floor(v);
  };
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const q = (n: number) => Math.round(n * 100);
    const j = 1 + (h(q(v.x), q(v.y), q(v.z), 1) - 0.5) * 0.2;
    const ny = v.y / r;
    const taper = 1 - 0.32 * ny * ny;
    v.set(v.x * j * taper * 0.86, v.y * j * 1.12, v.z * j * taper * 0.86);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  // non-indexed: each run of three vertices is one facet
  const facet = new Float32Array(p.count);
  for (let f = 0; f < p.count / 3; f++) {
    const t = h(f, 3.1, 7.7, 2);
    facet[f * 3] = facet[f * 3 + 1] = facet[f * 3 + 2] = t;
  }
  g.setAttribute('facet', new THREE.BufferAttribute(facet, 1));
  return g;
}

/**
 * The crystal's light: facets turned to the viewer burn the core's white-hot
 * body, facets turning away fall through its light to the shell's hue at the
 * rim, and each facet keeps its own value on top, so the body reads as cut
 * stone with an inside rather than a disc. Only the hottest facets cross
 * the bloom threshold.
 */
function crystalMaterial(excite: { value: number }): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const u = {
    uBody: { value: new THREE.Color(ACTIVE.core.body) },
    uShell: { value: new THREE.Color(ACTIVE.core.shell) },
    uLight: { value: new THREE.Color(ACTIVE.core.light) },
    uExcite: excite,
  };
  m.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float facet;\nvarying float vFacet;\nvarying vec3 vVP;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n\tvVP = mvPosition.xyz; vFacet = facet;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform vec3 uBody;
uniform vec3 uShell;
uniform vec3 uLight;
uniform float uExcite;
varying float vFacet;
varying vec3 vVP;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
	{
		vec3 fN = normalize(cross(dFdx(vVP), dFdy(vVP)));
		float ndv = abs(dot(fN, normalize(-vVP)));
		vec3 c = mix(uShell * 0.45, uLight, smoothstep(0.15, 0.55, ndv));
		c = mix(c, uBody, smoothstep(0.8, 0.98, ndv) * (0.3 + 0.7 * vFacet));
		float fv = mix(0.55, 1.15, vFacet * vFacet) * mix(0.75, 1.0, smoothstep(0.3, 0.9, ndv));
		// the hottest facets, square to the viewer, go past white and bloom
		fv += smoothstep(0.84, 0.99, ndv) * step(0.5, vFacet) * 0.45;
		diffuseColor.rgb = c * fv * (1.0 + uExcite * 0.35);
	}`);
  };
  m.customProgramCacheKey = () => 'core-crystal-v1';
  return m;
}

export function createEmber(scene: THREE.Scene): Ember {
  const x = WORLD_W / 2, y = -(CORE_ROW + 5);
  const group = new THREE.Group();
  // the burning heart spins; halo, ring and shaft stay world-oriented
  const spin = new THREE.Group();
  const exciteU = { value: 0 };
  const coreMat = crystalMaterial(exciteU);
  hdrBasic(coreMat, 1.2);
  const core = new THREE.Mesh(crystalGeometry(2.6), coreMat);
  // the shell glows only past the crystal's edge (its back faces, hidden
  // behind the body), so it rims the silhouette instead of washing the facets
  const shell = new THREE.Mesh(
    crystalGeometry(3.1),
    new THREE.MeshBasicMaterial({
      color: ACTIVE.core.shell, transparent: true, opacity: 0.22, side: THREE.BackSide,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    })
  );
  spin.add(core, shell);
  const light = new THREE.PointLight(ACTIVE.core.light, 0, 60, 1.4);

  // halo: a soft radial sprite that breathes with the pulse
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: haloTexture(), color: ACTIVE.core.light, transparent: true, opacity: 0.4,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  }));
  halo.scale.setScalar(11);

  // shard ring: crust the star shed on impact, still in orbit around it
  const shards = new THREE.InstancedMesh(
    new THREE.TetrahedronGeometry(0.34, 0),
    new THREE.MeshBasicMaterial({ color: ACTIVE.core.shell, toneMapped: false }),
    SHARDS
  );
  shards.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  shards.frustumCulled = false;

  // light shaft: the fragment's glow reaching up the dig
  const shaftCv = document.createElement('canvas');
  shaftCv.width = 2; shaftCv.height = 128;
  const sg = shaftCv.getContext('2d')!;
  const sGrad = sg.createLinearGradient(0, 128, 0, 0);
  sGrad.addColorStop(0, 'rgba(255,255,255,0.5)');
  sGrad.addColorStop(1, 'rgba(255,255,255,0)');
  sg.fillStyle = sGrad;
  sg.fillRect(0, 0, 2, 128);
  const shaft = new THREE.Mesh(
    new THREE.PlaneGeometry(5.5, 18),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(shaftCv), color: ACTIVE.core.light,
      transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending,
      depthWrite: false, toneMapped: false,
    })
  );
  shaft.position.set(0, 11.5, -0.3);

  // the chamber's air and back wall washed in the fragment's light: a wide
  // soft gradient just in front of the backwall, so it only shows where the
  // chamber is open and the rock in front of it still reads as rock
  // (a broad falloff so the whole vault reads as lit space, not a glow
  // pinned to the fragment; every core at one brightness)
  const chamber = !ACTIVE.husk && ACTIVE === worldById(ACTIVE.id);
  const airC = new THREE.Color(ACTIVE.core.light);
  const airLum = 0.2126 * airC.r + 0.7152 * airC.g + 0.0722 * airC.b;
  airC.multiplyScalar(Math.min(1, 0.45 / Math.max(airLum, 1e-3)));
  const airMat = (map: THREE.Texture, opacity: number) => new THREE.MeshBasicMaterial({
    map, color: chamber ? airC : ACTIVE.core.light, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false,
  });
  const flood = new THREE.Mesh(
    new THREE.PlaneGeometry(chamber ? 46 : 44, 30),
    airMat(chamber ? fieldTexture(128, 96, (u, v) => {
      // the vault: brightest round the fragment, still lit at the walls
      const r = Math.hypot((u - 0.5) * 2, (v - 0.5) * 2);
      return Math.max(0, 1 - r) ** 1.5 * 0.75 + Math.max(0, 1 - r * 2.2) ** 2 * 0.25;
    }) : haloTexture(), 0.5)
  );
  flood.position.set(0, 0.5, -0.58);
  group.add(spin, light, halo, shards, shaft, flood);

  // The chamber's air holds the light (G2 lit the stone and the back wall;
  // this is the volume between): a fan of soft rays from the fragment down
  // across the floor, a haze lying on the floor, and a dim glow in the void
  // under the floor ledge. All static additive sheets in the air plane
  // (depth-tested, so rock in front hides them); nothing moves, they only
  // breathe in opacity with the pulse. None in a spent world or the husk.
  const air: { mat: THREE.MeshBasicMaterial; base: number }[] = [];
  const addAir = (mesh: THREE.Mesh, base: number) => {
    group.add(mesh);
    air.push({ mat: mesh.material as THREE.MeshBasicMaterial, base });
  };
  if (chamber) {
    const rayTex = fieldTexture(128, 32, (u, v) => {
      // bright at the fragment, widening and thinning out along its length
      const along = smooth(0.0, 0.14, u) * (1 - u) ** 1.7;
      const half = 0.3 + 0.7 * u;
      const a = Math.abs(v - 0.5) * 2 / half;
      return a >= 1 ? 0 : along * Math.cos(a * Math.PI / 2) ** 2;
    });
    // [angle° (0 = +x, world up = +y), length, width, opacity]; the floor-
    // ward rays end in the floor slab (7 below the fragment) so none pokes
    // into the void under it
    const RAYS: readonly (readonly [number, number, number, number])[] = [
      [-160, 17, 4.2, 0.16], [-134, 9, 3.2, 0.2], [-104, 6.8, 2.6, 0.14],
      [-76, 6.8, 2.6, 0.14], [-46, 9, 3.2, 0.2], [-20, 17, 4.2, 0.16],
      [168, 15, 5.0, 0.1], [12, 15, 5.0, 0.1],
    ];
    for (const [deg, len, wid, op] of RAYS) {
      const ray = new THREE.Mesh(new THREE.PlaneGeometry(len, wid).translate(len / 2, 0, 0), airMat(rayTex, op));
      ray.rotation.z = deg * Math.PI / 180;
      ray.position.set(0, 0, -0.45);
      addAir(ray, op);
    }
    // haze on the floor: thickest at the fragment's foot, out to the walls
    const floorHaze = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 3.6),
      airMat(fieldTexture(128, 32, (u, v) => {
        const across = Math.max(0, 1 - Math.abs(u - 0.5) * 2);
        return (0.35 + 0.65 * across * across) * smooth(0, 0.12, u) * smooth(1, 0.88, u)
          * (1 - v) ** 2.2;
      }), 0.3)
    );
    floorHaze.position.set(0, -5 + 1.8, -0.05);   // its foot on the floor top
    addAir(floorHaze, 0.3);
    // the hot pool right under the fragment: a narrow, brighter haze whose
    // foot sits on the floor, in the core's own light warmed toward its body
    const poolC = airC.clone().lerp(new THREE.Color(ACTIVE.core.body), 0.35);
    const poolMat = airMat(fieldTexture(64, 32, (u, v) => {
      const across = Math.max(0, 1 - Math.abs(u - 0.5) * 2);
      return across ** 1.6 * (1 - v) ** 1.8;
    }), 0.55);
    poolMat.color.copy(poolC);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(11, 3.2), poolMat);
    pool.position.set(0, -5 + 1.6, -0.04);
    addAir(pool, 0.55);
    // the void under the floor ledge: a dim gradient, not dead black
    const under = new THREE.Mesh(
      new THREE.PlaneGeometry(48, 10),
      airMat(fieldTexture(128, 32, (u, v) => {
        const across = Math.max(0, 1 - Math.abs(u - 0.5) * 2);
        return Math.sqrt(across) * v ** 2.4;
      }), 0.32)
    );
    under.position.set(0, -7 - 5, -0.3);            // top edge at the world's floor
    addAir(under, 0.32);
  }


  group.position.set(x, y, 0);
  scene.add(group);

  const ember: Ember = {
    group, light, x, y, excite: 0, taken: false,
    update(t: number, camRow: number) {
      if (this.taken) { group.visible = false; light.intensity = 0; return; }
      const ex = this.excite;
      const near = camRow > CORE_ROW - 90;
      const rate = 2.1 + ex * 2.6;
      const pulse = Math.sin(t * rate);
      light.intensity = near ? (140 + pulse * 30) * (1 + ex * 1.4) : 0;
      group.visible = camRow > CORE_ROW - 120;
      if (!group.visible) return;
      spin.rotation.y = t * (0.25 + ex * 0.3);
      spin.rotation.z = t * 0.11;
      core.scale.setScalar(1 + pulse * (0.06 + ex * 0.07));
      shell.scale.setScalar(1 + Math.sin(t * 1.3 + 1) * 0.1 + ex * 0.12);
      halo.scale.setScalar(11 + pulse * 1.5 + ex * 6);
      (halo.material as THREE.SpriteMaterial).opacity = 0.22 + pulse * 0.06 + ex * 0.35;
      exciteU.value = ex;
      (shaft.material as THREE.MeshBasicMaterial).opacity = 0.1 + ex * 0.3;
      (flood.material as THREE.MeshBasicMaterial).opacity = 0.5 + pulse * 0.04 + ex * 0.2;
      for (const a of air) a.mat.opacity = a.base * (1 + pulse * 0.06 + ex * 0.5);

      for (let i = 0; i < SHARDS; i++) {
        const ring = i % 2;                      // two inclined orbits
        const a = t * (0.16 + ring * 0.09 + ex * 0.22) + (i / SHARDS) * Math.PI * 2;
        const r = 4.3 + ring * 1.2 + Math.sin(i * 3.7) * 0.3;
        const incl = ring === 0 ? 0.28 : -0.42;
        shardP.set(
          Math.cos(a) * r,
          Math.sin(a) * r * Math.sin(incl),
          Math.sin(a) * r * Math.cos(incl) * 0.35
        );
        shardE.set(t * 0.8 + i, t * 0.6, i * 1.3);
        shardQ.setFromEuler(shardE);
        shardS.setScalar(0.7 + Math.sin(i * 2.1) * 0.3);
        shardM.compose(shardP, shardQ, shardS);
        shards.setMatrixAt(i, shardM);
      }
      shards.instanceMatrix.needsUpdate = true;
    },
  };
  return ember;
}

// ---------- atmosphere: depth-graded fog, sky light, ambient ----------
export class Atmosphere {
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private amb: THREE.AmbientLight;
  private fog: THREE.FogExp2;
  private a = new THREE.Color();
  private b = new THREE.Color();
  private ash = new THREE.Color(0x2e2e30);
  /**
   * 0..1 — the extraction climb sets this: the world's color drains toward
   * slag gray behind the rising pod. The color script running backwards.
   */
  drain = 0;

  constructor(scene: THREE.Scene) {
    this.hemi = new THREE.HemisphereLight(ACTIVE.sky.hemi, ACTIVE.sky.hemiGround, 0.9);
    this.sun = new THREE.DirectionalLight(ACTIVE.sky.sun, 1.4);
    this.sun.position.set(-14, 10, 12);
    this.amb = new THREE.AmbientLight(0x2a2338, 0.3);
    scene.add(this.hemi, this.sun, this.amb);
    this.fog = new THREE.FogExp2(ACTIVE.fogStops[0].fog, 0.005);
    scene.fog = this.fog;
    scene.background = new THREE.Color(ACTIVE.sky.top);
  }

  update(row: number): void {
    const STOPS = ACTIVE.fogStops;
    let i = 0;
    while (i < STOPS.length - 2 && row > STOPS[i + 1].row) i++;
    const s0 = STOPS[i], s1 = STOPS[i + 1];
    const t = Math.min(1, Math.max(0, (row - s0.row) / (s1.row - s0.row)));

    this.a.setHex(s0.fog); this.b.setHex(s1.fog);
    this.fog.color.copy(this.a.lerp(this.b, t));
    this.fog.density = s0.density + (s1.density - s0.density) * t;

    this.hemi.intensity = s0.hemi + (s1.hemi - s0.hemi) * t;
    this.sun.intensity = Math.max(0, 1.4 * (1 - row / 20));

    this.a.setHex(s0.amb); this.b.setHex(s1.amb);
    this.amb.color.copy(this.a.lerp(this.b, t));
    this.amb.intensity = s0.ambI + (s1.ambI - s0.ambI) * t;

    if (this.drain > 0) {
      this.fog.color.lerp(this.ash, this.drain);
      this.amb.color.lerp(this.ash, this.drain * 0.7);
    }

    // the cavity's air: the ambient's hue, most of its saturation, held dark
    const cav = backwallU.uCavity.value.copy(this.amb.color);
    const l = cav.r * LUMW[0] + cav.g * LUMW[1] + cav.b * LUMW[2];
    cav.lerp(this.a.setRGB(l, l, l), 0.2).multiplyScalar(CAVITY_LUM / Math.max(l, 1e-4));
  }
}
