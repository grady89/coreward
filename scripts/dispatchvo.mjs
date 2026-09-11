// Every voiced Dispatch line must resolve to a real, non-empty audio file the
// browser will decode — a 404 or a stale manifest entry renders a play button
// that does nothing. Also walks one Act III transmission through comms to
// prove the pairing (line N -> clip N) survives the real playback path.
import { chromium } from 'playwright';
import { readFileSync } from 'fs';

// the ids come from the manifest source — the page is a production bundle and
// cannot import TypeScript, and hardcoding a list here would rot on the next batch
const block = readFileSync('src/audio/voice-manifest.ts', 'utf8').split('DISPATCH_VOICED')[1].split(']);')[0];
const IDS = [...block.matchAll(/'([^']+)'/g)].map(m => m[1]);

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

await page.goto('http://localhost:4173');
await page.waitForTimeout(2500);
await page.evaluate(() => localStorage.clear());
await page.click('#t-new');
await page.waitForTimeout(3400);
await page.waitForFunction(() => window.__game.mode === 'play', { timeout: 30000 });

// --- every manifest id fetches and decodes ---
const audit = await page.evaluate(async (ids) => {
  const bad = [];
  let decoded = 0;
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  for (const id of ids) {
    const url = `audio/dispatch/${id}.mp3`;
    try {
      const r = await fetch(url);
      if (!r.ok) { bad.push(`${id}: HTTP ${r.status}`); continue; }
      const buf = await r.arrayBuffer();
      if (buf.byteLength < 2000) { bad.push(`${id}: only ${buf.byteLength} bytes`); continue; }
      const a = await ctx.decodeAudioData(buf.slice(0));
      if (a.duration < 0.5) { bad.push(`${id}: ${a.duration.toFixed(2)}s`); continue; }
      decoded++;
    } catch (e) { bad.push(`${id}: ${e.message}`); }
  }
  return { total: ids.length, decoded, bad };
}, IDS);
console.log(`voiced clips: ${audit.decoded}/${audit.total} fetched + decoded`,
  audit.bad.length === 0 ? 'OK' : 'FAIL');
if (audit.bad.length) console.log('  bad:', audit.bad.slice(0, 12).join('; '));

// --- the pairing survives the real comms path (Act III core-1, 3 lines) ---
// VO runs through WebAudio (audio.playVoice), not <audio> elements — hook
// there, and let the comms queue hand the lines over in its own order
const paired = await page.evaluate(async () => {
  const g = window.__game;
  const played = [];
  const orig = g.audio.playVoice.bind(g.audio);
  g.audio.playVoice = (urls) => {
    played.push(urls.map(u => u.split('/').pop()).join(','));
    return Promise.resolve(); // resolve at once so the queue advances quickly
  };
  // the opening transmission is still queued from the intro — drain it, or
  // its last line lands in front of ours and the order check reads a lie
  g.comms.clear?.();
  await new Promise(r => setTimeout(r, 400));
  played.length = 0;
  g.sayVoiced('core-1', [
    'Dusklight? Your telemetry went to white and came back.',
    'I filed your report an hour ago.',
    'It came back stamped. Approved, countersigned, closed. Before I sent it.',
  ]);
  for (let i = 0; i < 250 && played.length < 3; i++) await new Promise(r => setTimeout(r, 100));
  g.audio.playVoice = orig;
  return { played };
});
const expected = ['core-1-1.mp3', 'core-1-2.mp3', 'core-1-3.mp3'];
const pairedOk = expected.every((e, i) => paired.played[i] === e);
console.log('core-1 lines pair to their own clips:', JSON.stringify(paired.played),
  pairedOk ? 'OK' : 'FAIL');

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
