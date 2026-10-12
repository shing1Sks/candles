// The monster's body: what the giant's controller can make it do, and every limit on it. Whatever mind presses the
// buttons, it can't run faster than the caps, skip the crouch before a lunge, or open a door instantly.
//   stick: move, full tilt = hunt speed; run held: up to chase speed (+ bloodlust + rage)
//   lunge: crouch 0.25 s, lunge 0.4 s, recover 1.5 s      use: open a shut door (0.6 s) or look in a wardrobe (0.7 s)
//   bash: smash through a shut door (0.9 s, loud)         yell: stop and roar for 0.8 s, at most every 6 s
import { MON, GIANT, VENT } from './rules.js';
import { resolve } from './grid.js';
import { setDoor, caught } from './game.js';

const lustFor = (t) => MON.lust.reduce((v, [at, add]) => (t >= at ? add : v), 0);

export function createBody(L) {
  const s = L.monster;
  return {
    x: s.x, z: s.z, vx: 0, vz: 0, hx: -1, hz: 0, speed: 0,
    act: 'none', actT: 0, actId: -1, awake: false, sees: false, shoved: false,
    lust: 0, rage: 0, cool: 0, yellCool: 0, stuckT: 0, stride: 0,
    mode: 'sleep', doorT: 0, // for the renderer and sound: what it is doing, and how long a door has left
  };
}

// the shut door it is facing, within reach
function doorAhead(G, M, dx, dz) {
  let best = null, bd = 1.35;
  for (const d of G.doors) {
    if (d.open) continue;
    const ex = d.x - M.x, ez = d.z - M.z, dd = Math.hypot(ex, ez);
    if (dd < bd && (ex * dx + ez * dz) / (dd || 1) >= 0.6) { bd = dd; best = d; }
  }
  return best;
}
function wardrobeAt(G, M) {
  let best = null, bd = 0.8;
  for (const w of G.wardrobes) { const d = Math.hypot(w.fx - M.x, w.fz - M.z); if (d < bd) { bd = d; best = w; } }
  return best;
}

function start(M, act, t, id = -1) { M.act = act; M.actT = t; M.actId = id; }

export function stepBody(G, gi, dt) {
  const M = G.monster;
  M.rage = Math.max(0, M.rage - dt); M.yellCool -= dt; M.cool -= dt; // (M.shoved stays set until its mind looks)
  if (!M.awake) {
    if (G.t > MON.wake || G.sense.wake) { M.awake = true; G.events.push({ type: 'wake' }); }
    else { M.vx = M.vz = M.speed = 0; M.mode = 'sleep'; return; }
  }
  M.lust = lustFor(G.sense.sightT);
  let sx = gi.mx || 0, sz = gi.mz || 0;
  const sm = Math.hypot(sx, sz);
  if (sm > 1) { sx /= sm; sz /= sm; }
  const dirX = sm > 0.3 ? sx / sm : M.hx, dirZ = sm > 0.3 ? sz / sm : M.hz;

  // a new action, only when it isn't already busy
  if (M.act === 'none') {
    if (gi.yell && M.yellCool <= 0) {
      start(M, 'yell', GIANT.yell); M.yellCool = GIANT.yellEvery;
      G.events.push({ type: 'yell', why: gi.why || '' });
    } else if (gi.lunge && M.cool <= 0 && !G.L.duct(Math.floor(M.x), Math.floor(M.z))) {
      start(M, 'windup', MON.windup); G.events.push({ type: 'windup' });
    } else if (gi.bash || gi.use) {
      const d = doorAhead(G, M, dirX, dirZ), w = gi.use ? wardrobeAt(G, M) : null;
      if (w && (!d || Math.hypot(w.fx - M.x, w.fz - M.z) < Math.hypot(d.x - M.x, d.z - M.z))) {
        start(M, 'check', MON.checkOpen, w.id); w.openAt = G.t;
        G.events.push({ type: 'checkOpen', id: w.id });
      } else if (d) {
        const bash = !!gi.bash;
        start(M, bash ? 'bash' : 'door', bash ? MON.doorBash : MON.doorOpen, d.id);
        G.events.push({ type: 'doorTry', id: d.id, bash });
      }
    }
  }

  // what the stick may do during each action
  const runCap = MON.chase + M.lust + (M.rage > 0 ? MON.rageBoost : 0);
  let cap = gi.run ? runCap : MON.hunt, wantX = sx * cap, wantZ = sz * cap;
  switch (M.act) {
    case 'windup': cap = Math.min(cap, MON.chase * 0.5); break;
    case 'recover': cap = Math.min(cap, (MON.chase + M.lust) * 0.5); break;
    case 'lunge': break;
    case 'none': break;
    default: wantX = wantZ = 0; M.vx *= 0.5; M.vz *= 0.5; // opening, smashing, looking inside, yelling: stands
  }
  if (G.L.duct(Math.floor(M.x), Math.floor(M.z))) { // squeezed into the vent duct: it slows at once
    cap = Math.min(cap, VENT.monCrawl);
    const v = Math.hypot(M.vx, M.vz);
    if (v > cap) { M.vx *= cap / v; M.vz *= cap / v; }
  }
  const wm = Math.hypot(wantX, wantZ);
  if (wm > cap) { wantX *= cap / wm; wantZ *= cap / wm; }
  if (M.act === 'lunge') { wantX = M.hx * MON.lungeSpeed; wantZ = M.hz * MON.lungeSpeed; M.vx = wantX; M.vz = wantZ; }
  if (M.act === 'check') { const w = G.wardrobes[M.actId]; const ex = w.tx + 0.5 - M.x, ez = w.tz + 0.5 - M.z, n = Math.hypot(ex, ez) || 1; M.hx += (ex / n - M.hx) * 0.2; M.hz += (ez / n - M.hz) * 0.2; }

  move(G, M, wantX, wantZ, dt);

  // actions run their course
  if (M.act !== 'none') {
    M.actT -= dt;
    if (M.actT <= 1e-9) finish(G, M, dirX, dirZ);
  }
  M.doorT = M.act === 'door' || M.act === 'bash' ? M.actT : 0;
  M.mode = M.act === 'none' || M.act === 'door' || M.act === 'bash' || M.act === 'yell' ? G.mind?.mode ?? 'patrol' : M.act;
}

