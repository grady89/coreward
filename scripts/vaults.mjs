// THE NINE STONES, third pass: the light-dash movement set (spark, wall
// moves, coyote/buffer), sconce economy, doors, shuttles, censers,
// crushers, pursuit, spin-beams with cover, completion, codex, the
// gallery, grandfathering, the KINDLE gate — plus the V2 presentation core:
// camera-locked chambers that CUT, and the three pillar lints (chamber
// width, sconce-at-boundary, dark-hazard-emissive).
import { chromium } from 'playwright';

// A full pass is a minute of wall clock, and iterating on one check should
// not cost that. `--only=` names checks; a stage runs if any of its checks
// match. Stages are the grain because the checks inside one share a room and
// lean on each other's state — separating them would mean re-entering the
// room per check, which is the cost this exists to avoid.
//
//   node scripts/vaults.mjs                       every stage
//   node scripts/vaults.mjs --only=chord          the kindled stage
//   node scripts/vaults.mjs --only=lint,re-form   the lints and the wick
//   node scripts/vaults.mjs --list                what the stages hold
//   node scripts/vaults.mjs design-review --only=crystal
//
// Matching is case-insensitive substring, against the stage key and every
// check name in it. ALWAYS run bare before you ship.
const args = process.argv.slice(2);
const OUT = args.find(a => !a.startsWith('--')) ?? '.';
const onlyRaw = args.find(a => a.startsWith('--only='));
const only = onlyRaw
  ? onlyRaw.slice('--only='.length).split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
  : null;
const listing = args.includes('--list');

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
let failed = 0;
let ran = 0;
const ok = (name, obj, pass) => {
  if (!pass) failed++;
  console.log(name + ':', JSON.stringify(obj), pass ? 'OK' : 'FAIL');
};

/** one room, one setup, and the checks that share them */
const stage = async (key, checks, fn) => {
  const hit = t => key.includes(t) || checks.some(c => c.toLowerCase().includes(t));
  if (listing) { console.log(key.padEnd(8) + ' ' + checks.join(', ')); return; }
  if (only && !only.some(hit)) { console.log('- skipped ' + key); return; }
  ran++;
  await fn();
};

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

