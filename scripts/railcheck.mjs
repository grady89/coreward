// Is a bolt rail in the way, and is its ground level?
//
// A level cable needs level ground under it. Where the floor steps, the rail
// was authored wrong -- it wants angling, moving, or cutting short -- and this
// names those rather than the engine bending the rail to hide them.
//
//   node scripts/railcheck.mjs
import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 900, height: 700 } });
await page.goto('http://localhost:4173');
await page.waitForTimeout(2500);
await page.evaluate(() => localStorage.clear());
await page.click('#t-new');
await page.waitForTimeout(3600);
const out = await page.evaluate(async () => {
  const g = window.__game, res = [];
  for (const def of window.__VAULTS) {
    g.devVault(def.glyph);
    await new Promise(r => setTimeout(r, 260));
    const v = g.vault, p = v.p;
    const solid = (x, y) => x < 0 || y < 0 || x >= p.w || y >= p.h || !!p.solid[y * p.w + x];
    // ground is solid OR lethal: a stud is a fang set into a floor, not a hole
    const ground = (x, y) => solid(x, y)
      || (x >= 0 && y >= 0 && x < p.w && y < p.h && !!p.kill[y * p.w + x]);
    (v.def.shuttles ?? []).forEach((s, i) => {
      if (s.snuff) return;
      const sp = v.shuttleSpan[i];
      if (sp.x0 === sp.x1) return;
      const lo = Math.min(sp.x0, sp.x1), hi = Math.max(sp.x0, sp.x1);
      const floors = new Set();
      let under = 0, cols = 0;
      for (let x = lo; x <= hi; x++) {
        let f = sp.y0; while (f < p.h - 1 && !ground(x, f + 1)) f++;
        if (f >= p.h - 1) { floors.add('none'); continue; }
        floors.add(f); cols++;
        const headTop = -(f + 1) + 1.04;
        if (headTop < -(sp.y0 + 0.5) - 0.18) under++;
      }
      res.push({ room: def.glyph, was: s.y0, now: sp.y0, cols, under,
        level: floors.size <= 1, steps: floors.size });
    });
  }
  return res;
});
let U = 0, C = 0;
for (const r of out) {
  U += r.under; C += r.cols;
  console.log(`${r.room.padEnd(9)} y ${String(r.was).padStart(2)} -> ${String(r.now).padStart(2)}`
    + `  cols ${String(r.cols).padStart(2)}`
    + (r.level ? '  level ground   ' : `  UNEVEN (${r.steps} floors)`)
    + (r.under ? `  walk-under ${r.under}` : '  obstacle'));
}
console.log(`\nwalk-under ${U}/${C} columns · ${out.filter(r => !r.level).length}/${out.length} rails over uneven ground`);
await b.close();
