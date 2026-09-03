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
export function animateSuit(s: Suit, walkT: number, grounded: boolean, speed01: number): void {
  const swing = grounded ? Math.sin(walkT) * 0.5 : 0.3;
  s.legL.rotation.x = swing;
  s.legR.rotation.x = -swing;
  s.armL.rotation.x = -swing * 0.7;
  s.armR.rotation.x = swing * 0.7;
  s.helmet.position.y = HELMET_Y + Math.sin(walkT * 2) * 0.006 * speed01;
}
