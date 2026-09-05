import './style.css';
import * as THREE from 'three';
import {
  LOW_FUEL_FRAC, WARP_RATE, SALVAGE_TIME, WRECK_LOGS, SPAWN_X, fmtMoney,
  wreckTierForRow, CHARGE_FUSE, CHARGE_BLAST, CHARGE_SEAL,
  TILE_M, WRECK_SPOT_RANGE, WRECK_SALVAGE_RANGE, EVA_O2, CORE_ROW,
  EXTRACT_OFFER, EXTRACT_HOLD, LANCE_SHOT_COST, LANCE_RANGE,
  GLYPHS_TO_TRANSLATE, FORGE,
  RIME_FREEZE_BASE, RIME_FREEZE_PER_TIER, RIME_KEEP_CLEAR,
  SPILL_TTL, SPILL_WARN, SPILL_PICKUP_R, POD_W, POD_H,
} from './config';
import { T, def, oreValue, rockColor, TILE_DEFS } from './world/tiles';
import { ACTIVE, setActiveWorld, WORLDS, worldById } from './world/worlds';
import { Terrain } from './world/terrain';
import { ChunkField, lavaMat } from './world/chunks';
import { createBackwall, createSky, createSurface, createEmber, Atmosphere, Ember, Dock } from './world/backdrop';
import { WreckField } from './world/wrecks';
import { ThreatField, FaunaEvent } from './world/entities';
import { wide } from './world/fauna/types';
import { ArrestorField } from './world/arrestors';
import { SpillSite } from './world/spill';
import { Pod } from './player/pod';
import { PodController, Input } from './player/controller';
import { Pilot } from './player/pilot';
import { GameState } from './game/state';
import { loadSettings, saveSettings } from './game/settings';
import { faunaForEvent } from './game/bestiary';
import {
  evaluate, timeLeft, fuelLeft, accept as acceptContract, POOL as CONTRACT_POOL,
} from './game/contracts';
import { Particles } from './fx/particles';
import { FollowCam } from './fx/camera';
import { Finale } from './fx/finale';
import { Hud } from './ui/hud';
import { Comms } from './ui/comms';
import { SurveyMap } from './ui/map';
import {
  pick as pickNarrative, WorldStats, HUSK_READABLES, ENDING_PAGES, EndingKind,
  ADHOC_TRANSMISSIONS,
} from './game/narrative';
import { Panels, createTitle, CONTROLS_HINT } from './ui/panels';
import { Starmap } from './ui/starmap';
import { AudioEngine } from './audio/audio';
import { STAGES, SandboxCard, StageCtx } from './dev/sandbox';
import { GlyphMarks, glyphById, GLYPHS, WORLD_GLYPHS } from './world/glyphs';
import { VaultRun, BEAM_LEN } from './game/vault';
import { vaultByGlyph, VAULTS, TEST_VAULTS, parseVault, CHAMBER_MAX_W, SPARK_CLASS, PULSE } from './world/vaults';
import { Interior, InteriorPanel } from './game/interior';
import { loadMeta, lockMeta } from './game/meta';
import { rigFinish, flameStyle, lampTint, suitFinish, sparkStyle } from './game/cosmetics';
import { applySuitFinish } from './player/suit';
import { ShaftlightField, DepotField } from './world/keeps';
import { Pad, PadDir } from './input/gamepad';
import { MenuNav } from './input/menunav';
import { PROMPTS, glyphs } from './input/prompts';

type Mode = 'title' | 'intro' | 'play' | 'eva' | 'starmap' | 'vault' | 'interior';

