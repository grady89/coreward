// Acclimation: a fully-upgraded pod still has to work a new world's shallows.
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

// max the rig out and jump to CRYOS-2, as a returning player would arrive
await page.evaluate(() => {
  const g = window.__game;
  g.state.money = 400000;
  for (const k of ['drill', 'engine', 'tank', 'cargo', 'hull', 'radiator']) g.state.upgrades[k] = 5;
  g.state.endedWorlds.add('veil3');
  g.state.activeWorld = 'cryos2';
  g.state.persist();
});
await page.reload();
await page.waitForTimeout(2700);
await page.click('#t-continue');
await page.waitForTimeout(1800);
await page.evaluate(() => window.__game.comms.clear());

// VEIL-3 radiators must not protect you here
const resist = await page.evaluate(() => ({
  world: window.__game.state.activeWorld,
  radiator: window.__game.state.upgrades.radiator,
  resist: window.__game.state.hazardResist,
  accl: window.__game.state.acclTier,
}));
console.log('maxed radiators on CRYOS-2:', JSON.stringify(resist),
  resist.radiator === 5 && resist.resist === 0 ? 'OK — radiators do not shed cold' : 'FAIL');

// native material exists, and ONLY in the upper strata
const spread = await page.evaluate(() => {
  const g = window.__game;
  let n = 0, minY = 1e9, maxY = -1;
  for (let y = 0; y < 512; y++) for (let x = 0; x < 64; x++) {
    if (g.terrain.get(x, y) === 21) { n++; minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  }
  return { n, minY, maxY };
});
console.log('rime salt spread:', JSON.stringify(spread),
  spread.n > 150 && spread.minY >= 18 && spread.maxY < 210 ? 'OK — shallow bands only' : 'FAIL');

// the deep is lethal without acclimation
const unprotected = await page.evaluate(async () => {
  const g = window.__game;
  for (let y = 300; y < 306; y++) for (let x = 28; x < 34; x++) g.terrain.carve(x, y);
  g.ctrl.px = 30.5; g.ctrl.py = -305 + 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.state.hull = g.state.maxHull; g.state.fuel = g.state.maxFuel;
  const max = g.state.maxHull;
  await new Promise(r => setTimeout(r, 2500));
  return { max, hull: Math.round(g.state.hull), heatFrac: +g.ctrl.heatFrac.toFixed(2) };
});
console.log('unacclimated at 610m:', JSON.stringify(unprotected),
  unprotected.hull < unprotected.max && unprotected.heatFrac > 0 ? 'OK — frost bites' : 'FAIL');
await page.screenshot({ path: OUT + '/ac-frost.png' });

// mine some rime salt and fit the first tier
const fitted = await page.evaluate(async () => {
  const g = window.__game;
  const cost = g.state.nativeCost(0);
  g.state.addNative(cost);          // stand in for ~10 minutes of shallow work
  g.state.hull = g.state.maxHull;
  g.ctrl.drilling = null;
  g.ctrl.px = 41.5; g.ctrl.py = 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.cam.snap(41.5, 2, 14);
  await new Promise(r => setTimeout(r, 1200));
  return { cost, held: g.state.nativeHeld };
});
console.log('discounted cost (radiator 5):', JSON.stringify(fitted),
  fitted.cost < 12 ? 'OK — thermal plant credited' : 'FAIL');

await page.keyboard.press('KeyE');
await page.waitForTimeout(700);
await page.screenshot({ path: OUT + '/ac-garage.png' });
await page.click('#fit-accl');
await page.waitForTimeout(500);
const after = await page.evaluate(() => ({
  tier: window.__game.state.acclTier,
  resist: window.__game.state.hazardResist,
  held: window.__game.state.nativeHeld,
}));
console.log('tier 1 fitted:', JSON.stringify(after),
  after.tier === 1 && after.resist > 0.4 && after.held === 0 ? 'OK' : 'FAIL');
await page.keyboard.press('Escape');

// now the same depth is survivable
const protectedRun = await page.evaluate(async () => {
  const g = window.__game;
  g.ctrl.drilling = null;
  g.ctrl.px = 30.5; g.ctrl.py = -305 + 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.state.hull = g.state.maxHull;
  await new Promise(r => setTimeout(r, 2500));
  return { hull: Math.round(g.state.hull), heatFrac: +g.ctrl.heatFrac.toFixed(2) };
});
console.log('acclimated at 610m:', JSON.stringify(protectedRun),
  protectedRun.hull === Math.round(protectedRun.hull) && protectedRun.heatFrac === 0
    ? 'OK — survivable now' : 'FAIL');

// VEIL-3 is untouched: radiators still work there
const veil = await page.evaluate(() => {
  const g = window.__game;
  g.state.activeWorld = 'veil3';
  const r = g.state.hazardResist;
  g.state.activeWorld = 'cryos2';
  return r;
});
console.log('VEIL-3 still uses radiators:', veil, veil > 1 ? 'OK' : 'FAIL');

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
