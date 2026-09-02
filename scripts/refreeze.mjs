// The refreeze (CRYOS-2): dug shafts skin over into young ice behind you.
// Deterrent: the yo-yo dies — your route home closes. Guarantee: young ice
// is rammable from below by ANY pod, so nobody is ever walled in.
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

// 1) VEIL-3 never refreezes, however old the shaft
const veil = await page.evaluate(async () => {
  const g = window.__game;
  for (let y = 300; y < 306; y++) g.terrain.carve(30, y);
  for (let y = 300; y < 306; y++) g.rimeAge.set(g.terrain.idx(30, y), 9999);
  await new Promise(r => setTimeout(r, 1500));
  let air = 0;
  for (let y = 300; y < 306; y++) if (g.terrain.get(30, y) === 0) air++;
  return air;
});
console.log('veil3 does not refreeze:', veil, veil === 6 ? 'OK' : 'FAIL');

// 2) travel to CRYOS-2 and dig a deep shaft
await page.evaluate(() => window.__game.travel('cryos2'));
await page.waitForTimeout(2500);
await page.evaluate(() => {
  const g = window.__game;
  g.comms.clear();
  // a straight shaft: rows 290..321 at x=30, pod parked at the bottom
  for (let y = 290; y <= 321; y++) g.terrain.carve(30, y);
  g.terrain.carve(29, 321); g.terrain.carve(31, 321); // room to stand
  g.ctrl.drilling = null;
  g.ctrl.px = 30.5; g.ctrl.py = -(320) + 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.state.fuel = g.state.maxFuel;
  g.state.accl.cryos2 = 0;
  g.cam.snap(g.ctrl.px, g.ctrl.py, 12.5);
});
await page.waitForTimeout(1200);

// 3) age the shaft: far tiles skin over, the pod's pocket stays thawed
const frozen = await page.evaluate(async () => {
  const g = window.__game;
  for (let y = 290; y <= 321; y++) g.rimeAge.set(g.terrain.idx(30, y), 9999);
  await new Promise(r => setTimeout(r, 1500));
  let rime = 0, nearAir = true;
  for (let y = 290; y <= 321; y++) {
    const t = g.terrain.get(30, y);
    if (t === 22) rime++;
    if (y >= 313 && t !== 0) nearAir = false; // within 8 of the pod at row 320
  }
  return { rime, nearAir };
});
console.log('shaft skins over:', JSON.stringify(frozen),
  frozen.rime >= 15 && frozen.nearAir ? 'OK — pocket stays thawed' : 'FAIL');
await page.screenshot({ path: OUT + '/r-frozen.png' });

// 4) acclimation keeps the wake warm longer (tier 2 = 140s threshold)
const accl = await page.evaluate(async () => {
  const g = window.__game;
  g.terrain.carve(20, 300); g.terrain.carve(20, 301);
  g.state.accl.cryos2 = 2;
  g.rimeAge.set(g.terrain.idx(20, 300), 100); // old enough for tier 0, not tier 2
  g.rimeAge.set(g.terrain.idx(20, 301), 100);
  await new Promise(r => setTimeout(r, 1500));
  const warm = g.terrain.get(20, 300) === 0;
  g.state.accl.cryos2 = 0;
  await new Promise(r => setTimeout(r, 1500));
  const cold = g.terrain.get(20, 301) === 22;
  return { warm, cold };
});
console.log('acclimation delays the freeze:', JSON.stringify(accl),
  accl.warm && accl.cold ? 'OK — a job hull cannot do' : 'FAIL');

// 5) the guarantee: NO Ascent Coil, and the pod still rams its way home
const smash = await page.evaluate(() => ({
  updrill: window.__game.state.emberTech.updrill,
  row0: window.__game.ctrl.row,
}));
await page.keyboard.down('ArrowUp');
await page.waitForTimeout(14000);
await page.keyboard.up('ArrowUp');
const out = await page.evaluate(() => ({
  row: window.__game.ctrl.row,
  fuel: Math.round(window.__game.state.fuel),
}));
console.log('coil-less pod rams out:', JSON.stringify({ ...smash, ...out }),
  !smash.updrill && out.row < smash.row0 - 10 ? 'OK — slowed, never sealed' : 'FAIL');
await page.screenshot({ path: OUT + '/r-smashed.png' });

// 6) rime persists in the save, still rammable next session
await page.evaluate(() => window.__game.saveNow());
const saved = await page.evaluate(() => {
  const ws = window.__game.state.worlds.cryos2;
  return { rime: (ws.rime ?? []).length };
});
console.log('rime persists:', JSON.stringify(saved), saved.rime > 0 ? 'OK' : 'FAIL');

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