await stage('maps', ['nine levels'], async () => {
  // --- maps: nine levels, all parse, master + sconces reachable (doors open) ---
  const alphabet = await page.evaluate(() => {
    const gs = window.__GLYPHS;
    const worlds = { veil3: 0, cryos2: 0, maelis6: 0 };
    for (const g of gs) worlds[g.world]++;
    let reach = 0;
    // the V3 kit lives in the proving ground until V4 authors it into rooms,
    // so the census walks the test vaults too — parse, reach and all
    const all = [...window.__VAULTS, ...window.__TEST_VAULTS];
    const kit = { shuttles: 0, censers: 0, crushers: 0, pursuit: 0, doors: 0, beams: 0,
      snuffers: 0, gates: 0, currents: 0, parked: 0, braziers: 0, motes: 0, dry: 0 };
    for (const v of all) {
      if (v.shuttles) kit.shuttles++;
      if (v.censers) kit.censers++;
      if (v.crushers) kit.crushers++;
      if (v.pursuit) kit.pursuit++;
      if (v.doorNeeds) kit.doors++;
      if (v.beams) kit.beams++;
      if ((v.shuttles ?? []).some(s => s.snuff)) kit.snuffers++;
      if (v.gates) kit.gates++;
      if (v.currents) kit.currents++;
      if ((v.beams ?? []).some(b => b.parked)) kit.parked++;
      const p = window.__parseVault(v);
      kit.braziers += p.braziers.length;
      kit.motes += p.motes.length;
      for (let i = 0; i < p.dry.length; i++) if (p.dry[i]) kit.dry++;
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
    return { n: gs.length, worlds, vaults: window.__VAULTS.length,
      rooms: all.length, reach, kit };
  });
  ok('nine levels', alphabet, alphabet.n === 9 && alphabet.vaults === 9
    && alphabet.reach === alphabet.rooms && alphabet.rooms === 10
    && alphabet.kit.shuttles >= 4 && alphabet.kit.censers >= 4 && alphabet.kit.crushers >= 3
    && alphabet.kit.pursuit === 2 && alphabet.kit.doors >= 3 && alphabet.kit.beams >= 1
    && alphabet.kit.snuffers >= 1 && alphabet.kit.gates >= 1 && alphabet.kit.currents >= 1
    && alphabet.kit.parked >= 1 && alphabet.kit.braziers >= 1 && alphabet.kit.motes >= 3
    && alphabet.kit.dry >= 1);
});

await stage('wick', ['entry on foot', 'the spark', 'movement metrics', 'wall moves', 're-form', 'corner correction', 'buffer through spark', 'sconce crystal', 'wick translated'], async () => {
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
    // F11: the frame is chamber-locked from the first frame — centred on the
    // entry chamber, and far enough back that the whole slice fits. The old
    // assertion here was that the camera had settled onto the BODY; it now
    // has to be on the CHAMBER instead.
    const v = g.vault;
    const p = v.p;
    const ch = p.chambers[v.chamber];
    const cam = v.cam.camera;
    const halfW = v.cam.halfW();
    return {
      eva, early, woke, inVault, glyph: v?.glyphId, spark: v?.spark,
      chambers: p.chambers.length,
      chamber: v.chamber,
      entryInChamber: p.entry.x >= ch.x0 && p.entry.x <= ch.x1,
      onFrame: Math.abs(cam.position.x - v.chamberFrame(v.chamber).cx) < 0.02,
      framesChamber: halfW * 2 >= (ch.x1 - ch.x0 + 1),
    };
  });
  ok('entry on foot', entry, entry.eva && entry.early === false && entry.woke && entry.inVault
    && entry.glyph === 'wick' && entry.spark === true
    && entry.chambers === 5 && entry.chamber === 0 && entry.entryInChamber
    && entry.onFrame && entry.framesChamber);
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
  ok('movement metrics', metrics, metrics.jumpH >= 2.1 && metrics.jumpH <= 3.2 && metrics.dist >= 2.6 && metrics.dist <= 6.5);

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

  // --- unlight: gutter → control returns the SAME frame, at the checkpoint,
  // spark restored, camera cut done. The old blocking 'reform' phase is gone
  // by design (SPEC-VAULTS-2 F10): the grow-in is cosmetic.
  const reform = await page.evaluate(async () => {
    const { g, until } = window.__H();
    const v = g.vault;
    const before = v.reforms;
    const t0 = performance.now();
    v.px = 9.5; v.py = -26.4; v.vx = 0; v.vy = 0; v.invuln = 0;
    const guttered = await until(() => v.reforms > before, 20);
    const retryMs = performance.now() - t0;
    // control is already live: a jump pressed NOW must fire
    const cx = v.checkpoint.x;
    const atCheckpoint = Math.abs(v.px - cx) < 0.01 && v.phase === 'run';
    v.jumpPress();
    const jumped = await until(() => v.vy > 4, 15, 30);
    // the cut: the frame is already sitting on the checkpoint's chamber, dead
    // on its centre — a snap, with no interpolated frame in between (F10/P3)
    const p = v.p;
    const want = p.chambers.findIndex(c => Math.floor(cx) <= c.x1);
    return { guttered, atCheckpoint, jumped, retryMs: Math.round(retryMs),
      reforms: v.reforms, spark: v.spark,
      chamber: v.chamber, want,
      camCut: v.chamber === want
        && Math.abs(v.cam.camera.position.x - v.chamberFrame(want).cx) < 0.02,
      wick: (window.__VAULTS.find(x => x.glyph === 'wick').chambers ?? []).length > 0 };
  });
  ok('re-form', reform, reform.guttered && reform.atCheckpoint && reform.jumped
    && reform.retryMs < 900 && reform.reforms >= 1 && reform.spark && reform.camCut);

  // --- F1: a jump grazing a ceiling corner is nudged past it, not bonked ---
  const corner = await page.evaluate(async () => {
    const { g } = window.__H();
    const v = g.vault;
    // find a ceiling corner: solid at (c,r), air at (c+1,r) and below both
    const P = v.p;
    const solid = (x, y) => x < 0 || y < 0 || x >= P.w || y >= P.h || P.solid[y * P.w + x];
    let spot = null;
    for (let y = 2; y < P.h - 3 && !spot; y++) for (let x = 2; x < P.w - 3 && !spot; x++) {
      if (solid(x, y) && !solid(x + 1, y) && !solid(x + 2, y)
        && !solid(x, y + 1) && !solid(x + 1, y + 1) && !solid(x + 2, y + 1)
        && !solid(x, y + 2) && !solid(x + 1, y + 2)) spot = [x, y];
    }
    if (!spot) return { err: 'no corner found' };
    const [c, r] = spot;
    // body top just under the corner, overlapping the solid column by 0.2
    v.invuln = 3; v.dashT = 0; v.spark = true;
    v.px = (c + 1) + 0.3 - 0.2; // left edge 0.2 into the solid column
    v.py = -(r + 1) - 0.52 - 0.08;
    v.vx = 0; v.vy = 9;
    const topBefore = v.py + 0.52;
    await new Promise(res => setTimeout(res, 350));
    return { rose: (v.py + 0.52) > -(r + 1) + 0.3, nudged: v.px > (c + 1) + 0.1,
      topBefore: +topBefore.toFixed(2), lip: -(r + 1) };
  });
  ok('corner correction', corner, corner.rose === true && corner.nudged === true);

  // --- F8: a jump buffered mid-spark fires the frame the spark ends ---
  const buffered = await page.evaluate(async () => {
    const { g, until } = window.__H();
    const v = g.vault;
    v.px = 5.5; v.py = -25.4; v.vx = 0; v.vy = 0; v.invuln = 3;
    await until(() => v.grounded, 30);
    v.dash({ left: false, right: true, up: false, down: false });
    const spentAtPress = !v.spark; // stone underfoot re-arms it after the burst
    v.jumpPress();          // pressed during the freeze+burst
    v.jumpRelease();
    const jumped = await until(() => v.vy > 4, 20, 30);
    return { jumped, spentAtPress };
  });
  ok('buffer through spark', buffered, buffered.jumped && buffered.spentAtPress);

  // --- a lit sconce relights the spark mid-air, ACROSS a chamber cut ---
  // The floating sconce of the wick stands on a chamber boundary by authoring
  // rule (P3), so this doubles as the cut's own test: the frame must change
  // chamber and land exactly on the new chamber's centre, and the relight has
  // to survive that. The old version assumed a camera that followed the body.
  const crystal = await page.evaluate(async () => {
    const { g, until, vaultOf, off } = window.__H();
    const v = g.vault;
    const p = vaultOf('wick');
    const si = p.sconces.findIndex(x => x.y === 23); // the floating one
    const s = p.sconces[si];
    const boundary = v.p.cuts.includes(s.x);
    const before = v.p.chambers.findIndex(c => s.x <= c.x1);
    v.px = s.x + 0.5; v.py = -(s.y + 0.5); v.vx = 0; v.vy = 0;
    const lit = await until(() => v.sconceLit[si], 20, 50);
    await until(() => v.chamber === before, 20, 50);
    // the chord it just fired put a soft shake on the frame; let that die
    // before measuring, or the lock reads as a wobble
    await new Promise(r => setTimeout(r, 400));
    const camBefore = v.cam.camera.position.x;
    v.dash({ ...off(), up: true });
    await until(() => !v.spark, 10, 50);
    v.px = s.x + 0.5; v.py = -(s.y + 0.5) - 0.4; // back into the glow, airborne
    const relit = await until(() => v.spark, 20, 50);
    // travel a long way INSIDE the chamber: the frame must not budge a pixel
    v.px = v.p.chambers[before].x0 + 0.6; v.vx = 0; v.vy = 0;
    await new Promise(r => setTimeout(r, 350));
    const locked = Math.abs(v.cam.camera.position.x - camBefore) < 0.001;
    // then step across the boundary: a CUT, never a pan
    v.px = s.x + 1.6; v.vx = 0; v.vy = 0;
    const cut = await until(() => v.chamber === before + 1, 20, 50);
    const camAfter = v.cam.camera.position.x;
    return { lit, relit, boundary, cut, locked,
      moved: +Math.abs(camAfter - camBefore).toFixed(2),
      onFrame: Math.abs(camAfter - v.chamberFrame(v.chamber).cx) < 0.02 };
  });
  ok('sconce crystal', crystal, crystal.lit && crystal.relit && crystal.boundary
    && crystal.cut && crystal.locked && crystal.onFrame && crystal.moved > 1);

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
});

