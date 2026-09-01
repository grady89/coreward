import './style.css';
import * as THREE from 'three';
import {
  LOW_FUEL_FRAC, WARP_RATE, SALVAGE_TIME, WRECK_LOGS, SPAWN_X, fmtMoney,
  wreckTierForRow, CHARGE_FUSE, CHARGE_BLAST, CHARGE_SEAL,
  TILE_M, WRECK_SPOT_RANGE, WRECK_SALVAGE_RANGE,
} from './config';
import { T, def, rockColor, TILE_DEFS } from './world/tiles';
import { ACTIVE, setActiveWorld, WORLDS } from './world/worlds';
import { Terrain } from './world/terrain';
import { ChunkField, lavaMat } from './world/chunks';
import { createBackwall, createSky, createSurface, createEmber, Atmosphere, Ember, Dock } from './world/backdrop';
import { WreckField } from './world/wrecks';
import { ThreatField } from './world/entities';
import { ArrestorField } from './world/arrestors';
import { Pod } from './player/pod';
import { PodController, Input } from './player/controller';
import { Pilot } from './player/pilot';
import { GameState } from './game/state';
import { loadSettings, saveSettings } from './game/settings';
import {
  evaluate, timeLeft, fuelLeft, accept as acceptContract, POOL as CONTRACT_POOL,
} from './game/contracts';
import { Particles } from './fx/particles';
import { FollowCam } from './fx/camera';
import { Hud } from './ui/hud';
import { Comms } from './ui/comms';
import { SurveyMap } from './ui/map';
import { pick as pickNarrative, WorldStats } from './game/narrative';
import { Panels, createTitle } from './ui/panels';
import { Starmap } from './ui/starmap';
import { AudioEngine } from './audio/audio';

type Mode = 'title' | 'intro' | 'play' | 'eva' | 'starmap';

class Game {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  cam: FollowCam;
  state = new GameState();
  terrain!: Terrain;
  chunks!: ChunkField;
  ember!: Ember;
  atmosphere!: Atmosphere;
  pod!: Pod;
  ctrl!: PodController;
  pilot!: Pilot;
  wrecks!: WreckField;
  threats!: ThreatField;
  arrestors!: ArrestorField;
  particles!: Particles;
  lampOn = true;
  hud: Hud;
  comms!: Comms;
  map!: SurveyMap;
  panels: Panels;
  starmap: Starmap | null = null;
  audio = new AudioEngine();
  private evaHintShown = false;

  mode: Mode = 'title';
  private ui!: HTMLElement;
  settings = loadSettings();
  private fpsFrames = 0;
  private fpsAt = 0;
  private flagDied = false;
  private flagStranded = false;
  private charges: { x: number; y: number; fuse: number }[] = [];
  private rumbleAcc = 0;
  private looted = new Set<number>();
  private salvaging: { idx: number; t: number } | null = null;
  private keys = new Set<string>();
  private time = 0;
  private introT = 0;
  private hitstop = 0;
  private mouseX = 0;
  private mouseY = 0;
  private saveTimer = 0;
  private dmgFxAt = -9;
  private title: { hide(): void } | null = null;
  private clock = new THREE.Clock();
  private reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private screen = { sx: 0, sy: 0 };

  constructor() {
    const canvas = document.getElementById('game') as HTMLCanvasElement;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.cam = new FollowCam(innerWidth / innerHeight);
    this.cam.reducedMotion = this.reducedMotion;

    // load the save FIRST so the active world shapes the whole scene
    const hadSave = this.state.load();
    setActiveWorld(this.state.activeWorld);

    this.ui = document.getElementById('ui')!;
    const ui = this.ui;
    this.hud = new Hud(ui);
    this.comms = new Comms(ui);
    this.comms.reducedMotion = this.reducedMotion;
    this.comms.setBlip(() => this.audio.radio());
    this.map = new SurveyMap(ui);
    this.panels = new Panels(ui, {
      state: this.state,
      audio: this.audio,
      settings: this.settings,
      onSettingsChanged: () => this.applySettings(),
      saveNow: () => this.saveNow(),
      toast: (m, c) => this.hud.toast(m, c),
      onRespawn: () => this.respawn(0.5),
      onRescued: () => {
        this.ctrl.respawnAtSurface();
        this.cam.snap(this.ctrl.px, 2, 15.5);
        this.hud.toast('TOWED TO THE SURFACE');
        this.saveNow();
      },
      onQuitToTitle: () => this.quitToTitle(),
      onOpenStarmap: () => this.openStarmap(),
    });

    this.setupWorld();

    this.title = createTitle(ui, hadSave, {
      onNew: () => this.startNew(),
      onContinue: () => this.startContinue(),
      onHover: () => { if (this.audio.ready) this.audio.click(); },
    });

    this.bindInput();
    addEventListener('resize', () => {
      this.renderer.setSize(innerWidth, innerHeight);
      this.cam.camera.aspect = innerWidth / innerHeight;
      this.cam.camera.updateProjectionMatrix();
      this.starmap?.resize(innerWidth / innerHeight);
    });

    const fade = document.createElement('div');
    fade.id = 'boot-fade';
    ui.appendChild(fade);
    requestAnimationFrame(() => {
      fade.classList.add('gone');
      setTimeout(() => fade.remove(), 1400);
    });

    this.applySettings();
    this.renderer.setAnimationLoop(() => this.frame());

    // headless-test / debug hooks
    (window as unknown as { __game: Game }).__game = this;
    (window as unknown as { __WRECK_LOGS: unknown }).__WRECK_LOGS = WRECK_LOGS;
    (window as unknown as { __TILE_DEFS: unknown }).__TILE_DEFS = TILE_DEFS;
    (window as unknown as { __WORLDS: unknown }).__WORLDS = WORLDS;
    (window as unknown as { __CONTRACT_POOL: unknown }).__CONTRACT_POOL = CONTRACT_POOL;
    (window as unknown as { __acceptContract: unknown }).__acceptContract = acceptContract;
    (window as unknown as { __evaluate: unknown }).__evaluate = evaluate;
  }

