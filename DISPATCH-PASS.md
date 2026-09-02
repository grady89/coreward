# Humanizer pass on the dispatch corpus

A read of every Dispatch line in [narrative.ts](src/game/narrative.ts) against
the humanizer catalog. **Nothing here is applied** — the shipped dialogue is
untouched pending your call. Delete this file once you've decided.

## Verdict

The story beats are clean. Acts I–IV survive the pass almost intact, and the
two biggest tells in the catalog are simply absent: **zero trailing participle
clauses** (the "…, marking a pivotal moment" construction AI overuses at
several times the human rate) and **no significance inflation, no hedging, no
compulsive summarizing**. Sentence openings are varied. The triplets that do
appear — "same buildings, same dish, same me", "Approved, countersigned,
closed", "New contract, new rig, somebody else's driller" — are rhythmic and
load-bearing, not hollow tricolons. Those stay.

Two real problems, in order of size.

## Problem 1 — the fauna warnings are a different person

Measured across the file:

| | Story beats (`EVENTS`) | Fauna warnings (`ADHOC_TRANSMISSIONS`) |
|---|---|---|
| Contractions | 60 | **0** |
| Uncontracted negations | 6 in 82 lines | 7 in 34 lines |

Every contraction in the file lives in the story beats. The fauna block has
none — not one "don't", "that's", "won't" across eleven transmissions. Sixteen
years of "I'm logging them" and "Don't tell anyone I can do that" becomes "It
cannot see", "They are not fast", "Do not hover over the brine", "that is a
vein it is laying for you."

That reads as a manual, not as her. If it was meant to be a clipped
emergency register, it isn't landing that way — uncontracted English sounds
*more* formal under pressure, not less, which is why real radio traffic
contracts everything. The fix is mechanical and cheap: restore contractions
throughout the fauna block and the lines snap back into her mouth.

## Problem 2 — negative parallelism at density

Twenty instances of "not X — Y" across ~132 lines. It's the house sentence,
and about half of them are the best writing in the game because Dispatch's
entire character is *correcting the official record*. Those are earned:

- "Survey has it filed as a mineral. / It isn't one. Nobody's updated the file."
- "Not poor. Dark."
- "Company takes nothing off a dead driller. / …That's meant to be a comfort. I hear it isn't one."
- "I'm required to relay offers. I'm not required to tell you what to do with them."
- "Heat rises. Cold does not sink."

The other half are the same move on autopilot, mostly in the fauna block,
where three separate creatures get warned about with an identical
grammar. Those are below.

---

# Side-by-side

## Fauna warnings

### longone-taught
> **Old** — That noise through the rock was not the rock. Something down there hunts by the sound of a drill.
> It cannot see. Stop cutting and it loses you. Stop moving and it forgets you. Then dig somewhere else.

> **New** — The rock doesn't make that noise. Something down there hunts by the sound of a drill.
> It can't see you. Stop cutting and it loses you; stop moving and it forgets you. Then go dig somewhere else.

*Line 2 was four sentences of near-identical shape — a metronome. Merging two
onto a semicolon breaks it without losing the instruction.*

### mimic-taught
> **Old** — They are not fast. Put a drill in it before it climbs out of your lamp and the ore comes back.

> **New** — They're slow, though. Put a drill in it before it climbs out of your lamp and you get the ore back.

*Commits to the claim instead of negating it, and "you get" puts the player
back in the sentence.*

### rimewing-taught
> **Old** — Coast when you can. Fly cold. A flare will pull them off you: they go for the hotter thing.

> **New** — Coast when you can. Fly cold. A flare pulls them off you; they'll always go for the hotter thing.

### brinewyrm-taught
> **Old** — Do not hover over the brine. […] You will see it churn before it comes up. That is your one warning. Move, or throw it a flare to bite.

> **New** — Don't hover over the brine. […] It'll churn before it comes up. That's your one warning. Move, or give it a flare to bite.

### stillwalker-taught
> **Old** — Listen to me. Whatever you just lit, keep it lit. They do not move while they are seen.

