import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld, NO_INPUT, DEFAULT_MODULES } from '../world.js';
import { exitHazard, reachChance } from '../modules/exit.js';

const tick = (w, input = {}, n = 1) => { const ev = []; for (let i = 0; i < n; i++) ev.push(...stepWorld(w, { ...NO_INPUT, ...input })); return ev; };
const quiet = (seed) => { const w = createWorld({ seed }); w.S.director.nextPatrol = 1e9; return w; };

test('the clock runs 1 min per 20 s and rings the bell at 3:30', () => {
  const w = quiet(1);
  tick(w, {}, 60 * 20); assert.ok(Math.abs(w.S.clock.minutes - 61) < 0.05, `${w.S.clock.minutes}`);
  w.S.clock.minutes = 209.99; const ev = tick(w, {}, 60);
  assert.ok(ev.some((e) => e.type === 'bell')); assert.ok(w.S.clock.bell);
});

test('the clock jumps: +6 per star, +4 when he sees you', () => {
  // a test module, stepping first, announces a star and a sighting on the first tick only
  const announcer = { id: 'announcer', step(S, input, ctx) { if (S.tick === 0) { ctx.emit('starEarned', { why: 'test' }); ctx.emit('hmSee', {}); } } };
  const w = createWorld({ seed: 1, modules: [announcer, ...DEFAULT_MODULES] });
  w.S.director.nextPatrol = 1e9;
  const m0 = w.S.clock.minutes;
  tick(w);
  assert.ok(Math.abs(w.S.clock.minutes - (m0 + 10 + 1 / 1200)) < 1e-6, `${w.S.clock.minutes}`);
});

test('exit formulas match the spec', () => {
  assert.equal(exitHazard(2), 0);
  assert.ok(Math.abs(exitHazard(4) - 0.28) < 1e-9);
  assert.equal(exitHazard(12), 0.6);
  assert.ok(Math.abs(reachChance(5) - 0.15) < 1e-9);
  assert.equal(reachChance(12), 0.35);
});

test('with stars, a ground-floor dead end near you can become the front entrance', () => {
  let found = 0;
  for (let seed = 1; seed <= 30 && !found; seed++) {
    const w = quiet(seed); w.S.held.stars = 12;
    const P = w.S.player;
    // walk the player through a few chunks so dead ends come near
    for (let k = 0; k < 6; k++) { P.x += 24; tick(w, {}, 2); }
    found += Object.keys(w.S.layout.entrances).length;
  }
  assert.ok(found > 0, 'no entrance ever appeared');
});

test('reach roll: success → home time; failure → stars 0, clock +15', () => {
  const ok = quiet(1); ok.S.held.stars = 12; ok.S.director.forceReach = true;
  ok.S.player.target = { kind: 'entrance', id: 'x' };
  assert.ok(tick(ok, { use: true }).some((e) => e.type === 'homeTime'));
  assert.equal(ok.S.phase, 'home');
  const no = quiet(1); no.S.held.stars = 5; no.S.director.forceReach = false;
  const m0 = no.S.clock.minutes; no.S.player.target = { kind: 'entrance', id: 'x' };
  assert.ok(tick(no, { use: true }).some((e) => e.type === 'exitFail'));
  assert.equal(no.S.held.stars, 0); assert.ok(no.S.clock.minutes >= m0 + 15);
});

test('caught → detention; writing 5 lines while he snores → run along, spawned in walkable space', () => {
  const w = quiet(2); w.S.held.stars = 4;
  w.S.headmaster.caughtNow = true; tick(w);
  assert.equal(w.S.phase, 'detention');
  w.S.detention.snoreT = 999; // never stops in this test
  const ev = tick(w, { useHeld: true }, 60 * 21);
  assert.ok(ev.some((e) => e.type === 'runAlong'));
  assert.equal(w.S.phase, 'play'); assert.equal(w.S.held.stars, 0);
  assert.ok(w.layout.walkable(w.S.player.floor, w.S.player.x, w.S.player.z));
});

test('writing while the snoring stops resets the lines', () => {
  const w = quiet(2); w.S.headmaster.caughtNow = true; tick(w);
  w.S.detention.lines = 3; w.S.detention.snore = false; w.S.detention.snoreT = 1;
  const ev = tick(w, { useHeld: true }, 10);
  assert.ok(ev.some((e) => e.type === 'linesReset')); assert.equal(w.S.detention.lines, 0);
});

test('caught after the bell → expelled', () => {
  const w = quiet(2); w.S.clock.bell = true; w.S.headmaster.caughtNow = true; tick(w);
  assert.equal(w.S.phase, 'expelled');
});

test('13 steps: turning around on the flight summons the follower; turning again catches you', () => {
  const w = quiet(2);
  w.S.stairs = { roomId: 'stair-x', steps: 13, climbYaw: 0, follower: false, onFlight: true };
  w.S.player.yaw = Math.PI; let ev = tick(w);
  assert.ok(ev.some((e) => e.type === 'followerAppears'));
  w.S.player.yaw = 0; tick(w); w.S.player.yaw = Math.PI; ev = tick(w);
  assert.ok(ev.some((e) => e.type === 'followerCatch'));
  tick(w);
  assert.equal(w.S.phase, 'detention');
});

test('nothing moves in detention: the Headmaster is gone and the player stays put', () => {
  const w = quiet(2);
  Object.assign(w.S.headmaster, { state: 'chase', x: w.S.player.x + 5, z: w.S.player.z, floor: 0 });
  w.S.headmaster.caughtNow = true; tick(w);
  assert.equal(w.S.headmaster.state, 'absent');
  const { x, z } = w.S.player;
  tick(w, { move: { x: 0, z: -1 } }, 30);
  assert.equal(w.S.player.x, x); assert.equal(w.S.player.z, z);
});
