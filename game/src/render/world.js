// Builds the maze: floor, walls, cracks, the vent duct and the furniture, all in shades of grey.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { T } from '../sim/level.js';
import { U, mat } from './shade.js';

export const WALL_H = 1.5;
const DUCT_H = 0.72;

// a box with its min corner at (x, y, z), tinted by a grey multiplier
function box(x, y, z, w, h, d, tint = 1) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x + w / 2, y + h / 2, z + d / 2);
  return tinted(g, tint);
}
function cyl(x, y, z, r, h, tint = 1, seg = 12, r2 = r) {
  const g = new THREE.CylinderGeometry(r2, r, h, seg);
  g.translate(x, y + h / 2, z);
  return tinted(g, tint);
}
function tinted(g, t) {
  const n = g.attributes.position.count, c = new Float32Array(n * 3).fill(t);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g.index ? g.toNonIndexed() : g;
}

// connected groups of one tile type: [{ tiles, x0, z0, x1, z1 }]
function groups(L, type) {
  const seen = new Set(), out = [];
  for (let z = 0; z < L.h; z++) for (let x = 0; x < L.w; x++) {
    if (L.at(x, z) !== type || seen.has(z * L.w + x)) continue;
    const tiles = [], st = [[x, z]];
    seen.add(z * L.w + x);
    while (st.length) {
      const [cx, cz] = st.pop(); tiles.push([cx, cz]);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, nz = cz + dz;
        if (L.at(nx, nz) === type && !seen.has(nz * L.w + nx)) { seen.add(nz * L.w + nx); st.push([nx, nz]); }
      }
    }
    const xs = tiles.map((t) => t[0]), zs = tiles.map((t) => t[1]);
    out.push({ tiles, x0: Math.min(...xs), z0: Math.min(...zs), x1: Math.max(...xs) + 1, z1: Math.max(...zs) + 1, room: L.room[z * L.w + x] });
  }
  return out;
}

