import * as THREE from 'three';
import { T } from './tiles';

// Shape vocabulary for everything embedded in rock — ore that wants mining and
// heat cracks that don't. Shared by the terrain renderer and the icon baker.
// Every form is faceted and low-poly so flat shading reads the facets hard.

/** de-index and merge transformed geometries into one buffer */
function merge(parts: { geo: THREE.BufferGeometry; m: THREE.Matrix4 }[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const norm: number[] = [];
  for (const { geo, m } of parts) {
    const g = geo.clone().applyMatrix4(m);
    const p = g.attributes.position.array as ArrayLike<number>;
    const n = g.attributes.normal.array as ArrayLike<number>;
    if (g.index) {
      const idx = g.index.array as ArrayLike<number>;
      for (let k = 0; k < idx.length; k++) {
        const i = idx[k];
        pos.push(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
        norm.push(n[i * 3], n[i * 3 + 1], n[i * 3 + 2]);
      }
    } else {
      for (let i = 0; i < p.length; i++) { pos.push(p[i]); norm.push(n[i]); }
    }
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  return out;
}

const mat = (x: number, y: number, z: number, rz = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4()
    .makeRotationZ(rz)
    .premultiply(new THREE.Matrix4().makeScale(sx, sy, sz))
    .setPosition(x, y, z);

// deterministic jitter for the irregular forms
function lump(radius: number, detail: number, amount: number, seed: number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(radius, detail);
  const p = g.attributes.position;
  let s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = 0; i < p.count; i++) {
    const f = 1 + (rnd() - 0.5) * amount;
    p.setXYZ(i, p.getX(i) * f, p.getY(i) * f, p.getZ(i) * f);
  }
  g.computeVertexNormals();
  return g;
}

// ---- ore forms ----

// 0 NUGGET — copper, gold: an irregular metal lump
const NUGGET = lump(0.3, 0, 0.5, 7);

// 1 CLUSTER — iron: cubes grown into each other
const CLUSTER = merge([
  { geo: new THREE.BoxGeometry(0.3, 0.3, 0.3), m: mat(0, 0, 0, 0.3) },
  { geo: new THREE.BoxGeometry(0.2, 0.2, 0.2), m: mat(0.16, 0.12, 0.04, 0.9) },
  { geo: new THREE.BoxGeometry(0.15, 0.15, 0.15), m: mat(-0.14, -0.1, 0.02, 0.5) },
]);

// 2 SHARD — silver, ruby, embershard: a sharp splinter of crystal
const SHARD = (() => {
  const g = new THREE.OctahedronGeometry(0.3, 0);
  g.scale(0.6, 1.7, 0.6);
  return g;
})();

// 3 SWIRL — voidopal: a knotted loop that never sits still
const SWIRL = new THREE.TorusKnotGeometry(0.19, 0.062, 64, 6, 2, 3);

// 4 BLOOM — veinlight: an organic pod of living light
const BLOOM = (() => {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 7; i++) {
    const t = i / 7;
    // bulb profile: narrow stem swelling to a rounded cap
    const r = Math.sin(t * Math.PI) * 0.24 + 0.04;
    pts.push(new THREE.Vector2(r, -0.24 + t * 0.48));
  }
  return new THREE.LatheGeometry(pts, 7);
})();

// 5 BRILLIANT — diamond: crown, girdle and pavilion, cut in eight
const BRILLIANT = new THREE.LatheGeometry([
  new THREE.Vector2(0.001, -0.34),
  new THREE.Vector2(0.27, 0.0),
  new THREE.Vector2(0.23, 0.11),
  new THREE.Vector2(0.11, 0.17),
  new THREE.Vector2(0.001, 0.17),
], 8);

// ---- heat cracks: four branching fissure patterns, flush in the rock face ----
function crack(segs: [number, number, number, number, number][]): THREE.BufferGeometry {
  // each seg: x, y, length, angle, thickness
  return merge(segs.map(([x, y, len, ang, th]) => ({
    geo: new THREE.BoxGeometry(len, th, 0.03),
    m: mat(x, y, 0, ang),
  })));
}
const CRACKS = [
  crack([[0, 0, 0.62, 0.25, 0.035], [0.16, 0.1, 0.3, -0.9, 0.028], [-0.18, -0.08, 0.24, 1.2, 0.025]]),
  crack([[0, 0, 0.5, -1.15, 0.04], [0.06, 0.16, 0.26, 0.35, 0.026], [-0.05, -0.2, 0.22, 0.5, 0.022]]),
  crack([[0, 0.05, 0.44, 0.75, 0.03], [-0.12, -0.1, 0.4, -0.35, 0.032], [0.2, -0.14, 0.2, 1.4, 0.022]]),
  crack([[0, 0, 0.7, -0.12, 0.03], [-0.2, 0.12, 0.28, 1.05, 0.024]]),
];

export const GEM_GEOS: THREE.BufferGeometry[] = [
  NUGGET, CLUSTER, SHARD, SWIRL, BLOOM, BRILLIANT, ...CRACKS,
];

export const CRACK_CLASS_0 = 6;
export const CRACK_VARIANTS = CRACKS.length;

const CLASS: Record<number, number> = {
  [T.COPPER]: 0, [T.GOLD]: 0,
  [T.IRON]: 1,
  [T.SILVER]: 2, [T.RUBY]: 2, [T.EMBERSHARD]: 2,
  [T.VOIDOPAL]: 3,
  [T.FUNGUS]: 4,
  [T.DIAMOND]: 5,
};
export function gemClassOf(t: number): number { return CLASS[t] ?? 0; }

const SCALE: Record<number, number> = {
  [T.FUNGUS]: 0.9, [T.COPPER]: 0.95, [T.IRON]: 0.9, [T.SILVER]: 0.95,
  [T.GOLD]: 1, [T.RUBY]: 1.05, [T.VOIDOPAL]: 1.1, [T.DIAMOND]: 1, [T.EMBERSHARD]: 1.15,
};
export function gemScaleOf(t: number): number { return SCALE[t] ?? 1; }

/** per-class motion character: how fast it turns, how hard it breathes */
export interface Motion { spin: number; pulse: number; wobble: number; }
const MOTION: Motion[] = [
  { spin: 0.35, pulse: 0.04, wobble: 0 },     // nugget: barely turns, it is dead metal
  { spin: 0.4, pulse: 0.04, wobble: 0 },      // cluster
  { spin: 0.55, pulse: 0.07, wobble: 0.05 },  // shard: glints as it turns
  { spin: 1.5, pulse: 0.1, wobble: 0.35 },    // swirl: voidopal never settles
  { spin: 0.25, pulse: 0.18, wobble: 0.12 },  // bloom: slow organic breathing
  { spin: 0.9, pulse: 0.06, wobble: 0.08 },   // brilliant: catches light constantly
];
export function motionOf(cls: number): Motion {
  return MOTION[cls] ?? { spin: 0, pulse: 0, wobble: 0 };
}
