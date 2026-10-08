import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../state.js';
import { Layout } from '../layout/space.js';
import { forgetTick, forgetChunk } from '../layout/forget.js';
import { makeRng } from '../rng.js';
import { RULES } from '../rules.js';

const S = createState(11), L = new Layout(11, S);

test('the centre of chunk (0,0) is walkable on both floors; a room interior is not, while its door is closed', () => {
  for (const f of [0, 1]) assert.ok(L.walkable(f, 12, 12));
  const c = L.chunkAt(0, 12, 12), r = c.rooms.find((x) => x.kind === 'classroom');
  assert.ok(r, 'expected a classroom in chunk 0,0');
  assert.ok(!L.walkable(0, (r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2));
});

test('segmentClear runs along a corridor and is blocked by a wall', () => {
  const c = L.chunkAt(0, 12, 12);
  assert.ok(L.segmentClear(0, c.x0 + 11, c.z0 + 12, c.x0 + 13, c.z0 + 12));
  assert.ok(!L.segmentClear(0, c.x0 + 12, c.z0 + 12, c.x0 + 2, c.z0 + 2)); // into a quadrant corner
});

test('an open door makes its room walkable and the doorway clear; closing it blocks again', () => {
  const S2 = createState(11), L2 = new Layout(11, S2);
  const r = L2.chunkAt(0, 12, 12).rooms.find((x) => x.kind === 'classroom'), d = r.door;
  const out = { N: [0, -1.2], S: [0, 1.2], E: [1.2, 0], W: [-1.2, 0] }[d.side], inn = out.map((v) => -v * 1.5);
  S2.doors[d.id] = { open: true };
  assert.ok(L2.walkable(0, (r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2));
  assert.ok(L2.segmentClear(0, d.x + out[0], d.z + out[1], d.x + inn[0], d.z + inn[1]));
  S2.doors[d.id] = { open: false };
  assert.ok(!L2.segmentClear(0, d.x + out[0], d.z + out[1], d.x + inn[0], d.z + inn[1]));
});

test('wallsNear returns boxes, and none of them cover the corridor centre', () => {
  const walls = L.wallsNear(0, 12, 12, 6);
  assert.ok(walls.length > 0);
  for (const w of walls) assert.ok(!(12 > w.x0 && 12 < w.x1 && 12 > w.z0 && 12 < w.z1));
});

test('nav path connects two corridor points in neighbouring chunks', () => {
  L.chunkAt(0, 36, 12); // generate the neighbour
  const p = L.path(0, { x: 12, z: 12 }, { x: 36, z: 12 });
  assert.ok(p && p.length >= 2);
  for (let k = 1; k < p.length; k++) assert.ok(L.segmentClear(0, p[k - 1].x, p[k - 1].z, p[k].x, p[k].z), `leg ${k}`);
});

test('forgetting never touches the player chunk or its neighbours, nor pinned chunks; it clears stale room state', () => {
  const S2 = createState(5), L2 = new Layout(5, S2);
  for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) L2.chunkAt(0, i * 24 + 12, j * 24 + 12);
  S2.player.x = 12; S2.player.z = 12; S2.player.floor = 0;
  S2.layout.pinned['0:3:3'] = true;
  S2.rooms['0:-3:-3@0:q0'] = { stale: true };
  S2.doors['0:-3:-3@0:q0:d'] = { open: true };
  const before = L2.chunkAt(0, -3 * 24 + 12, -3 * 24 + 12);
  const rng = makeRng(1);
  const rules = { ...RULES, layout: { ...RULES.layout, forget: { base: 1e6, perClock: 0, every: 5 } } }; // forget everything allowed
  const keys = forgetTick(S2, L2, rng, rules);
  for (const k of keys) { const [, i, j] = k.split(':').map(Number); assert.ok(Math.max(Math.abs(i), Math.abs(j)) >= 2, k); }
  assert.ok(!keys.includes('0:3:3'));
  assert.ok(keys.includes('0:-3:-3'));
  assert.equal(S2.rooms['0:-3:-3@0:q0'], undefined);
  assert.equal(S2.doors['0:-3:-3@0:q0:d'], undefined);
  assert.equal(S2.layout.epochs['0:-3:-3'], 1);
  assert.deepEqual(before.ports, L2.chunkAt(0, -3 * 24 + 12, -3 * 24 + 12).ports);
});

test('forgetChunk bumps one chunk on demand', () => {
  const S2 = createState(5), L2 = new Layout(5, S2);
  L2.chunkAt(0, 12, 12);
  forgetChunk(S2, '0:0:0');
  assert.equal(S2.layout.epochs['0:0:0'], 1);
  assert.equal(L2.chunkAt(0, 12, 12).epoch, 1);
});
