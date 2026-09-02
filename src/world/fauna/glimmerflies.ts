import * as THREE from 'three';
import { Terrain } from '../terrain';
import { ACTIVE } from '../worlds';
import { FlareField } from './flares';
import { Creature, ThreatCtx, ThreatLevel, air, tmpM, tmpP, tmpQ, tmpS, tmpE, tmpC } from './types';

// GLIMMERFLIES — VEIL-3's swarm tier. Keyed on LIGHT.
//
// Not a cloud of dots: a murmuration. Each fly is a sliver of glass that only
// shows itself when it turns edge-on to your lamp, so a resting swarm reads as
// stray sparks in the dark. Lit, the ring collapses inward, then unfolds into
// a ribbon that pours toward the lamp. Go dark and they lose you within two
// seconds — but they do not go home. They hang where they lost you, dim,
// and wait for the light to come back.

const MAX_FLIES = 36;
const SWARM_MIN = 8;
const SWARM_MAX = 14;
const MAX_SWARMS = 2;
const NOTICE_RANGE = 8.5;
const LOSE_RANGE = 15;
const DARK_CALM = 1.7;
const BAND_LO = 90;
const BAND_HI = 470;

interface Fly {
  x: number; y: number;
  vx: number; vy: number;
  phase: number;
  glint: number;      // seconds of wing-flash left
  swarm: number;
}

interface Swarm {
  alive: boolean;
  ax: number; ay: number;
  alerted: boolean;
  darkFor: number;
  life: number;
  lash: number;       // the collapse-and-burst on first alert
}

export class Glimmerflies implements Creature {
  menace = 0;
  spawnTimer = 0;
  readonly flies: Fly[] = [];
  readonly swarms: Swarm[] = [];
  private mesh: THREE.InstancedMesh;
  private glow: THREE.PointLight;

