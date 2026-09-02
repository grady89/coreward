import { Terrain } from '../world/terrain';
import { T } from '../world/tiles';
import { ThreatField } from '../world/entities';
import { Creature } from '../world/fauna/types';

/**
 * FAUNA SANDBOX — dev only, reached with ?fauna in the URL.
 *
 * Every creature needs specific ground before it will even appear: the
 * Brinewyrm wants a sealed brine pool, Shellbacks only live in tiles you
 * dug, a Warden posts only while you are 5–18 tiles from a ruin. That
 * knowledge used to live in the headless suite, where you cannot see
 * anything move. It lives here now, and the suite calls the same code.
 *
 * This file prepares the ground and says what to look at. Putting the
 * creature on it is the creature's own job — Creature.devStage().
 */

export interface StageCtx {
  terrain: Terrain;
  /** carve a rectangle to air the way a drill would (records the dig) */
  room(x0: number, x1: number, y0: number, y1: number): void;
  /** force a tile to a type whatever is there — dev only, no dig record */
  set(x: number, y: number, t: T): void;
  /**
   * Park the pod stopped at column x, row `row`. `zoom` holds the camera
   * back for the whole stage (play sits at 12.5) — a Long One is seven
   * tiles of body and the Riptide's field is nine across, and neither
   * reads at the framing the game normally uses.
   */
  park(x: number, row: number, zoom?: number): void;
  lamp(on: boolean): void;
  /** stock the hold, for the creatures that take things out of it */
  cargo(...tiles: T[]): void;
}

export interface FaunaStage {
  id: string;
  label: string;
  /** which world has to be loaded for this creature to exist at all */
  world: 'veil3' | 'cryos2' | 'maelis6';
  /** the chamber stages start from the core jump, not a carved room */
  core?: boolean;
  /** the one thing to watch */
  look: string;
  /** what to press to make it happen */
  how: string;
  setup(c: StageCtx): void;
  /** the creature to force alive each frame until `alive` reports true */
  pick(t: ThreatField): Creature | null;
  alive(t: ThreatField): boolean;
}

