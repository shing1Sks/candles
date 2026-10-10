// Speed of the main model in the browser: for each size and backend, load the two stages and time ticks
// (stage A -> the giant's buttons; stage B -> the next state), the way the game will call them.
import * as ort from 'onnxruntime-web/webgpu';
import { decode } from './model/decode.js';

ort.env.wasm.wasmPaths = '/node_modules/onnxruntime-web/dist/';
if (q0().has('verbose')) ort.env.logLevel = 'verbose';
if (q0().has('prof')) ort.env.webgpu.profiling = { mode: 'default' };
function q0() { return new URLSearchParams(location.search); }
ort.env.wasm.numThreads = navigator.hardwareConcurrency ? Math.min(8, navigator.hardwareConcurrency) : 4;
const q = new URLSearchParams(location.search);
const sizes = (q.get('sizes') || 'S,M').split(','), eps = (q.get('ep') || 'webgpu,wasm').split(','), TICKS = Number(q.get('ticks') || 60);
const out = document.getElementById('out');
const say = (s) => { out.textContent += s + '\n'; console.log(s); };
out.textContent = `${navigator.gpu ? 'WebGPU available' : 'no WebGPU'}; wasm threads ${ort.env.wasm.numThreads}; crossOriginIsolated ${self.crossOriginIsolated}\n`;
window.__bench = [];

async function bench(size, ep) {
  const heads = await (await fetch(`/models/${size}/heads.json`)).json();
  const opts = { executionProviders: [ep], graphOptimizationLevel: 'all' };
  const t0 = performance.now();
  const A = await ort.InferenceSession.create(`/models/${size}/stage_a.onnx`, ep === 'webgpu' ? { ...opts, preferredOutputLocation: { tokens: 'gpu-buffer' } } : opts);
  const B = await ort.InferenceSession.create(`/models/${size}/stage_b.onnx`, opts);
  const load = performance.now() - t0;
  const S = 311, P = 15;
  const feedA = { cur: new ort.Tensor('float32', new Float32Array(S).map(() => Math.random()), [1, S]), persona: new ort.Tensor('float32', new Float32Array(P), [1, P]) };
  const ki = new ort.Tensor('float32', new Float32Array(6), [1, 6]), gi = new ort.Tensor('float32', new Float32Array(13), [1, 13]);
  const tick = async () => {
    const a = await A.run(feedA);
    await a.giant.getData(); // the giant's buttons come back to the game, which draws them
    const b = await B.run({ tokens: a.tokens, ki, gi });
    const world = await b.world.getData();
    a.tokens.dispose?.();
    return world.length;
  };
  for (let i = 0; i < 8; i++) await tick(); // warm up
  const times = [];
  for (let i = 0; i < TICKS; i++) { const s = performance.now(); await tick(); times.push(performance.now() - s); }
  times.sort((x, y) => x - y);
  const med = times[Math.floor(times.length / 2)], p90 = times[Math.floor(times.length * 0.9)];
  const r = { size, ep, load_ms: Math.round(load), median_ms: +med.toFixed(1), p90_ms: +p90.toFixed(1), ticks_per_s: +(1000 / med).toFixed(1) };
  window.__bench.push(r);
  say(`${size.padEnd(3)} ${ep.padEnd(7)} median ${r.median_ms} ms/tick (p90 ${r.p90_ms})  -> ${r.ticks_per_s} ticks/s   (load ${r.load_ms} ms)`);
  await A.release(); await B.release();
}

