// Fully procedural WebAudio: no assets. Thruster noise, drill grind, ore
// chimes tuned by tier, depth-reactive ambient drone, alarms and one-shots.

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  /** a duck stage of its own, downstream of the music bus, so a duck in
   *  flight and the settings panel are never writing the same AudioParam */
  private musicDuck!: GainNode;
  private voiceDispatchBus!: GainNode;
  private voiceLamplightersBus!: GainNode;
  private muted = false;
  private vol = { master: 0.5, sfx: 1, music: 1, voiceDispatch: 1, voiceLamplighters: 1 };

  // recorded VO playback (everything else in this file is synthesized)
  private voiceBufferCache = new Map<string, AudioBuffer>();
  private voiceSeq = 0;
  private activeVoiceSrc: AudioBufferSourceNode | null = null;

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

  /** a context created without a user gesture starts suspended — wake it */
  resume(): void { void this.ctx?.resume(); }

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
    this.musicDuck = ctx.createGain();
    this.musicDuck.gain.value = 1;
    this.musicBus.connect(this.musicDuck).connect(this.master);
    // recorded voices get their own buses so Dispatch and the Lamplighters
    // can be balanced independently of sfx/ambience — and of each other
    this.voiceDispatchBus = ctx.createGain();
    this.voiceDispatchBus.gain.value = this.vol.voiceDispatch;
    this.voiceDispatchBus.connect(this.master);
    this.voiceLamplightersBus = ctx.createGain();
    this.voiceLamplightersBus.gain.value = this.vol.voiceLamplighters;
    this.voiceLamplightersBus.connect(this.master);

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
  setVolumes(master: number, sfx: number, music: number, voiceDispatch: number, voiceLamplighters: number): void {
    this.vol = { master, sfx, music, voiceDispatch, voiceLamplighters };
    if (!this.ctx) return;
    this.master.gain.value = this.muted ? 0 : master;
    this.sfxBus.gain.value = sfx;
    this.musicBus.gain.value = music;
    this.voiceDispatchBus.gain.value = voiceDispatch;
    this.voiceLamplightersBus.gain.value = voiceLamplighters;
  }

  /**
   * Plays one or more pre-rendered VO clips back to back through a speaker's
   * bus — the transcript and codex replay buttons use this. A later call (or
   * stopVoice) cancels whatever is still queued from an earlier one, so
   * mashing play or switching entries never overlaps two lines.
   */
  async playVoice(urls: string[], speaker: 'dispatch' | 'lamplighters'): Promise<void> {
    if (!this.ctx || urls.length === 0) return;
    const bus = speaker === 'dispatch' ? this.voiceDispatchBus : this.voiceLamplightersBus;
    const token = ++this.voiceSeq;
    this.activeVoiceSrc?.stop();
    for (const url of urls) {
      if (token !== this.voiceSeq) return; // superseded by a newer play() or stopVoice()
      let buf = this.voiceBufferCache.get(url);
      if (!buf) {
        const res = await fetch(url);
        if (!res.ok || token !== this.voiceSeq) return;
        buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
        this.voiceBufferCache.set(url, buf);
      }
      if (token !== this.voiceSeq || !this.ctx) return;
      await new Promise<void>(resolve => {
        const src = this.ctx!.createBufferSource();
        src.buffer = buf!;
        src.connect(bus);
        src.onended = () => resolve();
        this.activeVoiceSrc = src;
        src.start();
      });
    }
  }

  /** stops whatever VO line or sequence is currently playing */
  stopVoice(): void {
    this.voiceSeq++;
    this.activeVoiceSrc?.stop();
    this.activeVoiceSrc = null;
  }

  update(dt: number, o: {
    thrust: number; drilling: boolean; hardness: number; row: number;
    lowFuel: boolean; menace?: number;
    /** a husk world: no drone, no music — the first silence in the game */
    dead?: boolean;
  }): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    if (o.dead) {
      this.droneGain.gain.setTargetAtTime(0, t, 1.2);
      this.droneNoiseGain.gain.setTargetAtTime(0, t, 1.2);
      this.swarmGain.gain.setTargetAtTime(0, t, 0.4);
      this.thrustGain.gain.setTargetAtTime(o.thrust * 0.16, t, 0.06);
      return;
    }

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

  private noise(dur: number, peak: number, filterFrom: number, filterTo: number, delayMs = 0): void {
    if (!this.ctx) return;
    const fire = (): void => {
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
    };
    if (delayMs > 0) setTimeout(fire, delayMs); else fire();
  }

  /**
   * Every repeated sound in the vaults is detuned +/-12 % so a hundred
   * gutters do not sound like one sample played a hundred times
   * (SPEC-VAULTS-2 §VI, atmosphere §5).
   */
  private jit(f: number): number { return f * (0.88 + Math.random() * 0.24); }

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

  /** a sconce dies: the same scale, descending, hollowed out */
  sconceOut(i: number): void {
    const scale = [784, 659.3, 587.3, 523.3, 440, 392];
    const f = scale[Math.min(i, scale.length - 1)];
    this.tone(f * 0.5, 1.6, 0.05, 'sine');
    this.tone(f * 0.5 * 0.944, 1.6, 0.03, 'sine', 40); // a flat rub against it
  }

  /**
   * The dash-refresh intake: the breath a sconce takes when it catches. The
   * same gesture ends the gutter phrase, which is why re-forming sounds like
   * being lit rather than like dying (atmosphere §5).
   */
  sconceIntake(delayMs = 0): void {
    this.glide(this.jit(150), this.jit(720), 0.24, 0.055, 'sine', delayMs);
    this.noise(0.2, 0.05, 500, 4200, delayMs);
  }

  /**
   * THE SCONCE CHORD — the five-system moment, audio half: the pentatonic
   * step up, the intake under it, and a fifth above so a lit sconce is the
   * one consonant sound in the room.
   */
  sconceChord(i: number): void {
    this.sconce(i);
    this.sconceIntake(40);
    const scale = [392, 440, 523.3, 587.3, 659.3, 784];
    this.tone(scale[Math.min(i, scale.length - 1)] * 1.5, 1.8, 0.022, 'sine', 180);
  }

  /**
   * THE GUTTER PHRASE — one continuous gesture, never a sting: the flame
   * collapses, a low tone holds under the dark, and the sconce's intake
   * arrives as the body re-forms. There is no failure sound in this game
   * (atmosphere §5).
   */
  gutterPhrase(): void {
    this.noise(0.3, 0.11, 2400, 140);                       // the collapse
    this.glide(this.jit(210), this.jit(88), 0.42, 0.05, 'sine');
    this.tone(this.jit(58), 1.2, 0.05, 'sine', 90);          // the held low
    this.tone(this.jit(87), 1.05, 0.026, 'sine', 130);
    this.sconceIntake(300);                                  // the re-form
  }

  /**
   * The ambience duck. Four moments in the vaults pull the bed down and let
   * one sound own the room: a sconce lit, the master stone touched, first
   * entry to a dark zone, and the gutter-out. Nowhere else (atmosphere §5).
   */
  duckAmbience(toLinear: number, holdSec: number): void {
    if (!this.ctx) return;
    const g = this.musicDuck.gain;
    const t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(toLinear, t + 0.12);
    g.setValueAtTime(toLinear, t + holdSec);
    g.linearRampToValueAtTime(1, t + holdSec + 0.9);
  }

  /** the pod rams through young ice: a crack, a shatter, no drill in it */
  iceCrack(): void {
    this.noise(0.22, 0.16, 5200, 500);
    this.tone(1660, 0.12, 0.07, 'triangle');
    this.tone(2490, 0.08, 0.04, 'triangle', 25);
    this.thump(95, 0.14, 0.1);
  }

  // ---- the fauna: each has a voice, none of them a growl ----

  /** a frequency glide — the building block of every animal call below */
  private glide(from: number, to: number, dur: number, peak: number, type: OscillatorType = 'sine', delayMs = 0): void {
    if (!this.ctx) return;
    setTimeout(() => {
      if (!this.ctx) return;
      const o = this.ctx.createOscillator();
      const t = this.ctx.currentTime;
      o.type = type;
      o.frequency.setValueAtTime(from, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
      o.connect(this.env(dur, peak, 0.02));
      o.start(); o.stop(t + dur + 0.05);
    }, delayMs);
  }

  /** rock parting around something big: a long low tear */
  wormEmerge(v = 1): void {
    this.noise(1.2, 0.3 * v, 500, 60);
    this.glide(90, 38, 1.1, 0.16 * v);
    this.thump(48, 0.9, 0.2 * v);
  }
  /** teeth meet hull */
  wormBite(): void {
    this.noise(0.25, 0.3, 2400, 300);
    this.thump(140, 0.2, 0.2);
    this.tone(880, 0.08, 0.08, 'square', 30);
  }
  /** the brine before a breach: a gut-deep bubbling */
  gurgle(v = 1): void {
    for (let i = 0; i < 7; i++) this.glide(180 + Math.random() * 120, 60, 0.18, 0.06 * v, 'sine', i * 110 + Math.random() * 60);
    this.noise(0.9, 0.08 * v, 700, 200);
  }
  /** a polyp letting go */
  polypBurst(v = 1): void {
    this.noise(0.14, 0.14 * v, 3000, 400);
    this.glide(520, 180, 0.16, 0.08 * v);
  }
  /** your own pulse, when something unlit walks at you */
  heartbeat(dread: number): void {
    const v = 0.06 + dread * 0.08;
    this.thump(60, 0.14, v);
    setTimeout(() => this.thump(52, 0.12, v * 0.8), 130);
  }
  /** the lamp finds it — a single held note, wrong in the mix */
  stillwalkerSeen(): void {
    this.glide(1760, 1740, 2.2, 0.035, 'sine');
    this.glide(1319, 1300, 2.4, 0.03, 'sine', 40);
    this.noise(0.6, 0.03, 2000, 300);
  }
  /** it closes on the hull and the cold gets in */
  stillwalkerGrab(): void {
    this.noise(1.2, 0.2, 400, 40);
    this.glide(220, 30, 1.2, 0.14, 'sawtooth');
    this.tone(2637, 0.3, 0.04, 'sine', 100);
  }
  /** the room takes hold */
  riptidePull(): void {
    this.noise(2.5, 0.12, 300, 900);
    this.glide(40, 70, 2.4, 0.08);
  }
  /** something opens in the wall */
  riptideEye(): void {
    this.glide(60, 240, 0.9, 0.06, 'sine');
    this.tone(1046, 1.2, 0.03, 'sine', 300);
    this.noise(1.0, 0.05, 200, 1800);
  }
  /** a Shellback's legs on stone */
  shellbackChitter(v = 1): void {
    for (let i = 0; i < 6; i++) this.tone(1800 + Math.random() * 900, 0.03, 0.03 * v, 'square', i * 45);
  }
  /** nacre laid: a short wet click and a ring */
  shellbackSeal(v = 1): void {
    this.noise(0.12, 0.08 * v, 1800, 300);
    this.tone(1480, 0.5, 0.04 * v, 'sine', 40);
    this.tone(2220, 0.4, 0.02 * v, 'sine', 60);
  }
  /** a geode that was not a geode */
  mimicHatch(): void {
    this.noise(0.3, 0.16, 2600, 500);
    this.tone(1244, 0.3, 0.06, 'triangle', 60);
    this.tone(932, 0.25, 0.05, 'triangle', 140);
    this.glide(400, 900, 0.25, 0.05, 'square', 200);
  }
  /** six legs, fast, on rock */
  crabSkitter(v = 1): void {
    for (let i = 0; i < 4; i++) this.tone(2400 + Math.random() * 1200, 0.025, 0.03 * v, 'square', i * 55);
  }
  /** a foot of masonry comes down */
  wardenStep(v = 1): void {
    this.thump(64, 0.35, 0.14 * v);
    this.noise(0.18, 0.08 * v, 900, 120);
  }
  /** the lantern comes up to full */
  wardenWake(): void {
    this.glide(220, 880, 0.8, 0.06, 'sine');
    this.tone(1760, 1.4, 0.03, 'sine', 400);
    this.noise(0.8, 0.06, 1500, 4000);
  }
  /** the beam on your hull: a lamp that hurts */
  wardenFlash(): void {
    this.noise(0.3, 0.14, 6000, 2000);
    this.tone(3520, 0.25, 0.05, 'sine');
    this.thump(120, 0.15, 0.1);
  }
  /** the lantern goes out */
  wardenBlind(): void {
    this.glide(880, 110, 0.7, 0.08, 'sine');
    this.noise(0.5, 0.08, 3000, 200);
    this.thump(70, 0.4, 0.1);
  }
  /** four figures turning */
  kindledNotice(): void {
    this.tone(523, 2.4, 0.03, 'sine');
    this.tone(659, 2.4, 0.025, 'sine', 120);
    this.tone(784, 2.6, 0.02, 'sine', 260);
  }
  /** touch: everything, at once, silently — then the air goes */
  kindledTouch(): void {
    this.noise(1.6, 0.24, 8000, 100);
    this.tone(4186, 1.2, 0.05, 'sine');
    this.glide(200, 30, 1.6, 0.1);
  }

  /** the Lumen Lance: light spent as ammunition — a struck bell, not a gun */
  lance(): void {
    this.tone(1318.5, 0.5, 0.1, 'sine');
    this.tone(1975.5, 0.4, 0.05, 'sine', 30);
    this.noise(0.5, 0.12, 6000, 1400);
    this.thump(160, 0.2, 0.08);
  }

  /** extraction: the Communion's chord, inverted — resolve slides to minor */
  extractChord(): void {
    this.thump(46, 1.6, 0.16);
    [220, 261.6, 311.1, 415.3].forEach((f, i) =>
      this.tone(f, 3.4, 0.045, 'sine', 200 + i * 180));
    this.noise(2.4, 0.07, 2400, 120); // the bloom, falling instead of rising
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
