# COREWARD — Bestiary (BUILT 2026-09-01)

Design law, from [DIRECTION.md](DIRECTION.md) §8g: **the pod is a digging
machine. If it becomes a gunship, the game dies.** Nothing here is an encounter
to clear. Every creature is pressure with agency; the verbs stay dig / flee /
manage light; a silent run is always viable; every threat and every counter is
made of light.

Each world runs the same grammar — a **swarm** tier, a **hunter** tier, a
**stalker/builder** tier — keyed on the organ that world's rule-twist reads:
VEIL-3 your LIGHT, CRYOS-2 your HEAT, MAELIS-6 your SPACE. Two constants,
the Wardens and the Kindled, are Lamplighter and identical everywhere.

Every entry lists the three things that make a creature: **look**, **motion**,
**rule** — and the single first impression it is built to deliver. Code lives
one file per creature under [src/world/fauna/](src/world/fauna/); the roster
is [entities.ts](src/world/entities.ts).

> This file is the design intent. For the practical version — triggers,
> escapes, damage numbers, depths, and the environmental hazards too — see
> **[THREATS.md](THREATS.md)**.

---

## VEIL-3 — reads LIGHT

### Glimmerflies · swarm · [glimmerflies.ts](src/world/fauna/glimmerflies.ts)
**First impression:** *the sparks in the dark are moving together.*
- **Look.** A murmuration of glass slivers. Each fly only shows itself when
  it turns edge-on to your lamp, so a resting swarm reads as a few stray
  sparks. Lit, the ring collapses inward, then unfolds into a ribbon that
  pours toward the headlamp.
- **Motion.** Ring → collapse-dive (0.9 s) → ribbon. Individual flies bank
  and flash; the ribbon follows the lamp with a lag so it whips.
- **Rule.** Keyed on the lamp. They chew hull and drain fuel on contact. Go
  dark and they lose you inside two seconds — but they do not go home. They
  hang where they lost you, dim, and wait for the light to come back.

### The Long Ones · hunter · [longone.ts](src/world/fauna/longone.ts)
**First impression:** *the dust is jumping off the wall in a line, and the line is coming here.*
- **Look.** Eyeless. A split mandible, a body of overlapping chitin plates,
  a line of dorsal lights that pulse tail-to-head so the direction of the
  wave tells you which way it is moving. It fills a passage.
- **Motion.** Emerges through a bursting wall, steers in arcs (never
  corners) through passages wide enough for its bulk, casts about when it
  loses you, and goes back into the rock.
- **Rule.** Hunts by VIBRATION through your own tunnels: engine, drill, hull
  on rock. It cannot follow into a 1-wide shaft. Cut the engine, stop the
  drill, sit still — it will pass close enough to touch and leave.

### Geode mimics · thief · [mimics.ts](src/world/fauna/mimics.ts)
**First impression:** *the ore just stood up and took my diamond.*
- **Look.** In the voidopal band, opals a shade too violet and a size too
  big. Cut one and it unfolds: six legs, a faceted shell in the stone's own
  colour, and the best thing in your hold held up on its back like a
  trophy, glowing in that ore's colour.
- **Motion.** Skitter-and-freeze, skitter-and-freeze, up the wall and away.
- **Rule.** Keyed on greed. Kill it before it's gone — drill, lance, blast —
  and the ore comes back.

## CRYOS-2 — reads HEAT

### Rimewings · swarm · [rimewings.ts](src/world/fauna/rimewings.ts)
**First impression:** *nothing down here holds that still.*
- **Look.** A constellation of ice hanging in the dark, absolutely
  motionless. Thawed, each is a moth of frost with a heat-seeking dart.
- **Motion.** Shiver → shed frost → crack loose one at a time → dart-and-hang
  flight at the nozzle. Cut thrust and they slow, sink, and lock again
  wherever they are.
