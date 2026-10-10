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
