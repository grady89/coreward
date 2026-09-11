// Softlock-proofing + the three expedition slots: quit to title, NEW lands in
// an empty slot without touching the old save, per-slot erase is a two-step
// arm (no native confirm, no page reload), a full roster arms an erase of the
// last-played slot, and the stranded tow re-offers after declining.
import { chromium } from 'playwright';

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
// simulate the hosted sandbox: confirm() is unavailable
await page.addInitScript(() => { window.confirm = () => { throw new Error('confirm blocked'); }; });

await page.goto('http://localhost:4173');
await page.waitForTimeout(2500);
await page.evaluate(() => localStorage.clear());
await page.click('#t-new');
await page.waitForTimeout(3400);
await page.waitForFunction(() => window.__game.mode === 'play', { timeout: 30000 });

// make some progress in slot 1, then quit to title through the pause panel
await page.evaluate(() => {
  const g = window.__game;
  g.state.money = 999;
  g.saveNow();
});
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
await page.click('#quit');
await page.waitForTimeout(600);
const backAtTitle = await page.evaluate(() => window.__game.mode);
console.log('quit to title:', backAtTitle, backAtTitle === 'title' ? 'OK' : 'FAIL');

// NEW EXPEDITION with a save present: no erase arm — it starts slot 2
await page.click('#t-new');
await page.waitForTimeout(3400);
await page.waitForFunction(() => window.__game.mode === 'play', { timeout: 30000 });
const fresh = await page.evaluate(() => ({ mode: window.__game.mode, money: window.__game.state.money, dug: window.__game.state.blocksDug }));
console.log('fresh run in slot 2:', JSON.stringify(fresh), fresh.money === 40 && fresh.dug === 0 && fresh.mode !== 'title' ? 'OK' : 'FAIL');
const slot1Kept = await page.evaluate(() => JSON.parse(localStorage.getItem('coreward_save_v2') ?? '{}').money);
console.log('slot 1 untouched:', slot1Kept, slot1Kept === 999 ? 'OK' : 'FAIL');

// save slot 2, back to title: two rows, then the per-slot two-step erase
await page.evaluate(() => { const g = window.__game; g.state.money = 555; g.saveNow(); });
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
await page.click('#quit');
await page.waitForTimeout(600);
const rows = await page.evaluate(() => document.querySelectorAll('#title .slot-row').length);
console.log('slot rows at title:', rows, rows === 2 ? 'OK' : 'FAIL');
await page.click('[data-erase="2"]');
await page.waitForTimeout(200);
const armedErase = await page.evaluate(() => document.querySelector('[data-erase="2"]')?.textContent);
console.log('erase armed:', JSON.stringify(armedErase), armedErase?.includes('ERASE') ? 'OK' : 'FAIL');
await page.click('[data-erase="2"]');
await page.waitForTimeout(200);
const afterErase = await page.evaluate(() => ({
  key: localStorage.getItem('coreward_save_v2_s2'),
  rows: document.querySelectorAll('#title .slot-row').length,
}));
console.log('slot 2 erased:', JSON.stringify(afterErase), afterErase.key === null && afterErase.rows === 1 ? 'OK' : 'FAIL');

// continue slot 1 while the pointer still says slot 2 — the cross-slot swap
await page.click('#t-continue');
await page.waitForTimeout(2500);
const resumed = await page.evaluate(() => ({ mode: window.__game.mode, money: window.__game.state.money }));
console.log('cross-slot continue:', JSON.stringify(resumed), resumed.money === 999 && resumed.mode === 'play' ? 'OK' : 'FAIL');

// a full roster: NEW must fall back to the old contract — armed erase of the
// last-played slot, two clicks, no confirm()
await page.evaluate(() => {
  const raw = localStorage.getItem('coreward_save_v2');
  localStorage.setItem('coreward_save_v2_s2', raw);
  localStorage.setItem('coreward_save_v2_s3', raw);
});
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
await page.click('#quit');
await page.waitForTimeout(600);
await page.click('#t-new');
await page.waitForTimeout(300);
const armedFull = await page.evaluate(() => document.querySelector('#t-new')?.textContent);
console.log('full roster arms:', JSON.stringify(armedFull), armedFull?.includes('ERASE SLOT') ? 'OK' : 'FAIL');
await page.click('#t-new');
await page.waitForTimeout(3400);
await page.waitForFunction(() => window.__game.mode === 'play', { timeout: 30000 });
const fresh2 = await page.evaluate(() => ({ mode: window.__game.mode, money: window.__game.state.money, dug: window.__game.state.blocksDug }));
console.log('fresh run over full roster:', JSON.stringify(fresh2), fresh2.money === 40 && fresh2.dug === 0 && fresh2.mode !== 'title' ? 'OK' : 'FAIL');

// stranded re-offer: decline the tow, wait, expect it again. A fresh page —
// the slot gauntlet above leaves this one so deep in SwiftShader debt that
// six game-seconds stop fitting in any reasonable wall-clock budget.
await page.close();
page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
await page.goto('http://localhost:4173');
await page.waitForTimeout(2500);
await page.evaluate(() => localStorage.clear());
await page.click('#t-new');
await page.waitForTimeout(3400);
await page.waitForFunction(() => window.__game.mode === 'play', { timeout: 30000 });
await page.evaluate(() => {
  const g = window.__game;
  for (let y = 20; y < 23; y++) for (let x = 8; x < 11; x++) g.terrain.carve(x, y);
  g.ctrl.px = 9.5; g.ctrl.py = -22 + 0.42; g.ctrl.vy = 0;
  g.cam.snap(9.5, -21, 12.5);
  g.state.fuel = 0.2;
});
// idle drain has to burn the last of the tank first, and game time runs well
// under wall-clock on a SwiftShader page this deep into its session — poll
let offer1 = null;
for (let i = 0; i < 60; i++) {
  await page.waitForTimeout(500);
  offer1 = await page.evaluate(() => window.__game.panels.current);
  if (offer1 === 'rescue') break;
}
await page.click('#stay');
// the re-offer is on a 6s GAME-time timer, and game time can crawl to an
// eighth of wall-clock under SwiftShader — poll until the game clock itself
// has crossed the timer, plus slack, before calling it
let offer2 = null;
const refireAt = await page.evaluate(() => window.__game.ctrl.strandedAt + 6);
for (let i = 0; i < 240; i++) {
  await page.waitForTimeout(500);
  offer2 = await page.evaluate(() => window.__game.panels.current);
  if (offer2 === 'rescue') break;
  const t = await page.evaluate(() => window.__game.time);
  if (t > refireAt + 3) break; // the clock passed it and nothing fired: a real FAIL
}
console.log('tow re-offer after declining:', offer1, '->', offer2, offer1 === 'rescue' && offer2 === 'rescue' ? 'OK' : 'FAIL');

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
