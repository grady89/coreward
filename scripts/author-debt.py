"""THE DEBT -- the ledger, read both ways (2026-11-20). 66 x 45.

One course of stone runs the length of the room in open sky: THE PAGE.
Everything over it falls down (the debit side); everything under it falls
UP (the credit side, `^`). Both faces of the page are floors, so every
stretch of it is walked twice, once on each side, and the same piston or
bolt is a different problem depending on which face you are reading it from.
The holes in the page are the TURNS between sides.

How the seam really behaves (measured in the real body, scripts/vaultplay):
crossing into a gravity that calls your motion "rising", with jump released,
cuts the speed to 0.45 -- the engine's variable-jump cut. So a body that
WALKS into a turn only bobs in the hole. Jump into it, or press jump while
in it, and you come out the other side. That is the room's first rule, and
the first leaf exists to teach it.

The route, beat by beat (motes drift with whatever gravity they are in, so
the credit side reads as rising dust):

 A . THE FIRST LEAF (columns 0-21)
   1  Spawn on the page. A wall and its lid shut the top of the leaf, so the
      way on is under. Jump into G1 (x 6-7): DOWN through the hole, caught by
      the credit side, steer under the lip and stand on the page's underside.
   2  Walk the underside to the first light, hung under the page. Only
      up-gravity stands there (credit light).
   3  Dive up through G2 (x 15-16): from the underside, jump away from the
      page (world-down), fall back UP through the hole with speed and steer
      onto the top beyond the wall. Walking in and pressing jump kicks off
      the hole's lip and works too.

 B . THE HUB (22-43): the page, a pocket over it, its mirror under it, the
     door. Branches in either order.
   4  Hop G3 into the hub (fall short and you are under the page: a turn).
   5  THE HOOK. Pocket Q hangs over the page: up-gravity air under a lid.
      The page beneath it carries a bolt at ankle height, so it is crossed
      on TAPS: a full jump under Q is a different verb. Jump held from
      under Q and the arc crosses into up-gravity a course and a half up
      and falls UP onto the lid's underside. The light hangs on that
      ceiling (credit light: only up-gravity reaches it). The pocket's one
      exit is under P_up, a piston out of the lid. Wait at its edge for it
      to come home, walk out under it, off the pocket's lip, and the debit
      side drops you back on the page.
   6  Down through G3 to the page's underside.
   7  THE MIRROR HOOK. Q' hangs under the page: down-gravity air inside the
      credit side, over a floor. Tap the underside's bolt (credit taps go
      world-down), jump "up" over Q' and fall DOWN onto its floor. That
      light stands on the floor (debit light: only down-gravity reaches
      it). P_down guards the exit, out of the floor, half a beat from P_up:
      the same pair of pistons, opposite phase, both sides of the ledger
      paid. Walk out over it and fall up to the page's underside.
   8  Dive up through G3.
   9  THE PRICE. The door wants three lights, and before it the room holds
      two credit lights and one debit light. Three cannot be paid from
      either side alone. Cross the page under Q on taps, through the door,
      and the gate light behind it is the closing's checkpoint.

 C . THE CLOSING (44-65): the page between two corridors, pistons out of
     the roof (T, debit) and out of the floor (B, credit), half a beat apart,
     the page turned twice. Nothing here the hub has not shown (P4).
  10  T1 from the roof: go when it lifts. Turn down through g1, which a
      plumb bolt runs through roof to floor: drop on its far side or
      between strokes, and stand on the underside short of B2.
  11  B2 out of the floor: go when it lifts, to the rest by g2.
  12  Dive up through g2 past ITS plumb bolt (half a beat from g1's): the
      same bolt read the other way, met rising instead of falling. The far
      side of the hole is the safe line.
  13  T2, and the stone, kneeling figure beside it.

What the playtest changed (scripts/routes/debt.js runs it green, ~57 s):
   * Turns are jumps. The first cut taught walk-ins; the seam bleeds them.
   * A level rail seats itself on the ground below it, and that rule is
     gravity-blind: the pocket's bolt fell to the page. It stays there as
     the tap-not-jump beat; the underside's bolt is held where it is strung
     by a kerb in Q's floor (uneven ground below leaves a rail as authored).
   * The pocket pistons first sat flush with a hanging body and killed it
     at any extension. They are recessed in three-deep lids now, so they
     have travel before they bite.
   * The first hub put the lights on ledges nine courses over the page,
     outside the camera's ~14.5-course frame: a blind hook. It was
     compressed until the lid, its piston and its light are on screen from
     the page.
   * A sconce tile is a hole of DOWN gravity in a `^` field, so a credit
     light hangs one course clear of the body's own course. It lights at
     0.98 tiles as you walk under it.
   * From the ceiling light you cannot clear P_up in one rest. The exit is
     to wait at the piston's edge.

Open sky (openEdges). The credit side runs to the floor of the map, so a
fall is caught by the seam rather than the void. The teeth here are
pistons, bolts and timing, not drops.
"""
import io

W, HGT = 66, 45
PULSE = 0.85
PAGE = 22          # the page: one course of stone the whole room is read across

g = [['.'] * W for _ in range(HGT)]


def put(x, y, ch):
    assert 0 <= x < W and 0 <= y < HGT, (x, y, ch)
    g[y][x] = ch


def run(x0, x1, y, ch='#'):
    for x in range(x0, x1 + 1):
        put(x, y, ch)


def block(x0, x1, y0, y1, ch='#'):
    for y in range(y0, y1 + 1):
        run(x0, x1, y, ch)


# --- the credit side: everything under the page falls UP ------------------
block(0, W - 1, PAGE + 1, HGT - 1, '^')

