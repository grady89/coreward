import * as THREE from 'three';
import { CORE_ROW, WORLD_W } from '../config';
import { ACTIVE, WORLDS } from '../world/worlds';
import { Ember } from '../world/backdrop';
import { AudioEngine } from '../audio/audio';
import { glyphs } from '../input/prompts';

// The Communion — the ending of a world, staged as a rite instead of a dialog.
//
// Three rules govern everything here:
//   1. The walk is the cinematic. The player keeps the stick; every channel
//      (choir, heartbeat, camera, the fragment's pulse) is driven by DISTANCE,
//      not by time. Back away and the whole crescendo recedes with you.
//   2. Light is liturgy. Sconce monoliths line the chamber floor and ignite
//      as the pilot passes — the walk is measured in lights, not meters.
//   3. The touch inverts the game. Coreward is dark everywhere; the ending
//      floods to the game's only bright screen. "Dig toward the light," paid.

const FLOOR_Y = -(CORE_ROW + 10);   // top surface of the chamber floor
const WALK_FAR = 13;                // tiles: where the crescendo begins
const TOUCH_AT = 3.4;               // tiles: contact (matches main's check)
const MOTES = 110;

export type FinalePhase = 'idle' | 'walk' | 'touch' | 'white' | 'unmake' | 'page' | 'done';

/** an ending's full-screen typography page */
export interface EndingPage {
  /** overlay class: 'page-dark' | 'page-dawn' | 'page-pure' */
  cls: string;
  eyebrow: string;
  title: string;
  lines: string[];
}

interface Sconce {
  x: number;
  lit: boolean;
  litT: number;        // seconds since ignition
  orb: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
}

export class Finale {
  phase: FinalePhase = 'idle';
  /** 0..1 proximity crescendo — distance-driven, so it can recede */
  t = 0;
  /** true once the epilogue panel should open */
  finished = false;

  private touchT = 0;
  private touchDur: number;
  private whiteT = 0;
  private unmakeT = 0;
  private pageT = 0;
  private beatIn = 0;
  private sconces: Sconce[] = [];
  private sconceFlare: THREE.PointLight;
  private motes: THREE.Points;
  private moteSeed: Float32Array;   // per mote: baseX, span, speed, phase
  private moteTime = 0;
  private overlay: HTMLElement | null = null;
  private whiteEl: HTMLElement | null = null;

