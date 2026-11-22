// Build blind reviewer briefs for the visual pass.
//   node brief.mjs abs <shotDir> <outRoot>              one brief per category, absolute scoring
//   node brief.mjs paired <bestDir> <candDir> <outRoot> <round>   A/B per category, random order;
//                                                        writes <outRoot>/blind-key.json
// Shots are copied under <outRoot>/<cat>/[A|B]/ so file paths reveal nothing about
// which build is which. Each brief embeds ART-DIRECTION.md verbatim.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REF = 'C:/Users/grady/Claude Projects/Mining/reference-art/visual-pass';
const MIN = 'C:/Users/grady/Claude Projects/Mining/reference-art/minerals';
const CATS = JSON.parse(readFileSync(join(HERE, 'categories.json'), 'utf8'));
const ART = readFileSync(join(REF, 'ART-DIRECTION.md'), 'utf8');
const MINDIR = readFileSync(join(HERE, 'MINERALS-DIRECTION.md'), 'utf8');
const [mode, ...rest] = process.argv.slice(2);

const refsFor = (key) => {
  const r = CATS[key].refs.map(f => `${REF}/${f}`);
  if (key === 'minerals') {
    for (const m of ['copper', 'iron', 'silver', 'gold', 'ruby', 'voidopal', 'diamond', 'embershard', 'frostbloom', 'rime-salt', 'nacre', 'veinlight', 'mimic', 'lineup']) {
      r.push(`${MIN}/${m}/${readdirSync(join(MIN, m)).filter(f => f.endsWith('.png')).sort()[0]}  (concept sheet: ${m})`);
    }
  }
  return r;
};

const SCHEMA = `{ "category": "<key>", "score": <1-10, one decimal>, "per_shot": [{"shot": "<file name>", "score": <1-10>, "note": "<one line>"}], "top_issues": [{"issue": "...", "shots": ["..."], "why": "...", "suggested_direction": "..."}] (max 5), "protect": ["what is good and must not regress"] }`;

function header(key) {
  return `You are an art director reviewing screenshots of a video game for ONE category: **${CATS[key].name}** (key: \`${key}\`).
You have no other context about this game beyond what is below. Do not open, search or read any file other than the images listed in this brief. Do not look at source code.

Use the Read tool to look at every reference image and every screenshot listed. The screenshots are 1280×800 frames from the real game (software-rendered; ignore aliasing and frame-rate). Judge only your category; ignore issues that belong to other categories unless they directly hurt yours.

## The art direction (verbatim)

${ART}
${key === 'minerals' ? `\n## Minerals direction (verbatim)\n\n${MINDIR}\n` : ''}
## Reference images (the target; remember the framing/detail caveats above)

${refsFor(key).map(r => '- ' + r).join('\n')}
`;
}

const scoring = `Scoring scale: 1 = broken/ugly, 4 = functional but flat, 6 = decent but clearly short of the references, 7 = good, would ship, matches the brief's intent, 8 = strong, 9–10 = matches the references' mood and quality in a low-poly way. Be honest and calibrated; do not inflate. A score is for how well the frames meet the art direction for this category, not for effort.`;

if (mode === 'abs') {
  const [shotDir, outRoot] = rest;
  for (const key of Object.keys(CATS)) {
    const d = join(outRoot, key); mkdirSync(d, { recursive: true });
    const shots = CATS[key].shots.filter(s => existsSync(join(shotDir, s + '.png')));
    for (const s of shots) copyFileSync(join(shotDir, s + '.png'), join(d, s + '.png'));
    const brief = header(key) + `
## Screenshots to score

${shots.map(s => '- ' + join(d, s + '.png').replace(/\\/g, '/')).join('\n')}

${scoring}

Reply with ONLY one JSON object, no prose, no code fence:
${SCHEMA}
`;
    writeFileSync(join(d, 'BRIEF.md'), brief);
  }
} else if (mode === 'paired') {
  const [bestDir, candDir, outRoot, round] = rest;
  const key = {};
  let seed = Number(round) * 7919 + 17;
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
    const brief = header(cat) + `
## Two versions to compare: A and B

The same fixed shot list was captured from two builds of the game, labelled only A and B. Look at each shot in A next to the same shot in B.

${shots.map(s => `- ${s}: A = ${join(d, 'A', s + '.png').replace(/\\/g, '/')} | B = ${join(d, 'B', s + '.png').replace(/\\/g, '/')}`).join('\n')}

Score BOTH versions independently against the brief and references (not against each other's score), but use the side-by-side to be precise about which is better and by how much. If they look the same, give them the same score.

${scoring}

Reply with ONLY one JSON object, no prose, no code fence:
{ "A": ${SCHEMA}, "B": <same shape>, "preference": "A" | "B" | "same", "why": "<one or two lines>" }
`;
    writeFileSync(join(d, 'BRIEF.md'), brief);
  }
  writeFileSync(join(outRoot, 'blind-key.json'), JSON.stringify(key, null, 1));
}
console.log('briefs written to', rest[rest.length - (mode === 'paired' ? 2 : 1)]);
