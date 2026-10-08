// DRESSING A CHUNK (research/07 phase 3). Every corridor gets things on its walls and floor from its
// wing's deck: mostly the ordinary school at first (radiators, signs, coats, a clock), more and
// wronger things as the night goes on (the damage layer: a chunk is dressed when it comes into
// view, so it changes while you're away). On top, the chunk's anomaly from the engine
// (engine/anomalies.js), if it has one. Everything is quads into the chunk's batch: one draw call
// for the atlas, a few for the notices and photos.
import { hash32, makeRng } from '../../../engine/rng.js';
import { DRESS, cellUV } from '../art/dressing.js';

// [name, from act, weight in main / infants / science / old]
const WALL_DECK = [
  ['radiator', 1, 3, 1, 3, 2], ['quiet', 1, 1.5, 0.3, 1, 1], ['fireExit', 1, 1, 0.5, 1, 0.5], ['clock', 1, 0.6, 0.4, 0.6, 1.2],
  ['notice', 1, 2, 1, 1, 0.5], ['photo', 1, 1.5, 0.5, 0.5, 3], ['wellDone', 1, 0.8, 2, 0.3, 0.3], ['pegs', 1, 0.3, 3, 0, 0.5],
  ['coat', 1, 0.3, 2, 0.2, 0.4], ['concert', 1, 1, 1, 1, 1.5], ['drawFamily', 1, 0.6, 3, 0.2, 0.3], ['stain', 1, 0.6, 0.3, 2.5, 1],
  ['crack', 1, 0.6, 0.4, 1, 1.5],
  ['drawHall', 2, 0.4, 2, 0.2, 0.4], ['drawTall', 2, 0.4, 1.5, 0.2, 0.5], ['missing', 2, 0.8, 0.6, 0.6, 0.8], ['handprints', 2, 0.7, 1.5, 0.7, 0.7],
  ['portrait', 1, 0.2, 0, 0, 3], ['honours', 1, 0.3, 0, 0, 1.5],
  ['drawTeeth', 3, 0.4, 1.5, 0.2, 0.4], ['sorry', 3, 0.4, 0.4, 0.4, 0.6], ['soot', 3, 0.5, 0.3, 0.4, 1.5], ['tally', 3, 0.3, 0.3, 0.3, 0.3],
];
const STAND_DECK = [['bag', 1, 1, 1, 1, 1], ['chair', 1, 0.5, 1.5, 0.3, 1.2], ['shoes', 2, 0.8, 1.2, 0.6, 0.6], ['balloon', 2, 0.3, 1.5, 0.1, 0.2], ['doll', 3, 0.4, 1, 0.3, 0.5]];
const WING_I = { main: 0, infants: 1, science: 2, old: 3 };
const DENSITY = { main: 0.4, infants: 0.55, science: 0.35, old: 0.45 };
// sizes of the cards that aren't in the atlas
const EXTRA = { notice: [2.1, 0.95, 0.95], photo: [0.7, 0.44, 1.35] };

const pick = (r, deck, wing, act) => {
  const wi = WING_I[wing] ?? 0, ok = deck.filter((d) => d[1] <= act && d[2 + wi] > 0);
  let t = r() * ok.reduce((s, d) => s + d[2 + wi], 0);
  for (const d of ok) { t -= d[2 + wi]; if (t <= 0) return d[0]; }
  return ok[ok.length - 1]?.[0];
};

// a flat card: centre c, unit right R and up U (3-vectors), size w x h, the atlas cell or a whole texture
function card(B, key, uv, c, R, U, w, h) {
  const p = (sx, sy) => [c[0] + R[0] * sx * w / 2 + U[0] * sy * h / 2, c[1] + R[1] * sx * w / 2 + U[1] * sy * h / 2, c[2] + R[2] * sx * w / 2 + U[2] * sy * h / 2];
  const [u0, v0, u1, v1] = uv;
  B.quad(key, p(-1, -1), p(1, -1), p(1, 1), p(-1, 1), [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]);
}
const rot = (R, U, a) => { const c = Math.cos(a), s = Math.sin(a); return [R.map((v, i) => v * c + U[i] * s), U.map((v, i) => -R[i] * s + v * c)]; };

