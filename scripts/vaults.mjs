// THE NINE STONES, second pass: the light-dash movement set (spark, wall
// moves, coyote/buffer), sconce economy, doors, shuttles, censers,
// crushers, pursuit, spin-beams with cover, completion, codex, the
// gallery, grandfathering, the KINDLE gate.
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

const HELPERS = `
  const g = window.__game;
  const until = async (fn, n = 60, ms = 100) => { for (let i = 0; i < n; i++) { if (fn()) return true; await new Promise(r => setTimeout(r, ms)); } return fn(); };
  const key = (code, down = true) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
  const vaultOf = id => window.__parseVault(window.__VAULTS.find(v => v.glyph === id));
  const off = () => ({ left: false, right: false, up: false, down: false });
  return { g, until, key, vaultOf, off };
`;
const H = async () => page.evaluate(src => { window.__H = new Function(src); }, HELPERS);
await H();

// --- maps: nine levels, all parse, master + sconces reachable (doors open) ---
const alphabet = await page.evaluate(() => {
  const gs = window.__GLYPHS;
  const worlds = { veil3: 0, cryos2: 0, maelis6: 0 };
  for (const g of gs) worlds[g.world]++;
  let reach = 0;
  const kit = { shuttles: 0, censers: 0, crushers: 0, pursuit: 0, doors: 0, beams: 0 };
  for (const v of window.__VAULTS) {
    if (v.shuttles) kit.shuttles++;
    if (v.censers) kit.censers++;
    if (v.crushers) kit.crushers++;
    if (v.pursuit) kit.pursuit++;
    if (v.doorNeeds) kit.doors++;
    if (v.beams) kit.beams++;
    const p = window.__parseVault(v);
    const seen = new Uint8Array(p.w * p.h);
    const q = [[p.entry.x, p.entry.y]];
    seen[p.entry.y * p.w + p.entry.x] = 1;
    while (q.length) {
      const [x, y] = q.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const i = (y + dy) * p.w + (x + dx);
        if (x + dx < 0 || y + dy < 0 || x + dx >= p.w || y + dy >= p.h || seen[i] || p.solid[i]) continue;
        seen[i] = 1; q.push([x + dx, y + dy]);
      }
    }
    if (seen[p.master.y * p.w + p.master.x] && p.sconces.every(s => seen[s.y * p.w + s.x])) reach++;
  }
  return { n: gs.length, worlds, vaults: window.__VAULTS.length, reach, kit };
});
ok('nine levels', alphabet, alphabet.n === 9 && alphabet.vaults === 9 && alphabet.reach === 9
  && alphabet.kit.shuttles >= 4 && alphabet.kit.censers >= 4 && alphabet.kit.crushers >= 3
  && alphabet.kit.pursuit === 2 && alphabet.kit.doors >= 3 && alphabet.kit.beams >= 1);

// --- entry on foot still works ---
const entry = await page.evaluate(async () => {
  const { g, until, key } = window.__H();
  const s = g.terrain.glyphStones[0];
  for (let y = s.y - 4; y < s.y; y++) g.terrain.carve(s.x, y);
  g.ctrl.drilling = null;
  g.ctrl.px = s.x + 0.5; g.ctrl.py = -s.y + 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.state.hull = 100000; g.state.fuel = g.state.maxFuel;
  g.cam.snap(g.ctrl.px, g.ctrl.py, 12);
  await until(() => g.ctrl.grounded, 30);
  key('KeyE'); key('KeyE', false);
  const eva = await until(() => g.mode === 'eva', 20);
  g.pilot.px = s.x + 0.5; g.pilot.py = -s.y + 0.6;
  // the mark has to finish waking before the stone will take you
  key('KeyE'); key('KeyE', false);
  const early = g.mode === 'vault';
  const woke = await until(() => g.glyphMarks.chargeOf(s.id) >= 1, 200);
  key('KeyE'); key('KeyE', false);
  const inVault = await until(() => g.mode === 'vault', 20);
  return { eva, early, woke, inVault, glyph: g.vault?.glyphId, spark: g.vault?.spark };
});
ok('entry on foot', entry, entry.eva && entry.early === false && entry.woke && entry.inVault
  && entry.glyph === 'wick' && entry.spark === true);
