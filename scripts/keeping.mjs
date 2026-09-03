// THE KEEPING (SPEC-KEEPING.md): the meta store survives NEW EXPEDITION,
// deposits mint kept light, cosmetics recoat the pod, the gemcutter consumes
// ore + fee, sponsorship gates on the census, stipend letters arrive once,
// and the deep infrastructure places, meters, and persists.
import { chromium } from 'playwright';

const OUT = process.argv[2] ?? '.';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
const ok = (name, data, pass) => console.log(`${name}:`, JSON.stringify(data), pass ? 'OK' : 'FAIL');

await page.goto('http://localhost:4173');
await page.waitForTimeout(2500);
await page.evaluate(() => localStorage.clear());
await page.click('#t-new');
await page.waitForTimeout(3600);

// --- the Ledger: ✦100 → ❖1, deposits only ---
const deposit = await page.evaluate(() => {
  const g = window.__game;
  g.state.money = 12345;
  g.panels.open('ledger');
  document.querySelector('#dep-all')?.click();
  const r = {
    money: g.state.money,
    keep: g.meta.keeplight,
    lifetime: g.meta.lifetimeBanked,
    stored: JSON.parse(localStorage.getItem('coreward_meta_v1') ?? '{}').keeplight,
  };
  g.panels.close();
  return r;
});
ok('deposit', deposit, deposit.money === 45 && deposit.keep === 123
  && deposit.lifetime === 12300 && deposit.stored === 123);

// --- the wardrobe: buy a coat, wear it, and the pod actually wears it ---
const coat = await page.evaluate(() => {
  const g = window.__game;
  g.meta.keeplight = 1000;
  g.panels.open('wardrobe');
  document.querySelector('button[data-slot="rig"][data-id="jade"]')?.click();
  const r = {
    worn: g.meta.finishRig,
    owned: g.meta.owned.includes('rig:jade'),
    keep: g.meta.keeplight,
    hull: g.pod.hullMat.color.getHex(),
  };
  g.panels.close();
  return r;
});
ok('paint locker', coat, coat.worn === 'jade' && coat.owned
  && coat.keep === 1000 - 240 && coat.hull === 0x6ea183);

// --- the gemcutter: 10 units + the fee becomes a kept trophy ---
const cut = await page.evaluate(() => {
  const g = window.__game;
  const defs = window.__TILE_DEFS;
  const t = Number(Object.keys(defs).find(k => defs[k].ore && defs[k].gem && defs[k].value >= 100));
  g.state.cargo.set(t, 12);
  g.state.money = 99999;
  const moneyBefore = g.state.money;
  g.panels.open('assay');
  document.querySelector(`button[data-cut="${t}"]`)?.click();
  const r = {
    trophies: g.meta.trophies.length,
    t: g.meta.trophies[0]?.t,
    grade: g.meta.trophies[0]?.grade,
    left: g.state.cargo.get(t) ?? 0,
    paid: moneyBefore - g.state.money,
    stored: (JSON.parse(localStorage.getItem('coreward_meta_v1') ?? '{}').trophies ?? []).length,
  };
  g.panels.close();
  return r;
});
ok('gemcutter', cut, cut.trophies === 1 && cut.t === cut.t && cut.left === 2
  && cut.paid > 0 && (cut.grade === 1 || cut.grade === 2) && cut.stored === 1);

// --- sponsorship: gated on the census, then resident forever ---
const sponsor = await page.evaluate(() => {
  const g = window.__game;
  g.meta.keeplight = 1000;
  g.panels.open('faunalog');
  const lockedButton = !!document.querySelector('button[data-sponsor="glimmerflies"]');
  g.panels.close();
  g.state.firedEvents.add('fauna:glimmerflies');
  g.panels.open('faunalog');
  document.querySelector('button[data-sponsor="glimmerflies"]')?.click();
  const r = {
    lockedButton,
    resident: g.meta.sponsored.includes('glimmerflies'),
    keep: g.meta.keeplight,
  };
  g.panels.close();
  return r;
});
ok('sponsorship', sponsor, !sponsor.lockedButton && sponsor.resident && sponsor.keep === 1000 - 120);

// --- the catalog: a wing is bought once ---
const wing = await page.evaluate(() => {
  const g = window.__game;
  g.meta.keeplight = 2000;
  g.panels.open('catalog');
  document.querySelector('button[data-buy="wing-gallery"]')?.click();
  const r = { built: g.meta.furnishings.includes('wing-gallery'), keep: g.meta.keeplight };
  g.panels.close();
  return r;
});
ok('the gallery wing', wing, wing.built && wing.keep === 2000 - 800);

