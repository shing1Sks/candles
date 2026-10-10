// The persona mind. Each step it updates where it thinks you are (belief), feels how it is doing (emotion), and
// every half second - or at once when something happens - scores its tactics and draws one by softmax at a
// temperature its mood sets. Calm, it takes the best; frustrated, it tries bolder ones; furious, it just charges.
// Personas only change the scores and thresholds; every tactic is shared. Odd moments always have a cause: each
// switch is logged with why (tactic events), and so are yells and fury.
import { MON, KID } from '../rules.js';
import { T } from '../level.js';
import { clearLine } from '../grid.js';
import { steer, aim, randomSpot, passageExit, ambushSpot, wardrobeNear, pickGuard, doorAhead, tileOf } from './nav.js';
import { updateBelief, bestBelief } from './belief.js';
import { appraise, updateEmotion, temperature } from './emotion.js';

export function createTactical() {
  return {
    path: null, goal: null, pathT: 0, wantX: 0, wantZ: 0,
    tactic: null, tacticT: 0, decideT: 0, done: false, why: '',
    spot: null, searchAt: null, searchLeft: 0, linger: 0, ambushAt: null, checkW: -1, checking: false, wantCheck: false, pressUse: false,
    checked: {}, guardId: -1, lastHint: null, gapUses: {}, lastGap: -1, lastGapT: -99, stallT: 0,
    felt: [], lastD: null, quietT: 0, lastSharp: '', prevAnger: 0, wasSees: false, wasSpent: false, bands: { anger: 0, frustration: 0 },
  };
}

// how much it trusts a guess, by what told it
function trust(b, p) {
  if (b.kind === 'sight' || b.kind === 'alert') return 0.8;
  if (b.kind === 'ping') return 0.4;
  if (b.kind === 'kid') return 0.5 + 0.5 * p.ears;
  return p.ears; // a creak, a squeak, a door, a toy landing
}
const litCandles = (G) => G.candles.filter((c) => c.lit);
function candleNear(G, b, r) {
  let best = null, bd = r;
  for (const c of litCandles(G)) { const d = Math.hypot(c.x - b.x, c.z - b.z); if (d < bd) { bd = d; best = c; } }
  return best;
}
const kidUnder = (G, k) => k && (G.L.at(tileOf(k.x), tileOf(k.z)) === T.TABLE || G.L.at(tileOf(k.x), tileOf(k.z)) === T.BED);
const here = (ctx) => ({ x: ctx.self.x, z: ctx.self.z });
// linger at the spot for `secs` once there, then finish (feeling `empty` if nothing came of it)
function waitAt(ctx, left, secs, empty) {
  const m = ctx.mind;
  if (left < 0.6) { m.linger += ctx.dt; m.wantX = 0; m.wantZ = 0; }
  if (m.linger > secs) { m.done = true; if (empty) m.felt.push({ kind: empty }); }
}

