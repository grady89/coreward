import { T } from '../world/tiles';

// Narrative event engine. Every story beat in the game — dispatch chatter,
// discovery stings, act turns — is data in here, not code elsewhere. Triggers
// are evaluated cheaply each frame; fired ids persist in the save so nothing
// ever repeats.

export type TriggerKind =
  | 'start'        // value: unused — fires once when play begins
  | 'depth'        // value: metres reached (this world)
  | 'sold'         // value: lifetime lumens earned
  | 'wrecks'       // value: wrecks salvaged (lifetime)
  | 'contracts'    // value: contracts completed
  | 'arrive'       // world arrival (world field required)
  | 'cores'        // value: cores reached
  | 'ruins'        // value: unused — first Custodian structure seen
  | 'time'         // value: seconds of play
  | 'death'        // value: unused
  | 'stranded'     // value: unused
  | 'veinlight'    // value: veinlight harvested (lifetime)
  | 'ore'          // value: count, with `ore` field
  | 'order'        // SITE 297 walked; fires on the next dig-site frame
  | 'extract'      // a fragment is in the hold
  | 'seat';        // a fragment has been carried home

export interface NarrativeEvent {
  id: string;
  world?: string;            // restrict to one dig site
  trigger: TriggerKind;
  value?: number;
  ore?: T;
  /** all lines are delivered in sequence on the comm strip */
  lines: string[];
  /** higher wins when several qualify at once */
  priority?: number;
}

export interface WorldStats {
  world: string;
  depthM: number;
  totalEarned: number;
  wrecksSalvaged: number;
  contractsDone: number;
  cores: number;
  playTime: number;
  veinlightHarvested: number;
  sawRuins: boolean;
  justDied: boolean;
  justStranded: boolean;
  huskVisited: boolean;
  carryingNow: boolean;
  reseatedAny: boolean;
}

// ---------------------------------------------------------------------------
// DISPATCH — a real person on the other end of the assay dish. Act I invoices
// and small talk; Act II hedges; Act III goes off script. She is poor too.
// ---------------------------------------------------------------------------