function wallGeometry(L) {
  const pos = [], nor = [];
  const quad = (a, b, c, d, n) => { for (const p of [a, b, c, a, c, d]) { pos.push(...p); nor.push(...n); } };
  const solid = (x, z) => { const t = L.at(x, z); return t === T.WALL || t === T.CRACK; };
  for (let z = 0; z < L.h; z++) for (let x = 0; x < L.w; x++) {
    if (L.at(x, z) !== T.WALL) continue;
    const H = WALL_H;
    quad([x, H, z], [x, H, z + 1], [x + 1, H, z + 1], [x + 1, H, z], [0, 1, 0]);
    if (!solid(x, z + 1) && z + 1 < L.h) quad([x, 0, z + 1], [x + 1, 0, z + 1], [x + 1, H, z + 1], [x, H, z + 1], [0, 0, 1]);
    if (!solid(x, z - 1) && z > 0) quad([x + 1, 0, z], [x, 0, z], [x, H, z], [x + 1, H, z], [0, 0, -1]);
    if (!solid(x + 1, z) && x + 1 < L.w) quad([x + 1, 0, z + 1], [x + 1, 0, z], [x + 1, H, z], [x + 1, H, z + 1], [1, 0, 0]);
    if (!solid(x - 1, z) && x > 0) quad([x, 0, z], [x, 0, z + 1], [x, H, z + 1], [x, H, z], [-1, 0, 0]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  return g;
}

// skirting boards and a chair rail along every face that looks into a room or corridor
// (not into a doorway, a crack or the vent; the cellar and the tiled walls get skirting only)
function trimGeometry(L) {
  const parts = [];
  const open = (x, z) => { const t = L.at(x, z); return (t === T.FLOOR || t === T.TABLE || t === T.BED || t === T.LOW || t === T.TALL) && L.doorAt(x, z) < 0; };
  for (let z = 0; z < L.h; z++) for (let x = 0; x < L.w; x++) {
    if (L.at(x, z) !== T.WALL) continue;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz;
      if (!open(nx, nz)) continue;
      const room = L.room[nz * L.w + nx], rail = room !== 5 && room !== 1 && room !== 2;
      const add = (y, h, d, t) => {
        if (dx) parts.push(box(dx > 0 ? x + 1 : x - d, y, z, d, h, 1, t));
        else parts.push(box(x, y, dz > 0 ? z + 1 : z - d, 1, h, d, t));
      };
      add(0, 0.13, 0.025, 0.55);
      if (rail) add(0.6, 0.035, 0.02, 0.85);
    }
  }
  return parts.length ? mergeGeometries(parts) : null;
}

// a hole in the wall at kid height: two pillars and a lintel
function crackGeometry(L) {
  const parts = [];
  for (let z = 0; z < L.h; z++) for (let x = 0; x < L.w; x++) {
    if (L.at(x, z) !== T.CRACK) continue;
    const alongX = L.at(x - 1, z) === T.WALL || L.at(x + 1, z) === T.WALL; // wall runs along x, you pass along z
    const lo = 0.27, hi = 0.73, top = 0.62;
    if (alongX) {
      parts.push(box(x, 0, z, lo, WALL_H, 1), box(x + hi, 0, z, 1 - hi, WALL_H, 1), box(x + lo, top, z, hi - lo, WALL_H - top, 1));
    } else {
      parts.push(box(x, 0, z, 1, WALL_H, lo), box(x, 0, z + hi, 1, WALL_H, 1 - hi), box(x, top, z + lo, 1, WALL_H - top, hi - lo));
    }
  }
  return parts.length ? mergeGeometries(parts) : null;
}

function ductGeometry(L) {
  const parts = [];
  for (let z = 0; z < L.h; z++) for (let x = 0; x < L.w; x++) {
    if (L.at(x, z) !== T.DUCT) continue;
    const top = new THREE.PlaneGeometry(1, 1);
    top.rotateX(-Math.PI / 2); top.translate(x + 0.5, DUCT_H, z + 0.5);
    parts.push(tinted(top, 1));
  }
  return parts.length ? mergeGeometries(parts) : null;
}

// ---------- furniture ----------
function lathe(points, x, y, z, tint, seg = 16) {
  const g = new THREE.LatheGeometry(points.map(([r, h]) => new THREE.Vector2(r, h)), seg);
  g.translate(x, y, z);
  return tinted(g, tint);
}
function arc(r, tube, a0, a1, x, y, z, rotY, tint) {
  const g = new THREE.TorusGeometry(r, tube, 5, 16, a1 - a0);
  g.rotateZ(a0); g.rotateY(rotY); g.translate(x, y, z);
  return tinted(g, tint);
}
function chair(x, z, rot, p, { small = false, clothes = false } = {}) {
  const k = small ? 0.7 : 1, parts = [];
  const sh = 0.45 * k, w = 0.42 * k;
  parts.push(box(-w / 2, sh, -w / 2, w, 0.04, w, 1));
  for (const [lx, lz] of [[-w / 2, -w / 2], [w / 2 - 0.04, -w / 2], [-w / 2, w / 2 - 0.04], [w / 2 - 0.04, w / 2 - 0.04]]) parts.push(box(lx, 0, lz, 0.04, sh, 0.04, 0.8));
  for (let i = 0; i < 4; i++) parts.push(box(-w / 2 + 0.02 + i * (w - 0.06) / 3, sh, -w / 2, 0.025, 0.42 * k, 0.03, 0.85));
  parts.push(box(-w / 2, sh + 0.42 * k, -w / 2, w, 0.05, 0.035, 0.9));
  if (clothes) parts.push(box(-w / 2 - 0.02, sh + 0.1, -w / 2 - 0.03, w + 0.04, 0.38, 0.08, 1.4), box(-w / 2, sh + 0.03, -w / 2 + 0.04, w, 0.03, w * 0.6, 1.4));
  for (const g of parts) { g.rotateY(rot); g.translate(x, 0, z); p.push(g); }
}
const SPECIAL = {
  '11,4': (x, z, p) => { // nursery: a rocking chair turned to the crib, a shawl over its back
    const parts = [];
    parts.push(box(-0.24, 0.38, -0.22, 0.48, 0.04, 0.44, 1));
    for (let i = 0; i < 5; i++) parts.push(box(-0.22 + i * 0.1, 0.42, -0.24, 0.025, 0.62, 0.025, 0.85));
    parts.push(box(-0.27, 1.02, -0.26, 0.54, 0.05, 0.05, 0.9), box(-0.26, 0.6, -0.27, 0.52, 0.32, 0.03, 1.5));
    for (const sx of [-0.23, 0.2]) {
      parts.push(box(sx, 0.08, -0.2, 0.03, 0.3, 0.03, 0.8), box(sx, 0.08, 0.17, 0.03, 0.3, 0.03, 0.8), box(sx, 0.58, -0.2, 0.03, 0.03, 0.4, 0.8));
      parts.push(arc(0.62, 0.018, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55, sx + 0.015, 0.68, 0, Math.PI / 2, 0.75));
    }
    for (const g of parts) { g.rotateY(-2.4); g.translate(x + 0.5, 0, z + 0.55); p.push(g); }
  },
  '20,12': (x, z, p) => { // playroom: a rocking horse
    const parts = [];
    const b = new THREE.CapsuleGeometry(0.13, 0.42, 4, 10); b.rotateZ(Math.PI / 2); b.translate(0, 0.56, 0); parts.push(tinted(b, 1.3));
    const n = new THREE.CylinderGeometry(0.06, 0.09, 0.3, 8); n.rotateZ(-0.7); n.translate(0.3, 0.72, 0); parts.push(tinted(n, 1.3));
    const h = new THREE.BoxGeometry(0.24, 0.11, 0.1); h.rotateZ(-0.35); h.translate(0.42, 0.86, 0); parts.push(tinted(h, 1.3));
    for (let i = 0; i < 6; i++) { const m = new THREE.ConeGeometry(0.025, 0.12, 4); m.rotateZ(0.9); m.translate(0.22 + i * 0.03, 0.78 + i * 0.02, 0); parts.push(tinted(m, 0.3)); }
    const t = new THREE.ConeGeometry(0.04, 0.25, 5); t.rotateZ(-2.4); t.translate(-0.36, 0.55, 0); parts.push(tinted(t, 0.3));
    parts.push(box(-0.12, 0.68, -0.14, 0.22, 0.03, 0.28, 0.4));
    for (const lx of [-0.22, 0.22]) for (const lz of [-0.08, 0.06]) { const l = new THREE.CylinderGeometry(0.025, 0.03, 0.4, 6); l.rotateZ(lx > 0 ? -0.25 : 0.25); l.translate(lx, 0.32, lz); parts.push(tinted(l, 1.2)); }
    for (const lz of [-0.09, 0.08]) parts.push(arc(0.9, 0.02, -Math.PI / 2 - 0.42, -Math.PI / 2 + 0.42, 0, 1.0, lz, 0, 0.8));
    for (const g of parts) { g.rotateY(0.6); g.translate(x + 0.5, 0, z + 0.5); p.push(g); }
  },
  '6,18': (x, z, p) => chair(x + 0.5, z + 0.5, Math.PI, p, { clothes: true }), // bedroom: clothes over a chair
  '25,12': (x, z, p) => { // cellar: a barrel
    const prof = [[0, 0], [0.3, 0], [0.34, 0.2], [0.36, 0.42], [0.34, 0.64], [0.3, 0.84], [0, 0.84]];
    p.push(lathe(prof, x + 0.5, 0, z + 0.5, 0.75));
    for (const y of [0.12, 0.42, 0.72]) { const r = new THREE.TorusGeometry(y === 0.42 ? 0.365 : 0.33, 0.012, 4, 24); r.rotateX(Math.PI / 2); r.translate(x + 0.5, y, z + 0.5); p.push(tinted(r, 0.35)); }
  },
  '22,18': (x, z, p) => { // playroom: an open toy box, things sticking out
    p.push(box(x + 0.1, 0, z + 0.15, 0.8, 0.5, 0.7, 1.1));
    p.push(box(x + 0.1, 0.5, z + 0.12, 0.8, 0.5, 0.04, 1.0)); // lid flung open
    const b = new THREE.SphereGeometry(0.12, 10, 8); b.translate(x + 0.35, 0.55, z + 0.5); p.push(tinted(b, 1.3));
    p.push(box(x + 0.55, 0.45, z + 0.35, 0.14, 0.14, 0.14, 1.4));
    const arm = new THREE.CylinderGeometry(0.025, 0.03, 0.35, 6); arm.rotateZ(0.6); arm.translate(x + 0.7, 0.62, z + 0.6); p.push(tinted(arm, 1.6)); // a doll's arm
  },
};
const SPECIAL_TALL = {
  '24,7': (x, z, p) => { // kitchen: a dresser with plates standing on its shelves
    p.push(box(x + 0.05, 0, z + 0.08, 0.6, 0.9, 0.84, 0.6), box(x + 0.03, 0.9, z + 0.05, 0.64, 0.04, 0.9, 0.8));
    p.push(box(x + 0.05, 0.94, z + 0.08, 0.06, 0.95, 0.84, 0.6), box(x + 0.05, 1.86, z + 0.06, 0.32, 0.06, 0.88, 0.7));
    for (const y of [1.2, 1.5]) {
      p.push(box(x + 0.05, y, z + 0.08, 0.3, 0.025, 0.84, 0.7));
      for (let i = 0; i < 4; i++) { const pl = new THREE.CylinderGeometry(0.11, 0.11, 0.015, 16); pl.rotateZ(Math.PI / 2 - 0.15); pl.translate(x + 0.2, y + 0.12, z + 0.2 + i * 0.2); p.push(tinted(pl, 1.7)); }
    }
  },
  '32,14': (x, z, p) => { // cellar: the boiler, pipes climbing the wall
    p.push(lathe([[0, 0], [0.4, 0], [0.42, 0.1], [0.42, 1.3], [0.3, 1.45], [0, 1.5]], x + 0.5, 0, z + 0.5, 0.6, 20));
    for (const y of [0.3, 0.7, 1.1]) { const r = new THREE.TorusGeometry(0.425, 0.015, 4, 24); r.rotateX(Math.PI / 2); r.translate(x + 0.5, y, z + 0.5); p.push(tinted(r, 0.35)); }
    const door = new THREE.CircleGeometry(0.12, 16); door.rotateY(-Math.PI / 2); door.translate(x + 0.07, 0.4, z + 0.5); p.push(tinted(door, 0.2));
    for (const dz of [-0.2, 0.15]) {
      const v = new THREE.CylinderGeometry(0.045, 0.045, 1.0, 8); v.translate(x + 0.75, 1.5, z + 0.5 + dz); p.push(tinted(v, 0.5));
      const hz = new THREE.CylinderGeometry(0.045, 0.045, 0.35, 8); hz.rotateZ(Math.PI / 2); hz.translate(x + 0.75 - 0.17, 1.25, z + 0.5 + dz); p.push(tinted(hz, 0.5));
    }
    const gauge = new THREE.CylinderGeometry(0.06, 0.06, 0.03, 12); gauge.rotateZ(Math.PI / 2); gauge.translate(x + 0.08, 1.0, z + 0.5); p.push(tinted(gauge, 1.6));
  },
  '1,21': (x, z, p) => { // corridor: a grandfather clock in the corner
    p.push(box(x + 0.2, 0, z + 0.25, 0.6, 0.25, 0.5, 0.5), box(x + 0.25, 0.25, z + 0.3, 0.5, 1.2, 0.4, 0.55), box(x + 0.2, 1.45, z + 0.25, 0.6, 0.45, 0.5, 0.55));
    const face = new THREE.CircleGeometry(0.18, 24); face.rotateY(Math.PI); face.translate(x + 0.5, 1.67, z + 0.245); p.push(tinted(face, 2.0));
    p.push(box(x + 0.35, 0.45, z + 0.27, 0.3, 0.7, 0.02, 0.15)); // pendulum window
  },
};

function table(g) {
  const w = g.x1 - g.x0, d = g.z1 - g.z0, p = [box(g.x0 + 0.05, 0.7, g.z0 + 0.05, w - 0.1, 0.07, d - 0.1, 1)];
  for (const [lx, lz] of [[0.14, 0.14], [w - 0.21, 0.14], [0.14, d - 0.21], [w - 0.21, d - 0.21]]) p.push(box(g.x0 + lx, 0, g.z0 + lz, 0.07, 0.7, 0.07, 0.8));
  // a cloth hanging over one side, so under the table reads as a hiding place
  p.push(box(g.x0 + 0.03, 0.38, g.z1 - 0.07, w - 0.06, 0.33, 0.03, 0.75));
  return p;
}
function bed(g, crib) {
  const w = g.x1 - g.x0, d = g.z1 - g.z0, p = [];
  const legs = [[0.08, 0.08], [w - 0.16, 0.08], [0.08, d - 0.16], [w - 0.16, d - 0.16]];
  if (crib) {
    p.push(box(g.x0 + 0.08, 0.42, g.z0 + 0.08, w - 0.16, 0.14, d - 0.16, 1.2));
    for (const [lx, lz] of legs) p.push(box(g.x0 + lx, 0, g.z0 + lz, 0.08, 1.05, 0.08, 0.9));
    for (const zz of [0.1, d - 0.14]) p.push(box(g.x0 + 0.1, 0.98, g.z0 + zz, w - 0.2, 0.05, 0.05, 0.9));
    for (const xx of [0.1, w - 0.14]) p.push(box(g.x0 + xx, 0.98, g.z0 + 0.1, 0.05, 0.05, d - 0.2, 0.9));
    for (let t = 0.22; t < d - 0.2; t += 0.13) for (const xx of [0.1, w - 0.13]) p.push(box(g.x0 + xx, 0.56, g.z0 + t, 0.03, 0.42, 0.03, 0.9));
    for (let t = 0.22; t < w - 0.2; t += 0.13) for (const zz of [0.1, d - 0.13]) p.push(box(g.x0 + t, 0.56, g.z0 + zz, 0.03, 0.42, 0.03, 0.9));
    p.push(box(g.x0 + 0.5, 0.56, g.z0 + 1.2, 0.35, 0.14, 0.3, 1.5)); // a small blanket left in a heap
  } else {
    for (const [lx, lz] of legs) p.push(box(g.x0 + lx, 0, g.z0 + lz, 0.08, 0.42, 0.08, 0.7));
    p.push(box(g.x0 + 0.04, 0.38, g.z0 + 0.04, w - 0.08, 0.1, d - 0.08, 0.7));
    p.push(box(g.x0 + 0.08, 0.48, g.z0 + 0.08, w - 0.16, 0.14, d - 0.16, 1.35));
    p.push(box(g.x0 + 0.2, 0.62, g.z0 + 0.15, w - 0.4, 0.1, 0.38, 1.6)); // pillow
    p.push(box(g.x0 + 0.06, 0.6, g.z0 + 0.7, w - 0.12, 0.08, d - 0.78, 1.0)); // blanket
    p.push(box(g.x0 + 0.04, 0.6, g.z0 + 0.62, 0.04, 0.28, d - 0.7, 1.0), box(g.x1 - 0.08, 0.6, g.z0 + 0.62, 0.04, 0.28, d - 0.7, 1.0)); // blanket hanging down
    p.push(box(g.x0, 0, g.z0, w, 1.0, 0.07, 0.75)); // headboard
  }
  return p;
}
function low(g) {
  const w = g.x1 - g.x0, d = g.z1 - g.z0, x = g.x0, z = g.z0, p = [];
  const sp = SPECIAL[`${x},${z}`];
  if (sp && w * d === 1) { sp(x, z, p); return p; }
  switch (g.room) {
    case 1: // bathroom
      if (w * d >= 3) { // a clawfoot bathtub, black water in it
        const tub = new THREE.CapsuleGeometry(0.36, w - 0.9, 6, 16); tub.rotateZ(Math.PI / 2); tub.scale(1, 0.75, 1); tub.translate(x + w / 2, 0.42, z + 0.48); p.push(tinted(tub, 1.45));
        p.push(box(x + 0.25, 0.6, z + 0.2, w - 0.5, 0.03, 0.56, 0.08));
        for (const [fx, fz] of [[0.3, 0.25], [w - 0.3, 0.25], [0.3, 0.72], [w - 0.3, 0.72]]) { const f = new THREE.SphereGeometry(0.05, 8, 6); f.translate(x + fx, 0.05, z + fz); p.push(tinted(f, 0.5)); }
        const tap = new THREE.CylinderGeometry(0.02, 0.02, 0.25, 6); tap.translate(x + w - 0.25, 0.8, z + 0.3); p.push(tinted(tap, 1.6));
      } else {
        p.push(cyl(x + 0.5, 0, z + 0.4, 0.2, 0.42, 1.5, 14, 0.24), box(x + 0.25, 0, z + 0.02, 0.5, 0.8, 0.2, 1.4)); // toilet
        p.push(cyl(x + 1.5, 0, z + 0.3, 0.08, 0.8, 1.3), box(x + 1.25, 0.8, z + 0.05, 0.5, 0.12, 0.42, 1.5)); // sink
      }
      break;
    case 2: // kitchen
      if (w * d >= 3) {
        p.push(box(x, 0, z, w, 0.88, d - 0.2, 0.8), box(x - 0.02, 0.88, z, w + 0.04, 0.06, d - 0.15, 1.2));
        for (let i = 0; i < w; i++) p.push(box(x + i + 0.08, 0.1, z + d - 0.21, 0.84, 0.7, 0.02, 0.65));
      } else {
        p.push(box(x + 0.05, 0, z + 0.05, w - 0.1, 0.88, d - 0.15, 0.55));
        for (const [bx, bz] of [[0.3, 0.3], [0.7, 0.3], [0.3, 0.65], [0.7, 0.65]]) p.push(cyl(x + bx, 0.88, z + bz, 0.12, 0.03, 0.12));
      }
      break;
    case 5: // cellar: crates
      for (const [tx, tz] of g.tiles) {
        const s = 0.8 + ((tx * 7 + tz * 3) % 3) * 0.06;
        p.push(box(tx + (1 - s) / 2, 0, tz + (1 - s) / 2, s, s * 0.95, s, 0.75));
        p.push(box(tx + (1 - s) / 2 - 0.01, s * 0.3, tz + (1 - s) / 2 - 0.01, s + 0.02, 0.08, s + 0.02, 0.55));
        p.push(box(tx + (1 - s) / 2 - 0.01, s * 0.7, tz + (1 - s) / 2 - 0.01, s + 0.02, 0.08, s + 0.02, 0.55));
      }
      break;
    case 4: // playroom: a doll's house
      p.push(box(x + 0.1, 0, z + 0.15, 0.8, 0.6, 0.7, 1.1));
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) p.push(box(x + 0.2 + i * 0.4, 0.12 + j * 0.25, z + 0.84, 0.18, 0.14, 0.02, 0.15));
      {
        const roof = new THREE.CylinderGeometry(0.01, 0.6, 0.4, 4, 1);
        roof.rotateY(Math.PI / 4); roof.translate(x + 0.5, 0.8, z + 0.5);
        p.push(tinted(roof, 0.7));
      }
      break;
    default: // toy chest, nightstand
      p.push(box(x + 0.1, 0, z + 0.2, 0.8, 0.55, 0.6, 0.9), box(x + 0.08, 0.55, z + 0.18, 0.84, 0.06, 0.64, 1.1));
  }
  return p;
}
function tall(g) {
  const w = g.x1 - g.x0, d = g.z1 - g.z0, x = g.x0, z = g.z0, p = [];
  const sp = SPECIAL_TALL[`${x},${z}`];
  if (sp && w * d === 1) { sp(x, z, p); return p; }
  if (g.room === 5 || g.room === 1) { // open shelves with jars and boxes
    const H = g.room === 5 ? 1.9 : 1.6;
    for (const [px, pz] of [[0, 0], [w - 0.06, 0], [0, d - 0.06], [w - 0.06, d - 0.06]]) p.push(box(x + px, 0, z + pz, 0.06, H, 0.06, 0.6));
    for (let y = 0.05; y < H; y += 0.45) {
      p.push(box(x, y, z, w, 0.04, d, 0.75));
      for (let i = 0; i < w * d * 3; i++) {
        const h = ((x * 13 + z * 7 + i * 5 + y * 11) % 7) / 7;
        if (h < 0.3) continue;
        const s = 0.15 + h * 0.18;
        p.push(box(x + 0.08 + ((i * 0.37) % Math.max(0.1, w - 0.3)), y + 0.04, z + 0.08 + ((i * 0.61) % Math.max(0.1, d - 0.3)), s, s * 1.2, s, 0.5 + h * 0.6));
      }
    }
  } else { // wardrobe or fridge
    p.push(box(x + 0.04, 0, z + 0.04, w - 0.08, 1.95, d - 0.08, g.room === 2 ? 1.5 : 0.7));
    p.push(box(x + w / 2 - 0.01, 0.1, z + d - 0.05, 0.02, 1.75, 0.02, 0.2));
  }
  return p;
}

