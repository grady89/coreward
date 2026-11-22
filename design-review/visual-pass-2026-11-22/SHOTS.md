# Visual pass 2026-11-22 — the fixed shot list

Produced by `scripts/visualshots.mjs <outdir> --port=4190`. Math.random is seeded before load (fixes the world seed); the camera is frozen at a scripted pose; threats off outside the fauna sandbox; Dispatch muted and toasts cleared before every frame. 1280×800, SwiftShader.

Perf proxies from `renderer.info` at the frame shot (calls, triangles) and the scene's light count (total / visible+on). SwiftShader frame time is meaningless and not recorded.

| shot | what | categories | calls | tris | lights |
|---|---|---|---|---|---|
| title | Title screen after 2.5 s game time, fresh save. | lighting, ui | 469 | 64660 | 55/17 |
| veil3-surface | VEIL-3 surface after New Game, camera frozen at (30.5, 3.2, z14), the three gantries. | rock, lighting, ui | 348 | 59434 | 55/17 |
| pod-pilot-eva | Pod + pilot on EVA on the landing pad, close camera z4.6. | lighting, characters | 254 | 58578 | 55/15 |
| hud-play | HUD in play: VEIL-3 row 40 pocket, 7 cargo, fuel 62 %, hull 80 %. | characters, ui | 65 | 78672 | 55/7 |
| shop-trade | Trade post panel open with that cargo. | ui | 365 | 61580 | 55/17 |
| veil3-core | veil3 core chamber mouth (?core=veil3 dev jump), z12.5. | lighting, identity, fluids | 118 | 50764 | 55/12 |
| veil3-shallow | veil3 row 60: carved pocket, lamp on, 4-wide fluid basin right of the pod, z12.5. | rock, lighting, identity, fluids | 69 | 72956 | 55/7 |
| veil3-mid | veil3 row 230: carved pocket, lamp on, 4-wide fluid basin right of the pod, z12.5. | rock, lighting, identity | 89 | 83732 | 55/7 |
| veil3-deep | veil3 row 440: carved pocket, lamp on, 4-wide fluid basin right of the pod, z12.5. | rock, lighting, identity, fluids | 197 | 94746 | 55/8 |
| veil3-fissures | VEIL-3 row 400 (Emberreach) small pocket, heat fissures on the surrounding rock. | rock, lighting, fluids | 155 | 75556 | 55/7 |
| ore-copper | copper: 4-tile vein in the wall the lamp faces, veil3 row 150, gameplay zoom z12.5. | minerals | 78 | 69530 | 55/7 |
| ore-copper-close | copper: close-up of the same vein, z4.6. | minerals | 60 | 67364 | 55/7 |
| ore-iron | iron: 4-tile vein in the wall the lamp faces, veil3 row 150, gameplay zoom z12.5. | minerals | 77 | 68922 | 55/7 |
| ore-iron-close | iron: close-up of the same vein, z4.6. | minerals | 59 | 66756 | 55/7 |
| ore-silver | silver: 4-tile vein in the wall the lamp faces, veil3 row 150, gameplay zoom z12.5. | minerals | 77 | 68922 | 55/7 |
| ore-silver-close | silver: close-up of the same vein, z4.6. | minerals | 59 | 66756 | 55/7 |
| ore-gold | gold: 4-tile vein in the wall the lamp faces, veil3 row 150, gameplay zoom z12.5. | minerals | 78 | 69450 | 55/7 |
| ore-gold-close | gold: close-up of the same vein, z4.6. | minerals | 60 | 67284 | 55/7 |
| ore-ruby | ruby: 4-tile vein in the wall the lamp faces, veil3 row 150, gameplay zoom z12.5. | minerals | 78 | 68890 | 55/7 |
| ore-ruby-close | ruby: close-up of the same vein, z4.6. | minerals | 60 | 66724 | 55/7 |
| ore-voidopal | voidopal: 4-tile vein in the wall the lamp faces, veil3 row 150, gameplay zoom z12.5. | minerals | 78 | 69050 | 55/7 |
| ore-voidopal-close | voidopal: close-up of the same vein, z4.6. | minerals | 60 | 66884 | 55/7 |
| ore-diamond | diamond: 4-tile vein in the wall the lamp faces, veil3 row 150, gameplay zoom z12.5. | minerals | 78 | 68970 | 55/7 |
| ore-diamond-close | diamond: close-up of the same vein, z4.6. | minerals | 60 | 66804 | 55/7 |
| ore-embershard | embershard: 4-tile vein in the wall the lamp faces, veil3 row 150, gameplay zoom z12.5. | minerals | 78 | 69018 | 55/7 |
| ore-embershard-close | embershard: close-up of the same vein, z4.6. | minerals | 60 | 66852 | 55/7 |
| ore-veinlight | veinlight: 4-tile vein in the wall the lamp faces, veil3 row 150, gameplay zoom z12.5. | minerals | 78 | 69906 | 55/7 |
| ore-veinlight-close | veinlight: close-up of the same vein, z4.6. | minerals | 60 | 67740 | 55/7 |
| ore-mimic | mimic: 4-tile vein in the wall the lamp faces, veil3 row 150, gameplay zoom z12.5. | minerals | 78 | 70746 | 55/7 |
| ore-mimic-close | mimic: close-up of the same vein, z4.6. | minerals | 60 | 68580 | 55/7 |
| ore-lineup | VEIL-3 row 160: all 13 ore kinds in a row in the floor of a carved shelf, rock between each, z15.5. | minerals | 78 | 61828 | 55/7 |
| cryos2-core | cryos2 core chamber mouth (?core=cryos2 dev jump), z12.5. | lighting, identity, fluids | 117 | 49792 | 54/12 |
| cryos2-shallow | cryos2 row 60: carved pocket, lamp on, 4-wide fluid basin right of the pod, z12.5. | rock, identity, fluids | 89 | 77564 | 54/7 |
| cryos2-mid | cryos2 row 230: carved pocket, lamp on, 4-wide fluid basin right of the pod, z12.5. | rock, lighting, identity | 96 | 82246 | 54/7 |
| cryos2-deep | cryos2 row 440: carved pocket, lamp on, 4-wide fluid basin right of the pod, z12.5. | rock, identity, fluids | 188 | 87312 | 54/8 |
| ore-frostbloom | frostbloom: 4-tile vein in the wall the lamp faces, cryos2 row 150, gameplay zoom z12.5. | minerals | 94 | 70132 | 54/7 |
| ore-frostbloom-close | frostbloom: close-up of the same vein, z4.6. | minerals | 76 | 67966 | 54/7 |
| ore-rime-salt | rime-salt: 4-tile vein in the wall the lamp faces, cryos2 row 150, gameplay zoom z12.5. | minerals | 93 | 69812 | 54/7 |
| ore-rime-salt-close | rime-salt: close-up of the same vein, z4.6. | minerals | 75 | 67646 | 54/7 |
| maelis6-core | maelis6 core chamber mouth (?core=maelis6 dev jump), z12.5. | lighting, identity, fluids | 121 | 49420 | 54/12 |
| maelis6-shallow | maelis6 row 60: carved pocket, lamp on, 4-wide fluid basin right of the pod, z12.5. | rock, identity | 89 | 88316 | 54/7 |
| maelis6-mid | maelis6 row 230: carved pocket, lamp on, 4-wide fluid basin right of the pod, z12.5. | rock, lighting, identity, fluids | 91 | 86774 | 54/7 |
| maelis6-deep | maelis6 row 440: carved pocket, lamp on, 4-wide fluid basin right of the pod, z12.5. | rock, identity, fluids | 186 | 85780 | 54/8 |
| ore-nacre | nacre: 4-tile vein in the wall the lamp faces, maelis6 row 150, gameplay zoom z12.5. | minerals | 89 | 76098 | 54/7 |
| ore-nacre-close | nacre: close-up of the same vein, z4.6. | minerals | 71 | 73932 | 54/7 |
| creature-glimmerflies | ?fauna=glimmerflies after 5 s game time, sandbox framing held, card hidden. | characters | 95 | 78184 | 55/8 |
| creature-warden | ?fauna=warden after 5 s game time, sandbox framing held, card hidden. | characters | 172 | 74434 | 55/7 |
| creature-stillwalkers | ?fauna=stillwalkers after 5 s game time, sandbox framing held, card hidden. | characters | 233 | 81932 | 54/7 |
| creature-shellbacks | ?fauna=shellbacks after 5 s game time, sandbox framing held, card hidden. | characters | 91 | 88135 | 54/8 |
| vault-vault-spawn | ?vault=vault at spawn, the game's own chamber framing, 1.5 s vault time. | characters, vaults | 309 | 15226 | 9/5 |
| vault-vault-room | ?vault=vault whole room framed to fit. | vaults | 846 | 34992 | 9/5 |
| vault-ember-spawn | ?vault=ember at spawn, the game's own chamber framing, 1.5 s vault time. | vaults | 451 | 22242 | 15/14 |
| vault-ember-room | ?vault=ember whole room framed to fit. | vaults | 1660 | 55476 | 15/14 |
| vault-debt-spawn | ?vault=debt at spawn, the game's own chamber framing, 1.5 s vault time. | vaults | 358 | 37152 | 8/4 |
| vault-debt-room | ?vault=debt whole room framed to fit. | vaults | 772 | 45606 | 8/4 |
| vault-return-spawn | ?vault=return at spawn, the game's own chamber framing, 1.5 s vault time. | vaults | 120 | 16154 | 6/6 |
| vault-return-room | ?vault=return whole room framed to fit. | vaults | 595 | 31904 | 6/6 |
| vault-kindled-spawn | ?vault=kindled at spawn, the game's own chamber framing, 1.5 s vault time. | vaults | 384 | 36226 | 14/11 |
| vault-kindled-room | ?vault=kindled whole room framed to fit. | vaults | 2470 | 126376 | 14/11 |
| ending-page | EXTRACT ending page (deliver the third fragment), 4 s after the page opens. | ui | 364 | 61568 | 55/17 |

**Change from round 3:** `vault-*-room` now waits 6 s of vault time (the room's far stone flies in on arrival and read as debris) and caps the camera distance at 26, centred on the pilot's part of the room when the cap crops it. Best and candidate are always shot with the same script; round 3's best was re-shot (`r3/best`).
