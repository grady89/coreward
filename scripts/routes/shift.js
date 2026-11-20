// THE LAST SHIFT — the golden route, played in the real runtime.
//   node scripts/vaultplay.mjs --room=shift --port=4181 scripts/routes/shift.js
// Spawn to stone with no teleports: every watch-light, lantern and fading
// shelf on its own clock, every downdraft live. Each step names one beat of
// scripts/author-shift.py and lists the techniques a player might use; the
// planner takes the first (wait, technique) that works from wherever the
// last beat left the body.
const { v, N, I, row, settle, plan } = V;
settle(5);

const ok = (cond) => (c) => cond(c) ? true : null;
const grid = (base, axes) => { let out = [base]; for (const [key, vals] of Object.entries(axes)) out = out.flatMap(o => vals.map(val => ({ ...o, [key]: val }))); return out; };
const brake = () => I({ left: v.vx > 0.2, right: v.vx < -0.2 });
const on = (x0, x1, floorRow) => (c) => c.since > 3 && v.grounded && v.ridingCenser < 0 && Math.abs(v.vx) < 0.3 && v.px > x0 && v.px < x1 && Math.abs(row() - (floorRow - 0.52)) < 0.15;
const landOn = (x0, x1, fr) => (c) => (c.phase >= 1 && v.grounded && c.since > 3 && v.ridingCenser < 0)
  ? ((v.px > x0 && v.px < x1 && Math.abs(row() - (fr - 0.52)) < 0.15 && Math.abs(v.vx) < 0.3) ? true : (Math.abs(v.vx) < 0.3 ? 'land' + row().toFixed(0) + '@' + v.px.toFixed(0) : null)) : null;
const walkTo = (x) => () => (Math.abs(v.px - x) < 0.15 && Math.abs(v.vx) < 0.3) ? N : I({ left: v.px > x + 0.1, right: v.px < x - 0.1 });
const at = (x) => ok(() => Math.abs(v.px - x) < 0.15 && Math.abs(v.vx) < 0.3 && v.grounded);

