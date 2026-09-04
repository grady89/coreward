# THE WICK — vertical slice beat map

The tutorial that uses no words. 56 × 34, four chambers, four steps.
Source: [scripts/author-wick.py](../scripts/author-wick.py) → `src/world/vaults.ts`.
Verified: `npm run levels:verify -- --room=wick --verbose`.

All distances are fractions of the **measured** running jump (5.45 tiles
across, 2.68 up — [movement-metrics.md](movement-metrics.md)).

---

## Chamber A · cols 1–13 · **INTRODUCE**

**Teaches:** the jump, and the one fact the game rests on — *a landing is a
launch*.

| beat | ask | distance |
|---|---|---|
| 1 | walk right off a wide threshold | — |
| 2 | jump the first gap | 0.55× |
| 3 | land short, jump again immediately | 0.62× |

The shelves are **three tiles wide**, so the natural landing spot is within a
tile of the next launch. There is no room to stop and line up, which is the
entire lesson. Motes arc over each gap at the apex.

**Nothing here can hurt you.** No unlight, no hazard, no timing. Chamber A is
the only place in the game where that is true, and it is true on purpose.

- Chain: **3 inputs**, one breath at the end.
- Intended time: ~8 s · intended deaths: **0**

## Chamber B · cols 14–33 · **DEVELOP** → the spark, by elimination

| beat | ask | distance |
|---|---|---|
| 4 | the first *held* jump | 0.73× |
| 5 | **the teaching gap** — cannot be jumped | **1.28×** |
| 6 | land on drank stone; the spark does not come back | — |
| 7 | cross on legs alone | 0.66× |

**The teaching gap** is the slice's thesis. Seven empty columns is 1.28× the
running jump and 0.81× the spark's reach: unjumpable, unambiguously. It is
fully visible from the shelf you stand on, its far lip is in the same camera
chamber, and three courses below is a floor with steps back up — so being
wrong costs about four seconds and no light.

The motes over it **change shape**. Every arc so far has been a curve; this one
is drawn straight and rising. That is the only instruction the room gives.

**Then the economy, stated in two platforms.** You land on drank stone (`=`),
which carries you and refunds nothing, so the next gap must go on legs alone —
which it can, at 0.66×. No text.

- Chain: **4 inputs** with one deliberate failure expected.
- Intended time: ~20 s · intended deaths: **0** (but 1–3 *falls*, recovered)

## Chamber C · cols 34–45 · **TWIST** — the wall

The hall stops dead. The only way on is up, and the only verb that climbs is
one the room has not yet asked for.

| beat | ask | distance |
|---|---|---|
| 8 | wall-kick to the first ledge | 4 courses ≈ 1.5 kicks |
| 9 | kick again, alternating walls | 4 courses |
| 10 | kick to the top landing | 3 courses |

Kick ledges alternate sides, each a wall-jump apart (one kick = 2.68). A
**brazier** hangs halfway: the safe line is four kicks, the **greedy line** is a
spark off the brazier straight past two ledges to the top.

- Chain: **3–5 inputs**, continuous — a wall-jump chain has no breath in it.
- Intended time: ~15 s · intended deaths: **0–1**

## Chamber D · cols 46–54 · **CONCLUDE** — density of the known

No sconce. Nothing new.

| beat | ask | distance |
|---|---|---|
| 11 | step out of the shaft onto the reveal floor | 0.4× |
| 12 | the last held jump | 0.55× + 2 rise |
| 13 | the stone | — |

It ends **above where it began** — the only room in the game that does.

- Intended time: ~10 s · intended deaths: **0**
- **Total intended first clear: 55–75 s**, 1–4 falls, 0–1 gutters.

---

## Harness output

```
wick  GRADED  platforms 32 · proved 235 · path 9 beats · tight(<6f) 0
              · stone reached · undecided 9t
```

Every beat on the golden path, with its margin:

| from → to | dx | ×jump | verb | margin |
|---|---|---|---|---|
| (1,29)→(15,28) | 9 | 1.65× | spark | 16f |
| (15,28)→(23,26) | 8 | 1.47× | spark | 21f |
| (23,26)→(33,25) | 7 | 1.28× | spark | 21f |
| (33,25)→(36,24) | 1 | 0.18× | legs | 21f |
| (36,24)→(45,22) | 7 | 1.28× | spark | 21f |
| (45,22)→(41,18) | 3 | 0.55× | spark | 21f |
| (41,18)→(45,14) | 3 | 0.55× | spark | 21f |
| (45,14)→(41,11) | 3 | 0.55× | spark | 21f |
| (41,11)→(51,8) | 9 | 1.65× | spark | 21f |

**Read this carefully — it is not the intended line.** The harness's BFS
minimises *beats*, so it returns the route that skips the most platforms: the
spark-heavy expert line. That it exists at all is rule 6 satisfied. The
*taught* line — the three-shelf chain in A, the wall climb in C — is longer in
beats and so is not what BFS returns.

## The spark gate, and the two bypasses it caught

`npm run levels:verify` now solves every graded room a second time with the
spark **disabled**, and fails the room if the stone is still reachable. This is
rule 6's test, and for a tutorial it is *the* test: a room whose subject is the
scarce verb must not be completable without it.

It caught the rebuild doing exactly what the old WICK did — twice.

1. **The recovery floor was a bypass.** A continuous floor under the hall let
   you walk from the entry to the chimney along the bottom, never crossing the
   teaching gap. The basin now dead-ends.
2. **A recovery step was a staircase.** A step at col 31 sat *inside* the gap's
   own span, so falling in and climbing out put you on the far side. Steps are
   now only on the near side.
3. **And the pit was climbable.** Wall-jumps are free and unlimited here, so
   any pit with a wall beside it can be climbed out of on the wrong side — the
   harness proved it after both fixes above. The far lip is now a
   **cantilever**: its supporting rock sits at cols 37-40, so the columns under
   its left end are open air with no face to kick off, and the lip itself caps
   anyone who climbs at col 37.

With the spark disabled the far lip, the drank islands, the chimney, the
reveal and the stone are all unreachable. The gap is forced.

```
wick  GRADED  ... stone reached · spark FORCED · undecided 9t
```

That is the difference between a tutorial that teaches a verb and one that
merely contains it, and I would not have found it by looking.
