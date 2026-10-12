// The nightmare: a monster whose decisions are learned (train/rl, by reinforcement learning against the kid bots),
// not scored by hand. Every quarter second, or at once when something big happens, a small network reads what the
// monster knows and picks where to go (one of GOALS), whether to run, and the giant's tools. Getting there (paths,
// doors), lunging when close, its beliefs (memory that fades: "it was here... a while ago") and its moods are the
// shared parts of every mind. Its reward is its appetite: a catch, sooner; candles lost and a kid that gets away
// cost it.
import { MON } from '../rules.js';
import { T } from '../level.js';
import { clearLine, distField } from '../grid.js';
import { steer, aim, snap, randomSpot, passageExit, ambushSpot, doorAhead, tileOf } from './nav.js';
import { updateBelief } from './belief.js';
import { appraise, updateEmotion } from './emotion.js';

// where it can go: [name, the mode the game shows]
export const GOALS = [
  ['pursue', 'chase'], ['cutoff', 'intercept'],
  ['belief0', 'hunt'], ['belief1', 'hunt'], ['belief2', 'hunt'], ['belief3', 'hunt'], ['heard', 'hunt'],
  ['candle0', 'guard'], ['candle1', 'guard'], ['candle2', 'guard'], ['candle3', 'guard'], ['candle4', 'guard'], ['candle5', 'guard'],
  ['ambush', 'ambush'], ['wardrobe0', 'check'], ['wardrobe1', 'check'], ['wardrobe2', 'check'], ['stay', 'idle'], ['search', 'search'],
];
export const TOOLS = ['none', 'lightGoal', 'lightBelief', 'reachGoal'];
export const NG = GOALS.length, NT = TOOLS.length;
export const OBS_SIZE = 8 + 6 + 7 + 5 + NG * 4 + 4 * 5 + 3 + 2 + 12 + 3 + NG + 1;
export const NIGHTMARE = { smart: 1, aggression: 1, patience: 0.7, ears: 1, guard: 0.5, thorough: 1, temper: 0.5, tools: 1, temp: 0.6 };
const DECIDE = 0.25;

// The policy: set once (weights from train/rl, as JSON) for every nightmare in this process, or per mind
// (mind.policy) by the trainer. A policy is (x, goalMask, toolMask, mind) -> { goal, run, tool }.
let shared = null;
export function setNightmarePolicy(p) { shared = p; }

export function createNightmare() {
  return {
    path: null, goal: null, pathT: 0, wantX: 0, wantZ: 0, felt: [], lastD: null, quietT: 0, lastSharp: '', prevAnger: 0, bands: { anger: 0, frustration: 0 },
    pick: -1, pickT: 0, decideT: 0, run: true, tool: 0, spot: null, searchSpot: null, checking: false, checked: {}, pressUse: false,
    heardAt: null, lastGap: -1, lastGapT: -99, wasSees: false, hideSeenT: -99, hideW: -1, decisions: 0, x: null,
  };
}

// a weights object -> a policy: two layers of 256 (relu), then the goal, run and tool heads; drawn (temp > 0) or
// the likeliest (temp 0)
export function mlpPolicy(w, { temp = 1, rand = Math.random } = {}) {
  const h1 = new Float32Array(w.b1.length), h2 = new Float32Array(w.b2.length);
  const layer = (W, b, x, out, relu) => {
    const n = b.length, m = x.length;
    for (let i = 0; i < n; i++) { let s = b[i]; const o = i * m; for (let j = 0; j < m; j++) s += W[o + j] * x[j]; out[i] = relu ? Math.max(0, s) : s; }
    return out;
  };
  const pick = (logits, mask) => {
    let mx = -Infinity;
    for (let i = 0; i < logits.length; i++) if (!mask || mask[i]) mx = Math.max(mx, logits[i]);
    if (temp <= 0) { let b = -1; for (let i = 0; i < logits.length; i++) if ((!mask || mask[i]) && (b < 0 || logits[i] > logits[b])) b = i; return b; }
    let z = 0; const p = logits.map((l, i) => (!mask || mask[i] ? Math.exp((l - mx) / temp) : 0));
    for (const v of p) z += v;
    let u = rand() * z;
    for (let i = 0; i < p.length; i++) { u -= p[i]; if (u <= 0 && p[i] > 0) return i; }
    return p.findIndex((v) => v > 0);
  };
  return (x, gm, tm) => {
    layer(w.W1, w.b1, x, h1, true); layer(w.W2, w.b2, h1, h2, true);
    const g = layer(w.Wg, w.bg, h2, new Float32Array(NG), false), r = layer(w.Wr, w.br, h2, new Float32Array(2), false), t = layer(w.Wt, w.bt, h2, new Float32Array(NT), false);
    return { goal: pick(g, gm), run: pick(r, null) === 1, tool: pick(t, tm) };
  };
}

