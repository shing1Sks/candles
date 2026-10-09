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
  // the walk paces him, but so does the clock: dawdle, and the night comes to you anyway
  firstGlimpseS: 150, firstGlimpseT: 80, firstVisitS: 270, firstVisitT: 55, visitGap: [40, 70], after: [20, 30], peakDist: 7, leftBehind: 70,
  omenGap: [13, 28], maxHold: 30,
};

// OMENS: between his visits there is always something at the edge (05 P1: dread is anticipation).
// Small, deniable, never explained; most of them are heard, not seen, and Biscuit hears them first.
const OMENS = [
  // kind, weight, the regions it suits (null: anywhere)
  ['echo', 3, null], ['dogStare', 3, null], ['flicker', 2.5, null], ['eyes', 2, ['longStreet', 'parkEdge', 'hill', 'highStreet']],
  ['gate', 2, ['ourStreet', 'longStreet', 'hill']], ['tv', 1.5, ['ourStreet', 'longStreet', 'hill']], ['phoneIn', 1.2, ['longStreet', 'highStreet', 'hill']],
  ['breath', 1.2, ['highStreet', 'parkEdge', 'hill']], ['figure', 2.2, ['longStreet', 'highStreet', 'parkEdge', 'hill']], ['whistleFar', 1.5, ['longStreet', 'highStreet', 'parkEdge', 'hill']], ['knock', 1.5, ['ourStreet', 'longStreet', 'highStreet', 'hill']],
];
function omen(D, ctx, emit) {
  const { P, rng, dog } = ctx, R = regionAt(P.s).id;
  const pool = OMENS.filter(([k, , rs]) => (!rs || rs.includes(R)) && k !== D.lastOmen && !(k === 'dogStare' && (dog.carried || dog.lost)) && !(k === 'figure' && (D.omenCount.figure || 0) >= 3));
  const w = (o) => o[1] / (1 + (D.omenCount[o[0]] || 0) * 0.8); // each one rarer the more it's happened
  let r = rng.range(0, pool.reduce((a, o) => a + w(o), 0)), kind = pool[0][0];
  for (const o of pool) { r -= w(o); if (r <= 0) { kind = o[0]; break; } }
  // the first omen on the long street is always the fox: a scream over the gardens, loud and close
  // enough to stop you dead, and Biscuit barks at it. It's only a fox. (Next time, will you be sure?)
  if (R === 'longStreet' && !D.foxDone) { kind = 'fox'; D.foxDone = true; }
  D.lastOmen = kind; D.omenCount[kind] = (D.omenCount[kind] || 0) + 1;
  const side = rng.chance(0.5) ? -1 : 1, e = { kind, side };
  if (kind === 'echo') D.echo = { until: D.t + rng.range(9, 16), back: rng.range(12, 17), steps: 0 };
  else if (kind === 'dogStare') { const p = at(P.s - rng.range(18, 28), side * rng.range(3, 6)); Object.assign(e, { x: p.x, z: p.z }); D.omenPt = { x: p.x, z: p.z, until: D.t + 5.5 }; }
  else if (kind === 'eyes') { const p = at(P.s + rng.range(9, 15), side * rng.range(5.3, 6.4)); Object.assign(e, { x: p.x, y: p.y + rng.range(0.3, 0.55), z: p.z, until: D.t + 14 }); D.omenPt = { x: p.x, z: p.z, until: D.t + 9 }; }
  else if (kind === 'flicker') { const L = D.lamps.find((l) => l.on && !l.dying && l.s > P.s + 6 && l.s < P.s + 40); if (!L) return; L.flick = 2.2; e.id = L.id; }
  else if (kind === 'fox') { const p = at(P.s + rng.range(-6, 14), side * rng.range(16, 24)); Object.assign(e, { x: p.x, y: p.y + 1, z: p.z }); D.omenPt = { x: p.x, z: p.z, until: D.t + 4 }; emit('omen', e); emit('bark', { x: dog.x, z: dog.z, loud: 0.4, at: 0.9 }); emit('startle', { amount: 0.25 }); D.ledger.push([+D.t.toFixed(1), 'omen fox']); return; }
  else if (kind === 'figure') { /* placed by the renderer, at the edge of your eye */ }
  else if (kind === 'whistleFar') { const p = at(P.s + (rng.chance(0.6) ? -1 : 1) * rng.range(50, 80), side * 3); emit('whistle', { x: p.x, z: p.z }); D.ledger.push([+D.t.toFixed(1), 'omen whistleFar']); return; }
  else {
    const behind = kind === 'gate' || kind === 'breath', p = at(P.s + (behind ? -rng.range(6, 9) : rng.range(2, 8)), side * (kind === 'breath' ? 1.2 : 7.6));
    Object.assign(e, { x: p.x, y: p.y + (kind === 'breath' ? 1.3 : 1.4), z: p.z });
    if (behind) D.omenPt = { x: p.x, z: p.z, until: D.t + 3 };
  }
  emit('omen', e); D.ledger.push([+D.t.toFixed(1), 'omen ' + kind]);
}

