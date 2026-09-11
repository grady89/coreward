import * as THREE from 'three';
import { Terrain } from '../terrain';
import { Particles } from '../../fx/particles';
import { FlareField } from './flares';
import { Creature, ThreatCtx, ThreatLevel, limb, lerp, clamp01, ease, air, lineOfSight } from './types';

// WARDENS — the constant. Lamplighter machinery, still on post.
//
// A tripod. A lantern where a head should be, a hexagonal hip slung two
// tiles above the floor, three legs that step one at a time — plant, lift,
// swing, PLANT — each footfall a thud through the rock. It sweeps its beam
// across the hall in slow arcs, and the beam is the only part of it that
// hurries: catch you in it and the beam narrows, goes white, and it walks.
// Contact is not a bite. It is overexposure. The world goes white.
//
// The beam IS the sensor. Caught in the fan with a clear line, you are
// seen — lamp on, lamp off, it does not care what YOU are doing with light,
// only where ITS light falls. Running dark still narrows its notice: a lit
// pod (or a stolen fragment) catches the fan's fringe a shade beyond the
// drawn cone. A flare is light it must inspect. The Lumen Lance is TOO MUCH
// light: it blinds. Only a seismic charge can bring one down; it takes two.

const HIP_H = 2.2;
const STEP_TIME = 0.36;
const STEP_TRIGGER = 1.1;
const FELLED_QUIET = 180;   // a hall whose Warden fell stays dark this long

// Detection IS the beam — geometrically. Engagement needs the pod inside
// the sweep fan AND in line of sight, and nothing else: a dark pod standing
// in the light is a pod standing in the light. Running dark only trims the
// fringe (a lit pod reads at 1.4× the arc). No seeing through rock, no
// seeing behind itself. The drawn cone is built from ENGAGE_ARC so the
// light you see is exactly the arc that sees a dark pod. Since arc-dodging
// is now the whole game, the idle sweep hurries (1.05 → 1.6 rad/s: a pass
// every ~4s) and the engaged walk closes properly.
const ENGAGE_ARC = 0.55;    // rad half-angle of the engage fan
const ENGAGE_DIST = 16;
const IDLE_SWEEP = 1.6;     // rad/s
const COOK_ARC = 0.3;       // the narrowed white shaft that actually burns
const COOK_DIST = 14;

interface Leg {
  footX: number; footY: number;
  fromX: number; fromY: number;
  toX: number; toY: number;
  stepT: number;   // >0 while swinging
  upper: THREE.Mesh; lower: THREE.Mesh; pad: THREE.Mesh;
}

export class Wardens implements Creature {
  alive = false;
  scrutiny = 0;
  x = 0; y = 0;
  private homeX = 0;
  private homeIdx = -1;
  /** ruin index → game time its Warden was felled; the post stays dark a while */
  private felled = new Map<number, number>();
  private sweep = 0;
  engaged = false;
  /** world-space angle the beam currently points, radians (read-only tell) */
  get beamAngle(): number { return this.sweep; }
  integrity = 100;
  private blindT = 0;
  /** 0..1 — how long the white beam has been on the hull. Overexposure. */
  private exposure = 0;
  private woke = false;
  private flashT = 0;
  private collapseT = 0;
  private hipY = HIP_H;
  private droop = 0;
  private gaitClock = 0;
  private legs: Leg[] = [];

  private group: THREE.Group;
  private hip: THREE.Mesh;
  private neck: THREE.Mesh;
  private lantern: THREE.Group;
  private housing: THREE.Mesh;
  private lamp: THREE.Mesh;
  private lampMat: THREE.MeshBasicMaterial;
  private beamCone: THREE.Mesh;
  private beamMat: THREE.MeshBasicMaterial;
  private beam: THREE.SpotLight;
  private beamTarget: THREE.Object3D;
  private glow: THREE.PointLight;

