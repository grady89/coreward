// THE DEBT (v7) — the golden route, played in the real runtime.
//   node scripts/vaultplay.mjs --room=debt --port=4182 scripts/routes/debt.js
// Spawn to stone with no teleports: real doors, real checkpoints, every
// hazard live. Each step names one beat of scripts/author-debt.py and lists
// the techniques a player might use; the planner takes the first (wait,
// technique) that works from wherever the last beat left the body.
//
// Every policy steers in world terms (left/right are the same on both faces).
// A jump goes AWAY from whatever the body stands on: down off the roof or the
// page's underside, up off the page or the floor. `under(r)` is hanging from
// the underside of row r in up-gravity, `onTop(r)` standing on it in down.
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
// how far crusher i is out, 0 home .. 1 full
const ext = (i) => { const c = v.def.crushers[i]; const r = v.crusherRect(i); return Math.hypot(r.x0 - c.x, -r.y0 - c.y) / Math.hypot(c.dx, c.dy); };
// a player watching a piston: seen it out, now it is going home
const lifting = (c, i, at = 0.6) => { if (ext(i) > 0.95) c.seenOut = true; return c.seenOut && ext(i) < at; };
// a plumb bolt's orb, in rows; `far` is true when it is at least `d` rows
// from the face the body stands on (top: the roof row 2, bottom: the floor)
const bolt = (i) => -v.shuttlePos(i).y;

// walk to x0, jump (held `hold` frames), steer `dir` after `delay` frames,
// brake once standing again; the goal says which floor counts
const jumpFrom = ({ x0, hold = 999, dir = 1, delay = 0, tol = 0.12, steerFor = 999 }) => (c) => {
  if (c.phase === 0) { const w = walkTo(x0, tol); if (w) return w; v.jumpPress(); c.phase = 1; c.since = 0; return N; }
  if (c.since === hold) v.jumpRelease();
  if (c.phase === 1 && c.since > 3 && v.grounded) c.phase = 2;
  if (c.phase === 2) return brake();
  return c.since >= delay && c.since < delay + steerFor ? go(dir) : N;
};
// a running jump: run from where you stand, press at x0 (crossing it)
const runJump = ({ x0, dir, hold = 999 }) => (c) => {
  if (c.phase === 0) {
    if ((x0 - v.px) * dir <= 0) { v.jumpPress(); c.phase = 1; c.since = 0; return go(dir); }
    return go(dir);
  }
  if (c.since === hold) v.jumpRelease();
  if (c.phase === 1 && c.since > 3 && v.grounded) c.phase = 2;
  return c.phase === 2 ? brake() : go(dir);
};
// walk in `dir` until x passes `x1`, then let go of the stick: fall
// where the walk carries you and stop there
const walkOut = (dir, x1) => (c) => {
  if (c.phase === 0) { if ((x1 - v.px) * dir > 0) return go(dir); c.phase = 1; }
  return v.grounded ? brake() : N;
};
// wait at x for `when`, then walk to x1
const waitThen = (x, when, x1) => (c) => {
  if (c.phase === 0) { const w = walkTo(x, 0.15); if (w) return w; if (!when(c)) return brake(); c.phase = 1; }
  return walkTo(x1, 0.15) ?? N;
};
// a plumb bolt is clear of a body standing on the roof (rows 2-3) when its
// orb is below row `lo`, and of one on the floor (rows 11-12) above row `hi`
const boltLow = (i, lo = 5.2) => () => bolt(i) > lo;
const boltHigh = (i, hi = 9.8) => () => bolt(i) < hi;
// ...and it has just left: it is moving away from the body's face
const leaving = (i, toward) => (c) => {
  const y = bolt(i); const prev = c.by ?? y; c.by = y;
  return (y - prev) * toward > 0;
};

const S_L1 = 0, S_L2 = 1, S_C2 = 2, S_C1 = 3;
const T1 = 0, T2 = 1, B2 = 2, B1 = 3;                 // crushers
const BOLT_T31 = 0, BOLT_T38 = 1, BOLT_B31 = 2, BOLT_B38 = 3, ANKLE = 4;

