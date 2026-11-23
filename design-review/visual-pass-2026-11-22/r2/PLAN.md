# Round 2 plan

Best = ce022f3 (r1/shots). Scores: characters 5.0, rock 6.0, fluids 6.2, ui 6.2, vaults 6.3, lighting 6.4, identity 7.0, minerals 7.2.
Round cap is 7 (user, relayed mid-run).

Sequential fixes, each its own commit:

1. **G1 characters — creatures glow and read; pod visor glows** (targets: characters). Each creature gets an emissive part in its world's hue plus a rim/fresnel term so it separates from dark rock; glimmerflies become soft glowing motes (not square confetti); pod visor and pilot visor get a real emissive teal; pod hull flat-shaded/faceted panels if cheap. Files: src/world/fauna/*, src/fx/particles.ts (soft sprite), src/player/pod.ts, src/player/suit.ts.
2. **G2 lighting — a visible headlamp beam, and the core floods its chamber** (targets: lighting; also fluids). Additive soft cone along the lamp direction with a few drifting dust motes, faces inside the cone brighter; the core fragment washes its chamber floor/pillars/back wall in the core hue (baked rock wash or one strong light already budgeted), framing unchanged. Files: src/player/pod.ts (lamp), src/world/backdrop.ts (ember/core), src/world/chunks.ts (wash).
3. **G3 rock — faceted stone instead of smeary streaks; MAELIS nacre sheen** (targets: rock). Replace F3's horizontal streak noise with per-block value variation and a cheap edge bevel/lip so cubes read as chunky stone; a faint view-angle pearl sheen on lit MAELIS faces; keep hue per world and the dark. Files: src/world/chunks.ts rock shader.
4. **G4 ui — title composition and panels that belong to the world** (targets: ui). Title wordmark over clear sky or a dark scrim band, lit pod as the focal light, tagline legible; panels get a warm/world-hued edge light and squarer faceted corners; HUD sub-labels a step larger/brighter. Files: src/style.css, src/ui/*, title camera pose (src/fx/camera.ts titlePose) — visual only.
5. **G5 lighting — bloom, second approach** (targets: lighting). Same composer idea but: default ON only on hardware GL; software renderers (SwiftShader/llvmpipe, via WEBGL_debug_renderer_info) default OFF; no new shader programs at play time (HDR gain without onBeforeCompile cache-key changes, or prewarmed). The shot script opts in explicitly (settings bloom:true). Must pass the gate's vaults.mjs on default settings.

## Process change (during round 2, relayed from another session with the user's words: "yes use gpu... also I dont think you need to playtest every vault after every pass")
- Shots now run on the hardware GPU (D3D11 ANGLE). Best (ce022f3) is re-shot on the GPU alongside the candidate; renderers are never mixed in a pair.
- Per-round gate: tsc + build; scope guard (diff vs last best must not touch src/world/vaults.ts, src/game/state.ts, src/game/contracts.ts, scripts/routes/); page errors in the shot run fail the gate; vault play-throughs (7 routes + vaults.mjs + vaultfit) only if src/game/vault* changed; gemcheck only if ore/gem code changed. Full gate.sh once at the end, bisect and revert any culprit before REPORT.md.
