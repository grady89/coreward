// Screenshot pass for the surface redesign + trade icons + pad respawn check.
import { chromium } from 'playwright';

const OUT = process.argv[2] ?? '.';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

await page.goto('http://localhost:4173');
await page.waitForTimeout(2800);
await page.screenshot({ path: OUT + '/v-title.png' });
await page.evaluate(() => localStorage.clear());
await page.click('#t-new');
await page.waitForTimeout(3400);
await page.screenshot({ path: OUT + '/v-surface.png' });

// pad drill-deny + toast
await page.keyboard.down('ArrowDown');
await page.waitForTimeout(900);
await page.keyboard.up('ArrowDown');
const denied = await page.evaluate(() => window.__game.state.blocksDug);
console.log('pad protected:', denied === 0 ? 'OK' : 'FAIL (dug ' + denied + ')');
await page.screenshot({ path: OUT + '/v-pad-deny.png' });

// look at the other buildings
await page.evaluate(() => { const g = window.__game; g.ctrl.px = 41.5; g.ctrl.py = 0.42; g.cam.snap(41.5, 2, 14); });
await page.waitForTimeout(900);
await page.screenshot({ path: OUT + '/v-garage.png' });
await page.evaluate(() => { const g = window.__game; g.ctrl.px = 52; g.ctrl.py = 0.42; g.cam.snap(52, 2, 14); });
await page.waitForTimeout(900);
await page.screenshot({ path: OUT + '/v-assay.png' });

// trade panel with 3D ore icons
await page.evaluate(() => {
  const g = window.__game;
  g.state.addCargo(10); g.state.addCargo(11); g.state.addCargo(13); g.state.addCargo(14); g.state.addCargo(16);
  g.ctrl.px = 30.5; g.ctrl.py = 0.42; g.cam.snap(30.5, 2, 14);
});
await page.waitForTimeout(700);
await page.keyboard.press('KeyE');
await page.waitForTimeout(800);
await page.screenshot({ path: OUT + '/v-trade-icons.png' });
await page.keyboard.press('Escape');

// tow lands ON the pad, no plummet: strand, rescue, then confirm resting state
await page.evaluate(() => {
  const g = window.__game;
  for (let y = 20; y < 23; y++) for (let x = 8; x < 11; x++) g.terrain.carve(x, y);
  g.ctrl.px = 9.5; g.ctrl.py = -22 + 0.42; g.ctrl.vy = 0;
  g.cam.snap(9.5, -21, 12.5);
  g.state.fuel = 0.3;
});
await page.waitForTimeout(4500);
const rescueOpen = await page.evaluate(() => window.__game.panels.current);
console.log('rescue panel:', rescueOpen === 'rescue' ? 'OK' : 'FAIL');
await page.click('#rescue');
await page.waitForTimeout(1500);
const after = await page.evaluate(() => ({ px: window.__game.ctrl.px, py: +window.__game.ctrl.py.toFixed(2), grounded: window.__game.ctrl.grounded }));
console.log('towed to pad:', JSON.stringify(after), after.px === 14 && after.py > 0 && after.grounded ? 'OK' : 'FAIL');
await page.screenshot({ path: OUT + '/v-towed.png' });

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
