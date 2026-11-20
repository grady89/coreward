"""THE RETURN — the cradle, in one breath. 220 x 46, open sky, ten chambers.

"If you have the strength to carry it out, you have the strength to carry it
back." The glyph is a cradle: up the left limb, over the crown, down the
right. The room is that stroke drawn in thirty-nine jumps, and there is NO
sconce anywhere in it. The only light that holds you is the one you came in
by, so the return is not the way home. It is where a miss sends you. Fall
from any jump, the first or the thirty-ninth, and you re-form at the
threshold beside the keeper who knelt there, with the whole stroke to walk
again.

That makes fairness the entire job. Every jump below was measured in the
real body from the footing before it (scripts/routes/return.js plays the
whole stroke; the take-off windows are in docs/vault-return.md). None asks
for one frame, every landing is inside the frame you jump from (the cuts
fall on footings you walk across: `BLIND` below proves it), and the arcs
that need reading are traced in motes.

Distances: gap = open tiles between the footings, rise = courses up.
The units are the measured body (docs/movement-metrics.md): running jump
5.45 across and 2.68 up, a kick 2.68 up, a 45-degree spark 8.6 fired early
and 12.7 fired late.

I · THE THRESHOLD (0-21) — the first sentence, and a chimney
   1  threshold -> first      running jump, gap 3, level
   2  first -> second         running jump, gap 2, rise 2
   3  second -> the chimney   running jump under the left wall, 3 across to
                              the far wall of a 2-wide shaft
   4-7                        four kicks, wall to wall
   8                          the fifth kick crests the right wall: crest,
                              12 above second
II · THE STAIR (22-43) — spark out, spark up, climb dry
   9  crest -> post           run + 45-degree spark, gap 7, level, onto a
                              1-wide post inside the spark's carry
  10  post -> dry step        standing jump + 45-degree spark, gap 4, rise 4,
                              onto DRANK stone: the spark stays spent
  11  dry step -> the wall    running jump, gap 3, onto a single wall
  12-14                       three kicks up it: kick out, steer back
  15                          the fourth crests onto the high step (drank),
                              8 above the dry step, still no spark
III · THE CROWN (44-65) — the long jump, and the low road
  16  high step -> far lip    full-length running jump, gap 5 (0.92x), level,
                              with no spark to save it
  17  far lip -> low a        short hop, gap 2, under a roof hung with unlight:
                              three clear rows, so a held jump is a death
  18  low a -> low b          short hop, gap 2 (all three of these are drank)
  19  low b -> causeway       short hop out from under the roof, gap 1
IV · THE CAUSEWAY (66-87) — full-length jumps, still without the spark
  20  causeway -> post two    full-length running jump, gap 5, level
  21  post two -> post three  running jump, gap 4, rise 2
  22  post three -> turn step running jump, gap 5, drop 2, onto live stone:
                              the spark comes back after twelve jumps without
V · THE TURN (88-109) — the reversal, and the bolt
  23  turn step -> the wall   running jump, 3 across, into the turning wall
  24                          kick BACK off it, left, up onto the hook,
                              4 above the step
  25  hook -> over            standing jump + 45-degree spark up and over the
                              wall's top, gap 4, rise 3, onto drank stone
  26  over -> bridge stone    running jump, gap 3, through a plumb bolt
  27  bridge stone -> a1      hop, gap 2, drop 2, onto a half-time bridge
  28  a1 -> island            gap 2, level, before it goes out
VI · THE BRIDGES (110-131) — a stair on the half-beat
  29  island -> b1            running jump, gap 3, rise 2
  30  b1 -> a2                gap 3, level
  31  a2 -> b2                gap 2, rise 2
  32  b2 -> perch             gap 2, level, onto drank stone; the perch is
                              four courses over the island, which is what
                              keeps a late spark from skipping the stair
VII · THE LANTERN (132-153) — ride the light over what no jump crosses
  33  perch -> the lantern    catch the crown at the near end of its swing,
                              about 2.5 out and 1.3 down
  34  ride -> lantern lip     leap off the far end + 45-degree spark (the
                              crown relights it), 6.5 across. Perch to lip is
                              14: nothing reaches it without the ride.
VIII · THE FALL (154-175) — a needle, and the brazier's second breath
  35  lantern lip -> needle   run off, gap 4, drop 6, onto a 1-wide needle
  36  needle -> far ledge     standing jump + spark up; the brazier relights it
                              in the air; spark again: gap 13, drop 2
IX · THE VENT (176-197) — spark down onto drank stone, ride the draught
  37  far ledge -> sill       run + late flat spark, gap 9, drop 7, onto drank
                              stone: arrive spent
  38  sill -> vent lip        walk off into the draught, brake, ride it to its
                              cap, steer out: rise 5, and the only way up
X · THE LAST (198-219) — the stone at the end of the longest reach
  39  vent lip -> the stone   run + late 45-degree spark (down), gap 11,
                              drop 8, onto the stone's own 1-wide post

The kit's spark ledger, walked: live stone refunds (the threshold to the
crest, the turn step, the hook, the bridges, the lantern's crown), drank
stone `=` withholds (the dry step and everything from the high step to the
causeway's last post: twelve jumps, the long ones among them, with no
correction), the brazier refunds in the air (36), and the vent only
carries (38). Skips the playtest found
and closed: the low road's roof and the vent's cap were standable (unlight
on both now), the island reached the perch on a late spark (the stair now
climbs four courses), and the over ledge reached the island (it is drank).
"""
import io
import json
import sys

