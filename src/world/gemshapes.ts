import * as THREE from 'three';
import { T } from './tiles';
import { ACTIVE } from './worlds';

// Shape vocabulary for everything embedded in rock — one form per mineral,
// rebuilt to the reference sheets in reference-art/minerals. Thirteen ores,
// thirteen silhouettes: at one tile, mid-drill, in the dark, the SHAPE is
// what tells silver from diamond and copper from gold, because color alone
// cannot. Shared by the terrain renderer, the icon baker and the spill site.
//
// Every form is faceted and low-poly so flat shading reads the facets hard,
// and every form carries a per-vertex tint (default white) that multiplies
// the instance color — that is how a copper crust goes dark around glowing
// windows and an embershard's fissures burn inside a black star without the
// renderer ever needing a second material. Materials that draw these MUST
// set vertexColors: true, or the tints are ignored; a material that asks for
// vertexColors against a geometry without the attribute renders black, which
// is why every geometry here leaves through finish() or merge().

/** de-index and merge transformed geometries into one buffer, colors kept */
function merge(parts: { geo: THREE.BufferGeometry; m: THREE.Matrix4 }[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const norm: number[] = [];
  const col: number[] = [];
  for (const { geo, m } of parts) {
    const g = geo.clone().applyMatrix4(m);
    const p = g.attributes.position.array as ArrayLike<number>;
    const n = g.attributes.normal.array as ArrayLike<number>;
    const c = g.attributes.color?.array as ArrayLike<number> | undefined;
    const push = (i: number) => {
      pos.push(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
      norm.push(n[i * 3], n[i * 3 + 1], n[i * 3 + 2]);
      if (c) col.push(c[i * 3], c[i * 3 + 1], c[i * 3 + 2]);
      else col.push(1, 1, 1);
    };
    if (g.index) {
      const idx = g.index.array as ArrayLike<number>;
      for (let k = 0; k < idx.length; k++) push(idx[k]);
    } else {
      for (let i = 0; i < p.length / 3; i++) push(i);
    }
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}

/** guarantee a color attribute on a single-part form */
function finish(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  if (!geo.attributes.color) paint(geo, 1);
  return geo;
}

/** uniform vertex tint — a multiplier on the instance color, so 1 is "as dyed" */
function paint(geo: THREE.BufferGeometry, v: number): THREE.BufferGeometry {
  const n = geo.attributes.position.count;
  const c = new Float32Array(n * 3).fill(v);
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}

/** tint graded along local Y, before any transform: y0 -> v0, y1 -> v1 */
function paintY(geo: THREE.BufferGeometry, y0: number, v0: number, y1: number, v1: number): THREE.BufferGeometry {
  const p = geo.attributes.position;
  const c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const t = Math.max(0, Math.min(1, (p.getY(i) - y0) / (y1 - y0)));
    const v = v0 + (v1 - v0) * t;
    c[i * 3] = v; c[i * 3 + 1] = v; c[i * 3 + 2] = v;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}

const mat = (x: number, y: number, z: number, rz = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4()
    .makeRotationZ(rz)
    .premultiply(new THREE.Matrix4().makeScale(sx, sy, sz))
    .setPosition(x, y, z);

/** full placement: position, euler rotation, non-uniform scale */
const pose = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz),
  );

/** a part carried out along a direction and turned to face it */
const along = (dir: THREE.Vector3, dist: number) =>
  new THREE.Matrix4().compose(
    dir.clone().multiplyScalar(dist),
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()),
    new THREE.Vector3(1, 1, 1),
  );

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

// ---- ore forms, one per mineral ----

// 0 COPPER — a lump grown shut inside a dark patina crust, glowing cells
// showing through where the crust failed. Cheap ore, closed form.
const COPPER_CRUST = (() => {
  // low jitter: the crust must read as one closed stone, not shrapnel
  const parts = [{ geo: paint(lump(0.28, 1, 0.12, 7), 0.36), m: pose(0, 0, 0) }];
  for (let i = 0; i < 6; i++) {
    const a = i * 2.399;
    const e = ((i % 3) - 1) * 0.6;
    const d = new THREE.Vector3(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e));
    parts.push({ geo: paint(new THREE.IcosahedronGeometry(0.1, 0), 1.5), m: along(d, 0.24) });
  }
  return merge(parts);
})();

