# THE EMBER: playtest record

Room 5. v7 was rebuilt on 2026-11-21 by `scripts/author-ember.py`, whose
docstring walks the path beat by beat. `scripts/routes/ember.js` proves it in
the real body:

```sh
node scripts/vaultplay.mjs --room=ember --port=4181 scripts/routes/ember.js
```

## Why v7

The playtest after v6 said:

> Ember is still not clear at all where the heck im supposed to go. theres a
> lot of map to drop down, lots of possible directions and they all seem to
> lead with death

v6 lit a branchy room: 44 x 97, mostly open air, with drops of 15 to 25
courses whose landings sat out of frame. The light over the void and the mote
trail (commit 6d87fa2) decorated those drops. They did not take any away.
THE RETURN reads because there is one line and every footing on it is in
view. v7 rebuilds THE EMBER on those terms rather than signposting the old
room again.

## The path

44 x 34. Two 22-column chambers, cut at column 21. The room is no longer open
sky (`openEdges` is gone). It is solid rock with one line carved through it,
and the line switches back four times on its way down:

```
    0         1         2         3         4
    01234567890123456789012345678901234567890123
  0 ############################################
  1 #.............................#...........##
  2 #...........................o.#.o.........##
  3 #.........................o...............##
  4 #.................................o.......##
  5 #@........................................##   1 ice walk  ->  2 lantern
  6 ####RRRRRR..RRRRRR######..................##
  7 ####XXXXXXXXXXXXXX######..................##
  8 ########################XXXXXXXXXXX####RRR##   3 trapdoor + piston
  9 #.......................###############...##
 10 #..................................####...##
 11 #.............o..........o...*..o.........##
 12 #..................S......................##   4 two breaths  <-  (S1)
 13 #...........o...########XXXXXXXXXX##########
 14 #...............############################   gate (row 14, cols 1-15)
 15 #.........*.....############################
 16 #...............############################   5 plunge
 17 #...............############################
 18 #XXXRRRR####XXXX############################   6 throat
 19 ####....####################################
 20 ####....##.................................#
 21 ####.....................o..*.o..*..o......#   7 ride  ->  8 three breaths
 22 ####.......................................#
 23 ############.........###XXXXXXXXXXXXXX###..#
 24 ############.........####################..#   gate (slot)
 25 ############XXXXXXXXX###...................#
 26 ########################...................#
 27 #####......................................#
 28 #####...........o.........o............#####
 29 #####..................................#####   9 last walk  <-
 30 #####...#################RRRR..RRRR#########
 31 #####NM.#################XXXXXXXXXX#########
 32 ############################################
 33 ############################################
```

Rest points are in **bold**. The row is the course you stand on.

1. **Spawn** (1-3, 6). **The ice walk** runs east over two rime shelves on a
   fang bed. The shelves crumble 0.55 s after you touch them, and there is a
   two-tile gap to hop. You land on **L1** (18-23, 6), which straddles the
   cut.
2. **The lantern.** Catch its crown at the slow end of the swing, ride east
   over the fang pit, and step off onto **L2** (35-38, 8), the piston
   housing's roof.
3. **Trapdoor and piston.** Step onto the rime lid. It drops you down a chute
   that a piston punches across, and you land on **L3** (34-41, 13).
4. **Two breaths.** Under a roof three courses high, go west over a fang bed:
   spark, the brazier refills you, spark again. You land on **L4** (16-23, 13),
   which straddles the cut. **S1** is the room's one light.
5. **The plunge.** Jump off L4's west lip, through the curtain (the gate),
   onto **P1** (8-11, 18) under the hanging ember. The band under the curtain
   wakes the dark. A walk-off lands in the fangs.
6. **The throat.** A rime lid sits between two housings, and two pistons
   close under it like jaws. Step on as they open and fall through to **P3**
   (4-11, 23).
7. **The ride.** A lantern hangs from L4's underside over a fang pit. The roof
   is too low to jump the pit. Hop onto the crown, ride east, and step off
   onto **P4** (21-23, 23), which straddles the cut.
