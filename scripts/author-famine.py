"""THE FAMINE — built to the drawing. 56 x 58.

    start ---> hall A ---> [wind] ---> hall B <--- [wind] ---> hall C ---> finish
                             up                     up

A SERPENTINE: three halls stacked, run in alternating directions and joined by
two updraft channels. You start at the bottom left, cross right, are lifted,
cross back left, are lifted again, and cross right to the stone. Nothing on the
route can be skipped, which is the whole reason for the shape — an open room
lets a solver cut the middle out, a serpentine makes every beat serial.

THE OBSTACLES, to the drawing (2026-09-05):

  * LASER RAILS — vertical bolts six courses tall (a wall of light that legs
    cannot clear), bolts laid along the ground to be jumped, and one hung
    over hall C's gaps so every jump is timed against it. The room's clock.
  * THE CHANNELS — updraft columns. You jump in and are carried; the wind was
    the enemy everywhere else and here it is the road.
  * SPIKED BLOCKS — hanging stones with death spikes on the bottom, staggered
    through both channels: the ride up is a weave, and a cap over each exit
    turns the way out sideways.

Built the way THE WICK is built (openEdges): open sky, one-course floors laid
into it, no roof, no side walls, no rock below. What keeps a fall honest is
the unseen `_` plane eight courses under each floor -- and past the map's
edge, the openEdges void.

A hall's lasers stand SIX courses over its floor. That is enough to jump a
stud (the body rises 2.68) and enough that a laser reads as a wall of light
rather than a dash -- and six courses is past what legs can clear, so a rail
with no ceiling over it is still a wall.

Distances are fractions of the MEASURED running jump (5.45 tiles across, 2.68
up — docs/movement-metrics.md). A stud run of n columns is a crossing of n+1
tiles, so a run of four is 0.92x and a run of five is past what legs can do.
"""
import io

W, HGT = 56, 58
MAXJ = 5.45
PULSE = 0.85

g = [['.'] * W for _ in range(HGT)]          # open sky, and the halls float in it

# Hall floor rows, bottom to top, and the six courses of air over each. They
# sit SIXTEEN apart, not twelve, because every hall needs eight courses of open
# space under it for its fall before the kill plane -- see FALL below.
HALL = [46, 30, 14]
AIR = 6
LEFT, RIGHT = 2, W - 3

# the two channels: (columns, from hall, to hall)
CH1 = (50, 53)                                # right end: hall A -> hall B
CH2 = (19, 22)                                # hall B's left end -> hall C


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

# --- the channels: columns of wind in the open air between the halls -------
CH1_ROWS = (HALL[1] - 1, HALL[0] - 1)
CH2_ROWS = (HALL[2] - 1, HALL[1] - 1)

# ===========================================================================
# THE HALLS, in the drawing's own vocabulary.
#
#   SOLID  (x0, x1)   ground you can stand on
#   PIT    (x0, x1)   a hole with unlight at the bottom. Falling in is death
#                     and a walk back from the last light -- NOT a spike set
#                     into a floor, which is what the first pass built.
#   LEDGE  (x0, w)    a shelf two courses up. Never three: the body rises 2.68
#   LASER  ('v', col, pulses, phase)          a wall of light, six courses tall
#          ('h', x0, x1, pulses, phase)       a bolt laid along the ground
#          ('H', x0, x1, rise, pulses, phase) a bolt hung `rise` over it, from
#                                             one-tile anchor stones
#
# HALL A, to the brief: a starting section, a WIDE jump over a pit, a long
# flat run crossed by one horizontal rail AND two vertical ones over the top
# of it, four jumps onto one-tile landings, and the lift out.
# ===========================================================================
# THE FALL, done the way THE WICK does it.
#
# Every platform in a hall is ONE COURSE THICK and floats. Under all of them is
# eight courses of open air and then a plane of `_` -- unlight that kills on
# touch and is never drawn. Miss a jump and you fall out of the level.
#
# The first pass got this wrong twice. It carved each pit as a deep shaft and
# floored it with drawn unlight, which lights the hole; and it left the ground
# between the pits as columns of rock running to the basement, so a missed
# landing put you against a wall you could simply kick your way back up. A
# pillar with a face on it is a rescue. A floating stone is not.
FALL = 8

