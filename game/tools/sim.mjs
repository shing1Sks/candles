// Balance probe: a rough kid bot plays many headless games against the monster.
// Not the data-generation bots (that is the next stage) - just a check that the rules hold up.
// usage: node tools/sim.mjs [games] [seed]
import { parseLevel } from '../src/sim/level.js';
import { createGame, step } from '../src/sim/game.js';
import { distField, findPath, clearLine, los } from '../src/sim/grid.js';
import { KID } from '../src/sim/rules.js';

const N = Number(process.argv[2]) || 100, SEED = Number(process.argv[3]) || 1, DT = 1 / 60, MAXT = 300;
const L = parseLevel();

function kidBot(G) {
  const k = G.kid, M = G.monster, tf = (v) => Math.floor(v);
  const st = (G.bot ||= { plan: null, planT: 0, flee: false, known: null });
  st.planT -= DT;
  // fair information: it sees the monster only in line of sight; closer than 6 m it hears it
  const realD = Math.hypot(M.x - k.x, M.z - k.z);
  // OMNI=1: the monster's eye shows over the walls, so the player always knows where it is
  if (process.env.OMNI || (realD < 14 && los(L, k.x, k.z, M.x, M.z)) || realD < 6) st.known = { x: M.x, z: M.z, t: G.t };
  const K = st.known && G.t - st.known.t < 4 ? st.known : null;
  const d = K ? Math.hypot(K.x - k.x, K.z - k.z) : 99;
  const danger = M.mode !== 'sleep' && d < 7;
  if (st.planT <= 0 || danger !== st.flee) {
    st.planT = 0.25; st.flee = danger;
    const kd = distField(L, tf(k.x), tf(k.z), L.kidBlocked);
    let goal = null;
    if (danger) {
      const md = distField(L, tf(K.x), tf(K.z), L.monBlocked);
      let best = -Infinity;
      for (let z = 0; z < L.h; z++) for (let x = 0; x < L.w; x++) {
        const i = z * L.w + x, kk = kd[i];
        if (!(kk <= 8)) continue;
        const m = isFinite(md[i]) ? md[i] : 40;
        const s = m - kk * 1.3 + (L.crawl(x, z) ? 2 : 0);
        if (s > best) { best = s; goal = [x, z]; }
      }
    } else {
      let bd = Infinity;
      for (const c of G.candles) if (c.lit && kd[c.tz * L.w + c.tx] < bd) { bd = kd[c.tz * L.w + c.tx]; goal = [c.tx, c.tz]; st.cand = c; }
    }
    st.plan = goal ? findPath(L, tf(k.x), tf(k.z), goal[0], goal[1], L.kidBlocked) || [] : [];
  }
  const inp = { mx: 0, mz: 0, creep: false, blow: false };
  if (!danger && st.cand && st.cand.lit && Math.hypot(st.cand.x - k.x, st.cand.z - k.z) < KID.blowReach * 0.9) { inp.blow = true; return inp; }
  const p = st.plan;
  while (p.length > 1 && clearLine(L, k.x, k.z, p[1].x, p[1].z, KID.radius, L.kidBlocked)) p.shift();
  if (p.length && Math.hypot(p[0].x - k.x, p[0].z - k.z) < 0.2) p.shift();
  const tgt = p[0] || (st.cand && !danger ? st.cand : null);
  if (tgt) { const dx = tgt.x - k.x, dz = tgt.z - k.z, n = Math.hypot(dx, dz) || 1; inp.mx = dx / n; inp.mz = dz / n; }
  inp.creep = !danger && d < 10;
  return inp;
}

const res = { won: 0, caught: 0, timeout: 0, t: [], out: [], modes: {}, spotted: 0, lunges: 0, catchT: [] };
const t0 = Date.now();
for (let g = 0; g < N; g++) {
  const G = createGame(L, SEED + g);
  while (G.state === 'play' && G.t < MAXT) {
    const inp = kidBot(G);
    if (process.env.TRACE && Math.round(G.t * 60) % 300 === 0) console.log(`t=${G.t.toFixed(0)} kid=(${G.kid.x.toFixed(2)},${G.kid.z.toFixed(2)}) in=(${inp.mx.toFixed(2)},${inp.mz.toFixed(2)}) blow=${inp.blow} plan=${JSON.stringify((G.bot.plan || []).slice(0, 2))} cand=${G.bot.cand?.id}`);
    step(G, inp, DT);
    res.modes[G.monster.mode] = (res.modes[G.monster.mode] || 0) + DT;
    for (const e of G.events) { if (e.type === 'spotted') res.spotted++; if (e.type === 'lunge') res.lunges++; }
    G.events.length = 0;
  }
  const out = G.candles.filter((c) => !c.lit).length;
  res[G.state === 'play' ? 'timeout' : G.state]++;
  res.t.push(G.t); res.out.push(out);
  if (G.state === 'caught') res.catchT.push(G.t);
  if (process.env.DIAG) {
    const lit = G.candles.filter((c) => c.lit).map((c) => c.id).join(',');
    console.log(`game ${g}: ${G.state} t=${G.t.toFixed(0)} lit=[${lit}] kid=(${G.kid.x.toFixed(1)},${G.kid.z.toFixed(1)}) crawl=${G.kid.crawl} mon=(${G.monster.x.toFixed(1)},${G.monster.z.toFixed(1)}) mode=${G.monster.mode} blowing=${G.kid.blowing}`);
  }
}
const avg = (a) => (a.reduce((s, v) => s + v, 0) / Math.max(1, a.length)).toFixed(1);
const total = Object.values(res.modes).reduce((s, v) => s + v, 0);
console.log(`${N} games in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.log(`won ${res.won}  caught ${res.caught}  timeout ${res.timeout}`);
console.log(`avg length ${avg(res.t)} s, avg candles out ${avg(res.out)}, avg catch at ${avg(res.catchT)} s`);
console.log(`candles-out histogram: ${[0, 1, 2, 3, 4, 5, 6].map((i) => res.out.filter((v) => v === i).length).join(' ')}`);
console.log(`spotted ${(res.spotted / N).toFixed(1)}/game, lunges ${(res.lunges / N).toFixed(1)}/game`);
console.log('monster time: ' + Object.entries(res.modes).map(([k, v]) => `${k} ${((v / total) * 100).toFixed(0)}%`).join(', '));
