import * as THREE from 'three';
import { WORLD_W, WORLD_ROWS, CORE_ROW, PAD_X0, PAD_X1 } from '../config';
import { backwallColor } from './tiles';
import { ACTIVE } from './worlds';
import { STRUCTURE_BUILDERS } from './structures';

// Backwall, sky, surface rig set-dressing, the Ember, and depth-graded atmosphere.

// ---------- backwall: carved-cave interior behind the tile field ----------
export function createBackwall(scene: THREE.Scene): void {
  const EXTRA = 30; // rows past the world bottom so the camera never sees void
  const cv = document.createElement('canvas');
  cv.width = WORLD_W; cv.height = WORLD_ROWS + EXTRA;
  const g = cv.getContext('2d')!;
  for (let y = 0; y < WORLD_ROWS + EXTRA; y++) {
    for (let x = 0; x < WORLD_W; x++) {
      g.fillStyle = backwallColor(x, Math.min(y, WORLD_ROWS - 1));
      g.fillRect(x, y, 1, 1);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_W, WORLD_ROWS + 30),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 1 })
  );
  // extra height so the camera never sees past the world's bottom edge
  mesh.position.set(WORLD_W / 2, -(WORLD_ROWS + 30) / 2, -0.62);
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

function createSkyline(scene: THREE.Scene): void {
  // flat painterly silhouettes: unlit, hazed toward the sky by distance
  const near = new THREE.MeshBasicMaterial({ color: 0x342647, toneMapped: false });
  const far = new THREE.MeshBasicMaterial({ color: 0x453454, toneMapped: false });
  const winMat = new THREE.MeshBasicMaterial({ color: 0xffb066, toneMapped: false });
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
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xff4d29, toneMapped: false }));
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
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xff4d29, toneMapped: false }));
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
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff4d29, toneMapped: false })
    );
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

export function createEmber(scene: THREE.Scene): Ember {
  const x = WORLD_W / 2, y = -(CORE_ROW + 5);
  const group = new THREE.Group();
  // the burning heart spins; halo, ring and shaft stay world-oriented
  const spin = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(2.6, 1),
    new THREE.MeshBasicMaterial({ color: ACTIVE.core.body, toneMapped: false })
  );
  const shell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(3.3, 1),
    new THREE.MeshBasicMaterial({
      color: ACTIVE.core.shell, transparent: true, opacity: 0.3,
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

  group.add(spin, light, halo, shards, shaft);
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
      (halo.material as THREE.SpriteMaterial).opacity = 0.3 + pulse * 0.08 + ex * 0.35;
      (shaft.material as THREE.MeshBasicMaterial).opacity = 0.1 + ex * 0.3;

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
  }
}
