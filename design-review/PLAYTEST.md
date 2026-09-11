# Tonight's playtest — what needs your judgment

Everything below is built, suite-green, and unpushed. The suites prove behavior;
they cannot prove feel. This page is ordered so the highest-stakes calls come
first. Budget: ~40 minutes covers all of it.

## 0 · Before launching (2 min) — the plates

Open in `design-review/`:

- `refit-distance.png` — **the acceptance test.** At ~58px hull, do T0→T5 read
  as different machines? If this plate fails for your eye, everything about the
  refit gets re-argued.
- `refit-ladder.png`, `refit-mixed.png` — garage scale; the mixed build proves
  finishes and tiers stay independent.
- `warden-beam-1.png` / `-2.png` — idle amber fan vs engaged white shaft.
- `terrain-faces-1.png` — the quilt fix, topsoil.

## 1 · The first ten minutes (new expedition)

- **Rock break**: every block now cracks (pitched by hardness) with a short
  hitstop. The question is *fatigue* — drill through soft topsoil for a full
  tank and note whether the crack becomes a drumroll. It ducks when breaks
  chain; judge whether the duck is enough.
- **The value loop**: ore popups hop then arc into the cargo corner, which
  bumps. Watch whether the arc reads as "into the hold" or as noise.
- **Terrain**: carved edges should read as volume now (tops bright, undersides
  dark), not patchwork.

## 2 · The garage (the priority workstream's core beat)

Dock at GARAGE. The world stays lit, the panel steps right, the camera eases
onto the pod. Buy DRILL, then RADIATORS, then CARGO.

- Does the part appearing **on the machine while you watch** land as an event?
- **Zoom call**: the framing is one number (`tz 5.8` in fx/camera.ts:dockPose).
  Bigger pod on stage, or is this right?
- Known niggle: the docked "E GARAGE" prompt pill peeks behind the panel's
  bottom edge. Live with it or fix it?
- At TRADE: sell a full hold — the tally drains in time with the register.
  Too slow? (560ms today.)

Then fly a dive and answer the only question that matters: **at gameplay
distance, does your pod feel like a different machine after three purchases?**

Also new since your screenshot note: **the drill arm**. It stows into the hull
when you're parked and idle (no more bit poking through the surface), deploys
the instant you ask for it, and holds its aim sideways for the whole seam
instead of flicking down between bites. Judge the stow/deploy timing (0.35 s
in, snap out) and whether the held side-aim feels right.

## 3 · Threats (shortcut: URL `?fauna`)

- `?fauna=warden` — the beam IS the sensor now. Stand lit off-arc: it must
  sweep past you. Cross the fan: engaged, white shaft, screen-edge whitening +
  a rising tick as it cooks you. **Difficulty call**: sweep is ~2× faster than
  before as compensation — too hot, too tame?
- `?fauna=stillwalkers` — lamp off, sound OFF: the red dread wash is the only
  warning now. Does it read? Then sound on: wash + heartbeat together.
- `?fauna=polyps` — the taught rule ("give them room, go slow") is now
  mechanically true. Rush a cluster, then crawl one. **Ratification: distance
  is canon** (docs rewritten to match). Note: their swell tell is quiet below
  0.6 inflation — flag if you want the visual mapped earlier.
- Lance (X, needs forge): swarms now scatter blind instead of dying; a
  Stillwalker flash-freezes. If you'd internalized "X deletes flies," judge
  the trade.

## 4 · Economy (the magnitude ratifications)

- **Thrusters**: buy a tier mid-run. Climb is ~1.3–1.7× by tier 5 plus a fuel
  discount. Does ascent *feel* purchased now?
