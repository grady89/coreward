// SOLVABILITY HARNESS — npm run levels:verify
//
// The suite already had two walks over the maps. Neither could answer the
// question that matters:
//
//   vaultfit's flood     moves like a ghost — 4-connected, gravity-free.
//                        Proves what is CERTAINLY unreachable, nothing more.
//   the P5 reach model   moves like a body with the wrong numbers. It was
//                        calibrated at jump-run 3 when the body jumps 5.45,
//                        so it approved spacing that is trivially easy.
//
// This one runs the ACTUAL physics — scripts/lib/movement.mjs, whose constants
// are parsed out of src/game/vault.ts — and for every traversal a level asks
// for it searches real per-frame input tapes until it finds one that works.
// Then it shifts the jump press frame by frame to find how wide the window is.
//
// What it reports per traversal is therefore not an opinion:
//
//   SOLVED  with a tape, and a MARGIN in frames — how far the critical input
//           can slide and still land.
//   TIGHT   solved, but the margin is under the threshold. The body's own
//           coyote window is 6 frames; anything the level demands that is
//           tighter than the game's declared unit of forgiveness is unfair by
//           the game's own standard.
//   BROKEN  no tape found. The level asks for something the body cannot do.
//
//   node scripts/levels-verify.mjs                 every room
//   node scripts/levels-verify.mjs --room=wick     one
//   node scripts/levels-verify.mjs --margin=8      stricter threshold
//   node scripts/levels-verify.mjs --flat          the undecided-corridor lint
import { readFileSync } from 'fs';
import { World, spawn, step, C, metrics } from './lib/movement.mjs';

/**
 * Rooms held to this harness. A room joins the list when it has been rebuilt
 * against the measured body, which is the point at which failing it means
 * something. The other eight were authored against a reach model calibrated
 * at 55 % of the real jump (docs/level-audit.md) and they fail this ON
 * PURPOSE — that failure IS the audit, and silencing it would be the
 * dishonest half of a rebuild.
 */
const DONE = JSON.parse(readFileSync('scripts/levels-done.json', 'utf8'));

const args = process.argv.slice(2);
const only = (args.find(a => a.startsWith('--room=')) ?? '').slice(7) || null;
const MARGIN = Number((args.find(a => a.startsWith('--margin=')) ?? '--margin=6').slice(9));
const flatOnly = args.includes('--flat');
// Solve with the spark DISABLED. This is rule 6's test and it is also the only
// way to ask the question a tutorial lives or dies on: is the scarce verb
// actually forced, or is there a way round it? A room whose stone is still
// reachable without the spark has made the spark optional.
const noSpark = args.includes('--no-spark');
const verbose = args.includes('--verbose');

const AIR = new Set('.dS@MX_AbR^><KFCN12o*'.split(''));
const H = { left: false, right: false, up: false, down: false };

// ---------------------------------------------------------------------------
// levels are data: read the maps straight out of the level definition
// ---------------------------------------------------------------------------
function loadRooms() {
  const src = readFileSync('src/world/vaults.ts', 'utf8');
  const out = [];
  for (const m of src.matchAll(/glyph: '(\w+)'/g)) {
    const i = m.index, j = src.indexOf("glyph: '", i + 20);
    const seg = src.slice(i, j < 0 ? src.length : j);
    const rows = [...seg.matchAll(/^      '(.*)',?$/gm)].map(x => x[1]);
    // the room's updraft columns, so a route up a wind channel can be proved
    const cm = seg.match(/currents: \[([\s\S]*?)\n    \]/);
    const currents = cm ? [...cm[1].matchAll(
      /x0: (-?[\d.]+), y0: (-?[\d.]+), x1: (-?[\d.]+), y1: (-?[\d.]+), force: (-?[\d.]+)/g)]
      .map(c => ({ x0: +c[1], y0: +c[2], x1: +c[3], y1: +c[4], force: +c[5] })) : [];
    const openEdges = /openEdges: true/.test(seg);
    if (rows.length) out.push({ glyph: m[1], rows, currents, openEdges });
  }
  return out;
}

