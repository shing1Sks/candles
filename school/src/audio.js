// SOUND for the school (research/06). Real recordings where they matter (assets/audio/licensed, served
// at /audio/licensed: the 1917 hymn, a woman reading a story, chalk, pencils, keys, his footsteps, a
// real snore, the bell, Kevin MacLeod's score) and the synthesised set (assets/audio/school) for the
// rest. The mix follows the night:
//   score    three layers that rise with the director's tension (a low drone, distant strings, grating
//            low strings), low-passed when it's calm; ducked when he's near, cut to silence before a hit
//   rooms    a reverb send that changes with the space (corridor, classroom, stairwell)
//   lessons  the hymn through a PA (band-limited, a little distorted, mains hum); the chalk and every
//            pencil in the room stop dead the instant she turns
//   him      footsteps and cane taps sliced from recordings, his keys in his hand while he walks;
//            when the keys stop, he's listening
// the long ones are streamed from <audio> elements (decoding minutes of stereo music would take
// hundreds of megabytes); everything short is decoded up front for sample-accurate slicing
const STREAMED = ['music_corridor_drone_1', 'music_corridor_drone_2', 'music_dread_mid', 'music_dread_high', 'music_infants_celesta', 'music_memory_music_box_choir',
  'music_this_old_man_dark', 'music_pa_hymn_holy_holy_holy', 'amb_wind_building_loop', 'amb_ending_playground_loop'];
const LICENSED = [
  'amb_fluorescent_hum_loop', 'amb_memory_fire_loop',
  'sfx_light_flicker', 'sfx_door_creak', 'sfx_door_slam', 'sfx_locker_metal', 'sfx_keys_jangle', 'sfx_footsteps_headmaster', 'sfx_cane_taps', 'sfx_snore_loop', 'sfx_whispers',
  'sfx_chalk_writing_loop', 'sfx_pencils_writing_loop', 'sfx_story_fierce_bad_rabbit', 'sfx_paper_tear', 'sfx_music_box_this_old_man', 'sfx_doll_twinkle_1890',
  'sfx_footsteps_stairs_stone', 'sfx_shriek_teacher', 'sfx_stinger_dark', 'sfx_heartbeat_slow', 'sfx_bell_school_loop', 'sfx_bell_school_ring',
];
const SCHOOL = ['room_tone', 'paper_pick_1', 'paper_pick_2', 'paper_pick_3', 'desk_lid', 'chair_scrape', 'door_shut', 'door_lock', 'locker_open', 'locker_shut',
  'light_clunk', 'crack_chorus', 'whisper_name', 'stamp', 'stinger_rush', 'page_turn', 'chalk_stop'];
const FOREST = ['sfx_step_paper_1', 'sfx_step_paper_2', 'sfx_step_paper_3', 'sfx_step_paper_4'];
const pick = (base, n) => `${base}_${1 + Math.floor(Math.random() * n)}`;
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp01 = (v) => Math.max(0, Math.min(1, v));
// where things are in the recordings (README in assets/audio/licensed)
const HM_STEPS = [0.0, 0.81, 1.41, 1.93, 2.66, 3.22, 3.86, 4.56, 5.12, 5.84, 6.5, 7.23];
const CANE_TAPS = [4.86, 6.02, 7.25];
const LOCKER = { open: 0.0, shut: 2.4, rattle: 5.0 };
const FLOOR_H = 3.6;

export class Sound {
  constructor() { this.ctx = null; this.buf = {}; this.loops = {}; this.lastSting = -1e9; this.dropT = 0; }

  async start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const ac = (this.ctx = new AudioContext());
    // master -> a safety limiter -> out
    const lim = ac.createDynamicsCompressor(); lim.threshold.value = -3; lim.ratio.value = 12; lim.attack.value = 0.003; lim.release.value = 0.2;
    this.master = ac.createGain(); this.master.gain.value = 0.95; this.master.connect(lim).connect(ac.destination);
    const bus = () => { const g = ac.createGain(); g.connect(this.master); return g; };
    this.sfxBus = bus(); this.bedBus = bus(); this.hmBus = bus(); this.scoreBus = bus();
    // the score runs through one low-pass that opens as the dread rises
    this.scoreLP = ac.createBiquadFilter(); this.scoreLP.type = 'lowpass'; this.scoreLP.frequency.value = 600; this.scoreLP.connect(this.scoreBus);
    // the room: a synthetic impulse response, sent more or less depending on the space you're in
    this.verb = ac.createGain(); this.verb.gain.value = 0.25;
    const conv = ac.createConvolver(); conv.buffer = this.impulse(2.3, 2.6);
    this.verb.connect(conv).connect(this.master);
    // the PA: band-limited, a little crushed, the room after it
    this.pa = this.paChain();

