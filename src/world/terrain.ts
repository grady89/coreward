import { WORLD_W, WORLD_ROWS, CORE_ROW } from '../config';
import { T, strataSolidForRow } from './tiles';
import { ACTIVE } from './worlds';
import { WORLD_GLYPHS } from './glyphs';

// mulberry32 PRNG
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// smooth value noise built on a seeded lattice
class Noise2 {
  private perm: Uint8Array;
  constructor(seed: number) {
    const r = rng(seed);
    this.perm = new Uint8Array(512);
    const p = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }
  private lattice(x: number, y: number): number {
    return this.perm[(this.perm[x & 255] + y) & 255] / 255;
  }
  at(x: number, y: number): number {
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = x - xi, fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = this.lattice(xi, yi), b = this.lattice(xi + 1, yi);
    const c = this.lattice(xi, yi + 1), d = this.lattice(xi + 1, yi + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }
  fbm(x: number, y: number): number {
    return this.at(x, y) * 0.6 + this.at(x * 2.13 + 31, y * 2.13 + 7) * 0.4;
  }
}

// gaussian-ish depth window for ore probability
function window_(y: number, mid: number, halfRange: number, peak: number): number {
  const d = (y - mid) / halfRange;
  return peak * Math.exp(-d * d * 2.2);
}

const ORE_BANDS: { t: T; mid: number; half: number; peak: number }[] = [
  { t: T.COPPER, mid: 34, half: 34, peak: 0.052 },
  { t: T.IRON, mid: 85, half: 55, peak: 0.042 },
  { t: T.SILVER, mid: 155, half: 65, peak: 0.034 },
  { t: T.GOLD, mid: 235, half: 85, peak: 0.028 },
  { t: T.RUBY, mid: 320, half: 80, peak: 0.021 },
  { t: T.VOIDOPAL, mid: 385, half: 80, peak: 0.017 },
  { t: T.DIAMOND, mid: 440, half: 60, peak: 0.013 },
  { t: T.EMBERSHARD, mid: 478, half: 40, peak: 0.011 },
];

export class Terrain {
  readonly w = WORLD_W;
  readonly h = WORLD_ROWS;
  data: Uint8Array;
  seed: number;
  /** indices the player carved to AIR (save diff) */
  dug = new Set<number>();
  /** wrecked pods placed by the generator (loot state lives in the save) */
  wrecks: { x: number; y: number }[] = [];
  /** Lamplighter chamber centres, for proximity triggers */
  ruins: { x: number; y: number }[] = [];
  /** the Nine Stones: three carved doors per world, one per early hall */
  glyphStones: { x: number; y: number; id: string }[] = [];
  onChange: (x: number, y: number) => void = () => {};

  constructor(seed: number) {
    this.seed = seed;
    this.data = new Uint8Array(this.w * this.h);
    this.generate();
  }

  idx(x: number, y: number): number { return y * this.w + x; }

  generate(): void {
    // SITE 297: solid slag to the mantle. No caves, no ore, no fluids, no
    // wrecks, no ruins, no chamber. The drill has nothing to say here.
    if (ACTIVE.husk) {
      this.data.fill(T.VOIDROCK);
      return;
    }

    const r = rng(this.seed);
    const caveN = new Noise2(this.seed ^ 0x9e3779b9);
    const lavaN = new Noise2(this.seed ^ 0x51ed270b);

    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        let t: T = strataSolidForRow(y);

        // caves (never near the very top so the surface stays whole)
        if (y > 14 && caveN.fbm(x * 0.09, y * 0.09) > 0.665) t = T.AIR;

        // fluid pools deep down (magma / cryobrine / brine per world)
        if (y > 230 && lavaN.fbm(x * 0.13, y * 0.13) > ACTIVE.fluid.threshold) t = T.LAVA;

        if (t !== T.AIR && t !== T.LAVA) {
          const roll = r();
          // ores
          let placed = false;
          for (const band of ORE_BANDS) {
            const p = window_(y, band.mid, band.half, band.peak);
            if (roll < p) { t = band.t; placed = true; break; }
          }
          if (!placed) {
            if (y > 20 && roll > 0.978) t = T.BOULDER;
            else if (y > 60 && roll > 0.958 && roll <= 0.978) t = T.GAS;
          }
        }
        this.data[this.idx(x, y)] = t;
      }
    }

    // the world's native survival material, seeded through the UPPER strata
    // only — it is the reason a fully-kitted pod still has to work the shallows
    if (ACTIVE.native) {
      const nr = rng(this.seed ^ 0x4a71ce);
      for (let y = 18; y < 210; y++) {
        for (let x = 0; x < this.w; x++) {
          const i = this.idx(x, y);
          const t = this.data[i];
          if (t !== T.DIRT && t !== T.ROCK && t !== T.SLATE) continue;
          if (nr() < 0.035) this.data[i] = T.NATIVE;
        }
      }
    }

    // veinlight on cave walls: a fuel lifeline through the deep bands, thinning
    // out as the emberreach heat takes over
    for (let y = 150; y < 460; y++) {
      const chance = y < 300 ? 0.2 : 0.1;
      for (let x = 0; x < this.w; x++) {
        const i = this.idx(x, y);
        const host = this.data[i];
        if ((host === T.VOIDROCK || host === T.EMBERROCK) && this.touchesAir(x, y) && r() < chance) {
          // on the cold world some of the light in the walls is not veinlight
          this.data[i] = ACTIVE.id === 'cryos2' && r() < 0.22 ? T.FROSTBLOOM : T.FUNGUS;
        }
      }
    }

