// THE SCHOOL AS SPACE: chunks generated on demand, plus the questions every module asks about them.
// Where can you stand (walkable), can you see from here to there (segmentClear), what can you bump
// into (wallsNear), which room is this, and how does the Headmaster walk somewhere (path).
// Door state lives in S.doors, so the same layout answers differently as doors open and close.
import { RULES } from '../rules.js';
import { genChunk } from './chunk.js';
import { edgeKey } from './ports.js';

const SIDE_VEC = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
const T = 0.1; // wall thickness used for collision boxes
const inR = (x, z, r) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;

export class Layout {
  constructor(seed, S) {
    this.seed = seed;
    this.S = S;
    this.cache = new Map();     // `${key}@${epoch}` -> chunk
    this.walls = new Map();     // `${key}@${epoch}` -> static wall boxes
    this.generated = new Set(); // chunk keys seen so far, in order
    this.onGenerate = null;     // hook(chunk) the first time a key@epoch is generated
  }

  chunkIJ(x, z) { const C = RULES.layout.chunk; return [Math.floor(x / C), Math.floor(z / C)]; }

  chunk(floor, i, j) {
    const key = `${floor}:${i}:${j}`, epoch = this.S.layout.epochs[key] ?? 0, ck = `${key}@${epoch}`;
    let c = this.cache.get(ck);
    if (!c) {
      c = genChunk(this.seed, floor, i, j, epoch);
      this.cache.set(ck, c);
      this.generated.add(key);
      this.onGenerate?.(c);
    }
    return c;
  }

  chunkAt(floor, x, z) { const [i, j] = this.chunkIJ(x, z); return this.chunk(floor, i, j); }

  chunkByKey(key) { const [f, i, j] = key.split(':').map(Number); return this.chunk(f, i, j); }

  doorOpen(room) {
    if (room.kind === 'stair') return true;
    return !!this.S.doors[room.door.id]?.open;
  }

  // the doorway between corridor wall and room wall
  doorGap(room) {
    const d = room.door, [vx, vz] = SIDE_VEC[d.side], ins = RULES.layout.inset, hw = d.w / 2;
    if (vx) { const xa = d.x, xb = d.x + vx * ins; return { x0: Math.min(xa, xb), x1: Math.max(xa, xb), z0: d.z - hw, z1: d.z + hw }; }
    const za = d.z, zb = d.z + vz * ins; return { z0: Math.min(za, zb), z1: Math.max(za, zb), x0: d.x - hw, x1: d.x + hw };
  }

  walkable(floor, x, z) {
    const c = this.chunkAt(floor, x, z);
    for (const k of c.corridors) if (inR(x, z, k)) return true;
    for (const r of c.rooms) {
      const open = this.doorOpen(r);
      if (inR(x, z, r)) return open || this.S.player.room === r.id;
      if (open && inR(x, z, this.doorGap(r))) return true;
    }
    return false;
  }

