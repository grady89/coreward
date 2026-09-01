// Headless smoke test: boots the game, starts a run, drills, reports state.
import { chromium } from 'playwright';

const OUT = process.argv[2] ?? '.';
const URL = 'http://localhost:4173';

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

await page.goto(URL);
await page.waitForTimeout(3000);
await page.screenshot({ path: OUT + '/1-title.png' });

// start a new run
await page.evaluate(() => localStorage.clear());
await page.click('#t-new');
await page.waitForTimeout(3500);
await page.screenshot({ path: OUT + '/2-surface.png' });

// state after intro
const s1 = await page.evaluate(() => {
  const g = window.__game;
  return { mode: g.mode, px: g.ctrl.px, py: g.ctrl.py, fuel: g.state.fuel, grounded: g.ctrl.grounded };
});
console.log('after intro:', JSON.stringify(s1));

// step off the protected landing pad (left, away from dock foundations)
await page.keyboard.down('ArrowLeft');
await page.waitForTimeout(1100);
await page.keyboard.up('ArrowLeft');
await page.waitForTimeout(600);
await page.keyboard.down('ArrowDown');
await page.waitForTimeout(6000);
await page.keyboard.up('ArrowDown');
await page.waitForTimeout(600);
await page.screenshot({ path: OUT + '/3-dug.png' });

const s2 = await page.evaluate(() => {
  const g = window.__game;
  return {
    mode: g.mode, py: +g.ctrl.py.toFixed(2), depthM: g.ctrl.depthM,
    fuel: +g.state.fuel.toFixed(1), blocksDug: g.state.blocksDug,
    cargo: g.state.cargoCount, money: g.state.money, hull: +g.state.hull.toFixed(1),
  };
});
console.log('after digging:', JSON.stringify(s2));

// fly back up
await page.keyboard.down('ArrowUp');
await page.waitForTimeout(2500);
await page.keyboard.up('ArrowUp');
await page.screenshot({ path: OUT + '/4-fly.png' });

const s3 = await page.evaluate(() => {
  const g = window.__game;
  return { py: +g.ctrl.py.toFixed(2), fuel: +g.state.fuel.toFixed(1) };
});
console.log('after flying:', JSON.stringify(s3));

// fps probe
const fps = await page.evaluate(() => new Promise(res => {
  let frames = 0;
  const t0 = performance.now();
  const tick = () => { frames++; if (performance.now() - t0 < 2000) requestAnimationFrame(tick); else res(Math.round(frames / 2)); };
  requestAnimationFrame(tick);
}));
console.log('fps:', fps);

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
