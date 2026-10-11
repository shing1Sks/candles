// Monster against monster: the same kid games (bot, skill, start, seed) played against each coded persona and against
// the nightmare, by the rules. Is the learned one the worse nightmare?
//   node train/rl/duel.mjs --policy runs/a/best.json [--games 60] [--temp 1] [--types hound,stalker,brute,warden,pathfinder,nightmare]
//        [--part k/P] [--out f.json]      (--merge a.json b.json ... : one report from parts)
import { readFileSync, writeFileSync } from 'node:fs';
import { createEpisode, stepEpisode, episodeOver } from '../../src/sim/episode.js';
import { KID_STYLES } from '../../src/sim/bots/kid.js';
import { setNightmarePolicy, mlpPolicy } from '../../src/sim/mind/nightmare.js';
import { rng, hash } from '../../src/sim/rng.js';

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(`--${k}`); return i < 0 ? d : args[i + 1]; };
const report = (rows) => {
  const by = {};
  for (const r of rows) (by[r.type] ||= []).push(r);
  const out = {};
  for (const [type, list] of Object.entries(by)) {
    const n = list.length, c = list.filter((r) => r.outcome === 'caught');
    out[type] = { games: n, caught: +(c.length / n).toFixed(3), kid_won: +(list.filter((r) => r.outcome === 'won').length / n).toFixed(3),
      t_catch: c.length ? +(c.reduce((a, r) => a + r.t, 0) / c.length).toFixed(1) : null, candles_out: +(list.reduce((a, r) => a + r.out, 0) / n).toFixed(2),
      pressure: +(list.reduce((a, r) => a + r.close, 0) / list.reduce((a, r) => a + r.steps, 0) * 100).toFixed(1) };
  }
  return out;
};
if (args[0] === '--merge') {
  const files = args.slice(1).filter((f, i, a) => f.endsWith('.json') && a[i - 1] !== '--out'), rows = files.flatMap((f) => JSON.parse(readFileSync(f, 'utf8')).games);
  const r = report(rows); console.table(r);
  if (opt('out')) writeFileSync(opt('out'), JSON.stringify({ report: r, games: rows }));
  process.exit(0);
}
const GAMES = Number(opt('games', 60)), TYPES = opt('types', 'hound,stalker,brute,warden,pathfinder,nightmare').split(',');
if (opt('policy')) setNightmarePolicy(mlpPolicy(JSON.parse(readFileSync(opt('policy'), 'utf8')), { temp: Number(opt('temp', 1)) }));
const [PART, PARTS] = opt('part', '0/1').split('/').map(Number);

// the kids: every style, skill 0.3-1, a third on keyboards, 40% mid-game starts (as the monster trained against), and
// seeds it never saw (batch 'duel')
const config = (i, type) => {
  const r = rng(hash('duel', i));
  const style = KID_STYLES[i % KID_STYLES.length], kid = { style, skill: 0.3 + 0.7 * r() };
  if (r() < 0.35) kid.keys = true;
  return { id: `duel:${i}`, seed: hash('duel', i, 'seed'), persona: { type }, kid, start: r() < 0.4 ? 'mid' : 'fresh', maxT: 150 };
};
const rows = [];
for (let i = PART; i < GAMES; i += PARTS) for (const type of TYPES) {
  const cfg = config(i, type), ep = { config: cfg, ...createEpisode(cfg), ticks: 0, rows: 0, h: 0 };
  ep.t0 = ep.G.t;
  const G = ep.G;
  let close = 0, steps = 0;
  while (!episodeOver(ep)) {
    stepEpisode(ep); G.events.length = 0; steps++;
    if (G.monster.awake && Math.hypot(G.kid.x - G.monster.x, G.kid.z - G.monster.z) < 5) close++;
  }
  rows.push({ i, type, style: cfg.kid.style, outcome: G.state === 'play' ? 'timeout' : G.state, t: +(G.t - ep.t0).toFixed(1), out: G.candles.filter((c) => !c.lit).length, close, steps });
}
if (opt('out')) writeFileSync(opt('out'), JSON.stringify({ games: rows }));
console.table(report(rows));
