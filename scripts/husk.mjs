// SITE 297: the husk. Travel there once two cores are met, walk the three
// readables, and come back with the extraction order waiting.
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
await page.waitForTimeout(3400);

// two cores met: the dish resolves a fourth signal
await page.evaluate(() => {
  const g = window.__game;
  g.state.endedWorlds.add('veil3');
  g.state.endedWorlds.add('cryos2');
  g.comms.clear();
  g.ctrl.drilling = null;
  g.ctrl.px = 52; g.ctrl.py = 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.cam.snap(52, 2, 14);
});
await page.waitForTimeout(1100);
await page.keyboard.press('KeyE');       // assay office
await page.waitForTimeout(700);
await page.click('#open-starmap');
await page.waitForTimeout(3200);
const tags = await page.evaluate(() => [...document.querySelectorAll('.sm-tag .tn')].map(e => e.textContent));
console.log('chart sites:', JSON.stringify(tags), tags.includes('SITE 297') ? 'OK' : 'FAIL');
await page.screenshot({ path: OUT + '/h-chart.png' });

// select SITE 297 and travel
for (let i = 0; i < 8; i++) {
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(800);
  const name = await page.evaluate(() => document.querySelector('.sm-card .sm-name')?.textContent);
  if (name === 'SITE 297') break;
}
await page.screenshot({ path: OUT + '/h-dossier.png' });
await page.keyboard.press('KeyE');
await page.waitForTimeout(4500);
const arrived = await page.evaluate(() => ({
  world: window.__game.state.activeWorld,
  mode: window.__game.mode,
  threats: window.__game.threats.level,
}));
console.log('arrived:', JSON.stringify(arrived),
  arrived.world === 'site297' && arrived.mode === 'play' && arrived.threats === 'off' ? 'OK' : 'FAIL');
await page.screenshot({ path: OUT + '/h-surface.png' });

// the drill has nothing to say here. Park on open ground between buildings —
// standing on a dock apron gets the (correct) OFFLINE answer instead of EVA.
await page.evaluate(() => {
  const g = window.__game;
  g.ctrl.px = 25; g.ctrl.py = 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.cam.snap(25, 2, 14);
});
await page.waitForTimeout(900);
await page.keyboard.down('ArrowDown');
await page.waitForTimeout(1800);
await page.keyboard.up('ArrowDown');
const dug = await page.evaluate(() => window.__game.state.blocksDug);
console.log('slag is undrillable:', dug, dug === 0 ? 'OK' : 'FAIL');

// walk the three readables
await page.keyboard.press('KeyE'); // EVA
await page.waitForTimeout(800);
const evaMode = await page.evaluate(() => window.__game.mode);
console.log('eva on the husk:', evaMode, evaMode === 'eva' ? 'OK' : 'FAIL');
for (let n = 0; n < 3; n++) {
  const target = await page.evaluate(() => {
    const g = window.__game;
    const R = window.__HUSK ?? null;
    return g.state.huskRead.size;
  });
  // walk toward the nearest unread stop, then read it
  await page.evaluate(async () => {
    const g = window.__game;
    const xs = [19.5, 36.2, 47.5];
    let best = null, bestD = Infinity;
    xs.forEach((x, i) => {
      if (g.state.huskRead.has(i)) return;
      const d = Math.abs(g.pilot.px - x);
      if (d < bestD) { bestD = d; best = x; }
    });
    if (best === null) return;
    const dir = best > g.pilot.px ? 'ArrowRight' : 'ArrowLeft';
    window.dispatchEvent(new KeyboardEvent('keydown', { code: dir }));
    for (let i = 0; i < 140; i++) {
      await new Promise(r => setTimeout(r, 100));
      if (Math.abs(g.pilot.px - best) < 0.6) break;
    }
    window.dispatchEvent(new KeyboardEvent('keyup', { code: dir }));
  });
  await page.waitForTimeout(400);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(700);
  const now = await page.evaluate(() => window.__game.state.huskRead.size);
  console.log(`  readable ${n + 1}:`, now, now === target + 1 ? 'OK' : 'FAIL');
}
await page.screenshot({ path: OUT + '/h-readable.png' });
const visited = await page.evaluate(() => ({
  read: window.__game.state.huskRead.size,
  visited: window.__game.state.huskVisited,
  o2: Math.round(window.__game.pilot.o2),
}));
console.log('husk walked:', JSON.stringify(visited),
  visited.read === 3 && visited.visited && visited.o2 === 45 ? 'OK — no clock on a dead world' : 'FAIL');

// travel home; the extraction order should arrive
await page.evaluate(() => {
  const g = window.__game;
  g.state.activeWorld = 'veil3';
  g.setupWorld ? g.setupWorld() : null;
});
await page.evaluate(() => window.__game.travel('veil3'));
await page.waitForTimeout(2500);
await page.evaluate(() => { window.__game.comms.clear(); });
await page.waitForTimeout(3000);
const order = await page.evaluate(() => ({
  heard: window.__game.state.extractOrderHeard,
  fired: [...window.__game.state.firedEvents].includes('extraction-order'),
}));
console.log('extraction order:', JSON.stringify(order), order.heard ? 'OK' : 'FAIL');

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
