import * as THREE from 'three';
import { RigFinish, FlameStyle, LampTint } from '../game/cosmetics';

// The mining pod: hero object built from primitives, two-tone dusty cream +
// amber accents, teal visor, animated drill and thruster flames, headlamp.
// Finishes (the paint locker) recolor a pod's own cloned materials, so a
// review scene with two pods can wear two coats.

export type DrillDir = 'down' | 'left' | 'right' | 'up';

const HULL = new THREE.MeshStandardMaterial({ color: 0xd8c9a4, roughness: 0.55, metalness: 0.25 });
const ACCENT = new THREE.MeshStandardMaterial({ color: 0xff9a3c, roughness: 0.5, metalness: 0.3 });
const STEEL = new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.4, metalness: 0.8 });
const GLASS = new THREE.MeshStandardMaterial({ color: 0x1d4a52, roughness: 0.1, metalness: 0.6, emissive: 0x0d3a40, emissiveIntensity: 0.5 });

/** dazzle patches in the finish's three tones, blobbed like strata contours */
function camoTexture(tones: [string, string, string]): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = tones[0];
  g.fillRect(0, 0, 128, 128);
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (const tone of [tones[1], tones[2], tones[1]]) {
    g.fillStyle = tone;
    for (let i = 0; i < 9; i++) {
      g.beginPath();
      g.ellipse(rnd() * 128, rnd() * 128, 10 + rnd() * 22, 7 + rnd() * 14, rnd() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export class Pod {
  group = new THREE.Group();
  private drillPivot = new THREE.Group();
  private drillBit: THREE.Mesh;
  private flameL: THREE.Mesh;
  private flameR: THREE.Mesh;
  private headlamp: THREE.SpotLight;
  private glow: THREE.PointLight;
  private drillSpin = 0;
  // per-pod clones so a finish never bleeds onto another pod in a review scene
  private hullMat = HULL.clone();
  private accentMat = ACCENT.clone();
  private steelMat = STEEL.clone();
  private camoTex: THREE.CanvasTexture | null = null;

  constructor(scene: THREE.Scene) {
    const HULL = this.hullMat, ACCENT = this.accentMat, STEEL = this.steelMat;
    // body
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 18), HULL);
    body.scale.set(1, 1.06, 0.92);
    this.group.add(body);

    // belly plate
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.43, 24, 12, 0, Math.PI * 2, Math.PI * 0.62, Math.PI * 0.38), ACCENT);
    belly.scale.set(1, 1.06, 0.92);
    this.group.add(belly);

    // visor
    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 14), GLASS);
    visor.position.set(0, 0.1, 0.24);
    visor.scale.set(1, 0.82, 0.7);
    this.group.add(visor);

    // side intakes
    for (const s of [-1, 1]) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.26), STEEL);
      fin.position.set(s * 0.42, 0.05, 0);
      fin.rotation.z = s * -0.2;
      this.group.add(fin);
    }

    // thruster nozzles + flames
    for (const s of [-1, 1]) {
      const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.18, 12), STEEL);
      noz.position.set(s * 0.24, -0.42, 0);
      this.group.add(noz);
    }
    const flameGeo = new THREE.ConeGeometry(0.1, 0.5, 10);
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0x6ad8ff, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    });
    this.flameL = new THREE.Mesh(flameGeo, flameMat);
    this.flameR = new THREE.Mesh(flameGeo, flameMat.clone());
    (this.flameR.material as THREE.MeshBasicMaterial).color.setHex(0x9adfff);
    this.flameL.rotation.x = Math.PI;
    this.flameR.rotation.x = Math.PI;
    this.flameL.position.set(-0.24, -0.68, 0);
    this.flameR.position.set(0.24, -0.68, 0);
    this.group.add(this.flameL, this.flameR);

    // drill on a pivot so it can aim down / sideways
    this.drillBit = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.52, 14), STEEL);
    this.drillBit.rotation.x = Math.PI; // point down
    this.drillBit.position.y = -0.62;
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.16, 12), ACCENT);
    collar.position.y = -0.4;
    this.drillPivot.add(collar, this.drillBit);
    this.group.add(this.drillPivot);

    // lights
    this.headlamp = new THREE.SpotLight(0xffe6c0, 0, 22, 0.82, 0.5, 1.1);
    this.headlamp.position.set(0, 0.3, 0.3);
    const target = new THREE.Object3D();
    target.position.set(0, -5, 0.5);
    this.group.add(target);
    this.headlamp.target = target;
    this.glow = new THREE.PointLight(0xffd9a0, 0, 10, 1.5);
    this.glow.position.set(0, 0, 0.6);
    this.group.add(this.headlamp, this.glow);

    // landing skids at the collision base
    for (const s of [-1, 1]) {
      const skid = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.07, 0.34), STEEL);
      skid.position.set(s * 0.3, -0.5, 0);
      this.group.add(skid);
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 6), STEEL);
      strut.position.set(s * 0.3, -0.42, 0);
      strut.rotation.z = s * 0.35;
      this.group.add(strut);
    }

    // lift the whole visual assembly so the hull sits ON the ground plane
    // (collision half-height is 0.41; the sphere + drill extend past it)
    const lift = new THREE.Group();
    lift.position.y = 0.13;
    for (const c of [...this.group.children]) lift.add(c);
    this.group.add(lift);

    scene.add(this.group);
  }

  setPos(x: number, y: number): void {
    this.group.position.set(x, y, 0);
  }

  /** wear a coat from the paint locker — cosmetic only, applied live */
  applyFinish(rig: RigFinish, flame: FlameStyle, lamp: LampTint): void {
    this.camoTex?.dispose();
    this.camoTex = rig.camo ? camoTexture(rig.camo) : null;
    this.hullMat.map = this.camoTex;
    this.hullMat.color.setHex(rig.camo ? 0xffffff : rig.hull);
    this.hullMat.needsUpdate = true;
    this.accentMat.color.setHex(rig.accent);
    this.steelMat.color.setHex(rig.steel);
    (this.flameL.material as THREE.MeshBasicMaterial).color.setHex(flame.inner);
    (this.flameR.material as THREE.MeshBasicMaterial).color.setHex(flame.outer);
    this.headlamp.color.setHex(lamp.color);
  }

  update(dt: number, opts: {
    vx: number; thrust: number; sideThrust: number;
    drilling: boolean; drillDir: DrillDir; depthRow: number; time: number;
    lampOn?: boolean;
  }): void {
    const { vx, thrust, sideThrust, drilling, drillDir, depthRow, time } = opts;
    const lampOn = opts.lampOn !== false;

    // lean into horizontal motion
    this.group.rotation.z += ((-vx * 0.045) - this.group.rotation.z) * Math.min(1, dt * 8);

    // drill aim
    const targetRot =
      drillDir === 'down' ? 0 :
      drillDir === 'left' ? -Math.PI / 2 :
      drillDir === 'right' ? Math.PI / 2 : Math.PI;
    this.drillPivot.rotation.z += (targetRot - this.drillPivot.rotation.z) * Math.min(1, dt * 10);

    // drill spin
    this.drillSpin += dt * (drilling ? 26 : 3);
    this.drillBit.rotation.y = this.drillSpin;

    // thruster flames flicker + scale
    const f = Math.max(thrust, Math.abs(sideThrust) * 0.5);
    const flick = 0.75 + Math.sin(time * 47) * 0.25;
    for (const fl of [this.flameL, this.flameR]) {
      fl.visible = f > 0.02;
      fl.scale.set(1, (0.4 + f * 1.1) * flick, 1);
    }

    // lamp brightness ramps with darkness, dips again near the glowing core
    const dark = Math.min(1, Math.max(0, (depthRow - 4) / 30));
    const coreGlow = Math.min(1, Math.max(0, (depthRow - 440) / 50));
    const lamp = dark * (1 - coreGlow * 0.8);
    // running dark: the lamp dies, only the instrument glow remains
    this.headlamp.intensity = lampOn ? lamp * 260 : 0;
    this.glow.intensity = lampOn ? lamp * 20 + 2 : 1.6;
  }
}
