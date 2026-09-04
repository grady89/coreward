# SPEC — VAULTS, THIRD PASS · nine rooms worth the walk

Status: **PLAN — 2026-09-02.** The second pass ([SPEC-GLYPHS.md](SPEC-GLYPHS.md))
made the vaults real levels; this pass makes them the reason people talk about
the game. Grounded in the research set (precision / grammar / atmosphere docs)
and in source: [src/game/vault.ts](src/game/vault.ts),
[src/world/vaults.ts](src/world/vaults.ts). Cited inline as (precision §n),
(grammar §n), (atmosphere §n). Harnesses that must stay green at the end of
every phase: `node scripts/vaults.mjs`, `node scripts/vaultfit.mjs`.

**Design laws carried forward, still binding:**
- Shown, never told. No tutorials, no cutscenes, no tooltips.
- Every threat and every counter is made of light.
- Fully optional; no economy inside; failure costs repetition only.
- Saves never break; every new field is additive with a default.

One new law for this pass:

- **The fiction pays for everything.** Every mechanic ships with one line of
  Lamplighter craft in the legend comment — what they built, and why. A
  mechanic nobody can explain as guild-work does not go in the kit.

---

## I. Design pillars

A pillar without a lint rule is a wish. Five pillars, five rules; the rules
land as harness checks in §VII.

**P1 — One breath of light.** The spark is the only scarce thing, and every
obstacle is a question about it (precision §2.5). *Rule:* the legend in
[src/world/vaults.ts](src/world/vaults.ts) classifies every kit element by its
spark relationship — **demands / forbids / refunds / steals / clocks /
shapes** — and an element that earns no classification is cut or converted.
`vaults.mjs` asserts the classification table is total over the parsed kit.

**P2 — Dark hides floors, never fangs.** Darkness is content, not obscurity
(grammar §1.4, atmosphere §2). *Rule:* inside any `d` region, every hazard
volume (stud, shuttle rail, censer arc, crusher throw, beam cone) is
self-luminous or carries a visible track; what the lamp finds is geometry
only. `vaults.mjs` gains a lint that intersects hazard volumes with dark
tiles and demands the emissive flag.

**P3 — Legible before committed, cheap after failed.** The player sees the
whole question before answering it, and a wrong answer costs under a second
(precision §4.1–4.2). *Rule:* every vault is partitioned into camera-locked
chambers ≤ 22 columns with a sconce at each boundary; gutter-to-control is
≤ 0.9 s with a camera **cut**, never a pan. `vaults.mjs` measures both.

**P4 — The climax recombines, never introduces.** Ketsu is density of the
known, not novelty (grammar §5.1). *Rule:* each vault's final chamber
contains zero element types absent from that vault's earlier chambers, and
no sconce. Scriptable: `vaults.mjs` diffs the element census of the last
chamber against the rest of the map.

**P5 — The spark corrects; the legs travel.** Coreward's dash is *shorter*
than its jump — the inversion is the identity, not a bug (precision §0.2).
The spark buys the last two tiles, the redirect at apex, the escape — never
the whole crossing. *Rule:* every required gap is authored against the jump
(≤ 3 tiles clean, 4–5 with the spark); no required chain ever needs two
sparks without a refill between them. `vaultfit.mjs` grows a reach model
that walks each map with (jump 2.8, spark +2.1, one charge) and proves the
golden path.

Resolving the three tensions the research surfaced:

- **Dark-as-content vs legibility** → P2. The rim-light lattice (§VI) makes
  standable stone readable two tiles past the lamp; hazards are the *holes*
  in the lattice. Dark rooms become a perceptual skill, not a memory tax.
- **Spark as correction-verb** → P5. We do not lengthen the dash to make it
  Celeste's. A 2.1-tile spark at 3.9× walk speed reads as a violent, precious
  spike (precision §0.3) — that is one breath of light, exactly. The whole
  juice budget goes to that frame instead (§II.3).
- **No-death repetition vs flow** → P3 plus the record of failure. Retry is
  sub-second, and every gutter leaves a spent-wick smudge that persists for
  the session (atmosphere §1.4) — repetition becomes the story the room
  tells about you, in the same visual language as the standing dead.

---

## II. The move set

The final verb set: **walk · jump (variable, buffered, coyote) · wall-slide /
wall-jump (free, always descending) · the spark (one, 8-way, correction
length) · fast-fall (new)**. Nothing else. No hover, no glide, no double
jump. The austerity is the identity (atmosphere §1.3).

All constants live in [src/game/vault.ts](src/game/vault.ts). Changes, in
build order, with cost and what each unlocks:

| # | Change | Where | Hours | Unlocks in level design |
|---|---|---|---|---|
| F1 | **Head-bonk corner correction** — up to 0.3 tiles of horizontal nudge when rising into a solid corner, only if the jump would otherwise have failed (precision §1.4, §1.9) | collision resolve in `vault.ts` | 2–4 | 1-tile slots and stud chimneys become fair; THE WICK's chimney and every Act III shaft depend on it |
| F2 | **Spark corner correction + floor snap** — ±0.35 tiles vertical pop when a horizontal spark clips a ledge lip; snap to floor on a downward spark within 0.35 tiles (precision §1.5) | dash resolve | 2–3 | Sparking onto ledges in the dark; a spent spark never dies to a pixel |
| F3 | **3-frame world freeze on spark ignition** (precision §5.1) | update loop + fx | 1–2 | Most of the spark's perceived weight; the 2.1-tile dash reads as an event |
| F4 | **Half-gravity apex band** — while jump is held and \|vy\| < 2.0, GRAV × 0.5; yields a ~0.3 s crown (precision §1.3) | integrator | 1–2 | A readable window to aim the spark at apex — where every spark decision happens |
| F5 | **Spark direction latch** — 3-frame window after press in which a direction re-aims the dash; 8-way snap already exists | input | 1–2 | Kills "I sparked into the floor" on keyboard |
| F6 | **DASH_KEEP 6.5 → 8.0**, decaying to walk speed over ~0.25 s (precision §2.2) | constant | 0.5 + retune | Spark-into-wall-jump and spark-off-censer chains; the long-tail tech |
| F7 | **Fast-fall** — hold down: MAX_FALL 13 → 18 (precision §2.1) | integrator | 1 | Compresses THE LAST SHIFT and THE EMBER for repeat runs; makes tall rooms expressive |
| F8 | **Buffer/coyote audit** — jump buffer survives wall-touch and dash-end and is consumed-not-refired; coyote granted after wall-jump and after re-form (precision §1.1–1.2) | state machine | 2–3 | The tight inputs (spark → instant wall-jump) stop feeling dead |
| F9 | **Wall-jump generosity** — register within 0.4 tiles of the wall; horizontal component applied up to 5 frames late (precision §1.6) | wall check | 2–3 | Wall-jumps become unfumbleable, so the spark stays the only scarce thing |
| F10 | **Retry economics** — control returns the frame re-form begins; camera cuts to the sconce instantly; total gutter-to-control ≤ 0.9 s (precision §4.2, §5.6) | reform phase + [src/fx/camera.ts](src/fx/camera.ts) | 2–4 | Halves the *felt* difficulty of every hard chamber without touching one tile |
| F11 | **Camera-locked chambers** — `chambers?: number[]` per def (column splits); camera frames one chamber, cuts at boundaries | def + camera | 4–8 | Full legibility before commitment at a 3.6 t/s walk; chambers become independently deletable during iteration (precision §4.1) |
| F12 | **The body is the meter** — spark charged: the suit glows and throws light on nearby stone; spent: a silhouette in a darker room (precision §2.2) | suit fx | 3–6 | The resource readable in peripheral vision; in THE KINDLED, the meter *is* the visibility |

