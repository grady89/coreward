# COREWARD — Threat Field Guide

Every threat in the game in plain terms: what sets it off, how you get away,
why it's there, what it looks like, where it lives, and what it actually does
to you. Numbers are the real tuning values from the code.

Depth is shown as the HUD shows it (**1 tile = 2 m**). Strata names differ per
world — VEIL-3 / CRYOS-2 / MAELIS-6 — so depths are given in metres.

The design law behind all of it: **the pod is a digging machine, not a
gunship.** Nothing here is meant to be cleared. Every one of them is pressure,
and almost every counter is *light* or *digging* — never a weapon.

Design intent and the prose version: [BESTIARY.md](BESTIARY.md).
To actually watch one move: run with `?fauna` (see [README](README.md#look-at-the-fauna-dev)).

---

## Quick table

| Threat | World | Depth | Set off by | Get away by |
|---|---|---|---|---|
| Glimmerflies | VEIL-3 | 180–940 m | Your headlamp within 17 m | Lamp off, wait ~2 s |
| The Long Ones | VEIL-3 | 600 m+ | Engine / drill / scraping within 34 m | Sit dead still 2.2 s, or a 1-wide shaft |
| Geode mimics | VEIL-3 | 560–940 m | Cutting one | Kill it before 16 m / 14 s |
| Rimewings | CRYOS-2 | 240–940 m | Thruster wash within 15 m | Cut thrust, drift ~2.4 s |
| The Brinewyrm | CRYOS-2 | 460 m+ | Engine or flare within 15 m of brine | Don't run engines over pools |
| Stillwalkers | CRYOS-2 | 400 m+ | Your lamp being **off** | Lamp **on** — it freezes instantly |
| Frostbloom | CRYOS-2 | 300–920 m | Cutting one | Don't cut it. Ram out of the ice |
| Pressure polyps | MAELIS-6 | 300–940 m | Coming within 8.4 m — faster is worse | Drift slowly, or pop with a flare |
| The Riptide | MAELIS-6 | 600 m+ | Being in open water | Dig into rock; a 1-wide shaft kills its grip |
| Shellbacks | MAELIS-6 | 240 m+ | Nothing — they're always working | Ignore them, or lure with a flare |
| Wardens | all | ruins, 660–920 m | Any light within 36 m of a hall (60 m carrying a fragment) | Run dark; Lance blinds; 2 charges kill |
| The Kindled | all | core chamber | Entering the chamber | Keep 4.4 m; on foot they retreat from you |

---

# VEIL-3 — everything reads your LIGHT

## Glimmerflies
**The swarm. The game's first lesson.**

- **Where:** 180–940 m, in open cave air. Up to 2 swarms, 8–14 flies each.
- **Trigger:** your **headlamp** within 8.5 tiles (17 m). Nothing else — not
  your engine, not your drill.
- **Attack:** contact only, and it's a grind, not a hit — **2.6 hull/sec and
  0.5 fuel/sec** while they're on you. Slow enough that it's a problem, never
  a death sentence.
- **Escape:** turn the lamp off. They lose you after **1.7 s** of dark, and
  fully give up past 15 tiles (30 m). Critically, **they don't go home** —
  they hang where they lost you, dim, waiting for the light to come back. So
  the tunnel you fled is still theirs.
- **Looks like:** a murmuration, not a cloud of dots. Each fly is a sliver of
  glass that only catches the light edge-on, so a resting swarm reads as a few
  stray sparks in the dark. Lit, the ring collapses inward, then unfolds into
  a ribbon that pours toward your lamp.
- **Story:** the cheapest possible teacher. It establishes the rule the whole
  game runs on — *your light is what gets you hurt* — for the price of some
  hull, before anything can kill you.

## The Long Ones
**The hunter. Turns your own tunnels against you.**

- **Where:** 600 m and below, in passages wide enough for its bulk (never a
  1-wide shaft). One at a time.
- **Trigger:** **vibration** within 17 tiles (34 m) — running the engine,
  drilling, or scraping the hull along rock. It is blind. Your lamp is
  irrelevant.
- **Attack:** **26 hull/sec** while it has you, plus a shove. It moves at
  4.8 tiles/s, which is faster than you.
- **Escape:** two options, and both are the game's own verbs.
  1. **Stop.** Engine off, drill off, hull still, for **2.2 s**. It loses you,
     casts about close enough to touch, and goes back into the rock.
  2. **Dig narrow.** It physically cannot enter a 1-wide shaft.
- **Looks like:** eyeless, with a split mandible and a body of overlapping
  chitin plates. A line of dorsal lights pulses tail-to-head, so the direction
  of the wave tells you which way it's travelling. It fills a passage.
- **Warning you get:** the screen rumbles and dust jumps off the wall **in a
  line**, coming toward you, before the wall bursts.
- **Story:** the moment excavation stops being free. How you dig — wide and
  fast, or narrow and slow — becomes a permanent decision, because your own
  tunnel network is the thing hunting you through.

## Geode mimics
**The bait. Keyed on greed.**

- **Where:** VEIL-3 only, 560–940 m, in the voidopal band. Up to 3.
- **Trigger:** cutting one. That's it. Leave it alone and nothing happens.
- **Attack:** it doesn't damage you — it **steals the single most valuable ore
  in your hold** and runs.
- **Escape / recovery:** kill it and the ore comes back. Drill, Lumen Lance or
  a seismic charge all work. You have until it's **16 tiles away or 14 s**
  have passed, whichever comes first — then it's gone for good.
- **Looks like:** in the voidopal band, an opal a shade too violet and a size
  too big. Cut it and the rock doesn't fall away, it *unfolds*: six legs, a
  faceted shell the colour of the stone it was hiding in, and your best ore
  lifted onto its back like a trophy, glowing in that ore's own colour.
- **Movement:** skitter and freeze, skitter and freeze, up the wall and away.
- **Story:** a tax on the driller who can't afford to pass up a seam. The
  punishment is never death, always the thing you came down here for.

---

# CRYOS-2 — everything reads your HEAT

The lamp is safe here. Your **engine** is the problem. That inversion is the
whole point of the second world.

## Rimewings
**The swarm, inverted.**

- **Where:** 240–940 m, frozen to cave walls. Up to 3 clusters, 7–12 each.
- **Trigger:** **thruster wash** within 7.5 tiles (15 m). Your lamp does
  nothing. They take **1.3 s** to shiver loose after first warmth.
- **Attack:** contact — **3 hull/sec and 0.8 fuel/sec**. Slightly worse than
  glimmerflies, same shape of problem.
- **Escape:** **cut the engine and coast.** After **2.4 s** of cold they slow,
  sink, and lock solid again wherever they happen to be — taking **1.8 s** to
  settle. Momentum is now your friend: you glide past on the drift.
- **Looks like:** a constellation of ice hanging in the dark, absolutely
  motionless — which is the unsettling part, because nothing else down here
  holds that still. Thawed, they fly like moths: dart, hang, dart.
- **Story:** the same lesson as the glimmerflies with the organ swapped, so
  a player who learned "lamp off = safe" has to unlearn it. Also the reason
  the tunnels behind you fill back in — new clusters freeze into the passages
  you burned through.

## The Brinewyrm
**The hunter. Makes standing water dangerous twice over.**

- **Where:** 460 m and below, living inside cryobrine pools and flooded
  galleries the pod can't enter.
- **Trigger:** **heat within 7.5 tiles (15 m)** of its pool — your engine
  running nearby, or a **flare thrown into the water** (a flare is heat too).
  It takes ~1.1 s of sustained warmth to commit.
- **Attack:** it breaches in an arc at your nozzle for **22 hull**, but the
  bite isn't the danger — it **latches and drags you back toward the brine**,
  and the brine itself does 24 hull/sec.
- **Escape:**
  - **Prevention:** don't run the engine over open brine. Coast across.
  - **Once it's committed:** you get **a full second of warning** (see below)
    — move. A **drill hit while it's mid-breach** knocks it off. The Lance
    stuns it for 2.5 s.
  - After a failed strike it sulks for 6 s before it will try again.
- **Looks like:** you never see it whole. First just a pale gut-light cruising
  under the surface, the colour of the brine itself. Then a milk-white eel
  with a lamprey's ring of teeth, thrown clear of the pool.
- **Warning you get:** the glow rushes to the surface and **the brine churns
  and boils for a full second** before it comes. That second is the mechanic.
- **Story:** brine was already a hazard you route around. Now it's a hazard
  that routes toward *you*, and the flare — your scouting tool — becomes a
  way to find out whether a pool is occupied before you fly over it.

## Stillwalkers
**The stalker. The rule collision.**

- **Where:** 400 m and below, standing *inside* the rock and ice. Up to 2.
- **Trigger:** your lamp being **OFF**. This is the exact opposite of every
  other lesson the game has taught you.
- **Attack:** it reaches you and **seizes the controls for 1.4 s**, drains
  **22 fuel**, and does **18 hull**. Losing the controls that deep is usually
  worse than the damage.
- **Escape:** **turn the lamp on.** Within 7.5 tiles (15 m) of your light it
  stops dead — not slows, *stops*, not a tremor. It only moves in the dark,
  at 2.4 tiles/s. So the counter is instant and free, but it costs you the
  darkness you were using to hide from the Wardens.
- **Looks like:** tall. Too tall (2.3 tiles). A figure in the rock, black as a
  cut-out with a cold blue rim, standing where there was nothing a second ago.
  Its walk is *almost* right — the stride is slightly too long.
- **Warning you get:** a red **dread** wash creeps up the edges of the screen
  as one closes.
- **Story:** VEIL-3 spent a whole world teaching you that dark is safe. This
  is the bill. On CRYOS-2 dark hides you from the Wardens and feeds you to
  these, so light stops being a simple on/off decision and becomes a
  moment-to-moment negotiation.

## Frostbloom
**The bait. Fake fuel on a world where fuel is life.**

- **Where:** CRYOS-2 only, 300–920 m. Grows among the veinlight on cave
  walls — about 1 in 5 of what looks like veinlight is one of these.
- **Trigger:** cutting one, believing it's veinlight.
- **Attack:** the cold comes out all at once. You lose the fuel you were
  reaching for (**~18**), and every air tile within 3 of it **sets to young
  rime** — including the tiles behind you. You are sealed in.
- **Escape:** young rime is deliberately **the one tile a pod can ram
  through** — build up speed and punch out. The tiles the pod itself occupies
  are never frozen, so you're encased, not entombed.
- **Looks like:** veinlight, near enough. That's the entire idea — it's a
  shade off, and you're low on fuel and not looking closely.
- **Story:** on a world where veinlight is the difference between getting home
  and not, the desperate reach is the trap. It costs you time and nerve rather
  than your life.

---

# MAELIS-6 — everything contests your SPACE

## Pressure polyps
**The swarm that never moves.**

- **Where:** 300–940 m, growing on cave walls in clusters of 3–7. Up to 3
  clusters, 30 polyps total.
- **Trigger:** proximity — within 4.2 tiles (8.4 m) — and **they inflate
  faster the faster you're moving.** Speed is the real trigger.
- **Attack:** they burst for **5–12 hull** depending on how swollen they got,
  plus a hard shove with the world's gas-fling force — **and the neighbours
  catch it**, so a rushed approach sets off the whole wall like a string of
  charges.
- **Escape:** **slow down.** Thread past at a crawl and they only swell and
  settle. Or throw a **flare** into the cluster and pop them from a safe
  distance before you commit.
- **Looks like:** not flies — *sacs*. Translucent, with a dark nucleus and a
  slow breathing pulse. As you near, the green drains to white and they
  tremble.
- **Story:** a swarm that inverts the swarm rule: it has no interest in you
  and never chases. It just makes a corridor cost patience. It's also the
  first threat where the answer is "go slower", which on a world of
  gas-flinging traversal is genuinely hard.

## The Riptide
**The hunter that never touches you.**

- **Where:** 600 m and below, in flooded and open systems. One at a time.
- **Trigger:** **being in open water.** Not noise, not light — volume. Its
  grip is proportional to how much open space surrounds you (`near² × room²`),
  so a big cavern is dangerous and a tight tunnel is not.
- **Attack:** it doesn't damage you at all. It **pulls** — up to 15 units of
  force — dragging the pod toward brine, walls and dark. Everything that then
  kills you is something you hit.
- **Escape:** **dig.** Cut into the rock; in a 1-wide shaft its grip falls to
  effectively zero. The counter is literally the game's core verb, which is
  the point of the design.
- **Looks like:** you never see it whole. A slow spiral of drifting motes that
  all lean the same way; a shadow far too big behind the rock, visible only
  through gaps; and every so often, when you're close, **an eye the size of a
  room** that opens, looks at you, and closes again.
- **Story:** the boss that can't be fought, only left. It's the clearest
  statement of the whole game's argument — the answer to the biggest thing
  down here is a shovel, not a gun.

## Shellbacks
**The builder. Not attacking — repairing.**

- **Where:** 240 m and below, and **only in tunnels you dug yourself**. Up to
  2 at a time.
- **Trigger:** nothing. They aren't reacting to you at all. They're just
  working, and they keep about 6 tiles away from you while they do it.
- **Attack:** none, directly. Every **2.6 s** one lays a plate of nacre across
  a tile you dug (up to 60 tiles). **The way home gets narrower while you're
  still down there.**
- **Escape / handling:**
  - Nacre cuts back out to the world's native material, so a sealed tunnel is
    slow, not fatal — and mildly profitable.
  - **Flares lure them** — they'll go seal a lit tile before they seal yours.
  - **Blast one** and it drops 2 native. **Drill one** and it just curls into
    a ball you can't hurt and waits you out.
- **Looks like:** nacre isopods about the length of the pod, fourteen legs
  moving in a rolling wave.
- **Story:** the Pearl healing its own wound, made ambient. The threat isn't
  damage — it's that the world is quietly closing behind you while you're
  busy, and eventually your exit is a job rather than a route.

---

# The constants — on every world

These two are Lamplighter, not ecology. Their sameness everywhere is the lore.

## Wardens
**The guard. Tracks light and nothing else.**

- **Where:** the Lamplighter ruins, roughly 660–920 m. One posts at a hall as
  you **approach** it (within 18 tiles / 36 m, but not once you're already
  inside). Carrying a stolen fragment widens that to 30 tiles / 60 m — every
  hall goes on alert.
- **Trigger:** **luminance.** Your headlamp, a lit flare, or a fragment in
  your hold. Nothing else registers — not your engine, not your drill.
- **Attack:** contact is **overexposure, not a bite** — the screen goes white
  and you take **30 hull/sec**. It sweeps its beam in slow arcs; caught in it,
  the beam narrows, goes white, and it walks toward you.
- **Escape:**
  - **Run dark.** It sweeps right past you.
  - **Lumen Lance** — too much light, and it blinds the machine.
  - **Seismic charges** are the only thing that can actually fell one, and
    **it takes two.** It comes down over about a second and a half, and that
    hall stays empty for **3 minutes**.
- **Looks like:** a tripod. A lantern where a head should be, a hexagonal
  masonry-and-verdigris hip slung two tiles above the floor, three legs that
  step **one at a time** — plant, lift, swing, PLANT — each footfall a thud
  through the rock.
- **Story:** they aren't evil and they aren't broken. They're still doing the
  job they were left to do, which quietly makes *you* the thief. That reading
  gets much louder in Act IV, when you're carrying a fragment up and every
  hall you pass lights up because of what's in your hold.

## The Kindled
**The core chamber's residents. Non-hostile. Lethal to touch.**

- **Where:** the core chamber of every world, standing on the floor near the
  fragment. Always exactly four.
- **Trigger:** entering the chamber. They notice you within 8 tiles.
- **Attack:** they never chase and never strike. Contact is the whole danger:
  - **In the pod:** they take **40 hull**, throw you clear, and the screen
    overexposes.
  - **On foot:** your suit's oxygen is simply *gone* — blackout, wake in the
    pod. But this only happens if you **corner one against the chamber wall**.
- **Escape:** just stop walking at them. They hold 2.2 tiles off. On foot they
  actively **give ground**, keeping their distance exactly, and only become
  dangerous when there's nowhere left for them to go.
- **Looks like:** figures made of the same light as the core — a shimmer of
  motes in the shape of someone standing, with something dark and narrow
  inside where a body would be. They face the fragment.
- **Movement:** when you enter they turn, drift toward you, stop two steps
  short, and wait.
- **Story:** the only "enemy" in the game that yields to you. They're not
  guarding the fragment and they won't stop you taking it — they just want to
  be near it. **When the fragment is gone, so are they**, which is the quietest
  and worst thing the extraction ending does.

---

# Environmental hazards (not alive, still lethal)

| Hazard | Where | Damage | Counter |
|---|---|---|---|
| **Falling** | anywhere | 7 per unit of impact speed over 13 | Thrusters; fall arrestor pads |
| **Gas pockets** | 120 m+ | 16, scaling with depth; on MAELIS-6 it also **flings** the pod | Hull plating; cut them deliberately, not by surprise |
| **Lava / brine** | 460 m+ | **24 hull/sec** on contact | Don't touch it. Pyro Exchanger halves core damage and converts it to fuel |
| **Core heat** | from 580 m, full at 1000 m | up to 7.5/sec | Radiator upgrades |
| **EVA oxygen** | on foot | 45 seconds, then blackout | Watch the clock; R recalls you to the pod |
| **Fuel** | everywhere | strand = death | Veinlight, and not burning it on the way down |

---

# What's *not* here

- **The husk (SITE 297)** has **no fauna at all.** Everything that keyed on
  light, heat or space died with its fragment. The threat there is that
  nothing comes — no drone, no swarm, no Warden. It is the game's first
  silence, and it is deliberate.
- There is **no boss fight** anywhere in the game, and no threat that must be
  killed to progress. A completely silent run past everything on this page is
  always possible.