await stage('famine', ['the famine', 'light shuttles'], async () => {
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
});

await stage('shift', ['spinning beams'], async () => {
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
});

await stage('vault', ['brazier doors'], async () => {
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
});

await stage('ember', ['the pursuit', 'censers swing'], async () => {
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
});

await stage('debt', ['the debt'], async () => {
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
});

await stage('return', ['the return'], async () => {
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
});

await stage('kindled', ['the kindled', 'the sconce chord', 'the gutter phrase', 'the guild voice'], async () => {
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

  // --- THE SCONCE CHORD: five systems on one frame, settling together ---
  const chord = await page.evaluate(async () => {
    const { g, until } = window.__H();
    const v = g.vault;
    await until(() => v.phase === 'run', 20);
    // a spy on the audio side of the chord — the bed has to duck too
    const calls = [];
    const real = v.audio;
    v.audio = {
      chord: i => calls.push('chord' + i), deny: () => calls.push('deny'),
      gutter: () => calls.push('gutter'), complete: () => calls.push('complete'),
      duck: (to, hold) => calls.push('duck ' + to + '/' + hold),
    };
    // and a spy on the shake channel: it decays inside a frame or two, so the
    // only honest way to see it is at the source
    const shakes = [];
    const realShake = v.cam.addShake.bind(v.cam);
    v.cam.addShake = a => { shakes.push(+a.toFixed(3)); realShake(a); };
    const si = v.sconceLit.findIndex(x => !x);
    const s = v.p.sconces[si];
    const lum0 = v.ambient.intensity;
    const rim0 = v.rimMat.opacity;
    const z0 = v.cam.camera.position.z;
    v.px = s.x + 0.5; v.py = -(s.y + 0.5); v.vx = 0; v.vy = 0; v.invuln = 999;
    await until(() => v.sconceLit[si], 20, 50);
    await new Promise(r => setTimeout(r, 60));
    const lum1 = v.ambient.intensity;
    const rim1 = v.rimMat.opacity;
    // the frame's push-out is an EASE, and headless clamps dt to 50 ms, so a
    // single read lands wherever the frame happened to fall — watch the whole
    // gesture and take its furthest point
    let z1 = v.cam.camera.position.z;
    for (let i = 0; i < 14; i++) {
      await new Promise(r => setTimeout(r, 50));
      z1 = Math.max(z1, v.cam.camera.position.z);
    }
    // and then it settles — a notch brighter and a notch stronger than before
    await new Promise(r => setTimeout(r, 1800));
    const lum2 = v.ambient.intensity;
    const rim2 = v.rimMat.opacity;
    // THE SHAKE BAN (precision §5.2): jump, land, wall-jump, spark and the
    // gutter must add nothing to that channel. Only the chord did, and softly.
    // every sconce already burning and clear of them all, so nothing but the
    // banned verbs can touch the channel from here
    for (let i = 0; i < v.sconceLit.length; i++) v.sconceLit[i] = true;
    v.px = 24.5; v.py = -39.5; v.vx = 0; v.vy = 0;
    await new Promise(r => setTimeout(r, 200));
    const afterChord = shakes.length;
    v.jumpPress(); v.jumpRelease();
    await new Promise(r => setTimeout(r, 250));
    v.dash({ left: false, right: true, up: false, down: false });
    await new Promise(r => setTimeout(r, 350));
    v.reform();
    await new Promise(r => setTimeout(r, 250));
    const banned = shakes.length - afterChord;
    v.cam.addShake = realShake;
    v.audio = real;
    return {
      bump: +(lum1 - lum0).toFixed(3), settledUp: +(lum2 - lum0).toFixed(3),
      rimFlare: +(rim1 - rim0).toFixed(3), rimNotch: +(rim2 - rim0).toFixed(3),
      easedOut: +(z1 - z0).toFixed(2), shakes, banned, calls,
    };
  });
  ok('the sconce chord', chord,
    chord.bump > 0.2 && chord.settledUp > 0 && chord.settledUp < chord.bump
    && chord.rimFlare > 0.05 && chord.rimNotch > 0 && chord.rimNotch < chord.rimFlare
    && chord.easedOut > 0.4 && chord.easedOut < 1.6
    && chord.shakes.length === 1 && chord.shakes[0] > 0 && chord.shakes[0] <= 0.25
    && chord.banned === 0
    && chord.calls.some(c => c.startsWith('chord'))
    && chord.calls.some(c => c === 'duck 0.5/4'));

  // --- THE GUTTER PHRASE: one gesture, no sting, and it leaves a mark that
  // outlives the attempt ---
  const gutter = await page.evaluate(async () => {
    const { g, until } = window.__H();
    const v = g.vault;
    const calls = [];
    const real = v.audio;
    v.audio = {
      chord: () => calls.push('chord'), deny: () => calls.push('deny'),
      gutter: () => calls.push('gutter'), complete: () => calls.push('complete'),
      duck: (to, hold) => calls.push('duck ' + to + '/' + hold),
    };
    const embers = () => g.vault.scene.children.filter(o => o.name === 'figure-ember').length;
    const e0 = embers();
    const r0 = v.reforms;
    v.invuln = 0;
    v.reform();
    await until(() => v.reforms > r0, 20, 30);
    const marked = embers() - e0;
    v.audio = real;
    // the room remembers: step out, step back in, the wick is still there
    g.devVault('kindled');
    await until(() => g.mode === 'vault' && g.vault && g.vault.phase === 'run', 40);
    const kept = g.vault.scene.children.filter(o => o.name === 'figure-ember').length;
    return { calls, marked, kept, sting: calls.some(c => c === 'deny') };
  });
  ok('the gutter phrase', gutter,
    gutter.calls[0] === 'gutter' && gutter.calls.includes('duck 0.08/3')
    && gutter.sting === false && gutter.marked === 1 && gutter.kept >= 1);

  // --- THE GUILD'S VOICE: a lamp raised toward one of the dead. Free, and it
  // gates nothing — no phase change, no spark cost ---
  const voice = await page.evaluate(async () => {
    const { g, until } = window.__H();
    const v = g.vault;
    await until(() => v.phase === 'run', 20);
    const poses = v.p.figures.map(f => f.pose).sort();
    const el = () => document.querySelector('#vault-voice');
    const before = el().textContent;
    // stand well clear of them: the lamp lifts, but nobody answers
    v.px = 10.5; v.py = -39.5; v.invuln = 999;
    v.raiseLamp();
    const quiet = el().textContent === before;
    // now stand with the four
    v.px = 50.5; v.py = -7.5;
    const spark0 = v.spark;
    v.raiseLamp();
    const said = el().textContent;
    return { poses, quiet, said, on: el().classList.contains('on'),
      freeSpark: v.spark === spark0, stillRunning: v.phase === 'run' };
  });
  ok('the guild voice', voice,
    voice.quiet && voice.said.length > 20 && voice.on && voice.freeSpark
    && voice.stillRunning
    && JSON.stringify(voice.poses) === JSON.stringify(['curled', 'fallen', 'kneeling', 'reaching']));
});

