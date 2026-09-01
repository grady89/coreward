// Extraction: the order unlocks the cradle, hold-to-commit takes the
// fragment, the climb modifiers bite, delivery pays, and re-seating undoes it.
import { chromium } from 'playwright';

const OUT = process.argv[2] ?? '.';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

/** park the pod in the core chamber of the active world */
async function toChamber() {
  await page.evaluate(() => {
    const g = window.__game;
    g.ctrl.drilling = null;
    g.ctrl.px = 20.5; g.ctrl.py = -509 + 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
    g.state.fuel = g.state.maxFuel;
    g.state.hull = g.state.maxHull;
    g.state.upgrades.radiator = 5;
    g.cam.snap(g.ctrl.px, g.ctrl.py, 12.5);
  });
  await page.waitForTimeout(2200);
}

/** walk the pilot to within arm's reach of the cradle */
async function walkToCradle() {
  await page.evaluate(async () => {
    const g = window.__game;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }));
    for (let i = 0; i < 200; i++) {
      await new Promise(r => setTimeout(r, 100));
      if (Math.abs(g.pilot.px - g.ember.x) < 3.0) break;
    }
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowRight' }));
  });
  await page.waitForTimeout(300);
}

/**
 * Hold E at the cradle until `done` reports the commit. The hold accumulates
 * in CLAMPED game time (dt <= 0.05), so under SwiftShader's low frame rate a
 * 2.5s hold takes several seconds of wall clock — poll, never assume.
 */
async function holdUntil(done, capMs = 25000) {
  await walkToCradle();
  await page.keyboard.down('KeyE');
  let ok = false;
  const t0 = Date.now();
  while (Date.now() - t0 < capMs) {
    await page.waitForTimeout(250);
    if (await page.evaluate(done)) { ok = true; break; }
  }
  await page.keyboard.up('KeyE');
  return ok;
}

/** hold E briefly and release — the abort path */
async function holdBriefly() {
  await walkToCradle();
  await page.keyboard.down('KeyE');
  await page.waitForTimeout(1000);
  await page.keyboard.up('KeyE');
}

await page.goto('http://localhost:4173');
await page.waitForTimeout(2500);
await page.evaluate(() => localStorage.clear());
await page.click('#t-new');
await page.waitForTimeout(3400);

// a met world, the husk walked, the order heard
await page.evaluate(() => {
  const g = window.__game;
  g.state.endedWorlds.add('veil3');
  g.state.huskVisited = true;
  g.state.extractOrderHeard = true;
  g.comms.clear();
});
await toChamber();
const near = await page.evaluate(() => ({
  revisit: window.__game.ctrl.coreRevisit,
  prompt: document.querySelector('#prompt')?.textContent,
}));
console.log('cradle offered:', JSON.stringify(near), near.revisit ? 'OK' : 'FAIL');

// releasing early must abort with no penalty
await page.keyboard.press('KeyE'); // EVA
await page.waitForTimeout(700);
await holdBriefly();
await page.waitForTimeout(400);
const aborted = await page.evaluate(() => ({
  carrying: window.__game.state.carrying,
  extracted: [...window.__game.state.extracted],
}));
console.log('early release aborts:', JSON.stringify(aborted),
  aborted.carrying === null && aborted.extracted.length === 0 ? 'OK' : 'FAIL');
await page.screenshot({ path: OUT + '/x-hold.png' });

// the full hold takes it
await holdUntil(() => window.__game.state.carrying !== null);
await page.waitForTimeout(1000);
await page.screenshot({ path: OUT + '/x-unmake.png' });
const took = await page.evaluate(() => ({
  carrying: window.__game.state.carrying,
  phase: window.__game.finale.phase,
}));
console.log('extraction commits:', JSON.stringify(took),
  took.carrying === 'veil3' ? 'OK' : 'FAIL');

// let the unmaking finish
await page.waitForFunction(() => window.__game.finale.phase === 'done', { timeout: 15000 });
await page.waitForTimeout(600);
const after = await page.evaluate(() => ({
  taken: window.__game.ember.taken,
  mode: window.__game.mode,
  cargo: window.__game.state.cargoCount,
}));
console.log('cradle empty:', JSON.stringify(after),
  after.taken && after.mode === 'play' ? 'OK' : 'FAIL');

