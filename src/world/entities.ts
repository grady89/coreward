import * as THREE from 'three';
import { Terrain } from './terrain';
import { T } from './tiles';
import { ACTIVE } from './worlds';

// Threat entities. Budget-first by design: one InstancedMesh per creature type,
// a hard live cap, pooled data, and zero allocation in the update loop.
// Creatures never persist in saves — they respawn by region.

export type ThreatLevel = 'full' | 'reduced' | 'off';

export interface ThreatCtx {
  podX: number;
  podY: number;
  lampOn: boolean;
  /** 0..1 thruster output — what the cold worlds listen for */
  thrust: number;
  dt: number;
  time: number;
  /** hull damage */
  hurt(amount: number, cause: string): void;
  /** fuel sip */
  drain(amount: number): void;
  /** first time a swarm notices the player */
  onAlert(): void;
}

const MAX_FLIES = 24;
const SWARM_MIN = 5;
const SWARM_MAX = 9;
const MAX_SWARMS = 2;

// ---- Long Ones ----
const WORM_SEGMENTS = 11;
const WORM_BAND = 300;      // rows: they belong to the deep bands
const WORM_SPEED = 4.6;
const WORM_HUNT = 17;       // tiles: they hunt by vibration, not by light
const WORM_DAMAGE = 26;     // per second in contact — you do not trade with one
const MAX_FLARES = 3;

const NOTICE_RANGE = 8.5;   // tiles: how far a lit lamp carries
const LOSE_RANGE = 15;
const DARK_CALM = 1.6;      // seconds of darkness before they lose interest

interface Fly {
  x: number; y: number;
  vx: number; vy: number;
  phase: number;
  swarm: number;
}

interface Swarm {
  alive: boolean;
  ax: number; ay: number;   // anchor
  alerted: boolean;
  darkFor: number;
  life: number;
}

interface Worm {
  alive: boolean;
  x: number; y: number;
  dirX: number; dirY: number;
  trail: { x: number; y: number }[];
  life: number;
  stuck: number;
}

interface Flare {
  alive: boolean;
  x: number; y: number;
  vx: number; vy: number;
  life: number;
}

interface Warden {
  alive: boolean;
  x: number; y: number;
  homeX: number; homeY: number;
  sweep: number;      // beam angle
  engaged: boolean;
  integrity: number;  // charges hurt it; nothing else does
}

const tmpM = new THREE.Matrix4();
const tmpP = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const tmpE = new THREE.Euler();
const tmpC = new THREE.Color();

export class ThreatField {
  level: ThreatLevel = 'full';
  private flies: Fly[] = [];
  private swarms: Swarm[] = [];
  private mesh: THREE.InstancedMesh;
  private glow: THREE.PointLight;
  private spawnTimer = 0;
  /** rises toward 1 while a swarm is on you — drives the audio bed */
  menace = 0;

  // Long Ones
  private worm: Worm = { alive: false, x: 0, y: 0, dirX: 1, dirY: 0, trail: [], life: 0, stuck: 0 };
  private wormMesh!: THREE.InstancedMesh;
  private wormTimer = 12;
  /** rises as a Long One closes — drives the rumble tell */
  rumble = 0;

  // flares
  private flares: Flare[] = [];
  private flareMesh!: THREE.InstancedMesh;
  private flareLights: THREE.PointLight[] = [];

  // Wardens — Lamplighter machines, still on duty
  private warden: Warden = { alive: false, x: 0, y: 0, homeX: 0, homeY: 0, sweep: 0, engaged: false, integrity: 100 };
  private wardenGroup!: THREE.Group;
  private wardenBeam!: THREE.SpotLight;
  private wardenTarget!: THREE.Object3D;
  /** rises while a Warden has you in its beam */
  scrutiny = 0;

  constructor(scene: THREE.Scene, private terrain: Terrain) {
    const geo = new THREE.IcosahedronGeometry(0.09, 0);
    const mat = new THREE.MeshBasicMaterial({ toneMapped: false });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX_FLIES);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.setColorAt(0, tmpC.setHex(0xffffff));
    scene.add(this.mesh);

    // one shared light so a swarm reads in a dark tunnel without 9 lights
    this.glow = new THREE.PointLight(0xffe08a, 0, 9, 1.8);
    this.glow.visible = false;
    scene.add(this.glow);

