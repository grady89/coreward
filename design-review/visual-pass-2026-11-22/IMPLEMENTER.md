# Brief shared by every implementer in the 2026-11-22 visual pass

You are improving Coreward's visuals (Vite + TypeScript + Three.js 0.170, all procedural).
Work ONLY in the worktree `C:\Users\grady\Claude Projects\Mining\.claude\worktrees\visuals` (branch `visuals`).
Never touch the main checkout, never merge, never push, never stop servers on ports other than ones you start.

## Read first
- `C:\Users\grady\Claude Projects\Mining\reference-art\visual-pass\ART-DIRECTION.md` (the rubric) and the reference images it names in that folder.
- For ore work also `design-review/visual-pass-2026-11-22/MINERALS-DIRECTION.md` and `C:\Users\grady\Claude Projects\Mining\reference-art\minerals\<ore>\`.
- Prior findings: `C:\Users\grady\Claude Projects\Mining\design-review\review-2026-11-20\visuals-findings.md` (read the parts relevant to your fix; note the fissure-burial bug #1 is already fixed).
- Reviewer notes for this pass: `design-review/visual-pass-2026-11-22/r0/reviews.json` (and later rounds' reviews), category key named in your task.
- `design-review/visual-pass-2026-11-22/REJECTED.md` if it exists: never retry an approach listed there.

## Hard limits
- Visual and audio-visual changes only. Never change physics, collision or hazard timing; tile layouts or room data in `src/world/vaults.ts`; the economy, ore values or spawn rates; the save format.
- Do not touch SITE 297 (the husk world, `site297` / `huskify`) at all.
- Keep the low-poly procedural style: no image textures, no realism, no imported models, no Blender. Geometry stays procedural in code. (Canvas/DataTexture generated in code is fine.)
- Darkness stays a mechanic: never flatten the dark with ambient light. Black is for true void; the lamp must still matter.
- Every ore stays distinguishable from every other ore and from the rock. The mimic must keep its tell (or an equally fair one).
- Keep `prefers-reduced-motion` and existing settings working. Costly effects (bloom, postprocess) get a quality toggle in the existing settings panel.
- Keep draw calls and triangles within ~15% of baseline unless the gain is large; report the cost.
- Vault readability is sacred: footing, hazards, gates, gravity tints and chevrons must stay instantly legible.

## How to check your work
- `npx tsc --noEmit -p .` and `npm run build` must pass.
- A preview server is already running on port 4190 serving `dist/` (rebuild and it serves the new build). Do not start another on 4190.
- Shots: `node scripts/visualshots.mjs <your scratch dir> --port=4190 --only=<substring>` (e.g. `--only=ore-`, `--only=veil3-`, `--only=vault-debt`). Look at them with the Read tool and compare to `design-review/visual-pass-2026-11-22/<best round>/<same shot>.png`. Each run of the whole list takes ~18 min, so use `--only`.
- Perf: `<dir>/stats.json` has draw calls and triangles per shot; compare with the baseline in `design-review/visual-pass-2026-11-22/r0/stats.json`.
- Do NOT run the vault route suites; the coordinator runs the full gate.

## Finish
- Commit your fix as ONE commit on `visuals` containing only your source changes (not shots): `git add <files>; git commit -m "<what>\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`.
- Reply with: commit sha, files changed, what you did and why, perf delta (calls/tris on the shots you checked), anything you were unsure of.
