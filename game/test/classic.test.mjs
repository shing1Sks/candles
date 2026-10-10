// Classic: today's monster brain, now playing through the giant's controller and its senses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLevel } from '../src/sim/level.js';
import { createGame, step } from '../src/sim/game.js';
import { observe } from '../src/sim/senses.js';
import { createMind, think } from '../src/sim/mind/index.js';

const L = parseLevel(), DT = 1 / 60;
function scene(kid, mon) {
  const G = createGame(L, 3);
  Object.assign(G.kid, kid);
  Object.assign(G.monster, mon, { awake: true });
  G.mind = createMind(G, { type: 'classic' }, 3);
  G.mind.mode = 'patrol';
  return G;
}

test('it sees a kid 6 m away down the corridor, chases and closes in', () => {
  const G = scene({ x: 15.5, z: 20.5 }, { x: 9.5, z: 20.5, hx: 1, hz: 0 });
  for (let i = 0; i < 12; i++) step(G, { mx: 0, mz: 0 }, DT);
  assert.equal(G.mind.mode, 'chase');
  for (let i = 0; i < 60; i++) step(G, { mx: 0, mz: 0 }, DT);
  assert.ok(Math.hypot(G.kid.x - G.monster.x, G.kid.z - G.monster.z) < 4.5, 'it closed the distance');
});

test('the kid taking the same gap three times in one chase sends it round to wait at an exit', () => {
  const G = scene({ x: 18.5, z: 13.5 }, { x: 30.5, z: 20.5 });
  const p = L.passages.find((q) => q.exits.length >= 2);
  G.mind.mode = 'chase';
  for (let n = 0; n < 3; n++) {
    const obs = observe(G);
    const at = { x: p.exits[0][0] + 0.5, z: p.exits[0][1] + 0.5 };
    Object.assign(obs, { sees: true, kid: { ...at, vx: 0, vz: 0 }, gapSeen: -1 });
    think(G, G.mind, obs, DT);
    Object.assign(obs, { sees: false, kid: null, gapSeen: p.id, lastSeen: { ...at, vx: 0, vz: 0 }, lastSeenT: G.t });
    think(G, G.mind, obs, DT);
    if (G.mind.mode === 'chase') continue;
  }
  assert.equal(G.mind.mode, 'ambush');
  const t = G.mind.target;
  assert.ok(p.exits.some(([x, z]) => Math.abs(x + 0.5 - t.x) < 1e-6 && Math.abs(z + 0.5 - t.z) < 1e-6), 'waits at an exit of that gap');
});

test('a candle going out sends it to that candle', () => {
  const G = scene({ x: 18.5, z: 13.5 }, { x: 30.5, z: 20.5 });
  const c = G.candles[0], obs = observe(G);
  obs.alerts = [{ x: c.x, z: c.z, kind: 'candle' }];
  think(G, G.mind, obs, DT);
  assert.equal(G.mind.mode, 'hunt');
  assert.ok(Math.hypot(G.mind.target.x - c.x, G.mind.target.z - c.z) < 1.5);
});
