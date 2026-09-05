import * as THREE from 'three';
import { Terrain } from '../terrain';
import { LightSpot, tmpM, tmpP, tmpQ, tmpS } from './types';

// Flares: light somewhere that is not you. Every creature that keys on light
// or heat reads these before it reads the pod.

const MAX_FLARES = 3;
const FLARE_LIFE = 26;

interface Flare extends LightSpot {
  vx: number; vy: number;
}

export class FlareField {
  readonly list: Flare[] = [];
  private mesh: THREE.InstancedMesh;
  private lights: THREE.PointLight[] = [];

  constructor(scene: THREE.Scene, private terrain: Terrain) {
    const geo = new THREE.IcosahedronGeometry(0.16, 0);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffb066, toneMapped: false });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX_FLARES);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
    for (let i = 0; i < MAX_FLARES; i++) {
      const l = new THREE.PointLight(0xffb066, 0, 14, 1.6);
      this.lights.push(l);
      scene.add(l);
      this.list.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0 });
    }
  }

  reset(): void {
    for (const f of this.list) f.alive = false;
    this.mesh.count = 0;
    for (const l of this.lights) l.intensity = 0;
  }

  throw(x: number, y: number, vx: number, vy: number): boolean {
    const f = this.list.find(f => !f.alive);
    if (!f) return false;
    f.alive = true;
    f.x = x; f.y = y;
    f.vx = vx; f.vy = vy;
    f.life = FLARE_LIFE;
    return true;
  }

  /** the brightest live flare, if any — creatures prefer it to the pod */
  brightest(): Flare | null {
    let best: Flare | null = null;
    for (const f of this.list) if (f.alive && (!best || f.life > best.life)) best = f;
    return best;
  }

  /** nearest live flare within range of a point */
  near(x: number, y: number, range: number): Flare | null {
    let best: Flare | null = null;
    let bd = range;
    for (const f of this.list) {
      if (!f.alive) continue;
      const d = Math.hypot(f.x - x, f.y - y);
      if (d < bd) { bd = d; best = f; }
    }
    return best;
  }

  /** the Riptide drags flares too — a lit thing tumbling into the dark */
  drift(f: Flare, dx: number, dy: number): void {
    f.vx += dx; f.vy += dy;
  }

  update(dt: number): void {
    let n = 0;
    for (let i = 0; i < this.list.length; i++) {
      const f = this.list[i];
      const light = this.lights[i];
      if (!f.alive) { light.intensity = 0; continue; }
      f.life -= dt;
      if (f.life <= 0) { f.alive = false; light.intensity = 0; continue; }
      f.vy -= 16 * dt;
      const nx = f.x + f.vx * dt;
      const ny = f.y + f.vy * dt;
      if (this.terrain.solidAt(Math.floor(nx), Math.floor(-f.y))) { f.vx = 0; } else { f.x = nx; }
      if (this.terrain.solidAt(Math.floor(f.x), Math.floor(-ny))) {
        f.vy = 0; f.vx *= 0.6;
      } else { f.y = ny; }

      const flicker = 0.85 + Math.sin(f.life * 24) * 0.15;
      const fade = Math.min(1, f.life / 3);
      light.position.set(f.x, f.y, 0.4);
      light.intensity = 22 * flicker * fade;
      tmpP.set(f.x, f.y, 0.3);
      tmpQ.identity();
      tmpS.setScalar(flicker);
      tmpM.compose(tmpP, tmpQ, tmpS);
      this.mesh.setMatrixAt(n, tmpM);
      n++;
    }
    this.mesh.count = n;
    if (n > 0) this.mesh.instanceMatrix.needsUpdate = true;
  }
}
