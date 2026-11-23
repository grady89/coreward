import * as THREE from 'three';
import { Terrain } from '../terrain';
import { oreValue } from '../tiles';
import { ACTIVE } from '../worlds';
import { Particles } from '../../fx/particles';
import { FlareField } from './flares';
import { Creature, ThreatCtx, ThreatLevel, onWall, tmpM, tmpP, tmpQ, tmpS, tmpE, tmpC, tmpC2, Spill } from './types';

// PRESSURE POLYPS — MAELIS-6's swarm tier. Keyed on SPACE.
//
// Not flies. Sacs. They grow on cave walls in clusters: chunky faceted domes
// of nacre with a sea-green heart set in the front that breathes, and the
// light of it washes the rock they cling to. They never move. What they do is
// notice you: come within a few tiles and they inflate — faster the faster
// you move — the green draining to white, the sac trembling, until they
// burst: a hull hit and a shove, and the neighbours catch it. Thread past
// slowly and they only swell. Rush and the wall goes off like a string of
// charges. A flare within reach pops them from a distance.
//
// They grow where the world is worth something. A cluster roots by ore
// seams, wreck bays, the approach to a carved stone — so the risk stands
// between you and the reward instead of decorating an empty wall.

const MAX_POLYPS = 30;
const CLUSTER_MIN = 3;
const CLUSTER_MAX = 7;
const MAX_CLUSTERS = 3;
const NOTICE = 4.2;
const BAND_LO = 150;
const BAND_HI = 470;

interface Polyp {
  alive: boolean;
  x: number; y: number;
  nx: number; ny: number;   // wall normal (which way the sac leans out)
  inflate: number;
  phase: number;
  size: number;
  cluster: number;
}

interface Cluster { alive: boolean; ax: number; ay: number; life: number; seen: boolean; noticed: boolean }

export class Polyps implements Creature {
  menace = 0;
  spawnTimer = 0;
  readonly polyps: Polyp[] = [];
  readonly clusters: Cluster[] = [];
  private sacs: THREE.InstancedMesh;
  private cores: THREE.InstancedMesh;
  private glow: THREE.PointLight;
  /** each cluster's light on its wall */
  private spills: Spill[] = [];
  /** per cluster, rebuilt every frame: Σx, Σy, count, peak inflate, Σnx, Σny */
  private acc = new Float32Array(MAX_CLUSTERS * 6);