// the play graphs (?play=1): tile ids in, head outputs out, decoded here into the next state row, as the game will run them
async function benchPlay(size, ep) {
  const meta = await (await fetch(`/models/play_${size}/play.json`)).json();
  const opts = { executionProviders: [ep], graphOptimizationLevel: 'all' };
  const t0 = performance.now();
  const A = await ort.InferenceSession.create(`/models/play_${size}/play_a.onnx`, ep === 'webgpu' ? { ...opts, preferredOutputLocation: { tokens: 'gpu-buffer' } } : opts);
  const B = await ort.InferenceSession.create(`/models/play_${size}/play_b.onnx`, opts);
  const load = performance.now() - t0;
  const f32 = (n, fill) => new Float32Array(n).fill(fill ?? 0);
  const cur = new ort.Tensor('float32', f32(meta.state).map(() => Math.random()), [1, meta.state]);
  const persona = new ort.Tensor('float32', f32(meta.persona), [1, meta.persona]);
  const ids = new ort.Tensor('float32', f32(9 * 25), [1, 9, 5, 5]);
  const ki = new ort.Tensor('float32', f32(meta.ki), [1, meta.ki]), gi = new ort.Tensor('float32', f32(meta.gi), [1, meta.gi]);
  let row = cur.data;
  const tick = async () => {
    const t0 = performance.now();
    const a = await A.run({ cur, persona, ids });
    await a.giant.getData();
    split.a += performance.now() - t0;
    const b = await B.run({ tokens: a.tokens, ki, gi });
    row = decode(meta, await b.world.getData(), row, { temp: 1, mix: 0.3 }); // the game decides every number, flag and choice
    await b.events.getData();
    const next = row;
    split.b += performance.now() - t0;
    a.tokens.dispose?.();
    return next.length;
  };
  const split = { a: 0, b: 0 };
  for (let i = 0; i < 8; i++) await tick();
  split.a = split.b = 0;
  const times = [];
  for (let i = 0; i < TICKS; i++) { const s = performance.now(); await tick(); times.push(performance.now() - s); }
  times.sort((x, y) => x - y);
  const med = times[Math.floor(times.length / 2)], p90 = times[Math.floor(times.length * 0.9)];
  const r = { size, ep, play: true, load_ms: Math.round(load), median_ms: +med.toFixed(1), p90_ms: +p90.toFixed(1), ticks_per_s: +(1000 / med).toFixed(1) };
  window.__bench.push(r);
  say(`play ${size.padEnd(3)} ${ep.padEnd(7)} median ${r.median_ms} ms/tick (p90 ${r.p90_ms})  -> ${r.ticks_per_s} ticks/s   (load ${r.load_ms} ms; A ${(split.a / TICKS).toFixed(1)} ms, A+B ${(split.b / TICKS).toFixed(1)} ms)`);
  await A.release(); await B.release();
}

// the fused graph (?play=fused): the whole tick in one run; the giant's buttons decided in the graph
async function benchFused(size, ep) {
  const meta = await (await fetch(`/models/play_${size}/play.json`)).json();
  const t0 = performance.now();
  const P = await ort.InferenceSession.create(`/models/play_${size}/${q.get('file') || 'play'}.onnx`, { executionProviders: [ep], graphOptimizationLevel: 'all' });
  const load = performance.now() - t0;
  const f32 = (n, fill) => new Float32Array(n).fill(fill ?? 0);
  const T = (a, dims) => new ort.Tensor('float32', a, dims);
  let row = f32(meta.state).map(() => Math.random());
  const persona = T(f32(meta.persona), [1, meta.persona]), ids = T(f32(9 * 25), [1, 9, 5, 5]), ki = T(f32(meta.ki), [1, meta.ki]);
  const NG = 4 * 21 + 2 * 32;
  const gumbel = (n) => { const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = -Math.log(-Math.log(Math.random() + 1e-12) + 1e-12); return a; };
  const tick = async () => {
    const o = await P.run({ cur: T(row, [1, meta.state]), persona, ids, ki, gnoise: T(gumbel(NG), [1, NG]), gtemp: T(f32(1, 1), [1]),
      gu: T(f32(7).map(() => Math.random()), [1, 7]) });
    row = decode(meta, o.world.data, row, { temp: 1, mix: 0.3 }).map((v) => Math.min(1, Math.max(0, v)));
    return o.gi.data.length + o.events.data.length;
  };
  for (let i = 0; i < 8; i++) await tick();
  const times = [];
  for (let i = 0; i < TICKS; i++) { const s = performance.now(); await tick(); times.push(performance.now() - s); }
  times.sort((x, y) => x - y);
  const med = times[Math.floor(times.length / 2)], p90 = times[Math.floor(times.length * 0.9)];
  const r = { size, ep, play: 'fused', load_ms: Math.round(load), median_ms: +med.toFixed(1), p90_ms: +p90.toFixed(1), ticks_per_s: +(1000 / med).toFixed(1) };
  window.__bench.push(r);
  say(`fused ${size.padEnd(3)} ${ep.padEnd(7)} median ${r.median_ms} ms/tick (p90 ${r.p90_ms})  -> ${r.ticks_per_s} ticks/s   (load ${r.load_ms} ms)`);
  await P.release();
}

