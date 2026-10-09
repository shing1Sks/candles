// THE SMALL THINGS that make a street a real street, the things a child notices at their own
// height: cars parked half on the kerb, double yellow lines worn pale, a drain grating every few
// houses, manhole covers, a red pillar box, a bus shelter with a timetable nobody can read, the
// street's name on a wall, a "SLOW: CHILDREN" sign, chalk on the pavement, milk bottles on a
// doorstep, a house number by every door, a TV aerial on most chimneys.
import * as THREE from 'three';
import { makeRng } from '../../../engine/rng.js';
import { ROAD, at as roadAt, N as roadN, C as roadC, regionAt } from '../sim/road.js';
import { box, cyl, cone, sphere, tube, limb, xf, V3 } from './kit.js';
import { houseFrame } from './house.js';

const texCache = new Map();
function canvasTex(key, w, h, draw) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; texCache.set(key, t); return t;
}
const yaw = (s) => { const n = roadN(s); return Math.atan2(n.x, n.z) - Math.PI / 2; }; // facing along the road (toward travel)

// a parked car: body, glasshouse, wheels, bumpers, lights; old, a bit rounded
function parkedCar(kit, s, l, color, r) {
  const p = roadAt(s, l), ry = yaw(s) + (r.chance(0.5) ? 0 : Math.PI) + r.range(-0.04, 0.04), M = new THREE.Matrix4().compose(V3(p.x, p.y, p.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), V3(1, 1, 1));
  const F = { matrix: M, lean: () => [0, 0, 0] }, A = (g, m, c) => kit.add(g, m, c, F);
  const len = r.range(3.8, 4.4), w = 1.68;
  A(xf(box(w, 0.55, len, 2, 1, 4), 0, 0.55, 0), 'paint', color);
  A(xf(box(w - 0.06, 0.12, len - 0.4), 0, 0.88, 0), 'paint', color);
  A(xf(box(w - 0.16, 0.5, len * 0.48), 0, 1.15, -0.05), 'paint', color);
  A(xf(box(w - 0.12, 0.42, len * 0.46), 0, 1.13, -0.05), 'dark', 0); // the glass, black
  A(xf(box(w - 0.2, 0.06, len * 0.5), 0, 1.42, -0.05), 'paint', color);
  for (const sz of [-1, 1]) A(xf(box(w + 0.04, 0.14, 0.12), 0, 0.38, sz * (len / 2 + 0.02)), 'metal', 0x8a8a90);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const t = cyl(0.3, 0.3, 0.2, 14); t.rotateZ(Math.PI / 2); A(xf(t, sx * (w / 2 - 0.05), 0.3, sz * (len / 2 - 0.75)), 'dark', 0); const hub = cyl(0.14, 0.14, 0.22, 10); hub.rotateZ(Math.PI / 2); A(xf(hub, sx * (w / 2 - 0.04), 0.3, sz * (len / 2 - 0.75)), 'metal', 0xa0a0a8); }
  for (const sx of [-0.55, 0.55]) { A(xf(cyl(0.11, 0.11, 0.05, 12), sx, 0.62, -len / 2 - 0.01, Math.PI / 2), 'plastic', 0xd8d4c0); A(xf(box(0.24, 0.1, 0.05), sx, 0.62, len / 2 + 0.01), 'plastic', 0x6a1a14); }
  // leaves on the bonnet and windscreen: it hasn't moved for days
  for (let k = 0; k < 5; k++) A(xf(box(0.09, 0.005, 0.12), r.range(-0.6, 0.6), 0.885, r.range(-len / 2 + 0.3, -0.6), 0, r.range(0, 6)), 'plastic', r.pick([0x8a4a20, 0x6a3a18, 0xa86a28]));
  return { x: p.x, z: p.z, ry, len };
}