Total: roughly **22–40 hours**, all before any room is authored, because every
one of them changes what a gap costs.

### Positions taken against the research

- **Held sconce commit — REJECTED.** (atmosphere §1.1 proposes a 0.6 s
  interruptible stillness to light a sconce.) In a sub-second-retry game the
  checkpoint is the exhale, and taxing the exhale fights P3 head-on; a
  stillness cost on every checkpoint is a retry-time tax wearing a robe. We
  keep the *reaching* cost instead: Act III places sconces inside hazard
  windows (a beam's cone period, a censer's arc), so affording the checkpoint
  means reading the room — the same lesson, paid in skill, not in waiting.
- **Freeze frame on refill — SOFTENED.** (precision §5.1 suggests 4 frames
  when a sconce relights the spark.) Mid-air refills happen mid-route in
  chains; a freeze there interrupts the very flow the chain exists to
  produce. Refill gets the flash, the intake sound, and one frame of hitch
  at most. Freeze belongs to spending, not receiving.
- **Walk speed — UNCHANGED.** 3.6 t/s is slow in body-lengths (precision
  §0.1) and that is correct: the driller is a miner out of the pod, not an
  acrobat, and the tombs are funereal. The fix is structural, not
  physical — F11 chambers kill scouting-by-walking, F7 fast-fall kills
  descent boredom, and no chamber's flat walk exceeds ~8 tiles between
  decisions (a lint in §VII).
- **Dash length — UNCHANGED.** See P5. Authoring against the jump keeps
  every gap readable as arithmetic; a longer dash would collapse the routing
  puzzle into an aim test.
- **Ghost-trail replay threads — DEFERRED** (precision §6.10). The spent-wick
  decals ship (cheap, same payload); the light-thread replay is polish for a
  later pass. The `reforms` counter already exists and the completion card
  already reports it — reframe the line as light spent, not failure.

---

## III. The obstacle vocabulary

### The final kit

Every element with its spark relationship (P1), what it tests, its
telegraph, and its fiction. **New** items marked ▲; behavior changes marked
△. Nothing is cut outright — the second pass kit was lean — but two elements
change category and one is demoted (below).

| Element | Spark | Tests | Telegraph | Fiction |
|---|---|---|---|---|
| Dry stone floor | **refunds** (grounding) | routing — where you may re-arm | material read: warm stone vs glassy dead surface | the guild's own masonry still holds a working charge |
| △ Dead surface (non-refill floor) | **withholds** | spark budgeting; safe-but-dry traversal (precision §2.3) | matte, rimless, colder hue | stone the famine drank |
| Sconce, unlit | **asks** | the wager — spend position to buy a checkpoint (grammar §5.2) | the cup, the faint positional breath (atmosphere §5) | a light waiting for its keeper |
| Sconce, lit | **refunds + saves** | nothing — it is the relief | the chord (§VI) | the shift resumed |
| Famine sconce (`deadLight`) | **saves only** | economy inversion | cracked cup, guttering blue-white flame (atmosphere §3.4) | it remembers you; it has nothing to give |
| ▲ Brazier `*` | **refunds mid-air** | chain construction; the author's refill brush without checkpoint inflation | a hanging basket, embers rising | ductwork the guild never turned off |
| ▲ Mote `o` | **shapes** (no mechanics) | nothing — it is the language: arc-tracing, safe-drop signal, edge-marking in dark (grammar §4.1) | a drifting fleck of the world's hue | spilled light, still falling |
| Unlight stud `X` | **shapes** | aim — the walls of the spark's solution space | zero rim; a hole in the lattice (atmosphere §2) | where the dark bit through |
| Beam (sweep/spin) | **forbids** while lit on you | patience, cover reading | the cone itself; introduced **parked** (grammar §1.3) | the Wardens' grammar in miniature — watch-lights still on rounds |
| Light bridge A/B | **clocks** | binary rhythm — phase, not duration (grammar §2) | 0.35 s warn flicker, on the pulse | floors the guild could afford only half the time |
| Rime shelf | **demands commitment** | hesitation cost; regrow makes it a cycle — one behavior per room, never both (grammar §2) | crack lines spread on footfall | young ice over old work |
| Shuttle | **clocks** | timing of crossings; rails drawn visibly even unlit (grammar §2) | the rail, always rendered | bolts still walking the wire |
| △ Censer | **clocks / refunds position** | rhythm, and now conversion: the lantern is standable at swing apex — dual purpose (grammar §1.5, §2 "enemies-as-platforms") | chain, arc smoke-trace; its light sweeps dark zones as it swings | ride the lantern the way the keepers did |
| Crusher | **demands nerve** | stop-and-go precision; ≥ 5 tiles approach buffer (grammar §4.2) | slow extend, fast return — asymmetry is the tell | pistons that never got the order to stop |
| Pursuit wave | **demands everything** | mastery under a clock; contains zero novel mechanics by rule (grammar §2) | its leading edge *lights the room ahead of it* — fleeing is also seeing (grammar §1.5) | the dark, arriving |
| Wind — gust | **fights** | arc reading under force | mote streamlines, audible cycle | weather, which is everything on a surface |
| △ Wind — current ▲ | **carries** | route selection; the generosity object (grammar §2 "springs") | a visible rising mote column, distinct color temperature | the updraft of the deep vents |
| Gravity zone | **reframes** | re-reading the whole vocabulary (grammar §2) | motes fall the zone's way *before* the boundary | space is MAELIS-6's organ |
| ▲ Snuffer | **steals** | protecting a charged spark; non-lethal — it takes the light and leaves you standing (precision §3.3) | a slow dark moth, wings rimmed in un-color; introduced asleep on a wall | what the famine made hungry |
| ▲ One-way gate | **commits** | nothing — pacing; makes a descent a decision (grammar §2 "one-way gate") | a falling curtain of light you pass through downward; solid from below | the vault keeps what enters |
| Door `1` `2` | **prices sconces** | route completeness | masonry veined with the count | arithmetic, not a lock |
| Figure `K` | — | — (story) | posture grammar (§VI) | the ones who stayed |
| Master stone `M` | — | — (the payoff) | the single lit thing (atmosphere §6) | the word itself |

