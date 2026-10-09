// Throwaway style mockup (?style=nightmare): the street the way a frightened child would tell it the
// next morning, now first person at a child's eye height. Houses too tall, roofs like witches' hats,
// all leaning in over the road; bent lamps with beams you can see; yards full of things; a road that
// climbs forever toward one lit window. Picture-book colour, cast shadows, an ink line round everything.
//   &shot=walk   on the pavement, the puppy trotting ahead on the lead, looking back at you
//   &shot=hide   crouched behind a hedge with the puppy in your arms; something tall in the lamplight
//   &look=ink    flat toon bands, heavy ink, hand-drawn wobble        &look=paint   soft gouache, thin ink
//   &pal=moon    violet moonlight                                     &pal=ember    teal night, orange lamps
import * as THREE from 'three';
import { mergeVertices, mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const Q = new URLSearchParams(location.search);
const SHOT = Q.get('shot') || 'walk', LOOK = Q.get('look') || 'ink', PALN = Q.get('pal') || 'moon';
const W = 1280, H = 720, INK = LOOK === 'ink';
let _s = 911;
const rnd = () => ((_s = (Math.imul(_s, 1664525) + 1013904223) >>> 0) / 4294967296);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const scene = new THREE.Scene();

const PALS = {
  moon: {
    sky: ['#0c0a20', '#2a2350', '#4d3c72'], fog: 0x241e46, hemi: [0x7a6ab8, 0x140f22, 0.55], moon: 0xc8c0ff, fill: 0x5a4aa0,
    lamp: 0xffc468, win: 0xf7d35c, walls: [0x4b3f6b, 0x3e4c66, 0x5b4058, 0x3d5550, 0x5a5070, 0x6a4a5a], roofs: [0x261d3c, 0x1f1a2e, 0x3a1f30, 0x1d2a2e],
    trim: 0x8a80a8, ground: 0x1d2333, pave: 0x5a5478, kerb: 0x7a7098, cobble: ['#4a4466', [92, 84, 122]], leaf: [0xb0603a, 0x8a4a3a, 0xc08a4a, 0x6a4a5a],
    green: 0x2a3d3a, hills: [0x2a2450, 0x352c5c, 0x433868], cloud: 0x4a4278,
  },
  ember: {
    sky: ['#050f16', '#123038', '#3a5a52'], fog: 0x14302e, hemi: [0x6aa898, 0x0a1410, 0.55], moon: 0xd8f0c0, fill: 0x2a5a58,
    lamp: 0xff8a30, win: 0xffa040, walls: [0x3a5a52, 0x5a4a3a, 0x2f4a4e, 0x6a5038, 0x4a3a3a, 0x3a4a3a], roofs: [0x1e2a26, 0x3a2018, 0x24201c, 0x2a1a1a],
    trim: 0x9a9a7a, ground: 0x14221c, pave: 0x4a5a50, kerb: 0x6a7a6a, cobble: ['#38463e', [70, 90, 78]], leaf: [0xc06020, 0x9a4020, 0xd0902a, 0x7a3a20],
    green: 0x1e3a2a, hills: [0x123030, 0x1a3a38, 0x244a44], cloud: 0x2a4a48,
  },
};
const PAL = PALS[PALN];

// ---------------------------------------------------------------- materials
const rampData = INK ? [60, 140, 255] : [50, 85, 120, 160, 205, 255];
const ramp = new THREE.DataTexture(new Uint8Array(rampData.flatMap((v) => [v, v, v, 255])), rampData.length, 1);
ramp.minFilter = ramp.magFilter = INK ? THREE.NearestFilter : THREE.LinearFilter; ramp.needsUpdate = true;
const mats = {};
const toon = (color, emissive = 0, map = null) => mats[`t${color}:${emissive}:${map?.id}`] ||= new THREE.MeshToonMaterial({ color, gradientMap: ramp, emissive, map });
const flat = (color) => mats['b' + color] ||= new THREE.MeshBasicMaterial({ color });
const INKK = INK ? 1 : 0.45;
const inks = {};
function ink(t) {
  t = +(t * INKK).toFixed(4);
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
function inked(geo, mat, t = 0.03, parent = scene, shadow = true) {
  const m = new THREE.Mesh(geo, mat); m.castShadow = shadow; m.receiveShadow = true;
  if (t > 0) m.add(new THREE.Mesh(hullGeo(geo), ink(t)));
  parent.add(m); return m;
}
const at = (geo, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
  geo.applyMatrix4(new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V(sx, sy, sz)));
// a cylinder from a to b
function limb(a, b, r0, r1 = r0, seg = 8) {
  const d = b.clone().sub(a), g = new THREE.CylinderGeometry(r1, r0, d.length(), seg);
  g.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.clone().normalize()), V(1, 1, 1)));
  return g;
}
// many small parts, merged per material so a house is a dozen meshes, not hundreds
class Batch {
  constructor() { this.m = new Map(); }
  add(geo, mat, t = 0.03) {
    const k = mat.uuid + ':' + t; if (!this.m.has(k)) this.m.set(k, { mat, t, geos: [] });
    this.m.get(k).geos.push(geo);
  }
  flush(parent = scene) {
    for (const { mat, t, geos } of this.m.values()) {
      const gs = geos.map((geo) => {
        const g = geo.index ? geo.toNonIndexed() : geo;
        for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(a)) g.deleteAttribute(a);
        if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
        return g;
      });
      inked(mergeGeometries(gs), mat, t, parent);
    }
    this.m.clear();
  }
}

let GLOWTEX = null;
function glow(p, color, size, op = 1, fog = true, parent = scene) {
  if (!GLOWTEX) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); GLOWTEX = new THREE.CanvasTexture(c);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOWTEX, color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog }));
  s.position.copy(p); s.scale.set(size, size, 1); parent.add(s); return s;
}
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}
// a shaft of lamplight you can see: an open cone, bright at the bulb, soft at the edges
function beam(top, h, r, color) {
  const g = new THREE.ConeGeometry(r, h, 28, 1, true);
  const m = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uH: { value: h } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying float vY; varying vec3 vN, vV; void main(){ vY = position.y; vec4 mv = modelViewMatrix * vec4(position, 1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uColor; uniform float uH; varying float vY; varying vec3 vN, vV; void main(){ float t = clamp(0.5 - vY / uH, 0., 1.); float f = pow(abs(dot(normalize(vN), normalize(vV))), 2.); gl_FragColor = vec4(uColor * (1. - t * 0.75) * f * 0.16, 1.); }',
  });
  const mesh = new THREE.Mesh(g, m); mesh.position.copy(top).add(V(0, -h / 2, 0)); scene.add(mesh); return mesh;
}

