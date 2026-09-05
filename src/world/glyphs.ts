import * as THREE from 'three';
import { smokePuff } from '../game/vaultkit';

// THE NINE STONES — the Lamplighters' alphabet (SPEC-GLYPHS.md §2).
//
// Every glyph is drawn on a 5×5 grid, orthogonal strokes only — the
// Lamplighters own the game's only right angles — with exactly one point
// of light. The Famine is the one glyph whose light is an empty socket;
// the Kindled is the one whose light sits on a stroke. Three stones per
// world, and each world's act of the message matches its place in the
// journey: who we were → what we did → what we ask.

export interface GlyphDef {
  id: string;
  name: string;
  world: 'veil3' | 'cryos2' | 'maelis6';
  /** orthogonal polylines on a 5×5 grid, (0,0) bottom-left */
  strokes: [number, number][][];
  /** the one lit point — null for the Famine's empty socket */
  light: [number, number] | null;
  /** where the socket ring is drawn when light is null */
  socket?: [number, number];
  /** the codex fragment this vault translates */
  fragment: string;
}

export const GLYPHS: GlyphDef[] = [
  {
    id: 'wick', name: 'THE WICK', world: 'veil3',
    strokes: [[[2, 0], [2, 3]]],
    light: [2, 4],
    fragment: 'There was a guild for it, once. Someone to walk the dark and keep the small lights fed. We were never grand. We were maintenance.',
  },
  {
    id: 'famine', name: 'THE FAMINE', world: 'veil3',
    strokes: [[[1, 1], [3, 1], [3, 3], [1, 3], [1, 1]]],
    light: null, socket: [2, 2],
    fragment: 'Then light stopped being a thing you could make more of. Call it a famine; the word is close enough. Every lit thing became a spent thing. The sky went first.',
  },
  {
    id: 'shift', name: 'THE LAST SHIFT', world: 'veil3',
    strokes: [[[0, 4], [1, 4], [1, 3], [2, 3], [2, 2], [3, 2], [3, 1], [4, 1]]],
    light: [4, 1],
    fragment: 'The others left, or stopped. We stayed, because a shift does not end when it is hopeless. It ends when it is relieved. No one relieved us.',
  },
  {
    id: 'vault', name: 'THE VAULT', world: 'cryos2',
    strokes: [[[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]]],
    light: [2, 2],
    fragment: 'You do not save a fire by carrying it with you. You save it by building a room it cannot leave and weather cannot enter.',
  },
  {
    id: 'ember', name: 'THE EMBER', world: 'cryos2',
    strokes: [[[0, 3], [4, 3]]],
    light: [2, 1],
    fragment: 'So we took the last whole light and planted it. Under a world. Deeper than grief. A seed is not stolen goods. A seed is a promise made to soil.',
  },
  {
    id: 'weather', name: 'THE WEATHER', world: 'cryos2',
    strokes: [
      [[0, 4], [1, 4], [1, 3], [2, 3], [2, 4], [3, 4], [3, 3], [4, 3]],
      [[1, 2], [3, 2]],
    ],
    light: [2, 1],
    fragment: 'Everything on a surface is weather eventually — rain, war, forgetting. Depth is the only calm we ever found. We are sorry it is also dark.',
  },
  {
    id: 'debt', name: 'THE DEBT', world: 'maelis6',
    strokes: [
      [[0, 1], [2, 1], [2, 3], [0, 3], [0, 1]],
      [[2, 1], [4, 1], [4, 3], [2, 3]],
    ],
    light: [1, 2], socket: [3, 2],
    fragment: 'Understand what taking it means. The room stays warm exactly as long as the light stays in it. This is not a lock. It is arithmetic.',
  },
  {
    id: 'return', name: 'THE RETURN', world: 'maelis6',
    strokes: [[[1, 4], [1, 1], [3, 1], [3, 4]]],
    light: [2, 1],
    fragment: 'If you have the strength to carry it out, you have the strength to carry it back. One of those makes you rich. The other makes you us.',
  },
  {
    id: 'kindled', name: 'THE KINDLED', world: 'maelis6',
    strokes: [[[2, 0], [2, 3]], [[1, 2], [3, 2]]],
    light: [2, 2],
    fragment: 'Some of us could not leave the light we tended. They set down their bodies like tools at the end of a shift, and stayed. If you meet them, they are not asking for help. They are keeping it company.',
  },
];

