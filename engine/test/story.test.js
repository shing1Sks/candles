// STORY SEEPAGE (research/07 phase 4): the school's voice tells the official version on schedule;
// what you're made to write, and how the story in the infants' room begins and ends, change with
// how many pages you hold.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld, NO_INPUT } from '../world.js';
import { enterClass } from './helpers.js';
import { detentionLine } from '../story.js';

const run = (w, secs) => { const ev = []; for (let i = 0; i < secs * 60; i++) ev.push(...stepWorld(w, NO_INPUT)); return ev; };

test('the PA speaks a little into the night, then once at the start of each act', () => {
  const w = createWorld({ seed: 4 }); w.S.director.nextPatrol = 1e9;
  const first = run(w, 15).filter((e) => e.type === 'pa');
  assert.equal(first.length, 1); assert.match(first[0].text, /concert/);
  w.S.clock.minutes = 95;
  const second = run(w, 1).filter((e) => e.type === 'pa');
  assert.equal(second.length, 1); assert.equal(second[0].act, 2);
  assert.equal(run(w, 5).filter((e) => e.type === 'pa').length, 0, 'once per act');
});

test('detention lines change with the pages you hold', () => {
  assert.equal(detentionLine(0), 'I will not leave.');
  assert.equal(detentionLine(3), 'I did not smell smoke.');
  const w = createWorld({ seed: 4 }); w.S.held.pages = [1, 2, 3, 4];
  w.S.headmaster.caughtNow = true; stepWorld(w, NO_INPUT);
  assert.equal(w.S.phase, 'detention'); assert.equal(w.S.detention.text, 'I was not there.');
});

test('Story Time begins and ends differently once you know about the concert', () => {
  const { w, room } = enterClass(11, 'story');
  w.S.held.pages = [1, 2];
  room.lesson.line = 0; room.lesson.lineT = 0.01; // read the first line again, now
  const start = run(w, 1).find((e) => e.type === 'storyLine');
  assert.equal(start.kind, 'start'); assert.match(start.text, /concert|sang/);
  w.S.held.pages = [1, 2, 3, 4];
  room.lesson.line = 9; room.lesson.lineT = 0.01;
  const end = run(w, 1).find((e) => e.type === 'storyLine');
  assert.equal(end.kind, 'end'); assert.match(end.text, /nobody got out/);
});

test('some dead ends are the Hall: chained doors that say more the more pages you hold', () => {
  // find a seed and an old-wing dead end near the start
  const w = createWorld({ seed: 11 }); w.S.director.nextPatrol = 1e9;
  let found = null;
  for (let i = -8; i <= 8 && !found; i++) for (let j = -8; j <= 8 && !found; j++) { const c = w.layout.chunk(0, i, j); if (c.deadEnd && c.wing === 'old') found = c; }
  assert.ok(found, 'no old-wing dead end near the start');
  // walk every dead end on the way until one turns out to be the Hall
  const ends = [];
  for (let i = -8; i <= 8; i++) for (let j = -8; j <= 8; j++) { const c = w.layout.chunk(0, i, j); if (c.deadEnd) ends.push(c); }
  for (const c of ends) { Object.assign(w.S.player, { x: c.deadEnd.x, z: c.deadEnd.z }); stepWorld(w, NO_INPUT); if (Object.keys(w.S.layout.hallDoors || {}).length) break; }
  const key = Object.keys(w.S.layout.hallDoors || {})[0];
  assert.ok(key, 'no Hall doors among the dead ends');
  w.S.held.pages = [1, 2, 3];
  w.S.player.target = { kind: 'hallDoor', id: `${key}:hall` };
  const ev = stepWorld(w, { ...NO_INPUT, use: true }).concat(stepWorld(w, NO_INPUT));
  const said = ev.find((e) => e.type === 'hallDoor');
  assert.ok(said && /hands/.test(said.text), JSON.stringify(said)); // three pages: the fourth line
});

test('with every page, the Hall doors open: the true ending', () => {
  const w = createWorld({ seed: 11, pagesFound: [1, 2, 3, 4, 5] }); w.S.director.nextPatrol = 1e9;
  const key = '0:0:0';
  (w.S.layout.hallDoors ??= {})[key] = true;
  w.S.interact[`${key}:hall`] = { kind: 'hallDoor', x: w.S.player.x, z: w.S.player.z, floor: 0, r: 1.8, chunk: key };
  w.S.player.target = { kind: 'hallDoor', id: `${key}:hall` };
  const ev = stepWorld(w, { ...NO_INPUT, use: true }).concat(stepWorld(w, NO_INPUT));
  assert.ok(ev.some((e) => e.type === 'trueEnding'), ev.map((e) => e.type).join(','));
  assert.equal(w.S.phase, 'home');
});
