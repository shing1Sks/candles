// The rollout exam: does the main model hold up as a game, not just one step at a time? The same games (seed, monster
// type, kid bot, start) are played twice: once by the rules (src/sim) and once inside the model's world (the model
// runs every step on its own output, as in ?model=). Then what happened in each is compared.
//   node tools/dream_exam.mjs MODEL_DIR [--games 8] [--seconds 120] [--batch exam] [--int8] [--mix 0.3] [--mind 1]
//        [--top_p 0.9] [--snap] [--cohere] [--mixfor game=1,...] [--part k/P] [--threads 8] [--out file.json]       (--part: only games i with i % P == k, for parallel runs)
//   node tools/dream_exam.mjs --merge part0.json part1.json ... [--out file.json]
import * as ort from 'onnxruntime-web';
import { writeFileSync } from 'node:fs';
import { configFor, createEpisode, startEpisode, stepEpisode, episodeOver, STEP } from '../src/sim/episode.js';
import { observeKid } from '../src/sim/bots/kid.js';
import { encode, encodeKI, STATE_SIZE, KI_SIZE } from '../src/sim/schema.js';
import { decode } from '../src/model/decode.js';
import { layout, viewIds, personaVec, cohere, unwall } from '../src/model/layout.js';
import { apply, events } from '../src/model/dream.js';
import { readFileSync, existsSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i < 0 ? d : args[i + 1]; };
const dir = args[0], GAMES = Number(opt('games', 8)), SECONDS = Number(opt('seconds', 120)), BATCH = opt('batch', 'exam');
const MIX = Number(opt('mix', 0.3)), INT8 = args.includes('--int8'), TOP_P = Number(opt('top_p', 1)), SNAP = args.includes('--snap'), PEAK = args.includes('--peak'), COHERE = args.includes('--cohere'), WALLS = args.includes('--walls'), KEYS = Number(opt('keys', 0)); // --keys 1: every kid played as on a keyboard
// --mind 1: the monster's mind pieces drawn at this mix (decode.js mixFor)
const MIND = opt('mind', null), MIX_FOR = MIND === null ? {} : Object.fromEntries(['mind', 'belief', 'pending', 'sense'].map((k) => [k, Number(MIND)]));
// --mixfor game=1,monster=0.5: a mix for any kinds of piece
for (const kv of (opt('mixfor', '') || '').split(',').filter(Boolean)) { const [k, v] = kv.split('='); MIX_FOR[k] = Number(v); }
ort.env.wasm.numThreads = Number(opt('threads', 8));
if (args[0] === '--merge') {  // parts of one exam, run in parallel: one report
  const files = args.slice(1).filter((f, i, a) => f.endsWith('.json') && a[i - 1] !== '--out'), parts = files.map((f) => JSON.parse(readFileSync(f, 'utf8')));
  const R = parts.flatMap((p) => p.games.rules), D = parts.flatMap((p) => p.games.model);
  const report = { ...parts[0], games: undefined, parts: files.length, rules: sum(R), model_world: sum(D) };
  console.log(JSON.stringify(report, null, 1));
  if (opt('out')) writeFileSync(opt('out'), JSON.stringify({ ...report, games: { rules: R, model: D } }, null, 1));
  process.exit(0);
}
const meta = JSON.parse(readFileSync(`${dir}/play.json`, 'utf8')), STRIDE = meta.stride || 1; // a step is 0.05 x stride s
// packed.onnx (one row in, one out); older exports have only play.onnx (the same graph with its inputs apart)
const packed = existsSync(`${dir}/packed.onnx`);
const session = await ort.InferenceSession.create(`${dir}/${packed ? (INT8 ? 'packed_int8' : 'packed') : 'play'}.onnx`);
async function run(x) {
  if (packed) return (await session.run({ x: new ort.Tensor('float32', x, [1, x.length]) })).y.data;
  const T = (i, dims) => new ort.Tensor('float32', x.slice(at[i], at[i] + sizes[i]), dims);
  const o = await session.run({ cur: T(0, [1, sizes[0]]), persona: T(1, [1, sizes[1]]), ids: T(2, [1, 9, 5, 5]), ki: T(3, [1, sizes[3]]),
    gnoise: T(4, [1, sizes[4]]), gtemp: T(5, [1]), gu: T(6, [1, 7]) });
  const y = new Float32Array(13 + meta.world + meta.events);
  y.set(o.gi.data, 0); y.set(o.world.data, 13); y.set(o.events.data, 13 + meta.world);
  return y;
}
const col = layout(), NG = 4 * 21 + 2 * 32;
const sizes = [STATE_SIZE, meta.persona, meta.ids || 225, KI_SIZE, NG, 1, 7], at = sizes.map((_, i) => sizes.slice(0, i).reduce((a, b) => a + b, 0));

