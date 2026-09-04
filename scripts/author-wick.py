"""THE WICK — built to the drawing. 73 x 48, and it has no walls.

    left ---> right ---> up the staircase

The room is open sky. There is no floor under the traverse, no wall beside the
shaft, and nothing to land on that was not put there on purpose. Miss, and you
fall past the screen and re-form at the last sconce you paid for.

The invisible boundary sits EIGHT tiles out on every side (VOID_PAD in
src/game/vault.ts). That is about a jump and a half of slack, and it is
generous deliberately: a wall one block past the last platform kills players
who are still steering back from a missed landing, which is a death they can
neither see coming nor learn from. Past the pad the fall was already over.

TWO SCONCES, as drawn. One at the start, one at the foot of the staircase.
Not one per camera cut: a chamber is 22 columns and a jump covers 5.45, so a
light at every cut would cap a run at three jumps of risk. The traverse
crosses two cuts unlit on purpose — it is a single unbroken run, and a fall
anywhere in it costs all of it.

Distances are fractions of the MEASURED running jump (5.45 tiles across, 2.68
up — docs/movement-metrics.md), declared per beat rather than measured off the
map afterwards.
"""
import io

W, HGT = 73, 48
MAXJ = 5.45
g = [['.'] * W for _ in range(HGT)]          # open sky, not stone

PATH = []
CUR = {'x0': 1, 'x1': 5, 'y': 40}
PATH.append({**CUR, 'note': 'the start, and the first light', 'frac': 0})


def beat(gap, width, rise, note=''):
    """Place the next shelf GAP empty columns to the right.

    Authored in tiles, not in fractions of the jump, because the map is made
    of tiles: `round(frac * 5.45)` quietly collapsed 0.55 and 0.62 onto the
    same three columns, so the fractions in the comments described a room that
    was never built. The fraction is now derived from what was laid down —
    the crossing is gap+1 tiles, over a 5.45-tile jump — and printed back.
    """
    x0 = CUR['x1'] + 1 + gap
    y = CUR['y'] - rise
    frac = (gap + 1) / MAXJ
    assert x0 + width - 1 <= W - 2, f'{note}: runs off the map at x={x0}'
    assert 2 <= y < HGT - 2, f'{note}: off the map vertically at y={y}'
    # the 45-degree spark carries 8.60 tiles, which is 1.58 running jumps
    assert frac <= 1.55, f'{note}: {frac:.2f}x is past the reach of the spark'
    CUR.update({'x0': x0, 'x1': x0 + width - 1, 'y': y})
    PATH.append({**CUR, 'note': note, 'frac': frac})


def kick(across, rise, dirn, note=''):
    """A single block whose FACE is the target, not its top.

    Placed higher than a jump can rise, so the step below cannot reach its
    surface. The body arrives against the side, the wall catches it, and the
    kick is the only way on. Written as tiles rather than a fraction because
    what is being authored is a wall, not a gap.
    """
    x0 = CUR['x1'] + across if dirn > 0 else CUR['x0'] - across
    y = CUR['y'] - rise
    assert 1 <= x0 <= W - 2, f'{note}: off the map at x={x0}'
    assert 2 <= y < HGT - 2, f'{note}: off the map vertically at y={y}'
    CUR.update({'x0': x0, 'x1': x0, 'y': y})
    PATH.append({**CUR, 'note': note, 'frac': 0, 'kick': True})


def climb(gap, width, rise, dirn, note=''):
    """A staircase beat: alternating, so the shaft is a zig-zag not a ladder."""
    frac = (gap + 1) / MAXJ
    x0 = CUR['x1'] + 1 + gap if dirn > 0 else CUR['x0'] - gap - width
    y = CUR['y'] - rise
    assert 1 <= x0 and x0 + width - 1 <= W - 2, f'{note}: off the map at x={x0}'
    assert 2 <= y < HGT - 2, f'{note}: off the map vertically at y={y}'
    CUR.update({'x0': x0, 'x1': x0 + width - 1, 'y': y})
    PATH.append({**CUR, 'note': note, 'frac': frac})


