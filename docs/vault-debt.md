# THE DEBT: the ledger, read both ways

Room 7, MAELIS-6, built by `scripts/author-debt.py` and proved by
`scripts/routes/debt.js`. The author script's docstring walks the route beat
by beat. This page keeps the playtest numbers and the gravity rules the room
is built on.

## The rules the real body taught (src/game/vault.ts, unchanged)

- **Gravity is read at the body's centre tile.** A sconce, mote or figure
  tile inside a `^` field is a hole of DOWN gravity, because those chars
  carry no gravity of their own. A credit light therefore hangs one course
  clear of the course the body stands in, and lights at 0.98 tiles as you
  walk under it.
- **The seam bleeds a body that is not holding on.** If you cross into a
  gravity that calls your motion "rising" with jump released, the
  variable-jump cut fires (×0.45) once. A walk into a turn only bobs in the
  hole. Jump into it, or press jump while you are in it: either one carries
  you through, and the second kicks off the hole's lip.
- **A turn's own tile stays down-gravity.** The seam sits at the page's
  underside, so dropping in from the top carries the body a course and a
  half deep: room to steer under the lip. Coming back up needs momentum (a
  dive: jump away from the page and fall back through).
- **Level rails seat on the ground below them, gravity-blind.** A bolt
  strung inside an up-gravity pocket drops to the floor under it. The hub
  uses that as its tap-not-jump beat. The underside rail stays where it is
  strung because the ground under it is uneven (a kerb), which the seating
  rule leaves alone.
- **A piston flush with a hanging body kills at any extension.** The
  pocket pistons are recessed in three-deep lids so they travel before they
  bite.
- **The camera frames about 14.5 courses, centred on the body.** Anything a
  hook commits you to has to sit within about 7 courses of the launch.
- **A spark is world-relative.** On the underside, "up" toward your floor is
  the down key.

## Beats, measured from the route's own rest points

`phasesOK` is the share of start phases across the hazards' common cycle
(612 frames: crushers 4 pulses, page bolts 2, plumb bolts 3) where at least
one technique succeeds. Per-technique counts are successes out of 51
sampled phases (or 1 for hazard-free beats).

| beat | phasesOK | techniques that work (successes / phases sampled) |
|---|---|---|
| A1 down through G1 | 1.00 | hop in from 5.2 (held) or 4.6 (tapped); walk in + jump 4 or 8 frames late: all 1/1 |
| A2 underside light, dive up G2 | 1.00 | walk in + jump at the lip 1/1; dive (jump away, fall back up through) 1/1 |
| B0 hop G3 | 1.00 | hop held 0, 3 or 6 frames: all 1/1 |
| B1 the hook to the ceiling | 0.91 | run-in jumps from 29.3 / 28.6: 24/51, 21/51; jump + up-right spark 21/51; standstill jump at 33.5 tapping the bolt 42/51 |
| B1b ceiling light | 1.00 | walk to it |
| B1c out under P_up | 1.00 | wait at its edge until it is home, walk out: 51/51 (both landing aims) |
| B3a down G3 | 1.00 | hop from 25.0 / 24.6; walk in + jump: all 1/1 |
| B3b mirror hook to the floor | 0.88 | run-in 24/51, 21/51; jump + down-right spark 21/51; standstill jump tapping the underside bolt 39/51 |
| B3c floor light | 1.00 | walk to it |
| B3d out over P_down | 1.00 | wait at its edge, walk out: 51/51 |
| B4 dive up G3 | 1.00 | dive from 24.6 / 25.2, held or released: all 1/1 |
| B5 under Q on taps, door, gate light | 0.88 | wait for the bolt to run away, then walk and tap: 42/51, 39/51, 45/51 (a 3-frame tap at a 0.9 trigger: 0/51) |
| C-a T1, g1 past its plumb bolt | 0.63 | go when T1 lifts, hop for the far side of g1 30/51; hop for the middle 2/51; walk in + jump 17/51 |
| C-b B2 | 1.00 | go when it lifts 51/51 |
| C-c dive g2 past its plumb bolt | 0.80 | aim the far side, held 40/51 or released 35/51; aim the middle 9/51, 16/51 |
| C-d T2 to the stone | 1.00 | go when it lifts 51/51 |

A perfect run takes about 57 s (the route, waits included).

## Checks

- `node scripts/vaultplay.mjs --room=debt scripts/routes/debt.js`: green.
- `scripts/vaults.mjs`: all green. The debt stage now tests rules: every
  piston makes its full stroke and comes home; a body let go under a ceiling
  in `^` air stands on that ceiling; and the door's price exceeds what either
  gravity's lights can pay before the door.
- `scripts/vaultfit.mjs`: fit OK. **P5 "golden" reports NOT REACHED for
  debt**, and only because the model is gravity-blind. It drops through the
  first turn, treats the whole underside as down-gravity, and can never rise
  back through the page, because in the real room that climb is a fall
  upward. The real body proves the route above.
