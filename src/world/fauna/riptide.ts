import * as THREE from 'three';
import { Terrain } from '../terrain';
import { ACTIVE } from '../worlds';
import { FlareField } from './flares';
import { Creature, ThreatCtx, ThreatLevel, openness, lerp, clamp01, ease, wide } from './types';

// THE RIPTIDE — MAELIS-6's hunter tier. Keyed on SPACE.
//
// You never see it whole. It is a current in the water with a will: a slow
// spiral of drifting motes that all lean the same way, a shadow far too big
// behind the rock that only shows through the gaps, and — every so often,
// when you're close — an eye the size of a room that opens, looks at you,
// and closes again.
//
// Its pull is proportional to how much open water is around you. In a big
// cave it will take the pod. In a one-wide tunnel it can't get a grip.
// The counter is the game's own verb: dig into the rock and it loses you.

const MOTES = 1400;
const RADIUS = 9;
const BAND = 300;
const CRUISE = 1.1;
const PULL = 26;

export class Riptide implements Creature {
  alive = false;
  rumble = 0;
  /** 0..1 — how hard it has you right now */
  grip = 0;
  timer = 14;
  x = 0; y = 0;
  private tx = 0; private ty = 0;
  private retarget = 0;
  private life = 0;
  private eyeT = 0;
  private eyeCooldown = 12;
  private eyeOpen = 0;
  private entered = false;
  private spin = 0;

  private motes: THREE.Points;
  private motePos: Float32Array;
  private moteSeed: Float32Array;
  private moteMat: THREE.PointsMaterial;
  private shadow: THREE.Mesh;
  private shadowMat: THREE.MeshBasicMaterial;
  private eye: THREE.Group;
  private iris: THREE.Mesh;
  private lidTop: THREE.Mesh;
  private lidBot: THREE.Mesh;
  private pupil: THREE.Mesh;
  private eyeLight: THREE.PointLight;

  constructor(scene: THREE.Scene, private terrain: Terrain, private flares: FlareField) {
    // motes: the visible current. Each has a radius, an angle and a depth
    // it drifts along; the field is re-seeded each time the Riptide arrives.
    this.motePos = new Float32Array(MOTES * 3);
    this.moteSeed = new Float32Array(MOTES * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.motePos, 3).setUsage(THREE.DynamicDrawUsage));
    this.moteMat = new THREE.PointsMaterial({
      color: 0x9ef0d0, size: 0.07, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false,
    });
    this.motes = new THREE.Points(geo, this.moteMat);
    this.motes.frustumCulled = false;
    this.motes.visible = false;
    scene.add(this.motes);

