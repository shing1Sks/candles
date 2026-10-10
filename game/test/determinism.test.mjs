// An episode is fully defined by its config: the same config replays the same game, bit for bit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configFor, runEpisode } from '../src/sim/episode.js';

test('the same config gives the same game twice', () => {
  const c = { ...configFor('t', 3), maxT: 40 };
  assert.equal(runEpisode(c).hash, runEpisode(c).hash);
});
test('different configs give different games', () => {
  const a = runEpisode({ ...configFor('t', 3), maxT: 40 }), b = runEpisode({ ...configFor('t', 4), maxT: 40 });
  assert.notEqual(a.hash, b.hash);
});
test("the kid's random stream is separate from the world's and the mind's", () => {
  const base = { ...configFor('t', 5), kid: { style: 'idle', skill: 0.5 }, maxT: 30 };
  const a = runEpisode(base), b = runEpisode({ ...base, kidSeed: 12345 });
  assert.equal(a.hash, b.hash, 'a kid that never draws a random number: its seed changes nothing');
  assert.notEqual(runEpisode({ ...base, seed: base.seed + 1 }).hash, a.hash);
});
test('an episode reports how it ended', () => {
  const r = runEpisode({ ...configFor('t', 6), maxT: 20 });
  assert.ok(['won', 'caught', 'timeout'].includes(r.outcome));
  assert.ok(r.t > 0 && r.t <= 20 + 1e-9);
  assert.equal(typeof r.counts, 'object');
});
