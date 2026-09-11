# DISPATCH — Voice-Over Script

Every transmission the dispatcher speaks, pulled from `src/game/narrative.ts`
(`EVENTS` + `ADHOC_TRANSMISSIONS`), in the
order the player is likely to hear them. The husk readables and ending pages
are **not** in this file — those are the player reading, not her voice.

The game's second speaker — **the Lamplighters**, the voice of the glyph
codex from [SPEC-GLYPHS.md](SPEC-GLYPHS.md) — is scripted at the end of this
file, with its own voice design. It is deliberately everything Dispatch is not.

## Who she is

Sixteen years on the assay dish. Working poor, like the driller. Act I she is
procedural and wry — invoices, small talk, little kindnesses smuggled inside
the paperwork. Act II she starts noticing things the company won't explain and
hedges. Act III she goes off script: quietly defiant, logging what she's told
not to log. Act IV she is afraid, and honest about it, and on your side to the
end. Her warmth is real but she almost never says it straight — it leaks out
through procedure ("that's me pushing it through — don't tell anyone I can do
that").

## Recording notes

- **Model: Eleven v3.** Every line below carries direction as inline
  `[tags]`. v3 reads a square-bracket tag as a performance cue and does not
  speak it. Older models (Multilingual v2, Turbo, Flash) read the brackets
  aloud or ignore them — never paste tagged text into those. The existing
  Act I–III takes were made before tags; they stand, and the tags on those
  lines are there for re-takes only.
- **One audio file per numbered line**, named `<id>-<n>.mp3` (e.g.
  `v3-start-1.mp3`, `v3-start-2.mp3`). The comm strip delivers lines one at a
  time in sequence, so per-line files wire straight in.
- **Lines generated one at a time are read cold** — line 2 has no idea what
  line 1 sounded like. Where a transmission's arc matters it is marked
  *generate as one take*: paste all of its lines as one paragraph, generate
  once, and split on the gaps. `ffmpeg -i take.mp3 -af
  silencedetect=noise=-35dB:d=0.5 -f null -` prints the gap times; cut with
  `-ss`/`-to` and hand each piece to `process-dispatch.sh` as usual.
- **Settings travel with the section.** Each act header carries a
  *Settings* line. Stability in the v3 UI is a three-way: **Robust** is the
  flat end (tags barely bite), **Natural** is the default, **Creative** lets
  the tags hit hardest and the voice vary most. Style stays low everywhere —
  she underplays. Speed is noted only where it should leave 1.0.
- **Caps are emphasis in v3.** Everything is written sentence case,
  including the corporate text, and the only deliberate caps in the file is
  one word in `first-extract`. Do not paste the on-screen strings — several
  are all-caps and would be shouted.
- **Record the voice dry.** Don't bake radio distortion into the prompt or
  the tags — generate a clean close-mic read and let `process-dispatch.sh`
  add the comms filter (band-pass ~300–3400 Hz, light saturation, a soft
  squelch tail). That keeps every clip consistent and lets you retune the
  radio feel without regenerating.
- Text below is **speech-normalized**: callsigns and figures are written the
  way she should say them (`Site Two-Ninety-Seven`, `three hundred thousand
  lumens`). Where it differs from the on-screen string, the game text stays as
  is — this file is only what goes into ElevenLabs.
- Ellipses (`…`) are real hesitations. Em-dashes are self-interruptions. v3
  respects both; `[pause]` and `[long pause]` are for the beats that need
  more than punctuation gives.

### The tag set

Kept small so the performance stays one woman. Documented v3 tags are marked
✓; the rest are plain descriptors v3 generalizes to — audition each once
with the chosen voice and swap in a neighbour if one misfires.

| tag | what it asks for |
|---|---|
| `[cheerfully]` ✓ | Act I job voice, lifted |
| `[wryly]` | dry, half a smile |
| `[warmly]` | the kindness she smuggles in |
| `[curious]` ✓ | noticing, not yet worried |
| `[carefully]` | hedged, reading her own instruments twice |
| `[hesitantly]` | a real stall mid-thought |
| `[quietly]` | closer to the mic, less air |
| `[hushed]` | quieter still, half-belief |
| `[flatly]` | no feeling on purpose |
| `[reading aloud]` | text that is not hers |
| `[steadily]` | level, decided, not loud |
| `[nervously]` ✓ | fear showing |
| `[shaken]` | fear that already got through |
| `[urgently]` | mid-crisis, faster, sharper |
| `[gently]` | the apology voice |
| `[amused]` / `[laughs]` ✓ | the one funny beat |
| `[sighs]` ✓ / `[exhales]` ✓ | breath before a hard line |
| `[pause]` ✓ / `[long pause]` ✓ | a held beat |

## ElevenLabs voice design prompts

Five prompts for Voice Design, ordered from my recommendation down. All of them
want **Natural stability** for the design preview (so the off-script lines
can crack a little) and **style low** — she underplays everything.

1. **The lifer (recommended).** "A woman in her mid-forties speaking calmly
   into a headset mic in a quiet room. Low, slightly husky voice worn smooth by
   sixteen years of radio work. Northern English working-class accent, mild.
   Dry, unhurried, deadpan warmth — she delivers bad news like a weather
   report and kindness like a footnote. Close-mic, intimate, no reverb."
2. **The American night-shift.** "A woman around forty with a low, tired,
   friendly American voice — Midwest flat, no vocal fry. Sounds like a
   long-haul trucking dispatcher at 3 a.m.: efficient, a little amused,
   quietly protective of the people on the other end. Steady pace, close-mic,
   dead-quiet room."
3. **The older hand.** "A woman in her late fifties with a smoky, weathered
   alto and a faint Scottish accent. Speaks slowly and precisely, like someone
   who has read a thousand contracts aloud and stopped believing them years
   ago. Warm underneath, ironic on the surface. Clean studio recording."
4. **The company voice cracking.** "A woman in her late thirties with a
   clipped, professional, corporate-trained voice — neutral accent, precise
   diction — but tired around the edges, as if the script she's reading has
   started to disgust her. Occasional flashes of real feeling breaking through
   the polish. Close-mic, quiet room."
5. **The soft one.** "A woman in her early forties with a gentle, low,
   almost-whispered voice, Irish lilt, speaking carefully into a headset late
   at night so as not to wake anyone. Kind, melancholy, unshockable. Intimate
   close-mic recording, no room tone."

**Audition text** (paste into the Voice Design preview — it spans her whole
range): *"[cheerfully] Contract's live. Advance of forty is posted against
your account — [wryly] standard terms, you signed them. [long pause]
[quietly] They've asked me to stop logging your depth readings. [steadily]
I'm logging them. [pause] Whatever you decide to do with what you're
carrying — you were the good one. [quietly] Dispatch out."*

---

## ACT I — the job

*Direction: her job voice. Bright, procedural, a little wry. Nothing is wrong
yet.*
*Settings: Natural · style low · speed 1.0.*
*Status: recorded — every line below is ✅ DONE.*

### v3-start — play begins on VEIL-3  ✅ DONE
1. [cheerfully] Dusklight, this is Dispatch. Contract's live.
2. Advance of forty is posted against your account. [wryly] Standard terms — you signed them.
3. [warmly] Pull something up and we'll both have had a good day.

### v3-first-sale — first ore sold  ✅ DONE
1. [cheerfully] Trade post logged your first sale. Nice.
2. [wryly] Against the advance, mind — the balance is what you keep.

### v3-d60 — sixty metres down  ✅ DONE
1. Reading you at sixty. Regolith's soft down to about a hundred and twenty.
2. Slate starts after. It rings when you cut it. [warmly] You'll hear what I mean.

### v3-fuel-warning — seven minutes of play  ✅ DONE
1. [wryly] Friendly reminder: the tow is fifteen percent and I hate writing those up.
2. Not because of the paperwork. [quietly] Because of what it does to your balance.

### v3-d130 — into the slate  ✅ DONE
*Direction: line 2 is the first crack in the wry surface. Generate as one take.*
1. [curious] You hear it? The slate. Old crews said the planet remembers the impact.
2. [quietly] I used to laugh at that. [pause] Sixteen years on this dish and I don't anymore.

### v3-contract-1 — first contract cleared  ✅ DONE
1. Contract cleared. Posted to your balance same day — [wryly] that's me pushing it through.
2. [quietly] Don't tell anyone I can do that.

## ACT II — someone was here

*Direction: still professional, but she's started noticing. Hedged, careful,
reading her own instruments twice.*
*Settings: Natural · style low · speed 1.0.*
*Status: recorded — every line below is ✅ DONE.*

### v3-first-wreck — first wreck salvaged  ✅ DONE
1. [carefully] That beacon you tripped is a registered wreck.
2. Salvage rights are yours. Company takes nothing off a dead driller.
3. [long pause] [quietly] …That's meant to be a comfort. I hear it isn't one.

### v3-d220 — deeper than anyone this year  ✅ DONE
1. Two hundred and twenty. That's deeper than anyone's taken a Coreward-class this year.
2. [quietly] I checked. It wasn't hard to check. [pause] There aren't many of you left.

### veinlight-1 — first veinlight harvested  ✅ DONE
1. [curious] Your cell just gained on a descent. That's the veinlight.
2. Burns clean, grows where nothing should. Survey has it filed as a mineral.
3. [flatly] It isn't one. Nobody's updated the file.

### v3-d340 — in the veins  ✅ DONE
1. You're in the veins. Survey says nothing lives down there.
2. [hesitantly] Survey's from before my time. [steadily] Keep your readings coming.

### v3-wrecks-3 — third wreck  ✅ DONE
*Direction: slow. She's reading from the registry as she talks. Speed 0.9.*
1. [carefully] Three wrecks now. I pulled the registry.
2. [reading aloud] They're all Cindral contracts. Same terms as yours, near enough word for word.
3. [quietly] The oldest is a hundred and forty years old [pause] and it is the deepest one down there.

### v3-dusk — twenty-five minutes of play  ✅ DONE
*Direction: line 3's "Actually — don't" is a real flinch, not a joke.*
1. Something for your logs, since you keep them.
2. [carefully] The dusk-line moved again. Nine metres this quarter, toward the rig.
3. A tidally locked world does not have a moving dusk-line. Ask anyone. [pause] [nervously] Actually — don't.

### v3-d520 — right angles in the rock  ✅ DONE
*Direction: two lines, both short. The second "Say again" is flat with disbelief.*
1. Say again, Dusklight? [long pause] …Right angles. At five hundred metres.
2. [flatly] Say again.

### ruins-1 — first Custodian structure imaged  ✅ DONE
1. [quietly] I've got your imaging. That is cut stone.
2. Nobody was on this rock before us. That's in the charter. [carefully] That's the whole basis of the claim.
3. Keep digging. [pause] I'm going to go and read the charter again.

## ACT III — off script

*Direction: the procedure is gone. Quieter, closer to the mic, and for the
first time she sounds like she's choosing sides.*
*Settings: Natural · style low · speed 0.95.*
*Status: recorded — every line below is ✅ DONE.*

### v3-d700 — told to stop logging  ✅ DONE
*Direction: line 2 is the whole character in three words. Steady, not defiant-loud. Generate as one take.*
1. [quietly] They've asked me to stop logging your depth readings.
2. [steadily] I'm logging them.

### v3-d900 — nine hundred metres  ✅ DONE
1. [quietly] Nine hundred. It's getting brighter down there, isn't it.
2. That's the part nobody warned me to lie about, so I'll say it plain: [steadily] that is not normal.
3. Whatever you find — tell me. I'm not cleared for it. [quietly] Tell me anyway.

### core-1 — first core reached  ✅ DONE
*Direction: shaken. Long pause before line 2. Generate as one take.*
1. [shaken] Dusklight? Your telemetry went to white and came back.
2. [long pause] …I filed your report an hour ago.
3. [quietly] It came back stamped. Approved, countersigned, closed. [pause] Before I sent it.

### core-1-after — follow-up to the first core  ✅ DONE
1. [flatly] Cindral is opening a second site. They had the survey ready.
2. They had it ready before you went down. [quietly] I want you to sit with that.

## Reactive — deaths, tows, milestones

*Settings: Natural · style low · speed 1.0.*
*Status: recorded — every line below is ✅ DONE.*

### first-death — first hull loss  ✅ DONE
*Direction: gentle. The apology is real.*
1. [gently] Recovery has you. Hull's a write-off, the pod's salvageable.
2. Fee's posted to your balance. [quietly] I'm sorry. I really am — I don't set the schedule.

### first-stranded — first tow  ✅ DONE
1. Tow's rolling. Sit tight and keep your lamp off, it's a long ride.
2. [warmly] Don't do that again. I mean it kindly.

### rich-1 — advance fully cleared  ✅ DONE
1. [warmly] Your balance cleared the advance today. Properly cleared it.
2. [quietly] Most drillers never see that. Most drillers are down there being salvage.

### Stipend letters — the Ledger's only return

*Direction: the only good news she ever gets to deliver, and it undoes her a
little each time. Warm, and trying not to show how much.*

### stipend-1 — first tow underwritten  ✅ DONE
1. [carefully] Accounting flagged a tow invoice on your ledger that is not yours. Driller out of Ridge Nine, dry tank at three hundred.
2. I processed it. I did not tell them who paid. [quietly] They cried on the channel anyway.

### stipend-2 — third tow underwritten  ✅ DONE
1. Another one of your tows went through. [quietly] Kid on her first lease, gas pocket took the hull.
2. [wryly] You know Cindral bills me for the paperwork on these? [warmly] Worth it. I hate writing them up when nobody pays.

### stipend-3 — sixth tow underwritten  ✅ DONE
1. [amused] The dispatchers have a name for you now. Not your registry — a name. They call you the Lamplighter.
2. [quietly] I have not told them what that word means down where you dig. Let them have it.

### stipend-4 — tenth tow underwritten  ✅ DONE
*Direction: line 2 is someone else's words. She reads them plainly and lets them land on their own. Generate as one take.*
1. A letter came through the dish, no registry, routed through six relays. [pause] Read it to you? It is short.
2. [reading aloud] [gently] "I do not know who you are. My mother came home. There is a plate for you at our table, whoever you are."

### descent-greeting — start of a second descent (NG+)  ✅ DONE
*Direction: her job voice again, but she has been here before too. The
third line is dry, not ominous.*
1. [cheerfully] Dispatch here. The board cleared a repeat expedition — same forty on the ledger.
2. [wryly] One revision: the company read your file, and the rates read it too. Everything costs more this time down.
3. [quietly] You know the way. That is the asset. [pause] That is also the problem.

## Other worlds

*Settings: Natural · style low · speed 1.0.*
*Status: recorded — every line below is ✅ DONE.*

### cryos-arrive — arrival on CRYOS-2  ✅ DONE
1. Cryos-Two. They airlifted the rig ahead of you — [wryly] same buildings, same dish, same me.
2. Ore assays half again on what Dusklight paid. That's the pitch.
3. [flatly] The pitch does not mention that this world froze solid and nobody has written down why.

### cryos-d200 — two hundred metres on CRYOS-2  ✅ DONE
1. [carefully] Cold's reading wrong on my end. It gets worse with depth.
2. Heat rises. Cold does not sink. [pause] I don't know what to tell you.

### cryos-accl — rime salt acclimation  ✅ DONE
*Direction: urgent but controlled — a warning, not panic.*
1. [urgently] Your radiators are shedding heat you do not have. Shut them down.
2. The crews here packed their hulls with rime salt — the white stuff in the upper beds.
3. [steadily] Bring a load to the garage. You are not going deeper without it.

### maelis-arrive — arrival on MAELIS-6  ✅ DONE
1. Maelis-Six. Third site. Ore pays double and change.
2. [quietly] I asked what happened to the first two sites they closed this year.
3. [flatly] I'm told they were exhausted. [pause] I'm told that a lot now.

### maelis-accl — nacre acclimation  ✅ DONE
1. [carefully] Hull's reading pressure it was not built for. That climbs the whole way down.
2. Nacre. The pale layers in the shallows — the reef lays it over a wound.
3. [steadily] Do the same to your hull at the garage, or stop here.

## ACT IV — the pattern

*Direction: afraid, and done pretending she isn't. Everything close-mic and
low — that is the read, not the mix; the filter is added in post as always.
The extraction order is the one exception — read flat, as written, and let
the flatness carry the contempt.*
*Settings: Creative · style low · speed 0.9. The corporate line in
`extraction-order` is the one line in the file generated on Robust.*
*Status: recorded — every line below is ✅ DONE.*

### husk-arrive — arrival at SITE 297  ✅ DONE
1. [quietly] Site Two-Ninety-Seven. I don't have a briefing for this one.
2. No extraction schedule, no assay codes. The colony beacon is on. [pause] The colony isn't.
3. [nervously] Look around. Then come back and tell me I'm wrong to be afraid of this.

### extraction-order — Cindral's offer relayed  ✅ DONE
*Direction: line 2 is corporate text read verbatim — no tag, no feeling,
sentence case, generated separately on Robust with style at zero. If the
voice still warms it up, `[flatly] [reading aloud]` in front and try again.
Lines 1, 3 and 4 are hers, on Creative.*
1. [quietly] Priority traffic from Cindral. Reading it as written:
2. Extraction Order nine-one-one. Fragment recovery authorized. Three hundred thousand lumens per unit on delivery. All driller debts cleared at first delivery.
3. [quietly] That's the whole message. They know what's down there. [pause] They've always known.
4. [steadily] I'm required to relay offers. I'm not required to tell you what to do with them.

### first-extract — a fragment in the hold  ✅ DONE
*Direction: real alarm. The capitalised "ORBIT" is the loudest she ever gets — the caps are deliberate, v3 reads them as emphasis. Generate as one take.*
1. [nervously] Your hold reads hot and your world reads… dimmer. From orbit. [urgently] I can see it from ORBIT.
2. [urgently] Whatever you're carrying — the tunnels are waking up around it. Climb.

### first-seat — a fragment carried home instead  ✅ DONE
*Direction: line 3 lands soft. It's the closest she comes to saying she's proud.*
1. Telemetry says you went down heavy and came up empty.
2. Cindral flagged the delivery as failed. [pause] I logged it as: driller declined.
3. [quietly] I've never typed that before. [warmly] It felt good.

### stillwalker-fragment — Stillwalkers freeze before the hold (CRYOS-2)  ✅ DONE
1. [hushed] The tall ones just stopped. Mid-stride, all of them, the moment you came close.
2. Whatever is riding in your hold, they will not walk at it. [quietly] I am not putting that in the log.

### fauna-dead — a world gone quiet after extraction  ✅ DONE
1. [flatly] Listening post has nothing. No wings, no worms, nothing on the vibration bands.
2. [quietly] Everything down there kept time by that light. You are digging through a world that stopped.

### cores-2 — second core  ✅ DONE
1. [quietly] Two of them now. [pause] Two.
2. I went back through the closure records. Every site Cindral has ever exhausted went dark.
3. [steadily] Not poor. Dark. No daylight in the survey imaging, not anywhere on the planet.

### cores-3 — all three cores. Her last transmission.  ✅ DONE
*Direction: her goodbye. Steady until the last line, which is allowed to
catch. If Creative doesn't give the catch on "you were the good one", put
`[voice breaking]` in front of it and take the better of the two. Generate as
one take.*
1. [quietly] That's all of them.
2. Cindral's rotating me off the dish. New contract, new rig, somebody else's driller.
3. [steadily] Whatever you decide to do with what you're carrying — [pause] you were the good one. [quietly] Dispatch out.

---

## Field lessons (ad-hoc transmissions)

*Direction: these fire mid-crisis, the first time each hazard shows itself.
Faster and sharper than the story beats — she's talking you through something
that is happening right now.*
*Settings: Natural · style low · speed 1.05.*
*Status: NOT RECORDED.*

### rime-taught — the shaft heals over (CRYOS-2)
1. [urgently] Your shaft is skinning over behind you. That is not drift — the ice is closing the wound.
2. Young ice will not hold a pod. If the way home has healed, put your nose up and ram through it.
3. [steadily] And fit the acclimation. A warm hull keeps your wake open longer. Not in the manual; it is in the wrecks.

### longone-taught — the Long One (VEIL-3)
1. [quietly] That noise through the rock was not the rock. Something down there hunts by the sound of a drill.
2. [steadily] It cannot see. Stop cutting and it loses you. Stop moving and it forgets you. Then dig somewhere else.

### mimic-taught — the geode mimic (VEIL-3)
*Direction: the one genuinely funny beat she gets. Let her enjoy it.*
1. [laughs] Ha. You cut a geode and it grew legs and ran off with your best stone. [amused] Yes. That happens down there.
2. They are not fast. Put a drill in it before it climbs out of your lamp and the ore comes back.

### rimewing-taught — Rimewings (CRYOS-2)
1. [urgently] Those are Rimewings. They sleep in the walls and they wake to warmth — engine heat, drill heat.
2. Coast when you can. Fly cold. [steadily] A flare will pull them off you: they go for the hotter thing.

### brinewyrm-taught — the Brinewyrm (CRYOS-2)
1. [urgently] Do not hover over the brine. Something lives in those pools that hears your engine through the water.
2. You will see it churn before it comes up. That is your one warning. [steadily] Move, or throw it a flare to bite.

### stillwalker-taught — the Stillwalker (CRYOS-2)
*Direction: the most urgent read in the game. She is scared for you. Generate as one take.*
1. [urgently] Listen to me. Whatever you just lit, keep it lit. They do not move while they are seen.
2. [nervously] Turn your lamp off in the deep and they walk. Through the ice. At you. [steadily] It only stops when the light finds it.

### frostbloom-taught — Frostbloom (CRYOS-2)
1. Frostbloom. A pale flower in the veinlight. [urgently] Cut it and the cold comes out all at once.
2. It just cost you fuel and sealed your pocket in young ice. Young ice will not hold a pod — ram up through it.

### polyp-taught — pressure polyps (MAELIS-6)
1. [carefully] Pressure polyps. They grow where the rock is thin and they burst when something moves past them.
2. Look for the pulse. [quietly] Anything glowing in a rhythm down there is counting, and it is counting you.

### riptide-taught — the riptide (MAELIS-6)
1. [urgently] You felt that pull. That was not current. It was the room deciding it wants you in the middle of it.
2. [steadily] It only has a grip in open water. Keep a wall at your back. Narrow shafts are your friend on this one.

### shellback-taught — the Shellback (MAELIS-6)
1. A Shellback. It walks your tunnels behind you and seals them shut with its own shell — nacre.
2. [wryly] Nacre cuts easy and it sells. If one is walling you in, that is a vein it is laying for you. Or kill it: it drops more.

### kindled-taught — the Kindled (fragment chambers)
*Direction: hushed. She's describing something she can only half believe.*
1. [hushed] There are figures on the chamber floor. Made of the same light as the fragment. Do not walk into one.
2. [quietly] They are not guarding it. I think they are waiting for it to be taken. [pause] Take it, and see.

---

# THE LAMPLIGHTERS — the codex voice

**Status: G1 has shipped.** [SPEC-GLYPHS.md](SPEC-GLYPHS.md) still reads
PROPOSED at the top, but that's stale — the alphabet is live in
[world/glyphs.ts](src/world/glyphs.ts) (`GLYPHS`, one `GlyphDef` per stone,
`id`/`name`/`fragment`), and the assay panel renders a real per-glyph codex
row plus the 9/9 assembled reading ([panels.ts](src/ui/panels.ts), the
`codex-row` block). What's still unbuilt is the vault gameplay itself (G2–G4:
walking in, the worklight pack, the nine rooms) — glyphs are still earned by
drilling for now. Every id below matches `GlyphDef.id` exactly, so a clip
named `codex-<id>.mp3` is ready to wire into that row's play button the
moment it lands in `public/audio/lamplighters/` — see
[voice-manifest.ts](src/audio/voice-manifest.ts).

