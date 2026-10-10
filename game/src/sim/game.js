// The whole game, with no graphics: a kid, six candles and a monster on a tile grid, plus doors, wardrobes,
// creaky boards, squeaky toys, toys to throw, and the giant's searchlight and hand.
// The world takes two controllers: the kid's and the giant's (who plays the monster). It runs the same in the
// browser and in Node, so bots can play it and every game can be recorded.
import { KID, MON } from './rules.js';
import { T } from './level.js';
import { resolve, los } from './grid.js';
import { rng } from './rng.js';
import { createBody, stepBody } from './body.js';
import { createTools, stepTools } from './tools.js';
import { createSense, sense, observe, alert } from './senses.js';
import { think } from './mind/index.js';

export { rng };

// the giant's controller at rest
export const IDLE_GI = Object.freeze({ mx: 0, mz: 0, run: false, lunge: false, use: false, bash: false, yell: false, light: false, reach: false, ax: 0, az: 0, lx: 0, lz: 0, why: '' });

export function createGame(L, seed = 1) {
  const G = {
    L, seed, t: 0, rand: rng(seed), state: 'play', events: [], noises: [],
    kid: {
      x: L.kid.x, z: L.kid.z, vx: 0, vz: 0, fx: 0, fz: -1, speed: 0, crawl: false, running: false, noise: 0,
      blowing: -1, stride: 0, hidden: -1, hiddenAt: -99, held: -1, tile: -1, blowHeld: false,
    },
    candles: L.candles.map((c) => ({ ...c, lit: true, progress: 0, outAt: -1 })),
    doors: L.doors.map((d) => ({ ...d, changedAt: -99 })),
    wardrobes: L.wardrobes.map((w) => ({ ...w, openAt: -99 })),
    items: L.items.map((it, id) => ({ ...it, id, held: false, fly: null })),
    squeaks: L.squeaks.map((s, id) => ({ ...s, id, cool: 0 })),
    ...createTools(),
    sense: createSense(),
    mind: null, // the giant's mind (mind/index.js), set by whoever runs the game
  };
  // what blocks whom changes as doors open and shut
  const shut = (x, z) => { const id = L.doorAt(x, z); return id >= 0 && !G.doors[id].open; };
  G.kidBlocked = (x, z) => L.kidBlocked(x, z) || shut(x, z);
  G.monBlocked = (x, z) => L.monBlocked(x, z) || shut(x, z);
  G.sightBlocked = (x, z) => L.sightBlocked(x, z) || shut(x, z);
  G.los = (x0, z0, x1, z1) => los(L, x0, z0, x1, z1, G.sightBlocked);
  G.monster = createBody(L);
  return G;
}

// A sound the monster may hear: r is how far it carries in the open (through walls it carries less).
export function makeNoise(G, x, z, r, kind) {
  G.noises.push({ x, z, r, kind });
}

// One tick with the giant's mind (if the game has one) pressing the giant's buttons.
// input: { mx, mz } a direction (length <= 1); creep and blow are held; use and throw are presses
export function step(G, input, dt) {
  if (G.state !== 'play') return;
  const gi = G.mind ? think(G, G.mind, observe(G), dt) : IDLE_GI;
  stepWorld(G, input, gi, dt);
}

// One tick of the world: the kid's input ki and the giant's input gi (see body.js and tools.js).
export function stepWorld(G, ki, gi, dt) {
  if (G.state !== 'play') return;
  G.t += dt;
  const hid = G.kid.hidden;
  stepKid(G, ki, dt);
  if (G.state !== 'play') return;
  stepItems(G, dt);
  stepTools(G, gi, dt);
  if (G.state !== 'play') return;
  stepBody(G, gi, dt);
  if (G.state !== 'play') return;
  sense(G, dt, hid < 0 && G.kid.hidden >= 0 ? G.kid.hidden : -1);
  G.noises.length = 0;
  checkCatch(G);
}

function nearCandle(G) {
  const k = G.kid;
  let best = null, bd = KID.blowReach;
  for (const c of G.candles) {
    if (!c.lit) continue;
    const d = Math.hypot(c.x - k.x, c.z - k.z);
    if (d < bd && G.los(k.x, k.z, c.x, c.z)) { bd = d; best = c; }
  }
  return best;
}

