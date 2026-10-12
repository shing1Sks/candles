// One scenario per rule in docs/mechanics.md (the case ids). Each sets up a moment, plays a few ticks of input
// and checks what the doc says happens - or that nothing happens. Later the same scenarios are the main model's
// exam: it has to produce the same outcomes as these rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLevel, T } from '../src/sim/level.js';
import { createGame, stepWorld, step, makeNoise, IDLE_GI } from '../src/sim/game.js';
import { canSee, observe } from '../src/sim/senses.js';
import { stepBody } from '../src/sim/body.js';
import { createMind, think } from '../src/sim/mind/index.js';
import { KID, MON, BEAM, REACH, VENT } from '../src/sim/rules.js';

const L = parseLevel(), DT = 1 / 60, tf = Math.floor;
const PRESS_K = ['use', 'throw'], PRESS_G = ['lunge', 'use', 'bash', 'yell', 'light', 'reach'];
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const has = (ev, type, f = () => true) => ev.some((e) => e.type === type && f(e));

// run `secs` of input; presses count on the first tick only. ki / gi may be functions of the tick.
function run(G, secs, ki = {}, gi = {}) {
  const ev = [], n = Math.max(1, Math.round(secs / DT));
  for (let i = 0; i < n && G.state === 'play'; i++) {
    const k = { mx: 0, mz: 0, ...(typeof ki === 'function' ? ki(i) : ki) }, g = { ...IDLE_GI, ...(typeof gi === 'function' ? gi(i) : gi) };
    if (i > 0) { for (const b of PRESS_K) if (typeof ki !== 'function') k[b] = false; for (const b of PRESS_G) if (typeof gi !== 'function') g[b] = false; }
    stepWorld(G, k, g, DT);
    ev.push(...G.events); G.events.length = 0;
  }
  return ev;
}
const game = (seed = 1) => createGame(L, seed);
const place = (G, who, x, z, extra = {}) => Object.assign(who === 'kid' ? G.kid : G.monster, { x, z, vx: 0, vz: 0, ...extra });
const wake = (G, x, z, hx = 1, hz = 0) => place(G, 'mon', x, z, { hx, hz, awake: true });
const maxSpeed = (G, secs, ki, who = 'kid') => { let m = 0; run(G, secs, (i) => { if (i) m = Math.max(m, G[who === 'kid' ? 'kid' : 'monster'].speed); return ki; }); return m; };
const classic = (G) => { G.mind = createMind(G, { type: 'classic' }, 1); G.mind.mode = 'patrol'; return G.mind; };
const blankObs = (G) => ({ ...observe(G), sees: false, kid: null, heard: [], alerts: [], ping: null, felt: [], hideSeen: -1, gapSeen: -1 });
const beside0 = { x: 12.28, z: 4.72 }; // the nursery candle (id 0) is at 12.78, 4.22

