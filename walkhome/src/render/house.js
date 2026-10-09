// ONE HOUSE, built for real. The shapes come from the drawing (too tall, witch's-hat roofs, a lean
// toward the road that grows with height), the detail from life: a stone plinth, quoins or corner
// boards, string courses at each floor, recessed sash windows with stone sills and lintels, some
// with shutters (one hanging), bay windows that stand out from the wall, a panelled door in a
// recessed frame under a fanlight, worn steps, a porch, a gutter and a downpipe, chimney stacks
// with pots, dormers, finials. Built in the house's own frame (x toward the road, y up, z along
// the street), then warped (twist, taper) and given its lean, and handed to the segment's kit.
import * as THREE from 'three';
import { makeRng } from '../../../engine/rng.js';
import { ROAD, at as roadAt, N as roadN } from '../sim/road.js';
import { box, cyl, cone, sphere, xf, V3 } from './kit.js';

export const GLASS_LIT = 0xffc070;

// the house's frame in the world, and how its vertices bend
export function houseFrame(o) {
  const n = roadN(o.s);
  // local +x points at the road (home, at the very end, faces back down it)
  const p = o.home ? roadAt(o.s + o.d / 2, 0) : roadAt(o.s, o.side * (ROAD.front + o.d / 2));
  const tx = o.home ? -n.z : -o.side * n.x, tz = o.home ? n.x : -o.side * n.z, rotY = Math.atan2(-tz, tx);
  const matrix = new THREE.Matrix4().compose(V3(p.x, p.y + 0.12, p.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0)), V3(1, 1, 1));
  const H = o.h + o.rh;
  const warp = (x, y, z) => {
    const t = Math.max(0, y / H), a = o.twist * t, sc = 1 - o.taper * t * t;
    return [(x * Math.cos(a) - z * Math.sin(a)) * sc, y, (x * Math.sin(a) + z * Math.cos(a)) * sc];
  };
  // lean: the higher, the more it bends toward the road (and a touch sideways, so rows don't lean in step)
  const side = Math.sin(o.seed) * 0.25;
  const lean = (x, y, z) => { const t = Math.max(0, y / H), k = o.lean * t * t * H * 0.3; return [k, -k * 0.08, k * side]; };
  return { matrix, warp, lean, rotY, origin: p };
}

