// THE WALK DIRECTOR. It knows where everything is; the Tall Man doesn't cheat (05 P3, P4).
// It keeps one number, fear (0..1), from how near he is, whether you can see him, how frightened
// Biscuit is, how dark it is where you stand. Fear drives the town: the houses lean in, colour
// drains, figures stand in windows, the music comes up.
// Phases CALM -> UNEASE -> DREAD -> HUNT -> PEAK -> AFTER. After every peak it forces an AFTER: he
// withdraws, the lamps he killed come back one by one, the street breathes out (05 R2).
// The walk itself is the act structure: our street is the baseline (nothing, then one glimpse),
// the long street is where he starts following, the park is where he hunts, the hill is the run.
import { at, regionAt } from './road.js';
import { placeTall } from './tallman.js';

export const DIR = {
  baseFear: { ourStreet: 0.0, longStreet: 0.12, highStreet: 0.18, parkEdge: 0.28, hill: 0.32 },
  firstGlimpseS: 150, firstVisitS: 270, visitGap: [55, 95], after: [40, 55], peakDist: 7, leftBehind: 70,
};

export function makeDirector(lamps) {
  return {
    fear: 0, phase: 'calm', pt: 0, t: 0, visits: 0, nextVisit: 0, glimpse: 'pending', afterUntil: 0,
    checkpoint: { s: 2, l: 3.6 }, lamps, ledger: [], caughtAt: -99, relight: [],
  };
}

const setPhase = (D, p, emit) => { if (D.phase !== p) { D.phase = p; D.pt = 0; D.ledger.push([+D.t.toFixed(1), p]); emit('phase', { phase: p }); } };

// ctx: { P, dog, tall, rng, cam }
export function stepDirector(D, ctx, dt, emit) {
  const { P, dog, tall, rng } = ctx;
  D.t += dt; D.pt += dt;
  const region = regionAt(P.s).id;
  // ---- the lamps: dying ones flicker then go; relighting ones come back one by one
  let litNear = 99;
  for (const L of D.lamps) {
    if (L.dying > 0) { L.dying -= dt; L.flick = 1; if (L.dying <= 0) { L.on = 0; L.flick = 0; L.dying = 0; emit('lampOut', { id: L.id, x: L.x, z: L.z }); } }
    if (L.on) litNear = Math.min(litNear, Math.hypot(L.x - P.x, L.z - P.z));
    // passing under a lit lamp is a checkpoint
    if (L.on && Math.hypot(L.x - P.x, L.z - P.z) < 4.5 && L.s > D.checkpoint.s) D.checkpoint = { s: L.s + 1.5, l: L.side * 2.6 };
  }
  if (D.relight.length && D.pt > 1.2) {
    const L = D.relight[0];
    if (!L.wait) L.wait = D.t + 0.9 + rng.range(0, 1.2);
    if (D.t > L.wait) { D.relight.shift(); L.on = 1; L.flick = 0.6; L.wait = 0; emit('lampOn', { id: L.id, x: L.x, z: L.z }); }
  }
  // ---- fear
  let target = DIR.baseFear[region] ?? 0;
  if (tall.active) {
    const d = Math.hypot(tall.x - P.x, tall.z - P.z);
    target += Math.max(0, 1 - d / 45) * 0.65 + (tall.seen ? 0.12 : 0);
  }
  target += dog.fear * 0.15 + (litNear > 14 ? 0.08 : 0);
  if (D.phase === 'after') target *= 0.4;
  target = Math.min(1, target);
  D.fear += (target - D.fear) * (1 - Math.exp(-dt * (target > D.fear ? 0.9 : 0.25)));

  // ---- the walk's acts
  // Act I: our street. Nothing at all, then (near its end) one glimpse far ahead under a lamp
  if (D.glimpse === 'pending' && P.s > DIR.firstGlimpseS) {
    const L = D.lamps.find((l) => l.on && l.s > P.s + 38 && l.s < P.s + 70);
    if (L) { placeTall(tall, L.s + 1, L.side * 1.2); tall.mode = 'glimpse'; tall.knows = 0; D.glimpse = 'on'; D.glimpseT = D.t; emit('glimpse', { s: L.s }); D.ledger.push([+D.t.toFixed(1), 'glimpse']); }
  }
  if (D.glimpse === 'on') {
    tall.knows = 0;
    // seen once and then looked away from, or ignored for long enough: he's gone (he stepped out of the light)
    if ((tall.everSeen && tall.unseenFor > 0.6) || D.t - D.glimpseT > 14 || P.s > tall.s - 8) { tall.active = false; tall.everSeen = false; D.glimpse = 'done'; D.nextVisit = D.t + 25; emit('glimpseGone', {}); }
  }
  // Act II on: he comes. Visits are spaced; each visit builds to a peak, then he withdraws
  const canVisit = P.s > DIR.firstVisitS && !tall.active && D.phase !== 'after' && D.t > D.nextVisit && D.glimpse === 'done' && !D.hold && !dog.lost;
  if (canVisit) {
    // behind you, in the dark between lamps
    const back = rng.range(30, 42);
    placeTall(tall, P.s - back, rng.range(-2.4, 2.8));
    tall.mode = region === 'parkEdge' || region === 'hill' || D.visits >= 3 ? 'hunt' : 'stalk';
    D.visits++; D.visitT = 0; emit('visit', { n: D.visits, mode: tall.mode }); D.ledger.push([+D.t.toFixed(1), 'visit ' + tall.mode]);
    // his first tell: a whistle, far off
    emit('whistle', { x: tall.x, z: tall.z });
  }
  if (tall.active && D.glimpse !== 'on') {
    const d = Math.hypot(tall.x - P.x, tall.z - P.z);
    if (tall.mode !== 'withdraw') {
      // with a little hysteresis, so the phase doesn't flicker on a boundary
      const up = (p, th) => D.phase === p ? D.fear > th - 0.06 : D.fear > th;
      if (d < DIR.peakDist || (D.phase === 'peak' && d < DIR.peakDist + 3)) setPhase(D, 'peak', emit);
      else if (up('hunt', 0.6)) setPhase(D, 'hunt', emit);
      else if (up('dread', 0.38)) setPhase(D, 'dread', emit);
      else setPhase(D, 'unease', emit);
      // the peak ends: he's close for a while, or you got away (far ahead, or reached a lit lamp while he was being watched)
      D.visitT = (D.visitT || 0) + dt;
      // a visit can't hover: after a while of following he stops stalking and comes for you
      if (D.visitT > 38 && tall.mode === 'stalk') { tall.mode = 'hunt'; emit('hunt', {}); }
      const escaped = d > DIR.leftBehind || (D.phase === 'peak' && D.pt > 10) || D.visitT > 95;
      if (escaped) { tall.mode = 'withdraw'; emit('withdraw', {}); }
    } else if (!tall.seen && (d > 34 || tall.unseenFor > 6)) {
      tall.active = false; setPhase(D, 'after', emit);
      D.afterUntil = D.t + rng.range(DIR.after[0], DIR.after[1]);
      D.nextVisit = D.afterUntil + rng.range(DIR.visitGap[0], DIR.visitGap[1]) * (region === 'parkEdge' || region === 'hill' ? 0.6 : 1);
      // the lamps he put out come back, nearest you first, one by one
      D.relight = D.lamps.filter((L) => !L.on && L.base).sort((a, b) => Math.abs(a.s - P.s) - Math.abs(b.s - P.s));
    }
  } else if (!tall.active) {
    if (D.phase === 'after' && D.t > D.afterUntil) setPhase(D, 'calm', emit);
    else if (D.phase !== 'after') setPhase(D, D.fear > 0.25 ? 'unease' : 'calm', emit);
  }
  return D;
}