// ---------------- 0. the board and the tick
test('G0 every tile type passes and blocks as the table says', () => {
  const want = { [T.FLOOR]: [1, 1, 0, 0], [T.WALL]: [0, 0, 1], [T.DUCT]: [1, 1, 1, 1], [T.CRACK]: [1, 0, 1, 1], [T.TABLE]: [1, 0, 0, 1], [T.BED]: [1, 0, 0, 1], [T.LOW]: [0, 0, 0], [T.TALL]: [0, 0, 1] };
  for (const [type, [kid, mon, sight, crawl]] of Object.entries(want)) {
    const i = L.tiles.findIndex((t) => t === Number(type)), x = i % L.w, z = Math.floor(i / L.w);
    assert.equal(!L.kidBlocked(x, z), !!kid, `type ${type} kid`); assert.equal(!L.monBlocked(x, z), !!mon, `type ${type} monster`);
    assert.equal(L.sightBlocked(x, z), !!sight, `type ${type} sight`);
    if (crawl !== undefined) assert.equal(L.crawl(x, z), !!crawl, `type ${type} crawl`);
  }
  const G = game(), shut = G.doors[2], open = G.doors[0];
  assert.ok(G.kidBlocked(...shut.tiles[0]) && G.monBlocked(...shut.tiles[0]) && G.sightBlocked(...shut.tiles[0]));
  assert.ok(!G.kidBlocked(...open.tiles[0]) && !G.monBlocked(...open.tiles[0]) && !G.sightBlocked(...open.tiles[0]));
});
test('G1 ten kid-only passages, each with ways out', () => {
  assert.equal(L.passages.length, 10);
  for (const p of L.passages) assert.ok(p.exits.length >= 2);
});
test('G2 six candles, eleven doors, three wardrobes, seven toys, five squeaky toys, twelve creaky boards', () => {
  assert.deepEqual([L.candles.length, L.doors.length, L.wardrobes.length, L.items.length, L.squeaks.length, L.creaks.size], [6, 11, 3, 7, 5, 12]);
});
test('G3 once the game is over nothing else happens', () => {
  const G = game(); G.state = 'caught';
  const t = G.t; run(G, 1, { mx: 1 });
  assert.equal(G.t, t);
});
test('G4 the start: kid in the playroom, monster asleep, all candles lit, light at 45 s, no hand', () => {
  const G = game();
  assert.deepEqual([G.kid.x, G.kid.z, G.monster.x, G.monster.z], [18.5, 13.5, 35.5, 1.5]);
  assert.equal(G.monster.awake, false);
  assert.ok(G.candles.every((c) => c.lit));
  assert.equal(G.beam.cool, BEAM.first); assert.equal(G.reach.cool, -1);
});
test('G5 the last candle out wins', () => {
  const G = game();
  G.candles.forEach((c) => { if (c.id) { c.lit = false; c.progress = 1.01; } });
  place(G, 'kid', beside0.x, beside0.z); G.candles[0].progress = 0.995;
  const ev = run(G, 0.1, { blow: true });
  assert.equal(G.state, 'won'); assert.ok(has(ev, 'won'));
});
test('G6 a catch loses', () => {
  const G = game(); place(G, 'kid', 10.5, 20.5); wake(G, 9.7, 20.5);
  run(G, 0.05);
  assert.equal(G.state, 'caught');
});

// ---------------- 1. moving
test('K1 running tops out at 3.2 m/s and is heard 10 m off', () => {
  const G = game(); place(G, 'kid', 5.5, 20.5);
  const s = maxSpeed(G, 1.2, { mx: 1 });
  assert.ok(s <= KID.run + 1e-6 && s > KID.run - 0.1, `${s}`);
  assert.ok(G.kid.running); assert.equal(G.kid.noise, KID.noiseRun);
});
test('K2 creeping tops out at 1.4 m/s, silently', () => {
  const G = game(); place(G, 'kid', 5.5, 20.5);
  const s = maxSpeed(G, 1.2, { mx: 1, creep: true });
  assert.ok(s <= KID.creep + 1e-6 && s > KID.creep - 0.1); assert.equal(G.kid.noise, 0); assert.ok(!G.kid.running);
});
test('K3 crawling in a vent: 1.7 m/s with a rattle, 1.0 creeping and quiet', () => {
  let G = game(); place(G, 'kid', 15.5, 1.5);
  let s = maxSpeed(G, 1, { mx: 1 });
  assert.ok(G.kid.crawl); assert.ok(s <= KID.crawl + 1e-6 && s > KID.crawl - 0.1); assert.equal(G.kid.noise, KID.noiseCrawl);
  G = game(); place(G, 'kid', 15.5, 1.5);
  s = maxSpeed(G, 1, { mx: 1, creep: true });
  assert.ok(s <= KID.crawlCreep + 1e-6); assert.equal(G.kid.noise, 0);
});
test('K4 the kid slides along walls and never into them', () => {
  const G = game(); place(G, 'kid', 1.5, 20.5);
  run(G, 1, { mx: -1, mz: 0.3 });
  assert.ok(G.kid.x >= 1 + KID.radius - 1e-6, `${G.kid.x}`);
});
test('K5 the kid faces where it moves', () => {
  const G = game(); place(G, 'kid', 5.5, 20.5);
  run(G, 0.3, { mz: 1 });
  assert.ok(G.kid.fz > 0.99);
});
test('K6 the monster can never enter a crawl space (here a table)', () => {
  const G = game(); wake(G, 18.5, 14.4, 0, 1);
  run(G, 1, {}, { mz: 1 });
  assert.ok(G.monster.z <= 15 - MON.radius + 1e-6, `${G.monster.z}`);
});