export const STAGES: FaunaStage[] = [
  // ---------------- VEIL-3 ----------------
  {
    id: 'glimmerflies',
    label: 'GLIMMERFLIES',
    world: 'veil3',
    look: 'The ring collapses inward, then unfolds into a ribbon that pours at the lamp.',
    how: 'F kills the lamp — they lose you in ~2s and hang where they lost you.',
    setup(c) {
      c.room(14, 50, 200, 214);
      c.park(31.5, 214);
      c.lamp(true);
    },
    pick: t => t.flies,
    alive: t => !!t.flies?.swarms.some(s => s.alive),
  },
  {
    id: 'longone',
    label: 'THE LONG ONE',
    world: 'veil3',
    look: 'Dust jumps off the wall in a line, then the head comes through. Dorsal lights pulse tail-to-head.',
    how: 'Hold ↓ to drill and it comes; stop dead (no engine, no drill) for ~2s and it loses you.',
    setup(c) {
      c.room(6, 58, 330, 344);
      c.park(31.5, 344, 18);
    },
    pick: t => t.longOne,
    alive: t => !!t.longOne?.alive,
  },
  {
    id: 'mimic',
    label: 'GEODE MIMIC',
    world: 'veil3',
    look: 'The rock unfolds, lifts the best ore in your hold onto its back, and skitter-freezes up the wall.',
    how: 'Ram it or hold ↓ on it to get the ore back before it escapes.',
    setup(c) {
      c.room(22, 42, 312, 324);
      c.park(31.5, 324);
      c.cargo(T.DIAMOND, T.COPPER);
    },
    pick: t => t.mimics,
    alive: t => !!t.mimics?.crabs.some(x => x.alive),
  },
  {
    id: 'warden',
    label: 'WARDEN',
    world: 'veil3',
    look: 'Plant, lift, swing, PLANT — one leg at a time. The beam narrows and goes white when it finds you.',
    how: 'F to run dark and it sweeps past. G drops a charge — it takes two.',
    setup(c) {
      // it posts as you APPROACH a hall, never once you are standing in one:
      // a lit pocket above ruins[0] is the only place that reads as approach
      const r = c.terrain.ruins[0];
      if (!r) return;
      const rx = Math.floor(r.x), ry = Math.floor(r.y);
      c.room(rx + 1, rx + 6, ry - 10, ry - 6);
      c.park(rx + 3.5, ry - 6, 16);
      c.lamp(true);
    },
    pick: t => t.wardens,
    alive: t => !!t.wardens?.alive,
  },
  {
    id: 'kindled',
    label: 'THE KINDLED',
    world: 'veil3',
    core: true,
    look: 'They face the fragment. When you enter they turn, drift toward you, and stop two steps short.',
    how: 'E to step out and walk at one — on foot they give ground until the wall is behind them.',
    setup(c) {
      c.park(24.5, 509);
    },
    pick: () => null,
    alive: () => true,
  },

  // ---------------- CRYOS-2 ----------------
  {
    id: 'rimewings',
    label: 'RIMEWINGS',
    world: 'cryos2',
    look: 'Absolutely still until the wash reaches them — then they shiver, shed frost and come apart one at a time.',
    how: 'Hold ↑ to thaw them. Cut thrust and they slow, sink, and lock again wherever they are.',
    setup(c) {
      c.room(14, 50, 254, 268);
      c.park(31.5, 268);
    },
    pick: t => t.rimewings,
    alive: t => !!t.rimewings?.clusters.some(x => x.alive),
  },
  {
    id: 'brinewyrm',
    label: 'THE BRINEWYRM',
    world: 'cryos2',
    look: 'A pale glow cruising under the brine. It rises, the surface boils for a full second, then it breaches.',
    how: 'Hold ↑ over the pool to wake it (heat within ~7 tiles). Q throws a flare — that is heat too.',
    setup(c) {
      // a LOW room: thrust is what wakes it, and in a tall chamber the pod
      // climbs straight out of its 7.5-tile notice range while doing so
      c.room(24, 40, 306, 310);
      // sealed: rock all round, or it wanders off into natural brine and
      // loses your engine — three debug cycles' worth of hard-won staging
      for (let y = 310; y < 316; y++) for (let x = 25; x < 39; x++) c.set(x, y, T.ROCK);
      for (let y = 310; y < 314; y++) for (let x = 27; x < 37; x++) c.set(x, y, T.LAVA);
      c.park(31.5, 309);
    },
    pick: t => t.brinewyrm,
    alive: t => !!t.brinewyrm?.alive,
  },
  {
    id: 'stillwalkers',
    label: 'STILLWALKERS',
    world: 'cryos2',
    look: 'A cut-out figure inside the rock. Lit, not a tremor. Unlit, it walks — through rock, straight at you.',
    how: 'F. That is the whole creature. Watch the red dread wash come up as it closes.',
    setup(c) {
      c.room(12, 52, 332, 346);
      c.park(31.5, 346, 17);
      c.lamp(true);
    },
    pick: t => t.stillwalkers,
    alive: t => !!t.stillwalkers?.walkers.some(w => w.alive),
  },
  {
    id: 'frostbloom',
    label: 'FROSTBLOOM',
    world: 'cryos2',
    look: 'Fake veinlight. Cut it and the cold comes out at once — the pocket sets to rime around the pod.',
    how: 'Hold ↓. You are encased, not entombed: ram straight through the young ice.',
    setup(c) {
      c.room(24, 40, 248, 256);
      c.set(31, 256, T.FROSTBLOOM);
      c.park(31.5, 256);
    },
    pick: () => null,
    alive: () => true,
  },

  // ---------------- MAELIS-6 ----------------
  {
    id: 'polyps',
    label: 'PRESSURE POLYPS',
    world: 'maelis6',
    look: 'Sacs breathing on the wall. They inflate faster the faster you move, green draining to white.',
    how: 'Drift in slowly and they only swell. Rush and the wall goes off like a string of charges. Q pops them from range.',
    setup(c) {
      c.room(14, 50, 150, 164);
      c.park(31.5, 164);
    },
    pick: t => t.polyps,
    alive: t => (t.polyps?.count ?? 0) > 0,
  },
  {
    id: 'riptide',
    label: 'THE RIPTIDE',
    world: 'maelis6',
    look: 'Motes all leaning the same way, a shadow too big behind the rock, and an eye that opens on a cooldown.',
    how: 'Let go and feel the drift. Then dig into the rock — grip is room², so a 1-wide shaft breaks it.',
    setup(c) {
      c.room(10, 54, 320, 344);
      c.park(31.5, 344, 18);
    },
    pick: t => t.riptide,
    alive: t => !!t.riptide?.alive,
  },
  {
    id: 'shellbacks',
    label: 'SHELLBACKS',
    world: 'maelis6',
    look: 'Fourteen legs in a rolling wave. Every few seconds it lays a plate of pearl across a tile you dug.',
    how: 'Q lures it — it will seal a lit tile before it seals yours. Hold ↓ and it curls into a ball and waits you out.',
    setup(c) {
      // they only live in tunnels YOU made, 9..16 tiles out: one long corridor
      c.room(6, 58, 200, 203);
      c.park(31.5, 203, 15);
    },
    pick: t => t.shellbacks,
    alive: t => !!t.shellbacks?.backs.some(b => b.alive),
  },
];

export const stageById = (id: string): FaunaStage | undefined =>
  STAGES.find(s => s.id === id);

/**
 * The on-screen card: which creature, what to watch, what to press. Lives
 * outside the HUD because it must survive HUD hide/show across world swaps.
 */
export class SandboxCard {
  private el: HTMLDivElement;
  private dimT = 0;
  private hidden = false;
  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.id = 'dev-sandbox';
    parent.appendChild(this.el);
  }
  show(s: FaunaStage, i: number, n: number, staged: boolean): void {
    this.el.innerHTML = `
      <div class="ds-top">FAUNA SANDBOX · ${i + 1}/${n} · ${s.world.toUpperCase()}</div>
      <div class="ds-name">${s.label}${staged ? '' : ' <em>· staging…</em>'}</div>
      <div class="ds-look">${s.look}</div>
      <div class="ds-how">${s.how}</div>
      <div class="ds-keys">[ ] cycle · \\ restage · H hide · F lamp</div>`;
    this.el.classList.remove('dim');
    this.dimT = 6;
  }
  /**
   * It sits over the bottom of the frame, which is exactly where a Warden
   * walks and a wyrm breaches. Read it, then it gets out of the way.
   */
  tick(dt: number): void {
    if (this.dimT <= 0) return;
    this.dimT -= dt;
    if (this.dimT <= 0) this.el.classList.add('dim');
  }
  toggle(): void {
    this.hidden = !this.hidden;
    this.el.classList.toggle('gone', this.hidden);
  }
  dispose(): void { this.el.remove(); }
}