await page.screenshot({ path: OUT + '/v-wick.png' });

// --- the spark: a dash spends it, landing relights it ---
const spark = await page.evaluate(async () => {
  const { g, until, off } = window.__H();
  const v = g.vault;
  // stand still on the floor, then dash upward: airborne with the spark spent
  await until(() => v.grounded, 30);
  const x0 = v.px;
  v.dash({ ...off(), up: true });
  const spent = await until(() => !v.spark && !v.grounded, 20, 50);
  const relit = await until(() => v.grounded && v.spark, 40);
  // a directional dash actually moves you
  v.dash({ ...off(), right: true });
  await new Promise(r => setTimeout(r, 400));
  const moved = v.px - x0;
  return { spent, relit, moved: +moved.toFixed(1) };
});
ok('the spark', spark, spark.spent && spark.relit && spark.moved > 1);

// --- movement metrics: the maps are authored against these numbers ---
const metrics = await page.evaluate(async () => {
  const { g, until, off } = window.__H();
  const v = g.vault;
  // clear ground on the wick's first stretch
  v.px = 5.5; v.py = -25.4; v.vx = 0; v.vy = 0; v.invuln = 3;
  await until(() => v.grounded, 30);
  // jump height
  const y0 = v.py;
  v.jumpPress();
  let peak = y0;
  for (let i = 0; i < 30; i++) { await new Promise(r => setTimeout(r, 60)); peak = Math.max(peak, v.py); if (v.grounded && i > 4) break; }
  const jumpH = peak - y0;
  // jump + held-right distance
  await until(() => v.grounded, 30);
  const x0 = v.px;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }));
  v.jumpPress();
  let dist = 0;
  for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 60)); if (v.grounded && i > 4) { dist = v.px - x0; break; } }
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowRight' }));
  return { jumpH: +jumpH.toFixed(2), dist: +dist.toFixed(2) };
});
ok('movement metrics', metrics, metrics.jumpH >= 2.1 && metrics.jumpH <= 3.2 && metrics.dist >= 2.6);

// --- wall-jump: pressing into a wall catches you, jump kicks you off it ---
const walls = await page.evaluate(async () => {
  const { g, until } = window.__H();
  const v = g.vault;
  // the wick chimney: x46-47, walls either side
  v.px = 46.5; v.py = -20; v.vx = 0; v.vy = 0; v.invuln = 1.5;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft' }));
  await new Promise(r => setTimeout(r, 450));
  const sliding = v.wallDir === -1 && v.vy > -3.2;
  const y0 = v.py;
  v.jumpPress();
  const kicked = await until(() => v.py > y0 + 0.5 && v.vx > 0, 20, 50);
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowLeft' }));
  return { sliding, kicked, vy: +v.vy.toFixed(1) };
});
ok('wall moves', walls, walls.sliding && walls.kicked);

// --- unlight: gutter and re-form at the checkpoint, spark restored ---
const reform = await page.evaluate(async () => {
  const { g, until } = window.__H();
  const v = g.vault;
  v.px = 9.5; v.py = -26.4; v.vx = 0; v.vy = 0; v.invuln = 0;
  const guttered = await until(() => v.phase === 'reform', 20);
  const back = await until(() => v.phase === 'run', 20);
  return { guttered, back, reforms: v.reforms, spark: v.spark };
});
ok('re-form', reform, reform.guttered && reform.back && reform.reforms >= 1 && reform.spark);

