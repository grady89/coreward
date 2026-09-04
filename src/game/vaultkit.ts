import * as THREE from 'three';

// THE VAULT KIT'S DRESS (SPEC-VAULTS-2 §VI, phase V3.5).
//
// Every object the player reads, built to the reference sheets in
// reference-art/ — hazard-family, light-family, curtain-current. The kit was
// lint-locked in V3 and nothing here changes a rule: these are constructors
// and material values only. The mechanics live in vault.ts, which owns the
// clocks, the collisions and the state; this file owns what they look like.
//
// Three rules carry the whole sheet, and they are the reason the objects
// read as one guild's work:
//
//   STONE CARRIES — pedestals, piers, anchor posts, piston housings. Matte,
//                   lit, structural. If a thing is bolted to the room, its
//                   foot is stone.
//   BRONZE HOLDS  — cups, crowns, collars, rails, cages, chains. Turned and
//                   machined, warm metal, still doing its job.
//   LIGHT WORKS   — the flame, the bolt, the cone, the deck of a bridge.
//                   Always unlit material (Basic/Line/Points) or additive,
//                   never a lit surface, because a hazard the dark can hide
//                   is a fang (P2, and the `dark hazards emissive` lint).
//
// Nothing here uses a new pipeline: primitives, quads, canvas textures,
// buffer strips with vertex colours. Same as everything else in the game.

// ---------------------------------------------------------------------------
// architecture as chronology (§VI): one dress per act, three acts
// ---------------------------------------------------------------------------

/** Act I maintained · Act II stripped · Act III hurried. */
export type Act = 'maintained' | 'stripped' | 'hurried';

export const actOf = (world: string): Act =>
  world === 'veil3' ? 'maintained' : world === 'cryos2' ? 'stripped' : 'hurried';

/**
 * The rim lattice's final values per act — the tombs get older as the light
 * got scarcer. Act I's courses run long and even with tight joints and few
 * dead seams; Act II is the same masonry with the ornament gone and a third
 * of its seams given out; Act III is bright but mismatched — short courses,
 * wide random joints, cracks that wander off their line.
 *
 * The lattice's GEOMETRY is deliberately untouched: it was already at bar.
 * These are the values it runs on.
 */
export interface LatticeDress {
  /** the constant rim every solid face carries */
  rim: number;
  /** chance a mason's seam gave out centuries ago */
  dead: number;
  /** how far a crack is allowed to wander off its course */
  crooked: number;
  /** course length between joints */
  segMin: number; segVar: number;
  /** the joint itself */
  gapMin: number; gapVar: number;
}

export const LATTICE: Record<Act, LatticeDress> = {
  maintained: { rim: 0.34, dead: 0.16, crooked: 0, segMin: 0.95, segVar: 1.5, gapMin: 0.06, gapVar: 0.16 },
  stripped: { rim: 0.29, dead: 0.34, crooked: 0.015, segMin: 0.7, segVar: 1.3, gapMin: 0.12, gapVar: 0.3 },
  hurried: { rim: 0.42, dead: 0.26, crooked: 0.05, segMin: 0.35, segVar: 1.9, gapMin: 0.05, gapVar: 0.44 },
};

// ---------------------------------------------------------------------------
// shared materials and textures
// ---------------------------------------------------------------------------

let _disc: THREE.Texture | null = null;
/** a soft radial falloff — the workhorse behind every glow quad */
export function softDisc(): THREE.Texture {
  if (_disc) return _disc;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.45, 'rgba(255,255,255,0.42)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  _disc = new THREE.CanvasTexture(c);
  return _disc;
}

let _smoke: THREE.Texture | null = null;
/** a torn, uneven puff — smoke reads as smoke because its edge is broken */
export function smokePuff(): THREE.Texture {
  if (_smoke) return _smoke;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  for (let i = 0; i < 14; i++) {
    const x = 32 + (Math.random() - 0.5) * 26;
    const y = 32 + (Math.random() - 0.5) * 26;
    const r = 6 + Math.random() * 14;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,0.30)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
  }
  _smoke = new THREE.CanvasTexture(c);
  return _smoke;
}

let _drank: THREE.Texture | null = null;
/**
 * The stain on drank stone (`=`). Not a crack and not a shadow — a matte,
 * blotchy bleach across the course, as if the warmth were pulled out of it
 * unevenly. Drank stone carries a cold rim rather than none (§VII), so the
 * mottle is what tells you the floor will give you nothing back.
 */
export function drankStain(): THREE.Texture {
  if (_drank) return _drank;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * 64, y = Math.random() * 64;
    const r = 4 + Math.random() * 16;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    const a = 0.05 + Math.random() * 0.12;
    grd.addColorStop(0, `rgba(160,176,204,${a})`);
    grd.addColorStop(1, 'rgba(160,176,204,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
  }
  _drank = new THREE.CanvasTexture(c);
  return _drank;
}

/** stone carries — matte, lit, structural */
export const stoneMat = (tint = 0x8a8798): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color: tint, roughness: 0.85, metalness: 0.05, flatShading: true });

/**
 * Bronze holds — turned metal, warm, still doing its job.
 *
 * The metalness is deliberately low. A physically-honest metal reflects its
 * surroundings, and these rooms have no environment to reflect: at metalness
 * 0.9 every fitting in the vault renders as a black cutout, which is exactly
 * what the first dress pass looked like on screen. Bronze here is a warm
 * diffuse alloy that catches the sconces and the lamp, because the object has
 * to be legible before it is correct.
 */
export const bronzeMat = (tint = 0xbb9152): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color: tint, roughness: 0.44, metalness: 0.32, flatShading: true });

/** the darker iron of a housing, a backplate, a thing meant to disappear */
export const ironMat = (tint = 0x6a625a): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color: tint, roughness: 0.68, metalness: 0.22, flatShading: true });

/** light works — never a lit surface */
export const glowMat = (color: number, opacity: number): THREE.MeshBasicMaterial =>
  new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, blending: THREE.AdditiveBlending,
    depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
  });

