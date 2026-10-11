// One worker of the nightmare's training (ppo.py runs several): plays games of the nightmare against the kid bots
// with the current policy and writes every decision it made: what it knew, what it could pick, what it picked, and
// the reward until its next decision. It stops at the end of a game once it has `decisions`.
//   node train/rl/collect.mjs --weights w.json|none --decisions 6000 --seed 1 --out part.bin [--stats part.json] [--temp 1]
// Reward (its appetite): +1 a catch, -1 the kid wins, -0.2 a candle out, -0.002 a decision (time), -0.003 a change
// of mind; plus shaping by how far it is to walk to the kid (potential-based: it does not change what is best, it
// only says "warmer" sooner). The kid's true place is used for the reward only; the network never sees it.
import { readFileSync, writeFileSync } from 'node:fs';
import { createEpisode, stepEpisode, episodeOver } from '../../src/sim/episode.js';
import { KID_STYLES } from '../../src/sim/bots/kid.js';
import { OBS_SIZE, NG, NT, mlpPolicy } from '../../src/sim/mind/nightmare.js';
import { rng, hash } from '../../src/sim/rng.js';

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(`--${k}`); return i < 0 ? d : args[i + 1]; };
const N = Number(opt('decisions', 6000)), SEED = Number(opt('seed', 1)), TEMP = Number(opt('temp', 1)), GAMMA = Number(opt('gamma', 0.99));
const wpath = opt('weights', 'none'), weights = wpath === 'none' ? null : JSON.parse(readFileSync(wpath, 'utf8'));
const REC = OBS_SIZE + NG + NT + 3 + 2; // obs, goal mask, tool mask, goal / run / tool, reward, done
const rand = rng(hash(SEED, 'collect'));
const net = weights && mlpPolicy(weights, { temp: TEMP, rand });

// the kid league: every bot style (and a few chaos kids), any skill, a third on keyboards, 40% mid-game starts
function config(i) {
  const r = rng(hash(SEED, i, 'cfg'));
  const style = r() < 0.05 ? 'chaos' : KID_STYLES[Math.floor(r() * KID_STYLES.length)];
  const kid = { style, skill: 0.3 + 0.7 * r() };
  if (r() < 0.35) kid.keys = true;
  return { id: `rl:${SEED}:${i}`, seed: hash(SEED, i), persona: { type: 'nightmare' }, kid, start: r() < 0.4 ? 'mid' : 'fresh', maxT: 150 };
}

const out = [], stats = [];
let open = null; // the decision whose reward is still adding up
const phi = (G) => {
  const M = G.monster, k = G.kid, W = G.L.w, d = G.mind.dist?.[Math.floor(k.z) * W + Math.floor(k.x)];
  const far = Number.isFinite(d) ? d : Math.hypot(k.x - M.x, k.z - M.z) * 1.3;
  return -0.5 * Math.min(far, 40) / 30;
};
const close = (r, done) => { if (open) { open.r += r; open.done = done; out.push(open); open = null; } };

for (let ep = 0; out.length < N; ep++) {
  const cfg = config(ep), episode = { config: cfg, ...createEpisode(cfg), ticks: 0, rows: 0, h: 0 };
  episode.t0 = episode.G.t;
  const G = episode.G, m = G.mind;
  let lastPhi = 0, lastGoal = -1, decisions = 0;
  m.policy = (x, gm, tm) => {
    const p = phi(G);
    if (open) { open.r += GAMMA * p - lastPhi; close(0, 0); }
    let a;
    if (net) a = net(x, gm, tm);
    else { // no weights yet: uniformly at random among what it can pick
      const pick = (mask) => { const ok = []; mask.forEach((v, i) => v && ok.push(i)); return ok[Math.floor(rand() * ok.length)]; };
      a = { goal: pick(gm), run: rand() < 0.5, tool: pick(tm) };
    }
    open = { x: Float32Array.from(x), gm: Uint8Array.from(gm), tm: Uint8Array.from(tm), a: [a.goal, a.run ? 1 : 0, a.tool], r: -0.002 - (lastGoal >= 0 && a.goal !== lastGoal ? 0.003 : 0), done: 0 };
    lastPhi = p; lastGoal = a.goal; decisions++;
    return a;
  };
  let out0 = 0;
  while (!episodeOver(episode)) {
    stepEpisode(episode);
    for (const e of G.events) if (e.type === 'candleOut' && open) open.r -= 0.2;
    G.events.length = 0;
  }
  out0 = G.candles.filter((c) => !c.lit).length;
  const end = G.state === 'caught' ? 1 : G.state === 'won' ? -1 : 0;
  if (open) { open.r += end - lastPhi; close(0, 1); } // the game over: no more warmer or colder
  stats.push({ outcome: G.state === 'play' ? 'timeout' : G.state, t: +(G.t - episode.t0).toFixed(1), out: out0, style: cfg.kid.style, skill: +cfg.kid.skill.toFixed(2), decisions });
}

const buf = new Float32Array(out.length * REC);
out.forEach((d, i) => {
  const o = i * REC;
  buf.set(d.x, o); buf.set(d.gm, o + OBS_SIZE); buf.set(d.tm, o + OBS_SIZE + NG);
  buf.set(d.a, o + OBS_SIZE + NG + NT); buf[o + REC - 2] = d.r; buf[o + REC - 1] = d.done;
});
writeFileSync(opt('out', 'part.bin'), Buffer.from(buf.buffer));
if (opt('stats')) writeFileSync(opt('stats'), JSON.stringify({ rec: REC, obs: OBS_SIZE, ng: NG, nt: NT, n: out.length, games: stats }));
