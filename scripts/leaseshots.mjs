// Review shots for the lease: the trade post with the order posted, the
// Ledger itemized, and the two fee screens billing what the purse can't.
import { chromium } from 'playwright';

const OUT = process.argv[2] ?? '.';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://localhost:4173');
await page.waitForTimeout(2500);
await page.evaluate(() => localStorage.clear());
await page.click('#t-new');
await page.waitForFunction(() => window.__game?.mode === 'play', { timeout: 30000 });

await page.evaluate(() => {
  const g = window.__game, st = g.state;
  st.playTime = 6.4 * 3600; st.money = 1830; st.extractOrderHeard = true;
  st.cargo.set(2, 4); st.cargo.set(3, 2);
  g.panels.open('trade');
});
await page.waitForTimeout(400);
await page.screenshot({ path: OUT + '/l-trade.png' });

await page.evaluate(() => { const g = window.__game; g.panels.close(); g.state.billToLease(1256); g.panels.open('ledger'); });
await page.waitForTimeout(400);
await page.screenshot({ path: OUT + '/l-ledger.png' });

await page.evaluate(() => { const g = window.__game; g.panels.close(); g.state.money = 120; g.panels.open('death', { cause: 'a gas pocket', spilled: { value: 9400, count: 6 } }); });
await page.waitForTimeout(400);
await page.screenshot({ path: OUT + '/l-death.png' });

await page.evaluate(() => { const g = window.__game; g.panels.close(); g.state.money = 0; g.panels.open('rescue'); });
await page.waitForTimeout(400);
await page.screenshot({ path: OUT + '/l-rescue.png' });

await browser.close();
