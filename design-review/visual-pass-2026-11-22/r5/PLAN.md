# Round 5 plan

Best = 93dddfe (r5/best, GPU). Scores: rock 6.4, characters 6.4, fluids 6.4, lighting 6.5, vaults 6.6, identity 7.0, ui 7.2, minerals 7.2.

Sequential, each its own commit:
1. **J1 rock — dark discipline and veins that cross tiles** (rock; also lighting, fluids). I1's per-block jitter reads as a checkerboard on topsoil/title/surface and lifts unlit rock in dense deep fields (veil3-fissures/deep) — halve jitter near the surface, pull unlit deep rock back toward near-black; fissure strokes continue across neighbouring fissure tiles as connected veins with a tight warm falloff onto the neighbouring faces, dark between clusters.
2. **J2 lighting/fluids — a faceted core with depth, and a beam that lands** (lighting, fluids). Core fragment: higher-detail faceted body with internal value/fresnel instead of a flat overexposed disc, a hotter floor pool directly beneath; headlamp beam gets a hit hotspot where the cone meets rock (faces inside the cone brighter than outside).
3. **J3 characters — trim, rim and creature light** (characters). Pilot's orange trim visible at play scale (gloves, boots, pack); pod keeps its value as the one lit object (faint self-rim); shellback/warden spill as strong as the stillwalker's; glimmerfly swarm spread along a trailing curve within the 0.6-tile cap.
4. **J4 vaults — the lowest frames: RETURN and KINDLED** (vaults). Walkable top faces get a lit edge independent of nearby lights; the spawn gate interior is a dim tinted doorway, not a black box; fang tips emissive in unlit rooms. Visual only, no room data.
