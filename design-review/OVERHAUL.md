# COREWARD — Design & Visual Direction Audit

Engagement date: 2026-09-05. Method: full read of DIRECTION.md, LORE.md, PLAN.md, BESTIARY.md, THREATS.md, AUDIT.md; code audit of every fauna file, the controller, pod, chunks, backdrop, structures, HUD/panels, audio, and config; an earnings model built by replicating `terrain.ts`'s generator over 8 seeds; render review of the headless suite's screenshots; comparative research with primary sources. Every finding is tagged **VERIFIED** (causal code read, file cited) or **HYPOTHESIS**. No implementation code was written.

---

## 1. Verdict

Three things are genuinely excellent and must not be touched: the **underground lighting hierarchy** (black frame, ore glowing in proportion to value, the lamp cone as the player's signature — verified coherent from `chunks.ts` through every fauna file, and it *is* the game); the **creature discipline** (nine of twelve creatures are clean against intent, nothing must ever be killed, the Riptide can't even be hit); and the **verification culture** — the headless harness is better than most shipped games'.

Two things are broken. **Progression is invisible**: thirty tiers across six tracks change zero pixels on the hero object, and the purchase moment is a text row swap. **The economy's stated thesis is false after the first hour**: fuel pressure falls from 155% of trip revenue to 1%, one entire track (thrusters, ✦90,850) is a placebo that never touches climb speed, and the Extract temptation equals eleven minutes of endgame income.

The highest-leverage change is the **parametric refit**: make the six purchases visible on the pod through silhouette and emission, staged in the garage as an event. The architecture is one method away from supporting it.

---

> **STATUS 2026-09-05, same day — Phases 1–4 and the cut list are BUILT** and
> suite-green (all 11 assertion suites plus the new `legibility.mjs`), unpushed
> pending playtest. Also landed: the docs numbers pass, Dispatch lines for the
> two undocumented features, and the engine climb probe (measured 1.7× at tier
> 5). Deferred on purpose: the tank re-point and every magnitude ratification
> (see `PLAYTEST.md`), plus §5's deferred list. One find along the way: the
> phase3 vault/codex failures predating this work were suite rot against the
> fold rework's longer exit — fixed in the suite; the game was sound.

## 2. Findings

### Workstream A — Enemy and threat flow

The design law holds where it matters: **VERIFIED** — no threat must be killed to progress, a silent run is viable everywhere, and the counter verbs (dark, still, coast, slow, narrow, distance) are all real in code. Mimics, Rimewings, Brinewyrm, Frostbloom, Riptide, Shellbacks, and the Kindled are clean or near-clean against BESTIARY/THREATS intent. The failures cluster in three creatures and one weapon.