/** a soft round bloom quad — the halo every working light wears */
export function bloom(size: number, color: number, opacity: number): THREE.Mesh {
  return new THREE.Mesh(new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({
      map: softDisc(), color, transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
}

/** the enamelled accents the guild painted its machines: slate and oxide */
const SLATE = 0x4d6674;
const OXIDE = 0x8e3a28;

// ---------------------------------------------------------------------------
// 1 · THE SCONCE FAMILY
// ---------------------------------------------------------------------------

export interface SconceParts {
  group: THREE.Group;
  /** the flame the run animates — scaled and recoloured every frame */
  flame: THREE.Mesh;
  flameMat: THREE.MeshBasicMaterial;
  /** the hot core and the halo: an UNLIT cup must show neither (the wager) */
  fireMats: THREE.MeshBasicMaterial[];
  /** where the cup ended up in the group's own space, so the light follows */
  cupX: number;
  /** the guttering blue-white's smoke, famine rooms only */
  smoke: THREE.Mesh[];
}

/**
 * A wall sconce, from the light-family sheet: a carved backplate on the
 * masonry, a bracket arm reaching out of it, and a wide shallow bronze cup
 * on a turned baluster stem that drops to a finial. The flame stands ON the
 * cup, never in it — a wick sunk in its own housing is a light nobody can
 * see is lit, which is the one thing a checkpoint may never be.
 *
 * `dead` is the famine's cup (§III `deadLight`): the same fitting with the
 * bronze bowl replaced by cracked stone, its lip broken through, wax run
 * down the outside and long cold. What burns in it is blue-white and it
 * gives nothing back.
 *
 * The act does the chronology: Act I keeps its carved crown and its finial,
 * Act II has had the ornament taken off it, Act III is mounted crooked.
 */
export function buildSconce(act: Act, mount: SconceMount, dead: boolean): SconceParts {
  const g = new THREE.Group();
  // a WALL fitting reaches out of the masonry it is bolted to; with no wall
  // to bolt to it hangs off the ceiling or stands on the floor instead, and
  // in both of those the cup sits over the middle of its own tile
  const facing = mount.kind === 'wall' ? mount.facing : 1;
  const onWall = mount.kind === 'wall';
  const bronze = bronzeMat(dead ? 0xa78f63 : 0xc09a5c);
  const dark = ironMat();

  if (onWall) {
    // the backplate against the masonry — carved in Act I, plain after
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.44, 0.07), dark);
    plate.position.set(0, 0.02, 0);
    g.add(plate);
    if (act === 'maintained') {
      const crown = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.09, 0.09), bronze);
      crown.position.set(0, 0.28, 0.01);
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), bronze);
      bead.position.set(0, 0.35, 0.01);
      g.add(crown, bead);
    }
    const foot = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 6), dark);
    foot.rotation.z = Math.PI;
    foot.position.set(0, -0.24, 0);
    g.add(foot);
    // the bracket arm, reaching out and up to the cup
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.34, 6), bronze);
    arm.rotation.z = facing * -1.05;
    arm.position.set(facing * SCONCE_REACH * 0.5, 0.02, 0.02);
    g.add(arm);
  } else if (mount.kind === 'ceiling') {
    // hung: a plate in the vault above and a rod down to the cup
    const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.09, 8), dark);
    boss.position.y = mount.reach;
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, Math.max(0.1, mount.reach - 0.24), 6), bronze);
    rod.position.y = (mount.reach - 0.24) / 2 + 0.24;
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.04, 0.07, 8), bronze);
    collar.position.y = 0.3;
    g.add(boss, rod, collar);
  } else {
    // standing: a floor pedestal, the same masonry-and-bronze as everything
    // else the guild bolted down
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.09, 10), stoneMat(0x8e8b83));
    base.position.y = -mount.reach;
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.12, Math.max(0.1, mount.reach - 0.14), 8), stoneMat(0x94918a));
    stand.position.y = -(mount.reach - 0.14) / 2 - 0.05;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 8), bronze);
    cap.position.y = -0.08;
    g.add(base, stand, cap);
  }

  const cx = onWall ? facing * SCONCE_REACH : 0;

  // the cup. Bronze in a working room; in the famine, cracked stone.
  if (dead) {
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.085, 0.13, 10),
      new THREE.MeshStandardMaterial({ color: 0x8d8a86, roughness: 0.98, metalness: 0, flatShading: true }));
    bowl.position.set(cx, 0.18, 0);
    g.add(bowl);
    // the lip broken through: two arcs with the bite missing between them
    const lipMat = new THREE.MeshStandardMaterial({ color: 0x7f7d7a, roughness: 0.98, metalness: 0 });
    for (const [start, len] of [[0.35, 2.2], [2.9, 2.6]] as [number, number][]) {
      const arc = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.017, 5, 12, len), lipMat);
      arc.rotation.x = Math.PI / 2;
      arc.rotation.z = start;
      arc.position.set(cx, 0.245, 0);
      g.add(arc);
    }
    // the hairline through the cup, and the second bite lower down
    const crackMat = new THREE.MeshBasicMaterial({ color: 0x100e16 });
    for (const [ox, oy, w, rot] of [[0, 0.19, 0.2, 0.6], [-0.05, 0.11, 0.11, -0.85]]) {
      const cr = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.022), crackMat);
      cr.rotation.z = rot;
      cr.position.set(cx + ox, oy, 0.09);
      g.add(cr);
    }
    // wax that ran down the outside a long time ago and set
    const waxMat = new THREE.MeshStandardMaterial({ color: 0xb6b3ad, roughness: 1, metalness: 0 });
    for (const [ox, len] of [[-0.09, 0.14], [0.02, 0.09], [0.1, 0.12]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.009, len, 5), waxMat);
      w.position.set(cx + ox, 0.2 - len / 2, 0.07);
      g.add(w);
    }
  } else {
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.075, 0.12, 12), bronze);
    bowl.position.set(cx, 0.18, 0);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.02, 6, 16), bronze);
    lip.rotation.x = Math.PI / 2;
    lip.position.set(cx, 0.24, 0);
    g.add(bowl, lip);
  }

  // the turned baluster under the cup: stem, knop, and — in a room still
  // being maintained — the waist and finial drop hung off the bottom
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.1, 6), bronze);
  stem.position.set(cx, 0.06, 0);
  const knop = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), bronze);
  knop.scale.y = 0.72;
  knop.position.set(cx, 0, 0);
  g.add(stem, knop);
  if (act !== 'stripped' && mount.kind !== 'floor') {
    const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.034, 0.09, 6), bronze);
    waist.position.set(cx, -0.07, 0);
    const drop = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.13, 8), bronze);
    drop.rotation.z = Math.PI;
    drop.position.set(cx, -0.18, 0);
    g.add(waist, drop);
  }

  // the flame. A teardrop, not a bead: a cone tapering up off the wick with a
  // hot core in its belly and a halo behind it. It is additive, because a
  // flame is light in the air and an opaque one reads as a painted egg.
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0x342e22, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.072, 0.24, 10), flameMat);
  flame.position.set(cx, SCONCE_FLAME_Y, 0);
  const coreMat = glowMat(dead ? 0xdce8ff : 0xfff0c8, 0.9);
  const core = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.13, 8), coreMat);
  core.position.y = -0.045;
  const halo = bloom(0.85, dead ? 0x9db8ff : 0xffc98a, 0.5);
  halo.position.set(0, -0.06, -0.05);
  flame.add(core, halo);
  // the cup catches its own flame: without this the bowl stays a black cone
  // under a lit wick, which is the one thing a working sconce cannot look like
  const lipWash = bloom(0.5, dead ? 0x8fb0ff : 0xffb877, 0);
  lipWash.position.set(cx, 0.22, 0.1);
  g.add(flame, lipWash);

  // the famine's cup smokes even before you light it — that is the tell
  const smoke: THREE.Mesh[] = [];
  if (dead) {
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22),
        new THREE.MeshBasicMaterial({
          map: smokePuff(), color: 0xbfd4ff, transparent: true, opacity: 0,
          blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
        }));
      s.position.set(cx, 0.4, 0.02);
      g.add(s);
      smoke.push(s);
    }
  }

  // hurried work is mounted crooked (§VI architecture-as-chronology) — but a
  // standing lamp leans on nothing, so only bracket and hung work goes askew
  if (act === 'hurried' && mount.kind !== 'floor') g.rotation.z = facing * 0.13;

  return {
    group: g, flame, flameMat, smoke, cupX: cx,
    fireMats: [
      coreMat,
      halo.material as THREE.MeshBasicMaterial,
      lipWash.material as THREE.MeshBasicMaterial,
    ],
  };
}

/** how far the cup stands off the wall, and how high the flame rides */
export const SCONCE_REACH = 0.3;
export const SCONCE_FLAME_Y = 0.28;

/**
 * What a sconce is bolted to. Every fitting in this game has a foot: the
 * guild did not hang lights in mid-air, and a cup floating in the middle of
 * a room is the reading equivalent of a beam drawn wider than it bites.
 * `reach` is how far the mount travels to meet its surface.
 */
export type SconceMount =
  | { kind: 'wall'; facing: number }
  | { kind: 'ceiling'; reach: number }
  | { kind: 'floor'; reach: number };

// ---------------------------------------------------------------------------
// 2 · THE BRAZIER — ductwork the guild never turned off
// ---------------------------------------------------------------------------

export interface BrazierParts {
  group: THREE.Group;
  bedMat: THREE.MeshBasicMaterial;
  coals: THREE.Mesh[];
}

/**
 * A hanging ember basket, from the light-family sheet's last panel: three
 * chains off a ring, a shallow beaten bowl, and a bed of coals in it that
 * has not gone out since the guild left. It refunds the spark mid-air and
 * saves nothing, so it must never read as a sconce: no cup, no flame, no
 * post — a basket, and the heat coming off it.
 */
export function buildBrazier(hangY: number): BrazierParts {
  const g = new THREE.Group();
  const bronze = bronzeMat(0xa88448);

  // the ring in the ceiling and the three chains off it
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.014, 5, 10), bronze);
  ring.position.y = hangY;
  g.add(ring);
  const chainMat = new THREE.LineBasicMaterial({ color: 0x8a7350, transparent: true, opacity: 0.75 });
  for (const ox of [-0.24, 0, 0.24]) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, hangY - 0.04, 0),
      new THREE.Vector3(ox, 0.09, ox * 0.35),
    ]);
    g.add(new THREE.Line(geo, chainMat));
  }

  // the bowl: open-ended so you see into it, with a beaten rim
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.14, 0.24, 10, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0x8f7042, roughness: 0.55, metalness: 0.3,
      flatShading: true, side: THREE.DoubleSide,
    }));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.022, 5, 14), bronze);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.12;
  const base = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), bronze);
  base.position.y = -0.14;
  g.add(bowl, rim, base);

  // the bed of coals, seen down into the bowl, and the heat above it
  const bedMat = new THREE.MeshBasicMaterial({
    map: softDisc(), color: 0xff8a30, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  const bed = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.28), bedMat);
  bed.position.set(0, 0.1, 0.02);
  g.add(bed);
  const coals: THREE.Mesh[] = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), glowMat(0xffb45c, 0.85));
    c.position.set(Math.cos(a) * (0.05 + (i % 3) * 0.07), 0.1 + Math.sin(i * 2.3) * 0.02, 0.03);
    c.scale.set(1, 0.6, 1);
    g.add(c);
    coals.push(c);
  }
  const heat = bloom(1.5, 0xff9a48, 0.35);
  heat.position.set(0, 0.3, -0.04);
  g.add(heat);

  return { group: g, bedMat, coals };
}

