import * as THREE from 'three';
import { EVA_O2 } from '../config';
import { Terrain } from '../world/terrain';
import { Input } from './controller';
import { Suit, buildSuit, animateSuit } from './suit';

// EVA: the pilot on foot. Small AABB, walk + jump, oxygen clock.
// Exists only for designated moments — wreck salvage and the core walk.
// The mesh and the gait are shared with the vault runner — see suit.ts.

const HW = 0.15;
const HH = 0.26;
const EPS = 0.001;
const WALK = 3.6;
const JUMP = 8.6;
const GRAV = 22;

export class Pilot {
  group = new THREE.Group();
  px = 0; py = 0;
  vx = 0; vy = 0;
  grounded = false;
  o2 = EVA_O2;
  private walkT = 0;
  private facing = 1;
  private suit: Suit;
  private lamp: THREE.PointLight;

  constructor(scene: THREE.Scene, private terrain: Terrain) {
    this.suit = buildSuit();
    this.lamp = new THREE.PointLight(0xffe6c0, 6, 6, 1.6);
    this.lamp.position.set(0, 0, 0.35);
    this.group.add(this.suit.group, this.lamp);
    this.group.visible = false;
    scene.add(this.group);
  }

  spawnAt(x: number, y: number): void {
    this.px = x; this.py = y + 0.02;
    this.vx = 0; this.vy = 0;
    this.o2 = EVA_O2;
    this.group.visible = true;
  }

  hide(): void { this.group.visible = false; }

  /** the paint locker's lamp tint reaches the suit lamp too */
  setLampColor(hex: number): void { this.lamp.color.setHex(hex); }

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

    this.walkT += dt * Math.abs(this.vx) * 4;
    animateSuit(this.suit, this.walkT, this.grounded, Math.min(1, Math.abs(this.vx) / WALK));
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
