// Every case id in docs/mechanics.md is counted while episodes run, so the dataset can show it covers them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CASES, STATIC_CASES } from '../src/sim/coverage.js';
import { configFor, runEpisode } from '../src/sim/episode.js';

test('every case id in docs/mechanics.md has a counter (or is a fixed fact of the board)', () => {
  const doc = fs.readFileSync(new URL('../../docs/mechanics.md', import.meta.url), 'utf8');
  const ids = [...doc.matchAll(/\*\*([A-Z]\d+)\b/g)].map((m) => m[1]);
  assert.ok(ids.length > 50, `${ids.length} ids in the doc`);
  const known = new Set([...CASES.map((c) => c.id), ...STATIC_CASES]);
  for (const id of ids) assert.ok(known.has(id), `no counter for ${id}`);
});
test('a minute of play counts running and blowing', () => {
  let r;
  for (let i = 0; ; i++) {
    r = runEpisode({ ...configFor('cov', i), kid: { style: 'sprinter', skill: 0.9 }, start: 'fresh', maxT: 60 });
    if (r.t > 50) break;
  }
  assert.ok(r.counts.K1 > 0 && r.counts.C1 > 0, JSON.stringify(r.counts));
});

import { countCases } from '../src/sim/coverage.js';
import { parseLevel } from '../src/sim/level.js';
import { createGame } from '../src/sim/game.js';
test('a standoff (the kid still in cover, the monster awake beside it) is counted', () => {
  const G = createGame(parseLevel(), 1);
  Object.assign(G.kid, { x: 18.5, z: 15.5, crawl: true, speed: 0 });
  Object.assign(G.monster, { x: 18.5, z: 13.9, awake: true });
  const counts = countCases(G, [], { mx: 0, mz: 0 }, { run: false }, 5, {});
  assert.equal(counts._standoff, 1);
  G.kid.speed = 1;
  assert.equal(countCases(G, [], { mx: 0, mz: 0 }, { run: false }, 6, {})._standoff, undefined);
});
