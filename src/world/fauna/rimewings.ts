import * as THREE from 'three';
import { Terrain } from '../terrain';
import { ACTIVE } from '../worlds';
import { Particles } from '../../fx/particles';
import { hdrEmissive } from '../../fx/post';
import { FlareField } from './flares';
import { Creature, ThreatCtx, ThreatLevel, air, onWall, tmpM, tmpP, tmpQ, tmpS, tmpC, tmpC2, Spill } from './types';

// RIMEWINGS — CRYOS-2's swarm tier. Keyed on HEAT.
//
// A constellation of ice hanging in the dark, absolutely still — that is the
// unsettling part; nothing else down here holds that still. Your thruster
// wash reaches them and they shiver, shed frost, crack loose one by one and
// come for the nozzle with a moth's dart-and-hang flight. Cut thrust and
// drift: they slow, sink, and lock again wherever they were. The tunnels you
// burned through fill with new clusters behind you.

const MAX_WINGS = 40;
const CLUSTER_MIN = 7;
const CLUSTER_MAX = 12;
const MAX_CLUSTERS = 3;
const WAKE_RANGE = 7.5;
const FLARE_PULL = WAKE_RANGE * 2;  // a flare only exists within ~2× wake range
const SCATTER = 2;         // seconds a lanced wing tumbles dark
const BAND_LO = 120;
const BAND_HI = 470;
const SHIVER = 1.3;        // seconds from first warmth to flight
const COLD_CALM = 2.4;     // seconds of cold engine before they settle
const SETTLE = 1.8;        // seconds of sinking before they lock
// flap about the body's own axis first, then turn to the heading
const pose = new THREE.Euler(0, 0, 0, 'ZYX');
/** the swarm's own cold light: ice-cyan, off the lamp's white */
const ICE = 0x5ad6ff;

type Phase = 'frozen' | 'waking' | 'hunting' | 'settling';

interface Wing {
  x: number; y: number;
  vx: number; vy: number;
  rot: number;          // frozen orientation
  dartT: number;        // moth flight: time until the next dart
  phase: number;
  freeAt: number;       // wake offset — they do not all come loose together
  stunT: number;        // seconds of lance-daze left — flung, dim, harmless
  cluster: number;
}

interface Cluster {
  alive: boolean;
  phase: Phase;
  t: number;            // time in phase
  coldFor: number;
  ax: number; ay: number;
  life: number;
  dazedT: number;       // lanced: warmth means nothing to it for a beat
  woke: boolean;
}

export class Rimewings implements Creature {
  menace = 0;
  spawnTimer = 0;
  readonly wings: Wing[] = [];
  readonly clusters: Cluster[] = [];
  private mesh: THREE.InstancedMesh;
  private glow: THREE.PointLight;
  /** each cluster's cold light on the rock it hangs against */
  private spills: Spill[] = [];
  private sumX = new Float32Array(MAX_CLUSTERS);
  private sumY = new Float32Array(MAX_CLUSTERS);
  private sumN = new Float32Array(MAX_CLUSTERS);
  private sumHeat = new Float32Array(MAX_CLUSTERS);

