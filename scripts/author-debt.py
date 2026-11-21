"""THE DEBT -- the ledger, read both ways (v7, 2026-11-21). 66 x 15.

One course of stone runs the room: THE PAGE (row 7). Over it gravity is down
(the debit side, a corridor five courses tall under a roof); under it
gravity is UP (the credit side, `^`, five courses over a floor). Both faces
are floors. The route reads the page forward along the top, turns at the far
end, and reads it back along the underside to the stone, which sits under the
spawn, in plain sight from the first frame. One corridor out, one corridor
back, and nothing else to choose: every column off the route is stone, or
lethal on sight.

The whole band is 15 courses tall, so the camera holds both faces at once
from anywhere in the room. Nothing is ever landed on blind, before a flip or
after one.

Gravity is drawn (src/game/vault.ts, the gravity field): turned air is tinted
cyan with chevrons crawling up, down air near a seam carries gold chevrons
pointing down, every seam is a bright line, streaks fall the way each side
pulls, and crossing a seam turns the body's drawing over, rings it and plays
a glide. Every flip in the room is visible before the body reaches it.

The route, forward along the top (debit, left to right):

 I . THE FIRST LIFT (columns 0-21)                       -- the rule, safe
   1  Spawn on the page. A block stands on it three courses high and the roof
      is too close above it to climb: the corridor is shut except for the
      cyan band hung under the roof from just before the block to just past
      it. Jump into the band and it takes you up onto the roof; walk over the
      block hanging from the roof; walk out of the band and you fall back to
      the page. Nothing here can kill you; a short jump lands where it left.
   2  The first light (L1, debit), where the band lets you down.
   3  T1, a piston out of the roof. Go when it lifts.
II . THE WOUND (22-43)                                   -- the rule, tested
   4  Ten columns of fangs stand on the page, too long to jump or spark. The
      cyan band hangs under the roof again, one column before them to two
      past. Jump in and cross hanging from the roof, past two plumb bolts
      (half a beat apart) and one stand of fangs hung from the roof between
      them: hop it. A short hop stays in the band; a full jump leaves it and
      falls onto the fangs.
   5  Walk out of the band and fall to the page. The second light (L2,
      debit), on the cut.
III . THE CLOSING (44-65): nothing new, no light (P4)    -- combined
   6  T2 out of the roof.
   7  G2, two columns of fangs on the page, straight in front of an ankle
      bolt's rail: a full jump from the lip lands between them.
   8  Hop the ankle bolt.
   9  THE TURN. The page ends at the far wall in a hole, and under the hole a
      chute of down air (gold) runs three courses into the credit side. Walk
      in, fall, and the seam at the chute's foot catches you; drift left out
      of the chute and you fall up onto the underside.

...and back along the underside (credit, right to left), the same page read
the other way:

III' 10  B1 out of the floor (the drift out of the turn stops short of it).
     11  B2 out of the floor under T2, half a beat from it.
II'  12  The third light (C1, credit), on its plinth under L2.
     13  The wound from beneath. Ten columns of fangs hang under the page, and
         a band of DOWN air lies along the floor under them, the roof band's
         mirror: jump away from the page into it and you fall onto the floor.
         Cross standing on the floor past the same two plumb bolts, met
         rising instead of falling, and hop a stand of fangs on the floor. A
         full jump leaves the band and falls up into the fangs.
     14  Walk out of the band at its far end and fall up to the page.
I'   15  THE PRICE. The fourth light (C2, credit) sits at a door high in a
         wall across the underside. The door wants three lights and the room
         has two on each face, so it can be paid only by reading both. Door
         masonry carries no gravity of its own, so the paid doorway is a cell
         of down air: walk into it and you drop into the stone's room, which
         is down air throughout.
     16  The stone, a kneeling keeper beside it, under where you came in.

A credit light stands on a plinth because a sconce tile carries no gravity
either: hung bare in the up field it would be a one-tile hole of down air,
and a body re-formed there would hover at the hole's foot. On the plinth it
re-forms standing, and steps off into the field.
What v7 cut from v6 (docs/vault-debt.md): the hub and its branches (the
pocket Q over the page, its mirror Q', the pair of pistons in their lids, the
"either order" choice), the first leaf's two holes, the closing's two
corridors and their walls, all the open sky above the page and the open
credit side under it, the walk-in turns that only bobbed, and the tear G1
and floor piston B3 tried during v7 (both crowded the band's exits). Turns
are now chutes and bands you can see before you reach them.
"""
import io

