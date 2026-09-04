"""THE VAULT — V4 authoring. A keep, 54 x 34, climbed from inside.

The metronome room. Every floor that comes and goes runs on one pulse, the
two doors are priced in sconces rather than locked, and the shuttle debuts as
the fire's own warden. Act II's playground is a lock you may pick in any
order, so the three required sconces are reachable in any sequence and the
fourth is optional, hard, and hung over a shuttle run for players buying
slack.

Cuts at 17 and 35, each with a sconce standing on it. The gallery past door
`2` is the last chamber, so by P4 it introduces nothing and holds no sconce.
"""
import io

W, H = 54, 34
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


# ---- the shell -------------------------------------------------------------
box(0, 0, W - 1, 1)               # cap
box(0, H - 1, W - 1, H - 1)       # bed
box(0, 0, 0, H - 1); box(W - 1, 0, W - 1, H - 1)
run(32, 0, W - 1)                 # the keep's ground

# =============================================================================
# BAY A · cols 1-17 — KI. One bridge over safe floor. Stand on it, feel the
# warn flicker, drop three tiles onto stone, climb back and read it again.
# Nothing here can hurt you, which is the only place in Act II that is true.
# =============================================================================
put(3, 31, '@')
put(5, 31, 'S')                   # the entry sconce
run(31, 7, 12, 'o')               # motes tracing the first hop
run(28, 7, 12, 'A')               # the teaching bridge, group A
run(27, 2, 5)                     # a ledge to read it from
run(23, 1, 6)
run(19, 4, 10)
run(15, 1, 7)
put(9, 14, 'o')
run(11, 5, 12)
# the climb's own hazard: a bolt on the wire across the bay
run(24, 9, 14, 'o')
put(17, 19, 'S')                  # the cut-17 sconce, on the bay's shoulder
run(20, 14, 17)

# =============================================================================
# BAY B · cols 18-35 — SHO and TEN. The stairs read phase, not duration; then
# the same noun turned upside down, a b-group used as ceiling you crawl under
# only while it is gone (grammar §1.1).
# =============================================================================
box(18, 26, 18, 31, '1')          # the door that splits the keep, priced at 2
run(29, 20, 24, 'A')              # stairs: A ...
run(26, 26, 30, 'b')              # ... up to b ...
run(23, 31, 34, 'A')              # ... up to A
run(31, 20, 34, 'o')
run(20, 19, 22)                   # a shelf to land the stairs on
run(17, 20, 31)                   # the crawl's floor
run(15, 20, 31, 'b')              # and its ceiling: one course of clearance
run(16, 22, 29, 'o')              # motes in the gap, marking the way through
run(12, 19, 24)
run(9, 26, 32)                    # the shelf directly under the wire: stand
                                  # here and the bolt goes through your head
run(5, 23, 28)                    # the perch above it
put(26, 4, 'S')                   # the optional sconce — OVER the run, four
                                  # clear courses off it, which is what a
                                  # checkpoint needs to be worth reaching
run(8, 30, 33, 'o')
run(4, 29, 32, 'o')
run(23, 32, 35)                   # the shoulder first...
put(35, 22, 'S')                  # ...then the cut-35 sconce standing on it
box(20, 30, 20, 30, 'X')          # the studs that shape the stairs' landings
box(25, 30, 25, 30, 'X')
box(30, 30, 30, 30, 'X')

# =============================================================================
# BAY C · cols 36-52 — KETSU. The gallery climb: bridges, one threading
# shuttle, everything on the one pulse, and no sconce inside it at all.
# =============================================================================
box(36, 17, 36, 22, '2')          # the gallery's price: three sconces
run(23, 37, 43)
run(20, 45, 51, 'A')
run(17, 38, 44, 'b')
run(14, 46, 52, 'A')
run(11, 37, 43, 'b')
run(8, 45, 51, 'A')
run(19, 40, 44, 'o')
run(13, 47, 51, 'o')
box(44, 30, 44, 30, 'X')
box(48, 26, 48, 26, 'X')
run(5, 44, 52)                    # the gallery's own floor
put(48, 4, 'M')
put(46, 4, 'C')                   # the one who stayed, curled away from it
run(4, 50, 52, 'o')

# the keep's inner walls, so the three bays read as one building
box(18, 2, 18, 25)
box(36, 2, 36, 16)
box(36, 23, 36, 31)
# and the ways between them at ground level
box(18, 26, 18, 31, '1')
run(31, 37, 52, 'o')
run(28, 37, 41)
run(26, 44, 48)

rows = [''.join(r) for r in g]
for i, r in enumerate(rows):
    assert len(r) == W, f'row {i} is {len(r)}'

defn = """  // 4 · THE VAULT — the metronome. Every floor that comes and goes runs on
  // the one pulse, the doors are priced rather than locked, and the shuttle
  // debuts as the fire's own warden. The keep is climbed from inside and it
  // is NONLINEAR: the three required sconces answer in any order, which is
  // the generosity Act II's playground is for. The fourth is optional, hard,
  // and hung over a wire for players buying slack.
  {
    glyph: 'vault',
    chambers: [17, 35],
    doorNeeds: { '1': 2, '2': 3 },
    shuttles: [
      // the wardens: bolts patrolling the room that keeps the fire
      { x0: 8, y0: 24, x1: 15, y1: 24, period: 1.7, phase: 0 },
      { x0: 20, y0: 8, x1: 33, y1: 8, period: 3.4, phase: 0.25 },
      { x0: 33, y0: 12, x1: 20, y1: 12, period: 3.4, phase: 0.75 },
      { x0: 37, y0: 26, x1: 52, y1: 26, period: 2.55, phase: 0 },
      // the one threading the gallery climb, on the same pulse as its floors
      { x0: 52, y0: 11, x1: 37, y1: 11, period: 3.4, phase: 0.5 },
    ],
    censers: [
      // one lantern over the stairs, so the phase read has something moving
      // through it that is not a floor
      { x: 27, y: 20, len: 2.6, arc: 0.9, period: 2.55, phase: 0 },
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
start = s.index('  // 4 · THE VAULT')
end = s.index('  // 5 · THE EMBER')
s = s[:start] + out + s[end:]
io.open(p, 'w', encoding='utf-8').write(s)
print('VAULT written:', len(rows), 'rows x', W)
