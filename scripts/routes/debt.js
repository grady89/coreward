// THE DEBT — the golden route, played in the real runtime.
//   node scripts/vaultplay.mjs --room=debt --port=4183 scripts/routes/debt.js
// Spawn to stone with no teleports: real doors, real checkpoints, every
// hazard live. Each step names one beat of scripts/author-debt.py and lists
// the techniques a player might use; the planner takes the first (wait,
// technique) that works from wherever the last beat left the body.
//
// Every policy steers RELATIVE TO THE GRAVITY IT IS IN. A "jump" on the
// underside of the page goes world-down; "under(r)" means hanging from the
// underside of tile row r in up-gravity, "onTop(r)" standing on it in
// down-gravity. The spark is the one world-relative verb.
const { v, N, I, row, settle, plan } = V;
settle(5);

const gs = () => (v.gravityAt(v.px, v.py)[1] < 0 ? 1 : -1);   // +1 debit (down), -1 credit (up)
const onTop = (r) => v.grounded && gs() > 0 && Math.abs(row() - (r - 0.52)) < 0.1;
const under = (r) => v.grounded && gs() < 0 && Math.abs(row() - (r + 1.52)) < 0.1;
const still = () => Math.abs(v.vx) < 0.25;
const ok = (cond) => (c) => (cond(c) ? true : null);
const K = (d) => (d > 0 ? 'right' : d < 0 ? 'left' : null);
const go = (d) => { const k = K(d); return k ? I({ [k]: true }) : N; };
const brake = () => go(-Math.sign(v.vx) * (Math.abs(v.vx) > 0.2 ? 1 : 0));
const walkTo = (x, tol = 0.12) => {
  if (Math.abs(v.px - x) < tol && Math.abs(v.vx) < 0.4) return null;
  if (Math.abs(v.px - x) < tol) return N;
  return go(Math.sign(x - v.px));
};
// steer for x over a hole, braking early so the drift does not overshoot
const aim = (x, db = 0.15) => {
  const d = x - v.px;
  if (Math.abs(d) < db) return go(-Math.sign(v.vx) * (Math.abs(v.vx) > 1.2 ? 1 : 0));
  if (Math.sign(v.vx) === Math.sign(d) && v.vx * v.vx / 52 > Math.abs(d)) return go(-Math.sign(d));
  return go(Math.sign(d));
};
// how far crusher i is out, 0 home .. 1 full
const ext = (i) => { const c = v.def.crushers[i]; const r = v.crusherRect(i); return Math.hypot(r.x0 - c.x, -r.y0 - c.y) / Math.hypot(c.dx, c.dy); };
// a player watching a piston: seen it out, now it is home
const lifted = (c, i) => { if (ext(i) > 0.05) c.seenOut = true; return c.seenOut && ext(i) < 0.02; };

// THE TURN. Stand at x0, jump (held `hold`), aim for the hole's middle hx;
// once through the page steer `side` onto the far face and brake on it.
// A walk-in alone only bobs in the seam (the seam bleeds a body that is not
// holding on), so every turn here is a jump.
const hopTurn = ({ x0, hx, hold = 999, side, pageRow = 22, down = true }) => (c) => {
  if (c.phase === 0) { const w = walkTo(x0); if (w) return w; v.jumpPress(); c.phase = 2; c.since = 0; return N; }
  if (c.since === hold) v.jumpRelease();
  if (c.phase === 4 || (c.phase === 3 && v.grounded)) { c.phase = 4; return brake(); }
  const through = down ? row() > pageRow + 1.6 : row() < pageRow - 0.6;
  if (through || c.phase === 3) { c.phase = 3; return go(side); }
  return aim(hx);
};
// ...or walk in and press jump in the hole, `jk` frames after the lip
const walkTurn = ({ x0, dir, jk, side, pageRow = 22, down = true, hx }) => (c) => {
  if (c.phase === 0) { const w = walkTo(x0); if (w) return w; c.phase = 1; c.since = 0; }
  if (c.phase === 1) { if (!v.grounded) { c.phase = 2; c.since = 0; } return go(dir); }
  if (c.since === jk) v.jumpPress();
  if (c.phase === 4 || (c.phase === 3 && v.grounded)) { c.phase = 4; return brake(); }
  const through = down ? row() > pageRow + 1.6 : row() < pageRow - 0.6;
  if (through || c.phase === 3) { c.phase = 3; return go(side); }
  return aim(hx);
};
// tap-hop a bolt closing on the body at its own height (never a full jump:
// under the pocket a full jump is taken up)
const hopGuard = (c, sis, trig = 1.4, tapF = 3) => {
  c.bx = c.bx ?? {};
  if (c.tapT !== undefined) { c.tapT--; if (c.tapT <= 0) { v.jumpRelease(); c.tapT = undefined; } }
  for (const si of sis) {
    const b = v.shuttlePos(si); const prev = c.bx[si] ?? b.x; c.bx[si] = b.x;
    if (!v.grounded || c.tapT !== undefined || Math.abs(b.y - v.py) > 0.8) continue;
    const closing = (b.x - v.px) * (b.x - prev) < 0 || b.x === prev;
    if (closing && Math.abs(b.x - v.px) - 0.3 < trig) { v.jumpPress(); c.tapT = tapF; }
  }
};
// THE HOOK. Run at the pocket and jump (held) at xj, drift in, and fall the
// wrong way onto its ceiling (or floor); brake there. `stand` jumps from a
// standstill at xj instead, tapping the page's bolt on the way.
const hookIn = ({ xj, df = 14, sparkAt = -1, sparkDir = null, bolts = [], stand = false }) => (c) => {
  if (c.phase === 0) {
    if (bolts.length) { hopGuard(c, bolts); if (c.tapT !== undefined || !v.grounded) return go(Math.sign(xj - v.px)); }
    if (stand) { const w = walkTo(xj, 0.2); if (w) return w; v.jumpPress(); c.phase = 1; c.since = 0; return N; }
    if (v.px >= xj - 0.05) { v.jumpPress(); c.phase = 1; c.since = 0; }
    return go(1);
  }
  if (c.since === sparkAt && sparkDir) v.dash(I(sparkDir));
  if (v.grounded && c.since > 3) return brake();
  return c.since < df ? go(1) : N;
};
// OUT OF THE POCKET. Walk up to the piston's edge, wait there until it has
// come home, walk off the pocket's lip past it, and land on the page at about x
const exitPast = (pi, x, wait = 32.7) => (c) => {
  if (c.phase === 0) { const w = walkTo(wait, 0.15); if (w) return w; if (!lifted(c, pi)) return brake(); c.phase = 1; c.since = 0; }
  if (c.phase === 1) { if (!v.grounded && c.since > 2) { c.phase = 2; } return go(-1); }
  return v.grounded ? brake() : aim(x, 0.3);
};

