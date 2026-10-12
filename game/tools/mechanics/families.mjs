// The generated half of the mechanics exam: one case per thing in the house per situation, worked out from the level
// (its candles, doors, wardrobes, toys, squeaky toys, creaky boards, passages and rooms), not from hand-picked spots.
// Where an instance can't be staged (no floor to stand on, no free run to throw along) it is left out, not faked.
// Ids are `<doc id>:<thing>[:<side or way>]`, e.g. C2:candle3, D1:door7:west, N4c:toy2:south.
// Unless a case is about the monster, it is parked awake in the corridor corner furthest away (kit.far).
import { KID, MON, BEAM, REACH, VENT } from '../../src/sim/rules.js';
import { T } from '../../src/sim/level.js';
import { distField } from '../../src/sim/grid.js';
import {
  L, place, wake, press, hold, maxOf, minOf, fail, r2, at, dist, toward, stick, kidB, monB, sightB, allOpen, floor, crawlAt,
  clearance, fits, clearSeg, segAll, sees, segDist, DIRS4, DIRS8, dirName, AREAS, tilesOf, far, farCorner,
} from './kit.mjs';

export const FAMILIES = [];
const add = (fam, c) => FAMILIES.push({ fam, ...c });
const R = KID.radius, MR = MON.radius;
const tf = Math.floor, rd = (v) => Math.round(v * 100) / 100;
// the rules keep the kid's centre 0.24 from anything it can't pass; closer than this and it is in the wall
const WALL_OK = 0.19;
const wallCheck = (G, s) => minOf(s, 'clear', clearance(G.kid.x, G.kid.z, G.kidBlocked));
const walls = (s) => (s.clear ?? 1) >= WALL_OK;
// a spot clear of toys (it would pick one up) and squeaky toys (it would squeak)
const quiet = (x, z, toyR = KID.pickReach + 0.15) => !L.items.some((o) => Math.hypot(o.x - x, o.z - z) < toyR) && !L.squeaks.some((q) => Math.hypot(q.x - x, q.z - z) < 0.6);
const pathQuiet = (ax, az, bx, bz, skipToy = -1, skipSqueak = -1) => !L.items.some((o, i) => i !== skipToy && segDist(o.x, o.z, ax, az, bx, bz) < KID.pickReach + 0.15) && !L.squeaks.some((q, i) => i !== skipSqueak && segDist(q.x, q.z, ax, az, bx, bz) < 0.6);
const kidOK = (x, z) => floor(x, z) && fits(x, z, R, kidB());
const monOK = (x, z, open) => floor(x, z) && fits(x, z, MR, monB(open));
// how many metres the monster must walk from (x, z) to tile (tx, tz) (it plans as if doors were open)
const walk = (G, tx, tz, x, z) => distField(G.L, tx, tz, G.L.monBlocked)[tf(z) * G.L.w + tf(x)];
const best = (cands, score) => cands.reduce((b, c) => (c && (!b || score(c) < score(b) - 1e-9) ? c : b), null);
const grid = (x, z, r, step) => { const out = []; for (let i = -r / step; i <= r / step; i++) for (let j = -r / step; j <= r / step; j++) out.push({ x: rd(x + i * step), z: rd(z + j * step) }); return out; };

// ---------------- candles: each one blown out, kept, out of reach, already out, and as the last one
function candleSpot(c, dmin, dmax, want) {
  return best(grid(c.x, c.z, 2, 0.05).filter(({ x, z }) => {
    const d = Math.hypot(x - c.x, z - c.z);
    return d >= dmin && d <= dmax && kidOK(x, z) && sees(x, z, c.x, c.z) && quiet(x, z)
      && !L.candles.some((o) => o !== c && Math.hypot(o.x - x, o.z - z) < KID.blowReach + 0.3);
  }), ({ x, z }) => Math.abs(Math.hypot(x - c.x, z - c.z) - want));
}
for (const c of L.candles) {
  const nm = `candle${c.id}`, by = candleSpot(c, 0.5, 0.8, 0.7), off = candleSpot(c, KID.blowReach + 0.3, 1.9, 1.5);
  const rest = (G) => G.candles.every((q) => q.id === c.id || (q.lit && q.progress < 0.05));
  const show = (G) => `candles ${G.candles.map((q) => (q.lit ? r2(q.progress) : 'out')).join(' ')}`;
  const at0 = (G) => { place(G, 'kid', by.x, by.z); far(G, c.x, c.z); };
  if (by) {
    add('candles', { id: `C2:${nm}`, what: `1.5 s of blowing puts candle ${c.id} out`, secs: 2, setup: at0, ki: hold({ blow: true }),
      check: (G, s) => fail(!G.candles[c.id].lit && s.firstEv.candleOut > 1.2 && s.firstEv.candleOut < 1.8 && rest(G), `out at ${r2(s.firstEv.candleOut)} s, ${show(G)}`) });
    add('candles', { id: `C2b:${nm}`, what: `candle ${c.id}: progress is kept over a rest (1 s, rest, 0.7 s puts it out)`, secs: 2.7, setup: at0,
      ki: (t) => (t < 1 || t >= 2 ? { blow: true } : {}),
      each: (G, s, t) => { if (t > 1.4 && t < 1.95) { maxOf(s, 'hi', G.candles[c.id].progress); minOf(s, 'lo', G.candles[c.id].progress); } },
      check: (G, s) => fail(!G.candles[c.id].lit && s.lo > 0.5 && s.hi < 0.8 && rest(G), `progress while resting ${r2(s.lo)}..${r2(s.hi)}, ${show(G)}`) });
    add('candles', { id: `C6b:${nm}`, what: `candle ${c.id} already out: blowing at it does nothing, it never relights`, secs: 2,
      setup: (G) => { at0(G); Object.assign(G.candles[c.id], { lit: false, progress: 1.01 }); }, ki: hold({ blow: true }),
      check: (G) => fail(!G.candles[c.id].lit && rest(G) && G.kid.blowing === -1, `${show(G)}, blowing ${G.kid.blowing}`) });
    add('game', { id: `G5:${nm}`, what: `candle ${c.id} the last one lit: blowing it out wins`, secs: 1,
      setup: (G) => { G.candles.forEach((q) => { if (q.id !== c.id) Object.assign(q, { lit: false, progress: 1.01 }); }); G.candles[c.id].progress = 0.8; at0(G); },
      ki: hold({ blow: true }),
      check: (G) => fail(G.state === 'won' && !G.candles[c.id].lit, `game ${G.state}, ${show(G)}`) });
  }
  if (off) {
    add('candles', { id: `C6:${nm}`, what: `blowing ${r2(Math.hypot(off.x - c.x, off.z - c.z))} m from candle ${c.id} (out of reach) does nothing`, secs: 1.5,
      setup: (G) => { place(G, 'kid', off.x, off.z); far(G, c.x, c.z); }, ki: hold({ blow: true }),
      check: (G) => fail(G.candles.every((q) => q.lit && q.progress < 0.05) && G.kid.blowing === -1, `${show(G)}, blowing ${G.kid.blowing}`) });
  }
}
{
  const w = L.wardrobes[0];
  add('candles', { id: 'C6:hidden', what: 'blowing from inside a wardrobe does nothing', secs: 1.5,
    setup: (G) => { place(G, 'kid', w.fx, w.fz, { hidden: w.id, hiddenAt: G.t - 1, stickFree: true }); far(G, w.fx, w.fz); }, ki: hold({ blow: true }),
    check: (G) => fail(G.kid.hidden === w.id && G.kid.blowing === -1 && G.candles.every((q) => q.lit && q.progress < 0.05), `hidden ${G.kid.hidden}, blowing ${G.kid.blowing}`) });
}

