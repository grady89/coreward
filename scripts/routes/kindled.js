// THE KINDLED — the golden route, played in the real runtime.
//   node scripts/vaultplay.mjs --room=kindled scripts/routes/kindled.js
// Spawn to stone with no teleports: real gates, real checkpoints, the moth,
// every bolt, lantern, piston and vent live, and the dark at your heels on
// the last floor. Each step names one beat of the room and lists the
// techniques a player might use; the planner takes the first (wait,
// technique) that works from wherever the last beat left the body.
const { v, N, I, row, settle, plan } = V;
settle(5);
const brake = () => I({ left: v.vx > 0.2, right: v.vx < -0.2 });
const onFloor = (x0, x1, floorRow) => v.grounded && v.ridingCenser < 0 && v.px > x0 && v.px < x1
  && Math.abs(row() - (floorRow - 0.52)) < 0.12;
const ok = (cond) => (c) => cond(c) ? true : null;
// the beat clock, read the way a player reads it: is a floor on, and for how long
const CYC = 4 * 0.85, HALFC = CYC / 2;
const bridgeLeft = (grp) => {
  const tc = v.time % CYC; const on = (tc < HALFC) === (grp === 0);
  return on ? HALFC - (tc % HALFC) : -(HALFC - (tc % HALFC));
};
const boltDir = (i) => { const s = v.def.shuttles[i]; return ((v.time / s.period + s.phase) % 1) < 0.5 ? 1 : -1; };
const boltRow = (i) => -v.shuttlePos(i).y;
const riding = (i, n = 20) => (c) => v.ridingCenser === i ? ((c.rideF = (c.rideF ?? 0) + 1) > n ? true : null) : (c.rideF = 0, null);

// a standing hop: jump-hold jh frames, steer toward dir until rel
const hops = (dir = 1) => {
  const out = []; const k = dir > 0 ? 'right' : 'left';
  for (const jh of [3, 6, 0, 999]) for (const rel of [12, 6, 20, 999]) out.push((c) => {
    if (c.phase === 0) { if (jh > 0) v.jumpPress(); c.phase = 1; c.since = 0; }
    if (c.since === jh) v.jumpRelease();
    if (v.grounded && c.since > 3 && v.ridingCenser < 0) return brake();
    return I({ [k]: c.since < rel });
  });
  return out;
};
// off a lantern's crown: first stand square on it (a crown is a tile wide and
// the catch rarely lands you in its middle), then hop
const rideHops = (i) => hops().map(p => (c) => {
  if (c.centred !== true) {
    const dx = v.censerPos(i).x - v.px;
    c.cf = (c.cf ?? 0) + 1;
    if (c.cf < 40 && (Math.abs(dx) > 0.12 || Math.abs(v.vx) > 0.3)) {
      return Math.abs(dx) > 0.12 && Math.abs(v.vx) < 1.2 ? I({ right: dx > 0, left: dx < 0 }) : brake();
    }
    c.centred = true; c.phase = 0;
  }
  return p(c);
});
// walk to x, then hop
const walkThen = (x, then) => then.map(p => (c) => {
  if (c.walked !== true) {
    if (Math.abs(v.px - x) > 0.12 || !v.grounded) return I({ right: v.px < x, left: v.px > x });
    c.walked = true; c.phase = 0;
  }
  return p(c);
});
// a two-wall shaft from the niche: step off into it, kick off whichever wall
// you meet until above R, then out right
const shaft = (R, T, sp) => (c) => {
  if (c.phase === 0) {
    if (v.px > 4.2) return I({ left: true });
    v.jumpPress(); c.phase = 1; c.dir = -1; c.since = 0; return I({ left: true });
  }
  if (c.phase === 1) {
    if (v.wallDir !== 0 && v.vy < T && c.since > 6) { v.jumpRelease(); v.jumpPress(); c.dir = -v.wallDir; c.since = 0; if (row() < R) c.phase = 2; }
    return I({ left: c.dir < 0 && c.since > 5, right: c.dir > 0 && c.since > 5 });
  }
  if (sp && c.since === 6) v.dash(I({ up: true, right: true }));
  if (v.grounded && c.since > 3) return brake();
  return I({ right: true });
};

