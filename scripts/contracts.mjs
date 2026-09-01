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
  if (c.kind === 'depth' || c.kind === 'speed') g.state.bestDepthM = c.target + 10;
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