// ---------------- doors: from each side, toggled, walked through, blocking, a toy in the way, the monster at it
const SIDES = { z: ['west', 'east'], x: ['north', 'south'] };
const frame = (d, side) => ({ n: d.axis === 'z' ? [side, 0] : [0, side], t: d.axis === 'z' ? [0, 1] : [1, 0] });
// a spot on one side of door d: `off` out from it, `lat` along it. For use: in reach, this door the nearest, no
// wardrobe front or lit candle to take the button instead.
function doorSpot(d, side, { use = true, offs = [1, 0.9, 1.1, 0.8, 1.2], lats = [0, 0.3, -0.3, 0.5, -0.5, 0.7, -0.7, 0.9, -0.9], ok = () => true } = {}) {
  const { n, t } = frame(d, side), cands = [];
  for (const off of offs) for (const lat of lats) {
    const x = rd(d.x + n[0] * off + t[0] * lat), z = rd(d.z + n[1] * off + t[1] * lat);
    if (!kidOK(x, z) || !quiet(x, z) || !ok(x, z)) continue;
    if (use && (Math.hypot(off, lat) > KID.useReach - 0.1 || L.doors.some((o) => o !== d && Math.hypot(o.x - x, o.z - z) < Math.hypot(d.x - x, d.z - z) + 0.2)
      || L.wardrobes.some((w) => Math.hypot(w.fx - x, w.fz - z) < 1.15) || L.candles.some((c) => Math.hypot(c.x - x, c.z - z) < KID.blowReach + 0.2))) continue;
    cands.push({ x, z, off, lat });
  }
  return best(cands, (c) => Math.abs(c.lat) * 2 + Math.abs(c.off - 1));
}
// how far the kid is out on side n of the door (negative: through it)
const across = (G, d, n) => (G.kid.x - d.x) * n[0] + (G.kid.z - d.z) * n[1];
const ds = (G, d) => (G.doors[d.id].open ? 'open' : 'shut');
for (const d of L.doors) {
  const nm = `door${d.id}`, spots = [-1, 1].map((side) => doorSpot(d, side));
  [-1, 1].forEach((side, k) => {
    const sn = SIDES[d.axis][k], { n } = frame(d, side), u = spots[k];
    const w = doorSpot(d, side, { use: false, offs: [1, 0.9, 1.1], lats: [0, 0.2, -0.2, 0.4, -0.4],
      ok: (x, z) => clearSeg(x, z, x - n[0] * (2 * Math.abs((x - d.x) * n[0] + (z - d.z) * n[1])), z - n[1] * (2 * Math.abs((x - d.x) * n[0] + (z - d.z) * n[1])), R, kidB(allOpen)) });
    if (u) {
      // one side from the level's state, the other from the opposite, so every door is both opened and shut
      const from = k === 0 ? d.open : !d.open;
      add('doors', { id: `D1:${nm}:${sn}`, what: `use from the ${sn}: door ${d.id} ${from ? 'shuts' : 'opens'}`, secs: 0.6,
        setup: (G) => { G.doors[d.id].open = from; place(G, 'kid', u.x, u.z); far(G, d.x, d.z); }, ki: press('use'),
        check: (G) => fail(G.doors[d.id].open === !from, `door ${d.id} ${ds(G, d)}`) });
    }
    if (w) {
      add('doors', { id: `D4b:${nm}:${sn}`, what: `door ${d.id} open: the kid walks through it from the ${sn}`, secs: 1.6,
        setup: (G) => { G.doors[d.id].open = true; place(G, 'kid', w.x, w.z); far(G, d.x, d.z); }, ki: hold(stick(n, -1)), each: wallCheck,
        check: (G, s) => fail(across(G, d, n) < -0.9 && walls(s), `got ${r2(-across(G, d, n))} m past the door, ${r2(s.clear)} m from the wall at the closest`) });
      if (k === d.id % 2) {
        add('doors', { id: `D4:${nm}:${sn}`, what: `door ${d.id} shut: it blocks the kid coming from the ${sn}`, secs: 1.2,
          setup: (G) => { G.doors[d.id].open = false; place(G, 'kid', w.x, w.z); far(G, d.x, d.z); }, ki: hold(stick(n, -1)),
          each: (G, s) => minOf(s, 'out', across(G, d, n)),
          check: (G, s) => fail(s.out > 0.5 + R - 0.06 && s.out < 0.85 && !G.doors[d.id].open, `came within ${r2(s.out)} m of the door's middle (it stops at ${r2(0.5 + R)}), door ${ds(G, d)}`) });
      }
    }
  });
  const k1 = spots[1] ? 1 : 0, u = spots[k1], toy = d.id % L.items.length;
  if (!u) continue;
  add('doors', { id: `D1d:${nm}`, what: `door ${d.id}: two presses, two toggles`, secs: 1.2,
    setup: (G) => { place(G, 'kid', u.x, u.z); far(G, d.x, d.z); }, ki: (t) => (at(t, 0) || at(t, 0.6) ? { use: true } : {}),
    each: (G, s, t) => { if (t > 0.3 && t < 0.55 && G.doors[d.id].open !== d.open) s.mid = 1; },
    check: (G, s) => fail(s.mid && G.doors[d.id].open === d.open, `toggled in between ${!!s.mid}, door ${ds(G, d)} at the end`) });
  add('doors', { id: `D3:${nm}`, what: `door ${d.id} will not shut on a toy in the doorway`, secs: 0.6,
    setup: (G) => { G.doors[d.id].open = true; Object.assign(G.items[toy], { x: d.x, z: d.z }); place(G, 'kid', u.x, u.z); far(G, d.x, d.z); }, ki: press('use'),
    check: (G) => fail(G.doors[d.id].open, `door ${d.id} shut on the toy`) });
}
// the monster at a shut door, the kid running about on the other side: it opens (or smashes) the door
for (const d of L.doors) {
  const tries = [-1, 1].map((side) => {
    const { n, t } = frame(d, side), mx = rd(d.x - n[0] * 1.2), mz = rd(d.z - n[1] * 1.2);
    const k = doorSpot(d, side, { use: false, offs: [2, 2.2, 1.8, 2.4], lats: [0, 0.3, -0.3, 0.5, -0.5],
      ok: (x, z) => clearSeg(x - t[0], z - t[1], x + t[0], z + t[1], R, kidB()) && segAll(x - t[0], z - t[1], x + t[0], z + t[1], floor) });
    return k && monOK(mx, mz, () => false) ? { k, t, mx, mz, hx: n[0], hz: n[1] } : null;
  });
  const p = tries.find(Boolean);
  if (!p) continue;
  add('doors', { id: `D5:door${d.id}`, what: `the monster opens shut door ${d.id} to get at a noisy kid`, secs: 5,
    setup: (G) => { G.doors[d.id].open = false; place(G, 'kid', p.k.x, p.k.z); wake(G, p.mx, p.mz, p.hx, p.hz); },
    ki: (t) => stick(p.t, Math.floor((t + 0.25) / 0.5) % 2 ? 1 : -1),
    each: (G, s, t) => { if (G.doors[d.id].open && s.open == null) s.open = t; },
    check: (G, s) => fail(s.open != null, `door ${d.id} still shut; monster at ${r2(G.monster.x)}, ${r2(G.monster.z)}`) });
}

