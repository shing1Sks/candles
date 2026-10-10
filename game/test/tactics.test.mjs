// The new monster mind: tactics scored by its persona and mood, one drawn by softmax at its temperature.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLevel } from '../src/sim/level.js';
import { createGame } from '../src/sim/game.js';
import { observe } from '../src/sim/senses.js';
import { rng } from '../src/sim/rng.js';
import { createMind } from '../src/sim/mind/index.js';
import { PERSONAS, samplePersona } from '../src/sim/mind/personas.js';
import { TACTICS, softmaxPick, choose } from '../src/sim/mind/tactics.js';
import { updateBelief } from '../src/sim/mind/belief.js';

const L = parseLevel();

test('softmax never picks an impossible tactic', () => {
  const r = rng(1);
  for (let i = 0; i < 500; i++) assert.notEqual(softmaxPick([-Infinity, 1, -Infinity, 0.5], 1, r), 0);
});
test('cold, it nearly always takes the best; hot, it often tries the next one', () => {
  const r = rng(2), n = 1000;
  let best = 0, second = 0;
  for (let i = 0; i < n; i++) if (softmaxPick([1, 2, 1.6], 0.1, r) === 1) best++;
  for (let i = 0; i < n; i++) if (softmaxPick([1, 2, 1.6], 3, r) === 2) second++;
  assert.ok(best >= 0.95 * n, `best ${best}`);
  assert.ok(second >= 0.2 * n, `second ${second}`);
});
test('jittered personas stay in [0, 1] and near their type', () => {
  const r = rng(3);
  for (const type of Object.keys(PERSONAS)) for (let i = 0; i < 50; i++) {
    const p = samplePersona(type, r);
    for (const k of ['smart', 'aggression', 'patience', 'ears', 'guard', 'thorough', 'temper', 'tools']) {
      assert.ok(p[k] >= 0 && p[k] <= 1);
      assert.ok(Math.abs(p[k] - PERSONAS[type][k]) < 0.4);
    }
  }
});

// a monster in the corridor with a sense of the kid, built for scoring
function situation(type, seed, setup) {
  const G = createGame(L, seed);
  Object.assign(G.monster, { x: 20.5, z: 20.5, hx: -1, hz: 0, awake: true });
  const mind = createMind(G, { type, ...PERSONAS[type] }, seed);
  const obs = { ...observe(G), sees: false, kid: null, heard: [], alerts: [], ping: null, felt: [] };
  setup?.(G, mind, obs);
  updateBelief(G, mind, obs, 0.05, mind.persona); // what it just heard becomes a guess
  return { G, mind, obs };
}
const tactic = (name) => TACTICS.find((t) => t.name === name);

test("a smart stalker scores cutting you off at a candle above a dumb pathfinder", () => {
  const score = (type) => {
    const { G, mind, obs } = situation(type, 1, (G, m) => { m.beliefs = [{ x: 22.5, z: 16.5, spread: 3, conf: 1, w: 1, kind: 'ping', age: 1 }]; });
    return tactic('intercept').score({ G, mind, obs, persona: mind.persona, best: mind.beliefs[0] });
  };
  assert.ok(score('stalker') > score('pathfinder'), `${score('stalker')} vs ${score('pathfinder')}`);
});
test('a hound runs to a toy landing; a warden by a lit candle mostly keeps guarding', () => {
  const picks = (type) => {
    const n = 100, got = {};
    for (let s = 0; s < n; s++) {
      const { G, mind, obs } = situation(type, s, (G, m, o) => { o.heard = [{ x: 30.5, z: 20.5, kind: 'land' }]; });
      mind.mode = 'guard'; mind.tactic = 'guard';
      const name = choose(G, mind, obs, 0.5).name;
      got[name] = (got[name] || 0) + 1;
    }
    return got;
  };
  const hound = picks('hound'), warden = picks('warden');
  assert.ok((hound.hunt || 0) >= 70, `hound ${JSON.stringify(hound)}`);
  assert.ok((warden.guard || 0) >= 50, `warden ${JSON.stringify(warden)}`);
});
test('in a fury it ignores a toy landing 3 m away', () => {
  for (let s = 0; s < 30; s++) {
    const { G, mind, obs } = situation('hound', s, (G, m, o) => {
      m.beliefs = [{ x: 10.5, z: 20.5, spread: 1, conf: 0.3, w: 1, kind: 'sight', age: 3 }]; // an older sighting, weaker than the lure
      o.heard = [{ x: 23.5, z: 20.5, kind: 'land' }];
      m.furyT = 3;
    });
    choose(G, mind, obs, 0.5);
    assert.ok(Math.abs(mind.target.x - 23.5) > 1, `went for the lure: ${JSON.stringify(mind.target)}`);
  }
});
