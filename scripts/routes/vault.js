// THE VAULT � the golden route, played in the real runtime.
//   node scripts/vaultplay.mjs --room=vault scripts/routes/vault.js
// Spawn to stone with no teleports: real doors, real checkpoints, every
// hazard live. Each step names one beat of the drawing and lists the
// techniques a player might use; the planner takes the first (wait,
// technique) that works from wherever the last beat left the body.
const { v, N, I, row, settle, plan } = V;
settle(5);
const grounded = (x0, x1, floorRow) => (c) => c.since > 3 && v.grounded && v.ridingCenser < 0 && Math.abs(v.vx) < 0.2 && v.px > x0 && v.px < x1 && Math.abs(row() - (floorRow - 0.52)) < 0.12;
const kickClimb = (side, T, untilRow) => (c) => { // side: +1 wall on the right
  if (v.wallDir === side && v.vy < T && c.since > 6) { v.jumpRelease(); v.jumpPress(); c.since = 0; c.kicks = (c.kicks ?? 0) + 1; if (row() < untilRow) c.phase++; }
  return I({ right: side > 0 && c.since > 5, left: side < 0 && c.since > 5 });
};
// hop off a footing at `edge`, with a run-up from `back` tiles behind it
const hopsTo = (dir, edges, back = 1.2) => {
  const out = []; const k = dir > 0 ? 'right' : 'left'; const kb = dir > 0 ? 'left' : 'right';
  for (const edge of edges) for (const jh of [6, 12, 999]) for (const rel of [10, 20, 999]) for (const sp of [null, 8, 14])
    out.push((c) => {
      if (c.phase === 0) { c.phase = Math.abs(v.px - edge) < back ? -1 : -2; }
      if (c.phase === -1) { if (Math.abs(v.px - edge) >= back) c.phase = -2; return I({ [kb]: true }); }
      if (c.phase === -2) { if ((dir > 0 && v.px >= edge) || (dir < 0 && v.px <= edge)) { v.jumpPress(); c.phase = 1; c.since = 0; } return I({ [k]: true }); }
      if (c.since === jh) v.jumpRelease();
      if (sp && c.since === sp) v.dash(I({ [k]: true, up: sp === 8 }));
      // landed: brake, the way a player lets go and counter-steers on a small footing
      if (v.grounded && c.since > 3) return I({ left: v.vx > 0.2, right: v.vx < -0.2 });
      return I({ [k]: c.since < rel });
    });
  return out;
};
const ok = (cond) => (c) => cond(c) ? true : null;

