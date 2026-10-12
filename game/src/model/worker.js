// The main model's own thread: it holds the state row, runs the model on it 20 times a second (or as fast as it can),
// decides every number, flag and choice, and posts each new row to the game. The game's thread only draws and reads
// your input, so neither waits on the other.
//   in:  init { name, ep, int8, temp, mix, topP, mixFor, snap, gtemp, map, lockstep, brain }, reset { row, persona, mind, seed }, input { ki, active } (any
//        time; with lockstep each step waits for an input sent after the last one: a bot answering every row)
//   brain: the monster's brain is a second player here (brain.js): it reads each row and its buttons go into the model
//        (packed_brain.onnx) instead of the model's own guess of them; reset's mind is its persona ({ type: 'nightmare' })
//   out: progress { stage: download (got, total, cached) | compile | warm }, ready { threads, isolated, stride, ms },
//        step { prev, row, odds, ms }, error { message }
import * as ort from 'onnxruntime-web/webgpu';
import { decode } from './decode.js';
import { layout, viewIds, cohere, unwall } from './layout.js';
import { STATE_SIZE, KI_SIZE, GI_SIZE } from '../sim/schema.js';
import { createBrain } from './brain.js';
import { parseLevel } from '../sim/level.js';
import { setNightmarePolicy, mlpPolicy } from '../sim/mind/nightmare.js';

const MODELS = import.meta.env.VITE_MODEL_BASE || '/models/'; // where the models are served (a host of big files can be set at build)
const NG = 4 * 21 + 2 * 32; // the giant's stick and aim bins (train/model.py)
let session, meta, opts, map, col, x, at, row = null, epoch = 0, brain = null, house = null;
// the kid's input: held keys as last sent, presses (use, throw: KI_FIELDS 4, 5) kept until a step uses them
const ki = new Float32Array(KI_SIZE);
let active = false, fresh = false, inflight = Promise.resolve(); // one model run at a time, across a reset

