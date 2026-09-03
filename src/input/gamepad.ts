// The second pair of hands.
//
// One poll a frame turns a standard pad into the same four booleans the
// keyboard already produces, plus edges (pressed this frame) and repeats
// (held down, for menus). The game never asks which device is talking — it
// asks the same questions of both. Only the button prompts care, and they
// read `active`: whichever device spoke last owns the glyphs.

export type Btn =
  | 'a' | 'b' | 'x' | 'y'
  | 'lb' | 'rb' | 'lt' | 'rt'
  | 'back' | 'start' | 'l3' | 'r3'
  | 'up' | 'down' | 'left' | 'right';

/** the W3C "standard" mapping — every pad worth supporting reports it */
const INDEX: Record<Btn, number> = {
  a: 0, b: 1, x: 2, y: 3,
  lb: 4, rb: 5, lt: 6, rt: 7,
  back: 8, start: 9, l3: 10, r3: 11,
  up: 12, down: 13, left: 14, right: 15,
};
const ALL = Object.keys(INDEX) as Btn[];

/** the stick has to mean it before it counts as a direction */
const DEAD = 0.42;
/** analog triggers report a value; half-pull is a press */
const TRIGGER = 0.5;
const REPEAT_DELAY = 0.38;
const REPEAT_RATE = 0.11;

export interface PadDir { left: boolean; right: boolean; up: boolean; down: boolean; }

export class Pad {
  /** a pad is plugged in and has reported at least one frame */
  connected = false;
  /** a pad supplied the most recent input — button prompts follow this */
  active = false;
  /** sticks, deadzoned, for anything that wants a real axis */
  ax = 0;
  ay = 0;
  rx = 0;
  ry = 0;
  rumbleOn = true;

  private idx: number | null = null;
  private now: boolean[] = new Array(16).fill(false);
  private prev: boolean[] = new Array(16).fill(false);
  private held: number[] = new Array(16).fill(0);
  private rep: boolean[] = new Array(16).fill(false);
  private wasConnected = false;

  /** fired the frame a pad appears or vanishes, for a toast */
  onConnect: ((connected: boolean) => void) | null = null;

  down(b: Btn): boolean { return this.now[INDEX[b]]; }
  pressed(b: Btn): boolean { const i = INDEX[b]; return this.now[i] && !this.prev[i]; }
  released(b: Btn): boolean { const i = INDEX[b]; return !this.now[i] && this.prev[i]; }
  /** press, then again on a menu-friendly repeat while held */
  repeated(b: Btn): boolean { return this.pressed(b) || this.rep[INDEX[b]]; }

  /** stick and d-pad merged — the movement half of the pad */
  get dir(): PadDir {
    return {
      left: this.now[INDEX.left],
      right: this.now[INDEX.right],
      up: this.now[INDEX.up],
      down: this.now[INDEX.down],
    };
  }

  poll(dt: number): void {
    const gp = this.read();
    this.prev = this.now;
    this.now = new Array(16).fill(false);
    this.rep = new Array(16).fill(false);

    if (gp) {
      for (const b of ALL) {
        const i = INDEX[b];
        const btn = gp.buttons[i];
        if (!btn) continue;
        this.now[i] = b === 'lt' || b === 'rt' ? btn.value > TRIGGER || btn.pressed : btn.pressed;
      }
      // the stick answers the d-pad's questions too, so menus and drilling
      // both work without the player thinking about which one they grabbed
      const x = gp.axes[0] ?? 0;
      const y = gp.axes[1] ?? 0;
      const rx = gp.axes[2] ?? 0;
      const ry = gp.axes[3] ?? 0;
      this.ax = Math.abs(x) > DEAD ? x : 0;
      this.ay = Math.abs(y) > DEAD ? y : 0;
      this.rx = Math.abs(rx) > DEAD ? rx : 0;
      this.ry = Math.abs(ry) > DEAD ? ry : 0;
      if (x < -DEAD) this.now[INDEX.left] = true;
      if (x > DEAD) this.now[INDEX.right] = true;
      if (y < -DEAD) this.now[INDEX.up] = true;
      if (y > DEAD) this.now[INDEX.down] = true;
    } else {
      this.ax = 0;
      this.ay = 0;
      this.rx = 0;
      this.ry = 0;
    }

    for (let i = 0; i < 16; i++) {
      if (!this.now[i]) { this.held[i] = 0; continue; }
      if (!this.prev[i]) this.active = true;
      const before = this.held[i];
      this.held[i] += dt;
      if (before === 0) continue;
      if (before < REPEAT_DELAY) {
        if (this.held[i] >= REPEAT_DELAY) this.rep[i] = true;
      } else if (Math.floor((before - REPEAT_DELAY) / REPEAT_RATE) !==
                 Math.floor((this.held[i] - REPEAT_DELAY) / REPEAT_RATE)) {
        this.rep[i] = true;
      }
    }
    if (this.ax !== 0 || this.ay !== 0) this.active = true;

    this.connected = gp !== null;
    if (this.connected !== this.wasConnected) {
      this.wasConnected = this.connected;
      if (!this.connected) this.active = false;
      this.onConnect?.(this.connected);
    }
  }

  /** the keyboard spoke — hand the button prompts back */
  yield(): void { this.active = false; }

  /** drop every held button (window blur, mode changes that swallow input) */
  clear(): void {
    this.now = new Array(16).fill(false);
    this.prev = new Array(16).fill(false);
    this.held = new Array(16).fill(0);
    this.rep = new Array(16).fill(false);
  }

  /**
   * Impacts you can feel. Silently absent on pads and browsers without an
   * actuator, which is most of them — never gate anything on it working.
   */
  rumble(strong: number, weak: number, ms: number): void {
    if (!this.rumbleOn || !this.connected) return;
    const act = (this.raw() as { vibrationActuator?: {
      playEffect(t: string, o: object): Promise<unknown>;
    } } | null)?.vibrationActuator;
    act?.playEffect('dual-rumble', {
      duration: ms, strongMagnitude: strong, weakMagnitude: weak,
    }).catch(() => { /* pad can't buzz; nothing is lost */ });
  }

  private raw(): Gamepad | null {
    if (this.idx === null) return null;
    return navigator.getGamepads?.()[this.idx] ?? null;
  }

  /** the pad that last had a button down wins, and keeps winning while held */
  private read(): Gamepad | null {
    const pads = navigator.getGamepads?.() ?? [];
    const held = this.idx !== null ? pads[this.idx] : null;
    if (held?.connected) return held;
    for (const p of pads) {
      if (p?.connected && p.mapping === 'standard') { this.idx = p.index; return p; }
    }
    for (const p of pads) {
      if (p?.connected) { this.idx = p.index; return p; }
    }
    this.idx = null;
    return null;
  }
}
