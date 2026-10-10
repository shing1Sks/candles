// The maze. One character = one 1 m tile. World x = column, world z = row.
//   #  wall               .  floor
//   =  vent duct          c  crack in a wall (kid only)
//   t  table              b  bed or crib (kid crawls under)
//   x  low furniture      u  tall furniture
//   C  candle             K  kid start         M  monster start
export const MAP = [
  '#####################################',
  '#.............=========............M#',
  '#.............####=####.............#',
  '#..###############=###########c###..#',
  '#..#u.......C#xx...xxx.#..xxx...x#..#',
  '#..#.........c.........c.........#..#',
  '#......bb....#.........#...ttt...#..#',
  '#......bb....#....uu...#...ttt...#..#',
  '#..#...bb....#.........#............#',
  '#..#...................#............#',
  '#..#.x................C#C.......u#..#',
  '#..#######..###..#############..##..#',
  '#..#C........#........x#....x....#..#',
  '#..#..............K.........x..x.#..#',
  '#..#...bb.................u......#..#',
  '#......bb....#...ttt...#..u..uuu.#..#',
  '#......bb....#...ttt...#..u.........#',
  '#..#.........#.........#......x.....#',
  '#..#x.......u#C.......x#C........#..#',
  '#..#####c###########..###c########..#',
  '#...................................#',
  '#...................................#',
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

export const T = { FLOOR: 0, WALL: 1, DUCT: 2, CRACK: 3, TABLE: 4, BED: 5, LOW: 6, TALL: 7 };
const CODE = { '#': T.WALL, '=': T.DUCT, c: T.CRACK, t: T.TABLE, b: T.BED, x: T.LOW, u: T.TALL };

const KID_BLOCK = new Set([T.WALL, T.LOW, T.TALL]);
const MON_BLOCK = new Set([T.WALL, T.LOW, T.TALL, T.DUCT, T.CRACK, T.TABLE, T.BED]);
const SIGHT_BLOCK = new Set([T.WALL, T.TALL, T.DUCT, T.CRACK]);
const CRAWL = new Set([T.DUCT, T.CRACK, T.TABLE, T.BED]);

export function parseLevel(rows = MAP) {
  const h = rows.length, w = rows[0].length;
  const tiles = new Uint8Array(w * h), room = new Int8Array(w * h).fill(-1);
  const candles = [];
  let kid, monster;
  for (let z = 0; z < h; z++) {
    if (rows[z].length !== w) throw new Error(`row ${z} is ${rows[z].length} wide, expected ${w}`);
    for (let x = 0; x < w; x++) {
      const ch = rows[z][x];
      tiles[z * w + x] = CODE[ch] ?? T.FLOOR;
      if (ch === 'C') candles.push({ tx: x, tz: z });
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
  L.monBlocked = (x, z) => MON_BLOCK.has(L.at(x, z));
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
  return L;
}

// Kid-only passages (connected crawl tiles) and the floor tiles you leave them by.
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