// what a game looked like, sampled every step
function tally() {
  return { steps: 0, close: 0, kidClip: 0, monClip: 0, offMap: 0, kidSpeed: 0, monSpeed: 0, dist: 0, awake: 0, hidden: 0, modes: {}, ev: {}, firstOut: null, outcome: 'timeout', candlesOut: 0, t: 0 };
}
function look(G, s, t0) {
  const k = G.kid, M = G.monster, W = G.L.w, H = G.L.h;
  s.steps++;
  const off = (x, z) => x < 0 || z < 0 || x >= W || z >= H;
  if (off(k.x, k.z) || off(M.x, M.z)) s.offMap++;
  else {
    if (G.kidBlocked(Math.floor(k.x), Math.floor(k.z))) s.kidClip++;
    if (G.monBlocked(Math.floor(M.x), Math.floor(M.z))) s.monClip++;
  }
  s.kidSpeed += Math.hypot(k.vx, k.vz); s.monSpeed += M.speed; s.dist += Math.hypot(k.x - M.x, k.z - M.z);
  if (M.awake && Math.hypot(k.x - M.x, k.z - M.z) < 5) s.close++; // pressure: the monster awake and near
  if (M.awake) s.awake++;
  if (k.hidden >= 0) s.hidden++;
  const m = G.mind.mode; s.modes[m] = (s.modes[m] || 0) + 1;
  for (const e of G.events) {
    if (e.type === 'mode' || e.type === 'mood' || e.type === 'tactic') continue;
    s.ev[e.type] = (s.ev[e.type] || 0) + 1;
    if (e.type === 'candleOut' && s.firstOut === null) s.firstOut = G.t - t0;
  }
  s.t = G.t - t0;
  s.candlesOut = G.candles.filter((c) => !c.lit).length;
  if (G.state !== 'play') s.outcome = G.state;
}

function rules(config) {
  const ep = startEpisode({ ...config, maxT: SECONDS }), s = tally(), t0 = ep.G.t;
  while (!episodeOver(ep)) { stepEpisode(ep); look(ep.G, s, t0); ep.G.events.length = 0; }
  return s;
}

async function dream(config) {
  const { G, kidBot } = createEpisode(config), s = tally(), t0 = G.t;
  const x = new Float32Array(at[6] + 7), ids = new Float32Array(meta.ids || 225), ki = new Float32Array(KI_SIZE);
  let row = new Float32Array(STATE_SIZE); encode(G, row, 0);
  x.set(personaVec(G.mind.persona, meta.persona), at[1]); x[at[5]] = 1;
  while (G.state === 'play' && G.t - t0 < SECONDS - 1e-9) {
    encodeKI(kidBot(observeKid(G), STEP * STRIDE), ki, 0);
    viewIds(MAP, row, col, ids);
    x.set(row, at[0]); x.set(ids, at[2]); x.set(ki, at[3]);
    for (let i = 0; i < NG; i++) x[at[4] + i] = -Math.log(-Math.log(Math.random() + 1e-12) + 1e-12);
    for (let i = 0; i < 7; i++) x[at[6] + i] = Math.random();
    const y = await run(x);
    const prev = row;
    row = decode(meta, y.subarray(13, 13 + meta.world), prev, { temp: 1, mix: MIX, mixFor: MIX_FOR, topP: TOP_P, snap: SNAP, peak: PEAK });
    for (let i = 0; i < row.length; i++) row[i] = Math.min(2, Math.max(-2, row[i]));
    if (COHERE) cohere(prev, row, col, MAP);
    if (WALLS) unwall(prev, row, col, MAP);
    apply(G, row, col, 0.05 * STRIDE);
    events(G, prev, row, y.subarray(13 + meta.world), col);
    look(G, s, t0);
    G.events.length = 0;
  }
  return s;
}

