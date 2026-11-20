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
   * a spinning light turns counter-clockwise unless told otherwise; `cw`
   * reverses it. Direction is authorable because it is READABLE: the sweep
   * arrives at a crossing from one side, and a room can need the other
   */
  cw?: boolean;
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
  /**
   * upward carry, tiles/s² — it carries, it never fires you (P5).
   * NEGATIVE is the mirror: a DOWNDRAFT that drives the fall (capped shy of
   * MAX_FALL, so the steer out of it is still yours) — cold where the
   * updraft is warm, pouring from a vent at its top. THE LAST SHIFT's
   * descent shafts.
   */
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
 * The pulse grammar (SPEC-FOLD.md §4): every authored duration in the
 * glyph/vault experience is one of these. Nothing is ever "about 300ms".
 */
export const HALF = PULSE / 2;        // room events: sconce ignitions, plates
export const QUARTER = PULSE / 4;     // the UI atom
export const EIGHTH = PULSE / 8;      // the smallest visible event (cuts)

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
  // Three obstacles and one new noun. LASER RAILS — vertical walls of light
  // six courses tall (past what legs can clear, so open sky above them
  // changes nothing), bolts laid along the ground to be jumped, and one hung
  // over hall C's gaps so every jump is timed against it. THE CHANNELS,
  // updraft columns you jump into and are carried by — wind is the enemy
  // everywhere else in this act and here it is the road. And SPIKED BLOCKS
  // hanging in both channels — stone above, unlight beneath — so the ride
  // up is a weave, and each channel's cap turns its exit sideways.
  //
  // Six courses of air over each floor: enough to jump a stud (the body rises
  // 2.68), enough that a laser reads as a wall of light, and not so much that
  // the hall stops being a corridor.
  //
  // deadLight: the sconces hold your place and hand you nothing back. One at
  // the start and one at the head of each channel, so a fall costs the hall
  // you are in and never the hall behind it.
  //
  // Built the way THE WICK is built: open sky, and the halls float in it.
  // No roof, no side walls, no rock under the route — a missed jump falls
  // past an unseen kill plane eight courses down (or clean out of the map,
  // which openEdges ends the same way) and re-forms at the last sconce.
  {
    glyph: 'famine',
    chambers: [17, 35],
    deadLight: true,
    openEdges: true,
    // the beat clock: 2-4 pulses, phases on the quarter-pulse
    shuttles: [
      { x0: 20, y0: 45, x1: 33, y1: 45, period: 2.55, phase: 0.0 },
      { x0: 24, y0: 40, x1: 24, y1: 45, period: 1.70, phase: 0.25 },
      { x0: 30, y0: 40, x1: 30, y1: 45, period: 1.70, phase: 0.75 },
      { x0: 44, y0: 24, x1: 44, y1: 29, period: 2.55, phase: 0.0 },
      { x0: 40, y0: 24, x1: 40, y1: 29, period: 1.70, phase: 0.5 },
      { x0: 38, y0: 24, x1: 38, y1: 29, period: 1.70, phase: 0.25 },
      { x0: 35, y0: 24, x1: 35, y1: 29, period: 1.70, phase: 0.75 },
      { x0: 28, y0: 29, x1: 31, y1: 29, period: 2.55, phase: 0.5 },
      { x0: 28, y0: 10, x1: 44, y1: 10, period: 3.40, phase: 0.0 },
      { x0: 28, y0: 13, x1: 45, y1: 13, period: 3.40, phase: 0.5 }
    ],
    currents: [
      // The two roads up, at opposite ends: jump in and be carried. Standing
      // columns of wind in the open air between the halls, read by the motes
      // that fill them -- the shaft is drawn by what rises through it, not
      // by rock around it. Each reaches down to ONE COURSE over its launch
      // pad: with the shaft walls gone there is nothing to wall-jump, so the
      // wind itself must meet the jump that enters it.
      { x0: 50, y0: 30, x1: 53, y1: 44, force: 46 },
      { x0: 19, y0: 14, x1: 22, y1: 28, force: 46 },
    ],
    map: [
      '........................................................',
      '........................................................',
      '........................................................',
      '........................................................',
      '........................................................',
      '........................................................',
      '........................................................',
      '........................................................',
      '........................................................',
      '............................#...............#...........',
      '...................##...................................',
      '...................XX........ooo....ooo...ooo...........',
      '........................................................',
      '........................S........................K.M....',
      '.......................######...####...###...#########..',
      '........................................................',
      '........................................................',
      '........................................................',
      '...................##...................................',
      '...................XX...................................',
      '........................................................',
      '........................................................',
      '......................._______________________________..',
      '...................................#..#.#...#...........',
      '.....................##.................................',
      '...................ooXX.................................',
      '...................oooooooo......oo....o...o........##..',
      '...................oooo.............................XX..',
      '...................oooo.................................',
      '...................oooo.........................S.......',
      '...................####....######..####.###.######......',
      '........................................................',
      '........................................................',
      '........................................................',
      '....................................................##..',
      '....................................................XX..',
      '........................................................',
      '........................................................',
      '..................._______________________________......',
      '........................#.....#.........................',
      '..................................................##....',
      '..................................................XXoo..',
      '..............ooooo................oo.oo.oo.oo.ooooooo..',
      '..................................................oooo..',
      '..................................................oooo..',
      '....@..S..........................................oooo..',
      '..############.....################..#..#..#..#...####..',
      '........................................................',
      '........................................................',
      '........................................................',
      '........................................................',
      '........................................................',
      '........................................................',
      '........................................................',
      '..____________________________________________________..',
      '........................................................',
      '........................................................',
      '........................................................'
    ],
  },
  // 3 · THE LAST SHIFT — the descent, to the drawing. Four storeys
  // switchbacked down through open sky, joined by three DOWNDRAFT shafts:
  // walk the watched storey right, pour down, ride the lanterns back left,
  // pour down, cross the fading shelves right, and pour down once more to
  // the stone. The wind that was a road up in THE FAMINE is a fall here,
  // and the last landing is spiked: the steer out of the wind onto the
  // safe stone beside it is the whole of it. The first wind only teaches
  // the fall, onto stone run out under all of it.
  //
  // Storey 2 has NO floor — the crossing is ridden censer to censer over
  // the void, which is THE RETURN's coda taught two acts early and made
  // the whole sentence. The watch-lights are the room's clock: two over
  // the first storey (one hanging, one STANDING on its post), one over
  // the last gap before the stone, and every stand of stone on the walk
  // is cover to wait behind.
  //
  // Built the way THE WICK is built: open sky, unseen `_` planes under
  // each storey (holed where the shafts pass), and the openEdges void
  // below the finish.
  {
    glyph: 'shift',
    // the second cut sits at 39: crossing it happens ON the safe shelves
    // and shaft lips, so every fading deck is framed BEFORE its jump —
    // the far lip of a gap must be visible from the launch (P3)
    chambers: [17, 39],
    openEdges: true,
    beams: [
      { x: 14.5, y: 4.5, period: 4.25, phase: 0.0, spin: true },
      { x: 29.5, y: 7.2, period: 3.40, phase: 0.5, spin: true, cw: true },
      { x: 25.5, y: 53.3, period: 3.40, phase: 0.25, spin: true, cw: true }
    ],
    censers: [
      { x: 16, y: 22, len: 3.4, arc: 1.0, period: 2.55, phase: 0.0 },
      { x: 23, y: 22, len: 3.4, arc: 1.0, period: 2.55, phase: 0.5 },
      { x: 30, y: 22, len: 3.4, arc: 1.0, period: 2.55, phase: 0.0 }
    ],
    currents: [
      // the three shafts, blowing DOWN (negative force): capped shy of
      // MAX_FALL so the steer onto the safe stone is always still yours
      { x0: 39, y0: 11, x1: 42, y1: 24, force: -40 },
      { x0: 3, y0: 27, x1: 7, y1: 40, force: -40 },
      { x0: 44, y0: 43, x1: 47, y1: 51, force: -40 }
    ],
    map: [
      '....................................................',
      '....................................................',
      '....................................................',
      '..............#.....................................',
      '....................................................',
      '....................................................',
      '....................................................',
      '....................................................',
      '...........##................#....##................',
      '....@.S....##................#....##................',
      '...##########....######....#####..#####.............',
      '.......................................oooo.........',
      '.......................................oooo.........',
      '.......................................oooo.........',
      '.......................................oooo.........',
      '.......................................oooo.........',
      '....................................................',
      '....................................................',
      '..________________________________.............___..',
      '....................................................',
      '....................................................',
      '................#......#......#.....................',
      '....................................................',
      '....................................................',
      '....................................S...............',
      '..................................#############.....',
      '.......######.....................#############.....',
      '...ooooo............................................',
      '...ooooo............................................',
      '...ooooo............................................',
      '...ooooo............................................',
      '...ooooo............................................',
      '....................................................',
      '....................................................',
      '.._.....__________________________________________..',
      '....................................................',
      '....................................................',
      '....................................................',
      '....................................................',
      '....................................................',
      '....................................................',
      '.....S..............................................',
      '...#####...AAAAAA...bbbbbb...AAAAAA...bbbbbb........',
      '............................................oooo....',
      '............................................oooo....',
      '............................................oooo....',
      '............................................oooo....',
      '............................................oooo....',
      '....................................................',
      '....................................................',
      '.._____________________________________.............',
      '....................................................',
      '.........................#.....................#....',
      '....................................................',
      '....................................................',
      '....................................................',
      '....................................................',
      '...............M..N.....................S...XX......',
      '.............###########....AAAAAA.....####.#######.',
      '....................................................',
      '....................................................',
      '....................................................',
      '....................................................',
      '....................................................'
    ],
  },
  // ==================================================================
  // ACT II — CRYOS-2 · the test
  // ==================================================================

  // 4 · THE VAULT — to the drawing. The keep in the middle as before — a
  // plaza, a chimney of half-time floors between two towers, the stone's
  // box on top, spiked now so nobody climbs around it — and a route that
  // circles it: ice bricks to a low light, a swinging lamp to ride, a laser
  // to jump through, the tower face to kick up past a bolt to a high light;
  // then down and through the key door (three lights), under the floating
  // tower, through three plumb lasers to the right limb — platforms out
  // between two more, a wall to kick up, four pads back to the ledge and its
  // light — and finally up the chimney through the grate, which wants all
  // four. A fall from anywhere lands on the plaza or the unseen plane.
  {
    glyph: 'vault',
    chambers: [21, 43],
    openEdges: true,
    rimeOnce: true,
    doorNeeds: { '1': 3, '2': 4 },
    shuttles: [
      { x0: 11, y0: 25, x1: 19, y1: 25, period: 2.55, phase: 0.5 },
      { x0: 18, y0: 20, x1: 20, y1: 20, period: 1.70, phase: 0.0 },
      { x0: 17, y0: 8, x1: 17, y1: 13, period: 2.55, phase: 0.25 },
      { x0: 30, y0: 25, x1: 30, y1: 29, period: 1.70, phase: 0.0 },
      { x0: 32, y0: 25, x1: 32, y1: 29, period: 2.55, phase: 0.25 },
      { x0: 34, y0: 25, x1: 34, y1: 29, period: 1.70, phase: 0.75 },
      { x0: 40, y0: 23, x1: 40, y1: 28, period: 2.55, phase: 0.0 },
      { x0: 47, y0: 22, x1: 47, y1: 27, period: 2.55, phase: 0.5 }
    ],
    censers: [
      { x: 8, y: 20, len: 3.0, arc: 0.95, period: 2.55, phase: 0.0 }
    ],
    map: [
      '.......................................................',
      '.......................................................',
      '.......................................................',
      '.......................................................',
      '.......................................................',
      '.......................................................',
      '.......................................................',
      '.................#.....................................',
      '.......................................................',
      '...................XXXXXXXXXXX.........................',
      '............S......###########.........................',
      '..........#######..#.........#.........................',
      '...................#.........#.........................',
      '...................#.........#.........................',
      '.................#.#.......CM#.........................',
      '...................###2222####.......................#.',
      '.....................#....#..........................#.',
      '.....................#o..o#..........................#.',
      '.................##..#o.bb#..........................#.',
      '.....................#o..o#......................###.#.',
      '##...................#AA.o#...................bb.....#.',
      '.#.................#.#o..o#......S........AAA..#.....#.',
      '.#...................#o.bb#..########.bb#............#.',
      '.#...................#o..o#..........................#.',
      '.#...................#AA.o#o.....................##..#.',
      '.#........#..........#o..o#.o........................#.',
      '.#........#..........#o.bb#o.............#####.........',
      '.#...................#....#.o..........................',
      '.#...................1AA.............##........#.......',
      '.#...............@.S.1..................#..............',
      '.#.............R####################...................',
      '.#...........R.........................................',
      '.#.S.......R...........................................',
      '..#####..R.............................................',
      '.......................................................',
      '.......................................................',
      '.......................................................',
      '.......................................................',
      '.____________________________________________________..',
      '.......................................................'
    ],
  },
  // 5 · THE EMBER — the descent, chased (scripts/author-ember.py). Above
  // the curtain every noun is met alone and in calm: the ice walk, the
  // lantern, the trapdoor over a piston, two breaths off a brazier, and the
  // room's one light. Below it the dark pours down at 2.8 tiles a second and
  // there is no light at all: plunge onto a two-tile ledge, ride the lantern
  // up to the throat, drop through two pistons, three breaths across the cut,
  // a rime cascade you cannot stand on, and a wall-to-wall piston over a
  // column whose floor is fangs. The seed sits under a fanged roof to the
  // side of the fall line: free-fall and you burn; steer and spark under the
  // lip and you kneel beside it.
  {
    glyph: 'ember',
    chambers: [21],
    openEdges: true,
    censers: [
      { x: 30, y: 3, len: 3.5, arc: 0.95, period: 2.55, phase: 0.0 },
      { x: 11, y: 36, len: 3.5, arc: 0.95, period: 2.55, phase: 0.0 }
    ],
    crushers: [
      { x: 35, y: 13, w: 3, h: 2, dx: 4, dy: 0, period: 3.40, phase: 0.0 },
      { x: 14, y: 41, w: 3, h: 2, dx: 4, dy: 0, period: 3.40, phase: 0.0 },
      { x: 21, y: 46, w: 3, h: 2, dx: -4, dy: 0, period: 3.40, phase: 0.875 },
      { x: 14, y: 75, w: 8, h: 2, dx: 8, dy: 0, period: 3.40, phase: 0.25 }
    ],
    gates: [
      { x0: 0, y0: 26, x1: 43, y1: 26 },
      { x0: 22, y0: 71, x1: 29, y1: 71 }
    ],
    pursuit: {
      zone: [0, 9, 43, 85],
      dir: 'down',
      speed: 2.8,
      trigger: [0, 27, 43, 29],
    },
    map: [
      '............................................',
      '............................................',
      '..............................#.............',
      '............................o...o...........',
      '..........oo..............o.................',
      '.@................................o.........',
      '####RRRRRR..RRRRRR######..................#.',
      '..........................................#.',
      '...................................####RRR#.',
      '....XXXXXXXXXXXXXX.................####...#.',
      '.............#.....................####...#.',
      '........................XXXXXXXXXXX####...#.',
      '...................................####...#.',
      '.............................#.....####...#.',
      '...................................####...#.',
      '..........................o..o.....####...#.',
      '................................o..####...#.',
      '....................S........*.....####...#.',
      '...................#####....................',
      '.................o..........................',
      '...............o............................',
      '.............*....................########..',
      '...........o................................',
      '............................................',
      '.........o..............XXXXXXXXXX..........',
      '............................................',
      '............................................',
      '............................................',
      '........o...................................',
      '............................................',
      '..............XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      '............................................',
      '............................................',
      '......o.....................................',
      '...........X..o.............................',
      '........o..#.........####...................',
      '.....................####...................',
      '.....o........####RRR####...................',
      '..............####...####...................',
      '......X.......####...####...................',
      '....##........####...####...................',
      '..............####...####...................',
      '..............####...####...................',
      '......XXXXXXXX####...####...................',
      '..............####...####...................',
      '..............####...####...................',
      '..............####...####.#.................',
      '..............####...####...................',
      '..............####...####...................',
      '..............####...####.......#...........',
      '..............####...####o...o..............',
      '............................................',
      '..........................*.................',
      '...................................o........',
      '...............#######..........*...........',
      '............................................',
      '............................................',
      '......................................#####.',
      '............................................',
      '......................XXXXXXXXXXX...........',
      '............................................',
      '............................................',
      '....................................o.......',
      '................................o...........',
      '............................................',
      '...........................o......RR........',
      '............................................',
      '.............................RR.............',
      '............................................',
      '.......................###..................',
      '..............XXXXXXXX......................',
      '..............########......................',
      '..............########......................',
      '..............########......................',
      '..............########......................',
      '..............########......................',
      '..............########......................',
      '..............########......................',
      '..............########......................',
      '..............########......................',
      '..............########......................',
      '............................................',
      '............................................',
      '............................................',
      '............................o...............',
      '............................................',
      '.............................oXXXXXXXXXXXX..',
      '..............................############..',
      '............................................',
      '..............................*.............',
      '...............................o............',
      '............................................',
      '............................................',
      '............................................',
      '....................................N..M....',
      '......................XXXXXXXXXX##########..',
      '............................................'
    ],
  },
  // 6 · THE WEATHER — the storm crossing, in open sky. The wind is the
  // level: west, on one clock (4 pulses calm, 3 gust), stronger than air
  // control, so a gust kills every leap east and carries every leap west.
  // Stone at body height is shelter. East into the storm: a calm jump, a
  // lee climb with a crest in the calm, a calm spark leap to a door that
  // wants a light fifteen tiles back WEST — only the gust at your back
  // carries you there — and back up the lane. Then a one-shot rime bridge
  // under a lamp that comes down with the gust, an updraft in the lee of a
  // spine, and the last calm leap onto rime that will not hold you, down
  // into the great wall's lee, where the stone is the first still air.
  // Measured in the real body: scripts/routes/weather.js.
  {
    glyph: 'weather',
    chambers: [21, 43, 65, 87],
    openEdges: true,
    wind: { dir: -1, calm: 3.40, gust: 2.55, force: 30 },
    rimeOnce: true,
    doorNeeds: { '1': 3, '2': 3 },
    currents: [
      { x0: 67, y0: 6, x1: 68, y1: 20, force: 30 }
    ],
    beams: [
      { x: 55.5, y: 8.5, period: 5.95, phase: 0.9642857142857143, spin: true }
    ],
    map: [
      '..............................................................................................................',
      '..............................................................................................................',
      '............................................................................................................##',
      '.......................................############.........#......##..........................ooooo........##',
      '....................##......................##..............#...............................................##',
      '....................##......................##..............#...............................................##',
      '....................##..........ooooo.......##..............#...................S........#..................##',
      '#.........ooo.......##......................##.........##...#.........######################...........RRR..##',
      '#...................##......#...............##..............#.............................................o.##',
      '#...................##22#####...............##..............#........#....................................o.##',
      '#...................##......................##..............#........#....................................o.##',
      '#.@...#..........S..##......................##..............#........#....................................o.##',
      '#########....#########......................##..............#........#......................................##',
      '....................##o.....................##............#..........#....................................####',
      '....................##o.....................11............#..........#......................................##',
      '....................##o......o.o.o.o......S.11...#........#..........#......................................##',
      '....................##o..................#########RRRRRR#########....#......................................##',
      '....................##o.....................................................................................##',
      '....................##.S....................................................................................##',
      '....................######.........................................................................#....######',
      '....................##.............................................................................#........##',
      '....................##.............................................................................#........##',
      '....................##.............................................................................#........##',
      '....................##.............................................................................#........##',
      '....................##.............................................................................#........##',
      '....................##.............................................................................#NMF#....##',
      '....................##.............................................................................###########',
      '....................##......................................................................................##',
      '............................................................................................................##',
      '............................................................................................................##',
      '............................................................................................................##',
      '..............................................................................................................',
      '..............................................................................................................',
      '.____________________________________________________________________________________________________________.'
    ],
  },
  // 7 · THE DEBT — the ledger, read both ways. One course of stone, the
  // page, runs the room in open sky: over it gravity is down, under it up,
  // and both faces are floors. The holes in it are the turns between sides
  // (jumped, never walked: the seam bleeds a body that is not holding on).
  // A hub with a pocket of up-gravity over the page and its mirror, a
  // pocket of down-gravity, under it. The light on the pocket's ceiling only
  // up-gravity reaches, and the light on the mirror's floor only down-gravity.
  // Their pistons are one pair, opposite phase. The door wants three lights
  // when either side alone holds at most two. Past it, two corridors, roof and
  // floor pistons half a beat apart, and the page turned twice through plumb
  // bolts to the stone.
  {
    glyph: 'debt',
    chambers: [21, 43],
    openEdges: true,
    doorNeeds: { '1': 3 },
    shuttles: [
      { x0: 30, y0: 21, x1: 37, y1: 21, period: 1.70, phase: 0.0 },
      { x0: 30, y0: 23, x1: 37, y1: 23, period: 1.70, phase: 0.5 },
      { x0: 50, y0: 18, x1: 50, y1: 26, period: 2.55, phase: 0.0 },
      { x0: 58, y0: 18, x1: 58, y1: 26, period: 2.55, phase: 0.5 }
    ],
    crushers: [
      { x: 30, y: 12, w: 2, h: 2, dx: 0, dy: 3, period: 3.40, phase: 0.0 },
      { x: 30, y: 31, w: 2, h: 2, dx: 0, dy: -3, period: 3.40, phase: 0.5 },
      { x: 47, y: 18, w: 2, h: 2, dx: 0, dy: 2, period: 3.40, phase: 0.0 },
      { x: 54, y: 25, w: 2, h: 2, dx: 0, dy: -2, period: 3.40, phase: 0.5 },
      { x: 62, y: 18, w: 2, h: 2, dx: 0, dy: 2, period: 3.40, phase: 0.0 }
    ],
    map: [
      '........................................XX........................',
      '........................................XX........................',
      '........................................XX........................',
      '........................................XX........................',
      '........................................XX........................',
      '........................................XX........................',
      '........................................XX........................',
      '........................................XX........................',
      '........................................XX........................',
      '........................................XX........................',
      '........................................##........................',
      '........................................##........................',
      '############.................#############........................',
      '...........#.................#############........................',
      '...........#.................#############........................',
      '...........#..................^^^^^^^#^^##........................',
      '...........#..................^^^^^^S^^^##........................',
      '...........#..................^^^^^^^^^^########################..',
      '...........#..................^^^^^^^^^^##.....##...#.........##..',
      '...........#..................^^^^^^^^^^##.....##...#.........##..',
      '...........#............................11..........#.............',
      '..@........#...................K........11S...F.....#...........NM',
      '.#####..#######..#####..##########################..######..######',
      '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^##^^^^^^^^^^^^^^^^^^#^^^^^',
      '^^^^^^^^^S^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^##^^^^^^^^^^^^^^^^^^#^^^^^',
      '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^..........##^^^^^^^^^^^^##^^^^#^^^^^',
      '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^..........##^^^^^^^^^^^^##^^^^#^^^^^',
      '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^..........#####################^^^^^',
      '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^..........##^^^^^^^^^^^^^^^^^^^^^^^^',
      '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^......S#..##^^^^^^^^^^^^^^^^^^^^^^^^',
      '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^#############^^^^^^^^^^^^^^^^^^^^^^^^',
      '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^#############^^^^^^^^^^^^^^^^^^^^^^^^',
      '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^#############^^^^^^^^^^^^^^^^^^^^^^^^',
      '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^##^^^^^^^^^^^^^^^^^^^^^^^^',
      '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^##^^^^^^^^^^^^^^^^^^^^^^^^',
      '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^##^^^^^^^^^^^^^^^^^^^^^^^^',
      '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^##^^^^^^^^^^^^^^^^^^^^^^^^',
      '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^##^^^^^^^^^^^^^^^^^^^^^^^^',
      '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^##^^^^^^^^^^^^^^^^^^^^^^^^',
      '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^##^^^^^^^^^^^^^^^^^^^^^^^^',
      '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^##^^^^^^^^^^^^^^^^^^^^^^^^',
      '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^##^^^^^^^^^^^^^^^^^^^^^^^^',
      '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^##^^^^^^^^^^^^^^^^^^^^^^^^',
      '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^##^^^^^^^^^^^^^^^^^^^^^^^^',
      '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^##^^^^^^^^^^^^^^^^^^^^^^^^'
    ],
  },
  // 8 · THE RETURN — the cradle, in one breath. "If you have the strength
  // to carry it out, you have the strength to carry it back." Up the left
  // limb (a chimney, a spark to a post, a dry climb), over the crown (the
  // long jump, the low road under unlight, a causeway of drank posts, a wall
  // you kick back off and spark over), up a stair of half-time bridges,
  // across on the lantern,
  // and down the right limb (a needle, the brazier's second breath, a
  // draught that is the only way up) to the stone on its own post at the end
  // of the longest reach. Thirty-nine jumps and NO sconce: the only light
  // that holds you is the one you came in by, and the keeper kneeling beside
  // it. The return is not the way home. It is where a miss sends you.
  //
  // Open sky (openEdges): there is nothing under any of it. Authored by
  // scripts/author-return.py, proved by scripts/routes/return.js.
  {
    glyph: 'return',
    chambers: [21, 43, 65, 87, 109, 131, 153, 175, 197],
    openEdges: true,
    censers: [
      { x: 139, y: 7, len: 3.0, arc: 0.95, period: 2.55, phase: 0.0 }
    ],
    shuttles: [
      { x0: 96, y0: 3, x1: 96, y1: 8, period: 1.70, phase: 0.0 }
    ],
    currents: [
      { x0: 190, y0: 15, x1: 192, y1: 32, force: 46 }
    ],
    map: [
      '............................................................................................................................................................................................................................',
      '............................................................................................................................................................................................................................',
      '................................................................................................#...............................................ooo.........................................................................',
      '............................................................................................................................................................................................................................',
      '............................................................................................................................................................................................................................',
      '............................................................................................................................................................................................................................',
      '..........................................................................................ooo........................................K......................................................................................',
      '.............................................................................................................................bb..=====....................................oo................................................',
      '............................................................................................#.......................................................#######.........o.......................................................',
      '............................................................................................#===...###..............bb...AA.................................o.....o.........................................................',
      '........................................................XXXXXXXXX...........................#...............................................................................................................................',
      '.................................................ooo....#########....ooo....................#...........AA..#####............................................o.........*.............o......................................',
      '........................................................XXXXXXXXX......................##...#..........................................................................................o....................................',
      '............................................................................................#.................................................................................................XXX.........o.................',
      '...............................................................................==...........#..................................................................#..............................###...........o...............',
      '............................................................................................#..................................................................#.........................o..................................',
      '...........................................=====.....===..==..==.===.....==...........###...#..................................................................#.............######.........................................',
      '...........................................#................................................#...............................................................................................................................',
      '...........................................#................................................#.....................................................................................................######.......o............',
      '...........................................#................................................#...............................................................................................................................',
      '...........................................#................................................#...............................................................................................................................',
      '...........................................#................................................#....................................................................................................................o..........',
      '...........................ooo.....o.......#................................................#...............................................................................................................................',
      '..................................o........#................................................................................................................................................==..............................',
      '................#....................===...#................................................................................................................................................................................',
      '................#..........................#.......................................................................................................................................................................M........',
      '................#..........................#.......................................................................................................................................................................#........',
      '................#..........................#.......................................................................................................................................................................#........',
      '................#..######.......#..................................................................................................................................................................................#........',
      '................#..#............#..................................................................................................................................................................................#........',
      '................#..#............#...........................................................................................................................................................................................',
      '................#..#............#...........................................................................................................................................................................................',
      '................#..#........................................................................................................................................................................................................',
      '................#..#...........................................................................................................................................................................#............................',
      '................#..#........................................................................................................................................................................................................',
      '...................#........................................................................................................................................................................................................',
      '...................#........................................................................................................................................................................................................',
      '...................#........................................................................................................................................................................................................',
      '...................#........................................................................................................................................................................................................',
      '...................#........................................................................................................................................................................................................',
      '.............###...#........................................................................................................................................................................................................',
      '..@.N..............#........................................................................................................................................................................................................',
      '.#####...##.................................................................................................................................................................................................................',
      '............................................................................................................................................................................................................................',
      '............................................................................................................................................................................................................................',
      '............................................................................................................................................................................................................................'
    ],
  },
  // 9 · THE KINDLED — the exam, in the dark. A boustrophedon that climbs:
  // the lamplight floor right (a moth over the spark gap, half-time floors
  // under plumb bolts, a dark wall to the first light); the lantern gallery
  // up the hall (crown to crown, then a vent past a burning lantern); the
  // middle floor left (rime under pistons, an inverted span, a piston
  // chimney with one niche, a curtain); and the exhale, the one lit floor,
  // where the dark wakes behind you and chases you right across everything
  // in miniature to the dais and the four who stayed. Three lights.
  {
    glyph: 'kindled',
    chambers: [21, 43],
    openEdges: true,
    shuttles: [
      { x0: 12, y0: 45, x1: 12, y1: 40, period: 2.55, phase: 0, snuff: true },
      { x0: 21, y0: 41, x1: 21, y1: 46, period: 1.70, phase: 0 },
      { x0: 26, y0: 41, x1: 26, y1: 46, period: 1.70, phase: 0.5 },
      { x0: 31, y0: 41, x1: 31, y1: 46, period: 1.70, phase: 0 },
      { x0: 45, y0: 28, x1: 49, y1: 28, period: 1.70, phase: 0.5 },
      { x0: 30, y0: 12, x1: 34, y1: 12, period: 1.70, phase: 0 }
    ],
    censers: [
      { x: 47.5, y: 31, len: 9.0, arc: 0.29, period: 2.55, phase: 0 },
      { x: 54, y: 31, len: 9.6, arc: 0.29, period: 2.55, phase: 0.5 },
      { x: 60, y: 26, len: 2.5, arc: 1.00, period: 2.55, phase: 0.5 },
      { x: 35.5, y: 5, len: 3.0, arc: 1.00, period: 2.55, phase: 0 }
    ],
    crushers: [
      { x: 29, y: 26, w: 2, h: 1, dx: 0, dy: 2, period: 3.40, phase: 0 },
      { x: 33, y: 26, w: 2, h: 1, dx: 0, dy: 2, period: 3.40, phase: 0.5 },
      { x: 1, y: 23, w: 2, h: 2, dx: 2, dy: 0, period: 3.40, phase: 0 },
      { x: 5, y: 18, w: 2, h: 2, dx: -2, dy: 0, period: 3.40, phase: 0.75 },
      { x: 52, y: 10, w: 2, h: 1, dx: 0, dy: 3, period: 3.40, phase: 0 }
    ],
    gates: [
      { x0: 3, y0: 15, x1: 4, y1: 15, dir: 'up' }
    ],
    currents: [
      { x0: 62, y0: 26, x1: 63, y1: 37, force: 46 },
      { x0: 35, y0: 5, x1: 36, y1: 15, force: 46 }
    ],
    pursuit: {
      zone: [5, 2, 55, 17],
      dir: 'right',
      speed: 3.2,
      trigger: [17, 6, 20, 13],
    },
    map: [
      '..................................................................',
      '.dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd.',
      '.dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd.',
      '.dddd................dddddddddddddddddddddddddddddddddddddddddddd.',
      '.dddd................dddddddddddddd##dddddddddddddddddddddddddddd.',
      '.dddd................dddddddddddddddddddddddddddddddddddddddddddd.',
      '.dddd................dddddddddddddddddddddddddddddddddddddddddddd.',
      '.dddd................dddddddddddddddddddddddddddddddddddddddddddd.',
      '.dddd................ddddddddddddddddddddddddddddddd##ddddKNdMFCd.',
      '.dddd................ddddddddddddddddddddddddddddddd##ddd#######d.',
      '.dddd................dddddddddddddddddddddddddddddddddddd#######d.',
      '.dddd................dddddddddddddddd#######ddddddddddddd#######d.',
      '.dddd................dddddddddddddddddddddddodddddddddddd#######d.',
      '.dddd...N..S.........dddddddddddddddddddddddodddddddddddd#######d.',
      '.d#dd################dAAAd###d#####ddddddddddRRRRRR#############d.',
      '.d#dd#ddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd.',
      '.d#dd#dddddddddddddddXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXd.',
      '.d#dd#ddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd.',
      '.d#dd###########################################################d.',
      '.d#dd###########################################################d.',
      '.d#dd###########################################################d.',
      '.d#dddd#######dd^^^X^^^X^^dd####################################d.',
      '.d#dddd#######od^^^^^^^^^^dd####################################d.',
      '.d#dd#########dd^^^^^^^^^^dd####################################d.',
      '.d#dd#########do^^^^^^^^^^dd####################################d.',
      '.d#do#########dd^^^^^^^^^^dd######################################',
      '.d#dd#ddddddddod^^^^^^^^^^dddddddddddddddddddddddddddddddddddddd##',
      '.d#od#dddddddddddddddddddddddddddddddddddddddddddddddddddddddddd##',
      '.d#ddddddddddddodddddddddddddddddddddddddddddddddddddddddddddddd##',
      '.d#ddddddddddNddddddddddddddddddddddddFdSddddddddddddddddddddddd##',
      '.d##############dddddddddd##RRRRRRRR###############dd#########dd##',
      '.ddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd##',
      '.ddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd##',
      '.dddddddddddddddXXXXXXXXXXddXXXXXXXXdddddddddddddddddddddddddddd##',
      '.ddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd##',
      '.ddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd##',
      '.ddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd##',
      '.ddddddddddddddddddddddddddddddddddddSdddddddodddddddddddddddddd##',
      '.ddddddddddddddddddddddddddddddddddd########oddddddddddddd########',
      '.ddddddddddddddddddddddddddddddddddd########dddddddddddddddddddd##',
      '.ddddddddddddddddddd#############ddd########dddddddddddddddddddd##',
      '.ddddddddddddddddddddddddddddddddddd########dddddddddddddddddddd##',
      '.ddddddddddddodddddddddddddddddddddd########dddddddddddddddddddd##',
      '.ddddddddddodddodddddddddddddddddddd########dddddddddddddddddddd##',
      '.dddddddddddddddddddddddddddddddd###########dddddddddddddddddddd##',
      '.dddddddddddddddddddddddddddbbbddddd########dddddddddddddddddddd##',
      '.dd@ddddFddddddddddKdddAAAdddddddddd########dddddddddddddddddddd##',
      '.#########ddddddd####ddddddddddddddd########dddddddddddddddddddd##',
      '.ddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd##',
      '..........XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX..'
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