// run `dir`, jump at `edge` (jh frames held, 0 = walk off), steer until
// `rel`, then brake on landing
function tech({ dir, edge, jh = 999, rel = 999, steer = 0, steerAt = 999 }) {
  const k = dir > 0 ? 'right' : 'left';
  return (c) => {
    if (c.phase === 0) {
      if ((dir > 0 && v.px >= edge) || (dir < 0 && v.px <= edge)) { if (jh > 0) v.jumpPress(); c.phase = 1; c.since = 0; }
      else return I({ [k]: true });
    }
    if (c.since === jh) v.jumpRelease();
    if (v.grounded && c.since > 3 && v.ridingCenser < 0) return brake();
    if (c.since >= steerAt) return I({ left: steer < 0, right: steer > 0 });
    return I({ [k]: c.since < rel });
  };
}
// a run of jumps `dir`: each [edge, jh] fires once the body passes edge on
// the ground; brake after the last landing
function chain(dir, jumps) {
  const k = dir > 0 ? 'right' : 'left';
  return (c) => {
    c.j = c.j ?? 0;
    const prev = jumps[c.j - 1];   // [edge, jh, rel] of the jump in the air
    if (prev && c.since === prev[1]) v.jumpRelease();
    if (c.j < jumps.length) {
      const [edge] = jumps[c.j];
      if (v.grounded && c.since > 3 && ((dir > 0 && v.px >= edge) || (dir < 0 && v.px <= edge))) { v.jumpRelease(); v.jumpPress(); c.j++; c.phase = 1; c.since = 0; }
      else if (prev && !v.grounded && c.since >= (prev[2] ?? 999)) return N;
      return I({ [k]: true });
    }
    if (v.grounded && c.since > 3) return brake();
    return I({ [k]: c.since < (prev[2] ?? 999) });
  };
}
const riding = (i, n = 12) => (c) => v.ridingCenser === i ? ((c.rideF = (c.rideF ?? 0) + 1) > n ? true : null) : (c.rideF = 0, null);
// from footing, run `dir` to edge and jump for censer ci, steering under it
function mount(ci, dir, edge, jh = 999) {
  const k = dir > 0 ? 'right' : 'left';
  return (c) => {
    if (c.phase === 0) { if ((dir > 0 && v.px >= edge) || (dir < 0 && v.px <= edge)) { v.jumpPress(); c.phase = 1; c.since = 0; } else return I({ [k]: true }); }
    if (c.since === jh) v.jumpRelease();
    if (v.ridingCenser === ci) { v.jumpRelease(); return N; }
    const dx = v.censerPos(ci).x - v.px;
    return I({ left: dx < -0.15, right: dx > 0.15 });
  };
}
// riding censer `from`, leave once it has swung past xr heading dir, and
// steer for censer `to`'s crown
function leap(from, to, dir, xr, jh = 999) {
  return (c) => {
    if (c.phase === 0) {
      const cp = v.censerPos(from); const moving = Math.sign(cp.x - (c.lx ?? cp.x)); c.lx = cp.x;
      if (v.ridingCenser !== from) return c.since > 2 ? 'fell' : N;
      if ((dir > 0 ? cp.x >= xr : cp.x <= xr) && (moving === dir || moving === 0)) { v.jumpPress(); c.phase = 1; c.since = 0; }
      return N;
    }
    if (c.since === jh) v.jumpRelease();
    if (v.ridingCenser === to) { v.jumpRelease(); return N; }
    const dx = v.censerPos(to).x - v.px;
    return I({ left: dx < -0.15, right: dx > 0.15 });
  };
}
// riding censer ci, leave past xr heading dir for footing; brake on landing
function leave(ci, dir, xr, jh = 999, rel = 999) {
  const k = dir > 0 ? 'right' : 'left';
  return (c) => {
    if (c.phase === 0) {
      const cp = v.censerPos(ci); const moving = Math.sign(cp.x - (c.lx ?? cp.x)); c.lx = cp.x;
      if (v.ridingCenser !== ci) return c.since > 2 ? 'fell' : N;
      if ((dir > 0 ? cp.x >= xr : cp.x <= xr) && (moving === dir || moving === 0)) { v.jumpPress(); c.phase = 1; c.since = 0; }
      return N;
    }
    if (c.since === jh) v.jumpRelease();
    if (v.grounded && c.since > 3 && v.ridingCenser < 0) return brake();
    return I({ [k]: c.since < rel });
  };
}
// storey 3: from the solid landing across A, b, A, b, each hop launched when
// the shelf underfoot (or, from stone, the next one's arrival) is R frames
// from its swap; off b's end into shaft 3, steering left k frames after
const SHELVES = [[11, 16], [20, 25], [29, 34], [38, 43]];
const swapIn = () => { const cyc = 3.4, half = 1.7; const tc = v.time % cyc; return Math.round(((tc < half ? half : cyc) - tc) * 60); };
// ways off the last b and the frame (from the jump, or from leaving the lip)
// the steer left begins: [jump at x (0 = walk off), jump held, steer at]
// — measured, it is an ~8-frame window each
const OFF = [[0, 0, 20], [0, 0, 24], [43, 8, 36], [43, 999, 42], [42, 8, 48], [42, 999, 54], [41, 8, 60], [41, 999, 60]];
function crossing({ R, k, S }) {
  return (c) => {
    c.n = c.n ?? 0;                       // shelves landed on so far
    if (c.n === 4) {                      // on the last b: off the end into the wind
      const [jx, jh, kk] = OFF[k];
      if (c.offF == null && jx && v.grounded && v.px >= jx) { v.jumpRelease(); v.jumpPress(); c.offF = c.f; }
      if (c.offF == null && !jx && !v.grounded && v.px > 44.2) c.offF = c.f;
      if (c.offF != null && c.f - c.offF === jh) v.jumpRelease();
      if (v.grounded && c.offF != null && c.f - c.offF > 3) return brake();
      if (c.offF != null && c.f - c.offF >= kk) return I({ left: true });
      return I({ right: true });
    }
    if (c.air) {
      if (v.grounded && c.since > 3) { c.air = false; c.n++; return N; }
      // nine tiles a hop in 1.7 s outruns a running jump: spark the long ones
      if (c.spark && c.since === S) v.dash(I({ right: true }));
      return I({ right: v.px < SHELVES[c.n][0] + 1.2 });
    }
    if (c.n === 0) {
      // the landing sits under shaft 2's wind, which crushes a jump begun
      // inside it: wait at 5.5, run, and jump from the lip's last inch
      const aOff = !v.bridgeOn[v.p.bridges.find(b => b.x === 11 && b.y === 42).group];
      if (!c.go && aOff && swapIn() <= R + 40) c.go = true;
      if (!c.go) return Math.abs(v.px - 5.5) > 0.15 ? I({ left: v.px > 5.5, right: v.px < 5.5 }) : brake();
      if (v.px >= 8.05) { v.jumpRelease(); v.jumpPress(); c.air = true; c.since = 0; }
      return I({ right: true });
    }
    const [x0] = SHELVES[c.n];
    const far = c.n === 0 ? 7.5 : SHELVES[c.n - 1][1] + 0.55;
    const s = swapIn();
    if (v.grounded && c.since > 3 && v.px >= x0 - 8.2 && s <= R) {
      v.jumpRelease(); v.jumpPress(); c.air = true; c.since = 0; c.spark = v.px < x0 - 5.0;
      return I({ right: true });
    }
    if (v.px >= far) return brake();
    return I({ right: true });
  };
}

