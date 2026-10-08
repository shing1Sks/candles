import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld, NO_INPUT } from '../world.js';

const go = (w, input, n) => { const ev = []; for (let i = 0; i < n; i++) ev.push(...stepWorld(w, { ...NO_INPUT, ...input })); return ev; };
const face = (P, x, z) => { P.yaw = Math.atan2(-(x - P.x), -(z - P.z)); };

test('spawns in walkable space; walking forward moves north at walk speed', () => {
  const w = createWorld({ seed: 11 });
  const P = w.S.player;
  assert.ok(w.layout.walkable(P.floor, P.x, P.z));
  const z0 = P.z;
  go(w, { move: { x: 0, z: -1 } }, 60);
  assert.ok(z0 - P.z > 1.6 && z0 - P.z < 2.3, `moved ${z0 - P.z}`);
});

test('walls stop you', () => {
  const w = createWorld({ seed: 11 });
  w.S.player.yaw = Math.PI / 4; // diagonally into a corner
  go(w, { move: { x: 0, z: -1 }, run: true }, 60 * 10);
  assert.ok(w.layout.walkable(w.S.player.floor, w.S.player.x, w.S.player.z));
});

test('running is loud, crouching is quiet', () => {
  const w = createWorld({ seed: 11 });
  go(w, { move: { x: 0, z: -1 }, run: true }, 30); const loud = w.S.player.noise;
  go(w, { move: { x: 0, z: -1 }, crouch: true }, 30); const quiet = w.S.player.noise;
  assert.ok(loud > 0.9 && quiet < 0.1, `${loud} ${quiet}`);
});

test('empty-handed use, drop and show do nothing but say so', () => {
  const w = createWorld({ seed: 11 });
  w.S.player.yaw = Math.PI / 4; // face nothing in particular
  const ev = go(w, { use: true, drop: true, show: true }, 1).map((e) => e.type);
  assert.ok(ev.includes('dropEmpty') && ev.includes('showEmpty'), ev.join());
  assert.ok(ev.includes('useNothing') || ev.includes('use'));
});

test('use on a door opens it, which makes the room walkable', () => {
  const w = createWorld({ seed: 11 });
  const c = w.layout.chunkAt(0, w.S.player.x, w.S.player.z);
  const r = c.rooms.find((x) => x.kind !== 'stair');
  const P = w.S.player;
  // stand 0.8 m outside the door, facing it (door.side = the room wall it's on; the corridor lies that way)
  const d = r.door, out = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[d.side];
  P.x = d.x + out[0] * 0.9; P.z = d.z + out[1] * 0.9;
  face(P, d.x, d.z);
  go(w, {}, 1); // target is chosen at the end of a tick
  const ev = go(w, { use: true }, 1);
  assert.ok(ev.some((e) => e.type === 'doorOpen'), ev.map((e) => e.type).join());
  assert.ok(w.layout.walkable(0, (r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2));
});

test('a locked door stays shut', () => {
  const w = createWorld({ seed: 11 });
  const r = w.layout.chunkAt(0, w.S.player.x, w.S.player.z).rooms.find((x) => x.kind !== 'stair');
  w.S.doors[r.door.id] = { open: false, locked: true };
  w.S.player.target = { kind: 'door', id: r.door.id };
  const ev = go(w, { use: true }, 1);
  assert.ok(ev.some((e) => e.type === 'doorLocked'));
  assert.ok(!w.S.doors[r.door.id].open);
});

test('hiding in a locker: no movement, no noise; use again to come out', () => {
  const w = createWorld({ seed: 11 });
  const k = w.layout.chunkAt(0, w.S.player.x, w.S.player.z).lockers[0];
  assert.ok(k, 'expected lockers');
  w.S.player.target = { kind: 'locker', id: k.id };
  assert.ok(go(w, { use: true }, 1).some((e) => e.type === 'hide'));
  const { x, z } = w.S.player;
  go(w, { move: { x: 0, z: -1 }, run: true }, 30);
  assert.equal(w.S.player.x, x); assert.equal(w.S.player.z, z); assert.equal(w.S.player.noise, 0);
  w.S.player.target = { kind: 'locker', id: k.id };
  assert.ok(go(w, { use: true }, 1).some((e) => e.type === 'unhide'));
});

test('stairs: walking the switchback takes you to the first floor and out its door', () => {
  // find a stair chunk near the origin
  const w = createWorld({ seed: 11 });
  let st = null;
  for (let i = -9; i <= 9 && !st; i += 3) for (let j = -8; j <= 8 && !st; j += 2) { const c = w.layout.chunk(0, i, j); if (c.stair) st = c; }
  assert.ok(st, 'no stair chunk found');
  const room0 = st.rooms.find((r) => r.kind === 'stair');
  const room1 = w.layout.chunk(1, st.i, st.j).rooms.find((r) => r.kind === 'stair');
  const P = w.S.player;
  const v = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
  // start in the corridor outside the ground-floor door, then walk: in, up flight 1, across, down... up flight 2, out
  const o0 = v[room0.door.side];
  Object.assign(P, { x: room0.door.x + o0[0] * 1.2, z: room0.door.z + o0[1] * 1.2, floor: 0 });
  const walkTo = (x, z, secs = 12) => { for (let i = 0; i < secs * 60; i++) { face(P, x, z); if (Math.hypot(P.x - x, P.z - z) < 0.25) return; stepWorld(w, { ...NO_INPUT, move: { x: 0, z: -1 } }); } };
  const [dx, dz] = v[room0.stairDir ?? ({ N: 'S', S: 'N', E: 'W', W: 'E' }[room0.door.side])];
  const inX = -o0[0], inZ = -o0[1]; // into the room
  const d0 = room0.door, d1 = room1.door;
  walkTo(d0.x + inX * 0.5, d0.z + inZ * 0.5);
  walkTo(d0.x + inX * 8.6, d0.z + inZ * 8.6);         // up flight 1 to the landing
  walkTo(d1.x + inX * 8.6, d1.z + inZ * 8.6);         // across the landing
  walkTo(d1.x + inX * 0.5, d1.z + inZ * 0.5);         // up flight 2, back toward the door wall
  walkTo(d1.x + o0[0] * 1.2, d1.z + o0[1] * 1.2);     // out of the upper door
  assert.equal(P.floor, 1);
  assert.ok(Math.abs(P.y - 3.6) < 0.05, `y ${P.y}`);
  assert.ok(w.layout.walkable(1, P.x, P.z));
});

test('pushing into a wall is standing still: no velocity, no noise', () => {
  const w = createWorld({ seed: 11 });
  w.S.director.nextPatrol = 1e9;
  // stand in the east arm facing east; stepping right is stepping into the south wall
  Object.assign(w.S.player, { x: 20, z: 12, yaw: -Math.PI / 2 });
  go(w, { move: { x: 1, z: 0 } }, 120);
  const P = w.S.player;
  assert.ok(Math.hypot(P.vx, P.vz) < 0.05, `still moving at ${Math.hypot(P.vx, P.vz)}`);
  assert.equal(P.noise, 0);
});
