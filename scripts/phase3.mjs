// Phase 3: Lamplighter ruins, glyph codex, per-world swarm dialects.
import { chromium } from 'playwright';

const OUT = process.argv[2] ?? '.';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

await page.goto('http://localhost:4173');
await page.waitForTimeout(2500);
await page.evaluate(() => localStorage.clear());
await page.click('#t-new');
await page.waitForTimeout(3600);
await page.evaluate(() => window.__game.comms.clear());

// --- ruins generated with masonry + glyphs, below the deep line ---
const ruins = await page.evaluate(() => {
  const g = window.__game;
  let masonry = 0, glyphs = 0, minY = 1e9;
  for (let y = 0; y < 512; y++) for (let x = 0; x < 64; x++) {
    const t = g.terrain.get(x, y);
    if (t === 19) { masonry++; minY = Math.min(minY, y); }
    if (t === 20) glyphs++;
  }
  return { chambers: g.terrain.ruins.length, masonry, glyphs, minY };
});
console.log('ruins:', JSON.stringify(ruins),
  ruins.chambers >= 5 && ruins.masonry > 150 && ruins.glyphs >= 5 && ruins.minY >= 330 ? 'OK' : 'FAIL');

// --- flying near a chamber trips the sighting ---
const sighted = await page.evaluate(async () => {
  const g = window.__game;
  const r = g.terrain.ruins[0];
  g.ctrl.px = r.x; g.ctrl.py = -r.y; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.state.hull = 100000; g.state.fuel = g.state.maxFuel;
  g.state.upgrades.radiator = 5;
  g.cam.snap(r.x, -r.y, 13);
  await new Promise(res => setTimeout(res, 900));
  return { saw: g.state.sawRuins, ruin: { x: Math.round(r.x), y: Math.round(r.y) } };
});
console.log('ruin sighted:', JSON.stringify(sighted), sighted.saw ? 'OK' : 'FAIL');
await page.screenshot({ path: OUT + '/p3-ruin.png' });

// --- a Warden takes post at the chamber and tracks luminance ---
const warden = await page.evaluate(async () => {
  const g = window.__game;
  const r = g.terrain.ruins[0];
  // stand inside the chamber, a respectful distance from its centre
  g.ctrl.drilling = null;
  g.ctrl.px = r.x + 3; g.ctrl.py = -r.y; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.state.hull = 100000;
  g.lampOn = true;
  g.cam.snap(r.x, -r.y, 15);
  await new Promise(res => setTimeout(res, 1600));
  const posted = g.threats.wardenAlive;
  const engagedLit = g.threats.warden.engaged;
  const diag = {
    dist: +Math.hypot(g.threats.warden.x - g.ctrl.px, g.threats.warden.y - g.ctrl.py).toFixed(1),
    lamp: g.lampOn,
  };
  // run dark: it should lose interest and go back to sweeping
  g.lampOn = false;
  await new Promise(res => setTimeout(res, 1500));
  const engagedDark = g.threats.warden.engaged;
  return { posted, engagedLit, engagedDark, diag, scrutiny: +g.threats.scrutiny.toFixed(2) };
});
console.log('warden:', JSON.stringify(warden),
  warden.posted && warden.engagedLit && !warden.engagedDark ? 'OK' : 'FAIL');
await page.screenshot({ path: OUT + '/p3-warden.png' });

// --- only demolition hurts a Warden ---
const wardenKill = await page.evaluate(async () => {
  const g = window.__game;
  if (!g.threats.wardenAlive) return { err: 'no warden' };
  const before = g.threats.warden.integrity;
  g.threats.drillHit(g.threats.warden.x, g.threats.warden.y, 1);
  const afterDrill = g.threats.warden.integrity;
  g.threats.blast(g.threats.warden.x, g.threats.warden.y, 3.2);
  g.threats.blast(g.threats.warden.x, g.threats.warden.y, 3.2);
  return { before, afterDrill, alive: g.threats.wardenAlive };
});
console.log('warden armour:', JSON.stringify(wardenKill),
  wardenKill.afterDrill === wardenKill.before && !wardenKill.alive ? 'OK' : 'FAIL');