    const load = async (name, url) => {
      try {
        const r = await fetch(url);
        if (!r.ok || !(r.headers.get('content-type') || '').includes('audio')) return;
        this.buf[name] = await ac.decodeAudioData(await r.arrayBuffer());
      } catch { /* a missing sound stays silent */ }
    };
    await Promise.all([...LICENSED.map((n) => load(n, `/audio/licensed/${n}.ogg`)), ...SCHOOL.map((n) => load(n, `/audio/school/${n}.ogg`)), ...FOREST.map((n) => load(n, `/audio/${n}.ogg`))]);

    // the beds, all running silently from the start, faded up and down by update()
    const L = (name, busNode, o) => {
      this.loops[o?.as || name] = STREAMED.includes(name) ? this.stream(name, { bus: busNode })
        : this.voice(name, { loop: true, vol: 0, bus: busNode, offset: o?.offset ?? rnd(0, (this.buf[name]?.duration || 1) * 0.8), rate: o?.rate, wet: o?.wet, lp: o?.lp });
    };
    L('music_corridor_drone_1', this.scoreLP, { as: 'drone' });
    L('music_corridor_drone_2', this.scoreLP, { as: 'drone2' });
    L('music_dread_mid', this.scoreLP, { as: 'mid' });
    L('music_dread_high', this.scoreLP, { as: 'high' });
    L('music_infants_celesta', this.scoreBus, { as: 'infants' });
    L('amb_wind_building_loop', this.bedBus, { as: 'building' });
    L('amb_fluorescent_hum_loop', this.bedBus, { as: 'hum', rate: 1 });
    L('room_tone', this.bedBus, { as: 'roomTone' });
    L('sfx_snore_loop', this.bedBus, { as: 'snore', wet: 0.2 });
    L('sfx_bell_school_loop', this.bedBus, { as: 'bell', wet: 0.4 });
    L('sfx_heartbeat_slow', this.bedBus, { as: 'heart' });
    L('sfx_chalk_writing_loop', this.bedBus, { as: 'chalk', wet: 0.15 });
    for (let i = 0; i < 4; i++) L('sfx_pencils_writing_loop', this.bedBus, { as: `pencil${i}`, rate: rnd(0.9, 1.12), wet: 0.1 });
    // what's behind a closed door, heard through it
    L('sfx_pencils_writing_loop', this.bedBus, { as: 'leakPencil', lp: 520 });
    L('sfx_chalk_writing_loop', this.bedBus, { as: 'leakChalk', lp: 700 });
    L('sfx_story_fierce_bad_rabbit', this.bedBus, { as: 'leakStory', lp: 450 });
    L('sfx_music_box_this_old_man', this.bedBus, { as: 'leakBox', lp: 1500, rate: 0.9 });
    // the mains hum under the PA
    const hum = ac.createOscillator(); hum.frequency.value = 50; this.paHum = ac.createGain(); this.paHum.gain.value = 0; hum.connect(this.paHum).connect(this.pa); hum.start();
  }

  // ---- building blocks ----
  // a streamed track through a gain (and optionally a low-pass) into a bus; plays only while audible
  stream(name, { loop = true, bus = this.bedBus, lp = null, vol = 0 } = {}) {
    const ac = this.ctx, el = new Audio(`/audio/licensed/${name}.ogg`);
    el.loop = loop; el.preload = 'auto';
    const src = ac.createMediaElementSource(el), g = ac.createGain(); g.gain.value = vol;
    let node = src;
    if (lp) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; node.connect(f); node = f; }
    node.connect(g).connect(bus);
    el.addEventListener('loadedmetadata', () => { if (loop) el.currentTime = rnd(0, el.duration * 0.8); }, { once: true });
    return { el, g, src: { playbackRate: { setTargetAtTime: (v) => { el.playbackRate = v; } } }, streamed: true };
  }

  // a stretch of a streamed track, faded in and out (a memory, the playground, a far-off hymn)
  excerpt(name, { offset = 0, dur = 6, vol = 0.5, lp = null, fadeIn = 0.3, bus = this.sfxBus, rate = 1, delay = 0 } = {}) {
    const ac = this.ctx;
    if (!ac) return;
    const v = this.stream(name, { loop: false, bus, lp, vol: 0 }), t = ac.currentTime + delay;
    v.el.playbackRate = rate;
    const go = () => { v.el.currentTime = offset; v.el.play().catch(() => {}); };
    setTimeout(() => (v.el.readyState >= 1 ? go() : v.el.addEventListener('loadedmetadata', go, { once: true })), delay * 1000);
    v.g.gain.setValueAtTime(0, t); v.g.gain.linearRampToValueAtTime(vol, t + fadeIn);
    v.g.gain.setValueAtTime(vol, t + dur - Math.min(1, dur / 3)); v.g.gain.linearRampToValueAtTime(0, t + dur);
    setTimeout(() => { v.el.pause(); v.g.disconnect(); }, (delay + dur + 0.3) * 1000);
  }

  impulse(secs, decay) {
    const ac = this.ctx, n = Math.floor(ac.sampleRate * secs), b = ac.createBuffer(2, n, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay) * (i < 400 ? i / 400 : 1); }
    return b;
  }

  paChain() {
    const ac = this.ctx, hp = ac.createBiquadFilter(), lp = ac.createBiquadFilter(), pk = ac.createBiquadFilter(), ws = ac.createWaveShaper(), out = ac.createGain();
    hp.type = 'highpass'; hp.frequency.value = 300; lp.type = 'lowpass'; lp.frequency.value = 3400; pk.type = 'peaking'; pk.frequency.value = 2000; pk.gain.value = 4;
    const curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 2 - 1; curve[i] = Math.tanh(x * 1.8) / Math.tanh(1.8); }
    ws.curve = curve; out.gain.value = 0.8;
    hp.connect(lp).connect(pk).connect(ws).connect(out); out.connect(this.bedBus);
    const send = ac.createGain(); send.gain.value = 0.5; out.connect(send).connect(this.verb);
    return hp;
  }

  // play a buffer (or a slice of one): rate, a low-pass, a position, a reverb send, a fade at the end
  voice(name, o = {}) {
    const ac = this.ctx, buf = this.buf[name];
    if (!ac || !buf) return null;
    const src = ac.createBufferSource(); src.buffer = buf; src.loop = !!o.loop;
    src.playbackRate.value = o.rate ?? 1;
    let node = src;
    if (o.lp) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; node.connect(f); node = f; }
    const g = ac.createGain(); g.gain.value = o.vol ?? 1; node.connect(g);
    let out = g;
    if (o.at) {
      const p = ac.createPanner(); p.panningModel = o.hrtf ? 'HRTF' : 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = o.ref ?? 2; p.rolloffFactor = o.roll ?? 1.3;
      p.positionX.value = o.at.x; p.positionY.value = o.at.y; p.positionZ.value = o.at.z;
      g.connect(p); out = p;
    }
    out.connect(o.bus ?? this.sfxBus);
    if (o.wet) { const s = ac.createGain(); s.gain.value = o.wet; out.connect(s).connect(this.verb); }
    const t = ac.currentTime + (o.delay || 0);
    if (o.dur) {
      src.start(t, o.offset || 0, o.dur + 0.1);
      const v = o.vol ?? 1, fade = Math.min(0.15, o.dur / 3);
      g.gain.setValueAtTime(o.fadeIn ? 0 : v, t); if (o.fadeIn) g.gain.linearRampToValueAtTime(v, t + o.fadeIn);
      g.gain.setValueAtTime(v, t + o.dur - fade); g.gain.linearRampToValueAtTime(0, t + o.dur);
    } else if (o.loop) src.start(t, o.offset || 0);
    else src.start(t, o.offset || 0);
    return { src, g, out };
  }

  level(name, v, rate = 2) {
    const L = this.loops[name];
    if (!L || !this.ctx) return;
    if (Math.abs((L.level ?? -1) - v) < 0.003) return;
    L.level = v;
    if (L.streamed) {
      clearTimeout(L.pauseT);
      if (v > 0 && L.el.paused) L.el.play().catch(() => {});
      if (v === 0) L.pauseT = setTimeout(() => L.el.pause(), 4000);
    }
    if (rate === Infinity) { L.g.gain.cancelScheduledValues(this.ctx.currentTime); L.g.gain.setValueAtTime(v, this.ctx.currentTime); }
    else L.g.gain.setTargetAtTime(v, this.ctx.currentTime, 1 / rate);
  }

  // a tiny synthesised sound: tone(s) through an envelope, or filtered noise
  synth({ f = 440, f2 = null, type = 'sine', dur = 0.3, vol = 0.3, at = null, noise = false, q = 1, delay = 0, lp = null }) {
    const ac = this.ctx;
    if (!ac) return;
    const t = ac.currentTime + delay;
    let src;
    if (noise) { const n = ac.createBufferSource(), b = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; n.buffer = b; src = n; }
    else { src = ac.createOscillator(); src.type = type; src.frequency.setValueAtTime(f, t); if (f2) src.frequency.exponentialRampToValueAtTime(f2, t + dur); }
    const bp = ac.createBiquadFilter(); bp.type = noise ? 'bandpass' : 'lowpass'; bp.frequency.value = noise ? f : (lp ?? 8000); bp.Q.value = q;
    const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(bp).connect(g);
    let out = g;
    if (at) { const p = ac.createPanner(); p.distanceModel = 'inverse'; p.refDistance = 2; p.positionX.value = at.x; p.positionY.value = at.y; p.positionZ.value = at.z; g.connect(p); out = p; }
    out.connect(this.sfxBus); const s = ac.createGain(); s.gain.value = 0.35; out.connect(s).connect(this.verb);
    src.start(t); src.stop(t + dur + 0.05);
  }

  // everything but him and the hit drops away for a moment: the silence before a scare (research/06 §3)
  silence(secs = 0.5) {
    const ac = this.ctx;
    if (!ac) return;
    const t = ac.currentTime;
    for (const b of [this.scoreBus, this.bedBus]) { b.gain.cancelScheduledValues(t); b.gain.setTargetAtTime(0.04, t, 0.03); b.gain.setTargetAtTime(1, t + secs, 0.4); }
  }

  sting(vol = 1) {
    const now = this.ctx?.currentTime ?? 0;
    if (now - this.lastSting > 45) { this.lastSting = now; this.voice('sfx_stinger_dark', { vol: 0.9 * vol, dur: 4.5 }); }
    this.voice('stinger_rush', { vol: 0.8 * vol });
  }

  // ---- the hymn and the story: the lessons' clocks, kept in time with the engine ----
  hymnTo(secondsLeft, playing, slow) {
    const ac = this.ctx;
    if (!ac) return;
    if (!this.hymnEl) { this.hymnEl = this.stream('music_pa_hymn_holy_holy_holy', { loop: false, bus: this.pa, vol: 0.7 }); }
    const el = this.hymnEl.el;
    if (!playing) {
      if (!el.paused) { el.pause(); this.paHum.gain.setTargetAtTime(0, ac.currentTime, 0.2); }
      return;
    }
    if (!el.duration) return;
    // it ends exactly when the lesson does: be that far from the end of the recording
    const rate = slow ? 0.86 : 1, at = Math.max(0, el.duration - secondsLeft * rate);
    if (el.playbackRate !== rate) el.playbackRate = rate;
    if (Math.abs(el.currentTime - at) > 0.6) el.currentTime = at;
    if (el.paused) { el.play().catch(() => {}); this.paHum.gain.setTargetAtTime(0.012, ac.currentTime, 0.3); }
  }

  storyTo(at, playing) {
    const ac = this.ctx, buf = this.buf.sfx_story_fierce_bad_rabbit;
    if (!ac || !buf) return;
    if (!playing) { if (this.story) { this.story.src.stop(); this.story = null; } return; }
    const where = this.story ? this.story.off + (ac.currentTime - this.story.t0) : -99;
    if (this.story && Math.abs(where - at) < 1.2) return;
    if (this.story) this.story.src.stop();
    if (at >= buf.duration) { this.story = null; return; }
    // (muffled: the captions carry her words; the recording is a different story, so it mustn't be legible)
    const v = this.voice('sfx_story_fierce_bad_rabbit', { vol: 0.6, offset: at, wet: 0.2, lp: 1100 });
    this.story = { ...v, off: at, t0: ac.currentTime };
  }

  // ---- per frame ----
  update(S, camera, { lit = 0.5 } = {}) {
    const ac = this.ctx;
    if (!ac || !this.loops.building) return;
    const Lis = ac.listener, p = camera.position, fx = -Math.sin(S.player.yaw), fz = -Math.cos(S.player.yaw);
    if (Lis.positionX) { Lis.positionX.value = p.x; Lis.positionY.value = p.y; Lis.positionZ.value = p.z; Lis.forwardX.value = fx; Lis.forwardY.value = 0; Lis.forwardZ.value = fz; Lis.upX.value = 0; Lis.upY.value = 1; Lis.upZ.value = 0; }
    const P = S.player, D = S.director || {}, H = S.headmaster;
    const st = P.room && S.rooms[P.room], inRoom = !!P.room, det = S.phase === 'detention', play = S.phase === 'play';
    const running = st && st.state === 'running', lesson = running ? st.roll.lesson : null, Lz = running ? st.lesson : null;
    const looking = lesson === 'handin' && (Lz.phase === 'look' || Lz.phase === 'turn');
    const active = H.state && H.state !== 'absent' && play;
    const hmD = active && H.floor === P.floor ? Math.hypot(H.x - P.x, H.z - P.z) : 99;

    // the space: reverb amount
    this.verb.gain.setTargetAtTime(P.inStair ? 0.55 : inRoom ? 0.12 : det ? 0.1 : 0.28, ac.currentTime, 0.4);

    // the score, from the director's tension (0..100) and phase
    const d = clamp01((D.tension ?? 0) / 100), after = D.phase === 'aftermath', bell = S.clock.bell;
    const infants = inRoom && st?.kit === 'infants';
    const duck = (hmD < 10 ? 0.5 : 1) * (bell ? 0.5 : 1) * (lesson === 'handin' ? 0.45 : 1) * (lesson === 'story' ? 0.4 : 1) * (det ? 0 : 1);
    const second = (S.seed ?? 0) % 2 === 1 || P.inStair;
    const drone = !play && !det ? 0 : after ? 0.1 : d < 0.12 ? 0.05 : 0.14 + 0.32 * d;
    this.level(second ? 'drone2' : 'drone', drone * duck * (infants ? 0.2 : 1), 0.5);
    this.level(second ? 'drone' : 'drone2', 0, 0.5);
    this.level('mid', play && !after && d >= 0.5 ? 0.45 * clamp01((d - 0.5) / 0.3) * duck : 0, 0.6);
    this.level('high', play && !after && (d >= 0.8 || H.state === 'chase' || bell) ? 0.5 * duck : 0, 1.2);
    this.level('infants', infants && play ? 0.32 : 0, 0.8);
    this.scoreLP.frequency.setTargetAtTime(after ? 380 : 500 + 7500 * d ** 1.5, ac.currentTime, 0.8);

    // the building, the tubes, the room
    this.level('building', play ? 0.09 : det ? 0.04 : 0, 0.5);
    this.level('hum', play && !inRoom ? 0.04 + 0.22 * clamp01(lit * 1.3) : inRoom ? 0.03 : 0, 3);
    if (this.loops.hum && Math.random() < 0.01) this.loops.hum.src.playbackRate.setTargetAtTime(rnd(0.97, 1.03), ac.currentTime, 1.5);
    this.level('roomTone', inRoom || det ? 0.35 : 0, 2);
    this.level('heart', play && (P.hidden || d > 0.78) ? 0.32 : 0, 1);
    this.level('snore', det && S.detention.snore ? 0.6 : 0, 4);
    this.level('bell', bell && play ? 0.42 : 0, 3);

    // a lesson: chalk while she writes, every pencil scratching; all of it cut dead the moment she turns
    const chalking = lesson === 'handin' && (Lz.phase === 'chalk' || Lz.phase === 'slow');
    this.level('chalk', chalking ? (Lz.phase === 'slow' ? 0.35 : 0.6) : 0, chalking ? 6 : Infinity);
    if (this.loops.chalk && chalking) this.loops.chalk.src.playbackRate.setTargetAtTime(Lz.phase === 'slow' ? 0.62 : 1, ac.currentTime, 0.1);
    const scratching = (lesson === 'handin' && !looking) || lesson === 'eyes';
    for (let i = 0; i < 4; i++) this.level(`pencil${i}`, scratching ? 0.14 : 0, scratching ? 3 : Infinity);
    this.hymnTo(lesson === 'handin' ? Lz.hymn : 0, lesson === 'handin', !!st?.roll.twists.includes('lightsOut'));
    this.storyTo(lesson === 'story' ? Math.max(0, (Lz.line - 1) * Lz.lineEvery + (Lz.lineEvery - Lz.lineT)) : 0, lesson === 'story');

    // through a closed door: the room you're walking up to, muffled; a class facing the wall is silent
    let leak = null, ld = 99;
    if (play && !inRoom) for (const r of Object.values(S.rooms)) {
      if (r.state !== 'idle' || r.floor !== P.floor || S.doors[r.doorId]?.open) continue;
      const dd = Math.hypot(r.frame.cx - P.x, r.frame.cz - P.z) - 3;
      if (dd < ld) { ld = dd; leak = r; }
    }
    const lv = leak ? 0.4 * clamp01((8 - ld) / 6) : 0, ls = leak?.scene || 'lesson', ll = leak?.roll.lesson;
    this.level('leakPencil', ls === 'lesson' && ll !== 'story' ? lv : 0, 2);
    this.level('leakChalk', ls === 'lesson' && ll === 'handin' ? lv * 0.8 : 0, 2);
    this.level('leakStory', ls === 'lesson' && ll === 'story' ? lv * 1.2 : 0, 2);
    this.level('leakBox', ls === 'loneChild' ? lv * 0.7 : 0, 2);

    // him: footsteps and the cane from where he walks, his keys in his hand; still keys = listening
    if (active && !['stoop', 'pinStar', 'glimpse'].includes(H.state)) {
      const moved = this.hmPrev ? Math.hypot(H.x - this.hmPrev.x, H.z - this.hmPrev.z) : 0;
      this.hmStep = (this.hmStep || 0) + moved;
      const at = { x: H.x, y: H.floor * FLOOR_H + 0.2, z: H.z };
      const stride = H.state === 'chase' ? 1.4 : 0.95;
      if (this.hmStep > stride) {
        this.hmStep = 0; this.hmN = (this.hmN || 0) + 1;
        this.voice('sfx_footsteps_headmaster', { offset: HM_STEPS[Math.floor(Math.random() * HM_STEPS.length)], dur: 0.45, rate: rnd(0.95, 1.03), vol: 1.1, at, hrtf: true, bus: this.hmBus, wet: 0.3 });
        if (this.hmN % 2 === 0 && H.state !== 'chase') this.voice('sfx_cane_taps', { offset: CANE_TAPS[Math.floor(Math.random() * 3)], dur: 0.8, vol: 0.9, at, hrtf: true, bus: this.hmBus, wet: 0.35 });
      }
      this.keysT = (this.keysT ?? 0) - 1 / 60;
      if (moved > 0.004 && this.keysT <= 0) {
        const len = rnd(1.2, 2.2);
        this.keysT = len * 0.9;
        this.voice('sfx_keys_jangle', { offset: rnd(0, 24), dur: len, vol: 0.55, at: { x: H.x, y: H.floor * FLOOR_H + 1.1, z: H.z }, hrtf: true, bus: this.hmBus, fadeIn: 0.1 });
      }
    }
    this.hmPrev = { x: H.x, z: H.z };
  }

  // what the events sound like
  event(e, S) {
    if (!this.ctx) return;
    const P = S.player, H = S.headmaster, here = (x, z, floor = P.floor, y = 1) => ({ x, y: floor * FLOOR_H + y, z });
    const hmAt = () => here(H.x, H.z, H.floor, 1.2);
    switch (e.type) {
      case 'step':
        this.voice(pick('sfx_step_paper', 4), { vol: e.run ? 0.55 : e.crouch ? 0.12 : 0.32, rate: P.inStair ? 0.8 : rnd(0.95, 1.05), wet: P.inStair ? 0.4 : 0.05 });
        break;
      case 'chalkSlow': this.voice('chalk_stop', { vol: 0.45, rate: 0.8 }); break;
      case 'teacherLooks': case 'studentsLook': this.voice('chalk_stop', { vol: 0.7 }); break;
      case 'paperTaken': this.voice(pick('paper_pick', 3), { vol: 0.75 }); break;
      case 'stackDelivered': case 'starEarned': this.voice('stamp', { vol: 0.9 }); break;
      case 'roomEnter': this.voice('sfx_door_creak', { dur: 1.3, vol: 0.45, wet: 0.2, rate: rnd(0.95, 1.08) }); break;
      case 'roomLeave': case 'doorClose': this.voice('door_shut', { vol: 0.6, wet: 0.2 }); break;
      case 'doorLocked': case 'lockedIn': this.voice('sfx_door_slam', { dur: 2.5, vol: 0.8, wet: 0.3 }); this.voice('door_lock', { vol: 0.8, delay: 0.4 }); break;
      case 'doorChalked': case 'lineWritten': this.voice('sfx_chalk_writing_loop', { offset: rnd(0, 36), dur: 1.2, vol: 0.6 }); break;
      case 'hide': this.voice('sfx_locker_metal', { offset: LOCKER.open, dur: 1.1, vol: 0.6 }); this.voice('sfx_locker_metal', { offset: LOCKER.shut, dur: 1.0, vol: 0.55, delay: 0.35 }); break;
      case 'unhide': this.voice('sfx_locker_metal', { offset: LOCKER.open, dur: 1.1, vol: 0.5 }); break;
      case 'hmOpenLocker': this.voice('sfx_locker_metal', { offset: LOCKER.rattle, dur: 1.6, vol: 1, at: hmAt(), hrtf: true, bus: this.hmBus }); break;
      case 'hmLightDie': this.voice('light_clunk', { vol: 0.8 }); this.voice('sfx_light_flicker', { vol: 0.5, wet: 0.2 }); break;
      case 'hmArrive': this.voice('sfx_keys_jangle', { offset: rnd(0, 24), dur: 2.5, vol: 0.5, at: hmAt(), hrtf: true, bus: this.hmBus, lp: 1800 }); break;
      case 'hmSee': this.silence(0.45); setTimeout(() => this.sting(1), 420); break;
      case 'hmCatch': case 'followerCatch': this.silence(0.3); setTimeout(() => { this.sting(1.2); this.voice('sfx_paper_tear', { vol: 0.9 }); }, 250); break;
      case 'followerAppears': this.voice('sfx_footsteps_stairs_stone', { offset: rnd(0, 22), dur: 1.6, vol: 0.7, at: here(P.x - Math.sin(P.yaw) * -0.7, P.z - Math.cos(P.yaw) * -0.7, P.floor, 0.2), hrtf: true, wet: 0.5 }); break;
      case 'hmStoop': this.voice('stinger_rush', { vol: 0.6 }); this.voice('sfx_whispers', { offset: rnd(0, 26), dur: 1.4, vol: 0.4 }); break;
      case 'seenMoving': this.voice('crack_chorus', { vol: 0.35 }); break;
      case 'teacherApproaches': this.voice('chair_scrape', { vol: 0.8, wet: 0.2 }); break;
      case 'nearlySeen': this.voice('sfx_whispers', { offset: rnd(0, 26), dur: 1.0, vol: 0.25, lp: 2500 }); break;
      case 'lessonDoom':
        this.silence(0.7);
        setTimeout(() => this.voice('crack_chorus', { vol: 1 }), 550);
        setTimeout(() => { this.voice('sfx_shriek_teacher', { vol: 1, rate: 1.18, wet: 0.3 }); this.voice('sfx_paper_tear', { vol: 0.8 }); this.sting(0.8); }, 1200);
        break;
      case 'edgeThing': {
        const behind = here(P.x + Math.sin(P.yaw) * 1.2, P.z + Math.cos(P.yaw) * 1.2, P.floor, 1.3);
        if (e.kind === 'whisper' || e.kind === 'lie') { this.voice('whisper_name', { vol: 0.5, at: behind, hrtf: true }); this.voice('sfx_whispers', { offset: rnd(0, 26), dur: 1.6, vol: 0.35, at: behind, hrtf: true }); }
        else if (e.kind === 'breath') this.voice('sfx_whispers', { offset: rnd(0, 26), dur: 2.2, vol: 0.22, lp: 900, at: behind, hrtf: true });
        else if (e.kind === 'footsteps') this.voice('sfx_footsteps_headmaster', { offset: HM_STEPS[2], dur: 2.2, vol: 0.5, at: behind, hrtf: true, rate: 1.15 });
        else if (e.kind === 'standUp') this.voice('chair_scrape', { vol: 0.7 });
        else if (e.kind === 'flicker') this.voice('sfx_light_flicker', { vol: 0.6 });
        else if (e.kind === 'hand') this.voice('sfx_paper_tear', { vol: 0.25, lp: 1500 });
        break;
      }
      case 'pageFound': case 'storyPageFound': {
        // a memory: the music box and the choir, far away, and under it a fire, then gone
        this.voice('sfx_paper_tear', { vol: 0.8 });
        this.excerpt('music_memory_music_box_choir', { offset: rnd(0, 120), dur: 9, vol: 0.55, lp: 2200, fadeIn: 1.2, bus: this.scoreBus });
        this.voice('amb_memory_fire_loop', { offset: rnd(0, 25), dur: 8, vol: 0.4, lp: 600, fadeIn: 5 });
        break;
      }
      case 'drawerOpened': case 'drawerStuck': this.voice('desk_lid', { vol: 0.7 }); break;
      case 'linesReset': this.voice('stinger_rush', { vol: 0.6 }); break;
      case 'detentionStart': this.voice('sfx_door_slam', { dur: 2.5, vol: 0.9, wet: 0.4 }); break;
      case 'exitFail': this.voice('sfx_door_creak', { dur: 2, vol: 0.9 }); setTimeout(() => { this.voice('sfx_door_slam', { dur: 2.5, vol: 1, wet: 0.4 }); this.sting(0.7); }, 900); break;
      case 'expelled': this.silence(1.2); this.sting(1); break;
      case 'trueEnding':
        this.silence(3);
        this.excerpt('music_pa_hymn_holy_holy_holy', { offset: 150, dur: 16, vol: 0.5, fadeIn: 3, delay: 1.5, bus: this.scoreBus });
        setTimeout(() => this.voice('sfx_bell_school_ring', { vol: 0.8 }), 16000);
        break;
      case 'homeTime':
        // the sound that meant death now means release: one ring, dry, outdoors; children playing far off
        this.level('bell', 0, Infinity); this.silence(2);
        this.voice('sfx_bell_school_ring', { vol: 0.8 });
        this.excerpt('amb_ending_playground_loop', { offset: 3, dur: 30, vol: 0.18, lp: 1400, fadeIn: 3, delay: 1.5 });
        break;
      case 'hallDoor': this.voice('sfx_keys_jangle', { offset: rnd(0, 24), dur: 1.2, vol: 0.6, rate: 0.7 }); this.excerpt('music_pa_hymn_holy_holy_holy', { lp: 500, offset: rnd(20, 180), dur: 6, vol: 0.3, fadeIn: 1.5 }); break;
      case 'theyTurn': this.silence(0.4); setTimeout(() => { this.voice('crack_chorus', { vol: 1 }); this.sting(0.9); }, 380); break;
      case 'loneChildSpeaks': this.voice('sfx_whispers', { offset: rnd(0, 26), dur: 1.2, vol: 0.12, lp: 1800 }); break;
      case 'sceneEnter': if (e.scene === 'loneChild') this.excerpt('music_this_old_man_dark', { offset: 0, dur: 14, vol: 0.3, lp: 3000, fadeIn: 2, bus: this.scoreBus }); break;
      case 'pa': this.ambient({ kind: 'paClick' }); break;
      case 'ambient': this.ambient(e); break;
      case 'falseScare': this.falseScare(e); break;
      case 'phase': if (e.phase === 'peak') this.silence(1.2); break;
      default: break;
    }
  }

  // the school going on around you, out of sight (the director's ambient deck)
  ambient(e) {
    const at = { x: e.x, y: (e.floor ?? 0) * FLOOR_H + 1, z: e.z }, far = { at, wet: 0.5, lp: 2600 };
    switch (e.kind) {
      case 'deskLid': this.voice('desk_lid', { ...far, vol: 0.6 }); break;
      case 'chairAbove': this.voice('chair_scrape', { ...far, vol: 0.7, lp: 700 }); break;
      case 'doorAhead': this.voice('sfx_door_creak', { ...far, dur: 2.5, vol: 0.6 }); break;
      case 'coatFall': this.voice('sfx_paper_tear', { ...far, vol: 0.35, lp: 900 }); break;
      case 'keysFar': this.voice('sfx_keys_jangle', { ...far, offset: rnd(0, 24), dur: 2, vol: 0.4, lp: 1500 }); break;
      case 'hymnFar': this.excerpt('music_pa_hymn_holy_holy_holy', { lp: 800, offset: rnd(20, 180), dur: 7, vol: 0.22, fadeIn: 2 }); break;
      case 'register': this.voice('sfx_story_fierce_bad_rabbit', { at, wet: 0.7, lp: 1100, offset: rnd(2, 55), dur: 2.5, vol: 0.35, rate: 0.9 }); break;
      case 'laugh': this.voice('sfx_doll_twinkle_1890', { at, wet: 0.6, lp: 2400, offset: rnd(0, 14), dur: 2.2, vol: 0.4 }); break;
      case 'piano': this.voice('sfx_music_box_this_old_man', { at, wet: 0.6, offset: rnd(0, 12), dur: 3, vol: 0.4, rate: 0.82 }); break;
      case 'dinnerBell': this.voice('sfx_bell_school_ring', { at, wet: 0.6, lp: 1200, dur: 3, vol: 0.4 }); break;
      case 'paClick': this.synth({ f: 1800, noise: true, q: 2, dur: 0.05, vol: 0.4 }); this.synth({ f: 50, type: 'sawtooth', dur: 1.2, vol: 0.05, lp: 300, delay: 0.05 }); this.synth({ f: 1800, noise: true, q: 2, dur: 0.05, vol: 0.4, delay: 1.3 }); break;
      case 'ballStairs': for (let i = 0; i < 7; i++) this.synth({ f: 160 - i * 8, f2: 70, dur: 0.14, vol: 0.32 * (1 - i * 0.11), at, delay: i * 0.42 * Math.pow(0.86, i) + i * 0.05, lp: 900 }); break;
      case 'tap': for (let i = 0; i < 5; i++) this.synth({ f: 1400, f2: 900, dur: 0.08, vol: 0.12, at, delay: i * rnd(0.9, 1.4) }); break;
      case 'phone': for (let r = 0; r < 2; r++) for (const f of [400, 450]) this.synth({ f, type: 'square', dur: 0.9, vol: 0.05, at, delay: r * 2.6, lp: 1600 }); break;
      case 'whistle': this.synth({ f: 1900, f2: 2400, type: 'triangle', dur: 0.5, vol: 0.12, at }); this.synth({ f: 2400, f2: 1700, type: 'triangle', dur: 0.6, vol: 0.12, at, delay: 0.55 }); break;
      default: break;
    }
  }

  // a release after a build that nothing paid off: loud, close, and nothing
  falseScare(e) {
    const P = { x: e.x, y: 1, z: e.z };
    switch (e.kind) {
      case 'radiatorBang': this.synth({ f: 220, noise: true, q: 6, dur: 0.6, vol: 0.9, at: P }); this.synth({ f: 90, type: 'sine', f2: 50, dur: 0.5, vol: 0.5 }); break;
      case 'coatFalls': this.voice('sfx_paper_tear', { vol: 0.8, rate: 0.7 }); this.synth({ f: 80, f2: 40, dur: 0.3, vol: 0.5 }); break;
      case 'skeletonSwings': this.voice('sfx_keys_jangle', { offset: rnd(0, 24), dur: 1.2, vol: 0.8, rate: 0.6 }); break;
      case 'cutout': this.voice('sfx_door_slam', { dur: 1.5, vol: 0.6, rate: 1.2 }); break;
      case 'hamster': for (let i = 0; i < 3; i++) this.synth({ f: 3200, f2: 2600, type: 'triangle', dur: 0.07, vol: 0.12, delay: i * 0.12 }); break;
      default: break;
    }
  }
}