8. **Three breaths.** Under the same low roof, cross a 14-tile fang bed east:
   spark, brazier, spark, brazier, spark. You land on **P5** (38-40, 23).
9. **The slot.** Walk off P5 into the slot beside it, through the second
   curtain, and land on **the ledge** (39-42, 28). Step down to the floor.
10. **The last walk.** Go west over the last rime, which has the ice walk's
    gap, and on along the stone. The dark is now a course or two over your
    head. Pass under **the last piston** as it lifts and step down into the
    stone's pocket (5-7, 32). The dark's zone ends at row 29, one course above
    the pocket.

The rules the map was cut to:

- Anything that is not the path is stone.
- Every pit on the path has a fang bed you can see from where you stand. The
  fangs are flush with the footing or one course below it.
- No step down is deeper than the frame shows. At 1280 x 800 a 22-column
  chamber frames 23.6 columns by 14.75 courses, and the body sits 0.5 below
  centre. That leaves about 6.3 courses visible under your feet. The deepest
  step is 5 courses.
- Every camera cut is crossed on foot, over a stone that straddles it: L1, L4,
  P4, and the last walk's floor.

## What was cut

- **The open void.** The 97-course height, the open sky (`openEdges`) and
  every fall space that read as an option. The room is now 34 courses.
- **The long blind drops.** The old plunge (22 courses down onto a two-tile
  ledge out of frame), the old throat's 17-course shaft, and the column's
  25-course free fall onto a fanged roof.
- **The plunge's spark.** The old plunge needed a flat spark at the ember to
  reach P1. The new plunge is a short visible jump. The ember still hangs over
  P1 and marks it from S1, and it is the brazier in chamber A that the P4 lint
  wants.
- **The cascade.** Its two rime shelves stepped down and west under the
  crossing's fangs. The last walk's rime (the ice walk again, under the dark)
  replaces it.
- **The column and the seed's roofed chamber.** The wall-to-wall piston over a
  fang column, and the spark east under the roof's lip. The last piston, which
  stamps down from the tunnel roof, replaces them, and the stone sits at the
  end of the walk in a pocket you step down into.
- **The v6 signposting.** The ember hung over the void and the plunge's mote
  trail are gone with the void. Motes now mark only the arcs that are taken.
- **The full-width gate.** The first gate is the plunge hall's curtain. The
  second has moved from the column to the slot by P5.
- **The dark's speed.** It was 2.8 tiles/s, which suited a 76-course fall. The
  new chase is mostly sideways and descends 12 courses in about 25 s, so the
  dark pours at **0.77 tiles/s**. It starts at row 9, just under the ice walk,
  so you can see it over the gate from P1.

## Legibility: the next footing from every rest point

The frame bounds below are the real camera's: `cutTo` at the rest state, then
`camera.position` ± `halfW/halfH`. The screenshots are the player's view of
each rest point: `design-review/ember-v7-00.png` … `ember-v7-21.png`.

| # | rest point | frame cols | frame rows | next footing (in frame?) |
|---|---|---|---|---|
| 00 | spawn | 0-23.6 | 0-14.7 | ice shelf: in, 8.7 courses spare |
| 02 | L1's lip | 20.4-44 | 0-14.7 | lantern swing and L2: in |
| 03 | L2 | 20.4-44 | 0-14.7 | lid in. L3 (row 13) in, 1.7 spare |
| 05 | L3's west lip | 20.4-44 | 4.6-19.4 | L4's east 3.6 cols, and the brazier: in |
| 07/08 | S1 / L4's lip | 0-23.6 | 4.6-19.4 | P1 (row 18): in, 1.4 spare |
| 09/10 | P1 | 0-23.6 | 9.6-24.4 | throat lid, and P3 (row 23) 1.4 spare: in |
| 12 | P3's lip | 0-23.6 | 14.6-29.4 | lantern swing and P4 (2.6 cols): in |
| 13 | on the chase lantern | 0-23.6 | 15.1-29.9 | P4: in |
| 15 | P4's lip | 20.4-44 | 14.6-29.4 | both braziers and P5: in |
| 16 | P5 | 20.4-44 | 14.6-29.4 | the ledge (row 28): in, 1.4 spare |
| 17 | the ledge | 20.4-44 | 19.3-34 | floor: in |
| 18 | off the ledge | 20.4-44 | 19.3-34 | both rime shelves: in |
| 19 | past the rime | 20.4-44 | 19.3-34 | the floor ahead: in. The piston shows once you cross the cut, which you do on that floor |
| 20 | before the last piston | 0-23.6 | 19.3-34 | the piston and the pocket (row 32): in, 2.0 spare |