const { G: G0 } = createEpisode(configFor(BATCH, 0, { keys: KEYS }));
const DOOR_AT = Array.from({ length: G0.L.w * G0.L.h }, (_, i) => G0.L.doorAt(i % G0.L.w, Math.floor(i / G0.L.w)));
const MAP = { w: G0.L.w, h: G0.L.h, tiles: G0.L.tiles, doorAt: DOOR_AT };

// a side's totals over the games: rates per minute and shares of steps
function sum(list) {
  const n = list.reduce((a, s) => a + s.steps, 0), mins = list.reduce((a, s) => a + s.t, 0) / 60, ev = {}, modes = {};
  for (const s of list) {
    for (const [k, v] of Object.entries(s.ev)) ev[k] = (ev[k] || 0) + v;
    for (const [k, v] of Object.entries(s.modes)) modes[k] = (modes[k] || 0) + v;
  }
  const per = (k) => +((ev[k] || 0) / mins).toFixed(2), pct = (v) => +(100 * v / n).toFixed(1);
  return {
    games: list.length, minutes: +mins.toFixed(1), outcomes: list.map((s) => s.outcome).join(' '),
    candles_out_per_game: +(list.reduce((a, s) => a + s.candlesOut, 0) / list.length).toFixed(2),
    first_candle_s: +(list.filter((s) => s.firstOut !== null).reduce((a, s) => a + s.firstOut, 0) / Math.max(1, list.filter((s) => s.firstOut !== null).length)).toFixed(1),
    kid_in_wall_pct: pct(list.reduce((a, s) => a + s.kidClip, 0)), monster_in_wall_pct: pct(list.reduce((a, s) => a + s.monClip, 0)), off_map_pct: pct(list.reduce((a, s) => a + s.offMap, 0)),
    kid_speed: +(list.reduce((a, s) => a + s.kidSpeed, 0) / n).toFixed(2), monster_speed: +(list.reduce((a, s) => a + s.monSpeed, 0) / n).toFixed(2),
    distance: +(list.reduce((a, s) => a + s.dist, 0) / n).toFixed(1), pressure_pct: pct(list.reduce((a, s) => a + (s.close || 0), 0)), awake_pct: pct(list.reduce((a, s) => a + s.awake, 0)), hidden_pct: pct(list.reduce((a, s) => a + s.hidden, 0)),
    modes_pct: Object.fromEntries(Object.entries(modes).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, pct(v)])),
    per_minute: Object.fromEntries(['candleOut', 'door', 'hide', 'pickup', 'throw', 'yell', 'lunge', 'windup', 'fury', 'caught', 'beam', 'reach', 'squeak', 'creak', 'spotted', 'lost'].map((k) => [k, per(k)])),
  };
}

const R = [], D = [];
const [PART, PARTS] = (opt('part', '0/1')).split('/').map(Number);
for (let i = PART; i < GAMES; i += PARTS) {
  const config = configFor(BATCH, i, { keys: KEYS }), t = performance.now();
  R.push(rules(config));
  D.push(await dream(config));
  const r = R[R.length - 1], d = D[D.length - 1];
  console.log(`game ${i} ${config.persona.type} vs ${config.kid.style} (${config.start}): rules ${r.outcome} ${r.candlesOut} out in ${r.t.toFixed(0)} s | model ${d.outcome} ${d.candlesOut} out in ${d.t.toFixed(0)} s, kid in wall ${(100 * d.kidClip / d.steps).toFixed(1)}%  [${((performance.now() - t) / 1000).toFixed(0)} s]`);
}
const report = { model: dir, int8: INT8, mix: MIX, mind: MIND, mixfor: MIX_FOR, top_p: TOP_P, snap: SNAP, peak: PEAK, cohere: COHERE, walls: WALLS, keys: KEYS, stride: STRIDE, seconds: SECONDS, rules: sum(R), model_world: sum(D) };
console.log(JSON.stringify(report, null, 1));
if (opt('out')) writeFileSync(opt('out'), JSON.stringify({ ...report, games: { rules: R, model: D } }, null, 1));