function pillarBox(kit, s, l) {
  const p = roadAt(s, l, 0.13);
  kit.add(xf(cyl(0.26, 0.29, 1.15, 18), p.x, p.y + 0.6, p.z), 'paint', 0xb01810);
  kit.add(xf(sphere(0.3, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), p.x, p.y + 1.16, p.z, 0, 0, 0, 1, 0.55, 1), 'paint', 0xb01810);
  kit.add(xf(cyl(0.31, 0.31, 0.06, 18), p.x, p.y + 1.17, p.z), 'paint', 0x8a1008);
  kit.add(xf(cyl(0.3, 0.33, 0.12, 18), p.x, p.y + 0.06, p.z), 'paint', 0x2a2a2a);
  const n = roadN(s), toRoad = Math.atan2(-Math.sign(l) * n.x, -Math.sign(l) * n.z);
  kit.add(xf(box(0.3, 0.035, 0.05), p.x - Math.sign(l) * n.x * 0.27, p.y + 0.92, p.z - Math.sign(l) * n.z * 0.27, 0, toRoad), 'dark', 0);
}

function signPost(group, kit, s, l, kind) {
  const p = roadAt(s, l, 0.13);
  kit.add(xf(cyl(0.035, 0.04, 2.6, 8), p.x, p.y + 1.3, p.z), 'metal', 0x5a5a60);
  const tex = canvasTex('sign:' + kind, 256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#c01818'; g.beginPath(); g.moveTo(w / 2, 8); g.lineTo(w - 8, h - 30); g.lineTo(8, h - 30); g.closePath(); g.fill();
    g.fillStyle = '#f4f0e6'; g.beginPath(); g.moveTo(w / 2, 40); g.lineTo(w - 38, h - 48); g.lineTo(38, h - 48); g.closePath(); g.fill();
    g.fillStyle = '#111';
    if (kind === 'children') { // two children running, the old British sign
      for (const [x, s2] of [[100, 1], [148, 1.1]]) { g.save(); g.translate(x, 150); g.scale(s2, s2); g.beginPath(); g.arc(0, -40, 9, 0, 7); g.fill(); g.fillRect(-6, -30, 12, 32); g.save(); g.rotate(0.5); g.fillRect(-4, 0, 8, 28); g.restore(); g.save(); g.rotate(-0.5); g.fillRect(-4, 0, 8, 28); g.restore(); g.restore(); }
    }
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.75), new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6 }));
  const n = roadN(s); m.position.set(p.x, p.y + 2.35, p.z); m.rotation.y = Math.atan2(n.z, -n.x) * 0 + yaw(s) + Math.PI; group.add(m);
  const plate = canvasTex('plate:' + kind, 256, 64, (g, w, h) => { g.fillStyle = '#f4f0e6'; g.fillRect(0, 0, w, h); g.strokeStyle = '#111'; g.lineWidth = 4; g.strokeRect(3, 3, w - 6, h - 6); g.fillStyle = '#111'; g.font = 'bold 38px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(kind === 'children' ? 'SLOW' : 'PLAYGROUND', w / 2, h / 2 + 2); });
  const pm = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.15), new THREE.MeshStandardMaterial({ map: plate, roughness: 0.6, side: THREE.DoubleSide })); pm.position.set(p.x, p.y + 1.88, p.z); pm.rotation.y = m.rotation.y; group.add(pm);
}

