"""THE KINDLED — the exam, in the dark (2026-11-20). 66 x 50.

The last of the nine. A boustrophedon that CLIMBS: four floors snaked
right, up, left, up, right, every one of them dark except the exhale, and
nothing on any of them the player has not met before. Three sconces for the
whole of it — the entry is the fourth checkpoint, so each movement opens on
a light and the last one has none. With the spark spent you are a
silhouette (the meter is the visibility); the room's own lights — the moth's
veins, the bolts, the lanterns' glass, the unlight, the vents' motes, and at
the end the wave itself — are what find the geometry.

  I    THE LAMPLIGHT FLOOR (bottom, rightward)
   1  the moth over the spark gap: a seven-tile gap, a snuffer patrolling
      the arc. Spark early and it has nothing to steal; spark late only
      when it has drifted off (THE FAMINE's moth, THE WICK's spark gap)
   2  the half-time floors under the plumb bolts: onto A, across to b at
      the swap, off b when its bolt is low (THE VAULT's ladder and lasers)
   3  the dark wall: a single wall kicked up and steered back to, onto the
      perch and the FIRST LIGHT (THE VAULT's slab, THE LAST SHIFT's climbs)
  II   THE LANTERN GALLERY (the hall, right side, upward)
   4  from the perch's end onto the first lantern's crown at the slow end
      of its swing (THE VAULT's lamp)
   5  crown to crown: two lanterns swinging against each other, the second
      hung a little lower; the transfer is at the apex (THE RETURN's mount)
   6  off the second crown onto the ledge over the vent's mouth
   7  into the vent when the burning lantern at its head has swung clear,
      out left onto the middle floor (THE WEATHER's updraft, THE LAST
      SHIFT's censer coda)
  III  THE MIDDLE FLOOR AND THE CHIMNEY (leftward, then up)
      the SECOND LIGHT, where the vent lets you off
   8  rime over unlight under two pistons a half-cycle apart: you cannot
      wait on rime, so you leave the stone on the pistons' word (THE
      EMBER's rime, THE DEBT's pistons)
   9  the inverted span: jump up into a seam of up-gravity, land on the
      ceiling, hop its two fangs toward the world's floor, drop out of the
      far end (THE DEBT's mirror, in miniature)
  10  the piston chimney: a two-wall shaft kicked up past a piston from the
      west wall into a niche, the chimney's one breath ...
  11  ... and on past a piston from the east wall, up through a one-way
      curtain onto the exhale (THE EMBER's gate)
  IV   THE DARK, ARRIVING (top, rightward)
      the exhale: the one lit floor in the room, the THIRD LIGHT, a man
      kneeling where his shift ended. Walk off it and the wave wakes behind
      you; its burning edge is the light you cross the last floor by
  12  one half-time floor, a stone step, a bolt along the floor to hop
  13  a vent, and a lantern across its head
  14  a shelf, off its end as the last piston begins its stroke, rime, and
      under the piston as it lifts
  15  a wall kicked up onto the dais. The wave breaks at its foot; the four
      who stayed are on it with the stone — reaching, kneeling, fallen,
      curled away — and the stone is taken on foot among them

Every hazard reaching into the dark is self-luminous (P2); every rail post
stands on stone; nothing of the last chamber (cols 44-65) is new to it — its
lanterns, vent, rime and piston all appear west of the cut too (P4) — and it
holds no light. The fourth room-wide clock is the wave, and it only runs on
the last floor.

Wind is the one taught noun left out. It is a room-wide weather in this
kit, and a storm under the masonry of a sealed vault would be a lie about
the place; the vents are the air that moves here.

Built the way THE WICK is built (openEdges): open sky, unlight under every
floor (`X`), no invisible plane. Chambers cut at 21 and 43; the camera
follows vertically, so each floor reads as its own gallery.
"""
import io

W, HGT = 66, 50
PULSE = 0.85

g = [['.'] * W for _ in range(HGT)]


def put(x, y, ch):
    assert 0 <= x < W and 0 <= y < HGT, (x, y, ch)
    g[y][x] = ch


def run(x0, x1, y, ch='#'):
    for x in range(x0, x1 + 1):
        put(x, y, ch)


def block(x0, x1, y0, y1, ch='#'):
    for y in range(y0, y1 + 1):
        run(x0, x1, y, ch)