    // the shadow: a vast ellipsoid behind the rock plane, only ever glimpsed
    this.shadowMat = new THREE.MeshBasicMaterial({ color: 0x02060a, transparent: true, opacity: 0, depthWrite: false });
    this.shadow = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14), this.shadowMat);
    this.shadow.scale.set(11, 2.6, 0.6);
    this.shadow.visible = false;
    scene.add(this.shadow);

    // the eye
    this.eye = new THREE.Group();
    this.iris = new THREE.Mesh(
      new THREE.CircleGeometry(1.4, 32),
      new THREE.MeshBasicMaterial({ color: 0x3ce6c8, toneMapped: false, transparent: true, opacity: 0.9 }),
    );
    this.pupil = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 24),
      new THREE.MeshBasicMaterial({ color: 0x000000 }),
    );
    this.pupil.position.z = 0.01;
    this.pupil.scale.set(0.4, 1, 1);
    const lidMat = new THREE.MeshBasicMaterial({ color: 0x02060a });
    this.lidTop = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.6), lidMat);
    this.lidBot = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.6), lidMat);
    this.lidTop.position.set(0, 0.8, 0.02);
    this.lidBot.position.set(0, -0.8, 0.02);
    this.eyeLight = new THREE.PointLight(0x3ce6c8, 0, 12, 1.5);
    this.eyeLight.position.z = 0.4;
    this.eye.add(this.iris, this.pupil, this.lidTop, this.lidBot, this.eyeLight);
    this.eye.visible = false;
    scene.add(this.eye);
  }

  reset(): void {
    this.alive = false;
    this.motes.visible = false; this.shadow.visible = false; this.eye.visible = false;
    this.moteMat.opacity = 0; this.shadowMat.opacity = 0;
    this.rumble = 0; this.grip = 0; this.entered = false;
  }

  private seed(): void {
    for (let i = 0; i < MOTES; i++) {
      this.moteSeed[i * 3] = Math.pow(Math.random(), 0.6) * RADIUS * 1.3;
      this.moteSeed[i * 3 + 1] = Math.random() * Math.PI * 2;
      this.moteSeed[i * 3 + 2] = Math.random();
    }
  }

  private trySpawn(podX: number, podY: number): boolean {
    for (let attempt = 0; attempt < 40; attempt++) {
      const x = Math.floor(podX + (Math.random() - 0.5) * 30);
      const y = Math.floor(-podY + (Math.random() - 0.5) * 24);
      if (x < 2 || x >= this.terrain.w - 2 || y < BAND) continue;
      if (!wide(this.terrain, x, y) || openness(this.terrain, x, y, 3) < 0.45) continue;
      const d = Math.hypot(x + 0.5 - podX, -(y + 0.5) - podY);
      if (d < 12) continue;
      this.alive = true;
      this.x = x + 0.5; this.y = -(y + 0.5);
      this.tx = this.x; this.ty = this.y;
      this.life = 0; this.retarget = 0; this.eyeCooldown = 9 + Math.random() * 6; this.eyeT = 0; this.eyeOpen = 0;
      this.entered = false; this.grip = 0;
      this.seed();
      this.motes.visible = true; this.shadow.visible = true;
      return true;
    }
    return false;
  }

  private die(): void {
    this.alive = false;
    this.motes.visible = false; this.shadow.visible = false; this.eye.visible = false;
    this.entered = false;
  }

  devStage(x: number, y: number): void {
    if (!this.alive && !this.trySpawn(x, y)) return;
    // it arrives 12+ tiles away and drifts; grip falls off with distance,
    // so from there you would barely feel it at all. Park it
    // close enough that the pull is the first thing you notice.
    this.x = this.tx = x + 3.5;
    this.y = this.ty = y;
    this.entered = false;
  }

  update(ctx: ThreatCtx, level: ThreatLevel): void {
    const { dt, podX, podY, time } = ctx;
    if (!this.alive) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = 12 + Math.random() * 14;
        if (Math.floor(-podY) >= BAND && Math.random() < (level === 'reduced' ? 0.5 : 0.85)) this.trySpawn(podX, podY);
      }
      this.rumble += (0 - this.rumble) * Math.min(1, dt * 2);
      this.grip += (0 - this.grip) * Math.min(1, dt * 2);
      return;
    }

    this.life += dt;
    const dx = podX - this.x, dy = podY - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 48 || this.life > 200) { this.die(); return; }

    // ---- drift: the centre wanders between open rooms, leaning toward you ----
    this.retarget -= dt;
    if (this.retarget <= 0) {
      this.retarget = 3 + Math.random() * 3;
      let bx = this.tx, by = this.ty, best = -1;
      for (let k = 0; k < 14; k++) {
        const x = Math.floor(this.x + (Math.random() - 0.5) * 16);
        const y = Math.floor(-this.y + (Math.random() - 0.5) * 12);
        if (x < 2 || x >= this.terrain.w - 2 || y < BAND - 20) continue;
        if (!wide(this.terrain, x, y)) continue;
        const open = openness(this.terrain, x, y, 3);
        const toPod = dist < 24 ? 1 - Math.hypot(x + 0.5 - podX, -(y + 0.5) - podY) / 30 : 0;
        const score = open + toPod * 0.9;
        if (score > best) { best = score; bx = x + 0.5; by = -(y + 0.5); }
      }
      this.tx = bx; this.ty = by;
    }
    const mx = this.tx - this.x, my = this.ty - this.y;
    const md = Math.hypot(mx, my);
    if (md > 0.3) {
      this.x += (mx / md) * CRUISE * dt;
      this.y += (my / md) * CRUISE * dt;
    }

    // ---- the pull ----
    const podOpen = openness(this.terrain, Math.floor(podX), Math.floor(-podY), 2);
    const room = clamp01((podOpen - 0.2) / 0.6);
    const near = clamp01(1 - dist / RADIUS);
    // linear in distance, square in room: the current reaches out — against
    // gravity at 21 and thrust at 52, anything less reads as decoration —
    // but a wall at your back still kills its grip fast
    const strength = near * room * room * (level === 'reduced' ? 0.5 : 1);
    this.grip += (strength - this.grip) * Math.min(1, dt * 3);
    if (strength > 0.001) {
      const ux = -dx / (dist || 1), uy = -dy / (dist || 1);
      // inward, plus a swirl: it doesn't just pull, it turns you
      const swirl = 0.55;
      const fx = (ux * (1 - swirl) + -uy * swirl) * PULL * strength * dt;
      const fy = (uy * (1 - swirl) + ux * swirl) * PULL * strength * dt;
      ctx.push(fx, fy);
      if (strength > 0.35 && Math.random() < dt * 3) ctx.shake(0.04 * strength);
    }
    if (!this.entered && near > 0.15 && room > 0.3) {
      this.entered = true;
      ctx.onAlert();
      ctx.onEvent('riptide-enter', this.x, this.y);
    }
    if (this.entered && near <= 0) this.entered = false;
    // flares tumble in too — a lit thing spiralling into the dark is the tell
    for (const f of this.flares.list) {
      if (!f.alive) continue;
      const fdx = this.x - f.x, fdy = this.y - f.y;
      const fd = Math.hypot(fdx, fdy);
      if (fd < RADIUS * 1.2 && fd > 0.5) {
        const s = clamp01(1 - fd / (RADIUS * 1.2));
        this.flares.drift(f, (fdx / fd) * 9 * s * dt, (fdy / fd * 0.5 + 0.8) * 9 * s * dt);
      }
    }
    this.rumble += (Math.max(strength, near * 0.25) - this.rumble) * Math.min(1, dt * 3);

    // ---- the eye ----
    if (this.eyeT > 0) {
      this.eyeT -= dt;
      const open = this.eyeT > 1.2 ? (1.6 - this.eyeT) / 0.4 : this.eyeT < 0.4 ? this.eyeT / 0.4 : 1;
      this.eyeOpen = ease(clamp01(open));
      if (this.eyeT <= 0) { this.eye.visible = false; this.eyeOpen = 0; }
    } else {
      this.eyeCooldown -= dt;
      if (this.eyeCooldown <= 0 && dist < 15) {
        this.eyeCooldown = 16 + Math.random() * 10;
        this.eyeT = 1.6;
        // it opens in the rock wall nearest to you, at your height
        const side = dx > 0 ? -1 : 1;
        let ex = podX + side * 4, ey = podY;
        for (let k = 3; k < 9; k++) {
          if (this.terrain.solidAt(Math.floor(podX + side * k), Math.floor(-podY))) { ex = podX + side * k; ey = podY; break; }
        }
        this.eye.position.set(ex, ey, -0.56);
        this.eye.visible = true;
        ctx.onEvent('riptide-eye', ex, ey);
      }
    }
    if (this.eye.visible) {
      const o = this.eyeOpen;
      this.lidTop.position.y = 0.8 + o * 1.2;
      this.lidBot.position.y = -0.8 - o * 1.2;
      // it looks at you
      const lx = clamp01((podX - this.eye.position.x) / 8) * 0.5;
      const ly = clamp01((podY - this.eye.position.y) / 8) * 0.5;
      this.pupil.position.set(lx, ly, 0.01);
      this.pupil.scale.set(0.3 + o * 0.25, 1.05, 1);
      this.eyeLight.intensity = o * 9;
    }

    // ---- motes: the current made visible ----
    this.spin += dt * (0.4 + strength * 1.4);
    const showMotes = clamp01(1.4 - dist / (RADIUS * 2.2));
    this.moteMat.opacity = lerp(this.moteMat.opacity, 0.55 * showMotes + strength * 0.4, Math.min(1, dt * 2));
    this.moteMat.color.setHex(ACTIVE.gemTint);
    for (let i = 0; i < MOTES; i++) {
      let r = this.moteSeed[i * 3];
      const a0 = this.moteSeed[i * 3 + 1];
      const depth = this.moteSeed[i * 3 + 2];
      // spiral in; reset outward when swallowed
      r -= dt * (0.6 + (1 - r / RADIUS) * 1.5) * (0.5 + strength);
      if (r < 0.3) r = RADIUS * (1.1 + Math.random() * 0.3);
      this.moteSeed[i * 3] = r;
      const a = a0 + this.spin * (1.6 - r / RADIUS) + depth * 2;
      const px = this.x + Math.cos(a) * r * 1.25;
      const py = this.y + Math.sin(a) * r * 0.75;
      // motes only live in water: the ones inside rock are hidden away
      const hidden = this.terrain.solidAt(Math.floor(px), Math.floor(-py));
      this.motePos[i * 3] = hidden ? 9999 : px;
      this.motePos[i * 3 + 1] = py;
      this.motePos[i * 3 + 2] = 0.2 + depth * 0.5;
    }
    (this.motes.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;

    // ---- the shadow behind the rock ----
    this.shadow.position.set(this.x, this.y + Math.sin(time * 0.3) * 0.6, -0.58);
    this.shadow.rotation.z = Math.sin(time * 0.17) * 0.25;
    const breathe = 1 + Math.sin(time * 0.5) * 0.06;
    this.shadow.scale.set(11 * breathe, 2.6 / breathe, 0.6);
    this.shadowMat.opacity = lerp(this.shadowMat.opacity, clamp01(1.3 - dist / 22) * 0.92, Math.min(1, dt * 1.5));
  }
}
