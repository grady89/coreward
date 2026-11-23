import * as THREE from 'three';
import { Suit, buildSuit, poseSuit, suitPoseYOffset } from '../player/suit';
import { Input } from '../player/controller';
import { Meta, Trophy } from './meta';
import { wallPalette, WING_GALLERY, WING_VIVARIUM } from './furnish';
import { FAUNA, FaunaEntry } from './bestiary';
import { GEM_GEOS, DISPLAY_CUT, gemScaleOf } from '../world/gemshapes';
import { def as tileDef } from '../world/tiles';
import { depthLine, rarityRank } from './minerals';
import { glyphs } from '../input/prompts';

// THE QUARTERS, inside — the one room on VEIL-3 that is yours. A side-view
// hab the suit walks: stations open panels (the Ledger, the wardrobe, the
// catalog, the console, the fauna desk), furnishings appear at their fixed
// homes as they're bought, and the two wings — gallery and vivarium — stay
// sealed until the catalog sells the key. Follows the VaultRun mode contract:
// own scene, own camera, own DOM chrome; main keeps the renderer and input.
//
// There is no clock in here. No fuel, no O₂, no threats. That is the point.

export type InteriorPanel = 'ledger' | 'wardrobe' | 'catalog' | 'faunalog' | 'transcript';

export interface InteriorCtx {
  meta: Meta;
  /** undelivered transmissions, for the console's amber dot */
  unread(): number;
  openPanel(kind: InteriorPanel): void;
  /** a gallery placard was read — the stone's page, by tile type */
  openMineral(t: number): void;
}

// room proportions: the suit is ~0.5 tall, the ceiling clears three of him
const HW = 0.15;
const HH = 0.26;
const WALK = 3.2;
const JUMP = 6.2;
const GRAV = 22;
const CEIL = 2.2;

const HALL_X0 = 1;
const HALL_X1 = 23;
const GALLERY_X1 = 35;
const VIVARIUM_X1 = 47;

// the shell in section: the wall face things hang on, the cove up to the
// ceiling, and how far ceiling and floor run out toward the camera (far
// enough to fill the frame, so neither edge is a black band)
const WALL_Z = -2.015;
const COVE_Y = 2.3;
const CEIL_Y = 2.62;
const CEIL_Z0 = -1.6;
const CEIL_Z1 = 4.2;
const FLOOR_Z1 = 4.6;
const COVE = Math.atan2(CEIL_Z0 - WALL_Z, CEIL_Y - COVE_Y);
const FIX_Z = 0.1;
/** pillars stand at GRID + k·BAY; panel seams fall every PANEL from GRID */
const GRID = HALL_X0;
const BAY = 3.5;
const PANEL = 1.75;

interface Station {
  x: number; r: number; label: string; panel: InteriorPanel | null;
  /** a gallery placard, by tile type — read instead of opening a station panel */
  mineral?: number;
}

// shared fixed-color materials (palette materials are per-instance fields)
const GUNMETAL = new THREE.MeshStandardMaterial({ color: 0x4b545e, roughness: 0.45, metalness: 0.35 });
const DARKPIPE = new THREE.MeshStandardMaterial({ color: 0x363d45, roughness: 0.5, metalness: 0.3 });
const CREAM = new THREE.MeshStandardMaterial({ color: 0xe6dcc4, roughness: 0.55 });
const ORANGE = new THREE.MeshStandardMaterial({ color: 0xc4571f, roughness: 0.5 });
const TEAL_PAINT = new THREE.MeshStandardMaterial({ color: 0x2e6e64, roughness: 0.6 });
const PLINTH = new THREE.MeshStandardMaterial({ color: 0x272b31, roughness: 0.8, metalness: 0.3 });
const FERN = new THREE.MeshStandardMaterial({ color: 0x6e9668, roughness: 0.8 });
const WARM_GLOW = new THREE.MeshBasicMaterial({ color: 0xffc06a, toneMapped: false });
const TEAL_GLOW = new THREE.MeshBasicMaterial({ color: 0x3ce6c8, toneMapped: false });
const AMBER_GLOW = new THREE.MeshBasicMaterial({ color: 0xff9a3c, toneMapped: false });
const RED_GLOW = new THREE.MeshBasicMaterial({ color: 0xff4d29, toneMapped: false });
/** what the palette's wall colour is pulled toward for the ceiling and the ribs */
const CEIL_SHADOW = new THREE.Color(0x2e2620);
const FRAME_METAL = new THREE.Color(0x23272d);

function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

function cyl(r: number, h: number, mat: THREE.Material, x: number, y: number, z: number, seg = 16): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat);
  m.position.set(x, y, z);
  return m;
}

function glowDot(mat: THREE.MeshBasicMaterial, x: number, y: number, z: number, s = 0.05): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(s, 8, 8), mat);
  m.position.set(x, y, z);
  return m;
}

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d')!);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------------- the shell's building blocks ----------------

/** a stable 0..1 per panel, so the value steps don't shuffle on every rebuild */
function hash01(a: number, b = 0): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const UNIT_ROD = new THREE.CylinderGeometry(1, 1, 1, 8).rotateZ(Math.PI / 2);   // runs along x
const UNIT_QUAD = new THREE.PlaneGeometry(1, 1);

type Shade = number | ((p: THREE.Vector3) => number);

/**
 * Many parts baked into one vertex-shaded mesh: a whole wall of panels, seams,
 * bolts and ribs is one draw call. The shade is a grey multiplier on the
 * material colour, so the palette still owns the hue and every secondary tone
 * (seam, step, kick plate) is derived from it.
 */
class Kit {
  private pos: number[] = [];
  private nor: number[] = [];
  private uv: number[] = [];
  private col: number[] = [];
  private idx: number[] = [];
  private m = new THREE.Matrix4();
  private nm = new THREE.Matrix3();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3();

  add(src: THREE.BufferGeometry, sx: number, sy: number, sz: number,
      x: number, y: number, z: number, shade: Shade, rotX = 0): void {
    this.m.compose(this.v.set(x, y, z), this.q.setFromEuler(this.e.set(rotX, 0, 0)), this.s.set(sx, sy, sz));
    this.nm.getNormalMatrix(this.m);
    const p = src.getAttribute('position'), n = src.getAttribute('normal');
    const t = src.getAttribute('uv'), ix = src.getIndex()!;
    const base = this.pos.length / 3;
    for (let i = 0; i < p.count; i++) {
      this.v.fromBufferAttribute(p, i).applyMatrix4(this.m);
      this.pos.push(this.v.x, this.v.y, this.v.z);
      const k = typeof shade === 'number' ? shade : shade(this.v);
      this.col.push(k, k, k);
      this.v.fromBufferAttribute(n, i).applyMatrix3(this.nm).normalize();
      this.nor.push(this.v.x, this.v.y, this.v.z);
      this.uv.push(t.getX(i), t.getY(i));
    }
    for (let i = 0; i < ix.count; i++) this.idx.push(base + ix.getX(i));
  }

  box(w: number, h: number, d: number, x: number, y: number, z: number, shade: Shade, rotX = 0): void {
    this.add(UNIT_BOX, w, h, d, x, y, z, shade, rotX);
  }

  /** a pipe along x */
  rod(len: number, r: number, x: number, y: number, z: number, shade: Shade): void {
    this.add(UNIT_ROD, len, r, r, x, y, z, shade);
  }