## Who they are

Not the dispatcher, not the company, not alive. A dead guild speaking in
first-person plural through carved stone, translated one vault at a time. They
were **maintenance** — keepers of small lights, the last shift — and the whole
message is a work log that turns into an apology that turns into a bequest.
The register is the point: they describe hiding a star the way a caretaker
describes winterizing a building.

## How they should sound

Everything Dispatch is not, on every axis:

| | Dispatch | The Lamplighters |
|---|---|---|
| Medium | live radio, narrow band | carved stone, full range |
| Tempo | conversational, reactive | very slow, finished — nothing left to react to |
| Emotion | leaks through procedure | worn completely smooth; sad without sounding sad |
| Number | one woman, present tense | a "we," long gone |
| Post | band-pass 300–3400 Hz, squelch | stacked doubles, long stone reverb |

- **Plain, not grand.** No prophecy voice, no boom, no whisper-ASMR. "We were
  never grand. We were maintenance." Read it like an end-of-shift log entry
  written by someone very tired and very certain.
- **Make the "we" in post, not in the prompt.** Generate ONE steady voice,
  dry. Then duplicate the take two or three times, detune the copies ten to
  twenty cents, pan them slightly, and sit them 6–9 dB under the lead. Add a
  long, dark stone-room reverb. You get a quiet choir that is recognizably one
  voice — which is the Kindled's whole story in audio form.