#### A1 — The Stillwalker has no visual tell in the state that hurts you. VERIFIED. **The "broken-feeling threat" smoking gun.**
BESTIARY.md:96-97 and THREATS.md:171 both promise a "red dread wash creeps up the edges of the screen." It does not exist. `threats.dread` drives only `audio.heartbeat` ([main.ts:2311-2317](../src/main.ts#L2311), [audio.ts:574](../src/audio/audio.ts#L574)); the HUD vignette is a static ellipse ([style.css:37-40](../src/style.css#L37)). In its hunting state (lamp off — the state the whole creature exists for) it is a near-black silhouette at 0.78 opacity inside rock. A player with sound muted is control-seized (1.4s hold, −22 fuel, −18 hull, [stillwalkers.ts:186-194](../src/world/fauna/stillwalkers.ts#L186)) with zero prior signal. The sighting toast only fires when it's *already frozen* by your lamp ([stillwalkers.ts:195-198](../src/world/fauna/stillwalkers.ts#L195)). This is the only outright Tell failure in the game, and it's on the creature most likely to generate "this feels broken" reports. No script asserts any visual for it.

#### A2 — The Warden's beam is a costume over a radius. VERIFIED.
Detection is `(lampOn || carrying) && dist < 15` — omnidirectional, through solid rock ([wardens.ts:239-244](../src/world/fauna/wardens.ts#L239)). Only the *damage* path checks beam angle and line of sight (:281-285). The sweeping beam the player is visually invited to dodge has no sensory existence; a lit pod in a sealed tunnel 14 tiles away engages the Warden, which then thuds at a wall forever. Players who stealth around the arc are rewarded by coincidence. Compounding it: `scrutiny` — the beam-cook buildup meter — is computed and consumed by *nothing* in the shipping game (no HUD, no audio; only test scripts read it). First beam damage announces itself as the generic red flash, 0.2s into exposure. The flagship threat fails half its Tell test and its Dial (arc-position) is fictional. Untested: phase3.mjs only asserts lit-engage/dark-disengage in open air.

#### A3 — The polyp's taught dial is inverted. VERIFIED (math), design call needed.
THREATS.md:211 teaches "thread past at a crawl." The code's inflation term `0.22 + near·0.55 + |v|·0.09` ([polyps.ts:224-233](../src/world/fauna/polyps.ts#L224)) is dominated by proximity-and-dwell: a stationary pod at point-blank bursts a polyp in ~1.3s; passing within 1.15 tiles pops it instantly at any speed; and total inflation on a fly-past scales with exposure *time*, so crawling through a cluster accumulates ~2× the burst threshold while rushing often doesn't. The shipped teaching toast already knows the real rule — "THEY ANSWER TO NEARNESS — GIVE THEM ROOM" ([worlds.ts:211](../src/world/worlds.ts#L211)). A player who obeys the manual gets hurt by the manual. Recommendation in the plan (P3.3): canonize distance, fix the docs, and raise the speed coefficient just enough that rushing is never the *better* option.

#### A4 — The Lance: keep the button, fix one interaction. VERIFIED.
Full implementation read ([main.ts:2916-2935](../src/main.ts#L2916), config: 9 shards, ✦120/shot, 10-tile horizontal hitscan). Against hunters, Wardens, polyps, Shellbacks it is uniformly a *light verb* — stun, blind, stagger, pop — which is exactly "light used as argument." Against swarms it **permanently deletes them** ([glimmerflies.ts:132-138](../src/world/fauna/glimmerflies.ts#L132), [rimewings.ts:156-162](../src/world/fauna/rimewings.ts#L156)) — strictly superior to the lamp counter (dark merely disengages; the lance erases), with price as the only brake. That brake fails exactly when the design needs it: in Act IV, holding a ✦300,000 offer, ✦120/shot rounds to free, and the carry climb — the game's thesis statement — becomes affordable to shoot through. DIRECTION.md:434's own sentence ("blinds rather than kills") is currently false for swarms. **Committed position: keep the lance and its fire button** — its economy coupling is genuinely clever and tested — **but swarms scatter blind (flung, de-alerted, anchor displaced) instead of dying.** That makes DIRECTION's sentence true, keeps the panic-button value, and removes the only place in the game where paying money beats managing light. Cutting the lance is unnecessary; leaving swarm-deletion teaches players X is the DPS button the docs insist doesn't exist.

#### A5 — Doc/code drift: THREATS.md's "real tuning values" claim is ~80% true. VERIFIED.
The misses, all confirmed against code: Kindled pod-touch deals **zero** hull, not 40 (deliberate — [main.ts:2320-2329](../src/main.ts#L2320) comments it, fauna.mjs *asserts* `hullSafe`; THREATS.md:304 and DIRECTION.md:381 are stale); Riptide pull is 26, not 15, and grip is `near·room²`, not `near²·room²` ([riptide.ts:24,199-203](../src/world/fauna/riptide.ts#L199)); cryobrine is 16 hull/s + 2.5 fuel/s, not 24 ([worlds.ts:150](../src/world/worlds.ts#L150)); polyp burst damage is proximity-based, not swell-based; swarm damage is **per fly**, not flat (real contact DPS ~2–4× the documented figure, [glimmerflies.ts:255-259](../src/world/fauna/glimmerflies.ts#L255)); Long One escape is 2.1s not 2.2s, and "faster than you" is false against a flying pod (worm 4.8, pod side cap 9); the Long One's promised traveling dust-line warning does not exist (emergence-point dust only, [longone.ts:256-263](../src/world/fauna/longone.ts#L256)); Warden "every hall goes on alert" is one Warden with a wider radius ([wardens.ts:33-49,187](../src/world/fauna/wardens.ts#L187)); Rimewings also wake to the drill (THREATS omits it; BESTIARY and code agree). The drift clusters exactly where no script asserts numbers.

#### A6 — Self-inconsistency: alerted swarms chase the globally brightest flare at any distance. VERIFIED.
Waking is range-gated but pursuit targets `flares.brightest()` with no range check ([flares.ts:53-57](../src/world/fauna/flares.ts#L53), [glimmerflies.ts:214](../src/world/fauna/glimmerflies.ts#L214), [rimewings.ts:270](../src/world/fauna/rimewings.ts#L270)). One flare burning 200 tiles away is a universal swarm off-switch for 26 seconds. The lure is the intended verb; unranged, it's degenerate.

#### A7 — Undocumented riches. VERIFIED.
A carried fragment freezes Stillwalkers within 5 tiles ([stillwalkers.ts:154](../src/world/fauna/stillwalkers.ts#L154)) — a superb Act IV asymmetry (the fragment shields you from the dark-feeder while damning you to the light-tracker) that no player will ever be told about. Extraction kills a world's *entire* fauna, not just its Kindled ([main.ts:806](../src/main.ts#L806)) — the game's best unadvertised consequence. Neither is surfaced by Dispatch or any doc.

#### Three-tests summary

| Threat | Tell | Dial | Counterplay | |
|---|---|---|---|---|
| Glimmerflies | PASS | PASS | PASS | clean |
| Long Ones | PASS | PASS | PASS | dust-line promise unbuilt (A5) |
| Geode mimics | PASS | PASS | FAIL-by-intent | recovery requires a kill; drill-as-verb carries it — accepted |
| Rimewings | PASS | PASS | PASS | clean |
| Brinewyrm | PASS | PASS | PASS | the 1s churn warning is real and wired |
| Stillwalkers | **FAIL** | PASS | PASS | A1 |
| Frostbloom | PASS | PASS | PASS | clean |
| Polyps | PASS | **FAIL as documented** | PASS | A3 |
| Riptide | PASS | PASS | PASS | the thesis, intact in code |
| Shellbacks | PASS | PASS (weak) | PASS | non-damaging by design |
| Wardens | **PARTIAL** | PASS | PASS | A2 |
| Kindled | PASS | PASS | PASS | clean |

### Workstream B — Upgrade and economy flow

Ground truth (**VERIFIED** by replicating the generator, 8 seeds): ore bands share one roll per cell, first-match-wins ([terrain.ts:119-131](../src/world/terrain.ts#L119)), so depth is partitioned into near-exclusive shelves. Value per solid tile dug spans regolith ✦1.3 → embershard shelf ✦76 (58×) while hardness rises only 2.7×. **Depth is the only economic variable; lateral play is worthless everywhere.** Maxing all six tracks costs ✦608,800.

#### B1 — The thruster track is a ✦90,850 placebo. VERIFIED.
`MAX_RISE = 14` is a hard cap the thrust multiplier never touches ([controller.ts:168](../src/player/controller.ts#L168)); `FUEL_THRUST` is flat 3.4/s regardless of tier ([controller.ts:145](../src/player/controller.ts#L145)). Five tiers buy ~0.34s of acceleration ramp per ascent plus lateral cap. Climb speed and climb fuel — the things a player buying "THRUSTERS: lift power" believes they're buying — are identical at tier 0 and tier 5. Six tracks, five real.

#### B2 — Fuel pressure, the game's stated thesis, dies at ~✦20k of spend. VERIFIED (model, assumptions stated in the working notes).
Fuel as a share of trip revenue: 155% (stock — the economy is literally negative until Tank 1) → 49% → 24% → 7% → 1% → 1%. "The refill costs more than the trip earned" (DIRECTION.md:88, and the K. Vashti log) is true only at tier 0. From the Void Veins down, what stops a trip is the tank as a *physical wall*, not fuel as a *cost* — a weaker, less legible tension, because the answer is always "go home," never "gamble." The earn-rate curve spans −✦44/min to +✦26,942/min (VEIL-3): a 600× swing, with the last two-thirds of the tree (✦401k) costing ~27 minutes at tier-4 rates — purchases stop being decisions and become a checkout queue.

#### B3 — Cargo 5 buys ✦0 on a deep dive; tank/cargo/depot/warp are one purchase in four costumes. VERIFIED.
At drill 6.4 / tank 780, a deep dive fills ~39 of 60 slots before fuel forces ascent — the 60→90 tier (✦58,000) adds nothing where ore is valuable. Depots (✦36k/world, 4× metered rates) effectively add a second tank; Warp Hold deletes the cargo cap and the ascent both. These four systems silently substitute for each other with no design acknowledgment.

#### B4 — The Pyro Exchanger and the radiator track mathematically cancel. VERIFIED.
Converter income = excess heat × 2.4 fuel/s ([controller.ts:581-584](../src/player/controller.ts#L581)); every radiator tier reduces excess proportionally; Radiator 5 (✦76,000) sets Pyro income to exactly zero. Two ✦100k-class purchases that anti-synergize is either the game's only genuine build fork or an accident. **HYPOTHESIS: accidental.** It's also locked behind `forgeUnlocked` (a met core), so on the critical first run there is exactly one build. The fork deserves to be real, stated, and reachable.

#### B5 — Death/rescue fees are purse-fractions and fully dodgeable. VERIFIED.
`DEATH_FEE_FRAC 0.12` / `RESCUE_FEE_FRAC 0.15` of *money held* ([panels.ts:730-737](../src/ui/panels.ts#L730)). Bank at the Ledger before diving and you die for ✦0 — while rescue refills 35% of the tank, worth ✦437 at tier 5: **an empty-purse tow is net-positive.** The pressure regulator leaks precisely for the player who has learned the systems.

#### B6 — Contracts are economically dead from ~✦67k of spend. VERIFIED.
Rewards are fixed at authoring × world multiplier ([contracts.ts:93](../src/game/contracts.ts#L93)), topping out at ✦20,250 — 78% of its own requirement, ~10% of one deep hold. The board grows with record depth but its payouts don't grow with the player's economy.

#### B7 — The Extract temptation is numerically hollow. VERIFIED.
✦300,000 per fragment ≈ 11 minutes of ordinary VEIL-3 digging (5 on MAELIS-6) at the point you can accept it, against a permanent 75% write-down of that world's ore. LORE.md needs this ending "genuinely tempting" — for a needy driller it should be everything they want. Numerically it's a bad deal presented as a bribe you don't need. This is a *narrative* failure caused by a balance curve: the moral choice only works if money still means something when it's offered (see B2/B8).

#### B8 — Late economy: money goes flat the moment Radiator 5 is bought. VERIFIED.
Post-tree sinks: survey gear + fixtures ≈ 4 minutes of income; the Keeping's wardrobe/catalog (❖14,625 ≈ ✦1.46M) and the gemcutter's FLAWLESS chase (~✦3.5M expected) are the real tail — the right shape, but entirely optional and entirely non-mechanical. The Extract offer then *adds* ✦900k of income to a closed tree. Veinlight (+10 fuel) is calibrated to tanks that don't exist at the depth it grows: it's more common than ore in the Void Veins (where fuel is cheap) and **zero below row 460** ([terrain.ts:152](../src/world/terrain.ts#L152)) — the thirstiest ground has no lifeline, inverting README's stated intent. Whether that inversion is a bug or the correct cruelty is a design call (Open Question 4).

#### B9 — Tension map. VERIFIED mechanics, HYPOTHESIS on felt experience (no playtest data exists; PLAN.md's ⛩ gates are still open).
Real tension: the first 15 minutes (working as written) and the unprotected heat run at mid hull tiers. Dead time: the ascent — 33 seconds of holding one key at depth cap with zero decisions (and ~2 minutes of guaranteed-outcome ramming on CRYOS-2); the descent after arrestors trivialize it; and the T4→T5 checkout queue. The comparative research is unambiguous that **the ascent is where this entire genre goes stale**, and that checkpoints don't fix it — earned capability does (Motherload's Hyper-Drive worked; Super Motherload's outposts still drew "increasingly tedious" from Game Informer).

### Workstream C — Visual progression (priority)

#### C1 — Should mechanical upgrades be visible on the pod? Yes. All six tracks, but through exactly two channels, and three tracks carry the load.
The argued case: (a) the strongest external evidence in Workstream D is a near-natural experiment — Ad Fundum (upgrades change the mech's appearance; top review theme is upgrade satisfaction) vs Drill Core (numeric menus; top review theme is "upgrades don't feel impactful"), same genre, one year apart; (b) internally, the pod's purchase moment is the game's core emotional beat and currently changes zero pixels (**VERIFIED**: `Pod` imports nothing from state; the buy handler plays a chirp and re-renders a panel, [panels.ts:463-478](../src/ui/panels.ts#L463)); (c) the pixel math says it's feasible — at gameplay distance the pod is ~87px silhouette / ~58px hull (computed from [camera.ts:80](../src/fx/camera.ts#L80) + FOV 52°, consistent with renders), so **silhouette contour and emission read; surface detail does not.**

The governing law (Spelunky's, adopted): *anything that changes movement or reach changes the silhouette; anything that changes information changes the HUD.* And the ownership split that keeps the paint locker honest: **upgrades own geometry and emission; cosmetics own hue** — the cosmetics contract ([cosmetics.ts:1-3](../src/game/cosmetics.ts#L1)) already supports exactly this. Alarm semantics (danger-red, safe-teal) become reserved: no cosmetic may claim them (Downwell's palettes degrading its own readability is the cautionary tale).

#### C2 — The parametric system. Per-track parameters, tier-mapped, with the distance each reads at:

| Track | Parameter (geometry/emission only) | Reads at |
|---|---|---|
| **Drill** | bit length 0.52→0.78, radius, silhouette (cone → stepped auger), collar count; tip emissive from tier 3; spark signature (count/spread) per tier | **both** — 34px, front-center, already animated |
| **Thrusters** | flame geometry: length bias on the existing `0.4 + f·1.1` scale, cone → twin-plume at high tier; nozzle count 2→3 (garage only) | **both** — flames are additive emissive, read at any distance; the cheapest win in the codebase |
| **Radiators** | dorsal fin ridge, 0→5 fins ≥0.15u; fin emissive driven by the live heat gauge (danger meaning for free) | **both** — new silhouette mass + emission |
| **Tank** | aft/belly girth: saddle tanks swelling the lower silhouette | both (silhouette mass) |
| **Cargo** | flank panniers, count per tier; pannier glow scales with *current load* — fill state visible at a glance | both; the load-glow is play-critical |
| **Hull** | belly-band width + plate seam count; steel-tone shift (structural, not paint) | garage mostly; band width reads in play |

Every part ≥0.15 world units or emissive; anything smaller is decoration and is refused. Cost: ~12–18 additional small meshes on an ~18-mesh pod, reusing the existing Standard/Basic materials (no new material types — shader-warm discipline per [main.ts:73-78](../src/main.ts#L73)). Draw-call impact is rendering noise against ~19 draws/chunk × ~16-20 chunks. **VERIFIED feasible**: the mutation seam exists (`applyFinish` proves live re-materialing; `applyKeeping` at [main.ts:860-866](../src/main.ts#L860) already runs on every purchase-relevant change); parts are currently unretained loop-locals, so the honest implementation is teardown-and-rebuild of the lift group, precedented by `interior.rebuild()`.

The second half of the system is **the purchase as an event**: the garage docks should frame the pod (the promised 0.3s dock ease from DIRECTION §5, currently a blur scrim — [panels.ts:114-117](../src/ui/panels.ts#L114)), and buying a tier should swap the part in view with a hitstop-grade punctuation. Progression that changes the machine while you watch is the whole point; progression that changes it off-screen is a changelog.

#### C3 — Lighting and value hierarchy. The underground is coherent and must be protected. VERIFIED.
Ore emits in proportion to value via the per-instance emissive patch ([chunks.ts:27-44](../src/world/chunks.ts#L27)); magma/fluids are the only saturated emissives; the light-count ballast and intensity-only discipline are respected everywhere. Recommended value law, formalized from what the game already mostly does: **EMIT = value or danger only** (ore, fluids, veinlight, creature organs, Warden beam, fragment, flares, the pod's lamp/flames/instrument glow). **LIT = what the player acts on** (rock, pod hull, structures — responding to placed light). **DARK = everything else.** Violations to fix, in order: the Warden/search beam renders as a flat gray cone — a UI overlay, not light — on the game's marquee threat (**VERIFIED** in renders; needs a gradient-alpha additive cone); surface decoration uses danger-red (#ff4d29) on masts/beacons ([backdrop.ts:118-121,285-290](../src/world/backdrop.ts#L285)) — reclaim red for things that cost hull, keep window-warmth as the one sanctioned sentimental glow; ore shop icons are baked brighter than the world ever shows an ore ([icons.ts:29-33](../src/ui/icons.ts#L29)) — acceptable as UI, noted as the boundary case. The pod's never-off instrument glow floor is a cheat and the right one.

#### C4 — Terrain material: the variance claim is technically true and perceptually half-delivered. VERIFIED.
Per-cell tint ±14%, z-jitter, rotation ([tiles.ts:164-166](../src/world/tiles.ts#L164), [chunks.ts:117-125](../src/world/chunks.ts#L117)) — but flat per-cube color only, so topsoil reads as a quilted checkerboard (visible in keeping.png). Two or three per-face shade variants baked into the shared box geometry would deliver the promise with zero new draws or materials.

#### C5 — Motion & feedback: DIRECTION §5 is roughly half-implemented, and the gaps are the loud ones. VERIFIED per item.
Missing: plain rock break — the highest-frequency event in the game — has **no sound and no hitstop** ([main.ts:925-933](../src/main.ts#L925); hitstop and chime are ore-only); the ore value popup rises and dies instead of arcing to the cargo HUD (style.css:199-204), and the cargo counter never pulses; the sell panel's total snaps (only the HUD money ticks); panels close on a zero-frame DOM deletion ([panels.ts:102-106](../src/ui/panels.ts#L102)); crack decals don't exist outside vaults; shake is a constant, not a ramp; no dock camera framing; no dutch. Implemented and fine: landing dust scaled by impact, damage flash/shake/rumble, stratum toasts, reduced-motion discipline throughout (genuinely thorough), the title parallax (though it's a translation bob, not the promised 8° orbit).

#### C6 — UI: disciplined language, a handful of unchosen defaults. VERIFIED.
The token system, one-accent rule, tabular numerals, and panel glass hold almost everywhere — s-garage/s-trade/s-pause read as one designed object. Defaults that were never chosen: keyboard `:focus-visible` is the stock Chromium ring while gamepad focus got a bespoke amber one (style.css:159-172) — an accessibility promise broken in one CSS rule; glass alpha drifts (.78 vs spec'd .82) and an off-spec fourth accent (--violet) exists; the Steam link is a placeholder; and **the fonts load from Google's CDN** — the only non-procedural runtime asset in the project, which silently regresses the entire typographic identity offline/in Electron. That last one is a ship-blocker on the stated Steam path regardless of this review.

### Workstream D — Comparative research (full sourced report in the engagement record; conclusions here)

What survived verification and matters most: **XGen deleted Motherload's invisible gas pockets and said why** ("no way of knowing where they are… frustrating") — and a player in the same thread identified the deeper damage: *an unreadable hazard breaks the upgrade economy, because nobody buys a counter to a threat they can't perceive.* **Subnautica's Cyclops** is a complete shipped template for emission-as-threat-currency: three noise levels with a drawn radius, hostiles turning red when they hear you, Silent Running suppressing 50% for a metered cost, decoys buying a redirect — swap noise for light and it's this game's threat economy with a visible dial. **SteamWorld Dig 2** went fully handcrafted, outsold Dig 1 7.5×, and paid for it in documented replayability loss — the one axis where COREWARD's procedural-only constraint is an advantage, not a limitation. **Dome Keeper** shipped and maintained a No Monsters mode (COREWARD's `Threats: off` is the same, correct call, already made). **Downwell** proved a never-changing avatar can carry a build's worth of progression through what it *emits*; **A Game About Digging A Hole** proved tool tiers can be recorded in the shape of the hole. **The genre's consistent staleness point is the ascent**, and the only fix reviewers accepted was earned capability that removes the trip (Motherload's Hyper-Drive), not checkpoints that shorten it (Super Motherload's outposts, still panned as tedious).

Refuse, with sources in the record: untelegraphed hazards; recall-interrupts that spend the clock on unchosen backtracking (Wall World); a real gun (mechanical grounds — a gun is a way to stop spending the clock, and the clock is the game); unkillable pursuers stacked on fuel (Spelunky's ghost is priced for 3-minute runs, not accumulating cargo); hidden clocks; decorative gauges (Iron Lung's dials survive one playthrough; in a loop, a gauge learned to be theatre burns the channel); player-built travel infrastructure billed in the pressure currency (Core Keeper's four-year traversal war); AI helpers to babysit (Drill Core's loudest complaint); meta-progression as the answer to thin runs (Dome Keeper tried content → modes → meta-shop → seasons → multiplayer and never answered the original diagnosis); cosmetics that can claim alarm colors.

---

## 3. The plan

Ordered by leverage. Standing constraints honored throughout: no new material types (shader warmth), lights change via intensity never `.visible`, surface structure fronts stay z ≤ −0.85, walk-past fixtures behind z −0.3 as single groups, no per-tile work in `Chunk.build`, `tsc` green, art changes get rendered review plates before approval. No save-shape changes anywhere in Phases 1–3 (upgrade visuals derive from existing persisted tiers); the two Phase 4 items that touch persisted state carry migration notes.

### Phase 1 — The Refit (visible progression) · ~5–7 days total

**1.1 `Pod.refit(tiers)` — parametric part system** · 2–3 days · the C2 table, built as teardown-and-rebuild of the lift group with retained part references, called from the `applyKeeping` seam.
Problem: 30 tiers, zero pixels (C1). Risk: low-moderate — cosmetics collision is designed out by the geometry/hue split; draw calls trivial; the one real hazard is silhouette creep breaking the collision-box read (visual assembly must stay honest to POD_W/POD_H). Proof: a new `refit.mjs` producing tier-ladder plates (T0/T2/T5 side-by-side, both distances — the per-pod material clones already permit multi-pod review scenes), plus `pilotlook.mjs` and `hulks.mjs` regression (pod-visual assumptions), reviewed through the structures-review harness per project practice.

**1.2 The garage stages the pod** · 1–2 days · dock eases the camera to a pod framing (the promised 0.3s, replacing the blur scrim for the GARAGE panel specifically); purchase triggers the refit in view with a punctuation beat (flash on the new part, buy sting, brief hitstop).
Problem: the six most important purchases have no staging (C1, B2's "checkout queue" — an event-feeling purchase partially compensates a flattening curve). Risk: moderate — camera changes touch the dock/fold paths (design-review fold-* shots exist as regression baseline). Proof: `shops.mjs` extended with a purchase-frame screenshot; `foldshot.mjs` regression.

**1.3 Emission tiers** · 1 day · drill spark signature per tier (pooled particles, count/spread only); radiator fins glow with the live heat gauge; thruster flame length/geometry bias per engine tier (hue stays cosmetic-owned).
Problem: the only channels that read at 87px are silhouette and emission; this is the emission half (C2, Downwell's lesson). Risk: low; particle budget already pooled. Proof: `refit.mjs` plates at gameplay distance; `visualpass.mjs`.

### Phase 2 — The feedback spine · ~3 days total

**2.1 Rock break: sound + hitstop** · 0.5 day · hardness-pitched percussive one-shot + ~20ms stop (reduced-motion guarded), budgeted against fatigue (it fires thousands of times — needs a variation set and a soft duck under repetition).
Problem: the game's most frequent verb is silent (C5); DIRECTION §5 promises it. Risk: low. Proof: `verify.mjs` drill stage (audio is unverifiable headless — flag for the ear-pass; assert the hitstop).

**2.2 The value loop's spine** · 1 day · ore popup arcs to the cargo corner; cargo counter bumps on pickup; sell panel total counts up with the existing arpeggio.
Problem: C5 — the earn-feedback chain is severed in three places. Risk: low. Proof: `shops.mjs` sell round-trip.

**2.3 Panel exits** · 0.5 day · 160–180ms reverse slide+fade replacing `scrim.remove()`.
Problem: half the promised UI motion language is a browser default (C5/C6). Risk: low. Proof: `pause.mjs`, `shops.mjs`.

**2.4 Keyboard focus ring** · 0.25 day · extend the bespoke `.nav-focus` treatment to `:focus-visible`.
Problem: C6 accessibility promise. Risk: nil. Proof: `contracts.mjs` (settings panel walk).

**2.5 Self-host the fonts** · 0.5 day · bundle Chakra Petch + Space Grotesk woff2, drop the CDN.
Problem: C6 — the only external runtime asset; Electron requirement regardless (PLAN.md Phase 6 already lists it — do it now, it's a review-visible identity risk). Risk: nil. Proof: build + `verify.mjs` offline.

**2.6 Per-face terrain shading** · 0.5–1 day · 2–3 face-shade variants baked into the shared box geometry.
Problem: C4 — the quilt. Risk: low (one geometry change; keep out of per-tile build work per the chunk-budget law). Proof: `depths.mjs` tour plates, before/after.

### Phase 3 — Threat legibility · ~4–5 days total

**3.1 The Stillwalker's dread wash** · 0.5 day · a vignette layer driven by the already-computed `threats.dread`, mirroring the heartbeat ramp; reduced-motion gets a static tint step.
Problem: A1 — the game's only outright Tell failure, and the docs already specify the fix. Risk: nil. Proof: `fauna.mjs` stillwalker stage asserts the DOM layer's opacity tracks dread.

**3.2 Warden detection becomes the beam** · 1.5–2 days · gate `seesPod` on beam-arc + line of sight (the damage path's existing checks, promoted); compensate with a faster sweep or wider arc so difficulty holds; plug `scrutiny` into a screen-edge whitening + rising audio tone; re-render the beam as a gradient-alpha additive cone.
Problem: A2 + C3 — the flagship threat's tell is fictional and its damage meter is unplugged. Risk: moderate — this is a real difficulty change for the carry climb; the climb was verified beatable without the lance and must be re-verified. Proof: new assertions in `phase3.mjs` (lit-but-behind-rock = not engaged; in-arc = engaged) and an `extraction.mjs` carry-climb pass.

**3.3 Polyp dial honesty** · 0.5 day + docs · canonize distance-and-dwell (the code and the toast are right); raise the `|v|` coefficient enough that rushing never *beats* crawling; rewrite THREATS.md's entry.
Problem: A3 — the manual hurts the player who obeys it. Risk: low. Proof: `fauna.mjs` gains a polyp stage asserting slow-pass survivability vs fast-pass burst.

**3.4 Lance: swarms scatter blind** · 0.5 day · flung outward, de-alerted, anchor displaced — never deleted. Mimic kill and Warden blind unchanged. Optional rhyme: a 2s Stillwalker flash-freeze (it's currently the one light creature the light weapon ignores).
Problem: A4 — the single place paying money beats managing light. Risk: low. Proof: new `fauna.mjs`/`phase2.mjs` assertions (the lance-vs-creature matrix is currently entirely untested).

**3.5 Range-gate `flares.brightest()`** · 0.25 day · pursuit target only within ~2× notice radius.
Problem: A6. Risk: nil. Proof: `phase2.mjs` flare-aggro stage.

**3.6 THREATS.md numbers pass + assertion backfill** · 1 day · correct every A5 drift (Kindled, Riptide, brine, swarm per-fly rates, Long One warning text, DIRECTION §8g stale depths, PLAN.md's stale "current state" block); add headless assertions for the numbers the doc stakes its claim on (Long One stillness escape, rimewing settle cycle, brinewyrm sulk, Warden felled window, Kindled EVA cornering).
Problem: A5 — the next person who tunes from THREATS.md inherits the drift. Risk: nil. Proof: the new assertions are the deliverable.

### Phase 4 — Economy honesty · ~4–6 days + a real playtest gate

Everything here is analytically grounded but tuned blind — PLAN.md's ⛩ human gates are still open, and Phase 4's magnitudes should be ratified against one real playtest before locking (the shape of the fixes stands regardless).

**4.1 Make the thruster track real** · 1–1.5 days · `thrustMul` scales `MAX_RISE` (e.g. 14 → ~22 at tier 5) and shaves `FUEL_THRUST` per tier (e.g. −6%/tier). Flame geometry from 1.3 makes the purchase visible the same day.
Problem: B1 (the placebo) and B9 (the ascent — the genre's documented staleness point; this makes ascent speed an *earned capability*, the fix the genre's history endorses). Risk: moderate — faster ascent interacts with the refreeze's ram threshold and fall-tunneling clamps; CRYOS-2 climb needs a check. Proof: a climb-time probe added to `metrics.mjs`; `refreeze.mjs` regression.

**4.2 Rebalance the tank/cargo/depot triangle** · 1 day · cut Cargo 5 (see cut list) and re-point the tank curve so the top tiers price against *deep-shelf trip length* rather than tripling blindly; depots keep their role as the late sink but their rate multiple is re-derived after 4.1.
Problem: B3. Risk: moderate; migration note — owned Cargo 5 refunds at price into Lumens on load (additive save field read, one-time). Proof: `metrics.mjs` earnings probes at each shelf; `shops.mjs`.

**4.3 Fees that can't be dodged by banking** · 0.5 day · death/rescue fee = max(purse-fraction, fraction of the *lost cargo's* value); rescue's 35% tank refill billed at pump price within the same mercy floor.
Problem: B5. Risk: low. Proof: `hazards.mjs` death/rescue stages re-asserted.

**4.4 Contracts indexed to the economy** · 1 day · rewards derived from the depth band's measured hold value (a percentage of a typical haul at the gated depth), not authored constants; the board stays flavor-dead otherwise (see cut list).
Problem: B6. Risk: low. Proof: `contracts.mjs` payout assertions against the derivation.

**4.5 The Extract offer scales** · 0.5 day · ✦300,000 × world multiplier at minimum, and Dispatch frames it against the player's *debts* (the fiction already exists in LORE); honest note: this is palliative — the real repair is B2/B8, and if the late fuel/tension work ever lands, the number should be re-derived then.
Problem: B7 — the ending's temptation must survive contact with the player's bank balance. Risk: low. Proof: `endings.mjs` extract path.

**4.6 Surface the Pyro/radiator fork** · 0.5 day · keep the anti-synergy, state it: forge item copy and the radiator track's garage row disclose the trade ("resist starves the exchanger"), making the game's only build fork a real, legible choice.
Problem: B4. Risk: nil (copy + one tooltip). Proof: `progression.mjs` forge stage.

### Phase 5 — Cuts and docs close-out · ~1 day
Execute the cut list; fix the doc rot (PLAN.md current-state block, DIRECTION §8g depths); remove the dead `HEAT_START_ROW` constant ([config.ts:57](../src/config.ts#L57), never imported); surface A7's undocumented riches (fragment-freezes-Stillwalkers, extraction kills all fauna) through Dispatch lines — they're already built, they just aren't told.

---

## 4. The cut list

1. **Cut the Blink Coil from the forge.** A lateral dash (✦30k opportunity cost) in a game whose economy and identity are vertical; the cheapest forge slot and still the dead one (B-audit table). Its removal sharpens the forge's fiction — every remaining item breaks a *rule*, the dash just breaks a speed limit. Migration note: owned coils refund as one embershard to the stash.
2. **Cut Cargo tier 5 ("Pocket Dimension").** Buys ✦0 on the dives that matter (B3). Five tracks of five tiers and one of four is fine; symmetric trees are a spreadsheet's preference, not a player's. (Refund on load, per 4.2.)
3. **Cut the Deep Array as a separate ✦12,000 SKU.** Its function is duplicated free by emissive ore at every zoom the player actually digs at; fold value-painting into the base scanner as a depth-gated reveal. Information should be cheap; legibility is never a purchase (the game's own scanner-zoom rule, applied consistently).
4. **Cut the lance's swarm deletion** (P3.4 — a simplification, listed here because it removes a capability players may already lean on).
5. **Stop investing in contracts** beyond the 4.4 indexation. No new goal types, no board expansion, no leaderboards until a playtest shows anyone reads the board after hour two.
6. **Cut the Google Fonts CDN dependency** (P2.5). Not scope — but it is the project's one standing violation of its own zero-asset law, and it ships silently broken in Electron.

---

## 5. Deferred

- **The Cyclops-style visible light-radius ring** (drawn detection radius on the survey map / HUD, hostiles turning red when they *hear* your light). The best idea in the research and the right long-term home for the threat economy — but it's a new HUD subsystem, and the Phase 3 legibility repairs must land first to know how much of the problem survives them.
- **A Motherload-style ore-tier = upgrade-tier ladder.** The cleanest known price-legibility device; adopting it means re-deriving every price in config against the eight measured shelves. Do it only if the Phase 4 rebalance plus a playtest shows tier pricing still reads as arbitrary.
- **A surface-recall capability (Hyper-Drive analog).** The genre's proven ascent-killer, deliberately *not* recommended: Act IV's carry climb and the CRYOS-2 refreeze are load-bearing designs built on the ascent existing. 4.1 makes the climb faster and purchasable instead. Revisit only if playtests still flag the ascent afterward.
- **Placed light that digging can knock loose** (shaftlights falling when their tile's support is cut — DRG's flare-gun clause). A genuinely charming mechanic that belongs to a future Keeping pass, not the critical path.
- **Bore-signature progression** (drill tier recorded in the shaft's carved-edge treatment). Reads at any zoom, zero assets — but touches `Chunk.build` per-tile work, which the perf law forbids without careful budgeting. Prototype after Phase 1 proves the refit reads.
- **Crack decals on terrain chew** (DIRECTION §5's promise). The vault system has them; porting to chunks is real instancing work for a moment the chew-shrink already half-sells. After the refit.
- **The title screen's promised 8° orbit, heat shimmer, and dust motes.** Real polish, wrong phase — the title is already the best-dressed screen in the game.

---

## 6. Open questions

1. **Which polyp rule is canon** — distance (code + toast) or speed (docs)? The plan assumes distance (P3.3); if the original speed intent matters, the coefficient rebalance inverts and THREATS.md stands.
2. **Kindled pod-touch: zero damage (code + fauna.mjs) or 40 hull (THREATS/DIRECTION)?** The plan assumes the code is the decision and the docs are stale; the test asserting `hullSafe` suggests this was deliberate. Confirm before P3.6 rewrites the entry.
3. **Is ✦300,000 narrative-locked?** LORE.md gives Extract's temptation moral weight; 4.5 scales it mechanically. If the number itself is canon ("Order 9-1-1"), the scaling needs a fictional wrapper (per-fragment escalation, debt clearance shown as a second line).
4. **Is the veinlight-free shard shelf intentional cruelty or generator accident?** [terrain.ts:152](../src/world/terrain.ts#L152) stops veinlight at row 460; the lore says heat kills it near the core, so it may be deliberate — but README sells the deep bands as carrying "their own lifeline," which is false exactly where it matters.
5. **Real-GPU perf headroom.** Every budget here (+~15 pod meshes, a vignette layer, per-face terrain shading) is trivial on paper; the project has never had a real-hardware profiling pass (AUDIT.md flags it, still open). The plan assumes one happens alongside Phase 1's review plates.
6. **No human playtest data exists** — the ⛩ gates in PLAN.md are still open, and every felt-experience claim in this document (boredom, tension, event-ness) is analytic. The plan is sequenced so Phases 1–3 are safe regardless; Phase 4's magnitudes want one real playtest before locking.
