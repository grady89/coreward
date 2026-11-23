import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
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
const PLINTH = new THREE.MeshStandardMaterial({ color: 0x272b31, roughness: 0.8, metalness: 0.3 });
const FERN = new THREE.MeshStandardMaterial({ color: 0x6e9668, roughness: 0.8 });
const WARM_GLOW = new THREE.MeshBasicMaterial({ color: 0xffc06a, toneMapped: false });
const TEAL_GLOW = new THREE.MeshBasicMaterial({ color: 0x3ce6c8, toneMapped: false });
const AMBER_GLOW = new THREE.MeshBasicMaterial({ color: 0xff9a3c, toneMapped: false });
const RED_GLOW = new THREE.MeshBasicMaterial({ color: 0xff4d29, toneMapped: false });

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
const UNIT_ICO = new THREE.IcosahedronGeometry(1, 1);
const UNIT_RING = new THREE.TorusGeometry(1, 0.14, 5, 14);   // in the xy plane: a handle seen side-on

/** a grey multiplier (shell), a fixed colour (props), or a multiplier by position */
type Shade = number | THREE.Color | ((p: THREE.Vector3) => number);

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
      x: number, y: number, z: number, shade: Shade, rotX = 0, rotY = 0, rotZ = 0): void {
    this.m.compose(this.v.set(x, y, z), this.q.setFromEuler(this.e.set(rotX, rotY, rotZ)), this.s.set(sx, sy, sz));
    this.nm.getNormalMatrix(this.m);
    const p = src.getAttribute('position'), n = src.getAttribute('normal');
    const t = src.getAttribute('uv'), ix = src.getIndex();
    const base = this.pos.length / 3;
    for (let i = 0; i < p.count; i++) {
      this.v.fromBufferAttribute(p, i).applyMatrix4(this.m);
      this.pos.push(this.v.x, this.v.y, this.v.z);
      if (shade instanceof THREE.Color) this.col.push(shade.r, shade.g, shade.b);
      else {
        const k = typeof shade === 'number' ? shade : shade(this.v);
        this.col.push(k, k, k);
      }
      this.v.fromBufferAttribute(n, i).applyMatrix3(this.nm).normalize();
      this.nor.push(this.v.x, this.v.y, this.v.z);
      if (t) this.uv.push(t.getX(i), t.getY(i)); else this.uv.push(0, 0);
    }
    if (ix) for (let i = 0; i < ix.count; i++) this.idx.push(base + ix.getX(i));
    else for (let i = 0; i < p.count; i++) this.idx.push(base + i);
  }

  get empty(): boolean { return this.pos.length === 0; }

  /** a box with its edges chamfered off, so it catches a highlight on every edge */
  bev(w: number, h: number, d: number, x: number, y: number, z: number, shade: Shade, c = 0.02, rotY = 0): void {
    this.add(bevelGeo(w, h, d, c), 1, 1, 1, x, y, z, shade, 0, rotY);
  }

  /** a (possibly tapered) faceted cylinder, upright unless tipped */
  cyl(rTop: number, rBot: number, h: number, x: number, y: number, z: number, shade: Shade,
      seg = 10, rotX = 0, rotZ = 0): void {
    this.add(cylGeo(rTop, rBot, h, seg), 1, 1, 1, x, y, z, shade, rotX, 0, rotZ);
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

// ---------------- the furniture's building blocks ----------------

const C = (hex: number) => new THREE.Color(hex);

const bevelCache = new Map<string, THREE.BufferGeometry>();
/** a chamfered box as the hull of three crossed slabs: flat faces, cut edges, cut corners */
function bevelGeo(w: number, h: number, d: number, c: number): THREE.BufferGeometry {
  const key = `${w}|${h}|${d}|${c}`;
  const had = bevelCache.get(key);
  if (had) return had;
  c = Math.min(c, w / 2 - 0.002, h / 2 - 0.002, d / 2 - 0.002);
  const pts: THREE.Vector3[] = [];
  for (const [a, b, e] of [[w / 2, h / 2 - c, d / 2 - c], [w / 2 - c, h / 2, d / 2 - c], [w / 2 - c, h / 2 - c, d / 2]]) {
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) pts.push(new THREE.Vector3(sx * a, sy * b, sz * e));
  }
  const geo = new ConvexGeometry(pts);
  bevelCache.set(key, geo);
  return geo;
}

const cylCache = new Map<string, THREE.BufferGeometry>();
function cylGeo(rTop: number, rBot: number, h: number, seg: number): THREE.BufferGeometry {
  const key = `${rTop}|${rBot}|${h}|${seg}`;
  let geo = cylCache.get(key);
  if (!geo) cylCache.set(key, geo = new THREE.CylinderGeometry(rTop, rBot, h, seg));
  return geo;
}

/** the furniture's three surfaces: painted or woven, worked metal, and the bits that glow */
const PROP_MATTE = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, flatShading: true });
const PROP_SHEEN = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.36, metalness: 0.5, flatShading: true });
const PROP_GLOW = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, side: THREE.DoubleSide });

/**
 * Every prop in a room section, baked into a handful of vertex-coloured
 * meshes: a whole galley — cabinet, top, kettle, cups — costs no extra draw
 * calls over a single box, so the props can afford their chamfers and trims.
 */
class PropKit {
  matte = new Kit();
  sheen = new Kit();
  glow = new Kit();
  private light = new Map<string, Kit>();

  /** soft additive light laid on a surface: 'pool' is round, 'wash' fans down from its top edge */
  land(kind: 'pool' | 'wash', color: number, opacity: number): Kit {
    const key = `${kind}|${color}|${opacity}`;
    let k = this.light.get(key);
    if (!k) this.light.set(key, k = new Kit());
    return k;
  }

  flush(g: THREE.Group): void {
    for (const [k, mat] of [[this.matte, PROP_MATTE], [this.sheen, PROP_SHEEN], [this.glow, PROP_GLOW]] as const) {
      if (!k.empty) g.add(k.mesh(mat));
    }
    for (const [key, k] of this.light) {
      const [kind, color, opacity] = key.split('|');
      g.add(k.mesh(glowMat(kind as 'pool' | 'wash', +color, +opacity)));
    }
  }
}

/** a texture drawn once per session, not once per rebuild */
const texCache = new Map<string, THREE.CanvasTexture>();
function onceTex(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  let t = texCache.get(key);
  if (!t) texCache.set(key, t = canvasTex(w, h, draw));
  return t;
}

