// Starmap: open the Sundering Chart from the assay office, focus a site,
// commit a transit, arrive on the other world; Esc backs out cleanly.
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
await page.evaluate(() => window.__game.comms.clear());

// unlock CRYOS-2 and park at the assay office
await page.evaluate(() => {
  const g = window.__game;
  g.state.endedWorlds.add('veil3');
  g.ctrl.px = 52; g.ctrl.py = 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.cam.snap(52, 2, 14);
});
await page.waitForTimeout(800);
await page.keyboard.press('KeyE');
await page.waitForTimeout(700);
await page.screenshot({ path: OUT + '/sm-assay.png' });
const hasButton = await page.$('#open-starmap');
console.log('assay has starmap button:', hasButton ? 'OK' : 'FAIL');

// open the chart (long settle: SwiftShader frames stretch the veil fade)
await page.click('#open-starmap');
await page.waitForTimeout(3200);
const opened = await page.evaluate(() => ({
  mode: window.__game.mode,
  overlay: !!document.querySelector('#starmap-ui.open'),
  tags: document.querySelectorAll('.sm-tag').length,
}));
console.log('starmap open:', JSON.stringify(opened),
  opened.mode === 'starmap' && opened.overlay && opened.tags === 3 ? 'OK' : 'FAIL');
await page.screenshot({ path: OUT + '/sm-overview.png' });

// cycle to CRYOS-2 (index 1) and read the dossier
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(1400);
const card = await page.evaluate(() => ({
  focused: !!document.querySelector('#starmap-ui.focused'),
  name: document.querySelector('.sm-card .sm-name')?.textContent,
  commit: !!document.querySelector('#sm-commit'),
}));
console.log('dossier:', JSON.stringify(card),
  card.focused && card.name === 'CRYOS-2' && card.commit ? 'OK' : 'FAIL');
await page.screenshot({ path: OUT + '/sm-focus.png' });

// Esc backs out to overview, second Esc closes
await page.keyboard.press('Escape');
await page.waitForTimeout(700);
const backed = await page.evaluate(() => !document.querySelector('#starmap-ui.focused'));
console.log('esc → overview:', backed ? 'OK' : 'FAIL');
await page.keyboard.press('Escape');
await page.waitForTimeout(1200);
const closed = await page.evaluate(() => ({
  mode: window.__game.mode,
  overlay: !!document.querySelector('#starmap-ui'),
}));
console.log('esc → closed:', JSON.stringify(closed),
  closed.mode === 'play' && !closed.overlay ? 'OK' : 'FAIL');

// reopen and commit a transit to CRYOS-2
await page.keyboard.press('KeyE');
await page.waitForTimeout(600);
await page.click('#open-starmap');
await page.waitForTimeout(1400);
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(1200);
await page.keyboard.press('KeyE');
await page.waitForTimeout(1400);
await page.screenshot({ path: OUT + '/sm-transit.png' });
await page.waitForTimeout(3200);
const arrived = await page.evaluate(() => ({
  mode: window.__game.mode,
  world: window.__game.state.activeWorld,
  overlay: !!document.querySelector('#starmap-ui'),
  veil: !!document.querySelector('#sm-veil'),
}));
console.log('transit:', JSON.stringify(arrived),
  arrived.mode === 'play' && arrived.world === 'cryos2' && !arrived.overlay ? 'OK' : 'FAIL');
await page.waitForTimeout(1200);
await page.screenshot({ path: OUT + '/sm-arrived.png' });

// committing to the current world must be refused
await page.evaluate(() => {
  const g = window.__game;
  g.ctrl.px = 52; g.ctrl.py = 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.cam.snap(52, 2, 14);
});
await page.waitForTimeout(800);
await page.keyboard.press('KeyE');
await page.waitForTimeout(600);
await page.click('#open-starmap');
await page.waitForTimeout(1400);
const refused = await page.evaluate(() => {
  const g = window.__game;
  g.starmap.handleKey('KeyE'); // selected = current world by default
  return g.mode;
});
console.log('commit to current world refused:', refused === 'starmap' ? 'OK' : 'FAIL');
await page.screenshot({ path: OUT + '/sm-here.png' });

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
