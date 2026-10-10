// A random, valid mid-game moment to start an episode from: some candles already out, others half blown, the kid
// and the monster somewhere apart, doors flipped, toys scattered, the monster already in a mood. Late-game moments
// (the hand needs two candles out, the last candle) then show up in the data without playing every game through.
// Some starts are aimed at the rarer rules: the kid already in a wardrobe, at a wardrobe's door, by a door with a
// toy in the way, under the giant's hand, or one candle from winning.
import { distField } from '../grid.js';

const tf = Math.floor;
const VARIANTS = [['any', 0.3], ['hidden', 0.2], ['wardrobe', 0.2], ['door', 0.15], ['hand', 0.1], ['last', 0.05]];

function shuffle(a, rand) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function pick(list, rand) {
  let x = rand() * list.reduce((s, [, w]) => s + w, 0);
  for (const [k, w] of list) { x -= w; if (x <= 0) return k; }
  return list[0][0];
}
const inDoorway = (d, x, z, r) => x + r > d.x0 && x - r < d.x1 && z + r > d.z0 && z - r < d.z1;
// how many tiles the monster must walk to reach the kid's tile (or the tile beside it, if the kid is in a crawl space)
function pathTo(L, md, x, z) {
  let near = Infinity;
  for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) near = Math.min(near, md[(tf(z) + dz) * L.w + tf(x) + dx] ?? Infinity);
  return near;
}

export function randomStart(G, rand) {
  const L = G.L, k = G.kid, M = G.monster;
  const variant = pick(VARIANTS, rand);
  G.t = 60 + rand() * 140;
  // candles: 0-5 out (2-5 under the hand, 5 for the last), the rest untouched or partly blown
  const out = variant === 'last' ? 5 : variant === 'hand' ? 2 + Math.floor(rand() * 4) : Math.floor(rand() * 6);
  shuffle([...G.candles], rand).forEach((c, i) => {
    if (i < out) { c.lit = false; c.progress = 1 + 1 / 90; c.outAt = G.t - rand() * 50; }
    else c.progress = rand() < 0.5 ? 0 : rand() * 0.8;
  });
  const kidTiles = [], floor = [];
  for (let z = 0; z < L.h; z++) for (let x = 0; x < L.w; x++) {
    if (!L.kidBlocked(x, z) && L.doorAt(x, z) < 0) kidTiles.push([x, z]);
    if (!L.monBlocked(x, z) && L.doorAt(x, z) < 0) floor.push([x, z]);
  }
  // where the kid starts, by variant
  const spot = () => {
    if (variant === 'hidden' || variant === 'wardrobe') { const w = G.wardrobes[Math.floor(rand() * G.wardrobes.length)]; return [w.fx, w.fz, w]; }
    if (variant === 'door') {
      const d = G.doors[Math.floor(rand() * G.doors.length)], side = rand() < 0.5 ? -1 : 1;
      return d.axis === 'x' ? [d.x, d.z + side * 1.1, null, d] : [d.x + side * 1.1, d.z, null, d];
    }
    if (variant === 'last') {
      const c = G.candles.find((q) => q.lit), near = kidTiles.filter(([x, z]) => Math.hypot(x + 0.5 - c.x, z + 0.5 - c.z) < 3.5);
      const [x, z] = near[Math.floor(rand() * near.length)];
      return [x + 0.5, z + 0.5];
    }
    const [x, z] = kidTiles[Math.floor(rand() * kidTiles.length)];
    return [x + 0.5, z + 0.5];
  };
  let w = null, door = null;
  for (let tries = 0; ; tries++) {
    const [kx, kz, ww, dd] = spot();
    if (L.kidBlocked(tf(kx), tf(kz))) continue;
    const [mx, mz] = floor[Math.floor(rand() * floor.length)];
    const md = distField(L, mx, mz, L.monBlocked);
    if (pathTo(L, md, kx, kz) < 8) continue;
    Object.assign(k, { x: kx, z: kz, vx: 0, vz: 0, tile: -1 });
    Object.assign(M, { x: mx + 0.5, z: mz + 0.5, vx: 0, vz: 0, awake: true });
    w = ww; door = dd;
    break;
  }
  const a = rand() * Math.PI * 2;
  M.hx = Math.cos(a); M.hz = Math.sin(a);
  // toys on open floor; sometimes one is in the kid's hands; at a door, sometimes one lies in the doorway
  for (const it of G.items) {
    const [x, z] = floor[Math.floor(rand() * floor.length)];
    Object.assign(it, { x: x + 0.3 + rand() * 0.4, z: z + 0.3 + rand() * 0.4, held: false, fly: null });
  }
  k.held = -1;
  if (rand() < 0.3) { const it = G.items[Math.floor(rand() * G.items.length)]; it.held = true; it.x = k.x; it.z = k.z; k.held = it.id; }
  if (door && rand() < 0.4) { const it = G.items.find((q) => !q.held); Object.assign(it, { x: door.x + (rand() - 0.5) * 0.4, z: door.z + (rand() - 0.5) * 0.4 }); }
  if (variant === 'hidden') {
    Object.assign(k, { hidden: w.id, hiddenAt: G.t - 1, stickFree: true });
    if (k.held >= 0) Object.assign(G.items[k.held], { x: k.x, z: k.z });
  }
  // a few doors the other way (never shut on anyone or anything); the start door is open, to shut
  for (const d of G.doors) {
    if (d === door) { d.open = true; continue; }
    if (rand() >= 0.3) continue;
    if (d.open && (inDoorway(d, k.x, k.z, 0.5) || inDoorway(d, M.x, M.z, 0.6) || G.items.some((i) => !i.held && inDoorway(d, i.x, i.z, 0.1)) || G.squeaks.some((s) => inDoorway(d, s.x, s.z, 0.1)))) continue;
    d.open = !d.open;
  }
  // the giant's tools part-way through their cooldowns (under the hand: ready now)
  G.beam.cool = rand() * 30;
  G.reach.cool = G.candles.filter((c) => !c.lit).length >= 2 ? (variant === 'hand' ? 0 : rand() * 40) : -1;
  // the monster already has a mood and a rough sense of you (under the hand: frustrated)
  const m = G.mind;
  if (m) {
    m.anger = rand() * 0.6; m.frustration = variant === 'hand' ? 0.6 + rand() * 0.3 : rand() * 0.6; m.confidence = rand() * 0.6;
    m.mode = 'patrol';
    if (variant === 'hand' && m.nextReach !== undefined) m.nextReach = G.t; // Classic keeps its own schedule
  }
  const e = rand() * 3, b = rand() * Math.PI * 2;
  G.sense.ping = { x: k.x + Math.cos(b) * e, z: k.z + Math.sin(b) * e };
  G.sense.wake = true;
}
