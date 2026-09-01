import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto('http://localhost:4173');
await page.waitForTimeout(2500);
await page.evaluate(() => localStorage.clear());
await page.click('#t-new');
await page.waitForTimeout(3600);

console.log(await page.evaluate(async () => {
  const g = window.__game;
  // carve a chamber and hold the pod inside it
  for (let y = 100; y < 112; y++) for (let x = 20; x < 40; x++) g.terrain.carve(x, y);
  g.ctrl.px = 30.5; g.ctrl.py = -111 + 0.42;
  g.state.hull = 100000; g.state.charges = 3;
  await new Promise(r => setTimeout(r, 300));

  const out = {};
  // 1) direct detonate call
  const x = 30.5, y = -105.5;
  out.beforeDirect = g.terrain.get(30, 105);
  g.detonate(x, y);
  out.afterDirect = g.terrain.get(30, 105);

  // 2) via the fuse path
  const before = g.charges.length;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyG' }));
  out.queued = g.charges.length - before;
  out.chargeAt = g.charges[0] ? { x: +g.charges[0].x.toFixed(1), y: +g.charges[0].y.toFixed(1), fuse: +g.charges[0].fuse.toFixed(2) } : null;
  await new Promise(r => setTimeout(r, 1500));
  out.fuseAfter1_5s = g.charges[0] ? +g.charges[0].fuse.toFixed(2) : 'detonated';
  await new Promise(r => setTimeout(r, 4000));
  out.remaining = g.charges.length;
  out.mode = g.mode;
  out.panel = g.panels.current;
  return JSON.stringify(out);
}));
await browser.close();
