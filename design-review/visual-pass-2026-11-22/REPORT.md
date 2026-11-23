# Coreward visual pass — 2026-11-22

Branch `visuals` (worktree `.claude/worktrees/visuals`, branched from `vaults` at b1fcc89). Final state **1d7bd11**. Nothing merged, nothing pushed.

## Result

**The goal was not met.** The goal was every category ≥ 7.0. The pass stopped at the 7-round cap, which you set mid-run (relayed by another session); the original cap was 10.

Final absolute scores from eight fresh reviewers, against the round-0 absolute scores:

| category | r0 | final | change |
|---|---|---|---|
| Rock and terrain | 4.2 | 5.4 | +1.2 |
| Lighting and atmosphere | 4.4 | 6.2 | +1.8 |
| World identity | 4.4 | **7.2** | +2.8 |
| Fluids, fissures, cores | 3.8 | 6.3 | +2.5 |
| Characters and creatures | 4.6 | 6.3 | +1.7 |
| Vaults | 4.3 | 5.6 | +1.3 |
| UI and HUD | 6.1 | 6.8 | +0.7 |
| Minerals | 3.4 | 6.2 | +2.8 |

Only identity clears 7. Minerals peaked at 7.2 in round 1's paired score and drifted to 6.2–7.0 under later reviewers, with no ore change in between. Absolute scores move about ±0.5 between reviewers, which is why each round used paired A/B scoring.

### Score table (paired rounds: best / candidate, from the same reviewer)

| category | r0 abs | r1 | r2 | r3 | r4 | r5 | r6 | r7 | final abs |
|---|---|---|---|---|---|---|---|---|---|
| rock | 4.2 | 4.0/6.0 | 5.0/6.3 | 5.4/6.4 | 6.0/6.4 | 6.4/5.8 | 6.3/5.7 | 5.8/5.8 | 5.4 |
| lighting | 4.4 | 4.3/6.4 | 4.4/6.4 | 6.0/6.3 | 6.0/6.5 | 6.0/6.3 | 6.4/6.8 | 6.7/6.6 | 6.2 |
| identity | 4.4 | 4.2/7.0 | 6.3/6.8 | 7.0/7.4 | 6.4/7.0 | 7.0/7.3 | 7.0/7.2 | 7.0/7.1 | 7.2 |
| fluids | 3.8 | 3.6/6.2 | 5.6/6.0 | 5.6/6.2 | 6.0/6.4 | 5.9/6.4 | 6.8/6.4 | 6.3/6.6 | 6.3 |
| characters | 4.6 | 4.7/5.0 | 4.8/5.9 | 5.2/6.0 | 5.8/6.4 | 6.3/6.0 | 6.0/6.3 | 6.2/6.4 | 6.3 |
| vaults | 4.3 | 4.8/6.3 | 5.0/5.0 | 5.8/6.6 | 5.9/6.1 | 5.8/6.1 | 6.3/6.6 | 5.8/5.8 | 5.6 |
| ui | 6.1 | 6.4/6.2 | 6.0/7.2 | 6.8/6.7 | 6.8/6.8 | 7.0/7.0 | 6.7/6.8 | 7.0/7.0 | 6.8 |
| minerals | 3.4 | 3.4/7.2 | 7.0/6.3 | 6.8/6.3 | 7.0/7.0 | 6.8/6.8 | 6.6/6.6 | 6.5/6.5 | 6.2 |

Per-round detail is in each round's folder: `rN/PLAN.md`, `rN/reviews.json`, `rN/blind-key.json`, `rN/unblinded.json` and `rN/decision.json`.

## What changed and was kept

Before/after pairs (r0 on the left, final on the right) are in `pairs/<shot>.png`. The r0 frames were shot on SwiftShader and the final frames on the GPU; the two differ only in fine facet shading.