export function buildHouse(kit, o, out) {
  const r = makeRng('house:' + o.seed), F = houseFrame(o), FA = { ...F, ao: true, aoTop: o.h }, A = (geo, mat, col) => kit.add(geo, mat, col, /^(brick|siding|render|stone|trim|door)$/.test(mat) ? FA : F);
  const { d, w, h } = o, fx = d / 2, wall = o.wall, wc = o.wallColor, trim = o.trim, stoneC = 0x9a968c;
  // plinth and walls
  A(xf(box(d + 0.24, 0.55, w + 0.24), 0, 0.27, 0), 'stone', 0x7a766e);
  if (o.shop) {
    // a shop: the ground floor has a real opening for the window display
    const sz = o.doorZ > 0 ? o.doorZ - 2.6 : o.doorZ + 2.6, sw = Math.min(3.6, w - 2.2), gh = 2.75;
    A(xf(box(d, h - gh, w, 1, Math.ceil((h - gh) / 0.7), 2), 0, gh + (h - gh) / 2, 0), wall, wc);
    const zl = sz - sw / 2, zr = sz + sw / 2;
    if (zl > -w / 2 + 0.01) A(xf(box(d, gh, zl + w / 2), 0, gh / 2, (-w / 2 + zl) / 2), wall, wc);
    if (zr < w / 2 - 0.01) A(xf(box(d, gh, w / 2 - zr), 0, gh / 2, (zr + w / 2) / 2), wall, wc);
    A(xf(box(d - 1.2, gh, sw), -0.6, gh / 2, sz), wall, wc);
  } else A(xf(box(d, h, w, 1, Math.ceil(h / 0.7), 2), 0, h / 2, 0), wall, wc);
  // a string course at each floor line
  const floors = [];
  for (let y = 3.1; y < h - 1.2; y += 2.4) floors.push(y);
  for (const y of floors) A(xf(box(d + 0.14, 0.16, w + 0.14), 0, y, 0), 'stone', stoneC);
  // corners: quoins on brick and render, boards on clapboard
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) {
    if (wall === 'siding') A(xf(box(0.2, h, 0.2, 1, Math.ceil(h / 0.7), 1), sx * fx, h / 2, sz * w / 2), 'trim', trim);
    else for (let y = 0.6, k = 0; y < h - 0.3; y += 0.36, k++) A(xf(box(k % 2 ? 0.34 : 0.22, 0.32, k % 2 ? 0.22 : 0.34), sx * (fx - (k % 2 ? 0.06 : 0)), y + 0.16, sz * (w / 2 - (k % 2 ? 0 : 0.06))), 'stone', stoneC);
  }
  // eaves, gutter along the front, downpipe
  A(xf(box(d + 0.8, 0.22, w + 0.8, 2, 1, 2), 0, h + 0.05, 0), 'trim', 0x3a3438);
  A(xf(cyl(0.07, 0.07, w + 0.8, 8, 1, false), fx + 0.42, h - 0.08, 0, Math.PI / 2), 'gutter', 0x26242a);
  const pz = (o.doorZ > 0 ? -1 : 1) * (w / 2 - 0.15);
  A(xf(cyl(0.05, 0.05, h, 6, Math.ceil(h / 0.7)), fx + 0.1, h / 2, pz), 'gutter', 0x26242a);
  for (let y = 1; y < h; y += 1.8) A(xf(box(0.06, 0.06, 0.16), fx + 0.04, y, pz), 'gutter', 0x26242a); // brackets
  // the roof: a four-sided witch's hat (with a flared skirt), or a steep gable along the street
  const R = Math.max(w, d) * 0.78;
  if (o.shop || r.chance(0.35)) {
    const sh = new THREE.Shape(); sh.moveTo(-fx - 0.45, 0); sh.lineTo(fx + 0.45, 0); sh.lineTo(0, o.rh); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: w + 0.6, bevelEnabled: false, steps: 1 }); g.translate(0, h + 0.12, -(w + 0.6) / 2);
    // split the slopes so they bend
    A(g, 'slate', o.roof);
    out.gable = true;
  } else {
    const g = cone(R, o.rh, 4, 10); g.rotateY(Math.PI / 4);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i) + o.rh / 2, t = 1 - y / o.rh, fl = 1 + 0.18 * Math.pow(Math.max(0, t - 0.75) / 0.25, 2); p.setX(i, p.getX(i) * fl); p.setZ(i, p.getZ(i) * fl); }
    g.computeVertexNormals(); g.translate(0, h + 0.1 + o.rh / 2, 0);
    A(g, 'slate', o.roof);
    A(xf(cyl(0.02, 0.05, 0.9, 6), 0, h + o.rh + 0.35, 0), 'gutter', 0x2a2a2e); // finial
    A(xf(sphere(0.08, 8, 6), 0, h + o.rh + 0.1, 0), 'gutter', 0x2a2a2e);
  }
  // chimney stack with pots, crooked
  if (o.chimney) {
    const cz = r.range(-w * 0.3, w * 0.3), ch = o.rh * r.range(0.65, 0.9), lean = r.range(-0.08, 0.08);
    A(xf(box(0.75, ch, 0.95, 1, 4, 1), -d * 0.22, h + ch / 2, cz, 0, 0, lean), 'brick', 0x8a5a4a);
    A(xf(box(0.9, 0.14, 1.1), -d * 0.22 - ch * lean * 0.5, h + ch, cz, 0, 0, lean), 'stone', stoneC);
    for (const k of [-0.22, 0.22]) A(xf(cyl(0.11, 0.13, 0.42, 8), -d * 0.22 - ch * lean * 0.5, h + ch + 0.27, cz + k), 'stone', 0x8a6a54);
    out.chimney = { x: -d * 0.22 - ch * lean * 0.5, y: h + ch + 0.5, z: cz };
  }
  if (o.turret) {
    const tz = (o.doorZ > 0 ? -1 : 1) * (w / 2 - 0.7), th = 2.4;
    A(xf(cyl(0.8, 0.85, th, 12, 4), fx - 0.45, h + th / 2 - 0.3, tz), wall, wc);
    A(xf(cone(1.05, o.rh * 0.85, 10, 8), fx - 0.45, h + th - 0.3 + o.rh * 0.425, tz), 'slate', o.roof);
    out.windows.push({ kind: 'round', x: fx - 0.45 + 0.82, y: h + 0.9, z: tz, ry: 0, r: 0.32 });
  }
  if (o.dormer && !out.gable) {
    // a little dormer pushing out of the roof slope toward the road
    const dy = h + o.rh * 0.22, dx = R * 0.707 * 0.62;
    A(xf(box(1.4, 1.4, 1.5), dx - 0.2, dy + 0.5, 0), wall, wc);
    const g = cone(1.15, 1.2, 4, 2); g.rotateY(Math.PI / 4); A(xf(g, dx - 0.2, dy + 1.8, 0), 'slate', o.roof);
    out.windows.push({ kind: 'sash', x: dx + 0.52, y: dy + 0.55, z: 0, wdt: 0.7, hgt: 0.9, small: true });
  }

  // windows on each floor
  const cols = w > 5.6 ? 2 : 1;
  floors.forEach((fy, fi) => {
    const y = fy + 1.35;
    if (y > h - 0.9) return;
    for (let c = 0; c < cols; c++) {
      const z = cols === 1 ? r.range(-0.5, 0.5) : (c ? 1 : -1) * w * 0.25;
      if (r.chance(0.08)) continue;
      const round = !o.shop && r.chance(0.18);
      out.windows.push(round ? { kind: 'round', x: fx, y, z, r: 0.55 } : { kind: 'sash', x: fx, y, z, wdt: 0.95, hgt: 1.55, shutters: r.chance(0.45), hang: r.chance(0.3), box: r.chance(0.25) });
    }
  });
  // the ground floor: shopfront, bay window, or a plain window beside the door
  const dz = o.doorZ, wz = dz > 0 ? dz - 2.1 : dz + 2.1;
  if (o.shop) out.shopfront = { x: fx, z: dz > 0 ? dz - 2.6 : dz + 2.6, wdt: Math.min(3.6, w - 2.2), hgt: 2.2 };
  else if (r.chance(0.45) && Math.abs(wz) < w / 2 - 1.0) {
    // a bay: three faces stand out from the wall, with its own little roof
    const bw = 2.0, bd = 0.7;
    A(xf(box(bd, 0.75, bw + 0.3), fx + bd / 2, 0.6, wz), 'stone', stoneC);
    for (const [ox, oz, ry, ww] of [[fx + bd, wz, 0, bw - 0.5], [fx + bd / 2, wz - bw / 2 + 0.05, -0.9, 0.85], [fx + bd / 2, wz + bw / 2 - 0.05, 0.9, 0.85]]) out.windows.push({ kind: 'sash', x: ox, y: 1.75, z: oz, ry, wdt: ww, hgt: 1.45, bay: true });
    for (const [oz, sgn] of [[wz - bw / 2, -1], [wz + bw / 2, 1]]) A(xf(box(bd, 1.6, 0.14), fx + bd / 2, 1.75, oz - sgn * 0.07), 'trim', trim);
    A(xf(box(bd + 0.2, 0.18, bw + 0.4), fx + bd / 2 + 0.05, 2.6, wz), 'trim', trim);
    const g = cone(1.0, 0.5, 4, 1); g.rotateY(Math.PI / 4); A(xf(g, fx + bd / 2, 2.95, wz, 0, 0, 0, 0.6, 1, 1.55), 'slate', o.roof);
  } else if (Math.abs(wz) < w / 2 - 0.8) out.windows.push({ kind: 'sash', x: fx, y: 1.75, z: wz, wdt: 0.95, hgt: 1.5, shutters: r.chance(0.4), box: r.chance(0.3) });

  // windows' surrounds (the glass itself is drawn by the window shader)
  for (const wn of out.windows) windowSurround(A, wn, o, r);

  // the door: recessed in a frame, panelled, under a fanlight; steps; a porch or a hood
  const DW = 1.0, DH = 2.15, dy0 = 0.55;
  A(xf(box(0.2, DH + 0.5, 0.18), fx + 0.04, dy0 + DH / 2 + 0.05, dz - DW / 2 - 0.12), 'trim', trim);
  A(xf(box(0.2, DH + 0.5, 0.18), fx + 0.04, dy0 + DH / 2 + 0.05, dz + DW / 2 + 0.12), 'trim', trim);
  A(xf(box(0.24, 0.2, DW + 0.6), fx + 0.06, dy0 + DH + 0.42, dz), 'trim', trim);
  A(xf(box(0.08, DH, DW), fx - 0.1, dy0 + DH / 2, dz), 'door', o.door);
  for (const py of [0.5, 1.35]) for (const pz2 of [-0.22, 0.22]) A(xf(box(0.04, py > 1 ? 0.75 : 0.65, 0.34), fx - 0.04, dy0 + py + (py > 1 ? 0.25 : 0), dz + pz2), 'door', new THREE.Color(o.door).multiplyScalar(0.8).getHex());
  A(xf(box(0.05, 0.05, 0.3), fx - 0.02, dy0 + 1.0, dz), 'gutter', 0xb8a060); // letterbox
  A(xf(sphere(0.05, 8, 6), fx - 0.02, dy0 + 1.05, dz + 0.36), 'gutter', 0xc8a858); // knob
  out.windows.push({ kind: 'fan', x: fx - 0.02, y: dy0 + DH + 0.05, z: dz, r: DW / 2 - 0.04 });
  for (let k = 0; k < 3; k++) A(xf(box(0.42 + (2 - k) * 0.4, 0.18, DW + 0.9 - k * 0.12), fx + 0.2 + (2 - k) * 0.2, 0.09 + k * 0.18 - 0.05, dz), 'stone', 0x8a867e);
  if (o.porch) {
    for (const sz of [-1, 1]) A(xf(cyl(0.08, 0.1, 2.75, 8), fx + 1.1, 1.4, dz + sz * (DW / 2 + 0.35)), 'paintL', trim);
    A(xf(box(1.4, 0.16, DW + 1.2), fx + 0.6, 2.85, dz), 'trim', trim);
    const g = cone(1.2, 0.8, 4, 1); g.rotateY(Math.PI / 4); A(xf(g, fx + 0.6, 3.3, dz, 0, 0, 0, 0.85, 1, 1.15), 'slate', o.roof);
  } else A(xf(box(0.7, 0.12, DW + 0.6), fx + 0.35, dy0 + DH + 0.62, dz), 'trim', trim);
  if (o.porchLamp) {
    const lz = dz + (DW / 2 + 0.45);
    A(xf(box(0.16, 0.26, 0.16), fx + 0.18, 2.25, lz), 'gutter', 0x1e1e22);
    out.lights.push({ x: fx + 0.45, y: 1.9, z: lz, kind: 'porch' });
  }
  if (o.shop) shopfront(A, out.shopfront, o, r);
  return F;
}

