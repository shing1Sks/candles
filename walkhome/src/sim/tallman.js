// THE TALL MAN. Three metres of black coat and a top hat, a white face with a painted smile.
// His rule, the one a child would make up and believe: HE CAN ONLY MOVE WHEN YOU'RE NOT LOOKING.
// Look back and he's standing still, wherever he got to. Look away and he comes.
// But a rule a child believes has holes in it, and he knows every one:
//   - you can only see him where there's light. Far off in the dark between lamps he's free. He
//     puts the lamps out: one you're watching him under flickers, and every time it goes dark he's
//     nearer
//   - you can't stare for ever. Your eyes get heavy, and then you blink. He doesn't
//   - he hears: a bark or running tells him where you are; hiding (crouched behind something,
//     Biscuit quiet) makes him lose you
//   - if he reaches you, that's the night over... almost (see director: you wake under the last lamp)
// The director decides when he's here at all, and where he comes from; this is how he behaves.
import { ROAD, at, toRoad } from './road.js';

export const TALL = {
  walk: 1.7, hunt: 2.5, rush: 3.6, reach: 1.25, viewCos: Math.cos(0.62), viewDist: 46, lampKill: 6.5, killDelay: [1.2, 2.6],
  litR: 7.5,        // a lamp shows him inside this radius
  darkSee: 28,      // in the dark you can still make out his shape this far (against the town's glow)
  stare: [7.5, 4.5],// how long you can hold his eye before you blink (calm .. terrified)
  blinkT: 0.2, heavyT: 1.4, // a blink, and the eyelids getting heavy before it
  watchedKill: [2.2, 3.4], // a lamp he's being watched under starts to die after this
};

export function makeTall() {
  return { active: false, x: 0, z: 0, s: 0, l: 0, y: 0, yaw: 0, mode: 'away', seen: false, inView: false, lit: false, seenFor: 0, unseenFor: 0, speed: 0, phase: 0, pose: 0, knows: 0, target: null, freezePose: 0, headTurn: 0, blink: 0, heavy: 0, vanished: false, watchedUnder: null };
}

