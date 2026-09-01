import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
await page.goto('http://localhost:4173');
await page.waitForTimeout(2500);
await page.evaluate(() => localStorage.clear());
await page.click('#t-new');
await page.waitForTimeout(3200);
await page.evaluate(() => {
  const g = window.__game;
  g.ctrl.px = 10.5; g.ctrl.py = 6.9; g.ctrl.vy = 0; g.ctrl.vx = 0;
  window.__trace = [];
  const t = setInterval(() => {
    window.__trace.push([+g.ctrl.py.toFixed(2), +g.ctrl.vy.toFixed(2), g.ctrl.grounded, +g.state.hull.toFixed(1)]);
    if (g.ctrl.grounded && window.__trace.length > 3) clearInterval(t);
  }, 60);
});
await page.waitForTimeout(2000);
console.log(JSON.stringify(await page.evaluate(() => window.__trace)));
await browser.close();
