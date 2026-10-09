// SOUND. Most of the fear (05 P5, 06): you hear him before you see him, and Biscuit hears him before you.
// Everything that happens somewhere is placed there (HRTF), and gets duller with distance like it
// does on a real street at night. The beds change by region; the town has its own life (owls, a
// dog behind a door, a cat, a train far off); the music only comes in with fear, and it goes
// quiet just before the worst of it.
// Sources: assets/audio/walk (BigSoundBank CC0 + our own synthesis), assets/audio/licensed (music:
// Kevin MacLeod CC BY 4.0, credited on the title card), assets/audio/school (our synthesis).

const W = '/audio/walk/', L = '/audio/licensed/';
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export class Sound {
  constructor() { this.ok = false; this.buf = new Map(); this.loading = new Map(); this.loops = new Map(); this.t = 0; this.events = []; }

  async init() {
    const C = this.ctx = new AudioContext();
    this.master = C.createGain(); this.master.gain.value = 0.9;
    this.duck = C.createBiquadFilter(); this.duck.type = 'lowpass'; this.duck.frequency.value = 18000;
    const comp = C.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.3;
    this.master.connect(this.duck); this.duck.connect(comp); comp.connect(C.destination);
    // your own body (heart, breath) bypasses the muffling: when the world goes far away, they don't
    this.body = C.createGain(); this.body.gain.value = 0.9; this.body.connect(comp); this.comp = comp;
    this.bus = {};
    for (const [k, g] of Object.entries({ sfx: 1, amb: 0.8, music: 0.55, dog: 1.0, him: 1.0 })) { const n = C.createGain(); n.gain.value = g; n.connect(this.master); this.bus[k] = n; }
    this.bus.body = this.body;
    // a street's echo: a short convolver reverb for positional things
    this.verb = C.createConvolver(); this.verb.buffer = this.impulse(1.6, 2.6); const vg = C.createGain(); vg.gain.value = 0.32; this.verb.connect(vg); vg.connect(this.master);
    this.slices = await fetch(W + 'slices.json').then((r) => r.json()).catch(() => ({}));
    const pre = ['step_concrete', 'run_concrete', 'step_leaves', 'step_grass', 'step_gravel', 'dog_bark_small', 'dog_growl_bark', 'dog_cry_1', 'dog_cry_2', 'dog_pant_loop', 'syn_lamp_die', 'syn_whistle', 'syn_whistle_far', 'syn_sub', 'syn_ring', 'owl_tawny_1', 'owl_tawny_2', 'crows', 'cat_complain', 'dog_behind_door', 'gate_creak', 'syn_knock', 'syn_musicbox', 'syn_coat', 'syn_tick', 'breath_run', 'tv_static', 'syn_fox', 'syn_squeak', 'syn_bell', 'dog_inside', 'door_creak', 'syn_shepard', 'syn_dread', 'syn_lick', 'syn_whisper_biscuit', 'syn_splash', 'syn_jingle', 'syn_wetstep', 'child_laugh'];
    // the beds start at once (they stream); the rest of the sounds load in the background
    this.ok = true; this.startBeds();
    pre.forEach((n) => this.load(n));
    for (const n of ['../licensed/sfx_whispers', '../licensed/amb_fluorescent_hum_loop', '../licensed/sfx_light_flicker', '../licensed/sfx_stinger_dark', '../licensed/sfx_heartbeat_slow', '../school/light_clunk']) this.load(n);
  }

  impulse(secs, decay) {
    const C = this.ctx, n = Math.floor(C.sampleRate * secs), b = C.createBuffer(2, n, C.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay) * (i < 400 ? i / 400 : 1); }
    return b;
  }
  load(name) {
    if (this.buf.has(name)) return Promise.resolve(this.buf.get(name));
    if (this.loading.has(name)) return this.loading.get(name);
    const p = fetch(W + name + '.ogg').then((r) => r.arrayBuffer()).then((a) => this.ctx.decodeAudioData(a)).then((b) => { this.buf.set(name, b); return b; }).catch(() => null);
    this.loading.set(name, p); return p;
  }

  // a positional chain: source -> gain -> (air lowpass) -> panner -> bus (+ some to the reverb)
  chain(pos, bus, gain, { verb = 0.4, ref = 2, roll = 1.1, max = 120, muffle = 0 } = {}) {
    const C = this.ctx, g = C.createGain(); g.gain.value = gain;
    let out = g;
    if (pos) {
      const lpf = C.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = 18000;
      const pan = C.createPanner(); Object.assign(pan, { panningModel: 'HRTF', distanceModel: 'inverse', refDistance: ref, rolloffFactor: roll, maxDistance: max });
      pan.positionX.value = pos.x; pan.positionY.value = pos.y ?? 1; pan.positionZ.value = pos.z;
      g.connect(lpf); lpf.connect(pan); out = pan; g.pan = pan; g.lpf = lpf; g.pos = pos; g.muffle = muffle;
      this.air(g);
    }
    out.connect(this.bus[bus]);
    if (verb > 0) { const s = C.createGain(); s.gain.value = verb; out.connect(s); s.connect(this.verb); }
    return g;
  }
  air(g) { if (!g.lpf || !this.lis) return; const d = Math.hypot(g.pos.x - this.lis.x, g.pos.z - this.lis.z); g.lpf.frequency.value = Math.min(g.muffle || 18000, Math.max(900, 18000 * Math.exp(-d / 28))); }

  // play a one-shot (or a random slice of a long recording)
  one(name, { pos = null, gain = 1, rate = 1, bus = 'sfx', slice = true, verb = 0.35, ref, roll, at = 0, muffle = 0 } = {}) {
    if (!this.ok) return null;
    const b = this.buf.get(name);
    if (!b) { this.load(name); return null; }
    const C = this.ctx, src = C.createBufferSource(); src.buffer = b; src.playbackRate.value = rate;
    const g = this.chain(pos, bus, gain, { verb, ref, roll, muffle });
    src.connect(g); src.onended = () => { try { g.disconnect(); g.pan?.disconnect(); g.lpf?.disconnect(); } catch {} };
    const sl = slice && this.slices[name]?.length ? pick(this.slices[name]) : null;
    if (sl) src.start(C.currentTime + at, sl[0], (sl[1] - sl[0]) / 1); else src.start(C.currentTime + at);
    return { src, g };
  }
  // a loop that you can move, fade and stop
  loop(key, name, { pos = null, gain = 0.5, rate = 1, bus = 'amb', verb = 0.2, ref = 2, roll = 1.2, offset = Math.random() * 10 } = {}) {
    if (!this.ok) return null;
    if (this.loops.has(key)) return this.loops.get(key);
    const b = this.buf.get(name); if (!b) { this.load(name); return null; }
    const C = this.ctx, src = C.createBufferSource(); src.buffer = b; src.loop = true; src.playbackRate.value = rate;
    const g = this.chain(pos, bus, 0, { verb, ref, roll }); src.connect(g); src.start(0, offset % b.duration);
    const h = { src, g, gain, set: (v, t = 0.4) => g.gain.setTargetAtTime(v, C.currentTime, t), move: (p) => { if (g.pan) { g.pan.positionX.value = p.x; g.pan.positionY.value = p.y ?? 1; g.pan.positionZ.value = p.z; g.pos = p; } }, stop: (t = 0.5) => { g.gain.setTargetAtTime(0, C.currentTime, t / 3); setTimeout(() => { try { src.stop(); } catch {} }, t * 1000 + 100); this.loops.delete(key); } };
    h.set(gain, 0.8);
    this.loops.set(key, h); return h;
  }
  // long beds and music: streamed, not decoded whole
  stream(key, url, { gain = 0.5, bus = 'amb', rate = 1 } = {}) {
    if (!this.ok || this.loops.has(key)) return this.loops.get(key);
    const C = this.ctx, a = new Audio(url); a.loop = true; a.crossOrigin = 'anonymous'; a.playbackRate = rate; a.preservesPitch = false;
    const src = C.createMediaElementSource(a), g = C.createGain(); g.gain.value = 0; src.connect(g); g.connect(this.bus[bus]);
    a.addEventListener('loadedmetadata', () => { a.currentTime = Math.random() * Math.max(0, a.duration - 5); a.play().catch(() => {}); }, { once: true });
    const h = { a, g, set: (v, t = 1.5) => g.gain.setTargetAtTime(v, C.currentTime, t), stop: () => { a.pause(); this.loops.delete(key); } };
    h.set(gain); this.loops.set(key, h); return h;
  }

  startBeds() {
    this.stream('bed_rain', W + 'amb_night_rain.ogg', { gain: 0.35 });
    this.stream('bed_city', W + 'amb_city_far.ogg', { gain: 0.12 });
    this.stream('bed_wind', W + 'wind_tree.ogg', { gain: 0.1 });
    this.stream('bed_country', W + 'amb_country_night.ogg', { gain: 0 });
    this.stream('bed_creak', W + 'wind_creak.ogg', { gain: 0 });
    this.stream('bed_whistle', W + 'wind_whistle.ogg', { gain: 0 });
    this.stream('bed_rain2', W + 'rain_concrete.ogg', { gain: 0 });
    this.stream('bed_rain3', W + 'rain_puddle.ogg', { gain: 0 });
    // the score: three layers that come in with fear
    this.stream('mus_1', L + 'music_corridor_drone_2.ogg', { gain: 0, bus: 'music' });
    this.stream('mus_2', L + 'music_dread_mid.ogg', { gain: 0, bus: 'music' });
    this.stream('mus_3', L + 'music_dread_high.ogg', { gain: 0, bus: 'music' });
    this.nextLife = 6;
  }

  // every frame. S: { cam (THREE camera), player, dog, tall, director, region, lamps (near, lit), fear, dt, caught }
  update(S) {
    if (!this.ok) return;
    const C = this.ctx, cam = S.cam, dt = S.dt; this.t += dt;
    const Lst = C.listener, p = cam.position, f = S.fwd, u = S.up;
    this.lis = p;
    if (Lst.positionX) { Lst.positionX.value = p.x; Lst.positionY.value = p.y; Lst.positionZ.value = p.z; Lst.forwardX.value = f.x; Lst.forwardY.value = f.y; Lst.forwardZ.value = f.z; Lst.upX.value = u.x; Lst.upY.value = u.y; Lst.upZ.value = u.z; }
    for (const h of this.loops.values()) if (h.g?.pan) this.air(h.g);
    const fear = S.fear, R = S.region;
    // ---- beds by region; wind rises with fear
    const set = (k, v) => this.loops.get(k)?.set(v, 2.5);
    set('bed_rain', R === 'parkEdge' ? 0.18 : 0.32);
    set('bed_city', R === 'ourStreet' || R === 'highStreet' ? 0.13 : 0.05);
    set('bed_wind', 0.08 + fear * 0.12);
    set('bed_country', R === 'parkEdge' ? 0.3 : R === 'hill' ? 0.12 : 0);
    set('bed_creak', R === 'hill' || R === 'parkEdge' ? 0.12 + fear * 0.1 : fear * 0.06);
    set('bed_whistle', Math.max(0, fear - 0.45) * 0.4);
    set('bed_rain2', (S.rain || 0) * 0.5); set('bed_rain3', (S.rain || 0) * 0.3);
    // ---- the score. Before a peak the music drops out (silence is the closest tell)
    const pre = S.director.phase === 'hunt' && S.tall.active && Math.hypot(S.tall.x - S.player.x, S.tall.z - S.player.z) < 13;
    set('mus_1', pre ? 0.02 : Math.max(0, Math.min(1, (fear - 0.12) / 0.3)) * 0.55);
    set('mus_2', pre ? 0 : Math.max(0, Math.min(1, (fear - 0.42) / 0.25)) * 0.5);
    set('mus_3', S.director.phase === 'peak' ? 0.65 : 0);
    // the hunt: a tone that rises and rises and never arrives; and under everything while he's
    // about, a slow beating in the floor of the sound, stronger the nearer he is
    const shep = this.loop('shep', 'syn_shepard', { gain: 0, bus: 'music', verb: 0.3, offset: 0 });
    if (shep) shep.set(S.director.phase === 'hunt' && !pre ? 0.12 : 0, S.director.phase === 'hunt' ? 2 : 0.6);
    const dr = this.loop('dread', 'syn_dread', { gain: 0, bus: 'music', verb: 0 });
    if (dr) { const T = S.tall, dd = T.active && !T.vanished ? Math.hypot(T.x - S.player.x, T.z - S.player.z) : 99; dr.set(Math.max(0, 1 - dd / 32) * 0.55, 1.2); }
    // the music box: Biscuit's tune, in the quiet. Fear slows it and bends it out of tune; when he
    // comes it stops dead, mid-phrase (the stop is the warning)
    const mb = this.loop('mbox', 'syn_musicbox', { gain: 0, bus: 'music', verb: 0.2, offset: 0 });
    if (mb) {
      this.mbT = (this.mbT ?? 20) - dt; if (this.mbT < 0) { this.mbOn = !this.mbOn; this.mbT = this.mbOn ? rand(40, 70) : rand(45, 80); }
      const ph = S.director.phase, dead = ph === 'hunt' || ph === 'peak' || S.dog.lost || S.caught;
      if (dead && !this.mbDead) { this.mbDead = true; mb.g.gain.cancelScheduledValues(C.currentTime); mb.g.gain.setValueAtTime(0, C.currentTime + 0.02); }
      if (!dead) { this.mbDead = false; mb.set(this.mbOn ? Math.max(0, 0.2 - Math.max(0, fear - 0.3) * 0.5) : 0, this.mbOn ? 3 : 2); }
      mb.src.playbackRate.value = 1 - fear * 0.16 + Math.sin(this.t * 0.37) * fear * 0.025 + Math.sin(this.t * 2.3) * fear * 0.008;
    }
    // the world goes muffled and close when it's bad
    // ...and right after a fright, for a few seconds, everything goes thin and far away, and your ears ring
    this.shock = Math.max(0, (this.shock || 0) - dt / 5);
    if (this.shock > 0.55 && !this.ringing) { this.ringing = true; this.one('syn_ring', { gain: 0.12 + this.shock * 0.1, slice: false, verb: 0 }); }
    if (this.shock < 0.2) this.ringing = false;
    // hiding, crouched behind something with your hand on him: the world goes muffled, you hear your own heart
    this.duck.frequency.setTargetAtTime(S.caught ? 600 : S.hidden ? 1400 : Math.min(18000 - fear * 9000, 900 + (1 - Math.min(1, this.shock)) * 17000), C.currentTime, this.shock > 0.5 ? 0.05 : 0.4);
    // heartbeat
    const hb = this.loop('heart', '../licensed/sfx_heartbeat_slow', { gain: 0, bus: 'body', verb: 0, rate: 1 });
    if (hb) { hb.set(Math.max(0, fear - 0.5) * 1.4, 0.6); hb.src.playbackRate.value = 0.9 + fear * 0.5; }
    // ---- you: your own breath, when you've been running (a child's, quick and high), and held when you hide
    const br = this.loop('breath', 'breath_run', { gain: 0, bus: 'body', verb: 0, rate: 1.3 });
    if (br) { const Pl = S.player, want = Pl.crouch > 0.6 && S.fear > 0.4 ? 0.04 : Math.max(0, 0.85 - Pl.stamina) * 0.5 + (Pl.winded > 0 ? 0.18 : 0); br.set(want, want > br.lastWant ? 0.3 : 1.2); br.lastWant = want; br.src.playbackRate.value = 1.2 + (1 - Pl.stamina) * 0.2; }
    // ---- his tag jingles as he trots (and goes quiet when he does)
    { const D2 = S.dog, ph = Math.floor((D2.phase || 0) * 2);
      if (!D2.carried && !D2.hush && D2.speed > 0.7 && ph !== this.tagStep) { this.tagStep = ph; if (Math.random() < 0.55) this.one('syn_jingle', { pos: { x: D2.x, y: D2.y + 0.3, z: D2.z }, gain: 0.08 + Math.min(0.12, D2.speed * 0.04), rate: 0.9 + Math.random() * 0.25, slice: false, verb: 0.05, ref: 1, bus: 'dog' }); } }
    // ---- Biscuit: panting when hot, positioned on him
    const D = S.dog, dp = { x: D.x, y: D.y + 0.3, z: D.z };
    if (D.carried) { dp.x = p.x; dp.y = p.y - 0.4; dp.z = p.z; }
    const pant = this.loop('pant', 'dog_pant_loop', { pos: dp, gain: 0, bus: 'dog', rate: 1.25, ref: 1, verb: 0.05 });
    if (pant) { pant.move(dp); pant.set(D.pant * 0.35 + (D.scared && !D.hush ? 0.12 : 0), D.hush ? 0.05 : 0.3); }
    // ---- lamps: the nearest lit ones buzz
    const near = S.lamps;
    for (let i = 0; i < 3; i++) {
      const Lp = near[i], key = 'buzz' + i;
      const h = this.loop(key, '../licensed/amb_fluorescent_hum_loop', { pos: Lp ? { x: Lp.x, y: Lp.y, z: Lp.z } : { x: 0, y: -99, z: 0 }, gain: 0, bus: 'amb', rate: 0.9 + i * 0.03, ref: 1.5, roll: 1.6 });
      if (h) { if (Lp) h.move({ x: Lp.x, y: Lp.y, z: Lp.z }); h.set(Lp ? 0.25 * Lp.level : 0, 0.15); }
    }
    // ---- his footsteps, only while he moves (they stop the moment you turn round)
    const T = S.tall;
    const coat = this.loop('coat', 'syn_coat', { pos: { x: T.x, y: 1.6, z: T.z }, gain: 0, bus: 'him', verb: 0.3, ref: 2.5, roll: 1.3 });
    if (coat) { coat.move({ x: T.x, y: 1.6, z: T.z }); const on = T.active && !T.seen && !T.vanished && T.speed > 0.2 && Math.hypot(T.x - p.x, T.z - p.z) < 26; coat.g.gain.setTargetAtTime(on ? 0.5 : 0, C.currentTime, on ? 0.25 : 0.008); coat.src.playbackRate.value = 0.8 + Math.min(1, T.speed / 3) * 0.6; }
    // the footsteps behind you (an omen): when you stop, they take one more step
    const E = S.director.echo;
    if (E && E.steps > 3 && !E.extra && this.t - (this.lastStep || 0) > 0.75) { E.extra = true; this.echoStep(S, E, 0.0, 1.15); }
    if (T.active && !T.seen && T.speed > 0.1) {
      const step = Math.floor(T.phase * 2);
      if (step !== this.tallStep) { this.tallStep = step; const d = Math.hypot(T.x - p.x, T.z - p.z); if (d < 34) this.one('step_concrete', { pos: { x: T.x, y: 0.2, z: T.z }, gain: 0.75, rate: rand(0.55, 0.62), bus: 'him', verb: 0.6, ref: 3 }); }
    }
    // ---- the town's own life
    this.nextLife -= dt;
    if (this.nextLife < 0) { this.life(S); this.nextLife = rand(9, 22) * (S.director.phase === 'peak' ? 4 : 1); }
  }

  life(S) {
    const p = S.player, R = S.region, side = Math.random() < 0.5 ? -1 : 1;
    const away = (d) => ({ x: p.x + side * rand(9, 16), y: 2, z: p.z - rand(-d, d) });
    const deck = [
      ['owl', 2, () => this.one(pick(['owl_tawny_1', 'owl_tawny_2']), { pos: away(40), gain: 0.4, verb: 0.6, ref: 6 })],
      ['dogDoor', 1.5, () => this.one('dog_behind_door', { pos: away(15), gain: 0.35, rate: rand(0.9, 1.05), verb: 0.2 })],
      ['dogsFar', 1, () => this.one('dogs_far', { pos: away(60), gain: 0.25, slice: false, verb: 0.7, ref: 8 })],
      ['crows', R === 'parkEdge' || R === 'hill' ? 2 : 0.7, () => this.one('crows', { pos: away(20), gain: 0.35, verb: 0.5, ref: 5 })],
      ['cat', 0.8, () => this.one('cat_complain', { pos: away(12), gain: 0.3, verb: 0.3 })],
      ['chimes', R === 'ourStreet' ? 1.5 : 0.4, () => this.one('chimes', { pos: away(10), gain: 0.25, verb: 0.4 })],
      ['train', 0.5, () => this.one('train_whistle_far', { pos: { x: p.x - 120, y: 5, z: p.z - 80 }, gain: 0.35, slice: false, verb: 0.8, ref: 30 })],
      ['gate', 0.9, () => this.one('gate_creak', { pos: away(10), gain: 0.3, rate: rand(0.8, 1.1), verb: 0.3 })],
      ['car', R === 'highStreet' || R === 'ourStreet' ? 0.7 : 0.2, () => this.one('car_pass', { pos: { x: p.x + rand(-40, 40), y: 1, z: p.z - rand(40, 90) }, gain: 0.3, verb: 0.6, ref: 10 })],
    ];
    let tot = deck.reduce((a, d) => a + d[1], 0), r = Math.random() * tot;
    for (const d of deck) { r -= d[1]; if (r < 0) { d[2](); return d[0]; } }
  }

  echoStep(S, E, at, rate) {
    const P = S.player, fx = S.fwd.x, fz = S.fwd.z, fl = Math.hypot(fx, fz) || 1;
    this.one('step_concrete', { pos: { x: P.x - fx / fl * E.back + 0.8, y: 0.2, z: P.z - fz / fl * E.back }, gain: 0.45, rate: rand(0.98, 1.08) * (rate / 1.1), verb: 0.55, ref: 3, at });
  }
  // things that happen
  on(e, S) {
    if (!this.ok) return;
    const D = S.dog, dpos = D.carried ? { x: S.cam.position.x, y: S.cam.position.y - 0.4, z: S.cam.position.z } : { x: D.x, y: D.y + 0.3, z: D.z };
    switch (e.name) {
      case 'bark': this.one('dog_bark_small', { pos: dpos, gain: 0.9, rate: rand(1.15, 1.3), bus: 'dog', verb: 0.5, ref: 1.5, at: e.data.at || 0 }); break;
      case 'lick': this.one('syn_lick', { pos: dpos, gain: 0.5, rate: 1 + Math.random() * 0.2, slice: false, verb: 0, bus: 'dog' }); break;
      case 'call': this.one('syn_squeak', { gain: 0.45, slice: false, verb: 0.2 }); break;
      case 'startle': this.shock = Math.max(this.shock || 0, e.data.amount * 1.6); break;
      case 'growl': this.one('dog_growl_bark', { pos: dpos, gain: 0.35 + e.data.level * 0.3, rate: rand(1.05, 1.2), bus: 'dog', verb: 0.15, ref: 1 }); break;
      case 'whimper': this.one(pick(['dog_cry_1', 'dog_cry_2', 'dog_cry_3']), { pos: dpos, gain: e.data.lost ? 0.85 : 0.45, rate: rand(1.25, 1.45), bus: 'dog', verb: e.data.lost ? 0.45 : 0.1, ref: e.data.lost ? 4 : 1, roll: e.data.lost ? 0.7 : 1.1 }); break;
      case 'found': this.one('dog_pant_loop', { pos: dpos, gain: 0.5, rate: 1.4, bus: 'dog', slice: false, verb: 0 }); this.one('dog_bark_small', { pos: dpos, gain: 0.35, rate: 1.5, bus: 'dog', verb: 0.1 }); break;
      case 'happyHuff': this.one('dog_pant_loop', { pos: dpos, gain: 0.25, rate: 1.4, bus: 'dog', slice: false, verb: 0 }); break;
      case 'glimpseSeen': this.one('syn_sub', { gain: 0.45, slice: false, verb: 0 }); break;
      case 'moment': if (e.data.kind === 'sneeze') setTimeout(() => this.one('dog_pant_loop', { pos: dpos, gain: 0.5, rate: 2.2, bus: 'dog', verb: 0.05 }), 480); if (e.data.kind === 'shake') this.one('step_leaves', { pos: dpos, gain: 0.35, rate: 2.0, verb: 0.05 }); if (e.data.kind === 'yawn') this.one('dog_cry_2', { pos: dpos, gain: 0.25, rate: 1.6, bus: 'dog', verb: 0.05 }); break;
      case 'tug': this.one('step_gravel', { pos: dpos, gain: 0.25, rate: 1.6, verb: 0 }); break;

      case 'pickUp': case 'putDown': this.one('step_leaves', { gain: 0.3, rate: 1.4, verb: 0 }); break;
      case 'whistle': {
        const d = Math.hypot(e.data.x - S.player.x, e.data.z - S.player.z);
        this.one(d > 25 ? 'syn_whistle_far' : 'syn_whistle', { pos: { x: e.data.x, y: 2.5, z: e.data.z }, gain: 0.5, bus: 'him', slice: false, verb: 0.6, ref: 6, roll: 0.8 });
        break;
      }
      case 'lampDying': { const L = e.data.id >= 0 ? S.lampById(e.data.id) : { x: S.player.x, y: 2.5, z: S.player.z - 14 }; if (L) { this.one('syn_lamp_die', { pos: L, gain: 0.5, slice: false, verb: 0.4, ref: 3 }); this.one('../licensed/sfx_light_flicker', { pos: L, gain: 0.35, verb: 0.2 }); } break; }
      case 'lampOut': this.one('../school/light_clunk', { pos: { x: e.data.x, y: 5.5, z: e.data.z }, gain: 0.6, verb: 0.5, ref: 3 }); this.one('syn_tick', { pos: { x: e.data.x, y: 5.5, z: e.data.z }, gain: 0.35, slice: false, verb: 0.2, ref: 2, at: 0.6 }); break;
      case 'lampOn': this.one('../school/light_clunk', { pos: { x: e.data.x, y: 5.5, z: e.data.z }, gain: 0.35, rate: 1.2, verb: 0.4, ref: 3 }); break;
      case 'tallSeen': if (e.data.d < 9) this.shock = Math.max(this.shock || 0, 0.9); if (e.data.first || e.data.d < 9) { this.one('syn_sub', { gain: 0.8, slice: false, verb: 0 }); if (e.data.d < 9) this.one('../licensed/sfx_stinger_dark', { gain: 0.5, slice: false, verb: 0 }); } break;
      case 'caught': if (!this.caughtOnce) { this.caughtOnce = true; this.one('../licensed/sfx_stinger_dark', { gain: 0.9, slice: false, verb: 0 }); this.one('syn_sub', { gain: 1, slice: false, verb: 0 }); setTimeout(() => (this.caughtOnce = false), 4000); } break;
      case 'omen': {
        const d = e.data, pos = d.x !== undefined ? { x: d.x, y: d.y ?? 1.2, z: d.z } : null;
        if (d.kind === 'laugh') this.one('child_laugh', { pos, gain: 0.55, rate: 0.9, verb: 0.65, ref: 6, roll: 0.8, muffle: 3200 });
        else if (d.kind === 'fox') this.one('syn_fox', { pos, gain: 1.0, slice: false, verb: 0.6, ref: 8, roll: 0.6 });
        else if (d.kind === 'gate') this.one('gate_creak', { pos, gain: 0.7, rate: rand(0.75, 0.9), verb: 0.4, ref: 3 });
        else if (d.kind === 'tv') this.one('tv_static', { pos, gain: 0.5, verb: 0.15, ref: 3, muffle: 700 });
        else if (d.kind === 'phoneIn') this.one('syn_phone', { pos, gain: 0.6, slice: false, verb: 0.2, ref: 3, muffle: 900 });
        else if (d.kind === 'knock') this.one('syn_knock', { pos, gain: 0.9, slice: false, verb: 0.3, ref: 3, muffle: 1400 });
        else if (d.kind === 'whisper') this.one('../licensed/sfx_whispers', { pos, gain: 0.45, rate: 0.85, verb: 0.35, ref: 2, muffle: 5000 });
        else if (d.kind === 'breath') this.one('breath_run', { pos, gain: 0.32, rate: 0.62, verb: 0.02, ref: 1, slice: true });
        else if (d.kind === 'flicker' && d.id !== undefined) { const L = S.lampById(d.id); if (L) this.one('../licensed/sfx_light_flicker', { pos: L, gain: 0.45, verb: 0.3, ref: 3 }); }
        else if (d.kind === 'eyes') this.one('step_leaves', { pos, gain: 0.3, rate: 0.7, verb: 0.2, ref: 2 });
        break;
      }
      case 'lure': this.one('syn_whisper_biscuit', { pos: { x: e.data.x, y: 2.4, z: e.data.z }, gain: 0.9, slice: false, verb: 0.55, ref: 5, roll: 0.7, bus: 'him' }); this.one('../licensed/sfx_whispers', { pos: { x: e.data.x, y: 2.4, z: e.data.z }, gain: 0.25, rate: 0.8, verb: 0.6, ref: 5, bus: 'him' }); break;
      case 'finale': this.one('../licensed/sfx_stinger_dark', { gain: 0.6, slice: false, verb: 0 }); this.shock = Math.max(this.shock || 0, 0.4); break;
      case 'blink': this.one('syn_sub', { gain: 0.35 + Math.max(0, 1 - e.data.d / 12) * 0.5, slice: false, verb: 0, at: 0.18 }); break;
      case 'respawn': this.one('syn_ring', { gain: 0.25, slice: false, verb: 0 }); break;
      case 'step': {
        const surf = e.data.surface, rate = rand(1.25, 1.42);
        const name = e.data.run ? 'run_concrete' : surf === 'grass' ? 'step_grass' : surf === 'leaves' ? 'step_leaves' : 'step_concrete';
        this.one(name, { gain: (e.data.run ? 0.5 : 0.32) * (e.data.crouch ? 0.4 : 1), rate, verb: 0.12, pos: null });
        if (S.rain > 0.3 && surf === 'stone') this.one('syn_wetstep', { gain: (0.12 + S.rain * 0.18) * (e.data.run ? 1.4 : 1), rate: rand(0.9, 1.15), slice: false, verb: 0.05 }); // (in the rain, the pavement's wet)
        this.lastStep = this.t;
        // the echo omen: someone a little way behind, matching your steps (a beat late, a little heavier)
        const E = S.director.echo; if (E && !e.data.run) { E.steps++; this.echoStep(S, E, 0.3, 1.1); }
        break;
      }
    }
  }
}
