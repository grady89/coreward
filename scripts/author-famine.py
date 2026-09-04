"""THE FAMINE — "every lit thing became a spent thing". 88 x 30.

    threshold -> down -> up -> DECISION -> down -> up -> the stone

A shallow W, as §II.2 asks, so that every walk-back after a theft is short.

THE ONE IDEA, stated in stone: **the ground does not give the breath back.**
Drank stone (`=`) carries you and refunds nothing. Live stone (`#`) refills.
The famine is built almost entirely of the first, so live stone stops being
scenery and becomes the thing you route between — and `deadLight` means the
sconces save your place and hand you nothing either.

THE FAMINE IS NOT THE WICK. That room is open sky and a miss is a fall; this
one has a floor and a miss is a *cost*. The low road is real, drank, and slow:
fall anywhere and you land on it, keep your life, lose your breath, and climb
back on legs. Softness in the failure is what buys the room its cruelty in the
economy, and nine rooms of open sky would be one room nine times.

The phrase unit here is **live stone -> n gaps, one spark -> live stone**. A
dry archipelago with one gap past the legs' reach has exactly one solution and
is a puzzle; with a branch it is a decision. That is the whole grammar.

Distances are fractions of the MEASURED running jump (5.45 across, 2.68 up —
docs/movement-metrics.md). Anything at or under 1.10x is legs; 1.47x is the
spark. There is nothing in between, on purpose: a gap in this room is either
free or it costs you the only thing you have.
"""
import io

W, HGT = 88, 30
MAXJ = 5.45
LOW = 26                                     # the low road, drank the whole way

g = [['.'] * W for _ in range(HGT)]
PATH = []


def rock(x0, x1, y0, y1, ch='#'):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if 0 <= x < W and 0 <= y < HGT:
                g[y][x] = ch


def shelf(x0, x1, y, ch='#', note='', sect=''):
    rock(x0, x1, y, y, ch)
    PATH.append({'x0': x0, 'x1': x1, 'y': y, 'ch': ch, 'note': note, 'sect': sect})


def put(x, y, ch):
    g[y][x] = ch


def arc(y, x0, x1):
    for x in range(x0, x1 + 1):
        if 0 <= x < W and 0 <= y < HGT and g[y][x] == '.':
            g[y][x] = 'o'


# the shell: this room has walls and a bottom, and that is the point of it
rock(0, W - 1, 0, 1)
rock(0, W - 1, HGT - 2, HGT - 1)
rock(0, 1, 0, HGT - 1)
rock(W - 2, W - 1, 0, HGT - 1)

# ===========================================================================
# THE LOW ROAD · row 26 · drank from end to end.
# It catches every miss in the room and it gives nothing back. Walking it is
# always possible and always slow, and you arrive at the far end carrying
# exactly what you were carrying when you fell — which, after a spark, is
# nothing. This is the safe line of rule 6, and the reason a miss here costs
# position and breath instead of a life.
# ===========================================================================
rock(2, W - 3, LOW, LOW, '=')

# ===========================================================================
# §1 · THRESHOLD · cols 2-14 · live stone, and the act's one honest light.
# Two hops on stone that refills, so that the moment it stops refilling is
# legible as a change rather than as a rule you never knew.
# ===========================================================================
shelf(2, 8, 14, '#', 'the threshold, and the last light that gives', 'threshold')
shelf(12, 14, 14, '#', '0.73x, and the stone hands it back', 'threshold')

# ===========================================================================
# §2 · KI · cols 18-40 · the descent, and the first stone that keeps.
# The shelves go drank at the first step down. Three crossings the legs can
# make, then one they cannot — and the spark spent there does not come back,
# because everything it lands on is dead. The dead sconce at the bottom saves
# your place and refuses you the breath, which is the lesson stated twice.
# ===========================================================================
shelf(18, 19, 16, '=', '0.73x — and this one keeps what you spend', 'ki')
shelf(23, 24, 19, '=', '0.92x, dropping', 'ki')
shelf(28, 29, 21, '=', '0.92x', 'ki')
shelf(37, 40, 22, '=', '1.47x — THE SPARK, and nothing here returns it', 'ki')

