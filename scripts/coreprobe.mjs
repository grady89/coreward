import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto('http://localhost:4173');
await page.waitForTimeout(2500);
await page.evaluate(() => localStorage.clear());
await page.click('#t-new');
await page.waitForTimeout(3200);
await page.evaluate(() => {
  const g = window.__game;
  g.ctrl.px = 20.5; g.ctrl.py = -509 + 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.state.fuel = g.state.maxFuel;
  g.state.upgrades.radiator = 5;
  g.cam.snap(g.ctrl.px, g.ctrl.py, 12.5);
});
await page.waitForTimeout(900);
console.log(await page.evaluate(() => {
  const g = window.__game;
  return JSON.stringify({
    py: +g.ctrl.py.toFixed(2), row: g.ctrl.row, grounded: g.ctrl.grounded,
    coreNear: g.ctrl.coreNear, wreckNear: g.ctrl.wreckNear,
    hull: +g.state.hull.toFixed(1), panel: g.panels.current, mode: g.mode,
    tileBelow: g.terrain.get(20, 510), tileAt: g.terrain.get(20, 509),
    endedSize: g.state.endedWorlds.size,
  });
}));
await browser.close();
