import * as THREE from 'three';
import { Terrain } from '../terrain';
import { rockColor } from '../tiles';
import { Particles } from '../../fx/particles';
import {
  Creature, ThreatCtx, ThreatLevel, Chain, wide, lerp, clamp01,
  tmpM, tmpP, tmpQ, tmpS, tmpE, tmpC,
} from './types';

// THE LONG ONES — VEIL-3's hunter tier. They hunt by VIBRATION.
//
// You hear it first: the rumble ticks, the dust jumping off the tunnel walls
// in a line that is coming toward you. Then a wall bursts and the head comes
// through — eyeless, a split mandible, a body of overlapping chitin plates
// with a line of dorsal lights that pulse from the tail toward the head, so
// the direction of the wave tells you which way it is moving. It fills a
// passage. It cannot follow you into a 1-wide shaft.
//
// It cannot see. It feels you: engine, drill, hull scraping rock. Cut the
// engine, stop the drill, sit still — and it loses you. It will cast about,
// close enough to touch, and then go back into the rock.

const SEGS = 14;
const SPACING = 0.5;
const BAND = 300;
const SPEED = 4.8;
const HUNT = 17;
const DAMAGE = 26;
const STILL_TO_LOSE = 2.2;

type Phase = 'emerging' | 'hunting' | 'searching' | 'burrowing';

export class LongOne implements Creature {
  alive = false;
  rumble = 0;
  timer = 12;
  phase: Phase = 'hunting';
  x = 0; y = 0;
  private dirX = 1; private dirY = 0;
  private life = 0;
  private stuck = 0;
  private stunT = 0;
  private lostT = 0;
  private phaseT = 0;
  private gape = 0;
  private biteT = 0;
  private spawnX = 0; private spawnY = 0;   // rock it came out of / goes into
  private outX = 0; private outY = 0;
  private wander = 0;
  private dustAcc = 0;
  private chain = new Chain(SEGS, SPACING);

  private body: THREE.InstancedMesh;
  private lights: THREE.InstancedMesh;
  private head: THREE.Group;
  private jawL: THREE.Mesh;
  private jawR: THREE.Mesh;
  private throat: THREE.Mesh;
  private throatLight: THREE.PointLight;

  constructor(scene: THREE.Scene, private terrain: Terrain, private particles: Particles) {
    // a plated ring segment, axis along +X so it lies along the spine
    const segGeo = new THREE.CylinderGeometry(0.38, 0.31, 0.56, 7, 1);
    segGeo.rotateZ(-Math.PI / 2);
    const segMat = new THREE.MeshStandardMaterial({
      flatShading: true, roughness: 0.42, metalness: 0.45,
      emissive: 0x1a0806, emissiveIntensity: 1,
    });
    this.body = new THREE.InstancedMesh(segGeo, segMat, SEGS);
    this.body.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.body.frustumCulled = false;
    this.body.count = 0;
    this.body.setColorAt(0, tmpC.setHex(0xffffff));
    scene.add(this.body);

    // dorsal lights: one per plate, pulsing tail-to-head
    const dotGeo = new THREE.SphereGeometry(0.09, 6, 5);
    const dotMat = new THREE.MeshBasicMaterial({ toneMapped: false });
    this.lights = new THREE.InstancedMesh(dotGeo, dotMat, SEGS);
    this.lights.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.lights.frustumCulled = false;
    this.lights.count = 0;
    this.lights.setColorAt(0, tmpC.setHex(0xffffff));
    scene.add(this.lights);

    // the head: a blunt wedge, no eyes, a split jaw that opens as it closes on you
    this.head = new THREE.Group();
    const skullMat = new THREE.MeshStandardMaterial({
      color: 0x5a2a22, flatShading: true, roughness: 0.4, metalness: 0.5, emissive: 0x200806,
    });
    const skull = new THREE.Mesh(new THREE.ConeGeometry(0.46, 1.0, 7), skullMat);
    skull.rotation.z = -Math.PI / 2;
    skull.position.x = 0.2;
    const jawGeo = new THREE.ConeGeometry(0.16, 0.9, 4);
    jawGeo.translate(0, 0.45, 0);
    jawGeo.rotateZ(-Math.PI / 2);
    const jawMat = new THREE.MeshStandardMaterial({
      color: 0x2a1410, flatShading: true, roughness: 0.3, metalness: 0.7,
    });
    this.jawL = new THREE.Mesh(jawGeo, jawMat);
    this.jawR = new THREE.Mesh(jawGeo, jawMat);
    this.jawL.position.set(0.55, 0.16, 0);
    this.jawR.position.set(0.55, -0.16, 0);
    this.throat = new THREE.Mesh(
      new THREE.CircleGeometry(0.26, 8),
      new THREE.MeshBasicMaterial({ color: 0xff6a2a, toneMapped: false, side: THREE.DoubleSide }),
    );
    this.throat.position.set(0.62, 0, 0);
    this.throat.rotation.y = Math.PI / 2;
    this.throatLight = new THREE.PointLight(0xff5a2a, 0, 4, 2);
    this.throatLight.position.set(0.7, 0, 0.3);
    this.head.add(skull, this.jawL, this.jawR, this.throat, this.throatLight);
    this.head.visible = false;
    scene.add(this.head);
  }