  /** a flat quad facing the camera (wall), the ceiling (up), the floor (down), or tipped back by an angle */
  quad(w: number, h: number, x: number, y: number, z: number, face: 'wall' | 'up' | 'down' | number): void {
    const rx = typeof face === 'number' ? face : face === 'up' ? -Math.PI / 2 : face === 'down' ? Math.PI / 2 : 0;
    this.add(UNIT_QUAD, w, h, 1, x, y, z, 1, rx);
  }

  mesh(mat: THREE.Material): THREE.Mesh {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    geo.setIndex(this.idx);
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, mat);
    if (mat.transparent) m.renderOrder = 1;
    return m;
  }
}

/** grid cells of size `step` (seams at origin + k·step), clipped to [x0, x1] */
function cells(x0: number, x1: number, step: number, origin: number): [number, number][] {
  const out: [number, number][] = [];
  for (let a = origin + Math.floor((x0 - origin) / step) * step; a < x1; a += step) {
    const lo = Math.max(a, x0), hi = Math.min(a + step, x1);
    if (hi - lo > 0.05) out.push([lo, hi]);
  }
  return out;
}

/**
 * Light that lands without being a light: soft additive gradients laid on the
 * wall, floor and ceiling. Cheap, so the hall can have a pool under every
 * fixture and a dusk patch under every porthole on three real lights.
 */
let poolTex: THREE.CanvasTexture | null = null;
let washTex: THREE.CanvasTexture | null = null;
const glowMats = new Map<string, THREE.MeshBasicMaterial>();

function glowMat(kind: 'pool' | 'wash', color: number, opacity: number): THREE.MeshBasicMaterial {
  const key = `${kind}|${color}|${opacity}`;
  const had = glowMats.get(key);
  if (had) return had;
  if (!poolTex) {
    poolTex = canvasTex(128, 128, gg => {
      const r = gg.createRadialGradient(64, 64, 0, 64, 64, 64);
      r.addColorStop(0, 'rgba(255,255,255,1)');
      r.addColorStop(0.3, 'rgba(255,255,255,0.6)');
      r.addColorStop(0.65, 'rgba(255,255,255,0.16)');
      r.addColorStop(1, 'rgba(255,255,255,0)');
      gg.fillStyle = r; gg.fillRect(0, 0, 128, 128);
    });
  }
  if (!washTex) {
    // a fixture's light on the wall below it: hot at the top, fanning and
    // fading down — an inverted cone with soft edges
    washTex = canvasTex(128, 128, gg => {
      const img = gg.createImageData(128, 128);
      for (let j = 0; j < 128; j++) {
        const t = j / 127;                               // 0 at the top
        const spread = 0.3 + t * 0.6;
        const fall = Math.pow(1 - t, 1.5) * (0.4 + 0.6 * Math.exp(-t * 3));
        for (let i = 0; i < 128; i++) {
          const u = Math.abs(i / 127 - 0.5) * 2 / spread;
          const a = Math.max(0, 1 - u * u) * fall;
          const k = (j * 128 + i) * 4;
          img.data[k] = img.data[k + 1] = img.data[k + 2] = 255;
          img.data[k + 3] = Math.round(Math.min(1, a) * 255);
        }
      }
      gg.putImageData(img, 0, 0);
    });
  }
  const mat = new THREE.MeshBasicMaterial({
    map: kind === 'pool' ? poolTex : washTex, color, opacity, transparent: true,
    depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  });
  glowMats.set(key, mat);
  return mat;
}

/**
 * One arching fern frond, drawn as pinnae down both sides of a curved spine.
 * Built once and shared — the fan reuses the single texture at nine angles.
 */
let frondMat: THREE.MeshStandardMaterial | null = null;
function frondMaterial(): THREE.MeshStandardMaterial {
  if (frondMat) return frondMat;
  const tex = canvasTex(160, 320, gg => {
    gg.clearRect(0, 0, 160, 320);
    // leaflets as solid shapes, not hairlines — at the size this plane ends up
    // on screen a 3px stroke disappears and the fern reads as wire
    for (let i = 0; i <= 21; i++) {
      const t = i / 21;
      const px = 80 + Math.sin(t * 1.45) * 12;
      const py = 308 - t * 288;
      const span = Math.sin(Math.min(1, t * 1.08) * Math.PI) * 62 * (1 - t * 0.2) + 8;
      const wide = 3.6 + Math.sin(Math.min(1, t * 1.08) * Math.PI) * 4.4;
      for (const sd of [-1, 1]) {
        gg.fillStyle = (i + (sd > 0 ? 1 : 0)) % 2 ? '#6ab058' : '#4d8a42';
        gg.beginPath();
        gg.ellipse(px + sd * span * 0.52, py + 6 + t * 12, span * 0.56, wide,
          sd * (0.34 + t * 0.36), 0, Math.PI * 2);
        gg.fill();
      }
    }
    gg.lineCap = 'round';
    gg.strokeStyle = '#3a6a34'; gg.lineWidth = 4;
    gg.beginPath();
    for (let i = 0; i <= 26; i++) {
      const t = i / 26;
      gg.lineTo(80 + Math.sin(t * 1.45) * 12, 312 - t * 294);
    }
    gg.stroke();
  });
  frondMat = new THREE.MeshStandardMaterial({
    map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide,
    roughness: 0.85, emissive: 0x16321c, emissiveIntensity: 0.6,
  });
  return frondMat;
}

/** a potted fern: fronds fanning out of a crown, the way a fern actually grows */
function fernPlant(x: number, y: number, z: number, s = 1): THREE.Group {
  const g = new THREE.Group();
  const mat = frondMaterial();
  const N = 11;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const lean = (t - 0.5) * 1.9;
    const h = (0.44 + Math.cos((t - 0.5) * 2.7) * 0.16) * s;
    const geom = new THREE.PlaneGeometry(h * 0.72, h);
    geom.translate(0, h / 2 + 0.03 * s, 0);   // pivot below the frond's base,
                                              // so no quad corner dips into the pot
    const f = new THREE.Mesh(geom, mat);
    f.position.set(x, y, z + ((i % 3) - 1) * 0.05 * s);
    f.rotation.z = -lean;
    f.rotation.y = ((i % 3) - 1) * 0.36;
    g.add(f);
  }
  // the crown the fronds come out of, so the fan has a root
  for (const [cx, ch] of [[-0.05, 0.1], [0.02, 0.13], [0.07, 0.09]] as const) {
    const stub = new THREE.Mesh(new THREE.ConeGeometry(0.045 * s, ch * s, 6), FERN);
    stub.position.set(x + cx * s, y + (ch * s) / 2, z);
    g.add(stub);
  }
  return g;
}

/** dusk through glass: the amber sky, from inside */
function duskWindow(w: number, x: number, y: number): THREE.Group {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(w * 0.52, 0.045, 8, 24), GUNMETAL);
  ring.position.set(x, y, -1.96);
  g.add(ring);
  const tex = canvasTex(128, 128, gg => {
    const grad = gg.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, '#ffd89a');
    grad.addColorStop(0.6, '#ffb85e');
    grad.addColorStop(1, '#c96f33');
    gg.fillStyle = grad;
    gg.beginPath(); gg.arc(64, 64, 62, 0, Math.PI * 2); gg.fill();
    // the silhouetted horizon line every window on VEIL-3 shares
    gg.fillStyle = 'rgba(60,32,20,0.75)';
    gg.fillRect(0, 92, 128, 36);
  });
  const glass = new THREE.Mesh(
    new THREE.CircleGeometry(w * 0.5, 24),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
  );
  glass.position.set(x, y, -1.965);
  g.add(glass);
  return g;
}