| area | commits | what | pairs |
|---|---|---|---|
| Ores | bd4954d | Every ore rebuilt to its concept sheet: copper teal crust with glowing cells, iron as gunmetal blocks, silver needle fan, gold split open, embershard as black shards with seams, rime-salt cube, ribbed nacre, mimic husk with red cracks, voidopal with per-face iridescence. Per-vertex glow, a radial halo on the host rock, and host rock no longer darkened. | ore-lineup, ore-copper-close, ore-mimic-close |
| Fluids | e1fea19, a092aef, c955a78 | Glowing pools with a meniscus, depth gradient and slow shimmer. Fluid hue per world (VEIL orange, CRYOS cyan, MAELIS sea-green). Pool light washes the rock and the cavity above, with haze over the surface. Sealed and side bodies now read as liquid. Fissures became glowing seams with a halo. | veil3-deep, cryos2-deep, maelis6-deep |
| World hue | d49516e, 9b45cc0 | Each world keeps its hue family at every depth (rock bands, fog, pod fill light). The cavity backwall is world-tinted with depth haze. Fissures light their stone. MAELIS fissures are sea-green. | veil3-mid, cryos2-mid, maelis6-mid |
| Rock | 47bc02a, 6499678 | Smeared strata streaks replaced by crisp dark per-block values. Rock next to an ore stays matte so the ore is the light. Per-chunk frustum culling. | veil3-fissures |
| Light | f9cfe06, f93b051, 29c1897, cd8e8d8 | Visible headlamp beam with dust, and the beam lights what it hits. Backwall falls off to black away from the lit pocket. Bloom on true emissives only, never on ore (on by default on hardware GPUs, off on software GL, with a setting). | veil3-mid, hud-play |
| Cores | f9cfe06, 81f7a45, f93b051, c955a78 | The core floods its chamber: occluded wash, rim-lit slabs, rays, floor haze. Faceted crystal core with a hot floor pool. Radial falloff, and the box edge is gone. | veil3-core, cryos2-core, maelis6-core |
| Characters | e141e7b, 8a9c15a, d43e07b, 5f0cb63, f05374e | Creatures glow and light their rock (warden hex core, shellback spine and pool, stillwalker frost only when lit). Glimmerflies are soft gold-green motes, drawn at most 0.6 tiles from their real position. Faceted white pod with a framed glowing visor. Pilot visor glow, amber gloves and boots. | pod-pilot-eva, creature-warden, creature-shellbacks |
| Vaults | 8a82786, ce022f3, 6df9673, 63b2a33 (fang glints removed in c5bced5), a6370ee, 8c4c599 | Cool hazy ashlar back wall a step above the footing. Warm pools from sconces and censers, and unlit sconces show coals. Hot-tipped fangs. Lit walkable tops. Tinted doorway in the entry gate. Side rims on pillars. RETURN's wall set back. Gravity tints and chevrons unchanged. | vault-ember-room, vault-return-spawn, vault-debt-spawn |
| UI | 908c508, 29c1897 | Title sits over a dark band with warm light rising from below. Warm, lamp-lit panels with world-hued edges and squarer corners. Larger and brighter HUD sub-labels. Warm glow on the ending page. | title, shop-trade, hud-play, ending-page |
| Harness | 3e07f5b, d4a0831 | Dev-only additions: `?seed=N` pins a fresh world's seed so shots are comparable, and the fauna sandbox stages the stillwalker ahead of the lamp. | — |

## What was rejected and why (full entries in REJECTED.md)

- **Bloom, attempt 1 (r1)**: failed the gate. vaults.mjs runs on SwiftShader, which ran about 6× slower with bloom.
- **Bloom, attempt 2 (r2)**: overexposed the gems (minerals −0.7). Attempt 3 (r3) kept off the ores and was kept.
- **Faceted rock, four attempts**: G3 (shader), H1 (geometry), J1 (veins and near-black) and L2 (topsoil). Each either raised rock but cost minerals (bright lit rock next to same-hue ores, halos clipped to squares) or weakened the fissure glow. Only I1's conservative crisp-dark version survived.
- **Fissure heat field (K2)**: flooded whole blocks orange (rock −0.6, fluids −0.4).
- **Per-world rock glints and nacre (K4)**: too faint to count.
- **Vault global haze retune (I5)**: within noise.
- **First pilot-trim and glimmerfly strand (J3)**: lost on luck in the shots. The praised parts were re-landed as K1.
- **Shellback form and pod rim (L3)**: +0.2.
- **Fang-tip glints**: read as candles; a readability regression.

## Performance

renderer.info over all 60 shots, r0 against final:
- Draw calls 13,946 → 10,987 (−21%).
- Triangles 4.05M → 2.31M (−43%), thanks to per-chunk culling.

The heaviest per-shot increases are on cheap vault spawn frames: vault-return-spawn 120 → 162 calls (+35%) and vault-debt-spawn +21%. They come from the pilot's trim meshes (also on the statue copies of the suit), the vault wall and pool meshes, and the bloom passes. The title gained +16% calls from its wider frame.

Bloom costs +14 full-screen draws per frame on hardware GPUs and nothing on software GL. Shader programs per frame roughly doubled (about 16 → 33), mostly from the bloom passes and new materials, all compiled at prewarm.

Each vault room also allocates one baked wall texture, about 15–20 MB of GPU memory in the largest rooms. Per-shot numbers are in `r0s/stats.json` and `final/stats.json`, and comparisons in `pairs/perf.json`.

## Gate