/** trade-post wool in dusk colours: a stepped border round a row of nested diamonds */
function rugTexture(): THREE.CanvasTexture {
  return onceTex('rug', 512, 372, gg => {
    const W = 512, H = 372;
    const PLUM = '#3e2236', RUST = '#a4462a', AMBER = '#e39b3f', CREAM = '#efd9aa', WINE = '#6e2a30';
    gg.fillStyle = PLUM; gg.fillRect(0, 0, W, H);
    gg.fillStyle = AMBER; gg.fillRect(20, 20, W - 40, H - 40);
    gg.fillStyle = PLUM; gg.fillRect(28, 28, W - 56, H - 56);
    // the border's running teeth
    gg.fillStyle = CREAM;
    for (let x = 40; x < W - 40; x += 24) { gg.fillRect(x, 36, 12, 10); gg.fillRect(x + 6, H - 46, 12, 10); }
    for (let y = 58; y < H - 50; y += 24) { gg.fillRect(36, y, 10, 12); gg.fillRect(W - 46, y + 6, 10, 12); }
    gg.fillStyle = AMBER; gg.fillRect(54, 54, W - 108, H - 108);
    gg.fillStyle = RUST; gg.fillRect(60, 60, W - 120, H - 120);
    const diamond = (cx: number, cy: number, rx: number, ry: number, c: string) => {
      gg.fillStyle = c;
      gg.beginPath(); gg.moveTo(cx, cy - ry); gg.lineTo(cx + rx, cy); gg.lineTo(cx, cy + ry); gg.lineTo(cx - rx, cy); gg.fill();
    };
    // half-diamonds along the field's edges, so the pattern reads as repeating
    for (let i = 0; i <= 8; i++) {
      const cx = 60 + i * (W - 120) / 8;
      diamond(cx, 60, 16, 22, WINE); diamond(cx, H - 60, 16, 22, WINE);
    }
    for (let i = 0; i < 4; i++) {
      const cx = 60 + (W - 120) * (i + 0.5) / 4, cy = H / 2;
      diamond(cx, cy, 46, 104, AMBER);
      diamond(cx, cy, 34, 80, PLUM);
      diamond(cx, cy, 22, 54, CREAM);
      diamond(cx, cy, 10, 26, WINE);
    }
    // the weave: faint rows, so close up it is cloth and not paint
    for (let y = 0; y < H; y += 4) {
      gg.fillStyle = y % 8 ? 'rgba(0,0,0,0.07)' : 'rgba(255,240,210,0.05)';
      gg.fillRect(0, y, W, 2);
    }
  });
}

/** the radio's tuning glass: amber, ticked, the stations printed along it */
function dialTexture(): THREE.CanvasTexture {
  return onceTex('dial', 256, 128, gg => {
    const grad = gg.createRadialGradient(128, 70, 10, 128, 70, 150);
    grad.addColorStop(0, '#ffe2a0'); grad.addColorStop(0.6, '#ffb350'); grad.addColorStop(1, '#c86a22');
    gg.fillStyle = grad; gg.fillRect(0, 0, 256, 128);
    gg.strokeStyle = 'rgba(70,32,10,0.85)'; gg.lineWidth = 3;
    gg.beginPath(); gg.moveTo(18, 84); gg.lineTo(238, 84); gg.stroke();
    for (let i = 0; i <= 22; i++) {
      const x = 18 + i * 10;
      gg.lineWidth = i % 5 ? 2 : 4;
      gg.beginPath(); gg.moveTo(x, 84); gg.lineTo(x, i % 5 ? 70 : 60); gg.stroke();
    }
    gg.fillStyle = 'rgba(70,32,10,0.85)';
    gg.font = '700 22px system-ui, sans-serif';
    gg.textAlign = 'center';
    ['55', '70', '90', '120', '160'].forEach((t, i) => gg.fillText(t, 18 + i * 50, 48));
    gg.fillRect(18, 100, 220, 6);
  });
}

/** the dispatch console's screen: a waveform, some traffic, scanlines */
function screenTexture(): THREE.CanvasTexture {
  return onceTex('screen', 256, 160, gg => {
    gg.fillStyle = '#0b3a31'; gg.fillRect(0, 0, 256, 160);
    gg.strokeStyle = '#5ff0c8'; gg.lineWidth = 3;
    gg.beginPath();
    for (let x = 0; x <= 256; x += 4) {
      const y = 62 + Math.sin(x * 0.09) * 18 * Math.sin(x * 0.021 + 1) + Math.sin(x * 0.4) * 4;
      if (x === 0) gg.moveTo(x, y); else gg.lineTo(x, y);
    }
    gg.stroke();
    gg.fillStyle = 'rgba(95,240,200,0.55)';
    for (const [y, w] of [[112, 150], [126, 96], [140, 124]]) gg.fillRect(16, y, w, 6);
    gg.fillStyle = 'rgba(255,170,70,0.9)'; gg.fillRect(214, 112, 26, 26);
    for (let y = 0; y < 160; y += 4) { gg.fillStyle = 'rgba(0,0,0,0.22)'; gg.fillRect(0, y, 256, 2); }
  });
}

/** the outfitter's pinboard: cork, a few catalog pages and a dusk snapshot */
function boardTexture(): THREE.CanvasTexture {
  return onceTex('board', 320, 232, gg => {
    gg.fillStyle = '#9c6c42'; gg.fillRect(0, 0, 320, 232);
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 900; i++) {
      gg.fillStyle = rnd() > 0.5 ? 'rgba(60,34,18,0.35)' : 'rgba(214,170,120,0.3)';
      gg.fillRect(rnd() * 320, rnd() * 232, 2, 2);
    }
    const page = (x: number, y: number, w: number, h: number, rot: number, fill: string, draw: () => void) => {
      gg.save(); gg.translate(x, y); gg.rotate(rot);
      gg.fillStyle = 'rgba(30,16,8,0.35)'; gg.fillRect(-w / 2 + 4, -h / 2 + 5, w, h);
      gg.fillStyle = fill; gg.fillRect(-w / 2, -h / 2, w, h);
      draw();
      gg.restore();
    };
    // a lamp, sketched
    page(70, 90, 92, 120, -0.06, '#eee2c6', () => {
      gg.strokeStyle = '#3a2a1c'; gg.lineWidth = 3;
      gg.beginPath(); gg.moveTo(-14, 44); gg.lineTo(-14, -20); gg.quadraticCurveTo(-10, -42, 14, -30); gg.stroke();
      gg.fillStyle = '#c4571f'; gg.beginPath(); gg.moveTo(4, -30); gg.lineTo(26, -30); gg.lineTo(20, -18); gg.lineTo(10, -18); gg.fill();
      gg.fillRect(-26, 42, 24, 5);
      gg.fillStyle = '#3a2a1c'; gg.fillRect(-36, -52, 50, 5);
    });
    // a fern, from the greenhouse list
    page(168, 120, 84, 104, 0.05, '#e6dcc4', () => {
      gg.strokeStyle = '#4d8a42'; gg.lineWidth = 4;
      for (const a of [-0.7, -0.3, 0, 0.35, 0.7]) {
        gg.beginPath(); gg.moveTo(0, 36); gg.quadraticCurveTo(Math.sin(a) * 30, -10, Math.sin(a) * 40, -36); gg.stroke();
      }
      gg.fillStyle = '#2e6e64'; gg.fillRect(-16, 30, 32, 14);
    });
    // a dusk snapshot, the one window that isn't a porthole
    page(258, 78, 78, 74, -0.1, '#f2ead8', () => {
      const gr = gg.createLinearGradient(0, -30, 0, 22);
      gr.addColorStop(0, '#ffd89a'); gr.addColorStop(1, '#d9773a');
      gg.fillStyle = gr; gg.fillRect(-32, -30, 64, 48);
      gg.fillStyle = '#4a2a1c'; gg.fillRect(-32, 8, 64, 10);
    });
    // a teal order slip
    page(254, 176, 90, 56, 0.08, '#3fae9c', () => {
      gg.fillStyle = 'rgba(10,40,34,0.7)';
      for (let i = 0; i < 3; i++) gg.fillRect(-34, -14 + i * 12, 56 - i * 10, 5);
    });
    for (const [x, y, c] of [[70, 36, '#d23a24'], [168, 74, '#e8c040'], [252, 46, '#d23a24'], [254, 152, '#e6dcc4']] as const) {
      gg.fillStyle = 'rgba(0,0,0,0.35)'; gg.beginPath(); gg.arc(x + 2, y + 3, 6, 0, Math.PI * 2); gg.fill();
      gg.fillStyle = c; gg.beginPath(); gg.arc(x, y, 6, 0, Math.PI * 2); gg.fill();
    }
  });
}

