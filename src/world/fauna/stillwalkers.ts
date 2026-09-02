import * as THREE from 'three';
import { Terrain } from '../terrain';
import { Particles } from '../../fx/particles';
import { FlareField } from './flares';
import { Creature, ThreatCtx, ThreatLevel, limb, clamp01 } from './types';

// STILLWALKERS — CRYOS-2's stalker tier. Keyed on the ABSENCE of light.
//
// Tall. Too tall. A figure in the rock, black as a cut-out, standing where
// there was nothing a second ago. While your lamp is on it, it does not
// move — not a tremor. Turn the lamp off, and it walks. Through the rock,
// through the ice, straight at you, with a gait that is almost right.
//
// The body is built from black shards — every part an elongated octahedron,
// so limbs taper to points at the joints and the silhouette reads as
// something cut from obsidian, not stacked from crates. Two uneven spurs
// off the shoulders keep the outline wrong at a glance. Walking, the head
// hangs at a tilt; lit, it straightens — which is worse.
//
// The cold worlds' rule inverts here: dark hides you from the Wardens and
// feeds you to these. Manage your light.

const MAX = 2;
const HEIGHT = 2.5;
const SPEED = 2.4;
const LIT_RANGE = 7.5;
const BAND = 200;

interface Walker {
  alive: boolean;
  x: number; y: number;
  dirX: number;
  gait: number;
  lit: number;      // 0..1 smoothed
  seen: boolean;
  life: number;
  sinkT: number;
  inRock: boolean;
  group: THREE.Group;
  parts: THREE.Mesh[];
  rims: THREE.Mesh[];
  bodyMat: THREE.MeshBasicMaterial;
  rimMat: THREE.MeshBasicMaterial;
  // joints (local)
  head: THREE.Mesh; torso: THREE.Mesh; pelvis: THREE.Mesh;
  limbs: THREE.Mesh[]; // upperL, foreL, upperR, foreR, thighL, shinL, thighR, shinR
  spurs: THREE.Mesh[]; // two uneven shoulder shards
  tilt: number;        // head hang, smoothed
}

export class Stillwalkers implements Creature {
  walkers: Walker[] = [];
  /** 0..1 — something unlit is walking toward you */
  dread = 0;
  spawnTimer = 12;

  constructor(scene: THREE.Scene, private terrain: Terrain, private flares: FlareField, private particles: Particles) {
    // one shard for everything: an octahedron spanning ±0.5 like the old unit
    // box, so limb() and the scale math carry over — but every piece now
    // tapers to a point at both ends instead of ending in a flat face
    const shard = new THREE.OctahedronGeometry(0.5, 0);
    for (let i = 0; i < MAX; i++) {
      const bodyMat = new THREE.MeshBasicMaterial({ color: 0x04070c, transparent: true, opacity: 1 });
      const rimMat = new THREE.MeshBasicMaterial({ color: 0x9ad0ff, transparent: true, opacity: 0.3, side: THREE.BackSide, depthWrite: false });
      const group = new THREE.Group();
      const parts: THREE.Mesh[] = [];
      const rims: THREE.Mesh[] = [];
      const mk = (): THREE.Mesh => {
        const m = new THREE.Mesh(shard, bodyMat);
        const r = new THREE.Mesh(shard, rimMat);
        group.add(m, r);
        parts.push(m); rims.push(r);
        return m;
      };
      const head = mk(), torso = mk(), pelvis = mk();
      const limbs: THREE.Mesh[] = [];
      for (let k = 0; k < 8; k++) limbs.push(mk());
      const spurs = [mk(), mk()];
      group.visible = false;
      scene.add(group);
      this.walkers.push({
        alive: false, x: 0, y: 0, dirX: 1, gait: 0, lit: 0, seen: false, life: 0, sinkT: 0, inRock: true,
        group, parts, rims, bodyMat, rimMat, head, torso, pelvis, limbs, spurs, tilt: 0,
      });
    }
  }

  reset(): void {
    for (const w of this.walkers) { w.alive = false; w.group.visible = false; }
    this.dread = 0;
  }