- **Fees**: die with a loaded hold and low purse — the fee reads the manifest
  now (12% of cargo value if that's bigger). Does it sting right, or too cruel
  early?
- **Contracts**: at your record depth the board pays measured-hold-indexed
  rewards. Open it late-save: worth reading now?
- **Extract offer**: ✦300k × world (450k CRYOS-2 / 675k MAELIS-6). **Call:
  is scaling enough, or does the temptation need a fiction wrapper** (debt
  clearance itemized, per-fragment escalation)?
- **Cut confirmations**: Blink Coil gone (shards refunded to stash), cargo 5
  gone (✦58k refunded), Deep Array folded into the scanner (✦12k/site
  refunded). Load your existing save and check the refunds landed sanely.

## 5 · The open calls only you can make

1. Polyp canon = distance (committed; docs rewritten). Veto?
2. Kindled pod-touch = zero damage (code + test enshrine it; docs now agree). Veto?
3. Extract number: scaled offer enough, or fiction wrapper?
4. Veinlight-free shard shelf: intended cruelty or generator accident?
5. **Tank curve direction** for the deferred re-point — after feeling the deep
   fuel wall, should top tanks get cheaper, smaller, or stay?
6. Garage stage zoom (one number) and the dread/scrutiny wash intensities
   (one gradient each) — tuning notes welcome.

## 5.4 · Responses to your fauna notes (mid-playtest changes — retest)

Your notes landed; all four are code now, suite-green:

- **Warden — the beam is truly the sensor.** The `lampOn` gate is gone: dark
  or lit, caught in the fan with line of sight = seen (running dark still
  trims the fringe — a lit pod reads at 1.4× the drawn arc, so F stays a
  real verb). Sweep 1.05 → **1.6 rad/s** (a pass every ~4 s), engaged walk
  1.9 → **2.6**, tracking stiffened. Also fixed: digging straight into a
  hall's heart now posts the warden (a `d > 5` gate used to skip it).
  On "empty rectangles": those halls ARE the glyph rooms — the stones are
  set in their walls — so the warden was always the stone's guard; with the
  beam honest it should finally play that way. Plate: `warden-dark-pod.png`
  (lamp off, white shaft, hull ticking). Retest `?fauna=warden`.
- **Stillwalker — light is a leash only while you FACE it.** Lamp on holds
  the one in front of you; the one on your blind side walks anyway, and two
  thirds now spawn behind you. Art pass (DRAFT — your verdict): 2.5 → 3
  tiles tall, broader through the head/torso/limbs, thicker breathing frost
  rim, and two cold gaze points that open only while it hunts. Plates:
  `stillwalker-lit.png`, `stillwalker-hunting.png` (lamp on, walker behind,
  eyes open — the new rule in one frame). If this still isn't it, the next
  swing is a real redesign — say the direction.
- **Polyps root at value.** A cluster now grows at the *richest wall in
  reach* — scored by ore density, wreck bays, glyph-stone approaches — so
  the sacs stand between you and the thing you want. Random-wall clusters
  are gone.
- **The self-trapped builder** (your screenshot) was a Shellback sealing its
  own last exit. Two fixes: it refuses a plate that would wall itself in,
  and if anything walls it in anyway it eats an adjacent pearl and crawls
  out. Suite: `shellback digs itself out` OK.

Docs (THREATS.md, BESTIARY.md, bestiary cards, sandbox cards) rewritten to
the new canon. One outstanding suite note: the brinewyrm leg of fauna.mjs
flakes under machine load (pre-existing timing, its logic untouched).

## 5.5 · New since this page was written: NG+, slots & the controls page

- **NG+ shipped — "the Second Descent."** Your call ratified: prices scale.
  Every true-ending epilogue now offers BEGIN THE SECOND DESCENT: fresh
  expedition in the same slot that keeps what you KNOW (Forge tech, glyphs,
  the found-log archive) and resets what you OWN (money to the ✦40 advance,
  upgrades, worlds re-seeded) — and every Lumen sticker compounds **1.5× per
  descent** (fuel, repair, kit, garage tiers, scanner/beacons, stipends, the
  tow's fuel bill, waystation metering — ore values deliberately hold still).
  Capped at ×3.375 (third descent). Dispatch greets a repeat driller; the
  slot row wears an NG+ tag; suite: `descent.mjs`. Tuning lever: one array,
  `DESCENT_PRICE_MULS` in config.ts. Plate: `finale-descent.png`.

- **Three expedition slots.** The title now lists every save as its own row
  (world · depth · purse · hours) with a per-slot ✕ erase (two-step arm);
  NEW EXPEDITION lands in the first empty slot without touching the others.
  Only a full roster arms the old "erase the last-played slot" fallback.
  Plates: `title-slots.png`, `title-slots-armed.png`. Your existing save is
  slot 1 as-is — nothing moved.
- **Pause → CONTROLS.** The crammed pause legend is now a full page, grouped,
  in whichever device's glyphs your hands are on. Pause itself is just the
  four buttons. Plates: `pause-menu.png`, `controls-keyboard.png`,
  `controls-pad.png`. Veto point: if you want the one-line legend back on
  the pause screen too, say so.

## 6 · Perf (finally, real numbers)

Settings → FPS counter on. Note FPS: at the surface, at 400m with a swarm
lit, in a Warden hall, and in the garage stage. This is the project's first
real-GPU reading — whatever you see becomes the baseline.

---
When you're done: vetoes and tuning notes in any form; everything else ships
on your word. Nothing is pushed until then.

## Verdicts so far (2026-09-10)

- §1 rock break — **APPROVED** (no fatigue flag)
- §1 value loop (arc + cargo bump) — **APPROVED**
- §1 terrain faces — **APPROVED**
- §2 the garage, whole section — **APPROVED**: staging beat, zoom as-is
  (tz 5.8 stands), sell tally speed, refit legibility in play, drill arm
- Found & fixed during the pass: drill stow/sticky-aim (incl. the high-fps
  grounded flicker), deck-lift flush to the plates, airborne aim-home,
  live Dispatch VO wired, the ✦-0 overdraw.
