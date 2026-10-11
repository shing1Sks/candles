// The main model plays the game (?model=M): every step (20 a second) the state row and your input go in, the model
// says what the monster presses and how the whole world moves, and the row it gives back is written into G for the
// renderer and the audio, which do not know the difference. No rules run: walls, candles, doors and the monster are
// all the model's. The model runs in its own thread (worker.js); this side writes its rows into the game.
import { sigmoid } from './decode.js';
import { layout, personaVec } from './layout.js';
import { encode, encodeKI, STATE_SIZE, KI_SIZE, EVENT_TYPES } from '../sim/schema.js';
import { MODES } from '../sim/mind/index.js';

const ACTS = ['none', 'door', 'bash', 'check', 'windup', 'lunge', 'recover', 'yell'];
const STATES = ['play', 'won', 'caught'], BEAMS = ['idle', 'warn', 'on'], HANDS = ['idle', 'shadow', 'down', 'hold', 'up'];

// onStep(G): called after each row lands (a kid bot answers here)
export async function createDream(name, G0, { ep = 'webgpu', temp = 1, mix = 0.3, topP = 0.9, mixFor = null, gtemp = 1, int8 = false, lockstep = false, onStep = null } = {}) {
  const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  const L = G0.L, map = { w: L.w, h: L.h, tiles: Array.from(L.tiles), doorAt: Array.from({ length: L.w * L.h }, (_, i) => L.doorAt(i % L.w, Math.floor(i / L.w))) };
  const col = layout(), ki = new Float32Array(KI_SIZE);
  let G, from = null, to = null, ms = 0, landed = 0, rate = 0, n = 0, since = performance.now();
  await new Promise((ok, fail) => {
    worker.onmessage = ({ data: m }) => (m.type === 'ready' ? (console.log(`model worker: ${m.threads} threads, isolated ${m.isolated}`), ok()) : m.type === 'error' ? fail(new Error(m.message)) : null);
    worker.onerror = (e) => fail(new Error(e.message || 'the model worker failed'));
    worker.postMessage({ type: 'init', name, ep, int8, temp, mix, topP, mixFor, gtemp, map, lockstep });
  });
  worker.onmessage = ({ data: m }) => {
    if (m.type === 'error') { console.error('model:', m.message); return; }
    if (m.type !== 'step' || G.state !== 'play') return;
    from = snapshot(G);
    apply(G, m.row, col);
    to = snapshot(G); landed = performance.now();
    events(G, m.prev, m.row, m.odds, col);
    ms = ms * 0.9 + m.ms * 0.1;
    if (++n, performance.now() - since > 1000) { rate = n * 1000 / (performance.now() - since); n = 0; since = performance.now(); }
    onStep?.(G);
  };
  const reset = (g) => {
    G = g; from = to = null;
    const row = new Float32Array(STATE_SIZE); encode(G, row, 0);
    worker.postMessage({ type: 'reset', row, persona: personaVec(G.mind.persona) });
  };
  reset(G0);
  return {
    get ms() { return ms; }, get rate() { return rate; },
    reset,
    // your input (any time; held keys replace, presses wait for the next step); active: the game is on
    input(inp, active) {
      encodeKI(inp, ki, 0);
      const m = Math.hypot(ki[0], ki[1]);
      if (m > 1) { ki[0] /= m; ki[1] /= m; } // a diagonal on keys is (1, 1); the rules (and so the model) see length 1
      worker.postMessage({ type: 'input', ki, active: active && G.state === 'play' });
    },
    // movers glide from the last row to the new one over the 1/20 s after it lands
    blend(at) { // at: a fixed point of the glide (recording); else by the clock
      if (!from) return;
      const f = at ?? Math.min(1, (performance.now() - landed) / 50);
      for (let j = 0; j < from.length; j++) {
        const [o, x, z] = from[j], [, tx, tz] = to[j];
        if (Math.hypot(tx - x, tz - z) > 1.5) continue; // a jump: no glide
        o.x = x + (tx - x) * f; o.z = z + (tz - z) * f;
      }
    },
    close() { worker.terminate(); },
  };
}

const snapshot = (G) => [G.kid, G.monster, ...G.items].map((o) => [o, o.x, o.z]);

