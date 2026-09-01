# COREWARD — v0.2 Experience & Performance Audit

Date: 2026-08-31 · Build: `npm run build` (tsc strict, clean) · Verified headless
(Playwright + SwiftShader) with five scripted suites in `scripts/`.

## v0.2 additions (all verified by `scripts/progression.mjs`)

- **Three dig sites** on the shared engine (VEIL-3 → CRYOS-2 → MAELIS-6): per-world
  palette/sky/fog/strata/lore/core, ice traction, corrosive fluids, pressure bursts,
  ore value ×1/×1.5/×2.25. One pod travels; terrain is per-world (save v2, migrates v1).
- **Endings walked on foot** — pod parks at the chamber; each core is an EVA walk.
- **Ember Forge** (post-ending garage section): dash / up-drill / warp-sell /
  heat-to-fuel converter, paid in embershards from cargo.
- **Wreck salvage EVA**: 14 seeded wrecks per world, 45s oxygen, cash/shard/found-log
  rewards, blackout mercy on oxygen-out.
- **Starmap** at the assay office: unlock chain, travel, redacted locked sites.

## Verified working (evidence: script output + screenshots)

- **Boot → title → intro dive → gameplay** hand-off, no page errors in any run.
- **Core loop**: drill (down + sideways), collect ore, fuel drain, fly, dock,
  sell (exact math verified: 2×copper + iron = $130), refuel, upgrades, repair.
- **Persistence**: save → reload → CONTINUE restores money, position, terrain diffs.
- **Failure paths**: fall damage (sub-stepped collision so impact speed is exact at
  any framerate), gas pocket burst, death panel with salvage fee + cargo loss,
  respawn at 50/50, out-of-fuel rescue offer with mercy pricing.
- **Full descent**: all five strata palettes render distinctly (ochre → rust →
  slate blue → void black → ember glow), the Ember chamber and ending panel fire.
- **UI**: HUD bars/depth/money/cargo, prompts, toasts, popups, all seven panels.

## Known limits / flagged for later (not blockers for a playable v0.1)

| Area | Note |
|---|---|
| FPS | 15–22 under SwiftShader software rendering; real-GPU verification pending a manual playtest. Budget honored: ≤ ~40 draw calls visible, pooled particles, zero hot-loop allocation. |
| Audio | Procedural WebAudio engine is wired everywhere but unverifiable headless — needs an ear pass; levels are conservative. |
| Mobile | Desktop/keyboard only by design (Steam target). Page is responsive; no touch rig yet. |
| Accessibility | Reduced-motion kills shake/hitstop/parallax; real buttons everywhere; contrast ≥ 4.5:1 on UI ink. No screen-reader pass on panels yet (game canvas is inherently visual). |
| Bundle | 541 KB JS (three.js dominant), 142 KB gz. Fine for a game; could code-split the title if a web demo needs faster first paint. |
| Balance | Numbers are first-pass sane (verified affordable curve to ~$170 in minutes of play) but need real playtesting for the mid-game upgrade pacing. |
| Cargo full | Drilled ore is lost with a warning toast — intentional pressure, revisit after playtests. |

## Launch checklist (web demo → Steam)

- [ ] Manual playtest on real GPU: fps, audio mix, feel of drill/thrust curves
- [ ] Balance pass on tiers 3–5 prices vs ore density at 400–900m
- [ ] Bundle Chakra Petch/Space Grotesk locally (Google Fonts CDN won't fly offline in Electron)
- [ ] Electron wrapper (same recipe as prior project: storage seam, `base:'./'` already set, electron-builder, CI)
- [ ] Steam: appid, achievements hooks on milestones (`state.milestones` is the seam), cloud save (swap the localStorage block in `game/state.ts`)
- [ ] Capsule art + trailer captures (add a `?cinema` HUD-less mode)
- [ ] Analytics (web demo only): none wired — decide if wanted
- [ ] Real Steam wishlist URL in the title screen ghost link
- [ ] Gamepad support (Deck) — input already funnels through one `Input` struct
