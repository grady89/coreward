import * as THREE from 'three';
import { SPILL_TTL, SPILL_WARN } from '../config';
import { GEM_GEOS, gemClassOf, gemScaleOf } from './gemshapes';
import { def } from './tiles';

// The spill: what is left where a pod burst. The crew tows the hull and files
// a claim over the ore — a skip dropped beside the pile and a beacon on a
// five-minute battery, and nothing else. It is deliberately not a wreck:
// wrecks belong to dead drillers and pay out in logs, this pile is your own
// hold and pays out in exactly what you lost.
//
// Built to the reference sheets in reference-art/beacon, which settled three
// things: the glow is a PANEL, not a bulb — a bone-white housing whose whole
// front face lights; the ore sits visible IN an open-topped skip rather than
// scattered on the floor; and the light POOLS on the surrounding rock instead
// of firing a beam, because the pool is what you spot from up the shaft.
//
// Data (SpillClaim) rides in the save; SpillSite is only the thing you see.

export interface SpillClaim {
  world: string;
  x: number;                  // world coords, at the base of the pile
  y: number;
  ttl: number;                // seconds of beacon battery left
  cargo: [number, number][];  // tile type -> count, still on the floor
}

// rig paint: bone housing, dark hardware, dusty steel skip
const HOUSING = new THREE.MeshStandardMaterial({ color: 0xd6cfbe, roughness: 0.82, metalness: 0.12 });
const HARDWARE = new THREE.MeshStandardMaterial({ color: 0x353b43, roughness: 0.5, metalness: 0.45 });
const SKIP = new THREE.MeshStandardMaterial({ color: 0x9a8f7e, roughness: 0.84, metalness: 0.28 });
const RAIL = new THREE.MeshStandardMaterial({ color: 0xb7b0a2, roughness: 0.45, metalness: 0.5 });
// the hazard band is paint, not light — but it needs an emissive floor under
// it or it reads as a black stripe wherever the lamp is not pointing
const BAND = new THREE.MeshStandardMaterial({
  color: 0xff9a3c, roughness: 0.7, metalness: 0.1,
  emissive: 0xff9a3c, emissiveIntensity: 0.22,
});

const MAX_SHARDS = 9;
const HALO_R = 1.35;

/**
 * Additive disc, white in the middle and black at the rim: a pool of light.
 * Rings, not a fan — a CircleGeometry has only a centre vertex and a rim, so
 * every falloff curve interpolates back to a straight line across the
 * triangle and the glow ends up a hard-edged cone of light.
 */
function haloGeometry(): THREE.BufferGeometry {
  const g = new THREE.RingGeometry(0.001, HALO_R, 48, 10);
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getY(i)) / HALO_R;
    const f = Math.max(0, 1 - r) ** 3;
    col[i * 3] = f; col[i * 3 + 1] = f; col[i * 3 + 2] = f;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/** the pile, its beacon and its light — one per world, hidden when unclaimed */
export class SpillSite {
  private group = new THREE.Group();
  private lensMat!: THREE.MeshBasicMaterial;
  private haloMat!: THREE.MeshBasicMaterial;
  private light: THREE.PointLight;
  private shards: THREE.Mesh[] = [];
  private claim: SpillClaim | null = null;
  /** eased toward the resting height, so an undermined pile falls visibly */
  private restY = 0;

  constructor(scene: THREE.Scene) {
    this.group.add(this.buildSkip(), this.buildBeacon());

    // ore heaped in the bin, with the last two spilled over the lip
    for (let i = 0; i < MAX_SHARDS; i++) {
      const m = new THREE.Mesh(GEM_GEOS[0], new THREE.MeshStandardMaterial({
        color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.6,
        roughness: 0.22, metalness: 0.1, flatShading: true,
      }));
      m.visible = false;
      this.group.add(m);
      this.shards.push(m);
    }

    // a lamp this bright stains the rock for a few tiles in every direction —
    // that stain is what you actually spot from up the shaft, not the housing
    this.light = new THREE.PointLight(0xff9a3c, 0, 12, 1.5);
    this.light.position.set(-0.5, 0.8, 0.55);
    this.group.add(this.light);

    this.group.visible = false;
    scene.add(this.group);
  }