const beliefsByW = (m) => [...m.beliefs].sort((a, b) => b.w - a.w);
const recent = (m, t, s) => m.lastSeen && t - m.lastSeen.t < s;

// where each goal is now (null: not possible now)
function goalSpots(G, m, obs) {
  const self = obs.self, t = obs.t, out = new Array(NG).fill(null), bs = beliefsByW(m);
  if (obs.sees) out[0] = { x: obs.kid.x, z: obs.kid.z };
  else if (recent(m, t, 2)) out[0] = { x: m.lastSeen.x, z: m.lastSeen.z };
  if (recent(m, t, 3) || obs.sees) {
    const k = obs.sees ? obs.kid : m.lastSeen, v = Math.hypot(k.vx, k.vz), s = Math.min(1.5, 5 / Math.max(v, 1e-6));
    out[1] = snap(G, { x: k.x + k.vx * s, z: k.z + k.vz * s });
  }
  for (let i = 0; i < 4; i++) if (bs[i]) out[2 + i] = { x: bs[i].x, z: bs[i].z };
  if (m.heardAt && t - m.heardAt.t < 10) out[6] = m.heardAt;
  G.candles.forEach((c, i) => { if (c.lit) out[7 + i] = (m.candleSpots ||= {})[i] ||= randomSpot(G, m, c.x, c.z, 1.5); });
  if (m.lastGap >= 0 && t - m.lastGapT < 8) out[13] = (m.gapSpot && m.gapSpot.gap === m.lastGap) ? m.gapSpot : (m.gapSpot = { ...passageExit(G, m, self, m.lastGap), gap: m.lastGap });
  else if (bs[0] && bs[0].age < 4) { const a = ambushSpot(G, m, self, { x: bs[0].x, z: bs[0].z, vx: 0, vz: 0 }); if (a) out[13] = a; }
  G.wardrobes.forEach((w, i) => { if (t - (m.checked[w.id] ?? -99) > 6) out[14 + i] = { x: w.fx, z: w.fz }; });
  out[17] = { x: self.x, z: self.z };
  if (bs[0]) out[18] = m.searchSpot && Math.hypot(m.searchSpot.x - bs[0].x, m.searchSpot.z - bs[0].z) < 4 ? m.searchSpot : (m.searchSpot = randomSpot(G, m, bs[0].x, bs[0].z, 3.5));
  return out;
}

// what it knows, as numbers for the network (and the masks of what it can choose now)
export function nightmareFeatures(G, m, obs) {
  const self = obs.self, W = G.L.w, H = G.L.h, t = obs.t;
  const x = new Float32Array(OBS_SIZE), gm = new Uint8Array(NG), tm = new Uint8Array(NT);
  // walking distances from its tile (doors count as open, as its paths do): the house never changes, so kept
  const cache = (G.L.monDist ||= new Map()), key = tileOf(self.z) * W + tileOf(self.x);
  let dist = cache.get(key);
  if (!dist) cache.set(key, (dist = distField(G.L, tileOf(self.x), tileOf(self.z), G.L.monBlocked, G.L.monCost)));
  const pd = (p) => { const d = dist[tileOf(p.z) * W + tileOf(p.x)]; return Number.isFinite(d) ? Math.min(d, 60) / 30 : Math.hypot(p.x - self.x, p.z - self.z) / 30; };
  let o = 0;
  const put = (...v) => { for (const a of v) x[o++] = a; };
  put(self.x / W, self.z / H, self.hx, self.hz, self.speed / 5, self.act === 'none' ? 1 : 0, self.cool > 0 ? 1 : 0, self.rage > 0 ? 1 : 0);
  const out = obs.candlesOut;
  put(Math.min(1, t / 300), out / 6, obs.canLight ? 1 : 0, obs.canReach ? 1 : 0, obs.beam.state === 'on' ? 1 : 0, obs.reach.state !== 'idle' ? 1 : 0);
  if (obs.sees) {
    const k = obs.kid, at = G.L.at(tileOf(k.x), tileOf(k.z));
    put(1, (k.x - self.x) / 10, (k.z - self.z) / 10, k.vx / 4, k.vz / 4, pd(k), at === T.TABLE || at === T.BED || G.L.crawl(tileOf(k.x), tileOf(k.z)) ? 1 : 0);
  } else put(0, 0, 0, 0, 0, 0, 0);
  if (m.lastSeen) put(1, Math.min(3, (t - m.lastSeen.t) / 10), (m.lastSeen.x - self.x) / 20, (m.lastSeen.z - self.z) / 20, pd(m.lastSeen));
  else put(0, 3, 0, 0, 0);
  const spots = goalSpots(G, m, obs);
  for (let i = 0; i < NG; i++) {
    const s = spots[i];
    if (s) { gm[i] = 1; put(1, (s.x - self.x) / 20, (s.z - self.z) / 20, pd(s)); } else put(0, 0, 0, 0);
  }
  const bs = beliefsByW(m);
  for (let i = 0; i < 4; i++) {
    const b = bs[i];
    if (b) put(1, b.w, b.spread / 12, Math.min(1, b.age / 20), b.kind === 'sight' || b.kind === 'alert' ? 1 : 0); else put(0, 0, 0, 0, 0);
  }
  if (m.heardAt) put(1, Math.min(3, (t - m.heardAt.t) / 10), m.heardAt.kind === 'kid' ? 1 : 0); else put(0, 3, 0);
  put(t - m.hideSeenT < 10 ? 1 : 0, t - m.lastGapT < 8 ? 1 : 0);
  for (const c of G.candles) put(c.lit ? 1 : 0);
  for (const c of G.candles) put(Math.min(1, c.progress));
  put(m.anger, m.frustration, m.confidence);
  for (let i = 0; i < NG; i++) put(i === m.pick ? 1 : 0);
  put(Math.min(1, m.pickT / 10));
  tm[0] = 1;
  if (obs.canLight && !obs.sees) { tm[1] = 1; if (bs[0]) tm[2] = 1; }
  if (obs.canReach && !obs.sees) tm[3] = 1;
  m.spots = spots; m.dist = dist;
  return { x, gm, tm };
}

