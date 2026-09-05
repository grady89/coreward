# COREWARD

*The light you're looking for is under you.*

A modern 3D vertical mining game — a reimagining of Motherload. Descend through
the crust of VEIL-3, a tidally locked exoplanet frozen in permanent amber dusk,
selling ore to upgrade your pod, managing fuel, hull and heat, digging toward
the buried light of the Ember at 1000m.

The Ember is one piece of a shattered star. Touching it unlocks the next dig
site: **three worlds** (VEIL-3 → CRYOS-2 → MAELIS-6), each a new seed, palette
and rule twist (glazed-ice traction and deep frost; pressure bursts and
corrosive brine) on one shared engine. One pod travels between them — money,
upgrades, cargo, fuel and hull persist; terrain and position are per-world.
Post-ending, the **Ember Forge** at the garage sells rule-breaking tech paid in
embershards (dash, up-drilling, warp-selling, heat-to-fuel conversion), and
wrecked pods seeded through the caves invite **EVA salvage walks** on a
45-second oxygen clock. A hulk is a body, not scenery — you land on it, you
are stopped by it, and the rig can shoulder one along a shaft it has tumbled
into, which is the only reason a falling wreck can never seal you under it. Every ending is walked on foot.

Built with **Vite + TypeScript + Three.js**. No art or audio assets — every
mesh is procedural geometry, every sound is synthesized WebAudio, the terrain
is seeded procedural generation. Creative direction lives in
[DIRECTION.md](DIRECTION.md).

## Run

```sh
npm install
npm run dev        # dev server
npm run build      # tsc gate + production build (dist/)
npm run check      # type-check only
```

## Verify (headless)

Playwright drives the built game with SwiftShader and screenshots every system:

```sh
npm run build
npx vite preview --port 4173   # in one terminal
node scripts/verify.mjs  out/  # boot → intro → drill → fly → fps probe
node scripts/depths.mjs  out/  # visual tour of all five strata + the core
node scripts/shops.mjs   out/  # sell → garage → pause → save/continue round-trip
node scripts/hazards.mjs out/  # side drill, fall damage, gas, death, rescue
node scripts/spill.mjs   out/  # the spill: claim filed, recovered, expired, replaced
node scripts/hulks.mjs   out/  # wrecked pods as solid bodies: land, bump, shove, salvage
node scripts/progression.mjs out/  # wrecks, EVA salvage, core walk ending, forge, dash, world travel
node scripts/features.mjs out/     # per-stack selling, survey scanner + map, wreck settling, EVA recall
node scripts/contracts.mjs out/    # contract accept/claim/abandon + settings panel & persistence
node scripts/newgame.mjs           # sandbox-safe new game, quit-to-title, rescue re-offer
node scripts/narrative.mjs out/    # event engine, Dispatch delivery, wreck chronology
node scripts/threats.mjs out/      # lamp toggle, swarm attraction, threat settings
node scripts/phase2.mjs out/       # flares, Long Ones, corridor rule, seismic charges
node scripts/phase3.mjs out/       # ruins, glyphs, codex, Wardens, per-world dialects
node scripts/fauna.mjs   out/      # every creature on all three worlds
node scripts/sandbox.mjs out/      # all 12 dev-sandbox stages still come alive
node scripts/vaults.mjs  out/      # the Nine Stones: alphabet, vault runtime, codex
node scripts/pilotlook.mjs out/    # the pilot: portrait, gameplay distance, stride, vault
node scripts/gamepad.mjs out/      # a synthetic pad: menus, flight, kit modifier, vault, chart
```

## Look at the fauna (dev)

