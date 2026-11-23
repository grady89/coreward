import * as THREE from 'three';
import { Terrain } from '../terrain';
import { rockColor } from '../tiles';
import { Particles } from '../../fx/particles';
import { hdrBasic } from '../../fx/post';
import {
  Creature, ThreatCtx, ThreatLevel, Chain, wide, lerp, clamp01,
  tmpM, tmpP, tmpQ, tmpS, tmpE, tmpC, tmpC2, rimLight, Spill,
} from './types';

// THE LONG ONES — VEIL-3's hunter tier. They hunt by VIBRATION.
//
// You hear it first: the rumble ticks, the dust jumping off the tunnel walls
// in a line that is coming toward you. Then a wall bursts and the head comes
// through — eyeless, a split mandible, a body of overlapping chitin plates
// with a line of dorsal lights that pulse from the tail toward the head, so
// the direction of the wave tells you which way it is moving. It fills a
// passage. It cannot follow you into a 1-wide shaft.
//
// It cannot see. It feels you: engine, drill, hull scraping rock. Cut the
// engine, stop the drill, sit still — and it loses you. It will cast about,
// close enough to touch, and then go back into the rock.

const SEGS = 14;
const SPACING = 0.5;
const BAND = 300;
const SPEED = 4.8;
const HUNT = 17;
const DAMAGE = 26;
const STILL_TO_LOSE = 1.6;
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

type Phase = 'emerging' | 'hunting' | 'searching' | 'burrowing';

export class LongOne implements Creature {
  alive = false;
  rumble = 0;
  timer = 12;
  phase: Phase = 'hunting';
  x = 0; y = 0;
  private dirX = 1; private dirY = 0;
  private life = 0;
  private stuck = 0;
  private stunT = 0;
  private lostT = 0;
  private phaseT = 0;
  private gape = 0;
  private biteT = 0;
  private spawnX = 0; private spawnY = 0;   // rock it came out of / goes into
  private outX = 0; private outY = 0;
  private wander = 0;
  private dustAcc = 0;
  private chain = new Chain(SEGS, SPACING);

  private body: THREE.InstancedMesh;
  private sinew: THREE.InstancedMesh;
  private lights: THREE.InstancedMesh;
  /** the fissure's white-hot core line, inside the amber */
  private lightCore: THREE.InstancedMesh;
  private head: THREE.Group;
  private jawL: THREE.Mesh;
  private jawR: THREE.Mesh;
  private throat: THREE.Mesh;
  private gullet: THREE.Mesh;
  private throatLight: THREE.PointLight;
  /** the furnace in the maw, haloed so it reads at play size */
  private gulletHalo: Spill;
  /** the fissure line's light on the tunnel it fills, and the maw's */
  private bodySpill: Spill;
  private headSpill: Spill;

  constructor(scene: THREE.Scene, private terrain: Terrain, private particles: Particles) {
    // a chunky plate, axis along +X so it lies along the spine: one on every
    // other link, so seven big plates read at play size instead of thirteen
    // small ones. A hex wedge, flared toward the head like a scale, turned so
    // a flat face meets the camera
    const segGeo = new THREE.CylinderGeometry(0.52, 0.3, 0.88, 6, 1);
    segGeo.rotateY(Math.PI / 6);
    segGeo.rotateZ(-Math.PI / 2);
    const segMat = new THREE.MeshStandardMaterial({
      flatShading: true, roughness: 0.55, metalness: 0.2,
      emissive: 0x2e0e06, emissiveIntensity: 1,
    });
    // the fissure's heat caught on every plate edge: out of the wall it reads
    // as a body, not a hole in the dark
    rimLight(segMat, 0xff8a40, 1.6);
    // ...graded by the plate's own colour, so the rim cools toward the tail
    // with the plates and the head keeps the brightest edges
    const rimBase = segMat.onBeforeCompile;
    segMat.onBeforeCompile = (sh, r) => {
      rimBase.call(segMat, sh, r);
      sh.fragmentShader = sh.fragmentShader.replace('totalEmissiveRadiance += uRim *', 'totalEmissiveRadiance += vColor.r * 5.5 * uRim *');
    };
    segMat.customProgramCacheKey = () => 'longone-plate';
    this.body = new THREE.InstancedMesh(segGeo, segMat, SEGS);
    this.body.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.body.frustumCulled = false;
    this.body.count = 0;
    this.body.setColorAt(0, tmpC.setHex(0xffffff));
    scene.add(this.body);
    // the sinew between plates: narrower, dark, unrimmed, so each plate
    // stands apart across a dark gap and the curve still reads as one body
    const sinewGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.5, 6, 1);
    sinewGeo.rotateZ(-Math.PI / 2);
    this.sinew = new THREE.InstancedMesh(sinewGeo, new THREE.MeshStandardMaterial({
      color: 0x34180f, flatShading: true, roughness: 0.8, emissive: 0x160503,
    }), SEGS);
    this.sinew.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.sinew.frustumCulled = false;
    this.sinew.count = 0;
    scene.add(this.sinew);

