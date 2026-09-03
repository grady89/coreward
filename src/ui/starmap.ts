import * as THREE from 'three';
import { WORLDS, HUSK, WorldDef } from '../world/worlds';
import { GameState } from '../game/state';
import { AudioEngine } from '../audio/audio';
import { TILE_M } from '../config';
import { glyphs } from '../input/prompts';

// The Sundering Chart: the assay dish's reconstruction of the catastrophe.
// One star broke; three fragments fell; three worlds caught them. The chart
// shows the wreck itself — remnant at the center, trajectory arcs to each
// site — and travel is a staged transit, not a button.

interface StarmapCtx {
  state: GameState;
  audio: AudioEngine;
  reducedMotion: boolean;
  /** fired at the whiteout peak — the caller swaps worlds behind the flash */
  onTravel(id: string): void;
  onClose(): void;
}

interface Site {
  def: WorldDef;
  pos: THREE.Vector3;
  size: number;
  spin: number;
  planet: THREE.Mesh;
  wire: THREE.Mesh | null;
  wireMat: THREE.MeshBasicMaterial | null;
  beaconMat: THREE.MeshBasicMaterial | null;
  beacon: THREE.Mesh | null;
  shard: THREE.Mesh | null;
  sparks: THREE.Points | null;
  curve: THREE.QuadraticBezierCurve3 | null;
  tag: HTMLElement;
  unlocked: boolean;
  current: boolean;
  done: boolean;
}

const OVERVIEW_POS = new THREE.Vector3(1.5, 5.4, 24.5);
const OVERVIEW_LOOK = new THREE.Vector3(1.5, 1.9, 0);
const UP = new THREE.Vector3(0, 1, 0);
const TRANSIT_TIME = 2.2;

/** hand-composed poses so the overview reads all three sites at once */
const SITE_POSE: Record<string, { pos: [number, number, number]; size: number; spin: number; tilt: number }> = {
  veil3: { pos: [-8.6, 0.4, 4.6], size: 2.0, spin: 0.05, tilt: 0.18 },
  cryos2: { pos: [5.2, 1.7, 13.0], size: 1.55, spin: 0.07, tilt: -0.3 },
  maelis6: { pos: [16.5, -0.8, -4.5], size: 2.4, spin: 0.04, tilt: 0.12 },
  // the husk hangs off-plane, away from the wreck — no arc reaches it
  site297: { pos: [-15.5, 2.6, -9.5], size: 1.7, spin: 0.02, tilt: 0.05 },
};

function css(hex: number): string { return '#' + hex.toString(16).padStart(6, '0'); }

/** soft radial dot, tinted by whatever material uses it */
let glowTex: THREE.CanvasTexture | null = null;
function softGlow(): THREE.CanvasTexture {
  if (glowTex) return glowTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.4)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(cv);
  return glowTex;
}

/** painterly banded globe from the world's own strata palette */
function planetTexture(def: WorldDef): THREE.CanvasTexture {
  const W = 256, H = 128;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d')!;
  const cols = def.rockColors.map(css);
  g.fillStyle = cols[1];
  g.fillRect(0, 0, W, H);
  const bands = 9;
  for (let b = 0; b < bands; b++) {
    g.fillStyle = cols[(b * 3 + 1) % cols.length];
    const y0 = (b / bands) * H;
    for (let x = 0; x < W; x++) {
      const yy = y0 + Math.sin(x * 0.045 + b * 7.3) * 3.2 + Math.sin(x * 0.13 + b * 2.1) * 1.6;
      g.fillRect(x, yy, 1, H / bands + 3);
    }
  }
  // mineral speckle
  for (let i = 0; i < 420; i++) {
    const dark = Math.random() < 0.6;
    g.fillStyle = dark ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.08)';
    g.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 2, 1);
  }
  // gem-tinted crust seams — the glow that made this world worth digging
  g.strokeStyle = css(def.gemTint);
  g.globalAlpha = 0.28;
  g.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    g.beginPath();
    let x = Math.random() * W, y = Math.random() * H;
    g.moveTo(x, y);
    for (let s = 0; s < 6; s++) {
      x += (Math.random() - 0.5) * 46; y += (Math.random() - 0.5) * 20;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  g.globalAlpha = 1;
  if (def.iceTraction) {
    for (const top of [true, false]) {
      const grad = g.createLinearGradient(0, top ? 0 : H, 0, top ? 18 : H - 18);
      grad.addColorStop(0, 'rgba(232,240,255,0.95)');
      grad.addColorStop(1, 'rgba(232,240,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, top ? 0 : H - 18, W, 18);
    }
  }
  // darken poles so the sphere reads round even unlit
  const pole = g.createLinearGradient(0, 0, 0, H);
  pole.addColorStop(0, 'rgba(0,0,0,0.34)');
  pole.addColorStop(0.25, 'rgba(0,0,0,0)');
  pole.addColorStop(0.75, 'rgba(0,0,0,0)');
  pole.addColorStop(1, 'rgba(0,0,0,0.4)');
  g.fillStyle = pole;
  g.fillRect(0, 0, W, H);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function circleLine(r: number, seg: number, color: number, opacity: number): THREE.LineLoop {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
  }
  return new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity, toneMapped: false })
  );
}

