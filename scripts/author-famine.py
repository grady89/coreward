"""THE FAMINE — built to the drawing. 56 x 48.

    start ---> hall A ---> [wind] ---> hall B <--- [wind] ---> hall C ---> finish
                             up                     up

A SERPENTINE: three halls stacked, run in alternating directions and joined by
two updraft channels. You start at the bottom left, cross right, are lifted,
cross back left, are lifted again, and cross right to the stone. Nothing on the
route can be skipped, which is the whole reason for the shape — an open room
lets a solver cut the middle out, a serpentine makes every beat serial.

THE THREE OBSTACLES, and nothing else:

  * STUDS set into the floor — a fang at ankle height with solid stone under
    it, so it is jumped, not fallen into. Runs of one to four, widening as the
    room goes on.
  * LASER RAILS — vertical bolt shuttles strung floor to ceiling across a
    hall. They cannot be gone under or over; you read the bolt and run when it
    is at the far end. The room's clock.
  * THE CHANNELS — updraft columns. You jump in and are carried; the wind was
    the enemy everywhere else and here it is the road.

The halls are SIX courses of air over their floor. That is enough to jump a
stud (the body rises 2.68) and enough that a laser reads as a wall of light
rather than a dash, and not so much that the hall stops being a corridor.

Distances are fractions of the MEASURED running jump (5.45 tiles across, 2.68
up — docs/movement-metrics.md). A stud run of n columns is a crossing of n+1
tiles, so a run of four is 0.92x and a run of five is past what legs can do.
"""
import io

W, HGT = 56, 48
MAXJ = 5.45
PULSE = 0.85

g = [['#'] * W for _ in range(HGT)]          # solid, and the halls are cut out

# hall floor rows, bottom to top, and the six courses of air over each
HALL = [42, 30, 18]
AIR = 6
LEFT, RIGHT = 2, W - 3

# the two channels: (columns, from hall, to hall)
CH1 = (49, 52)                                # right end: hall A -> hall B
CH2 = (3, 6)                                  # left end:  hall B -> hall C


def carve(x0, x1, y0, y1):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if 0 <= x < W and 0 <= y < HGT:
                g[y][x] = '.'


def put(x, y, ch):
    g[y][x] = ch


def studs(floor, x0, n):
    """A fang run set ON the floor: lethal at ankle height, stone underneath."""
    for x in range(x0, x0 + n):
        put(x, floor - 1, 'X')


def ledge(floor, x0, x1, rise):
    for x in range(x0, x1 + 1):
        put(x, floor - rise, '#')


# --- the halls -------------------------------------------------------------
for f in HALL:
    carve(LEFT, RIGHT, f - AIR, f - 1)

# --- the channels: cut through the rock between the halls ------------------
carve(CH1[0], CH1[1], HALL[1] - 1, HALL[0] - 1)      # A -> B, right end
carve(CH2[0], CH2[1], HALL[2] - 1, HALL[1] - 1)      # B -> C, left end

# ===========================================================================
# THE THREE HALLS, as tables. A hall is authored left to right whichever way it
# is run: the direction is a property of the route, not of the stone.
#
#   stud runs   (column, width)   a run of n is a crossing of n+1 tiles
#   ledges      (column, width)   always TWO courses up, never three. The body
#                                 rises 2.68, so a three-course step is one it
#                                 cannot make -- and the first pass authored
#                                 every single ledge that way.
#   lasers      (column, pulses, phase)
# ===========================================================================
STUDS = [
    [(13, 2), (28, 3), (43, 3)],                   # A - 0.55x, 0.73x, 0.73x
    [(40, 3), (26, 3), (12, 3)],                   # B - read right to left
    [(14, 3), (30, 4), (46, 3)],                   # C - the widest run, 0.92x
]
LEDGES = [
    [(18, 4), (34, 4)],
    [(31, 4), (17, 4)],
    [(23, 4), (40, 4)],
]
LASERS = [
    [(24, 4, 0.0), (40, 3, 0.25), (47, 3, 0.5)],   # A - slow, and spread
    [(37, 3, 0.0), (23, 2, 0.25), (9, 3, 0.75)],   # B - one guarding the exit
    [(19, 2, 0.0), (36, 2, 0.5), (45, 2, 0.25)],   # C - the fastest in the room
]
LEDGE_RISE = 2

for h, f in enumerate(HALL):
    for x0, n in STUDS[h]:
        assert n <= 4, 'hall %d: a %d-wide run is %.2fx, past the legs' % (h, n, (n + 1) / MAXJ)
        studs(f, x0, n)
    for x0, n in LEDGES[h]:
        ledge(f, x0, x0 + n - 1, LEDGE_RISE)

