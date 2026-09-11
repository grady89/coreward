// NG+ (the Second Descent): the epilogue's third button starts a fresh run
// that keeps the Forge, the glyphs and the archive, resets everything owned,
// and steps every Lumen price 1.5x — persisted, survives a reload, and marks
// the title slot with NG+.
import { chromium } from 'playwright';

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

await page.goto('http://localhost:4173');
await page.waitForTimeout(2500);
await page.evaluate(() => localStorage.clear());
await page.click('#t-new');
await page.waitForTimeout(3400);
await page.waitForFunction(() => window.__game.mode === 'play', { timeout: 30000 });

// first playthrough: prices at par
const par = await page.evaluate(() => window.__game.state.price(1000));
console.log('descent 0 price(1000):', par, par === 1000 ? 'OK' : 'FAIL');

// a lived-in run: wealth, upgrades, and knowledge
await page.evaluate(() => {
  const g = window.__game;
  g.state.money = 50000;
  g.state.upgrades.drill = 3;
  g.state.emberTech.lance = true;
  g.state.glyphsSet.add('probe-glyph');
  g.state.foundLogs.add(3);
  g.saveNow();
});

// the epilogue offers the descent
await page.evaluate(() => window.__game.panels.open('finale', { ending: 'return' }));
await page.waitForTimeout(400);
const btn = await page.evaluate(() => document.querySelector('#second')?.textContent);
console.log('epilogue button:', JSON.stringify(btn), btn?.includes('SECOND DESCENT') ? 'OK' : 'FAIL');

await page.click('#second');
await page.waitForTimeout(3400);
await page.waitForFunction(() => window.__game.mode === 'play', { timeout: 30000 });
const after = await page.evaluate(() => {
  const g = window.__game;
  return {
    descent: g.state.descent, money: g.state.money, drill: g.state.upgrades.drill,
    lance: g.state.emberTech.lance, glyph: g.state.glyphsSet.has('probe-glyph'),
    log: g.state.foundLogs.has(3), price: g.state.price(1000),
    greeted: g.state.firedEvents.has('descent-greeting'),
  };
});
console.log('after descent:', JSON.stringify(after));
console.log('  owned reset:', after.money === 40 && after.drill === 0 ? 'OK' : 'FAIL');
console.log('  knowledge kept:', after.lance && after.glyph && after.log ? 'OK' : 'FAIL');
console.log('  prices climbed:', after.descent === 1 && after.price === 1500 ? 'OK' : 'FAIL');
console.log('  dispatch greeted:', after.greeted ? 'OK' : 'FAIL');

// the sticker in the shop window agrees (flare: 45 -> 68)
await page.evaluate(() => window.__game.panels.open('fuel'));
await page.waitForTimeout(400);
const flare = await page.evaluate(() => document.querySelector('#buy-flare')?.textContent);
console.log('flare sticker:', JSON.stringify(flare), flare?.includes('68') ? 'OK' : 'FAIL');
await page.evaluate(() => { window.__game.panels.close(); window.__game.saveNow(); });

// the descent survives a reload, and the title says so
const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('coreward_save_v2') ?? '{}').descent);
console.log('descent persisted:', stored, stored === 1 ? 'OK' : 'FAIL');
await page.reload();
await page.waitForTimeout(3000);
const row = await page.evaluate(() => document.querySelector('#t-continue')?.textContent);
console.log('slot row:', JSON.stringify(row), row?.includes('NG+') ? 'OK' : 'FAIL');
await page.click('#t-continue');
await page.waitForTimeout(2500);
const resumed = await page.evaluate(() => {
  const g = window.__game;
  return { price: g.state.price(1000), lance: g.state.emberTech.lance };
});
console.log('resumed at NG+ rates:', JSON.stringify(resumed), resumed.price === 1500 && resumed.lance ? 'OK' : 'FAIL');

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