L3 from L2 is the closest case. The frame is pinned to the room's top course
there, so L3 was raised to row 13 to show 1.7 courses under it.

Reading each shot as a first-time player, there is one move on screen every
time. The only footing is the next one, every other surface carries fangs or
belongs to a piston, and the walls close everything else.

## Branch check

From each rest point I ran a battery of 107 techniques at 4 hazard phases (0,
51, 102 and 153 frames), 428 runs per rest point. The dark was held off. The
battery:

- walk off west and walk off east
- a jump while running west, standing, or running east, with no spark or with
  a spark in each of the 8 directions at 4, 14, 28 or 44 frames
- wall-kick mashing each way, alone, with an up-spark, or with an away-spark

Each run ended **on a path footing**, **dead** (classified by the nearest
hazard to where the body was), or still moving after 7 s ("unsettled": wall
slides, rides and so on).

| rest point | on the path | dead | off-path rests |
|---|---|---|---|
| spawn | spawn 228, ice 48 | fangs 92 | **0** |
| L1's lip | L1 136, ice 10 | fangs 187, lantern 26 | **0** |
| L2 | L2 88, lid 40, L3 50 | fangs 132, piston 49, lantern 12 | **0** |
| L3, chute end | L3 117 | piston 262, fangs 4 | **0** |
| L3's west lip | L3 148 | fangs 232 | **0** |
| S1 | L4 192, throat lid 4 | fangs 116 | **0** |
| L4's lip | L4 148, P1 36 | fangs 108 | **0** |
| P1 | P1 116, throat lid 16, P3 31 | fangs 147, piston 58 | **0** |
| P3 | P3 86, P1 1 | piston 290, lantern 7, fangs 1 | **0** |
| P3's lip | P3 149 | fangs 127, lantern 74, piston 11 | **0** |
| P4 | P4 65, P3 3 | fangs 290, lantern 37, piston 1 | **0** |
| P4's lip | P4 60 | fangs 311, lantern 28 | **0** |
| P5 | P5 64, ledge 133 | fangs 185 | **0** |
| the ledge | ledge 236, floor 83, rime 4 | fangs 12 | **0** |
| off the ledge | floor 144, rime 32, ledge 64 | fangs 116 | **0** |
| past the rime | floor 156, rime 21 | fangs 155, piston 2 | **0** |
| before the last piston | floor 177, rime 4, pocket 3 | piston 136 | **0** |

The remaining 29-136 runs per rest point were still moving at the 7 s cutoff.
Almost all of them were standing on the same path footings (a kick-mash
still pressed into a wall, for example) or riding a lantern. Nine of the
7,276 runs ended airborne or sliding a wall, wedged into a corner of the path
itself: spawn's east face over the first shelf (4 runs), L4's west face
under the lip (4), and the throat shaft's east wall (1). Each one is reached by an up-left spark pressed into
the corner, and input frees it. None is a footing.

No run anywhere came to rest off the path. Every landing is the rest point
itself, the next footing, a later footing on the same line (the plunge onto
the throat lid, a fall into the slot onto the ledge), or an earlier one (P3
back up the shaft to P1, past the jaws). Every death is on fangs, a piston
or a lantern you could see from the rest point. The two gates turn back every
climb back up.

Accepted: from L1's lip a run and a late up-spark crosses the teach lantern's
pit to L2 without riding (0.47 of phases). It lands on the same footing the
ride does. The chase lantern cannot be skipped: from P3, 19 techniques × 17
phases that never touch the crown reached P4 zero times.

