// THE RETURN — the golden route, played in the real runtime.
//   node scripts/vaultplay.mjs --room=return --port=4184 scripts/routes/return.js
//
// Spawn to stone in ONE life: no teleports, no checkpoint past the entry,
// every bolt, bridge, lantern and draught live. Each step names one beat of
// scripts/author-return.py and lists the techniques a player might use; the
// planner takes the first (wait, technique) that works from wherever the
// last beat left the body. Any re-form fails the step, because in this room a
// re-form is the whole run.
//
// Then the room's one rule, checked in the same runtime: a deliberate miss
// late in the run re-forms the body at the entry.
const { v, N, I, row, settle, snap, load, step, plan } = V;

// footings, from scripts/author-return.py (name: [x0, x1, floor row])
const F = { 'threshold': [1, 5, 42], 'first': [9, 10, 42], 'second': [13, 15, 40], 'crest': [19, 24, 28], 'post': [32, 32, 28], 'dry step': [37, 39, 24], 'high step': [43, 47, 16], 'far lip': [53, 55, 16], 'low a': [58, 59, 16], 'low b': [62, 63, 16], 'causeway': [65, 67, 16], 'post two': [73, 74, 16], 'post three': [79, 80, 14], 'turn step': [86, 88, 16], 'hook': [87, 88, 12], 'over': [93, 95, 9], 'bridge stone': [99, 101, 9], 'bridge a1': [104, 105, 11], 'island': [108, 112, 11], 'bridge b1': [116, 117, 9], 'bridge a2': [121, 122, 9], 'bridge b2': [125, 126, 7], 'perch': [129, 133, 7], 'lantern lip': [148, 154, 8], 'needle': [159, 159, 14], 'far ledge': [173, 178, 16], 'sill': [188, 189, 23], 'vent lip': [194, 199, 18], 'the return': [211, 211, 26] };
const RU = { right: true, up: true }, RR = { right: true }, RD = { right: true, down: true }, UP = { up: true };

const onF = (name) => { const [x0, x1, r] = F[name]; return v.grounded && v.ridingCenser < 0 && Math.abs(row() - (r - 0.52)) < 0.15 && v.px > x0 - 0.3 && v.px < x1 + 1.3; };
/** landed and stopped on `name`: true; landed and stopped anywhere else: a named failure */
const lands = (name, still = 0.05) => (c) => {
  if (!c.air || !v.grounded || Math.abs(v.vx) > still) return null;
  if (v.ridingCenser >= 0) return null;
  return onF(name) ? true : 'land@' + v.px.toFixed(1) + ',' + row().toFixed(1);
};
const rides = (c) => (v.ridingCenser === 0 ? ((c.rideF = (c.rideF ?? 0) + 1) > 4 ? true : null) : (c.rideF = 0, null));

/**
 * One technique as a plan() policy. p: {
 *   mark: walk to this x first and stop (a player setting up a run-up),
 *   dir, runF (frames of running before the press), hold, rel (stop steering),
 *   counter: [from, to] steer against dir (kill the momentum), steerFrom,
 *   spark: [frame, aim], spark2: [frame, aim] (after a brazier refills it),
 *   kick: { side, chimney, delay, until, after, afterLag } wall moves,
 *   vent: { k } ride a draught k frames then steer out,
 * }
 */
