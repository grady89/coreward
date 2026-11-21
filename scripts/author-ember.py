"""THE EMBER v7 -- the descent, chased, on one line (2026-11-21). 44 x 34.

v6 was a branchy room with a light hung over it: a 97-course map, mostly
open air, with drops of fifteen to twenty-five courses whose landings were
out of frame. The playtest read every one of those drops as a guess. v7 is
rebuilt as ONE carved line through solid rock, switching back on itself four
times on the way down:

  * Everything that is not the path is stone.
  * Every pit on the path is floored with fangs you can see from where you
    stand. The fangs sit flush with the footing, or one course under it.
  * No step down is more than five courses. The camera holds 7.4 courses
    either side of the body (22-column chamber, 1280 x 800), so from every
    rest point the next footing is on screen before you commit.
  * Every cut is crossed on foot, over a stone that straddles it.

The rows below are standing rows (the tile you stand ON).

THE TEACH -- no dark. Every noun, met once, alone:

   1  THE ICE WALK (row 6, east). From the stub at the top left, right along
      two rime shelves over a bed of fangs. Each shelf holds 0.55 s after
      you touch it, so keep moving, and hop the two-tile gap. L1 is stone
      across the cut.
   2  THE LANTERN (row 6 -> 8, east). From L1's lip, catch the lantern's
      crown at the slow end of its swing, ride it east over the fangs and
      step off onto the piston housing's roof (L2).
   3  THE TRAPDOOR AND THE PISTON (row 8 -> 14). Walk onto the rime lid. It
      holds, cracks, and drops you down a chute that a piston punches across.
      Step on as it slams home and you fall behind it onto L3, six courses
      down and in frame from L2.
   4  TWO BREATHS (row 14 -> 13, west). Off L3's west lip over a fang bed
      that one spark does not cross: jump, spark, the brazier refills you,
      spark again onto L4, the commit shelf, which straddles the cut. The
      room's one light (S1) is on it.

THE GATE -- a curtain of light across the plunge hall, one course under L4.
You pass it falling and it will not pass you back up. The band under it
wakes the dark. There is no light below the gate.

THE CHASE -- each beat waits on a stone, and waiting is what the dark eats:

   5  THE PLUNGE (row 13 -> 18, west). Jump off L4's west lip, over the fangs
      and through the gate, onto P1: the throat's east shoulder, five courses
      down. The ember hangs over P1 and marks it from S1. Walk off the lip
      and you land in the fangs.
   6  THE THROAT (row 18 -> 23). A rime lid between two housings. Two pistons
      close across the shaft under it like jaws. Read them from P1, step on
      the lid so that it drops you as they open, and fall through onto P3.
   7  THE RIDE (row 23, east). The lantern hangs from the ceiling over a fang
      pit. Hop onto its crown at the west end of its swing, ride it east, and
      step off onto P4, which straddles the cut. The ceiling is too low to
      jump the pit.
   8  THREE BREATHS (row 23 -> 25, east). From P4 over a fourteen-tile fang
      bed: spark, brazier, spark, brazier, spark, onto P5 at the east wall.
      Climb in the air and you climb into the dark, so keep the arcs flat.
   9  THE LAST WALK (row 25 -> 30 -> 32, west). Drop down the slot by P5
      through the second gate, then cross the last rime shelf over fangs,
      which you cannot stand on, to the island over the cut. Then pass under
      the last piston as it lifts and step down into the stone's pocket.
      The dark's zone ends one course above the pocket. You win the race on
      the last step.

The chase recombines and never introduces. Lantern, rime, piston, brazier,
gate: you meet every one above the line first.
"""
import io

W, HGT = 44, 34
PULSE = 0.85

g = [['#'] * W for _ in range(HGT)]


def put(x, y, ch):
    assert 0 <= x < W and 0 <= y < HGT, (x, y, ch)
    g[y][x] = ch


def run(x0, x1, y, ch):
    for x in range(x0, x1 + 1):
        put(x, y, ch)


def air(x0, x1, y0, y1):
    for y in range(y0, y1 + 1):
        run(x0, x1, y, '.')


def motes(pts):
    for x, y in pts:
        assert g[y][x] == '.', ('mote on', x, y, g[y][x])
        put(x, y, 'o')


# ============================ THE TEACH (no dark) ============================
# the hall over the first two beats; its ceiling is the room's top course
air(1, 41, 1, 5)
put(30, 1, '#')
put(30, 2, '#')                          # the lantern's mount, hung from the roof
# T1 . the ice walk: rime over a fang bed, stone either side
put(1, 5, '@')
run(4, 9, 6, 'R')
run(10, 11, 6, '.')
run(12, 17, 6, 'R')
run(4, 17, 7, 'X')
#   L1 is the stone at (18-23, 6), across the cut
# T2 . the lantern, over a fang pit two courses deep
air(24, 34, 6, 7)
run(24, 34, 8, 'X')
# T3 . the trapdoor and the piston. L2 is the housing's roof (35-38, 8)
air(35, 41, 6, 7)
run(39, 41, 8, 'R')                      # the lid
air(39, 41, 9, 12)                       # the chute
#   L3 is the floor at (34-41, 13), out under the housing
# T4 . two breaths: L3 -> brazier -> L4, west across the cut, under a roof
#   three courses high, so the arcs stay flat
air(24, 34, 10, 10)
air(24, 38, 11, 12)
run(24, 33, 13, 'X')
air(16, 23, 9, 12)                       # over L4
#   L4 is the stone at (16-23, 13)
put(19, 12, 'S')                         # the commit light

# ================================ THE GATE ===================================
GATE1 = (1, 14, 15, 14)

