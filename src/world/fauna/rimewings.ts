import * as THREE from 'three';
import { Terrain } from '../terrain';
import { ACTIVE } from '../worlds';
import { Particles } from '../../fx/particles';
import { FlareField } from './flares';
import { Creature, ThreatCtx, ThreatLevel, air, onWall, tmpM, tmpP, tmpQ, tmpS, tmpE, tmpC, tmpC2 } from './types';

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
const BAND_LO = 120;
const BAND_HI = 470;
const SHIVER = 1.3;        // seconds from first warmth to flight
const COLD_CALM = 2.4;     // seconds of cold engine before they settle
const SETTLE = 1.8;        // seconds of sinking before they lock

type Phase = 'frozen' | 'waking' | 'hunting' | 'settling';

interface Wing {
  x: number; y: number;
  vx: number; vy: number;
  rot: number;          // frozen orientation
  dartT: number;        // moth flight: time until the next dart
  phase: number;
  freeAt: number;       // wake offset — they do not all come loose together
  cluster: number;
}

interface Cluster {
  alive: boolean;
  phase: Phase;
  t: number;            // time in phase
  coldFor: number;
  ax: number; ay: number;
  life: number;
  woke: boolean;
}

export class Rimewings implements Creature {
  menace = 0;
  spawnTimer = 0;
  readonly wings: Wing[] = [];
  readonly clusters: Cluster[] = [];
  private mesh: THREE.InstancedMesh;
  private glow: THREE.PointLight;

  constructor(scene: THREE.Scene, private terrain: Terrain, private flares: FlareField, private particles: Particles) {
    // an ice blade: two wings as one flat rhombus with a thick core
    const geo = new THREE.OctahedronGeometry(0.2, 0);
    geo.scale(1.5, 0.55, 0.14);
    const mat = new THREE.MeshStandardMaterial({
      flatShading: true, roughness: 0.15, metalness: 0.1,
      transparent: true, opacity: 0.85,
      emissive: 0xffffff, emissiveIntensity: 0.55,
    });
    // instance color drives the emissive so a woken wing glows from inside
    mat.onBeforeCompile = sh => {
      sh.fragmentShader = sh.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance *= vColor.rgb;'
      );
    };
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX_WINGS);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.setColorAt(0, tmpC.setHex(0xffffff));
    scene.add(this.mesh);
    this.glow = new THREE.PointLight(0xbfe0ff, 0, 8, 1.8);
    this.glow.visible = false;
    scene.add(this.glow);
    for (let i = 0; i < MAX_CLUSTERS; i++) {
      this.clusters.push({ alive: false, phase: 'frozen', t: 0, coldFor: 0, ax: 0, ay: 0, life: 0, woke: false });
    }
  }

  get count(): number { return this.mesh.count; }

  reset(): void {
    this.wings.length = 0;
    for (const c of this.clusters) c.alive = false;
    this.mesh.count = 0;
    this.glow.visible = false;
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
      c.alive = true; c.phase = 'frozen'; c.t = 0; c.coldFor = 0; c.life = 0; c.woke = false;
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

  lance(x: number, y: number, dir: number, range: number): void {
    for (let i = this.wings.length - 1; i >= 0; i--) {
      const w = this.wings[i];
      const dx = (w.x - x) * dir;
      if (dx > -0.5 && dx < range && Math.abs(w.y - y) < 1.3) this.wings.splice(i, 1);
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
    const flare = this.flares.brightest();
    const hot = ctx.thrust > 0.05;

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
      const dist = Math.hypot(podX - c.ax, podY - c.ay);
      const flareNear = flare ? Math.hypot(flare.x - c.ax, flare.y - c.ay) < 4.5 : false;
      const warmth = (hot && dist < WAKE_RANGE) || flareNear;
      if (dist > 36 || c.life > 150) { this.despawn(ci); continue; }

      switch (c.phase) {
        case 'frozen':
          if (warmth) { c.phase = 'waking'; c.t = 0; }
          break;
        case 'waking':
          if (!warmth && c.t < SHIVER * 0.6) { c.phase = 'frozen'; c.t = 0; break; }
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
    let n = 0;
    let gx = 0, gy = 0, gc = 0;
    for (let i = 0; i < this.wings.length; i++) {
      const w = this.wings[i];
      const c = this.clusters[w.cluster];
      if (!c || !c.alive) continue;
      w.phase += dt * 3;
      let shiver = 0;
      let heat = 0;

      if (c.phase === 'frozen') {
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
      tmpE.set(0, c.phase === 'hunting' ? Math.sin(w.phase * 7) * 0.9 : 0, ang);
      tmpQ.setFromEuler(tmpE);
      tmpS.setScalar(0.9 + Math.sin(w.phase) * 0.06);
      tmpM.compose(tmpP, tmpQ, tmpS);
      this.mesh.setMatrixAt(n, tmpM);
      // frozen: pale glass. Hunting: the world's light burning through it.
      tmpC.setHex(ACTIVE.swarm.color).lerp(tmpC2.setHex(ACTIVE.swarm.hunting), heat)
        .multiplyScalar(0.7 + heat * 1.3);
      this.mesh.setColorAt(n, tmpC);
      n++;
    }
    this.mesh.count = n;
    if (n > 0) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
    if (gc > 0) {
      this.glow.visible = true;
      this.glow.position.set(gx / gc, gy / gc, 0.4);
      this.glow.intensity = 6;
      this.glow.color.setHex(ACTIVE.swarm.hunting);
    } else {
      this.glow.visible = false;
    }
    const target = anyHunt ? Math.max(0, 1 - closest / WAKE_RANGE) : 0;
    this.menace += (target - this.menace) * Math.min(1, dt * 3);
  }
}
