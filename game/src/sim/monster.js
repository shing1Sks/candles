// The monster's brain. It plays like a person with a controller would: it guards the candles that are
// still lit, runs to every sound, cuts round to the far end of the vent you just crawled into, and lunges
// when it is close. It never sees through walls; it only gets a fuzzy sense of you every few seconds.
import { MON, KID } from './rules.js';
import { T } from './level.js';
import { resolve, los, clearLine, findPath, nearestOpen } from './grid.js';
import { lightAt } from './light.js';
import { CANDLE } from './rules.js';

const lustFor = (t) => MON.lust.reduce((v, [at, add]) => (t >= at ? add : v), 0);

export function createMonster(G) {
  const s = G.L.monster;
  return {
    x: s.x, z: s.z, vx: 0, vz: 0, hx: -1, hz: 0,
    mode: 'sleep', modeT: 0, goal: null, path: null, pathT: 0,
    sees: false, lastSeen: null, lastSeenT: -99, lostT: 0, chaseT: 0, lust: 0, cool: 0, lungeT: 0,
    pingT: MON.pingEvery[0] * 0.5, menace: 0, gapUses: {}, alert: null, linger: 0, searchLeft: 0, searchAt: null, ambushAt: null,
    stuckT: 0, stride: 0, speed: 0,
  };
}

const R = MON.radius;
const tileOf = (v) => Math.floor(v);

function setMode(G, M, mode) {
  if (M.mode === mode) return;
  M.mode = mode; M.modeT = 0; M.path = null; M.goal = null;
  G.events.push({ type: 'mode', mode });
}

// Head for (x, z): plan a path when the goal moves, then aim at the furthest point we can slide to.
function steer(G, M, x, z, speed, dt) {
  const L = G.L, blocked = L.monBlocked;
  if (clearLine(L, M.x, M.z, x, z, R, blocked)) { M.path = null; return aim(M, x, z, speed); }
  M.pathT -= dt;
  const moved = !M.goal || Math.hypot(M.goal.x - x, M.goal.z - z) > 0.8;
  if (!M.path || moved || M.pathT <= 0) {
    const g = nearestOpen(L, tileOf(x), tileOf(z), blocked), s = nearestOpen(L, tileOf(M.x), tileOf(M.z), blocked);
    M.path = g && s ? findPath(L, s[0], s[1], g[0], g[1], blocked) : null;
    M.goal = { x, z }; M.pathT = MON.repath;
    if (M.path && M.path.length) M.path[M.path.length - 1] = blocked(tileOf(x), tileOf(z)) ? M.path[M.path.length - 1] : { x, z };
  }
  if (!M.path || !M.path.length) return aim(M, x, z, speed * 0.3);
  while (M.path.length > 1 && clearLine(L, M.x, M.z, M.path[1].x, M.path[1].z, R, blocked)) M.path.shift();
  const p = M.path[0];
  if (M.path.length > 1 && Math.hypot(p.x - M.x, p.z - M.z) < 0.25) M.path.shift();
  return aim(M, M.path[0].x, M.path[0].z, speed);
}

function aim(M, x, z, speed) {
  const dx = x - M.x, dz = z - M.z, d = Math.hypot(dx, dz);
  if (d < 0.05) { M.wantX = 0; M.wantZ = 0; return d; }
  const s = Math.min(speed, d * 4);
  M.wantX = (dx / d) * s; M.wantZ = (dz / d) * s;
  return d;
}

function move(G, M, dt) {
  const a = MON.accel * dt;
  const dvx = M.wantX - M.vx, dvz = M.wantZ - M.vz, dv = Math.hypot(dvx, dvz);
  if (dv > a) { M.vx += (dvx / dv) * a; M.vz += (dvz / dv) * a; } else { M.vx = M.wantX; M.vz = M.wantZ; }
  const ox = M.x, oz = M.z;
  M.x += M.vx * dt; M.z += M.vz * dt;
  resolve(G.L, M, R, G.L.monBlocked);
  const mx = (M.x - ox) / dt, mz = (M.z - oz) / dt;
  M.speed = Math.hypot(mx, mz);
  if (M.speed > 0.2) {
    const k = Math.min(1, dt * 9), hx = M.hx + (mx / M.speed - M.hx) * k, hz = M.hz + (mz / M.speed - M.hz) * k, h = Math.hypot(hx, hz) || 1;
    M.hx = hx / h; M.hz = hz / h;
  }
  // stuck on a corner: drop the path and shuffle
  const want = Math.hypot(M.wantX, M.wantZ);
  M.stuckT = want > 0.5 && M.speed < want * 0.25 ? M.stuckT + dt : 0;
  if (M.stuckT > 0.6) { M.path = null; M.pathT = 0; M.vx += (G.rand() - 0.5) * 3; M.vz += (G.rand() - 0.5) * 3; M.stuckT = 0; }
  M.stride += M.speed * dt;
  const len = M.speed > 3 ? 1.25 : 0.95;
  if (M.stride > len) { M.stride = 0; G.events.push({ type: 'mstep', x: M.x, z: M.z, run: M.speed > 3 }); }
}