function finish(G, M, dirX, dirZ) {
  const act = M.act, id = M.actId;
  M.act = 'none'; M.actT = 0; M.actId = -1;
  if (act === 'windup') {
    // it lunges the way the stick points at the end of the crouch
    const n = Math.hypot(dirX, dirZ) || 1;
    M.hx = dirX / n; M.hz = dirZ / n;
    start(M, 'lunge', MON.lungeTime); G.events.push({ type: 'lunge' });
  } else if (act === 'lunge') {
    start(M, 'recover', MON.missRecover); M.cool = 0;
  } else if (act === 'door' || act === 'bash') {
    const d = G.doors[id];
    if (!d.open) setDoor(G, d, true, 'monster', act === 'bash');
  } else if (act === 'check') {
    const k = G.kid, w = G.wardrobes[id];
    if (k.hidden === w.id) { G.events.push({ type: 'found', id: w.id }); caught(G, 'found'); }
    else G.events.push({ type: 'checkEmpty', id: w.id });
  }
}

function move(G, M, wantX, wantZ, dt) {
  const a = MON.accel * dt;
  const dvx = wantX - M.vx, dvz = wantZ - M.vz, dv = Math.hypot(dvx, dvz);
  if (M.act !== 'lunge') { if (dv > a) { M.vx += (dvx / dv) * a; M.vz += (dvz / dv) * a; } else { M.vx = wantX; M.vz = wantZ; } }
  const ox = M.x, oz = M.z;
  M.x += M.vx * dt; M.z += M.vz * dt;
  resolve(G.L, M, MON.radius, G.monBlocked);
  const mx = (M.x - ox) / dt, mz = (M.z - oz) / dt;
  M.speed = Math.hypot(mx, mz);
  if (M.speed > 0.2 && M.act !== 'lunge') {
    const k = Math.min(1, dt * 9), hx = M.hx + (mx / M.speed - M.hx) * k, hz = M.hz + (mz / M.speed - M.hz) * k, h = Math.hypot(hx, hz) || 1;
    M.hx = hx / h; M.hz = hz / h;
  }
  // stuck on a corner: a shove (the mind is told, so it can re-plan)
  const want = Math.hypot(wantX, wantZ);
  M.stuckT = want > 0.5 && M.speed < want * 0.25 ? M.stuckT + dt : 0;
  if (M.stuckT > 0.6) { M.vx += (G.rand() - 0.5) * 3; M.vz += (G.rand() - 0.5) * 3; M.stuckT = 0; M.shoved = true; }
  M.stride += M.speed * dt;
  if (M.stride > (M.speed > 3 ? 1.25 : 0.95)) { M.stride = 0; G.events.push({ type: 'mstep', x: M.x, z: M.z, run: M.speed > 3 }); }
}
