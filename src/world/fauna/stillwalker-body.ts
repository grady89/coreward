import * as THREE from 'three';
import { limb, tmpC } from './types';

// STILLWALKER BODY — the figure itself, separated from the hunt so a review
// stage can pose it without a world.
//
// Built from the reference plates in reference-art/stillwalkers: a gaunt
// thing far too tall, hunched so the head hangs in front of the chest, a
// crown of branching spurs off the skull, arms that reach past the knee and
// end in three claw shards, and legs that bend the wrong way — a heron's
// knee, not a man's. Every piece is a tapered crystalline prism, flat-shaded
// so the pod's lamp glints off facets; the body is near-black obsidian.
//
// Three things read against black rock, and each belongs to a state:
//   - frost: a fresnel rim of pale ice that comes up when it is LIT — the
//     only time it glitters, with motes drifting off it
//   - cracks: hairline fractures glowing cold from inside, on while it HUNTS
//     in the dark — the light that is in it shows through
//   - the gaze: two cold points under the brow and a small blue light on the
//     rock around its head, also hunting only
// Lit, it stands straight and goes dark inside. Unlit, it slouches and walks.

export const WALKER_HEIGHT = 3.2;
const FROST = 0x9ad0ff;
const CRACK = 0x7ab8ff;
const EYE = 0xdff4ff;

export interface WalkerPose {
  gait: number;   // stride phase (radians)
  walk: number;   // 0 frozen upright .. 1 hunting slouch
  lit: number;    // 0..1 frost
  hunt: number;   // 0..1 eyes, cracks, gaze light
  flash: number;  // 0..1 lance hit — hard white on the rim
  flat: boolean;  // wading in rock: a flattened cut-out
  time: number;
}

interface Spike { ox: number; oy: number; oz: number; dx: number; dy: number; dz: number; len: number; thick: number }

// ---- geometry ----

function hash(x: number, y: number, z: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/** a tapered prism, unit length along Y: radius 1 at -Y, `tip` at +Y, facets knocked slightly off true */
function shardGeo(tip: number, sides: number, jitter: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(tip, 1, 1, sides, 1, false);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (Math.hypot(x, z) < 1e-4) continue;
    // seam vertices share a position, so hashing the position keeps them together
    const kx = Math.round(x * 1000), ky = Math.round(y * 1000), kz = Math.round(z * 1000);
    const f = 1 + (hash(kx, ky, kz) - 0.5) * jitter;
    p.setXYZ(i, x * f, y + (hash(kz, kx, ky) - 0.5) * jitter * 0.12, z * f);
  }
  g.computeVertexNormals();
  return g;
}

/** a subset of a shard's facet edges — fractures, not a wireframe */
function crackGeo(geo: THREE.BufferGeometry, keep: number, seed: number): THREE.BufferGeometry {
  const edges = new THREE.EdgesGeometry(geo, 1);
  const src = edges.attributes.position as THREE.BufferAttribute;
  const out: number[] = [];
  for (let i = 0; i < src.count; i += 2) {
    const mx = src.getX(i) + src.getX(i + 1), my = src.getY(i) + src.getY(i + 1), mz = src.getZ(i) + src.getZ(i + 1);
    if (hash(mx * 10 + seed, my * 10, mz * 10) > keep) continue;
    out.push(src.getX(i), src.getY(i), src.getZ(i), src.getX(i + 1), src.getY(i + 1), src.getZ(i + 1));
  }
  edges.dispose();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  return g;
}

const LIMB = shardGeo(0.55, 5, 0.22);
const SPIKE = shardGeo(0.0, 4, 0.3);
const BLADE = shardGeo(0.12, 5, 0.18);
const LIMB_CRACKS = crackGeo(LIMB, 0.34, 1);
const BLADE_CRACKS = crackGeo(BLADE, 0.5, 2);

let haloTex: THREE.CanvasTexture | null = null;
function halo(): THREE.CanvasTexture {
  if (haloTex) return haloTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.08)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  haloTex = new THREE.CanvasTexture(cv);
  return haloTex;
}

// ---- material ----

