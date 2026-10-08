// CORRIDOR ANOMALIES and WINGS (research/07 phase 3): the school gets wronger as the night goes on,
// never repeats itself back to back, and a child's arrows to a door mean something.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../world.js';
import { rollAnomaly, ANOMALIES } from '../anomalies.js';
import { rollRoom } from '../director.js';
import { makeRng } from '../rng.js';
import { wingOf } from '../layout/wings.js';
import { RULES } from '../rules.js';

const tierMix = (act) => {
  const w = createWorld(5), rng = makeRng(99), tiers = [0, 0, 0, 0];
  for (let i = 0; i < 400; i++) { const a = rollAnomaly(w.S, { key: `0:${i}:7`, epoch: 0, rooms: [], stair: null }, rng, act); tiers[a ? a.tier : 0]++; }
  return tiers;
};

test('Act I is mostly ordinary; Act IV is mostly wrong', () => {
  const one = tierMix(1), four = tierMix(4);
  assert.ok(one[0] > 200 && one[3] === 0, `act I ${one}`);
  assert.ok(four[2] + four[3] > 200, `act IV ${four}`);
});

test('the same anomaly never comes twice within five', () => {
  const w = createWorld(5), rng = makeRng(3), seen = [];
  for (let i = 0; i < 300; i++) { const a = rollAnomaly(w.S, { key: `0:${i}:1`, epoch: 0, rooms: [], stair: null }, rng, 4); if (a) seen.push(a.kind); }
  for (let i = 0; i < seen.length; i++) assert.ok(!seen.slice(Math.max(0, i - 5), i).includes(seen[i]), `${seen[i]} repeated at ${i}`);
  assert.ok(new Set(seen).size >= Object.keys(ANOMALIES).length - 4, 'most kinds should turn up'); // arrowDoor needs a classroom
});

test('arrows to a door: that room has the page, and one more twist', () => {
  const w = createWorld(11), S = w.S, c = w.layout.chunk(0, 0, 0), room = c.rooms.find((r) => r.kind === 'classroom');
  S.layout.anomalies = { [`${c.key}@${c.epoch}`]: { kind: 'arrowDoor', tier: 1, seed: 1, room: room.id } };
  for (let i = 0; i < 20; i++) {
    S.director.lastRoll = null;
    const roll = rollRoom(S, room, makeRng(i), RULES);
    assert.ok(roll.valuables.page && roll.warned && roll.twists.length >= 1, JSON.stringify(roll));
  }
});

test('wings: the start is the main corridor; every wing turns up; no infants upstairs', () => {
  assert.equal(wingOf(11, 0, 0, 0), 'main');
  const seen = new Set();
  for (let i = -10; i < 10; i++) for (let j = -10; j < 10; j++) { seen.add(wingOf(11, 0, i, j)); assert.notEqual(wingOf(11, 1, i, j), 'infants'); }
  assert.deepEqual([...seen].sort(), ['infants', 'main', 'old', 'science']);
});

// ---- rooms that aren't lessons ----
import { stepWorld, NO_INPUT } from '../world.js';
import { enterClass } from './helpers.js';

test('a lone child: no lesson, and when you come close, a line of the story (more pages, later lines)', () => {
  const { w, room } = enterClass(11, 'handin', { scene: 'loneChild' });
  assert.equal(room.state, 'still');
  assert.equal(room.students.length, 1);
  const c = room.students[0];
  w.S.held.pages = [1, 2]; room.spoke = false; // (stepping in at the centre may already have been close enough)
  Object.assign(w.S.player, { x: c.x + 1.0, z: c.z });
  const ev = []; for (let i = 0; i < 5; i++) ev.push(...stepWorld(w, NO_INPUT));
  const said = ev.find((e) => e.type === 'loneChildSpeaks');
  assert.ok(said && /bonfire/.test(said.text), JSON.stringify(said));
});

test('the class facing the wall: take something and they all turn round', () => {
  const { w, room } = enterClass(11, 'handin', { scene: 'facingWall', valuables: { chalk: true } });
  assert.equal(room.state, 'still');
  assert.ok(room.students.length >= 5 && room.students.every((s) => s.wall));
  const id = `${room.id}:v:chalk`, it = w.S.interact[id];
  Object.assign(w.S.player, { x: it.x, z: it.z });
  w.S.player.target = { kind: 'chalk', id };
  const ev = stepWorld(w, { ...NO_INPUT, use: true }).concat(stepWorld(w, NO_INPUT));
  assert.ok(ev.some((e) => e.type === 'theyTurn'), ev.map((e) => e.type).join(','));
  assert.equal(w.S.phase, 'play', 'turning round is a scare, not a punishment');
});

test('an empty room and an aftermath: no children, no lesson, the door stays open', () => {
  for (const scene of ['empty', 'aftermath']) {
    const { w, room } = enterClass(11, 'handin', { scene });
    assert.equal(room.state, 'still'); assert.equal(room.students.length, 0);
    assert.ok(!w.S.doors[room.doorId]?.locked);
    if (scene === 'aftermath') assert.ok(room.mess?.length === room.desks.length && room.litter.length > 5);
  }
});

test('walking up to a classroom door rolls the room behind it (so it can be heard first)', () => {
  const w = createWorld({ seed: 11 }); w.S.director.nextPatrol = 1e9;
  let room = null;
  for (let i = 0; i <= 4 && !room; i++) for (let j = 0; j <= 4 && !room; j++) room = w.layout.chunk(0, i, j).rooms.find((r) => r.kind === 'classroom') || null;
  const d = room.door, out = { N: [0, -1.5], S: [0, 1.5], E: [1.5, 0], W: [-1.5, 0] }[d.side];
  Object.assign(w.S.player, { x: d.x + out[0], z: d.z + out[1], floor: 0 });
  for (let i = 0; i < 20; i++) stepWorld(w, NO_INPUT);
  assert.ok(w.S.rooms[room.id], 'not rolled');
  assert.equal(w.S.rooms[room.id].state, 'idle', 'rolled, but nothing starts until you go in');
});

test('what you saw last night is held back tonight', () => {
  const w = createWorld({ seed: 5, seenAnomalies: ['sameDrawing', 'trailUpWall', 'sootArm'] });
  const rng = makeRng(8), kinds = [];
  for (let i = 0; i < 6; i++) { const a = rollAnomaly(w.S, { key: `0:${i}:3`, epoch: 0, rooms: [], stair: null }, rng, 4); if (a) kinds.push(a.kind); }
  for (const k of kinds.slice(0, 2)) assert.ok(!['sameDrawing', 'trailUpWall', 'sootArm'].includes(k), k);
});