// ---------------------------------------------------------------- the road: it wanders, then climbs forever
const C = (s) => V(Math.sin(s * 0.045) * 3.0, s < 14 ? 0 : Math.pow((s - 14) / 90, 1.7) * 15, -s);
const Nrm = (s) => { const a = C(s - 0.5), b = C(s + 0.5), t = b.sub(a).setY(0).normalize(); return V(-t.z, 0, t.x); };
const onRoad = (s, l, y = 0) => C(s).addScaledVector(Nrm(s), l).add(V(0, y, 0));
function ribbon(s0, s1, la, lb, dy = 0, uvs = 1) {
  const l0 = Math.min(la, lb), l1 = Math.max(la, lb), pos = [], uv = [], idx = [], n = Math.ceil((s1 - s0) / 0.6);
  for (let i = 0; i <= n; i++) {
    const s = s0 + (s1 - s0) * i / n, c = C(s), N = Nrm(s);
    for (const l of [l0, l1]) {
      const p = c.clone().addScaledVector(N, l), hill = Math.abs(l) > 9 ? Math.sin(s * 0.13 + l) * 0.8 * Math.min(1, (Math.abs(l) - 9) / 10) : 0;
      pos.push(p.x, p.y + dy + hill, p.z); uv.push(l / uvs, s / uvs);
    }
    if (i < n) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}
const cobbles = canvasTex(256, 256, (g, w) => {
  g.fillStyle = PAL.cobble[0]; g.fillRect(0, 0, w, w); const [r0, g0, b0] = PAL.cobble[1];
  for (let r = 0; r < 8; r++) for (let k = 0; k < 7; k++) {
    const x = k * 40 + (r % 2) * 20 + rnd() * 6 - 6, y = r * 32 + rnd() * 4, v = 0.8 + rnd() * 0.35;
    g.fillStyle = `rgb(${r0 * v | 0},${g0 * v | 0},${b0 * v | 0})`; g.beginPath(); g.ellipse(x, y + 14, 17 + rnd() * 4, 12 + rnd() * 3, rnd() * 0.4, 0, 7); g.fill();
    g.strokeStyle = 'rgba(20,14,34,0.9)'; g.lineWidth = 2.5; g.stroke();
  }
});
const slabs = canvasTex(128, 128, (g, w) => { g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, w, w); g.strokeStyle = '#7a7a7a'; g.lineWidth = 3; g.strokeRect(2, 2, 124, 124); g.beginPath(); g.moveTo(30, 2); g.lineTo(52, 60); g.lineTo(44, 126); g.stroke(); });
const shingles = canvasTex(128, 128, (g, w) => {
  g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, w, w);
  for (let r = 0; r < 8; r++) for (let k = -1; k < 5; k++) { const x = k * 32 + (r % 2) * 16; g.fillStyle = `rgb(${170 + rnd() * 60 | 0},${170 + rnd() * 60 | 0},${170 + rnd() * 60 | 0})`; g.beginPath(); g.moveTo(x, r * 16); g.lineTo(x + 30, r * 16); g.lineTo(x + 28, r * 16 + 14); g.quadraticCurveTo(x + 15, r * 16 + 20, x + 2, r * 16 + 14); g.closePath(); g.fill(); g.strokeStyle = '#4a4a4a'; g.lineWidth = 1.5; g.stroke(); }
});
const grassTex = canvasTex(128, 128, (g, w) => { g.fillStyle = '#b8b8b8'; g.fillRect(0, 0, w, w); for (let i = 0; i < 500; i++) { const v = 120 + rnd() * 135 | 0; g.strokeStyle = `rgb(${v},${v},${v})`; g.lineWidth = 1.5; const x = rnd() * w, y = rnd() * w; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 2, y - 4, x + rnd() * 4 - 2, y - 7); g.stroke(); } });
inked(ribbon(-10, 125, -2.8, 2.8, 0, 2.4), toon(0xffffff, 0, cobbles), 0);
for (const sd of [-1, 1]) {
  inked(ribbon(-10, 125, sd * 2.8, sd * 3.05, 0.13), toon(PAL.kerb), 0);
  inked(ribbon(-10, 125, sd * 3.05, sd * 4.7, 0.1, 1.6), toon(PAL.pave, 0, slabs), 0);
  inked(ribbon(-10, 125, sd * 4.7, sd * 70, 0.02, 3), toon(PAL.ground, 0, grassTex), 0);
}

