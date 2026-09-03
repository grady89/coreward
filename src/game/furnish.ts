// The Quarters catalog: furnishings, wings, and wall palettes. Every item is
// fixed-slot — buying it makes it appear at its home in the room. Owned ids
// live in meta.furnishings; the interior reads them at build time.

export interface Furnishing { id: string; name: string; desc: string; cost: number; }

export const WING_GALLERY = 'wing-gallery';
export const WING_VIVARIUM = 'wing-vivarium';

export const WINGS: Furnishing[] = [
  { id: WING_GALLERY, name: 'THE GALLERY', desc: 'An east wing of pedestals for cut stones. Light, kept where you can see it.', cost: 800 },
  { id: WING_VIVARIUM, name: 'THE VIVARIUM', desc: 'A far wing of standing tanks. Room for what lives down there.', cost: 800 },
];

export const FURNISHINGS: Furnishing[] = [
  { id: 'rug', name: 'WOVEN RUG', desc: 'Trade-post wool, dusk colors. The floor stops ringing.', cost: 40 },
  { id: 'lamp', name: 'ARC LAMP', desc: 'A standing lamp with a real filament. Extravagant.', cost: 45 },
  { id: 'plant', name: 'POTTED FERN', desc: 'Grown under the greenhouse dome. It leans toward your headlamp.', cost: 50 },
  { id: 'bunk', name: 'PROPER BUNK', desc: 'A mattress that was never a cargo liner. Sleep like the leased.', cost: 60 },
  { id: 'galley', name: 'GALLEY SET', desc: 'Kettle, two cups. In case anyone ever comes.', cost: 70 },
  { id: 'shelf', name: 'BOOK SHELF', desc: 'Paper survives where transmissions rot. Assay manuals, one novel.', cost: 80 },
  { id: 'radio', name: 'RADIO SET', desc: 'Off-shift channel. Mostly static, sometimes music.', cost: 90 },
  { id: 'chart', name: 'STAR CHART', desc: 'The arm as it was, every light still marked burning.', cost: 120 },
];

export interface WallPalette {
  id: string; name: string; cost: number;
  /** wall / trim / floor */
  wall: number; trim: number; floor: number;
}

export const STOCK_PALETTE: WallPalette = {
  id: '', name: 'DUSK', cost: 0,
  wall: 0x8d8474, trim: 0xc4571f, floor: 0x53565e,
};

export const WALL_PALETTES: WallPalette[] = [
  { id: 'slate', name: 'SLATEBED', cost: 200, wall: 0x64707c, trim: 0x3ce6c8, floor: 0x39454d },
  { id: 'rose', name: 'DUST ROSE', cost: 200, wall: 0x9c7e78, trim: 0xa83a24, floor: 0x5c5250 },
  { id: 'verdant', name: 'VERDANT', cost: 200, wall: 0x74836e, trim: 0xd8b45a, floor: 0x46503f },
];

export const wallPalette = (id: string): WallPalette =>
  WALL_PALETTES.find(p => p.id === id) ?? STOCK_PALETTE;
