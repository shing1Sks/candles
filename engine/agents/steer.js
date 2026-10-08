// Shared by the scripted agents: walk somewhere through the corridors (via the nav graph), turning
// the way a player would (a bounded turn per step), and find things nearby.
import { NO_INPUT } from '../world.js';
import { furniture } from '../modules/player.js';

const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
export const yawTo = (P, x, z) => Math.atan2(-(x - P.x), -(z - P.z));
export const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// one step of walking toward goal. mem keeps the planned path between steps.
export function steerTo(S, L, goal, mem, { run = false, crouch = false } = {}) {
  const P = S.player;
  const key = `${goal.x.toFixed(1)},${goal.z.toFixed(1)}`;
  if (mem.goalKey !== key || !mem.path || mem.repath <= 0) {
    if (P.room) mem.path = roomPath(S, L, goal) || [{ x: goal.x, z: goal.z }];
    else if (L.segmentClear(P.floor, P.x, P.z, goal.x, goal.z)) mem.path = [{ x: goal.x, z: goal.z }];
    else mem.path = L.path(P.floor, P, goal)?.slice(1) || [{ x: goal.x, z: goal.z }];
    mem.goalKey = key; mem.repath = 90;
  }
  mem.repath--;
  while (mem.path.length > 1 && dist(P, mem.path[0]) < 0.6) mem.path.shift();
  const wp = mem.path[0];
  return face(S, wp.x, wp.z, dist(P, wp) > 0.35, { run, crouch });
}

// turn toward a point; walk forward if mostly facing it
export function face(S, x, z, walk = false, { run = false, crouch = false, pitch = null } = {}) {
  const P = S.player;
  const d = angDiff(yawTo(P, x, z), P.yaw);
  const turn = Math.max(-0.18, Math.min(0.18, d));
  const lookPitch = pitch === null ? Math.max(-0.05, Math.min(0.05, -P.pitch)) : Math.max(-0.08, Math.min(0.08, pitch - P.pitch));
  return { ...NO_INPUT, move: { x: 0, z: walk && Math.abs(d) < 0.7 ? -1 : 0 }, look: { yaw: turn, pitch: lookPitch }, run, crouch };
}

// hide from the Headmaster: the nearest locker, then use it once in reach
export function hide(S, L, mem) {
  const P = S.player;
  if (P.target?.kind === 'locker') return { ...NO_INPUT, use: true };
  if (!mem.locker) {
    const c = L.chunkAt(P.floor, P.x, P.z);
    let best = null, bd = 1e9;
    for (const k of c.lockers) { const lx = (k.x0 + k.x1) / 2, lz = (k.z0 + k.z1) / 2, d = Math.hypot(lx - P.x, lz - P.z); if (d < bd) { bd = d; best = k; } }
    if (!best) return null;
    const out = { N: [0, -0.7], S: [0, 0.7], E: [0.7, 0], W: [-0.7, 0] }[best.face];
    mem.locker = { x: (best.x0 + best.x1) / 2 + out[0], z: (best.z0 + best.z1) / 2 + out[1], fx: (best.x0 + best.x1) / 2, fz: (best.z0 + best.z1) / 2 };
  }
  if (dist(P, mem.locker) < 0.45) return face(S, mem.locker.fx, mem.locker.fz, false);
  return steerTo(S, L, mem.locker, mem);
}

// detention: write while he snores, stop when he doesn't (with an occasional mistake)
export function detention(S, rng, mistake = 0.001) {
  return { ...NO_INPUT, useHeld: S.detention.snore || rng.chance(mistake) };
}

