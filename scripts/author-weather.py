"""THE WEATHER — V4 authoring. 60 x 40, an L: right across the surface, then
down out of the storm.

The room enacts its own glyph. Depth is the only calm, so the wind is the
whole of the crossing and then it is gone, storey by storey, until the master
stands in the first still air of the act. Its rime is the ONE-SHOT kind — the
trap under the trap light — because THE EMBER owns the cycle and a room may
never teach both (grammar §2).

Cuts at 19 and 39. The descent past 39 is the last chamber: no sconce in it,
and nothing in it the crossing has not already taught.
"""
import io

W, H = 60, 40
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


# ---- the shell: sky above, stone below, and the storm between --------------
box(0, 0, W - 1, 0)
box(0, H - 1, W - 1, H - 1)
box(0, 0, 0, H - 1)
box(W - 1, 0, W - 1, H - 1)

# =============================================================================
# THE SURFACE · cols 1-45 — the crossing. Walked RIGHT, into a wind blowing
# left, so every step of it is paid for.
# =============================================================================
run(14, 1, 12)                    # KI: flat ground, where a gust only slides
put(3, 13, '@')
put(6, 13, 'S')                   # the entry sconce, in the lee of the first shelter
run(13, 8, 12, 'o')
box(6, 9, 10, 10)                 # shelter one
box(15, 9, 19, 10)                # shelter two
box(27, 9, 31, 10)                # shelter three
run(14, 15, 24)                   # SHO: shelter runs with real drops
run(14, 27, 35)
run(20, 13, 26)                   # what a missed run costs: a storey down
run(19, 14, 25, 'o')
run(18, 17, 17); run(18, 22, 22)  # and the climb back out of it
run(16, 15, 16); run(16, 23, 24)
put(19, 13, 'S')                  # the cut-19 sconce, on the shelter's shoulder
run(12, 15, 19, 'o')

# THE TRAP LIGHT. A lit sconce on the obvious line, and the shelf under it is
# rime that does not come back. Light is information, not permission.
run(10, 32, 35, 'R')
put(33, 9, 'S')
run(8, 30, 36, 'o')

# TEN · the current. An unjumpable gap, and one wind that is a road.
run(14, 36, 39, 'o')              # the gap itself, marked
run(11, 40, 45)                   # the far side, higher than the near one
run(10, 41, 44, 'o')
put(39, 13, 'S')                  # the cut-39 sconce, at the current's mouth

# KETSU · the low eave, crossed flat out under gust pressure
box(40, 8, 45, 9)
run(12, 40, 45, 'o')
put(42, 12, 'F')                  # two braced together behind the last shelter
put(44, 12, 'C')

# =============================================================================
# THE DESCENT · cols 46-58 — three quiet storeys. The force fades per row and
# the room goes still. Nothing new lives down here; that is the point of it.
# =============================================================================
box(46, 1, 46, 10)
run(11, 46, 58)                   # the lip of the turn
run(15, 48, 58)
run(19, 46, 55)
run(23, 50, 58)
run(27, 46, 54)
run(31, 49, 58)
run(35, 46, 58)                   # the still floor
run(14, 50, 57, 'o')
run(22, 52, 57, 'o')
run(30, 50, 56, 'o')
run(34, 48, 57, 'o')
put(52, 34, 'M')
put(49, 34, 'N')                  # one kneeling in the first still air

rows = [''.join(r) for r in g]
for i, r in enumerate(rows):
    assert len(r) == W, f'row {i} is {len(r)}'

defn = """  // 6 · THE WEATHER — the room enacts its own glyph. Depth is the only calm,
  // so the wind is the whole of the crossing and then it is gone, storey by
  // storey, until the master stands in the first still air of the act. An L:
  // right across the surface into a wind blowing left, then down out of it.
  //
  // Its rime is the ONE-SHOT kind. THE EMBER owns the cycle, where a shelf
  // coming back is a rhythm you lean on; here it is the trap under the trap
  // light, and a room may never teach both (grammar §2).
  {
    glyph: 'weather',
    chambers: [19, 39],
    wind: { dir: -1, calm: 3.4, gust: 2.55, force: 30 },
    rimeOnce: true,
    censers: [
      // the lantern returns IN the wind: its arc skewed by the gust, so the
      // crossing is two clocks read at once
      // hung clear of both shoulder sconces by four courses at every point of
      // their arcs — a swinging hazard is a moving danger volume, and the
      // buffer is measured against the whole swing, not the lantern's rest
      { x: 26, y: 6, len: 3.2, arc: 1.0, period: 2.55, phase: 0 },
      { x: 38, y: 3, len: 2.6, arc: 0.85, period: 2.55, phase: 0.5 },
    ],
    shuttles: [
      // bolts down the shelter runs, into the wind's own line
      { x0: 15, y0: 7, x1: 24, y1: 7, period: 1.7, phase: 0.25 },
      { x0: 35, y0: 19, x1: 26, y1: 19, period: 2.55, phase: 0.75 },
    ],
    crushers: [
      // the eave's own teeth, on the pulse the gust is counted in
      { x: 25, y: 10, w: 2, h: 1, dx: 0, dy: 3, period: 3.4, phase: 0 },
      { x: 44, y: 8, w: 2, h: 1, dx: 0, dy: 2, period: 3.4, phase: 0.5 },
      { x: 50, y: 12, w: 2, h: 1, dx: 0, dy: 3, period: 2.55, phase: 0.25 },
    ],
    currents: [
      // TEN: wind was the enemy, and now one wind is the road
      { x0: 36, y0: 5, x1: 39, y1: 20, force: 46 },
    ],
    beams: [
      // a watch-light on the descent, parked until the turn downward
      // one on the crossing and one on the descent: by P4 the last chamber
      // may hold nothing the room has not already taught
      { x: 12.5, y: 11.5, period: 4.25, phase: 0.5, spin: true, parked: true, arm: [8, 12, 14, 14] },
      { x: 46.5, y: 21.5, period: 4.25, phase: 0, spin: true, parked: true, arm: [46, 11, 58, 13] },
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
start = s.index('  // 6 · THE WEATHER')
end = s.index('  // 7 · THE DEBT')
s = s[:start] + out + s[end:]
io.open(p, 'w', encoding='utf-8').write(s)
print('WEATHER written:', len(rows), 'rows x', W)