const steps = [
  // A · the first leaf: the wall across the top is the lesson; under is the way
  ['A1 down through the first turn (jump into it: a walk-in only bobs)', [
    hopTurn({ x0: 5.2, hx: 7, side: 1 }), hopTurn({ x0: 4.6, hx: 7, side: 1, hold: 6 }),
    walkTurn({ x0: 5, dir: 1, jk: 4, side: 1, hx: 7 }), walkTurn({ x0: 5, dir: 1, jk: 8, side: 1, hx: 7 }),
  ], ok(() => under(22) && still() && v.px > 7.7 && v.px < 14.3), { period: 1 }],
  ['A2 the light under the leaf, up through G2', [
    walkTurn({ x0: 13.6, dir: 1, jk: 3, side: 1, down: false, hx: 15.9 }),
    hopTurn({ x0: 13.6, hx: 15.9, side: 1, down: false }),
  ].map(turn => (c) => {
    // the light hangs where the page is walked, not where the turn lands
    if (!c.lit) { if (v.sconceLit[2]) { c.lit = true; c.phase = 0; c.since = 0; } else return walkTo(9.5, 0.08) ?? N; }
    return turn(c);
  }), ok(() => onTop(22) && still() && v.sconceLit[2] && v.px > 16.6 && v.px < 21.6), { period: 1 }],
  // B · the hub. Hop G3 on the way in (fall short and you are under the page)
  ['B0 hop G3 into the hub', [0, 3, 6].map(tap => (c) => {
    if (c.phase === 0) { if (v.px < 21.2) return go(1); v.jumpPress(); c.phase = 1; c.since = 0; }
    if (c.since === tap + 3) v.jumpRelease();
    return v.grounded && c.since > 3 ? brake() : aim(25.5);
  }), ok(() => onTop(22) && still() && v.px > 23.7 && v.px < 28.5), { period: 1 }],
  ['B1 the hook: tap the page bolt, jump, fall up the pocket onto its ceiling', [
    hookIn({ xj: 29.3 }), hookIn({ xj: 28.6, df: 6 }),
    hookIn({ xj: 28.0, df: 0, sparkAt: 10, sparkDir: { up: true, right: true } }),
    hookIn({ xj: 33.5, stand: true, bolts: [0] }),
  ], ok(() => under(14) && still()), { period: 204, step: 3, maxF: 500 }],
  ['B1b the light on the ceiling (only up-gravity reaches it)', [(c) => walkTo(36.5, 0.1) ?? N], ok(() => v.sconceLit[0] && still()), { period: 1 }],
  ['B1c out under the piston, down to the page', [exitPast(0, 27.5), exitPast(0, 26.0)],
    ok(() => onTop(22) && still() && v.px > 23.7 && v.px < 29.4), { period: 204, step: 3, maxF: 600 }],
  ['B3a down through G3', [
    hopTurn({ x0: 25.0, hx: 22.9, side: 1 }), hopTurn({ x0: 24.6, hx: 22.9, side: 1 }),
    walkTurn({ x0: 25.0, dir: -1, jk: 6, side: 1, hx: 22.9 }),
  ], ok(() => under(22) && still() && v.px > 24.2 && v.px < 29.4), { period: 1 }],
  ['B3b the mirror hook: tap the underside bolt, jump away, fall onto the floor', [
    hookIn({ xj: 29.3 }), hookIn({ xj: 28.6, df: 6 }),
    hookIn({ xj: 28.0, df: 0, sparkAt: 10, sparkDir: { down: true, right: true } }),
    hookIn({ xj: 33.5, stand: true, bolts: [1] }),
  ], ok(() => onTop(30) && still()), { period: 204, step: 3, maxF: 500 }],
  ['B3c the light on the floor (only down-gravity reaches it)', [(c) => walkTo(36.4, 0.1) ?? N], ok(() => v.sconceLit[3] && still()), { period: 1 }],
  ['B3d out over the piston, up to the page', [exitPast(1, 27.5), exitPast(1, 26.0)],
    ok(() => under(22) && still() && v.px > 23.7 && v.px < 29.4), { period: 204, step: 3, maxF: 600 }],
  ['B4 up through G3', [24.6, 25.2].flatMap(x0 => [10, 999].map(hold => hopTurn({ x0, hx: 22.9, hold, side: 1, down: false }))),
    ok(() => onTop(22) && still() && v.px > 23.6 && v.px < 29.5), { period: 1, maxF: 600 }],
  ['B5 under the pocket on taps, through the door, the gate light', [1.4, 0.9].flatMap(trig => [5, 3].map(tap => (c) => {
    if (c.phase === 0) {
      if (v.px < 29.2) return go(1);
      const b = v.shuttlePos(0); const away = b.x > (c.pb ?? b.x); c.pb = b.x;
      if (!(away && b.x > 31.5)) return brake();
      c.phase = 1;
    }
    hopGuard(c, [0], trig, tap); return v.px < 42.6 ? go(1) : brake();
  })), ok(() => v.sconceLit[1] && onTop(22) && still()), { period: 102, step: 2, maxF: 600 }],
  // C · the closing: both banks of pistons, the page turned twice
  ['C-a under T1, down through g1 past its plumb bolt', [
    ...[51.35, 50.9].map(ax => (c) => {
      if (c.phase === 0) { if (v.px < 45.9) return go(1); if (!lifted(c, 2)) return brake(); c.phase = 1; c.since = 0; }
      if (c.phase === 1) { if (v.px < 49.5) return go(1); v.jumpPress(); c.phase = 2; c.since = 0; }
      if (c.phase === 2) { if (row() > 23.6) c.phase = 3; return aim(ax); }
      return v.grounded ? brake() : go(v.px < 52.7 ? 1 : -1);
    }),
    (c) => {
      if (c.phase === 0) { if (v.px < 45.9) return go(1); if (!lifted(c, 2)) return brake(); c.phase = 1; c.since = 0; }
      if (c.phase === 1) { if (!v.grounded && v.px > 49.5) { c.phase = 2; c.since = 0; } return go(1); }
      if (c.phase === 2) { if (c.since === 4) v.jumpPress(); if (row() > 23.6) c.phase = 3; return N; }
      return v.grounded ? brake() : go(v.px < 52.7 ? 1 : -1);
    },
  ], ok(() => under(22) && still() && v.px > 52.2 && v.px < 53.65), { period: 612, step: 6, maxF: 500 }],
  ['C-b under B2', [(c) => { if (c.phase === 0) { if (!lifted(c, 3)) return N; c.phase = 1; } return v.px < 56.9 ? go(1) : brake(); }],
    ok(() => under(22) && still() && v.px > 56.35 && v.px < 57.7), { period: 204, step: 6, maxF: 500 }],
  ['C-c the dive up through g2, past its plumb bolt', [59.35, 58.9].flatMap(ax => [999, 12].map(hold => (c) => {
    if (c.phase === 0) { const w = walkTo(57.0, 0.15); if (w) return w; v.jumpPress(); c.phase = 1; c.since = 0; }
    if (c.since === hold) v.jumpRelease();
    if (c.phase === 1) { if (row() < 21.4) c.phase = 2; return c.since < 4 ? N : aim(ax); }
    return v.grounded ? brake() : go(v.px < 60.7 ? 1 : -1);
  })), ok(() => onTop(22) && still() && v.px > 60.2 && v.px < 61.65), { period: 612, step: 6, maxF: 400 }],
  ['C-d under T2, to the stone', [(c) => { if (c.phase === 0) { if (!lifted(c, 4)) return N; c.phase = 1; } return go(1); }],
    ok(() => v.completed), { period: 204, step: 6, maxF: 600 }],
];
return plan(steps);
