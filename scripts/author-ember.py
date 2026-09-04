"""THE EMBER — V4 authoring. A 44 x 56 shaft: the deepest room in the game.

Walls 0-9 and 34-43; the shaft itself is x 10..33, twenty-four columns wide.
One camera cut at col 21, with the entry sconce standing on it.
"""
import io, re

W, L, R = 44, 10, 33          # width, and the shaft's inclusive bounds
IW = R - L + 1                # 24 interior columns


def row(interior=''):
    """Build a full row from its interior, padding with shaft wall."""
    s = interior.ljust(IW, '.')
    assert len(s) == IW, (len(s), s)
    return '#' * L + s + '#' * (W - R - 1)


def solid():
    return '#' * W


def put(base, **marks):
    """Place chars at absolute columns on an interior string."""
    a = list(base.ljust(IW, '.'))
    for ch, cols in marks.items():
        for c in (cols if isinstance(cols, (list, tuple)) else [cols]):
            a[c - L] = ch[0] if len(ch) > 1 else ch
    return ''.join(a)


def floorRow(gaps):
    """A full-width stone course with holes at the given absolute columns."""
    a = ['#'] * IW
    for c in gaps:
        a[c - L] = '.'
    return ''.join(a)


rows = []
A = rows.append

# ---- the cap ----------------------------------------------------------------
A(solid()); A(solid())

# ---- 2-6 · the entry shelf. Wide, safe, and it says which way is down. ------
A(row())
A(row(put('', o=[15, 28])))
A(row(put('', **{'@': 12, 'S': 21})))
A(row(put('', o=[19, 24])))
A(row(floorRow([18, 19, 20, 21, 22])))

# ---- 7-18 · rime rhythm. No wave yet: the shelves are the whole lesson, and
#      they regrow, so the descent is a cadence rather than a staircase. -----
A(row(put('', R=[11, 12, 13], o=20)))
A(row(put('', **{'=': [28, 29, 30]})))
A(row(put('', R=[16, 17, 18], o=27)))
A(row(put('', R=[25, 26, 27])))
A(row(put('', o=13, R=[10, 11])))
A(row(put('', R=[20, 21, 22], o=31)))
A(row(put('', **{'=': [31, 32, 33]})))
A(row(put('', R=[14, 15, 16], o=24)))
A(row(put('', R=[26, 27, 28])))
A(row(put('', R=[11, 12], o=18)))
A(row(put('', R=[22, 23, 24])))
A(row(put('', o=[15, 30])))

# ---- 19 · THE GATE. It spans the shaft. You go down through it and it does
#      not pass you back — the room says what planting means before anything
#      hunts you. -----------------------------------------------------------
A(row(put('', o=[12, 17, 22, 27, 32])))
A(row())

# ---- 21-31 · under the gate, the teeth come out: censers over the drop, a
#      bolt on its wire, pistons out of both walls, and the famine's own
#      floor to stand a spent breath on. --------------------------------------
A(row(put('', R=[10, 11, 12])))
A(row(put('', **{'=': [24, 25, 26, 27]})))
A(row(put('', X=[10], R=[29, 30, 31])))
A(row(put('', X=[10, 33], o=21)))
A(row(put('', R=[15, 16, 17])))
A(row(put('', X=[33], **{'=': [10, 11, 12]})))
A(row(put('', R=[27, 28, 29], o=20)))
A(row(put('', X=[10, 11])))
A(row(put('', R=[18, 19, 20])))
A(row(put('', X=[32, 33], o=26)))
A(row(put('', R=[10, 11, 12], **{'=': [30, 31, 32]})))

# ---- 32-35 · the trigger band. Two screens under the gate, as specified. ----
A(row(put('', o=[14, 25])))
A(row(put('', R=[21, 22, 23])))
A(row(put('', X=[10, 33])))
A(row(put('', R=[13, 14], o=29)))

# ---- 36-49 · the pursuit descent. Rime density rises; the side pockets hold
#      the braziers and the mid sconce, each costing a detour the wave taxes.
A(row(put('', R=[25, 26, 27], X=[10])))
A(row(put('', R=[11, 12, 13])))
A(row(put('', o=22, R=[29, 30, 31])))
# the left pocket: a brazier hung where a missed refill would cost the shaft
A(row(put(floorRow([16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33]), **{'*': 12})))
A(row(put('', S=11, R=[20, 21, 22])))
A(row(put(floorRow([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28]), o=15)))
A(row(put('', R=[15, 16, 17], X=[33])))
A(row(put('', **{'=': [26, 27, 28]})))
A(row(put('', R=[10, 11, 12], o=24)))
# the right pocket: the second brazier, the last refill before the seed
A(row(put(floorRow([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26]), **{'*': 31})))
A(row(put('', R=[19, 20, 21])))
A(row(put('', R=[28, 29, 30], X=[10])))
A(row(put('', o=[16, 27], R=[12, 13])))
A(row(put('', R=[23, 24, 25])))

