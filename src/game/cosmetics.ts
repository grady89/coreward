// The paint locker: finish catalogs for the rig and the suit. Cosmetic only —
// no finish changes a single number in the simulation. Priced in Keeplight
// (❖): the one thing a driller buys with light they refused to spend.
// Stock entries cost 0 and are always owned; '' in meta means stock.

export interface RigFinish {
  id: string; name: string; desc: string; cost: number;
  hull: number; accent: number; steel: number;
  /** camo finishes paint the hull with a canvas patch texture */
  camo?: [string, string, string];
}

export interface SuitFinish {
  id: string; name: string; cost: number;
  suit: number; accent: number;
}

export interface FlameStyle { id: string; name: string; cost: number; inner: number; outer: number; }
export interface LampTint { id: string; name: string; cost: number; color: number; }
export interface SparkStyle { id: string; name: string; cost: number; color: number; }

// stock colors — must match the singletons in pod.ts / suit.ts
export const STOCK_RIG: RigFinish = {
  id: '', name: 'Yard Cream', desc: 'The lease finish. Cindral owns the paint too.',
  cost: 0, hull: 0xd8c9a4, accent: 0xff9a3c, steel: 0x3a3f4a,
};

export const RIG_FINISHES: RigFinish[] = [
  { id: 'jade', name: 'Jadeworks', desc: 'Sealed enamel the color of standing water. Pre-famine.', cost: 240,
    hull: 0x6ea183, accent: 0xd8b45a, steel: 0x3a4a42 },
  { id: 'emberline', name: 'Emberline', desc: 'Charcoal plate, magma trim. Emberreach colors.', cost: 300,
    hull: 0x46403a, accent: 0xff4d29, steel: 0x2c2a28 },
  { id: 'voidplate', name: 'Voidplate', desc: 'The Void Veins, worn on the outside.', cost: 360,
    hull: 0x352b4e, accent: 0x8a6cff, steel: 0x241d33 },
  { id: 'duskcamo', name: 'Duskline Camo', desc: 'Topsoil dazzle. Hides nothing down a shaft. Looks right.', cost: 450,
    hull: 0xc0a482, accent: 0x9c431c, steel: 0x3a3f4a,
    camo: ['#c0a482', '#8a5c38', '#5c4630'] },
  { id: 'gilt', name: 'Gilt', desc: 'Gold leaf over lease steel. The assayer will talk.', cost: 600,
    hull: 0xd8b45a, accent: 0x8a4a1c, steel: 0x6a5a3a },
  { id: 'prism', name: 'Prismhull', desc: 'Diamond-dust lacquer. Catches every lamp in the stratum.', cost: 900,
    hull: 0xdfeef2, accent: 0x7ae8ff, steel: 0x8a98a8 },
];

export const STOCK_SUIT: SuitFinish = { id: '', name: 'Yard Cream', cost: 0, suit: 0xd8c9a4, accent: 0xff9a3c };
export const SUIT_FINISHES: SuitFinish[] = [
  { id: 'slate', name: 'Slatebed', cost: 150, suit: 0x6a7684, accent: 0x3ce6c8 },
  { id: 'emberline', name: 'Emberline', cost: 150, suit: 0x46403a, accent: 0xff4d29 },
  { id: 'bone', name: 'Bonelight', cost: 150, suit: 0xe8e2d5, accent: 0x8a6cff },
];

export const STOCK_FLAME: FlameStyle = { id: '', name: 'Coolant Blue', cost: 0, inner: 0x6ad8ff, outer: 0x9adfff };
export const FLAME_STYLES: FlameStyle[] = [
  { id: 'ember', name: 'Ember Wash', cost: 120, inner: 0xffa53c, outer: 0xffd9a0 },
  { id: 'violet', name: 'Veinfire', cost: 120, inner: 0x8a6cff, outer: 0xb89aff },
  { id: 'teal', name: 'Fuel-True', cost: 120, inner: 0x3ce6c8, outer: 0x9af0e2 },
  { id: 'white', name: 'Starburn', cost: 120, inner: 0xf2f6ff, outer: 0xffffff },
];

export const STOCK_LAMP: LampTint = { id: '', name: 'Warmlight', cost: 0, color: 0xffe6c0 };
export const LAMP_TINTS: LampTint[] = [
  { id: 'moon', name: 'Moonlight', cost: 90, color: 0xcfe2ff },
  { id: 'sodium', name: 'Sodium', cost: 90, color: 0xffb35c },
  { id: 'veined', name: 'Veined', cost: 90, color: 0x9af0e2 },
];

/** drill spray keeps the rock's color on stock — a tint replaces it */
export const SPARK_STYLES: SparkStyle[] = [
  { id: 'gilded', name: 'Gilded Sparks', cost: 150, color: 0xffd27a },
  { id: 'void', name: 'Void Sparks', cost: 150, color: 0x8a6cff },
];

export const rigFinish = (id: string): RigFinish => RIG_FINISHES.find(f => f.id === id) ?? STOCK_RIG;
export const suitFinish = (id: string): SuitFinish => SUIT_FINISHES.find(f => f.id === id) ?? STOCK_SUIT;
export const flameStyle = (id: string): FlameStyle => FLAME_STYLES.find(f => f.id === id) ?? STOCK_FLAME;
export const lampTint = (id: string): LampTint => LAMP_TINTS.find(f => f.id === id) ?? STOCK_LAMP;
export const sparkStyle = (id: string): SparkStyle | null => SPARK_STYLES.find(f => f.id === id) ?? null;