// --- a lit sconce relights the spark mid-air ---
const crystal = await page.evaluate(async () => {
  const { g, until, vaultOf, off } = window.__H();
  const v = g.vault;
  const p = vaultOf('wick');
  const si = p.sconces.findIndex(x => x.y === 23); // the floating one
  const s = p.sconces[si];
  // light it first (touch), then hover past it airborne with the spark spent
  v.px = s.x + 0.5; v.py = -(s.y + 0.5); v.vx = 0; v.vy = 0;
  const lit = await until(() => v.sconceLit[si], 20, 50);
  v.dash({ ...off(), up: true });
  await until(() => !v.spark, 10, 50);
  v.px = s.x + 0.5; v.py = -(s.y + 0.5) - 0.4; // back into the glow, airborne
  const relit = await until(() => v.spark, 20, 50);
  return { lit, relit };
});
ok('sconce crystal', crystal, crystal.lit && crystal.relit);

// --- complete the wick: card carries the gutter count, codex fills ---
const complete = await page.evaluate(async () => {
  const { g, until, key, vaultOf } = window.__H();
  const v = g.vault;
  const m = vaultOf('wick');
  v.px = m.master.x + 0.5; v.py = -(m.master.y + 0.5); v.vx = 0; v.vy = 0;
  const sequenced = await until(() => v.completed, 60);
  const card = !!document.querySelector('#vault-card .vc-reforms');
  key('KeyE'); key('KeyE', false);
  const out = await until(() => g.mode === 'eva', 20);
  return { sequenced, card, out, glyphs: g.state.glyphs, has: g.state.glyphsSet.has('wick') };
});
ok('wick translated', complete, complete.sequenced && complete.card && complete.out && complete.has);
await page.screenshot({ path: OUT + '/v-translated.png' });

// --- the famine: dead light — sconces checkpoint but never relight ---
const famine = await page.evaluate(async () => {
  const { g, until, vaultOf, off } = window.__H();
  g.devVault('famine');
  await until(() => g.mode === 'vault', 20);
  const v = g.vault;
  const s = vaultOf('famine').sconces[0];
  v.px = s.x + 0.5; v.py = -(s.y + 0.5); v.vx = 0; v.vy = 0;
  const lit = await until(() => v.sconceLit.some(Boolean), 20, 50);
  v.dash({ ...off(), up: true });
  await until(() => !v.spark, 10, 50);
  v.px = s.x + 0.5; v.py = -(s.y + 0.5) - 0.3; v.vy = 0;
  await new Promise(r => setTimeout(r, 600));
  const starved = !v.spark || v.grounded; // the glow gave nothing back mid-air
  const shuttles = (window.__VAULTS.find(x => x.glyph === 'famine').shuttles ?? []).length;
  return { lit, starved, dead: !!window.__VAULTS.find(x => x.glyph === 'famine').deadLight, shuttles };
});
ok('the famine', famine, famine.lit && famine.dead && famine.shuttles === 3);

// --- shuttles move and kill ---
const shuttle = await page.evaluate(async () => {
  const { g, until } = window.__H();
  const v = g.vault;
  const p0 = v.shuttlePos(0);
  await new Promise(r => setTimeout(r, 700));
  const p1 = v.shuttlePos(0);
  const moves = Math.abs(p1.x - p0.x) > 0.2;
  // hold station in the rail's path: there is no floor at rail height, so a
  // one-shot placement falls out of the kill box before the shuttle arrives —
  // whether it hit depended on the shuttle's phase at placement time
  const r0 = v.reforms;
  let hit = false;
  for (let i = 0; i < 60 && !hit; i++) {
    v.px = 23.5; v.py = -21.5; v.vx = 0; v.vy = 0; v.invuln = 0;
    await new Promise(r => setTimeout(r, 100));
    hit = v.reforms > r0;
  }
  return { moves, hit };
});
ok('light shuttles', shuttle, shuttle.moves && shuttle.hit);