  constructor(scene: THREE.Scene, private terrain: Terrain, private flares: FlareField, private particles: Particles) {
    const masonry = new THREE.MeshStandardMaterial({ color: 0x9a94ae, roughness: 0.55, metalness: 0.25, flatShading: true });
    const verdigris = new THREE.MeshStandardMaterial({ color: 0x6f8f88, roughness: 0.4, metalness: 0.7, flatShading: true });
    this.group = new THREE.Group();

    this.hip = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.5, 0.5, 6), masonry);
    this.hip.rotation.x = Math.PI / 2;
    this.neck = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.7, 6), verdigris);
    this.neck.position.y = 0.55;

    this.lantern = new THREE.Group();
    this.lantern.position.y = 1.15;
    this.housing = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.34, 0.7, 6, 1, true), verdigris);
    this.housing.rotation.z = Math.PI / 2;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.08, 6), masonry);
    cap.rotation.z = Math.PI / 2; cap.position.x = -0.36;
    this.lampMat = new THREE.MeshBasicMaterial({ color: 0xfff2c8, toneMapped: false });
    this.lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), this.lampMat);
    this.lamp.position.x = 0.12;
    // The visible beam, rendered as light rather than a prop. The alpha
    // lives in a CanvasTexture: along the length (v) it is bright at the
    // lantern and dissolves to nothing at the far end; across the width (u,
    // the cone's circumference) it follows |cos| — the chord thickness of a
    // lit volume — so the screen-space edges melt away instead of ending at
    // a polygon silhouette. u=0/0.5 face the camera, u=0.25/0.75 are the
    // visible edges of the fan.
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    const g2d = cv.getContext('2d')!;
    const lengthGrad = g2d.createLinearGradient(0, 0, 0, 128);
    lengthGrad.addColorStop(0.0, 'rgba(255,255,255,0.95)');  // v=1: the lamp
    lengthGrad.addColorStop(0.12, 'rgba(255,255,255,0.5)');
    lengthGrad.addColorStop(0.45, 'rgba(255,255,255,0.2)');
    lengthGrad.addColorStop(0.8, 'rgba(255,255,255,0.05)');
    lengthGrad.addColorStop(1.0, 'rgba(255,255,255,0)');     // v=0: dissolved
    g2d.fillStyle = lengthGrad;
    g2d.fillRect(0, 0, 128, 128);
    const widthGrad = g2d.createLinearGradient(0, 0, 128, 0);
    for (let i = 0; i <= 16; i++) {
      const u = i / 16;
      widthGrad.addColorStop(u, `rgba(255,255,255,${Math.abs(Math.cos(u * Math.PI * 2)).toFixed(3)})`);
    }
    g2d.globalCompositeOperation = 'destination-in';
    g2d.fillStyle = widthGrad;
    g2d.fillRect(0, 0, 128, 128);
    this.beamMat = new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(cv), color: 0xffe0a0, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    });
    // idle: a broad lighthouse fan cut to ENGAGE_ARC, so the drawn light IS
    // the danger zone. Engaged, it narrows to the white cook shaft. A second
    // cone on the same material nests inside; the additive stack reads as a
    // hot core inside soft spill.
    // drawn light IS the trigger: the fan runs the full ENGAGE_DIST so its
    // dissolve never understates the reach at maximum range
    const coneGeo = new THREE.ConeGeometry(Math.tan(ENGAGE_ARC) * ENGAGE_DIST, ENGAGE_DIST, 24, 1, true);
    coneGeo.rotateZ(Math.PI / 2);
    coneGeo.translate(ENGAGE_DIST / 2, 0, 0);
    // the fan spreads in the play plane; toward the camera it stays as flat
    // as the old cone was, so it never engulfs the view
    coneGeo.scale(1, 1, 0.28);
    this.beamCone = new THREE.Mesh(coneGeo, this.beamMat);
    const core = new THREE.Mesh(coneGeo, this.beamMat);
    core.scale.set(0.9, 0.45, 0.45);
    this.beamCone.add(core);
    this.beam = new THREE.SpotLight(0xffe0a0, 45, 22, ENGAGE_ARC, 0.55, 1.2);
    this.beam.position.set(0.2, 0, 0);
    this.beamTarget = new THREE.Object3D();
    this.beamTarget.position.set(8, 0, 0);
    this.beam.target = this.beamTarget;
    this.glow = new THREE.PointLight(0xffe0a0, 2.5, 6, 1.6);
    this.lantern.add(this.housing, cap, this.lamp, this.beamCone, this.beam, this.beamTarget, this.glow);

    this.group.add(this.hip, this.neck, this.lantern);
    const legGeo = new THREE.BoxGeometry(1, 1, 1);
    for (let i = 0; i < 3; i++) {
      const upper = new THREE.Mesh(legGeo, masonry);
      const lower = new THREE.Mesh(legGeo, verdigris);
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.12, 6), masonry);
      this.group.add(upper, lower, pad);
      this.legs.push({ footX: 0, footY: 0, fromX: 0, fromY: 0, toX: 0, toY: 0, stepT: 0, upper, lower, pad });
    }
    this.group.visible = false;
    scene.add(this.group);
  }

  reset(): void {
    this.alive = false;
    this.group.visible = false;
    this.scrutiny = 0;
    this.felled.clear();
  }

  private down(): void {
    this.alive = false;
    this.group.visible = false;
    this.scrutiny = 0;
  }

  blast(x: number, y: number, radius: number): void {
    if (!this.alive || this.collapseT > 0 || Math.hypot(this.x - x, this.y - y) > radius + 1.5) return;
    this.integrity -= 55;
    this.particles.dustBurst(this.x, this.y, 0x9a94ae, { count: 24, speed: 4, up: 2, life: 1, gravity: 9, spread: 1.2 });
    if (this.integrity <= 0) { this.collapseT = 1.5; this.pendingDown = true; }
  }
  private pendingDown = false;
  private pendingBlind = false;

  lance(x: number, y: number, dir: number, range: number): void {
    if (!this.alive || this.collapseT > 0) return;
    const dx = (this.x - x) * dir;
    if (dx > -1 && dx < range && Math.abs(this.y - y) < 3) {
      this.blindT = 6;
      this.engaged = false;
      this.pendingBlind = true;
    }
  }

  /** the ideal resting spot for leg i: a fan of three around the body */
  private idealFoot(i: number, out: { x: number; y: number }): void {
    const a = -Math.PI / 2 + (i - 1) * 0.85;
    const fx = this.x + Math.cos(a) * 1.25;
    out.x = fx; out.y = this.floorAt(fx, this.y - HIP_H + 1, 3);
  }
  private ideal = { x: 0, y: 0 };

  /** the top face of the first rock under (x, fromY), searching down `depth` tiles */
  private floorAt(x: number, fromY: number, depth: number): number {
    const col = Math.floor(x);
    const top = Math.floor(-fromY);
    for (let row = top; row <= top + depth; row++) {
      if (this.terrain.solidAt(col, row)) return -row;
    }
    return fromY - depth;
  }

  private plantAll(): void {
    for (let i = 0; i < 3; i++) {
      this.idealFoot(i, this.ideal);
      const l = this.legs[i];
      l.footX = l.toX = l.fromX = this.ideal.x;
      l.footY = l.toY = l.fromY = this.ideal.y;
      l.stepT = 0;
    }
  }

  devStage(_x: number, _y: number): void {
    // it posts itself the moment you are in a hall (5..18 tiles from a ruin),
    // so staging is only forgetting that this post was ever felled
    this.felled.clear();
  }

  update(ctx: ThreatCtx, level: ThreatLevel): void {
    const { dt, podX, podY, lampOn } = ctx;
    if (this.pendingBlind) { this.pendingBlind = false; ctx.onEvent('warden-blind', this.x, this.y); }

    if (!this.alive) {
      // post one at the nearest chamber once the player is in its hall —
      // and with a stolen fragment aboard, every hall is on alert
      const wake = ctx.carrying ? 30 : 18;
      const ruins = this.terrain.ruins;
      for (let i = 0; i < ruins.length; i++) {
        const r = ruins[i];
        const f = this.felled.get(i);
        if (f !== undefined && ctx.time - f < FELLED_QUIET) continue;
        const d = Math.hypot(r.x - podX, -r.y - podY);
        if (d < wake && d > 2.5) {
          this.alive = true;
          this.homeIdx = i;
          this.x = this.homeX = r.x; this.y = -r.y + 1.2;
          this.sweep = 0; this.engaged = false; this.integrity = 100; this.blindT = 0; this.woke = false; this.exposure = 0;
          this.collapseT = 0; this.hipY = HIP_H; this.flashT = 0; this.droop = 0;
          this.plantAll();
          this.group.visible = true;
          break;
        }
      }
      if (!this.alive) { this.scrutiny += (0 - this.scrutiny) * Math.min(1, dt * 2); return; }
    }

    const dx = podX - this.x, dy = podY - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > (ctx.carrying ? 50 : 30)) { this.down(); return; }

    // ---- collapse ----
    if (this.collapseT > 0) {
      this.collapseT -= dt;
      const f = 1 - clamp01(this.collapseT / 1.5);
      this.hipY = lerp(HIP_H, 0.5, ease(f));
      this.droop = -ease(f) * 1.1;
      this.lampMat.color.setHex(0x443a2a);
      this.beam.intensity = (1 - f) * 20 * (Math.random() < 0.5 ? 1 : 0.2);
      this.beamMat.opacity = (1 - f) * 0.3 * (Math.random() < 0.5 ? 1 : 0.4);
      this.glow.intensity = (1 - f) * 2;
      if (Math.random() < dt * 8) this.particles.sparkBurst(this.x + (Math.random() - 0.5), this.y + 1, 0xffe0a0, { count: 3, speed: 2.5, up: 1, life: 0.5, gravity: 8, spread: 0.3 });
      if (this.collapseT <= 0 && this.pendingDown) {
        this.pendingDown = false;
        this.felled.set(this.homeIdx, ctx.time);
        ctx.shake(0.5);
        ctx.onEvent('warden-down', this.x, this.y);
        this.particles.dustBurst(this.x, this.y - 1.5, 0x9a94ae, { count: 40, speed: 4, up: 2, life: 1.2, gravity: 8, spread: 2 });
        this.down();
        return;
      }
      this.pose();
      this.scrutiny += (0 - this.scrutiny) * Math.min(1, dt * 3);
      return;
    }

    // ---- sight: it sees where its own light falls, and nothing else. The
    // pod must be inside the sweep fan AND in line of sight — lamp state is
    // no shield: stand in the beam and you are in the beam. Running dark
    // trims the fringe; rock, and the gaps between passes, are the answer.
    this.blindT = Math.max(0, this.blindT - dt);
    const lanternY = this.y + 1.15;
    const flare = this.flares.brightest(this.x, lanternY, 17);
    let podArc = Math.atan2(podY - lanternY, podX - this.x) - this.sweep;
    while (podArc > Math.PI) podArc -= Math.PI * 2;
    while (podArc < -Math.PI) podArc += Math.PI * 2;
    // dark or lit, the fan finds you; light only widens the fringe it reads
    const fan = lampOn || ctx.carrying ? ENGAGE_ARC * 1.4 : ENGAGE_ARC;
    const seesPod = dist < ENGAGE_DIST
      && Math.abs(podArc) < fan
      && lineOfSight(this.terrain, this.x, lanternY, podX, podY);
    // a flare wakes it from any direction — thrown light is the point —
    // but never through solid rock
    const seesFlare = !!flare && lineOfSight(this.terrain, this.x, lanternY, flare.x, flare.y);
    const wasEngaged = this.engaged;
    this.engaged = this.blindT <= 0 && (seesPod || seesFlare);
    if (this.engaged && !wasEngaged) {
      if (!this.woke) { this.woke = true; ctx.onAlert(); }
      ctx.onEvent('warden-wake', this.x, this.y);
    }
    const tx = seesFlare && !seesPod ? flare!.x : podX;
    const ty = seesFlare && !seesPod ? flare!.y : podY;

    // ---- walk ----
    const dmgMul = level === 'reduced' ? 0.5 : 1;
    if (this.engaged) {
      const sp = 2.6 * (level === 'reduced' ? 0.75 : 1) * dt;
      const nx = this.x + Math.sign(tx - this.x) * sp;
      if (Math.abs(tx - this.x) > 0.4 && air(this.terrain, Math.floor(nx), Math.floor(-(this.y - 1)))) this.x = nx;
      const want = Math.atan2(ty - this.y, tx - this.x);
      let da = want - this.sweep;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      // carrying a fragment it tracks a shade better — Act IV pays the toll
      this.sweep += da * Math.min(1, dt * (ctx.carrying ? 7 : 5.5));
      // contact is the whole machine, legs included — not just the lantern
      const segY = Math.max(this.y - HIP_H + 0.4, Math.min(podY, this.y + 1));
      if (Math.hypot(podX - this.x, podY - segY) < 1.3) {
        ctx.hurt((level === 'reduced' ? 16 : 30) * dt, 'a Warden');
        this.flashT -= dt;
        if (this.flashT <= 0) { this.flashT = 0.5; ctx.onEvent('warden-flash', this.x, this.y); }
      } else this.flashT = 0;
    } else {
      // patrol: drift home and sweep the room — a lighthouse in a hurry
      this.x += (this.homeX - this.x) * Math.min(1, dt * 0.6);
      this.sweep += dt * (this.blindT > 0 ? 0 : IDLE_SWEEP);
    }

    // ---- the beam is the weapon: contact is overexposure, and so is this.
    // Held in the narrowed white beam, the hull cooks — slowly at first,
    // then properly. Break the line, or slip the arc, and it cools.
    let inBeam = false;
    if (this.engaged && this.blindT <= 0 && dist < COOK_DIST) {
      let da = Math.atan2(podY - lanternY, podX - this.x) - this.sweep;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      inBeam = Math.abs(da) < COOK_ARC && lineOfSight(this.terrain, this.x, lanternY, podX, podY);
    }
    this.exposure = clamp01(this.exposure + (inBeam ? dt / 1.2 : -dt * 1.5));
    if (this.exposure > 0.2) ctx.hurt(13 * this.exposure * dmgMul * dt, "a Warden's beam");
    // it walks on floors: the hip rides HIP_H above whatever rock is under it
    const floorY = this.floorAt(this.x, this.y - HIP_H + 1.5, 6);
    this.y += (floorY + HIP_H - this.y) * Math.min(1, dt * 3);

    // ---- legs: step one at a time, whichever is furthest from where it wants to be ----
    let swinging = false;
    for (const l of this.legs) {
      if (l.stepT > 0) {
        swinging = true;
        l.stepT -= dt;
        const f = 1 - clamp01(l.stepT / STEP_TIME);
        l.footX = lerp(l.fromX, l.toX, ease(f));
        l.footY = lerp(l.fromY, l.toY, ease(f)) + Math.sin(f * Math.PI) * 0.55;
        if (l.stepT <= 0) {
          l.footX = l.toX; l.footY = l.toY;
          ctx.shake(0.06);
          ctx.onEvent('warden-step', l.footX, l.footY);
          this.particles.dustBurst(l.footX, l.footY, 0x8a8494, { count: 5, speed: 1.5, up: 1, life: 0.5, gravity: 8, spread: 0.3 });
        }
      }
    }
    if (!swinging) {
      let worst = -1, wi = -1;
      for (let i = 0; i < 3; i++) {
        this.idealFoot(i, this.ideal);
        const l = this.legs[i];
        const d = Math.hypot(this.ideal.x - l.footX, this.ideal.y - l.footY);
        if (d > STEP_TRIGGER && d > worst) { worst = d; wi = i; }
      }
      if (wi >= 0) {
        this.idealFoot(wi, this.ideal);
        const l = this.legs[wi];
        l.fromX = l.footX; l.fromY = l.footY;
        l.toX = this.ideal.x; l.toY = this.ideal.y;
        l.stepT = STEP_TIME;
      }
    }
    // the hip rides the feet: settles lower with each plant, lifts a hair as it walks
    const avgFoot = (this.legs[0].footY + this.legs[1].footY + this.legs[2].footY) / 3;
    this.hipY = lerp(this.hipY, clamp01((this.y - avgFoot) / HIP_H) * HIP_H * 0.98 + (swinging ? 0.06 : 0), Math.min(1, dt * 6));
    this.gaitClock += dt;

    // ---- lamp ----
    const blind = this.blindT > 0;
    const white = this.engaged ? 1 : 0;
    this.lampMat.color.setHex(blind ? 0x2a2418 : this.engaged ? 0xffffff : 0xfff2c8);
    this.beam.intensity = blind ? 0 : this.engaged ? 110 : 45;
    this.beam.angle = lerp(this.beam.angle, this.engaged ? 0.24 : ENGAGE_ARC, Math.min(1, dt * 4));
    this.beam.color.setHex(this.engaged ? 0xffffff : 0xffe0a0);
    this.beamMat.color.setHex(this.engaged ? 0xffffff : 0xffe0a0);
    this.beamMat.opacity = blind ? 0 : lerp(this.beamMat.opacity, 0.4 + white * 0.35, Math.min(1, dt * 4));
    // idle: the full soft fan. Engaged: it snaps down to the cook shaft
    // (COOK_ARC of the fan's ENGAGE_ARC) and reaches a touch further —
    // narrower, whiter, brighter all at once, so the state change lands.
    const ks = Math.min(1, dt * 6);
    const narrow = this.engaged ? Math.tan(COOK_ARC) / Math.tan(ENGAGE_ARC) : 1;
    this.beamCone.scale.x = lerp(this.beamCone.scale.x, this.engaged ? 1.1 : 1, ks);
    this.beamCone.scale.y = lerp(this.beamCone.scale.y, narrow, ks);
    this.beamCone.scale.z = this.beamCone.scale.y;
    this.glow.intensity = blind ? 0.2 : 2.5 + white * 3;
    this.beamTarget.position.set(8, 0, 0);
    // a blinded lantern droops
    this.droop = lerp(this.droop, blind ? -0.6 : 0, Math.min(1, dt * 3));

    this.pose();
    const target = this.engaged ? Math.max(0, 1 - dist / 15) : 0;
    this.scrutiny += (target - this.scrutiny) * Math.min(1, dt * 3);
  }

  private pose(): void {
    const g = this.group;
    // the body hangs at hipY above its feet; a collapsing one sinks to the floor
    const by = this.y - (HIP_H - this.hipY);
    g.position.set(this.x, by, 0);
    const sway = Math.sin(this.gaitClock * 2.2) * 0.03;
    this.hip.position.set(0, sway, 0);
    this.neck.position.set(0, 0.55 + sway, 0);
    this.lantern.position.set(0, 1.15 + sway, 0);
    // the whole head swivels in the plane: the sweep aims the beam, a
    // blinded or dying lantern droops off that line
    this.lantern.rotation.set(0, 0, this.sweep + this.droop);
    // legs in local space (group origin at hip height "this.y")
    for (let i = 0; i < 3; i++) {
      const l = this.legs[i];
      const fx = l.footX - this.x, fy = l.footY - by;
      const fz = (i - 1) * 0.5;
      const hx = Math.cos(-Math.PI / 2 + (i - 1) * 0.85) * 0.45, hy = -0.2, hz = (i - 1) * 0.35;
      // knee bends outward and up: the tripod's silhouette
      const kx = (hx + fx) / 2 + (fx - hx) * 0.35, ky = (hy + fy) / 2 + 0.55, kz = (hz + fz) / 2;
      limb(l.upper, hx, hy, hz, kx, ky, kz, 0.16);
      limb(l.lower, kx, ky, kz, fx, fy + 0.06, fz, 0.11);
      l.pad.position.set(fx, fy + 0.06, fz);
    }
  }
}