// the corridor walls of a chunk's arms, with what's in the way along each
function wallsOf(c, L) {
  const out = [];
  for (const k of c.corridors) {
    if (!k.arm) continue;
    const ns = k.arm === 'N' || k.arm === 'S';
    const sides = ns ? [[k.x0, [1, 0]], [k.x1, [-1, 0]]] : [[k.z0, [0, 1]], [k.z1, [0, -1]]];
    for (const [pos, n] of sides) {
      const a0 = ns ? k.z0 : k.x0, a1 = ns ? k.z1 : k.x1, doors = [], lockers = [];
      for (const r of c.rooms) {
        const d = r.door, onWall = ns ? (d.side === 'E' || d.side === 'W') && Math.abs(d.x - pos) < L.inset + 0.05 : (d.side === 'N' || d.side === 'S') && Math.abs(d.z - pos) < L.inset + 0.05;
        const at = ns ? d.z : d.x;
        if (onWall && at > a0 - 1 && at < a1 + 1) doors.push([at - 1.0, at + 1.0, r]);
      }
      for (const l of c.lockers) {
        const hit = ns ? (n[0] > 0 ? Math.abs(l.x0 - pos) < 0.05 : Math.abs(l.x1 - pos) < 0.05) && l.z1 > a0 && l.z0 < a1
          : (n[1] > 0 ? Math.abs(l.z0 - pos) < 0.05 : Math.abs(l.z1 - pos) < 0.05) && l.x1 > a0 && l.x0 < a1;
        if (hit) lockers.push(ns ? [l.z0, l.z1] : [l.x0, l.x1]);
      }
      out.push({ arm: k.arm, k, ns, pos, n, a0, a1, doors, lockers });
    }
  }
  return out;
}
const overlaps = (list, a, b) => list.some(([x, y]) => b > x && a < y);

// the point on wall W at distance `at` along it, `off` metres out from the plaster, height y
// (walls are 0.1 m thick boxes centred on the line: the plaster facing the corridor is 5 cm out)
const onWall = (W, at, off, y) => W.ns ? [W.pos + W.n[0] * (off + 0.05), y, at] : [at, y, W.pos + W.n[1] * (off + 0.05)];
const rightOf = (W) => [W.n[1], 0, -W.n[0]];
const UP = [0, 1, 0];

