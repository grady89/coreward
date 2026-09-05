import * as THREE from 'three';
import { MAX_SHAFTLIGHTS, MAX_DEPOTS, SHAFTLIGHT_LIVE } from '../config';

// Deep infrastructure (SPEC-KEEPING §7) — the two permanent fixtures a rich
// driller can sink Lumens into. Neither one dispenses anything for free:
// shaftlights are light and nothing else, and a waystation depot meters every
// unit it pumps at a markup. The arrestor law (the climb out stays the gamble)
// holds — a depot converts surplus wealth into safety, it never removes the
// bill.

export interface Placed { x: number; y: number; }

const BRACKET = new THREE.MeshStandardMaterial({ color: 0x363d45, roughness: 0.5, metalness: 0.3 });
const CAGE = new THREE.MeshStandardMaterial({ color: 0x4b545e, roughness: 0.45, metalness: 0.35 });
const WARM = new THREE.MeshBasicMaterial({ color: 0xffc06a, toneMapped: false });

/**
 * Permanent warm fixtures for shafts you keep coming back to. Pooled meshes;
 * only the SHAFTLIGHT_LIVE nearest the pod carry a real PointLight, the rest
 * stay glow-only — the flare light budget's law applies here too.
 */
export class ShaftlightField {
  list: Placed[] = [];
  private group = new THREE.Group();
  private fixtures: THREE.Group[] = [];
  private lights: THREE.PointLight[] = [];

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
    for (let i = 0; i < MAX_SHAFTLIGHTS; i++) {
      const f = new THREE.Group();
      f.add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.14), BRACKET));
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.08), BRACKET);
      arm.position.set(0.17, 0.2, 0);
      f.add(arm);
      const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 0.14, 10), CAGE);
      hood.position.set(0.34, 0.14, 0);
      f.add(hood);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), WARM);
      bulb.position.set(0.34, 0.05, 0);
      f.add(bulb);
      f.visible = false;
      this.group.add(f);
      this.fixtures.push(f);
    }
    for (let i = 0; i < SHAFTLIGHT_LIVE; i++) {
      const pt = new THREE.PointLight(0xffc06a, 0, 7, 1.7);
      this.group.add(pt);
      this.lights.push(pt);
    }
  }

  load(list: Placed[]): void {
    this.list = list.slice(0, MAX_SHAFTLIGHTS).map(p => ({ ...p }));
    this.sync();
  }

  clear(): void {
    this.list.length = 0;
    this.sync();
  }

  private sync(): void {
    this.fixtures.forEach((f, i) => {
      const p = this.list[i];
      f.visible = !!p;
      // hung on the west wall of the tile the pod occupied, lamp arm inward
      if (p) f.position.set(p.x - 0.55, p.y + 0.2, 0.3);
    });
  }

  place(x: number, y: number): boolean {
    if (this.list.length >= MAX_SHAFTLIGHTS) return false;
    if (this.at(x, y) >= 0) return false;
    this.list.push({ x, y });
    this.sync();
    return true;
  }

  at(x: number, y: number): number {
    for (let i = 0; i < this.list.length; i++) {
      const p = this.list[i];
      if (Math.abs(p.x - x) < 1.2 && Math.abs(p.y - y) < 1.2) return i;
    }
    return -1;
  }

  /** hand the live lights to the fixtures nearest the pod */
  update(px: number, py: number, time: number): void {
    if (this.list.length === 0) {
      for (const pt of this.lights) pt.intensity = 0;
      return;
    }
    const flick = 1 + Math.sin(time * 6.3) * 0.06;
    const ranked = this.list
      .map((p, i) => ({ i, d: Math.hypot(p.x - px, p.y - py) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, this.lights.length);
    this.lights.forEach((pt, k) => {
      const r = ranked[k];
      // dark lights stay visible: hiding one changes the scene's light count,
      // and that recompiles every shader in the world — a far worse hitch
      // than the idle slot costs
      if (!r || r.d > 26) { pt.intensity = 0; return; }
      const p = this.list[r.i];
      pt.position.set(p.x - 0.2, p.y + 0.2, 0.6);
      pt.intensity = 5.5 * flick;
    });
  }
}

const SHELL = new THREE.MeshStandardMaterial({ color: 0x4a4f5e, roughness: 0.5, metalness: 0.35 });
const TANKMAT = new THREE.MeshStandardMaterial({ color: 0xe6dcc4, roughness: 0.55 });
const BANDMAT = new THREE.MeshStandardMaterial({ color: 0xc4571f, roughness: 0.5 });
const TEAL = new THREE.MeshBasicMaterial({ color: 0x3ce6c8, toneMapped: false });

/** Waystation depots: a dug-in fuel silo with a service mast and a meter. */
export class DepotField {
  list: Placed[] = [];
  private group = new THREE.Group();
  private stations: THREE.Group[] = [];

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
    for (let i = 0; i < MAX_DEPOTS; i++) {
      const s = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.14, 1.1), SHELL);
      base.position.y = 0.07;
      s.add(base);
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.8, 14), TANKMAT);
      tank.position.set(-0.45, 0.55, 0);
      s.add(tank);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), BANDMAT);
      cap.position.set(-0.45, 0.95, 0);
      s.add(cap);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.1, 14, 1, true), BANDMAT);
      band.position.set(-0.45, 0.55, 0);
      s.add(band);
      const pump = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.35), BRACKET);
      pump.position.set(0.45, 0.44, 0);
      s.add(pump);
      const meter = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.16), TEAL);
      meter.position.set(0.45, 0.6, 0.18);
      s.add(meter);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 6), BRACKET);
      mast.position.set(0.75, 1.0, 0);
      s.add(mast);
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), WARM);
      beacon.position.set(0.75, 1.38, 0);
      s.add(beacon);
      s.visible = false;
      this.group.add(s);
      this.stations.push(s);
    }
  }

  load(list: Placed[]): void {
    this.list = list.slice(0, MAX_DEPOTS).map(p => ({ ...p }));
    this.sync();
  }

  clear(): void {
    this.list.length = 0;
    this.sync();
  }

  private sync(): void {
    this.stations.forEach((s, i) => {
      const p = this.list[i];
      s.visible = !!p;
      if (p) s.position.set(p.x, p.y - 0.42, 0);
    });
  }

  place(x: number, y: number): boolean {
    if (this.list.length >= MAX_DEPOTS) return false;
    if (this.at(x, y) >= 0) return false;
    this.list.push({ x, y });
    this.sync();
    return true;
  }

  /** index of the depot the pod is parked at, or -1 */
  at(x: number, y: number): number {
    for (let i = 0; i < this.list.length; i++) {
      const p = this.list[i];
      if (Math.abs(p.x - x) < 1.4 && Math.abs(p.y - y) < 1.3) return i;
    }
    return -1;
  }
}
