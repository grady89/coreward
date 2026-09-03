// Button prompts, rewritten for whichever hands are on the game.
//
// Every prompt in the game is written for the keyboard — `<span class="key">E
// </span>DOCK`. Rather than teach twenty call sites about controllers, the
// rewrite happens once, at the moment a prompt reaches the DOM. Anything the
// map doesn't recognise (direction arrows, say) passes through untouched.

/** flipped by the game each frame: true while the pad is the live device */
export const PROMPTS = { pad: false };

const PAD: Record<string, string> = {
  'E': 'X',
  'HOLD E': 'HOLD X',
  'R': 'B',
  'F': 'Y',
  'Q': 'LT+X',
  'X': 'RB',
  'C': 'L3',
  'G': 'LT+A',
  'B': 'LT+B',
  'L': 'LT+Y',
  'N': 'LT+RB',
  'TAB': 'VIEW',
  'ESC': 'MENU',
  'M': 'R3',
  'SHIFT': 'LB',
  '←→↑↓': 'L-STICK',
  '←→': 'L-STICK',
};

const KEY_SPAN = /<span class="key">([^<]*)<\/span>/g;

/** rewrite the key glyphs in a prompt fragment for the live input device */
export function glyphs(html: string): string {
  if (!PROMPTS.pad) return html;
  return html.replace(KEY_SPAN, (whole, label: string) => {
    const g = PAD[label.trim().toUpperCase()];
    return g ? `<span class="key pad">${g}</span>` : whole;
  });
}

/** the same swap for a bare label (the lamp pip, the kit strip) */
export function glyph(label: string): string {
  return PROMPTS.pad ? PAD[label.toUpperCase()] ?? label : label;
}
