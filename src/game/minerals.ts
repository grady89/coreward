// What the gallery says about a stone.
//
// A cut stone standing on a pedestal is worth a sentence, and the sentence
// belongs on a placard beside it. Every number here is read back off the
// generator's own ore bands — depth, richness, rarity order — so a plaque can
// never drift from the rock it describes. The prose is the only part written
// by hand, and it stays clear of any one world's names for its strata: the
// stratum line underneath supplies whichever planet you are standing on.

import { CUR, TILE_M, WORLD_ROWS } from '../config';
import { def, oreValue, strataBand, T } from '../world/tiles';
import { ORE_BANDS } from '../world/terrain';
import { ACTIVE } from '../world/worlds';

/** the depth a stone keeps, in metres */
export interface DepthBand {
  /** shallowest and deepest a vein is worth looking for */
  lo: number;
  hi: number;
  /** where the band is richest */
  peak: number;
  /** the active world's name for the stratum at `peak` */
  stratum: string;
}

/** commonest first — the order the column hands them to you */
export const BY_RARITY: number[] = [...ORE_BANDS]
  .sort((a, b) => b.peak - a.peak)
  .map(b => b.t);

const RARITY_LABELS = [
  'COMMON', 'PLENTIFUL', 'UNCOMMON', 'SCARCE',
  'RARE', 'VERY RARE', 'EXCEPTIONAL', 'ALL BUT MYTHICAL',
];

/** 0 is the commonest stone in the column; higher is rarer */
export function rarityRank(t: number): number {
  const i = BY_RARITY.indexOf(t);
  return i < 0 ? BY_RARITY.length : i;
}

export function rarityLabel(t: number): string {
  return RARITY_LABELS[rarityRank(t)] ?? 'UNCATALOGUED';
}

/** where in the column a stone is found, in metres, or null if it has no band */
export function depthOf(t: number): DepthBand | null {
  const b = ORE_BANDS.find(o => o.t === t);
  if (!b) return null;
  const clamp = (row: number) => Math.max(0, Math.min(WORLD_ROWS, row));
  return {
    lo: clamp(b.mid - b.half) * TILE_M,
    hi: clamp(b.mid + b.half) * TILE_M,
    peak: clamp(b.mid) * TILE_M,
    stratum: ACTIVE.strata[strataBand(b.mid)],
  };
}

/** the one line under the name on the placard itself */
export function depthLine(t: number): string {
  const d = depthOf(t);
  return d ? `${Math.round(d.lo)}–${Math.round(d.hi)} m` : 'DEPTH UNRECORDED';
}

/** the placard's paragraph — what a curator would put behind the glass */
const BLURBS: Record<number, string> = {
  [T.COPPER]:
    'The first thing the drill finds and the last thing anyone brags about. Copper runs in green threads through the loose upper ground, shallow enough that a bad day still pays for the fuel that made it bad. Every rig on this rock was bought with somebody’s copper.',
  [T.IRON]:
    'Grey, plentiful and honest. Iron lies in sheets rather than veins, so you cut across it instead of into it, and one good seam fills a hold before the tank notices. The hull you are sitting in came out of a hole like the one you are standing in.',
  [T.SILVER]:
    'The first stone that looks like money. Silver precipitates into the hairline fractures of the middle rock — the places that rang under the impact and did not break. It tarnishes in a hold inside a week, which is why the assay office weighs it before you can argue.',
  [T.GOLD]:
    'Soft, heavy, and useless for building anything, which has never once slowed demand. Gold pools at the bottom of old cave systems the way water would, so the veins bend downhill. Follow one far enough and it will hand you to the deep whether you were ready or not.',
  [T.RUBY]:
    'Corundum, stained red by the same iron you were bored of two hundred metres higher up. It forms only where pressure and heat argue for a very long time, which is why nothing shallow has ever produced one. A ruby comes out of the rock looking lit from inside. It is not.',
  [T.VOIDOPAL]:
    'Nobody has explained voidopal. It holds a violet interference that the spectrometers read as three different colours depending on the hour, and it grows in the fracture zones where the strata stop making sense. Cut one, cradle it, and do not tell the catalogue how many you have.',
  [T.DIAMOND]:
    'Carbon, pressed by a whole planet for longer than there has been anyone to press it for. Diamonds ride up out of the deep rock in narrow pipes, so they arrive in company — find one and the next is close. The drill head costs more than the stone if you are careless with it.',
  [T.EMBERSHARD]:
    'Not a mineral. A piece of the thing that fell here, still holding its own heat centuries on, still faintly warm through a glove. Embershard occurs only within reach of the core, never in a vein, and has never been synthesised. It is worth whatever the buyer is frightened enough to pay.',
};

export function blurbOf(t: number): string {
  return BLURBS[t] ?? 'No assay office has ever written this one up. It sits here anyway, and it catches the light.';
}

/** the numbers under the prose, in the order the panel prints them */
export function facts(t: number): { name: string; val: string }[] {
  const d = depthOf(t);
  const rows: { name: string; val: string }[] = [
    // the word itself is the eyebrow above; this is where it sits in the order
    { name: 'In the column', val: `${rarityRank(t) + 1} of ${BY_RARITY.length}` },
  ];
  if (d) {
    rows.push({ name: 'Typical depth', val: `${Math.round(d.lo)}–${Math.round(d.hi)} m` });
    rows.push({ name: 'Richest at', val: `${Math.round(d.peak)} m · ${d.stratum}` });
  }
  rows.push({ name: 'Cut time', val: `${def(t).hardness.toFixed(2)} s at drill 1` });
  if (oreValue(t) > 0) rows.push({ name: 'Assay value', val: `${CUR}${oreValue(t).toLocaleString()} per unit` });
  return rows;
}
