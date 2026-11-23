# THE DEBT (v7): the ledger, read both ways

Room 7, MAELIS-6. Built by `scripts/author-debt.py` (its docstring walks every
beat) and proved by `scripts/routes/debt.js`. v7 answers the playtest:
"confusing as all get out, gravity seems to flip with no indicators, not clear
where to go". The bar is THE RETURN: one path, hard, and every death your own.

## The shape

66 × 15, closed, three chambers (cuts at 21 and 43). One course of stone, the
page (row 7), runs the room. Over it is a corridor five courses tall under a
roof, where gravity is down (debit). Under it is a corridor five courses tall
over a floor, where gravity is up (credit). The camera frames 14.7 courses, so
**both faces are on screen from every point in the room**. Nothing is landed on
blind, before a flip or after one.

The route reads the page forward along the top, turns at the far wall, and
reads it back along the underside to the stone, which sits under the spawn. You
can see the stone, its keeper and the door that prices it from the first frame.

```
 top, left to right                    underside, right to left
 1 spawn                               10 out of the turn
 2 THE LIFT: band over a block (safe)  11 B1 out of the floor
 3 L1                                  12 B2 under T2
 4 T1 out of the roof                  13 C1 (credit light)
 5 THE WOUND: band over 10 fangs,      14 THE WOUND from beneath: a band of
   two plumb bolts, a roof fang hop       down air along the floor, the same
 6 L2                                     bolts, a floor fang hop
 7 T2                                  15 C2 at the door, priced in 3 lights
 8 G2 fangs, landing short of the      16 the paid doorway drops you into the
   ankle bolt's rail; hop the bolt        stone's room; the stone
 9 THE TURN: a chute of down air
```

Every column off that line is stone or plainly lethal (fangs on the faces,
pistons, bolts). There are no holes in the page except the turn, so the credit
side cannot be reached early and the debit side cannot be regained except by
walking the whole route back.

## The gravity language (src/game/vault.ts)

The runtime drew gravity zones as 420 tiny motes drifting at 0.45 tiles/s,
which is to say not at all. v7 adds a gravity field. It is **visual and audio
only**: nothing in it is read by the step. It applies to every room with
gravity zones; today that is THE DEBT and THE KINDLED's inverted span.

- **Tint.** Every turned air tile is tinted by its pull: up cyan, right violet,
  left green. Plain down air is left alone.
- **Chevrons.** Turned tiles carry chevrons that crawl the way they pull. Down
  air within three tiles of a seam (walked through air, so a floor between
  them stops it) carries gold chevrons pointing down. Both sides of every
  boundary say which way is down.
- **Seams.** A bright line on every face where two gravities meet, two-tone,
  each side in its own colour.
- **Streaks.** 320 thin lines of light falling the way each side pulls.
- **The flip.** When the gravity at the body's centre changes (the same test
  the step uses), the body's drawing turns over to stand on its new floor, a
  ring in the new colour throws off it, the frame washes in that colour for
  0.45 s, the field pulses, and a glide plays the way you now fall (new
  `VaultAudio.flip`, wired in `main.ts` to `audio.gravityFlip`). A re-form is
  not cued; a bobbing seam cues at most every 0.4 s.
- **Full-mass faces.** A one-course floor with turned air against it is drawn
  full thickness. The half-slab rule left the page's underside drawn half a
  tile above where a hanging body stands.
- **The dark.** In dark tiles the gold down-chevrons are suppressed, so the
  field and its seams show in KINDLED's dark but the dark keeps the room's
  shape. The field fades up and down with the arrival veil.

Kindled's route replays green on the new runtime (69 s).

## The rules the body still follows (physics unchanged)

- Gravity is read at the body's centre tile. A sconce, figure, stone or door
  tile carries no gravity of its own, so inside a turned field it is a
  one-tile cell of down air. The field draws it honestly (a gold notch).
- So **a credit light stands on a plinth** one course under the page. It lights
  at 0.98 tiles as you walk under it, and a re-form there stands you on the
  plinth in its cell of down; step off and you fall up to the page. Bare, it
  would hover a re-formed body at the cell's foot.
- **A paid door is a cell of down air.** The door is two courses tall, high in
  a wall across the underside. Paid, it drops a body walking into it onto the
  stone's floor. The doorway's reveal hides the body for the moment of the
  drop; the wash and the glide still mark it.
- **Turns are chutes, not holes.** A hole whose seam sits at the page's
  underside traps a walking body in a bob. The turn's chute carries the seam
  three courses down, so a walk-in falls through, is caught at the chute's
  foot, and drifts out under the page. 31 of 31 steer-out timings land.
