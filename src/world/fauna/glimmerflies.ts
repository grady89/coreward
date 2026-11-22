import * as THREE from 'three';
import { Terrain } from '../terrain';
import { ACTIVE } from '../worlds';
import { FlareField } from './flares';
import { softDot } from '../../fx/particles';
import { Creature, ThreatCtx, ThreatLevel, air, tmpM, tmpP, tmpQ, tmpS, tmpE, tmpC, tmpC2 } from './types';

// GLIMMERFLIES — VEIL-3's swarm tier. Keyed on LIGHT.
//
// Not a cloud of dots: a murmuration. Each fly is a soft mote of light that
// only flares when it catches your lamp, so a resting swarm reads as stray
// sparks in the dark. Lit, the ring collapses inward, then unfolds into
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
const FLARE_PULL = NOTICE_RANGE * 2;  // a flare only exists within ~2× notice
const SCATTER = 2;  // seconds a lanced fly tumbles dark
const BAND_LO = 90;
const BAND_HI = 470;

interface Fly {
  x: number; y: number;
  vx: number; vy: number;
  phase: number;
  glint: number;      // seconds of wing-flash left
  stunT: number;      // seconds of lance-daze left — flung, dim, harmless
  swarm: number;
  /** render-only: three points easing after the fly, each a beat behind the
   *  last — the ribbon it draws through the air. Never read by the flock. */
  trail: Float32Array;
}

/** afterimages drawn behind each fly, and how much of the fly each keeps */
const TRAIL = 3;
const TRAIL_SIZE = [0.78, 0.6, 0.44];
const TRAIL_GLOW = [0.5, 0.3, 0.16];
/** furthest a fly's drawn mote may sit from its true (contact) position, tiles */
const RIB_MAX = 0.6;

interface Swarm {
  alive: boolean;
  ax: number; ay: number;
  alerted: boolean;
  darkFor: number;
  life: number;
  lash: number;       // the collapse-and-burst on first alert
  dazedT: number;     // lanced: the swarm cannot re-notice anything for a beat
  woke: boolean;      // the alert toast/stinger fires once per swarm, not per re-notice
  /** render-only 0..1: how far the hunting swarm is drawn strung out as a
   *  ribbon back along its approach, instead of knotted on its target */
  rib: number;
  /** render-only: the ribbon's lie — unit vector from the target back toward the swarm */
  rux: number; ruy: number;
}