// ---------------- 2. candles
test('C1 blowing: next to a lit candle in sight, the kid stops and faces it', () => {
  const G = game(); place(G, 'kid', beside0.x, beside0.z);
  run(G, 0.3, { blow: true, mx: 1 });
  assert.equal(G.kid.blowing, 0); assert.ok(G.kid.speed < 0.01);
  assert.ok(G.kid.fx > 0.5 && G.kid.fz < -0.5);
});
test('C2 progress is kept when you let go: 1.0 s, a rest, 0.55 s puts it out', () => {
  const G = game(); place(G, 'kid', beside0.x, beside0.z);
  run(G, 1.0, { blow: true });
  assert.ok(G.candles[0].lit && near(G.candles[0].progress, 1 / KID.blowTime, 0.02));
  run(G, 1.0, {});
  const ev = run(G, 0.55, { blow: true });
  assert.ok(!G.candles[0].lit); assert.ok(has(ev, 'candleOut', (e) => e.id === 0));
});
test('C3 blowing is heard 6 m off', () => {
  const G = game(); place(G, 'kid', beside0.x, beside0.z);
  run(G, 0.2, { blow: true });
  assert.equal(G.kid.noise, KID.noiseBlow);
});
test('C4 a candle out: the monster is told exactly where, is enraged 5 s, the giant slams', () => {
  const G = game(); place(G, 'kid', beside0.x, beside0.z); G.candles[0].progress = 0.995;
  const ev = run(G, 0.05, { blow: true });
  assert.ok(has(ev, 'candleOut') && has(ev, 'slam'));
  assert.ok(near(G.monster.rage, MON.rage, 0.1));
  assert.ok(G.sense.alertsSeen.some((a) => a.kind === 'candle' && near(a.x, G.candles[0].x)));
});
test('C5 more candles out: its sense of you comes faster', () => {
  const gap = (out) => {
    const G = game(); wake(G, 30.5, 20.5);
    G.candles.slice(0, out).forEach((c) => { c.lit = false; });
    G.sense.pingT = 0.001; run(G, DT);
    return G.sense.pingT;
  };
  const all = gap(0), last = gap(5);
  assert.ok(all >= MON.pingEvery[0] * 0.8 - 0.05 && all <= MON.pingEvery[0] * 1.2);
  assert.ok(last >= MON.pingEvery[1] * 0.8 - 0.05 && last <= MON.pingEvery[1] * 1.2);
});
test('C6 nothing happens blowing at nothing, or at a candle already out (it never relights)', () => {
  let G = game(); place(G, 'kid', 5.5, 20.5);
  assert.ok(has(run(G, 0.3, { blow: true }), 'blowNothing'));
  G = game(); place(G, 'kid', beside0.x, beside0.z); G.candles[0].lit = false; G.candles[0].progress = 1.01;
  const ev = run(G, 1, { blow: true });
  assert.ok(has(ev, 'blowNothing') && !G.candles[0].lit && G.kid.blowing === -1);
});

// ---------------- 3. doors
test('D1 use toggles the door in reach; a nearer wardrobe hides you instead; by a lit candle use does nothing', () => {
  let G = game(); place(G, 'kid', 11, 10.5);
  let ev = run(G, 0.05, { use: true });
  assert.equal(G.doors[3].open, false); assert.ok(has(ev, 'door', (e) => e.id === 3 && e.by === 'kid'));
  G = game(); place(G, 'kid', 12.5, 17.4);
  run(G, 0.05, { use: true });
  assert.equal(G.kid.hidden, 2);
  G = game(); place(G, 'kid', beside0.x, beside0.z);
  ev = run(G, 0.05, { use: true });
  assert.ok(!has(ev, 'door') && !has(ev, 'useNothing') && G.kid.hidden === -1);
});
test('D2 a door opening or shutting is heard 6 m off', () => {
  const G = game(); place(G, 'kid', 11, 10.5); wake(G, 11, 13.5, 0, -1);
  run(G, 0.05, { use: true });
  assert.ok(G.sense.heard.some((h) => h.kind === 'door'));
});
test('D3 a door will not shut on a toy in the doorway', () => {
  const G = game(); place(G, 'kid', 11, 10.5); Object.assign(G.items[0], { x: 11, z: 11.5 });
  const ev = run(G, 0.05, { use: true });
  assert.equal(G.doors[3].open, true); assert.ok(has(ev, 'shutRefused'));
});
test('D4 a shut door blocks the kid', () => {
  const G = game(); place(G, 'kid', 12.5, 9.5);
  run(G, 1, { mx: 1 });
  assert.ok(G.kid.x <= 13 - KID.radius + 1e-6);
});
test('D5 the monster opens a shut door in 0.6 s, smashes one in 0.9 s', () => {
  let G = game(); wake(G, 12.2, 10.0);
  run(G, MON.doorOpen - 0.05, {}, { mx: 1, use: true }); assert.equal(G.doors[2].open, false);
  run(G, 0.1); assert.equal(G.doors[2].open, true);
  G = game(); wake(G, 12.2, 10.0);
  run(G, MON.doorBash - 0.05, {}, { mx: 1, bash: true }); assert.equal(G.doors[2].open, false);
  const ev = run(G, 0.1); assert.ok(G.doors[2].open && has(ev, 'door', (e) => e.bash));
});

