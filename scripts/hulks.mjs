// Wrecked pods are solid bodies: the rig lands on them, is stopped by them,
// shoulders them along an open shaft, and never falls through them. The pilot
// climbs on them but is far too small to move one.
import { chromium } from 'playwright';

const OUT = process.argv[2] ?? '.';
const URL = 'http://localhost:4173';

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

await page.goto(URL);
await page.waitForTimeout(2500);
await page.evaluate(() => localStorage.clear());
await page.click('#t-new');
await page.waitForTimeout(3200);

// A gallery with a floor we laid ourselves — the seed is different every run,
// and a natural cave under the staging drops the hulk before the test starts.
const stage = async (wx = 34, wy = 27) => {
  await page.evaluate(([wx, wy]) => {
    const g = window.__game;
    for (let y = 20; y <= 27; y++) {
      for (let x = 26; x <= 40; x++) g.terrain.carve(x, y);
    }
    for (let y = 28; y <= 30; y++) {
      for (let x = 26; x <= 40; x++) {
        g.terrain.data[g.terrain.idx(x, y)] = 2; // T.ROCK
        g.terrain.dug.delete(g.terrain.idx(x, y));
        g.terrain.onChange(x, y);
        g.chunks.markDirty(x, y);
      }
    }
    g.terrain.wrecks.length = 0;
    g.terrain.wrecks.push({ x: wx, y: wy });
    g.looted.clear();
    g.ctrl.drilling = null;
    g.ctrl.vx = 0; g.ctrl.vy = 0;
    g.state.hull = g.state.maxHull;
    g.state.fuel = g.state.maxFuel;
  }, [wx, wy]);
  await page.waitForTimeout(500);
};

// 1) a hulk stops a drifting rig instead of passing through it, and is
//    shouldered along the open gallery rather than sealing it
await stage();
await page.evaluate(() => {
  const g = window.__game;
  g.ctrl.px = 30.5; g.ctrl.py = -27.4;
  g.cam.snap(32, -26, 13);
});
await page.waitForTimeout(400);
await page.keyboard.down('ArrowRight');
await page.waitForTimeout(2200);
await page.keyboard.up('ArrowRight');
await page.waitForTimeout(400);
const bump = await page.evaluate(() => ({
  px: +window.__game.ctrl.px.toFixed(2),
  wx: window.__game.terrain.wrecks[0].x,
  wy: window.__game.terrain.wrecks[0].y,
}));
await page.screenshot({ path: OUT + '/w-bump.png' });
// what must never happen is the rig ending up past a hulk that never moved
console.log('the rig meets the hulk:', JSON.stringify(bump),
  bump.wy === 27 && bump.px < bump.wx + 0.5 ? 'OK' : 'FAIL');
console.log('and shoulders it along:', `hulk 34 -> ${bump.wx}`,
  bump.wx > 34 ? 'OK' : 'FAIL');

// 2) a hulk is a floor: land on it, do not drop through it
await stage();
await page.evaluate(() => {
  const g = window.__game;
  g.ctrl.px = 34.5; g.ctrl.py = -22.0;
  g.cam.snap(34.5, -24, 13);
});
await page.waitForTimeout(5000);
const stood = await page.evaluate(() => ({
  py: +window.__game.ctrl.py.toFixed(2),
  grounded: window.__game.ctrl.grounded,
  wy: window.__game.terrain.wrecks[0].y,
}));
await page.screenshot({ path: OUT + '/w-stand.png' });
console.log('the rig stands on it:', JSON.stringify(stood),
  stood.grounded && stood.wy === 27 && stood.py > -27.0 ? 'OK' : 'FAIL');

// 3) undermined, a hulk rests on the pod instead of falling through it
await stage(34, 24);
await page.evaluate(() => {
  const g = window.__game;
  g.ctrl.px = 34.5; g.ctrl.py = -27.4; g.ctrl.vx = 0; g.ctrl.vy = 0;
});
await page.waitForTimeout(1500);
const rested = await page.evaluate(() => ({
  wy: window.__game.terrain.wrecks[0].y,
  py: +window.__game.ctrl.py.toFixed(2),
}));
console.log('it settles onto the hull, not through it:', JSON.stringify(rested),
  rested.wy === 26 ? 'OK' : 'FAIL');

// 4) and the rig lifts it back up the shaft it fell down, never sealed under it
await page.keyboard.down('ArrowUp');
await page.waitForTimeout(2500);
await page.keyboard.up('ArrowUp');
const lifted = await page.evaluate(() => ({
  wy: window.__game.terrain.wrecks[0].y,
  py: +window.__game.ctrl.py.toFixed(2),
}));
await page.screenshot({ path: OUT + '/w-lift.png' });
console.log('and lifts it clear rather than being sealed under it:',
  JSON.stringify(lifted), lifted.wy < rested.wy && lifted.py > rested.py ? 'OK' : 'FAIL');

// 5) on foot: solid to stand against, far too heavy to push
await stage();
await page.evaluate(() => {
  const g = window.__game;
  g.ctrl.px = 31.5; g.ctrl.py = -27.4;
  g.cam.snap(32.5, -26.5, 11);
});
await page.waitForTimeout(600);
await page.keyboard.press('KeyE');
await page.waitForTimeout(1000);
const entered = await page.evaluate(() => window.__game.mode);
await page.keyboard.down('ArrowRight');
await page.waitForTimeout(2600);
await page.keyboard.up('ArrowRight');
await page.waitForTimeout(300);
const walked = await page.evaluate(() => ({
  mode: window.__game.mode,
  px: +window.__game.pilot.px.toFixed(2),
  wx: window.__game.terrain.wrecks[0].x,
}));
await page.screenshot({ path: OUT + '/w-pilot.png' });
console.log('the pilot is stopped by it, and cannot budge it:', entered, JSON.stringify(walked),
  walked.mode === 'eva' && walked.px < 34.2 && walked.wx === 34 ? 'OK' : 'FAIL');

// 6) salvage still reaches from where a solid hulk lets you stand
const salvage = await page.evaluate(() => window.__game.wreckAtPilot());
console.log('and can still be salvaged from there:', salvage,
  salvage === 0 ? 'OK' : 'FAIL');

console.log(errors.length ? errors.join('\n') : 'no page errors');
await browser.close();
