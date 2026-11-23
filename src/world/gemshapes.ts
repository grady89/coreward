import * as THREE from 'three';
import { T } from './tiles';
import { ACTIVE } from './worlds';

// Shape vocabulary for everything embedded in rock — one form per mineral,
// rebuilt to the reference sheets in reference-art/minerals and the table in
// design-review/visual-pass-2026-11-22/MINERALS-DIRECTION.md. Thirteen ores,
// thirteen silhouettes: at one tile, mid-drill, in the dark, the SHAPE is
// what tells silver from diamond and copper from gold, because color alone
// cannot. Shared by the terrain renderer, the icon baker and the spill site.
//
// Every form is faceted and low-poly so flat shading reads the facets hard.
// Each vertex carries two attributes:
//   color — the mineral's own albedo, baked here (teal crust, orange cells,
//           black obsidian, ember seams…). The instance color multiplies it;
//           ore draws white, so the hue lives in the geometry. Veinlight and
//           the heat cracks stay white and take their world's tint instead.
//   surf  — (emit, roughness, metalness): how hard that part glows and what
//           it is made of, so a matte rock husk, a mirror needle and a hot
//           seam share one draw call. Only gemMaterial() reads it.
// Every geometry leaves through merge(), so every one has both attributes.

type Hue = number | THREE.Color;
type Part = { geo: THREE.BufferGeometry; m: THREE.Matrix4 };

const col = (h: Hue): THREE.Color => (h instanceof THREE.Color ? h : new THREE.Color(h));