    // the dorsal fissure: one molten sliver per plate, end to end along the
    // spine, pulsing tail-to-head — VEIL's glowing crack, alive
    const fisGeo = new THREE.OctahedronGeometry(0.1, 0);
    fisGeo.scale(3.9, 0.85, 1.1);
    const fisMat = new THREE.MeshBasicMaterial({ toneMapped: false });
    hdrBasic(fisMat, 2.3);
    this.lights = new THREE.InstancedMesh(fisGeo, fisMat, SEGS);
    this.lights.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.lights.frustumCulled = false;
    this.lights.count = 0;
    this.lights.setColorAt(0, tmpC.setHex(0xffffff));
    scene.add(this.lights);
    // a thinner, hotter line down the middle of each sliver: the amber stays
    // the hue, the core is what blooms
    const fisCoreGeo = new THREE.OctahedronGeometry(0.1, 0);
    fisCoreGeo.scale(3.3, 0.32, 0.6);
    fisCoreGeo.translate(0, 0, 0.06);
    const fisCoreMat = new THREE.MeshBasicMaterial({ toneMapped: false });
    hdrBasic(fisCoreMat, 2.5);
    this.lightCore = new THREE.InstancedMesh(fisCoreGeo, fisCoreMat, SEGS);
    this.lightCore.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.lightCore.frustumCulled = false;
    this.lightCore.count = 0;
    this.lightCore.setColorAt(0, tmpC.setHex(0xffffff));
    scene.add(this.lightCore);