export const TACTICS = [
  {
    name: 'fury', mode: 'fury',
    score: ({ mind }) => (mind.furyT > 0 ? 100 : -Infinity),
    target: (ctx) => (ctx.obs.kid || ctx.best || ctx.mind.lastSeen || here(ctx)),
    act(ctx) { const t = this.target(ctx); steer(ctx.G, ctx.mind, ctx.self, t.x, t.z, Infinity, ctx.dt); },
  },
  {
    name: 'chase', mode: 'chase',
    score: ({ G, mind, obs, persona: p }) => {
      if (obs.sees) return 10 - (kidUnder(G, obs.kid) || G.L.crawl(tileOf(obs.kid.x), tileOf(obs.kid.z)) ? 6 * p.smart : 0) - (mind.stallT > 2 ? 8 : 0);
      return mind.tactic === 'chase' && !mind.done ? 6 : -Infinity;
    },
    target: (ctx) => (ctx.obs.kid || ctx.mind.lastSeen || here(ctx)),
    act(ctx) {
      const { G, mind, obs, self, persona: p, dt } = ctx;
      if (obs.sees) {
        const k = obs.kid, d = Math.hypot(k.x - self.x, k.z - self.z), lead = Math.min(0.5, d / 8) * (0.3 + p.smart);
        mind.stallT = kidUnder(G, k) && self.speed < 0.4 ? mind.stallT + dt : 0;
        steer(G, mind, self, k.x + k.vx * lead, k.z + k.vz * lead, Infinity, dt);
        mind.lostT = 0;
      } else {
        const at = mind.lastSeen || here(ctx), left = steer(G, mind, self, at.x, at.z, Infinity, dt);
        mind.lostT = (mind.lostT || 0) + dt;
        if (left < 0.6 || mind.lostT > 2.5) {
          G.events.push({ type: 'lost' });
          mind.searchAt = { x: at.x + (at.vx || 0) * 1.2, z: at.z + (at.vz || 0) * 1.2 }; mind.searchLeft = 3; mind.done = true;
        }
      }
    },
  },
  {
    name: 'hunt', mode: 'hunt',
    // (not a lead right beside it: that is a search round it)
    score: ({ best, self, persona: p }) => (best && Math.hypot(best.x - self.x, best.z - self.z) > 1.5 ? (1 + 3 * trust(best, p)) * best.w - best.spread / 6 - (best.age > 20 ? 1 : 0) : -Infinity),
    target: (ctx) => ctx.best || here(ctx),
    act(ctx) {
      const { G, mind, self, persona: p, best, dt } = ctx;
      if (!best) { mind.done = true; return; }
      const run = best.age < 2 + 4 * p.aggression;
      const left = steer(G, mind, self, best.x, best.z, run ? Infinity : MON.hunt, dt);
      if (left < 0.7) {
        // nothing there: it looked, so it believes it less, and searches around
        best.conf *= 0.2; mind.felt.push({ kind: 'leadEmpty' });
        mind.searchAt = { x: best.x, z: best.z }; mind.searchLeft = 2 + Math.round(2 * p.thorough); mind.done = true;
      }
    },
  },
  {
    name: 'search', mode: 'search',
    score: ({ mind, best, self }) => {
      if (mind.searchAt && mind.searchLeft > 0) return 2.5;
      // a fresh lead right beside it: search round it (too close to be worth a hunt)
      if (best && best.age < 3 && Math.hypot(best.x - self.x, best.z - self.z) <= 1.5) { mind.searchAt = { x: best.x, z: best.z }; mind.searchLeft = 2; return 3; }
      return -Infinity;
    },
    target: (ctx) => ctx.mind.spot || ctx.mind.searchAt || here(ctx),
    start(ctx) { ctx.mind.spot = null; },
    act(ctx) {
      const { G, mind, self, persona: p, dt } = ctx;
      if (!mind.spot || mind.linger > 1.2) {
        if (mind.searchLeft-- <= 0) { mind.done = true; return; }
        mind.linger = 0; mind.path = null;
        const w = wardrobeNear(G, mind, mind.searchAt.x, mind.searchAt.z, MON.checkNear);
        if (w && mind.rand() < 0.2 + 0.5 * p.thorough) { mind.checkW = w.id; mind.wantCheck = true; mind.done = true; return; }
        mind.spot = randomSpot(G, mind, mind.searchAt.x, mind.searchAt.z, 3.5);
      }
      const left = steer(G, mind, self, mind.spot.x, mind.spot.z, MON.patrol + 0.4, dt);
      if (left < 0.5 || mind.tacticT > 20) mind.linger += dt;
    },
  },
  {
    name: 'check', mode: 'check',
    score: ({ G, mind, obs, persona: p, best }) => {
      if (obs.hideSeen >= 0) { mind.checkW = obs.hideSeen; return 20; }
      if (mind.tactic === 'check' && !mind.done) return 8;
      if (mind.wantCheck) return 8;
      const w = best && wardrobeNear(G, mind, best.x, best.z, 2.5);
      if (w) { mind.checkW = w.id; return 3 * p.thorough * best.w; }
      return -Infinity;
    },
    target: ({ G, mind }) => { const w = G.wardrobes[Math.max(0, mind.checkW)]; return { x: w.fx, z: w.fz }; },
    start(ctx) { ctx.mind.checking = false; ctx.mind.wantCheck = false; },
    act(ctx) {
      const { G, mind, self, dt } = ctx, w = G.wardrobes[mind.checkW];
      if (mind.checking) { if (self.act === 'none') { mind.checked[w.id] = ctx.obs.t; mind.done = true; } return; }
      const left = steer(G, mind, self, w.fx, w.fz, MON.hunt, dt);
      if (left < 0.75) { mind.wantX = 0; mind.wantZ = 0; if (self.act === 'none') { mind.pressUse = true; mind.checking = true; } }
      else if (mind.tacticT > 12) mind.done = true;
    },
  },
  {
    name: 'intercept', mode: 'intercept',
    score: ({ G, mind, persona: p, best }) => {
      if (p.smart < 0.5 || !best || !candleNear(G, best, 6)) return -Infinity;
      return p.smart * (0.5 + mind.frustration) * 3 + (mind.tactic === 'intercept' && !mind.done ? 1 : 0);
    },
    target: (ctx) => ctx.mind.spot || here(ctx),
    start(ctx) {
      const c = candleNear(ctx.G, ctx.best, 6);
      ctx.mind.spot = c ? randomSpot(ctx.G, ctx.mind, c.x, c.z, 1.5) : here(ctx);
    },
    act(ctx) {
      const { G, mind, self, persona: p, dt } = ctx;
      waitAt(ctx, steer(G, mind, self, mind.spot.x, mind.spot.z, MON.hunt, dt), 6 + 6 * p.patience, 'ambushEmpty');
      if (mind.tacticT > 25) mind.done = true;
    },
  },
  {
    name: 'ambushGap', mode: 'ambush',
    score: ({ mind, obs, persona: p }) => {
      if (p.smart < 0.25 || mind.lastGap < 0 || obs.t - mind.lastGapT > 6) return mind.stallT > 2 && p.smart >= 0.25 ? 6 : -Infinity;
      return (0.5 + p.smart + mind.frustration) * 2 + ((mind.gapUses[mind.lastGap] || 0) >= MON.sameGap ? 6 : 0);
    },
    target: (ctx) => ctx.mind.ambushAt || here(ctx),
    start(ctx) {
      const { G, mind, obs, self } = ctx;
      if (mind.lastGap >= 0 && obs.t - mind.lastGapT <= 6) mind.ambushAt = passageExit(G, mind, self, mind.lastGap);
      else mind.ambushAt = (obs.kid && ambushSpot(G, mind, self, { ...obs.kid, vx: 0, vz: 0 })) || here(ctx);
      mind.gapUses[mind.lastGap] = 0; mind.stallT = 0;
    },
    act(ctx) {
      const { G, mind, self, persona: p, dt } = ctx;
      waitAt(ctx, steer(G, mind, self, mind.ambushAt.x, mind.ambushAt.z, Infinity, dt), 3 + 4 * p.patience, 'ambushEmpty');
      if (mind.tacticT > 12) mind.done = true;
    },
  },
  {
    name: 'guard', mode: 'guard',
    score: ({ G, persona: p, best }) => {
      const lit = litCandles(G).length;
      if (!lit) return -Infinity;
      // only a strong lead (it saw you, or a candle went out) pulls it off its post; a noise doesn't
      return p.guard * 3 * (1 + (6 - lit) * 0.1) - (best && (best.kind === 'sight' || best.kind === 'alert') && best.w > 0.5 && best.spread < 4 ? 1.5 : 0);
    },
    target: (ctx) => ctx.mind.spot || here(ctx),
    start(ctx) { ctx.mind.spot = pickGuard(ctx.G, ctx.mind, (ctx.persona.guard - 0.5) * 0.6) || here(ctx); },
    act(ctx) { const { G, mind, self, persona: p, dt } = ctx; waitAt(ctx, steer(G, mind, self, mind.spot.x, mind.spot.z, MON.patrol, dt), 2.2 + 3 * p.patience); },
  },
  {
    name: 'wander', mode: 'patrol',
    score: () => 1,
    target: (ctx) => ctx.mind.spot || here(ctx),
    start(ctx) { ctx.mind.spot = pickGuard(ctx.G, ctx.mind, -0.5) || here(ctx); },
    act(ctx) { const { G, mind, self, dt } = ctx; waitAt(ctx, steer(G, mind, self, mind.spot.x, mind.spot.z, MON.patrol, dt), 2.2); },
  },
  {
    name: 'breather', mode: 'breather',
    score: ({ mind, persona: p }) => (mind.menace > 15 + 20 * p.patience ? 20 : mind.tactic === 'breather' && !mind.done ? 15 : -Infinity),
    target: (ctx) => ctx.mind.spot || here(ctx),
    start(ctx) {
      const { G, mind, best } = ctx, ref = best || here(ctx);
      const far = litCandles(G).sort((a, b) => Math.hypot(b.x - ref.x, b.z - ref.z) - Math.hypot(a.x - ref.x, a.z - ref.z))[0];
      mind.spot = far ? randomSpot(G, mind, far.x, far.z, 2) : randomSpot(G, mind, ctx.self.x, ctx.self.z, 6);
      mind.menace = 0;
    },
    act(ctx) {
      const { G, mind, self, dt } = ctx;
      steer(G, mind, self, mind.spot.x, mind.spot.z, MON.hunt, dt);
      if (mind.tacticT > MON.breather) mind.done = true;
    },
  },
];
const BY_NAME = Object.fromEntries(TACTICS.map((t) => [t.name, t]));

