// The monster's brain as a second player in the model's world. The main model is the world (walls, doors, candles,
// both bodies, what the monster sees and hears); the brain is a mind (the nightmare: learned by RL) that reads what
// the model says the monster senses and presses the giant's buttons, which go into the model like your keys. No
// rules run: the brain sees only the model's row (plus the house's fixed plan), and its own mind (plans, moods, its
// guesses of where you are) is written back into the row, as the recorded games had it.
import { createGame } from '../sim/game.js';
import { createMind, think } from '../sim/mind/index.js';
import { encode, encodeGI, schemaJSON, STATE_SIZE, GI_SIZE } from '../sim/schema.js';

const ACTS = ['none', 'door', 'bash', 'check', 'windup', 'lunge', 'recover', 'yell'];
const BEAMS = ['idle', 'warn', 'on'], HANDS = ['idle', 'shadow', 'down', 'hold', 'up'];
const HEARD = ['other', 'kid', 'door', 'creak', 'squeak', 'land'];
const FELT = ['candleOut', 'doorInFace', 'lungeMiss', 'gapEscape', 'lostSight', 'spotted', 'checkEmpty', 'beamSpot', 'grabMiss'];

// L: the house (level.js); persona: { type: 'nightmare' } or any mind; seed: the mind's random stream
export function createBrain(L, persona, seed, col) {
  const G = createGame(L, seed);
  G.mind = createMind(G, persona, seed);
  const S = schemaJSON(), tmp = new Float32Array(STATE_SIZE), gi = new Float32Array(GI_SIZE);
  const own = S.tokens.filter((t) => t.kind === 'mind' || t.kind === 'belief').map((t) => [t.offset, t.offset + t.width * t.count]);
  const W = L.w, H = L.h;
  const num = (r, k, n, i) => { const c = col(k, n, i); return r[c.c] * c.s; };
  const flag = (r, k, n, i) => r[col(k, n, i).c] > 0.5;
  const cat = (r, k, n, i) => { const c = col(k, n, i); let b = 0; for (let j = 1; j < c.n; j++) if (r[c.c + j] > r[c.c + b]) b = j; return b; };

  // what the monster knows now, from the model's row (as senses.js observe gives it from the rules)
  function observeRow(r) {
    G.t = num(r, 'game', 't');
    const M = G.monster, k = G.kid;
    M.x = num(r, 'monster', 'x'); M.z = num(r, 'monster', 'z'); M.vx = num(r, 'monster', 'vx'); M.vz = num(r, 'monster', 'vz');
    const hx = num(r, 'monster', 'hx'), hz = num(r, 'monster', 'hz'), hl = Math.hypot(hx, hz);
    if (hl > 0.2) { M.hx = hx / hl; M.hz = hz / hl; }
    M.speed = Math.max(0, num(r, 'monster', 'speed')); M.act = ACTS[cat(r, 'monster', 'act')]; M.actT = num(r, 'monster', 'actT');
    M.awake = flag(r, 'monster', 'awake'); M.sees = flag(r, 'monster', 'sees');
    M.lust = Math.max(0, num(r, 'monster', 'lust')); M.rage = num(r, 'monster', 'rage') > 0.05 ? num(r, 'monster', 'rage') : 0;
    M.cool = num(r, 'monster', 'cool') > 0.03 ? num(r, 'monster', 'cool') : 0; M.yellCool = num(r, 'monster', 'yellCool') > 0.05 ? num(r, 'monster', 'yellCool') : 0;
    k.x = num(r, 'kid', 'x'); k.z = num(r, 'kid', 'z'); k.vx = num(r, 'kid', 'vx'); k.vz = num(r, 'kid', 'vz');
    G.candles.forEach((c, i) => { c.lit = flag(r, 'candle', 'lit', i); c.progress = Math.max(0, num(r, 'candle', 'progress', i)); });
    G.doors.forEach((d, i) => { d.open = flag(r, 'door', 'open', i); });
    const B = G.beam, R = G.reach;
    B.state = BEAMS[cat(r, 'beam', 'state')]; B.x = num(r, 'beam', 'x'); B.z = num(r, 'beam', 'z'); B.spotted = flag(r, 'beam', 'spotted');
    B.cool = num(r, 'beam', 'cool') > 0.3 ? num(r, 'beam', 'cool') : 0;
    R.state = HANDS[cat(r, 'hand', 'state')]; R.x = num(r, 'hand', 'x'); R.z = num(r, 'hand', 'z');
    R.cool = !flag(r, 'hand', 'armed') ? -1 : num(r, 'hand', 'cool') > 0.3 ? num(r, 'hand', 'cool') : 0;
    const out = G.candles.filter((c) => !c.lit).length;
    const sees = M.awake && M.sees;
    const heard = flag(r, 'pending', 'heard') ? [{ x: num(r, 'pending', 'heardX'), z: num(r, 'pending', 'heardZ'), kind: HEARD[cat(r, 'pending', 'heardKind')] }] : [];
    const alerts = flag(r, 'pending', 'alert') ? [{ x: num(r, 'pending', 'alertX'), z: num(r, 'pending', 'alertZ'), kind: 'candle' }] : [];
    const ping = flag(r, 'pending', 'ping') ? { x: num(r, 'pending', 'pingX'), z: num(r, 'pending', 'pingZ') } : null;
    const near = (list, x, z, key) => { let b = 0, bd = Infinity; list.forEach((o, i) => { const p = key(o), d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; b = i; } }); return b; };
    const hideSeen = flag(r, 'pending', 'hideSeen') ? near(G.wardrobes, k.x, k.z, (w) => ({ x: w.fx, z: w.fz })) : -1;
    const gap = Math.round(num(r, 'sense', 'kidGap')) - 1, gapSeen = flag(r, 'pending', 'gapSeen') && gap >= 0 ? gap : -1;
    const felt = FELT.filter((f) => flag(r, 'pending', `felt_${f}`)).map((kind) => ({ kind }));
    const seen = flag(r, 'sense', 'seenEver');
    return {
      t: G.t,
      self: { x: M.x, z: M.z, hx: M.hx, hz: M.hz, vx: M.vx, vz: M.vz, act: M.act, actT: M.actT, speed: M.speed, awake: M.awake, shoved: flag(r, 'pending', 'shoved'), cool: M.cool, yellCool: M.yellCool, rage: M.rage, lust: M.lust },
      sees, kid: sees ? { x: k.x, z: k.z, vx: k.vx, vz: k.vz } : null,
      lastSeen: seen ? { x: num(r, 'sense', 'lastSeenX'), z: num(r, 'sense', 'lastSeenZ'), vx: 0, vz: 0 } : null, lastSeenT: seen ? G.t - num(r, 'sense', 'lastSeenAge') * 10 : -99,
      heard, ping, alerts, hideSeen, gapSeen, felt,
      candles: G.candles, doors: G.doors, wardrobes: G.wardrobes, candlesOut: out,
      canLight: B.state === 'idle' && B.cool <= 0,
      canReach: out >= 2 && R.state === 'idle' && R.cool >= 0 && R.cool <= 0 && B.state === 'idle',
      beam: { state: B.state, x: B.x, z: B.z, spotted: B.spotted }, reach: { state: R.state, x: R.x, z: R.z },
    };
  }

  return {
    mind: G.mind,
    peek: (row) => observeRow(row), // what it would know from this row (tests)
    // take over a mind's state (a game already under way: a mid-game start, a mechanics moment)
    adopt(m) {
      const keep = { persona: G.mind.persona, rand: G.mind.rand, think: G.mind.think, policy: G.mind.policy };
      Object.assign(G.mind, structuredClone({ ...m, persona: undefined, rand: undefined, think: undefined, policy: undefined }), keep);
    },
    // the row now -> the giant's buttons for this step (as recorded: schema GI_FIELDS), and the brain's own events
    decide(row, dt) {
      G.events.length = 0;
      const b = think(G, G.mind, observeRow(row), dt);
      encodeGI(b, gi, 0);
      return { gi, buttons: b, events: G.events.slice() };
    },
    // its mind into the model's next row (plans, moods and guesses are the brain's, not the model's)
    write(row) {
      encode(G, tmp, 0);
      for (const [a, b] of own) for (let i = a; i < b; i++) row[i] = tmp[i];
      return row;
    },
    get W() { return W; }, get H() { return H; },
  };
}