/** de-index and merge transformed geometries into one buffer, attributes kept */
function merge(parts: Part[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const norm: number[] = [];
  const cols: number[] = [];
  const surf: number[] = [];
  for (const { geo, m } of parts) {
    const g = geo.clone().applyMatrix4(m);
    const p = g.attributes.position.array as ArrayLike<number>;
    const n = g.attributes.normal.array as ArrayLike<number>;
    const c = g.attributes.color?.array as ArrayLike<number> | undefined;
    const s = g.attributes.surf?.array as ArrayLike<number> | undefined;
    const push = (i: number) => {
      pos.push(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
      norm.push(n[i * 3], n[i * 3 + 1], n[i * 3 + 2]);
      if (c) cols.push(c[i * 3], c[i * 3 + 1], c[i * 3 + 2]); else cols.push(1, 1, 1);
      if (s) surf.push(s[i * 3], s[i * 3 + 1], s[i * 3 + 2]); else surf.push(0.55, 0.16, 0.55);
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
  out.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  out.setAttribute('surf', new THREE.Float32BufferAttribute(surf, 3));
  return out;
}

/**
 * Per-face paint: fn sees each triangle's centroid and normal (geometry
 * space, before any transform) and returns [albedo, emit]. Roughness and
 * metalness are the part's material.
 */
function paintFaces(
  geo: THREE.BufferGeometry, rough: number, metal: number,
  fn: (c: THREE.Vector3, n: THREE.Vector3, face: number) => [Hue, number],
): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  g.computeVertexNormals();
  const p = g.attributes.position;
  const c = new Float32Array(p.count * 3);
  const s = new Float32Array(p.count * 3);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3();
  const cen = new THREE.Vector3(), nrm = new THREE.Vector3();
  for (let f = 0; f < p.count / 3; f++) {
    a.fromBufferAttribute(p, f * 3); b.fromBufferAttribute(p, f * 3 + 1); d.fromBufferAttribute(p, f * 3 + 2);
    cen.copy(a).add(b).add(d).multiplyScalar(1 / 3);
    nrm.copy(d).sub(b).cross(a.clone().sub(b)).normalize();
    const [h, e] = fn(cen, nrm, f);
    const k = col(h);
    for (let v = f * 3; v < f * 3 + 3; v++) {
      c[v * 3] = k.r; c[v * 3 + 1] = k.g; c[v * 3 + 2] = k.b;
      s[v * 3] = e; s[v * 3 + 1] = rough; s[v * 3 + 2] = metal;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.setAttribute('surf', new THREE.BufferAttribute(s, 3));
  return g;
}

/** one albedo, one glow, one material for the whole part */
const paint = (geo: THREE.BufferGeometry, hue: Hue, emit: number, rough: number, metal: number) =>
  paintFaces(geo, rough, metal, () => [hue, emit]);

/** albedo and glow graded along local Y (by face centroid): y0 -> (h0,e0), y1 -> (h1,e1) */
function paintY(
  geo: THREE.BufferGeometry, rough: number, metal: number,
  y0: number, h0: Hue, e0: number, y1: number, h1: Hue, e1: number,
): THREE.BufferGeometry {
  const c0 = col(h0), c1 = col(h1);
  return paintFaces(geo, rough, metal, cen => {
    const t = Math.max(0, Math.min(1, (cen.y - y0) / (y1 - y0)));
    return [c0.clone().lerp(c1, t), e0 + (e1 - e0) * t];
  });
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

/** a part carried out along a direction, turned to face it, then scaled */
const along = (dir: THREE.Vector3, dist: number, sx = 1, sy = sx, sz = sx) =>
  new THREE.Matrix4().compose(
    dir.clone().normalize().multiplyScalar(dist),
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()),
    new THREE.Vector3(sx, sy, sz),
  );

// deterministic jitter for the irregular forms
function lump(radius: number, detail: number, amount: number, seed: number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(radius, detail);
  const p = g.attributes.position;
  let s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  // icosahedra are de-indexed, so a shared corner appears once per face: key
  // the jitter on the position so the faces stay stitched together
  const seen = new Map<string, number>();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;
    let f = seen.get(key);
    if (f === undefined) { f = 1 + (rnd() - 0.5) * amount; seen.set(key, f); }
    p.setXYZ(i, p.getX(i) * f, p.getY(i) * f, p.getZ(i) * f);
  }
  g.computeVertexNormals();
  return g;
}

/** even directions over a sphere (golden spiral), optionally only the upper cap */
function spread(n: number, yMin = -1): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const y = 1 - (i + 0.5) / n * (1 - yMin);
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const a = i * 2.39996;
    out.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
  }
  return out;
}

// the matrix every ore sits in: matte and dark, with just enough of its own
// light to read as grey stone in an unlit tunnel rather than a hole
const HOST = 0x4a484e;
const host = (geo: THREE.BufferGeometry, hue: Hue = HOST, emit = 0.1) => paint(geo, hue, emit, 0.92, 0.02);

/** a hexagonal crystal: prism body and a six-sided point */
function hexCrystal(r: number, h: number): THREE.BufferGeometry {
  return merge([
    { geo: new THREE.CylinderGeometry(r, r * 1.05, h, 6, 1), m: pose(0, h / 2, 0) },
    { geo: new THREE.ConeGeometry(r, r * 1.3, 6, 1), m: pose(0, h + r * 0.65, 0) },
  ]);
}

// ---- ore forms, one per mineral ----

// 0 COPPER — a round lumpy nodule in a verdigris crust, pitted with cells
// that glow hot orange from inside. The only two-tone, cratered ore: teal
// shell, orange dots — never mistaken for gold's yellow wound.
const COPPER_NODULE = (() => {
  const parts: Part[] = [{
    geo: paintFaces(lump(0.27, 1, 0.16, 7), 0.85, 0.08, (c) =>
      [c.y > 0.05 ? 0x62d0b0 : 0x3a9880, 0.16]),
    m: pose(0, 0, 0, 0, 0, 0, 1.05, 0.95, 1),
  }];
  for (const d of spread(11)) {
    // each cell: a glowing ember sunk into a dark pit in the crust
    parts.push({ geo: paint(new THREE.CylinderGeometry(0.075, 0.06, 0.05, 6), 0x1a2a24, 0, 0.9, 0), m: along(d, 0.245) });
    parts.push({ geo: paint(new THREE.CylinderGeometry(0.052, 0.04, 0.05, 6), 0xff6420, 2.2, 0.6, 0), m: along(d, 0.262) });
  }
  return merge(parts);
})();

// 1 IRON — a stack of short gunmetal prisms on a cube, hard right angles,
// blue-black and cold. It does not glow: it reads by its square silhouette
// and the blue glint off its faces under the lamp, which is the lamp's job.
const IRON_BLOCKS = (() => {
  const steel = (w: number, h: number, d: number) =>
    paintFaces(new THREE.BoxGeometry(w, h, d), 0.26, 0.72, (_c, n) =>
      n.y > 0.5 ? [0xb4c8e8, 0.55] : n.x > 0.5 || n.z > 0.5 ? [0x7084a6, 0.32] : [0x3e4a62, 0.16]);
  const glint = () => paint(new THREE.OctahedronGeometry(0.03, 0), 0xb4dcff, 2.4, 0.2, 0);
  return merge([
    { geo: steel(0.4, 0.26, 0.38), m: pose(0, -0.1, 0, 0, 0.15, 0) },
    { geo: steel(0.17, 0.22, 0.17), m: pose(-0.1, 0.12, 0.05, 0, 0.4, 0.05) },
    { geo: steel(0.15, 0.3, 0.15), m: pose(0.08, 0.15, -0.04, 0, -0.25, -0.08) },
    { geo: steel(0.13, 0.15, 0.13), m: pose(0.19, 0.07, 0.1, 0, 0.7, 0.12) },
    { geo: glint(), m: pose(0.2, 0.03, 0.2) },
    { geo: glint(), m: pose(-0.2, 0.03, 0.19) },
    { geo: glint(), m: pose(0.0, 0.3, 0.04) },
  ]);
})();

// 2 SILVER — a spray of long thin needles fanning up out of a rock knuckle,
// pale and mirror-bright. Many blades, never one stone: that keeps it apart
// from diamond's single cut and frostbloom's all-round burst.
const SILVER_SPRAY = (() => {
  const parts: Part[] = [{ geo: host(lump(0.13, 0, 0.3, 41)), m: pose(0, -0.2, 0, 0, 0, 0, 1.4, 0.8, 1.1) }];
  const N = 11;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const a = -1.05 + t * 2.1;                       // fan across the upper half
    const h = 0.4 + Math.sin(t * Math.PI) * 0.24 + (i % 3) * 0.03;
    const d = new THREE.Vector3(Math.sin(a), Math.cos(a), ((i * 7) % 5 - 2) * 0.16).normalize();
    const blade = paintY(new THREE.OctahedronGeometry(1, 0), 0.22, 0.55,
      -1, 0xa4aebe, 0.1, 1, 0xf4f8ff, 0.4);
    parts.push({ geo: blade, m: along(d, h * 0.5 - 0.02, 0.028, h * 0.5, 0.02).premultiply(new THREE.Matrix4().makeTranslation(0, -0.17, 0)) });
  }
  return merge(parts);
})();

// 3 GOLD — a rough boulder split open around its waist, the gold bulging out
// of the wound and lighting it from inside. Rock outside, warm yellow within:
// broader and softer than the embershard's pinpoint sparks.
const GOLD_WOUND = (() => {
  // the rock lips facing the wound catch its amber; the far sides stay grey
  const woundRock = (g: THREE.BufferGeometry, toward: number) =>
    paintFaces(g, 0.9, 0.02, c => c.y * toward > 0.02 ? [0x8a6a3a, 0.5] : [HOST, 0.1]);
  const nugget = paintFaces(lump(0.25, 1, 0.22, 5), 0.3, 0.6, (c) =>
    [c.y > 0.02 ? 0xffd24a : 0xffb020, c.y > 0.02 ? 0.75 : 1.05]);
  return merge([
    { geo: nugget, m: pose(0, -0.01, 0, 0, 0, 0, 1.08, 0.62, 1.08) },
    { geo: woundRock(lump(0.22, 1, 0.24, 61), -1), m: pose(-0.04, 0.16, -0.02, 0.2, 0, 0.12, 0.95, 0.55, 0.9) },
    { geo: woundRock(lump(0.18, 1, 0.26, 67), 1), m: pose(0.05, -0.17, 0.01, -0.1, 0, -0.1, 0.95, 0.5, 0.9) },
    // gold leaking down a crack in the upper rock
    { geo: paint(new THREE.BoxGeometry(0.03, 0.12, 0.03), 0xffc030, 1.4, 0.3, 0.4), m: pose(0.06, 0.18, 0.2, 0.3, 0, 0.35) },
    { geo: paint(new THREE.BoxGeometry(0.03, 0.1, 0.03), 0xffc030, 1.4, 0.3, 0.4), m: pose(-0.1, -0.17, 0.17, -0.2, 0, -0.5) },
  ]);
})();

// 4 RUBY — chunky stubby hexagonal crystals on a rock seat, deep crimson to
// hot pink, glowing hardest where they root so the light pools at the base.
// The only saturated red-pink anywhere.
const RUBY_CLUSTER = (() => {
  const gem = (r: number, h: number) =>
    paintY(hexCrystal(r, h), 0.12, 0.2, 0, 0xc0123a, 1.35, h + r * 1.3, 0xff4a82, 0.7);
  return merge([
    { geo: host(lump(0.15, 0, 0.3, 71)), m: pose(0, -0.2, 0, 0, 0, 0, 1.5, 0.6, 1.2) },
    { geo: gem(0.13, 0.22), m: pose(-0.02, -0.2, 0, 0.1, 0.3, 0.12) },
    { geo: gem(0.1, 0.15), m: pose(0.13, -0.2, 0.04, 0, 0.1, -0.55) },
    { geo: gem(0.085, 0.1), m: pose(-0.16, -0.2, 0.06, 0.2, 0.5, 0.75) },
  ]);
})();

// iridescent panels shared by the voidopal and the mimic it pretends to be:
// every facet its own place on a blue -> violet -> magenta wheel, brightest
// toward the base, so the turning egg flashes rather than glowing one flat
// lavender
const OPAL_BLUE = new THREE.Color(0x3a62ff), OPAL_VIOLET = new THREE.Color(0x8a44ff), OPAL_MAGENTA = new THREE.Color(0xff3ccf);
function opalPanels(geo: THREE.BufferGeometry, shift: number): THREE.BufferGeometry {
  return paintFaces(geo, 0.1, 0.3, (c, n, f) => {
    const w = (Math.sin(Math.atan2(n.z, n.x) * 2 + n.y * 3 + shift + f * 0.9) + 1) / 2;
    const hue = w < 0.5 ? OPAL_BLUE.clone().lerp(OPAL_VIOLET, w * 2) : OPAL_VIOLET.clone().lerp(OPAL_MAGENTA, (w - 0.5) * 2);
    return [hue, 0.75 + Math.max(0, -c.y) * 2.2 + (f % 4 === 0 ? 0.5 : 0)];
  });
}
const egg = (seed: number) => {
  const g = lump(0.24, 1, 0.11, seed);
  g.scale(0.85, 1.18, 0.85);
  return g;
};

// 5 VOIDOPAL — a seated egg of iridescent panels on a dark base. It never
// sits still, and the egg is the point: the mimic hatches, and now you know.
const OPAL_EGG = merge([
  { geo: host(lump(0.14, 0, 0.3, 79), 0x1c1a26), m: pose(0, -0.25, 0, 0, 0, 0, 1.5, 0.5, 1.3) },
  { geo: opalPanels(egg(13), 0), m: pose(0, 0.03, 0) },
]);

// 6 DIAMOND — one large marquise: crown, girdle and pavilion drawn to two
// hard points. Near-colourless ice; alternate facets burn bright so it
// sparkles as it turns. The cleanest, hardest silhouette in the set.
const DIAMOND_MARQUISE = paintFaces(new THREE.LatheGeometry([
  new THREE.Vector2(0.001, -0.42),
  new THREE.Vector2(0.15, -0.14),
  new THREE.Vector2(0.185, -0.02),
  new THREE.Vector2(0.185, 0.05),
  new THREE.Vector2(0.14, 0.16),
  new THREE.Vector2(0.001, 0.44),
], 6), 0.04, 0.45, (_c, _n, f) =>
  f % 3 === 0 ? [0xffffff, 1.1] : f % 3 === 1 ? [0xdcecff, 0.32] : [0xb8d2ec, 0.2]);

// 7 EMBERSHARD — broken slabs of obsidian, black-blue and glassy, split by
// seams that glow like banked coals and peppered with ember sparks. Darker
// than gold, angrier than copper: the light is in the cracks, not the stone.
const EMBER_SHARDS = (() => {
  const OBS = 0x14161e;
  const slab = (seed: number) => {
    const g = lump(1, 0, 0.35, seed);
    return paintFaces(g, 0.2, 0.45, (_c, n) => [n.y > 0.3 ? 0x262a38 : OBS, 0]);
  };
  const seam = (len: number) => paint(new THREE.BoxGeometry(0.024, len, 0.024), 0xff6a1a, 2.6, 0.5, 0);
  const spark = () => paint(new THREE.OctahedronGeometry(0.022, 0), 0xffa040, 3, 0.5, 0);
  return merge([
    { geo: slab(83), m: pose(-0.07, 0.02, 0, 0.15, 0.2, 0.28, 0.13, 0.34, 0.07) },
    { geo: slab(89), m: pose(0.11, -0.03, 0.02, -0.1, -0.3, -0.42, 0.12, 0.28, 0.07) },
    { geo: slab(97), m: pose(0.01, -0.13, -0.05, 0.4, 0.9, 1.35, 0.1, 0.24, 0.07) },
    // seams where the slabs meet, and fissures down their faces
    { geo: seam(0.36), m: pose(0.03, -0.02, 0.04, 0, 0, -0.1) },
    { geo: seam(0.22), m: pose(-0.08, 0.06, 0.08, 0, 0.2, 0.3) },
    { geo: seam(0.2), m: pose(0.13, -0.04, 0.08, 0, -0.3, -0.42) },
    { geo: seam(0.2), m: pose(-0.03, -0.14, 0.06, 0, 0, 1.35) },
    { geo: seam(0.16), m: pose(-0.06, 0.04, -0.07, 0, 0.2, 0.2) },
    { geo: spark(), m: pose(-0.12, 0.2, 0.06) },
    { geo: spark(), m: pose(0.16, 0.14, 0.05) },
    { geo: spark(), m: pose(0.2, -0.16, 0.04) },
    { geo: spark(), m: pose(-0.2, -0.1, 0.03) },
    { geo: spark(), m: pose(0.05, 0.27, -0.02) },
    { geo: spark(), m: pose(-0.04, -0.24, 0.07) },
  ]);
})();

// 8 VEINLIGHT — branching fronds of living light off a glowing root pad:
// the only plant down here, organic against everything crystalline. White
// in the geometry; the instance colour is the world's biolume tint.
const VEIN_FRONDS = (() => {
  const parts: Part[] = [
    { geo: paint(lump(0.13, 0, 0.3, 101), 0xffffff, 1.6, 0.5, 0), m: pose(0, -0.24, 0, 0, 0, 0, 1.6, 0.45, 1.3) },
  ];
  const frond = (e0: number) =>
    paintY(new THREE.OctahedronGeometry(1, 0), 0.5, 0, -1, 0xffffff, e0, 1, 0xe8fffa, e0 * 0.6);
  const tip = () => paint(new THREE.IcosahedronGeometry(0.05, 0), 0xffffff, 1.8, 0.4, 0);
  const stems = [-0.75, -0.25, 0.25, 0.75];
  stems.forEach((a, i) => {
    const len = 0.34 + (i % 2) * 0.08;
    const base = new THREE.Vector3(a * 0.12, -0.22, (i % 2 - 0.5) * 0.08);
    const d = new THREE.Vector3(Math.sin(a), Math.cos(a), (i % 2 - 0.5) * 0.4).normalize();
    parts.push({ geo: frond(0.85), m: along(d, len * 0.5, 0.06, len * 0.5, 0.06).premultiply(new THREE.Matrix4().makeTranslation(base.x, base.y, base.z)) });
    const end = base.clone().addScaledVector(d, len);
    parts.push({ geo: tip(), m: pose(end.x, end.y, end.z) });
    // two side fronds off each stem, swept outward
    for (const side of [-1, 1]) {
      const at = base.clone().addScaledVector(d, len * (side < 0 ? 0.45 : 0.62));
      const sd = d.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), side * 0.7).normalize();
      const sl = len * 0.42;
      parts.push({ geo: frond(0.7), m: along(sd, sl * 0.5, 0.046, sl * 0.5, 0.046).premultiply(new THREE.Matrix4().makeTranslation(at.x, at.y, at.z)) });
    }
  });
  return merge(parts);
})();

