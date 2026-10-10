// The whole game, with no graphics: a kid, six candles and a monster on a tile grid.
// Runs the same in the browser and in Node, so bots can play it later.
import { KID, MON } from './rules.js';
import { T } from './level.js';
import { resolve, los } from './grid.js';
import { createMonster, stepMonster } from './monster.js';

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createGame(L, seed = 1) {
  const G = {
    L, seed, t: 0, rand: rng(seed), state: 'play', events: [],
    kid: { x: L.kid.x, z: L.kid.z, vx: 0, vz: 0, fx: 0, fz: -1, speed: 0, crawl: false, running: false, noise: 0, blow: 0, blowing: -1, stride: 0 },
    candles: L.candles.map((c) => ({ ...c, lit: true, progress: 0, outAt: -1 })),
  };
  G.monster = createMonster(G);
  return G;
}

// input: { mx, mz } a direction (length <= 1), creep and blow are booleans
export function step(G, input, dt) {
  if (G.state !== 'play') return;
  G.t += dt;
  stepKid(G, input, dt);
  stepMonster(G, dt);
  checkCatch(G);
}

function nearCandle(G) {
  const k = G.kid;
  let best = null, bd = KID.blowReach;
  for (const c of G.candles) {
    if (!c.lit) continue;
    const d = Math.hypot(c.x - k.x, c.z - k.z);
    if (d < bd && los(G.L, k.x, k.z, c.x, c.z)) { bd = d; best = c; }
  }
  return best;
}

function stepKid(G, input, dt) {
  const k = G.kid, L = G.L;
  let mx = input.mx || 0, mz = input.mz || 0;
  const m = Math.hypot(mx, mz);
  if (m > 1) { mx /= m; mz /= m; }

  const c = input.blow ? nearCandle(G) : null;
  if (c) {
    if (k.blowing !== c.id) G.events.push({ type: 'blowStart', id: c.id });
    k.blowing = c.id; mx = 0; mz = 0;
    c.progress += dt / KID.blowTime;
    k.fx = c.x - k.x; k.fz = c.z - k.z;
    const n = Math.hypot(k.fx, k.fz) || 1; k.fx /= n; k.fz /= n;
    if (c.progress >= 1) {
      c.lit = false; c.outAt = G.t; k.blowing = -1;
      G.events.push({ type: 'candleOut', id: c.id, x: c.x, z: c.z });
      G.monster.alert = { x: c.x, z: c.z };
      if (G.candles.every((q) => !q.lit)) { G.state = 'won'; G.events.push({ type: 'won' }); }
    }
  } else if (k.blowing >= 0) { G.events.push({ type: 'blowStop' }); k.blowing = -1; }

  k.crawl = L.crawl(Math.floor(k.x), Math.floor(k.z));
  const speed = k.crawl ? (input.creep ? KID.crawlCreep : KID.crawl) : input.creep ? KID.creep : KID.run;
  const a = KID.accel * dt, wx = mx * speed, wz = mz * speed;
  const dvx = wx - k.vx, dvz = wz - k.vz, dv = Math.hypot(dvx, dvz);
  if (dv > a) { k.vx += (dvx / dv) * a; k.vz += (dvz / dv) * a; } else { k.vx = wx; k.vz = wz; }
  const ox = k.x, oz = k.z;
  k.x += k.vx * dt; k.z += k.vz * dt;
  resolve(L, k, KID.radius, L.kidBlocked);
  k.vx = (k.x - ox) / dt; k.vz = (k.z - oz) / dt;
  k.speed = Math.hypot(k.vx, k.vz);
  if (k.speed > 0.1 && k.blowing < 0) { k.fx = k.vx / k.speed; k.fz = k.vz / k.speed; }

  const inDuct = L.at(Math.floor(k.x), Math.floor(k.z)) === T.DUCT;
  k.running = !k.crawl && !input.creep && k.speed > 2;
  k.noise = k.running ? KID.noiseRun : inDuct && k.speed > 0.5 && !input.creep ? KID.noiseCrawl : 0;
  if (k.blowing >= 0) k.noise = Math.max(k.noise, KID.noiseBlow);

  k.stride += k.speed * dt;
  if (k.stride > (k.running ? 0.62 : 0.45)) {
    k.stride = 0;
    G.events.push({ type: 'kstep', run: k.running, crawl: k.crawl, duct: inDuct });
  }
}

function checkCatch(G) {
  const k = G.kid, M = G.monster, L = G.L;
  const d = Math.hypot(k.x - M.x, k.z - M.z);
  if (d > MON.reach + MON.radius * 0.5 || M.mode === 'sleep') return;
  const under = L.at(Math.floor(k.x), Math.floor(k.z));
  if (under === T.DUCT || under === T.CRACK) return; // it can't reach into the walls
  if ((under === T.TABLE || under === T.BED) && d > 0.6) return;
  if (!los(L, M.x, M.z, k.x, k.z)) return;
  G.state = 'caught';
  G.events.push({ type: 'caught' });
}