// ---------------- 4. wardrobes
test('W1 hiding: in a wardrobe the kid cannot be seen', () => {
  const G = game(); place(G, 'kid', 4.5, 5.5); wake(G, 4.5, 7.5, 0, -1);
  assert.ok(canSee(G));
  run(G, 0.05, { use: true });
  assert.equal(G.kid.hidden, 0); assert.ok(!canSee(G));
});
test('W2 coming out: use, or push the stick once let go; refused with the monster outside', () => {
  let G = game(); place(G, 'kid', 4.5, 5.5);
  run(G, 0.05, { use: true });
  run(G, 0.3, { mx: 1 }); assert.equal(G.kid.hidden, 0, 'a held stick does not count');
  run(G, 0.3, {}); run(G, 0.2, { mx: 1 }); assert.equal(G.kid.hidden, -1);
  G = game(); place(G, 'kid', 4.5, 5.5); run(G, 0.05, { use: true });
  wake(G, 4.5, 6.6, 0, -1);
  const ev = run(G, 0.05, { use: true });
  assert.equal(G.kid.hidden, 0); assert.ok(has(ev, 'unhideRefused'));
});
test('W3 seen getting in: it goes straight to that wardrobe', () => {
  const G = game(); place(G, 'kid', 32.5, 9.5); wake(G, 29.5, 9.3); const m = classic(G);
  for (let i = 0; i < 3; i++) step(G, { mx: 0, mz: 0 }, DT);
  assert.ok(G.monster.sees);
  step(G, { mx: 0, mz: 0, use: true }, DT);
  assert.equal(G.kid.hidden, 1);
  step(G, { mx: 0, mz: 0 }, DT);
  assert.equal(m.mode, 'check'); assert.equal(m.checkW, 1);
});
test('W4 looking inside takes 0.7 s: the kid inside is caught, else it is empty', () => {
  let G = game(); place(G, 'kid', 4.5, 5.5, { hidden: 0 }); wake(G, 4.5, 6.1, 0, -1);
  let ev = run(G, MON.checkOpen + 0.05, {}, { use: true });
  assert.ok(has(ev, 'caught', (e) => e.by === 'found'));
  G = game(); wake(G, 4.5, 6.1, 0, -1);
  ev = run(G, MON.checkOpen + 0.05, {}, { use: true });
  assert.ok(has(ev, 'checkEmpty') && G.state === 'play');
});
test('W5 losing you near a wardrobe, it looks inside', () => {
  const G = game(); wake(G, 6.5, 6.5); const m = classic(G);
  m.mode = 'chase'; m.lastSeen = { x: 4.6, z: 6.0, vx: 0, vz: 0 }; m.lostT = 3;
  think(G, m, blankObs(G), 0.05);
  assert.equal(m.mode, 'check'); assert.equal(m.checkW, 0);
});