// ---------------------------------------------------------------- the houses
// local frame: front faces +x (toward the road); every vertex is bent so the higher it is, the more it
// leans out over the road, with a little twist and taper; the yard in front is left straight
const warp = (o) => (x, y, z) => {
  const t = Math.max(0, y / o.H), a = o.twist * t, sc = 1 - o.taper * t;
  return [(x * Math.cos(a) - z * Math.sin(a)) * sc + o.lean * t * t * o.H * 0.34, y, (x * Math.sin(a) + z * Math.cos(a)) * sc];
};
function bend(geo, f) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const [x, y, z] = f(p.getX(i), p.getY(i), p.getZ(i)); p.setXYZ(i, x, y, z); }
  geo.computeVertexNormals(); return geo;
}
const DARK = 0x110d1c, FRAME = 0x2a2238;
const lightsLeft = { win: 5 };
function windowParts(B, o, kind, y, z, lit) {
  const fx = o.d / 2, glass = lit ? flat(PAL.win) : flat(DARK), fr = toon(o.trim);
  if (kind === 'round') {
    B.add(at(new THREE.CircleGeometry(0.55, 20), fx + 0.01, y, z, 0, Math.PI / 2), glass, 0);
    B.add(at(new THREE.TorusGeometry(0.6, 0.11, 8, 22), fx + 0.08, y, z, 0, Math.PI / 2), fr, 0.02);
    for (const r of [0.15, Math.PI / 2 + 0.15]) B.add(at(new THREE.BoxGeometry(0.07, 1.12, 0.07), fx + 0.06, y, z, r, 0, 0), toon(FRAME), 0);
  } else {
    // tall, arched, recessed: frame boxes stand proud of the wall so they throw shadows
    const sh = new THREE.Shape(); sh.moveTo(-0.38, -0.85); sh.lineTo(0.38, -0.85); sh.lineTo(0.38, 0.35); sh.quadraticCurveTo(0, 1.05, -0.38, 0.35); sh.closePath();
    B.add(at(new THREE.ShapeGeometry(sh, 6), fx + 0.01, y, z, 0, Math.PI / 2), glass, 0);
    for (const s of [-1, 1]) B.add(at(new THREE.BoxGeometry(0.16, 1.4, 0.12), fx + 0.07, y - 0.15, z + s * 0.45), fr, 0.02);
    B.add(at(new THREE.BoxGeometry(0.4, 0.12, 1.15), fx + 0.15, y - 0.9, z), fr, 0.02);                           // sill
    B.add(at(new THREE.TorusGeometry(0.43, 0.08, 6, 12, Math.PI), fx + 0.07, y + 0.4, z, 0, Math.PI / 2), fr, 0.02); // arch
    B.add(at(new THREE.BoxGeometry(0.06, 1.3, 0.06), fx + 0.04, y - 0.1, z), toon(FRAME), 0);                       // mullion
    if (rnd() < 0.55) {                                                                                         // shutters, one hanging
      const hang = rnd() < 0.4;
      B.add(at(new THREE.BoxGeometry(0.06, 1.45, 0.5), fx + 0.1, y - 0.15, z - 0.8, hang ? 0.25 : 0, -0.25), toon(o.shutter), 0.02);
      B.add(at(new THREE.BoxGeometry(0.06, 1.45, 0.5), fx + 0.1, y - 0.15, z + 0.8, 0, 0.25), toon(o.shutter), 0.02);
    }
    if (rnd() < 0.3) for (let k = 0; k < 4; k++) B.add(at(new THREE.SphereGeometry(0.09, 6, 5), fx + 0.25, y - 0.78, z - 0.35 + k * 0.23), toon(0x3a2a30), 0); // dead geraniums
  }
  return lit;
}
function lightAt(p, color, I, dist) { const l = new THREE.PointLight(color, I, dist, 2); l.position.copy(p); scene.add(l); return l; }
function house(s, side, o) {
  const g = new THREE.Group(), N = Nrm(s), toRoad = N.clone().multiplyScalar(-side);
  g.position.copy(C(s)).addScaledVector(N, side * (7.4 + o.d / 2)); g.position.y -= 0.05;
  g.rotation.y = Math.atan2(-toRoad.z, toRoad.x);
  o.H = o.h + o.rh; const f = warp(o), B = new Batch(), lit = [];
  const fx = o.d / 2, wall = toon(o.wall), trim = toon(o.trim);
  B.add(at(new THREE.BoxGeometry(o.d + 0.25, 0.7, o.w + 0.25), 0, 0.35, 0), toon(0x2a2434), 0.04);           // plinth
  B.add(at(new THREE.BoxGeometry(o.d, o.h, o.w, 2, 20, 3), 0, o.h / 2, 0), wall, 0.05);
  B.add(at(new THREE.BoxGeometry(o.d + 0.14, 0.2, o.w + 0.14, 1, 1, 3), 0, o.h * 0.48, 0), trim, 0.02);      // floor band
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) B.add(at(new THREE.BoxGeometry(0.24, o.h, 0.24, 1, 20, 1), sx * o.d / 2, o.h / 2, sz * o.w / 2), trim, 0.02);
  B.add(at(new THREE.BoxGeometry(o.d + 0.9, 0.22, o.w + 0.9, 2, 1, 2), 0, o.h + 0.05, 0), toon(o.roof), 0.03);    // eaves
  const r = Math.max(o.w, o.d) * 0.8;
  B.add(at(new THREE.ConeGeometry(r, o.rh, 4, 12), 0, o.h + o.rh / 2, 0, 0, Math.PI / 4), toon(o.roof, 0, shingles), 0.05);
  if (o.turret) { B.add(at(new THREE.CylinderGeometry(0.75, 0.8, 2.2, 10, 4), fx - 0.6, o.h + 0.6, o.w / 2 - 0.5), wall, 0.03); B.add(at(new THREE.ConeGeometry(1.05, o.rh * 0.75, 8, 8), fx - 0.6, o.h + 1.7 + o.rh * 0.375, o.w / 2 - 0.5), toon(o.roof, 0, shingles), 0.04); }
  // a crooked chimney
  B.add(at(new THREE.BoxGeometry(0.65, o.rh * 0.75, 0.65, 1, 4, 1), -o.d * 0.2, o.h + o.rh * 0.42, -o.w * 0.22, 0, 0, 0.12), toon(0x5a3a3a), 0.03);
  B.add(at(new THREE.BoxGeometry(0.85, 0.2, 0.85), -o.d * 0.2 + o.rh * 0.045, o.h + o.rh * 0.8, -o.w * 0.22, 0, 0, 0.12), toon(0x3a2a2a), 0.02);
  // windows: rows of tall arched ones and round ones; one eye in the roof
  const rows = Math.floor((o.h - 3.0) / 2.3);
  for (let rr = 0; rr <= rows; rr++) {
    const y = 3.6 + rr * 2.3; if (y > o.h - 1.1) break;
    const n = o.w > 5 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const z = n === 1 ? (rnd() - 0.5) * 0.6 : (k ? 1 : -1) * o.w * 0.25;
      if (rnd() < 0.15) continue;
      if (windowParts(B, o, rnd() < 0.3 ? 'round' : 'arch', y + (rnd() - 0.5) * 0.3, z, rnd() < 0.2)) lit.push([y, z]);
    }
  }
  {
    const y = o.h + o.rh * 0.2, u = 0.2, xr = 0.707 * r * (1 - u) + 0.06, a = Math.atan2(0.707 * r, o.rh), on = rnd() < 0.3;
    const put = (gg) => gg.rotateY(Math.PI / 2).rotateZ(a).translate(xr, y, 0);
    B.add(put(new THREE.CircleGeometry(0.42, 20)), on ? flat(PAL.win) : flat(DARK), 0);
    B.add(put(new THREE.TorusGeometry(0.46, 0.08, 6, 20)), trim, 0.02);
    if (on) lit.push([y, 0, xr]);
  }
  // door, porch roof on posts, steps; a ground-floor window beside it
  const dz = o.doorZ;
  const ds = new THREE.Shape(); ds.moveTo(-0.48, 0); ds.lineTo(0.48, 0); ds.lineTo(0.42, 1.95); ds.quadraticCurveTo(0, 2.6, -0.42, 1.95); ds.closePath();
  B.add(at(new THREE.ShapeGeometry(ds, 6), fx + 0.01, 0.7, dz, 0, Math.PI / 2), toon(o.door), 0.02);
  B.add(at(new THREE.SphereGeometry(0.06, 6, 5), fx + 0.06, 1.65, dz + 0.3), toon(0xc8a040), 0);
  if (!o.noPorch) for (let k = 0; k < 3; k++) B.add(at(new THREE.BoxGeometry(0.45, 0.24, 1.5 - k * 0.12), fx + 0.25 + (2 - k) * 0.4, 0.12 + k * 0.24, dz), toon(0x6a6278), 0.02);
  if (!o.noPorch) for (const sz of [-0.85, 0.85]) B.add(at(new THREE.CylinderGeometry(0.07, 0.08, 2.6, 6), fx + 1.25, 1.3, dz + sz), trim, 0.02);
  if (!o.noPorch) B.add(at(new THREE.ConeGeometry(1.35, 1.1, 4, 2), fx + 0.65, 3.05, dz, 0, Math.PI / 4, 0, 1, 1, 0.9), toon(o.roof, 0, shingles), 0.03);
  if (o.porchLamp) lit.push(['porch', dz]);
  {
    const z = dz > 0 ? dz - 1.9 : dz + 1.9;
    if (Math.abs(z) < o.w / 2 - 0.6 && windowParts(B, o, 'arch', 1.95, z, rnd() < 0.2)) lit.push([1.95, z]);
  }
  // a drainpipe down one front corner
  B.add(at(new THREE.CylinderGeometry(0.06, 0.06, o.h, 6, 16), fx + 0.12, o.h / 2, o.w / 2 - 0.12), toon(0x2a2a3a), 0.015);
  // bend it all, merge, ink
  for (const v of B.m.values()) for (const geo of v.geos) bend(geo, f);
  B.flush(g);
  scene.add(g); g.updateMatrixWorld(true);
  for (const L of lit) {
    if (L[0] === 'porch') { const p = V(...f(fx + 1.2, 2.25, L[1] + 0.85)).applyMatrix4(g.matrixWorld); glow(p, PAL.lamp, 1.2, 0.8); lightAt(p, PAL.lamp, 3, 6); continue; }
    const p = V(...f(L[2] ?? fx + 0.5, L[0], L[1])).applyMatrix4(g.matrixWorld);
    glow(p, PAL.win, 1.0, 0.3);
    if (lightsLeft.win-- > 0) lightAt(p, PAL.win, 2.5, 7);
  }
  o.group = g; o.f = f; o.fx = fx;
  return o;
}

