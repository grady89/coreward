// THE GALLERY placards: one pedestal per mineral, ordered common → rare, each
// with a plate you can read with E or with a click — plus the right stick
// scrolling a long panel the way a wheel does.
import { chromium } from 'playwright';

const OUT = process.argv[2] ?? '.';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
const ok = (name, data, pass) => console.log(`${name}:`, JSON.stringify(data), pass ? 'OK' : 'FAIL');
const key = (code) => page.evaluate(c => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code: c }));
  window.dispatchEvent(new KeyboardEvent('keyup', { code: c }));
}, code);

await page.goto('http://localhost:4173');
await page.waitForTimeout(2500);
await page.evaluate(() => localStorage.clear());
await page.click('#t-new');
await page.waitForTimeout(3600);

// a gallery worth looking at: the wing, and one cut stone of every kind,
// stocked out of order on purpose so the ordering has something to do
await page.evaluate(() => {
  const g = window.__game;
  g.meta.furnishings.push('wing-gallery');
  g.meta.trophies = [
    { t: 16, grade: 1, world: 'veil3' },   // diamond
    { t: 10, grade: 1, world: 'veil3' },   // copper
    { t: 17, grade: 2, world: 'veil3' },   // embershard, flawless
    { t: 13, grade: 1, world: 'veil3' },   // gold
    { t: 13, grade: 2, world: 'veil3' },   // gold again, better cut
    { t: 14, grade: 1, world: 'veil3' },   // ruby
    { t: 15, grade: 2, world: 'veil3' },   // voidopal
    { t: 11, grade: 1, world: 'veil3' },   // iron
  ];
  g.ctrl.drilling = null;
  g.ctrl.px = 7; g.ctrl.py = 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.cam.snap(7, 2, 14);
});
await page.waitForTimeout(400);
await key('KeyE');
await page.waitForTimeout(700);

// --- the order on the plinths ---
const order = await page.evaluate(() => window.__game.interior.stations
  .filter(s => s.mineral !== undefined)
  .sort((a, b) => a.x - b.x)
  .map(s => ({ x: Math.round(s.x * 10) / 10, t: s.mineral, label: s.label })));
ok('common → rare, no repeats', order.map(o => o.t),
  JSON.stringify(order.map(o => o.t)) === JSON.stringify([11, 13, 14, 15, 16, 17]));

// --- the plates are there and carry their stone ---
const plates = await page.evaluate(() => window.__game.interior.placards.map(p => p.userData.mineral));
ok('a placard per stone', plates, plates.length === 6);

// --- walk up and press E ---
const read = await page.evaluate(async () => {
  const g = window.__game;
  g.interior.px = g.interior.stations.find(s => s.mineral === 14).x;
  await new Promise(r => setTimeout(r, 200));
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE' }));
  await new Promise(r => setTimeout(r, 250));
  const body = document.querySelector('#panel-body');
  return { open: g.panels.current, text: body ? body.innerText.replace(/\s+/g, ' ').slice(0, 400) : '' };
});
ok('E reads the plate', { open: read.open }, read.open === 'mineral' && read.text.includes('RUBY'));
console.log('   ' + read.text);
await page.screenshot({ path: OUT + '/pl-ruby-panel.png' });
await key('Escape');
await page.waitForTimeout(250);

// --- the gallery, seen ---
await page.evaluate(async () => {
  const g = window.__game;
  g.interior.px = 27.5;
  g.interior.cx = 27.5;
  await new Promise(r => setTimeout(r, 400));
});
await page.waitForTimeout(700);
await page.screenshot({ path: OUT + '/pl-gallery.png' });
await page.evaluate(() => { window.__game.interior.px = 32; window.__game.interior.cx = 32; });
await page.waitForTimeout(700);
await page.screenshot({ path: OUT + '/pl-gallery-east.png' });

// --- clicking a plate opens it ---
const click = await page.evaluate(async () => {
  const g = window.__game;
  const plate = g.interior.placards.find(p => p.userData.mineral === 17) ?? g.interior.placards[0];
  const v = plate.position.clone().project(g.interior.camera);
  const x = (v.x + 1) / 2 * innerWidth, y = (1 - v.y) / 2 * innerHeight;
  document.querySelector('canvas').dispatchEvent(new PointerEvent('pointerdown', {
    clientX: x, clientY: y, bubbles: true,
  }));
  await new Promise(r => setTimeout(r, 250));
  return { open: g.panels.current, t: plate.userData.mineral, onscreen: x > 0 && x < innerWidth };
});
ok('a click reads it too', click, click.open === 'mineral');
await page.screenshot({ path: OUT + '/pl-click-panel.png' });
await key('Escape');
await page.waitForTimeout(200);

// --- the last plinth must not swallow the sealed vivarium door beside it ---
const eastWall = await page.evaluate(async () => {
  const g = window.__game;
  g.interior.px = g.interior.maxX() - 0.2;
  await new Promise(r => setTimeout(r, 250));
  const near = g.interior.nearestStation();
  return { at: Math.round(g.interior.px * 100) / 100, label: near?.label ?? null };
});
ok('the east door is still findable', eastWall,
  (eastWall.label ?? '').includes('SEALED — THE VIVARIUM'));

// --- the right stick scrolls a long panel ---
const scrolled = await page.evaluate(async () => {
  const g = window.__game;
  g.panels.open('assay');
  await new Promise(r => setTimeout(r, 250));
  const pane = document.querySelector('.panel');
  const scrollable = pane.scrollHeight - pane.clientHeight;
  g.nav.sync(document.querySelector('.panel-scrim'));
  const start = pane.scrollTop;
  // one second of stick, in the same slices the frame loop would deliver
  for (let i = 0; i < 30; i++) g.nav.scroll(document.querySelector('.panel-scrim'), 1100 * (1 / 30));
  const down = pane.scrollTop;
  for (let i = 0; i < 60; i++) g.nav.scroll(document.querySelector('.panel-scrim'), -1100 * (1 / 30));
  return { scrollable, start, down, backUp: pane.scrollTop };
});
ok('right stick scrolls', scrolled,
  scrolled.scrollable > 0 && scrolled.down > scrolled.start && scrolled.backUp === 0);
await page.screenshot({ path: OUT + '/pl-assay-top.png' });
await page.evaluate(() => {
  const g = window.__game;
  for (let i = 0; i < 30; i++) g.nav.scroll(document.querySelector('.panel-scrim'), 1100 / 30);
});
await page.waitForTimeout(200);
await page.screenshot({ path: OUT + '/pl-assay-scrolled.png' });

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
