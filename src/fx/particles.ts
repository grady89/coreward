import * as THREE from 'three';

// Two pooled particle systems: matte dust (normal blending) and glow sparks
// (additive). Fixed-size buffers, zero allocation per frame.

interface SpawnOpts {
  count?: number;
  speed?: number;
  up?: number;        // upward bias
  gravity?: number;
  life?: number;
  spread?: number;
}

class Pool {
  points: THREE.Points;
  private pos: Float32Array;
  private col: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private grav: Float32Array;
  private cursor = 0;
  private geo: THREE.BufferGeometry;

  constructor(private cap: number, size: number, additive: boolean) {
    this.pos = new Float32Array(cap * 3);
    this.col = new Float32Array(cap * 3);
    this.vel = new Float32Array(cap * 3);
    this.life = new Float32Array(cap);
    this.maxLife = new Float32Array(cap);
    this.grav = new Float32Array(cap);
    this.pos.fill(9999);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.PointsMaterial({
      size, vertexColors: true, transparent: true, opacity: additive ? 0.9 : 0.85,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: false, toneMapped: false,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
  }

  spawn(x: number, y: number, color: number, o: SpawnOpts): void {
    const n = o.count ?? 8;
    const speed = o.speed ?? 3;
    const r = (color >> 16 & 255) / 255, g = (color >> 8 & 255) / 255, b = (color & 255) / 255;
    for (let k = 0; k < n; k++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.cap;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.35 + Math.random() * 0.65);
      const spread = o.spread ?? 0.3;
      this.pos[i * 3] = x + (Math.random() - 0.5) * spread;
      this.pos[i * 3 + 1] = y + (Math.random() - 0.5) * spread;
      this.pos[i * 3 + 2] = 0.55 + Math.random() * 0.2;
      this.vel[i * 3] = Math.cos(a) * s;
      this.vel[i * 3 + 1] = Math.sin(a) * s * 0.6 + (o.up ?? 1.5);
      this.vel[i * 3 + 2] = 0;
      const tint = 0.8 + Math.random() * 0.35;
      this.col[i * 3] = Math.min(1, r * tint);
      this.col[i * 3 + 1] = Math.min(1, g * tint);
      this.col[i * 3 + 2] = Math.min(1, b * tint);
      this.maxLife[i] = this.life[i] = (o.life ?? 0.7) * (0.6 + Math.random() * 0.6);
      this.grav[i] = o.gravity ?? 9;
    }
  }

  update(dt: number): void {
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.pos[i * 3] = 9999;
        continue;
      }
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      const f = this.life[i] / this.maxLife[i];
      if (f < 0.3) {
        const fade = f / 0.3;
        this.col[i * 3] *= 0.92 + fade * 0.08;
        this.col[i * 3 + 1] *= 0.92 + fade * 0.08;
        this.col[i * 3 + 2] *= 0.92 + fade * 0.08;
      }
    }
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }
}

export class Particles {
  private dust: Pool;
  private sparks: Pool;

  constructor(scene: THREE.Scene) {
    this.dust = new Pool(600, 0.16, false);
    this.sparks = new Pool(400, 0.13, true);
    scene.add(this.dust.points, this.sparks.points);
  }

  update(dt: number): void {
    this.dust.update(dt);
    this.sparks.update(dt);
  }

  drillSpray(x: number, y: number, color: number): void {
    this.dust.spawn(x, y, color, { count: 2, speed: 2.4, up: 2, life: 0.5, gravity: 11 });
  }

  blockBreak(x: number, y: number, color: number): void {
    this.dust.spawn(x, y, color, { count: 14, speed: 3.4, up: 2.2, life: 0.8, gravity: 10, spread: 0.6 });
  }

  oreBurst(x: number, y: number, color: number): void {
    this.sparks.spawn(x, y, color, { count: 18, speed: 3.2, up: 1.6, life: 0.9, gravity: 3, spread: 0.4 });
  }

  landingDust(x: number, y: number, strength: number): void {
    this.dust.spawn(x, y, 0x9a8468, { count: Math.min(20, Math.round(strength * 2)), speed: 2 + strength * 0.2, up: 0.8, life: 0.7, gravity: 6, spread: 0.8 });
  }

  thrusterPuff(x: number, y: number, color = 0x6ad8ff): void {
    this.sparks.spawn(x, y, color, { count: 1, speed: 0.8, up: -3.5, life: 0.35, gravity: -2, spread: 0.16 });
  }

  explosion(x: number, y: number): void {
    this.sparks.spawn(x, y, 0xff7a3c, { count: 40, speed: 6, up: 2, life: 1, gravity: 4, spread: 0.5 });
    this.dust.spawn(x, y, 0x554433, { count: 20, speed: 4.5, up: 2.5, life: 1.1, gravity: 8, spread: 0.7 });
  }

  lavaBubble(x: number, y: number): void {
    this.sparks.spawn(x, y, 0xff5a2a, { count: 2, speed: 1.4, up: 2.5, life: 0.6, gravity: 5, spread: 0.4 });
  }

  /** the fauna's own vocabulary: matte matter (frost, rock, shell, ash) */
  dustBurst(x: number, y: number, color: number, o: SpawnOpts): void {
    this.dust.spawn(x, y, color, o);
  }

  /** ...and glowing matter (bioluminescence, splinters of light) */
  sparkBurst(x: number, y: number, color: number, o: SpawnOpts): void {
    this.sparks.spawn(x, y, color, o);
  }
}
