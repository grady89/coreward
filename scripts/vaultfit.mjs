// Does the driller still fit through its own levels?
//
// The vault body is BODY x (0.30 x 0.52) tiles. At BODY 1 it lived inside a
// single air tile; larger and it spans two rows, so it needs two clear rows
// everywhere it goes. This walks each authored map with that footprint and
// checks the master stone and every sconce are still reachable from the entry.
//
// The maps are read from the running app, not from source: several rows are
// built by expression (".slice(0, 53) + '#'"), so only the evaluated arrays
// are the truth.
import { chromium } from 'playwright';
import { readFileSync } from 'fs';

/**
 * The rooms rewritten against the final kit (V4), shared with vaults.mjs so
 * there is one roster and not two. The P5 model GRADES these and only
 * reports on the rest: a room not yet authored under V4 was authored against
 * the old flood walk, which moved like a ghost, and failing on it would keep
 * the suite red for the length of the phase instead of telling anyone
 * anything. A room joins the list in its own commit.
 */
const V4_DONE = JSON.parse(readFileSync('scripts/v4-done.json', 'utf8'));

const body = Number(process.argv[2] ?? (readFileSync('src/game/vault.ts', 'utf8').match(/const BODY = ([0-9.]+)/) ?? [])[1]);
if (!Number.isFinite(body) || body <= 0) throw new Error('could not read BODY from src/game/vault.ts');
const HW = 0.15 * body, HH = 0.26 * body;
const rowsNeeded = Math.max(1, Math.ceil(HH * 2));
const colsNeeded = Math.max(1, Math.ceil(HW * 2));

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
await page.goto('http://localhost:4173');
await page.waitForTimeout(3200);
const maps = await page.evaluate(() =>
  [...window.__VAULTS, ...window.__TEST_VAULTS].map(v => ({ glyph: v.glyph, map: v.map })));
await browser.close();

// door masonry counts as air: it melts open once its sconces burn, and the
// sconces are reachable — otherwise every doored vault reads as a false block
// the standing dead are decor, one char per posture (K/F/C/N) — a body
// walks straight through them, so they read as air to the fit walk
// motes and braziers hang in the air the body moves through
const AIR = new Set(['.', 'd', 'S', '@', 'M', 'X', 'A', 'b', 'R', '^', '>', '<',
  'K', 'F', 'C', 'N', '1', '2', 'o', '*']);
let bad = 0;
const table = [];
for (const { glyph, map: rows } of maps) {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const at = (x, y) => (y < 0 || y >= h || x < 0 || x >= w) ? '#' : (rows[y][x] ?? '#');
  const air = (x, y) => AIR.has(at(x, y));
  // body anchored with its top-left at (x, y)
  const fits = (x, y) => {
    for (let dy = 0; dy < rowsNeeded; dy++)
      for (let dx = 0; dx < colsNeeded; dx++) if (!air(x + dx, y + dy)) return false;
    return true;
  };
  const find = ch => { const o = []; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (at(x, y) === ch) o.push([x, y]); return o; };
  const [entry] = find('@');
  let start = null;
  for (let dy = 0; dy < 4 && !start; dy++) if (fits(entry[0], entry[1] - dy)) start = [entry[0], entry[1] - dy];
  if (!start) { table.push({ glyph, size: `${w}x${h}`, master: 'NO FIT AT ENTRY', sconces: '-', missed: '-' }); bad++; continue; }

  // flood every placement the body can occupy, 4-connected — a generous
  // over-approximation of movement (it also dashes and wall-jumps), so what
  // this cannot reach is certainly unreachable in play
  const key = (x, y) => y * w + x;
  const seen = new Set([key(...start)]);
  const q = [start];
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (seen.has(key(nx, ny)) || !fits(nx, ny)) continue;
      seen.add(key(nx, ny)); q.push([nx, ny]);
    }
  }
  const covered = (tx, ty) => {
    for (let dy = 0; dy < rowsNeeded; dy++)
      for (let dx = 0; dx < colsNeeded; dx++) if (seen.has(key(tx - dx, ty - dy))) return true;
    return false;
  };
  const master = find('M'), sconces = find('S');
  const mOk = master.length > 0 && master.every(([x, y]) => covered(x, y));
  const missed = sconces.filter(([x, y]) => !covered(x, y));
  if (!mOk || missed.length) bad++;
  table.push({ glyph, size: `${w}x${h}`, master: mOk ? 'reachable' : 'BLOCKED',
    sconces: `${sconces.length - missed.length}/${sconces.length}`,
    missed: missed.map(p => p.join(',')).join(' ') || '-' });
}

