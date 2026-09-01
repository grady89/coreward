// All tuning lives here. One place to balance the whole game.

export const GAME_NAME = 'COREWARD';

// universal colony scrip: Lumens — light is worth, worth is light
export const CUR = '✦';
export const CUR_NAME = 'LUMENS';
export const fmtMoney = (n: number): string => CUR + Math.round(n).toLocaleString();

// ---- world ----
export const WORLD_W = 64;          // tiles wide
export const WORLD_ROWS = 512;      // tiles deep
export const TILE_M = 2;            // meters per tile (HUD display)
export const CHUNK = 16;            // chunk side in tiles
export const CORE_ROW = 500;        // ember chamber begins here

// landing pad: undrillable plating, spawn/tow target — sits WEST of the fuel
// depot so the natural mine entrance (the gap between buildings) stays open
export const PAD_X0 = 12;
export const PAD_X1 = 15;
export const SPAWN_X = 14;
export const PAD_ROWS = 3;          // plating depth (rows protected from drilling)

// strata band boundaries (rows) — shared across worlds; names live per-world
export const BAND_FROM = [0, 16, 60, 160, 300, 490] as const;

export function stratumIndex(row: number): number {
  let idx = 0;
  for (let i = 0; i < BAND_FROM.length; i++) if (row >= BAND_FROM[i]) idx = i;
  return idx;
}

// ---- pod physics ----
export const GRAVITY = 21;
export const MAX_FALL = 25;
export const MAX_RISE = 14;
export const MAX_SIDE = 9;
export const SIDE_DRAG = 6.5;       // horizontal damping when no input
export const POD_W = 0.72;          // collision box
export const POD_H = 0.82;
export const FALL_SAFE = 13;        // impact speed with no damage
export const FALL_DMG = 7;          // dmg per unit speed over safe

// ---- resources ----
export const START_MONEY = 40;
export const FUEL_IDLE = 0.28;      // per second
export const FUEL_THRUST = 3.4;
export const FUEL_SIDE = 1.4;
export const FUEL_DRILL = 1.8;
export const FUEL_PRICE = 1.6;      // $ per unit
export const REPAIR_PRICE = 2.2;    // $ per hull point
export const LOW_FUEL_FRAC = 0.22;
// veinlight: living light, converted straight to fuel instead of cargo
export const VEINLIGHT_FUEL = 10;

// heat: rises past this row, damages hull beyond radiator resist
export const HEAT_START_ROW = 290;
export const HEAT_FULL_ROW = 500;
/**
 * dmg/sec at gauge 1.0 with no resist. High enough that pushing deep without
 * the right survival rig burns a whole hull in one trip — a firm economic
 * discouragement rather than an invisible wall.
 */
export const HEAT_DMG = 7.5;
export const LAVA_DMG = 24;         // dmg/sec touching lava
export const GAS_DMG = 16;          // per pocket burst

// death / rescue
export const DEATH_FEE_FRAC = 0.12;
export const RESCUE_FEE_FRAC = 0.15;
export const RESCUE_MIN_MONEY = 30; // below this, rescue is free

// ---- upgrades: 6 tracks, 5 tiers above base ----
export interface Tier { price: number; v: number; label: string; }
export interface Track { key: TrackKey; name: string; desc: string; unit: string; tiers: Tier[]; }
export type TrackKey = 'drill' | 'engine' | 'tank' | 'cargo' | 'hull' | 'radiator';