/** one discrete request from the player, whichever device made it */
type Action =
  | 'interact' | 'escape' | 'dash' | 'lance' | 'flare' | 'charge' | 'arrestor'
  | 'shaftlight' | 'depot' | 'lamp' | 'map' | 'recall' | 'warpsell' | 'mute'
  | 'zoomin' | 'zoomout';

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
  finale!: Finale;
  wrecks!: WreckField;
  threats!: ThreatField;
  arrestors!: ArrestorField;
  spill!: SpillSite;
  glyphMarks!: GlyphMarks;
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
  private dreadAcc = 0;
  private faunaSfxAt = new Map<string, number>();
  private looted = new Set<number>();
  /** the one-minute warning only fires once per claim */
  private spillWarned = false;
  /** throttle for the "hold is full" nag while sitting on a spill */
  private spillNagAt = -9;
  private salvaging: { idx: number; t: number } | null = null;
  private keys = new Set<string>();
  private time = 0;
  private introT = 0;
  private hitstop = 0;
  private mouseX = 0;
  private mouseY = 0;
  private saveTimer = 0;
  private dmgFxAt = -9;
  private title: { hide(): void; el: HTMLElement } | null = null;
  /** the interactive sandbox: null unless ?fauna is in the URL */
  private sandbox: { card: SandboxCard } | null = null;
  /** a run inside one of the Nine Stones, or null */
  private vault: VaultRun | null = null;
  /** everything kept across expeditions (SPEC-KEEPING.md) */
  meta = loadMeta();
  /** the walkable Quarters, or null while outside */
  private interior: Interior | null = null;
  shaftlightField!: ShaftlightField;
  depots!: DepotField;
  /** ?vault gallery mode: all nine stones in one dev hall, saves disabled */
  private vaultGallery = false;
  /** which creature is staged and whether it still needs coaxing alive */
  private staging: { i: number; prime: number; staged: boolean; settle: number } | null = null;
  /** the second pair of hands — polled once a frame, never event-driven */
  private pad = new Pad();
  private nav = new MenuNav();
  /** the pad's half of the movement input, rebuilt each poll */
  private padDir: PadDir = { left: false, right: false, up: false, down: false };
  private padUpWas = false;
  private padEHeld = false;
  private padPrompts = false;
  private padZoomCd = 0;
  private keyEHeld = false;
  private coreHold = 0;
  private coreActKind: 'extract' | 'seat' | 'offer' | null = null;
  private faunaDead = false;
  private veinKillAcc = 0;
  private quakeAcc = 6;
  /** refreeze bookkeeping: seconds each open dug tile has sat unattended */
  private rimeAge = new Map<number, number>();
  private rimeAcc = 0;
  private smashSfxAt = -9;
  private pendingEnding: EndingKind | null = null;
  private endingSnapshot: {
    money: number; carrying: string | null;
    extracted: string[]; delivered: string[]; reseated: string[]; offered: string[];
  } | null = null;
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
    setActiveWorld(this.state.activeWorld, this.state.extracted.has(this.state.activeWorld));

    this.ui = document.getElementById('ui')!;
    const ui = this.ui;
    this.hud = new Hud(ui);
    this.comms = new Comms(ui);
    this.comms.reducedMotion = this.reducedMotion;
    this.comms.setBlip(() => this.audio.radio());
    this.map = new SurveyMap(ui);
    this.panels = new Panels(ui, {
      state: this.state,
      meta: this.meta,
      audio: this.audio,
      onKeepingChanged: () => this.applyKeeping(),
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
      // after a core is met the crew winches the pod home for free — the
      // kilometer climb is a fine victory lap once, not every time
      onReturnSurface: () => {
        this.ctrl.respawnAtSurface();
        this.cam.snap(this.ctrl.px, 2, 15.5);
        this.hud.toast('THE CREW HAULS YOU HOME — WELL EARNED', 'stratum');
        this.audio.stratum();
        this.saveNow();
      },
      onDeliverFragment: () => this.deliverFragment(),
      onEndingContinue: () => this.endingContinue(),
      onNewExpedition: () => {
        this.pendingEnding = null;
        this.endingSnapshot = null;
        this.startNew();
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
      this.interior?.resize(innerWidth / innerHeight);
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
    (window as unknown as { __wide: unknown }).__wide = wide;
    (window as unknown as { __CONTRACT_POOL: unknown }).__CONTRACT_POOL = CONTRACT_POOL;
    (window as unknown as { __acceptContract: unknown }).__acceptContract = acceptContract;
    (window as unknown as { __evaluate: unknown }).__evaluate = evaluate;
    (window as unknown as { __STAGES: unknown }).__STAGES = STAGES;
    (window as unknown as { __GLYPHS: unknown }).__GLYPHS = GLYPHS;
    (window as unknown as { __VAULTS: unknown }).__VAULTS = VAULTS;
    (window as unknown as { __parseVault: unknown }).__parseVault = parseVault;
    (window as unknown as { __CHAMBER_MAX_W: unknown }).__CHAMBER_MAX_W = CHAMBER_MAX_W;
    (window as unknown as { __TEST_VAULTS: unknown }).__TEST_VAULTS = TEST_VAULTS;
    (window as unknown as { __SPARK_CLASS: unknown }).__SPARK_CLASS = SPARK_CLASS;
    (window as unknown as { __PULSE: unknown }).__PULSE = PULSE;
    (window as unknown as { __BEAM_LEN: unknown }).__BEAM_LEN = BEAM_LEN;
    import('./game/meta').then(m => {
      (window as unknown as { __meta: unknown }).__meta = m;
    });

    // dev harness: ?core drops the pod at the chamber mouth with the rite
    // un-run — press E to walk. ?core=cryos2 targets a specific site.
    const q = new URLSearchParams(location.search);
    const dev = q.get('core');
    if (dev !== null) this.devCoreJump(dev);
    // dev harness: ?fauna cycles every creature staged in its own habitat.
    // ?fauna=riptide opens on one. See src/dev/sandbox.ts.
    const fauna = q.get('fauna');
    if (fauna !== null) this.devSandbox(fauna);
    // dev harness: ?vault=wick steps straight into one of the Nine Stones;
    // bare ?vault opens the Gallery of Nine — every stone in one hall
    const vault = q.get('vault');
    if (vault !== null) {
      if (vault) this.devVault(vault);
      else this.devVaultGallery();
    }
  }

  /**
   * Jump straight to a world's core chamber to iterate on the Communion.
   * Dev-only (URL param). The session is ephemeral: the pod is outfitted to
   * survive the chamber, but nothing here is ever written to the real save.
   */
  private devCoreJump(worldId: string): void {
    this.audio.init(); // no user gesture yet, so wake it on the first one
    const wake = () => this.audio.resume();
    addEventListener('pointerdown', wake, { once: true });
    addEventListener('keydown', wake, { once: true });

    const st = this.state;
    st.ephemeral = true;
    lockMeta();
    if (WORLDS.some(w => w.id === worldId)) st.activeWorld = worldId;
    st.endedWorlds.delete(st.activeWorld);
    this.setupWorld();
    this.title?.hide();
    this.title = null;

    // survive the walk-in on any world: full tanks, top radiator, acclimated
    st.fuel = st.maxFuel;
    st.hull = st.maxHull;
    st.upgrades.radiator = Math.max(st.upgrades.radiator, 5);
    st.accl[st.activeWorld] = 3;

    this.ctrl.px = 20.5;
    this.ctrl.py = -(CORE_ROW + 9) + 0.42;
    this.ctrl.vx = 0; this.ctrl.vy = 0;
    this.cam.snap(this.ctrl.px, this.ctrl.py + 1, 12.5);
    this.hud.show();
    this.hud.setConsumables(st.flares, st.charges, st.arrestors);
    this.hud.setLamp(this.lampOn);
    this.mode = 'play';
    this.hud.toast(`DEV — COMMUNION TEST · ${ACTIVE.name} · E TO WALK`, 'stratum');
  }

  // ---------- fauna sandbox (dev) ----------

  /**
   * ?fauna walks every creature in the game: the right world loaded, its
   * habitat carved, the creature forced alive beside you, and a card saying
   * what to watch for. `?fauna=riptide` opens on one. [ ] cycle, \ restage.
   *
   * The point is motion — the headless suite can prove a Warden walks, but
   * only eyes can say whether the gait reads. Staging lives in
   * src/dev/sandbox.ts and the suite drives the same code.
   */
  private devSandbox(want: string): void {
    this.audio.init();
    const wake = () => this.audio.resume();
    addEventListener('pointerdown', wake, { once: true });
    addEventListener('keydown', wake, { once: true });
    this.title?.hide();
    this.title = null;
    this.sandbox = { card: new SandboxCard(this.ui) };
    const at = STAGES.findIndex(s => s.id === want);
    this.devStage(at < 0 ? 0 : at);
  }

  private stageCtx(): StageCtx {
    return {
      terrain: this.terrain,
      room: (x0, x1, y0, y1) => {
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) this.terrain.carve(x, y);
      },
      set: (x, y, t) => {
        if (x < 0 || x >= this.terrain.w || y < 0 || y >= this.terrain.h) return;
        this.terrain.data[this.terrain.idx(x, y)] = t;
        this.chunks.markDirty(x, y);
      },
      park: (x, row, zoom = 12.5) => {
        this.ctrl.drilling = null;
        this.ctrl.px = x; this.ctrl.py = -row + 0.42;
        this.ctrl.vx = 0; this.ctrl.vy = 0;
        this.cam.zoomBias = zoom - 12.5;
        this.cam.snap(x, -row, zoom);
      },
      lamp: on => { this.lampOn = on; this.hud.setLamp(on); },
      cargo: (...tiles) => {
        this.state.cargo.clear();
        for (const t of tiles) this.state.addCargo(t);
      },
    };
  }

  /**
   * Stage one creature by index or id. Public because the headless suite
   * stages through it too — one definition of "what this creature needs",
   * so a staging bug fails a test instead of quietly passing the wrong one.
   */
  devStage(which: number | string): string | null {
    const i = typeof which === 'number' ? which : STAGES.findIndex(s => s.id === which);
    const s = STAGES[i];
    if (!s) return null;
    const st = this.state;
    st.ephemeral = true;
    lockMeta();
    // the creature only exists on its own world, so load it first: the
    // roster in entities.ts is built per world at setupWorld() time
    if (st.activeWorld !== s.world) {
      st.activeWorld = s.world;
      this.setupWorld();
    }
    st.endedWorlds.delete(s.world);
    st.extracted.delete(s.world);
    // outfitted to stand there and watch without dying of the world itself
    st.fuel = st.maxFuel;
    st.hull = st.maxHull;
    st.upgrades.radiator = Math.max(st.upgrades.radiator, 5);
    st.upgrades.drill = Math.max(st.upgrades.drill, 5);
    st.accl[st.activeWorld] = 3;
    st.flares = Math.max(st.flares, 20);
    st.charges = Math.max(st.charges, 10);

    if (s.core) this.devCoreJump(s.world);
    this.mode = 'play';
    this.hud.show();
    this.hud.setConsumables(st.flares, st.charges, st.arrestors);
    // a stage change carries no story: clear the stratum banners and dispatch
    // chatter the jump itself fires, which otherwise stack over the creature
    this.comms.clear();
    this.hud.clearToasts();
    this.cam.zoomBias = 0;
    this.threats.reset();
    this.threats.level = 'full';
    s.setup(this.stageCtx());

    this.staging = { i, prime: 4, staged: false, settle: 0.6 };
    this.sandbox?.card.show(s, i, STAGES.length, false);
    return s.id;
  }

  /**
   * Most creatures spawn on their own timer against their own rules; the
   * sandbox keeps asking for a few seconds until one takes, then leaves it
   * alone so what you are watching is ordinary behaviour, not a puppet.
   */
  private tickSandbox(dt: number): void {
    const sg = this.staging;
    if (!sg) return;
    const s = STAGES[sg.i];
    // the depth-change banner fires a frame or two after the jump, not during
    // it, so one clear at stage time never catches it
    if (sg.settle > 0) {
      sg.settle -= dt;
      this.hud.clearToasts();
    }
    const alive = s.alive(this.threats);
    if (alive) {
      // the window closes the moment one takes. Without this, killing the
      // thing you staged quietly resurrects it — and 'threats off' would
      // never be able to clear the field.
      sg.prime = 0;
    } else if (sg.prime > 0) {
      sg.prime -= dt;
      s.pick(this.threats)?.devStage?.(this.ctrl.px, this.ctrl.py);
    }
    if (alive !== sg.staged) {
      sg.staged = alive;
      this.sandbox?.card.show(s, sg.i, STAGES.length, alive);
    }
    this.sandbox?.card.tick(dt);
  }

  // ---------- the Nine Stones ----------

  /** the seeded stone the pilot (or pod) is standing at, or null */
  private glyphStoneNear(x: number, y: number, range: number): { x: number; y: number; id: string } | null {
    for (const s of this.terrain.glyphStones) {
      if (Math.abs(x - (s.x + 0.5)) < range && Math.abs(y - (-(s.y + 0.5))) < range + 1.2) return s;
    }
    return null;
  }

  private enterVault(id: string): void {
    const def = vaultByGlyph(id);
    // a TEST_VAULTS room has no glyph of its own — it borrows the first
    // one's dressing (world hues, name plate); dev-only, never saved
    const glyph = glyphById(id)
      ?? (TEST_VAULTS.some(v => v.glyph === id) ? GLYPHS[0] : undefined);
    if (!def || !glyph) return;
    // one stone at a time — a stacked run leaks its scene and its HUD
    if (this.vault) { this.vault.dispose(); this.vault = null; }
    this.audio.airlock();
    this.hud.hide();
    this.hud.setPrompt(null);
    this.hud.setEva(null);
    this.hud.clearToasts();
    this.comms.clear();
    this.map.close();
    this.vault = new VaultRun(def, glyph, ACTIVE.core.body, ACTIVE.glyphHue, this.settings.vaultAssist, {
      chord: i => this.audio.sconceChord(i),
      deny: () => this.audio.denied(),
      gutter: () => this.audio.gutterPhrase(),
      complete: () => this.audio.glyph(),
      duck: (to, hold) => this.audio.duckAmbience(to, hold),
    }, innerWidth / innerHeight, this.ui);
    this.mode = 'vault';
  }

  private closeVault(): void {
    const v = this.vault;
    if (!v) return;
    const completed = v.completed;
    const id = v.glyphId;
    v.dispose();
    this.vault = null;
    this.audio.airlock();
    this.mode = 'eva';
    this.hud.show();
    if (completed && id && glyphById(id) && !this.state.glyphsSet.has(id)) {
      this.state.glyphsSet.add(id);
      this.hud.toast(`TRANSLATED — ${glyphById(id)?.name} · ${this.state.glyphs}/9`, 'stratum');
      this.glyphMarks.build(this.terrain.glyphStones, ACTIVE.glyphHue, this.state.glyphsSet);
      this.saveNow();
    }
    // Dispatch never sees inside — her unease is the vaults' only narration
    if (!this.state.firedEvents.has('vault-first')) {
      this.state.firedEvents.add('vault-first');
      this.comms.say([
        'Telemetry gap. Forty seconds. The suit says you were inside the wall.',
        'That reading is wrong. That wall is two metres thick.',
      ]);
    } else if (completed) {
      const acts: Record<string, [string, string]> = {
        shift: ['vault-act1', 'The assay office ran your three stones together. It reads like a rota. A work rota, for a church.'],
        weather: ['vault-act2', 'Three more stones. They built rooms for a fire and put the weather outside. I keep thinking about who held the tools.'],
        kindled: ['vault-act3', 'The codex finished itself last night. I read it twice. I don\'t think we\'re miners any more.'],
      };
      const worldIds = WORLD_GLYPHS[this.state.activeWorld] ?? [];
      const actKey = worldIds.length && worldIds.every(g => this.state.glyphsSet.has(g)) ? worldIds[worldIds.length - 1] : null;
      const beat = actKey ? acts[actKey] : undefined;
      if (beat && !this.state.firedEvents.has(beat[0])) {
        this.state.firedEvents.add(beat[0]);
        this.comms.say([beat[1]]);
      }
    }
  }

  // ---------- THE QUARTERS ----------

  /** dock at home, walk in — the VaultRun takeover checklist, verbatim */
  private enterInterior(): void {
    if (this.interior) { this.interior.dispose(); this.interior = null; }
    this.audio.airlock();
    this.hud.hide();
    this.hud.setPrompt(null);
    this.hud.setEva(null);
    this.hud.clearToasts();
    this.comms.clear();
    this.map.close();
    this.interior = new Interior({
      meta: this.meta,
      unread: () => this.panels.unreadCount(),
      openPanel: (k: InteriorPanel) => { this.audio.click(); this.panels.open(k); },
    }, innerWidth / innerHeight, this.ui);
    this.mode = 'interior';
  }

  private closeInterior(): void {
    const i = this.interior;
    if (!i) return;
    i.dispose();
    this.interior = null;
    this.audio.airlock();
    this.mode = 'play';   // you docked from the pod; you step back out to it
    this.hud.show();
    this.saveNow();
  }

  /** ?vault=<id> and the headless suite: straight into one stone's room */
  devVault(id: string): string | null {
    const glyph = glyphById(id);
    if (!glyph && !TEST_VAULTS.some(v => v.glyph === id)) return null;
    this.audio.init();
    const wake = () => this.audio.resume();
    addEventListener('pointerdown', wake, { once: true });
    addEventListener('keydown', wake, { once: true });
    const st = this.state;
    st.ephemeral = true;
    lockMeta();
    const world = glyph?.world ?? GLYPHS[0].world;
    if (st.activeWorld !== world) {
      st.activeWorld = world;
      this.setupWorld();
    }
    this.title?.hide();
    this.title = null;
    const stone = this.terrain.glyphStones.find(s => s.id === id);
    if (stone) {
      this.pilot.spawnAt(stone.x + 0.5, -(stone.y + 0.5) + 1.2);
    }
    this.enterVault(id);
    return id;
  }

  /**
   * ?vault with no id: the Gallery of Nine. One carved hall with all nine
   * stones set into the floor — walk to any of them and press E. Exists so
   * the rooms can be PLAYED back to back, not just proven completable: the
   * marks glow brighter as you translate them, so it doubles as a progress
   * wall. Dev-only, and nothing done here is ever written to a save.
   */
  devVaultGallery(): void {
    this.audio.init();
    const wake = () => this.audio.resume();
    addEventListener('pointerdown', wake, { once: true });
    addEventListener('keydown', wake, { once: true });
    this.title?.hide();
    this.title = null;
    this.vaultGallery = true;
    this.state.ephemeral = true;
    lockMeta();

    // the hall: shallow enough to be out of every spawn band, and the
    // creatures stand down anyway — this room is a workshop, not a world
    this.threats.level = 'off';
    const y0 = 40, x0 = 10, w = 46;
    for (let y = y0 - 5; y < y0; y++) {
      for (let x = x0 - 4; x < x0 + w; x++) this.terrain.carve(x, y);
    }
    for (let x = x0 - 4; x < x0 + w; x++) {
      this.terrain.data[this.terrain.idx(x, y0)] = T.ROCK;
      this.terrain.onChange(x, y0);
    }
    // all nine stones, in reading order, five tiles apart
    this.terrain.glyphStones.length = 0;
    for (let i = 0; i < GLYPHS.length; i++) {
      const gx = x0 + 2 + i * 5;
      this.terrain.data[this.terrain.idx(gx, y0)] = T.GLYPH;
      this.terrain.onChange(gx, y0);
      this.terrain.glyphStones.push({ x: gx, y: y0, id: GLYPHS[i].id });
    }
    this.glyphMarks.build(this.terrain.glyphStones, ACTIVE.glyphHue, this.state.glyphsSet);

    // pod parked at the door, pilot already on foot in front of the Wick
    const st = this.state;
    st.fuel = st.maxFuel;
    st.hull = st.maxHull;
    this.ctrl.drilling = null;
    this.ctrl.px = x0 - 2.5; this.ctrl.py = -y0 + 0.42;
    this.ctrl.vx = 0; this.ctrl.vy = 0;
    this.pilot.spawnAt(x0 + 0.5, -y0 + 0.6);
    // pulled back so a stretch of the wall of marks is always in frame
    this.cam.zoomBias = 6;
    this.cam.snap(this.pilot.px, this.pilot.py + 1, 15);
    this.mode = 'eva';
    this.hud.show();
    this.hud.toast('DEV — THE GALLERY OF NINE · WALK A STONE, E TO ENTER', 'stratum');
  }

  /** (re)builds the entire scene for the active world — no page reload */
  private setupWorld(): void {
    this.finale?.dispose(); // a prior world's rite must not leave DOM behind
    // an extracted world arrives with its color spent and its fauna gone
    setActiveWorld(this.state.activeWorld, this.state.extracted.has(this.state.activeWorld));
    this.faunaDead = !!ACTIVE.husk || this.state.extracted.has(this.state.activeWorld);
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
      // shafts that had skinned over stay skinned over — and stay rammable
      for (const i of ws.rime ?? []) this.terrain.data[i] = T.RIME;
      for (const i of ws.nacre ?? []) this.terrain.data[i] = T.NACRE;
      this.ctrl.px = ws.podX;
      this.ctrl.py = ws.podY;
    }
    this.rimeAge.clear();
    this.rimeAcc = 0;
    this.wrecks = new WreckField(this.scene, this.terrain, this.looted);
    this.ctrl.looted = this.looted;
    this.arrestors.load(ws?.arrestors ?? []);
    const claim = this.state.spill;
    if (claim && claim.world === this.state.activeWorld) this.spill.show(claim); else this.spill.hide();
    this.shaftlightField.load(ws?.shaftlights ?? []);
    this.depots.load(ws?.depots ?? []);
    this.charges.length = 0;
    this.hud.setConsumables(this.state.flares, this.state.charges, this.state.arrestors);
    this.applyKeeping();
  }

  /** wear what the meta store says: pod coat, suit coat, and the room */
  private applyKeeping(): void {
    this.pod?.applyFinish(rigFinish(this.meta.finishRig), flameStyle(this.meta.flame), lampTint(this.meta.lampTint));
    this.pilot?.setLampColor(lampTint(this.meta.lampTint).color);
    applySuitFinish(suitFinish(this.meta.finishSuit));
    this.interior?.rebuild();
  }

  private buildWorld(seed: number): void {
    this.terrain = new Terrain(seed);
    this.chunks = new ChunkField(this.scene, this.terrain);
    this.chunks.animated = !this.reducedMotion;
    createBackwall(this.scene);
    createSky(this.scene);
    createSurface(this.scene);
    this.ember = createEmber(this.scene);
    this.ember.taken = this.state.extracted.has(ACTIVE.id);
    this.finale = new Finale(this.scene, this.ember, this.audio, this.ui,
      this.reducedMotion,
      this.state.endedWorlds.has(ACTIVE.id) && !this.state.extracted.has(ACTIVE.id));
    if (this.state.endedWorlds.has(ACTIVE.id)) this.ember.excite = 0.25;
    this.atmosphere = new Atmosphere(this.scene);
    this.particles = new Particles(this.scene);
    this.pod = new Pod(this.scene);
    this.pilot = new Pilot(this.scene, this.terrain);
    this.threats = new ThreatField(this.scene, this.terrain, this.particles);
    this.threats.level = this.faunaDead ? 'off' : this.settings.threats;
    this.arrestors = new ArrestorField(this.scene);
    this.spill = new SpillSite(this.scene);
    this.shaftlightField = new ShaftlightField(this.scene);
    this.depots = new DepotField(this.scene);
    this.ctrl = new PodController(this.terrain, this.state, this.events());
    this.glyphMarks = new GlyphMarks(this.scene);
    this.glyphMarks.build(this.terrain.glyphStones, ACTIVE.glyphHue, this.state.glyphsSet);
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
          this.pad.rumble(0.5, 0.35, 180);
        }
      },
      onDeath: (cause: string) => {
        this.particles.explosion(this.ctrl.px, this.ctrl.py);
        this.audio.explosion();
        this.cam.addShake(0.55);
        this.pad.rumble(1, 1, 520);
        this.flagDied = true;
        this.panels.open('death', { cause, spilled: this.fileSpill() });
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
        this.pad.rumble(0.75, 0.45, 260);
        this.hud.toast(ACTIVE.gasImpulse > 0 ? 'PRESSURE BURST' : 'GAS POCKET');
      },
      onLanded: (impact: number) => {
        this.particles.landingDust(this.ctrl.px, this.ctrl.py - 0.4, impact);
        this.audio.landing(impact);
        if (impact > 14) this.cam.addShake(Math.min(0.4, impact * 0.02));
        if (impact > 8) this.pad.rumble(Math.min(0.7, impact * 0.03), 0.2, 140);
      },
      onDrillBlocked: (msg: string) => {
        this.hud.toast(msg);
        this.audio.denied();
      },
      onDash: () => {
        this.audio.dash();
        this.particles.oreBurst(this.ctrl.px, this.ctrl.py, 0x6ad8ff);
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
      onCoreBalk: () => {
        this.hud.toast('THE POD REFUSES — THE LAST METERS ARE WALKED');
        this.audio.denied();
        this.cam.addShake(0.12);
      },
      onSmash: (x: number, y: number) => {
        this.particles.blockBreak(x + 0.5, -(y + 0.5), 0xd8f0fa);
        // a freefall through a skinned shaft chains ~7 punches a second —
        // shatter per tile, but ring the crack at a listenable rate
        if (this.time - this.smashSfxAt > 0.14) {
          this.smashSfxAt = this.time;
          this.audio.iceCrack();
          this.cam.addShake(0.16);
          if (!this.reducedMotion && this.settings.hitstop) this.hitstop = 0.02;
        }
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
      onMimicHatch: (x: number, y: number) => {
        this.threats.hatchMimic(x, y);
      },
      onHulkShoved: (x: number, y: number) => {
        this.particles.landingDust(x + 0.5, -(y + 0.5), 8);
        this.audio.landing(9);
        this.cam.addShake(0.16);
        this.pad.rumble(0.5, 0.3, 160);
        // taught once: a hulk that has fallen into your shaft is movable, and
        // a driller who does not know that will burn a tank finding out
        if (!this.state.firedEvents.has('hulk-shove-taught')) {
          this.state.firedEvents.add('hulk-shove-taught');
          this.hud.toast('THE HULK SHIFTS — YOU CAN PUSH IT CLEAR');
        }
      },
      onFrostbloom: (x: number, y: number) => {
        // the cold comes out all at once: the tank takes it, the air sets
        const st = this.state;
        st.fuel = Math.max(0, st.fuel - 18);
        // the flash-freeze takes your momentum with it: the pod settles onto
        // the new ice instead of falling through it at smash speed
        this.ctrl.vx = 0; this.ctrl.vy = 0;
        this.threats.frostbloom(x, y, this.ctrl.px, this.ctrl.py);
        this.audio.iceCrack();
        this.hud.coldFlash();
        this.cam.addShake(0.3);
        this.cam.screenPos(this.ctrl.px, this.ctrl.py + 0.6, this.screen);
        this.hud.popup('-18 FUEL', '#b0a8ff', this.screen.sx, this.screen.sy);
        this.onFaunaEvent('frostbloom', x + 0.5, -(y + 0.5));
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
    const claim = this.state.spill;
    if (claim) {
      const m = Math.round(-claim.y * TILE_M);
      this.hud.toast(`YOUR HOLD IS STILL DOWN THERE — ${m}m`, 'stratum');
      this.audio.stratum();
    }
    this.saveNow();
  }

  // ---------- the spill ----------
  /**
   * File a claim over the hold at the crash site. One at a time — a crash
   * with ore aboard writes off whatever the last one left, and a crash with
   * an empty hold files nothing and disturbs nothing. Returns what was
   * spilled so the death panel can name it, or null if there was nothing.
   */
  private fileSpill(): { value: number; count: number } | null {
    const st = this.state;
    const count = st.cargoCount;
    if (count === 0) return null;
    const value = st.cargoValue;
    st.spill = {
      world: st.activeWorld,
      x: this.ctrl.px,
      y: this.ctrl.py,
      ttl: SPILL_TTL,
      cargo: [...st.cargo.entries()],
    };
    st.cargo.clear();
    this.spillWarned = false;
    this.spill.show(st.spill);
    return { value, count };
  }

  /**
   * Burn the beacon battery. It runs wherever the driller is — the clock is
   * the crew's paperwork, not the pod's — but the pile itself only exists on
   * the world it fell on.
   */
  private tickSpill(dt: number): void {
    const st = this.state;
    const c = st.spill;
    if (!c) { this.hud.setSpill(null); return; }

    c.ttl -= dt;
    if (c.ttl <= 0) {
      st.spill = null;
      this.spill.hide();
      this.hud.setSpill(null);
      this.hud.toast('CLAIM EXPIRED — THE SPILL IS WRITTEN OFF');
      this.audio.denied();
      this.saveNow();
      return;
    }
    if (!this.spillWarned && c.ttl <= SPILL_WARN) {
      this.spillWarned = true;
      this.hud.toast('CLAIM BEACON FAILING — ONE MINUTE');
      this.audio.toast();
    }

    const here = c.world === this.state.activeWorld;
    if (here) {
      this.spill.settle((x, y) => this.terrain.blockedAt(x, y), this.terrain.h);
      this.spill.update(this.time, dt);
      if (this.mode === 'play') this.recoverSpill(c);
      if (!st.spill) return; // reclaimed on this frame; the clock is already down
    }
    // depth, not range: it reads against the depth gauge, so the number tells
    // you when to start looking. The survey map handles the last few tiles.
    this.hud.setSpill(c.ttl,
      here ? Math.round(-c.y * TILE_M) + 'm' : (worldById(c.world)?.name ?? 'ELSEWHERE'));
  }

  /** fly into the pile and it goes back in the hold, as much as fits */
  private recoverSpill(c: { x: number; y: number; cargo: [number, number][] }): void {
    if (Math.abs(this.ctrl.px - c.x) > SPILL_PICKUP_R) return;
    if (Math.abs(this.ctrl.py - c.y) > SPILL_PICKUP_R) return;
    const st = this.state;
    let took = 0, value = 0;
    for (const stack of c.cargo) {
      while (stack[1] > 0 && st.addCargo(stack[0])) { stack[1]--; took++; value += oreValue(stack[0]); }
      if (stack[1] > 0) break; // the hold filled — the rest stays on the floor
    }
    if (took === 0) {
      if (this.time - this.spillNagAt > 3) {
        this.spillNagAt = this.time;
        this.hud.toast('CARGO FULL — THE SPILL STAYS PUT');
        this.audio.cargoFull();
      }
      return;
    }
    c.cargo = c.cargo.filter(stack => stack[1] > 0);
    this.cam.screenPos(this.ctrl.px, this.ctrl.py + 0.6, this.screen);
    this.hud.popup('+' + fmtMoney(value), '#ff9a3c', this.screen.sx, this.screen.sy);
    this.audio.salvage();
    if (c.cargo.length === 0) {
      st.spill = null;
      this.spill.hide();
      this.hud.setSpill(null);
      this.hud.toast('HOLD RECOVERED — CLAIM CLOSED', 'stratum');
    } else {
      this.spill.show(st.spill!);
    }
    this.saveNow();
  }

  private saveNow(): void {
    // the sandboxes carve habitats, re-seed stones and empty the hold: never
    // write any of that over a real save, and the 20s autosave would
    if (this.sandbox || this.vaultGallery) return;
    this.state.save(this.terrain, this.ctrl.px, this.ctrl.py, this.looted, this.arrestors.list,
      this.shaftlightField.list, this.depots.list);
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
    const stone = this.glyphStoneNear(this.ctrl.px, this.ctrl.py, 2.5);
    if (target >= 0) {
      const w = this.terrain.wrecks[target];
      side = Math.sign(w.x + 0.5 - this.ctrl.px) || 1;
    } else if (this.ctrl.coreNear || this.ctrl.coreRevisit) {
      side = Math.sign(this.ember.x - this.ctrl.px) || 1;
    } else if (stone) {
      side = Math.sign(stone.x + 0.5 - this.ctrl.px) || 1;
    }
    // step clear of the boarding radius, or E would put you straight back in
    // — but never into the hulk itself, now that a dead pod holds its tile
    let out = side * 1.35;
    const foot = (dx: number) => this.terrain.wreckAt(
      Math.floor(this.ctrl.px + dx), Math.floor(-(this.ctrl.py - 0.1))) >= 0;
    if (foot(out)) out = side * 0.9;
    if (foot(out)) out = -side * 1.35;
    this.pilot.spawnAt(this.ctrl.px + out, this.ctrl.py - 0.1);
    this.salvaging = null;
    this.mode = 'eva';
    // the core walk is the Communion: HUD, clocks and Dispatch all step
    // aside for the rite — nothing on the radio belongs in this room
    if (this.ctrl.coreNear) {
      this.finale.begin();
      this.hud.hide();
      this.hud.setPrompt(null);
      this.comms.clear();
      this.hud.toast('THE AIR IS WARM — THE SUIT STOPS COUNTING');
      return;
    }
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
    // boarding the pod mid-walk stands the rite down and restores the HUD.
    // Only the Communion can be abandoned this way — an unmaking in progress
    // owns the screen until it is done with it.
    if (this.finale.isCommunion && !this.finale.finished) {
      this.finale.abort();
      this.hud.show();
    }
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
  /**
   * Every discrete thing a player can ask for. The keyboard and the pad both
   * come through here, so a binding only ever has to be written once — and
   * the guards (a panel is up, you are not in the right mode) live with the
   * action instead of with whichever device happened to trigger it.
   */
  private act(a: Action, repeat = false): void {
    switch (a) {
      case 'interact':
        if (!repeat) this.onInteract();
        break;
      case 'escape': this.onEscape(); break;
      case 'lance': this.fireLance(); break;
      case 'dash':
        if (this.panels.isOpen) break;
        if (this.mode === 'play') this.ctrl.dash();
        else if (this.mode === 'vault' && !repeat) this.vault?.dash(this.input());
        break;
      case 'warpsell': this.warpSell(); break;
      case 'flare': this.throwFlare(); break;
      case 'charge': this.placeCharge(); break;
      case 'arrestor': this.toggleArrestor(); break;
      case 'shaftlight': this.placeShaftlight(); break;
      case 'depot': this.placeDepot(); break;
      case 'lamp':
        // inside a vault the lamp key RAISES the lamp — toward one of the
        // guild's dead it buys a line of their voice (SPEC-VAULTS-2 §VI)
        if (this.mode === 'vault') { this.vault?.raiseLamp(); break; }
        if (this.mode !== 'play' && this.mode !== 'eva') break;
        this.lampOn = !this.lampOn;
        this.audio.click();
        this.hud.setLamp(this.lampOn);
        if (!this.lampOn) this.hud.toast('RUNNING DARK');
        break;
      case 'map': this.toggleMap(); break;
      case 'zoomin':
      case 'zoomout':
        if (!this.map.visible) break;
        this.map.zoomBy(a === 'zoomin' ? 1 : -1);
        this.audio.click();
        break;
      case 'recall':
        if (this.mode !== 'eva' || this.salvaging || this.panels.isOpen || this.finale.cinematic) break;
        if (this.finale.isCommunion) {
          this.finale.abort();
          this.hud.show();
        }
        this.coreActKind = null;
        this.coreHold = 0;
        this.exitEva();
        this.hud.toast('RECALLED TO THE POD');
        break;
      case 'mute':
        if (this.audio.ready) {
          this.hud.toast(this.audio.toggleMute() ? 'SOUND OFF' : 'SOUND ON');
        }
        break;
    }
  }

  private bindInput(): void {
    const map: Record<string, keyof Input> = {
      ArrowLeft: 'left', KeyA: 'left',
      ArrowRight: 'right', KeyD: 'right',
      ArrowUp: 'up', KeyW: 'up', Space: 'up',
      ArrowDown: 'down', KeyS: 'down',
    };
    const acts: Record<string, Action> = {
      KeyE: 'interact', Escape: 'escape', KeyX: 'lance',
      ShiftLeft: 'dash', ShiftRight: 'dash',
      KeyC: 'warpsell', KeyQ: 'flare', KeyG: 'charge', KeyB: 'arrestor',
      KeyL: 'shaftlight', KeyN: 'depot', KeyF: 'lamp',
      Tab: 'map', KeyR: 'recall', KeyM: 'mute',
      Equal: 'zoomin', NumpadAdd: 'zoomin',
      Minus: 'zoomout', NumpadSubtract: 'zoomout',
    };
    addEventListener('keydown', e => {
      // the keyboard spoke: the prompts go back to key caps
      this.padPrompt(false);
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
        // vault jumping is edge-triggered and buffered, Celeste-school
        if (this.mode === 'vault' && map[e.code] === 'up' && !e.repeat) this.vault?.jumpPress();
      }
      if (e.code === 'KeyE') this.keyEHeld = true;
      if (e.code === 'Tab') e.preventDefault();
      if (this.map.visible && ['Equal', 'NumpadAdd', 'Minus', 'NumpadSubtract'].includes(e.code)) {
        e.preventDefault();
      }
      const a = acts[e.code];
      if (a !== undefined) this.act(a, e.repeat);

      if (this.sandbox && this.staging && (e.code === 'BracketLeft' || e.code === 'BracketRight')) {
        const d = e.code === 'BracketRight' ? 1 : -1;
        this.devStage((this.staging.i + d + STAGES.length) % STAGES.length);
      }
      if (this.sandbox && this.staging && e.code === 'Backslash') this.devStage(this.staging.i);
      if (this.sandbox && e.code === 'KeyH') this.sandbox.card.toggle();
      // gallery: [ ] hop the pilot from stone to stone instead of walking
      if (this.vaultGallery && this.mode === 'eva' && (e.code === 'BracketLeft' || e.code === 'BracketRight')) {
        const stones = this.terrain.glyphStones;
        const cur = stones.findIndex(s => Math.abs(this.pilot.px - (s.x + 0.5)) < 2.5);
        const d = e.code === 'BracketRight' ? 1 : -1;
        const next = stones[((cur < 0 ? (d > 0 ? -1 : 0) : cur) + d + stones.length) % stones.length];
        this.pilot.px = next.x + 0.5;
        this.pilot.py = -next.y + 0.6;
        this.audio.click();
      }
    });
    addEventListener('keyup', e => {
      if (map[e.code] !== undefined) {
        this.keys.delete(map[e.code]);
        if (this.mode === 'vault' && map[e.code] === 'up') this.vault?.jumpRelease();
      }
      if (e.code === 'KeyE') this.keyEHeld = false;
    });
    addEventListener('pointermove', e => {
      this.mouseX = (e.clientX / innerWidth - 0.5) * 2;
      this.mouseY = -(e.clientY / innerHeight - 0.5) * 2;
    });
    addEventListener('blur', () => {
      this.keys.clear();
      this.keyEHeld = false;
      this.pad.clear();
    });
    this.pad.onConnect = on => {
      this.hud.toast(on ? 'CONTROLLER CONNECTED' : 'CONTROLLER DISCONNECTED');
      if (!on) this.padPrompt(false);
    };
  }

  /** which DOM tree the pad's focus ring should be walking, if any */
  private menuRoot(): HTMLElement | null {
    if (this.panels.isOpen) return this.ui.querySelector('.panel-scrim');
    if (this.mode === 'title' && this.title) return this.title.el;
    return null;
  }

  /** the controls changed hands: re-stamp the glyphs already on screen */
  private padPrompt(on: boolean): void {
    if (on) this.pad.active = true;
    else this.pad.yield();
    if (on === this.padPrompts) return;
    this.padPrompts = on;
    PROMPTS.pad = on;
    this.hud.setLamp(this.lampOn);
    this.hud.setConsumables(this.state.flares, this.state.charges, this.state.arrestors);
    // the title screen is built once, long before anyone picks up a pad
    const hint = this.ui.querySelector('#title .controls-hint');
    if (hint) hint.innerHTML = glyphs(CONTROLS_HINT);
  }

  /**
   * The pad's turn, once a frame, before anything reads an Input. Modal
   * screens come first — a pad that can fly but cannot buy fuel is not
   * support — and only then does the world get the sticks.
   */
  private padFrame(dt: number): void {
    const p = this.pad;
    p.poll(dt);
    this.padPrompt(p.active);
    if (!p.connected) {
      this.padDir = { left: false, right: false, up: false, down: false };
      this.padEHeld = false;
      this.nav.blur();
      return;
    }

    // the chart is its own screen, and it already speaks in key codes
    if (this.mode === 'starmap' && this.starmap) {
      this.padDir = { left: false, right: false, up: false, down: false };
      if (p.repeated('left')) this.starmap.handleKey('ArrowLeft');
      if (p.repeated('right')) this.starmap.handleKey('ArrowRight');
      if (p.pressed('a') || p.pressed('x')) this.starmap.handleKey('KeyE');
      if (p.pressed('b') || p.pressed('start')) this.starmap.handleKey('Escape');
      return;
    }

    // a panel or the title screen: the pad walks a focus ring instead
    const menu = this.menuRoot();
    if (menu) {
      this.padDir = { left: false, right: false, up: false, down: false };
      this.padEHeld = false;
      this.padUpWas = false;
      this.nav.sync(menu);
      if (p.repeated('up')) this.nav.move(menu, -1);
      if (p.repeated('down')) this.nav.move(menu, 1);
      if (p.repeated('left')) this.nav.adjust(menu, -1);
      if (p.repeated('right')) this.nav.adjust(menu, 1);
      if (p.pressed('a')) this.nav.activate();
      if (p.pressed('x')) this.act('interact');
      if (p.pressed('b') || p.pressed('start')) this.act('escape');
      return;
    }
    this.nav.blur();

    // thrust: the stick, plus A and the right trigger for the hands that
    // expect a lander to climb on a button. Movement is settled before the
    // buttons fire, so a dash reads the direction you are holding now.
    const kit = p.down('lt');
    const dir = p.dir;
    const up = dir.up || p.down('rt') || (!kit && p.down('a'));
    this.padDir = { left: dir.left, right: dir.right, up, down: dir.down };
    if (this.mode === 'vault') {
      if (up && !this.padUpWas) this.vault?.jumpPress();
      else if (!up && this.padUpWas) this.vault?.jumpRelease();
    }
    this.padUpWas = up;

    // hold LT and the face buttons become the kit: everything you throw,
    // place or plant on one modifier, instead of five scattered letters
    if (kit) {
      if (p.pressed('x')) this.act('flare');
      if (p.pressed('a')) this.act('charge');
      if (p.pressed('b')) this.act('arrestor');
      if (p.pressed('y')) this.act('shaftlight');
      if (p.pressed('rb')) this.act('depot');
    } else {
      if (p.pressed('x')) this.act('interact');
      if (p.pressed('b')) this.act('recall');
      if (p.pressed('y')) this.act('lamp');
      if (p.pressed('rb')) this.act('lance');
    }
    if (p.pressed('lb')) this.act('dash');
    if (p.pressed('back')) this.act('map');
    if (p.pressed('l3')) this.act('warpsell');
    if (p.pressed('r3')) this.act('mute');
    if (p.pressed('start')) this.act('escape');
    this.padEHeld = !kit && p.down('x');

    // right stick zooms the survey map — both sticks are free while it is up
    this.padZoomCd = Math.max(0, this.padZoomCd - dt);
    if (this.map.visible && this.padZoomCd === 0 && Math.abs(p.ry) > 0.6) {
      this.act(p.ry < 0 ? 'zoomin' : 'zoomout');
      this.padZoomCd = 0.22;
    }
  }

  /** push preference changes into the systems that read them */
  private applySettings(): void {
    const s = this.settings;
    this.audio.setVolumes(s.master, s.sfx, s.music, s.voiceDispatch, s.voiceLamplighters);
    this.cam.reducedMotion = this.reducedMotion || !s.shake;
    this.pad.rumbleOn = s.rumble && !this.reducedMotion;
    this.hud.setFps(s.showFps ? 0 : null);
    if (this.threats) this.threats.level = this.faunaDead ? 'off' : s.threats;
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

  /** L — hang a shaftlight where the pod sits. Permanent: light, kept. */
  private placeShaftlight(): void {
    if (this.mode !== 'play' || this.panels.isOpen) return;
    if (this.state.shaftlights <= 0) {
      this.hud.toast('NO SHAFTLIGHT KITS — BUY AT THE FUEL DEPOT');
      this.audio.denied();
      return;
    }
    if (this.ctrl.py > -1) { this.hud.toast('THE SURFACE HAS A SKY — SAVE IT FOR THE DARK'); this.audio.denied(); return; }
    if (!this.shaftlightField.place(this.ctrl.px, this.ctrl.py)) {
      this.hud.toast('NO ROOM — A LIGHT ALREADY HANGS HERE');
      this.audio.denied();
      return;
    }
    this.state.shaftlights--;
    this.audio.buy();
    this.hud.toast('SHAFTLIGHT HUNG — IT STAYS');
    this.saveNow();
  }

  /** N — plant a waystation depot. Two per site; every refill is metered. */
  private placeDepot(): void {
    if (this.mode !== 'play' || this.panels.isOpen) return;
    if (this.state.depotKits <= 0) {
      this.hud.toast('NO WAYSTATION KIT — BUY AT THE FUEL DEPOT');
      this.audio.denied();
      return;
    }
    if (!this.ctrl.grounded) { this.hud.toast('LAND FIRST TO PLANT IT'); this.audio.denied(); return; }
    if (this.ctrl.py > -1) { this.hud.toast('THE SURFACE ALREADY HAS ONE — IT IS CALLED THE FUEL DEPOT'); this.audio.denied(); return; }
    if (this.arrestors.blocked(this.ctrl.px, this.ctrl.py - 0.45, this.terrain.wrecks)) {
      this.hud.toast('BLOCKED — SOMETHING ALREADY LIES HERE');
      this.audio.denied();
      return;
    }
    if (!this.depots.place(this.ctrl.px, this.ctrl.py)) {
      this.hud.toast('TWO PER SITE — CINDRAL LOGISTICS WILL NOT STRETCH FURTHER');
      this.audio.denied();
      return;
    }
    this.state.depotKits--;
    this.audio.buy();
    this.hud.toast('WAYSTATION PLANTED — E TO USE IT', 'stratum');
    this.saveNow();
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
    if (this.finale?.cinematic) {
      this.finale.skip();
      return;
    }
    if (this.panels.isOpen) {
      const shop = ['fuel', 'trade', 'garage', 'assay', 'ledger', 'wardrobe', 'catalog', 'faunalog', 'depot']
        .includes(this.panels.current ?? '');
      if (shop) { this.audio.click(); this.panels.close(); }
      return;
    }
    if (this.mode === 'vault') {
      this.vault?.interact();
      return;
    }
    if (this.mode === 'interior') {
      this.interior?.interact();
      return;
    }
    if (this.mode === 'eva') {
      if (this.salvaging) return;
      // at a cradle the E key is a HOLD, managed per-frame — not a press
      if (this.coreActKind) return;
      // standing at a carved stone: the mark has to finish igniting first —
      // the wake is the door opening, and E before it is done knocks on stone
      const stone = this.glyphStoneNear(this.pilot.px, this.pilot.py, 1.1);
      if (stone) {
        if (this.glyphMarks.chargeOf(stone.id) >= 1) this.enterVault(stone.id);
        return;
      }
      // SITE 297: the readables are the whole errand
      if (ACTIVE.husk) {
        const i = HUSK_READABLES.findIndex((r, idx) =>
          !this.state.huskRead.has(idx) && Math.abs(this.pilot.px - r.x) < 1.2);
        if (i >= 0) {
          this.state.huskRead.add(i);
          this.comms.say(HUSK_READABLES[i].lines);
          this.audio.glyph();
          if (this.state.huskRead.size >= HUSK_READABLES.length && !this.state.huskVisited) {
            this.state.huskVisited = true;
          }
          this.saveNow();
          return;
        }
      }
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
    // SITE 297: the buildings are offline, the dish still points at the sky,
    // and anywhere you can land you can walk
    if (ACTIVE.husk) {
      if (this.ctrl.dock) {
        if (this.ctrl.dock.key === 'assay') {
          this.audio.click();
          this.openStarmap();
        } else {
          this.hud.toast('OFFLINE — NO ONE IS HOME');
          this.audio.denied();
        }
        return;
      }
      if (this.ctrl.grounded) this.enterEva();
      return;
    }
    if (this.ctrl.coreNear || this.ctrl.coreRevisit || this.ctrl.wreckNear >= 0) {
      this.enterEva();
      return;
    }
    // parked on a carved stone: step out to read it in person
    if (this.ctrl.grounded && this.glyphStoneNear(this.ctrl.px, this.ctrl.py, 2.5)) {
      this.enterEva();
      return;
    }
    // parked at a waystation you planted: the pump takes E like a dock does
    if (this.ctrl.grounded && this.depots.at(this.ctrl.px, this.ctrl.py) >= 0) {
      this.audio.click();
      this.panels.open('depot');
      return;
    }
    if (this.ctrl.dock) {
      this.audio.click();
      if (this.ctrl.dock.key === 'quarters') this.enterInterior();
      else this.panels.open(this.ctrl.dock.key);
    }
  }

  /**
   * Cells a body of ours is standing in. A settling hulk treats these as
   * support: undermine one over the pod and it comes to rest on the hull
   * rather than dropping through it.
   */
  private bodyOccupies(x: number, y: number): boolean {
    const inBox = (px: number, py: number, hw: number, hh: number) =>
      x >= Math.floor(px - hw + 0.001) && x <= Math.floor(px + hw - 0.001) &&
      y >= Math.floor(-(py + hh - 0.001)) && y <= Math.floor(-(py - hh + 0.001));
    if (this.ctrl && inBox(this.ctrl.px, this.ctrl.py, POD_W / 2, POD_H / 2)) return true;
    if (this.mode === 'eva' && inBox(this.pilot.px, this.pilot.py, 0.15, 0.26)) return true;
    return false;
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
    if (this.finale?.cinematic) {
      this.finale.skip();
      return;
    }
    if (this.mode === 'vault' && this.vault) {
      this.vault.abandon();
      return;
    }
    if (this.mode === 'interior' && this.interior) {
      if (this.panels.isOpen) { this.audio.click(); this.panels.close(); return; }
      this.interior.abandon();
      return;
    }
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

  /** held on either device: the cradle hold reads this, and only this */
  private get eHeld(): boolean { return this.keyEHeld || this.padEHeld; }

  private input(): Input {
    const d = this.padDir;
    return {
      left: this.keys.has('left') || d.left,
      right: this.keys.has('right') || d.right,
      up: this.keys.has('up') || d.up,
      down: this.keys.has('down') || d.down,
    };
  }

  // ---------- frame ----------
  private frame(): void {
    // always drain the clock, or the first frame after unpausing gets a
    // delta the size of however long the panel was open
    const raw = this.clock.getDelta();

    // the pad is polled, not pushed — before anything reads an Input
    this.padFrame(Math.min(0.05, raw));

    // the starmap is its own scene, camera and clock — the world sleeps
    if (this.mode === 'starmap' && this.starmap) {
      this.starmap.frame(Math.min(0.05, raw));
      this.starmap?.render(this.renderer);
      return;
    }

    // inside a stone: the world outside is frozen, the suit stops counting
    if (this.mode === 'vault' && this.vault) {
      this.vault.frame(Math.min(0.05, raw), this.input(), this.lampOn);
      this.vault.render(this.renderer);
      if (this.vault.closed) this.closeVault();
      return;
    }

    // home: the world waits outside; a panel over the room pauses the walk
    if (this.mode === 'interior' && this.interior) {
      this.interior.frame(Math.min(0.05, raw), this.input(), this.panels.isOpen);
      this.interior.render(this.renderer);
      if (this.interior.closed) this.closeInterior();
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

    const waking = this.mode === 'eva' && !this.finale.isCommunion
      ? this.glyphStoneNear(this.pilot.px, this.pilot.py, 1.1) : null;
    if (this.glyphMarks.update(this.time, dt, waking?.id ?? null)) this.audio.glyph();

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

    // The claim burns on foot as well as in the seat — but not inside a
    // stone, an interior or the chart, which never reach this line. It runs
    // on raw time, not the simulation's capped step: the panel promises five
    // real minutes, and a slow frame must not quietly hand out six. Capped
    // loosely so an alt-tab does not void a claim in one frame.
    if (this.mode === 'play' || this.mode === 'eva') this.tickSpill(Math.min(0.25, raw));

    // the unmaking and the ending pages run outside EVA, so they are driven
    // here — and they own the screen until the player says otherwise
    if (this.finale.phase === 'unmake' || this.finale.phase === 'page') {
      this.finale.advance(dt, this.pilot.px, this.pilot.py);
      if (this.finale.finished) this.finishCinematic();
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
    this.wrecks.update(this.time, dt, (x, y) => this.bodyOccupies(x, y));
    const camRow = Math.floor(-this.cam.camera.position.y);
    this.ember.update(this.time, camRow);
    this.finale.frame(dt, this.time, camRow);
    if (this.staging) this.tickSandbox(dt);
    this.renderer.render(this.scene, this.cam.camera);
  }

  private playFrame(dt: number): void {
    const paused = this.panels.isOpen;
    const st = this.state;

    // tell the controller whether a pad is in position to take this fall
    this.ctrl.arrestorCatch = this.arrestors.catchFall(this.ctrl.px, this.ctrl.py, this.ctrl.vy);
    // a shaft dug out from under a pad takes the pad with it, back into the hold
    const loose = this.arrestors.settle((x, y) => this.terrain.solidAt(x, y));
    if (loose > 0) {
      this.state.arrestors += loose;
      this.hud.toast(loose > 1 ? `${loose} ARRESTORS RECOVERED — NOTHING LEFT TO BOLT TO` : 'ARRESTOR RECOVERED — NOTHING LEFT TO BOLT TO');
      this.hud.setConsumables(this.state.flares, this.state.charges, this.state.arrestors);
      this.audio.click();
      this.saveNow();
    }
    this.arrestors.update(this.time);
    this.shaftlightField.update(this.ctrl.px, this.ctrl.py, this.time);

    if (!paused && dt > 0) {
      this.ctrl.update(dt, this.input(), this.time);

      if (this.ctrl.thrust > 0 && Math.random() < 0.4) {
        this.particles.thrusterPuff(this.ctrl.px, this.ctrl.py - 0.6, flameStyle(this.meta.flame).inner);
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

    // contextual prompt: dock < wreck < core walk < the second pilgrimage
    if (!paused) {
      if (this.ctrl.coreNear) {
        this.hud.setPrompt(`<span class="key">E</span>EVA — WALK TO ${ACTIVE.coreName}`);
      } else if (this.ctrl.coreRevisit) {
        const st = this.state;
        const label = st.carrying === ACTIVE.id
          ? `EVA — CARRY ${ACTIVE.coreName} HOME`
          : st.carrying && ACTIVE.id === 'veil3'
            ? 'EVA — THE ASSEMBLY'
            : `EVA — ORDER 9-1-1 · ${ACTIVE.coreName}`;
        this.hud.setPrompt(`<span class="key">E</span>${label}`);
      } else if (this.ctrl.wreckNear >= 0) {
        const m = Math.round(this.ctrl.wreckDist * TILE_M);
        this.hud.setPrompt(`<span class="key">E</span>EVA — WRECKED POD · ${m}m`);
      } else if (this.ctrl.dock) {
        this.hud.setPrompt(ACTIVE.husk
          ? `<span class="key">E</span>${this.ctrl.dock.key === 'assay' ? 'THE SUNDERING CHART' : this.ctrl.dock.label + ' — OFFLINE'}`
          : `<span class="key">E</span>${this.ctrl.dock.label}`);
      } else if (this.ctrl.grounded && this.depots.at(this.ctrl.px, this.ctrl.py) >= 0) {
        this.hud.setPrompt(`<span class="key">E</span>WAYSTATION`);
      } else if (ACTIVE.husk && this.ctrl.grounded) {
        this.hud.setPrompt(`<span class="key">E</span>EVA — WALK THE COLONY`);
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
        vx: this.ctrl.vx, vy: this.ctrl.vy,
        // heat is the whole engine, not just the main nozzle — flying
        // sideways past a wyrm pool reads as thrust too
        lampOn: this.lampOn, thrust: Math.max(this.ctrl.thrust, Math.abs(this.ctrl.sideThrust) * 0.8),
        drilling: this.ctrl.drilling !== null, grounded: this.ctrl.grounded,
        still: this.ctrl.still,
        carrying: !!this.state.carrying, dt, time: this.time,
        hurt: (a, c) => this.ctrl.hurtFromThreat(a, c),
        drain: a => { st.fuel = Math.max(0, st.fuel - a); },
        push: (dx, dy) => { this.ctrl.vx += dx; this.ctrl.vy += dy; },
        hold: s => { this.ctrl.held = Math.max(this.ctrl.held, s); },
        native: n => {
          for (let i = 0; i < n; i++) st.addNative();
          const nat = ACTIVE.native;
          this.cam.screenPos(this.ctrl.px, this.ctrl.py + 0.6, this.screen);
          this.hud.popup(`+${n} ${nat?.ore ?? 'DEPOSIT'}`, '#' + (nat?.color ?? 0xcfe8ff).toString(16).padStart(6, '0'), this.screen.sx, this.screen.sy);
          this.audio.chime(2);
        },
        steal: () => st.stealCargo(),
        give: t => {
          if (st.addCargo(t)) {
            this.cam.screenPos(this.ctrl.px, this.ctrl.py + 0.6, this.screen);
            this.hud.popup('RECOVERED', '#' + def(t).gem.toString(16).padStart(6, '0'), this.screen.sx, this.screen.sy);
            this.audio.chime(def(t).oreTier);
          }
        },
        shake: a => this.cam.addShake(a),
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
        onEvent: (id, x, y) => this.onFaunaEvent(id, x, y),
      });

      // the big ones announce themselves through the rock before you see them
      if (this.threats.rumble > 0.12) {
        this.rumbleAcc -= dt;
        if (this.rumbleAcc <= 0) {
          this.rumbleAcc = 1.1 - this.threats.rumble * 0.6;
          this.audio.rumbleTick();
          this.cam.addShake(this.threats.rumble * 0.12);
        }
      }
      // something unlit is walking at you: your own pulse, getting faster
      if (this.threats.dread > 0.1) {
        this.dreadAcc -= dt;
        if (this.dreadAcc <= 0) {
          this.dreadAcc = 1.3 - this.threats.dread * 0.85;
          this.audio.heartbeat(this.threats.dread);
        }
      }
      // the chamber has residents of its own
      const kh = this.threats.updateChamber(dt, this.time, this.ctrl.px, this.ctrl.py, false, false, (id, x, y) => this.onFaunaEvent(id, x, y));
      if (kh === 'pod') {
        // they are not hostile — the touch throws you clear, nothing more.
        // The hull is never theirs to bite; only a suit's air interests them.
        this.ctrl.vy += 9;
        this.ctrl.vx = (this.ctrl.px >= this.threats.kindled.touchX ? 1 : -1) * 6;
        this.hud.overexpose();
        this.audio.kindledTouch();
        this.cam.addShake(0.5);
        this.onFaunaEvent('kindled-touch', this.ctrl.px, this.ctrl.py);
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
        const spark = sparkStyle(this.meta.spark);
        this.particles.drillSpray(d.x + 0.5, -(d.y + 0.5),
          spark ? spark.color : rockColor(this.terrain.get(d.x, d.y), d.x, d.y));
      }
      this.cam.addShake(0.05);
    }

    // the climb: a carried fragment kills the veinlight around it, shakes
    // rubble into the tunnels below, and drains the world's color behind you
    if (!paused && dt > 0 && st.carrying) {
      this.cam.addShake(0.012);
      this.veinKillAcc += dt;
      if (this.veinKillAcc > 0.5) {
        this.veinKillAcc = 0;
        const cx = Math.floor(this.ctrl.px), cy = Math.floor(-this.ctrl.py);
        for (let dy = -6; dy <= 6; dy++) {
          for (let dx = -6; dx <= 6; dx++) {
            if (dx * dx + dy * dy > 36) continue;
            const tx = cx + dx, ty = cy + dy;
            if (tx < 0 || tx >= this.terrain.w || ty < 1 || ty >= this.terrain.h) continue;
            if (this.terrain.get(tx, ty) === T.FUNGUS) this.terrain.carve(tx, ty);
          }
        }
      }
      this.quakeAcc -= dt;
      if (this.quakeAcc <= 0) {
        this.quakeAcc = 5 + Math.random() * 3;
        this.cam.addShake(0.25);
        this.audio.rumbleTick();
        // shed rubble into open tunnels BELOW the pod — never ahead of the climb
        const cy = Math.floor(-this.ctrl.py);
        for (let n = 0; n < 3; n++) {
          const tx = Math.floor(this.ctrl.px) + Math.floor((Math.random() - 0.5) * 16);
          const ty = cy + 6 + Math.floor(Math.random() * 12);
          if (tx < 1 || tx >= this.terrain.w - 1 || ty >= this.terrain.h) continue;
          if (this.terrain.get(tx, ty) === T.AIR) {
            this.terrain.data[this.terrain.idx(tx, ty)] = T.RUBBLE;
            this.terrain.dug.delete(this.terrain.idx(tx, ty));
            this.chunks.markDirty(tx, ty);
          }
        }
      }
    }
    this.atmosphere.drain = st.carrying
      ? Math.max(0, 1 - Math.max(0, this.ctrl.row) / CORE_ROW) * 0.7
      : 0;
    this.atmosphere.update(this.ctrl.row - (this.ctrl.py > -2 ? 6 : 0));
    if (!paused && dt > 0) this.refreezeTick(dt);

    const dr = this.ctrl.drilling;
    this.audio.update(dt, {
      thrust: this.ctrl.thrust,
      drilling: dr !== null,
      hardness: dr ? dr.hardness : 1,
      row: this.ctrl.row,
      lowFuel: !paused && st.fuel / st.maxFuel < LOW_FUEL_FRAC && st.fuel > 0,
      menace: this.threats.menace,
      dead: !!ACTIVE.husk, // SITE 297 is the first world without music
    });

    this.hud.update(st, this.ctrl.depthM, this.ctrl.row, this.ctrl.heatFrac, Math.max(dt, 0.001));
    this.map.refresh(this.terrain, this.ctrl.px, this.ctrl.py, this.time,
      this.state.worldBestRow, this.state.hasDeepArray, this.arrestors.list,
      this.state.hasBeacons ? this.terrain.wrecks.filter((_, i) => !this.looted.has(i)) : [],
      this.state.spill?.world === this.state.activeWorld ? this.state.spill : null);

    if (!paused && dt > 0) st.playTime += dt;
    this.updateContractHud();
  }

  /** evaluate narrative triggers and hand the winner to Dispatch */
  private pumpNarrative(dt: number): void {
    this.comms.update(dt);
    this.hud.pushContract(this.comms.busy);
    if (this.comms.busy || this.mode === 'title') return;
    if (this.finale.active) return; // Dispatch stays quiet through the rite

    const st = this.state;
    // stipend letters: the Ledger's only return, arriving at their own pace
    for (const [need, id] of [[1, 'stipend-1'], [3, 'stipend-2'], [6, 'stipend-3'], [10, 'stipend-4']] as const) {
      if (st.stipends >= need && !st.firedEvents.has(id)) {
        this.teach(id);
        return;
      }
    }
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
      huskVisited: st.huskVisited,
      carryingNow: st.carrying !== null,
      reseatedAny: st.reseated.size > 0,
    };
    const e = pickNarrative(stats, st.firedEvents);
    if (e) {
      st.firedEvents.add(e.id);
      this.comms.say(e.lines);
      // the order, once heard, is posted at the trade post forever
      if (e.id === 'extraction-order') st.extractOrderHeard = true;
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

  /**
   * The refreeze (CRYOS-2): dug tiles below the hazard line skin over into
   * young ice once you leave them behind. The working pocket around the pod
   * (and the pilot) stays thawed; acclimation keeps your wake warm longer —
   * the job hull upgrades cannot do. Rime is rammable from below by any pod,
   * so the shaft home is never a wall, only a bill.
   */
  private refreezeTick(dt: number): void {
    if (!ACTIVE.refreeze) return;
    this.rimeAcc += dt;
    if (this.rimeAcc < 0.5) return;
    const step = this.rimeAcc;
    this.rimeAcc = 0;
    const freezeAfter = RIME_FREEZE_BASE + this.state.acclTier * RIME_FREEZE_PER_TIER;
    const startRow = ACTIVE.hazardStartRow;
    const w = this.terrain.w;
    const px = Math.floor(this.ctrl.px), py = Math.floor(-this.ctrl.py);
    const ex = this.mode === 'eva' ? Math.floor(this.pilot.px) : px;
    const ey = this.mode === 'eva' ? Math.floor(-this.pilot.py) : py;
    let froze = false;
    for (const i of this.terrain.dug) {
      const y = Math.floor(i / w);
      if (y < startRow) continue;
      if (this.terrain.data[i] !== T.AIR) { this.rimeAge.delete(i); continue; }
      const x = i % w;
      const dPod = Math.max(Math.abs(x - px), Math.abs(y - py));
      const dPilot = Math.max(Math.abs(x - ex), Math.abs(y - ey));
      if (Math.min(dPod, dPilot) <= RIME_KEEP_CLEAR) {
        this.rimeAge.delete(i); // the pod's warmth keeps the pocket open
        continue;
      }
      const age = (this.rimeAge.get(i) ?? 0) + step;
      if (age >= freezeAfter) {
        this.rimeAge.delete(i);
        this.terrain.data[i] = T.RIME;
        this.chunks.markDirty(x, y);
        froze = true;
      } else {
        this.rimeAge.set(i, age);
      }
    }
    if (froze && !this.state.firedEvents.has('rime-taught')) {
      this.state.firedEvents.add('rime-taught');
      // lines live in the transmission registry so the transcript can replay them
      this.comms.say(ADHOC_TRANSMISSIONS['rime-taught'].lines);
      this.state.persist();
    }
  }

  // ---------- Phase 3: the fauna talk back ----------

  /** Dispatch explains a creature once, the first time it shows itself */
  private teach(id: string): void {
    if (this.state.firedEvents.has(id) || !ADHOC_TRANSMISSIONS[id]) return;
    this.state.firedEvents.add(id);
    this.comms.say(ADHOC_TRANSMISSIONS[id].lines);
    this.state.persist();
  }

  /** a sound that must not machine-gun: one per id per `gap` seconds */
  private faunaSfx(id: string, gap: number, play: () => void): void {
    if (this.time - (this.faunaSfxAt.get(id) ?? -9) < gap) return;
    this.faunaSfxAt.set(id, this.time);
    play();
  }

  /**
   * Every creature reports what it did through here. Toasts, sounds, camera
   * and the one-time Dispatch line all hang off the event, so the creature
   * modules stay about the creature.
   */
  private onFaunaEvent(id: FaunaEvent, x = this.ctrl.px, y = this.ctrl.py): void {
    // every encounter stamps the fauna log — the assay office keeps a census
    const credit = faunaForEvent(id);
    if (credit) this.state.firedEvents.add(`fauna:${credit}`);
    const near = Math.hypot(x - this.ctrl.px, y - this.ctrl.py);
    const vol = Math.max(0.15, 1 - near / 18);
    switch (id) {
      case 'longone-emerge':
        this.faunaSfx(id, 2, () => this.audio.wormEmerge(vol));
        this.hud.toast('— IT HEARD THE DRILL —', 'stratum');
        this.teach('longone-taught');
        break;
      case 'longone-bite':
        this.audio.wormBite();
        this.hud.damageFlash();
        break;
      case 'longone-lost':
        this.hud.toast('IT LOST YOU. STAY QUIET.');
        break;
      case 'rimewing-wake':
        this.faunaSfx(id, 3, () => this.audio.swarmAlert());
        this.teach('rimewing-taught');
        break;
      case 'rimewing-freeze':
        this.faunaSfx(id, 1.5, () => this.audio.iceCrack());
        break;
      case 'polyp-seen':
        this.teach('polyp-taught');
        break;
      case 'polyp-burst':
        this.faunaSfx(id, 0.4, () => this.audio.polypBurst(vol));
        break;
      case 'brinewyrm-churn':
        this.faunaSfx(id, 3, () => this.audio.gurgle(vol));
        this.hud.toast('THE BRINE IS CHURNING');
        this.teach('brinewyrm-taught');
        break;
      case 'brinewyrm-breach':
        this.audio.wormEmerge(1);
        this.hud.toast('— BREACH —', 'stratum');
        break;
      case 'brinewyrm-bite':
        this.audio.wormBite();
        this.hud.damageFlash();
        break;
      case 'stillwalker-seen':
        this.hud.toast('— SOMETHING IN THE WALL — KEEP IT LIT —', 'stratum');
        this.audio.stillwalkerSeen();
        this.teach('stillwalker-taught');
        break;
      case 'stillwalker-grab':
        this.audio.stillwalkerGrab();
        this.hud.overexpose(0.35);
        this.hud.toast('IT HAD YOU FOR A SECOND');
        this.teach('stillwalker-taught');
        break;
      case 'frostbloom':
        this.hud.toast('FROSTBLOOM — THE POCKET IS SEALING');
        this.teach('frostbloom-taught');
        break;
      case 'riptide-enter':
        this.faunaSfx(id, 6, () => this.audio.riptidePull());
        this.hud.toast('THE ROOM IS PULLING');
        this.teach('riptide-taught');
        break;
      case 'riptide-eye':
        this.faunaSfx(id, 4, () => this.audio.riptideEye());
        this.hud.toast('— IT IS LOOKING AT YOU —', 'stratum');
        this.cam.addShake(0.12);
        break;
      case 'shellback-seen':
        this.faunaSfx(id, 8, () => this.audio.shellbackChitter(vol));
        this.teach('shellback-taught');
        break;
      case 'shellback-seal':
        this.faunaSfx(id, 1, () => this.audio.shellbackSeal(vol));
        break;
      case 'shellback-killed':
        this.hud.toast('SHELLBACK DOWN — NACRE SHED');
        break;
      case 'mimic-hatch':
        this.audio.mimicHatch();
        this.hud.toast('— IT WAS NOT A GEODE —', 'stratum');
        this.teach('mimic-taught');
        break;
      case 'crab-skitter':
        this.faunaSfx(id, 0.5, () => this.audio.crabSkitter(vol));
        break;
      case 'mimic-escaped':
        this.hud.toast('THE MIMIC GOT AWAY WITH YOUR ORE');
        this.audio.cargoFull();
        break;
      case 'mimic-killed':
        this.audio.chime(3);
        break;
      case 'warden-step':
        this.faunaSfx(id, 0.3, () => this.audio.wardenStep(vol));
        break;
      case 'warden-wake':
        this.audio.wardenWake();
        break;
      case 'warden-flash':
        this.faunaSfx(id, 0.5, () => this.audio.wardenFlash());
        this.hud.overexpose(0.5);
        break;
      case 'warden-blind':
        this.hud.toast('WARDEN BLINDED');
        this.audio.wardenBlind();
        break;
      case 'warden-down':
        this.hud.toast('— WARDEN DOWN —', 'stratum');
        this.audio.explosion();
        break;
      case 'kindled-seen':
        this.hud.toast('— THEY ARE TURNING TO LOOK —', 'stratum');
        this.audio.kindledNotice();
        this.teach('kindled-taught');
        break;
      case 'kindled-touch':
        this.hud.damageFlash();
        break;
    }
  }

  // ---------- Phase 4: the cradle, the climb, the endings ----------

  /** an unmaking or an ending page has run its course */
  private finishCinematic(): void {
    const wasPage = this.finale.phase === 'page';
    this.finale.conclude();
    if (this.mode === 'eva') this.exitEva();
    this.hud.show();
    if (wasPage && this.pendingEnding) {
      this.panels.open('finale', { ending: this.pendingEnding });
      return;
    }
    // extraction: the world is dimmer, the hold is heavy, the way out is up
    this.hud.toast(`${ACTIVE.coreName} IS IN YOUR HOLD — CLIMB`, 'stratum');
    this.saveNow();
  }

  /** the pilot is standing at the fragment's seat on a met world */
  private atCradle(): boolean {
    if (!this.state.endedWorlds.has(ACTIVE.id) || ACTIVE.husk) return false;
    return Math.abs(this.pilot.px - this.ember.x) < 3.6
      && Math.abs(this.pilot.py - this.ember.y) < 5;
  }

  /** what holding E at this cradle would do, or null */
  private cradleAction(): { kind: 'extract' | 'seat' | 'offer'; label: string } | null {
    const st = this.state;
    if (st.carrying === ACTIVE.id && st.extracted.has(ACTIVE.id)) {
      return { kind: 'seat', label: `SEAT ${ACTIVE.coreName}` };
    }
    // the assembly: foreign fragments laid in VEIL-3's cradle
    if (st.carrying && st.carrying !== ACTIVE.id && ACTIVE.id === 'veil3' && !st.extracted.has('veil3')) {
      const w = worldById(st.carrying);
      return { kind: 'offer', label: `LAY ${w?.coreName ?? 'THE FRAGMENT'} IN THE CRADLE` };
    }
    if (!st.carrying && st.extractOrderHeard && !st.extracted.has(ACTIVE.id)) {
      return { kind: 'extract', label: `EXTRACT ${ACTIVE.coreName}` };
    }
    return null;
  }

  /** hold-to-commit at a cradle: release aborts, no penalty */
  private cradleFrame(dt: number): void {
    const act = this.cradleAction();
    if (!act) {
      this.coreActKind = null;
      this.coreHold = 0;
      this.hud.setPrompt(`<span class="key">R</span>BACK TO THE POD`);
      return;
    }
    if (this.eHeld) {
      this.coreActKind = act.kind;
      this.coreHold += dt;
      this.ember.excite = Math.min(1, 0.25 + this.coreHold / EXTRACT_HOLD);
      if (this.coreHold >= EXTRACT_HOLD) {
        this.coreHold = 0;
        this.coreActKind = null;
        this.commitCradle(act.kind);
        return;
      }
    } else {
      this.coreActKind = null;
      this.coreHold = Math.max(0, this.coreHold - dt * 2);
      this.ember.excite = 0.25;
    }
    const pct = Math.round((this.coreHold / EXTRACT_HOLD) * 100);
    this.hud.setPrompt(
      `<span class="key">HOLD E</span>${act.label}` +
      `<span class="hold-bar"><span style="width:${pct}%"></span></span>`
    );
  }

  private commitCradle(kind: 'extract' | 'seat' | 'offer'): void {
    const st = this.state;
    this.snapshotFork();
    if (kind === 'extract') {
      st.carrying = ACTIVE.id;
      st.extracted.add(ACTIVE.id);
      st.cargo.clear(); // the fragment IS the hold
      this.finale.beginUnmake();
      this.hud.hide();
      this.comms.clear();
      this.saveNow();
      return;
    }
    if (kind === 'seat') {
      st.carrying = null;
      st.extracted.delete(ACTIVE.id);
      st.reseated.add(ACTIVE.id);
      this.finale.seatRelight();
      this.audio.finaleTouch();
      this.hud.toast(`${ACTIVE.coreName} IS HOME`, 'stratum');
      // RETURN is the culmination, not a single change of heart: every core
      // met, every fragment back in its own cradle, none sold to Cindral.
      const allMet = WORLDS.every(w => st.endedWorlds.has(w.id));
      const allHome = WORLDS.every(w => !st.extracted.has(w.id) && !st.delivered.has(w.id));
      if (allMet && allHome && st.reseated.size > 0) this.triggerEnding('return');
      this.saveNow();
      return;
    }
    // offer: a foreign fragment laid in VEIL-3's cradle
    const carried = st.carrying!;
    st.offered.add(carried);
    st.carrying = null;
    this.audio.finaleTouch();
    this.finale.seatRelight();
    const need = WORLDS.filter(w => w.id !== 'veil3').map(w => w.id);
    const haveAll = need.every(id => st.offered.has(id));
    if (haveAll && this.kindleReady()) {
      this.triggerEnding('kindle');
    } else {
      const left = need.filter(id => !st.offered.has(id)).length;
      this.hud.toast(left > 0
        ? `LAID IN THE CRADLE — ${left} FRAGMENT${left === 1 ? '' : 'S'} STILL OUT THERE`
        : 'LAID IN THE CRADLE — THE MARKS ARE NOT ALL READ');
    }
    this.saveNow();
  }

  /** the KINDLE gate: every glyph, every log, the full forge */
  private kindleReady(): boolean {
    const st = this.state;
    return st.glyphs >= GLYPHS_TO_TRANSLATE
      && st.foundLogs.size >= WRECK_LOGS.length
      && FORGE.every(f => st.emberTech[f.key]);
  }

  /** sell the fragment in the hold to Cindral — the third one ends the game */
  private deliverFragment(): void {
    const st = this.state;
    if (!st.carrying) return;
    this.snapshotFork();
    const id = st.carrying;
    st.carrying = null;
    st.delivered.add(id);
    st.money += EXTRACT_OFFER;
    st.totalEarned += EXTRACT_OFFER;
    this.cam.screenPos(this.ctrl.px, this.ctrl.py + 0.6, this.screen);
    this.hud.popup('+' + fmtMoney(EXTRACT_OFFER), '#ff9a3c', this.screen.sx, this.screen.sy);
    this.audio.sell(8);
    this.hud.toast('DELIVERED — DEBTS CLEARED', 'stratum');
    this.saveNow();
    if (st.delivered.size >= WORLDS.length) this.triggerEnding('extract');
  }

  /**
   * Photograph the fork BEFORE a fragment action mutates it. The rewind is
   * only meaningful if it restores the moment the player was still choosing,
   * so this must be called first thing in every act that could end the game.
   */
  private snapshotFork(): void {
    const st = this.state;
    this.endingSnapshot = {
      money: st.money, carrying: st.carrying,
      extracted: [...st.extracted], delivered: [...st.delivered],
      reseated: [...st.reseated], offered: [...st.offered],
    };
  }

  /** an ending fires: play its page over the fork already photographed */
  private triggerEnding(kind: EndingKind): void {
    this.pendingEnding = kind;
    if (!this.endingSnapshot) this.snapshotFork();
    GameState.markEnding(kind);
    this.hud.hide();
    this.hud.setPrompt(null);
    this.comms.clear();
    this.audio.finaleBed(0);
    this.audio.ending();
    const page = ENDING_PAGES[kind];
    this.finale.beginPage({
      cls: page.cls, eyebrow: page.eyebrow, title: page.title, lines: page.lines,
    });
    if (this.mode === 'eva') { this.pilot.hide(); this.mode = 'play'; }
    this.saveNow();
  }

  /**
   * CONTINUE after an ending: rewind to the moment before the choice, so one
   * save can stand at the fork and walk every road. The emblem is already
   * stamped outside the save and stays won.
   */
  private endingContinue(): void {
    const snap = this.endingSnapshot;
    const st = this.state;
    if (snap) {
      st.money = snap.money;
      st.carrying = snap.carrying;
      st.extracted = new Set(snap.extracted);
      st.delivered = new Set(snap.delivered);
      st.reseated = new Set(snap.reseated);
      st.offered = new Set(snap.offered);
    }
    this.pendingEnding = null;
    this.endingSnapshot = null;
    this.setupWorld();
    this.ctrl.respawnAtSurface();
    this.cam.snap(this.ctrl.px, 2, 15.5);
    this.hud.show();
    this.mode = 'play';
    this.hud.toast('THE MOMENT BEFORE — THE CHOICE IS STILL YOURS', 'stratum');
    this.saveNow();
  }

  /** X — the Lumen Lance: the only true weapon, and it fires money */
  private fireLance(): void {
    if (this.mode !== 'play' || this.panels.isOpen) return;
    const st = this.state;
    if (!st.emberTech.lance) return;
    if (st.money < LANCE_SHOT_COST) {
      this.hud.toast('NO LUMENS — THE LANCE IS EMPTY');
      this.audio.denied();
      return;
    }
    st.money -= LANCE_SHOT_COST;
    const dir = this.ctrl.facing;
    this.threats.lance(this.ctrl.px, this.ctrl.py, dir, LANCE_RANGE);
    this.audio.lance();
    this.cam.addShake(0.2);
    for (let i = 1; i < LANCE_RANGE; i += 1.5) {
      this.particles.oreBurst(this.ctrl.px + dir * i, this.ctrl.py, 0xfff0c0);
    }
    this.cam.screenPos(this.ctrl.px, this.ctrl.py + 0.6, this.screen);
    this.hud.popup('-' + fmtMoney(LANCE_SHOT_COST), '#ffe08a', this.screen.sx, this.screen.sy);
  }

  /** SITE 297: point the pilot at whatever they have not read yet */
  private huskPrompt(): void {
    const st = this.state;
    const here = HUSK_READABLES.findIndex((r, i) =>
      !st.huskRead.has(i) && Math.abs(this.pilot.px - r.x) < 1.2);
    if (here >= 0) {
      this.hud.setPrompt(`<span class="key">E</span>${HUSK_READABLES[here].name}`);
      return;
    }
    let best = -1, bestD = Infinity;
    HUSK_READABLES.forEach((r, i) => {
      if (st.huskRead.has(i)) return;
      const d = Math.abs(this.pilot.px - r.x);
      if (d < bestD) { bestD = d; best = i; }
    });
    if (best >= 0) {
      const arrow = HUSK_READABLES[best].x < this.pilot.px ? '←' : '→';
      this.hud.setPrompt(`<span class="key">${arrow}</span>${HUSK_READABLES[best].name} · ${Math.round(bestD * TILE_M)}m`);
    } else {
      const atPod = Math.abs(this.pilot.px - this.ctrl.px) < 0.85;
      this.hud.setPrompt(atPod
        ? `<span class="key">E</span>BOARD POD`
        : `<span class="key">R</span>BACK TO THE POD`);
    }
  }

  private evaFrame(dt: number): void {
    const paused = this.panels.isOpen;
    const fin = this.finale;
    const rite = fin.isCommunion;
    // in the gallery the suit stops counting — the walk between doors is
    // browsing, and a blackout mid-browse teaches nothing
    if (this.vaultGallery) this.pilot.o2 = EVA_O2;

    if (!paused && dt > 0) {
      if (rite) {
        // the Communion. The chamber is warm: the suit stops counting.
        this.pilot.o2 = EVA_O2;
        const still = { left: false, right: false, up: false, down: false };
        this.pilot.update(dt, fin.cinematic ? still : this.input());
        fin.advance(dt, this.pilot.px, this.pilot.py);

        // contact — the world is ended the moment the pilot touches the light
        if (fin.phase === 'walk' &&
          Math.abs(this.pilot.px - this.ember.x) < 3.4 && Math.abs(this.pilot.py - this.ember.y) < 5) {
          this.state.endedWorlds.add(ACTIVE.id);
          fin.touch();
          this.saveNow();
        }

        // the white has said its piece: hand over to the epilogue
        if (fin.finished) {
          fin.conclude();
          this.exitEva();
          this.hud.show();
          this.audio.ending();
          this.panels.open('ending');
          return;
        }
        this.hud.setPrompt(null);
      } else if (this.coreActKind || this.atCradle()) {
        this.cradleFrame(dt);
      } else if (this.salvaging) {
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

      // SITE 297 has no clock: there is nothing here to run out of but time
      if (ACTIVE.husk) this.pilot.o2 = EVA_O2;

      // the Kindled: on foot, a touch is the whole suit's air, at once
      const kh = this.threats.updateChamber(dt, this.time, this.pilot.px, this.pilot.py, true, rite, (id, x, y) => this.onFaunaEvent(id, x, y));
      if (kh === 'suit') {
        this.hud.overexpose();
        this.audio.kindledTouch();
        this.cam.addShake(0.4);
        this.onFaunaEvent('kindled-touch', this.pilot.px, this.pilot.py);
        this.pilot.o2 = 0;
      }

      // oxygen out: blackout, wake in the pod
      if (!rite && this.pilot.o2 <= 0) {
        this.exitEva();
        this.hud.toast(kh === 'suit' ? 'BLACKOUT — SOMETHING TOOK YOUR AIR' : 'BLACKOUT — THE SUIT DRAGGED YOU HOME');
        this.audio.damage();
        return;
      }

      // contextual prompt
      const stone = this.glyphStoneNear(this.pilot.px, this.pilot.py, 1.1);
      if (rite || this.salvaging || this.coreActKind) {
        // handled above / silent while working
      } else if (ACTIVE.husk) {
        this.huskPrompt();
      } else if (this.atCradle()) {
        // handled by cradleFrame
      } else if (this.wreckAtPilot() >= 0) {
        this.hud.setPrompt(`<span class="key">E</span>SALVAGE`);
      } else if (stone) {
        const k = this.glyphMarks.chargeOf(stone.id);
        this.hud.setPrompt(k >= 1
          ? `<span class="key">E</span>STEP INTO ${glyphById(stone.id)?.name ?? 'THE STONE'}`
          : `<span class="key">◇</span>THE MARK IS TAKING · ${Math.round(k * 100)}%`);
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

    if (!paused && dt > 0) this.refreezeTick(dt);
    this.hud.setEva(rite || ACTIVE.husk ? null : this.pilot.o2);
    this.pod.update(dt, { vx: 0, thrust: 0, sideThrust: 0, drilling: false, drillDir: 'down', depthRow: this.ctrl.row, time: this.time });
    if (rite) {
      this.cam.finaleFollow(dt, this.pilot.px, this.pilot.py,
        this.ember.x, this.ember.y, fin.t, fin.touchBlend);
    } else {
      this.cam.follow(dt, this.pilot.px, this.pilot.py, this.pilot.vx, this.pilot.vy, true);
    }
    this.chunks.update(Math.max(0, Math.floor(-this.pilot.py)), this.time);
    this.atmosphere.update(Math.floor(-this.pilot.py));

    this.audio.update(dt, {
      thrust: 0, drilling: this.salvaging !== null, hardness: 2,
      row: Math.floor(-this.pilot.py),
      lowFuel: !rite && this.pilot.o2 < 12,
    });

    this.hud.update(this.state, this.ctrl.depthM, this.ctrl.row, 0, Math.max(dt, 0.001));
    this.map.refresh(this.terrain, this.pilot.px, this.pilot.py, this.time,
      this.state.worldBestRow, this.state.hasDeepArray, this.arrestors.list,
      this.state.hasBeacons ? this.terrain.wrecks.filter((_, i) => !this.looted.has(i)) : []);
  }
}

new Game();
