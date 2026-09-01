# COREWARD — Creative Direction & Experience Canon

Working title: **COREWARD** (rename anytime; single string in `src/config.ts`).
A modern 3D retelling of Motherload: vertical mining, land-based surface base,
dig → sell → refuel → upgrade → dig deeper. Built web-first (Vite + Three.js + TS),
Electron-wrappable for Steam like Cinderfall.

## 1. Core concept — "Dig toward the light"

Every mining game gets darker forever. Coreward inverts it. VEIL-3 is a tidally
locked exoplanet frozen in permanent amber dusk; centuries ago a star fragment —
**the Ember** — sank into its crust. You are the last contract driller of a
decommissioned salvage rig. Depth is not just danger: past the black void veins,
light *returns*. The deeper strata begin to glow. The core is not the darkest
place in the game — it is the brightest. That promise is the hook the whole
art direction serves.

The loop is Motherload's, tuned: fuel is the tension clock, cargo is the
one-more-seam dial, the trip back up is the gamble. The pressure is **need,
not greed** — the system is dying, most people are poor, and drilling is the
dangerous work that pays (see [LORE.md](LORE.md)). Borrowed deliberately:
- **Motherload**: fuel/cargo/hull economy, buildings on the surface, depth-tiered ores.
- **Dig-n-Rig / Dome Keeper**: tactile drilling feedback, block "chew" with hitstop.
- **Terraria**: strata identity — each depth band feels like a *place*, not a gradient.
- **Downwell-style**: milestone toasts and near-miss adrenaline (low fuel heartbeat).

## 2. Visual world

Five strata, each a distinct palette and mood. The vertical journey is a color script:

| Depth | Stratum | Palette | Mood |
|---|---|---|---|
| surface | **The Dusklight Rig** | amber sky, long shadows, silhouetted structures | warm, safe, home |
| 0–120m | **Topsoil / Regolith** | ochre, rust, dust rose | familiar, easy |
| 120–320m | **Slatebed** | cool slate blues, teal ore glints | serious, quiet |
| 320–600m | **The Void Veins** | near-black, bioluminescent cyan/violet fungus | alien, tense |
| 600m–core | **Emberreach** | black rock veined with magma pink-orange, rising glow | awe, danger, payoff |

- **Materials**: matte, slightly rough voxel rock with per-instance color variance
  (no two blocks identical); ores are cut-gem glints that *emit*; magma and gas
  are the only saturated emissives — light is meaning: glow = value or danger.
- **Lighting**: hemisphere dusk + low key sun on the surface; underground, the pod's
  headlamp is the player's only friend until the biolume strata take over.
  Exponential fog tinted per-stratum sells depth without draw distance cost.
- **Depth**: gameplay is a 2D grid rendered fully 3D — cube terrain with a receding
  backwall, parallax rock layers, camera at a slight dutch of perspective so tunnels
  read as carved volume, not a flat sheet.

## 3. Typography & UI color

- Display: wide-tracked industrial caps (Chakra Petch; system fallback) — the
  wordmark reads like stenciled rig equipment.
- UI text: Space Grotesk / system stack. Numbers are tabular.
- UI ink: bone `#e8e2d5` on deep navy glass `rgba(11,16,32,.82)`; accents:
  ember amber `#ff9a3c` (money/CTA), teal `#3ce6c8` (fuel/ok), magma `#ff4d29`
  (damage/danger). One accent per element, never three at once.

## 4. Signature hero (title screen)

The game itself is the hero. On load: the rig at dusk, pod parked on the pad,
heat shimmer, dust motes, slow 8° camera drift orbit. The wordmark COREWARD
tracks in letter-by-letter; beneath it a single line: *"The light you're looking
for is under you."* Mouse moves parallax the camera ±2°. CTA: **DESCEND** —
on click the camera dives with the pod dropping onto the pad, UI irises in,
control of the pod handed over seamlessly — the entrance sequence *is* the tutorial's
first second. Secondary CTA (web build): Wishlist on Steam.

## 5. Motion language

- **Weight**: the pod is heavy — acceleration-based flight, velocity-damped camera
  lag (camera eases toward the pod, expo smoothing ~4/s), landing dust puff scaled
  by impact speed.
- **Drilling**: block "chew" = 3-stage crack decals + shake ramp + particle spray;
  block break = 30ms hitstop + burst. Ore break = brighter burst + chime + value
  popup that arcs to the cargo HUD.