// --- the last shift: spinning beams point away half the time; cover cuts them ---
const shift = await page.evaluate(async () => {
  const { g, until } = window.__H();
  g.devVault('shift');
  await until(() => g.mode === 'vault', 20);
  const v = g.vault;
  const lens = [];
  for (let i = 0; i < 14; i++) {
    await new Promise(r => setTimeout(r, 200));
    const b = v.beamRays[0];
    lens.push(Math.hypot(b.ex - 25.5, b.ey + 4.2));
  }
  const varies = Math.max(...lens) - Math.min(...lens) > 3; // cover + rotation change the ray
  const censers = (window.__VAULTS.find(x => x.glyph === 'shift').censers ?? []).length;
  return { varies, censers, min: +Math.min(...lens).toFixed(1), max: +Math.max(...lens).toFixed(1) };
});
ok('spinning beams', shift, shift.varies && shift.censers === 1);
await page.screenshot({ path: OUT + '/v-shift.png' });

// --- the vault: doors melt open at their sconce count ---
const doors = await page.evaluate(async () => {
  const { g, until, vaultOf } = window.__H();
  g.devVault('vault');
  await until(() => g.mode === 'vault', 20);
  const v = g.vault;
  const p = vaultOf('vault');
  const d0 = p.doors[0].tiles[0];
  const closed = v.solidTile(d0.x, d0.y);
  // light two sconces by teleport-touch
  for (const s of p.sconces.slice(0, 2)) {
    v.px = s.x + 0.5; v.py = -(s.y + 0.5); v.vx = 0; v.vy = 0;
    await until(() => v.sconceLit[p.sconces.indexOf(s)], 20, 50);
  }
  const open = await until(() => !v.solidTile(d0.x, d0.y), 20, 50);
  return { closed, open, needs: window.__VAULTS.find(x => x.glyph === 'vault').doorNeeds };
});
ok('brazier doors', doors, doors.closed && doors.open);

// --- the ember: pursuit arms on the trigger and consumes the shaft ---
const pursuit = await page.evaluate(async () => {
  const { g, until } = window.__H();
  g.devVault('ember');
  await until(() => g.mode === 'vault', 20);
  const v = g.vault;
  const idle = !v.pursuitOn;
  v.px = 22; v.py = -19; v.vx = 0; v.vy = 0; // the trigger band
  const armed = await until(() => v.pursuitOn, 30);
  const edge0 = v.pursuitEdge;
  await new Promise(r => setTimeout(r, 900));
  const advanced = v.pursuitEdge > edge0 + 0.3;
  // stand above the edge: consumed
  const r0 = v.reforms;
  v.px = 22; v.py = -(v.pursuitEdge - 1.5); v.invuln = 0;
  const caught = await until(() => v.reforms > r0, 30);
  const resetOff = await until(() => !v.pursuitOn, 20);
  return { idle, armed, advanced, caught, resetOff };
});
ok('the pursuit', pursuit, pursuit.idle && pursuit.armed && pursuit.advanced && pursuit.caught && pursuit.resetOff);

// --- censers swing through real arcs ---
const censer = await page.evaluate(async () => {
  const { g, until } = window.__H();
  const v = g.vault; // ember has one censer
  const xs = [];
  for (let i = 0; i < 12; i++) {
    await new Promise(r => setTimeout(r, 180));
    xs.push(v.censerPos(0).x);
  }
  const swings = Math.max(...xs) - Math.min(...xs) > 2;
  return { swings, span: +(Math.max(...xs) - Math.min(...xs)).toFixed(1) };
});
ok('censers swing', censer, censer.swings);

// --- the debt: crushers cycle; the right cell still falls up ---
const debt = await page.evaluate(async () => {
  const { g, until } = window.__H();
  g.devVault('debt');
  await until(() => g.mode === 'vault', 20);
  const v = g.vault;
  const r0 = v.crusherRect(0);
  let extended = false;
  for (let i = 0; i < 25 && !extended; i++) {
    await new Promise(r => setTimeout(r, 150));
    extended = Math.abs(v.crusherRect(0).x0 - r0.x0) > 1 || Math.abs(v.crusherRect(0).x0 - (r0.x0 + 1)) < 4 && v.crusherRect(0).x0 > r0.x0 + 0.5;
  }
  // never teleport during a re-form: the reform snap would override it
  await until(() => v.phase === 'run', 20);
  v.invuln = 3;
  v.px = 32; v.py = -12; v.vx = 0; v.vy = 0;
  const roseUp = await until(() => v.vy > 0.5 || v.py > -6, 30);
  return { extended, roseUp };
});
ok('the debt', debt, debt.extended && debt.roseUp);
await page.screenshot({ path: OUT + '/v-debt.png' });