export const glyphById = (id: string): GlyphDef | undefined => GLYPHS.find(g => g.id === id);

/** the canonical reading order — old numeric saves grandfather into this */
export const GLYPH_ORDER: string[] = GLYPHS.map(g => g.id);

/** the three stones each world seeds, in ruin order */
export const WORLD_GLYPHS: Record<string, string[]> = {
  veil3: ['wick', 'famine', 'shift'],
  cryos2: ['vault', 'ember', 'weather'],
  maelis6: ['debt', 'return', 'kindled'],
};

// ---------------------------------------------------------------------------
// world-space mark: emissive strokes set into the stone face

/** seconds a stone takes to wake under a standing pilot, and to fall dark again */
export const GLYPH_WAKE = 1.6;
export const GLYPH_FADE = 0.8;

/** the unlit carving: the hue, most of the way down to cold stone */
function dormant(hue: number): number {
  const c = new THREE.Color(hue);
  return c.lerp(new THREE.Color(0x191722), 0.76).getHex();
}

/**
 * Build one glyph mark as a Group: a dim carving that is always readable,
 * and a vivid overlay that draws itself along the strokes as the stone
 * wakes. `size` is the mark's full width in world units.
 *
 * The group carries `userData.setCharge(k)`, k in 0..1 — 0 is cold stone,
 * 1 is a stone fully lit and ready to be stepped into.
 */
