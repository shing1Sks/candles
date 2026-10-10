// What a batch of data covers: how often every rule (case id in docs/mechanics.md) happened, and how the games went
// by monster type, kid style and start. Exits 1 if any rule happened fewer than TARGET times.
// usage: node tools/coverage.mjs <batch> [--dir DATA_DIR] [--target 1000]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CASES, STATIC_CASES } from '../src/sim/coverage.js';

const args = process.argv.slice(2), flag = (n) => { const k = args.indexOf(n); if (k < 0) return null; const v = args[k + 1]; args.splice(k, 2); return v; };
const dataDir = flag('--dir') || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data');
const TARGET = Number(flag('--target')) || 1000;
// how a game ends happens at most once per game: a quarter of the bar for those
const ENDINGS = new Set(['G5', 'X1', 'X2', 'H3']), END_TARGET = Math.round(TARGET / 4);
const batch = args[0];
if (!batch) { console.error('usage: node tools/coverage.mjs <batch> [--dir DIR] [--target N]'); process.exit(2); }
const dir = path.join(dataDir, batch);

const eps = [];
for (const s of fs.readdirSync(dir).filter((f) => f.startsWith('shard-')).sort()) {
  for (const l of fs.readFileSync(path.join(dir, s, 'episodes.jsonl'), 'utf8').split('\n')) if (l.trim()) eps.push(JSON.parse(l));
}
const errors = fs.existsSync(path.join(dir, 'errors.jsonl')) ? fs.readFileSync(path.join(dir, 'errors.jsonl'), 'utf8').split('\n').filter((l) => l.trim()).length : 0;
const total = {};
for (const e of eps) for (const [k, v] of Object.entries(e.counts)) total[k] = (total[k] || 0) + v;
const rows = eps.reduce((s, e) => s + e.rows, 0), hours = eps.reduce((s, e) => s + e.t, 0) / 3600;
console.log(`${batch}: ${eps.length} episodes (${errors} failed), ${rows} rows, ${hours.toFixed(1)} h of play`);

// outcomes by group
function table(title, key) {
  const g = {};
  for (const e of eps) { const k = key(e); (g[k] ||= { n: 0, won: 0, caught: 0, timeout: 0, yell: 0, fury: 0, t: 0 }); const r = g[k]; r.n++; r[e.outcome]++; r.yell += e.counts.Z2 || 0; r.fury += e.counts.Z3 || 0; r.t += e.t; }
  console.log(`\n${title.padEnd(12)}   games   won  caught timeout   yells/g  fury/g  avg s`);
  for (const [k, r] of Object.entries(g).sort()) {
    const p = (x) => `${((x / r.n) * 100).toFixed(0).padStart(4)}%`;
    console.log(`${k.padEnd(12)} ${String(r.n).padStart(7)} ${p(r.won)} ${p(r.caught)} ${p(r.timeout)}  ${(r.yell / r.n).toFixed(2).padStart(8)} ${(r.fury / r.n).toFixed(2).padStart(7)} ${(r.t / r.n).toFixed(0).padStart(6)}`);
  }
}
table('monster', (e) => e.config.persona.type);
table('kid', (e) => e.config.kid.style);
table('start', (e) => e.config.start);

// every rule
console.log(`\ncase   count      (target ${TARGET})`);
let low = 0;
for (const c of CASES) {
  const n = total[c.id] || 0, ok = n >= (ENDINGS.has(c.id) ? END_TARGET : TARGET);
  if (!ok) low++;
  console.log(`${c.id.padEnd(5)} ${String(n).padStart(9)}  ${ok ? 'OK' : 'LOW'}`);
}
console.log(`static (facts of the board, not counted): ${STATIC_CASES.join(' ')}`);
console.log(low ? `\n${low} case(s) LOW` : '\nevery case covered');
process.exit(low ? 1 : 0);
