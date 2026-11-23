import * as THREE from 'three';
import { Terrain } from '../terrain';
import { def } from '../tiles';
import { Particles } from '../../fx/particles';
import { hdrBasic } from '../../fx/post';
import { Creature, ThreatCtx, ThreatLevel, air, onWall, limb, lerp, clamp01, ease, rimLight, Spill } from './types';

// GEODE MIMICS — VEIL-3's thief tier. Keyed on GREED.
//
// In the voidopal band some of the opals are a shade too violet and a size
// too big. Cut one and the rock doesn't fall away — it unfolds. Six legs, a
// faceted shell the colour of the stone it hid in, and the best thing in
// your hold lifted out and held up on its back like a trophy, glowing in
// that ore's own colour. Then it runs. Not smoothly: in bursts, a skitter
// and a freeze, a skitter and a freeze, up the wall and away.
//
// Kill it before it's gone — drill, lance, blast — and the ore comes back.

const MAX = 3;
const LEGS = 6;
const ESCAPE_DIST = 16;
const ESCAPE_TIME = 14;

interface Crab {
  alive: boolean;
  x: number; y: number;
  vx: number; vy: number;
  stolen: number;
  born: number;
  life: number;
  deadT: number;      // >0: a crushed shell settling on the floor
  burstT: number;
  pauseT: number;
  dirX: number; dirY: number;
  group: THREE.Group;
  body: THREE.Mesh;
  gem: THREE.Mesh;
  gemMat: THREE.MeshBasicMaterial;
  col: number;
  light: THREE.PointLight;
  /** the gem's light on the wall it clings to */
  spill: Spill;
  jawU: THREE.Mesh; jawD: THREE.Mesh;
  upper: THREE.Mesh[]; lower: THREE.Mesh[];
  legPhase: number;
}

export class Mimics implements Creature {
  crabs: Crab[] = [];
  private pending: { x: number; y: number }[] = [];
  private killed: number[] = [];

