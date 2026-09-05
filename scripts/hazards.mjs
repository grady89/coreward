// Hazard & failure-path test: side drill, fall damage, gas, death, rescue.
//
// Headless swiftshader runs the game at ~8 fps, so nothing here waits a fixed
// number of milliseconds for the sim to reach a state — every step polls with a
// generous window and gives up loudly instead of silently asserting on a world
// that has not finished moving yet.
import { chromium } from 'playwright';

const OUT = process.argv[2] ?? '.';
const URL = 'http://localhost:4173';

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

/** sample `probe` in the page until `ok(sample)`; returns the last sample */
async function until(probe, ok, timeout = 25000, step = 200) {
  const t0 = Date.now();
  let last = await page.evaluate(probe);
  while (!ok(last) && Date.now() - t0 < timeout) {
    await page.waitForTimeout(step);
    last = await page.evaluate(probe);
  }
  return last;
}

const state = () => {
  const g = window.__game;
  return {
    px: g.ctrl.px, py: g.ctrl.py, vy: g.ctrl.vy,
    grounded: g.ctrl.grounded, drilling: !!g.ctrl.drilling,
    dug: g.state.blocksDug, hull: g.state.hull, fuel: g.state.fuel,
    panel: g.panels.current,
  };
};

await page.goto(URL);
await page.waitForTimeout(2500);
await page.evaluate(() => localStorage.clear());
await page.click('#t-new');
// the new-game intro plays before control is handed over
await until(() => !!(window.__game && window.__game.ctrl) && window.__game.mode, m => m === 'play', 30000);
await page.waitForTimeout(1200);

// 1) drill down, then sideways.
// West, not east: the landing pad (PAD_X0..PAD_X1 = 12..15) is undrillable
// plating for its top PAD_ROWS, so a rightward cut from column 10 hits
// "PAD PLATING" after a single tile and the check can never see a tunnel.
// The tunnel row is seeded with dirt so a randomly generated boulder (which a
// tier-1 drill genuinely cannot cut) never decides whether side drilling works.
await page.evaluate(() => {
  const g = window.__game;
  g.ctrl.px = 10.5; g.ctrl.py = 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.ctrl.drilling = null;
  g.cam.snap(10.5, 2, 14);
  for (let x = 6; x <= 10; x++) {
    for (let y = 1; y <= 3; y++) {
      g.terrain.data[g.terrain.idx(x, y)] = 1; // T.DIRT
      g.chunks.markDirty(x, y);
    }
  }
});
await page.waitForTimeout(600);

await page.keyboard.down('ArrowDown');
const down = await until(state, s => s.dug >= 2 && !s.drilling && s.grounded);
await page.keyboard.up('ArrowDown');
const settled = await until(state, s => !s.drilling && s.grounded, 8000);
const px0 = settled.px, dug0 = settled.dug;

await page.keyboard.down('ArrowLeft');
const side = await until(state, s => px0 - s.px > 0.8 && s.dug - dug0 >= 2);
await page.keyboard.up('ArrowLeft');
const sideOk = px0 - side.px > 0.8 && side.dug - dug0 >= 2;
console.log(
  'side drill: down dug', down.dug, '| px', px0.toFixed(2), '->', side.px.toFixed(2),
  'side dug', side.dug - dug0, sideOk ? 'OK' : 'FAIL',
);

// 2) fall damage: hoist to the flight ceiling and drop down the shaft.
// The drop is ~7 tiles, well past FALL_SAFE (13 tiles/s) at GRAVITY 21.
await until(state, s => !s.drilling, 8000);
await page.evaluate(() => {
  const g = window.__game;
  g.ctrl.drilling = null;
  g.state.hull = 100;
  g.ctrl.px = 10.5; g.ctrl.py = 6.9; g.ctrl.vy = 0; g.ctrl.vx = 0;
});
const landed = await until(state, s => s.grounded && s.py < 2);
const fallOk = landed.hull > 0 && landed.hull < 100;
console.log('fall damage: hull', landed.hull.toFixed(1), 'at py', landed.py.toFixed(2), fallOk ? 'OK' : 'FAIL');

// 3) gas pocket: plant one in the tile the pod is standing on and cut it.
// GAS_DMG is 16 at this depth, so a real burst is unmistakable next to the
// harmless one-tile drop that follows it.
const gasTile = await page.evaluate(() => {
  const g = window.__game;
  g.state.hull = 100;
  const x = Math.floor(g.ctrl.px), y = Math.floor(-(g.ctrl.py - 0.41) + 0.1);
  g.terrain.data[g.terrain.idx(x, y)] = 8; // T.GAS
  g.chunks.markDirty(x, y);
  return { x, y };
});
await page.keyboard.down('ArrowDown');
const gas = await until(state, s => s.hull < 100, 25000);
await page.keyboard.up('ArrowDown');
const gasOk = gas.hull <= 88 && gas.hull > 0;
console.log('gas burst: hull', gas.hull.toFixed(1), 'tile', JSON.stringify(gasTile), gasOk ? 'OK' : 'FAIL');

// 4) death: nearly dead + the same big fall
await until(state, s => !s.drilling, 8000);
await page.evaluate(() => {
  const g = window.__game;
  g.ctrl.drilling = null;
  g.state.hull = 3;
  g.ctrl.px = 10.5; g.ctrl.py = 6.9; g.ctrl.vy = 0; g.ctrl.vx = 0;
});
const dead = await until(state, s => s.panel === 'death');
await page.screenshot({ path: OUT + '/h-death.png' });
console.log('death panel:', dead.panel, dead.panel === 'death' ? 'OK' : 'FAIL');
await page.click('#respawn');
const respawned = await until(state, s => s.panel !== 'death' && s.hull > 0, 10000);
console.log('after respawn:', JSON.stringify({
  py: +respawned.py.toFixed(2), hull: respawned.hull, fuel: +respawned.fuel.toFixed(0),
}));

// 5) rescue: strand underground with no fuel. Idle burn is 0.28/s, so the tow
// offer needs the pod grounded AND the tank actually run dry — poll for both.
await page.evaluate(() => {
  const g = window.__game;
  for (let y = 20; y < 23; y++) for (let x = 30; x < 33; x++) g.terrain.carve(x, y);
  g.ctrl.drilling = null;
  g.ctrl.px = 31.5; g.ctrl.py = -22 + 0.42; g.ctrl.vy = 0; g.ctrl.vx = 0;
  g.cam.snap(g.ctrl.px, g.ctrl.py, 12.5);
  g.state.fuel = 0.4;
});
const rescue = await until(state, s => s.panel === 'rescue');
await page.screenshot({ path: OUT + '/h-rescue.png' });
console.log('rescue panel:', rescue.panel, rescue.panel === 'rescue' ? 'OK' : 'FAIL');

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
