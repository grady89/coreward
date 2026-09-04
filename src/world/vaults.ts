// THE NINE STONES — vault interiors, second pass (SPEC-GLYPHS.md §3).
//
// Rebuilt after the first playtest as REAL levels: Celeste-screen logic on
// the light-dash movement set (one spark, refreshed by stone underfoot or
// a lit sconce in reach; wall-slide and wall-jump free). Each level is a
// sequence of ideas — introduced safe, tested sharp, then combined — and
// the acts ramp: VEIL-3 teaches, CRYOS-2 tests, MAELIS-6 examines.
//
// Legend:
//   #  masonry (solid)          .  air
//   d  air, DARK — your lamp is what finds the geometry
//   S  sconce (unlit)           @  entry (spawn + first checkpoint)
//   M  the master stone         X  unlight — touch it and you gutter out
//   A  light bridge, group A    b  light bridge, group B (A on while b off)
//   R  rime shelf — crumbles underfoot, regrows later
//   ^  air, gravity points UP   >  air, gravity points RIGHT
//   <  air, gravity points LEFT
//   1 2  door masonry — melts open once enough sconces burn (def.doorNeeds)
//   =  DEAD SURFACE — masonry the famine drank. Solid and perfectly safe to
//      stand on, and it gives NOTHING back: the spark you spent stays spent
//      while you walk it. Where you put it is a per-room decision, not a
//      global one — it is the authoring brush that makes a spent spark last
//      longer than a jump (SPEC-VAULTS-2 §III, precision §2.3)
//   o  MOTE — a drifting fleck of the world's hue. Pure language, zero
//      mechanics: it traces jump arcs, marks safe drops, edges shelves in
//      the dark (SPEC-VAULTS-2 §III)
//   *  BRAZIER — a hanging ember basket. Refills the spark MID-AIR within
//      its ring (~1.4 tiles, a lit sconce's reach) but is NOT a checkpoint:
//      the author's refill brush without checkpoint inflation
//
// THE SPARK LEDGER (P1 — one breath of light). Every kit element classified
// by its spark relationship, with the line of Lamplighter craft that pays
// for it (house law: a mechanic nobody can explain as guild-work does not
// ship). `scripts/vaults.mjs` asserts this table is total over the parsed
// kit — an element that earns no classification is cut or converted.
//
//   element        spark      the guild's line
//   ------------   --------   ----------------------------------------------
//   stone floor    refunds    the guild's own masonry still holds a charge
//   dead surface = withholds  stone the famine drank
//   sconce         refunds    a light waiting for its keeper
//   famine sconce  saves      it remembers you; it has nothing to give
//   brazier *      refunds    ductwork the guild never turned off
//   mote o         shapes     spilled light, still falling
//   unlight stud X shapes     where the dark bit through
//   dark d         shapes     what the famine left of the halls
//   beam           forbids    watch-lights still on rounds
//   light bridge   clocks     floors the guild could afford only half the time
//   rime shelf R   demands    young ice over old work
//   shuttle        clocks     bolts still walking the wire
//   snuffer        steals     what the famine made hungry
//   censer         clocks     ride the lantern the way the keepers did
//   crusher        demands    pistons that never got the order to stop
//   pursuit        demands    the dark, arriving
//   wind (gust)    fights     weather, which is everything on a surface
//   current        carries    the updraft of the deep vents
//   gravity zone   reframes   space is MAELIS-6's organ
//   one-way gate   commits    the vault keeps what enters
//   door 1 2       prices     arithmetic, not a lock
//   figure KFCN    story      the ones who stayed
//   master M       payoff     the word itself
//
// THE BEAT CLOCK (§III): one pulse per vault — PULSE seconds, overridable
// per def (`clock`). Every cyclic hazard's period is an integer multiple of
// the pulse (bridges 4, censers 3, shuttles 2–4, crushers 3–4, spin beams
// 4–8, wind calm/gust 4/3) and phases quantize to quarter-pulses, so a room
// is one groove instead of four timers. `vaults.mjs` lints the ratios.
//
// The dead of the guild, one char per posture (SPEC-VAULTS-2 §VI, the figure
// posture grammar). Posture names the hazard ahead, so these are placed like
// signage, not scenery:
//   K  reaching   — the thing above/beyond is the answer, and they died short
//   F  fallen, lamp still raised — something struck from a direction
//   C  curled away — do not go this way
//   N  kneeling, lamp set down — the shift ended here
//
// Moving hazards live in the defs: shuttles (bolts of light on a rail),
// censers (swinging lanterns on chains), crushers (stone pistons still
// cycling), beams (Warden light — now with cover to hide behind, or a
// full rotation that points away half the time), pursuit (a wave of
// unlight that hunts you through a zone once you commit).

export interface BeamDef {
  x: number; y: number;       // emitter, tile coords (y = row, downward)
  period: number;             // seconds per full sweep (or rotation)
  phase: number;              // 0..1 offset
  a0?: number; a1?: number;   // sweep endpoints, radians — omit for spin
  spin?: boolean;             // continuous rotation: away half the time
  /**
   * introduced DORMANT (grammar §1.3): the cone drawn dim and inert until
   * the body enters the `arm` rect — then the rounds begin, from rest
   */
  parked?: boolean;
  /** trigger rect [x0, y0, x1, y1], tile coords — arms a parked beam */
  arm?: [number, number, number, number];
}