// the row back into the game's objects (what the renderer and the audio read)
export function apply(G, r, col) {
  const num = (k, n, i) => { const c = col(k, n, i); return r[c.c] * c.s; };
  const flag = (k, n, i) => r[col(k, n, i).c] > 0.5;
  const cat = (k, n, i) => { const c = col(k, n, i); let b = 0; for (let j = 1; j < c.n; j++) if (r[c.c + j] > r[c.c + b]) b = j; return b; };
  G.t += 0.05;
  G.state = STATES[cat('game', 'state')];
  const k = G.kid;
  k.x = num('kid', 'x'); k.z = num('kid', 'z');
  k.vx = num('kid', 'vx'); k.vz = num('kid', 'vz'); k.speed = Math.hypot(k.vx, k.vz);
  const fx = num('kid', 'fx'), fz = num('kid', 'fz'), fl = Math.hypot(fx, fz);
  if (fl > 0.2) { k.fx = fx / fl; k.fz = fz / fl; }
  k.crawl = flag('kid', 'crawl'); k.running = flag('kid', 'running'); k.noise = num('kid', 'noise');
  const hid = cat('kid', 'hidden') - 1;
  if (hid !== k.hidden) k.hiddenAt = G.t;
  k.hidden = hid; k.held = cat('kid', 'held') - 1; k.blowing = cat('kid', 'blowing') - 1; k.blowHeld = flag('kid', 'blowHeld');
  k.stride = num('kid', 'stride');
  const M = G.monster;
  M.x = num('monster', 'x'); M.z = num('monster', 'z'); M.vx = num('monster', 'vx'); M.vz = num('monster', 'vz');
  const hx = num('monster', 'hx'), hz = num('monster', 'hz'), hl = Math.hypot(hx, hz);
  if (hl > 0.2) { M.hx = hx / hl; M.hz = hz / hl; }
  M.speed = Math.max(0, num('monster', 'speed')); M.act = ACTS[cat('monster', 'act')]; M.actT = num('monster', 'actT');
  M.awake = flag('monster', 'awake'); M.sees = flag('monster', 'sees'); M.lust = num('monster', 'lust'); M.rage = num('monster', 'rage');
  M.cool = num('monster', 'cool'); M.yellCool = num('monster', 'yellCool'); M.stride = num('monster', 'stride');
  const m = G.mind;
  m.mode = MODES[cat('mind', 'mode')];
  for (const f of ['anger', 'frustration', 'confidence', 'furyT', 'spentT', 'menace']) m[f] = num('mind', f);
  G.candles.forEach((c, i) => { const lit = flag('candle', 'lit', i); if (c.lit && !lit) c.outAt = G.t; c.lit = lit; c.progress = num('candle', 'progress', i); });
  G.doors.forEach((d, i) => { const op = flag('door', 'open', i); if (op !== d.open) d.changedAt = G.t; d.open = op; });
  G.wardrobes.forEach((w, i) => { const a = num('wardrobe', 'opened', i); if (a < 0.99) w.openAt = G.t - a * 2; });
  G.items.forEach((it, i) => {
    it.x = num('toy', 'x', i); it.z = num('toy', 'z', i); it.held = flag('toy', 'held', i);
    it.fly = flag('toy', 'flying', i) ? { dx: num('toy', 'dx', i), dz: num('toy', 'dz', i), d: Math.max(0, num('toy', 'flown', i)) } : null;
  });
  G.squeaks.forEach((s, i) => { s.cool = num('squeak', 'cool', i); });
  const b = G.beam;
  b.state = BEAMS[cat('beam', 'state')]; b.t = num('beam', 't'); b.x = num('beam', 'x'); b.z = num('beam', 'z');
  b.dx = num('beam', 'dx'); b.dz = num('beam', 'dz'); b.spotted = flag('beam', 'spotted'); b.cool = num('beam', 'cool');
  const h = G.reach;
  h.state = HANDS[cat('hand', 'state')]; h.t = num('hand', 't'); h.x = num('hand', 'x'); h.z = num('hand', 'z');
  h.cool = flag('hand', 'armed') ? num('hand', 'cool') : -1;
}

