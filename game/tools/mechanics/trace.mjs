// One mechanics case played inside a model's world, step by step: where the kid and the monster are, the monster's
// mind, and the stick the model's giant pushes. For finding out why a case fails.
//   node tools/mechanics/trace.mjs MODEL_DIR CASE_ID [--seed 1] [--rules]
import * as ort from 'onnxruntime-web';
import { readFileSync } from 'node:fs';
import { CASES } from './cases.mjs';
import { playModel, playRules } from './play.mjs';

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(`--${k}`); return i < 0 ? d : args[i + 1]; };
const [dir, id] = args, c0 = CASES.find((c) => c.id === id);
let gi = null;
const show = (G, t) => {
  const k = G.kid, M = G.monster;
  console.log(`${t.toFixed(2).padStart(5)}  kid ${k.x.toFixed(2)},${k.z.toFixed(2)}  mon ${M.x.toFixed(2)},${M.z.toFixed(2)} v ${M.speed.toFixed(2)} ${M.act.padEnd(7)} ${M.awake ? 'awake' : 'asleep'} ${M.sees ? 'sees' : '    '}  mind ${G.mind.mode.padEnd(8)}${gi ? `  stick ${gi[0].toFixed(2)},${gi[1].toFixed(2)} run ${gi[2].toFixed(2)}` : ''}  ${G.state}`);
};
const c = { ...c0, each: (G, s, t) => { c0.each?.(G, s, t); show(G, t); } };
if (args.includes('--rules')) { console.log(playRules(c).why ?? 'pass'); process.exit(0); }
const meta = JSON.parse(readFileSync(`${dir}/play.json`, 'utf8'));
const session = await ort.InferenceSession.create(`${dir}/packed.onnx`);
const run = async (x) => { const y = (await session.run({ x: new ort.Tensor('float32', x, [1, x.length]) })).y.data; gi = y.subarray(0, 13); return y; };
const MIND = Object.fromEntries(['mind', 'belief', 'pending', 'sense'].map((k) => [k, 1]));
const { why } = await playModel(c, meta, run, { seed: Number(opt('seed', 1)), decodeOpt: { temp: 1, mix: 0.3, mixFor: { ...MIND, kid: 0 }, topP: 0.9, snap: true, peak: true } });
console.log(why ?? 'pass');
