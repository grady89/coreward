"""THE VAULT — built to the drawing (2026-09-11). 55 x 40.

The keep stands in the middle as it did: a plaza, a chimney between two
towers with a ladder of half-time floors, and the stone's box on top —
now with SPIKES across its roof so nobody climbs up and around. What
changed is everything either side of it, laid out from the numbered route
on the drawing:

   1  start on the plaza, go LEFT
   2  down over ice bricks that melt underfoot — for good — to the first
      light, three courses under the plaza and far left
   3  kick up the slab past that light, stand on its capped top, and leap
      for the SWINGING LAMP as it swings in; ride it east
   4  jump off it and fall THROUGH a laser strung from a standing panel to
      the tower, over open air, onto the plaza's west edge
   5  kick up the west tower's face, past a short laser bolted to it
   6  kick off onto the step under the box's lip, jump up its wall, out
      through a plumb laser, onto the second light, high and left
      ... drop to the plaza, through the KEY DOOR (three lights), under the
      floating east tower, through three plumb lasers under the ledge ...
   7  the right plaza: platforms out and up, two plumb lasers between them
   8  a wall to kick up, and the high platform beyond it
      ... back LEFT over four half-time pads ...
   9  the ledge and the third light
  10  drop off the ledge's near end, left of the lasers, back to the plaza
  11  up the chimney, through the grate (all four lights), to the stone

Nothing here forbids a wall-jumper a shortcut — kicks are free in this game
— but every light is behind its own obstacle and the doors are arithmetic:
the key door wants three, the grate wants all four.

Built the way THE WICK is built (openEdges): open sky, one unseen `_` plane
under everything. Distances are fractions of the MEASURED running jump
(5.45 across, 2.68 up — docs/movement-metrics.md); a kick is 2.68 up and
free.

Chambers cut at 21 and 43, so every jump lands inside the frame it left:
the left climb owns the tower face it kicks up (the tower IS column 21);
the keep's chamber runs to the far side of the plumb laser at 40 and the
wide platform beyond it, which the body WALKS across the second cut on;
the pads coming back cross it on a three-wide pad, walking again.
"""
import io

W, HGT = 55, 40
PULSE = 0.85

g = [['.'] * W for _ in range(HGT)]


def put(x, y, ch):
    assert 0 <= x < W and 0 <= y < HGT, (x, y, ch)
    g[y][x] = ch


def run(x0, x1, y, ch='#'):
    for x in range(x0, x1 + 1):
        put(x, y, ch)


def block(x0, x1, y0, y1):
    for y in range(y0, y1 + 1):
        run(x0, x1, y)


PLAZA = 30

# --- the plaza: the hub every limb leaves from and every fall forgives to --
run(15, 35, PLAZA)
put(17, PLAZA - 1, '@')
put(19, PLAZA - 1, 'S')                  # the start light

# --- the keep -------------------------------------------------------------
# west tower, standing on the plaza; its base IS the key door
block(21, 21, 16, 27)
put(21, 28, '1')
put(21, 29, '1')
# east tower, floating two courses up: the plaza runs under it
block(26, 26, 16, 27)
# the ladder: half-time floors on the one pulse, A west, b east. The first
# rung is a thin floor, NOT stone, so the doorway keeps two clear courses
# behind it — the old stone step here is what made the door unwalkable
run(22, 23, 28, 'A')
run(24, 25, 26, 'b')
run(22, 23, 24, 'A')
run(24, 25, 22, 'b')
run(22, 23, 20, 'A')
run(24, 25, 18, 'b')
run(22, 25, 15, '2')                     # the dear grate: the box's floor
# the stone's box: rims beside the grate, walls, a roof — and the spikes
run(19, 21, 15)
run(26, 29, 15)
block(19, 19, 11, 14)
block(29, 29, 11, 14)
run(19, 29, 10)
run(19, 29, 9, 'X')                      # spikes: nobody climbs up and around
put(28, 14, 'M')
put(27, 14, 'C')                         # curled by the stone, facing away

# --- LEFT: ice, the lamp, the laser, the climb, the high light --------------
# ice bricks that melt away — and stay melted (rimeOnce), so the way back is
# the lamp and not the bricks. Distance alone cannot close that way: a late
# 45° spark off a running jump carries 12.7 tiles on the level and 13.5
# falling (measured, scripts/lib/movement.mjs). HEIGHT can: three courses
# up caps that reach at 6.0. So the bricks step DOWN to a platform three
# courses under the plaza, ten tiles out. All four gone and dead before the
# light is lit, the room is over — Esc and come back in.
for i, x in enumerate((15, 13, 11, 9)):
    put(x, PLAZA + i, 'R')