console.log(`BODY ${body}x → ${(HW * 2).toFixed(2)} x ${(HH * 2).toFixed(2)} tiles · needs ${colsNeeded}x${rowsNeeded} clear`);
console.table(table);

// ===========================================================================
// P5 — THE REACH MODEL. "The spark corrects; the legs travel."
//
// The walk above is 4-connected flood: a deliberate over-approximation that
// proves what is CERTAINLY unreachable. It cannot prove a room is playable,
// because it moves like a ghost.
//
// This one moves like the body. It carries the three numbers from §I:
//
//     jump  2.8 tiles of rise, and the arc that goes with it
//     spark +2.1 tiles, one charge, spent as a CORRECTION
//     refill on landing (live stone only — drank stone gives nothing back)
//
// and it walks (x, y, spark) from the entry, proving the golden path to the
// master stone and to every sconce. Its job is not to say a room is fun; it
// is to say the room can be finished by legs that are shorter than the
// player thinks, and to catch the authoring error the flood walk cannot see:
// a required crossing that needs two sparks with no ground between them.
// ===========================================================================

const JUMP_RISE = 2;        // 2.8 tiles of rise = two whole courses cleared
const JUMP_RUN = 3;         // and the horizontal it buys at the top of the arc
const SPARK_RUN = 2;        // +2.1: the last two tiles, never the crossing
const reachRows = [];
let reachBad = 0;

