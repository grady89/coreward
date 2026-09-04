// The vault kit's visual review — closeups of every object the player reads,
// saved to design-review/. Written for V3 (the kit) and extended for V3.5
// (the dress): the v3-* shots are the same framings, now showing the rebuilt
// objects, and the v35-* shots cover the families V3 never had on screen —
// the sconce fitting, the bolt and its posts, the crusher and its housing,
// the rime shelf, the bridge and its piers, the door's count, and the master
// stone's chamber.
//
// The last block is the one that cannot be judged from a still: THE CENSER'S
// ARC TELEGRAPH. It walks one full swing period and writes a strip of frames,
// because the question — does the apex read as the catchable place? — is a
// question about motion.
import { chromium } from 'playwright';

const OUT = 'design-review';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://localhost:4173');
await page.waitForTimeout(2500);
await page.evaluate(() => localStorage.clear());
await page.click('#t-new');
await page.waitForTimeout(3600);

const shot = async (name) => page.screenshot({ path: `${OUT}/${name}.png` });
const to = async (id) => {
  await page.evaluate(async (want) => {
    const g = window.__game;
    g.devVault(want);
    await new Promise(r => setTimeout(r, 400));
  }, id);
  await page.waitForTimeout(800);
};
// park the frame on a point — the review chase-cam
const snap = (x, y, z) => page.evaluate(([x, y, z]) => {
  const v = window.__game.vault;
  v.cam.snap(x, y, z);
  v.cam.followChamber = () => {};   // hold it there
}, [x, y, z]);
const at = async (x, y, z, name, settle = 400) => {
  await snap(x, y, z);
  await page.waitForTimeout(settle);
  await shot(name);
};
// put the body somewhere without letting anything in the room touch it
const body = (x, y) => page.evaluate(([x, y]) => {
  const v = window.__game.vault;
  v.invuln = 999;
  v.px = x; v.py = y; v.vx = 0; v.vy = 0;
}, [x, y]);

await to('proving');
await shot('v3-proving-wide');

// --- the light family -------------------------------------------------------

// the working sconce: backplate, bracket, turned baluster, cup, flame. Shot
// in THE WICK rather than the proving ground, because the fitting is bolted
// to a wall and the proving ground's two sconces both stand in open air.
await to('wick');
const wickSconce = await page.evaluate(() => {
  const v = window.__game.vault;
  // the first sconce with masonry beside it — the one the fitting is FOR
  const i = v.p.sconces.findIndex(s =>
    v.p.solid[s.y * v.p.w + s.x - 1] || v.p.solid[s.y * v.p.w + s.x + 1]);
  const s = v.p.sconces[Math.max(0, i)];
  return { i: Math.max(0, i), x: s.x + 0.5, y: -(s.y + 0.5) };
});
await at(wickSconce.x, wickSconce.y, 4.5, 'v35-sconce-unlit');
await page.evaluate(async (i) => {
  window.__game.vault.sconceLit[i] = true;
  await new Promise(r => setTimeout(r, 400));
}, wickSconce.i);
await at(wickSconce.x, wickSconce.y, 4.5, 'v35-sconce-lit');
await to('proving');

// the brazier: three chains, a beaten bowl, a bed of coals
await at(15.5, -18.2, 5, 'v3-brazier-motes');

// --- the hazard family ------------------------------------------------------

// snuffer asleep on its rail, next to the plain bolt that shares the wire
await at(8.5, -19.5, 7, 'v3-snuffer-asleep');
await body(6.5, -21.2);                     // walk the body near: it wakes
await page.waitForTimeout(1600);
await at(11, -19.8, 7, 'v3-snuffer-awake');

// the bolt: anchor posts, turned carriage, glass head, wake
await at(10, -17.5, 6, 'v35-bolt');

// the crusher: stone head, ember seam net, bronze ram out of its housing
await at(27, -17.6, 6, 'v35-crusher');
await page.waitForTimeout(1200);
await at(27, -17.6, 6, 'v35-crusher-extended');

// the rime shelf, and the crack web it draws once it is carrying you
await at(7.5, -19.5, 5, 'v35-rime');
await page.evaluate(() => {
  const v = window.__game.vault;
  v.rimeState[1].t = 0.34;                  // mid-crumble, the web spreading
});
await snap(7.5, -19.5, 5);
await page.waitForTimeout(60);
await shot('v35-rime-cracking');

// the bridge: piers lit either end, deck of light between them, and the
// hairline the deck leaves behind when its phase is off
await at(13.5, -19.4, 7, 'v35-bridge-on');
await page.evaluate(() => { window.__game.vault.bridgeOn = [false, true]; });
await page.waitForTimeout(200);
await at(13.5, -19.4, 7, 'v35-bridge-off');
await page.evaluate(() => { window.__game.vault.bridgeOn = [true, false]; });

// the door: a leaf in a stone opening, wearing the count it wants — and the
// same doorway once the price is paid, which must be an opening and not a gap
await at(37.5, -20.2, 5.5, 'v35-door');
await page.evaluate(() => {
  const v = window.__game.vault;
  v.sconceLit[0] = true;
  v.doorOpen[0] = true;
});
await page.waitForTimeout(1400);
await at(37.5, -20.2, 5.5, 'v35-door-open');

// the parked watch-lantern in the loft: pedestal, gimbal, counterweight arm
await at(34.5, -5, 7, 'v3-beam-parked');
await page.evaluate(() => {
  const v = window.__game.vault;
  v.beamArmed[0] = true; v.beamArmT[0] = v.time;
});
await page.waitForTimeout(700);
await at(34.5, -5, 7, 'v35-beam-live');

// --- the environment --------------------------------------------------------

await at(31, -9.5, 7, 'v3-gate');            // the one-way curtain
await at(41, -13, 9, 'v3-current');          // the rising current column
await at(45.5, -20.8, 6, 'v35-master');      // the master stone's chamber

// --- the censer, and the telegraph that has to be judged in motion ----------

await at(34, -18, 7, 'v3-censer-crown');
// one full period of the swing, evenly sampled. The apex pads should fill as
// the lantern arrives and empty as it runs, and the trace should be visibly
// brighter at the ends than through the bottom.
const period = await page.evaluate(() => window.__game.vault.def.censers[0].period);
for (let i = 0; i < 8; i++) {
  await page.evaluate(async (ms) => { await new Promise(r => setTimeout(r, ms)); }, (period * 1000) / 8);
  await shot(`v35-censer-arc-${i}`);
}

// --- the famine's cracked cup, in its own room ------------------------------

await to('famine');
await page.evaluate(async () => {
  const v = window.__game.vault;
  const s = v.p.sconces[0];
  v.invuln = 999;
  v.px = s.x + 0.5; v.py = -(s.y + 0.5); v.vx = 0; v.vy = 0;
  await new Promise(r => setTimeout(r, 600));
  v.cam.snap(s.x + 0.5, -(s.y + 0.5), 4.5);
  v.cam.followChamber = () => {};
});
await page.waitForTimeout(600);
await shot('v3-deadlight');

// --- the lattice, one shot per act (§VI architecture as chronology) ---------

for (const [glyph, name] of [['wick', 'v35-act1-maintained'], ['vault', 'v35-act2-stripped'], ['debt', 'v35-act3-hurried']]) {
  await to(glyph);
  await page.waitForTimeout(700);
  await shot(name);
}

await browser.close();
console.log('review shots written to ' + OUT);
