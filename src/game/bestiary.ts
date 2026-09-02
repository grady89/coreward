import { FaunaEvent } from '../world/fauna/types';

// THE FAUNA LOG — the assay office's census of everything alive down there.
//
// Discovery is a save-persistent key in state.firedEvents: any creature
// event stamps `fauna:<id>` (see main.onFaunaEvent), and each entry also
// honours the older one-time Dispatch lesson keys, so a save from before
// the log existed still shows everything the driller has already met.

export interface FaunaEntry {
  id: string;
  name: string;
  /** null: the constants — the Lamplighters', on every world */
  world: 'veil3' | 'cryos2' | 'maelis6' | null;
  /** one-line classification under the name */
  tier: string;
  /** what it is, once identified */
  desc: string;
  /** the counter, in the field-manual register */
  rule: string;
  /** its glow, for the row marker */
  color: number;
  /** any of these in firedEvents = identified */
  keys: string[];
}

export const FAUNA: FaunaEntry[] = [
  // ---------------- VEIL-3 ----------------
  {
    id: 'glimmerflies', name: 'GLIMMERFLIES', world: 'veil3',
    tier: 'swarm · keyed on light', color: 0xffe08a,
    desc: 'Slivers of living glass that only show themselves edge-on to a lamp. Lit, the resting ring collapses inward and pours at the light in a ribbon.',
    rule: 'Run dark and they lose you inside two seconds — but they wait where they lost you.',
    keys: ['fauna:glimmerflies', 'swarm-taught:veil3'],
  },
  {
    id: 'longone', name: 'THE LONG ONE', world: 'veil3',
    tier: 'hunter · hunts by vibration', color: 0xff7a3c,
    desc: 'Eyeless. Overlapping chitin plates, a split mandible, dorsal lights pulsing tail to head. It comes through the wall, and it fills the passage.',
    rule: 'Cut the engine, stop the drill, sit still — a still pod is a stone. It cannot follow into a one-wide shaft.',
    keys: ['fauna:longone', 'longone-taught'],
  },
  {
    id: 'mimic', name: 'GEODE MIMIC', world: 'veil3',
    tier: 'thief · keyed on greed', color: 0xb266ff,
    desc: 'In the voidopal band, an opal a shade too violet and a size too big. Cut it and it unfolds — six legs, and the best thing in your hold lifted onto its back.',
    rule: 'Drill, lance or blast it before it is gone and the ore comes back. It is not fast.',
    keys: ['fauna:mimic', 'mimic-taught'],
  },
  // ---------------- CRYOS-2 ----------------
  {
    id: 'rimewings', name: 'RIMEWINGS', world: 'cryos2',
    tier: 'swarm · keyed on heat', color: 0xbfe0ff,
    desc: 'A constellation of ice hanging in the dark, absolutely still. Engine wash or drill heat thaws them into frost moths that dart at the nozzle.',
    rule: 'Coast when you can; fly cold. Cut thrust and they slow, sink, and lock again. A flare pulls them off you.',
    keys: ['fauna:rimewings', 'rimewing-taught'],
  },
  {
    id: 'brinewyrm', name: 'THE BRINEWYRM', world: 'cryos2',
    tier: 'hunter · keyed on heat', color: 0x5ad8e6,
    desc: 'A pale gut-light cruising under the brine. It breaches — a milk-white eel with a lamprey’s ring of teeth — and the bite drags you back toward the pool.',
    rule: 'The surface churns a full second before it comes. That is your one warning. Move, or throw it a flare to bite.',
    keys: ['fauna:brinewyrm', 'brinewyrm-taught'],
  },
  {
    id: 'stillwalker', name: 'STILLWALKERS', world: 'cryos2',
    tier: 'stalker · keyed on the absence of light', color: 0x9ad0ff,
    desc: 'Too tall. A figure of black shards standing in the rock where there was nothing a second ago. Unlit, it walks — through ice, through rock, straight at you.',
    rule: 'It does not move while it is seen. Keep it lit, or keep a flare between you.',
    keys: ['fauna:stillwalker', 'stillwalker-taught'],
  },
  {
    id: 'frostbloom', name: 'FROSTBLOOM', world: 'cryos2',
    tier: 'bait · a flower that is not veinlight', color: 0xb0a8ff,
    desc: 'A pale bloom in the veinlight. Cut it and the cold comes out all at once: fuel gone, and the pocket sets solid in young ice around the pod.',
    rule: 'You are encased, not entombed. Young ice gives to a drill, or to a running start.',
    keys: ['fauna:frostbloom', 'frostbloom-taught'],
  },
  // ---------------- MAELIS-6 ----------------
  {
    id: 'polyps', name: 'PRESSURE POLYPS', world: 'maelis6',
    tier: 'swarm · keyed on space', color: 0x9ef0d0,
    desc: 'Translucent sacs where the rock is thin, breathing in a rhythm. They inflate faster the faster you move — green draining to white — and burst in chains.',
    rule: 'Anything glowing in a rhythm is counting you. Drift, do not rush. A flare pops them from range.',
    keys: ['fauna:polyps', 'polyp-taught'],
  },
  {
    id: 'riptide', name: 'THE RIPTIDE', world: 'maelis6',
    tier: 'hunter · keyed on space', color: 0x3ce6c8,
    desc: 'Never seen whole. A spiral of motes all leaning one way, a shadow far too big behind the rock, and — when you are close — an eye the size of a room.',
    rule: 'Its grip is open water. Keep a wall at your back; a one-wide shaft breaks its hold entirely.',
    keys: ['fauna:riptide', 'riptide-taught'],
  },
  {
    id: 'shellbacks', name: 'SHELLBACKS', world: 'maelis6',
    tier: 'builder · keyed on space', color: 0xe8dcff,
    desc: 'Nacre isopods the length of the pod, fourteen legs in a rolling wave. They walk the tunnels you dug and seal them with pearl, plate by plate.',
    rule: 'Nacre cuts easy and it sells. Lure one with a flare, or kill it — it drops more. They close holes; they will not wall off your last way out.',
    keys: ['fauna:shellbacks', 'shellback-taught'],
  },
  // ---------------- the constants ----------------
  {
    id: 'warden', name: 'WARDENS', world: null,
    tier: 'Lamplighter machinery, still on post', color: 0xffe0a0,
    desc: 'A tripod with a lantern where a head should be, walking one leg at a time. Caught in the beam, it narrows, goes white, and the machine walks — and the beam itself burns.',
    rule: 'It tracks light and nothing else. Run dark and it sweeps past. The Lance blinds it; two charges bring it down.',
    keys: ['fauna:warden'],
  },
  {
    id: 'kindled', name: 'THE KINDLED', world: null,
    tier: 'the core chamber’s own', color: 0xfff2d8,
    desc: 'Figures of the core’s own light on the chamber floor, something dark and narrow inside where a body would be. They turn when you enter, and stop two steps short.',
    rule: 'They do not chase and they do not want the pod — but do not walk into one on foot. They are keeping it company.',
    keys: ['fauna:kindled', 'kindled-taught'],
  },
];

export const faunaSeen = (f: FaunaEntry, fired: Set<string>): boolean =>
  f.keys.some(k => fired.has(k));

/** which log entry a creature event credits, for stamping `fauna:<id>` */
export function faunaForEvent(id: FaunaEvent): string | null {
  if (id === 'swarm-wake') return 'glimmerflies';
  if (id === 'frostbloom') return 'frostbloom';
  if (id === 'crab-skitter' || id.startsWith('mimic-')) return 'mimic';
  if (id.startsWith('longone-')) return 'longone';
  if (id.startsWith('rimewing-')) return 'rimewings';
  if (id.startsWith('brinewyrm-')) return 'brinewyrm';
  if (id.startsWith('stillwalker-')) return 'stillwalker';
  if (id.startsWith('polyp-')) return 'polyps';
  if (id.startsWith('riptide-')) return 'riptide';
  if (id.startsWith('shellback-')) return 'shellbacks';
  if (id.startsWith('warden-')) return 'warden';
  if (id.startsWith('kindled-')) return 'kindled';
  return null;
}
