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
  target: number;        // meters / lumens / ore count
  oreType?: T;           // for 'ore'
  limitSec?: number;     // wall-clock limit ('speed')
  fuelCap?: number;      // max fuel spend ('frugal', 'depth' variants)
  reward: number;
  worldId: string;       // which dig site posts it
  minBest: number;       // gated by record depth (m) so offers stay sane
}

/** deterministic per-day rotation so the board feels like a real posting */
function rot(seed: number, n: number): number {
  return Math.abs(Math.imul(seed ^ 0x9e3779b9, 2246822519)) % n;
}

const POOL: Omit<Contract, 'id' | 'worldId'>[] = [
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
    kind: 'frugal', target: 2000, fuelCap: 90, reward: 2400, minBest: 150,
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

/** three offers, rotating daily, filtered by the player's record depth */
export function offers(bestDepthM: number, worldId: string, dayIndex: number): Contract[] {
  const eligible = POOL.filter(c => bestDepthM >= c.minBest);
  const usable = eligible.length >= 3 ? eligible : POOL.slice(0, 3);
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
  startedAt: number;   // seconds of play time
}

export interface Progress { have: number; need: number; label: string; failed: boolean; }

export function evaluate(a: ActiveContract, s: {
  bestDepthM: number; totalEarned: number; fuelSpent: number; contractOre: number; now: number;
}): Progress {
  const c = a.c;
  const elapsed = s.now - a.startedAt;
  const fuelUsed = s.fuelSpent - a.startFuelSpent;
  const overFuel = c.fuelCap !== undefined && fuelUsed > c.fuelCap;
  const overTime = c.limitSec !== undefined && elapsed > c.limitSec;

  switch (c.kind) {
    case 'depth':
      return { have: Math.round(s.bestDepthM), need: c.target, label: 'DEPTH', failed: overFuel || overTime };
    case 'haul':
    case 'frugal':
      return {
        have: Math.round(s.totalEarned - a.startEarned), need: c.target,
        label: 'EARNED', failed: overFuel || overTime,
      };
    case 'ore':
      return { have: s.contractOre, need: c.target, label: 'ORE', failed: overFuel || overTime };
    case 'speed':
      return { have: Math.round(s.bestDepthM), need: c.target, label: 'DEPTH', failed: overTime };
  }
}

export function timeLeft(a: ActiveContract, now: number): number | null {
  if (a.c.limitSec === undefined) return null;
  return Math.max(0, a.c.limitSec - (now - a.startedAt));
}

export function fuelLeft(a: ActiveContract, fuelSpent: number): number | null {
  if (a.c.fuelCap === undefined) return null;
  return Math.max(0, a.c.fuelCap - (fuelSpent - a.startFuelSpent));
}
