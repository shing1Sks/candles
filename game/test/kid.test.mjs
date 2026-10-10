// Kid bots in every style finish their games, and each style plays like itself. (Slow: SLOW=1 npm test)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configFor, runEpisode } from '../src/sim/episode.js';

const slow = !process.env.SLOW;
const play = (style, n, persona = 'classic') => {
  const res = { won: 0, caught: 0, timeout: 0, ev: {} };
  for (let i = 0; i < n; i++) {
    const r = runEpisode({ ...configFor(`kid-${style}`, i), persona: { type: persona }, kid: { style, skill: 0.6 }, start: 'fresh' }, {
      onRecord(row, G, ki, gi, events) { for (const e of events) res.ev[e.type] = (res.ev[e.type] || 0) + 1; },
    });
    res[r.outcome]++;
  }
  return res;
};

for (const style of ['sneaker', 'sprinter', 'hider', 'trickster', 'greedy', 'chaos']) {
  test(`${style} kids finish their games (under 30% timeouts)`, { skip: slow }, () => {
    const r = play(style, 20);
    assert.ok(r.timeout < 6, `${style}: ${JSON.stringify({ won: r.won, caught: r.caught, timeout: r.timeout })}`);
  });
}
test('a hider hides in wardrobes, a trickster throws toys', { skip: slow }, () => {
  assert.ok((play('hider', 20).ev.hide || 0) >= 1);
  assert.ok((play('trickster', 20).ev.throw || 0) >= 1);
});

// Not slow: a kid hiding in a crawl space with the monster parked beside it does not freeze there for ever
import { parseLevel } from '../src/sim/level.js';
import { createGame, stepWorld, IDLE_GI } from '../src/sim/game.js';
import { createKidBot, observeKid } from '../src/sim/bots/kid.js';
import { rng } from '../src/sim/rng.js';
test('cornered under a table, a kid slips out the far side after a while', () => {
  const L = parseLevel();
  for (const style of ['sneaker', 'hider', 'sprinter']) {
    const G = createGame(L, 4);
    Object.assign(G.kid, { x: 18.5, z: 15.5 });
    Object.assign(G.monster, { x: 18.5, z: 13.9, hx: 0, hz: 1, awake: true }); // it stands there, watching
    const bot = createKidBot(G, { style, skill: 0.6 }, rng(7));
    let left = false, ki = null;
    for (let i = 0; i < 25 * 60 && !left; i++) {
      if (i % 3 === 0) ki = bot(observeKid(G), 0.05);
      stepWorld(G, i % 3 ? { ...ki, use: false, throw: false } : ki, IDLE_GI, 1 / 60); G.events.length = 0;
      if (!G.kid.crawl) left = true;
    }
    assert.ok(left, `${style} never left the table`);
  }
});
