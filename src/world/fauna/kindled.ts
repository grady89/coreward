import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CORE_ROW } from '../../config';
import { hdrBasic } from '../../fx/post';
import { ACTIVE } from '../worlds';
import { clamp01, lerp, Spill, tmpC } from './types';

// THE KINDLED — the core chamber's own. Every world.
//
// Four figures on the chamber floor, made of the same light as the core.
// Not solid: a shell of ember facets around a white-hot heart, a pocket of
// dark around it in the bright room, shedding a shimmer of motes in the
// shape of someone leaning in, reaching. They face the
// fragment. When you enter they turn, and drift toward you, and stop two
// steps short, and wait. They do not chase. They do not need to.
//
// On foot they give ground as you come, keeping their two steps exactly —
// until the wall is at their back. Corner one and the suit's oxygen is
// simply gone: blackout, wake in the pod. Fly the pod into one and it
// throws you clear, unhurt — they keep the light company; they do not
// fight for it. When the fragment is gone, so are they.

const N = 4;
const PTS = 96;
const FLOOR_Y = -(CORE_ROW + 10);
const POSTS = [22.5, 26, 38, 41.5];
const NOTICE = 8;
const STOP = 2.2;
const YIELD = 1.5;
// the chamber floor runs x = 18..46 (terrain.ts): where a yielding figure runs out of room
const WALL_L = 18.7;
const WALL_R = 45.3;

export type KindledHit = 'suit' | 'pod' | null;

interface Figure {
  x: number; y: number;
  homeX: number;
  face: number;
  seed: Float32Array;   // rest positions (local)
  points: THREE.Points;
  pos: Float32Array;
  core: THREE.Mesh;
  /** the white-gold heart in the darker shell, flickering on its own beat */
  heart: THREE.Mesh;
  heartMat: THREE.MeshBasicMaterial;
  light: THREE.PointLight;
  /** a pocket of dark behind it, so its own light is what you see */
  shade: Shade;
  /** its light pooled on the chamber floor */
  spill: Spill;
  arousal: number;      // 0..1 how much it has noticed you
  touchCd: number;
}

export class Kindled {
  private figs: Figure[] = [];
  private mat: THREE.PointsMaterial;
  private coreMat: THREE.MeshBasicMaterial;
  private fade = 1;
  private seenFired = false;
  /** 0..1 — the nearest figure's attention on you */
  presence = 0;
  /** where the figure that last touched you stands, so the throw is away from it */
  touchX = 0;

