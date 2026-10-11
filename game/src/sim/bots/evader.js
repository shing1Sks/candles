// The evader: a kid whose decisions are learned (train/rl, against the nightmare), so the monster trains against a kid
// that learns back, not only against the scripted bots. Every quarter second a small network reads what a player
// knows (where the monster is - its eye shows over the walls - the candles, the hiding places, the giant's light
// and hand) and picks a goal and whether to run or creep; getting there (paths, doors in the way) is the bots' way.
import { KID } from '../rules.js';
import { distField, findPath, clearLine } from '../grid.js';
import { mlpPolicy } from '../mind/nightmare.js';

const tf = Math.floor;
export const KID_GOALS = ['candle0', 'candle1', 'candle2', 'candle3', 'candle4', 'candle5', 'escape0', 'escape1', 'escape2', 'escape3',
  'cover', 'wardrobe0', 'wardrobe1', 'wardrobe2', 'stay', 'toy', 'lure', 'shut'];
export const KNG = KID_GOALS.length;
export const KID_OBS = 6 + 8 + 6 + 6 * 6 + 4 * 4 + 4 + 3 * 4 + 4 + 3 + 3 + KNG + 1;
const IDLE = { mx: 0, mz: 0, creep: false, blow: false, use: false, throw: false };

// where a kid stands to blow each candle: the reachable tile centre nearest it, in reach and in sight
function standSpots(G) {
  if (G.L.candleStands) return G.L.candleStands;
  return (G.L.candleStands = G.candles.map((c) => {
    let best = null, bd = Infinity;
    for (let z = tf(c.z) - 2; z <= tf(c.z) + 2; z++) for (let x = tf(c.x) - 2; x <= tf(c.x) + 2; x++) {
      if (G.L.kidBlocked(x, z)) continue;
      for (const [ox, oz] of [[0.5, 0.5], [0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]]) {
        const px = x + ox, pz = z + oz, d = Math.hypot(px - c.x, pz - c.z);
        if (d < KID.blowReach * 0.85 && d < bd && G.los(px, pz, c.x, c.z)) { bd = d; best = { x: px, z: pz }; }
      }
    }
    return best || { x: c.x, z: c.z };
  }));
}

// the weights every evader in this process plays with, unless given its own (data generation: gen.mjs --evader)
let shared = null;
export function setEvaderWeights(w) { shared = w; }

