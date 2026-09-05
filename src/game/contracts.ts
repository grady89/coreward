import { WORLDS } from '../world/worlds';
import { T } from '../world/tiles';

// Expedition contracts: fixed-seed challenge runs posted at the trade post.
// Accepting one takes a snapshot of the pod; the goal must be met before the
// clock (fuel-spend, depth, or wall time) runs out. Rewards are Lumens.

export type GoalKind = 'depth' | 'haul' | 'ore' | 'speed' | 'frugal';

export interface Contract {
  id: string;
  title: string;
  flavor: string;
  kind: GoalKind;
  target: number;        // meters / lumens / ore count (scaled at accept time)
  oreType?: T;           // for 'ore'
  limitSec?: number;     // wall-clock limit ('speed')
  /**
   * Fuel budget as a FRACTION OF YOUR OWN TANK, never an absolute number.
   * "One tank" has to mean one tank — an absolute cap becomes unwinnable the
   * moment you upgrade past it.
   */
  fuelCapFrac?: number;
  reward: number;
  worldId: string;       // which dig site posts it
  minBest: number;       // gated by record depth (m) so offers stay sane
}

/** deterministic per-day rotation so the board feels like a real posting */
function rot(seed: number, n: number): number {
  return Math.abs(Math.imul(seed ^ 0x9e3779b9, 2246822519)) % n;
}

export const POOL: Omit<Contract, 'id' | 'worldId'>[] = [
  {
    title: 'SHALLOW SWEEP', flavor: 'The refinery wants volume, not glory.',
    kind: 'haul', target: 900, reward: 700, minBest: 0,
  },
  {
    title: 'CORE SAMPLE', flavor: 'Survey needs a reading from the slate band.',
    kind: 'depth', target: 260, reward: 1200, minBest: 100,
  },
  {
    title: 'IRON QUOTA', flavor: 'Twelve loads of iron. The smelters are cold.',
    kind: 'ore', target: 12, oreType: T.IRON, reward: 1400, minBest: 80,
  },
  {
    title: 'THIN MARGINS', flavor: 'Prove a drill can pay for itself. One tank.',
    kind: 'frugal', target: 2000, fuelCapFrac: 0.9, reward: 2400, minBest: 150,
  },
  {
    title: 'FAST DESCENT', flavor: 'Beat the seismic window. Down and back.',
    kind: 'speed', target: 400, limitSec: 200, reward: 3200, minBest: 240,
  },
  {
    title: 'GOLD CONSIGNMENT', flavor: 'Eight of gold, no substitutes.',
    kind: 'ore', target: 8, oreType: T.GOLD, reward: 4200, minBest: 300,
  },
  {
    title: 'DEEP READING', flavor: 'Nobody has instrumented the veins. Be first.',
    kind: 'depth', target: 620, reward: 6500, minBest: 400,
  },
  {
    title: 'THE LONG HAUL', flavor: 'One run. Fill the hold. Do not come back light.',
    kind: 'haul', target: 26000, reward: 9000, minBest: 500,
  },
];

/**
 * Three offers, rotating daily. Gated two ways: minBest against the lifetime
 * record (so the board never posts jobs the pod can't do), and depth/speed
 * targets against THIS WORLD's depth — a contract you have already satisfied
 * by standing here is not a job, it is a coupon.
 */
export function offers(bestDepthM: number, worldDepthM: number, worldId: string, dayIndex: number): Contract[] {
  const fresh = (c: Omit<Contract, 'id' | 'worldId'>): boolean =>
    (c.kind !== 'depth' && c.kind !== 'speed') || c.target > worldDepthM;
  const eligible = POOL.filter(c => bestDepthM >= c.minBest && fresh(c));
  const usable = eligible.length >= 3 ? eligible : POOL.filter(fresh).slice(0, 3);
  const out: Contract[] = [];
  const used = new Set<number>();
  for (let i = 0; i < 3; i++) {
    let idx = rot(dayIndex * 31 + i * 7, usable.length);
    let guard = 0;
    while (used.has(idx) && guard++ < usable.length) idx = (idx + 1) % usable.length;
    used.add(idx);
    const base = usable[idx];
    const world = WORLDS.find(w => w.id === worldId)!;
    out.push({
      ...base,
      id: `${worldId}:${dayIndex}:${idx}`,
      worldId,
      reward: Math.round(base.reward * world.valueMul),
    });
  }
  return out;
}

export interface ActiveContract {
  c: Contract;
  startDepthM: number;
  startEarned: number;
  startFuelSpent: number;
  startedAt: number;      // seconds of play time
  /** goal resolved against the pod you had when you signed */
  target: number;
  /** absolute fuel budget, resolved from fuelCapFrac at accept time */
  fuelCap?: number;
  /**
   * Latched the instant the terms are satisfied. Once you have done the job,
   * nothing you do afterwards can un-do it — otherwise a driller who clears
   * the target early and keeps working loses the contract to their own
   * productivity, which is absurd.
   */
  met?: boolean;
}

/** resolve a posted contract against the pod signing for it */
export function accept(c: Contract, pod: {
  maxFuel: number; bestDepthM: number; totalEarned: number; fuelSpent: number; playTime: number;
}): ActiveContract {
  // a tank-relative goal scales with the tank it was written for
  const tankScale = c.fuelCapFrac !== undefined ? pod.maxFuel / 100 : 1;
  return {
    c,
    startDepthM: pod.bestDepthM,
    startEarned: pod.totalEarned,
    startFuelSpent: pod.fuelSpent,
    startedAt: pod.playTime,
    target: Math.round(c.target * tankScale),
    fuelCap: c.fuelCapFrac !== undefined ? Math.round(pod.maxFuel * c.fuelCapFrac) : undefined,
  };
}

export interface Progress { have: number; need: number; label: string; failed: boolean; met: boolean; }

export function evaluate(a: ActiveContract, s: {
  bestDepthM: number;
  /** depth reached on the CURRENT world — depth goals must be earned here,
   *  not inherited from a 1000m record on a world already finished */
  worldDepthM: number;
  totalEarned: number; fuelSpent: number; contractOre: number; now: number;
}): Progress {
  const c = a.c;
  const need = a.target ?? c.target;
  const elapsed = s.now - a.startedAt;
  const fuelUsed = s.fuelSpent - a.startFuelSpent;
  const overFuel = a.fuelCap !== undefined && fuelUsed > a.fuelCap;
  const overTime = c.limitSec !== undefined && elapsed > c.limitSec;
  const blown = !a.met && (overFuel || overTime);

  let have: number;
  let label: string;
  switch (c.kind) {
    case 'depth':
    case 'speed':
      have = Math.round(s.worldDepthM); label = 'DEPTH'; break;
    case 'ore':
      have = s.contractOre; label = 'ORE'; break;
    default:
      have = Math.round(s.totalEarned - a.startEarned); label = 'EARNED'; break;
  }
  return { have, need, label, failed: blown, met: !!a.met || (have >= need && !blown) };
}

export function timeLeft(a: ActiveContract, now: number): number | null {
  if (a.c.limitSec === undefined || a.met) return null;
  return Math.max(0, a.c.limitSec - (now - a.startedAt));
}

export function fuelLeft(a: ActiveContract, fuelSpent: number): number | null {
  if (a.fuelCap === undefined || a.met) return null;
  return Math.max(0, a.fuelCap - (fuelSpent - a.startFuelSpent));
}