// ---------------------------------------------------------------------------
// 3 · THE BEAM — the Wardens' grammar in miniature
// ---------------------------------------------------------------------------

export interface EmitterParts {
  group: THREE.Group;
  /** the head and its counterweight arm, turned to the beam's angle */
  yoke: THREE.Group;
  /** the pedestal, which reaches to whatever surface the lantern is bolted to */
  mount: THREE.Group;
  lensMat: THREE.MeshBasicMaterial;
}

/** the pedestal's natural reach before it is stretched to find its footing */
export const EMITTER_REACH = 0.75;

/**
 * The watch-lantern, from its own reference sheet: a stone pedestal, a
 * bronze collar, a gimbal cradling a spherical head with a caged glass
 * front, a finial on top and a counterweight arm out the back. The arm is
 * the reason a parked emitter still tells you which way it will look — it
 * points opposite the lens, and it turns with the rounds.
 */
export function buildEmitter(): EmitterParts {
  const g = new THREE.Group();
  const stone = stoneMat(0x9a978f);
  const bronze = bronzeMat();

  // THE MOUNT. The head sits at the def's own point — that is where the ray
  // is marched from and where the hazard lives — and the pedestal grows OUT
  // of it toward whatever surface the room actually offers. A watch-light
  // hanging in mid-air is furniture the fiction cannot explain, and the
  // guild bolted its lanterns to something.
  //
  // Built pointing DOWN from the head at the origin: the run rotates the
  // whole mount to stand on a floor, hang from a ceiling or bracket off a
  // wall, and stretches the shaft to reach.
  const mount = new THREE.Group();
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.07, 10), bronze);
  collar.position.y = -0.18;
  mount.add(collar);
  // the shaft is a unit column hanging off the collar, scaled to the reach
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1, 10), stone);
  shaft.position.y = -0.5;
  shaft.name = 'shaft';
  const foot = new THREE.Group();
  foot.name = 'foot';
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.09, 10), stone);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.06, 10), stone);
  skirt.position.y = -0.07;
  foot.add(plinth, skirt);
  mount.add(shaft, foot);
  g.add(mount);

  // the gimbal: two rings, so the head reads as free to turn
  for (const rot of [0, Math.PI / 2]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.017, 5, 16), bronze);
    ring.rotation.y = rot;
    g.add(ring);
  }

  // the head itself turns; everything on the yoke aims down +x
  const yoke = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), ironMat(0x6d675d));
  yoke.add(shell);
  const lensMat = glowMat(0xffe9b8, 0.9);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.15, 14), lensMat);
  lens.rotation.y = Math.PI / 2;
  lens.position.x = 0.14;
  const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.155, 0.1, 12, 1, true), bronze);
  hood.rotation.z = Math.PI / 2;
  hood.position.x = 0.15;
  yoke.add(lens, hood);
  for (const oy of [-0.08, 0, 0.08]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.26, 0.02), bronze);
    bar.position.set(0.19, oy, 0);
    yoke.add(bar);
  }
  // the counterweight arm, out the back — the parked emitter's own tell
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.42, 5), bronze);
  arm.rotation.z = Math.PI / 2;
  arm.position.x = -0.28;
  const weight = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), bronze);
  weight.position.x = -0.5;
  yoke.add(arm, weight);
  g.add(yoke);

  return { group: g, yoke, mount, lensMat };
}

/**
 * Stand the pedestal on a real surface. `dir` is which way the mount points
 * out of the head (0 down, 1 up, 2 right, 3 left) and `reach` is how far it
 * has to travel to get there.
 */
export function seatEmitter(parts: EmitterParts, dir: number, reach: number): void {
  parts.mount.rotation.z = dir === 0 ? 0 : dir === 1 ? Math.PI
    : dir === 2 ? -Math.PI / 2 : Math.PI / 2;
  const L = Math.max(0.35, reach - 0.2);
  const shaft = parts.mount.getObjectByName('shaft') as THREE.Mesh;
  const foot = parts.mount.getObjectByName('foot') as THREE.Group;
  shaft.scale.y = L;
  shaft.position.y = -0.18 - L / 2;
  foot.position.y = -0.18 - L;
}

/**
 * The beam.
 *
 * THE RULE THIS OBEYS: a watch-light bites within `BEAM_R` of its ray and
 * nowhere else — a line 0.6 tiles wide, not a floodlight. The first dress
 * pass drew a wedge that widened with distance, which on a long beam painted
 * a hazard some ELEVEN TIMES the one the rule enforces: unavoidable-looking,
 * and dishonest in the direction that matters most, because the player reads
 * the picture and plans against it. The drawn width is therefore capped at
 * the collision radius and the geometry is built in world units, so the two
 * cannot drift apart no matter how far the ray reaches.
 *
 * What that leaves is a lance, not a cone: a hot thin core down the axis with
 * a soft halo either side of it, opening only slightly from the lens. Unit
 * LENGTH along +x, so the run scales x by whatever the march found and leaves
 * y alone.
 */
export function coneGeometry(r: number): THREE.BufferGeometry {
  const N = 20;
  const pos: number[] = [];
  const col: number[] = [];
  // barely opens: the lantern is collimated, and the reference sheet's beam
  // is a shaft you could step over, not a wash you could not
  const halfW = (u: number): number => r * (0.55 + 0.45 * u);
  // hot along the axis, and it dies at the very end rather than stopping at a
  // straight cut edge, which reads as a painted shape instead of reach
  const axis = (u: number): number => (1 - u * 0.35) * Math.min(1, (1 - u) * 7);
  const push = (u: number, v: number, k: number): void => {
    pos.push(u, v * halfW(u), 0);
    col.push(k, k, k);
  };
  // The value profile across the beam is what makes it a LANCE rather than a
  // wash. A linear ramp edge-to-centre paints an even grey column; what reads
  // as a beam is a hard bright thread with a fast-decaying halo, so the flanks
  // are split and fall away steeply, and the core is laid down twice — additive,
  // so the overlap doubles it — leaving the lethal line as the bright line.
  for (let i = 0; i < N; i++) {
    const u0 = i / N, u1 = (i + 1) / N;
    for (const [a, b, ka, kb] of [
      [-1, -0.45, 0, 0.18], [-0.45, -0.16, 0.18, 1], [-0.16, 0.16, 1, 1],
      [0.16, 0.45, 1, 0.18], [0.45, 1, 0.18, 0],
      [-0.16, 0.16, 1, 1],                        // the core again: the thread
    ] as [number, number, number, number][]) {
      push(u0, a, axis(u0) * ka); push(u1, a, axis(u1) * ka); push(u1, b, axis(u1) * kb);
      push(u0, a, axis(u0) * ka); push(u1, b, axis(u1) * kb); push(u0, b, axis(u0) * kb);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return geo;
}

export const coneMaterial = (): THREE.MeshBasicMaterial =>
  new THREE.MeshBasicMaterial({
    color: 0xfff2d8, vertexColors: true, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
  });

// ---------------------------------------------------------------------------
// 4 · THE SHUTTLE — bolts still walking the wire
// ---------------------------------------------------------------------------

/** the stone anchor post a rail is strung between, with its bronze cap */
export function buildRailPost(): THREE.Group {
  const g = new THREE.Group();
  const stone = stoneMat(0x94918a);
  const bronze = bronzeMat();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.21, 0.07, 8), stone);
  base.position.y = -0.2;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.34, 8), stone);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.09, 8), bronze);
  cap.position.y = 0.2;
  const pulley = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 5, 10), bronze);
  pulley.position.y = 0.27;
  g.add(base, shaft, cap, pulley);
  return g;
}

export interface BoltParts {
  group: THREE.Group;
  /** the glass head — what the lint reads, and what you see coming */
  mat: THREE.MeshBasicMaterial;
  wake: THREE.Mesh;
}

/**
 * The bolt: a turned brass carriage running nose-first down the wire with a
 * glass head at the front and a flame wake behind it. Built along +x; the
 * run rotates the whole group to the rail's bearing, so a vertical shuttle
 * is the same object stood on end rather than a different one.
 */
