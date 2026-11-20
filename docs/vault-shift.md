# THE LAST SHIFT: the descent

Room 3, built by `scripts/author-shift.py` (idempotent: running it twice
leaves `src/world/vaults.ts` unchanged) and proved by `scripts/routes/shift.js`.
The author script's docstring walks the drawing. This page keeps the playtest
numbers.

## v6: the first drop (playtest, 2026-11-20)

> "on the drop down i cant find a way to not die, if you try to leave the
> path you die, falling straight down you die"

**What killed the player** (traced in the real runtime from the L foot,
x 36-38 row 10):

- **Falling straight down** carried the walk's momentum (3.6-4 t/s, no air
  drag) about 3.5 tiles right in the 8-row fall to the unseen `_` plane at
  row 18. The plane's hole was only the shaft's own four columns (39-42), so
  the body died on the plane at x 43. Anyone who got past it landed on the
  fangs at 42-43.
- **Leaving the path**, meaning steering toward the visible safe block
  (34-38, with the sconce), died on that same unseen plane, which ran under
  the whole block. The only survivable line was to steer left starting 20-33
  frames after the lip: below the plane, but early enough to clear the fangs
  at 39-40. The other target was the single safe square at x 41.

**The change** (shift room data only, no runtime change):

- The row-18 plane is holed over x 34-46 (it was 39-42), so nothing you can
  see below is guarded by a floor you can't see.
- Storey 2's block runs out from 34-38 to **34-46** (rows 25-26). This
  replaces the spiked shelf at 39-43 (fangs at 39-40 and 42-43, one safe
  square at 41). The walk-off, a hop, holding right and steering left all
  land on it now. The sconce (36,24) and the lantern launch at the block's
  west end are where they were.
- Why it has no fangs: a variant with the fangs kept at 39-40 and the shelf
  safe from 41 failed. A jump back to the sconce block from the shelf starts
  inside the downdraft, which crushes it to about 1.25 tiles, and it died on
  the fangs 0/18. The first wind now teaches the fall. The third shaft, at
  the finish, still pours onto a fanged shelf with one safe square.

**measure()**, from rest on the L foot (36.8, row 10) across the two
watch-lights' common cycle (1020 frames, sampled every 30), with 22
techniques, each braking on landing (`phasesOK` is 1.00 both before and
after: no light reaches this beat):

| | techniques that land |
|---|---|
| before | **3 / 22**: steer left starting at frame 24 or 32 after the lip, and edging off at a crawl onto the single safe square |
| after | **21 / 22**: walk off and let go (lands x 44), hold right (46), hold down (43), edge off slowly (42), steer left from frame 0/8/16/24/32, tap left 10 f at 0/12/24, steer right from 0/16, hug the L foot, short hop (none/left/right), full hop (none/right), spark down-left mid-fall |

The one that doesn't land is a full hop with a hard steer left: it comes
back down on the L foot, which is not a death.

## Route (spawn to stone, `plan()`, no teleports)

`completed: true`, about 44 s of play, 0 re-forms. Rest points, each stood on
for two full 1020-frame light cycles: the start shelf behind the pillar
(x 10.0-10.4) and the L foot (36.3-38.5). The pedestal and the L top are
**not** safe to stand on. Storey 1 is one run from the pillar to the L,
timed off the start shelf.

## Not touched (worth a look in the next playtest)

- **The third drop** (b at 38-43 into shaft 3) has the same geometry the
  first one had: an unseen plane at row 50 holed only at 44-47, and fangs at
  44-45 and 47-48. From a walk-off, the steer left onto the sconce shelf
  (39-42) works only if it starts 20-24 frames after the lip. Hops give a
  similar window of about 8 frames. The route makes it, but a player is
  likely to report this drop the way they reported the first.
- **The fading shelves** hold 1.7 s a side in opposition, with 9 tiles from
  one deck to the next. That is faster than walking (3.6 t/s) or a running
  jump allows, so most hops need a spark.
- **Shaft 2's landing** sits inside its own downdraft. A jump started there
  is crushed, so the hop to the first A deck has to leave from the lip's
  last inch.
