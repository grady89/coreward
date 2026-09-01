// Survey gear is per dig site; a new world arrives unsurveyed.
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

// buy the full survey kit on VEIL-3 and dig some depth
await page.evaluate(() => {
  const g = window.__game;
  g.state.money = 90000;
  g.state.worldBestRow = 240;
  g.state.bestDepthM = 480;
  g.ctrl.drilling = null;
  g.ctrl.px = 52; g.ctrl.py = 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.cam.snap(52, 2, 14);
});
await page.waitForTimeout(1100);
await page.keyboard.press('KeyE');
await page.waitForTimeout(700);
await page.click('#buy-scanner');
await page.waitForTimeout(300);
await page.click('#buy-array');
await page.waitForTimeout(300);
await page.click('#buy-beacons');
await page.waitForTimeout(400);
await page.screenshot({ path: OUT + '/s-assay.png' });
const kit = await page.evaluate(() => ({
  scanner: window.__game.state.hasScanner,
  array: window.__game.state.hasDeepArray,
  beacons: window.__game.state.hasBeacons,
  gear: window.__game.state.gear,
}));
console.log('veil3 kit:', JSON.stringify(kit),
  kit.scanner && kit.array && kit.beacons ? 'OK' : 'FAIL');

// wrecks show on the map now
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
await page.keyboard.press('Tab');
await page.waitForTimeout(900);
await page.screenshot({ path: OUT + '/s-map-wrecks.png' });
await page.keyboard.press('Tab');
await page.waitForTimeout(300);

// travel to CRYOS-2
await page.evaluate(() => {
  const g = window.__game;
  g.state.endedWorlds.add('veil3');
  g.ctrl.drilling = null;
  g.ctrl.px = 52; g.ctrl.py = 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.cam.snap(52, 2, 14);
});
await page.waitForTimeout(1100);
await page.keyboard.press('KeyE');
await page.waitForTimeout(700);
await page.click('button[data-travel="cryos2"]');
await page.waitForTimeout(2500);

const fresh = await page.evaluate(() => ({
  world: window.__game.state.activeWorld,
  scanner: window.__game.state.hasScanner,
  array: window.__game.state.hasDeepArray,
  beacons: window.__game.state.hasBeacons,
  revealRow: window.__game.state.worldBestRow,
  globalBest: window.__game.state.bestDepthM,
}));
console.log('cryos2 on arrival:', JSON.stringify(fresh),
  fresh.world === 'cryos2' && !fresh.scanner && !fresh.array && !fresh.beacons && fresh.revealRow === 0
    ? 'OK — arrives blind and unsurveyed' : 'FAIL');

// TAB should be gated again on the new world
await page.evaluate(() => window.__game.comms.clear());
await page.keyboard.press('Tab');
await page.waitForTimeout(500);
const gated = await page.evaluate(() => window.__game.map.visible);
console.log('map gated on new world:', !gated ? 'OK' : 'FAIL');

// and VEIL-3 still remembers its own kit
const back = await page.evaluate(() => {
  const g = window.__game;
  return {
    veil3: g.state.gear.veil3,
    cryos2: g.state.gear.cryos2 ?? null,
  };
});
console.log('gear is per site:', JSON.stringify(back),
  back.veil3?.scanner && !back.cryos2?.scanner ? 'OK' : 'FAIL');

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
