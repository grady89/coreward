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
console.log(bad ? `FAIL — ${bad} vault(s) no longer admit the body` : 'OK — every room still admits the body');
process.exit(bad ? 1 : 0);