// --- masonry is slow, glyphs are collectible ---
const glyph = await page.evaluate(async () => {
  const g = window.__game;
  // find a glyph tile and park the pod directly above it
  let gx = -1, gy = -1;
  for (let y = 330; y < 480 && gy < 0; y++)
    for (let x = 0; x < 64; x++) if (g.terrain.get(x, y) === 20) { gx = x; gy = y; break; }
  if (gy < 0) return { err: 'no glyph' };
  for (let y = gy - 4; y < gy; y++) g.terrain.carve(gx, y);
  g.ctrl.px = gx + 0.5; g.ctrl.py = -gy + 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.state.upgrades.drill = 5;
  g.cam.snap(gx, -gy, 12);
  await new Promise(r => setTimeout(r, 500));
  const before = g.state.glyphs;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown' }));
  await new Promise(r => setTimeout(r, 7000));
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowDown' }));
  return { before, after: g.state.glyphs, tile: g.terrain.get(gx, gy) };
});
console.log('glyph collected:', JSON.stringify(glyph),
  glyph.after > glyph.before && glyph.tile === 0 ? 'OK' : 'FAIL');

// --- codex appears at the assay office ---
await page.evaluate(() => {
  const g = window.__game;
  g.ctrl.drilling = null; // an in-progress drill blocks docking
  g.ctrl.px = 52; g.ctrl.py = 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.cam.snap(52, 2, 14);
});
await page.waitForTimeout(1000);
await page.keyboard.press('KeyE');
await page.waitForTimeout(700);
const codex = await page.evaluate(() => document.body.textContent.includes('CODEX'));
console.log('codex panel:', codex ? 'OK' : 'FAIL');
await page.screenshot({ path: OUT + '/p3-codex.png' });
await page.keyboard.press('Escape');

// --- dialects: each world keys on a different organ ---
const dialects = await page.evaluate(() => window.__WORLDS.map(w => ({
  id: w.id, name: w.swarm.name, keys: w.swarm.keys,
})));
console.log('dialects:', JSON.stringify(dialects),
  dialects[0].keys === 'light' && dialects[1].keys === 'heat' && dialects[2].keys === 'space' ? 'OK' : 'FAIL');

// heat-keyed swarm ignores the lamp and answers the thruster
const heatKey = await page.evaluate(async () => {
  const g = window.__game;
  g.state.endedWorlds.add('veil3');
  g.state.activeWorld = 'cryos2';
  g.state.persist();
  return true;
});
await page.reload();
await page.waitForTimeout(2600);
await page.click('#t-continue');
await page.waitForTimeout(1600);
const cryosSwarm = await page.evaluate(async () => {
  const g = window.__game;
  g.comms.clear();
  for (let y = 194; y < 208; y++) for (let x = 20; x < 44; x++) g.terrain.carve(x, y);
  g.ctrl.px = 31.5; g.ctrl.py = -206 + 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.state.fuel = g.state.maxFuel; g.state.hull = 100000;
  g.cam.snap(31.5, -204, 12.5);
  g.threats.reset();
  for (let i = 0; i < 40; i++) {
    g.threats.spawnTimer = 0;
    await new Promise(r => setTimeout(r, 60));
    if (g.threats.mesh.count > 0) break;
  }
  const s = g.threats.swarms.find(x => x.alive);
  if (!s) return { err: 'no swarm' };
  s.ax = g.ctrl.px + 3; s.ay = g.ctrl.py;
  // lamp ON but engine OFF: a heat-keyed swarm should not care
  g.lampOn = true;
  await new Promise(r => setTimeout(r, 1400));
  const lampOnly = g.threats.swarms.some(x => x.alerted);
  // now fire the thrusters
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' }));
  await new Promise(r => setTimeout(r, 1600));
  const withThrust = g.threats.swarms.some(x => x.alerted);
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowUp' }));
  return { world: g.state.activeWorld, lampOnly, withThrust };
});
console.log('cryos heat-keyed:', JSON.stringify(cryosSwarm),
  cryosSwarm.lampOnly === false && cryosSwarm.withThrust === true ? 'OK' : 'FAIL');
await page.screenshot({ path: OUT + '/p3-cryos-swarm.png' });

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
console.log(heatKey ? '' : '');
await browser.close();