- A jump from the roof or the underside goes away from it. In a band three
  courses deep a short hop stays in; a full jump leaves and falls the other
  way, onto fangs. That is the room's execution test, and you can see it
  coming: the band's edge is a bright line.

## What v7 cut

From v6: the hub and its "either order" branches (pocket Q over the page, its
mirror Q', the lidded piston pair), the first leaf's two holes, the closing's
two corridors and their walls, the open sky above the page and the open credit
side below it, and the walk-in turns that only bobbed. Tried during v7 and cut:
a two-wide tear G1 before the wound and a floor piston B3 at the end of the
return. Both sat where the bands' exits drift the body, and B3 straddled a
camera cut.

Kept: the page read on both faces, credit and debit lights and the door priced
across both, the pistons as an opposite-phase pair (T2/B2), the plumb bolts
read falling and rising, the reaching figure under the first lift, the kneeling
keeper at the stone.

## Checks

- `node scripts/vaultplay.mjs --room=debt --port=4182 scripts/routes/debt.js`:
  completed, 51 s (waits included).
- `scripts/vaults.mjs`: green. The debt stage: every piston full stroke; a body
  stands on a ceiling in up air (the lift band, row 2.52) and on a floor in down
  air; price 3 against two lights on each face. P4 climax census and the sconce
  buffer are green: the last chamber has no light and nothing new, and every
  light is at least 5 from a piston and 4 from fangs and bolts.
- `scripts/vaultfit.mjs`: fit OK, P5 "proved" for debt.
- Kindled's route: completed on the new runtime.

## Difficulty, measured in the real body

Static beats sweep every take-off (0.1-0.2 tile steps) against every jump hold
(1 to 44 frames, and full). The **window** is the longest run of consecutive
hold frames that lands the beat from the best take-off.

| beat | take-offs that work | window |
|---|---|---|
| lift: jump into the band (safe) | 13/13 | 38 f (8 to full) |
| wound: jump into the band | 13/14 | 38 f (8 to full) |
| hop the roof fang, hanging | 13/18 | **15 f** (6-20) |
| G2: land between fangs and rail | 13/15 | **16 f** (30 to full, from the lip) |
| floor band: jump into it | 9/9 | 36 f (10 to full) |
| hop the floor fang | 13/25 | **9 f** (10-18) |
| the turn: walk in, steer left after 0-120 f | 31/31 | any |

Timed beats: `phasesOK` is the share of start phases where the route's
technique (watch it, then go) works. The **go window** is how many start
frames of the hazard's cycle survive if you walk straight in without waiting.

| beat | phasesOK | go window |
|---|---|---|
| under T1 | 1.00 | 94/204 (run 71 f) |
| past roof bolt 31, hanging | 1.00 | 118/153 |
| past roof bolt 38, out of the band | 1.00 | 118/153 (run 79 f) |
| under T2 | 1.00 | 94/204 |
| G2 against the bolt clock | 1.00 | - |
| hop the ankle bolt | 1.00 | 79/102 |
| under B1 | 1.00 | 93/204 |
| under B2 | 1.00 | 93/204 (run 86 f) |
| past floor bolt 38 | 1.00 | 108/153 (run 93 f) |
| past floor bolt 31, out of the band | 1.00 | 108/153 (run 82 f) |

The tightest are the floor fang hop (9 f), the roof fang hop (15 f) and G2
(16 f from the lip). The waits are generous; the weight is in carrying a
segment. Checkpoints: spawn, L1 (after the lift), L2 (after the wound), C1
(after T2, G2, the ankle bolt, the turn, B1 and B2: the longest segment), C2
(after the wound from beneath). A perfect run is 51 s, waits included.

## Legibility and branches

From every rest point on the route the whole band is in frame (rows 0-15) and
the next footing is inside the chamber's frame. Two rest points sit one walk
short of a cut (L2 before T2, and the underside at x 25 before C2). The floor
between is continuous and in frame, and the cut comes at least 2 tiles before
the next hazard.

The branch check ran 21 moves from each of 20 rest points: walk off both ways,
jump straight, left and right, a standing spark in 8 directions, and a jump
plus spark in 8 directions. Every outcome was one of these:

- a footing on the route, forward or back;
- a visible death: fangs, a piston or a bolt;
- bobbing in the turn's chute (steer left to finish the turn);
- standing in a credit light's cell of down on its plinth, or hanging under
  the plinth. Both are harmless: step off.

Nothing reached a place off the route. Sparks can skip a hop or a wait by luck
of phase. They never skip a band or the turn.