// ---------------- 5. noise and things on the floor
test('N1 hearing: within range in sight, 0.65 of it through walls', () => {
  const heard = (r, nx, nz) => { const G = game(); wake(G, 5.5, 20.5); makeNoise(G, nx, nz, r, 'test'); run(G, DT); return G.sense.heard.some((h) => h.kind === 'test'); };
  assert.ok(heard(10, 14.5, 20.5)); assert.ok(!heard(8, 14.5, 20.5));
  assert.ok(!heard(4, 5.5, 17.5), 'through the wall 3 m away, a 4 m noise is too faint'); assert.ok(heard(5, 5.5, 17.5));
});
test('N2 a creaky board creaks under a walking foot, not a creeping one', () => {
  let G = game(); place(G, 'kid', 8.5, 21.5);
  assert.ok(has(run(G, 1, { mx: 1 }), 'creak'));
  G = game(); place(G, 'kid', 8.5, 21.5);
  assert.ok(!has(run(G, 1.5, { mx: 1, creep: true }), 'creak'));
});
test('N3 a squeaky toy squeaks and skids, then rests 1.5 s', () => {
  const G = game(); place(G, 'kid', 2, 15.5);
  const z0 = G.squeaks[3].z, ev = run(G, 1, { mz: -1 });
  assert.ok(has(ev, 'squeak', (e) => e.id === 3)); assert.ok(G.squeaks[3].z < z0);
});
test('N4 walking over a toy picks it up; thrown, it flies up to 7.5 m and lands with a clatter', () => {
  const G = game(); place(G, 'kid', 17.5, 20.6);
  let ev = run(G, 0.5, { mx: 1 });
  assert.ok(has(ev, 'pickup', (e) => e.id === 6)); assert.equal(G.kid.held, 6);
  place(G, 'kid', 5.5, 20.5, { fx: 1, fz: 0 });
  ev = run(G, 1.2, { throw: true });
  const land = ev.find((e) => e.type === 'land');
  assert.ok(land && near(land.x, 5.5 + KID.throwRange, 0.2), JSON.stringify(land));
});
test('N5 no throwing into the wall in front of you, or from a vent', () => {
  let G = game(); place(G, 'kid', 1.4, 20.5, { fx: -1, fz: 0, held: 0 }); G.items[0].held = true;
  assert.ok(has(run(G, 0.05, { throw: true }), 'throwRefused'));
  G = game(); place(G, 'kid', 15.5, 1.5, { held: 0 }); G.items[0].held = true; run(G, 0.1, { mx: 1 });
  assert.ok(has(run(G, 0.05, { throw: true }), 'throwRefused')); assert.equal(G.kid.held, 0);
});

// ---------------- 6. what the monster senses
test('S1 sight: 8 m in the dark, 13 m in light, 1.4 m under a table', () => {
  const G = game(); wake(G, 5.5, 20.5);
  place(G, 'kid', 12.5, 20.5); assert.ok(canSee(G));
  place(G, 'kid', 14.5, 20.5); assert.ok(!canSee(G));
  Object.assign(G.beam, { state: 'on', x: 17.5, z: 20.5 }); place(G, 'kid', 17.5, 20.5); assert.ok(canSee(G), 'lit by the searchlight');
  G.beam.state = 'idle';
  place(G, 'kid', 18.5, 15.5); wake(G, 18.5, 13.9, 0, 1); assert.ok(!canSee(G));
  wake(G, 18.5, 14.2, 0, 1); assert.ok(canSee(G));
});
test('S2 its fuzzy sense of you lands within 3 m', () => {
  const G = game(); wake(G, 30.5, 20.5); place(G, 'kid', 18.5, 13.5);
  G.sense.pingT = 0.001; run(G, DT);
  assert.ok(G.sense.ping && Math.hypot(G.sense.ping.x - 18.5, G.sense.ping.z - 13.5) <= MON.pingErr + 1e-9);
});
test('S3 the searchlight catching you tells it exactly where', () => {
  const G = game(); place(G, 'kid', 5.5, 20.5);
  Object.assign(G.beam, { state: 'on', t: 0, x: 5.5, z: 20.5 });
  run(G, DT);
  assert.ok(G.sense.alertsSeen.some((a) => a.kind === 'beam' && near(a.x, 5.5, 0.01)));
});
test('S4 a lead inside a wall is moved to the nearest floor', () => {
  const G = game(); wake(G, 30.5, 20.5); const m = classic(G);
  think(G, m, { ...blankObs(G), alerts: [{ x: 13.5, z: 7.5, kind: 'candle' }] }, 0.05); // x 13 is the nursery's wall
  assert.equal(m.mode, 'hunt'); assert.ok(!L.monBlocked(tf(m.huntAt.x), tf(m.huntAt.z)));
});

