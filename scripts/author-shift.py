"""THE LAST SHIFT — built to the drawing (2026-09-05). 52 x 64.

    start --> storey 1 --> [down]      a SWITCHBACK DESCENT: four storeys,
    storey 2 <-- ride the lanterns     three downdraft shafts, and the stone
    [down] --> storey 3 A/B -->        at the bottom of the last one's turn
    finish <-- [down]

Built the way THE WICK and THE FAMINE are built (openEdges): open sky, floors
laid into it, unseen `_` planes eight courses under each storey with holes
where the shafts pass. The drawing's X is dead space and none of it is drawn.

THE OBSTACLES, to the drawing:

  * 360 ROTATING LASERS — spin watch-lights: two over storey 1 (one hanging
    from a mount stone, one STANDING on a post mid-storey) and one over the
    finish approach. Stone is cover: the start pillar and the L-block are
    for hiding behind while the light looks at you.
  * SWINGING LANTERNS YOU STAND ON — storey 2 has NO floor: the crossing is
    ridden censer to censer, apex to apex, right to left.
  * SHELVES THAT FADE IN AND OUT — light bridges, groups A/b cycling in
    opposition: four hops across storey 3, one more breath of A on the way
    to the stone.
  * DOWNDRAFTS — the descent shafts blow DOWN (negative current force, the
    engine's mirror of the famine's road up). The first pours onto the safe
    block, run out wide (v6: the first wind teaches the fall); the last
    pours onto a spiked shelf, and the steer out of the wind onto the safe
    stone beside it is the whole of the landing.

Distances are fractions of the MEASURED running jump (5.45 across, 2.68 up —
docs/movement-metrics.md). Every gap is a crossing of at most 6 tiles.
"""
import io
import math

W, HGT = 52, 64
PULSE = 0.85

g = [['.'] * W for _ in range(HGT)]          # open sky, and the storeys float in it
LEFT, RIGHT = 2, W - 3

F = [10, 26, 42, 58]        # storey floors, top to bottom
FALL = 8


def put(x, y, ch):
    g[y][x] = ch


def run(x0, x1, y, ch='#'):
    for x in range(x0, x1 + 1):
        put(x, y, ch)


def block(x0, x1, y0, y1):
    for y in range(y0, y1 + 1):
        run(x0, x1, y)


# The three descent shafts (x0, x1, y0, y1): each is a downdraft rect and a
# hole in the kill plane it passes. The first lands on the safe block (v6);
# the last pours onto a spiked shelf, the safe stone one steer to the LEFT.
# The middle one lands square on storey 3's shelf, which is why that shelf is
# where its sconce stands.
# The last wind stops six courses above the finish shelf (v6): a downdraft
# that reaches the floor crushes any jump begun under it, and from the old
# safe square at 46 the hop back over the fangs to the sconce died 0/4. The
# runtime runs a current down to the first stone in its columns, so the
# stop is a stone: the corbel at (47, 52), on the shaft's east wall, high
# enough that no jump from the floor bonks it.
SHAFTS = [
    (39, 42, 11, 24),
    (3, 7, 27, 40),
    (44, 47, 43, 51),
]

# --- storey 1: the walk, watched --------------------------------------------
run(3, 12, F[0])                            # start shelf
block(11, 12, F[0] - 2, F[0] - 1)           # the pillar: cover, then a step
run(17, 22, F[0])                           # shelf two, exposed between lights
run(27, 31, F[0])                           # the pedestal
block(29, 29, F[0] - 2, F[0] - 1)           # the standing watch-light's post
block(34, 35, F[0] - 2, F[0] - 1)           # the L: tall part is the last cover
run(34, 38, F[0])                           # its foot steps into the shaft
put(14, 3, '#')                             # mount stone: the hanging light
put(4, F[0] - 1, '@')
put(6, F[0] - 1, 'S')