# --- the page, end to end, and its turns. A turn's own tile stays debit, so
# the seam sits at the page's underside: dropping in from the top carries a
# body a full course and a half into the credit side
run(1, W - 1, PAGE)
TURNS = [(6, 7), (15, 16), (22, 23), (50, 51), (58, 59)]   # G1 G2 G3 g1 g2
for a, b in TURNS:
    run(a, b, PAGE, '.')

# === A · the first leaf (0-21) ===========================================
put(2, PAGE - 1, '@')
block(11, 11, 13, PAGE - 1)          # the wall across the top of the leaf
run(0, 11, 12)                        # ...and its lid, so it is not climbed
put(9, PAGE + 2, 'S')                 # the light under the leaf (credit)

# === B · the hub (22-43) =================================================
# debit side: the pocket that falls up, under a lid run out to the gatehouse
block(30, 39, 15, 19, '^')            # Q
block(29, 39, 12, 14)                 # its lid, three deep: the piston's well
put(36, 16, 'S')                      # the light on the pocket's ceiling (credit)
put(37, 15, '#')                      # ...and its kerb, the mirror's
# credit side: its mirror, the pocket that falls down, on a floor
block(30, 39, 25, 29, '.')            # Q'
block(29, 39, 30, 32)                 # its floor, three deep
put(37, 29, '#')                      # a kerb past the light: the floor is not
                                      # level, so the bolt strung under the page
                                      # hangs where it is put
put(36, 29, 'S')                      # the light on the mirror pocket's floor (debit)
# the gatehouse: unlight crown (nobody climbs over the price), stone to the
# floor of the sky (nobody goes under it: past the map's foot gravity is
# down again, and the void is waiting), one door at the page
block(40, 41, 0, 9, 'X')
block(40, 41, 10, HGT - 1)
block(40, 41, PAGE - 2, PAGE - 1, '1')
put(42, PAGE - 1, 'S')                # the light behind the door (the closing's checkpoint)

# === C · the closing (44-65) =============================================
run(42, 63, 17)                       # the roof over the top corridor
run(42, 60, 27)                       # the floor under the bottom corridor
block(47, 48, 18, 19)                 # T1 housing
block(62, 63, 18, 19)                 # T2 housing
block(54, 55, 25, 26)                 # B2 housing
block(52, 52, 18, PAGE - 1)           # Wt: the top corridor is shut here
block(60, 60, PAGE + 1, 26)           # Wb: the bottom corridor is shut here
put(65, PAGE - 1, 'M')
put(64, PAGE - 1, 'N')                # kneeling: the ledger closed

# the dead, as signage
put(31, PAGE - 1, 'K')                # reaching up under the pocket: the answer is above
put(46, PAGE - 1, 'F')                # fallen at the first piston: struck from the roof

CRUSHERS = [
    # (x, y, w, h, dx, dy, pulses, phase)
    (30, 12, 2, 2, 0, 3, 4, 0.0),     # P_up: out of the lid, over the pocket's only exit
    (30, 31, 2, 2, 0, -3, 4, 0.5),    # P_down: its mirror, opposite phase
    (47, 18, 2, 2, 0, 2, 4, 0.0),     # T1, out of the roof
    (54, 25, 2, 2, 0, -2, 4, 0.5),    # B2, out of the floor, half a beat off
    (62, 18, 2, 2, 0, 2, 4, 0.0),     # T2
]

SHUTTLES = [
    # (x0, y0, x1, y1, pulses, phase)
    (30, 21, 37, 21, 2, 0.0),         # the bolt along the page under Q
    (30, 23, 37, 23, 2, 0.5),         # ...and along its underside over Q'
    (50, 18, 50, 26, 3, 0.0),         # the plumb bolt through the first turn
    (58, 18, 58, 26, 3, 0.5),         # ...and through the second, half a beat on
]

rows = [''.join(r) for r in g]
for i, r in enumerate(rows):
    assert len(r) == W, f'row {i} is {len(r)}'

shuttles = ',\n'.join(
    "      { x0: %d, y0: %d, x1: %d, y1: %d, period: %.2f, phase: %s }"
    % (a, b, c, d, n * PULSE, ph) for a, b, c, d, n, ph in SHUTTLES)
crushers = ',\n'.join(
    "      { x: %d, y: %d, w: %d, h: %d, dx: %d, dy: %d, period: %.2f, phase: %s }"
    % (x, y, w, h, dx, dy, n * PULSE, ph) for x, y, w, h, dx, dy, n, ph in CRUSHERS)

defn = """  // 7 · THE DEBT — the ledger, read both ways. One course of stone, the
  // page, runs the room in open sky: over it gravity is down, under it up,
  // and both faces are floors. The holes in it are the turns between sides
  // (jumped, never walked: the seam bleeds a body that is not holding on).
  // A hub with a pocket of up-gravity over the page and its mirror, a
  // pocket of down-gravity, under it. The light on the pocket's ceiling only
  // up-gravity reaches, and the light on the mirror's floor only down-gravity.
  // Their pistons are one pair, opposite phase. The door wants three lights
  // when either side alone holds at most two. Past it, two corridors, roof and
  // floor pistons half a beat apart, and the page turned twice through plumb
  // bolts to the stone.
  {
    glyph: 'debt',
    chambers: [21, 43],
    openEdges: true,
    doorNeeds: { '1': 3 },
    shuttles: [
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
out = defn % (shuttles, crushers, body)

p = 'src/world/vaults.ts'
s = io.open(p, encoding='utf-8').read()
start = s.index('  // 7 · THE DEBT')
end = s.index('  // 8 · THE RETURN')
io.open(p, 'w', encoding='utf-8').write(s[:start] + out + s[end:])

print(f'THE DEBT · {HGT} x {W}')
for i, r in enumerate(rows):
    print(f'{i:3d} {r}')
