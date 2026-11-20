// THE EMBER — the golden route, played in the real runtime.
//   node scripts/vaultplay.mjs --room=ember --port=4181 scripts/routes/ember.js
// Spawn to stone with no teleports: the dark is live from the gate down,
// every lantern, piston and shelf on its own clock. Each step names one beat
// of scripts/author-ember.py and lists the techniques a player might use;
// the planner takes the first (wait, technique) that works from wherever the
// last beat left the body. `lead` is how many seconds the dark was behind
// the body when each chase beat landed — the room's real margin.
const { v, N, I, row, settle, plan } = V;
settle(5);

const ok = (cond) => (c) => cond(c) ? true : null;
const grid = (base, axes) => { let out = [base]; for (const [key, vals] of Object.entries(axes)) out = out.flatMap(o => vals.map(val => ({ ...o, [key]: val }))); return out; };
const sparkIn = (s) => I({ left: s.dx < 0, right: s.dx > 0, up: s.dy > 0, down: s.dy < 0 });
// steer toward a column, braking against the air's lack of friction
const aim = (target, gain = 3) => { const want = Math.max(-5, Math.min(5, (target - v.px) * gain)); const d = want - v.vx; return { left: d < -0.4, right: d > 0.4 }; };
const on = (x0, x1, floorRow) => (c) => c.since > 3 && v.grounded && v.ridingCenser < 0 && Math.abs(v.vx) < 0.3 && v.px > x0 && v.px < x1 && Math.abs(row() - (floorRow - 0.52)) < 0.15;
const landOn = (x0, x1, fr) => (c) => (c.phase >= 1 && v.grounded && c.since > 3 && v.ridingCenser < 0)
  ? ((v.px > x0 && v.px < x1 && Math.abs(row() - (fr - 0.52)) < 0.15) ? true : 'land' + row().toFixed(0)) : null;
const walkTo = (x) => () => (Math.abs(v.px - x) < 0.15 && Math.abs(v.vx) < 0.3) ? N : I({ left: v.px > x + 0.1, right: v.px < x - 0.1 });
const at = (x) => ok(() => Math.abs(v.px - x) < 0.15 && Math.abs(v.vx) < 0.3);
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
// a lantern ride: jump for censer ci's crown, ride it, leave once it has
// swung past xr heading `dir`
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
// a trapdoor: walk onto the rime to `stop`, stand while it cracks, fall;
// fs steers the fall (-1 / 1 hugs a wall and slides)
const lid = ({ stop, fs, floor }) => (c) => {
  if (c.phase === 0) { if (v.px < stop) return I({ right: true }); c.phase = 1; c.since = 0; }
  if (v.grounded && row() > floor) return I({ left: v.vx > 0.2, right: v.vx < -0.2 });
  return I({ left: fs < 0, right: fs > 0 });
};
// the cascade: off P4, and on every rime landing jump again after `delay`
// frames (the shelf holds ~33), steering for the next shelf
const cascade = ({ jh, delay, gain }) => (c) => {
  if (c.phase === 0) { if (v.px > 38.3) return I({ left: true }); c.phase = 1; c.since = 0; c.stage = 0; }
  if (v.grounded && Math.abs(row() - 68.48) < 0.2) return I({ left: v.vx > 0.2, right: v.vx < -0.2 });
  if (v.grounded && c.since > 3 && row() > 60) {
    if (!c.onShelf) { c.onShelf = true; c.g = 0; c.stage++; }
    c.g++; if (c.g === delay) { v.jumpPress(); c.hopF = c.f; }
  } else c.onShelf = false;
  if (c.hopF != null && c.f - c.hopF === jh) v.jumpRelease();
  if (v.grounded && c.g < delay) return N;
  return I(aim([35.0, 30.0, 24.0][Math.min(2, c.stage)], gain));
};
// the column: off P5's east lip, hold column x `col` until under the roof's
// lip at row `turn`, then east — with a spark at row spR (0: legs only)
const column = ({ col, turn, spR }) => (c) => {
  if (c.phase === 0) { if (v.px < 25.6) return I({ right: true }); c.phase = 1; c.since = 0; }
  if (v.grounded && c.since > 3) return I({ right: true });
  if (spR && !c.sp && row() > spR) { c.sp = 1; c.spF = c.f; v.dash(I({ right: true })); }
  if (c.spF != null && c.f - c.spF < 4) return I({ right: true });
  return row() < turn ? I(aim(col)) : I({ right: true });
};
const threeBreaths = () => {
  const P = [];
  for (const f1 of [8, 16, 24]) for (const d1 of [0, 1]) for (const f2 of [24, 32, 40]) for (const d2 of [0, 1]) for (const f3 of [16, 24]) for (const d3 of [0, 1])
    P.push(tech({ dir: 1, edge: 21.4, sparks: [{ f: f1, dx: 1, dy: d1 }, { f: f1 + f2, dx: 1, dy: d2 }, { f: f1 + f2 + f3, dx: 1, dy: d3 }] }));
  return P;
};

