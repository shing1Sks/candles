// The mechanics exam: every case in cases.mjs played inside a main model's world, `runs` times (the monster's mind
// and the model's doubt are drawn, so a case can pass one time and fail the next). Decoding as in play (?model=):
// kid exact, mind drawn, the rest at 0.3, top-p 0.9, snap, peak, coherent catches, walls.
//   node tools/mechanics/exam.mjs MODEL_DIR [MODEL_DIR...] [--runs 10] [--only D1,N4] [--fam doors,toys] [--part 0/4]
//        [--raw] [--threads 8] [--out f.json] [--monster nightmare --policy P.json]
//   --raw: no crutches (no coherent catches, no walls): the model alone
//   --part k/P: only cases i with i % P === k, to split the exam over P processes (merge their --out files)
import * as ort from 'onnxruntime-web';
import { readFileSync, writeFileSync } from 'node:fs';
import { CASES } from './cases.mjs';
import { playRules, playModel, setMonster } from './play.mjs';
import { setNightmarePolicy, mlpPolicy } from '../../src/sim/mind/nightmare.js';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i < 0 ? d : args[i + 1]; };
const dirs = args.filter((a, i) => !a.startsWith('--') && !(args[i - 1] || '').match(/^--(runs|only|fam|part|threads|out|monster|policy)$/));
const RUNS = Number(opt('runs', 10)), RAW = args.includes('--raw');
const ONLY = opt('only', '') ? new Set(opt('only').split(',')) : null, FAM = opt('fam', '') ? new Set(opt('fam').split(',')) : null;
const [PART, PARTS] = opt('part', '0/1').split('/').map(Number);
ort.env.wasm.numThreads = Number(opt('threads', 8));
// --monster nightmare --policy P.json: the cases against the learned monster (for models trained on data v4)
if (opt('monster')) setMonster(opt('monster'));
if (opt('policy')) setNightmarePolicy(mlpPolicy(JSON.parse(readFileSync(opt('policy'), 'utf8'))));
const cases = CASES.filter((c, i) => i % PARTS === PART && (!ONLY || ONLY.has(c.id)) && (!FAM || FAM.has(c.fam)));
const MIND = Object.fromEntries(['mind', 'belief', 'pending', 'sense'].map((k) => [k, 1]));
const decodeOpt = { temp: 1, mix: 0.3, mixFor: { ...MIND, kid: 0 }, topP: 0.9, snap: true, peak: true };
const W = Math.max(4, ...cases.map((c) => c.id.length));

const report = { runs: RUNS, raw: RAW, part: `${PART}/${PARTS}`, models: {} };
for (const dir of dirs) {
  const meta = JSON.parse(readFileSync(`${dir}/play.json`, 'utf8'));
  const session = await ort.InferenceSession.create(`${dir}/packed.onnx`);
  const run = async (x) => (await session.run({ x: new ort.Tensor('float32', x, [1, x.length]) })).y.data;
  const name = dir.replace(/\/$/, '').split(/[\\/]/).pop(), rows = [], fams = {};
  const secs = cases.reduce((s, c) => s + c.secs, 0);
  console.log(`\n${name}${RAW ? ' (raw: no crutches)' : ''}: ${cases.length} cases x ${RUNS} runs (${secs.toFixed(0)} game-seconds a run)${PARTS > 1 ? `, part ${PART}/${PARTS}` : ''}`);
  let total = 0;
  for (const c of cases) {
    const rules = playRules(c).why;
    let pass = 0; const fails = [];
    for (let r = 0; r < RUNS; r++) {
      const { why } = await playModel(c, meta, run, { seed: 1 + r, decodeOpt, crutches: !RAW });
      if (why === null) pass++; else fails.push(why);
    }
    total += pass;
    const f = (fams[c.fam] ||= { pass: 0, runs: 0, ok: 0, cases: 0 });
    f.pass += pass; f.runs += RUNS; f.cases++; if (pass === RUNS) f.ok++;
    const mark = pass === RUNS ? 'ok  ' : pass >= RUNS * 0.7 ? 'meh ' : 'FAIL';
    console.log(`${mark} ${c.id.padEnd(W)} ${String(pass).padStart(2)}/${RUNS}  ${c.what}${rules ? `  [rules fail too: ${rules}]` : ''}${fails.length ? `\n${' '.repeat(W + 13)}e.g. ${fails[0]}` : ''}`);
    rows.push({ id: c.id, fam: c.fam, what: c.what, pass, runs: RUNS, rules_ok: rules === null, example_fail: fails[0] ?? null });
  }
  // by family: cases passed every run / cases, and runs passed / runs
  console.log(`\n${name} by family:`);
  for (const [k, f] of Object.entries(fams)) console.log(`  ${k.padEnd(10)} ${String(f.ok).padStart(3)}/${String(f.cases).padEnd(3)} cases every run   ${String(f.pass).padStart(4)}/${f.runs} runs (${(100 * f.pass / f.runs).toFixed(0)}%)`);
  console.log(`${name}: ${total}/${cases.length * RUNS} (${(100 * total / (cases.length * RUNS)).toFixed(0)}%)`);
  report.models[name] = { rows, families: fams };
}
if (opt('out')) writeFileSync(opt('out'), JSON.stringify(report, null, 1));