## Difficulty, measured from the rest points

`phasesOK` follows `docs/vault-playtest.md`: it is the share of start phases
in the hazard's cycle where at least one technique works. A beat with no
cyclic hazard instead reports how many techniques work. The dark is held off
here; it is measured below.

| beat | rest point | phasesOK | techniques that work |
|---|---|---|---|
| 1 ice walk | spawn | — | 15/20 run-and-hop variants. Walk-offs and hopping at the wrong edge die |
| 2 lantern | L1's lip | 0.22 (153 f cycle) | ride: 8 variants, two windows a swing. A run plus a late spark across: 0.47 (accepted) |
| 3 trapdoor | L2 | 0.71 (204 f) | 9 stop/steer variants |
| 4 two breaths | L3's lip | — | two sparks 24/36. **One spark 0/26** |
| 5 plunge | L4's lip | — | 12/15. A walk-off dies on the fangs |
| 6 throat | P1 | 0.59 (204 f) | 9 stop/steer variants: step on as the jaws open |
| 7 ride | P3's lip | 0.45 (153 f) | 12 hop/leave variants. **Without the crown, 0** |
| 8 three breaths | P4's lip | — | three sparks 31/144 (34/384 on a wider grid). **Two sparks 0/120, one 0/30** |
| 9 last rime | off the ledge | — | 16/20 hop variants. Stop on the rime and it drops you |
| 10 last piston | before it | 0.31 (204 f) | run under it as it lifts: about a 1.05 s window each 3.4 s |

## The dark

The zone is `[0, 9, 43, 29]`, `dir: 'down'`, at 0.77 tiles/s. It arms in the
band under the plunge hall's curtain (rows 15-17) and starts at row 9, the
hall's ceiling. Its bottom row (29) is the last walk's course, so it ends one
course above the stone's pocket.

The route replays the chase from S1 at eight departures 76 frames apart. That
spans the 612-frame common cycle of lantern (153) and pistons (204). Below is
the dark's lead, in seconds, as each beat lands. At the stone it is measured
against the last walk's course, as you step down off it:

| beat landed | lead, worst … best |
|---|---|
| plunge (P1) | 10.9 |
| throat (P3) | 13.8 … 15.1 |
| ride (P4) | 9.0 … 11.6 |
| three breaths (P5) | 6.6 … 9.3 |
| slot (ledge) | 11.4 … 14.1 |
| last rime | 9.0 … 11.7 |
| **stone** | **2.0 … 6.5** |

All eight departures finish. The dark comes on screen over the gate as you
land on P1. It hangs at the top of the frame through the ride and the three
breaths, and it is a course or two over your head on the last walk. The
worst phase leaves 2.0 s for the whole chase. Hesitate that long anywhere
and the dark takes you on the last walk, and the light you re-form at is S1.

## The route

`scripts/routes/ember.js` plays spawn to stone with `plan()`. It uses no
teleports, and the doors, checkpoints, rime and dark are all real. Result:
**completed: true, 42.0 s, no re-forms.** The teach takes about 18 s and the
chase from S1 about 24 s. The route then replays the chase from S1 at the
eight departures above, and **all eight complete**, with chase times of
23.7-28.2 s.

## Suites

- `vaults.mjs`: the bare run is green: 47 checks OK, no page errors, exit 0.
  The ember stage's `the pursuit` check had to change with the room. It used
  to stand the body 1.5 rows above the dark's edge after 54 frames, which
  assumed a fast dark. At 0.77 tiles/s the edge is only 0.7 rows into the
  zone by then, so that spot was above the zone, and the check failed.
  It now stands the body halfway between the zone's top and the edge. That
  spot is inside the zone and above the edge at any speed. Its other checks
  (`censers swing`, `the descent commits`) pass unchanged.
- `vaultfit.mjs`: ember reachable 1/1. The P5 model shows it proved and
  graded.

## A flaky check, not from this room

`vaults.mjs` → `dead surface` (proving stage) failed under load before: it
times itself with wall-clock `setTimeout`. The proving room is untouched here.