/** the arm as it was: rings, and every light still marked burning */
function chartTexture(): THREE.CanvasTexture {
  return onceTex('chart', 256, 160, gg => {
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
}

/** a lamp's beam, seen in the air: bright under the shade, gone by the floor */
function beamTexture(): THREE.CanvasTexture {
  return onceTex('beam', 16, 128, gg => {
    const gr = gg.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    gg.fillStyle = gr; gg.fillRect(0, 0, 16, 128);
  });
}

/** a blanket thrown over a mattress: the top rumpled, the edges left where they fell */
let blanket: THREE.BufferGeometry | null = null;
function blanketGeo(): THREE.BufferGeometry {
  if (blanket) return blanket;
  const geo = new THREE.BoxGeometry(1.2, 0.06, 0.78, 8, 1, 4);
  const p = geo.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) <= 0) continue;
    const x = p.getX(i), z = p.getZ(i);
    p.setY(i, 0.03 + 0.018 * Math.sin(x * 9 + z * 4) * Math.cos(z * 7 - x * 3) + 0.012 * hash01(x * 10, z * 10));
  }
  return blanket = geo;
}

const JAR_GLASS = new THREE.MeshStandardMaterial({ color: 0xbfd8d2, roughness: 0.2, transparent: true, opacity: 0.35 });
let rugMat: THREE.MeshStandardMaterial | null = null;
const RUG_MAT = () => rugMat ??= new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: 0.95 });
let beamMat: THREE.MeshBasicMaterial | null = null;
const BEAM_MAT = () => beamMat ??= new THREE.MeshBasicMaterial({
  map: beamTexture(), color: 0xffb868, transparent: true, opacity: 0.13, side: THREE.DoubleSide,
  depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
});

// ---------------- palettes as moods ----------------

/**
 * A palette is more than its three swatches: each one also sets the trim
 * metal, the temperature of the hab's own light, and a push on the wall's hue
 * so the four rooms read apart in a thumbnail. Derived here from the palette
 * id; the catalog's swatches in furnish.ts stay what they are.
 */
interface Mood {
  /** the fixtures: lens, and the light they lay on ceiling, wall and floor */
  lens: number; light: number; fill: number;
  sky: number; ground: number;
  /** what the ribs, pillars and bolts are made of, and how far toward it */
  metal: number; metalMix: number;
  ceil: number; ceilMix: number;
  /** the lower wall band; null keeps it the wall colour */
  wains: number | null;
  /** handles, bookends, lamp brass */
  hardware: number;
  /** on the wall: hue turn (0..1), saturation and lightness multipliers */
  hue: number; sat: number; lum: number;
}

