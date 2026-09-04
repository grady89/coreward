"""THE KINDLED — V4 authoring. 58 x 48, a boustrophedon: four long floors
snaked right, left, right, and up.

Introduces nothing. Four movements in the dark, each recombining two acts'
vocabulary, ending with the dark itself at your heels. The one thing that
feels new is the spark rule biting at full strength: with the breath spent
you are a silhouette and the room closes in, and this room is built dark
enough that the player finally understands what they have been carrying.

Three sconces for the whole exam — scarcity IS the difficulty at this
register. Cuts at 19 and 38, each with one standing on it.
"""
import io

W, H = 58, 48
g = [['.'] * W for _ in range(H)]


def box(x0, y0, x1, y1, ch='#'):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if 0 <= y < H and 0 <= x < W:
                g[y][x] = ch


def run(y, x0, x1, ch='#'):
    box(x0, y, x1, y, ch)


def put(x, y, ch):
    g[y][x] = ch


box(0, 0, W - 1, 1)
box(0, H - 1, W - 1, H - 1)
box(0, 0, 0, H - 1); box(W - 1, 0, W - 1, H - 1)

# =============================================================================
# I · THE LAMPLIGHT FLOOR · rows 3-9, walked RIGHT, in the dark.
# Bolts and a moth. Every rail is self-luminous, so the only things the room
# gives you are the hazards; the moth's violet is the only warm thing moving.
# =============================================================================
box(1, 3, 56, 8, 'd')
run(9, 1, 56)
put(3, 8, '@')
put(6, 8, 'S')                    # the entry sconce, and then nothing for a while
run(7, 10, 16, 'o')
run(7, 30, 38, 'o')
box(20, 9, 21, 9, 'X')            # holes bitten through the floor
box(33, 9, 34, 9, 'X')
box(45, 9, 46, 9, 'X')
box(12, 5, 14, 5); box(26, 5, 29, 5); box(41, 5, 43, 5)

# the turn: down the right-hand wall into II
box(50, 10, 56, 12, 'd')
run(12, 50, 56)

# =============================================================================
# II · THE CENSER GALLERY · rows 13-19, walked LEFT, over unlight.
# Three lanterns, each a quarter-pulse behind the last. The middle one is not
# a hazard to dodge; it is the floor, and there is no other.
# =============================================================================
box(1, 13, 56, 18, 'd')
run(19, 1, 56, 'X')               # the gallery's floor is the unlight itself
run(19, 1, 8); run(19, 24, 30); run(19, 50, 56)
run(17, 44, 49); run(17, 32, 38); run(17, 10, 16)
run(15, 20, 23, 'o')
run(15, 39, 43, 'o')
run(16, 18, 21)                   # a shoulder to stand the light on, four
put(19, 15, 'S')                  # courses clear of the unlight it overlooks

# =============================================================================
# III · THE PISTON CHIMNEY · rows 20-33, climbed RIGHT and up, between cycles.
# A half-height gravity seam at the top re-reads the last jumps you made.
# =============================================================================
box(1, 20, 56, 33, 'd')
run(24, 1, 12); run(24, 18, 27)
run(28, 6, 17); run(28, 30, 40)
run(32, 1, 14); run(32, 22, 34)
run(23, 3, 10, 'o')
run(27, 32, 38, 'o')
run(31, 24, 32, 'o')
box(36, 20, 56, 33, '^')          # the seam: half the chimney reads inverted,
                                  # and it starts before the cut so the last
                                  # movement introduces no dialect of its own
run(21, 41, 56); run(25, 44, 56); run(29, 41, 52); run(33, 41, 56)
run(26, 46, 54, 'o')
box(41, 24, 41, 24, 'X'); box(56, 30, 56, 30, 'X')

# =============================================================================
# THE EXHALE · rows 34-39. A wide, LIT chamber — the first steady light in the
# room, and the first time the four who stayed are seen clearly.
# =============================================================================
run(39, 1, 56)
run(39, 2, 4, '.')                # the way down into the last movement
box(1, 34, 56, 38)                # carved out below, so it reads as a room
box(3, 34, 54, 38, '.')
put(38, 38, 'S')                  # the cut-38 sconce, the exhale's own light
put(30, 38, 'K'); put(32, 38, 'F')
put(34, 38, 'C'); put(36, 38, 'N')
run(36, 8, 20, 'o')
run(36, 42, 52, 'o')