// One shared program: the frost rim is a fresnel term folded into the
// emissive, driven per walker by uniforms. Flattened in rock every facet
// faces the camera and the fresnel dies, so uFlat blends it to a constant
// sheen and the cut-out still whitens when the lamp finds it.
const frostShader = (shader: THREE.WebGLProgramParametersWithUniforms): void => {
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform float uFrost;\nuniform float uFlat;\nuniform vec3 uFrostColor;')
    .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{
  float ndv = saturate(dot(normalize(vViewPosition), normal));
  float fr = pow(1.0 - ndv, 3.0);
  float rim = mix(fr, 0.16, uFlat);
  totalEmissiveRadiance += uFrostColor * uFrost * (rim * 1.8 + 0.06);
}`);
};

function bodyMaterial(u: { uFrost: THREE.IUniform; uFlat: THREE.IUniform; uFrostColor: THREE.IUniform }): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    color: 0x0e1219, roughness: 0.38, metalness: 0.3, flatShading: true,
    emissive: 0x04070c, emissiveIntensity: 1,
    transparent: true, opacity: 1,
  });
  m.onBeforeCompile = shader => {
    shader.uniforms.uFrost = u.uFrost;
    shader.uniforms.uFlat = u.uFlat;
    shader.uniforms.uFrostColor = u.uFrostColor;
    frostShader(shader);
  };
  m.customProgramCacheKey = () => 'stillwalker-frost';
  return m;
}

// ---- the crown and the back: fixed spur layouts, local to skull / spine ----

const CROWN: Spike[] = [];
{
  const base: [number, number, number, number, number][] = [
    // dx, dy, dz, len, thick — fanned from straight up to back and down
    [0.12, 1.0, 0.0, 0.95, 0.05],
    [-0.4, 0.95, 0.14, 0.85, 0.048],
    [-0.8, 0.6, -0.12, 0.7, 0.045],
    [-1.0, 0.15, 0.08, 0.5, 0.04],
    [0.5, 0.9, -0.16, 0.42, 0.036],
  ];
  const fork = (s: Spike, at: number, a: number, len: number, thick: number): Spike => {
    const bx = s.dx * Math.cos(a) - s.dy * Math.sin(a), by = s.dx * Math.sin(a) + s.dy * Math.cos(a);
    return { ox: s.ox + s.dx * s.len * at, oy: s.oy + s.dy * s.len * at, oz: s.oz + s.dz * s.len * at, dx: bx, dy: by, dz: s.dz * 0.5 + (a > 0 ? 0.25 : -0.25), len, thick };
  };
  for (const [dx, dy, dz, len, thick] of base) {
    const l = Math.hypot(dx, dy, dz);
    const s: Spike = { ox: -0.03, oy: 0.03, oz: 0, dx: dx / l, dy: dy / l, dz: dz / l, len, thick };
    CROWN.push(s);
    // antlers: every spur forks twice, the second tine higher and shorter
    if (len > 0.45) {
      const side = hash(dx, dy, len) > 0.5 ? 1 : -1;
      CROWN.push(fork(s, 0.45, 0.7 * side, len * 0.42, thick * 0.75));
      CROWN.push(fork(s, 0.72, -0.55 * side, len * 0.28, thick * 0.6));
    }
  }
}
const BACK_SPURS: [number, number, number][] = [[0.04, 0.52, 0.055], [0.26, 0.44, 0.05], [0.5, 0.36, 0.045], [0.74, 0.26, 0.04]]; // t along spine, len, thick

// ---- the body ----

export class StillwalkerBody {
  readonly group = new THREE.Group();
  readonly bodyMat: THREE.MeshStandardMaterial;
  private crackMat: THREE.LineBasicMaterial;
  private eyeMat: THREE.MeshBasicMaterial;
  private haloMat: THREE.SpriteMaterial;
  private moteMat: THREE.PointsMaterial;
  private uFrost: THREE.IUniform = { value: 0 };
  private uFlat: THREE.IUniform = { value: 0 };
  private uFrostColor: THREE.IUniform = { value: new THREE.Color(FROST) };

  private head: THREE.Mesh; private brow: THREE.Mesh; private neck: THREE.Mesh;
  private chest: THREE.Mesh; private hump: THREE.Mesh; private pelvis: THREE.Mesh;
  private crown: THREE.Mesh[] = [];
  private backSpurs: THREE.Mesh[] = [];
  private legs: THREE.Mesh[][] = [];   // per side: thigh, shin, foot, kneeSpur
  private arms: THREE.Mesh[][] = [];   // per side: upper, fore, elbowSpur, claw×3
  private eyes: THREE.Mesh[] = [];
  private halos: THREE.Sprite[] = [];
  readonly gaze: THREE.PointLight;
  private motes: THREE.Points;
  private moteSeed: Float32Array;
  private motePos: Float32Array;

  /** where the feet are this frame, local x — for footfall effects */
  footX = [0, 0];
  /** true on the frame a foot plants */
  planted = [false, false];
  private lastPh = [0, 0];

  constructor() {
    this.bodyMat = bodyMaterial({ uFrost: this.uFrost, uFlat: this.uFlat, uFrostColor: this.uFrostColor });
    this.crackMat = new THREE.LineBasicMaterial({ color: CRACK, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const g = this.group;
    const part = (geo: THREE.BufferGeometry, cracks: THREE.BufferGeometry | null): THREE.Mesh => {
      const m = new THREE.Mesh(geo, this.bodyMat);
      if (cracks) m.add(new THREE.LineSegments(cracks, this.crackMat));
      g.add(m);
      return m;
    };
    this.head = part(BLADE, BLADE_CRACKS);
    this.brow = part(LIMB, LIMB_CRACKS);
    this.neck = part(LIMB, null);
    this.chest = part(LIMB, LIMB_CRACKS);
    this.hump = part(LIMB, LIMB_CRACKS);
    this.pelvis = part(LIMB, LIMB_CRACKS);
    for (let i = 0; i < CROWN.length; i++) this.crown.push(part(SPIKE, null));
    for (let i = 0; i < BACK_SPURS.length; i++) this.backSpurs.push(part(SPIKE, null));
    for (let s = 0; s < 2; s++) {
      this.legs.push([part(LIMB, LIMB_CRACKS), part(LIMB, LIMB_CRACKS), part(SPIKE, null), part(SPIKE, null)]);
      this.arms.push([part(LIMB, LIMB_CRACKS), part(LIMB, null), part(SPIKE, null), part(SPIKE, null), part(SPIKE, null), part(SPIKE, null)]);
    }

    // the gaze
    this.eyeMat = new THREE.MeshBasicMaterial({ color: EYE, transparent: true, opacity: 0, toneMapped: false, depthWrite: false });
    this.haloMat = new THREE.SpriteMaterial({ map: halo(), color: 0x9ad0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false });
    const eyeGeo = new THREE.OctahedronGeometry(0.05, 0);
    for (let k = 0; k < 2; k++) {
      const e = new THREE.Mesh(eyeGeo, this.eyeMat);
      e.scale.set(1, 1.4, 1);
      const h = new THREE.Sprite(this.haloMat);
      h.scale.setScalar(0.4);
      g.add(e, h);
      this.eyes.push(e); this.halos.push(h);
    }
    // a small cold light on the rock around its head. Off = intensity 0,
    // never .visible — the culler owns that (see cullLights in main.ts)
    this.gaze = new THREE.PointLight(0x8ac8ff, 0, 5.5, 2);
    g.add(this.gaze);

    // frost motes: a slow snow that only shows when the lamp is on it
    const N = 32;
    this.moteSeed = new Float32Array(N * 4);
    this.motePos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      this.moteSeed[i * 4] = (Math.random() - 0.5) * 1.3;
      this.moteSeed[i * 4 + 1] = Math.random() * 3.4;
      this.moteSeed[i * 4 + 2] = (Math.random() - 0.5) * 0.7;
      this.moteSeed[i * 4 + 3] = Math.random() * Math.PI * 2;
    }
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.BufferAttribute(this.motePos, 3).setUsage(THREE.DynamicDrawUsage));
    this.moteMat = new THREE.PointsMaterial({ color: 0xcfe8ff, map: halo(), size: 0.07, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.motes = new THREE.Points(mg, this.moteMat);
    this.motes.frustumCulled = false;
    g.add(this.motes);
  }

  set(p: WalkerPose): void {
    const H = WALKER_HEIGHT;
    const walk = p.walk;
    const feet = -H / 2;
    const sw = Math.sin(p.gait), cw = Math.cos(p.gait);
    const bob = walk * Math.abs(cw) * 0.05;

    // ---- spine: hips, a chest that leans into the walk, a neck that hangs ----
    const hipX = walk * 0.04, hipY = feet + 1.5 + bob - walk * 0.1;
    const waistX = hipX + walk * 0.06, waistY = hipY + 0.28;
    const neckX = hipX + 0.06 + walk * 0.42, neckY = hipY + 1.06 - walk * 0.16;
    limb(this.pelvis, hipX, hipY - 0.16, 0, waistX, waistY + 0.02, 0, 0.16);
    limb(this.chest, neckX, neckY + 0.06, 0, waistX, waistY - 0.04, 0, 0.24);
    // spine frame for the back spurs
    let ux = neckX - waistX, uy = neckY - waistY;
    const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
    const bx = -uy, by = ux; // "back" — behind the figure
    // the hunch: a heavy shard off the upper back, raked back and down
    const humpL = 0.42 + walk * 0.18;
    limb(this.hump, neckX + bx * 0.04, neckY + by * 0.04 + 0.02, 0, neckX + (bx * 0.72 - ux * 0.7) * humpL, neckY + (by * 0.72 - uy * 0.7) * humpL, 0, 0.2);
    for (let i = 0; i < BACK_SPURS.length; i++) {
      const [t, len, thick] = BACK_SPURS[i];
      const ox = neckX - ux * ul * t - bx * 0.16, oy = neckY - uy * ul * t - by * 0.16;
      let dx = bx * 0.85 + ux * 0.5, dy = by * 0.85 + uy * 0.5;
      const dl = Math.hypot(dx, dy); dx /= dl; dy /= dl;
      limb(this.backSpurs[i], ox, oy, (i % 2 ? 0.06 : -0.06), ox + dx * len, oy + dy * len, (i % 2 ? 0.1 : -0.1), thick);
    }

    // ---- head: hangs forward of the chest, pitched down as it walks ----
    const pitch = 0.3 + walk * 0.45;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    // local head frame (x forward, y up) rotated forward by pitch
    const fx = cp, fy = -sp;        // forward → forward-down
    const dnx = -sp, dny = -cp;     // down → down-back (the chin tucks)
    const skullX = neckX + 0.1 + walk * 0.22, skullY = neckY + 0.3 - walk * 0.26;
    limb(this.neck, neckX, neckY, 0, skullX - fx * 0.04, skullY - fy * 0.04 - 0.06, 0, 0.085);
    limb(this.head, skullX, skullY, 0, skullX + dnx * 0.58, skullY + dny * 0.58, 0, 0.24);
    limb(this.brow, skullX - fx * 0.08 + dnx * 0.08, skullY - fy * 0.08 + dny * 0.08, 0, skullX + fx * 0.17 + dnx * 0.14, skullY + fy * 0.17 + dny * 0.14, 0, 0.16);
    for (let i = 0; i < CROWN.length; i++) {
      const s = CROWN[i];
      // rotate the spur's local (x fwd, y up) into the pitched head frame
      const rox = skullX + fx * s.ox - dnx * s.oy, roy = skullY + fy * s.ox - dny * s.oy;
      const rdx = fx * s.dx - dnx * s.dy, rdy = fy * s.dx - dny * s.dy;
      limb(this.crown[i], rox, roy, s.oz, rox + rdx * s.len, roy + rdy * s.len, s.oz + s.dz * s.len, s.thick);
    }
    // the gaze sits under the brow, either side of the blade
    const ex = skullX + fx * 0.13 + dnx * 0.2, ey = skullY + fy * 0.13 + dny * 0.2;
    for (let k = 0; k < 2; k++) {
      const z = k === 0 ? 0.1 : -0.1;
      this.eyes[k].position.set(ex, ey, z);
      this.halos[k].position.set(ex + 0.02, ey, z);
    }
    this.gaze.position.set(ex + 0.1, ey, 0.5);

    // ---- legs: hip → knee (forward) → ankle (back) → toe. A heron's leg. ----
    const stride = 0.62;
    for (let s = 0; s < 2; s++) {
      const sign = s === 0 ? 1 : -1;
      const ph = sign * sw;
      const lift = walk * Math.max(0, sign * cw) * 0.36;
      const hz = sign * 0.11;
      const footX = hipX + ph * stride * walk + sign * 0.07 * (1 - walk);
      const footY = feet + lift * 0.55;
      const bend = 0.3 + walk * 0.7;
      const kx = hipX + (footX - hipX) * 0.42 + 0.24 * bend + lift * 0.35, ky = hipY + (footY - hipY) * 0.42 + 0.06;
      const ax = hipX + (footX - hipX) * 0.8 - 0.2 * bend + lift * 0.1, ay = hipY + (footY - hipY) * 0.8 - 0.04;
      const L = this.legs[s];
      limb(L[0], hipX, hipY, hz, kx, ky, hz, 0.13);
      limb(L[1], kx, ky, hz, ax, ay, hz, 0.085);
      limb(L[2], ax, ay, hz, footX + 0.34, footY, hz, 0.062);
      limb(L[3], kx + 0.04, ky + 0.02, hz, kx + 0.22, ky + 0.14, hz, 0.045);
      this.footX[s] = footX + 0.2;
      // a plant is the swing foot arriving: its phase crosses from lifting to bearing
      const bearing = sign * cw < 0;
      this.planted[s] = walk > 0.5 && bearing && this.lastPh[s] === 0;
      this.lastPh[s] = bearing ? 1 : 0;
    }

    // ---- arms: hang past the knee, swing a beat late, end in three claws ----
    const sw2 = Math.sin(p.gait - 0.7) * walk;
    for (let s = 0; s < 2; s++) {
      const sign = s === 0 ? -1 : 1;
      const ph = sign * sw2;
      const sz = (s === 0 ? 1 : -1) * 0.24;
      const shX = neckX - 0.06, shY = neckY - 0.02;
      const elX = shX - 0.14 + ph * 0.2, elY = shY - 0.64, elZ = sz * 1.15;
      const wrX = elX + 0.12 + ph * 0.34 + walk * 0.06, wrY = elY - 0.72, wrZ = sz * 1.05;
      const A = this.arms[s];
      limb(A[0], shX, shY, sz, elX, elY, elZ, 0.1);
      limb(A[1], elX, elY, elZ, wrX, wrY, wrZ, 0.07);
      limb(A[2], elX - 0.02, elY + 0.02, elZ, elX - 0.2, elY + 0.1, elZ, 0.04);
      for (let k = 0; k < 3; k++) {
        const f = k - 1;
        limb(A[3 + k], wrX, wrY, wrZ, wrX + 0.12 + f * 0.11 + ph * 0.06, wrY - 0.36 + Math.abs(f) * 0.06, wrZ + f * 0.05, 0.028);
      }
    }

    // ---- surface states ----
    const lit = p.lit, hunt = p.hunt, flash = p.flash;
    this.uFrost.value = 0.12 + lit * 0.78 + flash * 1.0 + (lit > 0.5 ? Math.sin(p.time * 9) * 0.05 : Math.sin(p.time * 2.6) * 0.04);
    this.uFlat.value = p.flat ? 1 : 0;
    (this.uFrostColor.value as THREE.Color).setHex(FROST);
    if (flash > 0) (this.uFrostColor.value as THREE.Color).lerp(tmpC.setHex(0xffffff), flash);
    this.bodyMat.opacity = p.flat ? 0.76 : 1;
    // fractures glow while it hunts, and flare white under the lance
    this.crackMat.opacity = 0.04 + hunt * (0.5 + Math.sin(p.time * 5.5 + p.gait) * 0.08) + flash * 0.35;
    this.crackMat.color.setHex(CRACK);
    if (flash > 0) this.crackMat.color.lerp(tmpC.setHex(0xffffff), flash);
    const gazeI = hunt * (0.8 + Math.sin(p.time * 7 + p.gait) * 0.12);
    this.eyeMat.opacity = gazeI;
    this.haloMat.opacity = gazeI * 0.55;
    this.gaze.intensity = hunt * 2.6;
    // motes: fall slowly through the figure's own outline, only while lit
    const N = this.moteSeed.length / 4;
    for (let i = 0; i < N; i++) {
      const sx = this.moteSeed[i * 4], sy = this.moteSeed[i * 4 + 1], sz = this.moteSeed[i * 4 + 2], phz = this.moteSeed[i * 4 + 3];
      const y = feet + ((sy - p.time * 0.22 + phz) % 3.4 + 3.4) % 3.4;
      this.motePos[i * 3] = sx * 0.55 + Math.sin(p.time * 0.9 + phz) * 0.1 + walk * 0.15;
      this.motePos[i * 3 + 1] = y;
      this.motePos[i * 3 + 2] = sz * 0.5 + 0.12;
    }
    (this.motes.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    this.moteMat.opacity = Math.max(0, lit - 0.3) * 0.8 + flash * 0.5;
  }
}
