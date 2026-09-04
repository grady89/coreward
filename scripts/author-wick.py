"""THE WICK — rebuilt as the vertical slice. 56 x 34.

THE TUTORIAL THAT USES NO WORDS. Four chambers, four steps: introduce the
jump, develop it until the spark is the only verb left, twist to the wall,
conclude by recombining all three.

Built by CARVING a hall out of solid rock rather than placing shelves in open
air. A room assembled the other way grows voids nobody meant to author, which
is what the first attempt did — a fourteen-column pit down the right half.

Every distance is a fraction of the MEASURED running jump: 5.45 tiles across,
2.68 up (docs/movement-metrics.md). Gaps are given in empty columns with the
fraction beside them, because "a 4-tile gap" is a number and "a big gap" is
not. Reference: 3 empty = 0.55x, 4 = 0.73x, 5 = 0.92x, 7 = 1.28x (spark only).
"""
import io

W, HGT = 56, 34
g = [['#'] * W for _ in range(HGT)]          # solid rock; we cut into it


def carve(x0, y0, x1, y1):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if 0 < y < HGT - 1 and 0 < x < W - 1:
                g[y][x] = '.'


def floor(y, x0, x1, ch='#'):
    for x in range(x0, x1 + 1):
        g[y][x] = ch


def put(x, y, ch):
    g[y][x] = ch


def arc(y, x0, x1):
    """motes over a gap — the breadcrumb that says a jump goes here"""
    for x in range(x0, x1 + 1):
        if g[y][x] == '.':
            g[y][x] = 'o'


# ===========================================================================
# THE ENVELOPE. One continuous cut: a hall that rises left to right, into a
# chimney, into the reveal. Everything outside it stays rock.
# ===========================================================================
carve(1, 22, 40, 29)        # the hall
carve(34, 18, 40, 29)       # its rising right end
carve(41, 10, 46, 29)       # the chimney — walked into at floor level
carve(41, 3, 54, 10)        # the reveal, overlapping the chimney's top at
                            # row 10 so the two are one continuous space

# THE FLOOR OF FAILURE. One continuous course under the whole hall, so that
# missing ANY jump in A or B costs the same four seconds: you land on stone,
# you walk to a step, you climb back. Uniform recovery is what lets the gaps
# above it be honest.
floor(30, 1, 46)
# ...and every step is on the NEAR side of the teaching gap. A step at col 31
# sits inside the gap's own span, which turns the recovery floor into a
# staircase up the far side: the harness proved the far lip reachable with the
# spark disabled, which is the whole lesson bypassed.
for _sx in (8, 14, 20, 26):               # steps back up every few tiles, so
    floor(29, _sx, _sx)                   # a fall costs three tiles of walking
    floor(28, _sx + 1, _sx + 1)           # and not fifteen

# THE BASIN MUST DEAD-END. A recovery floor that runs the length of the hall is
# not a recovery, it is a bypass: the first cut of this room could be walked
# from the entry to the chimney along the bottom without ever crossing the
# teaching gap, which made the spark optional in the room whose subject is the
# spark — the exact fault the rebuild exists to correct. The far lip's support
# is solid to the floor, so a fall traps you and the only way out is back up
# the steps to try the gap again.
# The far lip is a CANTILEVER: its supporting rock sits at cols 37-40, so the
# four columns under its left end are open air. Wall-jumps are free and
# unlimited in this game, which means any pit with a wall beside it can be
# climbed — the harness proved exactly that, twice. A climber in the basin can
# only find a face at col 37, and the lip itself caps them at row 25. The only
# way ONTO the lip is across the gap, which is the point of the gap.
for _by in range(26, 30):
    floor(_by, 37, 40)

# ===========================================================================
# CHAMBER A · cols 1-13 · INTRODUCE
# The jump, and the fact the whole game rests on: a landing is a launch. Three
# shelves, each a little further than the last, all landable without thinking.
# Nothing here can hurt you. The phrase is jump-jump-jump with no stop in it,
# and the shelves are SHORT so you land near the lip you launch from.
# ===========================================================================
floor(29, 1, 6)                     # the threshold — wide, a breath
put(2, 28, '@')
put(4, 28, 'S')                     # the free light, at your feet
arc(27, 7, 9)                       # 3 empty = 0.55x
floor(28, 11, 13)                   # 0.73x, and two tiles of landing
arc(26, 13, 15)                     # 3 empty, +1 rise = 0.62x
floor(27, 18, 19)                   # 0.85x — the hardest the legs are asked
put(12, 27, 'S')                    # the cut-13 light, standing on the shelf