// 1 IRON — one heavy cube split along its cleavage, the working ore of the
// whole economy: blocky, dumb, honest. The seams read as dark cracks.
const IRON_CUBE = merge([
  { geo: paint(new THREE.BoxGeometry(0.44, 0.2, 0.4), 0.92), m: pose(0, -0.13, 0) },
  { geo: paint(new THREE.BoxGeometry(0.2, 0.22, 0.4), 1.0), m: pose(-0.115, 0.09, 0, 0, 0, 0.06) },
  { geo: paint(new THREE.BoxGeometry(0.19, 0.2, 0.38), 0.76), m: pose(0.12, 0.08, 0.01, 0, 0, -0.09) },
  { geo: paint(new THREE.BoxGeometry(0.15, 0.15, 0.15), 1.06), m: pose(0.17, 0.2, 0.04, 0.2, 0, 0.35) },
]);

// 2 SILVER — a fan of thin blades rising out of the rock, mirror-bright.
// Blades, never a single stone: that is what keeps it from reading diamond.
const SILVER_FAN = (() => {
  const parts: { geo: THREE.BufferGeometry; m: THREE.Matrix4 }[] = [];
  const heights = [0.3, 0.44, 0.56, 0.48, 0.38, 0.28];
  for (let i = 0; i < 6; i++) {
    const a = -0.8 + i * 0.32;
    const h = heights[i];
    const blade = new THREE.OctahedronGeometry(1, 0);
    paint(blade, i % 2 ? 0.85 : 1.08);
    parts.push({
      geo: blade,
      m: pose(Math.sin(a) * 0.24, h * 0.32 - 0.16, (i % 3 - 1) * 0.05, 0, 0, -a, 0.062, h * 0.5, 0.045),
    });
  }
  return merge(parts);
})();

// 3 GOLD — one heavy lobed nugget, bright everywhere: where copper hides its
// value inside a crust, gold IS the value. Two rounded lobes grown together,
// the small one riding the big one's shoulder, nothing sharp anywhere.
const GOLD_HEART = merge([
  { geo: paint(lump(0.24, 1, 0.18, 5), 1.12), m: pose(-0.03, -0.02, 0, 0, 0, 0, 1.15, 0.92, 1) },
  { geo: paint(lump(0.14, 1, 0.2, 19), 1.2), m: pose(0.17, 0.14, 0.03) },
  { geo: paint(lump(0.09, 0, 0.25, 23), 0.95), m: pose(-0.2, 0.12, -0.04) },
]);

// 4 RUBY — a fat beveled dome with a small twin: the first stone down the
// column that reads treasure rather than metal.
const RUBY_DOME = merge([
  { geo: paint(new THREE.IcosahedronGeometry(0.27, 0), 1.0), m: pose(-0.03, 0, 0, 0, 0.3, 0, 1, 0.78, 0.9) },
  { geo: paint(new THREE.IcosahedronGeometry(0.14, 0), 0.9), m: pose(0.2, -0.09, 0.05, 0, 0, 0.25) },
]);

// 5 VOIDOPAL — a seated egg of iridescent panels. It never sits still, and
// the egg is the point: the mimic hatches, and now you know why.
const OPAL_EGG = finish(
  (() => {
    const g = lump(0.24, 1, 0.11, 13);
    g.scale(0.85, 1.18, 0.85);
    return g;
  })(),
);

// 6 DIAMOND — one large marquise: crown, girdle and pavilion drawn to two
// hard points. A single cut stone against silver's raw blades.
const DIAMOND_MARQUISE = finish(new THREE.LatheGeometry([
  new THREE.Vector2(0.001, -0.42),
  new THREE.Vector2(0.15, -0.14),
  new THREE.Vector2(0.185, -0.02),
  new THREE.Vector2(0.185, 0.05),
  new THREE.Vector2(0.14, 0.16),
  new THREE.Vector2(0.001, 0.44),
], 6));

// 7 EMBERSHARD — a piece of a shattered star, and it is star-shaped: black
// spikes off a black core, every joint split by a glowing fissure. The tint
// gradient does the fire — bright where the spikes root, dead at the tips.
const EMBER_STAR = (() => {
  const parts = [{ geo: paint(new THREE.OctahedronGeometry(0.16, 0), 0.42), m: pose(0, 0, 0) }];
  const dirs = [
    new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1),
    new THREE.Vector3(0.7, 0.55, 0.5).normalize(), new THREE.Vector3(-0.6, -0.5, -0.65).normalize(),
  ];
  dirs.forEach((d, i) => {
    const big = i < 6;
    const spike = new THREE.OctahedronGeometry(1, 0);
    paintY(spike, -1, 1.35, 1, 0.38);
    parts.push({
      geo: spike,
      m: new THREE.Matrix4().compose(
        d.clone().multiplyScalar(big ? 0.2 : 0.15),
        new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d),
        new THREE.Vector3(big ? 0.055 : 0.04, big ? 0.24 : 0.16, big ? 0.055 : 0.04),
      ),
    });
  });
  return merge(parts);
})();

