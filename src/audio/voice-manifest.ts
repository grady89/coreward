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
]);

/** The Lamplighters: one id per glyph, matching GlyphDef.id in world/glyphs.ts. */
export const LAMPLIGHTERS_VOICED = new Set<string>([]);

export function dispatchVoiceUrl(id: string): string {
  return `audio/dispatch/${id}.mp3`;
}

export function lamplightersVoiceUrl(id: string): string {
  return `audio/lamplighters/${id}.mp3`;
}
