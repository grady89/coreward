# Overnight build — 2026-09-01

Built while you slept: **Phases 0–3** of [PLAN.md](PLAN.md). Live at the usual
artifact link. 13 headless suites green, `tsc --noEmit` clean, no page errors.

## What to look at first (in this order)

1. **Start a new expedition.** Dispatch opens with the contract. The title now
   carries `CINDRAL ADVANCE · ✦40 · RECOVERABLE` — you are in debt from frame one.
2. **Dig to ~200m and keep the lamp on.** A swarm will find you. Press **F**.
   *This is the playtest gate that matters most* — see below.
3. **Dig past 320m** and listen. The Long Ones announce themselves through the
   rock before you see them. Note what your tunnels look like afterwards.
4. **Buy flares and a charge** at the FUEL depot (they're under KIT). Throw a
   flare (**Q**) into a dark chamber. Place a charge (**G**) and get clear.
5. **Get to ~700m** and find a Lamplighter chamber. Cut a carved stone out of
   the wall, then read the CODEX at the assay office.

## The two gates I could not clear alone

**⛩ Gate 1 — does running dark feel tense-but-fair?** Everything downstream of
light-as-liability depends on this. Specifically: is the pod controllable in the
dark; do the flies feel like pressure or like chip damage; is 1.6s of darkness
the right dispersal time; does the fuel sip register?

**⛩ Gate 2 — do the worlds feel like dialects?** Travel to CRYOS-2 and notice
that the lamp does *nothing* there — rimewings key on your thrusters, so the
counter is to cut the engine and drift. It's the inversion of what VEIL-3 taught
you. Verified mechanically; unverified as a *feeling*.

## Numbers I guessed and you should second-guess

| Thing | Value | Why I'm unsure |
|---|---|---|
| Glimmerfly damage | 2.6 hull/s + 0.5 fuel/s | Chip damage; may be too gentle to respect |
| Dark dispersal | 1.6s | Long enough to be a decision, short enough to be relief? |
| Long One damage | 26 hull/s | Meant to be non-negotiable. Might be brutal |
| Warden damage | 30 hull/s | Same |
| Flare / charge price | ✦45 / ✦260 | Never balanced against real earnings |
| Glyphs to translate | 9 | ~10 exist per world, so it's one world's worth |
| Masonry hardness | 5.5 | Slow on purpose; may be tedious |

## Things I deliberately did *not* do

- **No per-world hunters yet.** Brinewyrm, Stillwalkers, the Riptide and
  Shellbacks are designed in DIRECTION §8g but unbuilt — the *swarm* tier proves
  the dialect thesis for less risk. Geode mimics and the Kindled are also open.
- **No Phase 4.** The husk world, fragment extraction, and the three endings are
  the riskiest design in the project and PLAN says you sign off on a written
  spec before I write that code. Holding to that.
- **No balance pass.** Contract rewards, ore density and forge costs are still
  first-pass. That needs your hands.

## One real bug found and fixed along the way

The Long One zeroed its own segment mesh on the frame it spawned, so it was
briefly invisible. Also worth knowing: an in-progress drill blocks the docking
check (it early-returns before `docking()`), which is unreachable in normal play
but bit two test harnesses.