// climb modifiers: heavy, hot, hunted, and the hold is spoken for
const climb = await page.evaluate(() => {
  const g = window.__game;
  const before = g.state.fuel;
  g.state.addCargo(10); // COPPER — must be refused
  return {
    cargoRefused: g.state.cargoCount === 0,
    drain: g.atmosphere.drain,
    hudHold: document.querySelector('#hud-cargo-count')?.textContent,
    before,
  };
});
console.log('the hold is the fragment:', JSON.stringify(climb),
  climb.cargoRefused && climb.hudHold === '◆ FRAGMENT' ? 'OK' : 'FAIL');

// veinlight dies around a carried fragment
const vein = await page.evaluate(async () => {
  const g = window.__game;
  const cx = Math.floor(g.ctrl.px), cy = Math.floor(-g.ctrl.py);
  let seeded = 0;
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const tx = cx + dx, ty = cy + dy;
      if (ty < 1) continue;
      // seed ONLY into open air, so the game carving it back leaves the
      // chamber exactly as it was — never dissolve the floor under the pod
      if (g.terrain.get(tx, ty) !== 0) continue;
      g.terrain.data[g.terrain.idx(tx, ty)] = 9; // T.FUNGUS
      seeded++;
    }
  }
  await new Promise(r => setTimeout(r, 1500));
  let left = 0;
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const tx = cx + dx, ty = cy + dy;
      if (ty < 1) continue;
      if (g.terrain.get(tx, ty) === 9) left++;
    }
  }
  return { seeded, left };
});
console.log('veinlight dies as it rises:', JSON.stringify(vein), vein.left === 0 ? 'OK' : 'FAIL');

// re-seating: carry it back down and put it home
await toChamber();
await page.keyboard.press('KeyE');
await page.waitForTimeout(700);
await holdUntil(() => window.__game.state.carrying === null);
await page.waitForTimeout(900);
const seated = await page.evaluate(() => ({
  carrying: window.__game.state.carrying,
  extracted: [...window.__game.state.extracted],
  reseated: [...window.__game.state.reseated],
  taken: window.__game.ember.taken,
}));
console.log('re-seating:', JSON.stringify(seated),
  seated.carrying === null && seated.extracted.length === 0
  && seated.reseated.includes('veil3') && !seated.taken ? 'OK — the world takes it back' : 'FAIL');
await page.screenshot({ path: OUT + '/x-seated.png' });

// delivery pays and clears the debt
await page.evaluate(async () => {
  const g = window.__game;
  g.state.carrying = 'veil3';
  g.state.extracted.add('veil3');
  g.state.reseated.delete('veil3');
  g.mode = 'play';
  g.ctrl.respawnAtSurface();
  g.ctrl.px = 30.5; g.ctrl.py = 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.cam.snap(30.5, 2, 14);
});
await page.waitForTimeout(1500);
const money0 = await page.evaluate(() => window.__game.state.money);
console.log('  at trade post:', JSON.stringify(await page.evaluate(() => ({
  mode: window.__game.mode, dock: window.__game.ctrl.dock?.key,
  panel: window.__game.panels.current, carrying: window.__game.state.carrying,
}))));
await page.keyboard.press('KeyE'); // trade post
await page.waitForTimeout(900);
console.log('  panel:', JSON.stringify(await page.evaluate(() => ({
  panel: window.__game.panels.current, deliver: !!document.querySelector('#deliver'),
}))));
await page.screenshot({ path: OUT + '/x-order.png' });
await page.click('#deliver');
await page.waitForTimeout(900);
const sold = await page.evaluate(() => ({
  money: window.__game.state.money,
  carrying: window.__game.state.carrying,
  delivered: [...window.__game.state.delivered],
}));
console.log('delivery:', money0, '->', JSON.stringify(sold),
  sold.money - money0 === 300000 && sold.carrying === null ? 'OK' : 'FAIL');

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
