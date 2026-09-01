// Hazard & failure-path test: side drill, fall damage, gas, death, rescue.
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

// 1) drill down twice, then sideways (off the protected landing pad)
await page.evaluate(() => {
  const g = window.__game;
  g.ctrl.px = 10.5; g.ctrl.py = 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.cam.snap(10.5, 2, 14);
});
await page.waitForTimeout(500);
await page.keyboard.down('ArrowDown');
await page.waitForTimeout(1600);
await page.keyboard.up('ArrowDown');
await page.waitForTimeout(400);
const px0 = await page.evaluate(() => window.__game.ctrl.px);
await page.keyboard.down('ArrowRight');
await page.waitForTimeout(2600);
await page.keyboard.up('ArrowRight');
const s1 = await page.evaluate(() => ({ px: window.__game.ctrl.px, dug: window.__game.state.blocksDug }));
console.log('side drill: px', px0.toFixed(2), '->', s1.px.toFixed(2), 'dug', s1.dug, s1.px - px0 > 0.8 && s1.dug >= 3 ? 'OK' : 'FAIL');

// 2) fall damage: hoist and drop
await page.waitForTimeout(700); // let any in-flight drill finish first
await page.evaluate(() => {
  const g = window.__game;
  g.ctrl.drilling = null;
  g.ctrl.px = 10.5; g.ctrl.py = 6.9; g.ctrl.vy = 0; g.ctrl.vx = 0;
});
await page.waitForTimeout(1800);
const hull1 = await page.evaluate(() => window.__game.state.hull);
console.log('fall damage: hull', hull1.toFixed(1), hull1 < 100 ? 'OK' : 'FAIL');

// 3) gas pocket: plant one under the pod and drill it
await page.evaluate(() => {
  const g = window.__game;
  g.state.hull = 100;
  const x = Math.floor(g.ctrl.px), y = Math.floor(-(g.ctrl.py - 0.41) + 0.1);
  g.terrain.data[g.terrain.idx(x, y)] = 8; // T.GAS
  g.chunks.markDirty(x, y);
});
await page.keyboard.down('ArrowDown');
await page.waitForTimeout(1500);
await page.keyboard.up('ArrowDown');
const hull2 = await page.evaluate(() => window.__game.state.hull);
console.log('gas burst: hull', hull2.toFixed(1), hull2 < 100 ? 'OK' : 'FAIL');

// 4) death: nearly dead + big fall
await page.evaluate(() => {
  const g = window.__game;
  g.state.hull = 3;
  g.ctrl.px = 10.5; g.ctrl.py = 6.9; g.ctrl.vy = 0;
});
await page.waitForTimeout(2000);
await page.screenshot({ path: OUT + '/h-death.png' });
const deathOpen = await page.evaluate(() => window.__game.panels.current);
console.log('death panel:', deathOpen, deathOpen === 'death' ? 'OK' : 'FAIL');
await page.click('#respawn');
await page.waitForTimeout(800);
const afterRespawn = await page.evaluate(() => ({ py: +window.__game.ctrl.py.toFixed(2), hull: window.__game.state.hull, fuel: +window.__game.state.fuel.toFixed(0) }));
console.log('after respawn:', JSON.stringify(afterRespawn));

// 5) rescue: strand underground with no fuel
await page.evaluate(() => {
  const g = window.__game;
  for (let y = 20; y < 23; y++) for (let x = 30; x < 33; x++) g.terrain.carve(x, y);
  g.ctrl.px = 31.5; g.ctrl.py = -(22) - 0.0 + 0.42; g.ctrl.vy = 0;
  g.cam.snap(g.ctrl.px, g.ctrl.py, 12.5);
  g.state.fuel = 0.4;
});
await page.waitForTimeout(2500);
await page.screenshot({ path: OUT + '/h-rescue.png' });
const rescueOpen = await page.evaluate(() => window.__game.panels.current);
console.log('rescue panel:', rescueOpen, rescueOpen === 'rescue' ? 'OK' : 'FAIL');

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