### Cut, and why

- **Reflectors** (precision §3.3) — a tenth noun the nine rooms don't need;
  spark-redirect puzzles belong to a future opt-in deep-vault layer
  (precision §4.4), where mastery is the contract.
- **Strobe/projectile beams** (grammar §2) — the beam family already owns
  the rhythm category; a firing hazard is off-theme and off-budget.
- **Drift-glass / dream-plates** (precision §3.3) — consumed-and-returned
  dashes are Celeste's signature move; borrowing it would read as quotation,
  not craft. The censer-ride is our conversion object instead.

### The beat clock

Adopted, globally (grammar §3). One **pulse = 0.85 s** per vault (overridable
per def, `clock?: number`). Every cyclic hazard's period is an integer
multiple of the pulse: light bridges 4 (the current 3.4 s survives
unchanged), censers 3, shuttles 2–4, crushers 3–4, spin beams 4–8, wind
calm/gust 4/3. Phases quantize to quarter-pulses. A room stops being four
independent timers and becomes one groove — the highest-leverage change
available to the existing kit, and it is data, not code. `vaults.mjs` lints
the ratios.

### Authoring deltas

New map chars `o` (mote), `*` (brazier) in the parser
([src/world/vaults.ts](src/world/vaults.ts) `parseVault`); snuffers as
`ShuttleDef` entries with `snuff: true`; one-way gates and currents as def
arrays (rect + direction), like pursuit. `vaultfit.mjs`'s AIR set gains the
new chars. Kit build cost: **18–30 hours** including fx.

---

## IV. The nine rooms

Nine rooms, nine names, the three-act fiction untouched. Room count stays
nine — the acts are a sentence with nine words and the codex is built for
them; nothing in the rework needs a tenth.

Register scheme (grammar §6): within each act, one **teach** (Mario
playground), one **test** (Mega Man lesson), one **exam** (DKC escalation) —
and the acts themselves ramp, so Act III's teach is still harder than Act
I's exam. Ramp shapes are assigned per room below, not by formula, and two
deviate from the 1-4-7 pattern where the room's nature demands it.

Layout invariants for every map (grammar §6, §4.2): ≥ 3 clear tiles at
entry; ≥ 4 clear tiles after any sconce before a danger volume, ≥ 5 before a
crusher; no flat walk over 8 tiles without a decision; motes mark every
required arc, every safe drop, every shelf edge in dark; the last chamber
rhymes geometrically with the first, taken at speed.

---

### 1 · THE WICK — *"we were maintenance"*

**One idea:** light is the economy. Stone refills, sconces refill and save,
the spark buys the last two tiles. **Shape:** a rising left-to-right hall
into a chimney into a reveal — the only room that ends *above* where it
began. **Ramp:** Mario playground. **~56 × 32, four chambers.**

- **Ch A (cols 0–13), threshold:** lit sconce at col 2, flat stone, one hop.
  A mote arc traces the first jump. Nothing can hurt you.
- **Ch B (14–30), the teaching gap:** a 4-tile gap over a *visible, shallow*
  stone basin — jumping short drops you 3 tiles onto walkable floor with
  steps back up; failure costs five seconds and teaches the spark by
  inevitability (grammar §1.6): the gap is obviously *slightly* too far, the
  spark is the only verb left, motes draw the dash arc. Then the dry-stone
  islands: a stretch of dead surface with two stone islands — you may stand
  anywhere, you may only re-arm on stone. Two islands and three gaps is
  already a level (precision §2.3). Sconce at the boundary.
- **Ch C (31–44), the mid-air relight, as a playground:** a 7-tile crossing
  with an unlit sconce hung in the middle of the air. Jump, spark to its
  ring, it lights under you, the spark catches again, spark on. Two valid
  routes the whole chamber: the high sconce-chain line and a low walk
  threading three studs — self-directed difficulty (grammar §4.3).
- **Ch D (45–56), the wick itself:** the wall-jump chimney, studs forcing
  wall changes, light thinning as you climb — then the mouth, and the **awe
  beat #1** (atmosphere §6): the camera lets go into a wide upper hall, the
  master stone lit *from above*, a light direction Act I never uses again.

Key screen, Ch B (the teaching gap — `o` motes, basin under the gap):

```
#............................#
#..S...........o.o...........#
#.......o..o.o.....o.........#
#.####.o..............####...#
#.####................####...#
#.####....########....####...#
#.####....########....####...#
#.#################...####...#
```

**Sconces:** entry-lit + 3, every ~12 columns — teach register.
**Figures:** one, kneeling at the chimney base, lamp-arm raised toward the
climb (posture names the route). **First-clear target: 60–80 s.**

---

### 2 · THE FAMINE — *"every lit thing became a spent thing"*

**One idea:** light does not come back. `deadLight` sconces, and the
**snuffer** — the famine embodied, a slow dark moth that takes a charged
spark and leaves you standing. **Shape:** a shallow W — down, up, down, up —
so every walk-back after a theft is short. **Ramp:** Mega Man.

- **Threshold:** the act's one honest lit sconce, its cup already hairline-
  cracked. From here on every cup is cracked through and burns blue-white.
- **Ki:** a one-spark gap to a sconce that saves you and gives *nothing* —
  the player sparks, lands, presses on, and discovers the spark did not
  return. One failure teaches the economy (grammar §5.2).
