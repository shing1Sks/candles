// Grid helpers: collision, line of sight, paths and distance fields.

// Push a circle out of every blocked tile it overlaps.
export function resolve(L, p, r, blocked) {
  for (let pass = 0; pass < 2; pass++) {
    const x0 = Math.floor(p.x - r), x1 = Math.floor(p.x + r), z0 = Math.floor(p.z - r), z1 = Math.floor(p.z + r);
    for (let tz = z0; tz <= z1; tz++) for (let tx = x0; tx <= x1; tx++) {
      if (!blocked(tx, tz)) continue;
      const nx = Math.max(tx, Math.min(p.x, tx + 1)), nz = Math.max(tz, Math.min(p.z, tz + 1));
      let dx = p.x - nx, dz = p.z - nz;
      const d = Math.hypot(dx, dz);
      if (d >= r) continue;
      if (d > 1e-6) { p.x = nx + (dx / d) * r; p.z = nz + (dz / d) * r; continue; }
      // centre inside the tile: leave by the shortest side
      const exits = [[p.x - tx, -1, 0], [tx + 1 - p.x, 1, 0], [p.z - tz, 0, -1], [tz + 1 - p.z, 0, 1]].sort((a, b) => a[0] - b[0]);
      const [, ex, ez] = exits[0];
      if (ex) p.x = ex < 0 ? tx - r : tx + 1 + r; else p.z = ez < 0 ? tz - r : tz + 1 + r;
    }
  }
  return p;
}

// Walk the tiles a segment crosses; false if any of them blocks sight.
export function los(L, x0, z0, x1, z1, blocked = L.sightBlocked) {
  let tx = Math.floor(x0), tz = Math.floor(z0);
  const ex = Math.floor(x1), ez = Math.floor(z1);
  const dx = x1 - x0, dz = z1 - z0;
  const sx = Math.sign(dx), sz = Math.sign(dz);
  const tdx = dx ? Math.abs(1 / dx) : Infinity, tdz = dz ? Math.abs(1 / dz) : Infinity;
  let mx = dx ? (sx > 0 ? tx + 1 - x0 : x0 - tx) * tdx : Infinity;
  let mz = dz ? (sz > 0 ? tz + 1 - z0 : z0 - tz) * tdz : Infinity;
  for (let i = 0; i < 200; i++) {
    if (blocked(tx, tz)) return false;
    if ((tx === ex && tz === ez) || Math.min(mx, mz) > 1) return true;
    if (mx < mz) { mx += tdx; tx += sx; } else { mz += tdz; tz += sz; }
  }
  return true;
}

// Can a circle of radius r slide straight from a to b?
export function clearLine(L, ax, az, bx, bz, r, blocked) {
  const d = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(d / 0.2)), k = r * 0.92;
  for (let i = 0; i <= n; i++) {
    const x = ax + ((bx - ax) * i) / n, z = az + ((bz - az) * i) / n;
    if (blocked(Math.floor(x - k), Math.floor(z - k)) || blocked(Math.floor(x + k), Math.floor(z - k)) ||
      blocked(Math.floor(x - k), Math.floor(z + k)) || blocked(Math.floor(x + k), Math.floor(z + k))) return false;
  }
  return true;
}

class Heap {
  constructor() { this.a = []; }
  push(k, v) {
    const a = this.a; a.push([k, v]);
    let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top[1];
  }
  get size() { return this.a.length; }
}

const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];

function neighbours(L, x, z, blocked, fn) {
  for (const [dx, dz, c] of DIRS) {
    const nx = x + dx, nz = z + dz;
    if (blocked(nx, nz)) continue;
    if (dx && dz && (blocked(x + dx, z) || blocked(x, z + dz))) continue; // no corner cutting
    fn(nx, nz, c);
  }
}

// Dijkstra from a tile: distance in metres to every reachable tile (Infinity elsewhere).
export function distField(L, sx, sz, blocked, extraCost) {
  const d = new Float32Array(L.w * L.h).fill(Infinity), H = new Heap();
  if (blocked(sx, sz)) return d;
  d[sz * L.w + sx] = 0; H.push(0, sz * L.w + sx);
  while (H.size) {
    const k = H.pop(), x = k % L.w, z = (k / L.w) | 0, dk = d[k];
    neighbours(L, x, z, blocked, (nx, nz, c) => {
      const nk = nz * L.w + nx, nd = dk + c * (extraCost ? extraCost(nx, nz) : 1);
      if (nd < d[nk]) { d[nk] = nd; H.push(nd, nk); }
    });
  }
  return d;
}

// A* between tiles; returns tile centres (excluding the start) or null.
export function findPath(L, sx, sz, gx, gz, blocked) {
  if (blocked(gx, gz)) return null;
  const W = L.w, start = sz * W + sx, goal = gz * W + gx;
  const g = new Float32Array(L.w * L.h).fill(Infinity), from = new Int32Array(L.w * L.h).fill(-1), H = new Heap();
  const hfn = (x, z) => { const dx = Math.abs(x - gx), dz = Math.abs(z - gz); return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz); };
  g[start] = 0; H.push(hfn(sx, sz), start);
  while (H.size) {
    const k = H.pop();
    if (k === goal) break;
    const x = k % W, z = (k / W) | 0;
    neighbours(L, x, z, blocked, (nx, nz, c) => {
      const nk = nz * W + nx, ng = g[k] + c;
      if (ng < g[nk]) { g[nk] = ng; from[nk] = k; H.push(ng + hfn(nx, nz), nk); }
    });
  }
  if (g[goal] === Infinity) return null;
  const out = [];
  for (let k = goal; k !== start; k = from[k]) out.push({ x: (k % W) + 0.5, z: ((k / W) | 0) + 0.5 });
  return out.reverse();
}

// Nearest tile that is not blocked, searching outward from (x, z).
export function nearestOpen(L, x, z, blocked) {
  if (!blocked(x, z)) return [x, z];
  for (let r = 1; r < 6; r++) {
    let best = null, bd = Infinity;
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r || blocked(x + dx, z + dz)) continue;
      const d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = [x + dx, z + dz]; }
    }
    if (best) return best;
  }
  return null;
}
