// THE BOY. A seven-year-old's walk: slow, a little bouncy; running is fast for a few seconds and then
// he's out of breath. Eye height 1.05 m, 0.62 crouched. The road keeps him in: he can walk on the
// road, the pavement and into front gardens, not through houses, lamp posts, bins or hedges.
import { ROAD, toRoad, at, groundAt } from './road.js';

export const PLAYER = { walk: 1.45, run: 3.3, crouch: 0.75, carryWalk: 1.3, carryRun: 2.5, eye: 1.05, eyeCrouch: 0.62, radius: 0.22, accel: 7, staminaDrain: 0.16, staminaCarry: 0.24, staminaRegen: 0.1 };

export function makePlayer(s = 2, l = 3.6) {
  const p = at(s, l);
  return { x: p.x, z: p.z, y: p.y, yaw: 0, pitch: -0.12, vx: 0, vz: 0, speed: 0, stamina: 1, winded: 0, crouch: 0, running: false, phase: 0, steps: 0, carrying: false, s, l };
}

export function stepPlayer(P, input, dt, obstacles) {
  P.yaw += input.look.yaw; P.pitch = Math.max(-1.35, Math.min(1.25, P.pitch + input.look.pitch));
  // kneeling to stroke Biscuit counts as crouching
  const crouching = input.crouch || (input.pet && !P.carrying && P.speed < 0.5);
  P.crouch += ((crouching ? 1 : 0) - P.crouch) * (1 - Math.exp(-dt * 10));
  // running needs breath; once winded you can't run again until you've got some back
  const wantsRun = input.run && !crouching && P.winded <= 0 && (input.move.x || input.move.z);
  P.running = wantsRun && P.stamina > 0;
  if (P.running) { P.stamina -= dt * (P.carrying ? PLAYER.staminaCarry : PLAYER.staminaDrain) * (P.adrenaline ? 0.55 : 1); /* (the last run: you find more breath than you had) */ if (P.stamina <= 0) { P.stamina = 0; P.winded = 2.5; } }
  else { P.stamina = Math.min(1, P.stamina + dt * PLAYER.staminaRegen * (P.speed < 0.2 ? 1.6 : 1)); P.winded = Math.max(0, P.winded - dt); }
  const max = crouching ? PLAYER.crouch : P.running ? (P.carrying ? PLAYER.carryRun : PLAYER.run) : (P.carrying ? PLAYER.carryWalk : PLAYER.walk);
  let mx = input.move.x, mz = input.move.z; const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
  const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
  // forward is (-sin yaw, -cos yaw); right is (cos yaw, -sin yaw)
  const tx = (-sy * -mz + cy * mx) * max * (P.slow ?? 1), tz = (-cy * -mz - sy * mx) * max * (P.slow ?? 1);
  const k = 1 - Math.exp(-dt * PLAYER.accel);
  P.vx += (tx - P.vx) * k; P.vz += (tz - P.vz) * k;
  // the lead pulls (set by the puppy each frame)
  if (P.pull) { P.vx += P.pull.x * dt; P.vz += P.pull.z * dt; }
  let nx = P.x + P.vx * dt, nz = P.z + P.vz * dt;
  // stay out of houses: clamp across the road
  let { s, l } = toRoad(nx, nz);
  const lim = ROAD.front - 0.35;
  if (Math.abs(l) > lim) { const c = at(s, Math.sign(l) * lim); nx = c.x; nz = c.z; l = Math.sign(l) * lim; }
  // a garden wall or fence along the back of the pavement, unless you're at the gate (or already inside)
  const EDGE = 4.82;
  if (P.blocked && Math.abs(l) > EDGE && Math.abs(P.l) <= EDGE + 0.05 && P.blocked(s, Math.sign(l))) { const c = at(s, Math.sign(l) * EDGE); nx = c.x; nz = c.z; l = Math.sign(l) * EDGE; }
  if (P.blocked && Math.abs(l) > EDGE + 0.05 && Math.abs(P.l) > EDGE + 0.05) { // inside a garden: its side boundaries are the next garden's
    const was = P.s; if (P.blocked(s, Math.sign(l)) && !P.blocked(was, Math.sign(l))) { /* allowed: moving within the garden */ }
  }
  if (s < -4) { const c = at(-4, l); nx = c.x; nz = c.z; s = -4; }
  if (s > ROAD.homeS - 1.2) { const c = at(ROAD.homeS - 1.2, l); nx = c.x; nz = c.z; s = ROAD.homeS - 1.2; } // home's garden fence
  // round things: push out
  for (const o of obstacles) {
    const dx = nx - o.x, dz = nz - o.z, r = o.r + PLAYER.radius, d2 = dx * dx + dz * dz;
    if (d2 < r * r && d2 > 1e-6) { const d = Math.sqrt(d2); nx = o.x + dx / d * r; nz = o.z + dz / d * r; }
  }
  const moved = Math.hypot(nx - P.x, nz - P.z);
  P.speed = moved / Math.max(dt, 1e-4);
  P.x = nx; P.z = nz; P.s = s; P.l = l;
  P.y = groundAt(nx, nz);
  // footsteps: a step every ~0.62 m walking (child stride), longer when running
  const stride = P.running ? 0.95 : crouching ? 0.45 : 0.62;
  const before = Math.floor(P.phase); P.phase += moved / stride;
  P.stepped = Math.floor(P.phase) !== before;
  if (P.stepped) P.steps++;
  return P;
}
