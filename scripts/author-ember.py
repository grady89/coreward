"""THE EMBER — commitment, in open sky. 40 x 62.

The deepest drop in the game, rebuilt as a floating descent. The top is
rime alone — crumble-and-regrow taught as a cadence over the void. Then the
one-way gate, which is architecture saying what committing means. Then the
trigger band, and the wave: the dark pouring DOWN the descent behind you
while shelves crumble, a lantern swings, a piston cycles, and the moth
hunts the light you are carrying. Two braziers are the only refills; one
pocket sconce is the only breath.

The bottom punishes the solver who simply falls: the landing is offset
LEFT, and everything under the drop line is a spiked shelf. You descend the
route or you land on the fangs.

Open sky (openEdges): no planes at all — the room IS the fall, the sides
are the void, and the floor of the world is the landing or the spikes.
"""
import io

W, HGT = 40, 62
PULSE = 0.85

g = [['.'] * W for _ in range(HGT)]
LEFT, RIGHT = 2, W - 3


def put(x, y, ch):
    g[y][x] = ch


def run(x0, x1, y, ch='#'):
    for x in range(x0, x1 + 1):
        put(x, y, ch)


def block(x0, x1, y0, y1):
    for y in range(y0, y1 + 1):
        run(x0, x1, y)


# --- entry, and the rime cadence: the shelf comes back, lean on it ---------
run(4, 12, 6)
put(6, 5, '@')
put(9, 5, 'S')
run(15, 19, 9, 'R')
run(23, 27, 11)
put(23, 10, 'X')                    # the first fang, met where it is cheap
run(16, 20, 13, 'R')
run(8, 12, 15, 'R')

# --- the gate shelf: the last stone before the room commits ----------------
run(16, 21, 17)
put(18, 16, 'S')

# --- the descent: everything at once, with the wave behind it. Every hop
# --- drops two to five courses and crosses at most six tiles ---------------
run(6, 10, 22)
put(10, 21, 'X')
run(13, 17, 25, 'R')
put(16, 20, '#')                    # the lantern's mount stone, over the ice
run(23, 28, 28)
# the piston's housing, hung over the gap, biting east across the arrival
block(18, 19, 25, 26)
run(33, 37, 31, 'R')
run(25, 30, 34)
put(25, 33, 'X')
put(21, 31, '#')                    # a breath of ember, hung mid-fall...
put(21, 32, '*')                    # ...from its own stone
run(14, 19, 37, 'R')
run(6, 11, 40)
put(11, 39, 'X')
run(16, 21, 43)                     # the pocket: the one breath down here
put(18, 42, 'S')
put(12, 43, '#')                    # the second breath, west of the pocket
put(12, 44, '*')
run(25, 30, 46, 'R')
run(33, 37, 49)
run(26, 31, 52, 'R')
run(17, 22, 55)                     # the last stone, set right over the fangs

# --- the bottom: the landing is EARNED leftward; the fall line is fanged ---
run(3, 14, 57)
put(7, 56, 'M')
put(10, 56, 'N')                    # kneeling: the shift ended here too
run(16, 36, 57)
run(16, 36, 56, 'X')

# --- motes: the cadence line and the pocket's edge -------------------------
for x0, x1, y in ((14, 20, 7), (7, 13, 13), (19, 24, 26), (12, 16, 53)):
    for x in range(x0, x1 + 1):
        if g[y][x] == '.':
            put(x, y, 'o')

CENSERS = [
    # the lantern over the second ice shelf, dodged with the wave coming
    (16, 21, 2.6, 0.95, 3, 0.0),
]
CRUSHERS = [
    # out of the housing, east across the arrival jump — the entry beat,
    # opposite the lantern's phase
    (18, 27, 2, 1, 4, 0, 4, 0.5),
]
SHUTTLES = [
    # the moth, asleep across the lower descent until the light wakes it
    (8, 44, 24, 47, 4, 0.0, True),
]

rows = [''.join(r) for r in g]
for i, r in enumerate(rows):
    assert len(r) == W, f'row {i} is {len(r)}'

censers = ',\n'.join(
    "      { x: %d, y: %d, len: %.1f, arc: %.2f, period: %.2f, phase: %s }"
    % (x, y, ln, arc, n * PULSE, ph) for x, y, ln, arc, n, ph in CENSERS)
crushers = ',\n'.join(
    "      { x: %d, y: %d, w: %d, h: %d, dx: %d, dy: %d, period: %.2f, phase: %s }"
    % (x, y, w, h, dx, dy, n * PULSE, ph) for x, y, w, h, dx, dy, n, ph in CRUSHERS)
shuttles = ',\n'.join(
    "      { x0: %d, y0: %d, x1: %d, y1: %d, period: %.2f, phase: %s%s }"
    % (a, b, c, d, n * PULSE, ph, ', snuff: true' if sn else '')
    for a, b, c, d, n, ph, sn in SHUTTLES)

defn = """  // 5 · THE EMBER — commitment, in open sky. The deepest drop in the game:
  // a floating descent with the rime cadence taught over the void, then the
  // one-way gate, then the wave pouring down behind you while the shelves
  // crumble, the lantern swings, the piston bites and the moth hunts. Two
  // braziers, one pocket breath. The bottom is the thesis sharpened: the
  // landing sits LEFT of the fall line, and the fall line is fanged — you
  // descend the route, or you land on what the dark left there.
  {
    glyph: 'ember',
    chambers: [19],
    openEdges: true,
    censers: [
%s
    ],
    crushers: [
%s
    ],
    shuttles: [
%s
    ],
    gates: [
      // the curtain across the descent: down through it, never back up
      { x0: 4, y0: 18, x1: 35, y1: 18 },
    ],
    pursuit: {
      // the dark, poured: armed one breath below the gate, and its zone
      // ends a course above the landing so the stone is stood at in calm
      zone: [4, 19, 35, 53],
      dir: 'down',
      speed: 2.9,
      trigger: [4, 19, 35, 21],
    },
    map: [
%s
    ],
  },
"""
body = ',\n'.join("      '" + r + "'" for r in rows)
out = defn % (censers, crushers, shuttles, body)

p = 'src/world/vaults.ts'
s = io.open(p, encoding='utf-8').read()
start = s.index('  // 5 · THE EMBER')
end = s.index('  // 6 · THE WEATHER')
io.open(p, 'w', encoding='utf-8').write(s[:start] + out + s[end:])

print(f'THE EMBER · {HGT} x {W}')
for i, r in enumerate(rows):
    print(f'{i:3d} {r}')
