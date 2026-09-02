# SPEC — "THE NINE STONES" · glyph vaults, the worklight pack, and the earned codex

Status: **BUILT — 2026-09-02.** Implemented as written; deltas are marked
**[as built]** and the ⛩ decisions at the end carry their rulings. Suites:
`vaults.mjs` (alphabet, seeding, entry, meter, sconces, re-form, all four
hazard grammars, the Famine economy, completion, codex, grandfathering,
KINDLE gate), plus reworked `phase3.mjs` and the full regression.

**SECOND PASS — 2026-09-02, after the first playtest.** The playtest verdict
was right: hover let you fly past every room, the ceiling-beams were
unwinnable walls, and the rooms were corridors, not levels. Rebuilt:

- **Movement is discrete now, Celeste-school.** No hover, no meter. Walk,
  jump (coyote time, buffering, variable height), wall-slide + wall-jump,
  and ONE stored **spark**: Shift + a direction is an 8-way dash. Landing
  on stone relights it; a lit sconce relights it mid-air — sconces are the
  refill crystals, and routes are built from them. In the Famine the light
  is dead: its sconces checkpoint but give nothing back.
- **Hazard kit v2:** light **shuttles** (bolts patrolling a visible rail —
  jump them or wait them out), swinging **censers** on chains, stone
  **crusher** pistons still cycling, **pursuit** waves of unlight that hunt
  you once you commit (the Ember's collapse, the Kindled's last corridor),
  **brazier doors** that melt open at a sconce count, and the beams fixed:
  they spin full circles (pointing away half the time) and masonry cover
  blocks them — hide, then run.
- **All nine levels re-authored** as ramping acts: VEIL-3 teaches the
  moveset one idea at a time, CRYOS-2 tests it, MAELIS-6 examines it with
  everything at once. The completion card reports your gutter count.
- Assist = hazards at 0.6 speed. `vaults.mjs` guards the movement metrics
  (jump ≈ 2.8 tiles) the maps are authored against.

**[as built] highlights (first pass, still true):**
- Vault assist = hazard speed ×0.6 and jet drain ×0.75 (no extra sconces —
  the maps stay identical in both modes).
- The Kindled cameo stands in THE RETURN's bottom corridor, and **four**
  figures face the master stone at the end of THE KINDLED.
- Stones seed into the **floor** of the first three halls per world —
  everything the Lamplighters keep, they keep down.
- A Famine sconce refuses you below cost+8 worklight (a flicker, not a
  death sentence).
- Code: [src/world/glyphs.ts](src/world/glyphs.ts) (alphabet + marks),
  [src/world/vaults.ts](src/world/vaults.ts) (nine ASCII rooms),
  [src/game/vault.ts](src/game/vault.ts) (runtime). Dev: `?vault=wick`.
Canon sources: [LORE.md](LORE.md) §7, [DIRECTION.md](DIRECTION.md) §8c,
[THREATS.md](THREATS.md). Precedent for the format: [SPEC-PHASE4.md](SPEC-PHASE4.md).

**Design laws this spec is bound by:**
- The player is never told, only shown, overheard, or dug up. No cutscenes.
- The pod is a digging machine. On foot you are even less than that.
- Every threat and every counter is made of light — inside the stones too.
- Fully optional. The main game, the RETURN and EXTRACT endings, and a
  silent dark run never require entering a single vault.
- Saves never break: every new field is additive with a default.

---

## 0. The two problems this solves at once

**Problem A — glyphs are a counter.** LORE.md §7 promises "each *distinct*
glyph recovered enters a codex" and a document that "slowly becomes
readable." What shipped is nine identical drill-pickups, one locked string,
and the whole apology at 9/9. The Lamplighters' final message is collected
like copper.

**Problem B — EVA has no verb.** Leaving the pod exists (wreck salvage, the
Communion) but carries no skill. Wreck salvage is walk-right-and-hold-E. The
one player-controlled body in the game has nothing that tests the player.

**The feature:** each glyph stone is a **door**. You enter on foot, alone.
Inside is a short, hand-built traversal gauntlet — the Lamplighters' vault
spaces — and finishing it is what translates that glyph into the codex.
Nine stones, nine rooms, nine entries. The message is earned line by line,
with your body, which is exactly what "unreadable until earned"
(LORE.md §214) should have meant all along.

