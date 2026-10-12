// One worker of the RL training (ppo.py runs several): plays games and writes every decision the learning side made:
// what it knew, what it could pick, what it picked, and the reward until its next decision. It stops at the end of a
// game once it has `decisions`.
//   node train/rl/collect.mjs --weights w.json|none --decisions 6000 --seed 1 --out part.bin [--stats part.json] [--temp 1]
//        [--side monster|kid] [--opp OPP.json] [--evaders 0.3] [--skill_min 0.3] [--time 0.002]
// --skill_min: the weakest kid bot (skill from this to 1); --time: the monster's cost of a decision (0.25 s): its hurry
// side monster (the nightmare learns): against the kid league - the bots, and with --opp the evader's weights, that
//   share of the games against the learned kid. Reward (its appetite): +1 a catch, -1 the kid wins, -0.2 a candle
//   out, -0.002 a decision (time), -SWITCH a change of mind (at 0.003 it changed plan every quarter second: indecisive
//   to watch, and a mind the main model cannot learn); plus shaping by how far it is to walk to the kid
//   (potential-based: it does not change what is best, it only says "warmer" sooner). The kid's true place is used for
//   the reward only; the network never sees it.
// side kid (the evader learns, bots/evader.js): against the nightmare with --opp's weights. Reward: +1 it wins, -1
//   caught or out of time (hiding all game is no win), +0.4 a candle out, -0.001 a decision, -0.01 a change of mind.
import { readFileSync, writeFileSync } from 'node:fs';
import { createEpisode, stepEpisode, episodeOver } from '../../src/sim/episode.js';
import { KID_STYLES } from '../../src/sim/bots/kid.js';
import { OBS_SIZE, NG, NT, mlpPolicy, setNightmarePolicy } from '../../src/sim/mind/nightmare.js';
import { createEvader, KID_OBS, KNG } from '../../src/sim/bots/evader.js';
import { rng, hash } from '../../src/sim/rng.js';

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(`--${k}`); return i < 0 ? d : args[i + 1]; };
const SIDE = opt('side', 'monster'), KID = SIDE === 'kid';
const SWITCH = Number(opt('switch', KID ? 0.01 : 0.03)), N = Number(opt('decisions', 6000)), SEED = Number(opt('seed', 1)), TEMP = Number(opt('temp', 1)), GAMMA = Number(opt('gamma', 0.99));
const wpath = opt('weights', 'none'), weights = wpath === 'none' ? null : JSON.parse(readFileSync(wpath, 'utf8'));
const SKILL_MIN = Number(opt('skill_min', 0.3)), TIME = Number(opt('time', 0.002));
const opp = opt('opp') ? JSON.parse(readFileSync(opt('opp'), 'utf8')) : null, EVADERS = Number(opt('evaders', opp ? 0.3 : 0));
const [O, G_, T_] = KID ? [KID_OBS, KNG, 1] : [OBS_SIZE, NG, NT];
const REC = O + G_ + T_ + 3 + 2; // obs, goal mask, tool mask, goal / run / tool, reward, done
const rand = rng(hash(SEED, 'collect'));
const net = weights && mlpPolicy(weights, { temp: TEMP, rand });
if (KID && opp) setNightmarePolicy(mlpPolicy(opp, { rand: rng(hash(SEED, 'opp')) }));
const oppKid = !KID && opp ? opp : null;

// the kid league: every bot style (60% with its numbers varied, and a few chaos kids), any skill, a third on
// keyboards, 40% mid-game starts; with an evader, that share of the kids is the learned one
function config(i) {
  const r = rng(hash(SEED, i, 'cfg'));
  const style = r() < 0.05 ? 'chaos' : KID_STYLES[Math.floor(r() * KID_STYLES.length)];
  const kid = { style, skill: SKILL_MIN + (1 - SKILL_MIN) * r(), vary: r() < 0.6 };
  if (r() < 0.35) kid.keys = true;
  const evader = KID || (oppKid && r() < EVADERS);
  return { id: `rl:${SEED}:${i}`, seed: hash(SEED, i), persona: { type: 'nightmare' }, kid, evader, start: r() < 0.4 ? 'mid' : 'fresh', maxT: 150 };
}

