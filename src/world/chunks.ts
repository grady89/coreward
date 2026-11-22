import * as THREE from 'three';
import { CHUNK, WORLD_W, WORLD_ROWS } from '../config';
import { Terrain } from './terrain';
import { T, def, rockColor, cellHash } from './tiles';
import { ACTIVE, worldById } from './worlds';
import {
  GEM_GEOS, CRACK_CLASS_0, CRACK_VARIANTS, gemClassOf, gemScaleOf, motionOf,
  gemMaterial, gemTintOf, haloOf,
} from './gemshapes';

// Terrain renderer: one 16×16 chunk = one InstancedMesh per material class.
// Chunks are pooled and rebuilt only when a tile inside them changes.
// Resource gems come in five shape classes and slowly spin + pulse.

const CHUNKS_X = WORLD_W / CHUNK;
const CAP = CHUNK * CHUNK;
const GEM_CAP = 48; // per shape class, per chunk
const VIEW_ROWS = 30; // rows above/below camera kept alive

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
// full-width so a pool reads as one body of liquid, not a row of boxes; it
// sits a little behind the rock face, and the surface tile is lowered below
// the rim, so the basin edge stays crisp
const lavaGeo = new THREE.BoxGeometry(1, 1, 0.94);

// Per-face shade baked ONCE into the shared rock box. Every cube used to be
// flat on all six sides, so a wall of them read as a quilt of tinted squares
// instead of stone. Giving the geometry a colour attribute costs nothing per
// tile and adds no draw call: the shader multiplies it into the per-instance
// colour, so strata palettes, the ±14% cell variance and the carved-edge
// ×1.22 all still land on top of it. Faces are keyed off the normal rather
// than BoxGeometry's vertex order so the table survives any geometry change.
// The back face is never seen (the camera looks down +z); it matches the
// underside so a tumbling fold brick never flashes a bright rear.
function bakeFaceShade(g: THREE.BufferGeometry): void {
  const nrm = g.getAttribute('normal');
  const col = new Float32Array(nrm.count * 3);
  for (let i = 0; i < nrm.count; i++) {
    const nx = nrm.getX(i), ny = nrm.getY(i), nz = nrm.getZ(i);
    const s = ny > 0.5 ? 1 : ny < -0.5 ? 0.86
      : nz > 0.5 ? 0.96 : nz < -0.5 ? 0.86
      : nx > 0.5 ? 0.93 : 0.91;
    col[i * 3] = s; col[i * 3 + 1] = s; col[i * 3 + 2] = s;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
}
bakeFaceShade(boxGeo);

// vertexColors picks up the face shade above. It is a pure multiplier on the
// instance colour (three.js builds vColor as 1 × color × instanceColor in the
// vertex shader), so nothing about the existing tinting changes. Only THIS
// material opts in — lava's MeshBasicMaterial leaves vertexColors false and
// carries its own geometry, so it is untouched.
const rockMat = new THREE.MeshStandardMaterial({
  roughness: 0.93, metalness: 0.04, vertexColors: true,
});
// Ore light that lands: every chunk's rock carries a per-instance `glow`
// colour (zero for plain rock), drawn as a soft emissive disc centred on the
// tile's front face. The stone around a ruby goes pink, around veinlight
// teal, with no extra light and no extra draw call. The disc fades out
// before the corners so an ore tile never reads as a lit square.
rockMat.onBeforeCompile = shader => {
  shader.uniforms.uFluidTime = fluidUniforms.uFluidTime;
  shader.uniforms.uFluidAmp = fluidUniforms.uFluidAmp;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>
attribute vec3 glow;
attribute vec3 wash;
attribute vec2 washDir;
varying vec3 vGlow;
varying vec3 vWash;
varying vec2 vWashDir;
varying vec3 vBox;
varying vec3 vBoxN;`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>
	vGlow = glow; vWash = wash; vWashDir = washDir;
	vBox = position; vBoxN = normal;`);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>
uniform float uFluidTime;
uniform float uFluidAmp;
varying vec3 vGlow;
varying vec3 vWash;
varying vec2 vWashDir;
varying vec3 vBox;
varying vec3 vBoxN;`)
    .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
	float haloFace = vBox.z > 0.49 ? 1.0 : 0.4;
	totalEmissiveRadiance += vGlow * haloFace * (1.0 - smoothstep(0.04, 0.62, length(vBox.xy)));
	// light from a nearby pool or fissure: the front face shades toward the
	// source, a side face turned to it catches it whole; the stone's own
	// albedo still shows through so it reads as lit rock, not paint
	float wl = length(vWashDir);
	vec2 wd = wl > 1e-3 ? vWashDir / wl : vec2(0.0);
	float wf = vBoxN.z > 0.5 ? 0.6 + 0.8 * dot(vBox.xy, wd) : 0.15 + max(0.0, dot(vBoxN.xy, wd));
	float wp = 1.0 + uFluidAmp * 0.07 * sin(uFluidTime * 1.3);
	totalEmissiveRadiance += vWash * wf * wp * min(1.0, 0.5 + 3.0 * dot(diffuseColor.rgb, vec3(0.333)));`);
};
rockMat.customProgramCacheKey = () => 'rock-glow-v2';

