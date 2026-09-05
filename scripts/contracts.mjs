// Contracts + settings suite: accept, progress, claim, abandon, and the
// settings panel's volume/motion/fps controls with persistence.
import { chromium } from 'playwright';

const OUT = process.argv[2] ?? '.';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

await page.goto('http://localhost:4173');
await page.waitForTimeout(2500);
await page.evaluate(() => { localStorage.clear(); });
await page.click('#t-new');
await page.waitForTimeout(3400);

// ---- contracts ----
await page.evaluate(() => {
  const g = window.__game;
  g.ctrl.px = 30.5; g.ctrl.py = 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.cam.snap(30.5, 2, 14);
});
await page.waitForTimeout(700);
await page.keyboard.press('KeyE');
await page.waitForTimeout(600);
await page.click('#to-contracts');
await page.waitForTimeout(600);
await page.screenshot({ path: OUT + '/c-board.png' });
const offered = await page.evaluate(() => document.querySelectorAll('[data-accept]').length);
console.log('offers listed:', offered, offered === 3 ? 'OK' : 'FAIL');

await page.click('[data-accept="0"]');
await page.waitForTimeout(600);
const accepted = await page.evaluate(() => ({
  has: !!window.__game.state.contract,
  title: window.__game.state.contract?.c.title,
  kind: window.__game.state.contract?.c.kind,
}));
console.log('accepted:', JSON.stringify(accepted), accepted.has ? 'OK' : 'FAIL');
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

// HUD tracker visible
const trackerOn = await page.evaluate(() => document.querySelector('#hud-contract')?.classList.contains('on'));
console.log('hud tracker:', trackerOn ? 'OK' : 'FAIL');
await page.screenshot({ path: OUT + '/c-hud.png' });

// satisfy the goal, then claim
await page.evaluate(() => {
  const g = window.__game;
  const c = g.state.contract.c;
  // depth goals now read THIS world's depth (worldBestRow, 2m per tile)
  if (c.kind === 'depth' || c.kind === 'speed') g.state.worldBestRow = Math.ceil((c.target + 10) / 2);
  else if (c.kind === 'ore') g.state.contractOre = c.target;
  else g.state.totalEarned = g.state.contract.startEarned + c.target + 10;
  g.ctrl.px = 30.5; g.ctrl.py = 0.42;
  g.cam.snap(30.5, 2, 14);
});
await page.waitForTimeout(800);
await page.keyboard.press('KeyE');
await page.waitForTimeout(500);
await page.click('#to-contracts');
await page.waitForTimeout(600);
await page.screenshot({ path: OUT + '/c-active.png' });
const before = await page.evaluate(() => window.__game.state.money);
await page.click('#c-claim');
await page.waitForTimeout(600);
const after = await page.evaluate(() => ({
  money: window.__game.state.money, done: window.__game.state.contractsDone, active: window.__game.state.contract,
}));
console.log('claimed:', JSON.stringify(after), after.money > before && after.done === 1 && after.active === null ? 'OK' : 'FAIL');

// accept + abandon
await page.click('[data-accept="1"]');
await page.waitForTimeout(400);
await page.click('#c-abandon');
await page.waitForTimeout(400);
const abandoned = await page.evaluate(() => window.__game.state.contract);
console.log('abandon:', abandoned === null ? 'OK' : 'FAIL');
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

// --- frugal contracts scale to YOUR tank, not a fixed 90 units ---
const frugal = await page.evaluate(() => {
  const mk = (maxFuel) => {
    const c = window.__CONTRACT_POOL.find(x => x.kind === 'frugal');
    return window.__acceptContract(c, {
      maxFuel, bestDepthM: 500, totalEarned: 0, fuelSpent: 0, playTime: 0,
    });
  };
  const stock = mk(100), upgraded = mk(350);
  return {
    stock: { cap: stock.fuelCap, target: stock.target },
    upgraded: { cap: upgraded.fuelCap, target: upgraded.target },
  };
});
console.log('frugal scales to tank:', JSON.stringify(frugal),
  frugal.stock.cap === 90 && frugal.upgraded.cap === 315 &&
  frugal.upgraded.target > frugal.stock.target ? 'OK' : 'FAIL');