// the evader's decision-making; policy: (x, goalMask, toolMask) -> { goal, run, tool }, or weights (an mlpPolicy is made)
export function createEvader(G, policy, rand = Math.random) {
  policy = policy ?? shared;
  const pol = typeof policy === 'function' ? policy : policy ? mlpPolicy(policy, { rand }) : null;
  const st = { pick: -1, pickT: 0, decideT: 0, run: true, plan: [], planT: 0, spots: [], useT: 0, throwPhase: 0, throwDir: null, lastM: null };
  const bot = (obs, dt) => {
    const k = obs.kid, M = obs.monster;
    st.pickT += dt; st.decideT -= dt; st.planT -= dt; st.useT -= dt;
    if (st.decideT <= 0 || st.pick < 0) {
      const f = evaderFeatures(G, st, obs);
      const a = (bot.policy || pol)?.(f.x, f.gm, f.tm) ?? { goal: f.gm.findIndex((v) => v), run: true, tool: 0 };
      const goal = a.goal >= 0 && f.gm[a.goal] ? a.goal : 14;
      if (goal !== st.pick) { st.pick = goal; st.pickT = 0; st.planT = 0; st.throwPhase = 0; }
      st.run = a.run; st.decideT = 0.25;
    }
    const g = st.pick, inp = { ...IDLE, creep: !st.run };
    // hidden: stay while the goal is this wardrobe, else come out
    if (k.hidden >= 0) { if (g !== 11 + k.hidden && st.useT <= 0) { inp.use = true; st.useT = 0.5; } return inp; }
    if (g === 14) return inp;
    if (g === 16) { // a lure: turn away from it, then throw
      if (k.held < 0) return inp;
      if (st.throwPhase === 0) { const ax = k.x - M.x, az = k.z - M.z, n = Math.hypot(ax, az) || 1, s = rand() < 0.5 ? 1 : -1; st.throwDir = { x: (-az / n) * s, z: (ax / n) * s }; st.throwPhase = 1; }
      if (st.throwPhase === 1) { st.throwPhase = 2; inp.mx = st.throwDir.x; inp.mz = st.throwDir.z; return inp; }
      st.throwPhase = 0; inp.throw = true; return inp;
    }
    if (g === 17) { // shut the nearest open door
      const d = obs.doors.filter((q) => q.open).sort((a, b) => Math.hypot(a.x - k.x, a.z - k.z) - Math.hypot(b.x - k.x, b.z - k.z))[0];
      if (d && Math.hypot(d.x - k.x, d.z - k.z) < 1.3 && st.useT <= 0) { inp.use = true; st.useT = 0.8; }
      return inp;
    }
    const tgt = st.spots[g];
    if (!tgt) return inp;
    if (g < 6) { const c = obs.candles[g]; if (c.lit && Math.hypot(c.x - k.x, c.z - k.z) < KID.blowReach * 0.95) { inp.blow = true; inp.creep = false; return inp; } }
    if (g >= 11 && g <= 13 && Math.hypot(tgt.x - k.x, tgt.z - k.z) < 0.8) { if (st.useT <= 0) { inp.use = true; st.useT = 0.6; } return inp; }
    if (st.planT <= 0) { st.plan = findPath(G.L, tf(k.x), tf(k.z), tf(tgt.x), tf(tgt.z), G.kidBlocked) || []; st.planT = 0.25; }
    const p = st.plan;
    while (p.length > 1 && clearLine(G.L, k.x, k.z, p[1].x, p[1].z, KID.radius, G.kidBlocked)) p.shift();
    if (p.length && Math.hypot(p[0].x - k.x, p[0].z - k.z) < 0.2) p.shift();
    const at = p.length ? p[0] : tgt, dx = at.x - k.x, dz = at.z - k.z, n = Math.hypot(dx, dz);
    if (n > 0.05) { inp.mx = dx / n; inp.mz = dz / n; }
    for (const dr of obs.doors) if (!dr.open && st.useT <= 0 && Math.hypot(dr.x - k.x, dr.z - k.z) < 1.2 && (dr.x - k.x) * dx + (dr.z - k.z) * dz > 0) { inp.use = true; st.useT = 1; }
    return inp;
  };
  bot.st = st;
  return bot;
}

