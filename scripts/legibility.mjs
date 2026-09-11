// Threat legibility + economy honesty (OVERHAUL Phases 3-4): the lance is a
// light-verb everywhere (scatters swarms, staggers the worm, blinds the
// Warden, pops polyps clean, uncurls a Shellback — nothing dies but a mimic),
// the stillwalker's dread wash is a real DOM layer, a lanced stillwalker
// flash-freezes, the rimewing warm/settle cycle closes, the polyp dial
// answers to distance, and engine tiers finally buy the climb.
// Headless: poll, never wait.
import { chromium } from 'playwright';

const OUT = process.argv[2] ?? '.';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
const ok = (name, obj, pass) => console.log(name + ':', JSON.stringify(obj), pass ? 'OK' : 'FAIL');

await page.goto('http://localhost:4173');
await page.waitForTimeout(2500);
await page.evaluate(() => localStorage.clear());
await page.click('#t-new');
await page.waitForTimeout(3600);
await page.evaluate(() => window.__game.comms.clear());

const HELPERS = `
  const g = window.__game;
  const room = (x0, x1, y0, y1) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) g.terrain.carve(x, y); };
  const park = (x, y) => { g.ctrl.drilling = null; g.ctrl.px = x; g.ctrl.py = -y + 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0; g.cam.snap(x, -y, 12.5); };
  const until = async (fn, n = 60, ms = 100) => { for (let i = 0; i < n; i++) { if (fn()) return true; await new Promise(r => setTimeout(r, ms)); } return fn(); };
  const stage = async id => {
    g.devStage(id);
    const s = window.__STAGES.find(s => s.id === id);
    g.state.hull = 100000;
    await until(() => s.alive(g.threats), 90);
    return s;
  };
  g.state.hull = 100000; g.state.fuel = g.state.maxFuel; g.state.upgrades.radiator = 5; g.state.upgrades.drill = 5;
  return { g, room, park, until, stage };
`;
await page.evaluate(src => { window.__H = new Function(src); }, HELPERS);

// ======================= VEIL-3: the lance scatters, never deletes =======================
const scatter = await page.evaluate(async () => {
  const { g, until, stage } = window.__H();
  await stage('glimmerflies');
  const flies = g.threats.flies;
  // lamp on: let the swarm wake and pour toward the pod
  const woke = await until(() => flies.swarms.some(s => s.alive && s.alerted), 120);
  await until(() => flies.flies.some(f => Math.hypot(f.x - g.ctrl.px, f.y - g.ctrl.py) < 6), 80);
  const before = flies.flies.length;
  g.threats.lance(g.ctrl.px - 1, g.ctrl.py, 1, 10);
  await new Promise(r => setTimeout(r, 250));
  const after = flies.flies.length;
  const stunned = flies.flies.filter(f => f.stunT > 0).length;
  const swarm = flies.swarms.find(s => s.alive);
  return { woke, before, after, stunned, dazed: swarm ? swarm.dazedT > 0 : false, alerted: swarm?.alerted ?? null };
});
ok('lance scatters flies', scatter,
  scatter.woke && scatter.before > 0 && scatter.after === scatter.before && scatter.stunned > 0 && (scatter.dazed || !scatter.alerted));
await page.screenshot({ path: OUT + '/l-scatter.png' });

// --- the lance staggers the Long One: a light-verb, not a kill ---
const wormStun = await page.evaluate(async () => {
  const { g, until, stage } = window.__H();
  await stage('longone');
  const worm = g.threats.longOne;
  // the shot is a horizontal corridor from wherever it starts — fire from
  // just beside the worm's own head, same tick, so its wander can't dodge it
  const near = await until(() => worm.alive, 60);
  g.threats.lance(worm.x - 4, worm.y, 1, 10);
  await new Promise(r => setTimeout(r, 200));
  return { near, stunned: worm.stunT > 0, aliveAfter: worm.alive !== false };
});
ok('lance staggers the worm', wormStun, wormStun.near && wormStun.stunned && wormStun.aliveAfter);

// --- the lance blinds the Warden: too much light, and it disengages ---
const wblind = await page.evaluate(async () => {
  const { g, until, stage } = window.__H();
  await stage('warden');
  const w = g.threats.wardens;
  const posted = await until(() => w.alive, 90);
  // pin level with the machine, five tiles off — the lance is a horizontal shot
  g.ctrl.drilling = null; g.ctrl.px = w.x - 5; g.ctrl.py = w.y; g.ctrl.vx = 0; g.ctrl.vy = 0;
  await new Promise(r => setTimeout(r, 150));
  g.threats.lance(g.ctrl.px, g.ctrl.py, 1, 10);
  await new Promise(r => setTimeout(r, 200));
  return { posted, blind: w.blindT > 0, disengaged: !w.engaged };
});
ok('lance blinds the warden', wblind, wblind.posted && wblind.blind && wblind.disengaged);

