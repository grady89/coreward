// THE WEATHER — the golden route, played in the real runtime.
//   node scripts/vaultplay.mjs --room=weather [--port=4173] scripts/routes/weather.js
// Spawn to stone with no teleports: the real wind clock, doors, lamp,
// updraft and one-shot rime. Each step names one beat of the room
// (scripts/author-weather.py) and lists techniques; the planner takes the
// first (wait, technique) that works from where the last beat left the body.
//
// It carries its own planner because a rest point in this room is not
// always somewhere you can stand idle: V.plan waits with no input, and in a
// gust an idle body slides 2.1 tiles a second. planW lets a step wait
// leaning into the wind. The wind clock is 7 pulses (357 frames), so every
// step sweeps a whole calm and gust.
const { v, N, I, row, step, settle, snap, load, standAt } = V;
const PER = 357;                     // the wind's cycle: 7 pulses at 60 fps
const feet = () => row() + 0.52;
const onFloor = (x0, x1, fr) => () => v.grounded && v.ridingCenser < 0 && v.px > x0 && v.px < x1 && Math.abs(feet() - fr) < 0.1;
const settled = (x0, x1, fr) => (c) => c.since > 3 && Math.abs(v.vx) < 0.3 && onFloor(x0, x1, fr)();
const calmAt = () => (v.windT % 5.95);
function runSegW(s, w, hold, policy, goal, maxF = 900) {
  load(s);
  const r0 = v.reforms;
  for (let i = 0; i < w; i++) { step(typeof hold === 'function' ? hold() : I(hold)); if (v.reforms > r0) return { r: 'waitdead' }; }
  const c = { since: 0, phase: 0, f: 0 };
  for (let f = 0; f < maxF; f++) {
    c.since++; c.f = f;
    step(policy(c) ?? N);
    if (v.reforms > r0) return { r: 'dead', f, at: [+v.px.toFixed(1), +row().toFixed(1)] };
    const r = goal(c);
    if (r === true) return { r: 'ok', f: f + w };
    if (typeof r === 'string') return { r, f };
  }
  return { r: 'timeout' };
}
// leap: from rest, (run back for a run-up,) run to `edge` and jump; hold jh
// frames; spark at frame sp (aim up/flat); let the stick go at rel
function leap(dir, edge, { back = 0, jh = 999, sp = null, aim = 'up', rel = null, ctr = false, brake = true, hop = null } = {}) {
  const k = dir > 0 ? 'right' : 'left', kb = dir > 0 ? 'left' : 'right';
  return (c) => {
    if (c.phase === 0) c.phase = back > 0 ? -1 : (hop ? -3 : -2);
    if (c.phase === -1) { if ((edge - v.px) * dir >= back) c.phase = hop ? -3 : -2; return I({ [kb]: true }); }
    if (c.phase === -3) {
      if (!c.hopped && v.grounded) { v.jumpPress(); c.hopped = 1; c.hs = 0; }
      if (c.hopped) { c.hs++; if (c.hs === hop) v.jumpRelease(); if (c.hs > 3 && v.grounded) { c.phase = -2; v.jumpRelease(); } }
      return I({ [k]: true });
    }
    if (c.phase === -2) { if ((v.px - edge) * dir >= 0) { v.jumpPress(); c.phase = 1; c.since = 0; } return I({ [k]: true }); }
    if (c.since === jh) v.jumpRelease();
    if (sp != null && c.since === sp) v.dash(I({ [k]: true, up: aim === 'up', down: aim === 'down' }));
    if (sp != null && c.since >= sp && c.since < sp + 4) return I({ [k]: true, up: aim === 'up', down: aim === 'down' });
    if (v.grounded && c.since > 3) { v.jumpRelease(); return brake ? I({ [kb]: v.vx * dir > 0.2, [k]: v.vx * dir < -0.2 }) : N; }
    if (rel != null && c.since >= rel) return ctr ? I({ [kb]: true }) : N;
    return I({ [k]: true });
  };
}
// kick-climb a wall on `side`; past untilRow steer `exit`; brake once landed where land() says
function climb(side, T, untilRow, exit, { exitHold = 999, land = () => true } = {}) {
  return (c) => {
    if (c.phase === 0) { if (v.grounded) { v.jumpPress(); c.phase = 1; c.since = 0; } return I({ right: side > 0, left: side < 0 }); }
    if (c.phase === 1) {
      if (v.wallDir === side && v.vy < T && c.since > 6) { v.jumpRelease(); v.jumpPress(); c.since = 0; if (row() < untilRow) { c.phase = 2; c.since = 0; } }
      return I({ right: side > 0 && c.since > 5, left: side < 0 && c.since > 5 });
    }
    if (v.grounded && c.since > 3) v.jumpRelease();
    if (v.grounded && c.since > 3 && land()) return I({ left: v.vx > 0.2, right: v.vx < -0.2 });
    return (c.since < exitHold || v.grounded) ? I({ [exit > 0 ? 'right' : 'left']: true }) : N;
  };
}
const grid = (fn, axes) => { let out = [{}]; for (const [k, vals] of Object.entries(axes)) out = out.flatMap(o => vals.map(x => ({ ...o, [k]: x }))); return out.map(fn); };
function planW(steps) {
  const log = []; let total = 0;
  for (const [name, policies, goal, o = {}] of steps) {
    const s = snap(); const tally = {}; let done = false;
    const period = o.period ?? PER, st = o.st ?? 3, maxF = o.maxF ?? 900, hold = o.hold ?? {};
    for (let w = 0; w < period && !done; w += st) for (let k = 0; k < policies.length && !done; k++) {
      const res = runSegW(s, w, hold, policies[k], goal, maxF);
      if (res.r === 'ok') {
        done = true; total += res.f;
        log.push({ step: name, w, tech: k, frames: res.f, at: [+v.px.toFixed(1), +row().toFixed(1)], lit: v.sconceLit.map(b => b ? 1 : 0).join(''), doors: v.doorOpen.map(b => b ? 1 : 0).join(''), t: +calmAt().toFixed(2) });
      } else tally[res.r] = (tally[res.r] ?? 0) + 1;
    }
    if (!done) { load(s); log.push({ step: name, FAILED: true, tally, at: [+v.px.toFixed(1), +row().toFixed(1)] }); break; }
  }
  return { completed: v.phase === 'complete' || !!v.completed, seconds: +(total / 60).toFixed(1), reforms: v.reforms, log };
}
// C: pocket -> hop stub -> bridge (walk, or jump at je) -> C1 -> kick up the post -> over -> D0
const cpol = ({ hop, je, sp = null, T = 4 }) => (c) => {
  if (c.phase === 0) { if (v.grounded) { v.jumpPress(); c.phase = 1; c.since = 0; } return I({ right: true }); }
  if (c.phase === 1) { if (c.since === hop) v.jumpRelease(); if (c.since > 3 && v.grounded) c.phase = 2; return I({ right: true }); }
  if (c.phase === 2) { if (je && v.px >= je && v.grounded) { v.jumpPress(); c.phase = 3; c.since = 0; } else if (!je && v.px > 55.6) c.phase = 4; return I({ right: true }); }
  if (c.phase === 3) { if (sp && c.since === sp) v.dash(I({ right: true, up: true })); if (sp && c.since >= sp && c.since < sp + 4) return I({ right: true, up: true }); if (c.since > 3 && v.grounded) { v.jumpRelease(); c.phase = 4; } return I({ right: true }); }
  if (c.phase === 4) { if (v.grounded && v.px > 56.8) { v.jumpPress(); c.phase = 5; c.since = 0; } return I({ right: true }); }
  if (c.phase === 5) { if (v.wallDir === 1 && v.vy < T && c.since > 6) { v.jumpRelease(); v.jumpPress(); c.since = 0; if (row() < 14.5) c.phase = 6; } return I({ right: c.since > 5 }); }
  if (c.phase === 6) { if (v.grounded) { v.jumpRelease(); return feet() < 13.5 ? I({ right: true }) : I({ left: v.vx > 0.2, right: v.vx < -0.2 }); } return I({ right: c.since > 5 }); }
  return N;
};
// D: from the lip, hop into the updraft, ride, steer out east above row R; a perch on the spine waits for calm
const dpol = ({ R, steer }) => (c) => {
  if (c.phase === 0) { if (v.px >= 64.55) { v.jumpPress(); c.phase = 1; c.since = 0; } return I({ right: true }); }
  if (c.phase === 1) { if (v.px > 67.1) c.phase = 2; return I({ right: true }); }
  if (c.phase === 2) { if (row() < R) { c.phase = 3; c.since = 0; v.jumpRelease(); } return steer === 'hold' ? I({ right: true }) : steer === 'centre' ? I({ left: v.px > 68.2, right: v.px < 67.6 }) : N; }
  if (v.grounded && feet() > 8.5 && feet() < 9.5) { // on the spine's perch
    if (v.gusting) return N;
    v.jumpPress(); c.hopT = 0; return I({ right: true });
  }
  if (v.grounded && c.since > 3) { v.jumpRelease(); return v.gusting ? I({ right: true }) : I({ left: v.vx > 0.2, right: v.vx < -0.2 }); }
  return I({ right: true });
};
// E: pocket -> hop the stub -> the long leap (+spark) -> rime -> off its east end into the lane -> down, west, to the stone
const epol = ({ hop, sp, aim }) => (c) => {
  if (c.phase === 0) { if (v.grounded) { v.jumpPress(); c.phase = 1; c.since = 0; } return I({ right: true }); }
  if (c.phase === 1) { if (c.since === hop) v.jumpRelease(); if (c.since > 3 && v.grounded) c.phase = 2; return I({ right: true }); }
  if (c.phase === 2) { if (v.px >= 91.65) { v.jumpPress(); c.phase = 3; c.since = 0; } return I({ right: true }); }
  if (c.phase === 3) { if (c.since === sp) v.dash(I({ right: true, up: aim === 'up' })); if (c.since >= sp && c.since < sp + 4) return I({ right: true, up: aim === 'up' }); if (c.since > 3 && v.grounded) { v.jumpRelease(); c.phase = 4; } return I({ right: true }); }
  if (c.phase === 4) { if (feet() > 12) c.phase = 5; return I({ right: true }); }
  if (v.grounded && v.gusting) return I({ right: v.vx < 0 });          // wait the gust out in the lee
  if (v.grounded && c.blocked > 8) { v.jumpPress(); c.blocked = 0; c.hopF = 8; }
  if (c.hopF && --c.hopF === 0) v.jumpRelease();
  c.blocked = v.grounded && Math.abs(v.vx) < 0.05 ? (c.blocked ?? 0) + 1 : 0;
  if (feet() > 20) return I({ left: v.px > 101.9, right: v.px < 101.1 });
  return v.grounded ? I({ left: true }) : N;
};
settle(5);
// walk to x and stop there; in a gust, keep leaning into it
const walkTo = (x, tol = 0.15) => (c) => {
  if (v.gusting && Math.abs(v.px - x) < 1.2) return I({ right: true });
  if (v.px < x - tol) return I({ right: true, left: false });
  if (v.px > x + tol) return I({ left: true });
  return I({ left: v.vx > 0.3, right: v.vx < -0.3 });
};
const at = (x, fr, tol = 0.4) => (c) => c.since > 3 && v.grounded && Math.abs(v.px - x) < tol && Math.abs(feet() - fr) < 0.1 && Math.abs(v.vx) < 0.3;
const lean = () => I({ right: v.gusting });
const steps = [
  ['A0 into the first pocket', [walkTo(5.3)], at(5.3, 12), { period: 1, maxF: 300 }],
  ['A1 the first gap, in the calm', grid(o => leap(1, 8.7, o), { hop: [6, 10], jh: [999, 8], sp: [null, 10] }), settled(13, 19.7, 12)],
  ['A2a to the tower foot', [walkTo(18.6)], at(18.6, 12), { period: 1, maxF: 300 }],
  ['A2 lee climb, crest in the calm, onto H', grid(o => climb(1, o.T, o.R, 1, { land: () => feet() > 8 }), { T: [8, 4, 0], R: [6, 5, 4.5] }), settled(22, 27.7, 9)],
  ['B1a into H\'s pocket', [walkTo(26.8)], at(26.8, 9), { period: 1, maxF: 400 }],
  ['B1 the calm leap to F', grid(o => leap(1, 27.5, o), { back: [0, 1.2], sp: [24, 30, 36, 42, 18, 12], aim: ['up', 'flat'] }), settled(41, 43.7, 16)],
  ['B2a against the shut door', [walkTo(43.2)], at(43.2, 16), { period: 1, maxF: 300 }],
  ['B2 ride the gust west to G', grid(o => leap(-1, 41.3, o), { rel: [0, 12, null], sp: [null, 20, 35], aim: ['up', 'flat'] }), (c) => c.since > 3 && onFloor(21, 25.7, 19)() && v.doorOpen.every(Boolean) ? true : null],
  ['B3 up the lane through the hatch', grid(o => climb(-1, o.T, o.R, 1, { land: () => feet() < 9.5 }), { T: [8, 4, 0], R: [9, 8, 7] }), settled(24, 27.7, 9)],
  ['B1b into H\'s pocket', [walkTo(26.8)], at(26.8, 9), { period: 1, maxF: 400 }],
  ['B1 again, to F', grid(o => leap(1, 27.5, o), { back: [0, 1.2], sp: [24, 30, 36, 42, 18, 12], aim: ['up', 'flat'] }), settled(41, 43.7, 16)],
  ['C0 through the door to the pocket', [walkTo(48.2)], at(48.2, 16), { period: 1, maxF: 600 }],
  ['C the bridge in the calm, up the post', grid(cpol, { hop: [6, 10], je: [50.6, null, 51.5], T: [8, 2] }), settled(58.9, 64.7, 16)],
  ['D0 to the lip', [walkTo(64.2)], at(64.2, 16), { period: 1, maxF: 400 }],
  ['D the updraft', grid(dpol, { R: [8, 7, 6, 5], steer: ['none', 'hold', 'centre'] }), (c) => c.since > 3 && onFloor(70, 91, 7)() && Math.abs(v.vx) < 0.3 && !v.gusting, { hold: lean }],
  ['E0 the fourth light, to the last pocket', [walkTo(87.8)], at(87.8, 7), { period: 1, maxF: 900 }],
  ['E the last crossing, down to the stone', grid(epol, { hop: [6, 10], sp: [20, 28, 12, 36, 44], aim: ['up', 'flat'] }), () => v.phase === 'complete' ? true : null, { maxF: 700 }],
];
return planW(steps);