export function dressChunk(B, c, S, L, y0, anomaly, act, chWing = null) {
  const r = makeRng(hash32(c.key, c.epoch, 'dress', act)).next;
  const walls = wallsOf(c, L), wing = c.wing || 'main', ch = chWing ?? L.corridorH;
  const used = new Map(walls.map((W) => [W, []])); // spans already dressed on each wall
  let lift = 0.02;
  const z = () => (lift += 0.0015); // decals stand off the wall by a hair more each, so none z-fight

  // put a named thing on a wall at `at` (its centre); returns false if it doesn't fit
  const wallThing = (W, name, at, { y = null, tilt = 0, force = false } = {}) => {
    const d = DRESS[name], ex = EXTRA[name];
    const [w, h, yb] = ex ? ex : [d[2], d[3], d[4]];
    const yy = y ?? yb, a = at - w / 2, b = at + w / 2;
    if (!force) {
      if (a < W.a0 + 0.3 || b > W.a1 - 0.3) return false;
      if (overlaps(W.doors, a, b) || used.get(W).some(([x0, x1, ya, yb]) => b > x0 && a < x1 && yy + h > ya && yy < yb)) return false;
      if (yy < 1.97 && overlaps(W.lockers, a, b)) return false;
    }
    if (yy + h > ch - 0.05) return false;
    const off = z() + (yy < 1.97 && overlaps(W.lockers, a, b) ? 0.42 : 0);
    let R = rightOf(W), U = UP;
    if (tilt) [R, U] = rot(R, U, tilt);
    const key = ex ? (name === 'photo' ? `photo${1 + Math.floor(r() * 3)}` : name) : 'dress';
    card(B, key, ex ? [0, 0, 1, 1] : cellUV(name), onWall(W, at, off, y0 + yy + h / 2), R, U, w, h);
    used.get(W).push([a, b, yy, yy + h]);
    return true;
  };
  const standThing = (W, name, at, out = 0.14) => {
    const [, , w, h] = DRESS[name];
    if (overlaps(W.doors, at - w, at + w)) return false;
    const R = rightOf(W), off = out + (overlaps(W.lockers, at - w / 2, at + w / 2) ? 0.42 : 0);
    card(B, 'dress', cellUV(name), onWall(W, at, off, y0 + h / 2), R, UP, w, h);
    return true;
  };
  const floorThing = (name, x, zz, ang, y = y0 + 0.01 + (lift += 0.0007)) => {
    const [, , w, h] = DRESS[name];
    card(B, 'dress', cellUV(name), [x, y, zz], [Math.cos(ang), 0, Math.sin(ang)], [-Math.sin(ang), 0, Math.cos(ang)], w, h);
  };
  const ceilThing = (name, x, zz, ang) => {
    const [, , w, h] = DRESS[name];
    card(B, 'dress', cellUV(name), [x, y0 + ch - 0.015, zz], [Math.cos(ang), 0, Math.sin(ang)], [-Math.sin(ang), 0, -Math.cos(ang)], w, h);
  };
  const handprints = (W, at) => { // a child's hands, several, at a child's height, dragging toward the floor
    const n = 3 + Math.floor(r() * 5);
    for (let i = 0; i < n; i++) wallThing(W, 'handprint', at + (r() - 0.5) * 1.2, { y: 0.55 + r() * 0.8, tilt: (r() - 0.5) * 0.9, force: true });
    used.get(W).push([at - 0.7, at + 0.7, 0.4, 1.6]);
  };

  // ---- the wing's own architecture ----
  for (const k of c.corridors) {
    if (!k.arm) continue;
    const ns = k.arm === 'N' || k.arm === 'S', a0 = ns ? k.z0 : k.x0, a1 = ns ? k.z1 : k.x1, mx = (k.x0 + k.x1) / 2, mz = (k.z0 + k.z1) / 2;
    const across = ns ? [1, 0, 0] : [0, 0, 1];
    // infants: bunting and paper chains strung across the corridor
    if (wing === 'infants') for (let a = a0 + 1.6, i = 0; a < a1 - 1; a += 3.2, i++) {
      const name = i % 2 ? 'paperChain' : 'bunting', [, , w, h] = DRESS[name];
      card(B, 'dress', cellUV(name), ns ? [mx, y0 + ch - 0.12 - h / 2, a] : [a, y0 + ch - 0.12 - h / 2, mz], across, UP, w, h);
    }
    // a ceiling vent here and there; late in the night, something behind one
    if (r() < 0.3) { const a = a0 + 2 + r() * (a1 - a0 - 4); ceilThing(act >= 3 && r() < 0.2 ? 'ventEyes' : 'vent', ns ? mx : a, ns ? a : mz, ns ? Math.PI / 2 : 0); }
  }
  for (const W of walls) {
    // science: pipes along the top of every wall
    if (wing === 'science') for (let at = W.a0 + 1.0; at < W.a1 - 1.0; at += 2.0) wallThing(W, 'pipes', at, { y: ch - 0.55, force: !overlaps(W.doors, at - 1, at + 1) });
    // old: cobwebs in the high corners
    if (wing === 'old' && r() < 0.6) wallThing(W, 'cobweb', W.a0 + 0.6 + r() * (W.a1 - W.a0 - 1.2), { y: ch - 0.62, force: true });
  }

  // ---- the anomaly first, so it gets the walls it wants ----
  if (anomaly) {
    const ar = makeRng(anomaly.seed).next, A = anomaly.kind;
    // an anomaly wants a wall you can see all of: no lockers, few doors, if the chunk has one
    const pickW = (pred = () => true) => {
      const ok = walls.filter(pred), clear = ok.filter((w) => !w.lockers.length && w.doors.length <= 1), from = clear.length ? clear : ok;
      return from[Math.floor(ar() * from.length)];
    };
    const armOf = (W) => walls.filter((w) => w.arm === W.arm);
    const span = (W, step, fn) => { for (let at = W.a0 + 0.8; at < W.a1 - 0.8; at += step) fn(at); };
    if (A === 'shoesRow') { const W = pickW(); if (W) for (const V of armOf(W)) span(V, 0.6, (at) => standThing(V, 'shoes', at, 0.18)); }
    else if (A === 'chairWall' || A === 'doll') {
      const W = pickW(); if (W) { const at = W.n[0] + W.n[1] > 0 ? W.a1 - 1.2 : W.a0 + 1.2; standThing(W, A === 'doll' ? 'doll' : 'chair', at, 0.5); }
    } else if (A === 'arrowDoor') {
      const W = walls.find((w) => w.doors.some((d) => d[2].id === anomaly.room));
      if (W) {
        const dAt = W.doors.find((d) => d[2].id === anomaly.room)[0] + 1.0;
        const from = Math.abs(dAt - W.a0) > Math.abs(dAt - W.a1) ? W.a0 : W.a1, dir = Math.sign(dAt - from);
        const axisAng = W.ns ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
        for (let at = from + dir * 0.8; dir * (dAt - at) > 1.4; at += dir * 1.7) {
          const [x, , zz] = onWall(W, at, 1.7, 0);
          floorThing('arrow', x, zz, axisAng + (r() - 0.5) * 0.25);
        }
        const [x, , zz] = onWall(W, dAt, 0.9, 0);
        const toDoor = Math.atan2(-W.n[1], -W.n[0]);
        floorThing('arrow', x, zz, toDoor);
        wallThing(W, 'thisOne', dAt + dir * -1.45, { force: true, tilt: 0.08 });
      }
    } else if (A === 'missingRow') { const W0 = pickW(); for (const W of W0 ? armOf(W0) : []) span(W, 0.62, (at) => wallThing(W, 'missing', at, { tilt: (ar() - 0.5) * 0.08 })); }
    else if (A === 'linesWall') { const W = pickW((w) => !w.lockers.length) || pickW(); if (W) span(W, 1.92, (at) => wallThing(W, 'lines', at, { y: W.lockers.length ? 2.0 : 0.3 })); }
    else if (A === 'coatFeet') {
      const W = pickW((w) => !w.lockers.length) || pickW(); if (W) {
        const at0 = W.a0 + 1.5 + ar() * Math.max(0, W.a1 - W.a0 - 5);
        for (let i = 0; i < 2; i++) wallThing(W, 'pegs', at0 + 0.8 + i * 1.6, { force: true });
        for (let i = 0; i < 6; i++) { wallThing(W, 'coat', at0 + 0.25 + i * 0.52, { y: 0.55, force: true }); if (i === 4) standThing(W, 'shoes', at0 + 0.25 + i * 0.52, 0.2); }
      }
    } else if (A === 'ceilingHands') {
      const k = pickW()?.k; if (k) for (let i = 0; i < 28; i++) ceilThing('handprint', k.x0 + 0.3 + ar() * (k.x1 - k.x0 - 0.6), k.z0 + 0.3 + ar() * (k.z1 - k.z0 - 0.6), ar() * 6.28);
    } else if (A === 'tallyWall') { const W = pickW(); if (W) span(W, 0.95, (at) => { wallThing(W, 'tally', at, { y: 1.97 }); wallThing(W, 'tally', at, { y: 1.0 }); }); }
    else if (A === 'sameDrawing') {
      const W = pickW(); if (W) for (const y of [0.3, 0.85, 1.4, 1.97]) span(W, 0.58, (at) => wallThing(W, 'drawTall', at, { y, tilt: (ar() - 0.5) * 0.12 }));
    } else if (A === 'sootArm') {
      const W0 = pickW();
      for (const W of W0 ? armOf(W0) : []) span(W, 0.9, (at) => wallThing(W, 'soot', at, { force: !overlaps(W.doors, at - 0.6, at + 0.6), y: overlaps(W.lockers, at - 0.6, at + 0.6) ? 0.45 : 0 }));
      const k = W0?.k; if (k) for (let i = 0; i < 4; i++) floorThing('scraps', k.x0 + 0.6 + ar() * (k.x1 - k.x0 - 1.2), k.z0 + 0.6 + ar() * (k.z1 - k.z0 - 1.2), ar() * 6.28);
    } else if (A === 'trailUpWall') {
      // small footprints down the middle of an arm, then sideways to a wall, up it, and across the ceiling
      const W = pickW(); if (W) {
        const dir = W.n[0] + W.n[1] > 0 ? 1 : -1, start = dir > 0 ? W.a0 + 0.6 : W.a1 - 0.6, turn = start + dir * (4 + ar() * 3);
        const fwd = W.ns ? [0, dir] : [dir, 0], fAng = Math.atan2(fwd[1], fwd[0]) + Math.PI / 2;
        let i = 0;
        for (let at = start; dir * (turn - at) > 0; at += dir * 0.42, i++) { const [x, , zz] = onWall(W, at, 1.7 + (i % 2 ? 0.1 : -0.1), 0); floorThing('footprint', x, zz, fAng); }
        // across to the wall
        for (let o = 1.4; o > 0.25; o -= 0.42, i++) { const [x, , zz] = onWall(W, turn + (i % 2 ? 0.1 : -0.1), o, 0); floorThing('footprint', x, zz, Math.atan2(-W.n[1], -W.n[0]) + Math.PI / 2); }
        // up the wall
        for (let y = 0.25; y < ch - 0.2; y += 0.42, i++) card(B, 'dress', cellUV('footprint'), onWall(W, turn + (i % 2 ? 0.1 : -0.1), z(), y0 + y), rightOf(W), UP, 0.13, 0.26);
        // and across the ceiling, away from the wall
        for (let o = 0.3; o < 3.2; o += 0.42, i++) { const [x, , zz] = onWall(W, turn + (i % 2 ? 0.1 : -0.1), o, 0); ceilThing('footprint', x, zz, Math.atan2(W.n[1], W.n[0]) + Math.PI / 2); }
      }
    }
  }

  // ---- the ordinary dressing and the damage layer ----
  const dens = Math.min(0.85, DENSITY[wing] + 0.07 * (act - 1));
  for (const W of walls) {
    for (let at = W.a0 + 0.6 + r() * 0.8; at < W.a1 - 0.5;) {
      if (r() < dens) {
        const name = pick(r, WALL_DECK, wing, act);
        if (name === 'handprints') handprints(W, at);
        else if (!wallThing(W, name, at, { tilt: name.startsWith('draw') || name === 'missing' || name === 'concert' ? (r() - 0.5) * 0.1 : 0 })) { at += 0.5; continue; }
      }
      at += 1.0 + r() * 1.4;
    }
    // something left on the floor against this wall
    if (r() < 0.12 + 0.06 * act) { const name = pick(r, STAND_DECK, wing, act); if (name) standThing(W, name, W.a0 + 1 + r() * (W.a1 - W.a0 - 2)); }
  }
  // the floor: a fallen ceiling tile, a puddle under a leak, burnt scraps
  for (const k of c.corridors) {
    if (!k.arm) continue;
    const fx = () => k.x0 + 0.7 + r() * (k.x1 - k.x0 - 1.4), fz = () => k.z0 + 0.7 + r() * (k.z1 - k.z0 - 1.4);
    if (r() < (wing === 'science' ? 0.5 : act >= 2 ? 0.15 : 0)) floorThing('puddle', fx(), fz(), r() * 6.28);
    if (act >= 2 && r() < 0.15 * (act - 1)) floorThing('tile', fx(), fz(), r() * 6.28);
    if (act >= 3 && r() < (wing === 'old' ? 0.4 : 0.15)) floorThing('scraps', fx(), fz(), r() * 6.28);
    if (wing === 'science' && r() < 0.5) { const x = fx(), zz = fz(); ceilThing('stain', x, zz, r() * 6.28); }
  }
}
