// Stillwalker review renders: the standalone stage on the dev server, then
// the in-game sandbox. Usage: node swshots.mjs <outdir> [stage|game|all]
import { chromium } from 'playwright';

const OUT = process.argv[2] ?? 'design-review';
const WHICH = process.argv[3] ?? 'all';
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('CONSOLE:', m.text().slice(0, 300)); });

if (WHICH === 'stage' || WHICH === 'all') {
  for (const s of ['lineup', 'lit', 'hunt', 'rock', 'closeup', 'walk']) {
    await page.goto(`http://localhost:5173/stillwalker-review.html?shot=${s}`);
    await page.waitForFunction(() => document.title.startsWith('READY:'), null, { timeout: 30000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/stillwalker-v2-${s}.png` });
    console.log('rendered', s);
  }
}

if (WHICH === 'game' || WHICH === 'all') {
  await page.goto('http://localhost:5173/?fauna=stillwalkers');
  await page.waitForFunction(() => window.__game && window.__game.threats && window.__game.threats.stillwalkers, null, { timeout: 30000 });
  // CRYOS-2 heals carved rooms over within seconds; hold that off before the stage settles
  await page.evaluate(() => { window.__game.refreezeTick = () => {}; });
  // let the stage take
  await page.waitForFunction(() => window.__game.threats.stillwalkers.walkers.some(w => w.alive), null, { timeout: 30000 });
  await page.evaluate(() => { window.__game.hud.clearToasts?.(); });
  // it spawns in the rock ~11 tiles out; lit + faced it holds. Face it and shoot.
  await page.evaluate(() => {
    const g = window.__game;
    g.state.hull = 100000; g.state.maxHull = 100000;
    const w = g.threats.stillwalkers.walkers.find(w => w.alive);
    g.ctrl.facing = w.x > g.ctrl.px ? 1 : -1;
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/stillwalker-v2-game-rock.png` });
  console.log('rendered game-rock');
  // the natural spawn wades up through the floor into the pod, so for the
  // open-floor shots stand it on the room floor six tiles out, faced and lit
  await page.evaluate(() => {
    const g = window.__game;
    const w = g.threats.stillwalkers.walkers.find(w => w.alive);
    w.x = g.ctrl.px + 6; w.y = -346 + 1.6; w.inRock = false; w.life = 0;
    g.ctrl.facing = 1;
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/stillwalker-v2-game-held.png` });
  console.log('rendered game-held');
  // lamp off: it walks. Shoot it mid-floor.
  await page.keyboard.press('KeyF');
  await page.waitForFunction(() => {
    const g = window.__game;
    g.state.hull = 100000;
    const w = g.threats.stillwalkers.walkers.find(w => w.alive);
    return w && Math.abs(w.x - g.ctrl.px) < 4.2;
  }, null, { timeout: 30000 }).catch(() => console.log('walker never closed in time'));
  await page.screenshot({ path: `${OUT}/stillwalker-v2-game-hunt.png` });
  console.log('rendered game-hunt');
  // lamp back on: held again, and a closer look
  await page.keyboard.press('KeyF');
  await page.evaluate(() => {
    const g = window.__game;
    const w = g.threats.stillwalkers.walkers.find(w => w.alive);
    if (w) g.cam.snap((w.x + g.ctrl.px) / 2, w.y, 7);
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/stillwalker-v2-game-close.png` });
  console.log('rendered game-close');
}

await browser.close();
console.log('done →', OUT);