- **Rule.** Keyed on thruster wash, not the lamp — the lamp lesson inverted.
  Counter: cut the engine and drift past cold. The tunnels you burned
  through fill with new clusters behind you.

### The Brinewyrm · hunter · [brinewyrm.ts](src/world/fauna/brinewyrm.ts)
**First impression:** *the pool is glowing, and the glow is coming up.*
- **Look.** Never seen whole. A pale gut-light cruising under the brine, the
  colour of the brine itself. Then a milk-white eel with a lamprey's ring of
  teeth thrown clear of the pool.
- **Motion.** Cruise (wander the pool) → churn (the glow rises, the surface
  boils for a full second — your one warning) → breach in an arc at the
  nozzle → fall → sink. A drilled hit stuns it.
- **Rule.** Keyed on heat within ~7 tiles: your engine near a pool, or a
  flare in it. The bite isn't what kills you; the drag back toward the
  brine is. A flare into a pool is heat too — scout with it.

### Stillwalkers · stalker · [stillwalkers.ts](src/world/fauna/stillwalkers.ts)
**First impression:** *that wasn't there a second ago.*
- **Look.** Too tall. A figure inside the rock, black as a cut-out with a
  cold blue rim, standing where there was nothing.
- **Motion.** While your lamp is on it: not a tremor. Lamp off: it walks
  through rock and ice straight at you with a gait that is almost right.
  Eight limbs, three body blocks, a stride that is slightly too long.
- **Rule.** Keyed on the ABSENCE of light. Dark hides you from the Wardens
  and feeds you to these — the rule collision is the point. Their approach
  drives a red **dread** wash on the screen.

### Frostbloom · bait · (tile, [entities.ts](src/world/entities.ts) `frostbloom()`)
**First impression:** *the veinlight just bit me.*
- **Look.** Fake veinlight on a world where veinlight is fuel.
- **Rule.** Cut one and the cold comes out at once: fuel gone, and every air
  tile within three sets to young rime — except the ones the pod is in. You
  are encased, not entombed; young ice is the one tile a pod can ram.

## MAELIS-6 — contests SPACE

### Pressure polyps · swarm · [polyps.ts](src/world/fauna/polyps.ts)
**First impression:** *the wall is breathing, and it's getting faster.*
- **Look.** Translucent sacs in wall clusters, a dark nucleus, a slow
  breathing pulse. They never move.
- **Motion.** Inflate as you near — faster the faster you move — green
  draining to white, trembling, then burst: a hull hit and a shove, and the
  neighbours catch it.
- **Rule.** Thread slowly and they only swell. Rush and the wall goes off like
  a string of charges. A flare within reach pops them from a distance.

### The Riptide · hunter · [riptide.ts](src/world/fauna/riptide.ts)
**First impression:** *the room has an eye.*
- **Look.** Never seen whole: a slow spiral of motes all leaning the same
  way, a shadow far too big showing only through gaps in the rock, and —
  every so often, when you're close — an eye the size of a room that opens,
  looks at you, and closes.
- **Motion.** Spiral field re-seeded on each arrival; the eye blinks on a
  cooldown; the pull grows with the open water around you.
- **Rule.** It doesn't touch you; it *pulls*. Grip = near² · room², so in a
  big cave it will take the pod and in a 1-wide tunnel it can't get hold.
  The counter is the game's own verb: dig into the rock and it loses you.

### Shellbacks · builder · [shellbacks.ts](src/world/fauna/shellbacks.ts)
**First impression:** *the way home is closing.*
- **Look.** Nacre isopods the length of the pod, fourteen legs in a rolling
  wave.
- **Motion.** Crawl your tunnels ahead of and behind you, keeping their
  distance, never doubling back; every few seconds one lays a plate of
  pearl across a tile you dug. Drill it and it curls into a ball you can't
  touch and waits.
- **Rule.** They don't want you; they want the holes closed. Nacre is worth
  the world's native back. Blast one and it drops two. Flares lure them:
  they'll seal a lit tile before they seal yours.

