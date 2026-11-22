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
