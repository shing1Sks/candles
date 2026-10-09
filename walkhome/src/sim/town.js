// THE TOWN, as data. The whole road is laid out once from the seed: every house, lamp, tree, bin
// and gnome, with its place (s along the road, l across it) and what it is. The renderer turns this
// into geometry segment by segment; the sim uses it for collisions, hiding places and lamp states.
// Region by region the town changes gradually: our street's gardens, the long street's thin tall
// terraces, the high street's shuttered shops, the park railings and the bridge, the hill.
import { makeRng, hash32 } from '../../../engine/rng.js';
import { ROAD, regionAt } from './road.js';

export const BRIDGE = { from: 1094, to: 1118, water: 1106, width: 11 };
export const HOME = { s: 1600 };
// the story, on the lamp posts. In order up the road: our dog is lost; our dog has been lost a long
// time; a boy is missing; the boy has been missing a very long time; then every post, every fence.
export const POSTERS = [
  { s: 30, kind: 'lostDog', age: 0 }, { s: 140, kind: 'lostDog', age: 0.3 },
  { s: 330, kind: 'lostDog', age: 0.6 }, { s: 470, kind: 'missing', age: 0.1, year: 2019 },
  { s: 640, kind: 'missing', age: 0.3, year: 1998 }, { s: 760, kind: 'missing', age: 0.45, year: 1987 }, { s: 880, kind: 'missing', age: 0.6, year: 1979 },
  { s: 1000, kind: 'missing', age: 0.75, year: 1964 }, { s: 1180, kind: 'missing', age: 0.85, year: 1951 },
  { s: 1300, kind: 'many', age: 0.9 }, { s: 1380, kind: 'many', age: 0.95 }, { s: 1460, kind: 'many', age: 1 }, { s: 1540, kind: 'many', age: 1 },
];

const WALLS = {
  ourStreet: { kinds: { siding: 4, brick: 3, render: 2 }, colors: [0x8fa3b0, 0xb39a7e, 0x9aa88e, 0xa88f9a, 0xc0b49a, 0x7f8f9f] },
  longStreet: { kinds: { brick: 5, render: 3, siding: 1 }, colors: [0x8a7f74, 0x9a8c7c, 0x7f8794, 0x8c7a80, 0x908a7a] },
  highStreet: { kinds: { brick: 4, render: 4 }, colors: [0x7a6e66, 0x8a7d70, 0x6f7480, 0x857a6a] },
  parkEdge: { kinds: { brick: 3, render: 3, siding: 2 }, colors: [0x6f7a80, 0x7a7068, 0x80786e, 0x6a7468] },
  hill: { kinds: { siding: 3, render: 3, brick: 2 }, colors: [0x7d8892, 0x8a8278, 0x76807a, 0x8a7a84] },
};
const ROOFS = [0x4a4652, 0x3e3a44, 0x524652, 0x3a4048, 0x4a4040];
const DOORS = [0x6a2a26, 0x2a3a5a, 0x2e4a38, 0x1e1a22, 0x6a5a2a, 0x4a2a4a];
const TRIMS = [0xe8e2d4, 0xd8d0c0, 0xc8c8c0, 0xe0d8c8];

