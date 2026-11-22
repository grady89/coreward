# Rejected approaches

## r1 F5 — bloom via EffectComposer, default ON, XR-target trick (ea3072d) — failed the GATE, not scored
- Approach: `src/fx/post.ts` composer (half-float 4×MSAA target flagged isXRRenderTarget so materials tone-map as on canvas), UnrealBloomPass 0.6/0.4/thr 1.0 with a max-channel high pass, HDR gains via onBeforeCompile on fluids/gems/fissures/windows/beacons/practicals/core/suit lens; "Bloom" setting default on.
- Gate: `vaults.mjs` 37–39/47 with default settings (SwiftShader game clock ran at 0.06× wall vs 0.36× without bloom, so its wall-clock checks miss); 45–46/47 even with bloom forced off ("buffer through spark", "dead surface"). Same suite 47/47 on the commit before (8a82786), twice.
- Why it lost: breaks a gate suite. Likely causes: bloom cost on software GL, and first-use program compiles from the new HDR material variants landing inside the suite's wall-clock windows.
- Next time, differently: bloom must not be on for software renderers by default (detect SwiftShader/llvmpipe via WEBGL_debug_renderer_info → default off; shots opt in explicitly), and the HDR variants must not add new programs at play time (prewarm, or no onBeforeCompile key changes).