SOLID = [
    [(2, 13), (19, 34), (37, 37), (40, 40), (43, 43), (46, 46), (CH1[0], CH1[1])],
    # HALL B, read RIGHT TO LEFT (the drawing): the arrival slab at the top
    # of the first lift, a rail-guarded jump onto a small pad, then the
    # DOUBLE-RAIL PAD -- a wall of light on EACH lip with two safe tiles
    # between them, entered through one and left through the other -- then
    # a slab with a bolt laid along it, and the launch pad into the wind.
    [(CH2[0], CH2[1]), (27, 32), (35, 38), (40, 42), (44, 49)],
    # HALL C, to the drawing: the landing out of the wind, three gap jumps
    # under the hung rail, and the finish slab with the stone.
    [(23, 28), (32, 35), (39, 41), (45, RIGHT)],
]
PIT = [
    [(14, 18), (35, 36), (38, 39), (41, 42), (44, 45), (47, 49)],
    [(23, 26), (33, 34), (39, 39), (43, 43)],
    [(29, 31), (36, 38), (42, 44)],
]
STUDS = [[], [], []]
LEDGES = [[], [], []]
# SPIKED -- the drawing's new noun: a hanging block with death spikes on its
# BOTTOM. (x0, x1, row): stone across the run, unlight hung beneath it. Two
# per wind channel, staggered to opposite sides so the ride up is a weave;
# a third caps each channel's exit so you leave the wind SIDEWAYS, not
# straight up. Their tops are plain stone -- inside the wind that is no
# rest, the updraft takes you off them.
SPIKED = [
    (50, 51, 40), (52, 53, 34), (52, 53, 26),    # CH1: weave right, left, out left
    (21, 22, 24), (19, 20, 18), (19, 20, 10),    # CH2: weave left, right, out right
]
LASER = [
    # the long flat run, all three lights over the same stretch of floor
    [('h', 20, 33, 3, 0.0), ('v', 24, 2, 0.25), ('v', 30, 2, 0.75)],
    # A rail stands at the EDGE OF A LANDING, not out over the hole. Hung mid
    # pit it seats down the length of the fall and the bolt spends most of its
    # round far below the jump, so you wait it out instead of threading it --
    # the wall of light stops being a wall. On a lip it stands on stone, spans
    # exactly the hall, and is in the way for the whole of its round.
    #
    # Read right to left, so a landing's near edge is its RIGHT one. Rails on
    # BOTH lips of the pad at 35-38 make the drawing's double gate: land in
    # the two safe tiles between them, breathe, leave through the second.
    # Then hall A's ground bolt is met again on the left slab's crossing.
    [('v', 44, 3, 0.0), ('v', 40, 2, 0.5), ('v', 38, 2, 0.25), ('v', 35, 2, 0.75),
     ('h', 28, 31, 3, 0.5)],
    # HALL C is the horizontal hall, one of each kind: a long bolt hung OVER
    # the three gap jumps from one-tile anchor stones (the drawing's
    # squares) -- every full jump's apex grazes its line, so the gaps are
    # timed against it -- and a ground bolt laid along the finish slab,
    # jumped over on the run home to the stone.
    [('H', 28, 44, 3, 4, 0.0), ('h', 46, 50, 3, 0.5)],
]
LEDGE_RISE = 2

for h in range(1, 3):
    ceiling = HALL[h - 1] - AIR - 1
    assert HALL[h] + FALL < ceiling, (
        "hall %d kill plane at %d is inside hall %d, whose ceiling is %d"
        % (h, HALL[h] + FALL, h - 1, ceiling))

# a hall's floor exists only where the table says it does: one course of
# stone laid into the sky, nothing above it and nothing below (a pit is
# simply the floor's absence, so PIT needs no carving)
for h, f in enumerate(HALL):
    for x0, x1 in SOLID[h]:
        for x in range(x0, x1 + 1):
            g[f][x] = '#'
    # The kill plane, eight courses under the floor -- `_`, never drawn, so a
    # missed jump reads as falling out of the level, not landing on a thing.
    # It exists so a fall from a hall costs THAT hall and never drops you
    # onto the hall below, standing and confused. NOT laid across a lift
    # shaft: a plane drawn straight over one puts unlight inside the wind --
    # you get in at the bottom, are carried up, and are killed on the way by
    # a floor that is not there for anyone standing on it. Tested as a
    # RECTANGLE and not a column, because a shaft only runs between two
    # particular halls.
    for x in range(HALL_X[h][0], HALL_X[h][1] + 1):
        y = f + FALL
        inShaft = any(c0 <= x <= c1 and r0 <= y <= r1
                      for (c0, c1), (r0, r1) in ((CH1, CH1_ROWS), (CH2, CH2_ROWS)))
        if not inShaft:
            put(x, y, '_')
    for x0, n in STUDS[h]:
        studs(f, x0, n)
    for x0, n in LEDGES[h]:
        ledge(f, x0, x0 + n - 1, LEDGE_RISE)

