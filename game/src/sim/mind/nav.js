// Getting around, for any mind: plan a path (through doors: it opens them when it gets there), pick spots, find the
// far end of the gap the kid went into. Every random choice comes from the mind's own stream (mind.rand).
import { MON, VENT } from '../rules.js';
import { clearLine, findPath, nearestOpen } from '../grid.js';

const R = MON.radius;
export const tileOf = Math.floor;

// Head for (x, z) at `speed`: plan a path when the goal moves, then aim at the furthest point we can slide to.
// Writes mind.wantX / wantZ (m/s); returns the distance left.
// A goal inside a crawl space (under a bed, in a crack): it goes right up to it and reaches in (rules VENT.reachIn);
// the distance it returns counts as arrived (< 0.6) once you would be within its arm.
export function steer(G, mind, self, x, z, speed, dt) {
  const L = G.L, blocked = L.monBlocked;
  const crawlGoal = VENT.reachIn > 0 && blocked(tileOf(x), tileOf(z)) && L.crawl(tileOf(x), tileOf(z));
  const arm = (d) => (crawlGoal ? Math.max(0, d - VENT.reachIn + 0.55) : d);
  if (clearLine(L, self.x, self.z, x, z, R, blocked)) { mind.path = null; return aim(mind, self, x, z, speed); }
  mind.pathT -= dt;
  const moved = !mind.goal || Math.hypot(mind.goal.x - x, mind.goal.z - z) > 0.8;
  if (!mind.path || moved || mind.pathT <= 0) {
    const g = nearestOpen(L, tileOf(x), tileOf(z), blocked), s = nearestOpen(L, tileOf(self.x), tileOf(self.z), blocked);
    mind.path = g && s ? findPath(L, s[0], s[1], g[0], g[1], blocked, L.monCost) : null;
    mind.goal = { x, z }; mind.pathT = MON.repath;
    if (mind.path && mind.path.length) mind.path[mind.path.length - 1] = blocked(tileOf(x), tileOf(z)) ? mind.path[mind.path.length - 1] : { x, z };
    if (crawlGoal && mind.path) mind.path.push({ x, z }); // then into the wall's mouth, as far as its body goes
  }
  if (crawlGoal && (!mind.path || mind.path.length <= 1)) return arm(aim(mind, self, x, z, speed));
  if (!mind.path || !mind.path.length) return blocked(tileOf(x), tileOf(z)) ? 0 : aim(mind, self, x, z, speed * 0.3);
  while (mind.path.length > 1 && clearLine(L, self.x, self.z, mind.path[1].x, mind.path[1].z, R, blocked)) mind.path.shift();
  const p = mind.path[0];
  if (mind.path.length > 1 && Math.hypot(p.x - self.x, p.z - self.z) < 0.25) mind.path.shift();
  return arm(aim(mind, self, mind.path[0].x, mind.path[0].z, speed)) + (crawlGoal ? mind.path.length - 1 : 0);
}

export function aim(mind, self, x, z, speed) {
  const dx = x - self.x, dz = z - self.z, d = Math.hypot(dx, dz);
  if (d < 0.05) { mind.wantX = 0; mind.wantZ = 0; return d; }
  const s = Math.min(speed, d * 4);
  mind.wantX = (dx / d) * s; mind.wantZ = (dz / d) * s;
  return d;
}

// Move a point that fell inside a wall or furniture onto the nearest tile it can stand on.
export function snap(G, p) {
  const tx = tileOf(p.x), tz = tileOf(p.z);
  if (!G.L.monBlocked(tx, tz)) return p;
  const o = nearestOpen(G.L, tx, tz, G.L.monBlocked);
  return o ? { ...p, x: o[0] + 0.5, z: o[1] + 0.5 } : p;
}

