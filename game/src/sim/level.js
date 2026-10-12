// The maze. One character = one 1 m tile. World x = column, world z = row.
//   #  wall               .  floor
//   =  vent duct          c  crack in a wall (kid only)
//   t  table              b  bed or crib (kid crawls under)
//   x  low furniture      u  tall furniture
//   w  wardrobe (tall; the kid can hide inside)
//   d  door, open         D  door, shut  (two tiles side by side make one double door)
//   C  candle             K  kid start         M  monster start
import { VENT } from './rules.js';

export const MAP = [
  '#####################################',
  '#.............=========............M#',
  '#.............####=####.............#',
  '#..###############=###########c###..#',
  '#..#w......xC#xx...xxx.#..xxx...x#..#',
  '#..#.........c.........c.........#..#',
  '#..d...bb....#.........#...ttt...#..#',
  '#..d...bb....#....uu...#u..ttt...#..#',
  '#..#...bb....#.........#.........d..#',
  '#..#.........D.........#.........d..#',
  '#..#.x.......D........C#C.......w#..#',
  '#..#######dd###dd#############DD##..#',
  '#..#C........#......x.x#.x..x....#..#',
  '#..#.........d....K....d....x..x.#..#',
  '#..#...bb....d.........d..u.....u#..#',
  '#..D...bb....#...ttt...#..u..uuu.#..#',
  '#..D...bb....#...ttt...#..u......d..#',
  '#..#.........#.........#......x..d..#',
  '#..#x.x.....w#C.......x#C........#..#',
  '#..#####c###########dd###c########..#',
  '#...................................#',
  '#u..................................#',
  '#####################################',
];

// Rooms, for floors and furniture looks: [name, x0, z0, x1, z1] in tiles (inclusive).
export const ROOMS = [
  ['nursery', 4, 4, 12, 10],
  ['bathroom', 14, 4, 22, 10],
  ['kitchen', 24, 4, 32, 10],
  ['bedroom', 4, 12, 12, 18],
  ['playroom', 14, 12, 22, 18],
  ['cellar', 24, 12, 32, 18],
];

// Things on the floor. Creaky boards and squeaky toys give you away unless you creep; toys you can pick up
// and throw make a noise where they land, and the monster goes to look.
export const CREAKS = [[8, 1], [25, 1], [1, 10], [35, 12], [10, 21], [28, 20], [6, 9], [17, 9], [27, 9], [9, 13], [20, 17], [29, 13]];
export const SQUEAKS = [
  { x: 20.5, z: 8.4, kind: 'duck' }, { x: 20.6, z: 14.4, kind: 'bear' }, { x: 9.5, z: 9.3, kind: 'rattle' },
  { x: 2.0, z: 13.5, kind: 'duck' }, { x: 26.5, z: 8.6, kind: 'bear' },
];
export const ITEMS = [
  { x: 15.4, z: 13.6, kind: 'block' }, { x: 10.7, z: 6.4, kind: 'block' }, { x: 16.4, z: 17.2, kind: 'ball' },
  { x: 29.5, z: 9.2, kind: 'can' }, { x: 27.6, z: 17.4, kind: 'bottle' }, { x: 6.0, z: 12.7, kind: 'car' }, { x: 18.5, z: 20.6, kind: 'ball' },
];

export const T = { FLOOR: 0, WALL: 1, DUCT: 2, CRACK: 3, TABLE: 4, BED: 5, LOW: 6, TALL: 7 };
const CODE = { '#': T.WALL, '=': T.DUCT, c: T.CRACK, t: T.TABLE, b: T.BED, x: T.LOW, u: T.TALL, w: T.TALL };

const KID_BLOCK = new Set([T.WALL, T.LOW, T.TALL]);
const MON_BLOCK = new Set([T.WALL, T.LOW, T.TALL, T.DUCT, T.CRACK, T.TABLE, T.BED]);
// what an arm reaching into a crawl space goes through (it can't reach through a wall)
const ARM_BLOCK = new Set([T.WALL, T.LOW, T.TALL]);
const SIGHT_BLOCK = new Set([T.WALL, T.TALL, T.DUCT, T.CRACK]);
const CRAWL = new Set([T.DUCT, T.CRACK, T.TABLE, T.BED]);

