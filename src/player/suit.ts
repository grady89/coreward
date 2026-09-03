import * as THREE from 'three';

// The pilot's suit — one mesh, built once, worn everywhere the character walks
// on foot: the EVA (src/player/pilot.ts) and a vault run (src/game/vault.ts).
// Both used to carry their own copy and the copies drifted, so the gait lives
// here too. Callers own only their lamp and whatever rides on the pack.
//
// Silhouette is helmet-dominant: the dome is 40% of the height and wider than
// the shoulders, gapped from them by a dark neck ring. That notch is the whole
// read at gameplay scale. Amber lives in thin bands (visor rim, belt, ear pods),
// never in slabs. Reference: reference-art/astronaut.

const SUIT = new THREE.MeshStandardMaterial({ color: 0xd8c9a4, roughness: 0.6, metalness: 0.15 });
const SUIT_ACCENT = new THREE.MeshStandardMaterial({ color: 0xff9a3c, roughness: 0.5, metalness: 0.2 });
const STEEL = new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.4, metalness: 0.8 });
const VISOR = new THREE.MeshStandardMaterial({ color: 0x1d4a52, roughness: 0.15, metalness: 0.5, emissive: 0x0d3a40, emissiveIntensity: 0.6 });
const LENS = new THREE.MeshBasicMaterial({ color: 0xffe6c0, toneMapped: false });

const R_DOME = 0.108;
const HELMET_Y = 0.148;

/**
 * Recolor every walker at once — the materials are shared singletons on
 * purpose: EVA, vault runner and quarters walker are all the same driller
 * in the same suit, so one coat covers them all.
 */
export function applySuitFinish(f: { suit: number; accent: number }): void {
  SUIT.color.setHex(f.suit);
  SUIT_ACCENT.color.setHex(f.accent);
}

/** the whole character, hip to helmet — a dash ghost sized to match */
export const SUIT_R = 0.105;
export const SUIT_H = 0.16;

export interface Suit {
  group: THREE.Group;
  helmet: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  armL: THREE.Mesh;
  armR: THREE.Mesh;
  /** where a pack-mounted ornament rides — the vault hangs its spark here */
  packAnchor: THREE.Vector3;
}

/**
 * A patch of sphere surface centred on +z — the face of the helmet. Stacking
 * two at slightly different radii gives a lens with an amber outline that
 * follows the dome's curve, which a flat disc or a torus cannot.
 */
function facePatch(r: number, wide: number, tall: number): THREE.SphereGeometry {
  return new THREE.SphereGeometry(
    r, 16, 12,
    Math.PI / 2 - wide / 2, wide,
    Math.PI / 2 - tall / 2, tall,
  );
}

function buildLeg(x: number): THREE.Group {
  const hip = new THREE.Group();
  hip.position.set(x, -0.075, 0);
  const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.055, 3, 8), SUIT);
  shin.position.y = -0.075;
  // boot overlaps the shin's heel so the two never separate mid-swing, and
  // its sole lands exactly on the bottom of the collision box
  const boot = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.052, 0.04, 10), STEEL);
  boot.position.y = -0.165;
  boot.scale.z = 1.2;
  hip.add(shin, boot);
  return hip;
}