await stage('proving', ['the proving ground', 'dead surface', 'brazier relight', 'snuffer steals', 'one-way gate', 'the current', 'parked beam arms', 'censer ride', 'thin platforms'], async () => {
  // --- the V3 kit, in its dev room: nothing here touches the nine maps ---
  const enter = await page.evaluate(async () => {
    const { g, until } = window.__H();
    g.devVault('proving');
    await until(() => g.mode === 'vault' && g.vault && g.vault.glyphId === 'proving', 40);
    const v = g.vault;
    const def = window.__TEST_VAULTS.find(x => x.glyph === 'proving');
    return {
      inVault: g.mode === 'vault', motes: v.p.motes.length, braziers: v.p.braziers.length,
      snuffer: def.shuttles.some(s => s.snuff), gates: (def.gates ?? []).length,
      currents: (def.currents ?? []).length, parked: def.beams.some(b => b.parked),
    };
  });
  ok('the proving ground', enter, enter.inVault && enter.motes >= 3 && enter.braziers === 2
    && enter.snuffer && enter.gates === 1 && enter.currents === 1 && enter.parked);
  await page.screenshot({ path: OUT + '/v-proving.png' });

  // --- △ dead surface: masonry that carries but never refunds. Safe to
  // stand on, and the spark you spent stays spent — the only floor in the
  // game that lets a spent breath outlast a jump (P1: withholds) ---
  const drank = await page.evaluate(async () => {
    const { g, until } = window.__H();
    const v = g.vault;
    v.invuln = 999;
    // live stone: the breath comes back the frame you land. Sampled at the
    // entry, well clear of the moth's waking ring — the snuffer check below
    // needs to find it still asleep
    v.px = 3.5; v.py = -21.0; v.vx = 0; v.vy = 0;
    await until(() => v.grounded, 30);
    v.spark = false;
    const liveRefunds = await until(() => v.spark, 20, 40);
    // the drank course: walkable, harmless, and it gives nothing
    v.px = 19.5; v.py = -21.0; v.vx = 0; v.vy = 0;
    await until(() => v.grounded, 30);
    const r0 = v.reforms;
    v.spark = false;
    await new Promise(r => setTimeout(r, 700));
    const withholds = !v.spark && v.grounded && v.reforms === r0;
    // walking it does not quietly re-arm you either
    v.px = 21.5;
    await new Promise(r => setTimeout(r, 300));
    const stillDry = !v.spark && v.grounded;
    // and the basket overhead is the way out of the debt
    v.px = 16.5; v.py = -21.0; v.vx = 0; v.vy = 0;
    await until(() => v.grounded, 30);
    v.spark = false;
    v.jumpPress();
    const bought = await until(() => v.spark && !v.grounded, 25, 30);
    v.jumpRelease();
    const tiles = v.p.dry.reduce((n, d) => n + d, 0);
    return { liveRefunds, withholds, stillDry, bought, tiles };
  });
  ok('dead surface', drank, drank.liveRefunds && drank.withholds
    && drank.stillDry && drank.bought && drank.tiles === 15);

  // --- ▲ brazier: refills the spark MID-AIR, and is not a checkpoint ---
  const brazier = await page.evaluate(async () => {
    const { g, until, off } = window.__H();
    const v = g.vault;
    const b = v.p.braziers[0];
    v.invuln = 999;
    const cp0 = { ...v.checkpoint };
    v.px = 6.5; v.py = -18.5; v.vx = 0; v.vy = 0;
    v.dash({ ...off(), up: true });
    await until(() => !v.spark, 10, 50);
    const spent = !v.spark;
    // hang in the basket's ring, airborne: the light comes back before stone does
    v.px = b.x + 0.5; v.py = -(b.y + 0.5) - 0.3; v.vx = 0; v.vy = 0;
    const relitMidAir = await until(() => v.spark && !v.grounded, 20, 40);
    const sameCheckpoint = v.checkpoint.x === cp0.x && v.checkpoint.y === cp0.y;

    // the shaft basket, taken at speed — the one a player can actually read.
    // Drop through the curtain, spend the light in the fall, and the brazier
    // must hand it back while the body is still in the air: on a floor the
    // stone would do it and the object would prove nothing.
    // kill the burst first: a teleport with a spark still in flight keeps the
    // old velocity and would fly the body up out of the shaft
    v.dashT = 0; v.freezeT = 0; v.dashCarryT = 0;
    v.px = 30.5; v.py = -7.5; v.vx = 0; v.vy = 0;
    await until(() => v.py < -9.5, 25, 40);   // through the curtain, falling
    v.spark = false;
    let caught = false, landedFirst = false;
    for (let i = 0; i < 60 && !caught && !landedFirst; i++) {
      await new Promise(r => setTimeout(r, 25));
      if (v.spark && !v.grounded) caught = true;
      else if (v.grounded) landedFirst = true;
    }
    return { spent, relitMidAir, sameCheckpoint, caught, landedFirst };
  });
  ok('brazier relight', brazier, brazier.spent && brazier.relitMidAir
    && brazier.sameCheckpoint && brazier.caught && !brazier.landedFirst);

  // --- ▲ snuffer: asleep on the wall, wakes on proximity, STEALS the charged
  // spark and leaves you standing — no gutter, and a spent spark is ignored ---
  const snuffer = await page.evaluate(async () => {
    const { g, until } = window.__H();
    const v = g.vault;
    const calls = [];
    const real = v.audio;
    v.audio = {
      chord: () => calls.push('chord'), deny: () => calls.push('deny'),
      gutter: () => calls.push('gutter'), complete: () => calls.push('complete'),
      duck: () => calls.push('duck'),
    };
    v.invuln = 0;
    const asleep = !v.snuffState[0].awake;
    const park = v.shuttlePos(0);
    // stroll into the waking ring
    v.px = 6.0; v.py = -21.0; v.vx = 0; v.vy = 0;
    const woke = await until(() => v.snuffState[0].awake, 20, 50);
    const patrols = await until(() => Math.abs(v.shuttlePos(0).x - park.x) > 0.4, 40, 100);
    // stand in its path with the light charged: theft, not death
    const r0 = v.reforms;
    v.spark = true;
    const p2 = v.shuttlePos(0);
    v.px = p2.x; v.py = p2.y; v.vx = 0; v.vy = 0;
    const stolen = await until(() => !v.spark, 10, 40);
    const standing = v.reforms === r0 && Math.abs(v.px - p2.x) < 0.6;
    const stung = calls.includes('deny') && !calls.includes('gutter');
    // spent already: the moth has nothing to drink — no second sting. The
    // sate timer is zeroed each pass so only the spent spark is the shield
    const denies = calls.filter(c => c === 'deny').length;
    for (let i = 0; i < 6; i++) {
      const p3 = v.shuttlePos(0);
      v.snuffState[0].sate = 0;
      v.spark = false; v.px = p3.x; v.py = p3.y; v.vx = 0; v.vy = 0;
      await new Promise(r => setTimeout(r, 40));
    }
    const ignored = calls.filter(c => c === 'deny').length === denies && v.reforms === r0;
    v.audio = real;
    return { asleep, woke, patrols, stolen, standing, stung, ignored };
  });
  ok('snuffer steals', snuffer, snuffer.asleep && snuffer.woke && snuffer.patrols
    && snuffer.stolen && snuffer.standing && snuffer.stung && snuffer.ignored);

  // --- ▲ one-way gate: passes you down, solid from below ---
  const gate = await page.evaluate(async () => {
    const { g, until } = window.__H();
    const v = g.vault;
    const g2 = window.__TEST_VAULTS.find(x => x.glyph === 'proving').gates[0];
    const plane = -(g2.y1 + 1);
    v.invuln = 999;
    // drop through: the curtain passes what enters
    v.px = g2.x0 + 1; v.py = -(g2.y0 - 1) - 0.5; v.vx = 0; v.vy = 0;
    const passed = await until(() => v.py < plane - 1, 30, 50);
    // and refuses it back: an upward launch breaks on the underside
    v.px = g2.x0 + 1; v.py = plane - 1.6; v.vx = 0; v.vy = 12;
    let maxTop = -1e9;
    for (let i = 0; i < 12; i++) {
      await new Promise(r => setTimeout(r, 50));
      maxTop = Math.max(maxTop, v.py + 0.52);
    }
    return { passed, held: maxTop <= plane + 0.02, maxTop: +maxTop.toFixed(2), plane };
  });
  ok('one-way gate', gate, gate.passed && gate.held);

  // --- ▲ current: a rising carry, visible and vertical ---
  const current = await page.evaluate(async () => {
    const { g, until } = window.__H();
    const v = g.vault;
    const cu = window.__TEST_VAULTS.find(x => x.glyph === 'proving').currents[0];
    v.invuln = 999;
    v.px = cu.x0 + 1; v.py = -(cu.y1 + 0.5); v.vx = 0; v.vy = 0;
    const rose = await until(() => v.vy > 2, 20, 50);
    const carried = await until(() => -v.py < cu.y0 + 2, 100, 50);
    // ride the momentum past the column's mouth, drift out at the crest,
    // and the loft takes you — the spring, completed
    const crested = await until(() => -v.py < cu.y0 + 0.3, 40, 50);
    v.px = 44.5; v.vx = 0;
    const landed = await until(() => v.grounded && -v.py < cu.y0, 60, 50);
    return { rose, carried, crested, landed, y: +v.py.toFixed(1) };
  });
  ok('the current', current, current.rose && current.carried && current.crested && current.landed);

  // --- △ parked beam: dormant furniture until the arm rect wakes it ---
  const beam = await page.evaluate(async () => {
    const { g, until } = window.__H();
    const v = g.vault;
    const bd = window.__TEST_VAULTS.find(x => x.glyph === 'proving').beams[0];
    const parked = v.beamArmed[0] === false;
    const a0 = { x: v.beamRays[0].ex, y: v.beamRays[0].ey };
    await new Promise(r => setTimeout(r, 600));
    const still = Math.hypot(v.beamRays[0].ex - a0.x, v.beamRays[0].ey - a0.y) < 0.01;
    // inert: the parked cone costs nothing to stand in
    const r0 = v.reforms;
    v.invuln = 0;
    v.px = 36; v.py = -4.5; v.vx = 0; v.vy = 0;
    await new Promise(r => setTimeout(r, 250));
    const inert = v.reforms === r0;
    // cross the arm rect: the rounds begin
    v.px = bd.arm[0] + 1; v.py = -(bd.arm[1] + 1); v.vx = 0; v.vy = 0;
    const armed = await until(() => v.beamArmed[0], 20, 50);
    await new Promise(r => setTimeout(r, 600));
    const walks = Math.hypot(v.beamRays[0].ex - a0.x, v.beamRays[0].ey - a0.y) > 0.5;
    // and now it bites: hold station on the ray until it comes around
    let bit = false;
    for (let i = 0; i < 50 && !bit; i++) {
      const b = v.beamRays[0];
      v.px = (33.5 + b.ex) / 2; v.py = (-4.5 + b.ey) / 2; v.vx = 0; v.vy = 0; v.invuln = 0;
      await new Promise(r => setTimeout(r, 80));
      bit = v.reforms > r0;
    }
    return { parked, still, inert, armed, walks, bit };
  });
  ok('parked beam arms', beam, beam.parked && beam.still && beam.inert
    && beam.armed && beam.walks && beam.bit);

  // --- △ censer-ride: the crown is standable — the threat converts to
  // traversal at the top of the swing; the sides still burn ---
  const ride = await page.evaluate(async () => {
    const { g, until } = window.__H();
    const v = g.vault;
    await until(() => v.phase === 'run', 20);
    const r0 = v.reforms;
    v.invuln = 999;
    let rode = false;
    for (let i = 0; i < 40 && !rode; i++) {
      const p2 = v.censerPos(0);
      v.px = p2.x; v.py = p2.y + 0.45 + 0.52 + 0.2; v.vx = 0; v.vy = -1;
      await new Promise(r => setTimeout(r, 80));
      rode = v.ridingCenser === 0 && v.grounded;
    }
    const noKill = v.reforms === r0;
    const relit = v.spark;    // the bronze reads as footing: it re-arms
    // side contact is still the lantern's fire
    let burned = false;
    for (let i = 0; i < 40 && !burned; i++) {
      const p2 = v.censerPos(0);
      v.px = p2.x + 0.45; v.py = p2.y - 0.2; v.vx = 0; v.vy = 0; v.invuln = 0;
      await new Promise(r => setTimeout(r, 60));
      burned = v.reforms > r0;
    }
    return { rode, noKill, relit, burned };
  });
  ok('censer ride', ride, ride.rode && ride.noKill && ride.relit && ride.burned);

  // --- thin platforms: a bridge deck and a rime shelf are DRAWN as panels a
  // third of a tile deep, so that is all the body may collide with. Before
  // V3.5's band the whole tile was solid and a jump under a shelf bonked on
  // open air two thirds of a tile below the ice — the drawing and the rule
  // disagreeing where the player can plainly see it. Landing is the half that
  // must NOT move: the panel's top is the tile's top, which is what every
  // authored jump in the nine rooms was tuned against.
  const thin = await page.evaluate(async () => {
    const { g } = window.__H();
    const v = g.vault;
    const NONE = { left: false, right: false, up: false, down: false };
    const HH = 0.52;
    // A bridge deck spends half the beat clock switched off and frame()
    // recomputes that phase itself, so the probe cannot pin it — it waits for
    // an on-window and works inside one. Short throws keep both halves well
    // within a single window.
    const probe = (tx, ty, wait) => {
      const top = -ty;
      const settle = () => {
        if (!wait) return true;
        for (let i = 0; i < 400; i++) {
          if (wait()) return true;
          v.frame(1 / 60, NONE, false);
        }
        return false;
      };
      v.invuln = 999;
      // rise into the underside
      if (!settle()) return { under: null, lands: false };
      v.px = tx + 0.5; v.py = top - 1.2; v.vx = 0; v.vy = 0;
      let head = null;
      for (let i = 0; i < 30; i++) {
        v.vy = 9;
        v.frame(1 / 60, NONE, false);
        if (v.vy === 0) { head = v.py + HH; break; }
      }
      // then fall onto the top face
      if (!settle()) return { under: null, lands: false };
      v.px = tx + 0.5; v.py = top + 0.9; v.vx = 0; v.vy = 0;
      let feet = null;
      for (let i = 0; i < 40; i++) {
        v.frame(1 / 60, NONE, false);
        if (v.grounded) { feet = v.py - HH; break; }
      }
      return {
        under: head === null ? null : +(top - head).toFixed(3),
        lands: feet !== null && Math.abs(feet - top) < 0.02,
      };
    };
    const R = v.p.rime[1];
    const B = v.p.bridges.find(b => b.group === 0);
    return {
      rime: probe(R.x, R.y),
      bridge: probe(B.x, B.y, () => v.bridgeOn[B.group]),
    };
  });
  const bandOk = r => r.under !== null && r.under > 0.3 && r.under < 0.4 && r.lands;
  ok('thin platforms', thin, bandOk(thin.rime) && bandOk(thin.bridge));
});

