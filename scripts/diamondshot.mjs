// wear the Diamondplate on rig and suit, and photograph the crime, close
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
await page.goto('http://localhost:4173');
await page.waitForTimeout(2500);
await page.evaluate(() => localStorage.clear());
await page.click('#t-new');
await page.waitForTimeout(5200);
await page.evaluate(() => {
  const g = window.__game;
  g.meta.finishRig = 'diamond';
  g.meta.finishSuit = 'diamond';
  g.applyKeeping();
  g.ctrl.px = 25; g.ctrl.py = 1;
  g.cam.zoomBias = -9;
});
await page.waitForTimeout(900);
await page.screenshot({ path: 'design-review/diamond-rig.png' });
await page.waitForTimeout(500);
await page.screenshot({ path: 'design-review/diamond-rig-b.png' });
// the suit, worn in a vault where the body is the light
await page.evaluate(async () => { window.__game.devVault('wick'); await new Promise(r => setTimeout(r, 600)); });
await page.waitForTimeout(3200);
await page.evaluate(() => { const v = window.__game.vault; v.cam.snap(v.px, v.py + 0.4, 4.5); v.cam.followChamber = () => {}; });
await page.waitForTimeout(300);
await page.screenshot({ path: 'design-review/diamond-suit.png' });
console.log('diamond shots');
await browser.close();
