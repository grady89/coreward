# SPEC — "THE FOLD" · the complete glyph/vault experience

Status: **PLAN — 2026-09-06.** Nothing here is built or shipped. One
document, four disciplines, one concept. Written against the systems as
they exist tonight (open-sky rooms, the beat clock, the masonry sheet, the
lantern family, the sanctum) and against SPEC-GLYPHS.md, LORE.md §7,
DIRECTION.md §8c and the Communion's staging rules in
[finale.ts](src/fx/finale.ts).

**The audit that motivates it.** The spec promised: *"the mark ignites
stroke by stroke, the masonry recesses, you step in."* What shipped is the
ignition charge ([glyphs.ts:257](src/world/glyphs.ts#L257)) followed by an
instant mode flip with an airlock sound ([main.ts:494](src/main.ts#L494)).
Entry and exit — the two most important seconds of the whole feature — are
currently a cut with no picture. Completion inside the vault fires a chord
and a toast. The codex is a panel. Every one of those moments deserves the
same craft the rooms now have, and they can all be built from machinery
that already exists: the ignition charge, the chamber-cut camera, the
distance-driven crescendo, the beat clock, the rim lattice, the sanctum.

---

## 0 · THE ONE CONCEPT

> **You do not travel to the vault. The word unfolds, and you are inside
> it.**

The lore already rules it: the vault is not somewhere else — it is folded
into the carving, larger than the wall that holds it. So the experience
law is:

**Every threshold is topology, never teleportation.** No fades, no loading
veils, no screen wipes. Stone moves, light extrudes, and the camera goes
*through the face of the rock*. Entering a vault is reading a word from
the inside; leaving is the word closing over the room like a book.

Four pillars carry the concept through every discipline below:

| pillar | law | source |
|---|---|---|
| **THE FOLD** | thresholds are stone rearranging, on camera, never a cut to black | LORE §7 ("folded into the carving") |
| **THE PULSE** | every duration is a fraction of PULSE = 0.85 s — the rooms, the UI, the doors and the type all breathe on one clock | vault.ts beat clock |
| **THE THREE DEPTHS** | void/fog behind −0.85 · architecture −0.6..−0.3 · the body at 0.1 · light-works 0.3..0.5 — nothing ever straddles bands | play-plane discipline |
| **LIGHT IS LITURGY** | light is the only thing that moves first; stone only ever *answers* light | finale.ts rule 2 |

---

## 1 · CREATIVE DIRECTION — the award pass

### Core concept & narrative

The Lamplighters were **maintenance**. Not priests, not heroes — a guild
that walked the dark and kept small lights fed. So the register of the
whole experience is **a shift being worked**: entering a vault is
*clocking on*; the sconces are the round you walk; the master stone is the
end of the shift; the codex line is the entry you leave in the logbook.
Grand imagery, humble verbs. That tension — cathedral spaces built by
janitors — is the distinctive thing no reference site has, and it is
already this game's voice ("We were never grand. We were maintenance.").

### Visual world

One world, three ages, nine words. The materials are now settled and must
never fork per feature:

- **Warm grey-basalt** `0x9a8a78` — live stone (the masonry sheet)
- **Drank stone** `0x6c7386` — cold, matte, warmth removed (the Famine)
- **Bronze** `0xa8874a` / `0xc09a5c` — everything the guild bolted
- **Oxide enamel** `0x8e3a28` — the guild's paint: crowns, bands, the eye
- **Slate enamel** `0x4d6674` — the second paint, always with oxide
- **Worklight** `0xffd9a0` key / ember seam `0xff6a34` — the warm register
- **Gutter blue** `0x9db8ff` / cold vent `0xcfe2ff` — the famine register
- **World hue** (`ACTIVE.glyphHue`) — the *note*: rims, marks, poured light
- **True black** — a material, not an absence: band-3 silhouette stone

Rule of thirds for color: 70% basalt/black, 25% bronze+enamel, 5% light.
The 5% is the entire message; guard it (P1: one breath of light).

### Typography

- **Display = the alphabet itself.** The nine glyphs are the only
  "logotype" this feature has. Titles render as the 5×5 mark drawn large,
  with the latin name set small beneath it in the HUD's tracked caps —
  the mark is the headline, the name is the caption. Never the reverse.
- **The fragment text is engraved, not printed.** Codex lines appear the
  way marks ignite: stroke-wise, one line per pulse, in worklight on
  stone — never in a UI panel while inside a vault.
- Latin type stays the existing HUD family, tracked wide, always small:
  the guild labels things like equipment, not like posters.

### Composition & camera

- The chamber-cut grammar is the composition system: **one question per
  frame, hard cuts, never pans** (P3). The fold extends it: a threshold
  is a *cut you watch happen* — the one time the wall between two frames
  moves instead of the camera.
- The guild owns the game's only right angles. Every composed frame in
  this feature is orthogonal: verticals plumb, horizontals coursed;
  the only diagonals permitted are light (beams, arcs, the fold's rake).

### Depth, materials, lighting

- Three depths, enforced (see pillar table). Fog planes give band-3 black
  its parallax; light-works float forward; the body is never crossed.
- Light discipline: additive materials for anything that *is* light
  (`glowMat`, blooms, seams); `MeshStandard` + the lamp for anything light
  *touches*. Point/spot counts obey the ballast law (43f631f) — the fold
  may not spawn lights, only re-aim and re-intensify existing ones.

### Motion language

One clock. PULSE 0.85 s; the quarter (212 ms) is the UI atom; the eighth
(106 ms) is the smallest visible event (the reform cut is already 107 ms —
keep it, it was right). Stone always `guild-settle` (heavy ease-out);
light always `light-snap` (near-instant with a soft tail); wind and
current always linear. Nothing in this feature may own a private duration.

### The conversion goal

This is a game, so "conversion" = **the next entry**. Every exit is
staged to sell it: the logbook line lands, the gallery stone lights, and
the *next* unfound glyph's world and act are named — one line, no marker,
no quest arrow ("Two more words are still buried in VEIL-3."). At 9/9 the
conversion is the Keeping: the assembled reading points down.

---

## 2 · EXPERIENCE ARCHITECTURE — the journey, beat by beat

Eleven beats, first sighting to assembled reading. Format per beat:
**message · picture · interaction · motion · purpose.**

### Beat 1 — THE SIGHTING (pod, incidental)
- *Message:* "that stone is different, and the drill refuses it."
- *Picture:* the seeded stone in the dig face: three-age dressing, its
  mark unlit — dark grooves in the basalt, one empty socket glinting.
- *Interaction:* drilling it thunks (existing un-drillable), a single dull
  bronze note; the mark's socket catches the pod lamp for one eighth.
- *Purpose:* curiosity without a marker. The world does the pointing.

### Beat 2 — THE APPROACH (EVA)
- *Message:* "this is done on foot, alone."
- *Picture:* pod parked, suit lamp key on warm basalt; the stone reads as
  a threshold now — the sanctum's banded columns dress its jamb (small,
  quarter-scale of the master sanctum, so the two rhyme).
- *Interaction:* existing E-flow EVA. Within 3 tiles the mark's grooves
  pre-glow at 0.05 opacity — the stone knows a keeper is near.
- *Motion:* pre-glow eases in over 1 pulse, distance-driven (recedes if
  you back off — the finale's law, applied early).

### Beat 3 — THE WAKE (the charge, rebuilt as a rite)
- *Message:* "you are lighting a word, stroke by stroke."
- *Picture:* hold E: strokes ignite **in stroke order** (the authored
  polylines), each stroke a poured-light run with a hot hairline core
  (the rim lattice's own construction). The point of light comes LAST —
  except THE FAMINE, whose empty socket stays dark and *smokes* instead
  (the dead lantern's cold wisps — the alphabet legible to anyone
  watching).
- *Interaction:* hold-to-charge (existing `GLYPH_WAKE`), release decays
  (existing). Each stroke completing = one sconce-chord note ascending;
  motes within 4 tiles drift TOWARD the mark — light is hungry here.
- *Motion:* stroke ignition rides quarter-pulses; the final point flares
  ×2 for one eighth, then settles. Charge bar: none. The mark IS the bar.
- *Purpose:* anticipation, authorship, and the alphabet taught by hand.

### Beat 4 — THE FOLD IN (new; the signature 2 seconds)
Choreography at pulse resolution (total: 2 pulses + 1 cut = ~1.8 s):

| beat | stone | light | camera | sound |
|---|---|---|---|---|
| 0 (flare) | — | the point of light blooms; every stroke brightens to white-heart | locks; input latched | choir swell begins, world-hue note |
| +¼ → +1 | the face's courses RECESS in reading order, each course sliding −z with `guild-settle`, staggered an eighth apart — the wall becomes a coffered throat | stroke channels EXTRUDE inward, becoming the corridor's rim seams — the mark literally becomes the room's lattice | dollies forward half a tile — drawn in, not walking | course-by-course stone grind, quantized to the stagger |
| +1 → +2 | the throat deepens past the fog band; the world's edge-glow closes behind like water | the entry sconce is visible unlit at the far end — one warm ember seam in black | dollies through the face, 2 tiles; the surface world parallaxes away in the doorframe | ambience ducks (existing `duck`), heartbeat one bar |
| cut (on the downbeat) | — | the entry chamber's title plate ignites: the mark large, the name small | HARD CUT to chamber 1's frame — the grammar keeps its law | airlock breath + the room's own tone |

- Esc during the fold aborts it in reverse at double speed. Input is
  otherwise latched for 1.8 s and never longer.
- *Purpose:* the promise of the whole feature ("the wall is two metres
  thick") kept visually, once per entry, short enough to never sour.

### Beat 5 — ARRIVAL
- *Message:* the room's name, and its one idea, shown not told.
- *Picture:* chamber 1 framed whole (P3); title plate as §1 typography;
  Dispatch's unease line renders ONCE per save, first entry only.
- *Interaction:* control returns exactly on the cut. The entry sconce
  lights as you pass it — the first checkpoint is free.
- *Purpose:* orientation inside one breath; no tutorial text ever.

### Beat 6 — THE RUN (built; the plan changes nothing)
The rooms as they now are: chamber cuts, sconce checkpoints, the spark,
re-form at 107 ms, body-as-meter, assist at 0.6×. The experience layer
adds only *consistency*: every cyclic hazard already rides the pulse, so
beats 4, 8 and 9's choreography feels native, not imported.

### Beat 7 — THE MASTER APPROACH (the Communion in miniature)
- *Message:* "the shift is almost relieved."
- *Picture:* the sanctum (built tonight): recessed arch, poured intrados,
  keystone eye, the mark burning on the slab.
- *Interaction/motion:* the finale's rule imported — the last 8 tiles are
  DISTANCE-DRIVEN: the sanctum's poured ring brightens, the room's
  ambience ducks, the step rims light one per tile of approach. Back away
  and it all recedes. No control taken, ever.

### Beat 8 — THE TRANSLATION (completion, rebuilt as a rite)
- *Picture:* touch the stone: the room's sconces relight in the order YOU
  first lit them — your run replayed as lights, one per half-pulse. The
  fragment engraves in-world above the sanctum, one line per pulse,
  stroke-wise, worklight on stone.
- *Interaction:* any input skips to fully-rendered text; E (or walking
  out) proceeds. Nothing auto-advances — the player closes the moment.
- *Sound:* the Communion's minor-key language, small (three notes, not
  the ending's flood — that register is reserved).
- *Purpose:* the reward is the READING, staged where the work happened,
  not a toast in a corner.

### Beat 9 — THE FOLD OUT
- Exiting through the master stone (E) or walking back out runs the fold
  in reverse — the room's rim seams retract into the mark, the courses
  return in reading order, and the camera is *set down* outside at the
  stone, which now burns steady forever. 1.5 pulses; Esc-quit uses the
  same fold at double speed (leaving early looks identical, minus the
  translation — no shame animation, no grey filter).
- The world resumes on the cut: same weather, same threats, pod where you
  left it. One toast only: `TRANSLATED — THE WICK · 4/9`.

### Beat 10 — THE AFTER (the logbook)
- Codex page for that glyph gains the fragment with the same stroke-wise
  engraving (fast, half-speed of in-world). The gallery stone lights.
- The conversion line (§1): the next unfound word's world and act, named
  once in Dispatch's voice, never repeated, never marked on the map.

### Beat 11 — 9/9 · THE ASSEMBLED READING
- The codex composes the nine fragments into the existing apology
  paragraph beneath the nine marks — and the nine marks, for the first
  time, render as ONE composition: a 3×3 plate, each mark in its world's
  hue, THE FAMINE's empty socket and THE KINDLED's chest-light reading as
  the paragraph's punctuation. This plate is the feature's final image
  and the Keeping's invitation: the last line points down.

**Failure/edge loops:** gutter → re-form (unchanged, 107 ms cut);
Esc anywhere → fold out fast; re-entering a translated stone skips beats
3–4 to a 1-pulse short fold (speedrunners are respected); pod damage /
world state NEVER changes while inside (frozen, existing).

---

## 3 · THE SIGNATURE 3D HERO — the stone that is a door

The hero object of the whole feature is **the glyph stone itself**, in
its two states: sleeping monolith and burning threshold. It appears 27+
times across a run (nine stones, approach/enter/exit), so it must be
built once, parameterized, and unforgettable.

### The object
- A monolith **3 tiles tall, 2 wide**, proud of the dig face by half a
  tile (band: architecture, front ≤ −0.3). Construction from the sheets:
  a stepped basalt plinth footing it INTO the world (it was placed, not
  grown), the three-age dressing per world (maintained: crown moulding +
  finial · stripped: bare jamb, ghost-holes where bronze was · hurried:
  visibly out of plumb — the ONE permitted broken vertical in the game),
  bronze corner cramps (the slab language), and the 5×5 mark inset as
  carved channels with a bronze bezel at the single socket.
- **The mark's channels are real geometry** (grooves, not decals): unlit
  they shadow; charging they pour; lit they are the same material as the
  rim lattice — one light vocabulary from surface to vault interior.

### Materials & lighting
- Basalt `MeshStandard` warm; channels lined `glowMat(worldHue)`; bezel
  bronze; the socket a tiny recessed sphere that reads as a *lens*.
- Lit by exactly what's there: the suit lamp (key), the world's rim
  (fill), the mark itself once charging (self-key). Zero new point
  lights — the mark's "glow" is additive geometry + one re-aimed
  existing light slot, honoring the ballast law.

### Camera & composition
- 2.5D discipline: the "hero shot" is not a new camera, it is a
  **reserved framing**: when the suit is within 4 tiles of a stone, the
  follow-cam eases 15% closer and biases the stone to the thirds-line
  opposite the player (1-pulse ease, distance-driven both ways). The
  monolith + suit + lamp-pool compose the game's signature still.
- The fold (beats 4/9) is the hero's motion sequence — defined above,
  owned here: the courses' recess stagger reads left-to-right,
  top-to-bottom, **in the stroke order of that glyph** — every door
  opens in its own handwriting.

### Atmosphere & response
- Idle: dust motes fall past; once per ~20 s the socket catches a glint.
- Near (≤3 tiles): grooves pre-glow 0.05; motes' fall bends a few
  degrees toward the stone (hungry light — barely, subliminal).
- Charging: motes stream in; the choir hum rises with charge; releasing
  E lets it all decay at half rate (the stone is patient).
- Translated stones burn steady, pool a soft world-hue light, and their
  monolith's dressing gains one bronze lantern hung off the jamb — the
  lamppost family marking a kept room; the surface slowly accumulates
  nine small lights as the run progresses — progress readable from orbit,
  told entirely in furniture.

### The mirror
- The master stone inside is the same object grammar reversed: slab
  instead of monolith, sanctum instead of plinth, the mark already
  burning. Hero and mirror bracket every vault — the door you opened and
  the door that opens you.

---

## 4 · THE MOTION SYSTEM — the pulse grammar

Everything in one table-driven system. No motion in the feature may use
a value not on this page.

### The clock
```
PULSE   = 0.85 s      the bar
half    = 425 ms      room events (sconce ignition, title plates)
quarter = 212 ms      UI atom (toasts, prompts, plate fades)
eighth  = 106 ms      the smallest visible event (cuts, flares, glints)
```
Long sequences are counted in pulses (fold-in: 2; fold-out: 1.5; short
fold: 1; translation lines: 1/line). Nothing is ever "about 300ms".

### Easing tokens
```
guild-settle  cubic-bezier(0.20, 0.90, 0.10, 1.00)   stone, mass, camera eases
light-snap    cubic-bezier(0.90, 0.00, 0.10, 1.00)   ignitions, flares ≤ eighth
carry         linear                                  wind, current, chains
cut           none (0 ms)                             chamber changes, re-form
```
Law: stone never snaps, light never drifts, the camera never pans between
questions. The reform cut stays 107 ms (one eighth) — already correct.

### Input & proximity states (the game's "hover system")
| state | trigger | response | duration |
|---|---|---|---|
| stone targeted | suit ≤ 3 tiles | grooves pre-glow 0.05, E-glyph prompt breathes at half-pulse | 1 pulse ease, distance-driven |
| charge | hold E | strokes ignite on quarter-pulses, motes converge, choir rises | GLYPH_WAKE (existing) |
| release | drop E | decay at half rate | 2× charge remaining |
| sconce reach | body in ring | pre-glow + prompt-free (lighting is by touch, never by prompt) | quarter |
| master approach | ≤ 8 tiles | crescendo channels ramp by DISTANCE, not time | — |
| lamp raise | hold F | key swings up over a quarter, `guild-settle` | quarter |

### Text
- Fragment/title lines engrave stroke-wise, 1 line per pulse; any input
  completes instantly. Toasts: quarter in, hold 3 pulses, quarter out.
- No letter-by-letter typewriting anywhere — the guild engraves whole
  strokes, not characters.

### Camera choreography
- Follow-cam smoothing untouched (tuned in V1 feel phase).
- Chamber change: hard cut (existing). Fold: the only dolly in the game,
  ≤ 2 tiles, `guild-settle`, twice per vault visit. Hero framing: 15%
  ease-in bias, distance-driven. Nothing else moves the camera — scarcity
  is what makes the fold feel enormous.

### Loading & performance
- There is no loading state, by law. The vault scene builds behind beat
  4's first pulse (≤ 400 ms budget — current rooms build well inside it)
  and shaders stay warm via prewarm + light-count ballast (43f631f).
  If a build ever exceeds the pulse, the fold's throat simply holds one
  extra pulse of darkness — the choreography absorbs jank by design,
  because black stone is content here, not a spinner.
- The fold animates ≤ 40 instanced course transforms + existing lattice
  material — no new geometry allocation at threshold time; the throat is
  pre-built at seed time and hidden.

### Accessibility
- **Reduced motion** (new setting, honored from OS): folds compress to 1
  pulse with the dolly removed (recess + cut only); mote convergence off;
  crescendos keep audio but flatten visual ramps. Never instant-teleport —
  comprehension of "I went inside the stone" is accessibility too.
- **Photosensitivity:** flares cap at ×2 over an eighth; nothing strobes
  above 3 Hz — this outlaws the current bridge warn-flicker
  (`sin(t*55)`, [vault.ts](src/game/vault.ts) bridge update) which must be
  re-authored as a 2-pulse dim-pulse. (Flagged: the one existing violation.)
- **Skippability:** every authored sequence (wake, fold, translation)
  completes early on input; only the fold's 1.8 s latch is un-skippable,
  and it is under the 2 s threshold and diegetic.
- Assist mode changes hazard speed only — the experience layer is
  identical in assist; dignity is part of the design.

---

## 5 · BUILD ORDER (when approved — nothing started)

1. **The fold** (beats 4/9 + short fold) — the concept lives or dies
   here; everything else decorates it. Touches: main.ts enter/close,
   a new `fx/fold.ts`, glyphs.ts throat pre-build.
2. **The wake rebuild** (stroke-order ignition, mote convergence, famine
   smoke socket) — glyphs.ts.
3. **The translation rite** (run-replay relight, in-world engraving) —
   vault.ts completion path.
4. **Hero stone dressing** (monolith, plinth, jamb ages, lantern-on-
   translated) — chunks/glyphs.
5. **Master approach crescendo** (distance channels) — vault.ts.
6. **Pulse-grammar sweep** (tokens file, retime toasts/prompts/plates,
   fix the bridge strobe) — ui/ + vault.ts.
7. **Codex/gallery composition + 9/9 plate** — panels.ts.
8. Reduced-motion + photosensitivity settings last, tested with the
   suite's new checks (fold duration, strobe lint, latch ceiling).

Suite additions: `fold under 2s and reversible`, `no strobe over 3Hz`,
`every duration is a pulse fraction` (lintable from a tokens table),
`translation skippable`, `world state frozen across fold`.

---

*One clock, three depths, nine words, and a wall that was never a wall.*