export function buildGlyphMark(g: GlyphDef, size: number, color: number, lit: boolean): THREE.Group {
  const group = new THREE.Group();
  const s = size / 4; // grid step: grid spans 0..4
  const thick = size * 0.055;
  const carveMat = new THREE.MeshBasicMaterial({ color: dormant(color), transparent: true, opacity: 0.5 });
  const toLocal = (gx: number, gy: number): [number, number] => [(gx - 2) * s, (gy - 2) * s];

  // every segment in drawing order, with where it starts along the whole path
  const segs: { ax: number; ay: number; bx: number; by: number; len: number; at: number }[] = [];
  let total = 0;
  for (const stroke of g.strokes) {
    for (let i = 1; i < stroke.length; i++) {
      const [ax, ay] = toLocal(stroke[i - 1][0], stroke[i - 1][1]);
      const [bx, by] = toLocal(stroke[i][0], stroke[i][1]);
      const len = Math.hypot(bx - ax, by - ay);
      segs.push({ ax, ay, bx, by, len, at: total });
      total += len;
    }
  }

  // where each whole STROKE ends, as a fraction of the path — the wake
  // sounds one chord note per stroke completed (SPEC-FOLD.md beat 3)
  {
    let at = 0;
    const ends: number[] = [];
    for (const stroke of g.strokes) {
      for (let i = 1; i < stroke.length; i++) {
        const [ax, ay] = toLocal(stroke[i - 1][0], stroke[i - 1][1]);
        const [bx, by] = toLocal(stroke[i][0], stroke[i][1]);
        at += Math.hypot(bx - ax, by - ay);
      }
      ends.push(total === 0 ? 1 : at / total);
    }
    group.userData.strokeEnds = ends;
  }

  const bars: { mesh: THREE.Mesh; horiz: boolean; seg: typeof segs[number] }[] = [];
  for (const seg of segs) {
    const horiz = Math.abs(seg.bx - seg.ax) > Math.abs(seg.by - seg.ay);
    const full = seg.len + thick;
    const geo = () => new THREE.BoxGeometry(horiz ? full : thick, horiz ? thick : full, thick * 0.6);
    // the carving, always there
    const carve = new THREE.Mesh(geo(), carveMat);
    carve.position.set((seg.ax + seg.bx) / 2, (seg.ay + seg.by) / 2, 0);
    group.add(carve);
    // the light, drawn on top and grown from the segment's start
    const bright = new THREE.Mesh(geo(), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 }));
    bright.position.copy(carve.position);
    bright.position.z = thick * 0.25;
    group.add(bright);
    bars.push({ mesh: bright, horiz, seg });
  }

  let dot: THREE.Mesh | null = null;
  let socket: THREE.Mesh | null = null;
  if (g.light) {
    const [lx, ly] = toLocal(g.light[0], g.light[1]);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xfff2d0, transparent: true, opacity: 1 });
    dot = new THREE.Mesh(new THREE.SphereGeometry(thick * 1.35, 10, 8), dotMat);
    dot.position.set(lx, ly, thick * 0.4);
    dot.name = 'glyph-light';
    group.add(dot);
  } else if (g.socket) {
    const [sx, sy] = toLocal(g.socket[0], g.socket[1]);
    // the Famine's empty socket: a ring that never fills, only rims with light
    socket = new THREE.Mesh(new THREE.TorusGeometry(thick * 1.6, thick * 0.45, 8, 20),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 }));
    socket.position.set(sx, sy, thick * 0.4);
    group.add(socket);
  }

  /** k in 0..1: light crawls the path, then the point of light takes */
  const setCharge = (k: number): void => {
    const run = Math.max(0, Math.min(1, k)) * total;
    for (const b of bars) {
      const f = total === 0 ? 1 : Math.max(0, Math.min(1, (run - b.seg.at) / b.seg.len));
      b.mesh.visible = f > 0.002;
      if (!b.mesh.visible) continue;
      if (b.horiz) {
        b.mesh.scale.x = f;
        b.mesh.position.x = b.seg.ax + (b.seg.bx - b.seg.ax) * f / 2;
      } else {
        b.mesh.scale.y = f;
        b.mesh.position.y = b.seg.ay + (b.seg.by - b.seg.ay) * f / 2;
      }
    }
    // the light itself is the last thing to catch
    const tail = Math.max(0, Math.min(1, (k - 0.82) / 0.18));
    if (dot) {
      dot.visible = tail > 0.01;
      (dot.material as THREE.MeshBasicMaterial).opacity = tail;
      dot.scale.setScalar(0.35 + tail * 0.65);
    }
    if (socket) {
      socket.visible = tail > 0.01;
      (socket.material as THREE.MeshBasicMaterial).opacity = tail * 0.95;
    }
  };
  // hungry light: six sparks that converge on the mark while it wakes
  const sparks: THREE.Mesh[] = [];
  const sparkMat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  for (let i = 0; i < 6; i++) {
    const sp = new THREE.Mesh(new THREE.PlaneGeometry(0.045, 0.045), sparkMat);
    sp.position.z = thick * 0.5;
    group.add(sp);
    sparks.push(sp);
  }
  group.userData.sparks = sparks;
  group.userData.sparkMat = sparkMat;

  // THE FAMINE breathes cold: a lit socket glyph smokes instead of shining
  if (!g.light && g.socket) {
    const puffs: THREE.Mesh[] = [];
    const [sx2, sy2] = toLocal(g.socket[0], g.socket[1]);
    for (let i = 0; i < 3; i++) {
      const pf = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16),
        new THREE.MeshBasicMaterial({
          map: smokePuff(), color: 0xbfd4ff, transparent: true, opacity: 0,
          blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
        }));
      pf.position.set(sx2, sy2, thick * 0.5);
      group.add(pf);
      puffs.push(pf);
    }
    group.userData.smoke = puffs;
    group.userData.smokeAt = [sx2, sy2];
  }

  group.userData.setCharge = setCharge;
  setCharge(lit ? 1 : 0);
  return group;
}

