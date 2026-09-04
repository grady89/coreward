# Genre module — the 2D precision platformer

What this project learned building one. Written to be useful to a future room,
not to summarise a genre.

> Note on convention: the brief asked for this "in the style of the existing
> genre modules". There are none — `references/` did not exist and the repo's
> documentation convention is root-level `SPEC-*.md`. This is therefore a first
> module rather than a matching one.

---

## 1 · Measure the body before you draw a room

The single highest-leverage act in this whole exercise was simulating the
controller instead of reading its constants.

Coreward's constants imply a parabola. The body does not fly one: an apex band
halves gravity near the top of the jump, a jump-cut multiplies rise velocity
by 0.45 on release, and air control clamps at a speed *different from* ground
speed. The measured jump is **5.45 tiles across, 2.68 up**. The reach model
these rooms were authored against assumed **3 across, 2 up** — 55 %.

The visible symptom was not "the rooms are impossible". It was the opposite,
and it is worth naming because it is counter-intuitive:

> **Under-estimating the body produces rooms that feel like a checklist.**
> Platforms land at half the spacing the arc wants, so the player arrives with
> most of the jump unused, stops, re-accelerates, and jumps again. The stutter
> is authored in. It reads as "isolated obstacles" and no amount of decoration
> fixes it, because the cause is arithmetic.

**Rule:** before designing, write a headless simulator that runs the real
integration loop and *parses its constants out of the controller source* so it
cannot drift. Publish its output as a generated document. Every distance in
every map comment is then a fraction of a measured arc.

## 2 · Air speed vs ground speed is a design lever, and usually an accident

Coreward walks at 3.6 tiles/s and air-steers at 5.0. The game is **39 % faster
in the air**. Nobody wrote that down; it fell out of two unrelated constants.

It is also the strongest possible argument for chaining: a player who keeps
moving is mechanically faster than one who lands and re-accelerates. Once you
know the number, "chain, don't stop" stops being taste and becomes a
statement about the physics.

**Rule:** compare air control to ground speed early. Whichever is faster is
the behaviour your levels should reward, and you should find out on purpose
rather than by measuring later.

## 3 · Acceleration distance decides whether run-ups exist

Coreward reaches full speed in **0.26 tiles / 7 frames**. There is therefore no
such thing as a run-up, and every corridor built to provide one is dead space
that also reads as a stop.

**Rule:** measure rest→full-speed distance. If it is under a tile, never
author approach runs. If it is several tiles, approach length becomes a real
design resource and gaps must state how much runway they assume.

## 4 · The scarce verb is the economy

Three of Coreward's four verbs are free and unlimited (walk, jump, wall-jump).
One — the spark — is a single charge that refills on contact with live stone.
That asymmetry *is* the game: every interesting decision is where to spend the
one scarce thing.

Corollaries that generalise:
- **Landing is refuelling.** A chain of grounded beats is a chain of spark
  opportunities; a chain of airborne beats is one spark spent well. A room
  chooses which kind of sentence it is by where it puts floors.
- **A floor that does not refill is a different noun.** Drank stone (`=`)
  carries you and refunds nothing. Two such platforms state the entire economy
  without text.
- **Never let the tutorial make the scarce verb optional.** The original WICK
  could be finished without ever spending the spark, in the room whose subject
  is the spark.

## 5 · Teach by inevitability, not by instruction

The strongest tutorial beat available is a gap that is *visibly* too far for
the verb the player has, over a failure that costs seconds rather than a life.
The player tries the known verb, comes up short, lands somewhere safe, and the
unknown verb is the only remaining move.

Requirements, all of them load-bearing:
1. The gap must exceed the free verb's reach by an unambiguous margin — 1.28×
   in the rebuilt WICK, not 1.05×.
2. The landing must be **visible from the launch**, in the same camera frame.
3. Failure must cost ~4 seconds and no progress.
4. The breadcrumb must change shape. Every earlier arc in the room is a curve;
   the spark's is drawn straight and rising. That is the only instruction.

