import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepWorld, NO_INPUT } from '../world.js';
import { enterClass } from './helpers.js';

const tick = (w, input = {}, n = 1) => { const ev = []; for (let i = 0; i < n; i++) ev.push(...stepWorld(w, { ...NO_INPUT, ...input })); return ev; };

test('Eyes: write 60 s with your eyes down → star', () => {
  const { w, room } = enterClass(11, 'eyes');
  w.S.player.target = { kind: 'mydesk', id: room.id }; tick(w, { use: true });
  assert.ok(w.S.player.seated);
  w.S.player.pitch = -0.9;
  const ev = tick(w, { useHeld: true }, 60 * 61);
  assert.ok(ev.some((e) => e.type === 'lessonSuccess'));
  assert.ok(ev.some((e) => e.type === 'edgeThing'), 'things happen at the edge of your view');
  assert.ok(!w.S.player.seated);
});

test('Eyes: looking up for 0.4 s (after the grace on sitting down) → DOOM', () => {
  const { w, room } = enterClass(11, 'eyes');
  w.S.player.target = { kind: 'mydesk', id: room.id }; tick(w, { use: true });
  w.S.player.pitch = 0;
  const ev = tick(w, { useHeld: true }, 120);
  assert.ok(ev.some((e) => e.type === 'lessonDoom'));
});

test('Eyes: writing pauses while you do not hold use', () => {
  const { w, room } = enterClass(11, 'eyes');
  w.S.player.target = { kind: 'mydesk', id: room.id }; tick(w, { use: true });
  w.S.player.pitch = -0.9;
  tick(w, {}, 60 * 5);
  assert.equal(room.lesson.written, 0);
});

test('Story: the lines narrate you; giving the page in time wins; the last line is DOOM', () => {
  const { w, room } = enterClass(11, 'story');
  const ev = tick(w, {}, 60 * 8);
  const lines = ev.filter((e) => e.type === 'storyLine');
  assert.ok(lines.length >= 1 && lines.every((l) => typeof l.text === 'string' && l.text.length > 0));
  room.lesson.page.found = true; w.S.player.carrying = 1;
  w.S.player.target = { kind: 'lap', id: room.id };
  assert.ok(tick(w, { use: true }).some((e) => e.type === 'lessonSuccess'));

  const b = enterClass(12, 'story');
  b.room.lesson.line = 11; b.room.lesson.lineT = 0.01;
  const ev2 = tick(b.w, {}, 5);
  assert.ok(ev2.some((e) => e.type === 'storyLine' && /caught him/.test(e.text)));
  assert.ok(ev2.some((e) => e.type === 'lessonDoom'));
});

test('Story: finding the page and carrying it', () => {
  const { w, room } = enterClass(11, 'story');
  const key = Object.keys(w.S.interact).find((k) => w.S.interact[k].kind === 'storyPage');
  assert.ok(key, 'the missing page is somewhere in the room');
  w.S.player.target = { kind: 'storyPage', id: key };
  assert.ok(tick(w, { use: true }).some((e) => e.type === 'storyPageFound'));
  assert.ok(room.lesson.page.found);
  assert.equal(w.S.player.carrying, 1);
});

test('Story: running makes her skip ahead', () => {
  const { w, room } = enterClass(11, 'story');
  const f = room.frame, P = w.S.player;
  Object.assign(P, { x: f.cx - f.ix * (f.D / 2 - 0.8) - f.lx * (f.W / 2 - 1.2), z: f.cz - f.iz * (f.D / 2 - 0.8) - f.lz * (f.W / 2 - 1.2), yaw: Math.atan2(-f.lx, -f.lz) });
  tick(w, {}, 15); // the first line
  room.lesson.lineT = 5;
  const l0 = room.lesson.line;
  const ev = tick(w, { move: { x: 0, z: -1 }, run: true }, 30);
  assert.ok(room.lesson.line >= l0 + 1);
  assert.ok(ev.some((e) => e.type === 'storySkip'));
});