export function buildTown(seed) {
  const rng = makeRng(hash32(seed, 'town'));
  const houses = [], lamps = [], props = [], trees = [];
  let id = 0;

  // houses, side by side along each side of the road
  for (const side of [-1, 1]) {
    let s = side < 0 ? -6 : -2.5;
    while (s < ROAD.homeS - 30) {
      const R = regionAt(Math.max(0, s)).id;
      const tall = R === 'longStreet' || R === 'hill', shop = R === 'highStreet';
      const w = shop ? rng.range(5.5, 7.5) : tall ? rng.range(4.2, 5.4) : rng.range(5.0, 6.8);
      s += w / 2;
      // the park: no houses on the right, railings and trees instead
      if (R === 'parkEdge' && side > 0) { s += w / 2; continue; }
      // the canal bridge: no houses either side, just the parapets and the water
      if (s > BRIDGE.from - 6 && s < BRIDGE.to + 6) { s += w / 2; continue; }
      const style = WALLS[R];
      const h = shop ? rng.range(7, 9) : tall ? rng.range(8.5, 12.5) : rng.range(6.2, 8.6);
      const o = {
        id: id++, s, side, region: R, w, d: 5.2, h,
        rh: tall ? rng.range(5.5, 9) : rng.range(4, 7),
        lean: (tall ? rng.range(0.6, 1.0) : rng.range(0.35, 0.7)) * (R === 'hill' ? 1.3 : 1),
        twist: rng.range(-0.12, 0.12), taper: rng.range(0.08, 0.2),
        wall: rng.weighted(style.kinds), wallColor: rng.pick(style.colors), roof: rng.pick(ROOFS), door: rng.pick(DOORS), trim: rng.pick(TRIMS),
        shutter: rng.pick([0x2a3a4a, 0x4a2a2a, 0x2a3a2a, 0x3a2a3a, 0x3a3a3a]),
        turret: !shop && rng.chance(tall ? 0.3 : 0.18), chimney: rng.chance(0.85), dormer: !shop && rng.chance(0.35),
        porch: !shop && rng.chance(0.7), porchLamp: rng.chance(R === 'ourStreet' ? 0.4 : 0.15), shop,
        boundary: shop ? 'none' : rng.weighted(R === 'ourStreet' ? { picket: 4, hedge: 2, wall: 2, none: 1 } : { iron: 3, wall: 3, hedge: 2, none: 1 }),
        doorZ: (rng.chance(0.5) ? -1 : 1) * (w / 2 - 1.25),
        seed: rng.int(0, 1e9),
      };
      o.rows = Math.max(1, Math.floor((o.h - 3.1) / 2.4));
      houses.push(o);
      // yard things
      if (!shop) {
        const yardKinds = R === 'ourStreet' ? { gnome: 2, bush: 3, bin: 3, swing: 1, washing: 1, topiary: 1, trike: 1, mailbox: 2, nothing: 3 } : { bin: 4, bush: 3, nothing: 5, gnome: 1, washing: 1, pram: 1 };
        for (let k = 0; k < 2; k++) {
          const kind = rng.weighted(yardKinds); if (kind === 'nothing') continue;
          const dz = o.doorZ > 0 ? -1 : 1, zz = o.doorZ + dz * rng.range(1.6, w - 2.6);
          if (Math.abs(zz) > w / 2 - 0.4) continue;
          props.push({ kind, house: o.id, s: o.s + side * zz * -1 * -1, l: side * rng.range(ROAD.front - 2.2, ROAD.front - 0.9), side, local: { x: rng.range(0.8, 2.2), z: zz }, r: 0.45, hide: kind === 'bush' || kind === 'bin', seed: rng.int(0, 1e9) });
        }
        if (rng.chance(R === 'ourStreet' ? 0.35 : 0.2)) trees.push({ s: o.s + rng.range(-w / 2, w / 2), l: side * (ROAD.front + o.d + rng.range(1.5, 4)), h: rng.range(7, 11), seed: rng.int(0, 1e9) });
      }
      const gap = shop ? rng.range(0, 0.3) : tall ? rng.range(0.4, 1.6) : rng.range(1.6, 3.6);
      s += w / 2 + gap;
      // in the gaps between houses: dark alleys, sometimes a tree or a shed
      if (gap > 2.4 && rng.chance(0.4)) trees.push({ s: s - gap / 2, l: side * (ROAD.front + rng.range(2, 5)), h: rng.range(8, 12), seed: rng.int(0, 1e9) });
    }
  }

  // ON THE HILL, OUR STREET AGAIN (05 P8/P9). A run of houses half way up the hill are the very
  // houses you started beside: same shapes, colours, gardens. Taller now, leaning harder.
  const ours = houses.filter((o) => o.region === 'ourStreet' && o.s < 70);
  const hillRun = houses.filter((o) => o.region === 'hill' && o.s > 1355 && o.s < 1430);
  for (const h of hillRun) {
    const src = ours.find((o) => o.side === h.side && !o.used); if (!src) continue; src.used = true;
    Object.assign(h, { w: Math.min(h.w, src.w), wall: src.wall, wallColor: src.wallColor, roof: src.roof, door: src.door, trim: src.trim, shutter: src.shutter, turret: src.turret, chimney: src.chimney, dormer: src.dormer, porch: src.porch, porchLamp: src.porchLamp, boundary: src.boundary, doorZ: Math.max(-h.w / 2 + 1.25, Math.min(h.w / 2 - 1.25, src.doorZ)), seed: src.seed, h: src.h * 1.15, rh: src.rh * 1.2, lean: src.lean * 1.6, twist: src.twist, taper: src.taper, again: true });
  }
  // the signpost: three arms, all HOME, none agreeing. Once at the start; once again on the hill, turned
  const signposts = [{ s: 8, l: 4.55, turn: 0 }, { s: 1392, l: 4.55, turn: 2.4 }];
  // street lamps: alternating sides, ~20-26 m apart; on the high street closer, in the park further
  let side = -1, ls = 13;
  while (ls < ROAD.homeS) {
    const R = regionAt(ls).id;
    lamps.push({ id: lamps.length, s: ls, side, region: R });
    ls += R === 'highStreet' ? rng.range(15, 19) : R === 'parkEdge' ? rng.range(26, 32) : rng.range(20, 26);
    side = -side;
  }

  // telegraph poles down one side (they swap sides at the high street), wires between them
  const poles = [];
  for (let s = -10, i = 0; s < ROAD.homeS; s += rng.range(28, 34), i++) {
    const R = regionAt(Math.max(0, s)).id, side = R === 'highStreet' || R === 'hill' ? -1 : 1;
    poles.push({ s, l: side * 4.45, lean: rng.range(-0.15, 0.15), drop: R !== 'parkEdge' && rng.chance(0.4) });
  }
  // park railings and trees on the right through the park
  for (let s = 950; s < 1250; s += rng.range(5, 9)) { if (s > BRIDGE.from - 8 && s < BRIDGE.to + 8) continue; if (Math.abs(s - 1012) < 14 || Math.abs(s - 1190) < 10) continue; trees.push({ s, l: rng.range(8, 22), h: rng.range(9, 14), seed: rng.int(0, 1e9), park: true }); }

  // the park: a playground, benches, a pond, bins, behind railings on the right
  const park = { playground: { s: 1012, l: 11 }, pond: { s: 1190, l: 14, r: 7 }, benches: [{ s: 980, l: 6.2 }, { s: 1050, l: 6.2 }, { s: 1160, l: 6.2 }, { s: 1230, l: 6.2 }], gate: { s: 1000 }, gate2: { s: 1172 } };
  // the garden boundaries are solid: you can only go into a garden through its gate
  const edges = { '-1': [], '1': [] };
  for (const o of houses) if (o.boundary !== 'none' && !o.shop) edges[o.side].push({ a: o.s - o.w / 2 - 0.6, b: o.s + o.w / 2 + 0.6, gate: o.s + o.side * o.doorZ });
  // and the park's railings are solid too, except at its two gates (one each side of the canal)
  edges['1'].push({ a: 950, b: BRIDGE.from - 7, gate: park.gate.s, gw: 1.4 }, { a: BRIDGE.to + 7, b: 1250, gate: park.gate2.s, gw: 1.4 });
  const blocked = (s, side) => { for (const e of edges[side]) if (s > e.a && s < e.b) return Math.abs(s - e.gate) > (e.gw || 0.55); return false; };
  // the gate in the boundary at s (for Biscuit, who has to go round by it like you do)
  const gateAt = (s, side) => { for (const e of edges[side]) if (s > e.a - 1 && s < e.b + 1) return e.gate; return null; };
  return { houses, lamps, props, trees, poles, park, blocked, gateAt, signposts };
}

// everything in [s0, s1)
export function slice(town, s0, s1) {
  const f = (o) => o.s >= s0 && o.s < s1;
  return { houses: town.houses.filter(f), lamps: town.lamps.filter(f), props: town.props.filter(f), trees: town.trees.filter(f) };
}