export const EVENTS: NarrativeEvent[] = [
  // ---- ACT I: the job ----
  {
    id: 'v3-start', world: 'veil3', trigger: 'start',
    lines: [
      'Dusklight, this is Dispatch. Contract\'s live.',
      'Advance of forty is posted against your account. Standard terms — you signed them.',
      'Pull something up and we\'ll both have had a good day.',
    ],
  },
  {
    id: 'v3-first-sale', world: 'veil3', trigger: 'sold', value: 60,
    lines: [
      'Trade post logged your first sale. Nice.',
      'Against the advance, mind — the balance is what you keep.',
    ],
  },
  {
    id: 'v3-d60', world: 'veil3', trigger: 'depth', value: 60,
    lines: [
      'Reading you at sixty. Regolith\'s soft down to about a hundred and twenty.',
      'Slate starts after. It rings when you cut it. You\'ll hear what I mean.',
    ],
  },
  {
    id: 'v3-fuel-warning', world: 'veil3', trigger: 'time', value: 420,
    lines: [
      'Friendly reminder: the tow is fifteen percent and I hate writing those up.',
      'Not because of the paperwork. Because of what it does to your balance.',
    ],
  },
  {
    id: 'v3-d130', world: 'veil3', trigger: 'depth', value: 130,
    lines: [
      'You hear it? The slate. Old crews said the planet remembers the impact.',
      'I used to laugh at that. Sixteen years on this dish and I don\'t anymore.',
    ],
  },
  {
    id: 'v3-contract-1', world: 'veil3', trigger: 'contracts', value: 1,
    lines: [
      'Contract cleared. Posted to your balance same day — that\'s me pushing it through.',
      'Don\'t tell anyone I can do that.',
    ],
  },

  // ---- ACT II: someone was here ----
  {
    id: 'v3-first-wreck', trigger: 'wrecks', value: 1,
    lines: [
      'That beacon you tripped is a registered wreck.',
      'Salvage rights are yours. Company takes nothing off a dead driller.',
      '…That\'s meant to be a comfort. I hear it isn\'t one.',
    ],
  },
  {
    id: 'v3-d220', world: 'veil3', trigger: 'depth', value: 220,
    lines: [
      'Two hundred and twenty. That\'s deeper than anyone\'s taken a Coreward-class this year.',
      'I checked. It wasn\'t hard to check. There aren\'t many of you left.',
    ],
  },
  {
    id: 'veinlight-1', trigger: 'veinlight', value: 1,
    lines: [
      'Your cell just gained on a descent. That\'s the veinlight.',
      'Burns clean, grows where nothing should. Survey has it filed as a mineral.',
      'It isn\'t one. Nobody\'s updated the file.',
    ],
  },
  {
    id: 'v3-d340', world: 'veil3', trigger: 'depth', value: 340,
    lines: [
      'You\'re in the veins. Survey says nothing lives down there.',
      'Survey\'s from before my time. Keep your readings coming.',
    ],
  },
  {
    id: 'v3-wrecks-3', trigger: 'wrecks', value: 3,
    lines: [
      'Three wrecks now. I pulled the registry.',
      'They\'re all Cindral contracts. Same terms as yours, near enough word for word.',
      'The oldest is a hundred and forty years old and it is the deepest one down there.',
    ],
  },
  {
    id: 'v3-dusk', world: 'veil3', trigger: 'time', value: 1500,
    lines: [
      'Something for your logs, since you keep them.',
      'The dusk-line moved again. Nine metres this quarter, toward the rig.',
      'A tidally locked world does not have a moving dusk-line. Ask anyone. Actually — don\'t.',
    ],
  },
  {
    id: 'v3-d520', world: 'veil3', trigger: 'depth', value: 520,
    lines: [
      'Say again, Dusklight? …Right angles. At five hundred metres.',
      'Say again.',
    ],
  },
  {
    id: 'ruins-1', trigger: 'ruins',
    lines: [
      'I\'ve got your imaging. That is cut stone.',
      'Nobody was on this rock before us. That\'s in the charter. That\'s the whole basis of the claim.',
      'Keep digging. I\'m going to go and read the charter again.',
    ],
  },

  // ---- ACT III: off script ----
  {
    id: 'v3-d700', world: 'veil3', trigger: 'depth', value: 700,
    lines: [
      'They\'ve asked me to stop logging your depth readings.',
      'I\'m logging them.',
    ],
  },
  {
    id: 'v3-d900', world: 'veil3', trigger: 'depth', value: 900,
    lines: [
      'Nine hundred. It\'s getting brighter down there, isn\'t it.',
      'That\'s the part nobody warned me to lie about, so I\'ll say it plain: that is not normal.',
      'Whatever you find — tell me. I\'m not cleared for it. Tell me anyway.',
    ],
  },
  {
    id: 'core-1', trigger: 'cores', value: 1,
    lines: [
      'Dusklight? Your telemetry went to white and came back.',
      '…I filed your report an hour ago.',
      'It came back stamped. Approved, countersigned, closed. Before I sent it.',
    ],
  },
  {
    id: 'core-1-after', trigger: 'cores', value: 1, priority: -1,
    lines: [
      'Cindral is opening a second site. They had the survey ready.',
      'They had it ready before you went down. I want you to sit with that.',
    ],
  },

  // ---- reactive ----
  {
    id: 'first-death', trigger: 'death',
    lines: [
      'Recovery has you. Hull\'s a write-off, the pod\'s salvageable.',
      'Fee\'s posted to your balance. I\'m sorry. I really am — I don\'t set the schedule.',
    ],
  },
  {
    id: 'first-stranded', trigger: 'stranded',
    lines: [
      'Tow\'s rolling. Sit tight and keep your lamp off, it\'s a long ride.',
      'Don\'t do that again. I mean it kindly.',
    ],
  },
  {
    id: 'rich-1', trigger: 'sold', value: 25000,
    lines: [
      'Your balance cleared the advance today. Properly cleared it.',
      'Most drillers never see that. Most drillers are down there being salvage.',
    ],
  },

  // ---- other worlds ----
  {
    id: 'cryos-arrive', world: 'cryos2', trigger: 'arrive',
    lines: [
      'CRYOS-2. They airlifted the rig ahead of you — same buildings, same dish, same me.',
      'Ore assays half again on what Dusklight paid. That\'s the pitch.',
      'The pitch does not mention that this world froze solid and nobody has written down why.',
    ],
  },
  {
    id: 'cryos-d200', world: 'cryos2', trigger: 'depth', value: 200,
    lines: [
      'Cold\'s reading wrong on my end. It gets worse with depth.',
      'Heat rises. Cold does not sink. I don\'t know what to tell you.',
    ],
  },
  {
    id: 'cryos-accl', world: 'cryos2', trigger: 'depth', value: 380, priority: 2,
    lines: [
      'Your radiators are shedding heat you do not have. Shut them down.',
      'The crews here packed their hulls with rime salt — the white stuff in the upper beds.',
      'Bring a load to the garage. You are not going deeper without it.',
    ],
  },
  {
    id: 'maelis-accl', world: 'maelis6', trigger: 'depth', value: 280, priority: 2,
    lines: [
      'Hull\'s reading pressure it was not built for. That climbs the whole way down.',
      'Nacre. The pale layers in the shallows — the reef lays it over a wound.',
      'Do the same to your hull at the garage, or stop here.',
    ],
  },
  {
    id: 'maelis-arrive', world: 'maelis6', trigger: 'arrive',
    lines: [
      'MAELIS-6. Third site. Ore pays double and change.',
      'I asked what happened to the first two sites they closed this year.',
      'I\'m told they were exhausted. I\'m told that a lot now.',
    ],
  },
  // ---- ACT IV: the pattern ----
  {
    id: 'husk-arrive', world: 'site297', trigger: 'arrive', priority: 4,
    lines: [
      'SITE 297. I don\'t have a briefing for this one.',
      'No extraction schedule, no assay codes. The colony beacon is on. The colony isn\'t.',
      'Look around. Then come back and tell me I\'m wrong to be afraid of this.',
    ],
  },
  {
    id: 'extraction-order', trigger: 'order', priority: 4,
    lines: [
      'Priority traffic from Cindral. Reading it as written:',
      'EXTRACTION ORDER 9-1-1. FRAGMENT RECOVERY AUTHORIZED. ✦300,000 PER UNIT ON DELIVERY. ALL DRILLER DEBTS CLEARED AT FIRST DELIVERY.',
      'That\'s the whole message. They know what\'s down there. They\'ve always known.',
      'I\'m required to relay offers. I\'m not required to tell you what to do with them.',
    ],
  },
  {
    id: 'first-extract', trigger: 'extract', priority: 3,
    lines: [
      'Your hold reads hot and your world reads… dimmer. From orbit. I can see it from ORBIT.',
      'Whatever you\'re carrying — the tunnels are waking up around it. Climb.',
    ],
  },
  {
    id: 'first-seat', trigger: 'seat', priority: 3,
    lines: [
      'Telemetry says you went down heavy and came up empty.',
      'Cindral flagged the delivery as failed. I logged it as: driller declined.',
      'I\'ve never typed that before. It felt good.',
    ],
  },
  {
    id: 'cores-2', trigger: 'cores', value: 2,
    lines: [
      'Two of them now. Two.',
      'I went back through the closure records. Every site Cindral has ever exhausted went dark.',
      'Not poor. Dark. No daylight in the survey imaging, not anywhere on the planet.',
    ],
  },
  {
    id: 'cores-3', trigger: 'cores', value: 3,
    lines: [
      'That\'s all of them.',
      'Cindral\'s rotating me off the dish. New contract, new rig, somebody else\'s driller.',
      'Whatever you decide to do with what you\'re carrying — you were the good one. Dispatch out.',
    ],
  },
];