# --- storey 2: no floor at all ----------------------------------------------
run(7, 12, F[1])                            # the far shelf, end of the ride
put(16, F[1] - 5, '#')                      # censer mounts...
put(23, F[1] - 5, '#')                      # ...pivots hang one course below
put(30, F[1] - 5, '#')
# The first shaft pours onto the safe block itself, run out under the whole
# wind and past where a walk-off's carry lands it (v6). It was a spiked shelf
# with ONE safe square, and a fang between it and the block that a jump out
# of the downdraft cannot clear. The first wind teaches the fall; the last
# one, at the finish, still pours onto fangs.
block(34, 46, F[1] - 1, F[1])
put(36, F[1] - 2, 'S')

# --- storey 3: the fading shelves -------------------------------------------
run(3, 7, F[2])                             # the landing the left shaft serves
run(11, 16, F[2], 'A')
run(20, 25, F[2], 'b')
run(29, 34, F[2], 'A')
run(38, 43, F[2], 'b')
put(5, F[2] - 1, 'S')

# --- the finish storey, right to left ---------------------------------------
# The spiked shelf under the last shaft: fangs under the wind's west half,
# where a steer for the sconce that comes too late lands, and stone east of
# them run out to where a walk-off's carry lands (v6: it was ONE safe square
# between fang pairs, and the walk-off died on the east pair)
run(44, 50, F[3])
run(44, 45, F[3] - 1, 'X')
put(47, F[3] - 6, '#')                      # the corbel the last wind breaks on
run(39, 42, F[3])                           # ...or the safe shelf, one steer left
run(28, 33, F[3], 'A')                      # one more breath of group A
run(13, 23, F[3])                           # the finish platform
put(25, F[3] - 6, '#')                      # mount stone: the last watch-light
put(40, F[3] - 1, 'S')
put(15, F[3] - 1, 'M')
put(18, F[3] - 1, 'N')                      # kneeling: the shift ended here

# --- the kill planes, eight courses under each storey but the last ----------
# (below the finish storey the openEdges void is the floor of the world)
# The first drop's plane is holed over its whole landing, not just the shaft:
# the plane is unseen, and a steer toward the safe block you CAN see must
# never die on a floor you can't (v6 — the playtest's "leave the path, die")
# The last drop's plane is holed the same way, over the sconce shelf, the
# shaft and the shelf beyond it (it was 44-47, so a steer for the sconce
# died at row 50 unless it began 20-24 frames after the lip). A body that
# drops through b's east four columns now lands on the sconce shelf too.
CATCH = [(34, 46, F[0] + FALL), (39, 49, F[2] + FALL)]
for f in F[:3]:
    y = f + FALL
    for x in range(LEFT, RIGHT + 1):
        inShaft = any(c0 <= x <= c1 and r0 <= y <= r1
                      for c0, c1, r0, r1 in SHAFTS)
        inCatch = any(c0 <= x <= c1 and y == cy for c0, c1, cy in CATCH)
        if not (inShaft or inCatch):
            put(x, y, '_')

# --- motes: the mouths of the shafts, so the way down reads as a way --------
for c0, c1, r0, r1 in SHAFTS:
    for y in range(r0, r0 + 5):
        for x in range(c0, c1 + 1):
            if g[y][x] == '.':
                g[y][x] = 'o'

# the watch-lights: (x, y, period-in-pulses, phase, cw); all spin. The
# standing light turns CLOCKWISE — against its hanging neighbour — so the
# two sweeps open a readable gap between them instead of chasing one
BEAMS = [
    (14.5, 4.5, 5, 0.0, False),
    (29.5, 7.2, 4, 0.5, True),
    (25.5, 53.3, 4, 0.25, True),
]
# The ridden lanterns: (x, pivot-row, len, arc, period-in-pulses, phase).
# THREE, seven columns apart — each bob reaches len*sin(arc) = 2.86 aside,
# so facing apexes stop 1.3 tiles from each other — and adjacent lanterns
# swing in ANTI-phase: both bobs arrive at their shared top together,
# momentarily still, and the crossing is a step, not a prayer.
CENSERS = [
    (16, F[1] - 4, 3.4, 1.0, 3, 0.0),
    (23, F[1] - 4, 3.4, 1.0, 3, 0.5),
    (30, F[1] - 4, 3.4, 1.0, 3, 0.0),
]
SINK = -40

