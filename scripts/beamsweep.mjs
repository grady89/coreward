// What a watch-light actually threatens. Marches the same rays the game
// marches (BEAM_LEN, 0.35 steps, stop on first stone) over a full turn, and
// reports every checkpoint and entry standing inside the arc.
//
//   node scripts/beamsweep.mjs [glyph]
import fs from 'fs';
const SRC = fs.readFileSync('src/game/vault.ts', 'utf8');
const LEN = Number(SRC.match(/^export const BEAM_LEN = ([\d.]+)/m)[1]);
const only = process.argv[2];
const s = fs.readFileSync('src/world/vaults.ts', 'utf8');
const blocks = [...s.matchAll(/glyph: '(\w+)',([\s\S]*?)\n    map: \[([\s\S]*?)\n    \],/g)];
console.log(`beam reach ${LEN} tiles\n`);
for (const [, glyph, head, body] of blocks) {
  if (only && glyph !== only) continue;
  const bm = head.match(/beams: \[([\s\S]*?)\n    \]/);
  if (!bm) continue;
  const rows = [...body.matchAll(/'([^']*)'/g)].map(m => m[1]);
  const W = rows[0].length, H = rows.length;
  const solid = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) || '#=ARb'.includes(rows[y][x]);
  const beams = [...bm[1].matchAll(/\{ x: ([\d.]+), y: ([\d.]+)[^}]*\}/g)]
    .map(m => ({ x: +m[1], y: +m[2] }));
  const hit = new Set();
  for (const b of beams) {
    for (let a = 0; a < 720; a++) {
      const ang = (a / 720) * Math.PI * 2;
      let ex = b.x, ey = -b.y;
      for (let st = 0; st < Math.round(LEN / 0.35); st++) {
        const nx = ex + Math.cos(ang) * 0.35, ny = ey + Math.sin(ang) * 0.35;
        if (solid(Math.floor(nx), Math.floor(-ny))) break;
        ex = nx; ey = ny; hit.add(Math.floor(ex) + ',' + Math.floor(-ey));
      }
    }
  }
  let land = 0, swept = 0;
  for (let y = 1; y < H; y++) for (let x = 0; x < W; x++) {
    if (solid(x, y) && !solid(x, y - 1) && !solid(x, y - 2)) {
      land++; if (hit.has(x + ',' + (y - 1))) swept++;
    }
  }
  const marks = [];
  rows.forEach((r, y) => [...r].forEach((c, x) => {
    if ((c === 'S' || c === '@') && hit.has(x + ',' + y)) marks.push(c + '@' + x + ',' + y);
  }));
  console.log(`${glyph.padEnd(9)} beams ${beams.map(b => `(${b.x},${b.y})`).join(' ').padEnd(26)}`
    + ` swept ${String(swept + '/' + land).padEnd(8)} ${(Math.round(swept / land * 100) + '%').padStart(4)}`
    + (marks.length ? `   IN THE ARC: ${marks.join(' ')}` : ''));
}