const steps = [
  // I . THE FIRST LIFT
  ['A1 jump into the band under the roof', [
    jumpFrom({ x0: 6.0 }), jumpFrom({ x0: 6.5, hold: 12 }), jumpFrom({ x0: 5.6, dir: 1, delay: 4 }),
  ], ok(() => under(1) && still() && v.px > 5.3 && v.px < 11.7), { period: 1 }],
  ['A2 over the block on the roof, out of the band, onto the page', [walkOut(1, 12.2)],
    ok(() => onTop(7) && still() && v.px > 12.2 && v.px < 17.5), { period: 1 }],
  ['A3 the first light', [(c) => walkTo(14.5, 0.1) ?? N], ok(() => v.sconceLit[S_L1] && still()), { period: 1 }],
  ['A4 under T1', [waitThen(17.6, (c) => lifting(c, T1), 22.6)],
    ok(() => onTop(7) && still() && v.px > 21.3 && v.px < 23.7), { period: 204, step: 3, maxF: 600 }],
  // II . THE WOUND
  ['B1 walk to the band and jump into it', [
    jumpFrom({ x0: 28.0 }), jumpFrom({ x0: 27.6, hold: 10 }), jumpFrom({ x0: 27.2, delay: 2, steerFor: 14 }),
  ].map(p => (c) => (under(1) ? brake() : p(c))), ok(() => under(1) && still() && v.px > 28.3 && v.px < 30.7), { period: 1, maxF: 400 }],
  ['B2 past the first plumb bolt', [
    waitThen(30.0, (c) => leaving(BOLT_T31, 1)(c) && bolt(BOLT_T31) > 3.6, 33.0),
    waitThen(30.0, boltLow(BOLT_T31, 5.0), 33.0),
  ], ok(() => under(1) && still() && v.px > 32.0 && v.px < 33.7), { period: 153, step: 3, maxF: 400 }],
  ['B3 hop the fang hung from the roof', [8, 10, 6, 12, 14].map(hold => jumpFrom({ x0: 33.1, hold, dir: 1 })),
    ok(() => under(1) && still() && v.px > 35.3 && v.px < 37.7), { period: 1, maxF: 300 }],
  ['B4 past the second plumb bolt, out of the band, onto the page', [
    (c) => {
      if (c.phase === 0) { const w = walkTo(36.8, 0.15); if (w) return w; if (!(leaving(BOLT_T38, 1)(c) && bolt(BOLT_T38) > 3.6)) return brake(); c.phase = 1; }
      if (c.phase === 1) { if (v.px < 41.2) return go(1); c.phase = 2; }
      return v.grounded ? brake() : N;
    },
  ], ok(() => onTop(7) && still() && v.px > 41.0 && v.px < 45.5), { period: 153, step: 3, maxF: 500 }],
  ['B5 the second light', [(c) => walkTo(43.5, 0.1) ?? N], ok(() => v.sconceLit[S_L2] && still()), { period: 1 }],
  // III . THE CLOSING
  ['C1 under T2', [waitThen(46.6, (c) => lifting(c, T2), 51.0)],
    ok(() => onTop(7) && still() && v.px > 50.3 && v.px < 51.7), { period: 204, step: 3, maxF: 600 }],
  ['C2 jump G2, short of the ankle bolt\'s rail', [999, 32, 28].map(hold => jumpFrom({ x0: 50.6, hold, dir: 1 })),
    ok(() => onTop(7) && still() && v.px > 54.3 && v.px < 55.7), { period: 102, step: 2, maxF: 300 }],
  ['C3 hop the ankle bolt', [5, 7, 4].map(hold => (c) => {   // follow it out, hop it on its way back
    if (c.phase === 0) { const w = walkTo(55.2, 0.15); if (w) return w; const bx = v.shuttlePos(ANKLE).x; const away = bx > (c.bx ?? bx); c.bx = bx; if (!(away && bx > 57.6)) return brake(); c.phase = 1; }
    if (c.phase === 1) {
      const bx = v.shuttlePos(ANKLE).x;
      if (bx - v.px < 1.3 && bx > v.px) { v.jumpPress(); c.phase = 2; c.since = 0; }
      return go(1);
    }
    if (c.since === hold) v.jumpRelease();
    if (c.phase === 2 && c.since > 3 && v.grounded) c.phase = 3;
    if (c.phase === 3) return walkTo(61.0, 0.15) ?? N;
    return go(1);
  }), ok(() => onTop(7) && still() && v.px > 60.0 && v.px < 62.6), { period: 102, step: 2, maxF: 500 }],
  ['C4 the turn: walk into the hole, drift left out of the chute', [
    (c) => {
      if (c.phase === 0) { if (v.grounded && v.px < 63.4) return go(1); c.phase = 1; c.since = 0; }
      if (c.phase === 1) { if (row() > 8.3) { c.phase = 2; } return go(1); }
      if (c.phase === 2) { if (v.grounded) c.phase = 3; return go(-1); }
      return brake();
    },
  ], ok(() => under(7) && still() && v.px > 57.3 && v.px < 62.75), { period: 1, maxF: 400 }],
  // ...and back along the underside
  ['D1 under B1', [waitThen(58.6, (c) => lifting(c, B1), 52.0)],
    ok(() => under(7) && still() && v.px > 50.3 && v.px < 54.7), { period: 204, step: 3, maxF: 600 }],
  ['D2 under B2, to the third light', [waitThen(51.0, (c) => lifting(c, B2), 43.2)],
    ok(() => under(7) && still() && v.sconceLit[S_C1] && v.px > 42.9 && v.px < 43.5), { period: 204, step: 3, maxF: 600 }],
  ['E1 jump into the band along the floor', [
    jumpFrom({ x0: 41.6, dir: -1 }), jumpFrom({ x0: 41.4, dir: -1, hold: 10 }), jumpFrom({ x0: 41.8, dir: -1, delay: 3 }),
  ].map(p => (c) => (onTop(13) ? brake() : p(c))), ok(() => onTop(13) && still() && v.px > 39.0 && v.px < 40.7), { period: 1, maxF: 400 }],
  ['E2 past the floor bolt under the second', [
    waitThen(40.0, (c) => leaving(BOLT_B38, -1)(c) && bolt(BOLT_B38) < 11.4, 36.6),
    waitThen(40.0, boltHigh(BOLT_B38, 10.0), 36.6),
  ], ok(() => onTop(13) && still() && v.px > 35.3 && v.px < 37.7), { period: 153, step: 3, maxF: 400 }],
  ['E3 hop the fang on the floor', [8, 10, 6, 12, 14].map(hold => jumpFrom({ x0: 35.9, hold, dir: -1 })),
    ok(() => onTop(13) && still() && v.px > 32.0 && v.px < 33.7), { period: 1, maxF: 300 }],
  ['E4 past the floor bolt under the first, out of the band, up to the page', [
    (c) => {
      if (c.phase === 0) { const w = walkTo(33.0, 0.15); if (w) return w; if (!(leaving(BOLT_B31, -1)(c) && bolt(BOLT_B31) < 11.4)) return brake(); c.phase = 1; }
      if (c.phase === 1) { if (v.px > 27.8) return go(-1); c.phase = 2; }
      return v.grounded ? brake() : N;
    },
  ], ok(() => under(7) && still() && v.px > 23.0 && v.px < 27.9), { period: 153, step: 3, maxF: 500 }],
  // I' . the fourth light, the paid door, the stone
  ['F1 the fourth light, at the door', [(c) => walkTo(14.7, 0.1) ?? N], ok(() => v.sconceLit[S_C2] && still()), { period: 1, maxF: 600 }],
  ['F2 through the paid door, down onto the stone\'s floor, to the stone', [(c) => go(-1)],
    ok(() => v.completed), { period: 1, maxF: 900 }],
];
return plan(steps);