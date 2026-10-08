// FAIR LESSONS (research/05 R20-R25): every lose condition is telegraphed in three beats; mistakes
// are strikes, and only the third is doom; each rule is taught once, gently; the story hints honestly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepWorld, NO_INPUT } from '../world.js';
import { enterClass } from './helpers.js';

const tick = (w, input = {}, n = 1) => { const ev = []; for (let i = 0; i < n; i++) ev.push(...stepWorld(w, { ...NO_INPUT, ...input })); return ev; };
const until = (w, type, secs = 20, input = {}) => { for (let i = 0; i < secs * 60; i++) { const ev = stepWorld(w, { ...NO_INPUT, ...input }); const e = ev.find((x) => x.type === type); if (e) return { e, t: w.S.t }; } return null; };

test('Hand In Your Work: the chalk slows, she lifts her shoulder, then she looks (at least 0.6 s of warning)', () => {
  const { w } = enterClass(11, 'handin');
  const slow = until(w, 'chalkSlow'); assert.ok(slow, 'no chalkSlow');
  const turning = until(w, 'teacherTurning', 3); assert.ok(turning, 'no teacherTurning');
  const looks = until(w, 'teacherLooks', 3); assert.ok(looks, 'no teacherLooks');
  assert.ok(looks.t - slow.t >= 0.6 - 1e-9, `only ${(looks.t - slow.t).toFixed(2)} s of warning`);
});

test('moving while she looks is a strike; the third strike is doom', () => {
  const { w, room } = enterClass(11, 'handin');
  room.firstTime = false;
  const strikes = [];
  for (let n = 0; n < 3; n++) {
    room.lesson.phase = 'look'; room.lesson.phaseT = 1.5; room.lesson.seenThisLook = false;
    const ev = tick(w, { move: { x: 0, z: -1 } }, 20);
    strikes.push(...ev.filter((e) => e.type === 'strike'));
    if (n < 2) assert.equal(room.state, 'running', `doomed after strike ${n + 1}`);
  }
  assert.deepEqual(strikes.map((e) => e.n), [1, 2, 3]);
  assert.equal(room.state, 'doom');
});

test('the first time a lesson is met, her first look is forgiving and the rule is on the board', () => {
  const { w, room } = enterClass(11, 'handin');
  assert.ok(room.firstTime, 'first handin of the night should be marked');
  assert.ok(room.board?.rule, 'the board should show the rule');
  room.lesson.phase = 'look'; room.lesson.phaseT = 1.5;
  const ev = tick(w, { move: { x: 0, z: -1 } }, 20);
  assert.ok(ev.some((e) => e.type === 'nearlySeen'), 'a warning instead of a strike');
  assert.ok(!ev.some((e) => e.type === 'strike'));
});

test('Eyes is 40 s of writing; one whisper lies to you', () => {
  const { w, room } = enterClass(11, 'eyes');
  room.firstTime = false;
  w.S.player.target = { kind: 'mydesk', id: room.id }; tick(w, { use: true });
  const ev = tick(w, { useHeld: true }, 60 * 41);
  assert.ok(ev.some((e) => e.type === 'lessonSuccess'), 'not done in 40 s');
  assert.ok(ev.some((e) => e.type === 'edgeThing' && e.kind === 'lie'), 'no lying whisper');
});

test('Story Time: the third line hints where the page is; running skips only one line', () => {
  const { w, room } = enterClass(11, 'story');
  const lines = [];
  for (let i = 0; i < 60 * 20 && lines.length < 3; i++) for (const e of stepWorld(w, NO_INPUT)) if (e.type === 'storyLine') lines.push(e);
  assert.equal(lines[2].kind, 'hint');
  // run along the clear strip at the back of the room
  const f = room.frame, P = w.S.player;
  Object.assign(P, { x: f.cx - f.ix * (f.D / 2 - 0.8) - f.lx * (f.W / 2 - 1.2), z: f.cz - f.iz * (f.D / 2 - 0.8) - f.lz * (f.W / 2 - 1.2), yaw: Math.atan2(-f.lx, -f.lz) });
  room.lesson.skipCool = 0; room.lesson.lineT = 5;
  const l0 = room.lesson.line;
  tick(w, { move: { x: 0, z: -1 }, run: true }, 30);
  assert.equal(room.lesson.line, l0 + 1);
});