export function buildBolt(): BoltParts {
  const g = new THREE.Group();
  const bronze = bronzeMat(0xcaa259);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.26, 8), bronze);
  body.rotation.z = -Math.PI / 2;
  body.position.x = -0.16;
  const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.1, 0.1, 8), bronze);
  shoulder.rotation.z = -Math.PI / 2;
  shoulder.position.x = -0.02;
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.16, 7), bronze);
  tail.rotation.z = Math.PI / 2;
  tail.position.x = -0.37;
  g.add(body, shoulder, tail);
  // the head: glass, and the only part of this the dark cannot take
  const mat = glowMat(0xffe6b0, 0.95);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), mat);
  head.position.set(0.13, 0, 0.12);   // clear of the carriage it rides on
  const halo = bloom(1, 0xffca7a, 0.75);
  halo.position.set(0.13, 0, 0.13);
  g.add(head, halo);
  // the wake it drags
  const wake = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.3),
    new THREE.MeshBasicMaterial({
      map: softDisc(), color: 0xffb060, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
  wake.position.x = -0.75;
  g.add(wake);
  return { group: g, mat, wake };
}

// ---------------------------------------------------------------------------
// 5 · THE SNUFFER — what the famine made hungry
// ---------------------------------------------------------------------------

export interface MothParts {
  group: THREE.Group;
  wings: [THREE.Group, THREE.Group];
  /** the violet veining — self-luminous, so the dark can never hide the thief */
  mat: THREE.MeshBasicMaterial;
  antennae: THREE.Group[];
}

/** one wing outline: a scalloped, notched blade, hung from the shoulder */
function wingShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.12, 0.16, 0.34, 0.2, 0.5, 0.13);
  s.lineTo(0.56, 0.03);          // the swept tip
  s.lineTo(0.46, 0);
  s.lineTo(0.5, -0.07);          // and the notches down the trailing edge
  s.lineTo(0.36, -0.06);
  s.lineTo(0.38, -0.15);
  s.lineTo(0.24, -0.11);
  s.lineTo(0.22, -0.19);
  s.lineTo(0.1, -0.12);
  s.lineTo(0, 0);
  return s;
}

/**
 * The moth, from its reference sheet: a near-black body with a furred
 * thorax and feathered antennae, and two scalloped wings whose veining
 * glows violet — the un-colour the famine left in the things it made. It
 * steals the light and leaves you standing, so it must never read as a
 * fang: no ember, no red, nothing of the unlight studs' colour.
 */
export function buildSnuffer(): MothParts {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshBasicMaterial({ color: 0x0a0710 });
  const wingMat = new THREE.MeshBasicMaterial({ color: 0x140f1e, side: THREE.DoubleSide });
  const mat = glowMat(0xa855ff, 0.6);

  const thorax = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), bodyMat);
  thorax.scale.set(0.85, 1, 0.85);
  const abdomen = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 8), bodyMat);
  abdomen.rotation.z = Math.PI;
  abdomen.position.y = -0.2;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), bodyMat);
  head.position.y = 0.13;
  g.add(thorax, abdomen, head);

  // feathered antennae — two combs off the head; they twitch when it wakes
  const antennae: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const a = new THREE.Group();
    a.position.set(side * 0.045, 0.17, 0.02);
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.19, 4), bodyMat);
    stalk.position.y = 0.09;
    a.add(stalk);
    for (let i = 1; i <= 4; i++) {
      const barb = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.006, 0.006), bodyMat);
      barb.position.set(side * 0.024, 0.04 * i, 0);
      a.add(barb);
    }
    a.rotation.z = side * -0.42;
    g.add(a);
    antennae.push(a);
  }

  const geo = new THREE.ShapeGeometry(wingShape());
  const wing = (side: number): THREE.Group => {
    const w = new THREE.Group();
    w.position.set(side * 0.1, 0.04, side * 0.02);
    const blade = new THREE.Mesh(geo, wingMat);
    blade.scale.x = side;
    w.add(blade);
    // the veining: the same blade a hair larger, glowing, just behind it —
    // so what the room shows you is a violet outline around a hole
    const vein = new THREE.Mesh(geo, mat);
    vein.scale.set(side * 1.09, 1.09, 1);
    vein.position.z = -0.008;
    w.add(vein);
    // and the bright blotches along the leading edge, per the sheet
    for (const [bx, by, r] of [[0.16, 0.09, 0.17], [0.33, 0.11, 0.14], [0.47, 0.06, 0.1]]) {
      const b = bloom(r, 0xc07dff, 0.55);
      b.position.set(side * bx, by, 0.006);
      w.add(b);
    }
    return w;
  };
  const wl = wing(-1), wr = wing(1);
  g.add(wl, wr);
  const under = bloom(1.1, 0x7b3ce0, 0.3);
  under.position.set(0, -0.1, -0.04);
  g.add(under);

  return { group: g, wings: [wl, wr], mat, antennae };
}

// ---------------------------------------------------------------------------
// 6 · THE CENSER — ride the lantern the way the keepers did
// ---------------------------------------------------------------------------

export interface CenserParts {
  bob: THREE.Group;
  /** the shackle the chain pulls on — the only part that swings with it */
  hanger: THREE.Group;
  /** the glass, a direct child of the bob — the lint's handle on this object */
  glass: THREE.Mesh;
  glassMat: THREE.MeshBasicMaterial;
  flame: THREE.Mesh;
  /** the crown's own wash, brightening as the lantern settles at an apex */
  crownMat: THREE.MeshBasicMaterial;
}

/**
 * The hanging lantern, from the censer sheet: a chain into a flat bronze
 * DECK, a domed cap under it, a caged glass body with the flame inside, a
 * painted machine band, an oxide bowl and a finial ball.
 *
 * The deck is the whole point. The lantern is standable through its entire
 * swing (§III, the ride), so the object has to say "floor" before you jump
 * at it: a flat plate with a raised lip and planks across it, wide enough
 * to read as a place to put your feet and nothing at all like the round
 * glass hanging below it.
 */
export function buildCenser(topY: number): CenserParts {
  const bob = new THREE.Group();
  const bronze = bronzeMat(0xc6a058);
  const dark = ironMat(0x5c554b);

  // THE CROWN — a deck, and it must read as one
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.34, 0.05, 12), bronze);
  deck.position.y = topY - 0.03;
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.022, 5, 16), bronze);
  lip.rotation.x = Math.PI / 2;
  lip.position.y = topY;
  bob.add(deck, lip);
  for (const ox of [-0.18, 0, 0.18]) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.6), bronzeMat(0xa8894c));
    plank.position.set(ox, topY + 0.01, 0);
    bob.add(plank);
  }
  // a low warm wash on the deck, so the standable face is the lit face
  const crownMat = new THREE.MeshBasicMaterial({
    map: softDisc(), color: 0xffd28a, transparent: true, opacity: 0.3,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  const crownGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.34), crownMat);
  crownGlow.position.set(0, topY + 0.08, 0);
  bob.add(crownGlow);

  // THE GIMBAL. The crown is a floor and its collision is a flat horizontal
  // top, so the deck must stay LEVEL through the whole swing — a lantern that
  // rolls with its chain draws a sloping platform you can stand squarely on,
  // which is the drawing contradicting the rule. The guild hung its lamps the
  // way it aimed its watch-lights: on a pin. The fork below the pin belongs to
  // the lantern and stays level; only the shackle above it turns, so the deck
  // being level reads as engineering rather than as a mistake.
  for (const k of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.16, 0.035), bronze);
    arm.position.set(k * 0.09, topY + 0.09, 0);
    bob.add(arm);
  }
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.26, 8), bronze);
  pin.rotation.x = Math.PI / 2;
  pin.position.y = topY + 0.17;
  bob.add(pin);
  const hanger = new THREE.Group();
  hanger.position.y = topY + 0.17;
  const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 5, 12), bronze);
  hanger.add(shackle);
  const eye = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.015, 4, 10), bronze);
  eye.position.y = 0.1;
  eye.rotation.y = Math.PI / 2;
  hanger.add(eye);
  bob.add(hanger);

  // the cap under the deck, and the collar through it
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.22, 0.14, 12), bronze);
  cap.position.y = topY - 0.12;
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.05, 12), dark);
  collar.position.y = topY - 0.2;
  bob.add(cap, collar);

  // the caged glass: the flame inside, bars around it, so the light is a
  // thing in a machine rather than a ball hanging in the air
  const glassMat = glowMat(0xffbe63, 0.8);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.34, 12), glassMat);
  glass.position.y = topY - 0.4;
  bob.add(glass);              // direct child, MeshBasic — the lint's handle
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), glowMat(0xfff2d0, 0.95));
  flame.scale.set(0.8, 1.5, 0.8);
  flame.position.y = topY - 0.42;
  bob.add(flame);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 4), bronze);
    bar.position.set(Math.cos(a) * 0.2, topY - 0.4, Math.sin(a) * 0.2);
    bob.add(bar);
  }
  const halo = bloom(1.2, 0xffb060, 0.3);
  halo.position.y = topY - 0.4;
  bob.add(halo);

  // the machine band, the oxide bowl and the finial — the guild's own paint
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.11, 12),
    new THREE.MeshStandardMaterial({ color: SLATE, roughness: 0.6, metalness: 0.35, flatShading: true }));
  band.position.y = topY - 0.63;
  const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 8), bronze);
  valve.rotation.z = Math.PI / 2;
  valve.position.set(0.24, topY - 0.63, 0);
  const bowl = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: OXIDE, roughness: 0.65, metalness: 0.25, flatShading: true }));
  bowl.position.y = topY - 0.68;
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), bronze);
  finial.position.y = topY - 0.93;
  bob.add(band, valve, bowl, finial);

  return { bob, hanger, glass, glassMat, flame, crownMat };
}

