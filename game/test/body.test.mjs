// The world takes two controllers: the kid's and the giant's. These pin the limits the world enforces on the
// monster's body and the giant's tools, whatever mind is pressing the buttons.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLevel } from '../src/sim/level.js';
import { createGame, stepWorld, IDLE_GI } from '../src/sim/game.js';
import { MON, BEAM } from '../src/sim/rules.js';

const L = parseLevel(), DT = 1 / 60;
const KI = { mx: 0, mz: 0 };

// a game with the monster awake at (mx, mz), the kid left at its start in the playroom
function scene(mx = 5.5, mz = 20.5) {
  const G = createGame(L, 7);
  Object.assign(G.monster, { x: mx, z: mz, awake: true, hx: 1, hz: 0 });
  return G;
}
// run for `secs` with the giant's input `gi` (a press is only sent on the first tick)
function run(G, gi, secs, ki = KI) {
  const n = Math.round(secs / DT), events = [];
  const press = ['lunge', 'use', 'bash', 'yell', 'light', 'reach'];
  for (let i = 0; i < n; i++) {
    const g = { ...IDLE_GI, ...gi };
    if (i > 0) for (const b of press) g[b] = false;
    stepWorld(G, i === 0 ? ki : { ...ki, use: false, throw: false }, g, DT);
    events.push(...G.events); G.events.length = 0;
  }
  return events;
}
const maxSpeed = (G, gi, secs) => {
  let m = 0;
  for (let i = 0; i < Math.round(secs / DT); i++) { stepWorld(G, KI, { ...IDLE_GI, ...gi }, DT); G.events.length = 0; m = Math.max(m, G.monster.speed); }
  return m;
};

test('full stick without run tops out at hunt speed', () => {
  const s = maxSpeed(scene(), { mx: 1 }, 1.5);
  assert.ok(s <= MON.hunt + 1e-6 && s > MON.hunt - 0.1, `speed ${s}`);
});
test('run allows chase speed', () => {
  const s = maxSpeed(scene(), { mx: 1, run: true }, 1.5);
  assert.ok(s <= MON.chase + 1e-6 && s > MON.chase - 0.1, `speed ${s}`);
});
test('rage adds its boost to the run cap', () => {
  const G = scene(); G.monster.rage = 5;
  const s = maxSpeed(G, { mx: 1, run: true }, 1.5);
  assert.ok(s <= MON.chase + MON.rageBoost + 1e-6 && s > MON.chase + MON.rageBoost - 0.1, `speed ${s}`);
});
test('asleep, it does not move', () => {
  const G = scene(); G.monster.awake = false;
  assert.equal(maxSpeed(G, { mx: 1, run: true }, 1), 0);
});

test('lunge: wind-up at half chase speed, then the lunge, then recovery', () => {
  const G = scene();
  const seen = [];
  for (let i = 0; i < Math.round(2.4 / DT); i++) {
    stepWorld(G, KI, { ...IDLE_GI, mx: 1, run: true, lunge: i === 0 }, DT);
    G.events.length = 0;
    seen.push([G.t, G.monster.act, G.monster.speed]);
  }
  const during = (act) => seen.filter((s) => s[1] === act);
  const windup = during('windup'), lunge = during('lunge'), recover = during('recover');
  assert.ok(Math.abs(windup.length * DT - MON.windup) < 2 * DT, `windup ${windup.length * DT}`);
  assert.ok(windup.every((s) => s[2] <= MON.chase * 0.5 + 1e-6));
  assert.ok(Math.abs(lunge.length * DT - MON.lungeTime) < 2 * DT, `lunge ${lunge.length * DT}`);
  assert.ok(lunge.slice(1).every((s) => Math.abs(s[2] - MON.lungeSpeed) < 0.05), 'lunges at lunge speed');
  assert.ok(Math.abs(recover.length * DT - MON.missRecover) < 2 * DT, `recover ${recover.length * DT}`);
  // it slides out of the lunge (10 m/s^2 of braking), then holds to half chase speed
  assert.ok(recover.slice(Math.round(0.45 / DT)).every((s) => s[2] <= MON.chase * 0.5 + 1e-6));
});
test('lunge pressed while recovering is ignored', () => {
  const G = scene();
  run(G, { mx: 1, lunge: true }, MON.windup + MON.lungeTime + 0.1);
  assert.equal(G.monster.act, 'recover');
  run(G, { mx: 1, lunge: true }, 0.1);
  assert.equal(G.monster.act, 'recover');
});

// the nursery's shut double door at x 13, z 9-10
const shutDoor = () => L.doors.find((d) => d.tiles.some(([x, z]) => x === 13 && z === 10));
test('use at a shut door opens it after 0.6 s', () => {
  const G = scene(12.2, 10.0), d = G.doors[shutDoor().id];
  assert.equal(d.open, false);
  const ev = run(G, { mx: 1, use: true }, MON.doorOpen - 0.05);
  assert.equal(G.monster.act, 'door');
  assert.ok(ev.some((e) => e.type === 'doorTry' && e.id === d.id && !e.bash));
  run(G, {}, 0.1);
  assert.equal(d.open, true);
});
test('bash smashes through in 0.9 s', () => {
  const G = scene(12.2, 10.0), d = G.doors[shutDoor().id];
  let ev = run(G, { mx: 1, bash: true }, MON.doorBash - 0.05);
  assert.equal(d.open, false);
  ev = ev.concat(run(G, {}, 0.1));
  assert.equal(d.open, true);
  assert.ok(ev.some((e) => e.type === 'door' && e.bash === true));
});
test('use facing away from a door does nothing', () => {
  const G = scene(12.2, 10.0), d = G.doors[shutDoor().id];
  run(G, { mx: -1, use: true }, 1);
  assert.equal(d.open, false);
  assert.equal(G.monster.act, 'none');
});

