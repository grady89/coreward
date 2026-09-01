# SPEC — Phase 4 "THE PATTERN" · the husk, extraction, and the three endings

Status: **BUILT — 2026-09-01.** Signed off and implemented as written; the
⛩ table below was approved unchanged. Suites: `husk.mjs`, `extraction.mjs`,
`endings.mjs`, plus the full 24-suite regression, all green.
Deltas from the draft are marked **[as built]**. Canon sources: [LORE.md](LORE.md) §6–9,
[DIRECTION.md](DIRECTION.md) §8. Open decisions are marked ⛩ at the end —
everything else is proposed as written, with numbers.

**Design laws this spec is bound by:**
- The player is never told, only shown, overheard, or dug up. No cutscenes.
- The pod is a digging machine, not a gunship. A silent, dark run stays viable.
- Systemic, not scripted: the climb setpiece is world-state modifiers that
  existing systems read, never a sequence of triggers.
- Saves never break: every new field is additive with a default.
- The Communion (DIRECTION §8c2) is never diluted. A first meeting with a
  fragment is always the rite, whole and untouched.

---

## 0. What already exists (inventory, 2026-09-01)

| Piece | State |
|---|---|
| Glyph pickups + codex at assay office | **BUILT** — counter to 9, apology text renders at 9/9 |
| Wreck logs | **BUILT** — 12 logs, depth-as-chronology, world-locked entries |
| The Communion (core-walk rite, per-world) | **BUILT** — including the balk field and the white page |
| Ember Forge | **BUILT** — 4 items (Blink, Ascent, Exchanger, Warp) |
| Sundering Chart | **BUILT** — supports unresolved sites ("the dish is still listening") |
| Per-world ended state, revisit calm | **BUILT** — `endedWorlds`, sconces stay lit, no balk on revisit |

