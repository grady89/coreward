// Review renders for the mineral rework: every ore standalone (the review
// page) and in the stone (the real game, real chunk renderer, real dark).
// Outputs to design-review/minerals/.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const OUT = 'design-review/minerals';
mkdirSync(OUT, { recursive: true });
const URL = 'http://localhost:5173'; // vite dev — the review page imports /src directly

const KEYS = [
  'copper', 'iron', 'silver', 'gold', 'ruby', 'voidopal', 'diamond',
  'embershard', 'veinlight', 'frostbloom', 'rime-salt', 'nacre', 'mimic',
];

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

// ---- standalone: the review stage ----
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

await page.goto(URL + '/minerals-review.html?m=all');
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/lineup.png` });

await page.setViewportSize({ width: 900, height: 700 });
for (const k of KEYS) {
  await page.goto(URL + `/minerals-review.html?m=${k}`);
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `${OUT}/${k}.png` });
}
console.log('standalone sheets done');

// ---- in the stone: the actual game ----
const game = await browser.newPage({ viewport: { width: 1280, height: 800 } });
game.on('pageerror', e => errors.push('GAME PAGEERROR: ' + e.message));
await game.goto(URL);
await game.waitForTimeout(2500);
await game.evaluate(() => localStorage.clear());
await game.click('#t-new');
await game.waitForTimeout(3200);

const ORES = [10, 11, 12, 13, 14, 15, 16, 17, 9, 24, 21, 25, 23]; // roster order, T ids
const PALE = [12, 16, 21, 25, 24];      // silver diamond rime nacre frostbloom
const HOT = [10, 13, 17, 14];           // copper gold embershard ruby

const stage = async (row, ores, x0) => game.evaluate(([row, ores, x0]) => {
  const g = window.__game;
  g.threats.level = 'off';
  g.ctrl.drilling = null; g.ctrl.vx = 0; g.ctrl.vy = 0;
  for (let y = row - 2; y < row; y++) {
    for (let x = x0 - 2; x < x0 + ores.length * 2 + 2; x++) g.terrain.carve(x, y);
  }
  for (let i = 0; i < ores.length; i++) {
    const x = x0 + i * 2;
    g.terrain.data[g.terrain.idx(x, row)] = ores[i];
    g.terrain.dug.delete(g.terrain.idx(x, row));
    g.terrain.onChange(x, row);
    g.chunks.markDirty(x, row);
    // solid rock beside each, so every ore sits IN stone, not on a shelf edge
    const n = g.terrain.idx(x + 1, row);
    if (g.terrain.data[n] === 0) { g.terrain.data[n] = 4; g.terrain.onChange(x + 1, row); g.chunks.markDirty(x + 1, row); }
  }
  g.ctrl.px = x0 + ores.length - 1; g.ctrl.py = -(row - 1.6);
  g.state.fuel = g.state.maxFuel; g.state.hull = g.state.maxHull;
  g.cam.snap(g.ctrl.px, -(row - 1), 0);
}, [row, ores, x0]);

// deep gallery — the Void Veins, where an ore is its own light
await stage(210, ORES, 18);
await game.evaluate(() => { window.__game.cam.zoomBias = 7; });
await game.waitForTimeout(1600);
await game.screenshot({ path: `${OUT}/instone-dark.png` });

// the confusable families, side by side at gameplay zoom
await stage(210, PALE, 24);
await game.evaluate(() => { window.__game.cam.zoomBias = -4; });
await game.waitForTimeout(1600);
await game.screenshot({ path: `${OUT}/instone-pale-family.png` });

await stage(210, HOT, 24);
await game.waitForTimeout(1600);
await game.screenshot({ path: `${OUT}/instone-hot-family.png` });

// shallow gallery — amber regolith, headlamp range, the common case
await stage(40, ORES.slice(0, 8), 18);
await game.evaluate(() => { window.__game.cam.zoomBias = 0; });
await game.waitForTimeout(1600);
await game.screenshot({ path: `${OUT}/instone-shallow.png` });

console.log(errors.length ? errors.join('\n') : 'no page errors');
await browser.close();