export interface ArcTelegraph {
  group: THREE.Group;
  /** one pad per apex — the two catchable places */
  padMats: [THREE.MeshBasicMaterial, THREE.MeshBasicMaterial];
  pads: [THREE.Mesh, THREE.Mesh];
  /** the smoke the crown drags behind it, so travel has a direction */
  puffs: THREE.Mesh[];
}

/**
 * THE CENSER'S ARC TELEGRAPH (V3.5, carried from V3's hand-validation).
 *
 * The ride works and the collision is already maximally permissive — the
 * crown is standable through the whole swing. What was missing was the
 * picture: a pendulum is briefly still at the ends of its arc and runs
 * through the bottom at nearly twice walk speed, and nothing on screen said
 * so. §III always specified the fix as part of the censer's dress — "chain,
 * arc smoke-trace" — so this is what it draws:
 *
 *   THE TRACE  — the swing path itself, drawn once at crown height, with
 *                its brightness set by how SLOWLY the lantern moves there.
 *                The ends of the arc are hot and the bottom nearly vanishes,
 *                so the shape of the light IS the shape of the timing.
 *   THE PADS   — a mark at each apex, where the lantern is briefly still.
 *                They name the two catchable places, and they fill as the
 *                lantern comes toward them, which is the WHEN that a still
 *                picture could never carry.
 *   THE SMOKE  — a short trail of puffs off the crown, so which way it is
 *                going is legible from one glance rather than two.
 *
 * The landing band is untouched. The target got readable, not bigger.
 */
export function buildArcTelegraph(
  cx: number, cy: number, len: number, arc: number, topY: number,
): ArcTelegraph {
  const g = new THREE.Group();

  const N = 56;
  const pos: number[] = [];
  const col: number[] = [];
  const base = new THREE.Color(0xffc987);
  for (let i = 0; i <= N; i++) {
    const a = -arc + 2 * arc * (i / N);
    pos.push(cx + Math.sin(a) * len, -cy - Math.cos(a) * len + topY, 0.05);
    // a pendulum's speed through a point goes as the cosine of its phase;
    // dwell is the inverse, so the trace burns brightest exactly where the
    // lantern is slow enough to be caught, and nearly vanishes where it runs
    const k = 0.08 + 0.92 * Math.pow(Math.abs(a) / arc, 2.6);
    col.push(base.r * k, base.g * k, base.b * k);
  }
  const traceGeo = new THREE.BufferGeometry();
  traceGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  traceGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.add(new THREE.Line(traceGeo, new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  })));
  // the smoke around that hot line: a ribbon whose WIDTH also follows dwell,
  // so the arc visibly fattens toward the ends. A hairline reads as a wire
  // the eye slides off; this reads as a path with places in it.
  const rp: number[] = [];
  const rc: number[] = [];
  const push = (i: number, side: number): void => {
    const a = -arc + 2 * arc * (i / N);
    const k = 0.08 + 0.92 * Math.pow(Math.abs(a) / arc, 2.6);
    const w = 0.04 + k * 0.16;
    // the arc's own normal points away from the pivot
    rp.push(cx + Math.sin(a) * (len + side * w), -cy - Math.cos(a) * (len + side * w) + topY, 0.04);
    const e = side === 0 ? k * 0.8 : 0;
    rc.push(base.r * e, base.g * e, base.b * e);
  };
  for (let i = 0; i < N; i++) {
    for (const [a2, b2] of [[-1, 0], [0, 1]] as [number, number][]) {
      push(i, a2); push(i + 1, a2); push(i + 1, b2);
      push(i, a2); push(i + 1, b2); push(i, b2);
    }
  }
  const ribGeo = new THREE.BufferGeometry();
  ribGeo.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
  ribGeo.setAttribute('color', new THREE.Float32BufferAttribute(rc, 3));
  g.add(new THREE.Mesh(ribGeo, new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.55, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  })));

  const pad = (sign: number): [THREE.Mesh, THREE.MeshBasicMaterial] => {
    const m = new THREE.MeshBasicMaterial({
      map: softDisc(), color: 0xffdcaa, transparent: true, opacity: 0.3,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.62), m);
    const a = sign * arc;
    mesh.position.set(cx + Math.sin(a) * len, -cy - Math.cos(a) * len + topY + 0.05, 0.06);
    g.add(mesh);
    // a bronze tick either side of the pad: the apex is a PLACE, marked
    for (const k of [-1, 1]) {
      const tick = new THREE.Mesh(new THREE.PlaneGeometry(0.045, 0.26),
        new THREE.MeshBasicMaterial({
          color: 0xffe0b0, transparent: true, opacity: 0.65,
          blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
        }));
      tick.position.set(mesh.position.x + k * 0.42, mesh.position.y + 0.06, 0.06);
      g.add(tick);
    }
    return [mesh, m];
  };
  const [p0, m0] = pad(-1);
  const [p1, m1] = pad(1);

  const puffs: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.36),
      new THREE.MeshBasicMaterial({
        map: smokePuff(), color: 0xdcc6a0, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      }));
    g.add(s);
    puffs.push(s);
  }

  return { group: g, pads: [p0, p1], padMats: [m0, m1], puffs };
}

/** the chain a censer hangs on: links, not a hairline */
export function buildChain(len: number): THREE.Group {
  const g = new THREE.Group();
  const bronze = bronzeMat(0xa8905f);
  const n = Math.max(2, Math.round(len / 0.22));
  for (let i = 0; i < n; i++) {
    const link = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.014, 4, 8), bronze);
    link.position.y = -(i + 0.5) * (len / n);
    link.rotation.y = (i % 2) * Math.PI / 2;
    g.add(link);
  }
  const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.1, 8), ironMat());
  g.add(mount);
  return g;
}

// ---------------------------------------------------------------------------
// 7 · THE CRUSHER — pistons that never got the order to stop
// ---------------------------------------------------------------------------

export interface CrusherParts {
  head: THREE.Group;
  /** the working face's seam — which way it comes from, readable in the dark */
  faceMat: THREE.MeshBasicMaterial;
  /** the housing bolted to the room, and the ram between it and the head */
  housing: THREE.Group;
  ram: THREE.Mesh;
}

/**
 * The piston, from the crusher sheet: a block of the room's own stone with
 * an ember seam network burning through its working face, riding a bronze
 * ram out of a machined housing bolted to the wall behind it.
 *
 * The housing is the readability. A block that visibly slides out of a
 * machine tells you where it comes from and where it goes back to, which is
 * the entire approach read; the seam net does the rest, and it is the only
 * self-luminous thing on the object, facing the way it travels.
 */
