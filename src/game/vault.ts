import * as THREE from 'three';
import { FollowCam } from '../fx/camera';
import { GlyphDef, buildGlyphMark, glyphSvg } from '../world/glyphs';
import { VaultDef, ParsedVault, parseVault } from '../world/vaults';

// A VAULT RUN — one attempt at one of the Nine Stones (SPEC-GLYPHS.md §3).
//
// Its own scene, its own camera, its own physics: the world outside is
// frozen and the suit runs on the room's worklight. The pilot flies like
// a tiny pod — thrust in the held direction, gravity from whatever zone
// you are standing in — walking and jumping are free, the jets drink the
// meter, and failure is never death: your light gutters and you re-form
// at the last sconce you lit.

const HW = 0.15;
const HH = 0.26;
const EPS = 0.001;
const WALK = 3.6;
const JUMP = 8.6;
const GRAV = 13;
const THRUST = 26;
const AIR_CTRL = 14;        // free lateral drift — just loses to a gust, barely beats a current
const MAX_V = 11;
const METER_MAX = 100;
const DRAIN = 30;           // per second of jetting
const REFILL_SCONCE = 60;   // in a lit sconce's glow
const SCONCE_RANGE = 2.4;
const BRIDGE_HALF = 1.7;    // seconds each bridge group burns
const BRIDGE_WARN = 0.35;
const RIME_CRUMBLE = 0.55;
const RIME_REGROW = 3.5;
const BEAM_R = 0.3;
const REFORM_T = 0.5;
const INVULN_T = 1.0;

export interface VaultAudio {
  sconce(): void;
  deny(): void;
  reform(): void;
  complete(): void;
}

interface Input { left: boolean; right: boolean; up: boolean; down: boolean; }

type Phase = 'run' | 'reform' | 'complete';

export class VaultRun {
  /** the master stone was touched and the sequence has finished */
  completed = false;
  /** the run wants to end (player stepped back through, or abandoned) */
  closed = false;
  phase: Phase = 'run';
  meter = METER_MAX;
  px: number; py: number;
  vx = 0; vy = 0;
  grounded = false;
  /** times the light guttered — the honest difficulty telemetry */
  reforms = 0;

  get glyphId(): string { return this.glyph.id; }

  private p: ParsedVault;
  private scene = new THREE.Scene();
  private cam: FollowCam;
  private time = 0;
  private phaseT = 0;
  private invuln = 0;
  private facing = 1;
  private walkT = 0;
  private checkpoint: { x: number; y: number };
  private sconceLit: boolean[];
  private bridgeOn = [true, false];
  private rimeState: { t: number; gone: number }[];
  private beams: { x: number; y: number; ex: number; ey: number; mesh: THREE.Mesh }[] = [];
  private windT = 0;
  private gusting = false;

