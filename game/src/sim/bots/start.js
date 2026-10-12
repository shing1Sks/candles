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
    if (L.monSpot(x, z) && L.doorAt(x, z) < 0) floor.push([x, z]);
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

// A crawl-space drill (data v5: crawl spaces are no longer safe, and kid bots seldom use them): after a random
// mid-game start, the kid in or just outside a crawl space (the vent duct half the time) and the monster 2-7 m away by
// its paths, having just seen it there: it comes in after you, or reaches in.
export function crawlStart(G, rand) {
  randomStart(G, rand);
  const L = G.L, k = G.kid, M = G.monster;
  const ducts = L.passages.filter((p) => L.at(p.tiles[0][0], p.tiles[0][1]) === 2), others = L.passages.filter((p) => !ducts.includes(p));
  for (let tries = 0; tries < 50; tries++) {
    const p = rand() < 0.5 && ducts.length ? ducts[Math.floor(rand() * ducts.length)] : others[Math.floor(rand() * others.length)];
    const [tx, tz] = rand() < 0.75 ? p.tiles[Math.floor(rand() * p.tiles.length)] : p.exits[Math.floor(rand() * p.exits.length)];
    const md = distField(L, tx, tz, (x, z) => L.monBlocked(x, z) && !(x === tx && z === tz));
    const near = [];
    for (let i = 0; i < md.length; i++) if (md[i] >= 2 && md[i] <= 7 && L.monSpot(i % L.w, Math.floor(i / L.w)) && L.doorAt(i % L.w, Math.floor(i / L.w)) < 0) near.push(i);
    if (!near.length) continue;
    const t = near[Math.floor(rand() * near.length)];
    Object.assign(k, { x: tx + 0.3 + rand() * 0.4, z: tz + 0.3 + rand() * 0.4, vx: 0, vz: 0, tile: -1, hidden: -1 });
    if (k.held >= 0) Object.assign(G.items[k.held], { x: k.x, z: k.z });
    Object.assign(M, { x: (t % L.w) + 0.5, z: Math.floor(t / L.w) + 0.5, vx: 0, vz: 0, awake: true });
    const dx = k.x - M.x, dz = k.z - M.z, d = Math.hypot(dx, dz) || 1;
    M.hx = dx / d; M.hz = dz / d;
    G.sense.lastSeen = { x: k.x, z: k.z, vx: 0, vz: 0 }; G.sense.lastSeenT = G.t - 0.3;
    const m = G.mind;
    if (m) {
      m.lastSeen = { x: k.x, z: k.z, vx: 0, vz: 0, t: G.t - 0.3 };
      m.beliefs = [{ x: k.x, z: k.z, spread: 0.5, conf: 1, w: 1, kind: 'sight', age: 0.3 }];
      m.mode = 'hunt';
    }
    return;
  }
}

// A giant's-tools drill (data v5: the searchlight and the hand are rare): a mid-game start with two or more candles
// out, both tools ready, the kid somewhere open and the monster far off with only a rough guess of where it is (the
// tools are for a kid it cannot see).
export function toolStart(G, rand) {
  randomStart(G, rand);
  const L = G.L, k = G.kid, M = G.monster;
  const lit = G.candles.filter((c) => c.lit);
  // blown out as a game would leave them (progress past 1: a candle out with no progress is a state no game has, and
  // taught a world model that every candle out need not be a win)
  for (let i = 0; i < lit.length && G.candles.filter((c) => !c.lit).length < 2; i++) Object.assign(lit[i], { lit: false, progress: 1.01, outAt: G.t - 20 });
  if (G.candles.every((c) => !c.lit)) Object.assign(G.candles[0], { lit: true, progress: 0 });
  k.hidden = -1;
  for (let tries = 0; tries < 50; tries++) {
    const x = 1 + Math.floor(rand() * (L.w - 2)), z = 1 + Math.floor(rand() * (L.h - 2));
    if (L.at(x, z) !== 0 || L.doorAt(x, z) >= 0) continue;
    if (Math.hypot(x + 0.5 - M.x, z + 0.5 - M.z) < 10) continue;
    Object.assign(k, { x: x + 0.5, z: z + 0.5, vx: 0, vz: 0, tile: -1 });
    if (k.held >= 0) Object.assign(G.items[k.held], { x: k.x, z: k.z });
    break;
  }
  G.beam.cool = 0; G.reach.cool = 0;
  const m = G.mind;
  if (m) {
    const e = 1 + rand() * 2, a = rand() * Math.PI * 2;
    m.beliefs = [{ x: k.x + Math.cos(a) * e, z: k.z + Math.sin(a) * e, spread: 2, conf: 1, w: 1, kind: 'ping', age: 1 }];
    m.frustration = 0.5 + rand() * 0.4;
  }
}