# the first light's platform, three courses under the plaza — and a slab
# standing at its far end: the wall you kick up to reach the lamp
run(2, 6, 33)
put(3, 32, 'S')
block(1, 1, 20, 32)
# ...capped two wide on its far side. The climb crests the slab moving AWAY
# from the lamp, and a one-tile top lets that momentum carry the body off
# the back of it into the void; the cap is the perch you wait on. It juts
# away from the climbing face, so it is never an overhang over the kicks.
put(0, 20, '#')
# the laser you fall through: strung from a standing panel to the tower
# face, over open air — nothing under it but the melted bricks' gap. The
# jump off the lamp's east apex crosses its line four courses over the
# plaza and lands on the plaza's west edge
block(10, 10, 25, 26)
# the second light, high and left of the box; the plumb laser between them
# hangs from an anchor stone (a rail post needs stone in line with it)
run(10, 16, 11)
put(12, 10, 'S')
put(17, 7, '#')
put(17, 14, '#')                         # ...and stands on one: a plumb rail seats itself to stone
# the step around the box's lip. The box's west wall stands two tiles out
# from the tower face, and the box's rim sits right on the tower's top, so
# a climber on the tower face is under an overhang with no way round it in
# the air. This is the foothold the drawing's "step around" asks for: kick
# off the tower onto it (two courses under the rim, the body's height plus
# room), then jump straight up and the box wall is under your hand.
run(17, 18, 18)
# one stone under the tower-face bolt's middle: a level rail over flat ground
# seats itself down onto that ground, and this one is meant to hang mid-climb
put(19, 21, '#')

# --- RIGHT: the ledge, the platforms out, the wall, the pads back -----------
# the ledge on the east tower's side, one drop-lane clear of the tower
run(29, 36, 22)
put(33, 21, 'S')
# platforms out and up
run(37, 38, 28)
run(41, 45, 26)                          # wide: the second cut is walked across it
run(49, 50, 24)
# the wall to kick up, and the high platform it throws you back onto
block(53, 53, 15, 25)
run(49, 51, 19)
# the pads back, west, half-time on the one pulse
run(46, 47, 20, 'b')
run(42, 44, 21, 'A')                     # three wide: walked across the cut
run(38, 39, 22, 'b')
# anchor stones for the plumb lasers' posts (nothing else is in line)
put(40, 22, '#')
put(40, 29, '#')
put(47, 21, '#')
put(47, 28, '#')

# --- one plane under the whole keep ----------------------------------------
run(1, 52, 38, '_')

# --- motes: the chimney's throat, and the drop lane beside the ledge -------
for y in range(17, 27):
    for x in (22, 25):
        if g[y][x] == '.':
            put(x, y, 'o')
for y in (24, 26):
    put(27, y, 'o')
    put(28, y + 1, 'o')

SHUTTLES = [
    # (x0, y0, x1, y1, pulses, phase)
    # 4 · the laser strung panel-to-tower, crossed on the fall off the lamp
    (11, 25, 19, 25, 3, 0.5),
    # 5 · the short bolt off the tower face, met on the way up
    (18, 20, 20, 20, 2, 0.0),
    # 6 · the plumb laser between the box wall and the high light
    (17, 8, 17, 13, 3, 0.25),
    # the three plumb lasers under the ledge, walked through on the plaza
    (30, 25, 30, 29, 2, 0.0),
    (32, 25, 32, 29, 3, 0.25),
    (34, 25, 34, 29, 2, 0.75),
    # 7 · the two plumb lasers between the platforms out
    (40, 23, 40, 28, 3, 0.0),
    (47, 22, 47, 27, 3, 0.5),
]
CENSERS = [
    # 3 · the swinging lamp, high. The slab's top is the perch: you climb out
    # onto it and WAIT, and the lamp's west apex — the slow end of the swing —
    # comes to within a standing jump of it, a course and a half below. Hung
    # any farther out, the crown is only catchable mid-swing, in one ten-frame
    # window, with a short hop and an early spark (measured headless).
    (8, 20, 3.0, 0.95, 3, 0.0),
]

rows = [''.join(r) for r in g]
for i, r in enumerate(rows):
    assert len(r) == W, f'row {i} is {len(r)}'

shuttles = ',\n'.join(
    "      { x0: %d, y0: %d, x1: %d, y1: %d, period: %.2f, phase: %s }"
    % (a, b, c, d, n * PULSE, ph) for a, b, c, d, n, ph in SHUTTLES)
censers = ',\n'.join(
    "      { x: %d, y: %d, len: %.1f, arc: %.2f, period: %.2f, phase: %s }"
    % (x, y, ln, arc, n * PULSE, ph) for x, y, ln, arc, n, ph in CENSERS)

defn = """  // 4 · THE VAULT — to the drawing. The keep in the middle as before — a
  // plaza, a chimney of half-time floors between two towers, the stone's
  // box on top, spiked now so nobody climbs around it — and a route that
  // circles it: ice bricks to a low light, a swinging lamp to ride, a laser
  // to jump through, the tower face to kick up past a bolt to a high light;
  // then down and through the key door (three lights), under the floating
  // tower, through three plumb lasers to the right limb — platforms out
  // between two more, a wall to kick up, four pads back to the ledge and its
  // light — and finally up the chimney through the grate, which wants all
  // four. A fall from anywhere lands on the plaza or the unseen plane.
  {
    glyph: 'vault',
    chambers: [21, 43],
    openEdges: true,
    rimeOnce: true,
    doorNeeds: { '1': 3, '2': 4 },
    shuttles: [
%s
    ],
    censers: [
%s
    ],
    map: [
%s
    ],
  },
"""
body = ',\n'.join("      '" + r + "'" for r in rows)
out = defn % (shuttles, censers, body)

p = 'src/world/vaults.ts'
s = io.open(p, encoding='utf-8').read()
start = s.index('  // 4 · THE VAULT')
end = s.index('  // 5 · THE EMBER')
io.open(p, 'w', encoding='utf-8').write(s[:start] + out + s[end:])

print(f'THE VAULT · {HGT} x {W}')
for i, r in enumerate(rows):
    print(f'{i:3d} {r}')
