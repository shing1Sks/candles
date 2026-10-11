// The main model's own thread: it holds the state row, runs the model on it 20 times a second (or as fast as it can),
// decides every number, flag and choice, and posts each new row to the game. The game's thread only draws and reads
// your input, so neither waits on the other.
//   in:  init { name, ep, int8, temp, mix, topP, mixFor, snap, gtemp, map, lockstep }, reset { row, persona }, input { ki, active } (any
//        time; with lockstep each step waits for an input sent after the last one: a bot answering every row)
//   out: ready { threads, isolated, stride }, step { prev, row, odds, ms }, error { message }
import * as ort from 'onnxruntime-web/webgpu';
import { decode } from './decode.js';
import { layout, patchIds, cohere } from './layout.js';
import { STATE_SIZE, KI_SIZE } from '../sim/schema.js';

const NG = 4 * 21 + 2 * 32; // the giant's stick and aim bins (train/model.py)
let session, meta, opts, map, col, x, at, row = null, epoch = 0;
// the kid's input: held keys as last sent, presses (use, throw: KI_FIELDS 4, 5) kept until a step uses them
const ki = new Float32Array(KI_SIZE);
let active = false, fresh = false, inflight = Promise.resolve(); // one model run at a time, across a reset

onmessage = async ({ data: m }) => {
  try {
    if (m.type === 'init') {
      opts = m; map = m.map; col = layout();
      meta = await (await fetch(`/models/${m.name}/play.json`)).json();
      if (meta.state !== STATE_SIZE || meta.ki !== KI_SIZE) throw new Error(`model ${m.name} was made for another schema`);
      ort.env.wasm.wasmPaths = '/node_modules/onnxruntime-web/dist/';
      ort.env.wasm.numThreads = Math.min(8, navigator.hardwareConcurrency || 4);
      // packed.onnx: one row in [cur | persona | tile ids | ki | giant noise | giant temp | button draws], one out
      // [gi | world | events] (on WebGPU every tensor moved costs a few ms)
      session = await ort.InferenceSession.create(`/models/${m.name}/${m.int8 ? 'packed_int8' : 'packed'}.onnx`,
        { executionProviders: [m.ep, 'wasm'], graphOptimizationLevel: 'all' });
      const sizes = [STATE_SIZE, meta.persona, 225, KI_SIZE, NG, 1, 7];
      at = sizes.map((_, i) => sizes.slice(0, i).reduce((a, b) => a + b, 0));
      x = new Float32Array(at[6] + 7);
      postMessage({ type: 'ready', threads: ort.env.wasm.numThreads, isolated: self.crossOriginIsolated, stride: meta.stride || 1 });
    } else if (m.type === 'reset') {
      row = Float32Array.from(m.row); x.set(m.persona, at[1]); ki.fill(0);
      loop(++epoch);
    } else if (m.type === 'input') {
      for (let i = 0; i < KI_SIZE; i++) ki[i] = i >= 4 ? Math.max(ki[i], m.ki[i]) : m.ki[i];
      active = m.active; fresh = true;
    }
  } catch (e) { postMessage({ type: 'error', message: e.message }); }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// a step every 1/20 s (or back to back if the model is slower); a new game starts a new loop, and the old one ends
async function loop(my) {
  const ids = new Float32Array(9 * 25);
  await inflight.catch(() => {});
  for (let t0 = performance.now(); my === epoch; ) {
    if (!active || (opts.lockstep && !fresh)) { await sleep(active ? 1 : 20); if (!active) t0 = performance.now(); continue; }
    fresh = false;
    const t1 = performance.now();
    patchIds(map, row, col, ids);
    x.set(row, at[0]); x.set(ids, at[2]); x.set(ki, at[3]); x[at[5]] = opts.gtemp;
    ki[4] = ki[5] = 0; // a press is used once
    for (let i = 0; i < NG; i++) x[at[4] + i] = -Math.log(-Math.log(Math.random() + 1e-12) + 1e-12);
    for (let i = 0; i < 7; i++) x[at[6] + i] = Math.random();
    inflight = session.run({ x: new ort.Tensor('float32', x, [1, x.length]) });
    const y = (await inflight).y.data;
    if (my !== epoch) return;
    const prev = row;
    row = decode(meta, y.subarray(13, 13 + meta.world), prev, { temp: opts.temp, mix: opts.mix, topP: opts.topP, mixFor: opts.mixFor, snap: opts.snap });
    for (let i = 0; i < row.length; i++) row[i] = Math.min(2, Math.max(-2, row[i])); // a runaway number cannot run far
    if (opts.cohere !== false) cohere(prev, row, col, map);
    postMessage({ type: 'step', prev, row, odds: y.slice(13 + meta.world), ms: performance.now() - t1 });
    const wait = 50 * (meta.stride || 1) - (performance.now() - t0); // a step is 0.05 s x the model's stride
    if (wait > 0) await sleep(wait);
    t0 = performance.now();
  }
}