export const TRACKS: Track[] = [
  {
    key: 'drill', name: 'DRILL HEAD', desc: 'Cuts faster. Higher marks chew boulders.', unit: '× speed',
    tiers: [
      { price: 0, v: 1.0, label: 'Surplus Bit' },
      { price: 650, v: 1.55, label: 'Carbide Mk I' },
      { price: 2400, v: 2.3, label: 'Carbide Mk II' },
      { price: 8000, v: 3.3, label: 'Plasma Lance' },
      { price: 24000, v: 4.6, label: 'Void Cutter' },
      { price: 70000, v: 6.4, label: 'Emberfang' },
    ],
  },
  {
    key: 'engine', name: 'THRUSTERS', desc: 'Lift power and lateral response.', unit: '× thrust',
    tiers: [
      { price: 0, v: 1.0, label: 'Stock Jets' },
      { price: 550, v: 1.22, label: 'Tuned Jets' },
      { price: 2100, v: 1.5, label: 'Twin Turbine' },
      { price: 7200, v: 1.85, label: 'Vector Array' },
      { price: 21000, v: 2.25, label: 'Ion Cascade' },
      { price: 60000, v: 2.8, label: 'Star Drive' },
    ],
  },
  {
    key: 'tank', name: 'FUEL TANK', desc: 'Longer runs. Deeper returns.', unit: ' units',
    tiers: [
      { price: 0, v: 100, label: 'Rust Bucket' },
      // deliberately cheap: the stock tank makes the opening hours crawl, and
      // this is the purchase that gets a new driller off the starting block
      { price: 300, v: 155, label: 'Std. Cell' },
      { price: 2300, v: 235, label: 'Long-Haul' },
      { price: 7800, v: 350, label: 'Deep Reserve' },
      { price: 23000, v: 520, label: 'Cryo Column' },
      { price: 65000, v: 780, label: 'Singularity Cell' },
    ],
  },
  {
    key: 'cargo', name: 'CARGO BAY', desc: 'Haul more per trip.', unit: ' slots',
    tiers: [
      { price: 0, v: 10, label: 'Wire Basket' },
      { price: 500, v: 16, label: 'Std. Hold' },
      { price: 2000, v: 26, label: 'Expanded Hold' },
      { price: 7000, v: 40, label: 'Mag-Clamp Bay' },
      { price: 20000, v: 60, label: 'Graviton Hold' },
      { price: 58000, v: 90, label: 'Pocket Dimension' },
    ],
  },
  {
    key: 'hull', name: 'HULL PLATING', desc: 'Survive falls, gas and heat.', unit: ' HP',
    tiers: [
      { price: 0, v: 100, label: 'Scrap Plate' },
      { price: 700, v: 150, label: 'Steel Weave' },
      { price: 2600, v: 220, label: 'Titan Shell' },
      { price: 8600, v: 320, label: 'Composite Husk' },
      { price: 25000, v: 460, label: 'Void Lattice' },
      { price: 72000, v: 650, label: 'Ember Carapace' },
    ],
  },
  {
    key: 'radiator', name: 'RADIATORS', desc: 'Shed core heat. Required past 600m.', unit: ' resist',
    tiers: [
      { price: 0, v: 0, label: 'None' },
      { price: 900, v: 0.25, label: 'Fin Stack' },
      { price: 3200, v: 0.5, label: 'Coolant Loop' },
      { price: 10000, v: 0.78, label: 'Phase Exchanger' },
      { price: 28000, v: 1.05, label: 'Cryo Shroud' },
      { price: 76000, v: 1.4, label: 'Star Skin' },
    ],
  },
];

// which drill tier is needed to cut a boulder at a given row
export function boulderTierNeeded(row: number): number {
  if (row < 120) return 2;
  if (row < 260) return 3;
  if (row < 400) return 4;
  return 5;
}

// ---- Ember Forge: rule-breaking tech bought with embershards from cargo ----
export type ForgeKey = 'updrill' | 'dash' | 'warp' | 'converter';
export interface ForgeItem { key: ForgeKey; name: string; desc: string; cost: number; }
export const FORGE: ForgeItem[] = [
  { key: 'dash', name: 'BLINK COIL', desc: 'Shift — lateral dash. No fuel, short cooldown.', cost: 3 },
  { key: 'updrill', name: 'ASCENT COIL', desc: 'Hold up against a ceiling to drill upward.', cost: 5 },
  { key: 'converter', name: 'PYRO EXCHANGER', desc: 'Halves core damage and converts it to fuel.', cost: 6 },
  { key: 'warp', name: 'WARP HOLD', desc: 'C — teleport-sell your cargo from anywhere at 75% value.', cost: 8 },
];
export const WARP_RATE = 0.75;
// survey gear — bought separately for each dig site
export const SCANNER_PRICE = 1500;
export const DEEP_ARRAY_PRICE = 12000;
export const BEACON_PRICE = 3000;

// ---- consumables (bought at the fuel depot) ----
export const FLARE_PRICE = 45;
export const CHARGE_PRICE = 260;
export const CHARGE_FUSE = 2.6;      // seconds
export const CHARGE_BLAST = 3.2;     // tiles: creature kill radius
export const CHARGE_SEAL = 1.9;      // tiles: air turned to rubble
export const MAX_FLARES_HELD = 12;
export const MAX_CHARGES_HELD = 6;

/** carved stones needed before the Lamplighters' message resolves */
export const GLYPHS_TO_TRANSLATE = 9;

// ---- arrestors: deployable landing pads for your own shafts ----
export const ARRESTOR_PRICE = 900;
export const MAX_ARRESTORS = 4;
/**
 * The catch window must match the plate you can see. Wider than the plate and
 * it catches you over thin air — which then reads as nonsense when you fly
 * back up through the same spot.
 */
