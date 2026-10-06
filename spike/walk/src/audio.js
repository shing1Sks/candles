// Sound. Recorded/designed files in assets/audio are used when present (served at /audio/...);
// everything also has a synthesised fallback, so the prototype always has sound.
//   beds:  wind + music_calm, crossfading into music_dread as the entity gets close
//   sfx:   steps, chirps, petal pickup/drop, bloom, dissolve, flip, lunge, caught, mist

const FILES = [
  'music_calm', 'music_dread', 'amb_wind_paper', 'amb_leaves_rustle', 'amb_mist',
  'sfx_step_paper_1', 'sfx_step_paper_2', 'sfx_step_paper_3', 'sfx_step_paper_4',
  'sfx_petal_pickup', 'sfx_petal_drop', 'sfx_field_bloom', 'sfx_field_dissolve',
  'sfx_entity_flip', 'sfx_entity_lunge_1', 'sfx_entity_lunge_2', 'sfx_entity_lunge_3',
  'sfx_entity_near', 'sfx_staple_click', 'sfx_bird_chirp_1', 'sfx_bird_chirp_2', 'sfx_bird_chirp_3', 'sfx_caught',
];

export class Sound {
  constructor() {
    this.ctx = null;
    this.buf = {};
  }

  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const ac = (this.ctx = new AudioContext());
    this.master = ac.createGain(); this.master.gain.value = 0.9; this.master.connect(ac.destination);

    const noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = noiseBuf;

    // synthesised beds (quieted if the designed files load)
    const wind = ac.createBufferSource(); wind.buffer = noiseBuf; wind.loop = true;
    this.windF = ac.createBiquadFilter(); this.windF.type = 'bandpass'; this.windF.frequency.value = 420; this.windF.Q.value = 0.7;
    this.windG = ac.createGain(); this.windG.gain.value = 0.05;
    wind.connect(this.windF).connect(this.windG).connect(this.master); wind.start();

    this.droneG = ac.createGain(); this.droneG.gain.value = 0;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
    for (const [f, type] of [[49, 'sawtooth'], [49.6, 'sawtooth'], [73.4, 'triangle']]) {
      const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.connect(lp); o.start();
    }
    lp.connect(this.droneG).connect(this.master);

