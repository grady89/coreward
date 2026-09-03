# SPEC — "THE KEEPING" · v0.8.5 — the endgame sinks

Status: **BUILT — 2026-09-02.** Implemented as written; deltas: the depot is
*planted* with `N` (arrestor-style) and then *used* with `E` like a dock; the
census/tape moved to the Quarters exactly as specced, with the unread marker
surfaced through `panels.unreadCount()`. Suites: `keeping.mjs`,
`quarters.mjs`, plus updated `transcript.mjs` / `fauna.mjs` / `sandbox.mjs` /
`vaults.mjs`; regression green across shops, arrestor, newgame, narrative,
endings, husk, contracts, survey, pause. Review renders in `design-review/`
via `scripts/artreview.mjs`.

The problem: by late game the loop
still pays but Lumens stop mattering — every track maxed, forge full, nothing
left to want. This phase gives surplus light somewhere to go without touching
the early game's need-not-greed arithmetic.

Canon sources: [LORE.md](LORE.md) §1, §3 · [DIRECTION.md](DIRECTION.md) §6.
Colony relighting (the patronage arc) is **deliberately out of scope** — it is
its own workstream.

**Design laws this spec is bound by:**
- *"Nobody in this story is saving up for anything."* Every sink here is
  framed as **keeping** light, not spending it on luxury: a home, a kept gem,
  a sheltered creature, another driller's tow fee.
- The climb out stays the gamble. Nothing below the surface dispenses cheap
  fuel (arrestors.ts:4–8). Deep conveniences are metered at a markup: they
  convert surplus wealth into safety, they never remove the tension.
- Saves never break. Run-save fields are additive with `?? default`; all
  legacy state lives outside the run save entirely.
- Structure fronts stay at local z ≤ -0.40 (world z ≤ -0.85) so nothing can
  visually seal a dug shaft.
- Dev harnesses never touch persistent stores (`ephemeral` discipline).

---

## 1. Keeplight (❖) — the heirloom currency

Light you kept instead of spending. A **cross-save** currency in a new store:

- `src/game/meta.ts`, key `coreward_meta_v1`, built on the settings.ts
  pattern: version in the key name, `{ ...DEFAULTS, ...parsed }` on load,
  free functions. Writes are refused while the session is ephemeral
  (`lockMeta()` called from every dev entry point), and the save-guard
  suites snapshot the new key.
- Exchange at **✦100 → ❖1**, deposits only, never withdrawn. Deposited at
  the LEDGER in the Quarters (§2). Buttons: ✦1,000 / ✦10,000 / ALL.
- ❖ buys everything legacy: cosmetics, furnishings, wings, palettes, fauna
  sponsorships. Run-save Lumens buy everything operational: gem cutting,
  stipends, shaftlights, depot kits, metered refills.
- `coreward_endings` is left untouched — it stays its own tiny store.

Meta schema (all fields additive):
`keeplight, lifetimeBanked, owned: string[], finishRig, finishSuit, flame,
lampTint, spark, palette, furnishings: string[], trophies: {t, grade, world}[],
sponsored: string[], stipendsLifetime`.

## 2. THE QUARTERS — the fifth structure, and the interior

**Surface.** New dock `{ key: 'quarters', label: 'THE QUARTERS', x0: 5, x1: 9 }`
— west of the landing pad, home behind you, work to the east. Builder
`buildQuarters()` in structures.ts using the miniature vocabulary: a low
cream hab barrel with an orange dome cap, porthole glow, a stovepipe, a
porch lamp. Front face local z ≤ -0.40.

**Entering.** `E` at the quarters dock calls `enterInterior()` instead of
`panels.open`. New mode `'interior'` follows the VaultRun contract exactly:
own `THREE.Scene` + `FollowCam` + DOM chrome under `#ui`, `frame(dt, input)`
/ `render(renderer)` / `resize` / `dispose`, public `closed` polled by main.
Exit (`E` at the door, or Esc) returns to `'play'`. The suit walks it —
`buildSuit()` + the Pilot AABB stepper against a room grid. While a panel is
open the interior sim pauses (panels render over it).

**The room.** Side-view interior, one HALL (~22×7 tiles) plus two
purchasable wings behind sealed doors:

| Wing | Cost | Holds |
|---|---|---|
| GALLERY | ❖800 | 6 trophy pedestals (§4) |
| VIVARIUM | ❖800 | 4 terrarium tanks (§5) |

**Stations** (proximity + `E`, the glyph-stone idiom):
- **THE LEDGER** — deposit ✦→❖; stipends (§6); lifetime-banked stat.
- **DISPATCH CONSOLE** — the transcript, **moved here from the assay
  office**, unread dot intact.
- **FAUNA DESK** — the census, **moved here from the assay office**, plus
  sponsorship (§5).
- **WARDROBE** — cosmetics (§3).
- **CATALOG** — furnishings, wings, palettes.

**Customization.** Furnishings are fixed-slot: each item has a home and
appears when owned (bunk ❖60, rug ❖40, shelf ❖80, plant ❖50, radio set ❖90,
galley ❖70, star chart ❖120, arc lamp ❖45). Wall palettes retint the room
(dusk default; slate / rose / verdant, ❖200 each).

