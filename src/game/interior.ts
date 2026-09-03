import * as THREE from 'three';
import { Suit, buildSuit, poseSuit, suitPoseYOffset } from '../player/suit';
import { Input } from '../player/controller';
import { Meta } from './meta';
import { wallPalette, WING_GALLERY, WING_VIVARIUM } from './furnish';
import { FAUNA, FaunaEntry } from './bestiary';
import { GEM_GEOS, gemScaleOf } from '../world/gemshapes';
import { def as tileDef } from '../world/tiles';
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

interface Station { x: number; r: number; label: string; panel: InteriorPanel | null; }

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
  private consoleDot: THREE.Mesh | null = null;
  private stations: Station[] = [];
  private hud: HTMLDivElement;
  private lastPrompt = '';
  // palette materials, retinted in place when the walls are repainted
  private wallMat = new THREE.MeshStandardMaterial({ roughness: 0.75 });
  private trimMat = new THREE.MeshStandardMaterial({ roughness: 0.55 });
  private floorMat = new THREE.MeshStandardMaterial({ roughness: 0.65, metalness: 0.1 });

  constructor(private ctx: InteriorCtx, aspect: number, ui: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 60);
    this.px = HALL_X0 + 1.6;
    this.cx = this.px;
    this.camera.position.set(this.cx, 1.05, 6.4);
    this.camera.lookAt(this.cx, 0.95, 0);

    this.scene.background = new THREE.Color(0x0e0b09);
    this.scene.add(new THREE.HemisphereLight(0xffd9b0, 0x2a2a30, 1.05));

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
  }

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
  }

  // ---------------- the room ----------------

  /** tear down and re-dress the whole room from meta — cheap at this scale */
  rebuild(): void {
    this.roomGroup.traverse(o => (o as THREE.Mesh).geometry?.dispose?.());
    this.roomGroup.clear();
    this.forms = [];
    this.gems = [];
    this.consoleDot = null;
    this.stations = [];
    this.applyPalette();

    const own = this.ctx.meta.furnishings;
    const galleryOpen = own.includes(WING_GALLERY);
    const vivariumOpen = own.includes(WING_VIVARIUM);
    const endX = this.maxX();
    const g = this.roomGroup;
    const W = VIVARIUM_X1 + 1;
    const CX = W / 2;

    // shell: floor, back wall, ceiling, trim — built full-width; sealed
    // hatches close off whatever isn't owned yet
    g.add(box(W, 0.2, 3.4, this.floorMat, CX, -0.1, -0.4));
    g.add(box(W, 3.2, 0.15, this.wallMat, CX, 1.5, -2.06));
    g.add(box(W, 0.15, 3.4, DARKPIPE, CX, CEIL + 0.42, -0.4));
    // warm practicals, hall first, then whichever wings exist
    const lampXs = [6, 14, 20];
    if (galleryOpen) lampXs.push(26, 32);
    if (galleryOpen && vivariumOpen) lampXs.push(38, 44);
    for (const lx of lampXs) {
      const warm = new THREE.PointLight(0xffd9a0, 4, 9, 1.8);
      warm.position.set(lx, 1.9, 1.0);
      g.add(warm);
    }
    g.add(box(W, 0.12, 0.03, this.trimMat, CX, 0.06, -1.97));
    g.add(box(W, 0.07, 0.03, this.trimMat, CX, CEIL + 0.24, -1.97));
    for (let rx = HALL_X0 + 3.5; rx < VIVARIUM_X1; rx += 3.5) {
      g.add(box(0.14, CEIL + 0.35, 0.1, DARKPIPE, rx, (CEIL + 0.35) / 2, -1.98));
    }
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

    this.buildStations(g);
    this.buildFurnishings(g, own);
    this.buildWingDoor(g, HALL_X1, galleryOpen, 'THE GALLERY');
    if (galleryOpen) this.buildGallery(g);
    this.buildWingDoor(g, GALLERY_X1, vivariumOpen, 'THE VIVARIUM', !galleryOpen);
    if (galleryOpen && vivariumOpen) this.buildVivarium(g);

    // exit + sealed-door prompts join the station list
    this.stations.push({ x: HALL_X0 + 0.2, r: 1.0, label: 'STEP OUT', panel: null });
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
      g.add(box(0.4, 0.26, 0.34, TEAL_PAINT, 2.4, 0.15, -1.3));
      for (const [fx, fh] of [[2.32, 0.35], [2.4, 0.46], [2.48, 0.32]] as const) {
        const frond = new THREE.Mesh(new THREE.ConeGeometry(0.07, fh, 6), FERN);
        frond.position.set(fx, 0.28 + fh / 2, -1.3);
        g.add(frond);
      }
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
      g.add(box(1.1, 0.05, 0.3, this.trimMat, 10.5, 1.55, -1.85));
      for (const [bx, bh, bc] of [[10.15, 0.24, 0x2e6e64], [10.32, 0.28, 0xa83a24], [10.5, 0.22, 0xe6dcc4], [10.72, 0.26, 0x4b545e]] as const) {
        g.add(box(0.12, bh, 0.2, new THREE.MeshStandardMaterial({ color: bc, roughness: 0.8 }), bx, 1.58 + bh / 2, -1.82));
      }
      const flat = box(0.26, 0.1, 0.2, new THREE.MeshStandardMaterial({ color: 0x9c431c, roughness: 0.8 }), 10.98, 1.63, -1.82);
      g.add(flat);
    }
    if (own.includes('radio')) {
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
      chart.position.set(14.6, 1.5, -1.95);
      g.add(chart);
      g.add(box(1.38, 0.05, 0.04, DARKPIPE, 14.6, 1.93, -1.94));
      g.add(box(1.38, 0.05, 0.04, DARKPIPE, 14.6, 1.07, -1.94));
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

  private buildGallery(g: THREE.Group): void {
    // six pedestals; the six most valuable kept stones stand on them
    const sorted = [...this.ctx.meta.trophies]
      .sort((a, b) => (tileDef(b.t).value * b.grade) - (tileDef(a.t).value * a.grade))
      .slice(0, 6);
    for (let i = 0; i < 6; i++) {
      const px = HALL_X1 + 1.7 + i * 1.95;
      g.add(cyl(0.3, 0.1, GUNMETAL, px, 0.05, -1.1, 16));
      g.add(cyl(0.22, 0.85, PLINTH, px, 0.52, -1.1, 12));
      g.add(cyl(0.28, 0.06, GUNMETAL, px, 0.97, -1.1, 16));
      const trophy = sorted[i];
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
      const gem = new THREE.Mesh(GEM_GEOS[5], mat);   // BRILLIANT — the display cut
      const s = (trophy.grade >= 2 ? 0.62 : 0.5) * gemScaleOf(trophy.t) * 1.6;
      gem.scale.setScalar(Math.max(0.34, s));
      gem.position.set(px, 1.28, -1.1);
      g.add(gem);
      this.gems.push(gem);
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
    if (s.panel) this.ctx.openPanel(s.panel);
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
    this.hud.remove();
    this.scene.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose?.();
    });
  }
}