  private trySpawn(podX: number, podY: number): void {
    const w = this.walkers.find(w => !w.alive);
    if (!w) return;
    for (let attempt = 0; attempt < 40; attempt++) {
      const a = Math.random() * Math.PI * 2;
      const d = 11 + Math.random() * 5;
      const x = Math.floor(podX + Math.cos(a) * d);
      const y = Math.floor(-podY + Math.sin(a) * d * 0.7);
      if (x < 1 || x >= this.terrain.w - 1 || y < BAND) continue;
      if (!this.terrain.solidAt(x, y)) continue;
      // rock with air beside it: a face to stand in
      if (!(!this.terrain.solidAt(x - 1, y) || !this.terrain.solidAt(x + 1, y) || !this.terrain.solidAt(x, y - 1) || !this.terrain.solidAt(x, y + 1))) continue;
      w.alive = true;
      w.x = x + 0.5; w.y = -(y + 0.5) - 0.5 + HEIGHT / 2;
      w.dirX = podX > w.x ? 1 : -1;
      w.gait = Math.random() * Math.PI * 2;
      w.lit = 0; w.seen = false; w.life = 0; w.sinkT = 0; w.inRock = true;
      w.group.visible = true;
      w.group.scale.set(1, 1, 1);
      return;
    }
  }

  private die(w: Walker): void {
    w.alive = false;
    w.group.visible = false;
  }

  blast(x: number, y: number, radius: number): void {
    for (const w of this.walkers) {
      if (w.alive && Math.hypot(w.x - x, w.y - y) < radius + 1.2 && w.sinkT <= 0) {
        // you can't kill it. You can make it leave.
        w.sinkT = 1.2;
        this.particles.dustBurst(w.x, w.y, 0x8ac8ff, { count: 20, speed: 3, up: 2, life: 0.9, gravity: 7, spread: 0.8 });
      }
    }
  }

  devStage(x: number, y: number): void {
    // left where trySpawn puts it, 11+ tiles out inside the rock: the walk
    // toward you in the dark is the creature, and it needs the distance
    if (!this.walkers.some(w => w.alive)) this.trySpawn(x, y);
  }

  update(ctx: ThreatCtx, level: ThreatLevel): void {
    const { dt, podX, podY, time } = ctx;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = (level === 'reduced' ? 32 : 20) + Math.random() * 15;
      if (Math.floor(-podY) >= BAND) this.trySpawn(podX, podY);
    }

    let dread = 0;
    for (const w of this.walkers) {
      if (!w.alive) continue;
      w.life += dt;
      const dx = podX - w.x, dy = podY - w.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 30 || w.life > 120) { this.die(w); continue; }

      const flare = this.flares.near(w.x, w.y, 6);
      const litNow = (ctx.lampOn && dist < LIT_RANGE) || !!flare || (ctx.carrying && dist < 5);
      w.lit += ((litNow ? 1 : 0) - w.lit) * Math.min(1, dt * 14);
      const frozen = w.lit > 0.5;

      if (w.sinkT > 0) {
        w.sinkT -= dt;
        const f = clamp01(w.sinkT / 1.2);
        w.group.scale.set(f, f, w.inRock ? 0.08 * f : f);
        w.y -= dt * 0.8;
        if (w.sinkT <= 0) { this.die(w); continue; }
      } else if (!frozen) {
        // it walks. Straight at you. Through anything.
        const ux = dx / (dist || 1), uy = dy / (dist || 1);
        const sp = SPEED * (level === 'reduced' ? 0.7 : 1);
        w.x += ux * sp * dt;
        w.y += uy * sp * dt * 0.6;
        // inside rock it wades at any height — that is the horror. In the
        // open it is a walker, and walkers stand on floors: settle the feet
        // onto the first rock below so it never strolls across thin air.
        if (!this.terrain.solidAt(Math.floor(w.x), Math.floor(-w.y))) {
          const col = Math.floor(w.x);
          let row = Math.floor(-(w.y - HEIGHT / 2));
          for (let k = 0; k < 4; k++, row++) {
            if (this.terrain.solidAt(col, row)) {
              w.y += (-row + HEIGHT / 2 - w.y) * Math.min(1, dt * 6);
              break;
            }
          }
        }
        w.dirX = ux > 0 ? 1 : -1;
        w.gait += dt * sp * 2.2;
        dread = Math.max(dread, clamp01(1 - dist / 12));
        if (dist < 0.95) {
          ctx.hold(1.4);
          ctx.drain(level === 'reduced' ? 12 : 22);
          ctx.hurt(level === 'reduced' ? 10 : 18, 'a Stillwalker');
          ctx.shake(0.35);
          ctx.onEvent('stillwalker-grab', w.x, w.y);
          this.particles.dustBurst(podX, podY, 0xd8f0ff, { count: 30, speed: 3, up: 1.5, life: 1, gravity: 4, spread: 0.9 });
          w.sinkT = 1.2;
        }
      } else if (!w.seen && dist < LIT_RANGE + 1) {
        w.seen = true;
        ctx.onAlert();
        ctx.onEvent('stillwalker-seen', w.x, w.y);
      }

