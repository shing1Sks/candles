// A random, valid mid-game moment to start an episode from: some candles already out, others half blown, the kid
// and the monster somewhere apart, doors flipped, toys scattered, the monster already in a mood. Late-game moments
// (the hand needs two candles out, the last candle) then show up in the data without playing every game through.
import { distField } from '../grid.js';
import { T } from '../level.js';

const tf = Math.floor;

function shuffle(a, rand) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const inDoorway = (d, x, z, r) => x + r > d.x0 && x - r < d.x1 && z + r > d.z0 && z - r < d.z1;

export function randomStart(G, rand) {
  const L = G.L, k = G.kid, M = G.monster;
  G.t = 60 + rand() * 140;
  // candles: 0-5 out, the rest untouched or partly blown
  const out = Math.floor(rand() * 6);
  shuffle([...G.candles], rand).forEach((c, i) => {
    if (i < out) { c.lit = false; c.progress = 1 + 1 / 90; c.outAt = G.t - rand() * 50; }
    else c.progress = rand() < 0.5 ? 0 : rand() * 0.8;
  });
  // the kid on any tile it can stand on (a crawl space too); the monster on the floor at least 8 tiles of path away
  const kidTiles = [], floor = [];
  for (let z = 0; z < L.h; z++) for (let x = 0; x < L.w; x++) {
    if (!L.kidBlocked(x, z) && L.doorAt(x, z) < 0) kidTiles.push([x, z]);
    if (!L.monBlocked(x, z) && L.doorAt(x, z) < 0) floor.push([x, z]);
  }
  for (;;) {
    const [kx, kz] = kidTiles[Math.floor(rand() * kidTiles.length)];
    const [mx, mz] = floor[Math.floor(rand() * floor.length)];
    const md = distField(L, mx, mz, L.monBlocked);
    let near = Infinity;
    for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) near = Math.min(near, md[(kz + dz) * L.w + kx + dx] ?? Infinity);
    if (near < 8 || !isFinite(near) && L.at(kx, kz) === T.FLOOR) continue;
    Object.assign(k, { x: kx + 0.5, z: kz + 0.5, vx: 0, vz: 0, tile: -1 });
    Object.assign(M, { x: mx + 0.5, z: mz + 0.5, vx: 0, vz: 0, awake: true });
    break;
  }
  const a = rand() * Math.PI * 2;
  M.hx = Math.cos(a); M.hz = Math.sin(a);
  // toys on open floor; sometimes one is in the kid's hands
  for (const it of G.items) {
    const [x, z] = floor[Math.floor(rand() * floor.length)];
    Object.assign(it, { x: x + 0.3 + rand() * 0.4, z: z + 0.3 + rand() * 0.4, held: false, fly: null });
  }
  k.held = -1;
  if (rand() < 0.3) { const it = G.items[Math.floor(rand() * G.items.length)]; it.held = true; it.x = k.x; it.z = k.z; k.held = it.id; }
  // a few doors the other way (never shut on anyone or anything)
  for (const d of G.doors) {
    if (rand() >= 0.3) continue;
    if (d.open && (inDoorway(d, k.x, k.z, 0.5) || inDoorway(d, M.x, M.z, 0.6) || G.items.some((i) => !i.held && inDoorway(d, i.x, i.z, 0.1)) || G.squeaks.some((s) => inDoorway(d, s.x, s.z, 0.1)))) continue;
    d.open = !d.open;
  }
  // the giant's tools part-way through their cooldowns
  G.beam.cool = rand() * 30;
  G.reach.cool = G.candles.filter((c) => !c.lit).length >= 2 ? rand() * 40 : -1;
  // the monster already has a mood and a rough sense of you
  const m = G.mind;
  if (m) { m.anger = rand() * 0.6; m.frustration = rand() * 0.6; m.confidence = rand() * 0.6; m.mode = 'patrol'; }
  const e = rand() * 3, b = rand() * Math.PI * 2;
  G.sense.ping = { x: k.x + Math.cos(b) * e, z: k.z + Math.sin(b) * e };
  G.sense.wake = true;
}