  segmentClear(floor, x0, z0, x1, z1, step = 0.2) {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(len / step));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      if (!this.walkable(floor, x0 + (x1 - x0) * t, z0 + (z1 - z0) * t)) return false;
    }
    return true;
  }

  roomAt(floor, x, z) {
    const c = this.chunkAt(floor, x, z);
    return c.rooms.find((r) => inR(x, z, r)) || null;
  }

  roomById(id) {
    const key = id.split('@')[0], c = this.chunkByKey(key);
    return c.rooms.find((r) => r.id === id || r.door.id === id) || null;
  }

  doorById(id) {
    const key = id.split('@')[0], c = this.chunkByKey(key);
    const room = c.rooms.find((r) => r.door.id === id);
    return room ? { door: room.door, room, chunk: c } : null;
  }

  // A switchback stairwell. (u, v): u runs along the door wall, v inward from it. Flight 1 is the half
  // with the ground-floor door (u < s/2), flight 2 the half with the upper door. The bottom landing is
  // v < 1, the flights run v in [1, s-2], the half-landing is the far strip v >= s-2.
  stairUV(room, x, z) {
    const d = room.door.side, s = room.x1 - room.x0;
    if (d === 'N') return { u: x - room.x0, v: z - room.z0, s };
    if (d === 'S') return { u: x - room.x0, v: room.z1 - z, s };
    if (d === 'W') return { u: z - room.z0, v: x - room.x0, s };
    return { u: z - room.z0, v: room.x1 - x, s };
  }

  stairHeight(room, x, z) {
    const H = RULES.layout.floorH, { u, v, s } = this.stairUV(room, x, z);
    const run = s - 3, t = Math.max(0, Math.min(1, (v - 1) / run));
    // the half the room's ground door is on is flight 1 (the chunk puts it at u = s/4 or 3s/4 by floor)
    return u < s / 2 ? (H / 2) * t : H / 2 + (H / 2) * (1 - t);
  }

  // static walls of one chunk: corridor boundaries (gaps at arms and doors), room boundaries
  // (gap at the door), doorway side walls, lockers. Door leaves are added live in wallsNear.
  staticWalls(c) {
    const ck = `${c.key}@${c.epoch}`;
    if (this.walls.has(ck)) return this.walls.get(ck);
    const out = [];
    const C = RULES.layout.chunk, h = RULES.layout.corridorW / 2, cx = c.x0 + C / 2, cz = c.z0 + C / 2;
    // a wall segment along x (at z) from xa to xb, or along z (at x) from za to zb, minus gaps
    let kind = 'corr'; // tags each wall for the renderer: corr | room | tunnel | divider
    const segX = (z, xa, xb, gaps = []) => cut(xa, xb, gaps).forEach(([a, b]) => out.push({ x0: a, x1: b, z0: z - T / 2, z1: z + T / 2, kind, axis: 'x' }));
    const segZ = (x, za, zb, gaps = []) => cut(za, zb, gaps).forEach(([a, b]) => out.push({ z0: a, z1: b, x0: x - T / 2, x1: x + T / 2, kind, axis: 'z' }));
    // doors cut gaps into the corridor wall they face
    const doorGapsOn = (axis, pos) => c.rooms.filter((r) => {
      const d = r.door, [vx, vz] = SIDE_VEC[d.side];
      return axis === 'x' ? vx && Math.abs(d.x + vx * RULES.layout.inset - pos) < 1e-6 : vz && Math.abs(d.z + vz * RULES.layout.inset - pos) < 1e-6;
    }).map((r) => (axis === 'x' ? [r.door.z - r.door.w / 2, r.door.z + r.door.w / 2] : [r.door.x - r.door.w / 2, r.door.x + r.door.w / 2]));
    // centre square: walls on closed sides
    if (!c.ports.N) segX(cz - h, cx - h, cx + h, doorGapsOn('z', cz - h));
    if (!c.ports.S) segX(cz + h, cx - h, cx + h, doorGapsOn('z', cz + h));
    if (!c.ports.W) segZ(cx - h, cz - h, cz + h, doorGapsOn('x', cx - h));
    if (!c.ports.E) segZ(cx + h, cz - h, cz + h, doorGapsOn('x', cx + h));
    // arms: two side walls each
    if (c.ports.N) { segZ(cx - h, c.z0, cz - h, doorGapsOn('x', cx - h)); segZ(cx + h, c.z0, cz - h, doorGapsOn('x', cx + h)); }
    if (c.ports.S) { segZ(cx - h, cz + h, c.z0 + C, doorGapsOn('x', cx - h)); segZ(cx + h, cz + h, c.z0 + C, doorGapsOn('x', cx + h)); }
    if (c.ports.W) { segX(cz - h, c.x0, cx - h, doorGapsOn('z', cz - h)); segX(cz + h, c.x0, cx - h, doorGapsOn('z', cz + h)); }
    if (c.ports.E) { segX(cz - h, cx + h, c.x0 + C, doorGapsOn('z', cz - h)); segX(cz + h, cx + h, c.x0 + C, doorGapsOn('z', cz + h)); }
    // rooms: four walls, a gap where the door is; the doorway's two short side walls
    for (const r of c.rooms) {
      const d = r.door, hw = d.w / 2;
      kind = 'room';
      segX(r.z0, r.x0, r.x1, d.side === 'N' ? [[d.x - hw, d.x + hw]] : []);
      segX(r.z1, r.x0, r.x1, d.side === 'S' ? [[d.x - hw, d.x + hw]] : []);
      segZ(r.x0, r.z0, r.z1, d.side === 'W' ? [[d.z - hw, d.z + hw]] : []);
      segZ(r.x1, r.z0, r.z1, d.side === 'E' ? [[d.z - hw, d.z + hw]] : []);
      const g = this.doorGap(r);
      kind = 'tunnel';
      if (d.side === 'N' || d.side === 'S') { segZ(g.x0, g.z0, g.z1); segZ(g.x1, g.z0, g.z1); }
      else { segX(g.z0, g.x0, g.x1); segX(g.z1, g.x0, g.x1); }
    }
    // stairwells: a dividing wall between the two flights, from the door wall to the half-landing
    for (const r of c.rooms) {
      if (r.kind !== 'stair') continue;
      kind = 'divider';
      const s = r.x1 - r.x0, d = r.door.side, a = s / 2;
      if (d === 'N') segZ(r.x0 + a, r.z0, r.z0 + s - 2);
      else if (d === 'S') segZ(r.x0 + a, r.z1 - s + 2, r.z1);
      else if (d === 'W') segX(r.z0 + a, r.x0, r.x0 + s - 2);
      else segX(r.z0 + a, r.x1 - s + 2, r.x1);
    }
    for (const k of c.lockers) out.push({ x0: k.x0, x1: k.x1, z0: k.z0, z1: k.z1, locker: k.id });
    this.walls.set(ck, out);
    return out;
  }

  // every box within r of (x, z): static walls of the chunks around, plus closed door leaves
  wallsNear(floor, x, z, r) {
    const C = RULES.layout.chunk, seen = new Set(), out = [];
    for (const [px, pz] of [[x - r, z - r], [x + r, z - r], [x - r, z + r], [x + r, z + r], [x, z]]) {
      const [i, j] = this.chunkIJ(px, pz), k = `${i},${j}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const c = this.chunk(floor, i, j);
      for (const w of this.staticWalls(c)) if (w.x1 >= x - r && w.x0 <= x + r && w.z1 >= z - r && w.z0 <= z + r) out.push(w);
      for (const rm of c.rooms) {
        if (this.doorOpen(rm)) continue;
        const d = rm.door, hw = d.w / 2;
        const leaf = d.side === 'N' || d.side === 'S'
          ? { x0: d.x - hw, x1: d.x + hw, z0: d.z - T / 2, z1: d.z + T / 2, door: d.id }
          : { z0: d.z - hw, z1: d.z + hw, x0: d.x - T / 2, x1: d.x + T / 2, door: d.id };
        if (leaf.x1 >= x - r && leaf.x0 <= x + r && leaf.z1 >= z - r && leaf.z0 <= z + r) out.push(leaf);
      }
    }
    return out;
  }

  // corridor nav graph over the chunks generated so far on this floor
  nav(floor) {
    const nodes = new Map(), adj = new Map();
    const node = (id, x, z) => { if (!nodes.has(id)) { nodes.set(id, { x, z }); adj.set(id, []); } return id; };
    const link = (a, b) => { adj.get(a).push(b); adj.get(b).push(a); };
    const C = RULES.layout.chunk;
    for (const key of this.generated) {
      const [f, i, j] = key.split(':').map(Number);
      if (f !== floor) continue;
      const c = this.chunk(f, i, j), cx = c.x0 + C / 2, cz = c.z0 + C / 2;
      const centre = node(`${key}:c`, cx, cz);
      const ends = {};
      for (const s of ['N', 'S', 'E', 'W']) {
        if (!c.ports[s]) continue;
        const [vx, vz] = SIDE_VEC[s];
        ends[s] = node(`e:${floor}:${edgeKey(floor, i, j, s).join(':')}`, cx + vx * C / 2, cz + vz * C / 2);
        link(centre, ends[s]);
      }
      for (const r of c.rooms) {
        const d = r.door, [vx, vz] = SIDE_VEC[d.side], o = RULES.layout.inset + 0.9;
        const id = node(`${d.id}:o`, d.x + vx * o, d.z + vz * o);
        link(id, centre);
        // the arm this door opens onto: whichever end is on the far side of the centre
        const arm = Object.entries(ends).find(([s]) => {
          const [ax, az] = SIDE_VEC[s];
          return (d.x + vx * o - cx) * ax + (d.z + vz * o - cz) * az > 1.7;
        });
        if (arm) link(id, arm[1]);
      }
    }
    return { nodes, adj };
  }

  // A* from a point to a point via the nav graph; returns [from, ...waypoints, to] or null
  path(floor, from, to) {
    const { nodes, adj } = this.nav(floor);
    const nearest = (p) => {
      let best = null, bd = Infinity;
      for (const [id, n] of nodes) {
        const d = (n.x - p.x) ** 2 + (n.z - p.z) ** 2;
        if (d < bd && this.segmentClear(floor, p.x, p.z, n.x, n.z)) { bd = d; best = id; }
      }
      return best;
    };
    const a = nearest(from), b = nearest(to);
    if (!a || !b) return null;
    const dist = (u, v) => Math.hypot(nodes.get(u).x - nodes.get(v).x, nodes.get(u).z - nodes.get(v).z);
    const g = new Map([[a, 0]]), prev = new Map(), openSet = new Set([a]);
    while (openSet.size) {
      let cur = null, cf = Infinity;
      for (const id of openSet) { const f = g.get(id) + dist(id, b); if (f < cf) { cf = f; cur = id; } }
      if (cur === b) break;
      openSet.delete(cur);
      for (const nb of adj.get(cur)) {
        const ng = g.get(cur) + dist(cur, nb);
        if (ng < (g.get(nb) ?? Infinity)) { g.set(nb, ng); prev.set(nb, cur); openSet.add(nb); }
      }
    }
    if (!g.has(b)) return null;
    const ids = [b];
    while (ids[0] !== a) ids.unshift(prev.get(ids[0]));
    return [{ x: from.x, z: from.z }, ...ids.map((id) => ({ ...nodes.get(id) })), { x: to.x, z: to.z }];
  }
}

// subtract gap intervals from [a, b]
function cut(a, b, gaps) {
  let segs = [[a, b]];
  for (const [g0, g1] of gaps) {
    const next = [];
    for (const [s0, s1] of segs) {
      if (g1 <= s0 || g0 >= s1) { next.push([s0, s1]); continue; }
      if (g0 > s0) next.push([s0, g0]);
      if (g1 < s1) next.push([g1, s1]);
    }
    segs = next;
  }
  return segs.filter(([s0, s1]) => s1 - s0 > 1e-6);
}
