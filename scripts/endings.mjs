// The three endings: EXTRACT (deliver all three), RETURN (all three home),
// KINDLE (all three assembled under the full gate). Plus the post-ending
// rewind, the emblems, and the Lumen Lance law-check.
import { chromium } from 'playwright';

const OUT = process.argv[2] ?? '.';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

/**
 * Fresh run. NOTE: localStorage is cleared only ONCE, at the very start —
 * ending emblems live outside the save on purpose, and this suite asserts
 * they accumulate across expeditions. A save present arms a two-step erase
 * confirm on the title button, so click through it.
 */
let firstBoot = true;
async function boot() {
  await page.goto('http://localhost:4173');
  await page.waitForTimeout(2500);
  if (firstBoot) {
    firstBoot = false;
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForTimeout(2500);
  }
  await page.click('#t-new');
  await page.waitForTimeout(500);
  // only the ARMED button wants a second click; a plain DESCEND is already
  // starting, and clicking a fading title races the DOM
  const armed = await page.evaluate(() =>
    (document.querySelector('#t-new')?.textContent ?? '').includes('ERASE'));
  if (armed) await page.click('#t-new');
  await page.waitForTimeout(3400);
}

/** walk to the cradle and hold E until the state changes */
async function holdUntil(done, capMs = 25000) {
  await page.evaluate(async () => {
    const g = window.__game;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }));
    for (let i = 0; i < 200; i++) {
      await new Promise(r => setTimeout(r, 100));
      if (Math.abs(g.pilot.px - g.ember.x) < 3.0) break;
    }
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowRight' }));
  });
  await page.waitForTimeout(300);
  await page.keyboard.down('KeyE');
  const t0 = Date.now();
  let ok = false;
  while (Date.now() - t0 < capMs) {
    await page.waitForTimeout(250);
    if (await page.evaluate(done)) { ok = true; break; }
  }
  await page.keyboard.up('KeyE');
  return ok;
}

async function toChamber() {
  await page.evaluate(() => {
    const g = window.__game;
    g.ctrl.drilling = null;
    g.ctrl.px = 20.5; g.ctrl.py = -509 + 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
    g.state.fuel = g.state.maxFuel; g.state.hull = g.state.maxHull;
    g.state.upgrades.radiator = 5;
    g.cam.snap(g.ctrl.px, g.ctrl.py, 12.5);
  });
  await page.waitForTimeout(2200);
}

// ---------------------------------------------------------------- EXTRACT
await boot();
await page.evaluate(() => {
  const g = window.__game;
  ['veil3', 'cryos2', 'maelis6'].forEach(w => g.state.endedWorlds.add(w));
  g.state.extractOrderHeard = true;
  g.state.huskVisited = true;
  // two already sold; the third is in the hold, at the trade post
  g.state.delivered.add('cryos2');
  g.state.delivered.add('maelis6');
  g.state.extracted.add('cryos2');
  g.state.extracted.add('maelis6');
  g.state.carrying = 'veil3';
  g.state.extracted.add('veil3');
  g.comms.clear();
  g.ctrl.respawnAtSurface();
  g.ctrl.px = 30.5; g.ctrl.py = 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.cam.snap(30.5, 2, 14);
});
await page.waitForTimeout(1500);
await page.keyboard.press('KeyE');
await page.waitForTimeout(800);
await page.click('#deliver');
await page.waitForTimeout(1500);
const extractPage = await page.evaluate(() => ({
  phase: window.__game.finale.phase,
  cls: document.querySelector('#finale')?.className,
  title: document.querySelector('#f-title')?.textContent,
}));
console.log('EXTRACT page:', JSON.stringify(extractPage),
  extractPage.phase === 'page' && (extractPage.cls ?? '').includes('page-dark') ? 'OK — the one dark ending' : 'FAIL');
await page.waitForTimeout(4000);
await page.screenshot({ path: OUT + '/e-extract-page.png' });
// the page waits for the player
const held = await page.evaluate(() => window.__game.finale.phase);
console.log('  page waits for input:', held, held === 'page' ? 'OK' : 'FAIL');
await page.keyboard.press('KeyE');
await page.waitForTimeout(1200);
const extractPanel = await page.evaluate(() => ({
  panel: window.__game.panels.current,
  dark: !!document.querySelector('.panel-scrim.rite-dark'),
  rewind: !!document.querySelector('#rewind'),
}));
console.log('  epilogue:', JSON.stringify(extractPanel),
  extractPanel.panel === 'finale' && extractPanel.dark && extractPanel.rewind ? 'OK' : 'FAIL');
await page.screenshot({ path: OUT + '/e-extract-panel.png' });

// the rewind puts the fork back
const before = await page.evaluate(() => ({ money: window.__game.state.money }));
await page.click('#rewind');
await page.waitForTimeout(2500);
const rewound = await page.evaluate(() => ({
  carrying: window.__game.state.carrying,
  delivered: [...window.__game.state.delivered],
  money: window.__game.state.money,
  mode: window.__game.mode,
}));
console.log('rewind to the fork:', JSON.stringify(rewound),
  rewound.carrying === 'veil3' && rewound.delivered.length === 2 && rewound.mode === 'play'
    ? 'OK — the choice is still there' : 'FAIL');

