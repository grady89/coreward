import * as THREE from 'three';
import { FollowCam } from '../fx/camera';
import { GlyphDef, buildGlyphMark, glyphSvg } from '../world/glyphs';
import { VaultDef, ParsedVault, parseVault } from '../world/vaults';
import { Suit, SUIT_R, SUIT_H, buildSuit, animateSuit } from '../player/suit';

// A VAULT RUN — one attempt at one of the Nine Stones (SPEC-GLYPHS.md §3,
// second pass). The movement set is discrete now, Celeste-school:
//
//   walk / jump ......... free (coyote time, jump buffering, variable height)
//   wall-slide / -jump .. free — press into a wall airborne and it catches you
//   the SPARK ........... one stored dash, 8-way, on Shift. Landing on stone
//                         relights it; so does any lit sconce within reach —
//                         including mid-air, which is what routes are made of.
//
// There is no hover. There is no meter. You carry one breath of light and
// the level is the question of where you spend it. Failure is never death:
// you gutter and re-form at the last sconce you lit.

/**
 * How much bigger the driller stands in a vault than out in the mines.
 *
 * The levels are authored in tiles and the movement constants below are in
 * tiles, so BOTH stay exactly as they were — every gap, arc and hazard is
 * measured the same. What changes is the body reading against that grid: at
 * 1x the driller is half a tile and a jump clears five and a half of them,
 * which is why the camera had to sit so far back and why the rooms read as
 * dollhouses. At 2x the body is a full tile, a jump clears 2.8 of them, and
 * the frame can come in close enough to see the visor.
 *
 * The ceiling is the maps: the tightest traversed corridors (THE LAST SHIFT,
 * THE WEATHER) are 2 tiles of headroom, so a body taller than 2 tiles would
 * not fit through its own levels.
 */
const BODY = 2;
const HW = 0.15 * BODY;
const HH = 0.26 * BODY;
const EPS = 0.001;
const WALK = 3.6;
const AIR_CTRL = 26;        // horizontal steering, airborne (capped at walk speed)
const JUMP = 11;
const GRAV = 24;            // heavier than the old float — jumps ARC now
const MAX_FALL = 13;
const DASH_V = 14;
const DASH_T = 0.15;
const DASH_KEEP = 8.0;      // speed retained when the dash ends (SPEC-VAULTS-2 F6)
const DASH_CARRY = 0.25;    // seconds the kept speed takes to decay to WALK
const FREEZE_T = 0.05;      // ~3 frames the world holds its breath on ignition (F3);
                            // the same window is the aim latch (F5)
const FAST_FALL = 18;       // MAX_FALL while down is held (F7)
const APEX_BAND = 2.0;      // |vy| under this with jump held: half gravity (F4)
const CORNER = 0.3;         // head-bonk horizontal forgiveness, tiles (F1)
const DASH_POP = 0.35;      // dash lip pop / floor snap reach, tiles (F2)
const WJ_NEAR = 0.4;        // a wall this close counts for a wall-jump (F9)
const WJ_LATCH = 0.08;      // ~5 frames the wall-jump's push-out cannot be steered against
const WALL_SLIDE = 2.6;     // max fall speed against a wall
const WALL_JUMP_UP = 10.5;
const WALL_JUMP_OUT = 5.6;
const COYOTE = 0.1;
const BUFFER = 0.12;
const SCONCE_LIGHT_R = 1.0; // touch an unlit sconce to light it
const SCONCE_SPARK_R = 1.4; // a lit sconce relights the spark from here
const BRIDGE_HALF = 1.7;
const BRIDGE_WARN = 0.35;
const RIME_CRUMBLE = 0.55;
const RIME_REGROW = 3.5;
const BEAM_R = 0.3;
const REFORM_T = 0.35;
const INVULN_T = 0.6;

export interface VaultAudio {
  sconce(): void;
  deny(): void;
  reform(): void;
  complete(): void;
}

interface Input { left: boolean; right: boolean; up: boolean; down: boolean; }

type Phase = 'run' | 'complete';

export class VaultRun {
  completed = false;
  closed = false;
  phase: Phase = 'run';
  /** the one breath of light. True = a dash is loaded. */
  spark = true;
  px: number; py: number;
  vx = 0; vy = 0;
  grounded = false;
  /** times the light guttered — honest difficulty telemetry, shown at the end */
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
  private doorOpen: boolean[];
  private bridgeOn = [true, false];
  private rimeState: { t: number; gone: number }[];
  private beamRays: { ex: number; ey: number; mesh: THREE.Mesh }[] = [];
  private windT = 0;
  private gusting = false;
  // movement state
  private dashT = 0;
  private dashVX = 0;
  private dashVY = 0;
  private coyoteT = 0;
  private bufferT = 0;
  private wallDir = 0;
  private wallCoyote = 0;
  private jumpHeld = false;
  private jumpCut = false;
  // pursuit state
  private pursuitOn = false;
  private pursuitEdge = 0;
  private pursuitDone = false;