// cam: { x, y, z, fx, fy, fz } (eye and look direction); lamps: [{ id, x, z, on, level, dying }]; ctx: { hidden, noise: [{x,z,loud}], fear }
export function stepTall(M, P, cam, dt, lamps, ctx, emit) {
  if (!M.active) { M.seen = false; M.inView = false; M.heavy = 0; M.blink = 0; return M; }
  const pd = Math.hypot(P.x - M.x, P.z - M.z);
  // is he in your eyes at all?
  const dx = M.x - cam.x, dy = (M.y + 2.2) - cam.y, dz = M.z - cam.z, d = Math.hypot(dx, dy, dz);
  const cos = (dx * cam.fx + dy * cam.fy + dz * cam.fz) / Math.max(d, 1e-4);
  M.inView = cos > TALL.viewCos && d < TALL.viewDist;
  // and can you actually see him: is there light on him (a lamp, flickering or not), or is he close?
  let light = 0, under = null;
  for (const L of lamps) if (L.on) { const ld = Math.hypot(L.x - M.x, L.z - M.z); if (ld < TALL.litR) { const lv = L.level ?? 1; if (lv > light || !under) { light = Math.max(light, lv); under = L; } } }
  M.lit = light > 0.5;
  // you blink: for a moment you can't see anything at all
  if (M.blink > 0) M.blink -= dt;
  const blinking = M.blink > 0;
  // the dark of a flicker, in the lamp that's showing him: he moves in it
  const flickDark = under && (under.dying > 0 || under.flick > 0) && (under.level ?? 1) < 0.5 && pd > 4.5; // (close up, only a blink or a look away frees him)
  const looked = !blinking && M.inView && !flickDark && (M.lit || d < TALL.darkSee);
  if (looked && !M.seen && (M.unseenFor > 0.5 || !M.everSeen)) { emit('tallSeen', { d, first: !M.everSeen }); M.everSeen = true; }
  M.seen = looked; M.seenFor = looked ? M.seenFor + dt : 0; M.unseenFor = looked ? 0 : M.unseenFor + dt;
  // staring: the longer you hold him, the heavier your eyes. Look away and they ease
  const stare = TALL.stare[0] + (TALL.stare[1] - TALL.stare[0]) * Math.min(1, ctx.fear ?? 0);
  if (looked && M.mode !== 'glimpse') {
    M.heavy = Math.min(1, M.heavy + dt / TALL.heavyT * (M.seenFor > stare - TALL.heavyT ? 1 : 0));
    if (M.seenFor > stare) { M.blink = TALL.blinkT; M.heavy = 0; M.seenFor = 0; M.blinkJump = Math.max(0, Math.min(4.5, pd - 2.0)); emit('blink', { d: pd }); }
  } else M.heavy = Math.max(0, M.heavy - dt * 2);
  // what does he know? noise tells him where you are; hiding makes him lose you
  // (a sound carries further the louder it is; a whimper only to someone close)
  for (const n of ctx.noise) { const nd = Math.hypot(n.x - M.x, n.z - M.z), heard = n.loud * Math.max(0, 1 - nd / (6 + 55 * n.loud)); if (heard > 0.15) { M.knows = Math.max(M.knows, heard); M.target = { x: n.x, z: n.z }; } }
  if (!ctx.hidden) { M.knows = Math.min(1, M.knows + dt * 0.4); M.target = { x: P.x, z: P.z }; M.lostFor = 0; }
  else { M.knows = Math.max(0, M.knows - dt * 0.35); M.lostFor = (M.lostFor || 0) + dt; }
  M.headTurn = Math.atan2(-(P.x - M.x), -(P.z - M.z));
  // the lamp you're watching him under: it starts to go (he's putting it out)
  if (looked && M.lit && under && !under.dying && M.mode !== 'glimpse') {
    if (M.watchedUnder !== under) { M.watchedUnder = under; M.watchedT = 0; }
    M.watchedT += dt;
    if (M.watchedT > TALL.watchedKill[0] + (under.id % 3) * 0.4) { under.dying = 2.2 + Math.random() * 1.2; emit('lampDying', { id: under.id }); }
  }
  // a withdrawal you're watching: you blink, and he's gone
  if (M.mode === 'withdraw' && blinking) { M.vanished = true; M.speed = 0; return M; }
  if (M.mode === 'withdraw' && looked && M.seenFor > 2.5 && M.blink <= 0) { M.blink = TALL.blinkT; M.seenFor = 0; emit('blink', { d: pd }); }
  // frozen while watched (and he's never caught moving: during a blink he goes further than he could walk)
  if (looked) { M.speed = 0; return M; }
  if (blinking && M.blinkJump > 0 && M.mode !== 'withdraw' && M.target) {
    const step = Math.min(M.blinkJump, M.blinkJump * dt / TALL.blinkT * 1.4);
    moveToward(M, M.target.x, M.target.z, step / dt, dt); M.blinkJump -= step;
  } else if (M.mode === 'withdraw') {
    // backs off into the dark the way he came, and the director takes him away once he's out of sight
    const t = at(M.s + (M.s < P.s ? -40 : 40), M.l); moveToward(M, t.x, t.z, TALL.walk * 1.5, dt);
  } else if (M.mode === 'glimpse') {
    M.speed = 0;
  } else if (M.knows > 0.2 && M.target) {
    // far away and unwatched he covers ground quickly (every time you look back he's nearer);
    // close up he slows to a stalk, unless he's hunting
    const hunt = M.mode === 'hunt';
    let speed = pd > 22 ? 3.4 : pd > 11 ? (hunt ? TALL.hunt : TALL.walk * 1.25) : (hunt ? (pd < 7 ? TALL.rush : TALL.hunt) : TALL.walk);
    if (M.finale) speed = pd > 12 ? 2.6 : 2.2;   // the last run: faster than you can walk, not as fast as you can run (while your breath lasts)
    // in the flicker of a dying lamp he comes fast: every dark frame he's a step nearer
    if (M.inView && under && (under.level ?? 1) < 0.5) speed = Math.max(speed, 5.5);
    // he won't step into a lamp's pool while it's steady: he waits at the edge for it to die
    let blocked = false;
    const nx = M.x + (M.target.x - M.x) * 0.08, nz = M.z + (M.target.z - M.z) * 0.08;
    for (const L of lamps) if (L.on && !L.dying && L !== under && Math.hypot(L.x - nx, L.z - nz) < 3.2 && Math.hypot(L.x - P.x, L.z - P.z) < 4.5) blocked = true;
    if (!blocked) moveToward(M, M.target.x, M.target.z, speed, dt); else M.speed = 0;
  } else if (M.target) {
    // lost you: he searches where he last knew you were, slowly, pacing round it, stopping to listen.
    // Crouched behind the car with your hand on Biscuit, you can hear him go round
    M.searchT = (M.searchT || 0) - dt;
    if (!M.searchPt || M.searchT < 0) { const a = Math.random() * Math.PI * 2, r = 1.5 + Math.random() * 3.5; M.searchPt = { x: M.target.x + Math.cos(a) * r, z: M.target.z + Math.sin(a) * r }; M.searchT = 3 + Math.random() * 3; }
    if (Math.hypot(M.searchPt.x - M.x, M.searchPt.z - M.z) > 0.4) moveToward(M, M.searchPt.x, M.searchPt.z, 0.9, dt); else { M.speed = 0; M.yaw += Math.sin(M.phase * 0.7) * dt * 0.6; M.phase += dt * 0.3; }
    // right on top of you, he doesn't need to hear anything
    if (pd < 1.7) { if (M.knows < 1) emit('spotted', {}); M.knows = 1; M.target = { x: P.x, z: P.z }; }
  } else { M.speed = 0; }
  // lamps near him die (a lamp you're standing under holds out longer: light is worth something)
  for (const L of lamps) {
    if (!L.on || L.dying) continue;
    const ld = Math.hypot(L.x - M.x, L.z - M.z);
    if (ld < TALL.lampKill && M.mode !== 'glimpse') { const youUnder = Math.hypot(L.x - P.x, L.z - P.z) < 4; L.dying = (youUnder ? 4 : 0) + TALL.killDelay[0] + Math.random() * (TALL.killDelay[1] - TALL.killDelay[0]); emit('lampDying', { id: L.id }); }
  }
  if (pd < TALL.reach && M.mode !== 'withdraw') emit('caught', {});
  const rc = toRoad(M.x, M.z); M.s = rc.s; M.l = rc.l;
  return M;
}

function moveToward(M, tx, tz, speed, dt) {
  const dx = tx - M.x, dz = tz - M.z, d = Math.hypot(dx, dz);
  if (d < 0.05) { M.speed = 0; return; }
  const v = Math.min(speed, d / dt);
  M.x += dx / d * v * dt; M.z += dz / d * v * dt; M.speed = Math.min(v, 4); M.phase += Math.min(v, 4) * dt / 1.6;
  M.yaw = Math.atan2(-dx, -dz);
  // keep to the road and pavements
  const rc = toRoad(M.x, M.z), lim = ROAD.front - 0.5;
  if (Math.abs(rc.l) > lim) { const c = at(rc.s, Math.sign(rc.l) * lim); M.x = c.x; M.z = c.z; }
}

// put him somewhere: s along the road, l across it
export function placeTall(M, s, l) {
  const p = at(s, l); Object.assign(M, { active: true, x: p.x, z: p.z, y: p.y, s, l, mode: 'stalk', knows: 0.3, seen: false, inView: false, seenFor: 0, unseenFor: 0, blink: 0, heavy: 0, vanished: false, watchedUnder: null, blinkJump: 0, lostFor: 0, searchPt: null, searchT: 0, target: null });
}
