# DISPATCH — Voice-Over Script

Every transmission the dispatcher speaks, pulled from `src/game/narrative.ts`
(`EVENTS` + `ADHOC_TRANSMISSIONS`), in the order the player is likely to hear
them. The husk readables and ending pages are **not** in this file — those are
the player reading, not her voice.

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

- **One audio file per numbered line**, named `<id>-<n>.mp3` (e.g.
  `v3-start-1.mp3`, `v3-start-2.mp3`). The comm strip delivers lines one at a
  time in sequence, so per-line files wire straight in.
- **Record the voice dry.** Don't bake radio distortion into the ElevenLabs
  prompt — generate a clean close-mic read and add the comms filter (band-pass
  ~300–3400 Hz, light saturation, a soft squelch tail) in post or in the game's
  audio chain. That keeps every clip consistent and lets you retune the radio
  feel without regenerating.
- Text below is **speech-normalized**: callsigns and figures are written the
  way she should say them (`Site Two-Ninety-Seven`, `three hundred thousand
  lumens`). Where it differs from the on-screen string, the game text stays as
  is — this file is only what goes into ElevenLabs.
- Ellipses (`…`) are real hesitations. Em-dashes are self-interruptions.
  ElevenLabs respects both; if a pause reads too short, add a period instead.

## ElevenLabs voice design prompts

Five prompts for Voice Design, ordered from my recommendation down. All of them
want **stability ~40–50** (so the off-script lines can crack a little) and
**style low** — she underplays everything.

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
range): *"Contract's live. Advance of forty is posted against your account —
standard terms, you signed them. …They've asked me to stop logging your depth
readings. I'm logging them. Whatever you decide to do with what you're
carrying — you were the good one. Dispatch out."*

---

## ACT I — the job

*Direction: her job voice. Bright, procedural, a little wry. Nothing is wrong
yet.*

### v3-start — play begins on VEIL-3
1. Dusklight, this is Dispatch. Contract's live.
2. Advance of forty is posted against your account. Standard terms — you signed them.
3. Pull something up and we'll both have had a good day.

### v3-first-sale — first ore sold
1. Trade post logged your first sale. Nice.
2. Against the advance, mind — the balance is what you keep.

### v3-d60 — sixty metres down
1. Reading you at sixty. Regolith's soft down to about a hundred and twenty.
2. Slate starts after. It rings when you cut it. You'll hear what I mean.

### v3-fuel-warning — seven minutes of play
1. Friendly reminder: the tow is fifteen percent and I hate writing those up.
2. Not because of the paperwork. Because of what it does to your balance.

### v3-d130 — into the slate
*Direction: line 2 is the first crack in the wry surface. Quieter.*
1. You hear it? The slate. Old crews said the planet remembers the impact.
2. I used to laugh at that. Sixteen years on this dish and I don't anymore.

### v3-contract-1 — first contract cleared
1. Contract cleared. Posted to your balance same day — that's me pushing it through.
2. Don't tell anyone I can do that.

## ACT II — someone was here

*Direction: still professional, but she's started noticing. Hedged, careful,
reading her own instruments twice.*

### v3-first-wreck — first wreck salvaged
1. That beacon you tripped is a registered wreck.
2. Salvage rights are yours. Company takes nothing off a dead driller.
3. …That's meant to be a comfort. I hear it isn't one.

### v3-d220 — deeper than anyone this year
1. Two hundred and twenty. That's deeper than anyone's taken a Coreward-class this year.
2. I checked. It wasn't hard to check. There aren't many of you left.

### veinlight-1 — first veinlight harvested
1. Your cell just gained on a descent. That's the veinlight.
2. Burns clean, grows where nothing should. Survey has it filed as a mineral.
3. It isn't one. Nobody's updated the file.

### v3-d340 — in the veins
1. You're in the veins. Survey says nothing lives down there.
2. Survey's from before my time. Keep your readings coming.

### v3-wrecks-3 — third wreck
*Direction: slow. She's reading from the registry as she talks.*
1. Three wrecks now. I pulled the registry.
2. They're all Cindral contracts. Same terms as yours, near enough word for word.
3. The oldest is a hundred and forty years old and it is the deepest one down there.

