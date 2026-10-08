// ONE CHUNK of one floor (24 x 24 m), generated purely from (seed, floor, i, j, epoch).
// Corridors: a 3.4 m centre square plus an arm to every open port. The four quadrants beside the
// arms hold rooms (classroom, cupboard, or a stairwell on lattice crosses), each with one door onto
// an adjacent arm. Lights run down the arms; lockers line one wall.
// The epoch changes what's in the quadrants, never the ports, so a forgotten chunk still connects.
import { hash32, makeRng } from '../rng.js';
import { RULES } from '../rules.js';
import { portOpen, SIDES, OPPOSITE } from './ports.js';
import { wingOf, WINGS } from './wings.js';

const mod = (a, n) => ((a % n) + n) % n;

// Quadrants: 0 NW, 1 NE, 2 SW, 3 SE. For each: which arm lies along which of its sides.
// adj[side of the quadrant] = the corridor arm on that side
const QUADS = [
  { name: 'NW', adj: { E: 'N', S: 'W' } },
  { name: 'NE', adj: { W: 'N', S: 'E' } },
  { name: 'SW', adj: { E: 'S', N: 'W' } },
  { name: 'SE', adj: { W: 'S', N: 'E' } },
];

export function isStairColumn(seed, i, j) {
  return mod(i, 3) === 0 && mod(j, 2) === 0 && hash32(seed, 'stair', i, j) % RULES.layout.stairMod === 0;
}

