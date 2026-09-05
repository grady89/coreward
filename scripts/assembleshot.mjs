// catch the room mid-ARRIVAL and mid-COLLAPSE
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
await page.goto('http://localhost:4173');
await page.waitForTimeout(2500);
await page.evaluate(() => localStorage.clear());
await page.click('#t-new');
await page.waitForTimeout(3600);
await page.evaluate(() => { window.__game.devVault('famine'); });
await page.waitForTimeout(350);
await page.screenshot({ path: 'design-review/assemble-mid.png' });
await page.waitForTimeout(2600);
await page.screenshot({ path: 'design-review/assemble-done.png' });
await page.evaluate(() => { window.__game.vault.interact(); });
await page.waitForTimeout(650);
await page.screenshot({ path: 'design-review/collapse-mid.png' });
console.log('assembly shots');
await browser.close();
