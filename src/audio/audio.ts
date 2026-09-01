// Fully procedural WebAudio: no assets. Thruster noise, drill grind, ore
// chimes tuned by tier, depth-reactive ambient drone, alarms and one-shots.

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private muted = false;
  private vol = { master: 0.5, sfx: 1, music: 1 };

  // continuous voices
  private thrustGain!: GainNode;
  private thrustFilter!: BiquadFilterNode;
  private drillGain!: GainNode;
  private drillOsc!: OscillatorNode;
  private droneGain!: GainNode;
  private droneOsc1!: OscillatorNode;
  private droneOsc2!: OscillatorNode;
  private droneNoiseGain!: GainNode;
  private swarmGain!: GainNode;
  private swarmFilter!: BiquadFilterNode;
  private noiseBuf!: AudioBuffer;
  private heartbeatT = 0;

  get ready(): boolean { return this.ctx !== null; }

  init(): void {
    if (this.ctx) return;
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.vol.master;
    this.master.connect(ctx.destination);
    // two buses so the settings panel can balance effects against ambience
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.vol.sfx;
    this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.vol.music;
    this.musicBus.connect(this.master);

    // shared noise buffer
    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    // thruster: looped noise -> bandpass -> gain
    const tn = ctx.createBufferSource();
    tn.buffer = this.noiseBuf; tn.loop = true;
    this.thrustFilter = ctx.createBiquadFilter();
    this.thrustFilter.type = 'bandpass';
    this.thrustFilter.frequency.value = 420;
    this.thrustFilter.Q.value = 0.8;
    this.thrustGain = ctx.createGain();
    this.thrustGain.gain.value = 0;
    tn.connect(this.thrustFilter).connect(this.thrustGain).connect(this.sfxBus);
    tn.start();

    // drill: sawtooth + noise grind
    this.drillOsc = ctx.createOscillator();
    this.drillOsc.type = 'sawtooth';
    this.drillOsc.frequency.value = 65;
    const dn = ctx.createBufferSource();
    dn.buffer = this.noiseBuf; dn.loop = true;
    const dnf = ctx.createBiquadFilter();
    dnf.type = 'lowpass'; dnf.frequency.value = 900;
    this.drillGain = ctx.createGain();
    this.drillGain.gain.value = 0;
    this.drillOsc.connect(this.drillGain);
    dn.connect(dnf).connect(this.drillGain);
    this.drillGain.connect(this.sfxBus);
    this.drillOsc.start(); dn.start();

    // swarm shimmer bed: bandpassed noise, silent until something is hunting
    const sw = ctx.createBufferSource();
    sw.buffer = this.noiseBuf; sw.loop = true;
    this.swarmFilter = ctx.createBiquadFilter();
    this.swarmFilter.type = 'bandpass';
    this.swarmFilter.frequency.value = 2200;
    this.swarmFilter.Q.value = 1.6;
    this.swarmGain = ctx.createGain();
    this.swarmGain.gain.value = 0;
    sw.connect(this.swarmFilter).connect(this.swarmGain).connect(this.sfxBus);
    sw.start();

    // ambient drone: two detuned sines + filtered noise bed
    this.droneOsc1 = ctx.createOscillator();
    this.droneOsc1.type = 'sine'; this.droneOsc1.frequency.value = 55;
    this.droneOsc2 = ctx.createOscillator();
    this.droneOsc2.type = 'sine'; this.droneOsc2.frequency.value = 82.6;
    const o2g = ctx.createGain(); o2g.gain.value = 0.4;
    this.droneOsc2.connect(o2g);
    const nb = ctx.createBufferSource();
    nb.buffer = this.noiseBuf; nb.loop = true;
    const nf = ctx.createBiquadFilter();
    nf.type = 'lowpass'; nf.frequency.value = 180;
    this.droneNoiseGain = ctx.createGain(); this.droneNoiseGain.gain.value = 0;
    nb.connect(nf).connect(this.droneNoiseGain);
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0.035;
    this.droneOsc1.connect(this.droneGain);
    o2g.connect(this.droneGain);
    this.droneNoiseGain.connect(this.droneGain);
    this.droneGain.connect(this.musicBus);
    this.droneOsc1.start(); this.droneOsc2.start(); nb.start();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.ctx) this.master.gain.value = this.muted ? 0 : this.vol.master;
    return this.muted;
  }

  /** live-apply volume settings (0..1 each) */
  setVolumes(master: number, sfx: number, music: number): void {
    this.vol = { master, sfx, music };
    if (!this.ctx) return;
    this.master.gain.value = this.muted ? 0 : master;
    this.sfxBus.gain.value = sfx;
    this.musicBus.gain.value = music;
  }

  update(dt: number, o: {
    thrust: number; drilling: boolean; hardness: number; row: number;
    lowFuel: boolean; menace?: number;
  }): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    // swarm wing-shimmer: a high band that rises as they close
    const men = o.menace ?? 0;
    this.swarmGain.gain.setTargetAtTime(men * 0.05, t, 0.15);
    this.swarmFilter.frequency.setTargetAtTime(1800 + men * 2600, t, 0.2);

    // thruster
    const tg = o.thrust * 0.16;
    this.thrustGain.gain.setTargetAtTime(tg, t, 0.06);
    this.thrustFilter.frequency.setTargetAtTime(380 + o.thrust * 300, t, 0.1);

    // drill grind pitched by hardness
    const dg = o.drilling ? 0.075 : 0;
    this.drillGain.gain.setTargetAtTime(dg, t, 0.05);
    if (o.drilling) {
      this.drillOsc.frequency.setTargetAtTime(50 + 40 / Math.max(0.3, o.hardness), t, 0.08);
    }

    // drone follows depth: lower + noisier in the veins, shimmer near the core
    const row = Math.max(0, o.row);
    const base = Math.max(34, 55 - row * 0.045);
    this.droneOsc1.frequency.setTargetAtTime(base, t, 0.8);
    const nearCore = Math.min(1, Math.max(0, (row - 420) / 80));
    // minor-ish interval that resolves toward a major third as light returns
    this.droneOsc2.frequency.setTargetAtTime(base * (1.5 - nearCore * 0.25), t, 0.8);
    this.droneNoiseGain.gain.setTargetAtTime(Math.min(0.5, row / 300 * 0.5) * (1 - nearCore * 0.6), t, 1);
    this.droneGain.gain.setTargetAtTime(0.03 + nearCore * 0.025, t, 1);

    // low-fuel heartbeat
    if (o.lowFuel) {
      this.heartbeatT -= dt;
      if (this.heartbeatT <= 0) {
        this.heartbeatT = 0.9;
        this.thump(72, 0.12, 0.09);
        setTimeout(() => this.thump(64, 0.1, 0.07), 140);
      }
    }
  }

  // ---- one-shots ----
  private env(dur: number, peak: number, attack = 0.005): GainNode {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(this.sfxBus);
    setTimeout(() => g.disconnect(), dur * 1000 + 120);
    return g;
  }

  private tone(freq: number, dur: number, peak: number, type: OscillatorType = 'triangle', delayMs = 0): void {
    if (!this.ctx) return;
    setTimeout(() => {
      if (!this.ctx) return;
      const o = this.ctx.createOscillator();
      o.type = type; o.frequency.value = freq;
      o.connect(this.env(dur, peak));
      o.start(); o.stop(this.ctx.currentTime + dur + 0.05);
    }, delayMs);
  }

  private thump(freq: number, dur: number, peak: number): void {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    const t = this.ctx.currentTime;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.6, t + dur);
    o.connect(this.env(dur, peak));
    o.start(); o.stop(t + dur + 0.05);
  }

  private noise(dur: number, peak: number, filterFrom: number, filterTo: number): void {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    const t = this.ctx.currentTime;
    f.frequency.setValueAtTime(filterFrom, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, filterTo), t + dur);
    src.connect(f).connect(this.env(dur, peak));
    src.start(); src.stop(t + dur + 0.05);
  }

  /** glassy pickup chime — deeper ore = lower, richer note */
  chime(tier: number): void {
    const freqs = [740, 660, 587, 523, 466, 415, 370, 330];
    const f = freqs[Math.min(tier, freqs.length - 1)];
    this.tone(f, 0.5, 0.14);
    this.tone(f * 2.01, 0.35, 0.05);
    if (tier >= 5) this.tone(f * 1.5, 0.6, 0.06, 'sine', 60);
  }

  cargoFull(): void { this.tone(220, 0.18, 0.1, 'square'); this.tone(196, 0.22, 0.1, 'square', 130); }

  /** a carved stone comes free — old, tonal, not a coin sound */
  glyph(): void {
    this.tone(294, 1.5, 0.07, 'sine');
    this.tone(440, 1.6, 0.05, 'sine', 90);
    this.tone(587, 1.8, 0.035, 'sine', 200);
  }

  /** an arrestor absorbs a fall: a pneumatic catch, not an impact */
  arrested(): void {
    this.noise(0.34, 0.13, 900, 120);
    this.tone(196, 0.2, 0.09, 'sine');
    this.tone(392, 0.32, 0.05, 'sine', 80);
  }

  flare(): void { this.noise(0.5, 0.09, 5000, 700); this.tone(520, 0.25, 0.05, 'triangle'); }
  chargePlaced(): void { this.tone(880, 0.06, 0.06, 'square'); this.tone(660, 0.08, 0.05, 'square', 90); }

  /** the deep rumble of something large moving through your tunnels */
  rumbleTick(): void { this.thump(42, 0.5, 0.1); }

  /** a swarm has noticed you */
  swarmAlert(): void {
    this.tone(1400, 0.1, 0.05, 'sawtooth');
    this.tone(1180, 0.16, 0.045, 'sawtooth', 70);
    this.noise(0.3, 0.05, 4000, 1200);
  }

  /** radio blip opening a dispatch line */
  radio(): void {
    this.tone(1180, 0.05, 0.04, 'square');
    this.tone(880, 0.06, 0.035, 'square', 55);
    this.noise(0.14, 0.025, 2600, 900);
  }

  /** veinlight harvest — a soft rising breath, not a coin chime */
  veinlight(): void {
    this.tone(392, 0.45, 0.09, 'sine');
    this.tone(587, 0.5, 0.06, 'sine', 70);
    this.tone(784, 0.55, 0.04, 'sine', 150);
  }

  sell(steps: number): void {
    const n = Math.min(8, Math.max(3, steps));
    for (let i = 0; i < n; i++) this.tone(520 + i * 70, 0.12, 0.07, 'triangle', i * 70);
    this.tone(880, 0.5, 0.12, 'triangle', n * 70 + 60);
    this.tone(1108, 0.5, 0.08, 'triangle', n * 70 + 60);
  }

  buy(): void { this.tone(660, 0.14, 0.09); this.tone(880, 0.2, 0.09, 'triangle', 90); }
  denied(): void { this.tone(180, 0.2, 0.1, 'square'); }
  click(): void { this.tone(1250, 0.04, 0.05, 'sine'); }
  toast(): void { this.tone(523, 0.3, 0.06); this.tone(784, 0.4, 0.05, 'sine', 80); }

  damage(): void { this.noise(0.18, 0.16, 1600, 200); this.thump(110, 0.14, 0.12); }
  explosion(): void { this.noise(0.9, 0.4, 900, 50); this.thump(55, 0.7, 0.3); }
  landing(impact: number): void {
    const v = Math.min(0.2, impact * 0.012);
    this.thump(78, 0.12, v);
    this.noise(0.1, v * 0.6, 800, 150);
  }

  dash(): void { this.noise(0.22, 0.14, 2400, 300); this.tone(340, 0.16, 0.07, 'sine'); }

  warp(): void {
    [660, 880, 1108, 1318].forEach((f, i) => this.tone(f, 0.3, 0.06, 'triangle', i * 55));
    this.noise(0.4, 0.06, 3000, 600);
  }

  airlock(): void { this.noise(0.5, 0.1, 1200, 200); this.tone(196, 0.3, 0.05, 'sine', 120); }

  salvage(): void {
    [0, 120, 240].forEach(d => this.tone(140, 0.07, 0.08, 'square', d));
    this.tone(523, 0.5, 0.1, 'triangle', 420);
    this.tone(784, 0.5, 0.07, 'triangle', 500);
  }

  stratum(): void {
    this.tone(220, 1.4, 0.05, 'sine');
    this.tone(330, 1.4, 0.04, 'sine', 120);
    this.tone(440, 1.6, 0.03, 'sine', 260);
  }

  ending(): void {
    const notes = [262, 330, 392, 523, 660, 784];
    notes.forEach((f, i) => this.tone(f, 2.2, 0.07, 'sine', i * 220));
  }

  // ---- the Communion: the core-walk crescendo ----
  private choir: { chord: GainNode; shimmer: GainNode } | null = null;

  /** lazily build the sustained choir: a low chord + a high shimmer */
  private ensureChoir(): void {
    if (!this.ctx || this.choir) return;
    const ctx = this.ctx;
    const chord = ctx.createGain();
    chord.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    chord.connect(lp).connect(this.musicBus);
    [110, 164.8, 220, 277.2].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      // slow detune drift so the chord breathes like voices, not a synth
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.11 + i * 0.05;
      const lfoG = ctx.createGain();
      lfoG.gain.value = f * 0.0035;
      lfo.connect(lfoG).connect(o.frequency);
      const g = ctx.createGain();
      g.gain.value = [1, 0.7, 0.55, 0.35][i];
      o.connect(g).connect(chord);
      o.start(); lfo.start();
    });
    const shimmer = ctx.createGain();
    shimmer.gain.value = 0;
    shimmer.connect(this.musicBus);
    [659.3, 880, 1108.7].forEach(f => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 0.3;
      o.connect(g).connect(shimmer);
      o.start();
    });
    this.choir = { chord, shimmer };
  }

  /** distance-driven choir level, 0..1 — call every frame during the walk */
  finaleBed(level: number): void {
    if (!this.ctx) return;
    this.ensureChoir();
    const t = this.ctx.currentTime;
    this.choir!.chord.gain.setTargetAtTime(level * 0.055, t, 0.6);
    this.choir!.shimmer.gain.setTargetAtTime(level * level * 0.02, t, 0.9);
  }

  /** the fragment's heartbeat — strength rises as the pilot closes */
  emberBeat(strength: number): void {
    this.thump(52 + strength * 12, 0.5, 0.05 + strength * 0.09);
    this.tone(104, 0.35, 0.02 + strength * 0.03, 'sine', 70);
  }

  /** a sconce ignites: the walk climbs a pentatonic scale, light by light */
  sconce(i: number): void {
    const scale = [392, 440, 523.3, 587.3, 659.3, 784];
    const f = scale[Math.min(i, scale.length - 1)];
    this.tone(f, 1.4, 0.055, 'sine');
    this.tone(f * 2, 1.1, 0.025, 'sine', 70);
  }

  /** contact: a sub drop, a rising bloom, then a wide slow chord */
  finaleTouch(): void {
    this.finaleBed(0);
    this.thump(40, 1.4, 0.22);
    this.noise(2.2, 0.1, 500, 5200);
    [220, 329.6, 440, 554.4, 659.3].forEach((f, i) =>
      this.tone(f, 3.2, 0.05, 'sine', 250 + i * 140));
  }
}
