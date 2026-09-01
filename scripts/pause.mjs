// Opening a panel must freeze the whole world, not just the physics.
import { chromium } from 'playwright';

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 700 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

await page.goto('http://localhost:4173');
await page.waitForTimeout(2500);
await page.evaluate(() => localStorage.clear());
await page.click('#t-new');
await page.waitForTimeout(3600);

// drop the pod into open air so it would obviously keep moving if unpaused
const res = await page.evaluate(async () => {
  const g = window.__game;
  for (let y = 20; y < 90; y++) { g.terrain.carve(26, y); g.terrain.carve(27, y); }
  g.ctrl.px = 26.5; g.ctrl.py = -25; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.comms.say(['A long line of dispatch chatter that would keep typing.']);
  await new Promise(r => setTimeout(r, 500));

  // open the pause menu mid-fall
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
  await new Promise(r => setTimeout(r, 300));
  const before = {
    panel: g.panels.current,
    py: +g.ctrl.py.toFixed(3),
    time: +g.time.toFixed(3),
    comms: document.querySelector('.comms-text')?.textContent ?? '',
  };
  await new Promise(r => setTimeout(r, 2000));
  const after = {
    py: +g.ctrl.py.toFixed(3),
    time: +g.time.toFixed(3),
    comms: document.querySelector('.comms-text')?.textContent ?? '',
  };

  // resume and confirm it starts moving again without a time jump
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
  await new Promise(r => setTimeout(r, 500));
  const resumed = { py: +g.ctrl.py.toFixed(3), time: +g.time.toFixed(3), panel: g.panels.current };
  return { before, after, resumed };
});

const frozenPos = res.before.py === res.after.py;
const frozenTime = res.before.time === res.after.time;
const frozenComms = res.before.comms === res.after.comms;
console.log('paused:', JSON.stringify(res.before));
console.log('after 2s:', JSON.stringify(res.after));
console.log('position frozen:', frozenPos ? 'OK' : 'FAIL');
console.log('clock frozen:', frozenTime ? 'OK' : 'FAIL');
console.log('dispatch frozen:', frozenComms ? 'OK' : 'FAIL');

const jump = res.resumed.time - res.after.time;
console.log('resumed:', JSON.stringify(res.resumed),
  res.resumed.panel === null && res.resumed.py < res.after.py && jump < 1.2
    ? 'OK — moving again, no time jump' : 'FAIL');

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