- **Shō:** two dry runs sized exactly to one spark plus a landing; the first
  snuffer sits **asleep on a wall over safe floor** (grammar §1.3) — walk
  near, it wakes, drinks your spark, and you walk back to stone eight tiles
  behind. Cheap, legible, complete.
- **Decision sconce** (unlit, dead): mid-map ledge with a sightline into the
  twist. Lighting it buys place, not power. The wager is honest.
- **Ten:** a snuffer patrolling the *only* stone island on a dry crossing —
  re-arming means timing the island against the moth. The refill point is
  the dangerous point: the famine's thesis as a routing problem.
- **Ketsu:** a stud corridor with two snuffers, crossed on one spark held
  the whole way — density of the taught, nothing new.

**Sconces:** entry + 3, all dead. **Shuttles: moved out of this room** (they
debut in THE VAULT, §IV.4, where the fiction owns them) — the famine keeps
its vocabulary starved, which is the point. **Figures:** one, curled around
an empty lamp. **First-clear: 75–100 s.**

---

### 3 · THE LAST SHIFT — *"a shift ends when it is relieved"*

**One idea:** watched light — spinning beams and cover. **Shape:** a pure
three-storey descent, the only strictly-downward room in Act I. **Ramp:**
DKC escalation — each storey the same question, faster and barer.

- **Storey 1:** beam parked, pointing away, over a wide landing with three
  standing stones. It starts to spin as you cross its cone the first time —
  the "asleep" introduction, free with light (grammar §1.3).
- **Storey 2:** spinning at 6 pulses, two stones. A mote column marks the
  safe fast-fall line between storeys — fast-fall (F7) taught by the
  furniture.
- **Storey 3:** 4 pulses, one stone, and the drop rimmed with studs.
- **The grate:** on the last landing, a floor grate with **violet glow far
  below** — Act III visible, unreachable, unexplained. Withheld-then-granted
  across acts (atmosphere §6.3); it pays off in THE DEBT.
- **Exhale + coda:** the bottom hall, wide and quiet — the act's authored
  exhale room (atmosphere §4) — with one censer swinging slow across the
  final approach: the censer's debut, safe, read at leisure. Four seconds of
  true silence before the last cover run (atmosphere §5) — Act I's one
  silence. Then the master.

**Sconces:** entry + 2 (one per ~1.5 storeys — test register tightening).
**Figures:** two on the storeys, backs curled to the emitters (posture names
the hazard); a third at the grate, looking *down*. **First-clear:
90–110 s.**

---

### 4 · THE VAULT — *"a room the fire cannot leave"*

**One idea:** the metronome. Light-bridge floors on the pulse, doors priced
in sconces, and the shuttle debut — the fire's own wardens, bolts patrolling
the room that keeps it. **Shape:** one keep, climbed from inside,
**nonlinear**: Act II's playground is a lock you may pick in any order.
**Ramp:** Mario — route choice as generosity.

- The central door column `1` (2 sconces) splits the keep; door `2`
  (3 sconces) seals the master's gallery. Four sconces exist; one is
  optional and hard — over a shuttle run, for players buying slack.
- **Ki:** one A/B bridge over safe floor; stand on it, feel the warn
  flicker, drop, climb back. The pulse becomes audible here for the first
  time — a low tick the whole room moves to (grammar §3).
- **Shō:** bridge stairs — A up to b up to A — reading phase, not duration.
- **Ten:** bridges as *ceiling*: a crawl under a b-group that is solid half
  the time — A/B as geometry you stand under, not on (grammar §1.1: same
  noun, changed structural role).
- **Ketsu:** the gallery climb — bridges, one threading shuttle, everything
  on one pulse, no sconce inside.

**Sconces:** 4 (3 required). **Figures:** one, seated against the door
column, facing the count. **First-clear: 90–110 s.**

---

### 5 · THE EMBER — *"a seed is a promise made to soil"*

**One idea:** commitment. The pursuit descent — and the **one-way gate**
debut, so the commitment is architectural before it is chased. **Shape:**
a single tall shaft, ~46 × 44, the deepest room in the game. **Ramp:** DKC —
the register deviates from the 2-5-8 formula because a pursuit room *cannot*
cool down (grammar §2: pursuit sections contain zero novel mechanics after
their arming).

- **Top third:** rime alone, no wave — crumble-and-regrow taught as rhythm.
  This room's rime is the *cycle* behavior; THE WEATHER's trap shelf (§IV.6)
  is the one-shot, and the two never mix in one room (grammar §2).
- **The gate:** a curtain of falling light across the shaft. Motes stream
  down through it. You drop through; it will not pass you back. The room
  says what planting means before anything hunts you.
- **The wave:** trigger two screens below the gate. The wave's leading edge
  lights the shaft ahead of it — fleeing is also seeing (grammar §1.5). Rime
  density rises; two side pockets hold **braziers** (their debut — the
  refund object arrives exactly where a missed refill would otherwise mean
  the whole shaft again) and the mid sconce, each costing a sideways detour
  the wave taxes.
- **The seed:** the calm pocket. The wave breaks against the seed's light
  ring and drains away. **Awe beat #2:** the single lit thing in a black
  frame (atmosphere §6.2) — the master stone as the ember itself, and one
  figure kneeling before it, the planter, the room's only `K`.

Key screen (the gate and first pocket; `!` the curtain, `R` rime, `*`
brazier):

```
####.....o.....####
####....!!!....####
####...........####
####..RRR......####
####........RR.####
####.RR........####
##.............####
##.*.....RRR...####
##.S...........####
####.....RR....####
```

**Sconces:** entry + 1 (the pocket). **First-clear: 100–130 s.**

---

### 6 · THE WEATHER — *"depth is the only calm"*

**One idea:** wind — and the room *enacts its own glyph*: a storm crossing
on the surface, then a descent where the wind dies with depth and the master
waits in still air. **Shape:** over-and-down, an L walked right then down.
**Ramp:** Mega Man.

- **Ki:** the gust cycle between shelters (4 pulses calm / 3 gust), taught
  on flat ground where a gust only slides you.
- **Shō:** shelter runs with real drops; the censer returns *in the wind* —
  its arc skewed by the gust, two clocks read at once.
- **Ten:** the **current** — a visible rising mote column that carries you
  over an unjumpable gap. Wind was the enemy; now one wind is the road. The
  carrier and the fighter are visually distinct objects (grammar §2).