// you were caught: wake under the last lamp you passed, Biscuit pressed against your legs
export function respawn(D, P, tall, dog, emit) {
  // the nearest lamp behind you (within reach) is the one you wake under; it's on again
  const back = D.lamps.filter((L) => L.s < P.s && L.s > P.s - 38).sort((a, b) => b.s - a.s)[0];
  if (back) { back.on = 1; back.dying = 0; back.flick = 0.5; D.checkpoint = { s: back.s + 1.5, l: back.side * 2.6 }; }
  else if (D.checkpoint.s < P.s - 38) D.checkpoint = { s: P.s - 25, l: 2.6 };
  const c = at(D.checkpoint.s, D.checkpoint.l);
  Object.assign(P, { x: c.x, z: c.z, vx: 0, vz: 0, s: D.checkpoint.s, l: D.checkpoint.l, yaw: 0, pitch: -0.1, stamina: 1, winded: 0 });
  if (dog.carried) { dog.carried = false; P.carrying = false; }
  Object.assign(dog, { x: c.x + 0.4, z: c.z - 0.6, vx: 0, vz: 0, fear: 0.7, state: 'hide', st: 0 });
  // the first time, he bolts. He's up the road, pressed against a garden wall, on whichever side
  if (!D.lostOnce) {
    D.lostOnce = true;
    const s = D.checkpoint.s + 30 + Math.random() * 12, side = Math.random() < 0.5 ? -1 : 1, q = at(s, side * 4.45);
    dog.lost = { x: q.x, z: q.z, s }; dog.x = q.x; dog.z = q.z; dog.whimperCd = 3;
    emit('lostDog', { s });
  }
  tall.active = false; D.phase = 'after'; D.pt = 0; D.afterUntil = D.t + 50; D.nextVisit = D.afterUntil + 40; D.caughtAt = D.t;
  D.relight = D.lamps.filter((L) => !L.on && L.base).sort((a, b) => Math.abs(a.s - P.s) - Math.abs(b.s - P.s));
  emit('respawn', { s: D.checkpoint.s });
}