// 8 VEINLIGHT — living pods of light, brightest at the root where the rock
// feeds them. Organic against everything crystalline around it.
const VEIN_PODS = (() => {
  const bulb = (h: number): THREE.BufferGeometry => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 7; i++) {
      const t = i / 7;
      const r = Math.sin(t * Math.PI) * 0.24 + 0.04;
      pts.push(new THREE.Vector2(r, -h / 2 + t * h));
    }
    const g = new THREE.LatheGeometry(pts, 7);
    return paintY(g, -h / 2, 1.3, h / 2, 0.62);
  };
  return merge([
    { geo: bulb(0.48), m: pose(0, 0.02, 0) },
    { geo: bulb(0.48), m: pose(-0.17, -0.08, 0.03, 0, 0, 0.35, 0.6) },
    { geo: bulb(0.48), m: pose(0.17, -0.1, -0.02, 0, 0, -0.4, 0.52) },
  ]);
})();

// 9 FROSTBLOOM — an urchin burst of needles off one bright point, radiating
// every direction the way veinlight's pods never do. It looks like it would
// hurt to touch, because it would.
const FROST_BURST = (() => {
  const parts = [{ geo: paint(new THREE.IcosahedronGeometry(0.075, 0), 1.25), m: pose(0, 0, 0) }];
  const ico = new THREE.IcosahedronGeometry(1, 0);
  const seen = new Set<string>();
  const p = ico.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const d = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)).normalize();
    const key = d.toArray().map(v => v.toFixed(2)).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    const len = 0.3 + (seen.size % 3) * 0.055;
    const needle = new THREE.OctahedronGeometry(1, 0);
    paintY(needle, -1, 1.1, 1, 0.55);
    parts.push({
      geo: needle,
      m: new THREE.Matrix4().compose(
        d.clone().multiplyScalar(len * 0.5),
        new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d),
        new THREE.Vector3(0.03, len * 0.5, 0.03),
      ),
    });
  }
  ico.dispose();
  return merge(parts);
})();

// 10 RIME SALT — a low crusted slab of fused salt cubes, frosted bright on
// their tops. A seam, not a jewel: it reads as something scraped, and it is.
const SALT_CRUST = merge([
  { geo: paintY(new THREE.BoxGeometry(0.3, 0.24, 0.3), -0.12, 0.72, 0.12, 1.18), m: pose(0, -0.05, 0, 0, 0.2, 0) },
  { geo: paintY(new THREE.BoxGeometry(0.2, 0.3, 0.22), -0.15, 0.72, 0.15, 1.18), m: pose(0.17, -0.02, 0.03, 0, 0, 0.1) },
  { geo: paintY(new THREE.BoxGeometry(0.17, 0.17, 0.2), -0.09, 0.72, 0.09, 1.18), m: pose(-0.19, -0.1, -0.02, 0, 0, -0.12) },
]);

// 11 NACRE — a fan of overlapping shell plates around one hinge, secreted
// rather than grown. Nothing else down here has a curve like it.
const NACRE_FAN = (() => {
  const parts: { geo: THREE.BufferGeometry; m: THREE.Matrix4 }[] = [];
  const hx = -0.14, hy = -0.18; // the hinge every plate grows from
  for (let i = 0; i < 5; i++) {
    const a = 1.25 - i * 0.38;             // sweep from upright down to flat
    const len = 0.16 + i * 0.028;          // outer plates are the older, bigger ones
    const plate = new THREE.IcosahedronGeometry(1, 0);
    paint(plate, i % 2 ? 0.88 : 1.1);
    parts.push({
      geo: plate,
      m: pose(
        hx + Math.cos(a) * len, hy + Math.sin(a) * len, i * 0.014 - 0.035,
        0, 0, a - Math.PI / 2, len * 0.55, len * 1.05, 0.05,
      ),
    });
  }
  parts.push({ geo: paint(lump(0.08, 0, 0.35, 17), 0.5), m: pose(hx, hy, 0) });
  return merge(parts);
})();

