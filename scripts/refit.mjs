// Review renders for the parametric refit: the T0..T5 tier ladder at garage
// scale and at gameplay distance (~58px hull — the acceptance test), plus the
// mixed build close up. Needs the dev server (the page imports /src):
//   npx vite --port 4181 --strictPort     then     node scripts/refit.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const PORT = process.env.REVIEW_PORT ?? '4181';
const URL = `http://localhost:${PORT}`;
const OUT = 'design-review';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1800, height: 740 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));

const shots = [
  ['ladder', 1800, 740, 'refit-ladder.png'],
  ['distance', 1280, 800, 'refit-distance.png'],
  ['mixed', 900, 800, 'refit-mixed.png'],
];
for (const [shot, width, height, file] of shots) {
  await page.setViewportSize({ width, height });
  await page.goto(`${URL}/pods-review.html?shot=${shot}`);
  await page.waitForFunction(() => document.title.startsWith('READY:'));
  await page.screenshot({ path: `${OUT}/${file}` });
  console.log('rendered', file);
}

await browser.close();
console.log('done →', OUT);
