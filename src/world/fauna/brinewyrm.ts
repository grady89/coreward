import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Terrain } from '../terrain';
import { T } from '../tiles';
import { ACTIVE } from '../worlds';
import { Particles } from '../../fx/particles';
import { FlareField } from './flares';
import {
  Creature, ThreatCtx, ThreatLevel, Chain, lerp,
  tmpM, tmpP, tmpQ, tmpS, tmpC, tmpC2, Spill, AXIS_X, AXIS_Z,
} from './types';

// THE BRINEWYRM — CRYOS-2's hunter tier. Keyed on HEAT.
//
// It lives in the cryobrine: a pearl eel cruising the pool, its nacre
// throwing ice-cyan and violet off every facet, a line of lights down its
// flank. Run your engine near a pool and the lights run hot, the brine
// churns — and it BREACHES: a jawed head with a lit throat and one bright
// eye, thrown clear of the pool in an arc at your nozzle. The bite is not what
// kills you. It is the drag back toward the brine.
//
// A flare thrown into a pool is heat too. Scout with it.

const SEGS = 16;
const SPACING = 0.4;
const BAND = 230;
const NOTICE = 7.5;
const GRAV = 14;
const BITE = 22;
const qRoll = new THREE.Quaternion();
/** the head is drawn this much over the body's scale: the biting end reads at
 *  play size. Visual only: the bite still measures from the chain's head. */
const HEAD = 1.75;
/** points on each jaw's mouth face, near its tip, in that jaw's own space */
const JAW_U_TIP = new THREE.Vector2(0.64, -0.065);
const JAW_L_TIP = new THREE.Vector2(0.52, 0.052);
const tmpV2 = new THREE.Vector2();
const ORIGIN2 = new THREE.Vector2();

type Phase = 'cruise' | 'churn' | 'breach' | 'fall' | 'sinking';

export class Brinewyrm implements Creature {
  alive = false;
  rumble = 0;
  timer = 10;
  phase: Phase = 'cruise';
  x = 0; y = 0;
  private vx = 0; private vy = 0;
  private dirX = 1; private dirY = 0;
  private alert = 0;
  private phaseT = 0;
  private life = 0;
  private cooldown = 0;
  private bit = false;
  private latch = 0;
  private poolX = 0; private poolY = 0;
  private wanderX = 0; private wanderY = 0;
  private wanderT = 0;
  private stunT = 0;
  private gape = 0;
  private chain = new Chain(SEGS, SPACING);

  private body: THREE.InstancedMesh;
  /** the photophores down the flank, two per segment */
  private spots: THREE.InstancedMesh;
  private head: THREE.Group;
  private jawU: THREE.Group;
  private jawL: THREE.Group;
  private throat: THREE.Mesh;
  private throatMat: THREE.MeshBasicMaterial;
  /** the lit mouth lining filling the gap between the jaws, reshaped each frame */
  private gullet: THREE.Mesh;
  private gulletMat: THREE.MeshBasicMaterial;
  private eyeMat: THREE.MeshBasicMaterial;
  private light: THREE.PointLight;
  /** its light on the pool and the stone: one at the head, one down the body */
  private spillHead: Spill;
  private spillBody: Spill;
  /** strength of the nacre film (it runs brighter as the wyrm heats up) */
  private nacre = { value: 0.6 };

