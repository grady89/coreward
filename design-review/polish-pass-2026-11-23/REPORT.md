# Coreward polish pass — 2026-11-23

Branch `polish` (worktree `.claude/worktrees/polish`, branched from `vaults` at acfb345). Nothing is merged or pushed.

What you asked for:
- a visual pass on the eight creatures the overnight pass never reviewed;
- a visual pass on the Quarters interior and every bought upgrade;
- the hanging-sign brackets that connect to nothing;
- the outlines that show where the vault blocks fly in.

## Result

**The goal was not met.** The goal was every category at ≥ 7.0 after at most 5 rounds. Final absolute scores came from five fresh reviewers who had seen no earlier round:

| category | r0 | final | change |
|---|---|---|---|
| Wings (Gallery + Vivarium) | 4.2 | **7.0** | +2.8 |
| Furnishings + palettes | 3.9 | 6.8 | +2.9 |
| Quarters room | 4.0 | 6.6 | +2.6 |
| Creatures I (Long One, Mimic, Kindled, Rimewings) | 3.4 | 6.4 | +3.0 |
| Creatures II (Brinewyrm, Frostbloom, Polyps, Riptide) | 4.2 | 6.2 | +2.0 |

The round-by-round paired scores went past 7.0 for every Quarters category and for Creatures II in at least one round. Absolute scores from a new reviewer drift by about ±0.5, which is why each round used side-by-side A/B scoring.

### Paired rounds (best → candidate, same reviewer)

| category | r1 | r2 | r3 | r4 | r5 |
|---|---|---|---|---|---|
| creatures-a | 3.2→6.8 ✓ | 5.6→6.6 ✓ | 6.0→6.9 ✓ | 6.5→6.3 ✗ | 6.6→6.8 ✓ |
| creatures-b | 4.0→6.3 ✓ | 5.8→6.2 ✓ | 5.0→6.4 ✓ | 6.5→6.2 ✗ | 6.4→7.0 ✓ |
| quarters-room | 3.5→7.0 ✓ | 6.4→6.8 ✓ | 6.6→7.2 ✓ | 7.0→7.2 ✓ | 6.4→6.6 ✓ |
| furnishings | 3.5→7.5 ✓ | 6.5→7.0 ✓ | 6.4→7.0 ✓ | 7.2→6.9 ✓ | 6.8→7.2 ✓ |
| wings | 3.8→7.3 ✓ | 6.3→7.2 ✓ | 6.9→6.6 ✓ | 6.8→7.2 ✓ | 7.0→7.1 ✓ |

- ✓ means kept; ✗ means reverted.
- The round-4 creature fixes were reverted. The parts that won (rimewings, polyps, riptide) were re-landed alone in round 5.
- r5 creatures-a was +0.2, below the 0.3 bar. I kept it because its one change, the rimewings' cyan floor wash, was preferred in both r4 and r5.

Per-round detail is in `rN/review/*/review.json`, `rN/review/blind-key.json` and `rN/unblinded.json`.

## The two fixes you pointed at (ce4e952)

- **Sign brackets:** the knee brace on every gantry sign now runs from the leg into the underside of the crossbar (`gantrySign` in `src/world/structures.ts`). Before, it floated beside the corner.
- **Vault entry outlines:** there were two causes, and both are fixed in `src/game/vault.ts`.
  1. The glowing crack trim on the platform edges was drawn before the blocks landed. It now fades in once the courses have landed and fades out as the room lets go.
  2. The back wall was only built behind open tiles, so black holes showed where stone was about to land. It is now built behind the stone too.
  - Before/after at 0.9 s into THE EMBER's arrival: the floating cracks and the black rectangles are gone.

## What changed and was kept

Before/after pairs (r0 on the left, final on the right) are in `pairs/`.

### The Quarters (`src/game/interior.ts`)

- **db2f6b3, 1ce9223, 4c3abdd, a096c65, 740794d — the room:**
  - A real ceiling with ribs, insulated panels, conduit and fixtures, replacing the black void.
  - Panelled walls with a wainscot, chair rail, vents and service pipes; bays that vary from one to the next.
  - Plated floor with a runner and thresholds.
  - Fixture light pools that land on the wall and floor.
  - Soft dusk light from the portholes falling across the floor.
  - A trimmed foreground sill.
  - Conduit drops and a floor hatch in the stock room.
- **81c6450 and later — furnishings:**
  - A patterned rug with fringe.
  - A bunk with frame, bedding and a reading sconce.
  - A galley with copper kettle (and a thread of steam), cups, tiles and a warm strip light.
  - A radio with a glowing dial, needle and antenna.
  - An arc lamp with a soft cone and pools.
  - A lit book shelf and a glowing star chart with a picture light.
  - Props have chamfered edges, two-tone surfaces and trim.
- **Palette moods:** each palette now also drives trim metal, light colour, deck tone, runner/inlay and the locker colours. Each has a signature: fluted steel (SLATEBED), a brass rail (DUST ROSE), boards and walnut (VERDANT). SLATEBED keeps warm lamps in its lit bays.
- **60e82ff, a096c65 — wings:**
  - **Gallery:** plum-slate walls, track downlights, glass vitrines, and cut stones that hold their own colour with a lit core. Each stone's colour lands on the floor.
  - **Vivarium:**
    - teal-black walls, lit by its tanks;
    - glowing water columns;
    - one readable glowing shape per sponsored creature, in 8 kinds, each rimmed in its tank's hue.
  - Bronze-cased doorways with name plates.

### Creatures (`src/world/fauna/*`)

