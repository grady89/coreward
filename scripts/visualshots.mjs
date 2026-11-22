// The fixed shot list for the 2026-11-22 visual pass. Same seed, same
// positions, same camera and lamp every run, toasts and comms cleared before
// each frame, so two runs of two builds are comparable shot for shot.
//
// Usage: npm run build && npx vite preview --port 4190 --strictPort, then
//   node scripts/visualshots.mjs <outdir> [--port=4190] [--only=substr]
// Writes <outdir>/<shot>.png and <outdir>/stats.json (renderer.info per shot).
//
// Determinism: Math.random is replaced by a seeded PRNG before the page runs,
// which fixes the world seed. The camera is frozen at a scripted pose for
// every world shot (follow/followChamber/dockPose become no-ops).
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';

const args = process.argv.slice(2);
const opt = (k, d) => (args.find(a => a.startsWith(`--${k}=`)) ?? '').split('=')[1] ?? d;
const OUT = args.find(a => !a.startsWith('--')) ?? 'shots';
const PORT = opt('port', '4190');
const ONLY = opt('only', '');
const URL = `http://localhost:${PORT}`;
const SEED = 'seed=12345'; // pins the world seed (src/main.ts dev harness)
mkdirSync(OUT, { recursive: true });

// Shots run on the hardware GPU (D3D11 via ANGLE): ~6x faster than SwiftShader.
// Never compare shots from different renderers. Do NOT use channel:'chromium'
// (it picks the integrated GPU). The gate suites still run on SwiftShader.
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const stats = {};
const errors = [];
const T = { ROCK: 2, LAVA: 7, FUNGUS: 9, COPPER: 10, IRON: 11, SILVER: 12, GOLD: 13, RUBY: 14, VOIDOPAL: 15, DIAMOND: 16, EMBERSHARD: 17, NATIVE: 21, MIMIC: 23, FROSTBLOOM: 24, NACRE: 25 };

async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  // opt in to bloom explicitly: builds without the setting ignore the key; the
  // hardware GPU we shoot on would default it on anyway, but say so
  await ctx.addInitScript(() => { try { localStorage.setItem('coreward_settings_v1', JSON.stringify({ bloom: true })); } catch {} });
  await ctx.addInitScript(() => {
    let a = 0x2545f491;
    Math.random = () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  return page;
}

/** wait `s` seconds of GAME time (wall clock lies under SwiftShader); `vault` waits on the vault's clock */
const gameWait = (page, s, vault = false) => page.evaluate(async ([s, vault]) => {
  const clock = () => vault ? window.__game.vault.time : window.__game.time;
  const t0 = clock(), w0 = performance.now();
  while (clock() - t0 < s && performance.now() - w0 < 60000) await new Promise(r => setTimeout(r, 40));
}, [s, vault]);

const freezeCam = (page, x, y, z) => page.evaluate(([x, y, z]) => {
  const c = window.__game.cam;
  c.follow = () => {}; c.followChamber = () => {}; c.dockPose = () => {}; c.finaleFollow = () => {};
  c.snap(x, y, z);
}, [x, y, z]);

async function shot(page, name, { vault = false, settle = 0.4 } = {}) {
  if (ONLY && !name.includes(ONLY)) return;
  await page.evaluate(() => { const g = window.__game; if (g.comms) g.comms.say = () => {}; g.comms?.clear(); g.hud?.clearToasts(); });
  await gameWait(page, settle, vault);
  await page.evaluate(() => { const g = window.__game; if (g.comms) g.comms.say = () => {}; g.comms?.clear(); g.hud?.clearToasts(); });
  await page.waitForTimeout(700); // CSS fade-outs run on the wall clock
  await gameWait(page, 0.15, vault);
  stats[name] = await page.evaluate(vault => {
    const g = window.__game;
    const r = g.renderer.info.render;
    const scene = vault ? g.vault.scene : g.scene;
    let lights = 0, lightsOn = 0;
    scene.traverse(o => { if (o.isLight) { lights++; if (o.visible && o.intensity > 0) lightsOn++; } });
    return { calls: r.calls, triangles: r.triangles, lights, lightsOn, programs: g.renderer.info.programs?.length ?? null };
  }, vault);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('shot', name, JSON.stringify(stats[name]));
}

async function bootPlay(page, query = '') {
  await page.goto(URL + '/' + (query ? query + '&' : '?') + SEED);
  await page.waitForFunction(() => !!window.__game, null, { timeout: 60000 });
  if (!query) {
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForFunction(() => !!window.__game && !!document.querySelector('#t-new'), null, { timeout: 60000 });
    await page.click('#t-new');
    // an armed save slot asks twice
    await page.waitForTimeout(400);
    if (await page.evaluate(() => window.__game.mode === 'title')) await page.click('#t-new').catch(() => {});
  }
  await page.waitForFunction(() => window.__game?.mode === 'play', null, { timeout: 90000 });
  await gameWait(page, 1.0);
  await page.evaluate(() => { const g = window.__game; g.threats.level = 'off'; g.threats.reset?.(); });
}

/** carve a pocket around row r, stand the pod in it, optional fluid basin to its right */
const pocket = (page, r, { x0 = 25, x1 = 37, pool = true, podX = 28.5 } = {}) => page.evaluate(([r, x0, x1, pool, podX, T]) => {
  const g = window.__game, tr = g.terrain;
  const set = (x, y, t) => { tr.data[tr.idx(x, y)] = t; tr.dug?.delete(tr.idx(x, y)); tr.onChange(x, y); g.chunks.markDirty(x, y); };
  for (let y = r - 3; y <= r + 1; y++) for (let x = x0; x <= x1; x++) tr.carve(x, y);
  // a solid floor and side walls, whatever the seed put there
  for (let x = x0 - 1; x <= x1 + 1; x++) if (tr.data[tr.idx(x, r + 2)] === 0) set(x, r + 2, T.ROCK);
  if (pool) {
    for (let x = 32; x <= 37; x++) for (let y = r + 2; y <= r + 4; y++) set(x, y, T.ROCK);
    for (let x = 33; x <= 36; x++) for (let y = r + 2; y <= r + 3; y++) set(x, y, T.LAVA);
  }
  g.ctrl.drilling = null; g.ctrl.vx = 0; g.ctrl.vy = 0; g.ctrl.facing = 1;
  g.ctrl.px = podX; g.ctrl.py = -(r + 1) + 0.42;
  const st = g.state;
  st.fuel = st.maxFuel; st.hull = st.maxHull; st.upgrades.radiator = 5; st.accl[st.activeWorld] = 3;
  g.lampOn = true; g.hud.setLamp(true);
}, [r, x0, x1, pool, podX, T]);

/** place ore tiles; cells = [[x,y,t]...] */
const placeOre = (page, cells) => page.evaluate(cells => {
  const g = window.__game, tr = g.terrain;
  for (const [x, y, t] of cells) { tr.data[tr.idx(x, y)] = t; tr.dug?.delete(tr.idx(x, y)); tr.onChange(x, y); g.chunks.markDirty(x, y); }
}, cells);

const hold = page => page.evaluate(() => {
  const g = window.__game, st = g.state;
  st.fuel = st.maxFuel; st.hull = st.maxHull; g.ctrl.vx = 0; g.ctrl.vy = 0;
});

const want = (...names) => !ONLY || names.some(n => n.includes(ONLY));

// ------------------------------------------------------------ title / surface / HUD / shop / EVA
if (want('title', 'veil3-surface', 'hud-play', 'shop-trade', 'pod-pilot-eva')) {
  const page = await newPage();
  await page.goto(`${URL}/?${SEED}`);
  await page.waitForFunction(() => !!window.__game && !!document.querySelector('#t-new'), null, { timeout: 60000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => !!window.__game && !!document.querySelector('#t-new'), null, { timeout: 60000 });
  await gameWait(page, 2.5);
  await shot(page, 'title', { settle: 0.2 });

  await page.click('#t-new');
  await page.waitForTimeout(400);
  if (await page.evaluate(() => window.__game.mode === 'title')) await page.click('#t-new').catch(() => {});
  await page.waitForFunction(() => window.__game?.mode === 'play', null, { timeout: 90000 });
  await gameWait(page, 2.0);
  await page.evaluate(() => { const g = window.__game; g.threats.level = 'off'; });
  await page.evaluate(() => { const g = window.__game; g.ctrl.vx = 0; g.ctrl.vy = 0; });
  await freezeCam(page, 30.5, 3.2, 14);
  await shot(page, 'veil3-surface', { settle: 0.6 });

  // pod + pilot on EVA, close, on the pad
  await page.evaluate(() => { const g = window.__game; g.enterEva(); });
  await gameWait(page, 1.2);
  await page.evaluate(() => { const g = window.__game; g.pilot.vx = 0; });
  const pp = await page.evaluate(() => ({ x: (window.__game.pilot.px + window.__game.ctrl.px) / 2, y: window.__game.ctrl.py }));
  await freezeCam(page, pp.x, pp.y + 0.7, 4.6);
  await shot(page, 'pod-pilot-eva', { settle: 0.6 });
  await page.evaluate(() => { const g = window.__game; g.exitEva?.(); });
  await gameWait(page, 0.6);

  // HUD in play: shallow tunnel, part-used tank, some cargo
  await pocket(page, 40, { pool: false });
  await page.evaluate(() => {
    const g = window.__game, st = g.state;
    for (const t of [10, 10, 10, 11, 11, 12, 13]) st.addCargo(t);
    g.hud.setConsumables?.(st.flares, st.charges, st.arrestors);
  });
  await gameWait(page, 0.8);
  await page.evaluate(() => { const st = window.__game.state; st.fuel = st.maxFuel * 0.62; st.hull = st.maxHull * 0.8; });
  await freezeCam(page, 28.5, -40.2, 12.5);
  await shot(page, 'hud-play', { settle: 0.6 });

  // one shop panel: the trade post with that cargo
  await page.evaluate(() => {
    const g = window.__game;
    g.ctrl.respawnAtSurface?.();
    g.ctrl.px = 30.5; g.ctrl.py = 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  });
  await freezeCam(page, 30.5, 2, 14);
  await gameWait(page, 0.6);
  await page.evaluate(() => window.__game.panels.open('trade'));
  await shot(page, 'shop-trade', { settle: 0.6 });
  await page.context().close();
}

// ------------------------------------------------------------ worlds: depths, fluids, fissures, cores, minerals
const WORLDS = [
  { id: 'veil3', ores: [['copper', T.COPPER], ['iron', T.IRON], ['silver', T.SILVER], ['gold', T.GOLD], ['ruby', T.RUBY], ['voidopal', T.VOIDOPAL], ['diamond', T.DIAMOND], ['embershard', T.EMBERSHARD], ['veinlight', T.FUNGUS], ['mimic', T.MIMIC]] },
  { id: 'cryos2', ores: [['frostbloom', T.FROSTBLOOM], ['rime-salt', T.NATIVE]] },
  { id: 'maelis6', ores: [['nacre', T.NATIVE]] },
];
const DEPTHS = [['shallow', 60], ['mid', 230], ['deep', 440]];
const ORE_ROW = 150;

for (const w of WORLDS) {
  const names = [`${w.id}-core`, ...DEPTHS.map(d => `${w.id}-${d[0]}`), ...w.ores.flatMap(o => [`ore-${o[0]}`, `ore-${o[0]}-close`]),
    ...(w.id === 'veil3' ? ['veil3-fissures', 'ore-lineup'] : [])];
  if (!want(...names)) continue;
  const page = await newPage();
  await bootPlay(page, `?core=${w.id}`);

  // the core chamber, as the dev jump frames it at the chamber mouth
  const c = await page.evaluate(() => ({ x: window.__game.ctrl.px, y: window.__game.ctrl.py }));
  await freezeCam(page, c.x, c.y + 1, 12.5);
  await shot(page, `${w.id}-core`, { settle: 1.5 });

  for (const [dn, r] of DEPTHS) {
    await pocket(page, r);
    await freezeCam(page, 30.5, -(r + 0.2), 12.5);
    await gameWait(page, 0.8);
    await hold(page);
    await shot(page, `${w.id}-${dn}`, { settle: 0.8 });
  }

  if (w.id === 'veil3') {
    await pocket(page, 400, { x0: 27, x1: 33, pool: false, podX: 30.5 });
    await freezeCam(page, 30.5, -400.2, 12.5);
    await hold(page);
    await shot(page, 'veil3-fissures', { settle: 0.8 });
  }

  // each ore in its own world's rock: a 3-tile vein in the wall the lamp faces
  for (const [on, t] of w.ores) {
    if (!want(`ore-${on}`)) continue;
    const r = ORE_ROW;
    await pocket(page, r, { x0: 25, x1: 32, pool: false, podX: 28.5 });
    await placeOre(page, [[33, r - 1, t], [33, r, t], [34, r, t], [35, r - 2, t]]);
    await freezeCam(page, 30.5, -(r + 0.2), 12.5);
    await hold(page);
    await shot(page, `ore-${on}`, { settle: 0.8 });
    await freezeCam(page, 34.2, -(r - 0.2), 4.6);
    await shot(page, `ore-${on}-close`, { settle: 0.5 });
  }

  if (w.id === 'veil3' && want('ore-lineup')) {
    const r = 160;
    const LINE = [T.COPPER, T.IRON, T.SILVER, T.GOLD, T.RUBY, T.VOIDOPAL, T.DIAMOND, T.EMBERSHARD, T.FUNGUS, T.MIMIC, T.FROSTBLOOM, T.NATIVE, T.NACRE];
    await pocket(page, r, { x0: 17, x1: 45, pool: false, podX: 31 });
    // a row of ore set into the back of a carved shelf: rock between each
    await placeOre(page, LINE.flatMap((t, i) => [[18 + i * 2, r + 1, t], [19 + i * 2, r + 1, T.ROCK]]));
    await freezeCam(page, 31, -(r + 0.6), 15.5);
    await hold(page);
    await shot(page, 'ore-lineup', { settle: 0.8 });
  }
  await page.context().close();
}

// ------------------------------------------------------------ creatures (fauna sandbox, never writes the save)
for (const f of ['glimmerflies', 'warden', 'stillwalkers', 'shellbacks']) {
  if (!want(`creature-${f}`)) continue;
  const page = await newPage();
  await page.goto(`${URL}/?fauna=${f}&${SEED}`);
  await page.waitForFunction(() => window.__game?.mode === 'play', null, { timeout: 90000 });
  // the sandbox stages beside magma and live hazards: keep the pod topped up while it primes
  await page.evaluate(async () => {
    const g = window.__game, t0 = g.time, w0 = performance.now();
    while (g.time - t0 < 5 && performance.now() - w0 < 60000) {
      g.state.hull = g.state.maxHull; g.state.fuel = g.state.maxFuel;
      await new Promise(r => setTimeout(r, 20));
    }
  });
  await page.keyboard.press('KeyH'); // hide the sandbox card
  // hold the sandbox's own framing at this instant
  await page.evaluate(() => { const c = window.__game.cam; const { cx, cy, cz } = c; c.follow = () => {}; c.snap(cx, cy, cz); });
  await shot(page, `creature-${f}`, { settle: 0.4 });
  await page.context().close();
}

// ------------------------------------------------------------ vault rooms: the spawn frame and the whole room
for (const id of ['vault', 'ember', 'debt', 'return', 'kindled']) {
  if (!want(`vault-${id}`)) continue;
  const page = await newPage();
  await page.goto(`${URL}/?vault=${id}`);
  await page.waitForFunction(r => window.__game?.vault?.phase === 'run' && window.__game.vault.glyphId === r, id, { timeout: 90000 });
  await gameWait(page, 1.5, true);
  await shot(page, `vault-${id}-spawn`, { vault: true, settle: 0.3 });
  await page.evaluate(() => {
    const v = window.__game.vault, c = v.cam, p = v.p;
    v.invuln = 9999;
    const zw = c.distanceForWidth(p.w + 2), zh = (p.h + 2) / 2 / Math.tan(c.camera.fov * Math.PI / 360);
    c.followChamber = () => {}; c.follow = () => {};
    c.snap(p.w / 2, -p.h / 2, Math.max(zw, zh));
  });
  await shot(page, `vault-${id}-room`, { vault: true, settle: 0.5 });
  await page.context().close();
}

// ------------------------------------------------------------ one ending page (EXTRACT, as scripts/endings.mjs reaches it)
if (want('ending-page')) {
  const page = await newPage();
  try {
    await bootPlay(page);
    await page.evaluate(() => {
      const g = window.__game, st = g.state;
      ['veil3', 'cryos2', 'maelis6'].forEach(w => st.endedWorlds.add(w));
      st.extractOrderHeard = true; st.huskVisited = true;
      st.delivered.add('cryos2'); st.delivered.add('maelis6');
      st.extracted.add('cryos2'); st.extracted.add('maelis6');
      st.carrying = 'veil3'; st.extracted.add('veil3');
      g.comms.clear(); g.ctrl.respawnAtSurface();
      g.ctrl.px = 30.5; g.ctrl.py = 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
      g.cam.snap(30.5, 2, 14);
    });
    await gameWait(page, 1.2);
    await page.keyboard.press('KeyE');
    await gameWait(page, 0.6);
    await page.click('#deliver');
    await page.waitForFunction(() => window.__game.finale.phase === 'page', null, { timeout: 60000 });
    await gameWait(page, 4.0);
    await shot(page, 'ending-page', { settle: 0.2 });
  } catch (e) { errors.push('ending-page: ' + e.message); }
  await page.context().close();
}

writeFileSync(`${OUT}/stats.json`, JSON.stringify(stats, null, 1));
console.log(errors.length ? errors.join('\n') : 'no page errors');
await browser.close();
