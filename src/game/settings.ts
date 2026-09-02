// Player preferences, persisted separately from the run save so they survive
// NEW EXPEDITION and save wipes.

const KEY = 'coreward_settings_v1';

export type ThreatSetting = 'full' | 'reduced' | 'off';

export interface Settings {
  master: number;      // 0..1
  sfx: number;         // 0..1
  music: number;       // 0..1 (ambient drone bed)
  shake: boolean;
  hitstop: boolean;
  showFps: boolean;
  /** some players are here for the calm digging — let them have it */
  threats: ThreatSetting;
  /** the Nine Stones, gentler: slower hazards, thriftier jets. The message
   * is the reward, not the reflex — KINDLE stays reachable with this on. */
  vaultAssist: boolean;
}

const DEFAULTS: Settings = {
  master: 0.5,
  sfx: 1,
  music: 1,
  shake: true,
  hitstop: true,
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

export { DEFAULTS as DEFAULT_SETTINGS };