    // VEIL-3's geodes that aren't: seeded in the voidopal band, in plain rock,
    // wearing voidopal's swirl a shade off and a size too big
    if (ACTIVE.id === 'veil3') {
      const mr = rng(this.seed ^ 0x3a2a5a);
      for (let y = 280; y < 470; y++) {
        for (let x = 1; x < this.w - 1; x++) {
          const i = this.idx(x, y);
          const host = this.data[i];
          if ((host === T.VOIDROCK || host === T.EMBERROCK) && mr() < 0.0045) this.data[i] = T.MIMIC;
        }
      }
    }

    // Lamplighter ruins: the only right angles on the planet. Sealed vaults
    // of masonry with carved stones set into the walls.
    this.ruins.length = 0;
    this.glyphStones.length = 0;
    const ru = rng(this.seed ^ 0x5eed10);
    for (let i = 0; i < 7; i++) {
      const w = 8 + Math.floor(ru() * 6);
      const h = 5 + Math.floor(ru() * 4);
      const x0 = 3 + Math.floor(ru() * (this.w - w - 6));
      const y0 = 330 + Math.floor(ru() * 130);
      if (y0 + h >= CORE_ROW - 4) continue;
      for (let y = y0; y < y0 + h; y++) {
        for (let x = x0; x < x0 + w; x++) {
          const edge = y === y0 || y === y0 + h - 1 || x === x0 || x === x0 + w - 1;
          this.data[this.idx(x, y)] = edge ? T.CUSTODIAN : T.AIR;
        }
      }
      // the old scatter-seeding consumed these rolls; keep consuming them so
      // every save's world layout survives the Nine Stones rework unchanged
      const glyphs = 1 + Math.floor(ru() * 2);
      for (let g = 0; g < glyphs; g++) {
        ru(); ru();
      }
      this.ruins.push({ x: x0 + w / 2, y: y0 + h / 2 });
      // exactly one carved stone per hall for the first three halls, set into
      // the floor at the chamber's middle — a door you stand on, and every
      // precious thing the Lamplighters kept, they kept DOWN
      const ri = this.ruins.length - 1;
      const ids = WORLD_GLYPHS[ACTIVE.id];
      if (ids && ri < ids.length) {
        const gx = x0 + Math.floor(w / 2);
        const gy = y0 + h - 1;
        this.data[this.idx(gx, gy)] = T.GLYPH;
        this.glyphStones.push({ x: gx, y: gy, id: ids[ri] });
      }
    }

    // wrecked pods of earlier drillers, seeded through the caves
    this.wrecks.length = 0;
    const wr = rng(this.seed ^ 0x2d2d2d);
    let lastWreckY = -100;
    outer:
    for (let y = 36; y < 470; y++) {
      if (y - lastWreckY < 22) continue;
      for (let x = 2; x < this.w - 2; x++) {
        const i = this.idx(x, y);
        if (this.data[i] === T.AIR && this.data[this.idx(x, y - 1)] === T.AIR &&
          this.data[this.idx(x, y + 1)] !== T.AIR && this.data[this.idx(x, y + 1)] !== T.LAVA &&
          wr() < 0.3) {
          this.wrecks.push({ x, y });
          lastWreckY = y;
          if (this.wrecks.length >= 14) break outer;
          break;
        }
      }
    }

    // the core chamber: a carved cathedral, not a box — the vault arches
    // from a low mouth at each edge to a crest above the fragment, so the
    // last walk happens under a ceiling that rises with every step
    const ccx = this.w / 2;
    for (let x = 18; x < 46; x++) {
      const u = (x + 0.5 - ccx) / 14.5;
      const arch = Math.sqrt(Math.max(0, 1 - u * u));
      const h = 3 + Math.floor(arch * 13 + wr() * 1.3);
      for (let y = CORE_ROW + 10 - h; y < Math.min(this.h, CORE_ROW + 10); y++) {
        this.data[this.idx(x, y)] = T.AIR;
      }
    }
    // floor + shell of emberrock kept solid below
    for (let y = CORE_ROW + 10; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) this.data[this.idx(x, y)] = T.EMBERROCK;
    }
  }

  private touchesAir(x: number, y: number): boolean {
    return this.get(x - 1, y) === T.AIR || this.get(x + 1, y) === T.AIR ||
      this.get(x, y - 1) === T.AIR || this.get(x, y + 1) === T.AIR;
  }

  get(x: number, y: number): T {
    if (y < 0) return T.AIR;
    if (x < 0 || x >= this.w || y >= this.h) return T.BOULDER;
    return this.data[this.idx(x, y)] as T;
  }

  /** carve a tile to air (records the diff for saves) */
  carve(x: number, y: number): void {
    if (x < 0 || x >= this.w || y < 0 || y >= this.h) return;
    const i = this.idx(x, y);
    if (this.data[i] === T.AIR) return;
    this.data[i] = T.AIR;
    this.dug.add(i);
    this.onChange(x, y);
  }

  /**
   * something alive fills a dug tile back in (rime, nacre). Stays in `dug`
   * so saves know the tile was touched and can restore what it became.
   */
  fill(x: number, y: number, t: T): void {
    if (x < 0 || x >= this.w || y < 0 || y >= this.h) return;
    const i = this.idx(x, y);
    if (this.data[i] !== T.AIR) return;
    this.data[i] = t;
    this.dug.add(i);
    this.onChange(x, y);
  }

  applyDug(list: number[]): void {
    for (const i of list) {
      this.data[i] = T.AIR;
      this.dug.add(i);
    }
    // a door cannot be dug away: an old save that once drilled the tile a
    // stone now occupies gets the stone back, or 9/9 becomes unreachable
    for (const s of this.glyphStones) this.data[this.idx(s.x, s.y)] = T.GLYPH;
  }

  solidAt(x: number, y: number): boolean {
    const t = this.get(x, y);
    return t !== T.AIR && t !== T.LAVA;
  }
}
