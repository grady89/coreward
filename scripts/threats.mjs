// Phase 1: lamp toggle, glimmerfly swarms, light attraction, threat settings.
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

// --- lamp toggle ---
const lamp0 = await page.evaluate(() => window.__game.lampOn);
await page.keyboard.press('KeyF');
await page.waitForTimeout(400);
const lamp1 = await page.evaluate(() => ({
  on: window.__game.lampOn,
  pip: document.querySelector('#lamp-pip')?.classList.contains('on'),
}));
console.log('lamp toggle:', lamp0, '->', JSON.stringify(lamp1),
  lamp0 === true && lamp1.on === false && lamp1.pip ? 'OK' : 'FAIL');
await page.keyboard.press('KeyF');
await page.waitForTimeout(300);

// --- swarms spawn in band, and only in band ---
const spawn = await page.evaluate(async () => {
  const g = window.__game;
  // carve a chamber deep enough to be in the swarm band
  const row = 200;
  for (let y = row - 6; y < row + 6; y++)
    for (let x = 18; x < 42; x++) g.terrain.carve(x, y);
  g.ctrl.px = 30.5; g.ctrl.py = -(row + 5) + 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.state.fuel = g.state.maxFuel; g.state.hull = g.state.maxHull;
  g.cam.snap(30.5, -row, 12.5);
  g.threats.reset();
  // force spawn attempts
  let live = 0;
  for (let i = 0; i < 40; i++) {
    g.threats.flies.spawnTimer = 0;
    await new Promise(r => setTimeout(r, 60));
    live = g.threats.flies.count;
    if (live > 0) break;
  }
  return { live, row };
});
console.log('swarm spawned:', JSON.stringify(spawn), spawn.live > 0 ? 'OK' : 'FAIL');
await page.screenshot({ path: OUT + '/t-swarm.png' });

// --- lamp on attracts, dark disperses ---
const hunt = await page.evaluate(async () => {
  const g = window.__game;
  g.lampOn = true;
  // walk a swarm right next to the pod so it notices
  const s = g.threats.flies.swarms.find(s => s.alive);
  if (!s) return { err: 'no swarm' };
  s.ax = g.ctrl.px + 3; s.ay = g.ctrl.py;
  for (const f of g.threats.flies.flies) { f.x = s.ax; f.y = s.ay; }
  await new Promise(r => setTimeout(r, 900));
  const alertedLit = g.threats.flies.swarms.some(x => x.alerted);
  // the flock collapses on its anchor first, then dives — give it up to 6s
  const hullBefore = g.state.hull;
  let hullAfter = hullBefore;
  for (let i = 0; i < 60 && hullAfter >= hullBefore; i++) {
    await new Promise(r => setTimeout(r, 100));
    hullAfter = g.state.hull;
  }
  // now go dark
  // 5s wall-clock: headless sim-time runs ~30% slow (dt is clamped at 0.05)
  g.lampOn = false;
  await new Promise(r => setTimeout(r, 5000));
  const alertedDark = g.threats.flies.swarms.some(x => x.alerted);
  const detail = g.threats.flies.swarms.map(x => ({
    alive: x.alive, alerted: x.alerted, dark: +x.darkFor.toFixed(2),
  }));
  return {
    alertedLit, alertedDark, hullBefore: +hullBefore.toFixed(1),
    hullAfter: +hullAfter.toFixed(1), menace: +g.threats.menace.toFixed(2),
    panel: g.panels.current, mode: g.mode, detail,
  };
});
console.log('lamp attracts:', JSON.stringify(hunt),
  hunt.alertedLit && !hunt.alertedDark ? 'OK' : 'FAIL');
console.log('contact damage:', hunt.hullAfter < hunt.hullBefore ? 'OK' : 'FAIL (may not have touched)');

// --- threats: off clears the field ---
const off = await page.evaluate(async () => {
  const g = window.__game;
  g.settings.threats = 'off';
  g.applySettings();
  await new Promise(r => setTimeout(r, 600));
  return { level: g.threats.level, count: g.threats.flies.count };
});
console.log('threats off:', JSON.stringify(off), off.level === 'off' && off.count === 0 ? 'OK' : 'FAIL');

// --- setting persists ---
await page.evaluate(() => window.__game.saveNow());
await page.reload();
await page.waitForTimeout(2600);
const persisted = await page.evaluate(() => window.__game.settings.threats);
console.log('threats setting persisted:', persisted, persisted === 'off' ? 'OK' : 'FAIL');

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
