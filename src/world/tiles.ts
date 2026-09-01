// Tile taxonomy: strata solids, hazards, ores.
import { ACTIVE } from './worlds';

export enum T {
  AIR = 0,
  DIRT = 1,
  ROCK = 2,       // regolith rock
  SLATE = 3,
  VOIDROCK = 4,
  EMBERROCK = 5,
  BOULDER = 6,
  LAVA = 7,
  GAS = 8,        // hidden pocket; bursts when cut
  FUNGUS = 9,     // veinlight: biolume harvested as fuel, never as cargo
  COPPER = 10,
  IRON = 11,
  SILVER = 12,
  GOLD = 13,
  RUBY = 14,
  VOIDOPAL = 15,
  DIAMOND = 16,
  EMBERSHARD = 17,
  RUBBLE = 18,    // collapsed stone from a seismic charge — soft, fast to redig
  CUSTODIAN = 19, // Lamplighter masonry: the only right angles down here
  GLYPH = 20,     // a carved stone; cutting one adds it to the codex
  NATIVE = 21,    // the world's own survival material — identity from ACTIVE
}

export interface TileDef {
  name: string;
  hardness: number;      // seconds to cut at drill power 1
  value: number;         // sale price; 0 = not an ore
  solid: boolean;
  ore: boolean;
  gem: number;           // gem mesh color (0 = no gem)
  oreTier: number;       // 0..7, drives pickup chime pitch
}

const D = (name: string, hardness: number, value: number, solid: boolean, ore: boolean, gem: number, oreTier = 0): TileDef =>
  ({ name, hardness, value, solid, ore, gem, oreTier });

export const TILE_DEFS: Record<number, TileDef> = {
  [T.AIR]: D('air', 0, 0, false, false, 0),
  [T.DIRT]: D('Dirt', 0.34, 0, true, false, 0),
  [T.ROCK]: D('Regolith', 0.55, 0, true, false, 0),
  [T.SLATE]: D('Slate', 0.85, 0, true, false, 0),
  [T.VOIDROCK]: D('Voidrock', 1.2, 0, true, false, 0),
  [T.EMBERROCK]: D('Emberrock', 1.6, 0, true, false, 0),
  [T.BOULDER]: D('Boulder', 2.8, 0, true, false, 0),
  [T.LAVA]: D('Magma', 0, 0, false, false, 0),
  [T.GAS]: D('Gas Pocket', 0.5, 0, true, false, 0),
  // value 0: veinlight pays in fuel, not lumens (see VEINLIGHT_FUEL)
  [T.FUNGUS]: D('Veinlight', 0.3, 0, true, true, 0x46e6c8, 0),
  [T.COPPER]: D('Copper', 0.6, 30, true, true, 0xe08a4a, 1),
  [T.IRON]: D('Iron', 0.75, 70, true, true, 0xc9cdd4, 2),
  [T.SILVER]: D('Silver', 0.95, 160, true, true, 0xeef2fb, 3),
  [T.GOLD]: D('Gold', 1.15, 400, true, true, 0xffd24a, 4),
  [T.RUBY]: D('Ruby', 1.4, 900, true, true, 0xff4a6a, 5),
  [T.VOIDOPAL]: D('Voidopal', 1.6, 2000, true, true, 0x8a6cff, 6),
  [T.DIAMOND]: D('Diamond', 1.9, 4500, true, true, 0x7ae8ff, 7),
  [T.EMBERSHARD]: D('Embershard', 2.2, 10000, true, true, 0xffa53c, 7),
  [T.RUBBLE]: D('Rubble', 0.16, 0, true, false, 0),
  [T.CUSTODIAN]: D('Lamplighter Stone', 5.5, 0, true, false, 0),
  [T.GLYPH]: D('Carved Stone', 1.8, 0, true, false, 0),
  // pays in survivability, never in lumens
  [T.NATIVE]: D('Native Deposit', 0.7, 0, true, true, 0xcfe8ff, 2),
};

/** the active world's name for its native material */
export function nativeName(): string {
  return ACTIVE.native?.ore ?? 'Native Deposit';
}

export const def = (t: number): TileDef => TILE_DEFS[t] ?? TILE_DEFS[T.AIR];

// ---- colors ----
// band index per stratum solid; actual colors come from the ACTIVE world
const BAND_OF: Record<number, number> = {
  [T.DIRT]: 0, [T.ROCK]: 1, [T.SLATE]: 2, [T.VOIDROCK]: 3, [T.EMBERROCK]: 4,
};
const BOULDER_COLOR = 0x6d7078;

function bandColor(t: number): number {
  if (t === T.BOULDER) return BOULDER_COLOR;
  if (t === T.RUBBLE) return 0x4a4038;
  // masonry reads pale and cold against every world's rock
  if (t === T.CUSTODIAN) return 0x9a94ae;
  if (t === T.GLYPH) return 0x7c7694;
  return ACTIVE.rockColors[BAND_OF[t] ?? 1];
}

/** sale value of an ore in the active world */
export function oreValue(t: number): number {
  return Math.round(def(t).value * ACTIVE.valueMul);
}

// what a gas pocket disguises as, per stratum solid
export function strataSolidForRow(row: number): T {
  if (row < 16) return T.DIRT;
  if (row < 60) return T.ROCK;
  if (row < 160) return T.SLATE;
  if (row < 300) return T.VOIDROCK;
  return T.EMBERROCK;
}

// deterministic per-cell hash → [0,1)
export function cellHash(x: number, y: number, salt = 0): number {
  let h = (x * 374761393 + y * 668265263 + salt * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// rgb helpers on packed ints
function lighten(c: number, f: number): number {
  const r = Math.min(255, Math.round(((c >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((c >> 8) & 255) * f));
  const b = Math.min(255, Math.round((c & 255) * f));
  return (r << 16) | (g << 8) | b;
}

/** color of the cube body for a tile at (x, y) with per-cell variance */
export function rockColor(t: number, x: number, y: number): number {
  let base: number;
  if (t === T.GAS) {
    // subtle greenish tell on the surrounding rock color
    const c = bandColor(strataSolidForRow(y));
    const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
    base = (r << 16) | (Math.min(255, Math.round(g * 1.14)) << 8) | Math.round(b * 0.9);
  } else if (def(t).ore && t !== T.FUNGUS) {
    // ore body = host rock, slightly dark so the gem pops
    base = lighten(bandColor(strataSolidForRow(y)), 0.82);
  } else if (t === T.FUNGUS) {
    base = lighten(ACTIVE.gemTint, 0.2);
  } else if (t === T.NATIVE) {
    base = lighten(bandColor(strataSolidForRow(y)), 1.18);
  } else {
    base = bandColor(t);
  }
  const v = 0.86 + cellHash(x, y) * 0.28; // ±14% variance
  return lighten(base, v);
}

// darker backwall shade per row (used by the canvas backdrop)
export function backwallColor(x: number, y: number): string {
  const host = y < 0 ? T.DIRT : strataSolidForRow(y);
  const c = lighten(bandColor(host), 0.34 + cellHash(x, y, 7) * 0.1);
  return '#' + c.toString(16).padStart(6, '0');
}