# =============================================================================
# IV · THE LONG FLOOR · rows 40-46, the pursuit RIGHT, over everything the run
# has taught in miniature. It breaks at the threshold, at the feet of the four.
# =============================================================================
box(1, 40, 56, 45, 'd')
run(46, 1, 56)
box(9, 46, 10, 46, 'X')
box(24, 46, 25, 46, 'X')
box(39, 46, 40, 46, 'X')
run(44, 4, 12, 'o')
run(42, 16, 22, 'R')
run(43, 28, 34, 'R')
run(42, 36, 44, 'o')
box(14, 43, 15, 43, '*')          # the last braziers in the game
box(46, 43, 47, 43, '*')
# the stone's own alcove: the one place in the last movement the dark does
# not reach, so the withheld vista has something to be revealed against
box(48, 41, 56, 45, '.')
put(52, 45, 'M')
put(50, 45, 'F')

rows = [''.join(r) for r in g]
for i, r in enumerate(rows):
    assert len(r) == W, f'row {i} is {len(r)}'

defn = """  // 9 · THE KINDLED — the exam. Four movements in the dark, each recombining
  // two acts' vocabulary, ending with the dark itself at your heels. It
  // introduces NOTHING: the Summit rule, and the only thing that feels new is
  // the spark rule biting at full strength, because with the breath spent you
  // are a silhouette and this room is built dark enough to prove it.
  //
  // Three sconces for the whole exam. Scarcity is the difficulty at this
  // register, and the exhale is the one steady light in it.
  {
    glyph: 'kindled',
    chambers: [19, 38],
    censers: [
      // the gallery: quarter-pulse apart over the unlight, and the middle one
      // is not a hazard to dodge — it is the floor, and there is no other
      { x: 26, y: 13, len: 3.4, arc: 1.0, period: 2.55, phase: 0 },
      { x: 39, y: 13, len: 3.4, arc: 1.0, period: 2.55, phase: 0.25 },
      { x: 52, y: 13, len: 3.4, arc: 1.0, period: 2.55, phase: 0.5 },
    ],
    shuttles: [
      // I: bolts on self-luminous rails, and the moth whose rim is the only
      // warm thing moving in the whole movement
      { x0: 14, y0: 6, x1: 30, y1: 6, period: 3.4, phase: 0 },
      { x0: 48, y0: 4, x1: 28, y1: 4, period: 3.4, phase: 0.5 },
      { x0: 12, y0: 7, x1: 44, y1: 3, period: 3.4, phase: 0.25, snuff: true },
      // IV: the last wire, run under the wave
      { x0: 6, y0: 43, x1: 22, y1: 43, period: 1.7, phase: 0.75 },
    ],
    crushers: [
      // III: climbed between cycles, both banks on the one pulse
      { x: 15, y: 21, w: 2, h: 2, dx: 0, dy: 3, period: 3.4, phase: 0 },
      { x: 34, y: 25, w: 2, h: 2, dx: 0, dy: 3, period: 3.4, phase: 0.5 },
      { x: 20, y: 29, w: 2, h: 2, dx: 0, dy: 3, period: 3.4, phase: 0.25 },
      { x: 47, y: 26, w: 2, h: 2, dx: 0, dy: -3, period: 3.4, phase: 0.75 },
    ],
    beams: [
      // watch-lights on both halves of the chimney, parked until it is entered
      { x: 5.5, y: 26.5, period: 4.25, phase: 0, spin: true, parked: true, arm: [1, 20, 56, 22] },
      { x: 52.5, y: 30.5, period: 4.25, phase: 0.5, spin: true, parked: true, arm: [1, 20, 56, 22] },
    ],
    gates: [
      // between the movements, so the exam never un-happens either
      { x0: 50, y0: 11, x1: 56, y1: 11 },
      { x0: 1, y0: 34, x1: 6, y1: 34 },
    ],
    currents: [
      { x0: 36, y0: 20, x1: 38, y1: 32, force: 46 },
    ],
    pursuit: {
      // IV: the dark, arriving, and its edge is how you read the floor
      zone: [1, 40, 56, 46],
      dir: 'right',
      speed: 3.1,
      trigger: [1, 40, 8, 45],
    },
    map: [
%s
    ],
  },
"""
body = ',\n'.join("      '" + r + "'" for r in rows)
out = defn % body

p = 'src/world/vaults.ts'
s = io.open(p, encoding='utf-8').read()
start = s.index('  // 9 · THE KINDLED')
end = s.index('];', start)
s = s[:start] + out + s[end:]
io.open(p, 'w', encoding='utf-8').write(s)
print('KINDLED written:', len(rows), 'rows x', W)
