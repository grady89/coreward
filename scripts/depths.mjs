// Visual tour: teleport the pod through every stratum and screenshot each.
import { chromium } from 'playwright';

const OUT = process.argv[2] ?? '.';
const URL = 'http://localhost:4173';

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

await page.goto(URL);
await page.waitForTimeout(2500);
await page.evaluate(() => localStorage.clear());
await page.click('#t-new');
await page.waitForTimeout(3200);

const stops = [
  ['slatebed', 100],
  ['voidveins', 230],
  ['emberreach', 380],
  ['core', 503],
];

for (const [name, row] of stops) {
  await page.evaluate(r => {
    const g = window.__game;
    // carve a pocket and place the pod inside it
    for (let y = r - 2; y < r + 2; y++)
      for (let x = 30; x < 35; x++) g.terrain.carve(x, y);
    g.ctrl.px = 32.5;
    g.ctrl.py = -(r + 1) + 0.42;
    g.ctrl.vx = 0; g.ctrl.vy = 0;
    g.state.fuel = g.state.maxFuel;
    g.state.hull = g.state.maxHull;
    g.state.upgrades.radiator = 5;
    g.cam.snap(g.ctrl.px, g.ctrl.py, 12.5);
  }, row);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/d-${name}.png` });
}

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
