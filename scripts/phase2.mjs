// Phase 2: flares, Long Ones (corridor-width rule), seismic charges, drill-as-weapon.
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
await page.waitForTimeout(3600);
await page.evaluate(() => window.__game.comms.clear());

// --- buy kit at the fuel depot ---
await page.evaluate(() => {
  const g = window.__game;
  g.state.money = 5000;
  g.ctrl.px = 19.5; g.ctrl.py = 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.cam.snap(19.5, 2, 14);
});
await page.waitForTimeout(800);
await page.keyboard.press('KeyE');
await page.waitForTimeout(700);
await page.screenshot({ path: OUT + '/p2-depot.png' });
await page.click('#buy-flare');
await page.click('#buy-flare');
await page.click('#buy-charge');
await page.waitForTimeout(400);
const kit = await page.evaluate(() => ({ f: window.__game.state.flares, c: window.__game.state.charges }));
console.log('kit purchase:', JSON.stringify(kit), kit.f === 2 && kit.c === 1 ? 'OK' : 'FAIL');
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

// --- flare throws and lights ---
const flare = await page.evaluate(async () => {
  const g = window.__game;
  for (let y = 100; y < 108; y++) for (let x = 20; x < 40; x++) g.terrain.carve(x, y);
  g.ctrl.px = 26; g.ctrl.py = -106 + 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.cam.snap(26, -106, 12.5);
  await new Promise(r => setTimeout(r, 500));
  const before = g.state.flares;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ' }));
  await new Promise(r => setTimeout(r, 900));
  const lit = g.threats.flareLights.filter(l => l.visible).length;
  return { before, after: g.state.flares, lit, meshCount: g.threats.flareMesh.count };
});
console.log('flare thrown:', JSON.stringify(flare),
  flare.after === flare.before - 1 && flare.lit === 1 ? 'OK' : 'FAIL');
await page.screenshot({ path: OUT + '/p2-flare.png' });

// --- corridor width rule: worms cannot enter a 1-wide shaft ---
const widthRule = await page.evaluate(() => {
  const g = window.__game;
  const t = g.terrain;
  // build a 1-wide vertical shaft and a 3-wide chamber side by side
  for (let y = 320; y < 340; y++) t.carve(10, y);            // 1-wide
  for (let y = 320; y < 340; y++) for (let x = 30; x < 34; x++) t.carve(x, y); // wide
  return {
    narrow: g.threats.wide(10, 330),
    wide: g.threats.wide(31, 330),
    edgeOfWide: g.threats.wide(30, 330),
  };
});
console.log('corridor rule:', JSON.stringify(widthRule),
  widthRule.narrow === false && widthRule.wide === true ? 'OK' : 'FAIL');

// --- worm spawns in band and hunts ---
const worm = await page.evaluate(async () => {
  const g = window.__game;
  g.ctrl.px = 31.5; g.ctrl.py = -330 + 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.state.fuel = g.state.maxFuel; g.state.hull = g.state.maxHull;
  g.state.upgrades.radiator = 5;
  g.cam.snap(31.5, -330, 12.5);
  await new Promise(r => setTimeout(r, 400));
  let spawned = false;
  for (let i = 0; i < 40; i++) {
    g.threats.wormTimer = 0;
    await new Promise(r => setTimeout(r, 70));
    if (g.threats.wormAlive) { spawned = true; break; }
  }
  const w = g.threats.worm;
  await new Promise(r => setTimeout(r, 300)); // let it draw a frame
  return { spawned, segs: g.threats.wormMesh.count, x: +w.x.toFixed(1), y: +w.y.toFixed(1) };
});
console.log('long one:', JSON.stringify(worm), worm.spawned && worm.segs === 11 ? 'OK' : 'FAIL');
await page.screenshot({ path: OUT + '/p2-worm.png' });

// --- charge seals a tunnel with rubble and kills the worm ---
const charge = await page.evaluate(async () => {
  const g = window.__game;
  // a clean, generous chamber so the falling pod stays inside it
  for (let y = 322; y < 340; y++) for (let x = 24; x < 40; x++) g.terrain.carve(x, y);
  g.ctrl.px = 31.5; g.ctrl.py = -338 + 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.state.charges = 2;
  g.state.hull = 100000; // outlive the fuse
  await new Promise(r => setTimeout(r, 400));
  const wormBefore = g.threats.wormAlive;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyG' }));
  await new Promise(r => setTimeout(r, 60));
  const c = g.charges[0];
  if (!c) return { err: 'charge not placed' };
  const px = Math.floor(c.x), py = Math.floor(-c.y);
  const airBefore = g.terrain.get(px, py);
  // park the worm inside the blast radius
  if (g.threats.wormAlive) { g.threats.worm.x = c.x + 1.5; g.threats.worm.y = c.y; }
  // headless runs sim-time at ~40% with this much on screen (dt is clamped)
  await new Promise(r => setTimeout(r, 11000));
  return {
    wormBefore, wormAfter: g.threats.wormAlive,
    airBefore, tileAfter: g.terrain.get(px, py),
    charges: g.state.charges, remaining: g.charges.length,
    fuse: g.charges[0] ? +g.charges[0].fuse.toFixed(2) : 'gone',
    mode: g.mode, panel: g.panels.current, hull: Math.round(g.state.hull),
    fuel: Math.round(g.state.fuel),
  };
});
console.log('seismic charge:', JSON.stringify(charge),
  charge.tileAfter === 18 && charge.charges === 1 && charge.remaining === 0 ? 'OK' : 'FAIL');
console.log('charge killed the worm:', charge.wormBefore && !charge.wormAfter ? 'OK' : 'FAIL');
await page.screenshot({ path: OUT + '/p2-charge.png' });

// --- rubble is fast to redig ---
const rubbleHardness = await page.evaluate(() => window.__TILE_DEFS[18].hardness);
console.log('rubble hardness:', rubbleHardness, rubbleHardness < 0.3 ? 'OK' : 'FAIL');

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
