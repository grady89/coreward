"""THE DEBT — the mirror, in open sky. 50 x 52.

One floating cell of inverted gravity, and the ledger read on both sides of
it. The normal approach crosses under a piston and a lantern; then the leap
UP into the cell, where down is up: you fall to the undersides of the
slabs and climb the mirror by jumping toward the world's floor. The cell
is CAPPED — a full stone lid, because a body that falls up with nothing
above it never comes back — and its own piston descends on the same period
as the approach's, opposite phase: both sides of the ledger paid.

The door is not a lock. Its price is one sconce lit under EACH gravity —
the entry's and the one hanging in the mirror — so the sum cannot be paid
without understanding both halves. It melts open at the end of the fall
OUT of the cell, with the stone behind it.

Open sky (openEdges): one plane under the normal-gravity route; the cell
needs none, its lid is the plane.
"""
import io

W, HGT = 50, 52
PULSE = 0.85

g = [['.'] * W for _ in range(HGT)]
LEFT, RIGHT = 2, W - 3

# The cell: every tile in here falls UP (slabs overwrite with stone). Its
# floor sits at row 32 — high enough that an ordinary jump on the approach
# below never grazes it — and the only way in is the THROAT: a narrow
# chute of inverted air hanging over the launch pad alone, so entering the
# mirror is a chosen leap, never an accident.
CELL = (24, 42, 8, 32)
THROAT = (33, 38, 33, 37)


def put(x, y, ch):
    g[y][x] = ch


def run(x0, x1, y, ch='#'):
    for x in range(x0, x1 + 1):
        put(x, y, ch)


def block(x0, x1, y0, y1, ch='#'):
    for y in range(y0, y1 + 1):
        run(x0, x1, y, ch)


# --- the inverted cell, filled first so stone can overwrite it -------------
cx0, cx1, cy0, cy1 = CELL
block(cx0, cx1, cy0, cy1, '^')
block(*THROAT, '^')
run(cx0 - 1, cx1 + 1, cy0 - 1)        # the LID: a full stone cap
# the mirror's slabs, walked on their UNDERSIDES, climbed by jumping down
run(31, 38, 24)
run(24, 28, 20)
put(26, 21, 'S')                      # the sconce hung in the mirror
run(31, 36, 16)
run(24, 29, 12)
# the mirror's piston: housed in the cell's east flank, biting west across
# the climb between the second and third slabs
block(41, 42, 20, 21)

# --- the normal approach, left to right under the cell ---------------------
run(3, 12, 40)
put(4, 39, '@')
put(7, 39, 'S')
run(16, 21, 40)
# the approach piston's housing, biting down over the pad
block(24, 25, 35, 36)
run(24, 29, 40)
put(32, 35, '#')                      # the lantern's mount stone
run(33, 38, 40)                       # the launch pad: jump UP into the cell

# --- the way out: off the lid's west edge, down the cell's flank. The
# collector pad catches the fall (and, for a climber who missed the mirror
# sconce, a step east off its edge re-enters the cell right beneath it)
run(16, 23, 30)
put(20, 29, 'F')                      # fallen: struck from the mirror's side
run(3, 12, 34)                        # the door's porch, hung over the entry
block(8, 8, 30, 33, '1')              # the door, priced one sconce per gravity
block(3, 3, 30, 33)                   # the stone's alcove wall
put(5, 33, 'M')
put(6, 33, 'N')                       # kneeling: the ledger closed

# --- one plane under the normal route --------------------------------------
for x in range(LEFT, RIGHT + 1):
    if g[48][x] == '.':
        put(x, 48, '_')

# --- motes: the leap into the mirror, and the fall out of it ---------------
for y in range(35, 40):
    for x in range(34, 38):
        if g[y][x] == '.':
            put(x, y, 'o')
for y in range(10, 28):
    if g[y][22] == '.':
        put(22, y, 'o')

CENSERS = [
    # the lantern over the approach's last gap, in the world's own down
    (32, 36, 2.8, 0.9, 3, 0.0),
]
CRUSHERS = [
    # the mirror's piston, biting west across the inverted climb...
    (41, 20, 2, 2, -4, 0, 4, 0.0),
    # ...and the approach's, biting down over the pad: same period,
    # opposite phase, both sides of the ledger paid
    (24, 37, 2, 1, 0, 2, 4, 0.5),
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

defn = """  // 7 · THE DEBT — the mirror, in open sky. One floating cell of inverted
  // gravity with a full stone lid, entered by a leap from the launch pad
  // beneath it: inside, you land on the UNDERSIDES of the slabs and climb
  // the mirror by jumping toward the world's floor. The pistons are one
  // system across the flip — same period, opposite phase — and the door's
  // price is one sconce lit under EACH gravity, so the sum cannot be paid
  // without understanding both halves. Out the cell's west flank, down its
  // own long fall, to the stone behind the melted door.
  {
    glyph: 'debt',
    chambers: [17, 35],
    openEdges: true,
    doorNeeds: { '1': 2 },
    censers: [
%s
    ],
    crushers: [
%s
    ],
    map: [
%s
    ],
  },
"""
body = ',\n'.join("      '" + r + "'" for r in rows)
out = defn % (censers, crushers, body)

p = 'src/world/vaults.ts'
s = io.open(p, encoding='utf-8').read()
start = s.index('  // 7 · THE DEBT')
end = s.index('  // 8 · THE RETURN')
io.open(p, 'w', encoding='utf-8').write(s[:start] + out + s[end:])

print(f'THE DEBT · {HGT} x {W}')
for i, r in enumerate(rows):
    print(f'{i:3d} {r}')