const out = [], stats = [];
let open = null; // the decision whose reward is still adding up
const path = (G) => { // how far the monster has to walk to the kid
  const M = G.monster, k = G.kid, W = G.L.w, md = G.L.monDist?.get(Math.floor(M.z) * W + Math.floor(M.x)), d = md?.[Math.floor(k.z) * W + Math.floor(k.x)];
  return Number.isFinite(d) ? d : Math.hypot(k.x - M.x, k.z - M.z) * 1.3;
};
const phi = (G) => (KID ? 0 : -0.5 * Math.min(path(G), 40) / 30); // the kid: no shaping (keeping away taught it to hide)
const close = (r, done) => { if (open) { open.r += r; open.done = done; out.push(open); open = null; } };

for (let ep = 0; out.length < N; ep++) {
  const cfg = config(ep), episode = { config: cfg, ...createEpisode(cfg), ticks: 0, rows: 0, h: 0 };
  episode.t0 = episode.G.t;
  const G = episode.G;
  if (cfg.evader) episode.kidBot = createEvader(G, KID ? null : oppKid, rng(hash(SEED, ep, 'evader')));
  let lastPhi = 0, lastGoal = -1, decisions = 0, switches = 0;
  const learner = (x, gm, tm) => {
    const p = phi(G);
    if (open) { open.r += GAMMA * p - lastPhi; close(0, 0); }
    let a;
    if (net) a = net(x, gm, tm);
    else { // no weights yet: uniformly at random among what it can pick
      const pick = (mask) => { const ok = []; mask.forEach((v, i) => v && ok.push(i)); return ok[Math.floor(rand() * ok.length)]; };
      a = { goal: pick(gm), run: rand() < 0.5, tool: pick(tm) };
    }
    open = { x: Float32Array.from(x), gm: Uint8Array.from(gm), tm: Uint8Array.from(tm), a: [a.goal, a.run ? 1 : 0, a.tool], r: (KID ? -0.001 : -TIME) - (lastGoal >= 0 && a.goal !== lastGoal ? SWITCH : 0), done: 0 };
    if (lastGoal >= 0 && a.goal !== lastGoal) switches++;
    lastPhi = p; lastGoal = a.goal; decisions++;
    return a;
  };
  if (KID) episode.kidBot.policy = learner; else G.mind.policy = learner;
  while (!episodeOver(episode)) {
    stepEpisode(episode);
    for (const e of G.events) if (e.type === 'candleOut' && open) open.r += KID ? 0.4 : -0.2;
    G.events.length = 0;
  }
  const out0 = G.candles.filter((c) => !c.lit).length;
  // a kid that only hides until the time is up has not won (the game is won by the candles): as bad as caught (at
  // -0.5 it learned to sit in a vent for the whole game)
  const end = KID ? (G.state === 'won' ? 1 : -1) : G.state === 'caught' ? 1 : G.state === 'won' ? -1 : 0;
  if (open) { open.r += end - lastPhi; close(0, 1); } // the game over: no more warmer or colder
  stats.push({ outcome: G.state === 'play' ? 'timeout' : G.state, t: +(G.t - episode.t0).toFixed(1), out: out0, style: cfg.evader ? 'evader' : cfg.kid.style, skill: +cfg.kid.skill.toFixed(2), decisions, switches });
}

const buf = new Float32Array(out.length * REC);
out.forEach((d, i) => {
  const o = i * REC;
  buf.set(d.x, o); buf.set(d.gm, o + O); buf.set(d.tm, o + O + G_);
  buf.set(d.a, o + O + G_ + T_); buf[o + REC - 2] = d.r; buf[o + REC - 1] = d.done;
});
writeFileSync(opt('out', 'part.bin'), Buffer.from(buf.buffer));
if (opt('stats')) writeFileSync(opt('stats'), JSON.stringify({ rec: REC, obs: O, ng: G_, nt: T_, n: out.length, games: stats }));