  // visuals
  private pilotGroup = new THREE.Group();
  private suit!: Suit;
  private lamp!: THREE.PointLight;
  private sparkMesh!: THREE.Mesh;
  private trail: { mesh: THREE.Mesh; t: number }[] = [];
  private freezeT = 0;        // spark ignition freeze; doubles as the aim latch
  private dashDX = 0;
  private dashDY = 0;
  private dashCarryT = 0;     // kept dash speed decaying back to WALK
  private wallJumpT = 0;      // push-out protection after a wall-jump
  private reformT = 0;        // visual only — control is already back
  private sconceMeshes: { flame: THREE.Mesh; light: THREE.PointLight; mat: THREE.MeshBasicMaterial }[] = [];
  private doorMeshes: THREE.Mesh[][] = [];
  private bridgeMeshes: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; group: 0 | 1 }[] = [];
  private rimeMeshes: THREE.Mesh[] = [];
  private shuttleMeshes: { bolt: THREE.Mesh; mat: THREE.MeshBasicMaterial }[] = [];
  private censerMeshes: { bob: THREE.Group; chain: THREE.Line; light: THREE.PointLight }[] = [];
  private crusherMeshes: THREE.Mesh[] = [];
  private pursuitMesh: THREE.Mesh | null = null;
  private pursuitEdgeMesh: THREE.Mesh | null = null;
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
    this.cam.xMax = this.p.w;
    this.px = this.p.entry.x + 0.5;
    this.py = -(this.p.entry.y + 0.5) - 0.2;
    this.checkpoint = { x: this.px, y: this.py };
    this.sconceLit = this.p.sconces.map(() => false);
    this.doorOpen = this.p.doors.map(() => false);
    this.rimeState = this.p.rime.map(() => ({ t: -1, gone: 0 }));
    this.build();
    this.cam.zoomBias = 4;
    this.cam.snap(this.px, this.py + 0.5, 8.5 + this.cam.zoomBias);

    this.hud = document.createElement('div');
    this.hud.id = 'vault-hud';
    this.hud.innerHTML = `
      <div class="vh-name">${glyph.name}</div>
      <div class="vh-spark">◆</div>
      <div class="vh-hint">SHIFT — spend the spark · stone and sconces relight it · walls catch you · Esc leaves</div>`;
    ui.appendChild(this.hud);
  }

  // ---------------- geometry ----------------

  private hazardMul(): number { return this.assist ? 0.6 : 1; }

  private solidTile(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.p.w || y >= this.p.h) return true;
    const i = y * this.p.w + x;
    if (this.p.solid[i]) return true;
    for (let d = 0; d < this.p.doors.length; d++) {
      if (this.doorOpen[d]) continue;
      for (const t of this.p.doors[d].tiles) if (t.x === x && t.y === y) return true;
    }
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

  private gravityAt(x: number, y: number): [number, number] {
    const tx = Math.floor(x), ty = Math.floor(-y);
    if (tx < 0 || ty < 0 || tx >= this.p.w || ty >= this.p.h) return [0, -GRAV];
    switch (this.p.gravity[ty * this.p.w + tx]) {
      case 1: return [0, GRAV];
      case 2: return [GRAV * 0.55, 0];
      case 3: return [-GRAV * 0.55, 0];
      default: return [0, -GRAV];
    }
  }

  // ---------------- construction ----------------

  private build(): void {
    const { p } = this;
    this.scene.background = new THREE.Color(0x05060c);
    this.scene.add(new THREE.AmbientLight(0xbfc7ff, 0.62));
    const key = new THREE.DirectionalLight(0xfff2d8, 0.35);
    key.position.set(0.4, 1, 0.8);
    this.scene.add(key);

    // masonry
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

    // unlight
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

    // doors — masonry a shade warmer, with a faint rune of the count it wants
    for (const d of this.p.doors) {
      const meshes: THREE.Mesh[] = [];
      const dm = new THREE.MeshStandardMaterial({ color: 0x7a6a56, roughness: 0.5, metalness: 0.3, flatShading: true, transparent: true });
      for (const t of d.tiles) {
        const m = new THREE.Mesh(box, dm);
        m.position.set(t.x + 0.5, -(t.y + 0.5), 0);
        m.scale.setScalar(0.99);
        this.scene.add(m);
        meshes.push(m);
      }
      this.doorMeshes.push(meshes);
    }

    // bridges
    for (const b of this.p.bridges) {
      const bm = new THREE.MeshBasicMaterial({ color: this.hue, transparent: true, opacity: 0.85 });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.28, 0.6), bm);
      mesh.position.set(b.x + 0.5, -(b.y + 0.5) + 0.3, 0);
      this.scene.add(mesh);
      this.bridgeMeshes.push({ mesh, mat: bm, group: b.group });
    }

    // rime
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
      const emitter = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x9a94ae, roughness: 0.5, metalness: 0.5 }));
      emitter.position.set(b.x, -b.y, 0.1);
      this.scene.add(mesh, emitter);
      this.beamRays.push({ ex: b.x, ey: -b.y, mesh });
    }

    // shuttles — a bolt of light on a rail; the rail itself is drawn faint
    for (const s of this.def.shuttles ?? []) {
      const railGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(s.x0 + 0.5, -(s.y0 + 0.5), 0.05),
        new THREE.Vector3(s.x1 + 0.5, -(s.y1 + 0.5), 0.05),
      ]);
      const rail = new THREE.Line(railGeo, new THREE.LineBasicMaterial({ color: this.hue, transparent: true, opacity: 0.18 }));
      const horizontal = Math.abs(s.x1 - s.x0) >= Math.abs(s.y1 - s.y0);
      const bm = new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
      const bolt = new THREE.Mesh(new THREE.BoxGeometry(horizontal ? 1.4 : 0.34, horizontal ? 0.34 : 1.4, 0.4), bm);
      this.scene.add(rail, bolt);
      this.shuttleMeshes.push({ bolt, mat: bm });
    }

    // censers — a lantern on a chain, still swinging after all this time
    for (const c of this.def.censers ?? []) {
      const chainGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -c.len, 0),
      ]);
      const chain = new THREE.Line(chainGeo, new THREE.LineBasicMaterial({ color: 0x8f89a4, transparent: true, opacity: 0.7 }));
      chain.position.set(c.x, -c.y, 0.2);
      const bob = new THREE.Group();
      const shell = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10),
        new THREE.MeshStandardMaterial({ color: 0x6f8f88, roughness: 0.4, metalness: 0.7 }));
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
      const light = new THREE.PointLight(0xffd9a0, 2.2, 7, 1.7);
      bob.add(shell, flame, light);
      this.scene.add(chain, bob);
      this.censerMeshes.push({ bob, chain, light });
    }

    // crushers — pistons of the same stone, ember-seamed on the working face
    for (const c of this.def.crushers ?? []) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(c.w, c.h, 1),
        new THREE.MeshStandardMaterial({ color: 0x6a6480, roughness: 0.55, metalness: 0.3, flatShading: true }));
      const face = new THREE.Mesh(new THREE.PlaneGeometry(
        c.dx !== 0 ? 0.1 : c.w * 0.9, c.dx !== 0 ? c.h * 0.9 : 0.1),
        new THREE.MeshBasicMaterial({ color: 0xff5a3c, transparent: true, opacity: 0.5 }));
      face.position.set(c.dx !== 0 ? Math.sign(c.dx) * c.w / 2 : 0, c.dy !== 0 ? -Math.sign(c.dy) * c.h / 2 : 0, 0.51);
      mesh.add(face);
      this.scene.add(mesh);
      this.crusherMeshes.push(mesh);
    }

    // pursuit — the consumed dark, and its burning leading edge
    if (this.def.pursuit) {
      const z = this.def.pursuit.zone;
      const zw = z[2] - z[0] + 1, zh = z[3] - z[1] + 1;
      this.pursuitMesh = new THREE.Mesh(new THREE.PlaneGeometry(zw, zh),
        new THREE.MeshBasicMaterial({ color: 0x02030a, transparent: true, opacity: 0.96, depthWrite: false }));
      this.pursuitMesh.visible = false;
      const vertical = this.def.pursuit.dir === 'down' || this.def.pursuit.dir === 'up';
      this.pursuitEdgeMesh = new THREE.Mesh(new THREE.PlaneGeometry(vertical ? zw : 0.16, vertical ? 0.16 : zh),
        new THREE.MeshBasicMaterial({ color: 0xff5a3c, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }));
      this.pursuitEdgeMesh.visible = false;
      this.scene.add(this.pursuitMesh, this.pursuitEdgeMesh);
    }

    // figures
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

    // master stone
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

    // entry frame
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.7, 0.15),
      new THREE.MeshBasicMaterial({ color: this.hue, transparent: true, opacity: 0.22 }));
    frame.position.set(this.p.entry.x + 0.5, -(this.p.entry.y + 0.5), -0.3);
    this.scene.add(frame);

    // motes falling the way each zone says down
    const N = 420;
    this.motePos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) this.seedMote(i);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.motePos, 3));
    this.motes = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xd8d2ff, size: 0.06, transparent: true, opacity: 0.5, depthWrite: false }));
    this.scene.add(this.motes);

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

    // the pilot — same suit the EVA wears, so the two can never drift
    this.suit = buildSuit();
    // the spark itself rides on the pack, visibly lit or spent
    this.sparkMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.075),
      new THREE.MeshBasicMaterial({ color: 0xbfe8ff }));
    this.sparkMesh.position.copy(this.suit.packAnchor);
    this.lamp = new THREE.PointLight(0xffe6c0, 6, 6 * BODY, 1.6);
    this.lamp.position.set(0, 0, 0.35);
    const body = new THREE.Group();
    body.scale.setScalar(BODY);
    body.add(this.suit.group, this.sparkMesh, this.lamp);
    this.pilotGroup.add(body);
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

  // ---------------- movement ----------------

  /**
   * Shift pressed: spend the spark. The world freezes for FREEZE_T (~3
   * frames) — the whole weight of the 2.1-tile burst lives in that hitch —
   * and inside the freeze the aim can still be corrected (the latch), so
   * "I sparked into the floor" dies on the keyboard, not in the level.
   */
  dash(input: Input): void {
    if (this.phase !== 'run' || !this.spark || this.dashT > 0 || this.freezeT > 0) return;
    let dx = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    let dy = (input.up ? 1 : 0) + (input.down ? -1 : 0);
    if (dx === 0 && dy === 0) dx = this.facing;
    this.spark = false;
    this.dashDX = dx;
    this.dashDY = dy;
    this.freezeT = FREEZE_T;
  }

  /** the freeze has run out: the burst actually happens */
  private igniteDash(): void {
    const len = Math.hypot(this.dashDX, this.dashDY) || 1;
    this.dashT = DASH_T;
    this.dashVX = (this.dashDX / len) * DASH_V;
    this.dashVY = (this.dashDY / len) * DASH_V;
    this.vx = this.dashVX;
    this.vy = this.dashVY;
    if (this.dashDX !== 0) this.facing = Math.sign(this.dashDX);
    // the burst leaves a short trail of itself
    for (let i = 0; i < 3; i++) {
      const ghost = new THREE.Mesh(new THREE.CapsuleGeometry(SUIT_R * BODY, SUIT_H * BODY, 3, 6),
        new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.4 - i * 0.1 }));
      ghost.position.set(this.px - this.dashVX * 0.02 * (i + 1), this.py - this.dashVY * 0.02 * (i + 1), 0.05);
      this.scene.add(ghost);
      this.trail.push({ mesh: ghost, t: 0.25 });
    }
  }

  /** jump pressed (edge) — buffered so a slightly-early press still lands */
  jumpPress(): void { this.bufferT = BUFFER; this.jumpHeld = true; this.jumpCut = false; }
  jumpRelease(): void { this.jumpHeld = false; }

  private step(dt: number, input: Input): void {
    const [gx, gy] = this.gravityAt(this.px, this.py);
    const vertical = gx === 0;
    const gSign = vertical ? Math.sign(-gy) : 0; // 1 = falls down, -1 = falls up

    // timers — the jump buffer does not tick down mid-dash, so a press
    // during the burst still fires the frame the burst ends (F8)
    this.coyoteT = Math.max(0, this.coyoteT - dt);
    if (this.dashT <= 0) this.bufferT = Math.max(0, this.bufferT - dt);
    this.wallCoyote = Math.max(0, this.wallCoyote - dt);
    this.wallJumpT = Math.max(0, this.wallJumpT - dt);
    this.dashCarryT = Math.max(0, this.dashCarryT - dt);

    if (this.dashT > 0) {
      // mid-dash: locked velocity, no gravity — the burst is the burst
      this.dashT -= dt;
      this.vx = this.dashVX;
      this.vy = this.dashVY;
      if (this.dashT <= 0) {
        this.vx = Math.sign(this.vx) * Math.min(Math.abs(this.vx), DASH_KEEP);
        this.vy = Math.sign(this.vy) * Math.min(Math.abs(this.vy), DASH_KEEP);
        this.dashCarryT = DASH_CARRY;
        // a spark spent downward never dies to a pixel: snap the last
        // DASH_POP of air onto the floor it was clearly aimed at (F2)
        if (this.dashVY < 0 && gSign > 0) this.dashFloorSnap();
      }
    } else {
      // steering
      let move = (input.left ? -1 : 0) + (input.right ? 1 : 0);
      // a fresh wall-jump's push-out cannot be steered against for ~5
      // frames, so mashing toward the wall does not eat the kick (F9)
      if (this.wallJumpT > 0 && move !== 0 && move === -Math.sign(this.vx)) move = 0;
      if (move !== 0) {
        const accel = this.grounded ? 34 : AIR_CTRL;
        this.vx += move * accel * dt;
        const carrying = this.dashCarryT > 0;
        if (!carrying && Math.abs(this.vx) > WALK && Math.sign(this.vx) === move && this.grounded) this.vx = move * WALK;
        // airborne steering never outruns a dash — the dash is the fast verb
        if (!carrying && !this.grounded && Math.sign(this.vx) === move && Math.abs(this.vx) > 5) this.vx = move * 5;
        this.facing = move;
      } else if (this.grounded && this.dashCarryT <= 0) {
        this.vx -= this.vx * Math.min(1, 14 * dt);
      }
      // kept dash speed bleeds back to WALK over DASH_CARRY — the long-tail
      // window where spark-into-wall-jump chains live (F6)
      if (this.dashCarryT > 0 && Math.abs(this.vx) > WALK) {
        const bleed = (DASH_KEEP - WALK) / DASH_CARRY * dt;
        this.vx = Math.sign(this.vx) * Math.max(WALK, Math.abs(this.vx) - bleed);
      }

      // gravity — half strength in the apex band while jump is held: the
      // ~0.3s crown where every spark decision happens (F4)
      this.vx += gx * dt;
      const crowned = vertical && this.jumpHeld && !this.jumpCut && Math.abs(this.vy) < APEX_BAND;
      this.vy += gy * (crowned ? 0.5 : 1) * dt;

      // wall slide (vertical gravity only): pressing into a wall catches you.
      // A wall-jump is more generous — any wall within WJ_NEAR counts,
      // pressed-into or not, so the wall verbs are unfumbleable and the
      // spark stays the only scarce thing (F9)
      this.wallDir = 0;
      let wallNear = 0;
      if (vertical && !this.grounded) {
        if (this.wallAt(-1, WJ_NEAR)) wallNear = -1;
        else if (this.wallAt(1, WJ_NEAR)) wallNear = 1;
        if (move === -1 && this.wallAt(-1, 0.06)) this.wallDir = -1;
        else if (move === 1 && this.wallAt(1, 0.06)) this.wallDir = 1;
        if (this.wallDir !== 0) {
          this.wallCoyote = COYOTE;
          const falling = gSign > 0 ? this.vy < 0 : this.vy > 0;
          if (falling) {
            const cap = WALL_SLIDE * gSign;
            if (gSign > 0 ? this.vy < -cap : this.vy > -cap) this.vy = -cap;
          }
        }
      }

      // jump: from ground (coyote'd), or off a wall
      if (this.bufferT > 0 && vertical) {
        if (this.grounded || this.coyoteT > 0) {
          this.vy = JUMP * gSign;
          this.grounded = false;
          this.coyoteT = 0;
          this.bufferT = 0;
          this.jumpCut = false;
        } else if (this.wallDir !== 0 || wallNear !== 0 || this.wallCoyote > 0) {
          const off = this.wallDir !== 0 ? this.wallDir : wallNear;
          const away = off !== 0 ? -off : -Math.sign(this.facing);
          this.vy = WALL_JUMP_UP * gSign;
          this.vx = away * WALL_JUMP_OUT;
          this.facing = away;
          this.bufferT = 0;
          this.wallCoyote = 0;
          this.wallJumpT = WJ_LATCH;
          this.jumpCut = false;
        }
      }
      // variable height: let go early and the jump shortens
      if (!this.jumpHeld && !this.jumpCut && vertical) {
        const rising = gSign > 0 ? this.vy > 0 : this.vy < 0;
        if (rising) { this.vy *= 0.45; this.jumpCut = true; }
      }

      // wind
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

      // caps — holding down opens the fall governor (F7)
      const falling = gSign > 0 ? this.vy < 0 : this.vy > 0;
      const maxFall = vertical && input.down && !this.grounded && falling ? FAST_FALL : MAX_FALL;
      this.vy = Math.max(-maxFall, Math.min(maxFall, this.vy));
      this.vx = Math.max(-MAX_FALL, Math.min(MAX_FALL, this.vx));
    }

    // integrate
    const wasGrounded = this.grounded;
    this.grounded = false;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(this.vx), Math.abs(this.vy)) * dt / 0.2));
    const sdt = dt / steps;
    let floorTile: [number, number] | null = null;
    for (let i = 0; i < steps; i++) {
      this.moveX(this.vx * sdt);
      const r = this.moveY(this.vy * sdt, gSign);
      if (r) floorTile = r;
    }
    if (wasGrounded && !this.grounded) this.coyoteT = COYOTE;
    if (this.grounded) {
      this.spark = true;             // stone underfoot relights the breath
      this.coyoteT = COYOTE;
    }

    // rime wakes underfoot
    if (floorTile) {
      for (let i = 0; i < this.p.rime.length; i++) {
        const rm = this.p.rime[i];
        if (rm.x === floorTile[0] && rm.y === floorTile[1] && this.rimeState[i].t < 0 && this.rimeState[i].gone <= 0) {
          this.rimeState[i].t = 0;
        }
      }
    }

    // sconces: touch to light (a checkpoint), stand in the glow to relight
    for (let i = 0; i < this.p.sconces.length; i++) {
      const s = this.p.sconces[i];
      const d = Math.hypot(this.px - (s.x + 0.5), this.py + s.y + 0.5);
      if (!this.sconceLit[i] && d < SCONCE_LIGHT_R) {
        this.sconceLit[i] = true;
        this.checkpoint = { x: s.x + 0.5, y: -(s.y + 0.5) - 0.2 };
        if (!this.def.deadLight) this.spark = true;
        this.audio.sconce();
        this.openDoors();
      } else if (this.sconceLit[i] && !this.def.deadLight && d < SCONCE_SPARK_R) {
        this.spark = true;
      }
    }

    // the master stone
    const m = this.p.master;
    if (Math.hypot(this.px - (m.x + 0.5), this.py + m.y + 0.5) < 1.5) {
      this.phase = 'complete';
      this.phaseT = 0;
      this.vx = 0; this.vy = 0;
      return;
    }

    // hazards
    if (this.invuln > 0) return;
    if (this.touchingKill()) { this.reform(); return; }
    for (const b of this.beamRays) {
      const bd = (this.def.beams ?? [])[this.beamRays.indexOf(b)];
      if (!bd) continue;
      const bx = bd.x, by = -bd.y;
      const dx = b.ex - bx, dy = b.ey - by;
      const len2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((this.px - bx) * dx + (this.py - by) * dy) / len2));
      if (Math.hypot(this.px - (bx + dx * t), this.py - (by + dy * t)) < BEAM_R) { this.reform(); return; }
    }
    for (let i = 0; i < (this.def.shuttles ?? []).length; i++) {
      const pos = this.shuttlePos(i);
      const horizontal = Math.abs((this.def.shuttles![i].x1 - this.def.shuttles![i].x0)) >= Math.abs((this.def.shuttles![i].y1 - this.def.shuttles![i].y0));
      const hw = horizontal ? 0.7 : 0.17, hh = horizontal ? 0.17 : 0.7;
      if (Math.abs(this.px - pos.x) < hw + HW && Math.abs(this.py - pos.y) < hh + HH) { this.reform(); return; }
    }
    for (let i = 0; i < (this.def.censers ?? []).length; i++) {
      const pos = this.censerPos(i);
      if (Math.hypot(this.px - pos.x, this.py - pos.y) < 0.55 + HW) { this.reform(); return; }
    }
    for (let i = 0; i < (this.def.crushers ?? []).length; i++) {
      const r = this.crusherRect(i);
      if (this.px + HW > r.x0 && this.px - HW < r.x1 && this.py + HH > r.y1 && this.py - HH < r.y0) { this.reform(); return; }
    }
    if (this.pursuitOn && this.def.pursuit) {
      const pu = this.def.pursuit;
      const [zx0, zy0, zx1, zy1] = pu.zone;
      const inZone = this.px > zx0 && this.px < zx1 + 1 && -this.py > zy0 && -this.py < zy1 + 1;
      if (inZone) {
        const consumed =
          pu.dir === 'down' ? -this.py < this.pursuitEdge :
          pu.dir === 'up' ? -this.py > this.pursuitEdge :
          pu.dir === 'right' ? this.px < this.pursuitEdge :
          this.px > this.pursuitEdge;
        if (consumed) { this.reform(); return; }
      }
    }
  }

  private moveX(dx: number): void {
    if (dx === 0) return;
    this.px += dx;
    const top = Math.floor(-(this.py + HH - EPS));
    const bot = Math.floor(-(this.py - HH + EPS));
    const dir = Math.sign(dx);
    const c = Math.floor(this.px + dir * HW);
    let hit = false;
    for (let r = top; r <= bot; r++) if (this.solidTile(c, r)) { hit = true; break; }
    if (!hit) return;
    // a horizontal spark clipping a ledge lip pops over it instead of
    // dying to it — up to DASH_POP of vertical forgiveness (F2)
    if (this.dashT > 0 && this.dashVY === 0 && this.tryDashPop(c, top, bot)) return;
    this.px = dir > 0 ? c - HW - EPS : c + 1 + HW + EPS;
    this.vx = 0;
    if (this.dashT > 0) this.dashVX = 0;
  }

  /** every tile the body would occupy at (x, y) is air */
  private boxClearAt(x: number, y: number): boolean {
    const l = Math.floor(x - HW + EPS), r = Math.floor(x + HW - EPS);
    const t = Math.floor(-(y + HH - EPS)), b = Math.floor(-(y - HH + EPS));
    for (let rr = t; rr <= b; rr++) for (let cc = l; cc <= r; cc++) if (this.solidTile(cc, rr)) return false;
    return true;
  }

  /** a wall within `reach` tiles of the body's `side` edge */
  private wallAt(side: number, reach: number): boolean {
    const top = Math.floor(-(this.py + HH - EPS));
    const bot = Math.floor(-(this.py - HH + EPS));
    const c = Math.floor(this.px + side * (HW + reach));
    for (let r = top; r <= bot; r++) if (this.solidTile(c, r)) return true;
    return false;
  }

  /** F2: the lip pop — clear a shallow ledge edge mid-spark, up or down */
  private tryDashPop(c: number, top: number, bot: number): boolean {
    const rows: number[] = [];
    for (let r = top; r <= bot; r++) if (this.solidTile(c, r)) rows.push(r);
    if (rows.length === 0) return false;
    if (rows.every(r => r === bot)) {
      const pen = -bot - (this.py - HH);
      if (pen > 0 && pen <= DASH_POP && this.boxClearAt(this.px, this.py + pen + EPS)) {
        this.py += pen + EPS;
        return true;
      }
    }
    if (rows.every(r => r === top)) {
      const pen = this.py + HH + top + 1;
      if (pen > 0 && pen <= DASH_POP && this.boxClearAt(this.px, this.py - pen - EPS)) {
        this.py -= pen + EPS;
        return true;
      }
    }
    return false;
  }

  /** F2: a downward spark ending within DASH_POP of a floor lands on it */
  private dashFloorSnap(): void {
    const left = Math.floor(this.px - HW + EPS);
    const right = Math.floor(this.px + HW - EPS);
    const r0 = Math.floor(-(this.py - HH));
    const r1 = Math.floor(-(this.py - HH - DASH_POP));
    for (let r = r0; r <= r1; r++) {
      for (let c = left; c <= right; c++) {
        if (this.solidTile(c, r)) {
          const gap = (this.py - HH) - (-r);
          if (gap >= 0 && gap <= DASH_POP) {
            this.py = -r + HH + EPS;
            this.vy = 0;
            this.grounded = true;
          }
          return;
        }
      }
    }
  }

  /**
   * F1: head-bonk corner correction. Rising into a solid corner nudges the
   * body up to CORNER tiles sideways when that alone saves the jump — a
   * one-tile body on a tile grid has zero geometric slack without it.
   */
  private tryCorner(row: number, left: number, right: number): boolean {
    const leftSolid = this.solidTile(left, row);
    const rightSolid = this.solidTile(right, row);
    if (leftSolid && !rightSolid) {
      const need = (left + 1) - (this.px - HW) + EPS;
      if (need <= CORNER && this.boxClearAt(this.px + need, this.py)) { this.px += need; return true; }
    } else if (rightSolid && !leftSolid) {
      const need = (this.px + HW) - right + EPS;
      if (need <= CORNER && this.boxClearAt(this.px - need, this.py)) { this.px -= need; return true; }
    }
    return false;
  }

  private moveY(dy: number, gSign: number): [number, number] | null {
    this.py += dy;
    const left = Math.floor(this.px - HW + EPS);
    const right = Math.floor(this.px + HW - EPS);
    let floorTile: [number, number] | null = null;
    if (dy < 0) {
      const r = Math.floor(-(this.py - HH));
      for (let c = left; c <= right; c++) {
        if (this.solidTile(c, r)) {
          // falling up (inverted gravity): a shallow corner clips, nudge past it (F1)
          if (gSign < 0 && this.tryCorner(r, left, right)) break;
          this.py = -r + HH + EPS;
          this.vy = 0;
          if (this.dashT > 0) this.dashVY = 0;
          if (gSign > 0) { this.grounded = true; floorTile = [c, r]; }
          break;
        }
      }
    } else if (dy > 0) {
      const r = Math.floor(-(this.py + HH));
      if (r >= 0) {
        for (let c = left; c <= right; c++) {
          if (this.solidTile(c, r)) {
            // the head-bonk: a rising jump grazing a corner slides past it (F1)
            if (gSign >= 0 && this.tryCorner(r, left, right)) break;
            this.py = -(r + 1) - HH - EPS;
            this.vy = 0;
            if (this.dashT > 0) this.dashVY = 0;
            if (gSign < 0) { this.grounded = true; floorTile = [c, r]; }
            break;
          }
        }
      }
    }
    return floorTile;
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
    if (this.def.pursuit) { this.pursuitOn = false; this.pursuitDone = false; }
    // the gutter stays where you failed — a dark wick of you, briefly —
    // and you are already back at the sconce. Control returns THIS frame;
    // the re-form animation plays around a body that is yours again, and
    // the camera cuts, never pans: retry time is difficulty in disguise
    // (SPEC-VAULTS-2 F10, precision research on SMB retry economics).
    const ghost = new THREE.Mesh(new THREE.CapsuleGeometry(SUIT_R * BODY, SUIT_H * BODY, 3, 6),
      new THREE.MeshBasicMaterial({ color: 0x1a1420, transparent: true, opacity: 0.5 }));
    ghost.position.set(this.px, this.py, 0.05);
    this.scene.add(ghost);
    this.trail.push({ mesh: ghost, t: 0.4 });
    this.px = this.checkpoint.x;
    this.py = this.checkpoint.y;
    this.vx = 0; this.vy = 0;
    this.spark = true;
    this.dashT = 0;
    this.freezeT = 0;
    this.dashCarryT = 0;
    this.grounded = false;
    this.coyoteT = COYOTE;      // an instant jump off the re-form always works (F8)
    this.invuln = INVULN_T;
    this.reformT = REFORM_T;    // visual only — the body grows in around control
    this.cam.snap(this.px, this.py + 0.5, 8.5 + this.cam.zoomBias);
  }

  private openDoors(): void {
    const lit = this.sconceLit.filter(Boolean).length;
    for (let d = 0; d < this.p.doors.length; d++) {
      const need = this.def.doorNeeds?.[this.p.doors[d].ch] ?? 1;
      if (!this.doorOpen[d] && lit >= need) {
        this.doorOpen[d] = true;
        this.audio.complete();
      }
    }
  }

  // ---------------- hazard positions ----------------

  private shuttlePos(i: number): { x: number; y: number } {
    const s = this.def.shuttles![i];
    const u = (this.time / (s.period / this.hazardMul()) + s.phase) % 1;
    const ping = u < 0.5 ? u * 2 : 2 - u * 2;
    return {
      x: s.x0 + 0.5 + (s.x1 - s.x0) * ping,
      y: -(s.y0 + 0.5) - (s.y1 - s.y0) * ping,
    };
  }

  private censerPos(i: number): { x: number; y: number } {
    const c = this.def.censers![i];
    const a = c.arc * Math.sin(Math.PI * 2 * (this.time / (c.period / this.hazardMul()) + c.phase));
    return { x: c.x + Math.sin(a) * c.len, y: -c.y - Math.cos(a) * c.len };
  }

  private crusherRect(i: number): { x0: number; y0: number; x1: number; y1: number } {
    const c = this.def.crushers![i];
    const u = (this.time / (c.period / this.hazardMul()) + c.phase) % 1;
    // extend fast, dwell, withdraw, rest
    const ext = u < 0.22 ? u / 0.22 : u < 0.45 ? 1 : u < 0.72 ? 1 - (u - 0.45) / 0.27 : 0;
    const ox = c.dx * ext, oy = c.dy * ext;
    return {
      x0: c.x + ox, y0: -(c.y + oy),
      x1: c.x + c.w + ox, y1: -(c.y + c.h + oy),
    };
  }

  // ---------------- frame ----------------

  frame(dt: number, input: Input, lampOn: boolean): void {
    // spark ignition: the world holds its breath — no time, no hazards, no
    // step — while the latch reads any late aim correction
    if (this.freezeT > 0) {
      this.freezeT -= dt;
      const dx = (input.left ? -1 : 0) + (input.right ? 1 : 0);
      const dy = (input.up ? 1 : 0) + (input.down ? -1 : 0);
      if (dx !== 0 || dy !== 0) { this.dashDX = dx; this.dashDY = dy; }
      if (this.freezeT <= 0) this.igniteDash();
      return;
    }
    this.time += dt;
    const hazardMul = this.hazardMul();

    // bridges
    const cycle = (BRIDGE_HALF * 2) / hazardMul;
    const half = cycle / 2;
    const tc = this.time % cycle;
    this.bridgeOn[0] = tc < half;
    this.bridgeOn[1] = !this.bridgeOn[0];
    const warn = (tc % half) > half - BRIDGE_WARN;

    // beams
    const bdefs = this.def.beams ?? [];
    for (let i = 0; i < bdefs.length; i++) {
      const b = bdefs[i];
      let ang: number;
      if (b.spin) {
        ang = Math.PI * 2 * ((this.time / (b.period / hazardMul) + b.phase) % 1);
      } else {
        const u = (this.time / (b.period / hazardMul) + b.phase) % 1;
        const ping = u < 0.5 ? u * 2 : 2 - u * 2;
        ang = (b.a0 ?? -2.35) + ((b.a1 ?? -0.79) - (b.a0 ?? -2.35)) * ping;
      }
      const ray = this.beamRays[i];
      let ex = b.x, ey = -b.y;
      for (let s = 0; s < 90; s++) {
        const nx = ex + Math.cos(ang) * 0.35;
        const ny = ey + Math.sin(ang) * 0.35;
        if (this.solidTile(Math.floor(nx), Math.floor(-ny))) break;
        ex = nx; ey = ny;
      }
      ray.ex = ex; ray.ey = ey;
      const len = Math.hypot(ex - b.x, ey + b.y);
      ray.mesh.position.set((b.x + ex) / 2, (-b.y + ey) / 2, 0.15);
      ray.mesh.scale.set(len, 1, 1);
      ray.mesh.rotation.z = Math.atan2(ey + b.y, ex - b.x);
    }

    // wind
    if (this.def.wind) {
      const w = this.def.wind;
      this.windT += dt;
      const period = w.calm + w.gust;
      this.gusting = (this.windT % period) > w.calm;
      const mat = (this.windStreaks!.material as THREE.PointsMaterial);
      mat.opacity += ((this.gusting ? 0.55 : 0) - mat.opacity) * Math.min(1, dt * 6);
      if (this.gusting) {
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

    // rime
    for (let i = 0; i < this.rimeState.length; i++) {
      const rs = this.rimeState[i];
      const mesh = this.rimeMeshes[i];
      if (rs.gone > 0) {
        rs.gone -= dt;
        mesh.visible = false;
        if (rs.gone <= 0) {
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

    // pursuit arming + advance
    if (this.def.pursuit && this.phase === 'run') {
      const pu = this.def.pursuit;
      if (!this.pursuitOn && !this.pursuitDone) {
        const [tx0, ty0, tx1, ty1] = pu.trigger;
        if (this.px > tx0 && this.px < tx1 + 1 && -this.py > ty0 && -this.py < ty1 + 1) {
          this.pursuitOn = true;
          this.pursuitEdge =
            pu.dir === 'down' ? pu.zone[1] :
            pu.dir === 'up' ? pu.zone[3] + 1 :
            pu.dir === 'right' ? pu.zone[0] : pu.zone[2] + 1;
          this.audio.deny();
        }
      } else if (this.pursuitOn) {
        const sp = pu.speed * hazardMul;
        this.pursuitEdge += (pu.dir === 'down' || pu.dir === 'right' ? sp : -sp) * dt;
        const past =
          pu.dir === 'down' ? this.pursuitEdge > pu.zone[3] + 1 :
          pu.dir === 'up' ? this.pursuitEdge < pu.zone[1] :
          pu.dir === 'right' ? this.pursuitEdge > pu.zone[2] + 1 :
          this.pursuitEdge < pu.zone[0];
        if (past) { this.pursuitOn = false; this.pursuitDone = true; }
      }
    }

    if (this.phase === 'complete') {
      this.phaseT += dt;
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
      this.invuln = Math.max(0, this.invuln - dt);
      this.step(dt, input);
    }

    // ---------------- visuals ----------------
    for (let i = 0; i < this.sconceMeshes.length; i++) {
      const sm = this.sconceMeshes[i];
      const lit = this.sconceLit[i];
      sm.light.intensity = lit ? 2.4 + Math.sin(this.time * 7 + i) * 0.4 : 0;
      sm.mat.color.setHex(lit ? 0xffd9a0 : 0x342e22);
      sm.flame.scale.setScalar(lit ? 1 + Math.sin(this.time * 9 + i) * 0.15 : 0.8);
    }
    for (let d = 0; d < this.doorMeshes.length; d++) {
      for (const m of this.doorMeshes[d]) {
        const mm = m.material as THREE.MeshStandardMaterial;
        mm.opacity += ((this.doorOpen[d] ? 0 : 1) - mm.opacity) * Math.min(1, dt * 3);
        m.visible = mm.opacity > 0.03;
      }
    }
    for (const bm of this.bridgeMeshes) {
      const on = this.bridgeOn[bm.group];
      const flick = warn && on ? (Math.sin(this.time * 55) > 0 ? 1 : 0.25) : 1;
      bm.mat.opacity = on ? 0.85 * flick : 0.06;
      bm.mesh.scale.y = on ? 1 : 0.4;
    }
    for (let i = 0; i < this.shuttleMeshes.length; i++) {
      const pos = this.shuttlePos(i);
      this.shuttleMeshes[i].bolt.position.set(pos.x, pos.y, 0.15);
      this.shuttleMeshes[i].mat.opacity = 0.75 + Math.sin(this.time * 24 + i) * 0.2;
    }
    for (let i = 0; i < this.censerMeshes.length; i++) {
      const c = this.def.censers![i];
      const pos = this.censerPos(i);
      const cm = this.censerMeshes[i];
      cm.bob.position.set(pos.x, pos.y, 0.2);
      cm.chain.position.set(c.x, -c.y, 0.2);
      cm.chain.rotation.z = Math.atan2(pos.x - c.x, -(pos.y + c.y));
      cm.light.intensity = 2 + Math.sin(this.time * 8 + i) * 0.4;
    }
    for (let i = 0; i < this.crusherMeshes.length; i++) {
      const r = this.crusherRect(i);
      this.crusherMeshes[i].position.set((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, 0);
    }
    if (this.def.pursuit && this.pursuitMesh && this.pursuitEdgeMesh) {
      const pu = this.def.pursuit;
      const [zx0, zy0, zx1, zy1] = pu.zone;
      const on = this.pursuitOn;
      this.pursuitMesh.visible = on;
      this.pursuitEdgeMesh.visible = on;
      if (on) {
        if (pu.dir === 'down') {
          const top = -zy0, edge = -this.pursuitEdge;
          this.pursuitMesh.scale.y = Math.max(0.001, (top - edge) / (zy1 - zy0 + 1));
          this.pursuitMesh.position.set((zx0 + zx1 + 1) / 2, (top + edge) / 2, 0.45);
          this.pursuitEdgeMesh.position.set((zx0 + zx1 + 1) / 2, edge, 0.46);
        } else if (pu.dir === 'right') {
          const left = zx0, edge = this.pursuitEdge;
          this.pursuitMesh.scale.x = Math.max(0.001, (edge - left) / (zx1 - zx0 + 1));
          this.pursuitMesh.position.set((left + edge) / 2, -(zy0 + zy1 + 1) / 2, 0.45);
          this.pursuitEdgeMesh.position.set(edge, -(zy0 + zy1 + 1) / 2, 0.46);
        }
      }
    }
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const t = this.trail[i];
      t.t -= dt;
      (t.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, t.t * 1.6);
      if (t.t <= 0) { this.scene.remove(t.mesh); this.trail.splice(i, 1); }
    }
    // re-form grow-in, cosmetic only — input already works
    if (this.reformT > 0) {
      this.reformT = Math.max(0, this.reformT - dt);
      this.pilotGroup.scale.setScalar(Math.max(0.15, 1 - this.reformT / REFORM_T));
    } else if (this.pilotGroup.scale.x !== 1) {
      this.pilotGroup.scale.setScalar(1);
    }
    // the body is the meter (F12): charged, the suit throws light on the
    // stone around it; spent, the room steps closer. Readable peripherally,
    // and in the dark rooms the meter IS the visibility.
    const lampTarget = lampOn ? (this.spark ? 6 : 3.2) : (this.spark ? 1.6 : 0.6);
    this.lamp.intensity += (lampTarget - this.lamp.intensity) * Math.min(1, dt * 12);
    const reachTarget = (this.spark ? 6 : 4) * BODY;
    this.lamp.distance += (reachTarget - this.lamp.distance) * Math.min(1, dt * 8);
    const dot = this.masterGroup.getObjectByName('glyph-light');
    if (dot) dot.scale.setScalar(1 + Math.sin(this.time * 2.4) * 0.2);
    for (const obj of this.scene.children) {
      if (obj.name === 'figure-ember') {
        (obj as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>).material.opacity = 0.25 + Math.sin(this.time * 0.9) * 0.12;
      }
    }

    // motes
    const pos = this.motes.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const [gx, gy] = this.gravityAt(x, y);
      const nx = x + (gx / GRAV) * 0.45 * dt;
      const ny = y + (gy / GRAV) * 0.45 * dt;
      const ti = Math.floor(-ny) * this.p.w + Math.floor(nx);
      if (nx < 0 || nx >= this.p.w || -ny >= this.p.h || -ny < 0 || this.p.solid[ti]) {
        this.seedMote(i);
      } else {
        pos.setXY(i, nx, ny);
      }
    }
    pos.needsUpdate = true;

    // pilot mesh + spark + camera + hud
    this.walkT += dt * Math.abs(this.vx) * 4;
    animateSuit(this.suit, this.walkT, this.grounded, Math.min(1, Math.abs(this.vx) / WALK));
    this.pilotGroup.rotation.y = this.facing > 0 ? 0.35 : -0.35;
    this.pilotGroup.position.set(this.px, this.py, 0.1);
    const sm = this.sparkMesh.material as THREE.MeshBasicMaterial;
    sm.color.setHex(this.spark ? 0xbfe8ff : 0x2a3038);
    this.sparkMesh.rotation.y += dt * 3;
    this.sparkMesh.scale.setScalar(this.spark ? 1 + Math.sin(this.time * 6) * 0.15 : 0.7);
    this.cam.follow(dt, this.px, this.py, this.vx, this.vy, true);
    const pip = this.hud.querySelector('.vh-spark') as HTMLDivElement | null;
    if (pip) pip.className = 'vh-spark' + (this.spark ? ' lit' : '');
  }

  // ---------------- lifecycle ----------------

  private showCard(): void {
    this.card = document.createElement('div');
    this.card.id = 'vault-card';
    this.card.innerHTML = `
      <div class="vc-glyph">${glyphSvg(this.glyph, 'vc-svg')}</div>
      <div class="vc-name">${this.glyph.name}</div>
      <div class="vc-text">${this.glyph.fragment}</div>
      <div class="vc-reforms">${this.reforms === 0 ? 'unguttered' : `guttered ×${this.reforms}`}</div>
      <div class="vc-hint">E — STEP BACK THROUGH THE STONE</div>`;
    this.hud.parentElement?.appendChild(this.card);
  }

  interact(): void {
    if (this.completed) { this.closed = true; return; }
    const e = this.p.entry;
    if (Math.hypot(this.px - (e.x + 0.5), this.py + e.y + 0.5) < 1.1) this.closed = true;
  }

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
