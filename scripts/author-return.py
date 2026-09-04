"""THE RETURN — V4 authoring. 56 x 38, the U walked in full.

Down the left chimney, across the bottom, up the right. Introduces no noun;
it introduces a ROLE. You have spent the whole game dodging the lantern and
here there is a gutter no jump crosses, no floor serves, and the only thing
in reach is the crown at the top of its swing. The ride is discovered because
nothing else is left (grammar §1.6), over a gutter shallow enough that being
wrong about it costs seconds.

Cuts at 17 and 38, each with a sconce on it. The ascent past 38 is the last
chamber: no sconce, and nothing in it the U has not already walked.
"""
import io

W, H = 56, 38
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
box(1, 32, W - 2, H - 2)          # the bed under the whole U, with no hollow

# =============================================================================
# THE DESCENT · cols 1-16. Censers across the chimney, dodged as taught —
# until the gutter, where dodging is not one of the options.
# =============================================================================
run(5, 1, 16)
put(3, 4, '@')
put(6, 4, 'S')                    # the entry sconce
run(4, 8, 14, 'o')
run(9, 1, 8)
run(13, 10, 16)
run(17, 1, 7)
run(21, 9, 16)
run(8, 10, 15, 'o')
run(12, 2, 7, 'o')
run(16, 10, 15, 'o')
run(20, 2, 7, 'o')
# THE GUTTER. Shallow, and there is nothing across it but the lantern.
run(25, 1, 5)
run(28, 1, 16)                    # the gutter's own floor, three courses down
run(24, 6, 15, 'o')               # the arc the ride is taken on, marked
run(25, 13, 16)
box(1, 31, 16, 31)
run(23, 15, 18)
run(25, 13, 18)                   # the gutter's far lip, widened to stand on

# =============================================================================
# THE BOTTOM · cols 17-38, gravity RIGHT. The corridor is sideways-down and
# it is walked along its wall, threaded with bolts on the way through.
# =============================================================================
box(17, 6, 38, 30, '>')
box(17, 6, 22, 21)                # the roof of the corridor, which is its wall
box(26, 6, 31, 18)
box(35, 6, 38, 22)
put(17, 24, 'S')                  # the cut-17 sconce, placed AFTER the gravity
                                  # zone that would otherwise write over it,
                                  # and four clear courses off the ride's arc
run(31, 17, 38)                   # the corridor's far side
run(26, 23, 25, 'o')
run(24, 32, 34, 'o')
put(28, 29, 'C')                  # the one who stayed
put(30, 29, 'F')
put(37, 24, 'S')                  # the cameo sconce, which door 1 requires
box(38, 23, 39, 28, '1')          # and the door it pays for, straddling the
                                  # cut so the ascent introduces no new noun

# =============================================================================
# THE ASCENT · cols 41-54. Wall-jumps up the right limb, a gate sealing the
# bottom behind you, and the lanterns ridden UPWARD this time, apex to apex.
# =============================================================================
run(30, 41, 54)
box(41, 3, 41, 25)                # the limb's own wall — open at its foot, or
                                  # the whole ascent is a room with no door
run(28, 42, 45)                   # ledges alternating either side of the
run(26, 47, 50)                   # chimney, a course apart: the climb is
run(24, 42, 45)                   # wall-jumps and lantern-rides, and the
run(22, 47, 50)                   # difficulty is what is swinging through it
run(20, 42, 45)
run(18, 47, 50)
run(16, 42, 45)
run(14, 47, 50)
run(12, 47, 50)
run(10, 42, 44)                   # the last ledge steps back to the near side,
                                  # stopping short of col 46 so the chimney it
                                  # climbs stays open all the way to the top
run(27, 47, 50, 'o')
run(19, 42, 45, 'o')
run(11, 47, 50, 'o')
box(51, 11, 54, 29)               # the limb's far wall
# THE GALLERY. Offset from the ledge below it: a floor laid straight over the
# last rung leaves one course of clearance, and the body is two courses tall —
# the climb would end one jump short of the room it exists to reach.
run(8, 47, 54)
run(7, 47, 53, 'o')
put(50, 7, 'M')
put(48, 7, 'K')                   # reaching, still
put(52, 7, 'N')

rows = [''.join(r) for r in g]
for i, r in enumerate(rows):
    assert len(r) == W, f'row {i} is {len(r)}'

defn = """  // 8 · THE RETURN — the U walked in full, and the only new thing in it is a
  // ROLE. You have spent the game dodging the lantern; here there is a gutter
  // no jump crosses, no floor serves, and the only thing in reach is the
  // crown at the top of its swing. The ride is discovered because nothing
  // else is left, over a gutter shallow enough that being wrong costs
  // seconds (grammar §1.6).
  //
  // The bottom is right-gravity: the corridor IS sideways-down, walked along
  // its own wall, and midway through it is the one who stayed and the sconce
  // beside them. You cannot pass without standing with them.
  {
    glyph: 'return',
    chambers: [17, 38],
    doorNeeds: { '1': 3 },
    censers: [
      // dodged on the way down...
      { x: 9, y: 7, len: 3.0, arc: 0.95, period: 2.55, phase: 0 },
      { x: 6, y: 15, len: 2.8, arc: 0.9, period: 2.55, phase: 0.5 },
      // ...and RIDDEN across the gutter, because there is nothing else
      { x: 10, y: 22, len: 3.2, arc: 1.0, period: 2.55, phase: 0.25 },
      // then ridden upward on the far limb, apex to apex
      { x: 46, y: 22, len: 3.0, arc: 0.95, period: 2.55, phase: 0 },
      { x: 50, y: 14, len: 2.8, arc: 0.9, period: 2.55, phase: 0.5 },
      { x: 45, y: 8, len: 2.6, arc: 0.85, period: 2.55, phase: 0.25 },
    ],
    shuttles: [
      // bolts threading the sideways corridor
      { x0: 23, y0: 26, x1: 32, y1: 26, period: 1.7, phase: 0 },
      { x0: 34, y0: 29, x1: 23, y1: 29, period: 2.55, phase: 0.5 },
      // and the moth on the descent, awake to the light you are carrying
      { x0: 3, y0: 11, x1: 14, y1: 19, period: 3.4, phase: 0, snuff: true },
    ],
    currents: [
      // the vent under the corridor's far end, the road out of the bottom
      { x0: 36, y0: 24, x1: 37, y1: 30, force: 46 },
    ],
    crushers: [
      // one on the descent, so the ascent's pair recombine rather than debut
      { x: 1, y: 12, w: 2, h: 2, dx: 4, dy: 0, period: 3.4, phase: 0.25 },
      { x: 44, y: 27, w: 2, h: 2, dx: 0, dy: -3, period: 3.4, phase: 0 },
      { x: 49, y: 19, w: 2, h: 2, dx: 0, dy: -3, period: 3.4, phase: 0.5 },
    ],
    gates: [
      // the return does not un-happen
      { x0: 38, y0: 29, x1: 47, y1: 29 },
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
start = s.index('  // 8 · THE RETURN')
end = s.index('  // 9 · THE KINDLED')
s = s[:start] + out + s[end:]
io.open(p, 'w', encoding='utf-8').write(s)
print('RETURN written:', len(rows), 'rows x', W)