// what a player knows, as numbers, and what it can pick now
export function evaderFeatures(G, st, obs) {
  const k = obs.kid, M = obs.monster, L = G.L, W = L.w, H = L.h;
  const x = new Float32Array(KID_OBS), gm = new Uint8Array(KNG), tm = new Uint8Array(1);
  tm[0] = 1;
  const kd = distField(L, tf(k.x), tf(k.z), G.kidBlocked);
  const cache = (L.monDist ||= new Map()), key = tf(M.z) * W + tf(M.x);
  let md = cache.get(key);
  if (!md) cache.set(key, (md = distField(L, tf(M.x), tf(M.z), L.monBlocked)));
  const kD = (p) => { const v = kd[tf(p.z) * W + tf(p.x)]; return Number.isFinite(v) ? Math.min(v, 60) / 30 : 2; };
  const mD = (p) => { const v = md[tf(p.z) * W + tf(p.x)]; return Number.isFinite(v) ? Math.min(v, 60) / 30 : 2; };
  let o = 0;
  const put = (...v) => { for (const a of v) x[o++] = a; };
  put(k.x / W, k.z / H, k.vx / 4, k.vz / 4, k.hidden >= 0 ? 1 : 0, k.held >= 0 ? 1 : 0);
  const G2 = G.monster;
  put((M.x - k.x) / 20, (M.z - k.z) / 20, mD(k), M.awake ? 1 : 0, G2.speed / 5, G2.act === 'windup' || G2.act === 'lunge' ? 1 : 0, G2.sees ? 1 : 0, Math.min(1, obs.t / 300));
  const B = obs.beam, R = obs.reach;
  put(B.state === 'on' ? 1 : B.state === 'warn' ? 0.5 : 0, (B.x - k.x) / 20, (B.z - k.z) / 20, R.state !== 'idle' ? 1 : 0, (R.x - k.x) / 20, (R.z - k.z) / 20);
  const stands = standSpots(G), spots = new Array(KNG).fill(null);
  obs.candles.forEach((c, i) => {
    const s = stands[i];
    if (c.lit) { spots[i] = s; gm[i] = 1; }
    put(c.lit ? 1 : 0, Math.min(1, c.progress), (s.x - k.x) / 20, (s.z - k.z) / 20, kD(s), mD(s));
  });
  // escape spots: four places reachable soon that it reaches late (spread apart), crawl spaces worth more
  const esc = [];
  for (let z = 0; z < H; z++) for (let xx = 0; xx < W; xx++) {
    const i = z * W + xx, kk = kd[i];
    if (!(kk <= 10) || L.doorAt(xx, z) >= 0) continue;
    const s = (Number.isFinite(md[i]) ? md[i] : 30) - kk * 1.2 + (L.crawl(xx, z) ? 3 : 0);
    esc.push({ x: xx + 0.5, z: z + 0.5, s });
  }
  esc.sort((a, b) => b.s - a.s);
  const picked = [];
  for (const e of esc) { if (picked.every((q) => Math.hypot(q.x - e.x, q.z - e.z) > 3)) picked.push(e); if (picked.length === 4) break; }
  for (let i = 0; i < 4; i++) {
    const e = picked[i];
    if (e) { spots[6 + i] = e; gm[6 + i] = 1; put(1, (e.x - k.x) / 20, (e.z - k.z) / 20, mD(e)); } else put(0, 0, 0, 0);
  }
  let cover = null, cd = Infinity;
  for (let z = tf(k.z) - 5; z <= tf(k.z) + 5; z++) for (let xx = tf(k.x) - 5; xx <= tf(k.x) + 5; xx++) {
    if (xx < 0 || z < 0 || xx >= W || z >= H || !L.crawl(xx, z) || G.kidBlocked(xx, z)) continue;
    const v = kd[z * W + xx];
    if (v < cd) { cd = v; cover = { x: xx + 0.5, z: z + 0.5 }; }
  }
  if (cover) { spots[10] = cover; gm[10] = 1; put(1, (cover.x - k.x) / 10, (cover.z - k.z) / 10, mD(cover)); } else put(0, 0, 0, 0);
  obs.wardrobes.forEach((w, i) => {
    const s = { x: w.fx, z: w.fz };
    spots[11 + i] = s; gm[11 + i] = 1;
    put((s.x - k.x) / 20, (s.z - k.z) / 20, kD(s), mD(s));
  });
  gm[14] = 1;
  const toy = k.held < 0 ? obs.items.filter((it) => !it.held && !it.fly).map((it) => ({ x: it.x, z: it.z, d: kd[tf(it.z) * W + tf(it.x)] })).filter((t) => t.d < 12).sort((a, b) => a.d - b.d)[0] : null;
  if (toy) { spots[15] = toy; gm[15] = 1; put(1, (toy.x - k.x) / 10, (toy.z - k.z) / 10, toy.d / 12); } else put(0, 0, 0, 0);
  if (k.held >= 0) gm[16] = 1;
  const door = obs.doors.filter((q) => q.open && Math.hypot(q.x - k.x, q.z - k.z) < 1.3)[0];
  if (door) gm[17] = 1;
  put(k.held >= 0 ? 1 : 0, door ? 1 : 0, obs.candles.filter((c) => !c.lit).length / 6);
  put(k.crawl ? 1 : 0, k.blowing >= 0 ? 1 : 0, st.run ? 1 : 0);
  for (let i = 0; i < KNG; i++) put(i === st.pick ? 1 : 0);
  put(Math.min(1, st.pickT / 10));
  st.spots = spots; st.kd = kd; st.md = md;
  return { x, gm, tm };
}
