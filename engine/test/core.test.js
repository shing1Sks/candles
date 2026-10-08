import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hash32, makeRng, Streams } from '../rng.js';
import { createWorld, stepWorld, stateHash, NO_INPUT } from '../world.js';

test('hash32 is stable and order-sensitive', () => {
  assert.equal(hash32('a', 1, 2), hash32('a', 1, 2));
  assert.notEqual(hash32('a', 1, 2), hash32('a', 2, 1));
});

test('makeRng: same seed, same sequence; values in range', () => {
  const a = makeRng(42), b = makeRng(42);
  for (let i = 0; i < 100; i++) { const x = a.next(); assert.equal(x, b.next()); assert.ok(x >= 0 && x < 1); }
  const r = makeRng(1);
  for (let i = 0; i < 100; i++) { const n = r.int(3, 7); assert.ok(n >= 3 && n <= 7 && Number.isInteger(n)); }
  assert.equal(makeRng(5).weighted({ only: 1 }), 'only');
});

test('named streams are independent of each other', () => {
  const s1 = new Streams(9), s2 = new Streams(9);
  s1.get('a').next(); s1.get('a').next();
  assert.equal(s1.get('b').next(), s2.get('b').next());
});

test('same seed + same inputs = same state', () => {
  const run = () => { const w = createWorld({ seed: 3, modules: [] }); for (let i = 0; i < 120; i++) stepWorld(w, NO_INPUT); return stateHash(w.S); };
  assert.equal(run(), run());
});

test('the world advances fixed 1/60 s ticks', () => {
  const w = createWorld({ seed: 1, modules: [] });
  for (let i = 0; i < 60; i++) stepWorld(w, NO_INPUT);
  assert.equal(w.S.tick, 60);
  assert.ok(Math.abs(w.S.t - 1) < 1e-9);
});

test('engine never touches Math.random, Date or the DOM', () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const files = [];
  const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (f !== 'test' && f !== 'node_modules') walk(p); } else if (p.endsWith('.js')) files.push(p); } };
  walk(root);
  assert.ok(files.length > 0);
  for (const f of files) {
    const src = readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '');
    for (const bad of ['Math.random', 'Date.', 'new Date', 'performance.', 'document.', 'window.']) assert.ok(!src.includes(bad), `${f} uses ${bad}`);
  }
});