// ---------------- wardrobes: in, staying in, out by use or the stick, refused with it outside, found, empty
for (const w of L.wardrobes) {
  const nm = `wardrobe${w.id}`, ox = w.fx - (w.tx + 0.5), oz = w.fz - (w.tz + 0.5), out = [ox / Math.hypot(ox, oz), oz / Math.hypot(ox, oz)];
  const front = (G) => { place(G, 'kid', w.fx, w.fz); far(G, w.fx, w.fz); };
  const inside = (G) => { place(G, 'kid', w.fx, w.fz, { hidden: w.id, hiddenAt: G.t - 1, stickFree: true }); };
  const mid = (G, s, t) => { if (t > 0.3 && t < 0.75 && G.kid.hidden === w.id) s.inside = 1; };
  add('wardrobes', { id: `W1:${nm}`, what: `use at wardrobe ${w.id}'s front: the kid hides inside`, secs: 0.5, setup: front, ki: press('use'),
    check: (G) => fail(G.kid.hidden === w.id, `hidden ${G.kid.hidden}`) });
  add('wardrobes', { id: `W1b:${nm}`, what: `hidden in wardrobe ${w.id}, held still: the kid stays in`, secs: 2, setup: front, ki: press('use'),
    check: (G) => fail(G.kid.hidden === w.id, `hidden ${G.kid.hidden}`) });
  add('wardrobes', { id: `W2:${nm}`, what: `use again inside wardrobe ${w.id}: the kid comes out at its front`, secs: 1.4, setup: front,
    ki: (t) => (at(t, 0) || at(t, 0.8) ? { use: true } : {}), each: mid,
    check: (G, s) => fail(s.inside && G.kid.hidden === -1 && dist(G.kid, { x: w.fx, z: w.fz }) < 0.5, `inside in between ${!!s.inside}, hidden ${G.kid.hidden}, ${r2(dist(G.kid, { x: w.fx, z: w.fz }))} m from the front`) });
  add('wardrobes', { id: `W2b:${nm}`, what: `inside wardrobe ${w.id}, push the stick (once let go): the kid comes out`, secs: 1.6, setup: front,
    ki: (t) => (at(t, 0) ? { use: true } : t > 0.8 ? stick(out) : {}), each: mid,
    check: (G, s) => fail(s.inside && G.kid.hidden === -1, `inside in between ${!!s.inside}, hidden ${G.kid.hidden}`) });
  // the monster right outside: coming out is refused (it is 0.9 m off, inside the 1.44 m it blocks)
  const mon = [0.9, 1.0, 0.8].map((k) => ({ x: rd(w.fx + out[0] * k), z: rd(w.fz + out[1] * k) })).find(({ x, z }) => monOK(x, z));
  if (mon) {
    add('wardrobes', { id: `W2c:${nm}`, what: `the monster at wardrobe ${w.id}'s front: coming out is refused`, secs: 0.3, warm: 0.05,
      setup: (G) => { inside(G); wake(G, mon.x, mon.z, -out[0], -out[1]); }, ki: press('use'),
      each: (G, s, t) => { if (at(t, 0.05)) { s.d = Math.hypot(G.monster.x - w.fx, G.monster.z - w.fz); s.h = G.kid.hidden; } },
      check: (G, s) => fail(s.d < MON.reach + MON.radius + 0.3 - 0.05 && s.h === w.id, `monster ${r2(s.d)} m from the front, hidden ${s.h}`) });
  }
  // seen getting in: it walks over, opens the wardrobe and the kid is caught
  const seer = best(tilesOf({ i: w.room, cx: w.fx, cz: w.fz }).map(([x, z]) => ({ x, z })).filter(({ x, z }) => {
    const d = Math.hypot(x - w.fx, z - w.fz);
    return d >= 3 && d <= 4.5 && monOK(x, z) && sees(x, z, w.fx, w.fz) && clearSeg(x, z, w.fx + out[0] * 0.5, w.fz + out[1] * 0.5, MR, monB());
  }), ({ x, z }) => Math.abs(Math.hypot(x - w.fx, z - w.fz) - 3.5));
  if (seer) {
    const n = Math.hypot(w.fx - seer.x, w.fz - seer.z);
    add('wardrobes', { id: `W4:${nm}`, what: `seen getting into wardrobe ${w.id}: the monster opens it and the kid is caught`, secs: 4,
      setup: (G) => { place(G, 'kid', w.fx, w.fz); wake(G, seer.x, seer.z, (w.fx - seer.x) / n, (w.fz - seer.z) / n); }, ki: press('use'),
      each: (G, s) => { if (G.kid.hidden === w.id) s.hid = 1; },
      check: (G, s) => fail(s.hid && G.state === 'caught', `hid ${!!s.hid}, game ${G.state}, monster ${r2(Math.hypot(G.monster.x - w.fx, G.monster.z - w.fz))} m from the front`) });
    // told the kid went in (it did not: the kid is far off), it opens the wardrobe, finds it empty, and the game goes on
    const kid = farCorner(w.fx, w.fz);
    add('wardrobes', { id: `W4b:${nm}`, what: `the monster opens wardrobe ${w.id} and it is empty: the game goes on`, secs: 4,
      setup: (G) => { place(G, 'kid', kid[0], kid[1]); wake(G, seer.x, seer.z, (w.fx - seer.x) / n, (w.fz - seer.z) / n); G.sense.hideSeen = w.id; }, ki: hold({}),
      each: (G, s) => { if (G.monster.act === 'check' || G.t - G.wardrobes[w.id].openAt < 0.3) s.opened = 1; },
      check: (G, s) => fail(s.opened && G.state === 'play' && G.kid.hidden === -1, `opened ${!!s.opened}, game ${G.state}`) });
  }
}

