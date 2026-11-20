"""THE EMBER — the descent, chased (2026-11-20). 44 x 97, two chambers.

The deepest drop in the game and the room about commitment. It is built in
two halves that the camera cuts between at column 21, and one line of light
across the whole room: above it you learn every noun in calm, below it you
spend them all with the dark pouring down behind you.

THE TEACH — no wave. Every element the chase will use, met once, alone:

   1  THE ICE WALK. Start top-left on a stub of stone and go RIGHT along a
      walkway of rime over a line of fangs: each shelf holds 0.55 s after
      you touch it, then drops, then comes back 3.5 s later. Keep moving;
      hop the two-tile gap in the middle. Stone (L1) across the cut.
   2  THE LANTERN. From L1's lip, catch the swinging lantern's crown at the
      slow end of its swing, ride it east over the fangs and step off onto
      the piston housing's roof (L2).
   3  THE TRAPDOOR AND THE PISTON. Walk onto the rime lid at L2's east end.
      It holds, cracks, drops you into a chute, and a piston punches across
      the chute from the housing. Step on as it slams home and you fall
      through behind it. L3 catches you under the chute.
   4  TWO BREATHS. West off L3 over a fanged gap that no single spark
      crosses: jump, spark, the brazier refills you in mid-air, spark again
      onto L4 — the commit shelf, with the room's one light (S1). Out over
      the void to its west hangs an ember: the way on.

THE GATE — a curtain of light across the whole room under L4. You pass it
falling; it will not pass you back. The trigger is the band just under it:
the dark wakes then, eight courses above the commit light, and pours
down at 2.8 tiles a second. There is no light below the gate. From here to
the stone is one unbroken run, and a gutter anywhere sends you back to S1.

THE CHASE — each beat waits on a stone, and waiting is what the dark eats:

   5  THE PLUNGE. Off L4's west lip, through the gate, fourteen tiles west
      and twenty-two courses down onto P1 — two tiles of stone with a fang at
      its lip. P1 is fifteen courses below the commit light's frame, so the
      ember and a line of motes draw the way: spark flat west at the ember,
      it gives the spark back, and the motes run on down to P1. The legs
      alone do not reach it; straight down is a fang line over the throat.
   6  THE RIDE. The same lantern you plunged past: from P1, jump for its
      crown as it swings in, ride east over the fangs, step off onto the
      throat's west shoulder (P2). Three courses up — no spark reaches it.
   7  THE THROAT. A rime lid over a shaft with two pistons punching across
      it from either wall. Read them from P2, step on the lid so it drops you
      as both go home, fall through. P3 under the shaft.
   8  THREE BREATHS. East across the cut over a sixteen-tile fanged gap:
      spark, brazier, spark, brazier, spark, onto P4 in the last chamber.
      Climb in the air and the dark takes you; keep the arcs flat.
   9  THE CASCADE. Off P4 onto two rime shelves stepping down and west under
      the crossing's fangs. You cannot wait on rime: land, jump, land, jump,
      onto P5, the last stone.
  10  THE COLUMN. Through the second gate into the column, past the last
      piston, which spans it wall to wall (read it from P5, go when it goes
      home). Under you, fangs; to the east, the seed's chamber, its roof
      fanged on top. Free-fall and you land on one or the other. Hold the
      column until you are under the roof's lip, then spark east (or take
      the brazier hung in its doorway) and land beside the stone.

The chase recombines and never introduces: lantern, rime, piston, brazier,
gate — every one met above the line first. The last chamber holds no light.

Fall-throughs are closed, not trusted: fang lines under the ice, the
lanterns, both brazier gaps, the teach's east limb and the throat under L4,
and the last piston's housing, so nothing missed above lands on something
below.
"""
import io
import sys

W, HGT = 44, 97
PULSE = 0.85

g = [['.'] * W for _ in range(HGT)]


def put(x, y, ch='#'):
    assert 0 <= x < W and 0 <= y < HGT, (x, y, ch)
    g[y][x] = ch


def run(x0, x1, y, ch='#'):
    for x in range(x0, x1 + 1):
        put(x, y, ch)


def block(x0, x1, y0, y1, ch='#'):
    for y in range(y0, y1 + 1):
        run(x0, x1, y, ch)


def motes(pts):
    for x, y in pts:
        if g[y][x] == '.':
            put(x, y, 'o')


# ============================ THE TEACH (no wave) ============================
# T1 · the ice walk: a floor that goes as you cross it
run(0, 3, 6)
put(1, 5, '@')
run(4, 9, 6, 'R')
run(12, 17, 6, 'R')
run(18, 23, 6)                           # L1, walked across the cut
run(4, 17, 9, 'X')                       # the fang line under the ice
motes([(10, 4), (11, 4)])

# T2 · the lantern: ride it across
put(30, 2)                               # the lantern's mount, out of reach
run(24, 35, 11, 'X')
run(35, 38, 8)                           # L2, the top of the piston housing

# T3 · the trapdoor and the piston
block(35, 38, 9, 17)                     # the housing the piston lives in
run(39, 41, 8, 'R')                      # the lid
block(42, 42, 6, 17)                     # the chute's far wall
run(34, 41, 21)                          # L3, under the chute

