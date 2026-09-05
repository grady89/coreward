import * as THREE from 'three';
import { FollowCam } from '../fx/camera';
import { GlyphDef, buildGlyphMark, glyphSvg } from '../world/glyphs';
import { VaultDef, GateDef, CurrentDef, ParsedVault, parseVault, chamberAt, PULSE } from '../world/vaults';
import {
  Suit, SUIT_R, SUIT_H, buildSuit, poseSuit,
  FigurePose, poseFigure, figureLampAt, figureNearElbow,
} from '../player/suit';
import {
  Act, actOf, LATTICE, softDisc, drankStain, glowMat,
  buildSconce, SconceMount, SCONCE_FLAME_Y, buildBrazier,
  buildEmitter, seatEmitter, EMITTER_REACH, coneGeometry, coneMaterial, EmitterParts,
  buildRailPost, buildRailMast, buildBolt, BoltParts, buildSnuffer, MothParts,
  buildCenser, CenserParts, buildArcTelegraph, ArcTelegraph, buildChain,
  buildCrusher, buildRime, RimeParts,
  buildPier, buildDeck, DeckParts, buildDoorway, buildDoorRune, DoorRuneParts,
  buildCurtain, CurtainParts, buildCurrent, CurrentParts,
  buildMote, buildStud, buildPursuit, PursuitParts, buildMasterDressing,
} from './vaultkit';

// A VAULT RUN — one attempt at one of the Nine Stones (SPEC-GLYPHS.md §3,
// second pass). The movement set is discrete now, Celeste-school:
//
//   walk / jump ......... free (coyote time, jump buffering, variable height)
//   wall-slide / -jump .. free — press into a wall airborne and it catches you
//   the SPARK ........... one stored dash, 8-way, on Shift. Landing on stone
//                         relights it; so does any lit sconce within reach —
//                         including mid-air, which is what routes are made of.
//
// There is no hover. There is no meter. You carry one breath of light and
// the level is the question of where you spend it. Failure is never death:
// you gutter and re-form at the last sconce you lit.

/**
 * How much bigger the driller stands in a vault than out in the mines.
 *
 * The levels are authored in tiles and the movement constants below are in
 * tiles, so BOTH stay exactly as they were — every gap, arc and hazard is
 * measured the same. What changes is the body reading against that grid: at
 * 1x the driller is half a tile and a jump clears five and a half of them,
 * which is why the camera had to sit so far back and why the rooms read as
 * dollhouses. At 2x the body is a full tile, a jump clears 2.8 of them, and
 * the frame can come in close enough to see the visor.
 *
 * The ceiling is the maps: the tightest traversed corridors (THE LAST SHIFT,
 * THE WEATHER) are 2 tiles of headroom, so a body taller than 2 tiles would
 * not fit through its own levels.
 */
const BODY = 2;
const HW = 0.15 * BODY;
const HH = 0.26 * BODY;
const EPS = 0.001;
const WALK = 3.6;
const AIR_CTRL = 26;        // horizontal steering, airborne (capped at walk speed)
const JUMP = 11;
const GRAV = 24;            // heavier than the old float — jumps ARC now
const MAX_FALL = 13;
const DASH_V = 14;
const DASH_T = 0.15;
const DASH_KEEP = 8.0;      // speed retained when the dash ends (SPEC-VAULTS-2 F6)
const DASH_CARRY = 0.25;    // seconds the kept speed takes to decay to WALK
const FREEZE_T = 0.05;      // ~3 frames the world holds its breath on ignition (F3);
                            // the same window is the aim latch (F5)
const FAST_FALL = 18;       // MAX_FALL while down is held (F7)
const APEX_BAND = 2.0;      // |vy| under this with jump held: half gravity (F4)
const CORNER = 0.3;         // head-bonk horizontal forgiveness, tiles (F1)
const DASH_POP = 0.35;      // dash lip pop / floor snap reach, tiles (F2)
const WJ_NEAR = 0.4;        // a wall this close counts for a wall-jump (F9)
const WJ_LATCH = 0.08;      // ~5 frames the wall-jump's push-out cannot be steered against
const WALL_SLIDE = 2.6;     // max fall speed against a wall
const WALL_JUMP_UP = 10.5;
const WALL_JUMP_OUT = 5.6;
const COYOTE = 0.1;
const BUFFER = 0.12;
const SCONCE_LIGHT_R = 1.0; // touch an unlit sconce to light it
const SCONCE_SPARK_R = 1.4; // a lit sconce relights the spark from here
                            // (a brazier's ring is the same reach — the
                            // author's refill brush, no checkpoint in it)
const BRIDGE_PULSES = 4;    // bridges hold one beat-clock pulse × this per side
const BRIDGE_WARN = 0.35;
// ---- the V3 kit (SPEC-VAULTS-2 §III) ----
const SNUFF_WAKE = 3.5;     // a sleeping snuffer stirs when the body comes this close
const SNUFF_R = 0.5;        // the moth's reach — box half-extent, both axes
const CENSER_TOP = 0.45;    // the lantern's crown sits this far above the bob centre
const CENSER_RIDE_BAND = 0.3; // how forgiving the crown is about the landing
const CURRENT_RISE = 7;     // a current carries — it never outruns the spark (P5)
const SNUFF_SATE = 1.2;     // a moth that has just fed is sated this long — over
                            // refill stone the theft would otherwise fire every
                            // frame the floor re-arms you, sting and all
const RIME_CRUMBLE = 0.55;
const RIME_REGROW = 3.5;
/** the bolt's glass head: how far forward of its carriage it rides, and how
 *  big it is. Both are read off buildBolt so the hazard is the drawn light */
const BOLT_HEAD = 0.13;
const BOLT_R = 0.18;
const BEAM_R = 0.3;
/**
 * How far a watch-light throws, in tiles.
 *
 * This used to be `90` steps of 0.35 written out twice — 31.5 tiles, which is
 * wider than most rooms. A beam that long is not a lantern, it is an
 * architectural line that sweeps: in THE LAST SHIFT it put 46% of every
 * standing tile in the room inside its arc, the ENTRY included, so the room
 * began with the body in the path of something it could not step away from.
 *
 * Nine tiles is a little under a camera chamber's half-width, so there is
 * always footing outside the disc within the frame you are being asked to
 * read. The beam still crosses a corridor convincingly; it just stops owning
 * the room.
 */
export const BEAM_LEN = 9;
const BEAM_STEP = 0.35;
const BEAM_STEPS = Math.round(BEAM_LEN / BEAM_STEP);
/**
 * THIN PLATFORMS — bridge decks and rime shelves.
 *
 * Both are drawn as panels a third of a tile deep, because that is what they
 * are: a floor that comes and goes, not architecture. The collision grid is
 * tile-granular, though, so for as long as the whole tile was solid the body
 * bonked its head on empty air two thirds of a tile below the ice. That is
 * the same fault as a beam drawn wider than it bites, in the place it is most
 * insulting: the player can SEE there is nothing there.
 *
 * So a thin tile is solid only in the band it is drawn in, measured down from
 * the tile's top. Landing is untouched — the panel's top IS the tile's top,
 * which is what every authored jump in the nine rooms was tuned against — and
 * passing up through one from below now works, because that is what the
 * picture has been promising all along.
 *
 * The substep cap is 0.2 tiles, comfortably under the band, so nothing can
 * tunnel through a panel in one step.
 */
const THIN_BAND = 0.34;
/**
 * How far outside an open-edged room the body may go before it has fallen.
 * Eight tiles is about a jump and a half of slack in every direction, which
 * is the room a player needs to steer back from a missed landing. The number
 * is large on purpose: the boundary must never be the thing that kills you.
 */
const VOID_PAD = 8;
const REFORM_T = 0.35;
const INVULN_T = 0.6;

// ---- F11: the camera-locked chamber ----
/** the closest the frame ever sits: a chamber narrower than this reads intimate */
const CHAMBER_Z_MIN = 9.5;
/** and the furthest, for a room that declares no chambers at all */
const CHAMBER_Z_MAX = 26;
/** margin of stone left around a chamber so the cut does not clip its walls */
const CHAMBER_PAD = 1.6;
/** how far past a boundary the body must be before the frame cuts */
const CHAMBER_HYST = 0.45;

// ---- the rim-light lattice (§VI) ----
/**
 * A solid face's constant emissive rim: faint, but readable well past the
 * lamp. The BASE is now per-act (`LATTICE` in vaultkit) — architecture as
 * chronology, §VI: Act I's masonry is maintained, Act II's is stripped, Act
 * III's was put up in a hurry. RIM_MAX still caps all three, so no act can
 * light itself out of its own dark.
 */
/** each lit sconce strengthens the whole lattice a notch — the chord's fifth system */
const RIM_STEP = 0.03;
const RIM_MAX = 0.55;
// seam thickness and course lengths live inside buildRimLattice now — the
// lattice is seeded courses with joints, spill and pools, not uniform strips

// ---- the sconce chord (§VI) ----
/** the chord's envelope: everything it fires decays over this */
const CHORD_T = 1.4;
/** the game's ONLY positive screenshake, and it is soft (~2 px) */
const SHAKE_SCONCE = 0.2;
/** the one other permitted source in a vault: a piston actually landing */
const SHAKE_CRUSH = 0.42;
const AMBIENT_BASE = 0.62;

/** how many spent wicks one room remembers before the oldest is dropped */
const WICK_CAP = 96;

/**
 * THE RECORD OF FAILURE — every gutter leaves a wick-smudge where the light
 * went out, and the room keeps them for the whole session, across re-entries.
 * By KINDLED's last floor your marks and the guild's dead are drawn in the
 * same language on purpose (atmosphere §1.4).
 */
const SPENT_WICKS = new Map<string, { x: number; y: number }[]>();

/** the guild's voice, one line per posture. Free, skippable, never gating. */
const GUILD_LINES: Record<FigurePose, string> = {
  reaching: 'Still reaching. The cup was three fingers past him, and it was three fingers past him for a long time.',
  fallen: 'She kept it up. Whatever came, she kept the lamp out of the dust. That is the whole of the training.',
  curled: 'He turned his back. You do that when the thing coming is not something you can face and go on working.',
  kneeling: 'He set it down first, then he knelt. In that order — which is the order we were taught.',
};

export interface VaultAudio {
  /** the sconce chord's audio third: the step up, plus the dash-refresh intake */
  chord(i: number): void;
  deny(): void;
  /** the gutter phrase — collapse, held low tone, intake at re-form. No sting. */
  gutter(): void;
  complete(): void;
  /** pull the ambience bed to `to` (linear) for `hold` seconds, then back */
  duck(to: number, hold: number): void;
}

interface Input { left: boolean; right: boolean; up: boolean; down: boolean; }

type Phase = 'run' | 'complete';

export class VaultRun {
  completed = false;
  closed = false;
  phase: Phase = 'run';
  /** the one breath of light. True = a dash is loaded. */
  spark = true;
  px: number; py: number;
  vx = 0; vy = 0;
  grounded = false;
  /** times the light guttered — honest difficulty telemetry, shown at the end */
  reforms = 0;

  get glyphId(): string { return this.glyph.id; }

  private p: ParsedVault;
  private scene = new THREE.Scene();
  private cam: FollowCam;
  private time = 0;
  private phaseT = 0;
  private invuln = 0;
  private facing = 1;
  private walkT = 0;
  private checkpoint: { x: number; y: number };
  private sconceLit: boolean[];
  private doorOpen: boolean[];
  private bridgeOn = [true, false];
  private rimeState: { t: number; gone: number }[];
  private beamRays: { ex: number; ey: number; mesh: THREE.Mesh }[] = [];
  private windT = 0;
  private gusting = false;
  // movement state
  private dashT = 0;
  private dashVX = 0;
  private dashVY = 0;
  private coyoteT = 0;
  private bufferT = 0;
  private wallDir = 0;
  private wallCoyote = 0;
  private jumpHeld = false;
  private jumpCut = false;
  // pursuit state
  private pursuitOn = false;
  private pursuitEdge = 0;
  private pursuitDone = false;
  // the V3 kit's state
  /** the room's beat-clock pulse, seconds */
  private pulse: number;
  /** which of the three ages this room's masonry and fittings belong to (§VI) */
  private act: Act;
  /**
   * The rail each shuttle actually runs on, in tiles.
   *
   * A VERTICAL bolt is a gate, and a gate is only readable if it is anchored:
   * something on the floor, something on the ceiling, and the light shuttling
   * between them. Authored endpoints float in the middle of a shaft and read
   * as a light with no reason to be there — so a vertical rail is SEATED, out
   * to the first stone above and the first stone below, and the bolt travels
   * that whole span. The author says which column and roughly where; the room
   * says how long.
   *
   * Horizontal rails are strung between two anchor posts the author placed on
   * purpose, and snuffers sleep parked at their rail's start, so neither is
   * seated — one is a span, the other is a patrol.
   */
  private shuttleSpan: { x0: number; y0: number; x1: number; y1: number }[] = [];
  /**
   * A CURRENT FILLS ITS SHAFT.
   *
   * The def gives the columns and a point inside them; the room decides how
   * far the wind reaches, by opening out to the first stone above and below.
   * Typing the extent by hand meant a shaft whose wind stopped partway up for
   * no reason a player could see, and a number that silently disagreed with
   * the rock the moment either moved. Same rule as a rail post: the author
   * says where, the room says how far.
   */
  currentSpan: { x0: number; y0: number; x1: number; y1: number; force: number }[] = [];

  /** per shuttle; only a snuffer's entry is ever awake or ticking */
  private snuffState: { awake: boolean; t: number; sate: number }[] = [];
  /** which censer's crown the body is standing on, -1 for none */
  private ridingCenser = -1;
  private censerPrevX: number[] = [];
  /** a parked beam is inert until its arm rect is crossed */
  private beamArmed: boolean[] = [];
  private beamArmT: number[] = [];
  // chambers, the chord, and the dark
  /** which camera-locked chamber the frame is holding */
  chamber = 0;
  /** the sconce chord's envelope, 1 the frame it fires, 0 when it has settled */
  private chordT = 0;
  /** the first dark tile of the run ducks the bed once, and only once */
  private darkSeen = false;
  private lampRaise = 0;