// ---------------- toys: picked up, carried, thrown every free way, picked up again, no throw into a wall, one at a time
// where a thrown toy comes down (the rules' own flight: 10 m/s in 1/60 s steps, stopping short of anything solid)
function flight(x, z, dx, dz) {
  const st = KID.throwSpeed / 60, kb = kidB(), sb = sightB();
  for (let d = st; ; d += st) {
    const nx = x + dx * st, nz = z + dz * st, hit = kb(tf(nx), tf(nz)) || sb(tf(nx), tf(nz));
    if (!hit) { x = nx; z = nz; }
    if (hit || d >= KID.throwRange - 1e-9) return { x, z };
  }
}
const standAt = (x, z) => best(grid(x, z, 0.3, 0.02).filter((p) => kidOK(p.x, p.z)), (p) => Math.hypot(p.x - x, p.z - z));
// a straight 1 m walk onto (x, z) and a little past, along one of the four ways
function approach(x, z, skip, back = 1, past = 0.3, skipSqueak = -1) {
  for (const D of DIRS4) for (const lat of [0, 0.1, -0.1, 0.2, -0.2]) {
    const sx = rd(x - D[0] * back - D[1] * lat), sz = rd(z - D[1] * back - D[0] * lat), ex = x + D[0] * past - D[1] * lat, ez = z + D[1] * past - D[0] * lat;
    if (kidOK(sx, sz) && clearSeg(sx, sz, ex, ez, R, kidB()) && segAll(sx, sz, ex, ez, (a, b) => !crawlAt(a, b)) && pathQuiet(sx, sz, ex, ez, skip, skipSqueak)) return { x: sx, z: sz, D };
  }
  return null;
}
const holding = (G, i, x, z, f = [1, 0]) => { place(G, 'kid', x, z, { held: i, fx: f[0], fz: f[1] }); Object.assign(G.items[i], { x, z, held: true, fly: null }); };
L.items.forEach((it, i) => {
  const nm = `toy${i}`, j = (i + 1) % L.items.length, st = standAt(it.x, it.z), ap = approach(it.x, it.z, i);
  if (ap) {
    add('toys', { id: `N4:${nm}`, what: `walking over the ${it.kind} (toy ${i}) from the ${dirName(ap.D.map((v) => -v))} picks it up`, secs: 0.8,
      setup: (G) => { place(G, 'kid', ap.x, ap.z); far(G, it.x, it.z); }, ki: hold(stick(ap.D)),
      check: (G) => fail(G.kid.held === i && G.items[i].held, `held ${G.kid.held}, toy ${i} held ${G.items[i].held}`) });
    add('toys', { id: `N4e:${nm}`, what: `holding another toy, walking over toy ${i} does not pick it up`, secs: 0.8,
      setup: (G) => { holding(G, j, ap.x, ap.z); far(G, it.x, it.z); }, ki: hold(stick(ap.D)), each: (G, s) => minOf(s, 'd', dist(G.kid, it)),
      check: (G, s) => fail(s.d < KID.pickReach - 0.1 && G.kid.held === j && !G.items[i].held && dist(G.items[i], it) < 0.15, `passed ${r2(s.d)} m from it, held ${G.kid.held}, toy ${i} held ${G.items[i].held}, ${r2(dist(G.items[i], it))} m from where it lay`) });
  }
  if (!st) return;
  const carry = DIRS4.find((D) => clearSeg(st.x, st.z, st.x + D[0] * 2.5, st.z + D[1] * 2.5, R, kidB()) && pathQuiet(st.x, st.z, st.x + D[0] * 2.5, st.z + D[1] * 2.5, i) && segAll(st.x, st.z, st.x + D[0] * 2.5, st.z + D[1] * 2.5, (a, b) => !crawlAt(a, b)));
  if (carry) {
    add('toys', { id: `N4b:${nm}`, what: `the ${it.kind} (toy ${i}) goes where the kid goes`, secs: 1,
      setup: (G) => { holding(G, i, st.x, st.z); far(G, st.x, st.z); }, ki: hold(stick(carry)),
      check: (G) => fail(G.kid.held === i && dist(G.items[i], G.kid) < 0.8 && dist(G.kid, st) > 1.8, `held ${G.kid.held}, toy ${r2(dist(G.items[i], G.kid))} m from the kid, kid moved ${r2(dist(G.kid, st))} m`) });
  }
  let again = false;
  for (const D of DIRS4) {
    const land = flight(st.x, st.z, D[0], D[1]), far0 = Math.hypot(land.x - st.x, land.z - st.z);
    if (far0 < 3) continue;
    add('toys', { id: `N4c:${nm}:${dirName(D)}`, what: `toy ${i} thrown ${dirName(D)}: it flies ${r2(far0)} m and lands`, secs: 1.2,
      setup: (G) => { holding(G, i, st.x, st.z, D); far(G, st.x, st.z); }, ki: press('throw'),
      each: (G, s) => { if (G.items[i].fly) s.flew = 1; },
      check: (G, s) => fail(s.flew && !G.items[i].fly && G.kid.held === -1 && dist(G.items[i], land) < 0.8, `flew ${!!s.flew}, in the air ${!!G.items[i].fly}, held ${G.kid.held}, landed ${r2(dist(G.items[i], land))} m from ${r2(land.x)}, ${r2(land.z)}`) });
    // and walked to and picked up again (the first way the kid can follow it without passing another toy)
    if (!again && clearSeg(st.x, st.z, land.x - D[0] * 0.3, land.z - D[1] * 0.3, R, kidB()) && pathQuiet(st.x, st.z, land.x, land.z, i)) {
      again = true;
      add('toys', { id: `N4d:${nm}`, what: `toy ${i} thrown ${dirName(D)} can be picked up again`, secs: 1.4 + far0 / 3,
        setup: (G) => { holding(G, i, st.x, st.z, D); far(G, st.x, st.z); },
        ki: (t, G) => (at(t, 0) ? { throw: true } : t > 0.9 ? toward(G, G.items[i].x, G.items[i].z) : {}),
        each: (G, s) => { if (G.items[i].fly) s.flew = 1; },
        check: (G, s) => fail(s.flew && G.kid.held === i, `flew ${!!s.flew}, held ${G.kid.held}, toy at ${r2(G.items[i].x)}, ${r2(G.items[i].z)}, kid at ${r2(G.kid.x)}, ${r2(G.kid.z)}`) });
    }
  }
  // the nearest wall along one of the four ways: stand 0.3 m from it, face it, throw: refused
  const wall = best(DIRS4.map((D) => {
    for (let k = 1; k <= 6; k++) {
      const tx = tf(st.x) + D[0] * k, tz = tf(st.z) + D[1] * k;
      if (!kidB()(tx, tz) && !sightB()(tx, tz)) continue;
      const x = rd(D[0] ? (D[0] > 0 ? tx - 0.3 : tx + 1.3) : st.x), z = rd(D[1] ? (D[1] > 0 ? tz - 0.3 : tz + 1.3) : st.z);
      return kidOK(x, z) && !crawlAt(x, z) && quiet(x, z, 0) ? { x, z, D } : null;
    }
    return null;
  }), (p) => dist(p, st));
  if (wall) {
    add('toys', { id: `N5:${nm}`, what: `facing a wall ${dirName(wall.D)} 0.3 m off, toy ${i} is not thrown`, secs: 0.6,
      setup: (G) => { holding(G, i, wall.x, wall.z, wall.D); far(G, wall.x, wall.z); }, ki: press('throw'),
      each: (G, s) => { if (G.items[i].fly) s.flew = 1; },
      check: (G, s) => fail(G.kid.held === i && !s.flew, `held ${G.kid.held}, flew ${!!s.flew}`) });
  }
});

