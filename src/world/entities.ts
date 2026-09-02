import * as THREE from 'three';
import { Terrain } from './terrain';
import { T } from './tiles';
import { ACTIVE } from './worlds';
import { POD_W, POD_H } from '../config';
import { Particles } from '../fx/particles';
import { Creature, ThreatCtx, ThreatLevel, FaunaEvent } from './fauna/types';
import { FlareField } from './fauna/flares';
import { Glimmerflies } from './fauna/glimmerflies';
import { LongOne } from './fauna/longone';
import { Mimics } from './fauna/mimics';
import { Rimewings } from './fauna/rimewings';
import { Brinewyrm } from './fauna/brinewyrm';
import { Stillwalkers } from './fauna/stillwalkers';
import { Polyps } from './fauna/polyps';
import { Riptide } from './fauna/riptide';
import { Shellbacks } from './fauna/shellbacks';
import { Wardens } from './fauna/wardens';
import { Kindled, KindledHit } from './fauna/kindled';

export type { ThreatCtx, ThreatLevel, FaunaEvent } from './fauna/types';

/**
 * Everything alive underground, per world. One module per creature under
 * ./fauna; this is the roster. Each world gets a swarm tier, a hunter tier
 * and a stalker/builder tier keyed on the same sense the world runs on —
 * LIGHT on VEIL-3, HEAT on CRYOS-2, SPACE on MAELIS-6 — plus the constants:
 * the Wardens in the ruins and the Kindled in the chamber.
 */
export class ThreatField {
  level: ThreatLevel = 'full';
  /** 'off' clears the field once; anything left standing is stale */
  private cleared = false;
  /** 0..1 — how close and how awake the nearest swarm is (drives the score) */
  menace = 0;
  /** 0..1 — something big is moving through the rock (drives the rumble tick) */
  rumble = 0;
  /** 0..1 — a Warden has you in its beam */
  scrutiny = 0;
  /** 0..1 — something unlit is walking toward you */
  dread = 0;
  /** 0..1 — the Kindled have noticed you */
  presence = 0;

  readonly flares: FlareField;
  readonly flies: Glimmerflies | null = null;
  readonly longOne: LongOne | null = null;
  readonly mimics: Mimics | null = null;
  readonly rimewings: Rimewings | null = null;
  readonly brinewyrm: Brinewyrm | null = null;
  readonly stillwalkers: Stillwalkers | null = null;
  readonly polyps: Polyps | null = null;
  readonly riptide: Riptide | null = null;
  readonly shellbacks: Shellbacks | null = null;
  readonly wardens: Wardens | null = null;
  readonly kindled: Kindled;
  private creatures: Creature[] = [];

  constructor(scene: THREE.Scene, private terrain: Terrain, private particles: Particles) {
    this.flares = new FlareField(scene, terrain);
    this.kindled = new Kindled(scene);
    if (ACTIVE.husk) return;
    switch (ACTIVE.id) {
      case 'cryos2':
        this.rimewings = new Rimewings(scene, terrain, this.flares, particles);
        this.brinewyrm = new Brinewyrm(scene, terrain, this.flares, particles);
        this.stillwalkers = new Stillwalkers(scene, terrain, this.flares, particles);
        this.creatures.push(this.rimewings, this.brinewyrm, this.stillwalkers);
        break;
      case 'maelis6':
        this.polyps = new Polyps(scene, terrain, this.flares, particles);
        this.riptide = new Riptide(scene, terrain, this.flares);
        this.shellbacks = new Shellbacks(scene, terrain, this.flares, particles);
        this.creatures.push(this.polyps, this.riptide, this.shellbacks);
        break;
      default:
        this.flies = new Glimmerflies(scene, terrain, this.flares);
        this.longOne = new LongOne(scene, terrain, particles);
        this.mimics = new Mimics(scene, terrain, particles);
        this.creatures.push(this.flies, this.longOne, this.mimics);
        break;
    }
    this.wardens = new Wardens(scene, terrain, this.flares, particles);
    this.creatures.push(this.wardens);
  }

