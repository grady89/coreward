import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto('http://localhost:4173');
await page.waitForTimeout(2500);
await page.evaluate(() => localStorage.clear());
await page.click('#t-new');
await page.waitForTimeout(3200);
await page.evaluate(() => {
  const g = window.__game;
  const w = g.terrain.wrecks[0];
  g.ctrl.px = w.x + 0.5;
  g.ctrl.py = -(w.y + 1) + 0.42;
  g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.cam.snap(g.ctrl.px, g.ctrl.py, 12.5);
});
await page.waitForTimeout(700);
console.log(await page.evaluate(() => {
  const g = window.__game;
  const w = g.terrain.wrecks[0];
  return JSON.stringify({ wreck: w, podX: g.ctrl.px, podY: +g.ctrl.py.toFixed(2), grounded: g.ctrl.grounded, near: g.ctrl.wreckNear, mode: g.mode });
}));
await page.keyboard.press('KeyE');
await page.waitForTimeout(500);
console.log(await page.evaluate(() => {
  const g = window.__game;
  return JSON.stringify({ mode: g.mode, pilotX: +g.pilot.px.toFixed(2), pilotY: +g.pilot.py.toFixed(2), pilotGrounded: g.pilot.grounded, o2: +g.pilot.o2.toFixed(1), wreckAt: g.wreckAtPilot() });
}));
await page.keyboard.press('KeyE');
await page.waitForTimeout(300);
console.log(await page.evaluate(() => JSON.stringify({ salvaging: window.__game.salvaging, mode: window.__game.mode })));
await page.waitForTimeout(2000);
console.log(await page.evaluate(() => {
  const g = window.__game;
  return JSON.stringify({ salvaging: g.salvaging, looted: [...g.looted], money: g.state.money, cargo: g.state.cargoCount, logs: g.state.foundLogs.size });
}));
await browser.close();