- **The trap light:** on the eave line, a lit sconce on the obvious dash
  line — and the shelf under it is one-shot rime. Light is information, not
  permission (atmosphere §2): the room's one lethal-lit-thing, and the
  Act II silence (4 s) falls just before the first gust corridor.
- **Ketsu:** the low eave crossed flat-out under gust pressure — pure
  execution of the cycle, then the turn downward: three quiet storeys where
  the force fades per row, the ambience thins, and the master stands in the
  first still air of the act.

**Sconces:** entry + 2 + the trap. **Figures:** two braced together behind
the last shelter, facing away from the wind. **First-clear: 100–130 s.**

---

### 7 · THE DEBT — *"this is not a lock, it is arithmetic"*

**One idea:** rotated gravity, taught honestly — and its mirrored crushers
are one system with it: the same period, opposite phase, both sides of the
ledger paid. **Shape:** a mirrored diptych sharing a wall, readable as one
symmetric figure. **Ramp:** Mario-teach at Act III weight.

- **Antechamber:** the violet glow from THE LAST SHIFT's grate, arrived at —
  recognition, three levels later (atmosphere §6.3). Motes fall *sideways*
  past the boundary before you cross it; the dialect is shown before it is
  entered.
- **Left cell:** down-gravity ledge climb, wall crushers on the pulse.
- **Right cell:** the same climb *inverted* — gravity up, the crushers
  descending out of what your body calls the floor, phase-shifted a half
  pulse. The mirror is the lesson: everything you did, re-read upside down.
- **The door:** one sconce lit under *each* gravity. The camera pulls wide
  once, when both burn — the diptych seen whole.
- **Ketsu:** the crossing over the shared wall's top, gravity flipping at
  the seam, both crusher banks interleaved — density of the mirrored known.

Key screen (the seam; `^` up-gravity air):

```
#......##^^^^^^#
#..S...##^^S^^^#
#......##^^^^^^#
#.####.##^^^^##^
#......##^^^^^^#
#.##...##^^##^^#
#......##^^^^^^#
```

**Sconces:** entry + the two ledger sconces. Exam-register scarcity begins.
**Figures:** one per cell, each standing on its own floor — feet pointing
opposite ways across the wall. The act's unresolved thing: a walled-up
doorway in the antechamber with a lit sconce visible through the gap and no
route to it, never explained (atmosphere §3.5). **First-clear: 110–140 s.**

---

### 8 · THE RETURN — *"the other makes you us"*

**One idea:** none new — the U walked in full, recombining Act III's gravity
with the game's kit, and one twist of role: the **censer-ride** debuts. You
learned to dodge the lantern; now you stand on it at apex and ride its light
across the unlight. Conversion of threat into resource, the kit's
exploitable moment (grammar §2). **Shape:** the full U — down the left
chimney, across the bottom, up the right. **Ramp:** Mega Man suite.

- **The descent:** censers across the chimney, dodged as taught — until a
  gap no jump crosses and no floor serves, and the only thing in reach is
  the lantern at apex. Inevitability engineering (grammar §1.6): the ride is
  discovered because nothing else is left, over a shallow gutter.
- **The bottom:** the right-gravity current threaded with shuttle bolts —
  the corridor *is* sideways-down, walked along its wall. Midway, the one
  who stayed: the Kindled cameo, and the sconce beside it that door `1`
  requires. You cannot pass without standing with them (kept from the
  second pass; it is the best beat the room had).
- **The ascent:** wall-jumps up the right limb, a one-way gate sealing the
  bottom behind you — the return does not un-happen. Censers again, ridden
  *upward* this time, apex to apex.
- **Ketsu:** the last chimney: censer-rides and wall-jumps interleaved on
  the pulse, the U's two limbs rhymed.

**Sconces:** entry + the cameo sconce + 1 on the ascent. **First-clear:
120–150 s.**

---

### 9 · THE KINDLED — *"they are keeping it company"*

**Introduces nothing.** The Summit rule (precision §4.3): four movements in
the dark, each recombining two acts' vocabulary, ending with the dark itself
at your heels. The one thing that *feels* new is the F12 rule biting at full
strength: with the spark spent, you are a silhouette and the room closes in
— the meter is the visibility, and this room is built dark enough that the
player finally understands what they have been carrying. **Shape:** a
boustrophedon — four long floors snaked right, left, right, up. **Ramp:**
DKC. No melodic bed — ambience and diegetic sound only, until the stone
(atmosphere §5).

- **I — lamplight floor:** dark + shuttles + a snuffer. Every rail
  self-luminous (P2); the moth's rim is the only warm thing moving.
- **II — the censer gallery:** three censers phased a third apart over
  unlight; the middle one must be ridden. Their swinging light is the
  movement's illumination.
- **III — the piston chimney:** crushers climbed between cycles, a
  half-height gravity seam at the top re-reading the last jumps.
- **The exhale:** a wide, *lit* chamber — the first steady light in the
  room, and the first time the four who stayed are seen clearly, facing the
  master stone (atmosphere §4). The act's silence lives here, 4 s, before
  the last door.
- **IV — the long floor:** the pursuit right, the wave's edge lighting the
  way, over everything the run has taught in miniature — and it breaks at
  the chamber's threshold, at the feet of the four.
- **The stone. Awe beat #4:** every sconce the player lit across all nine
  vaults flares in sequence, revealing the full chamber they have only ever
  seen three tiles of — the withheld vista, lit by the player's own labor
  (atmosphere §6.4). The [finale system](src/fx/finale.ts) already exists;
  point it here.

**Sconces:** entry + 2 (before II, at the exhale) — the exam register:
scarcity is the difficulty (grammar §4.3). **Figures:** the densest cluster
in the game, and the player's own spent-wick smudges from every attempt
scattered among them — by the tenth try the room cannot tell you from the
guild, which is the thesis (atmosphere §1.4). **First-clear: 150–180 s.**

---

## V. Flow of the whole

| # | Vault | Act | Register | Ramp | Owns | Sconces | First-clear |
|---|---|---|---|---|---|---|---|
| 1 | WICK | I | teach | Mario | the light economy | 4 + entry | 60–80 s |
| 2 | FAMINE | I | test | Mega Man | dead light + snuffer | 3 dead | 75–100 s |
| 3 | LAST SHIFT | I | exam | DKC | beams + cover (censer coda) | 2 | 90–110 s |
| 4 | VAULT | II | teach | Mario | pulse bridges + doors + shuttles | 4 (3 req.) | 90–110 s |
| 5 | EMBER | II | exam* | DKC | pursuit + one-way + brazier | 1 | 100–130 s |
| 6 | WEATHER | II | test* | Mega Man | wind, both registers | 3 + trap | 100–130 s |
| 7 | DEBT | III | teach | Mario | gravity + mirrored crushers | 2 | 110–140 s |
| 8 | RETURN | III | test | Mega Man | censer-ride (recombination) | 3 | 120–150 s |
| 9 | KINDLED | III | exam | DKC | nothing | 2 | 150–180 s |