  reset(): void {
    this.alive = false;
    this.body.count = 0;
    this.lights.count = 0;
    this.head.visible = false;
    this.rumble = 0;
  }

  private die(): void {
    this.alive = false;
    this.body.count = 0;
    this.lights.count = 0;
    this.head.visible = false;
  }

  private trySpawn(podX: number, podY: number): boolean {
    for (let attempt = 0; attempt < 40; attempt++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 13 + Math.random() * 8;
      const x = Math.round(podX + Math.cos(ang) * dist);
      const y = Math.round(-podY + Math.sin(ang) * dist);
      if (y < BAND || x < 2 || x >= this.terrain.w - 2) continue;
      if (!wide(this.terrain, x, y)) continue;
      // a wall next to the pocket for it to come out of
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (let k = 0; k < 4; k++) {
        const [dx, dy] = dirs[(attempt + k) % 4];
        if (!this.terrain.solidAt(x + dx, y + dy) || !this.terrain.solidAt(x + dx * 2, y + dy * 2)) continue;
        this.alive = true;
        this.phase = 'emerging'; this.phaseT = 0;
        this.outX = x + 0.5; this.outY = -(y + 0.5);
        this.spawnX = x + dx * 2 + 0.5; this.spawnY = -(y + dy * 2 + 0.5);
        this.x = this.spawnX; this.y = this.spawnY;
        this.dirX = -dx; this.dirY = dy;
        this.chain.lay(this.x, this.y, -dx, dy);
        this.life = 0; this.stuck = 0; this.stunT = 0; this.lostT = 0;
        this.gape = 0; this.biteT = 0; this.wander = Math.random() * 6;
        this.head.visible = true;
        return true;
      }
    }
    return false;
  }

  drillHit(x: number, y: number, dt: number): void {
    if (this.alive && Math.hypot(this.x - x, this.y - y) < 1.1) this.stuck += dt * 2.5;
  }

  blast(x: number, y: number, radius: number): void {
    if (!this.alive) return;
    for (let i = 0; i < SEGS; i++) {
      if (Math.hypot(this.chain.x[i] - x, this.chain.y[i] - y) < radius + 1) {
        for (let k = 0; k < SEGS; k += 2) {
          this.particles.dustBurst(this.chain.x[k], this.chain.y[k], 0x4a2a22, { count: 6, speed: 4, up: 2, life: 1, gravity: 8, spread: 0.5 });
        }
        this.die();
        this.rumble = 0;
        return;
      }
    }
  }

  lance(x: number, y: number, dir: number, range: number): void {
    if (!this.alive) return;
    const dx = (this.x - x) * dir;
    if (dx > -0.5 && dx < range && Math.abs(this.y - y) < 1.3) this.stunT = 3;
  }

  /** steer toward a point through passages wide enough for its bulk */
  private steer(tx: number, ty: number, speed: number, dt: number): boolean {
    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const wx = dx / d, wy = dy / d;
    const step = speed * dt;
    const cand: [number, number][] = [
      [wx, wy], [Math.sign(wx), 0], [0, Math.sign(wy)], [this.dirX, this.dirY],
      [-Math.sign(wy) || 1, 0], [0, -Math.sign(wx) || 1],
    ];
    for (const [cx, cy] of cand) {
      if (cx === 0 && cy === 0) continue;
      const len = Math.hypot(cx, cy) || 1;
      const nx = this.x + (cx / len) * step;
      const ny = this.y + (cy / len) * step;
      if (wide(this.terrain, Math.floor(nx), Math.floor(-ny))) {
        this.x = nx; this.y = ny;
        // turn the heading smoothly so the body carves arcs, not corners
        this.dirX = lerp(this.dirX, cx / len, Math.min(1, dt * 6));
        this.dirY = lerp(this.dirY, cy / len, Math.min(1, dt * 6));
        return true;
      }
    }
    return false;
  }

  devStage(x: number, y: number): void {
    // it needs a wall to come out of, so let trySpawn pick its own ground:
    // watching it choose a wall and burst through is the thing being tested
    if (!this.alive) this.trySpawn(x, y);
  }