function streetName(group, F, o, name) {
  const tex = canvasTex('street:' + name, 512, 96, (g, w, h) => { g.fillStyle = '#f2eee4'; g.fillRect(0, 0, w, h); g.strokeStyle = '#181818'; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12); g.fillStyle = '#181818'; g.font = 'bold 58px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name, w / 2, h / 2 + 3); });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.27), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 }));
  const p = V3(o.d / 2 + 0.03, 2.6, o.doorZ > 0 ? -o.w / 2 + 1.0 : o.w / 2 - 1.0).applyMatrix4(F.matrix);
  m.position.copy(p); m.rotation.y = F.rotY + Math.PI / 2; group.add(m);
}
const NAMES = { ourStreet: 'ALDER CLOSE', longStreet: 'LONG LANE', highStreet: 'HIGH STREET', parkEdge: 'PARK ROAD', hill: 'HOME HILL' };

function busStop(kit, group, s, l) {
  const p = roadAt(s, l, 0.13), ry = yaw(s);
  const M = new THREE.Matrix4().compose(V3(p.x, p.y, p.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), V3(1, 1, 1)), F = { matrix: M, lean: () => [0, 0, 0] }, A = (g, m, c) => kit.add(g, m, c, F);
  const sd = Math.sign(l);
  for (const z of [-1.3, 1.3]) for (const x of [-0.6, 0.6]) A(xf(cyl(0.04, 0.04, 2.3, 8), x * sd, 1.15, z), 'metal', 0x2a3a4a);
  A(xf(box(1.5, 0.08, 2.9), 0, 2.32, 0), 'metal', 0x2a3a4a);
  A(xf(box(0.04, 1.6, 2.6), 0.6 * sd, 1.25, 0), 'dark', 0); // the back panel (glass, black with the night)
  A(xf(box(0.35, 0.06, 1.8), 0.4 * sd, 0.5, 0), 'wood', 0x6a5a4a);
  const tt = canvasTex('timetable', 128, 192, (g, w, h) => { g.fillStyle = '#e8e2d0'; g.fillRect(0, 0, w, h); g.fillStyle = '#222'; g.font = 'bold 14px Arial'; g.fillText('BUS STOP', 10, 22); g.font = '9px Arial'; for (let i = 0; i < 14; i++) g.fillText(['--:--', '00:00', '00:00', '00:00'][i % 4] + '   ' + 'no service', 10, 44 + i * 10); });
  const tm = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.48), new THREE.MeshStandardMaterial({ map: tt, roughness: 0.7 })); tm.position.copy(V3(0.57 * sd, 1.5, 0.9).applyMatrix4(M)); tm.rotation.y = ry - sd * Math.PI / 2; group.add(tm);
  A(xf(cyl(0.04, 0.04, 2.8, 8), -0.5 * sd, 1.4, -1.6), 'metal', 0x5a5a60);
  A(xf(cyl(0.22, 0.22, 0.04, 16), -0.5 * sd, 2.7, -1.6, Math.PI / 2, 0, 0), 'paint', 0xc01818);
}

function hopscotch(group, s, l) {
  const tex = canvasTex('hopscotch', 256, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(240,236,220,0.85)'; g.lineWidth = 6; g.lineCap = 'round'; g.font = 'bold 44px Georgia'; g.fillStyle = 'rgba(240,236,220,0.85)'; g.textAlign = 'center';
    const sq = 70, cx = w / 2; let y = h - 20, n = 1;
    for (const row of [1, 1, 2, 1, 2, 1]) { if (row === 1) { g.strokeRect(cx - sq / 2, y - sq, sq, sq); g.fillText(n++, cx, y - sq / 2 + 15); } else { g.strokeRect(cx - sq, y - sq, sq, sq); g.strokeRect(cx, y - sq, sq, sq); g.fillText(n++, cx - sq / 2, y - sq / 2 + 15); g.fillText(n++, cx + sq / 2, y - sq / 2 + 15); } y -= sq; }
    g.beginPath(); g.arc(cx, y - 10, 40, Math.PI, 0); g.stroke(); g.font = 'bold 26px Georgia'; g.fillText('HOME', cx, y - 18);
  });
  const p = roadAt(s, l, 0.125), m = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.0), new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -3 }));
  m.rotation.set(-Math.PI / 2, 0, yaw(s) + Math.PI); m.position.set(p.x, p.y, p.z); group.add(m);
}

function houseNumber(group, F, o, num) {
  const tex = canvasTex('num:' + num, 64, 64, (g, w, h) => { g.fillStyle = '#1a1a1a'; g.fillRect(0, 0, w, h); g.fillStyle = '#d8c070'; g.font = 'bold 40px Georgia'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(num), w / 2, h / 2 + 2); });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4, metalness: 0.3 }));
  const p = V3(o.d / 2 + 0.04, 2.0, o.doorZ + (o.doorZ > 0 ? -0.85 : 0.85)).applyMatrix4(F.matrix); m.position.copy(p); m.rotation.y = F.rotY + Math.PI / 2; group.add(m);
}