// ---------------- squeaky toys: running past squeaks, creeping past does not
L.squeaks.forEach((q, i) => {
  const ap = approach(q.x, q.z, -1, 1.2, 0.6, i);
  if (!ap) return;
  const pass = (G, s) => { maxOf(s, 'cool', G.squeaks[i].cool); minOf(s, 'd', dist(G.kid, q)); };
  add('squeaks', { id: `N3:squeak${i}`, what: `running over the ${q.kind} (squeaky toy ${i}) squeaks it`, secs: 1,
    setup: (G) => { place(G, 'kid', ap.x, ap.z); far(G, q.x, q.z); }, ki: hold(stick(ap.D)), each: pass,
    check: (G, s) => fail(s.cool > 0.5, `its rest at most ${r2(s.cool)} s (passed ${r2(s.d)} m from it)`) });
  add('squeaks', { id: `N3b:squeak${i}`, what: `creeping over the ${q.kind} (squeaky toy ${i}): no squeak`, secs: 1.6,
    setup: (G) => { place(G, 'kid', ap.x, ap.z); far(G, q.x, q.z); }, ki: hold({ ...stick(ap.D), creep: true }), each: pass,
    check: (G, s) => fail(s.d < 0.42 && !(s.cool > 0.3), `passed ${r2(s.d)} m from it, its rest up to ${r2(s.cool)} s`) });
});

// ---------------- creaky boards: walking onto one creaks, creeping does not
[...L.creaks].forEach((key, i) => {
  const cx = key % L.w, cz = tf(key / L.w);
  const ap = DIRS4.map((D) => {
    const sx = cx + 0.5 - D[0], sz = cz + 0.5 - D[1], ex = cx + 0.5 + D[0] * 0.45, ez = cz + 0.5 + D[1] * 0.45;
    return kidOK(sx, sz) && !L.creaks.has(tf(sz) * L.w + tf(sx)) && clearSeg(sx, sz, ex, ez, R, kidB()) && pathQuiet(sx, sz, ex, ez) ? { x: sx, z: sz, D } : null;
  }).find(Boolean);
  if (!ap) return;
  const on = (G, s) => { if (tf(G.kid.x) === cx && tf(G.kid.z) === cz) s.on = 1; };
  add('creaks', { id: `N2:creak${i}`, what: `walking onto the creaky board at ${cx}, ${cz} creaks`, secs: 0.8,
    setup: (G) => { place(G, 'kid', ap.x, ap.z); far(G, cx, cz); }, ki: hold(stick(ap.D)), each: on,
    check: (G, s) => fail(s.ev.creak, `no creak (on the board ${!!s.on})`) });
  add('creaks', { id: `N2b:creak${i}`, what: `creeping onto the creaky board at ${cx}, ${cz}: no creak`, secs: 1.2,
    setup: (G) => { place(G, 'kid', ap.x, ap.z); far(G, cx, cz); }, ki: hold({ ...stick(ap.D), creep: true }), each: on,
    check: (G, s) => fail(s.on && !s.ev.creak, `on the board ${!!s.on}, ${s.ev.creak || 0} creaks`) });
});

