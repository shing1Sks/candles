// Find filmable moments in nightmare games (the browser replays ?watch=film:i&persona=nightmare exactly)
const G0 = '../../game/src/sim/';
const { readFileSync, writeFileSync } = await import('node:fs');
const { configFor, startEpisode, stepEpisode, episodeOver } = await import(G0 + 'episode.js');
const { setNightmarePolicy, mlpPolicy } = await import(G0 + 'mind/nightmare.js');
const { rng } = await import(G0 + 'rng.js');
const W = JSON.parse(readFileSync('../../game/public/nightmare.json', 'utf8'));
const out = [];
for (let i = 0; i < 400; i++) {
  setNightmarePolicy(mlpPolicy(W, { rand: rng(1) })); // as the browser with &seedpolicy=1
  const config = configFor('film', i); config.persona = { type: 'nightmare' };
  const ep = startEpisode(config), G = ep.G, ev = [];
  while (!episodeOver(ep)) {
    stepEpisode(ep);
    const d = Math.hypot(G.kid.x - G.monster.x, G.kid.z - G.monster.z);
    for (const e of G.events) if (['candleOut', 'lunge', 'caught', 'reach', 'beam', 'yell', 'beamSpot', 'grab', 'fury', 'throw', 'door', 'hide', 'found'].includes(e.type)) ev.push([ep.rows, e.type, +d.toFixed(1), e.by || '', +(G.kid.z - G.monster.z).toFixed(1), +(G.monster.x - G.kid.x).toFixed(1)]);
    G.events.length = 0;
  }
  out.push({ i, style: config.kid.style, start: config.start, rows: ep.rows, end: G.state, ev });
}
writeFileSync('moments.json', JSON.stringify(out));
const pick = (f) => out.flatMap((o) => o.ev.filter(f).map((e) => `${o.i}@${e[0]} ${e[1]} d${e[2]} ${e[3]} (${o.style},${o.start},${o.rows} rows,${o.end})`));
console.log('catch after lunge:', pick((e) => e[1] === 'caught' && e[3] === 'lunge').slice(0, 8));
console.log('caught by hand:', pick((e) => e[1] === 'caught' && e[3] === 'grab').slice(0, 6));
console.log('reach near:', pick((e) => e[1] === 'reach' && e[2] < 6).slice(0, 6));
console.log('beam:', pick((e) => e[1] === 'beamSpot').slice(0, 6));
console.log('found in wardrobe:', pick((e) => e[1] === 'found').slice(0, 6));
console.log('yell close:', pick((e) => e[1] === 'yell' && e[2] < 5).slice(0, 6));
console.log('candleOut with monster near:', pick((e) => e[1] === 'candleOut' && e[2] < 7).slice(0, 8));
console.log('fury:', pick((e) => e[1] === 'fury').slice(0, 5));
