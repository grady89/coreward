# Round 7 plan (last round)

Best = 9f29607 (r7/best, GPU). Scores: characters 6.3, rock 6.4, fluids 6.4, vaults 6.6, lighting 6.8, ui 6.8, identity 7.0, minerals 7.2.

Sequential, each its own commit:
1. **L1 fluids — fluid bodies that aren't flat slabs, and a core chamber with falloff** (fluids). The large fluid masses at the frame edges in the deep/core shots (falls, side bodies) read as "flat unshaded colour rectangles / missing geometry": give every exposed fluid face the on-screen pool's treatment (bright surface line where it meets air, depth gradient, shimmer). Core chamber: a radial falloff from the core so far walls/ceiling go darker (keep I2's flood near the core), and hide the visible backdrop box edge top-right.
2. **L2 rock — the surface topsoil** (rock). The flat bright orange checkerboard on veil3-surface: grade the topsoil darker with depth below the surface line and break the alternating light/dark tile values (calmer per-block values near the surface only). Nothing below ~row 30 changes; fissures, ores and the matte guard untouched.
3. **L3 characters — a readable shellback and a pod that holds its value** (characters). Restore the shellback's segmented body/leg silhouette inside its stronger glow (K1 made it read as a "crystal clump"), and give the pod body a faint self-lit rim so its white facets read at play scale in the dark (hud-play), finishes intact.