# ===========================================================================
# THE TRAVERSE · nine beats, left to right, over nothing.
# Every landing here is small and every miss is the whole run. The fractions
# climb from a stroll to the top of the legs' range, and the last one before
# the checkpoint is the spark — taught by inevitability, and now taught over
# a drop rather than a basin, which is the drawing's whole point.
# ===========================================================================
# The crossings climb in four rungs of about 0.18x each — 0.73, 0.92, 1.10 —
# and THE SPARK at 1.47 is simply the next rung. Nothing is introduced at the
# gap; the room has been counting up to it for eight beats, and the only thing
# that changes is which verb reaches.
beat(3, 3, 0, 'the first hop — nothing under it')
beat(3, 2, +1, 'two tiles wide from here on')
beat(4, 2, 0, '')
beat(4, 2, -1, 'down as well as up: the line is not a staircase')
beat(4, 2, +1, '')
beat(5, 1, 0, 'ONE tile. The aim is the jump.')
beat(5, 2, +1, '')
beat(5, 2, 0, '1.10x — past the honest reach, landed on the fall of the arc')
beat(7, 4, +1, 'THE SPARK — and it lands on the second light')

# ===========================================================================
# THE STAIRCASE · the climb, with the second light at its foot.
# A zig-zag rather than a ladder, so each step is a jump with a direction in
# it. The shaft is open on both sides — the boundary is eight tiles out, so a
# missed kick has room to be recovered before it becomes a fall.
# ===========================================================================
# NOTHING IN THIS SHAFT MAY BE REACHABLE FROM THE NEAR SIDE OF THE GAP.
# The first build put the stair's foot at x58 y34 and the harness walked
# (53,38)->(58,34) on legs with 13 frames to spare: four across and four up is
# well inside one arc once there is a face to kick, and a single block is all
# face. That made the spark gap scenery. Wall-kicks chain for free, so the
# rule is not "the first step is hard to reach" but "no step is reachable at
# all" — touch one and you have the whole shaft.
#
# So the shaft lives entirely at x >= 60, six columns past the last thing on
# the near side (x54) and rising. The gap is the only door into it.
climb(2, 2, +3, +1, 'the foot of the staircase')
climb(2, 2, +3, -1, '')
climb(3, 2, +3, +1, '')
climb(3, 2, +3, -1, '')

# ---------------------------------------------------------------------------
# THE FORCED KICKS. Single blocks, alternating sides, set FOUR courses apart —
# past the 2.68 a jump can rise, so their tops cannot be reached from the step
# below. What you can reach is the FACE, and a wall inside 0.4 tiles is a kick
# whether you meant it or not.
#
# So the arrival is sideways: you jump into the block, catch it, and kick back
# across to the next one. Three of them, and the shaft is open on both sides
# the whole way, so a fumbled kick has eight tiles of sky to be corrected in
# before it becomes a fall.
# ---------------------------------------------------------------------------
kick(4, +4, +1, 'kick one — arrive at the face, not the top')
kick(4, +4, -1, 'kick two, back the other way')
kick(4, +4, +1, 'kick three')
climb(3, 4, +3, -1, 'the head of the stair')

# A kick block is drawn THREE courses deep. One course is a floating cube and
# nothing about a floating cube says "kick off me" — the move the shaft asks
# for has to be visible in the shape of the thing that asks for it. The extra
# stone hangs BELOW, so the tops stay four courses apart and the reach envelope
# is untouched; all that changes is that there is now a face to see and to
# catch.
KICK_FACE = 3
for p in PATH:
    deep = KICK_FACE if p.get('kick') else 1
    for x in range(p['x0'], p['x1'] + 1):
        for d in range(deep):
            g[p['y'] + d][x] = '#'


def arc(y, x0, x1):
    for x in range(x0, x1 + 1):
        if 0 <= x < W and 0 <= y < HGT and g[y][x] == '.':
            g[y][x] = 'o'


def put(x, y, ch):
    g[y][x] = ch