  /** an open-topped ore skip: low front wall, so the load is the silhouette */
  private buildSkip(): THREE.Group {
    const g = new THREE.Group();
    const floor = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.07, 0.62), SKIP);
    floor.position.set(0.14, 0.1, 0);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.32, 0.06), SKIP);
    back.position.set(0.14, 0.26, -0.28);
    const front = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.14, 0.06), SKIP);
    front.position.set(0.14, 0.17, 0.28);
    g.add(floor, back, front);
    for (const s of [-1, 1]) {
      const end = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.3, 0.62), SKIP);
      end.position.set(0.14 + s * 0.52, 0.25, 0);
      // heavy rim rail along the top edge — the part a winch hook grabs
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.06, 0.7), RAIL);
      rail.position.set(0.14 + s * 0.52, 0.42, 0);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.66), RAIL);
      foot.position.set(0.14 + s * 0.4, 0.045, 0);
      g.add(end, rail, foot);
    }
    // the brace web that says industrial, and the tilt that says dropped
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.05), RAIL);
    brace.position.set(0.14, 0.19, 0.31);
    brace.rotation.z = 0.16;
    g.add(brace);
    g.rotation.z = -0.04;
    return g;
  }

  /** the lamp: a bone housing whose whole front face is the emissive */
  private buildBeacon(): THREE.Group {
    const g = new THREE.Group();
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.46, 0.38), HOUSING);
    head.position.set(0, 0.74, 0);
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.4), BAND);
    band.position.set(0, 0.57, 0);
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.09, 0.3), HARDWARE);
    collar.position.set(0, 0.46, 0);
    g.add(head, band, collar);

    this.lensMat = new THREE.MeshBasicMaterial({ color: 0xff9a3c, toneMapped: false });
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.35, 0.03), this.lensMat);
    lens.position.set(0, 0.76, 0.2);
    g.add(lens);
    // the slotted hood over the lens is what makes it read as a lamp and not
    // a screen: three bars across the glow, and a brow above it
    for (let i = -1; i <= 1; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.028, 0.03), HARDWARE);
      bar.position.set(0, 0.76 + i * 0.11, 0.225);
      g.add(bar);
    }
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.1), HOUSING);
    brow.position.set(0, 0.97, 0.19);
    g.add(brow);

    // an A-frame reads as legs at gameplay zoom; a true splayed tripod just
    // merges into a dark wedge under the housing
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.52, 0.05), RAIL);
      leg.position.set(side * 0.15, 0.23, 0.06);
      leg.rotation.z = side * 0.42;
      g.add(leg);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.14), HARDWARE);
      foot.position.set(side * 0.27, 0.025, 0.06);
      g.add(foot);
    }
    const rear = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), RAIL);
    rear.position.set(0, 0.23, -0.12);
    rear.rotation.x = -0.3;
    g.add(rear);
    // two whip antennae: the silhouette that says transmitting
    for (const s of [-1, 1]) {
      const whip = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.36, 0.014), HARDWARE);
      whip.position.set(s * 0.14, 1.14, -0.06);
      whip.rotation.z = s * 0.13;
      g.add(whip);
    }

    this.haloMat = new THREE.MeshBasicMaterial({
      color: 0xff9a3c, toneMapped: false, transparent: true, opacity: 0.4,
      vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const halo = new THREE.Mesh(haloGeometry(), this.haloMat);
    halo.position.set(0, 0.76, 0.34);
    g.add(halo);

    g.position.set(-0.92, 0, 0.02);
    return g;
  }

  /** raise the beacon over a claim (call again to re-dress a changed pile) */
  show(c: SpillClaim): void {
    this.claim = c;
    this.group.visible = true;
    this.group.position.set(c.x, c.y, 0.05);
    this.restY = c.y;
    this.dressShards(c);
  }

  hide(): void {
    this.claim = null;
    this.group.visible = false;
    this.light.intensity = 0;
  }

  /** heap the bin with what is actually still on the floor, richest first */
  private dressShards(c: SpillClaim): void {
    const kinds = [...c.cargo]
      .filter(([, n]) => n > 0)
      .sort((a, b) => def(b[0]).value - def(a[0]).value);
    const total = kinds.reduce((n, k) => n + k[1], 0);
    const shown = Math.max(3, Math.min(MAX_SHARDS, total));
    this.shards.forEach((s, i) => {
      s.visible = kinds.length > 0 && i < shown;
      if (!s.visible) return;
      const [t] = kinds[i % kinds.length];
      s.geometry = GEM_GEOS[gemClassOf(t)];
      const mat = s.material as THREE.MeshStandardMaterial;
      mat.color.setHex(def(t).gem);
      mat.emissive.setHex(def(t).gem);
      // deterministic heap: the same spill looks the same on a reload. The
      // last two ride over the lip, because a full skip is a spilled one.
      const a = i * 2.399;
      if (i < shown - 2) {
        s.position.set(0.14 + Math.cos(a) * 0.38, 0.35 + (i % 3) * 0.07, Math.sin(a) * 0.16);
      } else {
        s.position.set(0.82 + (i % 2) * 0.26, 0.11, 0.1 + Math.sin(a) * 0.14);
      }
      s.rotation.set(a, a * 1.7, a * 0.6);
      s.scale.setScalar(gemScaleOf(t) * 0.46);
    });
  }

  /** the pile drops when the floor under it is drilled away */
  settle(solidAt: (x: number, y: number) => boolean, rows: number): void {
    if (!this.claim) return;
    const col = Math.floor(this.claim.x);
    let row = Math.floor(-this.claim.y);
    while (row + 1 < rows && !solidAt(col, row + 1)) row++;
    this.claim.y = -(row + 1) + 0.02;
  }

  update(time: number, dt: number): void {
    const c = this.claim;
    if (!c || !this.group.visible) return;
    this.restY += (c.y - this.restY) * Math.min(1, dt * 5);
    this.group.position.set(c.x, this.restY, 0.05);

    // the strobe quickens as the battery dies, and goes magma at the warning
    const urgency = 1 - Math.max(0, Math.min(1, c.ttl / SPILL_TTL));
    const failing = c.ttl <= SPILL_WARN;
    const on = Math.sin(time * (2.6 + urgency * 5)) > (failing ? -0.25 : 0.05);
    const hot = failing ? 0xff4d29 : 0xff9a3c;
    // never fully dark: a beacon you can lose track of between strobes is a
    // beacon that fails the one job it has
    this.lensMat.color.setHex(on ? hot : (failing ? 0x8a2c19 : 0x94531c));
    this.haloMat.color.setHex(hot);
    this.haloMat.opacity = on ? 0.55 : 0.22;
    this.light.color.setHex(hot);
    this.light.intensity = on ? 7 : 2.4;

    for (let i = 0; i < this.shards.length; i++) {
      const s = this.shards[i];
      if (s.visible) s.rotation.y += dt * (0.4 + i * 0.06);
    }
  }
}
