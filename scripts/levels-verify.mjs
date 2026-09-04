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
const verbose = args.includes('--verbose');

const AIR = new Set('.dS@MXAbR^><KFCN12o*'.split(''));
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
    if (rows.length) out.push({ glyph: m[1], rows });
  }
  return out;
}

// ---------------------------------------------------------------------------
// platforms: maximal runs of landable surface. These are the notes; the
// traversals between them are the phrase.
// ---------------------------------------------------------------------------
function platforms(w) {
  const solid = (x, y) => !AIR.has(w.at(x, y));
  const land = (x, y) => solid(x, y) && !solid(x, y - 1) && !solid(x, y - 2);
  const out = [];
  for (let y = 1; y < w.h; y++) {
    let x0 = -1;
    for (let x = 0; x <= w.w; x++) {
      if (x < w.w && land(x, y)) { if (x0 < 0) x0 = x; }
      else if (x0 >= 0) { out.push({ x0, x1: x - 1, y }); x0 = -1; }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// one traversal: can the body get from platform A to platform B, and by how
// many frames could the jump have been mistimed?
// ---------------------------------------------------------------------------
const RUNUPS = [0, 12];
const HOLDS = [3, 6, 10, 16, 26, 44, 999];
const DASHES = [null];
for (const at of [2, 6, 10, 16, 24]) {
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
function attempt(w, from, to, { launchX, dir, runUp, hold, dash, kicks = [], jumpDelay = 0 }) {
  const s = spawn(w, launchX, from.y - 1);
  s.py = -(from.y) + C.HH + 0.001;      // standing on the surface
  s.grounded = true; s.spark = true;
  const hold1 = (d) => ({ ...H, [d > 0 ? 'right' : 'left']: true });
  for (let i = 0; i < runUp + jumpDelay; i++) step(s, hold1(dir));
  step(s, { ...hold1(dir), press: true });
  let steer = dir;
  for (let f = 0; f < 140; f++) {
    const k = kicks.find(q => q.at === f);
    if (k) steer = k.dir;
    const inp = { ...hold1(steer), jump: f < hold };
    if (k) { inp.press = true; }
    else if (f === hold) inp.release = true;
    if (dash && f === dash.at) { inp.dash = true; inp.dashDX = dash.dx * steer; inp.dashDY = dash.dy; }
    step(s, inp);
    if (s.dead) return false;
    if (s.grounded && f > 3) {
      const fx = Math.floor(s.px), fy = Math.round(-(s.py - C.HH));
      return fy === to.y && fx >= to.x0 && fx <= to.x1;
    }
  }
  return false;
}

function solve(w, from, to) {
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
  for (const launchX of launches) {
    for (const runUp of RUNUPS) {
      for (const hold of HOLDS) {
        for (const kicks of kickSets) {
          for (const dash of DASHES) {
            const opt = { launchX, dir, runUp, hold, dash, kicks };
            if (attempt(w, from, to, opt)) return opt;
          }
        }
      }
    }
  }
  return null;
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
let broken = 0, tight = 0, flatFail = 0;
const FLAT_MAX = 10;

console.log(`solvability harness · body ${(C.HW * 2).toFixed(2)}×${(C.HH * 2).toFixed(2)} tiles`);
console.log(`running jump ${MAXJ.toFixed(2)} across / ${m.standing.height.toFixed(2)} up · margin threshold ${MARGIN}f\n`);

for (const { glyph, rows } of rooms) {
  const w = new World(rows);
  const flat = longestUndecided(w);
  if (flatOnly) {
    const bad = flat.worst > FLAT_MAX;
    if (bad) flatFail++;
    console.log(`${glyph.padEnd(9)} longest undecided ${String(flat.worst).padStart(3)} tiles @ ${flat.where}  ${bad ? 'FLAT' : 'ok'}`);
    continue;
  }

  const plats = platforms(w);
  // every pair the body could plausibly be asked to cross
  const edges = [];
  for (const a of plats) {
    for (const b of plats) {
      if (a === b) continue;
      const dx = b.x0 > a.x1 ? b.x0 - a.x1 : b.x1 < a.x0 ? a.x0 - b.x1 : 0;
      const dy = a.y - b.y;                       // + is upward
      if (dx > MAXJ + 4 || dx < 0) continue;
      if (dy > 5 || dy < -14) continue;
      if (dx === 0 && Math.abs(dy) <= 1) continue; // same shelf, no traversal
      edges.push([a, b, dx, dy]);
    }
  }

  // prove every edge, then grade only the ones the GOLDEN PATH actually uses.
  // A tight margin on a backwards leap down a shaft is not a design failure —
  // nobody is asked to make it. Grading every pair floods the report with
  // traversals the level never requests, which is how a harness becomes noise.
  const key = (p) => `${p.x0},${p.y}`;
  const graph = new Map();
  let solved = 0;
  const opts = new Map();
  for (const [a, b, dx, dy] of edges) {
    const opt = solve(w, a, b);
    if (!opt) continue;
    solved++;
    if (!graph.has(key(a))) graph.set(key(a), []);
    graph.get(key(a)).push(b);
    opts.set(key(a) + '>' + key(b), { a, b, dx, dy, opt });
  }
  const find = (ch) => {
    for (let y = 0; y < w.h; y++) for (let x = 0; x < w.w; x++) if (w.at(x, y) === ch) return { x, y };
    return null;
  };
  const under = (pt) => plats.find(p => pt.x >= p.x0 - 1 && pt.x <= p.x1 + 1 && p.y >= pt.y && p.y <= pt.y + 3);
  const entry = find('@'), M = find('M');
  const startP = entry && under(entry), goalP = M && under(M);

  // shortest verified route from the entry to the stone
  let route = [];
  if (startP && goalP) {
    const prev = new Map([[key(startP), null]]);
    const q = [startP];
    while (q.length) {
      const cur = q.shift();
      if (key(cur) === key(goalP)) break;
      for (const nx of graph.get(key(cur)) ?? []) {
        if (prev.has(key(nx))) continue;
        prev.set(key(nx), cur);
        q.push(nx);
      }
    }
    if (process.env.DBG) {
      const seen = [...prev.keys()];
      console.log(`  reached ${seen.length}/${plats.length} platforms from the entry`);
      const missed = plats.filter(p => !prev.has(key(p))).map(p => `y${p.y}x${p.x0}-${p.x1}`);
      console.log('  never reached:', missed.join(' '));
      const frontier = [...prev.keys()].map(k => k).sort();
      console.log('  reached:', frontier.join(' '));
    }
    if (prev.has(key(goalP))) {
      let cur = goalP;
      while (prev.get(key(cur))) {
        const p0 = prev.get(key(cur));
        route.unshift(opts.get(key(p0) + '>' + key(cur)));
        cur = p0;
      }
    }
  }
  const reachesStone = route.length > 0 || (startP && goalP && key(startP) === key(goalP));
  const graded = DONE.includes(glyph);
  if (!reachesStone && graded) broken++;

  const hard = [];
  for (const e of route) {
    if (!e) continue;
    const mg = margin(w, e.a, e.b, e.opt);
    if (mg < MARGIN) hard.push({ ...e, mg });
  }
  tight += hard.length;

  console.log(`${glyph.padEnd(9)} ${(graded ? 'GRADED' : 'report').padEnd(6)} platforms ${String(plats.length).padStart(3)} · proved ${String(solved).padStart(4)}`
    + ` · path ${String(route.length).padStart(2)} beats`
    + ` · tight(<${MARGIN}f) ${String(hard.length).padStart(2)}`
    + ` · stone ${reachesStone ? 'reached' : 'UNREACHED'}`
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
  console.log(`${broken} graded room(s) with no proved path to the stone`
    + ` · ${tight} traversal(s) tighter than ${MARGIN} frames`
    + ` · ${flatFail} graded room(s) with a corridor over ${FLAT_MAX} tiles`);
}
process.exit(broken || flatFail ? 1 : 0);
