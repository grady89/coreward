// Visual check: one of each resource in daylight + the animated trade icons.
import { chromium } from 'playwright';

const OUT = process.argv[2] ?? '.';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

await page.goto('http://localhost:4173');
await page.waitForTimeout(2500);
await page.evaluate(() => localStorage.clear());
await page.click('#t-new');
await page.waitForTimeout(3200);

// line up every ore type in an exposed trench
await page.evaluate(() => {
  const g = window.__game;
  const ores = [9, 10, 11, 12, 13, 14, 15, 16, 17]; // fungus..embershard
  ores.forEach((t, i) => {
    const x = 18 + i * 2;
    g.terrain.data[g.terrain.idx(x, 2)] = t;
    g.terrain.carve(x, 1); // expose from above
    g.chunks.markDirty(x, 2);
  });
  g.ctrl.px = 34; g.ctrl.py = 4.5; g.ctrl.vy = 0;
  g.cam.snap(26, 1.5, 13);
});
await page.waitForTimeout(1500);
await page.screenshot({ path: OUT + '/g-ores.png' });

// trade panel with one of each
await page.evaluate(() => {
  const g = window.__game;
  g.state.upgrades.cargo = 2;
  for (const t of [10, 11, 12, 13, 14, 15, 16, 17]) g.state.addCargo(t);
  g.ctrl.px = 30.5; g.ctrl.py = 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.cam.snap(30.5, 2, 14);
});
await page.waitForTimeout(700);
await page.keyboard.press('KeyE');
await page.waitForTimeout(900);
await page.screenshot({ path: OUT + '/g-trade.png' });

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
