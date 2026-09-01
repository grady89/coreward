// Progression suite: wrecks + EVA salvage, the core walk ending, the Ember
// Forge, dash, and travel to a second world.
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

// 1) wrecks generated
const nWrecks = await page.evaluate(() => window.__game.terrain.wrecks.length);
console.log('wrecks generated:', nWrecks, nWrecks > 3 ? 'OK' : 'FAIL');

// 2) EVA salvage at the first wreck
await page.evaluate(() => {
  const g = window.__game;
  const w = g.terrain.wrecks[0];
  g.ctrl.px = w.x + 0.5;
  g.ctrl.py = -(w.y + 1) + 0.42;
  g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.cam.snap(g.ctrl.px, g.ctrl.py, 12.5);
});
await page.waitForTimeout(700);
const near = await page.evaluate(() => window.__game.ctrl.wreckNear);
console.log('wreck proximity:', near, near === 0 ? 'OK' : 'FAIL');
const before = await page.evaluate(() => ({ money: window.__game.state.money, logs: window.__game.state.foundLogs.size, cargo: window.__game.state.cargoCount }));
await page.keyboard.press('KeyE'); // enter EVA
await page.waitForTimeout(700);
const evaMode = await page.evaluate(() => window.__game.mode);
console.log('eva mode:', evaMode, evaMode === 'eva' ? 'OK' : 'FAIL');
await page.screenshot({ path: OUT + '/p-eva.png' });
await page.keyboard.press('KeyE'); // salvage
await page.waitForTimeout(4000);
const after = await page.evaluate(() => ({
  looted: window.__game.looted?.size ?? [...window.__game.ctrl.looted].length,
  money: window.__game.state.money, logs: window.__game.state.foundLogs.size, cargo: window.__game.state.cargoCount,
}));
const rewarded = after.money > before.money || after.logs > before.logs || after.cargo > before.cargo;
console.log('salvage:', JSON.stringify(after), rewarded ? 'OK' : 'FAIL');
await page.keyboard.press('KeyE'); // board pod (pilot still at pod position)
await page.waitForTimeout(500);
const backMode = await page.evaluate(() => window.__game.mode);
console.log('board pod:', backMode, backMode === 'play' ? 'OK' : 'FAIL');

// 3) core walk ending
await page.evaluate(() => {
  const g = window.__game;
  g.ctrl.px = 20.5;
  g.ctrl.py = -(509) + 0.42;
  g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.state.fuel = g.state.maxFuel;
  g.state.upgrades.radiator = 5;
  g.cam.snap(g.ctrl.px, g.ctrl.py, 12.5);
});
await page.waitForTimeout(1200);
const coreDiag = await page.evaluate(() => {
  const g = window.__game;
  return { coreNear: g.ctrl.coreNear, row: g.ctrl.row, grounded: g.ctrl.grounded, py: +g.ctrl.py.toFixed(2), mode: g.mode, panel: g.panels.current, hull: +g.state.hull.toFixed(1), fuel: +g.state.fuel.toFixed(1) };
});
console.log('core proximity:', JSON.stringify(coreDiag), coreDiag.coreNear ? 'OK' : 'FAIL');
await page.keyboard.press('KeyE'); // EVA
await page.waitForTimeout(500);
await page.screenshot({ path: OUT + '/p-corewalk.png' });
await page.keyboard.down('ArrowRight');
await page.waitForTimeout(7000);
await page.keyboard.up('ArrowRight');
await page.waitForTimeout(600);
const endState = await page.evaluate(() => ({ panel: window.__game.panels.current, ended: [...window.__game.state.endedWorlds] }));
console.log('ending:', JSON.stringify(endState), endState.panel === 'ending' && endState.ended.includes('veil3') ? 'OK' : 'FAIL');
await page.screenshot({ path: OUT + '/p-ending.png' });
await page.click('#keep');
await page.waitForTimeout(400);

// 4) ember forge: stock shards, open garage
await page.evaluate(() => {
  const g = window.__game;
  g.state.upgrades.cargo = 3;
  for (let i = 0; i < 12; i++) g.state.addCargo(17); // T.EMBERSHARD
  g.ctrl.px = 41.5; g.ctrl.py = 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.cam.snap(41.5, 2, 14);
});
await page.waitForTimeout(700);
await page.keyboard.press('KeyE');
await page.waitForTimeout(600);
await page.screenshot({ path: OUT + '/p-forge.png' });
await page.click('button[data-forge="dash"]');
await page.waitForTimeout(400);
const tech = await page.evaluate(() => window.__game.state.emberTech);
console.log('forge purchase:', JSON.stringify(tech), tech.dash ? 'OK' : 'FAIL');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// 5) dash
const vx0 = await page.evaluate(() => window.__game.ctrl.vx);
await page.keyboard.press('ShiftLeft');
await page.waitForTimeout(50);
const vx1 = await page.evaluate(() => Math.abs(window.__game.ctrl.vx));
console.log('dash:', vx0.toFixed(1), '->', vx1.toFixed(1), vx1 > 5 ? 'OK' : 'FAIL');
await page.waitForTimeout(800);

// 6) travel to CRYOS-2 via the assay starmap
await page.evaluate(() => {
  const g = window.__game;
  g.ctrl.px = 52; g.ctrl.py = 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.cam.snap(52, 2, 14);
});
await page.waitForTimeout(700);
await page.keyboard.press('KeyE');
await page.waitForTimeout(600);
await page.screenshot({ path: OUT + '/p-starmap.png' });
await page.click('button[data-travel="cryos2"]');
await page.waitForTimeout(2000); // in-place world swap, no reload
const world2 = await page.evaluate(() => ({ active: window.__game.state.activeWorld, mode: window.__game.mode }));
console.log('travel:', JSON.stringify(world2), world2.active === 'cryos2' && world2.mode === 'play' ? 'OK' : 'FAIL');
await page.screenshot({ path: OUT + '/p-cryos-surface.png' });

// 7) cryos palette check at depth
await page.evaluate(() => {
  const g = window.__game;
  for (let y = 98; y < 102; y++) for (let x = 30; x < 35; x++) g.terrain.carve(x, y);
  g.ctrl.px = 32.5; g.ctrl.py = -(101) + 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.state.fuel = g.state.maxFuel;
  g.cam.snap(g.ctrl.px, g.ctrl.py, 12.5);
});
await page.waitForTimeout(1200);
await page.screenshot({ path: OUT + '/p-cryos-deep.png' });
const label = await page.evaluate(() => document.querySelector('#hud-stratum')?.textContent);
console.log('cryos stratum label:', label, label === 'THE BLUE DEEP' ? 'OK' : 'FAIL');

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
