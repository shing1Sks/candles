// A mechanics case (cases.mjs) played by the rules, or inside a main model's world.
import { parseLevel } from '../../src/sim/level.js';
import { createGame, stepWorld } from '../../src/sim/game.js';
import { observe } from '../../src/sim/senses.js';
import { createMind, think } from '../../src/sim/mind/index.js';
import { encode, encodeKI, STATE_SIZE, KI_SIZE, GI_SIZE } from '../../src/sim/schema.js';
import { createBrain } from '../../src/model/brain.js';
import { decode } from '../../src/model/decode.js';
import { layout, viewIds, personaVec, cohere, unwall } from '../../src/model/layout.js';
import { apply, events } from '../../src/model/dream.js';

const L = parseLevel(), DT = 1 / 60, SUB = 3, STEP = DT * SUB;
const PRESS_K = ['use', 'throw'], PRESS_G = ['lunge', 'use', 'bash', 'yell', 'light', 'reach'];
export const MAP = { w: L.w, h: L.h, tiles: Array.from(L.tiles), doorAt: Array.from({ length: L.w * L.h }, (_, i) => L.doorAt(i % L.w, Math.floor(i / L.w))) };

// the case's moment: a fresh game, a hound's mind (a type the model knows), the clock at c.t (90 s unless the case
// says: the data only has the clock at 0 with the kid in the playroom and the monster asleep; mid-game starts are at
// 60-200 s), the case's setup, then c.warm seconds (0.3 unless the case says) of the rules with the kid still, so
// the monster's senses, beliefs and mind agree with where things were put (a monster set down with an empty mind is
// a moment no game has: the model's monster hunted towards the map's corner)
// The monster type the cases play against: a hound by default; a model trained on games against the nightmare
// (data v4) is examined against the nightmare (exam.mjs --monster nightmare --policy P.json)
let monster = 'hound';
export function setMonster(type) { monster = type; }
export function moment(c, seed = 1) {
  const G = createGame(L, seed);
  G.mind = createMind(G, { type: monster }, seed);
  G.t = c.t ?? 90;
  c.setup(G);
  for (let n = 0; n * STEP < (c.warm ?? 0.3) - 1e-9 && G.state === 'play'; n++) {
    const gi = think(G, G.mind, observe(G), STEP);
    for (let i = 0; i < SUB; i++) stepWorld(G, { mx: 0, mz: 0, ...(c.warmKi ?? {}) }, i ? { ...gi, ...Object.fromEntries(PRESS_G.map((b) => [b, false])) } : gi, DT);
  }
  G.events.length = 0;
  return G;
}
const note = (s, G, t) => {
  for (const e of G.events) { s.ev[e.type] = (s.ev[e.type] || 0) + 1; if (s.firstEv[e.type] == null) s.firstEv[e.type] = t; }
  G.events.length = 0;
};
const input = (c, t, G) => ({ mx: 0, mz: 0, ...c.ki(t, G) });

// by the rules, as an episode runs: both sides decide every 0.05 s, presses count on the first of the 3 ticks
export function playRules(c, seed = 1) {
  const G = moment(c, seed), s = { ev: {}, firstEv: {} };
  for (let n = 0; n * STEP < c.secs - 1e-9 && G.state === 'play'; n++) {
    const t = n * STEP, ki = input(c, t, G), gi = think(G, G.mind, observe(G), STEP);
    for (let i = 0; i < SUB && G.state === 'play'; i++) {
      const k = { ...ki }, g = { ...gi };
      if (i) { for (const b of PRESS_K) k[b] = false; for (const b of PRESS_G) g[b] = false; }
      stepWorld(G, k, g, DT);
    }
    note(s, G, t + STEP);
    c.each?.(G, s, t + STEP);
  }
  return { G, s, why: c.check(G, s) };
}

// inside the model's world: run(x) -> y is one step of packed.onnx (single row in, [gi | world | events] out); with
// brain, of packed_brain.onnx ([cur | persona | ids | ki | gi] in, [world | events] out): the monster's mind (the
// moment's, carried on) is a second player whose buttons go into the model (src/model/brain.js)
const col = layout(), NG = 4 * 21 + 2 * 32;
export async function playModel(c, meta, run, { seed = 1, decodeOpt = {}, crutches = true, brain: useBrain = false } = {}) {
  const G = moment(c, seed), s = { ev: {}, firstEv: {} }, stride = meta.stride || 1;
  const sizes = useBrain ? [STATE_SIZE, meta.persona, meta.ids || 225, KI_SIZE, GI_SIZE] : [STATE_SIZE, meta.persona, meta.ids || 225, KI_SIZE, NG, 1, 7], at = sizes.map((_, i) => sizes.slice(0, i).reduce((a, b) => a + b, 0));
  const x = new Float32Array(at[at.length - 1] + sizes[sizes.length - 1]), ids = new Float32Array(meta.ids || 225), ki = new Float32Array(KI_SIZE);
  const brain = useBrain && createBrain(G.L, G.mind.persona, seed, col), w0 = useBrain ? 0 : 13;
  if (brain) brain.adopt(G.mind);
  let row = new Float32Array(STATE_SIZE); encode(G, row, 0);
  x.set(personaVec(G.mind.persona, meta.persona), at[1]); x[at[5]] = 1;
  G.events.length = 0;
  for (let n = 0; n * STEP * stride < c.secs - 1e-9 && G.state === 'play'; n++) {
    const t = n * STEP * stride;
    // a press anywhere in the step's window counts (a stride-2 model steps over every other 0.05 s)
    const inp = input(c, t, G);
    for (let j = 1; j < stride; j++) { const more = c.ki(t + j * STEP, G); for (const b of PRESS_K) if (more[b]) inp[b] = true; }
    encodeKI(inp, ki, 0);
    viewIds(MAP, row, col, ids);
    x.set(row, at[0]); x.set(ids, at[2]); x.set(ki, at[3]);
    if (brain) x.set(brain.decide(row, STEP * stride).gi, at[4]);
    else {
      for (let i = 0; i < NG; i++) x[at[4] + i] = -Math.log(-Math.log(Math.random() + 1e-12) + 1e-12);
      for (let i = 0; i < 7; i++) x[at[6] + i] = Math.random();
    }
    const y = await run(x), prev = row;
    row = decode(meta, y.subarray(w0, w0 + meta.world), prev, decodeOpt);
    for (let i = 0; i < row.length; i++) row[i] = Math.min(2, Math.max(-2, row[i]));
    if (crutches) { cohere(prev, row, col, MAP); unwall(prev, row, col, MAP); }
    if (brain) brain.write(row);
    apply(G, row, col, STEP * stride);
    events(G, prev, row, y.subarray(w0 + meta.world), col);
    note(s, G, t + STEP * stride);
    c.each?.(G, s, t + STEP * stride);
  }
  return { G, s, why: c.check(G, s) };
}
