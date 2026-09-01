import * as THREE from 'three';
import { ARRESTOR_CATCH_X, ARRESTOR_CATCH_Y, MAX_ARRESTORS, ARRESTOR_CLEARANCE } from '../config';

// Arrestors: deployable landing pads for shafts you have already dug. They
// catch a full-speed fall and mark the map. Deliberately nothing else — never
// a refuel, never a respawn, never fast travel, because the climb out is the
// gamble the whole economy hangs on.
//
// Visually a miniature of the surface landing pad: each one is a piece of the
// rig the driller carried down with them.

export interface Arrestor { x: number; y: number; }

const PLATE = new THREE.MeshStandardMaterial({ color: 0x4a4f5e, roughness: 0.5, metalness: 0.35 });
const STRIP = new THREE.MeshBasicMaterial({ color: 0xff9a3c, toneMapped: false });
const LAMP = new THREE.MeshBasicMaterial({ color: 0x3ce6c8, toneMapped: false });

export class ArrestorField {
  list: Arrestor[] = [];
  private group = new THREE.Group();
  private pads: THREE.Group[] = [];
  /** set for a moment after a catch, so the HUD/audio can react */
  caught = false;

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
    for (let i = 0; i < MAX_ARRESTORS; i++) {
      // sized to sit inside a two-wide shaft: a plate that overhangs into the
      // rock reads as broken, and worse, implies a catch where there is none
      const pad = new THREE.Group();
      const plate = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.11, 1.2), PLATE);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.03, 8, 24), STRIP);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.085;
      pad.add(plate, ring);
      for (const s of [-1, 1]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.9), STRIP);
        bar.position.set(s * 0.68, 0.075, 0);
        pad.add(bar);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), LAMP);
        lamp.position.set(s * 0.88, 0.13, 0);
        pad.add(lamp);
      }
      pad.visible = false;
      this.group.add(pad);
      this.pads.push(pad);
    }
  }

  load(list: Arrestor[]): void {
    this.list = list.slice(0, MAX_ARRESTORS).map(a => ({ ...a }));
    this.sync();
  }

  clear(): void {
    this.list.length = 0;
    this.sync();
  }

  private sync(): void {
    this.pads.forEach((p, i) => {
      const a = this.list[i];
      p.visible = !!a;
      if (a) p.position.set(a.x, a.y, 0);
    });
  }

  /** deploy at the pod's feet; returns false when one is already here */
  deploy(x: number, y: number): boolean {
    if (this.list.length >= MAX_ARRESTORS) return false;
    if (this.at(x, y) >= 0) return false;
    this.list.push({ x, y });
    this.sync();
    return true;
  }

  /** index of an arrestor the pod is standing on, or -1 */
  at(x: number, y: number): number {
    for (let i = 0; i < this.list.length; i++) {
      const a = this.list[i];
      if (Math.abs(a.x - x) < 1.1 && Math.abs(a.y - y) < 1.0) return i;
    }
    return -1;
  }

  /** true when something else already occupies this spot */
  blocked(x: number, y: number, wrecks: { x: number; y: number }[]): boolean {
    return wrecks.some(w =>
      Math.abs(w.x + 0.5 - x) < ARRESTOR_CLEARANCE &&
      Math.abs(-(w.y + 0.5) - y) < ARRESTOR_CLEARANCE);
  }

  retrieve(i: number): void {
    this.list.splice(i, 1);
    this.sync();
  }

  /**
   * Catch a falling pod. Returns the arrestor index that caught it, or -1.
   * Only triggers on a genuine descent, so a pod resting on one is unaffected.
   */
  catchFall(px: number, py: number, vy: number): number {
    if (vy > -6) return -1;
    for (let i = 0; i < this.list.length; i++) {
      const a = this.list[i];
      if (Math.abs(a.x - px) > ARRESTOR_CATCH_X) continue;
      // the catch window sits just above the plate
      const dy = py - a.y;
      if (dy < -0.2 || dy > ARRESTOR_CATCH_Y + 1.4) continue;
      return i;
    }
    return -1;
  }

  update(time: number): void {
    // beacon pulse so a deployed pad is findable in the dark
    const t = 0.55 + Math.sin(time * 2.4) * 0.45;
    LAMP.color.setRGB(0.24 * t, 0.9 * t, 0.78 * t);
  }
}