# ---- 50-55 · THE SEED. The wave breaks against the light and drains away.
#      One figure kneeling, the room's only K, and the stone as the ember. ---
A(row(put('', o=[14, 29])))
A(row(floorRow([20, 21, 22, 23])))
A(row())
A(row(put('', N=17, M=22, o=[13, 30])))
A(row())
A(solid())

for i, r in enumerate(rows):
    assert len(r) == W, f'row {i} is {len(r)} wide: {r}'

defn = """  // 5 · THE EMBER — commitment, and the deepest shaft in the game. The top
  // third is rime alone: crumble-and-regrow taught as a cadence, because a
  // shelf that comes back is a rhythm and a shelf that does not is a trap,
  // and the two never share a room (grammar §2 — THE WEATHER owns the trap).
  // Then the gate, which is architecture saying what planting means before
  // anything is chasing you. Then everything at once, down a shaft whose
  // walls have bitten through, with the wave's edge lighting the way it
  // takes. The seed is the only calm in it.
  {
    glyph: 'ember',
    // one cut, and the entry sconce stands on it: the shaft is read as two
    // columns of descent, and which one you are in when the wave arrives is
    // the drift you took twenty rows above
    chambers: [21],
    censers: [
      // three lanterns over the drop, each a quarter-pulse behind the last —
      // dodged on the way down, and the middle one is the only footing across
      // the gutter. Quarter-pulses, not thirds: §III's beat clock quantizes
      // phase, and `pulse ratio` enforces it, so a room cannot quietly drift
      // out of the groove the whole game moves to.
      { x: 21, y: 20, len: 3.4, arc: 1.0, period: 2.55, phase: 0 },
      { x: 15, y: 28, len: 2.8, arc: 0.85, period: 2.55, phase: 0.25 },
      { x: 27, y: 36, len: 3.0, arc: 0.9, period: 2.55, phase: 0.5 },
    ],
    shuttles: [
      // bolts walking the wire across the shaft, two pulses each
      { x0: 10, y0: 26, x1: 33, y1: 26, period: 1.7, phase: 0 },
      { x0: 33, y0: 44, x1: 10, y1: 44, period: 1.7, phase: 0.5 },
      // and the moth, asleep on the left wall until the descent wakes it:
      // it takes the breath and leaves you standing, which in a shaft with
      // a wave in it is worse than a clean death
      { x0: 11, y0: 33, x1: 30, y1: 35, period: 3.4, phase: 0, snuff: true },
    ],
    crushers: [
      // pistons out of both walls on the pulse, opposite phase
      { x: 10, y: 23, w: 3, h: 2, dx: 4, dy: 0, period: 3.4, phase: 0 },
      { x: 31, y: 30, w: 3, h: 2, dx: -4, dy: 0, period: 3.4, phase: 0.5 },
      // clear of the pocket sconce by seven courses: a checkpoint you cannot
      // breathe after is not a checkpoint (grammar §4.2 wants five)
      { x: 10, y: 48, w: 3, h: 2, dx: 4, dy: 0, period: 2.55, phase: 0.25 },
    ],
    beams: [
      // watch-lights on both walls, parked until you are through the gate and
      // then sweeping in opposition. One per wall is also what P4 asks for:
      // the shaft's right-hand column may introduce nothing its left has not
      // already taught, and the cut runs down the middle of the descent.
      { x: 33.5, y: 21.5, period: 4.25, phase: 0, spin: true, parked: true, arm: [10, 19, 33, 20] },
      { x: 10.5, y: 31.5, period: 4.25, phase: 0.5, spin: true, parked: true, arm: [10, 19, 33, 20] },
    ],
    gates: [
      // the curtain across the shaft: down through it, never back up
      { x0: 10, y0: 19, x1: 33, y1: 19 },
    ],
    pursuit: {
      zone: [10, 32, 33, 51],
      dir: 'down',
      speed: 2.9,
      trigger: [10, 32, 33, 34],
    },
    map: [
%s
    ],
  },
"""
body = ',\n'.join("      '" + r + "'" for r in rows)
out = defn % body

p = 'src/world/vaults.ts'
s = io.open(p, encoding='utf-8').read()
start = s.index("  // 5 · THE EMBER")
if start < 0:
    raise SystemExit('anchor not found')
end = s.index("  // 6 · THE WEATHER")
s = s[:start] + out + s[end:]
io.open(p, 'w', encoding='utf-8').write(s)
print('EMBER written:', len(rows), 'rows x', W)
