import * as THREE from 'three';
import { GlyphDef } from '../world/glyphs';
import { softDisc } from '../game/vaultkit';

// THE FOLD (SPEC-FOLD.md) — the threshold is topology, never teleportation.
//
// The stone does not open a door; the word unfolds. The world irises down
// to a warm pool around the stone, a flare ring breaks off the mark, five
// coffered frames recede in reading order shedding dust as they go, the
// glyph's own strokes STREAM inward — the word pulling you through itself
// — and one ember waits at the bottom of the throat.
//
// Two builds from one kit:
//   surface (default) — depth-test OFF at high render order: a picture of
//     depth painted over the dig face, sized to own the frame with the
//     dolly. Ephemeral: built at E, disposed on the cut.
//   interior — depth-test ON, tucked behind the play plane at the vault's
//     entry: the same throat seen from the other side. It arrives OPEN,
//     closes to a dim standing doorframe behind you, and brightens again
//     as the body comes near — the way out, promised the whole run.

export interface FoldThroat {
  group: THREE.Group;
  /** k 0..1 (sealed → fully unfolded); time drives the streaming strokes */
  update(k: number, time?: number): void;
  dispose(): void;
}

const FRAMES = 5;

const settle = (t: number): number => {
  const p = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - p, 3);
};

export function buildFoldThroat(g: GlyphDef, hue: number, interior = false): FoldThroat {
  const group = new THREE.Group();
  const mats: THREE.Material[] = [];
  const geos: THREE.BufferGeometry[] = [];
  const mk = <T extends THREE.Material>(m: T): T => { mats.push(m); return m; };
  const gm = <T extends THREE.BufferGeometry>(x: T): T => { geos.push(x); return x; };
  const depthTest = interior;
  const ro = interior ? 0 : 40;
  const zi = (n: number): number => interior ? -n * 0.012 : 0.001 * n;
  const SIZE = interior ? 2.6 : 4.4;

  // the iris: the world falls away to a warm pool around the stone —
  // surface only; inside a vault the dark is already everywhere
  let irisMat: THREE.MeshBasicMaterial | null = null;
  let haloMat: THREE.MeshBasicMaterial | null = null;
  if (!interior) {
    // depth-tested and pushed just in front of the terrain: the mine dims
    // behind it, and every REAL brick that tears loose crosses its plane
    // and pops out in front — flying out of the darkness at the glass
    irisMat = mk(new THREE.MeshBasicMaterial({
      color: 0x020104, transparent: true, opacity: 0, depthTest: true, depthWrite: false,
    }));
    const iris = new THREE.Mesh(gm(new THREE.PlaneGeometry(90, 60)), irisMat);
    iris.renderOrder = ro - 2;
    iris.position.z = 1.5;
    group.add(iris);
    haloMat = mk(new THREE.MeshBasicMaterial({
      map: softDisc(), color: 0x3a2c20, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, toneMapped: false,
    }));
    const halo = new THREE.Mesh(gm(new THREE.PlaneGeometry(14, 14)), haloMat);
    halo.renderOrder = ro - 1;
    group.add(halo);
  }

  // (the mine itself breaks apart out in main — ChunkField.foldShatter
  //  throws the REAL bricks; this kit only paints the throat)

  // the black behind the world
  const backMat = mk(new THREE.MeshBasicMaterial({
    color: 0x050308, transparent: true, opacity: 0, depthTest, depthWrite: false,
  }));
  const back = new THREE.Mesh(gm(new THREE.PlaneGeometry(SIZE * 1.15, SIZE * 1.15)), backMat);
  back.renderOrder = ro;
  back.position.z = zi(0);
  group.add(back);

  // the flare ring: the moment the point of light takes, a breath breaks
  // off the mark and runs outward
  const ringMat = mk(new THREE.MeshBasicMaterial({
    color: hue, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthTest, depthWrite: false, toneMapped: false,
    side: THREE.DoubleSide,
  }));
  const ring = new THREE.Mesh(gm(new THREE.RingGeometry(0.94, 1, 40)), ringMat);
  ring.renderOrder = ro + 8;
  ring.position.z = zi(-1);
  group.add(ring);

  // the coffered frames, largest first — dark squares rimmed in the note
  const frames: {
    fill: THREE.Mesh; fillMat: THREE.MeshBasicMaterial;
    edges: THREE.Mesh[]; edgeMat: THREE.MeshBasicMaterial;
  }[] = [];
  for (let i = 0; i < FRAMES; i++) {
    const size = SIZE - i * SIZE * 0.045;
    const shade = 0x16100f - i * 0x040302;
    const fillMat = mk(new THREE.MeshBasicMaterial({
      color: Math.max(0x020103, shade), transparent: true, opacity: 0,
      depthTest, depthWrite: false,
    }));
    const fill = new THREE.Mesh(gm(new THREE.PlaneGeometry(size, size)), fillMat);
    fill.renderOrder = ro + 1 + i;
    fill.position.z = zi(i + 1);
    group.add(fill);
    const edgeMat = mk(new THREE.MeshBasicMaterial({
      color: hue, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthTest, depthWrite: false, toneMapped: false,
    }));
    const edges: THREE.Mesh[] = [];
    for (const [ex, ey, w, h] of [
      [0, size / 2, size, 0.045], [0, -size / 2, size, 0.045],
      [-size / 2, 0, 0.045, size], [size / 2, 0, 0.045, size],
    ] as const) {
      const e = new THREE.Mesh(gm(new THREE.PlaneGeometry(w, h)), edgeMat);
      e.position.set(ex, ey, zi(i + 1) + (interior ? 0 : 0.0005));
      e.renderOrder = ro + 1 + i;
      edges.push(e);
      group.add(e);
    }
    frames.push({ fill, fillMat, edges, edgeMat });
  }

  // the dust the courses shed as they go — stone giving way, told small
  const dustMat = mk(new THREE.MeshBasicMaterial({
    color: 0xa9917a, transparent: true, opacity: 0, depthTest, depthWrite: false,
  }));
  const dust: { mesh: THREE.Mesh; x: number; y0: number; v: number; ph: number }[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new THREE.Mesh(gm(new THREE.PlaneGeometry(0.035, 0.05)), dustMat);
    const x = (Math.sin(i * 12.9898) * 43758.5453 % 1) * SIZE - SIZE / 2;
    const y0 = ((Math.sin(i * 78.233) * 12543.2 % 1) * 0.5 + 0.45) * SIZE / 2;
    d.position.set(x, y0, zi(-1));
    d.renderOrder = ro + 7;
    dust.push({ mesh: d, x, y0, v: 0.8 + (i % 5) * 0.3, ph: i * 0.7 });
    group.add(d);
  }

  // the strokes, STREAMING: three echoes of the word flowing down the
  // throat — the word pulling you through itself
  const s = (SIZE * 0.42) / 4;
  const streamMats: THREE.MeshBasicMaterial[] = [];
  const streams: THREE.Group[] = [];
  for (let rep = 0; rep < 3; rep++) {
    const sm = mk(new THREE.MeshBasicMaterial({
      color: hue, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthTest, depthWrite: false, toneMapped: false,
    }));
    streamMats.push(sm);
    const sg = new THREE.Group();
    for (const stroke of g.strokes) {
      for (let i = 1; i < stroke.length; i++) {
        const ax = (stroke[i - 1][0] - 2) * s, ay = (stroke[i - 1][1] - 2) * s;
        const bx = (stroke[i][0] - 2) * s, by = (stroke[i][1] - 2) * s;
        const horiz = Math.abs(bx - ax) > Math.abs(by - ay);
        const len = Math.hypot(bx - ax, by - ay) + 0.06;
        const seg = new THREE.Mesh(
          gm(new THREE.PlaneGeometry(horiz ? len : 0.05, horiz ? 0.05 : len)), sm);
        seg.position.set((ax + bx) / 2, (ay + by) / 2, zi(-2));
        seg.renderOrder = ro + 7;
        sg.add(seg);
      }
    }
    group.add(sg);
    streams.push(sg);
  }

  // the ember at the bottom of the throat: the entry sconce, promised
  const emberMat = mk(new THREE.MeshBasicMaterial({
    color: 0xff9a50, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthTest, depthWrite: false, toneMapped: false,
  }));
  const ember = new THREE.Mesh(gm(new THREE.PlaneGeometry(0.2, 0.06)), emberMat);
  ember.position.z = zi(-3);
  ember.renderOrder = ro + 8;
  group.add(ember);

  const update = (k: number, time = 0): void => {
    const kk = Math.max(0, Math.min(1, k));
    if (irisMat) irisMat.opacity = settle(kk * 1.6) * 0.9;
    if (haloMat) haloMat.opacity = settle(kk * 1.6) * 0.5;
    backMat.opacity = Math.min(1, kk * 4) * 0.97;
    // the flare: born in the first sixth, gone by the third
    const fl = kk / 0.32;
    ringMat.opacity = fl < 1 ? Math.sin(Math.min(1, fl) * Math.PI) * 0.7 : 0;
    ring.scale.setScalar(0.2 + settle(fl) * (interior ? 1.6 : 3.2));
    for (let i = 0; i < FRAMES; i++) {
      const fi = settle(kk * (FRAMES + 1) / FRAMES - i / FRAMES);
      const f = frames[i];
      const sc = 1 - fi * (0.16 + i * 0.155);
      f.fill.scale.setScalar(sc);
      for (const e of f.edges) e.scale.setScalar(sc);
      f.fillMat.opacity = fi * 0.985;
      f.edgeMat.opacity = fi * (0.55 - i * 0.07);
    }
    dustMat.opacity = kk > 0.05 && kk < 0.9 ? 0.55 : Math.max(0, dustMat.opacity - 0.05);
    for (const d of dust) {
      const fall = ((time * d.v + d.ph) % 1.4);
      d.mesh.position.y = d.y0 - fall * SIZE * 0.55;
      d.mesh.position.x = d.x + Math.sin(time * 3 + d.ph) * 0.03;
    }
    // the word streams inward through the middle of the sequence
    const sk = settle((kk - 0.25) / 0.75);
    for (let rep = 0; rep < 3; rep++) {
      const flow = (time * 0.5 + rep / 3) % 1;
      streams[rep].scale.setScalar(Math.max(0.06, 1 - flow * 0.8));
      streamMats[rep].opacity = sk * 0.65 * Math.sin(flow * Math.PI);
    }
    emberMat.opacity = Math.max(0, (kk - 0.65) / 0.35) * 0.95;
    ember.scale.setScalar(0.5 + kk * 0.5 + Math.sin(time * 6) * 0.06 * kk);
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
