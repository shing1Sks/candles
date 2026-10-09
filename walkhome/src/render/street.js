// A SEGMENT OF STREET (24 m of road, both sides), built from the town data: the road's cross-
// section (cambered cobbles, a gutter, a real kerb face, pavement slabs, front gardens), the houses
// and their windows, garden boundaries with gates and paths, the things in the gardens, trees, and
// the street lamps. One Kit per segment, so the whole segment is a couple of dozen draw calls.
import * as THREE from 'three';
import { makeRng } from '../../../engine/rng.js';
import { ROAD, at as roadAt, N as roadN, C as roadC } from '../sim/road.js';
import { Kit, box, cyl, cone, sphere, tube, limb, xf, V3 } from './kit.js';
import { U, lampify } from './materials.js';
import { buildHouse, houseFrame } from './house.js';
import { WindowBatch } from './windows.js';
import { beamMaterial } from './lamps.js';
import { regionContent, homeSpec, shopWindow } from './regions.js';
import { puddles } from './fx.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// the loose one-off meshes in a segment (posters, doll heads, signs, numbers...) that share a
// material become one mesh each: hundreds of draw calls down to a handful. Anything that moves is
// marked userData.dynamic and left alone
function mergeStatic(group) {
  const sets = new Map();
  for (const o of group.children) {
    if (!o.isMesh || o.isInstancedMesh || o.children.length || o.userData.dynamic || !o.visible) continue;
    const g = o.geometry, key = o.material.uuid + '|' + Object.keys(g.attributes).sort().join(',') + '|' + (g.index ? 'i' : 'n') + '|' + o.renderOrder;
    (sets.get(key) || sets.set(key, []).get(key)).push(o);
  }
  for (const list of sets.values()) {
    if (list.length < 2) continue;
    const geos = list.map((o) => { o.updateMatrix(); return o.geometry.clone().applyMatrix4(o.matrix); });
    const merged = mergeGeometries(geos, false); if (!merged) continue;
    const m = new THREE.Mesh(merged, list[0].material); m.customDepthMaterial = list[0].customDepthMaterial; m.renderOrder = list[0].renderOrder;
    m.castShadow = list.some((o) => o.castShadow) && list.length < 20; m.receiveShadow = list.some((o) => o.receiveShadow);
    for (const o of list) { group.remove(o); o.geometry.dispose(); }
    geos.forEach((g) => g.dispose());
    group.add(m);
  }
}
import { details } from './details.js';

// the road's cross-section, from the centre line outward: [l, y, material of the strip from the previous point]
const PROFILE = [
  [0, 0, null], [1.4, -0.025, 'cobble'], [2.8, -0.075, 'cobble'], [2.8, 0.13, 'kerb'], [3.05, 0.13, 'kerb'],
  [4.8, 0.115, 'slab'], [4.8, 0.14, 'grass'], [ROAD.front + 0.3, 0.16, 'grass'], [14, 0.22, 'grass'], [40, 0.6, 'grass'], [90, 3.5, 'grass'],
];