  reset(): void {
    for (const c of this.creatures) c.reset();
    this.flares.reset();
    this.kindled.reset();
    this.menace = 0; this.rumble = 0; this.scrutiny = 0; this.dread = 0; this.presence = 0;
  }

  update(ctx: ThreatCtx): void {
    // flares are a light source, not a threat: they burn even on a dead world
    this.flares.update(ctx.dt);
    if (this.level === 'off') {
      if (!this.cleared) { this.cleared = true; this.reset(); }
      return;
    }
    this.cleared = false;
    for (const c of this.creatures) c.update(ctx, this.level);
    this.menace = Math.max(this.flies?.menace ?? 0, this.rimewings?.menace ?? 0, this.polyps?.menace ?? 0);
    this.rumble = Math.max(this.longOne?.rumble ?? 0, this.brinewyrm?.rumble ?? 0, this.riptide?.rumble ?? 0);
    this.scrutiny = this.wardens?.scrutiny ?? 0;
    this.dread = this.stillwalkers?.dread ?? 0;
  }

  /**
   * The chamber has its own residents. Called from the pod frame and the
   * EVA frame alike with whoever is down there.
   */
  updateChamber(dt: number, time: number, x: number, y: number, eva: boolean, rite: boolean, onEvent: (id: FaunaEvent, x?: number, y?: number) => void): KindledHit {
    const hit = this.kindled.update(dt, time, x, y, eva, this.level === 'off', rite, () => onEvent('kindled-seen', x, y));
    this.presence = this.kindled.presence;
    return hit;
  }

  /** throw a flare — light somewhere that is not you */
  throwFlare(x: number, y: number, vx: number, vy: number): boolean {
    return this.flares.throw(x, y, vx, vy);
  }

  /** a geode mimic was cut: it hatches next frame, and it takes something */
  hatchMimic(x: number, y: number): void {
    this.mimics?.hatch(x, y);
  }

  /**
   * A frostbloom was cut: the cold comes out all at once and the air around
   * it sets to young ice. Never over the pod — you are sealed in, not
   * frozen solid — and young ice is the one tile a pod can ram through.
   */
  frostbloom(x: number, y: number, podX: number, podY: number): number {
    const cx = x + 0.5, cy = -(y + 0.5);
    let froze = 0;
    // everything within three tiles sets solid — except the tiles the pod is
    // actually inside, so it is encased, not entombed
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const tx = x + dx, ty = y + dy;
        if (dx * dx + dy * dy > 3 * 3) continue;
        if (this.terrain.get(tx, ty) !== T.AIR) continue;
        const wx = tx + 0.5, wy = -(ty + 0.5);
        if (Math.abs(wx - podX) < 0.5 + POD_W / 2 + 0.06 && Math.abs(wy - podY) < 0.5 + POD_H / 2 + 0.06) continue;
        this.terrain.fill(tx, ty, T.RIME);
        froze++;
      }
    }
    this.particles.dustBurst(cx, cy, 0xd8f0ff, { count: 40, speed: 4.5, up: 1.5, life: 1.1, gravity: 3, spread: 1.4 });
    this.particles.sparkBurst(cx, cy, 0xb0a8ff, { count: 16, speed: 3, up: 1, life: 0.8, gravity: 2, spread: 0.6 });
    return froze;
  }

  /** a spinning drill head in contact is the pod's only built-in weapon */
  drillHit(x: number, y: number, dt: number): void {
    for (const c of this.creatures) c.drillHit?.(x, y, dt);
  }

  /** a seismic charge went off: kill what it touched */
  blast(x: number, y: number, radius: number): void {
    for (const c of this.creatures) c.blast?.(x, y, radius);
  }

  /**
   * Lumen Lance: a hard directional pulse of light. Clears a swarm from a
   * corridor, staggers a hunter, blinds a Warden — light used as argument.
   */
  lance(x: number, y: number, dir: number, range: number): void {
    for (const c of this.creatures) c.lance?.(x, y, dir, range);
  }
}
