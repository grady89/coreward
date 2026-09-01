# COREWARD — E2E Implementation Plan (v0.3.3 → 1.0)

> **STATUS 2026-09-01 — Phases 0–3 built, 13 headless suites green.**
> Shipped overnight: the narrative event engine + Dispatch, the Cindral advance,
> wreck chronology, lamp toggle, glimmerflies, Long Ones, flares, seismic
> charges, drill-as-weapon, the Threats setting, Lamplighter ruins, the glyph
> codex, Wardens, and per-world swarm dialects.
> **Next: the ⛩ playtest gates below — they need a human, not another suite.**
> Then Phase 4 (husk world, fragment extraction, three endings, Lumen Lance),
> and the per-world *hunter* variants still outstanding: Brinewyrm,
> Stillwalkers, the Riptide, Shellbacks, geode mimics, the Kindled.

Design canon: [DIRECTION.md](DIRECTION.md) · [LORE.md](LORE.md)
Current state: core loop, 3 worlds, forge, EVA, contracts, settings, survey
map + Deep Array, veinlight-as-fuel, resource forms — all verified by 9
headless suites. No enemies, no narrative systems in-game beyond static logs,
no endings beyond the core walk, no Steam pipeline.

**Standing rules for every phase**
- `npx tsc --noEmit` green + a Playwright suite per phase before "done".
- Saves never break: new fields are additive with defaults; migrations tested.
- Artifact republished at each milestone; user playtest gates marked ⛩ are
  hard stops — the next phase's scope depends on what they show.
- One new system per phase gets built *generic* the first time it's needed
  (narrative events, entities), then reused, never re-invented.

---

## Phase 0 — v0.4 "THE VOICE" · narrative foundation (~1 session)

The cheapest total transformation of the game's tone, and the framework every
later phase hangs content on.

- **0.1 Narrative event engine.** One system: triggers (depth-band first-entry
  per world, milestone, wreck count, contract count, world arrival, core
  touched, elapsed play time) → queue → delivery channel. Fired events persist
  in the save; nothing repeats. All later narrative (dispatch, glyphs, special
  logs) is content in this system, not new code.
- **0.2 Dispatch transmissions.** A comm strip (bottom-left, typewriter text +
  radio blip audio, self-dismissing, never blocks input). ~30 lines for VEIL-3
  covering the Act I–II tone curve: invoicing → small talk → hedging. Dispatch
  is poor too; the script slips exactly once per act.
- **0.3 The advance.** Starting ✦40 reframed on the title/intro as
  `CINDRAL ADVANCE — ✦40 · RECOVERABLE`. One line; the whole loop reads
  differently after it.
- **0.4 Wreck chronology rewrite.** `WRECK_LOGS` becomes per-world, ordered by
  depth (deepest = oldest), with the unsigned driller's three-log reveal split
  across worlds and the your-own-registry log as a late trigger.

*Suite:* narrative.mjs — triggers fire once, persist, deliver on the right
world/depth.

## Phase 1 — v0.5 "LIGHTS OUT" · threat vertical slice (~1–2 sessions)

Prove light-as-liability before building a bestiary on it.

- **1.1 Lamp toggle** (F). Kills headlamp + glow; terrain goes near-black while
  self-glowing ore stays visible (already emissive — free win). HUD lamp pip,
  click sound. Ships before any enemy: it's atmosphere even alone.
- **1.2 Entity framework.** `Entity` base (grid collision reused from the
  pilot), spawner bound to chunk range/world/depth band, pooling, contact
  damage through the existing event path. Entities don't persist in saves —
  they respawn by region on load.
- **1.3 Glimmerflies.** 5–9 per swarm, cheap boids on instanced meshes; orbit
  and drift when idle, converge on a lit lamp inside ~8 tiles, nibble hull +
  sip fuel on contact, scatter within ~2s of darkness. Wing-shimmer audio bed.
- **1.4 Threats setting.** `Threats: full / reduced / off` in settings from day
  one — accessibility and a Steam-review insurance policy, cheapest now.

⛩ **Playtest gate: does going dark feel tense-but-fair?** Pod handling in the
dark, fly aggression, fuel-sip rate — tuned here before anything else exists.

*Suite:* threats.mjs — spawn bands, lamp attraction, disperse-on-dark, damage,
threats-off setting.

## Phase 2 — v0.6 "THE LONG DARK" · full VEIL-3 threat kit (~2 sessions)

- **2.1 Flares.** Consumable (sold at FUEL depot), thrown in an arc, real
  point light on a budget (max 3 live), aggro magnet for anything
  light-keyed, 60s burn. Doubles as a scouting tool — worth buying even with
  threats off.
- **2.2 The Long Ones.** Hunt through the air-tile graph beyond 320m: fast in
  corridors ≥2 wide, can't enter 1-wide tunnels — the rule the player learns
  to dig around. Audible rumble tell before visual contact. Timebox the
  pathing; fallback is patrol-rails through largest passages.
- **2.3 Geode mimics.** A rare false ore vein that hatches a small chaser.
- **2.4 Seismic charges.** Placeable, 3s fuse: clears a 3×3 of rock AND fills
  the tunnel behind with fast-drillable rubble — escape tool and Long One
  counter in one. Kills anything in radius.
- **2.5 Drill-as-weapon.** Contact damage while drilling into an entity —
  hold-your-ground defense with zero new systems.

*Suite:* extend threats.mjs — corridor-width rules, flare aggro, charge
collapse, mimic hatch.

