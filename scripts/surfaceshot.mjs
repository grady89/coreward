// park the pod at the surface pads and prove nothing clips it
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
await page.goto('http://localhost:4173');
await page.waitForTimeout(2500);
await page.evaluate(() => localStorage.clear());
await page.click('#t-new');
await page.waitForTimeout(5200);
const shots = JSON.parse(process.argv[2] ?? '[[8,"pads-a"],[16,"pads-b"],[24,"pads-c"]]');
for (const [x, name] of shots) {
  await page.evaluate((px) => {
    const g = window.__game;
    g.ctrl.px = px; g.ctrl.py = 1; g.ctrl.vx = 0; g.ctrl.vy = 0;
    g.cam.snap(px, 1.6, 9);
  }, x);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `design-review/${name}.png` });
}
console.log('surface shots');
await browser.close();
