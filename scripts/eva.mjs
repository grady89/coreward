// EVA rework: spot wrecks from a distance, then actually walk to them.
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

// park 6 tiles from a wreck in a carved gallery — well out of salvage reach
const spotted = await page.evaluate(async () => {
  const g = window.__game;
  // a wreck with room on both sides — edge-of-world ones have nowhere to walk
  const idx = g.terrain.wrecks.findIndex(w => w.x > 14 && w.x < 50);
  window.__wreckIdx = idx;
  const w = g.terrain.wrecks[idx];
  // open a corridor so there is somewhere to walk — and floor it, because a
  // natural cave under the gallery drops the pilot a row and strands the walk
  for (let x = w.x - 10; x <= w.x + 10; x++) {
    for (let y = w.y - 3; y <= w.y; y++) g.terrain.carve(x, y);
    const fi = g.terrain.idx(x, w.y + 1);
    if (g.terrain.data[fi] === 0 /* T.AIR */) {
      g.terrain.data[fi] = 2; /* T.ROCK */
      g.chunks.markDirty(x, w.y + 1);
    }
  }
  g.ctrl.drilling = null;
  g.ctrl.px = w.x + 0.5 - 6; g.ctrl.py = -(w.y + 1) + 0.42;
  g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.state.hull = 100000;
  g.cam.snap(g.ctrl.px, g.ctrl.py, 13);
  await new Promise(r => setTimeout(r, 900));
  return {
    near: g.ctrl.wreckNear,
    dist: +g.ctrl.wreckDist.toFixed(1),
    prompt: document.querySelector('#prompt')?.textContent,
  };
});
console.log('spotted from range:', JSON.stringify(spotted),
  spotted.near >= 0 && spotted.dist > 4 ? 'OK' : 'FAIL');

// EVA: the pilot must NOT be able to salvage from where they step out
const stepOut = await page.evaluate(async () => {
  const g = window.__game;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
  await new Promise(r => setTimeout(r, 700));
  const podX = g.ctrl.px;
  return {
    mode: g.mode,
    pilotX: +g.pilot.px.toFixed(2),
    offsetFromPod: +(g.pilot.px - podX).toFixed(2),
    canSalvageImmediately: g.wreckAtPilot() >= 0,
    prompt: document.querySelector('#prompt')?.textContent,
  };
});
console.log('stepped out:', JSON.stringify(stepOut),
  stepOut.mode === 'eva' && !stepOut.canSalvageImmediately && Math.abs(stepOut.offsetFromPod) > 0.5
    ? 'OK — must walk' : 'FAIL');
await page.screenshot({ path: OUT + '/e-stepped-out.png' });

// pressing E here should do nothing (nothing in reach)
const noopE = await page.evaluate(async () => {
  const g = window.__game;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
  await new Promise(r => setTimeout(r, 400));
  return { salvaging: !!g.salvaging, mode: g.mode };
});
console.log('E out of reach is a no-op:', JSON.stringify(noopE),
  !noopE.salvaging && noopE.mode === 'eva' ? 'OK' : 'FAIL');

// walk to the wreck
const walked = await page.evaluate(async () => {
  const g = window.__game;
  const w = g.terrain.wrecks[window.__wreckIdx];
  const dir = w.x + 0.5 > g.pilot.px ? 'ArrowRight' : 'ArrowLeft';
  const startX = g.pilot.px;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: dir }));
  let arrived = false;
  for (let i = 0; i < 90; i++) {
    await new Promise(r => setTimeout(r, 100));
    if (g.wreckAtPilot() >= 0) { arrived = true; break; }
  }
  window.dispatchEvent(new KeyboardEvent('keyup', { code: dir }));
  return {
    arrived, startX: +startX.toFixed(1), endX: +g.pilot.px.toFixed(1),
    walked: +Math.abs(g.pilot.px - startX).toFixed(1),
    o2: Math.round(g.pilot.o2),
  };
});
console.log('walked to it:', JSON.stringify(walked),
  walked.arrived && walked.walked > 3 ? 'OK' : 'FAIL');
await page.screenshot({ path: OUT + '/e-at-wreck.png' });

// now salvage
const salvaged = await page.evaluate(async () => {
  const g = window.__game;
  const before = g.state.wrecksSalvaged;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
  await new Promise(r => setTimeout(r, 5000));
  return { before, after: g.state.wrecksSalvaged, looted: g.looted.size };
});
console.log('salvaged after walking:', JSON.stringify(salvaged),
  salvaged.after > salvaged.before ? 'OK' : 'FAIL');

// oxygen still ticks the whole time
const o2 = await page.evaluate(() => Math.round(window.__game.pilot.o2));
console.log('oxygen remaining:', o2, o2 < 45 && o2 > 0 ? 'OK — clock ran' : 'FAIL');

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