// ---------------- 7. how the monster behaves (Classic)
test('B0 asleep for the first 1.5 s', () => {
  const G = game(); classic(G);
  for (let t = 0; t < 1.4; t += DT) step(G, { mx: 0, mz: 0 }, DT);
  assert.ok(!G.monster.awake);
  for (let t = 0; t < 0.3; t += DT) step(G, { mx: 0, mz: 0 }, DT);
  assert.ok(G.monster.awake);
});
test('B1 seeing you, it chases', () => {
  const G = game(); place(G, 'kid', 15.5, 20.5); wake(G, 9.5, 20.5); const m = classic(G);
  for (let i = 0; i < 10; i++) step(G, { mx: 0, mz: 0 }, DT);
  assert.equal(m.mode, 'chase');
});
test('B2 close and facing you, it crouches and lunges', () => {
  const G = game(); place(G, 'kid', 11.3, 20.5); wake(G, 9.5, 20.5); classic(G);
  const ev = []; for (let i = 0; i < 20; i++) { step(G, { mx: 0, mz: 0 }, DT); ev.push(...G.events); G.events.length = 0; }
  assert.ok(has(ev, 'windup'));
});
test('B3 bloodlust: 6 / 10 / 15 s of seeing you in a chase adds 0.15 / 0.30 / 0.45 m/s', () => {
  for (const [t, lust] of [[5.9, 0], [6.1, 0.15], [10.1, 0.3], [15.1, 0.45]]) {
    const G = game(); wake(G, 5.5, 20.5); G.sense.sightT = t;
    stepBody(G, IDLE_GI, DT);
    assert.ok(near(G.monster.lust, lust), `${t} s -> ${G.monster.lust}`);
  }
});
test('B4 losing you in the open, it searches where you were heading', () => {
  const G = game(); wake(G, 20.5, 20.5); const m = classic(G);
  m.mode = 'chase'; m.lastSeen = { x: 20.6, z: 20.5, vx: 1, vz: 0 }; m.lostT = 0;
  think(G, m, blankObs(G), 0.05);
  assert.equal(m.mode, 'search');
});
test('B5 the same gap three times in a chase: it waits at the far exit', () => {
  const G = game(); wake(G, 30.5, 20.5); const m = classic(G); m.mode = 'chase';
  const p = L.passages[8], at = { x: p.exits[0][0] + 0.5, z: p.exits[0][1] + 0.5, vx: 0, vz: 0 };
  for (let n = 0; n < 3; n++) {
    think(G, m, { ...blankObs(G), sees: true, kid: at }, 0.05);
    think(G, m, { ...blankObs(G), gapSeen: p.id }, 0.05);
  }
  assert.equal(m.mode, 'ambush');
});
test('B6 you under the edge of a table: it comes up to it and reaches in', () => {
  const G = game(); place(G, 'kid', 18.5, 15.5); wake(G, 18.5, 14.2, 0, 1); classic(G);
  for (let t = 0; t < 2.6 && G.state === 'play'; t += DT) step(G, { mx: 0, mz: 0 }, DT);
  assert.equal(G.state, 'caught'); assert.ok(G.monster.z < 15 - MON.radius + 0.01);
});
test('B7 after 25 s of close pressure it backs off for a breather', () => {
  const G = game(); place(G, 'kid', 12.5, 20.5); wake(G, 9.5, 20.5); const m = classic(G);
  run(G, DT); // it sees you
  m.mode = 'chase'; m.lastSeen = { x: 12.5, z: 20.5, vx: 0, vz: 0 }; m.menace = MON.menaceMax + 0.01;
  think(G, m, observe(G), 0.05);
  assert.equal(m.mode, 'breather');
});
test('B8 a noise sends it to look', () => {
  const G = game(); wake(G, 30.5, 20.5); const m = classic(G);
  think(G, m, { ...blankObs(G), heard: [{ x: 20.5, z: 20.5, kind: 'creak' }] }, 0.05);
  assert.equal(m.mode, 'hunt'); assert.ok(near(m.huntAt.x, 20.5));
});
test('B9 arriving at the lead with nothing there, it searches round it', () => {
  const G = game(); wake(G, 20.5, 20.5); const m = classic(G);
  m.mode = 'hunt'; m.huntAt = { x: 20.6, z: 20.5 };
  think(G, m, blankObs(G), 0.05);
  assert.equal(m.mode, 'search'); assert.equal(m.searchLeft, 3);
});
test('B10 patrolling, it picks somewhere to go', () => {
  const G = game(); wake(G, 20.5, 20.5); const m = classic(G);
  think(G, m, blankObs(G), 0.05);
  assert.ok(m.spot && !L.monBlocked(tf(m.spot.x), tf(m.spot.z)));
});
test('B11 stuck pushing into a corner: a shove', () => {
  const G = game(); wake(G, 1.6, 20.5, -1, 0);
  let shoved = false; run(G, 1.5, {}, (i) => { shoved ||= G.monster.shoved; return { mx: -1 }; });
  assert.ok(shoved);
});
test('B12 rage adds 0.25 m/s to its run', () => {
  const G = game(); wake(G, 5.5, 20.5); G.monster.rage = 5;
  run(G, 1.5, {}, { mx: 1, run: true });
  assert.ok(G.monster.speed > MON.chase + 0.15 && G.monster.speed <= MON.chase + MON.rageBoost + 1e-6);
});

