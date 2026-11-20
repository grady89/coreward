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
  the finish, still pours onto a fanged shelf (see below).

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

## v6: the third drop (same trap, fixed the same way)

The walk off the last b deck (x 38-43, row 42) into shaft 3 had the first
drop's geometry: the row-50 plane was holed only at 44-47, and the shelf
under the wind was fanged at 44-45 and 47-48 around one safe square (46).

**A runtime rule this beat runs into:** `vault.ts` (the `currentSpan` build)
extends every current's rect up and down to the first row with stone in its
columns. A current's `y1` therefore does not end the wind: shaft 3's
downdraft reached the floor (row 57). A jump begun anywhere under it peaks
at about 0.9-1.6 tiles. Before the change, the climb from the old safe
square (46) back over the fangs to the sconce shelf died 0/4. Even a body
that threaded the needle could only die afterwards.

**The change** (room data only):

- The row-50 plane is holed over x 39-49, above the sconce shelf, the shaft
  and the shelf beyond it (it was 44-47).
- The finish shelf runs 44-50. The fangs at 44-45 stay, under the wind's west
  half, where a steer for the sconce that comes too late lands. The east pair
  (47-48) is gone, because the walk-off landed on it.
- A corbel at (47, 52) on the shaft's east wall. It is the stone the runtime
  stops the wind on, so the downdraft now ends at row 51, six courses above
  the floor, and no jump from the floor reaches it. It also catches the
  plain walk-off, which is a safe perch: walk off east to the floor. The
  shaft's `y1` is set to 51 to match.
- Side effect: a body that drops through b's east four columns (39-43) when
  b fades now lands on the sconce shelf instead of dying on the plane.

**Climb back from the east side**, after the change: from a standing start
at 47.5, 48.5, 49.5 or 50.3, a full jump west with a run-up from 47-48 lands
on the sconce shelf (6-8 of 12-20 jump variants each, sparks optional).
From a standstill at 46.5, with no room to run, it still fails (0/4), so
step east first.

**measure()** (same 22-technique matrix as the first drop). b is a fading
deck with no rest point, so each technique starts the frame b comes on, from
x 39.5, 41.0 and 42.5 (66 runs). No watch-light reaches this beat.

| | runs that land | |
|---|---|---|
| before | **3 / 66** | only "steer left from frame 24" lives. The rest die on the unseen plane (straight fall, holding right, early steers, hops, the spark) or on the fangs (walk-off, hold down, late steers). |
| after | **38 / 66** | walk off and let go (onto the corbel), hold right (51), hold down (47), edge off slowly (2 of 3 starts), steer left from frame 0/8/16/24 (lands 39-42 at the sconce), steer right from 0, hug the lip, short hop and full hop with no steer, the spark down-left (39) |

What still dies, and why:
- **On the visible fangs:** a steer begun at frame 32, a 10-frame tap left,
  and a crawl off the lip from 42.5.
- **Off the shelf's east end into the void:** holding right after a hop or
  from frame 16.
- **Past the sconce shelf's west end:** a hop with left held for the whole
  fall.

## Route (spawn to stone, `plan()`, no teleports)

`completed: true`, about 47 s of play, 0 re-forms. The third drop now uses a
plain walk-off with a steer left begun 0-24 frames after the lip. Rest points, each stood on
for two full 1020-frame light cycles: the start shelf behind the pillar
(x 10.0-10.4) and the L foot (36.3-38.5). The pedestal and the L top are
**not** safe to stand on. Storey 1 is one run from the pillar to the L,
timed off the start shelf.

## Not touched (worth a look in the next playtest)

- **The fading shelves** hold 1.7 s a side in opposition, with 9 tiles from
  one deck to the next. That is faster than walking (3.6 t/s) or a running
  jump allows, so most hops need a spark.
- **Shaft 2's landing** sits inside its own downdraft. A jump started there
  is crushed, so the hop to the first A deck has to leave from the lip's
  last inch.