  /** (re)builds the entire scene for the active world — no page reload */
  private setupWorld(): void {
    setActiveWorld(this.state.activeWorld);
    this.hud.applyWorld();
    this.scene = new THREE.Scene();
    const ws = this.state.worlds[this.state.activeWorld];
    this.looted = new Set(ws?.looted ?? []);
    // a world you have never dug is unsurveyed, no matter how deep you have
    // been elsewhere — the fog is per site, not per driller
    this.state.worldBestRow = ws?.bestRow ?? 0;
    this.buildWorld(ws?.seed ?? ((Math.random() * 0xffffffff) >>> 0));
    if (ws) {
      this.terrain.applyDug(ws.dug);
      this.ctrl.px = ws.podX;
      this.ctrl.py = ws.podY;
    }
    this.wrecks = new WreckField(this.scene, this.terrain, this.looted);
    this.ctrl.looted = this.looted;
    this.arrestors.load(ws?.arrestors ?? []);
    this.charges.length = 0;
    this.hud.setConsumables(this.state.flares, this.state.charges, this.state.arrestors);
  }

  private buildWorld(seed: number): void {
    this.terrain = new Terrain(seed);
    this.chunks = new ChunkField(this.scene, this.terrain);
    this.chunks.animated = !this.reducedMotion;
    createBackwall(this.scene);
    createSky(this.scene);
    createSurface(this.scene);
    this.ember = createEmber(this.scene);
    this.atmosphere = new Atmosphere(this.scene);
    this.particles = new Particles(this.scene);
    this.pod = new Pod(this.scene);
    this.pilot = new Pilot(this.scene, this.terrain);
    this.threats = new ThreatField(this.scene, this.terrain);
    this.threats.level = this.settings.threats;
    this.arrestors = new ArrestorField(this.scene);
    this.ctrl = new PodController(this.terrain, this.state, this.events());
  }

  private events() {
    return {
      onCollect: (t: T, value: number, full: boolean) => {
        this.cam.screenPos(this.ctrl.px, this.ctrl.py + 0.6, this.screen);
        if (full) {
          this.hud.toast('CARGO FULL — ORE LOST');
          this.audio.cargoFull();
        } else {
          const color = '#' + def(t).gem.toString(16).padStart(6, '0');
          this.hud.popup('+' + fmtMoney(value), color, this.screen.sx, this.screen.sy);
          this.audio.chime(def(t).oreTier);
        }
      },
      onBlockBroken: (t: T, x: number, y: number) => {
        const wx = x + 0.5, wy = -(y + 0.5);
        this.particles.blockBreak(wx, wy, rockColor(t, x, y));
        if (def(t).ore) {
          this.particles.oreBurst(wx, wy, def(t).gem);
          if (!this.reducedMotion && this.settings.hitstop) this.hitstop = 0.035;
        }
        this.cam.addShake(0.1);
      },
      onDamage: (_a: number, _c: string) => {
        if (this.time - this.dmgFxAt > 0.4) {
          this.dmgFxAt = this.time;
          this.hud.damageFlash();
          this.audio.damage();
          this.cam.addShake(0.18);
        }
      },
      onDeath: (cause: string) => {
        this.particles.explosion(this.ctrl.px, this.ctrl.py);
        this.audio.explosion();
        this.cam.addShake(0.55);
        this.flagDied = true;
        this.panels.open('death', { cause });
      },
      onStranded: () => {
        this.flagStranded = true;
        this.panels.open('rescue');
      },
      onDockChange: (d: Dock | null) => {
        if (d && this.mode === 'play') this.saveNow();
      },
      onStratum: (idx: number) => {
        const key = `${ACTIVE.id}:${idx}`;
        if (!this.state.milestones.has(key)) {
          this.state.milestones.add(key);
          if (idx > 0) {
            this.hud.toast(`—  ${ACTIVE.strata[idx]}  —`, 'stratum');
            this.audio.stratum();
            this.hud.toast('NEW ASSAY LOG AT THE OFFICE');
            this.saveNow();
          }
        }
      },
      onGasBurst: (x: number, y: number) => {
        this.particles.explosion(x + 0.5, -(y + 0.5));
        this.audio.explosion();
        this.cam.addShake(0.4);
        this.hud.toast(ACTIVE.gasImpulse > 0 ? 'PRESSURE BURST' : 'GAS POCKET');
      },
      onLanded: (impact: number) => {
        this.particles.landingDust(this.ctrl.px, this.ctrl.py - 0.4, impact);
        this.audio.landing(impact);
        if (impact > 14) this.cam.addShake(Math.min(0.4, impact * 0.02));
      },
      onDrillBlocked: (msg: string) => {
        this.hud.toast(msg);
        this.audio.denied();
      },
      onDash: () => {
        this.audio.dash();
        this.particles.oreBurst(this.ctrl.px, this.ctrl.py, 0x6ad8ff);
      },
      onGlyph: (x: number, y: number) => {
        this.state.glyphs++;
        this.cam.screenPos(x + 0.5, -(y + 0.5), this.screen);
        this.hud.popup('GLYPH RECOVERED', '#b8aef0', this.screen.sx, this.screen.sy);
        this.hud.toast(`CARVED STONE ${this.state.glyphs} — ASSAY OFFICE`, 'stratum');
        this.audio.glyph();
        this.saveNow();
      },
      onArrested: (impact: number) => {
        this.particles.landingDust(this.ctrl.px, this.ctrl.py - 0.4, impact * 1.4);
        this.audio.arrested();
        this.cam.addShake(Math.min(0.22, impact * 0.008));
        this.cam.screenPos(this.ctrl.px, this.ctrl.py + 0.6, this.screen);
        this.hud.popup('CAUGHT', '#3ce6c8', this.screen.sx, this.screen.sy);
      },
      onRuinSighted: () => {
        this.hud.toast('— STRUCTURE —', 'stratum');
        this.audio.stratum();
        this.saveNow();
      },
      onNative: (total: number) => {
        const nat = ACTIVE.native;
        this.cam.screenPos(this.ctrl.px, this.ctrl.py + 0.6, this.screen);
        const color = '#' + (nat?.color ?? 0xcfe8ff).toString(16).padStart(6, '0');
        this.hud.popup(`+1 ${nat?.ore ?? 'DEPOSIT'}`, color, this.screen.sx, this.screen.sy);
        this.audio.chime(2);
        void total;
      },
      onVeinlight: (fuel: number) => {
        this.state.veinlightHarvested++;
        this.cam.screenPos(this.ctrl.px, this.ctrl.py + 0.6, this.screen);
        this.hud.popup(fuel > 0 ? `+${fuel} FUEL` : 'TANK FULL', '#46e6c8', this.screen.sx, this.screen.sy);
        this.audio.veinlight();
      },
    };
  }

