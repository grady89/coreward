# THE RETURN: miss once, and you return

Room 8 (`return`, MAELIS-6). 220 × 46, open sky, ten 22-column chambers,
**39 jumps and no sconce**. The entry is the only place the body re-forms, so
a fall anywhere sends you back to the threshold. The room is the glyph's
cradle drawn as one stroke: up the left limb, over the crown, down the right
limb to the stone.

- Authored by `scripts/author-return.py`. Its docstring lists every jump with
  its type, gap and rise, and the script asserts that no jump is blind across
  a camera cut.
- Proved by `scripts/routes/return.js`: spawn to stone in one life, then a
  deliberate miss from the last footing, which must re-form at the entry.
- Guarded by the `return` stage in `scripts/vaults.mjs`: open sky, zero
  sconces, zero doors, a walk off the last footing re-forms the body at the
  entry, and the stone is taken on foot.

## How it was measured

Every jump was measured in the real runtime (`__game.vault.frame`), starting
from the footing before it with the spark state a player actually has there
(drank footings start spent). Each jump has one timing variable, swept one
frame at a time, and the **window** is the longest run of consecutive frames
in which one fixed technique lands it:

- running jumps: the take-off frame (where on the run-up jump is pressed,
  coyote included)
- spark jumps: the frame the spark is fired
- wall climbs: the frames spent on the wall before each kick
- timed beats: the start phase across the hazard's whole cycle (bolt 102 f,
  bridges 204 f, lantern 153 f)

A jump also had to stop on its footing and stay there: a landing that slides
off counts as a miss.

## Windows, in route order (frames)

| # | jump | variable | window |
|---|---|---|---|
| 1 | threshold → first, run, gap 3 | take-off | 39 |
| 2 | first → second, run, gap 2, rise 2 | take-off | 41 |
| 3 | second → chimney, run under the left wall | take-off | 28 |
| 4–8 | chimney, five kicks to the crest | kick delay | 19 |
| 9 | crest → post, run + 45° spark, gap 7 | take-off / spark | 22 / 11 |
| 10 | post → dry step, stand + 45° spark, rise 4 | spark | 23 |
| 11 | dry step → single wall, run, gap 3 | take-off | 30 |
| 12–15 | single wall, four kicks, no spark | kick delay | **9** |
| 16 | high step → far lip, full-length, gap 5 | take-off | 24 |
| 17 | far lip → low a, hop under unlight | take-off / hold | 38 / **11** |
| 18 | low a → low b, hop | take-off | 36 |
| 19 | low b → causeway, hop out | take-off | 41 |
| 20 | causeway → post two, full-length, gap 5 | take-off | 24 |
| 21 | post two → post three, gap 4, rise 2 | take-off | 19 |
| 22 | post three → turn step, gap 5, drop 2 | take-off | 36 |
| 23 | turn step → the turning wall | take-off | 30 |
| 24 | kick back left onto the hook | kick delay | 24 |
| 25 | hook → over, spark up and over the wall | spark | **10** |
| 26 | over → bridge stone, through the plumb bolt | phase | 54 of 102 |
| 27 | bridge stone → a1 | phase | 82 of 204 |
| 28 | a1 → island | phase | 102 of 102 |
| 29 | island → b1 | phase | 73 |
| 30 | b1 → a2 | phase | 73 |
| 31 | a2 → b2 | phase | 60 |
| 32 | b2 → perch | phase | 102 |
| 33 | perch → the lantern's crown | phase | 35 of 153 |
| 34 | ride → lantern lip, leap + spark | leave / spark | 82 / 41+ |
| 35 | lantern lip → needle, drop 6, 1-wide | take-off | 22 |
| 36 | needle → far ledge, spark, brazier, spark | 2nd spark | 35+ |
| 37 | far ledge → sill, late spark, drop 7 | spark / take-off | 32 / 33 |
| 38 | sill → vent → vent lip | steer-out | 113 |
| 39 | vent lip → the stone, late spark, gap 11, drop 8 | spark | 21 |

**The tightest five:** the single-wall kicks (9), the spark over the turning
wall (10), the spark onto the post (11), the jump hold under the low road's
unlight (11: holding past about 12 frames puts the head in it), and the
chimney kicks (19). Nothing is near the ~4-frame floor. The difficulty is
meant to come from carrying 39 of these in one life, not from any single one.

## Skips

A skip search ran every footing against both directions, four run-ups, two
holds and the spark in 8 directions at 6 timings, and recorded every footing
it reached. What it found, and what was done:

- **Closed.** The low road's roof was standable, and from it you stepped
  straight onto the hook, cutting the low road and the turn. There is unlight
  on top of the roof now. The vent's cap was standable the same way and has
  unlight on it too.
- **Closed.** From the island a late spark reached the perch, skipping all
  three bridges. The bridges now climb four courses, out of spark reach.
- **Closed.** From `over` a late spark reached the island. `over` is drank
  stone now, so you arrive there spent.
- **Closed.** From the vent lip a late spark reached the stone's ledge past
  the last post. The stone now sits on that post, so the longest reach is the
  last jump.
- **Accepted, one footing each.** At the start, a late spark from the
  threshold reaches `second`. On the bridges, a spark from the bridge stone
  reaches the island (skipping a1), and one from the island reaches a2
  (skipping b1); both still land on a timed bridge. From the far ledge, a late
  flat spark carries through the vent's column and out onto the vent lip: it
  skips the sill but still rides the vent. Where a spark would allow a skip
  anywhere else, the footing it starts from is drank, so a player arriving
  there has nothing to spend. With real spark states, the twelve jumps from
  the high step to the turn step have no forward skip at all.
- **The lantern cannot be bypassed.** From the perch with a charged spark,
  4,400 attempts (every swing phase, four run-ups, sparks in three aims at
  18 timings) reached the lantern lip zero times without riding the crown.

## Time

The route squares up on every footing, stops dead after every landing, and
waits out the bolt, the bridges and the lantern. Played that way, spawn to
stone takes **72.3 s**, of which about 19 s is squaring up and stopping. A run
that chains its landings into the next take-off is about 53 s.

## Known, not this room's

- The open-sky backdrop's drifting blocks sometimes sit in front of a ledge in
  the gameplay frame (the chimney's right wall at the threshold, for one).
  Every room has them. They are engine scenery, not authored here.
- The `lint · sconce at boundary` report lists all nine of this room's cuts as
  unlit. That is the design, and the lint only reports (ruled 2026-09-04).
