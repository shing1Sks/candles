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
  switch (g.room) {
    case 1: // bathroom
      if (w * d >= 3) { // bathtub
        p.push(box(x + 0.05, 0, z + 0.05, w - 0.1, 0.58, d - 0.15, 1.4));
        p.push(box(x + 0.15, 0.5, z + 0.15, w - 0.3, 0.1, d - 0.35, 0.18));
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