export interface ShuttleDef {
  // a bolt of light that shoots back and forth along its rail
  x0: number; y0: number; x1: number; y1: number;
  period: number; phase: number;
  /**
   * a SNUFFER instead: a slow dark moth patrolling the rail. Contact STEALS
   * a charged spark and leaves you standing — no gutter, no re-form; a spent
   * spark it ignores. Introduced asleep at (x0, y0) until the body crosses
   * its waking ring (P1: steals; "what the famine made hungry")
   */
  snuff?: boolean;
}

export interface GateDef {
  // ONE-WAY GATE — a falling curtain of light in a doorway rect (tile
  // coords, inclusive): pass through with it freely, solid against it.
  // "The vault keeps what enters."
  x0: number; y0: number; x1: number; y1: number;
  /** which way the curtain passes you (default 'down') */
  dir?: 'down' | 'up';
}

export interface CurrentDef {
  // CURRENT — a rising updraft column (tile coords, inclusive): a vertical
  // carry, distinct from WEATHER's horizontal gust. The generosity object
  // (grammar §2 "springs"); a visible column of rising motes.
  x0: number; y0: number; x1: number; y1: number;
  /** upward carry, tiles/s² — it carries, it never fires you (P5) */
  force: number;
}

export interface CenserDef {
  // a burning lantern swinging on a chain from a ceiling pivot
  x: number; y: number;       // pivot (tile coords, y = row)
  len: number;                // chain length in tiles
  arc: number;                // half-swing in radians
  period: number; phase: number;
}

export interface CrusherDef {
  // a stone piston that still cycles: extends, dwells, withdraws
  x: number; y: number; w: number; h: number;   // rest rect (tile coords)
  dx: number; dy: number;                       // extension vector, tiles
  period: number; phase: number;
}

export interface PursuitDef {
  // a wave of unlight that sweeps a zone once you cross the trigger line
  zone: [number, number, number, number];       // x0, y0, x1, y1 (rows)
  dir: 'down' | 'up' | 'right' | 'left';
  speed: number;                                // tiles per second
  trigger: [number, number, number, number];    // entering this rect arms it
}

export interface WindDef {
  dir: -1 | 1; calm: number; gust: number; force: number;
}

/** P3: no camera-locked chamber is wider than this many columns */
export const CHAMBER_MAX_W = 22;

/** THE BEAT CLOCK's default pulse, seconds — override per def with `clock` */
export const PULSE = 0.85;

/**
 * P1 — the spark ledger as data, one verb per kit element (the prose and
 * fiction live in the legend comment above). `scripts/vaults.mjs` asserts
 * this table is total over the parsed kit.
 */
export const SPARK_CLASS: Record<string, string> = {
  sconce: 'refunds',
  'dead-surface': 'withholds',
  'famine-sconce': 'saves',
  brazier: 'refunds',
  mote: 'shapes',
  stud: 'shapes',
  dark: 'shapes',
  beam: 'forbids',
  bridge: 'clocks',
  rime: 'demands',
  shuttle: 'clocks',
  snuffer: 'steals',
  censer: 'clocks',
  crusher: 'demands',
  pursuit: 'demands',
  wind: 'fights',
  current: 'carries',
  gravity: 'reframes',
  gate: 'commits',
  door: 'prices',
  figure: 'story',
  master: 'payoff',
};

export type FigurePose = 'reaching' | 'fallen' | 'curled' | 'kneeling';

export interface VaultDef {
  glyph: string;
  map: string[];
  /**
   * F11 — camera-locked chambers. The columns where the camera CUTS: the room
   * is partitioned into vertical slices, the camera frames one slice at a
   * time and hard-cuts when the body crosses a boundary. It never pans
   * sideways, so the whole question is on screen before it is answered
   * (P3, precision §4.1).
   *
   * Authoring rules, both linted by `scripts/vaults.mjs`:
   *   · no chamber wider than CHAMBER_MAX_W columns
   *   · a sconce stands at every boundary column — the checkpoint you light
   *     before you commit to what the cut reveals
   *
   * A boundary column belongs to the chamber BEFORE it, which is also what
   * keeps a final chamber sconce-free (P4).
   */
  chambers?: number[];
  /** the Famine: its sconces checkpoint you but give NOTHING back */
  deadLight?: boolean;
  /** door char → how many lit sconces melt it open */
  doorNeeds?: Record<string, number>;
  beams?: BeamDef[];
  shuttles?: ShuttleDef[];
  censers?: CenserDef[];
  crushers?: CrusherDef[];
  pursuit?: PursuitDef;
  wind?: WindDef;
  gates?: GateDef[];
  currents?: CurrentDef[];
  /** the room's pulse, seconds — every cyclic period a multiple (default PULSE) */
  clock?: number;
}

