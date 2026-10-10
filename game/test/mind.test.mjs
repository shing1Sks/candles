// The new monster mind's two foundations: where it thinks you are (belief), and how it feels (emotion).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLevel } from '../src/sim/level.js';
import { createGame, stepWorld, IDLE_GI } from '../src/sim/game.js';
import { observe } from '../src/sim/senses.js';
import { updateBelief } from '../src/sim/mind/belief.js';
import { appraise, updateEmotion, temperature } from '../src/sim/mind/emotion.js';

const L = parseLevel(), DT = 0.05;
const P = (o = {}) => ({ smart: 0.2, aggression: 0.5, patience: 0.5, ears: 0.5, guard: 0.5, thorough: 0.5, temper: 0.5, tools: 0.5, temp: 0.6, ...o });
const mind = () => ({ beliefs: [], anger: 0, frustration: 0, confidence: 0, furyT: 0, spentT: 0, felt: [], quietT: 0 });
const blank = (G) => ({ ...observe(G), sees: false, kid: null, heard: [], alerts: [], ping: null, felt: [] });

// ---------------- belief
test('a sighting collapses every guess to one, right on the kid', () => {
  const G = createGame(L, 1), m = mind();
  updateBelief(G, m, { ...blank(G), ping: { x: 5, z: 5 } }, DT, P());
  updateBelief(G, m, { ...blank(G), heard: [{ x: 30, z: 20, kind: 'creak' }] }, DT, P());
  assert.equal(m.beliefs.length, 2);
  updateBelief(G, m, { ...blank(G), sees: true, kid: { x: 18, z: 13, vx: 0, vz: 0 } }, DT, P());
  assert.equal(m.beliefs.length, 1);
  assert.deepEqual([m.beliefs[0].x, m.beliefs[0].z], [18, 13]);
  assert.ok(m.beliefs[0].spread <= 0.3 + 1e-9);
});
test('two senses of you a metre apart merge into one guess', () => {
  const G = createGame(L, 1), m = mind();
  updateBelief(G, m, { ...blank(G), ping: { x: 10, z: 10 } }, DT, P());
  updateBelief(G, m, { ...blank(G), ping: { x: 11, z: 10 } }, DT, P());
  assert.equal(m.beliefs.length, 1);
  assert.ok(m.beliefs[0].x > 10 && m.beliefs[0].x < 11);
});
test('no more than four guesses, weights summing to 1', () => {
  const G = createGame(L, 1), m = mind();
  for (const [x, z] of [[3, 3], [10, 10], [20, 5], [30, 20], [5, 20], [33, 3]]) updateBelief(G, m, { ...blank(G), heard: [{ x, z, kind: 'land' }] }, DT, P());
  assert.equal(m.beliefs.length, 4);
  assert.ok(Math.abs(m.beliefs.reduce((s, b) => s + b.w, 0) - 1) < 1e-9);
});
test('a guess spreads as time passes, up to 12 m', () => {
  const G = createGame(L, 1), m = mind();
  updateBelief(G, m, { ...blank(G), ping: { x: 10, z: 10 } }, DT, P());
  const s0 = m.beliefs[0].spread;
  for (let i = 0; i < 20; i++) updateBelief(G, m, blank(G), DT, P());
  assert.ok(m.beliefs[0].spread > s0);
  for (let i = 0; i < 2000; i++) updateBelief(G, m, blank(G), DT, P());
  assert.equal(m.beliefs[0].spread, 12);
});
test('a smart mind that looks at a guess and sees nothing loses faith in it', () => {
  const G = createGame(L, 1), m = mind();
  Object.assign(G.monster, { x: 10.5, z: 20.5, hx: 1, hz: 0, awake: true });
  updateBelief(G, m, { ...blank(G), heard: [{ x: 14.5, z: 20.5, kind: 'creak' }, { x: 30.5, z: 5.5, kind: 'creak' }] }, DT, P({ smart: 0.9 }));
  const near = () => m.beliefs.find((b) => b.x < 20);
  for (let i = 0; i < 40; i++) updateBelief(G, m, blank(G), DT, P({ smart: 0.9 }));
  assert.ok(near().w < 0.3, `weight ${near().w}`);
  const dumb = mind();
  updateBelief(G, dumb, { ...blank(G), heard: [{ x: 14.5, z: 20.5, kind: 'creak' }, { x: 30.5, z: 5.5, kind: 'creak' }] }, DT, P({ smart: 0.1 }));
  for (let i = 0; i < 40; i++) updateBelief(G, dumb, blank(G), DT, P({ smart: 0.1 }));
  assert.ok(dumb.beliefs.find((b) => b.x < 20).w > 0.3, 'a dumb one keeps believing');
});

