// Random mid-game starts: late-game moments (the hand, the last candle) without playing every game to the end.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLevel } from '../src/sim/level.js';
import { createGame } from '../src/sim/game.js';
import { createMind } from '../src/sim/mind/index.js';
import { distField } from '../src/sim/grid.js';
import { rng } from '../src/sim/rng.js';
import { randomStart } from '../src/sim/bots/start.js';
import { configFor } from '../src/sim/episode.js';

const L = parseLevel(), tf = Math.floor;

test('1,000 random mid-game starts are all valid', () => {
  const r = rng(9);
  for (let i = 0; i < 1000; i++) {
    const G = createGame(L, i);
    G.mind = createMind(G, { type: i % 2 ? 'stalker' : 'classic' }, i);
    randomStart(G, r);
    const k = G.kid, M = G.monster, why = `start ${i}`;
    assert.ok(!G.kidBlocked(tf(k.x), tf(k.z)), `${why}: kid in a wall`);
    assert.ok(!G.monBlocked(tf(M.x), tf(M.z)), `${why}: monster in a wall`);
    const held = G.items.filter((it) => it.held);
    assert.ok(held.length <= 1, why);
    assert.equal(k.held, held.length ? held[0].id : -1, why);
    for (const it of G.items) if (!it.held) assert.ok(!G.kidBlocked(tf(it.x), tf(it.z)), `${why}: toy in a wall`);
    for (const c of G.candles) {
      if (!c.lit) assert.ok(c.progress >= 1, why);
      else assert.ok(c.progress >= 0 && c.progress < 1, why);
    }
    const out = G.candles.filter((c) => !c.lit).length;
    assert.ok(out <= 5, why);
    assert.ok(G.t >= 60 && G.t <= 200, why);
    assert.ok(M.awake, why);
    const md = distField(L, tf(M.x), tf(M.z), G.monBlocked);
    let near = Infinity;
    for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) near = Math.min(near, md[(tf(k.z) + dz) * L.w + tf(k.x) + dx] ?? Infinity);
    assert.ok(near >= 8, `${why}: monster ${near} tiles away`);
  }
});

test('configs mix the five monster types, the kid styles, skills and starts', () => {
  const seen = { persona: new Set(), style: new Set() };
  let mid = 0, chaos = 0;
  for (let i = 0; i < 400; i++) {
    const c = configFor('mix', i);
    seen.persona.add(c.persona.type); seen.style.add(c.kid.style);
    if (c.start === 'mid') mid++;
    if (c.kid.style === 'chaos') chaos++;
    assert.ok(c.kid.skill >= 0.2 && c.kid.skill <= 1);
  }
  assert.deepEqual([...seen.persona].sort(), ['brute', 'hound', 'pathfinder', 'stalker', 'warden']);
  assert.deepEqual([...seen.style].sort(), ['chaos', 'greedy', 'hider', 'sneaker', 'sprinter', 'trickster']);
  assert.ok(mid > 90 && mid < 150, `mid starts ${mid}/400`);
  assert.ok(chaos > 8 && chaos < 35, `chaos ${chaos}/400`);
});