export class Starmap {
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private sites: Site[] = [];
  private overlay: HTMLElement;
  private card: HTMLElement;
  private veil: HTMLElement;
  private time = 0;
  private selected: number;
  private hovered = -1;
  private camMode: 'overview' | 'focus' | 'transit' = 'overview';
  private camPos = OVERVIEW_POS.clone();
  private camLook = OVERVIEW_LOOK.clone();
  private closing = false;
  private disposed = false;

  // transit state
  private transitT = 0;
  private transitFrom = new THREE.Vector3();
  private transitTo = new THREE.Vector3();
  private flashed = false;
  private arrived = false;
  private streaks: THREE.LineSegments | null = null;
  private streakMat: THREE.LineBasicMaterial | null = null;

  // scene handles
  private sunderCore!: THREE.Group;
  private sunderShell!: THREE.Mesh;
  private sunderHalo!: THREE.Group;
  private sunderGlow!: THREE.Sprite;
  private sunderLight!: THREE.PointLight;
  private starLayers: THREE.Points[] = [];
  private dust!: THREE.Points;
  private reticle!: THREE.Group;
  private hoverRing!: THREE.LineLoop;

  private ray = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private par = { x: 0, y: 0 };
  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();
  private tmpC = new THREE.Vector3();
  private proj = new THREE.Vector3();

  private onMove = (e: PointerEvent) => this.pointerMove(e);
  private onDown = (e: PointerEvent) => this.pointerDown(e);

  constructor(ui: HTMLElement, private ctx: StarmapCtx) {
    this.camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 400);
    this.camera.position.copy(this.camPos);
    this.scene.background = new THREE.Color(0x05070f);

    this.buildSpace();
    this.buildSundering();
    this.buildSites();
    this.buildReticles();

    // ---- DOM overlay ----
    this.overlay = document.createElement('div');
    this.overlay.id = 'starmap-ui';
    this.overlay.innerHTML = `
      <div class="sm-vig"></div>
      <div class="sm-top">
        <div class="sm-title">SUNDERING CHART<span class="sm-acc"> ▮</span></div>
        <div class="sm-sub">ASSAY UPLINK · THREE FRAGMENTS OF ONE FALLEN STAR</div>
      </div>
      <button class="btn sm-close" id="sm-close">CLOSE</button>
      <div class="sm-card" id="sm-card"></div>
      <div class="sm-hint">${glyphs('<span class="key">←→</span> SELECT SITE · <span class="key">E</span> COMMIT TRANSIT · <span class="key">ESC</span> BACK')}</div>
    `;
    ui.appendChild(this.overlay);
    this.card = this.overlay.querySelector('#sm-card') as HTMLElement;
    this.card.addEventListener('pointerdown', e => e.stopPropagation());
    this.card.addEventListener('click', e => {
      if ((e.target as HTMLElement).closest('#sm-commit')) this.commit();
    });
    const closeBtn = this.overlay.querySelector('#sm-close') as HTMLElement;
    closeBtn.addEventListener('pointerdown', e => e.stopPropagation());
    closeBtn.addEventListener('click', () => this.close());

    for (const s of this.sites) this.overlay.appendChild(s.tag);

    // veil covers the scene swap on open, transit, and close; it outlives
    // dispose() so the fade can finish over the rebuilt world
    this.veil = document.createElement('div');
    this.veil.id = 'sm-veil';
    ui.appendChild(this.veil);
    this.veilTo('#05070f', 1, 0);
    requestAnimationFrame(() => {
      this.overlay.classList.add('open');
      this.veilTo('#05070f', 0, 700);
    });

