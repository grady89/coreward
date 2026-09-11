// The lease: Cindral's book against the driller. Posted beside every sale
// from the first hour, it runs on the clock and takes every fee the purse
// can't cover — and only Order 9-1-1 ever closes it.
import { chromium } from 'playwright';

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
const digits = s => (s ?? '').replace(/\D/g, '');

await page.goto('http://localhost:4173');
await page.waitForTimeout(2500);
await page.evaluate(() => localStorage.clear());
await page.click('#t-new');
await page.waitForFunction(() => window.__game?.mode === 'play', { timeout: 30000 });

// the book opens with the pod and the passage — not forty Lumens
const open = await page.evaluate(() => {
  const st = window.__game.state;
  return { owed: st.debtOwed, principal: st.leasePrincipal, carry: st.leaseCarry, advance: st.money };
});
console.log('book at start:', JSON.stringify(open),
  open.principal === 207500 && open.owed === open.principal + open.carry && open.carry < 50 ? 'OK' : 'FAIL');

// the carrying charge runs on the clock
const carried = await page.evaluate(() => {
  const st = window.__game.state;
  st.playTime = 10 * 3600;
  return { carry: st.leaseCarry, owed: st.debtOwed };
});
console.log('10h on the clock:', JSON.stringify(carried),
  carried.carry === 12450 && carried.owed === 219950 ? 'OK' : 'FAIL');

// the ledger itemizes it
await page.evaluate(() => window.__game.panels.open('ledger'));
await page.waitForTimeout(300);
const ledger = await page.evaluate(() => document.querySelector('.panel')?.textContent ?? '');
console.log('ledger itemized:',
  ledger.includes('Coreward-class pod') && ledger.includes('10.0h on the clock') && ledger.includes('OWED') && digits(ledger).includes('219950') ? 'OK' : 'FAIL');

// the trade post posts it beside every sale, from the first one
await page.evaluate(() => { window.__game.panels.close(); window.__game.panels.open('trade'); });
await page.waitForTimeout(300);
const strip = await page.evaluate(() => document.querySelector('.lease-strip')?.textContent);
console.log('trade post strip:', JSON.stringify(strip),
  strip?.includes('OWED') && digits(strip) === '219950' ? 'OK' : 'FAIL');

// once the order is heard, the card says exactly what it would wipe
await page.evaluate(() => { const g = window.__game; g.panels.close(); g.state.extractOrderHeard = true; g.panels.open('trade'); });
await page.waitForTimeout(300);
const card = await page.evaluate(() => document.querySelector('.order-body')?.textContent);
console.log('order card:', JSON.stringify(card),
  card?.includes('ALL DEBTS CLEARED') && digits(card).includes('219950') ? 'OK' : 'FAIL');
await page.evaluate(() => window.__game.panels.close());

// a salvage fee the purse can't cover lands on the book
const death = await page.evaluate(() => {
  const g = window.__game, st = g.state;
  st.money = 0;
  g.panels.open('death', { cause: 'the test', spilled: { value: 10000, count: 3 } });
  const text = document.querySelector('.screen-sub')?.textContent ?? '';
  g.panels.close();
  return { charges: st.debtCharges, text };
});
console.log('salvage on the book:', JSON.stringify({ charges: death.charges }),
  death.charges === 1200 && death.text.includes('billed to the lease') ? 'OK' : 'FAIL');

// an empty-purse tow is not on the house either
const tow = await page.evaluate(() => {
  const g = window.__game, st = g.state;
  st.money = 0; st.fuel = 0;
  const before = st.debtCharges;
  g.panels.open('rescue');
  const text = document.querySelector('.screen-sub')?.textContent ?? '';
  document.querySelector('#rescue')?.click();
  return { billed: st.debtCharges - before, text, fuel: Math.round(st.fuel) };
});
console.log('tow on the book:', JSON.stringify({ billed: tow.billed, fuel: tow.fuel }),
  tow.billed === 56 && tow.text.includes('go on the lease') && tow.fuel === 35 ? 'OK' : 'FAIL');

// the book survives a reload
await page.evaluate(() => window.__game.saveNow());
await page.reload();
await page.waitForTimeout(3000);
await page.click('#t-continue');
await page.waitForFunction(() => window.__game?.mode === 'play', { timeout: 30000 });
const back = await page.evaluate(() => {
  const st = window.__game.state;
  return { charges: st.debtCharges, settled: st.debtSettled, owed: st.debtOwed };
});
console.log('after reload:', JSON.stringify(back),
  back.charges === 1256 && back.settled === null && back.owed >= 221206 ? 'OK' : 'FAIL');

// the first delivery closes the book, and the toast says by how much
const delivered = await page.evaluate(() => {
  const g = window.__game, st = g.state;
  st.carrying = 'veil3'; st.extractOrderHeard = true;
  const owedBefore = st.debtOwed, money = st.money;
  g.panels.open('trade');
  document.querySelector('#deliver')?.click();
  return { owedBefore, settled: st.debtSettled, owed: st.debtOwed, gained: st.money - money };
});
console.log('delivery closes the book:', JSON.stringify(delivered),
  delivered.settled === delivered.owedBefore && delivered.owed === 0 && delivered.gained === 300000 ? 'OK' : 'FAIL');

await page.evaluate(() => { window.__game.panels.close(); window.__game.panels.open('ledger'); });
await page.waitForTimeout(300);
const closed = await page.evaluate(() => document.querySelector('.sell-total')?.textContent ?? '');
console.log('ledger closed:', JSON.stringify(closed), closed.includes('SETTLED') ? 'OK' : 'FAIL');
await page.evaluate(() => { window.__game.panels.close(); window.__game.panels.open('trade'); });
await page.waitForTimeout(300);
const stripAfter = await page.evaluate(() => document.querySelector('.lease-strip')?.textContent ?? '');
console.log('trade post after:', JSON.stringify(stripAfter), stripAfter.includes('SETTLED') ? 'OK' : 'FAIL');
await page.evaluate(() => window.__game.panels.close());

// a descent re-issues the lease, and Cindral has read your file
const ng = await page.evaluate(() => {
  const st = window.__game.state;
  st.beginDescent();
  return { settled: st.debtSettled, principal: st.leasePrincipal, descent: st.descent };
});
console.log('second descent:', JSON.stringify(ng),
  ng.settled === null && ng.principal === 311250 && ng.descent === 1 ? 'OK' : 'FAIL');

console.log(errors.length ? errors.join('\n') : 'no page errors');
await browser.close();