# ===========================================================================
# §3 · SHO · cols 44-60 · the climb out, on legs, because there is no choice.
# You reach the foot of this with an empty hand, so every rung is 1.10x or
# under by necessity. It ends on the first live stone since the threshold —
# and the room lets you feel that as relief before taking it away again.
# ===========================================================================
shelf(44, 45, 20, '=', '0.73x, climbing on nothing', 'sho')
shelf(49, 50, 17, '=', '0.73x', 'sho')
shelf(54, 55, 14, '=', '0.73x', 'sho')
shelf(59, 62, 12, '#', 'LIVE STONE — the first breath since the threshold', 'sho')

# ===========================================================================
# §4 · THE DECISION · cols 63-72 · two roads, and the light is on the wrong one.
# HIGH: three drank ledges straight on, fast, and no refill until the island.
# LOW:  a dead sconce a storey down. Lighting it buys your place and costs you
#       the height — you climb back on legs with nothing in hand.
# The wager the spec asks for, made of geometry: the checkpoint is not on the
# fast line, and taking it is a real price rather than a detour.
# ===========================================================================
shelf(67, 68, 11, '=', 'HIGH — 0.92x, straight on', 'decide')
shelf(72, 73, 11, '=', 'HIGH — 0.92x', 'decide')

shelf(66, 70, 17, '=', 'LOW — the dead sconce, a storey below the fast line', 'decide')
shelf(74, 75, 14, '=', 'LOW — 0.73x, climbing back with nothing', 'decide')

# ===========================================================================
# §5 · TEN · cols 76-82 · the only live stone on the crossing, and it is
# guarded. Re-arming means timing the island against the moth: the refill
# point IS the dangerous point, which is the famine's thesis as a route.
# ===========================================================================
shelf(78, 81, 11, '#', 'THE ISLAND — live, and a moth patrols it', 'ten')

# ===========================================================================
# §6 · KETSU · cols 82-86 · studs, and one spark carried past two moths.
# Nothing new: drank stone, a dead sconce, a stud, and the moths. The gap to
# the stone is 1.47x, so the spark has to arrive with you — and the corridor
# exists to take it off you before it can.
# ===========================================================================
shelf(82, 83, 8, '=', '0.73x off the island, spark in hand', 'ketsu')
shelf(85, 86, 5, '#', 'the stone', 'ketsu')

# the studs of the last corridor: a fang in the wall of the climb, so the
# line past the moths is narrow without being invisible
put(84, 7, 'X')
put(81, 6, 'X')

# ---------------------------------------------------------------------------
# THE CLIMB OFF THE LOW ROAD. A room whose resource runs out must never stand
# you somewhere the stone cannot be reached from, so the road back up is drank
# stone at 0.73x the whole way — legs only, no spark anywhere in it. It is
# long because it is safe; that is the trade the low road is for.
# ---------------------------------------------------------------------------
for i, (x0, x1, y) in enumerate([
        (34, 35, 24), (39, 40, 24), (44, 45, 24), (49, 50, 24),
        (54, 55, 24), (59, 60, 24), (64, 65, 24), (69, 70, 22),
        (74, 75, 20), (79, 80, 17), (84, 85, 14), (79, 80, 11)]):
    shelf(x0, x1, y, '=', 'the long way up, on legs', 'lowroad')

# ---------------------------------------------------------------------------
# sconces: entry + three, all dead (§II.2). None of them refill; the first is
# the act's one honest cup and it is behind you within eight tiles.
# ---------------------------------------------------------------------------
put(4, 13, '@')
put(7, 13, 'S')                 # threshold
put(38, 21, 'S')                # the bottom of the ki, where the spark went
put(67, 16, 'S')                # THE DECISION — a storey off the fast line
put(85, 4, 'M')
put(83, 4, 'K')                 # one figure, curled around an empty lamp

