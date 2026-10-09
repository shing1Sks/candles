// Throwaway style mockup 5 (?style=nightmare): the street the way a frightened child would tell it the
// next morning. Houses too tall and too thin, roofs like witches' hats, all leaning in over the road;
// the street lamp bent over him like something looking down; a road that climbs forever toward one
// lit window at the top; a big moon. Flat picture-book colour with an ink line round everything.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const W = 1280, H = 720;
let _s = 911;
const rnd = () => ((_s = (Math.imul(_s, 1664525) + 1013904223) >>> 0) / 4294967296);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const scene = new THREE.Scene();

// ---------------------------------------------------------------- materials: three-tone toon + an ink hull
const ramp = new THREE.DataTexture(new Uint8Array([70, 70, 70, 255, 150, 150, 150, 255, 255, 255, 255, 255]), 3, 1);
ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.needsUpdate = true;
const toons = {};
const toon = (color, emissive = 0, map = null) => toons[`${color}:${emissive}:${map?.id}`] ||= new THREE.MeshToonMaterial({ color, gradientMap: ramp, emissive, map });
const flat = (color) => toons['b' + color] ||= new THREE.MeshBasicMaterial({ color });
const inks = {};
function ink(t) {
  if (inks[t]) return inks[t];
  const m = new THREE.MeshBasicMaterial({ color: 0x0a0712, side: THREE.BackSide });
  m.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n transformed += normalize(normal) * ${t.toFixed(4)};`); };
  return inks[t] = m;
}
function hullGeo(g) {
  const p = new THREE.BufferGeometry(); p.setAttribute('position', g.attributes.position.clone());
  if (g.index) p.setIndex(g.index.clone());
  const m = mergeVertices(p, 1e-3); m.computeVertexNormals(); return m;
}
// a mesh with its ink outline
function inked(geo, mat, t = 0.03, parent = scene) {
  const m = new THREE.Mesh(geo, mat);
  if (t > 0) m.add(new THREE.Mesh(hullGeo(geo), ink(t)));
  parent.add(m); return m;
}
const at = (geo, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
  geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz)));

let GLOWTEX = null;
function glow(p, color, size, op = 1, fog = true) {
  if (!GLOWTEX) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); GLOWTEX = new THREE.CanvasTexture(c);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOWTEX, color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog }));
  s.position.copy(p); s.scale.set(size, size, 1); scene.add(s); return s;
}
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}

// ---------------------------------------------------------------- the road: it wanders, then climbs forever
const C = (s) => new THREE.Vector3(Math.sin(s * 0.045) * 3.0, s < 12 ? 0 : Math.pow((s - 12) / 90, 1.7) * 15, -s);
const Nrm = (s) => { const a = C(s - 0.5), b = C(s + 0.5), t = b.sub(a).setY(0).normalize(); return new THREE.Vector3(-t.z, 0, t.x); };
function ribbon(s0, s1, la, lb, dy = 0, uvs = 1) {
  const l0 = Math.min(la, lb), l1 = Math.max(la, lb), pos = [], uv = [], idx = [], n = Math.ceil((s1 - s0) / 0.6);
  for (let i = 0; i <= n; i++) {
    const s = s0 + (s1 - s0) * i / n, c = C(s), N = Nrm(s);
    for (const l of [l0, l1]) { const p = c.clone().addScaledVector(N, l); pos.push(p.x, p.y + dy + (Math.abs(l) > 6 ? Math.sin(s * 0.13 + l) * 0.6 * Math.min(1, (Math.abs(l) - 6) / 8) : 0), p.z); uv.push(l / uvs, s / uvs); }
    if (i < n) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}
const cobbles = canvasTex(256, 256, (g, w) => {
  g.fillStyle = '#4a4466'; g.fillRect(0, 0, w, w);
  for (let r = 0; r < 8; r++) for (let k = 0; k < 6; k++) {
    const x = k * 44 + (r % 2) * 22 + rnd() * 6, y = r * 32 + rnd() * 4, v = 0.85 + rnd() * 0.3;
    g.fillStyle = `rgb(${92 * v | 0},${84 * v | 0},${122 * v | 0})`; g.beginPath(); g.ellipse(x, y + 14, 18 + rnd() * 4, 12 + rnd() * 3, rnd() * 0.4, 0, 7); g.fill();
    g.strokeStyle = '#231d36'; g.lineWidth = 2.5; g.stroke();
  }
});
inked(ribbon(-8, 125, -2.7, 2.7, 0, 2.4), toon(0xffffff, 0, cobbles), 0);
for (const sd of [-1, 1]) {
  inked(ribbon(-8, 125, sd * 2.7, sd * 2.95, 0.12), toon(0x7a7098), 0);
  inked(ribbon(-8, 125, sd * 2.95, sd * 4.5, 0.1), toon(0x5a5478), 0);
  inked(ribbon(-8, 125, sd * 4.5, sd * 60, 0.0), toon(0x1e2230), 0);
}
// home: one small ordinary house at the very top of the climb, a light on
const homeS = 112;

// ---------------------------------------------------------------- the houses
// built in a local frame (front faces +x, toward the road), then every vertex is bent: the higher it
// is the more it leans out over the road, with a little twist and taper, so the whole house curls
const warp = (o) => (x, y, z) => {
  const t = Math.max(0, y / o.H), a = o.twist * t, sc = 1 - o.taper * t;
  return [(x * Math.cos(a) - z * Math.sin(a)) * sc + o.lean * t * t * o.H * 0.38, y, (x * Math.sin(a) + z * Math.cos(a)) * sc];
};
function bend(geo, f) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const [x, y, z] = f(p.getX(i), p.getY(i), p.getZ(i)); p.setXYZ(i, x, y, z); }
  geo.computeVertexNormals(); return geo;
}
const WALLS = [0x4b3f6b, 0x3e4c66, 0x5b4058, 0x3d5550, 0x5a5070, 0x6a4a5a], ROOFS = [0x261d3c, 0x1f1a2e, 0x3a1f30, 0x1d2a2e];
const LIT = 0xf7d35c, DARK = 0x110d1c;
function house(s, side, o) {
  const g = new THREE.Group(), c = C(s), N = Nrm(s), toRoad = N.clone().multiplyScalar(side < 0 ? 1 : -1);
  g.position.copy(c).addScaledVector(N, side * (4.9 + o.d / 2)); g.position.y -= 0.05;
  g.rotation.y = Math.atan2(-toRoad.z, toRoad.x);
  o.H = o.h + o.rh; const f = warp(o), parts = [];
  const P = (geo, mat, t) => parts.push([geo, mat, t]);
  P(at(new THREE.BoxGeometry(o.d, o.h, o.w, 2, 18, 3), 0, o.h / 2, 0), toon(o.wall), 0.05);
  // the roof: a tall four-sided witch's hat, or two
  const r = Math.max(o.w, o.d) * 0.78;
  P(at(new THREE.ConeGeometry(r, o.rh, 4, 10), 0, o.h + o.rh / 2 - 0.05, 0, 0, Math.PI / 4), toon(o.roof), 0.05);
  if (o.turret) P(at(new THREE.ConeGeometry(0.9, o.rh * 0.8, 6, 8), o.d * 0.2, o.h + o.rh * 0.25, o.w * 0.42), toon(o.roof), 0.04);
  const fx = o.d / 2 + 0.03;
  // windows: round ones with a cross, tall thin arched ones; most dark
  for (let k = 0; k < o.win.length; k++) {
    const { kind, y, z, lit } = o.win[k], col = lit ? flat(LIT) : flat(DARK);
    if (kind === 'eye') {
      const u = (y - o.h) / o.rh, xr = 0.707 * r * (1 - u) + 0.05, a = Math.atan2(0.707 * r, o.rh);
      const put = (g) => g.rotateY(Math.PI / 2).rotateZ(a).translate(xr, y, z);
      P(put(new THREE.CircleGeometry(0.45, 20)), col, 0);
      P(put(new THREE.TorusGeometry(0.48, 0.07, 6, 20)), toon(0x2a2238), 0.02);
    } else if (kind === 'round') {
      P(at(new THREE.CircleGeometry(0.55, 20), fx, y, z, 0, Math.PI / 2), col, 0);
      P(at(new THREE.TorusGeometry(0.58, 0.08, 6, 20), fx, y, z, 0, Math.PI / 2), toon(0x2a2238), 0.02);
      P(at(new THREE.BoxGeometry(0.06, 1.1, 0.07), fx + 0.02, y, z, 0.15), toon(0x2a2238), 0);
      P(at(new THREE.BoxGeometry(0.06, 1.1, 0.07), fx + 0.02, y, z, Math.PI / 2 + 0.15), toon(0x2a2238), 0);
    } else {
      const sh = new THREE.Shape(); sh.moveTo(-0.35, -0.8); sh.lineTo(0.35, -0.8); sh.lineTo(0.35, 0.4); sh.quadraticCurveTo(0, 1.05, -0.35, 0.4); sh.closePath();
      P(at(new THREE.ShapeGeometry(sh, 6), fx, y, z, 0, Math.PI / 2, (rnd() - 0.5) * 0.25), col, 0);
    }
    if (lit) parts.push(['glow', y, z]);
  }
  // a narrow door, a little crooked
  const ds = new THREE.Shape(); ds.moveTo(-0.45, 0); ds.lineTo(0.4, 0); ds.lineTo(0.32, 1.9); ds.quadraticCurveTo(0, 2.5, -0.4, 1.95); ds.closePath();
  P(at(new THREE.ShapeGeometry(ds, 6), fx, 0, o.doorZ, 0, Math.PI / 2, 0.06), flat(0x0c0912), 0);
  for (const [geo, mat, t] of parts) {
    if (geo === 'glow') continue;
    inked(bend(geo, f), mat, t, g);
  }
  scene.add(g); g.updateMatrixWorld(true);
  for (const p of parts) if (p[0] === 'glow') { const [x, y, z] = f(fx + 0.6, p[1], p[2]); const w = new THREE.Vector3(x, y, z).applyMatrix4(g.matrixWorld); glow(w, 0xffc850, 1.0, 0.35); }
  o.group = g; o.f = f; o.fx = fx;
  return o;
}
function windowsFor(o) {
  const out = [], rows = Math.floor((o.h - 2.6) / 2.1);
  for (let r = 0; r <= rows; r++) {
    const y = 3.4 + r * 2.1; if (y > o.h - 0.8) break;
    const n = o.w > 5 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const z = n === 1 ? (rnd() - 0.5) * 0.8 : (k ? 1 : -1) * o.w * 0.24;
      if (rnd() < 0.2) continue;
      out.push({ kind: rnd() < 0.45 ? 'round' : 'arch', y: y + (rnd() - 0.5) * 0.4, z, lit: rnd() < 0.18 });
    }
  }
  // one round window up in the roof, like an eye
  out.push({ kind: 'eye', y: o.h + o.rh * 0.2, z: 0, lit: rnd() < 0.35 });
  return out;
}
const houses = [];
for (const side of [-1, 1]) {
  for (let s = side < 0 ? 10 : 13, n = 0; s < 104; s += 6.2 + rnd() * 2.2 + (side < 0 && n++ === 0 ? 3.2 : 0)) {
    const o = { w: 4 + rnd() * 2.2, d: 5, h: 6 + rnd() * 5, rh: 4.5 + rnd() * 4, lean: 0.5 + rnd() * 0.4, twist: (rnd() - 0.5) * 0.3, taper: 0.12 + rnd() * 0.12,
      wall: pick(WALLS), roof: pick(ROOFS), turret: rnd() < 0.25 };
    o.doorZ = (rnd() - 0.5) * (o.w - 1.6); o.win = windowsFor(o);
    houses.push({ s, side, ...house(s, side, o) });
  }
}

// ---------------------------------------------------------------- crooked fences, curly trees
for (const sd of [-1, 1]) {
  for (let s = 1; s < 100; s += 0.42) {
    if (rnd() < 0.08) { s += 1.5; continue; }
    const c = C(s).addScaledVector(Nrm(s), sd * 4.65), h = 0.8 + rnd() * 0.35, tilt = (rnd() - 0.5) * 0.35;
    const geo = new THREE.BoxGeometry(0.11, h, 0.05); geo.translate(0, h / 2, 0);
    const tip = new THREE.ConeGeometry(0.08, 0.22, 4); tip.translate(0, h + 0.1, 0);
    for (const gg of [geo, tip]) { const m = inked(gg, toon(0x8a83a8), 0.015); m.position.copy(c); m.rotation.set(tilt * 0.4, rnd() * 0.3, tilt); }
  }
}
function curlyTree(p, h) {
  const g = new THREE.Group(); g.position.copy(p); scene.add(g);
  const trunk = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.3, h * 0.4, 0), new THREE.Vector3(-0.3, h * 0.75, 0.2), new THREE.Vector3(0.1, h, 0)]);
  inked(new THREE.TubeGeometry(trunk, 20, 0.22, 6), toon(0x2a2030), 0.03, g);
  for (let k = 0; k < 5; k++) {
    const a = k * 1.3 + rnd(), base = trunk.getPoint(0.55 + k * 0.09), pts = [base];
    let r = 1.6 + rnd() * 0.8;
    // out, then curling up into a spiral
    for (let i = 1; i <= 26; i++) { const t = i / 26, ang = a + t * 5.5; r *= 0.93; pts.push(base.clone().add(new THREE.Vector3(Math.cos(a) * (1 - t) * 2.2 + Math.cos(ang) * r * t, t * 1.6 + Math.sin(ang) * r * t * 0.8, Math.sin(a) * (1 - t) * 2.2))); }
    inked(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.07, 5), toon(0x2a2030), 0.02, g);
  }
}
for (const [s, l] of [[9, -7.5], [27, 8], [44, -8], [63, 8.5], [80, -7.6]]) curlyTree(C(s).addScaledVector(Nrm(s), l), 6 + rnd() * 3);

// ---------------------------------------------------------------- the lamp that bends over him
{
  const s = 9.5, c = C(s), N = Nrm(s), up = new THREE.Vector3(0, 1, 0), B = c.clone().addScaledVector(N, 4.7);
  const P = (u, l) => B.clone().addScaledVector(up, u).addScaledVector(N, -l);
  const curve = new THREE.CatmullRomCurve3([P(0, 0), P(3.5, 0.1), P(6.6, 0.7), P(8.2, 2.4), P(7.9, 4.2), P(6.9, 5.0)]);
  inked(new THREE.TubeGeometry(curve, 60, 0.13, 8), toon(0x1e1a2a), 0.035);
  inked(at(new THREE.CylinderGeometry(0.3, 0.42, 0.5, 10), B.x, B.y + 0.25, B.z), toon(0x1e1a2a), 0.03);
  // the hood, bowed like a head, the bulb under it
  const end = curve.getPoint(1), hood = new THREE.SphereGeometry(0.75, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const hm = inked(hood, toon(0x1e1a2a), 0.04); hm.position.copy(end); hm.scale.set(1, 0.85, 1.25); hm.rotation.set(-0.35, Math.atan2(-N.z, N.x), 0.25);
  const bulb = end.clone().add(new THREE.Vector3(0, -0.12, 0));
  const bm = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), flat(0xfff0b0)); bm.position.copy(bulb); scene.add(bm);
  glow(bulb, 0xffd27a, 4.5, 0.9);
  const sp = new THREE.SpotLight(0xffc860, 260, 22, 0.62, 0.45, 2); sp.position.copy(bulb); sp.target.position.copy(C(s + 0.5)); scene.add(sp, sp.target);
}

// ---------------------------------------------------------------- the thing between the houses
// in the gap after the second house on the left: long fingers round the corner, two eyes further back
{
  const h = houses.filter((x) => x.side < 0)[0], g = h.group, f = h.f, wz = -h.w / 2;
  const mat = flat(0x050308);
  for (let k = 0; k < 4; k++) {
    const nz = h.w / 2, y = 3.3 + k * 0.5 - (k === 3 ? 1.1 : 0), len = k === 3 ? 0.8 : 1.4 + k * 0.15;
    const pts = [[h.fx - 1.8, y + 0.15, nz + 0.14], [h.fx - 0.6, y, nz + 0.16], [h.fx + 0.03, y - 0.05, nz + 0.12], [h.fx + 0.16, y - 0.2, nz - len * 0.45], [h.fx + 0.12, y - 0.45, nz - len]]
      .map(([x, yy, z]) => new THREE.Vector3(...f(x, yy, z)));
    const m = inked(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.14 - k * 0.012, 6), mat, 0.02, g); (window.__hand ||= []).push(m);
  }
  for (const dz of [-0.28, 0.28]) {
    const [x, y, z] = f(h.fx - 0.25 + dz * 0.6, 5.9 + dz * 0.1, h.w / 2 + 0.35), p = new THREE.Vector3(x, y, z).applyMatrix4(g.matrixWorld);
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), flat(0xfff6c0)); e.position.copy(p); e.scale.set(1, 0.6, 1); scene.add(e);
    glow(p, 0xfff0a0, 1.6, 0.8);
  }
}

// ---------------------------------------------------------------- home, at the top, far away
{
  const c = C(homeS), N = Nrm(homeS), g = new THREE.Group(); g.position.copy(c).addScaledVector(N, 0); g.position.z -= 6; scene.add(g);
  inked(at(new THREE.BoxGeometry(5, 3.4, 4), 0, 1.7, 0), toon(0x6a5a7a), 0.05, g);
  inked(at(new THREE.ConeGeometry(4, 2.6, 4), 0, 4.7, 0, 0, Math.PI / 4), toon(0x3a2a3a), 0.05, g);
  for (const x of [-1.3, 1.3]) inked(at(new THREE.PlaneGeometry(0.8, 0.8), x, 2.0, 2.02), flat(LIT), 0, g);
  g.updateMatrixWorld(true);
  glow(new THREE.Vector3(0, 2.0, 2.4).applyMatrix4(g.matrixWorld), 0xffc860, 12, 1, false);
}

// ---------------------------------------------------------------- the boy and the puppy, picture-book shapes
const boy = new THREE.Group(); scene.add(boy);
{
  inked(at(new THREE.ConeGeometry(0.33, 0.78, 18), 0, 0.62, 0), toon(0x2b3a6a), 0.014, boy);           // coat
  for (const x of [-0.09, 0.09]) { inked(at(new THREE.CylinderGeometry(0.05, 0.05, 0.26, 8), x, 0.16, 0), toon(0x22263a), 0.01, boy); inked(at(new THREE.BoxGeometry(0.13, 0.1, 0.2), x, 0.05, -0.03), toon(0xc8302a), 0.01, boy); }
  inked(at(new THREE.BoxGeometry(0.3, 0.32, 0.14), 0, 0.72, 0.2), toon(0xe0a83a), 0.012, boy);         // backpack
  inked(at(new THREE.SphereGeometry(0.21, 18, 14), 0, 1.15, 0), toon(0xe8b898), 0.014, boy);          // head
  inked(at(new THREE.SphereGeometry(0.215, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), 0, 1.17, 0.02), toon(0x3a2418), 0.0, boy); // hair
  inked(at(new THREE.ConeGeometry(0.2, 0.5, 16), 0, 1.45, 0.08, 0.5, 0, -0.15), toon(0xd0342a), 0.014, boy); // floppy hat
  inked(at(new THREE.SphereGeometry(0.07, 10, 8), 0.05, 1.62, 0.3), toon(0xf0e0d0), 0.01, boy);        // bobble
  inked(at(new THREE.CylinderGeometry(0.045, 0.04, 0.42, 8), 0.27, 0.78, -0.12, 0.9, 0, -0.5), toon(0x2b3a6a), 0.01, boy); // arm out to the lead
}
boy.position.copy(C(0)).add(new THREE.Vector3(0.35, 0, 0));
const pup = new THREE.Group(); scene.add(pup);
const pupHead = new THREE.Group(); pupHead.position.set(0, 0.42, -0.22); pup.add(pupHead);
{
  const cream = toon(0xf4e0b8, 0x3a2a18), toffee = toon(0xc08850, 0x201008);
  inked(at(new THREE.SphereGeometry(0.2, 16, 12), 0, 0.25, 0, 0, 0, 0, 0.85, 0.8, 1.25), cream, 0.012, pup);
  for (const [x, z] of [[-0.09, -0.13], [0.09, -0.13], [-0.09, 0.13], [0.09, 0.13]]) inked(at(new THREE.CylinderGeometry(0.04, 0.045, 0.16, 8), x, 0.08, z), cream, 0.008, pup);
  inked(at(new THREE.ConeGeometry(0.04, 0.2, 8), 0, 0.42, 0.24, -0.6), cream, 0.008, pup);
  inked(at(new THREE.TorusGeometry(0.1, 0.022, 6, 14), 0, 0.36, -0.17, Math.PI / 2 - 0.4), toon(0xd23a2e), 0.006, pup);
  inked(at(new THREE.SphereGeometry(0.17, 16, 12), 0, 0, 0), cream, 0.012, pupHead);
  inked(at(new THREE.SphereGeometry(0.075, 12, 10), 0, -0.04, -0.15, 0, 0, 0, 1, 0.8, 1), cream, 0.008, pupHead);
  inked(at(new THREE.SphereGeometry(0.03, 8, 6), 0, -0.01, -0.225), flat(0x140e10), 0, pupHead);
  for (const s of [-1, 1]) {
    inked(at(new THREE.SphereGeometry(0.035, 10, 8), s * 0.065, 0.04, -0.13), flat(0x0e0a0c), 0, pupHead);
    inked(at(new THREE.SphereGeometry(0.011, 6, 4), s * 0.065 + 0.012, 0.055, -0.16), flat(0xffffff), 0, pupHead);
    inked(at(new THREE.SphereGeometry(0.06, 10, 8), s * 0.15, 0.06, 0.0, 0, 0, s * 0.9, 0.55, 1.5, 0.9), toffee, 0.008, pupHead); // ears, pricked up
  }
}
pup.position.copy(C(0)).add(new THREE.Vector3(1.25, 0, -1.15)); pup.rotation.y = 0.35; pupHead.rotation.set(0.25, 0.75, 0); // staring at the gap
{
  boy.updateMatrixWorld(true); pup.updateMatrixWorld(true);
  const a = new THREE.Vector3(0.43, 0.62, -0.32).applyMatrix4(boy.matrixWorld), b = new THREE.Vector3(0, 0.4, -0.18).applyMatrix4(pup.matrixWorld);
  const mid = a.clone().lerp(b, 0.5); mid.y -= 0.12;
  inked(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a, mid, b]), 16, 0.012, 5), toon(0xd23a2e), 0.006);
}

// ---------------------------------------------------------------- sky, moon, light, fog
scene.background = canvasTex(1024, 512, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0e0b22'); gr.addColorStop(0.65, '#2f2655'); gr.addColorStop(1, '#4a3a6e');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(255,245,210,${0.3 + rnd() * 0.6})`; const r = rnd() < 0.1 ? 1.8 : 0.9; g.beginPath(); g.arc(rnd() * w, rnd() * h * 0.6, r, 0, 7); g.fill(); }
  // swirling clouds, the way you'd draw wind
  g.lineCap = 'round';
  for (let k = 0; k < 9; k++) {
    const cx = rnd() * w, cy = 40 + rnd() * h * 0.45; g.strokeStyle = `rgba(150,130,200,${0.12 + rnd() * 0.12})`; g.lineWidth = 6 + rnd() * 10;
    g.beginPath(); for (let t = 0; t < 1; t += 0.02) { const a = t * 9, r = 70 * (1 - t) + 6; const x = cx + Math.cos(a) * r + t * 160, y = cy + Math.sin(a) * r * 0.45; t ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
  }
});
scene.background.wrapS = scene.background.wrapT = THREE.ClampToEdgeWrapping;
{
  const moon = canvasTex(256, 256, (g, w) => {
    const gr = g.createRadialGradient(128, 128, 60, 128, 128, 128); gr.addColorStop(0, 'rgba(255,240,190,0.5)'); gr.addColorStop(1, 'rgba(255,240,190,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
    g.fillStyle = '#f6ecc4'; g.beginPath(); g.arc(128, 128, 70, 0, 7); g.fill(); g.strokeStyle = '#0a0712'; g.lineWidth = 4; g.stroke();
    g.fillStyle = 'rgba(180,165,130,0.55)'; for (const [x, y, r] of [[105, 110, 14], [150, 140, 10], [120, 160, 8], [155, 100, 7]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  });
  const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: moon, fog: false, depthWrite: false })); m.position.set(-30, 82, -150); m.scale.set(46, 46, 1); m.renderOrder = -1; scene.add(m);
}
scene.fog = new THREE.Fog(0x1d1838, 22, 120);
scene.add(new THREE.HemisphereLight(0x7a6ab8, 0x120e1e, 0.5));
const moonLight = new THREE.DirectionalLight(0xc8c0ff, 2.0); moonLight.position.set(30, 40, -30); scene.add(moonLight);
const fill = new THREE.DirectionalLight(0x6a5aa8, 0.45); fill.position.set(-12, 8, 30); scene.add(fill);