W, HGT = 220, 46
PULSE = 0.85

g = [['.'] * W for _ in range(HGT)]
FOOT = []          # the footings, in route order: (name, x0, x1, r)


def put(x, y, ch):
    assert 0 <= x < W and 0 <= y < HGT, (x, y, ch)
    g[y][x] = ch


def run(x0, x1, y, ch='#'):
    for x in range(x0, x1 + 1):
        put(x, y, ch)


def block(x0, x1, y0, y1, ch='#'):
    for y in range(y0, y1 + 1):
        run(x0, x1, y, ch)


def foot(name, x0, x1, r, ch='#'):
    run(x0, x1, r, ch)
    FOOT.append((name, x0, x1, r))


def motes(pts):
    for x, y in pts:
        if g[y][x] == '.':
            put(x, y, 'o')


# ---- I · THE THRESHOLD: the first sentence, and the chimney -------------
foot('threshold', 1, 5, 42)
put(2, 41, '@')
put(4, 41, 'N')                       # kneeling, lamp set down: every return comes back to her
foot('first', 9, 10, 42)
foot('second', 13, 15, 40)
block(16, 16, 24, 34)                 # chimney, left wall
block(19, 19, 29, 41)                 # chimney, right wall (its top is the crest)
foot('crest', 19, 24, 28)

# ---- II · THE STAIR: spark onto a post, spark up, climb dry --------------
foot('post', 32, 32, 28)
block(32, 32, 29, 31)
foot('dry step', 37, 39, 24, '=')
block(43, 43, 17, 27)                 # the single wall
foot('high step', 43, 47, 16, '=')

# ---- III · THE CROWN: the long jump, and the low road --------------------
foot('far lip', 53, 55, 16, '=')
run(56, 64, 10, 'X')                  # unlight ON the roof, so nobody walks it...
run(56, 64, 11)                       # ...the low road's roof...
run(56, 64, 12, 'X')                  # ...and the unlight hung under it
foot('low a', 58, 59, 16, '=')
foot('low b', 62, 63, 16, '=')

# ---- IV · THE CAUSEWAY: full-length jumps on drank posts, and no spark ----
foot('causeway', 65, 67, 16, '=')
foot('post two', 73, 74, 16, '=')
foot('post three', 79, 80, 14, '=')
foot('turn step', 86, 88, 16)

# ---- V · THE TURN: kick back off the wall, spark up and over it ---------
block(92, 92, 8, 22)                  # the turning wall
foot('hook', 87, 88, 12)
foot('over', 93, 95, 9, '=')
put(96, 2, '#')                       # the bolt's cap: it hangs plumb at the lip
foot('bridge stone', 99, 101, 9)
foot('bridge a1', 104, 105, 11, 'A')
foot('island', 108, 112, 11)

