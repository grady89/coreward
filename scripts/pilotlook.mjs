// Look at the pilot: portrait, gameplay distance, and mid-stride, against a
// carved corridor. Geometry review only — behaviour lives in eva.mjs.
import { chromium } from 'playwright';

const OUT = process.argv[2] ?? '.';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));

await page.goto('http://localhost:4173');
await page.waitForTimeout(2500);
await page.evaluate(() => localStorage.clear());
await page.click('#t-new');
await page.waitForTimeout(3600);

// carve a flat corridor under the surface and step out into it
await page.evaluate(async () => {
  const g = window.__game;
  const x0 = 24, y0 = 30;
  for (let x = x0 - 12; x <= x0 + 12; x++) {
    for (let y = y0 - 4; y <= y0; y++) g.terrain.carve(x, y);
    const fi = g.terrain.idx(x, y0 + 1);
    if (g.terrain.data[fi] === 0) { g.terrain.data[fi] = 2; g.chunks.markDirty(x, y0 + 1); }
  }
  g.ctrl.drilling = null;
  g.ctrl.px = x0 + 0.5; g.ctrl.py = -(y0) + 0.42;
  g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.state.hull = 100000;
  g.cam.snap(g.ctrl.px, g.ctrl.py, 13);
});
// let the pod settle on the floor — EVA only opens from a grounded pod
await page.waitForTimeout(1800);
console.log('pod grounded:', await page.evaluate(() => window.__game.ctrl.grounded));
// no wreck out here to justify a hatch, so open the EVA directly
await page.evaluate(() => window.__game.enterEva());
await page.waitForTimeout(1200);

// follow() re-frames every tick, so a close portrait needs it held off
const shot = async (name, z, freeze) => {
  await page.evaluate(({ z, freeze }) => {
    const g = window.__game;
    if (freeze) { if (!g.cam.__follow) g.cam.__follow = g.cam.follow; g.cam.follow = () => {}; }
    else if (g.cam.__follow) g.cam.follow = g.cam.__follow;
    g.cam.snap(g.pilot.px, g.pilot.py, z);
    g.cam.camera.lookAt(g.pilot.px, g.pilot.py, 0);
  }, { z, freeze });
  await page.waitForTimeout(freeze ? 260 : 700);
  await page.screenshot({ path: `${OUT}/pilot-${name}.png` });
  console.log('shot:', name);
};

await shot('portrait', 1.15, true);   // face-on, fills the frame
await shot('gameplay', 13, false);    // what the player actually sees

// mid-stride, walking right
await page.keyboard.down('ArrowRight');
await page.waitForTimeout(420);
await page.evaluate(() => {
  const g = window.__game;
  if (!g.cam.__follow) g.cam.__follow = g.cam.follow;
  g.cam.follow = () => {};
  g.cam.snap(g.pilot.px, g.pilot.py, 1.5);
  g.cam.camera.lookAt(g.pilot.px, g.pilot.py, 0);
});
await page.waitForTimeout(120);
await page.screenshot({ path: `${OUT}/pilot-stride.png` });
await page.keyboard.up('ArrowRight');
console.log('shot: stride');

console.log(await page.evaluate(() => {
  const g = window.__game;
  return JSON.stringify({ mode: g.mode, grounded: g.pilot.grounded, o2: +g.pilot.o2.toFixed(1), visible: g.pilot.group.visible, parts: g.pilot.group.children.length });
}));
await browser.close();