  // ---------- flow ----------
  private startNew(): void {
    this.audio.init();
    this.audio.click();
    GameState.wipe();
    this.state.reset();
    this.setupWorld();
    this.title?.hide();
    this.title = null;
    this.ctrl.px = SPAWN_X;
    this.ctrl.py = 3.2;
    this.ctrl.vx = 0; this.ctrl.vy = 0;
    this.introT = 0;
    this.mode = 'intro';
  }

  private startContinue(): void {
    this.audio.init();
    this.audio.click();
    this.title?.hide();
    this.title = null;
    this.cam.snap(this.ctrl.px, this.ctrl.py + 1.8, 14);
    this.hud.show();
    this.hud.setConsumables(this.state.flares, this.state.charges);
    this.hud.setLamp(this.lampOn);
    this.mode = 'play';
  }

  private respawn(frac: number): void {
    this.ctrl.respawnAtSurface();
    this.state.hull = this.state.maxHull * frac;
    this.state.fuel = this.state.maxFuel * frac;
    this.cam.snap(this.ctrl.px, 2, 15.5);
    this.saveNow();
  }

  private saveNow(): void {
    this.state.save(this.terrain, this.ctrl.px, this.ctrl.py, this.looted, this.arrestors.list);
  }

  /** ASSAY → the Sundering Chart: travel happens inside the 3D starmap */
  private openStarmap(): void {
    if (this.starmap) return;
    this.panels.close();
    this.map.close();
    this.keys.clear();
    this.starmap = new Starmap(this.ui, {
      state: this.state,
      audio: this.audio,
      reducedMotion: this.reducedMotion,
      onTravel: (id) => {
        const sm = this.starmap;
        this.starmap = null;
        sm?.dispose();
        this.travel(id); // the world rebuilds behind the transit flash
      },
      onClose: () => {
        const sm = this.starmap;
        this.starmap = null;
        sm?.dispose();
        this.mode = 'play';
      },
    });
    this.mode = 'starmap';
  }

  private travel(id: string): void {
    this.saveNow();
    this.state.activeWorld = id;
    this.state.persist();
    this.panels.close();
    this.map.close();
    this.comms.clear();
    this.setupWorld();
    this.cam.snap(this.ctrl.px, this.ctrl.py + 1.8, 14);
    this.hud.toast(`ARRIVED — ${ACTIVE.name}`, 'stratum');
    this.audio.stratum();
    this.saveNow();
    this.mode = 'play';
  }

  private quitToTitle(): void {
    this.saveNow();
    this.panels.close();
    this.map.close();
    this.hud.hide();
    this.hud.setPrompt(null);
    this.hud.setEva(null);
    if (this.mode === 'eva') this.pilot.hide();
    this.mode = 'title';
    this.title?.hide();
    this.title = createTitle(this.ui, true, {
      onNew: () => this.startNew(),
      onContinue: () => this.startContinue(),
      onHover: () => { if (this.audio.ready) this.audio.click(); },
    });
  }

  // ---------- EVA ----------
  private enterEva(): void {
    this.audio.airlock();
    // step out of the hatch on the side the work is, so the pilot is visibly
    // beside the pod rather than inside it
    let side = this.ctrl.facing;
    const target = this.ctrl.wreckNear;
    if (target >= 0) {
      const w = this.terrain.wrecks[target];
      side = Math.sign(w.x + 0.5 - this.ctrl.px) || 1;
    } else if (this.ctrl.coreNear) {
      side = Math.sign(this.ember.x - this.ctrl.px) || 1;
    }
    // step clear of the boarding radius, or E would put you straight back in
    this.pilot.spawnAt(this.ctrl.px + side * 1.35, this.ctrl.py - 0.1);
    this.salvaging = null;
    this.mode = 'eva';
    if (!this.evaHintShown) {
      this.evaHintShown = true;
      this.hud.toast('EVA — PRESS R TO RECALL TO THE POD');
    }
  }

