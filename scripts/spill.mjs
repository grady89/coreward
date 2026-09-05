// The spill: crash with a full hold, recover it under the clock, lose it to
// the clock. Covers the claim, the beacon, the HUD clock, the map mark and
// both ways a claim closes.
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

// dig a pocket at depth, load the hold, then kill the pod there
await page.evaluate(() => {
  const g = window.__game;
  for (let y = 24; y <= 26; y++) for (let x = 26; x <= 38; x++) g.terrain.carve(x, y);
  g.ctrl.drilling = null;
  g.ctrl.px = 32.5; g.ctrl.py = -25.4; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.state.cargo = new Map([[10, 3], [13, 2]]); // copper + gold
  g.cam.snap(32.5, -24, 14);
});
await page.waitForTimeout(900);
const before = await page.evaluate(() => ({ n: window.__game.state.cargoCount, v: window.__game.state.cargoValue }));

await page.evaluate(() => { const g = window.__game; g.state.hull = 1; g.ctrl.hurtFromThreat(50, 'the test'); });
await page.waitForTimeout(900);
const dead = await page.evaluate(() => ({
  panel: window.__game.panels.current,
  spill: window.__game.state.spill && { ...window.__game.state.spill, cargo: window.__game.state.spill.cargo },
  cargo: window.__game.state.cargoCount,
  text: document.querySelector('#panel-body .screen-sub')?.textContent.replace(/\s+/g, ' ').trim(),
}));
await page.screenshot({ path: OUT + '/s-death.png' });
console.log('crash filed a claim:', dead.spill ? `${dead.spill.cargo.length} stacks @ ${dead.spill.x.toFixed(1)},${dead.spill.y.toFixed(1)} ttl ${dead.spill.ttl.toFixed(0)}` : 'none',
  dead.spill && dead.cargo === 0 && dead.spill.ttl > 290 ? 'OK' : 'FAIL');
console.log('death panel names it:', /Hold spilled/.test(dead.text ?? '') ? 'OK' : 'FAIL', '\n  ', dead.text);

// respawn: the clock should be on the HUD and the mark on the survey map
await page.click('#respawn');
await page.waitForTimeout(1200);
await page.keyboard.press('Tab');
await page.waitForTimeout(900);
const hud = await page.evaluate(() => ({
  on: document.querySelector('#spill-claim')?.classList.contains('on'),
  text: document.querySelector('#spill-claim')?.textContent.replace(/\s+/g, ' ').trim(),
  py: +window.__game.ctrl.py.toFixed(1),
}));
await page.screenshot({ path: OUT + '/s-hud.png' });
console.log('claim clock on HUD:', hud.text, hud.on ? 'OK' : 'FAIL');
console.log('towed to the surface:', hud.py, hud.py > -2 ? 'OK' : 'FAIL');
await page.keyboard.press('Tab');

// look at it: the beacon in the dark, from outside the pickup radius
await page.evaluate(() => {
  const g = window.__game;
  const s = g.state.spill;
  g.state.gear[g.state.activeWorld] = { ...(g.state.gear[g.state.activeWorld] ?? {}), scanner: true };
  g.ctrl.px = s.x + 2.6; g.ctrl.py = s.y + 0.5; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.lampOn = false;   // the beacon is the only light down here
  g.cam.zoomBias = -4;
  g.cam.snap(s.x + 1.3, s.y + 1.2, 9);
});
await page.waitForTimeout(1400);
await page.screenshot({ path: OUT + '/s-beacon.png' });

// the same claim on the survey map
await page.keyboard.press('Tab');
await page.waitForTimeout(1200);
await page.evaluate(() => { window.__game.map.zoom = 3; window.__game.map.lastDraw = -9; });
await page.waitForTimeout(900);
await page.screenshot({ path: OUT + '/s-map.png' });
await page.keyboard.press('Tab');
await page.waitForTimeout(400);

// the last minute: the clock goes magma and the beacon strobes faster
await page.evaluate(() => { window.__game.state.spill.ttl = 44; window.__game.lampOn = true; });
await page.waitForTimeout(900);
await page.screenshot({ path: OUT + '/s-failing.png' });
await page.evaluate(() => { window.__game.state.spill.ttl = 240; });

// fly back into the pile
await page.evaluate(() => {
  const g = window.__game;
  const s = g.state.spill;
  g.ctrl.px = s.x; g.ctrl.py = s.y + 0.5; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.cam.snap(s.x, s.y + 1, 12);
});
await page.waitForTimeout(1200);
await page.screenshot({ path: OUT + '/s-recover.png' });
const back = await page.evaluate(() => ({
  n: window.__game.state.cargoCount, v: window.__game.state.cargoValue,
  spill: window.__game.state.spill, on: document.querySelector('#spill-claim')?.classList.contains('on'),
}));
console.log('hold recovered:', `${before.n} lost -> ${back.n} back (${before.v} -> ${back.v})`,
  back.n === before.n && back.v === before.v && !back.spill && !back.on ? 'OK' : 'FAIL');

