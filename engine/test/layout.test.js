import { test } from 'node:test';
import assert from 'node:assert/strict';
import { portOpen } from '../layout/ports.js';
import { genChunk } from '../layout/chunk.js';

const SEED = 11, R = 4; // a 9x9 region, i,j in [-4, 4]
const overlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;

test('neighbours agree on shared ports', () => {
  for (const f of [0, 1]) for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) {
    assert.equal(portOpen(SEED, f, i, j, 'E'), portOpen(SEED, f, i + 1, j, 'W'));
    assert.equal(portOpen(SEED, f, i, j, 'S'), portOpen(SEED, f, i, j + 1, 'N'));
  }
});

test('every chunk in the region is reachable from (0,0) through ports', () => {
  for (const f of [0, 1]) {
    const seen = new Set(['0,0']), q = [[0, 0]];
    while (q.length) {
      const [i, j] = q.shift();
      for (const [s, di, dj] of [['N', 0, -1], ['S', 0, 1], ['E', 1, 0], ['W', -1, 0]]) {
        const ni = i + di, nj = j + dj, k = `${ni},${nj}`;
        if (Math.abs(ni) > R + 2 || Math.abs(nj) > R + 2 || seen.has(k) || !portOpen(SEED, f, i, j, s)) continue;
        seen.add(k); q.push([ni, nj]);
      }
    }
    for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) assert.ok(seen.has(`${i},${j}`), `floor ${f} chunk ${i},${j} unreachable`);
  }
});

test('rooms never overlap corridors or each other, and stay inside the chunk', () => {
  for (const f of [0, 1]) for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) {
    const c = genChunk(SEED, f, i, j, 0);
    for (const r of c.rooms) {
      assert.ok(r.x0 >= c.x0 && r.x1 <= c.x0 + 24 && r.z0 >= c.z0 && r.z1 <= c.z0 + 24);
      for (const k of c.corridors) assert.ok(!overlap(r, k), `room ${r.id} overlaps a corridor`);
      for (const o of c.rooms) if (o !== r) assert.ok(!overlap(r, o), `${r.id} overlaps ${o.id}`);
      // the door sits on the room's boundary
      const d = r.door, onEdge = d.x === r.x0 || d.x === r.x1 || d.z === r.z0 || d.z === r.z1;
      assert.ok(onEdge, `${r.id} door not on its wall`);
    }
  }
});

test('every door opens onto a corridor', () => {
  const inRect = (x, z, k) => x >= k.x0 - 1e-9 && x <= k.x1 + 1e-9 && z >= k.z0 - 1e-9 && z <= k.z1 + 1e-9;
  for (const f of [0, 1]) for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) {
    const c = genChunk(SEED, f, i, j, 0);
    for (const r of c.rooms) {
      const d = r.door, out = { N: [0, -0.9], S: [0, 0.9], E: [0.9, 0], W: [-0.9, 0] }[d.side];
      // the gap between room and corridor is at most 0.6 m; 0.9 m out from the door is in the corridor
      assert.ok(c.corridors.some((k) => inRect(d.x + out[0], d.z + out[1], k)), `${r.id} door leads nowhere`);
    }
  }
});

test('stairs exist on both floors at the same quadrant', () => {
  let found = 0;
  for (let i = -R * 3; i <= R * 3; i++) for (let j = -R * 3; j <= R * 3; j++) {
    const a = genChunk(SEED, 0, i, j, 0), b = genChunk(SEED, 1, i, j, 0);
    assert.equal(!!a.stair, !!b.stair);
    if (a.stair) { found++; assert.equal(a.stair.quadrant, b.stair.quadrant); assert.equal(a.stair.steps, b.stair.steps); }
  }
  assert.ok(found > 3, 'expected some stairs in a 25x25 region');
});

test('genChunk is pure: same args, same chunk; a new epoch keeps the ports', () => {
  const a = genChunk(SEED, 0, 2, 3, 0), b = genChunk(SEED, 0, 2, 3, 0), c = genChunk(SEED, 0, 2, 3, 1);
  assert.deepEqual(a, b);
  assert.deepEqual(a.ports, c.ports);
});

test('infants rooms only on the ground floor', () => {
  for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) for (const r of genChunk(SEED, 1, i, j, 0).rooms) assert.notEqual(r.kit, 'infants');
});

test('a one-port chunk is a dead end; corridors line up with the ports', () => {
  let deadEnds = 0;
  for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) {
    const c = genChunk(SEED, 0, i, j, 0), n = Object.values(c.ports).filter(Boolean).length;
    assert.equal(!!c.deadEnd, n === 1);
    if (c.deadEnd) deadEnds++;
    // each open port has corridor reaching the edge midpoint
    const mid = { N: [c.x0 + 12, c.z0], S: [c.x0 + 12, c.z0 + 24], E: [c.x0 + 24, c.z0 + 12], W: [c.x0, c.z0 + 12] };
    for (const [s, open] of Object.entries(c.ports)) {
      const [x, z] = mid[s];
      const touches = c.corridors.some((k) => x >= k.x0 && x <= k.x1 && z >= k.z0 && z <= k.z1);
      assert.equal(touches, open, `chunk ${i},${j} side ${s}`);
    }
  }
  assert.ok(deadEnds > 0, 'expected dead ends');
});