// ======================= CRYOS-2: dread wash + the flash-freeze rhyme =======================
await page.evaluate(() => {
  const g = window.__game;
  g.state.endedWorlds.add('veil3');
  g.state.activeWorld = 'cryos2';
  g.state.ephemeral = false;
  g.state.persist();
});
await page.reload();
await page.waitForTimeout(2600);
await page.click('#t-continue');
await page.waitForTimeout(1600);
await page.evaluate(() => window.__game.comms.clear());
await page.evaluate(src => { window.__H = new Function(src); }, HELPERS);

// the promised red wash: lamp off, something walks, the edges redden
const dread = await page.evaluate(async () => {
  const { g, until, stage } = window.__H();
  await stage('stillwalkers');
  g.lampOn = false;
  const rose = await until(() => g.threats.dread > 0.15, 150);
  // the wash rides a 0.35s CSS transition — poll the computed value, don't race it
  const washEl = document.querySelector('#dread-wash');
  const washed = await until(() => !!washEl && parseFloat(getComputedStyle(washEl).opacity) > 0.05, 40);
  const wash = washEl ? parseFloat(getComputedStyle(washEl).opacity) : -1;
  return { rose, washed, dread: Math.round(g.threats.dread * 100) / 100, wash };
});
ok('dread wash', dread, dread.rose && dread.washed);
await page.screenshot({ path: OUT + '/l-dread.png' });

// the light-phobic creature finally answers to the biggest light in the game
const freeze = await page.evaluate(async () => {
  const { g, until } = window.__H();
  const sw = g.threats.stillwalkers;
  const near = await until(() => sw.walkers.some(w =>
    w.alive && Math.abs(w.y - g.ctrl.py) < 1.4 && Math.abs(w.x - g.ctrl.px) < 9), 150);
  const w = sw.walkers.find(w => w.alive);
  if (!w) return { near, frozen: false };
  g.threats.lance(g.ctrl.px, g.ctrl.py, w.x >= g.ctrl.px ? 1 : -1, 10);
  await new Promise(r => setTimeout(r, 200));
  const frozen = w.freezeT > 0;
  const x0 = w.x;
  await new Promise(r => setTimeout(r, 900));
  return { near, frozen, held: Math.abs(w.x - x0) < 0.2, lampStillOff: !g.lampOn };
});
ok('lance flash-freeze', freeze, freeze.near && freeze.frozen && freeze.held && freeze.lampStillOff);

// --- the rimewing cycle: warmth wakes them, cold settles and relocks them ---
const settle = await page.evaluate(async () => {
  const { g, until, stage } = window.__H();
  g.lampOn = true;
  await stage('rimewings');
  const rw = g.threats.rimewings;
  const cluster = () => rw.clusters.find(c => c.alive);
  // a real burn: warmth is thruster wash, and it takes 1.3 s to shiver loose
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' }));
  const woke = await until(() => {
    const c = cluster();
    return !!c && (c.phase === 'waking' || c.phase === 'hunting');
  }, 120);
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowUp' }));
  // cut the engine: after ~2.4 s of cold they settle, then lock again
  const settling = await until(() => {
    const c = cluster();
    return !!c && (c.phase === 'settling' || c.phase === 'frozen');
  }, 180);
  const relocked = await until(() => cluster()?.phase === 'frozen', 120);
  return { woke, settling, relocked, phase: cluster()?.phase ?? null };
});
ok('rimewing settle cycle', settle, settle.woke && settle.settling && settle.relocked);

// ======================= MAELIS-6: the polyp answers to distance =======================
await page.evaluate(() => {
  const g = window.__game;
  g.state.endedWorlds.add('cryos2');
  g.state.activeWorld = 'maelis6';
  g.state.ephemeral = false;
  g.state.persist();
});
await page.reload();
await page.waitForTimeout(2600);
await page.click('#t-continue');
await page.waitForTimeout(1600);
await page.evaluate(() => window.__game.comms.clear());
await page.evaluate(src => { window.__H = new Function(src); }, HELPERS);

