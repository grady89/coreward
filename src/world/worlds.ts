// Dig sites: each world is a new seed, a new palette, and one changed rule on
// the shared engine. ACTIVE is set once at boot before any scene construction.

export interface FogStop { row: number; fog: number; density: number; hemi: number; amb: number; ambI: number; }

export interface WorldDef {
  id: string;
  name: string;
  coreName: string;
  tagline: string;
  unlockAfter: string | null;
  valueMul: number;
  /** six band names matching BAND_FROM rows */
  strata: [string, string, string, string, string, string];
  /** solid colors for bands: topsoil, regolith, mid, deep, core-reach */
  rockColors: [number, number, number, number, number];
  /** sky gradient top→horizon + sun + hemisphere */
  sky: { top: string; mid: string; low: string; horizon: string; sun: number; halo: number; hemi: number; hemiGround: number };
  fogStops: FogStop[];
  /** gauge fiction: same math, different label/visuals */
  hazard: { label: string; cold: boolean; cause: string };
  /** the molten/corrosive fluid replacing lava */
  fluid: { name: string; base: number; pulseA: number; pulseB: number; dmg: number; fuelDrain: number; threshold: number };
  /** pressure worlds fling the pod when a gas pocket bursts */
  gasImpulse: number;
  /** glazed ice: halved grounded traction */
  iceTraction: boolean;
  /** which organ the local swarm evolved to read — the world's dialect */
  swarm: {
    name: string;
    /** 'light' = your lamp · 'heat' = your thrusters · 'space' = proximity */
    keys: 'light' | 'heat' | 'space';
    color: number;
    hunting: number;
    /** what the HUD says when they wake */
    alert: string;
    /** the counter, told to the player once */
    counter: string;
  };
  core: { body: number; shell: number; light: number };
  gemTint: number; // biolume + fleck tint for the dark band
  ending: { title: string; text: string };
  lore: [string, string, string, string, string];
}