// ---------------------------------------------------------------- yard things (straight, unwarped)
function yard(B, o) {
  const fx = o.d / 2, edge = fx + 2.7, dz = o.doorZ, kind = o.boundary;
  // the boundary along the pavement, a gate gap at the path
  if (kind === 'picket' || kind === 'iron') {
    const col = toon(kind === 'iron' ? 0x1a1622 : 0x9a92b8);
    for (let z = -o.w / 2 - 0.9; z < o.w / 2 + 0.9; z += kind === 'iron' ? 0.24 : 0.3) {
      if (Math.abs(z - dz) < 0.7) continue;
      const h = (kind === 'iron' ? 1.25 : 0.95) + rnd() * 0.25, tl = (rnd() - 0.5) * 0.3;
      B.add(at(new THREE.BoxGeometry(0.06, h, kind === 'iron' ? 0.04 : 0.13), edge, h / 2, z, tl, 0, tl * 0.5), col, 0.012);
      B.add(at(new THREE.ConeGeometry(kind === 'iron' ? 0.05 : 0.09, 0.2, 4), edge, h + 0.08, z, tl, 0, tl * 0.5), col, 0.012);
    }
    for (const y of [0.35, 0.75]) for (const [a, b] of [[-o.w / 2 - 0.9, dz - 0.7], [dz + 0.7, o.w / 2 + 0.9]]) if (b - a > 0.2) B.add(at(new THREE.BoxGeometry(0.05, 0.07, b - a), edge - 0.05, y, (a + b) / 2), col, 0.01);
  } else if (kind === 'hedge') {
    for (let z = -o.w / 2 - 0.8; z < o.w / 2 + 0.8; z += 0.55) { if (Math.abs(z - dz) < 0.8) continue; bushBall(B, edge - 0.2, z, 0.55 + rnd() * 0.2, 0.75); }
  }
  B.add(at(new THREE.BoxGeometry(2.7, 0.06, 1.0), fx + 1.35, 0.05, dz), toon(0x6a6278), 0.01); // the path
  // two or three things in the yard
  const spots = [[fx + 1.0, dz > 0 ? dz - 1.8 : dz + 1.8], [fx + 1.9, dz > 0 ? -o.w / 2 + 0.6 : o.w / 2 - 0.6], [fx + 0.8, dz > 0 ? dz - 3.0 : dz + 3.0]].filter(([, z]) => Math.abs(z) < o.w / 2 + 0.5);
  for (const [x, z] of spots) {
    const k = rnd();
    if (k < 0.18) gnome(B, x, z);
    else if (k < 0.34) bushBall(B, x, z, 0.5, 1);
    else if (k < 0.46) bin(B, x, z);
    else if (k < 0.56) swing(B, x - 0.2, z);
    else if (k < 0.66) washing(B, x, z);
    else if (k < 0.76) topiary(B, x, z);
    else if (k < 0.84) trike(B, x, z);
    else if (k < 0.92) mailbox(B, edge - 0.35, dz + 1.1);
  }
}
function bushBall(B, x, z, r, sq = 1) {
  for (let k = 0; k < 4; k++) B.add(at(new THREE.IcosahedronGeometry(r * (0.7 + rnd() * 0.4), 1), x + (rnd() - 0.5) * r, r * 0.8 * sq + (rnd() - 0.5) * r * 0.4, z + (rnd() - 0.5) * r * 1.2), toon(PAL.green), 0.02);
}
function gnome(B, x, z) {
  B.add(at(new THREE.CylinderGeometry(0.13, 0.17, 0.3, 10), x, 0.15, z), toon(0x3a5a9a), 0.012);
  B.add(at(new THREE.SphereGeometry(0.11, 10, 8), x, 0.38, z), toon(0xe8c0a0), 0.012);
  B.add(at(new THREE.ConeGeometry(0.1, 0.22, 10), x + 0.05, 0.28, z, 0, 0, Math.PI), toon(0xeeeeee), 0.01);
  B.add(at(new THREE.ConeGeometry(0.12, 0.34, 10), x, 0.6, z, 0, 0, 0.25), toon(0xc0302a), 0.012);
  for (const s of [-1, 1]) B.add(at(new THREE.SphereGeometry(0.022, 6, 4), x + 0.1, 0.41, z + s * 0.04), flat(0x000000), 0);
}
function bin(B, x, z) { B.add(at(new THREE.BoxGeometry(0.6, 0.95, 0.7), x, 0.5, z, 0, 0.2), toon(pick([0x2c4a3a, 0x3a3a4a, 0x5a2a2a])), 0.02); B.add(at(new THREE.BoxGeometry(0.66, 0.08, 0.78), x - 0.03, 1.0, z, 0, 0.2, 0.25), toon(0x2a2a30), 0.015); }
function swing(B, x, z) {
  for (const sz of [-0.9, 0.9]) for (const sx of [-0.45, 0.45]) B.add(limb(V(x + sx, 0, z + sz), V(x, 2.0, z + sz * 0.95), 0.05), toon(0x6a4a3a), 0.012);
  B.add(limb(V(x, 2.0, z - 0.95), V(x, 2.0, z + 0.95), 0.05), toon(0x6a4a3a), 0.012);
  const a = 0.35; // the swing is still moving
  for (const sz of [-0.25, 0.25]) B.add(limb(V(x, 2.0, z + sz), V(x + Math.sin(a) * 1.5, 2.0 - Math.cos(a) * 1.5, z + sz), 0.012), toon(0x2a2a2a), 0);
  B.add(at(new THREE.BoxGeometry(0.25, 0.04, 0.6), x + Math.sin(a) * 1.5, 2.0 - Math.cos(a) * 1.5, z, 0, 0, a), toon(0x8a3a3a), 0.01);
}
const sheetMat = new THREE.MeshToonMaterial({ color: 0xd8d0e8, gradientMap: ramp, side: THREE.DoubleSide });
function washing(B, x, z) {
  const z0 = z - 1.4, z1 = z + 1.4;
  for (const zz of [z0, z1]) B.add(at(new THREE.CylinderGeometry(0.04, 0.04, 1.9, 6), x, 0.95, zz), toon(0x5a5a6a), 0.01);
  const curve = new THREE.CatmullRomCurve3([V(x, 1.85, z0), V(x, 1.7, z), V(x, 1.85, z1)]);
  B.add(new THREE.TubeGeometry(curve, 10, 0.01, 4), toon(0x2a2a2a), 0);
  for (const [t, w, h] of [[0.28, 0.8, 1.0], [0.62, 0.6, 0.7]]) {
    const p = curve.getPoint(t), g = new THREE.PlaneGeometry(w, h, 4, 4), pa = g.attributes.position;
    for (let i = 0; i < pa.count; i++) pa.setZ(i, Math.sin(pa.getY(i) * 3 + pa.getX(i) * 2) * 0.06);
    g.computeVertexNormals();
    B.add(at(g, p.x, p.y - h / 2, p.z, 0, Math.PI / 2, 0.08), sheetMat, 0);
  }
}
function topiary(B, x, z) {
  B.add(at(new THREE.CylinderGeometry(0.22, 0.17, 0.3, 10), x, 0.15, z), toon(0x8a4a3a), 0.012);
  B.add(at(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 5), x, 0.6, z), toon(0x3a2a20), 0);
  B.add(at(new THREE.SphereGeometry(0.32, 12, 10), x, 1.05, z), toon(PAL.green), 0.015);
  B.add(at(new THREE.SphereGeometry(0.2, 10, 8), x, 1.5, z), toon(PAL.green), 0.015);
}
function trike(B, x, z) {
  for (const [dx, r] of [[0, 0.22], [0.5, 0.14]]) for (const dz of dx ? [-0.22, 0.22] : [0]) B.add(at(new THREE.TorusGeometry(r, 0.03, 6, 14), x + dx, r, z + dz), toon(0x2a2a2a), 0.008);
  B.add(limb(V(x, 0.22, z), V(x + 0.5, 0.25, z), 0.03), toon(0xc03030), 0.008);
  B.add(limb(V(x, 0.22, z), V(x - 0.05, 0.6, z), 0.025), toon(0xc03030), 0.008);
  B.add(at(new THREE.BoxGeometry(0.2, 0.05, 0.14), x + 0.4, 0.42, z), toon(0x2a2a2a), 0.008);
}
function mailbox(B, x, z) {
  B.add(at(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 6), x, 0.5, z), toon(0x4a3a2a), 0.01);
  B.add(at(new THREE.BoxGeometry(0.45, 0.25, 0.25), x, 1.1, z), toon(0x3a4a6a), 0.012);
  B.add(at(new THREE.CylinderGeometry(0.125, 0.125, 0.45, 10, 1, false, 0, Math.PI), x, 1.22, z, 0, 0, Math.PI / 2), toon(0x3a4a6a), 0.012);
  B.add(at(new THREE.BoxGeometry(0.03, 0.2, 0.08), x - 0.05, 1.35, z + 0.14, 0, 0, 0.6), toon(0xc0302a), 0);
}

// ---------------------------------------------------------------- build the street
const houses = [];
for (const side of [-1, 1]) {
  for (let s = side < 0 ? 1 : 4.5; s < 104;) {
    const w = 4.4 + rnd() * 2.2;
    s += w / 2;
    const o = {
      w, d: 5, h: 6.5 + rnd() * 5, rh: 4.5 + rnd() * 4.5, lean: 0.5 + rnd() * 0.4, twist: (rnd() - 0.5) * 0.3, taper: 0.12 + rnd() * 0.12,
      wall: pick(PAL.walls), roof: pick(PAL.roofs), trim: PAL.trim, shutter: pick([0x2a3a4a, 0x4a2a2a, 0x2a3a2a, 0x3a2a4a]), door: pick([0x5a2a2a, 0x2a3a5a, 0x2a4a3a, 0x1a1420]),
      turret: rnd() < 0.25, porchLamp: rnd() < 0.2, boundary: pick(['picket', 'picket', 'iron', 'hedge', 'none']),
    };
    o.doorZ = (rnd() < 0.5 ? -1 : 1) * (o.w / 2 - 1.3);
    if (SHOT === 'hide' && side > 0 && Math.abs(s - 12.5) < w / 2 + 1) { o.boundary = 'none'; o.noPorch = true; }
    house(s, side, o);
    const B = new Batch(); yard(B, o); B.flush(o.group);
    houses.push({ s, side, ...o });
    s += w / 2 + 1.3 + rnd() * 2.6;
  }
}

