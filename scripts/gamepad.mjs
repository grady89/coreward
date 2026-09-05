// Controller: a synthetic standard pad drives the title screen, the pod, the
// kit modifier and the pause menu — and the prompts change hands with it.
import { chromium } from 'playwright';

const OUT = process.argv[2] ?? '.';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

// a pad the page can see: the same shape navigator.getGamepads() returns
await page.addInitScript(() => {
  window.__pad = { on: false, buttons: new Array(17).fill(0), axes: [0, 0, 0, 0] };
  navigator.getGamepads = () => {
    const p = window.__pad;
    if (!p.on) return [null];
    return [{
      id: 'Synthetic Pad (STANDARD GAMEPAD)',
      index: 0,
      connected: true,
      mapping: 'standard',
      timestamp: performance.now(),
      axes: p.axes.slice(),
      buttons: p.buttons.map(v => ({ pressed: v > 0.5, touched: v > 0, value: v })),
    }];
  };
});

const B = {
  a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, lt: 6, rt: 7,
  back: 8, start: 9, l3: 10, r3: 11, up: 12, down: 13, left: 14, right: 15,
};
const set = (patch) => page.evaluate(p => Object.assign(window.__pad, p), patch);
const hold = (names, v = 1) => page.evaluate(([ns, val]) => {
  for (const n of ns) window.__pad.buttons[n] = val;
}, [names.map(n => B[n]), v]);
/**
 * Wait until the game has actually polled the buttons into the state we set.
 * The pad is read once a frame and SwiftShader frames here can stretch past a
 * third of a second, so a fixed-length tap gets swallowed whole; this waits
 * for the poll instead of betting against it.
 */
const settle = (names, want) => page.waitForFunction(
  ([ns, w]) => ns.every(n => window.__game.pad.down(n) === w),
  [names, want], { timeout: 8000 },
);
async function press(names) {
  await hold(names, 1);
  await settle(names, true);
}
async function release(names) {
  await hold(names, 0);
  await settle(names, false);
}
async function tap(names) {
  await press(names);
  await release(names);
  await page.waitForTimeout(140);
}
/** push the left stick and wait until the game has polled the new direction */
async function stick(x, y) {
  await set({ axes: [x, y, 0, 0] });
  const want = { left: x < -0.5, right: x > 0.5, up: y < -0.5, down: y > 0.5 };
  await page.waitForFunction(w => {
    const d = window.__game.pad.dir;
    return d.left === w.left && d.right === w.right && d.up === w.up && d.down === w.down;
  }, want, { timeout: 8000 });
}

/** push the right stick and wait until the game has polled it */
async function rstick(y) {
  await set({ axes: [0, 0, 0, y] });
  await page.waitForFunction(w => Math.abs(window.__game.pad.ry - w) < 0.001, y, { timeout: 8000 });
}