export function buildSuit(): Suit {
  const group = new THREE.Group();
  const helmet = new THREE.Group();

  // helmet — the dome, squashed a touch wide, riding the top of the box.
  // Visor and its rim are concentric spherical patches rather than separate
  // solids, so they lie flush on the dome instead of poking out its sides.
  const shell = new THREE.Group();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(R_DOME, 18, 14), SUIT);
  const rim = new THREE.Mesh(facePatch(R_DOME * 1.008, 2.24, 1.08), SUIT_ACCENT);
  const visor = new THREE.Mesh(facePatch(R_DOME * 1.02, 2.02, 0.9), VISOR);
  shell.add(dome, rim, visor);
  shell.scale.set(1.05, 0.95, 1);
  // ear pods: the pair of cans that make the head read as a helmet, not a ball
  for (const s of [-1, 1]) {
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.03, 10), SUIT_ACCENT);
    pod.rotation.z = Math.PI / 2;
    pod.position.set(s * 0.109, 0, 0.008);
    helmet.add(pod);
  }
  helmet.add(shell);
  helmet.position.y = HELMET_Y;

  // neck ring — the dark gap under the dome
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.03, 12), STEEL);
  neck.position.y = 0.045;

  // torso, narrower than the dome so the helmet overhangs the shoulders
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.088, 0.05, 4, 12), SUIT);
  torso.position.y = -0.02;
  torso.scale.z = 0.86;
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.092, 0.026, 14), SUIT_ACCENT);
  belt.position.y = -0.062;
  belt.scale.z = 0.86;
  const chestLamp = new THREE.Mesh(new THREE.CircleGeometry(0.019, 10), LENS);
  chestLamp.position.set(0.036, -0.005, 0.079);

  // pack rides high and small — barely there from the front
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.11, 0.05), STEEL);
  pack.position.set(0, -0.022, -0.086);

  // arms hang stubby at the sides, pivoting from the shoulder
  const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.07, 3, 8), SUIT);
  const armR = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.07, 3, 8), SUIT);
  for (const [arm, s] of [[armL, -1], [armR, 1]] as const) {
    arm.position.set(s * 0.104, -0.03, 0);
    arm.rotation.z = s * 0.16;
  }

  // legs: shin in a pivot group so the swing hinges at the hip, each capped
  // with a dark boot that flares past the leg
  const legL = buildLeg(-0.05);
  const legR = buildLeg(0.05);

  group.add(helmet, neck, torso, belt, chestLamp, pack, armL, armR, legL, legR);
  return { group, helmet, legL, legR, armL, armR, packAnchor: new THREE.Vector3(0, -0.022, -0.13) };
}

/**
 * One gait for both walkers: legs swing, arms counter-swing, helmet bobs at
 * double time. `walkT` is the caller's phase accumulator, `speed01` its speed
 * as a fraction of full walk.
 */
/** where the boot soles sit in suit-local y — squash pivots on the feet */
const FOOT_Y = -0.26;

/**
 * Everything the pose system wants to know about this frame. Callers fill
 * what they have; everything is optional beyond the basics, so the interior
 * walker and the EVA pilot share the system with the vault runner.
 */
export interface SuitPoseIn {
  dt: number;
  walkT: number;
  /** |vx| / walk speed, 0..1 */
  speed01: number;
  grounded: boolean;
  facing: number;
  /** vertical velocity, tiles/s, + up */
  vy?: number;
  /** wall side while sliding: -1 | 1, else 0 */
  wall?: number;
  /** dash direction while mid-burst, else null */
  dash?: { x: number; y: number } | null;
  /** grounded + down held */
  crouch?: boolean;
  /** airborne + down held */
  fastFall?: boolean;
  /** time-of-day for idle breathing; any monotonically rising clock */
  time?: number;
}

interface PoseState {
  turn: number; lean: number;
  legL: number; legR: number; armL: number; armR: number;
  headX: number; sx: number; sy: number;
  landSquash: number; wasGrounded: boolean; lastVy: number;
}

const poseStates = new WeakMap<Suit, PoseState>();

/**
 * The suit's body language. One character, many verbs: he leans into his
 * run, turns his shoulders through it, tucks on the way up, flails on the
 * way down, presses into a wall knees-bent and looks up the climb,
 * stretches along a dash like a thrown dart, folds into a crouch, and
 * lands with a squash that pivots on his boots. Every target is damped, so
 * poses melt into each other instead of snapping.
 */
