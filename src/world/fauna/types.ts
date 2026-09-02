import * as THREE from 'three';
import { Terrain } from '../terrain';
import { T } from '../tiles';

// Shared contract for everything alive underground. Budget-first by design:
// every creature owns a fixed pool of instances, allocates at construction
// only, and never persists in saves — they respawn by region.

export type ThreatLevel = 'full' | 'reduced' | 'off';

export interface ThreatCtx {
  podX: number;
  podY: number;
  vx: number;
  vy: number;
  lampOn: boolean;
  /** 0..1 thruster output — what the cold worlds listen for */
  thrust: number;
  drilling: boolean;
  grounded: boolean;
  /** engine cold, drill still, hull barely moving: what the Long Ones listen for */
  still: number;
  /** a stolen fragment in the hold: the Wardens can feel it */
  carrying: boolean;
  dt: number;
  time: number;
  /** hull damage */
  hurt(amount: number, cause: string): void;
  /** fuel sip */
  drain(amount: number): void;
  /** an external force on the pod, in tiles/s of velocity */
  push(dx: number, dy: number): void;
  /** seize the controls for a moment */
  hold(seconds: number): void;
  /** the world's own material, found where a creature left it */
  native(n: number): void;
  /** take the most valuable ore in the hold — returns the tile type, or 0 */
  steal(): number;
  /** an ore comes back */
  give(t: number): void;
  /** camera shake */
  shake(a: number): void;
  /** first time a swarm notices the player */
  onAlert(): void;
  /** creature moments the game answers with sound, toast or dispatch */
  onEvent(id: FaunaEvent, x?: number, y?: number): void;
}

export type FaunaEvent =
  | 'swarm-wake'
  | 'longone-emerge' | 'longone-bite' | 'longone-lost'
  | 'rimewing-wake' | 'rimewing-freeze'
  | 'polyp-burst' | 'polyp-seen'
  | 'brinewyrm-churn' | 'brinewyrm-breach' | 'brinewyrm-bite'
  | 'stillwalker-seen' | 'stillwalker-grab'
  | 'riptide-enter' | 'riptide-eye'
  | 'shellback-seen' | 'shellback-seal' | 'shellback-killed'
  | 'mimic-hatch' | 'mimic-escaped' | 'mimic-killed' | 'crab-skitter'
  | 'frostbloom'
  | 'warden-step' | 'warden-wake' | 'warden-flash' | 'warden-blind' | 'warden-down'
  | 'kindled-seen' | 'kindled-touch';

export interface Creature {
  reset(): void;
  update(ctx: ThreatCtx, level: ThreatLevel): void;
  blast?(x: number, y: number, radius: number): void;
  lance?(x: number, y: number, dir: number, range: number): void;
  drillHit?(x: number, y: number, dt: number): void;
  /**
   * Dev sandbox only: force this creature into existence next to the pod at
   * (x, y), close enough to watch. Natural spawning keeps its distance and
   * picks its own ground; this deliberately does not. Each creature knows
   * where it actually belongs relative to the pod — in the pool, on the
   * wall, inside the rock — which is knowledge no external staging script
   * can guess at without duplicating the spawn rules.
   *
   * The sandbox prepares the habitat before calling (see src/dev/sandbox.ts)
   * and calls this every frame until the creature reports itself alive.
   */
  devStage?(x: number, y: number): void;
}

/** a light source that is not the pod: flares, and anything else that burns */
export interface LightSpot { x: number; y: number; life: number; alive: boolean }

export const tmpM = new THREE.Matrix4();
export const tmpP = new THREE.Vector3();
export const tmpQ = new THREE.Quaternion();
export const tmpS = new THREE.Vector3();
export const tmpE = new THREE.Euler();
export const tmpC = new THREE.Color();
export const tmpC2 = new THREE.Color();
export const tmpV = new THREE.Vector3();
export const AXIS_X = new THREE.Vector3(1, 0, 0);
export const AXIS_Y = new THREE.Vector3(0, 1, 0);
export const AXIS_Z = new THREE.Vector3(0, 0, 1);

export const air = (t: Terrain, x: number, y: number): boolean => t.get(x, y) === T.AIR;

/** true where a large body fits: open on both axes, never a 1-wide shaft */
export function wide(t: Terrain, x: number, y: number): boolean {
  if (!air(t, x, y)) return false;
  return (air(t, x - 1, y) || air(t, x + 1, y)) && (air(t, x, y - 1) || air(t, x, y + 1));
}

/** an air tile with rock on at least one side — somewhere to cling */
export function onWall(t: Terrain, x: number, y: number): boolean {
  if (!air(t, x, y)) return false;
  return t.solidAt(x - 1, y) || t.solidAt(x + 1, y) || t.solidAt(x, y - 1) || t.solidAt(x, y + 1);
}

/** fraction of open air in a (2r+1)² window — how much room the water has */
export function openness(t: Terrain, x: number, y: number, r = 2): number {
  let n = 0, tot = 0;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    tot++;
    if (!t.solidAt(x + dx, y + dy)) n++;
  }
  return n / tot;
}

/** straight line of sight through air (world coords, y up) */
export function lineOfSight(t: Terrain, x0: number, y0: number, x1: number, y1: number): boolean {
  const dx = x1 - x0, dy = y1 - y0;
  const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) * 2) || 1;
  for (let i = 1; i < steps; i++) {
    const f = i / steps;
    if (t.solidAt(Math.floor(x0 + dx * f), Math.floor(-(y0 + dy * f)))) return false;
  }
  return true;
}

/**
 * A chain of points that trails a head: each link is pulled to a fixed
 * distance behind the one before it. Gives every long body — worm, wyrm,
 * crawler — a smooth spine that turns corners like a spine and not a rope
 * of beads, with no per-frame allocation.
 */
export class Chain {
  x: Float32Array;
  y: Float32Array;
  constructor(readonly n: number, readonly spacing: number) {
    this.x = new Float32Array(n);
    this.y = new Float32Array(n);
  }
  /** lay the whole chain out from the head along a direction */
  lay(hx: number, hy: number, dx: number, dy: number): void {
    const len = Math.hypot(dx, dy) || 1;
    for (let i = 0; i < this.n; i++) {
      this.x[i] = hx - (dx / len) * this.spacing * i;
      this.y[i] = hy - (dy / len) * this.spacing * i;
    }
  }
  /** move the head; the body follows with a little slack so it whips */
  follow(hx: number, hy: number, slack = 1): void {
    this.x[0] = hx; this.y[0] = hy;
    for (let i = 1; i < this.n; i++) {
      const dx = this.x[i] - this.x[i - 1];
      const dy = this.y[i] - this.y[i - 1];
      const d = Math.hypot(dx, dy) || 0.0001;
      if (d > this.spacing) {
        const f = (d - this.spacing) / d * slack;
        this.x[i] -= dx * f;
        this.y[i] -= dy * f;
      }
    }
  }
  /** heading at link i (radians, world) */
  heading(i: number): number {
    const j = Math.min(this.n - 1, i + 1);
    const k = Math.max(0, i - 1);
    return Math.atan2(this.y[k] - this.y[j], this.x[k] - this.x[j]);
  }
}

/** orient a unit-length-along-Y box from a to b (used for legs and limbs) */
export function limb(mesh: THREE.Object3D, ax: number, ay: number, az: number, bx: number, by: number, bz: number, thick: number): void {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const len = Math.hypot(dx, dy, dz) || 0.0001;
  mesh.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
  tmpV.set(dx / len, dy / len, dz / len);
  mesh.quaternion.setFromUnitVectors(AXIS_Y, tmpV);
  mesh.scale.set(thick, len, thick);
}

export const lerp = (a: number, b: number, f: number): number => a + (b - a) * f;
export const clamp01 = (v: number): number => v < 0 ? 0 : v > 1 ? 1 : v;
export const ease = (v: number): number => v * v * (3 - 2 * v);
