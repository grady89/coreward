// Dispatch comm strip: typewriter transmissions in the corner. Never blocks
// input, never pauses the game, always finishes what it was saying.

const CHAR_MS = 20;
const HOLD_MS = 1500;
const HOLD_PER_CHAR = 10;

export class Comms {
  private el: HTMLElement;
  private textEl: HTMLElement;
  private queue: { t: string; v: string | null }[] = [];
  private line = '';
  private shown = 0;
  private state: 'idle' | 'typing' | 'holding' = 'idle';
  private acc = 0;
  private onBlip: (() => void) | null = null;
  /** per-line VO: play resolves when the clip ends; stop cuts it off */
  private onVoice: ((url: string) => Promise<void>) | null = null;
  private onVoiceStop: (() => void) | null = null;
  private voiceDone = true;
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

  /** wire the dispatcher's recorded voice: play-per-line, and a hard stop */
  setVoice(play: (url: string) => Promise<void>, stop: () => void): void {
    this.onVoice = play;
    this.onVoiceStop = stop;
  }

  /**
   * Queue a transmission; lines play in order. `voices` aligns to `lines` —
   * a url where that line has a processed clip, null where it does not
   * (DISPATCH.md: "per-line files wire straight in").
   */
  say(lines: string[], voices?: (string | null)[]): void {
    for (let i = 0; i < lines.length; i++) this.queue.push({ t: lines[i], v: voices?.[i] ?? null });
  }

  get busy(): boolean { return this.state !== 'idle' || this.queue.length > 0; }

  clear(): void {
    this.queue.length = 0;
    this.state = 'idle';
    this.el.classList.remove('open');
    this.voiceDone = true;
    this.onVoiceStop?.();
  }

  update(dt: number): void {
    if (this.state === 'idle') {
      const next = this.queue.shift();
      if (next === undefined) return;
      this.line = next.t;
      this.shown = this.reducedMotion ? next.t.length : 0;
      this.acc = 0;
      this.state = 'typing';
      this.el.classList.add('open');
      this.textEl.textContent = this.reducedMotion ? next.t : '';
      this.onBlip?.();
      // her voice starts with the line and the line waits for her to finish
      this.voiceDone = true;
      if (next.v && this.onVoice) {
        this.voiceDone = false;
        this.onVoice(next.v).finally(() => { this.voiceDone = true; });
      }
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

    // holding — and a spoken line is never cut off by its own caption
    this.acc += dt * 1000;
    const hold = HOLD_MS + this.line.length * HOLD_PER_CHAR;
    if (this.acc >= hold && this.voiceDone) {
      this.state = 'idle';
      this.acc = 0;
      if (this.queue.length === 0) this.el.classList.remove('open');
    }
  }
}
