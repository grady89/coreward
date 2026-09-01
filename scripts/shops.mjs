// Economy loop test: cargo -> trade -> sell -> garage -> save -> continue.
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

// stock some cargo, park at the trade post
await page.evaluate(() => {
  const g = window.__game;
  g.state.addCargo(10); g.state.addCargo(10); g.state.addCargo(11); // copper ×2, iron
  g.ctrl.px = 30.5; g.ctrl.py = 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.cam.snap(30.5, 2, 14);
});
await page.waitForTimeout(800);
await page.keyboard.press('KeyE');
await page.waitForTimeout(600);
await page.screenshot({ path: OUT + '/s-trade.png' });
await page.click('#sell');
await page.waitForTimeout(800);
const afterSell = await page.evaluate(() => ({ money: window.__game.state.money, cargo: window.__game.state.cargoCount }));
console.log('after sell:', JSON.stringify(afterSell)); // expect 40 + 30+30+70 = 170
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

// garage
await page.evaluate(() => {
  const g = window.__game;
  g.ctrl.px = 41.5; g.ctrl.py = 0.42;
  g.cam.snap(41.5, 2, 14);
});
await page.waitForTimeout(600);
await page.keyboard.press('KeyE');
await page.waitForTimeout(600);
await page.screenshot({ path: OUT + '/s-garage.png' });
// buy the first affordable upgrade? none at $170 — just close
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// pause panel
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
await page.screenshot({ path: OUT + '/s-pause.png' });
await page.keyboard.press('Escape');

// force a save then reload -> continue
await page.evaluate(() => window.__game.saveNow());
await page.reload();
await page.waitForTimeout(2500);
const hasContinue = await page.$('#t-continue') !== null;
console.log('continue offered:', hasContinue);
if (hasContinue) {
  await page.click('#t-continue');
  await page.waitForTimeout(1200);
  const s = await page.evaluate(() => ({ money: window.__game.state.money, px: +window.__game.ctrl.px.toFixed(1) }));
  console.log('after continue:', JSON.stringify(s));
}

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