// ---------------------------------------------------------------------------
// platforms: maximal runs of landable surface. These are the notes; the
// traversals between them are the phrase.
// ---------------------------------------------------------------------------
/**
 * Landable surfaces, SPLIT where the stone changes state.
 *
 * Drank stone (`=`) carries the body and refunds nothing, so whether a shelf
 * refills the spark is a property of the tile you land on and not of the shelf
 * as a whole. Breaking a run at the live/drank seam makes each platform
 * uniformly one or the other, which is the only way the ledger below can be
 * honest without also modelling where along a shelf the body stopped.
 */
function platforms(w) {
  const solid = (x, y) => !AIR.has(w.at(x, y));
  const land = (x, y) => solid(x, y) && !solid(x, y - 1) && !solid(x, y - 2);
  const dryAt = (x, y) => w.at(x, y) === '=';
  const out = [];
  for (let y = 1; y < w.h; y++) {
    let x0 = -1, dry = false;
    const close = (x) => { if (x0 >= 0) out.push({ x0, x1: x - 1, y, dry }); x0 = -1; };
    for (let x = 0; x <= w.w; x++) {
      if (x < w.w && land(x, y)) {
        if (x0 < 0) { x0 = x; dry = dryAt(x, y); }
        else if (dryAt(x, y) !== dry) { close(x); x0 = x; dry = dryAt(x, y); }
      } else close(x);
    }
  }
  return out;
}

/**
 * How much height an updraft could give this traversal: the tallest current
 * column that stands between the two platforms and is reachable from A.
 */
function liftBetween(w, a, b) {
  let best = 0;
  for (const cu of w.currents ?? []) {
    const lo = Math.min(a.x0, b.x0) - 1, hi = Math.max(a.x1, b.x1) + 1;
    if (cu.x1 < lo || cu.x0 > hi) continue;
    if (cu.y1 < b.y - 1 || cu.y0 > a.y + 1) continue;   // it spans the climb
    best = Math.max(best, cu.y1 - cu.y0 + 1);
  }
  return best;
}

// ---------------------------------------------------------------------------
// one traversal: can the body get from platform A to platform B, and by how
// many frames could the jump have been mistimed?
// ---------------------------------------------------------------------------
const RUNUPS = [0, 12];
// when the steering is released, if at all. 0 is "hold it all the way"
const BRAKES = [0, 6, 10, 16, 24];
// How long the jump is held, in frames. This used to step 3-6-10-16-26-44,
// which is fine for landing on a shelf and useless for landing on a TILE: the
// gap between "falls short into the pit" and "sails over into the next one"
// can be narrower than the gap between two rungs of that ladder, so the search
// missed the legs tape entirely and reported the spark tape's tight window as
// the level's difficulty. A precision landing needs a precision ladder.
const HOLDS = [3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 20, 26, 34, 44, 999];
const DASHES = [null];
for (const at of noSpark ? [] : [2, 6, 10, 16, 24]) {
  for (const [dx, dy] of [[1, 0], [0.7, 0.7], [0, 1], [0.7, -0.7], [-0.7, 0.7]]) {
    DASHES.push({ at, dx, dy });
  }
}

/**
 * Fly one tape; true if the body comes to rest on platform B.
 *
 * `kicks` are extra jump presses mid-air, each with its own steering
 * direction. Airborne next to a wall, a press IS a wall-jump — so without
 * these the harness cannot verify one of the game's four verbs, and a shaft
 * climbed by wall-jumps reads to it as an unreachable room.
 */
function attempt(w, from, to, { launchX, dir, runUp, hold, dash, kicks = [], jumpDelay = 0, brake = 0 }) {
  const s = spawn(w, launchX, from.y - 1);
  s.py = -(from.y) + C.HH + 0.001;      // standing on the surface
  s.grounded = true; s.spark = true;
  const hold1 = (d) => ({ ...H, [d > 0 ? 'right' : 'left']: true });
  for (let i = 0; i < runUp + jumpDelay; i++) step(s, hold1(dir));
  step(s, { ...hold1(dir), press: true });
  let steer = dir;
  // 140 frames is a jump and a half. A current ride is neither: twelve courses
  // at CURRENT_RISE is most of two seconds, so a tape that ends at 140 lands
  // the body back where it started and calls the channel impossible.
  const FLY = (w.currents ?? []).length ? 420 : 140;
  for (let f = 0; f < FLY; f++) {
    const k = kicks.find(q => q.at === f);
    if (k) steer = k.dir;
    // THE AIR BRAKE. Let go of the direction and the body coasts -- air
    // control is an acceleration, not a speed you are stuck with -- and that
    // is the whole technique for landing on something small. Holding the
    // stick for the entire flight, which is all this used to search, measures
    // a player who has decided not to aim: it put a one-tile landing at two
    // frames and called the level unfair when the level was fine.
    const inp = (brake > 0 && f >= brake && !k)
      ? { ...H, jump: f < hold }
      : { ...hold1(steer), jump: f < hold };
    if (k) { inp.press = true; }
    else if (f === hold) inp.release = true;
    if (dash && f === dash.at) { inp.dash = true; inp.dashDX = dash.dx * steer; inp.dashDY = dash.dy; }
    step(s, inp);
    if (s.dead) return false;
    if (s.grounded && f > 3) {
      const fx = Math.floor(s.px), fy = Math.round(-(s.py - C.HH));
      const ok = fy === to.y && fx >= to.x0 && fx <= to.x1;
      return ok ? { frames: runUp + jumpDelay + f + 1 } : false;
    }
  }
  return false;
}

