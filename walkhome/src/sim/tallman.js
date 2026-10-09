// THE TALL MAN. Three metres of black coat and a top hat, a white face with a painted smile.
// His rule, the one a child would make up and believe: HE CAN ONLY MOVE WHEN YOU'RE NOT LOOKING.
// Look back and he's standing still, wherever he got to. Look away and he comes.
//   - "looking" = he's within the middle of your view (the edges of your eyes don't count: you can
//     catch him moving at the edge of the screen) and close enough to make out (inside the fog)
//   - he keeps to the dark: a lit lamp near him flickers and dies (that's his tell, and your warning)
//   - he hears: a bark or running tells him exactly where you are; hiding (crouched behind
//     something, Biscuit quiet) makes him lose you
//   - if he reaches you, that's the night over... almost (see director: you wake under the last lamp)
// The director decides when he's here at all, and where he comes from; this is how he behaves.
import { ROAD, at, toRoad, N as roadN } from './road.js';

export const TALL = { walk: 1.7, hunt: 2.5, rush: 3.6, reach: 1.25, viewCos: Math.cos(0.62), viewDist: 46, lampKill: 6.5, killDelay: [1.2, 2.6] };

export function makeTall() {
  return { active: false, x: 0, z: 0, s: 0, l: 0, y: 0, yaw: 0, mode: 'away', seen: false, seenFor: 0, unseenFor: 0, speed: 0, phase: 0, pose: 0, knows: 0, target: null, freezePose: 0, headTurn: 0 };
}

// cam: { x, y, z, fx, fy, fz } (eye and look direction); lamps: [{ id, x, z, on }]; ctx: { hidden, noise: [{x,z,loud}] }
export function stepTall(M, P, cam, dt, lamps, ctx, emit) {
  if (!M.active) { M.seen = false; return M; }
  // is he being looked at?
  const dx = M.x - cam.x, dy = (M.y + 2.2) - cam.y, dz = M.z - cam.z, d = Math.hypot(dx, dy, dz);
  const cos = (dx * cam.fx + dy * cam.fy + dz * cam.fz) / Math.max(d, 1e-4);
  const looked = cos > TALL.viewCos && d < TALL.viewDist;
  if (looked && !M.seen) { emit('tallSeen', { d, first: !M.everSeen }); M.everSeen = true; }
  M.seen = looked; M.seenFor = looked ? M.seenFor + dt : 0; M.unseenFor = looked ? 0 : M.unseenFor + dt;
  // what does he know? noise tells him where you are; hiding makes him lose you
  for (const n of ctx.noise) { M.knows = Math.max(M.knows, n.loud); M.target = { x: n.x, z: n.z }; }
  if (!ctx.hidden) { M.knows = Math.min(1, M.knows + dt * 0.4); M.target = { x: P.x, z: P.z }; }
  else M.knows = Math.max(0, M.knows - dt * 0.35);
  const pd = Math.hypot(P.x - M.x, P.z - M.z);
  // frozen while watched. His head keeps turning to you though, a little each time you look away
  if (looked) { M.speed = 0; return M; }
  if (M.mode === 'withdraw') {
    // backs off into the dark the way he came, and the director takes him away once he's out of sight
    const t = at(M.s + (M.s < P.s ? -40 : 40), M.l); moveToward(M, t.x, t.z, TALL.walk * 1.5, dt);
  } else if (M.knows > 0.2 && M.target) {
    // far away and unwatched he covers ground quickly (every time you look back he's nearer);
    // close up he slows to a stalk, unless he's hunting
    const hunt = M.mode === 'hunt';
    const speed = pd > 22 ? 3.4 : pd > 11 ? (hunt ? TALL.hunt : TALL.walk * 1.25) : (hunt ? (pd < 7 ? TALL.rush : TALL.hunt) : TALL.walk);
    // he won't walk into a lit pool: he stops at its edge and waits for the lamp to die
    let blocked = false;
    for (const L of lamps) if (L.on && !(L.dying <= 0 && L.dying !== 0) && Math.hypot(L.x - M.x, L.z - M.z) < 6.5) {
      const ahead = Math.hypot(L.x - (M.x + (M.target.x - M.x) * 0.1), L.z - (M.z + (M.target.z - M.z) * 0.1));
      if (ahead < 3.2 && L.on && L.dying > 0) blocked = true;
    }
    if (!blocked) moveToward(M, M.target.x, M.target.z, speed, dt); else M.speed = 0;
  } else {
    // lost you: stands, listening, turns slowly
    M.speed = 0; M.yaw += Math.sin(M.phase * 0.3) * dt * 0.3; M.phase += dt;
  }
  M.headTurn = Math.atan2(-(P.x - M.x), -(P.z - M.z));
  // lamps near him die
  for (const L of lamps) {
    if (!L.on) continue;
    const ld = Math.hypot(L.x - M.x, L.z - M.z);
    // a lamp you're standing under holds out longer: light is worth something
    if (ld < TALL.lampKill && !L.dying) { const under = Math.hypot(L.x - P.x, L.z - P.z) < 4; L.dying = (under ? 4 : 0) + TALL.killDelay[0] + Math.random() * (TALL.killDelay[1] - TALL.killDelay[0]); emit('lampDying', { id: L.id }); }
  }
  if (pd < TALL.reach) emit('caught', {});
  const rc = toRoad(M.x, M.z); M.s = rc.s; M.l = rc.l;
  return M;
}

function moveToward(M, tx, tz, speed, dt) {
  const dx = tx - M.x, dz = tz - M.z, d = Math.hypot(dx, dz);
  if (d < 0.05) { M.speed = 0; return; }
  const v = Math.min(speed, d / dt);
  M.x += dx / d * v * dt; M.z += dz / d * v * dt; M.speed = v; M.phase += v * dt / 1.6;
  M.yaw = Math.atan2(-dx, -dz);
  // keep to the road and pavements
  const rc = toRoad(M.x, M.z), lim = ROAD.front - 0.5;
  if (Math.abs(rc.l) > lim) { const c = at(rc.s, Math.sign(rc.l) * lim); M.x = c.x; M.z = c.z; }
}

// put him somewhere: s along the road, l across it
export function placeTall(M, s, l) {
  const p = at(s, l); Object.assign(M, { active: true, x: p.x, z: p.z, y: p.y, s, l, mode: 'stalk', knows: 0.3, seen: false, seenFor: 0, unseenFor: 0 });
}
