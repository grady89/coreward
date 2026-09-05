"""THE WEATHER — the storm crossing, in open sky. 54 x 46.

An L walked in three storeys: across the surface INTO the wind, then down
out of it, storey by storey, until the stone stands in the first still air.
The wind blows LEFT against the whole crossing on the calm/gust clock, and
shelter is STONE — the two-course pillars on the surface, and then the
storeys themselves: each floor shades the one below it, so calm arrives
with depth because the architecture says so, not because a flag flips.

Its rime is the ONE-SHOT kind (rimeOnce): THE EMBER owns the cycle, where
a shelf returning is a rhythm you lean on; here it is the trap under the
trap light, bridging gaps exactly once. The eave pistons bite down on the
pulse the gust is counted in, the lantern swings IN the wind with its arc
skewed, and one parked watch-light wakes on the second storey.

Open sky (openEdges): unseen `_` planes under storeys one and two, holed
where the route legitimately drops; below the third, the void.
"""
import io

W, HGT = 54, 46
PULSE = 0.85

g = [['.'] * W for _ in range(HGT)]
LEFT, RIGHT = 2, W - 3
F = [10, 24, 36]


def put(x, y, ch):
    g[y][x] = ch


def run(x0, x1, y, ch='#'):
    for x in range(x0, x1 + 1):
        put(x, y, ch)


def block(x0, x1, y0, y1):
    for y in range(y0, y1 + 1):
        run(x0, x1, y)


# the legitimate drops: (x0, x1) holes in the plane below each storey
DROPS = [(47, 51), (6, 10)]

# --- storey 1: the surface, into the wind ----------------------------------
run(3, 10, F[0])
put(4, F[0] - 1, '@')
put(7, F[0] - 1, 'S')
block(10, 10, F[0] - 2, F[0] - 1)     # shelter: wait out the gust behind it
run(11, 13, F[0], 'R')                # one-shot ice over the first gap
run(14, 20, F[0])
block(20, 20, F[0] - 2, F[0] - 1)
run(21, 23, F[0], 'R')
run(24, 30, F[0])
put(17, F[0] - 1, 'S')
block(30, 30, F[0] - 2, F[0] - 1)
run(31, 34, F[0], 'R')
run(35, 41, F[0])
# the eave: a hanging housing whose piston bites down across the walk
block(33, 34, 3, 4)
run(46, 50, F[0])
put(44, 4, '#')                       # the skewed lantern's mount stone

# --- storey 2: back to the left, half in the surface's shadow --------------
run(44, 50, F[1])
run(40, 43, F[1], 'R')
run(33, 39, F[1])
put(35, F[1] - 1, 'S')
put(24, 17, '#')                      # the parked watch-light's mount
run(24, 30, F[1])
block(20, 21, 18, 19)                 # the second eave's hanging housing
run(20, 23, F[1], 'R')
run(12, 19, F[1])
put(16, 18, '#')                      # the low lantern's mount stone
run(6, 11, F[1])

# --- storey 3: the first still air ------------------------------------------
run(6, 12, F[2])
run(16, 21, F[2])
put(18, F[2] - 1, 'F')                # fallen: the storm struck from the left
run(25, 30, F[2])
run(34, 42, F[2])
put(38, F[2] - 1, 'M')
put(36, F[2] - 1, 'N')

# --- the planes, holed where the route drops -------------------------------
for f, (d0, d1) in zip(F[:2], DROPS):
    y = f + 8
    for x in range(LEFT, RIGHT + 1):
        if not (d0 <= x <= d1) and g[y][x] == '.':
            put(x, y, '_')

# --- motes: the gust's own line, and the drops -----------------------------
for x0, x1, y in ((11, 13, 7), (21, 23, 7), (31, 34, 7)):
    for x in range(x0, x1 + 1):
        if g[y][x] == '.':
            put(x, y, 'o')
for (d0, d1), f in zip(DROPS, F[:2]):
    for y in range(f + 1, f + 6):
        for x in range(d0, d1 + 1):
            if g[y][x] == '.':
                put(x, y, 'o')

CENSERS = [
    # the lantern IN the wind, its arc skewed by the gust it swings through
    (44, 5, 3.2, 1.0, 3, 0.0),
    # and the low lantern on the sheltered storey, met again out of the gust
    (16, 19, 3.0, 0.95, 3, 0.5),
]
CRUSHERS = [
    # the eaves' teeth, biting down on the pulse the gust is counted in
    (33, 5, 2, 1, 0, 4, 4, 0.0),
    (20, 20, 2, 1, 0, 3, 4, 0.5),
]
BEAMS = [
    # the watch-light on the second storey, parked until the drop arms it
    (24.5, 18.3, 5, 0.0),
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
beams = ',\n'.join(
    "      { x: %s, y: %s, period: %.2f, phase: %s, spin: true, parked: true,"
    " arm: [44, 21, 51, 23] }"
    % (x, y, n * PULSE, ph) for x, y, n, ph in BEAMS)

defn = """  // 6 · THE WEATHER — the storm crossing, in open sky. An L in three
  // storeys: across the surface INTO the wind behind two-course shelter
  // stones, then down out of it — and calm arrives with depth because each
  // storey shades the one below it, architecture saying what the glyph
  // says. The rime is the ONE-SHOT kind (THE EMBER owns the cycle): ice
  // bridges the surface gaps exactly once, under the eaves' falling teeth.
  // The lantern swings inside the gust with its arc skewed; a parked
  // watch-light wakes when the first drop is taken; and the stone stands
  // with the fallen in the first still air.
  {
    glyph: 'weather',
    chambers: [17, 35],
    openEdges: true,
    wind: { dir: -1, calm: 3.4, gust: 2.55, force: 30 },
    rimeOnce: true,
    censers: [
%s
    ],
    crushers: [
%s
    ],
    beams: [
%s
    ],
    map: [
%s
    ],
  },
"""
body = ',\n'.join("      '" + r + "'" for r in rows)
out = defn % (censers, crushers, beams, body)

p = 'src/world/vaults.ts'
s = io.open(p, encoding='utf-8').read()
start = s.index('  // 6 · THE WEATHER')
end = s.index('  // 7 · THE DEBT')
io.open(p, 'w', encoding='utf-8').write(s[:start] + out + s[end:])

print(f'THE WEATHER · {HGT} x {W}')
for i, r in enumerate(rows):
    print(f'{i:3d} {r}')