  constructor(scene: THREE.Scene) {
    this.mat = new THREE.PointsMaterial({
      color: 0xffffff, size: 0.075, transparent: true, opacity: 0.85, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false,
    });
    const coreGeo = figureGeometry();
    const heartGeo = new THREE.OctahedronGeometry(0.1, 0);
    heartGeo.scale(0.85, 1.2, 0.7);
    // self-lit, the facets baked into vertex colours: a dark ember shell in
    // the core's deep hue, lit from inside by the heart and fading to char at
    // the hands and feet; edge-on facets catch a gold rim so the outline
    // holds against the chamber. The heart is its own mesh
    // unfogged: the chamber's haze would wash the shell to the room's tan
    this.coreMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: false });
    this.coreMat.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vKPos;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvKPos = mvPosition.xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vKPos;')
        .replace('#include <color_fragment>', `#include <color_fragment>
{
  // the facet's own normal from screen derivatives: a facet turned edge-on
  // to the eye burns white, one facing it stays gold
  vec3 fn = normalize( cross( dFdx( vKPos ), dFdy( vKPos ) ) );
  float rim = pow( 1.0 - abs( dot( fn, normalize( -vKPos ) ) ), 4.0 );
  diffuseColor.rgb += vec3( 1.0, 0.7, 0.34 ) * rim * 1.6;
}`);
    };
    this.coreMat.customProgramCacheKey = () => 'kindled-facets';
    hdrBasic(this.coreMat, 1.3);
    const coreMat = this.coreMat;
    for (let i = 0; i < N; i++) {
      const seed = moteSeeds();
      const pos = new Float32Array(PTS * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
      const points = new THREE.Points(geo, this.mat);
      points.frustumCulled = false;
      const core = new THREE.Mesh(coreGeo, coreMat);
      // its own material, so each heart flickers on its own beat
      const heartMat = new THREE.MeshBasicMaterial({ color: 0xfff2d0, toneMapped: false, fog: false });
      hdrBasic(heartMat, 2.4);
      const heart = new THREE.Mesh(heartGeo, heartMat);
      heart.position.set(HEART.x, HEART.y, HEART.z);
      core.add(heart);
      const light = new THREE.PointLight(0xffffff, 1.6, 5, 1.8);
      scene.add(points, core, light);
      this.figs.push({
        x: POSTS[i], y: FLOOR_Y + 0.55, homeX: POSTS[i], face: POSTS[i] < 32 ? 1 : -1,
        seed, points, pos, core, heart, heartMat, light, shade: new Shade(scene),
        spill: new Spill(scene, 0xfff0c8), arousal: 0, touchCd: 0,
      });
    }
    this.setVisible(false);
  }

  private setVisible(v: boolean): void {
    // the lights never leave the light state — toggling one recompiles every
    // shader in the world. Dark means intensity 0; update() re-drives it.
    for (const f of this.figs) {
      f.points.visible = v; f.core.visible = v;
      if (!v) { f.light.intensity = 0; f.spill.off(); f.shade.off(); }
    }
  }

  reset(): void {
    for (const f of this.figs) { f.x = f.homeX; f.arousal = 0; f.touchCd = 0; }
    this.seenFired = false;
    this.presence = 0;
  }

  /**
   * Called from both the pod frame and the EVA frame with whoever is in the
   * chamber. `gone` = the fragment is taken; `rite` = the Communion is on
   * and the figures stand back and watch.
   */
  update(dt: number, time: number, x: number, y: number, eva: boolean, gone: boolean, rite: boolean, onSeen: () => void): KindledHit {
    const inChamber = y < -(CORE_ROW - 18);
    this.fade += (((gone || !inChamber) ? 0 : 1) - this.fade) * Math.min(1, dt * 1.5);
    if (this.fade < 0.02) { this.setVisible(false); this.presence = 0; return null; }
    this.setVisible(true);
    this.mat.color.setHex(ACTIVE.core.light);
    this.mat.opacity = 0.85 * this.fade;
    // the shell in the core's deep hue: darker than the chamber's glow, so
    // the white-gold heart and edges read inside it
    this.coreMat.color.setHex(ACTIVE.core.shell).lerp(tmpC.setHex(ACTIVE.core.body), 0.1);

    let hit: KindledHit = null;
    let presence = 0;
    for (let i = 0; i < N; i++) {
      const f = this.figs[i];
      const dx = x - f.x, dy = y - f.y;
      const dist = Math.hypot(dx, dy);
      const noticing = !rite && dist < NOTICE;
      f.arousal += ((noticing ? 1 : 0) - f.arousal) * Math.min(1, dt * 1.2);
      presence = Math.max(presence, f.arousal * clamp01(1 - dist / NOTICE));
      f.touchCd = Math.max(0, f.touchCd - dt);
      let cornered = false;
      if (noticing) {
        if (eva && dist < YIELD) {
          // on foot they give ground — a step faster than you can walk,
          // keeping the distance exact — until the wall is at their back.
          // Only a cornered one reaches for you.
          const nx = f.x - Math.sign(dx || 1) * 4.2 * dt;
          if (nx > WALL_L && nx < WALL_R) f.x = nx;
          else cornered = true;
        } else if (dist > STOP) {
          // drift toward you, stop two steps short
          f.x += Math.sign(dx) * Math.min(Math.abs(dx), 0.9 * f.arousal * dt);
        }
        f.face = dx > 0 ? 1 : -1;
        if (!this.seenFired) { this.seenFired = true; onSeen(); }
        if ((eva ? cornered && dist < 0.75 : dist < 1.0) && f.touchCd <= 0) {
          f.touchCd = 1.4;
          this.touchX = f.x;
          hit = eva ? 'suit' : 'pod';
        }
      } else {
        // home, and turned to the fragment
        f.x += (f.homeX - f.x) * Math.min(1, dt * 0.4);
        f.face = f.homeX < 32 ? 1 : -1;
      }
      const bob = Math.sin(time * 0.9 + i * 1.7) * 0.04;
      const fy = FLOOR_Y + 0.55 + bob;
      // it leans further in the more it is looking at you, pivoting at the feet
      const lean = -(0.03 + f.arousal * 0.09) * f.face;
      const lc = Math.cos(lean), ls = Math.sin(lean);
      // motes shimmer harder the more it is looking at you
      const shimmer = 0.012 + f.arousal * 0.03;
      for (let k = 0; k < PTS; k++) {
        const sx = f.seed[k * 3] * f.face, sy = f.seed[k * 3 + 1] - FOOT, sz = f.seed[k * 3 + 2];
        const j = Math.sin(time * 7 + k * 1.3) * shimmer;
        const j2 = Math.cos(time * 5.3 + k * 0.7) * shimmer;
        f.pos[k * 3] = f.x + sx * lc - sy * ls + j;
        f.pos[k * 3 + 1] = fy + FOOT + sx * ls + sy * lc + j2;
        f.pos[k * 3 + 2] = 0.2 + sz;
      }
      (f.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      f.core.position.set(f.x - FOOT * ls, fy + FOOT - FOOT * lc, 0.2);
      f.core.rotation.z = lean;
      f.core.scale.set(this.fade * f.face, this.fade, this.fade);
      // the heart gutters like a flame: two beats that never line up
      const gutter = 0.5 + 0.3 * Math.sin(time * 11 + i * 2.3) + 0.2 * Math.sin(time * 17.3 + i * 5.1);
      const heat = 0.75 + f.arousal * 0.3 + gutter * 0.35;
      f.heartMat.color.setHex(0xfff2d0).multiplyScalar(heat);
      f.heart.scale.setScalar(0.9 + gutter * 0.25 + f.arousal * 0.15);
      f.light.position.set(f.x + 0.2 * f.face, fy + 0.4, 0.8);
      f.light.color.setHex(ACTIVE.core.body);
      f.light.intensity = (2.0 + f.arousal * 2.6 + gutter * 0.9) * this.fade;
      // pooled under the feet, not over the legs: the spill draws in front
      f.spill.set(f.x, fy - 0.98, 3.4, 1.4, (0.28 + f.arousal * 0.14 + (gutter - 0.5) * 0.1) * this.fade, ACTIVE.core.body, 1.1);
      f.shade.set(f.x + 0.15 * f.face, fy + 0.35, 2.6, 2.7, (0.6 + f.arousal * 0.2) * this.fade);
    }
    this.presence = lerp(this.presence, presence, Math.min(1, dt * 3));
    return hit;
  }
}

