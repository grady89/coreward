# Rejected approaches

## r1 F5 — bloom via EffectComposer, default ON, XR-target trick (ea3072d) — failed the GATE, not scored
- Approach: `src/fx/post.ts` composer (half-float 4×MSAA target flagged isXRRenderTarget so materials tone-map as on canvas), UnrealBloomPass 0.6/0.4/thr 1.0 with a max-channel high pass, HDR gains via onBeforeCompile on fluids/gems/fissures/windows/beacons/practicals/core/suit lens; "Bloom" setting default on.
- Gate: `vaults.mjs` 37–39/47 with default settings (SwiftShader game clock ran at 0.06× wall vs 0.36× without bloom, so its wall-clock checks miss); 45–46/47 even with bloom forced off ("buffer through spark", "dead surface"). Same suite 47/47 on the commit before (8a82786), twice.
- Why it lost: breaks a gate suite. Likely causes: bloom cost on software GL, and first-use program compiles from the new HDR material variants landing inside the suite's wall-clock windows.
- Next time, differently: bloom must not be on for software renderers by default (detect SwiftShader/llvmpipe via WEBGL_debug_renderer_info → default off; shots opt in explicitly), and the HDR variants must not add new programs at play time (prewarm, or no onBeforeCompile key changes).

## r2 G3 — rock faceting in the rock shader: diagonal split facets, chamfer + crevice line, per-block hue, MAELIS nacre (40af0eb) — reverted
- Scores (paired, r2): rock 5.0 → 6.3 (+1.3, its own category) but minerals 7.0 → 6.3 (−0.7).
- Why it lost: the new face shading filled the whole ore host tile with the halo colour, so F1's soft radial ore halos became hard glowing squares ("ores look like UI tiles"). Bisected on GPU shots: square halos first appear at 40af0eb; round at f9cfe06.
- Also noted by the rock reviewer: the one-diagonal-per-block split reads as a repeating stamped pattern; fissure halos on the stone weakened.
- Next time, differently: facet the rock through geometry (a bevelled/chamfered low-poly box with flat normals, varied per instance), not a fragment-shader split, and leave the ore halo / fissure wash terms untouched (radial, not clipped to the face).

## r2 G5 — bloom, second approach: default on for hardware GPUs, off on software GL; threshold 1.4; HDR gains incl. ore/gem glow 0.45 (d33a119) — reverted
- Passed the gate (vaults.mjs 47/47 on SwiftShader defaults).
- Scores: lighting rose overall (4.4 → 6.4, shared with G1/G2/G3); minerals fell 7.0 → 6.3. Bisect shots: the bloom build blows voidopal/mimic facets out to white-pink and copper's teal crust to mint ("overexposed gem surfaces wash out colour identity").
- Why it lost: dropped minerals by > 0.3; its own gain can't be separated from G2's beam.
- Next time, differently: no HDR gain on ore/gem materials at all (let the existing halo carry ore glow), cap emissive so facet hue survives; bloom only on fluids, fissure cores, sconces/censers, visors, core, windows/beacons.

## r3 H1 — rock faceting through geometry: chamfered template block, per-instance bevel/tilt, per-bed hue, world hue carried in lamp-lit diffuse (d8baeb1) — reverted
- Scores (paired, r3): rock 5.4 → 6.4 (+1.0), identity +0.4, but minerals 6.8 → 6.3 (−0.5).
- Why it lost: the minerals reviewer: "B's bright orange/blue rock facets compete with same-hue ores (gold, embershard, copper, rime salt) and dilute their tells"; the brief wants matte dark host rock so the ore is the light. Also: the facet split still reads as a repeated pattern; bright bevels frame ore tiles into squares.
- Kept from it: the per-chunk frustum culling follow-up (6499678) — a pure perf change.
- Next time, differently: any rock relief must stay dark and low-saturation where lit — value contrast from shadow, not from bright world-hued lit faces; and rock within ~1 tile of an ore stays matte-dark so the ore is the light. Two shader/geometry attempts at "faceted rock" have now cost minerals; consider leaving rock relief alone.

## r4 I5 — vaults: light-falloff wall haze, gravity-zone punch (wall ×0.26 behind zones, stronger chevrons), 2×2 dressed footing patches, lights moved in front of the play plane, wider pools (d684aff) — reverted
- Gate passed (vaults.mjs 47/47 ×2, all routes).
- Scores (paired, r4): vaults 5.9 → 6.1 (+0.2) — within noise. The reviewer saw the two builds as "nearly identical"; it preferred the candidate's broader warmer sconce washes in EMBER but nothing else changed its read.
- Why it lost: below the 0.3 bar. The remaining vault complaints (wall as bright as footing in VAULT/RETURN, footing tops unlit in RETURN/KINDLED, sparse warm light in RETURN, black spawn-gate box, faint fangs in dark rooms) weren't moved enough.
- Next time, differently: target the specific frames the reviewer marks lowest (RETURN spawn/room at 5) — lit walkable top faces independent of nearby lights, a tinted spawn-gate interior instead of a black box, emissive fang tips in unlit rooms — rather than global wall/haze retuning.

