// What the mechanics cases are built from: setting a moment up, the kid's input over time, checks, and the house's
// geometry (where a kid or the monster can stand, what is in reach, what is in sight), all from the level itself.
import { parseLevel, T, ROOMS } from '../../src/sim/level.js';
import { los } from '../../src/sim/grid.js';

export const L = parseLevel();

// ---------------- setting up, input, checking
export const place = (G, who, x, z, extra = {}) => Object.assign(who === 'kid' ? G.kid : G.monster, { x, z, vx: 0, vz: 0, ...extra });
export const wake = (G, x, z, hx = 1, hz = 0) => { place(G, 'mon', x, z, { hx, hz, awake: true }); G.mind.mode = 'patrol'; };
export const press = (b, at = 0) => (t) => (t < at - 1e-9 || t > at + 1e-9 ? {} : { [b]: true });
export const hold = (inp) => () => inp;
export const maxOf = (s, k, v) => { s[k] = Math.max(s[k] ?? -Infinity, v); };
export const minOf = (s, k, v) => { s[k] = Math.min(s[k] ?? Infinity, v); };
export const fail = (ok, why) => (ok ? null : why);
export const r2 = (v) => (v == null ? '-' : Number(v).toFixed(2));
export const kidWall = (G, s) => { if (G.kidBlocked(Math.floor(G.kid.x), Math.floor(G.kid.z))) s.inWall = (s.inWall || 0) + 1; };
export const at = (t, when) => Math.abs(t - when) < 1e-9;
export const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
// a stick toward (x, z), easing off over the last 0.3 m (the kid steers by where it is, as a player does)
export const toward = (G, x, z) => { const dx = x - G.kid.x, dz = z - G.kid.z, d = Math.hypot(dx, dz), m = Math.min(1, d / 0.3) / (d || 1); return { mx: dx * m, mz: dz * m }; };
// the stick along a direction as the input's keys: { mx, mz }
export const stick = ([dx, dz], k = 1) => ({ mx: dx * k, mz: dz * k });

// ---------------- the house's geometry
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// what blocks whom, with each door as the level has it unless open(id) says otherwise
const withDoors = (base) => (open = (id) => L.doors[id].open) => (x, z) => { const d = L.doorAt(x, z); return base(x, z) || (d >= 0 && !open(d)); };
export const kidB = withDoors(L.kidBlocked), monB = withDoors(L.monBlocked), sightB = withDoors(L.sightBlocked);
export const allOpen = () => true, allShut = () => false;
export const floor = (x, z) => L.at(Math.floor(x), Math.floor(z)) === T.FLOOR && L.doorAt(Math.floor(x), Math.floor(z)) < 0;
export const crawlAt = (x, z) => L.crawl(Math.floor(x), Math.floor(z));
// how far (x, z) is from the nearest blocked tile (0 inside one)
export function clearance(x, z, blocked) {
  let best = Infinity;
  for (let tz = Math.floor(z) - 1; tz <= Math.floor(z) + 1; tz++) for (let tx = Math.floor(x) - 1; tx <= Math.floor(x) + 1; tx++) {
    if (blocked(tx, tz)) best = Math.min(best, Math.hypot(x - clamp(x, tx, tx + 1), z - clamp(z, tz, tz + 1)));
  }
  return best;
}
export const fits = (x, z, r, blocked) => clearance(x, z, blocked) >= r - 1e-6;
// a circle of radius r slides straight from a to b
export function clearSeg(ax, az, bx, bz, r, blocked) {
  const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.05));
  for (let i = 0; i <= n; i++) if (!fits(ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n, r, blocked)) return false;
  return true;
}
export const segAll = (ax, az, bx, bz, ok) => { const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.05)); for (let i = 0; i <= n; i++) if (!ok(ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n)) return false; return true; };
export const sees = (ax, az, bx, bz, open) => los(L, ax, az, bx, bz, sightB(open));
// how far a point is from a segment
export function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l = dx * dx + dz * dz, t = l ? clamp(((px - ax) * dx + (pz - az) * dz) / l, 0, 1) : 0;
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
}
export const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const DIRS8 = [...DIRS4, ...[[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([x, z]) => [x * Math.SQRT1_2, z * Math.SQRT1_2])];
export const dirName = ([dx, dz]) => (Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'east' : 'west') : dz > 0 ? 'south' : 'north');

// the six rooms and the bottom corridor; each area's tiles nearest its middle first
export const AREAS = [
  ...ROOMS.map(([name, x0, z0, x1, z1], i) => ({ name, i, cx: (x0 + x1 + 1) / 2, cz: (z0 + z1 + 1) / 2 })),
  { name: 'corridor', i: -1, cx: 18.5, cz: 20.5 },
];
export function tilesOf(a) {
  const out = [];
  for (let z = 0; z < L.h; z++) for (let x = 0; x < L.w; x++) {
    if (L.room[z * L.w + x] !== a.i || (a.i < 0 && z < 20) || !floor(x + 0.5, z + 0.5)) continue;
    out.push([x + 0.5, z + 0.5]);
  }
  return out.sort((p, q) => Math.hypot(p[0] - a.cx, p[1] - a.cz) - Math.hypot(q[0] - a.cx, q[1] - a.cz) || p[0] - q[0] || p[1] - q[1]);
}

// the monster parked in the corridor corner furthest from (x, z), awake, so the case is about the kid alone
const CORNERS = [[1.5, 1.5], [35.5, 1.5], [1.5, 20.5], [35.5, 20.5]];
export const farCorner = (x, z) => CORNERS.reduce((b, c) => (Math.hypot(c[0] - x, c[1] - z) > Math.hypot(b[0] - x, b[1] - z) ? c : b));
export function far(G, x, z) {
  const [cx, cz] = farCorner(x, z), n = Math.hypot(18.5 - cx, 11.5 - cz);
  wake(G, cx, cz, (18.5 - cx) / n, (11.5 - cz) / n);
}