// ---- the pose: a figure caught mid-step toward you, leaning in, both arms
// reaching. Modelled facing +x in profile, then turned three-quarters to the
// camera so neither arm hides behind the body. Feet at FOOT.
const FOOT = -0.52;
const TURN = -0.6;
type Seg = [ax: number, ay: number, az: number, bx: number, by: number, bz: number, r0: number, r1: number];
const SEGS: Seg[] = [
  // torso: hips to shoulders, pitched forward
  [0, 0.1, 0, 0.24, 0.6, 0, 0.1, 0.17],
  // legs: the front one striding out, the back one trailing
  [0.03, 0.08, 0.06, 0.2, FOOT, 0.06, 0.075, 0.045],
  [-0.03, 0.08, -0.06, -0.2, FOOT + 0.02, -0.06, 0.075, 0.045],
  // arms from the shoulder, out toward you: near arm low, far arm high
  [0.2, 0.55, 0.13, 0.66, 0.42, 0.13, 0.06, 0.035],
  [0.2, 0.57, -0.13, 0.64, 0.7, -0.13, 0.06, 0.035],
];
/** the head, jutting ahead of the shoulders */
const HEAD = new THREE.Vector3(0.38, 0.74, 0);
/** the heart, at the chest, set proud toward the camera after the turn */
const HEART = new THREE.Vector3(0.14, 0.42, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), TURN).setZ(0.26);