// small things on the floor and walls that don't block anyone
function decor(L) {
  const p = [];
  const rug = (cx, cz, rx, rz, t) => { const g = new THREE.CylinderGeometry(1, 1, 0.012, 32); g.scale(rx, 1, rz); g.translate(cx, 0.006, cz); p.push(tinted(g, t)); };
  rug(8, 10.2, 1.6, 0.5, 0.9); // nursery
  rug(18.5, 16, 2.6, 2.0, 0.85); // playroom
  rug(10.5, 15.5, 1, 1.4, 0.8); // bedroom
  // chairs tucked under the kitchen and playroom tables
  for (const [cx, cz, r] of [[27.6, 5.75, 0], [28.9, 5.75, 0], [27.6, 8.25, Math.PI], [28.9, 8.25, Math.PI]]) chair(cx, cz, r, p);
  for (const [cx, cz, r] of [[17.6, 14.8, 0], [19.2, 14.8, 0], [18.3, 17.2, Math.PI]]) chair(cx, cz, r, p, { small: true });
  // kitchen: plates, cups and a jug on the table; a pot on the stove; a kettle on the counter
  for (const [px, pz] of [[27.6, 6.3], [28.9, 6.3], [27.6, 7.7], [28.9, 7.7]]) {
    const pl = new THREE.CylinderGeometry(0.12, 0.1, 0.02, 16); pl.translate(px, 0.75, pz); p.push(tinted(pl, 1.8));
    const cup = new THREE.CylinderGeometry(0.04, 0.035, 0.08, 10); cup.translate(px + 0.17, 0.78, pz); p.push(tinted(cup, 1.7));
  }
  p.push(lathe([[0, 0], [0.07, 0], [0.09, 0.08], [0.06, 0.2], [0.07, 0.24], [0, 0.24]], 28.25, 0.74, 7.0, 1.5));
  p.push(lathe([[0, 0], [0.18, 0], [0.19, 0.16], [0, 0.16]], 32.5, 0.9, 4.45, 0.45));
  p.push(lathe([[0, 0], [0.1, 0], [0.11, 0.1], [0.05, 0.2], [0, 0.22]], 26.6, 0.94, 4.4, 0.9));
  // bathroom: a mirror over the sink, a towel on a rail
  p.push(box(15.25, 1.0, 4.0, 0.5, 0.42, 0.03, 0.5), box(15.29, 1.04, 4.025, 0.42, 0.34, 0.01, 2.1));
  p.push(box(17.1, 0.95, 4.0, 0.6, 0.03, 0.06, 1.4), box(17.15, 0.55, 4.04, 0.5, 0.42, 0.02, 1.3));
  // bedroom: a lamp on the nightstand, slippers by the bed, a book face down
  p.push(lathe([[0, 0], [0.07, 0], [0.04, 0.03], [0.02, 0.25], [0, 0.25]], 4.45, 0.61, 18.4, 0.9));
  p.push(lathe([[0.06, 0], [0.14, 0], [0.09, 0.15], [0.05, 0.15]], 4.45, 0.82, 18.4, 1.5));
  for (const sx of [0, 0.13]) { const sl = new THREE.SphereGeometry(1, 8, 6); sl.scale(0.045, 0.03, 0.11); sl.translate(6.6 + sx, 0.03, 15.6); p.push(tinted(sl, 1.4)); }
  p.push(box(9.2, 0.0, 13.3, 0.22, 0.03, 0.3, 1.1));
  // nursery: a teddy left in the crib
  { const parts = [[0.08, 0, 0.07, 0], [0.06, 0, 0.18, 0], [0.025, -0.045, 0.23, 0], [0.025, 0.045, 0.23, 0]];
    for (const [r, ox, oy] of parts) { const g = new THREE.SphereGeometry(r, 10, 8); g.translate(7.7 + ox, 0.56 + oy, 7.3); p.push(tinted(g, 1.1)); } }
  // runner rugs down the corridors
  rug(18.5, 20.5, 14, 0.55, 0.7); rug(1.5, 11, 0.55, 8, 0.7); rug(34.5, 11, 0.55, 8, 0.7); rug(8, 1.5, 5, 0.5, 0.7); rug(29, 1.5, 5, 0.5, 0.7);
  // coats on hooks, a wall clock, sconces with dead candles
  for (const [cx, cz] of [[2.99, 3.5], [2.99, 4.3]]) { p.push(box(cx - 0.03, 1.1, cz, 0.03, 0.04, 0.04, 0.4)); p.push(box(cx - 0.1, 0.45, cz - 0.15, 0.1, 0.7, 0.32, 0.55)); }
  { const f = new THREE.CylinderGeometry(0.17, 0.17, 0.04, 20); f.rotateX(Math.PI / 2); f.translate(18.5, 1.2, 19.98); p.push(tinted(f, 1.7)); p.push(box(18.49, 1.2, 19.95, 0.015, 0.12, 0.01, 0.1), box(18.49, 1.2, 19.95, 0.09, 0.015, 0.01, 0.1)); }
  for (const [sx, sz] of [[9, 2.999], [27, 2.999], [9, 19.999], [27, 19.999]]) {
    const dir = sz < 10 ? 1 : -1;
    p.push(box(sx - 0.05, 0.95, sz + (dir > 0 ? 0 : -0.06), 0.1, 0.12, 0.06, 0.6));
    const c = new THREE.CylinderGeometry(0.02, 0.02, 0.1, 8); c.translate(sx, 1.12, sz + dir * 0.06); p.push(tinted(c, 1.5));
  }
  // children's drawings dropped on the floor
  for (const [dx, dz, r] of [[9.6, 8.6, 0.3], [16.2, 16.6, -0.5], [20.1, 13.4, 1.2], [5.8, 13.6, 0.8], [30.2, 18.3, -0.2]]) {
    const g = new THREE.PlaneGeometry(0.21, 0.3); g.rotateX(-Math.PI / 2); g.rotateY(r); g.translate(dx, 0.004, dz); p.push(tinted(g, 2.2));
  }
  // a doll sitting against the wall, facing the room
  p.push(box(6.1, 0, 4.05, 0.22, 0.22, 0.16, 1.2));
  { const h = new THREE.SphereGeometry(0.11, 12, 8); h.translate(6.21, 0.33, 4.13); p.push(tinted(h, 1.6)); }
  // picture frames high on the walls
  for (const [x, z, n] of [[7, 4, 1], [17, 12, 1], [27, 12, 1], [8, 12, 1], [5, 10.999, -1], [29, 10.999, -1]]) {
    p.push(box(x, 0.95, n > 0 ? z : z - 0.04, 0.5, 0.38, 0.04, 0.35));
    p.push(box(x + 0.06, 1.0, n > 0 ? z + 0.02 : z - 0.06, 0.38, 0.28, 0.04, 0.9));
  }
  return p;
}

