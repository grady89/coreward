// Map zoom + Deep Array ore overlay.
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
await page.waitForTimeout(3400);

// grant scanner + depth so there is something to look at
await page.evaluate(() => {
  const g = window.__game;
  g.state.hasScanner = true;
  g.state.money = 40000;
  g.state.worldBestRow = 200;
  g.state.bestDepthM = 400;
  for (let y = 4; y < 120; y++) g.terrain.carve(26, y);
  for (let x = 20; x < 34; x++) g.terrain.carve(x, 60);
  g.ctrl.px = 26.5; g.ctrl.py = -80; g.ctrl.vy = 0;
  g.cam.snap(26.5, -80, 12.5);
});
await page.waitForTimeout(900);
await page.keyboard.press('Tab');
await page.waitForTimeout(900);
await page.screenshot({ path: OUT + '/z-full.png' });
const z0 = await page.evaluate(() => window.__game.map.zoom);

// zoom in twice with the + key
await page.keyboard.press('Equal');
await page.waitForTimeout(600);
await page.keyboard.press('Equal');
await page.waitForTimeout(900);
await page.screenshot({ path: OUT + '/z-in.png' });
const z2 = await page.evaluate(() => ({ zoom: window.__game.map.zoom, h: document.querySelector('#survey canvas').height }));
console.log('zoom in:', z0, '->', JSON.stringify(z2), z2.zoom === 2 && z2.h === 96 ? 'OK' : 'FAIL');

// wheel zooms too
await page.evaluate(() => {
  document.querySelector('#survey').dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true }));
});
await page.waitForTimeout(600);
const z3 = await page.evaluate(() => window.__game.map.zoom);
console.log('wheel zoom:', z3, z3 === 3 ? 'OK' : 'FAIL');

// zoom back out with minus
await page.keyboard.press('Minus');
await page.keyboard.press('Minus');
await page.keyboard.press('Minus');
await page.waitForTimeout(700);
const zOut = await page.evaluate(() => window.__game.map.zoom);
console.log('zoom out clamps:', zOut, zOut === 0 ? 'OK' : 'FAIL');

// deep array purchase paints ore
await page.keyboard.press('Tab');
await page.waitForTimeout(300);
await page.evaluate(() => {
  const g = window.__game;
  g.ctrl.px = 52; g.ctrl.py = 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.cam.snap(52, 2, 14);
});
await page.waitForTimeout(800);
await page.keyboard.press('KeyE');
await page.waitForTimeout(700);
await page.screenshot({ path: OUT + '/z-assay.png' });
await page.click('#buy-array');
await page.waitForTimeout(500);
const bought = await page.evaluate(() => window.__game.state.hasDeepArray);
console.log('deep array bought:', bought ? 'OK' : 'FAIL');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await page.evaluate(() => {
  const g = window.__game;
  g.ctrl.px = 26.5; g.ctrl.py = -80;
  g.cam.snap(26.5, -80, 12.5);
});
await page.waitForTimeout(600);
await page.keyboard.press('Tab');
await page.waitForTimeout(500);
await page.keyboard.press('Equal');
await page.keyboard.press('Equal');
await page.waitForTimeout(900);
await page.screenshot({ path: OUT + '/z-ore.png' });

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
