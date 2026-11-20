# THE WEATHER — notes

The room is authored by `scripts/author-weather.py` (its docstring is the
design) and played spawn → stone by `scripts/routes/weather.js`.

## v6 — the nook could shut you in (playtest, 2026-11-20)

**Report.** "I got 2 lights but not that further one. now i cant climb back
up and the jump to that other light is too far to reach."

**How it happened.** From H, hop the stub, walk off the lip and steer west
(calm or gust): the body lands in G, the nook under H, without ever lighting
F. In the runtime, 83 of 1,620 such walk-offs from H's pocket land there.
Lighting G makes it the checkpoint, but I1 + G is only two lights and the
hatch over the lane wanted three. So the lane climb stops with the head under
the shut hatch at row 10.5 (0 of 540 tries got out). F is 16 tiles east and 3
rows up, into the headwind (the best leap from G reaches x 42, below F). Every
fall re-forms on G. The same trap caught {G} and {F + G} whenever I1 had been
jumped over.

**Fix (data only).** The hatch `'2'` now wants **2** lights, down from 3. A
wall lamp **L at (22, 10)** hangs on the tower's east face, right under the
hatch, where any climber's head stops. G and L are two lights inside the lane,
so the hatch opens whatever else was lit or skipped. The east door still
wants 3 lights. In the intended order nothing changes except that the hatch
opens when F is lit rather than G. The wrong order (drop to G first) now
costs a lane climb and one more calm leap; it no longer ends the run.

**Proved in the runtime** (port 4184, `vaultplay.mjs`):
- Soft-lock sweep. Rest points × lit sets (every subset of I1/F/G/L in
  chamber B; the full set with rime intact and gone in C–E), each over the
  whole 357-frame wind cycle with the route's techniques. Before the fix:
  G with {G}, {I1+G} and {F+G} were STUCK. After the fix there are 0 STUCK.
- The playtester's order, played continuously with no teleports: spawn → I1
  → H → off the lip into G (I1+G, hatch opens) → lane → H → calm leap to F →
  … → stone: `completed: true`, 0 re-forms, 43 s.
- `scripts/routes/weather.js`: `completed: true`, 55.1 s, 0 re-forms.
- Shot: `design-review/weather-v6-hatch-open.png`.