## 6 · The camera boundary is a free design unit — use it

Nintendo teaches across a five-minute stage; Thorson teaches inside a
ten-second screen. They cannot both be the unit, and a project usually already
has an answer in its camera.

Coreward cuts between camera-locked chambers of ≤22 columns. That makes the
resolution obvious: **the chamber is Celeste's room, and the four chambers are
Nintendo's four steps.** Celeste-grade density inside a chamber, kishōtenketsu
across them. No compromise required — the camera had already decided.

**Rule:** find the unit your camera already enforces before choosing a
teaching structure.

## 7 · Checkpoint economy determines how hard you may be

Celeste's free instant respawn licenses brutality. Shovel Knight's smashable
lamp makes the checkpoint a wager. These are different contracts and they
permit different difficulties.

Coreward's sconce is Shovel Knight's lamp inverted — you *buy* the checkpoint
with position and your spark. That model is only honest if the wager is real:
a checkpoint that costs nothing to reach is a free respawn wearing a costume.

**Rule:** write down which contract you have before tuning difficulty, and
make the cost of a checkpoint measurable.

## 8 · The lint you write is the design you get

Three cautionary tales from this codebase, all the same shape:

- A **flat-walk lint** that passed a run if any marker appeared *anywhere* in
  it. One mote at the far end excused a 58-tile corridor. Measure the longest
  *undecided sub-run*, not membership.
- A **reach model** calibrated by hand at 55 % of the real body. It approved
  everything, so everything passed, so nothing improved.
- A **suite of checks addressed by coordinate** — `sconces.findIndex(x => x.y
  === 23)`, "the wick chimney: x46-47". Every one silently became a test of the
  map rather than of the rule, and every one broke the moment a room moved.

**Rule:** a check must be addressed by the rule it enforces — find the door by
its character, the wall by scanning for a wall, the boundary sconce by asking
which columns are cuts. If rearranging a level breaks a test, the test was
measuring the level.

## 9 · Verify with the real physics, and report margins in frames

Reachability walks answer the wrong question. A 4-connected flood proves what
is *certainly* unreachable and nothing more; it moves like a ghost.

What a level needs is: for every traversal it asks for, an actual input tape
that solves it, and **how many frames that input could be mistimed and still
land**. Then the fairness threshold is not a matter of taste — it is the
game's own coyote window. Coreward forgives 6 frames, so a level demanding
tighter than 6 frames is unfair *by the game's own declared standard*.

Practical shape that worked:
1. Enumerate landable surfaces (platforms) from the map.
2. For every plausible pair, sweep a small tape space — run-up × hold length ×
   spark direction/frame × wall-kick frames — and stop at the first success.
3. Build a graph of verified edges; BFS the entry to the goal.
4. Grade **only the golden path**. Grading every pair floods the report with
   backwards leaps down shafts that nobody is asked to make, and a harness
   that cries wolf gets ignored.
5. Margin = slide the jump press frame by frame until it stops landing.

Two things this must include or it silently lies: **wall-jumps** (without
extra mid-air presses a shaft reads as unreachable) and **the two-row body**
(checking only the tile below spawns the test body inside a ceiling).

## 10 · Anti-patterns, stated as tests

Kaizo is the photographic negative of good difficulty, and its signature is
precise: **the information needed to survive does not exist on screen before
the commitment**. Hidden blocks under a jump, hazards entering frame at speed,
death after the goal.

That gives a testable line rather than a vibe:

| bad | good |
|---|---|
| memorisation of invisible state | reading of visible state |
| single-frame input | ≥ the game's own forgiveness window |
| surprise | combination of taught elements |
| failure costs a re-run | failure costs seconds |

Difficulty from precision and reading. Never from tedium, memorisation, or a
frame the player could not have known about.