SHUTTLES = []   # (x0, y0, x1, y1, pulses, phase, snuff)
CENSERS = []    # (x, y, len, arc, pulses, phase)
CRUSHERS = []   # (x, y, w, h, dx, dy, pulses, phase)
GATES = []      # (x0, y0, x1, y1, dir)
CURRENTS = []   # (x0, y0, x1, y1, force)

# ---------------- I · the lamplight floor (bottom, rightward) -------------
F1 = 47
run(1, 9, F1)
put(3, F1 - 1, '@')
run(10, 63, 49, 'X')                       # the unlight under I and II
SHUTTLES.append((12, 45, 12, 40, 3, 0.0, True))   # the moth over the spark gap
run(17, 20, F1)
run(20, 32, 40)                            # the ceiling the plumb bolts hang from
SHUTTLES.append((21, 41, 21, 46, 2, 0.0, False))
run(23, 25, F1 - 1, 'A')
SHUTTLES.append((26, 41, 26, 46, 2, 0.5, False))
run(28, 30, F1 - 2, 'b')
SHUTTLES.append((31, 41, 31, 46, 2, 0.0, False))
run(33, 35, F1 - 3)
block(36, 43, 38, F1)                      # the dark wall, and the perch on top
put(37, 37, 'S')                           # S1

# ---------------- II · the lantern gallery (C3, the hall) -----------------
MF = 30
block(64, 65, 25, 48)                      # the hall's east wall
run(62, 63, 25)                            # the vent's hood
run(58, 63, 38)                            # the east ledge, over the vent's mouth
CENSERS.append((47.5, 31, 9.0, 0.29, 3, 0.0))    # L2a, ridden
CENSERS.append((54, 31, 9.6, 0.29, 3, 0.5))    # L2b, ridden, against it, a little lower
CENSERS.append((60, 26, 2.5, 1.0, 3, 0.5))       # L3, burning, across the vent's head
CURRENTS.append((62, 26, 63, 37, 46))            # the vent up to the middle floor

# ---------------- III · the middle floor (leftward), the chimney ---------
run(36, 61, MF)
run(51, 52, MF, 'd')                       # III.0 the way back west: a gap over the hall
SHUTTLES.append((45, 28, 49, 28, 2, 0.5, False))  # and a bolt along the floor
put(40, MF - 1, 'S')                       # S2
run(6, 61, 25)                             # the band's ceiling
run(28, 35, MF, 'R')
run(28, 35, 33, 'X')
CRUSHERS.append((29, 26, 2, 1, 0, 2, 4, 0.0))
CRUSHERS.append((33, 26, 2, 1, 0, 2, 4, 0.5))
run(26, 27, MF)
run(16, 25, 33, 'X')                       # the pit under the inverted span
run(2, 15, MF)
# the chimney
block(2, 2, 14, 29)
block(5, 5, 15, 27)
CRUSHERS.append((1, 23, 2, 2, 2, 0, 4, 0.0))
CRUSHERS.append((5, 18, 2, 2, -2, 0, 4, 0.75))
GATES.append((3, 15, 4, 15, 'up'))
block(6, 63, 18, 24)                       # masonry between the bands
# the inverted span: the ceiling lifted to 20, gravity up beneath it
for y in range(20, 26):
    run(14, 27, y, '.')
run(14, 27, 20)
for y in range(21, 27):
    for x in range(16, 26):
        put(x, y, '^')
put(19, 21, 'X')
put(23, 21, 'X')

# the niche between the pistons: the chimney's one breath
run(5, 6, 21, 'd')
run(5, 6, 22, 'd')

# ---------------- the exhale, and IV · the dark arriving ----------------
TF = 14
run(5, 20, TF)
put(11, TF - 1, 'S')                       # S3
put(8, TF - 1, 'N')
run(21, 63, 16, 'X')                       # the unlight under IV
run(22, 24, TF, 'A')                       # IV.1 the half-time floors
run(26, 28, TF)                            # a stone step between the floors
run(30, 34, TF)                            # IV.2 the bolt along the floor
SHUTTLES.append((30, 12, 34, 12, 2, 0.0, False))
run(35, 36, 4)                             # IV.3 the vent's hood
CURRENTS.append((35, 5, 36, 15, 46))
CENSERS.append((35.5, 5, 3.0, 1.0, 3, 0.0))     # IV.4 the lantern across the vent
run(37, 43, 11)                            # the raised shelf
run(45, 50, TF, 'R')                       # IV.5 rime into the last piston
run(51, 56, TF)
block(52, 53, 8, 9)
CRUSHERS.append((52, 10, 2, 1, 0, 3, 4, 0.0))
block(57, 63, 9, TF)                       # the dais
put(61, 8, 'M')
put(58, 8, 'K')
put(59, 8, 'N')
put(62, 8, 'F')
put(63, 8, 'C')

