import * as THREE from 'three';
import { Terrain } from '../terrain';
import { T } from '../tiles';
import { Particles } from '../../fx/particles';
import { FlareField } from './flares';
import { Creature, ThreatCtx, ThreatLevel, Chain, air, limb, lerp, tmpM, tmpP, tmpQ, tmpS, tmpE, tmpC } from './types';

// SHELLBACKS — MAELIS-6's builder tier. Keyed on SPACE, from the other side.
//
// Nacre isopods the length of the pod. They crawl your tunnels ahead of and
// behind you, fourteen legs in a rolling wave, and every few seconds one
// lays a plate of pearl across a tile you dug — and the way home gets a
// little narrower. They don't want you. They want the holes closed.
//
// Nacre is worth something. Cut it and you get the world's native back.
// Blast one and it drops two. Drill it and it curls into a ball you can't
// touch and waits you out. Flares lure them: they'll go seal a lit tile
// before they seal yours.

const MAX = 2;
const SEGS = 7;
const SPACING = 0.42;
const LEGS = SEGS * 2;
const BAND = 120;
const SPEED = 1.7;
const SEAL_EVERY = 2.6;
const SEAL_CAP = 60;
const KEEP = 6;

interface Shellback {
  alive: boolean;
  x: number; y: number;
  tx: number; ty: number;
  px: number; py: number;   // previous tile
  chain: Chain;
  trail: number[];          // recent tile indices, newest last
  sealT: number;
  curl: number;             // 0..1
  curlT: number;
  stagger: number;
  seen: boolean;
  life: number;
  gait: number;
  idle: number;
}

export class Shellbacks implements Creature {
  backs: Shellback[] = [];
  sealed = 0;
  spawnTimer = 8;
  private plates: THREE.InstancedMesh;
  private legs: THREE.InstancedMesh;
  private feelers: THREE.InstancedMesh;
  private lights: THREE.PointLight[] = [];
  private tmpO = new THREE.Object3D();