export const VAULTS: VaultDef[] = [
  // ==================================================================
  // ACT I — VEIL-3 · the school
  // ==================================================================

  // 1 · THE WICK — the whole movement set, one idea at a time: jump, a
  // gap the legs can't clear (dash), a sconce touched mid-air (the spark
  // relit mid-flight), then the wick itself — a wall-jump chimney with
  // studs of unlight that force you to change walls.
  {
    glyph: 'wick',
    // the four sconces already stood where the ideas change: the floor gap,
    // the floating relight, the chimney mouth, the wick itself
    chambers: [13, 28, 36, 47],
    map: [
      '########################################################',
      '########################################################',
      '########################################################',
      '#############################################.........##',
      '#############################################......M..##',
      '#############################################.........##',
      '##############################################..########',
      '##############################################..########',
      '##############################################..########',
      '##############################################.X########',
      '##############################################..########',
      '##############################################..########',
      '##############################################.S########',
      '##############################################X.########',
      '##############################################..########',
      '##############################################..########',
      '##############################################..########',
      '##############################################.X########',
      '##############################################..########',
      '##############################################..########',
      '##############################################..########',
      '##############################################..########',
      '#......................................................#',
      '#...........................S..........................#',
      '#......................................................#',
      '#..@.........S.........C............S..................#',
      '########XXX####XXXXX####XXXXXXXXX#######################',
      '########################################################',
      '########################################################',
      '########################################################',
    ],
  },
  // 2 · THE FAMINE — dead light: its sconces hold your place but give
  // nothing back. No mid-air refills anywhere, so every route is sized
  // to one spark and a landing. The first shuttle bolts patrol the runs.
  {
    glyph: 'famine',
    // three halls stacked, each too long to frame whole: cut mid-hall, and
    // the mid-hall sconce is the one dead light you are glad of
    chambers: [12, 28, 43],
    deadLight: true,
    // the beat clock: 3 / 2 / 4 pulses, phases on the quarter-pulse
    shuttles: [
      { x0: 18, y0: 21, x1: 28, y1: 21, period: 2.55, phase: 0 },
      { x0: 20, y0: 12, x1: 20, y1: 14, period: 1.7, phase: 0.25 },
      { x0: 16, y0: 4, x1: 32, y1: 4, period: 3.4, phase: 0.5 },
    ],
    map: [
      '##################################################',
      '##################################################',
      '##################################################',
      '#................................................#',
      '#...........S.................................M..#',
      '#................................................#',
      '####...###########XXXX##XXX##XXX##################',
      '####...###########################################',
      '####...###########################################',
      '####...###########################################',
      '####...###########################################',
      '####...###########################################',
      '#..............................................###',
      '#..............................................###',
      '#.......S..................................S...###',
      '######################XXXXX#################...###',
      '############################################...###',
      '############################################...###',
      '############################################...###',
      '############################################...###',
      '#................................................#',
      '#................................................#',
      '#..@........................S....................#',
      '############XXXX##############XXXXX###############',
      '##################################################',
      '##################################################',
    ],
  },
  // 3 · THE LAST SHIFT — the descent, done honestly this time. Each
  // landing has a lantern that ROTATES — pointing away half the time —
  // and standing stones to hide behind while it looks at you. The wrong
  // way down is rimmed with unlight; the last hall swings a censer.
  {
    glyph: 'shift',
    // each landing is its own chamber; the boundary sconce is the one you
    // light before the lantern over the next one can see you
    chambers: [12, 25, 36],
    // spin beams at 5 / 4 / 4 pulses; the coda censer on the censer's 3
    beams: [
      { x: 25.5, y: 4.2, period: 4.25, phase: 0, spin: true },
      { x: 26.5, y: 13.2, period: 3.4, phase: 0.375, spin: true },
      { x: 24.5, y: 22.2, period: 3.4, phase: 0.75, spin: true },
    ],
    censers: [
      { x: 21, y: 28, len: 4.2, arc: 1.05, period: 2.55, phase: 0 },
    ],
    map: [
      '####################################################',
      '####################################################',
      '####################################################',
      '#..................................................#',
      '#..................................................#',
      '#..@.......##..............##...............##.....#',
      '#..........##..............##.......S.......##N....#',
      '###############################################..###',
      '###############################################..###',
      '###############################################..###',
      '###############################################..###',
      '###############################################..###',
      '#..................................................#',
      '#..................................................#',
      '#.....##..............##..................##.......#',
      '#.....##....S.........##..................##.......#',
      '###..###############################################',
      '###..###############################################',
      '###..###############################################',
      '###..###############################################',
      '###..###############################################',
      '#..................................................#',
      '#..................................................#',
      '#............##.................##.................#',
      '#............##..........S......##.................#',
      '#########################################...########',
      '#########################################...########',
      '#########################################...########',
      '#..................................................#',
      '#..................................................#',
      '#..................................................#',
      '#.S.......................................M........#',
      '#################XXXXXXX###########################'.slice(0, 51) + '#',
      '####################################################',
      '####################################################',
    ],
  },

  // ==================================================================
  // ACT II — CRYOS-2 · the test
  // ==================================================================

  // 4 · THE VAULT — the room the fire cannot leave, now a real lock: the
  // only floors are bridges of light on the metronome, the doors are
  // masonry that melts when enough sconces burn, and a shuttle patrols
  // the second chamber's climb.
  {
    glyph: 'vault',
    // the metronome hall, cut either side of the great door column
    chambers: [11, 21, 37],
    doorNeeds: { '1': 2, '2': 3 },
    shuttles: [
      { x0: 38, y0: 10, x1: 38, y1: 25, period: 3.4, phase: 0 },
    ],
    map: [
      '######################################################',
      '######################################################',
      '######################################################',
      '#....................................................#',
      '#....................................................#',
      '#....................................................#',
      '#........................1...........................#'.slice(0, 53) + '#',
      '#........................1...................2..M...#'.slice(0, 53) + '#',
      '#........................1...................2......#'.slice(0, 53) + '#',
      '#....................S...1...................2..####.'.slice(0, 53) + '#',
      '#..................####..1...........S.......#######.'.slice(0, 53) + '#',
      '#........................1..........AAAA............#'.slice(0, 53) + '#',
      '#........................1..........................#'.slice(0, 53) + '#',
      '#..............bbbb......1.....bbbb..................'.slice(0, 53) + '#',
      '#........................1...........................'.slice(0, 53) + '#',
      '#.....AAAA...............1...............AAAA........'.slice(0, 53) + '#',
      '#........................1...........................'.slice(0, 53) + '#',
      '#..........S.............1.........bbbb..............'.slice(0, 53) + '#',
      '#........................1...........................'.slice(0, 53) + '#',
      '#..AAAA..................1...........................'.slice(0, 53) + '#',
      '#........................1...............AAAA........'.slice(0, 53) + '#',
      '#.S@.....................1...........................'.slice(0, 53) + '#',
      '#####....................1...........................'.slice(0, 53) + '#',
      '#####XXXXXXXXXXXXXXXXXXXX1XXXXXXXXXXXXXXXXXXXXXXX####'.slice(0, 53) + '#',
      '######################################################',
      '######################################################',
    ],
  },
  // 5 · THE EMBER — commitment, and the deepest shaft in the game. The top
  // third is rime alone: crumble-and-regrow taught as a cadence, because a
  // shelf that comes back is a rhythm and a shelf that does not is a trap,
  // and the two never share a room (grammar §2 — THE WEATHER owns the trap).
  // Then the gate, which is architecture saying what planting means before
  // anything is chasing you. Then everything at once, down a shaft whose
  // walls have bitten through, with the wave's edge lighting the way it
  // takes. The seed is the only calm in it.
  {
    glyph: 'ember',
    // one cut, and the entry sconce stands on it: the shaft is read as two
    // columns of descent, and which one you are in when the wave arrives is
    // the drift you took twenty rows above
    chambers: [21],
    censers: [
      // three lanterns over the drop, each a quarter-pulse behind the last —
      // dodged on the way down, and the middle one is the only footing across
      // the gutter. Quarter-pulses, not thirds: §III's beat clock quantizes
      // phase, and `pulse ratio` enforces it, so a room cannot quietly drift
      // out of the groove the whole game moves to.
      { x: 21, y: 20, len: 3.4, arc: 1.0, period: 2.55, phase: 0 },
      { x: 15, y: 28, len: 2.8, arc: 0.85, period: 2.55, phase: 0.25 },
      { x: 27, y: 36, len: 3.0, arc: 0.9, period: 2.55, phase: 0.5 },
    ],
    shuttles: [
      // bolts walking the wire across the shaft, two pulses each
      { x0: 10, y0: 26, x1: 33, y1: 26, period: 1.7, phase: 0 },
      { x0: 33, y0: 44, x1: 10, y1: 44, period: 1.7, phase: 0.5 },
      // and the moth, asleep on the left wall until the descent wakes it:
      // it takes the breath and leaves you standing, which in a shaft with
      // a wave in it is worse than a clean death
      { x0: 11, y0: 33, x1: 30, y1: 35, period: 3.4, phase: 0, snuff: true },
    ],
    crushers: [
      // pistons out of both walls on the pulse, opposite phase
      { x: 10, y: 23, w: 3, h: 2, dx: 4, dy: 0, period: 3.4, phase: 0 },
      { x: 31, y: 30, w: 3, h: 2, dx: -4, dy: 0, period: 3.4, phase: 0.5 },
      // clear of the pocket sconce by seven courses: a checkpoint you cannot
      // breathe after is not a checkpoint (grammar §4.2 wants five)
      { x: 10, y: 48, w: 3, h: 2, dx: 4, dy: 0, period: 2.55, phase: 0.25 },
    ],
    beams: [
      // watch-lights on both walls, parked until you are through the gate and
      // then sweeping in opposition. One per wall is also what P4 asks for:
      // the shaft's right-hand column may introduce nothing its left has not
      // already taught, and the cut runs down the middle of the descent.
      { x: 33.5, y: 21.5, period: 4.25, phase: 0, spin: true, parked: true, arm: [10, 19, 33, 20] },
      { x: 10.5, y: 31.5, period: 4.25, phase: 0.5, spin: true, parked: true, arm: [10, 19, 33, 20] },
    ],
    gates: [
      // the curtain across the shaft: down through it, never back up
      { x0: 10, y0: 19, x1: 33, y1: 19 },
    ],
    pursuit: {
      zone: [10, 32, 33, 51],
      dir: 'down',
      speed: 2.9,
      trigger: [10, 32, 33, 34],
    },
    map: [
      '############################################',
      '############################################',
      '##########........................##########',
      '##########.....o............o.....##########',
      '##########..@........S............##########',
      '##########.........o....o.........##########',
      '##################.....#####################',
      '##########.RRR......o.............##########',
      '##########..................===...##########',
      '##########......RRR........o......##########',
      '##########...............RRR......##########',
      '##########RR.o....................##########',
      '##########..........RRR........o..##########',
      '##########.....................===##########',
      '##########....RRR.......o.........##########',
      '##########................RRR.....##########',
      '##########.RR.....o...............##########',
      '##########............RRR.........##########',
      '##########.....o..............o...##########',
      '##########..o....o....o....o....o.##########',
      '##########........................##########',
      '##########RRR.....................##########',
      '##########..............====......##########',
      '##########X..................RRR..##########',
      '##########X..........o...........X##########',
      '##########.....RRR................##########',
      '##########===....................X##########',
      '##########..........o......RRR....##########',
      '##########XX......................##########',
      '##########........RRR.............##########',
      '##########................o.....XX##########',
      '##########RRR.................===.##########',
      '##########....o..........o........##########',
      '##########...........RRR..........##########',
      '##########X......................X##########',
      '##########...RR..............o....##########',
      '##########X..............RRR......##########',
      '##########.RRR....................##########',
      '##########............o......RRR..##########',
      '############*###..................##########',
      '##########.S........RRR...........##########',
      '##########.....o.............###############',
      '##########.....RRR...............X##########',
      '##########................===.....##########',
      '##########RRR...........o.........##########',
      '##########.................####*############',
      '##########.........RRR............##########',
      '##########X.................RRR...##########',
      '##########..RR..o..........o......##########',
      '##########.............RRR........##########',
      '##########....o..............o....##########',
      '####################....####################',
      '##########........................##########',
      '##########...o...N....M.......o...##########',
      '##########........................##########',
      '############################################'
    ],
  },
  // 6 · THE WEATHER — the storm crossing, with teeth: gusts on the old
  // cycle, but now a censer swings in the wind, bolts patrol the runs
  // between shelters, and the last stretch is a low eave you cross flat
  // out or not at all.
  {
    glyph: 'weather',
    // one shelter per chamber: the gust crossing is always exactly as long
    // as the frame, which is the whole reason the crossing reads
    chambers: [12, 22, 34, 48],
    // wind on the room's groove: 4 pulses calm, 3 gust
    wind: { dir: -1, calm: 3.4, gust: 2.55, force: 30 },
    censers: [
      { x: 26, y: 7, len: 5, arc: 0.85, period: 2.55, phase: 0 },
    ],
    shuttles: [
      { x0: 13, y0: 22, x1: 19, y1: 22, period: 2.55, phase: 0 },
      { x0: 23, y0: 22, x1: 31, y1: 22, period: 2.55, phase: 0.5 },
      { x0: 46, y0: 21, x1: 56, y1: 21, period: 1.7, phase: 0.5 },
    ],
    map: [
      '############################################################',
      '############################################################',
      '############################################################',
      '############################################################',
      '############################################################',
      '############################################################',
      '############################################################',
      '############################################################',
      '#.............................................##############',
      '#.............................................##############',
      '#.........................................##..##############',
      '#.........................................##..##############',
      '#...................##....................##..##############',
      '#...................##....................##..##############',
      '#.........##........##....................##..##############',
      '#.........##........##..........##........##..##############',
      '#.........##........##..........##........##..##############',
      '#.........##........##..........##........##..##############',
      '#.........##........##..........##........##...............#',
      '#.........##........##..........##........##...............#',
      '#.........##........##..........##........##....S..........#',
      '#.........##........##..........##........##...............#',
      '#.@.......##S.......##S.........##S.......##............M..#',
      '##############XXXX##########XXXX############XXX####XX#######',
      '############################################################',
      '############################################################',
    ],
  },

  // ==================================================================
  // ACT III — MAELIS-6 · the exam
  // ==================================================================

  // 7 · THE DEBT — two rooms sharing a wall, and both sides get paid:
  // the door to the stone takes a sconce lit under EACH gravity. Stone
  // pistons still cycle on both sides — mirrored, out of phase.
  {
    glyph: 'debt',
    // one cut at the shared wall, one inside the upside-down cell — the
    // arithmetic is paid twice, so it is framed twice
    chambers: [20, 37],
    doorNeeds: { '1': 2 },
    crushers: [
      // left cell: pistons emerge from the walls across the ledge climb
      { x: 1, y: 7, w: 2, h: 2, dx: 3, dy: 0, period: 3.4, phase: 0 },
      { x: 19, y: 11, w: 2, h: 2, dx: -4, dy: 0, period: 3.4, phase: 0.5 },
      // right cell, upside down: they drop from what you fall toward
      { x: 30, y: 1, w: 2, h: 2, dx: 0, dy: 4, period: 3.4, phase: 0.75 },
      { x: 38, y: 1, w: 2, h: 2, dx: 0, dy: 5, period: 2.55, phase: 0.25 },
    ],
    map: [
      '######################################################',
      '######################################################',
      '######################################################',
      '#....................^^^^^^XXX^^^^^^^SXX^^^^^^^^^^^^^'.slice(0, 53) + '#',
      '#....................^^S^^^^^^^^^^^^^^^^^^^^^1^^^M^^^'.slice(0, 53) + '#',
      '#....................^^^^^^^^^^^^^^^^^^^^^^^^1^^^^^^^'.slice(0, 53) + '#',
      '#..............####..#####^^^^^^^^^^^^^^^^^^^1^^^^^^^'.slice(0, 53) + '#',
      '#....................#####^^^^^^^^^^^^^^^^^^^^^^^^^^^'.slice(0, 53) + '#',
      '#.....####...........#####^^^^^^^^^^^^^^^^^^^^^^^^^^^'.slice(0, 53) + '#',
      '#....................#####^^^^^^^^^^^^^^^^^^^^^^^^^^^'.slice(0, 53) + '#',
      '#............####....#####^^^^^^^^^^^^^^^^^^^^^^^^^^^'.slice(0, 53) + '#',
      '#..S.................#####^^^^^^^^^^^^^^^^^^^^^^^^^^^'.slice(0, 53) + '#',
      '#......####..........#####^^^^^^^^^^^^^^^^^^^^^^^^^^^'.slice(0, 53) + '#',
      '#....................#####^^^^^^^^^^^^^^^^^^^^^^^^^^^'.slice(0, 53) + '#',
      '#....................#####^^^^^^^^^^^^^^^^^^^^^^^^^^^'.slice(0, 53) + '#',
      '#....................#####^^^^^^^^^^^^^^^^^^^^^^^^^^^'.slice(0, 53) + '#',
      '#....................#####^^^^^^^^^^^^^^^^^^^^^^^^^^^'.slice(0, 53) + '#',
      '#....................#####^^^^^^^^^^^^^^^^^^^^^^^^^^^'.slice(0, 53) + '#',
      '#..@......F.........S#####^^^^^^^^^^^^^^^^^^^^^^^^^^^'.slice(0, 53) + '#',
      '######################################################',
      '######################################################',
      '######################################################',
    ],
  },
  // 8 · THE RETURN — the U walked in full: censers swing across the
  // descent, the bottom is a current threaded with bolts, and the way
  // up to the stone will not open until you have stood with the one
  // who stayed and lit the sconce beside it.
  {
    glyph: 'return',
    // the U walked in full, cut at its three corners
    chambers: [5, 26, 39],
    doorNeeds: { '1': 2 },
    censers: [
      { x: 6, y: 10, len: 3.2, arc: 1.0, period: 2.55, phase: 0 },
      { x: 6, y: 19, len: 3.2, arc: 1.0, period: 2.55, phase: 0.5 },
    ],
    shuttles: [
      { x0: 26, y0: 29, x1: 26, y1: 32, period: 1.7, phase: 0 },
      { x0: 38, y0: 29, x1: 38, y1: 32, period: 1.7, phase: 0.5 },
    ],
    crushers: [
      { x: 44, y: 18, w: 2, h: 2, dx: -3, dy: 0, period: 2.55, phase: 0 },
    ],
    map: [
      '########################################################',
      '########################################################',
      '########################################################',
      '#........###########################........1...........'.slice(0, 55) + '#',
      '#..@.....###########################...S....1......M....'.slice(0, 55) + '#',
      '#........###########################........1...........'.slice(0, 55) + '#',
      '####....################################.....############'.slice(0, 55) + '#',
      '####....#################################^^^#############'.slice(0, 55) + '#',
      '####....#################################^^^#############'.slice(0, 55) + '#',
      '####....#################################^^^#############'.slice(0, 55) + '#',
      '####....#################################X^^#############'.slice(0, 55) + '#',
      '####....#################################^^^#############'.slice(0, 55) + '#',
      '####....#################################^^^#############'.slice(0, 55) + '#',
      '####....#################################^^^#############'.slice(0, 55) + '#',
      '####....#################################^^X#############'.slice(0, 55) + '#',
      '####....#################################^^^#############'.slice(0, 55) + '#',
      '####....#################################^^^#############'.slice(0, 55) + '#',
      '####....#################################^^^#############'.slice(0, 55) + '#',
      '####....#################################^^^#############'.slice(0, 55) + '#',
      '####....#################################^^^#############'.slice(0, 55) + '#',
      '####....#################################^^^#############'.slice(0, 55) + '#',
      '####.S..#################################^^^#############'.slice(0, 55) + '#',
      '####....#################################^^^#############'.slice(0, 55) + '#',
      '####....#################################^^^#############'.slice(0, 55) + '#',
      '####....#################################^^^#############'.slice(0, 55) + '#',
      '####....#################################^^^#############'.slice(0, 55) + '#',
      '####....#################################^^^#############'.slice(0, 55) + '#',
      '####....#################################^^^#############'.slice(0, 55) + '#',
      '####....#################################^^^#############'.slice(0, 55) + '#',
      '####>>>>>>>>>>>>>>X>>>>>>>>>>>>>>>>>>>>>>>>>#############'.slice(0, 55) + '#',
      '####>>>>>>>>>>>>>>X>>>>>>>>>>>>>>>>>>>>>>>>>#############'.slice(0, 55) + '#',
      '####>>>>>>>>>>>>>>>>>>>>K.S>>>>>>>>X>>>>>>>>#############'
        .replace('K.S', 'K>S').slice(0, 55) + '#',
      '####>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>X>>>>>>>>#############'.slice(0, 55) + '#',
      '########################################################',
      '########################################################',
      '########################################################',
    ],
  },
  // 9 · THE KINDLED — the exam, in four movements, in the dark: bolts
  // you meet by lamplight, a censer gallery over unlight, a piston
  // shaft climbed between cycles, and then the long floor where the
  // dark itself follows you to the four who stayed.
  {
    glyph: 'kindled',
    // four movements, four chambers wide enough to hold one each — and the
    // last one holds the four who stayed and no sconce at all (P4)
    chambers: [16, 32, 48],
    pursuit: {
      zone: [2, 4, 46, 8],
      dir: 'right',
      speed: 3.4,
      trigger: [13, 4, 15, 8],
    },
    shuttles: [
      { x0: 10, y0: 38, x1: 22, y1: 38, period: 2.55, phase: 0 },
      { x0: 34, y0: 39, x1: 48, y1: 39, period: 1.7, phase: 0.5 },
    ],
    // the gallery's third-apart phasing survives the clock: 1/3 of a
    // 3-pulse period is exactly one pulse — four quarter-pulses
    censers: [
      { x: 16, y: 24, len: 3.2, arc: 1.0, period: 2.55, phase: 0 },
      { x: 28, y: 24, len: 3.2, arc: 1.0, period: 2.55, phase: 1 / 3 },
      { x: 40, y: 24, len: 3.2, arc: 1.0, period: 2.55, phase: 2 / 3 },
    ],
    crushers: [
      { x: 2, y: 19, w: 2, h: 2, dx: 3, dy: 0, period: 2.55, phase: 0 },
      { x: 7, y: 14, w: 2, h: 2, dx: -3, dy: 0, period: 2.55, phase: 0.5 },
    ],
    map: [
      '##########################################################',
      '##########################################################',
      '##########################################################',
      '##########################################################',
      '##dddddddddddddddddddddddddddddddddddddddddddddddddddddd##',
      '##ddddddddddddddddddddddddddddddddddddddddddddddddddddMd##',
      '##ddSddddddddddddddddddddddddddddddddddddddddddddddddddd##',
      '##dddddddddddddddddddddddddddddddddddddddddddddddKFCNddd##',
      '####ddd#############XXX#########XXX########XX#############',
      '####ddd###################################################',
      '####ddd###################################################',
      '####ddd###################################################',
      '####ddd###################################################',
      '####ddd###################################################',
      '####ddd###################################################',
      '####ddd###################################################',
      '####ddd###################################################',
      '####dSd###################################################',
      '####ddd###################################################',
      '####ddd###################################################',
      '####ddd###################################################',
      '####ddd###################################################',
      '####ddd###################################################',
      '####ddd###################################################',
      '####ddd###################################################',
      '##dddddddddddddddddddddddddddddddddddddddddddddddddddd####',
      '##dddddddddddddddddddddddddddddddddddddddddddddddddddd####',
      '##ddddddSdddddddddddddddddddddddddddddddddddddddSddddd####',
      '##dddddddddddddddddddddddddddddddddddddddddddddddddddd####',
      '##############XXXXX#######XXXXX#######XXXXX########ddd####',
      '###################################################ddd####',
      '###################################################ddd####',
      '###################################################ddd####',
      '###################################################dXd####',
      '###################################################ddd####',
      '###################################################ddd####',
      '###################################################ddd####',
      '##dddddddddddddddddddddddddddddddddddddddddddddddddddd####',
      '##dddddddddddddddddddddddddddddddddddddddddddddddddddd####',
      '##d@ddddddddddddSdddddddddddddddSdddddddSddddddddddddd####',
      '##dddddddddddddddddddddddddddddddddddddddddddddddddddd####',
      '############XXXX############XXXX##########################',
      '##########################################################',
      '##########################################################',
      '##########################################################',
      '##########################################################',
    ],
  },
];

/**
 * THE PROVING GROUND — dev-only (`?vault=proving`, `g.devVault('proving')`).
 * The V3 kit exercised in one lit hall, because the nine maps above are
 * provisional (V4/V5 rewrite them): new objects wire in HERE, not into
 * rooms that are about to die. Never in VAULTS, never behind a stone, never
 * in a save — but the suite walks it, `vaultfit` fits it, and the lints
 * hold it to the same law as the nine.
 *
 * The hall: a snuffer asleep over the entry run, motes tracing the arc, a
 * brazier hung mid-crossing, a ridable censer, the master at the far end.
 * Above: a loft with the second sconce and a parked beam behind its arm
 * rect. Between: a one-way drop shaft (the curtain) and a rising current
 * column back up.
 *
 * Two places show a spent spark, because live stone hands it back the frame
 * you land and nothing can be read in a fifth of a second. The shaft gives
 * eight tiles of falling. The hall gives the drank floor: `=` from col 8 to
 * 22, which is one sentence made of three objects — the moth patrols the
 * near half and takes your light, the floor will not give it back, and the
 * basket over col 16 is the only answer. That is THE FAMINE's whole thesis
 * at the scale of a corridor, and it is what the flat floor could not say.
 */
export const TEST_VAULTS: VaultDef[] = [
  {
    glyph: 'proving',
    shuttles: [
      // the snuffer: asleep at the rail's left end, 4 pulses a patrol
      { x0: 8, y0: 20, x1: 14, y1: 20, period: 3.4, phase: 0, snuff: true },
      // and a plain bolt on its own wire, 2 pulses — V3.5 needs the carriage,
      // the anchor posts and the wake on screen next to the moth that shares
      // their rail, or the family cannot be reviewed as a family
      { x0: 5, y0: 17, x1: 15, y1: 17, period: 1.7, phase: 0.25 },
    ],
    crushers: [
      // a piston out of the hall's ceiling, 4 pulses: slow extend, fast return
      { x: 26, y: 16, w: 2, h: 1, dx: 0, dy: 2, period: 3.4, phase: 0 },
    ],
    doorNeeds: { 1: 1 },
    censers: [
      { x: 34, y: 16, len: 2.6, arc: 1.0, period: 2.55, phase: 0 },
    ],
    beams: [
      { x: 33.5, y: 4.5, period: 4.25, phase: 0, spin: true, parked: true, arm: [29, 3, 31, 5] },
    ],
    gates: [
      { x0: 30, y0: 8, x1: 31, y1: 8 },
    ],
    currents: [
      { x0: 40, y0: 6, x1: 41, y1: 19, force: 46 },
    ],
    map: [
      '################################################',
      '################################################',
      '################################################',
      '#########################......................#',
      '#########################..S.............o.....#',
      '#########################.....o................#',
      '##############################..########..######',
      '##############################..########..######',
      '##############################..########..######',
      '##############################..########..######',
      '##############################o.########..######',
      '##############################.#########..######',
      '##############################.*########..######',
      '##############################..########..######',
      '##############################..########..######',
      '##############################..########..######',
      '#....................................#.........#',
      '#........o..o........................#.........#',
      '#...............*....................#.........#',
      '#.....RRR...AAA..bb..................#.........#',
      '#....................................1.........#',
      '#..@....................S............1.......M.#',
      '########===============#########################',
      '################################################',
    ],
  },
];

export const vaultByGlyph = (id: string): VaultDef | undefined =>
  VAULTS.find(v => v.glyph === id) ?? TEST_VAULTS.find(v => v.glyph === id);

// ---------------------------------------------------------------------------

/** one camera-locked slice of a room, inclusive column bounds */
export interface Chamber { x0: number; x1: number }

export interface ParsedVault {
  w: number;
  h: number;
  solid: Uint8Array;
  kill: Uint8Array;
  dark: Uint8Array;
  /** solid tiles that do NOT relight the spark underfoot — `=` */
  dry: Uint8Array;
  gravity: Int8Array;         // 0 down, 1 up, 2 right, 3 left
  doors: { ch: string; tiles: { x: number; y: number }[] }[];
  bridges: { x: number; y: number; group: 0 | 1 }[];
  rime: { x: number; y: number }[];
  sconces: { x: number; y: number }[];
  /** `o` — drifting flecks of the world hue; language, never mechanics */
  motes: { x: number; y: number }[];
  /** `*` — hanging ember baskets: mid-air spark refills, never checkpoints */
  braziers: { x: number; y: number }[];
  figures: { x: number; y: number; pose: FigurePose }[];
  entry: { x: number; y: number };
  master: { x: number; y: number };
  /** the camera's slices, left to right; always at least one */
  chambers: Chamber[];
  /** the declared boundary columns, sorted — [] when the room is one chamber */
  cuts: number[];
}