onmessage = async ({ data: m }) => {
  try {
    if (m.type === 'init') {
      const t0 = performance.now();
      opts = m; map = m.map; col = layout();
      const base = `${MODELS}${m.name}/`;
      meta = await (await fetch(base + 'play.json')).json();
      if (meta.state !== STATE_SIZE || meta.ki !== KI_SIZE) throw new Error(`model ${m.name} was made for another schema`);
      ort.env.wasm.wasmPaths = import.meta.env.DEV ? '/node_modules/onnxruntime-web/dist/' : '/ort/'; // vite.config.js
      ort.env.wasm.numThreads = Math.min(8, navigator.hardwareConcurrency || 4);
      // packed.onnx: one row in [cur | persona | tile ids | ki | giant noise | giant temp | button draws], one out
      // [gi | world | events] (on WebGPU every tensor moved costs a few ms)
      if (m.brain) {
        house = parseLevel();
        setNightmarePolicy(mlpPolicy(await (await fetch('/nightmare.json')).json()));
      }
      const file = `${m.brain ? 'packed_brain' : 'packed'}${m.int8 ? '_int8' : ''}.onnx`;
      const bytes = await download(base, file, meta.ship, (got, total, cached) => postMessage({ type: 'progress', stage: 'download', got, total, cached }));
      postMessage({ type: 'progress', stage: 'compile' });
      session = await ort.InferenceSession.create(bytes, { executionProviders: [m.ep, 'wasm'], graphOptimizationLevel: 'all' });
      const sizes = m.brain ? [STATE_SIZE, meta.persona, meta.ids || 225, KI_SIZE, GI_SIZE] : [STATE_SIZE, meta.persona, meta.ids || 225, KI_SIZE, NG, 1, 7]; // ids: 225 patches, or (a whole-map model) the house too
      at = sizes.map((_, i) => sizes.slice(0, i).reduce((a, b) => a + b, 0));
      x = new Float32Array(at[at.length - 1] + sizes[sizes.length - 1]);
      // the first runs on a GPU compile its shaders (seconds): done here, so the game's first steps come at speed
      postMessage({ type: 'progress', stage: 'warm' });
      for (let i = 0; i < 3; i++) await session.run({ x: new ort.Tensor('float32', x, [1, x.length]) });
      postMessage({ type: 'ready', threads: ort.env.wasm.numThreads, isolated: self.crossOriginIsolated, stride: meta.stride || 1, ms: performance.now() - t0 });
    } else if (m.type === 'reset') {
      row = Float32Array.from(m.row); x.set(m.persona.slice(0, meta.persona), at[1]); ki.fill(0);
      if (opts.brain) brain = createBrain(house, m.mind, m.seed, col);
      loop(++epoch);
    } else if (m.type === 'input') {
      for (let i = 0; i < KI_SIZE; i++) ki[i] = i >= 4 ? Math.max(ki[i], m.ki[i]) : m.ki[i];
      active = m.active; fresh = true;
    }
  } catch (e) { postMessage({ type: 'error', message: e.message }); }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The model's bytes, with progress. A shipped model (tools/ship_model.mjs) comes in parts of under 25 MB, which any
// static host serves, and is kept in the browser's cache by its md5, so a second visit skips the download
async function download(base, file, ship, progress) {
  const shipped = ship?.file === file;
  const parts = shipped ? ship.parts.map((n, i) => ({ url: `${base}${file}.${i}`, n })) : [{ url: base + file, n: 0 }];
  const cache = shipped && self.caches ? await caches.open('candles-models').catch(() => null) : null;
  let total = parts.reduce((a, p) => a + p.n, 0), got = 0, cached = true;
  const bufs = [];
  for (const p of parts) {
    const key = `${p.url}?md5=${ship?.md5}`;
    const hit = cache && (await cache.match(key));
    if (hit) { const b = new Uint8Array(await hit.arrayBuffer()); bufs.push(b); got += b.length; progress(got, total, true); continue; }
    cached = false;
    const res = await fetch(p.url);
    if (!res.ok) throw new Error(`${p.url}: ${res.status}`);
    if (!total) total = Number(res.headers.get('content-length')) || 0;
    const chunks = [], reader = res.body.getReader();
    for (let r; !(r = await reader.read()).done; ) { chunks.push(r.value); got += r.value.length; progress(got, total, false); }
    const b = new Uint8Array(chunks.reduce((a, c) => a + c.length, 0));
    let o = 0; for (const c of chunks) { b.set(c, o); o += c.length; }
    bufs.push(b);
    cache?.put(key, new Response(b)).catch(() => {}); // a full disk: just no cache
  }
  progress(got, total, cached);
  if (bufs.length === 1) return bufs[0];
  const all = new Uint8Array(got);
  let o = 0; for (const b of bufs) { all.set(b, o); o += b.length; }
  return all;
}

// a step every 1/20 s (or back to back if the model is slower); a new game starts a new loop, and the old one ends
async function loop(my) {
  const ids = new Float32Array(meta.ids || 225);
  await inflight.catch(() => {});
  for (let t0 = performance.now(); my === epoch; ) {
    if (!active || (opts.lockstep && !fresh)) { await sleep(active ? 1 : 20); if (!active) t0 = performance.now(); continue; }
    fresh = false;
    const t1 = performance.now();
    viewIds(map, row, col, ids);
    x.set(row, at[0]); x.set(ids, at[2]); x.set(ki, at[3]);
    ki[4] = ki[5] = 0; // a press is used once
    if (brain) x.set(brain.decide(row, 0.05 * (meta.stride || 1)).gi, at[4]); // the brain's buttons
    else {
      x[at[5]] = opts.gtemp;
      for (let i = 0; i < NG; i++) x[at[4] + i] = -Math.log(-Math.log(Math.random() + 1e-12) + 1e-12);
      for (let i = 0; i < 7; i++) x[at[6] + i] = Math.random();
    }
    inflight = session.run({ x: new ort.Tensor('float32', x, [1, x.length]) });
    const y = (await inflight).y.data;
    if (my !== epoch) return;
    const prev = row;
    const w0 = brain ? 0 : 13; // the packed graph puts the giant's buttons first
    row = decode(meta, y.subarray(w0, w0 + meta.world), prev, { temp: opts.temp, mix: opts.mix, topP: opts.topP, mixFor: opts.mixFor, snap: opts.snap, peak: opts.peak });
    for (let i = 0; i < row.length; i++) row[i] = Math.min(2, Math.max(-2, row[i])); // a runaway number cannot run far
    if (opts.cohere !== false) cohere(prev, row, col, map);
    if (opts.walls !== false) unwall(prev, row, col, map);
    if (brain) brain.write(row); // its plans, moods and guesses are its own
    postMessage({ type: 'step', prev, row, odds: y.slice(w0 + meta.world), ms: performance.now() - t1 });
    const wait = 50 * (meta.stride || 1) - (performance.now() - t0); // a step is 0.05 s x the model's stride
    if (wait > 0) await sleep(wait);
    t0 = performance.now();
  }
}