// react to the Headmaster the same way in every agent; returns an input or null
export function headmasterReflex(S, L, rng, mem, events) {
  const P = S.player, H = S.headmaster;
  for (const e of events) { if (e.type === 'hmArrive') { mem.hiding = true; mem.locker = null; } if (e.type === 'hmLeave' || e.type === 'hmVanish' || e.type === 'runAlong') { mem.hiding = false; mem.locker = null; } }
  // (and if he's simply gone, come out after a while)
  mem.goneT = H.state && H.state !== 'absent' ? 0 : (mem.goneT ?? 0) + 1;
  if (mem.hiding && mem.goneT > 300) { mem.hiding = false; mem.locker = null; }
  if (P.hidden) return mem.hiding ? { ...NO_INPUT } : { ...NO_INPUT, use: true };
  if (H.state === 'chase' && S.held.stars > 0 && dist(P, H) < 8 && !mem.dropped) { mem.dropped = true; return { ...NO_INPUT, drop: true }; }
  if (H.state !== 'chase') mem.dropped = false;
  if (H.state === 'chase' && S.held.pass > 0 && dist(P, H) < 3) return { ...NO_INPUT, show: true };
  if (mem.hiding && !P.room) return hide(S, L, mem);
  return null;
}

// get out of the room you're in: to the door, open it if it's shut, and through
export function leaveRoom(S, L, mem) {
  const P = S.player, r = P.room && L.roomById(P.room);
  if (!r) return null;
  const d = r.door, o = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[d.side];
  const inside = { x: d.x - o[0] * 0.8, z: d.z - o[1] * 0.8 }, outside = { x: d.x + o[0] * 1.6, z: d.z + o[1] * 1.6 };
  const st = S.doors[d.id];
  if (st?.open || r.kind === 'stair') return steerTo(S, L, outside, mem);
  if (st?.locked) return { ...NO_INPUT };
  if (dist(P, inside) > 0.35) return steerTo(S, L, inside, mem);
  if (P.target?.kind === 'door' && P.target.id === d.id) return { ...NO_INPUT, use: true };
  return face(S, d.x, d.z, false);
}

// inside a room: a breadth-first search on a 0.25 m grid around the desks (agents only)
export function roomPath(S, L, goal) {
  const P = S.player, r = L.roomById(P.room);
  if (!r) return null;
  const cell = 0.25, pad = 0.33, boxes = furniture(S).map((b) => ({ x0: b.x0 - pad, x1: b.x1 + pad, z0: b.z0 - pad, z1: b.z1 + pad }));
  // allow leaving through the doorway: extend the grid a little past the door
  const x0 = r.x0 - 1.5, z0 = r.z0 - 1.5, nx = Math.ceil((r.x1 - r.x0 + 3) / cell), nz = Math.ceil((r.z1 - r.z0 + 3) / cell);
  const free = (i, j) => {
    const x = x0 + (i + 0.5) * cell, z = z0 + (j + 0.5) * cell;
    if (!L.walkable(P.floor, x, z)) return false;
    for (const b of boxes) if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return false;
    return L.walkable(P.floor, x + pad * 0.7, z) && L.walkable(P.floor, x - pad * 0.7, z) && L.walkable(P.floor, x, z + pad * 0.7) && L.walkable(P.floor, x, z - pad * 0.7);
  };
  const toCell = (p) => [Math.max(0, Math.min(nx - 1, Math.floor((p.x - x0) / cell))), Math.max(0, Math.min(nz - 1, Math.floor((p.z - z0) / cell)))];
  const [si, sj] = toCell(P), [gi, gj] = toCell(goal);
  const prev = new Map(), key = (i, j) => i * 10000 + j, q = [[si, sj]];
  prev.set(key(si, sj), null);
  let found = null, best = null, bd = 1e9;
  while (q.length) {
    const [i, j] = q.shift();
    const d = Math.abs(i - gi) + Math.abs(j - gj);
    if (d < bd) { bd = d; best = [i, j]; }
    if (i === gi && j === gj) { found = [i, j]; break; }
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= nx || b >= nz || prev.has(key(a, b)) || !free(a, b)) continue;
      prev.set(key(a, b), [i, j]); q.push([a, b]);
    }
  }
  let c = found || best;
  if (!c) return null;
  const cells = [];
  while (c) { cells.unshift(c); c = prev.get(key(c[0], c[1])); }
  const pts = cells.filter((_, k) => k % 3 === 2 || k === cells.length - 1).map(([i, j]) => ({ x: x0 + (i + 0.5) * cell, z: z0 + (j + 0.5) * cell }));
  if (found) pts.push({ x: goal.x, z: goal.z });
  return pts.length ? pts : null;
}