# ---- VI · THE BRIDGES: a stair on the half-beat ---------------------------
foot('bridge b1', 116, 117, 9, 'b')
foot('bridge a2', 121, 122, 9, 'A')
foot('bridge b2', 125, 126, 7, 'b')
foot('perch', 129, 133, 7, '=')
put(133, 6, 'K')                      # reaching: the lantern is the answer, and he was short

# ---- VII · THE LANTERN: ride the light over what no jump crosses ----------
foot('lantern lip', 148, 154, 8)

# ---- VIII · THE FALL: a needle, and the brazier's second breath -----------
foot('needle', 159, 159, 14)
block(159, 159, 15, 16)
put(167, 11, '*')
foot('far ledge', 173, 178, 16)

# ---- IX · THE VENT: spark down onto drank stone, ride the draught up ---
foot('sill', 188, 189, 23, '=')
run(190, 192, 13, 'X')                # unlight on the cap: it is not a floor
run(190, 192, 14)                     # the vent's cap
put(191, 33, '#')                     # and its floor stone
foot('vent lip', 194, 199, 18)

# ---- X · THE LAST ---------------------------------------------------------
foot('the return', 211, 211, 26)      # the stone's post: the last reach lands on it
block(211, 211, 27, 29)
put(211, 25, 'M')

# ---- motes: the arcs worth reading before you commit (taken from the
# ---- route's own trajectories, a course over the head at the apex) ---------
motes([(27, 22), (28, 22), (29, 22)])               # 9   the spark to the post
motes([(34, 23), (35, 22)])                         # 10  and up to the dry step
motes([(49, 11), (50, 11), (51, 11)])               # 16  the long jump
motes([(69, 11), (70, 11), (71, 11)])               # 20  the causeway's long jump
motes([(90, 6), (91, 6), (92, 6)])                  # 25  up and over the wall
motes([(144, 2), (145, 2), (146, 2)])               # 34  off the lantern
motes([(156, 9), (157, 11)])                        # 35  the drop to the needle
motes([(162, 9), (164, 8), (170, 7), (171, 7)])     # 36  either side of the brazier
motes([(181, 11), (183, 12), (185, 15)])            # 37  down to the sill
motes([(202, 13), (204, 14), (207, 18), (209, 21)])  # 39  the last reach

CENSERS = [
    # x, y, len, arc, pulses, phase
    (139, 7, 3.0, 0.95, 3, 0.0),
]
SHUTTLES = [
    # x0, y0, x1, y1, pulses, phase — plumb at the lip of 'over'
    (96, 3, 96, 8, 2, 0.0),
]
CURRENTS = [
    # x0, y0, x1, y1, force — capped above (14) and floored below (33)
    (190, 15, 192, 32, 46),
]
CHAMBERS = [21, 43, 65, 87, 109, 131, 153, 175, 197]

rows = [''.join(r) for r in g]
for i, r in enumerate(rows):
    assert len(r) == W, f'row {i} is {len(r)}'


def chamber(x):
    for i, c in enumerate(CHAMBERS):
        if x <= c:
            return i
    return len(CHAMBERS)


# Read-ahead (principles §3): every jump leaves and lands inside ONE frame.
# A footing that straddles a cut is walked across it first, so the frame has
# already cut to the landing's chamber before the jump is asked for.
BLIND = []
for (na, a0, a1, ra), (nb, b0, b1, rb) in zip(FOOT, FOOT[1:]):
    ka = set(range(chamber(a0), chamber(a1) + 1))
    kb = set(range(chamber(b0), chamber(b1) + 1))
    if not ka & kb:
        BLIND.append(f'{na} -> {nb}')
assert not BLIND, BLIND
widths = [c - p for p, c in zip([-1] + CHAMBERS, CHAMBERS + [W - 1])]
assert max(widths) <= 22, widths