> **New** — Listen to me. Whatever you just lit, keep it lit. They don't move while they're seen.

*Line 2 ("Through the ice. At you.") is untouched — the fragments already do
exactly what a rhythm pass would try to add.*

### frostbloom-taught
> **Old** — It just cost you fuel and sealed your pocket in young ice. Young ice will not hold a pod — ram up through it.

> **New** — That cost you fuel and sealed your pocket in young ice. Young ice won't hold a pod — ram up through it.

### polyp-taught
> **Old** — Anything glowing in a rhythm down there is counting, and it is counting you.

> **New** — Anything glowing in a rhythm down there is counting, and it's counting you.

### riptide-taught
> **Old** — You felt that pull. That was not current. It was the room deciding it wants you in the middle of it.
> It only has a grip in open water. Keep a wall at your back.

> **New** — You felt that pull. Currents don't do that. That's the room deciding it wants you in the middle of it.
> It only has a grip in open water, so keep a wall at your back.

*The clearest textbook case in the corpus — "That was not X. It was Y." is the
single most recognized AI construction. "Currents don't do that" says the same
thing and sounds like someone talking.*

### shellback-taught
> **Old** — If one is walling you in, that is a vein it is laying for you. Or kill it: it drops more.

> **New** — If one's walling you in, that's a vein it's laying for you. Or kill it — it drops more.

### kindled-taught
> **Old** — Do not walk into one.
> They are not guarding it. I think they are waiting for it to be taken. Take it, and see.

> **New** — Don't walk into one.
> I don't think they're guarding it. I think they're waiting for someone to take it. Take it, and see.

*Moving the negation inside "I don't think" turns a flat assertion into her
hedging, which is the character. Two parallel "I think"s now, deliberately.*

### rime-taught
> **Old** — That is not drift — the ice is closing the wound.
> Young ice will not hold a pod. […] Not in the manual; it is in the wrecks.

> **New** — That's not drift. The ice is closing the wound.
> Young ice won't hold a pod. […] It's not in the manual. It's in the wrecks.

## Story beats — only two changes

### v3-fuel-warning
> **Old** — Friendly reminder: the tow is fifteen percent and I hate writing those up.
> Not because of the paperwork. Because of what it does to your balance.

> **New** — Friendly reminder: the tow is fifteen percent and I hate writing those up.
> The paperwork's the easy part. Fifteen percent of your balance is a fortnight of your life.

*Textbook negative parallelism traded for a concrete unit. "A fortnight of
your life" is the kind of specific that reads human — and it's her doing the
arithmetic on your behalf, which is what she does.*

### v3-d900
> **Old** — That's the part nobody warned me to lie about, so I'll say it plain: that is not normal.

> **New** — Nobody warned me to lie about that one. So: that is not normal.

*"So I'll say it plain" is a drumroll before the claim — the same shape as
"Here's the thing:". The claim is strong enough to arrive unannounced, and
cutting eight words makes it hit harder.*

## Left alone deliberately

- **Em dashes: 27 across 132 lines.** Above the prose ceiling, but these are
  spoken lines and every one of them is a self-interruption a voice actor will
  perform. Prose rules don't apply.
- **The Lamplighters, all ten texts.** Their flat, uncontracted, formally
  balanced register is the point — they're carved stone and a dead guild, and
  the contrast with Dispatch is the design. "This is not a lock. It is
  arithmetic." would be a tell in her mouth. In theirs it's the thesis.
- **"I'm required to relay offers. I'm not required to tell you what to do
  with them."** Balanced antithesis, kept on purpose: bureaucratic language
  *is* parallel, and she's exploiting a loophole out loud.

## The three vault beats

Already rewritten in place in [DISPATCH.md](DISPATCH.md) — they were my drafts
from this session, not shipped text. The old versions leaned on exactly the
constructions above ("That's not a warning, Dusklight. I think it's an
invitation." / "It was never a strike. It was a deposit.") and both now quote
the Lamplighters directly instead, which does the same work with her reacting
rather than narrating.