---

## 1. Lore: these are not portals

No teleportation. The rule that makes it canon instead of a gimmick:

> **The Lamplighters store precious things inside worlds.** A star's
> fragment goes under a mantle. A message goes inside the stone that
> carries its name. The vault is not somewhere else — it is *in there*,
> folded into the carving, larger than the wall that holds it.

You walk in through the face of the stone. The interior is impossible, and
the game owns that with one line instead of explaining it — Dispatch, first
entry: *"That reading is wrong. That wall is two metres thick."* (Suit
telemetry blacks out inside; she never sees the vaults. Her unease is the
only narration they get.)

**Why your suit can fly in there and nowhere else:** the vaults are full of
**worklight** — the Lamplighters' ambient working glow, still on after all
this time. The suit's maneuvering jets have always existed and have always
been dry; inside a vault they drink from the air. Light is already fuel,
money and weaponry in this game; now it is also *lift, but only in the
rooms they built*. No new physics, one new place.

**The Kindled payoff.** Glyph 9 (below) retroactively explains the four
figures in every core chamber — Lamplighters who set down their bodies and
stayed with the light as light. The dark, narrow thing inside each figure
is what is left of the body. The player has been carefully walking around
this answer since their first chamber. This is the "deeper backstory" the
feature needs, and it is excavation of existing canon, not invention —
LORE.md needs ~6 new lines in §7, nothing rewritten.

---

## 2. The nine glyphs (the alphabet)