function setMode(G, m, mode) {
  if (m.mode === mode) return;
  m.mode = mode; m.modeT = 0;
  G.events.push({ type: 'mode', mode });
}

export function thinkNightmare(G, m, obs, dt) {
  const p = m.persona, self = obs.self;
  const gi = { mx: 0, mz: 0, run: false, lunge: false, use: false, bash: false, yell: false, light: false, reach: false, ax: 0, az: 0, lx: 0, lz: 0, why: '' };
  m.modeT += dt; m.pickT += dt; m.wantX = 0; m.wantZ = 0; m.pressUse = false;
  if (self.shoved) { m.path = null; m.pathT = 0; }

  // what it knows (its memory fades) and how it feels
  updateBelief(G, m, obs, dt, p);
  if (obs.sees) m.lastSeen = { x: obs.kid.x, z: obs.kid.z, vx: obs.kid.vx, vz: obs.kid.vz, t: obs.t };
  for (const h of obs.heard) m.heardAt = { x: h.x, z: h.z, kind: h.kind, t: obs.t };
  for (const a of obs.alerts) m.heardAt = { x: a.x, z: a.z, kind: a.kind, t: obs.t };
  if (obs.gapSeen >= 0) { m.lastGap = obs.gapSeen; m.lastGapT = obs.t; }
  if (obs.hideSeen >= 0) { m.hideSeenT = obs.t; m.hideW = obs.hideSeen; }
  for (const f of obs.felt) if (f.kind === 'candleOut') m.candleSpots = {};
  const ap = appraise(m, obs, dt);
  if (ap.sharp > 0) m.lastSharp = ap.why;
  const { furyStarted } = updateEmotion(m, ap, dt, p, { canYell: self.yellCool <= 0 && self.awake });
  m.spentT = 0; // a nightmare is never spent
  if (!self.awake) { setMode(G, m, 'sleep'); return gi; }
  if ((furyStarted || (m.prevAnger < 0.7 && m.anger >= 0.7)) && self.yellCool <= 0 && self.act === 'none') { gi.yell = true; gi.why = furyStarted ? 'fury' : m.lastSharp || 'anger'; }
  if (furyStarted) G.events.push({ type: 'fury', why: m.lastSharp });
  m.prevAnger = m.anger;

  // decide every quarter second, or at once when something big happens
  m.decideT -= dt;
  const big = obs.sees !== m.wasSees || obs.hideSeen >= 0 || obs.alerts.length > 0 || m.done;
  m.wasSees = obs.sees;
  if (m.decideT <= 0 || big || m.pick < 0) {
    const f = nightmareFeatures(G, m, obs), policy = m.policy || shared;
    const a = policy ? policy(f.x, f.gm, f.tm, m) : { goal: f.gm[0] ? 0 : f.gm.findIndex((v, i) => v && i >= 2), run: true, tool: 0 };
    let goal = a.goal >= 0 && f.gm[a.goal] ? a.goal : 17;
    if (goal !== m.pick) { m.pick = goal; m.pickT = 0; m.path = null; m.goal = null; m.checking = false; G.events.push({ type: 'tactic', name: GOALS[goal][0], why: big ? 'news' : 'timer' }); }
    m.run = a.run; m.tool = a.tool; m.done = false; m.decideT = DECIDE; m.decisions++;
    m.target = f.gm[goal] ? m.spots[goal] : null;
  }

  // go there
  const g = m.pick, spot = m.spots?.[g] || { x: self.x, z: self.z }, speed = m.run || m.furyT > 0 ? Infinity : MON.hunt;
  if (g === 0 && obs.sees) {
    const k = obs.kid, d = Math.hypot(k.x - self.x, k.z - self.z), lead = Math.min(0.5, d / 8) * 1.3;
    steer(G, m, self, k.x + k.vx * lead, k.z + k.vz * lead, Infinity, dt);
  } else if (g >= 14 && g <= 16) {
    const w = G.wardrobes[g - 14];
    if (m.checking) { if (self.act === 'none') { m.checked[w.id] = obs.t; m.done = true; } }
    else if (steer(G, m, self, w.fx, w.fz, speed, dt) < 0.75) { m.wantX = 0; m.wantZ = 0; if (self.act === 'none') { m.pressUse = true; m.checking = true; } }
  } else if (g === 17) { m.wantX = 0; m.wantZ = 0; }
  else if (steer(G, m, self, spot.x, spot.z, speed, dt) < 0.6 && (g === 18 || (g >= 2 && g <= 6))) {
    if (g === 18) m.searchSpot = null; else m.done = true; // nothing there: look again
    if (g >= 2 && g <= 5) { const b = beliefsByW(m)[g - 2]; if (b) b.conf *= 0.2; m.felt.push({ kind: 'leadEmpty' }); }
  }
  m.target = spot;
  setMode(G, m, m.furyT > 0 ? 'fury' : GOALS[g][1]);

  // a lunge when it is close and facing you
  const d = obs.kid ? Math.hypot(obs.kid.x - self.x, obs.kid.z - self.z) : Infinity;
  if (obs.sees && self.act === 'none' && self.cool <= 0) {
    const k = obs.kid, dot = ((k.x - self.x) * self.hx + (k.z - self.z) * self.hz) / (d || 1);
    if (d < 2.4 && dot > 0.8 && clearLine(G.L, self.x, self.z, k.x, k.z, MON.radius * 0.7, G.monBlocked)) { gi.lunge = true; aim(m, self, k.x, k.z, MON.chase); }
  }
  if ((self.act === 'windup' || self.act === 'recover') && obs.kid) aim(m, self, obs.kid.x, obs.kid.z, MON.chase);

  // the stick; doors in the way are smashed in a chase, opened otherwise
  const want = Math.hypot(m.wantX, m.wantZ);
  if (want > 1e-6) {
    const runCap = MON.chase + self.lust + (self.rage > 0 ? MON.rageBoost : 0), run = want > MON.hunt + 1e-6, mag = Math.min(1, want / (run ? runCap : MON.hunt));
    gi.run = run; gi.mx = (m.wantX / want) * mag; gi.mz = (m.wantZ / want) * mag;
    const dr = self.act === 'none' && !gi.lunge && !m.pressUse ? doorAhead(G, self, m.wantX, m.wantZ) : null;
    if (dr) { if (g === 0 || m.furyT > 0) gi.bash = true; else gi.use = true; }
  }
  if (m.pressUse) gi.use = true;

  // the giant's tools, when the policy asks
  if (obs.beam.state === 'on') {
    const tgt = obs.kid || beliefsByW(m)[0];
    if (tgt) { const dx = tgt.x - obs.beam.x, dz = tgt.z - obs.beam.z, n = Math.hypot(dx, dz) || 1; gi.lx = dx / n; gi.lz = dz / n; }
  }
  if (m.tool && !gi.yell) {
    const b = beliefsByW(m)[0], at = m.tool === 2 ? b : spot;
    if (at && (m.tool === 1 || m.tool === 2) && obs.canLight && !obs.sees) { gi.light = true; gi.ax = at.x; gi.az = at.z; }
    if (at && m.tool === 3 && obs.canReach && !obs.sees) { gi.reach = true; gi.ax = at.x; gi.az = at.z; }
    m.tool = 0;
  }
  return gi;
}