Phase 4 is therefore four deltas: the husk world, extraction, the endings,
and the Lumen Lance — plus a content pass (Dispatch lines, the unsigned
driller's chronology, the "your own hand" log).

---

## 1. The Husk (4.2) — the horror beat

**Trigger.** The moment a second core is met, the dish hears something it did
not triangulate: a fourth site appears on the Sundering Chart with **no
fragment arc** — a resolved signal that is *wrong*. Dispatch, two transmissions
later: *"That one's not on my charts. That one's not on anyone's charts."*

**Survey designation: SITE 297** (⛩ D1). No poetic name — Cindral's ledger
name is the horror. Lore: ~300 seed worlds, three left; this is one of the
297. Dossier tagline: *"Signal resolved. Nothing is transmitting it."*

**The visit.** Travel is one-way-in, one-way-out, EVA-only:
- Gray husk palette (single strata set, desaturated bone/ash/black; the only
  world whose sky has no sun disc). No mine — the ground is undrillable slag.
  No fauna, no threats, **no ambient drone**: the audio bed is near-silence,
  the first world without music.
- An intact Cindral colony stands on the surface: the same building silhouettes
  as every rig the player has ever docked at, lights still on, nobody home.
- Three on-foot readables, walked to in sequence (reuse the wreck-salvage EVA
  grammar, no O₂ clock on the surface):
  1. **The fuel depot ledger** — routine, then stops mid-sentence.
  2. **A hab dome log** — a driller's family, packed in one hour, "relocation
     assistance approved."
  3. **The survey office** — the beat the whole world exists for: a contract
     on the desk with the player's own terms. Same advance. Same clauses.
     `CINDRAL ADVANCE · ✦40 · RECOVERABLE.`
- Leaving fires the Dispatch line that unlocks Act IV (see §2).

**Build note.** ~90% shared engine: a `WorldDef` with `husk: true` that skips
terrain generation below row 4, disables drilling and the fuel/trade/garage
panels (docks read `OFFLINE — NO ONE IS HOME`), and seeds three EVA readables
using the found-log renderer. One headless suite: travel there, walk all
three, travel back.

**Estimated effort:** ~1 session.

---

## 2. Extraction (4.3) — the temptation

**Unlock chain (⛩ D2).** Extraction is *not* available at first touch — the
first meeting is always the Communion, and the temptation must arrive with
context. Proposed chain:

1. Meet any two cores (Communions as built).
2. SITE 297 appears; the player visits and returns.
3. Dispatch relays, flatly, off-script: **CINDRAL EXTRACTION ORDER 9-1-1** —
   ✦300,000 per fragment on delivery, all debts cleared, lease bought out.
   The trade post gains a standing order card showing that number forever.
4. From then on, revisiting any **met** core (the field is calm, the pod can
   land beside it) and walking to the fragment offers:
   `HOLD E — EXTRACT THE EMBER`. Hold-to-commit, 2.5s, with the fragment's
   pulse accelerating under the hold — release aborts with no penalty.

**The act.** Extraction is staged as the Communion's dark mirror: the same
letterbox, but the sconces gutter out one by one as the fragment leaves its
seat, the choir inverts (the major-third resolve slides back to minor), and
the chamber light dies to the pod's lamp alone. No white page. You do not get
the bright screen for this.

**The climb — systemic, not scripted.** Extraction sets one world-level state:
`carrying: fragmentId`. Existing systems read it:

| System | While carrying |
|---|---|
| Cargo | Hold is the fragment: cargo locked at FULL, warp-sell disabled |
| Pod | `thrustMul ×0.8`, fuel burn ×1.5 — hot and heavy |
| Hazard gauge | Active at all depths, climbing slowly — the fragment cooking the hull |
| Threats | Wardens wake at **every** ruin band, patrol radius doubled, and they track the fragment's light — running dark no longer hides you *from them* (lamp discipline still beats everything else) |
| Veinlight | Extinguishes in a growing radius around the pod — fuel harvesting dies as you rise |
| World | Ambient shake 0.05, quake ticks shed RUBBLE into open tunnels behind (never ahead) of the pod |
| Atmosphere | Fog stops lerp toward the husk palette from the bottom up — the world drains *behind* you |
| Audio | The stratum drones detune and thin as each band goes dark |

Escape valves so it stays fair: arrestors still catch, charges still seal,
rescue still exists (Cindral will always tow a fragment — that's the point:
taking their tow while carrying auto-sells it, and Dispatch says so first).

**Delivery.** Land the fragment at the TRADE POST → ✦300,000, `DEBT CLEARED`,
and the world's palette is permanently the husk set on every revisit: fauna
gone, veinlight dead, ore still minable but at ×0.25 value (trace light spent).
Reaching the seat of an extracted core shows the empty cradle — sconces dark.

**Undo.** A held fragment can be carried back down and re-seated (the RETURN
verb, §3). The descent with a fragment is **calm** — no Wardens, no quakes,
veinlight relighting around the pod as it passes. The world knows the
difference between a thief and a lamplighter. This asymmetry is the game's
whole argument, made mechanical (⛩ D3).

**Estimated effort:** ~1.5 sessions + a suite (extract, climb modifiers
assert, deliver, re-seat).

---

## 3. The three endings (4.4)

Each ending is Communion-grade staging with its own palette and text, and each
is *earned by disposition of the fragments*, never by a menu.

**EXTRACT — the Cindral ending.** Trigger: deliver the third fragment. The
climb of that last run drains VEIL-3's own color script in reverse as you
rise; the epilogue white is replaced by **black** — the only dark epilogue —
with the same typography treatment. Final image: the Dusklight Rig under a
sky with nothing in it. Stats, then: debts ✦0, lease VOID, `YOU ARE OUT.`
This must read as a real win. The horror is that it is one.

**RETURN — the Lamplighter ending.** Trigger: all three fragments seated in
their own chambers (any that were never extracted count as seated). The third
re-seating's rite plays out, and then the walk back to the pod keeps going —
the white comes up not from a touch but from the chamber mouth, as **dawn**:
the epilogue is the amber sky the player has stared at all game finally
turning gold. Costs stay canonical: hold empty, tank low, debts intact — the
stats row shows them unchanged, and that's the text's point.

**KINDLE — the secret ending.** Gate: **9/9 glyphs + 12/12 wreck logs + full
forge (all 5 items, Lance included)** — the codex apology explicitly contains
the instructions, so the gate is diegetic. Act: carry all three fragments into
**VEIL-3's chamber** (the Ember's home; the dawn world) and seat them
together. They reach critical mass: a new star, small and young, in the crust
of a world. Epilogue white is *brighter than white* — the tint burns out to
pure. Final beat: the Dusklight Rig's contract board, empty. Nobody has to
take that job anymore.