for (const { glyph, map: rows } of maps) {
  if (glyph === 'proving') continue;              // the dev hall is not a room
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const at = (x, y) => (y < 0 || y >= h || x < 0 || x >= w) ? '#' : (rows[y][x] ?? '#');
  const air = (x, y) => AIR.has(at(x, y));
  const fits = (x, y) => {
    for (let dy = 0; dy < rowsNeeded; dy++)
      for (let dx = 0; dx < colsNeeded; dx++) if (!air(x + dx, y + dy)) return false;
    return true;
  };
  // standing on something: the course under the body's feet is not air
  const grounded = (x, y) => {
    for (let dx = 0; dx < colsNeeded; dx++) if (!air(x + dx, y + rowsNeeded)) return true;
    return false;
  };
  // and whether that footing gives the breath back. Drank stone (`=`) is the
  // one floor that carries you and refunds nothing (§III).
  const refills = (x, y) => {
    for (let dx = 0; dx < colsNeeded; dx++) {
      const c = at(x + dx, y + rowsNeeded);
      if (c !== '=' && !AIR.has(c)) return true;
    }
    return false;
  };
  const clearBetween = (x0, x1, y) => {
    const lo = Math.min(x0, x1), hi = Math.max(x0, x1);
    for (let x = lo; x <= hi; x++) if (!fits(x, y)) return false;
    return true;
  };

  const find = ch => { const o = []; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (at(x, y) === ch) o.push([x, y]); return o; };
  const [entry] = find('@');
  let start = null;
  for (let dy = 0; dy < 4 && !start; dy++) if (fits(entry[0], entry[1] - dy)) start = [entry[0], entry[1] - dy];
  if (!start) { reachRows.push({ glyph, golden: 'NO FIT', sconces: '-', doubleSpark: '-' }); reachBad++; continue; }

  const key = (x, y, sp) => (y * w + x) * 2 + sp;
  const seen = new Set();
  const q = [[start[0], start[1], 1]];
  seen.add(key(start[0], start[1], 1));
  // a crossing that consumed the spark and found no ground to refill on
  let strandedSpark = false;
  const push = (x, y, sp) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    if (!fits(x, y)) return;
    const k = key(x, y, sp);
    if (seen.has(k)) return;
    seen.add(k); q.push([x, y, sp]);
  };
  while (q.length) {
    const [x, y, sp] = q.pop();
    // FALL: gravity is free and always available
    if (!grounded(x, y)) {
      push(x, y + 1, sp);
      // steering airborne, a tile at a time
      if (fits(x + 1, y)) push(x + 1, y, sp);
      if (fits(x - 1, y)) push(x - 1, y, sp);
      // WALL-JUMP. Free, unlimited, and the reason a shaft is climbable at
      // all — leaving it out of the model would mean authoring rooms that
      // never use one of the game's four verbs.
      for (const d of [-1, 1]) {
        let touching = false;
        for (let dy = 0; dy < rowsNeeded; dy++) if (!air(x + (d > 0 ? colsNeeded : -1), y + dy)) touching = true;
        if (!touching) continue;
        for (let r = 1; r <= JUMP_RISE; r++) {
          if (!fits(x, y - r)) break;
          push(x, y - r, sp);
          for (let k = 1; k <= 2; k++) {
            if (!clearBetween(x, x - d * k, y - r)) break;
            push(x - d * k, y - r, sp);
          }
        }
      }
      // and the spark, spent mid-air as the correction it is
      if (sp) for (const d of [-1, 1]) {
        for (let k = 1; k <= SPARK_RUN; k++) {
          if (!clearBetween(x, x + d * k, y)) break;
          push(x + d * k, y, 0);
        }
      }
      continue;
    }
    // GROUNDED: the breath comes back under you, unless the famine drank it
    if (refills(x, y) && !sp) { push(x, y, 1); continue; }
    // walk, with a course of step-up for free
    for (const d of [-1, 1]) {
      if (fits(x + d, y)) push(x + d, y, sp);
      else if (fits(x + d, y - 1)) push(x + d, y - 1, sp);
    }
    // step off an edge
    if (fits(x, y + 1)) push(x, y + 1, sp);
    // JUMP: rise, then the run the arc buys at the top
    for (let r = 1; r <= JUMP_RISE; r++) {
      if (!fits(x, y - r)) break;
      push(x, y - r, sp);
      for (const d of [-1, 1]) {
        for (let k = 1; k <= JUMP_RUN; k++) {
          if (!clearBetween(x, x + d * k, y - r)) break;
          push(x + d * k, y - r, sp);
          // the spark extends the top of that arc, and only the top
          if (sp) for (let j = 1; j <= SPARK_RUN; j++) {
            if (!clearBetween(x + d * k, x + d * (k + j), y - r)) break;
            push(x + d * (k + j), y - r, 0);
          }
        }
      }
    }
  }

  const covered = (tx, ty) => {
    for (let sp = 0; sp <= 1; sp++)
      for (let dy = 0; dy < rowsNeeded; dy++)
        for (let dx = 0; dx < colsNeeded; dx++) if (seen.has(key(tx - dx, ty - dy, sp))) return true;
    return false;
  };
  // a place the model can only stand with the spark already spent, and which
  // gives nothing back, is a place the next crossing has to be free
  for (const st of seen) {
    const sp = st % 2, cell = (st - sp) / 2;
    const x = cell % w, y = (cell - x) / w;
    if (sp === 0 && grounded(x, y) && !refills(x, y) && !seen.has(key(x, y, 1))) strandedSpark = true;
  }

  const master = find('M'), sconces = find('S');
  const mOk = master.length > 0 && master.every(([x, y]) => covered(x, y));
  const missed = sconces.filter(([x, y]) => !covered(x, y));
  const rowBad = !mOk || missed.length > 0;
  const graded = V4_DONE.includes(glyph);
  if (rowBad && graded) reachBad++;
  reachRows.push({
    glyph,
    v4: graded ? 'graded' : 'report',
    golden: mOk ? 'proved' : 'NOT REACHED',
    sconces: `${sconces.length - missed.length}/${sconces.length}`,
    doubleSpark: strandedSpark ? 'risk' : '-',
  });
}

console.log('\nP5 reach model — jump 2.8 / spark +2.1 / one charge, refilled on live stone');
console.table(reachRows);
console.log(reachBad
  ? `P5 FAIL — ${reachBad} V4 room(s) the modelled body cannot finish`
  : `P5 OK — ${V4_DONE.length} room(s) graded, golden path proved`);

console.log(bad ? `FAIL — ${bad} vault(s) no longer admit the body` : 'OK — every room still admits the body');
process.exit(bad || reachBad ? 1 : 0);