// ---------------- 8. getting caught
test('X1 a touch within 0.93 m in sight catches; under a table it reaches 1.1 m in', () => {
  let G = game(); place(G, 'kid', 10.5, 20.5); wake(G, 9.6, 20.5); run(G, DT); assert.equal(G.state, 'caught');
  G = game(); place(G, 'kid', 10.5, 20.5); wake(G, 9.5, 20.5); run(G, DT); assert.equal(G.state, 'play');
  G = game(); place(G, 'kid', 18.5, 15.5); wake(G, 18.5, 14.6, 0, 1); run(G, 1, {}, { mz: 1 }); assert.equal(G.state, 'caught');
  G = game(); place(G, 'kid', 18.5, 16.0); wake(G, 18.5, 14.6, 0, 1); run(G, 1, {}, { mz: 1 }); assert.equal(G.state, 'play'); // the middle of a big table is out of its reach
});
test('X2 found in a wardrobe', () => {
  const G = game(); place(G, 'kid', 32.5, 9.5, { hidden: 1 }); wake(G, 32.5, 8.9, 0, 1);
  run(G, MON.checkOpen + 0.05, {}, { use: true });
  assert.equal(G.state, 'caught');
});
test("X3 it can't get into your crack, but it reaches in", () => {
  const G = game(); place(G, 'kid', 13.5, 5.5); wake(G, 12.3, 5.5);
  run(G, 2, {}, { mx: 1 });
  assert.equal(G.state, 'caught'); assert.ok(G.monster.x < 13 - MON.radius + 0.01);
});
test('X4 it squeezes into the vent duct after you: slowly, no lunge, it sees along the duct and catches you there', () => {
  let G = game(); place(G, 'kid', 17.5, 1.5); wake(G, 12.5, 1.5);
  let top = 0; run(G, 3, {}, { mx: 1, run: true }); // into the duct at (14, 1)
  for (let i = 0; i < 20; i++) { run(G, 0.05, {}, { mx: 1, run: true }); top = Math.max(top, G.monster.speed); }
  assert.ok(L.duct(Math.floor(G.monster.x), Math.floor(G.monster.z)), `it got in (${G.monster.x.toFixed(2)})`);
  assert.ok(top <= VENT.monCrawl + 1e-6, `crawls at ${top.toFixed(2)}`);
  assert.ok(G.monster.sees, 'it sees you along the duct');
  G = game(); place(G, 'kid', 17.5, 1.5); wake(G, 15.5, 1.5); run(G, 0.2, {}, { lunge: true }); assert.equal(G.monster.act, 'none'); // no room to lunge
  run(G, 2, {}, { mx: 1 }); assert.equal(G.state, 'caught');
  G = game(); place(G, 'kid', 17.5, 1.5); wake(G, 12.5, 1.5); run(G, 0.1); assert.ok(!G.monster.sees, 'from outside a duct is dark');
});

// ---------------- 9. the searchlight
test('L1 the light is not available before 45 s', () => {
  const G = game();
  run(G, 0.1, {}, { light: true, ax: 10, az: 10 }); assert.equal(G.beam.state, 'idle');
  G.beam.cool = 0; run(G, DT, {}, { light: true, ax: 10, az: 10 }); assert.equal(G.beam.state, 'warn');
});
test('L2 it warns for 1.6 s, then shines 4.5 s, drifting 0.8 m/s where the right stick pushes', () => {
  const G = game(); G.beam.cool = 0; place(G, 'kid', 18.5, 15.5);
  run(G, DT, {}, { light: true, ax: 10, az: 10 });
  run(G, BEAM.warn + 0.05); assert.equal(G.beam.state, 'on');
  const x0 = G.beam.x, z0 = G.beam.z;
  run(G, 1, {}, { lx: 1, lz: 0 });
  assert.ok(near(Math.hypot(G.beam.x - x0, G.beam.z - z0), BEAM.drift, 0.05), 'drifts at 0.8 m/s');
  run(G, 2.5, {}, { lx: 1, lz: 0 });
  assert.ok(G.beam.dx > 0.5, 'turned the way the stick pushes');
  run(G, BEAM.on); assert.equal(G.beam.state, 'idle');
});
test('L3 caught in the open by the light it is told where you are; under a table you are safe', () => {
  let G = game(); place(G, 'kid', 5.5, 20.5); Object.assign(G.beam, { state: 'on', t: 0, x: 6.5, z: 20.5 });
  assert.ok(has(run(G, DT), 'beamSpot'));
  G = game(); place(G, 'kid', 18.5, 15.5); Object.assign(G.beam, { state: 'on', t: 0, x: 18.5, z: 15.5 });
  assert.ok(!has(run(G, 0.5), 'beamSpot'));
});