  // visuals
  private pilotGroup = new THREE.Group();
  private suit!: Suit;
  private lamp!: THREE.PointLight;
  private sparkMesh!: THREE.Mesh;
  private trail: { mesh: THREE.Mesh; t: number }[] = [];
  private freezeT = 0;        // spark ignition freeze; doubles as the aim latch
  private dashDX = 0;
  private dashDY = 0;
  private dashCarryT = 0;     // kept dash speed decaying back to WALK
  private wallJumpT = 0;      // push-out protection after a wall-jump
  private reformT = 0;        // visual only — control is already back
  private sconceMeshes: {
    flame: THREE.Mesh; light: THREE.PointLight; mat: THREE.MeshBasicMaterial;
    /** an unlit cup must show no fire at all — the wager has not been made */
    fireMats: THREE.MeshBasicMaterial[];
    /** the famine's cracked cup smokes even unlit — the tell before the wager */
    smoke: THREE.Mesh[];
  }[] = [];
  private doorMeshes: THREE.Mesh[][] = [];
  /** the count on a door's face, filling a pip per sconce lit — and it
   *  belongs to the door, so it leaves when the door does */
  private doorRunes: DoorRuneParts[] = [];
  private bridgeMeshes: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; group: 0 | 1; parts: DeckParts }[] = [];
  /** a bridge run's piers, which never go out — the phase read from a distance */
  private pierMats: THREE.MeshBasicMaterial[] = [];
  private rimeMeshes: THREE.Object3D[] = [];
  /** each shelf's crack web, drawn on as it gives */
  private rimeParts: RimeParts[] = [];
  /** a plain shuttle's bolt, or a snuffer's whole moth; mat is what glows */
  private shuttleMeshes: { bolt: THREE.Object3D; mat: THREE.MeshBasicMaterial }[] = [];
  /** the faint rail behind each bolt — a hazard's visible track (P2) */
  private shuttleRailMats: THREE.Material[] = [];
  /** the ember seam and haze every unlight stud wears (P2) */
  private killMats: THREE.Material[] = [];
  /** each piston's working face, the seam that says which way it comes (P2) */
  private crusherFaceMats: THREE.Material[] = [];
  private censerMeshes: {
    parts: CenserParts; chain: THREE.Group; light: THREE.PointLight;
    /** the arc smoke-trace and its two apex pads (§III, V3.5) */
    arc: ArcTelegraph;
  }[] = [];
  /** a snuffer's whole moth, indexed like shuttles; null for a plain bolt */
  private snufferParts: (MothParts | null)[] = [];
  /** last frame's place, so the moth can turn into where it is going */
  private snuffPrev: ({ x: number; y: number } | null)[] = [];
  /** a plain bolt's carriage, so the wake can lie behind the direction of travel */
  private boltParts: (BoltParts | null)[] = [];
  private moteMeshes: { mesh: THREE.Object3D; x: number; y: number; ph: number; mats: THREE.MeshBasicMaterial[] }[] = [];
  private brazierFx: {
    light: THREE.PointLight; embers: THREE.Mesh[]; x: number; y: number;
    bedMat: THREE.MeshBasicMaterial; coals: THREE.Mesh[];
  }[] = [];
  private gateMeshes: { parts: CurtainParts; g: GateDef; down: boolean }[] = [];
  private currentPts: { parts: CurrentParts; c: CurrentDef }[] = [];
  private crusherMeshes: THREE.Object3D[] = [];
  /** each piston's ram, stretched between its housing and its head */
  private crusherRams: { ram: THREE.Mesh; ax: number; ay: number; along: boolean }[] = [];
  /** the watch-lantern heads, turned to their own beam's bearing */
  private emitters: EmitterParts[] = [];
  private pursuitMesh: THREE.Object3D | null = null;
  private pursuitEdgeMesh: THREE.Object3D | null = null;
  /** the wave's own parts: the veils, the burn, and the light it throws */
  private pursuit: PursuitParts | null = null;
  private masterGroup!: THREE.Group;
  private motes!: THREE.Points;
  private motePos!: Float32Array;
  private windStreaks: THREE.Points | null = null;
  private ambient!: THREE.AmbientLight;
  private rimMat!: THREE.MeshBasicMaterial;
  private fog: { mesh: THREE.Mesh; vx: number; x0: number; x1: number }[] = [];
  /** the dead's lamps and chest embers: still warm, and they breathe */
  private figureGlows: { mat: THREE.MeshBasicMaterial; base: number }[] = [];
  private hud: HTMLDivElement;
  private card: HTMLDivElement | null = null;
  private voice: HTMLDivElement | null = null;
  private voiceT = 0;

  constructor(
    private def: VaultDef,
    private glyph: GlyphDef,
    /** the world's pale core tint — bridges, rails, the mark on the stone */
    private hue: number,
    /** the world's one vivid note — the rim lattice and the fog banks wear it */
    private rimHue: number,
    private assist: boolean,
    private audio: VaultAudio,
    aspect: number,
    ui: HTMLElement,
  ) {
    this.p = parseVault(def);
    this.pulse = def.clock ?? PULSE;
    this.act = actOf(glyph.world);
    this.snuffState = (def.shuttles ?? []).map(() => ({ awake: false, t: 0, sate: 0 }));
    this.snuffPrev = (def.shuttles ?? []).map(() => null);
    this.beamArmed = (def.beams ?? []).map(b => !b.parked);
    this.beamArmT = (def.beams ?? []).map(() => 0);
    this.cam = new FollowCam(aspect);
    this.cam.xMax = this.p.w;
    this.px = this.p.entry.x + 0.5;
    this.py = -(this.p.entry.y + 0.5) - 0.2;
    this.checkpoint = { x: this.px, y: this.py };
    this.sconceLit = this.p.sconces.map(() => false);
    this.doorOpen = this.p.doors.map(() => false);
    this.rimeState = this.p.rime.map(() => ({ t: -1, gone: 0 }));
    this.build();
    this.chamber = chamberAt(this.p, Math.floor(this.px));
    this.cutTo(this.chamber);

    this.hud = document.createElement('div');
    this.hud.id = 'vault-hud';
    this.hud.innerHTML = `
      <div class="vh-name">${glyph.name}</div>
      <div class="vh-spark">◆</div>
      <div class="vh-hint">SHIFT — spend the spark · stone and sconces relight it · walls catch you · F raises the lamp · Esc leaves</div>`;
    ui.appendChild(this.hud);
    this.voice = document.createElement('div');
    this.voice.id = 'vault-voice';
    ui.appendChild(this.voice);
  }

  // ---------------- geometry ----------------

  private hazardMul(): number { return this.assist ? 0.6 : 1; }

  private solidTile(x: number, y: number): boolean {
    // an open-edged room has sky past its edge, not stone: the body leaves,
    // and the void — not a wall — is what ends the attempt
    if (x < 0 || y < 0 || x >= this.p.w || y >= this.p.h) return !this.def.openEdges;
    const i = y * this.p.w + x;
    if (this.p.solid[i]) return true;
    for (let d = 0; d < this.p.doors.length; d++) {
      if (this.doorOpen[d]) continue;
      for (const t of this.p.doors[d].tiles) if (t.x === x && t.y === y) return true;
    }
    for (let b = 0; b < this.p.bridges.length; b++) {
      const br = this.p.bridges[b];
      if (br.x === x && br.y === y) return this.bridgeOn[br.group];
    }
    for (let r = 0; r < this.p.rime.length; r++) {
      const rm = this.p.rime[r];
      if (rm.x === x && rm.y === y) return this.rimeState[r].gone <= 0;
    }
    return false;
  }

  /** bridge decks and rime shelves: solid, but only across THIN_BAND */
  private thinTile(x: number, y: number): boolean {
    for (const br of this.p.bridges) if (br.x === x && br.y === y) return true;
    for (const rm of this.p.rime) if (rm.x === x && rm.y === y) return true;
    return false;
  }

  /**
   * Solid to a BODY whose centre sits at world `cy`. Everything that resolves
   * the player against the room asks this; the ray marches and the fit walk
   * still ask `solidTile`, because a beam stopping at a bridge is a whole
   * tile's business and never depended on where the body happened to be.
   */
  private bodySolid(x: number, y: number, cy: number): boolean {
    if (!this.solidTile(x, y)) return false;
    if (!this.thinTile(x, y)) return true;
    const top = -y;                       // the panel's top is the tile's top
    return cy + HH > top - THIN_BAND && cy - HH < top;
  }

  private gravityAt(x: number, y: number): [number, number] {
    const tx = Math.floor(x), ty = Math.floor(-y);
    if (tx < 0 || ty < 0 || tx >= this.p.w || ty >= this.p.h) return [0, -GRAV];
    switch (this.p.gravity[ty * this.p.w + tx]) {
      case 1: return [0, GRAV];
      case 2: return [GRAV * 0.55, 0];
      case 3: return [-GRAV * 0.55, 0];
      default: return [0, -GRAV];
    }
  }

  // ---------------- F11: camera-locked chambers ----------------

  /**
   * The frame for one chamber: centred on it, and far enough back that the
   * whole slice fits with a margin of stone showing. Never closer than the
   * old vault framing, so nothing about the body's read changes.
   */
  private chamberFrame(i: number): { cx: number; cz: number } {
    const c = this.p.chambers[i];
    const cols = c.x1 - c.x0 + 1;
    const cz = Math.max(CHAMBER_Z_MIN,
      Math.min(CHAMBER_Z_MAX, this.cam.distanceForWidth(cols + CHAMBER_PAD)));
    // a chamber narrower than the frame gets the frame nudged back inside the
    // room, so the spare screen shows stone rather than the void past the map
    const hw = this.cam.halfW(cz);
    let cx = (c.x0 + c.x1 + 1) / 2;
    if (hw * 2 < this.p.w) cx = Math.min(this.p.w - hw, Math.max(hw, cx));
    return { cx, cz };
  }

  /** the vertical band the frame may travel in without showing past the map */
  private camYBand(cz: number): [number, number] {
    const hh = this.cam.halfH(cz);
    if (hh * 2 >= this.p.h) return [-this.p.h / 2, -this.p.h / 2];
    return [-this.p.h + hh, -hh];
  }

  /** the cut: a chamber change is never a pan (P3, precision §4.2) */
  private cutTo(i: number): void {
    this.chamber = i;
    const { cx, cz } = this.chamberFrame(i);
    const [yMin, yMax] = this.camYBand(cz);
    this.cam.snap(cx, Math.min(yMax, Math.max(yMin, this.py + 0.5)), cz);
  }

  /**
   * Which chamber owns the body right now. Hysteresis of CHAMBER_HYST keeps a
   * body loitering on a boundary column from strobing the frame between two
   * chambers — you have to mean it before the room re-frames.
   */
  private chamberOf(px: number): number {
    const c = this.p.chambers[this.chamber];
    if (px >= c.x0 - CHAMBER_HYST && px <= c.x1 + 1 + CHAMBER_HYST) return this.chamber;
    return chamberAt(this.p, Math.max(0, Math.min(this.p.w - 1, Math.floor(px))));
  }

  // ---------------- construction ----------------

  private build(): void {
    const { p } = this;
    this.scene.background = new THREE.Color(0x05060c);
    this.ambient = new THREE.AmbientLight(0xbfc7ff, AMBIENT_BASE);
    this.scene.add(this.ambient);
    const key = new THREE.DirectionalLight(0xfff2d8, 0.35);
    key.position.set(0.4, 1, 0.8);
    this.scene.add(key);

    // masonry. In a room with any dark in it the whole room is a dark room:
    // the value a stone takes is a function of how far it stands from the
    // dark, which is what makes the three bands a RAMP and not a seam one
    // course deep (P2, atmosphere §2).
    const distDark = this.darkDistanceField();
    const band = (i: number): number => {
      if (!distDark) return 0.85 + Math.random() * 0.3;   // a lit room, as before
      const d = distDark[i];
      if (d < 0 || d > 3) return 0.055;                   // band 3 — true black
      if (d <= 1) return 0.15;                            // band 2 — silhouette
      return 0.1;
    };
    let count = 0;
    for (let i = 0; i < p.w * p.h; i++) if (p.solid[i]) count++;
    const box = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.2, flatShading: true });
    const inst = new THREE.InstancedMesh(box, mat, count);
    const m4 = new THREE.Matrix4();
    const col = new THREE.Color();
    let k = 0;
    for (let y = 0; y < p.h; y++) {
      for (let x = 0; x < p.w; x++) {
        const i = y * p.w + x;
        if (!p.solid[i]) continue;
        m4.makeTranslation(x + 0.5, -(y + 0.5), 0);
        inst.setMatrixAt(k, m4);
        // Band 1 is the lamp core, where the standard material still does
        // its work. Band 2 is the silhouette ring: stone near the dark is
        // flattened to a constant, because the random grain that sells lit
        // masonry is exactly what muddies a silhouette. Band 3 is true
        // black, and the fog planes give that black its parallax.
        // drank stone is the same masonry with the warmth pulled out of it:
        // colder, flatter, a shade darker — matte where live stone is not
        col.setHex(p.dry[i] ? 0x6c7386 : 0x8f89a4)
          .multiplyScalar(band(i) * (p.dry[i] ? 0.8 : 1));
        inst.setColorAt(k, col);
        k++;
      }
    }
    inst.instanceMatrix.needsUpdate = true;
    this.scene.add(inst);

    // DRANK STONE (`=`). Colour alone said "a bit darker"; what it has to
    // say is "the warmth was taken out of this, unevenly, a long time ago".
    // A matte stain laid over the top face of each drank course does it —
    // blotched, rimless-cold, and nothing like the grain of live masonry.
    // The player has to read the floor before committing a spent spark to
    // it, so this is the one material in the room that must be legible at
    // a glance and at distance both.
    let dryCount = 0;
    for (let i = 0; i < p.w * p.h; i++) if (p.dry[i]) dryCount++;
    if (dryCount) {
      const stainGeo = new THREE.PlaneGeometry(1, 1);
      const stain = new THREE.InstancedMesh(stainGeo, new THREE.MeshBasicMaterial({
        map: drankStain(), color: 0xc8d4e8, transparent: true,
        opacity: 0.55, depthWrite: false, toneMapped: false,
      }), dryCount);
      let j = 0;
      for (let y = 0; y < p.h; y++) {
        for (let x = 0; x < p.w; x++) {
          if (!p.dry[y * p.w + x]) continue;
          m4.makeTranslation(x + 0.5, -(y + 0.5), 0.505);
          stain.setMatrixAt(j++, m4);
        }
      }
      stain.instanceMatrix.needsUpdate = true;
      this.scene.add(stain);
    }

    this.buildRimLattice();
    this.buildDarkFog();

    // unlight — the only instant-kill terrain in the game, so it is the one
    // thing in a room that must read as a wound rather than as masonry
    const isStud = (x: number, y: number): boolean =>
      x >= 0 && y >= 0 && x < p.w && y < p.h && !!p.kill[y * p.w + x];
    for (let y = 0; y < p.h; y++) {
      for (let x = 0; x < p.w; x++) {
        if (!p.kill[y * p.w + x]) continue;
        if (p.voidTile[y * p.w + x]) continue;   // a void is an absence: nothing to draw
        // a run of studs is ONE hole: the torn edge is drawn only where the
        // bite meets something that is not another bite
        const open = [
          !isStud(x, y - 1), !isStud(x, y + 1),
          !isStud(x - 1, y), !isStud(x + 1, y),
        ];
        const stud = buildStud(x * 37 + y * 11, open);
        stud.group.position.set(x + 0.5, -(y + 0.5), 0);
        this.killMats.push(...stud.mats);
        this.scene.add(stud.group);
      }
    }

    // sconces. The light-family sheet's fitting: a backplate on the masonry,
    // a bracket arm, a turned baluster and a wide shallow cup with the flame
    // standing ON it. A famine room's are DEADLIGHT: the cup is cracked
    // stone with its lip broken through, and what burns when lit is a
    // guttering blue-white — a light that remembers you and has nothing to
    // give (§III; atmosphere §3.4).
    const dead = !!this.def.deadLight;
    for (const sc of this.p.sconces) {
      // every fitting has a foot. A wall beside it gets the bracket the
      // light-family sheet is of; failing that it hangs off the vault above
      // or stands on the floor below, because the guild did not leave cups
      // floating in mid-air and a reader should never have to wonder.
      const mount = this.sconceSeat(sc.x, sc.y);
      const parts = buildSconce(this.act, mount, dead);
      // hurried work is also mounted too high, out of comfortable reach (§VI)
      const lift = this.act === 'hurried' && mount.kind !== 'floor' ? 0.12 : 0;
      const ox = mount.kind === 'wall' ? -mount.facing * 0.34 : 0;
      const gx = sc.x + 0.5 + ox, gy = -(sc.y + 0.5) - 0.2 + lift;
      parts.group.position.set(gx, gy, 0.3);
      const light = new THREE.PointLight(dead ? 0x9db8ff : 0xffd9a0, 0, 7, 1.7);
      light.position.set(gx + parts.cupX, gy + SCONCE_FLAME_Y, 0.35);
      this.scene.add(parts.group, light);
      this.sconceMeshes.push({
        flame: parts.flame, light, mat: parts.flameMat,
        fireMats: parts.fireMats, smoke: parts.smoke,
      });
    }

    // doors — masonry a shade warmer, wearing the count it wants on its face
    for (const d of this.p.doors) {
      const meshes: THREE.Mesh[] = [];
      const dm = new THREE.MeshStandardMaterial({ color: 0x7a6a56, roughness: 0.5, metalness: 0.3, flatShading: true, transparent: true });
      for (const t of d.tiles) {
        const m = new THREE.Mesh(box, dm);
        m.position.set(t.x + 0.5, -(t.y + 0.5), 0);
        m.scale.setScalar(0.99);
        this.scene.add(m);
        meshes.push(m);
      }
      this.doorMeshes.push(meshes);
      // THE DOORWAY the leaf hangs in. Without it a door tile is a warmer
      // wall block standing in the room, and paying one off leaves a gap
      // where a box used to be. With it, what opens is an opening.
      const xs = d.tiles.map(t => t.x), ys = d.tiles.map(t => t.y);
      const dx0 = Math.min(...xs), dx1 = Math.max(...xs);
      const dy0 = Math.min(...ys), dy1 = Math.max(...ys);
      const dw = dx1 - dx0 + 1, dh = dy1 - dy0 + 1;
      const cx = (dx0 + dx1 + 1) / 2, cy = -(dy0 + dy1 + 1) / 2;
      const way = buildDoorway(dw, dh);
      way.position.set(cx, cy, 0);
      this.scene.add(way);
      // and the register, on the leaf's own face at eye height
      const need = this.def.doorNeeds?.[d.ch] ?? 1;
      const rune = buildDoorRune(need);
      rune.group.position.set(cx, cy, 0.5);
      this.scene.add(rune.group);
      this.doorRunes.push(rune);
    }

    // bridges — a deck of light between two stone piers. The piers stay lit
    // whatever the phase is doing, per the light-bridge sheet: what you read
    // from across the room is the deck coming and going between two fixed
    // lamps, not a bar appearing out of nowhere.
    for (const b of this.p.bridges) {
      const parts = buildDeck(this.hue);
      // the deck's TOP is the tile's top: that is the surface every authored
      // jump was tuned against, and now also where the collision band starts
      parts.group.position.set(b.x + 0.5, -(b.y + 0.5) + 0.33, 0);
      this.scene.add(parts.group);
      this.bridgeMeshes.push({ mesh: parts.deck, mat: parts.deckMat, group: b.group, parts });
    }
    // a pier stands at each end of every contiguous run, on the stone beside it
    for (const b of this.p.bridges) {
      for (const dir of [-1, 1]) {
        const nx = b.x + dir;
        const runs = this.p.bridges.some(o => o.x === nx && o.y === b.y && o.group === b.group);
        if (runs) continue;
        const pier = buildPier();
        pier.group.position.set(nx + 0.5, -(b.y + 0.5) + 0.42, 0);
        this.scene.add(pier.group);
        this.pierMats.push(pier.lampMat);
      }
    }

    // rime — young ice over old work: a crust with a frost fringe and drips,
    // and a crack web that only appears once it is carrying you
    for (let i = 0; i < this.p.rime.length; i++) {
      const r = this.p.rime[i];
      const parts = buildRime(r.x * 31 + r.y * 17);
      parts.group.position.set(r.x + 0.5, -(r.y + 0.5), 0);
      this.scene.add(parts.group);
      this.rimeMeshes.push(parts.group);
      this.rimeParts.push(parts);
    }

    // beams — the watch-lantern on its pedestal, and the wedge it throws.
    // The counterweight arm turns with the head, so even a parked emitter
    // tells you which way it is about to look (△ §III).
    for (const b of this.def.beams ?? []) {
      // the beam is drawn to the radius it actually bites within, never wider
      const mesh = new THREE.Mesh(coneGeometry(BEAM_R), coneMaterial());
      const em = buildEmitter();
      em.group.position.set(b.x, -b.y, 0.1);
      // and the lantern is bolted to something: the head stays on the def's
      // point, where the ray is marched from, and the pedestal reaches out to
      // the nearest surface the room offers — floor first, then ceiling, then
      // either wall. A watch-light hanging in mid-air is furniture the
      // fiction cannot explain.
      const seat = this.emitterSeat(b.x, b.y);
      seatEmitter(em, seat.dir, seat.reach);
      this.scene.add(mesh, em.group);
      this.emitters.push(em);
      this.beamRays.push({ ex: b.x, ey: -b.y, mesh });
    }

    // shuttles — a bolt of light on a wire strung between two stone anchor
    // posts; the rail itself is drawn faint, and always (P2). A snuffer
    // rides the same rail as a slow dark moth instead: near-black, its wing
    // veining glowing violet, self-luminous so the dark can never hide the
    // thief — and never the unlight's ember, because it steals, it does not
    // kill.
    this.currentSpan = (this.def.currents ?? []).map(cu => {
      const openRow = (y: number): boolean => {
        for (let x = cu.x0; x <= cu.x1; x++) if (this.solidTile(x, y)) return false;
        return true;
      };
      let top = Math.min(cu.y0, cu.y1), bot = Math.max(cu.y0, cu.y1);
      while (top > 1 && openRow(top - 1)) top--;
      while (bot < this.p.h - 2 && openRow(bot + 1)) bot++;
      return { x0: cu.x0, y0: top, x1: cu.x1, y1: bot, force: cu.force };
    });

    this.shuttleSpan = (this.def.shuttles ?? []).map(s2 => {
      const asIs = { x0: s2.x0, y0: s2.y0, x1: s2.x1, y1: s2.y1 };
      if (s2.snuff) return asIs;             // a moth is a patrol, not a fixture
      const vertical = Math.abs(s2.y1 - s2.y0) > Math.abs(s2.x1 - s2.x0);
      if (vertical) {
        const x = s2.x0;
        let top = Math.min(s2.y0, s2.y1), bot = Math.max(s2.y0, s2.y1);
        while (top > 1 && !this.solidTile(x, top - 1)) top--;
        // Down to the first stone, or to the FLOOR LINE OF THE GROUND BESIDE
        // IT, whichever comes first. A rail strung over a pit would otherwise
        // hang the length of the hole — eleven courses into a place the body
        // never goes — and the bolt would spend most of its round down there,
        // so the wall of light you are supposed to thread is absent when you
        // jump. A cable is hung across a gap, not down it.
        while (bot < this.p.h - 2 && !this.solidTile(x, bot + 1)
          && !this.solidTile(x - 1, bot + 1) && !this.solidTile(x + 1, bot + 1)) bot++;
        // keep the authored direction, so `phase` still means what it meant
        return s2.y0 <= s2.y1
          ? { x0: x, y0: top, x1: x, y1: bot }
          : { x0: x, y0: bot, x1: x, y1: top };
      }
      // A LEVEL RAIL SITS ONE COURSE ABOVE THE GROUND IT IS STRUNG OVER.
      //
      // Authored heights hung it a storey up, which is not an obstacle at all:
      // a standing body walked underneath 129 of the 269 rail columns in the
      // game, six whole rails end to end. Longer legs only made a tall thing
      // you still walk under — the rail had to come DOWN. At one course up the
      // bolt crosses the body of anything standing there, so it is jumped or
      // waited out. The jump is cheap (0.68 tiles against a 2.68 rise); the
      // timing is the obstacle, which is what a shuttle is for.
      //
      // A level cable needs level ground under it, and that is the AUTHOR's
      // business: a rail over a step should be angled, or moved, or cut short.
      // So this seats the rail only where the floor is flat under the whole
      // span, and leaves an uneven one exactly where it was put — `lint · rail
      // over level ground` names those rather than bending the rail to hide
      // them.
      // GROUND IS SOLID *OR* LETHAL. A stud (`X`) sets kill and not solid, so
      // searching for the first solid tile falls straight through the fangs in
      // a floor and finds whatever is a storey below — which made flat ground
      // with studs in it read as a staircase, and left the rail floating over
      // exactly the corridors it was put there to guard.
      const ground = (x: number, y: number): boolean =>
        this.solidTile(x, y) || (x >= 0 && y >= 0 && x < this.p.w && y < this.p.h
          && !!this.p.kill[y * this.p.w + x]);
      const lo = Math.min(s2.x0, s2.x1), hi = Math.max(s2.x0, s2.x1);
      let floor = -1;
      for (let x = lo; x <= hi; x++) {
        let f = s2.y0;
        while (f < this.p.h - 1 && !ground(x, f + 1)) f++;
        if (f >= this.p.h - 1) return asIs;               // open sky under it
        if (floor < 0) floor = f;
        else if (f !== floor) return asIs;                // a step: not ours to fix
      }
      if (floor < 0 || floor <= s2.y0) return asIs;
      return { x0: s2.x0, y0: floor, x1: s2.x1, y1: floor };
    });

    for (const [si, s2] of (this.def.shuttles ?? []).entries()) {
      const sp = this.shuttleSpan[si];
      const ax = sp.x0 + 0.5, ay = -(sp.y0 + 0.5);
      const bx = sp.x1 + 0.5, by = -(sp.y1 + 0.5);
      const bearing = Math.atan2(by - ay, bx - ax);
      const railGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(ax, ay, 0.05), new THREE.Vector3(bx, by, 0.05),
      ]);
      const railMat = new THREE.LineBasicMaterial({ color: this.hue, transparent: true, opacity: 0.22 });
      const rail = new THREE.Line(railGeo, railMat);
      this.shuttleRailMats.push(railMat);
      // the second wire of the pair, offset a hair — one line is a scratch,
      // two are a rigged cable
      const nx = -Math.sin(bearing) * 0.05, ny = Math.cos(bearing) * 0.05;
      const rail2 = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(ax + nx, ay + ny, 0.05), new THREE.Vector3(bx + nx, by + ny, 0.05),
      ]), railMat);
      // A post stands on what it is bolted to. On a vertical rail that is the
      // ceiling at one end and the floor at the other, so the upper one is
      // turned over to hang from its stone rather than stand on air.
      // NO RAIL POST FLOATS. Whatever the rail's angle — level, plumb or
      // anything between — each end is bolted to the nearest stone, and the
      // leg is built to whatever length that takes. The post turns to face
      // its anchor, so one rule covers a floor stand, a ceiling hanger and a
      // wall bracket without any of them being a special case.
      for (const [px2, py2] of [[ax, ay], [bx, by]] as [number, number][]) {
        const a2 = this.railAnchor(px2, py2);
        const post = buildRailPost();
        if (!a2) {                      // nothing within reach: leave it be
          post.position.set(px2, py2 - 0.28, 0.02);
          this.scene.add(post);
          continue;
        }
        const [dx2, dy2] = a2.dir;
        // the post's own axis runs down its -y, so turn that onto the anchor
        const th = Math.atan2(dx2, -dy2);
        post.rotation.z = th;
        post.position.set(px2 + dx2 * 0.28, py2 + dy2 * 0.28, 0.02);
        const mast = buildRailMast(a2.reach - 0.48);
        mast.rotation.z = th;
        mast.position.set(px2 + dx2 * 0.48, py2 + dy2 * 0.48, 0.02);
        this.scene.add(post, mast);
      }
      this.scene.add(rail, rail2);
      if (s2.snuff) {
        const moth = buildSnuffer();
        this.scene.add(moth.group);
        this.shuttleMeshes.push({ bolt: moth.group, mat: moth.mat });
        this.snufferParts.push(moth);
        this.boltParts.push(null);
      } else {
        const bolt = buildBolt();
        bolt.group.rotation.z = bearing;
        this.scene.add(bolt.group);
        this.shuttleMeshes.push({ bolt: bolt.group, mat: bolt.mat });
        this.snufferParts.push(null);
        this.boltParts.push(bolt);
      }
    }

    // censers — a lantern on a chain, still swinging after all this time,
    // and the arc telegraph that says where its swing goes still (V3.5)
    for (const c of this.def.censers ?? []) {
      const chain = buildChain(c.len);
      chain.position.set(c.x, -c.y, 0.2);
      const parts = buildCenser(CENSER_TOP);
      const light = new THREE.PointLight(0xffd9a0, 2.2, 7, 1.7);
      light.position.y = CENSER_TOP - 0.4;
      parts.bob.add(light);
      const arc = buildArcTelegraph(c.x, c.y, c.len, c.arc, CENSER_TOP);
      this.scene.add(chain, parts.bob, arc.group);
      this.censerMeshes.push({ parts, chain, light, arc });
    }

    // braziers — hanging ember baskets: bronze holds, light works. The
    // chains run to the first stone above; the embers rise out of the mouth
    for (const b of this.p.braziers) {
      let cy = b.y;
      while (cy > 0 && !p.solid[(cy - 1) * p.w + b.x]) cy--;
      const parts = buildBrazier(-(cy - b.y) + 0.1);
      parts.group.position.set(b.x + 0.5, -(b.y + 0.5), 0.3);
      const light = new THREE.PointLight(0xffb060, 1.1, 5, 1.7);
      light.position.set(b.x + 0.5, -(b.y + 0.5) + 0.2, 0.5);
      const embers: THREE.Mesh[] = [];
      for (let k = 0; k < 5; k++) {
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), glowMat(0xffc078, 0.7));
        embers.push(e);
        this.scene.add(e);
      }
      this.scene.add(parts.group, light);
      this.brazierFx.push({ light, embers, x: b.x, y: b.y, bedMat: parts.bedMat, coals: parts.coals });
    }

    // motes — drifting flecks of the world's hue: a hard core inside a soft
    // halo, so a fleck reads as a spark and not a smudge. Language, never
    // mechanics: they trace the arc, mark the drop, edge the shelf in the dark
    for (const mo of this.p.motes) {
      const m = buildMote(this.rimHue);
      this.scene.add(m.group);
      this.moteMeshes.push({
        mesh: m.group, x: mo.x, y: mo.y, mats: m.mats,
        ph: (mo.x * 7 + mo.y * 13) % 6.28,
      });
    }

    // one-way gates — a curtain of light hung in the doorway on a bronze
    // rail, hanging in folds and pooling on the stone under them, with
    // flecks streaming the way it will let you pass
    for (const g2 of this.def.gates ?? []) {
      const gw = g2.x1 - g2.x0 + 1, gh = g2.y1 - g2.y0 + 1;
      const down = (g2.dir ?? 'down') === 'down';
      const parts = buildCurtain(gw, gh, this.hue, down);
      parts.group.position.set(g2.x0 + gw / 2, -(g2.y0 + gh / 2), 0.25);
      this.scene.add(parts.group);
      this.gateMeshes.push({ parts, g: g2, down });
    }

    // currents — the visible rising column: a braided rope of sparks out of
    // a hot vent, warmer and tighter at the floor than the room's falling
    // motes, so the carrier and the fighter can never be confused (grammar §2)
    // drawn to the SEATED span, so the wind you can see is the wind that lifts
    for (const cu of this.currentSpan) {
      const parts = buildCurrent(cu.x0, cu.x1, cu.y0, cu.y1);
      this.scene.add(parts.group);
      this.currentPts.push({ parts, c: cu });
    }

    // crushers — a block of the room's own stone with an ember seam net
    // burning through its working face, riding a bronze ram out of a housing
    // bolted to the wall. Seeing what it comes out of IS the approach read.
    for (const c of this.def.crushers ?? []) {
      const parts = buildCrusher(c.w, c.h, c.dx, c.dy);
      const along = c.dx !== 0;
      // the housing sits behind the rest position, on the far side from travel
      const hx = c.x + c.w / 2 - Math.sign(c.dx) * (c.w / 2 + 0.25);
      const hy = -(c.y + c.h / 2) + Math.sign(c.dy) * (c.h / 2 + 0.25);
      parts.housing.position.set(hx, hy, -0.05);
      parts.ram.position.set(hx, hy, 0.05);
      this.crusherFaceMats.push(parts.faceMat);
      this.scene.add(parts.head, parts.housing, parts.ram);
      this.crusherMeshes.push(parts.head);
      this.crusherRams.push({ ram: parts.ram, ax: hx, ay: hy, along });
    }

    // pursuit — the consumed dark, and the burning front that lights the room
    // ahead of it. That last part is a RULE (§III: "fleeing is also seeing"),
    // so the front carries real lights thrown forward into the unconsumed
    // room, not a bar drawn beside it.
    if (this.def.pursuit) {
      const z = this.def.pursuit.zone;
      const zw = z[2] - z[0] + 1, zh = z[3] - z[1] + 1;
      const vertical = this.def.pursuit.dir === 'down' || this.def.pursuit.dir === 'up';
      const parts = buildPursuit(vertical ? zw : zh);
      // the front is built travelling +x; turn it to the way this wave comes
      parts.edge.rotation.z =
        this.def.pursuit.dir === 'down' ? -Math.PI / 2 :
        this.def.pursuit.dir === 'up' ? Math.PI / 2 :
        this.def.pursuit.dir === 'left' ? Math.PI : 0;
      parts.body.scale.set(zw, zh, 1);
      parts.body.visible = false;
      parts.edge.visible = false;
      this.scene.add(parts.body, parts.edge);
      this.pursuit = parts;
      this.pursuitMesh = parts.body;
      this.pursuitEdgeMesh = parts.edge;
    }

    // THE STANDING DEAD — the same rig the player wears, held in one of four
    // postures, placed so the posture names the hazard ahead (§VI). Their
    // material is near-black and slightly metallic on purpose: the lamp and
    // the sconces catch their edges, so what you read is the silhouette and
    // the rim, which is exactly what the reference sheets are of.
    const figureMat = new THREE.MeshStandardMaterial({
      color: 0x14161f, roughness: 0.42, metalness: 0.22, flatShading: true,
    });
    // the rim the reference sheets are actually of: a back-faced copy of the
    // same posed rig, a hair larger, in the world's hue. The figure itself
    // stays near-black, so what the room shows you is an outline
    const figureRim = new THREE.MeshBasicMaterial({
      color: this.rimHue, side: THREE.BackSide, toneMapped: false,
    });
    for (const f of this.p.figures) {
      const facing = f.x % 2 === 0 ? 1 : -1;
      const suit = buildSuit();
      poseFigure(suit, f.pose, facing);
      suit.group.traverse(o => {
        const m = o as THREE.Mesh;
        if (m.isMesh) { m.material = figureMat; m.renderOrder = 1; }
      });
      const rim = buildSuit();
      poseFigure(rim, f.pose, facing);
      rim.group.traverse(o => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.material = figureRim;
      });
      rim.group.scale.multiplyScalar(1.06);
      const holder = new THREE.Group();
      holder.scale.setScalar(BODY);
      holder.add(rim.group, suit.group);
      // feet on the floor of the tile below the figure's cell, same as the
      // body: the char's row is the LOWER of the two rows a figure occupies
      holder.position.set(f.x + 0.5, -(f.y + 1) + HH, 0.2);
      this.scene.add(holder);
      // the lamp the posture is about: still raised out of the dust, or set
      // down on the stone before he knelt. A hand lamp hangs off the elbow
      // so it stays IN the hand whatever the roll does to the body; a ground
      // lamp hangs off the holder so the figure's yaw cannot walk it away.
      const lamp = figureLampAt(f.pose);
      if (lamp) {
        const lampMat = new THREE.MeshBasicMaterial({
          color: 0xffc078, transparent: true, opacity: 0.95,
          blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
        });
        const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.055, 0.07, 8), figureMat);
        // the flame sits ON the lantern, not inside it — a wick sunk in the
        // housing is a lamp nobody can see is still lit
        const wick = new THREE.Mesh(new THREE.SphereGeometry(0.034, 8, 6), lampMat);
        wick.position.y = 0.055;
        shell.add(wick);
        shell.position.set(...lamp.at);
        if (lamp.mount === 'hand') figureNearElbow(suit, facing).add(shell);
        else holder.add(shell);
        this.figureGlows.push({ mat: lampMat, base: 0.8 });
      }
      // the ember in the chest lamp: still warm, and it rides the pose, so a
      // fallen figure's is on the floor with him instead of hanging in the air
      const emberMat = new THREE.MeshBasicMaterial({
        color: 0xff9a3c, transparent: true, opacity: 0.35, toneMapped: false,
      });
      const ember = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), emberMat);
      ember.position.set(facing * 0.036, -0.005, 0.088);
      suit.group.add(ember);
      this.figureGlows.push({ mat: emberMat, base: 0.3 });
    }

    // the marks this room already carries from earlier attempts this session
    for (const w of SPENT_WICKS.get(this.def.glyph) ?? []) this.addWick(w.x, w.y);

    // master stone
    this.masterGroup = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.8, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x2a2738, roughness: 0.4, metalness: 0.3 }));
    this.masterGroup.add(slab);
    // the mark burns the world's own vivid note, the same hue the stone
    // outside was wearing when you stepped through it
    const mark = buildGlyphMark(this.glyph, 1.1, this.rimHue, true);
    mark.position.z = 0.25;
    this.masterGroup.add(mark);
    // the chamber frame sits closer than the old following camera did, so the
    // stone's own glow is pulled back off the mark to stop it blowing out
    const glow = new THREE.PointLight(this.rimHue, 1.6, 7, 1.6);
    glow.position.z = 1.6;
    this.masterGroup.add(glow);
    // and the chamber the guild built around the word: a stepped dais, two
    // pilasters, a lintel and an inlay ring in the floor (§VI atmosphere §6)
    this.masterGroup.add(buildMasterDressing(this.rimHue));
    this.masterGroup.position.set(this.p.master.x + 0.5, -(this.p.master.y + 0.5), 0);
    this.scene.add(this.masterGroup);

    // entry frame
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.7, 0.15),
      new THREE.MeshBasicMaterial({ color: this.hue, transparent: true, opacity: 0.22 }));
    frame.position.set(this.p.entry.x + 0.5, -(this.p.entry.y + 0.5), -0.3);
    this.scene.add(frame);

    // motes falling the way each zone says down
    const N = 420;
    this.motePos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) this.seedMote(i);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.motePos, 3));
    this.motes = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xd8d2ff, size: 0.06, transparent: true, opacity: 0.5, depthWrite: false }));
    this.scene.add(this.motes);

    if (this.def.wind) {
      const W = 120;
      const wp = new Float32Array(W * 3);
      for (let i = 0; i < W; i++) {
        wp[i * 3] = Math.random() * this.p.w;
        wp[i * 3 + 1] = -Math.random() * this.p.h;
        wp[i * 3 + 2] = 0.2;
      }
      const wg = new THREE.BufferGeometry();
      wg.setAttribute('position', new THREE.BufferAttribute(wp, 3));
      this.windStreaks = new THREE.Points(wg, new THREE.PointsMaterial({ color: 0xcfe0ff, size: 0.09, transparent: true, opacity: 0, depthWrite: false }));
      this.scene.add(this.windStreaks);
    }

    // the pilot — same suit the EVA wears, so the two can never drift
    this.suit = buildSuit();
    // the spark itself rides on the pack, visibly lit or spent
    this.sparkMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.052),
      new THREE.MeshBasicMaterial({ color: 0xbfe8ff }));
    this.sparkMesh.position.copy(this.suit.packAnchor);
    this.lamp = new THREE.PointLight(0xffe6c0, 6, 6 * BODY, 1.6);
    this.lamp.position.set(0, 0, 0.35);
    const body = new THREE.Group();
    body.scale.setScalar(BODY);
    // the spark rides inside the suit group so the pack turns with the
    // shoulders instead of hanging in the air behind a turned body
    this.suit.group.add(this.sparkMesh);
    body.add(this.suit.group, this.lamp);
    this.pilotGroup.add(body);
    this.scene.add(this.pilotGroup);
  }

  /**
   * Tiles-to-nearest-dark-tile, 4-connected and blind to walls: the field the
   * three value bands are cut from. Null when the room has no dark in it at
   * all, which is the signal to leave its masonry alone.
   */
  private darkDistanceField(): Int16Array | null {
    const { p } = this;
    const n = p.w * p.h;
    const d = new Int16Array(n).fill(-1);
    const q: number[] = [];
    for (let i = 0; i < n; i++) if (p.dark[i]) { d[i] = 0; q.push(i); }
    if (!q.length) return null;
    for (let head = 0; head < q.length; head++) {
      const i = q[head];
      if (d[i] >= 6) continue;              // past band 3 nothing changes
      const x = i % p.w, y = (i / p.w) | 0;
      const step = (nx: number, ny: number): void => {
        if (nx < 0 || ny < 0 || nx >= p.w || ny >= p.h) return;
        const j = ny * p.w + nx;
        if (d[j] >= 0) return;
        d[j] = d[i] + 1;
        q.push(j);
      };
      step(x - 1, y); step(x + 1, y); step(x, y - 1); step(x, y + 1);
    }
    return d;
  }

  /**
   * THE RIM-LIGHT LATTICE (§VI). Every exposed face of solid stone carries a
   * faint constant emissive edge in the world's own hue — unlit, so it does
   * not care how far the lamp reaches, and readable a good two tiles past it.
   * Standable geometry therefore always has a shape in the dark.
   *
   * The holes in the lattice are the hazards: an edge that faces an `X` stud
   * gets no rim, so unlight reads as the place where the guild's light
   * stops. The studs carry their own ember seam, which is what keeps this
   * honest against P2 — dark hides floors, never fangs.
   */
  private buildRimLattice(): void {
    const { p } = this;
    const open = (x: number, y: number): boolean => {
      if (x < 0 || y < 0 || x >= p.w || y >= p.h) return false;
      const i = y * p.w + x;
      return !p.solid[i] && !p.kill[i];
    };
    // seeded per vault, so a room's seams are ITS seams, every visit
    let seed = 2166136261;
    for (const c of this.glyph.id) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619) >>> 0;
    const rng = (): number => {
      seed = (seed + 0x6d2b79f5) >>> 0;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    // the age of this room's masonry (§VI). Act I ran long even courses with
    // tight joints and few dead seams; Act II is the same wall with the
    // ornament taken off and a third of its seams given out; Act III is
    // brighter but mismatched, and its cracks wander off their line.
    const dress = LATTICE[this.act];
    const crooked = dress.crooked;

    // The reference (reference-art/architecture) reads as light escaping the
    // masonry, and it obeys four rules the first draft ignored: seams run in
    // long COURSES broken at mason's joints, not per-tile dashes; intensity
    // is uneven along a seam and some seams are dead; the light SPILLS as a
    // gradient into the open air off a hot hairline core; and it pools at
    // corner junctions. All four are geometry: one buffer, vertex colors,
    // additive — black verts cost nothing.

    // contiguous exposed edges, merged into runs per orientation. A run also
    // breaks where the stone changes from live to drank, so the two never
    // share a seam and the boundary between them is a visible joint.
    type Run = { dir: 0 | 1 | 2 | 3; x: number; y: number; len: number; dry: boolean };
    const runs: Run[] = [];
    for (let y = 0; y < p.h; y++) for (const dir of [0, 1] as const) {
      let st = -1, sd = false;
      for (let x = 0; x <= p.w; x++) {
        const ok = x < p.w && !!p.solid[y * p.w + x] && open(x, y + (dir === 0 ? -1 : 1));
        const dry = ok && !!p.dry[y * p.w + x];
        if (ok && st < 0) { st = x; sd = dry; }
        else if (ok && dry !== sd) { runs.push({ dir, x: st, y, len: x - st, dry: sd }); st = x; sd = dry; }
        if (!ok && st >= 0) { runs.push({ dir, x: st, y, len: x - st, dry: sd }); st = -1; }
      }
    }
    for (let x = 0; x < p.w; x++) for (const dir of [2, 3] as const) {
      let st = -1, sd = false;
      for (let y = 0; y <= p.h; y++) {
        const ok = y < p.h && !!p.solid[y * p.w + x] && open(x + (dir === 2 ? -1 : 1), y);
        const dry = ok && !!p.dry[y * p.w + x];
        if (ok && st < 0) { st = y; sd = dry; }
        else if (ok && dry !== sd) { runs.push({ dir, x, y: st, len: y - st, dry: sd }); st = y; sd = dry; }
        if (!ok && st >= 0) { runs.push({ dir, x, y: st, len: y - st, dry: sd }); st = -1; }
      }
    }

    /**
     * Drank stone keeps a rim, and the §III table's word for it — "rimless" —
     * is not followed here on purpose. The lattice is what makes standable
     * geometry readable two tiles past the lamp (P2), and a hole in the
     * lattice already means one thing: an `X` stud, a fang. Giving dead floor
     * no rim would both hide a floor in the dark and collide with that
     * grammar. So it gets a rim drained of the world's colour instead — cold,
     * dim, and mostly dead along its length. The light is still in the shape
     * of the stone; the colour has been drunk out of it.
     */
    const warmRim = new THREE.Color(this.rimHue);
    const dryRim = new THREE.Color(0x9db0c6).multiplyScalar(0.5);
    let hue = warmRim;
    const positions: number[] = [];
    const colors: number[] = [];
    const tri = (ax: number, ay: number, ka: number, bx: number, by: number, kb: number, cx2: number, cy2: number, kc: number): void => {
      positions.push(ax, ay, 0.505, bx, by, 0.505, cx2, cy2, 0.505);
      colors.push(hue.r * ka, hue.g * ka, hue.b * ka, hue.r * kb, hue.g * kb, hue.b * kb, hue.r * kc, hue.g * kc, hue.b * kc);
    };
    /**
     * A seam is a CRACK, not a ruler line: a jagged polyline that wanders
     * off the edge into the stone, flickering in brightness, with the glow
     * spilling out of it into the open air — and here and there it forks,
     * a dead-end branch running deeper into the block and going dark.
     */
    // a bright crack burns toward white at its heart — pure hue reads as
    // painted rope, not light escaping under pressure
    const hot = (k: number): [number, number, number] => {
      const t = Math.max(0, Math.min(1, (k - 0.95) * 0.9));
      return [(hue.r + (1 - hue.r) * t) * k, (hue.g + (1 - hue.g) * t) * k, (hue.b + (1 - hue.b) * t) * k];
    };
    const strip = (pts: { x: number; y: number; k: number }[], w: number): void => {
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dl = Math.hypot(dx, dy) || 1;
        // the line thins where it dims — a taper, not a rope
        const wa = w * (0.45 + 0.55 * Math.min(1, a.k));
        const wb = w * (0.45 + 0.55 * Math.min(1, b.k));
        const nxx = -dy / dl, nyy = dx / dl;
        const ca = hot(a.k), cb = hot(b.k);
        positions.push(
          a.x - nxx * wa, a.y - nyy * wa, 0.505, b.x - nxx * wb, b.y - nyy * wb, 0.505, b.x + nxx * wb, b.y + nyy * wb, 0.505,
          a.x - nxx * wa, a.y - nyy * wa, 0.505, b.x + nxx * wb, b.y + nyy * wb, 0.505, a.x + nxx * wa, a.y + nyy * wa, 0.505);
        colors.push(...ca, ...cb, ...cb, ...ca, ...cb, ...ca);
      }
    };
    const seam = (x0: number, y0: number, x1: number, y1: number, nx: number, ny: number, ka: number, kb: number): void => {
      const tx = x1 - x0, ty = y1 - y0;
      const len = Math.hypot(tx, ty);
      const steps = Math.max(2, Math.round(len / 0.3));
      const pts: { x: number; y: number; k: number }[] = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        // the crack lives IN the rock: it dives into the block and barely
        // grazes back out, never floating in the air
        const into = i === 0 || i === steps ? 0.02 : 0.03 + rng() * (0.14 + crooked * 2);
        const graze = rng() < 0.18 ? 0.025 : 0;
        const o = graze - into;
        const flick = 0.7 + rng() * 0.6;
        pts.push({
          x: x0 + tx * t + nx * o,
          y: y0 + ty * t + ny * o,
          k: Math.min(2.0, (ka + (kb - ka) * t) * flick * 1.4),
        });
      }
      strip(pts, 0.028);
      // forks: dead-end branches running deeper into the stone, going dark
      const nForks = Math.floor(len * 0.35 * rng() + (rng() < 0.5 ? 1 : 0));
      for (let f = 0; f < nForks; f++) {
        const at = pts[1 + Math.floor(rng() * (pts.length - 2))];
        if (!at) continue;
        const drift = (rng() - 0.5) * 1.4;
        const d1 = 0.12 + rng() * 0.14, d2 = d1 + 0.1 + rng() * 0.12;
        const bx1 = at.x - nx * d1 + (ny !== 0 ? drift * d1 : 0), by1 = at.y - ny * d1 + (nx !== 0 ? drift * d1 : 0);
        const bx2 = at.x - nx * d2 + (ny !== 0 ? drift * d2 * 1.6 : 0), by2 = at.y - ny * d2 + (nx !== 0 ? drift * d2 * 1.6 : 0);
        strip([{ x: at.x, y: at.y, k: at.k * 0.8 }, { x: bx1, y: by1, k: at.k * 0.35 }, { x: bx2, y: by2, k: 0 }], 0.02);
      }
      // the glow that escapes: a soft gradient off the edge line into the air
      const ox0 = x0 + nx * 0.2, oy0 = y0 + ny * 0.2;
      const ox1 = x1 + nx * 0.2, oy1 = y1 + ny * 0.2;
      tri(x0, y0, ka * 0.3, x1, y1, kb * 0.3, ox1, oy1, 0);
      tri(x0, y0, ka * 0.3, ox1, oy1, 0, ox0, oy0, 0);
    };
    /** light pooling at a junction: a small fan, hot center, black rim */
    const pool = (cx: number, cy: number, k: number): void => {
      const r = 0.1 + rng() * 0.12, n = 8;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
        tri(cx, cy, k, cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, 0, cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, 0);
      }
    };

    for (const r of runs) {
      hue = r.dry ? dryRim : warmRim;
      // walk the run in mason's segments with joints between them
      let t = 0.04;
      const L = r.len - 0.04;
      while (t < L) {
        const segLen = Math.min(L - t, dress.segMin + rng() * dress.segVar);
        const gap = dress.gapMin + rng() * dress.gapVar;
        // some seams gave out centuries ago; on drank stone most of them did
        const dead = rng() < (r.dry ? 0.5 : dress.dead);
        if (!dead && segLen > 0.25) {
          const ka = (0.45 + rng() * 0.55) * (r.dry ? 0.38 : 1);
          const kb = ka * (0.45 + rng() * 0.55);   // uneven along its own length
          if (r.dir === 0) seam(r.x + t, -r.y, r.x + t + segLen, -r.y, 0, 1, ka, kb);
          else if (r.dir === 1) seam(r.x + t, -(r.y + 1), r.x + t + segLen, -(r.y + 1), 0, -1, ka, kb);
          else if (r.dir === 2) seam(r.x, -(r.y + t), r.x, -(r.y + t + segLen), -1, 0, ka, kb);
          else seam(r.x + 1, -(r.y + t), r.x + 1, -(r.y + t + segLen), 1, 0, ka, kb);
        }
        t += segLen + gap;
      }
    }
    // corner pools where two open faces meet on one block
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
      if (!p.solid[y * p.w + x]) continue;
      const drank = !!p.dry[y * p.w + x];
      hue = drank ? dryRim : warmRim;
      const corners: [boolean, number, number][] = [
        [open(x, y - 1) && open(x - 1, y) && open(x - 1, y - 1), x, -y],
        [open(x, y - 1) && open(x + 1, y) && open(x + 1, y - 1), x + 1, -y],
        [open(x, y + 1) && open(x - 1, y) && open(x - 1, y + 1), x, -(y + 1)],
        [open(x, y + 1) && open(x + 1, y) && open(x + 1, y + 1), x + 1, -(y + 1)],
      ];
      for (const [ok, cx, cy] of corners) {
        if (ok && rng() < (drank ? 0.15 : 0.45)) {
          pool(cx, cy, (0.45 + rng() * 0.45) * (drank ? 0.35 : 1));
        }
      }
    }

    if (!positions.length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
    this.rimMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, vertexColors: true, transparent: true, opacity: LATTICE[this.act].rim,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    });
    const mesh = new THREE.Mesh(geo, this.rimMat);
    mesh.renderOrder = 2;
    this.scene.add(mesh);
  }

  /**
   * Band 3 of the dark: two or three additive fog planes at DISTINCT z, so
   * true black is not a flat void — it parallaxes against itself as the
   * frame travels (atmosphere §2). Only built where the room is actually
   * dark; a lit room has no use for it.
   */
  private buildDarkFog(): void {
    const { p } = this;
    let x0 = p.w, x1 = 0, y0 = p.h, y1 = 0, n = 0;
    for (let y = 0; y < p.h; y++) {
      for (let x = 0; x < p.w; x++) {
        if (!p.dark[y * p.w + x]) continue;
        n++;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x);
        y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
    }
    if (n < 40) return;
    const geo = new THREE.PlaneGeometry(1, 1);
    // z is the whole point: back of the room, just behind the body, and one
    // veil in front of everything
    const layers = [
      { z: -3.4, count: 10, size: 20, op: 0.15, drift: 0.055 },
      { z: -0.9, count: 7, size: 15, op: 0.105, drift: 0.1 },
      { z: 2.3, count: 5, size: 12, op: 0.07, drift: 0.17 },
    ];
    for (const L of layers) {
      const mat = new THREE.MeshBasicMaterial({
        map: softDisc(), color: this.rimHue, transparent: true, opacity: L.op,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      });
      for (let i = 0; i < L.count; i++) {
        const mesh = new THREE.Mesh(geo, mat);
        const w = L.size * (0.7 + Math.random() * 0.6);
        mesh.scale.set(w, w * (0.5 + Math.random() * 0.4), 1);
        mesh.position.set(
          x0 + Math.random() * (x1 - x0 + 1),
          -(y0 + Math.random() * (y1 - y0 + 1)),
          L.z,
        );
        mesh.renderOrder = L.z > 0 ? 3 : 0;
        this.scene.add(mesh);
        this.fog.push({
          mesh, x0: x0 - w, x1: x1 + w,
          vx: L.drift * (Math.random() < 0.5 ? -1 : 1),
        });
      }
    }
  }

  /**
   * A spent wick: the small dark smudge a gutter leaves at the death point,
   * with the same faint ember the standing dead carry — the marks and the
   * guild are drawn in one language on purpose.
   */
  private addWick(x: number, y: number): void {
    // soot over black is nothing, so the mark is a dark core with the HEAT
    // still in its edge: an additive bloom of spent ember around the smudge.
    // That is what makes a floor of them read at a glance.
    const smudge = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.05),
      new THREE.MeshBasicMaterial({
        map: softDisc(), color: 0x07060a, transparent: true,
        opacity: 0.85, depthWrite: false,
      }));
    smudge.position.set(x, y, 0.3);
    const bloom = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.4),
      new THREE.MeshBasicMaterial({
        map: softDisc(), color: 0x4a1c08, transparent: true, opacity: 0.34,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      }));
    bloom.position.set(x, y, 0.29);
    const emberMat = new THREE.MeshBasicMaterial({
      color: 0xff9a3c, transparent: true, opacity: 0.34,
    });
    const ember = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 6), emberMat);
    ember.position.set(x, y + 0.14, 0.33);
    // named so the harness can count the marks a room is carrying
    ember.name = 'figure-ember';
    this.figureGlows.push({ mat: emberMat, base: 0.32 });
    this.scene.add(bloom, smudge, ember);
  }

  private seedMote(i: number): void {
    for (let tries = 0; tries < 20; tries++) {
      const x = Math.random() * this.p.w;
      const y = Math.random() * this.p.h;
      const ti = Math.floor(y) * this.p.w + Math.floor(x);
      if (this.p.solid[ti] || this.p.dark[ti]) continue;
      this.motePos[i * 3] = x;
      this.motePos[i * 3 + 1] = -y;
      this.motePos[i * 3 + 2] = -0.2;
      return;
    }
    this.motePos[i * 3] = -5; this.motePos[i * 3 + 1] = 5;
  }

  // ---------------- movement ----------------

  /**
   * Shift pressed: spend the spark. The world freezes for FREEZE_T (~3
   * frames) — the whole weight of the 2.1-tile burst lives in that hitch —
   * and inside the freeze the aim can still be corrected (the latch), so
   * "I sparked into the floor" dies on the keyboard, not in the level.
   */
  dash(input: Input): void {
    if (this.phase !== 'run' || !this.spark || this.dashT > 0 || this.freezeT > 0) return;
    let dx = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    let dy = (input.up ? 1 : 0) + (input.down ? -1 : 0);
    if (dx === 0 && dy === 0) dx = this.facing;
    this.spark = false;
    this.dashDX = dx;
    this.dashDY = dy;
    this.freezeT = FREEZE_T;
  }

  /** the freeze has run out: the burst actually happens */
  private igniteDash(): void {
    const len = Math.hypot(this.dashDX, this.dashDY) || 1;
    this.dashT = DASH_T;
    this.dashVX = (this.dashDX / len) * DASH_V;
    this.dashVY = (this.dashDY / len) * DASH_V;
    this.vx = this.dashVX;
    this.vy = this.dashVY;
    if (this.dashDX !== 0) this.facing = Math.sign(this.dashDX);
    // the burst leaves a short trail of itself
    for (let i = 0; i < 3; i++) {
      const ghost = new THREE.Mesh(new THREE.CapsuleGeometry(SUIT_R * BODY, SUIT_H * BODY, 3, 6),
        new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.4 - i * 0.1 }));
      ghost.position.set(this.px - this.dashVX * 0.02 * (i + 1), this.py - this.dashVY * 0.02 * (i + 1), 0.05);
      this.scene.add(ghost);
      this.trail.push({ mesh: ghost, t: 0.25 });
    }
  }

  /** jump pressed (edge) — buffered so a slightly-early press still lands */
  jumpPress(): void { this.bufferT = BUFFER; this.jumpHeld = true; this.jumpCut = false; }
  jumpRelease(): void { this.jumpHeld = false; }

  private step(dt: number, input: Input): void {
    const [gx, gy] = this.gravityAt(this.px, this.py);
    const vertical = gx === 0;
    const gSign = vertical ? Math.sign(-gy) : 0; // 1 = falls down, -1 = falls up

    // timers — the jump buffer does not tick down mid-dash, so a press
    // during the burst still fires the frame the burst ends (F8)
    this.coyoteT = Math.max(0, this.coyoteT - dt);
    if (this.dashT <= 0) this.bufferT = Math.max(0, this.bufferT - dt);
    this.wallCoyote = Math.max(0, this.wallCoyote - dt);
    this.wallJumpT = Math.max(0, this.wallJumpT - dt);
    this.dashCarryT = Math.max(0, this.dashCarryT - dt);

    if (this.dashT > 0) {
      // mid-dash: locked velocity, no gravity — the burst is the burst
      this.dashT -= dt;
      this.vx = this.dashVX;
      this.vy = this.dashVY;
      if (this.dashT <= 0) {
        this.vx = Math.sign(this.vx) * Math.min(Math.abs(this.vx), DASH_KEEP);
        this.vy = Math.sign(this.vy) * Math.min(Math.abs(this.vy), DASH_KEEP);
        this.dashCarryT = DASH_CARRY;
        // a spark spent downward never dies to a pixel: snap the last
        // DASH_POP of air onto the floor it was clearly aimed at (F2)
        if (this.dashVY < 0 && gSign > 0) this.dashFloorSnap();
      }
    } else {
      // steering
      let move = (input.left ? -1 : 0) + (input.right ? 1 : 0);
      // a fresh wall-jump's push-out cannot be steered against for ~5
      // frames, so mashing toward the wall does not eat the kick (F9)
      if (this.wallJumpT > 0 && move !== 0 && move === -Math.sign(this.vx)) move = 0;
      if (move !== 0) {
        const accel = this.grounded ? 34 : AIR_CTRL;
        this.vx += move * accel * dt;
        const carrying = this.dashCarryT > 0;
        if (!carrying && Math.abs(this.vx) > WALK && Math.sign(this.vx) === move && this.grounded) this.vx = move * WALK;
        // airborne steering never outruns a dash — the dash is the fast verb
        if (!carrying && !this.grounded && Math.sign(this.vx) === move && Math.abs(this.vx) > 5) this.vx = move * 5;
        this.facing = move;
      } else if (this.grounded && this.dashCarryT <= 0) {
        this.vx -= this.vx * Math.min(1, 14 * dt);
      }
      // kept dash speed bleeds back to WALK over DASH_CARRY — the long-tail
      // window where spark-into-wall-jump chains live (F6)
      if (this.dashCarryT > 0 && Math.abs(this.vx) > WALK) {
        const bleed = (DASH_KEEP - WALK) / DASH_CARRY * dt;
        this.vx = Math.sign(this.vx) * Math.max(WALK, Math.abs(this.vx) - bleed);
      }

      // gravity — half strength in the apex band while jump is held: the
      // ~0.3s crown where every spark decision happens (F4)
      this.vx += gx * dt;
      const crowned = vertical && this.jumpHeld && !this.jumpCut && Math.abs(this.vy) < APEX_BAND;
      this.vy += gy * (crowned ? 0.5 : 1) * dt;

      // wall slide (vertical gravity only): pressing into a wall catches you.
      // A wall-jump is more generous — any wall within WJ_NEAR counts,
      // pressed-into or not, so the wall verbs are unfumbleable and the
      // spark stays the only scarce thing (F9)
      this.wallDir = 0;
      let wallNear = 0;
      if (vertical && !this.grounded) {
        if (this.wallAt(-1, WJ_NEAR)) wallNear = -1;
        else if (this.wallAt(1, WJ_NEAR)) wallNear = 1;
        if (move === -1 && this.wallAt(-1, 0.06)) this.wallDir = -1;
        else if (move === 1 && this.wallAt(1, 0.06)) this.wallDir = 1;
        if (this.wallDir !== 0) {
          this.wallCoyote = COYOTE;
          const falling = gSign > 0 ? this.vy < 0 : this.vy > 0;
          if (falling) {
            const cap = WALL_SLIDE * gSign;
            if (gSign > 0 ? this.vy < -cap : this.vy > -cap) this.vy = -cap;
          }
        }
      }

      // jump: from ground (coyote'd), or off a wall
      if (this.bufferT > 0 && vertical) {
        if (this.grounded || this.coyoteT > 0) {
          this.vy = JUMP * gSign;
          this.grounded = false;
          this.coyoteT = 0;
          this.bufferT = 0;
          this.jumpCut = false;
        } else if (this.wallDir !== 0 || wallNear !== 0 || this.wallCoyote > 0) {
          const off = this.wallDir !== 0 ? this.wallDir : wallNear;
          const away = off !== 0 ? -off : -Math.sign(this.facing);
          this.vy = WALL_JUMP_UP * gSign;
          this.vx = away * WALL_JUMP_OUT;
          this.facing = away;
          this.bufferT = 0;
          this.wallCoyote = 0;
          this.wallJumpT = WJ_LATCH;
          this.jumpCut = false;
        }
      }
      // variable height: let go early and the jump shortens
      if (!this.jumpHeld && !this.jumpCut && vertical) {
        const rising = gSign > 0 ? this.vy > 0 : this.vy < 0;
        if (rising) { this.vy *= 0.45; this.jumpCut = true; }
      }

      // wind
      if (this.def.wind && this.gusting) {
        const w = this.def.wind;
        const wx = Math.floor(this.px), wy = Math.floor(-this.py);
        let sheltered = false;
        for (let d = 1; d <= 2 && !sheltered; d++) {
          const cx = wx - w.dir * d;
          if (this.solidTile(cx, wy) || this.solidTile(cx, wy - 1)) sheltered = true;
        }
        if (!sheltered) this.vx += w.dir * w.force * (this.assist ? 0.6 : 1) * dt;
      }

      // CURRENTS — the rising updraft: a vertical carry, capped so it lifts
      // like a breath and never fires like a cannon (P5). The generosity
      // object: wind was the enemy; this one wind is the road
      for (const cu of this.currentSpan) {
        if (this.px > cu.x0 && this.px < cu.x1 + 1
          && -this.py > cu.y0 && -this.py < cu.y1 + 1 && this.vy < CURRENT_RISE) {
          this.vy = Math.min(CURRENT_RISE, this.vy + cu.force * dt);
        }
      }

      // caps — holding down opens the fall governor (F7)
      const falling = gSign > 0 ? this.vy < 0 : this.vy > 0;
      const maxFall = vertical && input.down && !this.grounded && falling ? FAST_FALL : MAX_FALL;
      this.vy = Math.max(-maxFall, Math.min(maxFall, this.vy));
      this.vx = Math.max(-MAX_FALL, Math.min(MAX_FALL, this.vx));
    }

    // integrate
    const wasGrounded = this.grounded;
    this.grounded = false;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(this.vx), Math.abs(this.vy)) * dt / 0.2));
    const sdt = dt / steps;
    let floorTile: [number, number] | null = null;
    for (let i = 0; i < steps; i++) {
      this.moveX(this.vx * sdt);
      const r = this.moveY(this.vy * sdt, gSign);
      if (r) floorTile = r;
    }
    // CENSER-RIDE (△ §III): the lantern's crown is standable — the threat
    // converts to traversal at the top of its swing, and the body reads the
    // bronze lid as footing (so it re-arms the spark like any floor). The
    // sides still burn; that check below knows to spare the crown.
    this.ridingCenser = -1;
    const cds = this.def.censers ?? [];
    for (let i = 0; i < cds.length; i++) {
      const pos = this.censerPos(i);
      if (vertical && gSign > 0) {
        const top = pos.y + CENSER_TOP;
        if (this.vy <= 0.5 && Math.abs(this.px - pos.x) < 0.5
          && this.py - HH >= top - CENSER_RIDE_BAND && this.py - HH <= top + CENSER_RIDE_BAND) {
          this.px += pos.x - (this.censerPrevX[i] ?? pos.x);  // carried with the swing
          this.py = top + HH + EPS;
          this.vy = 0;
          this.grounded = true;
          this.ridingCenser = i;
        }
      }
      this.censerPrevX[i] = pos.x;
    }

    if (wasGrounded && !this.grounded) this.coyoteT = COYOTE;
    if (this.grounded) {
      // stone underfoot relights the breath — unless the famine drank this
      // course (`=`), which carries you and gives nothing back. `floorTile`
      // is null when the footing is not masonry at all (a censer's crown),
      // and bronze holds its charge, so that refunds like live stone.
      const drank = floorTile
        ? !!this.p.dry[floorTile[1] * this.p.w + floorTile[0]]
        : false;
      if (!drank) this.spark = true;
      this.coyoteT = COYOTE;
    }

    // rime wakes underfoot
    if (floorTile) {
      for (let i = 0; i < this.p.rime.length; i++) {
        const rm = this.p.rime[i];
        if (rm.x === floorTile[0] && rm.y === floorTile[1] && this.rimeState[i].t < 0 && this.rimeState[i].gone <= 0) {
          this.rimeState[i].t = 0;
        }
      }
    }

    // sconces: touch to light (a checkpoint), stand in the glow to relight
    for (let i = 0; i < this.p.sconces.length; i++) {
      const s = this.p.sconces[i];
      const d = Math.hypot(this.px - (s.x + 0.5), this.py + s.y + 0.5);
      if (!this.sconceLit[i] && d < SCONCE_LIGHT_R) {
        this.sconceLit[i] = true;
        this.checkpoint = { x: s.x + 0.5, y: -(s.y + 0.5) - 0.2 };
        if (!this.def.deadLight) this.spark = true;
        this.sconceChord(i);
        this.openDoors();
      } else if (this.sconceLit[i] && !this.def.deadLight && d < SCONCE_SPARK_R) {
        this.spark = true;
      }
    }

    // BRAZIERS (▲ §III): the ember basket refills the spark mid-air within
    // its ring, and is NOT a checkpoint — the author's refill brush without
    // checkpoint inflation. Even the famine cannot starve ductwork
    for (const b of this.p.braziers) {
      if (!this.spark
        && Math.hypot(this.px - (b.x + 0.5), this.py + b.y + 0.5) < SCONCE_SPARK_R) {
        this.spark = true;
      }
    }

    // The master stone, taken ON FOOT. The radius alone fired the moment the
    // body entered it, which for a stone you arrive at by jumping meant the
    // run froze mid-air and the ending was read by an astronaut hovering over
    // the floor. The stone is never solid and always seated a course above its
    // platform, so a body standing under it is comfortably inside the radius:
    // waiting for the feet costs about ten frames and buys a pose that looks
    // like the end of a climb rather than a pause button.
    const m = this.p.master;
    if (this.grounded
      && Math.hypot(this.px - (m.x + 0.5), this.py + m.y + 0.5) < 1.5) {
      this.phase = 'complete';
      this.phaseT = 0;
      this.vx = 0; this.vy = 0;
      this.audio.duck(0.08, 3);      // ducking moment 2 of 4 (atmosphere §5)
      return;
    }

    // ducking moment 3: the first time the dark closes over you, once a run
    if (!this.darkSeen) {
      const tx = Math.floor(this.px), ty = Math.floor(-this.py);
      if (tx >= 0 && ty >= 0 && tx < this.p.w && ty < this.p.h
        && this.p.dark[ty * this.p.w + tx]) {
        this.darkSeen = true;
        this.audio.duck(0.08, 3);
      }
    }

    // THE FALL, checked ahead of the invulnerability gate. A body eight tiles
    // outside the room is not in a scrape that invulnerability can spare it
    // from — it is gone, and gating this would leave it falling for as long
    // as the mercy lasts.
    if (this.def.openEdges && (
      this.py < -(this.p.h + VOID_PAD)
      || this.px < -VOID_PAD || this.px > this.p.w + VOID_PAD)) {
      this.reform();
      return;
    }

    // hazards
    if (this.invuln > 0) return;
    if (this.touchingKill()) { this.reform(); return; }
    for (const b of this.beamRays) {
      const bd = (this.def.beams ?? [])[this.beamRays.indexOf(b)];
      if (!bd) continue;
      // a parked beam is furniture until its arm rect wakes it (△ §III)
      if (!this.beamArmed[this.beamRays.indexOf(b)]) continue;
      const bx = bd.x, by = -bd.y;
      const dx = b.ex - bx, dy = b.ey - by;
      const len2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((this.px - bx) * dx + (this.py - by) * dy) / len2));
      if (Math.hypot(this.px - (bx + dx * t), this.py - (by + dy * t)) < BEAM_R) { this.reform(); return; }
    }
    for (let i = 0; i < (this.def.shuttles ?? []).length; i++) {
      const sdef = this.def.shuttles![i];
      const pos = this.shuttlePos(i);
      if (sdef.snuff) {
        // SNUFFER (▲ §III): it STEALS a charged spark and leaves you
        // standing — no gutter, no re-form; the body-as-meter dims on its
        // own the frame the light goes. A spent spark it ignores.
        if (this.snuffState[i].awake && this.spark && this.snuffState[i].sate <= 0
          && Math.abs(this.px - pos.x) < SNUFF_R + HW
          && Math.abs(this.py - pos.y) < SNUFF_R + HH) {
          this.spark = false;
          this.snuffState[i].sate = SNUFF_SATE;
          this.audio.deny();               // the sting — never the gutter phrase
          this.cam.addShake(SHAKE_CRUSH);  // theft is the other permitted shake (§VI)
        }
        continue;
      }
      // THE LIGHT IS THE HAZARD, and nothing else on the carriage is.
      //
      // This used to be a box half a tile and a bit long down the rail — 1.4
      // tiles end to end — which is nearly twice the bolt that is drawn, and
      // on a VERTICAL rail that ran down the axis the body is tallest in: a
      // 2.44-tile lethal column under an orb you see as less than one. It
      // killed from where nothing was, repeatedly, and there was no way to
      // read that off the screen because the thing doing the killing was not
      // on the screen.
      //
      // The bolt's glass head is what glows and what you track, so it is what
      // bites: a disc at the head's own radius, tested against the body's box
      // by nearest point. The bronze carriage behind it is the vehicle.
      const orb = this.boltOrb(i, pos);
      const cx = Math.max(this.px - HW, Math.min(orb.x, this.px + HW));
      const cy = Math.max(this.py - HH, Math.min(orb.y, this.py + HH));
      if (Math.hypot(orb.x - cx, orb.y - cy) < BOLT_R) { this.reform(); return; }
    }
    for (let i = 0; i < (this.def.censers ?? []).length; i++) {
      if (this.ridingCenser === i) continue;             // standing on the crown
      const pos = this.censerPos(i);
      if (this.py - HH >= pos.y + CENSER_TOP - CENSER_RIDE_BAND) continue; // approaching it
      if (Math.hypot(this.px - pos.x, this.py - pos.y) < 0.55 + HW) { this.reform(); return; }
    }
    for (let i = 0; i < (this.def.crushers ?? []).length; i++) {
      const r = this.crusherRect(i);
      if (this.px + HW > r.x0 && this.px - HW < r.x1 && this.py + HH > r.y1 && this.py - HH < r.y0) {
        // shake fires on exactly two things in this game, and a piston
        // actually landing on you is one of them (precision §5.2)
        this.cam.addShake(SHAKE_CRUSH);
        this.reform();
        return;
      }
    }
    if (this.pursuitOn && this.def.pursuit) {
      const pu = this.def.pursuit;
      const [zx0, zy0, zx1, zy1] = pu.zone;
      const inZone = this.px > zx0 && this.px < zx1 + 1 && -this.py > zy0 && -this.py < zy1 + 1;
      if (inZone) {
        const consumed =
          pu.dir === 'down' ? -this.py < this.pursuitEdge :
          pu.dir === 'up' ? -this.py > this.pursuitEdge :
          pu.dir === 'right' ? this.px < this.pursuitEdge :
          this.px > this.pursuitEdge;
        if (consumed) { this.reform(); return; }
      }
    }
  }

  private moveX(dx: number): void {
    if (dx === 0) return;
    this.px += dx;
    const top = Math.floor(-(this.py + HH - EPS));
    const bot = Math.floor(-(this.py - HH + EPS));
    const dir = Math.sign(dx);
    const c = Math.floor(this.px + dir * HW);
    let hit = false;
    for (let r = top; r <= bot; r++) if (this.bodySolid(c, r, this.py)) { hit = true; break; }
    if (!hit) return;
    // a horizontal spark clipping a ledge lip pops over it instead of
    // dying to it — up to DASH_POP of vertical forgiveness (F2)
    if (this.dashT > 0 && this.dashVY === 0 && this.tryDashPop(c, top, bot)) return;
    this.px = dir > 0 ? c - HW - EPS : c + 1 + HW + EPS;
    this.vx = 0;
    if (this.dashT > 0) this.dashVX = 0;
  }

  /** every tile the body would occupy at (x, y) is air */
  private boxClearAt(x: number, y: number): boolean {
    const l = Math.floor(x - HW + EPS), r = Math.floor(x + HW - EPS);
    const t = Math.floor(-(y + HH - EPS)), b = Math.floor(-(y - HH + EPS));
    for (let rr = t; rr <= b; rr++) for (let cc = l; cc <= r; cc++) if (this.bodySolid(cc, rr, y)) return false;
    return true;
  }

  /** a wall within `reach` tiles of the body's `side` edge */
  private wallAt(side: number, reach: number): boolean {
    const top = Math.floor(-(this.py + HH - EPS));
    const bot = Math.floor(-(this.py - HH + EPS));
    const c = Math.floor(this.px + side * (HW + reach));
    for (let r = top; r <= bot; r++) if (this.bodySolid(c, r, this.py)) return true;
    return false;
  }

  /** F2: the lip pop — clear a shallow ledge edge mid-spark, up or down */
  private tryDashPop(c: number, top: number, bot: number): boolean {
    const rows: number[] = [];
    for (let r = top; r <= bot; r++) if (this.bodySolid(c, r, this.py)) rows.push(r);
    if (rows.length === 0) return false;
    if (rows.every(r => r === bot)) {
      const pen = -bot - (this.py - HH);
      if (pen > 0 && pen <= DASH_POP && this.boxClearAt(this.px, this.py + pen + EPS)) {
        this.py += pen + EPS;
        return true;
      }
    }
    if (rows.every(r => r === top)) {
      const pen = this.py + HH + top + 1;
      if (pen > 0 && pen <= DASH_POP && this.boxClearAt(this.px, this.py - pen - EPS)) {
        this.py -= pen + EPS;
        return true;
      }
    }
    return false;
  }

  /** F2: a downward spark ending within DASH_POP of a floor lands on it */
  private dashFloorSnap(): void {
    const left = Math.floor(this.px - HW + EPS);
    const right = Math.floor(this.px + HW - EPS);
    const r0 = Math.floor(-(this.py - HH));
    const r1 = Math.floor(-(this.py - HH - DASH_POP));
    for (let r = r0; r <= r1; r++) {
      for (let c = left; c <= right; c++) {
        if (this.solidTile(c, r)) {
          const gap = (this.py - HH) - (-r);
          if (gap >= 0 && gap <= DASH_POP) {
            this.py = -r + HH + EPS;
            this.vy = 0;
            this.grounded = true;
          }
          return;
        }
      }
    }
  }

  /**
   * F1: head-bonk corner correction. Rising into a solid corner nudges the
   * body up to CORNER tiles sideways when that alone saves the jump — a
   * one-tile body on a tile grid has zero geometric slack without it.
   */
  private tryCorner(row: number, left: number, right: number): boolean {
    const leftSolid = this.bodySolid(left, row, this.py);
    const rightSolid = this.bodySolid(right, row, this.py);
    if (leftSolid && !rightSolid) {
      const need = (left + 1) - (this.px - HW) + EPS;
      if (need <= CORNER && this.boxClearAt(this.px + need, this.py)) { this.px += need; return true; }
    } else if (rightSolid && !leftSolid) {
      const need = (this.px + HW) - right + EPS;
      if (need <= CORNER && this.boxClearAt(this.px - need, this.py)) { this.px -= need; return true; }
    }
    return false;
  }

  /**
   * ONE-WAY GATES (▲ §III): a falling curtain of light in a doorway. The
   * body passes with the fall freely; against it the curtain's underside is
   * stone — the vault keeps what enters. Checked per substep, before the
   * tile resolve, so a dash cannot tunnel it.
   */
  private gateBlock(dy: number): void {
    for (const g of this.def.gates ?? []) {
      if (this.px + HW <= g.x0 || this.px - HW >= g.x1 + 1) continue;
      if ((g.dir ?? 'down') === 'down') {
        const plane = -(g.y1 + 1);          // the curtain's underside
        if (dy > 0 && this.py + HH > plane && this.py + HH - dy <= plane + EPS) {
          this.py = plane - HH - EPS;
          this.vy = 0;
          if (this.dashT > 0) this.dashVY = 0;
        }
      } else {
        const plane = -g.y0;                // an 'up' gate seals from above
        if (dy < 0 && this.py - HH < plane && this.py - HH - dy >= plane - EPS) {
          this.py = plane + HH + EPS;
          this.vy = 0;
          if (this.dashT > 0) this.dashVY = 0;
        }
      }
    }
  }

  private moveY(dy: number, gSign: number): [number, number] | null {
    this.py += dy;
    if (this.def.gates) this.gateBlock(dy);
    const left = Math.floor(this.px - HW + EPS);
    const right = Math.floor(this.px + HW - EPS);
    let floorTile: [number, number] | null = null;
    if (dy < 0) {
      const r = Math.floor(-(this.py - HH));
      for (let c = left; c <= right; c++) {
        if (!this.solidTile(c, r)) continue;
        // a thin panel catches the feet on its top face and nowhere else: a
        // body already below it is inside open air and keeps falling
        if (this.thinTile(c, r) && this.py - HH < -r - THIN_BAND) continue;
        // falling up (inverted gravity): a shallow corner clips, nudge past it (F1)
        if (gSign < 0 && this.tryCorner(r, left, right)) break;
        this.py = -r + HH + EPS;
        this.vy = 0;
        if (this.dashT > 0) this.dashVY = 0;
        if (gSign > 0) { this.grounded = true; floorTile = [c, r]; }
        break;
      }
    } else if (dy > 0) {
      const r = Math.floor(-(this.py + HH));
      if (r >= 0) {
        for (let c = left; c <= right; c++) {
          if (!this.solidTile(c, r)) continue;
          // the head stops where the stone actually is: the underside of a
          // thin panel, or the underside of the tile for everything else
          const thin = this.thinTile(c, r);
          const plane = thin ? -r - THIN_BAND : -(r + 1);
          if (thin && this.py + HH <= plane) continue;
          // the head-bonk: a rising jump grazing a corner slides past it (F1)
          if (gSign >= 0 && this.tryCorner(r, left, right)) break;
          this.py = plane - HH - EPS;
          this.vy = 0;
          if (this.dashT > 0) this.dashVY = 0;
          if (gSign < 0) { this.grounded = true; floorTile = [c, r]; }
          break;
        }
      }
    }
    return floorTile;
  }

  private touchingKill(): boolean {
    const corners: [number, number][] = [
      [this.px - HW, this.py - HH], [this.px + HW, this.py - HH],
      [this.px - HW, this.py + HH], [this.px + HW, this.py + HH],
    ];
    for (const [x, y] of corners) {
      const tx = Math.floor(x), ty = Math.floor(-y);
      if (tx >= 0 && ty >= 0 && tx < this.p.w && ty < this.p.h && this.p.kill[ty * this.p.w + tx]) return true;
    }
    return false;
  }

  /**
   * THE SCONCE CHORD (§VI). Lighting a sconce is not a pickup sound with a
   * light attached — five systems fire on the same frame and settle
   * together:
   *
   *   1. a real luminance bump across the whole room, which then settles a
   *      notch brighter than it was (`ambient`, in the frame block)
   *   2. the dash-refresh intake, so the room and the body agree that the
   *      breath came back (`audio.chord`)
   *   3. the ambience bed ducks ~6 dB for four seconds
   *   4. the frame eases out ~8 % and settles (`chordT`, in the frame block)
   *   5. the rim lattice strengthens a notch, permanently
   *
   * Plus the game's ONLY positive screenshake, soft. Shake otherwise fires
   * on a crusher impact and a snuffer's theft, and nowhere else — never on
   * jump, land, wall-jump, spark or re-form (precision §5.2).
   */
  private sconceChord(i: number): void {
    this.chordT = 1;
    this.audio.chord(i);
    this.audio.duck(0.5, 4);
    this.cam.addShake(SHAKE_SCONCE);
  }

  /**
   * F, inside a vault: raise the lamp. Toward one of the dead it buys a line
   * of the guild's own voice — free, skippable, and it gates nothing
   * (atmosphere §1.2). Away from them it is just a light lifted.
   */
  raiseLamp(): void {
    if (this.phase !== 'run') return;
    this.lampRaise = 1;
    let best = -1;
    let bd = 4.5;
    for (let i = 0; i < this.p.figures.length; i++) {
      const f = this.p.figures[i];
      const d = Math.hypot(this.px - (f.x + 0.5), this.py + f.y + 1);
      if (d < bd) { bd = d; best = i; }
    }
    if (best < 0 || !this.voice) return;
    this.voice.textContent = GUILD_LINES[this.p.figures[best].pose];
    this.voice.classList.add('on');
    this.voiceT = 6;
  }

  private reform(): void {
    // ONE continuous phrase: the flame collapses, a low tone holds, and the
    // sconce's intake lands as the body re-forms. No sting, no failure
    // sound, and the bed gets out of its way (atmosphere §5).
    this.audio.gutter();
    this.audio.duck(0.08, 3);
    this.reforms++;
    if (this.def.pursuit) { this.pursuitOn = false; this.pursuitDone = false; }
    // the gutter stays where you failed — a dark wick of you, briefly —
    // and you are already back at the sconce. Control returns THIS frame;
    // the re-form animation plays around a body that is yours again, and
    // the camera cuts, never pans: retry time is difficulty in disguise
    // (SPEC-VAULTS-2 F10, precision research on SMB retry economics).
    const ghost = new THREE.Mesh(new THREE.CapsuleGeometry(SUIT_R * BODY, SUIT_H * BODY, 3, 6),
      new THREE.MeshBasicMaterial({ color: 0x1a1420, transparent: true, opacity: 0.5 }));
    ghost.position.set(this.px, this.py, 0.05);
    this.scene.add(ghost);
    this.trail.push({ mesh: ghost, t: 0.4 });
    // the mark stays where the light went out, for the rest of the session
    let wicks = SPENT_WICKS.get(this.def.glyph);
    if (!wicks) { wicks = []; SPENT_WICKS.set(this.def.glyph, wicks); }
    wicks.push({ x: this.px, y: this.py });
    if (wicks.length > WICK_CAP) wicks.shift();
    this.addWick(this.px, this.py);
    this.px = this.checkpoint.x;
    this.py = this.checkpoint.y;
    this.vx = 0; this.vy = 0;
    this.spark = true;
    this.dashT = 0;
    this.freezeT = 0;
    this.dashCarryT = 0;
    this.grounded = false;
    this.coyoteT = COYOTE;      // an instant jump off the re-form always works (F8)
    this.invuln = INVULN_T;
    this.reformT = REFORM_T;    // visual only — the body grows in around control
    // the frame cuts to the checkpoint's chamber; still a cut, never a pan,
    // and still inside the 0.9 s budget (F10)
    this.cutTo(chamberAt(this.p, Math.floor(this.px)));
  }

  private openDoors(): void {
    const lit = this.sconceLit.filter(Boolean).length;
    for (let d = 0; d < this.p.doors.length; d++) {
      const need = this.def.doorNeeds?.[this.p.doors[d].ch] ?? 1;
      if (!this.doorOpen[d] && lit >= need) {
        this.doorOpen[d] = true;
        this.audio.complete();
      }
    }
  }

  // ---------------- P2: dark hides floors, never fangs ----------------

  /**
   * The dark-hazard census, read off the real scene for `scripts/vaults.mjs`.
   *
   * Every hazard's swept VOLUME — not its current position — is walked
   * against the room's `d` tiles. Anything that reaches into the dark has to
   * be self-luminous or carry a visible track, or the darkness is hiding a
   * fang and the room is lying to the player (P2, atmosphere §2).
   *
   * "Self-luminous" is read off the material honestly: an unlit material
   * (Basic/Line/Points) renders at full value no matter how far the lamp is,
   * as does anything additive-blended or carrying emissive.
   */
  darkHazards(): { kind: string; i: number; dark: number; lit: boolean }[] {
    const { p } = this;
    const dark = (x: number, y: number): boolean => {
      const tx = Math.floor(x), ty = Math.floor(-y);
      if (tx < 0 || ty < 0 || tx >= p.w || ty >= p.h) return false;
      return !!p.dark[ty * p.w + tx];
    };
    const luminous = (mats: (THREE.Material | undefined)[]): boolean =>
      mats.some(m => {
        if (!m) return false;
        const any = m as THREE.Material & { emissiveIntensity?: number; isMeshBasicMaterial?: boolean; isLineBasicMaterial?: boolean; isPointsMaterial?: boolean };
        return !!any.isMeshBasicMaterial || !!any.isLineBasicMaterial || !!any.isPointsMaterial
          || m.blending === THREE.AdditiveBlending || (any.emissiveIntensity ?? 0) > 0;
      });
    const out: { kind: string; i: number; dark: number; lit: boolean }[] = [];
    const count = (pts: [number, number][]): number => pts.reduce((n, q) => n + (dark(q[0], q[1]) ? 1 : 0), 0);

    // the unlight studs themselves: their whole point is being in the dark
    let studDark = 0;
    for (let y = 0; y < p.h; y++) {
      for (let x = 0; x < p.w; x++) {
        if (!p.kill[y * p.w + x]) continue;
        if (dark(x - 1, -y) || dark(x + 1, -y) || dark(x, -(y - 1)) || dark(x, -(y + 1))) studDark++;
      }
    }
    if (studDark) out.push({ kind: 'stud', i: 0, dark: studDark, lit: luminous(this.killMats) });

    // shuttles: the rail is the track, the bolt is the light
    const shuttles = this.def.shuttles ?? [];
    for (let i = 0; i < shuttles.length; i++) {
      const sh = shuttles[i];
      const pts: [number, number][] = [];
      for (let t = 0; t <= 40; t++) {
        const u = t / 40;
        pts.push([sh.x0 + 0.5 + (sh.x1 - sh.x0) * u, -(sh.y0 + 0.5) - (sh.y1 - sh.y0) * u]);
      }
      out.push({ kind: 'shuttle', i, dark: count(pts),
        lit: luminous([this.shuttleMeshes[i]?.mat, this.shuttleRailMats[i]]) });
    }

    // censers: the whole arc, not the lantern's current place on it
    const censers = this.def.censers ?? [];
    for (let i = 0; i < censers.length; i++) {
      const c = censers[i];
      const pts: [number, number][] = [];
      for (let t = 0; t <= 24; t++) {
        const a = -c.arc + (2 * c.arc * t) / 24;
        pts.push([c.x + Math.sin(a) * c.len, -c.y - Math.cos(a) * c.len]);
      }
      // the caged glass is the censer's light, and it is read off the live
      // material rather than trusted: a dressing pass that swapped it for a
      // lit surface must fail this, which is the whole point of the lint
      const cm = this.censerMeshes[i];
      const glass = cm?.parts.bob.children.find(o => (o as THREE.Mesh).isMesh
        && ((o as THREE.Mesh).material as THREE.Material & { isMeshBasicMaterial?: boolean }).isMeshBasicMaterial);
      out.push({ kind: 'censer', i, dark: count(pts),
        lit: luminous([(glass as THREE.Mesh | undefined)?.material as THREE.Material | undefined]) });
    }

    // crushers: rest rect ∪ fully-extended rect
    const crushers = this.def.crushers ?? [];
    for (let i = 0; i < crushers.length; i++) {
      const c = crushers[i];
      const pts: [number, number][] = [];
      for (const ext of [0, 1]) {
        for (let dx = 0; dx < c.w; dx++) {
          for (let dy = 0; dy < c.h; dy++) {
            pts.push([c.x + dx + 0.5 + c.dx * ext, -(c.y + dy + 0.5 + c.dy * ext)]);
          }
        }
      }
      out.push({ kind: 'crusher', i, dark: count(pts), lit: luminous([this.crusherFaceMats[i]]) });
    }

    // beams: the cone, marched to first stone at every angle it can point
    const beams = this.def.beams ?? [];
    for (let i = 0; i < beams.length; i++) {
      const b = beams[i];
      const pts: [number, number][] = [];
      for (let a = 0; a < 36; a++) {
        const ang = (a / 36) * Math.PI * 2;
        let ex = b.x, ey = -b.y;
        for (let st = 0; st < BEAM_STEPS; st++) {
          const nx = ex + Math.cos(ang) * BEAM_STEP, ny = ey + Math.sin(ang) * BEAM_STEP;
          if (this.solidTile(Math.floor(nx), Math.floor(-ny))) break;
          ex = nx; ey = ny;
          pts.push([ex, ey]);
        }
      }
      out.push({ kind: 'beam', i, dark: count(pts),
        lit: luminous([this.beamRays[i]?.mesh.material as THREE.Material | undefined]) });
    }

    // the pursuit: its zone, and its burning leading edge
    if (this.def.pursuit) {
      const [zx0, zy0, zx1, zy1] = this.def.pursuit.zone;
      const pts: [number, number][] = [];
      for (let x = zx0; x <= zx1; x++) for (let y = zy0; y <= zy1; y++) pts.push([x + 0.5, -(y + 0.5)]);
      out.push({ kind: 'pursuit', i: 0, dark: count(pts),
        lit: luminous([this.pursuit?.coreMat]) });
    }

    return out;
  }

  // ---------------- hazard positions ----------------

  /**
   * A MOTH IS NOT A BOLT.
   *
   * The snuffer shares the shuttle's def and clock because its PATROL is the
   * same idea — out along a line and back on a period — but a creature that
   * holds a dead straight line at a constant speed does not read as a
   * creature at all; it reads as the machine it borrowed its data from. So
   * the rail is the moth's ROUTE, not its path: it wanders either side of it
   * and dawdles and darts along it.
   *
   * This goes into the position the run actually uses, not into the drawing,
   * because the drawing and the hitbox have to be the same thing — a moth
   * fluttering beside its own collision box would be the same fault as a
   * beam drawn wider than it bites. It is deterministic (layered sines on
   * incommensurate periods, no randomness), so a replay is a replay and the
   * suite can still stand the body in its path.
   *
   * The wander is bounded well inside a tile so a patrol authored down a
   * corridor cannot flutter into the masonry.
   */
  private snufferDrift(i: number, t: number): { x: number; y: number } {
    return {
      x: Math.sin(t * 1.7 + i * 2.3) * 0.22 + Math.sin(t * 0.61 + i) * 0.13,
      y: Math.sin(t * 2.11 + i * 1.3) * 0.17 + Math.sin(t * 0.83 + i * 3.1) * 0.11,
    };
  }

  /**
   * Where the bolt's glass head actually is. buildBolt puts it 0.13 forward of
   * the carriage centre and the carriage is turned to the rail's bearing, so
   * the light a player tracks is NOT the point the shuttle is positioned at.
   * Killing from the carriage centre is off by a sixth of a tile on every
   * axis, which is exactly the sort of gap that reads as an unfair hit.
   */
  private boltOrb(i: number, pos: { x: number; y: number }): { x: number; y: number } {
    const sp = this.shuttleSpan[i];
    const bearing = Math.atan2(-(sp.y1 - sp.y0), sp.x1 - sp.x0);

    return { x: pos.x + Math.cos(bearing) * BOLT_HEAD, y: pos.y + Math.sin(bearing) * BOLT_HEAD };
  }

  private shuttlePos(i: number): { x: number; y: number } {
    const s = this.def.shuttles![i];
    // a snuffer sleeps parked at the rail's start; its own clock only runs
    // once it wakes, so the patrol always begins from where it slept
    const st = this.snuffState[i];
    if (s.snuff && !st.awake) return { x: s.x0 + 0.5, y: -(s.y0 + 0.5) };

    const t = s.snuff ? st.t : this.time;
    const u = (t / (s.period / this.hazardMul()) + (s.snuff ? 0 : s.phase)) % 1;
    let ping = u < 0.5 ? u * 2 : 2 - u * 2;
    let ox = 0, oy = 0;
    if (s.snuff) {
      // it does not hold its speed either: a moth dawdles and then darts
      ping = Math.max(0, Math.min(1,
        ping + Math.sin(t * 1.31 + i) * 0.055 + Math.sin(t * 0.47 + i * 2) * 0.03));
      const d = this.snufferDrift(i, t);
      ox = d.x; oy = d.y;
    }
    const sp = this.shuttleSpan[i];
    return {
      x: sp.x0 + 0.5 + (sp.x1 - sp.x0) * ping + ox,
      y: -(sp.y0 + 0.5) - (sp.y1 - sp.y0) * ping + oy,
    };
  }

  /**
   * What a rail post is bolted to: the nearest stone, floor first.
   *
   * Floor wins ties because a post that stands reads as holding the cable up,
   * which is what a cable wants; a hanger and a bracket are what you fall back
   * on when there is no floor within reach. Returns the direction to the stone
   * and how far the surface is in world units, so the leg can be built to fit.
   */
  railAnchor(wx: number, wy: number): { dir: [number, number]; reach: number } | null {
    const tx = Math.floor(wx), ty = Math.floor(-wy);
    const MAX = 20;
    let best: { dir: [number, number]; reach: number } | null = null;
    const dirs: [number, number][] = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    for (const [dx, dy] of dirs) {
      for (let k = 1; k <= MAX; k++) {
        const cx = tx + dx * k, cy = ty - dy * k;
        if (!this.solidTile(cx, cy)) continue;
        // the face of that tile, not its middle
        const reach = dx !== 0
          ? Math.abs((cx + (dx > 0 ? 0 : 1)) - wx)
          : Math.abs(-(cy + (dy > 0 ? 1 : 0)) - wy);
        if (!best || reach < best.reach - 1e-6) best = { dir: [dx, dy], reach };
        break;
      }
    }
    return best && best.reach > 0.5 ? best : (best ? { ...best, reach: 0.5 } : null);
  }

  /**
   * What a sconce is bolted to. A wall beside it wins — that is the fitting
   * the light-family sheet is of, and it keeps the cup out of the body's
   * path. With no wall, the fitting hangs from the vault above or stands on
   * the floor below, whichever is nearer.
   */
  private sconceSeat(x: number, y: number): SconceMount {
    if (this.solidTile(x - 1, y)) return { kind: 'wall', facing: 1 };
    if (this.solidTile(x + 1, y)) return { kind: 'wall', facing: -1 };
    let up = 0, down = 0;
    while (up < 8 && !this.solidTile(x, y - up - 1)) up++;
    while (down < 8 && !this.solidTile(x, y + down + 1)) down++;
    // A LAMP STANDS ONLY IF THE FLOOR IS RIGHT THERE. A pedestal is a short
    // object — the first cut let one reach as far as it liked and produced a
    // six-tile mast standing in front of the player, which is worse than the
    // floating cup it replaced. Past about a tile the honest fitting is a
    // hung one: a lamp on a long chain is ordinary, a lamp on a long pole is
    // a flagpole.
    if (down <= 1 && down < 8) return { kind: 'floor', reach: down + 0.7 };
    if (up < 8) return { kind: 'ceiling', reach: up + 0.8 };
    if (down < 8) return { kind: 'floor', reach: down + 0.7 };
    return { kind: 'wall', facing: 1 };
  }

  /**
   * Where a watch-lantern's pedestal finds its footing: the nearest solid
   * tile out of the emitter's own point, tried floor first (a lantern
   * STANDS unless the room says otherwise), then ceiling, then either wall.
   * Returns the direction the mount points and how far it has to reach.
   *
   * Dress only — the ray march and the hazard both still start at the def's
   * point, so nothing about where the beam bites moves with the pedestal.
   */
  private emitterSeat(bx: number, by: number): { dir: number; reach: number } {
    const tx = Math.floor(bx), ty = Math.floor(by);
    // dir, tile step, and the world-space face of the tile that stops us
    const probes: { dir: number; sx: number; sy: number; face: (n: number) => number }[] = [
      { dir: 0, sx: 0, sy: 1, face: ny => ny - by },          // floor: its top
      { dir: 1, sx: 0, sy: -1, face: ny => by - (ny + 1) },   // ceiling: its underside
      { dir: 2, sx: 1, sy: 0, face: nx => nx - bx },          // wall right: its left face
      { dir: 3, sx: -1, sy: 0, face: nx => bx - (nx + 1) },   // wall left: its right face
    ];
    let best: { dir: number; reach: number } | null = null;
    let bestScore = Infinity;
    for (const pr of probes) {
      for (let k = 1; k <= 8; k++) {
        const nx = tx + pr.sx * k, ny = ty + pr.sy * k;
        if (!this.solidTile(nx, ny)) continue;
        const reach = Math.max(0.35, pr.face(pr.sy !== 0 ? ny : nx));
        // the floor gets the benefit of the doubt: a lantern STANDS unless
        // the room plainly gives it nothing to stand on
        const score = reach - (pr.dir === 0 ? 0.6 : 0);
        if (score < bestScore) { bestScore = score; best = { dir: pr.dir, reach }; }
        break;
      }
    }
    return best ?? { dir: 0, reach: EMITTER_REACH };
  }

  /**
   * Which way a shuttle is currently running the wire: +1 outbound from the
   * rail's start, -1 on the return. The bolt is a carriage with a nose and a
   * wake, so it has to be flipped on the way back — a light that runs
   * backwards is a light you cannot read the approach of.
   */
  private shuttleHeading(i: number): number {
    const s = this.def.shuttles![i];
    const st = this.snuffState[i];
    const t = s.snuff ? st.t : this.time;
    const u = (t / (s.period / this.hazardMul()) + (s.snuff ? 0 : s.phase)) % 1;
    return u < 0.5 ? 1 : -1;
  }

  private censerPos(i: number): { x: number; y: number } {
    const c = this.def.censers![i];
    const a = c.arc * Math.sin(Math.PI * 2 * (this.time / (c.period / this.hazardMul()) + c.phase));
    return { x: c.x + Math.sin(a) * c.len, y: -c.y - Math.cos(a) * c.len };
  }

  private crusherRect(i: number): { x0: number; y0: number; x1: number; y1: number } {
    const c = this.def.crushers![i];
    const u = (this.time / (c.period / this.hazardMul()) + c.phase) % 1;
    // extend fast, dwell, withdraw, rest
    const ext = u < 0.22 ? u / 0.22 : u < 0.45 ? 1 : u < 0.72 ? 1 - (u - 0.45) / 0.27 : 0;
    const ox = c.dx * ext, oy = c.dy * ext;
    return {
      x0: c.x + ox, y0: -(c.y + oy),
      x1: c.x + c.w + ox, y1: -(c.y + c.h + oy),
    };
  }

  // ---------------- frame ----------------

  frame(dt: number, input: Input, lampOn: boolean): void {
    // spark ignition: the world holds its breath — no time, no hazards, no
    // step — while the latch reads any late aim correction
    if (this.freezeT > 0) {
      this.freezeT -= dt;
      const dx = (input.left ? -1 : 0) + (input.right ? 1 : 0);
      const dy = (input.up ? 1 : 0) + (input.down ? -1 : 0);
      if (dx !== 0 || dy !== 0) { this.dashDX = dx; this.dashDY = dy; }
      if (this.freezeT <= 0) this.igniteDash();
      return;
    }
    this.time += dt;
    const hazardMul = this.hazardMul();

    // bridges — on the beat clock: BRIDGE_PULSES of the room's pulse per
    // full A/b cycle. Assist stretches the pulse, so the ratios survive
    const cycle = (BRIDGE_PULSES * this.pulse) / hazardMul;
    const half = cycle / 2;
    const tc = this.time % cycle;
    this.bridgeOn[0] = tc < half;
    this.bridgeOn[1] = !this.bridgeOn[0];
    const warn = (tc % half) > half - BRIDGE_WARN;

    // snuffers — asleep on the wall until the body crosses the waking ring,
    // then the slow patrol begins, on its own clock (so it always starts
    // from where it slept)
    const sdefs = this.def.shuttles ?? [];
    for (let i = 0; i < sdefs.length; i++) {
      const sd = sdefs[i];
      if (!sd.snuff) continue;
      const st = this.snuffState[i];
      st.sate = Math.max(0, st.sate - dt);
      if (st.awake) st.t += dt;
      else if (this.phase === 'run'
        && Math.hypot(this.px - (sd.x0 + 0.5), this.py + sd.y0 + 0.5) < SNUFF_WAKE) {
        st.awake = true;
      }
    }

    // beams — a PARKED one is dormant furniture: cone drawn dim, pointing
    // at its rest angle, until the body crosses its arm rect (△ §III); its
    // clock starts at the arming, so the rounds begin from rest
    const bdefs = this.def.beams ?? [];
    for (let i = 0; i < bdefs.length; i++) {
      const b = bdefs[i];
      if (!this.beamArmed[i] && this.phase === 'run' && b.arm) {
        const [ax0, ay0, ax1, ay1] = b.arm;
        if (this.px > ax0 && this.px < ax1 + 1 && -this.py > ay0 && -this.py < ay1 + 1) {
          this.beamArmed[i] = true;
          this.beamArmT[i] = this.time;
        }
      }
      const bt = this.beamArmed[i] ? this.time - this.beamArmT[i] : 0;
      let ang: number;
      if (b.spin) {
        ang = Math.PI * 2 * ((bt / (b.period / hazardMul) + b.phase) % 1);
      } else {
        const u = (bt / (b.period / hazardMul) + b.phase) % 1;
        const ping = u < 0.5 ? u * 2 : 2 - u * 2;
        ang = (b.a0 ?? -2.35) + ((b.a1 ?? -0.79) - (b.a0 ?? -2.35)) * ping;
      }
      const ray = this.beamRays[i];
      let ex = b.x, ey = -b.y;
      for (let s = 0; s < BEAM_STEPS; s++) {
        const nx = ex + Math.cos(ang) * BEAM_STEP;
        const ny = ey + Math.sin(ang) * BEAM_STEP;
        if (this.solidTile(Math.floor(nx), Math.floor(-ny))) break;
        ex = nx; ey = ny;
      }
      ray.ex = ex; ray.ey = ey;
      const len = Math.hypot(ex - b.x, ey + b.y);
      // the cone is a wedge built along +x over unit length, so it is placed
      // AT THE LENS — not at the pedestal's foot — and scaled out to whatever
      // the ray march found. The march itself still runs from the def's point,
      // so nothing about where the beam bites has moved.
      ray.mesh.position.set(
        b.x + Math.cos(ang) * 0.16, -b.y + Math.sin(ang) * 0.16, 0.15);
      // x only: the cone's width is already in world units and capped at the
      // collision radius, and scaling it with length is what made the first
      // pass paint a hazard the rule never enforced
      ray.mesh.scale.set(len, 1, 1);
      ray.mesh.rotation.z = ang;
      // the parked cone is visible but plainly asleep, and so is the lantern
      // that throws it: the head turns to its rest angle and the lens goes
      // down to an ember. The counterweight arm still points where it will
      // look, which is what makes a dormant emitter furniture you can read.
      (ray.mesh.material as THREE.MeshBasicMaterial).opacity = this.beamArmed[i] ? 0.5 : 0.14;
      const em = this.emitters[i];
      if (em) {
        em.yoke.rotation.z = ang;
        em.lensMat.opacity = this.beamArmed[i]
          ? 0.85 + Math.sin(this.time * 9 + i) * 0.12 : 0.2;
      }
    }

    // wind
    if (this.def.wind) {
      const w = this.def.wind;
      this.windT += dt;
      const period = w.calm + w.gust;
      this.gusting = (this.windT % period) > w.calm;
      const mat = (this.windStreaks!.material as THREE.PointsMaterial);
      mat.opacity += ((this.gusting ? 0.55 : 0) - mat.opacity) * Math.min(1, dt * 6);
      if (this.gusting) {
        const pos = this.windStreaks!.geometry.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) {
          let x = pos.getX(i) + w.dir * (8 + (i % 5)) * dt;
          if (w.dir < 0 && x < 0) x = this.p.w;
          if (w.dir > 0 && x > this.p.w) x = 0;
          pos.setX(i, x);
        }
        pos.needsUpdate = true;
      }
    }

    // rime
    for (let i = 0; i < this.rimeState.length; i++) {
      const rs = this.rimeState[i];
      const mesh = this.rimeMeshes[i];
      if (rs.gone > 0) {
        if (rs.gone !== Infinity) rs.gone -= dt;
        mesh.visible = false;
        if (rs.gone <= 0) {
          const r = this.p.rime[i];
          if (Math.abs(this.px - (r.x + 0.5)) < 1 && Math.abs(this.py + r.y + 0.5) < 1) rs.gone = 0.4;
          else { rs.t = -1; mesh.visible = true; }
        }
      } else if (rs.t >= 0) {
        rs.t += dt;
        const k = rs.t / RIME_CRUMBLE;
        mesh.position.x = this.p.rime[i].x + 0.5 + Math.sin(this.time * 60) * 0.03 * k;
        // the telegraph the table names: crack lines SPREAD on footfall.
        // They come on from nothing and run wider the longer you stand, so
        // the cost of hesitating is drawn on the thing you are hesitating on.
        this.rimeParts[i].crackMat.opacity = Math.min(1, k * 1.4);
        this.rimeParts[i].cracks.scale.setScalar(0.5 + k * 0.7);
        // a one-shot shelf is gone for the run, not for a cycle: the room
        // that owns the trap never also owns the rhythm (grammar §2)
        if (rs.t >= RIME_CRUMBLE) {
          rs.gone = this.def.rimeOnce ? Infinity : RIME_REGROW;
          rs.t = -1;
        }
      } else {
        this.rimeParts[i].crackMat.opacity = 0;
      }
    }

    // pursuit arming + advance
    if (this.def.pursuit && this.phase === 'run') {
      const pu = this.def.pursuit;
      if (!this.pursuitOn && !this.pursuitDone) {
        const [tx0, ty0, tx1, ty1] = pu.trigger;
        if (this.px > tx0 && this.px < tx1 + 1 && -this.py > ty0 && -this.py < ty1 + 1) {
          this.pursuitOn = true;
          this.pursuitEdge =
            pu.dir === 'down' ? pu.zone[1] :
            pu.dir === 'up' ? pu.zone[3] + 1 :
            pu.dir === 'right' ? pu.zone[0] : pu.zone[2] + 1;
          this.audio.deny();
        }
      } else if (this.pursuitOn) {
        const sp = pu.speed * hazardMul;
        this.pursuitEdge += (pu.dir === 'down' || pu.dir === 'right' ? sp : -sp) * dt;
        const past =
          pu.dir === 'down' ? this.pursuitEdge > pu.zone[3] + 1 :
          pu.dir === 'up' ? this.pursuitEdge < pu.zone[1] :
          pu.dir === 'right' ? this.pursuitEdge > pu.zone[2] + 1 :
          this.pursuitEdge < pu.zone[0];
        if (past) { this.pursuitOn = false; this.pursuitDone = true; }
      }
    }

    if (this.phase === 'complete') {
      this.phaseT += dt;
      const n = Math.floor(this.phaseT / 0.35);
      for (let i = 0; i < Math.min(n, this.sconceLit.length); i++) {
        if (!this.sconceLit[i]) { this.sconceLit[i] = true; this.sconceChord(i); }
      }
      this.masterGroup.scale.setScalar(1 + Math.sin(this.phaseT * 3) * 0.04);
      if (this.phaseT >= 2.4 && !this.completed) {
        this.completed = true;
        this.audio.complete();
        this.showCard();
      }
    } else {
      this.invuln = Math.max(0, this.invuln - dt);
      this.step(dt, input);
    }

    // ---------------- visuals ----------------
    // THE SCONCE CHORD, settling: one envelope drives the luminance bump,
    // the frame's push-out and the lattice's flare, so the five systems can
    // never drift out of agreement with each other (§VI).
    this.chordT = Math.max(0, this.chordT - dt / CHORD_T);
    const chord = this.chordT * this.chordT;
    const lit = this.sconceLit.reduce((n, b) => n + (b ? 1 : 0), 0);
    this.ambient.intensity = AMBIENT_BASE * (1 + 0.055 * lit) + 0.5 * chord;
    if (this.rimMat) {
      this.rimMat.opacity = Math.min(RIM_MAX, LATTICE[this.act].rim + RIM_STEP * lit + 0.12 * chord);
    }
    // the fog banks drift, and their distinct z is what makes the black move
    for (const f of this.fog) {
      let x = f.mesh.position.x + f.vx * dt;
      if (x < f.x0) x = f.x1;
      if (x > f.x1) x = f.x0;
      f.mesh.position.x = x;
    }
    for (let i = 0; i < this.figureGlows.length; i++) {
      const fg = this.figureGlows[i];
      fg.mat.opacity = fg.base * (1 + Math.sin(this.time * 1.3 + i) * 0.22);
    }
    const deadRoom = !!this.def.deadLight;
    for (let i = 0; i < this.sconceMeshes.length; i++) {
      const sm = this.sconceMeshes[i];
      const lit = this.sconceLit[i];
      // an unlit cup is a cold cup: no core, no halo, nothing burning. The
      // sconce ASKS (P1) — it must not look like it has already answered.
      sm.fireMats[0].opacity = lit ? 0.9 : 0;
      sm.fireMats[1].opacity = lit ? 0.5 : 0;
      sm.fireMats[2].opacity = lit ? 0.55 : 0;
      sm.mat.opacity = lit ? 0.85 : 0.5;
      if (deadRoom) {
        // DEADLIGHT (III): what burns in the cracked cup is a guttering
        // blue-white -- it dips near to nothing and claws back, a flame
        // that saves your place and has nothing else left
        const gut = Math.max(0.06,
          Math.sin(this.time * 13 + i) * Math.sin(this.time * 7.3 + i * 2.1));
        sm.light.intensity = lit ? 0.7 + gut * 1.3 : 0;
        sm.mat.color.setHex(lit ? 0x9db8ff : 0x342e22);
        sm.flame.scale.set(0.7, lit ? 0.55 + gut * 0.55 : 0.8, 0.7);
        // and the smoke off it, which is there whether or not it is lit --
        // the cracked cup is the one fitting in the game that shows you it
        // is spent before you have spent anything on it
        for (let k = 0; k < sm.smoke.length; k++) {
          const u = (this.time * 0.42 + k * 0.25) % 1;
          const puff = sm.smoke[k];
          puff.position.y = SCONCE_FLAME_Y + 0.12 + u * 0.85;
          puff.scale.setScalar(0.5 + u * 1.3);
          puff.rotation.z = u * 1.2 + k;
          (puff.material as THREE.MeshBasicMaterial).opacity =
            (lit ? 0.4 : 0.16) * Math.sin(u * Math.PI);
        }
      } else {
        sm.light.intensity = lit ? 2.4 + Math.sin(this.time * 7 + i) * 0.4 : 0;
        sm.mat.color.setHex(lit ? 0xffd9a0 : 0x342e22);
        const f = lit ? 1 + Math.sin(this.time * 9 + i) * 0.15 : 0.8;
        // the flame is already a teardrop in geometry, so it only breathes:
        // the old 1.5 stretch belonged to the sphere it replaced and turned
        // the cone into a spike a tile long
        sm.flame.scale.set(0.9 * f, lit ? f * f : 0.7, 0.9 * f);
      }
    }
    for (let d = 0; d < this.doorMeshes.length; d++) {
      for (const m of this.doorMeshes[d]) {
        const mm = m.material as THREE.MeshStandardMaterial;
        mm.opacity += ((this.doorOpen[d] ? 0 : 1) - mm.opacity) * Math.min(1, dt * 3);
        m.visible = mm.opacity > 0.03;
      }
      // the count on its face fills a pip per sconce lit — arithmetic, and it
      // goes on reading as arithmetic right up until the sum comes out, at
      // which point the register leaves with the masonry it is cut into. It
      // is part of the door, not a fixture hanging in the empty doorway.
      const rune = this.doorRunes[d];
      const vis = (this.doorMeshes[d][0].material as THREE.MeshStandardMaterial).opacity;
      rune.group.visible = vis > 0.03;
      rune.brass.opacity = vis;
      const paid = this.sconceLit.filter(Boolean).length;
      for (let k = 0; k < rune.pips.length; k++) {
        const mm = rune.pips[k].material as THREE.MeshBasicMaterial;
        const on = k < paid;
        const want = (on ? 0.85 + Math.sin(this.time * 3 + k) * 0.12 : 0.12) * vis;
        mm.opacity += (want - mm.opacity) * Math.min(1, dt * 4);
        rune.lamps[k].opacity = (on ? 0.3 : 0.06) * vis;
      }
    }
    for (const bm of this.bridgeMeshes) {
      const on = this.bridgeOn[bm.group];
      const flick = warn && on ? (Math.sin(this.time * 55) > 0 ? 1 : 0.25) : 1;
      bm.mat.opacity = on ? 0.85 * flick : 0.05;
      bm.mesh.scale.y = on ? 1 : 0.35;
      // when the deck is gone the wiring in the stone still shows where it
      // will come back -- a hairline, so the gap is never a mystery
      bm.parts.traceMat.opacity = on ? 0.16 : 0.55 + Math.sin(this.time * 2.4) * 0.1;
    }
    // the piers never go out: they are the fixed ends the phase reads between
    for (let i = 0; i < this.pierMats.length; i++) {
      this.pierMats[i].opacity = 0.8 + Math.sin(this.time * 4 + i) * 0.08;
    }
    for (let i = 0; i < this.shuttleMeshes.length; i++) {
      const pos = this.shuttlePos(i);
      this.shuttleMeshes[i].bolt.position.set(pos.x, pos.y, 0.15);
      const moth = this.snufferParts[i];
      if (moth) {
        // the moth's three states. ASLEEP: wings folded roof-like over the
        // back, veining down to a smoulder, antennae still. FLYING: a slow
        // deep beat, the veining breathing with it. FEEDING: it has just
        // taken your light, and for that moment it is full of it.
        const st = this.snuffState[i];
        const feeding = st.sate > 0;
        // where it is actually going this frame, which is what it should look
        // like it is doing: a creature turns into its own travel
        const prev = this.snuffPrev[i];
        const mvx = prev ? pos.x - prev.x : 0;
        const mvy = prev ? pos.y - prev.y : 0;
        this.snuffPrev[i] = { x: pos.x, y: pos.y };
        const speed = Math.hypot(mvx, mvy) / Math.max(dt, 1e-4);
        // the beat quickens with the work, the way a heavy moth's does
        const beat = feeding ? 22 : 5.5 + Math.min(6, speed * 1.6);
        const flap = feeding ? 0.15 + Math.sin(this.time * beat + i) * 0.35
          : st.awake ? 0.42 + Math.sin(this.time * beat + i) * 0.6
            : 1.25;
        // the two wings are never quite in phase — the tell that it is alive
        moth.wings[0].rotation.y = flap;
        moth.wings[1].rotation.y = -(flap * 0.94 + 0.04);
        if (st.awake) {
          if (Math.abs(mvx) > 1e-4) moth.group.scale.x = Math.sign(mvx);
          // it banks into a climb and noses down into a descent
          const bank = Math.max(-0.55, Math.min(0.55, -mvy / Math.max(dt, 1e-4) * 0.09));
          moth.group.rotation.z += (bank - moth.group.rotation.z) * Math.min(1, dt * 7);
        } else {
          // asleep it hangs nose-over against the rail
          moth.group.rotation.z += (0.5 - moth.group.rotation.z) * Math.min(1, dt * 5);
        }
        for (const a of moth.antennae) a.rotation.x = st.awake ? Math.sin(this.time * 9) * 0.3 : 0;
        this.shuttleMeshes[i].mat.opacity = feeding
          ? 0.95 * Math.min(1, st.sate / SNUFF_SATE + 0.25)
          : st.awake ? 0.55 + Math.sin(this.time * 5 + i) * 0.15 : 0.2;
      } else {
        const bolt = this.boltParts[i];
        this.shuttleMeshes[i].mat.opacity = 0.8 + Math.sin(this.time * 24 + i) * 0.18;
        // the carriage runs nose-first, so a bolt says which way it is going
        // before it is anywhere near you
        if (bolt) {
          bolt.group.scale.x = this.shuttleHeading(i);
          bolt.wake.scale.set(0.8 + Math.sin(this.time * 11 + i) * 0.2, 1, 1);
        }
      }
    }
    for (let i = 0; i < this.censerMeshes.length; i++) {
      const c = this.def.censers![i];
      const pos = this.censerPos(i);
      const cm = this.censerMeshes[i];
      cm.parts.bob.position.set(pos.x, pos.y, 0.2);
      cm.chain.position.set(c.x, -c.y, 0.2);
      // the chain hangs to the lantern, and the SHACKLE turns under it — but
      // the lantern itself stays level. The crown is a floor and its collision
      // is a flat horizontal top; a deck drawn on the tilt is the picture
      // arguing with the rule, right at the moment the player is trying to
      // land on it. The pin is what makes level read as deliberate.
      const swing = Math.atan2(pos.x - c.x, -(pos.y + c.y));
      cm.chain.rotation.z = swing;
      cm.parts.hanger.rotation.z = swing;
      cm.light.intensity = 2 + Math.sin(this.time * 8 + i) * 0.4;
      cm.parts.flame.scale.set(0.8, 1.5 + Math.sin(this.time * 11 + i) * 0.2, 0.8);

      // THE ARC TELEGRAPH. `u` is where in the swing the lantern is: -1 at
      // one apex, +1 at the other, 0 through the fast bottom. A pendulum is
      // briefly still at the ends and runs at nearly twice walk through the
      // middle, and until now nothing on screen said so. The trace is drawn
      // once, bright where the swing dwells; the pads are the two catchable
      // places, and the one FILLING is the one arriving -- which is the when
      // that a still picture could never carry.
      const u = Math.sin(Math.PI * 2 * (this.time / (c.period / hazardMul) + c.phase));
      for (const k of [0, 1]) {
        const near = Math.max(0, u * (k === 0 ? -1 : 1));   // 1 at that apex
        cm.arc.padMats[k].opacity = 0.16 + Math.pow(near, 3) * 0.7 + (near > 0.985 ? 0.2 : 0);
        cm.arc.pads[k].scale.setScalar(1 + Math.pow(near, 4) * 0.16);
      }
      // and the smoke off the crown, so travel has a direction at a glance
      for (let k = 0; k < cm.arc.puffs.length; k++) {
        const lag = (k + 1) * 0.075;
        const a = c.arc * Math.sin(Math.PI * 2 * ((this.time - lag) / (c.period / hazardMul) + c.phase));
        const puff = cm.arc.puffs[k];
        puff.position.set(
          c.x + Math.sin(a) * c.len,
          -c.y - Math.cos(a) * c.len + CENSER_TOP + 0.1 + k * 0.06, 0.07);
        puff.scale.setScalar(0.6 + k * 0.2);
        (puff.material as THREE.MeshBasicMaterial).opacity = 0.26 * (1 - k / cm.arc.puffs.length);
      }
      // the deck lights up as it comes to rest -- the crown says "floor"
      // loudest exactly when it is standing still enough to be landed on
      cm.parts.crownMat.opacity = 0.18 + Math.pow(Math.abs(u), 4) * 0.5;
    }
    // motes -- each fleck drifts a slow private orbit around its tile
    for (const mo of this.moteMeshes) {
      mo.mesh.position.set(
        mo.x + 0.5 + Math.sin(this.time * 0.7 + mo.ph) * 0.34,
        -(mo.y + 0.5) + Math.sin(this.time * 0.53 + mo.ph * 1.7) * 0.28,
        0.25);
      const k = 0.45 + Math.sin(this.time * 1.3 + mo.ph) * 0.22;
      mo.mats[0].opacity = k * 0.9;
      mo.mats[1].opacity = k * 1.5;
    }
    // braziers -- the coal bed breathes, and embers climb out of the mouth
    // and die a tile up
    for (const bf of this.brazierFx) {
      const breath = Math.sin(this.time * 6 + bf.x);
      bf.light.intensity = 1.1 + breath * 0.25;
      bf.bedMat.opacity = 0.7 + breath * 0.18;
      for (let k = 0; k < bf.coals.length; k++) {
        (bf.coals[k].material as THREE.MeshBasicMaterial).opacity =
          0.55 + Math.sin(this.time * 3.1 + k * 1.7) * 0.35;
      }
      for (let k = 0; k < bf.embers.length; k++) {
        const u = (this.time * 0.4 + k * 0.37 + bf.x * 0.13) % 1;
        const e = bf.embers[k];
        e.position.set(
          bf.x + 0.5 + Math.sin((u + k) * 9) * 0.13,
          -(bf.y + 0.5) + 0.25 + u * 1.05,
          0.32);
        (e.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - u);
      }
    }
    // one-way gates — the fall runs on the current's own system, mirrored:
    // sprites tightening as they arrive, braids of haze behind them, a pool
    // where it meets the stone. The hard line along the underside is the
    // rule made visible, and it pulses on its own beat so it never reads as
    // part of the falling light.
    for (const gm of this.gateMeshes) {
      const gp = gm.parts.pts.geometry.getAttribute('position') as THREE.BufferAttribute;
      const gh = gm.g.y1 - gm.g.y0 + 1;
      const gw = gm.g.x1 - gm.g.x0 + 1;
      for (let i = 0; i < gp.count; i++) {
        let y = gp.getY(i) + (2.6 + (i % 5) * 0.5) * dt * (gm.down ? -1 : 1);
        const past = gm.down ? y < -gh / 2 : y > gh / 2;
        if (past) {
          y = gm.down ? gh / 2 : -gh / 2;
          gp.setX(i, (Math.random() - 0.5) * gw);
        }
        gp.setY(i, y);
      }
      gp.needsUpdate = true;
      for (let k = 0; k < gm.parts.braids.length; k++) {
        const b2 = gm.parts.braids[k];
        b2.rotation.z = Math.sin(this.time * 0.5 + k * 2.1) * 0.05;
        b2.scale.x = 0.65 + Math.sin(this.time * 1.1 + k * 1.9) * 0.3;
        (b2.material as THREE.MeshBasicMaterial).opacity = 0.13 + Math.sin(this.time * 1.7 + k) * 0.06;
      }
      gm.parts.poolMat.opacity = 0.42 + Math.sin(this.time * 2.1) * 0.1;
      gm.parts.sillMat.opacity = 0.6 + Math.sin(this.time * 3.4) * 0.18;
    }
    // currents -- the column's sparks rise and the braids twist behind them;
    // the fighter falls, the carrier climbs, and the eye tells them apart
    for (const { parts, c } of this.currentPts) {
      const cpos = parts.pts.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < cpos.count; i++) {
        let y = cpos.getY(i) + (3 + (i % 5) * 0.6) * dt;
        if (y > -c.y0) {
          y = -(c.y1 + 1);
          cpos.setX(i, c.x0 + Math.random() * (c.x1 - c.x0 + 1));
        }
        cpos.setY(i, y);
      }
      cpos.needsUpdate = true;
      for (let k = 0; k < parts.braids.length; k++) {
        const b = parts.braids[k];
        b.rotation.z = Math.sin(this.time * 0.5 + k * 2.1) * 0.06;
        b.scale.x = 0.7 + Math.sin(this.time * 1.1 + k * 1.9) * 0.3;
        (b.material as THREE.MeshBasicMaterial).opacity = 0.13 + Math.sin(this.time * 1.7 + k) * 0.06;
      }
      parts.ventMat.opacity = 0.5 + Math.sin(this.time * 5.3) * 0.12;
    }
    for (let i = 0; i < this.crusherMeshes.length; i++) {
      const r = this.crusherRect(i);
      const hx = (r.x0 + r.x1) / 2, hy = (r.y0 + r.y1) / 2;
      this.crusherMeshes[i].position.set(hx, hy, 0);
      // the ram stretches between the housing and the head, so you can see
      // what the block is riding on and where it came out of
      const rm = this.crusherRams[i];
      const len = Math.max(0.2, Math.hypot(hx - rm.ax, hy - rm.ay));
      rm.ram.position.set((hx + rm.ax) / 2, (hy + rm.ay) / 2, 0.05);
      if (rm.along) rm.ram.scale.set(1, len, 1);
      else rm.ram.scale.set(1, len, 1);
      // and the seam runs hotter the further out of its housing it is: an
      // extending piston is a piston under load (P2, the working-face tell)
      const out = Math.min(1, len / 2.2);
      (this.crusherFaceMats[i] as THREE.MeshBasicMaterial).opacity = 0.42 + out * 0.5;
    }
    if (this.def.pursuit && this.pursuitMesh && this.pursuitEdgeMesh) {
      const pu = this.def.pursuit;
      const [zx0, zy0, zx1, zy1] = pu.zone;
      const on = this.pursuitOn;
      this.pursuitMesh.visible = on;
      this.pursuitEdgeMesh.visible = on;
      if (on && this.pursuit) {
        const zw = zx1 - zx0 + 1, zh = zy1 - zy0 + 1;
        if (pu.dir === 'down') {
          const top = -zy0, edge = -this.pursuitEdge;
          this.pursuitMesh.scale.set(zw, Math.max(0.001, top - edge), 1);
          this.pursuitMesh.position.set((zx0 + zx1 + 1) / 2, (top + edge) / 2, 0.45);
          this.pursuitEdgeMesh.position.set((zx0 + zx1 + 1) / 2, edge, 0.46);
        } else if (pu.dir === 'right') {
          const left = zx0, edge = this.pursuitEdge;
          this.pursuitMesh.scale.set(Math.max(0.001, edge - left), zh, 1);
          this.pursuitMesh.position.set((left + edge) / 2, -(zy0 + zy1 + 1) / 2, 0.45);
          this.pursuitEdgeMesh.position.set(edge, -(zy0 + zy1 + 1) / 2, 0.46);
        }
        // the burn is not steady — it is eating something
        const flick = 0.8 + Math.sin(this.time * 21) * 0.12 + Math.sin(this.time * 37) * 0.08;
        this.pursuit.coreMat.opacity = flick;
        for (let i = 0; i < this.pursuit.lights.length; i++) {
          this.pursuit.lights[i].intensity = 3.2 * flick + Math.sin(this.time * 9 + i) * 0.4;
        }
        // embers off the front, drifting into the room it is about to take
        const span = pu.dir === 'down' || pu.dir === 'up' ? zw : zh;
        for (let i = 0; i < this.pursuit.embers.length; i++) {
          const u = (this.time * 0.7 + i * 0.31) % 1;
          const e = this.pursuit.embers[i];
          e.position.set(0.3 + u * 2.2, (((i * 0.37) % 1) - 0.5) * span, 0.5);
          e.scale.setScalar(0.6 + u * 0.9);
          (e.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - u);
        }
      }
    }
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const t = this.trail[i];
      t.t -= dt;
      (t.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, t.t * 1.6);
      if (t.t <= 0) {
        // each ghost owns a fresh geometry + material; out of the scene by
        // dispose() time, so they must be freed here or they pile up in VRAM
        this.scene.remove(t.mesh);
        t.mesh.geometry.dispose();
        (t.mesh.material as THREE.Material).dispose();
        this.trail.splice(i, 1);
      }
    }
    // re-form grow-in, cosmetic only — input already works
    if (this.reformT > 0) {
      this.reformT = Math.max(0, this.reformT - dt);
      this.pilotGroup.scale.setScalar(Math.max(0.15, 1 - this.reformT / REFORM_T));
    } else if (this.pilotGroup.scale.x !== 1) {
      this.pilotGroup.scale.setScalar(1);
    }
    // the body is the meter (F12): charged, the suit throws light on the
    // stone around it; spent, the room steps closer. Readable peripherally,
    // and in the dark rooms the meter IS the visibility.
    const lampTarget = (lampOn ? (this.spark ? 6 : 3.2) : (this.spark ? 1.6 : 0.6))
      * (1 + 0.5 * this.lampRaise);
    this.lamp.intensity += (lampTarget - this.lamp.intensity) * Math.min(1, dt * 12);
    const reachTarget = (this.spark ? 6 : 4) * BODY;
    this.lamp.distance += (reachTarget - this.lamp.distance) * Math.min(1, dt * 8);
    const dot = this.masterGroup.getObjectByName('glyph-light');
    if (dot) dot.scale.setScalar(1 + Math.sin(this.time * 2.4) * 0.2);

    // motes
    const pos = this.motes.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const [gx, gy] = this.gravityAt(x, y);
      const nx = x + (gx / GRAV) * 0.45 * dt;
      const ny = y + (gy / GRAV) * 0.45 * dt;
      const ti = Math.floor(-ny) * this.p.w + Math.floor(nx);
      if (nx < 0 || nx >= this.p.w || -ny >= this.p.h || -ny < 0 || this.p.solid[ti]) {
        this.seedMote(i);
      } else {
        pos.setXY(i, nx, ny);
      }
    }
    pos.needsUpdate = true;

    // pilot mesh + spark + camera + hud
    this.walkT += dt * Math.abs(this.vx) * 4;
    const gDown = this.gravityAt(this.px, this.py)[1] < 0;
    poseSuit(this.suit, {
      dt, walkT: this.walkT, time: this.time,
      speed01: Math.min(1, Math.abs(this.vx) / WALK),
      grounded: this.grounded, facing: this.facing,
      vy: gDown ? this.vy : -this.vy,
      wall: this.wallDir,
      wallKick: this.wallJumpT > 0,
      dash: this.dashT > 0 ? { x: this.dashVX / DASH_V, y: this.dashVY / DASH_V } : null,
      crouch: this.grounded && input.down,
      fastFall: !this.grounded && input.down && (gDown ? this.vy < 0 : this.vy > 0),
    });
    this.pilotGroup.position.set(this.px, this.py, 0.1);
    const sm = this.sparkMesh.material as THREE.MeshBasicMaterial;
    sm.color.setHex(this.spark ? 0xbfe8ff : 0x2a3038);
    this.sparkMesh.rotation.y += dt * 3;
    this.sparkMesh.scale.setScalar(this.spark ? 1 + Math.sin(this.time * 6) * 0.15 : 0.7);
    // F11 — the frame holds one chamber and CUTS when the body leaves it.
    // Horizontally it never moves at all; vertically it still follows,
    // because chambers are column splits and these rooms are tall.
    const want = this.chamberOf(this.px);
    if (want !== this.chamber) this.cutTo(want);
    const { cx, cz } = this.chamberFrame(this.chamber);
    const ez = cz * (1 + 0.08 * chord);
    const [yMin, yMax] = this.camYBand(ez);
    this.cam.followChamber(dt, cx, ez, this.py + 0.5, this.vy, yMin, yMax);

    // the raised lamp: the light lifts and reaches while it is held up
    this.lampRaise = Math.max(0, this.lampRaise - dt * 1.4);
    this.lamp.position.y = 0.35 * this.lampRaise;
    if (this.voiceT > 0) {
      this.voiceT -= dt;
      if (this.voiceT <= 0) this.voice?.classList.remove('on');
    }
    const pip = this.hud.querySelector('.vh-spark') as HTMLDivElement | null;
    if (pip) pip.className = 'vh-spark' + (this.spark ? ' lit' : '');
  }

  // ---------------- lifecycle ----------------

  private showCard(): void {
    this.card = document.createElement('div');
    this.card.id = 'vault-card';
    this.card.innerHTML = `
      <div class="vc-glyph">${glyphSvg(this.glyph, 'vc-svg')}</div>
      <div class="vc-name">${this.glyph.name}</div>
      <div class="vc-text">${this.glyph.fragment}</div>
      <div class="vc-reforms">${this.reforms === 0
        ? 'no light spent'
        : `${this.reforms} ${this.reforms === 1 ? 'light' : 'lights'} spent`}</div>
      <div class="vc-hint">E — STEP BACK THROUGH THE STONE</div>`;
    this.hud.parentElement?.appendChild(this.card);
  }

  interact(): void {
    if (this.completed) { this.closed = true; return; }
    const e = this.p.entry;
    if (Math.hypot(this.px - (e.x + 0.5), this.py + e.y + 0.5) < 1.1) this.closed = true;
  }

  abandon(): void { this.closed = true; }

  resize(aspect: number): void {
    this.cam.camera.aspect = aspect;
    this.cam.camera.updateProjectionMatrix();
  }

  render(renderer: THREE.WebGLRenderer): void {
    renderer.render(this.scene, this.cam.camera);
  }

  dispose(): void {
    this.hud.remove();
    this.card?.remove();
    this.voice?.remove();
    const mats = new Set<THREE.Material>();
    this.scene.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose?.();
      const list = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const mat of list) mats.add(mat);
    });
    for (const mat of mats) mat.dispose();
    // ghosts still fading when the run ends live outside the scene traverse
    for (const t of this.trail) {
      t.mesh.geometry.dispose();
      (t.mesh.material as THREE.Material).dispose();
    }
  }
}