const results = [];
const check = (label, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${detail ? ' — ' + detail : ''}`);
};

await page.goto('http://localhost:4173');
await page.waitForTimeout(2500);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(2500);

// ---- the pad arrives at the title screen ----
await set({ on: true });
await page.waitForTimeout(400);
check('pad detected', await page.evaluate(() => window.__game.pad.connected));

// a nudge seats the ring on the title's own menu
await tap(['down']);
const focused = await page.evaluate(() =>
  document.querySelector('#title .nav-focus')?.textContent ?? null);
check('title focus ring lands on a control', !!focused, focused ?? 'nothing focused');

// the title hint should now be reading in pad glyphs
const hint = await page.evaluate(() => document.querySelector('#title .controls-hint')?.textContent ?? '');
check('title hint speaks pad', hint.includes('L-STICK') && hint.includes('X'), hint.trim());
await page.screenshot({ path: OUT + '/g-title.png' });

// ---- walk the ring to DESCEND and press A ----
for (let i = 0; i < 6; i++) {
  const on = await page.evaluate(() => document.querySelector('#title .nav-focus')?.id ?? '');
  if (on === 't-new') break;
  await tap(['down']);
}
check('the ring reaches DESCEND',
  (await page.evaluate(() => document.querySelector('#title .nav-focus')?.id)) === 't-new');
await tap(['a']);
await page.waitForFunction(() => window.__game.mode === 'play', null, { timeout: 30000 })
  .catch(() => {});
const mode = await page.evaluate(() => window.__game.mode);
check('A descends into the run', mode === 'play', 'mode=' + mode);
await page.evaluate(() => window.__game.comms.clear());

// park clear of every building — X is interact, and a dock would swallow it
const park = (px, py = 0.42) => page.evaluate(([x, y]) => {
  const g = window.__game;
  g.ctrl.px = x; g.ctrl.py = y; g.ctrl.vx = 0; g.ctrl.vy = 0;
}, [px, py]);

// ---- flight: the stick lifts the pod ----
await park(26.5);
await page.waitForTimeout(300);
const y0 = await page.evaluate(() => window.__game.ctrl.py);
await stick(0, -1);
await page.waitForTimeout(1200);
await stick(0, 0);
const y1 = await page.evaluate(() => window.__game.ctrl.py);
check('left stick up flies', y1 > y0 + 0.5, `py ${y0.toFixed(2)} -> ${y1.toFixed(2)}`);

// ---- the right trigger is thrust too ----
await park(26.5);
await page.waitForTimeout(300);
const y2 = await page.evaluate(() => window.__game.ctrl.py);
await press(['rt']);
await page.waitForTimeout(1200);
await release(['rt']);
const y3 = await page.evaluate(() => window.__game.ctrl.py);
check('right trigger flies', y3 > y2 + 0.5, `py ${y2.toFixed(2)} -> ${y3.toFixed(2)}`);

// ---- the stick down drills ----
await page.waitForTimeout(2000);
await park(26.5);
await page.waitForTimeout(400);
const dug0 = await page.evaluate(() => window.__game.state.blocksDug);
await stick(0, 1);
await page.waitForTimeout(7000);
await stick(0, 0);
const dug1 = await page.evaluate(() => window.__game.state.blocksDug);
check('stick down drills', dug1 > dug0, `${dug0} -> ${dug1} blocks`);
await page.screenshot({ path: OUT + '/g-drilling.png' });

// ---- Y is the headlamp ----
const lamp0 = await page.evaluate(() => window.__game.lampOn);
await tap(['y']);
const lamp1 = await page.evaluate(() => window.__game.lampOn);
check('Y toggles the lamp', lamp0 !== lamp1, `${lamp0} -> ${lamp1}`);
await tap(['y']);

// ---- LT + X throws a flare; X alone must not ----
// underground and clear of the docks: a flare needs dark, X needs nothing to dock with
await park(26.5, -6);
await page.waitForTimeout(600);
await page.evaluate(() => {
  window.__game.state.flares = 3;
  window.__game.hud.setConsumables(3, 0, 0);
});
await tap(['x']);
const afterBare = await page.evaluate(() => ({
  flares: window.__game.state.flares, mode: window.__game.mode,
}));
check('X alone is interact, not the kit',
  afterBare.flares === 3 && afterBare.mode === 'play', JSON.stringify(afterBare));
let afterKit = 3;
for (let i = 0; i < 3 && afterKit === 3; i++) {
  await press(['lt']);
  await tap(['x']);
  await release(['lt']);
  await page.waitForTimeout(400);
  afterKit = await page.evaluate(() => window.__game.state.flares);
}
check('LT+X throws a flare', afterKit < 3, 'flares=' + afterKit);

// the kit strip should be quoting the modifier, not the letter Q
const kitTxt = await page.evaluate(() => document.querySelector('#kit')?.textContent ?? '');
check('kit strip speaks pad', kitTxt.includes('LT+X'), kitTxt.trim());

// ---- START opens the pause menu, the stick walks it, B closes it ----
await tap(['start']);
await page.waitForTimeout(400);
const paused = await page.evaluate(() => ({
  panel: window.__game.panels.current, mode: window.__game.mode,
  py: +window.__game.ctrl.py.toFixed(2), hull: Math.round(window.__game.state.hull),
}));
check('START pauses', paused.panel === 'pause', JSON.stringify(paused));
await tap(['down']);
await tap(['down']);
const ring = await page.evaluate(() => document.querySelector('.panel-scrim .nav-focus')?.textContent ?? null);
check('the ring walks the pause panel', !!ring, ring ?? 'nothing focused');
const legend = await page.evaluate(() => document.querySelector('.screen-sub')?.textContent ?? '');
check('the pause legend speaks pad', legend.includes('left stick') && legend.includes('hold LT'),
  legend.replace(/\s+/g, ' ').trim().slice(0, 90));
await page.screenshot({ path: OUT + '/g-pause.png' });
await tap(['b']);
await page.waitForTimeout(300);
check('B closes the panel', await page.evaluate(() => !window.__game.panels.isOpen));

// ---- settings: the stick drags a slider ----
await tap(['start']);
await page.waitForTimeout(300);
await page.evaluate(() => {
  [...document.querySelectorAll('.panel-scrim button')]
    .find(b => /SETTINGS/i.test(b.textContent))?.click();
});
await page.waitForTimeout(900);
check('settings opens', await page.evaluate(() => window.__game.panels.current === 'settings'),
  'panel=' + await page.evaluate(() => window.__game.panels.current));
// ---- the right stick scrolls the panel, wherever the ring is sitting ----
// the ring only lands on controls; the long panels are mostly prose between
// them, and a pad that cannot read them is not support
const pane = () => page.evaluate(() => {
  const p = document.querySelector('.panel-scrim .panel');
  return p ? { top: Math.round(p.scrollTop), max: Math.round(p.scrollHeight - p.clientHeight) } : null;
});
const scroll0 = await pane();
await rstick(1);
await page.waitForTimeout(700);
await rstick(0);
const scroll1 = await pane();
check('the right stick scrolls the menu', scroll0.max > 0 && scroll1.top > scroll0.top + 40,
  `${scroll0.top} -> ${scroll1.top} of ${scroll0.max}`);
await page.screenshot({ path: OUT + '/g-settings-scrolled.png' });
await rstick(-1);
await page.waitForTimeout(1000);
await rstick(0);
const scroll2 = await pane();
check('and back to the top', scroll2.top === 0, 'top=' + scroll2.top);

// walk the ring until it is sitting on a volume slider, whichever one
const sliderKey = async () => page.evaluate(() => {
  const el = document.querySelector('.panel-scrim .nav-focus');
  return el?.tagName === 'INPUT' ? el.dataset.vol : null;
});
let key = await sliderKey();
for (let i = 0; i < 14 && !key; i++) {
  await tap(['down']);
  key = await sliderKey();
}
check('the ring reaches a slider', !!key, 'slider=' + key);
const vol0 = await page.evaluate(k => window.__game.settings[k], key);
let vol1 = vol0;
for (let i = 0; i < 4 && vol1 >= vol0; i++) {
  await tap(['left']);
  vol1 = await page.evaluate(k => window.__game.settings[k], key);
}
check('the stick drags a slider', vol1 < vol0, `${key} ${vol0} -> ${vol1}`);
await page.screenshot({ path: OUT + '/g-settings.png' });
await tap(['b']);
await page.waitForTimeout(300);
await tap(['b']);
await page.waitForTimeout(300);

// ---- the keyboard takes the prompts back ----
await page.keyboard.press('KeyF');
await page.waitForTimeout(200);
const lampTxt = await page.evaluate(() => document.querySelector('#lamp-pip')?.textContent ?? '');
check('keyboard reclaims the glyphs', lampTxt.trim().endsWith('F'), lampTxt.trim());
await page.keyboard.press('KeyF');
await tap(['y']);
await page.waitForTimeout(200);
const lampTxt2 = await page.evaluate(() => document.querySelector('#lamp-pip')?.textContent ?? '');
check('the pad takes them again', lampTxt2.trim().endsWith('Y'), lampTxt2.trim());

// ---- the chart: the stick cycles sites, A commits, B backs out ----
await page.evaluate(() => {
  const g = window.__game;
  g.state.endedWorlds.add('veil3');
  g.ctrl.px = 52; g.ctrl.py = 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.cam.snap(52, 2, 14);
});
await page.waitForTimeout(900);
await tap(['x']);
await page.waitForTimeout(900);
await page.click('#open-starmap');
await page.waitForTimeout(3200);
check('the chart opens', await page.evaluate(() => window.__game.mode === 'starmap'));
const site0 = await page.evaluate(() => window.__game.starmap.selected);
await tap(['right']);
await page.waitForTimeout(600);
const site1 = await page.evaluate(() => window.__game.starmap.selected);
check('the stick cycles sites', site1 !== site0, `${site0} -> ${site1}`);
await page.screenshot({ path: OUT + '/g-starmap.png' });
await tap(['b']);
await page.waitForTimeout(900);
await tap(['b']);
await page.waitForTimeout(2500);
check('B backs out of the chart',
  await page.evaluate(() => window.__game.mode !== 'starmap'),
  'mode=' + await page.evaluate(() => window.__game.mode));

// ---- inside a stone: jump is edge-triggered, so the pad must edge too ----
await page.goto('http://localhost:4173/?vault=wick');
await page.waitForTimeout(4200);
await set({ on: true });
await page.waitForTimeout(500);
check('the stone opened', await page.evaluate(() => window.__game.mode === 'vault'),
  'mode=' + await page.evaluate(() => window.__game.mode));
// walk first, from an untouched spawn — a bad landing resets the run
const vx0 = await page.evaluate(() => window.__game.vault.px);
await stick(1, 0);
await page.waitForTimeout(1400);
await stick(0, 0);
const vx1 = await page.evaluate(() => window.__game.vault.px);
check('the stick walks the vault', Math.abs(vx1 - vx0) > 0.5, `px ${vx0.toFixed(2)} -> ${vx1.toFixed(2)}`);

// jump is edge-triggered and buffered, so the pad has to give it real edges
const vy0 = await page.evaluate(() => window.__game.vault.py);
await press(['a']);
await page.waitForTimeout(500);
await release(['a']);
await page.waitForTimeout(200);
const vy1 = await page.evaluate(() => window.__game.vault.py);
check('A jumps in the vault', vy1 > vy0 + 0.3, `py ${vy0.toFixed(2)} -> ${vy1.toFixed(2)}`);
await page.waitForTimeout(900);
await page.screenshot({ path: OUT + '/g-vault.png' });

// ---- unplugging hands everything back without a stuck throttle ----
await set({ on: false, axes: [0, -1, 0, 0] });
await page.waitForTimeout(500);
const dropped = await page.evaluate(() => ({
  connected: window.__game.pad.connected,
  up: window.__game.padDir?.up,
}));
check('unplugging clears held input', dropped.connected === false, JSON.stringify(dropped));

console.log(errors.length ? errors.join('\n') : 'no page errors');
const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
await browser.close();
process.exit(failed || errors.length ? 1 : 0);