/** inline SVG for the codex page (viewBox 0 0 100 100, y flipped) */
export function glyphSvg(g: GlyphDef, cls: string): string {
  const pt = (gx: number, gy: number): string => `${10 + gx * 20},${90 - gy * 20}`;
  const paths = g.strokes.map(st =>
    `<polyline points="${st.map(([x, y]) => pt(x, y)).join(' ')}" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="square" stroke-linejoin="miter"/>`
  ).join('');
  const light = g.light
    ? `<circle cx="${10 + g.light[0] * 20}" cy="${90 - g.light[1] * 20}" r="7" fill="currentColor" class="g-light"/>`
    : g.socket
      ? `<circle cx="${10 + g.socket[0] * 20}" cy="${90 - g.socket[1] * 20}" r="8" fill="none" stroke="currentColor" stroke-width="4"/>`
      : '';
  return `<svg class="${cls}" viewBox="0 0 100 100" aria-hidden="true">${paths}${light}</svg>`;
}

/**
 * The marks standing in the world: one per seeded stone, facing out of the
 * tile. Rebuilt on world change. A stone wakes while the pilot stands at it
 * — the light crawls its strokes and the point of light catches last — and
 * falls cold when they walk off. A translated stone stays lit and breathes.
 */
export class GlyphMarks {
  private group = new THREE.Group();
  private marks: { mesh: THREE.Group; id: string; charge: number; done: boolean; strokes: number }[] = [];

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
  }

  build(stones: { x: number; y: number; id: string }[], color: number, translated: Set<string>): void {
    this.clear();
    for (const s of stones) {
      const g = glyphById(s.id);
      if (!g) continue;
      // a translated stone never goes cold again
      const done = translated.has(s.id);
      const mark = buildGlyphMark(g, 0.66, color, done);
      mark.position.set(s.x + 0.5, -(s.y + 0.5), 0.52);
      // THE HERO STONE (SPEC-FOLD.md §3): the mark is set in architecture —
      // a plinth footing it into the world, two jambs, a bronze crown. A
      // translated stone hangs one small burning finial off the crown: the
      // surface slowly accumulates nine lights, progress told in furniture.
      const stoneMat2 = new THREE.MeshStandardMaterial({ color: 0x6e6878, roughness: 0.85, metalness: 0.05, flatShading: true });
      const bronze2 = new THREE.MeshStandardMaterial({ color: 0xa8874a, roughness: 0.45, metalness: 0.55, flatShading: true });
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.15, 0.16), stoneMat2);
      plinth.position.set(0, -0.83, -0.05);
      const crown = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.13, 0.16), stoneMat2);
      crown.position.set(0, 0.86, -0.05);
      const band = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.045, 0.17), new THREE.MeshStandardMaterial({ color: 0x8e3a28, roughness: 0.6, metalness: 0.15, flatShading: true }));
      band.position.set(0, 0.78, -0.05);
      mark.add(plinth, crown, band);
      for (const kx of [-0.78, 0.78]) {
        const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.56, 0.16), stoneMat2);
        jamb.position.set(kx, 0, -0.05);
        mark.add(jamb);
      }
      if (done) {
        const finial = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), bronze2);
        finial.position.set(0, 0.98, -0.02);
        const flameMat = new THREE.MeshBasicMaterial({
          color: 0xffe0b0, transparent: true, opacity: 0.85,
          blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
        });
        const flame = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.2), flameMat);
        flame.position.set(0, 1.08, 0);
        flame.name = 'stone-finial';
        mark.add(finial, flame);
      }
      this.group.add(mark);
      this.marks.push({ mesh: mark, id: s.id, charge: done ? 1 : 0, done, strokes: 0 });
    }
  }

  /** a stone was just translated: relight it in place */
  refresh(stones: { x: number; y: number; id: string }[], color: number, translated: Set<string>): void {
    this.build(stones, color, translated);
  }

  /** how far along its waking a stone is, 0..1 — 1 means it will take you in */
  chargeOf(id: string): number {
    return this.marks.find(m => m.id === id)?.charge ?? 0;
  }

  /**
   * `nearId` is the stone the pilot is standing at, if any: it wakes while
   * they stay, and every other stone falls back to cold. Returns the id of a
   * stone that finished waking this frame, so the caller can sound it.
   */
  update(time: number, dt = 0, nearId: string | null = null,
    onStroke?: (n: number) => void): string | null {
    let justLit: string | null = null;
    for (const m of this.marks) {
      const was = m.charge;
      if (m.done) m.charge = 1;
      else if (m.id === nearId) m.charge = Math.min(1, m.charge + dt / GLYPH_WAKE);
      else m.charge = Math.max(0, m.charge - dt / GLYPH_FADE);
      if (m.charge !== was) {
        m.mesh.userData.setCharge?.(m.charge);
        if (m.charge >= 1 && was < 1) justLit = m.id;
        // a chord note per whole stroke drawn (the wake, beat 3)
        const ends = m.mesh.userData.strokeEnds as number[] | undefined;
        if (ends && m.charge > was && m.charge < 1) {
          const now = ends.filter(e => m.charge >= e - 1e-4).length;
          if (now > m.strokes) { m.strokes = now; onStroke?.(now); }
        }
        if (m.charge <= 0) m.strokes = 0;
      }
      // only a stone that is fully awake breathes
      if (m.charge >= 1) {
        const dot = m.mesh.getObjectByName('glyph-light') as THREE.Mesh | null;
        if (dot) dot.scale.setScalar(1 + Math.sin(time * 2.1 + m.mesh.position.x) * 0.18);
        const fin = m.mesh.getObjectByName('stone-finial') as THREE.Mesh | null;
        if (fin) fin.scale.y = 1 + Math.sin(time * 3.3 + m.mesh.position.x) * 0.2;
      }
      // hungry light: sparks stream toward a waking mark and are drunk
      const sparks = m.mesh.userData.sparks as THREE.Mesh[] | undefined;
      const sparkMat = m.mesh.userData.sparkMat as THREE.MeshBasicMaterial | undefined;
      if (sparks && sparkMat) {
        const waking = m.charge > 0.02 && m.charge < 1 && m.id === nearId;
        sparkMat.opacity = waking ? 0.75 : Math.max(0, sparkMat.opacity - dt * 3);
        if (sparkMat.opacity > 0.01) {
          for (let i = 0; i < sparks.length; i++) {
            const a = time * 1.4 + i * 2.1;
            const r = 1.25 * (1 - ((time * 0.5 + i * 0.37) % 1));
            sparks[i].position.x = Math.cos(a) * r;
            sparks[i].position.y = Math.sin(a) * r * 0.8;
          }
        }
      }
      // the famine's tell: the finished socket smokes, cold
      const smoke = m.mesh.userData.smoke as THREE.Mesh[] | undefined;
      if (smoke) {
        const at = m.mesh.userData.smokeAt as [number, number];
        for (let i = 0; i < smoke.length; i++) {
          const cyc = (time * 0.35 + i / smoke.length) % 1;
          smoke[i].position.set(at[0] + Math.sin(time + i * 2.4) * 0.05, at[1] + cyc * 0.55, smoke[i].position.z);
          (smoke[i].material as THREE.MeshBasicMaterial).opacity =
            m.charge >= 1 ? 0.3 * Math.sin(cyc * Math.PI) : 0;
          smoke[i].scale.setScalar(0.6 + cyc * 0.9);
        }
      }
    }
    return justLit;
  }

  clear(): void {
    for (const m of this.marks) {
      m.mesh.traverse(o => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose?.();
        (mesh.material as THREE.Material)?.dispose?.();
      });
      this.group.remove(m.mesh);
    }
    this.marks.length = 0;
  }
}
