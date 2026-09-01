import * as THREE from 'three';
import { Terrain } from './terrain';
import { T, cellHash } from './tiles';

// Dead pods of earlier drillers: half-sunk, tilted, beacon still blinking
// until salvaged. Few enough (≤14) to keep resident in the scene.

const HULL_DEAD = new THREE.MeshStandardMaterial({ color: 0x6a635a, roughness: 0.9, metalness: 0.2 });
const GLASS_DEAD = new THREE.MeshStandardMaterial({ color: 0x18202a, roughness: 0.4, metalness: 0.5 });

export class WreckField {
  private beacons: THREE.Mesh[] = [];
  private bodies: THREE.Group[] = [];

  constructor(scene: THREE.Scene, private terrain: Terrain, looted: Set<number>) {
    terrain.wrecks.forEach((w, i) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), HULL_DEAD);
      body.scale.set(1, 1.05, 0.9);
      const visor = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), GLASS_DEAD);
      visor.position.set(0, 0.08, 0.22);
      visor.scale.set(1, 0.8, 0.7);
      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xff4d29, toneMapped: false })
      );
      beacon.position.set(0.1, 0.5, 0.1);
      g.add(body, visor, beacon);
      const h = cellHash(w.x, w.y, 21);
      g.rotation.z = (h - 0.5) * 1.3;
      g.position.set(w.x + 0.5, -(w.y + 0.5) - 0.18, 0.05);
      scene.add(g);
      this.bodies.push(g);
      this.beacons.push(beacon);
      if (looted.has(i)) this.setLooted(i);
    });
  }

  setLooted(i: number): void {
    const b = this.beacons[i];
    if (b) b.visible = false;
  }

  update(t: number, dt: number): void {
    for (const b of this.beacons) {
      if (b.visible) (b.material as THREE.MeshBasicMaterial).color.setHex(
        Math.sin(t * 3.2 + b.position.x) > 0 ? 0xff4d29 : 0x551a10
      );
    }
    // settle: a wreck undermined by drilling falls to the next support
    this.terrain.wrecks.forEach((w, i) => {
      let ny = w.y;
      while (ny + 1 < this.terrain.h && this.terrain.get(w.x, ny + 1) === T.AIR) ny++;
      if (ny !== w.y) w.y = ny;
      const body = this.bodies[i];
      if (body) {
        const targetY = -(w.y + 0.5) - 0.18;
        body.position.y += (targetY - body.position.y) * Math.min(1, dt * 6);
      }
    });
  }
}