# motes over the apex of every crossing — the only guidance in an open room
for i in range(len(PATH) - 1):
    a, b = PATH[i], PATH[i + 1]
    mx = (a['x1'] + b['x0']) // 2 if b['x0'] > a['x1'] else (b['x1'] + a['x0']) // 2
    arc(min(a['y'], b['y']) - 2, mx - 1, mx + 1)

# the spark's own breadcrumb: straight and rising where every other arc in the
# room is a curve, and the only instruction the room gives
GAP = next(k for k, q in enumerate(PATH) if q['frac'] > 1.2)
near, far = PATH[GAP - 1], PATH[GAP]
for i, x in enumerate(range(near['x1'] + 1, far['x0'])):
    arc(near['y'] - 1 - (i // 3), x, x)

put(PATH[0]['x0'] + 1, PATH[0]['y'] - 1, '@')
put(PATH[0]['x0'] + 3, PATH[0]['y'] - 1, 'S')

# the second light stands where the spark gap lands — the foot of the stair,
# as drawn. The whole traverse from the first light to here is one unbroken
# run, which is the point of the room.
foot = PATH[GAP]
put(foot['x0'] + 1, foot['y'] - 1, 'S')

head = PATH[-1]
put(head['x0'] + 2, head['y'] - 1, 'M')
put(head['x0'], head['y'] - 1, 'K')

rows = [''.join(r) for r in g]
for i, r in enumerate(rows):
    assert len(r) == W, f'row {i} is {len(r)}'

defn = """  // Cuts are inclusive last-columns. The last chamber is 51-72 and holds the
  // spark gap AND the whole shaft, because the far lip of a teaching gap must
  // be VISIBLE from the launch — a cut mid-flight would hide the thing the
  // beat exists to show. The three before it split the traverse evenly.
  //
  // 1 · THE WICK — the tutorial, and it has no walls. Left, right, and up the
  // staircase, over open sky the whole way. There is no floor under the
  // traverse and no wall beside the shaft: miss, and you fall past the screen
  // and re-form at the last sconce you paid for.
  //
  // The boundary sits eight tiles out (VOID_PAD). A wall one block past the
  // last platform kills players who are still steering back from a missed
  // landing — a death they can neither see coming nor learn from — so the pad
  // is generous and the only thing that ends a run is a fall already over.
  //
  // Two sconces. One at the start, one at the foot of the stair. NOT one per
  // camera cut — the traverse crosses two cuts unlit, deliberately, so that
  // the nine beats from the first light to the second are a single unbroken
  // run and a fall anywhere in them costs all of it. That is where the risk
  // lives, and it is the whole reason the room has no walls.
  {
    glyph: 'wick',
    chambers: [17, 34, 50],
    openEdges: true,
    map: [
%s
    ],
  },
"""
body = ',\n'.join("      '" + r + "'" for r in rows)
out = defn % body

p = 'src/world/vaults.ts'
s = io.open(p, encoding='utf-8').read()
start = s.index('  // 1 · THE WICK')
end = s.index('  // 2 · THE FAMINE')
io.open(p, 'w', encoding='utf-8').write(s[:start] + out + s[end:])

print(f'THE WICK · {HGT} rows x {W} · {len(PATH)} platforms\n')
print('  beat  from      to        gap  xjump  rise  note')
for i in range(len(PATH) - 1):
    a, b = PATH[i], PATH[i + 1]
    gap = (b['x0'] - a['x1'] - 1) if b['x0'] > a['x1'] else (a['x0'] - b['x1'] - 1)
    print(f"  {i+1:>4}  ({a['x0']:>2},{a['y']:>2})   ({b['x0']:>2},{b['y']:>2})"
          f"   {gap:>3}  {b['frac']:>5.2f}  {a['y'] - b['y']:>+4}  {b['note']}")
print()
print('    ' + ''.join(str(i // 10 % 10) for i in range(W)))
print('    ' + ''.join(str(i % 10) for i in range(W)))
for i, r in enumerate(rows):
    print(f'{i:3d} {r}')
