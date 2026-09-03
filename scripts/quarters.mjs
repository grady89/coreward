// THE QUARTERS (SPEC-KEEPING §2): dock, walk in, work the stations, find the
// wings sealed until the catalog sells the key, repaint the walls, step out.
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

// --- dock at home and walk in ---
await page.evaluate(() => {
  const g = window.__game;
  g.ctrl.drilling = null;
  g.ctrl.px = 7; g.ctrl.py = 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.cam.snap(7, 2, 14);
});
await page.waitForTimeout(500);
const prompt = await page.evaluate(() => window.__game.ctrl.dock?.key);
ok('the fifth dock', { dock: prompt }, prompt === 'quarters');
await key('KeyE');
await page.waitForTimeout(500);
const inside = await page.evaluate(() => ({
  mode: window.__game.mode,
  chrome: !!document.querySelector('#interior-hud'),
}));
ok('walked in', inside, inside.mode === 'interior' && inside.chrome);
await page.screenshot({ path: OUT + '/q-hall.png' });

// --- each station opens its panel at its post ---
const stations = [
  [4, 'ledger'], [8.5, 'transcript'], [12.5, 'faunalog'], [16, 'wardrobe'], [19.5, 'catalog'],
];
for (const [x, want] of stations) {
  const r = await page.evaluate(async ([sx]) => {
    const g = window.__game;
    g.interior.px = sx; g.interior.vx = 0;
    await new Promise(res => setTimeout(res, 150));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE' }));
    await new Promise(res => setTimeout(res, 250));
    const open = g.panels.current;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Escape' }));
    await new Promise(res => setTimeout(res, 150));
    return { open, after: g.panels.current, mode: g.mode };
  }, [x]);
  ok(`station ${want}`, r, r.open === want && r.after === null && r.mode === 'interior');
}

// --- the east door is sealed until the catalog sells the key ---
const sealed = await page.evaluate(() => ({
  sealed: window.__game.interior.stations.some(s => s.label.includes('SEALED — THE GALLERY')),
}));
ok('gallery sealed', sealed, sealed.sealed);
const opened = await page.evaluate(async () => {
  const g = window.__game;
  g.meta.keeplight = 2000;
  g.panels.open('catalog');
  document.querySelector('button[data-buy="wing-gallery"]')?.click();
  g.panels.close();
  await new Promise(res => setTimeout(res, 200));
  return {
    sealed: g.interior.stations.some(s => s.label.includes('SEALED — THE GALLERY')),
    vivariumNext: g.interior.stations.some(s => s.label.includes('SEALED — THE VIVARIUM')),
  };
});
ok('the key works', opened, !opened.sealed && opened.vivariumNext);
await page.screenshot({ path: OUT + '/q-gallery.png' });

// --- repaint: the walls take the palette immediately ---
const paint = await page.evaluate(() => {
  const g = window.__game;
  g.meta.keeplight = 1000;
  g.panels.open('catalog');
  document.querySelector('button[data-palette="slate"]')?.click();
  g.panels.close();
  return { palette: g.meta.palette, wall: g.interior.wallMat.color.getHex() };
});
ok('repaint', paint, paint.palette === 'slate' && paint.wall === 0x64707c);

// --- a furnishing appears at its home ---
const bunk = await page.evaluate(() => {
  const g = window.__game;
  g.meta.keeplight = 1000;
  g.panels.open('catalog');
  document.querySelector('button[data-buy="bunk"]')?.click();
  g.panels.close();
  return { placed: g.meta.furnishings.includes('bunk') };
});
ok('furnishing', bunk, bunk.placed);

// --- step out at the door: back in the pod, at the dock ---
const out = await page.evaluate(async () => {
  const g = window.__game;
  g.interior.px = 1.2; g.interior.vx = 0;
  await new Promise(res => setTimeout(res, 150));
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE' }));
  await new Promise(res => setTimeout(res, 300));
  return { mode: g.mode, interior: g.interior === null };
});
ok('stepped out', out, out.mode === 'play' && out.interior);

// --- Esc from anywhere inside also leaves ---
await key('KeyE');
await page.waitForTimeout(400);
await key('Escape');
await page.waitForTimeout(300);
const esc = await page.evaluate(() => ({ mode: window.__game.mode }));
ok('esc leaves', esc, esc.mode === 'play');

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
