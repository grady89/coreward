import * as THREE from 'three';
import { Terrain } from '../terrain';
import { T } from '../tiles';
import { ACTIVE } from '../worlds';
import { Particles } from '../../fx/particles';
import { FlareField } from './flares';
import {
  Creature, ThreatCtx, ThreatLevel, Chain, lerp,
  tmpM, tmpP, tmpQ, tmpS, tmpE, tmpC,
} from './types';

// THE BRINEWYRM — CRYOS-2's hunter tier. Keyed on HEAT.
//
// It lives in the cryobrine. You never see it whole: a pale glow cruising
// under the surface of a pool, a gut-light the colour of the brine itself.
// Run your engine near a pool and the glow rushes to the surface, the brine
// churns — and it BREACHES: a milk-white eel with a lamprey's ring of teeth,
// thrown clear of the pool in an arc at your nozzle. The bite is not what
// kills you. It is the drag back toward the brine.
//
// A flare thrown into a pool is heat too. Scout with it.

const SEGS = 16;
const SPACING = 0.4;
const BAND = 230;
const NOTICE = 7.5;
const GRAV = 14;
const BITE = 22;

type Phase = 'cruise' | 'churn' | 'breach' | 'fall' | 'sinking';

export class Brinewyrm implements Creature {
  alive = false;
  rumble = 0;
  timer = 10;
  phase: Phase = 'cruise';
  x = 0; y = 0;
  private vx = 0; private vy = 0;
  private dirX = 1; private dirY = 0;
  private alert = 0;
  private phaseT = 0;
  private life = 0;
  private cooldown = 0;
  private bit = false;
  private latch = 0;
  private poolX = 0; private poolY = 0;
  private wanderX = 0; private wanderY = 0;
  private wanderT = 0;
  private stunT = 0;
  private gape = 0;
  private chain = new Chain(SEGS, SPACING);

  private body: THREE.InstancedMesh;
  private bodyMat: THREE.MeshStandardMaterial;
  private gut: THREE.InstancedMesh;
  private head: THREE.Group;
  private ring: THREE.Mesh;
  private teeth: THREE.Mesh[] = [];
  private maw: THREE.Mesh;
  private light: THREE.PointLight;