export const ARRESTOR_CATCH_X = 0.95;
export const ARRESTOR_CATCH_Y = 1.2;
/** keep pads clear of wrecks so the two meshes never occupy one tile */
export const ARRESTOR_CLEARANCE = 1.8;
export const DASH_SPEED = 20;
export const DASH_COOLDOWN = 2.2;

// ---- EVA ----
export const EVA_O2 = 45;          // seconds of oxygen
export const SALVAGE_TIME = 1.5;   // seconds holding the wreck open
/**
 * Spot a wreck from across the chamber, but salvage it only at arm's length.
 * The gap between these two numbers IS the EVA: park at distance, step out,
 * walk. If they were close together you would never leave the pod at all.
 */
export const WRECK_SPOT_RANGE = 9;
export const WRECK_SALVAGE_RANGE = 1.0;

// Found logs recovered from wrecked pods. DEPTH IS CHRONOLOGY: a wreck's
// `tier` is how deep it lies, and deeper means older. The player assembles the
// conspiracy out of order, the way you'd reassemble a shredded document.
// The unsigned driller's three-log reveal is split across worlds on purpose —
// it only resolves for someone who travels.
export interface WreckLog { title: string; text: string; tier: number; world?: string; }

export const WRECK_LOGS: WreckLog[] = [
  // --- tier 0: recent dead, still talking like workers ---
  { tier: 0, title: 'FOUND LOG — K. VASHTI', text: 'Tank at a quarter and I keep telling myself one more seam. It is not greed, whatever the assayer\'s face says. The refill costs more than the trip earned. So the trips get longer. That is just arithmetic, and arithmetic is what kills people down here.' },
  { tier: 0, title: 'FOUND LOG — UNSIGNED', text: 'Sold the ring at the trade post. The assayer did not ask and I did not offer. Down here nobody asks. The crust pays better than honesty ever did, and the lease is due on the sixth.' },
  { tier: 0, title: 'FOUND LOG — R. OKONKWO', text: 'Hit a gas pocket at 400 and the hull sang like a bell for an hour after. I am writing this so that someone knows I laughed. It was beautiful. I have not had a beautiful thing in a while.' },

  // --- tier 1: older, starting to notice ---
  { tier: 1, title: 'FOUND LOG — THE DEEP CREW', text: 'Six of us went down on company drills and company debts. The debts are paid now. Nobody topside believes what paid them, and Cindral has asked us — politely, in writing — to stop saying so.' },
  { tier: 1, title: 'FOUND LOG — M. ADEYEMI', text: 'My daughter asked what the light at the bottom looks like. I told her I would bring her a piece of it. Pods do not float, love. But promises do, and I have never broken one to you yet.' },
  { tier: 1, title: 'FOUND LOG — T. BREHM', text: 'Third rig in four years. Every one of them closed the same way: good ore, good ore, good ore, then a memo about exhausted reserves and a bus to the next rock. I have started writing down the names of the places.' },

  // --- tier 2: deep, and the unsigned driller's chain begins ---
  { tier: 2, title: 'FOUND LOG — UNSIGNED (1 OF 3)', text: 'I have the closure records for eleven Cindral sites. I want to be careful here, because I am tired and I have been alone for a long time and tired lonely people see patterns. But: none of the exhausted worlds are dark because the colony left. The colony left because the world went dark.' },
  { tier: 2, title: 'FOUND LOG — H. OYELARAN', text: 'If you are reading this, salvage the reserve cell and do not linger. The dark here is patient and you are not. Also — and I know how this reads — do not cut the stone that has corners. It is not stone.' },

  // --- tier 3: oldest, deepest, the truth ---
  { tier: 3, world: 'cryos2', title: 'FOUND LOG — UNSIGNED (2 OF 3)', text: 'It is not ore they want. I got into the assay dish\'s own logs. Every contract for two hundred years has one clause the driller never reads, and it is not about ore, it is about depth. They pay for depth. The ore is what keeps us digging for it.' },
  { tier: 3, world: 'maelis6', title: 'FOUND LOG — UNSIGNED (3 OF 3)', text: 'There is a thing in the core of every one of these worlds and it is what makes them worlds. Take it out and you get a rock with a graveyard on it. I am going down to look at ours because I have to know, and because my balance is eleven Lumens, and because there is nowhere left to go but down.' },
  { tier: 3, title: 'FOUND LOG — REGISTRY MATCH', text: 'The registry on this pod is yours. The handwriting is yours. The date has not happened yet. It says: I am sorry, and it was worth it, and do not believe the part where they tell you there was a choice.' },
];

/** which log tier a wreck at this row carries — deeper is older */
export function wreckTierForRow(row: number): number {
  if (row < 120) return 0;
  if (row < 250) return 1;
  if (row < 380) return 2;
  return 3;
}