function crossSection(kit, s0, s1) {
  const n = Math.max(2, Math.ceil((s1 - s0) / 1.0));
  for (const side of [-1, 1]) {
    for (let k = 1; k < PROFILE.length; k++) {
      const [l0, y0] = PROFILE[k - 1], [l1, y1, mat] = PROFILE[k];
      const pos = [], uv = [], idx = [];
      for (let i = 0; i <= n; i++) {
        const s = s0 + (s1 - s0) * i / n, c = roadC(s), N = roadN(s);
        for (const [l, y] of [[l0, y0], [l1, y1]]) {
          const L = side * l, rise = l > 12 ? Math.sin(s * 0.05 + l * 0.2) * Math.min(1, (l - 12) / 20) * 1.2 : 0;
          pos.push(c.x + N.x * L, c.y + y + rise, c.z + N.z * L);
          uv.push(l0 === l1 ? (y - y0) * side : L, s); // vertical strips map their height
        }
        if (i < n) { const a = i * 2; side > 0 ? idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) : idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
      // vertical kerb faces: face the road
      kit.add(g, mat, mat === 'grass' ? 0x9aa08a : 0xffffff);
    }
  }
}

// the yard: boundary along the pavement (with a gate gap), a path to the door, the garden things
function yard(kit, o, F, r) {
  const fx = o.d / 2, edge = fx + ROAD.yard - 0.12, dz = o.doorZ, Y = { matrix: F.matrix, lean: () => [0, 0, 0] };
  const A = (g, m, c, wind) => kit.add(g, m, c, Y, wind);
  const runs = [[-o.w / 2 - 0.6, dz - 0.65], [dz + 0.65, o.w / 2 + 0.6]].filter(([a, b]) => b - a > 0.2);
  if (o.boundary === 'picket') {
    for (const [a, b] of runs) {
      for (let z = a + 0.08; z < b; z += 0.16) { const h = 0.9 + r.range(-0.04, 0.06), tl = r.range(-0.06, 0.06); A(xf(box(0.025, h, 0.09), edge, h / 2, z, tl, 0, tl * 0.4), 'paint', 0xd8d4c8); A(xf(box(0.025, 0.07, 0.07), edge, h, z, Math.PI / 4 + tl, 0, tl * 0.4), 'paint', 0xd8d4c8); }
      for (const y of [0.3, 0.72]) A(xf(box(0.04, 0.07, b - a), edge - 0.04, y, (a + b) / 2), 'paint', 0xc8c4b8);
    }
    // the gate, left a little open
    const g = box(0.04, 0.85, 1.1); g.translate(0, 0, 0.55); A(xf(g, edge, 0.5, dz - 0.62, 0, -0.55), 'paint', 0xc8c4b8);
  } else if (o.boundary === 'iron') {
    for (const [a, b] of runs) {
      for (let z = a + 0.06; z < b; z += 0.13) { A(xf(cyl(0.012, 0.012, 1.1, 5), edge, 0.6, z), 'metal', 0x18181c); A(xf(cone(0.03, 0.12, 5), edge, 1.2, z), 'metal', 0x18181c); }
      for (const y of [0.18, 1.0]) A(xf(box(0.03, 0.04, b - a), edge, y, (a + b) / 2), 'metal', 0x18181c);
    }
    for (const sg of [-1, 1]) { A(xf(box(0.3, 1.25, 0.3), edge, 0.62, dz + sg * 0.75), 'slab', 0x9a968c); A(xf(sphere(0.14, 10, 8), edge, 1.38, dz + sg * 0.75), 'slab', 0x9a968c); }
  } else if (o.boundary === 'wall') {
    for (const [a, b] of runs) { A(xf(box(0.3, 0.7, b - a, 1, 1, Math.ceil(b - a)), edge, 0.35, (a + b) / 2), 'brick', 0xffffff); A(xf(box(0.38, 0.08, b - a), edge, 0.74, (a + b) / 2), 'slab', 0xa8a49a); }
  } else if (o.boundary === 'hedge') {
    for (const [a, b] of runs) {
      A(xf(box(0.75, 1.3, b - a, 1, 2, Math.ceil(b - a)), edge - 0.25, 0.65, (a + b) / 2), 'hedge', 0x7a8a6a, (y) => Math.max(0, y - 0.4) * 0.05);
      for (let z = a + 0.3; z < b - 0.2; z += 0.55) A(xf(new THREE.IcosahedronGeometry(r.range(0.3, 0.45), 1), edge - 0.2 + r.range(-0.1, 0.1), 1.25 + r.range(-0.1, 0.1), z), 'hedge', 0x7a8a6a, (y) => 0.06);
    }
  }
  // the path up to the steps
  A(xf(box(ROAD.yard - 0.1, 0.06, 1.05), fx + (ROAD.yard - 0.1) / 2 + 0.7, 0.03, dz), 'slab', 0xb0aca4);
}

function prop(kit, p, o, F, r) {
  const Y = { matrix: F.matrix, lean: () => [0, 0, 0] }, A = (g, m, c, wind) => kit.add(g, m, c, Y, wind);
  const x = o.d / 2 + p.local.x, z = p.local.z;
  switch (p.kind) {
    case 'bin': {
      const c = r.pick([0x2a4a36, 0x2a2c34, 0x5a2626, 0x3a3a46]);
      A(xf(box(0.6, 0.95, 0.72, 1, 2, 1), x, 0.48, z, 0, r.range(-0.3, 0.3)), 'plastic', c);
      A(xf(box(0.66, 0.08, 0.8), x - 0.02, 0.99, z, 0, 0, r.chance(0.3) ? 0.35 : 0.03), 'plastic', c);
      for (const sg of [-1, 1]) A(xf(cyl(0.1, 0.1, 0.06, 10), x - 0.3, 0.1, z + sg * 0.26, Math.PI / 2), 'dark', 0x111111);
      break;
    }
    case 'gnome': {
      const ry = r.range(-1, 1);
      A(xf(cyl(0.11, 0.15, 0.28, 10), x, 0.14, z), 'paint', 0x3a5a9a);
      A(xf(sphere(0.1, 10, 8), x, 0.36, z), 'paint', 0xe8c0a0);
      A(xf(cone(0.09, 0.2, 10), x + 0.04, 0.27, z, 0, ry, Math.PI), 'paint', 0xe8e4dc);
      A(xf(cone(0.11, 0.32, 10), x, 0.57, z, 0, 0, 0.25), 'paint', 0xb02a24);
      A(xf(box(0.04, 0.06, 0.03), x + 0.1, 0.38, z + 0.04), 'dark', 0); A(xf(box(0.04, 0.06, 0.03), x + 0.1, 0.38, z - 0.04), 'dark', 0);
      break;
    }
    case 'bush': for (let k = 0; k < 4; k++) A(xf(new THREE.IcosahedronGeometry(r.range(0.3, 0.5), 1), x + r.range(-0.3, 0.3), r.range(0.35, 0.7), z + r.range(-0.4, 0.4)), 'hedge', 0x8a9a7a, () => 0.05); break;
    case 'topiary':
      A(xf(cyl(0.2, 0.15, 0.3, 10), x, 0.15, z), 'paint', 0x8a4a3a); A(xf(cyl(0.025, 0.025, 0.6, 5), x, 0.6, z), 'wood', 0x3a2a20);
      A(xf(sphere(0.3, 12, 10), x, 1.05, z), 'hedge', 0x8a9a7a, () => 0.03); A(xf(sphere(0.19, 10, 8), x, 1.5, z), 'hedge', 0x8a9a7a, () => 0.05);
      break;
    case 'swing': {
      for (const sz of [-0.9, 0.9]) for (const sx of [-0.5, 0.5]) A(limb(V3(x + sx, 0, z + sz), V3(x, 2.0, z + sz * 0.95), 0.045), 'wood', 0x6a4a3a);
      A(limb(V3(x, 2.0, z - 0.95), V3(x, 2.0, z + 0.95), 0.05), 'wood', 0x6a4a3a);
      // the seat hangs still for now; the swing is animated separately when it moves on its own
      for (const sz of [-0.25, 0.25]) A(limb(V3(x, 2.0, z + sz), V3(x, 0.45, z + sz), 0.01), 'dark', 0);
      A(xf(box(0.28, 0.04, 0.6), x, 0.44, z), 'paint', 0x8a3a3a);
      break;
    }
    case 'washing': {
      for (const sz of [-1.3, 1.3]) A(xf(cyl(0.035, 0.035, 1.9, 6), x, 0.95, z + sz), 'metal', 0x5a5a6a);
      A(limb(V3(x, 1.85, z - 1.3), V3(x, 1.85, z + 1.3), 0.008), 'dark', 0);
      for (const [t, ww, hh, c] of [[-0.6, 0.75, 1.0, 0xd8d0e0], [0.2, 0.5, 0.65, 0xb0c4d8], [0.85, 0.4, 0.5, 0xe0c8c8]]) {
        const g = new THREE.PlaneGeometry(ww, hh, 4, 6), pa = g.attributes.position; for (let i = 0; i < pa.count; i++) pa.setZ(i, Math.sin(pa.getY(i) * 4 + pa.getX(i) * 3) * 0.04);
        g.computeVertexNormals(); g.rotateY(Math.PI / 2);
        A(xf(g, x, 1.82 - hh / 2, z + t), 'cloth', c, (y) => Math.max(0, 1.8 - y) * 0.12);
      }
      break;
    }
    case 'trike':
      for (const [dx, rr, dzz] of [[0, 0.2, 0], [0.45, 0.13, -0.2], [0.45, 0.13, 0.2]]) { const g = new THREE.TorusGeometry(rr, 0.025, 6, 14); A(xf(g, x + dx, rr, z + dzz), 'dark', 0); }
      A(limb(V3(x, 0.2, z), V3(x + 0.45, 0.22, z), 0.025), 'paint', 0xc03030); A(limb(V3(x, 0.2, z), V3(x - 0.04, 0.55, z), 0.022), 'paint', 0xc03030);
      A(xf(box(0.18, 0.05, 0.13), x + 0.35, 0.4, z), 'dark', 0);
      break;
    case 'mailbox':
      A(xf(cyl(0.04, 0.04, 1.0, 6), x, 0.5, z), 'wood', 0x4a3a2a); A(xf(box(0.45, 0.24, 0.24), x, 1.1, z), 'paint', 0x3a4a6a);
      A(xf(box(0.03, 0.2, 0.08), x - 0.05, 1.32, z + 0.13, 0, 0, 0.6), 'paint', 0xc0302a);
      break;
    case 'pram': {
      A(xf(sphere(0.38, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), x, 0.55, z, Math.PI, 0, 0, 1.3, 0.8, 1), 'paint', 0x2a2a34);
      A(xf(sphere(0.38, 12, 8, 0, Math.PI, 0, Math.PI / 2), x - 0.1, 0.6, z, 0, Math.PI / 2, 0, 1.0, 1.0, 1.3), 'cloth', 0x2a2a34, () => 0.01);
      for (const sx of [-0.35, 0.35]) for (const sz of [-0.28, 0.28]) A(xf(new THREE.TorusGeometry(0.15, 0.02, 6, 14), x + sx, 0.15, z + sz), 'dark', 0);
      break;
    }
  }
}

// a bare tree, the way it is in the drawing: a thick, slightly twisted trunk with a root flare, then
// four generations of branches, each thinner and more crooked, the last ones curling into hooks
function tree(kit, t) {
  const r = makeRng('tree:' + t.seed), base = roadAt(t.s, t.l), h = t.h;
  const root = V3(base.x, base.y + 0.05, base.z);
  // root flare
  kit.add(xf(cyl(0.26, 0.5, 0.7, 9), base.x, base.y + 0.3, base.z, 0, r.range(0, 6)), 'bark', 0xffffff, null, 0);
  const branch = (from, dir, len, rad, depth) => {
    const pts = [from.clone()]; let p = from.clone(), d = dir.clone();
    const n = depth < 2 ? 7 : 5, curl = depth >= 3 ? r.range(1.2, 2.4) * (r.chance(0.5) ? 1 : -1) : r.range(-0.3, 0.3);
    const axis = V3(r.range(-1, 1), r.range(-0.2, 0.2), r.range(-1, 1)).normalize();
    for (let i = 1; i <= n; i++) {
      d.add(V3(r.range(-0.18, 0.18), r.range(-0.06, 0.1), r.range(-0.18, 0.18)));
      if (curl) d.applyAxisAngle(axis, curl / n * (i / n) * 2);
      d.normalize(); p = p.clone().addScaledVector(d, len / n); pts.push(p);
    }
    const w = depth === 0 ? 0 : 0.004 * depth * depth;
    kit.add(tube(pts, rad, depth < 2 ? 10 : depth < 3 ? 6 : 4, depth < 2 ? 7 : depth < 3 ? 4 : 3), 'bark', 0xffffff, null, (y) => w * Math.max(0, y - root.y) / h * 3);
    if (depth >= 4) return;
    const kids = depth === 0 ? 4 : depth === 3 ? 2 : 3;
    for (let k = 0; k < kids; k++) {
      const at = pts[Math.min(pts.length - 1, Math.floor(pts.length * r.range(0.45, 0.95)))];
      const nd = d.clone().applyAxisAngle(V3(0, 1, 0), (k / kids) * 6.28 + r.range(-0.5, 0.5)).add(V3(0, r.range(0.1, 0.6), 0));
      nd.add(V3(r.range(-0.6, 0.6), 0, r.range(-0.6, 0.6))).normalize();
      branch(at, nd, len * r.range(0.55, 0.72), rad * r.range(0.5, 0.62), depth + 1);
    }
  };
  branch(root, V3(r.range(-0.12, 0.12), 1, r.range(-0.12, 0.12)).normalize(), h * 0.5, t.park ? 0.3 : 0.22, 0);
}

// telegraph poles and their sagging wires: the town's lines drawn against the sky
function poles(kit, town, s0, s1) {
  for (let i = 0; i < town.poles.length; i++) {
    const P = town.poles[i]; if (P.s < s0 || P.s >= s1) continue;
    const b = roadAt(P.s, P.l), top = b.y + 8.2, lean = P.lean;
    kit.add(limb(V3(b.x, b.y, b.z), V3(b.x + lean, top, b.z), 0.15, 0.11, 8), 'wood', 0x6a5a4a);
    kit.add(xf(box(0.12, 0.12, 1.9), b.x + lean, top - 0.35, b.z, 0, 0, 0), 'wood', 0x5a4a3a);
    for (const dz of [-0.8, -0.3, 0.3, 0.8]) kit.add(xf(cyl(0.035, 0.045, 0.12, 6), b.x + lean, top - 0.22, b.z + dz), 'paint', 0x2a3a2a);
    const Q = town.poles[i + 1];
    if (!Q) continue;
    const c = roadAt(Q.s, Q.l);
    for (const dz of [-0.8, -0.3, 0.3, 0.8]) {
      const a = V3(b.x + lean, top - 0.16, b.z + dz), e = V3(c.x + Q.lean, c.y + 8.2 - 0.16, c.z + dz), m = a.clone().lerp(e, 0.5); m.y -= 0.9 + Math.abs(dz) * 0.15;
      kit.add(tube(new THREE.QuadraticBezierCurve3(a, m, e), 0.012, 20, 3), 'dark', 0);
    }
    // a wire down to a house now and then
    if (P.drop) { const h = roadAt(P.s + 3, P.l + Math.sign(P.l) * 6, 6.5); const a = V3(b.x + lean, top - 0.3, b.z), m = a.clone().lerp(h, 0.5); m.y -= 0.5; kit.add(tube(new THREE.QuadraticBezierCurve3(a, m, h), 0.01, 12, 3), 'dark', 0); }
  }
}

// one street lamp: a fluted cast-iron post, a swan neck bowing over the road, a hood like a bowed head
export function lamp(kit, L, group) {
  const n = roadN(L.s), side = L.side, b = roadAt(L.s, side * 3.75, 0.13);
  const toRoad = V3(-side * n.x, 0, -side * n.z);
  const P = (u, l) => V3(b.x + toRoad.x * l, b.y + u, b.z + toRoad.z * l);
  kit.add(xf(cyl(0.2, 0.26, 0.7, 12), b.x, b.y + 0.35, b.z), 'metal', 0x1c241e);
  kit.add(xf(cyl(0.1, 0.14, 4.6, 12, 4), b.x, b.y + 2.95, b.z), 'metal', 0x1c241e);
  kit.add(xf(sphere(0.14, 10, 8), b.x, b.y + 5.3, b.z), 'metal', 0x1c241e);
  const neck = new THREE.CatmullRomCurve3([P(5.2, 0), P(6.1, 0.15), P(6.75, 0.8), P(6.85, 1.6), P(6.4, 2.25)]);
  kit.add(tube(neck, 0.075, 30, 7), 'metal', 0x1c241e);
  // scroll under the neck (the curl from the drawing)
  const sc = []; for (let i = 0; i <= 20; i++) { const a = i / 20 * 4.5, rr = 0.42 * (1 - i / 24); sc.push(P(5.2 + Math.sin(a) * rr, 0.25 + (1 - Math.cos(a)) * rr * 0.9)); }
  kit.add(tube(sc, 0.025, 30, 5), 'metal', 0x1c241e);
  const end = neck.getPoint(1), hood = sphere(0.5, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2);
  hood.scale(1, 0.75, 1.15); hood.rotateY(Math.atan2(toRoad.x, toRoad.z)); hood.rotateX(-0.2);
  kit.add(xf(hood, end.x, end.y - 0.05, end.z), 'metal', 0x1c241e);
  const bulb = V3(end.x, end.y - 0.2, end.z);
  L.bulb = bulb;
  // the bulb, and the shaft of light you can see in the mist (both switched by the lamp's state)
  const bm = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
  bm.position.copy(bulb); group.add(bm); L.bulbMesh = bm;
  const ground = roadAt(L.s, 0).y, hgt = bulb.y - ground;
  const cg = new THREE.ConeGeometry(hgt * 0.62, hgt, 32, 1, true);
  const bmMat = beamMaterial(); const beam = new THREE.Mesh(cg, bmMat); beam.position.set(bulb.x, bulb.y - hgt / 2, bulb.z);
  beam.userData.mat = bmMat; bmMat.uniforms.uH.value = hgt; bmMat.uniforms.uSeed.value = L.id * 1.37;
  group.add(beam); L.beam = beam;
}

export function buildSegment(M, town, i, scene) {
  const s0 = i * ROAD.segment, s1 = s0 + ROAD.segment, group = new THREE.Group(), kit = new Kit(M), wins = new WindowBatch();
  group.name = 'seg' + i;
  const r = makeRng('seg:' + i);
  crossSection(kit, s0, s1);
  const lights = [];
  const anim = [], chimneys = [];
  for (const o of [...town.houses, homeSpec()]) {
    if (o.s < s0 || o.s >= s1) continue;
    const out = { windows: [], lights: [] };
    const F = buildHouse(kit, o, out);
    const hr = makeRng('yard:' + o.seed);
    yard(kit, o, F, hr);
    for (const p of town.props) if (p.house === o.id) prop(kit, p, o, F, hr);
    // the glass
    const wr = makeRng('win:' + o.seed), litBias = o.home ? 1 : o.region === 'ourStreet' ? 0.3 : o.region === 'longStreet' ? 0.15 : 0.1;
    for (const w of out.windows) {
      const seed = wr.range(1, 1000), lit = wr.chance(litBias) ? 1 : 0, kind = lit && wr.chance(0.25) ? 1 : wr.chance(0.2) ? 2 : 0;
      const shape = w.kind === 'round' ? 2 : w.kind === 'fan' ? 3 : (w.kind === 'sash' && !w.small && !w.bay && wr.chance(0.5)) ? 1 : 0;
      const dims = w.kind === 'round' ? [w.r * 2, w.r * 2] : w.kind === 'fan' ? [w.r * 2, w.r] : [w.wdt, w.hgt];
      const c = wins.add(F, { x: w.x, y: shape === 3 ? w.y + dims[1] / 2 - 0.0 : w.y, z: w.z, ry: w.ry || 0, wdt: dims[0], hgt: dims[1], shape, seed, lit: w.kind === 'fan' ? (o.porchLamp ? 1 : 0.3) : lit, kind: w.kind === 'fan' ? 0 : kind, curtain: wr.chance(0.4) ? wr.range(0.2, 0.9) : 0, watch: wr.chance(0.12) ? 1 : 0 });
      if (lit && w.kind !== 'fan') lights.push({ pos: c.clone(), color: kind === 1 ? [0.25, 0.35, 0.8] : [1.0, 0.62, 0.3], power: 0.9, base: 0.9, cone: 0, kind: 'window', tv: kind === 1, seed });
    }
    if (out.shopfront) { const sl = shopWindow(group, kit, F, out.shopfront, o, anim); if (sl) lights.push(sl); }
    if (out.chimney) { const c = out.chimney, [wx, wy, wz] = F.warp(c.x, c.y, c.z), p = V3(wx, wy, wz).applyMatrix4(F.matrix), ln = F.lean(c.x, c.y, c.z); p.x += ln[0] * 0; chimneys.push(p); }
    for (const l of out.lights) { const p = V3(...F.warp(l.x, l.y, l.z)).applyMatrix4(F.matrix); lights.push({ pos: p, color: [1.0, 0.7, 0.4], power: 0.7, cone: 0, kind: 'porch' }); }
  }
  puddles(group, s0, s1, r);
  const dt2 = details(kit, group, town, s0, s1);
  const rc = regionContent(kit, group, town, s0, s1); anim.push(...rc.anim); lights.push(...rc.lights);
  for (const t of town.trees) if (t.s >= s0 && t.s < s1) tree(kit, t);
  poles(kit, town, s0, s1);
  const lamps = town.lamps.filter((L) => L.s >= s0 && L.s < s1);
  for (const L of lamps) lamp(kit, L, group);
  kit.build(group);
  wins.build(group);
  mergeStatic(group);
  lampify(group); // before its first draw, so its shaders compile once, with the lamps in
  scene.add(group);
  return { i, group, lamps, lights, anim, chimneys, obstacles: dt2.obstacles };
}

// a far segment: the same houses as silhouettes (body, roof, chimney, lit windows as specks), the
// road surface, nothing else. One or two draw calls; it only has to read as a street running away
// into the mist.
let LODWIN = null;
export function buildSegmentLOD(M, town, i, scene) {
  const s0 = i * ROAD.segment, s1 = s0 + ROAD.segment, group = new THREE.Group(), kit = new Kit(M);
  group.name = 'lod' + i;
  crossSectionLite(kit, s0, s1);
  const win = [];
  for (const o of [...town.houses, homeSpec()]) {
    if (o.s < s0 || o.s >= s1) continue;
    const F = houseFrame(o), A = (g, m, c) => kit.add(g, m, c, F);
    A(xf(box(o.d, o.h, o.w, 1, 6, 1), 0, o.h / 2, 0), o.wall, o.wallColor);
    const g = cone(Math.max(o.w, o.d) * 0.78, o.rh, 4, 4); g.rotateY(Math.PI / 4); A(xf(g, 0, o.h + o.rh / 2, 0), 'slate', o.roof);
    if (o.chimney) A(xf(box(0.75, o.rh * 0.75, 0.95), -o.d * 0.22, o.h + o.rh * 0.4, 0), 'brick', 0x8a5a4a);
    const wr = makeRng('win:' + o.seed);
    for (let y = 1.75; y < o.h - 0.9; y += 2.4) for (const z of o.w > 5.6 ? [-o.w * 0.25, o.w * 0.25] : [0]) if (wr.chance(o.home ? 1 : 0.18)) {
      const [x, yy, zz] = F.warp(o.d / 2 + 0.05, y, z), p = V3(x, yy, zz).applyMatrix4(F.matrix), l = F.lean(o.d / 2, y, z), rot = new THREE.Matrix3().setFromMatrix4(F.matrix), lv = V3(...l).applyMatrix3(rot);
      win.push([p, lv]);
    }
  }
  kit.build(group, { shadows: false });
  if (win.length) {
    // lit windows as warm specks that lean with their houses
    const pos = new Float32Array(win.length * 3), lean = new Float32Array(win.length * 3);
    win.forEach(([p, l], k) => { pos.set([p.x, p.y, p.z], k * 3); lean.set([l.x, l.y, l.z], k * 3); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aLean', new THREE.BufferAttribute(lean, 3));
    if (!LODWIN) LODWIN = new THREE.ShaderMaterial({ uniforms: { ...THREE.UniformsLib.fog, uLean: U.uLean }, fog: true, transparent: true, depthWrite: false,
      vertexShader: `attribute vec3 aLean; uniform float uLean;
#include <fog_pars_vertex>
void main(){ vec4 mvPosition = modelViewMatrix * vec4(position + aLean * uLean, 1.); gl_PointSize = clamp(260.0 / -mvPosition.z, 1.5, 8.0); gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`,
      fragmentShader: `#include <fog_pars_fragment>
void main(){ vec2 c = gl_PointCoord - 0.5; if (max(abs(c.x), abs(c.y) * 0.75) > 0.5) discard; gl_FragColor = vec4(1.0, 0.7, 0.35, 1.0);
#include <fog_fragment>
}` });
    const pts = new THREE.Points(g, LODWIN); group.add(pts);
  }
  scene.add(group);
  return { i, group, lamps: [], lights: [], anim: [], chimneys: [], lod: true };
}
function crossSectionLite(kit, s0, s1) {
  const n = 3;
  for (const side of [-1, 1]) for (const [l0, l1, y0, y1, mat] of [[0, 3.05, 0, 0.13, 'cobble'], [3.05, 4.8, 0.13, 0.115, 'slab'], [4.8, 40, 0.14, 0.6, 'grass']]) {
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= n; i++) { const s = s0 + (s1 - s0) * i / n, c = roadC(s), N = roadN(s); for (const [l, y] of [[l0, y0], [l1, y1]]) { pos.push(c.x + N.x * l * side, c.y + y, c.z + N.z * l * side); uv.push(l * side, s); } if (i < n) { const a = i * 2; side > 0 ? idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) : idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    kit.add(g, mat, 0xffffff);
  }
}

export function disposeSegment(seg, scene) {
  scene.remove(seg.group);
  seg.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
}