  constructor(scene: THREE.Scene, private terrain: Terrain, private flares: FlareField) {
    // a sliver: long, thin, nearly flat — a wing seen from the side
    const geo = new THREE.OctahedronGeometry(0.16, 0);
    geo.scale(1, 0.38, 0.12);
    const mat = new THREE.MeshBasicMaterial({
      toneMapped: false, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX_FLIES);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.setColorAt(0, tmpC.setHex(0xffffff));
    scene.add(this.mesh);
    this.glow = new THREE.PointLight(0xffe08a, 0, 9, 1.8);
    this.glow.visible = false;
    scene.add(this.glow);
    for (let i = 0; i < MAX_SWARMS; i++) {
      this.swarms.push({ alive: false, ax: 0, ay: 0, alerted: false, darkFor: 0, life: 0, lash: 0 });
    }
  }

  get count(): number { return this.mesh.count; }

  reset(): void {
    this.flies.length = 0;
    for (const s of this.swarms) s.alive = false;
    this.mesh.count = 0;
    this.glow.visible = false;
    this.menace = 0;
  }

  private trySpawn(podX: number, podY: number, level: ThreatLevel): void {
    const slot = this.swarms.findIndex(s => !s.alive);
    if (slot < 0) return;
    for (let attempt = 0; attempt < 24; attempt++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 9 + Math.random() * 7;
      const x = Math.round(podX + Math.cos(ang) * dist);
      const y = Math.round(-podY + Math.sin(ang) * dist);
      if (y < 60 || x < 1 || x >= this.terrain.w - 1) continue;
      if (!air(this.terrain, x, y)) continue;
      const s = this.swarms[slot];
      s.alive = true;
      s.ax = x + 0.5; s.ay = -(y + 0.5);
      s.alerted = false; s.darkFor = 0; s.life = 0; s.lash = 0;
      const n = SWARM_MIN + Math.floor(Math.random() * (SWARM_MAX - SWARM_MIN + 1));
      const want = level === 'reduced' ? Math.ceil(n / 2) : n;
      for (let i = 0; i < want && this.flies.length < MAX_FLIES; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 1 + Math.random() * 1.2;
        this.flies.push({
          x: s.ax + Math.cos(a) * r, y: s.ay + Math.sin(a) * r,
          vx: 0, vy: 0, phase: Math.random() * Math.PI * 2, glint: 0, swarm: slot,
        });
      }
      return;
    }
  }

  private despawn(slot: number): void {
    this.swarms[slot].alive = false;
    for (let i = this.flies.length - 1; i >= 0; i--) {
      if (this.flies[i].swarm === slot) this.flies.splice(i, 1);
    }
  }

  drillHit(x: number, y: number): void {
    for (let i = this.flies.length - 1; i >= 0; i--) {
      const f = this.flies[i];
      if (Math.hypot(f.x - x, f.y - y) < 0.85) this.flies.splice(i, 1);
    }
  }

  blast(x: number, y: number, radius: number): void {
    for (let i = this.flies.length - 1; i >= 0; i--) {
      const f = this.flies[i];
      if (Math.hypot(f.x - x, f.y - y) < radius) this.flies.splice(i, 1);
    }
  }

  lance(x: number, y: number, dir: number, range: number): void {
    for (let i = this.flies.length - 1; i >= 0; i--) {
      const f = this.flies[i];
      const dx = (f.x - x) * dir;
      if (dx > -0.5 && dx < range && Math.abs(f.y - y) < 1.3) this.flies.splice(i, 1);
    }
  }

  update(ctx: ThreatCtx, level: ThreatLevel): void {
    const { dt, podX, podY, lampOn } = ctx;
    const row = Math.floor(-podY);
    const flare = this.flares.brightest();

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 4 + Math.random() * 5;
      if (row >= BAND_LO && row <= BAND_HI && Math.random() < (level === 'reduced' ? 0.25 : 0.5)) {
        this.trySpawn(podX, podY, level);
      }
    }

    let closest = 999;
    let anyAlert = false;
    for (let si = 0; si < this.swarms.length; si++) {
      const s = this.swarms[si];
      if (!s.alive) continue;
      s.life += dt;
      s.lash = Math.max(0, s.lash - dt);
      const dist = Math.hypot(podX - s.ax, podY - s.ay);
      const flareNear = flare ? Math.hypot(flare.x - s.ax, flare.y - s.ay) < NOTICE_RANGE * 1.6 : false;
      if ((lampOn && dist < NOTICE_RANGE) || flareNear) {
        if (!s.alerted) { s.alerted = true; s.lash = 0.9; ctx.onAlert(); }
        s.darkFor = 0;
      } else if (s.alerted) {
        s.darkFor += dt;
        if (s.darkFor > DARK_CALM || dist > LOSE_RANGE) {
          // they lose you — and settle right where they are, waiting
          s.alerted = false;
          let cx = 0, cy = 0, c = 0;
          for (const f of this.flies) if (f.swarm === si) { cx += f.x; cy += f.y; c++; }
          if (c > 0) { s.ax = cx / c; s.ay = cy / c; }
        }
      }
      if (dist > 34 || s.life > 120) { this.despawn(si); continue; }
      if (s.alerted) { anyAlert = true; closest = Math.min(closest, dist); }
    }

    // the flock: seek + separation + alignment. Cohesion comes free from the
    // shared target; the ribbon comes from separation fighting it.
    const dmgMul = level === 'reduced' ? 0.5 : 1;
    let n = 0;
    const flies = this.flies;
    for (let i = 0; i < flies.length; i++) {
      const f = flies[i];
      const s = this.swarms[f.swarm];
      if (!s || !s.alive) continue;
      f.phase += dt * 2.6;
      f.glint = Math.max(0, f.glint - dt);
      if (f.glint <= 0 && Math.random() < dt * 0.35) f.glint = 0.12;

      let tx: number, ty: number, speed: number;
      if (s.alerted) {
        tx = flare ? flare.x : podX; ty = flare ? flare.y : podY;
        speed = 4.4;
        if (s.lash > 0.5) {
          // the collapse: for the first half second every fly dives for the anchor
          tx = s.ax; ty = s.ay; speed = 6;
        }
      } else {
        // resting ring: a slow orbit of the anchor, each on its own radius
        const r = 1.1 + (i % 5) * 0.22;
        const a = f.phase * 0.45 + i * 1.3;
        tx = s.ax + Math.cos(a) * r; ty = s.ay + Math.sin(a) * r;
        speed = 1.2;
      }
      let ax = tx - f.x, ay = ty - f.y;
      const d = Math.hypot(ax, ay) || 1;
      ax = ax / d * speed * 4; ay = ay / d * speed * 4;

      // separation + alignment against neighbours in the same swarm
      let sx = 0, sy = 0, alx = 0, aly = 0, nb = 0;
      for (let j = 0; j < flies.length; j++) {
        if (j === i) continue;
        const o = flies[j];
        if (o.swarm !== f.swarm) continue;
        const ox = f.x - o.x, oy = f.y - o.y;
        const od = ox * ox + oy * oy;
        if (od < 0.36) { const inv = 1 / (Math.sqrt(od) + 0.05); sx += ox * inv; sy += oy * inv; }
        if (od < 4) { alx += o.vx; aly += o.vy; nb++; }
      }
      ax += sx * 9; ay += sy * 9;
      if (nb > 0) { ax += (alx / nb - f.vx) * 2; ay += (aly / nb - f.vy) * 2; }
      // a little sideways wander so no two paths match
      ax += Math.cos(f.phase * 1.7 + i) * 1.6; ay += Math.sin(f.phase * 2.3 + i) * 1.6;

      f.vx += ax * dt; f.vy += ay * dt;
      const sp = Math.hypot(f.vx, f.vy);
      const cap = s.alerted ? 6.5 : 1.8;
      if (sp > cap) { f.vx *= cap / sp; f.vy *= cap / sp; }
      const nx = f.x + f.vx * dt, ny = f.y + f.vy * dt;
      if (!this.terrain.solidAt(Math.floor(nx), Math.floor(-ny))) { f.x = nx; f.y = ny; }
      else { f.vx *= -0.4; f.vy *= -0.4; }

      const pd = Math.hypot(podX - f.x, podY - f.y);
      if (pd < 0.62) {
        ctx.hurt(2.6 * dmgMul * dt, 'glimmerflies');
        ctx.drain(0.5 * dmgMul * dt);
      }

      // the sliver flies along its velocity; a resting fly barely shows
      tmpP.set(f.x, f.y, 0.25);
      tmpE.set(0, 0, Math.atan2(f.vy, f.vx));
      tmpQ.setFromEuler(tmpE);
      const flap = 0.85 + Math.abs(Math.sin(f.phase * 9)) * 0.35;
      tmpS.set(1, flap, 1);
      tmpM.compose(tmpP, tmpQ, tmpS);
      this.mesh.setMatrixAt(n, tmpM);
      const bright = s.alerted ? 1.25 : (f.glint > 0 ? 1.1 : 0.32);
      tmpC.setHex(s.alerted ? ACTIVE.swarm.hunting : ACTIVE.swarm.color).multiplyScalar(bright);
      this.mesh.setColorAt(n, tmpC);
      n++;
    }
    this.mesh.count = n;
    if (n > 0) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }

    if (anyAlert && n > 0) {
      let cx = 0, cy = 0, c = 0;
      for (const f of this.flies) if (this.swarms[f.swarm]?.alerted) { cx += f.x; cy += f.y; c++; }
      if (c > 0) {
        this.glow.visible = true;
        this.glow.position.set(cx / c, cy / c, 0.4);
        this.glow.intensity = 7;
        this.glow.color.setHex(ACTIVE.swarm.hunting);
      }
    } else {
      this.glow.visible = false;
    }
    const target = anyAlert ? Math.max(0, 1 - closest / NOTICE_RANGE) : 0;
    this.menace += (target - this.menace) * Math.min(1, dt * 3);
  }
}
