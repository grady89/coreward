// Frame THE FOLD (SPEC-FOLD.md) and shoot it mid-sequence: enter a vault
// via devVault, abandon it, and catch the fold-out sealing the stone; then
// trigger a fold-in from the surface and catch the throat opening.
//
//   node scripts/foldshot.mjs
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
await page.goto('http://localhost:4173');
await page.waitForTimeout(2500);
await page.evaluate(() => localStorage.clear());
await page.click('#t-new');
await page.waitForTimeout(3600);
await page.evaluate(async (g) => { window.__game.devVault(g); await new Promise(r => setTimeout(r, 900)); }, 'wick');

// leave: the fold-out seals the stone behind the pilot
await page.evaluate(() => { window.__game.vault.abandon(); });
await page.waitForTimeout(500);
await page.screenshot({ path: 'design-review/fold-out-mid.png' });
await page.waitForTimeout(1500);

// wake and enter: catch the throat unfolding
await page.evaluate(() => { window.__game.beginFold('in', 'wick'); });
await page.waitForTimeout(600);
await page.screenshot({ path: 'design-review/fold-in-mid.png' });
await page.waitForTimeout(500);
await page.screenshot({ path: 'design-review/fold-in-late.png' });
await page.waitForTimeout(1200);
// should be inside the vault now, on the cut
const mode = await page.evaluate(() => window.__game.mode);
await page.screenshot({ path: 'design-review/fold-in-landed.png' });
console.log('fold shots · landed mode:', mode);
await browser.close();
