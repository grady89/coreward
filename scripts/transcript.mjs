// The dispatch transcript: a missed transmission is never lost — the assay
// dish keeps the tape, reconstructed from fired ids in play order.
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

// the opening dispatch has fired by now; simulate a few more missed ones,
// including an ad-hoc transmission and a non-transmission id (filtered)
await page.evaluate(() => {
  const g = window.__game;
  g.state.firedEvents.add('v3-d60');
  g.state.firedEvents.add('rime-taught');       // ad-hoc registry entry
  g.state.firedEvents.add('swarm-taught:veil3'); // a toast, not dispatch
  g.comms.clear();
  g.ctrl.drilling = null;
  g.ctrl.px = 52; g.ctrl.py = 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.cam.snap(52, 2, 14);
});
await page.waitForTimeout(1100);
await page.keyboard.press('KeyE'); // assay office
await page.waitForTimeout(700);
const btn = await page.evaluate(() => document.querySelector('#open-transcript')?.textContent);
console.log('assay button:', JSON.stringify(btn), (btn ?? '').includes('ON RECORD') ? 'OK' : 'FAIL');

await page.click('#open-transcript');
await page.waitForTimeout(600);
const tape = await page.evaluate(() => {
  const entries = [...document.querySelectorAll('.tx-entry')];
  return {
    count: entries.length,
    newestMeta: entries[0]?.querySelector('.tx-meta')?.textContent,
    newestText: entries[0]?.querySelector('p')?.textContent,
    hasStart: entries.some(e => e.textContent.includes('Dusklight, this is Dispatch')),
    hasRime: entries.some(e => e.textContent.includes('skinning over')),
    hasSwarmToast: entries.some(e => e.textContent.includes('LAMP')),
  };
});
console.log('the tape:', JSON.stringify(tape),
  tape.count === 3 && tape.hasStart && tape.hasRime && !tape.hasSwarmToast
    ? 'OK — dispatch only, nothing lost' : 'FAIL');
// newest first: the last id added (rime-taught) leads the page
console.log('newest first:', JSON.stringify(tape.newestMeta),
  (tape.newestText ?? '').includes('skinning over') ? 'OK' : 'FAIL');
await page.screenshot({ path: OUT + '/tx-tape.png' });

// back to the office, and the count survives a reload (it is save data)
await page.click('#tx-back');
await page.waitForTimeout(500);
const back = await page.evaluate(() => window.__game.panels.current);
console.log('back to the office:', back, back === 'assay' ? 'OK' : 'FAIL');
await page.evaluate(() => window.__game.saveNow());
await page.reload();
await page.waitForTimeout(3000);
await page.click('#t-continue');
await page.waitForTimeout(1500);
const persisted = await page.evaluate(() => {
  const g = window.__game;
  let n = 0;
  for (const id of g.state.firedEvents) if (id === 'v3-start' || id === 'v3-d60' || id === 'rime-taught') n++;
  return n;
});
console.log('tape survives reload:', persisted, persisted === 3 ? 'OK' : 'FAIL');

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
