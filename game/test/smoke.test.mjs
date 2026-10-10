import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLevel } from '../src/sim/level.js';
import { createGame, step } from '../src/sim/game.js';

test('a game runs 10 s of standing still without ending', () => {
  const G = createGame(parseLevel(), 1);
  for (let i = 0; i < 600; i++) step(G, { mx: 0, mz: 0 }, 1 / 60);
  assert.equal(G.state, 'play');
  assert.ok(G.t > 9.9);
});
