import * as THREE from 'three';
import { GlyphDef } from '../world/glyphs';

// THE FOLD (SPEC-FOLD.md) — the threshold is topology, never teleportation.
//
// The stone does not open a door; the word unfolds. Five coffered frames
// recede into the rock in reading order, the glyph's own strokes stretch
// inward to become the corridor's seams, and one warm ember waits at the
// bottom of the throat — the entry sconce, promised before it is met.
//
// Everything draws with depth-testing OFF at a high render order: the
// throat is a picture of depth painted over the dig face, so it can never
// z-fight the terrain it pretends to tunnel through. Perceived recession
// is scale + darkening, not actual z — cheaper, and it can never clip.

export interface FoldThroat {
  group: THREE.Group;
  /** k in 0..1 — 0 sealed stone, 1 fully unfolded throat */
  update(k: number): void;
  dispose(): void;
}

const FRAMES = 5;

/** stone settles, light snaps: the one easing the fold's stagger uses */
const settle = (t: number): number => {
  const p = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - p, 3);
};

export function buildFoldThroat(g: GlyphDef, hue: number): FoldThroat {
  const group = new THREE.Group();
  const mats: THREE.Material[] = [];
  const geos: THREE.BufferGeometry[] = [];
  const mk = <T extends THREE.Material>(m: T): T => { mats.push(m); return m; };
  const gm = <T extends THREE.BufferGeometry>(x: T): T => { geos.push(x); return x; };

  // the black behind the world: the fold's first act is to unmake the wall
  const backMat = mk(new THREE.MeshBasicMaterial({
    color: 0x050308, transparent: true, opacity: 0, depthTest: false, depthWrite: false,
  }));
  const back = new THREE.Mesh(gm(new THREE.PlaneGeometry(3.4, 3.4)), backMat);
  back.renderOrder = 40;
  group.add(back);

  // the coffered frames, largest first — each a dark square with a rim of
  // the world's own note along its edges
  const frames: {
    fill: THREE.Mesh; fillMat: THREE.MeshBasicMaterial;
    edges: THREE.Mesh[]; edgeMat: THREE.MeshBasicMaterial;
    size: number;
  }[] = [];
  for (let i = 0; i < FRAMES; i++) {
    const size = 3.0 - i * 0.14;
    const shade = 0x16100f - i * 0x040302;
    const fillMat = mk(new THREE.MeshBasicMaterial({
      color: Math.max(0x020103, shade), transparent: true, opacity: 0,
      depthTest: false, depthWrite: false,
    }));
    const fill = new THREE.Mesh(gm(new THREE.PlaneGeometry(size, size)), fillMat);
    fill.renderOrder = 41 + i;
    group.add(fill);
    const edgeMat = mk(new THREE.MeshBasicMaterial({
      color: hue, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, toneMapped: false,
    }));
    const edges: THREE.Mesh[] = [];
    for (const [ex, ey, w, h] of [
      [0, size / 2, size, 0.035], [0, -size / 2, size, 0.035],
      [-size / 2, 0, 0.035, size], [size / 2, 0, 0.035, size],
    ] as const) {
      const e = new THREE.Mesh(gm(new THREE.PlaneGeometry(w, h)), edgeMat);
      e.position.set(ex, ey, 0.001 * (i + 1));
      e.renderOrder = 41 + i;
      edges.push(e);
      group.add(e);
    }
    frames.push({ fill, fillMat, edges, edgeMat, size });
  }

  // the strokes, extruded: the mark's own segments as seams running down
  // the throat — the word literally becoming the room's lattice
  const s = 0.66 / 4;
  const strokeMat = mk(new THREE.MeshBasicMaterial({
    color: hue, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, toneMapped: false,
  }));
  const strokeGroup = new THREE.Group();
  for (const stroke of g.strokes) {
    for (let i = 1; i < stroke.length; i++) {
      const ax = (stroke[i - 1][0] - 2) * s, ay = (stroke[i - 1][1] - 2) * s;
      const bx = (stroke[i][0] - 2) * s, by = (stroke[i][1] - 2) * s;
      const horiz = Math.abs(bx - ax) > Math.abs(by - ay);
      const len = Math.hypot(bx - ax, by - ay) + 0.05;
      const seg = new THREE.Mesh(
        gm(new THREE.PlaneGeometry(horiz ? len : 0.045, horiz ? 0.045 : len)), strokeMat);
      seg.position.set((ax + bx) / 2, (ay + by) / 2, 0.01);
      seg.renderOrder = 47;
      strokeGroup.add(seg);
    }
  }
  group.add(strokeGroup);

  // the ember at the bottom of the throat: the entry sconce, promised
  const emberMat = mk(new THREE.MeshBasicMaterial({
    color: 0xff9a50, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, toneMapped: false,
  }));
  const ember = new THREE.Mesh(gm(new THREE.PlaneGeometry(0.16, 0.05)), emberMat);
  ember.position.z = 0.02;
  ember.renderOrder = 48;
  group.add(ember);

  const update = (k: number): void => {
    const kk = Math.max(0, Math.min(1, k));
    backMat.opacity = Math.min(1, kk * 4) * 0.96;
    for (let i = 0; i < FRAMES; i++) {
      // reading order: the shallow course moves first, the deep one last
      const fi = settle(kk * (FRAMES + 1) / FRAMES - i / FRAMES);
      const f = frames[i];
      const sc = 1 - fi * (0.16 + i * 0.15);       // deeper courses shrink further
      f.fill.scale.setScalar(sc);
      for (const e of f.edges) e.scale.setScalar(sc);
      f.fillMat.opacity = fi * 0.98;
      f.edgeMat.opacity = fi * (0.5 - i * 0.06);
    }
    // the word stretches inward through the second half
    const sk = settle((kk - 0.35) / 0.65);
    strokeGroup.scale.setScalar(1 - sk * 0.62);
    strokeMat.opacity = sk * 0.8;
    emberMat.opacity = Math.max(0, (kk - 0.7) / 0.3) * 0.9;
    ember.scale.setScalar(0.5 + kk * 0.5);
  };
  update(0);

  return {
    group,
    update,
    dispose(): void {
      group.parent?.remove(group);
      for (const m of mats) m.dispose();
      for (const geo of geos) geo.dispose();
    },
  };
}