/** brushed brass, engraved: the museum label under a cut stone */
const PLACARD_PLATE = new THREE.MeshStandardMaterial({ color: 0x6b5a3a, roughness: 0.42, metalness: 0.6 });

function placardTexture(name: string, sub: string): THREE.CanvasTexture {
  return canvasTex(512, 180, gg => {
    gg.fillStyle = '#d9cfb2';
    gg.fillRect(0, 0, 512, 180);
    // a bevel, so the plate reads as metal and not as a sticker
    gg.strokeStyle = 'rgba(58, 46, 30, 0.32)';
    gg.lineWidth = 7;
    gg.strokeRect(11, 11, 490, 158);
    gg.textAlign = 'center';
    gg.textBaseline = 'alphabetic';
    // the name owns the plate: shrink to fit rather than ever clipping
    const label = name.toUpperCase();
    gg.letterSpacing = '7px';
    let size = 66;
    gg.font = `700 ${size}px "Chakra Petch", system-ui, sans-serif`;
    while (gg.measureText(label).width > 440 && size > 26) {
      size -= 2;
      gg.font = `700 ${size}px "Chakra Petch", system-ui, sans-serif`;
    }
    gg.fillStyle = '#2a2216';
    gg.fillText(label, 256, 92);
    gg.letterSpacing = '2px';
    gg.strokeStyle = 'rgba(58, 46, 30, 0.28)';
    gg.lineWidth = 3;
    gg.beginPath(); gg.moveTo(150, 110); gg.lineTo(362, 110); gg.stroke();
    // the small print still has to survive being 60 pixels wide on screen
    gg.fillStyle = 'rgba(42, 34, 22, 0.82)';
    gg.font = '700 40px "Chakra Petch", system-ui, sans-serif';
    gg.fillText(sub, 256, 152);
  });
}

/**
 * The angled label on the front of a plinth. Returned as its own mesh so the
 * gallery can raycast it: reading a stone is a click as well as a keypress.
 */
function placard(name: string, sub: string, x: number, y: number, z: number): THREE.Mesh {
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(0.64, 0.225),
    new THREE.MeshBasicMaterial({ map: placardTexture(name, sub), toneMapped: false })
  );
  plate.position.set(x, y, z);
  plate.rotation.x = -0.38;   // the angle every museum label in the world sits at
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.265, 0.02), PLACARD_PLATE);
  back.position.set(0, 0, -0.012);
  plate.add(back);
  return plate;
}

/** which display archetype a sponsored species takes in its tank */
const LIGHTFORM: Record<string, 'swarm' | 'serpent' | 'walker' | 'motes'> = {
  glimmerflies: 'swarm', rimewings: 'swarm', polyps: 'motes', frostbloom: 'motes',
  longone: 'serpent', brinewyrm: 'serpent', shellbacks: 'serpent',
  stillwalker: 'walker', mimic: 'walker', warden: 'walker',
  riptide: 'motes', kindled: 'walker',
};

interface FormAnim {
  kind: 'swarm' | 'serpent' | 'walker' | 'motes';
  group: THREE.Group;
  parts: THREE.Object3D[];
  seed: number;
}