DEF = {
    'glyph': 'return',
    'chambers': CHAMBERS,
    'openEdges': True,
    'censers': [{'x': x, 'y': y, 'len': ln, 'arc': arc, 'period': round(n * PULSE, 4), 'phase': ph}
                for x, y, ln, arc, n, ph in CENSERS],
    'shuttles': [{'x0': a, 'y0': b, 'x1': c, 'y1': d, 'period': round(n * PULSE, 4), 'phase': ph}
                 for a, b, c, d, n, ph in SHUTTLES],
    'currents': [{'x0': a, 'y0': b, 'x1': c, 'y1': d, 'force': f} for a, b, c, d, f in CURRENTS],
    'map': rows,
}

if '--foot-js' in sys.argv:          # the footing table scripts/routes/return.js carries
    print('{ ' + ', '.join(f"'{n}': [{a}, {b}, {r}]" for n, a, b, r in FOOT) + ' }')
    sys.exit(0)

if '--json' in sys.argv:             # the def as JSON, for injecting into a live run
    out = dict(DEF)
    out['_foot'] = [{'name': n, 'x0': a, 'x1': b, 'r': r} for n, a, b, r in FOOT]
    io.open(sys.argv[sys.argv.index('--json') + 1], 'w', encoding='utf-8').write(json.dumps(out))
    print('json written')
    sys.exit(0)

censers = ',\n'.join(
    "      { x: %d, y: %d, len: %.1f, arc: %.2f, period: %.2f, phase: %s }"
    % (x, y, ln, arc, n * PULSE, ph) for x, y, ln, arc, n, ph in CENSERS)
shuttles = ',\n'.join(
    "      { x0: %d, y0: %d, x1: %d, y1: %d, period: %.2f, phase: %s }"
    % (a, b, c, d, n * PULSE, ph) for a, b, c, d, n, ph in SHUTTLES)
currents = ',\n'.join(
    "      { x0: %d, y0: %d, x1: %d, y1: %d, force: %d }" % cu for cu in CURRENTS)

defn = """  // 8 · THE RETURN — the cradle, in one breath. "If you have the strength
  // to carry it out, you have the strength to carry it back." Up the left
  // limb (a chimney, a spark to a post, a dry climb), over the crown (the
  // long jump, the low road under unlight, a causeway of drank posts, a wall
  // you kick back off and spark over), up a stair of half-time bridges,
  // across on the lantern,
  // and down the right limb (a needle, the brazier's second breath, a
  // draught that is the only way up) to the stone on its own post at the end
  // of the longest reach. Thirty-nine jumps and NO sconce: the only light
  // that holds you is the one you came in by, and the keeper kneeling beside
  // it. The return is not the way home. It is where a miss sends you.
  //
  // Open sky (openEdges): there is nothing under any of it. Authored by
  // scripts/author-return.py, proved by scripts/routes/return.js.
  {
    glyph: 'return',
    chambers: [%s],
    openEdges: true,
    censers: [
%s
    ],
    shuttles: [
%s
    ],
    currents: [
%s
    ],
    map: [
%s
    ],
  },
"""
body = ',\n'.join("      '" + r + "'" for r in rows)
out = defn % (', '.join(str(c) for c in CHAMBERS), censers, shuttles, currents, body)

p = 'src/world/vaults.ts'
s = io.open(p, encoding='utf-8').read()
start = s.index('  // 8 · THE RETURN')
end = s.index('  // 9 · THE KINDLED')
io.open(p, 'w', encoding='utf-8').write(s[:start] + out + s[end:])

print(f'THE RETURN · {HGT} x {W} · chambers {widths} · {len(FOOT)} footings')
for (na, a0, a1, ra), (nb, b0, b1, rb) in zip(FOOT, FOOT[1:]):
    gap = b0 - a1 - 1 if b0 > a1 else a0 - b1 - 1
    print(f'  {na:>12} -> {nb:<12} gap {gap:3d}  rise {ra - rb:+d}  width {b1 - b0 + 1}')
for i, r in enumerate(rows):
    print(f'{i:3d} {r}')