    // the head: a blunt wedge, no eyes, a split jaw that opens as it closes on you
    this.head = new THREE.Group();
    const skullMat = new THREE.MeshStandardMaterial({
      color: 0x8a4430, flatShading: true, roughness: 0.5, metalness: 0.2, emissive: 0x2e0e06,
    });
    rimLight(skullMat, 0xff8a40, 1.6);
    const skull = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.05, 7), skullMat);
    skull.rotation.z = -Math.PI / 2;
    skull.position.x = 0.2;
    const jawGeo = new THREE.ConeGeometry(0.16, 0.9, 4);
    jawGeo.translate(0, 0.45, 0);
    jawGeo.rotateZ(-Math.PI / 2);
    // chitin mandibles, the maw's heat on their edges
    const jawMat = new THREE.MeshStandardMaterial({
      color: 0x7a4632, flatShading: true, roughness: 0.45, metalness: 0.2, emissive: 0x1e0804,
    });
    rimLight(jawMat, 0xffa050, 1.7);
    this.jawL = new THREE.Mesh(jawGeo, jawMat);
    this.jawR = new THREE.Mesh(jawGeo, jawMat);
    this.jawL.position.set(0.55, 0.16, 0);
    this.jawR.position.set(0.55, -0.16, 0);
    // white-hot fang tips hooked inward, and a tooth halfway down each jaw:
    // the tips are the hottest value on the creature — hotter than the maw —
    // so the end that hurts is the brightest thing on it
    const fangMat = new THREE.MeshBasicMaterial({ color: 0xfff6e6, toneMapped: false });
    hdrBasic(fangMat, 3.4);
    const toothMat = new THREE.MeshBasicMaterial({ color: 0xffe2a8, toneMapped: false });
    hdrBasic(toothMat, 2.0);
    const fangGeo = new THREE.ConeGeometry(0.07, 0.3, 4);
    fangGeo.rotateZ(-Math.PI / 2);
    for (const [jaw, s] of [[this.jawL, -1], [this.jawR, 1]] as const) {
      const tip = new THREE.Mesh(fangGeo, fangMat);
      tip.position.set(0.86, s * 0.03, 0);
      tip.rotation.z = s * 0.55;
      const tooth = new THREE.Mesh(fangGeo, toothMat);
      tooth.position.set(0.42, s * 0.07, 0);
      tooth.rotation.z = s * 1.2;
      tooth.scale.setScalar(0.7);
      jaw.add(tip, tooth);
    }
    this.throat = new THREE.Mesh(
      new THREE.CircleGeometry(0.26, 8),
      new THREE.MeshBasicMaterial({ color: 0xff6a2a, toneMapped: false, side: THREE.DoubleSide }),
    );
    this.throat.position.set(0.62, 0, 0);
    this.throat.rotation.y = Math.PI / 2;
    // the gullet seen from the side: a furnace between the jaw roots that
    // swells as the mouth opens
    // swells as the mouth opens. Set proud of the jaw roots, toward the
    // camera, so the skull never hides it. Held below clipping: a deep
    // orange furnace with an amber core, so it glows without blowing out
    // the jaw and the fangs keep the hottest value
    const gulletMat = new THREE.MeshBasicMaterial({ color: 0xff7a24, toneMapped: false });
    hdrBasic(gulletMat, 1.5);
    this.gullet = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 0), gulletMat);
    this.gullet.position.set(0.6, 0, 0.2);
    const gulletCore = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0),
      new THREE.MeshBasicMaterial({ color: 0xffb45a, toneMapped: false }));
    hdrBasic(gulletCore.material as THREE.MeshBasicMaterial, 1.5);
    gulletCore.position.set(0.06, 0, 0.12);
    this.gullet.add(gulletCore);
    this.throatLight = new THREE.PointLight(0xff6a2a, 0, 5, 1.8);
    this.throatLight.position.set(0.7, 0, 0.6);
    this.head.add(skull, this.jawL, this.jawR, this.throat, this.gullet, this.throatLight);
    this.head.visible = false;
    scene.add(this.head);
    this.gulletHalo = new Spill(this.head, 0xffa040);
    this.bodySpill = new Spill(scene, 0xff6a2a);
    this.headSpill = new Spill(scene, 0xffa050);
  }

  reset(): void {
    this.alive = false;
    this.body.count = 0;
    this.sinew.count = 0;
    this.lights.count = 0;
    this.lightCore.count = 0;
    this.head.visible = false;
    this.bodySpill.off(); this.headSpill.off();
    this.rumble = 0;
  }

  private die(): void {
    this.alive = false;
    this.body.count = 0;
    this.sinew.count = 0;
    this.lights.count = 0;
    this.lightCore.count = 0;
    this.head.visible = false;
    this.bodySpill.off(); this.headSpill.off();
  }

  private trySpawn(podX: number, podY: number): boolean {
    for (let attempt = 0; attempt < 40; attempt++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 13 + Math.random() * 8;
      const x = Math.round(podX + Math.cos(ang) * dist);
      const y = Math.round(-podY + Math.sin(ang) * dist);
      if (y < BAND || x < 2 || x >= this.terrain.w - 2) continue;
      if (!wide(this.terrain, x, y)) continue;
      // a wall next to the pocket for it to come out of
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (let k = 0; k < 4; k++) {
        const [dx, dy] = dirs[(attempt + k) % 4];
        if (!this.terrain.solidAt(x + dx, y + dy) || !this.terrain.solidAt(x + dx * 2, y + dy * 2)) continue;
        this.alive = true;
        this.phase = 'emerging'; this.phaseT = 0;
        this.outX = x + 0.5; this.outY = -(y + 0.5);
        this.spawnX = x + dx * 2 + 0.5; this.spawnY = -(y + dy * 2 + 0.5);
        this.x = this.spawnX; this.y = this.spawnY;
        this.dirX = -dx; this.dirY = dy;
        this.chain.lay(this.x, this.y, -dx, dy);
        this.life = 0; this.stuck = 0; this.stunT = 0; this.lostT = 0;
        this.gape = 0; this.biteT = 0; this.wander = Math.random() * 6;
        this.head.visible = true;
        return true;
      }
    }
    return false;
  }

  drillHit(x: number, y: number, dt: number): void {
    if (this.alive && Math.hypot(this.x - x, this.y - y) < 1.1) this.stuck += dt * 2.5;
  }

  blast(x: number, y: number, radius: number): void {
    if (!this.alive) return;
    for (let i = 0; i < SEGS; i++) {
      if (Math.hypot(this.chain.x[i] - x, this.chain.y[i] - y) < radius + 1) {
        for (let k = 0; k < SEGS; k += 2) {
          this.particles.dustBurst(this.chain.x[k], this.chain.y[k], 0x4a2a22, { count: 6, speed: 4, up: 2, life: 1, gravity: 8, spread: 0.5 });
        }
        this.die();
        this.rumble = 0;
        return;
      }
    }
  }

  lance(x: number, y: number, dir: number, range: number): void {
    if (!this.alive) return;
    const dx = (this.x - x) * dir;
    if (dx > -0.5 && dx < range && Math.abs(this.y - y) < 1.3) this.stunT = 3;
  }

  /** steer toward a point through passages wide enough for its bulk */
  private candBuf: [number, number][] = [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]];
  private steer(tx: number, ty: number, speed: number, dt: number): boolean {
    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const wx = dx / d, wy = dy / d;
    const step = speed * dt;
    // filled in place: this runs every frame a hunter is alive
    const cand = this.candBuf;
    cand[0][0] = wx; cand[0][1] = wy;
    cand[1][0] = Math.sign(wx); cand[1][1] = 0;
    cand[2][0] = 0; cand[2][1] = Math.sign(wy);
    cand[3][0] = this.dirX; cand[3][1] = this.dirY;
    cand[4][0] = -Math.sign(wy) || 1; cand[4][1] = 0;
    cand[5][0] = 0; cand[5][1] = -Math.sign(wx) || 1;
    for (const [cx, cy] of cand) {
      if (cx === 0 && cy === 0) continue;
      const len = Math.hypot(cx, cy) || 1;
      const nx = this.x + (cx / len) * step;
      const ny = this.y + (cy / len) * step;
      if (wide(this.terrain, Math.floor(nx), Math.floor(-ny))) {
        this.x = nx; this.y = ny;
        // turn the heading smoothly so the body carves arcs, not corners
        this.dirX = lerp(this.dirX, cx / len, Math.min(1, dt * 6));
        this.dirY = lerp(this.dirY, cy / len, Math.min(1, dt * 6));
        return true;
      }
    }
    return false;
  }

  devStage(x: number, y: number): void {
    // it needs a wall to come out of, so let trySpawn pick its own ground:
    // watching it choose a wall and burst through is the thing being tested
    if (!this.alive) this.trySpawn(x, y);
  }

  update(ctx: ThreatCtx, level: ThreatLevel): void {
    const { dt, podX, podY, time } = ctx;
    if (!this.alive) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = 16 + Math.random() * 20;
        if (Math.floor(-podY) >= BAND && Math.random() < (level === 'reduced' ? 0.3 : 0.65)) {
          if (this.trySpawn(podX, podY)) ctx.onEvent('longone-emerge', this.outX, this.outY);
        }
      }
      if (!this.alive) {
        this.rumble += (0 - this.rumble) * Math.min(1, dt * 2);
        return;
      }
    }

    this.life += dt;
    // a lanced worm's phase clock stops with it — otherwise a stun during
    // 'emerging' skips the lerp and the head teleports out of the wall
    if (this.stunT <= 0) this.phaseT += dt;
    const dx = podX - this.x, dy = podY - this.y;
    const dist = Math.hypot(dx, dy);
    const speedMul = level === 'reduced' ? 0.75 : 1;
    let moving = 0;

    if (this.stunT > 0) {
      // lanced: it recoils in place, all light and no appetite
      this.stunT -= dt;
      this.rumble += (0.3 - this.rumble) * Math.min(1, dt * 2);
    } else if (this.phase === 'emerging') {
      // the wall gives way — the head drives out of the rock into the pocket
      const f = clamp01(this.phaseT / 1.4);
      this.x = lerp(this.spawnX, this.outX, f);
      this.y = lerp(this.spawnY, this.outY, f);
      this.dustAcc += dt;
      if (this.dustAcc > 0.12) {
        this.dustAcc = 0;
        const wallX = Math.floor(this.outX + (this.spawnX - this.outX) * 0.5);
        const wallY = Math.floor(-(this.outY + (this.spawnY - this.outY) * 0.5));
        // the wall's own grit, scorched dark by the body coming through it,
        // and embers off the fissure line
        tmpC.setHex(rockColor(this.terrain.get(wallX, wallY), wallX, wallY)).lerp(tmpC2.setHex(0x2a120a), 0.6);
        this.particles.dustBurst(this.outX, this.outY, tmpC.getHex(),
          { count: 4, speed: 3.5, up: 1.5, life: 0.9, gravity: 9, spread: 0.8 });
        this.particles.sparkBurst(this.outX, this.outY, 0xff8a3c, { count: 3, speed: 3, up: 1.5, life: 0.7, gravity: 5, spread: 0.8 });
      }
      ctx.shake(0.08);
      this.rumble += (1 - this.rumble) * Math.min(1, dt * 4);
      moving = 1;
      if (f >= 1) { this.phase = 'hunting'; this.phaseT = 0; }
    } else if (this.phase === 'burrowing') {
      const f = clamp01(this.phaseT / 1.3);
      this.x = lerp(this.outX, this.spawnX, f);
      this.y = lerp(this.outY, this.spawnY, f);
      this.dustAcc += dt;
      if (this.dustAcc > 0.15) {
        this.dustAcc = 0;
        this.particles.dustBurst(this.outX, this.outY, 0x2e160e, { count: 3, speed: 2.5, up: 1.2, life: 0.8, gravity: 9, spread: 0.7 });
        this.particles.sparkBurst(this.outX, this.outY, 0xff8a3c, { count: 2, speed: 2, up: 1.2, life: 0.6, gravity: 5, spread: 0.7 });
      }
      this.rumble += (0.6 - this.rumble) * Math.min(1, dt * 2);
      moving = 1;
      if (f >= 1) { this.die(); return; }
    } else {
      // it hears engine, drill and hull. A still pod is a stone — even one
      // close enough to touch. Distance never overrides stillness: that is
      // the whole counter, and it has to hold at point-blank or it is a lie.
      const heard = ctx.still < STILL_TO_LOSE && dist < HUNT;
      if (this.phase === 'hunting') {
        if (!heard) this.lostT += dt; else this.lostT = 0;
        if (this.lostT > 0.5) {
          this.phase = 'searching'; this.phaseT = 0;
          ctx.onEvent('longone-lost', this.x, this.y);
        }
      } else if (heard) {
        this.phase = 'hunting'; this.phaseT = 0; this.lostT = 0;
      }

      if (dist > 44 || this.life > 90 || this.stuck > 6 || (this.phase === 'searching' && this.phaseT > 6)) {
        // it leaves the way it came: into the nearest rock
        this.phase = 'burrowing'; this.phaseT = 0;
        this.outX = this.x; this.outY = this.y;
        let bx = this.x, by = this.y;
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const [ddx, ddy] of dirs) {
          if (this.terrain.solidAt(Math.floor(this.x) + ddx, Math.floor(-this.y) - ddy)) {
            bx = this.x + ddx * 2.5; by = this.y + ddy * 2.5; break;
          }
        }
        this.spawnX = bx; this.spawnY = by;
        return;
      }

      let tx: number, ty: number, sp: number;
      if (this.phase === 'hunting') {
        tx = podX; ty = podY;
        sp = SPEED * speedMul * (dist < HUNT ? 1 : 0.55);
      } else {
        // casting about: a slow figure-eight around where it last felt you
        this.wander += dt * 0.9;
        tx = this.x + Math.cos(this.wander) * 3 + Math.cos(this.wander * 0.5) * 2;
        ty = this.y + Math.sin(this.wander * 2) * 1.5;
        sp = SPEED * speedMul * 0.4;
      }
      const moved = this.steer(tx, ty, sp, dt);
      this.stuck = moved ? 0 : this.stuck + dt;
      moving = moved ? sp / SPEED : 0;

      // the jaw opens as it closes; the bite lands on a beat
      const wantGape = this.phase === 'hunting' && dist < 3.2 ? 1 : 0;
      this.gape = lerp(this.gape, wantGape, Math.min(1, dt * 7));
      if (dist < 1.0 && this.phase === 'hunting') {
        ctx.hurt(DAMAGE * (level === 'reduced' ? 0.5 : 1) * dt, 'a Long One');
        this.biteT -= dt;
        if (this.biteT <= 0) {
          this.biteT = 0.55;
          this.gape = 0;
          ctx.shake(0.3);
          ctx.push(this.dirX * 2.5, this.dirY * 2.5);
          ctx.onEvent('longone-bite', this.x, this.y);
        }
      }
      const target = this.phase === 'hunting' ? Math.max(0.15, 1 - dist / 22) : 0.12;
      this.rumble += (target - this.rumble) * Math.min(1, dt * 3);
    }

    // embers shaken off the fissure line as it moves
    if (moving > 0.3 && this.phase !== 'emerging' && this.phase !== 'burrowing' && Math.random() < dt * 5) {
      const k = 2 + Math.floor(Math.random() * 6);
      this.particles.sparkBurst(this.chain.x[k], this.chain.y[k], 0xff8a3c, { count: 2, speed: 1.2, up: 0.6, life: 0.6, gravity: 4, spread: 0.6 });
    }

    // ---- body ----
    this.chain.follow(this.x, this.y, this.stunT > 0 ? 0.6 : 1);
    const thrash = this.stunT > 0 ? 0.45 : 0;
    const amp = 0.16 * moving + thrash;
    const hunting = this.phase === 'hunting' || this.phase === 'emerging';
    for (let i = 0; i < SEGS; i++) {
      const h = this.chain.heading(i);
      const wave = Math.sin(time * (7 + thrash * 6) - i * 0.75) * amp * (0.3 + i / SEGS);
      const px = this.chain.x[i] - Math.sin(h) * wave;
      const py = this.chain.y[i] + Math.cos(h) * wave;
      if (i === 0) {
        this.head.position.set(px, py, 0.1);
        this.head.rotation.set(Math.sin(time * 2.2) * 0.25, 0, h);
        const g = this.gape;
        this.jawL.rotation.z = g * 0.75;
        this.jawR.rotation.z = -g * 0.75;
        this.throat.scale.setScalar(0.4 + g * 0.8);
        const heat = 0.85 + Math.sin(time * 6) * 0.08;
        this.gullet.scale.set(1.35 + g * 0.5, (0.75 + g * 0.9) * heat, 0.9);
        this.throatLight.intensity = 1.8 + g * 3 + (this.stunT > 0 ? 2 : 0);
        this.gulletHalo.set(0.6, 0, 1.25 + g * 0.5, 1.0 + g * 0.5, (0.22 + g * 0.18) * heat, 0xff7a2a, 1.15);
        // instance 0 belongs to the head group — collapse it
        tmpM.makeScale(0, 0, 0);
        this.body.setMatrixAt(0, tmpM);
        this.sinew.setMatrixAt(0, tmpM);
        this.lights.setMatrixAt(0, tmpM);
        this.lightCore.setMatrixAt(0, tmpM);
        continue;
      }
      // plates bulge behind the head then taper to the tail
      const t = i / SEGS;
      const taper = (i < 4 ? 1.05 : 1.08 - t * 0.62);
      const plate = i % 2 === 1;
      tmpP.set(px, py, 0.1);
      // a fixed spine with only a slow rock, so every plate shows the same
      // face and the body reads as one curve, not a scatter of facets
      tmpE.set(Math.sin(time * 1.6 + i * 0.5) * 0.08, 0, h);
      tmpQ.setFromEuler(tmpE);
      tmpS.set(1, taper, taper);
      tmpM.compose(tmpP, tmpQ, tmpS);
      // plates on odd links, sinew on even: each instance collapses in the other
      this.body.setMatrixAt(i, plate ? tmpM : ZERO);
      this.sinew.setMatrixAt(i, plate ? ZERO : tmpM);
      // darker toward the tail
      tmpC.setHex(0x763a2a).multiplyScalar(1 - t * 0.6);
      this.body.setColorAt(i, tmpC);
      if (!plate) {
        this.lights.setMatrixAt(i, ZERO);
        this.lightCore.setMatrixAt(i, ZERO);
        continue;
      }

      // the dorsal wave runs tail → head while it hunts; banked low when lost.
      // The line cools toward the tail: the head is the brightest thing on it
      const pulse = (hunting ? Math.pow(Math.max(0, Math.sin(time * 5 + i * 0.9)), 3) : 0.12) * (1 - t * 0.6);
      const stun = this.stunT > 0 ? 1 : 0;
      const cool = 1 - t * 0.72;
      // along the upper flank, on the face toward the camera
      const off = 0.3 * taper;
      tmpP.set(px - Math.sin(h) * off, py + Math.cos(h) * off, 0.1 + 0.3 * taper);
      tmpE.set(0, 0, h);
      tmpQ.setFromEuler(tmpE);
      tmpS.set(taper, 0.85 + pulse * 0.7 + stun * 0.6, 1);
      tmpM.compose(tmpP, tmpQ, tmpS);
      this.lights.setMatrixAt(i, tmpM);
      this.lightCore.setMatrixAt(i, tmpM);
      tmpC.setHex(stun ? 0xffffff : 0xff8a3c).multiplyScalar((0.75 + pulse * 1.2 + stun) * cool);
      this.lights.setColorAt(i, tmpC);
      tmpC.setHex(stun ? 0xffffff : 0xffd890).multiplyScalar((0.55 + pulse * 0.7 + stun) * cool * cool);
      this.lightCore.setColorAt(i, tmpC);
    }
    this.body.count = SEGS; this.sinew.count = SEGS; this.lights.count = SEGS; this.lightCore.count = SEGS;
    // its own light on the rock: the fissure line along the body, the maw at the head
    const mid = SEGS >> 1;
    const stunGlow = this.stunT > 0 ? 0.3 : 0;
    this.bodySpill.set(this.chain.x[mid], this.chain.y[mid], 8.5, 6, (hunting ? 0.68 : 0.45) + stunGlow, 0xff6a2a, 1.3);
    // the maw's pool, set back on the neck: it washes the rock round the head
    // without stacking more light on the head itself
    const hb = this.chain.heading(0);
    this.headSpill.set(this.head.position.x - Math.cos(hb) * 0.9, this.head.position.y - Math.sin(hb) * 0.9, 5.5, 5, 0.42 + this.gape * 0.35 + stunGlow, 0xff8a40, 1.35);
    this.body.instanceMatrix.needsUpdate = true;
    this.sinew.instanceMatrix.needsUpdate = true;
    this.lights.instanceMatrix.needsUpdate = true;
    if (this.body.instanceColor) this.body.instanceColor.needsUpdate = true;
    if (this.lights.instanceColor) this.lights.instanceColor.needsUpdate = true;
    this.lightCore.instanceMatrix.needsUpdate = true;
    if (this.lightCore.instanceColor) this.lightCore.instanceColor.needsUpdate = true;
  }
}
