"""THE WEATHER — the storm crossing (2026-11-20). 110 x 34, open sky.

The wind is the level. It blows WEST on one clock — 4 pulses calm (3.4 s),
3 pulses gust (2.55 s) — at force 30, which is more than air control (26):
in a gust nobody makes headway east through the air, and a jump with the
gust at its back and the stick let go runs on to 13 tiles a second. On
the ground the gust only slides you (2.1 t/s idle, and leaning into it
walks you forward slowly). Shelter is STONE at body height within two
tiles upwind: a one-course stub is a pocket you can wait a gust out in.
The route crosses east, into the storm, with one long switchback west on
the gust; every rest point is a pocket, a wall you are pinned to, or a
lee face. Every number below was measured in the real body
(scripts/vaultplay.mjs), and scripts/routes/weather.js plays the route:

   1  THE CLOCK. Spawn on a shelf with a wall at your back: the first
      gust only slides you into it. Behind the stub, wait it out; the
      first gap (4) is a calm jump — a gust turns the jump around, and
      only a spark forces it.
   2  THE TOWER. Kick up its west face: the lee, calm in any weather. Its
      top is open, so CREST IN THE CALM, and drop east onto H.
   3  THE CALM LEAP. From the pocket behind H's lip stub, 12 tiles and
      seven courses down to F. Calm and a late spark make it; in a gust
      the same leap falls three to four tiles short. Go as the streaks die.
   4  THE DOOR. F's door wants three lights; the third is in the nook G
      under H, fifteen tiles back WEST. A calm spark carries 14.0 there;
      the gust at your back carries 15.8 with the stick let go, and 23
      with a spark. RIDE THE GUST: wait sheltered against the shut door,
      run with the gust, let go. The tower stops you.
   5  THE LANE. G's light opens the east door; the hatch in H over the
      lane wants only two lights. Kick up the tower's east face (in a gust
      the wind pins you to it), out through the hatch, back to H — and the
      calm leap again, now to an open door. The lane can never shut you
      in (v6): G is your checkpoint once you light it, so a hatch that
      wanted three left a body that dropped off H into the nook before
      lighting F stuck there for good, re-forming on G. Now the hatch
      wants two, and the lane holds two lights of its own — G, and the
      lamp L under the hatch that any climber touches — so whatever you
      lit or skipped, the lane opens. Dropping from H to G first is a
      wrong order that costs the lane and the calm leap, not the run.
   6  THE LAMP THAT SETS WITH THE GUST. A pocket behind a stub, a one-shot
      rime bridge (6), a ledge, a post. The watch-lamp over the bridge
      turns once a wind-cycle: up through the calm, DOWN with the gust,
      sweeping the bridge, the ledge and the post. So the whole of it is
      one calm: off the stub, over the rime (a gust stalls you on it until
      it gives), up the post's lee face — its top is in the lee of the
      back wall — and down into D0, pinned against the post and in its
      shadow. The rime bridges the gap exactly once; after a death on it
      the gap is a calm spark leap.
   7  THE UPDRAFT. From D0 hop into the column. The spine keeps its lower
      half in the lee; at the top the wind is back. Steer out east onto
      D1 in the calm, or step onto the spine's top — a perch in D1's lee —
      and hop up when the calm comes. A gust at the top blows you out onto
      the back wall and down to D0.
   8  THE LAST CROSSING (recombines). The fourth light, then exposed D1:
      lean into the gusts. The last pocket, then the long calm leap — 11
      on the level, which a calm spark makes by two tiles and a gust spark
      misses by one — onto one-shot rime that will not hold you, off its
      end into the great wall's lee, and three quiet storeys down to the
      stone, braced behind the last shelter with the two who stayed. If
      the rime is gone, the same leap reaches the first ledge in the lee.

Chambers cut at 21, 43, 65, 87: every leap lands inside the frame it left.
The tower is chamber A's east wall and chamber B's west one; the door tower
is B's east edge; the post and the back wall are C's; the column is D's.
"""
import io

W, HGT = 110, 34
PULSE = 0.85
CALM, GUST = 4, 3                      # pulses: the clock the whole room reads

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


# --- A · THE CLOCK ----------------------------------------------------------
block(0, 0, 7, 11)                       # the spawn's back wall: a gust only slides you
run(0, 8, 12)
put(2, 11, '@')
put(6, 11, '#')                          # the first shelter stub
run(13, 19, 12)                          # I1, across the first headwind gap
put(17, 11, 'S')
block(20, 21, 4, 27)                     # the tower: lee climb up its west face

# --- B · THE ROAD WEST --------------------------------------------------------
run(22, 28, 9)                           # H, under the crest
run(22, 23, 9, '2')                     # the hatch over the lane: opens on the third light
put(28, 8, '#')                          # H's stub, at the lip: you leap over it from the pocket
run(22, 25, 19)                          # G, the nook under H the gust ride lands in
put(23, 18, 'S')
put(22, 10, 'S')                         # the lane's lamp, under the hatch: G and it are two lights
#                                          in the lane, and two open the hatch (v6)
run(41, 43, 16)                          # F, the far ledge: the door and the second light
put(42, 15, 'S')
block(44, 45, 3, 13)                     # the door tower
block(44, 45, 14, 15, '1')
run(39, 50, 3)                           # its hat: no climbing over the door
run(44, 49, 16)

