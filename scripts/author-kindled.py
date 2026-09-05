"""THE KINDLED — the exam, in open sky and in the dark. 56 x 50.

Four movements, nothing introduced, everything recombined, three sconces
for the whole of it — scarcity is the difficulty at this register, and
with the breath spent you are a silhouette over the void.

  I    the dark traverse: floating pads under a warden bolt, with the moth
       hunting the light you carry. A gate closes the drop behind you.
  II   the gallery: three lanterns over nothing, quarter-pulse apart, and
       the middle one is not a hazard — it is the floor.
  III  the one lit passage: pistons biting into both gap jumps, a parked
       watch-light waking as you land, and the vent's wind out the far side.
  IV   the dark, arriving: the wave at your heels leftward across rime and
       fangs, past the ones who stayed, to the stone.

Open sky (openEdges): planes between the movements, holed where the two
gated drops pass; below the last floor, the void.
"""
import io

W, HGT = 56, 50
PULSE = 0.85

g = [['.'] * W for _ in range(HGT)]
LEFT, RIGHT = 2, W - 3


def put(x, y, ch):
    g[y][x] = ch


def run(x0, x1, y, ch='#'):
    for x in range(x0, x1 + 1):
        put(x, y, ch)


def block(x0, x1, y0, y1, ch='#'):
    for y in range(y0, y1 + 1):
        run(x0, x1, y, ch)


# --- I: the dark traverse --------------------------------------------------
run(3, 10, 8)
put(4, 7, '@')
put(7, 7, 'S')
run(14, 19, 8)
run(23, 28, 8)
run(32, 37, 8)
run(41, 46, 8)

# --- II: the gallery — the middle lantern is the floor ---------------------
run(46, 52, 20)
put(40, 16, '#')                      # the three lanterns' mounts
put(33, 16, '#')
put(26, 16, '#')
run(14, 20, 20)
put(17, 19, 'S')                      # the breath BEFORE the drop, not after

# --- III: the lit passage, out and BACK — east under the pistons, up the
# vent, and west again along the high shelf to the gated drop ---------------
run(8, 14, 30)
block(16, 17, 26, 27)                 # piston housing, biting down the gap
run(18, 23, 32)
block(26, 27, 37, 38)                 # and one biting UP through the next
run(27, 32, 34)
run(27, 37, 25)                       # the lid over the vent's crest, and the
put(30, 24, 'S')                      # roof the sconce breathes on
run(20, 25, 27)                       # the way back west, high
run(12, 17, 29)
run(3, 8, 31)                         # the last shelf before the gated drop

# --- IV: the dark, arriving — behind you now, chasing you EAST -------------
run(3, 11, 44)
put(5, 43, 'N')                       # kneeling, lamp set down at the brink
run(13, 16, 44, 'R')
run(18, 23, 44)
put(20, 43, 'F')                      # fallen, lamp still raised
run(25, 30, 44)
put(26, 43, 'X')
put(28, 43, 'K')                      # reaching — the stone is that way
run(32, 37, 44)                       # stone under the vent's long throat
put(34, 43, 'C')                      # curled away from what is coming
put(33, 40, '#')                      # the last breath, hung from its stone
put(33, 41, '*')
run(39, 42, 44, 'R')
run(44, 47, 44)
put(45, 43, 'F')
run(49, 52, 44)
put(51, 43, 'M')
run(34, 36, 36)                       # the lip that seats the vent's fall

# --- the planes between movements, holed at the gated drops ----------------
for x in range(LEFT, RIGHT + 1):
    if not (48 <= x <= 51) and g[14][x] == '.':
        put(x, 14, '_')
for x in range(21, 44 + 1):
    if (x <= 24 or x >= 40) and g[25][x] == '.':
        put(x, 25, '_')
for x in range(13, RIGHT + 1):
    if g[36][x] == '.':
        put(x, 36, '_')

# --- motes: the traverse's gaps, and both gated drops ----------------------
for x0, x1 in ((11, 13), (20, 22), (29, 31), (38, 40)):
    for x in range(x0, x1 + 1):
        if g[6][x] == '.':
            put(x, 6, 'o')