function solve(w, from, to, dashes = DASHES) {
  const dir = to.x0 > from.x1 ? 1 : to.x1 < from.x0 ? -1 : (to.x0 >= from.x0 ? 1 : -1);
  const launches = dir > 0
    ? [from.x1, Math.max(from.x0, from.x1 - 3), from.x0]
    : [from.x0, Math.min(from.x1, from.x0 + 3), from.x1];
  const rise = from.y - to.y;
  // wall-jump tapes are only worth searching when the target is ABOVE — that
  // is what a kick buys, and it keeps the search from exploding on flat ground
  const kickSets = [[]];
  if (rise >= 2) {
    for (const at of [8, 12, 16, 22, 28]) {
      for (const kd of [1, -1]) {
        kickSets.push([{ at, dir: kd }]);
        for (const at2 of [at + 10, at + 16]) kickSets.push([{ at, dir: kd }, { at: at2, dir: -kd }]);
      }
    }
  }
  // The DASH loop is OUTERMOST on purpose, so the entire spark-free tape space
  // is exhausted before a single spark tape is tried. Nested the other way the
  // search returned the first tape that worked at all, and since a spark
  // rescues a badly cut jump, that was almost always a spark: the report then
  // read `spark@2` on beats a walker clears, and quoted the spark tape's
  // tighter margin. DASHES[0] is null, so this yields the CHEAPEST verb that
  // solves the beat — which is the one the player will actually find.
  for (const dash of dashes) {
    for (const launchX of launches) {
      for (const runUp of RUNUPS) {
        for (const hold of HOLDS) {
          for (const kicks of kickSets) {
            for (const brake of BRAKES) {
              const opt = { launchX, dir, runUp, hold, dash, kicks, brake };
              const r = attempt(w, from, to, opt);
              if (r) return { ...opt, frames: r.frames };
            }
          }
        }
      }
    }
  }
  return null;
}

/**
 * What a MISS costs. Fly the beat's own tape with the jump cut short, and see
 * where the body ends up: standing on something, or still falling.
 *
 * Checkpoint spacing alone does not measure risk. A room can put its sconces
 * six beats apart and still cost nothing, because a safety floor two courses
 * under every jump means the hardest gap in the game is worth four seconds.
 * Risk is spacing AND the absence of a net; this is the second half.
 */
function missCost(w, from, to, opt, route, i, lastLit) {
  const short = { ...opt, hold: 2, dash: null, kicks: [] };
  const s = spawn(w, short.launchX, from.y - 1);
  s.py = -(from.y) + C.HH + 0.001;
  s.grounded = true; s.spark = true;
  const dir = short.dir;
  const hold1 = (d) => ({ ...H, [d > 0 ? 'right' : 'left']: true });
  for (let i = 0; i < short.runUp; i++) step(s, hold1(dir));
  step(s, { ...hold1(dir), press: true });
  for (let f = 0; f < 200; f++) {
    step(s, { ...hold1(dir), jump: f < 2 });
    // a gutter costs everything back to the last light you paid for
    if (s.dead) return i - lastLit;
    if (s.grounded && f > 3) {
      const fx = Math.floor(s.px), fy = Math.round(-(s.py - C.HH));
      // which beat of the path did the body land back on?
      let back = -1;
      for (let k = 0; k <= i; k++) {
        const q = route[k].b;
        if (fy === q.y && fx >= q.x0 - 1 && fx <= q.x1 + 1) back = k;
      }
      if (back < 0 && fy === route[0].a.y) back = 0;
      return back < 0 ? i - lastLit : i - back;      // beats of progress lost
    }
  }
  return i - lastLit;
}