// ---------------------------------------------------------------- street things
// the bent lamps, bowing over the road, with beams; some dead
const LAMPS = [[7, 1, 1], [17, -1, 1], [28, 1, 0], [36, -1, 1], [49, 1, 1], [62, -1, 0], [76, 1, 1], [92, -1, 1]];
let shadowLamps = 0;
for (const [s, side, on] of LAMPS) {
  const N = Nrm(s).multiplyScalar(side), B0 = onRoad(s, 0).addScaledVector(N, 3.9), up = V(0, 1, 0);
  const P = (u, l) => B0.clone().addScaledVector(up, u).addScaledVector(N, -l);
  const curve = new THREE.CatmullRomCurve3([P(0, 0), P(3.5, 0.1), P(6.2, 0.7), P(7.6, 2.0), P(7.3, 3.4), P(6.4, 4.0)]);
  inked(new THREE.TubeGeometry(curve, 50, 0.12, 8), toon(0x1e1a2a), 0.035);
  inked(at(new THREE.CylinderGeometry(0.28, 0.4, 0.55, 10), B0.x, B0.y + 0.27, B0.z), toon(0x1e1a2a), 0.03);
  const end = curve.getPoint(1), hood = new THREE.SphereGeometry(0.62, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const hm = inked(hood, toon(0x1e1a2a), 0.04); hm.position.copy(end); hm.scale.set(1, 0.8, 1.2); hm.rotation.set(-0.3, Math.atan2(-N.z, N.x), 0.2);
  const bulb = end.clone().add(V(0, -0.1, 0));
  const bm = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), flat(on ? 0xfff0b0 : 0x2a2630)); bm.position.copy(bulb); scene.add(bm);
  if (!on) continue;
  glow(bulb, PAL.lamp, 3.2, 0.85);
  const ground = C(s).y + 0.1, h = bulb.y - ground;
  beam(bulb, h, h * 0.55, PAL.lamp);
  const sp = new THREE.SpotLight(PAL.lamp, 120, 20, 0.62, 0.5, 2); sp.position.copy(bulb); sp.target.position.copy(bulb).setY(ground); scene.add(sp, sp.target);
  if (shadowLamps++ < 3) { sp.castShadow = true; sp.shadow.mapSize.set(1024, 1024); sp.shadow.bias = -0.0005; }
}
// telegraph poles down the right, sagging wires, crows
{
  const B = new Batch(), poles = [];
  for (let s = -6; s < 100; s += 21) {
    const p = onRoad(s, 4.35); poles.push(p);
    B.add(limb(p, p.clone().add(V(0.15, 8.5, 0)), 0.14, 0.11), toon(0x3a2e28), 0.03);
    B.add(at(new THREE.BoxGeometry(0.12, 0.12, 1.8), p.x + 0.14, p.y + 8.0, p.z, 0, 0, 0.08), toon(0x3a2e28), 0.02);
  }
  for (let k = 0; k + 1 < poles.length; k++) for (const dz of [-0.75, 0, 0.75]) {
    const a = poles[k].clone().add(V(0.14, 8.05, dz)), b = poles[k + 1].clone().add(V(0.14, 8.05, dz)), m = a.clone().lerp(b, 0.5).add(V(0, -1.1, 0));
    const curve = new THREE.QuadraticBezierCurve3(a, m, b);
    B.add(new THREE.TubeGeometry(curve, 24, 0.025, 4), toon(0x14101c), 0);
    if (dz === 0 && k < 3) for (let c = 0; c < 3 + k; c++) {
      const p = curve.getPoint(0.25 + c * 0.12 + rnd() * 0.05);
      B.add(at(new THREE.SphereGeometry(0.16, 8, 6), p.x, p.y + 0.17, p.z, 0, 0, 0, 0.9, 1, 1.3), toon(0x0e0c14), 0.012);
      B.add(at(new THREE.SphereGeometry(0.1, 8, 6), p.x, p.y + 0.36, p.z - 0.12), toon(0x0e0c14), 0.012);
      B.add(at(new THREE.ConeGeometry(0.035, 0.14, 5), p.x, p.y + 0.35, p.z - 0.25, -Math.PI / 2), toon(0x6a6050), 0);
      B.add(at(new THREE.ConeGeometry(0.08, 0.3, 4), p.x, p.y + 0.12, p.z + 0.25, Math.PI / 2 + 0.4), toon(0x0e0c14), 0.01);
    }
  }
  B.flush();
}
// a bulbous parked car, a post box, a crooked signpost, a lost-dog poster
function car(s, l, color) {
  const g = new THREE.Group(); g.position.copy(onRoad(s, l)); g.rotation.y = Math.atan2(Nrm(s).x, Nrm(s).z) + Math.PI / 2 + 0.06; scene.add(g);
  const B = new Batch();
  B.add(at(new THREE.SphereGeometry(1, 20, 12), 0, 0.72, 0, 0, 0, 0, 0.95, 0.5, 2.1), toon(color), 0.03);
  B.add(at(new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0.95, 0.15, 0, 0, 0, 0.8, 0.62, 1.1), toon(color), 0.03);
  B.add(at(new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0.98, 0.15, 0, 0, 0, 0.82, 0.52, 1.0), flat(0x0e0c18), 0);
  for (const sx of [-0.82, 0.82]) for (const sz of [-1.25, 1.25]) { B.add(at(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 14), sx, 0.34, sz, 0, 0, Math.PI / 2), toon(0x141218), 0.015); B.add(at(new THREE.CylinderGeometry(0.15, 0.15, 0.26, 10), sx, 0.34, sz, 0, 0, Math.PI / 2), toon(0xa8a0b8), 0); }
  for (const sx of [-0.55, 0.55]) B.add(at(new THREE.SphereGeometry(0.13, 10, 8), sx, 0.75, -2.0), toon(0xc8c0a0), 0.01);
  B.flush(g);
}
car(21, -2.1, 0x7a3a3a); car(44, 2.1, 0x3a6a6a); car(70, -2.1, 0x6a6a3a);
{
  const p = onRoad(5.5, -4.1, 0.1), B = new Batch();
  B.add(at(new THREE.CylinderGeometry(0.3, 0.33, 1.25, 16), p.x, p.y + 0.62, p.z), toon(0xb02a24), 0.025);
  B.add(at(new THREE.SphereGeometry(0.33, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), p.x, p.y + 1.25, p.z), toon(0xb02a24), 0.025);
  B.add(at(new THREE.BoxGeometry(0.06, 0.06, 0.32), p.x + 0.3, p.y + 1.0, p.z), flat(0x0a0a0a), 0);
  B.flush();
}
function textTex(lines, w, h, bg, fg, font) {
  return canvasTex(w, h, (g) => { g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = font; lines.forEach((t, i) => g.fillText(t, w / 2, h / (lines.length + 1) * (i + 1))); });
}
{
  // a signpost by the kerb: every arm says HOME, and they don't agree
  const p = onRoad(4.0, 3.6, 0.1), B = new Batch();
  B.add(limb(p, p.clone().add(V(0.12, 3.0, 0)), 0.07, 0.06), toon(0x3a2e28), 0.02); B.flush();
  for (const [y, ry, rz, txt] of [[2.75, 0.4, 0.1, 'HOME'], [2.35, -2.6, -0.12, 'HOME'], [1.95, 1.4, 0.2, 'HOME?']]) {
    const sh = new THREE.Shape(); sh.moveTo(0, -0.17); sh.lineTo(1.0, -0.17); sh.lineTo(1.22, 0); sh.lineTo(1.0, 0.17); sh.lineTo(0, 0.17); sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: false });
    const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 1.22, (uv.getY(i) + 0.17) / 0.34);
    const m = inked(geo, toon(0xffffff, 0, textTex([txt], 256, 72, '#d8ccb0', '#2a1a1a', 'bold 46px Georgia')), 0.012);
    m.position.copy(p).add(V(0.1, y, 0)); m.rotation.set(0, ry, rz);
  }
}
{
  // LOST: a poster on the first lamp post with a drawing of a puppy. It looks like yours.
  const s = 7, N = Nrm(s), p = onRoad(s, 3.9 - 0.16, 1.45);
  const tex = canvasTex(256, 340, (g) => {
    g.fillStyle = '#e8e0cc'; g.fillRect(0, 0, 256, 340); g.fillStyle = '#2a1a1a'; g.font = 'bold 64px Georgia'; g.textAlign = 'center'; g.fillText('LOST', 128, 70);
    g.strokeStyle = '#2a1a1a'; g.lineWidth = 4; g.fillStyle = '#f4e0b8';
    g.beginPath(); g.ellipse(128, 200, 70, 46, 0, 0, 7); g.fill(); g.stroke(); g.beginPath(); g.arc(128, 150, 44, 0, 7); g.fill(); g.stroke();
    g.fillStyle = '#b07a40'; for (const s2 of [-1, 1]) { g.beginPath(); g.ellipse(128 + s2 * 44, 160, 12, 28, s2 * 0.4, 0, 7); g.fill(); g.stroke(); }
    g.fillStyle = '#1a1010'; for (const s2 of [-1, 1]) { g.beginPath(); g.arc(128 + s2 * 15, 145, 6, 0, 7); g.fill(); }
    g.beginPath(); g.arc(128, 162, 6, 0, 7); g.fill();
    g.fillStyle = '#c0302a'; g.fillRect(96, 186, 64, 9);
    g.fillStyle = '#2a1a1a'; g.font = '22px Georgia'; g.fillText('answers to Biscuit', 128, 280); g.fillText('please call', 128, 310);
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.56), new THREE.MeshToonMaterial({ map: tex, gradientMap: ramp }));
  m.position.copy(p); m.lookAt(p.clone().addScaledVector(N, -1)); m.rotateZ(0.06); scene.add(m);
}
// leaves along the gutters and pavements; puddles holding the sky; manholes
{
  const n = 2400, geo = new THREE.CircleGeometry(0.09, 5); geo.rotateX(-Math.PI / 2); geo.scale(1, 1, 1.6);
  const im = new THREE.InstancedMesh(geo, new THREE.MeshToonMaterial({ gradientMap: ramp }), n), m4 = new THREE.Matrix4(), col = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const s = -6 + rnd() * 70, band = rnd(), l = (rnd() < 0.5 ? -1 : 1) * (band < 0.5 ? 2.4 + rnd() * 0.4 : band < 0.85 ? 3.1 + rnd() * 1.5 : rnd() * 2.4);
    const p = onRoad(s, l, Math.abs(l) > 3 ? 0.115 : 0.012);
    m4.compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler((rnd() - 0.5) * 0.3, rnd() * 6.3, 0)), V(1, 1, 1).multiplyScalar(0.7 + rnd() * 0.6));
    im.setMatrixAt(i, m4); im.setColorAt(i, col.setHex(pick(PAL.leaf)));
  }
  im.receiveShadow = true; scene.add(im);
  for (const [s, l, r] of [[3.2, -1.2, 0.9], [11, 0.8, 1.3], [24, -0.5, 1.1], [33, 1.4, 0.8]]) {
    const pd = new THREE.Mesh(new THREE.CircleGeometry(r, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(PAL.sky[1]), transparent: true, opacity: 0.6 }));
    pd.rotation.x = -Math.PI / 2; pd.scale.set(1.4, 0.8, 1); pd.position.copy(onRoad(s, l, 0.02)); scene.add(pd);
  }
  for (const s of [9, 30, 52]) inked(at(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 18), ...onRoad(s, 0.3, 0.01).toArray()), toon(0x2a2438), 0.01);
}
// curly trees in the gaps and yards
function curlyTree(p, h) {
  const g = new THREE.Group(); g.position.copy(p); scene.add(g); const B = new Batch();
  const trunk = new THREE.CatmullRomCurve3([V(0, 0, 0), V(0.3, h * 0.4, 0), V(-0.3, h * 0.75, 0.2), V(0.1, h, 0)]);
  B.add(new THREE.TubeGeometry(trunk, 20, 0.24, 7), toon(0x2a2030), 0.03);
  for (let k = 0; k < 6; k++) {
    const a = k * 1.1 + rnd(), base = trunk.getPoint(0.5 + k * 0.08), pts = [base]; let r = 1.5 + rnd() * 0.8;
    for (let i = 1; i <= 26; i++) { const t = i / 26, ang = a + t * 5.5; r *= 0.93; pts.push(base.clone().add(V(Math.cos(a) * (1 - t) * 2.2 + Math.cos(ang) * r * t, t * 1.6 + Math.sin(ang) * r * t * 0.8, Math.sin(a) * (1 - t) * 2.2))); }
    B.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.08, 5), toon(0x2a2030), 0.02);
  }
  B.flush(g);
}
for (const [s, l] of [[2.5, -12], [15, 12.5], [26, -12.5], [41, 12], [58, -12.2], [73, 12.5]]) curlyTree(onRoad(s, l), 7 + rnd() * 3);

