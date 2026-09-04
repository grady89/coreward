# THE WICK — vertical slice beat map

The tutorial that uses no words, and **the only room in the game with no
walls**. 73 × 48, four chambers, seventeen beats.
Source: [scripts/author-wick.py](../scripts/author-wick.py) → `src/world/vaults.ts`.
Verified: `npm run levels:verify -- --room=wick --verbose`.

All distances are fractions of the **measured** running jump (5.45 tiles
across, 2.68 up — [movement-metrics.md](movement-metrics.md)).

```
    left ------------> right ------------> up the staircase
```

---

## The contract: open sky

There is no floor under the traverse and no wall beside the shaft. Every
landing in the room was put there on purpose; everything else is a fall.

The invisible boundary sits **eight tiles out** on every side (`VOID_PAD` in
[vault.ts](../src/game/vault.ts)) — about a jump and a half of slack, and
generous deliberately. A wall one block past the last platform kills players
who are still steering back from a missed landing: a death they can neither see
coming nor learn from. Past the pad the fall was already over.

The fall is checked **before** the invulnerability gate. A body eight tiles
outside the room is not in a scrape that invulnerability can spare it from.

## Two lights, three cuts

| | column | what it costs to fall after it |
|---|---|---|
| sconce 1 | 4 | nothing — it is the start |
| sconce 2 | 63 | **the whole traverse**, nine beats |
| the stone | 64 | eight beats of climb |

Not one light per camera cut. The traverse crosses cuts at 17, 34 and 50
unlit, on purpose — nine beats from the first light to the second is a single
unbroken run, and that is where the room's risk lives. See rule 7 in
[level-design-principles.md](level-design-principles.md).

Cuts are inclusive last-columns, so the final chamber is **51–72** and holds
the spark gap *and* the whole shaft. The far lip of a teaching gap has to be
visible from the launch; a cut mid-flight would hide the thing the beat exists
to show.

## The traverse · beats 1–9 · **INTRODUCE → DEVELOP**

Four rungs of about 0.18× each, and the spark is simply the fifth.

| beat | dx | ×jump | verb | margin | ask |
|---|---|---|---|---|---|
| 1 | 4 | 0.73× | legs | 21f | the first hop — nothing under it |
| 2 | 4 | 0.73× | legs | 21f | two tiles wide from here on |
| 3 | 5 | 0.92× | legs | 20f | |
| 4 | 5 | 0.92× | legs | 21f | **down** as well as up |
| 5 | 5 | 0.92× | legs | 21f | |
| 6 | 6 | 1.10× | legs | 15f | lands on **one tile** |
| 7 | 6 | 1.10× | legs | 11f | |
| 8 | 6 | 1.10× | legs | 18f | past the honest reach, caught on the fall of the arc |
| 9 | 8 | **1.47×** | **spark** | 30f | **the teaching gap** |

Beats 6–8 cross **1.10× the running jump** on legs alone. That is past the
arc's own width and only lands because the far lip is at or below the launch —
the body is caught on the descending half. It is the hardest thing the legs can
do in this game and the room spends three beats there before asking for
anything else.

**The teaching gap** is 1.47× the jump and 0.93× the spark. Unjumpable,
unambiguously, and both lips are in the same camera frame. The motes over it
**change shape**: every arc so far is a curve, this one is drawn straight and
rising. That is the only instruction the room gives.

It lands on the second light — so the reward for the room's one new verb is the
checkpoint, and the nine beats behind it stop being at risk.

## The staircase · beats 10–17 · **TWIST → CONCLUDE**

A zig-zag, not a ladder: every step has a direction in it. Four climb beats,
then three **forced kicks**.

| beat | dx | dy | ×jump | margin | ask |
|---|---|---|---|---|---|
| 10–11 | 3 | +3 | 0.55× | 21f | the foot of the stair |
| 12–13 | 4 | +3 | 0.73× | 11f | |
| 14 | 4 | **+4** | 0.73× | 13f | **kick one** — arrive at the face, not the top |
| 15 | 4 | **+4** | 0.73× | 14f | kick two, back the other way |
| 16 | 4 | **+4** | 0.73× | 13f | kick three |
| 17 | 4 | +3 | 0.73× | 11f | the head of the stair, and the stone |

The kick blocks sit **four courses apart** — past the 2.68 a jump can rise —
so their tops cannot be reached from the step below. What can be reached is the
**face**, and a wall inside 0.4 tiles is a kick whether you meant it or not.

They are drawn **three courses deep**. A single course is a floating cube and
nothing about a floating cube says *kick off me*; the extra stone hangs below,
so the tops stay four apart and the reach envelope is untouched. All that
changes is that there is now a face to see and to catch.

The shaft is open on both sides the whole way, so a fumbled kick has eight
tiles of sky to be corrected in before it becomes a fall.

---

## Harness output

```
wick GRADED platforms 18 · proved 39 · path 17 beats · tight(<6f) 0
     · stone reached · spark FORCED · fast line 22.9s
     · a miss costs 2.1 beats avg, 8 worst · undecided 2t
```

- **fast line 22.9 s** — up from ~10 s. Clear time is about 1.08 s per hop on
  the critical path, so the only way to lengthen a room is to make more hops
  unskippable, which needs a *serial* path. An open cavern always gives BFS a
  short route through the middle.
- **a miss costs 2.1 beats average, 8 worst.** Up from ~0. The worst case is a
  fall at the head of the stair, which returns you to the stair-foot sconce
  eight beats back. This is the number the room was rebuilt for.
- **tight(<6f) 0.** The tightest required input has 11 frames of slack against
  a 6-frame threshold — six being the coyote window, the game's own declared
  unit of forgiveness.

## Two things the harness caught in this rebuild

**1 · The spark gap was scenery.** The first build put the stair's foot at
(58,34) and the no-spark solve walked `(53,38)` to `(58,34)` on legs with 13
frames to spare. Four across and four up is well inside one arc once there is a
face to kick, and a single block is *all* face — so the room could be finished
without ever crossing the gap it exists to teach.

Wall-kicks chain for free, so the rule is not *the first step is hard to reach*
but **no step is reachable at all**: touch one and you have the whole shaft. The
shaft now lives entirely at x >= 62, six columns past the last thing on the near
side and rising. The gap is the only door into it.

**2 · The report was lying about the verb.** The tape search nested the dash
loop innermost, so it returned the first tape that worked at all — and since a
spark rescues a badly cut jump, that was almost always a spark. The verbose
output read `spark@2` on beats a walker clears, and quoted the spark tape's
tighter margin: beat 2 of the tutorial was reported at 6 frames.

`DASHES[0]` is `null`, so hoisting that loop **outermost** exhausts the entire
spark-free tape space before any spark tape is tried. The report now names the
cheapest verb that solves each beat — the one the player will actually find.
