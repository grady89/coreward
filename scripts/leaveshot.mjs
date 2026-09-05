// the interior exit: the door opens and takes you, then the surface answers
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
await page.goto('http://localhost:4173');
await page.waitForTimeout(2500);
await page.evaluate(() => localStorage.clear());
await page.click('#t-new');
await page.waitForTimeout(3600);
await page.evaluate(async () => { window.__game.devVault('wick'); await new Promise(r => setTimeout(r, 900)); });
await page.evaluate(() => { window.__game.vault.interact(); });
await page.waitForTimeout(400);
await page.screenshot({ path: 'design-review/leave-door-mid.png' });
await page.waitForTimeout(3000);
const st = await page.evaluate(() => ({ mode: window.__game.mode, fold: !!window.__game.fold }));
await page.screenshot({ path: 'design-review/leave-landed.png' });
console.log('after leave:', JSON.stringify(st));
await browser.close();
