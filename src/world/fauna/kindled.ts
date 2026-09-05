import * as THREE from 'three';
import { CORE_ROW } from '../../config';
import { ACTIVE } from '../worlds';
import { clamp01, lerp } from './types';

// THE KINDLED — the core chamber's own. Every world.
//
// Four figures on the chamber floor, made of the same light as the core.
// Not solid: a shimmer of motes in the shape of someone standing, with
// something dark and narrow inside where a body would be. They face the
// fragment. When you enter they turn, and drift toward you, and stop two
// steps short, and wait. They do not chase. They do not need to.
//
// On foot they give ground as you come, keeping their two steps exactly —
// until the wall is at their back. Corner one and the suit's oxygen is
// simply gone: blackout, wake in the pod. Fly the pod into one and it
// throws you clear, unhurt — they keep the light company; they do not
// fight for it. When the fragment is gone, so are they.

const N = 4;
const PTS = 96;
const FLOOR_Y = -(CORE_ROW + 10);
const POSTS = [22.5, 26, 38, 41.5];
const NOTICE = 8;
const STOP = 2.2;
const YIELD = 1.5;
// the chamber floor runs x = 18..46 (terrain.ts): where a yielding figure runs out of room
const WALL_L = 18.7;
const WALL_R = 45.3;

export type KindledHit = 'suit' | 'pod' | null;

interface Figure {
  x: number; y: number;
  homeX: number;
  face: number;
  seed: Float32Array;   // rest positions (local)
  points: THREE.Points;
  pos: Float32Array;
  core: THREE.Mesh;
  light: THREE.PointLight;
  arousal: number;      // 0..1 how much it has noticed you
  touchCd: number;
}

export class Kindled {
  private figs: Figure[] = [];
  private mat: THREE.PointsMaterial;
  private fade = 1;
  private seenFired = false;
  /** 0..1 — the nearest figure's attention on you */
  presence = 0;
  /** where the figure that last touched you stands, so the throw is away from it */
  touchX = 0;

