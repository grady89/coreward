// Fixed shot list for the 2026-11-23 polish pass: the eight creatures the
// 2026-11-22 visual pass never reviewed, and the Quarters with every
// furnishing, wing and palette. Same seed and framing every run.
//
// Usage: npm run build && npx vite preview --port 4193 --strictPort, then
//   node scripts/polishshots.mjs <outdir> [--port=4193] [--only=substr]
// Shoots on the hardware GPU (d3d11). Writes <outdir>/<shot>.png and stats.json.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';

const args = process.argv.slice(2);
const opt = (k, d) => (args.find(a => a.startsWith(`--${k}=`)) ?? '').split('=')[1] ?? d;
const OUT = args.find(a => !a.startsWith('--')) ?? 'shots';
const URL = `http://localhost:${opt('port', '4193')}`;
const ONLY = opt('only', '');
const SEED = 'seed=12345';
mkdirSync(OUT, { recursive: true });
const want = (...names) => !ONLY || names.some(n => n.includes(ONLY));

const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const stats = {};
const errors = [];

async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
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

const gameWait = (page, s) => page.evaluate(async s => {
  const g = window.__game, t0 = g.time, w0 = performance.now();
  while (g.time - t0 < s && performance.now() - w0 < 30000) await new Promise(r => setTimeout(r, 30));
}, s);

async function shot(page, name, scene) {
  if (ONLY && !name.includes(ONLY)) return;
  await page.evaluate(() => { const g = window.__game; g.comms?.clear(); g.hud?.clearToasts(); });
  await page.waitForTimeout(500);
  stats[name] = await page.evaluate(scene => {
    const g = window.__game, r = g.renderer.info.render;
    return { calls: r.calls, triangles: r.triangles, scene };
  }, scene);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('shot', name, JSON.stringify(stats[name]));
}

// ------------------------------------------------------------ creatures not yet reviewed
const CREATURES = ['longone', 'mimic', 'kindled', 'rimewings', 'brinewyrm', 'frostbloom', 'polyps', 'riptide'];
// where each lives on __game.threats (frostbloom is tiles in the rock: framed by the sandbox)
const THREAT_KEY = { longone: 'longOne', mimic: 'mimics', kindled: 'kindled', rimewings: 'rimewings', brinewyrm: 'brinewyrm', polyps: 'polyps', riptide: 'riptide' };
for (const f of CREATURES) {
  if (!want(`creature-${f}`)) continue;
  const page = await newPage();
  await page.goto(`${URL}/?fauna=${f}&${SEED}`);
  await page.waitForFunction(() => window.__game?.mode === 'play', null, { timeout: 90000 });
  // the sandbox stages beside live hazards: keep the pod topped up while it primes
  await page.evaluate(async () => {
    const g = window.__game, t0 = g.time, w0 = performance.now();
    while (g.time - t0 < 6 && performance.now() - w0 < 30000) {
      g.state.hull = g.state.maxHull; g.state.fuel = g.state.maxFuel;
      await new Promise(r => setTimeout(r, 20));
    }
  });
  await page.keyboard.press('KeyH'); // hide the sandbox card
  // centre the frame on the creature itself: the union of its visible meshes,
  // measured again right before each shot because the creatures move
  const measure = () => page.evaluate(key => {
    const g = window.__game, root = key && g.threats[key];
    if (!root) return null;
    const objs = new Map();
    const scan = (v, d) => {
      if (!v || typeof v !== 'object' || d > 3) return;
      if (v.isObject3D) { objs.set(v.uuid, v); return; }
      for (const k of Object.keys(v)) scan(v[k], d + 1);
    };
    scan(root, 0);
    const inScene = o => { for (let p = o; p; p = p.parent) { if (!p.visible) return false; if (p.isScene) return true; } return false; };
    const boxes = [];
    for (const o of objs.values()) o.traverse(m => {
      if (!(m.isMesh || m.isInstancedMesh) || !inScene(m)) return;
      m.updateWorldMatrix(true, false);
      m.geometry.computeBoundingBox();
      const gb = m.geometry.boundingBox;
      if (!gb || !isFinite(gb.min.x)) return;
      const add = mat => {
        const b = gb.clone().applyMatrix4(mat);
        if (b.max.x - b.min.x > 30 || b.max.y - b.min.y > 30) return;   // a backdrop, not a body
        boxes.push([b.min.x, b.min.y, b.max.x, b.max.y]);
      };
      if (m.isInstancedMesh) {
        // each instance is its own body (a swarm is one mesh)
        const im = m.matrixWorld.clone(), mi = m.matrixWorld.clone();
        for (let i = 0; i < m.count; i++) {
          m.getMatrixAt(i, mi);
          const e = mi.elements;
          if (Math.abs(e[0]) + Math.abs(e[5]) + Math.abs(e[10]) < 1e-4) continue;   // collapsed = hidden
          add(im.clone().multiply(mi));
        }
      } else add(m.matrixWorld);
    });
    if (!boxes.length) return null;
    // a swarm or a pair spreads wide: frame the cluster nearest the pod
    const cx = b => (b[0] + b[2]) / 2, cy = b => (b[1] + b[3]) / 2;
    const px = g.ctrl.px, py = g.ctrl.py;
    const seed = boxes.reduce((a, b) => Math.hypot(cx(b) - px, cy(b) - py) < Math.hypot(cx(a) - px, cy(a) - py) ? b : a);
    const near = boxes.filter(b => Math.hypot(cx(b) - cx(seed), cy(b) - cy(seed)) < 4.5);
    const lo = [Math.min(...near.map(b => b[0])), Math.min(...near.map(b => b[1]))];
    const hi = [Math.max(...near.map(b => b[2])), Math.max(...near.map(b => b[3]))];
    return { x: (lo[0] + hi[0]) / 2, y: (lo[1] + hi[1]) / 2, size: Math.max(hi[0] - lo[0], hi[1] - lo[1]), parts: near.length };
  }, THREAT_KEY[f]);
  const aim = (box, close) => page.evaluate(([box, close]) => {
    const c = window.__game.cam; c.follow = () => {};
    if (!c.__stage) c.__stage = { x: c.cx, y: c.cy, z: c.cz };
    const st = c.__stage;
    const z = close ? (box ? Math.min(st.z, Math.max(5, Math.min(10, box.size * 1.4))) : Math.max(4.5, st.z * 0.55)) : st.z;
    c.snap(box ? box.x : st.x, box ? box.y : st.y, z);
  }, [box, close]);
  let box = await measure();
  await aim(box, false);
  await gameWait(page, 0.5);
  await aim(box = await measure(), false);
  await shot(page, `creature-${f}`, 'play');
  await aim(box = await measure(), true);
  await gameWait(page, 0.3);
  await aim(box = await measure(), true);
  await shot(page, `creature-${f}-close`, 'play');
  console.log('framed', f, JSON.stringify(box));
  await page.context().close();
}