const polyp = await page.evaluate(async () => {
  const { g, until, stage } = window.__H();
  await stage('polyps');
  const ps = g.threats.polyps;
  const p = ps.polyps.find(p => p.alive);
  if (!p) return { staged: false };
  // hover two tiles off the sac along its own normal — the side that faces
  // open room — and PIN the pod there: gravity must not smuggle in speed
  const hx = p.x + p.nx * 2.2, hy = p.y + p.ny * 2.2;
  const pin = () => { g.ctrl.drilling = null; g.ctrl.px = hx; g.ctrl.py = hy; g.ctrl.vx = 0; g.ctrl.vy = 0; };
  pin();
  g.cam.snap(hx, hy, 12.5);
  // the sacs alive right now are the witnesses; later cluster SPAWNS are not deaths
  const watch = ps.polyps.map((q, i) => (q.alive ? i : -1)).filter(i => i >= 0);
  let maxInflate = 0, noticed = false;
  const t0 = g.time;
  // ten game-seconds parked: they may swell, they must not go off
  await until(() => {
    pin();
    maxInflate = Math.max(maxInflate, ...watch.map(i => ps.polyps[i].inflate));
    noticed = noticed || ps.clusters.some(c => c.alive && c.noticed);
    return g.time - t0 > 10;
  }, 900, 50);
  const survived = watch.every(i => ps.polyps[i].alive);
  const d0 = Math.hypot(g.ctrl.px - p.x, g.ctrl.py - p.y);
  return { staged: true, d0: Math.round(d0 * 10) / 10, watched: watch.length, survived,
    maxInflate: Math.round(maxInflate * 100) / 100, noticed };
});
ok('parked pod never bursts a polyp', polyp,
  polyp.staged && polyp.survived && polyp.noticed && polyp.maxInflate < 1);
await page.screenshot({ path: OUT + '/l-polyps.png' });

// --- the lance pops polyps harmlessly, from range ---
const pop = await page.evaluate(async () => {
  const { g, until } = window.__H();
  const ps = g.threats.polyps;
  // clusters rotate on their own clocks — wait for a live sac, don't assume one
  await until(() => ps.polyps.some(p => p.alive), 150);
  const p = ps.polyps.find(p => p.alive);
  if (!p) return { staged: false };
  // pin level with the sac, three tiles off, and fire straight at it
  g.ctrl.drilling = null; g.ctrl.px = p.x - 3; g.ctrl.py = p.y; g.ctrl.vx = 0; g.ctrl.vy = 0;
  await new Promise(r => setTimeout(r, 150));
  const hull0 = g.state.hull;
  g.threats.lance(g.ctrl.px, g.ctrl.py, 1, 10);
  const popped = await until(() => !p.alive, 30);
  return { staged: true, popped, hullSafe: g.state.hull === hull0 };
});
ok('lance pops polyps harmlessly', pop, pop.staged && pop.popped && pop.hullSafe);

// --- the drill curls a Shellback; the lance staggers it back open ---
const curl = await page.evaluate(async () => {
  const { g, until, stage } = window.__H();
  await stage('shellbacks');
  const back = g.threats.shellbacks.backs.find(b => b.alive);
  if (!back) return { staged: false };
  g.threats.drillHit(back.x, back.y, 0.1);
  const curled = await until(() => back.curl > 0.5, 60);
  g.ctrl.drilling = null; g.ctrl.px = back.x - 3; g.ctrl.py = back.y; g.ctrl.vx = 0; g.ctrl.vy = 0;
  await new Promise(r => setTimeout(r, 100));
  g.threats.lance(g.ctrl.px, g.ctrl.py, 1, 10);
  await new Promise(r => setTimeout(r, 200));
  const staggered = back.stagger > 0;
  const uncurled = await until(() => back.curl < 0.5, 90);
  return { staged: true, curled, staggered, uncurled, alive: back.alive };
});
ok('shellback curls and is staggered open', curl,
  curl.staged && curl.curled && curl.staggered && curl.uncurled && curl.alive);

// --- OVERHAUL 4.1: the engine track finally buys the climb ---
const climb = await page.evaluate(async () => {
  const { g, until, room } = window.__H();
  // a private shaft far from the staged fauna: one column, seventy-five rows
  room(4, 7, 10, 86);
  const run = async (tier) => {
    g.state.upgrades.engine = tier;
    g.state.fuel = g.state.maxFuel;
    g.ctrl.drilling = null; g.ctrl.px = 5.5; g.ctrl.py = -84.5; g.ctrl.vx = 0; g.ctrl.vy = 0;
    g.cam.snap(5.5, -60, 12.5);
    await new Promise(r => setTimeout(r, 150));
    const y0 = g.ctrl.py, t0 = g.time;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' }));
    await until(() => g.time - t0 > 2.5, 200, 50);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowUp' }));
    return g.ctrl.py - y0;
  };
  const stock = await run(0);
  const tuned = await run(5);
  return { stock: Math.round(stock * 10) / 10, tuned: Math.round(tuned * 10) / 10,
    gain: Math.round((tuned / Math.max(0.1, stock)) * 100) / 100 };
});
ok('engine tiers buy the climb', climb, climb.stock > 5 && climb.gain >= 1.3);

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
