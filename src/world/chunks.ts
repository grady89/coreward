import * as THREE from 'three';
import { CHUNK, WORLD_W, WORLD_ROWS } from '../config';
import { Terrain } from './terrain';
import { T, def, rockColor, cellHash } from './tiles';
import { ACTIVE } from './worlds';
import {
  GEM_GEOS, CRACK_CLASS_0, CRACK_VARIANTS, gemClassOf, gemScaleOf, motionOf,
} from './gemshapes';

// Terrain renderer: one 16×16 chunk = one InstancedMesh per material class.
// Chunks are pooled and rebuilt only when a tile inside them changes.
// Resource gems come in five shape classes and slowly spin + pulse.

const CHUNKS_X = WORLD_W / CHUNK;
const CAP = CHUNK * CHUNK;
const GEM_CAP = 48; // per shape class, per chunk
const VIEW_ROWS = 30; // rows above/below camera kept alive

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const lavaGeo = new THREE.BoxGeometry(0.94, 0.9, 0.94);

const rockMat = new THREE.MeshStandardMaterial({ roughness: 0.93, metalness: 0.04 });

// Ore is lit AND self-glowing: flat shading makes every facet read, while the
// emissive term is patched to follow each instance's colour so a gem still
// shines in a pitch-dark tunnel instead of flattening into a silhouette.
const gemMat = new THREE.MeshStandardMaterial({
  // vertexColors multiplies the tint every gem geometry now bakes in (crusts
  // dark, fissures bright) with the per-instance ore colour — and because the
  // emissive patch below rides vColor, a dark crust also glows less. Every
  // GEM_GEOS entry ships a color attribute; one without would render black.
  vertexColors: true,
  flatShading: true,
  roughness: 0.16,
  metalness: 0.55,
  emissive: 0xffffff,
  emissiveIntensity: 0.55,
});
gemMat.onBeforeCompile = shader => {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <emissivemap_fragment>',
    '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance *= vColor.rgb;'
  );
};
export const lavaMat = new THREE.MeshBasicMaterial({ color: 0xff5a2a, toneMapped: false });

const tmpM = new THREE.Matrix4();
const tmpP = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const DIRTY_RING: readonly (readonly [number, number])[] = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]];
const tmpE = new THREE.Euler();
const tmpC = new THREE.Color();

interface GemAnim {
  id: number; wx: number; wy: number; s: number; phase: number;
  spin: number; pulse: number; wobble: number; tilt: number; roll: number;
  z: number; dim: number; flat: boolean;
}

class Chunk {
  rock: THREE.InstancedMesh;
  gems: THREE.InstancedMesh[];
  lava: THREE.InstancedMesh;
  group = new THREE.Group();
  rockIds = new Map<number, number>();              // local tile idx -> rock instance id
  gemIds = new Map<number, { c: number; i: number }>(); // local tile idx -> class + instance id
  gemAnim: GemAnim[][] = GEM_GEOS.map(() => []);
  cx = -1; cy = -1;
  chewLocal = -1;                                    // tile being drilled; animate skips it

  constructor() {
    this.rock = new THREE.InstancedMesh(boxGeo, rockMat, CAP);
    this.lava = new THREE.InstancedMesh(lavaGeo, lavaMat, CAP);
    this.gems = GEM_GEOS.map(geo => new THREE.InstancedMesh(geo, gemMat, GEM_CAP));
    for (const m of [this.rock, this.lava, ...this.gems]) {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      this.group.add(m);
    }
    // allocate color buffers up front
    this.rock.setColorAt(0, tmpC.setHex(0xffffff));
    this.lava.setColorAt(0, tmpC.setHex(0xffffff));
    for (const m of this.gems) m.setColorAt(0, tmpC.setHex(0xffffff));
  }

  build(terrain: Terrain, cx: number, cy: number): void {
    this.cx = cx; this.cy = cy;
    this.rockIds.clear(); this.gemIds.clear();
    for (const a of this.gemAnim) a.length = 0;
    this.chewLocal = -1;
    let nr = 0, nl = 0;
    const ng = GEM_GEOS.map(() => 0);
    const x0 = cx * CHUNK, y0 = cy * CHUNK;

    for (let ly = 0; ly < CHUNK; ly++) {
      for (let lx = 0; lx < CHUNK; lx++) {
        const x = x0 + lx, y = y0 + ly;
        const t = terrain.get(x, y);
        if (t === T.AIR) continue;
        const wx = x + 0.5, wy = -(y + 0.5);
        const local = ly * CHUNK + lx;

        if (t === T.LAVA) {
          tmpM.makeTranslation(wx, wy, 0);
          this.lava.setMatrixAt(nl, tmpM);
          // vary from deep red to hot orange so pools read as molten, not flat
          const lh = 0.55 + cellHash(x, y, 9) * 0.55;
          this.lava.setColorAt(nl, tmpC.setRGB(lh, lh * 0.42, lh * 0.16));
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
          gemColor = t === T.FUNGUS ? ACTIVE.gemTint
            : t === T.NATIVE ? (ACTIVE.native?.color ?? d.gem) : d.gem;
          gemScale = gemScaleOf(t) * (0.85 + cellHash(x, y, 17) * 0.3);
        } else if (t === T.EMBERROCK && h > 0.82) {
          // heat fissure in the rock face: one of four branching patterns,
          // rotated per cell, lying flush — never mistakable for a pickup
          cls = CRACK_CLASS_0 + Math.floor(cellHash(x, y, 23) * CRACK_VARIANTS) % CRACK_VARIANTS;
          gemColor = ACTIVE.core.shell;
          gemScale = 0.8 + cellHash(x, y, 17) * 0.5;
          harvestable = false;
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
            roll: cellHash(x, y, 29) * Math.PI * 2,
            z: harvestable ? 0.46 : 0.505,
            // fissures glow like banked embers; carvings burn brighter
            dim: harvestable ? 1 : t === T.GLYPH ? 1.3 : 0.9,
            flat: !harvestable,
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
    if (this.lava.instanceColor) this.lava.instanceColor.needsUpdate = true;
    this.gems.forEach((m, c) => {
      m.count = ng[c];
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    });
  }

  private poseGem(cls: number, a: GemAnim, time: number): void {
    // harvestable ore protrudes and turns; fissures lie flat in the rock face
    tmpP.set(a.wx, a.wy, a.z);
    if (a.flat) {
      tmpE.set(0, 0, a.roll);
    } else {
      tmpE.set(
        a.tilt + Math.sin(time * 0.9 + a.phase) * a.wobble,
        a.roll + time * a.spin,
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
    // build missing + dirty, animate the rest
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = 0; cx < CHUNKS_X; cx++) {
        const k = this.key(cx, cy);
        let ch = this.live.get(k);
        if (!ch) {
          ch = this.free.pop() ?? new Chunk();
          ch.build(this.terrain, cx, cy);
          this.scene.add(ch.group);
          this.live.set(k, ch);
          this.dirty.delete(k);
        } else if (this.dirty.has(k)) {
          ch.build(this.terrain, cx, cy);
          this.dirty.delete(k);
        }
        if (this.animated) ch.animate(time);
      }
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