// ---------------- passages: the kid crawls through from one way out to another; the monster reaches in at a kid just
// inside any of them (rules VENT.reachIn), and squeezes into the vent duct after a kid deeper in (VENT.monsterIn)
const KINDS = { [T.DUCT]: 'vent', [T.CRACK]: 'crack', [T.TABLE]: 'table', [T.BED]: 'bed' };
for (const p of L.passages) {
  const ends = [];
  for (const a of p.exits) for (const b of p.exits) {
    const [ax, az, bx, bz] = [a[0] + 0.5, a[1] + 0.5, b[0] + 0.5, b[1] + 0.5];
    if ((ax !== bx && az !== bz) || (ax === bx && az === bz) || !clearSeg(ax, az, bx, bz, R, kidB())) continue;
    if (!segAll(ax, az, bx, bz, (x, z) => L.passageAt(tf(x), tf(z)) === p.id || floor(x, z))) continue;
    ends.push({ a: { x: ax, z: az }, b: { x: bx, z: bz }, len: Math.hypot(bx - ax, bz - az) });
  }
  const e = best(ends, (q) => -q.len), nm = `pass${p.id}`, kind = KINDS[p.kind];
  if (!e) continue;
  const [A, B] = p.id % 2 ? [e.b, e.a] : [e.a, e.b];
  add('passages', { id: `P1:${nm}`, what: `the kid crawls through the ${kind} (passage ${p.id}) from ${A.x}, ${A.z} to ${B.x}, ${B.z}`, secs: rd(e.len / KID.crawl + 1.2),
    setup: (G) => { place(G, 'kid', A.x, A.z); far(G, (A.x + B.x) / 2, (A.z + B.z) / 2); }, ki: (t, G) => toward(G, B.x, B.z),
    each: (G, s) => { if (G.kid.crawl) s.crawl = 1; wallCheck(G, s); },
    check: (G, s) => fail(s.crawl && dist(G.kid, B) < 0.6 && walls(s), `crawled ${!!s.crawl}, ends ${r2(dist(G.kid, B))} m from the way out, ${r2(s.clear)} m from a wall at the closest`) });
  // the kid just inside, the monster at the way in, facing it: it reaches in and has the kid
  const ux = Math.sign(B.x - A.x), uz = Math.sign(B.z - A.z), kx = A.x + ux, kz = A.z + uz;
  add('passages', { id: `P2:${nm}`, what: `the monster at the ${kind} (passage ${p.id}) reaches in at the kid just inside`, secs: 1,
    setup: (G) => { place(G, 'kid', kx, kz); wake(G, A.x, A.z, ux, uz); }, ki: hold({}),
    check: (G) => fail(G.state === 'caught', `game ${G.state}, ${r2(dist(G.kid, G.monster))} m apart`) });
  // the vent duct: a kid deeper in; the monster squeezes in after it, slowly, and has it
  const deep = p.tiles.map(([x, z]) => ({ x: x + 0.5, z: z + 0.5 })).filter((q) => Math.hypot(q.x - A.x, q.z - A.z) >= 2.9 && Math.hypot(q.x - A.x, q.z - A.z) <= 4.1 && (q.x === A.x || q.z === A.z));
  if (p.kind === T.DUCT && deep.length) {
    const K = deep[0];
    add('passages', { id: `P3:${nm}`, what: `the monster squeezes into the vent (passage ${p.id}) after a kid ${r2(dist(K, A))} m in, slowly, and has it`, secs: 6,
      setup: (G) => { place(G, 'kid', K.x, K.z); wake(G, A.x, A.z, ux, uz); }, ki: hold({}),
      each: (G, s) => { if (G.L.duct(tf(G.monster.x), tf(G.monster.z))) { s.inside = (s.inside || 0) + 1; if (s.inside > 2) maxOf(s, 'v', G.monster.speed); } }, // its speed once it is in
      check: (G, s) => fail(s.inside && (s.v ?? 0) <= VENT.monCrawl + 0.05 && G.state === 'caught', `got in ${!!s.inside}, fastest in the duct ${r2(s.v)} m/s, game ${G.state}`) });
  }
}

// ---------------- moving, in every room and the corridor: run, creep, stop, face, slide along a wall
// the first straight run of `len` m on plain floor from a tile nearest the area's middle (ways tried from `first`)
function runIn(a, len, first = 0) {
  for (const [x, z] of tilesOf(a)) for (let k = 0; k < 4; k++) {
    const D = DIRS4[(first + k) % 4], ex = x + D[0] * len, ez = z + D[1] * len;
    if (kidOK(x, z) && clearSeg(x, z, ex, ez, R, kidB()) && segAll(x, z, ex, ez, floor) && pathQuiet(x, z, ex, ez)) return { x, z, D };
  }
  return null;
}
// a tile beside a straight wall (blocked one way, for at least 4 tiles along it): slide along it
function wallIn(a) {
  for (const [x, z] of tilesOf(a)) for (const D of DIRS4) for (const P of [[D[1], D[0]], [-D[1], -D[0]]]) {
    let ok = true;
    for (let k = 0; k <= 3 && ok; k++) {
      const tx = tf(x) + P[0] * k, tz = tf(z) + P[1] * k;
      ok = floor(tx + 0.5, tz + 0.5) && kidB()(tx + D[0], tz + D[1]) && !kidB()(tx - D[0], tz - D[1]) && quiet(tx + 0.5, tz + 0.5);
    }
    if (ok) return { x: x + D[0] * 0.15, z: z + D[1] * 0.15, D, P };
  }
  return null;
}
AREAS.forEach((a, ai) => {
  const r4 = runIn(a, 4, ai), f2 = runIn(a, 2, ai), sw = wallIn(a), nm = a.name;
  const go = (p) => (G) => { place(G, 'kid', p.x, p.z); far(G, p.x, p.z); };
  if (r4) {
    add('moving', { id: `K1:${nm}`, what: `${nm}: holding ${dirName(r4.D)}, the kid runs, up to 3.2 m/s`, secs: 1.2, setup: go(r4), ki: hold(stick(r4.D)),
      each: (G, s) => { maxOf(s, 'v', G.kid.speed); wallCheck(G, s); },
      check: (G, s) => fail(s.v > 2.8 && s.v < 3.6 && dist(G.kid, r4) > 2.5 && walls(s), `top speed ${r2(s.v)} m/s, moved ${r2(dist(G.kid, r4))} m`) });
    add('moving', { id: `K2:${nm}`, what: `${nm}: creeping ${dirName(r4.D)}, up to 1.4 m/s`, secs: 1.2, setup: go(r4), ki: hold({ ...stick(r4.D), creep: true }),
      each: (G, s) => maxOf(s, 'v', G.kid.speed),
      check: (G, s) => fail(s.v > 1.15 && s.v < 1.7 && !G.kid.running, `top speed ${r2(s.v)} m/s, running ${G.kid.running}`) });
    add('moving', { id: `K7:${nm}`, what: `${nm}: run ${dirName(r4.D)} 0.7 s, let go: the kid stops`, secs: 1.5, setup: go(r4), ki: (t) => (t < 0.7 ? stick(r4.D) : {}),
      check: (G) => fail(G.kid.speed < 0.15 && dist(G.kid, r4) > 1.5 && dist(G.kid, r4) < 3, `speed ${r2(G.kid.speed)} m/s, moved ${r2(dist(G.kid, r4))} m`) });
  }
  if (f2) {
    add('moving', { id: `K5:${nm}`, what: `${nm}: facing ${dirName(f2.D.map((v) => -v))}, the kid moves ${dirName(f2.D)} and faces that way`, secs: 0.5,
      setup: (G) => { go(f2)(G); Object.assign(G.kid, { fx: -f2.D[0], fz: -f2.D[1] }); }, ki: hold(stick(f2.D)),
      check: (G) => fail(G.kid.fx * f2.D[0] + G.kid.fz * f2.D[1] > 0.9, `facing ${r2(G.kid.fx)}, ${r2(G.kid.fz)}`) });
  }
  if (sw) {
    add('moving', { id: `K4:${nm}`, what: `${nm}: pushing into the ${dirName(sw.D)} wall, the kid slides ${dirName(sw.P)} along it`, secs: 1.2, setup: go(sw),
      ki: hold({ mx: (sw.D[0] + sw.P[0]) * 0.7, mz: (sw.D[1] + sw.P[1]) * 0.7 }), each: wallCheck,
      check: (G, s) => { const along = (G.kid.x - sw.x) * sw.P[0] + (G.kid.z - sw.z) * sw.P[1]; return fail(walls(s) && along > 1.2, `slid ${r2(along)} m, ${r2(s.clear)} m from the wall at the closest`); } });
  }
});

