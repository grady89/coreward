import { TRACKS, TrackKey, START_MONEY, ForgeKey } from '../config';
import { ActiveContract } from './contracts';
import { oreValue } from '../world/tiles';
import { Terrain } from '../world/terrain';

// v2 save: one pod, many worlds. Money/upgrades/cargo/fuel/hull travel with
// you; terrain diffs, position and wreck loot are per-world.

const SAVE_KEY = 'coreward_save_v2';
const SAVE_KEY_V1 = 'coreward_save_v1';

function trackValue(key: TrackKey, tier: number): number {
  const track = TRACKS.find(t => t.key === key)!;
  return track.tiers[Math.min(tier, track.tiers.length - 1)].v;
}

export interface WorldSave {
  seed: number;
  dug: number[];
  podX: number;
  podY: number;
  looted: number[];   // wreck indexes salvaged
  bestRow: number;    // deepest row reached here — the survey map's reveal line
}

export class GameState {
  money = START_MONEY;
  upgrades: Record<TrackKey, number> = { drill: 0, engine: 0, tank: 0, cargo: 0, hull: 0, radiator: 0 };
  fuel = trackValue('tank', 0);
  hull = trackValue('hull', 0);
  cargo = new Map<number, number>(); // tile type -> count
  bestDepthM = 0;
  totalEarned = 0;
  blocksDug = 0;
  milestones = new Set<string>();
  endedWorlds = new Set<string>();
  emberTech: Record<ForgeKey, boolean> = { updrill: false, dash: false, warp: false, converter: false };
  foundLogs = new Set<number>();
  hasScanner = false;
  hasDeepArray = false;
  /** deepest row reached in the ACTIVE world (survey reveal depth) */
  worldBestRow = 0;
  /** lifetime counters contracts measure against */
  fuelSpent = 0;
  oreMined = 0;
  playTime = 0;
  contract: ActiveContract | null = null;
  contractsDone = 0;
  contractDay = 0;
  /** ore of the contract's requested type mined since accepting */
  contractOre = 0;
  /** narrative event ids already delivered */
  firedEvents = new Set<string>();
  wrecksSalvaged = 0;
  veinlightHarvested = 0;
  sawRuins = false;
  flares = 0;
  charges = 0;
  /** carved stones recovered — the codex toward the Lamplighters' message */
  glyphs = 0;
  activeWorld = 'veil3';
  worlds: Record<string, WorldSave> = {};

  get maxFuel(): number { return trackValue('tank', this.upgrades.tank); }
  get maxHull(): number { return trackValue('hull', this.upgrades.hull); }
  get drillPower(): number { return trackValue('drill', this.upgrades.drill); }
  get drillTier(): number { return this.upgrades.drill; }
  get thrustMul(): number { return trackValue('engine', this.upgrades.engine); }
  get cargoCap(): number { return trackValue('cargo', this.upgrades.cargo); }
  get heatResist(): number { return trackValue('radiator', this.upgrades.radiator); }
  get forgeUnlocked(): boolean { return this.endedWorlds.size > 0; }

  get cargoCount(): number {
    let n = 0;
    for (const c of this.cargo.values()) n += c;
    return n;
  }

  get cargoValue(): number {
    let v = 0;
    for (const [t, c] of this.cargo) v += oreValue(t) * c;
    return v;
  }

  addCargo(t: number): boolean {
    if (this.cargoCount >= this.cargoCap) return false;
    this.cargo.set(t, (this.cargo.get(t) ?? 0) + 1);
    return true;
  }

  sellAll(rate = 1): number {
    const total = Math.round(this.cargoValue * rate);
    this.money += total;
    this.totalEarned += total;
    this.cargo.clear();
    return total;
  }

  /** sell one ore type's whole stack (per-row selling at the trade post) */
  sellStack(t: number): number {
    const c = this.cargo.get(t) ?? 0;
    const total = oreValue(t) * c;
    this.money += total;
    this.totalEarned += total;
    this.cargo.delete(t);
    return total;
  }

  /** spend embershards straight from cargo (the Forge's currency) */
  spendShards(n: number, shardTile: number): boolean {
    const have = this.cargo.get(shardTile) ?? 0;
    if (have < n) return false;
    if (have === n) this.cargo.delete(shardTile);
    else this.cargo.set(shardTile, have - n);
    return true;
  }

  /** back to a brand-new pod: used by NEW EXPEDITION (no page reload needed) */
  reset(): void {
    this.money = START_MONEY;
    this.upgrades = { drill: 0, engine: 0, tank: 0, cargo: 0, hull: 0, radiator: 0 };
    this.fuel = trackValue('tank', 0);
    this.hull = trackValue('hull', 0);
    this.cargo.clear();
    this.bestDepthM = 0;
    this.totalEarned = 0;
    this.blocksDug = 0;
    this.milestones.clear();
    this.endedWorlds.clear();
    this.emberTech = { updrill: false, dash: false, warp: false, converter: false };
    this.foundLogs.clear();
    this.hasScanner = false;
    this.hasDeepArray = false;
    this.worldBestRow = 0;
    this.fuelSpent = 0;
    this.oreMined = 0;
    this.playTime = 0;
    this.contract = null;
    this.contractsDone = 0;
    this.contractDay = 0;
    this.contractOre = 0;
    this.firedEvents.clear();
    this.wrecksSalvaged = 0;
    this.veinlightHarvested = 0;
    this.sawRuins = false;
    this.flares = 0;
    this.charges = 0;
    this.glyphs = 0;
    this.activeWorld = 'veil3';
    this.worlds = {};
  }