function windowSurround(A, wn, o, r) {
  const ry = wn.ry || 0, c = Math.cos(ry), s = Math.sin(ry);
  // place a box given in the window's own frame (u across, v up, n out)
  const P = (geo, mat, col, u, v, n) => A(xf(geo, wn.x + n * c + u * s * 0, wn.y + v, wn.z + u * c + n * -s * 0, 0, ry), mat, col);
  if (wn.kind === 'round') {
    const g = new THREE.TorusGeometry(wn.r + 0.06, 0.09, 6, 20); g.rotateY(Math.PI / 2); A(xf(g, wn.x + 0.06, wn.y, wn.z), 'stone', 0xa8a49a);
    return;
  }
  if (wn.kind === 'fan') return;
  const W = wn.wdt, H = wn.hgt, n0 = 0.02;
  // frame (stands proud), sill below, a lintel or a little hood above
  const fr = (geo, u, v, n) => A(xf(geo, wn.x + n, wn.y + v, wn.z + u, 0, ry), 'trim', o.trim);
  if (ry === 0) {
    fr(box(0.14, H + 0.12, 0.1), -W / 2 - 0.02, 0, n0); fr(box(0.14, H + 0.12, 0.1), W / 2 + 0.02, 0, n0);
    fr(box(0.14, 0.1, W + 0.12), 0, H / 2 + 0.02, n0); fr(box(0.1, 0.06, W), 0, 0.02, n0);
    A(xf(box(0.34, 0.1, W + 0.36), wn.x + 0.12, wn.y - H / 2 - 0.08, wn.z), 'stone', 0x9a968c);
    if (!wn.small) A(xf(box(0.16, 0.24, W + 0.4), wn.x + 0.05, wn.y + H / 2 + 0.2, wn.z), 'stone', 0x9a968c);
    if (wn.shutters) {
      for (const sg of [-1, 1]) {
        const hang = wn.hang && sg > 0;
        const g = box(0.06, H, W * 0.48);
        A(xf(g, wn.x + 0.12, wn.y - (hang ? 0.12 : 0), wn.z + sg * (W * 0.74 + 0.06), hang ? 0.28 : 0, sg * 0.18), 'trim', o.shutter);
        for (let k = -2; k <= 2; k++) A(xf(box(0.03, 0.04, W * 0.44), wn.x + 0.16, wn.y + k * H * 0.18 - (hang ? 0.12 : 0), wn.z + sg * (W * 0.74 + 0.06), hang ? 0.28 : 0, sg * 0.18), 'trim', new THREE.Color(o.shutter).multiplyScalar(0.75).getHex());
      }
    }
    if (wn.box) {
      A(xf(box(0.3, 0.22, W + 0.1), wn.x + 0.27, wn.y - H / 2 - 0.0, wn.z), 'wood', 0x5a4030);
      for (let k = 0; k < 5; k++) A(xf(sphere(0.07, 6, 4), wn.x + 0.27, wn.y - H / 2 + 0.16, wn.z - W / 2 + 0.1 + k * W / 4.6), 'hedge', r.chance(0.5) ? 0x6a3a40 : 0x4a5a3a);
    }
  } else {
    // bay side windows: just a frame
    A(xf(box(0.08, H + 0.1, W + 0.1), wn.x, wn.y, wn.z, 0, ry), 'trim', o.trim);
  }
}