/** how many frames the jump press may slide and still land it */
function margin(w, from, to, opt) {
  let early = 0, late = 0;
  for (let k = 1; k <= 20; k++) {
    if (!attempt(w, from, to, { ...opt, jumpDelay: k })) break;
    late = k;
  }
  for (let k = 1; k <= 20 && opt.runUp - k >= 0; k++) {
    if (!attempt(w, from, to, { ...opt, runUp: opt.runUp - k })) break;
    early = k;
  }
  return early + late + 1;
}

// ---------------------------------------------------------------------------
// the undecided-corridor lint, done honestly this time: the longest STRETCH
// with nothing to decide about, not merely whether a run contains a marker
// ---------------------------------------------------------------------------
function longestUndecided(w) {
  const solid = (x, y) => !AIR.has(w.at(x, y));
  const land = (x, y) => solid(x, y) && !solid(x, y - 1) && !solid(x, y - 2);
  const busy = (x, y) => {
    for (let d = -1; d <= 1; d++) for (let k = 1; k <= 3; k++) {
      if ('oXR*Ab12SM^><'.includes(w.at(x + d, y - k))) return true;
    }
    return false;
  };
  let worst = 0, where = '';
  for (let y = 1; y < w.h; y++) {
    let run = 0;
    for (let x = 0; x < w.w; x++) {
      if (land(x, y) && !busy(x, y)) {
        run++;
        if (run > worst) { worst = run; where = `y${y} x${x - run + 1}`; }
      } else run = 0;
    }
  }
  return { worst, where };
}

// ---------------------------------------------------------------------------
const m = metrics();
const MAXJ = m.running.distance;
const rooms = loadRooms().filter(r => r.glyph !== 'proving' && (!only || r.glyph === only));
let broken = 0, tight = 0, flatFail = 0, sparkOptional = 0, strandFail = 0;
const FLAT_MAX = 10;

console.log(`solvability harness · body ${(C.HW * 2).toFixed(2)}×${(C.HH * 2).toFixed(2)} tiles`);
console.log(`running jump ${MAXJ.toFixed(2)} across / ${m.standing.height.toFixed(2)} up · margin threshold ${MARGIN}f\n`);

