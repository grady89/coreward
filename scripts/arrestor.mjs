// Arrestors: buy, deploy, catch a full-speed fall, retrieve, persist, map mark.
import { chromium } from 'playwright';

const OUT = process.argv[2] ?? '.';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

await page.goto('http://localhost:4173');
await page.waitForTimeout(2500);
await page.screenshot({ path: OUT + '/a-title.png' });
await page.evaluate(() => localStorage.clear());
await page.click('#t-new');
await page.waitForTimeout(3600);
await page.evaluate(() => window.__game.comms.clear());
await page.screenshot({ path: OUT + '/a-surface.png' });

// --- buy at the garage ---
await page.evaluate(() => {
  const g = window.__game;
  g.state.money = 9000;
  g.ctrl.px = 41.5; g.ctrl.py = 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.cam.snap(41.5, 2, 14);
});
await page.waitForTimeout(900);
await page.keyboard.press('KeyE');
await page.waitForTimeout(700);
await page.screenshot({ path: OUT + '/a-garage.png' });
await page.click('#buy-arrestor');
await page.waitForTimeout(400);
const bought = await page.evaluate(() => window.__game.state.arrestors);
console.log('purchased:', bought, bought === 1 ? 'OK' : 'FAIL');
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

// --- dig a deep shaft, deploy at the bottom, then drop into it ---
const drop = await page.evaluate(async () => {
  const g = window.__game;
  const X = 26;
  // a clean 2-wide shaft from row 4 down to row 150
  for (let y = 4; y < 152; y++) { g.terrain.carve(X, y); g.terrain.carve(X + 1, y); }
  // stand on the shaft floor and deploy
  g.ctrl.drilling = null;
  g.ctrl.px = X + 0.5; g.ctrl.py = -151 + 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.state.hull = g.state.maxHull;
  await new Promise(r => setTimeout(r, 900));
  const grounded = g.ctrl.grounded;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyB' }));
  await new Promise(r => setTimeout(r, 400));
  const deployed = g.arrestors.list.length;
  const held = g.state.arrestors;

  // now drop the whole shaft at full speed
  g.ctrl.px = X + 0.5; g.ctrl.py = -6; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.state.hull = g.state.maxHull;
  const hullBefore = g.state.hull;
  let maxSpeed = 0;
  let landed = false;
  // a 145-tile fall takes ~6s of sim time, and headless sim runs ~40% speed
  for (let i = 0; i < 260; i++) {
    await new Promise(r => setTimeout(r, 100));
    maxSpeed = Math.max(maxSpeed, -g.ctrl.vy);
    if (g.ctrl.grounded && g.ctrl.py < -140) { landed = true; break; }
  }
  return {
    grounded, deployed, held, landed,
    hullBefore, hullAfter: +g.state.hull.toFixed(1),
    maxSpeed: +maxSpeed.toFixed(1),
    landedAt: +g.ctrl.py.toFixed(1),
  };
});
console.log('caught a full-speed drop:', JSON.stringify(drop),
  drop.landed && drop.deployed === 1 && drop.held === 0 && drop.maxSpeed > 20 &&
  drop.hullAfter === drop.hullBefore ? 'OK' : 'FAIL');
await page.screenshot({ path: OUT + '/a-caught.png' });

// --- control: the same drop without a pad must hurt ---
const noPad = await page.evaluate(async () => {
  const g = window.__game;
  g.arrestors.clear();
  g.ctrl.px = 26.5; g.ctrl.py = -6; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.state.hull = g.state.maxHull;
  const before = g.state.hull;
  let landed = false;
  for (let i = 0; i < 260; i++) {
    await new Promise(r => setTimeout(r, 100));
    if (g.ctrl.grounded && g.ctrl.py < -140) { landed = true; break; }
  }
  return { before, landed, after: +g.state.hull.toFixed(1) };
});
console.log('control drop (no pad):', JSON.stringify(noPad),
  noPad.landed && noPad.after < noPad.before ? 'OK — unprotected falls still hurt' : 'FAIL');

// --- retrieve, and persistence across a reload ---
const cycle = await page.evaluate(async () => {
  const g = window.__game;
  g.state.arrestors = 1;
  g.ctrl.px = 26.5; g.ctrl.py = -151 + 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  await new Promise(r => setTimeout(r, 700));
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyB' })); // deploy
  await new Promise(r => setTimeout(r, 400));
  const afterDeploy = { placed: g.arrestors.list.length, held: g.state.arrestors };
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyB' })); // pick back up
  await new Promise(r => setTimeout(r, 400));
  const afterPickup = { placed: g.arrestors.list.length, held: g.state.arrestors };
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyB' })); // deploy again
  await new Promise(r => setTimeout(r, 400));
  g.saveNow();
  return { afterDeploy, afterPickup, placed: g.arrestors.list.length };
});
console.log('deploy/retrieve:', JSON.stringify(cycle),
  cycle.afterDeploy.placed === 1 && cycle.afterPickup.placed === 0 &&
  cycle.afterPickup.held === 1 && cycle.placed === 1 ? 'OK' : 'FAIL');

await page.reload();
await page.waitForTimeout(2700);
await page.click('#t-continue');
await page.waitForTimeout(1600);
const persisted = await page.evaluate(() => ({
  placed: window.__game.arrestors.list.length,
  held: window.__game.state.arrestors,
}));
console.log('persisted across reload:', JSON.stringify(persisted), persisted.placed === 1 ? 'OK' : 'FAIL');

// --- shows on the survey map ---
await page.evaluate(() => {
  const g = window.__game;
  g.state.hasScanner = true;
  g.state.worldBestRow = 200;
  g.comms.clear();
});
await page.keyboard.press('Tab');
await page.waitForTimeout(900);
await page.screenshot({ path: OUT + '/a-map.png' });
const mapOpen = await page.evaluate(() => window.__game.map.visible);
console.log('map marker rendered:', mapOpen ? 'OK' : 'FAIL');

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