// ---------------------------------------------------------------- far away: hills in layers, a church, home
for (const [k, color] of PAL.hills.entries()) {
  const z = -150 - k * 40, sh = new THREE.Shape(); sh.moveTo(-260, -40);
  for (let x = -260; x <= 260; x += 8) sh.lineTo(x, 6 + k * 9 + Math.sin(x * 0.02 + k * 2) * 6 + Math.sin(x * 0.07 + k) * 2.5);
  sh.lineTo(260, -40); sh.closePath();
  const m = new THREE.Mesh(new THREE.ShapeGeometry(sh, 2), new THREE.MeshBasicMaterial({ color, fog: false })); m.position.z = z; m.renderOrder = -2 + k; scene.add(m);
}
{
  const B = new Batch(), x = -55, y = 18, z = -170;
  B.add(at(new THREE.BoxGeometry(6, 7, 10), x, y + 3.5, z), toon(0x2a2248), 0.08);
  B.add(at(new THREE.BoxGeometry(3, 12, 3), x, y + 6, z + 5), toon(0x2a2248), 0.08);
  B.add(at(new THREE.ConeGeometry(2.4, 12, 4), x, y + 18, z + 5, 0, Math.PI / 4), toon(0x1e1838), 0.08);
  B.flush();
}
{
  const g = new THREE.Group(); g.position.copy(C(112)); g.position.z -= 6; scene.add(g);
  const B = new Batch();
  B.add(at(new THREE.BoxGeometry(5, 3.4, 4), 0, 1.7, 0), toon(0x6a5a7a), 0.05);
  B.add(at(new THREE.ConeGeometry(4, 2.6, 4), 0, 4.7, 0, 0, Math.PI / 4), toon(0x3a2a3a), 0.05);
  for (const x of [-1.3, 1.3]) B.add(at(new THREE.PlaneGeometry(0.8, 0.8), x, 2.0, 2.02), flat(PAL.win), 0);
  B.flush(g); g.updateMatrixWorld(true);
  glow(V(0, 2.0, 2.4).applyMatrix4(g.matrixWorld), PAL.win, 12, 1, false);
}
// cut-out clouds hanging in the sky at different depths
for (const [x, y, z, sc] of [[-40, 48, -120, 1.4], [30, 56, -150, 1.8], [8, 40, -95, 1.0], [-70, 60, -160, 2.0], [60, 44, -110, 1.2]]) {
  const sh = new THREE.Shape(); sh.moveTo(-6, -1);
  for (let k = 0; k <= 5; k++) sh.absarc(-6 + k * 2.4, 0.5 + Math.sin(k * 1.7) * 0.8, 1.6 + (k % 2) * 0.9, Math.PI, 0, true);
  sh.lineTo(6.5, -1); sh.closePath();
  const m = inked(new THREE.ShapeGeometry(sh, 8), new THREE.MeshBasicMaterial({ color: PAL.cloud, fog: false }), 0, scene, false);
  m.position.set(x, y, z); m.scale.setScalar(sc * 1.6); m.renderOrder = -3;
}

