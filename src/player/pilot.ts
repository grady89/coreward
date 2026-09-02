import * as THREE from 'three';
import { EVA_O2 } from '../config';
import { Terrain } from '../world/terrain';
import { Input } from './controller';

// EVA: the pilot on foot. Small AABB, walk + jump, oxygen clock.
// Exists only for designated moments — wreck salvage and the core walk.
//
// Silhouette is helmet-dominant: the dome is 40% of the height and wider than
// the shoulders, gapped from them by a dark neck ring. That notch is the whole
// read at gameplay scale. Amber lives in thin bands (visor rim, belt, ear pods),
// never in slabs. Reference: reference-art/astronaut.

const HW = 0.15;
const HH = 0.26;
const EPS = 0.001;
const WALK = 3.6;
const JUMP = 8.6;
const GRAV = 22;

const SUIT = new THREE.MeshStandardMaterial({ color: 0xd8c9a4, roughness: 0.6, metalness: 0.15 });
const SUIT_ACCENT = new THREE.MeshStandardMaterial({ color: 0xff9a3c, roughness: 0.5, metalness: 0.2 });
const STEEL = new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.4, metalness: 0.8 });
const VISOR = new THREE.MeshStandardMaterial({ color: 0x1d4a52, roughness: 0.15, metalness: 0.5, emissive: 0x0d3a40, emissiveIntensity: 0.6 });
const LENS = new THREE.MeshBasicMaterial({ color: 0xffe6c0, toneMapped: false });

const R_DOME = 0.108;
const HELMET_Y = 0.148;

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

export class Pilot {
  group = new THREE.Group();
  px = 0; py = 0;
  vx = 0; vy = 0;
  grounded = false;
  o2 = EVA_O2;
  private walkT = 0;
  private facing = 1;
  private helmet = new THREE.Group();
  private legL: THREE.Group;
  private legR: THREE.Group;
  private armL: THREE.Mesh;
  private armR: THREE.Mesh;
  private lamp: THREE.PointLight;

  constructor(scene: THREE.Scene, private terrain: Terrain) {
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
      this.helmet.add(pod);
    }
    this.helmet.add(shell);
    this.helmet.position.y = HELMET_Y;

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
    this.armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.07, 3, 8), SUIT);
    this.armR = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.07, 3, 8), SUIT);
    for (const [arm, s] of [[this.armL, -1], [this.armR, 1]] as const) {
      arm.position.set(s * 0.104, -0.03, 0);
      arm.rotation.z = s * 0.16;
    }

    // legs: shin in a pivot group so the swing hinges at the hip, each capped
    // with a dark boot that flares past the leg
    this.legL = this.buildLeg(-0.05);
    this.legR = this.buildLeg(0.05);

    this.lamp = new THREE.PointLight(0xffe6c0, 6, 6, 1.6);
    this.lamp.position.set(0, 0, 0.35);
    this.group.add(this.helmet, neck, torso, belt, chestLamp, pack, this.armL, this.armR, this.legL, this.legR, this.lamp);
    this.group.visible = false;
    scene.add(this.group);
  }

  private buildLeg(x: number): THREE.Group {
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

  spawnAt(x: number, y: number): void {
    this.px = x; this.py = y + 0.02;
    this.vx = 0; this.vy = 0;
    this.o2 = EVA_O2;
    this.group.visible = true;
  }

  hide(): void { this.group.visible = false; }

  update(dt: number, input: Input): void {
    this.o2 = Math.max(0, this.o2 - dt);

    const move = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    if (move !== 0) {
      this.vx += move * 30 * dt;
      this.vx = Math.max(-WALK, Math.min(WALK, this.vx));
      this.facing = move;
    } else {
      this.vx -= this.vx * Math.min(1, 14 * dt);
    }
    if (input.up && this.grounded) this.vy = JUMP;
    this.vy -= GRAV * dt;
    this.vy = Math.max(-18, this.vy);

    // sub-stepped grid collision (same scheme as the pod, smaller box)
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(this.vx), Math.abs(this.vy)) * dt / 0.2));
    const sdt = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.moveX(this.vx * sdt);
      this.moveY(this.vy * sdt);
    }

    // animate: legs swing, arms counter-swing, helmet bobs at double time
    this.walkT += dt * Math.abs(this.vx) * 4;
    const swing = this.grounded ? Math.sin(this.walkT) * 0.5 : 0.3;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.x = -swing * 0.7;
    this.armR.rotation.x = swing * 0.7;
    const speed = Math.min(1, Math.abs(this.vx) / WALK);
    this.helmet.position.y = HELMET_Y + Math.sin(this.walkT * 2) * 0.006 * speed;
    this.group.rotation.y = this.facing > 0 ? 0.35 : -0.35;
    this.group.position.set(this.px, this.py, 0.1);
  }

  private moveX(dx: number): void {
    this.px += dx;
    const top = Math.floor(-(this.py + HH - EPS));
    const bot = Math.floor(-(this.py - HH + EPS));
    if (dx > 0) {
      const c = Math.floor(this.px + HW);
      for (let r = top; r <= bot; r++) {
        if (this.terrain.solidAt(c, r)) { this.px = c - HW - EPS; this.vx = 0; break; }
      }
    } else if (dx < 0) {
      const c = Math.floor(this.px - HW);
      for (let r = top; r <= bot; r++) {
        if (this.terrain.solidAt(c, r)) { this.px = c + 1 + HW + EPS; this.vx = 0; break; }
      }
    }
  }

  private moveY(dy: number): void {
    this.py += dy;
    const left = Math.floor(this.px - HW + EPS);
    const right = Math.floor(this.px + HW - EPS);
    this.grounded = false;
    if (dy < 0) {
      const r = Math.floor(-(this.py - HH));
      for (let c = left; c <= right; c++) {
        if (this.terrain.solidAt(c, r)) {
          this.py = -r + HH + EPS;
          this.vy = 0;
          this.grounded = true;
          break;
        }
      }
    } else if (dy > 0) {
      const r = Math.floor(-(this.py + HH));
      if (r >= 0) {
        for (let c = left; c <= right; c++) {
          if (this.terrain.solidAt(c, r)) {
            this.py = -(r + 1) - HH - EPS;
            this.vy = 0;
            break;
          }
        }
      }
    } else {
      const r = Math.floor(-(this.py - HH - 0.04));
      for (let c = left; c <= right; c++) {
        if (this.terrain.solidAt(c, r)) { this.grounded = true; break; }
      }
    }
  }
}
