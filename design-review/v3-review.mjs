// V3 kit visual review — closeups of every new object, saved to design-review/
import { chromium } from 'playwright';

const OUT = 'design-review';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://localhost:4173');
await page.waitForTimeout(2500);
await page.evaluate(() => localStorage.clear());
await page.click('#t-new');
await page.waitForTimeout(3600);

const shot = async (name) => page.screenshot({ path: `${OUT}/${name}.png` });
const to = async (id) => {
  await page.evaluate(async (want) => {
    const g = window.__game;
    g.devVault(want);
    await new Promise(r => setTimeout(r, 400));
  }, id);
  await page.waitForTimeout(800);
};
// park the frame on a point — the review chase-cam
const snap = (x, y, z) => page.evaluate(([x, y, z]) => {
  const v = window.__game.vault;
  v.cam.snap(x, y, z);
  v.cam.followChamber = () => {};   // hold it there
}, [x, y, z]);

await to('proving');
await shot('v3-proving-wide');

// snuffer asleep on its rail
await snap(8.5, -19.5, 7);
await page.waitForTimeout(400);
await shot('v3-snuffer-asleep');
// wake it: walk the body near
await page.evaluate(() => {
  const v = window.__game.vault;
  v.invuln = 999;
  v.px = 6.5; v.py = -21.2; v.vx = 0; v.vy = 0;
});
await page.waitForTimeout(1600);
await snap(11, -19.8, 7);
await page.waitForTimeout(300);
await shot('v3-snuffer-awake');

// brazier + motes in the hall
await snap(13, -18.5, 9);
await page.waitForTimeout(400);
await shot('v3-brazier-motes');

// censer with the standable crown
await snap(34, -18, 7);
await page.waitForTimeout(400);
await shot('v3-censer-crown');

// one-way gate curtain
await snap(31, -9.5, 7);
await page.waitForTimeout(400);
await shot('v3-gate');

// current column
await snap(41, -13, 9);
await page.waitForTimeout(400);
await shot('v3-current');

// parked beam in the loft
await snap(36, -4.5, 8);
await page.waitForTimeout(400);
await shot('v3-beam-parked');

// deadlight sconce, lit, in the famine
await to('famine');
await page.evaluate(async () => {
  const v = window.__game.vault;
  const s = v.p.sconces[0];
  v.invuln = 999;
  v.px = s.x + 0.5; v.py = -(s.y + 0.5); v.vx = 0; v.vy = 0;
  await new Promise(r => setTimeout(r, 600));
  v.cam.snap(s.x + 0.5, -(s.y + 0.5), 6);
  v.cam.followChamber = () => {};
});
await page.waitForTimeout(600);
await shot('v3-deadlight');

await browser.close();
console.log('review shots written to ' + OUT);
