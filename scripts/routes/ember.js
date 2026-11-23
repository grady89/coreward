// THE EMBER v7 — the golden route, played in the real runtime.
//   node scripts/vaultplay.mjs --room=ember --port=4181 scripts/routes/ember.js
// Spawn to stone with no teleports: the dark is live from the gate down, and
// every lantern, piston and shelf runs on its own clock. Each step names one
// beat of scripts/author-ember.py and lists the techniques a player might
// use. The planner takes the first (wait, technique) that works from wherever
// the last beat left the body. `lead` is how many seconds the dark was behind
// the body when each chase beat landed. That is the room's real margin.
const { v, N, I, row, settle, plan } = V;
settle(5);

const ok = (cond) => (c) => cond(c) ? true : null;
const grid = (base, axes) => { let out = [base]; for (const [key, vals] of Object.entries(axes)) out = out.flatMap(o => vals.map(val => ({ ...o, [key]: val }))); return out; };
const sparkIn = (s) => I({ left: s.dx < 0, right: s.dx > 0, up: s.dy > 0, down: s.dy < 0 });
const on = (x0, x1, floorRow) => (c) => c.since > 3 && v.grounded && v.ridingCenser < 0 && Math.abs(v.vx) < 0.3 && v.px > x0 && v.px < x1 && Math.abs(row() - (floorRow - 0.52)) < 0.15;
const landOn = (x0, x1, fr) => (c) => (c.phase >= 1 && v.grounded && c.since > 3 && v.ridingCenser < 0)
  ? ((v.px > x0 && v.px < x1 && Math.abs(row() - (fr - 0.52)) < 0.15) ? true : 'land' + row().toFixed(0)) : null;
const walkTo = (x) => () => (Math.abs(v.px - x) < 0.15 && Math.abs(v.vx) < 0.3) ? N : I({ left: v.px > x + 0.1, right: v.px < x - 0.1 });
const at = (x) => ok(() => Math.abs(v.px - x) < 0.15 && Math.abs(v.vx) < 0.3 && v.grounded);
const LEAD = [];
const lead = (name, g) => (c) => {
  const r = g(c);
  if (r === true && v.pursuitOn) LEAD.push(name + ':' + ((row() - v.pursuitEdge) / v.def.pursuit.speed).toFixed(2) + 's');
  return r;
};

// run `dir`, jump at `edge` (jh frames held, 0 = walk off), steer until `rel`;
// sparks fire at frames after takeoff and their direction is held through the
// ignition freeze, the way a player holds the arrows while pressing spark.
// `run`: keep running on landing (rime); otherwise brake.
function tech({ dir, edge, jh = 999, rel = 999, sparks = [], run = false }) {
  const k = dir > 0 ? 'right' : 'left';
  return (c) => {
    if (c.phase === 0) {
      if ((dir > 0 && v.px >= edge) || (dir < 0 && v.px <= edge)) { if (jh > 0) v.jumpPress(); c.phase = 1; c.since = 0; }
      else return I({ [k]: true });
    }
    if (c.since === jh) v.jumpRelease();
    for (const s of sparks) {
      if (c.since === s.f) v.dash(sparkIn(s));
      if (c.since >= s.f && c.since < s.f + 4) return sparkIn(s);
    }
    if (v.grounded && c.since > 3 && v.ridingCenser < 0) return run ? I({ [k]: true }) : I({ left: v.vx > 0.2, right: v.vx < -0.2 });
    return I({ [k]: c.since < rel });
  };
}
// a lantern ride: jump for censer ci's crown (jh1 frames held), ride it, and
// leave once it has swung past xr heading `dir`
function ride({ ci, dir, edge, jh1 = 999, xr, jh2 = 999, rel2 = 999 }) {
  const k = dir > 0 ? 'right' : 'left';
  return (c) => {
    const cp = v.censerPos(ci);
    if (c.phase === 0) { if ((dir > 0 && v.px >= edge) || (dir < 0 && v.px <= edge)) { v.jumpPress(); c.phase = 1; c.since = 0; } else return I({ [k]: true }); }
    if (c.phase === 1) {
      if (c.since === jh1) v.jumpRelease();
      if (v.ridingCenser === ci) { c.phase = 2; c.since = 0; v.jumpRelease(); c.lx = cp.x; return N; }
      const dx = cp.x - v.px;
      return I({ left: dx < -0.15, right: dx > 0.15 });
    }
    if (c.phase === 2) {
      const moving = Math.sign(cp.x - c.lx); c.lx = cp.x;
      const past = dir > 0 ? cp.x >= xr : cp.x <= xr;
      if (v.ridingCenser === ci && past && (moving === dir || moving === 0)) { v.jumpPress(); c.phase = 3; c.since = 0; }
      else if (v.ridingCenser !== ci && c.since > 2) return 'fell';
      else return N;
    }
    if (c.since === jh2) v.jumpRelease();
    if (v.grounded && c.since > 3 && v.ridingCenser < 0) return I({ left: v.vx > 0.2, right: v.vx < -0.2 });
    return I({ [k]: c.since < rel2 });
  };
}
// a trapdoor: walk `dir` onto the rime to `stop`, stand while it cracks, fall;
// fs steers the fall (-1 / 1 hugs a wall and slides). `floor` is the row the
// body's centre passes once it has landed below.
const lid = ({ dir = 1, stop, fs, floor }) => (c) => {
  if (c.phase === 0) {
    if ((dir > 0 && v.px < stop) || (dir < 0 && v.px > stop)) return I({ right: dir > 0, left: dir < 0 });
    c.phase = 1; c.since = 0;
  }
  if (v.grounded && row() > floor) return I({ left: v.vx > 0.2, right: v.vx < -0.2 });
  return I({ left: fs < 0, right: fs > 0 });
};
// the last walk: run west over the rime and on along the stone
const runTo = (x) => (c) => (v.px > x) ? I({ left: true }) : I({ right: v.vx < -0.2 });
const threeBreaths = () => {
  const P = [];
  for (const f1 of [8, 16, 24]) for (const d1 of [0, 1]) for (const f2 of [20, 28, 36]) for (const d2 of [0, 1]) for (const f3 of [20, 28]) for (const d3 of [0, 1])
    P.push(tech({ dir: 1, edge: 23.4, sparks: [{ f: f1, dx: 1, dy: d1 }, { f: f1 + f2, dx: 1, dy: d2 }, { f: f1 + f2 + f3, dx: 1, dy: d3 }] }));
  return P;
};
const twoBreaths = () => {
  const P = [];
  for (const f1 of [6, 10, 16, 22]) for (const d1 of [0, 1]) for (const f2 of [16, 24, 32, 40]) for (const d2 of [0, 1])
    P.push(tech({ dir: -1, edge: 34.4, sparks: [{ f: f1, dx: -1, dy: d1 }, { f: f1 + f2, dx: -1, dy: d2 }] }));
  return P;
};

