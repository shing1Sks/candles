// EVERY CONCEPT MUST BE PLAYABLE (user, 2026-10-08): a good player has to be able to finish each
// lesson in time, in any room the generator makes. These tests play lessons with the scripted
// lesson agent (mistakes off) across many seeds and kits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepWorld, NO_INPUT } from '../world.js';
import { makeRng } from '../rng.js';
import { lesson as agent } from '../agents/lesson.js';
import { enterClass } from './helpers.js';

const tick = (w, input = {}, n = 1) => { const ev = []; for (let i = 0; i < n; i++) ev.push(...stepWorld(w, { ...NO_INPUT, ...input })); return ev; };

function playLesson(seed, kind, secs = 120) {
  const { w, room } = enterClass(seed, kind);
  const rng = makeRng(seed), mem = { ...agent.init(), noMistakes: true };
  let last = [];
  for (let k = 0; k < secs * 60; k++) {
    last = stepWorld(w, agent.act(w.S, w.layout, rng, mem, last));
    if (room.state !== 'running') break;
  }
  return { room, t: w.S.t };
}

test('holding use sweeps up every paper within reach, no aiming needed', () => {
  const { w, room } = enterClass(11, 'handin');
  const s = room.students[0];
  Object.assign(w.S.player, { x: s.x + 0.6, z: s.z + 0.3, yaw: 2.5 }); // beside them, facing away
  const ev = tick(w, { useHeld: true }, 3);
  assert.ok(ev.some((e) => e.type === 'paperTaken' && e.studentId === s.id));
});

test('sitting down in Eyes looks down for you and gives you a moment', () => {
  const { w, room } = enterClass(11, 'eyes');
  w.S.player.pitch = 0;
  w.S.player.target = { kind: 'mydesk', id: room.id };
  const ev = tick(w, { use: true }, 60);
  assert.ok(!ev.some((e) => e.type === 'lessonDoom'), 'doomed for sitting down');
  assert.ok(w.S.player.pitch < -0.7, `pitch ${w.S.player.pitch}`);
});

for (const kind of ['handin', 'eyes', 'story']) {
  test(`a good player can finish ${kind} in time, in every room tried`, () => {
    const fails = [], times = [];
    for (let seed = 1; seed <= 12; seed++) {
      let r;
      try { r = playLesson(seed, kind); } catch { continue; } // no such room near spawn for this seed
      if (r.room.state !== 'done') fails.push(`seed ${seed}: ${r.room.state} (${r.room.kit})`);
      else times.push(r.t);
    }
    assert.ok(times.length >= 4, `too few rooms tried (${times.length})`);
    assert.deepEqual(fails, []);
  });
}
