// Feasibility spike (throwaway): can a small model learn the kid's movement, walls and blowing out candles from
// recorded play? This writes transitions from today's game for spike.py to learn from.
// usage: node tools/feasibility/export.mjs [games]
import fs from 'node:fs';
import path from 'node:path';
import { parseLevel, T } from '../../src/sim/level.js';
import { createGame, step } from '../../src/sim/game.js';
import { distField, findPath, clearLine } from '../../src/sim/grid.js';
import { KID } from '../../src/sim/rules.js';

const GAMES = Number(process.argv[2]) || 150, DT = 1 / 60, MAXT = 300, OUT = path.resolve('../data/spike');
const L = parseLevel();

// the balance probe's kid bot (tools/sim.mjs), knowing where the monster is (its eye shows over the walls)
function kidBot(G) {
  const k = G.kid, M = G.monster, tf = (v) => Math.floor(v);
  const st = (G.bot ||= { plan: null, planT: 0, flee: false });
  st.planT -= DT * 3;
  const d = Math.hypot(M.x - k.x, M.z - k.z), danger = M.mode !== 'sleep' && d < 7;
  if (st.planT <= 0 || danger !== st.flee) {
    st.planT = 0.25; st.flee = danger;
    const kd = distField(L, tf(k.x), tf(k.z), L.kidBlocked);
    let goal = null;
    if (danger) {
      const md = distField(L, tf(M.x), tf(M.z), L.monBlocked);
      let best = -Infinity;
      for (let z = 0; z < L.h; z++) for (let x = 0; x < L.w; x++) {
        const i = z * L.w + x, kk = kd[i];
        if (!(kk <= 8)) continue;
        const s = (isFinite(md[i]) ? md[i] : 40) - kk * 1.3 + (L.crawl(x, z) ? 2 : 0);
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
  // a little mess, so it also bumps into walls and blows at nothing
  if (G.rand() < 0.08) { const a = G.rand() * Math.PI * 2; inp.mx = Math.cos(a); inp.mz = Math.sin(a); }
  if (G.rand() < 0.03) inp.blow = true;
  return inp;
}

// tile codes for the 5x5 patch: the level's types, with a shut door as a wall
const patchCode = (G, x, z) => (G.kidBlocked(x, z) && L.at(x, z) === T.FLOOR ? T.WALL : L.at(x, z));
function nearestCandle(G) {
  let best = null, bd = Infinity;
  // the one the rules would blow: nearest lit candle in line of sight (else nearest; two candles sit back to back
  // through a wall)
  for (const c of G.candles) { if (!c.lit) continue; const d = Math.hypot(c.x - G.kid.x, c.z - G.kid.z) + (G.los(G.kid.x, G.kid.z, c.x, c.z) ? 0 : 100); if (d < bd) { bd = d; best = c; } }
  return best;
}
// one row = what the model sees now (inputs) and what happened 3 ticks later (targets)
const IN = ['fx', 'fz', 'vx', 'vz', 'mx', 'mz', 'creep', 'blow', 'crawl', 'cdx', 'cdz', 'cprog', 'clos', ...Array.from({ length: 25 }, (_, i) => `p${i}`)];
const OUTF = ['dx', 'dz', 'nprog', 'out'];
const rows = [];
for (let g = 0; g < GAMES; g++) {
  const G = createGame(L, 1000 + g);
  let inp = null, n = 0;
  while (G.state === 'play' && G.t < MAXT) {
    if (n % 3 === 0) {
      inp = kidBot(G);
      const k = G.kid, c = nearestCandle(G), tx = Math.floor(k.x), tz = Math.floor(k.z);
      const row = [k.x - tx, k.z - tz, k.vx, k.vz, inp.mx, inp.mz, +inp.creep, +inp.blow, +k.crawl,
        c ? c.x - k.x : 0, c ? c.z - k.z : 0, c ? c.progress : 0, c ? +G.los(k.x, k.z, c.x, c.z) : 0];
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) row.push(patchCode(G, tx + dx, tz + dz));
      const x0 = k.x, z0 = k.z;
      for (let s = 0; s < 3 && G.state === 'play'; s++) { step(G, inp, DT); G.events.length = 0; n++; }
      if (G.state !== 'play') break;
      row.push(G.kid.x - x0, G.kid.z - z0, c ? c.progress : 0, c ? +!c.lit : 0);
      rows.push(row);
    }
  }
  if (g % 25 === 24) console.log(`${g + 1} games, ${rows.length} rows`);
}
fs.mkdirSync(OUT, { recursive: true });
const flat = new Float32Array(rows.length * (IN.length + OUTF.length));
rows.forEach((r, i) => flat.set(r, i * r.length));
fs.writeFileSync(path.join(OUT, 'rows.f32'), Buffer.from(flat.buffer));
fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify({ inputs: IN, targets: OUTF, rows: rows.length, kidRadius: KID.radius, blocked: [T.WALL, T.LOW, T.TALL] }, null, 1));
console.log(`wrote ${rows.length} rows to ${OUT}`);