  constructor(scene: THREE.Scene, private terrain: Terrain, private flares: FlareField, private particles: Particles) {
    // a dome, not a ball: a low-poly cap whose open rim sits in the rock and
    // whose crown leans out along the wall normal (+Y), so in profile it is
    // a chunky faceted blister on the stone
    const sacGeo = new THREE.SphereGeometry(0.5, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.62);
    sacGeo.translate(0, -0.5 * Math.cos(Math.PI * 0.62), 0);
    // nacre shell. The instance colour drives ONLY the glow (the diffuse stays
    // pearl): a dim sea-green body and a rim that runs hot toward white as the
    // pressure builds, so a sac about to go is ringed in light
    const sacMat = new THREE.MeshStandardMaterial({
      color: 0xa9c9c0, flatShading: true, roughness: 0.36, metalness: 0.12,
    });
    sacMat.onBeforeCompile = sh => {
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <color_fragment>', '')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{
  float ndv = saturate(abs(dot(normalize(vViewPosition), normal)));
  float fr = pow(1.0 - ndv, 1.8);
  // the glow, plus a pearl sheen catching on the outermost facets
  totalEmissiveRadiance += vColor.rgb * (0.3 + 1.6 * fr) + vec3(0.86, 0.82, 0.95) * 0.4 * fr * fr;
}`);
    };
    sacMat.customProgramCacheKey = () => 'polyp-sac-v3';
    this.sacs = new THREE.InstancedMesh(sacGeo, sacMat, MAX_POLYPS);
    this.sacs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.sacs.frustumCulled = false;
    this.sacs.count = 0;
    this.sacs.setColorAt(0, tmpC.setHex(0xffffff));
    scene.add(this.sacs);

    // the heart: a faceted gem set in the front of the dome, breathing
    // sea-green, swelling and whitening as the pressure builds
    const coreGeo = new THREE.OctahedronGeometry(0.2, 0);
    const coreMat = new THREE.MeshBasicMaterial({ toneMapped: false });
    this.cores = new THREE.InstancedMesh(coreGeo, coreMat, MAX_POLYPS);
    this.cores.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.cores.frustumCulled = false;
    this.cores.count = 0;
    this.cores.setColorAt(0, tmpC.setHex(0xffffff));
    scene.add(this.cores);

    this.glow = new THREE.PointLight(0x6affc8, 0, 9, 1.6);
    scene.add(this.glow);
    for (let i = 0; i < MAX_CLUSTERS; i++) {
      this.clusters.push({ alive: false, ax: 0, ay: 0, life: 0, seen: false, noticed: false });
      this.spills.push(new Spill(scene, 0x6affc8));
    }
    for (let i = 0; i < MAX_POLYPS; i++) {
      this.polyps.push({ alive: false, x: 0, y: 0, nx: 0, ny: 1, inflate: 0, phase: 0, size: 1, cluster: 0 });
    }
  }

  get count(): number { return this.sacs.count; }

  reset(): void {
    for (const p of this.polyps) p.alive = false;
    for (const c of this.clusters) c.alive = false;
    this.sacs.count = 0; this.cores.count = 0;
    this.glow.intensity = 0;
    for (const sp of this.spills) sp.off();
    this.menace = 0;
  }

  /** how much a wall tile is worth guarding: ore seams, wrecks, stones */
  private valueNear(x: number, y: number): number {
    let v = 0;
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        if (oreValue(this.terrain.get(x + dx, y + dy)) > 0) v += 1;
      }
    }
    for (const w of this.terrain.wrecks) {
      if (Math.abs(w.x - x) < 5 && Math.abs(w.y - y) < 5) v += 8;
    }
    for (const g of this.terrain.glyphStones) {
      if (Math.abs(g.x - x) < 7 && Math.abs(g.y - y) < 7) v += 8;
    }
    return v;
  }

  private trySpawn(podX: number, podY: number, level: ThreatLevel): void {
    const slot = this.clusters.findIndex(c => !c.alive);
    if (slot < 0) return;
    // sample the ring and root at the RICHEST wall in reach, not the first
    let bestX = -1, bestY = -1, bestV = -1;
    for (let attempt = 0; attempt < 30; attempt++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 8 + Math.random() * 9;
      const x = Math.round(podX + Math.cos(ang) * dist);
      const y = Math.round(-podY + Math.sin(ang) * dist);
      if (y < 60 || x < 1 || x >= this.terrain.w - 1) continue;
      if (!onWall(this.terrain, x, y)) continue;
      const v = this.valueNear(x, y) + Math.random() * 1.5;
      if (v > bestV) { bestV = v; bestX = x; bestY = y; }
    }
    if (bestX >= 0) {
      const x = bestX, y = bestY;
      const c = this.clusters[slot];
      c.alive = true; c.ax = x + 0.5; c.ay = -(y + 0.5); c.life = 0; c.seen = false; c.noticed = false;
      const n = CLUSTER_MIN + Math.floor(Math.random() * (CLUSTER_MAX - CLUSTER_MIN + 1));
      const want = level === 'reduced' ? Math.ceil(n / 2) : n;
      let placed = 0;
      for (let k = 0; k < 40 && placed < want; k++) {
        const tx = x + Math.round((Math.random() - 0.5) * 5);
        const ty = y + Math.round((Math.random() - 0.5) * 5);
        if (!onWall(this.terrain, tx, ty)) continue;
        const p = this.polyps.find(p => !p.alive);
        if (!p) break;
        // lean out of whichever wall is there
        let nx = 0, ny = 0;
        if (this.terrain.solidAt(tx, ty + 1)) ny = 1;        // rock below → sac sits on the floor
        else if (this.terrain.solidAt(tx, ty - 1)) ny = -1;  // ceiling
        else if (this.terrain.solidAt(tx - 1, ty)) nx = 1;
        else nx = -1;
        p.alive = true;
        // seat the sac INTO its wall: minus-normal on both axes (a floor sac
        // sits down against the rock, not floating at the top of its tile)
        p.x = tx + 0.5 - nx * 0.28; p.y = -(ty + 0.5) - ny * 0.28;
        p.nx = nx; p.ny = ny;
        p.inflate = 0; p.phase = Math.random() * Math.PI * 2;
        p.size = 0.8 + Math.random() * 0.4;
        p.cluster = slot;
        placed++;
      }
      if (placed === 0) c.alive = false;
    }
  }

  private burst(p: Polyp, ctx: ThreatCtx | null, level: ThreatLevel, quiet = false): void {
    p.alive = false;
    this.particles.sparkBurst(p.x, p.y, ACTIVE.swarm.hunting, { count: 16, speed: 4, up: 1, life: 0.7, gravity: 2, spread: 0.4 });
    this.particles.dustBurst(p.x, p.y, 0x2a4a44, { count: 8, speed: 2.4, up: 1, life: 0.9, gravity: 5, spread: 0.4 });
    if (ctx) {
      const dx = ctx.podX - p.x, dy = ctx.podY - p.y;
      const d = Math.hypot(dx, dy);
      if (!quiet && d < 2.4) {
        const f = 1 - d / 2.4;
        const mul = level === 'reduced' ? 0.5 : 1;
        ctx.hurt((5 + 7 * f) * mul, 'a pressure polyp');
        ctx.push((dx / (d || 1)) * (5 + 6 * f) * mul, (dy / (d || 1)) * (5 + 6 * f) * mul + 2);
        ctx.shake(0.25 * f);
      }
      ctx.onEvent('polyp-burst', p.x, p.y);
    }
    // the neighbours feel it go
    for (const o of this.polyps) {
      if (!o.alive || o === p) continue;
      if (Math.hypot(o.x - p.x, o.y - p.y) < 1.7) o.inflate = Math.max(o.inflate, 0.72);
    }
  }

  drillHit(x: number, y: number): void {
    for (const p of this.polyps) {
      if (p.alive && Math.hypot(p.x - x, p.y - y) < 0.9) this.burst(p, null, 'full', true);
    }
  }

  blast(x: number, y: number, radius: number): void {
    for (const p of this.polyps) {
      if (p.alive && Math.hypot(p.x - x, p.y - y) < radius + 0.5) this.burst(p, null, 'full', true);
    }
  }

  lance(x: number, y: number, dir: number, range: number): void {
    for (const p of this.polyps) {
      if (!p.alive) continue;
      const dx = (p.x - x) * dir;
      if (dx > -0.5 && dx < range && Math.abs(p.y - y) < 1.3) this.burst(p, null, 'full', true);
    }
  }

  devStage(x: number, y: number): void {
    // they never move, so where trySpawn grows them is where you go to them —
    // approach speed is the variable under test (NOTICE is only 4.2 tiles)
    if (!this.clusters.some(c => c.alive)) this.trySpawn(x, y, 'full');
  }

  update(ctx: ThreatCtx, level: ThreatLevel): void {
    const { dt, podX, podY } = ctx;
    const row = Math.floor(-podY);
    const speed = Math.hypot(ctx.vx, ctx.vy);

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 5 + Math.random() * 6;
      if (row >= BAND_LO && row <= BAND_HI && Math.random() < (level === 'reduced' ? 0.3 : 0.6)) {
        this.trySpawn(podX, podY, level);
      }
    }

    for (let ci = 0; ci < this.clusters.length; ci++) {
      const c = this.clusters[ci];
      if (!c.alive) continue;
      c.life += dt;
      const dist = Math.hypot(podX - c.ax, podY - c.ay);
      if (dist > 36 || c.life > 240) {
        c.alive = false;
        for (const p of this.polyps) if (p.cluster === ci) p.alive = false;
        continue;
      }
      if (!c.seen && dist < 9) { c.seen = true; ctx.onEvent('polyp-seen', c.ax, c.ay); }
    }

    let n = 0;
    let peak = 0, gx = 0, gy = 0, gw = 0;
    this.acc.fill(0);
    for (const p of this.polyps) {
      if (!p.alive) continue;
      const c = this.clusters[p.cluster];
      if (!c?.alive) { p.alive = false; continue; }
      p.phase += dt;
      const dx = podX - p.x, dy = podY - p.y;
      const d = Math.hypot(dx, dy);
      const flare = this.flares.near(p.x, p.y, 2.6);

      // Nearness is the trigger; SPEED is the detonator. The sac answers to
      // pressure waves, and dynamic pressure goes with v² — so the dial is
      //   rate = (0.08 + 0.28·near + 0.13·v²)·near − 0.14
      // with the 0.14/s settle applied everywhere, inside NOTICE too.
      // Against NOTICE 4.2 / burst 1.0 that makes the taught rule true:
      //   • parked at d=2 (near .524, v=0): charge (.08+.28·.524)·.524
      //     = .118/s < .14/s settle → net −.021/s. A stationary pod at
      //     2+ tiles NEVER bursts one. (Old dial: +.266/s, burst in 3.8s.)
      //   • crawl past at 1.2 t/s, 1.5-tile clearance: ∫rate dt over the
      //     pass peaks at .32 — they swell and tremble, then settle.
      //   • rush the same gap at 3.5 t/s: inflate crosses 1.0 while the
      //     pod is 1.3 tiles past the sac — inside its 2.4-tile blast.
      //     At 6+ t/s it bursts before the pod even draws level.
      //   • room protects rushers too: at 3-tile clearance even 6 t/s
      //     only swells them to .74. Slow OR wide, both are safe.
      // (verified numerically; the pass integral uses d(t) = √(x(t)²+c²))
      if (d < NOTICE) {
        const near = 1 - d / NOTICE;
        p.inflate += dt * ((0.08 + near * 0.28 + speed * speed * 0.13) * near - 0.14);
        if (!c.noticed) { c.noticed = true; ctx.onAlert(); }
      } else {
        p.inflate -= dt * 0.14;
      }
      if (flare) p.inflate += dt * 0.9;
      p.inflate = Math.max(0, p.inflate);
      if (p.inflate >= 1 || d < 1.15) { this.burst(p, ctx, level); continue; }

      const f = p.inflate;
      const breath = Math.sin(p.phase * (1.4 + f * 4) + p.phase) * 0.035;
      const tremble = f > 0.6 ? (f - 0.6) * 0.14 : 0;
      // chunky at rest (a tile across: they read at play size), well over
      // one when it is about to go
      const s = (1.12 + f * 0.6 + breath) * p.size;
      // the dome's rim sits on the wall face, its crown leans out of it
      const bx = p.x - p.nx * 0.24 + (Math.random() - 0.5) * tremble;
      const by = p.y - p.ny * 0.24 + (Math.random() - 0.5) * tremble;
      tmpP.set(bx, by, 0.12 + f * 0.08);
      tmpE.set(0, 0, Math.atan2(p.ny, p.nx) - Math.PI / 2);
      tmpQ.setFromEuler(tmpE);
      const lean = 1.05 + f * 0.4;
      tmpS.set(s * (1 - f * 0.08), s * lean, s * 0.95);
      tmpM.compose(tmpP, tmpQ, tmpS);
      this.sacs.setMatrixAt(n, tmpM);
      // the heartbeat: a slow swell of light that quickens with the pressure
      const beat = 0.5 + 0.5 * Math.sin(p.phase * (1.6 + f * 7));
      // sea-green glow → white-hot rim; the instance colour drives the glow only
      tmpC.setHex(ACTIVE.swarm.hunting).lerp(tmpC2.setHex(0xffffff), f * f)
        .multiplyScalar(0.5 + beat * 0.16 + f * 1.5 + (f > 0.6 ? (f - 0.6) * 2.5 * beat : 0));
      this.sacs.setColorAt(n, tmpC);

      // the heart sits mid-dome along the normal, proud of its front face
      const h = 0.5 * s * lean * 0.62;
      tmpP.set(bx + p.nx * h, by + p.ny * h, tmpP.z + 0.5 * s * 0.95 * 0.72);
      tmpS.setScalar((1.15 + f * 1.1 + beat * 0.16) * p.size);
      tmpM.compose(tmpP, tmpQ, tmpS);
      this.cores.setMatrixAt(n, tmpM);
      // pearl-green at rest (nacre over sea-glow), white-hot when it is about to go
      tmpC.setHex(ACTIVE.swarm.hunting).lerp(tmpC2.setHex(0xe6fff6), 0.25 + beat * 0.2)
        .lerp(tmpC2.setHex(0xffffff), Math.min(1, f * 1.2))
        .multiplyScalar(1.25 + beat * 0.7 + f * 2.2);
      this.cores.setColorAt(n, tmpC);
      n++;

      const a = this.acc, k = p.cluster * 6;
      a[k] += p.x; a[k + 1] += p.y; a[k + 2] += 1; a[k + 3] = Math.max(a[k + 3], f);
      a[k + 4] += p.nx; a[k + 5] += p.ny;
      if (d < 6) { peak = Math.max(peak, f); gx += p.x * f; gy += p.y * f; gw += f; }
    }
    this.sacs.count = n; this.cores.count = n;
    if (n > 0) {
      this.sacs.instanceMatrix.needsUpdate = true;
      this.cores.instanceMatrix.needsUpdate = true;
      if (this.sacs.instanceColor) this.sacs.instanceColor.needsUpdate = true;
      if (this.cores.instanceColor) this.cores.instanceColor.needsUpdate = true;
    }
    // each cluster's glow lands on its wall: a soft sea-green pool that
    // breathes at rest and flares toward white as the sacs swell
    let nearC = -1, nearD = Infinity;
    for (let ci = 0; ci < MAX_CLUSTERS; ci++) {
      const a = this.acc, k = ci * 6;
      if (a[k + 2] <= 0) { this.spills[ci].off(); continue; }
      const cx = a[k] / a[k + 2], cy = a[k + 1] / a[k + 2], cf = a[k + 3];
      // centred a little into the wall they grow on, so most of it lands on stone
      const sx = cx - a[k + 4] / a[k + 2] * 0.7, sy = cy - a[k + 5] / a[k + 2] * 0.7;
      const w = 4.8 + Math.min(4, a[k + 2]) * 0.45 + cf * 1.6;
      const beat = 0.5 + 0.5 * Math.sin(ctx.time * 1.7 + ci * 2.1);
      tmpC.setHex(ACTIVE.swarm.hunting).lerp(tmpC2.setHex(0xffffff), cf * cf * 0.7);
      this.spills[ci].set(sx, sy, w, w, 0.68 + beat * 0.14 + cf * 0.45, tmpC.getHex(), 1.3);
      const cd = Math.hypot(podX - cx, podY - cy);
      if (cd < nearD) { nearD = cd; nearC = ci; }
    }
    if (gw > 0.05) {
      this.glow.position.set(gx / gw, gy / gw, 0.5);
      this.glow.intensity = 2 + peak * 9;
      this.glow.color.setHex(ACTIVE.swarm.hunting);
    } else if (nearC >= 0 && nearD < 16) {
      // at rest the nearest cluster still lights its stone, faintly
      const k = nearC * 6;
      this.glow.position.set(this.acc[k] / this.acc[k + 2], this.acc[k + 1] / this.acc[k + 2], 0.6);
      this.glow.intensity = 2.4 + Math.sin(ctx.time * 1.7) * 0.4;
      this.glow.color.setHex(ACTIVE.swarm.hunting);
    } else {
      this.glow.intensity = 0;
    }
    this.menace += (peak - this.menace) * Math.min(1, dt * 3);
  }
}
