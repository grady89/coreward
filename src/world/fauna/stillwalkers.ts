import * as THREE from 'three';
import { Terrain } from '../terrain';
import { Particles } from '../../fx/particles';
import { FlareField } from './flares';
import { Creature, ThreatCtx, ThreatLevel, clamp01 } from './types';
import { StillwalkerBody, WALKER_HEIGHT } from './stillwalker-body';

// STILLWALKERS — CRYOS-2's stalker tier. Keyed on the ABSENCE of light.
//
// Tall. Too tall. A figure in the rock, black as a cut-out, standing where
// there was nothing a second ago. While your lamp is on it AND you are
// facing it, it does not move — not a tremor. Turn the lamp off — or just
// turn your back — and it walks. Through the rock, through the ice,
// straight at you, with a gait that is almost right. Your light is a leash
// only as long as your attention: it prefers the side you are not watching,
// and it spawns there. In the dark, two cold points open where a face
// should be. They are pointed at you.
//
// The figure itself lives in stillwalker-body.ts: a gaunt obsidian thing
// with a crown of spurs, claws past the knee and a heron's reversed leg.
// Walking, it slouches and the head hangs; lit, it straightens — which is
// worse. Hunting in the dark it shows as glowing fractures and two cold
// points; lit, it goes dark inside and frost catches on every edge.
//
// The cold worlds' rule inverts here: dark hides you from the Wardens and
// feeds you to these. Manage your light — and keep checking behind you.

const MAX = 2;
const HEIGHT = WALKER_HEIGHT;
const SPEED = 2.4;
const LIT_RANGE = 7.5;
const FREEZE = 2;   // seconds the Lumen Lance holds one still
const BAND = 200;

interface Walker {
  alive: boolean;
  x: number; y: number;
  dirX: number;
  gait: number;
  lit: number;      // 0..1 smoothed
  walk: number;     // 0..1 smoothed slouch — it straightens when held
  freezeT: number;  // lance flash-freeze: lit no matter what the lamp says
  seen: boolean;
  life: number;
  sinkT: number;
  inRock: boolean;
  body: StillwalkerBody;
}

export class Stillwalkers implements Creature {
  walkers: Walker[] = [];
  /** 0..1 — something unlit is walking toward you */
  dread = 0;
  spawnTimer = 12;

  constructor(scene: THREE.Scene, private terrain: Terrain, private flares: FlareField, private particles: Particles) {
    for (let i = 0; i < MAX; i++) {
      const body = new StillwalkerBody();
      body.group.visible = false;
      scene.add(body.group);
      this.walkers.push({
        alive: false, x: 0, y: 0, dirX: 1, gait: 0, lit: 0, walk: 1, freezeT: 0, seen: false, life: 0, sinkT: 0, inRock: true,
        body,
      });
    }
  }

  reset(): void {
    for (const w of this.walkers) { w.alive = false; w.body.group.visible = false; w.body.gaze.intensity = 0; }
    this.dread = 0;
  }

  private trySpawn(podX: number, podY: number, facing = 0): void {
    const w = this.walkers.find(w => !w.alive);
    if (!w) return;
    for (let attempt = 0; attempt < 40; attempt++) {
      // it prefers the side you are not watching: two in three rise behind you
      const behind = facing !== 0 && Math.random() < 0.67;
      const a = behind
        ? Math.PI * (facing > 0 ? 1 : 0) + (Math.random() - 0.5) * 1.8
        : Math.random() * Math.PI * 2;
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
      w.lit = 0; w.walk = 1; w.freezeT = 0; w.seen = false; w.life = 0; w.sinkT = 0; w.inRock = true;
      w.body.group.visible = true;
      w.body.group.scale.set(1, 1, 1);
      return;
    }
  }

  private die(w: Walker): void {
    w.alive = false;
    w.body.group.visible = false;
    w.body.gaze.intensity = 0;
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

  // The creature that feeds on darkness finally answers to the game's
  // biggest light: a lance hit flash-freezes it — forced lit, a hard white
  // flash on the rim — no matter what the lamp is doing.
  lance(x: number, y: number, dir: number, range: number): void {
    for (const w of this.walkers) {
      if (!w.alive || w.sinkT > 0) continue;
      const dx = (w.x - x) * dir;
      if (dx > -1 && dx < range && Math.abs(w.y - y) < 2.6) {
        w.freezeT = FREEZE;
        this.particles.dustBurst(w.x, w.y, 0xffffff, { count: 14, speed: 2.5, up: 1.5, life: 0.6, gravity: 5, spread: 0.9 });
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
      if (Math.floor(-podY) >= BAND) this.trySpawn(podX, podY, ctx.facing);
    }

    let dread = 0;
    for (const w of this.walkers) {
      if (!w.alive) continue;
      w.life += dt;
      const dx = podX - w.x, dy = podY - w.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 30 || w.life > 120) { this.die(w); continue; }

      w.freezeT = Math.max(0, w.freezeT - dt);
      const flare = this.flares.near(w.x, w.y, 6);
      const fragLit = ctx.carrying && dist < 5;
      // the lamp holds it only on the side you are FACING — light on your
      // back is nothing to it. Placed light (a flare, the fragment's glow)
      // works from any side; reduced keeps the old omni mercy.
      const faced = level === 'reduced' || (w.x - podX) * ctx.facing > -0.6;
      const litNow = w.freezeT > 0 || (ctx.lampOn && faced && dist < LIT_RANGE) || !!flare || fragLit;
      // the fragment alone stopped it — the asymmetry deserves a dispatch
      if (fragLit && w.lit <= 0.5 && w.freezeT <= 0 && !(ctx.lampOn && dist < LIT_RANGE) && !flare) {
        ctx.onEvent('stillwalker-fragment', w.x, w.y);
      }
      // a lance freeze is instant — light that arrives all at once
      w.lit += ((litNow ? 1 : 0) - w.lit) * Math.min(1, dt * (w.freezeT > 0 ? 40 : 14));
      const frozen = w.lit > 0.5;

      if (w.sinkT > 0) {
        w.sinkT -= dt;
        const f = clamp01(w.sinkT / 1.2);
        w.body.group.scale.set(f, f, w.inRock ? 0.08 * f : f);
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
      const g = w.body.group;
      g.position.set(w.x, w.y, inRock ? 0.56 : 0.05);
      if (w.sinkT <= 0) g.scale.set(1, 1, inRock ? 0.08 : 1);
      g.rotation.y = w.dirX > 0 ? 0 : Math.PI;
      // it straightens when held, slouches again the moment it is free
      w.walk += ((frozen ? 0 : 1) - w.walk) * Math.min(1, dt * 4);
      // a lance hit rings hard white for the first beat of the freeze
      const flash = clamp01((w.freezeT - (FREEZE - 0.8)) / 0.8);
      // the gaze and the fractures: open only while it hunts, brighter the closer it gets
      const hunt = frozen || w.sinkT > 0 ? 0 : clamp01(1 - dist / 16);
      w.body.set({ gait: w.gait, walk: w.walk, lit: w.lit, hunt, flash, flat: inRock, time });
      // frost off the footfalls when it walks in the open
      if (!inRock && w.sinkT <= 0) {
        for (let s = 0; s < 2; s++) {
          if (!w.body.planted[s]) continue;
          this.particles.dustBurst(w.x + w.body.footX[s] * w.dirX, w.y - HEIGHT / 2 + 0.05, 0xbfe0ff, { count: 5, speed: 0.7, up: 0.6, life: 0.7, gravity: 1.5, spread: 0.5 });
        }
      }
    }
    this.dread += (dread - this.dread) * Math.min(1, dt * 3);
  }
}
