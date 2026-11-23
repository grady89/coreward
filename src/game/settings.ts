// Player preferences, persisted separately from the run save so they survive
// NEW EXPEDITION and save wipes.

const KEY = 'coreward_settings_v1';

export type ThreatSetting = 'full' | 'reduced' | 'off';

export interface Settings {
  master: number;      // 0..1
  sfx: number;         // 0..1
  music: number;       // 0..1 (ambient drone bed)
  voiceDispatch: number;      // 0..1 — Dispatch's recorded lines
  voiceLamplighters: number;  // 0..1 — the codex's recorded lines
  shake: boolean;
  hitstop: boolean;
  /** controller vibration, for the pads that can do it */
  rumble: boolean;
  showFps: boolean;
  /** some players are here for the calm digging — let them have it */
  threats: ThreatSetting;
  /** the Nine Stones, gentler: hazards at six-tenths speed. The message
   * is the reward, not the reflex — KINDLE stays reachable with this on. */
  vaultAssist: boolean;
  /** soft glow around lava, ore and lights. Unset means the machine's
   * default (see bloomEnabled); a toggle in Settings saves an explicit value. */
  bloom?: boolean;
}

const DEFAULTS: Settings = {
  master: 0.5,
  sfx: 1,
  music: 1,
  voiceDispatch: 1,
  voiceLamplighters: 1,
  shake: true,
  hitstop: true,
  rumble: true,
  showFps: false,
  threats: 'full',
  vaultAssist: false,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: Settings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

/** bloom when the player has not chosen: on for a hardware GPU, off for a
 * software renderer (set once the renderer exists, see fx/post) */
let bloomDefault = true;
export function setBloomDefault(on: boolean): void { bloomDefault = on; }
export function bloomEnabled(s: Settings): boolean {
  return typeof s.bloom === 'boolean' ? s.bloom : bloomDefault;
}

export { DEFAULTS as DEFAULT_SETTINGS };
