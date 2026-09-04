// Plot a real trajectory on the tile grid. The diagram in docs/ is generated
// from the simulator, never drawn by hand — a hand-drawn arc is a claim.
import { World, spawn, step } from './movement.mjs';

const H = { left: false, right: false, up: false, down: false };

export function trace({ runUp = 30, hold = 999, dash = null, frames = 200 }) {
  const W = 60, rows = [];
  for (let y = 0; y < 30; y++) rows.push(y === 20 ? '#'.repeat(W) : '.'.repeat(W));
  const w = new World(rows);
  const s = spawn(w, 3, 19);
  for (let i = 0; i < 30; i++) step(s, { ...H });
  for (let i = 0; i < runUp; i++) step(s, { ...H, right: true });
  const pts = [[s.px, s.py]];
  step(s, { ...H, right: runUp > 0, press: true });
  for (let f = 0; f < frames; f++) {
    const inp = { ...H, right: true, jump: f < hold };
    if (f === hold) inp.release = true;
    if (dash && f === dash.at) { inp.dash = true; inp.dashDX = dash.dx; inp.dashDY = dash.dy; }
    step(s, inp);
    pts.push([s.px, s.py]);
    if (s.grounded && f > 4) break;
  }
  return pts;
}

/** render points onto a tile grid, one cell per tile, origin at the launch */
export function plot(pts, mark = '*') {
  const x0 = pts[0][0], y0 = pts[0][1];
  const rel = pts.map(([x, y]) => [x - x0, y - y0]);
  const maxX = Math.ceil(Math.max(...rel.map(p => p[0])));
  const maxY = Math.ceil(Math.max(...rel.map(p => p[1])));
  const cols = maxX + 3, lines = maxY + 3;
  const g = Array.from({ length: lines }, () => Array(cols).fill(' '));
  for (const [x, y] of rel) {
    const cx = Math.round(x), cy = Math.round(maxY + 1 - y);
    if (cy >= 0 && cy < lines && cx >= 0 && cx < cols) g[cy][cx] = mark;
  }
  const floor = maxY + 1;
  for (let x = 0; x < cols; x++) if (g[floor + 1]) g[floor + 1][x] = '#';
  if (g[floor]) g[floor][0] = '@';
  return g.map((r, i) => `  ${String(maxY + 1 - i).padStart(2)} |${r.join('')}`).join('\n')
    + `\n      ${'-'.repeat(cols)}\n      ` + [...Array(cols).keys()].map(i => i % 5 === 0 ? String((i / 5) % 10) : ' ').join('')
    + '   (each cell = 1 tile; row labels = tiles above launch)';
}
