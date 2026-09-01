// Phase 0: narrative engine, dispatch delivery, persistence, wreck chronology.
import { chromium } from 'playwright';

const OUT = process.argv[2] ?? '.';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

await page.goto('http://localhost:4173');
await page.waitForTimeout(2500);
await page.screenshot({ path: OUT + '/n-title.png' });
const advance = await page.evaluate(() => document.querySelector('.advance-line')?.textContent);
console.log('advance line:', JSON.stringify(advance), advance?.includes('40') ? 'OK' : 'FAIL');

await page.evaluate(() => localStorage.clear());
await page.click('#t-new');
await page.waitForTimeout(4200);

// the opening transmission should be on screen
const opened = await page.evaluate(() => ({
  open: document.querySelector('#comms')?.classList.contains('open'),
  text: document.querySelector('.comms-text')?.textContent,
  fired: [...window.__game.state.firedEvents],
}));
console.log('opening transmission:', JSON.stringify(opened.text?.slice(0, 40)),
  opened.open && opened.fired.includes('v3-start') ? 'OK' : 'FAIL');
await page.screenshot({ path: OUT + '/n-dispatch.png' });

// contract tracker gets pushed clear while dispatch talks
const pushed = await page.evaluate(() => document.querySelector('#hud-contract')?.classList.contains('pushed'));
console.log('contract pushed:', pushed ? 'OK' : 'FAIL');

// depth trigger — drain the queue rather than waiting out the typewriter
await page.evaluate(() => { window.__game.state.bestDepthM = 140; });
for (let i = 0; i < 8; i++) {
  await page.evaluate(() => window.__game.comms.clear());
  await page.waitForTimeout(400);
}
const depthFired = await page.evaluate(() => [...window.__game.state.firedEvents]);
console.log('depth events:', JSON.stringify(depthFired),
  depthFired.includes('v3-d60') && depthFired.includes('v3-d130') ? 'OK' : 'FAIL');

// events persist and never repeat
await page.evaluate(() => window.__game.saveNow());
await page.reload();
await page.waitForTimeout(2600);
await page.click('#t-continue');
await page.waitForTimeout(1500);
const afterLoad = await page.evaluate(() => [...window.__game.state.firedEvents]);
console.log('persisted:', afterLoad.length >= 3 && afterLoad.includes('v3-start') ? 'OK' : 'FAIL');

// wreck logs are tiered by depth and world-locked where specified
const tiers = await page.evaluate(() => {
  const g = window.__game;
  const out = [];
  for (const row of [40, 200, 300, 450]) {
    g.state.foundLogs.clear();
    g.pilot.px = 10; g.pilot.py = -row;
    const before = g.state.foundLogs.size;
    // force the log branch 30x and collect which tiers came back
    const seen = new Set();
    for (let i = 0; i < 60; i++) {
      g.state.foundLogs.clear();
      g.salvageReward(row);
      for (const idx of g.state.foundLogs) seen.add(idx);
    }
    out.push({ row, count: seen.size, before });
  }
  g.state.foundLogs.clear();
  return out;
});
console.log('wreck tiers by depth:', JSON.stringify(tiers));

// world-locked log must not appear on veil3
const locked = await page.evaluate(() => {
  const g = window.__game;
  g.state.foundLogs.clear();
  for (let i = 0; i < 200; i++) g.salvageReward(460);
  const titles = [...g.state.foundLogs].map(i => window.__WRECK_LOGS[i].title);
  g.state.foundLogs.clear();
  return titles;
});
console.log('deep logs on VEIL-3:', JSON.stringify(locked),
  !locked.some(t => t.includes('2 OF 3') || t.includes('3 OF 3')) ? 'OK (world-locked held)' : 'FAIL');

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
