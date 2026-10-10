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
