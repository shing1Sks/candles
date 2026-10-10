// Sanity checks for the maze: every candle reachable, starts far apart, gaps cost the monster a detour.
import { parseLevel } from '../src/sim/level.js';
import { distField } from '../src/sim/grid.js';

const L = parseLevel();
const fail = (m) => { console.log('FAIL', m); process.exitCode = 1; };
const ti = (p) => [Math.floor(p.x), Math.floor(p.z)];
const [kx, kz] = ti(L.kid), [mx, mz] = ti(L.monster);
const kidD = distField(L, kx, kz, L.kidBlocked), monD = distField(L, mx, mz, L.monBlocked);
const at = (f, x, z) => f[z * L.w + x];

console.log(`maze ${L.w}x${L.h}, ${L.candles.length} candles, ${L.passages.length} kid-only passages`);
console.log(`kid -> monster start: ${at(kidD, mx, mz).toFixed(1)} m walking`);
if (at(kidD, mx, mz) < 15) fail('monster starts closer than 15 m');
for (const c of L.candles) {
  const k = at(kidD, c.tx, c.tz), m = at(monD, c.tx, c.tz);
  console.log(`candle ${c.id} room ${c.room}: kid ${k.toFixed(1)} m, monster ${m.toFixed(1)} m`);
  if (!isFinite(k)) fail(`candle ${c.id} unreachable for the kid`);
  if (!isFinite(m)) fail(`candle ${c.id} unreachable for the monster`);
}
// How much each passage saves the kid over the monster's way round (the reason gaps work).
for (const p of L.passages) {
  if (p.exits.length < 2) { console.log(`passage ${p.id} kind ${p.kind}: dead end`); continue; }
  let worst = Infinity, best = 0;
  for (let i = 0; i < p.exits.length; i++) for (let j = i + 1; j < p.exits.length; j++) {
    const [ax, az] = p.exits[i], [bx, bz] = p.exits[j];
    const kid = Math.hypot(ax - bx, az - bz), mon = at(distField(L, ax, az, L.monBlocked), bx, bz);
    best = Math.max(best, mon - kid); worst = Math.min(worst, mon - kid);
  }
  console.log(`passage ${p.id} kind ${p.kind} (${p.tiles.length} tiles, ${p.exits.length} exits): monster detour up to ${best.toFixed(1)} m`);
}
if (!process.exitCode) console.log('ok');