*5 and 6 swap the register formula because a pursuit room cannot be a
mid-act "test" with cool-downs — EMBER is structurally DKC, WEATHER is
structurally a lesson. The in-world play order (5 before 6) still ramps,
because WEATHER's twist (the current) assumes more fluency than EMBER's
single held idea.

**Total golden path ≈ 15–19 minutes; a first playthrough with honest
guttering ≈ 30–40.** Whole-run gutter expectation for a competent
non-expert: 40–80 re-forms, front-loaded into 5, 8, 9.

**The curve:** three ramps that each reset partway — Act openers (1, 4, 7)
are playgrounds pitched *below* the previous act's exam, so every act starts
with the player feeling strong (grammar §1.3). The exhale rooms are
authored, one per act: SHIFT's bottom hall, WEATHER's still descent,
KINDLED's lit chamber of the four (atmosphere §4). The sine wave touches
zero three times; that is what makes 5, 6, and 9 land as spikes.

**Act dialects stay distinct** by what the rooms are *about*, not just what
they contain: Act I is light-discipline (every idea is the economy of the
spark), Act II is austerity (every idea is what the world withholds — dead
floors, priced doors, weather, commitment), Act III is gravity (every idea
is a re-reading). Elements crossing act lines must change structural role
(grammar §1.1): bridges reappear in 4 as ceiling, censers in 6 as
wind-reader, in 8 as mount; a returning element in an unchanged role is a
lint failure.

**The assist story:** hazard speed × 0.6 (pulse stretched, ratios intact —
the groove survives) **plus one authored sconce per room**, placed at each
room's twist beat via `assistSconce` in the def — the exact place where a
struggling player's retry loop is longest. This supersedes the second pass's
speed-only ruling: exam-register scarcity is correct for the standard
contract and too honest for the assist one. KINDLE stays reachable with
assist on; the gate is the message, not the reflex.

---

## VI. Theme & presentation

Everything below runs in the existing Three.js tile pipeline — shader
constants, transform tweens, quads, PositionalAudio. No new art pipeline.

**Value structure in dark rooms** (atmosphere §2): three bands — lamp core
(detail), falloff ring (pure silhouette; kill normal-map contribution
there), true black with two or three additive fog quads at distinct z so the
black has parallax. The **rim-light lattice**: every solid face carries a
faint constant emissive rim in the world hue, readable ~2 tiles past lamp
range; `X` studs get no rim — hazards are the holes. Act III mounts its rims
crooked (below).

**Architecture as chronology** (atmosphere §3.3): Act I masonry maintained —
trim intact, cups clean. Act II stripped — ornament gone, courses bare. Act
III hurried — mismatched courses, sconces mounted crooked or too high,
scaffolds never struck. One tile-variant swap per act. The tombs get older
as the light got scarcer.

**The sconce chord** (atmosphere §4): lighting a sconce fires five systems
at once — a real luminance bump across the room, the dash-refresh intake,
a 6–8 dB ambience duck for ~4 s, the camera easing out ~8 % and settling,
the rim lattice strengthening a notch. The only *positive* screenshake in
the game lives here (soft, 2 px); shake otherwise fires on exactly two
events — crusher impact and a snuffer's theft — and never on jump, land,
wall-jump, spark, or re-form (precision §5.2).

**Ambience beds, one per act** (atmosphere §5): ember — low bowed metal,
room-tone hum, settling stone; mint — glassine shimmer, wide reverb,
subsonic pressure; violet — dry, close, near-zero reverb, a slow pink-noise
pan that follows the gravity direction, so the dialect is audible. Every
unlit sconce breathes: a faint positional intake loop, the only non-visual
navigation in dark zones, and the fiction itself — the guild kept the
lights company.

**The four ducking moments** (atmosphere §5): full ambience duck to
near-zero, ~3 s, on exactly: sconce lit, master stone touched, first entry
to a dark zone, and the gutter-out. Nowhere else, ever. The gutter-out is
one continuous phrase — flame collapse, a held low tone, the sconce's
intake at re-form; no cut, no sting, no failure sound. Every repeated
sound pitch-randomized ±12 %.

**The record of failure:** each gutter leaves a spent-wick smudge decal for
the session; the completion card's `reforms` line reads as light spent, not
deaths counted. The player's marks accumulate in the same visual language
as the standing dead — by KINDLED's last floor, deliberately
indistinguishable.

**Figure posture grammar** (atmosphere §3.1): four rig poses — reaching,
fallen with lamp raised, curled away, kneeling — reused nine ways, placed so
posture names the hazard ahead and cluster density telegraphs difficulty.
The lamp gains a held second function: raise it toward a figure and receive
one line of the guild's voice — free, skippable, never gating (atmosphere
§1.2).

**The kindled finale:** [src/fx/finale.ts](src/fx/finale.ts) drives the
sequential flare — every sconce of the run, in lighting order, revealing the
full chamber. The one bright moment the vaults are allowed before the
Communion's white page ([DIRECTION.md](DIRECTION.md) §8c2) — tinted violet,
never white; the white belongs to the ending.

---

## VII. Build order

Each phase ships green: `node scripts/vaults.mjs` and
`node scripts/vaultfit.mjs` pass at phase end, with the named breakages
fixed inside the phase that causes them. Feel first (it invalidates all
tuning), then kit, then rooms 4–9 before 1–3 (grammar §1.7: first levels
built last, from the vocabulary that survives — Miyamoto's and Ancel's
identical scar), tuning last.

**V1 — Feel (F1–F10, F12).** ~20–32 h. The verbs finished before a single
tile moves.
*Breaks:* `vaults.mjs` `metrics` (dash-carry distance changes with F6;
apex height wobbles within tolerance under F4) and `spark` (freeze frames
shift the spent/relit timing windows) — retune the assertions to the new
constants. *Adds:* a retry-timer check (gutter-to-control ≤ 0.9 s), a
corner-correction probe (a scripted head-bonk that must resolve), a
buffer-through-wall-touch check.