### v3-dusk — twenty-five minutes of play
*Direction: line 3's "Actually — don't" is a real flinch, not a joke.*
1. Something for your logs, since you keep them.
2. The dusk-line moved again. Nine metres this quarter, toward the rig.
3. A tidally locked world does not have a moving dusk-line. Ask anyone. Actually — don't.

### v3-d520 — right angles in the rock
*Direction: two lines, both short. The second "Say again" is flat with disbelief.*
1. Say again, Dusklight? …Right angles. At five hundred metres.
2. Say again.

### ruins-1 — first Custodian structure imaged
1. I've got your imaging. That is cut stone.
2. Nobody was on this rock before us. That's in the charter. That's the whole basis of the claim.
3. Keep digging. I'm going to go and read the charter again.

## ACT III — off script

*Direction: the procedure is gone. Quieter, closer to the mic, and for the
first time she sounds like she's choosing sides.*

### v3-d700 — told to stop logging
*Direction: line 2 is the whole character in three words. Steady, not defiant-loud.*
1. They've asked me to stop logging your depth readings.
2. I'm logging them.

### v3-d900 — nine hundred metres
1. Nine hundred. It's getting brighter down there, isn't it.
2. That's the part nobody warned me to lie about, so I'll say it plain: that is not normal.
3. Whatever you find — tell me. I'm not cleared for it. Tell me anyway.

### core-1 — first core reached
*Direction: shaken. Long pause before line 2.*
1. Dusklight? Your telemetry went to white and came back.
2. …I filed your report an hour ago.
3. It came back stamped. Approved, countersigned, closed. Before I sent it.

### core-1-after — follow-up to the first core
1. Cindral is opening a second site. They had the survey ready.
2. They had it ready before you went down. I want you to sit with that.

## Reactive — deaths, tows, milestones

### first-death — first hull loss
*Direction: gentle. The apology is real.*
1. Recovery has you. Hull's a write-off, the pod's salvageable.
2. Fee's posted to your balance. I'm sorry. I really am — I don't set the schedule.

### first-stranded — first tow
1. Tow's rolling. Sit tight and keep your lamp off, it's a long ride.
2. Don't do that again. I mean it kindly.

### rich-1 — advance fully cleared
1. Your balance cleared the advance today. Properly cleared it.
2. Most drillers never see that. Most drillers are down there being salvage.

## Other worlds

### cryos-arrive — arrival on CRYOS-2
1. Cryos-Two. They airlifted the rig ahead of you — same buildings, same dish, same me.
2. Ore assays half again on what Dusklight paid. That's the pitch.
3. The pitch does not mention that this world froze solid and nobody has written down why.

### cryos-d200 — two hundred metres on CRYOS-2
1. Cold's reading wrong on my end. It gets worse with depth.
2. Heat rises. Cold does not sink. I don't know what to tell you.

### cryos-accl — rime salt acclimation
*Direction: urgent but controlled — a warning, not panic.*
1. Your radiators are shedding heat you do not have. Shut them down.
2. The crews here packed their hulls with rime salt — the white stuff in the upper beds.
3. Bring a load to the garage. You are not going deeper without it.

### maelis-arrive — arrival on MAELIS-6
1. Maelis-Six. Third site. Ore pays double and change.
2. I asked what happened to the first two sites they closed this year.
3. I'm told they were exhausted. I'm told that a lot now.

### maelis-accl — nacre acclimation
1. Hull's reading pressure it was not built for. That climbs the whole way down.
2. Nacre. The pale layers in the shallows — the reef lays it over a wound.
3. Do the same to your hull at the garage, or stop here.

## ACT IV — the pattern

*Direction: afraid, and done pretending she isn't. Everything close-mic and
low. The extraction order is the one exception — read flat, as written, and
let the flatness carry the contempt.*

### husk-arrive — arrival at SITE 297
1. Site Two-Ninety-Seven. I don't have a briefing for this one.
2. No extraction schedule, no assay codes. The colony beacon is on. The colony isn't.
3. Look around. Then come back and tell me I'm wrong to be afraid of this.

### extraction-order — Cindral's offer relayed
*Direction: line 2 is corporate text read verbatim — flat, no feeling. Lines 3
and 4 are hers again.*
1. Priority traffic from Cindral. Reading it as written:
2. Extraction Order nine-one-one. Fragment recovery authorized. Three hundred thousand lumens per unit on delivery. All driller debts cleared at first delivery.
3. That's the whole message. They know what's down there. They've always known.
4. I'm required to relay offers. I'm not required to tell you what to do with them.