// a partial recovery: a hold with two slots free takes two units and no more
await page.evaluate(() => {
  const g = window.__game;
  g.state.cargo = new Map([[10, 8]]);           // 8 of 10 slots spoken for
  g.state.spill = { world: g.state.activeWorld, x: 32.5, y: -26.98, ttl: 200, cargo: [[13, 5]] };
  g.spill.show(g.state.spill);
  g.ctrl.px = 32.5; g.ctrl.py = -26.5; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.cam.snap(32.5, -25.8, 11);
});
await page.waitForTimeout(1400);
const partial = await page.evaluate(() => ({
  n: window.__game.state.cargoCount,
  left: window.__game.state.spill?.cargo,
  on: document.querySelector('#spill-claim')?.classList.contains('on'),
  toast: [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '),
}));
await page.screenshot({ path: OUT + '/s-partial.png' });
console.log('partial recovery leaves the rest:', `hold ${partial.n}/10, floor ${JSON.stringify(partial.left)}`,
  partial.n === 10 && partial.left?.length === 1 && partial.left[0][1] === 3 && partial.on ? 'OK' : 'FAIL');
console.log('  and says so:', partial.toast);
await page.evaluate(() => { window.__game.state.cargo = new Map(); });

// second crash: let the battery run out this time
await page.evaluate(() => {
  const g = window.__game;
  g.ctrl.px = 32.5; g.ctrl.py = -25.4; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.state.hull = 1; g.ctrl.hurtFromThreat(50, 'the test');
});
await page.waitForTimeout(800);
await page.click('#respawn');
await page.waitForTimeout(900);
await page.evaluate(() => { window.__game.state.spill.ttl = 1.2; });
await page.waitForTimeout(2200);
const gone = await page.evaluate(() => ({
  spill: window.__game.state.spill,
  on: document.querySelector('#spill-claim')?.classList.contains('on'),
  toast: [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '),
}));
console.log('claim expires:', gone.toast, !gone.spill && !gone.on ? 'OK' : 'FAIL');

// a crash with an empty hold files nothing and disturbs no standing claim
await page.evaluate(() => {
  const g = window.__game;
  g.state.spill = { world: g.state.activeWorld, x: 10.5, y: -25.6, ttl: 123, cargo: [[10, 2]] };
  g.spill.show(g.state.spill);
  g.state.cargo = new Map();
  g.ctrl.px = 40.5; g.ctrl.py = -25.4; g.state.hull = 1; g.ctrl.hurtFromThreat(50, 'the test');
});
await page.waitForTimeout(700);
const empty = await page.evaluate(() => ({
  spill: window.__game.state.spill,
  text: document.querySelector('#panel-body .screen-sub')?.textContent.replace(/\s+/g, ' ').trim(),
}));
console.log('empty hold files nothing, standing claim kept:',
  empty.spill && empty.spill.x === 10.5 && !/Hold spilled/.test(empty.text ?? '') ? 'OK' : 'FAIL', '\n  ', empty.text);
await page.click('#respawn');
await page.waitForTimeout(600);

// a second crash WITH ore writes the old claim off and takes its place
await page.evaluate(() => {
  const g = window.__game;
  g.state.cargo = new Map([[12, 4]]);
  g.ctrl.px = 40.5; g.ctrl.py = -25.4; g.state.hull = 1; g.ctrl.hurtFromThreat(50, 'the test');
});
await page.waitForTimeout(700);
const replaced = await page.evaluate(() => window.__game.state.spill);
console.log('a new crash writes off the old claim:',
  replaced && Math.floor(replaced.x) === 40 && replaced.cargo.length === 1 && replaced.cargo[0][0] === 12 ? 'OK' : 'FAIL');
await page.click('#respawn');
await page.waitForTimeout(600);

// the claim survives a reload — the battery only burns while you are playing
const left = await page.evaluate(() => { window.__game.saveNow(); return window.__game.state.spill.ttl; });
await page.reload();
await page.waitForTimeout(2500);
await page.click('#t-continue');
await page.waitForTimeout(3200);
const loaded = await page.evaluate(() => ({
  spill: window.__game.state.spill,
  on: document.querySelector('#spill-claim')?.classList.contains('on'),
}));
console.log('claim survives a reload:', `${left.toFixed(0)}s -> ${loaded.spill?.ttl.toFixed(0)}s`,
  loaded.spill && loaded.on && Math.abs(loaded.spill.ttl - left) < 12 ? 'OK' : 'FAIL');

console.log(errors.length ? errors.join('\n') : 'no page errors');
await browser.close();