Visual system: every glyph is drawn on a **5×5 grid, orthogonal strokes
only** — the Lamplighters own the game's only right angles — with **exactly
one point of light** (or, once, a deliberately empty socket). Rendered as
emissive line geometry set into the stone face (replacing today's reused
crack mesh, [chunks.ts:144](src/world/chunks.ts#L144)), and drawn large on
the codex page. Grid is (0,0) bottom-left, x right, y up.

Three stones per world. Each world's act of the message matches its place
in the journey: who we were → what we did → what we ask.

| # | Glyph | World | Strokes (polylines) | Light | Meaning |
|---|---|---|---|---|---|
| 1 | **THE WICK** | VEIL-3 | (2,0)→(2,3) | (2,4) | a keeper of small lights |
| 2 | **THE FAMINE** | VEIL-3 | frame (1,1)→(3,1)→(3,3)→(1,3)→(1,1) | *empty socket* (2,2) | the light stopped coming back |
| 3 | **THE LAST SHIFT** | VEIL-3 | steps (0,4)→(1,4)→(1,3)→(2,3)→(2,2)→(3,2)→(3,1)→(4,1) | (4,1) | the ones who went down last |
| 4 | **THE VAULT** | CRYOS-2 | frame (0,0)→(4,0)→(4,4)→(0,4)→(0,0) | (2,2) | a room the fire cannot leave |
| 5 | **THE EMBER** | CRYOS-2 | ground (0,3)→(4,3) | (2,1) | light planted under the soil |
| 6 | **THE WEATHER** | CRYOS-2 | storm (0,4)→(1,4)→(1,3)→(2,3)→(2,4)→(3,4)→(3,3)→(4,3); shelf (1,2)→(3,2) | (2,1) | depth as the only calm |
| 7 | **THE DEBT** | MAELIS-6 | left cell (0,1)→(2,1)→(2,3)→(0,3)→(0,1); right cell (2,1)→(4,1)→(4,3)→(2,3) | (1,2); socket (3,2) | taking is arithmetic, not theft |
| 8 | **THE RETURN** | MAELIS-6 | cradle (1,4)→(1,1)→(3,1)→(3,4) | (2,1) | carrying it back down |
| 9 | **THE KINDLED** | MAELIS-6 | body (2,0)→(2,3); arms (1,2)→(3,2) | (2,2) — the chest | the ones who stayed |

The Famine is the only glyph with no lit point; the Kindled is the only one
whose light sits *on* a stroke. Players who notice either have read the
alphabet.

### Codex fragments (one per vault, order-independent, each stands alone)

1. **THE WICK** — "There was a guild for it, once. Someone to walk the dark
   and keep the small lights fed. We were never grand. We were maintenance."
2. **THE FAMINE** — "Then light stopped being a thing you could make more
   of. Call it a famine; the word is close enough. Every lit thing became a
   spent thing. The sky went first."
3. **THE LAST SHIFT** — "The others left, or stopped. We stayed, because a
   shift does not end when it is hopeless. It ends when it is relieved.
   No one relieved us."
4. **THE VAULT** — "You do not save a fire by carrying it with you. You
   save it by building a room it cannot leave and weather cannot enter."
5. **THE EMBER** — "So we took the last whole light and planted it. Under a
   world. Deeper than grief. A seed is not stolen goods. A seed is a
   promise made to soil."
6. **THE WEATHER** — "Everything on a surface is weather eventually — rain,
   war, forgetting. Depth is the only calm we ever found. We are sorry it
   is also dark."
7. **THE DEBT** — "Understand what taking it means. The room stays warm
   exactly as long as the light stays in it. This is not a lock. It is
   arithmetic."
8. **THE RETURN** — "If you have the strength to carry it out, you have the
   strength to carry it back. One of those makes you rich. The other makes
   you us."
9. **THE KINDLED** — "Some of us could not leave the light we tended. They
   set down their bodies like tools at the end of a shift, and stayed. If
   you meet them, they are not asking for help. They are keeping it
   company."

At 9/9 the existing apology paragraph ([panels.ts:459](src/ui/panels.ts#L459))
renders beneath the nine as **THE ASSEMBLED READING** — nothing already
built is discarded.

---

## 3. The vault runtime

### Entry
- Glyph stones become **un-drillable**. Park the pod, EVA (existing E flow,
  same as wreck salvage), stand at the stone, press E: the mark ignites
  stroke by stroke, the masonry recesses, you step in. Esc inside = leave
  any time. Pod, world, threats and clock are all frozen while inside
  (mode: `'vault'`, alongside the existing `'starmap'` pattern).
- A completed stone stays lit forever and can be re-entered (speedrunning
  your old gauntlets is free fun; completion never un-sets).

### Movement — the worklight pack
The pilot already walks and jumps ([pilot.ts](src/player/pilot.ts):
WALK 3.6, jump, gravity). Add, **inside vaults only**:
- **Hold ↑ / W / Space: jet.** Same feel-family as the pod — thrust against
  gravity, momentum preserved — but lighter, twitchier, on a body one tile
  tall. Tuning start point: thrust ≈ pod's, mass fraction, drag up.
- **The meter is light.** Jetting drains a worklight meter (~2.5 s of
  continuous burn). It refills fast in the glow of a lit sconce, slowly in
  ambient worklight, **not at all in dark zones**. The resource, the
  checkpoint and the hazard are all the same substance. F (lamp) still
  works and is the intended way to *read* dark zones — it just doesn't
  refill you.
- No O2 clock inside (⛩1). The suit reads the vault air as breathable and
  says so, once, uneasily.

### The two gauntlet grammars — resolving pack vs gravity
Both halves of the pitch survive, split by dialect, the same way the fauna
was split:
- **The pack is universal.** Every vault is flown with the same jets.
- **Gravity games are MAELIS-6's dialect.** Its organ is SPACE, so its
  three vaults are the ones with **rotated-gravity zones** — regions where
  down is a wall or the ceiling, marked by which way the ambient worklight
  motes fall (shown, never told). Wall-to-roof-to-floor traversal lives
  here, at the end of the difficulty ramp, instead of being a tenth
  mechanic bolted onto vault one.
- VEIL-3 vaults are pure light-discipline: sweeping beams (the Wardens'
  grammar in miniature), dark zones, sconce routing. CRYOS-2 vaults are
  meter-austerity: long sconce gaps, rime platforms that shed when stood
  on, stillness beats. Difficulty ramps world by world, which is the order
  players already travel.

### Failure — no death, ever
Touching a hazard (beam, void-dark floor, crush) does not kill or damage:
your worklight gutters and you **re-form at the last lit sconce** — the
same visual language as the Kindled, which is not an accident. Sconces are
checkpoints; lighting one is a save. The cost of failure is repetition,
which is the honest Hollow-Knight-gauntlet cost. No hull, no money, no O2
lost — the main run is never taxed for trying.

### Completion
The far chamber holds the glyph's **master stone**. Touch it: the room's
sconces light in sequence (the Communion's language, minor key), the
fragment text renders in-world, and you walk back out — or E to step
straight out through the master stone. `state.glyphsSet` gains the id;
toast `TRANSLATED — <NAME> · N/9`; codex updates. One Dispatch beat per
completed *world-act* (3 lines total), not per vault.

### Size and tone per room
Target: **40×24 tiles**, 60–120 s on a clean first-clear run, one idea per
room introduced safe then tested sharp (Celeste screen logic). Nine rooms
total. Hand-authored as ASCII maps in `src/world/vaults.ts` — one char per
tile (`#` masonry, `.` air, `S` sconce, `B` beam emitter, `D` dark zone,
`R` rime platform, `^v<>` gravity zones, `@` entry, `M` master stone) —
reviewable in a diff, tuned in a text editor.

### Assist
A **Vault assist** toggle in settings (separate from Threats): hazard speed
×0.6 and +1 sconce per room. KINDLE stays reachable with assist on — the
gate is seeing the message, not proving a reflex.

---

## 4. System changes

| Piece | Change |
|---|---|
| Terrain gen | Seed **exactly 3 glyph stones per world**, one each at the first three generated ruins, on an interior wall; stop seeding ~10. Each stone carries its glyph id deterministically (world defines its three). |
| `state.glyphs` | Becomes derived: `glyphsSet: Set<glyphId>` is the truth. **Save compat:** an old save with `glyphs = N` grandfathers the first N canonical ids as translated. Additive, never breaking. |
| KINDLE gate | Unchanged in shape: 9/9 glyphs + 12 logs + full forge. 9/9 now means nine vaults walked. |
| Codex UI | Nine rows, each: large glyph mark + name + fragment (or `— untranslated —` in the locked style). Assembled reading at 9/9. |
| Drilling a glyph | Removed. `phase3.mjs` glyph test reworked in G1. |
| Controls card | ↑/W/Space listed as JET while in a vault. |

---

## 5. Build order (each phase ships green on its own)

- **G1 — the alphabet (no vaults yet).** Distinct glyph ids, the nine
  marks rendered on stones and in the codex, per-glyph fragments, 3-per-world
  seeding, save grandfathering. Collection stays "drill" for exactly one
  release so G1 is pure content. Cheapest phase, biggest lore payoff.
- **G2 — one door.** Vault runtime (mode, ASCII loader, pilot jets, meter,
  sconces, re-form, master stone) + **THE WICK** as the tutorial vault.
  Drill-collection removed for that stone only. `?vault=wick` dev harness
  (sandbox pattern) + `vaults.mjs` headless suite.
- **G3 — the nine.** Remaining eight rooms, world dialects, gravity zones,
  the three Dispatch beats, assist toggle.
- **G4 — polish.** Audio (worklight hum, sconce chime as a choir note per
  world), entry/exit transitions, THREATS.md + BESTIARY.md + LORE.md §7
  updates, full regression.

**Honest scope:** G2 is a new movement controller and a new scene type —
the biggest single system since the fauna. G3 is the project's first real
*level-design* content; nine rooms will take longer to make good than to
make work, and headless tests can prove completability (dev-teleport +
scripted inputs) but **cannot judge difficulty**. ⛩ gates below.

---

## 6. Risks

- **Mode whiplash** — twitch platforming inside a zen digging game. This is
  a feature (the register shift is why HK dream sequences land) but only
  because it is optional and telegraphed: the door is a choice, the door
  glows, nothing upstairs ever demands it.
- **Difficulty blindness** — I can tune numbers, not feel. Every G3 room
  needs a human first-clear time and a rage count before sign-off.
- **The Famine socket** and rotated gravity both risk reading as bugs.
  Mitigation: motes falling sideways *before* the zone boundary; the socket
  rendered as a crisp ring, not an omission.

## ⛩ Decisions (ruled 2026-09-02)

1. **O2 inside vaults: NONE.** The suit stops counting; repetition is the
   only cost. Ruled and built.
2. **Re-entry reward: none.** No money in the vaults, only the lore.
   Ruled and built.
3. **Pack outside vaults: not for now.** The jets work only in the rooms
   they built. Revisit after a playtest if ever.
4. **The Kindled cameo: YES**, before glyph 9 — built into THE RETURN,
   with the full four waiting at THE KINDLED's master stone.