// ---------------------------------------------------------------- the tall man
function tallMan(p, yaw, look = 0) {
  const g = new THREE.Group(); g.position.copy(p); g.rotation.y = yaw; scene.add(g); const B = new Batch();
  const coat = toon(0x16121e);
  B.add(at(new THREE.ConeGeometry(0.55, 2.3, 12, 4), 0, 1.15, 0), coat, 0.03);
  B.add(at(new THREE.SphereGeometry(0.3, 12, 8), 0, 2.3, 0, 0, 0, 0, 1.3, 0.55, 0.9), coat, 0.03);
  B.add(limb(V(0, 2.4, 0), V(0, 2.75, -0.05), 0.05), coat, 0.015);
  for (const s of [-1, 1]) {
    const sh = V(s * 0.36, 2.32, 0), el = V(s * 0.46, 1.5, -0.1), wr = V(s * 0.42, 0.75, -0.18);
    B.add(limb(sh, el, 0.06, 0.05), coat, 0.02); B.add(limb(el, wr, 0.05, 0.035), coat, 0.02);
    for (let f = 0; f < 4; f++) B.add(limb(wr, wr.clone().add(V(s * (0.02 + f * 0.02), -0.42 - (f % 2) * 0.08, -0.06 + f * 0.04)), 0.014, 0.006, 4), coat, 0.006);
  }
  B.flush(g);
  const head = new THREE.Group(); head.position.set(0, 2.95, -0.05); head.rotation.set(0.1, look, -0.25); g.add(head);
  const HB = new Batch();
  HB.add(at(new THREE.SphereGeometry(0.24, 16, 12), 0, 0, 0, 0, 0, 0, 0.9, 1.15, 0.9), toon(0xe8e0d0), 0.02);
  for (const s of [-1, 1]) HB.add(at(new THREE.SphereGeometry(0.055, 10, 8), s * 0.08, 0.05, -0.2, 0, 0, 0, 1, 1.4, 0.5), flat(0x050308), 0);
  HB.add(at(new THREE.TorusGeometry(0.09, 0.012, 4, 16, Math.PI), 0, -0.1, -0.2, 0, 0, Math.PI), flat(0x050308), 0);
  HB.add(at(new THREE.CylinderGeometry(0.34, 0.34, 0.03, 16), 0, 0.24, 0), coat, 0.012);
  HB.add(at(new THREE.CylinderGeometry(0.2, 0.22, 0.6, 14), 0, 0.54, 0), coat, 0.015);
  HB.flush(head);
  return g;
}

// ---------------------------------------------------------------- the puppy (fluffy), the boy's arms
function puppy(pose) {
  const g = new THREE.Group(), B = new Batch(), cream = toon(0xf4e0b8, 0x5a4428), toffee = toon(0xc08850, 0x3a2010);
  for (const [x, y, z, r] of [[0, 0.26, 0, 0.17], [0, 0.27, 0.12, 0.15], [0, 0.28, -0.12, 0.15], [0.07, 0.3, 0.02, 0.12], [-0.07, 0.3, 0.02, 0.12], [0, 0.22, -0.2, 0.12]]) B.add(at(new THREE.IcosahedronGeometry(r, 2), x, y, z), cream, 0.012);
  for (const [x, z] of [[-0.08, -0.15], [0.08, -0.15], [-0.08, 0.15], [0.08, 0.15]]) { B.add(at(new THREE.CylinderGeometry(0.045, 0.05, 0.16, 8), x, 0.08, z), cream, 0.008); B.add(at(new THREE.SphereGeometry(0.055, 8, 6), x, 0.03, z - 0.02, 0, 0, 0, 1, 0.7, 1.2), cream, 0.008); }
  for (let k = 0; k < 4; k++) B.add(at(new THREE.IcosahedronGeometry(0.055 - k * 0.008, 1), 0, 0.36 + k * 0.045, 0.25 + k * 0.045 - k * k * 0.012), cream, 0.008); // a little curl of a tail
  B.add(at(new THREE.TorusGeometry(0.12, 0.025, 6, 16), 0, 0.38, -0.2, Math.PI / 2 - 0.5), toon(0xd23a2e), 0.006);
  B.add(at(new THREE.CylinderGeometry(0.035, 0.035, 0.01, 10), 0, 0.27, -0.31, Math.PI / 2), toon(0xe8c040, 0x302008), 0.004);
  B.flush(g);
  const head = new THREE.Group(); head.position.set(0, 0.5, -0.25); g.add(head);
  const HB = new Batch();
  HB.add(at(new THREE.IcosahedronGeometry(0.19, 3), 0, 0, 0), cream, 0.012);
  for (const s of [-1, 1]) HB.add(at(new THREE.SphereGeometry(0.09, 10, 8), s * 0.09, -0.06, -0.08), cream, 0.008); // cheeks
  HB.add(at(new THREE.SphereGeometry(0.08, 12, 10), 0, -0.05, -0.16, 0, 0, 0, 1, 0.8, 1), cream, 0.008);
  HB.add(at(new THREE.SphereGeometry(0.035, 8, 6), 0, -0.02, -0.24), flat(0x140e10), 0);
  HB.add(at(new THREE.TorusGeometry(0.025, 0.006, 4, 10, Math.PI), 0, -0.085, -0.225, 0, 0, Math.PI), flat(0x140e10), 0);
  for (const s of [-1, 1]) {
    HB.add(at(new THREE.SphereGeometry(0.042, 12, 10), s * 0.075, 0.04, -0.15), flat(0x0e0a0c), 0);
    HB.add(at(new THREE.SphereGeometry(0.014, 6, 4), s * 0.075 + 0.014, 0.06, -0.188), flat(0xffffff), 0);
    HB.add(at(new THREE.SphereGeometry(0.07, 10, 8), s * 0.17, 0.0, 0.0, pose === 'held' ? 0.6 : 0, 0, s * (pose === 'look' ? 0.5 : 1.2), 0.5, 1.5, 0.9), toffee, 0.008);
  }
  HB.flush(head);
  return { g, head };
}
const camera = new THREE.PerspectiveCamera(66, W / H, 0.03, 500); scene.add(camera);
function arm(from, to, parent) {
  // a coat sleeve with a knitted cuff and a red mitten, in camera space
  const B = new Batch();
  B.add(limb(from, to, 0.075, 0.06, 10), toon(0x2b3a6a), 0.008);
  const dir = to.clone().sub(from).normalize(), m = to.clone().addScaledVector(dir, 0.07);
  B.add(new THREE.TorusGeometry(0.058, 0.022, 6, 12).applyMatrix4(new THREE.Matrix4().compose(to, new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), dir), V(1, 1, 1))), toon(0xd8d0c0), 0.004);
  B.add(at(new THREE.SphereGeometry(0.065, 12, 10), m.x, m.y, m.z, 0, 0, 0, 1, 0.85, 1.25), toon(0xc8302a), 0.006);
  B.add(at(new THREE.SphereGeometry(0.03, 8, 6), m.x - 0.05, m.y + 0.02, m.z - 0.02), toon(0xc8302a), 0.004);
  B.flush(parent);
  return m;
}

