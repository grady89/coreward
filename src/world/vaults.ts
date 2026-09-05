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
  /**
   * Rime that does NOT come back. One behaviour per room and never both
   * (grammar §2): THE EMBER teaches the cycle, where a shelf returning is a
   * rhythm you can lean on; THE WEATHER owns the one-shot, where it is a
   * trap. Additive with a default, so every existing room and save keeps the
   * cycle it was authored against.
   */
  rimeOnce?: boolean;
  /**
   * NO WALLS. The map's edge stops being stone and becomes open sky: the body
   * may leave the authored area entirely, and once it is `VOID_PAD` tiles
   * outside it, it guttered — back to the last sconce that was paid for.
   *
   * The pad is deliberately generous. An invisible wall a block past the last
   * platform kills players who are still recovering from a missed landing,
   * which is a death they cannot see coming and cannot learn from; pushed
   * well out, the only thing that ends a run is a fall that was already over.
   *
   * Additive with a default, so every existing room keeps its stone edges.
   */
  openEdges?: boolean;
  gates?: GateDef[];
  currents?: CurrentDef[];
  /** the room's pulse, seconds — every cyclic period a multiple (default PULSE) */
  clock?: number;
}

export const VAULTS: VaultDef[] = [
  // ==================================================================
  // ACT I — VEIL-3 · the school
  // ==================================================================

  // Cuts are inclusive last-columns. The last chamber is 51-72 and holds the
  // spark gap AND the whole shaft, because the far lip of a teaching gap must
  // be VISIBLE from the launch — a cut mid-flight would hide the thing the
  // beat exists to show. The three before it split the traverse evenly.
  //
  // Cuts are inclusive last-columns. The last chamber is 51-72 and holds the
  // spark gap AND the whole shaft, because the far lip of a teaching gap must
  // be VISIBLE from the launch — a cut mid-flight would hide the thing the
  // beat exists to show. The three before it split the traverse evenly.
  //
  // 1 · THE WICK — the tutorial, and it has no walls. Left, right, and up the
  // staircase, over open sky the whole way. There is no floor under the
  // traverse and no wall beside the shaft: miss, and you fall past the screen
  // and re-form at the last sconce you paid for.
  //
  // The boundary sits eight tiles out (VOID_PAD). A wall one block past the
  // last platform kills players who are still steering back from a missed
  // landing — a death they can neither see coming nor learn from — so the pad
  // is generous and the only thing that ends a run is a fall already over.
  //
  // Two sconces. One at the start, one at the foot of the stair. NOT one per
  // camera cut — the traverse crosses two cuts unlit, deliberately, so that
  // the nine beats from the first light to the second are a single unbroken
  // run and a fall anywhere in them costs all of it. That is where the risk
  // lives, and it is the whole reason the room has no walls.
  {
    glyph: 'wick',
    chambers: [17, 34, 50],
    openEdges: true,
    map: [
      '.........................................................................',
      '.........................................................................',
      '.........................................................................',
      '.........................................................................',
      '.........................................................................',
      '.........................................................................',
      '.........................................................................',
      '.........................................................................',
      '..................................................................ooo....',
      '..............................................................K.M........',
      '..............................................................####.......',
      '..................................................................ooo....',
      '.........................................................................',
      '.....................................................................#...',
      '.....................................................................#...',
      '..................................................................ooo#...',
      '.........................................................................',
      '.................................................................#.......',
      '.................................................................#.......',
      '.................................................................#ooo....',
      '.........................................................................',
      '.....................................................................#...',
      '.....................................................................#...',
      '..................................................................ooo#...',
      '.........................................................................',
      '................................................................##.......',
      '..................................................................ooo....',
      '.........................................................................',
      '.....................................................................##..',
      '.................................................................ooo.....',
      '.........................................................................',
      '................................................................##.......',
      '.................................................................ooo.....',
      '.........................................................................',
      '....................................................................##...',
      '.........................................................ooo.o...........',
      '..........................................ooo....ooo......ooo..S.........',
      '............ooo..ooo...ooo...ooo....ooo................ooo....####.......',
      '......ooo.....................................##.....##..................',
      '..@.S..........##....##..........##.....#................................',
      '.#####...###...............##............................................',
      '.........................................................................',
      '.........................................................................',
      '.........................................................................',
      '.........................................................................',
      '.........................................................................',
      '.........................................................................',
      '.........................................................................'
    ],
  },
  // 2 · THE FAMINE — a serpentine, to the drawing. Three halls stacked and run
  // in alternating directions, joined by two updraft channels: start at the
  // bottom left, cross right, get lifted, cross back left, get lifted, and
  // cross right to the stone. Nothing on the route can be skipped — an open
  // room lets a solver cut the middle out, a serpentine makes every beat
  // serial, and that is the whole reason for the shape.
  //
  // Three obstacles and nothing else. STUDS set on the floor at ankle height
  // with stone underneath, so they are jumped rather than fallen into.
  // LASER RAILS strung floor to ceiling, which cannot be gone under or over:
  // you read the bolt and run when it is at the far end. And THE CHANNELS,
  // updraft columns you jump into and are carried by — wind is the enemy
  // everywhere else in this act and here it is the road.
  //
  // Six courses of air over each floor: enough to jump a stud (the body rises
  // 2.68), enough that a laser reads as a wall of light, and not so much that
  // the hall stops being a corridor.
  //
  // deadLight: the sconces hold your place and hand you nothing back. One at
  // the start and one at the head of each channel, so a fall costs the hall
  // you are in and never the hall behind it.
  {
    glyph: 'famine',
    chambers: [17, 35],
    deadLight: true,
    // the beat clock: 2-4 pulses, phases on the quarter-pulse
    shuttles: [
      { x0: 20, y0: 45, x1: 33, y1: 45, period: 2.55, phase: 0.0 },
      { x0: 24, y0: 40, x1: 24, y1: 45, period: 1.70, phase: 0.25 },
      { x0: 30, y0: 40, x1: 30, y1: 45, period: 1.70, phase: 0.75 },
      { x0: 39, y0: 24, x1: 39, y1: 29, period: 2.55, phase: 0.0 },
      { x0: 31, y0: 24, x1: 31, y1: 29, period: 2.55, phase: 0.5 },
      { x0: 28, y0: 24, x1: 28, y1: 29, period: 1.70, phase: 0.25 },
      { x0: 22, y0: 24, x1: 22, y1: 29, period: 1.70, phase: 0.75 },
      { x0: 19, y0: 8, x1: 19, y1: 13, period: 1.70, phase: 0.0 },
      { x0: 36, y0: 8, x1: 36, y1: 13, period: 1.70, phase: 0.5 },
      { x0: 45, y0: 8, x1: 45, y1: 13, period: 1.70, phase: 0.25 }
    ],
    currents: [
      // The two roads up, at opposite ends: jump in and be carried. Named by
      // the SHAFT they cut through the rock -- the wind then fills whatever
      // that shaft opens into, at both ends, because a current that stopped
      // partway up a shaft would stop for no reason a player could see.
      { x0: 50, y0: 30, x1: 53, y1: 39, force: 46 },
      { x0: 19, y0: 14, x1: 22, y1: 23, force: 46 },
    ],
    map: [
      '########################################################',
      '########################################################',
      '########################################################',
      '########################################################',
      '########################################################',
      '########################################################',
      '########################################################',
      '########################################################',
      '###################...................................##',
      '###################...................................##',
      '###################...................................##',
      '###################...................................##',
      '###################...................................##',
      '###################.....S........................K.M..##',
      '###################....#################################',
      '###################...................................##',
      '###################...................................##',
      '###################...................................##',
      '###################...................................##',
      '###################...................................##',
      '###################...................................##',
      '###################...................................##',
      '###################...._______________________________##',
      '###################....#################################',
      '###################...................................##',
      '###################oooo...............................##',
      '###################ooooooooo....oooo....oooo..........##',
      '###################oooo...............................##',
      '###################oooo...............................##',
      '###################oooo........................S......##',
      '#######################.....####....####....######....##',
      '###################...................................##',
      '###################...................................##',
      '###################...................................##',
      '###################...................................##',
      '###################...................................##',
      '###################...................................##',
      '###################...................................##',
      '###################_______________________________....##',
      '##################################################....##',
      '##....................................................##',
      '##................................................oooo##',
      '##............ooooo................oo.oo.oo.oo.ooooooo##',
      '##................................................oooo##',
      '##................................................oooo##',
      '##..@..S..........................................oooo##',
      '##############.....################..#..#..#..#...######',
      '##....................................................##',
      '##....................................................##',
      '##....................................................##',
      '##....................................................##',
      '##....................................................##',
      '##....................................................##',
      '##....................................................##',
      '##____________________________________________________##',
      '########################################################',
      '########################################################',
      '########################################################'
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

  // 4 · THE VAULT — the metronome. Every floor that comes and goes runs on
  // the one pulse, the doors are priced rather than locked, and the shuttle
  // debuts as the fire's own warden. The keep is climbed from inside and it
  // is NONLINEAR: the three required sconces answer in any order, which is
  // the generosity Act II's playground is for. The fourth is optional, hard,
  // and hung over a wire for players buying slack.
  {
    glyph: 'vault',
    chambers: [17, 35],
    doorNeeds: { '1': 2, '2': 3 },
    shuttles: [
      // the wardens: bolts patrolling the room that keeps the fire
      { x0: 8, y0: 24, x1: 15, y1: 24, period: 1.7, phase: 0 },
      { x0: 20, y0: 8, x1: 33, y1: 8, period: 3.4, phase: 0.25 },
      { x0: 33, y0: 12, x1: 20, y1: 12, period: 3.4, phase: 0.75 },
      { x0: 37, y0: 26, x1: 52, y1: 26, period: 2.55, phase: 0 },
      // the one threading the gallery climb, on the same pulse as its floors
      { x0: 52, y0: 11, x1: 37, y1: 11, period: 3.4, phase: 0.5 },
    ],
    censers: [
      // one lantern over the stairs, so the phase read has something moving
      // through it that is not a floor
      { x: 27, y: 20, len: 2.6, arc: 0.9, period: 2.55, phase: 0 },
    ],
    map: [
      '######################################################',
      '######################################################',
      '#.................#.................#................#',
      '#.................#.................#................#',
      '#.................#.......S..oooo...#.........C.M.ooo#',
      '#.................#....######.......#.......##########',
      '#.................#.................#................#',
      '#.................#.................#................#',
      '#.................#...........oooo..#........AAAAAAA.#',
      '#.................#.......#######...#................#',
      '#.................#.................#................#',
      '#....########.....#.................#bbbbbbb.........#',
      '#.................#######...........#................#',
      '#.................#.................#..........ooooo.#',
      '#........o........#.................#.........AAAAAAA#',
      '########..........#.bbbbbbbbbbbb....#................#',
      '#.................#...oooooooo......#................#',
      '#.................#.############....2.bbbbbbb........#',
      '#.................#.................2................#',
      '#...#######......S#.................2...ooooo........#',
      '#.............#########.............2........AAAAAAA.#',
      '#.................#.................2................#',
      '#.................#................S2................#',
      '#######...........#............A############.........#',
      '#........oooooo...#.................#................#',
      '#.................#.................#................#',
      '#.................1.......bbbbb.....#.......#####....#',
      '#.####............1.................#................#',
      '#......AAAAAA.....1.................######...........#',
      '#.................1.AAAAA...........#................#',
      '#.................1.X....X....X.....#.......X........#',
      '#..@.S.oooooo.....1.ooooooooooooooo.#oooooooooooooooo#',
      '######################################################',
      '######################################################'
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
  // 6 · THE WEATHER — the room enacts its own glyph. Depth is the only calm,
  // so the wind is the whole of the crossing and then it is gone, storey by
  // storey, until the master stands in the first still air of the act. An L:
  // right across the surface into a wind blowing left, then down out of it.
  //
  // Its rime is the ONE-SHOT kind. THE EMBER owns the cycle, where a shelf
  // coming back is a rhythm you lean on; here it is the trap under the trap
  // light, and a room may never teach both (grammar §2).
  {
    glyph: 'weather',
    chambers: [19, 39],
    wind: { dir: -1, calm: 3.4, gust: 2.55, force: 30 },
    rimeOnce: true,
    censers: [
      // the lantern returns IN the wind: its arc skewed by the gust, so the
      // crossing is two clocks read at once
      // hung clear of both shoulder sconces by four courses at every point of
      // their arcs — a swinging hazard is a moving danger volume, and the
      // buffer is measured against the whole swing, not the lantern's rest
      { x: 26, y: 6, len: 3.2, arc: 1.0, period: 2.55, phase: 0 },
      { x: 38, y: 3, len: 2.6, arc: 0.85, period: 2.55, phase: 0.5 },
    ],
    shuttles: [
      // bolts down the shelter runs, into the wind's own line
      { x0: 15, y0: 7, x1: 24, y1: 7, period: 1.7, phase: 0.25 },
      { x0: 35, y0: 19, x1: 26, y1: 19, period: 2.55, phase: 0.75 },
    ],
    crushers: [
      // the eave's own teeth, on the pulse the gust is counted in
      { x: 25, y: 10, w: 2, h: 1, dx: 0, dy: 3, period: 3.4, phase: 0 },
      { x: 44, y: 8, w: 2, h: 1, dx: 0, dy: 2, period: 3.4, phase: 0.5 },
      { x: 50, y: 12, w: 2, h: 1, dx: 0, dy: 3, period: 2.55, phase: 0.25 },
    ],
    currents: [
      // TEN: wind was the enemy, and now one wind is the road
      { x0: 36, y0: 5, x1: 39, y1: 20, force: 46 },
    ],
    beams: [
      // a watch-light on the descent, parked until the turn downward
      // one on the crossing and one on the descent: by P4 the last chamber
      // may hold nothing the room has not already taught
      // Mounted UP in the slot between the two shelter blocks, not out in the
      // open a tile and a half above the walkway. Hung at 11.5 its arc swept
      // the ENTRY and two sconces on the row-13 corridor: the body spawned
      // inside the light with no cover, no gap and nothing to time, which is
      // not a hazard but a wall. From the slot the blocks either side shadow
      // the corridor and the beam becomes what a watch-light should be — a
      // gate across four columns that you wait out and run.
      { x: 12.5, y: 8.5, period: 4.25, phase: 0.5, spin: true, parked: true, arm: [8, 12, 14, 14] },
      { x: 46.5, y: 21.5, period: 4.25, phase: 0, spin: true, parked: true, arm: [46, 11, 58, 13] },
    ],
    map: [
      '############################################################',
      '#.............................................#............#',
      '#.............................................#............#',
      '#.............................................#............#',
      '#.............................................#............#',
      '#.............................................#............#',
      '#.............................................#............#',
      '#.............................................#............#',
      '#.............................ooooooo...#######............#',
      '#.....#####....#####.......#####.S......#######............#',
      '#.....#####....#####.......#####RRRR.....oooo.#............#',
      '#.......................................####################',
      '#..............ooooo....................ooFoCo.............#',
      '#..@..S.ooooo......S...................S...................#',
      '#############..##########..#########oooo..........oooooooo.#',
      '#...............................................############',
      '#..............##......##..................................#',
      '#..........................................................#',
      '#................#....#....................................#',
      '#.............oooooooooooo....................##########...#',
      '#............##############................................#',
      '#..........................................................#',
      '#...................................................oooooo.#',
      '#.................................................##########',
      '#..........................................................#',
      '#..........................................................#',
      '#..........................................................#',
      '#.............................................#########....#',
      '#..........................................................#',
      '#..........................................................#',
      '#.................................................ooooooo..#',
      '#................................................###########',
      '#..........................................................#',
      '#..........................................................#',
      '#...............................................oNooMooooo.#',
      '#.............................................##############',
      '#..........................................................#',
      '#..........................................................#',
      '#..........................................................#',
      '############################################################'
    ],
  },
  // 7 · THE DEBT — a mirrored diptych sharing a wall, and the mirror is the
  // lesson: everything you did on the left, re-read upside down on the right.
  // The pistons are one system with the gravity — same period, opposite
  // phase, both sides of the ledger paid.
  //
  // The door is not a lock. Its price is one sconce lit under EACH gravity,
  // so the sum cannot be paid without understanding both halves, which is
  // what "this is arithmetic" means when a room says it.
  {
    glyph: 'debt',
    chambers: [17, 35],
    doorNeeds: { '1': 2 },
    crushers: [
      // the left bank, out of the wall the way a piston has always come
      { x: 1, y: 17, w: 2, h: 2, dx: 4, dy: 0, period: 3.4, phase: 0 },
      { x: 13, y: 18, w: 2, h: 2, dx: -4, dy: 0, period: 3.4, phase: 0.5 },
      // and the right bank, mirrored: same period, opposite phase, descending
      // out of what the body over there calls the floor
      { x: 24, y: 4, w: 2, h: 2, dx: 0, dy: 4, period: 3.4, phase: 0.5 },
      { x: 26, y: 22, w: 2, h: 2, dx: 0, dy: -4, period: 3.4, phase: 0 },
      // interleaved once more across the crossing
      { x: 38, y: 4, w: 2, h: 2, dx: 0, dy: 3, period: 2.55, phase: 0.25 },
      { x: 46, y: 17, w: 2, h: 2, dx: 0, dy: 3, period: 2.55, phase: 0.75 },
    ],
    censers: [
      // one lantern per cell, swinging in each cell's own down
      { x: 9, y: 16, len: 2.8, arc: 0.9, period: 2.55, phase: 0 },
      { x: 27, y: 12, len: 2.8, arc: 0.9, period: 2.55, phase: 0.5 },
    ],
    shuttles: [
      { x0: 20, y0: 7, x1: 34, y1: 7, period: 3.4, phase: 0.25 },
      { x0: 15, y0: 20, x1: 3, y1: 20, period: 2.55, phase: 0.75 },
    ],
    map: [
      '######################################################',
      '######################################################',
      '#................##^^^^^^^^^^^^^^^^^#^^^^^^^^#.......#',
      '#................#############################.......#',
      '#................##^^^^^^^^^^^^^^^^^#^^^^^^^^#.......#',
      '#................##X^^^^^^^^ooooooo^#^^^^^^^^#.......#',
      '#................##^#######^^^^^^^^^#^^ooooo^#.......#',
      '#................##^^^^^^^^^^^^^^^^^#^######^#.......#',
      '#................##^^^^^^^^^^^^^^^^^#^^^^^^^^#.......#',
      '#..........#####S##^^^^^^^^########^#^^^^^^^^#.......#',
      '#.########.......##^^^^^^^^^^^^^^^^^#^ooooo^^#.......#',
      '#................##^^^^^^^^ooooooo^^##########.......#',
      '#..ooooo.........#########^^^^^^^^^^#^^^^^^^^#.......#',
      '#.......########.##^^^^^^^^^^^^^^^^X#^^^^^^^^#.......#',
      '#X...............##^^^^^^^^^^^^^^^^^#^^^^^^^^#.......#',
      '#...............X##^^^^^^^#########^^^^^^^^^^#.......#',
      '########.........##^^^^^^^^^^^^^^^^^.........#######.#',
      '#................##X^^^^^^^^^oooooo^.................#',
      '#................##^########^^^^^^^^.................#',
      '#........#######.##^^^^^^^^^^^^^^^^^..........oooooo.#',
      '#...............X##^^^^^^^^^^^^^^^^^#.........########',
      '#.........ooooo..##^^^^^^^^^#########................#',
      '#.#######........11^^^^^^^^^^^^^^^^S#................#',
      '#................11^oooooo^^^^^^^^^^#.........NoMoF..#',
      '#X...............11########^^^^^^^^^#........#######.#',
      '#..@..S.ooooooo..11^^^^^^^^^^^^^^^^^#................#',
      '###################^^^^^^^^^^^^^^^^^#................#',
      '#####################################................#',
      '######################################################',
      '######################################################'
    ],
  },
  // 8 · THE RETURN — the U walked in full, and the only new thing in it is a
  // ROLE. You have spent the game dodging the lantern; here there is a gutter
  // no jump crosses, no floor serves, and the only thing in reach is the
  // crown at the top of its swing. The ride is discovered because nothing
  // else is left, over a gutter shallow enough that being wrong costs
  // seconds (grammar §1.6).
  //
  // The bottom is right-gravity: the corridor IS sideways-down, walked along
  // its own wall, and midway through it is the one who stayed and the sconce
  // beside them. You cannot pass without standing with them.
  {
    glyph: 'return',
    chambers: [17, 38],
    doorNeeds: { '1': 3 },
    censers: [
      // dodged on the way down...
      { x: 9, y: 7, len: 3.0, arc: 0.95, period: 2.55, phase: 0 },
      { x: 6, y: 15, len: 2.8, arc: 0.9, period: 2.55, phase: 0.5 },
      // ...and RIDDEN across the gutter, because there is nothing else
      { x: 10, y: 22, len: 3.2, arc: 1.0, period: 2.55, phase: 0.25 },
      // then ridden upward on the far limb, apex to apex
      { x: 46, y: 22, len: 3.0, arc: 0.95, period: 2.55, phase: 0 },
      { x: 50, y: 14, len: 2.8, arc: 0.9, period: 2.55, phase: 0.5 },
      { x: 45, y: 8, len: 2.6, arc: 0.85, period: 2.55, phase: 0.25 },
    ],
    shuttles: [
      // bolts threading the sideways corridor
      { x0: 23, y0: 26, x1: 32, y1: 26, period: 1.7, phase: 0 },
      { x0: 34, y0: 29, x1: 23, y1: 29, period: 2.55, phase: 0.5 },
      // and the moth on the descent, awake to the light you are carrying
      { x0: 3, y0: 11, x1: 14, y1: 19, period: 3.4, phase: 0, snuff: true },
    ],
    currents: [
      // the vent under the corridor's far end, the road out of the bottom
      { x0: 36, y0: 24, x1: 37, y1: 30, force: 46 },
    ],
    crushers: [
      // one on the descent, so the ascent's pair recombine rather than debut
      { x: 1, y: 12, w: 2, h: 2, dx: 4, dy: 0, period: 3.4, phase: 0.25 },
      { x: 44, y: 27, w: 2, h: 2, dx: 0, dy: -3, period: 3.4, phase: 0 },
      { x: 49, y: 19, w: 2, h: 2, dx: 0, dy: -3, period: 3.4, phase: 0.5 },
    ],
    gates: [
      // the return does not un-happen
      { x0: 38, y0: 29, x1: 47, y1: 29 },
    ],
    map: [
      '########################################################',
      '########################################################',
      '#......................................................#',
      '#........................................#.............#',
      '#..@..S.ooooooo..........................#.............#',
      '#################........................#.............#',
      '#................######>>>######>>>####..#.............#',
      '#................######>>>######>>>####..#.....oKoMoNo.#',
      '#.........oooooo.######>>>######>>>####..#.....#########',
      '#########........######>>>######>>>####..#.............#',
      '#................######>>>######>>>####..####..........#',
      '#................######>>>######>>>####..#.....oooo#####',
      '#.oooooo.........######>>>######>>>####..#.....#########',
      '#.........#############>>>######>>>####..#.........#####',
      '#................######>>>######>>>####..#.....#########',
      '#................######>>>######>>>####..#.........#####',
      '#.........oooooo.######>>>######>>>####..#####.....#####',
      '########.........######>>>######>>>####..#.........#####',
      '#................######>>>######>>>####..#.....#########',
      '#................######>>>>>>>>>>>>####..#oooo.....#####',
      '#.oooooo.........######>>>>>>>>>>>>####..#####.....#####',
      '#........##############>>>>>>>>>>>>####..#.........#####',
      '#................>>>>>>>>>>>>>>>>>>####..#.....#########',
      '#..............##>>>>>>>>>>>>>>>>>>>>>11.#.........#####',
      '#.....oooooooooo.S>>>>>>>>>>>>>>ooo>>S11.#####.....#####',
      '######.......####>>>>>>>>>>>>>>>>>>>>>11.#.........#####',
      '#................>>>>>>ooo>>>>>>>>>>>>11.......#########',
      '#................>>>>>>>>>>>>>>>>>>>>>11.......oooo#####',
      '#################>>>>>>>>>>>>>>>>>>>>>11..####.....#####',
      '#................>>>>>>>>>>>C>F>>>>>>>>............#####',
      '#................>>>>>>>>>>>>>>>>>>>>>>..###############',
      '#######################################................#',
      '########################################################',
      '########################################################',
      '########################################################',
      '########################################################',
      '########################################################',
      '########################################################'
    ],
  },
  // 9 · THE KINDLED — the exam. Four movements in the dark, each recombining
  // two acts' vocabulary, ending with the dark itself at your heels. It
  // introduces NOTHING: the Summit rule, and the only thing that feels new is
  // the spark rule biting at full strength, because with the breath spent you
  // are a silhouette and this room is built dark enough to prove it.
  //
  // Three sconces for the whole exam. Scarcity is the difficulty at this
  // register, and the exhale is the one steady light in it.
  {
    glyph: 'kindled',
    chambers: [19, 38],
    censers: [
      // the gallery: quarter-pulse apart over the unlight, and the middle one
      // is not a hazard to dodge — it is the floor, and there is no other
      { x: 26, y: 13, len: 3.4, arc: 1.0, period: 2.55, phase: 0 },
      { x: 39, y: 13, len: 3.4, arc: 1.0, period: 2.55, phase: 0.25 },
      { x: 52, y: 13, len: 3.4, arc: 1.0, period: 2.55, phase: 0.5 },
    ],
    shuttles: [
      // I: bolts on self-luminous rails, and the moth whose rim is the only
      // warm thing moving in the whole movement
      { x0: 14, y0: 6, x1: 30, y1: 6, period: 3.4, phase: 0 },
      { x0: 48, y0: 4, x1: 28, y1: 4, period: 3.4, phase: 0.5 },
      { x0: 12, y0: 7, x1: 44, y1: 3, period: 3.4, phase: 0.25, snuff: true },
      // IV: the last wire, run under the wave
      { x0: 6, y0: 43, x1: 22, y1: 43, period: 1.7, phase: 0.75 },
    ],
    crushers: [
      // III: climbed between cycles, both banks on the one pulse
      { x: 15, y: 21, w: 2, h: 2, dx: 0, dy: 3, period: 3.4, phase: 0 },
      { x: 34, y: 25, w: 2, h: 2, dx: 0, dy: 3, period: 3.4, phase: 0.5 },
      { x: 20, y: 29, w: 2, h: 2, dx: 0, dy: 3, period: 3.4, phase: 0.25 },
      { x: 47, y: 26, w: 2, h: 2, dx: 0, dy: -3, period: 3.4, phase: 0.75 },
    ],
    beams: [
      // watch-lights on both halves of the chimney, parked until it is entered
      { x: 5.5, y: 26.5, period: 4.25, phase: 0, spin: true, parked: true, arm: [1, 20, 56, 22] },
      { x: 52.5, y: 30.5, period: 4.25, phase: 0.5, spin: true, parked: true, arm: [1, 20, 56, 22] },
    ],
    gates: [
      // between the movements, so the exam never un-happens either
      { x0: 50, y0: 11, x1: 56, y1: 11 },
      { x0: 1, y0: 34, x1: 6, y1: 34 },
    ],
    currents: [
      { x0: 36, y0: 20, x1: 38, y1: 32, force: 46 },
    ],
    pursuit: {
      // IV: the dark, arriving, and its edge is how you read the floor
      zone: [1, 40, 56, 46],
      dir: 'right',
      speed: 3.1,
      trigger: [1, 40, 8, 45],
    },
    map: [
      '##########################################################',
      '##########################################################',
      '#........................................................#',
      '#dddddddddddddddddddddddddddddddddddddddddddddddddddddddd#',
      '#dddddddddddddddddddddddddddddddddddddddddddddddddddddddd#',
      '#ddddddddddd###ddddddddddd####ddddddddddd###ddddddddddddd#',
      '#dddddddddddddddddddddddddddddddddddddddddddddddddddddddd#',
      '#dddddddddooooooodddddddddddddooooooooodddddddddddddddddd#',
      '#dd@ddSdddddddddddddddddddddddddddddddddddddddddddddddddd#',
      '####################XX###########XX##########XX###########',
      '#.................................................ddddddd#',
      '#.................................................ddddddd#',
      '#.................................................########',
      '#dddddddddddddddddddddddddddddddddddddddddddddddddddddddd#',
      '#dddddddddddddddddddddddddddddddddddddddddddddddddddddddd#',
      '#ddddddddddddddddddSoooodddddddddddddddoooooddddddddddddd#',
      '#ddddddddddddddddd####ddddddddddddddddddddddddddddddddddd#',
      '#ddddddddd#######ddddddddddddddd#######ddddd######ddddddd#',
      '#dddddddddddddddddddddddddddddddddddddddddddddddddddddddd#',
      '#########XXXXXXXXXXXXXXX#######XXXXXXXXXXXXXXXXXXX########',
      '#ddddddddddddddddddddddddddddddddddd^^^^^^^^^^^^^^^^^^^^^#',
      '#ddddddddddddddddddddddddddddddddddd^^^^^#################',
      '#ddddddddddddddddddddddddddddddddddd^^^^^^^^^^^^^^^^^^^^^#',
      '#ddooooooooddddddddddddddddddddddddd^^^^^^^^^^^^^^^^^^^^^#',
      '#############ddddd##########dddddddd^^^^^X^^^^^^^^^^^^^^^#',
      '#ddddddddddddddddddddddddddddddddddd^^^^^^^^##############',
      '#ddddddddddddddddddddddddddddddddddd^^^^^^^^^^ooooooooo^^#',
      '#dddddddddddddddddddddddddddddddoooo^^^^^^^^^^^^^^^^^^^^^#',
      '#ddddd############dddddddddddd######^^^^^^^^^^^^^^^^^^^^^#',
      '#ddddddddddddddddddddddddddddddddddd^^^^^############^^^^#',
      '#ddddddddddddddddddddddddddddddddddd^^^^^^^^^^^^^^^^^^^^X#',
      '#dddddddddddddddddddddddoooooooooddd^^^^^^^^^^^^^^^^^^^^^#',
      '###############ddddddd#############d^^^^^^^^^^^^^^^^^^^^^#',
      '#ddddddddddddddddddddddddddddddddddd^^^^^#################',
      '###....................................................###',
      '###....................................................###',
      '###.....ooooooooooooo.....................ooooooooooo..###',
      '###....................................................###',
      '###...........................K.F.C.N.S................###',
      '##...#####################################################',
      '#dddddddddddddddddddddddddddddddddddddddddddddddddddddddd#',
      '#ddddddddddddddddddddddddddddddddddddddddddddddd.........#',
      '#dddddddddddddddRRRRRRRdddddddddddddoooooooooddd.........#',
      '#ddddddddddddd**ddddddddddddRRRRRRRddddddddddd**.........#',
      '#dddoooooooooddddddddddddddddddddddddddddddddddd.........#',
      '#ddddddddddddddddddddddddddddddddddddddddddddddd..F.M....#',
      '#########XX#############XX#############XX#################',
      '##########################################################'
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
  /**
   * Kill tiles that are NEVER DRAWN — `_`, the bottom of a bottomless pit.
   *
   * Unlight (`X`) is a wound in the masonry and is meant to be seen: it is the
   * fang you jump. A void is the opposite noun. It is what THE WICK does with
   * open sky — you fall off the world and re-form, and there is nothing to
   * look at because looking is not the point. Drawing a lit floor at the
   * bottom of a pit turns a fall into a landing on something, which reads as
   * a place rather than as an absence.
   */
  voidTile: Uint8Array;
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
    voidTile: new Uint8Array(w * h),
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
        case '_': p.kill[i] = 1; p.voidTile[i] = 1; break;
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