export const WORLDS: WorldDef[] = [
  {
    id: 'veil3',
    name: 'VEIL-3',
    coreName: 'THE EMBER',
    tagline: 'The light you’re looking for is under you.',
    unlockAfter: null,
    valueMul: 1,
    strata: ['TOPSOIL', 'REGOLITH', 'SLATEBED', 'THE VOID VEINS', 'EMBERREACH', 'THE CORE'],
    rockColors: [0x9a6a38, 0x8a4c2c, 0x5e708a, 0x3a3a56, 0x5a323c],
    sky: { top: '#0b1020', mid: '#2a1a3e', low: '#a04a34', horizon: '#ffb066', sun: 0xffc98a, halo: 0xff9a3c, hemi: 0xffb066, hemiGround: 0x3a2a1e },
    fogStops: [
      { row: -6, fog: 0x221430, density: 0.005, hemi: 0.9, amb: 0x2a2338, ambI: 0.35 },
      { row: 24, fog: 0x181120, density: 0.016, hemi: 0.34, amb: 0x40342e, ambI: 0.65 },
      { row: 100, fog: 0x0c1018, density: 0.022, hemi: 0.1, amb: 0x46587a, ambI: 1.05 },
      { row: 220, fog: 0x05070c, density: 0.028, hemi: 0.05, amb: 0x2c4e58, ambI: 0.95 },
      { row: 330, fog: 0x190a06, density: 0.026, hemi: 0.05, amb: 0x58302a, ambI: 1.0 },
      { row: 450, fog: 0x30100a, density: 0.022, hemi: 0.04, amb: 0x66381c, ambI: 1.2 },
      { row: 505, fog: 0x481a0c, density: 0.018, hemi: 0.02, amb: 0x74381a, ambI: 1.35 },
    ],
    hazard: { label: 'HEAT', cold: false, cause: 'core heat' },
    fluid: { name: 'Magma', base: 0xff5a2a, pulseA: 0xff6a2e, pulseB: 0xff5222, dmg: 24, fuelDrain: 0, threshold: 0.74 },
    gasImpulse: 0,
    iceTraction: false,
    swarm: {
      name: 'GLIMMERFLIES', keys: 'light',
      color: 0x8a7a4a, hunting: 0xffd27a,
      alert: 'SOMETHING IN THE DARK',
      counter: 'THEY FOLLOW THE LAMP — F TO RUN DARK',
    },
    core: { body: 0xffc98a, shell: 0xff6a2a, light: 0xff9a3c },
    gemTint: 0x46e6c8,
    ending: {
      title: 'THE EMBER',
      text: 'You leave the pod at the chamber mouth and walk the last meters on foot —<br/>into a warmth the surface never had. A piece of a star, still burning.<br/>It has waited centuries. It is glad you came.<br/><br/>And it is not alone. The dish upstairs is already listening for its siblings.',
    },
    lore: [
      'The sun never sets here. It never rises either. VEIL-3 hangs in amber, and everyone who could leave already has. The rig stays because I stay.',
      'The slate rings when you cut it, like a struck bell held underwater. Old-timers said the planet remembers the impact. I used to laugh at that.',
      'There is light down here where no light should be. The veinlight grows where the caves breathe, and it burns in a fuel cell as sweetly as it glows. The veins all point the same direction: down. Everything down here points down.',
      'The rock is warm now, and it glows through its cracks like a banked fire. Whatever fell here centuries ago — it did not die. It is waiting to be dug out.',
      'They called it a meteor. It is not a meteor. It is a piece of a star, and it is still burning, and it has been waiting a very long time for company.',
    ],
  },
  {
    id: 'cryos2',
    name: 'CRYOS-2',
    coreName: 'THE GLACIER HEART',
    tagline: 'Even a frozen star is still a star.',
    unlockAfter: 'veil3',
    valueMul: 1.5,
    strata: ['FIRNFIELD', 'PACKICE', 'THE BLUE DEEP', 'THE HUSH', 'HEARTREACH', 'THE HEART'],
    rockColors: [0xc8cdd6, 0x8fa6c0, 0x4a6a96, 0x2a3050, 0x2e5a56],
    sky: { top: '#060a16', mid: '#12244a', low: '#3a6a8a', horizon: '#bfe8ff', sun: 0xd8f0ff, halo: 0x8ac8ff, hemi: 0xbfe0ff, hemiGround: 0x24303e },
    fogStops: [
      { row: -6, fog: 0x101c2e, density: 0.005, hemi: 0.9, amb: 0x28313e, ambI: 0.4 },
      { row: 24, fog: 0x0e1826, density: 0.016, hemi: 0.34, amb: 0x2e3a4c, ambI: 0.7 },
      { row: 100, fog: 0x0a121e, density: 0.022, hemi: 0.1, amb: 0x3c5a80, ambI: 1.05 },
      { row: 220, fog: 0x04060c, density: 0.028, hemi: 0.05, amb: 0x223050, ambI: 0.9 },
      { row: 330, fog: 0x061410, density: 0.026, hemi: 0.05, amb: 0x1e4a3c, ambI: 1.0 },
      { row: 450, fog: 0x0a2418, density: 0.022, hemi: 0.04, amb: 0x2a6448, ambI: 1.2 },
      { row: 505, fog: 0x0e3020, density: 0.018, hemi: 0.02, amb: 0x38785a, ambI: 1.35 },
    ],
    hazard: { label: 'FROST', cold: true, cause: 'deep frost' },
    fluid: { name: 'Cryobrine', base: 0x5ad8e6, pulseA: 0x62e0ee, pulseB: 0x4ac8da, dmg: 16, fuelDrain: 2.5, threshold: 0.74 },
    gasImpulse: 0,
    iceTraction: true,
    swarm: {
      name: 'RIMEWINGS', keys: 'heat',
      color: 0x4a6a8a, hunting: 0xbfe0ff,
      alert: 'THE ICE IS THAWING',
      counter: 'YOUR ENGINE WAKES THEM — CUT THRUST AND DRIFT',
    },
    core: { body: 0xc8fff0, shell: 0x5affc8, light: 0x7affd8 },
    gemTint: 0x8ac8ff,
    ending: {
      title: 'THE GLACIER HEART',
      text: 'The ice sings as you walk the last gallery — a slow tone under everything.<br/>The Heart hangs in its cathedral of frost, green light through a kilometer of glass.<br/>Frozen, they said. Dormant. But nothing dormant watches you back.',
    },
    lore: [
      'The firn squeaks under the pads like it resents being landed on. The dish says the second fragment is here. The cold says leave.',
      'Ice is a mineral, technically. So is everything, if it stands still long enough. The blue down here is old light that never got back out.',
      'No wind, no engines, no settling rock. The crews called this band the Hush and stopped whistling in the tunnels. I understand them now.',
      'The frost bites through three layers of hull plating. But the green glow past it is getting brighter, and the drill hand does not want to stop.',
      'A star that fell into an ocean and the ocean closed over it like a fist. Centuries of ice in every direction, and at the center — a heartbeat.',
    ],
  },
  {
    id: 'maelis6',
    name: 'MAELIS-6',
    coreName: 'THE PEARL',
    tagline: 'The deep does not want to be opened.',
    unlockAfter: 'cryos2',
    valueMul: 2.25,
    strata: ['SALTCRUST', 'THE SHALLOWS', 'GREENREEF', 'THE ABYSSAL', 'PEARLREACH', 'THE PEARL'],
    rockColors: [0x7a8a6a, 0x4c7a6e, 0x2e6058, 0x1c2a34, 0x4a5a72],
    sky: { top: '#04121a', mid: '#0a3040', low: '#1a6a62', horizon: '#8ae8c8', sun: 0xc8ffe8, halo: 0x3ce6c8, hemi: 0x8ae8c8, hemiGround: 0x1c2e2a },
    fogStops: [
      { row: -6, fog: 0x0a2028, density: 0.006, hemi: 0.9, amb: 0x1e3230, ambI: 0.4 },
      { row: 24, fog: 0x081a20, density: 0.017, hemi: 0.34, amb: 0x243e38, ambI: 0.7 },
      { row: 100, fog: 0x061418, density: 0.023, hemi: 0.1, amb: 0x2a5a4c, ambI: 1.05 },
      { row: 220, fog: 0x030608, density: 0.03, hemi: 0.05, amb: 0x16323e, ambI: 0.9 },
      { row: 330, fog: 0x0a0e16, density: 0.026, hemi: 0.05, amb: 0x2e3a56, ambI: 1.0 },
      { row: 450, fog: 0x161c2e, density: 0.02, hemi: 0.04, amb: 0x4a5678, ambI: 1.25 },
      { row: 505, fog: 0x222c44, density: 0.016, hemi: 0.02, amb: 0x60709a, ambI: 1.45 },
    ],
    hazard: { label: 'PRESSURE', cold: true, cause: 'crush pressure' },
    fluid: { name: 'Brine', base: 0x2ea86a, pulseA: 0x34b874, pulseB: 0x28985e, dmg: 12, fuelDrain: 4, threshold: 0.7 },
    gasImpulse: 16,
    iceTraction: false,
    swarm: {
      name: 'PRESSURE POLYPS', keys: 'space',
      color: 0x2e6a5a, hunting: 0x6affc8,
      alert: 'THE WALLS ARE BREATHING',
      counter: 'THEY ANSWER TO NEARNESS — GIVE THEM ROOM',
    },
    core: { body: 0xf0eaff, shell: 0xb0a0ff, light: 0xd8ccff },
    gemTint: 0x3ce6c8,
    ending: {
      title: 'THE PEARL',
      text: 'The last fragment does not burn and does not sing. It simply waits,<br/>white and patient, wrapped in the pressure of a drowned world.<br/>Three pieces of one star, and you have stood beside all of them.<br/>Whatever they were before they fell — they know the way back now. So do you.',
    },
    lore: [
      'The crust is salt a meter down. The ocean is under everything here, pressing up. The rig sits on the lid of it and pretends not to notice.',
      'Green light through the brine seams, like the reef is breathing. The pressure gauge climbed two bars while I wrote this sentence.',
      'The abyssal band eats sound. Drill chatter goes out and nothing comes back. The wrecks down here are all facing downward. All of them.',
      'The brine strips paint, then plating, then nerve. But past it the water goes still and white, like the inside of a shell. We are close.',
      'A pearl is a wound a shell learned to love. The ocean has been holding this one for centuries, layering itself around a piece of the sky.',
    ],
  },
];

export let ACTIVE: WorldDef = WORLDS[0];

export function setActiveWorld(id: string): void {
  ACTIVE = WORLDS.find(w => w.id === id) ?? WORLDS[0];
}

export function worldById(id: string): WorldDef | undefined {
  return WORLDS.find(w => w.id === id);
}

export function nextWorld(afterId: string): WorldDef | undefined {
  return WORLDS.find(w => w.unlockAfter === afterId);
}
