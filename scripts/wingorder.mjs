// The wings open west-to-east: the catalog must not sell THE VIVARIUM before
// THE GALLERY exists, because the corridor can't reach it.
import { chromium } from 'playwright';

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
const ok = (name, data, pass) => console.log(`${name}:`, JSON.stringify(data), pass ? 'OK' : 'FAIL');

await page.goto('http://localhost:4173');
await page.waitForTimeout(2500);
await page.evaluate(() => localStorage.clear());
await page.click('#t-new');
await page.waitForTimeout(3600);

const read = () => page.evaluate(() => {
  const g = window.__game;
  g.panels.open('catalog');
  const rowOf = name => [...document.querySelectorAll('.row')]
    .find(r => r.querySelector('.r-name')?.textContent.trim() === name);
  const state = el => ({
    btn: el.querySelector('button[data-buy]') ? el.querySelector('button[data-buy]').textContent.trim() : null,
    val: el.querySelector('.r-val')?.textContent.trim() ?? null,
  });
  const r = { gallery: state(rowOf('THE GALLERY')), vivarium: state(rowOf('THE VIVARIUM')) };
  g.panels.close();
  return r;
});

// --- with light to spare and no wings, the vivarium is withheld, not sold ---
await page.evaluate(() => { window.__game.meta.keeplight = 3000; });
const locked = await read();
ok('locked', locked, locked.vivarium.btn === null
  && locked.vivarium.val === 'REQUIRES THE GALLERY' && locked.gallery.btn !== null);

// --- a forced click can't buy past the gate either ---
const forced = await page.evaluate(() => {
  const g = window.__game;
  g.panels.open('catalog');
  document.querySelector('button[data-buy="wing-vivarium"]')?.click();
  const r = { owned: g.meta.furnishings.includes('wing-vivarium'), keep: g.meta.keeplight };
  g.panels.close();
  return r;
});
ok('forced', forced, forced.owned === false && forced.keep === 3000);

// --- build the gallery and the vivarium goes on sale ---
const opened = await page.evaluate(() => {
  const g = window.__game;
  g.panels.open('catalog');
  document.querySelector('button[data-buy="wing-gallery"]').click();
  const btn = document.querySelector('button[data-buy="wing-vivarium"]');
  const r = { forSale: !!btn, price: btn?.textContent.trim(), keep: g.meta.keeplight };
  g.panels.close();
  return r;
});
ok('opened', opened, opened.forSale === true && opened.keep === 2200);

// --- both built: the room actually runs east to the far wing ---
const built = await page.evaluate(() => {
  const g = window.__game;
  g.panels.open('catalog');
  document.querySelector('button[data-buy="wing-vivarium"]').click();
  const r = {
    owned: g.meta.furnishings.filter(f => f.startsWith('wing-')),
    keep: g.meta.keeplight,
    vals: [...document.querySelectorAll('.row')]
      .filter(x => ['THE GALLERY', 'THE VIVARIUM'].includes(x.querySelector('.r-name')?.textContent.trim()))
      .map(x => x.querySelector('.r-val')?.textContent.trim()),
  };
  g.panels.close();
  return r;
});
ok('built', built, built.keep === 1400 && built.owned.length === 2
  && built.vals.join(',') === 'BUILT,BUILT');

// --- a legacy save that paid for the vivarium alone is told the truth ---
const legacy = await page.evaluate(() => {
  const g = window.__game;
  g.meta.furnishings = g.meta.furnishings.filter(f => f !== 'wing-gallery');
  g.panels.open('faunalog');
  const sub = document.querySelector('.tx-sub').textContent;
  const r = { farWing: sub.includes('stand in the far wing'), told: sub.includes('once THE VIVARIUM is built') };
  g.panels.close();
  return r;
});
ok('legacy', legacy, legacy.farWing === false && legacy.told === true);

console.log('errors:', errors.length ? errors : 'none');
await browser.close();
