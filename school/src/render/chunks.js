// CHUNK MESHES. Each generated chunk becomes one group: floors, ceilings and walls merged per
// material (a few draw calls per chunk), door leaves on hinges, lockers, notices and photos, and
// the ceiling tubes. The stairwell shaft is built once per stair column. The view keeps the 3x3
// chunks around you (plus the stair shaft you're in) and throws the rest away.
import * as THREE from 'three';
import { makePaperLit } from './paperlit.js';
import { hash32 } from '../../../engine/rng.js';
import { lightLevel, actOf } from '../../../engine/lights.js';
import { dressChunk } from './dress.js';
import { wingOf } from '../../../engine/layout/wings.js';

// each wing's corridors are their own height (render only: the engine's walls are the same): the
// infants' and science corridors low and close, the old wing tall and dark, with globe lamps on rods
const WING_H = { main: 2.85, infants: 2.55, science: 2.6, old: 3.5 };

const SIDE_VEC = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
const DOOR_H = 2.1;

// quads accumulated per material key, then merged into one BufferGeometry each
class Batch {
  constructor() { this.parts = new Map(); }
  quad(key, a, b, c, d, uv = [[0, 0], [1, 0], [1, 1], [0, 1]]) {
    let p = this.parts.get(key);
    if (!p) { p = { pos: [], uv: [], idx: [] }; this.parts.set(key, p); }
    const n = p.pos.length / 3;
    for (const v of [a, b, c, d]) p.pos.push(v[0], v[1], v[2]);
    for (const t of uv) p.uv.push(t[0], t[1]);
    p.idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
  }
  build(group, mats) {
    for (const [key, p] of this.parts) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(p.pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(p.uv, 2));
      g.setIndex(p.idx);
      const m = new THREE.Mesh(g, mats[key]);
      m.matrixAutoUpdate = false;
      group.add(m);
    }
  }
}

// a horizontal rect (floor faces up, ceiling faces down), uv in texture tiles
function flat(B, key, r, y, up, tm) {
  const uv = (x, z) => [x / tm[0], z / tm[1]];
  const a = [r.x0, y, r.z0], b = [r.x1, y, r.z0], c = [r.x1, y, r.z1], d = [r.x0, y, r.z1];
  if (up) B.quad(key, d, c, b, a, [uv(r.x0, r.z1), uv(r.x1, r.z1), uv(r.x1, r.z0), uv(r.x0, r.z0)]);
  else B.quad(key, a, b, c, d, [uv(r.x0, r.z0), uv(r.x1, r.z0), uv(r.x1, r.z1), uv(r.x0, r.z1)]);
}

// a vertical quad from (x0,z0) to (x1,z1), y from y0 to y1, facing the side the normal points to
function wallQuad(B, key, x0, z0, x1, z1, y0, y1, uLen, vStretch = true) {
  const L = Math.hypot(x1 - x0, z1 - z0), u0 = (x0 + z0) / uLen, u1 = u0 + L / uLen;
  const v1 = vStretch ? 1 : (y1 - y0) / 2.85;
  B.quad(key, [x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0], [[u0, 0], [u1, 0], [u1, v1], [u0, v1]]);
}