  constructor(scene: THREE.Scene, private terrain: Terrain, private particles: Particles) {
    const bodyGeo = new THREE.IcosahedronGeometry(0.3, 0);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3a2a5a, emissive: 0x5a30a0, emissiveIntensity: 0.6, flatShading: true, roughness: 0.35, metalness: 0.2 });
    // violet crystal light caught on the facet edges
    rimLight(bodyMat, 0x9a6aff, 1.1);
    const gemGeo = new THREE.OctahedronGeometry(0.2, 0);
    const legGeo = new THREE.BoxGeometry(1, 1, 1);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x4a3876, emissive: 0x1e1040, roughness: 0.5, flatShading: true });
    rimLight(legMat, 0x9a6aff, 0.8);
    // the setting: three crystal prongs grown up around the trophy
    const prongGeo = new THREE.OctahedronGeometry(0.07, 0);
    prongGeo.scale(0.8, 2.2, 0.8);
    // the bite: two crystal mandibles over a lit maw
    const jawGeo = new THREE.ConeGeometry(0.085, 0.32, 4);
    jawGeo.translate(0, 0.16, 0);
    jawGeo.rotateZ(-Math.PI / 2);
    const mawMat = new THREE.MeshBasicMaterial({ color: 0xe0a8ff, toneMapped: false });
    hdrBasic(mawMat, 2.0);
    const mawGeo = new THREE.OctahedronGeometry(0.13, 0);
    mawGeo.scale(1, 0.75, 0.9);
    for (let i = 0; i < MAX; i++) {
      const group = new THREE.Group();
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.scale.set(1.2, 0.8, 1);
      body.rotation.x = 0.35;
      const gemMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
      hdrBasic(gemMat, 1.2);
      const gem = new THREE.Mesh(gemGeo, gemMat);
      // seated in the shell, not floating over it
      gem.position.set(0, 0.27, 0.04);
      gem.scale.setScalar(1.15);
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2 + 0.4;
        const prong = new THREE.Mesh(prongGeo, bodyMat);
        prong.position.set(Math.cos(a) * 0.15, 0.24, Math.sin(a) * 0.12);
        prong.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
        group.add(prong);
      }
      const maw = new THREE.Mesh(mawGeo, mawMat);
      maw.position.set(0.3, -0.04, 0.06);
      const jawU = new THREE.Mesh(jawGeo, legMat);
      const jawD = new THREE.Mesh(jawGeo, legMat);
      jawU.position.set(0.28, 0.03, 0.07);
      jawD.position.set(0.28, -0.11, 0.07);
      const light = new THREE.PointLight(0xffffff, 0, 4.5, 1.8);
      light.position.set(0, 0.4, 0.6);
      group.add(body, gem, maw, jawU, jawD, light);
      const upper: THREE.Mesh[] = [], lower: THREE.Mesh[] = [];
      for (let k = 0; k < LEGS; k++) {
        const u = new THREE.Mesh(legGeo, legMat), l = new THREE.Mesh(legGeo, legMat);
        upper.push(u); lower.push(l);
        group.add(u, l);
      }
      group.visible = false;
      scene.add(group);
      this.crabs.push({
        alive: false, x: 0, y: 0, vx: 0, vy: 0, stolen: 0, born: 0, life: 0, deadT: 0, burstT: 0, pauseT: 0, dirX: 1, dirY: 0,
        group, body, gem, gemMat, col: 0x6a4aa0, light, spill: new Spill(scene, 0x6a4aa0), jawU, jawD, upper, lower, legPhase: 0,
      });
    }
  }

  reset(): void {
    for (const c of this.crabs) { c.alive = false; c.deadT = 0; c.group.visible = false; c.spill.off(); }
    this.pending.length = 0; this.killed.length = 0;
  }

  /** a mimic tile was cut at (x, y): something comes out next frame */
  hatch(x: number, y: number): void { this.pending.push({ x, y }); }

  private die(c: Crab): void { c.alive = false; c.deadT = 0; c.group.visible = false; c.spill.off(); }

  private kill(c: Crab): void {
    this.particles.sparkBurst(c.x, c.y, 0xb266ff, { count: 22, speed: 3.5, up: 2, life: 0.9, gravity: 5, spread: 0.5 });
    this.particles.dustBurst(c.x, c.y, 0x3a2a5a, { count: 14, speed: 3, up: 2, life: 0.8, gravity: 9, spread: 0.5 });
    if (c.stolen) this.killed.push(c.stolen);
    // it does not vanish: the shell drops, crushed, and lies there a moment
    c.alive = false;
    c.deadT = 1.5;
    c.gem.visible = false;
    c.light.intensity = 0;
    c.spill.off();
  }

  blast(x: number, y: number, radius: number): void {
    for (const c of this.crabs) if (c.alive && Math.hypot(c.x - x, c.y - y) < radius + 0.8) this.kill(c);
  }

  lance(x: number, y: number, dir: number, range: number): void {
    for (const c of this.crabs) {
      if (!c.alive) continue;
      const dx = (c.x - x) * dir;
      if (dx > -0.5 && dx < range && Math.abs(c.y - y) < 1.2) this.kill(c);
    }
  }

  drillHit(x: number, y: number): void {
    for (const c of this.crabs) if (c.alive && Math.hypot(c.x - x, c.y - y) < 0.9) this.kill(c);
  }

  private spawn(x: number, y: number, ctx: ThreatCtx): void {
    // prefer a truly free slot over one still crumbling; with all three
    // loose, the stone is just a stone — evicting a live crab would either
    // vanish its stolen ore or double-charge the hold for one hatch
    const c = this.crabs.find(c => !c.alive && c.deadT <= 0) ?? this.crabs.find(c => !c.alive);
    if (!c) return;
    c.alive = true;
    c.x = x + 0.5; c.y = -(y + 0.5);
    c.vx = 0; c.vy = 0;
    c.born = 0; c.life = 0; c.deadT = 0; c.burstT = 0; c.pauseT = 0.5;
    c.dirX = ctx.podX > c.x ? -1 : 1; c.dirY = 0.3;
    c.stolen = ctx.steal();
    const col = c.stolen ? def(c.stolen).gem : 0x6a4aa0;
    c.col = col;
    c.gemMat.color.setHex(col);
    c.light.color.setHex(col);
    c.gem.visible = c.stolen !== 0;
    c.group.visible = true;
    c.group.scale.setScalar(0.01);
    this.particles.dustBurst(c.x, c.y, 0x3a2a5a, { count: 20, speed: 3.5, up: 2.5, life: 0.9, gravity: 9, spread: 0.6 });
    this.particles.sparkBurst(c.x, c.y, col, { count: 14, speed: 3, up: 2, life: 0.8, gravity: 4, spread: 0.4 });
    ctx.shake(0.18);
    ctx.onEvent('mimic-hatch', c.x, c.y);
  }

  devStage(x: number, y: number): void {
    // hatches next frame out of the tile beside the pod, and takes the best
    // thing in the hold — the sandbox stocks cargo first or there is no theft
    if (this.crabs.some(c => c.alive) || this.pending.length) return;
    this.hatch(Math.floor(x) + 2, Math.floor(-y));
  }

  update(ctx: ThreatCtx, _level: ThreatLevel): void {
    const { dt, podX, podY, time } = ctx;
    while (this.pending.length) { const p = this.pending.pop()!; this.spawn(p.x, p.y, ctx); }
    while (this.killed.length) { ctx.give(this.killed.pop()!); ctx.onEvent('mimic-killed', podX, podY); }

    for (const c of this.crabs) {
      if (c.deadT > 0 && !c.alive) {
        // the crushed shell: drop to the floor, lie flat, then crumble away
        c.deadT -= dt;
        if (c.deadT <= 0) { this.die(c); continue; }
        if (!this.terrain.solidAt(Math.floor(c.x), Math.floor(-(c.y - 0.28)))) c.y -= dt * 3;
        const g = c.group;
        const crumble = c.deadT < 0.4 ? c.deadT / 0.4 : 1;
        g.position.set(c.x, c.y - 0.12, 0.25);
        g.scale.set(crumble, 0.38 * crumble, crumble);
        g.rotation.z = lerp(g.rotation.z, c.dirX >= 0 ? 0.6 : -0.6, Math.min(1, dt * 6));
        continue;
      }
      if (!c.alive) continue;
      c.life += dt; c.born += dt;
      const dx = podX - c.x, dy = podY - c.y;
      const dist = Math.hypot(dx, dy);
      if (dist > ESCAPE_DIST || c.life > ESCAPE_TIME) {
        ctx.onEvent(c.stolen ? 'mimic-escaped' : 'crab-skitter', c.x, c.y);
        this.die(c);
        continue;
      }

      // ---- skitter: burst, freeze, burst, freeze ----
      if (c.born > 0.3) {
        if (c.burstT > 0) {
          c.burstT -= dt;
          const sp = 6;
          const nx = c.x + c.dirX * sp * dt, ny = c.y + c.dirY * sp * dt;
          const okX = !this.terrain.solidAt(Math.floor(nx), Math.floor(-c.y));
          const okY = !this.terrain.solidAt(Math.floor(c.x), Math.floor(-ny));
          if (okX) c.x = nx; else c.dirX = -c.dirX * 0.5;
          if (okY) c.y = ny; else c.dirY = -c.dirY * 0.5;
          if (!okX && !okY) c.burstT = 0;
          c.legPhase += dt * 30;
        } else {
          c.pauseT -= dt;
          if (c.pauseT <= 0) {
            // away from you, with a twitch of randomness; along the walls
            let ax = -dx / (dist || 1), ay = -dy / (dist || 1);
            const a = Math.atan2(ay, ax) + (Math.random() - 0.5) * 1.4;
            ax = Math.cos(a); ay = Math.sin(a);
            // it has legs, not wings: probe one tile ahead and take the first
            // heading that is open air AND keeps rock under its feet. Only a
            // fully cornered crab launches across the middle of a room.
            const probe = (px: number, py: number): boolean => air(this.terrain, Math.floor(c.x + px * 1.1), Math.floor(-(c.y + py * 1.1)));
            const hug = (px: number, py: number): boolean => onWall(this.terrain, Math.floor(c.x + px * 1.1), Math.floor(-(c.y + py * 1.1)));
            const cand: [number, number][] = [[ax, ay], [-ay, ax], [ay, -ax]];
            const pick = cand.find(([px, py]) => probe(px, py) && hug(px, py))
              ?? cand.find(([px, py]) => probe(px, py))
              ?? [-ax, -ay];
            [ax, ay] = pick;
            c.dirX = ax; c.dirY = ay;
            c.burstT = 0.25 + Math.random() * 0.2;
            c.pauseT = 0.18 + Math.random() * 0.22;
            if (dist < 11) ctx.onEvent('crab-skitter', c.x, c.y);
          }
        }
      }

      // ---- pose ----
      const g = c.group;
      const pop = ease(clamp01(c.born / 0.3));
      g.position.set(c.x, c.y, 0.25);
      g.scale.setScalar(pop);
      const facing = c.dirX >= 0 ? 1 : -1;
      g.rotation.z = lerp(g.rotation.z, c.burstT > 0 ? Math.atan2(c.dirY, c.dirX * facing) * 0.4 * facing : 0, Math.min(1, dt * 10));
      g.rotation.y = facing > 0 ? 0 : Math.PI;
      // the shell breathes; the trophy turns slowly in its setting and pulses
      c.body.scale.y = 0.8 + Math.sin(time * 3) * 0.03;
      c.gem.rotation.y = time * 1.2;
      const beat = 0.5 + 0.5 * Math.sin(time * 4);
      c.gemMat.color.setHex(c.col).multiplyScalar(0.7 + beat * 0.4);
      c.light.intensity = c.stolen ? 1.8 + beat * 0.8 : 0.9;
      // the group turns to face its heading: keep the light on the camera side
      c.light.position.z = 0.4 * facing;
      const spillA = (c.stolen ? 0.3 + beat * 0.2 : 0.22) * pop;
      c.spill.set(c.x, c.y, 4, 4, spillA, c.stolen ? c.col : 0x9a6aff, 1.3);
      // mandibles snap on every burst; a slow working of the jaw at rest
      const gape = c.burstT > 0 ? 0.5 + 0.5 * Math.sin(time * 26) : 0.2 + 0.2 * Math.sin(time * 2.5);
      c.jawU.rotation.z = 0.15 + gape * 0.55;
      c.jawD.rotation.z = -0.15 - gape * 0.55;
      // legs: tripod gait in local space — feet lunge on bursts, lock on pauses
      for (let k = 0; k < LEGS; k++) {
        const side = k < 3 ? 1 : -1;
        const along = (k % 3) - 1;            // -1, 0, 1 front→back
        const hipX = along * 0.16, hipY = -0.05, hipZ = side * 0.18;
        const tri = (k % 2 === 0 ? 1 : -1);
        const ph = c.legPhase * 0.6 + (tri > 0 ? 0 : Math.PI);
        const moving = c.burstT > 0 ? 1 : 0;
        const stride = Math.sin(ph) * 0.14 * moving;
        const lift = Math.max(0, Math.cos(ph)) * 0.12 * moving;
        const fx = along * 0.42 + stride, fy = -0.36 + lift, fz = side * 0.42;
        const kx = (hipX + fx) / 2, ky = (hipY + fy) / 2 + 0.22, kz = (hipZ + fz) / 2 + side * 0.06;
        limb(c.upper[k], hipX, hipY, hipZ, kx, ky, kz, 0.07);
        limb(c.lower[k], kx, ky, kz, fx, fy, fz, 0.05);
      }
    }
  }
}
