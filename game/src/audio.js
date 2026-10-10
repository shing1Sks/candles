// The sound of the house. Recorded beds and foley (public/audio, see public/audio/CREDITS.md) layered over
// WebAudio synthesis. Samples load when start() is called; anything that fails to load falls back to the
// synthesised version, and nothing in here is allowed to throw into the game.
//
// Mix: master <- world (everything in the house; muffled while you hide in a wardrobe)
//             <- music (three slow beds: drone always, threat when it hunts or is near, a harder layer in a chase)
//             <- kid   (your heartbeat and breath, never muffled)
const BASE = ((typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/') + 'audio/';

// one-shots and short loops: decoded into buffers
const FILES = {
  roomTone: 'room_tone.ogg', hum: 'amb_fluorescent_hum_loop.ogg', snore: 'sfx_snore_loop.ogg', kidBreath: 'breath_kid_loop.ogg',
  heart: 'heartbeat_beats.ogg', heavy: 'sfx_footsteps_headmaster.ogg', concrete: 'step_concrete.ogg', creak: 'creak_boards.ogg',
  growl: 'cat_growl.ogg', stinger: 'sfx_stinger_dark.ogg', rush: 'stinger_rush.ogg', scream: 'sfx_shriek_teacher.ogg',
  doorOpen: 'door_open.ogg', doorShut: 'door_shut.ogg', doorCreak: 'sfx_door_creak.ogg', doorSlam: 'sfx_door_slam.ogg',
  wardrobe: 'door_creak.ogg', musicBox: 'sfx_music_box_this_old_man.ogg', doll: 'sfx_doll_twinkle_1890.ogg',
  whispers: 'sfx_whispers.ogg', laugh: 'child_laugh.ogg', drips: 'drips.ogg',
};
// long beds: streamed through media elements (decoding minutes of stereo would cost hundreds of MB)
const STREAMS = { wind: 'amb_wind_building_loop.ogg', drone: 'music_corridor_drone_1.ogg', threat: 'music_dread_mid.ogg', chase: 'music_dread_high.ogg' };

// where single hits start inside the recordings (seconds, found by onset analysis)
const HEART = [0.86, 1.69, 2.48, 3.34]; // lub-dub pairs
const HEAVY = [0.08, 0.83, 1.46, 2.06, 2.69, 3.25, 3.88, 4.58, 5.18, 5.87, 6.5, 7.22, 7.86]; // a man on a wooden floor
const CONC = [0.03, 0.4, 0.74, 1.1, 1.44, 1.81, 2.14, 2.51, 2.85, 3.21, 3.56, 3.92, 4.27, 4.64, 4.99, 5.35, 5.71, 6.06];
const CREAK = [0.52, 1.32, 1.78, 2.81, 3.38, 4.62, 5.58, 6.1, 6.91, 7.46, 8.31, 9.64, 10.06, 11.04];

const CHASE = new Set(['hunt', 'chase', 'windup', 'lunge', 'fury']);
const MAXV = 40; // cap on concurrent one-shot voices
const clamp = (v, a = -1, b = 1) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const pickOf = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function createAudio() {
  let R = { x: 1, z: 0 }, ctx = null;
  let master, world, worldLP, music, kidBus, noise;
  const buf = {}, ready = {}, st = {};
  let voices = 0, nextBeat = 0, beatI = 0, curG = null, ended = false, nextHaunt = 0, lastHaunt = '', lastSting = -99, lastScream = -99;
  let giantPhase = 0, roomsFor = null, roomC = [];
  // persistent layers
  let synthDrone, hissG, mBreath, mBreathLP, mBreathPan, mBreathRec = false, giantG, giantLP, beamG, beamLP, beamPan, humSrc, whine, whineG;
  let blowGain, kBreath, kBreathRec = false;
  const errs = [];
  function report(err) { // swallowed so the game never breaks, but visible to whoever is debugging
    if (errs.length < 20) errs.push(String(err && err.stack || err));
    if (errs.length <= 3) console.warn('[audio]', err);
  }
  if (typeof window !== 'undefined') {
    window.__audio = { get errors() { return errs.slice(); }, get loaded() { return Object.keys(buf); }, get voices() { return voices; }, get state() { return ctx ? ctx.state : 'off'; },
      get streams() { return Object.fromEntries(Object.entries(st).filter(([, v]) => v && v.el).map(([k, v]) => [k, v.ok && !v.el.paused])); },
      hauntSoon() { nextHaunt = 0; lastHaunt = ''; } };
  }

  // ---------- small helpers ----------
  function aim(p, v, up = 0.1, down = up) {
    const prev = p._v === undefined ? p.value : p._v;
    if (p._v !== undefined && Math.abs(prev - v) <= 1e-4 + Math.abs(v) * 0.004) return;
    p.setTargetAtTime(v, ctx.currentTime, v > prev ? up : down);
    p._v = v;
  }
  function track(src, last) {
    voices++;
    src.onended = () => { voices--; try { last.disconnect(); } catch (e) { /* gone */ } };
  }
  function noiseBuffer() {
    const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  function env(g, t, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }
  function noiseHit({ t = ctx.currentTime, type = 'bandpass', f = 1000, q = 1, peak = 0.2, a = 0.004, dec = 0.08, pan = 0, dest = world, f2 }) {
    if (voices >= MAXV || peak < 0.002) return;
    const s = ctx.createBufferSource(); s.buffer = noise;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + a + dec);
    const g = ctx.createGain(), p = ctx.createStereoPanner(); p.pan.value = clamp(pan);
    env(g, t, a, peak, dec);
    s.connect(fl).connect(g).connect(p).connect(dest);
    track(s, p);
    s.start(t, Math.random() * 1.5); s.stop(t + a + dec + 0.05);
  }
  function tone({ t = ctx.currentTime, type = 'sine', f = 60, f2, peak = 0.3, a = 0.005, dec = 0.15, pan = 0, dest = world, lp }) {
    if (voices >= MAXV || peak < 0.002) return;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + a + dec);
    const g = ctx.createGain(), p = ctx.createStereoPanner(); p.pan.value = clamp(pan);
    env(g, t, a, peak, dec);
    let n = o;
    if (lp) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; n = o.connect(fl); }
    n.connect(g).connect(p).connect(dest);
    track(o, p);
    o.start(t); o.stop(t + a + dec + 0.05);
  }
  // a rubber squeak: a reedy tone sliding f0 -> f1 -> f2 with a fast flutter
  function squeal({ t = ctx.currentTime, f0, f1, f2, dur = 0.18, peak = 0.08, pan = 0, lp = 4000, dest = world }) {
    if (voices >= MAXV) return;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.35);
    o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = rnd(28, 42); lg.gain.value = f1 * 0.04;
    lfo.connect(lg).connect(o.frequency);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f1 * 1.3; bp.Q.value = 2.5;
    const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp;
    const g = ctx.createGain(), p = ctx.createStereoPanner(); p.pan.value = clamp(pan);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.015);
    g.gain.setValueAtTime(peak, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(bp).connect(fl).connect(g).connect(p).connect(dest);
    track(o, p);
    o.start(t); lfo.start(t); o.stop(t + dur + 0.03); lfo.stop(t + dur + 0.03);
    noiseHit({ t, f: f1 * 2, q: 3, peak: peak * 0.25, a: 0.01, dec: dur * 0.8, pan, dest }); // the air through the squeaker
  }
  // a recorded one-shot (or a slice of one). Returns false if the sample isn't there, so callers can synthesise.
  function play(name, o = {}) {
    const b = buf[name];
    if (!b || (voices >= MAXV && !o.must)) return false;
    const t = o.t ?? ctx.currentTime, rate = o.rate || 1;
    const off = clamp(o.off || 0, 0, b.duration - 0.02);
    const len = Math.max(0.02, Math.min(o.dur ?? b.duration - off, b.duration - off) / rate);
    const s = ctx.createBufferSource(); s.buffer = b;
    s.playbackRate.setValueAtTime(rate, t);
    if (o.rateTo) s.playbackRate.linearRampToValueAtTime(o.rateTo, t + len);
    let n = s;
    if (o.hp) { const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = o.hp; n = n.connect(f); }
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; n = n.connect(f); }
    const g = ctx.createGain(), peak = o.gain ?? 1, att = Math.min(o.att ?? 0.006, len * 0.3), fo = Math.min(o.fade ?? 0.03, len * 0.5);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + att);
    g.gain.setValueAtTime(peak, t + Math.max(att, len - fo));
    g.gain.linearRampToValueAtTime(0, t + len);
    let last = n.connect(g);
    if (o.pan) { const p = ctx.createStereoPanner(); p.pan.value = clamp(o.pan); last = last.connect(p); }
    last.connect(o.dest || world);
    track(s, last);
    s.start(t, off); s.stop(t + len + 0.02);
    return true;
  }
  function slice(name, starts, len, o) { return play(name, { ...o, off: pickOf(starts), dur: len }); }
  function loopInto(name, dest, rate = 1) {
    const go = () => {
      const s = ctx.createBufferSource(); s.buffer = buf[name]; s.loop = true; s.playbackRate.value = rate;
      s.connect(dest); s.start(0, Math.random() * buf[name].duration);
      return s;
    };
    return new Promise((res) => { if (buf[name]) res(go()); else (ready[name] ||= []).push(() => res(go())); });
  }
  function load(name, file) {
    fetch(BASE + file)
      .then((r) => (r.ok && !/text\/html/.test(r.headers.get('content-type') || '') ? r.arrayBuffer() : Promise.reject(new Error(file))))
      .then((ab) => ctx.decodeAudioData(ab))
      .then((b) => { buf[name] = b; for (const f of ready[name] || []) { try { f(); } catch (e) { /* ignore */ } } ready[name] = null; })
      .catch(() => { /* stays synthesised */ });
  }
  function stream(file, dest, vol) {
    try {
      const el = new Audio(); el.src = BASE + file; el.loop = true; el.preload = 'auto';
      const g = ctx.createGain(); g.gain.value = vol;
      ctx.createMediaElementSource(el).connect(g).connect(dest);
      el.addEventListener('loadedmetadata', () => { try { el.currentTime = Math.random() * el.duration * 0.7; } catch (e) { /* ignore */ } }, { once: true });
      const s = { el, g, ok: false };
      el.addEventListener('playing', () => { s.ok = true; }, { once: true });
      el.play().catch(() => {});
      return s;
    } catch (e) { return null; }
  }

  // ---------- space ----------
  function panAt(x, z, k) { return clamp(((x - k.x) * R.x + (z - k.z) * R.z) / 7); }
  function at(G, x, z) {
    const k = G.kid;
    let muff = false;
    try { muff = G.los ? !G.los(k.x, k.z, x, z) : false; } catch (e) { /* ignore */ }
    return { pan: panAt(x, z, k), d: Math.hypot(x - k.x, z - k.z), muff };
  }
  function rooms(G) {
    if (roomsFor === G.L) return roomC;
    roomsFor = G.L; const L = G.L, acc = [];
    if (L && L.room) {
      for (let z = 0; z < L.h; z++) for (let x = 0; x < L.w; x++) {
        const r = L.room[z * L.w + x];
        if (r >= 0) { const a = (acc[r] ||= [0, 0, 0]); a[0] += x + 0.5; a[1] += z + 0.5; a[2]++; }
      }
    }
    roomC = acc.map((a) => a && { x: a[0] / a[2], z: a[1] / a[2] });
    return roomC;
  }
  const vol = (d) => 1 / (1 + d * 0.35);

  // ---------- the mix when a run starts / ends ----------
  function newRun() {
    ended = false;
    const t = ctx.currentTime;
    for (const [g, v] of [[world.gain, 1], [music.gain, 1], [kidBus.gain, 1]]) { g.cancelScheduledValues(t); g.setTargetAtTime(v, t, 0.4); g._v = v; }
    nextHaunt = t + rnd(25, 45);
  }
  function fadeOut(wv, mv, kv, tc) {
    const t = ctx.currentTime;
    for (const [g, v] of [[world.gain, wv], [music.gain, mv], [kidBus.gain, kv]]) { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.setTargetAtTime(v, t, tc); g._v = v; }
  }
  function scream(t) {
    if (t - lastScream < 1.5) return;
    lastScream = t;
    if (!play('scream', { t: t + 0.05, rate: 1.22, gain: 0.55, hp: 300, dest: master, must: true })) {
      for (const f of [880, 1240]) tone({ t, type: 'sawtooth', f, f2: f * 1.4, peak: 0.05, a: 0.02, dec: 0.8, dest: master });
    }
  }
  function sting(t, gain, must) {
    if (!must && t - lastSting < 25) return false;
    lastSting = t;
    return play('stinger', { t, gain, dur: 4.5, fade: 2, dest: master, must: true });
  }

  // ---------- little haunts: something far off in the house, now and then ----------
  function haunt(G) {
    const k = G.kid, rc = rooms(G);
    const spot = (ids) => {
      const c = ids.map((i) => rc[i]).filter(Boolean);
      return c.length ? pickOf(c) : { x: k.x + rnd(-6, 6), z: k.z + rnd(-6, 6) };
    };
    const opts = ['box', 'doll', 'whisper', 'laugh', 'drips', 'creak'].filter((n) => n !== lastHaunt);
    const n = pickOf(opts); lastHaunt = n;
    let p, ok = false;
    switch (n) {
      case 'box': p = at(G, ...xz(spot([0, 4])));
        ok = play('musicBox', { off: rnd(0, 7), dur: rnd(5, 8), rate: rnd(0.86, 0.94), fade: 2.5, att: 1, gain: 0.3 / (1 + p.d * 0.12), lp: p.muff ? 900 : 2400, pan: p.pan }); break;
      case 'doll': p = at(G, ...xz(spot([0])));
        ok = play('doll', { off: rnd(0, 4), dur: 7, fade: 2.5, att: 0.5, gain: 0.26 / (1 + p.d * 0.1), hp: 250, lp: p.muff ? 1000 : 2800, pan: p.pan }); break;
      case 'whisper': // close, behind you, in your ear
        ok = play('whispers', { off: rnd(0, 24), dur: rnd(2.5, 4), fade: 0.9, att: 0.4, gain: 0.2, lp: 3200, pan: (Math.random() < 0.5 ? -1 : 1) * rnd(0.5, 0.9) }); break;
      case 'laugh': p = at(G, ...xz(spot([4, 0, 3])));
        ok = play('laugh', { rate: rnd(0.88, 0.95), gain: 0.2 / (1 + p.d * 0.12), lp: p.muff ? 800 : 1500, hp: 200, fade: 0.8, pan: p.pan }); break;
      case 'drips': p = at(G, ...xz(spot([1, 5])));
        ok = play('drips', { off: rnd(0, 11), dur: 6, fade: 1.5, att: 0.5, gain: 0.45 / (1 + p.d * 0.15), lp: p.muff ? 1200 : 6000, pan: p.pan }); break;
      default: break;
    }
    if (!ok) { // a creak somewhere (also the fallback for anything not loaded)
      const a = Math.random() * Math.PI * 2, x = k.x + Math.cos(a) * rnd(5, 9), z = k.z + Math.sin(a) * rnd(5, 9);
      p = at(G, x, z);
      const g = 0.45 / (1 + p.d * 0.15), t = ctx.currentTime;
      if (!slice('creak', CREAK, 0.6, { rate: rnd(0.6, 0.7), gain: g, lp: p.muff ? 900 : 3000, pan: p.pan })) noiseHit({ type: 'bandpass', f: 520, q: 14, peak: g * 0.4, a: 0.05, dec: 0.5, pan: p.pan });
      slice('creak', CREAK, 0.5, { t: t + rnd(0.5, 0.9), rate: rnd(0.55, 0.65), gain: g * 0.7, lp: p.muff ? 900 : 3000, pan: p.pan });
    }
  }
  const xz = (o) => [o.x, o.z];

  // ---------- every frame ----------
  function tick(G, dt, near) {
    const t = ctx.currentTime, k = G.kid, M = G.monster, B = G.beam;
    if (G !== curG) { curG = G; newRun(); }
    const playing = G.state === 'play';
    const d = Math.hypot(M.x - k.x, M.z - k.z), fear = clamp(k.fear || 0, 0, 1), pan = panAt(M.x, M.z, k);
    const mode = M.mode, hunting = CHASE.has(mode), hidden = k.hidden >= 0;

    // inside a wardrobe the whole house goes thick and far away
    aim(worldLP.frequency, playing && hidden ? 650 : 20000, 0.12);

    // your heartbeat
    if (playing && fear > 0.04 && t >= nextBeat) {
      const bpm = 60 + fear * 95, gap = 60 / bpm, g = (0.1 + fear * 0.6) * (hidden ? 1.25 : 1);
      if (!play('heart', { off: HEART[beatI++ % HEART.length], dur: Math.min(0.72, gap * 0.95), rate: 0.94 + fear * 0.14, gain: g, lp: 900, dest: kidBus, fade: 0.08 })) {
        tone({ t, f: 62, f2: 38, peak: g * 0.6, dec: 0.13, dest: kidBus });
        tone({ t: t + gap * 0.32, f: 55, f2: 34, peak: g * 0.42, dec: 0.12, dest: kidBus });
      }
      nextBeat = t + gap;
    }

    // its breathing: a real snore while it sleeps, pitched-down heavy breath when awake and close
    const asleep = mode === 'sleep';
    const audible = playing || G.state === 'caught' ? Math.max(0, 1 - d / (asleep ? 12 : 8)) : 0;
    if (mBreathRec) {
      aim(mBreath.gain, audible * audible * (asleep ? 0.45 : 0.75), 0.15);
      aim(mBreath._src.playbackRate, asleep ? 0.86 : hunting ? 0.95 : mode === 'breather' ? 0.9 : 0.74, 0.5);
    } else {
      const pulse = 0.5 + 0.5 * Math.sin(t * (mode === 'chase' ? 7 : 2.6));
      aim(mBreath.gain, asleep ? 0 : audible * audible * 0.5 * pulse, 0.05);
    }
    aim(mBreathPan.pan, pan, 0.05);
    aim(mBreathLP.frequency, near ? 2600 : 420, 0.1);

    // the giant above: a huge slow breath that gets heavier while its piece hunts
    const heavy = playing && (hunting || mode === 'search') ? 1 : 0;
    giantPhase += dt * (heavy ? 1 / 4.2 : 1 / 7);
    const f = giantPhase % 1, inhale = Math.max(0, Math.sin(f * Math.PI * 2)), exhale = Math.max(0, -Math.sin(f * Math.PI * 2));
    const gl = (playing ? 1 : 0.4) * (heavy ? 1.0 : 0.5);
    aim(giantG.gain, gl * (inhale * 0.55 + Math.pow(exhale, 0.7)), 0.12);
    aim(giantLP.frequency, (inhale > 0 ? 330 : 210) * (heavy ? 1.3 : 1), 0.3);

    // the searchlight: an electrical hum swelling while it warms up, a thin whine on top, held while on
    let bl = 0;
    if (playing && B) bl = B.state === 'warn' ? clamp(B.t / 1.6, 0, 1) : B.state === 'on' ? 1 : 0;
    aim(beamG.gain, bl * 0.32, 0.25, 0.6);
    if (humSrc) aim(humSrc.playbackRate, 0.55 + bl * 0.45, 0.3);
    aim(whine.frequency, 380 + bl * 1000 + (B && B.spotted && B.state === 'on' ? 500 : 0), 0.4);
    aim(whineG.gain, bl * (bl < 1 ? 0.03 : 0.012), 0.3, 0.6);
    if (B) aim(beamPan.pan, panAt(B.x, B.z, k) * 0.6, 0.2);
    aim(beamLP.frequency, 500 + bl * 3500, 0.3);

    // your breath on the candle
    aim(blowGain.gain, playing && k.blowing >= 0 ? 0.2 : 0, 0.04);
    // your breath in the wardrobe, or panting when it is right behind you
    const kb = !playing ? 0 : hidden ? 0.2 + fear * 0.35 : k.running && fear > 0.55 ? 0.12 * fear : 0;
    if (kBreathRec) aim(kBreath.gain, kb, 0.3);
    else aim(kBreath.gain, kb * 0.3 * (0.5 + 0.5 * Math.sin(t * (2 + fear * 3))), 0.06);

    // music
    if (!ended) {
      let threat = !asleep ? clamp(1 - d / 9, 0, 1) : 0, chase = 0;
      if (mode === 'search' || mode === 'check' || mode === 'ambush') threat = Math.max(threat, 0.55);
      if (hunting) { threat = Math.max(threat, 0.7); chase = 1; }
      if (mode === 'recover') { threat = Math.max(threat, 0.6); chase = 0.45; }
      if (mode === 'breather') { threat *= 0.15; chase = 0; }
      if (!playing) threat = chase = 0;
      if (st.threat) aim(st.threat.g.gain, 0.3 * threat, 1.5, 3.5);
      if (st.chase) aim(st.chase.g.gain, 0.42 * chase, 0.35, 2.5);
      if (st.drone) aim(st.drone.g.gain, mode === 'breather' ? 0.12 : 0.26, 2);
      aim(st.droneLP.frequency, 500 + fear * 3500 + chase * 2000, 1);
      aim(synthDrone.gain, (st.drone && st.drone.ok ? 0.03 : 0.06) * (mode === 'breather' ? 0.5 : 1), 2);
    }

    // now and then, something far off in the house
    if (playing && t >= nextHaunt) {
      if (hunting || mode === 'recover' || fear > 0.55 || hidden) nextHaunt = t + rnd(6, 12);
      else { haunt(G); nextHaunt = t + rnd(40, 90); }
    }
  }

  // ---------- game events ----------
  function onEvent(e, G, near) {
    const k = G.kid, M = G.monster, t = ctx.currentTime;
    const d = Math.hypot(M.x - k.x, M.z - k.z), mpan = panAt(M.x, M.z, k), mv = vol(d), m = near ? 1 : 0.45, mlp = near ? 2600 : 450;
    switch (e.type) {
      // ----- the kid -----
      case 'kstep': {
        const g = e.run ? 0.3 : k.speed < 1.6 ? 0.07 : 0.15;
        if (e.duct) {
          noiseHit({ f: 2600, q: 9, peak: e.run ? 0.08 : 0.04, dec: 0.12 });
          tone({ type: 'triangle', f: 1900 + Math.random() * 600, peak: e.run ? 0.025 : 0.012, dec: 0.2 });
          tone({ f: 180 + Math.random() * 40, f2: 120, peak: 0.04, dec: 0.15 }); // the tin flexing
        } else if (e.crawl) noiseHit({ type: 'lowpass', f: 1400, peak: 0.03, a: 0.03, dec: 0.15 });
        else if (e.room === 5) { if (!slice('concrete', CONC, 0.3, { rate: rnd(1.05, 1.15), gain: g * 1.6, hp: 150 })) noiseHit({ type: 'highpass', f: 1800, peak: g * 0.25, dec: 0.05 }); }
        else if (e.room === 1 || e.room === 2) { if (!slice('concrete', CONC, 0.28, { rate: rnd(1.3, 1.45), gain: g * 1.4, hp: 500 })) noiseHit({ type: 'highpass', f: 2600, peak: g * 0.25, dec: 0.04 }); }
        else if (!slice('heavy', HEAVY, 0.4, { rate: rnd(1.4, 1.55), gain: g, hp: 220, lp: 6000 })) noiseHit({ type: 'highpass', f: e.run ? 1400 : 2200, peak: g * 0.25, dec: e.run ? 0.06 : 0.04 });
        break;
      }
      case 'creak':
        if (!slice('creak', CREAK, 0.6, { rate: rnd(0.68, 0.82), gain: 0.55, lp: 3500 })) noiseHit({ type: 'bandpass', f: 560, f2: 470, q: 14, peak: 0.25, a: 0.04, dec: 0.45 });
        break;
      case 'squeak': {
        const p = at(G, e.x, e.z), g = 1 / (1 + p.d * 0.2);
        if (e.kind === 'duck') {
          squeal({ f0: 1000, f1: 1500, f2: 1150, dur: 0.17, peak: 0.09 * g, pan: p.pan });
          squeal({ t: t + 0.21, f0: 950, f1: 1350, f2: 900, dur: 0.22, peak: 0.07 * g, pan: p.pan });
        } else if (e.kind === 'bear') {
          squeal({ f0: 520, f1: 760, f2: 470, dur: 0.5, peak: 0.1 * g, pan: p.pan, lp: 1800 });
        } else {
          for (let i = 0; i < 16; i++) {
            const tt = t + (i < 8 ? i * 0.022 : 0.26 + (i - 8) * 0.024) + Math.random() * 0.01;
            noiseHit({ t: tt, f: rnd(3200, 6500), q: 7, peak: rnd(0.03, 0.07) * g, dec: 0.025, pan: p.pan });
          }
        }
        break;
      }
      case 'pickup': {
        const kd = e.kind;
        if (kd === 'can') { tone({ f: 2100, peak: 0.03, dec: 0.25 }); tone({ f: 3170, peak: 0.015, dec: 0.18 }); }
        else if (kd === 'bottle') { tone({ f: 2900, peak: 0.025, dec: 0.3 }); tone({ f: 4370, peak: 0.012, dec: 0.2 }); }
        else if (kd === 'ball') tone({ f: 220, f2: 170, peak: 0.06, dec: 0.08 });
        else if (kd === 'car') { for (let i = 0; i < 3; i++) noiseHit({ t: t + i * 0.035, f: 2400, q: 5, peak: 0.03, dec: 0.02 }); noiseHit({ t: t + 0.08, f: 3500, f2: 2500, q: 4, peak: 0.02, a: 0.02, dec: 0.25 }); }
        else noiseHit({ f: 1600, q: 5, peak: 0.07, dec: 0.05 }); // block
        noiseHit({ t: t + 0.04, f: 2500, q: 0.8, peak: 0.015, a: 0.02, dec: 0.12 }); // into your pocket
        break;
      }
      case 'throw':
        noiseHit({ f: 600, f2: 1800, q: 1.2, peak: 0.06, a: 0.03, dec: 0.2 });
        break;
      case 'land': {
        const p = at(G, e.x, e.z), g = 1 / (1 + p.d * 0.15), lp = p.muff ? 900 : 9000, o = { pan: p.pan };
        const hit = (tt, f, q, pk, dec) => noiseHit({ ...o, t: tt, f: Math.min(f, lp), q, peak: pk * g, dec });
        const ping = (tt, f, pk, dec) => { if (f < lp) tone({ ...o, t: tt, f, peak: pk * g, dec }); };
        if (e.kind === 'ball') {
          [0, 0.3, 0.52, 0.67, 0.77].forEach((dt2, i) => { tone({ ...o, t: t + dt2, f: 140, f2: 85, peak: 0.25 * g * 0.7 ** i, dec: 0.08 }); hit(t + dt2, 700, 1, 0.08 * 0.7 ** i, 0.04); });
        } else if (e.kind === 'can') {
          [0, 0.09, 0.17, 0.29, 0.38].forEach((dt2, i) => { const f = rnd(1400, 2600); ping(t + dt2, f, 0.06 * 0.8 ** i, 0.25); ping(t + dt2, f * 1.53, 0.03 * 0.8 ** i, 0.15); hit(t + dt2, 3000, 3, 0.12 * 0.8 ** i, 0.03); });
          noiseHit({ ...o, t: t + 0.4, f: Math.min(2500, lp), q: 2, peak: 0.03 * g, a: 0.1, dec: 0.7 }); // rolling
        } else if (e.kind === 'bottle') {
          [0, 0.13, 0.24].forEach((dt2, i) => { const f = rnd(2600, 3400); ping(t + dt2, f, 0.07 * 0.7 ** i, 0.35); ping(t + dt2, f * 1.5, 0.035 * 0.7 ** i, 0.25); hit(t + dt2, 1800, 2, 0.1 * 0.7 ** i, 0.03); });
          noiseHit({ ...o, t: t + 0.3, f: Math.min(1800, lp), q: 3, peak: 0.025 * g, a: 0.15, dec: 0.9 });
        } else if (e.kind === 'car') {
          [0, 0.07, 0.15].forEach((dt2, i) => hit(t + dt2, 2200, 4, 0.18 * 0.7 ** i, 0.03));
          noiseHit({ ...o, t: t + 0.12, f: Math.min(3800, lp), f2: 1800, q: 6, peak: 0.04 * g, a: 0.05, dec: 0.8 }); // wheels spinning down
        } else { // block
          [0, 0.13, 0.22].forEach((dt2, i) => hit(t + dt2, 1300, 5, 0.3 * 0.55 ** i, 0.07));
        }
        if (e.wall) tone({ ...o, f: 95, f2: 60, peak: 0.2 * g, dec: 0.12 });
        break;
      }
      case 'candleOut': {
        noiseHit({ type: 'highpass', f: 3000, peak: 0.1, a: 0.01, dec: 0.5 });
        noiseHit({ type: 'bandpass', f: 1200, f2: 300, q: 0.7, peak: 0.08, a: 0.02, dec: 0.35 }); // the puff
        tone({ f: 120, f2: 60, peak: 0.12, dec: 0.5 });
        noiseHit({ t: t + 0.25, type: 'highpass', f: 5000, peak: 0.015, a: 0.3, dec: 1.4 }); // smoke
        break;
      }
      case 'hide': {
        if (!play('wardrobe', { off: 0.05, dur: 1.1, rate: 1.15, gain: 0.32, fade: 0.2 })) noiseHit({ f: 700, q: 10, peak: 0.08, a: 0.05, dec: 0.4 });
        if (!play('doorShut', { t: t + 0.55, off: 0.6, dur: 0.8, rate: 1.3, gain: 0.28, lp: 2000 })) tone({ t: t + 0.55, f: 110, f2: 70, peak: 0.1, dec: 0.1 });
        break;
      }
      case 'unhide':
        if (!play('wardrobe', { off: 0.6, dur: 1, rate: 1.25, gain: 0.3, fade: 0.2, dest: master })) noiseHit({ f: 760, q: 10, peak: 0.08, a: 0.05, dec: 0.35, dest: master });
        break;
      case 'blowStart': case 'blowStop': break; // continuous, in update

      // ----- the monster -----
      case 'mstep': {
        const g = mv * m;
        if (!slice('heavy', HEAVY, 0.5, { rate: rnd(0.6, 0.68), gain: 1.1 * g, lp: mlp, pan: mpan, fade: 0.12 })) noiseHit({ type: 'lowpass', f: near ? 700 : 250, peak: 0.3 * g, dec: 0.12, pan: mpan });
        tone({ f: 58, f2: 32, peak: 0.4 * g, dec: 0.2, pan: mpan }); // its weight
        if (e.run) noiseHit({ type: 'bandpass', f: 3200, q: 3, peak: 0.06 * g, dec: 0.08, pan: mpan }); // claws on the boards
        break;
      }
      case 'spotted':
        if (!play('growl', { off: 0.3, rate: 0.5, gain: 0.5 + 0.5 * mv, lp: near ? 3000 : 700, pan: mpan, fade: 0.4 })) {
          noiseHit({ type: 'bandpass', f: 1800, f2: 400, q: 2, peak: 0.25, a: 0.01, dec: 0.9 });
        }
        if (!sting(t, 0.35)) for (const f of [233, 247, 349, 370]) tone({ type: 'sawtooth', f, f2: f * 0.94, peak: 0.035, a: 0.01, dec: 1.4, dest: music, lp: 2500 });
        break;
      case 'lost':
        noiseHit({ type: 'lowpass', f: 600, f2: 180, peak: 0.18 * mv * m, a: 0.12, dec: 0.9, pan: mpan }); // a long frustrated exhale
        break;
      case 'windup':
        if (!play('growl', { off: 0.35, rate: 0.45, rateTo: 0.8, gain: 0.5 + 0.6 * mv, lp: near ? 3500 : 800, pan: mpan, fade: 0.1 })) {
          tone({ type: 'sawtooth', f: 70, f2: 130, peak: 0.25 * mv + 0.05, a: 0.05, dec: 0.25, pan: mpan });
        }
        tone({ type: 'sawtooth', f: 60, f2: 120, peak: 0.12 * mv + 0.03, a: 0.05, dec: 0.3, pan: mpan, lp: 400 });
        break;
      case 'lunge':
        noiseHit({ type: 'bandpass', f: 500, f2: 2400, q: 1, peak: 0.35, a: 0.02, dec: 0.35, pan: mpan });
        play('rush', { rate: 0.9, gain: 0.35, lp: 2500, pan: mpan });
        break;
      case 'wake':
        tone({ f: 46, f2: 40, peak: 0.25, a: 0.4, dec: 2.5 });
        play('growl', { off: 0.3, rate: 0.38, gain: 0.35 * mv + 0.1, lp: 500, pan: mpan, fade: 0.6 });
        break;
      case 'mode':
        if (e.mode === 'breather') noiseHit({ type: 'lowpass', f: 500, f2: 150, peak: 0.12 * mv * m, a: 0.3, dec: 1.6, pan: mpan });
        break;
      case 'door': {
        const dr = G.doors && G.doors[e.id], p = dr ? at(G, dr.x, dr.z) : { pan: 0, d: 0, muff: false }, g = 1 / (1 + p.d * 0.22), lp = p.muff ? 800 : 9000;
        if (e.bash) {
          if (!play('doorSlam', { rate: 0.8, gain: 1.0 * g, lp, pan: p.pan, must: true })) noiseHit({ type: 'lowpass', f: 1200, peak: 0.6 * g, dec: 0.4, pan: p.pan });
          noiseHit({ type: 'highpass', f: 1800, peak: 0.25 * g, a: 0.002, dec: 0.25, pan: p.pan }); // splinters
          tone({ f: 70, f2: 32, peak: 0.6 * g, dec: 0.4, pan: p.pan });
        } else if (e.by === 'monster') {
          if (!play('doorCreak', { off: 0.02, dur: 2, rate: 0.82, gain: 0.55 * g, lp: Math.min(lp, 4000), pan: p.pan, fade: 0.5 })) noiseHit({ f: 480, q: 12, peak: 0.15 * g, a: 0.2, dec: 1, pan: p.pan });
        } else if (e.open) {
          if (!play('doorOpen', { off: 0.2, dur: 2, gain: 0.55 * g, lp, pan: p.pan, fade: 0.5 })) noiseHit({ f: 600, q: 10, peak: 0.12 * g, a: 0.1, dec: 0.6, pan: p.pan });
        } else if (!play('doorShut', { gain: 0.5 * g, lp, pan: p.pan })) tone({ f: 100, f2: 60, peak: 0.25 * g, dec: 0.15, pan: p.pan });
        break;
      }
      case 'doorTry': {
        const dr = G.doors && G.doors[e.id], p = dr ? at(G, dr.x, dr.z) : { pan: mpan, d, muff: !near }, g = 1 / (1 + p.d * 0.22), lp = p.muff ? 700 : 5000;
        if (e.bash) { // it throws itself at it
          for (const tt of [0, 0.42]) {
            tone({ t: t + tt, f: 75, f2: 40, peak: 0.5 * g, dec: 0.25, pan: p.pan });
            noiseHit({ t: t + tt, type: 'lowpass', f: Math.min(900, lp), peak: 0.45 * g, dec: 0.2, pan: p.pan });
            noiseHit({ t: t + tt + 0.01, f: Math.min(3200, lp), q: 6, peak: 0.12 * g, dec: 0.12, pan: p.pan });
          }
          play('growl', { off: 0.3, rate: 0.55, gain: 0.5 * g, lp: Math.min(lp, 2500), pan: p.pan });
        } else { // the handle rattling, the door knocking in its frame
          for (let i = 0; i < 5; i++) {
            const tt = t + i * 0.11 + Math.random() * 0.03;
            noiseHit({ t: tt, f: Math.min(rnd(3000, 4200), lp), q: 8, peak: 0.08 * g, dec: 0.03, pan: p.pan });
            if (i % 2 === 0) noiseHit({ t: tt, f: 380, q: 3, peak: 0.25 * g, dec: 0.06, pan: p.pan });
          }
        }
        break;
      }
      case 'checkOpen': {
        const w = G.wardrobes && G.wardrobes[e.id], p = w ? at(G, w.fx, w.fz) : { pan: mpan, d, muff: !near }, mine = k.hidden === e.id;
        const g = mine ? 0.6 : 0.5 / (1 + p.d * 0.22);
        if (!play('wardrobe', { off: 0.05, dur: 1.6, rate: 0.85, gain: g, lp: p.muff && !mine ? 900 : 5000, pan: mine ? 0 : p.pan, fade: 0.3, dest: mine ? master : world })) {
          noiseHit({ f: 520, q: 12, peak: 0.12 * g, a: 0.2, dec: 0.8, pan: p.pan });
        }
        break;
      }
      case 'checkEmpty': {
        const w = G.wardrobes && G.wardrobes[e.id], p = w ? at(G, w.fx, w.fz) : { pan: mpan, d, muff: !near }, g = 1 / (1 + p.d * 0.22);
        if (!play('doorShut', { off: 0.5, dur: 1.1, rate: 0.9, gain: 0.5 * g, lp: p.muff ? 800 : 5000, pan: p.pan })) tone({ f: 90, f2: 55, peak: 0.2 * g, dec: 0.15, pan: p.pan });
        noiseHit({ t: t + 0.3, type: 'lowpass', f: 500, f2: 200, peak: 0.12 * g, a: 0.06, dec: 0.5, pan: p.pan }); // a snort
        break;
      }
      case 'found':
        worldLP.frequency.cancelScheduledValues(t); worldLP.frequency.setValueAtTime(20000, t); worldLP.frequency._v = 20000;
        play('wardrobe', { off: 0.6, dur: 0.6, rate: 1.6, gain: 0.6, dest: master, must: true });
        play('growl', { off: 0.3, rate: 0.6, gain: 0.9, dest: master, must: true });
        break;
      case 'caught':
        scream(t);
        sting(t, 0.5, true);
        play('growl', { off: 0.3, rate: 0.5, gain: 0.7, dest: master, must: true });
        for (const f of [110, 116, 164, 233]) tone({ type: 'sawtooth', f, f2: f * 0.5, peak: 0.1, a: 0.005, dec: 1.6, dest: master, lp: 2500 });
        noiseHit({ type: 'lowpass', f: 3000, f2: 200, peak: 0.6, a: 0.005, dec: 1.2, dest: master });
        ended = true;
        fadeOut(0.25, 0, 0, 0.8);
        break;
      case 'won':
        ended = true;
        fadeOut(0, 0, 0, 1.1);
        // one soft, bell-like note in the dark
        tone({ t: t + 1.8, f: 392, peak: 0.07, a: 0.02, dec: 4.5, dest: master });
        tone({ t: t + 1.8, f: 392 * 2.76, peak: 0.012, a: 0.02, dec: 2, dest: master });
        tone({ t: t + 1.85, f: 196, peak: 0.035, a: 0.2, dec: 5, dest: master });
        break;

      case 'yell': // the monster stops and roars: anger boiling over
        if (!play('growl', { off: 0.2, rate: 0.55, gain: 0.85, lp: 1600, dest: master, fade: 0.5, must: true })) {
          tone({ type: 'sawtooth', f: 90, f2: 55, peak: 0.16, a: 0.08, dec: 1.0, dest: master, lp: 700 });
        }
        tone({ t: t + 0.05, type: 'sawtooth', f: 60, f2: 44, peak: 0.08, a: 0.2, dec: 1.2, dest: master, lp: 300 });
        break;

      // ----- the giant across the table -----
      case 'slam': {
        const ti = t + 0.6; // its fist lands
        tone({ t: ti, f: 50, f2: 24, peak: 0.85, a: 0.004, dec: 1.8, dest: master });
        noiseHit({ t: ti, type: 'lowpass', f: 420, f2: 70, peak: 0.6, a: 0.003, dec: 1.2, dest: master });
        play('doorSlam', { t: ti, rate: 0.42, gain: 0.8, lp: 1100, dest: master, must: true });
        for (let i = 0; i < 9; i++) noiseHit({ t: ti + 0.04 + Math.random() * 0.45, f: rnd(1800, 5000), q: 6, peak: rnd(0.015, 0.04), dec: 0.03, pan: rnd(-0.8, 0.8) }); // everything on the table jumps
        // and a low roar from up there
        if (!play('growl', { t: t + 0.45, off: 0.3, rate: 0.3, gain: 0.7, lp: 600, dest: master, fade: 0.8, must: true })) {
          tone({ t: t + 0.45, type: 'sawtooth', f: 48, f2: 38, peak: 0.12, a: 0.3, dec: 2.2, dest: master, lp: 300 });
        }
        tone({ t: t + 0.5, type: 'sawtooth', f: 42, f2: 36, peak: 0.07, a: 0.4, dec: 2.4, dest: master, lp: 250 });
        break;
      }
      case 'beam': // a relay clunks somewhere above, then the light warms up (the hum is in update)
        noiseHit({ type: 'lowpass', f: 300, peak: 0.18, a: 0.003, dec: 0.15 });
        noiseHit({ t: t + 0.03, f: 2400, q: 6, peak: 0.04, dec: 0.03 });
        break;
      case 'reach': { // the giant lets go of its controller and leans over the house: the table groans
        play('creak', { rate: 0.35, gain: 0.5, lp: 700, dest: master, fade: 0.6, must: true });
        tone({ type: 'sawtooth', f: 38, f2: 30, peak: 0.08, a: 0.8, dec: 2.0, dest: master, lp: 220 });
        noiseHit({ type: 'lowpass', f: 600, f2: 150, peak: 0.12, a: 1.2, dec: 1.0, dest: master }); // air pushed down ahead of the hand
        break;
      }
      case 'grab': // the hand hits the floor and closes
        tone({ f: 46, f2: 26, peak: 0.6, a: 0.004, dec: 0.8, dest: master });
        noiseHit({ type: 'lowpass', f: 900, f2: 120, peak: 0.45, a: 0.003, dec: 0.5, dest: master });
        for (let i = 0; i < 5; i++) noiseHit({ t: t + 0.03 + Math.random() * 0.2, f: rnd(1500, 4000), q: 5, peak: rnd(0.02, 0.05), dec: 0.04, pan: rnd(-0.6, 0.6) });
        break;
      case 'beamSpot':
        if (!sting(t, 0.45, true)) tone({ type: 'sawtooth', f: 1800, f2: 2600, peak: 0.04, a: 0.01, dec: 0.6, dest: master, lp: 4000 });
        noiseHit({ type: 'highpass', f: 2500, peak: 0.12, a: 0.005, dec: 0.4, dest: master });
        tone({ f: 70, f2: 40, peak: 0.35, dec: 0.5, dest: master });
        break;
    }
  }

  return {
    get on() { return !!ctx; },
    setRight(r) { if (r) R = r; },
    start() {
      if (ctx) {
        // started earlier without a user gesture (a gamepad): wake it up now that we have one
        try {
          if (ctx.state === 'suspended') ctx.resume().catch(() => {});
          for (const v of Object.values(st)) if (v && v.el && v.el.paused) v.el.play().catch(() => {});
        } catch (e) { /* ignore */ }
        return;
      }
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        noise = noiseBuffer();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14; comp.ratio.value = 4;
        master = ctx.createGain(); master.gain.value = 0.9;
        master.connect(comp).connect(ctx.destination);
        world = ctx.createGain(); worldLP = ctx.createBiquadFilter(); worldLP.type = 'lowpass'; worldLP.frequency.value = 20000; worldLP.Q.value = 0.5;
        world.connect(worldLP).connect(master);
        music = ctx.createGain(); music.connect(master);
        kidBus = ctx.createGain(); kidBus.connect(master);

        // the house: a synthesised sub drone (always, quieter once the recorded drone plays) and room hiss
        synthDrone = ctx.createGain(); synthDrone.gain.value = 0.06;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 120; lp.Q.value = 4;
        const lfo = ctx.createOscillator(), lfoG = ctx.createGain(); lfo.frequency.value = 0.07; lfoG.gain.value = 50;
        lfo.connect(lfoG).connect(lp.frequency); lfo.start();
        for (const f of [41.2, 41.9, 61.7]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(); }
        lp.connect(synthDrone).connect(music);
        const hiss = ctx.createBufferSource(); hiss.buffer = noise; hiss.loop = true;
        const hf = ctx.createBiquadFilter(); hf.type = 'bandpass'; hf.frequency.value = 420; hf.Q.value = 0.4;
        hissG = ctx.createGain(); hissG.gain.value = 0.012;
        hiss.connect(hf).connect(hissG).connect(world); hiss.start();

        // recorded beds: wind through the house and room tone; the score's three layers
        st.wind = stream(STREAMS.wind, world, 0.55);
        st.droneLP = ctx.createBiquadFilter(); st.droneLP.type = 'lowpass'; st.droneLP.frequency.value = 600;
        st.droneLP.connect(music);
        st.drone = stream(STREAMS.drone, st.droneLP, 0.26);
        st.threat = stream(STREAMS.threat, music, 0);
        st.chase = stream(STREAMS.chase, music, 0);
        const rt = ctx.createGain(); rt.gain.value = 0.9; rt.connect(world);
        loopInto('roomTone', rt).then(() => { hissG.gain.setTargetAtTime(0.005, ctx.currentTime, 2); });

        // its breathing (the snore recording, or a formant on noise until/unless it loads)
        mBreath = ctx.createGain(); mBreath.gain.value = 0;
        mBreathLP = ctx.createBiquadFilter(); mBreathLP.type = 'lowpass'; mBreathLP.frequency.value = 900;
        mBreathPan = ctx.createStereoPanner();
        mBreathLP.connect(mBreath).connect(mBreathPan).connect(world);
        const sb = ctx.createBufferSource(); sb.buffer = noise; sb.loop = true;
        const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 520; bf.Q.value = 3;
        sb.connect(bf).connect(mBreathLP); sb.start();
        loopInto('snore', mBreathLP, 0.8).then((s) => {
          try { sb.stop(); sb.disconnect(); } catch (e) { /* ignore */ }
          mBreath._src = s; mBreath.gain._v = undefined; mBreathRec = true;
        });

        // the giant's breath: low noise through a breathing filter
        giantG = ctx.createGain(); giantG.gain.value = 0;
        giantLP = ctx.createBiquadFilter(); giantLP.type = 'lowpass'; giantLP.frequency.value = 220; giantLP.Q.value = 1.5;
        const gb = ctx.createBufferSource(); gb.buffer = noise; gb.loop = true; gb.playbackRate.value = 0.5;
        gb.connect(giantLP).connect(giantG).connect(world); gb.start();

        // the searchlight: mains hum (recorded transformer buzz, plus a synth saw under it) and a thin whine
        beamG = ctx.createGain(); beamG.gain.value = 0;
        beamLP = ctx.createBiquadFilter(); beamLP.type = 'lowpass'; beamLP.frequency.value = 600;
        beamPan = ctx.createStereoPanner();
        beamLP.connect(beamG).connect(beamPan).connect(world);
        const saw = ctx.createOscillator(); saw.type = 'sawtooth'; saw.frequency.value = 50;
        const sawG = ctx.createGain(); sawG.gain.value = 0.12; saw.connect(sawG).connect(beamLP); saw.start();
        loopInto('hum', beamLP, 0.55).then((s) => { humSrc = s; sawG.gain.value = 0.05; });
        whine = ctx.createOscillator(); whine.frequency.value = 380;
        const vib = ctx.createOscillator(), vibG = ctx.createGain(); vib.frequency.value = 5.5; vibG.gain.value = 6;
        vib.connect(vibG).connect(whine.frequency); vib.start();
        whineG = ctx.createGain(); whineG.gain.value = 0;
        whine.connect(whineG).connect(beamPan); whine.start();

        // your breath on the candle, fluttering
        const bl = ctx.createBufferSource(); bl.buffer = noise; bl.loop = true;
        const blf = ctx.createBiquadFilter(); blf.type = 'bandpass'; blf.frequency.value = 1300; blf.Q.value = 0.8;
        const blf2 = ctx.createBiquadFilter(); blf2.type = 'bandpass'; blf2.frequency.value = 450; blf2.Q.value = 2;
        const am = ctx.createGain(); am.gain.value = 0.85;
        const fl = ctx.createOscillator(), flG = ctx.createGain(); fl.frequency.value = 7; flG.gain.value = 0.15; fl.connect(flG).connect(am.gain); fl.start();
        blowGain = ctx.createGain(); blowGain.gain.value = 0;
        bl.connect(blf).connect(am); bl.connect(blf2).connect(am); am.connect(blowGain).connect(world); bl.start();

        // your own breathing (hiding / panting)
        kBreath = ctx.createGain(); kBreath.gain.value = 0;
        const kLP = ctx.createBiquadFilter(); kLP.type = 'lowpass'; kLP.frequency.value = 1800;
        kLP.connect(kBreath).connect(kidBus);
        const kn = ctx.createBufferSource(); kn.buffer = noise; kn.loop = true;
        const knf = ctx.createBiquadFilter(); knf.type = 'bandpass'; knf.frequency.value = 800; knf.Q.value = 1.5;
        kn.connect(knf).connect(kLP); kn.start();
        loopInto('kidBreath', kLP, 1.12).then(() => {
          try { kn.stop(); kn.disconnect(); } catch (e) { /* ignore */ }
          kBreath.gain._v = undefined; kBreathRec = true;
        });

        for (const [n, f] of Object.entries(FILES)) load(n, f);
      } catch (e) {
        // no audio at all is better than a broken game
        report(e);
        try { ctx && ctx.close(); } catch (e2) { /* ignore */ }
        ctx = null;
      }
    },
    update(G, dt, near) {
      if (!ctx || !G) return;
      try { tick(G, dt, near); } catch (err) { report(err); }
    },
    event(e, G, near) {
      if (!ctx || !e || !G) return;
      try { onEvent(e, G, near); } catch (err) { report(err); }
    },
  };
}