export function makeDirector(lamps) {
  return {
    fear: 0, phase: 'calm', pt: 0, t: 0, visits: 0, nextVisit: 0, glimpse: 'pending', afterUntil: 0,
    checkpoint: { s: 2, l: 3.6 }, lamps, ledger: [], caughtAt: -99, relight: [], nextOmen: 24, omenCount: {}, echo: null, omenPt: null, holdT: 0, glimpseDoneT: 0,
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
  if (D.glimpse === 'pending' && (P.s > DIR.firstGlimpseS || (D.t > DIR.firstGlimpseT && P.s > 50))) {
    const L = D.lamps.find((l) => l.on && l.s > P.s + 34 && l.s < P.s + 70);
    if (L) { placeTall(tall, L.s + 1, L.side * 1.2); tall.mode = 'glimpse'; tall.knows = 0; D.glimpse = 'on'; D.glimpseT = D.t; D.glimpseLamp = L; D.glimpseFlick = 0; emit('glimpse', { s: L.s }); D.ledger.push([+D.t.toFixed(1), 'glimpse']); }
  }
  if (D.glimpse === 'on') {
    tall.knows = 0;
    // watched for a moment, the lamp over him stutters, and in the dark of the stutter he's gone.
    // Looked away from, ignored for long enough, or walked up to: gone too (he stepped out of the light)
    const L = D.glimpseLamp;
    if (tall.seenFor > 1.1 && !D.glimpseFlick) { D.glimpseFlick = D.t; L.flick = 1.4; emit('lampDying', { id: L.id, stutter: true }); }
    const stuttered = D.glimpseFlick && D.t - D.glimpseFlick > 0.3 && (L.level ?? 1) < 0.5;
    if (stuttered || (tall.everSeen && tall.unseenFor > 0.6) || D.t - D.glimpseT > 16 || P.s > tall.s - 8) { tall.active = false; tall.everSeen = false; D.glimpse = 'done'; D.glimpseDoneT = D.t; D.nextVisit = D.t + 25; emit('glimpseGone', {}); }
  }
  // between his visits, the edge: omens
  if (D.echo && (D.t > D.echo.until || ctx.lookingBack)) { if (ctx.lookingBack) emit('echoStop', {}); D.echo = null; }
  if (D.omenPt && D.t > D.omenPt.until) D.omenPt = null;
  const quiet = !tall.active || tall.mode === 'glimpse';
  if (quiet && D.t > D.nextOmen && D.phase !== 'peak' && !dog.lost && !ctx.caught) {
    omen(D, ctx, emit);
    const k = region === 'ourStreet' ? 1.4 : region === 'hill' ? 0.75 : 1;
    D.nextOmen = D.t + rng.range(DIR.omenGap[0], DIR.omenGap[1]) * k * (D.phase === 'after' ? 1.6 : 1);
  }
  // Act II on: he comes. Visits are spaced; each visit builds to a peak, then he withdraws.
  // Someone you've met on the way holds him off, but not for ever
  D.holdT = D.hold ? D.holdT + dt : 0;
  const held = D.hold && D.holdT < DIR.maxHold;
  const reached = P.s > DIR.firstVisitS || (D.glimpse === 'done' && D.t > D.glimpseDoneT + DIR.firstVisitT && P.s > 110) || D.visits > 0;
  const canVisit = reached && !tall.active && D.phase !== 'after' && D.t > D.nextVisit && D.glimpse === 'done' && !held && !dog.lost;
  if (canVisit) {
    // behind you, in the dark between lamps. Or, later on, sometimes he's ahead: standing in the
    // road, waiting, and the only way home is past him (backwards, eyes on him, blinking)
    const ahead = D.visits >= 2 && !D.lastAhead && rng.chance(0.4);
    D.lastAhead = ahead;
    if (ahead) placeTall(tall, P.s + rng.range(34, 44), rng.range(-1.6, 1.6));
    else placeTall(tall, P.s - rng.range(30, 42), rng.range(-2.4, 2.8));
    tall.mode = region === 'parkEdge' || region === 'hill' || D.visits >= 3 ? 'hunt' : 'stalk';
    D.visits++; D.visitT = 0; emit('visit', { n: D.visits, mode: tall.mode, ahead }); D.ledger.push([+D.t.toFixed(1), 'visit ' + tall.mode + (ahead ? ' ahead' : '')]);
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
      // you got away: far ahead, survived the peak, hid well enough for long enough, or he's been at it too long
      const escaped = d > DIR.leftBehind || (D.phase === 'peak' && D.pt > 10) || D.visitT > 95 || (tall.lostFor || 0) > 10;
      if (escaped) { tall.mode = 'withdraw'; emit('withdraw', {}); }
    } else if (tall.vanished || (!tall.seen && (d > 34 || tall.unseenFor > 6))) {
      tall.active = false; tall.vanished = false; setPhase(D, 'after', emit);
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
    dog.lost = { x: q.x, z: q.z, s }; dog.x = q.x; dog.z = q.z; dog.l = side * 4.45; dog.whimperCd = 3;
    emit('lostDog', { s });
  }
  tall.active = false; D.phase = 'after'; D.pt = 0; D.afterUntil = D.t + 50; D.nextVisit = D.afterUntil + 40; D.caughtAt = D.t;
  D.relight = D.lamps.filter((L) => !L.on && L.base).sort((a, b) => Math.abs(a.s - P.s) - Math.abs(b.s - P.s));
  emit('respawn', { s: D.checkpoint.s });
}