# ===========================================================================
# CHAMBER B · cols 14-33 · DEVELOP → the spark, discovered by elimination
# ===========================================================================
arc(25, 19, 22)                     # 4 empty = 0.73x — the first HELD jump
floor(26, 24, 26)                   # 0.85x again, on a three-tile shelf

# THE TEACHING GAP · 7 empty columns = 1.28x. It cannot be jumped, and that is
# the point. It is fully visible from the shelf you stand on, its far lip is in
# the same chamber, and three courses below is a basin with a floor and a way
# back out — so being wrong costs about four seconds and no light.
# The motes here run STRAIGHT and rising. Every arc so far has been a curve;
# this one is the shape of a spark, and it is the only instruction given.
for i, x in enumerate(range(27, 34)):
    arc(25 - (i // 3), x, x)
floor(25, 33, 39)                   # the far lip — gap is cols 27-33, SEVEN
                                    # empty = 1.28x. Eight would be 1.47x and
                                    # the 45-degree spark only reaches 8.6.

# THE ECONOMY, stated in two platforms. Drank stone carries you and gives
# nothing back, so you land here with the spark still spent and the next gap
# must go on legs alone — which it can, at 0.66x. No text required.
arc(24, 40, 42)
floor(24, 36, 38, '=')      # drank: carries you, refunds nothing
put(32, 25, 'S')                    # the cut-33 light, over the teaching gap

# ===========================================================================
# CHAMBER C · cols 34-45 · TWIST — the wall
# The hall stops dead. The only way on is up a chimney three columns wide, and
# the only verb that climbs it is one the room has not yet asked for. Kick
# ledges sit 3 courses apart — one wall-jump is 2.68, so each is a single kick.
# A brazier hangs halfway: the safe line is four kicks, the greedy line is a
# spark off the brazier straight to the top, skipping two.
# ===========================================================================
# the shaft stands ON the hall's own floor — you walk into it, you do not
# drop into it, and the way up is the only way on
floor(26, 41, 42)                   # kick ledges, alternating walls, each a
floor(22, 45, 46)                   # single wall-jump apart (2.68 per kick)
floor(18, 41, 42)
floor(14, 45, 46)
put(44, 20, '*')                    # the brazier — refill in mid-air, and the
                                    # greedy line: spark from here past two
                                    # ledges straight to the top
arc(25, 43, 45)
arc(16, 43, 44)
floor(11, 41, 42)                   # the chimney's top landing, on the left

# ===========================================================================
# CHAMBER D · cols 46-54 · CONCLUDE — density of the known, and no sconce
# One held jump, one spark, and the stone. Nothing new. It ends ABOVE where it
# began, which no other room in the game does.
# ===========================================================================
put(45, 10, 'S')                    # the cut-45 light, on the chimney's lip
floor(11, 45, 54)                   # the reveal's floor — cols 43-44 stay open
                                    # as the light well the shaft climbs through
arc(9, 48, 50)                      # 3 empty, +2 rise: the last held jump
floor(8, 51, 54)
arc(6, 50, 52)
# THE UNLIGHT, chamber D only. Chambers A, B and C keep their promise that
# nothing there can hurt you; the room's last two jumps are the only ones in
# the tutorial that cost more than four seconds, which is how a tutorial ends
# with stakes without opening with them.
floor(10, 48, 49, 'X')
floor(9, 52, 53, 'X')

put(53, 7, 'M')
put(51, 7, 'K')                     # one still reaching, at the top

rows = [''.join(r) for r in g]
for i, r in enumerate(rows):
    assert len(r) == W, f'row {i} is {len(r)}'

defn = """  // 1 · THE WICK — the tutorial that uses no words. Four chambers, four
  // steps. A introduces the jump and the fact the game rests on: a landing is
  // a launch. B develops it until the spark is the only verb left, over a
  // basin that makes being wrong cost four seconds instead of a life, then
  // states the light economy in two platforms of drank stone. C is the twist
  // — the hall stops dead and the only way on is a wall. D recombines all
  // three and ends ABOVE where it began, which no other room does.
  //
  // Distances are fractions of the MEASURED running jump: 5.45 tiles across,
  // 2.68 up (docs/movement-metrics.md). The teaching gap is 1.28x — it cannot
  // be jumped, which is the whole of the lesson.
  {
    glyph: 'wick',
    chambers: [13, 33, 45],
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
s = s[:start] + out + s[end:]
io.open(p, 'w', encoding='utf-8').write(s)

print('THE WICK ·', len(rows), 'rows x', W, '· chambers at 13 / 33 / 45\n')
print('    ' + ''.join(str(i // 10 % 10) for i in range(W)))
print('    ' + ''.join(str(i % 10) for i in range(W)))
for i, r in enumerate(rows):
    print(f'{i:3d} {r}')