- **ElevenLabs settings:** v3 on **Robust**, style at zero, speed 0.85 — the
  exact opposite of Dispatch. **No tags at all** on these lines: the whole
  character is that nothing is being performed. This voice never cracks. It
  finished cracking twelve hundred years ago.
- **One file per fragment**, not per line — they play whole at the master
  stone. Name by glyph: `codex-wick.mp3` … `codex-kindled.mp3`,
  `codex-assembled.mp3`.

## Voice design prompts

1. **The steward (recommended).** "An elderly woman with a low, level,
   unhurried voice, speaking plainly and without any performance, as if
   dictating instructions for someone who will read them long after she is
   gone. No placeable accent. Calm, patient, faintly sad, completely at
   peace. Very slow pace, even rhythm. Dry close-mic studio recording, no
   room tone."
2. **The foreman.** "A woman in her sixties with a flat, weathered,
   matter-of-fact voice, like a site supervisor reading the final entry of a
   logbook aloud. Zero drama, slight roughness, long pauses between
   sentences. Clean dry recording."
3. **The neutral.** "An ageless, androgynous voice, soft and clear, neither
   warm nor cold, speaking slowly with almost no inflection — informative,
   final, gentle. Studio-dry, close-mic."
4. **The choir seed.** "A middle-aged woman with an extremely steady, even,
   quiet voice — minimal inflection, no vibrato, uniform pacing — designed to
   be layered into unison stacks. Neutral accent, dry recording, no
   breathiness."