const TEACH = [
  ['1 the ice walk', grid({ dir: 1, run: true }, { edge: [9.0, 9.4], jh: [999, 8] }).map(tech),
    ok(() => v.px > 18.6 && v.px < 24 && v.grounded && Math.abs(row() - 5.48) < 0.15), { period: 1 }],
  ["1b to L1's lip", [walkTo(23.4)], at(23.4), { period: 1 }],
  ['2 the lantern', grid({ ci: 0, dir: 1, edge: 23.5 }, { xr: [32.3, 32.7], jh2: [8, 999], rel2: [999, 20] }).map(ride), on(34.8, 39, 8), { period: 153 }],
  ['3 trapdoor and piston', grid({ floor: 12 }, { stop: [40.5, 41.5, 39.4], fs: [0, 1] }).map(lid), on(33.8, 42, 13), { period: 204 }],
  ["3b to L3's west lip", [walkTo(34.6)], at(34.6), { period: 1 }],
  ['4 two breaths', twoBreaths(), landOn(15.8, 24.2, 13), { period: 1 }],
  ['4b the commit light', [walkTo(19.5)], ok(() => v.sconceLit.some(Boolean) && Math.abs(v.vx) < 0.3), { period: 1 }],
];
const CHASE = [
  ["4c to L4's west lip", [walkTo(16.6)], at(16.6), { period: 1 }],
  ['5 the plunge', grid({ dir: -1, edge: 16.4 }, { jh: [999, 14, 8] }).map(tech),
    lead('plunge', landOn(7.8, 12.2, 18)), { period: 1 }],
  ["5b to the lid's edge", [walkTo(8.6)], at(8.6), { period: 1 }],
  ['6 the throat', grid({ dir: -1, floor: 22 }, { stop: [6.0, 5.0, 7.0], fs: [0, -1, 1] }).map(lid),
    lead('throat', (c) => (v.grounded && row() > 22 && Math.abs(v.vx) < 0.3) ? true : null), { period: 204 }],
  ["6b to P3's lip", [walkTo(11.4)], at(11.4), { period: 1 }],
  ['7 the ride', grid({ ci: 1, dir: 1, edge: 11.5 }, { jh1: [4, 8, 999], xr: [18.6, 19.0], jh2: [6, 999] }).map(ride),
    lead('ride', landOn(20.7, 24, 23)), { period: 153 }],
  ["7b to P4's lip", [walkTo(23.4)], at(23.4), { period: 1 }],
  ['8 three breaths', threeBreaths(), lead('breaths', landOn(37.7, 41, 23)), { period: 1 }],
  ['8b down the slot', [walkTo(41.6)], lead('slot', ok(() => v.grounded && Math.abs(row() - 27.48) < 0.15 && Math.abs(v.vx) < 0.3)), { period: 1 }],
  ['8c off the ledge', [walkTo(36.4)], at(36.4), { period: 1 }],
  ['9 the last rime', grid({ dir: -1, run: true, edge: 31.3 }, { jh: [6, 10] }).map(tech),
    lead('rime', ok(() => v.grounded && v.px < 24 && Math.abs(row() - 29.48) < 0.15)), { period: 1 }],
  ['9b to the last piston', [walkTo(14.6)], at(14.6), { period: 1 }],
  ['10 under the last piston, to the stone', [runTo(5.5)], (c) => {
    if (!v.completed) return null;
    // the dark's lead over the last walk's course as you step down off it
    if (v.pursuitOn) LEAD.push('stone:' + ((29.48 - v.pursuitEdge) / v.def.pursuit.speed).toFixed(2) + 's');
    return true;
  }, { period: 204, maxF: 300 }],
];
const r = plan(TEACH);
const atS1 = V.snap();
const r2 = plan(CHASE);
r.completed = r2.completed; r.seconds = +(r.seconds + r2.seconds).toFixed(1); r.log.push(...r2.log);
r.lead = LEAD.join(' ');
r.reforms = v.reforms;
// The chase again from S1, leaving the light at eight times 76 frames apart:
// that spans the 612-frame common cycle of the lantern (153) and the pistons
// (204), so it is every phase a player who waits at S1 can meet.
r.sweep = [];
for (let d = 0; d < 8; d++) {
  V.load(atS1); settle(76 * d); LEAD.length = 0;
  const rs = plan(CHASE);
  r.sweep.push({ wait: 76 * d, completed: rs.completed, chase: rs.seconds, lead: LEAD.join(' ') });
}
V.load(atS1);
return r;
