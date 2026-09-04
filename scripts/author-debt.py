"""THE DEBT — V4 authoring. 54 x 30, a mirrored diptych sharing a wall.

Rotated gravity taught honestly, and the mirrored crushers are one system
with it: the same period, opposite phase, both sides of the ledger paid. The
door is not a lock — it is arithmetic, and its price is one sconce lit under
EACH gravity, so the sum can only be paid by understanding both halves.

Cuts at 17 and 35. The crossing past 35 is the last chamber: no sconce, and
nothing in it either cell has not already taught.
"""
import io

W, H = 54, 30
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
# THE ANTECHAMBER and THE LEFT CELL · cols 1-16, gravity down.
# A ledge climb with the wall's own pistons, read the way the whole game has
# read a ledge climb up to now. This is the half you already know.
# =============================================================================
run(26, 1, 16)                    # the antechamber floor
put(3, 25, '@')
put(6, 25, 'S')                   # the entry sconce
run(25, 8, 14, 'o')
run(22, 2, 8)
run(19, 9, 15)
run(16, 1, 7)
run(13, 8, 15)
run(10, 2, 9)
run(21, 10, 14, 'o')
run(12, 3, 7, 'o')
put(16, 9, 'S')                   # LEDGER ONE: lit under gravity as given
box(11, 9, 15, 9)
box(1, 24, 1, 24, 'X'); box(16, 20, 16, 20, 'X')
box(1, 14, 1, 14, 'X'); box(16, 15, 16, 15, 'X')

# =============================================================================
# THE SHARED WALL · cols 17-18. The seam. Motes fall SIDEWAYS past it before
# you cross, so the dialect is shown before it is entered.
# =============================================================================
box(17, 2, 18, 27)
# the doorway is TWO courses thick, because the wall is: opening only the far
# column leaves the door walled off from the side you approach it from
box(17, 22, 18, 25, '1')          # the door, priced at two — one per gravity

# =============================================================================
# THE RIGHT CELL · cols 19-35, gravity UP. The same climb re-read: what your
# body calls the floor is the ceiling, and the pistons descend out of it.
# =============================================================================
box(19, 2, 35, 27, '^')
run(3, 19, 35)                    # the right cell's "floor", overhead
run(6, 20, 26)
run(9, 27, 34)
run(12, 19, 25)
run(15, 26, 34)
run(18, 20, 27)
run(21, 28, 35)
run(24, 19, 26)
run(27, 19, 35)                   # and its "ceiling", which is the stone below
run(5, 28, 34, 'o')
run(11, 27, 33, 'o')
run(17, 29, 34, 'o')
run(23, 20, 25, 'o')
put(35, 22, 'S')                  # LEDGER TWO: lit under gravity reversed, and
                                  # hung UNDER its course, because over there
                                  # the body rests against the underside
box(19, 5, 19, 5, 'X'); box(35, 13, 35, 13, 'X')
box(19, 17, 19, 17, 'X')

# =============================================================================
# THE CROSSING · cols 36-52. Ketsu: over the seam at the top, gravity flipping
# under you, both crusher banks interleaved. Density of the known.
# =============================================================================
box(36, 2, 36, 14)
box(36, 20, 36, 27)
run(15, 36, 44, '^')              # the flip happens mid-crossing
box(37, 2, 44, 14, '^')
run(3, 37, 45)
run(7, 38, 43)
run(11, 37, 44)
run(6, 39, 43, 'o')
run(10, 38, 42, 'o')
run(16, 45, 51)                   # and out the far side, gravity as given
run(20, 46, 52)
run(24, 45, 51)
run(19, 46, 51, 'o')
run(23, 46, 50, 'o')
put(48, 23, 'M')
put(46, 23, 'N')
put(50, 23, 'F')                  # feet pointing opposite ways across the wall
box(45, 2, 45, 15)
box(1, 28, 52, 28)                # and the bed under all of it, so the room
box(1, 27, 16, 27)                # has no hollow nobody was meant to find

rows = [''.join(r) for r in g]
for i, r in enumerate(rows):
    assert len(r) == W, f'row {i} is {len(r)}'

defn = """  // 7 · THE DEBT — a mirrored diptych sharing a wall, and the mirror is the
  // lesson: everything you did on the left, re-read upside down on the right.
  // The pistons are one system with the gravity — same period, opposite
  // phase, both sides of the ledger paid.
  //
  // The door is not a lock. Its price is one sconce lit under EACH gravity,
  // so the sum cannot be paid without understanding both halves, which is
  // what "this is arithmetic" means when a room says it.
  {
    glyph: 'debt',
    chambers: [17, 35],
    doorNeeds: { '1': 2 },
    crushers: [
      // the left bank, out of the wall the way a piston has always come
      { x: 1, y: 17, w: 2, h: 2, dx: 4, dy: 0, period: 3.4, phase: 0 },
      { x: 13, y: 18, w: 2, h: 2, dx: -4, dy: 0, period: 3.4, phase: 0.5 },
      // and the right bank, mirrored: same period, opposite phase, descending
      // out of what the body over there calls the floor
      { x: 24, y: 4, w: 2, h: 2, dx: 0, dy: 4, period: 3.4, phase: 0.5 },
      { x: 26, y: 22, w: 2, h: 2, dx: 0, dy: -4, period: 3.4, phase: 0 },
      // interleaved once more across the crossing
      { x: 38, y: 4, w: 2, h: 2, dx: 0, dy: 3, period: 2.55, phase: 0.25 },
      { x: 46, y: 17, w: 2, h: 2, dx: 0, dy: 3, period: 2.55, phase: 0.75 },
    ],
    censers: [
      // one lantern per cell, swinging in each cell's own down
      { x: 9, y: 16, len: 2.8, arc: 0.9, period: 2.55, phase: 0 },
      { x: 27, y: 12, len: 2.8, arc: 0.9, period: 2.55, phase: 0.5 },
    ],
    shuttles: [
      { x0: 20, y0: 7, x1: 34, y1: 7, period: 3.4, phase: 0.25 },
      { x0: 15, y0: 20, x1: 3, y1: 20, period: 2.55, phase: 0.75 },
    ],
    map: [
%s
    ],
  },
"""
body = ',\n'.join("      '" + r + "'" for r in rows)
out = defn % body

p = 'src/world/vaults.ts'
s = io.open(p, encoding='utf-8').read()
start = s.index('  // 7 · THE DEBT')
end = s.index('  // 8 · THE RETURN')
s = s[:start] + out + s[end:]
io.open(p, 'w', encoding='utf-8').write(s)
print('DEBT written:', len(rows), 'rows x', W)