  constructor(
    scene: THREE.Scene,
    private ember: Ember,
    private audio: AudioEngine,
    private ui: HTMLElement,
    private reducedMotion: boolean,
    preLit: boolean,
  ) {
    this.touchDur = reducedMotion ? 0.9 : 2.4;

    // ---- sconce monoliths: dark slabs with a caged light, three per side ----
    const slabMat = new THREE.MeshStandardMaterial({
      color: 0x241a20, roughness: 0.85, metalness: 0.2, flatShading: true,
    });
    const g = new THREE.Group();
    for (const sx of [21.5, 24.5, 27.5, 36.5, 39.5, 42.5]) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.7, 0.5), slabMat);
      slab.position.set(sx, FLOOR_Y + 0.85, -0.32);
      slab.rotation.z = (Math.sin(sx * 7.3) * 0.03);
      const mat = new THREE.MeshBasicMaterial({
        color: ACTIVE.core.shell, transparent: true, opacity: 0.12, toneMapped: false,
      });
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), mat);
      orb.position.set(sx, FLOOR_Y + 1.85, -0.28);
      g.add(slab, orb);
      this.sconces.push({ x: sx, lit: preLit, litT: preLit ? 9 : 0, orb, mat });
    }
    // one shared light that flares at whichever sconce ignited last
    this.sconceFlare = new THREE.PointLight(ACTIVE.core.light, 0, 10, 1.7);
    this.sconceFlare.visible = false;
    g.add(this.sconceFlare);

    // ---- rising motes: the chamber's air is full of slow light ----
    const pos = new Float32Array(MOTES * 3);
    this.moteSeed = new Float32Array(MOTES * 4);
    const cx = WORLD_W / 2, half = 13.5;
    for (let i = 0; i < MOTES; i++) {
      const bx = cx + (Math.random() * 2 - 1) * half;
      const arch = Math.sqrt(Math.max(0, 1 - ((bx - cx) / 14.5) ** 2));
      const span = 2 + arch * 11;                  // stay under the vault
      this.moteSeed[i * 4] = bx;
      this.moteSeed[i * 4 + 1] = span;
      this.moteSeed[i * 4 + 2] = 0.25 + Math.random() * 0.5;   // rise speed
      this.moteSeed[i * 4 + 3] = Math.random() * Math.PI * 2;  // phase
      pos[i * 3] = bx;
      pos[i * 3 + 1] = FLOOR_Y + Math.random() * span;
      pos[i * 3 + 2] = 0.2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.motes = new THREE.Points(geo, new THREE.PointsMaterial({
      color: ACTIVE.core.shell, size: 0.13, transparent: true, opacity: 0.75,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    }));
    this.motes.frustumCulled = false;
    this.motes.visible = false;
    g.add(this.motes);
    scene.add(g);
  }

  get active(): boolean { return this.phase !== 'idle' && this.phase !== 'done'; }
  /**
   * The Communion proper — the first meeting with a fragment. EVA owns these
   * phases; the unmaking and the ending pages are driven from the main frame
   * instead, because they outlive the walk that started them.
   */
  get isCommunion(): boolean {
    return this.phase === 'walk' || this.phase === 'touch' || this.phase === 'white';
  }
  /** the hands-off stretch: input is the fragment's now */
  get cinematic(): boolean {
    return this.phase === 'touch' || this.phase === 'white' ||
      this.phase === 'unmake' || this.phase === 'page';
  }
  /** 0..1 blend the camera uses to push in past the walk framing */
  get touchBlend(): number {
    if (this.phase === 'touch') return Math.min(1, this.touchT / (this.touchDur * 0.6));
    return this.phase === 'white' || this.phase === 'done' ? 1 : 0;
  }

  /** ambience: runs every frame in every mode, cheap and gated by camera row */
  frame(dt: number, time: number, camRow: number): void {
    // ending pages run in any mode, so their clock lives here, not in advance
    if (this.phase === 'page') this.pageT += dt;
    const near = camRow > CORE_ROW - 120;
    this.motes.visible = near;
    if (!near) return;

    this.moteTime += dt;
    const excite = this.ember.excite;
    const pos = this.motes.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const cx = WORLD_W / 2;
    for (let i = 0; i < MOTES; i++) {
      const bx = this.moteSeed[i * 4];
      const span = this.moteSeed[i * 4 + 1];
      const speed = this.moteSeed[i * 4 + 2] * (1 + excite * 1.4);
      const ph = this.moteSeed[i * 4 + 3];
      const y = (this.moteTime * speed + ph) % 1;
      arr[i * 3] = bx + Math.sin(this.moteTime * 0.5 + ph * 7) * 0.5
        + (cx - bx) * 0.15 * excite;
      arr[i * 3 + 1] = FLOOR_Y + 0.2 + y * span;
    }
    pos.needsUpdate = true;
    (this.motes.material as THREE.PointsMaterial).opacity = 0.45 + excite * 0.4;

    for (let i = 0; i < this.sconces.length; i++) {
      const s = this.sconces[i];
      if (!s.lit) continue;
      s.litT += dt;
      const rise = Math.min(1, Math.max(0, s.litT) * 2.5);
      const flicker = 0.86 + Math.sin(time * 3.1 + i * 1.7) * 0.14;
      s.mat.opacity = (0.12 + 0.88 * rise) * flicker;
      s.orb.scale.setScalar(1 + Math.sin(Math.min(s.litT * 3, Math.PI)) * 0.8);
    }
    if (this.sconceFlare.visible) {
      this.sconceFlare.intensity *= Math.exp(-dt * 2.6);
      if (this.sconceFlare.intensity < 0.4) this.sconceFlare.visible = false;
    }
  }

  /** the pilot has stepped out at the chamber mouth */
  begin(): void {
    if (this.active) return;
    this.phase = 'walk';
    this.t = 0;
    this.finished = false;
    this.buildOverlay();
    this.audio.finaleBed(0.15);
  }

  /** per-frame sequence logic while EVA owns the pilot */
  advance(dt: number, px: number, py: number): void {
    if (this.phase === 'walk') {
      const dist = Math.hypot(px - this.ember.x, py - this.ember.y);
      const target = Math.min(1, Math.max(0, 1 - (dist - TOUCH_AT) / (WALK_FAR - TOUCH_AT)));
      // ease toward the distance target so a jump cut is impossible
      this.t += (target - this.t) * Math.min(1, dt * 3);
      this.ember.excite = this.t * 0.7;
      this.audio.finaleBed(0.15 + this.t * 0.85);

      // the fragment's heartbeat quickens as you close
      this.beatIn -= dt;
      if (this.beatIn <= 0) {
        this.beatIn = 1.5 - this.t * 0.95;
        this.audio.emberBeat(this.t);
      }

      // sconces ignite as the pilot passes them
      for (let i = 0; i < this.sconces.length; i++) {
        const s = this.sconces[i];
        if (s.lit || Math.abs(px - s.x) > 1.0) continue;
        s.lit = true;
        s.litT = 0;
        this.sconceFlare.position.set(s.x, FLOOR_Y + 1.9, 0.3);
        this.sconceFlare.intensity = 26;
        this.sconceFlare.visible = true;
        // count lit sconces so the scale climbs no matter which side you walked
        const n = this.sconces.filter(o => o.lit).length - 1;
        this.audio.sconce(n);
      }
    } else if (this.phase === 'touch') {
      this.touchT += dt;
      this.ember.excite = 1;
      const w = Math.max(0, (this.touchT - this.touchDur * 0.35) / (this.touchDur * 0.65));
      if (this.whiteEl) this.whiteEl.style.opacity = String(Math.min(1, w * w));
      if (this.touchT >= this.touchDur) {
        this.phase = 'white';
        this.whiteT = 0;
        this.igniteText();
      }
    } else if (this.phase === 'white') {
      // the white holds for as long as the player wants to sit with it —
      // only E/Esc (skip) moves the rite on to the epilogue
      this.whiteT += dt;
    } else if (this.phase === 'unmake') {
      // the Communion's dark mirror: the sconces gutter out one by one as
      // the fragment leaves its seat, and the chamber light dies with them
      this.unmakeT += dt;
      const u = this.unmakeT;
      for (let i = 0; i < this.sconces.length; i++) {
        const sc = this.sconces[i];
        if (sc.lit && u > 0.4 + i * 0.35) {
          sc.lit = false;
          sc.mat.opacity = 0.12;
          sc.orb.scale.setScalar(1);
          this.audio.sconceOut(i);
        }
      }
      this.ember.excite = Math.max(0, 1 - u / 2.6);
      if (u >= 3.2) {
        this.ember.taken = true;
        this.finished = true;
      }
    } else if (this.phase === 'page') {
      // an ending's page waits for the player, like the white does
      this.pageT += dt;
    }
  }

  /** the extraction rite: sconces die, the light leaves with you */
  beginUnmake(): void {
    this.phase = 'unmake';
    this.unmakeT = 0;
    this.finished = false;
    this.buildOverlay();
    this.audio.extractChord();
  }

  /** a fragment comes home: relight the chamber, staggered */
  seatRelight(): void {
    this.ember.taken = false;
    this.ember.excite = 1;
    for (let i = 0; i < this.sconces.length; i++) {
      const sc = this.sconces[i];
      if (!sc.lit) {
        sc.lit = true;
        sc.litT = -i * 0.25;
      }
    }
  }

  /** an ending's typography page — black, dawn, or pure white */
  beginPage(page: EndingPage): void {
    this.overlay?.remove();
    this.phase = 'page';
    this.pageT = 0;
    this.finished = false;
    const el = document.createElement('div');
    el.id = 'finale';
    el.className = 'on ' + page.cls;
    el.innerHTML = `
      <div class="f-bar top"></div><div class="f-bar bot"></div>
      <div id="f-white"></div>
      <div id="f-text">
        <div id="f-eyebrow">${page.eyebrow}</div>
        <div id="f-title"></div>
        <div id="f-lines"></div>
        <div id="f-hint">${glyphs('<span class="key">E</span>GO ON')}</div>
      </div>`;
    let li = 0;
    (el.querySelector('#f-title') as HTMLElement).innerHTML = page.title
      .split(' ')
      .map(word => `<span class="f-word">${word
        .split('')
        .map(c => `<span style="--i:${li++}">${c}</span>`)
        .join('')}</span>`)
      .join(' ');
    const stagger = this.reducedMotion ? 0.35 : 1.05;
    const base = this.reducedMotion ? 0.4 : 1.5;
    (el.querySelector('#f-lines') as HTMLElement).innerHTML = page.lines
      .map((l, i) => `<div class="f-line" style="--d:${(base + i * stagger).toFixed(2)}s">${l}</div>`)
      .join('');
    (el.querySelector('#f-hint') as HTMLElement).style.setProperty(
      '--d', `${(base + page.lines.length * stagger + 0.6).toFixed(2)}s`);
    this.ui.appendChild(el);
    this.overlay = el;
    this.whiteEl = el.querySelector('#f-white') as HTMLElement;
    requestAnimationFrame(() => {
      if (this.whiteEl) this.whiteEl.style.opacity = '1';
      el.classList.add('lit');
    });
  }

  /** contact. The world is already marked ended by the caller. */
  touch(): void {
    if (this.phase !== 'walk') return;
    this.phase = 'touch';
    this.touchT = 0;
    this.audio.finaleTouch();
    for (const s of this.sconces) {
      if (!s.lit) { s.lit = true; s.litT = 0; }
    }
  }

  /**
   * E/Esc advances one movement at a time: through the touch it jumps to the
   * white so the text is never skipped past unseen; on the white it hands
   * over to the epilogue — after a short guard so a held key can't blow
   * through the page before a single word lands.
   */
  skip(): void {
    if (this.phase === 'touch') {
      if (this.whiteEl) this.whiteEl.style.opacity = '1';
      this.igniteText();
      this.phase = 'white';
      this.whiteT = 0;
      return;
    }
    if (this.phase === 'white' && this.whiteT >= 0.6) this.finished = true;
    if (this.phase === 'unmake') {
      // fast-forward the gutter-out
      for (const sc of this.sconces) { sc.lit = false; sc.mat.opacity = 0.12; }
      this.ember.excite = 0;
      this.ember.taken = true;
      this.finished = true;
    }
    if (this.phase === 'page' && this.pageT >= 0.8) this.finished = true;
  }

  /** the epilogue panel is open — let the white linger under it, then go */
  conclude(): void {
    this.audio.finaleBed(0);
    this.ember.excite = 0.25; // the fragment stays awake once met
    const el = this.overlay;
    if (el) {
      el.classList.add('fading');
      setTimeout(() => el.remove(), 2600);
    }
    this.overlay = null;
    this.whiteEl = null;
    this.phase = 'done';
  }

  /** the pilot recalled to the pod mid-walk: put everything back */
  abort(): void {
    this.audio.finaleBed(0);
    this.ember.excite = 0;
    this.t = 0;
    this.phase = 'idle';
    const el = this.overlay;
    if (el) {
      el.classList.add('fading');
      setTimeout(() => el.remove(), 1000);
    }
    this.overlay = null;
    this.whiteEl = null;
  }

  /** world teardown (travel): drop any DOM this world's rite left behind */
  dispose(): void {
    this.overlay?.remove();
    this.overlay = null;
    this.whiteEl = null;
  }

  private buildOverlay(): void {
    this.overlay?.remove();
    const el = document.createElement('div');
    el.id = 'finale';
    el.style.setProperty('--f-tint', ACTIVE.sky.horizon);
    el.innerHTML = `
      <div class="f-bar top"></div><div class="f-bar bot"></div>
      <div id="f-white"></div>
      <div id="f-text">
        <div id="f-eyebrow"></div>
        <div id="f-title"></div>
        <div id="f-lines"></div>
        <div id="f-hint">${glyphs('<span class="key">E</span>GO ON')}</div>
      </div>`;
    this.ui.appendChild(el);
    this.overlay = el;
    this.whiteEl = el.querySelector('#f-white') as HTMLElement;
    // next frame so the letterbox bars transition in
    requestAnimationFrame(() => el.classList.add('on'));
  }

  /** populate and reveal the typography over the white */
  private igniteText(): void {
    const el = this.overlay;
    if (!el) return;
    const fragN = WORLDS.findIndex(w => w.id === ACTIVE.id) + 1;
    const lines = ACTIVE.ending.text.split(/<br\s*\/?>/).map(s => s.trim()).filter(Boolean);

    (el.querySelector('#f-eyebrow') as HTMLElement).textContent =
      `THE SUNDERING · FRAGMENT ${fragN} OF ${WORLDS.length}`;
    // letters animate one by one, but lines may only break between words
    let li = 0;
    (el.querySelector('#f-title') as HTMLElement).innerHTML = ACTIVE.ending.title
      .split(' ')
      .map(word => `<span class="f-word">${word
        .split('')
        .map(c => `<span style="--i:${li++}">${c}</span>`)
        .join('')}</span>`)
      .join(' ');
    const stagger = this.reducedMotion ? 0.35 : 1.05;
    const base = this.reducedMotion ? 0.4 : 1.5;
    (el.querySelector('#f-lines') as HTMLElement).innerHTML = lines
      .map((l, i) => `<div class="f-line" style="--d:${(base + i * stagger).toFixed(2)}s">${l}</div>`)
      .join('');
    const total = base + lines.length * stagger;
    (el.querySelector('#f-hint') as HTMLElement).style.setProperty('--d', `${(total + 0.6).toFixed(2)}s`);
    el.classList.add('lit');
  }
}