# motes over the apex of every crossing that the golden line asks for
for a, b in zip(PATH, PATH[1:]):
    if a['sect'] == 'lowroad' or b['sect'] == 'lowroad':
        continue
    if b['x0'] > a['x1']:
        mx = (a['x1'] + b['x0']) // 2
        arc(min(a['y'], b['y']) - 2, mx - 1, mx + 1)

# the spark's own breadcrumb over the ki gap: straight and rising where every
# other arc in the room is a curve
near, far = PATH[4], PATH[5]
for i, x in enumerate(range(near['x1'] + 1, far['x0'])):
    arc(near['y'] - 1 - (i // 3), x, x)

rows = [''.join(r) for r in g]
for i, r in enumerate(rows):
    assert len(r) == W, f'row {i} is {len(r)}'

defn = """  // 2 · THE FAMINE — every lit thing became a spent thing. The ground does
  // not give the breath back: this room is built of DRANK stone (`=`), which
  // carries you and refunds nothing, and `deadLight` means its sconces save
  // your place and hand you nothing either. Live stone is the scarce thing,
  // and the room is the business of routing between the little of it there is.
  //
  // A shallow W — down, up, down, up — so a walk-back after a theft is short.
  // Unlike THE WICK this room has a floor: the LOW ROAD at row 26 is drank
  // from end to end, catches every miss, and gives nothing back. Falling costs
  // your position and your breath, never your life, and the way off it is a
  // twelve-beat legs-only climb. Safe and slow, against fast and exposed.
  //
  // The moths are the other half. A snuffer takes a CHARGED spark and leaves
  // you standing — so in a room with no refills, carrying the spark is itself
  // the difficulty, and the climax is one breath walked past two of them.
  {
    glyph: 'famine',
    chambers: [21, 43, 65],
    deadLight: true,
    // the beat clock: 2 / 3 / 4 pulses, phases on the quarter-pulse
    shuttles: [
      // asleep on the wall past the first live stone since the threshold —
      // walk near, it wakes, drinks the breath, and the stone you refilled at
      // is eight tiles behind you. Cheap, legible, complete (grammar §1.3)
      { x0: 64, y0: 10, x1: 71, y1: 10, period: 1.7, phase: 0, snuff: true },
      // TEN: this one patrols the only live stone on the crossing, so the
      // refill point is the dangerous point
      { x0: 77, y0: 10, x1: 82, y1: 10, period: 2.55, phase: 0.25, snuff: true },
      // KETSU: the last corridor, where the spark has to survive the walk
      { x0: 80, y0: 7, x1: 86, y1: 7, period: 3.4, phase: 0.5, snuff: true },
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
start = s.index('  // 2 · THE FAMINE')
end = s.index('  // 3 · THE LAST SHIFT')
io.open(p, 'w', encoding='utf-8').write(s[:start] + out + s[end:])

print(f'THE FAMINE · {HGT} rows x {W} · {len(PATH)} shelves')
live = sum(1 for p in PATH if p['ch'] == '#')
print(f'  live shelves {live} / {len(PATH)} — the rest is drank\n')
print('  sect       from       to        gap  xjump  rise  stone  note')
for a, b in zip(PATH, PATH[1:]):
    if a['sect'] == 'lowroad' or b['sect'] == 'lowroad':
        continue
    gap = (b['x0'] - a['x1'] - 1) if b['x0'] > a['x1'] else (a['x0'] - b['x1'] - 1)
    print(f"  {b['sect']:<9}  ({a['x0']:>2},{a['y']:>2})   ({b['x0']:>2},{b['y']:>2})"
          f"   {gap:>3}  {(gap + 1) / MAXJ:>5.2f}  {a['y'] - b['y']:>+4}"
          f"   {'live' if b['ch'] == '#' else 'dry ':<5}  {b['note']}")
print()
print('    ' + ''.join(str(i // 10 % 10) for i in range(W)))
print('    ' + ''.join(str(i % 10) for i in range(W)))
for i, r in enumerate(rows):
    print(f'{i:3d} {r}')
