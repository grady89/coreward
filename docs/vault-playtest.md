# Playtesting a vault headless

The repo's reach models — `vaultfit.mjs`'s P5 walk and `levels-verify.mjs` —
do not simulate lanterns, bolts, bridges, wind, currents, gravity zones or
doors. They pass rooms that cannot be played and fail rooms that can. A room
is proved by playing it in the real runtime: `scripts/vaultplay.mjs` steps
`__game.vault.frame(1/60, input, true)` under scripted input. Its header is
the API.

```sh
npm run build
npx vite preview --port 4173 --strictPort      # any free port
node scripts/vaultplay.mjs --room=vault --port=4173 scripts/routes/vault.js
COREWARD_URL=http://localhost:4173 node scripts/vaults.mjs out/
COREWARD_URL=http://localhost:4173 node scripts/vaultfit.mjs
```

## The method (how THE VAULT was finished)

1. **Beat by beat, from rest points.** A rest point is anywhere a player can
   stand and wait. From each one, `measure()` the next beat across every
   start phase of the hazards' common cycle (bridges 3.4 s, a 3-pulse bolt
   2.55 s, LCM ≈ 306 frames at the 0.85 s pulse) with a spread of
   techniques: run-up, jump hold (short hop … full), steer release, spark
   frame and direction, wall-kick counts.
   - `phasesOK` is the share of phases where some technique works — what a
     player who waits faces. A timed beat wants windows a human can see
     coming; THE VAULT's lamp catch landed at two windows a swing
     (~0.4 s and ~0.27 s), its tower climb at 64 %, its box wall at 96 %.
   - **Impossible in practice** looks like: one technique in one 10-frame
     window across thousands of tries. That was the old lamp. Fix the
     geometry, not the player.
2. **Trace the deaths.** Wrap `v.frame` and log position, input, `wallDir`,
   `grounded`, and on a re-form the nearest `v.shuttlePos(i)`. Most "hard"
   beats were a fixed hazard sweeping somewhere the author never meant, or a
   footing too small to land a move's momentum on.
3. **One continuous run.** `scripts/routes/<room>.js` plays spawn → stone with
   `plan()`: no teleports, real doors and checkpoints. A beat that only
   passes from a teleported start has not been proved. Brake on landing;
   take a run-up the footing actually has.

## Body numbers (measured — docs/movement-metrics.md)

Body 0.60 × 1.04 tiles: it needs **two clear rows** everywhere it goes, and
standing on tile row `r` puts its centre at `row = r - 0.52` (`py = -row`,
`px` is plain x). Running jump 5.45 across / 2.68 up, 65 frames. Short hop
1.10 / 2.78. Air control tops out at 5.0 t/s (faster than the 3.6 walk).
Wall-kick +2.68, unlimited. Run + 45° spark 8.60; a LATE 45° spark carries
12.7 on the level and 13.5 falling. A single wall is climbed by kicking off
and steering back; the kick's push-out cannot be steered against for 5
frames. Coyote 6 f, jump buffer 7 f.

## Lessons from THE VAULT

- A pendulum's crown is caught at the slow end of its swing from a perch a
  standing jump away — not from a wall climb, and not 6 tiles out.
- A climb that crests a one-tile top carries its momentum off the far side.
- An overhang two tiles out over a wall climb has no way round it in the air;
  a foothold is the "step around".
- A bolt's rail drawn "to the tower" sweeps the tower's climb too. Check
  every rail's full travel against every route that passes it.
- Anchor stones for rails are footholds whether you meant them or not.
- **A drop that must be one-way is a curtain, not a narrow shaft.** The
  playtest found the drop lane between the east tower and the ledge (cols
  27-28 under row 22) climbable from the plaza, so the whole right limb was
  skipped. Narrowing it cannot close it: the tower face beside it is a
  twelve-course wall, kicks are free, and a one-wide shaft is two walls. A
  'down' gate wall to wall at the ledge's course (x 27-28, row 22) does:
  walls do not catch it, a body falls through it, and a rising head stops at
  its underside. 825 techniques × 102 phases (84k runs: kick chains on the
  tower, kick-and-steer-back, spark mid-climb, run + spark at five angles from
  four starts, jump-buffer mash and pre-touch, spark into wall-kick):
  phasesOK 0. The highest any of them got was head flush with the curtain.
  The drop itself is 35 frames lip to plaza; 4 of 5 walk-off/hop/spark-down
  techniques work at every phase.
- **Check the other end of the same ledge.** Platform 37-38 stands six
  courses under the ledge's east end: a standing jump plus a spark straight
  up landed on the ledge at every phase. A second curtain (x 37-39, row 22,
  over the gap and the half-time pad, to the anchor stone) closes it: 180
  techniques × 102 phases from 37-38 (both ends) and the plaza's end,
  phasesOK 0. **Still open:** from platform 41-45 a jump plus spark rises
  just east of the anchor and lands on the ledge, pad 38-39 or the anchor at
  every phase. That skips 49-50, the wall and the pads back. A curtain there
  would also cap the 41-45 -> 49-50 jump, so closing it is a change to the
  right limb's layout.
