// Dispatch comm strip: typewriter transmissions in the corner. Never blocks
// input, never pauses the game, always finishes what it was saying.

const CHAR_MS = 20;
const HOLD_MS = 1500;
const HOLD_PER_CHAR = 10;

export class Comms {
  private el: HTMLElement;
  private textEl: HTMLElement;
  private queue: string[] = [];
  private line = '';
  private shown = 0;
  private state: 'idle' | 'typing' | 'holding' = 'idle';
  private acc = 0;
  private onBlip: (() => void) | null = null;
  reducedMotion = false;

  constructor(ui: HTMLElement) {
    this.el = document.createElement('div');
    this.el.id = 'comms';
    this.el.innerHTML = `
      <div class="comms-head"><span class="comms-dot"></span>DISPATCH</div>
      <div class="comms-text"></div>
    `;
    ui.appendChild(this.el);
    this.textEl = this.el.querySelector('.comms-text') as HTMLElement;
  }

  setBlip(fn: () => void): void { this.onBlip = fn; }

  /** queue a transmission; lines play in order */
  say(lines: string[]): void {
    for (const l of lines) this.queue.push(l);
  }

  get busy(): boolean { return this.state !== 'idle' || this.queue.length > 0; }

  clear(): void {
    this.queue.length = 0;
    this.state = 'idle';
    this.el.classList.remove('open');
  }

  update(dt: number): void {
    if (this.state === 'idle') {
      const next = this.queue.shift();
      if (next === undefined) return;
      this.line = next;
      this.shown = this.reducedMotion ? next.length : 0;
      this.acc = 0;
      this.state = 'typing';
      this.el.classList.add('open');
      this.textEl.textContent = this.reducedMotion ? next : '';
      this.onBlip?.();
      if (this.reducedMotion) this.state = 'holding';
      return;
    }

    if (this.state === 'typing') {
      this.acc += dt * 1000;
      const want = Math.min(this.line.length, Math.floor(this.acc / CHAR_MS));
      if (want !== this.shown) {
        this.shown = want;
        this.textEl.textContent = this.line.slice(0, want);
      }
      if (this.shown >= this.line.length) {
        this.state = 'holding';
        this.acc = 0;
      }
      return;
    }

    // holding
    this.acc += dt * 1000;
    const hold = HOLD_MS + this.line.length * HOLD_PER_CHAR;
    if (this.acc >= hold) {
      this.state = 'idle';
      this.acc = 0;
      if (this.queue.length === 0) this.el.classList.remove('open');
    }
  }
}
