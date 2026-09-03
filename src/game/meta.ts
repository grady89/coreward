// The Keeping: everything a driller holds onto across expeditions, persisted
// separately from the run save (settings.ts pattern) so NEW EXPEDITION and
// save wipes never touch it. Keeplight (❖) is light banked instead of spent —
// deposits only, never withdrawn, and the sole currency for legacy purchases:
// cosmetics, furnishings, sponsorships. Run Lumens stay operational money.

const KEY = 'coreward_meta_v1';

/** ✦ per ❖ — the exchange is steep on purpose; banking is the endgame sink */
export const KEEP_RATE = 100;
export const KEEP = '❖';
export const fmtKeep = (n: number): string => KEEP + Math.round(n).toLocaleString();

export interface Trophy {
  /** tile enum value of the ore that was cut */
  t: number;
  /** 1 = FINE, 2 = FLAWLESS */
  grade: number;
  /** world id where the ore was assayed */
  world: string;
}

export interface Meta {
  keeplight: number;
  lifetimeBanked: number;
  /** cosmetic ids owned (finishes, flames, tints, sparks) */
  owned: string[];
  /** equipped ids — '' means stock */
  finishRig: string;
  finishSuit: string;
  flame: string;
  lampTint: string;
  spark: string;
  /** furnishing / wing / palette ids owned */
  furnishings: string[];
  /** equipped interior palette — '' means dusk (stock) */
  palette: string;
  trophies: Trophy[];
  /** fauna ids ever sponsored — residents, even in a fresh expedition */
  sponsored: string[];
  stipendsLifetime: number;
}

const DEFAULTS: Meta = {
  keeplight: 0,
  lifetimeBanked: 0,
  owned: [],
  finishRig: '',
  finishSuit: '',
  flame: '',
  lampTint: '',
  spark: '',
  furnishings: [],
  palette: '',
  trophies: [],
  sponsored: [],
  stipendsLifetime: 0,
};

/**
 * Dev harnesses (?core / ?fauna / ?vault) mark their session ephemeral so
 * handouts never reach the real save; the meta store honors the same law.
 * Locked once, never unlocked — a dev session stays a dev session.
 */
let locked = false;
export function lockMeta(): void { locked = true; }
export const metaLocked = (): boolean => locked;

export function loadMeta(): Meta {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { return { ...DEFAULTS }; }
}

export function saveMeta(m: Meta): void {
  if (locked) return;
  try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* the light was still kept */ }
}

/** deposit run money into the bank; returns ❖ minted (0 if under the rate) */
export function bank(m: Meta, lumens: number): number {
  const minted = Math.floor(lumens / KEEP_RATE);
  if (minted <= 0) return 0;
  m.keeplight += minted;
  m.lifetimeBanked += minted * KEEP_RATE;
  saveMeta(m);
  return minted;
}