export function buildWorld(L, scene) {
  // room ids for the floor patterns
  const data = new Uint8Array(L.w * L.h * 4);
  for (let i = 0; i < L.w * L.h; i++) data[i * 4] = L.room[i] + 1;
  const room = new THREE.DataTexture(data, L.w, L.h);
  room.needsUpdate = true;
  U.uRoom.value = room;
  U.uSize.value.set(L.w, L.h);

  const floor = new THREE.PlaneGeometry(L.w, L.h);
  floor.rotateX(-Math.PI / 2); floor.translate(L.w / 2, 0, L.h / 2);
  scene.add(new THREE.Mesh(floor, mat({ color: 1, pattern: 1 })));
  scene.add(new THREE.Mesh(wallGeometry(L), mat({ color: 0.5, pattern: 3, cut: true })));
  scene.add(new THREE.Mesh(trimGeometry(L), mat({ color: 0.42, vcol: true, cut: true })));
  const crack = crackGeometry(L);
  if (crack) scene.add(new THREE.Mesh(crack, mat({ color: 0.5, pattern: 2, cut: true, vcol: true })));
  const duct = ductGeometry(L);
  if (duct) scene.add(new THREE.Mesh(duct, mat({ color: 0.42, pattern: 4, vcol: true, side: THREE.DoubleSide })));

  const furn = [], tallParts = [];
  for (const g of groups(L, T.TABLE)) furn.push(...table(g));
  for (const g of groups(L, T.BED)) furn.push(...bed(g, g.room === 0));
  for (const g of groups(L, T.LOW)) furn.push(...low(g));
  for (const g of groups(L, T.TALL)) if (!L.wardrobes.some((w) => w.tx === g.x0 && w.tz === g.z0)) tallParts.push(...tall(g));
  furn.push(...decor(L));
  scene.add(new THREE.Mesh(mergeGeometries(furn.map(clean)), mat({ color: 0.4, vcol: true, cut: 2 })));
  scene.add(new THREE.Mesh(mergeGeometries(tallParts.map(clean)), mat({ color: 0.4, vcol: true, cut: true })));
}

// merge needs identical attribute sets
function clean(g) {
  const out = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'uv', 'color']) out.setAttribute(k, g.attributes[k]);
  return out;
}