// ------------------------------------------------------------ the Quarters
const QSHOTS = ['quarters-'];
if (want(...QSHOTS, 'quarters-stock', 'quarters-full', 'quarters-gallery', 'quarters-vivarium', 'quarters-palette', 'quarters-close')) {
  const page = await newPage();
  await page.goto(`${URL}/?${SEED}`);
  await page.waitForFunction(() => !!window.__game && !!document.querySelector('#t-new'), null, { timeout: 60000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => !!document.querySelector('#t-new'), null, { timeout: 60000 });
  await page.click('#t-new');
  await page.waitForTimeout(400);
  if (await page.evaluate(() => window.__game.mode === 'title')) await page.click('#t-new').catch(() => {});
  await page.waitForFunction(() => window.__game?.mode === 'play', null, { timeout: 90000 });
  await gameWait(page, 1.0);
  await page.evaluate(() => { const g = window.__game; g.threats.level = 'off'; });

  /** dress the room from meta, then stand the suit at x and hold the camera there */
  const stage = (meta, x, close = null) => page.evaluate(([meta, x, close]) => {
    const g = window.__game;
    Object.assign(g.meta, meta);
    if (g.mode !== 'interior') g.enterInterior();
    const i = g.interior;
    i.rebuild();
    i.px = x; i.cx = x; i.vx = 0;
    // a close-up overrides the corridor camera after each frame
    if (!i.__frame) i.__frame = i.frame.bind(i);
    i.frame = (dt, input, paused) => {
      i.__frame(dt, input, paused);
      if (i.__close) { i.camera.position.set(...i.__close.pos); i.camera.lookAt(...i.__close.at); }
    };
    i.__close = close;
  }, [meta, x, close]);
  const settle = () => page.waitForTimeout(900);

  const EMPTY = { furnishings: [], palette: '', trophies: [], sponsored: [] };
  const ALL_ITEMS = ['rug', 'lamp', 'plant', 'bunk', 'galley', 'shelf', 'radio', 'chart'];
  const FULL = {
    furnishings: [...ALL_ITEMS, 'wing-gallery', 'wing-vivarium'],
    palette: '',
    // a cut stone of each of six rare ores, two flawless
    trophies: [10, 13, 14, 15, 16, 17].map((t, i) => ({ t, grade: i % 3 === 2 ? 2 : 1, world: 'veil3' })),
    sponsored: ['glimmerflies', 'longone', 'mimic', 'rimewings', 'brinewyrm', 'stillwalker', 'frostbloom', 'polyps', 'riptide', 'shellbacks', 'warden', 'kindled'],
  };

  // stock hall, as a new player first walks in
  for (const [n, x] of [['west', 4], ['mid', 11], ['east', 18.5]]) {
    if (!want(`quarters-stock-${n}`)) continue;
    await stage(EMPTY, x); await settle();
    await shot(page, `quarters-stock-${n}`, 'interior');
  }
  // every furnishing bought, both wings open
  for (const [n, x] of [['west', 4], ['mid', 11], ['east', 18.5]]) {
    if (!want(`quarters-full-${n}`)) continue;
    await stage(FULL, x); await settle();
    await shot(page, `quarters-full-${n}`, 'interior');
  }
  if (want('quarters-gallery')) { await stage(FULL, 29); await settle(); await shot(page, 'quarters-gallery', 'interior'); }
  if (want('quarters-vivarium')) { await stage(FULL, 41.5); await settle(); await shot(page, 'quarters-vivarium', 'interior'); }
  // the three bought palettes, fully furnished
  for (const pal of ['slate', 'rose', 'verdant']) {
    if (!want(`quarters-palette-${pal}`)) continue;
    await stage({ ...FULL, palette: pal }, 11); await settle();
    await shot(page, `quarters-palette-${pal}`, 'interior');
  }
  // close-ups along the hall: each furnishing at the scale a player leans in
  for (let k = 0; k < 4; k++) {
    const name = `quarters-close-${k + 1}`;
    if (!want(name)) continue;
    const x = 3 + k * 5.5;
    await stage(FULL, x, { pos: [x, 1.0, 3.2], at: [x, 0.9, -1.2] }); await settle();
    await shot(page, name, 'interior');
  }
  await page.context().close();
}

writeFileSync(`${OUT}/stats.json`, JSON.stringify(stats, null, 1));
console.log(errors.length ? errors.join('\n') : 'no page errors');
await browser.close();