const steps = [
  // 1-2 · left, down the melting bricks, one jump to the low light
  ['1-2 bricks to the low light', [0, 30, 60, 90].map(k => (c) => { if (c.f === k) v.jumpPress(); return I({ left: true }); }), ok(() => v.sconceLit[3] && v.grounded), { period: 1 }],
  // 3a · kick up the slab and stand on its top
  ['3a climb the slab to the perch', [4, 0].map(T => (c) => {
    if (c.phase === 0) { if (v.px < 2.5) { v.jumpPress(); c.phase = 1; c.since = 0; } return I({ left: true }); }
    if (c.phase === 1) { if (row() < 19.8) c.phase = 2; return kickClimb(-1, T, -1)(c); }
    if (!v.grounded) return I({ left: true });
    return I({ right: v.px < 1.15 && v.vx < 0.8 });  // nudge toward the lamp-side edge of the perch
  }), ok(() => v.grounded && v.px >= 1.2 && v.px < 1.8 && row() < 20 && Math.abs(v.vx) < 0.05)],
  // 3b · wait on the perch, leap for the lamp as it swings in
  ['3b perch -> lamp', [3, 6, 10, 999].flatMap(jh => [6, 10, 14, 18, 24, 999].map(rel => (c) => {
    if (c.phase === 0) { v.jumpPress(); c.phase = 1; c.since = 0; }
    if (c.since === jh) v.jumpRelease();
    return I({ right: c.since < rel });
  })), (c) => (v.ridingCenser === 0 ? ((c.rideF = (c.rideF ?? 0) + 1) > 20 ? true : null) : (c.rideF = 0, null)), { period: 153 }],
  // 4 · ride east, leap off through the panel laser to the plaza
  ['4 lamp -> plaza through the laser', [6, 999].flatMap(jh => [20, 40, 999].flatMap(rel => [-1, 12].map(sp => (c) => {
    if (c.phase === 0) { v.jumpPress(); c.phase = 1; c.since = 0; }
    if (c.since === jh) v.jumpRelease();
    if (sp > 0 && c.since === sp) v.dash(I({ right: true, up: true }));
    return I({ right: c.since < rel });
  }))), (c) => c.since > 3 && v.grounded && v.ridingCenser < 0 ? ((row() > 29 && v.px > 15.7) ? true : 'land' + row().toFixed(0)) : null, { period: 153 }],
  // 5 · along the plaza (the start light), kick up the tower face past the bolt, onto the step
  ['5 tower face -> the step', [6, 4, 2, 0].flatMap(T => [21, 20.5, 20, 19.5, 19].flatMap(Rk => [8, 14, 22].map(L => (c) => {
    if (c.phase === 0) { if (v.px > 19.6 && v.grounded) { v.jumpPress(); c.phase = 1; c.since = 0; } return I({ right: true }); }
    if (c.phase === 1) return kickClimb(1, T, Rk)(c);
    return c.since < L ? I({ left: true }) : N;
  }))), (c) => (c.phase === 2 && v.grounded && c.since > 3) ? ((v.px < 19 && row() < 18) ? true : 'short') : null],
  // 6 · from the step: up the box wall, out left through the plumb laser, onto the high light
  ['6 box wall -> the high light', [6, 4, 2, 0].flatMap(T => [14, 13.5, 13, 12.5].flatMap(Rb => [false, true].map(sp => (c) => {
    if (c.phase === 0) { if (v.px < 18.5) return I({ right: true }); v.jumpPress(); c.phase = 1; c.since = 0; return I({ right: true }); }
    if (c.phase === 1) return kickClimb(1, T, Rb)(c);
    if (sp && c.since === 6) v.dash(I({ left: true }));
    return I({ left: true });
  }))), ok(() => v.sconceLit[0])],
  // 7 · back down to the plaza: off the ledge's east end, over the plumb laser, via the step
  ['7 ledge -> plaza', hopsTo(1, [16.4, 16.6]), (c) => (c.phase === 1 && v.grounded && c.since > 3) ? (row() > 29 ? true : (row() > 17 && row() < 18 ? null : 'land' + row().toFixed(0))) : (c.phase === 1 && v.grounded && row() > 17 && row() < 18 ? (c.onStep = true, null) : null)],
  // 8 · through the key door (three lights) and the three floor lasers, to the plaza's end
  ['8 key door + floor lasers', [27, 27.5, 26.5].map(thr => (c) => {
    const lasers = [3, 4, 5].map(i => ({ x: v.def.shuttles[i].x0 + 0.5, p: v.shuttlePos(i) }));
    const next = lasers.find(l => l.x > v.px);
    if (next && next.x - v.px < 1.0 && -next.p.y > thr) return N;
    return I({ right: true });
  }), ok(() => v.px > 35.2), { period: 102 }],
  ['9a plaza -> 37-38', hopsTo(1, [35.4, 35.7]), grounded(36.8, 39.2, 28), { period: 153 }],
  ['9b 37-38 -> 41-45 over laser', hopsTo(1, [38.6, 38.75], 0.8), grounded(40.8, 46.2, 26), { period: 153 }],
  ['9c 41-45 -> 49-50 over laser', hopsTo(1, [45.5, 45.7]), grounded(48.8, 51.2, 24), { period: 153 }],
  ['10 kick up the wall -> high platform', [6, 3, 0].flatMap(T => [20, 19.5, 19, 18.5].flatMap(R => [8, 14, 999].map(hold => (c) => {
    if (c.phase === 0) { if (v.px > 50.6) { v.jumpPress(); c.phase = 1; c.since = 0; } return I({ right: true }); }
    if (c.phase === 1) return kickClimb(1, T, R)(c);
    return I({ left: c.since < hold });
  }))), (c) => (c.phase === 2 && v.grounded && c.since > 3) ? ((v.px > 48.8 && v.px < 52 && row() < 19) ? true : 'land' + row().toFixed(0)) : null, { period: 6 }],
  ['11 pads back -> the ledge light', [6, 10, 999].flatMap(jh => [0.3, 0.6].map(lead => (c) => {
    const edges = [49.0 + lead, 46.0 + lead, 42.0 + lead, 38.0 + lead];
    if (v.grounded && edges.some(e => Math.abs(v.px - e) < 0.06)) { v.jumpRelease(); v.jumpPress(); c.since = 0; }
    if (c.since === jh) v.jumpRelease();
    return I({ left: true });
  })), ok(() => v.sconceLit[1])],
  ['12 drop off the near end -> plaza', [(c) => I({ left: v.px > 28.6 })], ok(() => v.grounded && row() > 29), { period: 1 }],
  ['13 up the chimney, through the grate, to the stone', [6, 3, 0].flatMap(T => [17, 16.5, 16].flatMap(R => [false, true].map(sp => (c) => {
    if (c.phase === 0) { if (v.px > 24.4) return I({ left: true }); if (v.px < 23.6) return I({ right: true }); v.jumpPress(); c.phase = 1; c.dir = -1; c.since = 0; return I({ left: true }); }
    if (c.phase === 1) {
      if (v.wallDir !== 0 && v.vy < T && c.since > 6) { v.jumpRelease(); v.jumpPress(); c.dir = -v.wallDir; c.since = 0; if (row() < R) c.phase = 2; }
      return I({ left: c.dir < 0 && c.since > 5, right: c.dir > 0 && c.since > 5 });
    }
    if (sp && c.since === 6) v.dash(I({ up: true, right: true }));
    return I({ right: true });
  }))), ok(() => v.completed), { period: 204 }],
];
return plan(steps);
