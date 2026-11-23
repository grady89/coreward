// The 2026-11-20 bug sweep (design-review/review-2026-11-20 §1), each proved
// in the built game: a crash or tow cannot surface a fragment; charge rubble
// survives a reload; the fauna keep coming while you are on foot; a fragment
// sells at its own world's price; a fresh world's board is not a coupon book;
// heat fissures sit on the rock face, not inside it.
//
// Usage: npm run build && npx vite preview --port 4173, then
//   node scripts/bugsweep.mjs [outdir]
import { chromium } from 'playwright';

const OUT = process.argv[2] ?? '.';
const URL = process.env.COREWARD_URL ?? 'http://localhost:4173';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
let fails = 0;
const check = (name, ok, data) => {
  if (!ok) fails++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}`, data === undefined ? '' : JSON.stringify(data));
};
/** wait for `s` seconds of GAME time — SwiftShader's wall clock lies */
const gameWait = s => page.evaluate(async s => {
  const g = window.__game; const t0 = g.time;
  while (g.time - t0 < s) await new Promise(r => setTimeout(r, 50));
}, s);
async function continueSave() {
  await page.reload();
  await page.waitForTimeout(2500);
  await page.click('#t-continue');
  await page.waitForFunction(() => window.__game?.mode === 'play', { timeout: 30000 });
  await page.waitForTimeout(600);
}

await page.goto(URL);
await page.waitForTimeout(2500);
await page.evaluate(() => localStorage.clear());
await page.click('#t-new');
await page.waitForFunction(() => window.__game?.mode === 'play', { timeout: 30000 });
await page.waitForTimeout(600);
await page.evaluate(() => { const g = window.__game; g.comms.clear(); g.state.money = 50000; });

// ---- B1: a crash with the fragment aboard leaves it where the pod burst ----
const crash = await page.evaluate(() => {
  const g = window.__game, st = g.state;
  st.endedWorlds.add('veil3'); st.extractOrderHeard = true;
  st.carrying = 'veil3'; st.extracted.add('veil3');
  g.ctrl.px = 30.5; g.ctrl.py = -120.5; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.terrain.carve(30, 120); g.terrain.carve(30, 119);
  g.ctrl.hurtFromThreat(99999, 'a test');
  return {
    carrying: st.carrying, drops: st.fragmentDrops.length, sites: g.fragSites.length,
    panel: document.querySelector('.panel-scrim')?.textContent ?? '',
  };
});
check('B1 crash: fragment leaves the hold, one beacon, panel says so',
  crash.carrying === null && crash.drops === 1 && crash.sites === 1 && /would not come up/.test(crash.panel),
  { ...crash, panel: crash.panel.slice(0, 80) });
await page.click('#respawn');
await page.waitForTimeout(600);
const surfaced = await page.evaluate(() => ({
  row: window.__game.ctrl.row, carrying: window.__game.state.carrying,
}));
check('B1 crash: respawn surfaces empty-handed', surfaced.carrying === null && surfaced.row < 5, surfaced);

// the drop rides the save
await page.evaluate(() => window.__game.saveNow());
await continueSave();
const kept = await page.evaluate(() => ({
  drops: window.__game.state.fragmentDrops, sites: window.__game.fragSites.length,
}));
check('B1 drop survives a reload with its beacon', kept.drops.length === 1 && kept.sites === 1, kept);

// fly into it: ore aboard goes on the floor, the fragment goes in the hold
const took = await page.evaluate(async () => {
  const g = window.__game, st = g.state, d = st.fragmentDrops[0];
  st.addCargo(10); st.addCargo(10);
  g.ctrl.px = d.x; g.ctrl.py = d.y + 0.5; g.ctrl.vx = 0; g.ctrl.vy = 0;
  const t0 = g.time;
  while (g.time - t0 < 1 && st.carrying === null) await new Promise(r => setTimeout(r, 50));
  return { carrying: st.carrying, drops: st.fragmentDrops.length, sites: g.fragSites.length,
    cargo: st.cargoCount, spill: st.spill?.cargo ?? null };
});
check('B1 pickup: fragment back in the hold, ore filed as a spill',
  took.carrying === 'veil3' && took.drops === 0 && took.sites === 0 && took.cargo === 0
    && JSON.stringify(took.spill) === '[[10,2]]', took);

// ---- B1: the tow cannot lift it either ----
const tow = await page.evaluate(() => {
  const g = window.__game;
  g.panels.open('rescue');
  return document.querySelector('.panel-scrim')?.textContent ?? '';
});
await page.click('#rescue');
await page.waitForTimeout(600);
const towed = await page.evaluate(() => ({
  carrying: window.__game.state.carrying, drops: window.__game.state.fragmentDrops.length,
  row: window.__game.ctrl.row,
}));
check('B1 tow: panel warns, fragment stays down', /winch will not lift/.test(tow)
  && towed.carrying === null && towed.drops === 1 && towed.row < 5, towed);

// ---- B5: a fragment sells at its own world's price, even from a grey world ----
const sold = await page.evaluate(() => {
  const g = window.__game, st = g.state;
  st.fragmentDrops = [];
  st.carrying = 'veil3';
  g.setupWorld(); // VEIL-3 is extracted: it arrives huskified, valueMul x0.25
  g.panels.open('trade');
  const panel = document.querySelector('.panel-scrim')?.textContent ?? '';
  g.panels.close();
  const before = st.money;
  g.deliverFragment();
  return { paid: st.money - before, panelShows: /300,000|300k|300 000/.test(panel) };
});
check('B5 VEIL fragment on grey VEIL pays the full 300,000', sold.paid === 300000 && sold.panelShows, sold);
await page.waitForTimeout(400);

// ---- B2: charge rubble survives a reload instead of regrowing the seed ----
const blast = await page.evaluate(() => {
  const g = window.__game, t = g.terrain;
  g.ctrl.px = 10.5; g.ctrl.py = -3; // well clear of the blast
  const tx = 40, ty = 200;
  const seedTile = t.get(tx, ty);
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) t.carve(tx + dx, ty + dy);
  g.detonate(tx + 0.5, -(ty + 0.5));
  g.saveNow();
  const ws = JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.startsWith('coreward_save_v2'))));
  return { seedTile, now: t.get(tx, ty), inDug: t.dug.has(t.idx(tx, ty)),
    saved: ws.worlds.veil3.rubble?.includes(t.idx(tx, ty)) ?? false };
});
await continueSave();
const reloaded = await page.evaluate(() => window.__game.terrain.get(40, 200));
check('B2 rubble is saved and comes back as rubble', blast.now === 18 && blast.inDug && blast.saved && reloaded === 18,
  { ...blast, reloaded });

// ---- B6: a fresh world's board is priced for its own shallows ----
const board = await page.evaluate(() => {
  const g = window.__game, st = g.state;
  st.bestDepthM = 1000; st.worldBestRow = 0;
  g.panels.open('contracts');
  // the posted rewards only: the ✦ figure on each card
  const rewards = [...document.querySelectorAll('.panel-scrim')].flatMap(p =>
    [...p.innerText.matchAll(/^✦([\d,]+)$/gm)].map(m => +m[1].replace(/,/g, '')));
  g.panels.close();
  return { rewards: rewards.slice(1), max: Math.max(0, ...rewards.slice(1)) }; // [0] is the purse
});
check('B6 1000 m record, fresh world: no six-figure coupons', board.rewards.length === 3 && board.max < 20000, board);

// ---- B3: stepping out does not freeze the swarm ----
await page.evaluate(() => window.__game.devStage('glimmerflies'));
await page.waitForFunction(() => window.__game.threats.flies?.swarms.some(s => s.alive), { timeout: 30000 });
await gameWait(4);
const inPod = await page.evaluate(async () => {
  const g = window.__game, st = g.state; st.hull = st.maxHull;
  // keep the pod lit and still until the swarm is actually on it
  const h0 = st.hull, t0 = g.time;
  while (g.time - t0 < 12 && st.hull >= h0) await new Promise(r => setTimeout(r, 50));
  const t1 = g.time;
  while (g.time - t1 < 1.5) await new Promise(r => setTimeout(r, 50));
  return +(h0 - st.hull).toFixed(2);
});
const onFoot = await page.evaluate(async () => {
  const g = window.__game, st = g.state; st.hull = st.maxHull;
  g.enterEva();
  const h0 = st.hull, t0 = g.time;
  while (g.time - t0 < 1.5) await new Promise(r => setTimeout(r, 50));
  return { lost: +(h0 - st.hull).toFixed(2), mode: g.mode };
});
check('B3 the swarm keeps biting the parked pod', inPod > 0 && onFoot.lost > 0 && onFoot.mode === 'eva', { inPod, onFoot });
await page.screenshot({ path: OUT + '/b3-eva-swarm.png' });

// ---- B7: heat fissures are in front of their rock ----
const fiss = await page.evaluate(() => {
  const g = window.__game;
  if (g.mode === 'eva') g.exitEva();
  g.threats.level = 'off';
  g.ctrl.px = 32.5; g.ctrl.py = -(430 + 0.5); g.ctrl.vx = 0; g.ctrl.vy = 0;
  for (let dx = -3; dx <= 3; dx++) for (let dy = -2; dy <= 1; dy++) g.terrain.carve(32 + dx, 430 + dy);
  g.cam.snap(g.ctrl.px, g.ctrl.py, 12.5);
  return true;
});
await gameWait(1.2);
const flat = await page.evaluate(() => {
  const g = window.__game; let n = 0, buried = 0;
  for (const ch of g.chunks.live.values()) for (const list of ch.gemAnim) for (const a of list) {
    if (!a.flat || a.dim >= 1) continue; n++; // dim 0.9 = fissure (carvings burn 1.3)
    if (a.z < 0.53) buried++;
  }
  return { n, buried };
});
check('B7 fissures sit on the face (none below z 0.53)', fiss && flat.n > 0 && flat.buried === 0, flat);
await page.screenshot({ path: OUT + '/b7-fissures.png' });

if (errors.length) { fails++; console.log(errors); }
console.log(fails ? `${fails} FAILED` : 'ALL OK');
await browser.close();
process.exitCode = fails ? 1 : 0;