// 9 FROSTBLOOM — the trap that passes for veinlight: a cold flower of
// faceted ice petals standing proud of the face, cupped toward the viewer
// around a white-hot heart, with long needles reaching past the block's
// edge. Ice-cyan with a few violet stamens at the heart. The tell is the
// rime: a ring of frost flakes on the stone around it that no living
// veinlight leaves. Built facing +z (it turns in the face plane, never
// edge-on) and lifted clear of a jittered rock face.
const FROST_BLOOM = (() => {
  const Z = 0.14;
  const ICE = 0x9ae2ff, CYAN = 0x1c96ff;
  // a petal: a long flat bipyramid whose two front faces split light from
  // shade down its spine, glowing at the root and cooling to cyan at the tip
  const petal = (root: number, tip: number, eRoot: number, eTip: number) =>
    paintFaces(new THREE.OctahedronGeometry(1, 0), 0.18, 0.08, (c, n) => {
      const t = Math.max(0, Math.min(1, (c.y + 1) / 2));
      const k = (n.x > 0 ? 1 : 0.5) * (n.y > 0 ? 1 : 0.85);
      return [col(root).lerp(col(tip), t), (eRoot + (eTip - eRoot) * t) * k];
    });
  // out from the heart along angle a, tipped toward the viewer by tilt
  const ray = (a: number, tilt: number, len: number, w: number, d: number, z = Z) =>
    new THREE.Matrix4().makeTranslation(0, 0, z)
      .multiply(new THREE.Matrix4().makeRotationZ(a))
      .multiply(new THREE.Matrix4().makeRotationX(tilt))
      .multiply(new THREE.Matrix4().makeTranslation(0, len / 2 + 0.03, 0))
      .multiply(new THREE.Matrix4().makeScale(w, len / 2, d));
  const parts: Part[] = [
    { geo: paint(new THREE.IcosahedronGeometry(0.085, 0), 0xf6fcff, 2.8, 0.2, 0), m: pose(0, 0, Z + 0.05) },
  ];
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    // the outer petals: wide, nearly flat to the face
    parts.push({ geo: petal(ICE, CYAN, 0.95, 0.85), m: ray(a, 0.32, 0.46, 0.115, 0.05) });
    // the inner petals, between them: shorter and cupped up toward you
    parts.push({ geo: petal(0xe4f8ff, 0x48c0ff, 1.2, 0.8), m: ray(a + Math.PI / 6, 0.78, 0.3, 0.085, 0.045, Z + 0.02) });
    // needles past the block's edge
    parts.push({ geo: petal(0xb4ecff, 0x2eaaff, 1.0, 0.9), m: ray(a + Math.PI / 6, 0.1, 0.58, 0.026, 0.026, Z - 0.01) });
  }
  // the violet stamens: the old bloom's colour kept as an accent at the heart
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5 + 0.3;
    parts.push({ geo: paint(new THREE.OctahedronGeometry(0.034, 0), 0xb49cff, 2.2, 0.3, 0), m: pose(Math.cos(a) * 0.09, Math.sin(a) * 0.09, Z + 0.1) });
  }
  // the rime ring: flat frost flakes lying on the stone around it
  for (let i = 0; i < 16; i++) {
    const a = i * Math.PI * 2 / 16 + (i % 3) * 0.11;
    const r = 0.4 + ((i * 7) % 5) * 0.018;
    const s = 0.018 + ((i * 5) % 3) * 0.006;
    parts.push({ geo: paint(new THREE.CircleGeometry(s, 6), 0xc8e8ff, 0.3, 0.5, 0), m: pose(Math.cos(a) * r, Math.sin(a) * r, Z - 0.04, 0, 0, a) });
  }
  return merge(parts);
})();