test('twists: lockedIn locks the door; oneTooMany adds a student; lightsOut adds 15 s', () => {
  const a = enterClass(11, 'handin', ['lockedIn']);
  assert.ok(Object.values(a.w.S.doors).some((d) => d.locked));
  const base = enterClass(11, 'handin'), more = enterClass(11, 'handin', ['oneTooMany']);
  assert.equal(more.room.students.length, base.room.students.length + 1);
  const dark = enterClass(11, 'handin', ['lightsOut']);
  assert.ok(Math.abs(dark.room.lesson.hymn - (base.room.lesson.hymn + 15)) < 0.05);
});

test('lockedIn unlocks when the lesson is done', () => {
  const { w, room } = enterClass(11, 'handin', ['lockedIn']);
  for (const s of room.students) s.paper = 'taken';
  w.S.player.carrying = room.students.length;
  w.S.player.target = { kind: 'desk', id: room.id };
  tick(w, { use: true });
  assert.ok(!Object.values(w.S.doors).some((d) => d.locked));
});

test('visitor: noise near the Headmaster at the back gets you caught', () => {
  const { w, room } = enterClass(11, 'handin', ['visitor']);
  assert.ok(room.visitor, 'he is sitting at the back');
  Object.assign(w.S.player, { x: room.visitor.x, z: room.visitor.z });
  const ev = tick(w, { move: { x: 0, z: -1 }, run: true }, 20);
  assert.ok(ev.some((e) => e.type === 'hmCatch'));
});

test('wrongBoard writes a hint that is sometimes a lie', () => {
  let lies = 0;
  for (let s = 1; s <= 40; s++) { const { room } = enterClass(s, 'handin', ['wrongBoard']); assert.ok(room.board?.hint); if (!room.board.truthful) lies++; }
  assert.ok(lies > 2 && lies < 25, `lies ${lies}/40`);
});

test('valuables: the drawer star only while her back is turned; the pass and the chalk', () => {
  const { w, room } = enterClass(11, 'handin');
  room.roll.valuables = { drawer: true, pass: true, chalk: true };
  // valuables are laid out at lesson start; re-run their placement for this test
  w.world?.noop;
  const cls = w.modules.find((m) => m.id === 'classroom');
  cls.placeValuables(w.S, room);
  const key = (k) => Object.keys(w.S.interact).find((x) => w.S.interact[x].kind === k);
  room.lesson.phase = 'look';
  w.S.player.target = { kind: 'drawer', id: key('drawer') };
  assert.ok(tick(w, { use: true }).some((e) => e.type === 'drawerStuck'));
  room.lesson.phase = 'chalk'; room.lesson.phaseT = 99;
  w.S.player.target = { kind: 'drawer', id: key('drawer') };
  const ev = tick(w, { use: true });
  assert.ok(ev.some((e) => e.type === 'starEarned'));
  w.S.player.target = { kind: 'pass', id: key('pass') }; tick(w, { use: true });
  assert.equal(w.S.held.pass, 1);
  w.S.player.target = { kind: 'chalk', id: key('chalk') }; tick(w, { use: true });
  assert.equal(w.S.held.chalk, 1);
});

test('a torn page: one per night, kept in held.pages', () => {
  const { w, room } = enterClass(11, 'handin');
  room.roll.valuables = { page: true };
  w.modules.find((m) => m.id === 'classroom').placeValuables(w.S, room);
  const key = Object.keys(w.S.interact).find((x) => w.S.interact[x].kind === 'page');
  w.S.player.target = { kind: 'page', id: key };
  const ev = tick(w, { use: true });
  assert.ok(ev.some((e) => e.type === 'pageFound'));
  assert.equal(w.S.held.pages.length, 1);
  assert.ok(w.S.director.pageGiven);
});

test('chalk on a door pins the chunk', () => {
  const { w } = enterClass(11, 'handin');
  w.S.held.chalk = 1; w.S.player.target = { kind: 'door', id: Object.keys(w.S.doors)[0] };
  const ev = tick(w, { use: true });
  assert.ok(ev.some((e) => e.type === 'doorChalked'));
  assert.ok(Object.keys(w.S.layout.pinned).length >= 1);
  assert.equal(w.S.held.chalk, 0);
});
