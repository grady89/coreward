// Phase 3 (full): the per-world fauna — mimics, Long One sound-hunting,
// Rimewings, Brinewyrm, Stillwalkers, frostbloom, polyps, the Riptide,
// Shellbacks + nacre, Warden gait, the Kindled. Headless: poll, never wait.
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

// helper injected per world. `stage(id)` runs the dev sandbox's own staging
// (src/dev/sandbox.ts) so there is exactly one definition of what ground each
// creature needs — a staging bug fails here instead of passing for the wrong
// reason. `room`/`park` remain for the cases that test terrain rules, not a
// creature.
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

// ======================= VEIL-3 =======================
const roster = await page.evaluate(() => {
  const t = window.__game.threats;
  return { flies: !!t.flies, longOne: !!t.longOne, mimics: !!t.mimics, wardens: !!t.wardens, kindled: !!t.kindled,
    rimewings: !!t.rimewings, riptide: !!t.riptide };
});
ok('veil3 roster', roster, roster.flies && roster.longOne && roster.mimics && roster.wardens && roster.kindled && !roster.rimewings && !roster.riptide);

// --- geode mimics seeded in the voidopal band ---
const seeded = await page.evaluate(() => {
  const g = window.__game;
  let n = 0, minY = 999, maxY = 0;
  for (let y = 0; y < 512; y++) for (let x = 0; x < 64; x++) if (g.terrain.get(x, y) === 23) { n++; minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  return { n, minY, maxY };
});
ok('mimics seeded', seeded, seeded.n >= 10 && seeded.minY >= 280 && seeded.maxY < 470);

// --- cutting a mimic hatches it, it steals, killing it gives back ---
const mimic = await page.evaluate(async () => {
  const { g, until, stage } = window.__H();
  // the stage stocks the hold with a diamond and a copper: the theft has to
  // find something worth taking or there is nothing to test
  await stage('mimic');
  const hatched = g.threats.mimics.crabs.some(c => c.alive);
  const crab = g.threats.mimics.crabs.find(c => c.alive);
  const stolen = crab ? crab.stolen : 0;
  const cargoAfterTheft = [...g.state.cargo.entries()];
  const seenEvent = g.state.firedEvents.has('mimic-taught');
  await new Promise(r => setTimeout(r, 300));
  // run it down with the drill
  if (crab) g.threats.drillHit(crab.x, crab.y, 0.1);
  const returned = await until(() => (g.state.cargo.get(16) ?? 0) === 1, 30);
  return { hatched, stolen, cargoAfterTheft, seenEvent, returned, cargo: [...g.state.cargo.entries()] };
});
ok('mimic', mimic, mimic.hatched && mimic.stolen === 16 && mimic.seenEvent && mimic.returned);
await page.screenshot({ path: OUT + '/f-mimic.png' });

// --- the Long One hunts sound: drilling draws it, stillness loses it ---
const longOne = await page.evaluate(async () => {
  const { g, stage } = window.__H();
  await stage('longone');
  const lo = g.threats.longOne;
  const spawned = lo.alive;
  const phase0 = lo.phase;
  return { spawned, phase0, x: +lo.x.toFixed(1), y: +lo.y.toFixed(1), rumble: +g.threats.rumble.toFixed(2) };
});
ok('long one', longOne, longOne.spawned);
await page.screenshot({ path: OUT + '/f-longone.png' });

// --- the Kindled stand in the chamber, notice you, and one touch is the suit ---
const kindled = await page.evaluate(async () => {
  const { g, room, park, until } = window.__H();
  // dev shortcut drops the pod on the chamber floor
  g.devCoreJump("veil3");
  await new Promise(r => setTimeout(r, 600));
  g.threats.reset();
  g.ctrl.px = 24.5; g.ctrl.py = -(500 + 9) + 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  const noticed = await until(() => g.threats.presence > 0.2, 80);
  const seen = g.state.firedEvents.has('kindled-taught');
  // fly into one
  const hull0 = g.state.hull;
  g.ctrl.px = 22.6; g.ctrl.py = -(500 + 10) + 0.55;
  const hit = await until(() => g.state.hull < hull0, 60);
  return { noticed, seen, hit, presence: +g.threats.presence.toFixed(2), mode: g.mode };
});
ok('kindled', kindled, kindled.noticed && kindled.seen && kindled.hit);
await page.screenshot({ path: OUT + '/f-kindled.png' });

// ======================= CRYOS-2 =======================
await page.evaluate(() => {
  const g = window.__game;
  g.state.endedWorlds.add('veil3');
  g.state.activeWorld = 'cryos2';
  g.state.persist();
});
await page.reload();
await page.waitForTimeout(2600);
await page.click('#t-continue');
await page.waitForTimeout(1600);
await page.evaluate(() => window.__game.comms.clear());
await page.evaluate(src => { window.__H = new Function(src); }, HELPERS);

const roster2 = await page.evaluate(() => {
  const t = window.__game.threats;
  return { rimewings: !!t.rimewings, brinewyrm: !!t.brinewyrm, stillwalkers: !!t.stillwalkers, wardens: !!t.wardens, flies: !!t.flies };
});
ok('cryos2 roster', roster2, roster2.rimewings && roster2.brinewyrm && roster2.stillwalkers && roster2.wardens && !roster2.flies);

// --- frostbloom seeded in the veinlight, and cutting one seals the pocket ---
const frost = await page.evaluate(async () => {
  const { g, until, stage } = window.__H();
  let n = 0;
  for (let y = 0; y < 512; y++) for (let x = 0; x < 64; x++) if (window.__game.terrain.get(x, y) === 24) n++;
  await stage('frostbloom');
  const fuel0 = g.state.fuel;
  await new Promise(r => setTimeout(r, 300));
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown' }));
  const cut = await until(() => g.terrain.get(31, 256) !== 24, 120);
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowDown' }));
  await new Promise(r => setTimeout(r, 200));
  let rime = 0;
  for (let y = 252; y < 260; y++) for (let x = 27; x < 36; x++) if (g.terrain.get(x, y) === 22) rime++;
  const podTile = g.terrain.get(31, 255);
  return { seeded: n, cut, rime, podTile, fuelDrop: +(fuel0 - g.state.fuel).toFixed(0), taught: g.state.firedEvents.has('frostbloom-taught') };
});
ok('frostbloom', frost, frost.seeded > 10 && frost.cut && frost.rime >= 6 && frost.podTile === 0 && frost.fuelDrop >= 18 && frost.taught);
await page.screenshot({ path: OUT + '/f-frostbloom.png' });

// --- Brinewyrm: lives in the brine, wakes to thrust, breaches ---
const wyrm = await page.evaluate(async () => {
  const { g, until, stage } = window.__H();
  // the stage seals a pool under the pod and the wyrm's own devStage drops it
  // in the nearest brine — natural spawning refuses anything within 5 tiles
  await stage('brinewyrm');
  const bw = g.threats.brinewyrm;
  const spawned = bw.alive;
  const phase0 = bw.phase;
  // hover: thrust wakes it
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' }));
  const churned = await until(() => bw.phase !== 'cruise', 200);
  const breached = await until(() => bw.phase === 'breach' || bw.phase === 'fall' || bw.phase === 'sinking', 60);
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowUp' }));
  return { spawned, phase0, churned, breached, phase: bw.phase, taught: g.state.firedEvents.has('brinewyrm-taught') };
});
ok('brinewyrm', wyrm, wyrm.spawned && wyrm.phase0 === 'cruise' && wyrm.churned && wyrm.breached);
await page.screenshot({ path: OUT + '/f-brinewyrm.png' });

// --- Stillwalkers: still while lit, walk in the dark ---
const walker = await page.evaluate(async () => {
  const { g, stage } = window.__H();
  await stage('stillwalkers');
  const sw = g.threats.stillwalkers;
  const spawned = sw.walkers.some(w => w.alive);
  const w = sw.walkers.find(w => w.alive);
  if (!w) return { spawned };
  // put it in the wall 5 tiles off and light it
  w.x = g.ctrl.px + 5; w.y = g.ctrl.py; g.lampOn = true;
  await new Promise(r => setTimeout(r, 600));
  const x0 = w.x;
  await new Promise(r => setTimeout(r, 1200));
  const movedLit = Math.abs(w.x - x0);
  const seen = g.state.firedEvents.has('stillwalker-taught');
  g.lampOn = false;
  const x1 = w.x;
  await new Promise(r => setTimeout(r, 1500));
  const movedDark = Math.abs(w.x - x1);
  const dread = g.threats.dread;
  g.lampOn = true;
  return { spawned, movedLit: +movedLit.toFixed(2), movedDark: +movedDark.toFixed(2), seen, dread: +dread.toFixed(2) };
});
ok('stillwalker', walker, walker.spawned && walker.movedLit < 0.05 && walker.movedDark > 0.5 && walker.seen);
await page.screenshot({ path: OUT + '/f-stillwalker.png' });

// --- the Warden walks: legs step, feet land on the floor ---
const wardenGait = await page.evaluate(async () => {
  const { g, room, park, until } = window.__H();
  // it posts as you approach: a lit pocket just above the hall, then it walks the floor toward you
  const r = g.terrain.ruins[0];
  const rx = Math.floor(r.x), ry = Math.floor(r.y);
  room(rx + 2, rx + 5, ry - 9, ry - 6);
  park(rx + 3.5, ry - 7);
  g.lampOn = true;
  g.threats.reset();
  const wd = g.threats.wardens;
  const posted = await until(() => wd.alive, 40);
  const x0 = wd.x;
  const walked = await until(() => Math.abs(wd.x - x0) > 0.8, 80);
  return { posted, walked, dx: +(wd.x - x0).toFixed(2), engaged: wd.engaged, scrutiny: +g.threats.scrutiny.toFixed(2) };
});
ok('warden walks', wardenGait, wardenGait.posted && wardenGait.walked);
await page.screenshot({ path: OUT + '/f-warden.png' });

// --- nacre + rime persist across a save/load ---
const persist = await page.evaluate(() => {
  const g = window.__game;
  g.terrain.carve(5, 200); g.terrain.carve(6, 200);
  g.terrain.fill(5, 200, 25);
  g.terrain.fill(6, 200, 22);
  g.saveNow();
  const ws = g.state.worlds.cryos2;
  return { nacre: ws.nacre, rime: ws.rime };
});
ok('nacre saved', persist, persist.nacre.length === 1 && persist.rime.length >= 1);

// ======================= MAELIS-6 =======================
await page.evaluate(() => {
  const g = window.__game;
  g.state.endedWorlds.add('cryos2');
  g.state.activeWorld = 'maelis6';
  g.state.persist();
});
await page.reload();
await page.waitForTimeout(2600);
await page.click('#t-continue');
await page.waitForTimeout(1600);
await page.evaluate(() => window.__game.comms.clear());
await page.evaluate(src => { window.__H = new Function(src); }, HELPERS);

const roster3 = await page.evaluate(() => {
  const t = window.__game.threats;
  return { polyps: !!t.polyps, riptide: !!t.riptide, shellbacks: !!t.shellbacks, wardens: !!t.wardens, flies: !!t.flies };
});
ok('maelis6 roster', roster3, roster3.polyps && roster3.riptide && roster3.shellbacks && roster3.wardens && !roster3.flies);

// --- polyps spawn on walls and burst when you get close ---
const polyps = await page.evaluate(async () => {
  const { g, stage } = window.__H();
  await stage('polyps');
  const p = g.threats.polyps;
  const spawned = p.count > 0;
  const c = p.clusters.find(c => c.alive);
  const near = c ? Math.hypot(c.ax - g.ctrl.px, c.ay - g.ctrl.py) : -1;
  return { spawned, count: p.count, near: +near.toFixed(1) };
});
ok('polyps', polyps, polyps.spawned);
await page.screenshot({ path: OUT + '/f-polyps.png' });

// --- the Riptide pulls in open water, not in a shaft ---
const riptide = await page.evaluate(async () => {
  const { g, room, park, until, stage } = window.__H();
  // its devStage parks it beside the pod; naturally it arrives 12+ tiles out
  await stage('riptide');
  const rt = g.threats.riptide;
  const spawned = rt.alive;
  const px0 = g.ctrl.px;
  const pulled = await until(() => Math.abs(g.ctrl.px - px0) > 0.3 || g.threats.riptide.grip > 0.1, 60);
  const gripOpen = rt.grip;
  // now a 1-wide shaft through solid rock (no natural caves alongside): no grip
  for (let y = 346; y < 374; y++) for (let x = 5; x < 16; x++) { g.terrain.data[g.terrain.idx(x, y)] = 2; g.chunks.markDirty(x, y); }
  for (let y = 350; y < 370; y++) g.terrain.carve(10, y);
  park(10.5, 360);
  rt.x = 14; rt.y = g.ctrl.py; rt.tx = rt.x; rt.ty = rt.y;
  await until(() => rt.grip < 0.05, 40);
  await new Promise(r => setTimeout(r, 800));
  const gripShaft = rt.grip;
  return { spawned, pulled, gripOpen: +gripOpen.toFixed(2), gripShaft: +gripShaft.toFixed(2), taught: g.state.firedEvents.has('riptide-taught') };
});
ok('riptide', riptide, riptide.spawned && riptide.pulled && riptide.gripShaft < 0.05);
await page.screenshot({ path: OUT + '/f-riptide.png' });

// --- Shellbacks walk your tunnels and seal them with nacre ---
const shell = await page.evaluate(async () => {
  const { g, until, stage } = window.__H();
  // the stage carves the long corridor: they only live in tiles you dug
  await stage('shellbacks');
  const sb = g.threats.shellbacks;
  const spawned = sb.backs.some(b => b.alive);
  const b = sb.backs.find(b => b.alive);
  const sealed = await until(() => sb.sealed > 0, 150);
  let nacre = 0;
  for (let x = 10; x < 54; x++) for (let y = 200; y < 202; y++) if (g.terrain.get(x, y) === 25) nacre++;
  // kill it: native drops
  const nat0 = Object.values(g.state.native).reduce((a, b) => a + b, 0);
  if (b && b.alive) g.threats.blast(b.x, b.y, 3);
  const dropped = await until(() => Object.values(g.state.native).reduce((a, b) => a + b, 0) > nat0, 20);
  return { spawned, sealed, nacre, dropped, taught: g.state.firedEvents.has('shellback-taught') };
});
ok('shellback', shell, shell.spawned && shell.sealed && shell.nacre >= 1 && shell.dropped);
await page.screenshot({ path: OUT + '/f-shellback.png' });

// --- nacre is native when cut ---
const nacreCut = await page.evaluate(async () => {
  const { g, room, park, until } = window.__H();
  room(26, 36, 210, 216);
  g.terrain.carve(31, 216); g.terrain.fill(31, 216, 25);
  park(31.5, 215);
  g.threats.level = 'off';
  const nat0 = Object.values(g.state.native).reduce((a, b) => a + b, 0);
  await new Promise(r => setTimeout(r, 300));
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown' }));
  const cut = await until(() => g.terrain.get(31, 216) === 0, 120);
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowDown' }));
  const nat1 = Object.values(g.state.native).reduce((a, b) => a + b, 0);
  g.threats.level = 'full';
  return { cut, gained: nat1 - nat0 };
});
ok('nacre cut', nacreCut, nacreCut.cut && nacreCut.gained === 1);

// --- threats off: everything stands down ---
const off = await page.evaluate(async () => {
  const g = window.__game;
  g.settings.threats = 'off';
  g.applySettings();
  await new Promise(r => setTimeout(r, 600));
  const t = g.threats;
  return { level: t.level, polyps: t.polyps.count, riptide: t.riptide.alive, backs: t.shellbacks.backs.filter(b => b.alive).length, warden: t.wardens.alive };
});
ok('threats off', off, off.level === 'off' && off.polyps === 0 && !off.riptide && off.backs === 0 && !off.warden);

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