export function buildCrusher(w: number, h: number, dx: number, dy: number): CrusherParts {
  const head = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0x77738c, roughness: 0.8, metalness: 0.15, flatShading: true });
  head.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, 1), stone));

  const bronze = bronzeMat(0x9c7f4a);
  const along = dx !== 0;
  const sx = along ? Math.sign(dx) : 0;
  const sy = along ? 0 : -Math.sign(dy);
  const shoe = new THREE.Mesh(
    new THREE.BoxGeometry(along ? 0.12 : w * 1.02, along ? h * 1.02 : 0.12, 1.02), bronze);
  shoe.position.set(sx * w / 2, sy * h / 2, 0);
  head.add(shoe);

  // THE TEETH.
  //
  // This one kills, and unlike the rime shelf it is supposed to: it demands
  // nerve (§III) and it takes the run if you get it wrong. So the platformer
  // grammar that was a lie on the ice is the truth here, and the object must
  // SAY so. A blank stone block sliding out of a wall reads as scenery you
  // could stand on; a row of forged teeth along the striking face reads as
  // the one thing in the room you do not touch. Same rule as everywhere else
  // in this pass, pointing the other way: draw the fang you actually have.
  const teeth = Math.max(3, Math.round((along ? h : w) * 3));
  const span = along ? h : w;
  for (let i = 0; i < teeth; i++) {
    const t = -span / 2 + ((i + 0.5) / teeth) * span;
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.26, 4), bronzeMat(0x8a7444));
    if (along) {
      tooth.position.set(sx * (w / 2 + 0.11), t, 0);
      tooth.rotation.z = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
    } else {
      tooth.position.set(t, sy * (h / 2 + 0.11), 0);
      tooth.rotation.z = sy > 0 ? 0 : Math.PI;
    }
    head.add(tooth);
    // each tooth glows at its root, so the row is legible in a dark room too
    const spark = bloom(0.3, 0xff7a3c, 0.5);
    spark.position.copy(tooth.position);
    head.add(spark);
  }

  // THE SEAM NET — cracks branching across the working face, per the sheet
  const faceW = along ? h : w;
  const seg: number[][] = [];
  for (let i = 0; i < 5; i++) {
    const t0 = -faceW / 2 + (i / 5) * faceW;
    const t1 = -faceW / 2 + ((i + 1) / 5) * faceW;
    // the offsets run one way only: a crack that wanders OUT of the block
    // is a crack floating in the air in front of it
    const j0 = i % 2 ? 0.2 : 0.05;
    const j1 = (i + 1) % 2 ? 0.2 : 0.05;
    seg.push([t0, j0, t1, j1]);
    seg.push([t1, j1, t1 - 0.06 * (i % 2 ? 1 : -1), j1 + 0.22]);
  }
  const pos: number[] = [];
  const faceOff = along ? w / 2 - 0.05 : h / 2 - 0.05;
  for (const [a, b, c, d] of seg) {
    if (along) pos.push(sx * (faceOff - b), a, 0.52, sx * (faceOff - d), c, 0.52);
    else pos.push(a, sy * (faceOff - b), 0.52, c, sy * (faceOff - d), 0.52);
  }
  const netGeo = new THREE.BufferGeometry();
  netGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  head.add(new THREE.LineSegments(netGeo, new THREE.LineBasicMaterial({
    color: 0xffb060, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  })));
  // and the heat behind the cracks, so the face reads at a distance too
  const faceMat = new THREE.MeshBasicMaterial({
    map: softDisc(), color: 0xff6a3c, transparent: true, opacity: 0.7,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  const wash = new THREE.Mesh(new THREE.PlaneGeometry(
    along ? 0.34 : w * 0.8, along ? h * 0.8 : 0.34), faceMat);
  wash.position.set(sx * (faceOff - 0.1), sy * (faceOff - 0.1), 0.51);
  head.add(wash);

  // the housing: what it is bolted to, sitting at the rest end of the travel
  const housing = new THREE.Group();
  housing.add(new THREE.Mesh(new THREE.BoxGeometry(
    along ? 0.5 : w * 0.8, along ? h * 0.8 : 0.5, 0.9), ironMat(0x60594e)));
  for (const k of [-1, 1]) {
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.12, 8), bronze);
    collar.rotation.z = along ? Math.PI / 2 : 0;
    collar.position.set(along ? 0 : k * w * 0.26, along ? k * h * 0.26 : 0, 0.35);
    housing.add(collar);
  }
  // the ram, stretched between housing and head every frame
  const ram = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1, 8), bronze);
  ram.rotation.z = along ? Math.PI / 2 : 0;

  return { head, faceMat, housing, ram };
}

// ---------------------------------------------------------------------------
// 8 · THE RIME SHELF — young ice over old work
// ---------------------------------------------------------------------------

export interface RimeParts {
  group: THREE.Group;
  /** the crack web, drawn on as the shelf gives under you */
  cracks: THREE.LineSegments;
  crackMat: THREE.LineBasicMaterial;
}

/**
 * A course of the guild's masonry under a crust of young ice, from the
 * rime sheet: pale blue, a fringe of frost crystals along the top edge and
 * drips frozen off the underside. It demands commitment, and the way it
 * says so is the crack web — invisible until you stand on it, then
 * spreading from your feet for the whole crumble.
 */
export function buildRime(seed: number): RimeParts {
  const g = new THREE.Group();
  const rnd = (n: number): number => {
    const s = Math.sin(seed * 97.3 + n * 41.7) * 43758.5453;
    return s - Math.floor(s);
  };

  // A PANEL, AND IT IS ICE ALL THE WAY THROUGH.
  //
  // Two rules meet on this object and both were got wrong once.
  //
  // Ice all through: the whole tile goes when the shelf gives — the group is
  // what gets hidden, every part of it — so a masonry course drawn under a
  // crust promises a base that will still be there to stand on. Nothing is.
  // "Young ice over old work" is where the shelf SITS, in the gaps of the
  // guild's stone; it is not what one tile is made of.
  //
  // A panel: the shelf is a thing you land on and lose, and it is read
  // against the bridge decks, which are the room's other come-and-go floor.
  // A slab a whole tile deep reads as architecture — as wall — and a wall is
  // the one thing this is not. So it takes the deck's proportions and sits
  // where the deck sits, in the top of its tile.
  const ice = new THREE.MeshStandardMaterial({
    color: 0xdff2fb, roughness: 0.18, metalness: 0.02,
    emissive: 0x2a4a5e, emissiveIntensity: 0.55,
    transparent: true, opacity: 0.92, flatShading: true,
  });
  const TOP = 0.33;         // top face flush with the tile top, like the deck
  const TH = 0.34;          // and near enough the deck's own thickness
  const slab = new THREE.Mesh(new THREE.BoxGeometry(1, TH, 0.86), ice);
  slab.position.y = TOP;
  g.add(slab);
  // older ice packed into the underside: the same substance gone blue with
  // the weight of itself, so the panel has two ages without having two
  // materials
  const deep = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.12, 0.8),
    new THREE.MeshStandardMaterial({
      color: 0x9fc4d8, roughness: 0.3, metalness: 0.02,
      emissive: 0x1d3a4c, emissiveIntensity: 0.5,
      transparent: true, opacity: 0.85, flatShading: true,
    }));
  deep.position.y = TOP - 0.13;
  g.add(deep);
  // the fracture planes caught between the two ages
  const seamMat = new THREE.MeshBasicMaterial({
    color: 0xdff4ff, transparent: true, opacity: 0.2,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  for (let i = 0; i < 2; i++) {
    const seam = new THREE.Mesh(new THREE.PlaneGeometry(0.8 - rnd(i + 31) * 0.3, 0.012), seamMat);
    seam.position.set((rnd(i + 33) - 0.5) * 0.2, TOP + 0.06 - i * 0.13, 0.44);
    seam.rotation.z = (rnd(i + 35) - 0.5) * 0.12;
    g.add(seam);
  }

  // NOTHING ON THIS OBJECT MAY COME TO A POINT, and nothing on it dangles.
  //
  // The shelf demands commitment (III) — it crumbles, it regrows, and it
  // never kills. Icicles under it read as a spike trap, which is P2 backwards:
  // the drawing advertising a fang the rule does not have. But hanging beads
  // in their place only traded a threat for a cartoon. What a wet, half-gone
  // panel of ice actually has is an EDGE — thinned, scalloped, running out at
  // the corners — so the melt is in the silhouette of the thing rather than
  // in ornaments stuck to it.
  for (let i = 0; i < 8; i++) {
    const lump = new THREE.Mesh(new THREE.SphereGeometry(0.038 + rnd(i) * 0.022, 5, 4), ice);
    lump.position.set(-0.42 + i * 0.12, TOP + TH / 2 - 0.01, 0.2 - rnd(i + 5) * 0.4);
    lump.scale.set(1, 0.42 + rnd(i + 7) * 0.22, 1);
    lump.rotation.z = (rnd(i + 7) - 0.5) * 0.5;
    g.add(lump);
  }
  // the underside, eaten away in shallow scallops rather than hung with drips
  for (let i = 0; i < 5; i++) {
    const bite = new THREE.Mesh(new THREE.SphereGeometry(0.075 + rnd(i + 11) * 0.03, 7, 5), ice);
    bite.position.set(-0.4 + i * 0.2, TOP - TH / 2 + 0.015, 0.28);
    bite.scale.set(1.1, 0.32, 0.5);
    g.add(bite);
  }

  // the crack web, hidden until it takes your weight. Built around its own
  // origin so the spread scales from the middle of the panel outward.
  const pos: number[] = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rnd(i + 21);
    const r0 = 0.05 + rnd(i + 23) * 0.05;
    const r1 = 0.18 + rnd(i + 27) * 0.22;
    const bend = (rnd(i + 29) - 0.5) * 0.7;
    const px = (r: number, ang: number): number => Math.cos(ang) * r;
    const py = (r: number, ang: number): number => Math.sin(ang) * r * 0.34;
    pos.push(px(r0, a), py(r0, a), 0, px(r1, a + bend), py(r1, a + bend), 0);
    pos.push(px(r1, a + bend), py(r1, a + bend), 0,
      px(r1 + 0.15, a + bend * 2), py(r1 + 0.15, a + bend * 2), 0);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const crackMat = new THREE.LineBasicMaterial({
    color: 0xeaf8ff, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  const cracks = new THREE.LineSegments(geo, crackMat);
  cracks.position.set(0, TOP, 0.45);
  g.add(cracks);
  return { group: g, cracks, crackMat };
}

// ---------------------------------------------------------------------------
// 9 · THE LIGHT BRIDGE — floors the guild could afford only half the time
// ---------------------------------------------------------------------------

/**
 * The pier a bridge run springs from, per the light-bridge sheet: a stone
 * pedestal with a bronze band and a lantern post on top. The piers NEVER go
 * out — the deck is the thing that comes and goes, and a run whose ends
 * stay lit is a run whose phase you can read from across the room.
 */
export function buildPier(): { group: THREE.Group; lampMat: THREE.MeshBasicMaterial } {
  const g = new THREE.Group();
  const stone = stoneMat(0x8e8b83);
  const bronze = bronzeMat();
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.16, 0.7), stone);
  base.position.y = -0.42;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.5, 8), stone);
  shaft.position.y = -0.09;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.06, 8), bronze);
  band.position.y = 0.19;
  const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.26, 6, 1, true), bronze);
  cage.position.y = 0.37;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.12, 6), bronze);
  roof.position.y = 0.56;
  const lampMat = glowMat(0xffc98a, 0.85);
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.22, 8), lampMat);
  lamp.position.y = 0.37;
  const halo = bloom(0.9, 0xffb060, 0.5);
  halo.position.y = 0.37;
  g.add(base, shaft, band, cage, roof, lamp, halo);
  return { group: g, lampMat };
}