**V2 — Chambers & presentation core (F11 + rim lattice, sconce chord,
gutter phrase, decals, fog planes).** ~16–26 h.
*Breaks:* `vaults.mjs` camera-follow assumptions in the `entry` and
`crystal` checks (camera now cuts at chamber bounds). *Adds:* chamber-width
lint (≤ 22 cols), sconce-at-boundary lint, the P2 dark-hazard-emissive lint.

**V3 — Kit (motes, braziers, snuffers, one-way gates, currents,
censer-ride, beam parked state, global pulse, deadLight visuals).**
~18–30 h. **DONE 2026-09-03.** The kit ships in THE PROVING GROUND
(`TEST_VAULTS` in [src/world/vaults.ts](src/world/vaults.ts), `?vault=proving`)
rather than in the nine, which V4/V5 rewrite — wiring new objects into
rooms that are about to die is paying twice. The legend carries the spark
ledger and the fiction line per element; every cyclic period is now an
integer multiple of the 0.85 s pulse. **Dead surface** (`=`) ships with the
phase — the table's △ entry, which the first V3 scoping missed: without it a
spent spark cannot outlast a jump in any floored room, so the brazier and
the whole famine economy are unauthorable. Placement is per-room by design
and stays out of the nine until V4/V5 author them. Its rim is cold rather
than absent, departing from the table's word "rimless": a hole in the
lattice already means a fang (P2), and dead floor must stay readable.

*Feel validated by hand, 2026-09-03* (headless proves completability, never
difficulty — §VI): the pulse retune is clean, all nine still play with no
timing regression; the current reads as a carry at the right speed; the
snuffer's theft is legible. **One finding carried into V3.5:** the
censer-ride works but is hard to land on deliberately. The collision is
already maximally permissive — the crown is standable through the whole
swing, not only at the apex — so the gap is not the rule but the
**telegraph**: a pendulum is briefly still at the ends of its arc and
fastest (~6.4 t/s, nearly twice walk) through the bottom, and nothing on
screen tells the player where the apex will be or when. §III already
specifies the fix as part of the censer's dress — "chain, arc smoke-trace"
— so it lands in V3.5's hazard family, not in tuning. Do not widen the
landing band to compensate; the target needs to be readable, not bigger.
*Breaks:* `vaults.mjs` `alphabet` kit census (new counts) and its parse
walk (new chars `o` `*`); `vaultfit.mjs` AIR set. *Adds:* pulse-ratio lint,
the P1 spark-classification totality check, a snuffer check (steals without
guttering), a ride check (standable censer apex).

**V3.5 — The dress.** ~14–24 h. The dedicated art pass §VI implies but the
first draft never scheduled: every object the player reads, redesigned to
the quality bar of the colony-structure miniatures, kit-final and BEFORE a
single room is authored — beautifying a changing kit is paying twice, and
authoring rooms against placeholder dress invalidates their readability
tuning. Scope: the sconce family (cup, flame, famine's cracked cup,
brazier), the hazard family (beam emitters and cones, shuttle rails and
bolts, censers and chains, crushers, rime), bridges, doors, the one-way
curtain, the master-stone chamber dressing, and the lattice's final
material values per act (maintained / stripped / hurried — §VI
architecture-as-chronology rides along here). Workflow per the house rule:
Midjourney reference sheets per object family → rebuild → rendered review
page → approval before ship. *Adds:* nothing mechanical; the P2
dark-hazard-emissive lint re-verified against final materials.

**DONE 2026-09-03.** The dress lives in
[src/game/vaultkit.ts](src/game/vaultkit.ts) — constructors and material
values only, with [src/game/vault.ts](src/game/vault.ts) still owning every
clock, collision and piece of state. Three rules carry the whole sheet and
are why the objects read as one guild's work: **stone carries** (pedestals,
piers, anchor posts, piston housings), **bronze holds** (cups, crowns,
collars, rails, cages, chains), **light works** (flame, bolt, cone, deck —
always unlit or additive material, never a lit surface, because a hazard the
dark can hide is a fang).

*One finding worth recording:* the first pass rendered every fitting as a
black cutout. A physically-honest metal reflects its surroundings and these
rooms have no environment to reflect, so metalness 0.9 renders as a hole.
Bronze is now a warm diffuse alloy at 0.32 — legible before it is correct.

**The censer's arc telegraph shipped** (2b, carried in from V3's
hand-validation), and `CENSER_RIDE_BAND` was not touched: a trace drawn once
along the swing whose brightness *and width* follow dwell, so it fattens at
the apexes and nearly vanishes through the fast bottom; a pad at each apex
that fills as the lantern arrives, which is the *when* a static trace cannot
carry; and a short smoke trail off the crown for direction. The crown is now
a bronze deck with a raised lip and planks, and it brightens as it comes to
rest. Reviewed in motion across one full period
(`design-review/v35-censer-arc-0..7.png`), per the phase's own instruction
that a still screenshot cannot judge it.

**Architecture as chronology landed on the fittings as well as the stone.**
`LATTICE` in vaultkit holds the rim, dead-seam, crooked and course-length
values per act; the lattice's GEOMETRY is unchanged, by ruling — it was
already at bar. The sconce carries the same three ages: Act I keeps its
carved crown and finial drop, Act II has had the ornament taken off it, Act
III is mounted crooked and too high.

**One mechanical change, against the phase's own rule, and it is worth the
exception.** Bridge decks and rime shelves are drawn as panels a third of a
tile deep, because that is what they are — a floor that comes and goes, not
architecture. The collision grid is tile-granular, so the whole tile was
solid and a jump under a shelf bonked on open air two thirds of a tile below
the ice. That is the same fault as a beam drawn wider than it bites, in the
place it is most insulting: the player can SEE there is nothing there. Thin
tiles are now solid only across `THIN_BAND` (0.34), measured down from the
tile's top, via `bodySolid` — the ray marches and `vaultfit`'s walk still ask
`solidTile`, so nothing outside the body's own collision moved. **Landing is
untouched**: the panel's top is the tile's top, which is what every authored
jump was tuned against, and the substep cap (0.2 tiles) is safely under the
band. Passing up through a deck from below now works, which is strictly more
permissive — `vaultfit` already treated `A` `b` `R` as air. *Adds:* the
`thin platforms` check, which proves the head stops on the ice and the feet
still land on the tile top, for both a shelf and a deck.