// what happened in the step, for the sounds and the effects: read from the change between the rows where it shows
// (a candle out, a door, a step), and from the model's event odds where it does not (a creak, a squeak, a roar)
const FROM_ROWS = new Set(['candleOut', 'door', 'hide', 'unhide', 'pickup', 'throw', 'land', 'won', 'caught', 'kstep', 'mstep', 'windup', 'lunge', 'yell', 'beam', 'reach', 'wake']);
export function events(G, a, b, odds, col) {
  const E = G.events, k = G.kid, M = G.monster;
  const v = (r, kind, n, i) => r[col(kind, n, i).c];
  const on = (r, kind, n, i) => v(r, kind, n, i) > 0.5;
  const pick = (r, kind, n, i) => { const c = col(kind, n, i); let x = 0; for (let j = 1; j < c.n; j++) if (r[c.c + j] > r[c.c + x]) x = j; return x; };
  const near = (list, x, z, key = (o) => o) => { let best = 0, bd = Infinity; list.forEach((o, i) => { const p = key(o), d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = i; } }); return best; };
  G.candles.forEach((c, i) => { if (on(a, 'candle', 'lit', i) && !on(b, 'candle', 'lit', i)) E.push({ type: 'candleOut', id: i, x: c.x, z: c.z }); });
  G.doors.forEach((d, i) => {
    const was = on(a, 'door', 'open', i), now = on(b, 'door', 'open', i);
    if (was === now) return;
    const by = Math.hypot(M.x - d.x, M.z - d.z) < Math.hypot(k.x - d.x, k.z - d.z) ? 'monster' : 'kid';
    E.push({ type: 'door', id: i, open: now, by, bash: by === 'monster' && M.act === 'bash', x: d.x, z: d.z });
  });
  const hidA = pick(a, 'kid', 'hidden') - 1, hidB = pick(b, 'kid', 'hidden') - 1;
  if (hidB >= 0 && hidA < 0) E.push({ type: 'hide', id: hidB, x: k.x, z: k.z });
  if (hidA >= 0 && hidB < 0) E.push({ type: 'unhide', id: hidA, x: k.x, z: k.z });
  const heldA = pick(a, 'kid', 'held') - 1, heldB = pick(b, 'kid', 'held') - 1;
  if (heldB >= 0 && heldA !== heldB) E.push({ type: 'pickup', id: heldB, kind: G.items[heldB].kind, x: k.x, z: k.z });
  G.items.forEach((it, i) => {
    const fa = on(a, 'toy', 'flying', i), fb = on(b, 'toy', 'flying', i);
    if (!fa && fb) E.push({ type: 'throw', id: i, kind: it.kind, x: it.x, z: it.z });
    if (fa && !fb) E.push({ type: 'land', id: i, kind: it.kind, wall: false, x: it.x, z: it.z });
  });
  const sa = pick(a, 'game', 'state'), sb = pick(b, 'game', 'state');
  if (sa === 0 && sb === 1) E.push({ type: 'won' });
  if (sa === 0 && sb === 2) E.push({ type: 'caught', by: M.act === 'lunge' ? 'lunge' : 'touch', x: k.x, z: k.z });
  if (v(b, 'kid', 'stride') < v(a, 'kid', 'stride') - 0.2 && k.speed > 0.3) E.push({ type: 'kstep', run: k.running, crawl: k.crawl, x: k.x, z: k.z });
  if (v(b, 'monster', 'stride') < v(a, 'monster', 'stride') - 0.2 && M.speed > 0.3) E.push({ type: 'mstep', run: M.speed > 3, x: M.x, z: M.z });
  const actA = ACTS[pick(a, 'monster', 'act')], actB = ACTS[pick(b, 'monster', 'act')];
  if (actA !== actB && ['windup', 'lunge', 'yell'].includes(actB)) E.push({ type: actB, x: M.x, z: M.z });
  if (!on(a, 'monster', 'awake') && on(b, 'monster', 'awake')) E.push({ type: 'wake', x: M.x, z: M.z });
  if (pick(a, 'beam', 'state') === 0 && pick(b, 'beam', 'state') > 0) E.push({ type: 'beam', x: G.beam.x, z: G.beam.z });
  if (pick(a, 'hand', 'state') === 0 && pick(b, 'hand', 'state') > 0) E.push({ type: 'reach', x: G.reach.x, z: G.reach.z });
  // the rest from the model's odds, drawn
  EVENT_TYPES.forEach((type, i) => {
    if (FROM_ROWS.has(type) || type === 'mode' || type === 'mood' || type === 'tactic') return;
    if (Math.random() >= sigmoid(odds[i])) return;
    const e = { type, x: k.x, z: k.z };
    if (type === 'squeak') { e.id = near(G.squeaks, k.x, k.z); e.kind = G.squeaks[e.id].kind; Object.assign(e, { x: G.squeaks[e.id].x, z: G.squeaks[e.id].z }); }
    if (type === 'doorTry') { e.id = near(G.doors, M.x, M.z); e.bash = M.act === 'bash'; }
    if (type === 'checkOpen' || type === 'checkEmpty' || type === 'found' || type === 'hideSeen') e.id = near(G.wardrobes, M.x, M.z, (w) => ({ x: w.fx, z: w.fz }));
    if (['slam', 'spotted', 'beamSpot', 'grab', 'fury', 'spent', 'lost'].includes(type)) { e.x = M.x; e.z = M.z; }
    E.push(e);
  });
}
