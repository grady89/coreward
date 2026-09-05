// reproduce the post-completion fold-out and verify it finishes
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
await page.goto('http://localhost:4173');
await page.waitForTimeout(2500);
await page.evaluate(() => localStorage.clear());
await page.click('#t-new');
await page.waitForTimeout(3600);
await page.evaluate(async () => { window.__game.devVault('famine'); await new Promise(r => setTimeout(r, 900)); });
// complete it the shortcut way, then leave through the card
await page.evaluate(() => { const v = window.__game.vault; v.completed = true; v.closed = true; });
await page.waitForTimeout(700);
await page.screenshot({ path: 'design-review/foldexit-mid.png' });
const st1 = await page.evaluate(() => ({ mode: window.__game.mode, fold: !!window.__game.fold }));
await page.waitForTimeout(2500);
const st2 = await page.evaluate(() => ({ mode: window.__game.mode, fold: !!window.__game.fold,
  foldKind: window.__game.fold?.kind ?? null, t: window.__game.fold?.t ?? null }));
await page.screenshot({ path: 'design-review/foldexit-after.png' });
console.log('mid:', JSON.stringify(st1), 'after:', JSON.stringify(st2));
await browser.close();
