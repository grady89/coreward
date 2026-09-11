import * as THREE from 'three';
import { RigFinish, FlameStyle, LampTint } from '../game/cosmetics';

// The mining pod: hero object built from primitives, two-tone dusty cream +
// amber accents, teal visor, animated drill and thruster flames, headlamp.
// Finishes (the paint locker) recolor a pod's own cloned materials, so a
// review scene with two pods can wear two coats.
//
// The parametric refit: upgrade tiers own geometry + emission, cosmetics own
// hue. refit(tiers) tears down and rebuilds the parametric parts (drill bit,
// belly band, fins, tanks, panniers, plumes); tier 0 rebuilds today's pod
// exactly. Danger/money semantics (radiator heat, cargo fill, hot drill tip)
// glow in fixed ambers no finish can repaint.

export type DrillDir = 'down' | 'left' | 'right' | 'up';

/** upgrade tiers per track, 0..5 — mirrors state.upgrades */
export interface RigTiers {
  drill: number; engine: number; tank: number;
  cargo: number; hull: number; radiator: number;
}

// radiator danger ramp: amber warming toward magma as heatFrac climbs
const FIN_WARM = new THREE.Color(0xff9a3c);
const FIN_HOT = new THREE.Color(0xff4d29);

const HULL = new THREE.MeshStandardMaterial({ color: 0xd8c9a4, roughness: 0.55, metalness: 0.25 });
const ACCENT = new THREE.MeshStandardMaterial({ color: 0xff9a3c, roughness: 0.5, metalness: 0.3 });
const STEEL = new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.4, metalness: 0.8 });
const GLASS = new THREE.MeshStandardMaterial({ color: 0x1d4a52, roughness: 0.1, metalness: 0.6, emissive: 0x0d3a40, emissiveIntensity: 0.5 });

/**
 * The Diamondplate quilt (reference-art/cosmetics): rotated-square cells,
 * each cut into four lit facets around a point, thin dark seams between —
 * with a scatter of hot sparkle dots because subtlety was never the point.
 */