const FIGURE_CHARS: Record<string, FigurePose> = {
  K: 'reaching', F: 'fallen', C: 'curled', N: 'kneeling',
};

/**
 * Splits → inclusive spans. A boundary column belongs to the chamber BEFORE
 * it, so `chamberAt` puts the boundary sconce in the chamber you light it
 * from, and the chamber past the cut starts clean (P3/P4).
 */
export function chambersOf(w: number, cuts: number[]): Chamber[] {
  const cs = [...new Set(cuts)].filter(c => c > 0 && c < w - 1).sort((a, b) => a - b);
  const out: Chamber[] = [];
  let x0 = 0;
  for (const c of cs) { out.push({ x0, x1: c }); x0 = c + 1; }
  out.push({ x0, x1: w - 1 });
  return out;
}

/** which chamber owns this tile column */
export function chamberAt(p: ParsedVault, tx: number): number {
  for (let i = 0; i < p.chambers.length; i++) if (tx <= p.chambers[i].x1) return i;
  return p.chambers.length - 1;
}

export function parseVault(def: VaultDef): ParsedVault {
  const h = def.map.length;
  const w = def.map[0].length;
  const p: ParsedVault = {
    w, h,
    solid: new Uint8Array(w * h),
    kill: new Uint8Array(w * h),
    dark: new Uint8Array(w * h),
    dry: new Uint8Array(w * h),
    gravity: new Int8Array(w * h),
    doors: [], bridges: [], rime: [], sconces: [], motes: [], braziers: [], figures: [],
    entry: { x: 2, y: 2 }, master: { x: w - 3, y: 2 },
    chambers: chambersOf(w, def.chambers ?? []),
    cuts: [...(def.chambers ?? [])].sort((a, b) => a - b),
  };
  const door = (ch: string): { ch: string; tiles: { x: number; y: number }[] } => {
    let d = p.doors.find(d => d.ch === ch);
    if (!d) { d = { ch, tiles: [] }; p.doors.push(d); }
    return d;
  };
  for (let y = 0; y < h; y++) {
    const row = def.map[y];
    if (row.length !== w) throw new Error(`vault ${def.glyph}: row ${y} is ${row.length} wide, want ${w}`);
    for (let x = 0; x < w; x++) {
      const c = row[x];
      const i = y * w + x;
      switch (c) {
        case '#': p.solid[i] = 1; break;
        case '=': p.solid[i] = 1; p.dry[i] = 1; break;
        case 'X': p.kill[i] = 1; break;
        case 'd': p.dark[i] = 1; break;
        case '^': p.gravity[i] = 1; break;
        case '>': p.gravity[i] = 2; break;
        case '<': p.gravity[i] = 3; break;
        case '1': case '2': case '3': door(c).tiles.push({ x, y }); break;
        case 'A': p.bridges.push({ x, y, group: 0 }); break;
        case 'b': p.bridges.push({ x, y, group: 1 }); break;
        case 'R': p.rime.push({ x, y }); break;
        case 'S': p.sconces.push({ x, y }); break;
        case 'o': p.motes.push({ x, y }); break;
        case '*': p.braziers.push({ x, y }); break;
        case 'K': case 'F': case 'C': case 'N':
          p.figures.push({ x, y, pose: FIGURE_CHARS[c] }); break;
        case '@': p.entry = { x, y }; break;
        case 'M': p.master = { x, y }; break;
        case '.': break;
        default: throw new Error(`vault ${def.glyph}: unknown char '${c}' at ${x},${y}`);
      }
    }
  }
  return p;
}
