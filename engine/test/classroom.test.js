import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../rng.js';
import { RULES } from '../rules.js';
import { createState } from '../state.js';
import { rollRoom } from '../director.js';
import { stepWorld, NO_INPUT } from '../world.js';
import { enterClass } from './helpers.js';

test('roll odds are close to the rulebook over 10k rolls; story only in infants; no immediate repeat', () => {
  const S = createState(1), rng = makeRng(2);
  const n = { handin: 0, eyes: 0 }, scenes = {}; let prev = null;
  for (let k = 0; k < 10000; k++) {
    const r = rollRoom(S, { id: 'r' + k, kit: 'standard' }, rng, RULES);
    n[r.lesson]++; scenes[r.scene] = (scenes[r.scene] || 0) + 1;
    const sig = r.scene + '|' + r.lesson + '|' + r.twists.slice().sort().join(',');
    assert.notEqual(sig, prev); prev = sig;
  }
  assert.ok(Math.abs(n.handin / 10000 - 0.6) < 0.04, `handin share ${n.handin / 10000}`);
  // Act I: a bit over half the doors are lessons (0.55, plus the scenes turned into lessons so the same
  // scene never comes twice running); the rest are empty rooms, a lone child, an aftermath
  assert.ok(scenes.lesson / 10000 > 0.55 && scenes.lesson / 10000 < 0.68, `lesson share ${scenes.lesson / 10000}`);
  assert.ok(scenes.empty > 1700 && scenes.loneChild > 1000 && !scenes.facingWall, JSON.stringify(scenes));
  for (let k = 0; k < 200; k++) assert.equal(rollRoom(S, { id: 'i' + k, kit: 'infants' }, rng, RULES).lesson, 'story');
});

test('a classroom is rolled and its lesson starts when you step inside', () => {
  const { room } = enterClass(11, 'handin');
  assert.ok(room, 'room state exists');
  assert.equal(room.state, 'running');
  assert.ok(room.students.length >= 5); // Act I classes are small (6-9)
  assert.ok(room.teacher && Number.isFinite(room.teacher.deskX));
});

test('Hand In Your Work: collecting every paper and delivering in time earns a star', () => {
  const { w, room } = enterClass(11, 'handin');
  const evs = [];
  for (const s of room.students) { Object.assign(w.S.player, { x: s.x, z: s.z }); w.S.player.target = { kind: 'paper', id: s.id }; evs.push(...stepWorld(w, { ...NO_INPUT, use: true })); }
  w.S.player.target = { kind: 'desk', id: room.id };
  evs.push(...stepWorld(w, { ...NO_INPUT, use: true }));
  assert.ok(evs.some((e) => e.type === 'stackDelivered'));
  assert.ok(evs.some((e) => e.type === 'starEarned'));
  assert.equal(room.state, 'done');
  assert.equal(w.S.held.stars, 1);
});

test('Hand In Your Work: when the hymn ends, DOOM', () => {
  const { w, room } = enterClass(11, 'handin');
  room.lesson.hymn = 0.05;
  const ev = []; for (let i = 0; i < 10; i++) ev.push(...stepWorld(w, NO_INPUT));
  assert.ok(ev.some((e) => e.type === 'lessonDoom'));
  assert.equal(w.S.phase, 'expelled');
});

test('Hand In Your Work: moving while she looks costs 10 s of hymn', () => {
  const { w, room } = enterClass(11, 'handin');
  room.firstTime = false; // not the forgiving first lesson of the night
  room.lesson.phase = 'look'; room.lesson.phaseT = 1.5;
  const h0 = room.lesson.hymn;
  const ev = []; for (let i = 0; i < 20; i++) ev.push(...stepWorld(w, { ...NO_INPUT, move: { x: 0, z: -1 } }));
  assert.ok(ev.some((e) => e.type === 'seenMoving'));
  assert.ok(room.lesson.hymn < h0 - 9.5);
});

test('delivering on the last tick of the hymn still wins', () => {
  const { w, room } = enterClass(11, 'handin');
  for (const s of room.students) s.paper = 'taken';
  w.S.player.carrying = room.students.length;
  room.lesson.hymn = 1 / 60;
  w.S.player.target = { kind: 'desk', id: room.id };
  const ev = stepWorld(w, { ...NO_INPUT, use: true });
  assert.ok(ev.some((e) => e.type === 'lessonSuccess'));
  assert.ok(!ev.some((e) => e.type === 'lessonDoom'));
});

test('an unfinished paper makes that student watch you', () => {
  const { w, room } = enterClass(11, 'handin');
  const s = room.students[0]; s.finished = false;
  w.S.player.target = { kind: 'paper', id: s.id };
  const ev = stepWorld(w, { ...NO_INPUT, use: true });
  assert.ok(ev.some((e) => e.type === 'paperTaken' && e.unfinished));
  assert.ok(s.tracking);
});

test('walking out mid-lesson abandons it and locks the door behind you', () => {
  const { w, room, layoutRoom } = enterClass(11, 'handin');
  const d = layoutRoom.door, out = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[d.side];
  Object.assign(w.S.player, { x: d.x + out[0] * 1.5, z: d.z + out[1] * 1.5 });
  const ev = stepWorld(w, NO_INPUT);
  assert.ok(ev.some((e) => e.type === 'lessonAbandoned'));
  assert.equal(room.state, 'abandoned');
  assert.ok(w.S.doors[d.id].locked);
});

test('desks are solid', () => {
  const { w, room } = enterClass(11, 'handin');
  const d = room.desks.find((x) => !x.mine && !x.extra), f = room.frame;
  // stand just behind the desk's seat side and walk straight at it, toward the board
  Object.assign(w.S.player, { x: d.x - f.ix * 1.2, z: d.z - f.iz * 1.2, vx: 0, vz: 0 });
  w.S.player.yaw = Math.atan2(-f.ix, -f.iz);
  for (let i = 0; i < 90; i++) stepWorld(w, { ...NO_INPUT, move: { x: 0, z: -1 } });
  const P = w.S.player, along = (P.x - d.x) * f.ix + (P.z - d.z) * f.iz;
  assert.ok(along < -0.3, `walked into the desk (${along.toFixed(2)})`);
});