      // ---- pose ----
      const inRock = this.terrain.solidAt(Math.floor(w.x), Math.floor(-(w.y - HEIGHT * 0.3)));
      w.inRock = inRock;
      const g = w.group;
      g.position.set(w.x, w.y, inRock ? 0.56 : 0.05);
      if (w.sinkT <= 0) g.scale.set(1, 1, inRock ? 0.08 : 1);
      g.rotation.y = w.dirX > 0 ? 0 : Math.PI;
      w.bodyMat.opacity = inRock ? 0.78 : 1;
      // frost catches on it when you light it: the only time it glitters
      w.rimMat.opacity = 0.1 + w.lit * 0.35 + (frozen ? Math.sin(time * 9) * 0.06 : 0);
      w.rimMat.color.setHex(0x9ad0ff);

      const H = HEIGHT;
      const hip = -H * 0.05, shoulder = H * 0.3, headY = H * 0.46;
      const lean = frozen ? 0 : 0.08;
      // a gait that is almost right: too long a stride, arms a beat late
      const sw = Math.sin(w.gait), sw2 = Math.sin(w.gait - 0.7);
      const bob = frozen ? 0 : Math.abs(Math.cos(w.gait)) * 0.05;
      // the head hangs at a tilt while it walks; lit, it straightens up
      w.tilt += ((frozen ? 0 : 0.16) - w.tilt) * Math.min(1, dt * 4);
      w.head.position.set(lean * 2, headY + bob, 0);
      w.head.scale.set(0.19, 0.38, 0.17);
      w.head.rotation.z = -w.tilt;
      // the torso is one long inverted shard: shoulders wide, waist to a point
      w.torso.position.set(lean, (shoulder + hip) / 2 + bob, 0);
      w.torso.scale.set(0.4, (shoulder - hip) * 1.2, 0.2);
      w.torso.rotation.z = -w.tilt * 0.4;
      w.pelvis.position.set(0, hip + bob, 0);
      w.pelvis.scale.set(0.3, 0.24, 0.17);
      const stride = 0.6, reach = 0.56;
      // legs
      for (let s = 0; s < 2; s++) {
        const ph = s === 0 ? sw : -sw;
        const kneeLift = Math.max(0, s === 0 ? Math.cos(w.gait) : -Math.cos(w.gait)) * 0.3;
        const hx = 0, hy = hip + bob, hz = (s === 0 ? 1 : -1) * 0.09;
        const fx = ph * stride, fy = -H * 0.5 + kneeLift * 0.6, fz = hz;
        const kx = (hx + fx) / 2 + 0.12 + kneeLift * 0.4, ky = (hy + fy) / 2 + kneeLift * 0.3, kz = hz;
        limb(w.limbs[4 + s * 2], hx, hy, hz, kx, ky, kz, 0.09);
        limb(w.limbs[5 + s * 2], kx, ky, kz, fx, fy, fz, 0.06);
      }
      // arms: hang long, swing late, past the knee
      for (let s = 0; s < 2; s++) {
        const ph = s === 0 ? -sw2 : sw2;
        const sx = lean, sy = shoulder + bob, sz = (s === 0 ? 1 : -1) * 0.19;
        const ex = ph * reach * 0.5, ey = sy - H * 0.22, ez = sz;
        const hx = ph * reach, hy = ey - H * 0.26, hz = sz;
        limb(w.limbs[0 + s * 2], sx, sy, sz, ex, ey, ez, 0.07);
        limb(w.limbs[1 + s * 2], ex, ey, ez, hx, hy, hz, 0.05);
      }
      // shoulder spurs: two uneven shards raked up and back, so the outline
      // is asymmetric from every angle — nothing alive grows that way
      limb(w.spurs[0], lean - 0.02, shoulder + bob + 0.02, 0.1, lean - 0.26, shoulder + bob + 0.38, 0.16, 0.05);
      limb(w.spurs[1], lean - 0.02, shoulder + bob + 0.02, -0.1, lean - 0.16, shoulder + bob + 0.46, -0.14, 0.04);
      // rims mirror the parts, slightly fatter
      for (let i = 0; i < w.parts.length; i++) {
        const p = w.parts[i], r = w.rims[i];
        r.position.copy(p.position);
        r.quaternion.copy(p.quaternion);
        r.scale.copy(p.scale).addScalar(0.035);
      }
    }
    this.dread += (dread - this.dread) * Math.min(1, dt * 3);
  }
}