const steps = [
  // ---- storey 1: the walk, watched ----
  // the rest points (measured over the lights' whole 1020-frame cycle, two
  // laps standing still): the start shelf behind the pillar (10.0-10.4) and
  // the L's foot (36.3-38.5). Everything between is one run, jump to jump.
  ['1 light the start sconce, wait behind the pillar', [walkTo(10.2)], ok(() => v.sconceLit[0] && at(10.2)({})), { period: 1 }],
  ['2 the watched walk: pillar, shelf two, pedestal, the post, the L', grid({}, { e3: [22.3, 22.6], r4: [18, 24, 30], e5: [31.0, 31.4] })
    .map(({ e3, r4, e5 }) => chain(1, [[10.2, 999], [12.4, 999], [e3, 999], [27.6, 999, r4], [e5, 999]])),
    ok((c) => c.j === 5 && v.grounded && c.since > 3 && Math.abs(v.vx) < 0.3 && v.px > 33.8 && v.px < 39 && (Math.abs(row() - 7.48) < 0.15 || Math.abs(row() - 9.48) < 0.15)), { period: 1020, step: 6 }],
  ['2b the L foot', [walkTo(37.0)], at(37.0), { period: 1 }],
  // ---- shaft 1: the first drop (v6 catch) ----
  // just walk off: the slab under the wind is run out past where the walk's
  // carry lands (it was one safe square between fangs)
  ['4 the first drop', [
    tech({ dir: 1, edge: 39.4, jh: 0, rel: 0 }),
    ...[10, 20].map(k => tech({ dir: 1, edge: 39.4, jh: 0, rel: 0, steer: -1, steerAt: k })),
  ], landOn(33.8, 47.2, 25), { period: 1020, step: 6 }],
  ['4b the second sconce', [walkTo(35.0)], ok(() => v.sconceLit[1] && at(35.0)({})), { period: 1 }],
  // ---- storey 2: ridden, censer to censer ----
  ['5 block -> lantern 3', grid({}, { edge: [34.4, 34.8], jh1: [999, 10] }).map(o => mount(2, -1, o.edge, o.jh1)), riding(2), { period: 153 }],
  ['5b lantern 3 -> lantern 2', grid({}, { xr: [28.0, 27.4], jh: [999, 10] }).map(o => leap(2, 1, -1, o.xr, o.jh)), riding(1), { period: 153 }],
  ['5c lantern 2 -> lantern 1', grid({}, { xr: [21.0, 20.4], jh: [999, 10] }).map(o => leap(1, 0, -1, o.xr, o.jh)), riding(0), { period: 153 }],
  ['5d lantern 1 -> the far shelf', grid({}, { xr: [14.0, 13.4], jh: [999, 10], rel: [999, 24] }).map(o => leave(0, -1, o.xr, o.jh, o.rel)), on(6.8, 12.8, 26), { period: 153 }],
  // ---- shaft 2: down the left wind ----
  ['6 the second drop', grid({ dir: -1, edge: 6.6, jh: 0, rel: 0, steer: 1 }, { steerAt: [0, 10, 20, 30, 40] }).map(tech), landOn(2.8, 8.2, 42), { period: 1 }],
  ['6b the third sconce', [walkTo(5.5)], ok(() => v.sconceLit[2] && at(5.5)({})), { period: 1 }],
  // ---- storey 3: the fading shelves ----
  // A and b hold 1.7 s each, in opposition: every hop is in the air across
  // the swap. Then straight on off b's end into the last wind, and the
  // steer left out of it — below the plane, above the fangs.
  ['7-8 the fading shelves, and the third drop', grid({}, { R: [30, 40, 50, 58], S: [6, 12], k: [0, 1, 2, 3, 4, 5, 6, 7] }).map(crossing),
    ok(() => v.grounded && v.ridingCenser < 0 && v.px > 38.8 && v.px < 43.2 && Math.abs(row() - 57.48) < 0.15 && Math.abs(v.vx) < 0.3), { period: 204, step: 4, maxF: 1200 }],
  ['8b the last sconce', [walkTo(41.0)], ok(() => v.sconceLit[3] && at(41.0)({})), { period: 1 }],
  // ---- the finish storey: one more breath of A, the last light, the stone ----
  // A holds 1.7 s, so the sconce shelf -> A -> finish is one run; the last
  // light sweeps the finish platform, so the run goes on to the stone
  ['9 sconce shelf, A, the finish, the stone', grid({}, { sp: [0, 8, 14], e2: [28.8, 28.4] }).map(({ sp, e2 }) => (c) => {
    c.j = c.j ?? 0;
    if (c.j === 0 && v.grounded && v.px <= 39.4) { v.jumpPress(); c.j = 1; c.since = 0; }
    else if (c.j === 1 && sp && c.since === sp) v.dash(I({ left: true, up: true }));
    else if (c.j === 1 && v.grounded && c.since > 3 && v.px <= e2) { v.jumpRelease(); v.jumpPress(); c.j = 2; c.since = 0; }
    if (c.j === 2 && v.grounded && c.since > 3 && v.px < 16.2) return brake();
    return I({ left: true });
  }), ok(() => v.completed), { period: 408, step: 6 }],
];
const r = plan(steps);
r.reforms = v.reforms;
return r;