**The door's count register is cut INTO the door**, so it fades with the
masonry it is part of. It shipped as a separate object added to the scene,
and when a door was paid off the bronze plate stayed behind, hanging in the
empty doorway as a small lit cube with nothing holding it up. *Adds:* the
`door register` check.

**The snuffer flies rather than travels.** It shares the shuttle's def and
clock because its patrol is the same idea — out along a line and back on a
period — but a creature holding a dead straight line at a constant speed
reads as the machine it borrowed its data from, not as an animal. The rail
is its ROUTE now: it wanders either side of it and it dawdles and darts
along it (measured: up to 0.28 tiles off the line, and 0.25 to 4.5 tiles/s).
The wander goes into `shuttlePos` — the position the run actually uses —
never into the drawing alone, because a moth fluttering beside its own
hitbox would be the same fault as a beam drawn wider than it bites. It is
deterministic, layered sines on incommensurate periods, so replays hold and
the suite can still stand the body in its path. Bounded well inside a tile
so a patrol authored down a corridor cannot flutter into masonry.

**Two objects the scope list forgot, found by auditing the phase's governing
line — "every object the player reads" — rather than its enumeration.**

*The unlight stud* `X` is the only instant-kill terrain in the game and it
shipped as a flat maroon rectangle with one bar across the top: a hazard
drawn quieter than the rule it enforces, which is the over-wide beam's fault
in reverse and costs the player just as much. §III's "zero rim; a hole in
the lattice" and "where the dark bit through" are both instructions, so it
is a BITE now — a recess with no back to it, a torn ember lip where the
masonry was eaten through, and shards of stone left pointing inward. A run
of studs draws one hole rather than a row of squares, because the tear is
drawn only where the bite meets something that is not another bite. The lip
is deliberately shallow and dim: four deep sides eat the tile and leave a
lava square, which reads as terrain rather than as a wound.

*The pursuit wave's* telegraph in §III is not a look — "its leading edge
**lights the room ahead of it** — fleeing is also seeing" is a rule, and a
black plane with a 0.16-wide bar in front of it delivered none of it. The
front now carries real point lights thrown forward into the unconsumed room,
so the ground you are running onto is readable *because* the thing chasing
you is in it. Behind them the dark has body — layered veils at distinct z,
the fog banks' own trick — and ahead of them, embers off the burn. The lint
reads the burn's core material now rather than the old edge mesh.

**The proving ground grew** a plain shuttle, a crusher, three rime shelves,
two bridge runs and a door: the dev room had no bolt, crusher, rime, bridge
or door on screen, so those families could not be reviewed at all. The nine
maps are untouched, as V4/V5 still rewrite them.
`design-review/v3-review.mjs` was extended rather than replaced and now
captures every family, the three acts, and the censer strip.

**V4 authoring note, banked from V3.5's review — the floor-to-ceiling
crusher.** Every crusher authored so far throws a short distance into open
air, which reads as a block that pokes out and goes back. A piston whose
travel spans the FULL height of its shaft — able to crush the body into the
floor or into the ceiling depending on where it catches you — is a stronger
object for the same kit cost: it is authoring, not code (`dx`/`dy` and the
travel are already def data), it makes the approach buffer (≥ 5 tiles,
grammar §4.2) genuinely earn its width, and it gives the stop-and-go read
two failure directions instead of one. Worth trying first in EMBER, which
stresses the most new kit at once and is therefore where a bad crusher is
cheapest to learn from. Not decided here: where crushers sit and how far
they throw is a per-room call, and picking it inside a dress phase would be
authoring level design in the proving ground.

**V4 — Rooms 4–9,** authored in order **5, 4, 6, 7, 8, 9** (EMBER first: it
stresses the most new kit at once, so its failures are cheapest to learn
from). ~40–70 h of authoring and iteration; chambers are independently
deletable by design.
*Breaks:* every hand-coded map coordinate in `vaults.mjs` (the `crystal`
sconce index, pursuit triggers, shuttle probes) — rewrite those checks
against the new defs per room, inside the room's own commit. `vaultfit.mjs`
re-proves reachability at BODY 2 per room. *Adds:* the P4 climax-census
lint, the P5 reach-model golden path, sconce-buffer spacing lint (≥ 4 / ≥ 5
crusher), flat-walk lint (≤ 8 tiles).

**V5 — Rooms 3, then 1–2,** built last from the surviving vocabulary,
including WICK's teaching gap tuned against how real hands actually failed
in V4 playtests. ~20–35 h. Same per-room breakage pattern.

**V6 — Tuning, audio beds, the finale, assist.** ~16–28 h. Human first-clear
times and rage counts per room before sign-off ([SPEC-GLYPHS.md](SPEC-GLYPHS.md)
§6 — headless tests prove completability, never difficulty); the three
ambience beds; sconce breath; the four ducks; the KINDLED flare; assist
verified (pulse-stretch keeps ratios; `assistSconce` per room). Full
regression: `vaults.mjs`, `vaultfit.mjs`, `phase3.mjs`, the movement metrics
locked at their V1 values.

**Honest total: 145–245 hours.** The wide band is V4/V5 — level authoring
converges only through play, and the plan's chamber structure exists partly
so that a bad chamber dies alone.

---

## ⛩ Decisions (RULED 2026-09-03)

1. **Room count: nine.** The acts are a nine-word sentence; the codex is
   built for it. Ruled — and the tenth word has a home: a future **deep
   vault** layer, one per world, sunk under the bottom of each mine and
   unlockable, is liked and banked (see 5).
2. **Held sconce commit: NO.** Reaching-cost in Act III instead. (§II.)
3. **Walk speed and dash length: unchanged.** Structure, not physics.
   Tune only if play demands it. (§II.)
4. **Assist: +1 authored sconce per room,** superseding the second pass's
   speed-only ruling. Further assist dials can come later if needed. (§V.)
5. **Reflectors, strobes, dream-plates: reserved for the deep vaults.**
   Ruled with a standard attached: **the main path is difficult — the lore
   is fought for.** The nine rooms must reach that bar with the shipped kit
   alone; the reserved elements are the deep vaults' dialect, behind an
   opt-in unlock, never on the main path (precision §4.4). Tuning passes
   err toward teeth, not mercy — assist is the mercy.
6. **Ghost-thread replays: deferred.** Spent-wick decals ship now; threads
   are a polish pass if the decals prove the appetite.