// 10 RIME SALT — a translucent glacier-blue cube with a frosted top and a
// cyan light inside it. Iron's shape, ice's colour and glow: the two cubic
// ores split by value — one dark and cold-metal, one bright and lit within.
const SALT_CUBE = (() => {
  const cube = (s: number) => paintFaces(new THREE.BoxGeometry(s, s, s), 0.12, 0.05, (c, n) =>
    n.y > 0.5 ? [0xeef8ff, 0.55]                                // frost on the top
      : n.y < -0.5 ? [0x1e5a9a, 0.3]
        : [c.y > 0 ? 0x6ac4ff : 0x2e82d8, c.y > 0 ? 0.65 : 0.95]); // lit from inside, low
  return merge([
    { geo: cube(0.36), m: pose(-0.03, -0.04, 0, 0.12, 0.5, 0.06) },
    { geo: cube(0.18), m: pose(0.2, -0.13, 0.08, 0, 0.2, -0.1) },
    // the inner light, showing through the cleavage
    { geo: paint(new THREE.BoxGeometry(0.02, 0.3, 0.02), 0x7af0ff, 2.4, 0.2, 0), m: pose(0.05, -0.04, 0.19, 0, 0, 0.3) },
  ]);
})();

// 11 NACRE — a scalloped shell fan of ribbed layers on a slate seat, pearl
// white with pink, teal and violet sheen that moves as it turns. Nothing
// else down here has a curve like it, or a sheen instead of a glow.
const SHEEN = [0xffd2ea, 0xc8f4ee, 0xdcd0ff, 0xfff4fa].map(h => new THREE.Color(h));
const NACRE_FAN = (() => {
  // built proud of the face (z +0.13): a flat fan at the ore's centre would
  // sit half inside its own host tile
  const z = 0.13, hy = -0.17;
  const parts: Part[] = [{ geo: host(lump(0.12, 0, 0.3, 17), 0x3a4048), m: pose(0, hy - 0.06, z - 0.04, 0, 0, 0, 1.4, 0.55, 1) }];
  const N = 7;
  for (let i = 0; i < N; i++) {
    const a = -1.2 + i * (2.4 / (N - 1));            // a half-circle fan off the hinge
    const len = 0.32 + (i % 2) * 0.04;                // alternate ribs stand proud: the scallop
    // each rib a long flat rhomb: its spine is the ridge, its overlap the groove
    const rib = paintFaces(new THREE.OctahedronGeometry(1, 0), 0.22, 0.12, (_c, n, f) =>
      [SHEEN[(i + f + (n.x > 0 ? 1 : 0)) % SHEEN.length], 0.34]);
    const d = new THREE.Vector3(Math.sin(a), Math.cos(a), 0);
    parts.push({
      geo: rib,
      m: along(d, len * 0.5, 0.085, len * 0.5, 0.035 + (i % 2) * 0.012)
        .premultiply(new THREE.Matrix4().makeTranslation(0, hy, z + (i % 2) * 0.02)),
    });
  }
  return merge(parts);
})();

