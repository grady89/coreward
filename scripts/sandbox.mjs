// The dev fauna sandbox (?fauna): every stage must carve its habitat, load
// the right world, and get its creature alive. This is the regression test
// for staging itself — if a creature can no longer be summoned to look at,
// the feel pass is blind, and that failure is otherwise silent.
import { chromium } from 'playwright';

const OUT = process.argv[2] ?? '.';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

await page.goto('http://localhost:4173/?fauna');
await page.waitForTimeout(4000);

const ids = await page.evaluate(() => window.__STAGES.map(s => s.id));
console.log('stages:', ids.length, ids.join(' '));

let pass = 0;
for (const id of ids) {
  const r = await page.evaluate(async id => {
    const g = window.__game;
    g.devStage(id);
    const s = window.__STAGES.find(s => s.id === id);
    // priming runs for 4s of game time; poll a little longer than that
    let alive = false;
    for (let i = 0; i < 90 && !alive; i++) {
      await new Promise(r => setTimeout(r, 100));
      alive = s.alive(g.threats);
    }
    return {
      alive,
      world: g.state.activeWorld,
      want: s.world,
      card: !!document.querySelector('#dev-sandbox .ds-name'),
      hull: Math.round(g.state.hull),
    };
  }, id);
  const good = r.alive && r.world === r.want && r.card;
  if (good) pass++;
  console.log(`  ${id}:`, JSON.stringify(r), good ? 'OK' : 'FAIL');
  await page.screenshot({ path: `${OUT}/sb-${id}.png` });
}

// the sandbox must never write its butchered terrain over a real save —
// and its handouts must never reach the cross-expedition meta store either
const saveGuard = await page.evaluate(() => {
  const g = window.__game;
  const before = localStorage.getItem('coreward_save_v2');
  const metaBefore = localStorage.getItem('coreward_meta_v1');
  g.saveNow();
  g.meta.keeplight += 9999;
  window.__meta.saveMeta(g.meta);
  return {
    unchanged: localStorage.getItem('coreward_save_v2') === before
      && localStorage.getItem('coreward_meta_v1') === metaBefore,
  };
});
console.log('save guard:', JSON.stringify(saveGuard), saveGuard.unchanged ? 'OK' : 'FAIL');

console.log(`\n${pass}/${ids.length} stages live`);
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