export interface DeckParts {
  group: THREE.Group;
  deck: THREE.Mesh;
  deckMat: THREE.MeshBasicMaterial;
  /** the hairline left on the stone when the deck is not there */
  traceMat: THREE.MeshBasicMaterial;
}

/** one tile of bridge deck: a course of light with a bright top edge */
export function buildDeck(hue: number): DeckParts {
  const g = new THREE.Group();
  const deckMat = new THREE.MeshBasicMaterial({
    color: hue, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false,
  });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1, 0.34, 0.62), deckMat);
  g.add(deck);
  // the course joints, so a run reads as masonry of light and not a bar
  const jointMat = new THREE.MeshBasicMaterial({
    color: 0xfff4dc, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  for (const ox of [-0.5, 0.5]) {
    const j = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.34), jointMat);
    j.position.set(ox, 0, 0.33);
    deck.add(j);
  }
  const top = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.07), jointMat);
  top.position.set(0, 0.17, 0.33);
  deck.add(top);
  // and the hairline the guild's wiring leaves in the stone when it is off
  const traceMat = new THREE.MeshBasicMaterial({
    map: softDisc(), color: hue, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  const trace = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.14), traceMat);
  trace.position.set(0, -0.2, 0.34);
  g.add(trace);
  return { group: g, deck, deckMat, traceMat };
}

// ---------------------------------------------------------------------------
// 10 · THE DOOR — arithmetic, not a lock
// ---------------------------------------------------------------------------

/**
 * The count, cut into the masonry: `need` pips in a bronze register, filling
 * one at a time as the sconces of the room are lit. A door you cannot read
 * the price of is a lock; a door with the sum on its face is arithmetic.
 */
export interface DoorRuneParts {
  group: THREE.Group;
  /** one per unit of the price, filling as the room's sconces are lit */
  pips: THREE.Mesh[];
  /** the bronze it is cut into — faded out with the masonry it belongs to */
  brass: THREE.MeshStandardMaterial;
  lamps: THREE.MeshBasicMaterial[];
}

/**
 * THE DOORWAY — the opening, not the leaf.
 *
 * A door tile on its own is a slightly warmer wall block, which is to say it
 * does not read as a door at all. What says "a way through, currently shut"
 * is the surround, and the surround is masonry, so it STAYS when the leaf
 * dissolves: paying a door off leaves a doorway standing open rather than a
 * gap where a box used to be.
 *
 * BUT THE PASSAGE RUNS SIDEWAYS. The body walks through a door along X, so
 * side jambs at ±X are built exactly where the player is about to be — a
 * frame standing in its own doorway, which is why the first cut read as a
 * door facing the camera that you then walked straight through the edge of.
 * Seen from the side, a lateral passage has no side jambs to draw: the wall
 * ABOVE is its head and the floor BELOW is its sill, and the only vertical
 * members are the reveals — the cut faces of the wall's own thickness, which
 * sit fore and aft in Z and frame the opening without ever standing in it.
 *
 * Nothing swings, either. The leaf melts when the count is paid, so there are
 * no hinges: it sits in a bronze channel, the way a barrier dropped into a
 * passage would.
 */
export function buildDoorway(w: number, h: number): THREE.Group {
  const g = new THREE.Group();
  const stone = stoneMat(0x8b8496);
  const bronze = bronzeMat(0xa8874a);

  // the head: the wall carrying on over the opening, with its soffit showing
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.28, 0.92), stone);
  lintel.position.y = h / 2 + 0.14;
  const soffit = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.06, 0.86), stoneMat(0x6f6a7d));
  soffit.position.y = h / 2 - 0.02;
  // and the threshold, worn by everyone who came through before the vault shut
  const sill = new THREE.Mesh(new THREE.BoxGeometry(w + 0.34, 0.14, 0.9), stone);
  sill.position.y = -h / 2 - 0.07;
  g.add(lintel, soffit, sill);

  // the reveals: the wall's own thickness, fore and aft of the passage. They
  // frame the opening in Z, never in X, so the way through stays clear.
  for (const z of [0.44, -0.44]) {
    const reveal = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, h + 0.04, 0.08), stoneMat(0x7b7590));
    reveal.position.set(0, 0, z);
    g.add(reveal);
    for (const k of [-1, 1]) {
      // the channel the leaf sits in, run down each edge of the reveal
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.07, h, 0.05), bronze);
      rail.position.set(k * (w / 2 - 0.02), 0, z + (z > 0 ? 0.05 : -0.05));
      g.add(rail);
    }
  }
  // the bronze band across the head, so the opening reads as guild work
  const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.36, 0.05, 0.06), bronze);
  band.position.set(0, h / 2 + 0.03, 0.5);
  g.add(band);
  return g;
}

export function buildDoorRune(need: number): DoorRuneParts {
  const g = new THREE.Group();
  // the register is transparent from the start: when the price is paid the
  // door dissolves, and the sum on its face has to go with it rather than
  // hang in the doorway on its own
  const brass = bronzeMat(0xa8874a);
  brass.transparent = true;
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.2 + need * 0.22, 0.42, 0.06), brass));
  const pips: THREE.Mesh[] = [];
  const lamps: THREE.MeshBasicMaterial[] = [];
  for (let i = 0; i < need; i++) {
    const ox = (i - (need - 1) / 2) * 0.22;
    const socket = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.02, 5, 12), brass);
    socket.position.set(ox, 0, 0.04);
    const pip = new THREE.Mesh(new THREE.CircleGeometry(0.07, 12), glowMat(0xffd9a0, 0.15));
    pip.position.set(ox, 0, 0.05);
    const lamp = bloom(0.44, 0xffc98a, 0.14);
    lamp.position.set(ox, 0, 0.06);
    g.add(socket, pip, lamp);
    pips.push(pip);
    lamps.push(lamp.material as THREE.MeshBasicMaterial);
  }
  return { group: g, pips, brass, lamps };
}

// ---------------------------------------------------------------------------
// 11 · THE ONE-WAY CURTAIN — the vault keeps what enters
// ---------------------------------------------------------------------------

export interface CurtainParts {
  group: THREE.Group;
  /** the fall itself: the same sprite system the rising current is built on */
  pts: THREE.Points;
  braids: THREE.Mesh[];
  poolMat: THREE.MeshBasicMaterial;
  /** the underside, which is the part that is stone */
  sillMat: THREE.MeshBasicMaterial;
}