// 12 MIMIC — voidopal's egg in a cracked blue-grey rock husk it should not
// have, red-orange light breaking through the cracks. It looks like the
// premium gem; the veins give it away. The SCALE map makes it a size too big.
const MIMIC_EGG = (() => {
  const HUSK = 0x5a6680;
  const crack = (len: number) => paint(new THREE.BoxGeometry(0.026, len, 0.026), 0xff4a18, 2.8, 0.5, 0);
  const parts: Part[] = [{ geo: opalPanels(egg(29), 1.7), m: pose(0, 0, 0) }];
  for (const side of [-1, 1]) {
    // a husk plate cupping each flank, so the rind shows from every turn
    parts.push({ geo: host(lump(0.2, 1, 0.22, side < 0 ? 31 : 33), HUSK, 0.16), m: pose(side * 0.15, -0.03, 0, 0, 0, side * 0.12, 0.5, 1.25, 1.05) });
    // a zigzag of glowing cracks across the outer face of the husk
    const x = side * 0.245;
    parts.push({ geo: crack(0.17), m: pose(x, 0.1, 0.04, 0.5, 0, 0) });
    parts.push({ geo: crack(0.15), m: pose(x, -0.04, -0.03, -0.7, 0, 0) });
    parts.push({ geo: crack(0.13), m: pose(x * 0.96, -0.16, 0.05, 0.6, 0, 0) });
    parts.push({ geo: crack(0.1), m: pose(x * 0.9, 0.04, 0.12, 1.4, 0, 0) });
  }
  return merge(parts);
})();