# ================================ THE CHASE ==================================
# C1 . the plunge hall, under the ice walk, west of L4
air(1, 15, 9, 17)
run(12, 15, 18, 'X')                     # short of P1: fangs
#   P1 is the throat's east shoulder (8-11, 18)
# C2 . the throat
run(1, 3, 18, 'X')                       # the west shoulder is fanged
run(4, 7, 18, 'R')                       # the lid
air(4, 7, 19, 22)                        # the shaft the jaws close across
air(4, 11, 21, 22)                       # out under the east housing
#   P3 is the floor at (4-11, 23)
# C3 . the ride: a lantern hung from L4's underside, over a fang pit, under
#   a roof too low to jump the pit
air(10, 20, 20, 20)
air(12, 20, 21, 24)
run(12, 20, 25, 'X')
#   P4 is the stone at (21-23, 23), across the cut
# C4 . three breaths, east, under a roof as low as the two breaths' roof
air(21, 42, 20, 22)
run(24, 37, 23, 'X')
#   P5 is the stone at (38-40, 23). The slot beside it is the way down
air(41, 42, 23, 27)
# C5 . the last walk, west along the bottom
air(24, 42, 25, 27)
air(24, 38, 28, 29)                      # the ledge (39-42, 28) steps down to it
air(5, 23, 27, 29)
run(25, 28, 30, 'R')                     # the last rime, with the ice walk's gap
run(31, 34, 30, 'R')
run(29, 30, 30, '.')
run(25, 34, 31, 'X')
air(5, 7, 30, 31)                        # the stone's pocket
put(6, 31, 'M')
put(5, 31, 'N')

# the ember: hung over P1 in the plunge hall, the warm mark S1 points at
put(10, 15, '*')
# the two breaths' brazier, and the three breaths' two
put(29, 11, '*')
put(28, 21, '*')
put(33, 21, '*')

# --- motes: the arcs the room asks for, traced before you jump them --------
motes([(26, 3), (28, 2), (32, 2), (34, 4)])               # T2, the ride
motes([(32, 11), (25, 11)])                               # T4, two breaths
motes([(14, 11), (12, 13)])                               # C1, the plunge
motes([(25, 21), (30, 21), (36, 21)])                     # C4, three breaths
motes([(30, 28), (16, 28)])                               # C5, the last walk

CENSERS = [
    # (x, y, len, arc, pulses, phase)
    (30, 3, 3.5, 0.95, 3, 0.0),           # T2
    (16, 20, 4.0, 0.95, 3, 0.0),          # C3, hung from L4's underside
]
CRUSHERS = [
    # (x, y, w, h, dx, dy, pulses, phase)
    (35, 9, 3, 2, 4, 0, 4, 0.0),          # T3, across the chute
    (2, 19, 2, 2, 2, 0, 4, 0.0),          # C2, the west jaw
    (8, 19, 2, 2, -2, 0, 4, 0.0),         # C2, the east jaw
    (9, 25, 3, 2, 0, 3, 4, 0.0),          # C5, the last piston, down from the roof
]
GATE2 = (41, 24, 42, 24)                  # the slot by P5: one way, down
GATES = [GATE1, GATE2]
PURSUIT = dict(zone=(0, 9, W - 1, 29), speed=0.77, trigger=(1, 15, 15, 17))

rows = [''.join(r) for r in g]
for i, r in enumerate(rows):
    assert len(r) == W, f'row {i} is {len(r)}'

censers = ',\n'.join(
    "      { x: %s, y: %d, len: %.1f, arc: %.2f, period: %.2f, phase: %s }"
    % (x, y, ln, arc, n * PULSE, ph) for x, y, ln, arc, n, ph in CENSERS)
crushers = ',\n'.join(
    "      { x: %d, y: %d, w: %d, h: %d, dx: %d, dy: %d, period: %.2f, phase: %s }"
    % (x, y, w, h, dx, dy, n * PULSE, ph) for x, y, w, h, dx, dy, n, ph in CRUSHERS)
gates = ',\n'.join("      { x0: %d, y0: %d, x1: %d, y1: %d }" % gt for gt in GATES)
z, t = PURSUIT['zone'], PURSUIT['trigger']

defn = """  // 5 · THE EMBER — the descent, chased, on one line (scripts/author-ember.py).
  // One carved path through solid rock, switching back four times on the way
  // down. Everything off it is stone, every pit on it is floored with fangs
  // in plain sight, and no step down is deeper than the frame shows. Above
  // the curtain every noun is met alone and in calm: the ice walk, the
  // lantern, the trapdoor over a piston, two breaths off a brazier, and the
  // room's one light. Below it the dark pours down and there is no light:
  // the plunge, the throat's jaws, the lantern ride, three breaths, and the
  // last walk over rime and under the last piston into the stone's pocket.
  {
    glyph: 'ember',
    chambers: [21],
    censers: [
%s
    ],
    crushers: [
%s
    ],
    gates: [
%s
    ],
    pursuit: {
      zone: [%d, %d, %d, %d],
      dir: 'down',
      speed: %.2f,
      trigger: [%d, %d, %d, %d],
    },
    map: [
%s
    ],
  },
"""
body = ',\n'.join("      '" + r + "'" for r in rows)
out = defn % (censers, crushers, gates, *z, PURSUIT['speed'], *t, body)

p = 'src/world/vaults.ts'
s = io.open(p, encoding='utf-8').read()
start = s.index('  // 5 · THE EMBER')
end = s.index('  // 6 · THE WEATHER')
io.open(p, 'w', encoding='utf-8').write(s[:start] + out + s[end:])

print(f'THE EMBER · {HGT} x {W}')
print('    ' + ''.join(str(x // 10) for x in range(W)))
print('    ' + ''.join(str(x % 10) for x in range(W)))
for i, r in enumerate(rows):
    print(f'{i:3d} {r}')
