"""THE RETURN — the U, in open sky. 50 x 44.

Down the left limb dodging lanterns with the moth awake to your light;
through the one-way curtain into the corridor that IS sideways-down — a
band of right-gravity where the far wall is the floor, and the ones who
stayed are standing on it with the sconce you cannot pass without lighting;
then out on the vent's updraft, and the last reach is RIDDEN: the lantern
you spent the room dodging is the only thing between the wind's crest and
the door. Three sconces, and the door's price is all three.

Open sky (openEdges): the corridor's wall caps its own gravity, a small
plane sits under the left landing, and everything else that falls, falls
out of the world.
"""
import io

W, HGT = 50, 44
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


# --- the descent: dodged lanterns, and the moth ----------------------------
run(3, 12, 6)
put(4, 5, '@')
put(7, 5, 'S')
put(17, 5, '#')                       # dodge-lantern one's mount
run(15, 19, 10)
put(11, 9, '#')                       # dodge-lantern two's mount
run(9, 13, 14)
run(15, 19, 18)
run(5, 12, 22)                        # the landing before the commitment
put(8, 21, 'S')

# --- the corridor: sideways-down, walled by its own floor ------------------
block(10, 38, 26, 31, '>')
block(39, 39, 24, 33)                 # the wall that is the ground
block(20, 20, 27, 31)                 # fins: stone the sweep sets you against
block(28, 28, 26, 30)
put(27, 28, 'S')                      # the cameo: you stand with them, or wait
put(27, 26, 'C')                      # curled away: not further down
put(27, 30, 'F')                      # fallen, lamp still raised

# --- the way out: wall-jump to the top of the ground itself, step into the
# vent east of it, and the last reach is RIDDEN back west to the door ------
put(40, 5, '#')                       # the RIDDEN lantern's mount
run(27, 38, 10)                       # the high shelf before the door
block(32, 32, 6, 9, '1')              # the door: priced at all three
put(29, 9, 'M')
put(30, 9, 'K')                       # reaching: it was always this close

# --- a plane under the landing's own fall line (the rescue vent's lane
# --- at the far left stays open — a kill tile inside a wind is a lie) ------
for x in range(5, 9 + 1):
    if g[30][x] == '.':
        put(x, 30, '_')

# --- motes: the drop into the corridor, the wall-top exit, the vent --------
for y in range(23, 26):
    for x in range(13, 17):
        if g[y][x] == '.':
            put(x, y, 'o')
for xy in ((38, 25), (38, 24), (39, 23), (40, 22), (41, 21)):
    if g[xy[1]][xy[0]] == '.':
        put(xy[0], xy[1], 'o')
for y in range(10, 22):
    for x in (42, 43):
        if g[y][x] == '.':
            put(x, y, 'o')

CENSERS = [
    # dodged on the way down...
    (17, 6, 3.0, 0.95, 3, 0.0),
    (11, 10, 2.5, 0.9, 3, 0.5),
    # ...and RIDDEN at the top of the vent, because nothing else is there
    (40, 6, 3.0, 0.95, 3, 0.25),
]
SHUTTLES = [
    # the moth on the descent, awake to the light you are carrying
    (4, 12, 18, 20, 4, 0.0, True),
]

rows = [''.join(r) for r in g]
for i, r in enumerate(rows):
    assert len(r) == W, f'row {i} is {len(r)}'

censers = ',\n'.join(
    "      { x: %d, y: %d, len: %.1f, arc: %.2f, period: %.2f, phase: %s }"
    % (x, y, ln, arc, n * PULSE, ph) for x, y, ln, arc, n, ph in CENSERS)
shuttles = ',\n'.join(
    "      { x0: %d, y0: %d, x1: %d, y1: %d, period: %.2f, phase: %s%s }"
    % (a, b, c, d, n * PULSE, ph, ', snuff: true' if sn else '')
    for a, b, c, d, n, ph, sn in SHUTTLES)

defn = """  // 8 · THE RETURN — the U, in open sky. Down the left limb through the
  // dodged lanterns and the moth; through the one-way curtain into the
  // corridor that IS sideways-down, where the far wall is the ground and
  // the ones who stayed hold the sconce you cannot pass without lighting;
  // out on the vent's updraft — and the last reach is RIDDEN, the lantern
  // you spent the room dodging now the only footing between the wind's
  // crest and the door. The door's price is all three lights: the U does
  // not un-happen, and neither does anyone walked past.
  {
    glyph: 'return',
    chambers: [17, 35],
    openEdges: true,
    doorNeeds: { '1': 3 },
    censers: [
%s
    ],
    shuttles: [
%s
    ],
    gates: [
      // the drop into the corridor: down through it, never back up
      { x0: 13, y0: 24, x1: 16, y1: 24 },
    ],
    currents: [
      // a soft vent off the descent's west edge — the carry taught early,
      // and a second chance for a fall that was almost caught
      { x0: 2, y0: 8, x1: 4, y1: 20, force: 46 },
      // and the vent past the corridor's ground: wall-jump to the top of
      // the world you walked on, step east, and be carried
      { x0: 41, y0: 8, x1: 44, y1: 22, force: 46 },
    ],
    map: [
%s
    ],
  },
"""
body = ',\n'.join("      '" + r + "'" for r in rows)
out = defn % (censers, shuttles, body)

p = 'src/world/vaults.ts'
s = io.open(p, encoding='utf-8').read()
start = s.index('  // 8 · THE RETURN')
end = s.index('  // 9 · THE KINDLED')
io.open(p, 'w', encoding='utf-8').write(s[:start] + out + s[end:])

print(f'THE RETURN · {HGT} x {W}')
for i, r in enumerate(rows):
    print(f'{i:3d} {r}')