**Post-ending state (⛩ D4).** Proposed: an ending stamps the save with its
emblem (shown on the title screen forever) and then **rewinds the world state
to the moment before the final act**, so all three endings are reachable on
one save. NEW EXPEDITION always offered. The alternative — terminal saves —
is truer to RETURN's sacrifice but punishes 20 hours of play; flagged for
your call.

**Estimated effort:** ~1.5 sessions + one suite per ending path.

---

## 4. The Lumen Lance (forge, arsenal law §8g)

- **EMBER FORGE · LUMEN LANCE · 9 embershards.** The only true weapon.
- Fires on **X** toward facing; each shot spends **✦120** (Lumens are the
  ammunition — the economy stays inside the combat).
- Effects: vaporizes a swarm cluster, staggers a hunter 3s, blinds a Warden 6s
  (it tracks luminance; the Lance is an overexposure, not a kill).
- **Law check:** the extraction climb must be completable without it — lamp
  discipline, flares, charges and arrestors remain a full toolkit. The Lance
  buys comfort, not passage. (Verified by running the climb suite lampless
  and lanceless.)

**Estimated effort:** ~0.5 session.

---

## 5. Content pass (rides along, no new systems)

- ~15 Dispatch transmissions: the order, the hedging collapse, per-ending
  finals ("the last thing Dispatch ever says is not company-approved").
- Wreck-log chronology completion: the unsigned driller's three load-bearing
  logs across different worlds; the log **in your own hand** seeded only
  after the extraction order exists.
- Ending texts (3), husk readables (3), standing-order card copy.

---

## 6. Save schema (additive, defaulted)

```
carrying: string | null        // fragment in the hold ('veil3' | ...)
extracted: string[]            // worlds whose fragment has been removed
reseated: string[]             // worlds whose fragment was put back
huskVisited: boolean
extractOrderHeard: boolean
endingsSeen: string[]          // 'extract' | 'return' | 'kindle'
```

---

## 7. Numbers at a glance

| Thing | Value | Rationale |
|---|---|---|
| Cindral offer | ✦300,000 / fragment | ~4–6× a strong playthrough's lifetime earnings — genuinely tempting |
| Extract hold-to-commit | 2.5s | long enough to be a decision |
| Carrying: thrust / fuel | ×0.8 / ×1.5 | heavy, not helpless |
| Extracted world ore value | ×0.25 | trace light spent, digging not bricked |
| Lance cost / shot | 9 shards / ✦120 | endgame purchase; shooting stays a spend |
| KINDLE gate | 9 glyphs + 12 logs + 5 forge | all three delivery channels completed |

---

## 8. Test plan

One suite per delta, in the existing SwiftShader harness: `husk.mjs`
(travel/readables/return), `extraction.mjs` (order unlock, hold-commit, climb
modifier asserts, delivery, re-seat calm), `endings.mjs` (all three triggers
+ post-ending state), plus the lampless/lanceless climb law-check. `tsc`
green and all existing suites untouched-green before "done."

## 9. Build order

1. Husk (cheapest, unlocks the fiction everything else needs)
2. Extraction + climb (the risk center — ⛩ playtest gate before endings)
3. Endings (staging on proven rails)
4. Lance + content pass

⛩ **Playtest gate after 2:** does the climb feel like a setpiece or a chore?
Everything in §3 waits on that answer.

---

## ⛩ Open decisions for sign-off

| # | Question | Proposal |
|---|---|---|
| D1 | Husk world name | **SITE 297** — ledger name as horror |
| D2 | When does EXTRACT unlock | after husk visit (never at a first Communion) |
| D3 | Re-seating descent is calm | yes — the asymmetry is the argument |
| D4 | Post-ending save | emblem + rewind to pre-choice; all endings reachable |
| — | **[as built]** RETURN gate | tightened: needs all three cores MET and none sold, not merely one change of heart |
| — | **[as built]** Husk O₂ | no oxygen clock on SITE 297 — nothing there to run out of but time |
| D5 | Cindral offer size | ✦300,000 per fragment |
| D6 | KINDLE chamber | VEIL-3 (the dawn world) |

Sign off on the table (or amend rows) and Phase 4 starts at §9 step 1.