function mk(p) {
  const k = p.dir > 0 ? 'right' : 'left', kb = p.dir > 0 ? 'left' : 'right';
  return (c) => {
    if (!c.st) { c.st = 'mark'; c.js = -1; c.kSince = 99; c.wallF = 0; c.kickSide = p.kick?.side; c.air = 0; }
    if (!v.grounded) c.air++;
    if (c.st === 'mark') {
      if (p.mark === undefined) { c.st = 'run'; c.runT = 0; }
      else {
        const d = p.mark - v.px;
        // walk over and stop within a quarter tile: a player squaring up, not a teleport
        if (Math.abs(d) < 0.25 && Math.abs(v.vx) < 0.05) { c.st = 'run'; c.runT = 0; }
        else return Math.abs(d) < 0.25 ? N : I({ right: d > 0 && !(v.vx > 0 && d < 0.2), left: d < 0 && !(v.vx < 0 && d > -0.2) });
      }
    }
    if (c.st === 'run') {
      if (p.vent) {           // walk off into the draught, brake, rise, steer out
        c.runT++;
        if (c.air > 4 && v.grounded) return N;                       // on the lip: stop
        if (c.ventT === undefined) { if (v.px > p.vent.enter) c.ventT = 0; return I({ [k]: true }); }
        c.ventT++;
        if (c.ventT > p.vent.k) return I({ [k]: true });
        return I({ left: v.vx > 0.2, right: v.vx < -0.2 });
      }
      if (c.runT++ < (p.runF ?? 0)) return I({ [k]: true });
      v.jumpPress(); c.st = 'air'; c.js = 0;
    }
    const s = c.js++;
    if (s === (p.hold ?? 999)) v.jumpRelease();
    if (p.spark && s === p.spark[0]) v.dash(I(p.spark[1]));
    if (p.spark2 && s === p.spark2[0]) v.dash(I(p.spark2[1]));
    if (v.freezeT > 0) return I(p.spark2 && s >= p.spark2[0] ? p.spark2[1] : p.spark ? p.spark[1] : {});
    if (v.grounded && s > 4 && v.vy === 0 && c.st !== 'climb') return N;   // landed: let it stop
    if (p.kick && c.st === 'air') c.st = 'climb';
    if (c.st === 'climb') {
      const kk = p.kick;
      c.kSince++;
      c.wallF = v.wallDir === c.kickSide ? c.wallF + 1 : 0;
      if (v.wallDir === c.kickSide && c.kSince > 6 && c.wallF > (kk.delay ?? 0)) {
        v.jumpRelease(); v.jumpPress(); c.kSince = 0;
        if (row() < kk.until) { c.st = 'crest'; c.cT = 0; }
        if (kk.chimney) c.kickSide = -c.kickSide;
      }
      const t = c.kickSide;
      return I({ right: t > 0 && c.kSince > 5, left: t < 0 && c.kSince > 5 });
    }
    if (c.st === 'crest') {
      const a = p.kick.after, t = c.cT++;
      if (v.grounded) return N;
      return I({ right: a > 0 && t > (p.kick.afterLag ?? 5), left: a < 0 && t > (p.kick.afterLag ?? 5) });
    }
    const steer = s >= (p.steerFrom ?? 0) && s < (p.rel ?? 999);
    const ctr = p.counter && s >= p.counter[0] && s < p.counter[1];
    return I({ [k]: steer && !ctr, [kb]: !!ctr });
  };
}
const xp = (o) => { let out = [{}]; for (const [key, vs] of Object.entries(o)) out = out.flatMap(a => vs.map(x => ({ ...a, [key]: x }))); return out; };
const T = (o) => xp(o).map(mk);

