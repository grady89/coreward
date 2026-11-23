# Implementer brief: the Coreward polish pass (creatures + Quarters)

You are implementing ONE visual fix for Coreward, a Vite + TypeScript + Three.js game. Everything in it is procedural (no image assets).

## Where to work
- Work ONLY in the worktree `C:\Users\grady\Claude Projects\Mining\.claude\worktrees\polish` (branch `polish`).
- Never touch the main checkout. Never merge, push, stash or switch branches.
- Another implementer may be editing OTHER files in this same worktree at the same time.
  - Touch only the files your task names, unless a tiny shared helper is unavoidable; if so, say so in your reply.
  - Never run `git add -A`, `git add .`, `git checkout -- .`, `git reset` or `git stash`.

## Read first
- `C:\Users\grady\Claude Projects\Mining\reference-art\visual-pass\ART-DIRECTION.md` (the game's look) and the reference images your task names.
- `design-review/polish-pass-2026-11-23/POLISH-DIRECTION.md` (the rubric for this pass).
- The reviewer notes your task names (`rN/review/<category>/review.json`, or for paired rounds `rN/review/<category>/review.json` plus `rN/review/blind-key.json` to know which of A/B was the current best).
- `design-review/polish-pass-2026-11-23/REJECTED.md` if it exists: never retry an approach listed there.

## Hard limits
- **Visual only.** Never change:
  - creature behaviour, hitboxes, speeds, damage or timing;
  - collision, walk bounds, jump or camera behaviour in the Quarters;
  - station positions, interaction radii, prompts or panels;
  - catalog names, costs or the furnishing slot positions (`src/game/furnish.ts`);
  - the economy, the save format (`src/game/state.ts`, `src/game/meta.ts`), or vault room data (`src/world/vaults.ts`).
- Don't touch SITE 297 (`site297` / `huskify`).
- **Style:** keep the low-poly procedural style. No image files, no realism, no imported models, no Blender. Canvas or DataTexture textures generated in code are fine.
- **Darkness:** in the mines, darkness stays a mechanic, so never flatten it with ambient light. The Quarters is the warm sanctuary, but keep contrast.
- **The suit** stays the most legible thing in every Quarters frame.
- **Settings:** keep `prefers-reduced-motion` and the existing settings working.
- **Performance:** keep draw calls and triangles reasonable (the Quarters is small, so be sensible). Prefer a few lights with good falloff over many. Report the cost.

## How to check your work
- `npx tsc --noEmit -p .` must pass.
- A Vite DEV server is running on port 4194 and serves the source live (no build needed). Do not start or stop servers.
- Take shots with `node scripts/polishshots.mjs <your scratch dir> --port=4194 --only=<substring>`, for example:
  - `--only=quarters-` for every Quarters shot (about 40 s);
  - `--only=creature-longone`.
- Look at them with the Read tool. Compare them with the current best shots named in your task.
- `<dir>/stats.json` has draw calls and triangles per shot.
- Do NOT run the long test suites; the coordinator runs the gate.

## Finish
- Commit ONLY your files, as ONE commit:
  `git commit -m "<what>" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- <file1> <file2> ...`
  The pathspec after `--` is required, so another implementer's edits never ride along in your commit.
- If git reports an index.lock, wait a few seconds and retry.
- Reply briefly with:
  - the commit sha and files changed;
  - what you did and why;
  - the perf delta on the shots you checked;
  - anything you were unsure of.