### first-extract — a fragment in the hold
*Direction: real alarm. The "ORBIT" is the loudest she ever gets.*
1. Your hold reads hot and your world reads… dimmer. From orbit. I can see it from orbit.
2. Whatever you're carrying — the tunnels are waking up around it. Climb.

### first-seat — a fragment carried home instead
*Direction: line 3 lands soft. It's the closest she comes to saying she's proud.*
1. Telemetry says you went down heavy and came up empty.
2. Cindral flagged the delivery as failed. I logged it as: driller declined.
3. I've never typed that before. It felt good.

### cores-2 — second core
1. Two of them now. Two.
2. I went back through the closure records. Every site Cindral has ever exhausted went dark.
3. Not poor. Dark. No daylight in the survey imaging, not anywhere on the planet.

### cores-3 — all three cores. Her last transmission.
*Direction: her goodbye. Steady until the last line, which is allowed to catch.*
1. That's all of them.
2. Cindral's rotating me off the dish. New contract, new rig, somebody else's driller.
3. Whatever you decide to do with what you're carrying — you were the good one. Dispatch out.

---

## Field lessons (ad-hoc transmissions)

*Direction: these fire mid-crisis, the first time each hazard shows itself.
Faster and sharper than the story beats — she's talking you through something
that is happening right now.*

### rime-taught — the shaft heals over (CRYOS-2)
1. Your shaft is skinning over behind you. That is not drift — the ice is closing the wound.
2. Young ice will not hold a pod. If the way home has healed, put your nose up and ram through it.
3. And fit the acclimation. A warm hull keeps your wake open longer. Not in the manual; it is in the wrecks.

### longone-taught — the Long One (VEIL-3)
1. That noise through the rock was not the rock. Something down there hunts by the sound of a drill.
2. It cannot see. Stop cutting and it loses you. Stop moving and it forgets you. Then dig somewhere else.

### mimic-taught — the geode mimic (VEIL-3)
*Direction: the one genuinely funny beat she gets. Let her enjoy it.*
1. Ha. You cut a geode and it grew legs and ran off with your best stone. Yes. That happens down there.
2. They are not fast. Put a drill in it before it climbs out of your lamp and the ore comes back.

### rimewing-taught — Rimewings (CRYOS-2)
1. Those are Rimewings. They sleep in the walls and they wake to warmth — engine heat, drill heat.
2. Coast when you can. Fly cold. A flare will pull them off you: they go for the hotter thing.

### brinewyrm-taught — the Brinewyrm (CRYOS-2)
1. Do not hover over the brine. Something lives in those pools that hears your engine through the water.
2. You will see it churn before it comes up. That is your one warning. Move, or throw it a flare to bite.

### stillwalker-taught — the Stillwalker (CRYOS-2)
*Direction: the most urgent read in the game. She is scared for you.*
1. Listen to me. Whatever you just lit, keep it lit. They do not move while they are seen.
2. Turn your lamp off in the deep and they walk. Through the ice. At you. It only stops when the light finds it.

### frostbloom-taught — Frostbloom (CRYOS-2)
1. Frostbloom. A pale flower in the veinlight. Cut it and the cold comes out all at once.
2. It just cost you fuel and sealed your pocket in young ice. Young ice will not hold a pod — ram up through it.

### polyp-taught — pressure polyps (MAELIS-6)
1. Pressure polyps. They grow where the rock is thin and they burst when something moves past them.
2. Look for the pulse. Anything glowing in a rhythm down there is counting, and it is counting you.

### riptide-taught — the riptide (MAELIS-6)
1. You felt that pull. That was not current. It was the room deciding it wants you in the middle of it.
2. It only has a grip in open water. Keep a wall at your back. Narrow shafts are your friend on this one.

### shellback-taught — the Shellback (MAELIS-6)
1. A Shellback. It walks your tunnels behind you and seals them shut with its own shell — nacre.
2. Nacre cuts easy and it sells. If one is walling you in, that is a vein it is laying for you. Or kill it: it drops more.

### kindled-taught — the Kindled (fragment chambers)
*Direction: hushed. She's describing something she can only half believe.*
1. There are figures on the chamber floor. Made of the same light as the fragment. Do not walk into one.
2. They are not guarding it. I think they are waiting for it to be taken. Take it, and see.
