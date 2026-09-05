// Perf probe: scene composition + frame-time stats in a live deep scene.
// Headless swiftshader FPS is not real-GPU FPS, but scene counts (lights,
// draw calls, triangles) and JS-side frame cost are honest.
import { chromium } from 'playwright';

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));

await page.goto('http://localhost:4173');
await page.waitForTimeout(2500);
await page.evaluate(() => localStorage.clear());
await page.click('#t-new');
await page.waitForTimeout(3600);

const census = await page.evaluate(async () => {
  const g = window.__game;
  const count = () => {
    let lights = 0, meshes = 0, points = 0, visLights = 0;
    g.scene.traverse(o => {
      if (o.isLight) { lights++; if (o.visible && (o.intensity ?? 0) > 0) visLights++; }
      if (o.isMesh || o.isInstancedMesh) meshes++;
      if (o.isPoints) points++;
    });
    return { lights, visLights, meshes, points, children: g.scene.children.length };
  };
  const surface = count();

  // deep scene: park in the fauna band, stage a swarm + hunter, throw particles
  g.state.hull = 100000; g.state.fuel = g.state.maxFuel;
  for (let y = 300; y < 316; y++) for (let x = 10; x < 54; x++) g.terrain.carve(x, y);
  g.ctrl.px = 31.5; g.ctrl.py = -315 + 0.42; g.ctrl.vx = 0; g.ctrl.vy = 0;
  g.cam.snap(31.5, -310, 12.5);
  await new Promise(r => setTimeout(r, 1500));
  const deep = count();

  const info = g.renderer.info;
  const px = { ratio: g.renderer.getPixelRatio(), dpr: window.devicePixelRatio,
    size: [g.renderer.domElement.width, g.renderer.domElement.height] };

  // frame-time stats over ~6s
  const times = [];
  let last = performance.now();
  await new Promise(done => {
    const tick = () => {
      const now = performance.now();
      times.push(now - last); last = now;
      if (times.length < 360) requestAnimationFrame(tick); else done();
    };
    requestAnimationFrame(tick);
  });
  times.sort((a, b) => a - b);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  return {
    surface, deep, px,
    render: { calls: info.render.calls, tris: info.render.triangles },
    mem: { geoms: info.memory.geometries, tex: info.memory.textures },
    frame: { avg: +avg.toFixed(1), p50: +times[180].toFixed(1), p95: +times[342].toFixed(1), p99: +times[356].toFixed(1), worst: +times[359].toFixed(1) },
  };
});
console.log(JSON.stringify(census, null, 1));
await browser.close();