/**
 * The material every GEM_GEOS mesh is drawn with: reads the baked `surf`
 * attribute for per-vertex glow, roughness and metalness. Emission is
 * albedo × instance colour × emit, so a black shard stays black around its
 * burning seams. Material parameters are optional base overrides only.
 */
export function gemMaterial(params: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    vertexColors: true, flatShading: true, emissive: 0xffffff, emissiveIntensity: 1, ...params,
  });
  m.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 surf;\nvarying vec3 vSurf;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvSurf = surf;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSurf;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n\troughnessFactor = vSurf.y;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n\tmetalnessFactor = vSurf.z;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance *= vColor.rgb * vSurf.x;');
  };
  m.customProgramCacheKey = () => 'gem-surf-v1';
  return m;
}

// ---- heat cracks: glowing seams, flush in the rock face ----
// Each is a trunk zigzagging along local x from one tile edge to the other
// (so two seams turned to meet join into one vein) with a few branches off
// it. The core burns hot; a wider, dimmer band behind it is the seam's glow.
// Both are flat quads lying on the face (it is only ever seen from the front),
// which keeps a five-stroke seam cheaper than the old three-box crack.
// Emission is white × the instance colour (the world's fluid hue) × emit.
function crack(trunk: [number, number][], branches: [number, number, number, number, number][]): THREE.BufferGeometry {
  const parts: Part[] = [];
  const seg = (x0: number, y0: number, x1: number, y1: number, th: number) => {
    const len = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1 - x0);
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    // overlap the joints a touch so the zigzag never shows a gap
    parts.push({ geo: paint(new THREE.PlaneGeometry(len + th, th), 0xffffff, 2.6, 0.6, 0), m: mat(mx, my, 0.02, ang) });
    parts.push({ geo: paint(new THREE.PlaneGeometry(len + th * 2, th * 2.3), 0xffffff, 0.5, 0.8, 0), m: mat(mx, my, 0.012, ang) });
  };
  for (let i = 0; i + 1 < trunk.length; i++) seg(trunk[i][0], trunk[i][1], trunk[i + 1][0], trunk[i + 1][1], 0.04);
  // each branch: from (x, y), length, angle, thickness
  for (const [x, y, len, ang, th] of branches) seg(x, y, x + Math.cos(ang) * len, y + Math.sin(ang) * len, th);
  return merge(parts);
}
const CRACKS = [
  crack([[-0.5, 0], [-0.18, 0.07], [0.12, -0.06], [0.5, 0]], [[-0.18, 0.07, 0.3, 1.15, 0.026], [0.12, -0.06, 0.26, -1.0, 0.024]]),
  crack([[-0.5, 0], [-0.1, -0.09], [0.2, 0.05], [0.5, 0]], [[-0.1, -0.09, 0.32, -1.9, 0.026], [0.2, 0.05, 0.22, 0.9, 0.022], [0.2, 0.05, 0.16, 2.4, 0.018]]),
  crack([[-0.5, 0], [-0.25, -0.04], [0.04, 0.1], [0.5, 0]], [[0.04, 0.1, 0.36, 1.7, 0.028], [-0.25, -0.04, 0.2, -2.2, 0.02]]),
  crack([[-0.5, 0], [0.0, 0.04], [0.5, 0]], [[0.0, 0.04, 0.3, -1.3, 0.026]]),
];