  private exitEva(): void {
    this.audio.airlock();
    this.pilot.hide();
    this.hud.setEva(null);
    this.salvaging = null;
    this.mode = 'play';
  }

  private salvageReward(depthRow: number): void {
    const roll = Math.random();
    this.cam.screenPos(this.pilot.px, this.pilot.py + 0.5, this.screen);
    // depth is chronology: this wreck can only carry a log of its own era,
    // and world-locked logs only appear on their world
    const tier = wreckTierForRow(depthRow);
    const eligible = WRECK_LOGS
      .map((l, i) => ({ l, i }))
      .filter(({ l, i }) =>
        !this.state.foundLogs.has(i) &&
        l.tier === tier &&
        (!l.world || l.world === this.state.activeWorld));
    if (roll < 0.55 && eligible.length > 0) {
      const { i } = eligible[Math.floor(Math.random() * eligible.length)];
      this.state.foundLogs.add(i);
      this.hud.toast('FOUND LOG RECOVERED — READ AT THE ASSAY OFFICE', 'stratum');
    } else if (roll < 0.75 && this.state.cargoCount < this.state.cargoCap) {
      this.state.addCargo(T.EMBERSHARD);
      this.hud.popup('+1 ◆ EMBERSHARD', '#ffa53c', this.screen.sx, this.screen.sy);
    } else {
      const cash = Math.round((300 + depthRow * 3.2) * ACTIVE.valueMul);
      this.state.money += cash;
      this.state.totalEarned += cash;
      this.hud.popup('+' + fmtMoney(cash), '#ff9a3c', this.screen.sx, this.screen.sy);
    }
    this.audio.salvage();
  }