// pick an index by softmax over the finite scores at temperature T
export function softmaxPick(scores, T, rand) {
  let max = -Infinity;
  for (const s of scores) if (s > max) max = s;
  const w = scores.map((s) => (Number.isFinite(s) ? Math.exp((s - max) / T) : 0));
  const sum = w.reduce((a, b) => a + b, 0);
  let r = rand() * sum;
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0 && w[i] > 0) return i; }
  return w.findIndex((v) => v > 0);
}

function context(G, mind, obs, dt) {
  // in a fury it charges at what it trusts, never at a thrown toy
  let best = bestBelief(mind);
  if (mind.furyT > 0 && best && best.kind === 'land') best = mind.beliefs.filter((b) => b.kind !== 'land').sort((a, b) => b.w - a.w)[0] || null;
  return { G, mind, obs, dt, persona: mind.persona, self: obs.self, best };
}

// score every tactic and draw one; switching starts it fresh and logs why
export function choose(G, mind, obs, dt) {
  const ctx = context(G, mind, obs, dt), T = temperature(mind, mind.persona);
  const scores = TACTICS.map((t) => { const s = t.score(ctx); return t.name === mind.tactic && !mind.done && Number.isFinite(s) ? s + 0.8 : s; });
  const t = TACTICS[softmaxPick(scores, T, mind.rand)];
  if (t.name !== mind.tactic || mind.done) {
    mind.tactic = t.name; mind.tacticT = 0; mind.done = false; mind.path = null; mind.goal = null; mind.linger = 0; mind.lostT = 0;
    t.start?.(ctx);
    G.events.push({ type: 'tactic', name: t.name, why: mind.why });
  }
  mind.target = t.target(ctx);
  return t;
}