export const GEM_GEOS: THREE.BufferGeometry[] = [
  COPPER_NODULE, IRON_BLOCKS, SILVER_SPRAY, GOLD_WOUND, RUBY_CLUSTER, OPAL_EGG,
  DIAMOND_MARQUISE, EMBER_SHARDS, VEIN_FRONDS, FROST_BLOOM, SALT_CUBE,
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
  [T.FUNGUS]: 0.9, [T.COPPER]: 0.95, [T.IRON]: 1.05, [T.SILVER]: 0.95,
  [T.GOLD]: 1, [T.RUBY]: 1.05, [T.VOIDOPAL]: 1.1, [T.DIAMOND]: 1, [T.EMBERSHARD]: 1.1,
  [T.MIMIC]: 1.28, [T.FROSTBLOOM]: 0.95, [T.NACRE]: 1.05, [T.NATIVE]: 0.95,
};
export function gemScaleOf(t: number): number { return SCALE[t] ?? 1; }

/**
 * Instance colour for an ore drawn with gemMaterial(): the hue is baked into
 * the geometry, so ore draws white — except veinlight, whose white fronds
 * take each world's biolume tint.
 */
export function gemTintOf(t: number): number {
  return t === T.FUNGUS ? ACTIVE.gemTint : 0xffffff;
}