  // ---------- input ----------
  private bindInput(): void {
    const map: Record<string, keyof Input> = {
      ArrowLeft: 'left', KeyA: 'left',
      ArrowRight: 'right', KeyD: 'right',
      ArrowUp: 'up', KeyW: 'up', Space: 'up',
      ArrowDown: 'down', KeyS: 'down',
    };
    addEventListener('keydown', e => {
      // the starmap owns the keyboard while it is open (M mute stays global)
      if (this.mode === 'starmap' && this.starmap) {
        if (this.starmap.handleKey(e.code)) {
          e.preventDefault();
          return;
        }
      }
      if (map[e.code] !== undefined) {
        e.preventDefault();
        this.keys.add(map[e.code]);
      }
      if (e.code === 'KeyE') this.onInteract();
      if (e.code === 'Escape') this.onEscape();
      if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && this.mode === 'play' && !this.panels.isOpen) {
        this.ctrl.dash();
      }
      if (e.code === 'KeyC') this.warpSell();
      if (e.code === 'KeyQ') this.throwFlare();
      if (e.code === 'KeyG') this.placeCharge();
      if (e.code === 'KeyB') this.toggleArrestor();
      if (e.code === 'KeyF' && (this.mode === 'play' || this.mode === 'eva')) {
        this.lampOn = !this.lampOn;
        this.audio.click();
        this.hud.setLamp(this.lampOn);
        if (!this.lampOn) this.hud.toast('RUNNING DARK');
      }
      if (e.code === 'Tab') {
        e.preventDefault();
        this.toggleMap();
      }
      if (this.map.visible && (e.code === 'Equal' || e.code === 'NumpadAdd')) {
        e.preventDefault();
        this.map.zoomBy(1);
        this.audio.click();
      }
      if (this.map.visible && (e.code === 'Minus' || e.code === 'NumpadSubtract')) {
        e.preventDefault();
        this.map.zoomBy(-1);
        this.audio.click();
      }
      if (e.code === 'KeyR' && this.mode === 'eva' && !this.salvaging && !this.panels.isOpen) {
        this.exitEva();
        this.hud.toast('RECALLED TO THE POD');
      }
      if (e.code === 'KeyM' && this.audio.ready) {
        this.hud.toast(this.audio.toggleMute() ? 'SOUND OFF' : 'SOUND ON');
      }
    });
    addEventListener('keyup', e => {
      if (map[e.code] !== undefined) this.keys.delete(map[e.code]);
    });
    addEventListener('pointermove', e => {
      this.mouseX = (e.clientX / innerWidth - 0.5) * 2;
      this.mouseY = -(e.clientY / innerHeight - 0.5) * 2;
    });
    addEventListener('blur', () => this.keys.clear());
  }

  /** push preference changes into the systems that read them */
  private applySettings(): void {
    const s = this.settings;
    this.audio.setVolumes(s.master, s.sfx, s.music);
    this.cam.reducedMotion = this.reducedMotion || !s.shake;
    this.hud.setFps(s.showFps ? 0 : null);
    if (this.threats) this.threats.level = s.threats;
    saveSettings(s);
  }

  /** Q — throw a flare ahead of you */
  private throwFlare(): void {
    if (this.mode !== 'play' || this.panels.isOpen) return;
    if (this.state.flares <= 0) {
      this.hud.toast('NO FLARES — BUY AT THE FUEL DEPOT');
      this.audio.denied();
      return;
    }
    const dir = this.ctrl.facing;
    if (!this.threats.throwFlare(this.ctrl.px + dir * 0.5, this.ctrl.py, dir * 9, 4)) return;
    this.state.flares--;
    this.audio.flare();
    this.hud.setConsumables(this.state.flares, this.state.charges);
  }

  /** B — deploy an arrestor at your feet, or pick the one here back up */
  private toggleArrestor(): void {
    if (this.mode !== 'play' || this.panels.isOpen) return;
    const here = this.arrestors.at(this.ctrl.px, this.ctrl.py - 0.45);
    if (here >= 0) {
      this.arrestors.retrieve(here);
      this.state.arrestors++;
      this.audio.click();
      this.hud.toast('ARRESTOR RECOVERED');
      this.hud.setConsumables(this.state.flares, this.state.charges, this.state.arrestors);
      this.saveNow();
      return;
    }
    if (this.state.arrestors <= 0) {
      this.hud.toast('NO ARRESTORS — BUY AT THE GARAGE');
      this.audio.denied();
      return;
    }
    if (!this.ctrl.grounded) {
      this.hud.toast('LAND FIRST TO DEPLOY');
      this.audio.denied();
      return;
    }
    if (this.arrestors.blocked(this.ctrl.px, this.ctrl.py - 0.45, this.terrain.wrecks)) {
      this.hud.toast('NO ROOM — WRECKAGE IN THE WAY');
      this.audio.denied();
      return;
    }
    if (!this.arrestors.deploy(this.ctrl.px, this.ctrl.py - 0.45)) {
      this.audio.denied();
      return;
    }
    this.state.arrestors--;
    this.audio.buy();
    this.hud.toast('ARRESTOR DEPLOYED');
    this.hud.setConsumables(this.state.flares, this.state.charges, this.state.arrestors);
    this.saveNow();
  }

  /** G — place a seismic charge */
  private placeCharge(): void {
    if (this.mode !== 'play' || this.panels.isOpen) return;
    if (this.state.charges <= 0) {
      this.hud.toast('NO CHARGES — BUY AT THE FUEL DEPOT');
      this.audio.denied();
      return;
    }
    this.state.charges--;
    this.hud.setConsumables(this.state.flares, this.state.charges);
    const x = this.ctrl.px, y = this.ctrl.py;
    this.charges.push({ x, y, fuse: CHARGE_FUSE });
    this.audio.chargePlaced();
    this.hud.toast('CHARGE ARMED');
  }

  private updateCharges(dt: number): void {
    for (let i = this.charges.length - 1; i >= 0; i--) {
      const c = this.charges[i];
      c.fuse -= dt;
      if (c.fuse > 0) {
        if (Math.random() < 0.25) this.particles.oreBurst(c.x, c.y, 0xff4d29);
        continue;
      }
      this.charges.splice(i, 1);
      this.detonate(c.x, c.y);
    }
  }

  private detonate(x: number, y: number): void {
    const cx = Math.floor(x), cy = Math.floor(-y);
    // seal: standing air becomes soft rubble, closing the tunnel behind you
    const seal = Math.ceil(CHARGE_SEAL);
    for (let dy = -seal; dy <= seal; dy++) {
      for (let dx = -seal; dx <= seal; dx++) {
        if (Math.hypot(dx, dy) > CHARGE_SEAL) continue;
        const tx = cx + dx, ty = cy + dy;
        if (ty < 1 || tx < 0 || tx >= this.terrain.w) continue;
        if (this.terrain.get(tx, ty) === T.AIR) {
          this.terrain.data[this.terrain.idx(tx, ty)] = T.RUBBLE;
          this.terrain.dug.delete(this.terrain.idx(tx, ty));
          this.chunks.markDirty(tx, ty);
        }
      }
    }
    this.threats.blast(x, y, CHARGE_BLAST);
    this.particles.explosion(x, y);
    this.audio.explosion();
    this.cam.addShake(0.5);
    // the blast is not choosy about who is standing in it
    const pd = Math.hypot(this.ctrl.px - x, this.ctrl.py - y);
    if (pd < CHARGE_BLAST * 0.6) this.ctrl.hurtFromThreat(30, 'your own charge');
  }

  private toggleMap(): void {
    if (this.mode !== 'play' && this.mode !== 'eva') return;
    if (!this.state.hasScanner) {
      this.hud.toast('SURVEY SCANNER REQUIRED — ASSAY OFFICE');
      this.audio.denied();
      return;
    }
    this.audio.click();
    this.map.toggle();
  }

  private warpSell(): void {
    if (this.mode !== 'play' || this.panels.isOpen) return;
    if (!this.state.emberTech.warp || this.state.cargoCount === 0) return;
    const total = this.state.sellAll(WARP_RATE);
    this.cam.screenPos(this.ctrl.px, this.ctrl.py + 0.6, this.screen);
    this.hud.popup('+' + fmtMoney(total), '#ff9a3c', this.screen.sx, this.screen.sy);
    this.hud.toast('CARGO WARPED TO THE TRADE POST');
    this.audio.warp();
    this.saveNow();
  }

  private onInteract(): void {
    if (this.panels.isOpen) {
      const shop = ['fuel', 'trade', 'garage', 'assay'].includes(this.panels.current ?? '');
      if (shop) { this.audio.click(); this.panels.close(); }
      return;
    }
    if (this.mode === 'eva') {
      if (this.salvaging) return;
      // salvage first — the pilot often steps out right on top of the wreck
      const idx = this.wreckAtPilot();
      if (idx >= 0) {
        this.salvaging = { idx, t: 0 };
        this.hud.toast('SALVAGING…');
        return;
      }
      // board the pod
      if (Math.abs(this.pilot.px - this.ctrl.px) < 0.85 && Math.abs(this.pilot.py - this.ctrl.py) < 0.9) {
        this.exitEva();
      }
      return;
    }
    if (this.mode !== 'play') return;
    if (this.ctrl.coreNear || this.ctrl.wreckNear >= 0) {
      this.enterEva();
      return;
    }
    if (this.ctrl.dock) {
      this.audio.click();
      this.panels.open(this.ctrl.dock.key);
    }
  }

  /** arm's length only — the walk between pod and wreck is the whole point */
  private wreckAtPilot(): number {
    for (let i = 0; i < this.terrain.wrecks.length; i++) {
      if (this.looted.has(i)) continue;
      const w = this.terrain.wrecks[i];
      if (Math.hypot(w.x + 0.5 - this.pilot.px, -(w.y + 0.5) - this.pilot.py) < WRECK_SALVAGE_RANGE) {
        return i;
      }
    }
    return -1;
  }

  /** the unlooted wreck the pilot is walking toward, for the HUD waypoint */
  private targetWreck(): { i: number; dist: number; dir: number } | null {
    let best = -1, bestD = Infinity;
    for (let i = 0; i < this.terrain.wrecks.length; i++) {
      if (this.looted.has(i)) continue;
      const w = this.terrain.wrecks[i];
      const d = Math.hypot(w.x + 0.5 - this.pilot.px, -(w.y + 0.5) - this.pilot.py);
      if (d < bestD) { bestD = d; best = i; }
    }
    if (best < 0 || bestD > WRECK_SPOT_RANGE + 6) return null;
    const w = this.terrain.wrecks[best];
    return { i: best, dist: bestD, dir: Math.sign(w.x + 0.5 - this.pilot.px) };
  }

  private onEscape(): void {
    if (this.mode !== 'play' && this.mode !== 'eva') return;
    if (this.panels.isOpen) {
      if (this.panels.current !== 'death' && this.panels.current !== 'rescue' && this.panels.current !== 'ending') {
        this.audio.click();
        this.panels.close();
      }
      return;
    }
    this.panels.open('pause');
  }

  private input(): Input {
    return {
      left: this.keys.has('left'),
      right: this.keys.has('right'),
      up: this.keys.has('up'),
      down: this.keys.has('down'),
    };
  }

  // ---------- frame ----------
  private frame(): void {
    // always drain the clock, or the first frame after unpausing gets a
    // delta the size of however long the panel was open
    const raw = this.clock.getDelta();

    // the starmap is its own scene, camera and clock — the world sleeps
    if (this.mode === 'starmap' && this.starmap) {
      this.starmap.frame(Math.min(0.05, raw));
      this.starmap?.render(this.renderer);
      return;
    }

    // A modal panel freezes the world outright. Physics were already halted,
    // but ore kept spinning, dust kept falling and Dispatch kept talking —
    // which reads as "not paused" no matter what the simulation is doing.
    if (this.panels.isOpen && this.mode !== 'title') {
      this.renderer.render(this.scene, this.cam.camera);
      return;
    }

    let dt = Math.min(0.05, raw);
    this.time += dt;

    if (this.hitstop > 0) {
      this.hitstop -= raw;
      dt = 0;
    }

    // fluid pulse (shared material)
    lavaMat.color.setHex(Math.sin(this.time * 2.6) > 0 ? ACTIVE.fluid.pulseA : ACTIVE.fluid.pulseB);

    if (this.mode === 'title') {
      this.cam.titlePose(this.time, this.reducedMotion ? 0 : this.mouseX, this.reducedMotion ? 0 : this.mouseY);
      const bob = Math.sin(this.time * 1.7) * 0.12;
      this.pod.setPos(SPAWN_X, 1.3 + bob);
      this.pod.update(dt, { vx: 0, thrust: 0.35, sideThrust: 0, drilling: false, drillDir: 'down', depthRow: 0, time: this.time });
      this.chunks.update(0, this.time);
      this.atmosphere.update(-4);
    } else if (this.mode === 'intro') {
      this.introT += raw / 1.7;
      this.ctrl.update(dt, { left: false, right: false, up: false, down: false }, this.time);
      this.pod.setPos(this.ctrl.px, this.ctrl.py);
      this.pod.update(dt, { vx: this.ctrl.vx, thrust: 0.2, sideThrust: 0, drilling: false, drillDir: 'down', depthRow: 0, time: this.time });
      this.cam.introBlend(Math.min(1, this.introT), this.ctrl.px, this.ctrl.py);
      this.chunks.update(0, this.time);
      this.atmosphere.update(-2);
      if (this.introT >= 1 && this.ctrl.grounded) {
        this.mode = 'play';
        this.hud.show();
        this.hud.setConsumables(this.state.flares, this.state.charges);
        this.hud.toast('WELCOME BACK, DRILLER', 'stratum');
      }
    } else if (this.mode === 'eva') {
      this.evaFrame(dt);
    } else {
      this.playFrame(dt);
    }

    if (this.settings.showFps) {
      this.fpsFrames++;
      if (this.time - this.fpsAt >= 1) {
        this.hud.setFps(Math.round(this.fpsFrames / (this.time - this.fpsAt)));
        this.fpsFrames = 0;
        this.fpsAt = this.time;
      }
    }

    this.pumpNarrative(raw);
    this.particles.update(dt);
    this.wrecks.update(this.time, dt);
    this.ember.update(this.time, Math.floor(-this.cam.camera.position.y));
    this.renderer.render(this.scene, this.cam.camera);
  }

  private playFrame(dt: number): void {
    const paused = this.panels.isOpen;
    const st = this.state;

    // tell the controller whether a pad is in position to take this fall
    this.ctrl.arrestorCatch = this.arrestors.catchFall(this.ctrl.px, this.ctrl.py, this.ctrl.vy);
    this.arrestors.update(this.time);

    if (!paused && dt > 0) {
      this.ctrl.update(dt, this.input(), this.time);

      if (this.ctrl.thrust > 0 && Math.random() < 0.4) {
        this.particles.thrusterPuff(this.ctrl.px, this.ctrl.py - 0.6);
      }
      if (this.ctrl.inLava && Math.random() < 0.3) {
        this.particles.lavaBubble(this.ctrl.px, this.ctrl.py - 0.3);
      }

      this.saveTimer += dt;
      if (this.saveTimer > 20) {
        this.saveTimer = 0;
        this.saveNow();
      }
    }

    // contextual prompt: dock < wreck < core walk
    if (!paused) {
      if (this.ctrl.coreNear) {
        this.hud.setPrompt(`<span class="key">E</span>EVA — WALK TO ${ACTIVE.coreName}`);
      } else if (this.ctrl.wreckNear >= 0) {
        const m = Math.round(this.ctrl.wreckDist * TILE_M);
        this.hud.setPrompt(`<span class="key">E</span>EVA — WRECKED POD · ${m}m`);
      } else if (this.ctrl.dock) {
        this.hud.setPrompt(`<span class="key">E</span>${this.ctrl.dock.label}`);
      } else {
        this.hud.setPrompt(null);
      }
    }

    this.pod.setPos(this.ctrl.px, this.ctrl.py);
    this.pod.update(dt, {
      vx: this.ctrl.vx,
      thrust: this.ctrl.thrust,
      sideThrust: this.ctrl.sideThrust,
      drilling: this.ctrl.drilling !== null,
      drillDir: this.ctrl.drillDir,
      depthRow: this.ctrl.row,
      time: this.time,
      lampOn: this.lampOn,
    });

    if (!paused && dt > 0) {
      this.updateCharges(dt);
      this.threats.update({
        podX: this.ctrl.px, podY: this.ctrl.py,
        lampOn: this.lampOn, thrust: this.ctrl.thrust, dt, time: this.time,
        hurt: (a, c) => this.ctrl.hurtFromThreat(a, c),
        drain: a => { st.fuel = Math.max(0, st.fuel - a); },
        onAlert: () => {
          this.hud.toast(ACTIVE.swarm.alert);
          this.audio.swarmAlert();
          // teach the counter once per world, the first time they wake
          const key = `swarm-taught:${ACTIVE.id}`;
          if (!st.firedEvents.has(key)) {
            st.firedEvents.add(key);
            setTimeout(() => this.hud.toast(ACTIVE.swarm.counter), 1800);
          }
        },
      });

      // the Long One announces itself through the rock before you see it
      if (this.threats.rumble > 0.12) {
        this.rumbleAcc -= dt;
        if (this.rumbleAcc <= 0) {
          this.rumbleAcc = 1.1 - this.threats.rumble * 0.6;
          this.audio.rumbleTick();
          this.cam.addShake(this.threats.rumble * 0.12);
        }
      }

      // drilling into something is the only weapon you start with
      if (this.ctrl.drilling) {
        this.threats.drillHit(this.ctrl.px, this.ctrl.py, dt);
      }
    }

    this.cam.follow(dt, this.ctrl.px, this.ctrl.py, this.ctrl.vx, this.ctrl.vy);
    this.chunks.update(Math.max(0, this.ctrl.row), this.time);

    if (!this.ctrl.drilling) this.chunks.clearChew();
    // drill chew AFTER the chunk pass so it overrides gem/rock animation
    if (!paused && dt > 0 && this.ctrl.drilling) {
      const d = this.ctrl.drilling;
      this.chunks.chew(d.x, d.y, d.progress, this.time);
      if (Math.random() < 0.5) {
        this.particles.drillSpray(d.x + 0.5, -(d.y + 0.5), rockColor(this.terrain.get(d.x, d.y), d.x, d.y));
      }
      this.cam.addShake(0.05);
    }

    this.atmosphere.update(this.ctrl.row - (this.ctrl.py > -2 ? 6 : 0));

    const dr = this.ctrl.drilling;
    this.audio.update(dt, {
      thrust: this.ctrl.thrust,
      drilling: dr !== null,
      hardness: dr ? dr.hardness : 1,
      row: this.ctrl.row,
      lowFuel: !paused && st.fuel / st.maxFuel < LOW_FUEL_FRAC && st.fuel > 0,
      menace: this.threats.menace,
    });

    this.hud.update(st, this.ctrl.depthM, this.ctrl.row, this.ctrl.heatFrac, Math.max(dt, 0.001));
    this.map.refresh(this.terrain, this.ctrl.px, this.ctrl.py, this.time,
      this.state.worldBestRow, this.state.hasDeepArray, this.arrestors.list,
      this.state.hasBeacons ? this.terrain.wrecks.filter((_, i) => !this.looted.has(i)) : []);

    if (!paused && dt > 0) st.playTime += dt;
    this.updateContractHud();
  }

  /** evaluate narrative triggers and hand the winner to Dispatch */
  private pumpNarrative(dt: number): void {
    this.comms.update(dt);
    this.hud.pushContract(this.comms.busy);
    if (this.comms.busy || this.mode === 'title') return;

    const st = this.state;
    const stats: WorldStats = {
      world: st.activeWorld,
      depthM: st.bestDepthM,
      totalEarned: st.totalEarned,
      wrecksSalvaged: st.wrecksSalvaged,
      contractsDone: st.contractsDone,
      cores: st.endedWorlds.size,
      playTime: st.playTime,
      veinlightHarvested: st.veinlightHarvested,
      sawRuins: st.sawRuins,
      justDied: this.flagDied,
      justStranded: this.flagStranded,
    };
    const e = pickNarrative(stats, st.firedEvents);
    if (e) {
      st.firedEvents.add(e.id);
      this.comms.say(e.lines);
      this.state.persist();
    }
    this.flagDied = false;
    this.flagStranded = false;
  }

  private updateContractHud(): void {
    const st = this.state;
    if (!st.contract) {
      this.hud.setContract(null);
      return;
    }
    const p = evaluate(st.contract, {
      bestDepthM: st.bestDepthM, totalEarned: st.totalEarned,
      fuelSpent: st.fuelSpent, contractOre: st.contractOre, now: st.playTime,
    });
    // latch the moment the job is done, so nothing afterwards can undo it
    if (p.met && !st.contract.met) {
      st.contract.met = true;
      this.hud.toast('TERMS MET — COLLECT AT THE TRADE POST', 'stratum');
      this.audio.toast();
      this.saveNow();
    }
    const tl = timeLeft(st.contract, st.playTime);
    const fl = fuelLeft(st.contract, st.fuelSpent);
    const parts = [`${p.label} ${p.have.toLocaleString()} / ${p.need.toLocaleString()}`];
    if (tl !== null) parts.push(`${Math.ceil(tl)}s`);
    if (fl !== null) parts.push(`${Math.ceil(fl)} fuel`);
    if (p.failed) parts.push('LAPSED');
    else if (p.met) parts.push('READY — TRADE POST');
    this.hud.setContract({
      title: st.contract.c.title,
      reward: fmtMoney(st.contract.c.reward),
      pct: Math.min(100, Math.round((p.have / p.need) * 100)),
      meta: parts.join(' · '),
      warn: p.failed || (tl !== null && tl < 30) || (fl !== null && fl < 15),
    });
  }

  private evaFrame(dt: number): void {
    const paused = this.panels.isOpen;

    if (!paused && dt > 0) {
      if (this.salvaging) {
        this.salvaging.t += dt;
        if (Math.random() < 0.3) {
          this.particles.drillSpray(this.pilot.px, this.pilot.py, 0x8a8a8a);
        }
        if (this.salvaging.t >= SALVAGE_TIME) {
          const idx = this.salvaging.idx;
          this.looted.add(idx);
          this.wrecks.setLooted(idx);
          this.state.wrecksSalvaged++;
          this.salvaging = null;
          this.salvageReward(Math.floor(-this.pilot.py));
          this.saveNow();
        }
      } else {
        this.pilot.update(dt, this.input());
      }

      // oxygen out: blackout, wake in the pod
      if (this.pilot.o2 <= 0) {
        this.exitEva();
        this.hud.toast('BLACKOUT — THE SUIT DRAGGED YOU HOME');
        this.audio.damage();
        return;
      }

      // the core walk: reaching the fragment on foot ends the world
      if (!this.state.endedWorlds.has(ACTIVE.id) &&
        Math.abs(this.pilot.px - this.ember.x) < 3.4 && Math.abs(this.pilot.py - this.ember.y) < 5) {
        this.state.endedWorlds.add(ACTIVE.id);
        this.audio.ending();
        this.panels.open('ending');
        this.saveNow();
        this.exitEva();
        return;
      }

      // contextual prompt
      if (this.salvaging) {
        this.hud.setPrompt(null);
      } else if (this.wreckAtPilot() >= 0) {
        this.hud.setPrompt(`<span class="key">E</span>SALVAGE`);
      } else {
        // walking: point at the wreck so the dark doesn't swallow the errand
        const t = this.targetWreck();
        const atPod = Math.abs(this.pilot.px - this.ctrl.px) < 0.85
          && Math.abs(this.pilot.py - this.ctrl.py) < 0.9;
        if (t && t.dist > WRECK_SALVAGE_RANGE) {
          const arrow = t.dir < 0 ? '←' : '→';
          this.hud.setPrompt(
            `<span class="key">${arrow}</span>WRECK · ${Math.round(t.dist * TILE_M)}m` +
            (atPod ? ` &nbsp;·&nbsp; <span class="key">E</span>BOARD` : '')
          );
        } else if (atPod) {
          this.hud.setPrompt(`<span class="key">E</span>BOARD POD`);
        } else {
          this.hud.setPrompt(null);
        }
      }
    }

    this.hud.setEva(this.pilot.o2);
    this.pod.update(dt, { vx: 0, thrust: 0, sideThrust: 0, drilling: false, drillDir: 'down', depthRow: this.ctrl.row, time: this.time });
    this.cam.follow(dt, this.pilot.px, this.pilot.py, this.pilot.vx, this.pilot.vy, true);
    this.chunks.update(Math.max(0, Math.floor(-this.pilot.py)), this.time);
    this.atmosphere.update(Math.floor(-this.pilot.py));

    this.audio.update(dt, {
      thrust: 0, drilling: this.salvaging !== null, hardness: 2,
      row: Math.floor(-this.pilot.py),
      lowFuel: this.pilot.o2 < 12,
    });

    this.hud.update(this.state, this.ctrl.depthM, this.ctrl.row, 0, Math.max(dt, 0.001));
    this.map.refresh(this.terrain, this.pilot.px, this.pilot.py, this.time,
      this.state.worldBestRow, this.state.hasDeepArray, this.arrestors.list,
      this.state.hasBeacons ? this.terrain.wrecks.filter((_, i) => !this.looted.has(i)) : []);
  }
}

new Game();