function setMode(G, mind, mode) {
  if (mind.mode === mode) return;
  mind.mode = mode; mind.modeT = 0;
  G.events.push({ type: 'mode', mode });
}
const band = (v) => (v >= 0.75 ? 3 : v >= 0.5 ? 2 : v >= 0.25 ? 1 : 0);

export function thinkTactical(G, mind, obs, dt) {
  const p = mind.persona, self = obs.self;
  const gi = { mx: 0, mz: 0, run: false, lunge: false, use: false, bash: false, yell: false, light: false, reach: false, ax: 0, az: 0, lx: 0, lz: 0, why: '' };
  mind.modeT += dt; mind.tacticT += dt; mind.wantX = 0; mind.wantZ = 0; mind.pressUse = false;
  if (self.shoved) { mind.path = null; mind.pathT = 0; }

  // what it knows and how it feels
  updateBelief(G, mind, obs, dt, p);
  mind.lastHint = bestBelief(mind);
  if (obs.sees) mind.lastSeen = { x: obs.kid.x, z: obs.kid.z, vx: obs.kid.vx, vz: obs.kid.vz, t: obs.t };
  if (obs.gapSeen >= 0) {
    mind.lastGap = obs.gapSeen; mind.lastGapT = obs.t;
    if (mind.tactic === 'chase') mind.gapUses[obs.gapSeen] = (mind.gapUses[obs.gapSeen] || 0) + 1;
  }
  const felt = obs.felt.map((f) => f.kind);
  const ap = appraise(mind, obs, dt);
  if (ap.sharp > 0) mind.lastSharp = ap.why;
  const { furyStarted } = updateEmotion(mind, ap, dt, p, { canYell: self.yellCool <= 0 && self.awake });
  for (const k of ['anger', 'frustration']) {
    const b = band(mind[k]);
    if (b > mind.bands[k]) G.events.push({ type: 'mood', anger: mind.anger, frustration: mind.frustration, why: mind.lastSharp });
    mind.bands[k] = b;
  }
  if (!self.awake) { setMode(G, mind, 'sleep'); return gi; }

  // close and on you too long: it will back off (Alien's menace gauge)
  const d = obs.kid ? Math.hypot(obs.kid.x - self.x, obs.kid.z - self.z) : Infinity;
  mind.menace = d < 8 && (obs.sees || mind.tactic === 'chase') ? mind.menace + dt : Math.max(0, mind.menace - dt * 0.5);

  // a yell when its anger boils over, or as its fury starts
  if ((furyStarted || (mind.prevAnger < 0.7 && mind.anger >= 0.7)) && self.yellCool <= 0 && self.act === 'none') {
    gi.yell = true; gi.why = furyStarted ? 'fury' : mind.lastSharp || 'anger';
  }
  if (furyStarted) G.events.push({ type: 'fury', why: mind.lastSharp });
  if (mind.spentT > 0 && !mind.wasSpent) G.events.push({ type: 'spent' });
  mind.wasSpent = mind.spentT > 0; mind.prevAnger = mind.anger;

  // decide now if something happened, else every half second
  // Re-decide at once on something big (it saw you, lost you, saw you hide, a candle went out, fury, its plan is
  // done). Small things (a noise, its fuzzy sense of you, a minor setback) and the 0.75 s timer only count once it
  // has held its plan 1-2 s (by patience); a lead far from where it is heading counts at once
  // (2-4 s by patience), so it commits to a plan instead of flickering between them.
  mind.decideT -= dt;
  const strong = furyStarted ? 'fury' : obs.sees !== mind.wasSees ? (obs.sees ? 'saw' : 'lostSight') : obs.hideSeen >= 0 ? 'sawHide'
    : obs.alerts.length ? 'alert' : mind.done ? 'done' : '';
  const weak = felt.length ? felt[0] : obs.heard.some((h) => h.kind !== 'kid') ? 'heard' : obs.ping ? 'sensed' : mind.decideT <= 0 ? 'timer' : '';
  const held = mind.tacticT >= 1 + p.patience;
  // a lead well away from where it is heading is news, not dithering: act on it now
  const lead = mind.lastHint, goal = mind.target;
  const news = weak && weak !== 'timer' && lead && goal && Math.hypot(lead.x - goal.x, lead.z - goal.z) > 4 ? 'newLead' : '';
  const why = strong || news || (held ? weak : '');
  mind.wasSees = obs.sees;
  let decided = false;
  if (why || !mind.tactic) { mind.why = why || 'start'; choose(G, mind, obs, dt); mind.decideT = 0.75; decided = true; }

  const ctx = context(G, mind, obs, dt), t = BY_NAME[mind.tactic];
  t.act(ctx);
  mind.target = t.target(ctx);
  setMode(G, mind, mind.furyT > 0 ? 'fury' : mind.spentT > 0 ? 'spent' : t.mode);

  // a lunge when it is close and facing you (further when aggressive or angry)
  if (obs.sees && self.act === 'none' && self.cool <= 0 && mind.spentT <= 0) {
    const k = obs.kid, range = Math.min(2.4, 1.6 + 0.8 * p.aggression + 0.4 * mind.anger);
    const dot = ((k.x - self.x) * self.hx + (k.z - self.z) * self.hz) / (d || 1);
    if (d < range && dot > 0.8 && clearLine(G.L, self.x, self.z, k.x, k.z, MON.radius * 0.7, G.monBlocked)) { gi.lunge = true; aim(mind, self, k.x, k.z, MON.chase); }
  }
  if ((self.act === 'windup' || self.act === 'recover') && obs.kid) aim(mind, self, obs.kid.x, obs.kid.z, MON.chase);

  // the stick: up to hunt speed as is; faster needs run. Spent, it can only shamble.
  const want = Math.hypot(mind.wantX, mind.wantZ);
  if (want > 1e-6) {
    const runCap = MON.chase + self.lust + (self.rage > 0 ? MON.rageBoost : 0);
    let run = want > MON.hunt + 1e-6, mag = Math.min(1, want / (run ? runCap : MON.hunt));
    if (mind.spentT > 0) { run = false; mag = Math.min(mag, MON.patrol / MON.hunt); }
    gi.run = run; gi.mx = (mind.wantX / want) * mag; gi.mz = (mind.wantZ / want) * mag;
    const dr = self.act === 'none' && !gi.lunge && !mind.pressUse ? doorAhead(G, self, mind.wantX, mind.wantZ) : null;
    if (dr) { if (mind.furyT > 0 || mind.anger > 0.4 || (p.aggression > 0.7 && mind.tactic === 'chase')) gi.bash = true; else gi.use = true; }
  }
  if (mind.pressUse) gi.use = true;

  // the giant's own tools get their own look every half second, whatever the plan
  mind.toolT = (mind.toolT ?? 0.5) - dt;
  const toolTurn = mind.toolT <= 0;
  if (toolTurn) mind.toolT = 0.5;
  tools(G, mind, obs, gi, toolTurn);
  return gi;
}