  // ---- persistence ----
  save(terrain: Terrain, podX: number, podY: number, looted: Set<number>): void {
    this.worlds[this.activeWorld] = {
      seed: terrain.seed,
      dug: [...terrain.dug],
      podX, podY,
      looted: [...looted],
      bestRow: this.worldBestRow,
    };
    this.persist();
  }

  persist(): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        v: 2,
        money: this.money,
        fuel: this.fuel,
        hull: this.hull,
        upgrades: this.upgrades,
        cargo: [...this.cargo.entries()],
        bestDepthM: this.bestDepthM,
        totalEarned: this.totalEarned,
        blocksDug: this.blocksDug,
        milestones: [...this.milestones],
        endedWorlds: [...this.endedWorlds],
        emberTech: this.emberTech,
        foundLogs: [...this.foundLogs],
        hasScanner: this.hasScanner,
        hasDeepArray: this.hasDeepArray,
        fuelSpent: this.fuelSpent,
        oreMined: this.oreMined,
        playTime: this.playTime,
        contract: this.contract,
        contractsDone: this.contractsDone,
        contractDay: this.contractDay,
        contractOre: this.contractOre,
        firedEvents: [...this.firedEvents],
        wrecksSalvaged: this.wrecksSalvaged,
        veinlightHarvested: this.veinlightHarvested,
        sawRuins: this.sawRuins,
        flares: this.flares,
        charges: this.charges,
        glyphs: this.glyphs,
        activeWorld: this.activeWorld,
        worlds: this.worlds,
      }));
    } catch { /* storage unavailable — play on */ }
  }

  static hasSave(): boolean {
    try { return localStorage.getItem(SAVE_KEY) !== null || localStorage.getItem(SAVE_KEY_V1) !== null; } catch { return false; }
  }

  /** restores all fields; returns true when a save was loaded */
  load(): boolean {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.v !== 2) return false;
        this.money = d.money; this.fuel = d.fuel; this.hull = d.hull;
        this.upgrades = { ...this.upgrades, ...d.upgrades };
        this.cargo = new Map(d.cargo);
        this.cargo.delete(9); // legacy veinlight in cargo — it is fuel now
        this.bestDepthM = d.bestDepthM; this.totalEarned = d.totalEarned;
        this.blocksDug = d.blocksDug;
        this.milestones = new Set(d.milestones);
        this.endedWorlds = new Set(d.endedWorlds);
        this.emberTech = { ...this.emberTech, ...d.emberTech };
        this.foundLogs = new Set(d.foundLogs);
        this.hasScanner = !!d.hasScanner;
        this.hasDeepArray = !!d.hasDeepArray;
        this.fuelSpent = d.fuelSpent ?? 0;
        this.oreMined = d.oreMined ?? 0;
        this.playTime = d.playTime ?? 0;
        this.contract = d.contract ?? null;
        this.contractsDone = d.contractsDone ?? 0;
        this.contractDay = d.contractDay ?? 0;
        this.contractOre = d.contractOre ?? 0;
        this.firedEvents = new Set(d.firedEvents ?? []);
        this.wrecksSalvaged = d.wrecksSalvaged ?? 0;
        this.veinlightHarvested = d.veinlightHarvested ?? 0;
        this.sawRuins = !!d.sawRuins;
        this.flares = d.flares ?? 0;
        this.charges = d.charges ?? 0;
        this.glyphs = d.glyphs ?? 0;
        this.activeWorld = d.activeWorld ?? 'veil3';
        this.worlds = d.worlds ?? {};
        return true;
      }
      // migrate a v1 save into the multi-world shape
      const raw1 = localStorage.getItem(SAVE_KEY_V1);
      if (raw1) {
        const d = JSON.parse(raw1);
        if (d.v !== 1) return false;
        this.money = d.money; this.fuel = d.fuel; this.hull = d.hull;
        this.upgrades = { ...this.upgrades, ...d.upgrades };
        this.cargo = new Map(d.cargo);
        this.bestDepthM = d.bestDepthM; this.totalEarned = d.totalEarned;
        this.blocksDug = d.blocksDug;
        // v1 milestones were stratum names; keep only the shape that still matters
        if (d.ended) this.endedWorlds.add('veil3');
        this.activeWorld = 'veil3';
        this.worlds.veil3 = { seed: d.seed, dug: d.dug, podX: d.podX, podY: d.podY, looted: [], bestRow: Math.round((d.bestDepthM ?? 0) / 2) };
        try { localStorage.removeItem(SAVE_KEY_V1); } catch { /* ignore */ }
        this.persist();
        return true;
      }
      return false;
    } catch { return false; }
  }

  static wipe(): void {
    try {
      localStorage.removeItem(SAVE_KEY);
      localStorage.removeItem(SAVE_KEY_V1);
    } catch { /* ignore */ }
  }
}