W, HGT = 66, 15
PULSE = 0.85
PAGE = 7           # the page
ROOF = 1           # the roof's underside course (rows 0-1 are stone)
FLOOR = 13         # the credit side's floor (rows 13-14 are stone)

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


# --- the band: roof, page, floor, the two end walls --------------------------
block(0, W - 1, 0, ROOF)
block(0, W - 1, FLOOR, HGT - 1)
block(0, 0, 0, HGT - 1)
block(W - 1, W - 1, 0, HGT - 1)
run(1, W - 2, PAGE)
block(1, W - 2, PAGE + 1, FLOOR - 1, '^')       # the credit side falls up

TOP = (ROOF + 1, PAGE - 1)                       # rows 2-6
UNDER = (PAGE + 1, FLOOR - 1)                    # rows 8-12

# === I . the first lift (0-21) ===============================================
put(2, PAGE - 1, '@')
put(6, PAGE - 1, 'K')                            # reaching up: the answer is above
block(8, 10, 4, PAGE - 1)                        # the block on the page
block(5, 11, ROOF + 1, 4, '^')                   # the band under the roof...
block(8, 10, 4, 4, '#')                          # ...over the block, two deep
put(14, PAGE - 1, 'S')                           # L1, where the band lets you down
put(17, PAGE - 1, 'F')                           # fallen short of the piston
# under it: the stone's room, down air, behind the door
block(1, 12, UNDER[0], UNDER[1], '.')
block(13, 13, UNDER[0], UNDER[0] + 1, '1')       # the door, high in its wall: three lights
block(13, 13, UNDER[0] + 2, UNDER[1])
put(14, PAGE + 2, 'S')                           # C2, on its plinth, at the door
put(14, PAGE + 3, '#')
put(3, FLOOR - 1, 'M')
put(5, FLOOR - 1, 'N')                           # kneeling: the ledger closed

# === II . the wound (22-43) ==================================================
WOUND = (29, 38)
run(WOUND[0], WOUND[1], PAGE - 1, 'X')           # fangs up off the page...
run(WOUND[0], WOUND[1], PAGE + 1, 'X')           # ...and down off its underside
block(28, 40, ROOF + 1, 4, '^')                  # the roof's band
block(28, 40, 10, FLOOR - 1, '.')                # the floor's band (down air)
put(34, ROOF + 1, 'X')                           # a stand hung from the roof
put(34, FLOOR - 1, 'X')                          # ...and its mirror on the floor
put(43, PAGE - 1, 'S')                           # L2, past the wound
put(43, PAGE + 2, 'S')                           # C1, on its plinth, under it
put(43, PAGE + 3, '#')

# === III . the closing (44-65): nothing new, no light ========================
run(52, 53, PAGE - 1, 'X')                       # G2, on the page only
run(63, 64, PAGE, '.')                           # the turn's hole...
block(63, 64, PAGE + 1, PAGE + 3, '.')           # ...and its chute of down air

CRUSHERS = [
    # (x, y, w, h, dx, dy, pulses, phase)
    (19, ROOF, 2, 1, 0, 5, 4, 0.0),              # T1, out of the roof
    (48, ROOF, 2, 1, 0, 5, 4, 0.0),              # T2
    (48, FLOOR, 2, 1, 0, -5, 4, 0.5),            # B2, out of the floor under it
    (55, FLOOR, 2, 1, 0, -5, 4, 0.25),           # B1, under the ankle bolt's near end
]

SHUTTLES = [
    # (x0, y0, x1, y1, pulses, phase)
    (31, ROOF + 1, 31, PAGE - 1, 3, 0.0),        # plumb bolts over the wound, half a beat apart,
    (38, ROOF + 1, 38, PAGE - 1, 3, 0.5),
    (31, PAGE + 1, 31, FLOOR - 1, 3, 0.5),       # ...and their mirrors under it: the same
    (38, PAGE + 1, 38, FLOOR - 1, 3, 0.0),       # bolt read from the other face
    (56, PAGE - 1, 59, PAGE - 1, 2, 0.0),        # the ankle bolt along the page
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
  // page, runs a closed band: over it gravity is down, under it up, and both
  // faces are floors. Forward along the top: a band of up air under the roof
  // lifts you over a block (the rule, safe), then over the wound, ten columns
  // of fangs on both faces, past two plumb bolts; a piston, fangs and an ankle
  // bolt; the turn, a chute of down air at the far wall. Back along the
  // underside, the same page read the other way: floor pistons, the wound
  // crossed on a band of down air along the floor, and a door priced in both
  // sides' lights that drops you onto the stone's floor, under the spawn.
  {
    glyph: 'debt',
    chambers: [21, 43],
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