// The giant's own tools, decided alongside whatever the monster is doing: the searchlight when it has lost track of
// you, the hand when it is frustrated and has a fair idea where you are.
function tools(G, mind, obs, gi, turn) {
  const p = mind.persona, best = mind.lastHint;
  if (obs.beam.state === 'on') {
    const tgt = obs.kid || best;
    if (tgt) { const dx = tgt.x - obs.beam.x, dz = tgt.z - obs.beam.z, n = Math.hypot(dx, dz) || 1; gi.lx = dx / n; gi.lz = dz / n; }
  }
  if (!turn || gi.yell) return;
  const spread = best ? best.spread : 12, at = best || obs.self;
  if (obs.canLight && obs.reach.state === 'idle' && !obs.sees) {
    const s = p.tools * Math.min(1, spread / 6) * (0.5 + mind.frustration);
    if (mind.rand() < s * 0.15) {
      const a = mind.rand() * Math.PI * 2, e = mind.rand() * spread * 0.5;
      gi.light = true; gi.ax = at.x + Math.cos(a) * e; gi.az = at.z + Math.sin(a) * e;
      return;
    }
  }
  if (obs.canReach && !obs.sees) {
    const s = p.tools * (0.5 + mind.frustration) * (best && best.spread < 4 ? 1 : 0.3);
    if (mind.rand() < s * 0.1) {
      const a = mind.rand() * Math.PI * 2, e = mind.rand() * Math.min(2.5, spread * 0.5);
      gi.reach = true; gi.ax = at.x + Math.cos(a) * e; gi.az = at.z + Math.sin(a) * e;
    }
  }
}