// --- meeting the terms LATCHES: later fuel spend cannot revoke it ---
const latch = await page.evaluate(async () => {
  const g = window.__game;
  const c = window.__CONTRACT_POOL.find(x => x.kind === 'frugal');
  g.state.contract = window.__acceptContract(c, {
    maxFuel: g.state.maxFuel, bestDepthM: g.state.bestDepthM,
    totalEarned: g.state.totalEarned, fuelSpent: g.state.fuelSpent, playTime: g.state.playTime,
  });
  g.state.totalEarned = g.state.contract.startEarned + g.state.contract.target + 500;
  await new Promise(r => setTimeout(r, 900));
  const met = !!g.state.contract.met;
  // now blow the budget wide open, as a long productive run would
  g.state.fuelSpent = g.state.contract.startFuelSpent + 99999;
  await new Promise(r => setTimeout(r, 900));
  const ev = window.__evaluate(g.state.contract, {
    bestDepthM: g.state.bestDepthM, worldDepthM: g.state.worldBestRow * 2,
    totalEarned: g.state.totalEarned,
    fuelSpent: g.state.fuelSpent, contractOre: g.state.contractOre, now: g.state.playTime,
  });
  return { met, stillMet: ev.met, failed: ev.failed };
});
console.log('terms latch once met:', JSON.stringify(latch),
  latch.met && latch.stillMet && !latch.failed ? 'OK' : 'FAIL');

// and it is still claimable at the board afterwards
await page.evaluate(() => {
  const g = window.__game;
  g.ctrl.drilling = null;
  g.ctrl.px = 30.5; g.ctrl.py = 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.cam.snap(30.5, 2, 14);
});
await page.waitForTimeout(1200);
await page.keyboard.press('KeyE');
await page.waitForTimeout(600);
await page.click('#to-contracts');
await page.waitForTimeout(600);
await page.screenshot({ path: OUT + '/c-latched.png' });
const claimable = await page.evaluate(() => !!document.querySelector('#c-claim'));
console.log('claimable after blowing budget:', claimable ? 'OK' : 'FAIL');
if (claimable) { await page.click('#c-claim'); await page.waitForTimeout(500); }
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

// ---- settings ----
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
await page.click('#to-settings');
await page.waitForTimeout(600);
await page.screenshot({ path: OUT + '/c-settings.png' });

// volume slider
await page.evaluate(() => {
  const el = document.querySelector('input[data-vol="master"]');
  el.value = '20';
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
await page.waitForTimeout(300);
const vol = await page.evaluate(() => window.__game.settings.master);
console.log('master volume:', vol, Math.abs(vol - 0.2) < 0.01 ? 'OK' : 'FAIL');

// toggles
await page.click('[data-toggle="shake"]');
await page.waitForTimeout(200);
await page.click('[data-toggle="showFps"]');
await page.waitForTimeout(1400);
const toggles = await page.evaluate(() => ({
  shake: window.__game.settings.shake,
  reduced: window.__game.cam.reducedMotion,
  fps: window.__game.settings.showFps,
  fpsShown: document.querySelector('#fps')?.classList.contains('on'),
}));
console.log('toggles:', JSON.stringify(toggles),
  toggles.shake === false && toggles.reduced === true && toggles.fps && toggles.fpsShown ? 'OK' : 'FAIL');

// persistence across reload
await page.reload();
await page.waitForTimeout(2800);
const persisted = await page.evaluate(() => window.__game.settings);
console.log('persisted:', JSON.stringify({ m: persisted.master, s: persisted.shake, f: persisted.showFps }),
  Math.abs(persisted.master - 0.2) < 0.01 && persisted.shake === false && persisted.showFps ? 'OK' : 'FAIL');

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