// ---------------------------------------------------------------------------
// The transcript. Dispatch is the voice on the assay dish, and the dish keeps
// a record: every transmission ever played can be reread at the assay office.
// Nothing extra is saved — `firedEvents` already persists the ids in the
// order they fired, so the transcript reconstructs from data + this registry.
// ---------------------------------------------------------------------------

/**
 * Transmissions fired directly by code rather than the trigger engine.
 * Anything played with comms.say AND recorded in firedEvents must have its
 * lines registered here, or the transcript cannot replay it.
 */
export const ADHOC_TRANSMISSIONS: Record<string, { world?: string; lines: string[] }> = {
  'rime-taught': {
    world: 'cryos2',
    lines: [
      'Your shaft is skinning over behind you. That is not drift — the ice is closing the wound.',
      'Young ice will not hold a pod. If the way home has healed, put your nose up and RAM through it.',
      'And fit the acclimation. A warm hull keeps your wake open longer. Not in the manual; it is in the wrecks.',
    ],
  },
};

/** the transmission behind a fired-event id — null for non-dispatch ids */
export function transmissionById(id: string): { world?: string; lines: string[] } | null {
  const e = EVENTS.find(ev => ev.id === id);
  if (e) return { world: e.world, lines: e.lines };
  return ADHOC_TRANSMISSIONS[id] ?? null;
}

