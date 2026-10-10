// Balance probe: kid bots play many headless episodes against a monster mind, exactly as the data generator runs
// them, and we read the outcome rates.
// usage: node tools/sim.mjs [games] [seed]      env: PERSONA=classic|... KID=probe|... SKILL=0.6 START=fresh|mid DIAG=1
import { configFor, runEpisode, STEP } from '../src/sim/episode.js';

const N = Number(process.argv[2]) || 100, SEED = Number(process.argv[3]) || 1;
const persona = { type: process.env.PERSONA || 'classic' };
const kid = { style: process.env.KID || 'probe', skill: Number(process.env.SKILL || 0.6) };

const res = { ev: {}, won: 0, caught: 0, timeout: 0, t: [], out: [], modes: {}, stuck: 0, standoff: 0, rows: 0, catchT: [], by: {} };
const t0 = Date.now();
for (let g = 0; g < N; g++) {
  const config = { ...configFor(`probe-${SEED}`, g), persona, kid, start: process.env.START || 'fresh' };
  const r = runEpisode(config, {
    onRecord(row, G, ki, gi, events) {
      res.rows++;
      res.modes[G.monster.mode] = (res.modes[G.monster.mode] || 0) + STEP;
      if (G.monster.stuckT > 0.3) res.stuck++;
      for (const e of events) {
        res.ev[e.type] = (res.ev[e.type] || 0) + 1;
        if (e.type === 'caught') res.by[e.by] = (res.by[e.by] || 0) + 1;
      }
    },
  });
  const G = r.G, out = G.candles.filter((c) => !c.lit).length;
  res.standoff += r.counts._standoff || 0;
  res[r.outcome]++;
  res.t.push(r.t); res.out.push(out);
  if (r.outcome === 'caught') res.catchT.push(r.t);
  if (process.env.DIAG) console.log(`game ${g}: ${r.outcome} t=${r.t.toFixed(0)} out=${out} kid=(${G.kid.x.toFixed(1)},${G.kid.z.toFixed(1)}) mon=(${G.monster.x.toFixed(1)},${G.monster.z.toFixed(1)}) mode=${G.monster.mode}`);
}
const avg = (a) => (a.reduce((s, v) => s + v, 0) / Math.max(1, a.length)).toFixed(1);
const total = Object.values(res.modes).reduce((s, v) => s + v, 0);
const per = (k) => ((res.ev[k] || 0) / N).toFixed(2);
console.log(`${N} games (${persona.type} vs ${kid.style} ${kid.skill}) in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.log(`won ${res.won}  caught ${res.caught}  timeout ${res.timeout}   (caught by ${JSON.stringify(res.by)})`);
console.log(`avg length ${avg(res.t)} s, avg candles out ${avg(res.out)}, avg catch at ${avg(res.catchT)} s`);
console.log(`candles-out histogram: ${[0, 1, 2, 3, 4, 5, 6].map((i) => res.out.filter((v) => v === i).length).join(' ')}`);
console.log(`stuck ${((res.stuck / Math.max(1, res.rows)) * 100).toFixed(1)}%   standoff ${((res.standoff / Math.max(1, res.rows)) * 100).toFixed(1)}%   spotted ${per('spotted')}/game, lunges ${per('lunge')}, yells ${per('yell')}, fury ${per('fury')}`);
console.log('monster time: ' + Object.entries(res.modes).map(([k, v]) => `${k} ${((v / total) * 100).toFixed(0)}%`).join(', '));
console.log('events/game: ' + Object.entries(res.ev).filter(([k]) => !['kstep', 'mstep', 'mode'].includes(k)).map(([k, v]) => `${k} ${(v / N).toFixed(1)}`).join(', '));
