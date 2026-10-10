// All sound is synthesised: a low drone, your heartbeat (faster as it gets close), its footsteps and
// breathing placed left/right where it really is (muffled behind walls), and the candle hiss.
export function createAudio() {
  let ctx = null, out, noise, drone, breath, breathPan, breathGain, blowGain, nextBeat = 0;

  function noiseBuffer() {
    const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  function env(g, t, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }
  function noiseHit({ t = ctx.currentTime, type = 'bandpass', f = 1000, q = 1, peak = 0.2, a = 0.004, dec = 0.08, pan = 0, dest = out, f2 }) {
    const s = ctx.createBufferSource(); s.buffer = noise;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + a + dec);
    const g = ctx.createGain(), p = ctx.createStereoPanner(); p.pan.value = pan;
    env(g, t, a, peak, dec);
    s.connect(fl).connect(g).connect(p).connect(dest);
    s.start(t, Math.random() * 1.5); s.stop(t + a + dec + 0.05);
  }
  function tone({ t = ctx.currentTime, type = 'sine', f = 60, f2, peak = 0.3, a = 0.005, dec = 0.15, pan = 0, dest = out }) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + a + dec);
    const g = ctx.createGain(), p = ctx.createStereoPanner(); p.pan.value = pan;
    env(g, t, a, peak, dec);
    o.connect(g).connect(p).connect(dest);
    o.start(t); o.stop(t + a + dec + 0.05);
  }

  return {
    get on() { return !!ctx; },
    start() {
      if (ctx) return;
      ctx = new AudioContext();
      noise = noiseBuffer();
      const comp = ctx.createDynamicsCompressor();
      out = ctx.createGain(); out.gain.value = 0.9;
      out.connect(comp).connect(ctx.destination);
      // the house: two detuned low saws under a slowly breathing filter, and room hiss
      drone = ctx.createGain(); drone.gain.value = 0.06;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 120; lp.Q.value = 4;
      const lfo = ctx.createOscillator(), lfoG = ctx.createGain(); lfo.frequency.value = 0.07; lfoG.gain.value = 50;
      lfo.connect(lfoG).connect(lp.frequency); lfo.start();
      for (const f of [41.2, 41.9, 61.7]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(); }
      lp.connect(drone).connect(out);
      const hiss = ctx.createBufferSource(); hiss.buffer = noise; hiss.loop = true;
      const hf = ctx.createBiquadFilter(); hf.type = 'bandpass'; hf.frequency.value = 420; hf.Q.value = 0.4;
      const hg = ctx.createGain(); hg.gain.value = 0.012;
      hiss.connect(hf).connect(hg).connect(out); hiss.start();
      // its breathing: a formant on noise, opened and closed by a slow pulse
      breath = ctx.createBufferSource(); breath.buffer = noise; breath.loop = true;
      const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 520; bf.Q.value = 3;
      const bf2 = ctx.createBiquadFilter(); bf2.type = 'lowpass'; bf2.frequency.value = 900;
      breathGain = ctx.createGain(); breathGain.gain.value = 0;
      breathPan = ctx.createStereoPanner();
      breath.connect(bf).connect(bf2).connect(breathGain).connect(breathPan).connect(out); breath.start();
      breath.filter = bf2;
      // your breath on the candle
      const bl = ctx.createBufferSource(); bl.buffer = noise; bl.loop = true;
      const blf = ctx.createBiquadFilter(); blf.type = 'bandpass'; blf.frequency.value = 1300; blf.Q.value = 0.8;
      blowGain = ctx.createGain(); blowGain.gain.value = 0;
      bl.connect(blf).connect(blowGain).connect(out); bl.start();
    },
    // every frame: heartbeat and breathing follow the monster
    update(G, dt, near) {
      if (!ctx) return;
      const t = ctx.currentTime, k = G.kid, M = G.monster;
      const d = Math.hypot(M.x - k.x, M.z - k.z), fear = k.fear || 0, pan = Math.max(-1, Math.min(1, (M.x - k.x) / 7));
      const playing = G.state === 'play';
      if (playing && fear > 0.02 && t >= nextBeat) {
        const bpm = 62 + fear * 100, gap = 60 / bpm, g = 0.12 + fear * 0.55;
        tone({ t, f: 62, f2: 38, peak: g, dec: 0.13 });
        tone({ t: t + gap * 0.32, f: 55, f2: 34, peak: g * 0.7, dec: 0.12 });
        nextBeat = t + gap;
      }
      const audible = playing && M.mode !== 'sleep' ? Math.max(0, 1 - d / 9) : 0;
      const pulse = 0.5 + 0.5 * Math.sin(t * (M.mode === 'chase' ? 7 : 2.6));
      breathGain.gain.setTargetAtTime(audible * audible * 0.5 * pulse, t, 0.05);
      breathPan.pan.setTargetAtTime(pan, t, 0.05);
      breath.filter.frequency.setTargetAtTime(near ? 900 : 380, t, 0.1);
      blowGain.gain.setTargetAtTime(playing && k.blowing >= 0 ? 0.22 : 0, t, 0.04);
    },
    event(e, G, near) {
      if (!ctx) return;
      const k = G.kid, M = G.monster, t = ctx.currentTime;
      const d = Math.hypot(M.x - k.x, M.z - k.z), pan = Math.max(-1, Math.min(1, (M.x - k.x) / 7));
      const vol = 1 / (1 + d * 0.35);
      switch (e.type) {
        case 'kstep':
          if (e.duct) noiseHit({ f: 2600, q: 9, peak: 0.08, dec: 0.12 }), tone({ type: 'triangle', f: 1900 + Math.random() * 600, peak: 0.02, dec: 0.2 });
          else noiseHit({ type: 'highpass', f: e.run ? 1400 : 2200, peak: e.run ? 0.07 : 0.025, dec: e.run ? 0.06 : 0.04 });
          break;
        case 'mstep': {
          const m = near ? 1 : 0.45;
          tone({ f: 58, f2: 34, peak: 0.5 * vol * m, dec: 0.18, pan });
          noiseHit({ type: 'lowpass', f: near ? 700 : 250, peak: 0.3 * vol * m, dec: 0.12, pan });
          if (e.run) noiseHit({ type: 'bandpass', f: 3200, q: 3, peak: 0.06 * vol * m, dec: 0.08, pan }); // claws on the boards
          break;
        }
        case 'spotted':
          for (const f of [233, 247, 349, 370]) tone({ type: 'sawtooth', f, f2: f * 0.94, peak: 0.07, a: 0.01, dec: 1.4 });
          noiseHit({ type: 'bandpass', f: 1800, f2: 400, q: 2, peak: 0.25, a: 0.01, dec: 0.9 });
          break;
        case 'windup':
          tone({ type: 'sawtooth', f: 70, f2: 130, peak: 0.25 * vol + 0.05, a: 0.05, dec: 0.25, pan });
          break;
        case 'lunge':
          noiseHit({ type: 'bandpass', f: 500, f2: 2400, q: 1, peak: 0.35, a: 0.02, dec: 0.35, pan });
          break;
        case 'candleOut':
          noiseHit({ type: 'highpass', f: 3000, peak: 0.12, a: 0.01, dec: 0.5 });
          tone({ f: 120, f2: 60, peak: 0.15, dec: 0.5 });
          break;
        case 'caught':
          for (const f of [110, 116, 164, 233]) tone({ type: 'sawtooth', f, f2: f * 0.5, peak: 0.16, a: 0.005, dec: 1.6 });
          noiseHit({ type: 'lowpass', f: 3000, f2: 200, peak: 0.8, a: 0.005, dec: 1.2 });
          break;
        case 'won':
          [523.3, 466.2, 392, 311.1, 293.7].forEach((f, i) => tone({ t: t + 1.2 + i * 0.55, type: 'triangle', f, peak: 0.07, a: 0.01, dec: 1.4 }));
          break;
        case 'wake':
          tone({ f: 46, f2: 40, peak: 0.25, a: 0.4, dec: 2.5 });
          break;
      }
    },
  };
}
