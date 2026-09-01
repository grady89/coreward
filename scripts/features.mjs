// Feature test: per-stack selling, survey scanner + map, wreck settling, EVA recall.
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
await page.waitForTimeout(3400);

// 1) sell a single stack
await page.evaluate(() => {
  const g = window.__game;
  g.state.addCargo(10); g.state.addCargo(10); g.state.addCargo(17); // copper ×2, embershard
  g.ctrl.px = 30.5; g.ctrl.py = 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.cam.snap(30.5, 2, 14);
});
await page.waitForTimeout(700);
await page.keyboard.press('KeyE');
await page.waitForTimeout(600);
await page.screenshot({ path: OUT + '/f-trade.png' });
await page.click('button[data-sell="10"]');
await page.waitForTimeout(500);
const s1 = await page.evaluate(() => ({ money: window.__game.state.money, cargo: window.__game.state.cargoCount }));
console.log('sell stack:', JSON.stringify(s1), s1.money === 100 && s1.cargo === 1 ? 'OK' : 'FAIL'); // 40 + 2×30, shard kept
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// 2) scanner gate + purchase + map
await page.keyboard.press('Tab');
await page.waitForTimeout(300);
const gated = await page.evaluate(() => window.__game.map.visible);
console.log('map gated:', !gated ? 'OK' : 'FAIL');
await page.evaluate(() => {
  const g = window.__game;
  g.state.money = 5000;
  g.ctrl.px = 52; g.ctrl.py = 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.cam.snap(52, 2, 14);
});
await page.waitForTimeout(600);
await page.keyboard.press('KeyE');
await page.waitForTimeout(500);
await page.click('#buy-scanner');
await page.waitForTimeout(400);
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await page.keyboard.press('Tab');
await page.waitForTimeout(800);
const mapOpen = await page.evaluate(() => window.__game.map.visible);
console.log('map open:', mapOpen ? 'OK' : 'FAIL');
await page.screenshot({ path: OUT + '/f-map.png' });
await page.keyboard.press('Tab');

// 3) wreck settles when undermined
const settled = await page.evaluate(async () => {
  const g = window.__game;
  const w = g.terrain.wrecks[0];
  const y0 = w.y;
  for (let d = 1; d <= 3; d++) g.terrain.carve(w.x, y0 + d);
  await new Promise(r => setTimeout(r, 600));
  return { y0, y1: g.terrain.wrecks[0].y };
});
console.log('wreck settle:', JSON.stringify(settled), settled.y1 > settled.y0 ? 'OK' : 'FAIL');

// 4) EVA recall with R
await page.evaluate(() => {
  const g = window.__game;
  const w = g.terrain.wrecks[1];
  g.ctrl.px = w.x + 0.5; g.ctrl.py = -(w.y + 1) + 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.cam.snap(g.ctrl.px, g.ctrl.py, 12.5);
});
await page.waitForTimeout(700);
await page.keyboard.press('KeyE');
await page.waitForTimeout(500);
const inEva = await page.evaluate(() => window.__game.mode);
await page.keyboard.press('KeyR');
await page.waitForTimeout(400);
const recalled = await page.evaluate(() => window.__game.mode);
console.log('eva recall:', inEva, '->', recalled, inEva === 'eva' && recalled === 'play' ? 'OK' : 'FAIL');

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