- **UI**: panels slide+fade 220ms expo-out; numbers tick (no snapping); toasts for
  strata milestones. Hover states scale 1.03 + glow. Everything interruptible.
- **Camera**: follow with look-ahead in the direction of travel; zooms out slightly
  with speed; 0.3s ease to shop framing when docked.
- **Accessibility**: `prefers-reduced-motion` kills shake/hitstop/parallax;
  every interaction works keyboard-only; UI contrast ≥ 4.5:1.

## 6. Loop & experience architecture

1. **First load** → hero/title (above). No menus in the way; DESCEND is the only door.
2. **First 60s** → surface: four readable buildings (FUEL, TRADE, GARAGE, ASSAY),
   contextual key hints, dig anywhere below.
3. **Session loop** → dig (fuel drains) → one-more-seam decision (the refill costs more than the trip earned) → surface →
   sell (satisfying tally) → refuel → upgrade (garage: drill, tank, hull, engine,
   cargo, radiator) → deeper stratum unlocked by capability, not gate.
4. **Tension systems** → fuel = clock, hull = mistakes (fall damage, gas pockets,
   magma), rescue = costly bailout that preserves progress but stings.
5. **Milestones** → stratum-entry toasts, depth records, assay lore notes (world
   storytelling in found fragments — the Ember's history).
6. **Endgame stub (v1)** → reach the Ember at core depth → ending beat → prestige stats.
7. **Persistence** → localStorage save seam (Steam-cloud swappable later, same
   pattern as Cinderfall's storage seam).

## 7. Audio direction

All procedural WebAudio (no assets): filtered-noise thrusters, granular drill grind
pitched by block hardness, glassy ore chimes tuned to a pentatonic set (deeper ore =
lower, richer note), sell register ka-chunk, low-fuel heartbeat, stratum drones that
crossfade with depth — amber warmth up top, hollow air in the veins, choral shimmer
near the Ember.

## 8. Content roadmap (locked 2026-08-31)

The ending is a pivot, not a wall. Touching a world's core unlocks the next
layer of the game. Build order: worlds → Ember Forge → EVA → contracts.

### 8a. Dig sites (replayability spine)

The Ember is one piece of a shattered star. The ASSAY dish triangulates the
others; each buried fragment is a new world — a new seed, a new palette, and a
new *rule*, on ~90% shared engine:

| World | Core | Rule twist | Palette arc |
|---|---|---|---|
| **VEIL-3** | The Ember | heat rises with depth (radiators gate it) | amber dusk → rust → slate → void → magma glow |
| **CRYOS-2** | The Glacier Heart | cold instead of heat (same gauge, inverted fiction) + glazed ice: grounded traction is halved; brine-frost pools instead of magma | bone white → glacial blue → indigo dark → aurora green glow |
| **MAELIS-6** | The Pearl | pressure: gas pockets *fling* the pod as well as damage it; corrosive brine drains fuel on contact | storm teal → sea green → abyssal black → pearl-light |

Unlock chain: VEIL-3 → CRYOS-2 → MAELIS-6. Ore values scale ×1 / ×1.5 / ×2.25.
**Progression model: one pod, many worlds** — money, upgrades, cargo, fuel and
hull travel with you; terrain, dug tunnels, wrecks and position are per-world.
Travel from the ASSAY starmap (or the title screen). Same rig on every surface
(the crew airlifts it ahead of you); each sky says where you are.

### 8a2. The Sundering Chart (BUILT) — travel as a place, not a button

Travel lives in a full 3D starmap, opened from the ASSAY office. The fiction
anchor is the dish: the chart is its reconstruction of the catastrophe — the
cracked star remnant (the Sundering) burning at the center, fragment
trajectory arcs reaching out to the worlds that caught the pieces. Each site
is a banded globe painted from its own strata palette with an atmosphere rim
in its horizon light; the current world wears a pulsing teal beacon ring,
core-reached worlds have their fragment glinting in orbit, and unresolved
sites hang as dark masses wrapped in violet static ("the dish is still
listening" — no arc, because the trajectory isn't solved yet).

Interaction is keyboard-first and mirrors the game's grammar: ←/→ select,
E commits, Esc backs out. Selecting eases the camera into a hero framing with
a dossier card (tagline, fragment status, ore yield, surveyed depth, hazard).
COMMIT TRANSIT plays a real departure — camera punch, FOV kick, star streaks,
whiteout tinted to the destination's horizon color — and the world rebuilds
behind the flash. Reduced-motion collapses the transit to a fade. One scene,
one draw pass, all procedural; no assets.

After any core is touched, the GARAGE gains the **EMBER FORGE**: rule-breaking
tech bought with *embershards from cargo* (spend the ore instead of selling it —
a real choice at 10k a shard):

- **Ascent Coil** — drill upward (hold up against a ceiling)
- **Blink Coil** — lateral dash on Shift, no fuel, short cooldown
- **Warp Hold** — C teleport-sells your cargo from anywhere at 75% value
- **Pyro Exchanger** — halves excess heat/cold damage and converts it to fuel

### 8c. EVA (on foot, moments only)

The pilot leaves the pod only at designated interactions — never free traversal:
- **Wreck salvage**: dead pods of earlier drillers seeded through the caves;
  park beside one, EVA on a 45-second oxygen clock, salvage for caches,
  embershards, or found logs. Oxygen out = blackout, wake in the pod, hull fine.
- **The core walk**: the pod stops at the chamber mouth; the last meters to
  every core are walked. The endings are earned on foot.

### 8c2. The Communion (BUILT) — the ending as a rite, not a dialog

The old ending was a proximity check and a panel. The rebuilt ending is the
game's thesis statement, staged in three movements under three laws:

1. **The walk is the cinematic.** The player keeps the stick the whole way.
   Every channel — the choir bed, the fragment's quickening heartbeat and
   pulse, the camera's slow blend toward the fragment, the fog — is driven by
   **distance, not time**. Back away and the entire crescendo recedes with
   you. The camera is only taken at the moment of contact.
2. **Light is liturgy.** The chamber is a carved cathedral (the vault arches
   from a low mouth to a crest above the fragment), lined with sconce
   monoliths that ignite as the pilot passes — each one a rising note on a
   pentatonic scale, so the walk is measured in lights, not meters. Motes of
   slow light fill the air; the fragment wears an orbiting shard ring, a
   breathing halo, and a shaft of glow reaching up the dig.
3. **The touch inverts the game.** Coreward is dark on every screen. At
   contact the frame floods to white tinted by that world's horizon color,
   and the ending text plays as staged typography on the game's **only
   bright screen** — "dig toward the light," paid in full. The stats panel
   is restyled to match: a bone-white epilogue, then KEEP DIGGING drops you
   back into the dark.

Supporting grammar: **the pod refuses the fragment** — inside an unmet core's
chamber a repulsion field shoves the machine away from the center, so it can
only park at the mouth ("THE POD REFUSES — THE LAST METERS ARE WALKED"). The
walk cannot be skipped by clever landing; the sconce procession is guaranteed.
Letterbox bars close in when the rite begins; the HUD and Dispatch step aside;
the O₂ clock stops ("the air is warm — the suit stops counting") so the walk
is the only mechanic left. The white page **waits for the player** — E/Esc
advances one movement at a time (through the touch it jumps to the text, never
past it), so the words are read at the reader's pace, not a timer's. R still
recalls mid-walk and stands the whole rite down. Reduced
motion collapses transforms and shortens the white to a quiet fade. All
procedural — no assets; per-world identity comes free from `ACTIVE.core`,
`ACTIVE.sky.horizon` and `ACTIVE.ending`. The Kindled (§8g) are deliberately
absent until their threat design lands; the congregation of sconces holds
their place. Once a world is ended its sconces stay lit and the fragment
stays a quarter awake — revisiting the chamber shows the rite happened.

### 8d. Expedition contracts (BUILT)

A rotating three-offer board at the trade post; one active at a time. Goals:
depth, haul (lumens earned), specific ore counts, speed runs (wall-clock), and
frugal runs (fuel-capped). Offers are gated by record depth so the board grows
with the player, rewards scale by world multiplier, and a corner HUD tracker
shows progress + the clock. Abandon is always available; lapsed terms are
cleared, never punished twice.

### 8e. Settings (BUILT)

Pause → SETTINGS: master/effects/ambience volumes on separate audio buses,
screen-shake and impact-freeze toggles (stacking with OS reduced-motion), and
an FPS counter. Persisted separately from the run save so preferences survive
NEW EXPEDITION.

### 8e2. Acclimation — why a maxed pod still explores (BUILT)

The problem: arriving on world 2 with an endgame rig, the top 600m is zero
challenge and near-zero reward, so drilling straight past it is correct play
and most of the world becomes scenery. The trap is fixing it by resetting the
player's upgrades, which makes world 1 feel pointless.

The answer: **keep every upgrade, but gate depth behind that world's own
survival rig.** Radiators shed *heat* — they are worthless against cold or
pressure — so each world past the first needs acclimation built from a
material that only grows in **its upper strata**.

- **CRYOS-2** → Rime Salt → Lagged Hull / Brine Jacket / Deep Winter Rig
- **MAELIS-6** → Nacre → Ribbed Shell / Nacre Lamination / Pearl Carapace

Later worlds also bite shallower (hazard starts at row 290 / 200 / 150), so
the gauge forces engagement before the deep pays out. Tier 1 is ~10 minutes of
shallow work, and a good radiator tier discounts the cost by up to 30% — prior
investment is credited, never confiscated. Dispatch explains the swap on
arrival so it never reads as an arbitrary wall.

### 8f. Survey scanner tiers (BUILT — per dig site)

- **Survey Scanner** (✦1,500, assay office): TAB map of tunnels/caves/fluids,
  revealed only to your deepest row per world. Four zoom steps (full column →
  ×4 close-up) via + / − or the scroll wheel; zoom is free, because legibility
  is never a purchase.
- **Deep Array** (✦12,000, scanner upgrade): the map reads *value* as well as
  voids — every ore deposit painted in its own color. That is the upgrade worth
  paying for.

### 8g. Threats & the light arsenal (APPROVED, not yet built)

Narrative canon lives in [LORE.md](LORE.md). Design law for this track:

> **The pod is a digging machine. If it becomes a gunship, the game dies.**

Enemies are *pressure with agency*, never encounters to clear. The verbs stay
dig / flee / manage light, a silent run is always viable, and **every threat and
every counter is made of light** — the game's own substance.

**The grammar:** every world shares the same threat structure — a *swarm tier*
keyed to something the pod emits, a *hunter tier* that contests your
excavation, and *desperation bait* — lures that prey on a driller who can't
afford to pass up a seam. But **each world's rule-twist generates its
fauna**, so the organ a threat keys on rotates per world: VEIL-3 reads your
LIGHT, CRYOS-2 reads your HEAT, MAELIS-6 contests your SPACE. Learn the
language once, then learn each world's dialect. Two threats are deliberately
constant everywhere — Wardens and the Kindled — because they are not ecology.
They are the Lamplighters', and their sameness across worlds is lore.

**VEIL-3 — threats key on LIGHT:**
- **Glimmerflies** (Slatebed, ~200m) — swarm drawn to the headlamp; chew hull,
  drain fuel. Counter: *kill your lamp* and go blind. Teaches the central
  lesson cheaply and early.
- **The Long Ones** (Void Veins, 320m) — segmented burrowers that hunt by
  vibration **through the player's own tunnels**, fast in open shafts, unable
  to turn in tight ones. Your excavation becomes the threat; how you dig
  changes permanently.
- **Geode mimics** (Void Veins) — an ore vein that hatches when cut.

**CRYOS-2 — threats key on HEAT:**
- **Rimewings** (swarm) — clusters frozen mid-air, dormant until the pod's
  thruster wash thaws them. Counter: *cut your engine* and drift past cold —
  the world-2 inversion of the lamp lesson.
- **Brinewyrm** (hunter) — swims through cryobrine pools and flooded galleries
  the pod can't enter, surfacing to strike. Standing brine becomes dangerous
  twice over.
- **Stillwalkers** (special) — figures visible *inside* translucent ice, which
  move only while your lamp is off. The habit VEIL-3 taught you, punished
  situationally. Rule collision is the point.
- **Frostbloom mimics** (desperation bait) — fake veinlight on a world where
  veinlight is life.

**MAELIS-6 — threats contest SPACE:**
- **Pressure polyps** (swarm) — wall-clinging sacs that inflate as the pod
  nears and burst with the world's gas-fling force. Living mines; pop them
  from range with a flare, or thread them slowly.
- **The Riptide** (hunter) — something vast in the flooded systems that is
  never seen whole. It doesn't touch you; it *pulls* — current drags the pod
  toward brine and darkness, and the fight is against the stick.
- **Shellbacks** (special) — armoured crawlers that seal tunnels behind them
  with nacre. Not attacking: **repairing**. The Pearl's defense made ambient —
  the world heals its wound while you're inside it, and the way home can close.

**The husk world (planned)** has no fauna at all. Everything that keyed on
light, heat, or space died with its fragment. The threat is that nothing comes.

**Constants on every world:**
- **Wardens** (Emberreach, 600m) — Lamplighter machines still guarding the
  vault. Slow, armoured, sweeping light-beams; they track by luminance. Not
  evil — doing their job, which makes the player the thief.
- **The Kindled** (core chambers) — half-light shapes, non-hostile, lethal to
  touch.

**The arsenal — light-first, gun-last:**

1. **Lamp toggle** — free, instant, the highest-tension mechanic in the game.
2. **Flares** — cheap consumables that throw light elsewhere: pull aggro, scout
   a chamber.
3. **The drill** — already a weapon. Holding ground and cutting through
   something as it closes needs no new system.
4. **Seismic charges** — mid-game purchase; clears rock *and* collapses a tunnel
   behind you. Driller-authentic escape, not a gun.
5. **Lumen Lance** — late Ember Forge tech, the only true weapon, and it **fires
   Lumens as ammunition**. Shooting spends money, so the economy stays inside
   the combat and the Lance stays a last resort.

### 8i. Act IV — the husk, extraction, the three endings (BUILT)

Full spec: [SPEC-PHASE4.md](SPEC-PHASE4.md). The shape in brief:

**SITE 297** appears on the Sundering Chart once two cores are met — a
resolved signal with no fragment arc, because the fragment is already gone.
Not a dig site: slag to the mantle, no fauna, no drone (the game's first
silence), a sky with no sun, and an intact Cindral colony with the lights on
and nobody home. Three walk-to readables end at a survey office holding a
contract with the player's own terms on it. Walking all three unlocks Act IV.

**Extraction** is the Communion's dark mirror, and never available at a first
meeting — the rite stays pure. After the husk, Dispatch relays Cindral's
Order 9-1-1 (✦300,000 a fragment, all debts cleared), which then stands at the
trade post forever. At a met core, HOLD E takes the fragment: sconces gutter
out one by one on a descending scale, the choir inverts to minor, and there is
no white page — you do not get the bright screen for this.

**The climb is systemic, never scripted.** One `carrying` state that existing
systems read: the hold is the fragment (nothing else fits), thrust ×0.8 and
fuel ×1.5, a slow heat clock, Wardens waking at every ruin band and tracking
the fragment's light (the dark no longer hides you *from them*), veinlight
dying in a radius as you rise, quakes shedding rubble into the tunnels
*below*, and the fog draining toward slag from the bottom up. Carrying one
back **down** is calm — no Wardens, no quakes. The world knows the difference
between a thief and a lamplighter, and that asymmetry is the argument.

**Three endings, earned by disposition of the fragments, never by a menu:**
EXTRACT (sell all three) is the game's only *black* page — "OUT", the rig
under an empty sky, and it must read as a real win; RETURN (all three cores
met, all three seated home) comes up as **dawn**, amber finally turning gold,
with the debts pointedly unchanged in the stats; KINDLE (9/9 glyphs + 12/12
logs + the full forge, all three laid in VEIL-3's cradle) burns past white to
a new star, and ends on an empty contract board. An ending stamps a permanent
emblem on the title screen and then offers CONTINUE — THE MOMENT BEFORE, which
rewinds to the fork so one save can walk every road.

**The Lumen Lance** joins the forge at 9 shards: X fires, each shot spends
✦120, and it blinds rather than kills — swarms vaporize, hunters stagger,
Wardens overexpose for 6s. The climb is beatable without it, verified.

### 8h. Deferred (next)

- **EVA grapple hook**: climb walls the jump can't clear, opening real on-foot
  exploration (today the R recall + oxygen clock are the safety net).
- Hollow-world gravity flip (fourth site candidate), pod cosmetics.
- Key rebinding; leaderboards for contract speed runs.

## 9. Performance & quality bar

60fps mid hardware: instanced chunk rendering (16×16 chunks, rebuilt only on edit),
one draw call per chunk per material class, capped particle pool, no per-frame
allocation in the hot loop, DOM HUD (not canvas text). `tsc --noEmit` green before
any "done". Verify headless (Playwright + SwiftShader recipe from Cinderfall).