- **Long One** (53ed493, 877fa58, c0e96f0): seven chunky plates over dark sinew, an amber spine line cooling toward the tail, a white-hot mouth, and fang tips.
- **Kindled** (c0e96f0): a forward-leaning, reaching pose with an ember shell round a flickering white-gold heart.
- **Mimic:** stout crystal legs, big fanged mandibles, a lit crack-maw facing the camera, and a seated pulsing gem.
- **Rimewings** (515301b): faceted moths with ice-cyan edges and eyes. Their cyan light lands on the ice around the flock.
- **Brinewyrm** (c51f0a3, a7e8fd0, f0d3dc5, 7014ea0): an opaque pearl body with cyan-violet sheen and flank photophores, a jawed head with a violet-lit mouth, and a bright slit eye.
- **Pressure Polyps:** faceted nacre domes with tendril crowns that clench as they swell. Their light catches the tiles they grow from.
- **Riptide:** the black ribbon is replaced by a sea-green haze in its arms, a faceted eye at its centre, current streaks instead of starfield dots, and eye light down the swirl.
- **Frostbloom** (a7e8fd0, 7014ea0): a faceted ice star with a cyan halo and a soft cold light on the blocks beside it. Only frostbloom-specific paths in `chunks.ts`/`gemshapes.ts` were touched, and every other ore was checked unchanged.

## What was rejected (full entries in REJECTED.md)

- **r4 Kindled back to white-gold:** it merged with the bright core chamber and lost its threat read. The r3 dark-shell Kindled stays.
- **r4 frostbloom rebuilt in veinlight's style:** it became a thin sprig, invisible at play size.
- **r4 deeper CRYOS brine:** this changed every CRYOS pool in the main game and went out with that revert. The main game's fluids are unchanged by this pass.

## Process notes

- **Shot framing:** the first creature shots were partly my fault. Some creatures were missed or cropped, so r0 creatures were re-shot and re-scored. The shot script then gained:
  - framing on the nearest body cluster;
  - muted hit flashes, with the hull kept full;
  - creatures held still once framed;
  - a frostbloom shot that moves the pod aside;
  - a random re-seed at the sandbox stage, so creature placement matches across builds.

  The "best" side of each pair was always re-shot with the same script.
- **Shots:** all ran on the GPU, about 2 minutes per full set.

## Gate

On the final build:
- **Pass:** tsc and build; all 7 vault routes; vaultfit; gemcheck; fauna 22/22; quarters 13/13; wingorder 5/5; placards 6/6 (twice).
- **`vaults.mjs`:** 46/47 and 45/47 on the final two runs. The sconce chord passes in both (see "Test changes" below).
  - The remaining failures change from run to run and are timing flakes under SwiftShader: `dead surface` (which also failed on the pre-pass build b1fcc89 in 1 of 3 runs), `entry on foot`, `one-way gate` and `movement metrics`.
  - No physics, collision or room data changed in this pass.
- **`bugsweep`:** B3 (the swarm bites the parked pod) flakes on glimmerfly spawn timing; 10/10 on the other run.
- **`threats.mjs`:** 2 checks fail exactly as they did before any change. 2 more fail on some runs when no glimmerfly swarm spawns. Glimmerflies weren't touched.

### Test changes (all in `scripts/`)

- **`quarters.mjs`:**
  - The repaint check now tests that the wall went cool, not one exact hex, because the palette moods push the hue.
  - The boot waits on the game mode, not fixed sleeps (the intro outran them under SwiftShader).
- **`placards.mjs`:** the same boot fix.
- **`vaults.mjs` (sconce chord):** it now waits for the room to finish assembling before it measures the crack flare, because the cracks deliberately stay hidden until the stone lands.

## Performance (renderer.info over the same shots, r0 → final)

- **Creatures:** draw calls +4%, triangles +1%.
- **Quarters:** draw calls +11%. Triangles 92k → 414k across 15 shots, from a very low base. The heaviest Quarters frame (the gallery) is 112 calls and 38k triangles, about what a mine frame draws.
- **Lights:** the hall gained two short-reach point lights (bunk, galley). Everything else is additive quads, and the wings' light count is unchanged.

## Open issues reviewers raised that weren't done

- **Quarters:**
  - The foreground floor is still a big, dim plane.
  - The room sits in one sepia value family.
  - Small furnishings sit far back at play scale.
- **Wings:**
  - Floor reflections are strong and streaky.
  - The vivarium creatures are faint.
  - The plinths' lower halves go to black.
  - The leftmost tank is cut off at the frame edge (see decisions).
- **Creatures:**
  - The Kindled still read only weakly as "made of light".
  - The Long One's plates read as hollow cones.
  - The Mimic's glow is colourless.
  - The brinewyrm's pool is a flat bright slab (terrain code).
  - Frostbloom doesn't read as a disguised veinlight.

## Decisions for you

1. **Merge `polish` into `vaults`, and then to `main` and production?** The sign and vault-entry fixes are independent of the visual pass and could go on their own.
2. **The leftmost vivarium tank is cut off** by the camera's stop at the room's end. Fixing it needs a camera-clamp or tank-spacing change, which was outside this pass's limits.
3. **Frostbloom design:**
   - Its sandbox text calls it "fake veinlight", but it renders as a distinct ice star.
   - Reviewers split on whether it should mimic veinlight more closely, and the round-4 attempt to make it do so lost.
4. **SLATEBED** is deliberately the coolest, darkest room. One reviewer felt it loses the sanctuary warmth.

## Files

- **Shot script:** `scripts/polishshots.mjs`.
- **Direction:** `POLISH-DIRECTION.md`, `categories.json`.
- **Briefs and tools:** `brief.mjs`, `IMPLEMENTER.md`.
- **Shots:**
  - `r0/` to `r5/` are kept on disk but ignored by git;
  - `final/` and `pairs/` are tracked.