// ---------------- 10. the hand
test('H1 the hand arms when two candles are out, 35 s later', () => {
  const G = game(); run(G, DT); assert.equal(G.reach.cool, -1);
  G.candles[0].lit = false; G.candles[1].lit = false; run(G, DT);
  assert.ok(near(G.reach.cool, REACH.first - DT, 1e-6));
});
test('H2 shadow 2.2 s, down 0.35 s, the grab, hold 0.9 s, up 1 s', () => {
  const G = game(); G.candles[0].lit = false; G.candles[1].lit = false; G.reach.cool = 0; place(G, 'kid', 30.5, 20.5);
  run(G, DT, {}, { reach: true, ax: 10, az: 20.5 }); assert.equal(G.reach.state, 'shadow');
  run(G, REACH.shadow + 0.02); assert.equal(G.reach.state, 'down');
  const ev = run(G, REACH.down + 0.02); assert.ok(has(ev, 'grab')); assert.equal(G.reach.state, 'hold');
  run(G, REACH.hold + 0.02); assert.equal(G.reach.state, 'up');
  run(G, REACH.up + 0.02); assert.equal(G.reach.state, 'idle');
});
test('H3 the hand takes you in the open, not under a table', () => {
  const grab = (x, z) => { const G = game(); G.candles[0].lit = false; G.candles[1].lit = false; G.reach.cool = 0; place(G, 'kid', x, z); run(G, DT, {}, { reach: true, ax: x, az: z }); run(G, REACH.shadow + REACH.down + 0.05); return G.state; };
  assert.equal(grab(5.5, 20.5), 'caught');
  assert.equal(grab(18.5, 15.5), 'play');
});

// ---------------- 12. the giant's controller and the personas
test('Z1 the world caps the stick: hunt speed, chase with run', () => {
  const G = game(); wake(G, 5.5, 20.5);
  run(G, 1.5, {}, { mx: 1 }); assert.ok(G.monster.speed <= MON.hunt + 1e-6);
  run(G, 1.5, {}, { mx: 1, run: true }); assert.ok(G.monster.speed <= MON.chase + 1e-6 && G.monster.speed > MON.hunt);
});
test('Z2 a yell stops it 0.8 s, at most once every 6 s, and says why', () => {
  const G = game(); wake(G, 5.5, 20.5);
  const ev = run(G, 0.5, {}, { mx: 1, yell: true, why: 'doorInFace' });
  assert.ok(has(ev, 'yell', (e) => e.why === 'doorInFace')); assert.equal(G.monster.act, 'yell');
  run(G, 0.4); assert.ok(!has(run(G, 0.1, {}, { yell: true }), 'yell'));
});
test('Z3 fury: a persona with anger and frustration high rampages, then is spent', () => {
  const G = game(); wake(G, 20.5, 20.5);
  G.mind = createMind(G, { type: 'brute' }, 1); G.mind.anger = 0.9; G.mind.frustration = 0.8;
  const ev = []; for (let t = 0; t < 7; t += DT) { step(G, { mx: 0, mz: 0 }, DT); ev.push(...G.events); G.events.length = 0; }
  assert.ok(has(ev, 'fury') && has(ev, 'spent') && has(ev, 'yell', (e) => e.why === 'fury'));
});
test('Z4 every change of plan is logged with its reason', () => {
  const G = game(); wake(G, 20.5, 20.5); G.mind = createMind(G, { type: 'stalker' }, 1);
  const ev = []; for (let t = 0; t < 3; t += DT) { step(G, { mx: 0, mz: 0 }, DT); ev.push(...G.events); G.events.length = 0; }
  const tactics = ev.filter((e) => e.type === 'tactic');
  assert.ok(tactics.length >= 1 && tactics.every((e) => e.name && e.why));
});