# --- entry, the stone, and the lights --------------------------------------
# Entry + three, all dead (SII.2): the famine's sconces hold your place and
# hand you nothing. One at the start, one where each channel sets you down, so
# a fall costs the hall you are in and never the hall behind it.
SCONCE = [(7, 0), (46, 1), (9, 2)]
put(4, HALL[0] - 1, '@')
for x, h in SCONCE:
    put(x, HALL[h] - 1, 'S')
put(RIGHT - 2, HALL[2] - 1, 'M')
put(RIGHT - 4, HALL[2] - 1, 'K')             # the figure, curled by the stone

# A checkpoint you cannot breathe after is not a checkpoint (grammar S4.2):
# four clear tiles to the nearest fang, four columns to the nearest wall of
# light. Asserted here rather than left to the lint, because a light standing
# in a stud run is not a near miss -- it is a room that kills you as control
# comes back.
for x, h in SCONCE:
    for x0, n in STUDS[h]:
        gap = min(abs(x - x0), abs(x - (x0 + n - 1)))
        assert gap >= 4, 'sconce %d in hall %d is %d from the studs at %d' % (x, h, gap, x0)
    for c, _, _ in LASERS[h]:
        assert abs(x - c) >= 4, 'sconce %d in hall %d is %d from the laser at %d' % (x, h, abs(x - c), c)

# motes: over the apex of every stud run, and filling the channel mouths so
# the road up reads as a road before you have to commit to it
for h, f in enumerate(HALL):
    for x0, n in STUDS[h]:
        for k in range(n):
            if g[f - 4][x0 + k] == '.':
                g[f - 4][x0 + k] = 'o'
for (c0, c1), f in ((CH1, HALL[0]), (CH2, HALL[1])):
    for y in range(f - 5, f):
        for x in range(c0, c1 + 1):
            if g[y][x] == '.':
                g[y][x] = 'o'


rows = [''.join(r) for r in g]
for i, r in enumerate(rows):
    assert len(r) == W, f'row {i} is {len(r)}'

shuttles = ',\n'.join(
    "      { x0: %d, y0: %d, x1: %d, y1: %d, period: %.2f, phase: %s }"
    % (c, HALL[h] - AIR, c, HALL[h] - 1, n * PULSE, ph)
    for h in range(3) for c, n, ph in LASERS[h])

defn = """  // 2 · THE FAMINE — a serpentine, to the drawing. Three halls stacked and run
  // in alternating directions, joined by two updraft channels: start at the
  // bottom left, cross right, get lifted, cross back left, get lifted, and
  // cross right to the stone. Nothing on the route can be skipped — an open
  // room lets a solver cut the middle out, a serpentine makes every beat
  // serial, and that is the whole reason for the shape.
  //
  // Three obstacles and nothing else. STUDS set on the floor at ankle height
  // with stone underneath, so they are jumped rather than fallen into.
  // LASER RAILS strung floor to ceiling, which cannot be gone under or over:
  // you read the bolt and run when it is at the far end. And THE CHANNELS,
  // updraft columns you jump into and are carried by — wind is the enemy
  // everywhere else in this act and here it is the road.
  //
  // Six courses of air over each floor: enough to jump a stud (the body rises
  // 2.68), enough that a laser reads as a wall of light, and not so much that
  // the hall stops being a corridor.
  //
  // deadLight: the sconces hold your place and hand you nothing back. One at
  // the start and one at the head of each channel, so a fall costs the hall
  // you are in and never the hall behind it.
  {
    glyph: 'famine',
    chambers: [17, 35],
    deadLight: true,
    // the beat clock: 2-4 pulses, phases on the quarter-pulse
    shuttles: [
%s
    ],
    currents: [
      // The two roads up, at opposite ends: jump in and be carried. Named by
      // the SHAFT they cut through the rock -- the wind then fills whatever
      // that shaft opens into, at both ends, because a current that stopped
      // partway up a shaft would stop for no reason a player could see.
      { x0: %d, y0: %d, x1: %d, y1: %d, force: 46 },
      { x0: %d, y0: %d, x1: %d, y1: %d, force: 46 },
    ],
    map: [
%s
    ],
  },
"""
body = ',\n'.join("      '" + r + "'" for r in rows)
out = defn % (shuttles,
              CH1[0], HALL[1], CH1[1], HALL[0] - AIR - 1,
              CH2[0], HALL[2], CH2[1], HALL[1] - AIR - 1,
              body)

p = 'src/world/vaults.ts'
s = io.open(p, encoding='utf-8').read()
start = s.index('  // 2 · THE FAMINE')
end = s.index('  // 3 · THE LAST SHIFT')
io.open(p, 'w', encoding='utf-8').write(s[:start] + out + s[end:])

print(f'THE FAMINE · {HGT} rows x {W} · 3 halls · {sum(len(x) for x in LASERS)} lasers · 2 channels\n')
print('    ' + ''.join(str(i // 10 % 10) for i in range(W)))
print('    ' + ''.join(str(i % 10) for i in range(W)))
for i, r in enumerate(rows):
    print(f'{i:3d} {r}')
