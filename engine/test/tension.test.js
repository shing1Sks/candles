// THE TENSION DIRECTOR (research/05 R1-R5, R37, R38): tension rises with threat and decays; phases
// gate what may happen; every peak is followed by a forced aftermath; a ledger enforces scare spacing;
// the Headmaster only visits when the director allows, and in Act I not at all.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld, NO_INPUT } from '../world.js';
import { lightLevel } from '../lights.js';

const run = (w, secs, input = {}) => { const ev = []; for (let i = 0; i < Math.round(secs * 60); i++) ev.push(...stepWorld(w, { ...NO_INPUT, ...input })); return ev; };

test('tension rises while he chases you and decays when he is gone', () => {
  const w = createWorld({ seed: 11 });
  const P = w.S.player;
  Object.assign(w.S.headmaster, { state: 'chase', x: P.x + 12, z: P.z, floor: 0, yaw: Math.PI / 2, path: [], seenAt: 0 });
  run(w, 2);
  const high = w.S.director.tension;
  assert.ok(high > 3, `tension ${high}`); // +4/s in sight
  Object.assign(w.S.headmaster, { state: 'absent' });
  w.S.director.tension = 50; run(w, 6); // above 40 it falls fast (-1.5/s)
  assert.ok(w.S.director.tension < 45, `fast decay: ${w.S.director.tension}`);
  w.S.director.tension = 30; w.S.director.phase = 'unease'; w.S.director.quietT = 0; run(w, 20); // below, barely, so small things can build
  assert.ok(w.S.director.tension > 22 && w.S.director.tension < 40, `slow decay: ${w.S.director.tension}`);
});

test('a long silence builds tension by itself; the night has a rising floor', () => {
  const w = createWorld({ seed: 11 });
  w.S.director.tension = 10; w.S.director.quietT = 100; w.S.director.phase = 'calm'; w.S.director.nextAmbient = 1e9;
  run(w, 10);
  assert.ok(w.S.director.tension > 10.8, `silence: ${w.S.director.tension}`);
  w.S.clock.minutes = 180; w.S.director.tension = 0; run(w, 0.1);
  assert.ok(w.S.director.tension >= 29.9, `floor at 3:00: ${w.S.director.tension}`);
});

test('phases follow tension thresholds', () => {
  const w = createWorld({ seed: 11 });
  for (const [t, ph] of [[5, 'calm'], [25, 'unease'], [45, 'dread'], [65, 'hunt']]) {
    w.S.director.tension = t; w.S.director.phase = 'calm'; w.S.director.aftermathT = 0;
    run(w, 0.05);
    assert.equal(w.S.director.phase, ph, `tension ${t}`);
  }
});

test('a peak is followed by a forced aftermath with no Headmaster arrivals', () => {
  const w = createWorld({ seed: 11 });
  w.S.clock.minutes = 160; // Act III: he may visit
  w.S.director.tension = 95;
  const ev = run(w, 1);
  assert.ok(ev.some((e) => e.type === 'phase' && e.phase === 'peak') || w.S.director.phase === 'aftermath');
  run(w, 25);
  assert.equal(w.S.director.phase, 'aftermath');
  w.S.director.nextPatrol = 0;
  const ev2 = run(w, 15);
  assert.ok(!ev2.some((e) => e.type === 'hmArrive'), 'he came during the aftermath');
});

test('Act I: no Headmaster visits at all, only far-off signs of him', () => {
  const w = createWorld({ seed: 11 });
  w.S.director.nextPatrol = 0;
  const ev = run(w, 60);
  assert.ok(!ev.some((e) => e.type === 'hmArrive'));
  assert.ok(w.S.clock.minutes < 90);
});

test('Act I: one glimpse of him, a few minutes in, and only one', () => {
  const w = createWorld({ seed: 11 });
  const ev = run(w, 300).filter((e) => e.type === 'hmArrive');
  assert.equal(ev.length, 1, `${ev.length} arrivals`);
  assert.equal(ev[0].mode, 'glimpse');
  assert.ok(ev[0].t >= 150 && ev[0].t <= 300, `at ${ev[0].t}`); // (later if an apparition took the glimpse slot)
});

test('Act II: his first visits are glimpses — seen far off, then gone', () => {
  const w = createWorld({ seed: 11 });
  w.S.clock.minutes = 100; w.S.director.tension = 30; w.S.director.nextPatrol = 0;
  const ev = run(w, 20);
  const a = ev.find((e) => e.type === 'hmArrive');
  assert.ok(a, 'no visit');
  assert.equal(a.mode, 'glimpse');
  assert.ok(ev.some((e) => e.type === 'hmVanish'), 'he should vanish after a glimpse');
});

test('ambient life happens in calm, never at a peak', () => {
  const w = createWorld({ seed: 11 });
  const calm = run(w, 120).filter((e) => e.type === 'ambient');
  assert.ok(calm.length >= 2, `only ${calm.length} ambient events in 2 min of calm`);
  const w2 = createWorld({ seed: 11 });
  w2.S.director.tension = 99;
  const peak = run(w2, 3).filter((e) => e.type === 'ambient');
  assert.equal(peak.length, 0);
});

test('the ledger spaces big scares at least 180 s apart', () => {
  const w = createWorld({ seed: 11 });
  const D = w.S.director;
  assert.ok(w.modules.find((m) => m.id === 'director').mayScare(w.S, 'stinger'));
  D.ledger.push({ t: w.S.t, kind: 'stinger' });
  assert.ok(!w.modules.find((m) => m.id === 'director').mayScare(w.S, 'stinger'));
  assert.ok(!w.modules.find((m) => m.id === 'director').mayScare(w.S, 'chase'));
});

test('lights: about 30% dead at the start of the night, about 60% by 3:00', () => {
  const w = createWorld({ seed: 11 });
  w.S.opening.phase = 'night'; w.S.director.canonical = null; // after the last bell, away from the start
  const lights = [];
  for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) { const c = w.layout.chunk(0, i, j); for (const l of c.lights) lights.push([c, l]); }
  const dead = (m) => { w.S.clock.minutes = m; return lights.filter(([c, l]) => lightLevel(w.S, c, l).I === 0).length / lights.length; };
  const early = dead(60), late = dead(180);
  assert.ok(early > 0.2 && early < 0.45, `early ${early}`);
  assert.ok(late > 0.5 && late < 0.8, `late ${late}`);
});