settle(5);
const R = (a, b, st = 1) => { const o = []; for (let x = a; x <= b; x += st) o.push(x); return o; };
const steps = [
  // I · THE THRESHOLD
  ['1 threshold -> first', T({ mark: [1.5], dir: [1], runF: R(32, 70, 3) }), lands('first'), { period: 1 }],
  ['2 first -> second (rise 2)', T({ mark: [9.4], dir: [1], runF: R(0, 40, 4) }), lands('second'), { period: 1 }],
  ['3-8 second -> the chimney -> crest', T({ mark: [13.4], dir: [1], runF: [30, 36, 26, 40], kick: [2, 6, 10].map(d => ({ side: 1, chimney: true, until: 29, after: 1, delay: d })) }), lands('crest'), { period: 1 }],
  // II · THE STAIR
  ['9 crest -> post (spark, gap 7)', T({ mark: [19.5], dir: [1], runF: R(62, 83, 3), spark: [[8, RU], [12, RU]] }), lands('post'), { period: 1 }],
  ['10 post -> dry step (spark up 4)', T({ mark: [32.5], dir: [1], runF: [0], rel: [30, 999], spark: R(8, 14, 2).map(f => [f, RU]) }), lands('dry step'), { period: 1 }],
  ['11-15 the single wall -> high step', T({ mark: [37.4], dir: [1], runF: R(22, 40, 3), kick: [10, 2, 6].map(d => ({ side: 1, until: 17, after: 1, delay: d })) }), lands('high step'), { period: 1 }],
  // III · THE CROWN
  ['16 high step -> far lip (gap 5)', T({ mark: [43.6], dir: [1], runF: R(66, 86, 3) }), lands('far lip'), { period: 1 }],
  ['17 far lip -> low a', T({ mark: [53.4], dir: [1], runF: R(20, 52, 4), hold: [10, 8] }), lands('low a'), { period: 1 }],
  ['18 low a -> low b', T({ mark: [58.4], dir: [1], runF: R(8, 36, 4), hold: [8, 10] }), lands('low b'), { period: 1 }],
  ['19 low b -> causeway', T({ mark: [62.4], dir: [1], runF: R(6, 28, 4), hold: [10, 6] }), lands('causeway'), { period: 1 }],
  // IV · THE CAUSEWAY
  ['20 causeway -> post two (gap 5)', T({ mark: [65.4], dir: [1], runF: R(30, 60, 2) }), lands('post two'), { period: 1 }],
  ['21 post two -> post three (rise 2)', T({ mark: [73.4], dir: [1], runF: R(10, 40, 2) }), lands('post three'), { period: 1 }],
  ['22 post three -> turn step (gap 5)', T({ mark: [79.4], dir: [1], runF: R(10, 40, 2) }), lands('turn step'), { period: 1 }],
  // V · THE TURN
  ['23-24 turn step -> wall, kick back -> hook', T({ mark: [86.4], dir: [1], runF: [30, 24, 36], kick: [2, 6, 10].map(d => ({ side: 1, until: 99, after: -1, afterLag: 0, delay: d })) }), lands('hook'), { period: 1 }],
  ['25 hook -> over the wall', T({ mark: [87.5], dir: [1], runF: [0], spark: R(9, 16, 1).map(f => [f, RU]) }), lands('over'), { period: 1 }],
  ['26 over -> bridge stone (bolt)', T({ mark: [93.4], dir: [1], runF: [48, 44] }), lands('bridge stone'), { period: 102, step: 2 }],
  ['27 bridge stone -> a1', T({ mark: [99.4], dir: [1], runF: [30, 20], hold: [10, 999] }), lands('bridge a1'), { period: 204, step: 2 }],
  ['28 a1 -> island', T({ dir: [1], runF: [0, 6] }), lands('island'), { period: 102, step: 2 }],
  // VI · THE BRIDGES
  ['29 island -> b1', T({ mark: [108.4], dir: [1], runF: [60, 56, 64] }), lands('bridge b1'), { period: 204, step: 2 }],
  ['30 b1 -> a2', T({ dir: [1], runF: [6, 0] }), lands('bridge a2'), { period: 102, step: 2 }],
  ['31 a2 -> b2', T({ dir: [1], runF: [6, 0] }), lands('bridge b2'), { period: 102, step: 2 }],
  ['32 b2 -> perch', T({ dir: [1], runF: [0, 6] }), lands('perch'), { period: 102, step: 2 }],
  // VII · THE LANTERN
  ['33 perch -> the lantern', T({ mark: [131.5], dir: [1], runF: [20, 30], hold: [8, 999] }), rides, { period: 153, step: 1 }],
  ['34 ride -> lantern lip (spark)', T({ dir: [1], runF: [0], spark: [[20, RU], [14, RU], [10, RU]] }), lands('lantern lip'), { period: 153, step: 1 }],
  // VIII · THE FALL
  ['35 lantern lip -> needle (drop 6)', T({ mark: [151.5], dir: [1], runF: R(20, 44, 2), counter: [[30, 50], null], hold: [999, 10] }), lands('needle'), { period: 1 }],
  ['36 needle -> far ledge (brazier, two sparks)', T({ dir: [1], runF: [0], spark: [[4, RU]], spark2: R(66, 90, 2).map(f => [f, RU]) }), lands('far ledge'), { period: 1 }],
  // IX · THE VENT
  ['37 far ledge -> sill (spark onto drank stone)', T({ mark: [174.5], dir: [1], runF: [40, 50, 60], spark: R(28, 58, 2).map(f => [f, RR]) }), lands('sill'), { period: 1 }],
  ['38 sill -> the vent -> vent lip', T({ mark: [188.4], dir: [1], vent: R(20, 60, 10).map(k => ({ enter: 190.6, k })) }), lands('vent lip'), { period: 1 }],
  // X · THE LAST
  ['39 vent lip -> the stone (late spark)', T({ mark: [196.5], dir: [1], runF: [62, 56], spark: R(62, 80, 1).map(f => [f, RD]) }), (c) => (v.completed ? true : null), { period: 1, maxF: 400 }],
];
const a = plan(steps.slice(0, -1));
const late = snap();                  // on the vent lip, one reach from the stone
const b = a.log.some(l => l.FAILED) ? { completed: false, seconds: 0, log: [] } : plan(steps.slice(-1));
const run = { completed: b.completed, seconds: +(a.seconds + b.seconds).toFixed(1), log: [...a.log, ...b.log] };

// THE RULE: miss once, and you return. From that same lip, with the stone in
// sight, walk off toward it without jumping and see where the body comes back.
load(late);
const entry = { x: v.p.entry.x + 0.5, y: -(v.p.entry.y + 0.5) - 0.2 };
const r0 = v.reforms;
let f = 0;
for (; f < 600 && v.reforms === r0; f++) step(I({ right: true }));
const miss = {
  reformed: v.reforms === r0 + 1, frames: f,
  at: [+v.px.toFixed(2), +v.py.toFixed(2)], entry: [+entry.x.toFixed(2), +entry.y.toFixed(2)],
  atEntry: Math.hypot(v.px - entry.x, v.py - entry.y) < 0.05,
  checkpoint: v.checkpoint && [+v.checkpoint.x.toFixed(2), +v.checkpoint.y.toFixed(2)],
  sconces: v.p.sconces.length,
};
return { completed: run.completed, seconds: run.seconds, reformsInRun: r0, miss, log: run.log };