Headless suites prove behaviour; they cannot tell you whether a gait reads.
Run the game with **`?fauna`** and it cycles every creature — right world,
habitat carved, creature alive beside you, with a card saying what to watch.
`[` `]` cycle, `\` restage, `H` hides the card. `?fauna=riptide` opens on
one. It never writes to your save. `?core=cryos2` still jumps to a chamber
for the Communion, and **`?vault=wick`** steps straight into one of the
Nine Stones (ids: wick famine shift vault ember weather debt return
kindled — see [SPEC-GLYPHS.md](SPEC-GLYPHS.md)). Bare **`?vault`** opens
the **Gallery of Nine** — one hall with every stone in the floor: walk (or
hop with `[` `]`) to any mark and press E to play its vault; translated
marks burn brighter, so it doubles as a progress wall. No O2 clock, and
nothing done there touches your save.

Vault controls: ←→ move · ↑/W/Space jump (walls catch you — jump again to
kick off) · **Shift + direction = the spark**, one stored dash relit by
stone underfoot or any lit sconce, mid-air included. Esc leaves. Roster and staging:
[src/dev/sandbox.ts](src/dev/sandbox.ts), creature-by-creature notes in
[BESTIARY.md](BESTIARY.md).

**A headless testing note:** `dt` is clamped at 0.05s/frame so fast falls can
never tunnel through terrain. Under SwiftShader (~15fps) that makes simulated
time run at roughly 40% of wall-clock, so suites wait generously. On real
hardware at 60fps the clamp never engages.

## Controls

| Key | Action |
|---|---|
| ← → / A D | thrust sideways (hold against a wall while grounded to drill into it) |
| ↑ / W / Space | thrusters (with the Ascent Coil: hold at a ceiling to drill up) — jump during EVA |
| ↓ / S | drill down |
| E | dock at a building · EVA at a wreck or the core · salvage · board pod |
| F | headlamp on/off — **light attracts what lives down there** |
| Q | throw a flare · G | place a seismic charge |
| Tab | survey map (+ / − or scroll to zoom) |
| R | recall to the pod during EVA |
| Shift | Blink Coil dash (forge tech) |
| C | Warp Hold remote-sell (forge tech) |
| Esc | pause / close panel |
| M | mute |

## Controller

Plug a pad in and the game changes hands mid-sentence — the prompts, the pause
legend and the kit strip all re-stamp themselves, and touching the keyboard
hands them straight back. Any standard-mapping pad works (Xbox layout named
below); nothing needs configuring.

| Button | Action |
|---|---|
| left stick / d-pad | thrust sideways · thrust up · drill down (the stick answers everywhere the d-pad does) |
| A / RT | thrusters — jump during EVA and inside a stone |
| X | dock at a building · EVA · salvage · board pod · **hold** at a cradle |
| B | recall to the pod during EVA · back out of a panel or the chart |
| Y | headlamp on/off |
| LB | Blink Coil dash · the spark inside a stone |
| RB | fire the lance |
| **hold LT** | the kit: **X** flare · **A** seismic charge · **B** arrestor · **Y** shaftlight · **RB** depot |
| View / Back | survey map (right stick up/down zooms it) |
| Menu / Start | pause · close a panel |
| L3 | Warp Hold remote-sell · **R3** mute |

Menus, the title screen and the Sundering Chart are all navigable: the stick
walks a focus ring, **A** presses what it is on, left/right drags the volume
sliders, and **B** backs out. Rumble is on by default and can be turned off
under SETTINGS · MOTION (it also follows the system's reduced-motion setting).

Story canon lives in [LORE.md](LORE.md); the build sequence and status are in
[PLAN.md](PLAN.md).

## The loop

**Veinlight** — the biolume growing on cave walls past 300m — is harvested
straight into your fuel tank (+10 each, no cargo slot), so the deep bands carry
their own lifeline.

Dig → fill your hold → fly back up (fuel is the clock) → **TRADE** to sell →
**FUEL** to refill → **GARAGE** for drill / thrusters / tank / cargo / hull /
radiators → deeper. Gas pockets, magma, fall damage and core heat push back.
Radiators gate Emberreach (600m+). The run auto-saves to localStorage.

Crashing no longer eats the hold outright. The ore **spills** where the pod
burst and the crew files a claim over it: a beacon on five minutes of battery,
marked on the survey map and clocked in the corner of the HUD. Fly back down
and into the pile and it goes straight back in the hold — as much of it as
still fits. Let the battery die and it is written off, and a second crash with
ore aboard writes off whatever the last one left. The salvage fee is still
charged either way.

## Structure

```
src/
  config.ts            all balance & tuning
  world/  tiles, terrain gen, chunked instanced renderer, backdrop/sky/atmosphere
  player/ pod mesh + controller (physics, drilling, hazards, docking)
  game/   run state, economy, save/load (Steam-cloud swappable seam)
  fx/     pooled particles, follow camera
  ui/     DOM HUD, shop/fate panels, title screen
  audio/  procedural WebAudio engine
```

## Steam path

Web-first build with `base: './'` so it drops into an Electron wrapper
unchanged; the save layer is a single localStorage seam to swap for Steam
Cloud. (Same pipeline pattern as a shipped predecessor project.)
