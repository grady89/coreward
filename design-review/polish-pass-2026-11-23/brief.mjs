// Blind reviewer briefs for the polish pass (creatures + Quarters).
//   node brief.mjs abs <shotDir> <outRoot>                         absolute scoring, one brief per category
//   node brief.mjs paired <bestDir> <candDir> <outRoot> <round>    A/B per category in random order;
//                                                                  writes <outRoot>/blind-key.json
// Shots are copied under <outRoot>/<cat>/[A|B]/ so paths reveal nothing about
// which build is which. Each reviewer writes <outRoot>/<cat>/review.json.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REF = 'C:/Users/grady/Claude Projects/Mining/reference-art/visual-pass';
const HOUSE = join(HERE, '..', 'visual-pass-2026-11-22', 'final').replace(/\\/g, '/');
const CATS = JSON.parse(readFileSync(join(HERE, 'categories.json'), 'utf8'));
const ART = readFileSync(join(REF, 'ART-DIRECTION.md'), 'utf8');
const POLISH = readFileSync(join(HERE, 'POLISH-DIRECTION.md'), 'utf8');
const [mode, ...rest] = process.argv.slice(2);
const fwd = p => p.replace(/\\/g, '/');

const refsFor = key => CATS[key].refs.map(f => f.startsWith('HOUSE:')
  ? `${HOUSE}/${f.slice(6)}  (house style: an already-polished creature from this game)`
  : `${REF}/${f}`);

const SCHEMA = `{ "category": "<key>", "score": <1-10, one decimal>, "per_shot": [{"shot": "<file name>", "score": <1-10>, "note": "<one line>"}], "top_issues": [{"issue": "...", "shots": ["..."], "why": "...", "suggested_direction": "..."}] (max 5), "protect": ["what is good and must not regress"] }`;

function header(key) {
  return `You are an art director reviewing screenshots of a video game for ONE category: **${CATS[key].name}** (key: \`${key}\`).
You have no other context about this game beyond what is below. Do not open, search or read any file other than the images listed in this brief, and do not look at source code.

Use the Read tool to look at every reference image and every screenshot listed. The screenshots are 1280×800 frames from the real game. Judge only your category.

## The game's art direction (verbatim)

${ART}

${POLISH}

## Reference images (the target; remember the framing/detail caveats above)

${refsFor(key).map(r => '- ' + r).join('\n')}
`;
}

const scoring = `Scoring scale: 1 = broken/ugly, 4 = functional but flat, 6 = decent but clearly short of the direction, 7 = good, would ship, matches the brief's intent, 8 = strong, 9–10 = matches the references' mood and quality in a low-poly way. Be honest and calibrated; do not inflate. Score how well the frames meet the direction for this category, not effort.`;

if (mode === 'abs') {
  const [shotDir, outRoot] = rest;
  for (const key of Object.keys(CATS)) {
    const d = join(outRoot, key); mkdirSync(d, { recursive: true });
    const shots = CATS[key].shots.filter(s => existsSync(join(shotDir, s + '.png')));
    for (const s of shots) copyFileSync(join(shotDir, s + '.png'), join(d, s + '.png'));
    writeFileSync(join(d, 'BRIEF.md'), header(key) + `
## Screenshots to score

${shots.map(s => '- ' + fwd(join(d, s + '.png'))).join('\n')}

${scoring}

Write your result as ONE JSON object (no prose, no code fence) to ${fwd(join(d, 'review.json'))} with the Write tool, in this shape:
${SCHEMA}
Then reply with just your overall score.
`);
  }
} else if (mode === 'paired') {
  const [bestDir, candDir, outRoot, round] = rest;
  const key = {};
  let seed = Number(round) * 7919 + 101;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (const cat of Object.keys(CATS)) {
    const candIsA = rnd() < 0.5;
    key[cat] = candIsA ? { A: 'candidate', B: 'best' } : { A: 'best', B: 'candidate' };
    const d = join(outRoot, cat);
    const src = { A: candIsA ? candDir : bestDir, B: candIsA ? bestDir : candDir };
    const shots = CATS[cat].shots.filter(s => existsSync(join(bestDir, s + '.png')) && existsSync(join(candDir, s + '.png')));
    for (const L of ['A', 'B']) {
      mkdirSync(join(d, L), { recursive: true });
      for (const s of shots) copyFileSync(join(src[L], s + '.png'), join(d, L, s + '.png'));
    }
    writeFileSync(join(d, 'BRIEF.md'), header(cat) + `
## Two versions to compare: A and B

The same fixed shot list was captured from two builds, labelled only A and B. Look at each shot in A next to the same shot in B.

${shots.map(s => `- ${s}: A = ${fwd(join(d, 'A', s + '.png'))} | B = ${fwd(join(d, 'B', s + '.png'))}`).join('\n')}

Score BOTH versions independently against the direction and references, using the side-by-side to be precise about which is better and by how much. If they look the same, give them the same score.

${scoring}

Write your result as ONE JSON object (no prose, no code fence) to ${fwd(join(d, 'review.json'))} with the Write tool, in this shape:
{ "A": ${SCHEMA}, "B": <same shape>, "preference": "A" | "B" | "same", "why": "<one or two lines>" }
Then reply with just "A <score> B <score>".
`);
  }
  writeFileSync(join(outRoot, 'blind-key.json'), JSON.stringify(key, null, 1));
}
console.log('briefs written');
