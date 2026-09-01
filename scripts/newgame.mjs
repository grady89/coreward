// Softlock-proofing test: quit to title, two-step NEW EXPEDITION (no native
// confirm, no page reload), and the stranded tow re-offer after declining.
import { chromium } from 'playwright';

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
// simulate the hosted sandbox: confirm() is unavailable
await page.addInitScript(() => { window.confirm = () => { throw new Error('confirm blocked'); }; });

await page.goto('http://localhost:4173');
await page.waitForTimeout(2500);
await page.evaluate(() => localStorage.clear());
await page.click('#t-new');
await page.waitForTimeout(3400);

// make some progress, then quit to title through the pause panel
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

// two-step new expedition
await page.click('#t-new');
await page.waitForTimeout(300);
const armedText = await page.evaluate(() => document.querySelector('#t-new')?.textContent);
console.log('armed:', JSON.stringify(armedText), armedText?.includes('ERASE') ? 'OK' : 'FAIL');
await page.click('#t-new');
await page.waitForTimeout(3400);
const fresh = await page.evaluate(() => ({ mode: window.__game.mode, money: window.__game.state.money, dug: window.__game.state.blocksDug }));
console.log('fresh run:', JSON.stringify(fresh), fresh.money === 40 && fresh.dug === 0 && fresh.mode !== 'title' ? 'OK' : 'FAIL');

// stranded re-offer: decline the tow, wait, expect it again
await page.evaluate(() => {
  const g = window.__game;
  for (let y = 20; y < 23; y++) for (let x = 8; x < 11; x++) g.terrain.carve(x, y);
  g.ctrl.px = 9.5; g.ctrl.py = -22 + 0.42; g.ctrl.vy = 0;
  g.cam.snap(9.5, -21, 12.5);
  g.state.fuel = 0.2;
});
await page.waitForTimeout(4500);
const offer1 = await page.evaluate(() => window.__game.panels.current);
await page.click('#stay');
await page.waitForTimeout(14000);
const offer2 = await page.evaluate(() => window.__game.panels.current);
console.log('tow re-offer after declining:', offer1, '->', offer2, offer1 === 'rescue' && offer2 === 'rescue' ? 'OK' : 'FAIL');

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