  constructor(scene: THREE.Scene, private terrain: Terrain, private flares: FlareField, private particles: Particles) {
    // a segment is a stretched faceted gem, long enough that neighbours
    // overlap into one solid body; the slow roll turns its facets through
    // the nacre so the sheen travels
    const segGeo = new THREE.IcosahedronGeometry(0.34, 0);
    segGeo.scale(1.3, 0.92, 0.9);
    // pearl with a thin-film sheen: each flat facet throws its own tint,
    // set by its angle to the eye and which way it faces (ice-cyan through
    // violet, a rose glint between), strongest at the silhouette, plus a
    // cyan-violet rim so it separates from dark rock. The pearl underneath
    // is kept a step down so the sheen, not the albedo, carries the body.
    const nacreMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, flatShading: true, roughness: 0.26, metalness: 0.1,
      emissive: 0x1e2232,
    });
    nacreMat.onBeforeCompile = sh => {
      sh.uniforms.uNacre = this.nacre;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uNacre;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{
  float ndv = saturate(abs(dot(normalize(vViewPosition), normal)));
  float fr = pow(1.0 - ndv, 1.6);
  // the film's phase: view angle plus the facet's own facing, so
  // neighbouring facets split into different colours and the roll walks them
  float ph = ndv * 2.2 + dot(normal, vec3(1.7, 2.6, 0.9));
  float t = 0.5 + 0.5 * sin(ph * 3.1416);
  vec3 film = mix(vec3(0.32, 0.9, 1.0), vec3(0.7, 0.46, 1.0), t * t);
  // a rose-pearl glint where the band turns over
  film = mix(film, vec3(1.0, 0.7, 0.92), 0.55 * pow(1.0 - abs(2.0 * t - 1.0), 3.0));
  vec3 rim = mix(vec3(0.5, 0.9, 1.0), vec3(0.72, 0.56, 1.0), t);
  totalEmissiveRadiance += film * (0.4 + 0.8 * fr) * uNacre + rim * fr * fr * 0.9;
}`);
    };
    nacreMat.customProgramCacheKey = () => 'brinewyrm-nacre-v2';
    this.body = new THREE.InstancedMesh(segGeo, nacreMat, SEGS);
    this.body.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.body.frustumCulled = false;
    this.body.count = 0;
    this.body.setColorAt(0, tmpC.setHex(0xffffff));
    scene.add(this.body);

    const spotGeo = new THREE.OctahedronGeometry(0.075, 0);
    const spotMat = new THREE.MeshBasicMaterial({ toneMapped: false });
    this.spots = new THREE.InstancedMesh(spotGeo, spotMat, SEGS * 2);
    this.spots.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.spots.frustumCulled = false;
    this.spots.count = 0;
    this.spots.setColorAt(0, tmpC.setHex(0xffffff));
    scene.add(this.spots);

    // the head: a heavy faceted skull, two wedge jaws that gape in the
    // plane you see them in, a row of teeth on each, a lit throat between
    // them and one bright eye on the near side. +X is forward.
    this.head = new THREE.Group();
    const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38, 0), nacreMat);
    skull.scale.set(1.15, 0.92, 0.95);
    skull.position.x = -0.06;
    const boneMat = new THREE.MeshStandardMaterial({
      color: 0xf4fbff, flatShading: true, roughness: 0.2, metalness: 0.05, emissive: 0x34405a,
    });
    const jaw = (len: number, rad: number, down: number): THREE.Group => {
      const g = new THREE.Group();
      // a four-sided wedge, flat face toward the mouth, tip forward
      const geo = new THREE.ConeGeometry(rad, len, 4);
      geo.rotateY(Math.PI / 4);
      geo.rotateZ(-Math.PI / 2);
      geo.scale(1, 0.62, 1);
      geo.translate(len / 2, -down * rad * 0.2, 0);
      g.add(new THREE.Mesh(geo, nacreMat));
      // teeth along the mouth edge, pointing across the gap
      const teeth: THREE.BufferGeometry[] = [];
      const n = Math.round(len / 0.16);
      for (let i = 0; i < n; i++) {
        const t = new THREE.ConeGeometry(0.042, 0.15 - i * 0.012, 4);
        if (down > 0) t.rotateZ(Math.PI);
        const x = 0.14 + i * (len - 0.22) / Math.max(1, n - 1);
        // the wedge narrows toward its tip: seat each tooth on its mouth
        // face (offset + flat-face distance × squash), mostly proud of it
        const face = rad * 0.2 + rad * 0.707 * 0.62 * (1 - x / len);
        t.translate(x, -down * (face + 0.03), 0.04);
        teeth.push(t);
      }
      g.add(new THREE.Mesh(mergeGeometries(teeth), boneMat));
      return g;
    };
    this.jawU = jaw(0.74, 0.27, 1);
    this.jawU.position.set(0.12, 0.05, 0);
    this.jawL = jaw(0.6, 0.22, -1);
    this.jawL.position.set(0.1, -0.08, 0);
    this.throatMat = new THREE.MeshBasicMaterial({ color: 0xece4ff, toneMapped: false });
    this.throat = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), this.throatMat);
    this.throat.position.set(0.36, -0.02, 0);
    // the mouth lining: one triangle from the hinge to the two jaw tips, set
    // in the jaws' mid-plane so the wedges hide it except in the gap. White-hot
    // at the hinge, violet out to the teeth: an accent against the cyan brine,
    // so the biting end is the first thing you read
    const gulletGeo = new THREE.BufferGeometry();
    gulletGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3).setUsage(THREE.DynamicDrawUsage));
    gulletGeo.setAttribute('color', new THREE.Float32BufferAttribute([1, 0.8, 1, 0.42, 0.2, 1, 0.4, 0.18, 0.95], 3));
    this.gulletMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, side: THREE.DoubleSide });
    this.gullet = new THREE.Mesh(gulletGeo, this.gulletMat);
    this.gullet.frustumCulled = false;
    this.eyeMat = new THREE.MeshBasicMaterial({ color: 0xeef8ff, toneMapped: false });
    const eye = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 0), this.eyeMat);
    eye.position.set(0.06, 0.12, 0.4);
    this.light = new THREE.PointLight(0x8ae4ff, 0, 7, 1.6);
    // out in front of the head, not inside it: it lights the pool and the
    // stone without burning the jaws to white
    this.light.position.set(0.5, 0, 1.1);
    this.head.add(skull, this.jawU, this.jawL, this.throat, this.gullet, eye, this.light);
    this.head.visible = false;
    scene.add(this.head);

    this.spillHead = new Spill(scene, 0x8ae4ff);
    this.spillBody = new Spill(scene, 0x7ad8ff);
  }

  reset(): void {
    this.alive = false;
    this.body.count = 0; this.spots.count = 0;
    this.head.visible = false;
    this.spillHead.off(); this.spillBody.off();
    this.rumble = 0;
  }

  private die(): void {
    this.alive = false;
    this.body.count = 0; this.spots.count = 0;
    this.head.visible = false;
    this.spillHead.off(); this.spillBody.off();
  }

  private brine(x: number, y: number): boolean { return this.terrain.get(x, y) === T.LAVA; }

  /** connected brine tiles from (x, y), counted up to `cap` — a wyrm is six
   *  tiles of body and will not live in a puddle */
  private poolSize(x: number, y: number, cap: number): number {
    const seen = new Set<number>();
    const stack = [x + y * this.terrain.w];
    while (stack.length > 0 && seen.size < cap) {
      const i = stack.pop()!;
      if (seen.has(i)) continue;
      const px = i % this.terrain.w, py = Math.floor(i / this.terrain.w);
      if (!this.brine(px, py)) continue;
      seen.add(i);
      stack.push(i - 1, i + 1, i - this.terrain.w, i + this.terrain.w);
    }
    return seen.size;
  }

  private trySpawn(podX: number, podY: number): boolean {
    const cx = Math.floor(podX), cy = Math.floor(-podY);
    let best = -1, bx = 0, by = 0;
    for (let attempt = 0; attempt < 60; attempt++) {
      const x = cx + Math.floor((Math.random() - 0.5) * 26);
      const y = cy + Math.floor((Math.random() - 0.5) * 26);
      if (x < 1 || x >= this.terrain.w - 1 || y < BAND) continue;
      if (!this.brine(x, y)) continue;
      if (this.poolSize(x, y, 10) < 10) continue;
      const d = Math.hypot(x + 0.5 - podX, -(y + 0.5) - podY);
      if (d < 5) continue;
      // prefer pools with a free surface above — the ones you fly over
      const score = (this.brine(x, y - 1) ? 0 : 2) + (this.brine(x + 1, y) || this.brine(x - 1, y) ? 1 : 0);
      if (score > best) { best = score; bx = x; by = y; }
    }
    if (best < 0) return false;
    this.alive = true;
    this.phase = 'cruise'; this.phaseT = 0;
    this.x = bx + 0.5; this.y = -(by + 0.5);
    this.poolX = this.x; this.poolY = this.y;
    this.vx = 0; this.vy = 0;
    this.dirX = 1; this.dirY = 0;
    this.alert = 0; this.life = 0; this.cooldown = 3; this.latch = 0; this.stunT = 0; this.gape = 0;
    this.wanderT = 0;
    this.chain.lay(this.x, this.y, 1, 0);
    this.head.visible = true;
    return true;
  }

  blast(x: number, y: number, radius: number): void {
    if (this.alive && Math.hypot(this.x - x, this.y - y) < radius + 1) {
      this.particles.sparkBurst(this.x, this.y, 0x5ad8e6, { count: 24, speed: 4, up: 2, life: 1, gravity: 6, spread: 0.6 });
      this.die();
    }
  }

  lance(x: number, y: number, dir: number, range: number): void {
    if (!this.alive) return;
    const dx = (this.x - x) * dir;
    if (dx > -0.5 && dx < range && Math.abs(this.y - y) < 1.3) { this.stunT = 2.5; this.latch = 0; }
  }

  drillHit(x: number, y: number): void {
    if (this.alive && this.phase === 'breach' && Math.hypot(this.x - x, this.y - y) < 1) { this.latch = 0; this.phase = 'fall'; this.phaseT = 0; }
  }

  private candBuf: [number, number][] = [[0, 0], [0, 0], [0, 0], [0, 0]];

  /** cruise inside the pool: pick a brine tile to swim to, swim there */
  private cruise(dt: number): void {
    this.wanderT -= dt;
    if (this.wanderT <= 0 || Math.hypot(this.wanderX - this.x, this.wanderY - this.y) < 0.6) {
      this.wanderT = 1.5 + Math.random() * 2;
      const cx = Math.floor(this.x), cy = Math.floor(-this.y);
      for (let k = 0; k < 12; k++) {
        const x = cx + Math.floor((Math.random() - 0.5) * 9);
        const y = cy + Math.floor((Math.random() - 0.5) * 7);
        if (this.brine(x, y)) { this.wanderX = x + 0.5; this.wanderY = -(y + 0.5); break; }
      }
    }
    const dx = this.wanderX - this.x, dy = this.wanderY - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const sp = 2.2;
    // filled in place: cruise steering runs every frame the wyrm lives
    const cand = this.candBuf;
    cand[0][0] = dx / d; cand[0][1] = dy / d;
    cand[1][0] = Math.sign(dx); cand[1][1] = 0;
    cand[2][0] = 0; cand[2][1] = Math.sign(dy);
    cand[3][0] = this.dirX; cand[3][1] = this.dirY;
    for (const [cx, cy] of cand) {
      if (cx === 0 && cy === 0) continue;
      const len = Math.hypot(cx, cy) || 1;
      const nx = this.x + (cx / len) * sp * dt, ny = this.y + (cy / len) * sp * dt;
      if (this.brine(Math.floor(nx), Math.floor(-ny))) {
        this.x = nx; this.y = ny;
        this.dirX = lerp(this.dirX, cx / len, Math.min(1, dt * 4));
        this.dirY = lerp(this.dirY, cy / len, Math.min(1, dt * 4));
        return;
      }
    }
    this.wanderT = 0;
  }

  devStage(x: number, y: number): void {
    if (!this.alive && !this.trySpawn(x, y)) return;
    // trySpawn deliberately refuses pools within 5 tiles and prefers whatever
    // natural brine is nearest — both wrong for a sandbox, where the pool
    // under your nozzle IS the test. Put it in the closest brine there is.
    const cx = Math.floor(x), cy = Math.floor(-y);
    let best = Infinity, bx = -1, by = -1;
    for (let dy = -8; dy <= 8; dy++) {
      for (let dx = -8; dx <= 8; dx++) {
        const tx = cx + dx, ty = cy + dy;
        if (!this.brine(tx, ty)) continue;
        const d = dx * dx + dy * dy;
        if (d < best) { best = d; bx = tx; by = ty; }
      }
    }
    if (bx < 0) return;
    this.x = this.poolX = bx + 0.5;
    this.y = this.poolY = -(by + 0.5);
    this.phase = 'cruise'; this.phaseT = 0;
    this.alert = 0; this.cooldown = 0; this.stunT = 0; this.wanderT = 0;
    this.chain.lay(this.x, this.y, 1, 0);
  }

  update(ctx: ThreatCtx, level: ThreatLevel): void {
    const { dt, podX, podY, time } = ctx;
    if (!this.alive) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = 9 + Math.random() * 10;
        if (Math.floor(-podY) >= BAND && Math.random() < (level === 'reduced' ? 0.4 : 0.8)) this.trySpawn(podX, podY);
      }
      if (!this.alive) { this.rumble += (0 - this.rumble) * Math.min(1, dt * 2); return; }
    }

    this.life += dt;
    this.phaseT += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.stunT = Math.max(0, this.stunT - dt);
    const dx = podX - this.x, dy = podY - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 40 || this.life > 240) { this.die(); return; }

    const flare = this.flares.near(this.x, this.y, 6);
    const submerged = this.brine(Math.floor(this.x), Math.floor(-this.y));
    let rumbleT = 0;

    switch (this.phase) {
      case 'cruise': {
        this.cruise(dt);
        // heat within reach: engine near the pool, or a flare in it
        const warm = (ctx.thrust > 0.05 && dist < NOTICE) || !!flare;
        if (warm && this.cooldown <= 0 && this.stunT <= 0) this.alert = Math.min(1, this.alert + dt * 0.9);
        else this.alert = Math.max(0, this.alert - dt * 0.5);
        if (this.alert >= 1) {
          this.phase = 'churn'; this.phaseT = 0;
          ctx.onEvent('brinewyrm-churn', this.x, this.y);
        }
        rumbleT = this.alert * 0.5;
        break;
      }
      case 'churn': {
        // the glow comes up: surface bubbles for a full second before it goes
        if (Math.random() < dt * 14) {
          this.particles.sparkBurst(this.x + (Math.random() - 0.5) * 1.5, this.y + 0.4, ACTIVE.fluid.pulseA, { count: 2, speed: 1.6, up: 3, life: 0.6, gravity: 6, spread: 0.3 });
        }
        rumbleT = 0.7;
        if (this.phaseT >= 1.0) {
          const tx = flare ? flare.x : podX;
          const ty = flare ? flare.y : podY - 0.4;
          const ddx = tx - this.x, ddy = ty - this.y;
          const dd = Math.hypot(ddx, ddy);
          const tf = Math.min(0.95, Math.max(0.45, dd / 12));
          this.vx = ddx / tf;
          this.vy = ddy / tf + 0.5 * GRAV * tf;
          this.phase = 'breach'; this.phaseT = 0; this.bit = false; this.latch = 0;
          ctx.shake(0.3);
          ctx.onEvent('brinewyrm-breach', this.x, this.y);
          this.particles.sparkBurst(this.x, this.y + 0.3, ACTIVE.fluid.pulseA, { count: 30, speed: 5, up: 4, life: 0.9, gravity: 10, spread: 0.9 });
        }
        break;
      }
      case 'breach':
      case 'fall': {
        this.vy -= GRAV * dt;
        const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
        if (this.terrain.solidAt(Math.floor(nx), Math.floor(-this.y))) { this.vx *= -0.2; } else { this.x = nx; }
        if (this.terrain.solidAt(Math.floor(this.x), Math.floor(-ny))) { this.vy = 0; this.vx *= 0.5; } else { this.y = ny; }
        const sp = Math.hypot(this.vx, this.vy);
        if (sp > 0.5) { this.dirX = this.vx / sp; this.dirY = this.vy / sp; }
        rumbleT = 0.8;
        if (this.phase === 'breach') {
          this.gape = lerp(this.gape, dist < 2.5 ? 1 : 0.3, Math.min(1, dt * 8));
          if (!this.bit && dist < 1.05) {
            this.bit = true;
            this.latch = 1.0;
            ctx.hurt(BITE * (level === 'reduced' ? 0.5 : 1), 'a Brinewyrm');
            ctx.shake(0.4);
            ctx.onEvent('brinewyrm-bite', this.x, this.y);
            // and it turns for home with you in its mouth
            const px = this.poolX - this.x, py = this.poolY - this.y;
            const pd = Math.hypot(px, py) || 1;
            this.vx = px / pd * 7; this.vy = py / pd * 7 + 2;
          }
          if (this.phaseT > 2.2 || (this.phaseT > 0.4 && this.vy < 0 && submerged)) { this.phase = 'fall'; this.phaseT = 0; }
        }
        if (this.latch > 0) {
          this.latch -= dt;
          const px = this.poolX - podX, py = this.poolY - podY;
          const pd = Math.hypot(px, py) || 1;
          const pull = (level === 'reduced' ? 14 : 24) * dt;
          ctx.push(px / pd * pull, py / pd * pull);
          if (Math.random() < dt * 20) {
            this.particles.sparkBurst(podX, podY, ACTIVE.fluid.pulseA, { count: 1, speed: 1, up: 1, life: 0.5, gravity: 8, spread: 0.6 });
          }
        }
        if (this.phase === 'fall' && (submerged || this.phaseT > 3)) {
          this.phase = 'sinking'; this.phaseT = 0;
          this.particles.sparkBurst(this.x, this.y + 0.3, ACTIVE.fluid.pulseA, { count: 16, speed: 3, up: 3, life: 0.7, gravity: 9, spread: 0.7 });
        }
        break;
      }
      case 'sinking': {
        this.vx *= 1 - Math.min(1, dt * 3); this.vy = -1.2;
        const ny = this.y + this.vy * dt;
        if (this.brine(Math.floor(this.x), Math.floor(-ny))) this.y = ny;
        this.gape = lerp(this.gape, 0, Math.min(1, dt * 4));
        if (this.phaseT > 1.2) {
          this.phase = 'cruise'; this.phaseT = 0; this.alert = 0; this.cooldown = 6;
          if (!submerged) { this.x = this.poolX; this.y = this.poolY; this.chain.lay(this.x, this.y, 1, 0); }
          this.poolX = this.x; this.poolY = this.y;
        }
        rumbleT = 0.3;
        break;
      }
    }
    this.rumble += (rumbleT - this.rumble) * Math.min(1, dt * 3);

    // ---- body ----
    this.chain.follow(this.x, this.y, this.phase === 'breach' ? 0.85 : 1);
    const inWater = this.phase === 'cruise' || this.phase === 'sinking' || this.phase === 'churn';
    const glow = this.phase === 'churn' ? 1 : this.phase === 'cruise' ? 0.35 + this.alert * 0.5 : 0.75;
    const swim = this.phase === 'cruise' ? 0.12 : 0.06;
    this.nacre.value = 0.55 + glow * 0.5;
    // the accents stay ice-cyan whatever brine it swims in
    const spotHue = tmpC2.setHex(0x8ae8ff).lerp(tmpC.setHex(ACTIVE.fluid.pulseA), 0.25).getHex();
    let midX = 0, midY = 0;
    for (let i = 0; i < SEGS; i++) {
      const h = this.chain.heading(i);
      const wave = Math.sin(time * 6 - i * 0.6) * swim * (0.2 + i / SEGS);
      const px = this.chain.x[i] - Math.sin(h) * wave;
      const py = this.chain.y[i] + Math.cos(h) * wave;
      const z = inWater ? 0.55 : 0.15;
      if (i === 0) {
        this.head.position.set(px, py, z);
        this.head.rotation.set(0, 0, h);
        // keep the skull on top and the eye on the near side whichever way it swims
        // (and a size up on the body: the dangerous end reads at play scale)
        this.head.scale.set(HEAD, Math.cos(h) < 0 ? -HEAD : HEAD, HEAD);
        // never quite shut: a lit seam of throat shows between the jaws
        this.jawU.rotation.z = 0.2 + this.gape * 0.5;
        this.jawL.rotation.z = -(0.27 + this.gape * 0.6);
        // the lining follows the jaws: hinge, upper tip, lower tip
        const gp = this.gullet.geometry.attributes.position as THREE.BufferAttribute;
        gp.setXYZ(0, 0.0, -0.02, 0);
        tmpV2.copy(JAW_U_TIP).rotateAround(ORIGIN2, this.jawU.rotation.z);
        gp.setXYZ(1, this.jawU.position.x + tmpV2.x, this.jawU.position.y + tmpV2.y, 0);
        tmpV2.copy(JAW_L_TIP).rotateAround(ORIGIN2, this.jawL.rotation.z);
        gp.setXYZ(2, this.jawL.position.x + tmpV2.x, this.jawL.position.y + tmpV2.y, 0);
        gp.needsUpdate = true;
        this.gulletMat.color.setScalar(1.3 + glow * 0.5 + this.gape * 1.0);
        // small and white-hot at the back of the mouth, so the violet lining shows round it
        this.throat.scale.set(0.9 + this.gape * 0.4, 0.45 + this.gape * 1.1, 0.5);
        // capped so the jaw's facets still read inside the bloom
        this.throatMat.color.setHex(0xece4ff).multiplyScalar(1.2 + glow * 0.7 + this.gape * 1.3);
        this.eyeMat.color.setHex(0xe0f4ff).multiplyScalar(2 + glow * 0.7 + this.gape);
        this.light.intensity = 1 + glow * 3 + this.gape * 2;
        this.spillHead.set(px, py, 3.8, 3.8, 0.24 + glow * 0.18 + this.gape * 0.3, 0x8ae4ff, 1.2);
        tmpM.makeScale(0, 0, 0);
        this.body.setMatrixAt(0, tmpM);
        this.spots.setMatrixAt(0, tmpM);
        this.spots.setMatrixAt(1, tmpM);
        continue;
      }
      if (i === SEGS >> 1) { midX = px; midY = py; }
      const t = i / SEGS;
      const taper = 1.05 - t * 0.7;
      tmpP.set(px, py, z);
      // heading, then the roll about the segment's OWN long axis (an XYZ
      // Euler rolls about world X instead, which tips any segment that is
      // not horizontal edge-on to the camera and breaks the body into beads)
      tmpQ.setFromAxisAngle(AXIS_Z, h).multiply(qRoll.setFromAxisAngle(AXIS_X, time * 0.5 + i * 0.5));
      // a breach stretches the chain past its spacing: stretch the segment
      // with it, so the body stays one body and never flies apart in chunks
      const gap = Math.hypot(this.chain.x[i] - this.chain.x[i - 1], this.chain.y[i] - this.chain.y[i - 1]);
      tmpS.set(Math.min(2.5, Math.max(1, gap / SPACING)), taper, taper);
      tmpM.compose(tmpP, tmpQ, tmpS);
      this.body.setMatrixAt(i, tmpM);
      // pearl that drifts lavender → ice along the body, a step below
      // white so the sheen carries it; in the pool it takes a little of the
      // brine's colour but stays solid
      const tint = 0.5 + 0.5 * Math.sin(i * 0.9 - time * 1.2);
      tmpC.setHex(0xe0d6f4).lerp(tmpC2.setHex(0xcceaf6), tint);
      if (inWater) tmpC.lerp(tmpC2.setHex(ACTIVE.fluid.base), 0.2);
      this.body.setColorAt(i, tmpC);
      // the flank lights pulse head → tail, the opposite way to a Long One's spine
      const pulse = Math.pow(Math.max(0, Math.sin(time * 3.5 - i * 0.7)), 2);
      const ch = Math.cos(h), sh = Math.sin(h);
      for (let k = 0; k < 2; k++) {
        // two rows on the near flank: a lateral line and a smaller belly row
        const off = k === 0 ? 0.1 : -0.15;
        tmpP.set(px - sh * off * taper, py + ch * off * taper, z + 0.27 * taper);
        tmpS.setScalar((k === 0 ? 1 : 0.7) * (0.8 + pulse * 0.5) * (1.1 - t * 0.5));
        tmpM.compose(tmpP, tmpQ.identity(), tmpS);
        this.spots.setMatrixAt(i * 2 + k, tmpM);
        tmpC.setHex(spotHue).multiplyScalar(0.7 + pulse * 1.3 + glow * 1.3);
        this.spots.setColorAt(i * 2 + k, tmpC);
      }
    }
    // the body's light on the pool floor and the walls, out along its length
    const hx = this.chain.x[0], hy = this.chain.y[0];
    this.spillBody.set((midX + hx) / 2, (midY + hy) / 2, 5.6, 4, 0.3 + glow * 0.3, 0x7ad8ff, 1.2);
    this.body.count = SEGS; this.spots.count = SEGS * 2;
    this.body.instanceMatrix.needsUpdate = true;
    this.spots.instanceMatrix.needsUpdate = true;
    if (this.body.instanceColor) this.body.instanceColor.needsUpdate = true;
    if (this.spots.instanceColor) this.spots.instanceColor.needsUpdate = true;
  }
}