// a floor tile within r of (x, z), in sight of it, that the monster can walk to
export function randomSpot(G, mind, x, z, r) {
  const L = G.L;
  ({ x, z } = snap(G, { x, z }));
  for (let i = 0; i < 20; i++) {
    const tx = tileOf(x + (mind.rand() * 2 - 1) * r), tz = tileOf(z + (mind.rand() * 2 - 1) * r);
    if (L.monSpot(tx, tz) && G.los(x, z, tx + 0.5, tz + 0.5)) return { x: tx + 0.5, z: tz + 0.5 };
  }
  return { x, z };
}

// The kid vanished near a crawl passage: the end it will come out of (usually the far one).
export function ambushSpot(G, mind, self, at) {
  const L = G.L;
  const probe = [[at.x, at.z], [at.x + at.vx * 0.4, at.z + at.vz * 0.4], [at.x + at.vx * 0.8, at.z + at.vz * 0.8]];
  for (const [x, z] of probe) {
    const p = L.passageAt(tileOf(x), tileOf(z));
    if (p < 0) continue;
    return passageExit(G, mind, self, p);
  }
  return null;
}
export function passageExit(G, mind, self, p) {
  const ex = G.L.passages[p].exits.map(([tx, tz]) => ({ x: tx + 0.5, z: tz + 0.5, d: Math.hypot(tx + 0.5 - self.x, tz + 0.5 - self.z) }));
  ex.sort((a, b) => b.d - a.d);
  return mind.rand() < 0.25 ? ex[ex.length - 1] : ex[0];
}

// A wardrobe near (x, z) worth a look (not one it looked in during the last 15 s).
export function wardrobeNear(G, mind, x, z, r) {
  let best = null, bd = r;
  for (const w of G.wardrobes) {
    const d = Math.hypot(w.fx - x, w.fz - z);
    if (d < bd && G.t - (mind.checked[w.id] ?? -99) > 15) { bd = d; best = w; }
  }
  return best;
}

// Where to walk with nothing to go on: often a lit candle, otherwise anywhere in the house (leaning toward the
// last thing it heard), so it never just camps the last candle.
export function pickGuard(G, mind, guardBias = 0) {
  const lit = G.candles.filter((c) => c.lit);
  if (!lit.length) return null;
  if (mind.rand() > 0.3 + 0.08 * lit.length + guardBias) {
    const spots = (G.L.roomSpots ||= []);
    if (!spots.length) for (let z = 1; z < G.L.h; z += 3) for (let x = 1; x < G.L.w; x += 3) if (G.L.monSpot(x, z)) spots.push({ x: x + 0.5, z: z + 0.5 });
    const h = mind.lastHint;
    let best = null, bs = -Infinity;
    for (let i = 0; i < 6; i++) {
      const s = spots[Math.floor(mind.rand() * spots.length)];
      const sc = (h ? -Math.hypot(s.x - h.x, s.z - h.z) * 0.3 : 0) + mind.rand() * 3;
      if (sc > bs) { bs = sc; best = s; }
    }
    mind.guardId = -1;
    return best;
  }
  const hint = mind.lastHint;
  const scored = lit.map((c) => {
    let s = mind.rand() * 4;
    if (hint) s -= Math.hypot(c.x - hint.x, c.z - hint.z) * 0.35;
    if (c.id === mind.guardId) s -= 6;
    return { c, s };
  });
  scored.sort((a, b) => b.s - a.s);
  const c = scored[0].c;
  mind.guardId = c.id;
  return randomSpot(G, mind, c.x, c.z, 2);
}

// the shut door straight ahead of where it wants to go, within reach (it presses use or bash on it)
export function doorAhead(G, self, wx, wz) {
  const w = Math.hypot(wx, wz);
  if (w < 0.3) return null;
  for (const d of G.doors) {
    if (d.open) continue;
    const dx = d.x - self.x, dz = d.z - self.z, dd = Math.hypot(dx, dz);
    if (dd < 1.35 && (dx * wx + dz * wz) / (dd * w) >= 0.6) return d;
  }
  return null;
}
