// Play a vault in the REAL runtime, frame by frame, from a probe script.
//
// The reach models (vaultfit's P5, levels-verify) do not simulate lanterns,
// bolts, bridges, wind, currents or doors, so they pass and fail rooms for
// the wrong reasons. This steps `__game.vault.frame(1/60, input, true)` —
// the game's own physics and hazards — under scripted input, so "playable"
// means a body actually got there.
//
// Usage: npm run build && npx vite preview --port 4173, then
//   node scripts/vaultplay.mjs --room=vault [--port=4173] probe.js [shot.png]
//
// The probe file is the BODY of an async function that receives `V` and
// returns JSON-able data (printed). V gives you:
//   g, v                 the game and the live vault
//   N, I({right:true})   input records (left/right/up/down)
//   row()                body centre in map rows (feet = row()+0.52); px is x
//   settle(n)            n idle frames
//   snap() / load(s)     save / restore the vault's whole simulation state
//   standAt(x, floorRow) teleport onto the floor whose tile row is floorRow
//   step(inp)            one frame. Jump: v.jumpPress() / v.jumpRelease().
//                        Spark: v.dash(I({right:true, up:true})).
//   runSeg(s, w, policy, goal, maxF)
//       from snapshot s, wait w idle frames, then each frame inp = policy(c),
//       c = {since, phase, f, ...yours}; goal(c) returns true (done), a
//       string (a named failure) or null (keep going). Returns {r, f}; r is
//       'ok' | 'dead' | 'timeout' | your string. A re-form counts as 'dead'.
//   measure(name, s, policies, goal, {period, step, maxF})
//       for every start phase w in [0, period) — the hazards' common cycle —
//       how many policies succeed. phasesOK is the share of phases where at
//       least one does: what a player who can WAIT at s actually faces.
//   plan(steps) continuous run: each step is [name, policies, goal, opts];
//       greedily takes the first (w, policy) that succeeds from where the
//       last step left the body. No teleports, real doors and checkpoints.
//       Returns {completed, seconds, log}.
// Hazard positions: v.shuttlePos(i), v.censerPos(i), v.bridgeOn[0|1],
// v.sconceLit[i], v.doorOpen[d], v.ridingCenser, v.wallDir, v.grounded,
// v.spark, v.completed, v.reforms, v.checkpoint, v.time.
import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const args = process.argv.slice(2);
const opt = (k, d) => (args.find(a => a.startsWith(`--${k}=`)) ?? '').split('=')[1] ?? d;
const files = args.filter(a => !a.startsWith('--'));
const room = opt('room', 'vault');
const port = opt('port', '4173');
const probe = readFileSync(files[0], 'utf8');
const shot = files[1];

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.goto(`http://localhost:${port}/?vault=${room}`);
await page.waitForFunction(r => window.__game?.vault?.phase === 'run' && window.__game.vault.glyphId === r, room, { timeout: 90000 });

const HELPERS = `
const g = window.__game, v = g.vault;
const N = { left: false, right: false, up: false, down: false };
const I = (o) => ({ ...N, ...o });
const row = () => -v.py;
const SKIP = new Set(['scene','camera','audio','hud','card','voice','def','p','cam']);
const plain = x => x === null || ['number','boolean','string'].includes(typeof x);
const flat = o => o && Object.getPrototypeOf(o) === Object.prototype && Object.values(o).every(plain);
const cloneable = a => Array.isArray(a) && a.every(e => plain(e) || flat(e));
function snap() {
  const s = {};
  for (const k of Object.keys(v)) {
    if (SKIP.has(k)) continue;
    const x = v[k];
    if (plain(x)) s[k] = x;
    else if (cloneable(x)) s[k] = structuredClone(x);
    else if (flat(x)) s[k] = { ...x };
  }
  return s;
}
function load(s) { for (const k of Object.keys(s)) v[k] = (typeof s[k] === 'object' && s[k] !== null) ? structuredClone(s[k]) : s[k]; }
const step = (inp = N) => v.frame(1 / 60, inp, true);
function settle(n = 30) { for (let i = 0; i < n; i++) step(N); }
function standAt(x, floorRow) {
  v.px = x; v.py = -floorRow + 0.53; v.vx = 0; v.vy = 0; v.spark = true; v.invuln = 0;
  v.dashT = 0; v.freezeT = 0;
  settle(30);
  return snap();
}
function runSeg(s, w, policy, goal, maxF = 900) {
  load(s);
  for (let i = 0; i < w; i++) step(N);
  const r0 = v.reforms; const c = { since: 0, phase: 0, f: 0 };
  for (let f = 0; f < maxF; f++) {
    c.since++; c.f = f;
    step(policy(c) ?? N);
    if (v.reforms > r0) return { r: 'dead', f };
    const r = goal(c);
    if (r === true) return { r: 'ok', f: f + w };
    if (typeof r === 'string') return { r, f };
  }
  return { r: 'timeout' };
}
function measure(name, s, policies, goal, { period = 306, step: st = 3, maxF = 900 } = {}) {
  const perW = []; const why = {};
  for (let w = 0; w < period; w += st) {
    let ok = 0;
    for (const p of policies) { const r = runSeg(s, w, p, goal, maxF).r; if (r === 'ok') ok++; else why[r] = (why[r] ?? 0) + 1; }
    perW.push(ok);
  }
  load(s);
  return { name, techs: policies.length, phasesOK: +(perW.filter(x => x > 0).length / perW.length).toFixed(2), perW: perW.join(' '), why };
}
function plan(steps) {
  const log = []; let total = 0;
  for (const [name, policies, goal, o = {}] of steps) {
    const s = snap(); const tally = {}; let done = false;
    const period = o.period ?? 306, st = o.step ?? 3, maxF = o.maxF ?? 900;
    for (let w = 0; w < period && !done; w += st) for (let k = 0; k < policies.length && !done; k++) {
      const res = runSeg(s, w, policies[k], goal, maxF);
      if (res.r === 'ok') {
        done = true; total += res.f;
        log.push({ step: name, w, tech: k, frames: res.f, at: [+v.px.toFixed(1), +row().toFixed(1)], lit: v.sconceLit.map(b => b ? 1 : 0).join(''), doors: v.doorOpen.map(b => b ? 1 : 0).join('') });
      } else tally[res.r] = (tally[res.r] ?? 0) + 1;
    }
    if (!done) { load(s); log.push({ step: name, FAILED: true, tally, at: [+v.px.toFixed(1), +row().toFixed(1)] }); break; }
  }
  return { completed: !!v.completed, seconds: +(total / 60).toFixed(1), log };
}
return { g, v, N, I, row, snap, load, step, settle, standAt, runSeg, measure, plan };
`;
await page.evaluate(src => { window.__VP = new Function(src); }, HELPERS);
const out = await page.evaluate(async body => {
  const V = window.__VP();
  return (new Function('V', 'return (async () => {' + body + '\n})()'))(V);
}, probe);
console.log(JSON.stringify(out, null, 1));
if (shot) await page.screenshot({ path: shot });
if (errs.length) { console.log('PAGEERRORS', errs); process.exitCode = 1; }
await browser.close();