function canSee(G, M) {
  const k = G.kid, L = G.L, d = Math.hypot(k.x - M.x, k.z - M.z);
  if (L.sightBlocked(tileOf(k.x), tileOf(k.z))) return false; // in a vent or a crack
  const under = L.at(tileOf(k.x), tileOf(k.z));
  if ((under === T.TABLE || under === T.BED) && d > MON.hiddenSeen) return false;
  const range = lightAt(G, k.x, k.z) > CANDLE.litAt ? MON.sightLit : MON.sightDark;
  if (d > range) return false;
  const dot = ((k.x - M.x) * M.hx + (k.z - M.z) * M.hz) / (d || 1);
  if (dot < MON.fov && d > MON.sightClose) return false;
  return los(L, M.x, M.z, k.x, k.z);
}

// Pick a floor tile within r of (x, z) that we can walk to.
function randomSpot(G, x, z, r) {
  const L = G.L;
  for (let i = 0; i < 20; i++) {
    const tx = tileOf(x + (G.rand() * 2 - 1) * r), tz = tileOf(z + (G.rand() * 2 - 1) * r);
    if (!L.monBlocked(tx, tz) && los(L, x, z, tx + 0.5, tz + 0.5)) return { x: tx + 0.5, z: tz + 0.5 };
  }
  return { x, z };
}

// The kid vanished near a kid-only passage: go round to the end it will come out of.
function ambushSpot(G, M, at) {
  const L = G.L;
  const probe = [[at.x, at.z], [at.x + at.vx * 0.4, at.z + at.vz * 0.4], [at.x + at.vx * 0.8, at.z + at.vz * 0.8]];
  for (const [x, z] of probe) {
    const p = L.passageAt(tileOf(x), tileOf(z));
    if (p < 0) continue;
    const ex = L.passages[p].exits.map(([tx, tz]) => ({ x: tx + 0.5, z: tz + 0.5, d: Math.hypot(tx + 0.5 - M.x, tz + 0.5 - M.z) }));
    ex.sort((a, b) => b.d - a.d);
    // usually the far end; sometimes double back to the near one
    return G.rand() < 0.25 ? ex[ex.length - 1] : ex[0];
  }
  return null;
}

// Where to walk next with nothing to go on: often a lit candle, otherwise anywhere in the house
// (leaning toward the last thing it heard), so it never just camps the last candle.
const ROOM_SPOTS = [];
function pickGuard(G, M) {
  const lit = G.candles.filter((c) => c.lit);
  if (!lit.length) return null;
  if (G.rand() > 0.3 + 0.08 * lit.length) {
    if (!ROOM_SPOTS.length) for (let z = 1; z < G.L.h; z += 3) for (let x = 1; x < G.L.w; x += 3) if (!G.L.monBlocked(x, z)) ROOM_SPOTS.push({ x: x + 0.5, z: z + 0.5 });
    const h = M.lastHint;
    let best = null, bs = -Infinity;
    for (let i = 0; i < 6; i++) {
      const s = ROOM_SPOTS[Math.floor(G.rand() * ROOM_SPOTS.length)];
      const sc = (h ? -Math.hypot(s.x - h.x, s.z - h.z) * 0.3 : 0) + G.rand() * 3;
      if (sc > bs) { bs = sc; best = s; }
    }
    M.guardId = -1;
    return best;
  }
  const hint = M.lastHint;
  lit.sort((a, b) => score(b) - score(a));
  function score(c) {
    let s = G.rand() * 4;
    if (hint) s -= Math.hypot(c.x - hint.x, c.z - hint.z) * 0.35;
    if (c.id === M.guardId) s -= 6;
    return s;
  }
  const c = lit[0];
  M.guardId = c.id;
  return randomSpot(G, c.x, c.z, 2);
}