  update(ctx: ThreatCtx, level: ThreatLevel): void {
    const { dt, podX, podY, time } = ctx;
    if (!this.alive) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = 16 + Math.random() * 20;
        if (Math.floor(-podY) >= BAND && Math.random() < (level === 'reduced' ? 0.3 : 0.65)) {
          if (this.trySpawn(podX, podY)) ctx.onEvent('longone-emerge', this.outX, this.outY);
        }
      }
      if (!this.alive) {
        this.rumble += (0 - this.rumble) * Math.min(1, dt * 2);
        return;
      }
    }

    this.life += dt;
    this.phaseT += dt;
    const dx = podX - this.x, dy = podY - this.y;
    const dist = Math.hypot(dx, dy);
    const speedMul = level === 'reduced' ? 0.75 : 1;
    let moving = 0;

    if (this.stunT > 0) {
      // lanced: it recoils in place, all light and no appetite
      this.stunT -= dt;
      this.rumble += (0.3 - this.rumble) * Math.min(1, dt * 2);
    } else if (this.phase === 'emerging') {
      // the wall gives way — the head drives out of the rock into the pocket
      const f = clamp01(this.phaseT / 1.4);
      this.x = lerp(this.spawnX, this.outX, f);
      this.y = lerp(this.spawnY, this.outY, f);
      this.dustAcc += dt;
      if (this.dustAcc > 0.12) {
        this.dustAcc = 0;
        const wallX = Math.floor(this.outX + (this.spawnX - this.outX) * 0.5);
        const wallY = Math.floor(-(this.outY + (this.spawnY - this.outY) * 0.5));
        this.particles.dustBurst(this.outX, this.outY, rockColor(this.terrain.get(wallX, wallY), wallX, wallY),
          { count: 6, speed: 3.5, up: 1.5, life: 0.9, gravity: 9, spread: 0.8 });
      }
      ctx.shake(0.08);
      this.rumble += (1 - this.rumble) * Math.min(1, dt * 4);
      moving = 1;
      if (f >= 1) { this.phase = 'hunting'; this.phaseT = 0; }
    } else if (this.phase === 'burrowing') {
      const f = clamp01(this.phaseT / 1.3);
      this.x = lerp(this.outX, this.spawnX, f);
      this.y = lerp(this.outY, this.spawnY, f);
      this.dustAcc += dt;
      if (this.dustAcc > 0.15) {
        this.dustAcc = 0;
        this.particles.dustBurst(this.outX, this.outY, 0x4a3a32, { count: 4, speed: 2.5, up: 1.2, life: 0.8, gravity: 9, spread: 0.7 });
      }
      this.rumble += (0.6 - this.rumble) * Math.min(1, dt * 2);
      moving = 1;
      if (f >= 1) { this.die(); return; }
    } else {
      // it hears engine, drill and hull. A still pod is a stone.
      const heard = dist < 5 || (ctx.still < STILL_TO_LOSE && dist < HUNT);
      if (this.phase === 'hunting') {
        if (!heard) this.lostT += dt; else this.lostT = 0;
        if (this.lostT > 1.0) {
          this.phase = 'searching'; this.phaseT = 0;
          ctx.onEvent('longone-lost', this.x, this.y);
        }
      } else if (heard) {
        this.phase = 'hunting'; this.phaseT = 0; this.lostT = 0;
      }

      if (dist > 44 || this.life > 90 || this.stuck > 6 || (this.phase === 'searching' && this.phaseT > 9)) {
        // it leaves the way it came: into the nearest rock
        this.phase = 'burrowing'; this.phaseT = 0;
        this.outX = this.x; this.outY = this.y;
        let bx = this.x, by = this.y;
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const [ddx, ddy] of dirs) {
          if (this.terrain.solidAt(Math.floor(this.x) + ddx, Math.floor(-this.y) - ddy)) {
            bx = this.x + ddx * 2.5; by = this.y + ddy * 2.5; break;
          }
        }
        this.spawnX = bx; this.spawnY = by;
        return;
      }

      let tx: number, ty: number, sp: number;
      if (this.phase === 'hunting') {
        tx = podX; ty = podY;
        sp = SPEED * speedMul * (dist < HUNT ? 1 : 0.55);
      } else {
        // casting about: a slow figure-eight around where it last felt you
        this.wander += dt * 0.9;
        tx = this.x + Math.cos(this.wander) * 3 + Math.cos(this.wander * 0.5) * 2;
        ty = this.y + Math.sin(this.wander * 2) * 1.5;
        sp = SPEED * speedMul * 0.4;
      }
      const moved = this.steer(tx, ty, sp, dt);
      this.stuck = moved ? 0 : this.stuck + dt;
      moving = moved ? sp / SPEED : 0;

      // the jaw opens as it closes; the bite lands on a beat
      const wantGape = this.phase === 'hunting' && dist < 3.2 ? 1 : 0;
      this.gape = lerp(this.gape, wantGape, Math.min(1, dt * 7));
      if (dist < 1.0 && this.phase === 'hunting') {
        ctx.hurt(DAMAGE * (level === 'reduced' ? 0.5 : 1) * dt, 'a Long One');
        this.biteT -= dt;
        if (this.biteT <= 0) {
          this.biteT = 0.55;
          this.gape = 0;
          ctx.shake(0.3);
          ctx.push(this.dirX * 2.5, this.dirY * 2.5);
          ctx.onEvent('longone-bite', this.x, this.y);
        }
      }
      const target = this.phase === 'hunting' ? Math.max(0.15, 1 - dist / 22) : 0.12;
      this.rumble += (target - this.rumble) * Math.min(1, dt * 3);
    }

    // scraping the walls as it moves: dust off the tunnel it fills
    if (moving > 0.3 && this.phase !== 'emerging' && this.phase !== 'burrowing' && Math.random() < dt * 5) {
      const k = 2 + Math.floor(Math.random() * 6);
      this.particles.dustBurst(this.chain.x[k], this.chain.y[k], 0x3a2a24, { count: 2, speed: 1.5, up: 0.5, life: 0.6, gravity: 7, spread: 0.6 });
    }

    // ---- body ----
    this.chain.follow(this.x, this.y, this.stunT > 0 ? 0.6 : 1);
    const thrash = this.stunT > 0 ? 0.45 : 0;
    const amp = 0.16 * moving + thrash;
    const hunting = this.phase === 'hunting' || this.phase === 'emerging';
    for (let i = 0; i < SEGS; i++) {
      const h = this.chain.heading(i);
      const wave = Math.sin(time * (7 + thrash * 6) - i * 0.75) * amp * (0.3 + i / SEGS);
      const px = this.chain.x[i] - Math.sin(h) * wave;
      const py = this.chain.y[i] + Math.cos(h) * wave;
      if (i === 0) {
        this.head.position.set(px, py, 0.1);
        this.head.rotation.set(Math.sin(time * 2.2) * 0.25, 0, h);
        const g = this.gape;
        this.jawL.rotation.z = g * 0.75;
        this.jawR.rotation.z = -g * 0.75;
        this.throat.scale.setScalar(0.4 + g * 0.8);
        this.throatLight.intensity = g * 3 + (this.stunT > 0 ? 2 : 0);
        // instance 0 belongs to the head group — collapse it
        tmpM.makeScale(0, 0, 0);
        this.body.setMatrixAt(0, tmpM);
        this.lights.setMatrixAt(0, tmpM);
        continue;
      }
      // plates bulge behind the head then taper to the tail
      const t = i / SEGS;
      const taper = (i < 4 ? 1.05 : 1.08 - t * 0.62);
      tmpP.set(px, py, 0.1);
      tmpE.set(time * 1.6 + i * 0.5, 0, h);
      tmpQ.setFromEuler(tmpE);
      tmpS.set(1, taper, taper);
      tmpM.compose(tmpP, tmpQ, tmpS);
      this.body.setMatrixAt(i, tmpM);
      // alternating plates: gloss and matte, darker toward the tail
      tmpC.setHex(i % 2 ? 0x6a3428 : 0x3a201c).multiplyScalar(1 - t * 0.25);
      this.body.setColorAt(i, tmpC);

      // the dorsal wave runs tail → head while it hunts; still and dim when lost
      const pulse = hunting ? Math.pow(Math.max(0, Math.sin(time * 5 + i * 0.9)), 3) : 0.12;
      const stun = this.stunT > 0 ? 1 : 0;
      tmpP.set(px - Math.sin(h) * 0.3, py + Math.cos(h) * 0.3, 0.35);
      tmpS.setScalar(0.6 + pulse * 0.9 + stun * 0.6);
      tmpM.compose(tmpP, tmpQ, tmpS);
      this.lights.setMatrixAt(i, tmpM);
      tmpC.setHex(stun ? 0xffffff : 0xff7a3c).multiplyScalar(0.25 + pulse * 1.4 + stun);
      this.lights.setColorAt(i, tmpC);
    }
    this.body.count = SEGS; this.lights.count = SEGS;
    this.body.instanceMatrix.needsUpdate = true;
    this.lights.instanceMatrix.needsUpdate = true;
    if (this.body.instanceColor) this.body.instanceColor.needsUpdate = true;
    if (this.lights.instanceColor) this.lights.instanceColor.needsUpdate = true;
  }
}