// ---------------------------------------------------------------- RETURN
await boot();
await page.evaluate(() => {
  const g = window.__game;
  ['veil3', 'cryos2', 'maelis6'].forEach(w => g.state.endedWorlds.add(w));
  g.state.extractOrderHeard = true;
  g.state.carrying = 'veil3';
  g.state.extracted.add('veil3');
  g.comms.clear();
});
await toChamber();
await page.keyboard.press('KeyE');
await page.waitForTimeout(700);
await holdUntil(() => window.__game.state.carrying === null);
await page.waitForTimeout(1500);
const returnPage = await page.evaluate(() => ({
  phase: window.__game.finale.phase,
  cls: document.querySelector('#finale')?.className,
}));
console.log('RETURN page:', JSON.stringify(returnPage),
  returnPage.phase === 'page' && (returnPage.cls ?? '').includes('page-dawn') ? 'OK — dawn' : 'FAIL');
await page.waitForTimeout(4500);
await page.screenshot({ path: OUT + '/e-return-page.png' });
await page.keyboard.press('KeyE');
await page.waitForTimeout(1200);
console.log('  epilogue:', await page.evaluate(() => window.__game.panels.current));

// ---------------------------------------------------------------- KINDLE
await boot();
await page.evaluate(() => {
  const g = window.__game;
  ['veil3', 'cryos2', 'maelis6'].forEach(w => g.state.endedWorlds.add(w));
  g.state.extractOrderHeard = true;
  // the full gate: every glyph, every log, the whole forge
  g.state.glyphs = 9;
  for (let i = 0; i < 12; i++) g.state.foundLogs.add(i);
  ['dash', 'updrill', 'converter', 'warp', 'lance'].forEach(k => { g.state.emberTech[k] = true; });
  // two fragments already laid in VEIL-3's cradle, the third in the hold
  g.state.offered.add('cryos2');
  g.state.extracted.add('cryos2');
  g.state.extracted.add('maelis6');
  g.state.carrying = 'maelis6';
  g.comms.clear();
});
await toChamber();
const kindlePrompt = await page.evaluate(() => document.querySelector('#prompt')?.textContent);
console.log('KINDLE prompt:', JSON.stringify(kindlePrompt),
  (kindlePrompt ?? '').includes('ASSEMBLY') ? 'OK' : 'FAIL');
await page.keyboard.press('KeyE');
await page.waitForTimeout(700);
await holdUntil(() => window.__game.state.carrying === null);
await page.waitForTimeout(1500);
const kindlePage = await page.evaluate(() => ({
  phase: window.__game.finale.phase,
  cls: document.querySelector('#finale')?.className,
  offered: [...window.__game.state.offered],
}));
console.log('KINDLE page:', JSON.stringify(kindlePage),
  kindlePage.phase === 'page' && (kindlePage.cls ?? '').includes('page-pure') ? 'OK — a new star' : 'FAIL');
await page.waitForTimeout(4500);
await page.screenshot({ path: OUT + '/e-kindle-page.png' });
await page.keyboard.press('KeyE');
await page.waitForTimeout(1200);
const seen = await page.evaluate(() => JSON.parse(localStorage.getItem('coreward_endings') ?? '[]'));
console.log('emblems earned:', JSON.stringify(seen), seen.length === 3 ? 'OK — all three' : 'FAIL');

// the emblems ride on the title screen, outliving the save
await page.evaluate(() => window.__game.panels.close());
await page.reload();
await page.waitForTimeout(3000);
const emblems = await page.evaluate(() => document.querySelectorAll('#title .emblem').length);
console.log('title emblems:', emblems, emblems === 3 ? 'OK' : 'FAIL');
await page.screenshot({ path: OUT + '/e-title-emblems.png' });

// ------------------------------------------------- the Lance and its law
await page.click('#t-new');
await page.waitForTimeout(500);
if (await page.evaluate(() => (document.querySelector('#t-new')?.textContent ?? '').includes('ERASE'))) {
  await page.click('#t-new');
}
await page.waitForTimeout(3400);
await page.waitForFunction(() => window.__game.mode === 'play', { timeout: 20000 });
const lance = await page.evaluate(async () => {
  const g = window.__game;
  g.state.emberTech.lance = true;
  g.state.money = 500;
  g.ctrl.px = 30; g.ctrl.py = -100 + 0.42;
  for (let y = 98; y < 104; y++) for (let x = 26; x < 44; x++) g.terrain.carve(x, y);
  g.ctrl.py = -101 + 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.cam.snap(g.ctrl.px, g.ctrl.py, 12.5);
  await new Promise(r => setTimeout(r, 1200));
  const before = g.state.money;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyX' }));
  await new Promise(r => setTimeout(r, 400));
  return { before, after: g.state.money };
});
console.log('lance fires Lumens:', JSON.stringify(lance),
  lance.before - lance.after === 120 ? 'OK — shooting spends money' : 'FAIL');
const broke = await page.evaluate(async () => {
  const g = window.__game;
  g.state.money = 10;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyX' }));
  await new Promise(r => setTimeout(r, 300));
  return { money: g.state.money, toast: document.querySelector('#toasts')?.textContent };
});
console.log('lance without Lumens:', JSON.stringify(broke),
  broke.money === 10 ? 'OK — the Lance is empty' : 'FAIL');

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