export function stepMonster(G, dt) {
  const M = G.monster, k = G.kid;
  M.modeT += dt; M.cool -= dt; M.wantX = 0; M.wantZ = 0;
  if (M.mode === 'sleep') {
    if (G.t > MON.wake || M.alert) setMode(G, M, 'patrol'), G.events.push({ type: 'wake' });
    else return move(G, M, dt);
  }
  const sees = canSee(G, M);
  const d = Math.hypot(k.x - M.x, k.z - M.z);
  if (sees) {
    if (!M.sees && G.t - M.lastSeenT > 3) G.events.push({ type: 'spotted' });
    M.lastSeen = { x: k.x, z: k.z, vx: k.vx, vz: k.vz }; M.lastSeenT = G.t; M.lastHint = M.lastSeen;
  }
  M.sees = sees;

  // sounds and the fuzzy sense, when it isn't already on you
  const busy = M.mode === 'chase' || M.mode === 'windup' || M.mode === 'lunge' || M.mode === 'recover' || M.mode === 'breather';
  let hint = null;
  if (M.alert) { hint = M.alert; M.alert = null; }
  if (!hint && k.noise > 0) {
    const r = los(G.L, M.x, M.z, k.x, k.z) ? k.noise : k.noise * 0.6;
    if (d < r) hint = { x: k.x + (G.rand() - 0.5), z: k.z + (G.rand() - 0.5) };
  }
  M.pingT -= dt;
  if (!hint && M.pingT <= 0) {
    const left = G.candles.filter((c) => c.lit).length, f = (left - 1) / Math.max(1, G.candles.length - 1);
    M.pingT = (MON.pingEvery[1] + (MON.pingEvery[0] - MON.pingEvery[1]) * f) * (0.8 + G.rand() * 0.4);
    const a = G.rand() * Math.PI * 2, e = G.rand() * MON.pingErr;
    hint = { x: k.x + Math.cos(a) * e, z: k.z + Math.sin(a) * e, fuzzy: true };
  }
  if (hint) M.lastHint = hint;

  // pressure: close and on you for too long, it backs off for a while (Alien's menace gauge)
  M.menace = d < 8 && (sees || M.mode === 'chase') ? M.menace + dt : Math.max(0, M.menace - dt * 0.5);
  if (M.menace > MON.menaceMax && M.mode !== 'lunge' && M.mode !== 'windup') {
    M.menace = 0; setMode(G, M, 'breather');
    const far = G.candles.filter((c) => c.lit).sort((a, b) => Math.hypot(b.x - k.x, b.z - k.z) - Math.hypot(a.x - k.x, a.z - k.z))[0];
    M.spot = far ? randomSpot(G, far.x, far.z, 2) : randomSpot(G, M.x, M.z, 6);
  }

  // the kid slipping through the same gap again and again: stop following, wait at the other end
  const kp = G.L.passageAt(tileOf(k.x), tileOf(k.z));
  if (kp >= 0 && kp !== M.kidGap && M.mode === 'chase') {
    M.gapUses[kp] = (M.gapUses[kp] || 0) + 1; M.chaseT = 0; M.lust = 0;
    if (M.gapUses[kp] >= MON.sameGap) {
      const amb = ambushSpot(G, M, { x: k.x, z: k.z, vx: k.vx, vz: k.vz });
      if (amb) { setMode(G, M, 'ambush'); M.ambushAt = amb; M.gapUses[kp] = 0; }
    }
  }
  M.kidGap = kp;

  if (sees && !busy) { setMode(G, M, 'chase'); M.chaseT = 0; M.gapUses = {}; }
  else if (hint && !busy && !(M.mode === 'ambush' && hint.fuzzy)) { setMode(G, M, 'hunt'); M.huntAt = hint; }
  else if (hint && M.mode === 'chase' && !sees && !hint.fuzzy) M.lastSeen = { x: hint.x, z: hint.z, vx: 0, vz: 0 };

  switch (M.mode) {
    case 'chase': {
      if (sees) {
        M.lostT = 0; M.chaseT += dt;
        M.lust = lustFor(M.chaseT);
        const dot = ((k.x - M.x) * M.hx + (k.z - M.z) * M.hz) / (d || 1);
        if (d < MON.lungeRange && M.cool <= 0 && dot > 0.8 && clearLine(G.L, M.x, M.z, k.x, k.z, R * 0.7, G.L.monBlocked)) {
          setMode(G, M, 'windup'); G.events.push({ type: 'windup' });
          break;
        }
        const lead = Math.min(0.5, d / 8);
        steer(G, M, k.x + k.vx * lead, k.z + k.vz * lead, MON.chase + M.lust, dt);
      } else {
        M.lostT += dt;
        const at = M.lastSeen, left = steer(G, M, at.x, at.z, MON.chase + M.lust, dt);
        if (left < 0.6 || M.lostT > 2.5) {
          G.events.push({ type: 'lost' });
          const amb = ambushSpot(G, M, at);
          if (amb) { setMode(G, M, 'ambush'); M.ambushAt = amb; }
          else { setMode(G, M, 'search'); M.searchAt = { x: at.x + at.vx * 1.2, z: at.z + at.vz * 1.2 }; M.searchLeft = 3; }
          M.lust = 0;
        }
      }
      break;
    }
    case 'windup': {
      aim(M, k.x, k.z, MON.chase * 0.5);
      if (M.modeT >= MON.windup) {
        const dx = k.x - M.x, dz = k.z - M.z, n = Math.hypot(dx, dz) || 1;
        M.hx = dx / n; M.hz = dz / n;
        setMode(G, M, 'lunge'); M.lungeT = MON.lungeTime; G.events.push({ type: 'lunge' });
      }
      break;
    }
    case 'breather': {
      const left = steer(G, M, M.spot.x, M.spot.z, MON.hunt, dt);
      if (M.modeT > MON.breather || (left < 0.5 && M.modeT > MON.breather * 0.6)) { setMode(G, M, 'patrol'); M.spot = null; }
      break;
    }
    case 'lunge': {
      M.lungeT -= dt;
      M.wantX = M.hx * MON.lungeSpeed; M.wantZ = M.hz * MON.lungeSpeed;
      M.vx = M.wantX; M.vz = M.wantZ;
      if (M.lungeT <= 0) { setMode(G, M, 'recover'); M.cool = 0; }
      break;
    }
    case 'recover': {
      aim(M, k.x, k.z, (MON.chase + M.lust) * 0.5);
      if (M.modeT > MON.missRecover) { setMode(G, M, 'chase'); if (!sees) M.lostT = 0; }
      break;
    }
    case 'hunt': {
      const left = steer(G, M, M.huntAt.x, M.huntAt.z, MON.hunt, dt);
      if (left < 0.7 || M.modeT > 12) { setMode(G, M, 'search'); M.searchAt = M.huntAt; M.searchLeft = 3; }
      break;
    }
    case 'ambush': {
      const left = steer(G, M, M.ambushAt.x, M.ambushAt.z, MON.chase, dt);
      if (left < 0.4) {
        M.linger += dt;
        if (M.linger > 4.5) { M.linger = 0; setMode(G, M, 'search'); M.searchAt = M.ambushAt; M.searchLeft = 2; }
      }
      if (M.modeT > 10) { setMode(G, M, 'search'); M.searchAt = M.ambushAt; M.searchLeft = 2; }
      break;
    }
    case 'search': {
      if (!M.goal || M.linger > 1.2) {
        if (M.searchLeft-- <= 0) { setMode(G, M, 'patrol'); break; }
        M.linger = 0;
        const s = randomSpot(G, M.searchAt.x, M.searchAt.z, 3.5);
        M.goal = s; M.path = null;
        M.spot = s;
      }
      const left = steer(G, M, M.spot.x, M.spot.z, MON.patrol + 0.4, dt);
      if (left < 0.5 || M.modeT > 20) M.linger += dt;
      break;
    }
    case 'patrol': {
      if (!M.spot || M.linger > 2.2) { M.linger = 0; M.spot = pickGuard(G, M) || { x: M.x, z: M.z }; M.path = null; }
      const left = steer(G, M, M.spot.x, M.spot.z, MON.patrol, dt);
      if (left < 0.5 || M.modeT > 25) M.linger += dt;
      break;
    }
  }
  move(G, M, dt);
}