// ---------------- the monster, in every room and the corridor: sees, chases and catches; lunges; touches; the
// searchlight and the hand; and under the tables and beds, what it can't see and the giant can't reach
function pairIn(a, d) {
  for (const [x, z] of tilesOf(a)) for (const u of DIRS8) {
    const mx = rd(x - u[0] * d), mz = rd(z - u[1] * d);
    if (kidOK(x, z) && monOK(mx, mz) && clearSeg(mx, mz, x, z, MR, monB()) && sees(mx, mz, x, z)) return { x, z, u, mx, mz };
  }
  return null;
}
const until = (k) => (G, s, t) => { if (s[k] == null && (k === 'saw' ? G.monster.sees : G.beam.spotted)) s[k] = t; };
const beamOn = (G, x, z) => Object.assign(G.beam, { state: 'warn', t: BEAM.warn - 0.6, x, z, dx: 1, dz: 0, spotted: false, cool: 30 }); // on 0.3 s in
const handDown = (G, x, z) => { // two candles out (the hand needs them), its shadow already spreading: it comes down 0.3 s in
  G.candles.slice(0, 2).forEach((c) => Object.assign(c, { lit: false, progress: 1.01 }));
  Object.assign(G.reach, { state: 'shadow', t: REACH.shadow - 0.6, x, z, cool: 30 });
};
AREAS.forEach((a) => {
  const p = pairIn(a, 5), nm = a.name;
  if (!p) return;
  const atK = (G) => place(G, 'kid', p.x, p.z), mon = (G, d) => wake(G, rd(p.x - p.u[0] * d), rd(p.z - p.u[1] * d), p.u[0], p.u[1]);
  const gap = (G) => r2(dist(G.kid, G.monster));
  add('monster', { id: `B1:${nm}`, what: `${nm}: the monster 5 m off sees the kid, chases and catches it`, secs: 4,
    setup: (G) => { atK(G); mon(G, 5); }, ki: hold({}), each: until('saw'),
    check: (G, s) => fail(s.saw < 1 && G.state === 'caught', `saw at ${r2(s.saw)} s, game ${G.state}, ${gap(G)} m apart`) });
  add('monster', { id: `B2:${nm}`, what: `${nm}: 1.8 m off and facing the kid, it crouches and lunges`, secs: 1.2, warm: 0.1,
    setup: (G) => { atK(G); mon(G, 1.8); }, ki: hold({}),
    check: (G, s) => fail(s.ev.windup || s.ev.lunge || G.state === 'caught', `game ${G.state}, no windup or lunge`) });
  add('monster', { id: `X1:${nm}`, what: `${nm}: the monster 0.8 m from the kid: a touch catches it`, secs: 0.3, warm: 0,
    setup: (G) => { atK(G); mon(G, 0.8); }, ki: hold({}),
    check: (G) => fail(G.state === 'caught', `game ${G.state}, ${gap(G)} m apart`) });
  add('light', { id: `L3:${nm}`, what: `${nm}: the searchlight comes on over the kid in the open and spots it`, secs: 1.2,
    setup: (G) => { atK(G); far(G, p.x, p.z); beamOn(G, p.x + 0.8, p.z); }, ki: hold({}), each: until('spot'),
    check: (G, s) => fail(s.spot != null, `beam ${G.beam.state} at ${r2(G.beam.x)}, ${r2(G.beam.z)}, never spotted the kid`) });
  add('hand', { id: `H3:${nm}`, what: `${nm}: the giant's hand comes down on the kid in the open: caught`, secs: 1.3,
    setup: (G) => { atK(G); far(G, p.x, p.z); handDown(G, p.x, p.z); }, ki: hold({}),
    check: (G) => fail(G.state === 'caught', `game ${G.state}, hand ${G.reach.state}`) });
});
for (const p of L.passages.filter((q) => q.kind === T.TABLE || q.kind === T.BED)) {
  const kind = KINDS[p.kind], nm = `pass${p.id}`;
  const cx = p.tiles.reduce((s, t) => s + t[0], 0) / p.tiles.length + 0.5, cz = p.tiles.reduce((s, t) => s + t[1], 0) / p.tiles.length + 0.5;
  const [kx, kz] = best(p.tiles.map(([x, z]) => [x + 0.5, z + 0.5]), ([x, z]) => Math.hypot(x - cx, z - cz));
  const m = best(grid(kx, kz, 4, 0.5).filter(({ x, z }) => { const d = Math.hypot(x - kx, z - kz); return d >= 2.5 && d <= 4 && monOK(x, z) && sees(x, z, kx, kz); }),
    ({ x, z }) => Math.abs(Math.hypot(x - kx, z - kz) - 3) + Math.abs(x - tf(x) - 0.5));
  if (m) {
    const n = Math.hypot(kx - m.x, kz - m.z);
    add('monster', { id: `S1:${nm}`, what: `the kid under the ${kind} (passage ${p.id}) ${r2(n)} m off: the monster can't see it`, secs: 1.5,
      setup: (G) => { place(G, 'kid', kx, kz); wake(G, m.x, m.z, (kx - m.x) / n, (kz - m.z) / n); }, ki: hold({}),
      each: (G, s) => { if (G.monster.sees && dist(G.kid, G.monster) > MON.hiddenSeen + 0.2) s.saw = 1; },
      check: (G, s) => fail(!s.saw, 'it saw the kid from further than 1.4 m') });
  }
  add('light', { id: `L3b:${nm}`, what: `the searchlight over the kid under the ${kind} (passage ${p.id}): not spotted`, secs: 1.5,
    setup: (G) => { place(G, 'kid', kx, kz); far(G, kx, kz); beamOn(G, kx, kz); }, ki: hold({}),
    each: (G, s, t) => { until('spot')(G, s, t); if (G.beam.state === 'on') s.on = 1; },
    check: (G, s) => fail(s.on && s.spot == null, `beam came on ${!!s.on}, spotted at ${r2(s.spot)} s`) });
  add('hand', { id: `H3b:${nm}`, what: `the giant's hand comes down on the kid under the ${kind} (passage ${p.id}): safe`, secs: 1.3,
    setup: (G) => { place(G, 'kid', kx, kz); far(G, kx, kz); handDown(G, kx, kz); }, ki: hold({}),
    each: (G, s) => { if (G.reach.state === 'hold') s.down = 1; },
    check: (G, s) => fail(s.down && G.state === 'play', `hand came down ${!!s.down}, game ${G.state}`) });
}