// ---------------------------------------------------------------- camera low behind him, looking up at it all
const camera = new THREE.PerspectiveCamera(66, W / H, 0.05, 500);
camera.fov = 60; camera.position.set(1.5, 1.6, 6.2); camera.lookAt(-0.3, 5.2, -20); camera.rotateZ(0.035); camera.updateProjectionMatrix();

// ---------------------------------------------------------------- render + paper pass (wobble, grain, vignette)
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H); document.body.appendChild(renderer.domElement);
const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  uniforms: { tScene: { value: rt.texture }, uRes: { value: new THREE.Vector2(W, H) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
  fragmentShader: /* glsl */`
    uniform sampler2D tScene; uniform vec2 uRes; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
    void main(){
      vec2 uv = vUv;
      // hand-drawn wobble: nothing quite straight
      uv += (vec2(vnoise(uv * vec2(9., 14.)), vnoise(uv * vec2(14., 9.) + 7.)) - 0.5) * 0.004;
      vec3 c = texture2D(tScene, uv).rgb;
      c = pow(clamp(c, 0., 1.), vec3(1. / 2.2));
      // paper: fibres and blotches
      float paper = 0.9 + 0.1 * vnoise(vUv * uRes / 3.) * vnoise(vUv * 6.);
      c *= paper;
      c += (hash(floor(vUv * uRes)) - 0.5) * 0.04;
      vec2 q = vUv - 0.5; c *= clamp(1. - dot(q * vec2(0.9, 1.1), q * vec2(0.9, 1.1)) * 1.6, 0., 1.);
      gl_FragColor = vec4(c, 1.);
    }`,
}));
const postScene = new THREE.Scene(); postScene.add(quad);
const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
function frame() { renderer.setRenderTarget(rt); renderer.render(scene, camera); renderer.setRenderTarget(null); renderer.render(postScene, ortho); }
frame();
requestAnimationFrame(() => { frame(); requestAnimationFrame(() => { frame(); document.body.dataset.ready = '1'; }); });
window.__dbg = () => { const T = THREE, out = []; for (const m of window.__hand) { m.updateMatrixWorld(true); const b = new T.Box3().setFromObject(m), c = b.getCenter(new T.Vector3()); const p = c.clone().project(camera); out.push([+(p.x * 640 + 640).toFixed(0), +(360 - p.y * 360).toFixed(0), +p.z.toFixed(3)]); } return out; };
window.__shot = () => renderer.domElement.toDataURL('image/png');