// Each gem geometry bakes its own albedo and a per-vertex (emit, roughness,
// metalness), read by gemMaterial(): a matte rock husk, a mirror needle and a
// burning seam share this one material and this one draw call per class.
const gemMat = gemMaterial();

/** shared clock for the fluid shimmer and the light it throws; amp 0 = still */
export const fluidUniforms = {
  uFluidTime: { value: 0 },
  uFluidAmp: { value: 1 },
  uFluidLive: { value: 1 },
};
/**
 * Pools glow: an emissive body that darkens with depth below the surface,
 * a hot meniscus band on the tile that meets air, and a slow shimmer that
 * runs along the pool in world x so neighbouring tiles read as one liquid.
 * Per instance `fl` = (rows below the surface, 1 if this tile meets air,
 * world x). A spent (husk) world gets the old flat colour back.
 */
export const lavaMat = new THREE.MeshBasicMaterial({ color: 0xff5a2a, toneMapped: false });
lavaMat.onBeforeCompile = shader => {
  Object.assign(shader.uniforms, fluidUniforms);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>
attribute vec3 fl;
varying vec3 vFl;
varying vec3 vFP;
varying float vFTop;`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>
	vFl = fl; vFP = position; vFTop = normal.y;`);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>
uniform float uFluidTime;
uniform float uFluidAmp;
uniform float uFluidLive;
varying vec3 vFl;
varying vec3 vFP;
varying float vFTop;`)
    .replace('#include <color_fragment>', `#include <color_fragment>
	{
		vec3 base = diffuseColor.rgb;
		float depth = vFl.x + (0.5 - vFP.y);
		float wx = vFl.z + vFP.x;
		float body = mix(0.95, 0.26, smoothstep(0.0, 2.2, depth));
		float sh = uFluidAmp * (0.09 * sin(wx * 1.9 + uFluidTime * 1.1 - depth * 2.3)
			+ 0.05 * sin(wx * 0.7 - uFluidTime * 0.6) + 0.04 * sin(uFluidTime * 1.6));
		vec3 c = base * (body + sh);
		float menis = vFl.y * max(1.0 - smoothstep(0.0, 0.17, 0.5 - vFP.y), step(0.5, vFTop));
		vec3 hot = base * (1.5 + sh * 1.5) + vec3(0.16, 0.16, 0.12);
		c = mix(c, hot, menis * 0.9);
		diffuseColor.rgb = mix(base, c, uFluidLive);
	}`);
};
lavaMat.customProgramCacheKey = () => 'fluid-glow-v1';

/** a spent world (the husk, or a world whose fragment was taken) throws no light */
const spentWorld = (): boolean => !!ACTIVE.husk || ACTIVE !== worldById(ACTIVE.id);
/** heat fissure in a deep-band face: a fixed share of emberrock cells */
const isFissure = (t: number, x: number, y: number): boolean =>
  t === T.EMBERROCK && cellHash(x, y, 3) > 0.82;

const tmpM = new THREE.Matrix4();
const tmpP = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const DIRTY_RING: readonly (readonly [number, number])[] = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]];
const tmpE = new THREE.Euler();
const tmpC = new THREE.Color();

interface Spill { r: Float32Array; g: Float32Array; b: Float32Array; dx: Float32Array; dy: Float32Array; w: Float32Array }
const SPILL: Spill = {
  r: new Float32Array(CAP), g: new Float32Array(CAP), b: new Float32Array(CAP),
  dx: new Float32Array(CAP), dy: new Float32Array(CAP), w: new Float32Array(CAP),
};

/**
 * A seam's trunk runs along its local x from edge to edge, so turning it
 * square to a fissure next door joins the two into one vein; a lone seam
 * takes any eighth turn.
 */
function seamRoll(terrain: Terrain, x: number, y: number): number {
  const at = (dx: number, dy: number) => isFissure(terrain.get(x + dx, y + dy), x + dx, y + dy);
  const flip = cellHash(x, y, 29) > 0.5 ? Math.PI : 0;
  if (at(-1, 0) || at(1, 0)) return flip;
  if (at(0, -1) || at(0, 1)) return Math.PI / 2 + flip;
  return Math.floor(cellHash(x, y, 29) * 8) * (Math.PI / 4);
}

interface GemAnim {
  id: number; wx: number; wy: number; s: number; phase: number;
  spin: number; pulse: number; wobble: number; tilt: number; roll: number;
  z: number; dim: number; flat: boolean; sway: boolean;
}

class Chunk {
  rock: THREE.InstancedMesh;
  glow: THREE.InstancedBufferAttribute;              // per rock instance: halo colour from its ore
  wash: THREE.InstancedBufferAttribute;              // per rock instance: light from nearby pools/fissures
  washDir: THREE.InstancedBufferAttribute;           // ...and which way it comes from
  fl: THREE.InstancedBufferAttribute;                // per fluid instance: depth, surface, world x
  gems: THREE.InstancedMesh[];
  lava: THREE.InstancedMesh;
  group = new THREE.Group();
  rockIds = new Map<number, number>();              // local tile idx -> rock instance id
  gemIds = new Map<number, { c: number; i: number }>(); // local tile idx -> class + instance id
  gemAnim: GemAnim[][] = GEM_GEOS.map(() => []);
  cx = -1; cy = -1;
  chewLocal = -1;                                    // tile being drilled; animate skips it

  constructor() {
    // own copy of the shared box so it can carry this chunk's glow column
    const rockGeo = boxGeo.clone();
    this.glow = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 3), 3);
    rockGeo.setAttribute('glow', this.glow);
    this.wash = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 3), 3);
    this.washDir = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 2), 2);
    rockGeo.setAttribute('wash', this.wash);
    rockGeo.setAttribute('washDir', this.washDir);
    this.rock = new THREE.InstancedMesh(rockGeo, rockMat, CAP);
    const fluidGeo = lavaGeo.clone();
    this.fl = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 3), 3);
    fluidGeo.setAttribute('fl', this.fl);
    this.lava = new THREE.InstancedMesh(fluidGeo, lavaMat, CAP);
    this.gems = GEM_GEOS.map(geo => new THREE.InstancedMesh(geo, gemMat, GEM_CAP));
    for (const m of [this.rock, this.lava, ...this.gems]) {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      this.group.add(m);
    }
    // allocate color buffers up front
    this.rock.setColorAt(0, tmpC.setHex(0xffffff));
    for (const m of this.gems) m.setColorAt(0, tmpC.setHex(0xffffff));
  }

  build(terrain: Terrain, cx: number, cy: number): void {
    this.cx = cx; this.cy = cy;
    this.rockIds.clear(); this.gemIds.clear();
    for (const a of this.gemAnim) a.length = 0;
    this.chewLocal = -1;
    let nr = 0, nl = 0;
    (this.glow.array as Float32Array).fill(0);
    const ng = GEM_GEOS.map(() => 0);
    const x0 = cx * CHUNK, y0 = cy * CHUNK;
    const spent = spentWorld();
    const lit = this.spill(terrain, x0, y0, spent);

    for (let ly = 0; ly < CHUNK; ly++) {
      for (let lx = 0; lx < CHUNK; lx++) {
        const x = x0 + lx, y = y0 + ly;
        const t = terrain.get(x, y);
        if (t === T.AIR) continue;
        const wx = x + 0.5, wy = -(y + 0.5);
        const local = ly * CHUNK + lx;

        if (t === T.LAVA) {
          // rows of liquid above this one; the tile that meets air carries
          // the meniscus and sits a little below the rim
          let rows = 0;
          while (rows < 4 && terrain.get(x, y - rows - 1) === T.LAVA) rows++;
          const top = rows === 0 && terrain.get(x, y - 1) === T.AIR;
          if (top) tmpM.makeScale(1, 0.86, 1).setPosition(wx, wy - 0.07, 0);
          else tmpM.makeTranslation(wx, wy, 0);
          this.lava.setMatrixAt(nl, tmpM);
          this.fl.setXYZ(nl, rows, top ? 1 : 0, wx);
          nl++;
          continue;
        }

        // rock body — subtle deterministic jitter so lighting varies per cube.
        // Masonry is exempt: dressed stone sits flush and square, and that
        // wrongness is how the player reads "somebody built this".
        const h = cellHash(x, y, 3);
        const built = t === T.CUSTODIAN || t === T.GLYPH;
        const scale = t === T.BOULDER ? 0.965 : built ? 0.995 : 1;
        tmpP.set(wx, wy, built ? 0 : (h - 0.5) * 0.09);
        if (built) tmpE.set(0, 0, 0);
        else tmpE.set((cellHash(x, y, 11) - 0.5) * 0.09, 0, (cellHash(x, y, 13) - 0.5) * 0.09);
        tmpQ.setFromEuler(tmpE);
        tmpS.setScalar(scale);
        tmpM.compose(tmpP, tmpQ, tmpS);
        this.rock.setMatrixAt(nr, tmpM);
        // carved edges catch the light
        const exposed =
          terrain.get(x - 1, y) === T.AIR || terrain.get(x + 1, y) === T.AIR ||
          terrain.get(x, y - 1) === T.AIR || terrain.get(x, y + 1) === T.AIR;
        tmpC.setHex(rockColor(t, x, y));
        if (exposed) tmpC.multiplyScalar(1.22);
        this.rock.setColorAt(nr, tmpC);
        this.wash.setXYZ(nr, lit.r[local], lit.g[local], lit.b[local]);
        this.washDir.setXY(nr, lit.dx[local], lit.dy[local]);
        this.rockIds.set(local, nr);
        nr++;

        // gem overlay: per-ore shape class, size variance, spin phase
        const d = def(t);
        let gemColor = 0;
        let gemScale = 1;
        let cls = 0;
        let harvestable = true;
        if (d.ore || t === T.MIMIC || t === T.FROSTBLOOM) {
          cls = gemClassOf(t);
          gemColor = gemTintOf(t);
          haloOf(t, tmpC);
          this.glow.setXYZ(nr - 1, tmpC.r, tmpC.g, tmpC.b);
          gemScale = gemScaleOf(t) * (0.85 + cellHash(x, y, 17) * 0.3);
        } else if (isFissure(t, x, y)) {
          // heat fissure in the rock face: a seam running edge to edge with
          // branches, lying flush — never mistakable for a pickup. It turns
          // to meet a fissure next door so neighbouring seams join up.
          cls = CRACK_CLASS_0 + Math.floor(cellHash(x, y, 23) * CRACK_VARIANTS) % CRACK_VARIANTS;
          gemColor = ACTIVE.fluid.base;
          gemScale = 1;
          harvestable = false;
          if (!spent) {
            // the seam's own stone burns softly behind it
            tmpC.setHex(ACTIVE.fluid.base).multiplyScalar(0.12);
            this.glow.setXYZ(nr - 1, tmpC.r, tmpC.g, tmpC.b);
          }
        }
        if (gemColor && ng[cls] < GEM_CAP) {
          const i = ng[cls]++;
          const mo = motionOf(cls);
          const anim: GemAnim = {
            id: i, wx, wy,
            s: gemScale,
            phase: h * Math.PI * 2,
            spin: harvestable ? mo.spin * (0.75 + cellHash(x, y, 5) * 0.5) : 0,
            pulse: harvestable ? mo.pulse : 0.04,
            wobble: harvestable ? mo.wobble : 0,
            tilt: (cellHash(x, y, 7) - 0.5) * 0.9,
            roll: !harvestable ? seamRoll(terrain, x, y)
              : mo.sway ? (cellHash(x, y, 29) - 0.5) * 0.8 : cellHash(x, y, 29) * Math.PI * 2,
            // a fissure rides the face of its own cube, which the jitter
            // above pushes forward (h > 0.82 puts it at z ≥ 0.529, tilted
            // ±0.045): at a flat 0.505 every one of them was inside the rock
            z: harvestable ? 0.46 : built ? 0.505 : 0.5 + (h - 0.5) * 0.09 + 0.04,
            // fissures burn hot (the seam's emit is baked high); a spent
            // world's stay as dim as they always were
            dim: harvestable ? 1 : spent ? 0.22 : 1,
            flat: !harvestable,
            sway: !!mo.sway,
          };
          this.gemAnim[cls].push(anim);
          this.poseGem(cls, anim, 0);
          this.gems[cls].setColorAt(i, tmpC.setHex(gemColor).multiplyScalar(anim.dim));
          this.gemIds.set(local, { c: cls, i });
        }
      }
    }

    this.rock.count = nr; this.lava.count = nl;
    this.rock.instanceMatrix.needsUpdate = true;
    this.lava.instanceMatrix.needsUpdate = true;
    if (this.rock.instanceColor) this.rock.instanceColor.needsUpdate = true;
    this.fl.needsUpdate = true;
    this.glow.needsUpdate = true;
    this.wash.needsUpdate = true;
    this.washDir.needsUpdate = true;
    this.gems.forEach((m, c) => {
      m.count = ng[c];
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    });
  }

  /**
   * Light that lands: every pool tile and heat fissure within reach of this
   * chunk throws its hue onto the rock around it (about two tiles for a
   * pool, one and a half for a seam), baked per rock instance at build. No
   * light, no draw call; darkness away from them is untouched.
   */
  private spill(terrain: Terrain, x0: number, y0: number, spent: boolean): Spill {
    const o = SPILL;
    o.r.fill(0); o.g.fill(0); o.b.fill(0); o.dx.fill(0); o.dy.fill(0); o.w.fill(0);
    if (spent) return o;
    const R = 3;
    for (let sy = y0 - R; sy < y0 + CHUNK + R; sy++) {
      for (let sx = x0 - R; sx < x0 + CHUNK + R; sx++) {
        const st = terrain.get(sx, sy);
        const pool = st === T.LAVA;
        if (!pool && !isFissure(st, sx, sy)) continue;
        const reach = pool ? 2.6 : 1.8, inner = pool ? 0.6 : 0.5;
        const k = pool ? 1 : 0.1;
        for (let ty = Math.max(y0, sy - R); ty <= Math.min(y0 + CHUNK - 1, sy + R); ty++) {
          for (let tx = Math.max(x0, sx - R); tx <= Math.min(x0 + CHUNK - 1, sx + R); tx++) {
            if (tx === sx && ty === sy) continue;
            const d = Math.hypot(tx - sx, ty - sy);
            if (d >= reach) continue;
            const u = (d - inner) / (reach - inner);
            const w = k * (1 - (u <= 0 ? 0 : u * u * (3 - 2 * u)));
            const i = (ty - y0) * CHUNK + (tx - x0);
            o.w[i] += w;
            // world y runs up while rows run down
            o.dx[i] += (sx - tx) * w / d;
            o.dy[i] += (ty - sy) * w / d;
          }
        }
      }
    }
    // even out the hues: cyan is three times as bright as molten orange,
    // and a pale wash beside a pale pool would blur the hazard's edge
    tmpC.setHex(ACTIVE.fluid.base);
    const lum = 0.2126 * tmpC.r + 0.7152 * tmpC.g + 0.0722 * tmpC.b;
    tmpC.multiplyScalar(Math.min(1, 0.26 / Math.max(lum, 1e-3)));
    for (let i = 0; i < CAP; i++) {
      if (o.w[i] <= 0) continue;
      // saturating: a whole basin next door is brighter than one cell, not 8×
      const s = 0.2 * (1 - Math.exp(-o.w[i]));
      o.r[i] = tmpC.r * s; o.g[i] = tmpC.g * s; o.b[i] = tmpC.b * s;
    }
    return o;
  }

  private poseGem(cls: number, a: GemAnim, time: number): void {
    // harvestable ore protrudes and turns; fissures lie flat in the rock face
    tmpP.set(a.wx, a.wy, a.z);
    if (a.flat) {
      tmpE.set(0, 0, a.roll);
    } else {
      tmpE.set(
        a.tilt + Math.sin(time * 0.9 + a.phase) * a.wobble,
        a.sway ? a.roll + Math.sin(time * a.spin + a.phase) * 0.45 : a.roll + time * a.spin,
        Math.cos(time * 0.7 + a.phase) * a.wobble
      );
    }
    tmpQ.setFromEuler(tmpE);
    const pulse = 1 + Math.sin(time * 1.8 + a.phase) * a.pulse;
    tmpS.setScalar(a.s * pulse);
    tmpM.compose(tmpP, tmpQ, tmpS);
    this.gems[cls].setMatrixAt(a.id, tmpM);
  }

  /** slow spin + glow pulse on every resource */
  animate(time: number): void {
    // the chewed gem's transform belongs to chew() — resolve it once, not
    // once per gem per frame (this loop runs hundreds of times a frame)
    const chewed = this.chewLocal >= 0 ? this.gemIds.get(this.chewLocal) : undefined;
    for (let c = 0; c < this.gems.length; c++) {
      const list = this.gemAnim[c];
      if (list.length === 0) continue;
      for (const a of list) {
        if (chewed && chewed.c === c && chewed.i === a.id) continue;
        this.poseGem(c, a, time);
      }
      this.gems[c].instanceMatrix.needsUpdate = true;
    }
  }

  /**
   * THE FOLD (SPEC-FOLD.md): the ACTUAL bricks of the mine break loose.
   * Every rock instance within `r` of the stone is thrown toward the
   * camera on a wave running outward — tumbling, shedding formation —
   * and its ore flies with it. k 0..1 drives the whole shatter; the
   * field restores by marking the chunk dirty (the same trick clearChew
   * uses), so the rebuild puts every brick home to the millimetre.
   */
  foldShatter(fx: number, fy: number, r: number, k: number): boolean {
    let touched = false;
    const x0 = this.cx * CHUNK, y0 = this.cy * CHUNK;
    for (const [local, rid] of this.rockIds) {
      const lx = local % CHUNK, ly = (local / CHUNK) | 0;
      const x = x0 + lx, y = y0 + ly;
      const wx = x + 0.5, wy = -(y + 0.5);
      const d = Math.hypot(wx - fx, wy - fy);
      if (d > r) continue;
      // the wave runs OUTWARD from the stone: near bricks let go first
      const f = Math.max(0, Math.min(1, k * (1 + r * 0.09) - d * 0.09));
      if (f <= 0) continue;
      touched = true;
      const e = 1 - Math.pow(1 - f, 3);
      const h1 = cellHash(x, y, 31), h2 = cellHash(x, y, 37), h3 = cellHash(x, y, 41);
      const ux = d > 0.01 ? (wx - fx) / d : 0, uy = d > 0.01 ? (wy - fy) / d : 0;
      tmpP.set(
        wx + ux * e * (1.5 + h1 * 2.5),
        wy + uy * e * (1.2 + h2 * 2) - e * e * 2.5,
        e * (6 + h3 * 13));                    // out of the screen, past the glass
      tmpE.set((h1 - 0.5) * 2.6 * e, (h2 - 0.5) * 2.6 * e, (h3 - 0.5) * 2.6 * e);
      tmpQ.setFromEuler(tmpE);
      tmpS.setScalar(1 - e * 0.12);
      tmpM.compose(tmpP, tmpQ, tmpS);
      this.rock.setMatrixAt(rid, tmpM);
      const gid = this.gemIds.get(local);
      if (gid) this.gems[gid.c].setMatrixAt(gid.i, tmpM);
    }
    if (touched) {
      this.rock.instanceMatrix.needsUpdate = true;
      for (const m of this.gems) m.instanceMatrix.needsUpdate = true;
    }
    return touched;
  }

  /** shrink + jitter the tile being drilled */
  chew(x: number, y: number, progress: number, time: number): void {
    const local = (y - this.cy * CHUNK) * CHUNK + (x - this.cx * CHUNK);
    this.chewLocal = local;
    const rid = this.rockIds.get(local);
    if (rid === undefined) return;
    const wx = x + 0.5, wy = -(y + 0.5);
    const s = 1 - progress * 0.42;
    const j = progress * 0.05;
    tmpP.set(
      wx + Math.sin(time * 71) * j,
      wy + Math.cos(time * 83) * j,
      0
    );
    tmpQ.identity();
    tmpS.setScalar(s);
    tmpM.compose(tmpP, tmpQ, tmpS);
    this.rock.setMatrixAt(rid, tmpM);
    this.rock.instanceMatrix.needsUpdate = true;
    const gid = this.gemIds.get(local);
    if (gid !== undefined) {
      tmpS.setScalar(s);
      this.gems[gid.c].setMatrixAt(gid.i, tmpM);
      this.gems[gid.c].instanceMatrix.needsUpdate = true;
    }
  }
}

export class ChunkField {
  /** frame-spike attribution: how many chunk builds this frame paid for */
  builtLastFrame = 0;
  /** set false when the player prefers reduced motion */
  animated = true;
  private live = new Map<number, Chunk>();
  private free: Chunk[] = [];
  private dirty = new Set<number>();

  constructor(private scene: THREE.Scene, private terrain: Terrain) {
    terrain.onChange = (x, y) => this.markDirty(x, y);
  }

  private key(cx: number, cy: number): number { return cy * CHUNKS_X + cx; }

  markDirty(x: number, y: number): void {
    // neighbors too: edge-highlighting of adjacent tiles can cross chunk seams
    for (const [dx, dy] of DIRTY_RING) {
      const cx = Math.floor((x + dx) / CHUNK), cy = Math.floor((y + dy) / CHUNK);
      if (cx >= 0 && cx < CHUNKS_X && cy >= 0) this.dirty.add(this.key(cx, cy));
    }
  }

  /** rebuild everything currently visible (used after load) */
  invalidateAll(): void {
    for (const k of this.live.keys()) this.dirty.add(k);
  }

  update(centerRow: number, time: number): void {
    const cy0 = Math.max(0, Math.floor((centerRow - VIEW_ROWS) / CHUNK));
    const cy1 = Math.min(Math.ceil(WORLD_ROWS / CHUNK) - 1, Math.floor((centerRow + VIEW_ROWS) / CHUNK));

    // retire out-of-range chunks
    for (const [k, ch] of this.live) {
      if (ch.cy < cy0 || ch.cy > cy1) {
        this.scene.remove(ch.group);
        this.free.push(ch);
        this.live.delete(k);
      }
    }

    // Collect what needs building, then spend a small per-frame budget on
    // it nearest-the-camera first. A fast fall used to cross a chunk
    // boundary and rebuild a whole world-row of chunks in ONE frame — the
    // deep-shaft hitch. Spread across frames, the work lands in the view
    // margin where a one-frame delay is invisible; a drilled (dirty)
    // chunk sits at the camera row, so it always sorts to the front.
    const work: { cx: number; cy: number; k: number }[] = [];
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = 0; cx < CHUNKS_X; cx++) {
        const k = this.key(cx, cy);
        if (!this.live.has(k) || this.dirty.has(k)) work.push({ cx, cy, k });
      }
    }
    this.builtLastFrame = 0;
    if (work.length) {
      const ccy = centerRow / CHUNK;
      work.sort((a, b) => Math.abs(a.cy + 0.5 - ccy) - Math.abs(b.cy + 0.5 - ccy));
      // a cold field (arrival, world change) fills whole behind the
      // transit cover; the budget only paces a field that is already warm
      let budget = this.live.size < 8 ? work.length : 2;
      this.builtLastFrame = Math.min(budget, work.length);
      for (const w of work) {
        if (budget-- <= 0) break;
        let ch = this.live.get(w.k);
        if (!ch) {
          ch = this.free.pop() ?? new Chunk();
          this.scene.add(ch.group);
          this.live.set(w.k, ch);
        }
        ch.build(this.terrain, w.cx, w.cy);
        this.dirty.delete(w.k);
      }
    }

    if (this.animated) {
      for (const ch of this.live.values()) ch.animate(time);
    }
  }

  chew(x: number, y: number, progress: number, time: number): void {
    const ch = this.live.get(this.key(Math.floor(x / CHUNK), Math.floor(y / CHUNK)));
    ch?.chew(x, y, progress, time);
  }

  private foldTouched = new Set<number>();

  /** drive the fold's brick-shatter across every live chunk */
  foldShatter(fx: number, fy: number, r: number, k: number): void {
    for (const [key, ch] of this.live) {
      if (ch.foldShatter(fx, fy, r, k)) this.foldTouched.add(key);
    }
  }

  /** every displaced brick goes home: the touched chunks simply rebuild */
  foldRestore(): void {
    for (const k of this.foldTouched) this.dirty.add(k);
    this.foldTouched.clear();
  }

  /** restore any half-chewed tile after a canceled drill (fuel ran out) */
  clearChew(): void {
    for (const [k, ch] of this.live) {
      if (ch.chewLocal >= 0) {
        ch.chewLocal = -1;
        this.dirty.add(k);
      }
    }
  }
}