export function parseLevel(rows = MAP) {
  const h = rows.length, w = rows[0].length;
  const tiles = new Uint8Array(w * h), room = new Int8Array(w * h).fill(-1);
  const candles = [], doorTiles = [], wardrobes = [];
  let kid, monster;
  for (let z = 0; z < h; z++) {
    if (rows[z].length !== w) throw new Error(`row ${z} is ${rows[z].length} wide, expected ${w}`);
    for (let x = 0; x < w; x++) {
      const ch = rows[z][x];
      tiles[z * w + x] = CODE[ch] ?? T.FLOOR;
      if (ch === 'C') candles.push({ tx: x, tz: z });
      if (ch === 'd' || ch === 'D') doorTiles.push({ x, z, open: ch === 'd' });
      if (ch === 'w') wardrobes.push({ tx: x, tz: z });
      if (ch === 'K') kid = { x: x + 0.5, z: z + 0.5 };
      if (ch === 'M') monster = { x: x + 0.5, z: z + 0.5 };
    }
  }
  ROOMS.forEach(([, x0, z0, x1, z1], i) => {
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) room[z * w + x] = i;
  });
  const L = { w, h, tiles, room, kid, monster, candles: [] };
  L.at = (x, z) => (x < 0 || z < 0 || x >= w || z >= h ? T.WALL : tiles[z * w + x]);
  L.kidBlocked = (x, z) => KID_BLOCK.has(L.at(x, z));
  // the monster squeezes into the vent duct (VENT.monsterIn: read when the house is parsed)
  const monIn = VENT.monsterIn;
  L.monBlocked = (x, z) => { const t = L.at(x, z); return MON_BLOCK.has(t) && !(monIn && t === T.DUCT); };
  L.duct = (x, z) => L.at(x, z) === T.DUCT;
  // walking cost for its paths: the duct is slow going
  L.monCost = monIn ? (x, z) => (L.at(x, z) === T.DUCT ? 3.0 / VENT.monCrawl : 1) : null;
  // a spot to stand, patrol or start on: not inside the duct
  L.monSpot = (x, z) => !L.monBlocked(x, z) && L.at(x, z) !== T.DUCT;
  L.armBlocked = (x, z) => ARM_BLOCK.has(L.at(x, z));
  L.sightBlocked = (x, z) => SIGHT_BLOCK.has(L.at(x, z));
  L.crawl = (x, z) => CRAWL.has(L.at(x, z));
  // A candle sits in the corner of its tile, pushed toward the walls around it.
  L.candles = candles.map(({ tx, tz }, id) => {
    let ox = 0, oz = 0;
    if (L.at(tx - 1, tz) === T.WALL) ox -= 1;
    if (L.at(tx + 1, tz) === T.WALL) ox += 1;
    if (L.at(tx, tz - 1) === T.WALL) oz -= 1;
    if (L.at(tx, tz + 1) === T.WALL) oz += 1;
    return { id, tx, tz, x: tx + 0.5 + ox * 0.28, z: tz + 0.5 + oz * 0.28, room: room[tz * w + tx] };
  });
  L.passages = findPassages(L);
  L.doors = findDoors(L, doorTiles);
  const doorMap = new Int16Array(w * h).fill(-1);
  L.doors.forEach((d) => d.tiles.forEach(([x, z]) => { doorMap[z * w + x] = d.id; }));
  L.doorAt = (x, z) => (x < 0 || z < 0 || x >= w || z >= h ? -1 : doorMap[z * w + x]);
  // a wardrobe opens onto the floor tile in front of it (toward the room)
  L.wardrobes = wardrobes.map(({ tx, tz }, id) => {
    const front = [[0, 1], [0, -1], [1, 0], [-1, 0]].map(([dx, dz]) => [tx + dx, tz + dz]).find(([x, z]) => L.at(x, z) === T.FLOOR);
    return { id, tx, tz, fx: front[0] + 0.5, fz: front[1] + 0.5, room: room[tz * w + tx] };
  });
  L.creaks = new Set(CREAKS.map(([x, z]) => z * w + x));
  L.squeaks = SQUEAKS;
  L.items = ITEMS;
  return L;
}

// Neighbouring door tiles make one double door. axis 'x': the wall runs along x and you walk through along z.
function findDoors(L, tiles) {
  const out = [], used = new Set();
  for (const t of tiles) {
    const key = t.z * L.w + t.x;
    if (used.has(key)) continue;
    const group = [t];
    used.add(key);
    for (const u of tiles) {
      const k2 = u.z * L.w + u.x;
      if (!used.has(k2) && group.some((g) => Math.abs(g.x - u.x) + Math.abs(g.z - u.z) === 1)) { group.push(u); used.add(k2); }
    }
    const xs = group.map((g) => g.x), zs = group.map((g) => g.z);
    const axis = Math.min(...zs) === Math.max(...zs) ? 'x' : 'z';
    out.push({
      id: out.length, tiles: group.map((g) => [g.x, g.z]), open: group[0].open, axis,
      x0: Math.min(...xs), z0: Math.min(...zs), x1: Math.max(...xs) + 1, z1: Math.max(...zs) + 1,
      x: (Math.min(...xs) + Math.max(...xs) + 1) / 2, z: (Math.min(...zs) + Math.max(...zs) + 1) / 2,
    });
  }
  return out;
}

// Crawl passages (connected crawl tiles) and the floor tiles you leave them by.
function findPassages(L) {
  const seen = new Int16Array(L.w * L.h).fill(-1), out = [];
  for (let z = 0; z < L.h; z++) for (let x = 0; x < L.w; x++) {
    if (!L.crawl(x, z) || seen[z * L.w + x] >= 0) continue;
    const id = out.length, tiles = [], exits = [], stack = [[x, z]];
    seen[z * L.w + x] = id;
    while (stack.length) {
      const [cx, cz] = stack.pop();
      tiles.push([cx, cz]);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, nz = cz + dz, k = nz * L.w + nx;
        if (L.crawl(nx, nz)) { if (seen[k] < 0) { seen[k] = id; stack.push([nx, nz]); } }
        else if (!L.monBlocked(nx, nz) && !exits.some(([ex, ez]) => ex === nx && ez === nz)) exits.push([nx, nz]);
      }
    }
    out.push({ id, tiles, exits, kind: L.at(x, z) });
  }
  L.passageAt = (x, z) => (x < 0 || z < 0 || x >= L.w || z >= L.h ? -1 : seen[z * L.w + x]);
  return out;
}