export class Glimmerflies implements Creature {
  menace = 0;
  spawnTimer = 0;
  readonly flies: Fly[] = [];
  readonly swarms: Swarm[] = [];
  private mesh: THREE.InstancedMesh;
  private glow: THREE.PointLight;
  /** the hunting swarm's light on the rock: one soft additive quad, no extra light */
  private wash: THREE.Mesh;
  private washMat: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene, private terrain: Terrain, private flares: FlareField) {
    // a mote: a soft round glow facing the camera, drawn out a little along
    // its flight so a pouring swarm reads as a ribbon of light
    const geo = new THREE.PlaneGeometry(0.6, 0.6);
    const mat = new THREE.MeshBasicMaterial({
      map: softDot(), toneMapped: false, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX_FLIES * (1 + TRAIL));
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.setColorAt(0, tmpC.setHex(0xffffff));
    scene.add(this.mesh);
    this.glow = new THREE.PointLight(0xffe08a, 0, 9, 1.8);
    scene.add(this.glow);
    this.washMat = new THREE.MeshBasicMaterial({
      map: softDot(), transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    });
    // just proud of the block faces, so the spill lands on rock as well as air
    this.wash = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.washMat);
    this.wash.position.z = 0.56;
    this.wash.visible = false;
    scene.add(this.wash);
    for (let i = 0; i < MAX_SWARMS; i++) {
      this.swarms.push({ alive: false, ax: 0, ay: 0, alerted: false, darkFor: 0, life: 0, lash: 0, dazedT: 0, woke: false, rib: 0, rux: 1, ruy: 0 });
    }
  }

  /** flies on screen this frame (not instances: each also draws its trail) */
  private shown = 0;
  get count(): number { return this.shown; }

  reset(): void {
    this.flies.length = 0;
    for (const s of this.swarms) s.alive = false;
    this.mesh.count = 0;
    this.shown = 0;
    this.glow.intensity = 0;
    this.washMat.opacity = 0;
    this.wash.visible = false;
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
      s.alerted = false; s.darkFor = 0; s.life = 0; s.lash = 0; s.dazedT = 0; s.woke = false;
      const n = SWARM_MIN + Math.floor(Math.random() * (SWARM_MAX - SWARM_MIN + 1));
      const want = level === 'reduced' ? Math.ceil(n / 2) : n;
      for (let i = 0; i < want && this.flies.length < MAX_FLIES; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 1 + Math.random() * 1.2;
        const fx = s.ax + Math.cos(a) * r, fy = s.ay + Math.sin(a) * r;
        this.flies.push({
          x: fx, y: fy,
          vx: 0, vy: 0, phase: Math.random() * Math.PI * 2, glint: 0, stunT: 0, swarm: slot,
          trail: new Float32Array([fx, fy, fx, fy, fx, fy]),
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

  // The lance is light, not a gun: everything else it does is a light verb
  // (stun, blind, stagger, pop), so here it SCATTERS. Flies in the corridor
  // are flung off the beam line and tumble dark for a couple of seconds; the
  // swarm loses you outright and re-anchors away from the shot. Nothing dies.
  lance(x: number, y: number, dir: number, range: number): void {
    for (let si = 0; si < this.swarms.length; si++) {
      const s = this.swarms[si];
      if (!s.alive) continue;
      let hit = 0;
      for (const f of this.flies) {
        if (f.swarm !== si) continue;
        const dx = (f.x - x) * dir;
        if (dx <= -0.5 || dx >= range || Math.abs(f.y - y) > 1.3) continue;
        const side = f.y >= y ? 1 : -1;
        f.vx = dir * (3 + Math.random() * 4);
        f.vy = side * (9 + Math.random() * 5);
        f.stunT = SCATTER;
        f.glint = 0;
        hit++;
      }
      if (!hit) continue;
      s.alerted = false; s.lash = 0; s.darkFor = 0; s.dazedT = SCATTER;
      // the swarm's home shifts away from whoever fired — several tiles,
      // to the first breathable spot
      const away = Math.sign(s.ax - x) || dir;
      for (let step = 5; step >= 2; step--) {
        const nx = s.ax + away * step;
        if (air(this.terrain, Math.floor(nx), Math.floor(-s.ay))) { s.ax = nx; break; }
      }
    }
  }

  devStage(x: number, y: number): void {
    if (this.swarms.some(s => s.alive)) return;
    this.trySpawn(x, y, 'full');
    // a natural swarm sits 9+ tiles out; drag it inside lamp range so the
    // murmuration reads at once instead of after a flight across the room
    const slot = this.swarms.findIndex(s => s.alive);
    if (slot < 0) return;
    const s = this.swarms[slot];
    const ox = s.ax, oy = s.ay;
    s.ax = x + 6; s.ay = y + 1;
    for (const f of this.flies) {
      if (f.swarm !== slot) continue;
      f.x += s.ax - ox; f.y += s.ay - oy;
      for (let k = 0; k < TRAIL; k++) { f.trail[k * 2] = f.x; f.trail[k * 2 + 1] = f.y; }
    }
  }

  update(ctx: ThreatCtx, level: ThreatLevel): void {
    const { dt, podX, podY, lampOn } = ctx;
    const row = Math.floor(-podY);

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
      s.dazedT = Math.max(0, s.dazedT - dt);
      const dist = Math.hypot(podX - s.ax, podY - s.ay);
      // a flare only exists to a swarm within FLARE_PULL of it — one burning
      // across the map is no longer a universal off-switch
      const flare = this.flares.brightest(s.ax, s.ay, FLARE_PULL);
      const flareNear = flare ? Math.hypot(flare.x - s.ax, flare.y - s.ay) < NOTICE_RANGE * 1.6 : false;
      if (s.dazedT <= 0 && ((lampOn && dist < NOTICE_RANGE) || flareNear)) {
        if (!s.alerted) {
          s.alerted = true; s.lash = 0.9;
          // toast + stinger once per swarm — lamp-flicking must not machine-gun it
          if (!s.woke) { s.woke = true; ctx.onAlert(); ctx.onEvent('swarm-wake', s.ax, s.ay); }
        }
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

    // the ribbon (render only): a hunting swarm is DRAWN strung out from its
    // target back toward where it came from, in a slow sway, so the eye
    // reads a stream of living lights pouring at the lamp. The flock itself
    // — positions, contact, damage — is untouched; each mote stays within
    // RIB_MAX of its fly, and the fainter afterimages carry the length.
    for (const s of this.swarms) {
      if (!s.alive) continue;
      const want = s.alerted && s.lash <= 0.5 ? 1 : 0;
      s.rib += (want - s.rib) * Math.min(1, dt * 1.6);
      if (s.alerted) {
        const flare = this.flares.brightest(s.ax, s.ay, FLARE_PULL);
        const tx = flare ? flare.x : podX, ty = flare ? flare.y : podY;
        let ux = s.ax - tx, uy = s.ay - ty;
        const ul = Math.hypot(ux, uy);
        if (ul > 0.5) {
          ux /= ul; uy /= ul;
          // ease the lie so a moving target swings the ribbon, never snaps it
          const k = Math.min(1, dt * 2);
          s.rux += (ux - s.rux) * k; s.ruy += (uy - s.ruy) * k;
          const rl = Math.hypot(s.rux, s.ruy) || 1;
          s.rux /= rl; s.ruy /= rl;
        }
      }
    }
    const rank = [0, 0, 0, 0];
    let wx = 0, wy = 0, wn = 0;

    // the flock: seek + separation + alignment. Cohesion comes free from the
    // shared target; the ribbon comes from separation fighting it.
    const dmgMul = level === 'reduced' ? 0.5 : 1;
    let n = 0, shown = 0;
    const flies = this.flies;
    for (let i = 0; i < flies.length; i++) {
      const f = flies[i];
      const s = this.swarms[f.swarm];
      if (!s || !s.alive) continue;
      f.phase += dt * 2.6;
      f.glint = Math.max(0, f.glint - dt);
      f.stunT = Math.max(0, f.stunT - dt);
      if (f.glint <= 0 && Math.random() < dt * 0.35) f.glint = 0.12;

      if (f.stunT > 0) {
        // lanced: flung off the beam line and dazed — no seeking, no
        // flocking, no speed cap; just the impulse bleeding off
        f.vx *= 1 - Math.min(1, dt * 2.2);
        f.vy *= 1 - Math.min(1, dt * 2.2);
      } else {
        let tx: number, ty: number, speed: number;
        if (s.alerted) {
          const flare = this.flares.brightest(s.ax, s.ay, FLARE_PULL);
          tx = flare ? flare.x : podX; ty = flare ? flare.y : podY;
          speed = 3.95;
          if (s.lash > 0.5) {
            // the collapse: for the first half second every fly dives for the anchor
            tx = s.ax; ty = s.ay; speed = 5.4;
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
        const cap = s.alerted ? 5.85 : 1.8;
        if (sp > cap) { f.vx *= cap / sp; f.vy *= cap / sp; }
      }
      const nx = f.x + f.vx * dt, ny = f.y + f.vy * dt;
      if (!this.terrain.solidAt(Math.floor(nx), Math.floor(-ny))) { f.x = nx; f.y = ny; }
      else { f.vx *= -0.4; f.vy *= -0.4; }

      const pd = Math.hypot(podX - f.x, podY - f.y);
      if (pd < 0.62 && f.stunT <= 0) {
        ctx.hurt(2.6 * dmgMul * dt, 'glimmerflies');
        ctx.drain(0.5 * dmgMul * dt);
      }

      // where the mote is DRAWN: the fly, pushed back along the ribbon by its
      // rank in the swarm, swaying across it — the leaders stay on target
      let rx = f.x, ry = f.y;
      if (s.rib > 0.01 && f.stunT <= 0) {
        const r = rank[f.swarm]++;
        const along = (r + 0.4) * 0.3 * s.rib;
        const sway = Math.sin(ctx.time * 1.4 - r * 0.6) * (0.12 + along * 0.14) + along * along * 0.05;
        let ox = s.rux * along - s.ruy * sway, oy = s.ruy * along + s.rux * sway;
        // the mote never strays far from the fly: contact is where the light
        // is. The ribbon's length comes from the fainter afterimages.
        const ol = Math.hypot(ox, oy);
        if (ol > RIB_MAX) { ox *= RIB_MAX / ol; oy *= RIB_MAX / ol; }
        rx += ox; ry += oy;
      }

      if (s.alerted) { wx += rx; wy += ry; wn++; }

      // the mote stretches along its velocity; a resting fly barely shows
      tmpP.set(rx, ry, 0.25);
      tmpE.set(0, 0, Math.atan2(f.vy, f.vx));
      tmpQ.setFromEuler(tmpE);
      const flap = 0.85 + Math.abs(Math.sin(f.phase * 9)) * 0.3;
      const stretch = 1 + Math.min(0.7, Math.hypot(f.vx, f.vy) * 0.12);
      tmpS.set(stretch * flap, flap / Math.sqrt(stretch), 1);
      tmpM.compose(tmpP, tmpQ, tmpS);
      this.mesh.setMatrixAt(n, tmpM);
      const bright = f.stunT > 0 ? 0.14 : s.alerted ? 1.25 : (f.glint > 0 ? 1.1 : 0.32);
      tmpC.setHex(s.alerted ? ACTIVE.swarm.hunting : ACTIVE.swarm.color).multiplyScalar(bright);
      this.mesh.setColorAt(n, tmpC);
      n++; shown++;

      // the ribbon: afterimages easing along the path just flown, so a
      // pouring swarm draws streams through the air instead of a knot of
      // dots on the hull. Only a moving fly leaves one.
      const ek = Math.min(1, dt * 5);
      let lx = rx, ly = ry;
      const sp = Math.hypot(f.vx, f.vy);
      const tk = Math.min(1, Math.max(0, (sp - 0.6) / 2.4));
      for (let k = 0; k < TRAIL; k++) {
        const tx = f.trail[k * 2] += (lx - f.trail[k * 2]) * ek;
        const ty = f.trail[k * 2 + 1] += (ly - f.trail[k * 2 + 1]) * ek;
        lx = tx; ly = ty;
        if (tk <= 0.02) continue;
        const sc = TRAIL_SIZE[k] * flap;
        tmpP.set(tx, ty, 0.24 - k * 0.01);
        tmpS.set(sc, sc, 1);
        tmpM.compose(tmpP, tmpQ, tmpS);
        this.mesh.setMatrixAt(n, tmpM);
        this.mesh.setColorAt(n, tmpC2.copy(tmpC).multiplyScalar(TRAIL_GLOW[k] * tk));
        n++;
      }
    }
    this.mesh.count = n;
    this.shown = shown;
    if (n > 0) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }

    let washTo = 0;
    if (anyAlert && shown > 0) {
      let cx = 0, cy = 0, c = 0, spread = 0;
      for (const f of this.flies) if (this.swarms[f.swarm]?.alerted) { cx += f.x; cy += f.y; c++; }
      if (c > 0) {
        cx /= c; cy /= c;
        for (const f of this.flies) if (this.swarms[f.swarm]?.alerted) spread += Math.hypot(f.x - cx, f.y - cy);
        // the light sits on the ribbon as drawn, so the stone under the
        // stream is what brightens
        if (wn > 0) { cx = wx / wn; cy = wy / wn; }
        this.glow.position.set(cx, cy, 0.4);
        this.glow.intensity = 7;
        this.glow.color.setHex(ACTIVE.swarm.hunting);
        // the wash follows the swarm and widens as it unfolds
        const r = 6 + Math.min(4, (spread / c) * 2.2);
        this.wash.position.x = cx; this.wash.position.y = cy;
        this.wash.scale.set(r, r, 1);
        this.washMat.color.setHex(ACTIVE.swarm.hunting);
        washTo = 0.42;
      }
    } else {
      this.glow.intensity = 0;
    }
    this.washMat.opacity += (washTo - this.washMat.opacity) * Math.min(1, dt * 4);
    this.wash.visible = this.washMat.opacity > 0.005;
    const target = anyAlert ? Math.max(0, 1 - closest / NOTICE_RANGE) : 0;
    this.menace += (target - this.menace) * Math.min(1, dt * 3);
  }
}