// ---------------------------------------------------------------- the shot
if (SHOT === 'walk') {
  // on the pavement at a child's eye height; the puppy trotting ahead has stopped to look back at you.
  // Far up the road, under a lamp, someone is standing in the middle of the road.
  camera.position.copy(onRoad(0, 2.2, 1.05)); camera.lookAt(onRoad(26, 0.3, 4.6)); camera.rotateZ(-0.02);
  camera.updateMatrixWorld(true);
  const mitten = arm(V(0.36, -0.62, -0.25), V(0.2, -0.42, -0.62), camera);
  // side-on, trotting left across in front of you, head turned all the way round to check you're there
  const P = puppy('look'); P.g.position.copy(onRoad(3.0, 1.35, 0.0)); P.g.rotation.y = 1.85; P.head.rotation.set(0.2, 1.45, 0.3); P.g.scale.setScalar(1.15); scene.add(P.g);
  lightAt(onRoad(2.2, 2.0, 1.4), 0xffd8a0, 1.6, 4);
  scene.updateMatrixWorld(true);
  const a = mitten.clone().applyMatrix4(camera.matrixWorld), b = V(0, 0.4, -0.27).applyMatrix4(P.g.matrixWorld);
  const mid = a.clone().lerp(b, 0.5); mid.y -= 0.25;
  inked(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a, a.clone().lerp(mid, 0.6).setY(mid.y + 0.05), mid, b]), 30, 0.011, 5), toon(0xd23a2e), 0.004);
  const tp = onRoad(36, -0.9, 0); tallMan(tp, Math.atan2(camera.position.x - tp.x, camera.position.z - tp.z) + Math.PI, 0);
} else {
  // crouched in a front yard behind a hedge, the puppy held tight; through the gap, under the lamp,
  // the tall man has stopped on the road and turned his head toward the hedge
  const s = 12.5;
  camera.position.copy(onRoad(s, 7.0, 0.78)); camera.lookAt(onRoad(s + 3.6, -0.5, 1.7));
  camera.updateMatrixWorld(true);
  const B = new Batch();
  for (let k = 0; k < 26; k++) {
    const ds = -3.4 + k * 0.28; if (Math.abs(ds - 1.25) < 0.62) continue;
    const p = onRoad(s + ds, 5.0 + (rnd() - 0.5) * 0.3, 0);
    for (let j = 0; j < 3; j++) B.add(at(new THREE.IcosahedronGeometry(0.34 + rnd() * 0.15, 1), p.x + (rnd() - 0.5) * 0.3, 0.35 + j * 0.32 + rnd() * 0.1, p.z + (rnd() - 0.5) * 0.2), toon(PAL.green), 0.02);
  }
  B.flush();
  // hedge leaves right in front of your face
  for (const [x, y, z, r] of [[-0.62, 0.02, -0.75, 0.2], [0.66, -0.2, -0.8, 0.18]]) {
    const m = inked(new THREE.IcosahedronGeometry(r, 1), toon(0x16241e), 0.008, camera, false); m.position.set(x, y, z);
  }
  arm(V(-0.36, -0.55, -0.2), V(-0.12, -0.4, -0.5), camera);
  arm(V(0.38, -0.55, -0.2), V(0.14, -0.42, -0.48), camera);
  // held against your chest, peeking with you, then turning to look up at you
  const P = puppy('held'); camera.add(P.g); P.g.position.set(0.0, -0.66, -0.56); P.g.rotation.set(0.2, 0.25, 0); P.g.scale.setScalar(0.62);
  P.head.rotation.set(-0.75, Math.PI - 0.2, 0.15);
  const tp = onRoad(s + 4.4, -0.6, 0); tallMan(tp, Math.atan2(camera.position.x - tp.x, camera.position.z - tp.z) + Math.PI + 0.9, -0.6);
}

// ---------------------------------------------------------------- sky, moon, light, fog
scene.background = canvasTex(1024, 512, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, PAL.sky[0]); gr.addColorStop(0.6, PAL.sky[1]); gr.addColorStop(1, PAL.sky[2]);
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 200; i++) { g.fillStyle = `rgba(255,245,210,${0.3 + rnd() * 0.6})`; const r = rnd() < 0.1 ? 1.8 : 0.9; g.beginPath(); g.arc(rnd() * w, rnd() * h * 0.6, r, 0, 7); g.fill(); }
  g.lineCap = 'round';
  for (let k = 0; k < 9; k++) {
    const cx = rnd() * w, cy = 30 + rnd() * h * 0.4; g.strokeStyle = `rgba(150,130,200,${0.08 + rnd() * 0.1})`; g.lineWidth = 5 + rnd() * 8;
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
  const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: moon, fog: false, depthWrite: false })); m.position.set(-34, 92, -170); m.scale.set(50, 50, 1); m.renderOrder = -4; scene.add(m);
}
scene.fog = new THREE.FogExp2(PAL.fog, 0.016);
scene.add(new THREE.HemisphereLight(PAL.hemi[0], PAL.hemi[1], PAL.hemi[2]));
const moonLight = new THREE.DirectionalLight(PAL.moon, 1.7);
moonLight.position.copy(C(20)).add(V(-25, 45, -40)); moonLight.target.position.copy(C(20)); scene.add(moonLight, moonLight.target);
moonLight.castShadow = true; moonLight.shadow.mapSize.set(4096, 4096); moonLight.shadow.bias = -0.0006; moonLight.shadow.normalBias = 0.03;
Object.assign(moonLight.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 160 });
const fill = new THREE.DirectionalLight(PAL.fill, 0.4); fill.position.set(14, 10, 30); scene.add(fill);
camera.updateProjectionMatrix();

// ---------------------------------------------------------------- render + picture-book pass
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H); document.body.appendChild(renderer.domElement);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  uniforms: { tScene: { value: rt.texture }, uRes: { value: new THREE.Vector2(W, H) }, uPaint: { value: INK ? 0 : 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
  fragmentShader: /* glsl */`
    uniform sampler2D tScene; uniform vec2 uRes; uniform int uPaint; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
    vec3 tone(vec3 c){ return pow(clamp(c, 0., 1.), vec3(1. / 2.2)); }
    // Kuwahara: each pixel takes the calmest of four neighbourhoods; flat strokes, kept edges, like paint
    vec3 kuwahara(vec2 uv){
      vec2 px = 1. / uRes; vec3 best = vec3(0.); float bestV = 1e9;
      for (int q = 0; q < 4; q++) {
        vec2 o = vec2(q == 0 || q == 2 ? -1. : 1., q < 2 ? -1. : 1.); vec3 m = vec3(0.), m2 = vec3(0.);
        for (int i = 0; i <= 4; i++) for (int j = 0; j <= 4; j++) { vec3 c = tone(texture2D(tScene, uv + vec2(float(i), float(j)) * o * px).rgb); m += c; m2 += c * c; }
        m /= 25.; vec3 v = m2 / 25. - m * m; float vs = v.r + v.g + v.b;
        if (vs < bestV) { bestV = vs; best = m; }
      }
      return best;
    }
    void main(){
      vec2 uv = vUv;
      uv += (vec2(vnoise(uv * vec2(9., 14.)), vnoise(uv * vec2(14., 9.) + 7.)) - 0.5) * (uPaint == 1 ? 0.002 : 0.0035);
      vec3 c = uPaint == 1 ? kuwahara(uv) : tone(texture2D(tScene, uv).rgb);
      float paper = 0.9 + 0.1 * vnoise(vUv * uRes / 3.) * vnoise(vUv * 6.);
      if (uPaint == 1) paper *= 0.94 + 0.06 * (sin(vUv.x * uRes.x * 1.6) * sin(vUv.y * uRes.y * 1.6) * 0.5 + 0.5);
      c *= paper;
      c += (hash(floor(vUv * uRes)) - 0.5) * 0.035;
      vec2 q = vUv - 0.5; c *= clamp(1. - dot(q * vec2(0.9, 1.1), q * vec2(0.9, 1.1)) * 1.5, 0., 1.);
      gl_FragColor = vec4(c, 1.);
    }`,
}));
const postScene = new THREE.Scene(); postScene.add(quad);
const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
function frame() { renderer.setRenderTarget(rt); renderer.render(scene, camera); renderer.setRenderTarget(null); renderer.render(postScene, ortho); }
frame();
requestAnimationFrame(() => { frame(); requestAnimationFrame(() => { frame(); document.body.dataset.ready = '1'; }); });
window.__shot = () => renderer.domElement.toDataURL('image/png');
window.__stats = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles });
