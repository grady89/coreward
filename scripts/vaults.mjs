// THE NINE STONES: glyph seeding, the alphabet, vault runtime — meter,
// sconces, checkpoints, hazards, bridges, rime, gravity zones, the Famine
// economy, completion, the codex, save grandfathering, the KINDLE gate.
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
  const toMaster = async () => {
    const v = g.vault;
    const m = vaultOf(v.glyphId);
    v.px = m.master.x + 0.5; v.py = -(m.master.y + 0.5); v.vx = 0; v.vy = 0;
    await until(() => v.completed, 60);
    key('KeyE'); key('KeyE', false);
    await until(() => !g.vault, 20);
    return g.state.glyphsSet.has(m ? v.glyphId : '') || g.state.glyphs;
  };
  return { g, until, key, vaultOf, toMaster };
`;
const H = async () => page.evaluate(src => { window.__H = new Function(src); }, HELPERS);
await H();

// --- the alphabet: nine glyphs, three per world, all maps parse + reach ---
const alphabet = await page.evaluate(() => {
  const gs = window.__GLYPHS;
  const worlds = { veil3: 0, cryos2: 0, maelis6: 0 };
  for (const g of gs) worlds[g.world]++;
  let reach = 0;
  for (const v of window.__VAULTS) {
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
    if (seen[p.master.y * p.w + p.master.x]) reach++;
  }
  const fam = gs.find(g => g.id === 'famine');
  const kin = gs.find(g => g.id === 'kindled');
  return { n: gs.length, worlds, vaults: window.__VAULTS.length, reach,
    famineSocket: fam.light === null, kindledChest: JSON.stringify(kin.light) === '[2,2]' };
});
ok('alphabet', alphabet, alphabet.n === 9 && alphabet.vaults === 9 && alphabet.reach === 9
  && alphabet.worlds.veil3 === 3 && alphabet.worlds.cryos2 === 3 && alphabet.worlds.maelis6 === 3
  && alphabet.famineSocket && alphabet.kindledChest);

// --- three stones seeded in the first three halls ---
const seeded = await page.evaluate(() => {
  const g = window.__game;
  const stones = g.terrain.glyphStones;
  let onGlyph = 0;
  for (const s of stones) if (g.terrain.get(s.x, s.y) === 20) onGlyph++;
  return { n: stones.length, onGlyph, ids: stones.map(s => s.id) };
});
ok('stones seeded', seeded, seeded.n === 3 && seeded.onGlyph === 3
  && JSON.stringify(seeded.ids) === JSON.stringify(['wick', 'famine', 'shift']));

// --- entering the real way: park on the stone, step out, press E ---
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
  // walk to the stone and press E again
  g.pilot.px = s.x + 0.5; g.pilot.py = -s.y + 0.6;
  key('KeyE'); key('KeyE', false);
  const inVault = await until(() => g.mode === 'vault', 20);
  return { eva, inVault, glyph: g.vault?.glyphId, meter: g.vault?.meter };
});
ok('entry on foot', entry, entry.eva && entry.inVault && entry.glyph === 'wick' && entry.meter === 100);
await page.screenshot({ path: OUT + '/v-wick.png' });

// --- the meter: jets drain it, a lit sconce pours it back ---
const meter = await page.evaluate(async () => {
  const { g, until, key } = window.__H();
  const v = g.vault;
  const m0 = v.meter;
  key('ArrowUp');
  await new Promise(r => setTimeout(r, 1200));
  key('ArrowUp', false);
  const afterJet = v.meter;
  // stand at the first sconce: it lights, checkpoints, and refills
  const s = window.__H().vaultOf('wick').sconces[0];
  v.px = s.x + 0.5; v.py = -(s.y + 0.5); v.vx = 0; v.vy = 0;
  const lit = await until(() => v.sconceLit?.[0] ?? v.meter > afterJet, 30);
  const refilled = await until(() => v.meter > Math.min(99, afterJet + 5), 60);
  return { m0, afterJet: +afterJet.toFixed(1), lit, refilled };
});
ok('worklight meter', meter, meter.m0 === 100 && meter.afterJet < 96 && meter.refilled);

// --- unlight: touch it and you re-form at the last sconce, meter full ---
const reform = await page.evaluate(async () => {
  const { g, until } = window.__H();
  const v = g.vault;
  const before = { x: v.px, y: v.py };
  // the wick's first pit is at x8-10, row 20
  v.px = 9.5; v.py = -20.5; v.vx = 0; v.vy = 0;
  const guttered = await until(() => v.phase === 'reform', 20);
  const back = await until(() => v.phase === 'run', 20);
  const atSconce = Math.hypot(v.px - before.x, v.py - before.y) < 3;
  return { guttered, back, atSconce, reforms: v.reforms, meter: v.meter };
});
ok('re-form', reform, reform.guttered && reform.back && reform.reforms === 1 && reform.meter === 100);

// --- complete the wick: sequence, card, codex entry, back outside ---
const complete = await page.evaluate(async () => {
  const { g, until, key, vaultOf } = window.__H();
  const v = g.vault;
  const m = vaultOf('wick');
  v.px = m.master.x + 0.5; v.py = -(m.master.y + 0.5); v.vx = 0; v.vy = 0;
  const sequenced = await until(() => v.completed, 60);
  const card = !!document.querySelector('#vault-card .vc-text');
  key('KeyE'); key('KeyE', false);
  const out = await until(() => g.mode === 'eva', 20);
  return { sequenced, card, out, glyphs: g.state.glyphs, has: g.state.glyphsSet.has('wick') };
});
ok('wick translated', complete, complete.sequenced && complete.card && complete.out && complete.has && complete.glyphs === 1);
await page.screenshot({ path: OUT + '/v-translated.png' });

// --- the codex shows one burning row and eight untranslated ---
const codex = await page.evaluate(async () => {
  const g = window.__game;
  g.mode = 'play';
  g.ctrl.drilling = null;
  g.ctrl.px = 52; g.ctrl.py = 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  await new Promise(r => setTimeout(r, 800));
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
  await new Promise(r => setTimeout(r, 700));
  const rows = document.querySelectorAll('.codex-row').length;
  const locked = document.querySelectorAll('.codex-row.locked').length;
  const text = document.body.textContent;
  return { rows, locked, wick: text.includes('THE WICK'), guild: text.includes('a guild for it') };
});
ok('codex page', codex, codex.rows === 9 && codex.locked === 8 && codex.wick && codex.guild);
await page.screenshot({ path: OUT + '/v-codex.png' });
await page.keyboard.press('Escape');

// --- the famine: sconces cost light, and refuse the destitute ---
const famine = await page.evaluate(async () => {
  const { g, until, vaultOf } = window.__H();
  g.devVault('famine');
  await until(() => g.mode === 'vault', 20);
  const v = g.vault;
  const s = vaultOf('famine').sconces.find(x => x.y > 18); // the bottom-corridor sconce
  v.px = s.x + 0.5; v.py = -(s.y + 0.5); v.vx = 0; v.vy = 0;
  // the cost lands, then the sconce it bought starts pouring it back —
  // catching the dip is the assertion
  const costPaid = await until(() => v.meter < 80, 30);
  // drain to nothing and try the next one: it refuses
  v.meter = 10;
  const s2 = vaultOf('famine').sconces[0];
  v.px = s2.x + 0.5; v.py = -(s2.y + 0.5); v.vx = 0; v.vy = 0;
  await new Promise(r => setTimeout(r, 700));
  const refused = !v.sconceLit[0];
  return { costPaid, refused, ambient: window.__VAULTS.find(x => x.glyph === 'famine').ambient };
});
ok('the famine', famine, famine.costPaid && famine.refused && famine.ambient === 2);

// --- the vault: bridges alternate, and the off group is not a floor ---
const bridges = await page.evaluate(async () => {
  const { g, until } = window.__H();
  g.devVault('vault');
  await until(() => g.mode === 'vault', 20);
  const v = g.vault;
  const a0 = v.bridgeOn[0], b0 = v.bridgeOn[1];
  await until(() => v.bridgeOn[0] !== a0, 60);
  const swapped = v.bridgeOn[0] !== a0 && v.bridgeOn[1] !== b0;
  const exclusive = v.bridgeOn[0] !== v.bridgeOn[1];
  return { a0, b0, swapped, exclusive };
});
ok('light bridges', bridges, bridges.swapped && bridges.exclusive && bridges.a0 !== bridges.b0);
await page.screenshot({ path: OUT + '/v-bridges.png' });

// --- the ember: rime sheds underfoot and regrows behind you ---
const rime = await page.evaluate(async () => {
  const { g, until, vaultOf } = window.__H();
  g.devVault('ember');
  await until(() => g.mode === 'vault', 20);
  const v = g.vault;
  const r = vaultOf('ember').rime[0];
  v.px = r.x + 1.5; v.py = -(r.y - 1) - 0.5 + 0.27; v.vx = 0; v.vy = 0;
  // let it land on the shelf — crumble state is per TILE, so watch them all
  const stood = await until(() => v.grounded, 40);
  const crumbled = await until(() => v.rimeState.some(x => x.gone > 0), 40);
  // step away and it regrows
  v.px = r.x + 6.5; v.py = -(r.y - 2);
  const regrown = await until(() => v.rimeState.every(x => x.gone <= 0 && x.t < 0), 90);
  return { stood, crumbled, regrown };
});
ok('rime shelves', rime, rime.stood && rime.crumbled && rime.regrown);

// --- the debt: crossing the divide flips the fall ---
const debt = await page.evaluate(async () => {
  const { g, until } = window.__H();
  g.devVault('debt');
  await until(() => g.mode === 'vault', 20);
  const v = g.vault;
  // left cell: falls down
  v.px = 10; v.py = -8; v.vx = 0; v.vy = 0;
  const fellDown = await until(() => v.vy < -0.5 || v.grounded, 30);
  // right cell: falls UP
  v.px = 30; v.py = -12; v.vx = 0; v.vy = 0;
  const roseUp = await until(() => v.vy > 0.5 || v.py > -5, 30);
  return { fellDown, roseUp };
});
ok('the debt inverts', debt, debt.fellDown && debt.roseUp);
await page.screenshot({ path: OUT + '/v-debt.png' });

// --- the return: the bottom corridor is a current, and someone stands in it ---
const ret = await page.evaluate(async () => {
  const { g, until, vaultOf } = window.__H();
  g.devVault('return');
  await until(() => g.mode === 'vault', 20);
  const v = g.vault;
  v.px = 8; v.py = -19.5; v.vx = 0; v.vy = 0;
  const swept = await until(() => v.vx > 0.5, 30);
  const figure = vaultOf('return').figures.length === 1;
  return { swept, figure, vx: +v.vx.toFixed(1) };
});
ok('the return sweeps', ret, ret.swept && ret.figure);

// --- the kindled: no ambient at all, and four of them at the stone ---
const kindled = await page.evaluate(async () => {
  const { g, until, vaultOf } = window.__H();
  g.devVault('kindled');
  await until(() => g.mode === 'vault', 20);
  const v = g.vault;
  v.meter = 50;
  v.px = 20; v.py = -20.5; // mid dark corridor, away from sconces
  await new Promise(r => setTimeout(r, 1000));
  const starves = v.meter <= 50.01;
  const figures = vaultOf('kindled').figures.length;
  return { starves, figures, ambient: window.__VAULTS.find(x => x.glyph === 'kindled').ambient };
});
ok('the kindled starves', kindled, kindled.starves && kindled.figures === 4 && kindled.ambient === 0);
await page.screenshot({ path: OUT + '/v-kindled.png' });

// --- abandon: Esc leaves, nothing is granted ---
const abandon = await page.evaluate(async () => {
  const { g, until, key } = window.__H();
  const before = g.state.glyphs;
  key('Escape'); key('Escape', false);
  const out = await until(() => g.mode !== 'vault', 20);
  return { out, mode: g.mode, unchanged: g.state.glyphs === before };
});
ok('abandon', abandon, abandon.out && abandon.unchanged);

// --- old saves grandfather: a count becomes the first N stones ---
const grandfather = await page.evaluate(() => {
  const g = window.__game;
  const keep = [...g.state.glyphsSet];
  g.state.glyphs = 4;
  const four = [...g.state.glyphsSet];
  g.state.glyphsSet = new Set(keep);
  return { four, n: four.length };
});
ok('grandfather', grandfather, grandfather.n === 4 && grandfather.four[0] === 'wick' && grandfather.four[3] === 'vault');

// --- the KINDLE gate still counts to nine ---
const gate = await page.evaluate(() => {
  const g = window.__game;
  g.state.glyphs = 9;
  const nine = g.state.glyphs === 9 && g.state.glyphsSet.size === 9;
  g.state.glyphsSet = new Set(['wick']);
  return { nine, back: g.state.glyphs === 1 };
});
ok('kindle gate math', gate, gate.nine && gate.back);

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