    this.chordG = ac.createGain(); this.chordG.gain.value = 0;
    for (const f of [392, 493.9, 587.3, 740]) {
      const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const lfo = ac.createOscillator(); lfo.frequency.value = 0.2 + Math.random() * 0.3;
      const lg = ac.createGain(); lg.gain.value = 2; lfo.connect(lg).connect(o.frequency);
      const g = ac.createGain(); g.gain.value = 0.05;
      o.connect(g).connect(this.chordG); o.start(); lfo.start();
    }
    this.chordG.connect(this.master);
    this.birdT = 2;
    this.synthBeds = 1;
    this.load();
  }

  async load() {
    await Promise.all(FILES.map(async (name) => {
      for (const ext of ['ogg', 'wav']) {
        try {
          const res = await fetch(`/audio/${name}.${ext}`);
          if (!res.ok || !(res.headers.get('content-type') || '').startsWith('audio')) continue;
          this.buf[name] = await this.ctx.decodeAudioData(await res.arrayBuffer());
          return;
        } catch { /* fall back to synthesis */ }
      }
    }));
    const loop = (name, gain) => {
      if (!this.buf[name]) return null;
      const src = this.ctx.createBufferSource(); src.buffer = this.buf[name]; src.loop = true;
      const g = this.ctx.createGain(); g.gain.value = gain;
      src.connect(g).connect(this.master); src.start();
      return g;
    };
    this.calmG = loop('music_calm', 0.5);
    this.dreadG = loop('music_dread', 0);
    this.ambWindG = loop('amb_wind_paper', 0.35);
    this.ambLeafG = loop('amb_leaves_rustle', 0.2);
    this.ambMistG = loop('amb_mist', 0);
    this.nearG = loop('sfx_entity_near', 0); // pin rattle when it is very close
    if (this.ambWindG) this.windG.gain.value = 0;
    if (this.calmG) this.synthBeds = 0.35;
  }

  // play a designed sample (random variant if numbered) or return false
  sample(name, gain = 1, pan = 0) {
    if (!this.ctx) return true;
    const variants = this.buf[name] ? [this.buf[name]] : [1, 2, 3, 4].map((i) => this.buf[`${name}_${i}`]).filter(Boolean);
    if (!variants.length) return false;
    const src = this.ctx.createBufferSource();
    src.buffer = variants[Math.floor(Math.random() * variants.length)];
    src.playbackRate.value = 0.94 + Math.random() * 0.12;
    const g = this.ctx.createGain(); g.gain.value = gain;
    const p = this.ctx.createStereoPanner(); p.pan.value = pan;
    src.connect(g).connect(p).connect(this.master);
    src.start();
    return true;
  }

  noise(t, dur, f0, f1, q, gain, attack = 0.01) {
    const ac = this.ctx, src = ac.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }

  tone(t, f0, f1, dur, gain, type = 'sine') {
    const ac = this.ctx, o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }

  // ---- one-shots ----
  play(kind) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    switch (kind) {
      case 'step': if (!this.sample('sfx_step_paper', 0.6)) this.noise(t, 0.13, 900 + Math.random() * 900, 700, 1.2, 0.09); break;
      case 'pickup': if (!this.sample('sfx_petal_pickup', 0.7)) { this.tone(t, 1568, 1568, 0.5, 0.05); this.tone(t + 0.07, 2093, 2093, 0.6, 0.04); this.noise(t, 0.08, 3000, 2000, 2, 0.04); } break;
      case 'drop': if (!this.sample('sfx_petal_drop', 0.7)) { this.tone(t, 880, 440, 0.8, 0.05); this.noise(t, 0.5, 2000, 600, 1, 0.04, 0.05); } break;
      case 'bloom': if (!this.sample('sfx_field_bloom', 0.8)) { [523, 659, 784, 988].forEach((f, i) => this.tone(t + i * 0.08, f, f, 2.5, 0.04)); this.noise(t, 0.2, 1500, 3000, 1, 0.06); } break;
      case 'dissolve': if (!this.sample('sfx_field_dissolve', 0.8)) { this.noise(t, 2.5, 3000, 300, 0.8, 0.06, 0.4); [988, 784, 659].forEach((f, i) => this.tone(t + i * 0.3, f, f * 0.94, 1.6, 0.03)); } break;
      case 'flip': if (!this.sample('sfx_entity_flip', 0.9)) { this.noise(t, 0.35, 400, 2400, 1.5, 0.15, 0.02); this.noise(t + 0.18, 0.3, 2400, 300, 1.5, 0.12); } break;
      case 'lunge': if (!this.sample('sfx_entity_lunge', 0.8)) { this.noise(t, 0.22, 2500, 500, 0.9, 0.16, 0.005); this.tone(t, 3200, 2600, 0.06, 0.03, 'square'); this.tone(t + 0.04, 2900, 2400, 0.05, 0.025, 'square'); } break;
      case 'caught': if (!this.sample('sfx_caught', 1)) { for (let i = 0; i < 9; i++) this.noise(t + i * 0.13, 0.25, 600 + Math.random() * 2500, 300, 0.8, 0.14); } break;
      case 'staple': if (!this.sample('sfx_staple_click', 0.6)) this.tone(t, 2600, 1800, 0.04, 0.05, 'square'); break;
      case 'mist': this.noise(t, 4, 300, 900, 0.6, 0.05, 1.5); break;
      case 'chirp': if (!this.sample('sfx_bird_chirp', 0.35, Math.random() * 2 - 1)) this.chirp(); break;
    }
  }

  chirp() {
    const ac = this.ctx, t = ac.currentTime;
    const pan = ac.createStereoPanner(); pan.pan.value = Math.random() * 2 - 1; pan.connect(this.master);
    const notes = 2 + Math.floor(Math.random() * 4), base = 2400 + Math.random() * 1600;
    for (let i = 0; i < notes; i++) {
      const o = ac.createOscillator(), g = ac.createGain(), s = t + i * (0.09 + Math.random() * 0.05);
      o.frequency.setValueAtTime(base * (1 + Math.random() * 0.2), s);
      o.frequency.exponentialRampToValueAtTime(base * (0.7 + Math.random() * 0.6), s + 0.07);
      g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.025, s + 0.01); g.gain.exponentialRampToValueAtTime(0.001, s + 0.08);
      o.connect(g).connect(pan); o.start(s); o.stop(s + 0.1);
    }
  }

  update(dt, { wind, dread, colour, mist }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, sb = this.synthBeds;
    this.windF.frequency.setTargetAtTime(300 + wind * 400 + mist * 200, t, 0.5);
    if (!this.ambWindG) this.windG.gain.setTargetAtTime(0.035 + wind * 0.05 + mist * 0.03, t, 0.5);
    this.droneG.gain.setTargetAtTime(dread * 0.22 * (this.dreadG ? 0.4 : 1), t, 0.6);
    this.chordG.gain.setTargetAtTime(colour * 0.5 * sb, t, 0.8);
    if (this.calmG) this.calmG.gain.setTargetAtTime(0.5 * (1 - dread) * (1 - colour * 0.5), t, 1.2);
    if (this.dreadG) this.dreadG.gain.setTargetAtTime(0.55 * dread, t, 1.0);
    if (this.ambMistG) this.ambMistG.gain.setTargetAtTime(mist * 0.4, t, 1.5);
    if (this.nearG) this.nearG.gain.setTargetAtTime(Math.max(0, dread - 0.6) * 1.5, t, 0.4);
    this.birdT -= dt;
    if (this.birdT <= 0) {
      this.birdT = 2.5 + Math.random() * 6;
      if (dread < 0.15 && mist < 0.5) this.play('chirp'); // the birds go quiet when it is near, or in the fog
    }
  }
}