# T4 · the brazier: two breaths, one gap
put(29, 17, '*')
put(29, 13)                              # its chain's stone
run(24, 33, 24, 'X')
run(19, 23, 18)                          # L4, the gate shelf
put(20, 17, 'S')                         # the commit light
# the ember that points the way on: hung out over the plunge, west of the
# lip, on the line the spark flies, so the one warm thing in the commit
# light's frame says "out and down that way" -- not "straight down", where
# the throat's housings wait under a fang line. Its chain runs up to a
# stone under the ice walk's fangs, out of every reach.
put(13, 21, '*')
put(13, 10)                              # its chain's stone

# ================================ THE GATE ===================================
GATE_ROW = 26

# ================================ THE CHASE ==================================
# nothing missed above the gate lands on the chase: a fang line under the
# teach's east limb, so a fall off L3 never comes down on P4
run(14, 43, 30, 'X')
# ...and over the throat too: a drop straight off L4 used to land on the
# throat's shoulders and skip the plunge and the ride
# C1 · the plunge, past the lantern, onto the far-west ledge
run(4, 5, 40)                            # P1
put(6, 39, 'X')                          # a fang at its lip: come down onto it, not across
put(11, 35)                              # the lantern's mount...
put(11, 34, 'X')                         # ...fanged, so nobody lands on it
run(6, 13, 43, 'X')                      # the fangs under the swing
# C2 · ride it east, onto the throat's west shoulder
block(14, 17, 37, 50)                    # the throat's west housing; P2 is its top
block(21, 24, 35, 50)                    # the throat's east housing
run(18, 20, 37, 'R')                     # the lid
# C3 · the throat
run(15, 21, 54)                          # P3
# C4 · the brazier crossing, into the last chamber
put(26, 52, '*')
put(26, 46)
put(32, 54, '*')
put(32, 49)
run(22, 32, 59, 'X')
run(38, 42, 57)                          # P4
# C5 · the cascade, west under the crossing
run(34, 35, 65, 'R')
run(29, 30, 67, 'R')
run(23, 25, 69)                          # P5, the last stone before the drop
# C6 · the column: the last piston, the brazier, the seed under its roof
block(14, 21, 71, 80)                    # the last piston's housing
run(14, 21, 70, 'X')                     # ...fanged, so a fall off P3 cannot skip to it
put(30, 89, '*')                         # the ember in the seed's doorway
run(30, 41, 86, 'X')                     # fangs on the roof: free-fall here and burn
run(30, 41, 87)                          # the roof over the seed
run(22, 31, 95, 'X')
run(32, 41, 95)
put(39, 94, 'M')
put(36, 94, 'N')

# --- motes: the arcs the room asks for, traced before you jump them --------
motes([(26, 4), (28, 3), (32, 3), (34, 5)])               # T2, the ride
motes([(32, 16), (29, 15), (26, 15)])                     # T4, the two breaths
motes([(17, 19), (15, 20), (11, 22), (9, 24), (8, 28), (6, 33), (5, 37)])  # C1, the plunge west, through the ember
motes([(8, 35), (14, 34)])                                # C2, the swing's ends
motes([(25, 50), (29, 50), (35, 53)])                     # C4, three breaths
motes([(36, 62), (32, 63), (27, 65)])                     # C5, the cascade
motes([(28, 84), (29, 86), (31, 90)])                     # C6, round the roof's lip

CENSERS = [
    # (x, y, len, arc, pulses, phase)
    (30, 3, 3.5, 0.95, 3, 0.0),           # T2
    (11, 36, 3.5, 0.95, 3, 0.0),          # C2
]
CRUSHERS = [
    # (x, y, w, h, dx, dy, pulses, phase)
    (35, 13, 3, 2, 4, 0, 4, 0.0),         # T3
    (14, 41, 3, 2, 4, 0, 4, 0.0),         # C3 upper, from the west
    (21, 46, 3, 2, -4, 0, 4, 0.875),      # C3 lower, from the east
    (14, 75, 8, 2, 8, 0, 4, 0.25),        # C6
]
GATES = [(0, GATE_ROW, W - 1, GATE_ROW), (22, 71, 29, 71)]
PURSUIT = dict(zone=(0, 9, W - 1, 85), speed=2.8, trigger=(0, GATE_ROW + 1, W - 1, GATE_ROW + 3))

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

defn = """  // 5 · THE EMBER — the descent, chased (scripts/author-ember.py). Above
  // the curtain every noun is met alone and in calm: the ice walk, the
  // lantern, the trapdoor over a piston, two breaths off a brazier, and the
  // room's one light. Below it the dark pours down at 2.8 tiles a second and
  // there is no light at all: plunge onto a two-tile ledge, ride the lantern
  // up to the throat, drop through two pistons, three breaths across the cut,
  // a rime cascade you cannot stand on, and a wall-to-wall piston over a
  // column whose floor is fangs. The seed sits under a fanged roof to the
  // side of the fall line: free-fall and you burn; steer and spark under the
  // lip and you kneel beside it.
  {
    glyph: 'ember',
    chambers: [21],
    openEdges: true,
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
      speed: %.1f,
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
for i, r in enumerate(rows):
    print(f'{i:3d} {r}')