# figures as signage through the run
put(8, F1 - 1, 'F')
put(19, F1 - 1, 'K')
put(38, MF - 1, 'F')
put(13, MF - 1, 'N')

# ---------------- motes: the arcs and drops the dark would hide -----------
for x, y in ((11, 43), (13, 42), (15, 43),          # the spark arc over the moth
             (44, 38), (45, 37),                    # where the first crown comes in
             (14, 22), (15, 24), (14, 26), (15, 28),  # the drop out of the span
             (3, 27), (4, 25),                      # the chimney's foot
             (44, 12), (44, 13)):                   # the shelf's end, over the rime
    if g[y][x] == '.':
        put(x, y, 'o')

# ---------------- the dark: everything but the exhale ---------------------
for y in range(1, HGT - 1):
    for x in range(1, W - 1):
        if 5 <= x <= 20 and 3 <= y <= 13:
            continue
        if g[y][x] == '.':
            put(x, y, 'd')

rows = [''.join(r) for r in g]
for i, r in enumerate(rows):
    assert len(r) == W, f'row {i} is {len(r)}'


def fnum(v):
    return ('%.4f' % v).rstrip('0').rstrip('.')


shuttles = ',\n'.join(
    "      { x0: %d, y0: %d, x1: %d, y1: %d, period: %.2f, phase: %s%s }"
    % (a, b, c, d, n * PULSE, fnum(ph), ', snuff: true' if sn else '')
    for a, b, c, d, n, ph, sn in SHUTTLES)
censers = ',\n'.join(
    "      { x: %s, y: %s, len: %.1f, arc: %.2f, period: %.2f, phase: %s }"
    % (fnum(x), fnum(y), ln, arc, n * PULSE, fnum(ph)) for x, y, ln, arc, n, ph in CENSERS)
crushers = ',\n'.join(
    "      { x: %d, y: %d, w: %d, h: %d, dx: %d, dy: %d, period: %.2f, phase: %s }"
    % (x, y, w, h, dx, dy, n * PULSE, fnum(ph)) for x, y, w, h, dx, dy, n, ph in CRUSHERS)
gates = ',\n'.join(
    "      { x0: %d, y0: %d, x1: %d, y1: %d%s }"
    % (a, b, c, d, ", dir: '%s'" % dr if dr != 'down' else '') for a, b, c, d, dr in GATES)
currents = ',\n'.join(
    "      { x0: %d, y0: %d, x1: %d, y1: %d, force: %d }" % cu for cu in CURRENTS)

PURSUIT = """    pursuit: {
      zone: [5, 2, 55, 17],
      dir: 'right',
      speed: 3.2,
      trigger: [17, 6, 20, 13],
    },"""

defn = """  // 9 · THE KINDLED — the exam, in the dark. A boustrophedon that climbs:
  // the lamplight floor right (a moth over the spark gap, half-time floors
  // under plumb bolts, a dark wall to the first light); the lantern gallery
  // up the hall (crown to crown, then a vent past a burning lantern); the
  // middle floor left (rime under pistons, an inverted span, a piston
  // chimney with one niche, a curtain); and the exhale, the one lit floor,
  // where the dark wakes behind you and chases you right across everything
  // in miniature to the dais and the four who stayed. Three lights.
  {
    glyph: 'kindled',
    chambers: [21, 43],
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
    gates: [
%s
    ],
    currents: [
%s
    ],
%s
    map: [
%s
    ],
  },
"""
body = ',\n'.join("      '" + r + "'" for r in rows)
out = defn % (shuttles, censers, crushers, gates, currents, PURSUIT, body)

p = 'src/world/vaults.ts'
s = io.open(p, encoding='utf-8').read()
start = s.index('  // 9 · THE KINDLED')
end = s.index('];', start)
io.open(p, 'w', encoding='utf-8').write(s[:start] + out + s[end:])

print(f'THE KINDLED · {HGT} x {W}')
print('    ' + ''.join(str(x // 10) for x in range(W)))
print('    ' + ''.join(str(x % 10) for x in range(W)))
for i, r in enumerate(rows):
    print(f'{i:3d} {r}')
