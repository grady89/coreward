# Round 6 plan

Best = c5bced5 (r6/best, GPU). Scores: vaults 6.1, lighting 6.3, rock 6.4, fluids 6.4, characters 6.4, identity 7.0, ui 7.2, minerals 7.2.

Sequential, each its own commit:
1. **K1 characters — only the praised parts of J3** (characters). Pilot amber gloves, boots and pack band (read at vault scale); shellback spill as wide/bright as the stillwalker's. No glimmerfly or pod changes this time. Check the fauna sandbox frames for the dread wash and creature staging before reporting.
2. **K2 fluids/lighting — fissures light their stone, by adding to the halo** (fluids, lighting, rock). Keep the existing per-tile halo exactly and add a stronger, wider neighbour wash and a brighter host-face glow; no change to crack shapes; dark between clusters.
3. **K3 vaults — vertical solids and edges** (vaults). Different from rejected I5 (global falloff haze) and from J4 (tops): collidable vertical faces get a side rim/value lift so pillars and masses don't blend into the wall; the baked wall darkens toward the room's outer edges (a vignette in the bake, one texture fetch); sconce pools a little wider on the masonry.
4. **K4 rock — per-world surface character** (rock, identity). CRYOS: sharp crystal catch-lights on lamp-lit faces; MAELIS: a subtle nacre hue shift on lit faces; VEIL unchanged. Never within 1 tile of an ore (the matte guard); never brighter than ore.
5. **K5 lighting — backwall depth and the title's uplight** (lighting, ui). Cave backwall falls off toward black with distance from the lit pocket and toward the frame edges (black only for true void); a faint warm uplight rising from the bottom of the title frame.
