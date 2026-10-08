import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld, NO_INPUT } from '../world.js';

function rig(seed = 11) {
  const w = createWorld({ seed });
  const P = w.S.player;
  // put him 10 m east of the player along the corridor, patrolling
  Object.assign(w.S.headmaster, { state: 'patrol', x: P.x + 10, z: P.z, floor: P.floor, yaw: 0, path: [], timer: 60 });
  w.S.director.nextPatrol = 1e9;
  return w;
}
const run = (w, input, secs) => { const ev = []; for (let i = 0; i < Math.round(secs * 60); i++) ev.push(...stepWorld(w, { ...NO_INPUT, ...input })); return ev; };

test('he hears running within 14 m, even facing away', () => {
  const w = rig(); w.S.headmaster.yaw = -Math.PI / 2; // facing east, away from the player
  const ev = run(w, { move: { x: 0, z: -1 }, run: true }, 0.5);
  assert.ok(ev.some((e) => e.type === 'hmHear'));
  assert.ok(!ev.some((e) => e.type === 'hmSee'));
});

test('he sees you in his cone with a clear line and gives chase', () => {
  const w = rig(); w.S.headmaster.yaw = Math.PI / 2; // facing west, toward the player
  const ev = run(w, {}, 0.5);
  assert.ok(ev.some((e) => e.type === 'hmSee'));
  assert.equal(w.S.headmaster.state, 'chase');
});

test('within 1 m he catches you', () => {
  const w = rig(); Object.assign(w.S.headmaster, { state: 'chase', x: w.S.player.x + 0.8, yaw: Math.PI / 2, seenAt: 0 });
  const ev = run(w, {}, 0.2);
  assert.ok(ev.some((e) => e.type === 'hmCatch'));
  assert.equal(w.S.phase, 'detention'); // the catch hands you to detention on the same tick
});

test('a hall pass sends him away', () => {
  const w = rig(); w.S.held.pass = 1; Object.assign(w.S.headmaster, { state: 'chase', x: w.S.player.x + 2.5, yaw: Math.PI / 2, seenAt: 0 });
  const ev = run(w, { show: true }, 4);
  assert.ok(ev.some((e) => e.type === 'hmStoop'));
  assert.ok(!ev.some((e) => e.type === 'hmCatch'));
  assert.equal(w.S.held.pass, 0);
  assert.ok(['leave', 'absent'].includes(w.S.headmaster.state), w.S.headmaster.state);
});

test('a dropped star stops him for 4 s', () => {
  const w = rig(); w.S.held.stars = 2; Object.assign(w.S.headmaster, { state: 'chase', x: w.S.player.x + 6, yaw: Math.PI / 2, seenAt: 0 });
  run(w, { drop: true }, 1 / 60);
  run(w, {}, 1);
  assert.equal(w.S.headmaster.state, 'pinStar');
  assert.equal(w.S.held.stars, 1);
  run(w, {}, 3.5);
  assert.notEqual(w.S.headmaster.state, 'pinStar');
});

test('out of sight for 6 s, he loses you', () => {
  const w = rig(); Object.assign(w.S.headmaster, { state: 'chase', seenAt: w.S.t, x: w.S.player.x + 30 });
  w.S.player.hidden = 'locker-x';
  const ev = run(w, {}, 6.5);
  assert.ok(ev.some((e) => e.type === 'hmLose'));
  assert.ok(!ev.some((e) => e.type === 'hmCatch'));
});

test('he arrives on schedule, out of sight, and kills the lights toward you one by one', () => {
  const w = createWorld({ seed: 11 });
  w.S.clock.minutes = 160; // Act III: full patrols (Act I has none, Act II starts with glimpses)
  w.S.director.nextPatrol = 0.1;
  const ev = run(w, {}, 6);
  const arrive = ev.find((e) => e.type === 'hmArrive');
  assert.ok(arrive, 'expected an arrival');
  const H = w.S.headmaster, P = w.S.player;
  const d = Math.hypot(arrive.x - P.x, arrive.z - P.z);
  assert.ok(d >= 20, `spawned only ${d.toFixed(1)} m away`);
  const deaths = ev.filter((e) => e.type === 'hmLightDie');
  assert.ok(deaths.length >= 3, `only ${deaths.length} lights died`);
  for (let k = 1; k < deaths.length; k++) assert.ok(deaths[k].t - deaths[k - 1].t > 0.7, 'lights die about 0.8 s apart');
  assert.ok(Object.values(w.S.lights).some((v) => v === 0));
  assert.ok(['approach', 'patrol', 'chase'].includes(H.state));
});

test('after the patrol he leaves and the lights come back', () => {
  const w = rig(); w.S.headmaster.timer = 0.1; w.S.headmaster.yaw = -Math.PI / 2;
  w.S.lights['x:L1'] = 0; w.S.headmaster.killed = ['x:L1'];
  const ev = run(w, {}, 30);
  assert.ok(ev.some((e) => e.type === 'hmLeave'));
  assert.equal(w.S.lights['x:L1'], undefined);
  assert.equal(w.S.headmaster.state, 'absent');
});

test('hiding while he watches does not work: he walks over and catches you', () => {
  const w = rig(); Object.assign(w.S.headmaster, { state: 'chase', x: w.S.player.x + 6, yaw: Math.PI / 2, seenAt: w.S.t });
  const k = w.layout.chunkAt(0, w.S.player.x, w.S.player.z).lockers[0];
  w.S.player.target = { kind: 'locker', id: k.id };
  run(w, { use: true }, 1 / 60);
  assert.equal(w.S.player.hidden, k.id);
  const ev = run(w, {}, 5);
  assert.ok(ev.some((e) => e.type === 'hmCatch'));
});

test('hiding unseen works: he patrols past', () => {
  const w = rig(); w.S.headmaster.yaw = -Math.PI / 2; // facing away, never saw you
  const k = w.layout.chunkAt(0, w.S.player.x, w.S.player.z).lockers[0];
  w.S.player.target = { kind: 'locker', id: k.id };
  run(w, { use: true }, 1 / 60);
  const ev = run(w, {}, 10);
  assert.ok(!ev.some((e) => e.type === 'hmCatch' || e.type === 'hmSee'));
});