The assay office keeps: career stats, survey gear, starmap, codex, assay
logs, found logs — and gains the GEMCUTTER (§4). Moving the census and
transcript out is what gives the Quarters a reason to exist; `fauna.mjs`
and the transcript tests are updated to the new home.

## 3. Cosmetics — the paint locker

Slots, each with a stock option and purchasable finishes (❖, owned forever,
equip freely):

- **RIG FINISH** — hull/accent/steel triplets: Jade ❖240, Emberline ❖300,
  Voidplate ❖360, Duskline Camo ❖450 (canvas texture), Gilt ❖600,
  Prismhull ❖900.
- **SUIT FINISH** — Slate ❖150, Emberline ❖150, Bone ❖150.
- **THRUSTER FLAME** — ember / violet / teal / white, ❖120 each.
- **LAMP TINT** — moonlight / sodium / veined cyan, ❖90 each (pod spot +
  pilot and vault suit lamps).
- **DRILL SPARK** — gilded / void, ❖150 (tints the spray; default stays
  rock-colored).

Implementation: Pod and buildSuit get optional finish params and clone the
module-singleton materials when one is supplied (the flameR-clone
precedent). Equipped ids live in meta; applied at construction and on
equip.

## 4. Trophy gems — the gemcutter

At the assay office. Cut a showpiece from ore you carried up: costs **10
units** of a gem-class ore (cargo or stash) plus a cutting fee of
**25 × oreValue**. Grade roll: 18% FLAWLESS, else FINE — recutting the same
ore keeps the better grade. Trophies are meta (legacy): oversized BRILLIANT
lathes on gallery pedestals, tinted and emissive per the ore, the six most
valuable on display. Adeyemi's line is the flavor register: a piece of the
light, kept.

## 5. The vivarium — sponsorship

A species can be sponsored (❖120/200/320 by tier) once it is logged in the
current save (`faunaSeen`) — or was ever sponsored before (legacy). A
sponsored species appears as a living **light-form** in a vivarium tank:
four archetype forms (swarm / segmented / crystalline / motes), instanced
and tinted per `FaunaEntry.color`, with a name plaque. Tanks group by
world. No new "logged" set — sponsorship keys off `firedEvents` exactly as
the census does.

## 6. Stipends

At the LEDGER: **✦2,500** underwrites a stranded driller's tow. Pure sink;
the return is tonal — at cumulative 1 / 3 / 6 / 10 stipends (per save), a
letter arrives through the normal narrative pump (`ADHOC_TRANSMISSIONS`
ids `stipend-1..4`, stamped in `firedEvents`, so they land on the tape).
Dispatch already hates writing up tow invoices; now someone else pays one.

## 7. Deep infrastructure

- **Shaftlights** — ✦500 at the fuel depot, placed with `L` where the pod
  sits, permanent, per-world (`WorldSave.shaftlights`), cap 16. A warm
  fixture on the wall; only the nearest 4 carry real PointLights, the rest
  are toneMapped:false glow — the flare light budget is respected.
- **Waystation depot** — a ✦18,000 kit at the fuel depot, max 2 placed per
  world (arrestor placement flow, own key prompt via `E` when landed on
  one). It stocks nothing: refuel is metered at **4× surface price**,
  repair at **4×** — Cindral charges for the drop. The climb gamble becomes
  a wallet gamble, which is the point of an endgame sink.

## 8. Numbers at a glance

| Sink | Currency | Price |
|---|---|---|
| Exchange | ✦→❖ | 100:1 |
| Wings | ❖ | 800 each |
| Furnishings | ❖ | 40–120 |
| Palettes | ❖ | 200 |
| Rig finishes | ❖ | 240–900 |
| Suit / flame / lamp / spark | ❖ | 90–150 |
| Sponsorship | ❖ | 120–320 |
| Gem cut | ✦ + ore | 25× oreValue + 10 units |
| Stipend | ✦ | 2,500 |
| Shaftlight | ✦ | 500 |
| Depot kit | ✦ | 18,000 |
| Depot refuel/repair | ✦ | 4× surface rates |

## 9. Suites & review

- `scripts/keeping.mjs` — meta store survives NEW EXPEDITION; deposit math;
  cosmetic equip persists; trophy cut consumes ore + fee; sponsorship gates
  on faunaSeen; stipend letters fire once each; ephemeral sessions leave
  `coreward_meta_v1` byte-identical.
- `scripts/quarters.mjs` — enter/exit the interior, station prompts, wing
  doors sealed until bought, panel-freeze inside.
- Updates: `sandbox.mjs` / `vaults.mjs` snapshot the meta key too;
  `fauna.mjs` opens the census at its new home; `arrestor.mjs` untouched.
- Art review before ship: `scripts/artreview.mjs` renders the quarters
  exterior (structures-review.html), the interior hall/gallery/vivarium,
  and a pod-finish lineup into `design-review/` for approval.