export function details(kit, group, town, s0, s1) {
  const r = makeRng('details:' + s0), lights = [], obstacles = [];
  // parked cars by the kerb (not in the park or on the bridge, not in front of lamps)
  for (const side of [-1, 1]) {
    for (let s = s0 + r.range(2, 8); s < s1 - 2; s += r.range(8, 16)) {
      const R = regionAt(s).id; if (R === 'parkEdge' || (s > 1088 && s < 1124)) continue;
      if (!r.chance(R === 'highStreet' ? 0.55 : R === 'hill' ? 0.25 : 0.4)) continue;
      if (town.lamps.some((L) => Math.abs(L.s - s) < 3.5 && L.side === side)) continue;
      const c = parkedCar(kit, s, side * 2.05, r.pick([0x6a2a26, 0x2a3a5a, 0x3a4a3a, 0x8a8a84, 0x5a4a2a, 0x2a2a30, 0x7a6a40]), r);
      for (const k of [-1, 1]) obstacles.push({ x: c.x + Math.sin(c.ry) * k * c.len * 0.28, z: c.z + Math.cos(c.ry) * k * c.len * 0.28, r: 0.95, car: true });
    }
  }
  // double yellow lines along the kerbs where it's busy; a broken centre line on the long street
  for (const side of [-1, 1]) for (let s = s0; s < s1; s += 1) {
    const R = regionAt(s).id;
    if (R === 'highStreet' || R === 'longStreet') for (const off of [2.48, 2.62]) { const a = roadAt(s, side * off), b = roadAt(s + 1, side * off), g = box(0.07, 0.006, 1.0); kit.add(xf(g, (a.x + b.x) / 2, a.y + 0.002 - 0.07 * (off / 2.8) ** 2, (a.z + b.z) / 2, 0, Math.atan2(b.x - a.x, b.z - a.z)), 'paint', 0xb8a050); }
  }
  for (let s = Math.ceil(s0 / 6) * 6; s < s1; s += 6) if (regionAt(s).id === 'longStreet' || regionAt(s).id === 'hill') { const a = roadAt(s, 0), b = roadAt(s + 2.5, 0); kit.add(xf(box(0.1, 0.006, 2.5), (a.x + b.x) / 2, a.y + 0.004, (a.z + b.z) / 2, 0, Math.atan2(b.x - a.x, b.z - a.z)), 'paint', 0xa8a498); }
  // drain gratings in the gutter, manholes in the road
  for (const side of [-1, 1]) for (let s = Math.ceil((s0 + (side > 0 ? 4 : 11)) / 15) * 15; s < s1; s += 15) {
    const p = roadAt(s, side * 2.55); kit.add(xf(box(0.38, 0.02, 0.6), p.x, p.y - 0.055, p.z, 0, yaw(s)), 'metal', 0x1a1a1a);
    for (let k = -2; k <= 2; k++) kit.add(xf(box(0.3, 0.025, 0.035), p.x, p.y - 0.045, p.z, 0, yaw(s)).translate(0, 0, 0), 'metal', 0x2a2a2a);
  }
  if (r.chance(0.5)) { const s = s0 + r.range(3, 20), p = roadAt(s, r.range(-1, 1)); kit.add(xf(cyl(0.34, 0.34, 0.03, 20), p.x, p.y + 0.0, p.z), 'metal', 0x26262a); kit.add(xf(cyl(0.3, 0.3, 0.035, 20), p.x, p.y + 0.002, p.z), 'metal', 0x3a3a3e); }
  // the houses' small things: numbers by the doors, milk on the step, aerials on the chimneys, the street's name
  const firstOfRegion = new Set();
  for (const o of town.houses) {
    if (o.s < s0 || o.s >= s1) continue;
    const F = houseFrame(o), hr = makeRng('hd:' + o.seed);
    houseNumber(group, F, o, 1 + o.id % 97);
    if (!o.shop && hr.chance(0.3)) for (let k = 0; k < hr.int(1, 3); k++) { const p = V3(o.d / 2 + 0.38 + 0.4 * 2, 0.62, o.doorZ + 0.45 + k * 0.1).applyMatrix4(F.matrix); kit.add(xf(cyl(0.035, 0.04, 0.2, 10), p.x, p.y + 0.1, p.z), 'plastic', 0xe8e8e4); kit.add(xf(cyl(0.022, 0.022, 0.02, 10), p.x, p.y + 0.21, p.z), 'paint', [0xc0a020, 0xc02020, 0x2060c0][k % 3]); }
    if (o.chimney && hr.chance(0.6)) {
      // a fishbone TV aerial on the chimney stack
      const cz = 0, base = V3(-o.d * 0.22, o.h + o.rh * 0.85, 0);
      const pole = limb(base.clone(), base.clone().add(V3(0, 1.4, 0)), 0.02, 0.015, 5); kit.add(pole, 'gutter', 0x6a6a70, F);
      for (let k = 0; k < 6; k++) kit.add(xf(box(0.015, 0.015, 0.5 - k * 0.04), base.x + 0.1 + k * 0.12, base.y + 1.25, base.z), 'gutter', 0x6a6a70, F);
      kit.add(xf(box(0.75, 0.02, 0.02), base.x + 0.38, base.y + 1.25, base.z), 'gutter', 0x6a6a70, F);
    }
    if (NAMES[o.region] && town.houses.find((h) => h.region === o.region && h.side === o.side && !h.shop) === o) streetName(group, F, o, NAMES[o.region]);
  }
  // the HOME signpost
  for (const sp of town.signposts || []) if (sp.s >= s0 && sp.s < s1) {
    const p = roadAt(sp.s, sp.l, 0.13);
    kit.add(xf(cyl(0.06, 0.07, 3.1, 8), p.x, p.y + 1.55, p.z, 0, 0, 0.04), 'wood', 0x4a3a2c);
    kit.add(xf(cone(0.09, 0.16, 4), p.x + 0.06, p.y + 3.18, p.z, 0, Math.PI / 4), 'wood', 0x4a3a2c);
    const arms = [[2.75, 0.35, 0.1, 'HOME'], [2.35, -2.5, -0.12, 'HOME'], [1.95, 1.3, 0.18, 'HOME?']];
    for (const [y, ry, rz, txt] of arms) {
      const sh = new THREE.Shape(); sh.moveTo(0, -0.15); sh.lineTo(0.95, -0.15); sh.lineTo(1.15, 0); sh.lineTo(0.95, 0.15); sh.lineTo(0, 0.15); sh.closePath();
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: false }); const uv = geo.attributes.uv, gp = geo.attributes.position; for (let i = 0; i < uv.count; i++) { const u = uv.getX(i) / 1.15; uv.setXY(i, gp.getZ(i) < 0.001 ? 1 - u : u, (uv.getY(i) + 0.15) / 0.3); } // the back reads the right way round too
      const tex = canvasTex('arm:' + txt, 256, 64, (g, w, h) => { g.fillStyle = '#d8ccb0'; g.fillRect(0, 0, w, h); for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(80,60,40,${Math.random() * 0.15})`; g.fillRect(0, Math.random() * h, w, 1 + Math.random() * 2); } g.fillStyle = '#2a1a14'; g.font = 'bold 40px Georgia'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w * 0.45, h / 2 + 2); });
      const m = new THREE.Mesh(geo, [new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }), new THREE.MeshStandardMaterial({ color: 0x8a7a60, roughness: 0.9 })]); m.position.set(p.x + 0.06, p.y + y, p.z); m.rotation.set(0, ry + sp.turn, rz); m.castShadow = true; group.add(m);
    }
  }
  // pillar boxes, a bus shelter, signs, chalk
  for (const pb of [70, 610, 880, 1330]) if (pb >= s0 && pb < s1) pillarBox(kit, pb, -4.2);
  if (760 >= s0 && 760 < s1) busStop(kit, group, 760, 4.0);
  if (20 >= s0 && 20 < s1) signPost(group, kit, 20, 4.5, 'children');
  if (996 >= s0 && 996 < s1) signPost(group, kit, 996, 4.5, 'playground');
  if (44 >= s0 && 44 < s1) hopscotch(group, 44, 3.9);
  if (520 >= s0 && 520 < s1) hopscotch(group, 520, -3.9);
  return { lights, obstacles };
}