// the fused graph with WebGPU graph capture (?play=capture): the first run records the GPU commands, later runs replay
// them; inputs and outputs live in GPU buffers we write and read ourselves
async function benchCapture(size) {
  const meta = await (await fetch(`/models/play_${size}/play.json`)).json();
  const t0 = performance.now();
  const P = await ort.InferenceSession.create(`/models/play_${size}/play.onnx`, { executionProviders: ['webgpu'], graphOptimizationLevel: 'all', enableGraphCapture: true });
  const load = performance.now() - t0;
  const dev = ort.env.webgpu.device, U = GPUBufferUsage;
  const gpu = (n, dims) => { const b = dev.createBuffer({ size: Math.ceil(n * 4 / 16) * 16, usage: U.STORAGE | U.COPY_SRC | U.COPY_DST }); return { b, n, t: ort.Tensor.fromGpuBuffer(b, { dataType: 'float32', dims }) }; };
  const NG = 4 * 21 + 2 * 32;
  const I = { cur: gpu(meta.state, [1, meta.state]), persona: gpu(meta.persona, [1, meta.persona]), ids: gpu(225, [1, 9, 5, 5]), ki: gpu(meta.ki, [1, meta.ki]),
    gnoise: gpu(NG, [1, NG]), gtemp: gpu(1, [1]), gu: gpu(7, [1, 7]) };
  const O = { gi: gpu(13, [1, 13]), world: gpu(meta.world, [1, meta.world]), events: gpu(meta.events, [1, meta.events]) };
  const outBytes = Object.values(O).reduce((a, o) => a + o.b.size, 0);
  const stage = dev.createBuffer({ size: outBytes, usage: U.MAP_READ | U.COPY_DST });
  const put = (o, a) => dev.queue.writeBuffer(o.b, 0, a.buffer, a.byteOffset, a.byteLength);
  const f32 = (n, fill) => new Float32Array(n).fill(fill ?? 0);
  let row = f32(meta.state).map(() => Math.random());
  put(I.persona, f32(meta.persona)); put(I.ids, f32(225)); put(I.ki, f32(meta.ki)); put(I.gtemp, f32(1, 1));
  const feeds = Object.fromEntries(Object.entries(I).map(([k, o]) => [k, o.t])), fetches = Object.fromEntries(Object.entries(O).map(([k, o]) => [k, o.t]));
  const gumbel = (n) => { const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = -Math.log(-Math.log(Math.random() + 1e-12) + 1e-12); return a; };
  const tick = async () => {
    put(I.cur, row); put(I.gnoise, gumbel(NG)); put(I.gu, f32(7).map(() => Math.random()));
    await P.run(feeds, fetches);
    const enc = dev.createCommandEncoder();
    let o = 0;
    for (const x of Object.values(O)) { enc.copyBufferToBuffer(x.b, 0, stage, o, x.b.size); o += x.b.size; }
    dev.queue.submit([enc.finish()]);
    await stage.mapAsync(GPUMapMode.READ);
    const all = new Float32Array(stage.getMappedRange().slice(0));
    stage.unmap();
    const world = all.subarray(O.gi.b.size / 4, O.gi.b.size / 4 + meta.world);
    row = decode(meta, world, row, { temp: 1, mix: 0.3 }).map((v) => Math.min(1, Math.max(0, v)));
    return world.length;
  };
  for (let i = 0; i < 8; i++) await tick();
  const times = [];
  for (let i = 0; i < TICKS; i++) { const s = performance.now(); await tick(); times.push(performance.now() - s); }
  times.sort((x, y) => x - y);
  const med = times[Math.floor(times.length / 2)], p90 = times[Math.floor(times.length * 0.9)];
  const r = { size, ep: 'webgpu', play: 'capture', load_ms: Math.round(load), median_ms: +med.toFixed(1), p90_ms: +p90.toFixed(1), ticks_per_s: +(1000 / med).toFixed(1) };
  window.__bench.push(r);
  say(`capture ${size.padEnd(3)} webgpu  median ${r.median_ms} ms/tick (p90 ${r.p90_ms})  -> ${r.ticks_per_s} ticks/s   (load ${r.load_ms} ms)`);
  await P.release();
}

// the packed graph (?play=packed): one input row, one output row
async function benchPacked(size, ep) {
  const meta = await (await fetch(`/models/play_${size}/play.json`)).json();
  const t0 = performance.now();
  const P = await ort.InferenceSession.create(`/models/play_${size}/packed.onnx`, { executionProviders: [ep], graphOptimizationLevel: 'all' });
  const load = performance.now() - t0;
  const NG = 4 * 21 + 2 * 32, sizes = [meta.state, meta.persona, 225, meta.ki, NG, 1, 7];
  const N = sizes.reduce((a, b) => a + b), at = sizes.map((_, i) => sizes.slice(0, i).reduce((a, b) => a + b, 0));
  const x = new Float32Array(N);
  let row = new Float32Array(meta.state).map(() => Math.random());
  x[at[5]] = 1;
  const tick = async () => {
    x.set(row, 0);
    for (let i = 0; i < NG; i++) x[at[4] + i] = -Math.log(-Math.log(Math.random() + 1e-12) + 1e-12);
    for (let i = 0; i < 7; i++) x[at[6] + i] = Math.random();
    const o = await P.run({ x: new ort.Tensor('float32', x, [1, N]) });
    const y = o.y.data, world = y.subarray(13, 13 + meta.world);
    row = decode(meta, world, row, { temp: 1, mix: 0.3 }).map((v) => Math.min(1, Math.max(0, v)));
    return y.length;
  };
  for (let i = 0; i < 8; i++) await tick();
  const times = [];
  for (let i = 0; i < TICKS; i++) { const s = performance.now(); await tick(); times.push(performance.now() - s); }
  times.sort((a, b) => a - b);
  const med = times[Math.floor(times.length / 2)], p90 = times[Math.floor(times.length * 0.9)];
  const r = { size, ep, play: 'packed', load_ms: Math.round(load), median_ms: +med.toFixed(1), p90_ms: +p90.toFixed(1), ticks_per_s: +(1000 / med).toFixed(1) };
  window.__bench.push(r);
  say(`packed ${size.padEnd(3)} ${ep.padEnd(7)} median ${r.median_ms} ms/tick (p90 ${r.p90_ms})  -> ${r.ticks_per_s} ticks/s   (load ${r.load_ms} ms)`);
  await P.release();
}