await stage('meta', ['abandon', 'gallery', 'grandfather + gate'], async () => {
  // --- abandon, gallery, grandfathering, the gate ---
  const abandon = await page.evaluate(async () => {
    const { g, until, key } = window.__H();
    // stand this stage up on its own: escaping "out of" no vault at all
    // passes vacuously, which is exactly what a filtered run would do
    if (g.mode !== 'vault') {
      g.devVault('kindled');
      await until(() => g.mode === 'vault', 40);
    }
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

  // ===================================================================
  // THE V2 LINTS — a pillar without a lint rule is a wish (§I)
  // ===================================================================
});

await stage('lints', ['lint · chamber width', 'lint · sconce at boundary', 'lint · dark hazards emissive', 'lint · pulse ratio', 'lint · spark classification'], async () => {
  // --- P3a: no chamber is wider than the frame can hold legibly ---
  const chamberW = await page.evaluate(() => {
    const max = window.__CHAMBER_MAX_W;
    const rows = window.__VAULTS.map(v => {
      const p = window.__parseVault(v);
      const widths = p.chambers.map(c => c.x1 - c.x0 + 1);
      return { glyph: v.glyph, n: widths.length, worst: Math.max(...widths) };
    });
    return { max, worst: Math.max(...rows.map(r => r.worst)),
      over: rows.filter(r => r.worst > max).map(r => r.glyph + ':' + r.worst),
      unchambered: rows.filter(r => r.n < 2).map(r => r.glyph) };
  });
  ok('lint · chamber width', chamberW,
    chamberW.over.length === 0 && chamberW.unchambered.length === 0
    && chamberW.worst <= chamberW.max);

  // --- P3b: a sconce stands at every boundary the camera cuts on ---
  const boundarySconce = await page.evaluate(() => {
    const bad = [];
    let cuts = 0;
    for (const v of window.__VAULTS) {
      const p = window.__parseVault(v);
      for (const c of p.cuts) {
        cuts++;
        if (!p.sconces.some(s => Math.abs(s.x - c) <= 1)) bad.push(v.glyph + '@' + c);
      }
    }
    return { cuts, bad };
  });
  ok('lint · sconce at boundary', boundarySconce,
    boundarySconce.cuts >= 24 && boundarySconce.bad.length === 0);

  // --- P2: dark hides floors, never fangs. Every hazard VOLUME that reaches
  // into a `d` region has to be self-luminous or carry a visible track — read
  // off the real materials in the real scene, room by room. ---
  const darkFangs = await page.evaluate(async () => {
    const { g, until } = window.__H();
    const rows = [];
    const bad = [];
    let inDark = 0;
    for (const def of window.__VAULTS) {
      g.devVault(def.glyph);
      await until(() => g.mode === 'vault' && g.vault && g.vault.glyphId === def.glyph, 40);
      const hz = g.vault.darkHazards();
      for (const h of hz) {
        if (h.dark <= 0) continue;
        inDark++;
        if (!h.lit) bad.push(def.glyph + '/' + h.kind + h.i);
      }
      const n = hz.filter(h => h.dark > 0).length;
      if (n) rows.push(def.glyph + ':' + n);
    }
    return { inDark, bad, rooms: rows.join(' ') };
  });
  ok('lint · dark hazards emissive', darkFangs,
    darkFangs.inDark > 0 && darkFangs.bad.length === 0);

  // --- THE BEAT CLOCK (§III): one pulse per room. Every cyclic hazard's
  // period is an integer multiple of the pulse — bridges 4 (in code),
  // censers 3, shuttles/snuffers 2–4, crushers 3–4, spin beams 4–8, wind
  // calm/gust 4/3 — and every phase lands on a quarter-pulse. ---
  const pulseLint = await page.evaluate(() => {
    const bad = [];
    let cyclic = 0;
    const near = x => Math.abs(x - Math.round(x)) < 1e-3;
    for (const v of [...window.__VAULTS, ...window.__TEST_VAULTS]) {
      const pulse = v.clock ?? window.__PULSE;
      const chk = (arr, kind, lo, hi) => {
        for (const d of arr ?? []) {
          cyclic++;
          const n = d.period / pulse;
          if (!near(n) || Math.round(n) < lo || Math.round(n) > hi) {
            bad.push(`${v.glyph}/${kind}:${d.period}s`);
          } else if (!near((d.phase ?? 0) * Math.round(n) * 4)) {
            bad.push(`${v.glyph}/${kind}-phase:${d.phase}`);
          }
        }
      };
      chk(v.shuttles, 'shuttle', 2, 4);
      chk(v.censers, 'censer', 3, 3);
      chk(v.crushers, 'crusher', 3, 4);
      chk(v.beams, 'beam', 4, 8);
      if (v.wind) {
        cyclic++;
        const c = v.wind.calm / pulse, g2 = v.wind.gust / pulse;
        if (!near(c) || Math.round(c) !== 4 || !near(g2) || Math.round(g2) !== 3) {
          bad.push(`${v.glyph}/wind:${v.wind.calm}/${v.wind.gust}`);
        }
      }
    }
    return { cyclic, bad };
  });
  ok('lint · pulse ratio', pulseLint, pulseLint.cyclic >= 25 && pulseLint.bad.length === 0);

  // --- P1: one breath of light. The spark ledger must be TOTAL over the
  // parsed kit — an element that earns no classification is cut or
  // converted, and the lint is what makes that a rule instead of a wish. ---
  const sparkClass = await page.evaluate(() => {
    const SC = window.__SPARK_CLASS;
    const els = new Set();
    const CHAR = { S: 'sconce', X: 'stud', d: 'dark', A: 'bridge', b: 'bridge',
      '=': 'dead-surface',
      R: 'rime', o: 'mote', '*': 'brazier', '^': 'gravity', '>': 'gravity',
      '<': 'gravity', 1: 'door', 2: 'door', 3: 'door', K: 'figure', F: 'figure',
      C: 'figure', N: 'figure', M: 'master' };
    for (const v of [...window.__VAULTS, ...window.__TEST_VAULTS]) {
      for (const row of v.map) {
        for (const ch of row) {
          if (ch === 'S' && v.deadLight) els.add('famine-sconce');
          else if (CHAR[ch]) els.add(CHAR[ch]);
        }
      }
      if (v.beams) els.add('beam');
      for (const s of v.shuttles ?? []) els.add(s.snuff ? 'snuffer' : 'shuttle');
      if (v.censers) els.add('censer');
      if (v.crushers) els.add('crusher');
      if (v.pursuit) els.add('pursuit');
      if (v.wind) els.add('wind');
      if (v.gates) els.add('gate');
      if (v.currents) els.add('current');
    }
    const missing = [...els].filter(e => !SC[e] || !SC[e].length);
    return { kit: els.size, missing };
  });
  ok('lint · spark classification', sparkClass,
    sparkClass.kit >= 18 && sparkClass.missing.length === 0);
});

if (!listing) {
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
  if (only) console.log('(filtered run: ' + ran + ' stage(s) - re-run bare before shipping)');
}
await browser.close();
process.exit(failed || errors.length ? 1 : 0);