export function genChunk(seed, floor, i, j, epoch = 0) {
  const L = RULES.layout, C = L.chunk, h = L.corridorW / 2, inset = L.inset;
  const x0 = i * C, z0 = j * C, cx = x0 + C / 2, cz = z0 + C / 2;
  const key = `${floor}:${i}:${j}`;
  const rng = makeRng(hash32(seed, 'chunk', floor, i, j, epoch));
  const ports = {};
  for (const s of SIDES) ports[s] = portOpen(seed, floor, i, j, s);

  // corridors
  const corridors = [{ x0: cx - h, z0: cz - h, x1: cx + h, z1: cz + h, arm: null }];
  if (ports.N) corridors.push({ x0: cx - h, z0, x1: cx + h, z1: cz - h, arm: 'N' });
  if (ports.S) corridors.push({ x0: cx - h, z0: cz + h, x1: cx + h, z1: z0 + C, arm: 'S' });
  if (ports.W) corridors.push({ x0, z0: cz - h, x1: cx - h, z1: cz + h, arm: 'W' });
  if (ports.E) corridors.push({ x0: cx + h, z0: cz - h, x1: x0 + C, z1: cz + h, arm: 'E' });

  const open = SIDES.filter((s) => ports[s]);
  const deadEnd = open.length === 1
    ? (() => { const s = OPPOSITE[open[0]], d = { N: [cx, cz - h], S: [cx, cz + h], E: [cx + h, cz], W: [cx - h, cz] }[s]; return { side: s, x: d[0], z: d[1] }; })()
    : null;

  // stairs: lattice crosses only, same quadrant and step count on every floor
  const stairCol = isStairColumn(seed, i, j);
  const stairQ = stairCol ? hash32(seed, 'stairq', i, j) % 4 : -1;

  // the inner corner of each quadrant (where it meets the centre square)
  const corner = [[cx - h - inset, cz - h - inset], [cx + h + inset, cz - h - inset], [cx - h - inset, cz + h + inset], [cx + h + inset, cz + h + inset]];
  const dirX = [-1, 1, -1, 1], dirZ = [-1, -1, 1, 1]; // which way each quadrant extends from its corner

  const rooms = [];
  QUADS.forEach((q, qi) => {
    const sides = Object.keys(q.adj).filter((s) => ports[q.adj[s]]);
    const isStair = qi === stairQ;
    // a stair quadrant always faces the same arm on both floors (lattice crosses have all four)
    const doorSide = isStair ? Object.keys(q.adj)[hash32(seed, 'stairside', i, j) % 2] : (sides.length ? rng.pick(sides) : null);
    if (!doorSide) return;
    let kind = 'stair', kit = null;
    if (!isStair) {
      kind = rng.weighted(L.roomP);
      kit = kind === 'classroom' ? rng.weighted(L.kitP) : 'cupboard';
      if (kit === 'infants' && floor !== 0) kit = 'standard';
    }
    const sq = C / 2 - h - inset - 0.3; // a stairwell fills its quadrant, short of an outer wall
    const [along, depth] = isStair ? [sq, sq] : L.kits[kit];
    // the door wall is the side facing doorSide; "along" runs along that wall, "depth" away from it
    const vertical = doorSide === 'E' || doorSide === 'W'; // door wall runs north-south
    const w = vertical ? depth : along, d = vertical ? along : depth;
    const [kx, kz] = corner[qi];
    const rx0 = dirX[qi] > 0 ? kx : kx - w, rx1 = rx0 + w;
    const rz0 = dirZ[qi] > 0 ? kz : kz - d, rz1 = rz0 + d;
    const id = `${key}@${epoch}:q${qi}`;
    const door = { id: `${id}:d`, side: doorSide, w: 1.2, x: 0, z: 0 };
    // door position along the wall; a stair has its ground door at one end, its upper door at the other
    const u = isStair ? (floor === 0 ? 0.25 : 0.75) : 0.5;
    if (vertical) { door.x = doorSide === 'W' ? rx0 : rx1; door.z = rz0 + (rz1 - rz0) * u; }
    else { door.z = doorSide === 'N' ? rz0 : rz1; door.x = rx0 + (rx1 - rx0) * u; }
    rooms.push({ id, kind, kit, quadrant: qi, x0: rx0, z0: rz0, x1: rx1, z1: rz1, door });
  });

  const stair = stairCol
    ? (() => {
      const r = rooms.find((x) => x.quadrant === stairQ);
      return { roomId: r.id, quadrant: stairQ, steps: hash32(seed, 'steps', i, j) % L.thirteenEvery === 0 ? 13 : 12, dir: OPPOSITE[r.door.side] };
    })()
    : null;

  // ceiling tubes: the centre, then every lightEvery metres down each open arm
  const lights = [{ id: `${key}:L0`, x: cx, z: cz }];
  for (const s of open) {
    const [dx, dz] = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[s];
    for (let n = 1, dist = L.lightEvery; dist < C / 2 - 0.6; n++, dist += L.lightEvery) lights.push({ id: `${key}:L${s}${n}`, x: cx + dx * dist, z: cz + dz * dist });
  }

  // lockers: on one wall of an arm, skipping a metre either side of any door on that wall. The wing
  // decides how many arms have them, and whether it's the whole bank or a short run of a few
  const wing = wingOf(seed, floor, i, j), W = WINGS[wing];
  const lockers = [];
  for (const k of corridors) {
    if (!k.arm) continue;
    const ns = k.arm === 'N' || k.arm === 'S';
    const wallSide = rng.chance(0.5) ? -1 : 1; // west/north wall or east/south wall
    const hk = (...a) => hash32(seed, 'lockers', key, epoch, k.arm, ...a);
    if (hk() % 100 >= W.lockerP * 100) continue;
    const wallPos = ns ? (wallSide < 0 ? k.x0 : k.x1) : (wallSide < 0 ? k.z0 : k.z1);
    let a0 = ns ? k.z0 : k.x0, a1 = ns ? k.z1 : k.x1;
    if (hk('partial') % 100 < W.partialP * 100) { // a short run: 4 to 9 lockers somewhere along the arm
      const n = 4 + (hk('n') % 6), room = a1 - a0 - 1.6 - n * L.lockerW;
      if (room > 0) { a0 += (hk('at') % 100) / 100 * room; a1 = a0 + 1.6 + n * L.lockerW + 0.01; }
    }
    for (let a = a0 + 0.8; a + L.lockerW < a1 - 0.8; a += L.lockerW) {
      const mid = a + L.lockerW / 2;
      const nearDoor = rooms.some((r) => (ns ? Math.abs(r.door.x - wallPos) < inset + 0.01 && Math.abs(r.door.z - mid) < 1.0 : Math.abs(r.door.z - wallPos) < inset + 0.01 && Math.abs(r.door.x - mid) < 1.0));
      if (nearDoor) continue;
      const box = ns
        ? { x0: wallSide < 0 ? wallPos : wallPos - L.lockerD, x1: wallSide < 0 ? wallPos + L.lockerD : wallPos, z0: a, z1: a + L.lockerW }
        : { z0: wallSide < 0 ? wallPos : wallPos - L.lockerD, z1: wallSide < 0 ? wallPos + L.lockerD : wallPos, x0: a, x1: a + L.lockerW };
      lockers.push({ id: `${key}:K${k.arm}${lockers.length}`, ...box, face: ns ? (wallSide < 0 ? 'E' : 'W') : (wallSide < 0 ? 'S' : 'N') });
    }
  }

  return { key, floor, i, j, epoch, wing, x0, z0, ports, corridors, rooms, deadEnd, lights, lockers, stair };
}
