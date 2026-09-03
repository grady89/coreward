// V2 presentation review: the chamber frames, the rim-light lattice, the
// three value bands + fog planes in the dark, the sconce chord mid-flare,
// the standing dead in all four postures, and a floor of spent wicks.
//
// Usage: npm run build && vite preview --port 4173, then
//   node scripts/vaultlook.mjs design-review
import { chromium } from 'playwright';

const OUT = process.argv[2] ?? 'design-review';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));

await page.goto('http://localhost:4173/?vault=wick');
await page.waitForTimeout(3800);

const H = `
  const g = window.__game;
  const until = async (fn, n = 80, ms = 100) => { for (let i = 0; i < n; i++) { if (fn()) return true; await new Promise(r => setTimeout(r, ms)); } return fn(); };
  return { g, until };
`;
await page.evaluate(src => { window.__H = new Function(src); }, H);

/** drop the body somewhere and let the frame settle on its chamber */
const shot = async (name, glyph, x, y, extra = null) => {
  await page.evaluate(async ([glyph, x, y, extra]) => {
    const { g, until } = window.__H();
    if (g.vault?.glyphId !== glyph) {
      g.devVault(glyph);
      await until(() => g.mode === 'vault' && g.vault?.glyphId === glyph, 60);
    }
    const v = g.vault;
    v.px = x; v.py = y; v.vx = 0; v.vy = 0; v.invuln = 999;
    if (extra) new Function('v', 'g', extra)(v, g);
    await new Promise(r => setTimeout(r, 900));
  }, [glyph, x, y, extra]);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  const st = await page.evaluate(() => {
    const v = window.__game.vault;
    const c = v.p.chambers[v.chamber];
    return { ch: `${v.chamber}/${v.p.chambers.length - 1}`, span: `${c.x0}-${c.x1}`,
      cam: [+v.cam.camera.position.x.toFixed(1), +v.cam.camera.position.y.toFixed(1), +v.cam.camera.position.z.toFixed(1)],
      body: [+v.px.toFixed(1), +v.py.toFixed(1)] };
  });
  console.log('rendered', name, JSON.stringify(st));
};

// the lattice in a LIT room: every standable face carries its rim
await shot('vv-lattice-wick', 'wick', 6.5, -24.4);
// the chimney: a narrow chamber, framed tight
await shot('vv-chamber-chimney', 'wick', 46.5, -16);
// the sconce chord, caught mid-flare
await shot('vv-chord', 'wick', 12.6, -25.4);
// the three value bands + the fog planes, in the only dark room there is
await shot('vv-dark-bands', 'kindled', 24.5, -39.4);
// the four who stayed, one posture each, and the master stone with them
await shot('vv-figures', 'kindled', 52.5, -6.4);
// a curled figure naming the unlight floor ahead of it
await shot('vv-posture-wick', 'wick', 22.5, -25.4);
// a floor of spent wicks: the record of failure
await shot('vv-wicks', 'wick', 6.5, -24.4,
  'for (let i = 0; i < 12; i++) v.addWick(1.5 + i * 1.1, -25.4 + (i % 3) * 0.3);');
// the kneeling keeper at the mouth of the shift's first descent
await shot('vv-posture-shift', 'shift', 41.5, -6.4);
// the debt's crooked Act III rims, and its fallen keeper
await shot('vv-crooked-debt', 'debt', 15.5, -18.4);

// --- the posture sheet: the four who stayed, framed the way the reference
// sheets frame them — the rig held, close, nothing else in shot ---
await page.evaluate(async () => {
  const { g, until } = window.__H();
  g.devVault('kindled');
  await until(() => g.mode === 'vault' && g.vault?.glyphId === 'kindled', 60);
  const v = g.vault;
  v.px = 54.5; v.py = -7.4; v.vx = 0; v.vy = 0; v.invuln = 999;
  for (let i = 0; i < v.sconceLit.length; i++) v.sconceLit[i] = true;
  // hold the frame on the tableau: chamberFrame is the one dial the camera
  // reads, so shadowing it on the instance is the whole override
  v.cam.camera.fov = 20;
  v.cam.camera.updateProjectionMatrix();
  v.chamberFrame = () => ({ cx: 51.4, cz: 14 });
  await new Promise(r => setTimeout(r, 900));
});
await page.screenshot({ path: `${OUT}/vv-posture-sheet.png` });
console.log('rendered vv-posture-sheet');

await browser.close();