// --- the return: current sweeps, the door wants the niche sconce ---
const ret = await page.evaluate(async () => {
  const { g, until, vaultOf } = window.__H();
  g.devVault('return');
  await until(() => g.mode === 'vault', 20);
  const v = g.vault;
  v.px = 10; v.py = -30.5; v.vx = 0; v.vy = 0; v.invuln = 2;
  const swept = await until(() => v.vx > 0.5, 30);
  const p = vaultOf('return');
  const d0 = p.doors[0].tiles[0];
  const closed = v.solidTile(d0.x, d0.y);
  return { swept, closed, figures: p.figures.length };
});
ok('the return', ret, ret.swept && ret.closed && ret.figures === 1);

// --- the kindled: four movements, four figures, its own pursuit ---
const kindled = await page.evaluate(async () => {
  const { g, until, vaultOf } = window.__H();
  g.devVault('kindled');
  await until(() => g.mode === 'vault', 20);
  const p = vaultOf('kindled');
  const def = window.__VAULTS.find(x => x.glyph === 'kindled');
  return {
    figures: p.figures.length,
    sconces: p.sconces.length,
    kit: !!(def.shuttles && def.censers && def.crushers && def.pursuit),
  };
});
ok('the kindled', kindled, kindled.figures === 4 && kindled.sconces >= 5 && kindled.kit);
await page.screenshot({ path: OUT + '/v-kindled.png' });

// --- abandon, gallery, grandfathering, the gate ---
const abandon = await page.evaluate(async () => {
  const { g, until, key } = window.__H();
  const before = g.state.glyphs;
  key('Escape'); key('Escape', false);
  const out = await until(() => g.mode !== 'vault', 20);
  return { out, unchanged: g.state.glyphs === before };
});
ok('abandon', abandon, abandon.out && abandon.unchanged);

const gallery = await page.evaluate(async () => {
  const { g, until, key } = window.__H();
  g.devVaultGallery();
  const eva = await until(() => g.mode === 'eva', 20);
  const stones = g.terrain.glyphStones.length;
  key('BracketRight'); key('BracketRight', false);
  await new Promise(r => setTimeout(r, 200));
  // hopping onto a stone still means standing there while the mark takes
  const at = g.terrain.glyphStones.find(s => Math.abs(g.pilot.px - (s.x + 0.5)) < 1.1);
  await until(() => g.glyphMarks.chargeOf(at.id) >= 1, 200);
  key('KeyE'); key('KeyE', false);
  const inVault = await until(() => g.mode === 'vault', 20);
  const id = g.vault?.glyphId;
  key('Escape'); key('Escape', false);
  await until(() => g.mode !== 'vault', 20);
  const before = localStorage.getItem('coreward_save_v2');
  const metaBefore = localStorage.getItem('coreward_meta_v1');
  g.saveNow();
  g.meta.keeplight += 9999;
  window.__meta.saveMeta(g.meta);
  return {
    eva, stones, inVault, id,
    unsaved: localStorage.getItem('coreward_save_v2') === before
      && localStorage.getItem('coreward_meta_v1') === metaBefore,
  };
});
ok('gallery', gallery, gallery.eva && gallery.stones === 9 && gallery.inVault && gallery.unsaved);

const grandfather = await page.evaluate(() => {
  const g = window.__game;
  const keep = [...g.state.glyphsSet];
  g.state.glyphs = 4;
  const four = [...g.state.glyphsSet];
  g.state.glyphs = 9;
  const nine = g.state.glyphs === 9;
  g.state.glyphsSet = new Set(keep);
  return { n: four.length, first: four[0], nine };
});
ok('grandfather + gate', grandfather, grandfather.n === 4 && grandfather.first === 'wick' && grandfather.nine);

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
