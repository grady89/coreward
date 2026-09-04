# Level audit — all nine vaults

Graded against [level-design-principles.md](level-design-principles.md) §Part 3,
measured with `node scripts/_audit.mjs` against the real movement numbers in
[movement-metrics.md](movement-metrics.md).

**Verdict: rebuild, all nine.** Not because they are ugly — the dress and the
feel are good — but because they were built against two wrong numbers and
graded by lints that measure legality rather than rhythm.

---

## The two root causes

Everything below is a symptom of one of these. Fixing rooms without fixing
these just produces prettier checklists.

### Root cause 1 — the reach model was calibrated at 55 % of the real body

The P5 reach model I wrote for V4 walks with `JUMP_RISE = 2`, `JUMP_RUN = 3`,
`SPARK_RUN = 2`. The measured body does:

| | model assumed | actually does | error |
|---|---|---|---|
| jump rise | 2 tiles | **2.68** | −25 % |
| jump run | 3 tiles | **5.45** | **−45 %** |
| spark extension | +2 | **+3.15** (45°) | −36 % |
| reach with apex spark | ~5 | **8.60** | −42 % |

So every room was authored to a body that could jump **3 tiles** when it can
jump **5.45**. The consequence is not that the rooms are unbeatable — it is
the opposite. Platforms sit at roughly half the spacing the arc wants, so the
player lands with most of the arc unused, has to stop, re-accelerate, and jump
again. **The under-calibrated model is the direct mechanical cause of the
"checklist of isolated obstacles" feel.** It built rooms out of hops.

This also explains why every room passed: a model that thinks the body is
weak will approve spacing that is trivially easy for the real one.

### Root cause 2 — the flat-walk lint is toothless

It counts a floor run as "decided" if any marker appears **anywhere** in it,
so one mote at the far end excuses a corridor of any length. Measured properly
— the longest stretch with nothing within reach — every room fails:

| room | longest hold-right stretch |
|---|---|
| weather | **58 tiles** (the entire map width, at y39) |
| shift | 18 |
| wick | 17 |
| debt | 16 |
| famine / return / kindled | 15 |
| vault | 8 |
| ember | 6 |

At 3.6 t/s ground speed, WEATHER's corridor is **16 seconds of holding one
direction.** It passed the lint.

**Fix:** the lint must measure the longest *undecided sub-run*, not run
membership. That change is in the harness below and it re-fails eight of nine
rooms, which is the correct answer.

---

## Room by room

Format: verdict — the specific failure — the specific fix.

### 1 · THE WICK — **rebuild** (this is the vertical slice)
- **Fails 1, 4.** 17-tile undecided corridor at y26 x38. Six gaps total in a
  56-wide room, and the largest real jump is 0.55× — nothing in the room asks
  for a held jump.
- **Fails 2.** It is the tutorial and it teaches by *labelling*: the HUD
  string says "SHIFT — spend the spark". The geometry teaches nothing; you can
  reach the stone without ever needing the spark, so the one verb the game is
  about is optional in the room that introduces it.
- **Fix:** rebuilt below. Force the spark by inevitability — a gap at 1.15×
  with a visible, cheap failure — and make every landing a launch.

### 2 · THE FAMINE — **rebuild**
- **Fails 1.** 15-tile undecided stretch at y15. 83 stacked ledge pairs over a
  storey apart, i.e. it is a climbing room built as a stack of separate hops.
- **Fails 6.** Deadlight sconces save but never refund, which is a beautiful
  economy — and the map never once makes you choose between two of them. No
  greedy line exists.
- **Fix:** put the two deadlights on *diverging* routes so lighting one costs
  the other; make the drank-stone floor the safe line and the ledges the fast one.

### 3 · THE LAST SHIFT — **rebuild**
- **Fails 1, 4.** 18-tile corridor. 138 over-storey rises — the worst
  stop-start profile in the game.
- **Fails 3.** Spin beams with cover, but the cover is authored *after* the
  beam in reading order, so the first pass is blind.
- **Fix:** beams enter frame before their cover does; convert the ledge stack
  into a wall-jump shaft, which is one continuous phrase instead of nine hops.

### 4 · THE VAULT — **revise**
- **Best of the nine.** Only 8 tiles of undecided floor; the bridge stairs are
  a genuine phrase (A → b → A on one pulse).
- **Fails 6.** The optional fourth sconce is hard to *reach* but not hard to
  *chain* — it is a detour, not a greedy line.
- **Fix:** re-space the gallery climb to 0.75× so it runs as one held sequence,
  and put the optional sconce at the end of a spark → wall-jump, not up a ladder.

### 5 · THE EMBER — **revise**
- **Fails 1** mildly (6 tiles undecided — the best score) but **fails 4**: the
  shaft is uniform. Rime, rime, rime, rime for twelve rows at even spacing.
- **Fails 5.** The pursuit's edge lights the room ahead, which is excellent,
  but arrives *after* the only section that needed the light.
- **Fix:** vary shelf spacing across the descent (tight/loose/tight); move the
  wave trigger up two screens so its light is the reading tool for the dense part.

### 6 · THE WEATHER — **rebuild**
- **Worst room in the game.** A 58-tile undecided corridor is not a level.
- **Fails 1, 4, 6** outright. The wind is a *modifier on a straight line*
  rather than a thing you route around.
- **Fix:** the crossing should be a series of 3-beat phrases between shelters
  where the gust decides which of two lines is available, not a walk with a
  headwind.

### 7 · THE DEBT — **revise**
- The mirror concept is strong and the door-priced-in-both-gravities is the
  best single idea in the set.
- **Fails 1.** 16-tile corridor, and both cells are ledge stacks.
- **Fails 3.** Gravity flips at the seam with no read-ahead — the first
  crossing is a surprise, which is the kaizo failure mode, not difficulty.
- **Fix:** motes falling sideways *before* the boundary (already specified in
  §IV and not implemented); rebuild both cells as 4-beat phrases that mirror
  each other move for move.

### 8 · THE RETURN — **revise**
- The censer-ride by inevitability is right, and the arc telegraph makes it
  readable.
- **Fails 1.** 15-tile corridor along the bottom. The sideways-gravity
  corridor is walked, not chained.
- **Fix:** the corridor should be traversed by wall-jumping along what gravity
  calls the floor — the same verb re-read, which is what the room is about.

### 9 · THE KINDLED — **rebuild**
- **Fails 1, 4** hardest: 17 long flat runs, the most in the game, and 255
  over-storey rises. It is four corridors with furniture on them.
- **Fails 2** by accident: it introduces nothing (correct), but it also
  *recombines* nothing — the four movements are four separate rooms.
- **Fix:** each movement should recombine two named acts' vocabulary as
  specified, and the boustrophedon turns should be the phrase's breath points,
  not the only places anything happens.

---

## What passes

Worth saying, so the rebuild does not throw it away:

- **The kit is good.** Nine nouns, all combining, all lint-locked. No unitaskers.
- **The dress is good** and reads at a glance — that work stands.
- **The camera-locked chamber is a gift.** ≤22 columns, cuts rather than pans:
  it is Celeste's room boundary and Nintendo's four-step slot in one structure.
  The rebuild should lean on it much harder than the current maps do.
- **The forgiveness windows are right** (6f coyote, 7.2f buffer) and license
  tighter spacing than anything currently authored.