function nearest(list, x, z, reach, key = (o) => o) {
  let best = null, bd = reach;
  for (const o of list) {
    const p = key(o), d = Math.hypot(p.x - x, p.z - z);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

// Is any circle of radius r at (x, z) over a door's tiles?
function inDoorway(d, x, z, r) {
  return x + r > d.x0 && x - r < d.x1 && z + r > d.z0 && z - r < d.z1;
}

export function setDoor(G, d, open, by, bash = false) {
  d.open = open; d.changedAt = G.t;
  G.events.push({ type: 'door', id: d.id, open, by, bash });
  makeNoise(G, d.x, d.z, bash ? KID.noiseDoor * 2 : KID.noiseDoor, 'door');
}

function use(G) {
  const k = G.kid, M = G.monster;
  if (k.hidden >= 0) { leaveWardrobe(G); return; }
  const w = nearest(G.wardrobes, k.x, k.z, 0.95, (o) => ({ x: o.fx, z: o.fz }));
  const d = nearest(G.doors, k.x, k.z, KID.useReach);
  if (w && (!d || Math.hypot(w.fx - k.x, w.fz - k.z) < Math.hypot(d.x - k.x, d.z - k.z))) {
    k.hidden = w.id; k.hiddenAt = G.t; k.vx = k.vz = 0; k.blowing = -1; k.stickFree = false;
    w.openAt = G.t;
    G.events.push({ type: 'hide', id: w.id });
    return;
  }
  if (!d) { G.events.push({ type: 'useNothing' }); return; }
  // you can't shut a door on yourself or on it
  if (d.open && (inDoorway(d, k.x, k.z, KID.radius) || inDoorway(d, M.x, M.z, MON.radius) ||
    G.items.some((i) => !i.held && inDoorway(d, i.x, i.z, 0.1)) || G.squeaks.some((s) => inDoorway(d, s.x, s.z, 0.1)))) {
    G.events.push({ type: 'shutRefused', id: d.id });
    return;
  }
  setDoor(G, d, !d.open, 'kid');
}

function leaveWardrobe(G) {
  const k = G.kid, w = G.wardrobes[k.hidden], M = G.monster;
  if (Math.hypot(M.x - w.fx, M.z - w.fz) < MON.reach + MON.radius + 0.3) { G.events.push({ type: 'unhideRefused', id: w.id }); return; } // it is right outside
  k.x = w.fx; k.z = w.fz; k.hidden = -1;
  w.openAt = G.t;
  G.events.push({ type: 'unhide', id: w.id });
}

function stepKid(G, input, dt) {
  const k = G.kid, L = G.L;
  if (input.use && (k.hidden >= 0 || !nearCandle(G))) use(G);
  if (k.hidden >= 0) {
    k.vx = k.vz = 0; k.speed = 0; k.noise = 0; k.running = false;
    // pushing the stick for a moment steps you back out
    const push = Math.hypot(input.mx || 0, input.mz || 0);
    if (push < 0.2) k.stickFree = true; // let go of the stick once before a push counts
    if (push > 0.5 && k.stickFree && G.t - k.hiddenAt > 0.4) leaveWardrobe(G);
    return;
  }
  let mx = input.mx || 0, mz = input.mz || 0;
  const m = Math.hypot(mx, mz);
  if (m > 1) { mx /= m; mz /= m; }

  const c = input.blow ? nearCandle(G) : null;
  if (input.blow && !k.blowHeld && !c) G.events.push({ type: 'blowNothing' });
  k.blowHeld = !!input.blow;
  if (c) {
    if (k.blowing !== c.id) G.events.push({ type: 'blowStart', id: c.id });
    k.blowing = c.id; mx = 0; mz = 0;
    c.progress += dt / KID.blowTime;
    k.fx = c.x - k.x; k.fz = c.z - k.z;
    const n = Math.hypot(k.fx, k.fz) || 1; k.fx /= n; k.fz /= n;
    if (c.progress >= 1) {
      c.lit = false; c.outAt = G.t; k.blowing = -1;
      G.events.push({ type: 'candleOut', id: c.id, x: c.x, z: c.z });
      alert(G, c.x, c.z, 'candle');
      G.monster.rage = MON.rage;
      G.events.push({ type: 'slam' }); // the giant thumps the table
      if (G.candles.every((q) => !q.lit)) { G.state = 'won'; G.events.push({ type: 'won' }); }
    }
  } else if (k.blowing >= 0) { G.events.push({ type: 'blowStop' }); k.blowing = -1; }

  const tx = Math.floor(k.x), tz = Math.floor(k.z);
  k.crawl = L.crawl(tx, tz);
  const speed = k.crawl ? (input.creep ? KID.crawlCreep : KID.crawl) : input.creep ? KID.creep : KID.run;
  const a = KID.accel * dt, wx = mx * speed, wz = mz * speed;
  const dvx = wx - k.vx, dvz = wz - k.vz, dv = Math.hypot(dvx, dvz);
  if (dv > a) { k.vx += (dvx / dv) * a; k.vz += (dvz / dv) * a; } else { k.vx = wx; k.vz = wz; }
  const ox = k.x, oz = k.z;
  k.x += k.vx * dt; k.z += k.vz * dt;
  resolve(L, k, KID.radius, G.kidBlocked);
  k.vx = (k.x - ox) / dt; k.vz = (k.z - oz) / dt;
  k.speed = Math.hypot(k.vx, k.vz);
  if (k.speed > 0.1 && k.blowing < 0) { k.fx = k.vx / k.speed; k.fz = k.vz / k.speed; }

  const inDuct = L.at(tx, tz) === T.DUCT;
  k.running = !k.crawl && !input.creep && k.speed > 2;
  k.noise = k.running ? KID.noiseRun : inDuct && k.speed > 0.5 && !input.creep ? KID.noiseCrawl : 0;
  if (k.blowing >= 0) k.noise = Math.max(k.noise, KID.noiseBlow);

  // a creaky board, unless you creep over it
  const tile = tz * L.w + tx;
  if (tile !== k.tile) {
    if (L.creaks.has(tile) && !input.creep && k.speed > 0.9) {
      G.events.push({ type: 'creak', x: tx + 0.5, z: tz + 0.5 });
      makeNoise(G, k.x, k.z, KID.noiseCreak, 'creak');
    }
    k.tile = tile;
  }
  // squeaky toys squeak and skid away from a careless foot
  for (const s of G.squeaks) {
    s.cool -= dt;
    if (s.cool > 0 || Math.hypot(s.x - k.x, s.z - k.z) > 0.42 || input.creep || k.speed < 0.6) continue;
    s.cool = 1.5;
    const nx = s.x + (k.vx / k.speed) * 0.6, nz = s.z + (k.vz / k.speed) * 0.6;
    if (!G.kidBlocked(Math.floor(nx), Math.floor(nz))) { s.x = nx; s.z = nz; }
    G.events.push({ type: 'squeak', id: s.id, x: s.x, z: s.z, kind: s.kind });
    makeNoise(G, s.x, s.z, KID.noiseSqueak, 'squeak');
  }
  // pick up a toy with empty hands; throw it where you face
  if (k.held < 0) {
    const it = nearest(G.items.filter((i) => !i.held && !i.fly), k.x, k.z, KID.pickReach);
    if (it) { it.held = true; k.held = it.id; G.events.push({ type: 'pickup', id: it.id, kind: it.kind }); }
  } else if (input.throw && (G.kidBlocked(Math.floor(k.x + k.fx * 0.45), Math.floor(k.z + k.fz * 0.45)) || G.sightBlocked(Math.floor(k.x + k.fx * 0.45), Math.floor(k.z + k.fz * 0.45)) || k.crawl)) {
    G.events.push({ type: 'throwRefused' }); // into the wall in front of you, or from a vent
  } else if (input.throw) {
    const it = G.items[k.held];
    it.held = false; it.x = k.x; it.z = k.z; k.held = -1;
    it.fly = { dx: k.fx, dz: k.fz, d: 0 };
    G.events.push({ type: 'throw', id: it.id });
  }

  k.stride += k.speed * dt;
  if (k.stride > (k.running ? 0.62 : 0.45)) {
    k.stride = 0;
    G.events.push({ type: 'kstep', run: k.running, crawl: k.crawl, duct: inDuct, room: L.room[tile] });
  }
}

// thrown toys fly until they hit something or run out of reach, then clatter
function stepItems(G, dt) {
  for (const it of G.items) {
    if (it.held) { it.x = G.kid.x; it.z = G.kid.z; continue; }
    if (!it.fly) continue;
    const s = KID.throwSpeed * dt, nx = it.x + it.fly.dx * s, nz = it.z + it.fly.dz * s;
    it.fly.d += s;
    const hit = G.kidBlocked(Math.floor(nx), Math.floor(nz)) || G.sightBlocked(Math.floor(nx), Math.floor(nz));
    if (!hit) { it.x = nx; it.z = nz; }
    if (hit || it.fly.d >= KID.throwRange) {
      it.fly = null;
      G.events.push({ type: 'land', id: it.id, x: it.x, z: it.z, kind: it.kind, wall: hit });
      makeNoise(G, it.x, it.z, KID.noiseLand, 'land');
    }
  }
}

function checkCatch(G) {
  const k = G.kid, M = G.monster, L = G.L;
  if (k.hidden >= 0 || !M.awake) return; // in a wardrobe only a look inside finds you
  const d = Math.hypot(k.x - M.x, k.z - M.z);
  if (d > MON.reach + MON.radius * 0.5) return;
  const under = L.at(Math.floor(k.x), Math.floor(k.z));
  if (under === T.DUCT || under === T.CRACK) return; // it can't reach into the walls
  if ((under === T.TABLE || under === T.BED) && d > 0.6) return;
  if (!G.los(M.x, M.z, k.x, k.z)) return;
  caught(G, 'touch');
}

// What the action buttons would do right now (for the on-screen prompt).
export function actionHint(G) {
  const k = G.kid;
  const out = [];
  if (k.hidden >= 0) return ['E  come out'];
  if (nearCandle(G)) out.push('hold E  blow it out');
  else {
    const w = nearest(G.wardrobes, k.x, k.z, 0.95, (o) => ({ x: o.fx, z: o.fz }));
    const d = nearest(G.doors, k.x, k.z, KID.useReach);
    if (w && (!d || Math.hypot(w.fx - k.x, w.fz - k.z) < Math.hypot(d.x - k.x, d.z - k.z))) out.push('E  hide');
    else if (d) out.push(d.open ? 'E  shut the door' : 'E  open the door');
  }
  if (k.held >= 0) out.push(`Q  throw the ${G.items[k.held].kind}`);
  return out;
}

// how: 'touch', 'found' (in a wardrobe) or 'grab' (the giant's hand)
export function caught(G, by = 'touch') {
  if (G.state !== 'play') return;
  G.state = 'caught';
  G.events.push({ type: 'caught', by });
}