/** returns the highest-priority unfired event whose trigger is satisfied */
export function pick(stats: WorldStats, fired: Set<string>): NarrativeEvent | null {
  let best: NarrativeEvent | null = null;
  for (const e of EVENTS) {
    if (fired.has(e.id)) continue;
    if (e.world && e.world !== stats.world) continue;
    if (!satisfied(e, stats)) continue;
    if (!best || (e.priority ?? 0) > (best.priority ?? 0)) best = e;
  }
  return best;
}

function satisfied(e: NarrativeEvent, s: WorldStats): boolean {
  const v = e.value ?? 0;
  switch (e.trigger) {
    case 'start': return true;
    case 'arrive': return true;
    case 'depth': return s.depthM >= v;
    case 'sold': return s.totalEarned >= v;
    case 'wrecks': return s.wrecksSalvaged >= v;
    case 'contracts': return s.contractsDone >= v;
    case 'cores': return s.cores >= v;
    case 'time': return s.playTime >= v;
    case 'veinlight': return s.veinlightHarvested >= v;
    case 'ruins': return s.sawRuins;
    case 'death': return s.justDied;
    case 'stranded': return s.justStranded;
    case 'order': return s.huskVisited && s.world !== 'site297';
    case 'extract': return s.carryingNow;
    case 'seat': return s.reseatedAny;
    default: return false;
  }
}

// ---------------------------------------------------------------------------
// Phase 4 content: the husk readables and the ending pages. Content, not code.
// ---------------------------------------------------------------------------

export interface HuskReadable { x: number; name: string; lines: string[]; }

/** three stops on SITE 297, walked to on foot, in any order */
export const HUSK_READABLES: HuskReadable[] = [
  {
    x: 19.5, name: 'FUEL DEPOT LEDGER',
    lines: [
      'The depot ledger, final page: fuel out, eighty-four units. Fuel in, eighty-four units. Balanced to the drop.',
      'The last entry stops mid-line. The pen is still in the crease.',
    ],
  },
  {
    x: 36.2, name: 'HAB DOME LOG',
    lines: [
      'A family packed this room in under an hour. Relocation assistance: approved. The stamp is Cindral\'s.',
      'The crayon drawing on the wall is of a sky with a sun in it.',
    ],
  },
  {
    x: 47.5, name: 'SURVEY OFFICE',
    lines: [
      'The contract on the desk is yours. Not like yours — yours. Same advance, same clauses, word for word.',
      'CINDRAL ADVANCE · ✦40 · RECOVERABLE AGAINST EARNINGS.',
      'The signature line is blank, and you catch yourself reaching for it.',
    ],
  },
];

export type EndingKind = 'extract' | 'return' | 'kindle';

export interface EndingPageDef {
  cls: string;
  eyebrow: string;
  title: string;
  lines: string[];
  /** the epilogue panel's short inscription */
  epigraph: string;
}

export const ENDING_PAGES: Record<EndingKind, EndingPageDef> = {
  extract: {
    cls: 'page-dark',
    eyebrow: 'CINDRAL EXTRACTION · ORDER 9-1-1 · FILLED',
    title: 'OUT',
    lines: [
      'Three fragments, delivered. Three worlds, closed. The colonies get another century of light, and the invoices will call it a rescue.',
      'Your debts are cleared. Your lease is bought. You are warm, and paid, and free — everything this job ever dangled and never gave.',
      'The sky over the Dusklight Rig has nothing in it tonight. You are the only one left who knows what used to be there.',
    ],
    epigraph: 'You are out. That was always the deal.',
  },
  return: {
    cls: 'page-dawn',
    eyebrow: 'THE SUNDERING · MADE WHOLE',
    title: 'DAWN',
    lines: [
      'The last fragment settles into its cradle like it never left. The chamber takes a breath. So do you.',
      'Your hold is empty. Your tank is low. Your debts are still yours, every one — and none of that is the thing you will remember.',
      'Twelve centuries of amber, and then — for the first time anyone alive has seen it — the sky over VEIL-3 turns gold.',
    ],
    epigraph: 'The stats below are unchanged. That is the point.',
  },
  kindle: {
    cls: 'page-pure',
    eyebrow: 'THE LAMPLIGHTERS’ INSTRUCTIONS · COMPLETE',
    title: 'KINDLE',
    lines: [
      'Three fragments in one cradle, and the marks on the stones tell you the rest. They reach for each other the way they have wanted to for twelve hundred years.',
      'A star is born small, in the crust of a world, under a rig that came here to dig.',
      'At the trade post, the contract board is empty. Nobody has to take that job anymore.',
    ],
    epigraph: 'The famine is over. So is the need.',
  },
};
