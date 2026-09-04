// Frame a room and shoot it. The authoring loop for V4: the lints prove a
// map is legal and the reach model proves it is finishable, but neither can
// tell you whether a shaft reads as a shaft.
//
//   node scripts/roomshot.mjs ember '[[21,-30,26,"v4-ember-mid"]]'
//
// Each shot is [x, y, z, name] — the camera is snapped there and held, so
// the frame is the author's, not the follow-cam's.
import { chromium } from 'playwright';
const glyph = process.argv[2] ?? 'ember';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
await page.goto('http://localhost:4173');
await page.waitForTimeout(2500);
await page.evaluate(() => localStorage.clear());
await page.click('#t-new');
await page.waitForTimeout(3600);
const shots = JSON.parse(process.argv[3] ?? '[]');
await page.evaluate(async (g) => { window.__game.devVault(g); await new Promise(r => setTimeout(r, 900)); }, glyph);
for (const [x, y, z, name] of shots) {
  await page.evaluate(([x, y, z]) => {
    const v = window.__game.vault;
    v.invuln = 999;
    v.cam.snap(x, y, z); v.cam.followChamber = () => {};
  }, [x, y, z]);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `design-review/${name}.png` });
}
await browser.close();
console.log('shot');