  constructor(scene: THREE.Scene, private terrain: Terrain, private flares: FlareField, private particles: Particles) {
    // an ice moth: a chunky body, two mirrored faceted wings, a bright eye.
    // A per-face `glow` attribute marks what burns (eye, core, leading edges)
    const geo = mothGeometry();
    const mat = new THREE.MeshStandardMaterial({
      flatShading: true, roughness: 0.15, metalness: 0.1,
      transparent: true, opacity: 0.9, side: THREE.DoubleSide,
      emissive: 0xa0ecff, emissiveIntensity: 0.55,
    });
    const ice = { value: new THREE.Color(0x8ae8ff) };
    // instance colour drives the emissive, so a woken wing glows from inside;
    // the eye and the leading edges keep a cold ember even frozen
    mat.onBeforeCompile = sh => {
      sh.uniforms.uIce = ice;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float glow;\nvarying float vGlow;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uIce;\nvarying float vGlow;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance *= vColor.rgb * vGlow;
totalEmissiveRadiance += uIce * (max(vGlow - 2.0, 0.0) * 0.9 + max(vGlow - 1.0, 0.0) * 0.35 + vGlow * 0.1);`);
    };
    mat.customProgramCacheKey = () => 'rimewing-glow';
    // the edge strips and the eye run past white: they bloom, the glass doesn't
    hdrEmissive(mat, 0.35, 1.3);
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX_WINGS);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.setColorAt(0, tmpC.setHex(0xffffff));
    scene.add(this.mesh);
    this.glow = new THREE.PointLight(0xbfe0ff, 0, 8, 1.8);
    scene.add(this.glow);
    for (let i = 0; i < MAX_CLUSTERS; i++) {
      this.clusters.push({ alive: false, phase: 'frozen', t: 0, coldFor: 0, ax: 0, ay: 0, life: 0, dazedT: 0, woke: false });
      this.spills.push(new Spill(scene, 0xbfe0ff));
    }
  }

  get count(): number { return this.mesh.count; }

  reset(): void {
    this.wings.length = 0;
    for (const c of this.clusters) c.alive = false;
    this.mesh.count = 0;
    this.glow.intensity = 0;
    for (const sp of this.spills) sp.off();
    this.menace = 0;
  }

  private trySpawn(podX: number, podY: number, level: ThreatLevel): void {
    const slot = this.clusters.findIndex(c => !c.alive);
    if (slot < 0) return;
    for (let attempt = 0; attempt < 30; attempt++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 9 + Math.random() * 8;
      const x = Math.round(podX + Math.cos(ang) * dist);
      const y = Math.round(-podY + Math.sin(ang) * dist);
      if (y < 60 || x < 1 || x >= this.terrain.w - 1) continue;
      if (!onWall(this.terrain, x, y)) continue;
      const c = this.clusters[slot];
      c.alive = true; c.phase = 'frozen'; c.t = 0; c.coldFor = 0; c.life = 0; c.dazedT = 0; c.woke = false;
      c.ax = x + 0.5; c.ay = -(y + 0.5);
      const n = CLUSTER_MIN + Math.floor(Math.random() * (CLUSTER_MAX - CLUSTER_MIN + 1));
      const want = level === 'reduced' ? Math.ceil(n / 2) : n;
      for (let i = 0; i < want && this.wings.length < MAX_WINGS; i++) {
        // hang them through the pocket, biased toward the wall they froze against
        let wx = c.ax, wy = c.ay;
        for (let k = 0; k < 6; k++) {
          const tx = c.ax + (Math.random() - 0.5) * 2.6;
          const ty = c.ay + (Math.random() - 0.5) * 2.6;
          if (air(this.terrain, Math.floor(tx), Math.floor(-ty))) { wx = tx; wy = ty; break; }
        }
        this.wings.push({
          x: wx, y: wy, vx: 0, vy: 0,
          rot: Math.random() * Math.PI * 2, dartT: 0,
          phase: Math.random() * Math.PI * 2,
          freeAt: 0.3 + Math.random() * 0.9,
          stunT: 0,
          cluster: slot,
        });
      }
      return;
    }
  }

  private despawn(slot: number): void {
    this.clusters[slot].alive = false;
    for (let i = this.wings.length - 1; i >= 0; i--) {
      if (this.wings[i].cluster === slot) this.wings.splice(i, 1);
    }
  }

  drillHit(x: number, y: number): void {
    for (let i = this.wings.length - 1; i >= 0; i--) {
      const w = this.wings[i];
      if (Math.hypot(w.x - x, w.y - y) < 0.85) {
        this.particles.sparkBurst(w.x, w.y, 0xbfe8ff, { count: 4, speed: 2, life: 0.4, gravity: 6 });
        this.wings.splice(i, 1);
      }
    }
  }

  blast(x: number, y: number, radius: number): void {
    for (let i = this.wings.length - 1; i >= 0; i--) {
      const w = this.wings[i];
      if (Math.hypot(w.x - x, w.y - y) < radius) this.wings.splice(i, 1);
    }
  }

  // Scatter, not delete: wings in the corridor are flung off the beam line,
  // dazed dark for a beat, and the cluster drops out of the hunt to settle
  // wherever it was knocked. The lance stays a light verb — nothing dies.
  lance(x: number, y: number, dir: number, range: number): void {
    for (let ci = 0; ci < this.clusters.length; ci++) {
      const c = this.clusters[ci];
      if (!c.alive) continue;
      let hit = 0;
      for (const w of this.wings) {
        if (w.cluster !== ci) continue;
        const dx = (w.x - x) * dir;
        if (dx <= -0.5 || dx >= range || Math.abs(w.y - y) > 1.3) continue;
        const side = w.y >= y ? 1 : -1;
        w.vx = dir * (3 + Math.random() * 3);
        w.vy = side * (8 + Math.random() * 4);
        w.stunT = SCATTER;
        this.particles.sparkBurst(w.x, w.y, 0xbfe8ff, { count: 3, speed: 2, life: 0.4, gravity: 6 });
        hit++;
      }
      if (!hit) continue;
      c.phase = 'settling'; c.t = 0; c.coldFor = 0; c.dazedT = SCATTER;
      const away = Math.sign(c.ax - x) || dir;
      for (let step = 5; step >= 2; step--) {
        const nx = c.ax + away * step;
        if (air(this.terrain, Math.floor(nx), Math.floor(-c.ay))) { c.ax = nx; break; }
      }
    }
  }

  devStage(x: number, y: number): void {
    if (this.clusters.some(c => c.alive)) return;
    this.trySpawn(x, y, 'full');
    // pull the constellation into thruster range: the whole creature is the
    // moment the wash reaches it, and at 9+ tiles that never happens
    const slot = this.clusters.findIndex(c => c.alive);
    if (slot < 0) return;
    const c = this.clusters[slot];
    const ox = c.ax, oy = c.ay;
    c.ax = x + 4.5; c.ay = y + 1.5;
    for (const w of this.wings) {
      if (w.cluster !== slot) continue;
      w.x += c.ax - ox; w.y += c.ay - oy;
    }
  }

  update(ctx: ThreatCtx, level: ThreatLevel): void {
    const { dt, podX, podY } = ctx;
    const row = Math.floor(-podY);
    // engine heat, drill heat — both are warmth. It is in the wrecks.
    const hot = ctx.thrust > 0.05 || ctx.drilling;

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 5 + Math.random() * 5;
      if (row >= BAND_LO && row <= BAND_HI && Math.random() < (level === 'reduced' ? 0.3 : 0.6)) {
        this.trySpawn(podX, podY, level);
      }
    }

    let closest = 999;
    let anyHunt = false;
    for (let ci = 0; ci < this.clusters.length; ci++) {
      const c = this.clusters[ci];
      if (!c.alive) continue;
      c.life += dt;
      c.t += dt;
      c.dazedT = Math.max(0, c.dazedT - dt);
      const dist = Math.hypot(podX - c.ax, podY - c.ay);
      // a flare only exists to a cluster within FLARE_PULL of it — heat
      // across the map is not heat here
      const flare = this.flares.brightest(c.ax, c.ay, FLARE_PULL);
      const flareNear = flare ? Math.hypot(flare.x - c.ax, flare.y - c.ay) < 4.5 : false;
      const warmth = c.dazedT <= 0 && ((hot && dist < WAKE_RANGE) || flareNear);
      if (dist > 36 || c.life > 150) { this.despawn(ci); continue; }

      switch (c.phase) {
        case 'frozen':
          if (warmth) { c.phase = 'waking'; c.t = 0; }
          break;
        case 'waking':
          // warmth ratchets: a cold beat cools the thaw instead of erasing
          // it, so a pod bursting past on the throttle still wakes them
          if (!warmth) {
            c.t = Math.max(0, c.t - dt * 3);
            if (c.t <= 0) { c.phase = 'frozen'; break; }
          }
          if (c.t >= SHIVER) {
            c.phase = 'hunting'; c.t = 0; c.coldFor = 0;
            if (!c.woke) { c.woke = true; ctx.onAlert(); }
            ctx.onEvent('rimewing-wake', c.ax, c.ay);
          }
          break;
        case 'hunting':
          if (warmth) c.coldFor = 0; else c.coldFor += dt;
          if (c.coldFor > COLD_CALM || dist > 18) { c.phase = 'settling'; c.t = 0; }
          break;
        case 'settling':
          if (warmth) { c.phase = 'hunting'; c.t = 0; c.coldFor = 0; break; }
          if (c.t >= SETTLE) {
            c.phase = 'frozen'; c.t = 0;
            let cx = 0, cy = 0, k = 0;
            for (const w of this.wings) if (w.cluster === ci) { cx += w.x; cy += w.y; k++; }
            if (k > 0) { c.ax = cx / k; c.ay = cy / k; }
            ctx.onEvent('rimewing-freeze', c.ax, c.ay);
          }
          break;
      }
      if (c.phase === 'hunting') { anyHunt = true; closest = Math.min(closest, dist); }
    }

    const dmgMul = level === 'reduced' ? 0.5 : 1;
    this.sumX.fill(0); this.sumY.fill(0); this.sumN.fill(0); this.sumHeat.fill(0);
    let n = 0;
    let gx = 0, gy = 0, gc = 0;
    for (let i = 0; i < this.wings.length; i++) {
      const w = this.wings[i];
      const c = this.clusters[w.cluster];
      if (!c || !c.alive) continue;
      w.phase += dt * 3;
      w.stunT = Math.max(0, w.stunT - dt);
      let shiver = 0;
      let heat = 0;

      if (w.stunT > 0) {
        // lanced: knocked off the beam line, dim and tumbling. It hurts
        // nothing while it spins — and it is still here when it lands.
        heat = 0.12;
        w.rot += dt * 5 * (i % 2 ? 1 : -1);
        w.vx *= 1 - Math.min(1, dt * 2);
        w.vy = w.vy * (1 - Math.min(1, dt * 2)) - 2 * dt;
        const nx = w.x + w.vx * dt, ny = w.y + w.vy * dt;
        if (!this.terrain.solidAt(Math.floor(nx), Math.floor(-ny))) { w.x = nx; w.y = ny; }
        else { w.vx = 0; w.vy = 0; }
      } else if (c.phase === 'frozen') {
        // nothing. That is the point.
        w.vx = 0; w.vy = 0;
      } else if (c.phase === 'waking') {
        const f = c.t / SHIVER;
        shiver = f * f * 0.09;
        heat = f * 0.6;
        if (Math.random() < dt * 6 * f) {
          this.particles.dustBurst(w.x, w.y - 0.1, 0xd8f0ff, { count: 1, speed: 0.3, up: -0.5, life: 0.9, gravity: 4, spread: 0.2 });
        }
        w.vx = 0; w.vy = 0;
      } else if (c.phase === 'hunting') {
        heat = 1;
        // the moth: a dart, then a hang, then a dart. Never a straight line.
        const late = c.t < w.freeAt;
        w.dartT -= dt;
        if (!late && w.dartT <= 0) {
          const flare = this.flares.brightest(c.ax, c.ay, FLARE_PULL);
          const tx = flare ? flare.x : podX;
          const ty = flare ? flare.y : podY - 0.45; // the nozzle
          let dx = tx - w.x, dy = ty - w.y;
          const d = Math.hypot(dx, dy) || 1;
          dx /= d; dy /= d;
          const wob = (Math.random() - 0.5) * 1.4;
          const px = -dy * wob, py = dx * wob;
          const sp = 5.5 + Math.random() * 3;
          w.vx = (dx + px) * sp; w.vy = (dy + py) * sp;
          w.dartT = 0.22 + Math.random() * 0.3;
        }
        w.vx *= 1 - Math.min(1, dt * 5); w.vy *= 1 - Math.min(1, dt * 5);
        w.vy += Math.sin(w.phase * 4) * dt * 3;
        if (late) shiver = 0.08;
        const nx = w.x + w.vx * dt, ny = w.y + w.vy * dt;
        if (!this.terrain.solidAt(Math.floor(nx), Math.floor(-ny))) { w.x = nx; w.y = ny; }
        else { w.vx *= -0.5; w.vy *= -0.5; }
        const pd = Math.hypot(podX - w.x, podY - w.y);
        if (pd < 0.66) {
          ctx.hurt(3 * dmgMul * dt, 'rimewings');
          ctx.drain(0.8 * dmgMul * dt);
        }
        gx += w.x; gy += w.y; gc++;
      } else {
        // settling: the cold takes them — they slow, sink, and lock
        const f = c.t / SETTLE;
        heat = 1 - f;
        w.vx *= 1 - Math.min(1, dt * 3);
        w.vy = w.vy * (1 - Math.min(1, dt * 3)) - 1.4 * dt;
        const nx = w.x + w.vx * dt, ny = w.y + w.vy * dt;
        if (!this.terrain.solidAt(Math.floor(nx), Math.floor(-ny))) { w.x = nx; w.y = ny; }
        else { w.vx = 0; w.vy = 0; }
        w.rot += (Math.atan2(w.vy, w.vx) - w.rot) * Math.min(1, dt * 2) * (1 - f);
      }

      const sp = Math.hypot(w.vx, w.vy);
      const ang = c.phase === 'hunting' && sp > 0.5 ? Math.atan2(w.vy, w.vx) : w.rot;
      tmpP.set(w.x + (Math.random() - 0.5) * shiver, w.y + (Math.random() - 0.5) * shiver, 0.25);
      pose.set(c.phase === 'hunting' ? Math.sin(w.phase * 7) * 0.9 : 0, 0, ang);
      tmpQ.setFromEuler(pose);
      tmpS.setScalar(0.9 + Math.sin(w.phase) * 0.06);
      tmpM.compose(tmpP, tmpQ, tmpS);
      this.mesh.setMatrixAt(n, tmpM);
      // frozen: pale glass. Hunting: the world's light burning through it.
      // even frozen, a cold ember stays lit in the eye and the core
      tmpC.setHex(ACTIVE.swarm.color).lerp(tmpC2.setHex(ACTIVE.swarm.hunting), heat)
        .multiplyScalar(1.45 + heat * 0.55);
      this.mesh.setColorAt(n, tmpC);
      n++;
      this.sumX[w.cluster] += w.x; this.sumY[w.cluster] += w.y;
      this.sumN[w.cluster]++; this.sumHeat[w.cluster] += heat;
    }
    for (let ci = 0; ci < MAX_CLUSTERS; ci++) {
      const k = this.sumN[ci];
      if (!this.clusters[ci].alive || k === 0) { this.spills[ci].off(); continue; }
      const heat = this.sumHeat[ci] / k;
      // ice-cyan, not the lamp's white, so it reads as their own light
      this.spills[ci].set(this.sumX[ci] / k, this.sumY[ci] / k, 5.5, 4.6, 0.42 + heat * 0.3, ICE, 1.5);
    }
    this.mesh.count = n;
    if (n > 0) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
    if (gc > 0) {
      this.glow.position.set(gx / gc, gy / gc, 0.4);
      this.glow.intensity = 6;
      this.glow.color.setHex(ACTIVE.swarm.hunting);
    } else {
      // none hunting: the cluster nearest the pod keeps a cold glow on its rock
      let best = -1, bd = 1e9;
      for (let ci = 0; ci < MAX_CLUSTERS; ci++) {
        const k = this.sumN[ci];
        if (!this.clusters[ci].alive || k === 0) continue;
        const d = Math.hypot(this.sumX[ci] / k - podX, this.sumY[ci] / k - podY);
        if (d < bd) { bd = d; best = ci; }
      }
      if (best >= 0) {
        const k = this.sumN[best];
        this.glow.position.set(this.sumX[best] / k, this.sumY[best] / k, 0.6);
        this.glow.intensity = 1.6 + (this.sumHeat[best] / k) * 3;
        this.glow.color.setHex(ICE);
      } else {
        this.glow.intensity = 0;
      }
    }
    const target = anyHunt ? Math.max(0, 1 - closest / WAKE_RANGE) : 0;
    this.menace += (target - this.menace) * Math.min(1, dt * 3);
  }
}

/**
 * One moth, nose along +X: an elongated octahedral body, two mirrored wings
 * swept back from it, each a shallow faceted pyramid, and a small eye at the
 * nose. Per-face `glow` is the emissive mask: the eye burns, the core and
 * the leading facets glow, the trailing membrane stays glass.
 */
function mothGeometry(): THREE.BufferGeometry {
  type V = [number, number, number];
  const pos: number[] = [], glow: number[] = [];
  const tri = (a: V, b: V, c: V, g: number): void => {
    pos.push(...a, ...b, ...c);
    glow.push(g, g, g);
  };
  // body
  const nose: V = [0.2, 0, 0], tail: V = [-0.16, 0, 0];
  const ring: V[] = [[0.03, 0.07, 0], [0.03, 0, 0.075], [0.03, -0.07, 0], [0.03, 0, -0.075]];
  for (let i = 0; i < 4; i++) {
    const a = ring[i], b = ring[(i + 1) % 4];
    tri(nose, a, b, 1.6);
    tri(tail, b, a, 0.9);
  }
  // wings, mirrored in y
  for (const s of [1, -1]) {
    const r1: V = [0.07, 0.05 * s, 0], r2: V = [-0.09, 0.05 * s, 0];
    const elbow: V = [0.05, 0.27 * s, 0], tip: V = [-0.11, 0.38 * s, 0];
    for (const z of [0.035, -0.035]) {
      const ridge: V = [-0.01, 0.19 * s, z];
      tri(r1, elbow, ridge, 1.5);     // leading edge: the ice-cyan glow
      tri(elbow, tip, ridge, 1.3);
      tri(tip, r2, ridge, 0.5);       // trailing membrane: glass
      tri(r2, r1, ridge, 0.65);
    }
    // a burning strip along the leading edge, root to elbow to tip, proud
    // of both faces: the moth's outline in ice-cyan even out of the beam
    const w = 0.02;
    for (const [a, b] of [[r1, elbow], [elbow, tip]] as [V, V][]) {
      for (const z of [0.04, -0.04]) {
        const a2: V = [a[0] - w, a[1] - w * 0.6 * s, z], b2: V = [b[0] - w, b[1] - w * 0.6 * s, z];
        const a1: V = [a[0], a[1], z], b1: V = [b[0], b[1], z];
        tri(a1, b1, b2, 2.4);
        tri(a1, b2, a2, 2.4);
      }
    }
  }
  // the eye: a bright point at the nose, proud of the body toward the camera
  const e = 0.058, ex = 0.15, ez = 0.06;
  const eye: V[] = [[ex + e, 0, ez], [ex, e, ez], [ex - e, 0, ez], [ex, -e, ez]];
  for (let i = 0; i < 4; i++) {
    tri([ex, 0, ez + e], eye[i], eye[(i + 1) % 4], 4.5);
    tri([ex, 0, ez - e], eye[(i + 1) % 4], eye[i], 4.5);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('glow', new THREE.Float32BufferAttribute(glow, 1));
  geo.scale(1.1, 1.1, 1.1);
  geo.computeVertexNormals();
  return geo;
}