    for (let i = 0; i < MAX_SWARMS; i++) {
      this.swarms.push({ alive: false, ax: 0, ay: 0, alerted: false, darkFor: 0, life: 0 });
    }

    // Long One: a chain of segments tapering from the head
    const segGeo = new THREE.IcosahedronGeometry(0.42, 0);
    const segMat = new THREE.MeshStandardMaterial({
      flatShading: true, roughness: 0.5, metalness: 0.3,
      emissive: 0x220a06, emissiveIntensity: 1,
    });
    this.wormMesh = new THREE.InstancedMesh(segGeo, segMat, WORM_SEGMENTS);
    this.wormMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.wormMesh.frustumCulled = false;
    this.wormMesh.count = 0;
    this.wormMesh.setColorAt(0, tmpC.setHex(0xffffff));
    scene.add(this.wormMesh);

    // Warden: a squat armoured drum with a sweeping lamp. Deliberately built
    // from the same vocabulary as the surface buildings — it is machinery.
    this.wardenGroup = new THREE.Group();
    const shell = new THREE.MeshStandardMaterial({
      color: 0x9a94ae, roughness: 0.35, metalness: 0.75, flatShading: true,
    });
    const trim = new THREE.MeshStandardMaterial({
      color: 0x5c5570, roughness: 0.5, metalness: 0.6, flatShading: true,
    });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.78, 1.05, 8), shell);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.62, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), shell);
    cap.position.y = 0.52;
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.84, 0.84, 0.16, 8), trim);
    collar.position.y = -0.3;
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xfff0c0, toneMapped: false })
    );
    eye.position.set(0, 0.34, 0.45);
    this.wardenGroup.add(body, cap, collar, eye);
    this.wardenTarget = new THREE.Object3D();
    this.wardenGroup.add(this.wardenTarget);
    this.wardenBeam = new THREE.SpotLight(0xfff0c0, 0, 20, 0.34, 0.5, 1.2);
    this.wardenBeam.position.set(0, 0.34, 0.5);
    this.wardenBeam.target = this.wardenTarget;
    this.wardenGroup.add(this.wardenBeam);
    this.wardenGroup.visible = false;
    scene.add(this.wardenGroup);

    // flares
    const flGeo = new THREE.IcosahedronGeometry(0.16, 0);
    const flMat = new THREE.MeshBasicMaterial({ color: 0xffb066, toneMapped: false });
    this.flareMesh = new THREE.InstancedMesh(flGeo, flMat, MAX_FLARES);
    this.flareMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.flareMesh.frustumCulled = false;
    this.flareMesh.count = 0;
    scene.add(this.flareMesh);
    for (let i = 0; i < MAX_FLARES; i++) {
      const l = new THREE.PointLight(0xffb066, 0, 14, 1.6);
      l.visible = false;
      this.flareLights.push(l);
      scene.add(l);
      this.flares.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0 });
    }
  }

  reset(): void {
    this.flies.length = 0;
    for (const s of this.swarms) s.alive = false;
    this.mesh.count = 0;
    this.menace = 0;
    this.worm.alive = false;
    this.worm.trail.length = 0;
    this.wormMesh.count = 0;
    this.rumble = 0;
    for (const f of this.flares) f.alive = false;
    this.flareMesh.count = 0;
    for (const l of this.flareLights) l.visible = false;
    this.warden.alive = false;
    this.wardenGroup.visible = false;
    this.scrutiny = 0;
  }

  get wardenAlive(): boolean { return this.warden.alive; }

  /** Wardens stand post at Lamplighter chambers */
  private updateWarden(ctx: ThreatCtx, ruins: { x: number; y: number }[]): void {
    const w = this.warden;
    const { dt, podX, podY, lampOn } = ctx;

    if (!w.alive) {
      // post one at the nearest chamber once the player is in its hall
      for (const r of ruins) {
        const d = Math.hypot(r.x - podX, -r.y - podY);
        if (d < 18 && d > 5) {
          w.alive = true;
          w.x = r.x; w.y = -r.y;
          w.homeX = r.x; w.homeY = -r.y;
          w.sweep = 0;
          w.engaged = false;
          w.integrity = 100;
          this.wardenGroup.visible = true;
          break;
        }
      }
      if (!w.alive) {
        this.scrutiny += (0 - this.scrutiny) * Math.min(1, dt * 2);
        return;
      }
    }

    const dx = podX - w.x, dy = podY - w.y;
    const dist = Math.hypot(dx, dy);

    // leave its post behind and it powers down again
    if (dist > 30) {
      w.alive = false;
      this.wardenGroup.visible = false;
      this.scrutiny = 0;
      return;
    }

    // it tracks luminance, not motion: run dark and it keeps sweeping past you
    const flare = this.brightestFlare();
    const flareDist = flare ? Math.hypot(flare.x - w.x, flare.y - w.y) : 999;
    const seesPod = lampOn && dist < 15;
    const seesFlare = flareDist < 17;
    w.engaged = seesPod || seesFlare;

    const tx = seesFlare && !seesPod ? flare!.x : podX;
    const ty = seesFlare && !seesPod ? flare!.y : podY;

    if (w.engaged) {
      // heavy, unhurried, inevitable
      const sp = 1.5 * dt;
      const nx = w.x + Math.sign(tx - w.x) * sp;
      const ny = w.y + Math.sign(ty - w.y) * sp;
      if (this.terrain.get(Math.floor(nx), Math.floor(-w.y)) === T.AIR) w.x = nx;
      if (this.terrain.get(Math.floor(w.x), Math.floor(-ny)) === T.AIR) w.y = ny;
      w.sweep += (Math.atan2(ty - w.y, tx - w.x) - w.sweep) * Math.min(1, dt * 3);
      if (dist < 1.5) {
        ctx.hurt((this.level === 'reduced' ? 16 : 30) * dt, 'a Warden');
      }
    } else {
      // patrol: drift home and sweep the room
      w.x += (w.homeX - w.x) * Math.min(1, dt * 0.6);
      w.y += (w.homeY - w.y) * Math.min(1, dt * 0.6);
      w.sweep += dt * 0.7;
    }

    this.wardenGroup.position.set(w.x, w.y, 0);
    this.wardenTarget.position.set(Math.cos(w.sweep) * 8, Math.sin(w.sweep) * 8, 0);
    this.wardenBeam.intensity = w.engaged ? 90 : 45;
    this.wardenBeam.angle = w.engaged ? 0.26 : 0.4;

    const target = w.engaged ? Math.max(0, 1 - dist / 15) : 0;
    this.scrutiny += (target - this.scrutiny) * Math.min(1, dt * 3);
  }

  /** throw a flare — light somewhere that is not you */
  throwFlare(x: number, y: number, vx: number, vy: number): boolean {
    const f = this.flares.find(f => !f.alive);
    if (!f) return false;
    f.alive = true;
    f.x = x; f.y = y;
    f.vx = vx; f.vy = vy;
    f.life = 26;
    return true;
  }

  /** the brightest live flare, if any — swarms prefer it to the pod */
  private brightestFlare(): Flare | null {
    let best: Flare | null = null;
    for (const f of this.flares) if (f.alive && (!best || f.life > best.life)) best = f;
    return best;
  }

  /** a spinning drill head in contact is the pod's only built-in weapon */
  drillHit(x: number, y: number, dt: number): void {
    for (let i = this.flies.length - 1; i >= 0; i--) {
      const f = this.flies[i];
      if (Math.hypot(f.x - x, f.y - y) < 0.85) this.flies.splice(i, 1);
    }
    const w = this.worm;
    if (w.alive && Math.hypot(w.x - x, w.y - y) < 1.1) {
      w.stuck += dt * 2.5; // it will not tolerate being cut for long
    }
  }

  /** a seismic charge went off: kill what it touched */
  blast(x: number, y: number, radius: number): void {
    // a Warden is armoured against everything but demolition
    const w = this.warden;
    if (w.alive && Math.hypot(w.x - x, w.y - y) < radius + 1) {
      w.integrity -= 55;
      if (w.integrity <= 0) {
        w.alive = false;
        this.wardenGroup.visible = false;
        this.scrutiny = 0;
      }
    }
    if (this.worm.alive && Math.hypot(this.worm.x - x, this.worm.y - y) < radius + 1) {
      this.worm.alive = false;
      this.worm.trail.length = 0;
      this.wormMesh.count = 0;
      this.rumble = 0;
    }
    for (let i = this.flies.length - 1; i >= 0; i--) {
      const f = this.flies[i];
      if (Math.hypot(f.x - x, f.y - y) < radius) this.flies.splice(i, 1);
    }
  }

  /** true where a Long One's bulk fits: open on both axes, never a 1-wide shaft */
  private wide(x: number, y: number): boolean {
    const air = (cx: number, cy: number) => this.terrain.get(cx, cy) === T.AIR;
    if (!air(x, y)) return false;
    return (air(x - 1, y) || air(x + 1, y)) && (air(x, y - 1) || air(x, y + 1));
  }

  get wormAlive(): boolean { return this.worm.alive; }

  private trySpawnWorm(podX: number, podY: number): void {
    for (let attempt = 0; attempt < 30; attempt++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 13 + Math.random() * 8;
      const x = Math.round(podX + Math.cos(ang) * dist);
      const y = Math.round(-podY + Math.sin(ang) * dist);
      if (y < WORM_BAND || x < 2 || x >= this.terrain.w - 2) continue;
      if (!this.wide(x, y)) continue;
      const w = this.worm;
      w.alive = true;
      w.x = x + 0.5; w.y = -(y + 0.5);
      w.dirX = 0; w.dirY = -1;
      w.life = 0;
      w.stuck = 0;
      w.trail.length = 0;
      for (let i = 0; i < WORM_SEGMENTS * 4; i++) w.trail.push({ x: w.x, y: w.y });
      return;
    }
  }

  private updateWorm(ctx: ThreatCtx): void {
    const w = this.worm;
    const { dt, podX, podY } = ctx;

    if (!w.alive) {
      this.wormTimer -= dt;
      if (this.wormTimer <= 0) {
        this.wormTimer = 16 + Math.random() * 20;
        const row = Math.floor(-podY);
        if (row >= WORM_BAND && Math.random() < (this.level === 'reduced' ? 0.3 : 0.65)) {
          this.trySpawnWorm(podX, podY);
        }
      }
      // a worm that just spawned falls through and draws this same frame
      if (!w.alive) {
        this.rumble += (0 - this.rumble) * Math.min(1, dt * 2);
        this.wormMesh.count = 0;
        return;
      }
    }

    w.life += dt;
    const dx = podX - w.x;
    const dy = podY - w.y;
    const dist = Math.hypot(dx, dy);

    // give up on a player it can't reach, or one who left
    if (dist > 40 || w.life > 75 || w.stuck > 6) {
      w.alive = false;
      w.trail.length = 0;
      this.wormMesh.count = 0;
      return;
    }

    // steer toward the pod, but only through passages wide enough for it
    const speed = WORM_SPEED * (this.level === 'reduced' ? 0.75 : 1) * (dist < WORM_HUNT ? 1 : 0.5);
    const want = { x: dx / (dist || 1), y: dy / (dist || 1) };
    const step = speed * dt;
    const cand: [number, number][] = [
      [want.x, want.y],
      [Math.sign(want.x), 0],
      [0, Math.sign(want.y)],
      [w.dirX, w.dirY],
    ];
    let moved = false;
    for (const [cx, cy] of cand) {
      if (cx === 0 && cy === 0) continue;
      const len = Math.hypot(cx, cy) || 1;
      const nx = w.x + (cx / len) * step;
      const ny = w.y + (cy / len) * step;
      if (this.wide(Math.floor(nx), Math.floor(-ny))) {
        w.x = nx; w.y = ny;
        w.dirX = cx / len; w.dirY = cy / len;
        moved = true;
        break;
      }
    }
    w.stuck = moved ? 0 : w.stuck + dt;

    // body follows the head's path
    w.trail.unshift({ x: w.x, y: w.y });
    if (w.trail.length > WORM_SEGMENTS * 4) w.trail.pop();

    const dmgMul = this.level === 'reduced' ? 0.5 : 1;
    if (dist < 0.95) ctx.hurt(WORM_DAMAGE * dmgMul * dt, 'a Long One');

    for (let i = 0; i < WORM_SEGMENTS; i++) {
      const p = w.trail[Math.min(w.trail.length - 1, i * 3)];
      const taper = 1 - (i / WORM_SEGMENTS) * 0.55;
      tmpP.set(p.x, p.y, 0.1);
      tmpE.set(0, 0, w.life * 1.4 + i * 0.5);
      tmpQ.setFromEuler(tmpE);
      tmpS.setScalar(taper);
      tmpM.compose(tmpP, tmpQ, tmpS);
      this.wormMesh.setMatrixAt(i, tmpM);
      tmpC.setHex(i === 0 ? 0x8a3a28 : 0x4a2a22).multiplyScalar(1 - i * 0.03);
      this.wormMesh.setColorAt(i, tmpC);
    }
    this.wormMesh.count = WORM_SEGMENTS;
    this.wormMesh.instanceMatrix.needsUpdate = true;
    if (this.wormMesh.instanceColor) this.wormMesh.instanceColor.needsUpdate = true;

    const target = Math.max(0, 1 - dist / 22);
    this.rumble += (target - this.rumble) * Math.min(1, dt * 3);
  }

  private updateFlares(dt: number): void {
    let n = 0;
    for (let i = 0; i < this.flares.length; i++) {
      const f = this.flares[i];
      const light = this.flareLights[i];
      if (!f.alive) { light.visible = false; continue; }
      f.life -= dt;
      if (f.life <= 0) { f.alive = false; light.visible = false; continue; }
      f.vy -= 16 * dt;
      const nx = f.x + f.vx * dt;
      const ny = f.y + f.vy * dt;
      if (this.terrain.solidAt(Math.floor(nx), Math.floor(-f.y))) { f.vx = 0; } else { f.x = nx; }
      if (this.terrain.solidAt(Math.floor(f.x), Math.floor(-ny))) {
        f.vy = 0; f.vx *= 0.6;
      } else { f.y = ny; }

      const flicker = 0.85 + Math.sin(f.life * 24) * 0.15;
      const fade = Math.min(1, f.life / 3);
      light.visible = true;
      light.position.set(f.x, f.y, 0.4);
      light.intensity = 22 * flicker * fade;
      tmpP.set(f.x, f.y, 0.3);
      tmpQ.identity();
      tmpS.setScalar(flicker);
      tmpM.compose(tmpP, tmpQ, tmpS);
      this.flareMesh.setMatrixAt(n, tmpM);
      n++;
    }
    this.flareMesh.count = n;
    if (n > 0) this.flareMesh.instanceMatrix.needsUpdate = true;
  }

  /** depth band where this world's swarm tier lives */
  private bandOk(row: number): boolean {
    return row >= 90 && row <= 470;
  }

  private trySpawn(podX: number, podY: number): void {
    const slot = this.swarms.findIndex(s => !s.alive);
    if (slot < 0) return;
    // look for an air pocket a respectful distance from the pod
    for (let attempt = 0; attempt < 24; attempt++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 9 + Math.random() * 7;
      const x = Math.round(podX + Math.cos(ang) * dist);
      const y = Math.round(-podY + Math.sin(ang) * dist);
      if (y < 60 || x < 1 || x >= this.terrain.w - 1) continue;
      if (this.terrain.get(x, y) !== T.AIR) continue;
      const s = this.swarms[slot];
      s.alive = true;
      s.ax = x + 0.5;
      s.ay = -(y + 0.5);
      s.alerted = false;
      s.darkFor = 0;
      s.life = 0;
      const n = SWARM_MIN + Math.floor(Math.random() * (SWARM_MAX - SWARM_MIN + 1));
      const want = this.level === 'reduced' ? Math.ceil(n / 2) : n;
      for (let i = 0; i < want && this.flies.length < MAX_FLIES; i++) {
        this.flies.push({
          x: s.ax + (Math.random() - 0.5) * 1.6,
          y: s.ay + (Math.random() - 0.5) * 1.6,
          vx: 0, vy: 0,
          phase: Math.random() * Math.PI * 2,
          swarm: slot,
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

  update(ctx: ThreatCtx): void {
    if (this.level === 'off') {
      if (this.flies.length || this.worm.alive) this.reset();
      this.updateFlares(ctx.dt); // flares are a light source, not a threat
      return;
    }
    const { dt, podX, podY, lampOn } = ctx;
    const row = Math.floor(-podY);
    this.updateFlares(dt);
    this.updateWorm(ctx);
    this.updateWarden(ctx, this.terrain.ruins);
    // a burning flare is a brighter meal than the pod
    const flare = this.brightestFlare();

    // spawn pacing
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 4 + Math.random() * 5;
      if (this.bandOk(row) && Math.random() < (this.level === 'reduced' ? 0.25 : 0.5)) {
        this.trySpawn(podX, podY);
      }
    }

    let closest = 999;
    let anyAlert = false;

    for (let si = 0; si < this.swarms.length; si++) {
      const s = this.swarms[si];
      if (!s.alive) continue;
      s.life += dt;
      const dx = podX - s.ax;
      const dy = podY - s.ay;
      const dist = Math.hypot(dx, dy);
      const flareNear = flare
        ? Math.hypot(flare.x - s.ax, flare.y - s.ay) < NOTICE_RANGE * 1.6
        : false;

      // each world's fauna reads a different organ: light, heat, or nearness
      let emitting: boolean;
      switch (ACTIVE.swarm.keys) {
        case 'heat': emitting = ctx.thrust > 0.05; break;
        case 'space': emitting = dist < NOTICE_RANGE * 0.55; break;
        default: emitting = lampOn; break;
      }
      if ((emitting || flareNear) && (dist < NOTICE_RANGE || flareNear)) {
        if (!s.alerted) { s.alerted = true; ctx.onAlert(); }
        s.darkFor = 0;
      } else if (s.alerted) {
        s.darkFor += dt;
        if (s.darkFor > DARK_CALM || dist > LOSE_RANGE) s.alerted = false;
      }

      // retire swarms the player has left far behind
      if (dist > 34 || s.life > 90) { this.despawn(si); continue; }
      if (s.alerted) { anyAlert = true; closest = Math.min(closest, dist); }
    }

    // move the flies
    const dmgMul = this.level === 'reduced' ? 0.5 : 1;
    let n = 0;
    for (const f of this.flies) {
      const s = this.swarms[f.swarm];
      if (!s || !s.alive) continue;
      f.phase += dt * (2 + (f.swarm + 1) * 0.4);

      // target: the flare if one burns, else the pod when hunting, else home
      const tx = s.alerted ? (flare ? flare.x : podX) : s.ax;
      const ty = s.alerted ? (flare ? flare.y : podY) : s.ay;
      const dx = tx - f.x;
      const dy = ty - f.y;
      const d = Math.hypot(dx, dy) || 1;
      const speed = s.alerted ? 3.4 : 1.1;
      // seek + a jittery orbit so a swarm never reads as a rigid formation
      f.vx += (dx / d) * speed * dt * 4 + Math.cos(f.phase * 1.7) * dt * 3.2;
      f.vy += (dy / d) * speed * dt * 4 + Math.sin(f.phase * 2.3) * dt * 3.2;
      f.vx *= 0.92; f.vy *= 0.92;
      const nx = f.x + f.vx * dt;
      const ny = f.y + f.vy * dt;
      // they don't pass through rock
      if (!this.terrain.solidAt(Math.floor(nx), Math.floor(-ny))) {
        f.x = nx; f.y = ny;
      } else {
        f.vx *= -0.4; f.vy *= -0.4;
      }

      // contact: chew hull, sip fuel
      const pd = Math.hypot(podX - f.x, podY - f.y);
      if (pd < 0.62) {
        ctx.hurt(2.6 * dmgMul * dt, 'glimmerflies');
        ctx.drain(0.5 * dmgMul * dt);
      }

      tmpP.set(f.x, f.y, 0.25);
      tmpQ.identity();
      tmpS.setScalar(0.75 + Math.sin(f.phase * 3) * 0.25);
      tmpM.compose(tmpP, tmpQ, tmpS);
      this.mesh.setMatrixAt(n, tmpM);
      // hunting flies burn hotter
      tmpC.setHex(s.alerted ? ACTIVE.swarm.hunting : ACTIVE.swarm.color);
      this.mesh.setColorAt(n, tmpC);
      n++;
    }
    this.mesh.count = n;
    if (n > 0) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }

    // shared swarm light rides the flock centre
    if (anyAlert && n > 0) {
      let cx = 0, cy = 0, c = 0;
      for (const f of this.flies) {
        const s = this.swarms[f.swarm];
        if (s?.alerted) { cx += f.x; cy += f.y; c++; }
      }
      if (c > 0) {
        this.glow.visible = true;
        this.glow.position.set(cx / c, cy / c, 0.4);
        this.glow.intensity = 6;
        this.glow.color.setHex(ACTIVE.swarm.hunting);
      }
    } else {
      this.glow.visible = false;
    }

    const target = anyAlert ? Math.max(0, 1 - closest / NOTICE_RANGE) : 0;
    this.menace += (target - this.menace) * Math.min(1, dt * 3);
  }
}
