// Art review renders for THE KEEPING: the quarters exterior (via the
// structures-review stage on the DEV server), the interior hall/gallery/
// vivarium, and a pod-finish lineup (via the BUILT game on the preview
// server). Usage: dev server on :5173 + preview on :4173, then
//   node scripts/artreview.mjs design-review
import { chromium } from 'playwright';

const OUT = process.argv[2] ?? 'design-review';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));

// --- the structure, alone and in the colony strip ---
for (const s of ['quarters', 'all']) {
  await page.goto(`http://localhost:5173/structures-review.html?s=${s}`);
  await page.waitForFunction(() => document.title.startsWith('READY:'));
  await page.screenshot({ path: `${OUT}/${s === 'all' ? 'colony-strip' : 'quarters'}.png` });
  console.log('rendered', s);
}

// --- the interior, fully kept: wings open, furnished, stocked ---
await page.goto('http://localhost:4173');
await page.waitForTimeout(2500);
await page.evaluate(() => localStorage.clear());
await page.click('#t-new');
await page.waitForTimeout(3600);
await page.evaluate(() => {
  const g = window.__game;
  const defs = window.__TILE_DEFS;
  g.meta.furnishings = ['wing-gallery', 'wing-vivarium',
    'rug', 'lamp', 'plant', 'bunk', 'galley', 'shelf', 'radio', 'chart'];
  g.meta.sponsored = ['glimmerflies', 'longone', 'mimic', 'rimewings', 'brinewyrm',
    'polyps', 'riptide', 'shellbacks', 'warden', 'kindled'];
  const gems = Object.keys(defs).filter(k => defs[k].ore && defs[k].gem).map(Number)
    .sort((a, b) => defs[b].value - defs[a].value).slice(0, 5);
  g.meta.trophies = gems.map((t, i) => ({ t, grade: i === 0 ? 2 : 1, world: 'veil3' }));
  g.ctrl.drilling = null;
  g.ctrl.px = 7; g.ctrl.py = 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
});
await page.waitForTimeout(400);
await page.keyboard.press('KeyE');
await page.waitForTimeout(600);
for (const [name, x] of [['interior-hall', 9], ['interior-gallery', 29], ['interior-vivarium', 41]]) {
  await page.evaluate(px => {
    const g = window.__game;
    g.interior.px = px; g.interior.vx = 0;
  }, x);
  await page.waitForTimeout(1400);   // let the camera ease over
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('rendered', name);
}
await page.keyboard.press('Escape');
await page.waitForTimeout(500);

// --- pod finishes, up close on the pad ---
const finishes = [
  ['stock', '', '', ''],
  ['jade', 'jade', 'teal', 'veined'],
  ['duskcamo', 'duskcamo', 'ember', 'sodium'],
  ['prism', 'prism', 'white', 'moon'],
];
for (const [name, rig, flame, lamp] of finishes) {
  await page.evaluate(([r, f, l]) => {
    const g = window.__game;
    g.meta.finishRig = r; g.meta.flame = f; g.meta.lampTint = l;
    g.applyKeeping();   // the same seam the wardrobe uses
    g.ctrl.drilling = null;
    g.ctrl.px = 14; g.ctrl.py = 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
    g.cam.snap(14, 1.2, 4.2);
  }, [rig, flame, lamp]);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/pod-${name}.png`, clip: { x: 340, y: 140, width: 600, height: 520 } });
  console.log('rendered pod', name);
}

await browser.close();
console.log('done →', OUT);