test('looking inside a wardrobe with the kid in it catches the kid', () => {
  const G = scene(4.5, 6.1), w = G.wardrobes[0];
  Object.assign(G.kid, { x: w.fx, z: w.fz, hidden: w.id });
  const ev = run(G, { use: true }, MON.checkOpen + 0.1);
  assert.equal(G.state, 'caught');
  assert.ok(ev.some((e) => e.type === 'caught' && e.by === 'found'));
});
test('looking inside an empty wardrobe finds nothing', () => {
  const G = scene(4.5, 6.1);
  const ev = run(G, { use: true }, MON.checkOpen + 0.1);
  assert.equal(G.state, 'play');
  assert.ok(ev.some((e) => e.type === 'checkEmpty'));
});

test('a yell stops it for 0.8 s and carries its reason; another within 6 s is ignored', () => {
  const G = scene();
  let ev = run(G, { mx: 1, yell: true, why: 'gapEscape' }, 0.4);
  assert.equal(G.monster.act, 'yell');
  assert.ok(G.monster.speed < 0.01);
  assert.ok(ev.some((e) => e.type === 'yell' && e.why === 'gapEscape'));
  run(G, { mx: 1 }, 0.5);
  assert.equal(G.monster.act, 'none');
  ev = run(G, { yell: true }, 0.2);
  assert.ok(!ev.some((e) => e.type === 'yell'));
});

test('the searchlight waits for its cooldown, then starts where it is aimed', () => {
  const G = scene();
  run(G, { light: true, ax: 10, az: 10 }, 0.1);
  assert.equal(G.beam.state, 'idle');
  G.beam.cool = 0;
  const ev = run(G, { light: true, ax: 10, az: 10 }, 0.1);
  assert.equal(G.beam.state, 'warn');
  assert.deepEqual([G.beam.x, G.beam.z], [10, 10]);
  assert.ok(ev.some((e) => e.type === 'beam'));
  assert.ok(G.beam.cool > 0, 'a new cooldown starts');
});
test('the hand needs two candles out', () => {
  const G = scene();
  G.reach.cool = 0;
  run(G, { reach: true, ax: 10, az: 10 }, 0.1);
  assert.equal(G.reach.state, 'idle');
  G.candles[0].lit = false; G.candles[1].lit = false; G.reach.cool = 0;
  run(G, { reach: true, ax: 10, az: 10 }, 0.1);
  assert.equal(G.reach.state, 'shadow');
});

// the kid's "nothing happened" events, so refusals show in the data
test('blowing with no candle near says so once per press', () => {
  const G = scene();
  const ev = run(G, {}, 0.5, { mx: 0, mz: 0, blow: true });
  assert.equal(ev.filter((e) => e.type === 'blowNothing').length, 1);
});
test('use with nothing in reach says so', () => {
  const G = scene();
  const ev = run(G, {}, 0.1, { mx: 0, mz: 0, use: true });
  assert.ok(ev.some((e) => e.type === 'useNothing'));
});
test('a door will not shut on a toy in the doorway', () => {
  const G = scene(30, 20.5);
  const d = G.doors.find((q) => q.open);
  Object.assign(G.kid, { x: d.axis === 'x' ? d.x : d.x - 1.0, z: d.axis === 'x' ? d.z - 1.0 : d.z });
  Object.assign(G.items[0], { x: d.x, z: d.z, held: false, fly: null });
  const ev = run(G, {}, 0.1, { mx: 0, mz: 0, use: true });
  assert.equal(d.open, true);
  assert.ok(ev.some((e) => e.type === 'shutRefused' && e.id === d.id));
});
test('coming out of a wardrobe with the monster outside is refused', () => {
  const w = L.wardrobes[0], G = scene(w.fx, w.fz + 1.0);
  Object.assign(G.kid, { x: w.fx, z: w.fz, hidden: w.id, hiddenAt: -10 });
  const ev = run(G, {}, 0.1, { mx: 0, mz: 0, use: true });
  assert.equal(G.kid.hidden, w.id);
  assert.ok(ev.some((e) => e.type === 'unhideRefused'));
});
test('throwing into the wall in front of you is refused', () => {
  const G = scene();
  Object.assign(G.kid, { x: 1.4, z: 20.5, fx: -1, fz: 0, held: 0 });
  Object.assign(G.items[0], { held: true });
  const ev = run(G, {}, 0.1, { mx: 0, mz: 0, throw: true });
  assert.equal(G.kid.held, 0);
  assert.ok(ev.some((e) => e.type === 'throwRefused'));
});