for (const { glyph, rows, currents, openEdges } of rooms) {
  const w = new World(rows, openEdges, currents);
  const flat = longestUndecided(w);
  if (flatOnly) {
    const bad = flat.worst > FLAT_MAX;
    if (bad) flatFail++;
    console.log(`${glyph.padEnd(9)} longest undecided ${String(flat.worst).padStart(3)} tiles @ ${flat.where}  ${bad ? 'FLAT' : 'ok'}`);
    continue;
  }

  const sconces = [];
  for (let y = 0; y < w.h; y++) for (let x = 0; x < w.w; x++) if (w.at(x, y) === 'S') sconces.push({ x, y });
  const plats = platforms(w);
  // every pair the body could plausibly be asked to cross
  const edges = [];
  for (const a of plats) {
    for (const b of plats) {
      if (a === b) continue;
      const dx = b.x0 > a.x1 ? b.x0 - a.x1 : b.x1 < a.x0 ? a.x0 - b.x1 : 0;
      const dy = a.y - b.y;                       // + is upward
      if (dx > MAXJ + 4 || dx < 0) continue;
      // A CURRENT CHANGES WHAT "UP" COSTS. The five-course ceiling on an
      // upward pair is the body's own reach with a jump and a kick or two; an
      // updraft carries it as far as the column is tall, so a pair joined by
      // one is allowed the height of that column. Without this the channel
      // edge was thrown away before it was ever simulated, and a room built
      // around wind read as a room with no way up.
      const lift = liftBetween(w, a, b);
      if (dy > 5 + lift || dy < -14) continue;
      if (dx === 0 && Math.abs(dy) <= 1) continue; // same shelf, no traversal
      edges.push([a, b, dx, dy]);
    }
  }

  // prove every edge, then grade only the ones the GOLDEN PATH actually uses.
  // A tight margin on a backwards leap down a shaft is not a design failure —
  // nobody is asked to make it. Grading every pair floods the report with
  // traversals the level never requests, which is how a harness becomes noise.
  const key = (p) => `${p.x0},${p.y}`;

  // THE SPARK LEDGER. A node is not a platform, it is a platform AND whether
  // there is a breath in hand when you arrive on it. Without that the search
  // silently assumed a full spark at the start of every beat, which is fine in
  // a room built of live stone and a lie in a room built of drank stone: THE
  // FAMINE is entirely about where the next refill is, and a harness that
  // hands out a free spark per jump cannot see the room at all.
  //
  // Landing rules, straight from vault.ts: live stone refills, drank stone
  // gives nothing back and leaves the ledger exactly as it was, and a spark
  // spent in flight is gone whatever you land on.
  const solveCache = new Map();
  const edgeOpt = (a, b, hasSpark) => {
    const k = key(a) + '>' + key(b) + (hasSpark ? '|s' : '|-');
    if (!solveCache.has(k)) solveCache.set(k, solve(w, a, b, hasSpark ? DASHES : [null]));
    return solveCache.get(k);
  };
  const nkey = (p, sp) => key(p) + (sp ? '|s' : '|-');
  const graph = new Map();
  let solved = 0;
  const opts = new Map();
  for (const [a, b, dx, dy] of edges) {
    for (const hasSpark of [true, false]) {
      const opt = edgeOpt(a, b, hasSpark);
      if (!opt) continue;
      if (hasSpark) solved++;
      const to = b.dry ? (opt.dash ? false : hasSpark) : true;
      const from = nkey(a, hasSpark);
      if (!graph.has(from)) graph.set(from, []);
      graph.get(from).push({ b, spark: to });
      opts.set(from + '>' + nkey(b, to), { a, b, dx, dy, opt, spark: hasSpark });
    }
  }
  const find = (ch) => {
    for (let y = 0; y < w.h; y++) for (let x = 0; x < w.w; x++) if (w.at(x, y) === ch) return { x, y };
    return null;
  };
  const under = (pt) => plats.find(p => pt.x >= p.x0 - 1 && pt.x <= p.x1 + 1 && p.y >= pt.y && p.y <= pt.y + 3);
  const entry = find('@'), M = find('M');
  const startP = entry && under(entry), goalP = M && under(M);

  // shortest verified route from the entry to the stone. You arrive on foot
  // with a breath in hand, and the ledger runs from there.
  let route = [];
  let goalNode = null;
  if (startP && goalP) {
    const prev = new Map([[nkey(startP, true), null]]);
    const q = [{ p: startP, spark: true }];
    while (q.length) {
      const cur = q.shift();
      if (key(cur.p) === key(goalP)) { goalNode = cur; break; }
      for (const nx of graph.get(nkey(cur.p, cur.spark)) ?? []) {
        if (prev.has(nkey(nx.b, nx.spark))) continue;
        prev.set(nkey(nx.b, nx.spark), cur);
        q.push({ p: nx.b, spark: nx.spark });
      }
    }
    if (process.env.DBG) {
      const seen = [...prev.keys()];
      console.log(`  reached ${seen.length}/${plats.length} platforms from the entry`);
      const missed = plats.filter(p => !prev.has(nkey(p, true)) && !prev.has(nkey(p, false)))
        .map(p => `y${p.y}x${p.x0}-${p.x1}`);
      console.log('  never reached:', missed.join(' '));
      if (process.env.DBG_TO) {
        const tgt = [...prev.keys()].find(k => k === process.env.DBG_TO);
        const src = tgt ? prev.get(tgt) : null;
        console.log(`  ${process.env.DBG_TO} reached from`, src ? key(src) : 'NOWHERE');
        if (src) {
          const e = opts.get(key(src) + '>' + process.env.DBG_TO);
          console.log('  via', JSON.stringify(e && e.opt));
        }
      }
    }
    if (goalNode) {
      let cur = goalNode;
      while (prev.get(nkey(cur.p, cur.spark))) {
        const p0 = prev.get(nkey(cur.p, cur.spark));
        route.unshift(opts.get(nkey(p0.p, p0.spark) + '>' + nkey(cur.p, cur.spark)));
        cur = p0;
      }
    }
  }
  const reachesStone = route.length > 0 || (startP && goalP && key(startP) === key(goalP));

  // THE SOFTLOCK. A room whose resource can run out can stand you somewhere
  // the stone is no longer reachable from — no death, no gutter, nothing to
  // tell you it happened, and the only cure is Esc. That is a worse failure
  // than an impossible jump because the room keeps letting you play.
  //
  // The ledger graph answers it directly: walk forward from the entry, walk
  // BACKWARD from every node that stands on the stone's platform, and every
  // node in the first set had better be in the second. A drank recovery floor
  // with no legs-only way off it is exactly what this catches.
  let stranded = [];
  if (startP && goalP) {
    const fwd = new Set([nkey(startP, true)]);
    const q3 = [{ p: startP, spark: true }];
    while (q3.length) {
      const c = q3.shift();
      for (const nx of graph.get(nkey(c.p, c.spark)) ?? []) {
        if (fwd.has(nkey(nx.b, nx.spark))) continue;
        fwd.add(nkey(nx.b, nx.spark)); q3.push({ p: nx.b, spark: nx.spark });
      }
    }
    const back = new Map();
    for (const [from, tos] of graph) {
      for (const t of tos) {
        const k = nkey(t.b, t.spark);
        if (!back.has(k)) back.set(k, []);
        back.get(k).push(from);
      }
    }
    const safe = new Set();
    const q4 = [];
    for (const sp of [true, false]) {
      const k = nkey(goalP, sp);
      if (fwd.has(k)) { safe.add(k); q4.push(k); }
    }
    while (q4.length) {
      const c = q4.shift();
      for (const b2 of back.get(c) ?? []) {
        if (safe.has(b2)) continue;
        safe.add(b2); q4.push(b2);
      }
    }
    stranded = [...fwd].filter(k => !safe.has(k));
  }

  // THE DRY RUN: the longest stretch of the route flown with nothing in hand.
  // In a famine that is the difficulty curve stated as a number — it is the
  // count of beats you must land clean in a row before the stone gives the
  // breath back.
  let dryRun = 0, cur = 0, refills = 0;
  for (const e of route) {
    if (e.opt.dash) refills++;             // a spark spent is a spark that was there
    if (e.b.dry) { cur++; dryRun = Math.max(dryRun, cur); } else cur = 0;
  }
  const graded = DONE.includes(glyph);
  if (!reachesStone && graded) broken++;

  // RULE 6 / the tutorial gate, run automatically for graded rooms: solve the
  // whole room again with the spark DISABLED. If the stone is still reachable,
  // the scarce verb is optional — which is the fault this rebuild exists to
  // fix, and it hid behind a green harness twice before this check existed.
  let sparkForced = null;
  if (graded && goalP && startP) {
    const g2 = new Map();
    for (const [a, b] of edges) {
      if (!solve(w, a, b, [null])) continue;
      if (!g2.has(key(a))) g2.set(key(a), []);
      g2.get(key(a)).push(b);
    }
    const seen2 = new Set([key(startP)]);
    const q2 = [startP];
    while (q2.length) {
      const cur = q2.shift();
      for (const nx of g2.get(key(cur)) ?? []) {
        if (seen2.has(key(nx))) continue;
        seen2.add(key(nx)); q2.push(nx);
      }
    }
    sparkForced = !seen2.has(key(goalP));
    if (!sparkForced) sparkOptional++;
  }

  // PRICE THE PATH. The clear time is the number a room is actually designed
  // against — "it takes ten seconds" is the only feedback that matters and it
  // was not measurable before. This sums the frames of each beat's tape plus
  // the walk between landings, over the EXPERT line (BFS minimises beats), so
  // it is a floor on the clear time and not an average.
  let frames = 0;
  for (const e of route) {
    frames += (e.opt && e.opt.frames) || 60;
    const walk = Math.max(0, Math.abs(e.b.x0 - e.a.x1) - MAXJ);
    frames += (walk / C.WALK) * 60;
  }
  const seconds = +(frames / 60).toFixed(1);

  // RISK — what a fall actually costs, in beats.
  //
  // A room can be precise and still have no stakes: if every miss drops you on
  // a floor two courses down and you walk back, the hardest jump in the game
  // costs four seconds. Hollow Knight's platforming is not harder than
  // Celeste's per input; it is riskier per attempt, because the checkpoints
  // are far apart and a fall spends the climb.
  //
  // So this counts the longest run of consecutive golden-path beats with no
  // sconce on it. That is the progress a single miss can cost, and it is the
  // dial that turns precision into risk.
  const lit = [];
  route.forEach((e, i) => {
    const onIt = sconces.some(sc =>
      sc.x >= e.b.x0 - 2 && sc.x <= e.b.x1 + 2 && Math.abs(sc.y - e.b.y) <= 3);
    if (onIt) lit.push(i);
  });
  let risk = 0, since = 0;
  for (let i = 0; i < route.length; i++) {
    if (lit.includes(i)) since = 0; else since++;
    risk = Math.max(risk, since);
  }

  const hard = [];
  let lostMax = 0, lostSum = 0;
  for (let i = 0; i < route.length; i++) {
    const e = route[i];
    if (!e) continue;
    const mg = margin(w, e.a, e.b, e.opt);
    if (mg < MARGIN) hard.push({ ...e, mg });
    const lastLit = lit.filter(k => k < i).pop() ?? 0;
    const lost = missCost(w, e.a, e.b, e.opt, route, i, lastLit);
    lostMax = Math.max(lostMax, lost);
    lostSum += lost;
  }
  const lostAvg = route.length ? +(lostSum / route.length).toFixed(1) : 0;
  tight += hard.length;
  if (graded && stranded.length) strandFail++;

  console.log(`${glyph.padEnd(9)} ${(graded ? 'GRADED' : 'report').padEnd(6)} platforms ${String(plats.length).padStart(3)} · proved ${String(solved).padStart(4)}`
    + ` · path ${String(route.length).padStart(2)} beats`
    + ` · tight(<${MARGIN}f) ${String(hard.length).padStart(2)}`
    + ` · stone ${reachesStone ? 'reached' : 'UNREACHED'}`
    + (sparkForced === null ? '' : ` · spark ${sparkForced ? 'FORCED' : 'OPTIONAL'}`)
    + (plats.some(p2 => p2.dry) ? ` · dry run ${dryRun} beats, ${refills} spark(s) spent` : '')
    + (stranded.length ? ` · STRANDS at ${stranded.length} node(s): ${stranded.slice(0, 4).join(' ')}` : '')
    + ` · fast line ${String(seconds).padStart(5)}s`
    + ` · a miss costs ${String(lostAvg).padStart(4)} beats avg, ${String(lostMax).padStart(2)} worst`
    + ` · undecided ${String(flat.worst).padStart(3)}t${flat.worst > FLAT_MAX ? ' FLAT' : ''}`);
  if (flat.worst > FLAT_MAX && graded) flatFail++;
  if (verbose) {
    for (const e of route) {
      const mg = margin(w, e.a, e.b, e.opt);
      console.log(`    beat (${e.a.x0},${e.a.y})→(${e.b.x0},${e.b.y})  dx=${e.dx} dy=${e.dy}`
        + `  ${(e.dx / MAXJ).toFixed(2)}x  ${e.opt.dash ? `spark@${e.opt.dash.at}` : 'legs'}`
        + `  margin ${mg}f${mg < MARGIN ? '  TIGHT' : ''}`);
    }
    for (const t of hard.slice(0, 6)) {
      console.log(`    tight ${t.mg}f  (${t.a.x0},${t.a.y})→(${t.b.x0},${t.b.y})  dx=${t.dx} dy=${t.dy}`
        + `  ${t.opt.dash ? `spark@${t.opt.dash.at}` : 'no spark'} hold=${t.opt.hold}`);
    }
  }
}

if (!flatOnly) {
  console.log(`
graded: ${DONE.join(", ")} — the rest are REPORTED, not graded: they`
    + ` predate the measured body, and failing them is the audit's finding.`);
  console.log(`${sparkOptional} graded room(s) where the spark is OPTIONAL`);
  console.log(`${strandFail} graded room(s) that can strand the body with the stone unreachable`);
  console.log(`${broken} graded room(s) with no proved path to the stone`
    + ` · ${tight} traversal(s) tighter than ${MARGIN} frames`
    + ` · ${flatFail} graded room(s) with a corridor over ${FLAT_MAX} tiles`);
}
process.exit(broken || flatFail || sparkOptional || strandFail ? 1 : 0);
