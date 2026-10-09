// RARE NIGHTS (research/07 phase 8): about one night in three, one of four situations, never the
// one you just had; each plays out on its own and ends.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld, NO_INPUT } from '../world.js';
import { RARE_KINDS } from '../modules/rare.js';
import { chunkLightState } from '../lights.js';

const run = (w, secs, inp = NO_INPUT) => { const ev = []; for (let i = 0; i < Math.round(secs * 60); i++) ev.push(...stepWorld(w, inp)); return ev; };
// a night with this rare thing in it, past the opening, quiet, looking down the corridor
function night(kind, seed = 21) {
  const w = createWorld({ seed, forceRare: kind }); w.S.director.nextPatrol = 1e9; w.S.director.firstGlimpseAt = 1e9;
  run(w, 12);
  return w;
}

test('about a third of nights have one, spread over the kinds, held back once seen', () => {
  const kinds = {}; let n = 0;
  for (let s = 0; s < 300; s++) { const k = createWorld({ seed: s }).S.rare?.kind; if (k) { n++; kinds[k] = (kinds[k] || 0) + 1; } }
  assert.ok(n > 70 && n < 140, `${n} of 300`);
  for (const k of RARE_KINDS) assert.ok(kinds[k] > 10, `${k}: ${kinds[k]}`);
  for (let s = 0; s < 300; s++) { const k = createWorld({ seed: s, seenRare: ['procession', 'register'] }).S.rare?.kind; assert.ok(!['procession', 'register'].includes(k)); }
  for (let s = 0; s < 50; s++) { const r = createWorld({ seed: s }).S.rare; if (r) assert.ok(r.at >= 200 && r.at <= 560); }
});

test('it waits for a quiet moment: not while you hide, not before the opening is over', () => {
  const w = createWorld({ seed: 21, forceRare: 'register' }); w.S.director.nextPatrol = 1e9; w.S.director.firstGlimpseAt = 1e9;
  assert.ok(!run(w, 9).some((e) => e.type === 'rare'), 'not during the last bell');
  w.S.player.hidden = 'x';
  assert.ok(!run(w, 5).some((e) => e.type === 'rare'));
  w.S.player.hidden = null;
  assert.ok(run(w, 1).some((e) => e.type === 'rare' && e.kind === 'register'));
});

test('the procession crosses ahead, the last one looks, and it ends', () => {
  let w = null;
  for (const s of [21, 3, 8, 14, 30, 41]) { w = night('procession', s); for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) { if (w.S.rare.phase !== 'wait') break; w.S.player.yaw = yaw; run(w, 0.6); } if (w.S.rare.phase === 'on') break; }
  assert.equal(w.S.rare.phase, 'on', 'found a crossing');
  const ev = run(w, 40);
  assert.ok(ev.some((e) => e.type === 'processionLooks'));
  const end = ev.find((e) => e.type === 'rareEnd');
  assert.ok(end && !end.vanished); assert.equal(w.S.rare.phase, 'done');
});

test('the fire drill: emergency lights, nobody hears you run, a rush, then it stops', () => {
  const w = night('fireDrill');
  run(w, 1);
  assert.equal(w.S.rare.phase, 'on');
  const c = w.layout.chunk(0, 2, 2);
  assert.equal(chunkLightState(w.S, c), 'emergency');
  const ev = run(w, 3, { ...NO_INPUT, move: { x: 0, z: 1 }, run: true });
  assert.equal(w.S.player.noise, 0, 'running, and silent');
  const rest = run(w, 20);
  assert.ok([...ev, ...rest].some((e) => e.type === 'drillRush'));
  assert.match(rest.find((e) => e.type === 'rareEnd').text, /Nobody came back/);
  assert.notEqual(chunkLightState(w.S, c), 'emergency');
});

test('the register: the answers stop before the end', () => {
  const w = night('register');
  const lines = run(w, 40).filter((e) => e.type === 'registerLine').map((e) => e.text);
  assert.ok(lines.length >= 9);
  assert.match(lines[1], /Here/); assert.ok(!/Here/.test(lines.at(-3)));
  assert.match(lines.at(-1), /but one/);
});

test('the sanctuary: lit, calm, he will not come; leave it and it goes out', () => {
  let w = null;
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) { w = night('sanctuary'); w.S.player.yaw = yaw; run(w, 1); if (w.S.rare.phase === 'on') break; }
  assert.equal(w.S.rare.phase, 'on');
  const Z = w.S.rare.zone, c = w.layout.chunkByKey(Z.key);
  assert.equal(chunkLightState(w.S, c), 'full');
  Object.assign(w.S.player, { x: Z.cx, z: Z.cz }); w.S.clock.minutes = 100;
  const ev = run(w, 0.5); w.S.director.tension = 50; w.S.director.nextPatrol = 0;
  ev.push(...run(w, 3));
  assert.ok(ev.some((e) => e.type === 'sanctuaryEnter')); assert.ok(w.S.rare.inside);
  assert.ok(w.S.director.tension < 45, `tension ${w.S.director.tension}`);
  assert.ok(!w.S.headmaster.state || w.S.headmaster.state === 'absent', 'no visit while inside');
  const home = w.layout.chunk(0, 0, 0);
  Object.assign(w.S.player, { x: home.x0 + 12, z: home.z0 + 12 });
  const out = run(w, 0.2);
  assert.ok(out.find((e) => e.type === 'rareEnd')?.left);
  assert.notEqual(chunkLightState(w.S, c) === 'full' && w.S.rare.phase === 'on', true);
});