for y0, y1, x0, x1 in ((10, 16, 48, 51), (32, 42, 7, 10)):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if g[y][x] == '.':
                put(x, y, 'o')

# --- the dark: movements I, II and IV; III is the one lit breath -----------
for y0, y1 in ((2, 13), (15, 24), (38, 45)):
    for y in range(y0, y1 + 1):
        for x in range(1, W - 1):
            if g[y][x] == '.':
                put(x, y, 'd')

SHUTTLES = [
    (16, 6, 44, 6, 4, 0.0, False),
    (10, 4, 45, 7, 4, 0.25, True),
]
CENSERS = [
    (40, 17, 3.4, 1.0, 3, 0.0),
    (33, 17, 3.4, 1.0, 3, 0.25),
    (26, 17, 3.4, 1.0, 3, 0.5),
]
CRUSHERS = [
    (16, 28, 2, 1, 0, 3, 4, 0.0),
    (26, 36, 2, 1, 0, -3, 4, 0.5),
]
BEAMS = [
    # hung under the high shelf at 18-23, sweeping the passage below
    (20.5, 33.3, 5, 0.0),
]

rows = [''.join(r) for r in g]
for i, r in enumerate(rows):
    assert len(r) == W, f'row {i} is {len(r)}'

shuttles = ',\n'.join(
    "      { x0: %d, y0: %d, x1: %d, y1: %d, period: %.2f, phase: %s%s }"
    % (a, b, c, d, n * PULSE, ph, ', snuff: true' if sn else '')
    for a, b, c, d, n, ph, sn in SHUTTLES)
censers = ',\n'.join(
    "      { x: %d, y: %d, len: %.1f, arc: %.2f, period: %.2f, phase: %s }"
    % (x, y, ln, arc, n * PULSE, ph) for x, y, ln, arc, n, ph in CENSERS)
crushers = ',\n'.join(
    "      { x: %d, y: %d, w: %d, h: %d, dx: %d, dy: %d, period: %.2f, phase: %s }"
    % (x, y, w, h, dx, dy, n * PULSE, ph) for x, y, w, h, dx, dy, n, ph in CRUSHERS)
beams = ',\n'.join(
    "      { x: %s, y: %s, period: %.2f, phase: %s, spin: true, parked: true,"
    " arm: [8, 27, 14, 29] }"
    % (x, y, n * PULSE, ph) for x, y, n, ph in BEAMS)

defn = """  // 9 · THE KINDLED — the exam, in open sky and in the dark. Four
  // movements over the void, three sconces for the whole of it, and
  // nothing introduced: the dark traverse under the warden and the moth, a
  // gate; the gallery whose middle lantern IS the floor; the one lit
  // passage where the pistons bite both jumps and a watch-light wakes as
  // you land, the vent out; a gate, and then the dark arriving at your
  // heels — leftward over rime and fangs, past everyone who stayed, to
  // the stone.
  {
    glyph: 'kindled',
    chambers: [19, 38],
    openEdges: true,
    shuttles: [
%s
    ],
    censers: [
%s
    ],
    crushers: [
%s
    ],
    beams: [
%s
    ],
    gates: [
      // between the movements, so the exam never un-happens
      { x0: 48, y0: 10, x1: 51, y1: 10 },
      { x0: 7, y0: 34, x1: 10, y1: 34 },
    ],
    currents: [
      { x0: 34, y0: 27, x1: 36, y1: 33, force: 46 },
    ],
    pursuit: {
      // IV: the dark, arriving, and its edge is how you read the floor
      zone: [3, 38, 47, 45],
      dir: 'right',
      speed: 3.1,
      trigger: [3, 38, 10, 45],
    },
    map: [
%s
    ],
  },
"""
body = ',\n'.join("      '" + r + "'" for r in rows)
out = defn % (shuttles, censers, crushers, beams, body)

p = 'src/world/vaults.ts'
s = io.open(p, encoding='utf-8').read()
start = s.index('  // 9 · THE KINDLED')
end = s.index('];', start)
io.open(p, 'w', encoding='utf-8').write(s[:start] + out + s[end:])

print(f'THE KINDLED · {HGT} x {W}')
for i, r in enumerate(rows):
    print(f'{i:3d} {r}')