// 12 MIMIC — voidopal's egg wearing a rind of rock it should not have, split
// by a seam that glows. A shade off, a size too big (the SCALE map does the
// size), and wrong exactly at second glance, which is the point.
const MIMIC_EGG = (() => {
  const egg = lump(0.24, 1, 0.13, 29);
  egg.scale(0.85, 1.18, 0.85);
  paint(egg, 1);
  const parts = [{ geo: egg, m: pose(0, 0, 0) }];
  // the rind: two rock plates cupping one side, unmistakably NOT crystal
  parts.push({ geo: paint(lump(0.15, 1, 0.2, 31), 0.24), m: pose(-0.15, -0.08, 0, 0, 0, 0.5, 1.05, 1.15, 0.55) });
  parts.push({ geo: paint(lump(0.12, 1, 0.2, 33), 0.24), m: pose(-0.11, 0.17, 0.02, 0, 0, -0.4, 0.95, 0.9, 0.5) });
  // the seam: a hot ring around the waist, the tell that it opens
  const seam = new THREE.TorusGeometry(0.235, 0.022, 6, 22);
  paint(seam, 1.6);
  parts.push({ geo: seam, m: pose(0, 0.02, 0, 1.35, 0, 0.15, 0.9, 0.9, 0.9) });
  return merge(parts);
})();

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
  COPPER_CRUST, IRON_CUBE, SILVER_FAN, GOLD_HEART, RUBY_DOME, OPAL_EGG,
  DIAMOND_MARQUISE, EMBER_STAR, VEIN_PODS, FROST_BURST, SALT_CRUST,
  NACRE_FAN, MIMIC_EGG,
  ...CRACKS,
];

export const CRACK_CLASS_0 = 13;
export const CRACK_VARIANTS = CRACKS.length;
/** the display cut the Quarters' trophy shelf carves everything into */
export const DISPLAY_CUT = 6;

const CLASS: Record<number, number> = {
  [T.COPPER]: 0,
  [T.IRON]: 1,
  [T.SILVER]: 2,
  [T.GOLD]: 3,
  [T.RUBY]: 4,
  [T.VOIDOPAL]: 5,
  [T.DIAMOND]: 6,
  [T.EMBERSHARD]: 7,
  [T.FUNGUS]: 8,
  [T.FROSTBLOOM]: 9,
  [T.NACRE]: 11,
  [T.MIMIC]: 12,
};
export function gemClassOf(t: number): number {
  // the native deposit wears each world's own material: salt crust on the
  // ice, shell fans under the ocean
  if (t === T.NATIVE) return ACTIVE.id === 'maelis6' ? 11 : 10;
  return CLASS[t] ?? 0;
}

const SCALE: Record<number, number> = {
  [T.FUNGUS]: 0.9, [T.COPPER]: 0.95, [T.IRON]: 0.9, [T.SILVER]: 0.95,
  [T.GOLD]: 1, [T.RUBY]: 1.05, [T.VOIDOPAL]: 1.1, [T.DIAMOND]: 1, [T.EMBERSHARD]: 1.1,
  [T.MIMIC]: 1.28, [T.FROSTBLOOM]: 0.95, [T.NACRE]: 1.05, [T.NATIVE]: 0.95,
};
export function gemScaleOf(t: number): number { return SCALE[t] ?? 1; }

/** per-class motion character: how fast it turns, how hard it breathes */
export interface Motion { spin: number; pulse: number; wobble: number; }
const MOTION: Motion[] = [
  { spin: 0.3, pulse: 0.03, wobble: 0 },      // copper: dead metal in a crust
  { spin: 0.3, pulse: 0.03, wobble: 0 },      // iron: barely turns
  { spin: 0.55, pulse: 0.05, wobble: 0.04 },  // silver: blades glint as they turn
  { spin: 0.4, pulse: 0.06, wobble: 0 },      // gold: slow, flashing its heart
  { spin: 0.5, pulse: 0.07, wobble: 0.04 },   // ruby
  { spin: 1.4, pulse: 0.1, wobble: 0.3 },     // voidopal: the egg never settles
  { spin: 0.9, pulse: 0.05, wobble: 0.06 },   // diamond: catches light constantly
  { spin: 0.4, pulse: 0.13, wobble: 0.05 },   // embershard: banked fire, breathing
  { spin: 0.25, pulse: 0.17, wobble: 0.12 },  // veinlight: slow organic breathing
  { spin: 0.15, pulse: 0.09, wobble: 0.04 },  // frostbloom: near still, waiting
  { spin: 0.2, pulse: 0.03, wobble: 0 },      // rime salt: a crust, not a jewel
  { spin: 0.3, pulse: 0.05, wobble: 0.03 },   // nacre
  { spin: 1.25, pulse: 0.1, wobble: 0.28 },   // mimic: voidopal's motion, off a beat
];
export function motionOf(cls: number): Motion {
  return MOTION[cls] ?? { spin: 0, pulse: 0, wobble: 0 };
}