# A checkpoint you cannot breathe after is not a checkpoint (grammar S4.2):
# no sconce respawns inside a watch-light's reach (the lint measures 9 tiles)
SCONCES = [(6, F[0] - 1), (36, F[1] - 2), (5, F[2] - 1), (40, F[3] - 1)]
for sx, sy in SCONCES:
    for bx, by, _, _, _ in BEAMS:
        d = math.hypot(sx - bx, sy - by)
        assert d > 9, 'sconce %d,%d is %.1f from the light at %s' % (sx, sy, d, bx)

rows = [''.join(r) for r in g]
for i, r in enumerate(rows):
    assert len(r) == W, f'row {i} is {len(r)}'

beams = ',\n'.join(
    "      { x: %s, y: %s, period: %.2f, phase: %s, spin: true%s }"
    % (x, y, n * PULSE, ph, ', cw: true' if cw else '')
    for x, y, n, ph, cw in BEAMS)
censers = ',\n'.join(
    "      { x: %d, y: %d, len: %.1f, arc: %.1f, period: %.2f, phase: %s }"
    % (x, y, ln, arc, n * PULSE, ph) for x, y, ln, arc, n, ph in CENSERS)
currents = ',\n'.join(
    "      { x0: %d, y0: %d, x1: %d, y1: %d, force: %d }"
    % (c0, r0, c1, r1, SINK) for c0, c1, r0, r1 in SHAFTS)

defn = """  // 3 · THE LAST SHIFT — the descent, to the drawing. Four storeys
  // switchbacked down through open sky, joined by three DOWNDRAFT shafts:
  // walk the watched storey right, pour down, ride the lanterns back left,
  // pour down, cross the fading shelves right, and pour down once more to
  // the stone. The wind that was a road up in THE FAMINE is a fall here,
  // and the last landing is spiked: the steer out of the wind onto the
  // safe stone beside it is the whole of it. The first wind only teaches
  // the fall, onto stone run out under all of it.
  //
  // Storey 2 has NO floor — the crossing is ridden censer to censer over
  // the void, which is THE RETURN's coda taught two acts early and made
  // the whole sentence. The watch-lights are the room's clock: two over
  // the first storey (one hanging, one STANDING on its post), one over
  // the last gap before the stone, and every stand of stone on the walk
  // is cover to wait behind.
  //
  // Built the way THE WICK is built: open sky, unseen `_` planes under
  // each storey (holed where the shafts pass), and the openEdges void
  // below the finish.
  {
    glyph: 'shift',
    // the second cut sits at 39: crossing it happens ON the safe shelves
    // and shaft lips, so every fading deck is framed BEFORE its jump —
    // the far lip of a gap must be visible from the launch (P3)
    chambers: [17, 39],
    openEdges: true,
    beams: [
%s
    ],
    censers: [
%s
    ],
    currents: [
      // the three shafts, blowing DOWN (negative force): capped shy of
      // MAX_FALL so the steer onto the safe stone is always still yours
%s
    ],
    map: [
%s
    ],
  },
"""
body = ',\n'.join("      '" + r + "'" for r in rows)
out = defn % (beams, censers, currents, body)

p = 'src/world/vaults.ts'
s = io.open(p, encoding='utf-8').read()
start = s.index('  // 3 · THE LAST SHIFT')
a2 = s.index('  // ACT II')
end = s.rindex('  // ===', 0, a2)
io.open(p, 'w', encoding='utf-8').write(s[:start] + out + s[end:])

print(f'THE LAST SHIFT · {HGT} rows x {W} · 4 storeys · 3 downdrafts · '
      f'{len(BEAMS)} watch-lights · {len(CENSERS)} lanterns\n')
print('    ' + ''.join(str(i // 10 % 10) for i in range(W)))
print('    ' + ''.join(str(i % 10) for i in range(W)))
for i, r in enumerate(rows):
    print(f'{i:3d} {r}')