    this.selected = Math.max(0, this.sites.findIndex(s => s.current));
    addEventListener('pointermove', this.onMove);
    addEventListener('pointerdown', this.onDown);
    document.body.classList.add('sm-open'); // parks the game HUD
    ctx.audio.stratum();
  }

  // ---------- scene construction ----------
  private buildSpace(): void {
    // three parallax star shells
    const tints = [0xe8e2d5, 0xffb066, 0x8ac8ff, 0xb8aef0];
    for (const [count, rMin, size, op] of [[700, 60, 0.55, 0.75], [420, 90, 0.85, 0.6], [180, 130, 1.3, 0.5]] as const) {
      const pos = new Float32Array(count * 3);
      const col = new Float32Array(count * 3);
      const c = new THREE.Color();
      for (let i = 0; i < count; i++) {
        const v = new THREE.Vector3().randomDirection().multiplyScalar(rMin + Math.random() * 40);
        pos.set([v.x, v.y, v.z], i * 3);
        c.setHex(tints[Math.floor(Math.random() * tints.length)]).multiplyScalar(0.35 + Math.random() * 0.65);
        col.set([c.r, c.g, c.b], i * 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const stars = new THREE.Points(geo, new THREE.PointsMaterial({
        size, map: softGlow(), vertexColors: true, transparent: true, opacity: op,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      }));
      this.starLayers.push(stars);
      this.scene.add(stars);
    }

    // far nebulae
    for (const [color, x, y, z, s, op] of [
      [0x2a1a3e, -40, 14, -80, 90, 0.5],
      [0x12244a, 45, -6, -95, 110, 0.45],
      [0x0a3040, 5, 26, -90, 70, 0.4],
      [0x3a1a2e, -15, -20, -85, 80, 0.32],
    ] as const) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: softGlow(), color, transparent: true, opacity: op,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      }));
      sp.position.set(x, y, z);
      sp.scale.setScalar(s);
      this.scene.add(sp);
    }

    // system-plane dust disk
    const n = 380;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 5.5 + Math.random() * 17;
      const a = Math.random() * Math.PI * 2;
      pos.set([Math.cos(a) * r, (Math.random() - 0.5) * 0.9, Math.sin(a) * r], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.16, map: softGlow(), color: 0x8a7a5a, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    this.scene.add(this.dust);

    this.scene.add(new THREE.AmbientLight(0x2a3350, 0.55));
    const fill = new THREE.DirectionalLight(0xbfd0ff, 0.5);
    fill.position.set(2, 10, 24);
    this.scene.add(fill);
  }

  private buildSundering(): void {
    // a broken star: dark husk chunks drifting around a molten heart, the
    // light escaping through the cracks between them
    this.sunderCore = new THREE.Group();
    const heart = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.74, 1),
      new THREE.MeshBasicMaterial({ color: 0xfff0d0, toneMapped: false })
    );
    heart.name = 'heart';
    this.sunderCore.add(heart);
    const husk = new THREE.MeshStandardMaterial({
      color: 0x5a2a18, roughness: 0.85, flatShading: true,
      emissive: 0xff5a2a, emissiveIntensity: 0.22,
    });
    // semi-regular directions with jitter: the husk covers the heart in
    // pieces, never sealing it — three gaps stay open, one per lost fragment
    const dirs = [
      new THREE.Vector3(1, 0.35, 0.2), new THREE.Vector3(-0.8, 0.5, 0.55),
      new THREE.Vector3(-0.4, -0.9, 0.3), new THREE.Vector3(0.5, -0.4, -0.9),
      new THREE.Vector3(-0.7, 0.1, -0.75), new THREE.Vector3(0.15, 0.95, -0.5),
    ];
    for (const d of dirs) {
      d.normalize();
      const chunk = new THREE.Mesh(new THREE.IcosahedronGeometry(0.48 + Math.random() * 0.14, 0), husk);
      chunk.scale.set(1, 0.65 + Math.random() * 0.25, 0.8 + Math.random() * 0.2);
      chunk.position.copy(d).multiplyScalar(0.82);
      chunk.lookAt(0, 0, 0);
      chunk.userData.dir = d.clone();
      chunk.userData.phase = Math.random() * Math.PI * 2;
      this.sunderCore.add(chunk);
    }
    this.sunderShell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.5, 1),
      new THREE.MeshBasicMaterial({
        color: 0xff6a2a, wireframe: true, transparent: true, opacity: 0.28,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      })
    );
    this.sunderGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: softGlow(), color: 0xff9a3c, transparent: true, opacity: 0.75,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    this.sunderGlow.scale.setScalar(9);
    this.sunderLight = new THREE.PointLight(0xffb066, 340, 120, 1.6);

    // shattered halo — the pieces that stayed behind
    this.sunderHalo = new THREE.Group();
    const shardMat = new THREE.MeshBasicMaterial({
      color: 0xffa04c, transparent: true, opacity: 0.8,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    });
    for (let i = 0; i < 26; i++) {
      const shard = new THREE.Mesh(new THREE.TetrahedronGeometry(0.07 + Math.random() * 0.13), shardMat);
      const a = Math.random() * Math.PI * 2;
      const r = 2.0 + Math.random() * 1.6;
      shard.position.set(Math.cos(a) * r, (Math.random() - 0.5) * 1.1, Math.sin(a) * r);
      shard.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      shard.userData.spin = 0.5 + Math.random() * 1.5;
      this.sunderHalo.add(shard);
    }
    this.scene.add(this.sunderCore, this.sunderShell, this.sunderGlow, this.sunderLight, this.sunderHalo);
  }

  private buildSites(): void {
    const st = this.ctx.state;
    // SITE 297 resolves on the chart once two cores are met — a signal with
    // no fragment arc, which is exactly what is wrong with it
    const defs = st.endedWorlds.size >= 2 ? [...WORLDS, HUSK] : [...WORLDS];
    defs.forEach((def, i) => {
      const pose = SITE_POSE[def.id] ?? {
        pos: [Math.cos(i * 2.1) * (10 + i * 4), (i % 2) * 1.4 - 0.6, Math.sin(i * 2.1) * (10 + i * 4)] as [number, number, number],
        size: 2, spin: 0.05, tilt: 0.15,
      };
      const pos = new THREE.Vector3(...pose.pos);
      const unlocked = def.unlockAfter === null || st.endedWorlds.has(def.unlockAfter);
      const current = def.id === st.activeWorld;
      const done = !def.husk && st.endedWorlds.has(def.id);

      // orbit ring
      const ring = circleLine(Math.hypot(pos.x, pos.z), 128, 0x3a4260, unlocked ? 0.3 : 0.12);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = pos.y;
      this.scene.add(ring);

      let planet: THREE.Mesh;
      let wire: THREE.Mesh | null = null;
      let wireMat: THREE.MeshBasicMaterial | null = null;
      if (unlocked) {
        planet = new THREE.Mesh(
          new THREE.SphereGeometry(pose.size, 40, 28),
          new THREE.MeshStandardMaterial({
            map: planetTexture(def), roughness: 0.92,
            // faint self-light so the night side still reads as a place
            emissive: new THREE.Color(def.sky.low), emissiveIntensity: 0.22,
          })
        );
        planet.rotation.z = pose.tilt;
        // atmosphere: a thin backside rim + a soft halo in the horizon light
        const horizon = new THREE.Color(def.sky.horizon).getHex();
        const rim = new THREE.Mesh(
          new THREE.SphereGeometry(pose.size * 1.045, 40, 28),
          new THREE.MeshBasicMaterial({
            color: horizon, transparent: true, opacity: 0.4, side: THREE.BackSide,
            blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
          })
        );
        rim.position.copy(pos);
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({
          map: softGlow(), color: horizon, transparent: true, opacity: 0.28,
          blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
        }));
        halo.position.copy(pos);
        halo.scale.setScalar(pose.size * 4.4);
        this.scene.add(rim, halo);
      } else {
        // a silhouette the dish has not resolved: dark mass wrapped in static
        planet = new THREE.Mesh(
          new THREE.SphereGeometry(pose.size, 40, 28),
          new THREE.MeshStandardMaterial({ color: 0x0b0e18, roughness: 1 })
        );
        wireMat = new THREE.MeshBasicMaterial({
          color: 0x7a5cff, wireframe: true, transparent: true, opacity: 0.1,
          blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
        });
        wire = new THREE.Mesh(new THREE.IcosahedronGeometry(pose.size * 1.06, 1), wireMat);
        wire.position.copy(pos);
        this.scene.add(wire);
      }
      if (def.husk) {
        // resolved, and wrong: the gray mass wears the same static as an
        // unresolved signal, because the dish cannot say what it is hearing
        wireMat = new THREE.MeshBasicMaterial({
          color: 0x7a5cff, wireframe: true, transparent: true, opacity: 0.1,
          blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
        });
        wire = new THREE.Mesh(new THREE.IcosahedronGeometry(pose.size * 1.06, 1), wireMat);
        wire.position.copy(pos);
        this.scene.add(wire);
      }
      planet.position.copy(pos);
      planet.userData.site = i;
      this.scene.add(planet);

      // fragment trajectory arc: the path this piece of the star took
      let curve: THREE.QuadraticBezierCurve3 | null = null;
      let sparks: THREE.Points | null = null;
      if (unlocked && !def.husk) {
        const dir = pos.clone().normalize();
        const mid = pos.clone().multiplyScalar(0.5).add(new THREE.Vector3(0, 2.4 + pos.length() * 0.09, 0));
        curve = new THREE.QuadraticBezierCurve3(dir.multiplyScalar(1.9), mid, pos.clone());
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(curve.getPoints(64)),
          new THREE.LineBasicMaterial({
            color: def.core.light, transparent: true, opacity: 0.17,
            blending: THREE.AdditiveBlending, toneMapped: false,
          })
        );
        this.scene.add(line);
        const sp = new Float32Array(9);
        const sgeo = new THREE.BufferGeometry();
        sgeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
        sparks = new THREE.Points(sgeo, new THREE.PointsMaterial({
          size: 0.42, map: softGlow(), color: def.core.light, transparent: true, opacity: 0.9,
          blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
        }));
        this.scene.add(sparks);
      }

      // current-site beacon ring
      let beacon: THREE.Mesh | null = null;
      let beaconMat: THREE.MeshBasicMaterial | null = null;
      if (current) {
        beaconMat = new THREE.MeshBasicMaterial({
          color: 0x3ce6c8, transparent: true, opacity: 0.7,
          blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
        });
        beacon = new THREE.Mesh(new THREE.TorusGeometry(pose.size * 1.5, 0.025, 8, 64), beaconMat);
        beacon.rotation.x = Math.PI / 2;
        beacon.position.copy(pos);
        this.scene.add(beacon);
      }

      // core-reached glint: the fragment you stood beside, still with you
      let shard: THREE.Mesh | null = null;
      if (done) {
        shard = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.14),
          new THREE.MeshBasicMaterial({
            color: def.core.light, transparent: true, opacity: 0.95,
            blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
          })
        );
        this.scene.add(shard);
      }

      const tag = document.createElement('div');
      tag.className = 'sm-tag';
      const status = current ? ['YOU ARE HERE', 'var(--teal)']
        : def.husk ? ['SIGNAL RESOLVED', 'var(--violet)']
          : done ? ['CORE REACHED', 'var(--amber)']
            : unlocked ? ['CHARTED', 'var(--ink-dim)']
              : ['NO SIGNAL', 'var(--ink-dim)'];
      tag.innerHTML = `<span class="tn">${unlocked ? def.name : '█████-█'}</span><span class="st" style="color:${status[1]}">${status[0]}</span>`;

      this.sites.push({
        def, pos, size: pose.size, spin: pose.spin, planet, wire, wireMat,
        beacon, beaconMat, shard, sparks, curve, tag, unlocked, current, done,
      });
    });
  }

  private buildReticles(): void {
    this.reticle = new THREE.Group();
    this.reticle.add(circleLine(1, 48, 0xff9a3c, 0.85));
    const ticks: THREE.Vector3[] = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      ticks.push(
        new THREE.Vector3(Math.cos(a) * 1.08, Math.sin(a) * 1.08, 0),
        new THREE.Vector3(Math.cos(a) * 1.32, Math.sin(a) * 1.32, 0)
      );
    }
    this.reticle.add(new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(ticks),
      new THREE.LineBasicMaterial({ color: 0xff9a3c, transparent: true, opacity: 0.85, toneMapped: false })
    ));
    this.reticle.visible = false;
    this.hoverRing = circleLine(1, 48, 0x3ce6c8, 0.5);
    this.hoverRing.visible = false;
    this.scene.add(this.reticle, this.hoverRing);
  }

  // ---------- input ----------
  private pointerMove(e: PointerEvent): void {
    this.ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    this.par.x = this.ndc.x;
    this.par.y = this.ndc.y;
    if (this.camMode === 'transit' || this.closing) return;
    this.ray.setFromCamera(this.ndc, this.camera);
    const hits = this.ray.intersectObjects(this.sites.map(s => s.planet), false);
    this.hovered = hits.length ? (hits[0].object.userData.site as number) : -1;
    document.body.style.cursor = this.hovered >= 0 ? 'pointer' : '';
  }

  private pointerDown(e: PointerEvent): void {
    if (this.camMode === 'transit' || this.closing) return;
    if ((e.target as HTMLElement).closest?.('.sm-card, .sm-close, .btn')) return;
    if (this.hovered >= 0) {
      this.select(this.hovered);
    } else if (this.camMode === 'focus') {
      this.toOverview();
    }
  }

  /** returns true when the key was consumed (the game swallows it) */
  handleKey(code: string): boolean {
    if (code === 'KeyM') return false; // mute stays global
    if (this.camMode === 'transit' || this.closing) return true;
    if (code === 'Escape') {
      if (this.camMode === 'focus') this.toOverview();
      else this.close();
      return true;
    }
    if (code === 'ArrowLeft' || code === 'KeyA') { this.cycle(-1); return true; }
    if (code === 'ArrowRight' || code === 'KeyD') { this.cycle(1); return true; }
    if (code === 'KeyE' || code === 'Enter' || code === 'Space') { this.commit(); return true; }
    return true;
  }

  private cycle(dir: number): void {
    this.select((this.selected + dir + this.sites.length) % this.sites.length);
  }

  private select(i: number): void {
    this.selected = i;
    this.camMode = 'focus';
    this.ctx.audio.click();
    this.renderCard();
    this.overlay.classList.add('focused');
  }

  private toOverview(): void {
    this.camMode = 'overview';
    this.ctx.audio.click();
    this.overlay.classList.remove('focused');
  }

  private commit(): void {
    const s = this.sites[this.selected];
    if (!s.unlocked || s.current) {
      this.ctx.audio.denied();
      if (this.camMode !== 'focus') this.select(this.selected);
      this.card.classList.remove('sm-nudge');
      void this.card.offsetWidth;
      this.card.classList.add('sm-nudge');
      return;
    }
    this.ctx.audio.warp();
    this.camMode = 'transit';
    this.transitT = 0;
    this.flashed = false;
    this.arrived = false;
    this.transitFrom.copy(this.camPos);
    const toCam = this.tmpA.subVectors(this.camPos, s.pos).normalize();
    this.transitTo.copy(s.pos).addScaledVector(toCam, s.size * 1.05);
    this.buildStreaks(this.camPos, s.pos);
    this.overlay.classList.add('transiting');
  }

  private buildStreaks(from: THREE.Vector3, to: THREE.Vector3): void {
    const axis = new THREE.Vector3().subVectors(to, from).normalize();
    const b1 = new THREE.Vector3().crossVectors(axis, Math.abs(axis.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : UP).normalize();
    const b2 = new THREE.Vector3().crossVectors(axis, b1);
    const n = 70;
    const pos = new Float32Array(n * 6);
    for (let i = 0; i < n; i++) {
      const base = new THREE.Vector3().lerpVectors(from, to, 0.15 + Math.random() * 0.72);
      const a = Math.random() * Math.PI * 2;
      const r = 1 + Math.random() * 7;
      base.addScaledVector(b1, Math.cos(a) * r).addScaledVector(b2, Math.sin(a) * r);
      const len = 1.2 + Math.random() * 2.6;
      pos.set([base.x, base.y, base.z,
        base.x + axis.x * len, base.y + axis.y * len, base.z + axis.z * len], i * 6);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.streakMat = new THREE.LineBasicMaterial({
      color: 0xbfe8ff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    });
    this.streaks = new THREE.LineSegments(geo, this.streakMat);
    this.scene.add(this.streaks);
  }

  private close(): void {
    if (this.closing) return;
    this.closing = true;
    this.ctx.audio.click();
    this.overlay.classList.remove('open');
    document.body.style.cursor = '';
    this.veilTo('#05070f', 1, 240);
    setTimeout(() => {
      this.ctx.onClose();
      this.veilTo('#05070f', 0, 500);
      this.removeVeil(1200);
    }, 260);
  }

  private veilTo(color: string, opacity: number, ms: number): void {
    this.veil.style.background = color;
    this.veil.style.transitionDuration = ms + 'ms';
    if (ms === 0) {
      this.veil.style.opacity = String(opacity);
    } else {
      requestAnimationFrame(() => { this.veil.style.opacity = String(opacity); });
    }
  }

  private removeVeil(afterMs: number): void {
    const veil = this.veil;
    setTimeout(() => veil.remove(), afterMs);
  }

  // ---------- dossier card ----------
  private renderCard(): void {
    const s = this.sites[this.selected];
    const st = this.ctx.state;
    const d = s.def;
    if (!s.unlocked) {
      this.card.innerHTML = `
        <div class="sm-name">█████-█</div>
        <div class="sm-tagline">— signal not yet resolved —</div>
        <div class="sm-chip dim">NO SIGNAL</div>
        <div class="row"><span class="r-name">FRAGMENT</span><span class="r-val dim2">NOT TRIANGULATED</span></div>
        <div class="row"><span class="r-name">THE DISH</span><span class="r-val dim2">STILL LISTENING</span></div>
        <button class="btn wide" disabled>NO TRANSIT SOLUTION</button>`;
      return;
    }
    if (d.husk) {
      const action = s.current
        ? '<button class="btn wide" disabled>YOU ARE HERE</button>'
        : '<button class="btn primary wide" id="sm-commit">COMMIT TRANSIT</button>';
      this.card.innerHTML = `
        <div class="sm-name">${d.name}</div>
        <div class="sm-tagline">${d.tagline}</div>
        <div class="sm-chip dim">SIGNAL RESOLVED</div>
        <div class="row"><span class="r-name">FRAGMENT</span><span class="r-val dim2">TAKEN</span></div>
        <div class="row"><span class="r-name">COLONY BEACON</span><span class="r-val dim2">TRANSMITTING</span></div>
        <div class="row"><span class="r-name">COLONY</span><span class="r-val dim2">—</span></div>
        ${action}`;
      return;
    }
    const rowBest = d.id === st.activeWorld
      ? Math.max(st.worldBestRow, st.worlds[d.id]?.bestRow ?? 0)
      : (st.worlds[d.id]?.bestRow ?? 0);
    const surveyed = rowBest > 0 ? Math.round(rowBest * TILE_M) + 'm' : 'UNSURVEYED';
    const chip = s.current ? '<div class="sm-chip you">YOU ARE HERE</div>'
      : s.done ? '<div class="sm-chip done">CORE REACHED</div>'
        : '<div class="sm-chip ok">CHARTED</div>';
    const action = s.current
      ? '<button class="btn wide" disabled>YOU ARE HERE</button>'
      : '<button class="btn primary wide" id="sm-commit">COMMIT TRANSIT</button>';
    this.card.innerHTML = `
      <div class="sm-name">${d.name}</div>
      <div class="sm-tagline">${d.tagline}</div>
      ${chip}
      <div class="row"><span class="r-name">FRAGMENT</span><span class="r-val">${s.done ? d.coreName : 'UNCONFIRMED'}</span></div>
      <div class="row"><span class="r-name">ORE YIELD</span><span class="r-val">×${d.valueMul}</span></div>
      <div class="row"><span class="r-name">SURVEYED</span><span class="r-val">${surveyed}</span></div>
      <div class="row"><span class="r-name">HAZARD</span><span class="r-val">${d.hazard.label}</span></div>
      ${action}`;
  }

  // ---------- per-frame ----------
  frame(dt: number): void {
    if (this.disposed) return;
    this.time += dt;
    const t = this.time;
    const rm = this.ctx.reducedMotion;

    if (!rm) {
      this.starLayers[0].rotation.y += dt * 0.0035;
      this.starLayers[1].rotation.y -= dt * 0.002;
      this.starLayers[2].rotation.y += dt * 0.001;
      this.dust.rotation.y += dt * 0.008;
    }

    // the wound at the center of the chart
    const pulse = 1 + Math.sin(t * 2.1) * 0.06;
    this.sunderCore.rotation.y = t * 0.2;
    for (const c of this.sunderCore.children) {
      if (c.name === 'heart') {
        c.scale.setScalar(pulse);
        continue;
      }
      // husk pieces breathe apart and back — the cracks open and close
      const d = c.userData.dir as THREE.Vector3;
      const ph = c.userData.phase as number;
      c.position.copy(d).multiplyScalar(0.82 + Math.sin(t * 0.7 + ph) * 0.07);
      c.rotation.z = Math.sin(t * 0.4 + ph) * 0.14;
    }
    this.sunderShell.rotation.y = -t * 0.13;
    this.sunderShell.rotation.z = t * 0.07;
    this.sunderShell.scale.setScalar(1 + Math.sin(t * 1.4 + 1) * 0.08);
    this.sunderGlow.scale.setScalar(9 + Math.sin(t * 2.1) * 0.9);
    this.sunderLight.intensity = 340 + Math.sin(t * 1.7) * 60;
    this.sunderHalo.rotation.y = t * 0.12;
    for (const shard of this.sunderHalo.children) {
      shard.rotation.x += dt * (shard.userData.spin as number);
    }

    for (const s of this.sites) {
      s.planet.rotation.y += dt * s.spin;
      if (s.wireMat && s.wire) {
        // unresolved signal: static crackle
        s.wireMat.opacity = 0.05 + Math.max(0, Math.sin(t * 0.9)) * 0.05 + (Math.random() < 0.05 ? 0.22 : 0);
        s.wire.rotation.y = t * 0.05;
      }
      if (s.beacon && s.beaconMat) {
        s.beaconMat.opacity = 0.45 + Math.sin(t * 2.4) * 0.3;
        s.beacon.scale.setScalar(1 + Math.sin(t * 2.4) * 0.05);
      }
      if (s.shard) {
        const r = s.size * 1.7;
        s.shard.position.set(
          s.pos.x + Math.cos(t * 0.5) * r,
          s.pos.y + Math.sin(t * 0.9) * 0.3,
          s.pos.z + Math.sin(t * 0.5) * r
        );
        s.shard.rotation.y = t * 1.6;
      }
      if (s.sparks && s.curve) {
        const attr = s.sparks.geometry.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < 3; i++) {
          const tt = (t * 0.055 + i / 3) % 1;
          s.curve.getPoint(tt, this.tmpA);
          attr.setXYZ(i, this.tmpA.x, this.tmpA.y, this.tmpA.z);
        }
        attr.needsUpdate = true;
      }
    }

    // ---- camera ----
    if (this.camMode === 'transit') {
      const s = this.sites[this.selected];
      this.transitT += dt / (rm ? 0.7 : TRANSIT_TIME);
      const p = Math.min(1, this.transitT);
      const e = p * p * p;
      this.camPos.lerpVectors(this.transitFrom, this.transitTo, e);
      this.camLook.copy(s.pos);
      this.camera.fov = 52 + 26 * p * p;
      this.camera.updateProjectionMatrix();
      if (this.streakMat) {
        this.streakMat.opacity = Math.min(1, Math.max(0, (p - 0.18) * 2.5)) * Math.max(0, 1 - Math.max(0, (p - 0.88) * 8)) * 0.7;
      }
      if (p > 0.62 && !this.flashed) {
        this.flashed = true;
        this.veilTo(s.def.sky.horizon, 1, rm ? 150 : 480);
      }
      if (this.transitT >= 1.05 && !this.arrived) {
        this.arrived = true;
        const id = s.def.id;
        // caller disposes us and rebuilds the world behind the flash
        this.ctx.onTravel(id);
        this.veilTo(s.def.sky.horizon, 0, 900);
        this.removeVeil(1400);
        return;
      }
    } else {
      let pTarget: THREE.Vector3;
      let lTarget: THREE.Vector3;
      if (this.camMode === 'focus') {
        const s = this.sites[this.selected];
        const toCam = this.tmpA.subVectors(OVERVIEW_POS, s.pos).normalize();
        pTarget = this.tmpB.copy(s.pos).addScaledVector(toCam, s.size * 5.6);
        pTarget.y += s.size * 0.75;
        // screen-right = cross(forward, up) with forward = -toCam
        const right = this.tmpC.crossVectors(UP, toCam).normalize();
        lTarget = this.tmpA.copy(s.pos).addScaledVector(right, s.size * 1.6);
      } else {
        const mx = rm ? 0 : this.par.x;
        const my = rm ? 0 : this.par.y;
        const drift = rm ? 0 : Math.sin(t * 0.1) * 0.9;
        pTarget = this.tmpB.set(
          OVERVIEW_POS.x + mx * 1.7 + drift,
          OVERVIEW_POS.y + my * 0.9 + (rm ? 0 : Math.cos(t * 0.13) * 0.5),
          OVERVIEW_POS.z
        );
        lTarget = OVERVIEW_LOOK;
      }
      const k = 1 - Math.exp(-dt * 3.4);
      this.camPos.lerp(pTarget, k);
      this.camLook.lerp(lTarget, k);
      if (this.camera.fov !== 52) {
        this.camera.fov += (52 - this.camera.fov) * k;
        this.camera.updateProjectionMatrix();
      }
    }
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);

    // ---- reticles (after the camera so billboards face it) ----
    const inTransit = this.camMode === 'transit';
    const sel = this.sites[this.selected];
    this.reticle.visible = this.camMode === 'focus';
    if (this.reticle.visible) {
      this.reticle.position.copy(sel.pos);
      this.reticle.scale.setScalar(sel.size * 1.5 * (1 + Math.sin(t * 2.2) * 0.03));
      this.reticle.lookAt(this.camera.position);
    }
    const hov = this.hovered >= 0 ? this.sites[this.hovered] : null;
    this.hoverRing.visible = !inTransit && hov !== null && !(this.camMode === 'focus' && this.hovered === this.selected);
    if (hov && this.hoverRing.visible) {
      this.hoverRing.position.copy(hov.pos);
      this.hoverRing.scale.setScalar(hov.size * 1.42);
      this.hoverRing.lookAt(this.camera.position);
    }

    // ---- floating site tags ----
    for (const s of this.sites) {
      this.proj.set(s.pos.x, s.pos.y - s.size * 1.55, s.pos.z).project(this.camera);
      const hide = inTransit || this.closing || this.proj.z > 1;
      const dim = this.camMode === 'focus' && s !== sel;
      s.tag.style.opacity = hide ? '0' : dim ? '0.25' : '1';
      if (!hide) {
        s.tag.style.left = (this.proj.x * 0.5 + 0.5) * innerWidth + 'px';
        s.tag.style.top = (-this.proj.y * 0.5 + 0.5) * innerHeight + 'px';
      }
    }
  }

  render(renderer: THREE.WebGLRenderer): void {
    if (this.disposed) return;
    renderer.render(this.scene, this.camera);
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    removeEventListener('pointermove', this.onMove);
    removeEventListener('pointerdown', this.onDown);
    document.body.style.cursor = '';
    document.body.classList.remove('sm-open');
    this.overlay.remove(); // the veil stays and removes itself
  }
}