**Audition text:** *"We were never grand. We were maintenance. You do not
save a fire by carrying it with you. If you have read this far, then you can
put it back — and we are sorry, again, for what that will cost you."*

## The nine fragments

*Direction: order-independent — each is the whole voice in miniature. No
fragment should sound more dramatic than another; the ramp is in the words,
not the read. No tags.*

### codex-wick — THE WICK (VEIL-3)
There was a guild for it, once. Someone to walk the dark and keep the small lights fed. We were never grand. We were maintenance.

### codex-famine — THE FAMINE (VEIL-3)
Then light stopped being a thing you could make more of. Call it a famine; the word is close enough. Every lit thing became a spent thing. The sky went first.

### codex-shift — THE LAST SHIFT (VEIL-3)
The others left, or stopped. We stayed, because a shift does not end when it is hopeless. It ends when it is relieved. No one relieved us.

### codex-vault — THE VAULT (CRYOS-2)
You do not save a fire by carrying it with you. You save it by building a room it cannot leave and weather cannot enter.

### codex-ember — THE EMBER (CRYOS-2)
So we took the last whole light and planted it. Under a world. Deeper than grief. A seed is not stolen goods. A seed is a promise made to soil.

### codex-weather — THE WEATHER (CRYOS-2)
Everything on a surface is weather eventually — rain, war, forgetting. Depth is the only calm we ever found. We are sorry it is also dark.