/**
 * The glow each ore throws onto the face of its own host tile: [colour,
 * strength], drawn by the rock material as a soft disc behind the ore (no
 * light, no draw call). Iron throws none — it is the dark one, read by the
 * lamp — and silver almost none. Indexed by gem class; veinlight's colour is
 * its world's tint.
 */
const HALO: [number, number][] = [
  [0xffa050, 0.2],   // copper: cells bleeding orange into the stone
  [0x000000, 0],     // iron
  [0xc8d8ff, 0.07],  // silver
  [0xffb838, 0.45],  // gold: a warm wound
  [0xff2a78, 0.5],   // ruby: light pooling at the base
  [0x7a3cff, 0.55],  // voidopal
  [0xd8ecff, 0.22],  // diamond: a soft cool sparkle
  [0xff8030, 0.2],   // embershard: banked coals, dimmer than gold, never ruby's pink
  [0xffffff, 0.75],  // veinlight (tinted per world)
  [0x9a7cff, 0.3],   // frostbloom: a violet heart (its cyan spills onto the stone around it)
  [0x3cc8ff, 0.5],   // rime salt: cyan within
  [0xf4dcff, 0.16],  // nacre: a sheen, not a glow
  [0xff7034, 0.3],   // mimic: the cracks give it away
];
const tmpHalo = new THREE.Color();
/** linear-space halo colour × strength for an ore tile (black for none) */
export function haloOf(t: number, out: THREE.Color = tmpHalo): THREE.Color {
  const [hex, k] = HALO[gemClassOf(t)] ?? [0, 0];
  return out.setHex(t === T.FUNGUS ? ACTIVE.gemTint : hex).multiplyScalar(k);
}

/** per-class motion character: how fast it turns, how hard it breathes */
/** sway: a flat form (the nacre fan) rocks about facing the camera instead of turning edge-on */
export interface Motion { spin: number; pulse: number; wobble: number; sway?: boolean; }
const MOTION: Motion[] = [
  { spin: 0.3, pulse: 0.03, wobble: 0 },      // copper: dead metal in a crust
  { spin: 0.3, pulse: 0.03, wobble: 0 },      // iron: barely turns
  { spin: 0.55, pulse: 0.05, wobble: 0.04 },  // silver: blades glint as they turn
  { spin: 0.22, pulse: 0.06, wobble: 0 },     // gold: slow, so the wound stays in view
  { spin: 0.5, pulse: 0.07, wobble: 0.04 },   // ruby
  { spin: 1.4, pulse: 0.1, wobble: 0.3 },     // voidopal: the egg never settles
  { spin: 0.9, pulse: 0.05, wobble: 0.06 },   // diamond: catches light constantly
  { spin: 0.4, pulse: 0.13, wobble: 0.05 },   // embershard: banked fire, breathing
  { spin: 0.25, pulse: 0.17, wobble: 0.12 },  // veinlight: slow organic breathing
  { spin: 0.05, pulse: 0.025, wobble: 0.04 }, // frostbloom: near still, waiting (it turns in the face plane)
  { spin: 0.2, pulse: 0.03, wobble: 0 },      // rime salt: a crust, not a jewel
  { spin: 0.5, pulse: 0.05, wobble: 0.05, sway: true }, // nacre: a fan rocking, sheen sliding
  { spin: 1.25, pulse: 0.1, wobble: 0.28 },   // mimic: voidopal's motion, off a beat
];
export function motionOf(cls: number): Motion {
  return MOTION[cls] ?? { spin: 0, pulse: 0, wobble: 0 };
}
