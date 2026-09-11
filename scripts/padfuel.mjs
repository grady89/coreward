// Parked on a pad, the idle burn stops. In the field it does not, and thrust
// and the drill still bill you wherever you are.
import { chromium } from 'playwright';

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

await page.goto('http://localhost:4173');
await page.waitForTimeout(2500);
await page.evaluate(() => localStorage.clear());
await page.click('#t-new');
await page.waitForFunction(() => window.__game?.mode === 'play', { timeout: 30000 });

// hand-step the controller with the sim paused, so the measurement is exact
const burn = (px, py, input, secs) => page.evaluate(([px, py, input, secs]) => {
  const g = window.__game, ctrl = g.ctrl, st = g.state;
  g.panels.open('fuel');              // pauses the main loop
  ctrl.px = px; ctrl.py = py; ctrl.vx = 0; ctrl.vy = 0;
  st.fuel = 80;
  let t = g.time;
  const n = Math.round(secs * 60);
  for (let i = 0; i < n; i++) { t += 1 / 60; ctrl.update(1 / 60, input, t); }
  const out = { spent: +(80 - st.fuel).toFixed(3), pad: ctrl.onSurfacePad, grounded: ctrl.grounded };
  g.panels.close();
  return out;
}, [px, py, input, secs]);

const NONE = { left: false, right: false, up: false, down: false };
const UP = { left: false, right: false, up: true, down: false };
const surfaceY = await page.evaluate(() => window.__game.ctrl.py);

const parked = await burn(14, surfaceY, NONE, 4);
console.log('parked on landing pad, 4s:', JSON.stringify(parked),
  parked.pad && parked.spent === 0 ? 'OK' : 'FAIL');

const depot = await burn(19.5, surfaceY, NONE, 4);
console.log('parked at fuel depot, 4s:', JSON.stringify(depot),
  depot.pad && depot.spent === 0 ? 'OK' : 'FAIL');

const field = await burn(70, surfaceY, NONE, 4);
console.log('parked off-pad,       4s:', JSON.stringify(field),
  !field.pad && Math.abs(field.spent - 1.12) < 0.05 ? 'OK' : 'FAIL');

const thrusting = await burn(14, surfaceY, UP, 1);
console.log('thrusting on pad,     1s:', JSON.stringify(thrusting),
  thrusting.spent > 3 ? 'OK' : 'FAIL');

// and the pad stops billing only while settled: airborne over it still burns
const hover = await page.evaluate(() => {
  const g = window.__game, ctrl = g.ctrl, st = g.state;
  g.panels.open('fuel');
  ctrl.px = 14; ctrl.py = 6; ctrl.vx = 0; ctrl.vy = 0; ctrl.grounded = false;
  st.fuel = 80;
  let t = g.time;
  for (let i = 0; i < 30; i++) { t += 1 / 60; ctrl.update(1 / 60, { left: false, right: false, up: false, down: false }, t); }
  const out = { spent: +(80 - st.fuel).toFixed(3), pad: ctrl.onSurfacePad };
  g.panels.close();
  return out;
});
console.log('airborne over pad, .5s:', JSON.stringify(hover), hover.spent > 0 ? 'OK' : 'FAIL');

console.log(errors.length ? errors.join('\n') : 'no page errors');
await browser.close();