const steps = [
  // ---- the teach, no wave ----
  ['1 the ice walk', grid({ dir: 1, run: true }, { edge: [9.0, 9.4], jh: [999, 8] }).map(tech),
    ok(() => v.px > 18.6 && v.px < 23 && v.grounded && Math.abs(row() - 5.48) < 0.15), { period: 1 }],
  ['1b to L1\'s lip', [walkTo(22.6)], at(22.6), { period: 1 }],
  ['2 the lantern', grid({ ci: 0, dir: 1, edge: 23.5 }, { xr: [32.3, 32.7], jh2: [8, 999], rel2: [999, 20] }).map(ride), on(34.8, 39, 8), { period: 153 }],
  ['3 trapdoor and piston', grid({ floor: 18 }, { stop: [40.5, 41.5, 39.4], fs: [0, 1] }).map(lid), on(33.8, 42, 21), { period: 204 }],
  ['3b back along L3', [walkTo(38)], at(38), { period: 1 }],
  ['4 two breaths', [[16, 0, 40], [16, 1, 36], [22, 0, 42], [10, 1, 36]].map(([f1, dy, f2]) =>
    tech({ dir: -1, edge: 34.3, sparks: [{ f: f1, dx: -1, dy }, { f: f2, dx: -1, dy: 1 }] })), landOn(18.8, 24, 18), { period: 1 }],
  ['4b the commit light', [walkTo(20.5)], ok(() => v.sconceLit.some(Boolean) && Math.abs(v.vx) < 0.3), { period: 1 }],
  // ---- the gate, and the dark ----
  ['5 the plunge', grid({ dir: -1, edge: 18.6, jh: 0 }, { sparks: [[{ f: 60, dx: -1, dy: 0 }], [{ f: 40, dx: -1, dy: 0 }]] }).map(tech),
    lead('plunge', landOn(3.6, 6.4, 40)), { period: 1 }],
  ['6 the ride', grid({ ci: 1, dir: 1 }, { edge: [5.2, 5.6], xr: [12.0, 13.0], jh2: [6, 999] }).map(ride),
    lead('ride', landOn(13.7, 17.9, 37)), { period: 153 }],
  ['6b to P2\'s lip', [walkTo(16.8)], at(16.8), { period: 1 }],
  ['7 the throat', grid({ floor: 50 }, { stop: [20.6, 19.5, 18.4], fs: [0, 1, -1] }).map(lid),
    lead('throat', (c) => (v.grounded && row() > 53 && Math.abs(v.vx) < 0.3) ? true : null), { period: 204 }],
  ['7b to P3\'s lip', [walkTo(18.5)], at(18.5), { period: 1 }],
  ['8 three breaths', threeBreaths(), lead('breaths', landOn(37.7, 43.3, 57)), { period: 1 }],
  ['8b to P4\'s lip', [walkTo(40)], at(40), { period: 1 }],
  ['9 the cascade', grid({}, { jh: [999, 14], delay: [1, 6], gain: [2, 4] }).map(cascade),
    lead('cascade', (c) => (v.grounded && Math.abs(row() - 68.48) < 0.2 && Math.abs(v.vx) < 0.3) ? true : null), { period: 1 }],
  ['9b to P5\'s lip', [walkTo(24)], at(24), { period: 1 }],
  ['10 the column, to the seed', grid({}, { col: [28.5, 26.5], turn: [87.5], spR: [88, 90] }).map(column), ok(() => v.completed), { period: 204, maxF: 400 }],
];
const r = plan(steps);
r.lead = LEAD.join(' ');
r.reforms = v.reforms;
return r;