  // visuals
  private pilotGroup = new THREE.Group();
  private legL!: THREE.Mesh;
  private legR!: THREE.Mesh;
  private lamp!: THREE.PointLight;
  private jetMat!: THREE.MeshBasicMaterial;
  private sconceMeshes: { flame: THREE.Mesh; light: THREE.PointLight; mat: THREE.MeshBasicMaterial }[] = [];
  private bridgeMeshes: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; group: 0 | 1 }[] = [];
  private rimeMeshes: THREE.Mesh[] = [];
  private masterGroup!: THREE.Group;
  private motes!: THREE.Points;
  private motePos!: Float32Array;
  private windStreaks: THREE.Points | null = null;
  private hud: HTMLDivElement;
  private card: HTMLDivElement | null = null;

  constructor(
    private def: VaultDef,
    private glyph: GlyphDef,
    private hue: number,
    private assist: boolean,
    private audio: VaultAudio,
    aspect: number,
    ui: HTMLElement,
  ) {
    this.p = parseVault(def);
    this.cam = new FollowCam(aspect);
    this.px = this.p.entry.x + 0.5;
    this.py = -(this.p.entry.y + 0.5) - 0.2;
    this.checkpoint = { x: this.px, y: this.py };
    this.sconceLit = this.p.sconces.map(() => false);
    this.rimeState = this.p.rime.map(() => ({ t: -1, gone: 0 }));
    this.build();
    this.cam.snap(this.px, this.py + 0.5, 9.5);
    this.cam.zoomBias = 9; // pulled back: the room is the subject, and the room is the puzzle

    this.hud = document.createElement('div');
    this.hud.id = 'vault-hud';
    this.hud.innerHTML = `
      <div class="vh-name">${glyph.name}</div>
      <div class="vh-meter"><div class="vh-fill"></div></div>
      <div class="vh-hint">WORKLIGHT — jets drink it, sconces pour it back · Esc leaves</div>`;
    ui.appendChild(this.hud);
  }

  // ---------------- construction ----------------

  private solidTile(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.p.w || y >= this.p.h) return true;
    const i = y * this.p.w + x;
    if (this.p.solid[i]) return true;
    for (let b = 0; b < this.p.bridges.length; b++) {
      const br = this.p.bridges[b];
      if (br.x === x && br.y === y) return this.bridgeOn[br.group];
    }
    for (let r = 0; r < this.p.rime.length; r++) {
      const rm = this.p.rime[r];
      if (rm.x === x && rm.y === y) return this.rimeState[r].gone <= 0;
    }
    return false;
  }

  private build(): void {
    const { p } = this;
    this.scene.background = new THREE.Color(0x05060c);
    this.scene.add(new THREE.AmbientLight(0xbfc7ff, 0.62));
    const key = new THREE.DirectionalLight(0xfff2d8, 0.35);
    key.position.set(0.4, 1, 0.8);
    this.scene.add(key);

    // masonry — one instanced box, dark tiles painted near-black so the
    // lamp is what finds them
    let count = 0;
    for (let i = 0; i < p.w * p.h; i++) if (p.solid[i]) count++;
    const box = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.2, flatShading: true });
    const inst = new THREE.InstancedMesh(box, mat, count);
    const m4 = new THREE.Matrix4();
    const col = new THREE.Color();
    let k = 0;
    for (let y = 0; y < p.h; y++) {
      for (let x = 0; x < p.w; x++) {
        const i = y * p.w + x;
        if (!p.solid[i]) continue;
        m4.makeTranslation(x + 0.5, -(y + 0.5), 0);
        inst.setMatrixAt(k, m4);
        const nearDark =
          (p.dark[i - 1] ?? 0) | (p.dark[i + 1] ?? 0) |
          (p.dark[i - p.w] ?? 0) | (p.dark[i + p.w] ?? 0);
        col.setHex(0x8f89a4).multiplyScalar(nearDark ? 0.16 : 0.85 + Math.random() * 0.3);
        inst.setColorAt(k, col);
        k++;
      }
    }
    inst.instanceMatrix.needsUpdate = true;
    this.scene.add(inst);

    // unlight: the kill tiles read as holes in the world with an ember seam
    const killMat = new THREE.MeshBasicMaterial({ color: 0x1a0508 });
    const seamMat = new THREE.MeshBasicMaterial({ color: 0xff5a3c, transparent: true, opacity: 0.22 });
    for (let y = 0; y < p.h; y++) {
      for (let x = 0; x < p.w; x++) {
        if (!p.kill[y * p.w + x]) continue;
        const hole = new THREE.Mesh(box, killMat);
        hole.position.set(x + 0.5, -(y + 0.5), -0.1);
        hole.scale.setScalar(0.98);
        const seam = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.08), seamMat);
        seam.position.set(x + 0.5, -(y + 0.5) + 0.42, 0.42);
        // a faint ember haze inside the pit, so the void reads as a place
        // light goes to die and not as a platform
        const haze = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 0.8),
          new THREE.MeshBasicMaterial({ color: 0x4a1008, transparent: true, opacity: 0.5, depthWrite: false }));
        haze.position.set(x + 0.5, -(y + 0.5), 0.35);
        this.scene.add(hole, seam, haze);
      }
    }

    // sconces
    for (const s of this.p.sconces) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.14),
        new THREE.MeshStandardMaterial({ color: 0x6f8f88, roughness: 0.4, metalness: 0.7 }));
      post.position.set(s.x + 0.5, -(s.y + 0.5) - 0.2, 0.3);
      const fm = new THREE.MeshBasicMaterial({ color: 0x342e22 });
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), fm);
      flame.position.set(s.x + 0.5, -(s.y + 0.5) + 0.15, 0.3);
      const light = new THREE.PointLight(0xffd9a0, 0, 7, 1.7);
      light.position.copy(flame.position);
      this.scene.add(post, flame, light);
      this.sconceMeshes.push({ flame, light, mat: fm });
    }

    // light bridges
    for (const b of this.p.bridges) {
      const bm = new THREE.MeshBasicMaterial({ color: this.hue, transparent: true, opacity: 0.85 });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.28, 0.6), bm);
      mesh.position.set(b.x + 0.5, -(b.y + 0.5) + 0.3, 0);
      this.scene.add(mesh);
      this.bridgeMeshes.push({ mesh, mat: bm, group: b.group });
    }

    // rime shelves
    const rimeMat = new THREE.MeshStandardMaterial({ color: 0xcfeaf5, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.92 });
    for (const r of this.p.rime) {
      const mesh = new THREE.Mesh(box, rimeMat.clone());
      mesh.position.set(r.x + 0.5, -(r.y + 0.5), 0);
      mesh.scale.set(0.98, 0.9, 0.9);
      this.scene.add(mesh);
      this.rimeMeshes.push(mesh);
    }

    // beams
    for (const b of this.def.beams ?? []) {
      const bm = new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.26), bm);
      const emitter = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x9a94ae, roughness: 0.5, metalness: 0.5 }));
      emitter.position.set(b.x, -b.y, 0.1);
      this.scene.add(mesh, emitter);
      this.beams.push({ x: b.x, y: -b.y, ex: b.x, ey: -b.y, mesh });
    }

    // the unlit figures — dark and narrow, the faintest ember at the chest
    for (const f of this.p.figures) {
      const dark = new THREE.MeshBasicMaterial({ color: 0x05070c });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.5, 0.2), dark);
      body.position.set(f.x + 0.5, -(f.y + 1) + 0.75, 0.2);
      const ember = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xff9a3c, transparent: true, opacity: 0.35 }));
      ember.position.set(f.x + 0.5, -(f.y + 1) + 0.95, 0.31);
      ember.name = 'figure-ember';
      this.scene.add(body, ember);
    }

    // the master stone: the glyph, burning, with its own glow
    this.masterGroup = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.8, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x2a2738, roughness: 0.4, metalness: 0.3 }));
    this.masterGroup.add(slab);
    const mark = buildGlyphMark(this.glyph, 1.1, this.hue, true);
    mark.position.z = 0.25;
    this.masterGroup.add(mark);
    const glow = new THREE.PointLight(this.hue, 3, 9, 1.6);
    glow.position.z = 0.8;
    this.masterGroup.add(glow);
    this.masterGroup.position.set(this.p.master.x + 0.5, -(this.p.master.y + 0.5), 0);
    this.scene.add(this.masterGroup);

    // the entry: a lit doorframe — the first checkpoint is the way in
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.7, 0.15),
      new THREE.MeshBasicMaterial({ color: this.hue, transparent: true, opacity: 0.22 }));
    frame.position.set(this.p.entry.x + 0.5, -(this.p.entry.y + 0.5), -0.3);
    this.scene.add(frame);

    // worklight motes: the air itself, falling the way the room says down.
    // In a gravity zone they fall sideways or up — shown, never told.
    const N = 420;
    this.motePos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) this.seedMote(i);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.motePos, 3));
    const pm = new THREE.PointsMaterial({ color: 0xd8d2ff, size: 0.06, transparent: true, opacity: 0.5, depthWrite: false });
    this.motes = new THREE.Points(geo, pm);
    this.scene.add(this.motes);

    // wind streaks, born only during a gust
    if (this.def.wind) {
      const W = 120;
      const wp = new Float32Array(W * 3);
      for (let i = 0; i < W; i++) {
        wp[i * 3] = Math.random() * this.p.w;
        wp[i * 3 + 1] = -Math.random() * this.p.h;
        wp[i * 3 + 2] = 0.2;
      }
      const wg = new THREE.BufferGeometry();
      wg.setAttribute('position', new THREE.BufferAttribute(wp, 3));
      this.windStreaks = new THREE.Points(wg, new THREE.PointsMaterial({ color: 0xcfe0ff, size: 0.09, transparent: true, opacity: 0, depthWrite: false }));
      this.scene.add(this.windStreaks);
    }

    // the pilot — same suit as pilot.ts, rebuilt here because this scene
    // lives and dies with the run
    const suit = new THREE.MeshStandardMaterial({ color: 0xd8c9a4, roughness: 0.6, metalness: 0.15 });
    const accent = new THREE.MeshStandardMaterial({ color: 0xff9a3c, roughness: 0.5, metalness: 0.2 });
    const visorM = new THREE.MeshStandardMaterial({ color: 0x1d4a52, roughness: 0.15, metalness: 0.5, emissive: 0x0d3a40, emissiveIntensity: 0.6 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.16, 4, 10), suit);
    body.position.y = 0.04;
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.08), accent);
    pack.position.set(0, 0.06, -0.13);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), suit);
    head.position.y = 0.24;
    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), visorM);
    visor.position.set(0, 0.24, 0.05);
    visor.scale.set(1, 0.85, 0.75);
    this.legL = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.1, 3, 6), suit);
    this.legR = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.1, 3, 6), suit);
    this.legL.position.set(-0.06, -0.16, 0);
    this.legR.position.set(0.06, -0.16, 0);
    this.jetMat = new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0 });
    const jet = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 8), this.jetMat);
    jet.position.set(0, -0.32, -0.05);
    jet.rotation.x = Math.PI;
    this.lamp = new THREE.PointLight(0xffe6c0, 6, 6, 1.6);
    this.lamp.position.set(0, 0.25, 0.4);
    this.pilotGroup.add(body, pack, head, visor, this.legL, this.legR, jet, this.lamp);
    this.scene.add(this.pilotGroup);
  }

  private seedMote(i: number): void {
    for (let tries = 0; tries < 20; tries++) {
      const x = Math.random() * this.p.w;
      const y = Math.random() * this.p.h;
      const ti = Math.floor(y) * this.p.w + Math.floor(x);
      if (this.p.solid[ti] || this.p.dark[ti]) continue;
      this.motePos[i * 3] = x;
      this.motePos[i * 3 + 1] = -y;
      this.motePos[i * 3 + 2] = -0.2;
      return;
    }
    this.motePos[i * 3] = -5; this.motePos[i * 3 + 1] = 5;
  }

  // ---------------- physics ----------------

  private gravityAt(x: number, y: number): [number, number] {
    const tx = Math.floor(x), ty = Math.floor(-y);
    if (tx < 0 || ty < 0 || tx >= this.p.w || ty >= this.p.h) return [0, -GRAV];
    switch (this.p.gravity[ty * this.p.w + tx]) {
      case 1: return [0, GRAV];
      case 2: return [GRAV, 0];
      case 3: return [-GRAV, 0];
      default: return [0, -GRAV];
    }
  }

  private darkAt(x: number, y: number): boolean {
    const tx = Math.floor(x), ty = Math.floor(-y);
    if (tx < 0 || ty < 0 || tx >= this.p.w || ty >= this.p.h) return false;
    return !!this.p.dark[ty * this.p.w + tx];
  }

  private moveX(dx: number): void {
    this.px += dx;
    const top = Math.floor(-(this.py + HH - EPS));
    const bot = Math.floor(-(this.py - HH + EPS));
    if (dx > 0) {
      const c = Math.floor(this.px + HW);
      for (let r = top; r <= bot; r++) {
        if (this.solidTile(c, r)) { this.px = c - HW - EPS; this.vx = 0; break; }
      }
    } else if (dx < 0) {
      const c = Math.floor(this.px - HW);
      for (let r = top; r <= bot; r++) {
        if (this.solidTile(c, r)) { this.px = c + 1 + HW + EPS; this.vx = 0; break; }
      }
    }
  }

  private moveY(dy: number): { floorTile: [number, number] | null } {
    this.py += dy;
    const left = Math.floor(this.px - HW + EPS);
    const right = Math.floor(this.px + HW - EPS);
    let floorTile: [number, number] | null = null;
    if (dy < 0) {
      const r = Math.floor(-(this.py - HH));
      for (let c = left; c <= right; c++) {
        if (this.solidTile(c, r)) {
          this.py = -r + HH + EPS;
          this.vy = 0;
          this.grounded = true;
          floorTile = [c, r];
          break;
        }
      }
    } else if (dy > 0) {
      const r = Math.floor(-(this.py + HH));
      if (r >= 0) {
        for (let c = left; c <= right; c++) {
          if (this.solidTile(c, r)) {
            this.py = -(r + 1) - HH - EPS;
            this.vy = 0;
            break;
          }
        }
      }
    }
    return { floorTile };
  }

  private touchingKill(): boolean {
    const corners: [number, number][] = [
      [this.px - HW, this.py - HH], [this.px + HW, this.py - HH],
      [this.px - HW, this.py + HH], [this.px + HW, this.py + HH],
    ];
    for (const [x, y] of corners) {
      const tx = Math.floor(x), ty = Math.floor(-y);
      if (tx >= 0 && ty >= 0 && tx < this.p.w && ty < this.p.h && this.p.kill[ty * this.p.w + tx]) return true;
    }
    return false;
  }

  private reform(): void {
    this.audio.reform();
    this.reforms++;
    this.phase = 'reform';
    this.phaseT = 0;
  }

  // ---------------- frame ----------------

  frame(dt: number, input: Input, lampOn: boolean): void {
    this.time += dt;
    const hazardMul = this.assist ? 0.6 : 1;
    const drainMul = this.assist ? 0.75 : 1;

    // bridges keep their metronome even while you re-form
    const cycle = (BRIDGE_HALF * 2) / hazardMul;
    const half = cycle / 2;
    const tc = this.time % cycle;
    this.bridgeOn[0] = tc < half;
    this.bridgeOn[1] = !this.bridgeOn[0];
    const warn = (tc % half) > half - BRIDGE_WARN;

    // beams sweep
    const bdefs = this.def.beams ?? [];
    for (let i = 0; i < bdefs.length; i++) {
      const b = bdefs[i];
      const u = (this.time / (b.period / hazardMul) + b.phase) % 1;
      const ping = u < 0.5 ? u * 2 : 2 - u * 2;
      const ang = b.a0 + (b.a1 - b.a0) * ping;
      const beam = this.beams[i];
      let ex = beam.x, ey = beam.y;
      for (let s = 0; s < 60; s++) {
        const nx = ex + Math.cos(ang) * 0.35;
        const ny = ey + Math.sin(ang) * 0.35;
        if (this.solidTile(Math.floor(nx), Math.floor(-ny))) break;
        ex = nx; ey = ny;
      }
      beam.ex = ex; beam.ey = ey;
      const len = Math.hypot(ex - beam.x, ey - beam.y);
      beam.mesh.position.set((beam.x + ex) / 2, (beam.y + ey) / 2, 0.15);
      beam.mesh.scale.set(len, 1, 1);
      beam.mesh.rotation.z = Math.atan2(ey - beam.y, ex - beam.x);
    }

    // wind
    if (this.def.wind) {
      const w = this.def.wind;
      this.windT += dt;
      const period = w.calm + w.gust;
      const inGust = (this.windT % period) > w.calm;
      this.gusting = inGust;
      const mat = (this.windStreaks!.material as THREE.PointsMaterial);
      mat.opacity += ((inGust ? 0.55 : 0) - mat.opacity) * Math.min(1, dt * 6);
      if (inGust) {
        const pos = this.windStreaks!.geometry.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) {
          let x = pos.getX(i) + w.dir * (8 + (i % 5)) * dt;
          if (w.dir < 0 && x < 0) x = this.p.w;
          if (w.dir > 0 && x > this.p.w) x = 0;
          pos.setX(i, x);
        }
        pos.needsUpdate = true;
      }
    }

    // rime shelves crumble and regrow
    for (let i = 0; i < this.rimeState.length; i++) {
      const rs = this.rimeState[i];
      const mesh = this.rimeMeshes[i];
      if (rs.gone > 0) {
        rs.gone -= dt;
        mesh.visible = false;
        if (rs.gone <= 0) {
          // never regrow into the pilot
          const r = this.p.rime[i];
          if (Math.abs(this.px - (r.x + 0.5)) < 1 && Math.abs(this.py + r.y + 0.5) < 1) rs.gone = 0.4;
          else { rs.t = -1; mesh.visible = true; }
        }
      } else if (rs.t >= 0) {
        rs.t += dt;
        mesh.position.x = this.p.rime[i].x + 0.5 + Math.sin(this.time * 60) * 0.03 * (rs.t / RIME_CRUMBLE);
        if (rs.t >= RIME_CRUMBLE) { rs.gone = RIME_REGROW; rs.t = -1; }
      }
    }

    if (this.phase === 'reform') {
      this.phaseT += dt;
      this.pilotGroup.scale.setScalar(Math.max(0.01, 1 - this.phaseT / REFORM_T));
      if (this.phaseT >= REFORM_T) {
        this.px = this.checkpoint.x; this.py = this.checkpoint.y;
        this.vx = 0; this.vy = 0;
        this.meter = METER_MAX;
        this.invuln = INVULN_T;
        this.phase = 'run';
        this.pilotGroup.scale.setScalar(1);
      }
    } else if (this.phase === 'complete') {
      this.phaseT += dt;
      // the room answers: sconces light in sequence, the stone flares
      const n = Math.floor(this.phaseT / 0.35);
      for (let i = 0; i < Math.min(n, this.sconceLit.length); i++) {
        if (!this.sconceLit[i]) { this.sconceLit[i] = true; this.audio.sconce(); }
      }
      this.masterGroup.scale.setScalar(1 + Math.sin(this.phaseT * 3) * 0.04);
      if (this.phaseT >= 2.4 && !this.completed) {
        this.completed = true;
        this.audio.complete();
        this.showCard();
      }
    } else {
      this.step(dt, input, drainMul);
    }

    // shared per-frame updates
    this.invuln = Math.max(0, this.invuln - dt);

    // meter refill
    const dark = this.darkAt(this.px, this.py);
    let refill = dark ? 0 : (this.def.ambient ?? 7);
    for (let i = 0; i < this.p.sconces.length; i++) {
      if (!this.sconceLit[i]) continue;
      const s = this.p.sconces[i];
      if (Math.hypot(this.px - (s.x + 0.5), this.py + s.y + 0.5) < SCONCE_RANGE) { refill = REFILL_SCONCE; break; }
    }
    this.meter = Math.min(METER_MAX, this.meter + refill * dt);

    // sconce touch
    if (this.phase === 'run') {
      for (let i = 0; i < this.p.sconces.length; i++) {
        if (this.sconceLit[i]) continue;
        const s = this.p.sconces[i];
        if (Math.hypot(this.px - (s.x + 0.5), this.py + s.y + 0.5) > 0.95) continue;
        const cost = this.def.sconceCost ?? 0;
        if (cost > 0 && this.meter < cost + 8) {
          // not enough of you to feed it — the socket flickers and refuses
          this.sconceMeshes[i].mat.color.setHex(0x6a5138);
          this.audio.deny();
          continue;
        }
        this.meter -= cost;
        this.sconceLit[i] = true;
        this.checkpoint = { x: s.x + 0.5, y: -(s.y + 0.5) - 0.2 };
        this.audio.sconce();
      }
      // the master stone
      const m = this.p.master;
      if (Math.hypot(this.px - (m.x + 0.5), this.py + m.y + 0.5) < 1.5) {
        this.phase = 'complete';
        this.phaseT = 0;
        this.vx = 0; this.vy = 0;
      }
    }

    // visuals
    for (let i = 0; i < this.sconceMeshes.length; i++) {
      const sm = this.sconceMeshes[i];
      const lit = this.sconceLit[i];
      sm.light.intensity = lit ? 2.4 + Math.sin(this.time * 7 + i) * 0.4 : 0;
      sm.mat.color.setHex(lit ? 0xffd9a0 : 0x342e22);
      sm.flame.scale.setScalar(lit ? 1 + Math.sin(this.time * 9 + i) * 0.15 : 0.8);
    }
    for (const bm of this.bridgeMeshes) {
      const on = this.bridgeOn[bm.group];
      const flick = warn && on ? (Math.sin(this.time * 55) > 0 ? 1 : 0.25) : 1;
      bm.mat.opacity = on ? 0.85 * flick : 0.06;
      bm.mesh.scale.y = on ? 1 : 0.4;
    }
    this.lamp.intensity = lampOn ? 6 : 0.6;
    const dot = this.masterGroup.getObjectByName('glyph-light');
    if (dot) dot.scale.setScalar(1 + Math.sin(this.time * 2.4) * 0.2);
    for (const obj of this.scene.children) {
      if (obj.name === 'figure-ember') {
        (obj as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>).material.opacity = 0.25 + Math.sin(this.time * 0.9) * 0.12;
      }
    }

    // motes drift the way the room says down
    const pos = this.motes.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const [gx, gy] = this.gravityAt(x, y);
      let nx = x + (gx / GRAV) * 0.45 * dt;
      let ny = y + (gy / GRAV) * 0.45 * dt + (gy === -GRAV ? 0 : 0);
      const ti = Math.floor(-ny) * this.p.w + Math.floor(nx);
      if (nx < 0 || nx >= this.p.w || -ny >= this.p.h || -ny < 0 || this.p.solid[ti]) {
        this.seedMote(i);
      } else {
        pos.setXY(i, nx, ny);
      }
    }
    pos.needsUpdate = true;

    // pilot mesh + camera + hud
    this.walkT += dt * Math.abs(this.vx) * 4;
    const swing = this.grounded ? Math.sin(this.walkT) * 0.5 : 0.3;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.pilotGroup.rotation.y = this.facing > 0 ? 0.35 : -0.35;
    this.pilotGroup.position.set(this.px, this.py, 0.1);
    this.cam.follow(dt, this.px, this.py, this.vx, this.vy, true);
    const fill = this.hud.querySelector('.vh-fill') as HTMLDivElement | null;
    if (fill) {
      fill.style.width = `${this.meter}%`;
      fill.style.background = this.meter < 25 ? '#ff6a4a' : '#ffd9a0';
    }
  }

  private step(dt: number, input: Input, drainMul: number): void {
    const [gx, gy] = this.gravityAt(this.px, this.py);
    const downGravity = gy < 0 && gx === 0;

    let jetting = false;
    if (downGravity && this.grounded) {
      // on honest ground the suit is just legs: walking is free, and so is
      // the jump that starts every flight
      const move = (input.left ? -1 : 0) + (input.right ? 1 : 0);
      if (move !== 0) {
        this.vx += move * 30 * dt;
        this.vx = Math.max(-WALK, Math.min(WALK, this.vx));
        this.facing = move;
      } else {
        this.vx -= this.vx * Math.min(1, 14 * dt);
      }
      if (input.up) { this.vy = JUMP; this.grounded = false; }
    } else {
      // airborne (or sideways/upside-down): drift is free, jets are not
      const move = (input.left ? -1 : 0) + (input.right ? 1 : 0);
      if (move !== 0) {
        this.vx += move * AIR_CTRL * dt;
        this.facing = move;
      }
      if (this.meter > 0) {
        if (input.up) { this.vy += THRUST * dt; jetting = true; }
        if (input.down) { this.vy -= THRUST * dt; jetting = true; }
      }
    }
    if (jetting) this.meter = Math.max(0, this.meter - DRAIN * drainMul * dt);
    this.jetMat.opacity += ((jetting ? 0.8 : 0) - this.jetMat.opacity) * Math.min(1, dt * 10);

    // wind is a hand on your back — unless masonry stands windward of you
    if (this.def.wind && this.gusting) {
      const w = this.def.wind;
      const wx = Math.floor(this.px), wy = Math.floor(-this.py);
      let sheltered = false;
      for (let d = 1; d <= 2 && !sheltered; d++) {
        const cx = wx - w.dir * d;
        if (this.solidTile(cx, wy) || this.solidTile(cx, wy - 1)) sheltered = true;
      }
      if (!sheltered) this.vx += w.dir * w.force * (this.assist ? 0.6 : 1) * dt;
    }

    this.vx += gx * dt;
    this.vy += gy * dt;
    this.vx = Math.max(-MAX_V, Math.min(MAX_V, this.vx));
    this.vy = Math.max(-MAX_V, Math.min(MAX_V, this.vy));

    this.grounded = false;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(this.vx), Math.abs(this.vy)) * dt / 0.2));
    const sdt = dt / steps;
    let floorTile: [number, number] | null = null;
    for (let i = 0; i < steps; i++) {
      this.moveX(this.vx * sdt);
      const r = this.moveY(this.vy * sdt);
      if (r.floorTile) floorTile = r.floorTile;
    }

    // standing on young ice wakes it
    if (floorTile) {
      for (let i = 0; i < this.p.rime.length; i++) {
        const rm = this.p.rime[i];
        if (rm.x === floorTile[0] && rm.y === floorTile[1] && this.rimeState[i].t < 0 && this.rimeState[i].gone <= 0) {
          this.rimeState[i].t = 0;
        }
      }
    }

    // hazards
    if (this.invuln <= 0) {
      if (this.touchingKill()) { this.reform(); return; }
      for (const b of this.beams) {
        // distance from pilot to the beam segment
        const dx = b.ex - b.x, dy = b.ey - b.y;
        const len2 = dx * dx + dy * dy || 1;
        const t = Math.max(0, Math.min(1, ((this.px - b.x) * dx + (this.py - b.y) * dy) / len2));
        const cx = b.x + dx * t, cy = b.y + dy * t;
        if (Math.hypot(this.px - cx, this.py - cy) < BEAM_R) { this.reform(); return; }
      }
    }
  }

  // ---------------- completion card / lifecycle ----------------

  private showCard(): void {
    this.card = document.createElement('div');
    this.card.id = 'vault-card';
    this.card.innerHTML = `
      <div class="vc-glyph">${glyphSvg(this.glyph, 'vc-svg')}</div>
      <div class="vc-name">${this.glyph.name}</div>
      <div class="vc-text">${this.glyph.fragment}</div>
      <div class="vc-hint">E — STEP BACK THROUGH THE STONE</div>`;
    this.hud.parentElement?.appendChild(this.card);
  }

  /** E pressed inside the vault */
  interact(): void {
    if (this.completed) { this.closed = true; return; }
    // stepping back out through the way in abandons the attempt
    const e = this.p.entry;
    if (Math.hypot(this.px - (e.x + 0.5), this.py + e.y + 0.5) < 1.1) this.closed = true;
  }

  /** Esc always leaves — the stone holds no one */
  abandon(): void { this.closed = true; }

  resize(aspect: number): void {
    this.cam.camera.aspect = aspect;
    this.cam.camera.updateProjectionMatrix();
  }

  render(renderer: THREE.WebGLRenderer): void {
    renderer.render(this.scene, this.cam.camera);
  }

  dispose(): void {
    this.hud.remove();
    this.card?.remove();
    this.scene.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose?.();
    });
  }
}