/**
 * THE ONE-WAY CURTAIN — a fall of light in a doorway.
 *
 * The rising current is built from soft additive sprites with braids of haze
 * behind them and a glow where it meets the stone, and it reads. The curtain
 * shipped as flat bars instead — short thick dashes that looked like tally
 * marks falling down a hole — so it is rebuilt on the current's system,
 * mirrored: the same sprites, the same braids, the same pool, running DOWN.
 *
 * The two must still never be mistaken for each other, because they do
 * opposite things: the current CARRIES you up and is generous; the curtain
 * COMMITS you and is solid from below. So the current keeps the warm end of
 * the palette and its column loosens as it climbs, while the curtain takes
 * the room's cool core hue, tightens as it falls, and — the part that is the
 * actual rule — wears a bright hard line along its underside. That line is
 * the stone. Everything above it is a way down you do not come back up.
 */
export function buildCurtain(w: number, h: number, hue: number, down: boolean): CurtainParts {
  const g = new THREE.Group();
  const bronze = bronzeMat(0xa8874a);
  const railY = down ? h / 2 : -h / 2;
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, w, 8), bronze);
  rail.rotation.z = Math.PI / 2;
  rail.position.y = railY;
  g.add(rail);
  for (const k of [-1, 1]) {
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.14), bronze);
    bracket.position.set(k * w / 2, railY, 0);
    g.add(bracket);
  }

  // the fall: sprites, seeded across the opening, tight where they arrive
  // the fall is confined to the opening: it STOPS at the sill, because the
  // sill is stone. Spray past it would argue with the one thing this object
  // exists to say.
  const n = 130;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const near = new THREE.Color(hue).lerp(new THREE.Color(0xffffff), 0.45);
  const far = new THREE.Color(hue).multiplyScalar(0.7);
  for (let i = 0; i < n; i++) {
    const u = Math.random();                 // 0 at the rail, 1 at the sill
    pos[i * 3] = (Math.random() - 0.5) * w * (1 - u * 0.45);
    pos[i * 3 + 1] = down ? h / 2 - u * h : -h / 2 + u * h;
    pos[i * 3 + 2] = 0.15;
    const c = far.clone().lerp(near, u);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    // sized against the opening, not against the room: a one-tile doorway
    // full of 0.15 sprites is confetti, not a fall
    size: Math.max(0.05, Math.min(0.12, h * 0.1)),
    vertexColors: true, transparent: true, opacity: 0.8,
    depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    map: softDisc(), sizeAttenuation: true,
  }));
  g.add(pts);

  // the braids of haze the sprites fall through
  const braids: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.5, h),
      new THREE.MeshBasicMaterial({
        map: softDisc(), color: hue, transparent: true, opacity: 0.16,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      }));
    m.position.set(0, 0, 0.12);
    g.add(m);
    braids.push(m);
  }

  // where it gathers on the stone
  const poolMat = new THREE.MeshBasicMaterial({
    map: softDisc(), color: hue, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.4, 0.7), poolMat);
  pool.position.set(0, down ? -h / 2 - 0.15 : h / 2 + 0.15, 0.06);
  g.add(pool);

  // THE SILL. The one-way rule drawn: the underside of the curtain is solid,
  // and a hard bright line is the only thing on the object that says so.
  const sillMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.75,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  const sill = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.05), sillMat);
  sill.position.set(0, down ? -h / 2 : h / 2, 0.2);
  const sillGlow = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.1, 0.3),
    new THREE.MeshBasicMaterial({
      map: softDisc(), color: hue, transparent: true, opacity: 0.4,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
  sillGlow.position.copy(sill.position);
  sillGlow.position.z = 0.19;
  g.add(sill, sillGlow);

  return { group: g, pts, braids, poolMat, sillMat };
}

// ---------------------------------------------------------------------------
// 12 · THE RISING CURRENT — the updraft of the deep vents
// ---------------------------------------------------------------------------

export interface CurrentParts {
  group: THREE.Group;
  pts: THREE.Points;
  /** the braids, twisting slowly so the column has a direction and a body */
  braids: THREE.Mesh[];
  ventMat: THREE.MeshBasicMaterial;
}

/**
 * The column, from the curtain-current sheet: a braided rope of sparks
 * carrying up out of a hot vent, brightest and tightest at the floor and
 * loosening as it climbs. It CARRIES — it is the generosity object — so it
 * has to be unmistakable against a gust, which fights: warmer, vertical,
 * and visibly going up rather than blowing sideways.
 */
export function buildCurrent(x0: number, x1: number, y0: number, y1: number): CurrentParts {
  const g = new THREE.Group();
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const cx = x0 + w / 2, cyTop = -y0, cyBot = -(y1 + 1);

  const n = 90;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const hot = new THREE.Color(0xffe6bc), cool = new THREE.Color(0xffa860);
  for (let i = 0; i < n; i++) {
    const u = Math.random();
    pos[i * 3] = cx + (Math.random() - 0.5) * w * (0.3 + u * 0.7);
    pos[i * 3 + 1] = cyBot + u * h;
    pos[i * 3 + 2] = 0.15;
    const c = cool.clone().lerp(hot, 1 - u);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.17, vertexColors: true, transparent: true, opacity: 0.85,
    depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    map: softDisc(), sizeAttenuation: true,
  }));
  g.add(pts);

  // three braids of haze twisting up the column's length
  const braids: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.42, h),
      new THREE.MeshBasicMaterial({
        map: softDisc(), color: 0xffc078, transparent: true, opacity: 0.16,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      }));
    m.position.set(cx, (cyTop + cyBot) / 2, 0.12);
    g.add(m);
    braids.push(m);
  }
  // the vent it comes out of: the hottest thing in a current is its floor
  const ventMat = new THREE.MeshBasicMaterial({
    map: softDisc(), color: 0xffe0b0, transparent: true, opacity: 0.55,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  const vent = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.5, 1.3), ventMat);
  vent.position.set(cx, cyBot + 0.3, 0.1);
  g.add(vent);
  return { group: g, pts, braids, ventMat };
}

// ---------------------------------------------------------------------------
// 13 · THE MOTE — spilled light, still falling
// ---------------------------------------------------------------------------

/** a fleck with a hard core inside a soft halo — a spark, not a smudge */
export function buildMote(hue: number): { group: THREE.Group; mats: THREE.MeshBasicMaterial[] } {
  const g = new THREE.Group();
  const haloMat = new THREE.MeshBasicMaterial({
    map: softDisc(), color: hue, transparent: true, opacity: 0.4,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  const coreMat = new THREE.MeshBasicMaterial({
    map: softDisc(), color: 0xfff2d8, transparent: true, opacity: 0.75,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), haloMat);
  const core = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.09), coreMat);
  core.position.z = 0.01;
  g.add(halo, core);
  return { group: g, mats: [haloMat, coreMat] };
}

// ---------------------------------------------------------------------------
// 14 · THE MASTER STONE'S CHAMBER — the single lit thing
// ---------------------------------------------------------------------------

/**
 * What the guild built around the word: a stepped dais, two pilasters with
 * capitals, a lintel over them and an inlaid ring in the floor. The stone
 * itself is untouched — this is the architecture that says a room was made
 * FOR it, which is the difference between a payoff and a pickup.
 */
export function buildMasterDressing(hue: number): THREE.Group {
  const g = new THREE.Group();
  const stone = stoneMat(0x77748a);
  const bronze = bronzeMat(0xa8874a);

  for (let i = 0; i < 3; i++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(2.6 - i * 0.5, 0.16, 1.1 - i * 0.2), stone);
    step.position.set(0, -1.12 + i * 0.16, -0.1);
    g.add(step);
  }
  for (const k of [-1, 1]) {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 2.1, 10), stone);
    shaft.position.set(k * 1.05, 0.1, -0.15);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.14, 0.44), stone);
    cap.position.set(k * 1.05, 1.22, -0.15);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.12, 0.44), stone);
    foot.position.set(k * 1.05, -0.98, -0.15);
    g.add(shaft, cap, foot);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.3, 0.5), stone);
  lintel.position.set(0, 1.43, -0.15);
  const band = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.05, 0.06), bronze);
  band.position.set(0, 1.27, 0.12);
  g.add(lintel, band);
  // the inlay: the world's own note, run into the floor of the alcove
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.025, 5, 28),
    new THREE.MeshBasicMaterial({
      color: hue, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
  ring.rotation.x = Math.PI / 2.2;
  ring.position.set(0, -0.94, 0.15);
  g.add(ring);
  return g;
}