// ---------------- what it hears: a door, a toy landing, running; it goes to look (walks closer to the sound)
// Its mind turns to hunting it (or searching round it, if near; or, for a door, it sets about opening it) within 2 s, and it gets `need` m closer by the route it must walk (or catches
// the kid). Its fuzzy sense of the kid is put off past the case, and it stands where neither it nor the floor around
// it has the kid in sight, so only the sound can send it (without it, it hunts after 3 s at the soonest).
const deaf = (G) => { G.sense.pingT = MON.pingEvery[0]; };
const unseen = (x, z, pts, open, r = 1.5) => grid(x, z, r, 0.5).filter((p) => Math.hypot(p.x - x, p.z - z) <= r && floor(p.x, p.z)).every((p) => pts.every((k) => !sees(p.x, p.z, k.x, k.z, open)));
const closer = (tx, tz, need, door = -1) => ({
  each: (G, s, t) => {
    const w = walk(G, tx, tz, G.monster.x, G.monster.z), M = G.monster;
    if (s.w0 == null) s.w0 = w;
    minOf(s, 'w', w);
    if (s.hunt == null && (G.mind.mode === 'hunt' || G.mind.mode === 'search' || (door >= 0 && (M.act === 'door' || M.act === 'bash') && Math.hypot(G.doors[door].x - M.x, G.doors[door].z - M.z) < 1.5))) s.hunt = t;
  },
  check: (G, s) => fail(s.hunt <= 2 && (G.state === 'caught' || s.w0 - s.w >= need), `hunting from ${r2(s.hunt)} s, it walked from ${r2(s.w0)} m to ${r2(s.w)} m from the sound at best, game ${G.state}`),
});
const spotNear = (x, z, dmin, dmax, ok) => best(grid(x, z, dmax, 1).map((p) => ({ x: tf(p.x) + 0.5, z: tf(p.z) + 0.5 })).filter((p) => {
  const d = Math.hypot(p.x - x, p.z - z);
  return d >= dmin && d <= dmax && monOK(p.x, p.z) && ok(p);
}), (p) => Math.abs(Math.hypot(p.x - x, p.z - z) - (dmin + dmax) / 2) + (p.x + p.z) * 1e-4);
// a door: the kid shuts it (open for the case: once shut, nothing can be seen through it); the monster 2-3.5 m beyond
for (const d of L.doors) {
  const [tx, tz] = d.tiles[0], fld = distField(L, tx, tz, L.monBlocked);
  const q = [-1, 1].map((side) => {
    const { n } = frame(d, side), u = doorSpot(d, side);
    const m = u && spotNear(d.x, d.z, 2, 3.5, (p) => ((p.x - d.x) * n[0] + (p.z - d.z) * n[1]) < -1 && fld[tf(p.z) * L.w + tf(p.x)] <= 6 && unseen(p.x, p.z, [u], allOpen, 0.5));
    return m && { u, m };
  }).find(Boolean);
  if (!q) continue;
  const { u, m } = q, n = Math.hypot(d.x - m.x, d.z - m.z);
  add('monster', { id: `B8:door${d.id}`, what: `the kid shuts door ${d.id}; the monster ${r2(n)} m beyond it hears and comes to look`, secs: 2.5,
    setup: (G) => { G.doors[d.id].open = true; place(G, 'kid', u.x, u.z); wake(G, m.x, m.z, -(d.x - m.x) / n, -(d.z - m.z) / n); deaf(G); }, ki: press('use'), ...closer(tx, tz, 1, d.id) });
}
// a toy landing: thrown the first free way; the monster 5-8 m from where it comes down (a walk of at most 9 m, no shut
// door on the way)
L.items.forEach((it, i) => {
  const st = standAt(it.x, it.z);
  if (!st) return;
  const D = DIRS4.find((v) => dist(flight(st.x, st.z, v[0], v[1]), st) >= 3);
  if (!D) return;
  const land = flight(st.x, st.z, D[0], D[1]), lt = [tf(land.x), tf(land.z)], fld = distField(L, lt[0], lt[1], monB());
  const m = spotNear(land.x, land.z, 5, 8, (p) => dist(p, st) >= 6 && fld[tf(p.z) * L.w + tf(p.x)] <= 9 && unseen(p.x, p.z, [st]));
  if (!m) return;
  add('monster', { id: `B8:toy${i}`, what: `toy ${i} thrown ${dirName(D)} lands; the monster ${r2(dist(m, land))} m off comes to look`, secs: 4,
    setup: (G) => { holding(G, i, st.x, st.z, D); wake(G, m.x, m.z, (land.x - m.x) / dist(m, land), (land.z - m.z) / dist(m, land)); deaf(G); }, ki: press('throw'),
    ...closer(lt[0], lt[1], 2) });
});
// running: the kid runs to and fro in a room; the monster 3-4.5 m off behind a wall (heard 6 m through walls, so it
// still hears as it wanders off), a walk of at most 9 m with no shut door on the way, nowhere within 2.5 m of it in
// sight of the kid (it wanders while it makes up its mind)
AREAS.filter((a) => a.i >= 0).forEach((a) => {
  for (const [x, z] of tilesOf(a)) {
    const P = [DIRS4[0], DIRS4[2]].find((v) => clearSeg(x - v[0], z - v[1], x + v[0], z + v[1], R, kidB()) && segAll(x - v[0], z - v[1], x + v[0], z + v[1], floor) && pathQuiet(x - v[0], z - v[1], x + v[0], z + v[1]));
    if (!P || !kidOK(x, z)) continue;
    const fld = distField(L, tf(x), tf(z), monB()), run = [-1, 0, 1].map((k) => ({ x: x + P[0] * k, z: z + P[1] * k }));
    const m = spotNear(x, z, 3, 4.5, (q) => fld[tf(q.z) * L.w + tf(q.x)] <= 9 && unseen(q.x, q.z, run, undefined, 2.5));
    if (!m) continue;
    add('monster', { id: `B8:run:${a.name}`, what: `${a.name}: the kid runs about; the monster behind the wall hears it and comes`, secs: 4,
      setup: (G) => { place(G, 'kid', x, z); wake(G, m.x, m.z, (x - m.x) / dist(m, { x, z }), (z - m.z) / dist(m, { x, z })); deaf(G); },
      ki: (t) => stick(P, Math.floor((t + 0.25) / 0.5) % 2 ? 1 : -1), ...closer(tf(x), tf(z), 1) });
    break;
  }
});