# --- C · THE LAMP THAT SETS WITH THE GUST ----------------------------------
put(49, 15, '#')                         # the stub: the pocket is out of the lamp's reach
run(50, 55, 16, 'R')                     # one-shot rime over the gap
run(56, 57, 16)                          # C1
block(58, 58, 13, 15)                    # the post: climb its lee face, and it shades D0
run(55, 56, 7)                           # the lamp's mount, over the bridge

# --- D · THE UPDRAFT -------------------------------------------------------
run(58, 64, 16)                          # D0, pinned against the post in a gust
block(60, 60, 3, 12)                     # the back wall: shelters the post's top, catches a blown-out body
run(67, 68, 3)                           # the vent hood capping the column
block(69, 69, 9, 16)                     # the spine: the column's lower half is in its lee
run(70, 91, 7)                           # D1, high, and on into the last chamber
put(80, 6, 'S')                          # the fourth light

# --- E · THE LAST CROSSING --------------------------------------------------
put(89, 6, '#')                          # the last stub
run(103, 105, 7, 'R')                    # rime landing
block(108, 109, 2, 30)                   # the great wall: still air in its lee
run(106, 107, 13)
run(104, 107, 19)
run(99, 107, 26)
block(99, 99, 19, 25)                    # the bottom's back wall: a gust off the ledge above stops here
put(103, 25, '#')                        # the last shelter
put(101, 25, 'M')
put(102, 25, 'F')
put(100, 25, 'N')

# --- motes: the arcs the weather allows ------------------------------------
MOTES = (
    [(x, 6) for x in range(32, 37)]          # B1: the crown of the calm leap
    + [(x, 15) for x in range(29, 36, 2)]    # B2: the gust's road west, low
    + [(x, 7) for x in range(10, 13)]        # A1: over the first gap
    + [(22, y) for y in range(13, 18)]       # B3: the lane up to the hatch
    + [(x, 3) for x in range(95, 100)]       # E: the crown of the last leap
    + [(106, y) for y in range(8, 12)]       # E: the drop into still air
)
for x, y in MOTES:
    if g[y][x] == '.':
        put(x, y, 'o')

# --- the plane --------------------------------------------------------------
for x in range(1, W - 1):
    if g[33][x] == '.':
        put(x, 33, '_')

CURRENTS = [
    (67, 6, 68, 20, 30),
]
BEAMS = [
    # x, y, pulses, phase
    (55.5, 8.5, 7, 27 / 28),
]

rows = [''.join(r) for r in g]
for i, r in enumerate(rows):
    assert len(r) == W, f'row {i} is {len(r)}'

currents = ',\n'.join(
    "      { x0: %d, y0: %d, x1: %d, y1: %d, force: %d }" % c for c in CURRENTS)
beams = ',\n'.join(
    "      { x: %s, y: %s, period: %.2f, phase: %s, spin: true }"
    % (x, y, n * PULSE, ph) for x, y, n, ph in BEAMS)

defn = """  // 6 · THE WEATHER — the storm crossing, in open sky. The wind is the
  // level: west, on one clock (4 pulses calm, 3 gust), stronger than air
  // control, so a gust kills every leap east and carries every leap west.
  // Stone at body height is shelter. East into the storm: a calm jump, a
  // lee climb with a crest in the calm, a calm spark leap to a door that
  // wants a light fifteen tiles back WEST — only the gust at your back
  // carries you there — and back up the lane, whose hatch wants two lights
  // and which holds two (G and the lamp under the hatch), so no order of
  // lights can shut a body in the nook. Then a one-shot rime bridge
  // under a lamp that comes down with the gust, an updraft in the lee of a
  // spine, and the last calm leap onto rime that will not hold you, down
  // into the great wall's lee, where the stone is the first still air.
  // Measured in the real body: scripts/routes/weather.js.
  {
    glyph: 'weather',
    chambers: [21, 43, 65, 87],
    openEdges: true,
    wind: { dir: -1, calm: %.2f, gust: %.2f, force: 30 },
    rimeOnce: true,
    doorNeeds: { '1': 3, '2': 2 },
    currents: [
%s
    ],
    beams: [
%s
    ],
    map: [
%s
    ],
  },
"""
body = ',\n'.join("      '" + r + "'" for r in rows)
out = defn % (CALM * PULSE, GUST * PULSE, currents, beams, body)

p = 'src/world/vaults.ts'
s = io.open(p, encoding='utf-8').read()
start = s.index('  // 6 · THE WEATHER')
end = s.index('  // 7 · THE DEBT')
io.open(p, 'w', encoding='utf-8').write(s[:start] + out + s[end:])

print(f'THE WEATHER · {HGT} x {W}')
for i, r in enumerate(rows):
    print(f'{i:3d} {r}')