const SHOP_NAMES = ['BUTCHER', 'TOYS & GAMES', 'LAUNDERETTE', 'SWEETS', 'BARBER', 'TV REPAIRS', 'BAKERY', 'NEWSAGENT', 'CHEMIST', 'PAWNBROKER', 'FISH & CHIPS', 'HABERDASHERY'];
function shopfront(A, sf, o, r) {
  const { x, z, wdt } = sf;
  A(xf(box(0.3, 0.6, wdt + 0.4), x + 0.15, 0.3 + 0.12, z), 'trim', o.door);            // stall riser
  for (const sg of [-1, 1]) A(xf(box(0.3, 2.9, 0.25), x + 0.15, 1.45, z + sg * (wdt / 2 + 0.2)), 'trim', o.door); // pilasters
  A(xf(box(0.4, 0.7, wdt + 0.9), x + 0.2, 3.05, z), 'trim', 0x1e1a1e);               // fascia (the sign is drawn on it)
  sf.sign = { name: SHOP_NAMES[o.seed % SHOP_NAMES.length], x: x + 0.41, y: 3.05, z, wdt: wdt + 0.8 };
  // a roller shutter, half down, or an awning
  if (r.chance(0.5)) { const sh = r.range(0.4, 1.4); A(xf(box(0.08, sh, wdt), x + 0.33, 2.7 - sh / 2, z), 'metal', 0x6a6a70); sf.shutter = sh; }
  else sf.awning = true;
}
