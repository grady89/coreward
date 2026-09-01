// Veinlight harvests into fuel, never into cargo.
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

// veinlight generates in the deep bands
const spawn = await page.evaluate(() => {
  const g = window.__game;
  let n = 0, minY = 1e9, maxY = -1;
  for (let y = 0; y < 512; y++) for (let x = 0; x < 64; x++) {
    if (g.terrain.get(x, y) === 9) { n++; minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  }
  return { n, minY, maxY };
});
console.log('veinlight tiles:', JSON.stringify(spawn), spawn.n > 100 && spawn.minY >= 150 ? 'OK' : 'FAIL');

// harvest one: fuel up, cargo unchanged
const res = await page.evaluate(async () => {
  const g = window.__game;
  const y = 200, x = 26;
  // carve a pocket, plant veinlight directly beneath the pod
  for (let yy = y - 2; yy < y; yy++) for (let xx = x - 1; xx <= x + 1; xx++) g.terrain.carve(xx, yy);
  g.terrain.data[g.terrain.idx(x, y)] = 9;
  g.chunks.markDirty(x, y);
  g.ctrl.px = x + 0.5; g.ctrl.py = -y + 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.state.fuel = 50;
  g.state.upgrades.tank = 2;   // headroom so the cap does not mask the gain
  g.cam.snap(g.ctrl.px, g.ctrl.py, 12.5);
  await new Promise(r => setTimeout(r, 400));
  const before = { fuel: g.state.fuel, cargo: g.state.cargoCount, money: g.state.money };
  // drill straight down into it
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown' }));
  await new Promise(r => setTimeout(r, 2500));
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowDown' }));
  await new Promise(r => setTimeout(r, 300));
  return { before, after: { fuel: g.state.fuel, cargo: g.state.cargoCount, money: g.state.money }, tile: g.terrain.get(x, y) };
});
const gained = res.after.fuel - res.before.fuel;
console.log('harvest:', JSON.stringify(res),
  res.tile === 0 && gained > 5 && res.after.cargo === res.before.cargo ? 'OK' : 'FAIL');
await page.screenshot({ path: OUT + '/vl-harvest.png' });

// no veinlight row can appear in the trade post
const inTrade = await page.evaluate(() => {
  const g = window.__game;
  g.state.cargo.set(9, 3);   // simulate a legacy save
  return [...g.state.cargo.keys()].includes(9);
});
console.log('legacy cargo simulated:', inTrade);
await page.evaluate(() => { const g = window.__game; g.saveNow(); });
await page.reload();
await page.waitForTimeout(2800);
await page.click('#t-continue');
await page.waitForTimeout(1200);
const afterLoad = await page.evaluate(() => [...window.__game.state.cargo.keys()]);
console.log('legacy veinlight purged on load:', JSON.stringify(afterLoad), !afterLoad.includes(9) ? 'OK' : 'FAIL');

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
