# THE KINDLED — how it was proved

Room 9, the exam. The map and the beat list live in
[scripts/author-kindled.py](../scripts/author-kindled.py); the golden route is
[scripts/routes/kindled.js](../scripts/routes/kindled.js). Method:
[vault-playtest.md](vault-playtest.md).

```sh
node scripts/vaultplay.mjs --room=kindled --port=4185 scripts/routes/kindled.js
```

## The beats, measured

`phasesOK` is the share of start phases, over the hazards' common cycle, in
which some technique works from the beat's rest point. Beats with no clock
read 1.00: they are skill, not timing.

| beat | rest point | phasesOK | what works |
|---|---|---|---|
| I.1 the moth over the spark gap | entry edge | 1.00 | an early 45° spark always; a late spark only while the moth is off the arc |
| I.2 half-time floors under the bolts | P1 | 0.25 | onto A, across at the swap, off b with its bolt low; four hop shapes |
| I.3 the dark wall → first light | P2 | 1.00 | single-wall kick-and-steer-back, 8 of 12 kick thresholds |
| II.1 perch → first lantern | first light | 0.63 | step-off, short hop, held hop; two catch windows a swing |
| II.2 crown to crown | on lantern 1 | 0.29 | stand square on the crown, hop at the apex; up to 6 hop shapes |
| II.3 crown → east ledge | on lantern 2 | 0.49 | any hop at the east apex |
| II.4 the vent past the lantern | east ledge | 0.53 | walk in or hop in, two exit heights |
| III.0 the way back | middle floor | 0.82 | hop the gap, then hop the floor bolt or wait it out |
| III.1 rime under two pistons | second light | 0.44 | walk it, or three different short-hop chains |
| III.2 the inverted span | stone before it | 1.00 | full-height inverted hops at any lead; cut hops die to the fangs |
| III.3a chimney → niche | chimney foot | 0.21 | two-wall kicks, several thresholds, one window a piston cycle |
| III.3b niche → exhale | niche | 0.29 | two-wall kicks, with or without a spark out |
| IV.1–3 floors, bolt, vent (no wave) | third light | 0.53 | all 32 tried lines, in different phases |
| IV.5 shelf, rime, piston, dais (no wave) | shelf | 0.46 | leave the shelf as the piston starts its stroke |
| IV whole, wave at 3.2 t/s | third light | 0.62 | 13.3–16.4 s lines; the wave comes within 1.2 tiles on the slowest |

A perfect run is about a minute of play (62–69 s in the route, waits
included; IV alone is 13–16 s plus the rite).

## What playtesting changed

- **The lantern ride.** One long-chained lantern across the hall was
  unridable: its crown outran the body in mid-swing (17 t/s) and shed the
  rider. It became two short swings hung from the middle floor, anti-phased,
  crown to crown at the apex, each well under 7 t/s. The second hangs a
  little lower, which took the transfer from 0.22 to ~0.3–0.45 depending on
  where the catch left you; a player who stands square on the crown first
  gets the high end.
- **The chimney.** Two pistons across a two-wall shaft gave 0.12 — one
  narrow window for the whole climb. The niche between them makes it two
  beats with a rest point each (0.21 and 0.29), and the east piston was
  re-phased so the two strokes chase each other up the shaft.
- **The vent heads.** The hall's vent lifted the body into the corridor
  ceiling's lip and pinned it; it got a hood a course lower. The last
  floor's vent lantern first swept the bolt floor at hop height and killed
  every hop; it was raised to sweep only the top of the vent.
- **The last floor.** A lantern swinging along the floor cannot be dodged on
  foot (it outruns you both ways), so it hangs across the vent instead. A
  bridge pair under a wave was a coin flip; it is one half-time floor and a
  stone step now. The walk back over the hall was a twenty-tile corridor
  and got a gap and a floor bolt.
- **The wave.** Measured as the fastest wave each clean line survives
  (3.3–4.1 t/s), then set at 3.2: at your heels on the slow lines, a few
  tiles back on the quick ones.
