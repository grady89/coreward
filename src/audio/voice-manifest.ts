// Which VO lines have a processed audio file, and where to fetch it.
//
// A play button only ever renders for an id in one of these sets — that's
// what keeps the transcript and codex honest as more acts get recorded.
// The files themselves live under public/audio/, which Vite serves and
// bundles verbatim (dev and packaged build alike); nothing here reads the
// filesystem at runtime.
//
// Regenerate the two sets after processing a new batch:
//   ls public/audio/dispatch    | sed 's/\.mp3$//' | sort
//   ls public/audio/lamplighters | sed 's/\.mp3$//' | sort

/** Dispatch: one id per line, "<eventId>-<lineNumber>" (DISPATCH.md's naming). */
export const DISPATCH_VOICED = new Set<string>([
  // ---- ACT I: the job ----
  'v3-start-1', 'v3-start-2', 'v3-start-3',
  'v3-first-sale-1', 'v3-first-sale-2',
  'v3-d60-1', 'v3-d60-2',
  'v3-fuel-warning-1', 'v3-fuel-warning-2',
  'v3-d130-1', 'v3-d130-2',
  'v3-contract-1-1', 'v3-contract-1-2',

  // ---- ACT II: someone was here ----
  'v3-first-wreck-1', 'v3-first-wreck-2', 'v3-first-wreck-3',
  'v3-d220-1', 'v3-d220-2',
  'veinlight-1-1', 'veinlight-1-2', 'veinlight-1-3',
  'v3-d340-1', 'v3-d340-2',
  'v3-wrecks-3-1', 'v3-wrecks-3-2', 'v3-wrecks-3-3',
  'v3-dusk-1', 'v3-dusk-2', 'v3-dusk-3',
  'v3-d520-1', 'v3-d520-2',
  'ruins-1-1', 'ruins-1-2', 'ruins-1-3',

  // ---- ACT III: off script ----
  'v3-d700-1', 'v3-d700-2',
  'v3-d900-1', 'v3-d900-2', 'v3-d900-3',
  'core-1-1', 'core-1-2', 'core-1-3',
  'core-1-after-1', 'core-1-after-2',

  // ---- reactive: deaths, tows, milestones ----
  'first-death-1', 'first-death-2',
  'first-stranded-1', 'first-stranded-2',
  'rich-1-1', 'rich-1-2',

  // ---- other worlds ----
  'cryos-arrive-1', 'cryos-arrive-2', 'cryos-arrive-3',
  'cryos-d200-1', 'cryos-d200-2',
  'cryos-accl-1', 'cryos-accl-2', 'cryos-accl-3',
  'maelis-arrive-1', 'maelis-arrive-2', 'maelis-arrive-3',
  'maelis-accl-1', 'maelis-accl-2', 'maelis-accl-3',

  // ---- ACT IV: the pattern ----
  'husk-arrive-1', 'husk-arrive-2', 'husk-arrive-3',
  'extraction-order-1', 'extraction-order-2', 'extraction-order-3', 'extraction-order-4',
  'first-extract-1', 'first-extract-2',
  'first-seat-1', 'first-seat-2', 'first-seat-3',
  'stillwalker-fragment-1', 'stillwalker-fragment-2',
  'fauna-dead-1', 'fauna-dead-2',
  'cores-2-1', 'cores-2-2', 'cores-2-3',
  'cores-3-1', 'cores-3-2', 'cores-3-3',
]);

/** The Lamplighters: one id per glyph, matching GlyphDef.id in world/glyphs.ts. */
export const LAMPLIGHTERS_VOICED = new Set<string>([]);

export function dispatchVoiceUrl(id: string): string {
  return `audio/dispatch/${id}.mp3`;
}

export function lamplightersVoiceUrl(id: string): string {
  return `audio/lamplighters/${id}.mp3`;
}