### codex-debt — THE DEBT (MAELIS-6)
Understand what taking it means. The room stays warm exactly as long as the light stays in it. This is not a lock. It is arithmetic.

### codex-return — THE RETURN (MAELIS-6)
If you have the strength to carry it out, you have the strength to carry it back. One of those makes you rich. The other makes you us.

### codex-kindled — THE KINDLED (MAELIS-6)
Some of us could not leave the light we tended. They set down their bodies like tools at the end of a shift, and stayed. If you meet them, they are not asking for help. They are keeping it company.

## The assembled reading — 9/9

*Direction: the only long read they get. Same voice, same pace — resist the
urge to swell. The last sentence is the entire game; land it exactly as flat
and as kind as everything else. Shipped text, verbatim from
[panels.ts:459](src/ui/panels.ts#L459). No tags.*

### codex-assembled
We were not thieves. We were the last shift, and the light was going out, and we did the only thing anyone could think of: we put it somewhere it would keep. Under a world, where weather could not reach it. We are sorry for the dark we left you standing in. It was meant to be temporary. Everything is meant to be temporary. If you have read this far, then you can put it back — and we are sorry, again, for what that will cost you.

**Not voiced:** the locked-codex line ("The marks repeat but the sense will
not come…") is the *player's* frustrated marginalia, not the Lamplighters —
recommend leaving it silent text.

## Dispatch and the vaults

*The spec gives Dispatch one canonical vault line and budgets one beat per
completed world-act. Only the first line below is spec text; the three act
beats are **DRAFT** — write them into the code at G3, or replace them.
Settings as Act III. NOT RECORDED.*

### vault-first-entry — first time the player enters any vault *(spec §1)*
*Direction: unnerved, checking her instruments mid-sentence.*
1. [nervously] That reading is wrong. [pause] That wall is two metres thick.

### vault-act-veil3 — DRAFT — third VEIL-3 vault translated
1. [quietly] That's the last stone on this world. [reading aloud] "We were never grand. We were maintenance." [wryly] Sixteen years I've been calling myself support staff. Turns out it's a guild.

### vault-act-cryos — DRAFT — third CRYOS-2 vault translated
1. [reading aloud] "We took the last whole light and planted it. Deeper than grief." [quietly] It was put there, Dusklight. On purpose. For safekeeping. [pause] I had to stop typing for a minute.

### vault-act-maelis — DRAFT — third MAELIS-6 vault translated
1. [reading aloud] "One of those makes you rich. The other makes you us." [wryly] Rich I understand — I process the invoices. [quietly] It's the second offer I can't stop thinking about.