// packed + WebGPU graph capture (?play=pcap): one GPU buffer in, one out, the GPU commands recorded once and replayed
async function benchPackedCapture(size) {
  const meta = await (await fetch(`/models/play_${size}/play.json`)).json();
  const t0 = performance.now();
  const P = await ort.InferenceSession.create(`/models/play_${size}/packed.onnx`, { executionProviders: ['webgpu'], graphOptimizationLevel: 'all', enableGraphCapture: true });
  const load = performance.now() - t0;
  const NG = 4 * 21 + 2 * 32, sizes = [meta.state, meta.persona, 225, meta.ki, NG, 1, 7];
  const N = sizes.reduce((a, b) => a + b), at = sizes.map((_, i) => sizes.slice(0, i).reduce((a, b) => a + b, 0));
  const NY = 13 + meta.world + meta.events;
  const dev = ort.env.webgpu.device, U = GPUBufferUsage, pad = (n) => Math.ceil(n * 4 / 16) * 16;
  const xb = dev.createBuffer({ size: pad(N), usage: U.STORAGE | U.COPY_SRC | U.COPY_DST }), yb = dev.createBuffer({ size: pad(NY), usage: U.STORAGE | U.COPY_SRC | U.COPY_DST });
  const stage = dev.createBuffer({ size: pad(NY), usage: U.MAP_READ | U.COPY_DST });
  const feeds = { x: ort.Tensor.fromGpuBuffer(xb, { dataType: 'float32', dims: [1, N] }) }, fetches = { y: ort.Tensor.fromGpuBuffer(yb, { dataType: 'float32', dims: [1, NY] }) };
  const x = new Float32Array(N);
  let row = new Float32Array(meta.state).map(() => Math.random());
  x[at[5]] = 1;
  const tick = async () => {
    x.set(row, 0);
    for (let i = 0; i < NG; i++) x[at[4] + i] = -Math.log(-Math.log(Math.random() + 1e-12) + 1e-12);
    for (let i = 0; i < 7; i++) x[at[6] + i] = Math.random();
    dev.queue.writeBuffer(xb, 0, x);
    await P.run(feeds, fetches);
    const e = dev.createCommandEncoder(); e.copyBufferToBuffer(yb, 0, stage, 0, pad(NY)); dev.queue.submit([e.finish()]);
    await stage.mapAsync(GPUMapMode.READ);
    const y = new Float32Array(stage.getMappedRange().slice(0)); stage.unmap();
    row = decode(meta, y.subarray(13, 13 + meta.world), row, { temp: 1, mix: 0.3 }).map((v) => Math.min(1, Math.max(0, v)));
    return y.length;
  };
  for (let i = 0; i < 8; i++) await tick();
  const times = [];
  for (let i = 0; i < TICKS; i++) { const s = performance.now(); await tick(); times.push(performance.now() - s); }
  times.sort((a, b) => a - b);
  const med = times[Math.floor(times.length / 2)], p90 = times[Math.floor(times.length * 0.9)];
  const r = { size, ep: 'webgpu', play: 'pcap', load_ms: Math.round(load), median_ms: +med.toFixed(1), p90_ms: +p90.toFixed(1), ticks_per_s: +(1000 / med).toFixed(1) };
  window.__bench.push(r);
  say(`pcap ${size.padEnd(3)} webgpu  median ${r.median_ms} ms/tick (p90 ${r.p90_ms})  -> ${r.ticks_per_s} ticks/s   (load ${r.load_ms} ms)`);
  await P.release();
}

const play = q.get('play');
for (const ep of eps) for (const size of sizes) {
  try { await (play === 'pcap' ? benchPackedCapture : play === 'packed' ? benchPacked : play === 'capture' ? benchCapture : play === 'fused' ? benchFused : play ? benchPlay : bench)(size, ep); } catch (e) { say(`${size} ${ep} FAILED: ${e.message}`); window.__bench.push({ size, ep, error: e.message }); }
}
say('done'); window.__benchDone = true;