const steps = [
  // I.1 · the moth over the spark gap: run, jump, spark — before it can take it
  ['I.1 the moth gap', [6, 16, 28].flatMap(sp => ['u', 'f'].map(sd => (c) => {
    if (c.phase === 0) { if (v.px < 9.7) return I({ right: true }); v.jumpPress(); c.phase = 1; c.since = 0; }
    if (sp && c.since === sp) v.dash(I({ right: true, up: sd === 'u' }));
    if (v.grounded && c.since > 3) return brake();
    return I({ right: true });
  })), ok(() => onFloor(16.8, 20.8, 47)), { period: 153, step: 3, maxF: 300 }],
  // I.2 · the half-time floors under the plumb bolts: onto A, across at the swap, off b when its bolt is low
  ['I.2 half-time floors', [[7, 20], [999, 16], [10, 24], [999, 24]].flatMap(([jh, rel]) => [0.2, 0.4].map(d => {
    const pads = [
      { edge: 20.7, go: () => true },
      { edge: 25.7, go: () => bridgeLeft(0) > 0 && bridgeLeft(0) < d },
      { edge: 30.7, go: () => boltRow(3) > 46.5 },
    ];
    return (c) => {
      c.i = c.i ?? 0; c.st = c.st ?? 'walk';
      const pd = pads[c.i];
      if (!pd) return brake();
      if (c.st === 'walk') {
        if (!v.grounded) return I({ right: true });
        if (v.px < pd.edge - 0.15) return I({ right: true });
        if (!pd.go()) return brake();
        v.jumpPress(); c.st = 'air'; c.since = 0; c.phase = 1; return I({ right: true });
      }
      if (c.since === jh) v.jumpRelease();
      if (v.grounded && c.since > 3) { c.i++; c.st = 'walk'; v.jumpRelease(); return brake(); }
      return I({ right: c.since < rel });
    };
  })), ok(() => onFloor(32.8, 35.8, 44)), { period: 204, step: 3, maxF: 700 }],
  // I.3 · kick up the dark wall, steering back to it, onto the perch and the first light
  ['I.3 the dark wall -> S1', [6, 3, 0].flatMap(T => [41.5, 40.5, 39.5].map(R => (c) => {
    if (c.phase === 0) { if (v.px < 35.5) return I({ right: true }); v.jumpPress(); c.phase = 1; c.since = 0; return I({ right: true }); }
    if (c.phase === 1) {
      if (v.wallDir === 1 && v.vy < T && c.since > 6) { v.jumpRelease(); v.jumpPress(); c.since = 0; if (row() < R) c.phase = 2; }
      return I({ right: c.since > 5 });
    }
    if (v.grounded && c.since > 3) return brake();
    return I({ right: true });
  })), ok(() => v.sconceLit[2] && onFloor(35.8, 44, 38)), { period: 6, maxF: 400 }],
  // II.1 · out to the perch's end; the first lantern's west crown comes in under it
  ['II.1 perch -> the first lantern', walkThen(43.5, hops()).map(p => (c) => {
    if (v.ridingCenser === 0) { const dx = v.censerPos(0).x - v.px; return Math.abs(dx) > 0.12 && Math.abs(v.vx) < 1.2 ? I({ right: dx > 0, left: dx < 0 }) : brake(); }
    return p(c);
  }), (c) => v.ridingCenser === 0 && Math.abs(v.censerPos(0).x - v.px) < 0.15 && Math.abs(v.vx) < 0.3
    ? ((c.rideF = (c.rideF ?? 0) + 1) > 10 ? true : null) : (c.rideF = 0, null), { period: 153, step: 3, maxF: 500 }],
  // II.2 · crown to crown at the apex, the two lanterns swinging against each other
  ['II.2 lantern -> lantern', rideHops(0), riding(1), { period: 153, step: 3, maxF: 300 }],
  // II.3 · off the second crown onto the ledge over the vent's mouth
  ['II.3 lantern -> east ledge', rideHops(1), ok(() => onFloor(57.8, 61.9, 38)), { period: 153, step: 3, maxF: 300 }],
  // II.4 · into the vent when the burning lantern at its head has swung clear; out left onto the middle floor
  ['II.4 the vent past the lantern', [27, 28.5].map(lt => (c) => {
    if (c.phase === 0) { if (v.px > 60.7) return I({ left: true }); c.phase = 1; c.since = 0; }
    if (row() < lt) c.phase = 2;
    if (c.phase === 2) return v.grounded ? brake() : I({ left: true });
    return I({ right: v.px < 62.6 });
  }), (c) => c.phase === 2 && onFloor(35.8, 61.9, 30) ? true : null, { period: 153, step: 3, maxF: 400 }],
  // III.0 · west along the middle floor to the second light
  // III.0 · west along the middle floor: hop the gap over the hall, then over
  // the bolt walking the floor, to the second light
  ['III.0 the way back -> S2', [1.2, 1.8].flatMap(hd => [false, true].map(wait => (c) => {
    const MFB = v.def.shuttles.findIndex(s2 => s2.y0 === 28);
    const b = v.shuttlePos(MFB);
    if (v.grounded && v.px < 40.6) return brake();
    if (v.grounded && v.px > 52.9 && v.px < 53.5) { v.jumpRelease(); v.jumpPress(); c.since = 0; }
    if (wait && v.grounded && v.px < 51 && v.px > 50.2 && !(boltDir(MFB) < 0 && b.x < 47)) return brake();
    if (v.grounded && v.px < 51 && v.px > 44 && b.x < v.px + 0.2 && v.px - b.x < hd && boltDir(MFB) > 0) { v.jumpRelease(); v.jumpPress(); c.since = 0; }
    if (c.since === 8) v.jumpRelease();
    return I({ left: true });
  })), ok(() => v.sconceLit[1] && v.grounded), { period: 102, step: 3, maxF: 600 }],
  // III.1 · across the rime under the two pistons, walked or hopped, to the stone before the span
  ['III.1 rime under the pistons', [[], [35.5, 31.5], [35.6, 32.3, 29.0], [36.0]].flatMap(at => [3, 5].map(jh => (c) => {
    c.k = c.k ?? 0;
    if (v.grounded && v.px < 27.4) return I({ right: v.vx < -0.2 });
    if (v.grounded && c.k < at.length && v.px <= at[c.k]) { v.jumpRelease(); v.jumpPress(); c.k++; c.since = 0; }
    if (c.since === jh) v.jumpRelease();
    return I({ left: true });
  })), ok(() => onFloor(25.8, 28.0, 30)), { period: 204, step: 3, maxF: 400 }],
  // III.2 · up into the inverted span, along the ceiling hopping its fangs, and out the far end
  ['III.2 the inverted span', [0.9, 1.3, 1.7].map(lead => (c) => {
    if (c.phase === 0) { if (v.px > 26.7) return I({ left: true }); v.jumpPress(); c.phase = 1; c.since = 0; c.done = new Set(); }
    if (c.phase === 1) { if (v.grounded && row() < 23) { c.phase = 2; v.jumpRelease(); } return I({ left: true }); }
    if (c.phase === 2) {
      const st = [23, 19].find(x => x + 1 < v.px + 0.05 && !c.done.has(x));
      if (st !== undefined && v.grounded && v.px - (st + 1) < lead) { v.jumpPress(); c.since = 0; c.done.add(st); }
      if (v.px < 15.6) c.phase = 3;
      return I({ left: true });
    }
    if (v.grounded && c.since > 3) return brake();
    return I({ left: v.px > 12 });
  }), (c) => c.phase === 3 && onFloor(2, 15.9, 30) ? true : null, { period: 6, maxF: 500 }],
  // III.3a · into the chimney, kick up past the west piston, step into the niche
  ['III.3a chimney -> niche', [6, 3, 0, -2].flatMap(T => [22.6, 22.0, 21.4].flatMap(R => [0, 6].map(out => (c) => {
    if (c.phase === 0) {
      if (v.grounded && v.px > 4.2) return I({ left: true });
      v.jumpPress(); c.phase = 1; c.dir = -1; c.since = 0; return I({ left: true });
    }
    if (c.phase === 1) {
      if (v.wallDir !== 0 && v.vy < T && c.since > 6) { v.jumpRelease(); v.jumpPress(); c.dir = -v.wallDir; c.since = 0; if (row() < R) c.phase = 2; }
      return I({ left: c.dir < 0 && c.since > 5, right: c.dir > 0 && c.since > 5 });
    }
    if (v.grounded && c.since > 3) return brake();
    return I({ right: c.since > out });
  }))), (c) => c.phase === 2 && v.grounded && c.since > 3 ? (onFloor(4.9, 7, 23) ? true : 'missed the niche') : null, { period: 204, step: 3, maxF: 600 }],
  // III.3b · out of the niche, kick up past the east piston, through the curtain onto the exhale
  ['III.3b niche -> the exhale', [6, 3, 0, -2].flatMap(T => [14.6, 14.0].flatMap(R => [false, true].map(sp => shaft(R, T, sp)))),
    (c) => c.phase === 2 && onFloor(4.8, 20.5, 14) ? true : null, { period: 204, step: 3, maxF: 400 }],
  // the exhale: the one lit floor, and the third light
  ['exhale -> S3', [(c) => I({ right: v.px < 12.2, left: v.px > 12.6 })], ok(() => v.sconceLit[0] && v.grounded), { period: 1, maxF: 300 }],
];
// IV · the dark, arriving. One run, no rest point in it: the wave wakes as you
// leave the exhale. A on the beat; the stone step; off it when the floor bolt
// is far; over the bolt; into the vent while the lantern at its head is
// clear; out onto the shelf; off its end as the last piston begins its stroke,
// so it is lifting when you reach it; across the rime and under it; kick up
// the dais, and walk to the stone among the four.
const IVB = v.def.shuttles.findIndex(s2 => s2.y0 === 12 && s2.x0 === 30);
const crU = (i) => { const c2 = v.def.crushers[i]; return (v.time / c2.period + c2.phase) % 1; };
const L4 = () => v.censerPos(3);
const ivAll = (o) => (c) => {
  c.st = c.st ?? 'A';
  switch (c.st) {
    case 'A':
      if (v.px < 20.5) return I({ right: true });
      if (!(bridgeLeft(0) > o.r)) return brake();
      v.jumpPress(); c.st = 'A1'; c.since = 0; return I({ right: true });
    case 'A1':
      if (c.since === 7) v.jumpRelease();
      if (v.grounded && c.since > 3) { c.st = 'B'; return brake(); }
      return I({ right: c.since < 20 });
    case 'B':
      if (v.px < 24.6) return I({ right: true });
      v.jumpPress(); c.st = 'B1'; c.since = 0; return I({ right: true });
    case 'B1':
      if (c.since === 6) v.jumpRelease();
      if (v.grounded && c.since > 3) { c.st = 'C'; v.jumpRelease(); return brake(); }
      return I({ right: c.since < 14 });
    case 'C': {
      const b = v.shuttlePos(IVB);
      if (v.grounded && v.px < 28.6) return I({ right: true });
      if (v.grounded && v.px >= 28.6 && v.px < 29.5) {
        if (!(b.x > 30 + o.bw || (boltDir(IVB) > 0 && b.x > 31))) return brake();
        v.jumpPress(); c.since = 0; return I({ right: true });
      }
      if (c.since === 8) v.jumpRelease();
      if (v.grounded && v.px > 29.5 && b.x > v.px - 0.2 && b.x - v.px < 1.6 && boltDir(IVB) < 0) { v.jumpPress(); c.since = 0; }
      if (v.px > 34.2 && v.grounded && o.lw && !o.lw()) return brake();
      if (v.px > 35.1) c.st = 'D';
      return I({ right: true });
    }
    case 'D':
      if (row() < o.ex) { c.st = 'E'; return I({ right: true }); }
      return I({ right: v.px < 35.7 && v.vx < 1, left: v.px > 36.0 && v.vx > -1 });
    case 'E':
      if (v.grounded && row() < 11.5) c.st = 'F';
      return I({ right: true });
    case 'F':
      if (o.pw && v.grounded && row() < 11.5 && v.px > 42.4 && !o.pw()) return brake();
      if (v.px > 55.9 && v.grounded) { v.jumpPress(); c.st = 'G'; c.since = 0; }
      return I({ right: true });
    case 'G':
      if (v.wallDir === 1 && v.vy < 3 && c.since > 6) { v.jumpRelease(); v.jumpPress(); c.since = 0; if (row() < 10) c.st = 'H'; }
      return I({ right: c.since > 5 });
    default:
      return v.grounded ? I({ right: v.px < 60.5 }) : I({ right: true });
  }
};
const IV = [];
for (const pw of [() => crU(4) > 0.02 && crU(4) < 0.25, () => crU(4) > 0.08 && crU(4) < 0.3, null])
  for (const r of [0.6, 1.0]) for (const bw of [2, 3.5]) for (const ex of [6.5, 9])
    for (const lw of [null, () => L4().x > 37 && L4().x < 37.6, () => L4().x < 34.4 && L4().x > 33.6])
      IV.push(ivAll({ r, bw, ex, pw, lw }));
steps.push(['IV the dark, arriving -> the stone', IV, ok(() => v.completed), { period: 612, step: 6, maxF: 1800 }]);
return plan(steps);
