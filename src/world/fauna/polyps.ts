import * as THREE from 'three';
import { Terrain } from '../terrain';
import { ACTIVE } from '../worlds';
import { Particles } from '../../fx/particles';
import { FlareField } from './flares';
import { Creature, ThreatCtx, ThreatLevel, onWall, tmpM, tmpP, tmpQ, tmpS, tmpE, tmpC, tmpC2 } from './types';

// PRESSURE POLYPS — MAELIS-6's swarm tier. Keyed on SPACE.
//
// Not flies. Sacs. They grow on cave walls in clusters, translucent, with a
// dark nucleus and a slow breathing pulse. They never move. What they do is
// notice you: come within a few tiles and they inflate — faster the faster
// you move — the green draining to white, the sac trembling, until they
// burst: a hull hit and a shove, and the neighbours catch it. Thread past
// slowly and they only swell. Rush and the wall goes off like a string of
// charges. A flare within reach pops them from a distance.

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

  constructor(scene: THREE.Scene, private terrain: Terrain, private flares: FlareField, private particles: Particles) {
    const sacGeo = new THREE.SphereGeometry(0.5, 12, 9);
    const sacMat = new THREE.MeshStandardMaterial({
      flatShading: false, roughness: 0.3, metalness: 0,
      transparent: true, opacity: 0.62, depthWrite: false,
      emissive: 0xffffff, emissiveIntensity: 0.5,
    });
    sacMat.onBeforeCompile = sh => {
      sh.fragmentShader = sh.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance *= vColor.rgb;'
      );
    };
    this.sacs = new THREE.InstancedMesh(sacGeo, sacMat, MAX_POLYPS);
    this.sacs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.sacs.frustumCulled = false;
    this.sacs.count = 0;
    this.sacs.setColorAt(0, tmpC.setHex(0xffffff));
    scene.add(this.sacs);

    // the nucleus: a dark knot that goes white as the pressure builds
    const coreGeo = new THREE.IcosahedronGeometry(0.16, 1);
    const coreMat = new THREE.MeshBasicMaterial({ toneMapped: false });
    this.cores = new THREE.InstancedMesh(coreGeo, coreMat, MAX_POLYPS);
    this.cores.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.cores.frustumCulled = false;
    this.cores.count = 0;
    this.cores.setColorAt(0, tmpC.setHex(0xffffff));
    scene.add(this.cores);

    this.glow = new THREE.PointLight(0x6affc8, 0, 7, 1.8);
    this.glow.visible = false;
    scene.add(this.glow);
    for (let i = 0; i < MAX_CLUSTERS; i++) this.clusters.push({ alive: false, ax: 0, ay: 0, life: 0, seen: false, noticed: false });
    for (let i = 0; i < MAX_POLYPS; i++) {
      this.polyps.push({ alive: false, x: 0, y: 0, nx: 0, ny: 1, inflate: 0, phase: 0, size: 1, cluster: 0 });
    }
  }

  get count(): number { return this.sacs.count; }

  reset(): void {
    for (const p of this.polyps) p.alive = false;
    for (const c of this.clusters) c.alive = false;
    this.sacs.count = 0; this.cores.count = 0;
    this.glow.visible = false;
    this.menace = 0;
  }

  private trySpawn(podX: number, podY: number, level: ThreatLevel): void {
    const slot = this.clusters.findIndex(c => !c.alive);
    if (slot < 0) return;
    for (let attempt = 0; attempt < 30; attempt++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 8 + Math.random() * 9;
      const x = Math.round(podX + Math.cos(ang) * dist);
      const y = Math.round(-podY + Math.sin(ang) * dist);
      if (y < 60 || x < 1 || x >= this.terrain.w - 1) continue;
      if (!onWall(this.terrain, x, y)) continue;
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
      if (placed === 0) { c.alive = false; continue; }
      return;
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
    for (const p of this.polyps) {
      if (!p.alive) continue;
      const c = this.clusters[p.cluster];
      if (!c?.alive) { p.alive = false; continue; }
      p.phase += dt;
      const dx = podX - p.x, dy = podY - p.y;
      const d = Math.hypot(dx, dy);
      const flare = this.flares.near(p.x, p.y, 2.6);

      // nearness charges it; speed charges it faster; distance lets it settle
      if (d < NOTICE) {
        const near = 1 - d / NOTICE;
        p.inflate += dt * (0.22 + near * 0.55 + speed * 0.09) * near;
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
      const s = (0.5 + f * 0.42 + breath) * p.size;
      tmpP.set(
        p.x + (Math.random() - 0.5) * tremble,
        p.y + (Math.random() - 0.5) * tremble,
        0.2 + f * 0.1,
      );
      // a sac sits proud of its wall: squash along the normal, stretch out of it
      tmpE.set(0, 0, Math.atan2(p.ny, p.nx) - Math.PI / 2);
      tmpQ.setFromEuler(tmpE);
      tmpS.set(s * (1 - f * 0.1), s * (1.2 + f * 0.25), s * 0.9);
      tmpM.compose(tmpP, tmpQ, tmpS);
      this.sacs.setMatrixAt(n, tmpM);
      // green sac → white sac; instance color scales the emissive
      tmpC.setHex(ACTIVE.swarm.color).lerp(tmpC2.setHex(0xffffff), f * f).multiplyScalar(0.6 + f * 1.6);
      this.sacs.setColorAt(n, tmpC);

      tmpP.z += 0.25;
      tmpS.setScalar((0.6 + f * 1.1) * p.size);
      tmpM.compose(tmpP, tmpQ, tmpS);
      this.cores.setMatrixAt(n, tmpM);
      tmpC.setHex(0x061a14).lerp(tmpC2.setHex(ACTIVE.swarm.hunting), Math.min(1, f * 1.4)).multiplyScalar(0.5 + f * 1.5);
      this.cores.setColorAt(n, tmpC);
      n++;

      if (d < 6) { peak = Math.max(peak, f); gx += p.x * f; gy += p.y * f; gw += f; }
    }
    this.sacs.count = n; this.cores.count = n;
    if (n > 0) {
      this.sacs.instanceMatrix.needsUpdate = true;
      this.cores.instanceMatrix.needsUpdate = true;
      if (this.sacs.instanceColor) this.sacs.instanceColor.needsUpdate = true;
      if (this.cores.instanceColor) this.cores.instanceColor.needsUpdate = true;
    }
    if (gw > 0.05) {
      this.glow.visible = true;
      this.glow.position.set(gx / gw, gy / gw, 0.5);
      this.glow.intensity = 1 + peak * 9;
      this.glow.color.setHex(ACTIVE.swarm.hunting);
    } else {
      this.glow.visible = false;
    }
    this.menace += (peak - this.menace) * Math.min(1, dt * 3);
  }
}
