// The mechanics exam: every case in cases.mjs played inside a main model's world, `runs` times (the monster's mind
// and the model's doubt are drawn, so a case can pass one time and fail the next). Decoding as in play (?model=):
// kid exact, mind drawn, the rest at 0.3, top-p 0.9, snap, peak, coherent catches, walls.
//   node tools/mechanics/exam.mjs MODEL_DIR [MODEL_DIR...] [--runs 10] [--only D1,N4] [--raw] [--threads 8] [--out f.json]
//   --raw: no crutches (no coherent catches, no walls): the model alone
import * as ort from 'onnxruntime-web';
import { readFileSync, writeFileSync } from 'node:fs';
import { CASES } from './cases.mjs';
import { playRules, playModel } from './play.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i < 0 ? d : args[i + 1]; };
const dirs = args.filter((a, i) => !a.startsWith('--') && !(args[i - 1] || '').match(/^--(runs|only|threads|out)$/));
const RUNS = Number(opt('runs', 10)), ONLY = opt('only', '') ? new Set(opt('only').split(',')) : null, RAW = args.includes('--raw');
ort.env.wasm.numThreads = Number(opt('threads', 8));
const cases = CASES.filter((c) => !ONLY || ONLY.has(c.id));
const MIND = Object.fromEntries(['mind', 'belief', 'pending', 'sense'].map((k) => [k, 1]));
const decodeOpt = { temp: 1, mix: 0.3, mixFor: { ...MIND, kid: 0 }, topP: 0.9, snap: true, peak: true };

const report = { runs: RUNS, raw: RAW, models: {} };
for (const dir of dirs) {
  const meta = JSON.parse(readFileSync(`${dir}/play.json`, 'utf8'));
  const session = await ort.InferenceSession.create(`${dir}/packed.onnx`);
  const run = async (x) => (await session.run({ x: new ort.Tensor('float32', x, [1, x.length]) })).y.data;
  const name = dir.replace(/\/$/, '').split(/[\\/]/).pop(), rows = [];
  console.log(`\n${name}${RAW ? ' (raw: no crutches)' : ''}: ${cases.length} cases x ${RUNS} runs`);
  let total = 0;
  for (const c of cases) {
    const rules = playRules(c).why;
    let pass = 0; const fails = [];
    for (let r = 0; r < RUNS; r++) {
      const { why } = await playModel(c, meta, run, { seed: 1 + r, decodeOpt, crutches: !RAW });
      if (why === null) pass++; else fails.push(why);
    }
    total += pass;
    const mark = pass === RUNS ? 'ok  ' : pass >= RUNS * 0.7 ? 'meh ' : 'FAIL';
    console.log(`${mark} ${c.id.padEnd(4)} ${String(pass).padStart(2)}/${RUNS}  ${c.what}${rules ? `  [rules fail too: ${rules}]` : ''}${fails.length ? `\n            e.g. ${fails[0]}` : ''}`);
    rows.push({ id: c.id, what: c.what, pass, runs: RUNS, rules_ok: rules === null, example_fail: fails[0] ?? null });
  }
  console.log(`${name}: ${total}/${cases.length * RUNS} (${(100 * total / (cases.length * RUNS)).toFixed(0)}%)`);
  report.models[name] = rows;
}
if (opt('out')) writeFileSync(opt('out'), JSON.stringify(report, null, 1));