const MOODS: Record<string, Mood> = {
  // DUSK: the stock room, warm amber under worn gunmetal
  '': {
    lens: 0xffc77a, light: 0xffb36b, fill: 0xffd2a0, sky: 0xffd9b0, ground: 0x4a3b30,
    metal: 0x23272d, metalMix: 0.72, ceil: 0x2e2620, ceilMix: 0.3, wains: null,
    hardware: 0xb8925a, hue: 0, sat: 1, lum: 1,
  },
  // SLATEBED: cold-water blue-grey, steel ribs, a cooler white overhead —
  // so the bought lamps and the radio glow warm against it
  slate: {
    lens: 0xe4f0ff, light: 0xa9c4e8, fill: 0xd6e4ff, sky: 0xd2def0, ground: 0x2a323c,
    metal: 0x1a2430, metalMix: 0.7, ceil: 0x161e28, ceilMix: 0.42, wains: 0x3a5070,
    hardware: 0xb4c2cc, hue: 0.02, sat: 1.55, lum: 0.94,
  },
  // DUST ROSE: plum wainscot, brass ribs, a pink-peach light
  rose: {
    lens: 0xffcab8, light: 0xffaa96, fill: 0xffcab6, sky: 0xffd8cc, ground: 0x4a2c34,
    metal: 0x7a5a30, metalMix: 0.58, ceil: 0x3a1e2a, ceilMix: 0.4, wains: 0x7a3a4c,
    hardware: 0xd4a85c, hue: -0.03, sat: 1.35, lum: 1.03,
  },
  // VERDANT: deep green over warm wood, dark bronze, a golden light
  verdant: {
    lens: 0xffe6a0, light: 0xffcf6e, fill: 0xffe2a8, sky: 0xf2eac0, ground: 0x2c3824,
    metal: 0x3a2a18, metalMix: 0.68, ceil: 0x1a2618, ceilMix: 0.4, wains: 0x7a4a28,
    hardware: 0xd8b45a, hue: 0.01, sat: 1.45, lum: 0.86,
  },
};

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
  private shellWains = new THREE.MeshStandardMaterial({ roughness: 0.7, vertexColors: true });
  private shellCeil = new THREE.MeshStandardMaterial({ roughness: 0.85, vertexColors: true });
  private shellFloor = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.15, vertexColors: true });
  private shellFrame = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.35, vertexColors: true });
  private shellLens = new THREE.MeshBasicMaterial({ color: 0xffc77a, toneMapped: false });
  private hemi = new THREE.HemisphereLight(0xffd9b0, 0x4a3b30, 0.85);
  private mood: Mood = MOODS[''];
  /** the palette's hardware, for the props' handles and brass */
  private hardware = new THREE.Color();

  constructor(private ctx: InteriorCtx, aspect: number, ui: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 60);
    this.px = HALL_X0 + 1.6;
    this.cx = this.px;
    this.camera.position.set(this.cx, 1.05, 6.4);
    this.camera.lookAt(this.cx, 0.95, 0);

    this.scene.background = new THREE.Color(0x0e0b09);
    this.scene.add(this.hemi);

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
    const m = this.mood = MOODS[this.ctx.meta.palette] ?? MOODS[''];
    const wall = C(p.wall);
    if (m.hue !== 0 || m.sat !== 1 || m.lum !== 1) {
      const hsl = { h: 0, s: 0, l: 0 };
      wall.getHSL(hsl, THREE.SRGBColorSpace);
      wall.setHSL((hsl.h + m.hue + 1) % 1, Math.min(1, hsl.s * m.sat), hsl.l * m.lum, THREE.SRGBColorSpace);
    }
    this.wallMat.color.copy(wall);
    this.trimMat.color.setHex(p.trim);
    this.floorMat.color.setHex(p.floor);
    this.shellWall.color.copy(wall);
    this.shellWains.color.copy(m.wains === null ? wall : C(m.wains));
    this.shellCeil.color.copy(wall).lerp(C(m.ceil), m.ceilMix);
    this.shellFloor.color.setHex(p.floor);
    this.shellFrame.color.copy(wall).lerp(C(m.metal), m.metalMix);
    this.shellLens.color.setHex(m.lens);
    this.hemi.color.setHex(m.sky);
    this.hemi.groundColor.setHex(m.ground);
    this.hardware.setHex(m.hardware);
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
    const wall = new Kit(), wains = new Kit(), ceil = new Kit(), floor = new Kit(), frame = new Kit(), lens = new Kit();
    const halo = new Kit(), wash = new Kit(), pool = new Kit();
    const W = x1 - x0, CX = (x0 + x1) / 2;
    // value falls away toward the camera, so the frame's edges stay dark
    const ceilFade = (z: number) => z < 0.6 ? 1 : Math.max(0.25, 1 - (z - 0.6) * 0.22);
    const floorFade = (z: number) => z < 0.4 ? 1 : Math.max(0.1, 1 - (z - 0.4) * 0.34);

    // ---- back wall
    wall.box(W, 2.45, 0.15, CX, 1.125, WALL_Z - 0.075, 0.4);           // backing, seen in the seams
    frame.box(W, 0.14, 0.06, CX, 0.07, WALL_Z + 0.03, 0.8);            // kick plate
    for (const [a, b] of cells(x0, x1, PANEL / 2, GRID)) {               // wainscot
      wains.box(b - a - 0.03, 0.46, 0.05, (a + b) / 2, 0.38, WALL_Z + 0.025, 0.58 + hash01(a, 1) * 0.07);
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
      const warm = new THREE.PointLight(this.mood.fill, 3.2, 7, 1.7);
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
        wains.box(0.05, 0.46, zb - za - 0.03, WX + 0.025, 0.38, (za + zb) / 2, 0.6);
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

    g.add(wall.mesh(this.shellWall), wains.mesh(this.shellWains), ceil.mesh(this.shellCeil),
      floor.mesh(this.shellFloor), frame.mesh(this.shellFrame), lens.mesh(this.shellLens));
    const L = this.mood.light;
    g.add(halo.mesh(glowMat('pool', L, 0.45)), wash.mesh(glowMat('wash', L, 0.85)), pool.mesh(glowMat('pool', L, 0.5)));
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
    const k = new PropKit();
    const hw = this.hardware;
    const GUN = C(0x4b545e), GUN_L = C(0x5d6772), GUN_D = C(0x363d45), SOOT = C(0x23272d);

    // THE LEDGER — a standing desk, a strongbox, a caged lamp
    k.matte.bev(1.0, 0.54, 0.5, 4, 0.29, -1.2, GUN, 0.025);
    k.matte.box(0.94, 0.04, 0.44, 4, 0.02, -1.2, SOOT);
    for (const dy of [0.44, 0.29]) {
      k.matte.bev(0.44, 0.12, 0.02, 3.74, dy, -0.945, GUN_L, 0.008);
      k.sheen.box(0.13, 0.018, 0.02, 3.74, dy, -0.93, hw);
    }
    k.matte.bev(0.44, 0.40, 0.02, 4.26, 0.31, -0.945, GUN_L, 0.008);
    k.sheen.box(0.018, 0.13, 0.02, 4.07, 0.35, -0.93, hw);
    k.matte.bev(1.15, 0.08, 0.6, 4, 0.6, -1.2, GUN_D, 0.02);                     // top, dark rim
    k.matte.box(1.0, 0.012, 0.46, 4, 0.646, -1.2, C(0x3f5a49));                  // green leather inset
    k.matte.bev(0.5, 0.02, 0.34, 4.12, 0.662, -1.1, C(0x7a2a20), 0.006);         // the ledger, open
    for (const px of [4.0, 4.24]) k.matte.bev(0.22, 0.016, 0.31, px, 0.678, -1.1, C(0xefe6d0), 0.004);
    k.matte.add(UNIT_BOX, 0.2, 0.012, 0.012, 4.2, 0.69, -0.98, C(0x23272d), 0, 0.4);   // a pen
    k.matte.cyl(0.036, 0.032, 0.08, 4.5, 0.692, -1.0, C(0xc4571f), 10);          // the mug
    k.matte.add(UNIT_RING, 0.024, 0.024, 0.024, 4.537, 0.692, -1.0, C(0xc4571f));
    k.matte.cyl(0.031, 0.031, 0.004, 4.5, 0.73, -1.0, C(0x3a2214), 10);
    k.matte.bev(0.34, 0.3, 0.3, 3.62, 0.8, -1.32, C(0x2c3036), 0.02);           // strongbox
    k.sheen.cyl(0.045, 0.045, 0.02, 3.66, 0.8, -1.165, hw, 12, Math.PI / 2);
    k.sheen.box(0.02, 0.1, 0.02, 3.76, 0.8, -1.165, hw);
    k.glow.box(0.03, 0.03, 0.01, 3.5, 0.91, -1.168, C(0xff9a3c));
    k.sheen.cyl(0.07, 0.08, 0.03, 4.45, 0.655, -1.45, GUN_D, 10);                // caged lamp
    k.sheen.cyl(0.018, 0.018, 0.5, 4.45, 0.9, -1.45, GUN_D, 6);
    k.glow.add(UNIT_ICO, 0.045, 0.045, 0.045, 4.45, 1.2, -1.45, C(0xffd08a));
    for (const ry of [1.16, 1.24]) k.sheen.add(UNIT_RING, 0.062, 0.062, 0.062, 4.45, ry, -1.45, hw, Math.PI / 2);
    k.sheen.cyl(0.03, 0.07, 0.03, 4.45, 1.28, -1.45, GUN_D, 10);
    k.land('pool', 0xffb060, 0.5).quad(0.8, 0.5, 4.3, 0.656, -1.3, 'up');
    k.land('pool', 0xffb060, 0.32).quad(0.9, 0.9, 4.45, 1.18, WALL_Z + 0.046, 'wall');
    this.stations.push({ x: 4, r: 0.9, label: 'THE LEDGER', panel: 'ledger' });

    // DISPATCH CONSOLE — a listening set with the dish's little brother
    k.matte.bev(0.8, 0.78, 0.45, 8.5, 0.41, -1.35, GUN, 0.025);
    k.matte.box(0.74, 0.04, 0.4, 8.5, 0.02, -1.35, SOOT);
    k.matte.bev(0.62, 0.5, 0.02, 8.5, 0.39, -1.12, GUN_L, 0.01);
    for (let i = 0; i < 4; i++) k.matte.box(0.4, 0.022, 0.01, 8.5, 0.24 + i * 0.05, -1.107, SOOT);
    k.matte.box(0.2, 0.06, 0.006, 8.5, 0.56, -1.108, C(0xd9cfb2));               // the set's plate
    k.matte.bev(0.86, 0.05, 0.52, 8.5, 0.825, -1.33, GUN_D, 0.012);              // the deck
    k.sheen.box(0.86, 0.016, 0.012, 8.5, 0.81, -1.068, hw);
    const keys = [0xff9a3c, 0x3ce6c8, 0x3ce6c8, 0xff4d29, 0xffd08a];
    keys.forEach((c, i) => k.glow.box(0.05, 0.012, 0.035, 8.24 + i * 0.13, 0.856, -1.17, C(c)));
    k.matte.box(0.1, 0.04, 0.08, 8.5, 0.87, -1.43, GUN_D);
    k.matte.bev(0.64, 0.42, 0.08, 8.5, 1.09, -1.42, GUN_D, 0.02);               // the monitor
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.33),
      new THREE.MeshBasicMaterial({ map: screenTexture(), color: 0xc8c8c8, toneMapped: false }));
    screen.position.set(8.5, 1.09, -1.378);
    g.add(screen);
    k.land('pool', 0x3ce6c8, 0.18).quad(0.9, 0.6, 8.5, 1.09, -1.375, 'wall');
    k.sheen.cyl(0.012, 0.016, 0.8, 8.78, 1.2, -1.52, GUN_D, 6);                 // the mast and its dish
    k.sheen.cyl(0.12, 0.02, 0.05, 8.78, 1.62, -1.52, GUN_L, 12, 0, 0.5);
    k.glow.add(UNIT_ICO, 0.016, 0.016, 0.016, 8.74, 1.66, -1.52, C(0xff4d29));
    this.consoleDot = glowDot(AMBER_GLOW, 8.24, 1.24, -1.37, 0.035);
    g.add(this.consoleDot);
    this.stations.push({ x: 8.5, r: 0.9, label: 'DISPATCH CONSOLE', panel: 'transcript' });

    // FAUNA DESK — specimen jars, a field ledger
    k.matte.bev(1.22, 0.06, 0.56, 12.5, 0.585, -1.25, C(0x8a5a36), 0.015);        // wood edge
    k.matte.box(1.14, 0.012, 0.48, 12.5, 0.618, -1.25, C(0xe6dcc4));             // cream laminate
    for (const s of [-1, 1]) k.matte.bev(0.07, 0.555, 0.42, 12.5 + s * 0.5, 0.2775, -1.25, GUN_D, 0.015);
    k.matte.box(0.94, 0.04, 0.04, 12.5, 0.12, -1.25, GUN_D);
    k.matte.bev(0.52, 0.1, 0.42, 12.5, 0.5, -1.27, C(0xc9bea4), 0.012);
    k.sheen.box(0.12, 0.018, 0.02, 12.5, 0.5, -1.05, hw);
    for (const [jx, jc] of [[12.15, 0xffe08a], [12.5, 0x5ad8e6], [12.85, 0x9ef0d0]] as const) {
      g.add(cyl(0.085, 0.22, JAR_GLASS, jx, 0.734, -1.2, 10));
      k.glow.add(UNIT_ICO, 0.035, 0.035, 0.035, jx, 0.7, -1.2, C(jc));
      k.sheen.cyl(0.09, 0.09, 0.03, jx, 0.857, -1.2, hw, 10);
      k.land('pool', jc, 0.25).quad(0.32, 0.26, jx, 0.626, -1.2, 'up');
    }
    this.stations.push({ x: 12.5, r: 0.9, label: 'FAUNA DESK', panel: 'faunalog' });

    // WARDROBE — the paint locker
    k.matte.bev(0.95, 1.82, 0.5, 16, 0.93, -1.5, C(0xd8ceb4), 0.03);
    k.matte.box(0.9, 0.04, 0.46, 16, 0.02, -1.5, SOOT);
    k.matte.bev(0.86, 1.66, 0.012, 16, 0.94, -1.247, C(0xeae0c8), 0.005);        // the door, a shade lighter
    k.matte.bev(1.02, 0.08, 0.56, 16, 1.88, -1.5, GUN, 0.015);
    k.matte.bev(0.97, 0.14, 0.52, 16, 1.45, -1.5, C(0xc4571f), 0.03);
    k.sheen.bev(0.03, 0.32, 0.03, 16.36, 0.95, -1.222, hw, 0.008);
    for (const vy of [1.62, 1.67, 1.72, 0.16, 0.21, 0.26]) k.matte.box(0.34, 0.02, 0.01, 16.1, vy, -1.233, C(0x4a4438));
    [0x64707c, 0x9c7e78, 0x74836e].forEach((c, i) => k.matte.box(0.08, 0.08, 0.006, 15.72 + i * 0.1, 1.24, -1.232, C(c)));
    k.sheen.box(0.16, 0.05, 0.006, 16.14, 1.24, -1.232, hw);
    k.glow.add(UNIT_ICO, 0.028, 0.028, 0.028, 15.62, 1.72, -1.23, C(0x3ce6c8));
    this.stations.push({ x: 16, r: 0.9, label: 'WARDROBE', panel: 'wardrobe' });

    // CATALOG — a pinboard and the crates things arrive in
    k.matte.bev(1.18, 0.88, 0.04, 19.5, 1.35, -1.965, C(0x6e4a2e), 0.012);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 0.78),
      new THREE.MeshStandardMaterial({ map: boardTexture(), roughness: 0.9 }));
    board.position.set(19.5, 1.35, -1.943);
    g.add(board);
    const TEAL = C(0x2e6e64), TEAL_D = C(0x1f4b44), ORANGE = C(0xc4571f);
    k.matte.bev(0.55, 0.45, 0.55, 19.2, 0.225, -1.3, TEAL, 0.02);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      k.matte.box(0.06, 0.45, 0.06, 19.2 + sx * 0.25, 0.225, -1.3 + sz * 0.25, TEAL_D);
    }
    k.matte.box(0.565, 0.05, 0.565, 19.2, 0.225, -1.3, TEAL_D);
    k.matte.bev(0.6, 0.05, 0.6, 19.2, 0.475, -1.3, GUN_D, 0.012);
    k.matte.box(0.2, 0.1, 0.006, 19.1, 0.34, -1.024, C(0xe6dcc4));
    k.matte.bev(0.22, 0.02, 0.16, 19.22, 0.51, -1.22, C(0xe6dcc4), 0.005, 0.3);   // this season's catalog
    k.matte.bev(0.222, 0.022, 0.05, 19.25, 0.51, -1.16, C(0xc4571f), 0.005, 0.3);
    k.matte.bev(0.4, 0.35, 0.4, 19.85, 0.175, -1.15, ORANGE, 0.018);
    for (const sx of [-0.1, 0.1]) k.matte.box(0.04, 0.356, 0.406, 19.85 + sx, 0.175, -1.15, C(0x3a2a20));
    k.matte.box(0.12, 0.08, 0.006, 19.85, 0.2, -0.948, C(0xe6dcc4));
    this.stations.push({ x: 19.5, r: 0.9, label: 'OUTFITTER CATALOG', panel: 'catalog' });

    k.flush(g);
  }

  private buildFurnishings(g: THREE.Group, own: string[]): void {
    const k = new PropKit();
    const hw = this.hardware;
    const DARK = C(0x2a2e34), WOOD = C(0x7a5236), WOOD_L = C(0x9a6a3e), CREAM = C(0xe9e0cc);

    if (own.includes('rug')) {
      // trade-post wool: a patterned top on a plum body, fringe at both ends
      k.matte.box(2.2, 0.02, 1.6, 6.4, 0.012, -0.5, C(0x3e2236));
      const top = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.6), RUG_MAT());
      top.rotation.x = -Math.PI / 2;
      top.position.set(6.4, 0.0225, -0.5);
      g.add(top);
      for (const sx of [-1, 1]) for (let z = -1.26; z <= 0.27; z += 0.06) {
        k.matte.box(0.09, 0.008, 0.018, 6.4 + sx * 1.14, 0.008, z, C(0xe9d6ad), 0);
      }
    }
    if (own.includes('lamp')) {
      // an arc lamp: a weighted foot, a pole, an arm sweeping east to a dome
      // that throws a real cone of light down onto the floor and the wall
      const SX = 14.6, SY = 1.6, Z = -0.9;
      k.sheen.cyl(0.17, 0.19, 0.05, 14, 0.025, Z, DARK, 12);
      k.sheen.cyl(0.12, 0.12, 0.012, 14, 0.056, Z, hw, 12);
      k.sheen.cyl(0.02, 0.022, 1.62, 14, 0.87, Z, C(0x30353c), 8);
      const P0 = [14, 1.66], P1 = [14.06, 2.14], P2 = [SX, SY + 0.22];
      const at = (t: number) => [0, 1].map(i => (1 - t) ** 2 * P0[i] + 2 * (1 - t) * t * P1[i] + t * t * P2[i]);
      for (let i = 0; i < 8; i++) {
        const [ax, ay] = at(i / 8), [bx, by] = at((i + 1) / 8);
        k.sheen.add(UNIT_ROD, Math.hypot(bx - ax, by - ay) + 0.012, 0.017, 0.017,
          (ax + bx) / 2, (ay + by) / 2, Z, C(0x30353c), 0, 0, Math.atan2(by - ay, bx - ax));
      }
      k.sheen.cyl(0.05, 0.19, 0.17, SX, SY + 0.085, Z, hw, 14);          // the dome
      k.sheen.cyl(0.03, 0.05, 0.04, SX, SY + 0.19, Z, C(0x30353c), 8);
      k.glow.cyl(0.18, 0.18, 0.004, SX, SY - 0.004, Z, C(0xffd89a), 14);  // lit from inside
      k.glow.add(UNIT_ICO, 0.05, 0.05, 0.05, SX, SY - 0.02, Z, C(0xfff2d0));
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.82, SY - 0.02, 18, 1, true), BEAM_MAT());
      beam.position.set(SX, (SY - 0.02) / 2, Z);
      g.add(beam);
      k.land('pool', 0xffa04c, 0.8).quad(2.0, 1.7, SX, 0.008, Z + 0.1, 'up');
      k.land('wash', 0xffa85a, 0.55).quad(1.5, 1.5, SX, SY - 0.75, WALL_Z + 0.047, 'wall');
      k.land('pool', 0xffb060, 0.35).quad(1.4, 1.2, SX, SY + 0.05, WALL_Z + 0.046, 'wall');
      const pt = new THREE.PointLight(0xffc27a, 3.4, 4.5, 1.6);
      pt.position.set(SX, SY - 0.15, Z + 0.15);
      g.add(pt);
    }
    if (own.includes('plant')) {
      // a glazed pot: saucer, a tapered body with a band, a lip, soil
      k.matte.cyl(0.22, 0.2, 0.025, 2.4, 0.0125, -1.3, DARK, 10);
      k.matte.cyl(0.235, 0.17, 0.3, 2.4, 0.175, -1.3, C(0x2c6660), 8);
      k.matte.cyl(0.217, 0.209, 0.04, 2.4, 0.2, -1.3, C(0xd9a04a), 8);
      k.matte.cyl(0.255, 0.245, 0.05, 2.4, 0.335, -1.3, C(0x3d8a80), 8);
      k.matte.cyl(0.226, 0.226, 0.01, 2.4, 0.358, -1.3, C(0x3a2a1e), 8);
      g.add(fernPlant(2.4, 0.37, -1.3));
    }
    if (own.includes('bunk')) {
      // a bunk with its bed made, nearly: frame, mattress, a plum wool blanket
      // turned down over the sheet, a pillow, a cloth folded at the foot, and
      // a reading light on the wall
      const X = 21.4, Z = -1.35, FRAME = C(0x4b545e);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.matte.bev(0.06, 0.22, 0.06, X + sx * 0.8, 0.11, Z + sz * 0.33, C(0x363d45), 0.01);
      k.matte.bev(1.74, 0.1, 0.78, X, 0.27, Z, FRAME, 0.02);
      k.sheen.box(1.6, 0.02, 0.01, X, 0.27, Z + 0.392, hw);
      k.matte.bev(0.06, 0.5, 0.8, X + 0.85, 0.47, Z, FRAME, 0.015);              // headboard
      k.sheen.bev(0.09, 0.04, 0.84, X + 0.85, 0.74, Z, hw, 0.01);
      k.matte.bev(0.06, 0.32, 0.8, X - 0.85, 0.38, Z, FRAME, 0.015);             // footboard
      k.sheen.bev(0.09, 0.04, 0.84, X - 0.85, 0.56, Z, hw, 0.01);
      k.matte.bev(1.62, 0.13, 0.72, X, 0.385, Z, C(0xcfc8b6), 0.035);           // mattress
      k.matte.box(0.5, 0.012, 0.7, X + 0.58, 0.456, Z, C(0xf2ede2));             // the sheet
      k.matte.add(blanketGeo(), 1, 1, 1, X - 0.22, 0.475, Z, C(0x6a3a58));
      k.matte.bev(1.2, 0.1, 0.025, X - 0.22, 0.41, Z + 0.39, C(0x5e3250), 0.008); // the drape
      k.matte.bev(0.16, 0.04, 0.8, X + 0.3, 0.51, Z, C(0xefe6d2), 0.015);        // turned down
      k.matte.bev(0.03, 0.042, 0.805, X + 0.235, 0.512, Z, C(0xd99a3e), 0.008);
      k.matte.bev(0.16, 0.1, 0.025, X + 0.3, 0.43, Z + 0.4, C(0xefe6d2), 0.008);
      k.matte.add(UNIT_ICO, 0.19, 0.07, 0.29, X + 0.6, 0.53, Z, C(0xf6f1e6), 0, 0.08, 0.05);  // pillow
      k.matte.bev(0.22, 0.05, 0.3, X - 0.62, 0.535, Z + 0.08, C(0xc98a3a), 0.012);   // folded cloth
      k.matte.bev(0.224, 0.014, 0.304, X - 0.62, 0.535, Z + 0.08, C(0xe9d6ad), 0.004);
      // the reading light
      const LX = X + 0.22;
      k.sheen.bev(0.08, 0.14, 0.03, LX, 0.98, -1.975, hw, 0.008);
      k.sheen.add(UNIT_ROD, 0.012, 0.1, 0.012, LX, 0.98, -1.92, DARK, 0, Math.PI / 2);
      k.sheen.cyl(0.035, 0.075, 0.08, LX, 0.95, -1.86, hw, 10);
      k.glow.cyl(0.07, 0.07, 0.004, LX, 0.908, -1.86, C(0xffd89a), 10);
      k.glow.add(UNIT_ICO, 0.03, 0.03, 0.03, LX, 0.905, -1.86, C(0xfff2d0));
      k.land('wash', 0xffb060, 0.85).quad(1.1, 0.65, LX, 0.6, WALL_Z + 0.046, 'wall');
      k.land('pool', 0xffb060, 0.45).quad(0.7, 0.7, LX, 0.92, WALL_Z + 0.047, 'wall');
      k.land('pool', 0xffb060, 0.25).quad(0.9, 0.6, LX, 0.53, Z, 'up');
    }
    if (own.includes('galley')) {
      // a cabinet with a wood top, tiles behind, a shelf with a warm strip
      // under it, and on the counter: a copper kettle on its hob, two cups
      const X = 17.8, Z = -1.7, TEAL = C(0x2e6e64), TEAL_L = C(0x3a8276);
      k.matte.bev(1.0, 0.52, 0.45, X, 0.29, Z, TEAL, 0.02);
      k.matte.box(0.94, 0.04, 0.4, X, 0.02, Z + 0.02, C(0x23272d));
      for (const s of [-1, 1]) {
        k.matte.bev(0.46, 0.42, 0.02, X + s * 0.24, 0.29, Z + 0.23, TEAL_L, 0.008);
        k.sheen.bev(0.02, 0.12, 0.02, X + s * 0.06, 0.4, Z + 0.245, hw, 0.005);
      }
      k.matte.bev(1.06, 0.05, 0.5, X, 0.575, Z, WOOD_L, 0.012);
      for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) {
        k.matte.bev(0.155, 0.135, 0.012, X - 0.4 + c * 0.16, 0.675 + r * 0.14, -1.935,
          C((r + c) % 2 ? 0xe4dac2 : 0xd2c6aa), 0.004);
      }
      // the shelf, clear of the porthole and the pillar
      const SX = 17.9;
      k.matte.bev(0.76, 0.035, 0.2, SX, 1.13, -1.88, WOOD, 0.008);
      for (const s of [-1, 1]) k.sheen.bev(0.025, 0.1, 0.15, SX + s * 0.3, 1.07, -1.9, hw, 0.005);
      k.glow.box(0.6, 0.012, 0.03, SX, 1.106, -1.83, C(0xffd79a));
      k.matte.cyl(0.045, 0.045, 0.1, SX - 0.18, 1.2, -1.88, C(0xc4571f), 10);
      k.sheen.cyl(0.047, 0.047, 0.02, SX - 0.18, 1.255, -1.88, hw, 10);
      k.matte.cyl(0.04, 0.04, 0.08, SX - 0.06, 1.19, -1.88, CREAM, 10);
      k.sheen.cyl(0.042, 0.042, 0.02, SX - 0.06, 1.235, -1.88, hw, 10);
      k.land('wash', 0xffb060, 0.75).quad(0.95, 0.5, SX, 0.85, -1.926, 'wall');
      k.land('pool', 0xffb060, 0.5).quad(1.0, 0.45, SX - 0.05, 0.603, Z, 'up');
      // the hob, the kettle
      const KX = 17.52;
      k.sheen.cyl(0.11, 0.11, 0.012, KX, 0.606, Z, C(0x23272d), 14);
      const COPPER = C(0xc0703c);
      k.sheen.cyl(0.085, 0.118, 0.17, KX, 0.697, Z, COPPER, 12);
      k.sheen.cyl(0.056, 0.085, 0.034, KX, 0.799, Z, COPPER, 12);
      k.matte.add(UNIT_ICO, 0.025, 0.025, 0.025, KX, 0.825, Z, C(0x2a2018));
      k.sheen.cyl(0.016, 0.027, 0.15, KX - 0.125, 0.75, Z, COPPER, 8, 0, 0.75);
      k.matte.add(UNIT_RING, 0.08, 0.08, 0.08, KX + 0.09, 0.765, Z, C(0x2a2018));
      // two cups, in case anyone ever comes
      for (const [cx, cz, band] of [[17.9, Z + 0.08, 0xb04a26], [18.1, Z - 0.02, 0x2e6e64]] as const) {
        k.matte.cyl(0.052, 0.042, 0.098, cx, 0.649, cz, CREAM, 10);
        k.matte.cyl(0.0515, 0.049, 0.021, cx, 0.669, cz, C(band), 10);
        k.matte.cyl(0.046, 0.046, 0.004, cx, 0.689, cz, C(0x4a2a14), 10);
        k.matte.add(UNIT_RING, 0.03, 0.03, 0.03, cx + 0.058, 0.652, cz, CREAM);
      }
      k.matte.bev(0.14, 0.2, 0.012, 18.2, 0.47, Z + 0.255, C(0xefe6d2), 0.004);   // tea towel
      k.matte.bev(0.142, 0.025, 0.014, 18.2, 0.42, Z + 0.255, C(0xb04a26), 0.004);
    }
    if (own.includes('shelf')) {
      // hung in the clear bay west of the x=11 window — a plank across the
      // glass reads as a mistake, and the ribs at 8 and 11.5 box it in
      k.matte.bev(1.1, 0.045, 0.28, 9.55, 1.55, -1.86, WOOD, 0.01);
      g.add(box(1.1, 0.02, 0.012, this.trimMat, 9.55, 1.545, -1.714));
      for (const s of [-1, 1]) {
        k.sheen.box(0.035, 0.2, 0.02, 9.55 + s * 0.46, 1.44, -1.99, hw);
        k.sheen.add(UNIT_BOX, 0.03, 0.24, 0.02, 9.55 + s * 0.46, 1.44, -1.89, hw, 0.75);
      }
      const BOOK_Y = 1.5725;
      for (const [bx, bh, bc, band] of [[9.2, 0.24, 0x2e6e64, 0xd8b45a], [9.37, 0.28, 0xa83a24, 0xe6dcc4],
        [9.55, 0.22, 0xe6dcc4, 0x3a3028], [9.77, 0.26, 0x4b545e, 0xe39b3f]] as const) {
        k.matte.bev(0.12, bh, 0.2, bx, BOOK_Y + bh / 2, -1.82, C(bc), 0.008);
        for (const f of [0.18, 0.78]) k.matte.box(0.124, 0.02, 0.004, bx, BOOK_Y + bh * f, -1.719, C(band));
      }
      k.sheen.bev(0.03, 0.16, 0.12, 9.115, BOOK_Y + 0.08, -1.82, hw, 0.005);       // bookend
      k.matte.bev(0.26, 0.05, 0.2, 9.98, BOOK_Y + 0.025, -1.82, C(0x9c431c), 0.006);
      k.matte.bev(0.22, 0.045, 0.18, 9.97, BOOK_Y + 0.0725, -1.82, C(0x3a4a6a), 0.006, 0.15);  // the novel
    }
    if (own.includes('radio')) {
      // a valve set on a walnut side cabinet: grille, lit dial, two knobs, a whip
      const X = 5.1;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.matte.bev(0.05, 0.06, 0.05, X + sx * 0.2, 0.03, -1.4 + sz * 0.14, C(0x2a1c14), 0.008);
      k.matte.bev(0.52, 0.48, 0.38, X, 0.3, -1.4, C(0x5a3a26), 0.02);
      k.matte.bev(0.56, 0.035, 0.41, X, 0.5575, -1.4, C(0x8a5c38), 0.01);
      k.matte.bev(0.44, 0.13, 0.02, X, 0.44, -1.205, C(0x6a4630), 0.008);
      k.sheen.box(0.1, 0.018, 0.02, X, 0.44, -1.19, hw);
      k.matte.bev(0.44, 0.24, 0.02, X, 0.215, -1.205, C(0x6a4630), 0.008);
      k.sheen.add(UNIT_ICO, 0.018, 0.018, 0.018, X + 0.16, 0.25, -1.19, hw);
      k.matte.bev(0.48, 0.27, 0.22, X, 0.71, -1.43, C(0x7a3424), 0.04);          // the set
      k.matte.bev(0.42, 0.21, 0.012, X, 0.71, -1.318, C(0xe4d6b6), 0.01);
      k.matte.box(0.15, 0.15, 0.006, X - 0.12, 0.71, -1.31, C(0x2a1c14));
      for (let i = 0; i < 5; i++) k.sheen.box(0.15, 0.012, 0.006, X - 0.12, 0.66 + i * 0.025, -1.306, hw);
      k.sheen.box(0.205, 0.11, 0.004, X + 0.1, 0.74, -1.313, hw);
      const dial = new THREE.Mesh(new THREE.PlaneGeometry(0.19, 0.095),
        new THREE.MeshBasicMaterial({ map: dialTexture(), toneMapped: false }));
      dial.position.set(X + 0.1, 0.74, -1.3105);
      g.add(dial);
      k.matte.add(UNIT_BOX, 0.006, 0.085, 0.004, X + 0.13, 0.74, -1.306, C(0xb0241a), 0, 0, 0.25);  // needle
      for (const kx of [X + 0.05, X + 0.15]) {
        k.matte.cyl(0.022, 0.024, 0.025, kx, 0.652, -1.3, C(0x2a1c14), 10, Math.PI / 2);
        k.sheen.cyl(0.01, 0.01, 0.006, kx, 0.652, -1.286, hw, 8, Math.PI / 2);
      }
      k.matte.add(UNIT_RING, 0.08, 0.08, 0.08, X, 0.845, -1.43, C(0x2a1c14));       // carry strap
      const tilt = -0.35, AL = 0.5, ax = X + 0.17, ay = 0.845;
      k.sheen.cyl(0.006, 0.01, AL, ax - Math.sin(tilt) * AL / 2, ay + Math.cos(tilt) * AL / 2, -1.5, C(0xc8ccd0), 6, 0, tilt);
      k.sheen.add(UNIT_ICO, 0.014, 0.014, 0.014, ax - Math.sin(tilt) * AL, ay + Math.cos(tilt) * AL, -1.5, C(0xc8ccd0));
      k.land('pool', 0xffa040, 0.6).quad(0.42, 0.28, X + 0.1, 0.74, -1.3, 'wall');
      k.land('pool', 0xff9a40, 0.32).quad(1.0, 0.8, X, 0.85, WALL_Z + 0.046, 'wall');
      k.land('pool', 0xff9a40, 0.3).quad(0.8, 0.9, X, 0.009, -0.95, 'up');
    }
    if (own.includes('chart')) {
      const chart = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.82),
        new THREE.MeshBasicMaterial({ map: chartTexture(), toneMapped: false }));
      chart.position.set(13.25, 1.5, -1.92);
      g.add(chart);
      for (const sy of [-1, 1]) k.matte.bev(1.4, 0.05, 0.04, 13.25, 1.5 + sy * 0.435, -1.925, DARK, 0.01);
      for (const sx of [-1, 1]) k.matte.bev(0.05, 0.82, 0.04, 13.25 + sx * 0.675, 1.5, -1.925, DARK, 0.01);
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
        k.sheen.bev(0.07, 0.07, 0.045, 13.25 + sx * 0.675, 1.5 + sy * 0.435, -1.922, hw, 0.01);
      }
      k.sheen.bev(0.24, 0.035, 0.01, 13.25, 1.065, -1.902, hw, 0.004);
    }
    k.flush(g);
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
