// The Nine Stones wake under a standing pilot: the light crawls the strokes
// in the world's own hue, the point of light catches last, and only a mark
// that has finished taking will let you step in.
//
// Headless renders slowly and the loop clamps dt to 50ms, so sim-time runs
// well behind wall-clock — every wait here polls the sim, never the clock.
import { chromium } from 'playwright';

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
const ok = (name, data, pass) => { console.log(`${name}:`, JSON.stringify(data), pass ? 'OK' : 'FAIL'); if (!pass) failed++; };
let failed = 0;

const until = (fn, arg, label) => page.waitForFunction(fn, arg, { timeout: 25000, polling: 100 })
  .catch(() => { throw new Error('timed out waiting for ' + label); });

await page.goto('http://localhost:4173/?vault');
await page.waitForTimeout(4200);

const id = await page.evaluate(() => window.__game.terrain.glyphStones.find(s => s.id === 'shift').id);
const away = () => page.evaluate(() => { const g = window.__game; g.pilot.px = g.terrain.glyphStones.find(s => s.id === 'shift').x - 12; });
const onStone = () => page.evaluate(() => {
  const g = window.__game, s = g.terrain.glyphStones.find(x => x.id === 'shift');
  g.pilot.px = s.x + 0.5; g.pilot.py = -(s.y + 0.5) + 0.6;
});
const charge = () => page.evaluate(i => window.__game.glyphMarks.chargeOf(i), id);

// --- cold: the carving reads, but nothing on it is alight ---
await away();
await until(i => window.__game.glyphMarks.chargeOf(i) === 0, id, 'cold');
const cold = await page.evaluate(i => {
  const m = window.__game.glyphMarks.marks.find(x => x.id === i);
  const dot = m.mesh.getObjectByName('glyph-light');
  const bright = m.mesh.children.filter(c => c.name !== 'glyph-light' && c.material?.opacity > 0.9);
  return { charge: m.charge, anyLit: bright.some(b => b.visible), dot: dot ? dot.visible : 'none' };
}, id);
ok('cold', cold, cold.charge === 0 && cold.anyLit === false && cold.dot === false);

// --- stand on it: the light crawls, some bars lit, one mid-draw ---
await onStone();
await until(i => window.__game.glyphMarks.chargeOf(i) > 0.25, id, 'crawl');
const crawl = await page.evaluate(i => {
  const g = window.__game, m = g.glyphMarks.marks.find(x => x.id === i);
  const bright = m.mesh.children.filter(c => c.name !== 'glyph-light' && c.material?.opacity > 0.9);
  const dot = m.mesh.getObjectByName('glyph-light');
  return {
    charge: +m.charge.toFixed(2),
    drawn: bright.filter(b => b.visible).length,
    ofBars: bright.length,
    partial: bright.some(b => b.visible && (b.scale.x < 0.99 || b.scale.y < 0.99)),
    dotStillDark: dot ? !dot.visible : 'none',
    prompt: document.querySelector('#prompt')?.textContent ?? '',
  };
}, id);
ok('crawl', crawl, crawl.charge < 1 && crawl.ofBars === 7 && crawl.drawn > 0 && crawl.drawn < 7 && crawl.partial === true
  && crawl.dotStillDark === true && crawl.prompt.includes('TAKING'));

// --- E while it is still taking knocks on stone ---
await page.keyboard.press('KeyE');
await page.waitForTimeout(400);
ok('early-E', { mode: await page.evaluate(() => window.__game.mode) },
  await page.evaluate(() => window.__game.mode) === 'eva');

// --- let it finish: every bar drawn, the point of light caught, E works ---
await until(i => window.__game.glyphMarks.chargeOf(i) >= 1, id, 'full charge');
const lit = await page.evaluate(i => {
  const g = window.__game, m = g.glyphMarks.marks.find(x => x.id === i);
  const bright = m.mesh.children.filter(c => c.name !== 'glyph-light' && c.material?.opacity > 0.9);
  const dot = m.mesh.getObjectByName('glyph-light');
  return {
    charge: m.charge,
    allDrawn: bright.every(b => b.visible && b.scale.x > 0.99 && b.scale.y > 0.99),
    dotLit: !!dot && dot.visible && dot.material.opacity > 0.9,
    prompt: document.querySelector('#prompt')?.textContent ?? '',
  };
}, id);
ok('lit', lit, lit.charge === 1 && lit.allDrawn && lit.dotLit && lit.prompt.includes('STEP INTO'));

await page.keyboard.press('KeyE');
await until(() => window.__game.mode === 'vault', null, 'vault entry');
ok('entered', { mode: 'vault' }, true);
await page.keyboard.press('Escape');
await until(() => window.__game.mode === 'eva', null, 'vault exit');

// --- step away and the stone goes cold again ---
await away();
await until(i => window.__game.glyphMarks.chargeOf(i) === 0, id, 'cooldown');
ok('cooled', { charge: await charge() }, (await charge()) === 0);

// --- a translated stone is lit before you ever walk to it, and stays lit ---
const kept = await page.evaluate(i => {
  const g = window.__game;
  g.state.glyphsSet.add(i);
  g.glyphMarks.build(g.terrain.glyphStones, 0xff7a24, g.state.glyphsSet);
  const m = g.glyphMarks.marks.find(x => x.id === i);
  return { charge: m.charge, done: m.done };
}, id);
ok('translated', kept, kept.charge === 1 && kept.done === true);

// --- the hue is the world's own, and a spent world's stones wake gray ---
const hue = await page.evaluate(() => {
  const m = window.__game.glyphMarks.marks.find(x => x.id === 'shift').mesh;
  const bright = m.children.find(c => c.name !== 'glyph-light' && c.material?.opacity > 0.9);
  const carve = m.children.find(c => c.material && c.material.opacity === 0.5);
  return { bright: bright.material.color.getHexString(), carve: carve.material.color.getHexString() };
});
ok('hue', hue, hue.bright === 'ff7a24' && hue.carve !== 'ff7a24');

console.log('errors:', errors.length ? errors : 'none');
await browser.close();
process.exit(failed ? 1 : 0);