## r5 J1 — rock: halved surface jitter, near-black deep stone (strata floor down, ambient halved, pod light cut by distance from air), connected fissure veins (seamPose, 5 crack classes) with a per-instance 3×3 vein glow replacing the per-tile host disc (ae07d25) — reverted
- Scores (paired, r5): rock 6.4 → 5.8 (−0.6). Identity and lighting reviewers also saw the deep fissures "lose their glow halo" and read as "flat line decals".
- Why it lost: the new vein glow (strength 0.24, normalised) was weaker than the old per-tile fissure halo + wash it replaced, so the one thing every reviewer asks for — fissures that light their stone — went backwards; the darker deep rock made that worse.
- Next time, differently: keep the existing per-tile halo and ADD to it; any vein continuity must not lower per-fissure brightness.

## r5 J3 — characters: amber gloves/boots/pack on the pilot, hull light floor, wider shellback/warden pools + stronger point lights, glimmerfly hooked strand (900e420) — reverted
- Scores (paired, r5): characters 6.3 → 6.0 (−0.3).
- Why it lost: the reviewer liked the trim and shellback spill but marked the glimmerfly frame down for a red haze flooding the frame and the stillwalker shot for the creature sitting off-frame. Both look like shot-state variance in the fauna sandbox (dread wash during the hunt; stillwalker staging) rather than art, but the rule is the rule.
- Next time, differently: land the pilot trim and shellback spill on their own (they were praised); check the fauna sandbox frames for the dread wash and staging before scoring.

## r5 J4 (part) — fang-tip ember glints (in 63b2a33) — removed, rest of J4 kept
- Vault reviewer: fangs became "thin pins with bulb tips that look like candles or grass" — a hazard-readability regression. Vault readability is a hard rule, so the glints are removed even though J4 as a whole scored +0.3.

## r6 K2 — fissure heat field: per-corner seam heat baked in spill() + crack-trunk glow band, on top of the kept per-tile halo (35731ea) — reverted
- Scores (paired, r6): rock 6.3 → 5.7 (−0.6), fluids 6.8 → 6.4 (−0.4); lighting liked the wash.
- Why it lost: the heat field lit whole fissure blocks to a uniform saturated orange/cyan/green, so the cracks stopped reading as the light source and the dark between them shrank ("no dark stone for the fissures to light"). The best build — darker host stone with the glow centred on the crack — is what reviewers want.
- Next time, differently: brightness must fall off FROM the crack line within the host face (crack-centred, radial), not raise the whole block; any neighbour spill tight and dim.

## r6 K4 — per-world rock surface: CRYOS crystal catch-lights (hashed facet normals in specular), MAELIS nacre hue drift on lit diffuse (d1570f5) — reverted
- Scores: rock fell (mostly K2's doing); the rock reviewer still saw "per-world material character is only a hue tint" on both sides, so K4 earned no rock credit; identity +0.2 (frost glints, faint nacre) — below the bar. The identity reviewer read the glints as "small dash marks" and the nacre as too faint.
- Next time, differently: if retried, softer point-like glints only where the beam lands and a nacre strong enough to read — but it's a low-yield direction.

## r7 L2 — topsoil graded darker below the surface line, calmer irregular per-block values near the surface (8b9eb7f) — reverted
- Scores (paired, r7): rock 5.8 → 5.8 (0.0). The reviewer saw the rock as pixel-equivalent; the change only shows on veil3-surface/title, one shot of eleven in the rock set.
- Next time: the surface checkerboard is a narrow complaint; the rock score is held down by the general "flat square tiles" read, which five attempts didn't crack without costing minerals or fissures.

## r7 L3 — shellback body drawn after its own light pool (renderOrder), darker plates/legs; pod hull/belly self-lit value floor (764872f) — reverted
- Scores (paired, r7): characters 6.2 → 6.4 (+0.2) — below the bar. The reviewer credited the shellback's restored shell plates, and the glimmerfly frame no longer flooding red (the harness fix, in both builds).
- Next time: the shellback form fix is cheap and liked; it could ride along with a bigger characters change.