  constructor(scene: THREE.Scene) {
    this.mat = new THREE.PointsMaterial({
      color: 0xffffff, size: 0.075, transparent: true, opacity: 0.85, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false,
    });
    const coreGeo = new THREE.CapsuleGeometry(0.1, 0.55, 3, 6);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    for (let i = 0; i < N; i++) {
      const seed = new Float32Array(PTS * 3);
      for (let k = 0; k < PTS; k++) {
        // a standing figure: head, shoulders, torso, hips, two legs, two arms
        const r = Math.random();
        let x = 0, y = 0, z = 0;
        if (r < 0.16) { // head
          const a = Math.random() * Math.PI * 2, b = Math.acos(2 * Math.random() - 1), rr = 0.15;
          x = Math.sin(b) * Math.cos(a) * rr; y = 0.86 + Math.cos(b) * rr; z = Math.sin(b) * Math.sin(a) * rr;
        } else if (r < 0.5) { // torso
          const a = Math.random() * Math.PI * 2, t = Math.random();
          const w = 0.2 - t * 0.08;
          x = Math.cos(a) * w * Math.sqrt(Math.random()); y = 0.62 - t * 0.55; z = Math.sin(a) * w * 0.5 * Math.sqrt(Math.random());
        } else if (r < 0.8) { // legs
          const s = Math.random() < 0.5 ? -1 : 1, t = Math.random();
          x = s * (0.08 + t * 0.03) + (Math.random() - 0.5) * 0.06; y = 0.07 - t * 0.6; z = (Math.random() - 0.5) * 0.06;
        } else { // arms, hanging
          const s = Math.random() < 0.5 ? -1 : 1, t = Math.random();
          x = s * (0.24 + t * 0.03) + (Math.random() - 0.5) * 0.04; y = 0.58 - t * 0.55; z = (Math.random() - 0.5) * 0.05;
        }
        seed[k * 3] = x; seed[k * 3 + 1] = y; seed[k * 3 + 2] = z;
      }
      const pos = new Float32Array(PTS * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
      const points = new THREE.Points(geo, this.mat);
      points.frustumCulled = false;
      const core = new THREE.Mesh(coreGeo, coreMat);
      const light = new THREE.PointLight(0xffffff, 1.6, 5, 1.8);
      scene.add(points, core, light);
      this.figs.push({
        x: POSTS[i], y: FLOOR_Y + 0.55, homeX: POSTS[i], face: POSTS[i] < 32 ? 1 : -1,
        seed, points, pos, core, light, arousal: 0, touchCd: 0,
      });
    }
    this.setVisible(false);
  }

  private setVisible(v: boolean): void {
    // the lights never leave the light state — toggling one recompiles every
    // shader in the world. Dark means intensity 0; update() re-drives it.
    for (const f of this.figs) {
      f.points.visible = v; f.core.visible = v;
      if (!v) f.light.intensity = 0;
    }
  }

  reset(): void {
    for (const f of this.figs) { f.x = f.homeX; f.arousal = 0; f.touchCd = 0; }
    this.seenFired = false;
    this.presence = 0;
  }

  /**
   * Called from both the pod frame and the EVA frame with whoever is in the
   * chamber. `gone` = the fragment is taken; `rite` = the Communion is on
   * and the figures stand back and watch.
   */
  update(dt: number, time: number, x: number, y: number, eva: boolean, gone: boolean, rite: boolean, onSeen: () => void): KindledHit {
    const inChamber = y < -(CORE_ROW - 18);
    this.fade += (((gone || !inChamber) ? 0 : 1) - this.fade) * Math.min(1, dt * 1.5);
    if (this.fade < 0.02) { this.setVisible(false); this.presence = 0; return null; }
    this.setVisible(true);
    this.mat.color.setHex(ACTIVE.core.light);
    this.mat.opacity = 0.85 * this.fade;

    let hit: KindledHit = null;
    let presence = 0;
    for (let i = 0; i < N; i++) {
      const f = this.figs[i];
      const dx = x - f.x, dy = y - f.y;
      const dist = Math.hypot(dx, dy);
      const noticing = !rite && dist < NOTICE;
      f.arousal += ((noticing ? 1 : 0) - f.arousal) * Math.min(1, dt * 1.2);
      presence = Math.max(presence, f.arousal * clamp01(1 - dist / NOTICE));
      f.touchCd = Math.max(0, f.touchCd - dt);
      let cornered = false;
      if (noticing) {
        if (eva && dist < YIELD) {
          // on foot they give ground — a step faster than you can walk,
          // keeping the distance exact — until the wall is at their back.
          // Only a cornered one reaches for you.
          const nx = f.x - Math.sign(dx || 1) * 4.2 * dt;
          if (nx > WALL_L && nx < WALL_R) f.x = nx;
          else cornered = true;
        } else if (dist > STOP) {
          // drift toward you, stop two steps short
          f.x += Math.sign(dx) * Math.min(Math.abs(dx), 0.9 * f.arousal * dt);
        }
        f.face = dx > 0 ? 1 : -1;
        if (!this.seenFired) { this.seenFired = true; onSeen(); }
        if ((eva ? cornered && dist < 0.75 : dist < 1.0) && f.touchCd <= 0) {
          f.touchCd = 1.4;
          this.touchX = f.x;
          hit = eva ? 'suit' : 'pod';
        }
      } else {
        // home, and turned to the fragment
        f.x += (f.homeX - f.x) * Math.min(1, dt * 0.4);
        f.face = f.homeX < 32 ? 1 : -1;
      }
      const bob = Math.sin(time * 0.9 + i * 1.7) * 0.04;
      const fy = FLOOR_Y + 0.55 + bob;
      // motes shimmer harder the more it is looking at you
      const shimmer = 0.012 + f.arousal * 0.03;
      for (let k = 0; k < PTS; k++) {
        const sx = f.seed[k * 3] * f.face, sy = f.seed[k * 3 + 1], sz = f.seed[k * 3 + 2];
        const j = Math.sin(time * 7 + k * 1.3) * shimmer;
        const j2 = Math.cos(time * 5.3 + k * 0.7) * shimmer;
        f.pos[k * 3] = f.x + sx + j;
        f.pos[k * 3 + 1] = fy + sy + j2;
        f.pos[k * 3 + 2] = 0.2 + sz;
      }
      (f.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      f.core.position.set(f.x, fy + 0.3, 0.2);
      f.core.scale.setScalar(this.fade);
      f.light.position.set(f.x, fy + 0.5, 0.6);
      f.light.color.setHex(ACTIVE.core.light);
      f.light.intensity = (1.2 + f.arousal * 2.2 + Math.sin(time * 3 + i) * 0.3) * this.fade;
    }
    this.presence = lerp(this.presence, presence, Math.min(1, dt * 3));
    return hit;
  }
}