## Phase 3 — v0.7 "DIALECTS" · per-world fauna + the Lamplighters (~2–3 sessions)

Same grammar, different organ (DIRECTION §8g).

- **3.1 CRYOS-2 (heat-keyed):** Rimewings (thruster wash thaws them → cut your
  engine and drift), Brinewyrm (lives in cryobrine, surfaces to strike),
  Stillwalkers (move only while the lamp is off — the world-2 rule collision),
  Frostbloom mimics.
- **3.2 MAELIS-6 (space-contesting):** Pressure polyps (living gas-fling
  mines), the Riptide (current zones that pull, never seen whole), Shellbacks
  (reseal player tunnels with nacre — the Pearl healing its wound).
- **3.3 Custodian ruins.** Terrain gen below 600m: right-angled chambers,
  glyph stones (pickups for Phase 4), the environmental "someone built this"
  beat. Prerequisite for Wardens and glyphs.
- **3.4 Wardens + the Kindled.** Wardens patrol ruins, track by luminance
  (lamp discipline is the counter), identical on every world — their sameness
  is lore. Kindled in core chambers: non-hostile, lethal to touch.

⛩ **Playtest gate: does each world feel like a dialect, not a reskin?**

## Phase 4 — v0.8 "THE PATTERN" · narrative payoffs & endings (~2–3 sessions)

The riskiest design work — a written mini-spec for 4.3 gets user sign-off
before code. **Spec drafted: [SPEC-PHASE4.md](SPEC-PHASE4.md) — awaiting
sign-off on its ⛩ decision table.**

- **4.1 Glyph codex.** Glyphs collected at ruins (EVA pickups), codex page at
  the assay office, progressive translation as coverage grows; at 100% the
  Lamplighters' final message unlocks — the KINDLE gate.
- **4.2 The husk world.** Fourth starmap entry after the second core: not a
  dig site. Gray palette, intact empty colony, no fauna at all, the survey
  office holding your exact contract. One EVA-only visit, pure narrative.
- **4.3 Fragment extraction.** Touching a core now offers EXTRACT: the
  fragment fills the hold, the pod runs hot and heavy, and the climb out is
  the game's setpiece — Wardens fully awake, world shaking, veinlight dying
  around you as you rise. Systemic, not scripted.
- **4.4 The three endings.** EXTRACT (world permanently dark on revisit —
  palette swap; the color script runs backwards on the flight up), RETURN
  (carry all three back down; dawn on VEIL-3), KINDLE (all glyphs + logs +
  full forge; the new star; the empty contract board). Plus the Lumen Lance
  in the forge — fires ✦ as ammunition.

*Suite:* endings.mjs — extraction state, ending triggers/gates, husk world
travel, glyph completion.

## Phase 5 — v0.9 "TUNING" · feel, audio, performance (~1–2 sessions + playtests)

- Economy balance from real playtests: upgrade tiers 3–5 vs ore density,
  world multipliers vs forge costs, enemy damage vs hull tiers.
- Audio pass: per-creature voices, dispatch blips, lamp click, ending beats;
  a full ear-mix session (the one thing headless testing can never cover).
- Performance on real GPUs: entity + light budget, profiling, memory across
  world travel.
- Accessibility close-out: threats modes verified, colorblind check on ore
  palette, reduced-motion audit of every new effect.

## Phase 6 — v1.0 "THE POSTING" · Steam pipeline (~2–3 sessions)

1. Fonts bundled locally (drop the Google CDN — offline Electron requirement).
2. Electron wrapper (known recipe: storage seam, `base:'./'` already set,
   electron-builder, CI).
3. Steamworks: achievements mapped to milestones/endings/contracts (the seams
   already exist in `state`), cloud save swap at the localStorage seam, real
   wishlist URL on the title screen.
4. Gamepad + Steam Deck: map to the single `Input` struct, menu navigation,
   glyph-friendly button prompts.
5. Marketing capture: `?capsule` key-art mode and `?cinema` HUD-less trailer
   mode; store page copy drawn from LORE.md.

---

## Sequence rationale (why this order)

1. **Narrative before enemies** — transforms the game for the cost of UI + prose,
   and Phases 3–4 hang all their content on the event engine.
2. **Lamp before flies** — the counter must exist before the threat that
   teaches it.
3. **One creature, then a gate** — Glimmerflies prove light-as-liability;
   if the feel fails, the fix costs one creature, not nine.
4. **Grammar before dialects** — the full VEIL-3 kit establishes the pattern
   per-world variants riff on.
5. **Endings last among features** — they depend on every world, ruins, glyphs,
   and extraction existing.
6. **Tuning before Steam** — ship the feel, then the wrapper.

## Risk register

| Risk | Mitigation |
|---|---|
| Enemy feel fails (game is beloved for calm digging) | Phase 1 gate + `Threats: off` mode from day one |
| Long One pathing complexity | Timeboxed; rail-patrol fallback |
| Extraction setpiece scope creep | Written mini-spec + sign-off before code |
| Entity/light perf (can't measure FPS headlessly) | Budgets set up front (≤12 live entities, ≤3 flare lights); real-GPU check each phase |
| Narrative volume (~150 lines of prose) | Written per-phase with canon in LORE.md, never all at once |
| Save breakage across 6 phases | Additive-only fields; migration test in every suite |

**Total: ~10–14 build sessions to 1.0**, with two hard playtest gates (after
Phases 1 and 3) and an ending-spec sign-off before Phase 4 code.
