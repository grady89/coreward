"""THE FAMINE — built to the drawing. 56 x 56.

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

W, HGT = 56, 56
MAXJ = 5.45
PULSE = 0.85

g = [['#'] * W for _ in range(HGT)]          # solid, and the halls are cut out

# hall floor rows, bottom to top, and the six courses of air over each
HALL = [42, 30, 18]
AIR = 6
LEFT, RIGHT = 2, W - 3

# the two channels: (columns, from hall, to hall)
CH1 = (50, 53)                                # right end: hall A -> hall B
CH2 = (19, 22)                                # hall B's left end -> hall C


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


# Each hall has its own extent. Hall A is the long one -- a start, a wide pit,
# a flat run and four landings all have to fit in it. Halls B and C are chains
# of small pads and are exactly as long as their chains, so the rock west of
# the second lift is simply rock.
HALL_X = [(LEFT, RIGHT), (CH2[0], RIGHT), (CH2[0], RIGHT)]

for f, (a, b) in zip(HALL, HALL_X):
    carve(a, b, f - AIR, f - 1)

# --- the channels: cut through the rock between the halls ------------------
carve(CH1[0], CH1[1], HALL[1] - 1, HALL[0] - 1)      # A -> B, right end
carve(CH2[0], CH2[1], HALL[2] - 1, HALL[1] - 1)      # B -> C

# ===========================================================================
# THE HALLS, in the drawing's own vocabulary.
#
#   SOLID  (x0, x1)   ground you can stand on
#   PIT    (x0, x1)   a hole with unlight at the bottom. Falling in is death
#                     and a walk back from the last light -- NOT a spike set
#                     into a floor, which is what the first pass built.
#   LEDGE  (x0, w)    a shelf two courses up. Never three: the body rises 2.68
#   LASER  ('v', col, pulses, phase)          a wall of light, floor to ceiling
#          ('h', x0, x1, pulses, phase)       a bolt laid along the ground
#
# HALL A, to the brief: a starting section, a WIDE jump over a pit, a long
# flat run crossed by one horizontal rail AND two vertical ones over the top
# of it, four jumps onto one-tile landings, and the lift out.
# ===========================================================================
# A pit's bottom is a VOID (`_`) -- unlight that is never drawn. The first pass
# floored them with visible unlight, which lights the hole and turns a fall
# into a landing on something; THE WICK's pits are open sky and read as an
# absence, and these read the same way.
#
# HOW DEEP IS WHATEVER ROCK THERE IS. A fixed depth put hall B's pit floors
# eleven courses down, which is through the five courses of rock under it and
# out into HALL A'S AIR -- lethal tiles hanging in the middle of the hall
# below, and the pit itself a hole between two storeys. The bottom hall gets
# the whole basement; the others get the band under them, less the course that
# is the next hall's ceiling.
def pit_depth(h):
    below = HALL[h - 1] - AIR - 1 if h > 0 else HGT - 2
    return below - HALL[h] - 1


PIT_DEPTH = [pit_depth(h) for h in range(3)]

SOLID = [
    [(2, 13), (19, 34), (37, 37), (40, 40), (43, 43), (46, 46), (CH1[0], CH1[1])],
    # HALL B, read RIGHT TO LEFT: the pad at the top of the first lift, then
    # three jumps onto small pads with a wall of light standing in each gap --
    # and TWO in the last one, both to be threaded in a single jump -- landing
    # in the second lift.
    [(CH2[0], CH2[1]), (28, 31), (36, 39), (44, 49)],
    [(CH2[0], RIGHT)],
]
PIT = [
    [(14, 18), (35, 36), (38, 39), (41, 42), (44, 45), (47, 49)],
    [(23, 27), (32, 35), (40, 43)],
    [],
]
STUDS = [[], [], [(30, 4), (46, 3)]]
LEDGES = [[], [], [(40, 4)]]
LASER = [
    # the long flat run, all three lights over the same stretch of floor
    [('h', 20, 33, 3, 0.0), ('v', 24, 2, 0.25), ('v', 30, 2, 0.75)],
    # one in each gap, and two in the last: 1.10x is the whole width of the
    # legs' reach, so threading both is one jump with no room to hesitate
    [('v', 41, 3, 0.0), ('v', 33, 3, 0.5), ('v', 24, 2, 0.25), ('v', 26, 2, 0.75)],
    [('v', 19, 2, 0.0), ('v', 36, 2, 0.5), ('v', 45, 2, 0.25)],
]
LEDGE_RISE = 2

# a hall's floor exists only where the table says it does
for h, f in enumerate(HALL):
    for x in range(HALL_X[h][0], HALL_X[h][1] + 1):
        if not any(a <= x <= b for a, b in SOLID[h]):
            g[f][x] = '.'
    for x0, x1 in PIT[h]:
        d = PIT_DEPTH[h]
        assert d >= 3, 'hall %d has only %d courses of rock for a pit' % (h, d)
        carve(x0, x1, f, f + d - 1)
        for x in range(x0, x1 + 1):
            put(x, f + d, '_')                  # unlight you never see
    for x0, n in STUDS[h]:
        studs(f, x0, n)
    for x0, n in LEDGES[h]:
        ledge(f, x0, x0 + n - 1, LEDGE_RISE)

# A pit of n columns is a crossing of n+1 tiles. Six tiles is 1.10x the
# measured jump, which THE WICK proves the legs can do -- caught on the falling
# half of the arc, with eleven frames to spare. Seven is the spark's business.
for h in range(3):
    for x0, x1 in PIT[h]:
        tiles = x1 - x0 + 2
        assert tiles <= 6, ('hall %d: the pit at %d is a %d-tile crossing (%.2fx), '
                            'past the legs' % (h, x0, tiles, tiles / MAXJ))

# --- entry, the stone, and the lights --------------------------------------
# Entry + three, all dead (SII.2): the famine's sconces hold your place and
# hand you nothing. One at the start, one where each channel sets you down, so
# a fall costs the hall you are in and never the hall behind it.
SCONCE = [(7, 0), (47, 1), (24, 2)]
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
    for L in LASER[h]:
        cols = [L[1]] if L[0] == 'v' else [L[1], L[2]]
        for c in cols:
            assert abs(x - c) >= 4, ('sconce %d in hall %d is %d from a laser at %d'
                                     % (x, h, abs(x - c), c))

# motes: over the apex of every stud run, and filling the channel mouths so
# the road up reads as a road before you have to commit to it
for h, f in enumerate(HALL):
    for x0, x1 in PIT[h]:
        for x in range(x0, x1 + 1):
            if g[f - 4][x] == '.':
                g[f - 4][x] = 'o'
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

def laser_def(h, L):
    # A vertical rail is given its column and seats itself floor to ceiling.
    # A horizontal one is given its run and seats itself a course above the
    # ground -- so both say WHERE and let the room say how far.
    if L[0] == 'v':
        _, c, n, ph = L
        return (c, HALL[h] - AIR, c, HALL[h] - 1, n * PULSE, ph)
    _, x0, x1, n, ph = L
    return (x0, HALL[h] - 1, x1, HALL[h] - 1, n * PULSE, ph)


shuttles = ',\n'.join(
    "      { x0: %d, y0: %d, x1: %d, y1: %d, period: %.2f, phase: %s }" % laser_def(h, L)
    for h in range(3) for L in LASER[h])

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

print(f'THE FAMINE · {HGT} rows x {W} · 3 halls · {sum(len(x) for x in LASER)} lasers · 2 channels\n')
print('    ' + ''.join(str(i // 10 % 10) for i in range(W)))
print('    ' + ''.join(str(i % 10) for i in range(W)))
for i, r in enumerate(rows):
    print(f'{i:3d} {r}')