## Constants — the Lamplighters'

### Wardens · [wardens.ts](src/world/fauna/wardens.ts)
**First impression:** *it's not looking for me. It's looking for my light.*
- **Look.** A tripod. A lantern where a head should be; a hexagonal
  masonry-and-verdigris hip slung two tiles up; three legs.
- **Motion.** Plant, lift, swing, PLANT — one leg at a time, each footfall a
  thud through the rock. The beam sweeps the hall in slow arcs and is the
  only part of it that hurries: catch you in it and it narrows, goes white,
  and it walks. Two charges bring it down over a second and a half; its post
  stays dark three minutes after.
- **Rule.** Tracks luminance only. Run dark and it sweeps past. A fragment
  in the hold is light; a flare is light; the Lumen Lance is *too much*
  light and blinds it. Contact is overexposure — the world goes white. It
  takes post as you *approach* a ruin (never when you're already inside).

### The Kindled · [kindled.ts](src/world/fauna/kindled.ts)
**First impression:** *they turned around.*
- **Look.** Four figures on the core-chamber floor made of the core's own
  light: a shimmer of motes in the shape of someone standing, with something
  dark and narrow inside where a body would be. They face the fragment.
- **Motion.** When you enter they turn, drift toward you, stop two steps
  short, and wait. On foot they give ground as you come, keeping their two
  steps exactly, until the wall is at their back.
- **Rule.** They do not chase. Corner one on foot and the suit's oxygen is
  simply gone — blackout, wake in the pod. The pod gets no courtesy: fly
  into one and it bites hull and throws you clear. When the fragment is
  gone, so are they.

## The arsenal — light-first, gun-last
1. **Lamp toggle** — free, instant, the highest-tension mechanic in the game.
2. **Flares** — light somewhere that is not you: pull a swarm, wake a wyrm,
   pop a polyp, lure a Shellback.
3. **The drill** — already a weapon; stuns a wyrm, kills a mimic, curls a
   Shellback.
4. **Seismic charges** — the only thing that fells a Warden, and it takes two.
5. **Lumen Lance** — fires Lumens. Shooting spends money, so it stays last.

## The sandbox — how to actually look at one
Run the game with **`?fauna`** in the URL. It loads the right world, carves
the creature's habitat, forces it alive beside you, and puts a card on
screen saying what to watch and what to press.

| key | |
|---|---|
| `[` `]` | previous / next creature |
| `\` | restage the current one (watch the same three seconds again) |
| `H` | hide the card |
| `F` | lamp — the counter for half this list |

`?fauna=riptide` opens straight onto one. The pod is invulnerable-ish
(full tanks, top radiator, 20 flares, 10 charges) and **the sandbox never
writes to your save**.

Staging is split on purpose: [src/dev/sandbox.ts](src/dev/sandbox.ts) owns
the ground (which world, what room, where the pod parks, how far the camera
pulls back), and each creature owns getting itself onto that ground via
`Creature.devStage()` — because "the Brinewyrm refuses any pool within five
tiles" is a fact about the Brinewyrm, not about a test script.

## Verification
[scripts/fauna.mjs](scripts/fauna.mjs) covers every creature above headless
and **stages through the sandbox's own code**, so a staging bug fails a test
instead of quietly passing the wrong one.
[scripts/sandbox.mjs](scripts/sandbox.mjs) checks all twelve stages still
come alive — the failure that otherwise goes unnoticed until you try to look
at something. [threats.mjs](scripts/threats.mjs),
[phase2.mjs](scripts/phase2.mjs) and [phase3.mjs](scripts/phase3.mjs) cover
the VEIL-3 kit, Wardens and the dialect switch. All green 2026-09-01.

Screens are software-GL and motion does not survive a still, so the suites
prove behaviour and the sandbox is where you judge feel.