// ---------------- emotion
test('a candle going out makes a hot-tempered monster angrier than a calm one', () => {
  const hot = mind(), calm = mind(), ap = (m) => appraise(m, { felt: [{ kind: 'candleOut' }], sees: false, kid: null, self: { x: 0, z: 0 }, heard: [], t: 0 }, DT);
  updateEmotion(hot, ap(hot), DT, P({ temper: 0.9 }));
  updateEmotion(calm, ap(calm), DT, P({ temper: 0.1 }));
  assert.ok(hot.anger > calm.anger, `${hot.anger} vs ${calm.anger}`);
  assert.ok(hot.frustration > 0);
});
test('anger halves in 4 + 6 x patience seconds', () => {
  const m = mind(); m.anger = 0.8;
  const p = P({ patience: 0.5 }), half = 4 + 6 * 0.5, quiet = { r: 0, sharp: 0, why: '' };
  for (let t = 0; t < half - 1e-9; t += DT) updateEmotion(m, quiet, DT, p);
  assert.ok(Math.abs(m.anger - 0.4) < 0.02, `${m.anger}`);
});
test('fury needs both anger and frustration, lasts 4 s, then it is spent for 2.5 s', () => {
  const m = mind(); m.anger = 0.9; m.frustration = 0.3;
  const quiet = { r: 0, sharp: 0, why: '' };
  assert.equal(updateEmotion(m, quiet, DT, P()).furyStarted, false);
  m.anger = 0.95; m.frustration = 0.8;
  assert.equal(updateEmotion(m, quiet, DT, P()).furyStarted, true);
  let furyFor = 0, spentFor = 0;
  for (let i = 0; i < 200; i++) { updateEmotion(m, quiet, DT, P()); if (m.furyT > 0) furyFor += DT; else if (m.spentT > 0) spentFor += DT; }
  assert.ok(Math.abs(furyFor - 4) < 0.11, `fury ${furyFor}`);
  assert.ok(Math.abs(spentFor - 2.5) < 0.11, `spent ${spentFor}`);
});
test('frustration raises the temperature of its choices; confidence lowers it', () => {
  const m = mind(), p = P();
  const t0 = temperature(m, p);
  m.frustration = 0.8; const t1 = temperature(m, p);
  m.frustration = 0; m.confidence = 0.8; const t2 = temperature(m, p);
  assert.ok(t1 > t0 && t2 < t0);
});
test('appraisal: closing in on a kid it sees is good, losing it is bad', () => {
  const m = mind(), self = { x: 0, z: 0 };
  appraise(m, { felt: [], sees: true, kid: { x: 6, z: 0 }, self, heard: [], t: 0 }, DT);
  const closer = appraise(m, { felt: [], sees: true, kid: { x: 5, z: 0 }, self, heard: [], t: 0.05 }, DT);
  assert.ok(closer.r > 0);
  const lost = appraise(m, { felt: [{ kind: 'lostSight' }], sees: false, kid: null, self, heard: [], t: 0.1 }, DT);
  assert.ok(lost.r < 0);
});

// ---------------- what it feels reaches it through its senses
const feltAfter = (G, steps) => { const all = []; for (const [ki, gi] of steps) { stepWorld(G, ki, { ...IDLE_GI, ...gi }, 1 / 60); } return observe(G).felt.map((f) => f.kind); };
test('a door shut in its face is felt', () => {
  const G = createGame(L, 2);
  const d = G.doors.find((q) => q.tiles.some(([x, z]) => x === 10 && z === 11)); // the nursery's south door, open
  Object.assign(G.monster, { x: d.x, z: d.z + 1.6, hx: 0, hz: -1, awake: true });
  Object.assign(G.kid, { x: d.x, z: d.z - 1.0 });
  assert.equal(d.open, true);
  const felt = feltAfter(G, [[{ mx: 0, mz: 0, use: true }, {}]]);
  assert.equal(d.open, false);
  assert.ok(felt.includes('doorInFace'), felt.join());
});
test('a missed lunge is felt', () => {
  const G = createGame(L, 2);
  Object.assign(G.monster, { x: 5.5, z: 20.5, hx: 1, hz: 0, awake: true });
  const steps = [[{ mx: 0, mz: 0 }, { mx: 1, lunge: true }]];
  for (let i = 0; i < 45; i++) steps.push([{ mx: 0, mz: 0 }, { mx: 1 }]);
  assert.ok(feltAfter(G, steps).includes('lungeMiss'));
});
test('a candle going out and losing sight of the kid are felt', () => {
  const G = createGame(L, 2), c = G.candles[0];
  Object.assign(G.kid, { x: c.x - 0.5, z: c.z + 0.5 }); c.progress = 0.995; // beside the nursery candle
  assert.ok(feltAfter(G, [[{ mx: 0, mz: 0, blow: true }, {}]]).includes('candleOut'));
  Object.assign(G.monster, { x: 9.5, z: 20.5, hx: 1, hz: 0, awake: true });
  Object.assign(G.kid, { x: 13.5, z: 20.5 });
  feltAfter(G, [[{ mx: 0, mz: 0 }, {}]]);
  Object.assign(G.kid, { x: 18.5, z: 13.5 }); // gone (back in the playroom)
  assert.ok(feltAfter(G, [[{ mx: 0, mz: 0 }, {}]]).includes('lostSight'));
});

test('fury needs anger 0.85 and frustration 0.7, and rests 30 s after it is spent', () => {
  const m = mind(), quiet = { r: 0, sharp: 0, why: '' };
  m.anger = 0.8; m.frustration = 0.9;
  assert.equal(updateEmotion(m, quiet, DT, P()).furyStarted, false, 'anger 0.8 is not enough');
  m.anger = 0.95; m.frustration = 0.9;
  assert.equal(updateEmotion(m, quiet, DT, P()).furyStarted, true);
  for (let i = 0; i < Math.round(6.6 / DT); i++) updateEmotion(m, quiet, DT, P()); // through fury and spent
  assert.equal(m.furyT, 0); assert.equal(m.spentT, 0);
  m.anger = 0.95; m.frustration = 0.9;
  assert.equal(updateEmotion(m, quiet, DT, P()).furyStarted, false, 'not again so soon');
  for (let i = 0; i < Math.round(30 / DT); i++) { m.anger = 0.95; m.frustration = 0.9; updateEmotion(m, quiet, DT, P()); if (m.furyT > 0) break; }
  assert.ok(m.furyT > 0, 'possible again after the rest');
});
