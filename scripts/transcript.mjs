// The dispatch transcript: a missed transmission is never lost — the tape,
// reconstructed from fired ids in play order, now lives at the Quarters'
// console (SPEC-KEEPING §2); the unread marker rides panels.unreadCount().
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
});
await page.waitForTimeout(600);
const unread = await page.evaluate(() => window.__game.panels.unreadCount());
console.log('unread count:', unread, unread === 3 ? 'OK — everything unread on a first visit' : 'FAIL');

// walk into the quarters and read the tape at the console
const console1 = await page.evaluate(async () => {
  const g = window.__game;
  g.ctrl.drilling = null;
  g.ctrl.px = 7; g.ctrl.py = 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  await new Promise(r => setTimeout(r, 300));
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE' }));
  await new Promise(r => setTimeout(r, 400));
  return { mode: g.mode };
});
console.log('into the quarters:', JSON.stringify(console1), console1.mode === 'interior' ? 'OK' : 'FAIL');
await page.screenshot({ path: OUT + '/tx-quarters.png' });
await page.evaluate(() => window.__game.panels.open('transcript'));
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
const fresh = await page.evaluate(() => document.querySelectorAll('.tx-entry.fresh').length);
console.log('entries flagged new:', fresh, fresh === 3 ? 'OK' : 'FAIL');
await page.screenshot({ path: OUT + '/tx-tape.png' });

// reading the tape clears the mark; SET THE TAPE DOWN closes the panel
await page.click('#tx-back');
await page.waitForTimeout(500);
const back = await page.evaluate(() => ({
  panel: window.__game.panels.current,
  mode: window.__game.mode,
  seen: window.__game.state.transcriptSeen,
  unread: window.__game.panels.unreadCount(),
}));
console.log('reading clears it:', JSON.stringify(back),
  back.panel === null && back.mode === 'interior' && back.seen === 3 && back.unread === 0
    ? 'OK' : 'FAIL');

// a NEW transmission re-arms the marker
const rearm = await page.evaluate(() => {
  const g = window.__game;
  g.state.firedEvents.add('v3-d130');
  return { unread: g.panels.unreadCount() };
});
console.log('new traffic re-arms:', JSON.stringify(rearm), rearm.unread === 1 ? 'OK' : 'FAIL');
// leave the quarters so saveNow runs from play mode
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
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