export class ChunkView {
  constructor(scene, T, layout, rules) {
    this.scene = scene; this.T = T; this.layout = layout; this.rules = rules;
    this.groups = new Map();  // key@epoch -> { group, tubes, doors }
    this.shafts = new Map();  // stair room id -> group
    // double-sided: every wall is seen from both sides somewhere, and winding never hides a face
    const DS = THREE.DoubleSide, L = (t, o = {}) => makePaperLit(t.tex, { side: DS, ...o });
    this.mats = {
      wall: L(T.wall), wall2: L(T.wall2), floor: L(T.floor), ceiling: L(T.ceiling), planks: L(T.planks),
      locker: L(T.locker), locker2: L(T.locker2), locker3: L(T.locker3), dark: makePaperLit(null, { color: 0x1c1a18, side: DS }), lockerSide: makePaperLit(T.locker.tex, { color: 0x8c8880, side: DS }),
      notice: L(T.notice), photo1: L(T.photo1), photo2: L(T.photo2), photo3: L(T.photo3),
      step: makePaperLit(T.floor.tex, { color: 0xb8b4ac, side: DS }), riser: makePaperLit(T.wall2.tex, { color: 0x8a8680, side: DS }),
    };
    // each wing has its own walls, floor and cast of light (engine/layout/wings.js)
    const tinted = (t, color, o = {}) => makePaperLit(t.tex, { side: DS, color, ...o });
    this.wingMats = {
      main: { mats: this.mats, floor: T.floor.m },
      infants: { mats: { ...this.mats, wall: tinted(T.wall, 0xfff0dc), floor: L(T.floorLino), ceiling: tinted(T.ceiling, 0xf4ece0), lockerSide: this.mats.lockerSide }, floor: T.floorLino.m },
      science: { mats: { ...this.mats, wall: tinted(T.wallTile, 0xe6f2ee), floor: tinted(T.floor, 0xd6e0dc), ceiling: tinted(T.ceiling, 0xdde6e4) }, floor: T.floor.m },
      old: { mats: { ...this.mats, wall: L(T.wallPanel), floor: tinted(T.planks, 0xe4d4c0), ceiling: tinted(T.ceiling, 0xb8aa98) }, floor: T.planks.m },
    };
    // the dressing atlas: cut-out decals, a hair in front of whatever they're on
    T.dress.tex.premultiplyAlpha = false;
    this.mats.dress = makePaperLit(T.dress.tex, { transparent: true, side: DS });
    Object.assign(this.mats.dress, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    for (const w of Object.values(this.wingMats)) w.mats.dress = this.mats.dress;
    this.doorMats = ['door', 'door2', 'door3', 'doorFace'].map((k) => makePaperLit(T[k].tex, { side: THREE.DoubleSide }));
    this.tubeMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
    this.doorGeo = new THREE.PlaneGeometry(1.2, DOOR_H).translate(0.6, DOOR_H / 2, 0);
  }

  floorY(f) { return f * this.rules.layout.floorH; }

  // which chunks to show: the 3x3 around you on your floor; inside a stairwell, its shaft too
  sync(S) {
    const C = this.rules.layout.chunk, P = S.player;
    const pi = Math.floor(P.x / C), pj = Math.floor(P.z / C);
    const want = new Set();
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      const c = this.layout.chunk(P.floor, pi + di, pj + dj);
      const id = `${c.key}@${c.epoch}`, an = S.layout.anomalies?.[id], sig = an ? an.kind + an.seed : '-';
      want.add(id);
      const g = this.groups.get(id);
      // (re)build when it comes into view, or when the engine has just decided its anomaly
      if (g && g.anomSig !== sig) { this.dispose(g.group); this.groups.delete(id); }
      if (!this.groups.has(id)) { this.build(c, S); this.groups.get(id).anomSig = sig; }
    }
    for (const [k, g] of this.groups) if (!want.has(k)) { this.dispose(g.group); this.groups.delete(k); }
    // stair shafts belong to the ground-floor chunk; show any whose column is in view
    const shafts = new Set();
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      const c0 = this.layout.chunk(0, pi + di, pj + dj);
      if (!c0.stair) continue;
      const room = c0.rooms.find((r) => r.kind === 'stair');
      shafts.add(room.id);
      if (!this.shafts.has(room.id)) this.shafts.set(room.id, this.buildShaft(c0, room));
    }
    for (const [id, g] of this.shafts) if (!shafts.has(id)) { this.dispose(g.group); this.shafts.delete(id); }
  }

  dispose(group) {
    this.scene.remove(group);
    group.traverse((o) => { if (o.geometry && o.geometry !== this.doorGeo) o.geometry.dispose(); });
  }

  build(c, S) {
    const B = new Batch(), group = new THREE.Group(), y0 = this.floorY(c.floor), L = this.rules.layout, T = this.T;
    const WM = this.wingMats[c.wing] || this.wingMats.main;
    const ch = WING_H[c.wing] ?? L.corridorH, rh = L.roomH;
    const h = (...a) => hash32(c.key, c.epoch, ...a);
    // corridors
    for (const k of c.corridors) { flat(B, 'floor', k, y0, true, WM.floor); flat(B, 'ceiling', k, y0 + ch, false, T.ceiling.m); }
    // rooms (stair shafts are built separately)
    for (const r of c.rooms) {
      const g = this.layout.doorGap(r);
      flat(B, 'floor', g, y0, true, WM.floor);
      flat(B, 'dark', g, y0 + DOOR_H, false, [1, 1]);
      if (r.kind === 'stair') continue;
      flat(B, 'planks', r, y0, true, T.planks.m);
      flat(B, 'ceiling', r, y0 + rh, false, T.ceiling.m);
    }
    // walls: both faces of every wall box; corridor walls get lintels over doorways
    for (const w of this.layout.staticWalls(c)) {
      if (w.locker) continue;
      const room = w.kind === 'room' || w.kind === 'divider' ? c.rooms.find((r) => w.x0 >= r.x0 - 0.2 && w.x1 <= r.x1 + 0.2 && w.z0 >= r.z0 - 0.2 && w.z1 <= r.z1 + 0.2) : null;
      if (room?.kind === 'stair') continue;
      const top = y0 + (w.kind === 'room' ? rh : w.kind === 'tunnel' ? DOOR_H : ch);
      const key = w.kind === 'room' ? 'wall2' : 'wall';
      if (w.axis === 'x') { wallQuad(B, key, w.x0, w.z0, w.x1, w.z0, y0, top, 4); wallQuad(B, key, w.x1, w.z1, w.x0, w.z1, y0, top, 4); }
      else { wallQuad(B, key, w.x1, w.z0, w.x1, w.z1, y0, top, 4); wallQuad(B, key, w.x0, w.z1, w.x0, w.z0, y0, top, 4); }
    }
    for (const r of c.rooms) {
      const d = r.door, [vx, vz] = SIDE_VEC[d.side], hw = d.w / 2;
      // lintels above the doorway, on the corridor wall and on the room wall
      for (const [off, tt] of [[L.inset, ch], [0, rh]]) {
        if (r.kind === 'stair' && off === 0) continue;
        const px = d.x + vx * off, pz = d.z + vz * off;
        if (vx) { wallQuad(B, 'wall', px - 0.05, pz - hw, px - 0.05, pz + hw, y0 + DOOR_H, y0 + tt, 4); wallQuad(B, 'wall', px + 0.05, pz + hw, px + 0.05, pz - hw, y0 + DOOR_H, y0 + tt, 4); }
        else { wallQuad(B, 'wall', px + hw, pz - 0.05, px - hw, pz - 0.05, y0 + DOOR_H, y0 + tt, 4); wallQuad(B, 'wall', px - hw, pz + 0.05, px + hw, pz + 0.05, y0 + DOOR_H, y0 + tt, 4); }
      }
    }
    // lockers: a front, a top and two sides each
    for (const k of c.lockers) {
      const [fx, fz] = SIDE_VEC[k.face], key = ['locker', 'locker2', 'locker3'][h(k.id) % 3], H = 1.95;
      const top = y0 + H;
      if (fx) {
        const x = fx > 0 ? k.x1 : k.x0, xb = fx > 0 ? k.x0 : k.x1;
        // (wound so the painted front reads the right way round from the corridor)
        if (fx > 0) wallQuad(B, key, x, k.z1, x, k.z0, y0, top, 0.5); else wallQuad(B, key, x, k.z0, x, k.z1, y0, top, 0.5);
        flat(B, 'dark', { x0: k.x0, x1: k.x1, z0: k.z0, z1: k.z1 }, top, true, [1, 1]);
        wallQuad(B, 'lockerSide', xb, k.z0, x, k.z0, y0, top, 0.45); wallQuad(B, 'lockerSide', x, k.z1, xb, k.z1, y0, top, 0.45);
      } else {
        const z = fz > 0 ? k.z1 : k.z0, zb = fz > 0 ? k.z0 : k.z1;
        if (fz > 0) wallQuad(B, key, k.x0, z, k.x1, z, y0, top, 0.5); else wallQuad(B, key, k.x1, z, k.x0, z, y0, top, 0.5);
        flat(B, 'dark', { x0: k.x0, x1: k.x1, z0: k.z0, z1: k.z1 }, top, true, [1, 1]);
        wallQuad(B, 'lockerSide', k.x0, zb, k.x0, z, y0, top, 0.45); wallQuad(B, 'lockerSide', k.x1, z, k.x1, zb, y0, top, 0.45);
      }
    }
    // the dressing: the wing's ordinary things, the night's damage, and the chunk's anomaly
    // (the more pages you hold, the further gone the school looks)
    dressChunk(B, c, S, L, y0, S.layout.anomalies?.[`${c.key}@${c.epoch}`] || null, Math.min(4, actOf(S.clock.minutes) + (S.held.pages.length >= 3 ? 1 : 0)), ch);
    // where this wing meets one of another height, a strip of wall closes the gap over the corridor
    const C = L.chunk, cx = c.x0 + C / 2, cz = c.z0 + C / 2, hw = L.corridorW / 2;
    for (const [side, di, dj] of [['N', 0, -1], ['S', 0, 1], ['W', -1, 0], ['E', 1, 0]]) {
      if (!c.ports[side]) continue;
      const nh = WING_H[wingOf(this.layout.seed, c.floor, c.i + di, c.j + dj)] ?? L.corridorH;
      if (Math.abs(nh - ch) < 0.01) continue;
      const lo = y0 + Math.min(nh, ch), hi = y0 + Math.max(nh, ch);
      if (di === 0) { const z = dj < 0 ? c.z0 : c.z0 + C; wallQuad(B, 'wall', cx - hw, z, cx + hw, z, lo, hi, 4); }
      else { const x = di < 0 ? c.x0 : c.x0 + C; wallQuad(B, 'wall', x, cz - hw, x, cz + hw, lo, hi, 4); }
    }
    B.build(group, WM.mats);

    // door leaves on hinges
    const doors = [];
    for (const r of c.rooms) {
      if (r.kind === 'stair') continue;
      const d = r.door, along = d.side === 'N' || d.side === 'S' ? [1, 0] : [0, 1];
      const pivot = new THREE.Group();
      pivot.position.set(d.x - along[0] * 0.6, y0, d.z - along[1] * 0.6);
      const closed = Math.atan2(-along[1], along[0]);
      const [ix, iz] = SIDE_VEC[d.side].map((v) => -v);
      const open = Math.atan2(-iz, ix);
      const mesh = new THREE.Mesh(this.doorGeo, this.doorMats[h(d.id) % 8 === 0 ? 3 : h(d.id) % 3]);
      pivot.add(mesh);
      pivot.rotation.y = closed;
      group.add(pivot);
      doors.push({ id: d.id, pivot, closed, open });
    }

    // ceiling tubes: one merged mesh with a colour per tube
    const tubes = [], tpos = [], tidx = [], rods = new Batch();
    for (const l of c.lights) {
      const ns = !c.corridors.some((k) => k.arm && (k.arm === 'E' || k.arm === 'W') && l.z > k.z0 && l.z < k.z1 && l.x > k.x0 && l.x < k.x1);
      const globe = c.wing === 'old';
      const [ax, az] = globe ? [0.17, 0.17] : ns ? [0.1, 0.65] : [0.65, 0.1], y = y0 + ch - (globe ? 0.75 : 0.02), n = tpos.length / 3;
      if (globe) for (const [ux, uz] of [[0.015, 0], [0, 0.015]]) rods.quad('dark', [l.x - ux, y, l.z - uz], [l.x + ux, y, l.z + uz], [l.x + ux, y0 + ch, l.z + uz], [l.x - ux, y0 + ch, l.z - uz]);
      tpos.push(l.x - ax, y, l.z - az, l.x + ax, y, l.z - az, l.x + ax, y, l.z + az, l.x - ax, y, l.z + az);
      tidx.push(n, n + 2, n + 1, n, n + 3, n + 2);
      const r = h(l.id, 'tube') % 100;
      // about half the tubes are dead; the rest burn at slightly different strengths, a few flicker
      tubes.push({ id: l.id, l, x: l.x, y: y - 0.05, z: l.z, ph: (h(l.id) % 1000) / 100 }); // strength comes from the engine (lights.js)
    }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.Float32BufferAttribute(tpos, 3));
    tg.setAttribute('color', new THREE.Float32BufferAttribute(new Array(tpos.length).fill(1), 3));
    tg.setIndex(tidx);
    const tmesh = new THREE.Mesh(tg, this.tubeMat);
    group.add(tmesh);
    rods.build(group, this.mats);

    this.scene.add(group);
    this.groups.set(`${c.key}@${c.epoch}`, { group, tubes, tmesh, doors, chunk: c });
  }

  // the switchback stairwell, from the ground floor slab to the first floor's ceiling
  buildShaft(c0, room) {
    const L = this.rules.layout, H = L.floorH, s = room.x1 - room.x0, run = s - 3, B = new Batch(), group = new THREE.Group();
    // (u, v) -> world: u along the door wall, v inward from it
    const d = room.door.side;
    const W = (u, v) => {
      if (d === 'N') return [room.x0 + u, room.z0 + v];
      if (d === 'S') return [room.x0 + u, room.z1 - v];
      if (d === 'W') return [room.x0 + v, room.z0 + u];
      return [room.x1 - v, room.z0 + u];
    };
    // a box in (u, v, y) space, all six faces as quads with the given keys
    const box = (u0, u1, v0, v1, ya, yb, topKey, sideKey) => {
      const p = (u, v, y) => { const [x, z] = W(u, v); return [x, y, z]; };
      const q = (a, b, cc, dd, key) => B.quad(key, a, b, cc, dd);
      q(p(u0, v0, yb), p(u1, v0, yb), p(u1, v1, yb), p(u0, v1, yb), topKey);
      q(p(u0, v0, ya), p(u0, v1, ya), p(u1, v1, ya), p(u1, v0, ya), sideKey);
      q(p(u0, v0, ya), p(u1, v0, ya), p(u1, v0, yb), p(u0, v0, yb), sideKey);
      q(p(u1, v1, ya), p(u0, v1, ya), p(u0, v1, yb), p(u1, v1, yb), sideKey);
      q(p(u0, v1, ya), p(u0, v0, ya), p(u0, v0, yb), p(u0, v1, yb), sideKey);
      q(p(u1, v0, ya), p(u1, v1, ya), p(u1, v1, yb), p(u1, v0, yb), sideKey);
    };
    const steps = 12, rise = H / 2 / steps, sr = run / steps;
    // ground slab, flight 1, half-landing, flight 2, top landing
    box(0, s, 0, s, -0.2, 0, 'floor', 'dark');
    for (let k = 0; k < steps; k++) box(0, s / 2, 1 + k * sr, 1 + (k + 1) * sr, 0, (k + 1) * rise, 'step', 'riser');
    box(0, s, s - 2, s, H / 2 - 0.2, H / 2, 'step', 'riser');
    for (let k = 0; k < steps; k++) box(s / 2, s, s - 2 - (k + 1) * sr, s - 2 - k * sr, H / 2, H / 2 + (k + 1) * rise, 'step', 'riser');
    box(s / 2, s, 0, 1, H - 0.2, H, 'floor', 'riser');
    // the divider: a solid wall between the flights, the shaft walls, the ceiling at the top
    box(s / 2 - 0.06, s / 2 + 0.06, 0, s - 2, 0, H + 1.1, 'wall2', 'wall2');
    const top = H + L.roomH;
    const seg = (u0, u1, v0, v1, ya, yb) => { const [xa, za] = W(u0, v0), [xb, zb] = W(u1, v1); wallQuad(B, 'wall2', xa, za, xb, zb, ya, yb, 4); };
    seg(s, s, 0, s, 0, top); seg(s, 0, s, s, 0, top); seg(0, 0, s, 0, 0, top); // the three closed walls
    // the door wall: the ground doorway at u = s/4, the upper doorway at u = 3s/4, lintels over both
    const q1 = s / 4, q3 = (s * 3) / 4, dw = 0.6;
    seg(0, q1 - dw, 0, 0, 0, H); seg(q1 + dw, s, 0, 0, 0, H); seg(q1 - dw, q1 + dw, 0, 0, DOOR_H, H);
    seg(0, q3 - dw, 0, 0, H, top); seg(q3 + dw, s, 0, 0, H, top); seg(q3 - dw, q3 + dw, 0, 0, H + DOOR_H, top);
    flat(B, 'ceiling', room, top, false, this.T.ceiling.m);
    B.build(group, this.mats);
    // two tubes: over the half-landing and over the top
    const lights = [{ uv: [s / 2, s - 1], y: H / 2 + 2.6 }, { uv: [s * 0.75, 1.5], y: top - 0.05 }].map(({ uv, y }, i) => { const [x, z] = W(...uv); return { id: `${room.id}:S${i}`, x, y, z, base: i === 0 ? 0.8 : 1, flicker: i === 0, ph: 1.3 }; });
    this.scene.add(group);
    return { group, lights };
  }

  // per frame: door swings, tube colours, and the list of lights for the shader
  update(S, t) {
    const lights = [];
    const tubeI = (tb) => {
      const over = S.lights[tb.id];
      let I = (over ?? 1) * tb.base;
      if (tb.flicker && I > 0) I *= Math.sin(t * 13 + tb.ph) * Math.sin(t * 3.1 + tb.ph * 2) > 0.25 ? 0.15 : 1;
      if (S.clock.bell && I > 0) I *= Math.sin(t * 22 + tb.ph * 5) > 0 ? 1 : 0.25;
      return I;
    };
    for (const g of this.groups.values()) {
      for (const dr of g.doors) {
        const target = S.doors[dr.id]?.open ? dr.open : dr.closed;
        let diff = target - dr.pivot.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        dr.pivot.rotation.y += diff * 0.18;
      }
      const col = g.tmesh.geometry.attributes.color;
      let emergency = false;
      g.tubes.forEach((tb, i) => {
        const L = lightLevel(S, g.chunk, tb.l);
        let I = L.I;
        if (L.flicker && I > 0) I *= Math.sin(t * 13 + tb.ph) * Math.sin(t * 3.1 + tb.ph * 2) > 0.25 ? 0.15 : 1;
        if (S.clock.bell && I > 0) I *= Math.sin(t * 22 + tb.ph * 5) > 0 ? 1 : 0.25;
        emergency ||= L.state === 'emergency';
        const v = I > 0.5 ? 0.95 : I > 0.05 ? 0.5 : 0.1;
        for (let k = 0; k < 4; k++) col.setXYZ(i * 4 + k, v, v * 0.98, v * 0.9);
        lights.push({ x: tb.x, y: tb.y, z: tb.z, I });
      });
      col.needsUpdate = true;
      // emergency lighting: everything off but one weak lamp over the junction
      if (emergency) { const c = g.chunk; lights.push({ x: c.x0 + 12, y: this.floorY(c.floor) + 2.5, z: c.z0 + 12, I: 0.22 }); }
    }
    for (const sh of this.shafts.values()) for (const tb of sh.lights) lights.push({ x: tb.x, y: tb.y, z: tb.z, I: tubeI(tb) });
    return lights;
  }
}
