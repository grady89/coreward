"""THE VAULT — the metronome, in open sky. 54 x 40.

A floating keep: a central plaza with three limbs, and every floor that
comes and goes runs on the one pulse. The doors are ARITHMETIC — two stone
grates in the keep's chimney, priced in lit sconces (cheap 2, dear 3) — and
the three sconces answer in any order, which is what Act II's generosity is
for: entry, the bridge limb, the lantern limb, then up the chimney.

  * LEFT LIMB — light bridges on the A/b clock, with a warden bolt laid
    along the run at ankle height. The floor and the light share one pulse.
  * RIGHT LIMB — a climbing stair of pads under a swinging lantern.
  * THE CHIMNEY — two floating towers over the plaza; the cheap grate melts
    you in at the bottom, the A/b steps ladder up between the towers, the
    dear grate melts you into the stone's box at the top.

Open sky (openEdges): one unseen `_` plane under everything — a fall from
any limb lands on the plaza or ends the run, and the plaza is the hub the
nonlinear room forgives toward.
"""
import io

W, HGT = 54, 40
PULSE = 0.85

g = [['.'] * W for _ in range(HGT)]
LEFT, RIGHT = 2, W - 3
PLAZA = 30


def put(x, y, ch):
    g[y][x] = ch


def run(x0, x1, y, ch='#'):
    for x in range(x0, x1 + 1):
        put(x, y, ch)


def block(x0, x1, y0, y1):
    for y in range(y0, y1 + 1):
        run(x0, x1, y)


# --- the plaza: the hub every limb leaves from and every fall forgives to --
run(18, 35, PLAZA)
put(20, PLAZA - 1, '@')
put(22, PLAZA - 1, 'S')

# --- left limb: the bridge run, warden bolt at ankle height ----------------
run(13, 16, PLAZA, 'b')
run(8, 11, PLAZA, 'A')
run(2, 6, PLAZA)
put(2, PLAZA - 1, 'S')
put(14, 26, '#')                     # the teaching lantern's mount, over the run

# --- right limb: the stair under the lantern -------------------------------
run(38, 41, 28)
run(44, 47, 26)
run(49, 52, 24)
put(42, 20, '#')                     # the second lantern's mount stone
# the stair turns BACK west above itself, so the climax chamber holds only
# what the room has already taught, and its sconce stands west of the cut
run(43, 46, 22)
run(37, 41, 20)
run(31, 35, 18)
put(33, 17, 'S')

# --- the chimney: two towers over the plaza, two priced doors, a ladder of
# half-time floors between them. The WEST tower stands on the plaza and its
# base is the cheap door: until two sconces burn, the keep's east half does
# not exist for you. The EAST tower floats two courses up, so the opened
# chimney is first CROSSED at ground level (under it) before it is climbed.
block(24, 24, 16, 27)                # west tower...
put(24, 28, '1')                     # ...standing on its own melting base
put(24, 29, '1')
block(29, 29, 16, 27)                # east tower, floating: pass beneath
run(25, 26, 28)                      # the ladder's first stone step
run(27, 28, 26, 'b')                 # then floors that are only there
run(25, 26, 24, 'A')                 # half the time, on the one pulse
run(27, 28, 22, 'b')
run(25, 26, 20, 'A')
run(27, 28, 18, 'b')
run(25, 28, 15, '2')                 # the DEAR grate: the box's floor
# the stone's box: rims beside the grate, walls, a roof
run(22, 24, 15)
run(29, 32, 15)
block(22, 22, 11, 14)
block(32, 32, 11, 14)
run(22, 32, 10)
put(31, 14, 'M')
put(30, 14, 'C')                     # curled by the stone, facing away

put(33, 21, '#')                     # anchor stone: the chimney warden's rail

# --- one plane under the whole keep ----------------------------------------
run(LEFT, RIGHT, 38, '_')

# --- motes: the bridge run's line, and the chimney's throat ----------------
for x in range(8, 17):
    if g[PLAZA - 3][x] == '.':
        put(x, PLAZA - 3, 'o')
for y in range(17, 27):
    for x in (25, 28):
        if g[y][x] == '.':
            put(x, y, 'o')

SHUTTLES = [
    # the warden on the bridge run: one course over the deck, jumped or waited
    (6, 29, 18, 29, 4, 0.0),
    # and the chimney's warden, walking a plumb wire beside the towers
    (33, 22, 33, 29, 2, 0.5),
]
CENSERS = [
    # the teaching lantern over the bridge run's end...
    (14, 27, 2.6, 0.9, 3, 0.0),
    # ...and its echo over the stair, timed crossing to crossing
    (42, 21, 3.0, 0.95, 3, 0.25),
]

rows = [''.join(r) for r in g]
for i, r in enumerate(rows):
    assert len(r) == W, f'row {i} is {len(r)}'

shuttles = ',\n'.join(
    "      { x0: %d, y0: %d, x1: %d, y1: %d, period: %.2f, phase: %s }"
    % (a, b, c, d, n * PULSE, ph) for a, b, c, d, n, ph in SHUTTLES)
censers = ',\n'.join(
    "      { x: %d, y: %d, len: %.1f, arc: %.2f, period: %.2f, phase: %s }"
    % (x, y, ln, arc, n * PULSE, ph) for x, y, ln, arc, n, ph in CENSERS)

defn = """  // 4 · THE VAULT — the metronome, in open sky. A floating keep: a plaza,
  // two towers, and every floor that comes and goes runs on the one pulse.
  // The doors are arithmetic — the west tower's melting base at two lit
  // sconces, the dear grate under the stone's box at three — so the keep is
  // read left to right: the bridge limb pays for the chimney, the lantern
  // limb pays for the box, and the chimney is CROSSED at ground level
  // before it is climbed on its half-time floors. A fall from any limb
  // lands back on the plaza or on the unseen plane below it: the hub
  // forgives, the price does not drop.
  {
    glyph: 'vault',
    chambers: [17, 35],
    openEdges: true,
    doorNeeds: { '1': 2, '2': 3 },
    shuttles: [
%s
    ],
    censers: [
%s
    ],
    map: [
%s
    ],
  },
"""
body = ',\n'.join("      '" + r + "'" for r in rows)
out = defn % (shuttles, censers, body)

p = 'src/world/vaults.ts'
s = io.open(p, encoding='utf-8').read()
start = s.index('  // 4 · THE VAULT')
end = s.index('  // 5 · THE EMBER')
io.open(p, 'w', encoding='utf-8').write(s[:start] + out + s[end:])

print(f'THE VAULT · {HGT} x {W}')
for i, r in enumerate(rows):
    print(f'{i:3d} {r}')