# the hanging spiked blocks: stone across the run, unlight hung beneath
for x0, x1, y in SPIKED:
    for x in range(x0, x1 + 1):
        put(x, y, '#')
        put(x, y + 1, 'X')

# the drawing's anchor squares: a one-tile stone over each end of a hung
# horizontal rail, and one over the TOP of every vertical rail. The vertical
# ones are load-bearing: the game seats a vertical rail upward to the first
# stone it finds (vault.ts, shuttleSpan), and under open sky the first stone
# is nothing -- the wire ran to the top of the world and the bolt spent its
# round above the hall. The anchor pins the span to its six courses.
for h, f in enumerate(HALL):
    for L in LASER[h]:
        if L[0] == 'H':
            _, x0, x1, rise, _, _ = L
            put(x0, f - 2 - rise, '#')
            put(x1, f - 2 - rise, '#')
        elif L[0] == 'v':
            put(L[1], f - AIR - 1, '#')

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
SCONCE = [(7, 0), (48, 1), (24, 2)]
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
    # the arc's apex row -- dropped one course where a hung rail runs along
    # it, because a mote is safe-language and may not trace a lethal line
    hung = {f - 1 - L[3] for L in LASER[h] if L[0] == 'H'}
    ay = f - 3 if f - 4 in hung else f - 4
    for x0, x1 in PIT[h]:
        for x in range(x0, x1 + 1):
            if g[ay][x] == '.':
                g[ay][x] = 'o'
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
    # A vertical rail is given its column and seats itself six courses tall.
    # A horizontal one is given its run and seats itself a course above the
    # ground -- or `rise` courses over it for the hung kind ('H') -- so each
    # says WHERE and lets the room say how far.
    if L[0] == 'v':
        _, c, n, ph = L
        return (c, HALL[h] - AIR, c, HALL[h] - 1, n * PULSE, ph)
    if L[0] == 'H':
        _, x0, x1, rise, n, ph = L
        return (x0, HALL[h] - 1 - rise, x1, HALL[h] - 1 - rise, n * PULSE, ph)
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
  // Three obstacles and one new noun. LASER RAILS — vertical walls of light
  // six courses tall (past what legs can clear, so open sky above them
  // changes nothing), bolts laid along the ground to be jumped, and one hung
  // over hall C's gaps so every jump is timed against it. THE CHANNELS,
  // updraft columns you jump into and are carried by — wind is the enemy
  // everywhere else in this act and here it is the road. And SPIKED BLOCKS
  // hanging in both channels — stone above, unlight beneath — so the ride
  // up is a weave, and each channel's cap turns its exit sideways.
  //
  // Six courses of air over each floor: enough to jump a stud (the body rises
  // 2.68), enough that a laser reads as a wall of light, and not so much that
  // the hall stops being a corridor.
  //
  // deadLight: the sconces hold your place and hand you nothing back. One at
  // the start and one at the head of each channel, so a fall costs the hall
  // you are in and never the hall behind it.
  //
  // Built the way THE WICK is built: open sky, and the halls float in it.
  // No roof, no side walls, no rock under the route — a missed jump falls
  // past an unseen kill plane eight courses down (or clean out of the map,
  // which openEdges ends the same way) and re-forms at the last sconce.
  {
    glyph: 'famine',
    chambers: [17, 35],
    deadLight: true,
    openEdges: true,
    // the beat clock: 2-4 pulses, phases on the quarter-pulse
    shuttles: [
%s
    ],
    currents: [
      // The two roads up, at opposite ends: jump in and be carried. Standing
      // columns of wind in the open air between the halls, read by the motes
      // that fill them -- the shaft is drawn by what rises through it, not
      // by rock around it. Each reaches down to ONE COURSE over its launch
      // pad: with the shaft walls gone there is nothing to wall-jump, so the
      // wind itself must meet the jump that enters it.
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
              CH1[0], HALL[1], CH1[1], HALL[0] - 2,
              CH2[0], HALL[2], CH2[1], HALL[1] - 2,
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