export function poseSuit(s: Suit, p: SuitPoseIn): void {
  let st = poseStates.get(s);
  if (!st) {
    st = { turn: 0.35, lean: 0, legL: 0, legR: 0, armL: 0, armR: 0, headX: 0, sx: 1, sy: 1, landSquash: 0, wasGrounded: true, lastVy: 0 };
    poseStates.set(s, st);
  }
  const vy = p.vy ?? 0;
  const wall = p.wall ?? 0;
  const t = p.time ?? p.walkT;

  // landing: remember how hard the fall was the frame the ground arrives
  if (p.grounded && !st.wasGrounded) st.landSquash = Math.min(1, Math.abs(st.lastVy) / 13);
  st.wasGrounded = p.grounded;
  st.lastVy = vy;
  st.landSquash = Math.max(0, st.landSquash - p.dt * 6);

  // ---- targets ----
  const swing = p.grounded ? Math.sin(p.walkT) * 0.5 * Math.max(0.25, p.speed01) : 0;
  let turn = p.facing * (0.35 + 0.55 * p.speed01);   // shoulders open with speed
  let lean = -p.facing * 0.14 * p.speed01;           // into the run
  let legL = swing, legR = -swing;
  let armL = -swing * 0.7, armR = swing * 0.7;
  let headX = 0;
  let sx = 1, sy = 1;
  let damp = 12;

  if (!p.grounded) {
    // airborne: tuck rising, trail falling — blended by vy
    const rise = Math.max(-1, Math.min(1, vy / 8));
    legL = 0.55 * Math.max(0, rise) + 0.2;
    legR = -0.25 * Math.max(0, rise) - 0.1 - 0.3 * Math.max(0, -rise);
    armL = -0.35 * rise - 0.55 * Math.max(0, -rise);
    armR = 0.25 * rise + 0.75 * Math.max(0, -rise);
    headX = -rise * 0.18;                            // look where you're going
    lean = -p.facing * 0.08 * p.speed01;
  }
  if (p.fastFall) {
    // streamlined: a dropped tool
    legL = 0.06; legR = -0.06; armL = 0.9; armR = 0.9;
    sy = 1.1; sx = 0.94; headX = 0.28;
  }
  if (wall !== 0 && !p.grounded) {
    // pressed to the wall: face it, knees bent, near arm up the climb
    turn = wall * 1.15;
    lean = wall * 0.1;
    legL = 0.55; legR = 0.28;
    armL = wall < 0 ? -1.05 : -0.15;
    armR = wall > 0 ? -1.05 : -0.15;
    headX = -0.3;                                    // eyes up the wall
    damp = 16;
  }
  if (p.crouch && p.grounded) {
    legL = 0.5; legR = -0.4; armL = -0.3; armR = 0.3;
    sy = 0.8; sx = 1.12; headX = 0.22;
    turn = p.facing * 0.5;
  }
  if (p.dash) {
    // stretched along the burst — x and z together read as "long" under
    // any shoulder turn, y alone reads as "tall"
    const horiz = Math.abs(p.dash.x) >= Math.abs(p.dash.y);
    sx = horiz ? 1.22 : 0.86;
    sy = horiz ? 0.82 : 1.28;
    legL = horiz ? 0.85 : 0.15; legR = horiz ? -0.65 : -0.15;
    armL = horiz ? 0.9 : 1.1; armR = horiz ? -0.9 : 1.1;
    // nose into the burst: level dash leans 0.2, diving dash noses down
    // harder, rising dash flattens out
    const dyN = Math.max(-1, Math.min(1, p.dash.y));
    lean = -Math.sign(p.dash.x || p.facing) * (horiz ? 0.2 - dyN * 0.2 : 0.05);
    headX = -Math.max(-1, Math.min(1, p.dash.y)) * 0.25;
    damp = 26;                                       // the burst poses NOW
  }
  // the landing squash rides on top of whatever pose is active
  sy *= 1 - 0.24 * st.landSquash;
  sx *= 1 + 0.18 * st.landSquash;

  // ---- damped approach ----
  const k = Math.min(1, p.dt * damp);
  st.turn += (turn - st.turn) * k;
  st.lean += (lean - st.lean) * k;
  st.legL += (legL - st.legL) * k;
  st.legR += (legR - st.legR) * k;
  st.armL += (armL - st.armL) * k;
  st.armR += (armR - st.armR) * k;
  st.headX += (headX - st.headX) * k;
  st.sx += (sx - st.sx) * Math.min(1, p.dt * 18);
  st.sy += (sy - st.sy) * Math.min(1, p.dt * 18);

  // ---- apply ----
  s.group.rotation.y = st.turn;
  s.group.rotation.z = st.lean;
  s.legL.rotation.x = st.legL;
  s.legR.rotation.x = st.legR;
  s.armL.rotation.x = st.armL;
  s.armR.rotation.x = st.armR;
  s.helmet.rotation.x = st.headX;
  s.group.scale.set(st.sx, st.sy, 1 + (st.sx - 1) * 0.8);
  // squash pivots on the boots, not the belt
  s.group.position.y = FOOT_Y * (1 - st.sy);
  // idle breathing + gait bob, so he is never a statue
  s.helmet.position.y = HELMET_Y
    + Math.sin(p.walkT * 2) * 0.006 * p.speed01
    + (p.speed01 < 0.05 && p.grounded ? Math.sin(t * 1.8) * 0.0035 : 0);
}

/** suit-local y offset the current squash wants — for callers that place
 *  suit.group absolutely each frame (the interior walker) */
export function suitPoseYOffset(s: Suit): number {
  const st = poseStates.get(s);
  return st ? FOOT_Y * (1 - st.sy) : 0;
}

