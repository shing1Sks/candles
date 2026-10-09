// THE LAST BELL (research/07 phase 8): every night opens lit and ordinary; the bell rings, and the
// lights go out from the far end toward you; the corridor you started in stays ordinary until Act II.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld, NO_INPUT } from '../world.js';
import { lightLevel, chunkLightState, dayLit } from '../lights.js';
import { openingCard } from '../story.js';

const run = (w, secs) => { const ev = []; for (let i = 0; i < Math.round(secs * 60); i++) ev.push(...stepWorld(w, NO_INPUT)); return ev; };
const ring = (w, r) => { const out = []; for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) out.push(w.layout.chunk(0, i, j)); return out; };

test('before the bell every corridor is lit; then the far ones go dark first', () => {
  const w = createWorld({ seed: 21 }); w.S.director.nextPatrol = 1e9;
  const cs = ring(w, 2);
  assert.ok(cs.every((c) => chunkLightState(w.S, c) === 'full'), 'the school is on');
  const ev = run(w, w.S.opening.bellAt + 0.05);
  const bell = ev.find((e) => e.type === 'lastBell');
  assert.ok(bell, 'the last bell rings'); assert.equal(w.S.opening.phase, 'sweep');
  run(w, w.S.opening.sweep * 0.35);
  const far = cs.filter((c) => Math.hypot(c.i, c.j) >= 2), near = w.layout.chunk(0, 1, 0);
  assert.ok(far.every((c) => !dayLit(w.S, c)), 'the far corridors are already dark');
  assert.ok(dayLit(w.S, near), 'the near ones not yet');
  const after = run(w, w.S.opening.sweep);
  assert.ok(after.some((e) => e.type === 'lightsDown')); assert.equal(w.S.opening.phase, 'night');
});

test('the corridor you start in stays ordinary through Act I', () => {
  const w = createWorld({ seed: 21 }); w.S.director.nextPatrol = 1e9;
  const home = w.layout.chunkAt(0, w.S.player.x, w.S.player.z), O = w.S.opening;
  run(w, O.bellAt + O.sweep + 0.5);
  assert.equal(chunkLightState(w.S, home), 'dead', 'its tubes go out last');
  run(w, 3);
  assert.equal(chunkLightState(w.S, home), 'full');
  assert.ok(home.lights.every((l) => lightLevel(w.S, home, l).I > 0.5));
  assert.ok(!w.S.layout.anomalies?.[`${home.key}@${home.epoch}`], 'nothing wrong with it');
  w.S.clock.minutes = 95; run(w, 0.1);
  assert.equal(w.S.director.canonical, null, 'Act II: it can go wrong now too');
});

test('the opening card changes as you come back', () => {
  assert.deepEqual(openingCard(1, 0), ['Friday', 'the last day of term. You came in late.']);
  assert.match(openingCard(2, 0)[1], /Again/);
  assert.match(openingCard(7, 4)[1], /kept your seat/);
  assert.match(openingCard(5, 0, true)[1], /went home/);
  const later = new Set([3, 4, 5, 6].map((n) => openingCard(n, 0)[1]));
  assert.ok(later.size >= 3, 'later nights vary');
});