  constructor(scene: THREE.Scene, private terrain: Terrain, private flares: FlareField, private particles: Particles) {
    // a plate: half a squashed sphere, its dome toward the camera
    const plateGeo = new THREE.SphereGeometry(0.36, 9, 6, 0, Math.PI * 2, 0, Math.PI * 0.5);
    plateGeo.rotateX(-Math.PI / 2);
    plateGeo.scale(1, 0.72, 0.55);
    const plateMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.28, metalness: 0.55, flatShading: true });
    this.plates = new THREE.InstancedMesh(plateGeo, plateMat, MAX * SEGS);
    this.plates.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.plates.frustumCulled = false;
    this.plates.count = 0;
    this.plates.setColorAt(0, tmpC.setHex(0xffffff));
    scene.add(this.plates);

    const legGeo = new THREE.BoxGeometry(1, 1, 1);
    const legMat = new THREE.MeshStandardMaterial({ color: 0xcfc2dc, roughness: 0.5, metalness: 0.3 });
    this.legs = new THREE.InstancedMesh(legGeo, legMat, MAX * LEGS);
    this.legs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.legs.frustumCulled = false;
    this.legs.count = 0;
    scene.add(this.legs);

    this.feelers = new THREE.InstancedMesh(legGeo, legMat, MAX * 2);
    this.feelers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.feelers.frustumCulled = false;
    this.feelers.count = 0;
    scene.add(this.feelers);

    for (let i = 0; i < MAX; i++) {
      const l = new THREE.PointLight(0xe8dcff, 0, 4.5, 1.8);
      l.visible = false;
      this.lights.push(l);
      scene.add(l);
      this.backs.push({
        alive: false, x: 0, y: 0, tx: 0, ty: 0, px: 0, py: 0,
        chain: new Chain(SEGS, SPACING), trail: [], sealT: SEAL_EVERY, curl: 0, curlT: 0, stagger: 0,
        seen: false, life: 0, gait: 0, idle: 0,
      });
    }
  }

  reset(): void {
    for (const b of this.backs) b.alive = false;
    this.plates.count = 0; this.legs.count = 0; this.feelers.count = 0;
    for (const l of this.lights) l.visible = false;
    this.sealed = 0;
  }

  private trySpawn(podX: number, podY: number): void {
    const b = this.backs.find(b => !b.alive);
    if (!b) return;
    const cx = Math.floor(podX), cy = Math.floor(-podY);
    for (let attempt = 0; attempt < 50; attempt++) {
      const x = cx + Math.floor((Math.random() - 0.5) * 24);
      const y = cy + Math.floor((Math.random() - 0.5) * 24);
      if (x < 1 || x >= this.terrain.w - 1 || y < BAND) continue;
      // they only live in tunnels you made
      if (!this.terrain.dug.has(this.terrain.idx(x, y)) || !air(this.terrain, x, y)) continue;
      const d = Math.hypot(x + 0.5 - podX, -(y + 0.5) - podY);
      if (d < 9 || d > 16) continue;
      b.alive = true;
      b.x = b.tx = x + 0.5; b.y = b.ty = -(y + 0.5);
      b.px = x; b.py = y;
      b.chain.lay(b.x, b.y, 1, 0);
      b.trail.length = 0;
      b.sealT = SEAL_EVERY; b.curl = 0; b.curlT = 0; b.stagger = 0; b.seen = false; b.life = 0; b.gait = 0; b.idle = 0;
      return;
    }
  }

  private die(b: Shellback): void { b.alive = false; }

  blast(x: number, y: number, radius: number): void {
    for (const b of this.backs) {
      if (!b.alive || Math.hypot(b.x - x, b.y - y) > radius + 1) continue;
      this.particles.dustBurst(b.x, b.y, 0xe8dff2, { count: 30, speed: 4, up: 2.5, life: 1, gravity: 8, spread: 0.9 });
      this.particles.sparkBurst(b.x, b.y, 0xd8c8ff, { count: 12, speed: 2.5, up: 2, life: 0.8, gravity: 5, spread: 0.6 });
      this.die(b);
      this.pendingKill = true;
    }
  }
  private pendingKill = false;

  lance(x: number, y: number, dir: number, range: number): void {
    for (const b of this.backs) {
      if (!b.alive) continue;
      const dx = (b.x - x) * dir;
      if (dx > -0.5 && dx < range && Math.abs(b.y - y) < 1.3) { b.stagger = 1.6; b.curlT = 0; }
    }
  }

  drillHit(x: number, y: number): void {
    for (const b of this.backs) {
      if (b.alive && b.curlT <= 0 && Math.hypot(b.x - x, b.y - y) < 1.1) b.curlT = 3;
    }
  }

  /** pick the next tunnel tile: away from the pod, toward any flare, never straight back */
  private steer(b: Shellback, podX: number, podY: number): void {
    const cx = Math.floor(b.x), cy = Math.floor(-b.y);
    const flare = this.flares.near(b.x, b.y, 12);
    let bestScore = -Infinity, bx = cx, by = cy;
    const dirs: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of dirs) {
      const x = cx + dx, y = cy + dy;
      if (!air(this.terrain, x, y) || y < 2) continue;
      const wx = x + 0.5, wy = -(y + 0.5);
      let score = Math.random() * 0.6;
      const dPod = Math.hypot(wx - podX, wy - podY);
      if (flare) score -= Math.hypot(wx - flare.x, wy - flare.y) * 0.5;
      else score += dPod < KEEP ? dPod * 0.8 : -Math.abs(dPod - (KEEP + 4)) * 0.2;
      if (x === b.px && y === b.py) score -= 3;
      if (score > bestScore) { bestScore = score; bx = x; by = y; }
    }
    if (bestScore === -Infinity) { b.idle = 1; return; }
    b.px = cx; b.py = cy;
    b.tx = bx + 0.5; b.ty = -(by + 0.5);
    b.trail.push(this.terrain.idx(cx, cy));
    if (b.trail.length > 6) b.trail.shift();
  }

  devStage(x: number, y: number): void {
    // only lives in tiles YOU dug, 9..16 out: the sandbox carves a long
    // corridor first, or trySpawn has nowhere legal to put one
    if (!this.backs.some(b => b.alive)) this.trySpawn(x, y);
  }

  update(ctx: ThreatCtx, level: ThreatLevel): void {
    const { dt, podX, podY, time } = ctx;
    if (this.pendingKill) {
      this.pendingKill = false;
      ctx.native(2);
      ctx.onEvent('shellback-killed', podX, podY);
    }
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = (level === 'reduced' ? 26 : 14) + Math.random() * 12;
      if (Math.floor(-podY) >= BAND) this.trySpawn(podX, podY);
    }

    let nP = 0, nL = 0, nF = 0;
    for (let k = 0; k < this.backs.length; k++) {
      const b = this.backs[k];
      const light = this.lights[k];
      if (!b.alive) { light.visible = false; continue; }
      b.life += dt;
      const dx = podX - b.x, dy = podY - b.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 34 || b.life > 150) { this.die(b); light.visible = false; continue; }

      b.stagger = Math.max(0, b.stagger - dt);
      if (b.curlT > 0) b.curlT -= dt;
      const curling = b.curlT > 0;
      b.curl += ((curling ? 1 : 0) - b.curl) * Math.min(1, dt * 5);
      b.idle = Math.max(0, b.idle - dt);

      // ---- crawl ----
      if (!curling && b.stagger <= 0 && b.idle <= 0) {
        const mx = b.tx - b.x, my = b.ty - b.y;
        const md = Math.hypot(mx, my);
        if (md < 0.08) this.steer(b, podX, podY);
        else {
          const sp = SPEED * (level === 'reduced' ? 0.8 : 1);
          const step = Math.min(md, sp * dt);
          b.x += (mx / md) * step; b.y += (my / md) * step;
          b.gait += step * 9;
        }
        // ---- seal ----
        b.sealT -= dt;
        if (b.sealT <= 0) {
          b.sealT = SEAL_EVERY + Math.random() * 1.5;
          const i = b.trail[b.trail.length - 3];
          if (i !== undefined && this.sealed < SEAL_CAP) {
            const x = i % this.terrain.w, y = Math.floor(i / this.terrain.w);
            const wx = x + 0.5, wy = -(y + 0.5);
            if (this.terrain.get(x, y) === T.AIR && Math.hypot(wx - podX, wy - podY) > 2 && Math.hypot(wx - b.x, wy - b.y) > 0.9) {
              this.terrain.fill(x, y, T.NACRE);
              this.sealed++;
              this.particles.sparkBurst(wx, wy, 0xe8dcff, { count: 10, speed: 1.6, up: 1, life: 0.7, gravity: 2, spread: 0.7 });
              ctx.onEvent('shellback-seal', wx, wy);
            }
          }
        }
      }
      if (!b.seen && dist < 9) {
        b.seen = true;
        ctx.onEvent('shellback-seen', b.x, b.y);
      }

      // ---- body ----
      b.chain.follow(b.x, b.y, 1);
      light.visible = true;
      light.position.set(b.x, b.y, 0.5);
      light.intensity = 1.2 + b.curl * 0.6 + (b.stagger > 0 ? Math.sin(time * 30) * 0.8 : 0);
      const iris = time * 0.25;
      for (let i = 0; i < SEGS; i++) {
        let px = b.chain.x[i], py = b.chain.y[i], h = b.chain.heading(i);
        if (b.curl > 0) {
          // roll into a ball: segments around a circle
          const a = (i / SEGS) * Math.PI * 2 + time * 1.5;
          const r = 0.42;
          px = lerp(px, b.x + Math.cos(a) * r, b.curl);
          py = lerp(py, b.y + Math.sin(a) * r, b.curl);
          h = lerp(h, a + Math.PI / 2, b.curl);
        }
        const t = i / (SEGS - 1);
        const w = 1.05 - Math.abs(t - 0.4) * 0.55;
        const shiver = b.stagger > 0 ? Math.sin(time * 40 + i) * 0.04 : 0;
        tmpP.set(px + shiver, py, 0.2);
        tmpE.set(0, 0, h);
        tmpQ.setFromEuler(tmpE);
        tmpS.set(w * 1.15, w, w);
        tmpM.compose(tmpP, tmpQ, tmpS);
        this.plates.setMatrixAt(nP, tmpM);
        // mother-of-pearl: hue slides along the body and with time
        tmpC.setHSL((0.72 + t * 0.14 + iris) % 1, 0.32, 0.86);
        this.plates.setColorAt(nP, tmpC);
        nP++;

        // legs: one pair per plate, a wave running head→tail
        const perpX = -Math.sin(h), perpY = Math.cos(h);
        for (let s = -1; s <= 1; s += 2) {
          const ph = b.gait - i * 0.9 + (s > 0 ? Math.PI : 0);
          const swing = Math.sin(ph) * 0.14 * (1 - b.curl);
          const lift = Math.max(0, Math.cos(ph)) * 0.08 * (1 - b.curl);
          const reach = (0.38 - b.curl * 0.3);
          const fx = px + perpX * s * reach + Math.cos(h) * swing;
          const fy = py + perpY * s * reach + Math.sin(h) * swing;
          limb(this.tmpO, px + perpX * s * 0.12, py + perpY * s * 0.12, 0.22 + lift, fx, fy, 0.05, 0.05);
          this.tmpO.updateMatrix();
          this.legs.setMatrixAt(nL, this.tmpO.matrix);
          nL++;
        }
        if (i === 0) {
          for (let s = -1; s <= 1; s += 2) {
            const wave = Math.sin(time * 5 + s) * 0.18 * (1 - b.curl);
            const len = 0.7 * (1 - b.curl * 0.8);
            limb(this.tmpO, px, py, 0.3,
              px + Math.cos(h) * len + perpX * s * 0.28 + Math.cos(h + Math.PI / 2) * wave * s,
              py + Math.sin(h) * len + perpY * s * 0.28 + Math.sin(h + Math.PI / 2) * wave * s, 0.32, 0.035);
            this.tmpO.updateMatrix();
            this.feelers.setMatrixAt(nF, this.tmpO.matrix);
            nF++;
          }
        }
      }
    }
    this.plates.count = nP; this.legs.count = nL; this.feelers.count = nF;
    if (nP > 0) {
      this.plates.instanceMatrix.needsUpdate = true;
      if (this.plates.instanceColor) this.plates.instanceColor.needsUpdate = true;
      this.legs.instanceMatrix.needsUpdate = true;
      this.feelers.instanceMatrix.needsUpdate = true;
    }
  }
}
