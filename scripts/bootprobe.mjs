import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message, '\n', e.stack?.split('\n').slice(0, 4).join('\n')));
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE:', m.text()); });
await page.goto('http://localhost:4173');
await page.waitForTimeout(3000);
console.log('title present:', await page.$('#t-new') !== null);
await browser.close();