export function facetTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const N = 4, S = 128 / N;
  g.fillStyle = '#5a7391';
  g.fillRect(0, 0, 128, 128);
  const cellAt = (cx: number, cy: number): void => {
    const faces: [string, [number, number][]][] = [
      ['#eef6fd', [[0, -S / 2], [S / 2, 0], [-S / 2, 0]]],           // top
      ['#b8cfe4', [[-S / 2, 0], [0, -S / 2], [0, 0]]],               // left fill
      ['#8fa9c2', [[S / 2, 0], [0, S / 2], [-S / 2, 0]]],            // bottom
    ];
    for (const [tone, tri] of faces) {
      g.fillStyle = tone;
      g.beginPath();
      g.moveTo(cx + tri[0][0], cy + tri[0][1]);
      for (const [dx, dy] of tri.slice(1)) g.lineTo(cx + dx, cy + dy);
      g.closePath();
      g.fill();
    }
    g.strokeStyle = '#1c242e';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(cx, cy - S / 2); g.lineTo(cx + S / 2, cy); g.lineTo(cx, cy + S / 2);
    g.lineTo(cx - S / 2, cy); g.closePath();
    g.stroke();
  };
  for (let y = 0; y <= N; y++) {
    for (let x = 0; x <= N; x++) {
      cellAt(x * S, y * S);
      cellAt(x * S + S / 2, y * S + S / 2);
    }
  }
  let seed = 13;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 10; i++) {
    const x = rnd() * 128, y = rnd() * 128, r = 1 + rnd() * 1.6;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

/** a four-point glint star for the Diamondplate's twinkle */
function glintTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = (x0: number, y0: number, x1: number, y1: number) => {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, 'rgba(255,255,255,0)');
    gr.addColorStop(0.5, 'rgba(255,255,255,0.95)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    return gr;
  };
  g.fillStyle = grad(0, 32, 64, 32); g.fillRect(0, 29, 64, 6);
  g.fillStyle = grad(32, 0, 32, 64); g.fillRect(29, 0, 6, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

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
  private lift = new THREE.Group();
  private drillPivot = new THREE.Group();
  /** spins with the bit: auger sections + hot tip */
  private drillSpinner = new THREE.Group();
  /** aims with the bit but holds still: collar + guide rings */
  private drillFixed = new THREE.Group();
  /** every other parametric part: belly band, fins, tanks, panniers, plumes */
  private para = new THREE.Group();
  private flameL: THREE.Mesh;
  private flameR: THREE.Mesh;
  private plumes: THREE.Mesh[] = [];
  private nozzles: THREE.Mesh[] = [];
  private flameLen = 1;
  private headlamp: THREE.SpotLight;
  private glow: THREE.PointLight;
  private drillSpin = 0;
  private drillStow = 0;
  private facetOn = false;
  private tiers: RigTiers = { drill: 0, engine: 0, tank: 0, cargo: 0, hull: 0, radiator: 0 };
  private lastFinish: [RigFinish, FlameStyle, LampTint] | null = null;
  // per-pod clones so a finish never bleeds onto another pod in a review scene
  private hullMat = HULL.clone();
  private accentMat = ACCENT.clone();
  private steelMat = STEEL.clone();
  // semantic emissives (per pod, persistent across refits): heat, money, work
  private finGlowMat = new THREE.MeshBasicMaterial({
    color: 0x000000, transparent: true, opacity: 1,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  private stripMat = new THREE.MeshBasicMaterial({
    color: 0xffc45c, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  private drillTipMat = new THREE.MeshBasicMaterial({
    color: 0xffcf9a, transparent: true, opacity: 0.45,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  private camoTex: THREE.CanvasTexture | null = null;
  private facetTex: THREE.CanvasTexture | null = null;
  /** the Diamondplate's twinkle: star sprites riding the hull */
  private glints: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; ph: number; sp: number }[] = [];

  constructor(scene: THREE.Scene, tiers?: RigTiers) {
    if (tiers) this.tiers = { ...tiers };
    const HULL = this.hullMat, STEEL = this.steelMat;
    // body
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 18), HULL);
    body.scale.set(1, 1.06, 0.92);
    this.group.add(body);

    // belly plate lives in the parametric group now (the hull track widens it)

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
      this.nozzles.push(noz);
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

    // drill on a pivot so it can aim down / sideways; the bit itself is
    // parametric and arrives in rebuild()
    this.drillPivot.add(this.drillFixed, this.drillSpinner);
    this.group.add(this.drillPivot);

    // the rest of the parametric refit rides here
    this.group.add(this.para);

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
    this.lift.position.y = 0.13;
    for (const c of [...this.group.children]) this.lift.add(c);
    this.group.add(this.lift);

    scene.add(this.group);
    this.rebuild();
  }

  setPos(x: number, y: number): void {
    this.group.position.set(x, y, 0);
  }

  /**
   * Rebuild the rig to a set of upgrade tiers. Idempotent, callable any time
   * (every garage purchase, save load, review staging); re-applies the last
   * finish so a refit never loses the paint job.
   */
  refit(t: RigTiers): void {
    this.tiers = {
      drill: t.drill, engine: t.engine, tank: t.tank,
      cargo: t.cargo, hull: t.hull, radiator: t.radiator,
    };
    this.rebuild();
    if (this.lastFinish) this.applyFinish(...this.lastFinish);
  }

  /** teardown + rebuild of every parametric part. Tier 0 is today's pod. */
  private rebuild(): void {
    const t = this.tiers;
    const wipe = (root: THREE.Object3D): void => {
      root.traverse(o => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.geometry.dispose();
      });
      root.clear();
    };
    wipe(this.para);
    wipe(this.drillFixed);
    wipe(this.drillSpinner);
    this.plumes = [];
    const STEEL = this.steelMat, ACCENT = this.accentMat;

    // ---- HULL: the accent belly band widens per tier, gains plate seams ----
    const bandTop = Math.PI * (0.62 - t.hull * 0.03);
    const belly = new THREE.Mesh(
      new THREE.SphereGeometry(0.43, 24, 12, 0, Math.PI * 2, bandTop, Math.PI - bandTop), ACCENT);
    belly.scale.set(1, 1.06, 0.92);
    this.para.add(belly);
    for (let j = 0; j < t.hull; j++) {
      const seam = new THREE.Mesh(
        new THREE.SphereGeometry(0.442, 24, 1, 0, Math.PI * 2, bandTop + 0.06 + j * 0.085, 0.035), ACCENT);
      seam.scale.set(1, 1.06, 0.92);
      this.para.add(seam);
    }

    // ---- DRILL: cone grows into a stepped auger; one taper, small lips ----
    const dLen = 0.52 + t.drill * 0.052;
    const dRad = 0.17 + t.drill * 0.008;
    if (t.drill === 0) {
      const bit = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.52, 14), STEEL);
      bit.rotation.x = Math.PI;
      bit.position.y = -0.62;
      this.drillSpinner.add(bit);
    } else {
      const secs = Math.min(3, 1 + Math.ceil(t.drill / 2));
      const tipLen = dLen * 0.45;
      const bodyLen = dLen - tipLen;
      const env = (d: number): number => dRad * (1 - d / dLen);
      const lip = 0.01 + t.drill * 0.003;
      let d = 0;
      for (let i = 0; i < secs; i++) {
        const h = bodyLen / secs;
        const sec = new THREE.Mesh(new THREE.CylinderGeometry(env(d), env(d + h) + lip, h, 14), STEEL);
        sec.position.y = -0.36 - d - h / 2;
        this.drillSpinner.add(sec);
        d += h;
      }
      const tip = new THREE.Mesh(new THREE.ConeGeometry(env(bodyLen) + lip * 0.5, tipLen, 14), STEEL);
      tip.rotation.x = Math.PI;
      tip.position.y = -0.36 - bodyLen - tipLen / 2;
      this.drillSpinner.add(tip);
    }
    // collar, plus a guide ring per ~2 tiers riding down the bit
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.16, 12), ACCENT);
    collar.position.y = -0.4;
    this.drillFixed.add(collar);
    for (let j = 0; j < Math.floor(t.drill / 2); j++) {
      const dy = 0.18 + j * 0.13;
      const r = dRad * (1 - dy / dLen) + 0.024;
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r, 0.07, 12), ACCENT);
      ring.position.y = -0.36 - dy;
      this.drillFixed.add(ring);
    }
    // from tier 3 the bit carries a hot cutting tip (brightens while drilling)
    if (t.drill >= 3) {
      const hot = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 8), this.drillTipMat);
      hot.rotation.x = Math.PI;
      hot.position.y = -0.36 - dLen + 0.09;
      this.drillSpinner.add(hot);
    }

    // ---- ENGINE: longer flames, subtly larger nozzles, twin plumes at 4+ ----
    this.flameLen = 1 + t.engine * 0.12;
    for (const n of this.nozzles) n.scale.setScalar(1 + t.engine * 0.06);
    if (t.engine >= 4) {
      for (const s of [-1, 1] as const) {
        const mat = (s < 0 ? this.flameL : this.flameR).material as THREE.MeshBasicMaterial;
        const p = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.34, 8), mat);
        p.rotation.x = Math.PI;
        // in front of the bit so the second plume reads head-on at distance
        p.position.set(s * 0.165, -0.63, 0.15);
        p.visible = false;
        this.para.add(p);
        this.plumes.push(p);
      }
    }

    // ---- RADIATOR: a crest of dorsal fins, glow faces ride heatFrac ----
    for (let i = 0; i < t.radiator; i++) {
      const th = (i - (t.radiator - 1) / 2) * 0.3;
      const dx = Math.sin(th), dy = Math.cos(th);
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.19, 0.11), STEEL);
      fin.position.set(dx * 0.47, dy * 0.47, 0);
      fin.rotation.z = -th;
      this.para.add(fin);
      const face = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.12, 0.118), this.finGlowMat);
      face.position.set(dx * 0.5, dy * 0.5, 0);
      face.rotation.z = -th;
      this.para.add(face);
    }

    // ---- TANK: saddle cells swelling the lower flanks ----
    if (t.tank >= 1) {
      const r = 0.1 + t.tank * 0.016;
      for (const s of [-1, 1] as const) {
        const cell = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), STEEL);
        cell.position.set(s * 0.35, -0.245, 0.03);
        cell.scale.set(1.15, 0.72, 1.25);
        this.para.add(cell);
        if (t.tank >= 2) {
          const strap = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.015, r + 0.015, 0.05, 14), ACCENT);
          strap.position.set(s * 0.35, -0.245, 0.03);
          strap.rotation.x = Math.PI / 2;
          strap.scale.set(1.15, 1, 0.72);
          this.para.add(strap);
        }
        if (t.tank >= 4) {
          const fore = new THREE.Mesh(new THREE.SphereGeometry(r * 0.66, 14, 10), STEEL);
          fore.position.set(s * 0.33, -0.26, 0.03 + r * 1.05);
          fore.scale.set(1.1, 0.72, 1.1);
          this.para.add(fore);
        }
      }
    }

    // ---- CARGO: flank panniers, amber fill strips (opacity = cargoFrac) ----
    const pannier = (w: number, h: number, d: number, x: number, y: number, z: number, rz: number): void => {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      g.rotation.z = rz;
      const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), STEEL);
      const lid = new THREE.Mesh(new THREE.BoxGeometry(w + 0.016, h * 0.24, d + 0.016), ACCENT);
      lid.position.y = h * 0.38;
      // vertical fill-gauge bar: brightness = cargoFrac (money amber)
      const strip = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.03, w * 0.2), h * 0.62, 0.02), this.stripMat);
      strip.position.set(0, -h * 0.14, d / 2 + 0.012);
      g.add(box, lid, strip);
      this.para.add(g);
    };
    if (t.cargo >= 1) {
      const grow = (t.cargo >= 2 ? 1 : 0.88) * (t.cargo >= 4 ? 1.12 : 1);
      for (const s of [-1, 1] as const) {
        pannier(0.19 * grow, 0.16 * grow, 0.19, s * 0.335, 0.27, -0.05, s * -0.7);
        if (t.cargo >= 3) pannier(0.15 * grow, 0.19 * grow, 0.18, s * 0.45, -0.09, 0, s * -0.12);
        if (t.cargo >= 5) pannier(0.15, 0.14, 0.16, s * 0.19, 0.4, -0.16, s * -0.25);
      }
    }
  }

  /** wear a coat from the paint locker — cosmetic only, applied live */
  applyFinish(rig: RigFinish, flame: FlameStyle, lamp: LampTint): void {
    this.lastFinish = [rig, flame, lamp];
    this.camoTex?.dispose();
    this.camoTex = rig.camo ? camoTexture(rig.camo) : null;
    if (rig.facet && !this.facetTex) this.facetTex = facetTexture();
    this.hullMat.map = rig.facet ? this.facetTex : this.camoTex;
    this.hullMat.color.setHex(rig.camo || rig.facet ? 0xffffff : rig.hull);
    // the quilt is chrome; everything else is painted steel
    this.hullMat.metalness = rig.facet ? 0.85 : 0.25;
    this.hullMat.roughness = rig.facet ? 0.22 : 0.55;
    if (!this.glints.length) {
      const gtex = glintTexture();
      for (const [ox, oy, sc] of [
        [-0.24, 0.28, 0.2], [0.3, 0.1, 0.26], [-0.1, -0.14, 0.17],
        [0.12, 0.34, 0.15], [-0.34, 0.02, 0.14],
      ] as const) {
        const mat = new THREE.MeshBasicMaterial({
          map: gtex, color: 0xffffff, transparent: true, opacity: 0,
          blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
        });
        const m = new THREE.Mesh(new THREE.PlaneGeometry(sc, sc), mat);
        m.position.set(ox, oy + 0.13, 0.46);
        this.group.add(m);
        this.glints.push({ mesh: m, mat, ph: ox * 9 + oy * 7, sp: 1.6 + Math.abs(ox) * 3 });
      }
    }
    this.facetOn = !!rig.facet;
    for (const gl of this.glints) gl.mat.opacity = 0;
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
    /** 0..1 live heat gauge — drives the radiator fins' danger glow */
    heatFrac?: number;
    /** 0..1 hold fill — drives the cargo panniers' amber strips */
    cargoFrac?: number;
    /** parked and idle: the drill retracts into the hull until asked for */
    stow?: boolean;
  }): void {
    const { vx, thrust, sideThrust, drilling, drillDir, depthRow, time } = opts;
    const lampOn = opts.lampOn !== false;

    // lean into horizontal motion
    this.group.rotation.z += ((-vx * 0.045) - this.group.rotation.z) * Math.min(1, dt * 8);

    // parked and idle, the whole arm is swallowed by the hull — retract is a
    // settle, deploy is a snap, so the tool is always out before it is needed
    const wantStow = opts.stow ? 1 : 0;
    this.drillStow += (wantStow - this.drillStow) * Math.min(1, dt * (opts.stow ? 4.5 : 16));
    const k = this.drillStow;

    // drill aim — a stowing arm swings HOME (down) as it retracts, whatever
    // it was last doing: an arm frozen sideways still pokes the flank however
    // small it scales, and a parked rig should read as put away, not paused
    const targetRot =
      drillDir === 'down' ? 0 :
      drillDir === 'left' ? -Math.PI / 2 :
      drillDir === 'right' ? Math.PI / 2 : Math.PI;
    const aimRot = targetRot * (1 - k);
    this.drillPivot.rotation.z += (aimRot - this.drillPivot.rotation.z) * Math.min(1, dt * 10);

    // tucked deep enough that even an Emberfang disappears
    this.drillPivot.position.y = k * 0.24;
    this.drillPivot.scale.setScalar(Math.max(0.001, 1 - k * 0.55));

    // drill spin
    this.drillSpin += dt * (drilling ? 26 : 3);
    this.drillSpinner.rotation.y = this.drillSpin;
    // the hot tip breathes while cutting
    this.drillTipMat.opacity = drilling ? 0.72 + Math.sin(time * 31) * 0.18 : 0.42;

    // thruster flames flicker + scale; engine tier stretches the plume
    const f = Math.max(thrust, Math.abs(sideThrust) * 0.5);
    const flick = 0.75 + Math.sin(time * 47) * 0.25;
    for (const fl of [this.flameL, this.flameR]) {
      fl.visible = f > 0.02;
      fl.scale.set(1, (0.4 + f * 1.1) * flick * this.flameLen, 1);
    }
    if (this.plumes.length) {
      const flick2 = 0.75 + Math.sin(time * 47 + 2.3) * 0.25;
      for (const p of this.plumes) {
        p.visible = f > 0.02;
        p.scale.set(1, (0.4 + f * 1.1) * flick2 * this.flameLen * 0.8, 1);
      }
    }

    // radiator fins: dark when cool, amber warming toward magma when hot
    const heat = Math.min(1, Math.max(0, opts.heatFrac ?? 0));
    const shimmer = heat > 0.6 ? Math.sin(time * 11) * 0.2 * ((heat - 0.6) / 0.4) : 0;
    this.finGlowMat.color.copy(FIN_WARM).lerp(FIN_HOT, heat).multiplyScalar(heat * (0.85 + shimmer));

    // cargo strips: the hold's fill, in money amber
    this.stripMat.opacity = Math.min(1, Math.max(0, opts.cargoFrac ?? 0)) * 0.9;

    // the Diamondplate's twinkle: each star breathes on its own clock
    if (this.facetOn) {
      for (const gl of this.glints) {
        const tw = Math.max(0, Math.sin(time * gl.sp + gl.ph));
        gl.mat.opacity = Math.pow(tw, 10) * 0.9;
        gl.mesh.rotation.z = time * 0.4 + gl.ph;
      }
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