export class Interior {
  closed = false;

  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private cx: number;
  private time = 0;
  private px: number;
  private py = HH;
  private vx = 0;
  private vy = 0;
  private grounded = true;
  private facing = 1;
  private walkT = 0;
  private suit: Suit;
  private suitLamp: THREE.PointLight;
  private roomGroup = new THREE.Group();
  private forms: FormAnim[] = [];
  private gems: THREE.Mesh[] = [];
  /** the gallery labels, kept apart from the room so a pointer can hit them */
  private placards: THREE.Mesh[] = [];
  private consoleDot: THREE.Mesh | null = null;
  private stations: Station[] = [];
  private hud: HTMLDivElement;
  private lastPrompt = '';
  private paused = false;
  private hovering = false;
  private ray = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  // palette materials, retinted in place when the walls are repainted
  private wallMat = new THREE.MeshStandardMaterial({ roughness: 0.75 });
  private trimMat = new THREE.MeshStandardMaterial({ roughness: 0.55 });
  private floorMat = new THREE.MeshStandardMaterial({ roughness: 0.65, metalness: 0.1 });
  // vertex-shaded twins for the merged shell, retinted from the same palette:
  // the shade attribute steps the value, the palette keeps the hue
  private shellWall = new THREE.MeshStandardMaterial({ roughness: 0.8, vertexColors: true });
  private shellCeil = new THREE.MeshStandardMaterial({ roughness: 0.85, vertexColors: true });
  private shellFloor = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.15, vertexColors: true });
  private shellFrame = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.35, vertexColors: true });
  private shellLens = new THREE.MeshBasicMaterial({ color: 0xffc77a, toneMapped: false });

  constructor(private ctx: InteriorCtx, aspect: number, ui: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 60);
    this.px = HALL_X0 + 1.6;
    this.cx = this.px;
    this.camera.position.set(this.cx, 1.05, 6.4);
    this.camera.lookAt(this.cx, 0.95, 0);

    this.scene.background = new THREE.Color(0x0e0b09);
    this.scene.add(new THREE.HemisphereLight(0xffd9b0, 0x4a3b30, 0.85));

    this.applyPalette();
    this.suit = buildSuit();
    this.suitLamp = new THREE.PointLight(0xffe6c0, 2.4, 4, 1.6);
    this.suitLamp.position.set(0, 0.1, 0.4);
    this.suit.group.add(this.suitLamp);
    this.scene.add(this.suit.group);
    this.scene.add(this.roomGroup);
    this.rebuild();

    this.hud = document.createElement('div');
    this.hud.id = 'interior-hud';
    this.hud.innerHTML = `
      <div class="ih-name">THE QUARTERS</div>
      <div class="ih-prompt"></div>`;
    ui.appendChild(this.hud);

    addEventListener('pointerdown', this.onPointerDown);
    addEventListener('pointermove', this.onPointerMove);
  }

  // ---------------- reading a placard with a mouse ----------------

  /**
   * The placards are the one thing in the room a pointer can touch. Anything
   * over the UI is somebody else's click — panels lay a scrim over the whole
   * screen, so only hits that land on the canvas itself get this far.
   */
  private placardUnder(e: PointerEvent): THREE.Mesh | null {
    if (this.paused || this.placards.length === 0) return null;
    if ((e.target as HTMLElement | null)?.tagName !== 'CANVAS') return null;
    this.ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    return (this.ray.intersectObjects(this.placards, false)[0]?.object as THREE.Mesh) ?? null;
  }

  private onPointerDown = (e: PointerEvent): void => {
    const hit = this.placardUnder(e);
    if (hit) this.ctx.openMineral(hit.userData.mineral as number);
  };

  private onPointerMove = (e: PointerEvent): void => {
    const over = this.placardUnder(e) !== null;
    if (over === this.hovering) return;
    this.hovering = over;
    document.body.style.cursor = over ? 'pointer' : '';
  };

  /** east edge of the walkable room, given which wings are owned */
  private maxX(): number {
    const own = this.ctx.meta.furnishings;
    if (own.includes(WING_VIVARIUM) && own.includes(WING_GALLERY)) return VIVARIUM_X1;
    if (own.includes(WING_GALLERY)) return GALLERY_X1;
    return HALL_X1;
  }

  applyPalette(): void {
    const p = wallPalette(this.ctx.meta.palette);
    this.wallMat.color.setHex(p.wall);
    this.trimMat.color.setHex(p.trim);
    this.floorMat.color.setHex(p.floor);
    this.shellWall.color.setHex(p.wall);
    this.shellCeil.color.setHex(p.wall).lerp(CEIL_SHADOW, 0.3);
    this.shellFloor.color.setHex(p.floor);
    this.shellFrame.color.setHex(p.wall).lerp(FRAME_METAL, 0.72);
  }

  // ---------------- the room ----------------

  /** tear down and re-dress the whole room from meta — cheap at this scale */
  rebuild(): void {
    this.roomGroup.traverse(o => (o as THREE.Mesh).geometry?.dispose?.());
    this.roomGroup.clear();
    this.forms = [];
    this.gems = [];
    this.placards = [];
    this.consoleDot = null;
    this.stations = [];
    this.applyPalette();

    const own = this.ctx.meta.furnishings;
    const galleryOpen = own.includes(WING_GALLERY);
    const vivariumOpen = own.includes(WING_VIVARIUM);
    const endX = this.maxX();
    const g = this.roomGroup;
    const W = VIVARIUM_X1 + 1;

    // shell: wall, ceiling and floor plating, one section per room so a wing
    // can be dressed on its own; the last owned section runs on under the
    // east cap, and sealed hatches close off whatever isn't owned yet
    this.buildShell(g, 0, galleryOpen ? HALL_X1 : HALL_X1 + 0.8, [6.25, 13.25, 20.25]);
    if (galleryOpen) {
      this.buildShell(g, HALL_X1, vivariumOpen ? GALLERY_X1 : GALLERY_X1 + 0.8, [27.25, 30.75]);
    }
    if (galleryOpen && vivariumOpen) this.buildShell(g, GALLERY_X1, W, [37.75, 44.75]);
    // west wall + the way out
    g.add(box(0.25, 3.2, 3.4, this.wallMat, HALL_X0 - 0.55, 1.5, -0.4));
    const doorTex = canvasTex(64, 128, gg => {
      const grad = gg.createLinearGradient(0, 0, 0, 128);
      grad.addColorStop(0, '#ffd89a'); grad.addColorStop(1, '#e8933f');
      gg.fillStyle = '#1d2126'; gg.fillRect(0, 0, 64, 128);
      gg.fillStyle = grad; gg.fillRect(6, 6, 52, 116);
    });
    const door = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 1.28),
      new THREE.MeshBasicMaterial({ map: doorTex, toneMapped: false }));
    door.position.set(HALL_X0 - 0.4, 0.66, -0.4);
    door.rotation.y = Math.PI / 2;
    g.add(door);
    // east cap at the current end of the world
    g.add(box(0.25, 3.2, 3.4, this.wallMat, endX + 0.55, 1.5, -0.4));

    // hall windows: dusk, always dusk
    for (const wx of [5, 11, 17]) g.add(duskWindow(0.85, wx, 1.55));
    this.duskSpill(g, [5, 11, 17], 0.85, 1.55);

    this.buildStations(g);
    this.buildFurnishings(g, own);
    this.buildWingDoor(g, HALL_X1, galleryOpen, 'THE GALLERY');
    if (galleryOpen) this.buildGallery(g);
    this.buildWingDoor(g, GALLERY_X1, vivariumOpen, 'THE VIVARIUM', !galleryOpen);
    if (galleryOpen && vivariumOpen) this.buildVivarium(g);

    // exit + sealed-door prompts join the station list
    this.stations.push({ x: HALL_X0 + 0.2, r: 1.0, label: 'STEP OUT', panel: null });
  }

  /**
   * The hab's skin from x0 to x1. Back to front: kick plate, wainscot, chair
   * rail, two courses of insulated panels, a service run, the cove, a panelled
   * ceiling carried out over the camera, and floor plating run out toward it.
   * Pillars climb the cove and cross the ceiling as ribs. Every bay gets a
   * fixture whose light lands as gradients on the ceiling, upper wall and
   * floor; the bays named in `lit` also carry a real light.
   */
  private buildShell(g: THREE.Group, x0: number, x1: number, lit: number[]): void {
    const wall = new Kit(), ceil = new Kit(), floor = new Kit(), frame = new Kit(), lens = new Kit();
    const halo = new Kit(), wash = new Kit(), pool = new Kit();
    const W = x1 - x0, CX = (x0 + x1) / 2;
    // value falls away toward the camera, so the frame's edges stay dark
    const ceilFade = (z: number) => z < 0.6 ? 1 : Math.max(0.25, 1 - (z - 0.6) * 0.22);
    const floorFade = (z: number) => z < 0.4 ? 1 : Math.max(0.1, 1 - (z - 0.4) * 0.34);

    // ---- back wall
    wall.box(W, 2.45, 0.15, CX, 1.125, WALL_Z - 0.075, 0.4);           // backing, seen in the seams
    frame.box(W, 0.14, 0.06, CX, 0.07, WALL_Z + 0.03, 0.8);            // kick plate
    for (const [a, b] of cells(x0, x1, PANEL / 2, GRID)) {               // wainscot
      wall.box(b - a - 0.03, 0.46, 0.05, (a + b) / 2, 0.38, WALL_Z + 0.025, 0.58 + hash01(a, 1) * 0.07);
    }
    g.add(box(W, 0.07, 0.07, this.trimMat, CX, 0.655, WALL_Z + 0.035)); // chair rail
    for (const [y0, y1] of [[0.69, 1.42], [1.42, 2.13]] as const) {
      for (const [a, b] of cells(x0, x1, PANEL, GRID)) {
        const s = 0.9 + hash01(a, y0) * 0.15;
        wall.box(b - a - 0.035, y1 - y0 - 0.035, 0.03, (a + b) / 2, (y0 + y1) / 2, WALL_Z + 0.015,
          p => s * (0.84 + (p.y - 0.69) * 0.11));
        if (b - a < 0.4) continue;
        for (const bx of [a + 0.09, b - 0.09]) for (const by of [y0 + 0.08, y1 - 0.08]) {
          frame.box(0.035, 0.035, 0.02, bx, by, WALL_Z + 0.035, 1.15);
        }
      }
    }
    // the service run under the cove
    frame.rod(W, 0.042, CX, 2.235, WALL_Z + 0.065, 0.95);
    frame.rod(W, 0.024, CX, 2.16, WALL_Z + 0.04, 1.25);
    for (const [a] of cells(x0, x1, PANEL / 2, GRID)) frame.box(0.05, 0.14, 0.1, a, 2.205, WALL_Z + 0.055, 0.6);
    // vents low in the wainscot, where nothing stands in front of them
    for (const vx of [3.05, 10.6, 14.6]) {
      if (vx < x0 || vx > x1) continue;
      frame.box(0.44, 0.22, 0.02, vx, 0.37, WALL_Z + 0.055, 0.35);
      for (let k = 0; k < 4; k++) frame.box(0.4, 0.025, 0.03, vx, 0.29 + k * 0.053, WALL_Z + 0.065, 1.1);
    }

    // ---- the cove, where the wall turns into the ceiling
    const cy = (COVE_Y + CEIL_Y) / 2, cz = (WALL_Z + CEIL_Z0) / 2;
    const cl = Math.hypot(CEIL_Y - COVE_Y, CEIL_Z0 - WALL_Z);
    const nY = -Math.sin(COVE), nZ = Math.cos(COVE);                   // its face: down and out
    ceil.box(W, cl + 0.06, 0.03, CX, cy - nY * 0.03, cz - nZ * 0.03, 0.35, COVE);
    for (const [a, b] of cells(x0, x1, PANEL, GRID)) {
      ceil.box(b - a - 0.035, cl - 0.04, 0.03, (a + b) / 2, cy, cz, 0.8 + hash01(a, 7) * 0.12, COVE);
    }

    // ---- the ceiling: insulated panels hung between the ribs
    const cd = CEIL_Z1 - CEIL_Z0, cmz = (CEIL_Z0 + CEIL_Z1) / 2;
    ceil.box(W, 0.1, cd, CX, CEIL_Y + 0.05, cmz, p => 0.3 * ceilFade(p.z));
    for (const [za, zb] of cells(CEIL_Z0, CEIL_Z1, 0.97, CEIL_Z0)) {
      for (const [a, b] of cells(x0, x1, PANEL, GRID)) {
        const s = 0.72 + hash01(a, za) * 0.14;
        ceil.box(b - a - 0.04, 0.035, zb - za - 0.04, (a + b) / 2, CEIL_Y - 0.0175, (za + zb) / 2,
          p => s * ceilFade(p.z));
      }
    }
    frame.rod(W, 0.04, CX, 2.53, -0.85, 0.85);
    frame.rod(W, 0.022, CX, 2.55, -0.7, 1.1);
    for (const [a] of cells(x0, x1, PANEL, GRID)) frame.box(0.04, 0.09, 0.26, a, 2.565, -0.78, 0.6);

    // ---- pillars, up the cove and across as ribs: the hab's skeleton
    for (let px = GRID + BAY; px < x1; px += BAY) {
      if (px < x0) continue;
      frame.box(0.17, COVE_Y, 0.1, px, COVE_Y / 2, WALL_Z + 0.06, 0.9);
      frame.box(0.17, cl + 0.05, 0.09, px, cy + nY * 0.04, cz + nZ * 0.04, 0.9, COVE);
      frame.box(0.17, 0.15, cd, px, CEIL_Y - 0.075, cmz, p => 0.9 * ceilFade(p.z));
    }

    // ---- fixtures, one per bay
    for (let bx = GRID + BAY / 2; bx < x1; bx += BAY) {
      if (bx < x0 + 0.3) continue;
      frame.box(0.62, 0.05, 0.32, bx, CEIL_Y - 0.06, FIX_Z, 0.75);
      lens.box(0.52, 0.02, 0.22, bx, CEIL_Y - 0.095, FIX_Z, 1);
      halo.quad(3.0, 2.6, bx, CEIL_Y - 0.04, FIX_Z, 'down');
      wash.quad(2.7, 1.95, bx, COVE_Y - 1.95 / 2, WALL_Z + 0.04, 'wall');
      halo.quad(2.4, cl, bx, cy + nY * 0.02, cz + nZ * 0.02, COVE);
      pool.quad(3.2, 2.6, bx, 0.004, -0.55, 'up');
    }
    for (const lx of lit) {
      const warm = new THREE.PointLight(0xffd2a0, 3.2, 7, 1.7);
      warm.position.set(lx, 2.2, FIX_Z + 0.2);
      g.add(warm);
    }

    // ---- floor: a dark gutter at the wall, then staggered plates out toward the camera
    floor.box(W, 0.2, FLOOR_Z1 - WALL_Z, CX, -0.12, (FLOOR_Z1 + WALL_Z) / 2, p => 0.32 * floorFade(p.z));
    frame.box(W, 0.02, 0.17, CX, -0.02, WALL_Z + 0.085, 0.4);
    for (const [a] of cells(x0, x1, 0.3, GRID)) frame.box(0.03, 0.012, 0.15, a, -0.006, WALL_Z + 0.085, 0.9);
    cells(-1.85, FLOOR_Z1, 0.92, -1.85).forEach(([za, zb], r) => {
      for (const [a, b] of cells(x0, x1, PANEL, GRID + (r % 2) * PANEL / 2)) {
        const s = 0.74 + hash01(a, za) * 0.14;
        floor.box(b - a - 0.03, 0.02, zb - za - 0.03, (a + b) / 2, -0.01, (za + zb) / 2,
          p => s * floorFade(p.z) * (0.62 + 0.38 * Math.min(1, (p.z + 1.85) / 0.9)));
      }
    });

    // ---- the west wall, dressed round the way out
    if (x0 < HALL_X0) {
      const WX = HALL_X0 - 0.425;                         // its face
      const DZ = -0.4, DW = 0.36;                         // the door and its frame
      const low: [number, number][] = [[WALL_Z, DZ - DW], [DZ + DW, 1.3]];
      for (const [za, zb] of low) {
        frame.box(0.06, 0.14, zb - za, WX + 0.03, 0.07, (za + zb) / 2, 0.8);
        wall.box(0.05, 0.46, zb - za - 0.03, WX + 0.025, 0.38, (za + zb) / 2, 0.6);
        g.add(box(0.07, 0.07, zb - za, this.trimMat, WX + 0.035, 0.655, (za + zb) / 2));
      }
      for (const [y0, y1] of [[0.69, 1.42], [1.42, 2.13]] as const) {
        const row: [number, number][] = y0 < 1.4 ? low : [[WALL_Z, DZ], [DZ, 1.3]];
        for (const [za, zb] of row) {
          const s = 0.9 + hash01(za, y0) * 0.15;
          wall.box(0.03, y1 - y0 - 0.035, zb - za - 0.035, WX + 0.015, (y0 + y1) / 2, (za + zb) / 2,
            p => s * (0.84 + (p.y - 0.69) * 0.11));
        }
      }
      for (const s of [-1, 1]) frame.box(0.08, 1.38, 0.08, WX + 0.04, 0.69, DZ + s * (DW - 0.04), 0.9);
      frame.box(0.08, 0.08, DW * 2, WX + 0.04, 1.38, DZ, 0.9);
    }

    g.add(wall.mesh(this.shellWall), ceil.mesh(this.shellCeil), floor.mesh(this.shellFloor),
      frame.mesh(this.shellFrame), lens.mesh(this.shellLens));
    g.add(halo.mesh(glowMat('pool', 0xffb36b, 0.45)), wash.mesh(glowMat('wash', 0xffb36b, 0.85)),
      pool.mesh(glowMat('pool', 0xffb36b, 0.5)));
  }

  /** dusk through a porthole lands: a glow on the wall round the glass, a patch on the floor below */
  private duskSpill(g: THREE.Group, xs: number[], w: number, y: number): void {
    const halo = new Kit(), patch = new Kit();
    for (const x of xs) {
      halo.quad(w * 2.6, w * 2.6, x, y, WALL_Z + 0.042, 'wall');
      patch.quad(w * 1.3, 2.9, x, 0.006, -0.5, 'up');
    }
    g.add(halo.mesh(glowMat('pool', 0xff9447, 0.35)), patch.mesh(glowMat('pool', 0xff8a3d, 0.7)));
  }

  private buildStations(g: THREE.Group): void {
    // THE LEDGER — a standing desk, a strongbox, a caged lamp
    g.add(box(1.15, 0.12, 0.6, DARKPIPE, 4, 0.62, -1.2));
    g.add(box(1.0, 0.55, 0.5, GUNMETAL, 4, 0.28, -1.2));
    const book = box(0.44, 0.05, 0.32, CREAM, 4.18, 0.71, -1.1);
    book.rotation.z = -0.12;
    g.add(book);
    g.add(box(0.34, 0.3, 0.3, PLINTH, 3.62, 0.83, -1.32));
    g.add(glowDot(AMBER_GLOW, 3.62, 0.83, -1.16, 0.028));
    g.add(cyl(0.02, 0.5, DARKPIPE, 4.45, 0.95, -1.45, 6));
    g.add(glowDot(WARM_GLOW, 4.45, 1.22, -1.45, 0.045));
    this.stations.push({ x: 4, r: 0.9, label: 'THE LEDGER', panel: 'ledger' });

    // DISPATCH CONSOLE — a listening set with the dish's little brother
    g.add(box(0.8, 0.9, 0.45, GUNMETAL, 8.5, 0.45, -1.35));
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.34),
      new THREE.MeshBasicMaterial({ color: 0x0d4034, toneMapped: false }));
    screen.position.set(8.5, 0.98, -1.32);
    screen.rotation.x = -0.18;
    g.add(screen);
    g.add(box(0.62, 0.4, 0.04, DARKPIPE, 8.5, 0.99, -1.35));
    g.add(cyl(0.015, 0.6, DARKPIPE, 8.85, 1.5, -1.5, 5));
    this.consoleDot = glowDot(AMBER_GLOW, 8.2, 1.24, -1.3, 0.035);
    g.add(this.consoleDot);
    this.stations.push({ x: 8.5, r: 0.9, label: 'DISPATCH CONSOLE', panel: 'transcript' });

    // FAUNA DESK — specimen jars, a field ledger
    g.add(box(1.2, 0.1, 0.55, CREAM, 12.5, 0.58, -1.25));
    for (const s of [-1, 1]) g.add(box(0.08, 0.55, 0.4, DARKPIPE, 12.5 + s * 0.5, 0.28, -1.25));
    for (const [jx, jc] of [[12.15, 0xffe08a], [12.5, 0x5ad8e6], [12.85, 0x9ef0d0]] as const) {
      g.add(cyl(0.085, 0.22, new THREE.MeshStandardMaterial({
        color: 0xbfd8d2, roughness: 0.2, transparent: true, opacity: 0.35,
      }), jx, 0.76, -1.2, 10));
      g.add(glowDot(new THREE.MeshBasicMaterial({ color: jc, toneMapped: false }), jx, 0.72, -1.2, 0.035));
      g.add(cyl(0.09, 0.03, GUNMETAL, jx, 0.88, -1.2, 10));
    }
    this.stations.push({ x: 12.5, r: 0.9, label: 'FAUNA DESK', panel: 'faunalog' });

    // WARDROBE — the paint locker
    g.add(box(0.95, 1.85, 0.5, CREAM, 16, 0.93, -1.5));
    g.add(box(1.02, 0.08, 0.56, GUNMETAL, 16, 1.9, -1.5));
    g.add(box(0.95, 0.14, 0.51, ORANGE, 16, 1.45, -1.495));
    g.add(box(0.03, 0.3, 0.03, DARKPIPE, 16.4, 0.95, -1.23));
    g.add(glowDot(TEAL_GLOW, 15.62, 1.72, -1.23, 0.028));
    this.stations.push({ x: 16, r: 0.9, label: 'WARDROBE', panel: 'wardrobe' });

    // CATALOG — a pinboard and the crates things arrive in
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x6a5a48, roughness: 0.9 }));
    board.position.set(19.5, 1.35, -1.95);
    g.add(board);
    for (const [px2, py2, pc] of [[19.2, 1.5, 0xe6dcc4], [19.7, 1.28, 0xc4571f], [19.95, 1.55, 0x3ce6c8]] as const) {
      g.add(box(0.22, 0.28, 0.01, new THREE.MeshBasicMaterial({ color: pc, toneMapped: false }), px2, py2, -1.94));
    }
    g.add(box(0.55, 0.45, 0.55, TEAL_PAINT, 19.2, 0.32, -1.3));
    g.add(box(0.6, 0.05, 0.6, DARKPIPE, 19.2, 0.47, -1.3));
    g.add(box(0.4, 0.35, 0.4, ORANGE, 19.85, 0.28, -1.15));
    this.stations.push({ x: 19.5, r: 0.9, label: 'OUTFITTER CATALOG', panel: 'catalog' });
  }

  private buildFurnishings(g: THREE.Group, own: string[]): void {
    if (own.includes('rug')) {
      const rug = box(2.2, 0.03, 1.6, new THREE.MeshStandardMaterial({ color: 0x8a4a30, roughness: 0.95 }), 6.4, 0.02, -0.5);
      g.add(rug);
      g.add(box(2.2, 0.031, 0.12, this.trimMat, 6.4, 0.021, 0.24));
      g.add(box(2.2, 0.031, 0.12, this.trimMat, 6.4, 0.021, -1.24));
    }
    if (own.includes('lamp')) {
      g.add(cyl(0.16, 0.05, PLINTH, 14, 0.03, -0.9, 12));
      g.add(cyl(0.025, 1.3, DARKPIPE, 14, 0.68, -0.9, 8));
      g.add(cyl(0.14, 0.16, GUNMETAL, 14, 1.4, -0.9, 12));
      g.add(glowDot(WARM_GLOW, 14, 1.33, -0.9, 0.06));
      const pt = new THREE.PointLight(0xffd9a0, 3, 5, 2);
      pt.position.set(14, 1.3, -0.6);
      g.add(pt);
    }
    if (own.includes('plant')) {
      g.add(box(0.5, 0.32, 0.4, TEAL_PAINT, 2.4, 0.18, -1.3));
      g.add(box(0.54, 0.04, 0.44, DARKPIPE, 2.4, 0.36, -1.3));
      g.add(fernPlant(2.4, 0.37, -1.3));
    }
    if (own.includes('bunk')) {
      g.add(box(1.7, 0.16, 0.75, GUNMETAL, 21.4, 0.3, -1.35));
      g.add(box(1.7, 0.12, 0.75, CREAM, 21.4, 0.44, -1.35));
      g.add(box(0.4, 0.1, 0.5, ORANGE, 22.0, 0.55, -1.35));
      for (const s of [-1, 1]) g.add(box(0.08, 0.3, 0.08, DARKPIPE, 21.4 + s * 0.78, 0.15, -1.35));
    }
    if (own.includes('galley')) {
      g.add(box(1.0, 0.55, 0.45, TEAL_PAINT, 17.8, 0.28, -1.7));
      g.add(box(1.05, 0.06, 0.5, GUNMETAL, 17.8, 0.58, -1.7));
      g.add(cyl(0.09, 0.14, CREAM, 17.6, 0.68, -1.65, 10));
      g.add(cyl(0.05, 0.05, CREAM, 17.98, 0.64, -1.6, 8));
      g.add(cyl(0.05, 0.05, CREAM, 18.1, 0.64, -1.72, 8));
    }
    if (own.includes('shelf')) {
      // hung in the clear bay west of the x=11 window — a plank across the
      // glass reads as a mistake, and the ribs at 8 and 11.5 box it in
      g.add(box(1.1, 0.05, 0.3, this.trimMat, 9.55, 1.55, -1.85));
      for (const s of [-1, 1]) {
        const bracket = box(0.04, 0.16, 0.22, DARKPIPE, 9.55 + s * 0.48, 1.45, -1.87);
        bracket.rotation.x = -0.5;
        g.add(bracket);
      }
      for (const [bx, bh, bc] of [[9.2, 0.24, 0x2e6e64], [9.37, 0.28, 0xa83a24], [9.55, 0.22, 0xe6dcc4], [9.77, 0.26, 0x4b545e]] as const) {
        g.add(box(0.12, bh, 0.2, new THREE.MeshStandardMaterial({ color: bc, roughness: 0.8 }), bx, 1.58 + bh / 2, -1.82));
      }
      const flat = box(0.26, 0.1, 0.2, new THREE.MeshStandardMaterial({ color: 0x9c431c, roughness: 0.8 }), 9.98, 1.63, -1.82);
      g.add(flat);
    }
    if (own.includes('radio')) {
      // the set sits on its own side cabinet — it was floating at desk height
      // with nothing under it
      for (const s of [-1, 1]) g.add(box(0.07, 0.08, 0.3, DARKPIPE, 5.1 + s * 0.19, 0.04, -1.4));
      g.add(box(0.52, 0.5, 0.38, GUNMETAL, 5.1, 0.33, -1.4));
      g.add(box(0.58, 0.04, 0.42, DARKPIPE, 5.1, 0.6, -1.4));
      g.add(box(0.42, 0.025, 0.01, DARKPIPE, 5.1, 0.42, -1.205));
      g.add(box(0.06, 0.05, 0.03, GUNMETAL, 5.1, 0.28, -1.205));
      g.add(box(0.4, 0.24, 0.2, GUNMETAL, 5.1, 0.74, -1.4));
      g.add(cyl(0.012, 0.4, DARKPIPE, 5.24, 1.05, -1.4, 4));
      g.add(glowDot(TEAL_GLOW, 4.98, 0.78, -1.28, 0.02));
    }
    if (own.includes('chart')) {
      const tex = canvasTex(256, 160, gg => {
        gg.fillStyle = '#141a26'; gg.fillRect(0, 0, 256, 160);
        gg.strokeStyle = '#2a3448'; gg.lineWidth = 1;
        for (let i = 0; i < 6; i++) {
          gg.beginPath(); gg.arc(128, 80, 18 + i * 16, 0, Math.PI * 2); gg.stroke();
        }
        let seed = 3;
        const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        for (let i = 0; i < 60; i++) {
          const a = rnd() * Math.PI * 2, r = rnd() * 74;
          gg.fillStyle = i % 9 === 0 ? '#ffd9a0' : '#8fa3c8';
          gg.fillRect(128 + Math.cos(a) * r, 80 + Math.sin(a) * r, i % 9 === 0 ? 3 : 1.5, i % 9 === 0 ? 3 : 1.5);
        }
      });
      const chart = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.82),
        new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
      chart.position.set(13.25, 1.5, -1.92);
      g.add(chart);
      g.add(box(1.38, 0.05, 0.04, DARKPIPE, 13.25, 1.93, -1.91));
      g.add(box(1.38, 0.05, 0.04, DARKPIPE, 13.25, 1.07, -1.91));
    }
  }

  private buildWingDoor(g: THREE.Group, atX: number, open: boolean, name: string, hidden = false): void {
    if (hidden) return;  // the vivarium door isn't visible until the gallery exists
    g.add(box(0.5, 2.3, 0.25, this.wallMat, atX, 1.15, -1.6));
    g.add(box(0.56, 0.12, 0.3, this.trimMat, atX, 2.32, -1.6));
    if (open) {
      g.add(glowDot(WARM_GLOW, atX, 2.1, -1.4, 0.035));
      return;
    }
    // sealed: a hatch across the doorway, red-dogged
    g.add(box(0.2, 2.1, 2.6, GUNMETAL, atX, 1.05, -0.6));
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.028, 6, 14), new THREE.MeshStandardMaterial({ color: 0xa83a24, roughness: 0.6 }));
    wheel.position.set(atX - 0.12, 1.0, -0.6);
    wheel.rotation.y = Math.PI / 2;
    g.add(wheel);
    g.add(glowDot(RED_GLOW, atX - 0.12, 1.7, -0.6, 0.03));
    this.stations.push({ x: atX - 0.35, r: 0.8, label: `SEALED — ${name} · THE CATALOG SELLS THE KEY`, panel: 'catalog' });
  }

  /**
   * Six pedestals, hung the way a gallery hangs anything: one stone per kind,
   * the best cut you own of each, and read left to right in the order the
   * column gives them up — the commonest thing in the ground by the door, the
   * rarest at the far end. Each occupied plinth carries a placard you can read
   * with E or with a click.
   */
  private buildGallery(g: THREE.Group): void {
    const best = new Map<number, Trophy>();
    for (const tr of this.ctx.meta.trophies) {
      const held = best.get(tr.t);
      if (!held || tr.grade > held.grade) best.set(tr.t, tr);
    }
    const shown = [...best.values()]
      .sort((a, b) => rarityRank(b.t) - rarityRank(a.t))    // keep the six rarest,
      .slice(0, 6)
      .sort((a, b) => rarityRank(a.t) - rarityRank(b.t));   // then walk common → rare

    for (let i = 0; i < 6; i++) {
      const px = HALL_X1 + 1.7 + i * 1.95;
      g.add(cyl(0.3, 0.1, GUNMETAL, px, 0.05, -1.1, 16));
      g.add(cyl(0.22, 0.85, PLINTH, px, 0.52, -1.1, 12));
      g.add(cyl(0.28, 0.06, GUNMETAL, px, 0.97, -1.1, 16));
      const trophy = shown[i];
      if (!trophy) {
        g.add(glowDot(new THREE.MeshBasicMaterial({ color: 0x3a4048, toneMapped: false }), px, 1.12, -1.1, 0.04));
        continue;
      }
      const d = tileDef(trophy.t);
      const gemColor = d.gem ?? 0xffffff;
      const mat = new THREE.MeshStandardMaterial({
        color: gemColor, flatShading: true, roughness: 0.16, metalness: 0.55,
        emissive: gemColor, emissiveIntensity: trophy.grade >= 2 ? 1.15 : 0.75,
      });
      const gem = new THREE.Mesh(GEM_GEOS[DISPLAY_CUT], mat);   // the display cut
      const s = (trophy.grade >= 2 ? 0.62 : 0.5) * gemScaleOf(trophy.t) * 1.6;
      gem.scale.setScalar(Math.max(0.34, s));
      gem.position.set(px, 1.28, -1.1);
      g.add(gem);
      this.gems.push(gem);

      const plate = placard(d.name, depthLine(trophy.t), px, 0.66, -0.79);
      plate.userData.mineral = trophy.t;
      g.add(plate);
      this.placards.push(plate);
      // 0.85 leaves the sealed vivarium door, half a metre past the last
      // plinth, a band of its own to be found in
      this.stations.push({
        x: px, r: 0.85, mineral: trophy.t, panel: null,
        label: `READ — ${d.name.toUpperCase()}${trophy.grade >= 2 ? ' · FLAWLESS' : ''}`,
      });
    }
    for (const wx of [HALL_X1 + 3.6, HALL_X1 + 7.5]) g.add(duskWindow(0.7, wx, 1.7));
  }

  private buildVivarium(g: THREE.Group): void {
    const groups: (FaunaEntry['world'])[] = ['veil3', 'cryos2', 'maelis6', null];
    for (let i = 0; i < 4; i++) {
      const tx = GALLERY_X1 + 1.9 + i * 2.6;
      // tank: gunmetal base + cap, faint teal glass column
      g.add(cyl(0.85, 0.16, GUNMETAL, tx, 0.08, -1.0, 20));
      g.add(cyl(0.78, 1.5, new THREE.MeshStandardMaterial({
        color: 0x9fd8cc, roughness: 0.15, transparent: true, opacity: 0.16, depthWrite: false,
      }), tx, 0.91, -1.0, 20));
      g.add(cyl(0.85, 0.1, GUNMETAL, tx, 1.7, -1.0, 20));
      g.add(glowDot(TEAL_GLOW, tx + 0.7, 0.14, -0.65, 0.025));

      const residents = FAUNA.filter(f => f.world === groups[i] && this.ctx.meta.sponsored.includes(f.id)).slice(0, 3);
      for (let j = 0; j < residents.length; j++) {
        this.forms.push(this.buildLightform(g, residents[j], tx + (j - (residents.length - 1) / 2) * 0.42, 0.75));
      }
    }
  }

  /** a species, remembered in light — small, tinted, alive enough */
  private buildLightform(g: THREE.Group, f: FaunaEntry, x: number, y: number): FormAnim {
    const kind = LIGHTFORM[f.id] ?? 'motes';
    const group = new THREE.Group();
    group.position.set(x, y, -1.0);
    const mat = new THREE.MeshBasicMaterial({ color: f.color, toneMapped: false, transparent: true, opacity: 0.9 });
    const parts: THREE.Object3D[] = [];
    if (kind === 'swarm') {
      for (let i = 0; i < 6; i++) {
        const m = new THREE.Mesh(new THREE.TetrahedronGeometry(0.028), mat);
        group.add(m); parts.push(m);
      }
    } else if (kind === 'serpent') {
      for (let i = 0; i < 6; i++) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.05 - i * 0.005, 8, 6), mat);
        group.add(m); parts.push(m);
      }
    } else if (kind === 'walker') {
      for (let i = 0; i < 3; i++) {
        const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.07 - i * 0.015), mat);
        m.position.y = i * 0.12;
        group.add(m); parts.push(m);
      }
    } else {
      for (let i = 0; i < 10; i++) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 4), mat);
        group.add(m); parts.push(m);
      }
    }
    g.add(group);
    return { kind, group, parts, seed: x * 7.13 + f.id.length };
  }

  // ---------------- the frame ----------------

  frame(dt: number, input: Input, paused: boolean): void {
    this.time += dt;
    this.paused = paused;
    if (!paused) this.step(dt, input);
    this.animate(dt);

    // camera: eased pan, clamped so the walls stay off-frame
    const half = 4.6;
    const tx = Math.min(this.maxX() - half, Math.max(HALL_X0 + half, this.px));
    this.cx += (tx - this.cx) * Math.min(1, dt * 3.6);
    this.camera.position.set(this.cx, 1.05, 6.4);
    this.camera.lookAt(this.cx, 0.95, 0);

    if (this.consoleDot) {
      this.consoleDot.visible = this.ctx.unread() > 0;
      this.consoleDot.scale.setScalar(1 + Math.sin(this.time * 5) * 0.25);
    }

    // prompt
    const near = paused ? null : this.nearestStation();
    const html = near ? glyphs(`<span class="key">E</span>${near.label}`) : '';
    if (html !== this.lastPrompt) {
      this.lastPrompt = html;
      const el = this.hud.querySelector('.ih-prompt') as HTMLDivElement | null;
      if (el) el.innerHTML = html;
    }
  }

  private step(dt: number, input: Input): void {
    const move = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    if (move !== 0) {
      this.vx += move * 26 * dt;
      this.vx = Math.max(-WALK, Math.min(WALK, this.vx));
      this.facing = move;
    } else {
      this.vx -= this.vx * Math.min(1, 14 * dt);
    }
    if (input.up && this.grounded) { this.vy = JUMP; this.grounded = false; }
    this.vy -= GRAV * dt;

    this.px += this.vx * dt;
    this.py += this.vy * dt;
    const lo = HALL_X0 - 0.05 + HW, hi = this.maxX() + 0.05 - HW;
    if (this.px < lo) { this.px = lo; this.vx = 0; }
    if (this.px > hi) { this.px = hi; this.vx = 0; }
    if (this.py <= HH) { this.py = HH; this.vy = 0; this.grounded = true; }
    if (this.py > CEIL - HH) { this.py = CEIL - HH; this.vy = Math.min(0, this.vy); }

    this.walkT += dt * Math.abs(this.vx) * 4;
    poseSuit(this.suit, {
      dt, walkT: this.walkT, time: this.time,
      speed01: Math.min(1, Math.abs(this.vx) / WALK),
      grounded: this.grounded, facing: this.facing, vy: this.vy,
    });
    this.suit.group.position.set(this.px, this.py + suitPoseYOffset(this.suit), 0.1);
  }

  private animate(dt: number): void {
    for (const gem of this.gems) gem.rotation.y += dt * 0.6;
    for (const f of this.forms) {
      const t = this.time + f.seed;
      if (f.kind === 'swarm') {
        f.parts.forEach((p, i) => {
          const a = t * (0.9 + (i % 3) * 0.25) + i * 1.05;
          p.position.set(Math.cos(a) * 0.2, Math.sin(a * 1.4 + i) * 0.32, Math.sin(a) * 0.12);
          p.rotation.y = a;
        });
      } else if (f.kind === 'serpent') {
        f.parts.forEach((p, i) => {
          const ph = t * 1.6 - i * 0.55;
          p.position.set(Math.cos(ph) * 0.22, Math.sin(ph * 2) * 0.1 - i * 0.02 + 0.05, Math.sin(ph) * 0.1);
        });
      } else if (f.kind === 'walker') {
        f.group.position.y = 0.75 + Math.sin(t * 0.8) * 0.04;
        f.group.rotation.y = t * 0.5;
      } else {
        f.parts.forEach((p, i) => {
          const a = t * 0.5 + i * 2.4;
          p.position.set(Math.cos(a + i) * 0.24, Math.sin(a * 1.3) * 0.3, Math.sin(a * 0.8) * 0.12);
        });
      }
    }
  }

  private nearestStation(): Station | null {
    let best: Station | null = null;
    let bd = Infinity;
    for (const s of this.stations) {
      const d = Math.abs(this.px - s.x);
      if (d < s.r && d < bd) { bd = d; best = s; }
    }
    return best;
  }

  // ---------------- mode contract ----------------

  interact(): void {
    const s = this.nearestStation();
    if (!s) return;
    if (s.mineral !== undefined) this.ctx.openMineral(s.mineral);
    else if (s.panel) this.ctx.openPanel(s.panel);
    else this.closed = true;
  }

  abandon(): void { this.closed = true; }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  render(renderer: THREE.WebGLRenderer): void {
    renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    removeEventListener('pointerdown', this.onPointerDown);
    removeEventListener('pointermove', this.onPointerMove);
    if (this.hovering) document.body.style.cursor = '';
    this.hud.remove();
    this.scene.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose?.();
    });
  }
}