// --- stipends: paid at the ledger; the first letter arrives on the tape ---
await page.evaluate(() => {
  const g = window.__game;
  g.state.money = 99999;
  g.panels.open('ledger');
  document.querySelector('#stipend')?.click();
  g.panels.close();
});
let letter = null;
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(500);
  letter = await page.evaluate(() => ({
    count: window.__game.state.stipends,
    lifetime: window.__game.meta.stipendsLifetime,
    fired: window.__game.state.firedEvents.has('stipend-1'),
  }));
  if (letter.fired) break;
}
ok('stipend letter', letter, letter.count === 1 && letter.lifetime === 1 && letter.fired);

// --- deep infrastructure: place a shaftlight and a depot at depth ---
const infra = await page.evaluate(async () => {
  const g = window.__game;
  for (let y = 30; y < 33; y++) for (let x = 20; x < 24; x++) g.terrain.carve(x, y);
  g.state.shaftlights = 2;
  g.state.depotKits = 1;
  g.state.money = 99999;
  g.ctrl.drilling = null;
  g.ctrl.px = 21; g.ctrl.py = -31.58; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.cam.snap(21, -31, 12);
  await new Promise(r => setTimeout(r, 400));
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyL' }));
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyL' }));
  await new Promise(r => setTimeout(r, 200));
  g.ctrl.px = 23;
  g.ctrl.grounded = true;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyN' }));
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyN' }));
  await new Promise(r => setTimeout(r, 200));
  return {
    lights: g.shaftlightField.list.length,
    lightKitsLeft: g.state.shaftlights,
    depots: g.depots.list.length,
    kitsLeft: g.state.depotKits,
  };
});
ok('placed works', infra, infra.lights === 1 && infra.lightKitsLeft === 1
  && infra.depots === 1 && infra.kitsLeft === 0);

// --- the waystation meters at 4× the surface rate ---
const meter = await page.evaluate(() => {
  const g = window.__game;
  g.state.fuel = 10;
  g.state.money = 10000;
  const before = g.state.money;
  g.panels.open('depot');
  document.querySelector('#dp-f')?.click();
  const r = { fuel: Math.round(g.state.fuel), max: g.state.maxFuel, paid: before - g.state.money };
  g.panels.close();
  return r;
});
ok('metered refill', meter, meter.fuel === meter.max
  && Math.abs(meter.paid - (meter.max - 10) * 1.6 * 4) < 2);

// --- placed infrastructure survives a reload ---
await page.evaluate(() => window.__game.saveNow());
await page.reload();
await page.waitForTimeout(3000);
await page.click('#t-continue');
await page.waitForTimeout(1800);
const reloaded = await page.evaluate(() => ({
  lights: window.__game.shaftlightField.list.length,
  depots: window.__game.depots.list.length,
  keep: window.__game.meta.keeplight,
  worn: window.__game.meta.finishRig,
  hull: window.__game.pod.hullMat.color.getHex(),
}));
ok('reload', reloaded, reloaded.lights === 1 && reloaded.depots === 1
  && reloaded.worn === 'jade' && reloaded.hull === 0x6ea183);

// --- NEW EXPEDITION erases the run and keeps the Keeping ---
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
await page.click('#quit');
await page.waitForTimeout(700);
await page.click('#t-new');
await page.waitForTimeout(300);
await page.click('#t-new');
await page.waitForTimeout(3600);
const kept = await page.evaluate(() => ({
  money: window.__game.state.money,
  stipendsRun: window.__game.state.stipends,
  keep: window.__game.meta.keeplight,
  worn: window.__game.meta.finishRig,
  trophies: window.__game.meta.trophies.length,
  resident: window.__game.meta.sponsored.includes('glimmerflies'),
  wing: window.__game.meta.furnishings.includes('wing-gallery'),
  lifetimeStipends: window.__game.meta.stipendsLifetime,
}));
ok('survives NEW EXPEDITION', kept, kept.money === 40 && kept.stipendsRun === 0
  && kept.worn === 'jade' && kept.trophies === 1 && kept.resident && kept.wing
  && kept.lifetimeStipends === 1);
await page.screenshot({ path: OUT + '/keeping.png' });

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
