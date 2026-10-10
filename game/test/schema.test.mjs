// The state schema: every recorded row is the whole game state as a fixed list of numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATE_SIZE, KI_SIZE, GI_SIZE, EVENT_TYPES, encode, schemaJSON } from '../src/sim/schema.js';
import { configFor, runEpisode } from '../src/sim/episode.js';
import { parseLevel } from '../src/sim/level.js';
import { createGame, stepWorld, makeNoise, IDLE_GI } from '../src/sim/game.js';
import { observe } from '../src/sim/senses.js';

// 200 states from a running episode, encoded
function sample() {
  const rows = [];
  for (let i = 1; rows.length < 200; i++) {
    runEpisode({ ...configFor('schema', i), maxT: 100 }, {
      onRecord(row, G) {
        if (row % 10) return;
        const out = new Float32Array(STATE_SIZE + 2).fill(NaN);
        encode(G, out, 1);
        rows.push({ out, kidX: G.kid.x, L: G.L });
      },
    });
  }
  return rows.slice(0, 200);
}
const rows = sample(), S = schemaJSON();

test('encode writes exactly STATE_SIZE finite numbers', () => {
  assert.ok(rows.length >= 150, `${rows.length} samples`);
  for (const { out } of rows) {
    assert.ok(Number.isNaN(out[0]) && Number.isNaN(out[STATE_SIZE + 1]), 'stays inside its slot');
    for (let i = 1; i <= STATE_SIZE; i++) assert.ok(Number.isFinite(out[i]), `field ${i - 1} is ${out[i]}`);
  }
});

test('flags are 0 or 1 and every one-hot group sums to 1', () => {
  for (const { out } of rows) {
    for (const tok of S.tokens) for (let c = 0; c < tok.count; c++) {
      let o = 1 + tok.offset + c * tok.width;
      for (const f of tok.fields) {
        if (f.type === 'flag') assert.ok(out[o] === 0 || out[o] === 1, `${tok.kind}.${f.name} = ${out[o]}`);
        if (f.type === 'cat') {
          let sum = 0;
          for (let j = 0; j < f.n; j++) { assert.ok(out[o + j] === 0 || out[o + j] === 1); sum += out[o + j]; }
          assert.equal(sum, 1, `${tok.kind}.${f.name} one-hot`);
        }
        o += f.type === 'cat' ? f.n : 1;
      }
    }
  }
});

test("the kid's x comes back from its field", () => {
  const kid = S.tokens.find((t) => t.kind === 'kid'), f = kid.fields.findIndex((q) => q.name === 'x');
  assert.equal(f, 0);
  for (const { out, kidX, L } of rows) assert.ok(Math.abs(out[1 + kid.offset] * L.w - kidX) < 1e-3);
});

test('the schema describes itself as plain JSON with matching sizes', () => {
  const back = JSON.parse(JSON.stringify(S));
  assert.deepEqual(back, S);
  assert.equal(S.stateSize, STATE_SIZE);
  assert.equal(S.tokens.reduce((s, t) => s + t.count * t.width, 0), STATE_SIZE);
  assert.equal(S.kiFields.length, KI_SIZE);
  assert.equal(S.giFields.length, GI_SIZE);
});

test('recording returns states, inputs and known events for every row', () => {
  const r = runEpisode({ ...configFor('schema', 2), maxT: 60 }, { record: true });
  // the state before every step, and the one after the last: step r takes states[r] to states[r + 1]
  assert.equal(r.states.length, (r.rows + 1) * STATE_SIZE);
  assert.equal(r.ki.length, r.rows * KI_SIZE);
  assert.equal(r.gi.length, r.rows * GI_SIZE);
  assert.ok(r.events.length > 0);
  for (const [row, type] of r.events) {
    assert.ok(row >= 0 && row < r.rows);
    assert.ok(type >= 0 && type < EVENT_TYPES.length);
  }
});

test('events keep their details: who shut a door, why it yelled', () => {
  let doors = 0;
  for (let i = 0; i < 6; i++) {
    const r = runEpisode({ ...configFor('detail', i), maxT: 120 }, { record: true });
    for (const e of r.events) {
      assert.equal(e.length, 6);
      if (EVENT_TYPES[e[1]] === 'door') { doors++; assert.match(e[5], /^(open|shut):(kid|monster)(:bash)?$/); }
      if (EVENT_TYPES[e[1]] === 'yell') assert.ok(e[5].length > 0, 'a yell says why');
      if (EVENT_TYPES[e[1]] === 'caught') assert.match(e[5], /^(touch|found|grab)$/);
    }
  }
  assert.ok(doors > 0);
});
test("an episode reports the monster's actual traits", () => {
  const r = runEpisode({ ...configFor('traits', 1), persona: { type: 'hound' }, maxT: 5 });
  assert.equal(r.persona.type, 'hound'); assert.equal(typeof r.persona.ears, 'number');
});
test('what the monster sensed but has not yet read is part of the state', () => {
  const L = parseLevel(), G = createGame(L, 1);
  Object.assign(G.monster, { x: 5.5, z: 20.5, awake: true });
  const pend = S.tokens.find((t) => t.kind === 'pending');
  assert.ok(pend, 'a pending-senses piece');
  const heardAt = 1 + pend.offset + pend.fields.findIndex((f) => f.name === 'heard');
  const out = new Float32Array(STATE_SIZE + 2);
  makeNoise(G, 9.5, 20.5, 10, 'creak'); stepWorld(G, { mx: 0, mz: 0 }, IDLE_GI, 1 / 60);
  encode(G, out, 1); assert.equal(out[heardAt], 1);
  observe(G); encode(G, out, 1); assert.equal(out[heardAt], 0);
});