/** a tapered limb between two points, as a few hard facets */
function seg([ax, ay, az, bx, by, bz, r0, r1]: Seg, sides = 5, rows = 1): THREE.BufferGeometry {
  const a = new THREE.Vector3(ax, ay, az), b = new THREE.Vector3(bx, by, bz);
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r1, r0, len, sides, rows);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
  g.translate((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
  return g;
}

/** the mote cloud follows the same pose, a little wider, so it reads as aura */
function moteSeeds(): Float32Array {
  const out = new Float32Array(PTS * 3);
  const v = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  for (let k = 0; k < PTS; k++) {
    const r = Math.random();
    if (r < 0.14) {
      v.randomDirection().multiplyScalar(0.15 * Math.cbrt(Math.random())).add(HEAD);
    } else {
      // torso gets the most, then legs, then the reaching arms
      const s = r < 0.45 ? SEGS[0] : r < 0.72 ? SEGS[1 + (k & 1)] : SEGS[3 + (k & 1)];
      const t = Math.random();
      const rad = (s[6] + (s[7] - s[6]) * t) * 1.3;
      v.set(s[0] + (s[3] - s[0]) * t, s[1] + (s[4] - s[1]) * t, s[2] + (s[5] - s[2]) * t);
      v.x += (Math.random() - 0.5) * rad * 2; v.y += (Math.random() - 0.5) * rad; v.z += (Math.random() - 0.5) * rad;
    }
    v.applyAxisAngle(up, TURN);
    out[k * 3] = v.x; out[k * 3 + 1] = v.y; out[k * 3 + 2] = v.z;
  }
  return out;
}

/**
 * The figure in a dozen facets — a forward-pitched torso, a head thrust
 * ahead of it, a striding pair of legs and two arms reaching out with
 * talon-tipped hands. Each facet's brightness is baked into its vertex
 * colour from a fixed key light, so an unlit body still reads as faceted.
 */
function figureGeometry(): THREE.BufferGeometry {
  const clean = (g: THREE.BufferGeometry): THREE.BufferGeometry => {
    const n = g.index ? g.toNonIndexed() : g;
    n.deleteAttribute('uv');
    n.deleteAttribute('normal');
    return n;
  };
  const head = new THREE.IcosahedronGeometry(0.12, 0);
  head.scale(1.25, 0.95, 0.95);
  head.rotateZ(-0.35);
  head.translate(HEAD.x, HEAD.y, HEAD.z);
  const hips = new THREE.OctahedronGeometry(0.1, 0).scale(1.1, 0.8, 0.8);
  hips.translate(0, 0.1, 0);
  // the torso in three courses, so the heart's glow can grade across it
  const parts = [head, hips, seg(SEGS[0], 6, 3), ...SEGS.slice(1).map(s => seg(s))];
  // talons: a hooked spike off each reaching hand
  for (const s of [SEGS[3], SEGS[4]]) {
    const dx = s[3] - s[0], dy = s[4] - s[1];
    const a = Math.atan2(dy, dx) - 0.35;
    parts.push(seg([s[3], s[4], s[5], s[3] + Math.cos(a) * 0.17, s[4] + Math.sin(a) * 0.17, s[5], 0.035, 0.004], 4));
  }
  const all = mergeGeometries(parts.map(clean))!;
  all.rotateY(TURN);
  all.computeVertexNormals();
  const nrm = all.getAttribute('normal');
  const col = new Float32Array(nrm.count * 3);
  const key = new THREE.Vector3(0.5, 0.6, 0.65).normalize();
  const v = new THREE.Vector3(), p = new THREE.Vector3();
  const chest = new THREE.Vector3(0.14, 0.42, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), TURN);
  const posA = all.getAttribute('position');
  for (let i = 0; i < nrm.count; i++) {
    v.fromBufferAttribute(nrm, i);
    p.fromBufferAttribute(posA, i);
    // a dark ember shell with a spread across facets, glowing through from
    // the heart (linear values: they display far brighter than they read)
    const inner = Math.exp(-p.distanceToSquared(chest) / 0.06);
    const b = 0.008 + 0.05 * Math.max(0, v.dot(key)) + 1.1 * inner;
    col[i * 3] = b; col[i * 3 + 1] = b; col[i * 3 + 2] = b;
  }
  all.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return all;
}

let shadeTex: THREE.CanvasTexture | null = null;
/**
 * A soft pocket of dark set behind a figure, behind the floor's front faces
 * so the floor keeps its light pool: in a chamber already full of light,
 * the figure's own light only reads if the wall right behind it is dimmer.
 */
class Shade {
  private mat: THREE.MeshBasicMaterial;
  private mesh: THREE.Mesh;
  constructor(scene: THREE.Scene) {
    if (!shadeTex) {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 64;
      const g = cv.getContext('2d')!;
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(0.45, 'rgba(0,0,0,0.8)');
      grad.addColorStop(0.75, 'rgba(0,0,0,0.3)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      shadeTex = new THREE.CanvasTexture(cv);
    }
    this.mat = new THREE.MeshBasicMaterial({
      map: shadeTex, color: 0x000000, transparent: true, opacity: 0, depthWrite: false, fog: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.mat);
    this.mesh.position.z = -0.3;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }
  set(x: number, y: number, w: number, h: number, a: number): void {
    this.mesh.position.x = x; this.mesh.position.y = y;
    this.mesh.scale.set(w, h, 1);
    this.mat.opacity = a;
    this.mesh.visible = a > 0.004;
  }
  off(): void { this.mat.opacity = 0; this.mesh.visible = false; }
}
