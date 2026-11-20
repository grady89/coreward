# THE EMBER: playtest record

Room 5, rebuilt 2026-11-20 by `scripts/author-ember.py` (its docstring walks
the route). It is proved in the real body by `scripts/routes/ember.js`:

```sh
node scripts/vaultplay.mjs --room=ember --port=4181 scripts/routes/ember.js
```

## Beats, measured from their rest points

`phasesOK` follows `docs/vault-playtest.md`: the share of start phases across
the beat's hazard cycle where at least one technique works. The dark is held
off for these numbers. It is measured separately, below. Beats with no
cyclic hazard are timed against the player's own arrival, so they report
which techniques work rather than a phase share.

| beat | rest point | phasesOK | what works |
|---|---|---|---|
| 1 ice walk | entry | — (no cycle) | 18/24 run-and-hop variants; jumping the gap from x ≥ 8.6 |
| 2 lantern (teach) | L1 lip | 1.00 | 8/15: ride the crown, or a late up-spark across |
| 3 trapdoor + piston | L2 | 0.82 | 5/9: stand on the lid at any of three spots, fall straight or slide a wall |
| 4 two breaths | L3 | — | 9/64 spark timings; always spark → brazier → spark, a single spark never makes it |
| 5 plunge | L4 / S1 | 1.00 | 4/16: walk off, then a flat west spark late in the fall (frames 40–80). The legs alone fall short |
| 6 ride | P1 | 0.25 | 4/15, ride only: two windows a swing (~0.35 s and ~0.45 s). No spark reaches P2 |
| 7 throat | P2 | 0.59 | 3/12: step on the lid as both pistons go home; one continuous ~2 s window |
| 8 three breaths | P3 | — | 24/108 three-spark timings. Two sparks never make it, and high arcs die to the dark |
| 9 cascade | P4 | — | full jumps off each shelf, taking off anywhere in the first ~22 of the shelf's 33 frames |
| 10 column + seed | P5 | 0.65 | 16/24: hold the column, pass the piston when it is home, spark east under the roof's lip. Free fall dies |

## The dark

The pursuit zone starts at row 9, eight courses above the commit light, and
moves at 2.8 tiles/s. It arms in the band under the full-width gate. There
is no light below the gate, so every attempt meets the same chase.

The route was swept over eight departure times from S1, 76 frames apart,
which covers the 612-frame common cycle of lantern and pistons. The bot
takes the earliest window at every beat, and it finished from all eight.
The table gives the dark's lead in seconds when each chase beat landed:

| beat landed | lead (s), worst … best |
|---|---|
| plunge (P1) | 9.5 |
| ride (P2) | 4.3 … 5.6 |
| throat (P3) | 5.4 … 8.8 |
| three breaths (P4) | 2.4 … 6.5 |
| cascade (P5) | 2.2 … 6.2 |

The cascade and the crossing are where the dark closes in, because both
run more sideways than down. Lose about two seconds anywhere in the chase,
for example by missing the throat's window or the column's, and in the
worst phase the dark takes you.

A perfect run from spawn to stone takes the bot 43 s: about 17 s of teach,
then about 26 s from leaving the light to the stone.

## What playtesting changed

- **The first chase was bypassable.** The perch-over-the-lantern plunge,
  and the perch-to-throat jump, both worked in 100 % of phases with any
  technique. I rebuilt them: P1 sits fourteen tiles west, so the plunge
  needs the spark, and P2 is three courses above P1, so only the lantern
  reaches it.
- **The throat's pistons were phased against each other.** With the lower
  piston on the half beat (0.5), only 3 % of drops lived, in scattered
  3-frame slivers. An analytic sweep put it at 0.875, which gives one
  readable window: drop when both go home.
- **The dark ran at 3.4 tiles/s.** At that speed it caught the bot at the
  throat and the crossing in most phases. At 2.6 it left five seconds
  everywhere. The final setting is a zone top three rows higher with 2.8
  tiles/s, which survives every phase with about 2 s in the worst one.
- **The crossing was killed by its own arcs.** Up-sparks climbed into the
  dark. I tried lowering the braziers, but that broke every line (the
  natural arc passes above them), so I reverted. The crossing now rewards
  flat sparks.
- **There were skips.** A fall off L3's east end landed on P4, and a fall
  off P3's west end landed on the last piston's housing. Both are now
  closed with fang lines, and the housing is fanged on top.
- **A lint failed.** The P4 climax lint failed because every brazier sat in
  the last chamber. An ember now hangs under the commit light, in chamber A.

## v6: the way on from the commit light (2026-11-20)

The playtest note was: "Its really not clear which way to go after the first
section". The first section is the teach, which ends on S1. Standing there,
the chamber-A frame shows rows of about 11 to 25 and nothing else. P1 is at
row 40, fifteen courses under the frame's bottom edge, so the player cannot
see it. The gate at row 26 is also just out of frame. The only warm thing on
screen was the ember at (20,21), hanging straight under the player, and it
said "drop here". A straight drop landed on the throat's shoulders and lid,
which skips the plunge and the ride and often ends in the pistons. A plain
walk off the west lip dies on the lantern's fanged mount at (11,34) before P1
ever comes on screen.

Changes:

- The ember moved from (20,21) to (13,21). It now hangs out over the void,
  west of the lip, on the flat-spark line. Its chain stone is at (13,10),
  under the ice walk's fangs and out of every reach. A spark at it gets the
  spark back. The P4 lint still sees the ember in chamber A.
- The plunge motes were redrawn to run from the lip through the ember and
  on down to P1. The new motes are at (17,19), (15,20), (11,22), (9,24),
  (8,28), (6,33) and (5,37).
- The row-30 fang line now starts at x 14 (it used to start at 25), so it
  roofs the throat. Every braked drop off L4 now dies on it, where before
  each one landed on P2, the lid or the east housing.

The plunge sweep from S1 (walk off or run-jump, one west spark at frames
10…90, flat or up) is 10/38 both before and after. The beat is no harder
and no easier; only its read changed. The route is unchanged and still
completes. See the before and after shots: `design-review/ember-v6-before.png`
and `ember-v6-after.png`.

Still open: a body that falls without sparking to about row 31 and then
sparks east under the fang line lands on P2 and skips the ride. The window
is a few frames, and the skip predates this change.

## A flaky check, not from this room

`vaults.mjs` → `dead surface` (proving stage) failed three runs in a row
with `withholds: false`, once on the base commit `bc32588` built and served
alone, then passed on the final full run. It times itself with wall-clock
`setTimeout` under heavy machine load, and the proving room is untouched
here.