  constructor(scene: THREE.Scene, private terrain: Terrain, private flares: FlareField, private particles: Particles) {
    const segGeo = new THREE.CylinderGeometry(0.3, 0.26, 0.46, 8, 1);
    segGeo.rotateZ(-Math.PI / 2);
    this.bodyMat = new THREE.MeshStandardMaterial({
      color: 0xe4f4ff, flatShading: true, roughness: 0.2, metalness: 0.05,
      transparent: true, opacity: 0.3, depthWrite: false,
      emissive: 0x1a6a80, emissiveIntensity: 0.6,
    });
    this.body = new THREE.InstancedMesh(segGeo, this.bodyMat, SEGS);
    this.body.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.body.frustumCulled = false;
    this.body.count = 0;
    this.body.setColorAt(0, tmpC.setHex(0xffffff));
    scene.add(this.body);

    // the gut-light: a spine of cyan knots you see through the body
    const gutGeo = new THREE.SphereGeometry(0.1, 6, 5);
    const gutMat = new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: 0.9 });
    this.gut = new THREE.InstancedMesh(gutGeo, gutMat, SEGS);
    this.gut.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.gut.frustumCulled = false;
    this.gut.count = 0;
    this.gut.setColorAt(0, tmpC.setHex(0xffffff));
    scene.add(this.gut);

    // the head is a mouth: a ring of teeth around a lit throat, no eyes, no jaw
    this.head = new THREE.Group();
    const fleshMat = new THREE.MeshStandardMaterial({
      color: 0xd8ecf8, flatShading: true, roughness: 0.25, metalness: 0.05,
      transparent: true, opacity: 0.85,
    });
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.11, 6, 10), fleshMat);
    this.ring.rotation.y = Math.PI / 2;
    this.ring.position.x = 0.2;
    const toothGeo = new THREE.ConeGeometry(0.05, 0.22, 4);
    const toothMat = new THREE.MeshStandardMaterial({ color: 0xf8ffff, flatShading: true, roughness: 0.1, metalness: 0.2 });
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const tooth = new THREE.Mesh(toothGeo, toothMat);
      tooth.position.set(0.25, Math.cos(a) * 0.24, Math.sin(a) * 0.24);
      // points inward, toward the throat axis
      tooth.rotation.x = a + Math.PI / 2;
      tooth.rotation.z = 0;
      tooth.userData.a = a;
      this.teeth.push(tooth);
      this.head.add(tooth);
    }
    this.maw = new THREE.Mesh(
      new THREE.CircleGeometry(0.22, 10),
      new THREE.MeshBasicMaterial({ color: 0x5ad8e6, toneMapped: false, side: THREE.DoubleSide }),
    );
    this.maw.rotation.y = Math.PI / 2;
    this.maw.position.x = 0.12;
    this.light = new THREE.PointLight(0x5ad8e6, 0, 7, 1.6);
    this.light.position.set(0, 0, 0.4);
    this.head.add(this.ring, this.maw, this.light);
    this.head.visible = false;
    scene.add(this.head);
  }

  reset(): void {
    this.alive = false;
    this.body.count = 0; this.gut.count = 0;
    this.head.visible = false;
    this.rumble = 0;
  }

  private die(): void {
    this.alive = false;
    this.body.count = 0; this.gut.count = 0;
    this.head.visible = false;
  }

  private brine(x: number, y: number): boolean { return this.terrain.get(x, y) === T.LAVA; }

  /** connected brine tiles from (x, y), counted up to `cap` — a wyrm is six
   *  tiles of body and will not live in a puddle */
  private poolSize(x: number, y: number, cap: number): number {
    const seen = new Set<number>();
    const stack = [x + y * this.terrain.w];
    while (stack.length > 0 && seen.size < cap) {
      const i = stack.pop()!;
      if (seen.has(i)) continue;
      const px = i % this.terrain.w, py = Math.floor(i / this.terrain.w);
      if (!this.brine(px, py)) continue;
      seen.add(i);
      stack.push(i - 1, i + 1, i - this.terrain.w, i + this.terrain.w);
    }
    return seen.size;
  }

  private trySpawn(podX: number, podY: number): boolean {
    const cx = Math.floor(podX), cy = Math.floor(-podY);
    let best = -1, bx = 0, by = 0;
    for (let attempt = 0; attempt < 60; attempt++) {
      const x = cx + Math.floor((Math.random() - 0.5) * 26);
      const y = cy + Math.floor((Math.random() - 0.5) * 26);
      if (x < 1 || x >= this.terrain.w - 1 || y < BAND) continue;
      if (!this.brine(x, y)) continue;
      if (this.poolSize(x, y, 10) < 10) continue;
      const d = Math.hypot(x + 0.5 - podX, -(y + 0.5) - podY);
      if (d < 5) continue;
      // prefer pools with a free surface above — the ones you fly over
      const score = (this.brine(x, y - 1) ? 0 : 2) + (this.brine(x + 1, y) || this.brine(x - 1, y) ? 1 : 0);
      if (score > best) { best = score; bx = x; by = y; }
    }
    if (best < 0) return false;
    this.alive = true;
    this.phase = 'cruise'; this.phaseT = 0;
    this.x = bx + 0.5; this.y = -(by + 0.5);
    this.poolX = this.x; this.poolY = this.y;
    this.vx = 0; this.vy = 0;
    this.dirX = 1; this.dirY = 0;
    this.alert = 0; this.life = 0; this.cooldown = 3; this.latch = 0; this.stunT = 0; this.gape = 0;
    this.wanderT = 0;
    this.chain.lay(this.x, this.y, 1, 0);
    this.head.visible = true;
    return true;
  }

  blast(x: number, y: number, radius: number): void {
    if (this.alive && Math.hypot(this.x - x, this.y - y) < radius + 1) {
      this.particles.sparkBurst(this.x, this.y, 0x5ad8e6, { count: 24, speed: 4, up: 2, life: 1, gravity: 6, spread: 0.6 });
      this.die();
    }
  }

  lance(x: number, y: number, dir: number, range: number): void {
    if (!this.alive) return;
    const dx = (this.x - x) * dir;
    if (dx > -0.5 && dx < range && Math.abs(this.y - y) < 1.3) { this.stunT = 2.5; this.latch = 0; }
  }

  drillHit(x: number, y: number): void {
    if (this.alive && this.phase === 'breach' && Math.hypot(this.x - x, this.y - y) < 1) { this.latch = 0; this.phase = 'fall'; this.phaseT = 0; }
  }

  /** cruise inside the pool: pick a brine tile to swim to, swim there */
  private cruise(dt: number): void {
    this.wanderT -= dt;
    if (this.wanderT <= 0 || Math.hypot(this.wanderX - this.x, this.wanderY - this.y) < 0.6) {
      this.wanderT = 1.5 + Math.random() * 2;
      const cx = Math.floor(this.x), cy = Math.floor(-this.y);
      for (let k = 0; k < 12; k++) {
        const x = cx + Math.floor((Math.random() - 0.5) * 9);
        const y = cy + Math.floor((Math.random() - 0.5) * 7);
        if (this.brine(x, y)) { this.wanderX = x + 0.5; this.wanderY = -(y + 0.5); break; }
      }
    }
    const dx = this.wanderX - this.x, dy = this.wanderY - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const sp = 2.2;
    const cand: [number, number][] = [[dx / d, dy / d], [Math.sign(dx), 0], [0, Math.sign(dy)], [this.dirX, this.dirY]];
    for (const [cx, cy] of cand) {
      if (cx === 0 && cy === 0) continue;
      const len = Math.hypot(cx, cy) || 1;
      const nx = this.x + (cx / len) * sp * dt, ny = this.y + (cy / len) * sp * dt;
      if (this.brine(Math.floor(nx), Math.floor(-ny))) {
        this.x = nx; this.y = ny;
        this.dirX = lerp(this.dirX, cx / len, Math.min(1, dt * 4));
        this.dirY = lerp(this.dirY, cy / len, Math.min(1, dt * 4));
        return;
      }
    }
    this.wanderT = 0;
  }

  devStage(x: number, y: number): void {
    if (!this.alive && !this.trySpawn(x, y)) return;
    // trySpawn deliberately refuses pools within 5 tiles and prefers whatever
    // natural brine is nearest — both wrong for a sandbox, where the pool
    // under your nozzle IS the test. Put it in the closest brine there is.
    const cx = Math.floor(x), cy = Math.floor(-y);
    let best = Infinity, bx = -1, by = -1;
    for (let dy = -8; dy <= 8; dy++) {
      for (let dx = -8; dx <= 8; dx++) {
        const tx = cx + dx, ty = cy + dy;
        if (!this.brine(tx, ty)) continue;
        const d = dx * dx + dy * dy;
        if (d < best) { best = d; bx = tx; by = ty; }
      }
    }
    if (bx < 0) return;
    this.x = this.poolX = bx + 0.5;
    this.y = this.poolY = -(by + 0.5);
    this.phase = 'cruise'; this.phaseT = 0;
    this.alert = 0; this.cooldown = 0; this.stunT = 0; this.wanderT = 0;
    this.chain.lay(this.x, this.y, 1, 0);
  }

  update(ctx: ThreatCtx, level: ThreatLevel): void {
    const { dt, podX, podY, time } = ctx;
    if (!this.alive) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = 9 + Math.random() * 10;
        if (Math.floor(-podY) >= BAND && Math.random() < (level === 'reduced' ? 0.4 : 0.8)) this.trySpawn(podX, podY);
      }
      if (!this.alive) { this.rumble += (0 - this.rumble) * Math.min(1, dt * 2); return; }
    }

    this.life += dt;
    this.phaseT += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.stunT = Math.max(0, this.stunT - dt);
    const dx = podX - this.x, dy = podY - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 40 || this.life > 240) { this.die(); return; }

    const flare = this.flares.near(this.x, this.y, 6);
    const submerged = this.brine(Math.floor(this.x), Math.floor(-this.y));
    let rumbleT = 0;

    switch (this.phase) {
      case 'cruise': {
        this.cruise(dt);
        // heat within reach: engine near the pool, or a flare in it
        const warm = (ctx.thrust > 0.05 && dist < NOTICE) || !!flare;
        if (warm && this.cooldown <= 0 && this.stunT <= 0) this.alert = Math.min(1, this.alert + dt * 0.9);
        else this.alert = Math.max(0, this.alert - dt * 0.5);
        if (this.alert >= 1) {
          this.phase = 'churn'; this.phaseT = 0;
          ctx.onEvent('brinewyrm-churn', this.x, this.y);
        }
        rumbleT = this.alert * 0.5;
        break;
      }
      case 'churn': {
        // the glow comes up: surface bubbles for a full second before it goes
        if (Math.random() < dt * 14) {
          this.particles.sparkBurst(this.x + (Math.random() - 0.5) * 1.5, this.y + 0.4, ACTIVE.fluid.pulseA, { count: 2, speed: 1.6, up: 3, life: 0.6, gravity: 6, spread: 0.3 });
        }
        rumbleT = 0.7;
        if (this.phaseT >= 1.0) {
          const tx = flare ? flare.x : podX;
          const ty = flare ? flare.y : podY - 0.4;
          const ddx = tx - this.x, ddy = ty - this.y;
          const dd = Math.hypot(ddx, ddy);
          const tf = Math.min(0.95, Math.max(0.45, dd / 12));
          this.vx = ddx / tf;
          this.vy = ddy / tf + 0.5 * GRAV * tf;
          this.phase = 'breach'; this.phaseT = 0; this.bit = false; this.latch = 0;
          ctx.shake(0.3);
          ctx.onEvent('brinewyrm-breach', this.x, this.y);
          this.particles.sparkBurst(this.x, this.y + 0.3, ACTIVE.fluid.pulseA, { count: 30, speed: 5, up: 4, life: 0.9, gravity: 10, spread: 0.9 });
        }
        break;
      }
      case 'breach':
      case 'fall': {
        this.vy -= GRAV * dt;
        const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
        if (this.terrain.solidAt(Math.floor(nx), Math.floor(-this.y))) { this.vx *= -0.2; } else { this.x = nx; }
        if (this.terrain.solidAt(Math.floor(this.x), Math.floor(-ny))) { this.vy = 0; this.vx *= 0.5; } else { this.y = ny; }
        const sp = Math.hypot(this.vx, this.vy);
        if (sp > 0.5) { this.dirX = this.vx / sp; this.dirY = this.vy / sp; }
        rumbleT = 0.8;
        if (this.phase === 'breach') {
          this.gape = lerp(this.gape, dist < 2.5 ? 1 : 0.3, Math.min(1, dt * 8));
          if (!this.bit && dist < 1.05) {
            this.bit = true;
            this.latch = 1.0;
            ctx.hurt(BITE * (level === 'reduced' ? 0.5 : 1), 'a Brinewyrm');
            ctx.shake(0.4);
            ctx.onEvent('brinewyrm-bite', this.x, this.y);
            // and it turns for home with you in its mouth
            const px = this.poolX - this.x, py = this.poolY - this.y;
            const pd = Math.hypot(px, py) || 1;
            this.vx = px / pd * 7; this.vy = py / pd * 7 + 2;
          }
          if (this.phaseT > 2.2 || (this.phaseT > 0.4 && this.vy < 0 && submerged)) { this.phase = 'fall'; this.phaseT = 0; }
        }
        if (this.latch > 0) {
          this.latch -= dt;
          const px = this.poolX - podX, py = this.poolY - podY;
          const pd = Math.hypot(px, py) || 1;
          const pull = (level === 'reduced' ? 14 : 24) * dt;
          ctx.push(px / pd * pull, py / pd * pull);
          if (Math.random() < dt * 20) {
            this.particles.sparkBurst(podX, podY, ACTIVE.fluid.pulseA, { count: 1, speed: 1, up: 1, life: 0.5, gravity: 8, spread: 0.6 });
          }
        }
        if (this.phase === 'fall' && (submerged || this.phaseT > 3)) {
          this.phase = 'sinking'; this.phaseT = 0;
          this.particles.sparkBurst(this.x, this.y + 0.3, ACTIVE.fluid.pulseA, { count: 16, speed: 3, up: 3, life: 0.7, gravity: 9, spread: 0.7 });
        }
        break;
      }
      case 'sinking': {
        this.vx *= 1 - Math.min(1, dt * 3); this.vy = -1.2;
        const ny = this.y + this.vy * dt;
        if (this.brine(Math.floor(this.x), Math.floor(-ny))) this.y = ny;
        this.gape = lerp(this.gape, 0, Math.min(1, dt * 4));
        if (this.phaseT > 1.2) {
          this.phase = 'cruise'; this.phaseT = 0; this.alert = 0; this.cooldown = 6;
          if (!submerged) { this.x = this.poolX; this.y = this.poolY; this.chain.lay(this.x, this.y, 1, 0); }
          this.poolX = this.x; this.poolY = this.y;
        }
        rumbleT = 0.3;
        break;
      }
    }
    this.rumble += (rumbleT - this.rumble) * Math.min(1, dt * 3);

    // ---- body ----
    this.chain.follow(this.x, this.y, this.phase === 'breach' ? 0.85 : 1);
    const inWater = this.phase === 'cruise' || this.phase === 'sinking' || this.phase === 'churn';
    this.bodyMat.opacity = lerp(this.bodyMat.opacity, inWater ? 0.28 : 0.78, Math.min(1, dt * 4));
    const glow = this.phase === 'churn' ? 1 : this.phase === 'cruise' ? 0.35 + this.alert * 0.5 : 0.75;
    const swim = this.phase === 'cruise' ? 0.12 : 0.06;
    for (let i = 0; i < SEGS; i++) {
      const h = this.chain.heading(i);
      const wave = Math.sin(time * 6 - i * 0.6) * swim * (0.2 + i / SEGS);
      const px = this.chain.x[i] - Math.sin(h) * wave;
      const py = this.chain.y[i] + Math.cos(h) * wave;
      const z = inWater ? 0.55 : 0.15;
      if (i === 0) {
        this.head.position.set(px, py, z);
        this.head.rotation.set(0, 0, h);
        for (const t of this.teeth) {
          const a = t.userData.a as number;
          const r = 0.24 + this.gape * 0.1;
          t.position.set(0.25 + this.gape * 0.12, Math.cos(a) * r, Math.sin(a) * r);
          t.rotation.x = a + Math.PI / 2 - this.gape * 0.5;
        }
        this.ring.scale.setScalar(1 + this.gape * 0.35);
        this.maw.scale.setScalar(0.5 + this.gape * 0.9 + glow * 0.3);
        this.light.intensity = 1.5 + glow * 7 + this.gape * 2;
        tmpM.makeScale(0, 0, 0);
        this.body.setMatrixAt(0, tmpM);
        this.gut.setMatrixAt(0, tmpM);
        continue;
      }
      const t = i / SEGS;
      const taper = 1.05 - t * 0.7;
      tmpP.set(px, py, z);
      tmpE.set(time * 0.8 + i * 0.3, 0, h);
      tmpQ.setFromEuler(tmpE);
      tmpS.set(1, taper, taper);
      tmpM.compose(tmpP, tmpQ, tmpS);
      this.body.setMatrixAt(i, tmpM);
      tmpC.setHex(0xe8f6ff).multiplyScalar(0.7 + glow * 0.5);
      this.body.setColorAt(i, tmpC);
      // the gut pulses head → tail, the opposite way to a Long One's spine
      const pulse = Math.pow(Math.max(0, Math.sin(time * 3.5 - i * 0.7)), 2);
      tmpP.z += 0.02;
      tmpS.setScalar((0.7 + pulse * 0.6) * (1 - t * 0.4));
      tmpM.compose(tmpP, tmpQ, tmpS);
      this.gut.setMatrixAt(i, tmpM);
      tmpC.setHex(ACTIVE.fluid.pulseA).multiplyScalar(0.4 + pulse * 0.8 + glow * 1.2);
      this.gut.setColorAt(i, tmpC);
    }
    this.body.count = SEGS; this.gut.count = SEGS;
    this.body.instanceMatrix.needsUpdate = true;
    this.gut.instanceMatrix.needsUpdate = true;
    if (this.body.instanceColor) this.body.instanceColor.needsUpdate = true;
    if (this.gut.instanceColor) this.gut.instanceColor.needsUpdate = true;
  }
}