The full gate passed on the final state, 1d7bd11:
- tsc and build
- all 7 vault routes
- vaults.mjs 47/47
- vaultfit
- bugsweep
- gemcheck

Two flakes are new under load, both passing on rerun: "one-way gate" and "entry on foot" (a null `vault` before the room loads). "Dead surface" is a timing race that is already in the test and fails when vault frames get slower; that is how F4 and K3 were caught and then optimised.

## Process changes made during the run (relayed by another session, in your words)

- **"let's cap it at 7 rounds"**: the loop stopped after round 7.
- **"yes use gpu… I dont think you need to playtest every vault after every pass"**: from round 2, shots ran on the RTX 4060 (D3D11 ANGLE). A full set took about 7 minutes against about 18 on SwiftShader. Pairs never mixed renderers. Per-round gates became tsc, build, a scope guard and page errors, plus the vault play-throughs when vault files changed and gemcheck when ore code changed. The full gate ran at the end.

## Shot-list changes (best and candidate always re-shot with the same script)

- **r1**: world seed pinned. The r0 shots were redone as `r0s/` because terrain shifted between builds.
- **r3**: vault room frames wait 6 s for the stone to land and are capped closer.
- **r4**: core frames are centred between the pod and the core.
- **r6**: creature frames wait for the damage flash to fade, which had flooded some frames red by luck.

## Open issues reviewers raised that weren't done

- **Rock**: still reads as a flat tile grid. The surface topsoil is a checkerboard. There is no per-world material, no CRYOS crystal glint and no MAELIS nacre.
- **Fissures**: still per-tile decals that stop at tile edges; reviewers want branching veins that light their stone.
- **Ore halos**: still read as squares clipped to the tile on some ores.
- **Ores**:
  - Iron nearly vanishes against rock.
  - Silver has a halo it shouldn't have.
  - The pale ores (silver, diamond, frostbloom, nacre) blur together.
  - Nacre's silhouette is a crystal rosette, not a ribbed shell.
  - Gold has no split-rock wound.
  - Veinlight's fronds are colourless.
- **Vaults**:
  - The back wall is still too close in value to the footing.
  - There are too few warm pools; RETURN and KINDLED have none, and only room data could add sconces.
  - DEBT feels cluttered (rain and chevrons).
  - DEBT's room frame is small in a letterbox.
- **Characters**:
  - The glimmerflies don't form a ribbon.
  - The pod body reads dark at play scale.
  - The pilot's visor bloom smears the head.
- **Lighting**: the beam is hard-edged with little dust, and VEIL's shallow backdrop is flat.
- **UI**: the HUD bars are generic and unbacked, the title crops the station, and the ending body text is dim.

## Decisions for you

1. **Core colours.** Every reviewer marks the CRYOS heart (mint-teal, which reads as MAELIS) and the MAELIS pearl (lavender in a grey chamber) as off-hue. They are `core:` in worlds.ts, and the CRYOS ending text says "green light", so I left them alone.
2. **The headlamp now leans where the pod faces** (G2, f9cfe06): about 78° off plumb when parked, straight down when drilling. This changes which tiles the lamp lights, a gameplay-visibility change, and it is not just cosmetic. Keep it or revert that part.
3. **Bloom default**: on for hardware GPUs, off for software GL, and overridable in Settings > Display.
4. **Colour changes that touch identity**:
   - VEIL glimmerflies moved from warm gold to gold-green (worlds.ts swarm colours).
   - The stock "Yard Cream" pod finish is lighter (0xd8c9a4 → 0xe8e0cb).
   - Vault sconce, censer and brazier light intensities were raised (H4); this is visual only, but it shows in dark rooms.
5. **The cavity-backwall haze is baked from the starting terrain** (I3). Tunnels you dig get less of it.
6. **Whether to merge `visuals` into `vaults`.** It holds 22 kept visual changes, plus the dev `?seed` harness in main.ts and the sandbox staging. Nothing on `vaults` or `main` was touched.
7. **SITE 297 was not touched.** Bloom is suppressed there, and several new effects are gated off in spent and husk worlds.

## Files

- **Shot script**: `scripts/visualshots.mjs`.
- **Shot list**: `SHOTS.md`.
- **Rubric for minerals**: `MINERALS-DIRECTION.md`.
- **Implementer brief**: `IMPLEMENTER.md`.
- **Tools**: `brief.mjs` (blind reviewer briefs), `harvest.py`, `deltas.py`, `gate.sh`.
- **Shots**: `r0/` (SwiftShader), `r0s/` (r0 with the seed pinned), `rN/best` and `rN/shots` (GPU from round 2), and `final/` (the final shots plus the absolute reviews).
