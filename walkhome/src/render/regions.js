// THE PLACES ALONG THE WAY, each built for real, with depth:
//   posters      the story, pasted to the lamp posts: LOST DOG (Biscuit), then MISSING (a boy in a red
//                bobble hat, "last seen walking his dog"), the dates getting older as you climb
//   shops        painted fascia signs; real shop windows with real things behind the glass: dolls
//                facing out, hooks, a launderette's drums (one still turning), a newspaper board
//   park         iron railings and pillars, the gate, a playground (a swing moving on its own, a
//                roundabout turning), benches, a pond with reeds
//   bridge       stone parapets, the canal four metres down, its walls and towpath, a narrowboat
//                with a lit porthole and smoke from its chimney
//   home         the last house. The only one that stands straight.
import * as THREE from 'three';
import { makeRng } from '../../../engine/rng.js';
import { ROAD, at as roadAt, N as roadN, T as roadT, C as roadC, height } from '../sim/road.js';
import { BRIDGE, HOME, POSTERS } from '../sim/town.js';
import { box, cyl, cone, sphere, tube, limb, xf, V3 } from './kit.js';
import { U, inject, depthFor } from './materials.js';
import { WIN_U } from './windows.js';

// a mesh that belongs to a leaning house: built in the house's frame, given the house's lean
function leanMesh(geo, mat, F, x, y, z, ry = 0) {
  geo.applyMatrix4(new THREE.Matrix4().compose(V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), V3(1, 1, 1)));
  const p = geo.attributes.position, L = new Float32Array(p.count * 3), rot = new THREE.Matrix3().setFromMatrix4(F.matrix), v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { const l = F.lean(p.getX(i), p.getY(i), p.getZ(i)); v.set(l[0], l[1], l[2]).applyMatrix3(rot); L.set([v.x, v.y, v.z], i * 3); }
  geo.applyMatrix4(F.matrix); geo.setAttribute('aLean', new THREE.BufferAttribute(L, 3));
  if (!mat.userData.flags) inject(mat, { lean: true });
  const m = new THREE.Mesh(geo, mat); m.customDepthMaterial = depthFor({ lean: true }); m.receiveShadow = true; return m;
}

const texCache = new Map();
function canvasTex(key, w, h, draw) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  texCache.set(key, t); return t;
}

// ---------------------------------------------------------------- posters
function paper(g, w, h, age) {
  const y = 232 - age * 60, gr = g.createLinearGradient(0, 0, w, h);
  gr.addColorStop(0, `rgb(${y},${y - 8 - age * 20},${y - 30 - age * 40})`); gr.addColorStop(1, `rgb(${y - 14},${y - 24 - age * 20},${y - 46 - age * 40})`);
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  // rain streaks and stains, more with age
  for (let i = 0; i < 6 + age * 30; i++) { const x = Math.random() * w; g.fillStyle = `rgba(90,70,40,${0.04 + age * 0.08})`; g.fillRect(x, Math.random() * h * 0.3, 2 + Math.random() * 5, h * (0.3 + Math.random() * 0.7)); }
  for (let i = 0; i < age * 8; i++) { const x = Math.random() * w, yy = Math.random() * h, r = 8 + Math.random() * 30, s = g.createRadialGradient(x, yy, 0, x, yy, r); s.addColorStop(0, `rgba(120,90,40,${0.15 + age * 0.15})`); s.addColorStop(1, 'rgba(120,90,40,0)'); g.fillStyle = s; g.fillRect(0, 0, w, h); }
}
function ink(age) { const a = 1 - age * 0.55; return `rgba(28,18,16,${a})`; }
function drawPuppy(g, cx, cy, s, age) {
  g.save(); g.translate(cx, cy); g.scale(s, s); g.lineWidth = 3.5; g.strokeStyle = ink(age); g.fillStyle = `rgba(244,224,184,${1 - age * 0.5})`;
  g.beginPath(); g.ellipse(0, 40, 62, 40, 0, 0, 7); g.fill(); g.stroke(); g.beginPath(); g.arc(0, -8, 42, 0, 7); g.fill(); g.stroke();
  g.fillStyle = `rgba(176,122,64,${1 - age * 0.5})`; for (const s2 of [-1, 1]) { g.beginPath(); g.ellipse(s2 * 42, 0, 12, 27, s2 * 0.4, 0, 7); g.fill(); g.stroke(); }
  g.fillStyle = ink(age); for (const s2 of [-1, 1]) { g.beginPath(); g.arc(s2 * 15, -12, 6, 0, 7); g.fill(); } g.beginPath(); g.arc(0, 4, 6, 0, 7); g.fill();
  g.fillStyle = `rgba(192,48,42,${1 - age * 0.5})`; g.fillRect(-30, 26, 60, 8);
  g.restore();
}
function drawBoy(g, cx, cy, s, age) {
  g.save(); g.translate(cx, cy); g.scale(s, s); g.lineWidth = 3.5; g.strokeStyle = ink(age);
  g.fillStyle = `rgba(232,190,160,${1 - age * 0.5})`; g.beginPath(); g.arc(0, 0, 40, 0, 7); g.fill(); g.stroke();
  g.fillStyle = `rgba(190,40,34,${1 - age * 0.45})`; g.beginPath(); g.arc(0, -10, 42, Math.PI, 0); g.fill(); g.stroke(); g.fillRect(-44, -14, 88, 12); g.strokeRect(-44, -14, 88, 12);
  g.beginPath(); g.arc(0, -56, 10, 0, 7); g.fillStyle = `rgba(240,230,220,${1 - age * 0.5})`; g.fill(); g.stroke();
  g.fillStyle = ink(age); for (const s2 of [-1, 1]) { g.beginPath(); g.arc(s2 * 14, 8, 4, 0, 7); g.fill(); }
  g.beginPath(); g.moveTo(-12, 24); g.quadraticCurveTo(0, 30, 12, 24); g.stroke();
  g.fillStyle = `rgba(40,56,100,${1 - age * 0.5})`; g.beginPath(); g.moveTo(-40, 42); g.lineTo(40, 42); g.lineTo(52, 110); g.lineTo(-52, 110); g.closePath(); g.fill(); g.stroke();
  g.restore();
}
function posterTex(kind, age, year) {
  return canvasTex(`poster:${kind}:${age}:${year}`, 300, 420, (g, w, h) => {
    paper(g, w, h, age);
    g.textAlign = 'center'; g.fillStyle = ink(age);
    if (kind === 'lostDog') {
      g.font = 'bold 74px Georgia'; g.fillText('LOST', w / 2, 82);
      drawPuppy(g, w / 2, 190, 1.05, age);
      g.font = 'bold 30px Georgia'; g.fillText('BISCUIT', w / 2, 300);
      g.font = '19px Georgia'; g.fillText('small, cream, red collar', w / 2, 328); g.fillText('very friendly. please call', w / 2, 352);
    } else {
      g.font = 'bold 56px Georgia'; g.fillText('MISSING', w / 2, 66);
      g.font = '20px Georgia'; g.fillText('HAVE YOU SEEN THIS BOY?', w / 2, 96);
      drawBoy(g, w / 2, 180, 0.95, age);
      g.font = '18px Georgia'; g.fillText('last seen walking his dog', w / 2, 318); g.fillText('on the way home, after dark', w / 2, 340);
      g.font = 'bold 22px Georgia'; g.fillText(`October ${year || 1987}`, w / 2, 372);
    }
    // tear-off tabs along the bottom, some taken
    g.strokeStyle = ink(age); g.lineWidth = 1;
    for (let i = 0; i < 9; i++) { if (Math.random() < 0.3) { g.clearRect(i * w / 9 + 2, h - 40, w / 9 - 4, 40); continue; } g.beginPath(); g.moveTo(i * w / 9, h - 42); g.lineTo(i * w / 9, h); g.stroke(); }
  });
}
const posterMats = new Map();
function posterMat(kind, age, year) {
  const k = `${kind}:${age}:${year}`; if (posterMats.has(k)) return posterMats.get(k);
  const m = new THREE.MeshStandardMaterial({ map: posterTex(kind, age, year), roughness: 0.85, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, transparent: true, alphaTest: 0.5 });
  posterMats.set(k, m); return m;
}
// a sheet of paper, curling a little at the corners
function sheet(w, h) { const g = new THREE.PlaneGeometry(w, h, 4, 6), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i) / w, y = p.getY(i) / h; p.setZ(i, (x * x * 0.6 + y * y * 0.3) * 0.04 * (y < 0 ? 1.8 : 1)); } g.computeVertexNormals(); return g; }

function posters(group, town, s0, s1) {
  for (const P of POSTERS) {
    if (P.s < s0 || P.s >= s1) continue;
    // the nearest lamp post
    let L = null; for (const l of town.lamps) if (!L || Math.abs(l.s - P.s) < Math.abs(L.s - P.s)) L = l;
    const n = roadN(L.s), b = roadAt(L.s, L.side * 3.75), face = Math.atan2(roadT(L.s).x, roadT(L.s).z) + Math.PI; // face back down the road, toward you
    const put = (kind, age, y, rot, ox = 0, oz = 0, year) => {
      const m = new THREE.Mesh(sheet(0.3, 0.42), posterMat(kind, age, year)); m.position.set(b.x + ox, b.y + y, b.z + oz); m.rotation.set(0, face + rot, (Math.random() - 0.5) * 0.12);
      m.translateZ(0.13); m.castShadow = false; m.receiveShadow = true; group.add(m);
    };
    if (P.kind === 'many') {
      for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2; const kind = Math.random() < 0.75 ? 'missing' : 'lostDog'; const m = new THREE.Mesh(sheet(0.3, 0.42), posterMat(kind, Math.min(1, P.age - Math.random() * 0.3), 1940 + Math.floor(Math.random() * 80))); m.position.set(b.x + Math.sin(a) * 0.13, b.y + 0.9 + (k % 3) * 0.45, b.z + Math.cos(a) * 0.13); m.rotation.set(0, a, (Math.random() - 0.5) * 0.2); m.receiveShadow = true; group.add(m); }
      // and along the fences and walls nearby
      for (let k = 0; k < 10; k++) { const s = P.s + (Math.random() - 0.5) * 30, side = Math.random() < 0.5 ? -1 : 1, p = roadAt(s, side * 4.95, 0.75 + Math.random() * 0.3), tn = roadN(s); const m = new THREE.Mesh(sheet(0.3, 0.42), posterMat('missing', Math.min(1, P.age - Math.random() * 0.4), 1930 + Math.floor(Math.random() * 90))); m.position.set(p.x, p.y, p.z); m.rotation.set(0, Math.atan2(-side * tn.x, -side * tn.z), (Math.random() - 0.5) * 0.25); m.translateZ(0.2); m.receiveShadow = true; group.add(m); }
    } else put(P.kind, P.age, 1.45, 0, 0, 0, P.year);
  }
}

// ---------------------------------------------------------------- shops
const SIGN_STYLES = { BUTCHER: ['#5a1a16', '#e8d090'], 'TOYS & GAMES': ['#1a2a4a', '#f0d070'], LAUNDERETTE: ['#1a3a3a', '#d8f0e8'], SWEETS: ['#4a1a3a', '#f8d8e8'], BARBER: ['#1a1a1a', '#e8e0d0'], 'TV REPAIRS': ['#2a2a2a', '#c8e0f8'], BAKERY: ['#4a3018', '#f0e0b0'], NEWSAGENT: ['#14281a', '#e8e0c0'], CHEMIST: ['#103a20', '#e0f0e0'], PAWNBROKER: ['#2a2010', '#d8b850'], 'FISH & CHIPS': ['#18304a', '#f8f0d0'], HABERDASHERY: ['#3a1a30', '#f0d8c0'] };
function signTex(name) {
  const [bg, fg] = SIGN_STYLES[name] || ['#222', '#ddd'];
  return canvasTex('sign:' + name, 1024, 160, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`; g.fillRect(0, Math.random() * h, w, 1); }
    g.strokeStyle = fg; g.globalAlpha = 0.6; g.lineWidth = 4; g.strokeRect(14, 14, w - 28, h - 28); g.globalAlpha = 1;
    g.font = 'bold 92px Georgia'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillText(name, w / 2 + 4, h / 2 + 6); g.fillStyle = fg; g.fillText(name, w / 2, h / 2 + 2);
    // flaking gilt
    for (let i = 0; i < 400; i++) { g.fillStyle = bg; g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 4, 1 + Math.random() * 3); }
  });
}
function dollFaceTex() {
  return canvasTex('dollface', 128, 128, (g) => {
    g.fillStyle = '#efe0d0'; g.fillRect(0, 0, 128, 128);
    const cx = 96, cy = 64; g.fillStyle = '#101018'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(cx + s * 9, cy - 4, 5, 6.5, 0, 0, 7); g.fill(); }
    g.fillStyle = '#fff'; for (const s of [-1, 1]) { g.beginPath(); g.arc(cx + s * 9 + 1.5, cy - 6, 1.6, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(210,90,100,0.6)'; for (const s of [-1, 1]) { g.beginPath(); g.arc(cx + s * 14, cy + 6, 4, 0, 7); g.fill(); }
    g.fillStyle = '#b03040'; g.beginPath(); g.ellipse(cx, cy + 11, 3, 2, 0, 0, 7); g.fill();
  });
}
// a real shop window: a shallow lit box behind glass with real things in it
function shopWindow(group, kit, F, sf, o, anim) {
  const r = makeRng('shop:' + o.seed), name = sf.sign.name, d = 1.1, W = sf.wdt, H = 1.9, x0 = sf.x - 0.05, z = sf.z, y0 = 0.62;
  const P = (gx, gy, gz) => V3(gx, gy, gz).applyMatrix4(F.matrix);
  const lit = r.chance(name === 'LAUNDERETTE' || name === 'CHEMIST' || name === 'FISH & CHIPS' ? 0.9 : 0.45);
  const A = (g, m, c) => kit.add(g, m, c, { matrix: F.matrix, lean: () => [0, 0, 0] });
  // the box: back wall, floor (display bed), side walls, ceiling
  const AL = (g, m, c) => kit.add(g, m, c, F);
  AL(xf(box(0.06, H, W), x0 - d, y0 + H / 2, z), 'paintL', 0x3a3430);
  AL(xf(box(d, 0.08, W), x0 - d / 2, y0 + 0.04, z), 'trim', 0x6a4a34);
  for (const sg of [-1, 1]) AL(xf(box(d, H, 0.06), x0 - d / 2, y0 + H / 2, z + sg * W / 2), 'paintL', 0x3a3430);
  AL(xf(box(d, 0.06, W), x0 - d / 2, y0 + H, z), 'paintL', 0x2a2420);
  // what's in it
  if (name === 'TOYS & GAMES') {
    const face = new THREE.MeshStandardMaterial({ map: dollFaceTex(), roughness: 0.35 }), dolls = [];
    // once the night has turned, their heads follow you as you go past (all but the one facing the wall)
    anim.push((t, dt) => { const evil = WIN_U.uEvil.value, pl = WIN_U.uPlayer.value; for (const d of dolls) { const h = d.head, want = evil > 0.3 && Math.hypot(pl.x - h.position.x, pl.z - h.position.z) < 18 ? Math.atan2(-(pl.z - h.position.z), pl.x - h.position.x) : d.rest; /* (the face is the head's local +x) */ let df = want - h.rotation.y; while (df > Math.PI) df -= Math.PI * 2; while (df < -Math.PI) df += Math.PI * 2; h.rotation.y += df * Math.min(1, (dt || 0.016) * 1.2); } });
    for (let row = 0; row < 3; row++) {
      A(xf(box(0.3, 0.03, W - 0.1), x0 - 0.5, y0 + 0.35 + row * 0.5, z), 'wood', 0x5a4030);
      for (let k = 0; k < Math.floor(W / 0.32); k++) {
        const zz = z - W / 2 + 0.2 + k * 0.32, yy = y0 + 0.37 + row * 0.5, dress = r.pick([0xb04050, 0x4060a0, 0xe0d0b0, 0x60a070, 0x8a4ab0]);
        A(xf(cone(0.08, 0.24, 10), x0 - 0.5, yy + 0.12, zz), 'cloth', dress);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.065, 14, 10), face);
        const hp = P(x0 - 0.5, yy + 0.3, zz); head.position.copy(hp); const wrong = row === 1 && k === 2; head.rotation.y = F.rotY + (wrong ? Math.PI : 0); // one of them faces the wrong way
        head.castShadow = false; head.userData.dynamic = true; group.add(head); if (!wrong) dolls.push({ head, rest: head.rotation.y });
        A(xf(sphere(0.07, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), x0 - 0.5, yy + 0.31, zz), 'cloth', r.pick([0x3a2418, 0xd8b060, 0x1a1a1a, 0x8a3a20]));
      }
    }
    // a rocking horse on the floor
    A(xf(box(0.5, 0.22, 0.16), x0 - 0.55, y0 + 0.42, z + W * 0.3), 'paint', 0xe8e0d0); A(xf(box(0.1, 0.24, 0.12), x0 - 0.3, y0 + 0.6, z + W * 0.3), 'paint', 0xe8e0d0);
  } else if (name === 'BUTCHER') {
    A(limb(V3(x0 - 0.4, y0 + H - 0.15, z - W / 2 + 0.1), V3(x0 - 0.4, y0 + H - 0.15, z + W / 2 - 0.1), 0.015), 'metal', 0x8a8a90);
    for (let k = 0; k < 6; k++) { const zz = z - W / 2 + 0.35 + k * (W - 0.6) / 5; A(xf(cyl(0.006, 0.006, 0.2, 4), x0 - 0.4, y0 + H - 0.27, zz), 'metal', 0x8a8a90); if (r.chance(0.6)) A(xf(sphere(0.13, 10, 8), x0 - 0.4, y0 + H - 0.55, zz, 0, 0, 0, 0.8, 1.6, 0.6), 'cloth', 0x5a1a18); }
    A(xf(box(0.5, 0.5, W - 0.2), x0 - 0.4, y0 + 0.3, z), 'paint', 0xe8e8e0);
  } else if (name === 'LAUNDERETTE') {
    for (let k = 0; k < Math.floor(W / 0.7); k++) {
      const zz = z - W / 2 + 0.4 + k * 0.7;
      A(xf(box(0.6, 0.8, 0.62), x0 - 0.55, y0 + 0.42, zz), 'paint', 0xe0e4e0);
      const door = new THREE.Mesh(new THREE.CircleGeometry(0.2, 20), new THREE.MeshStandardMaterial({ color: 0x223040, roughness: 0.1, emissive: k === 1 ? 0x2a3a40 : 0x060808 }));
      door.position.copy(P(x0 - 0.24, y0 + 0.48, zz)); door.rotation.y = F.rotY + Math.PI / 2; group.add(door);
      if (k === 1) { const drum = new THREE.Mesh(new THREE.CircleGeometry(0.17, 6), new THREE.MeshBasicMaterial({ color: 0x8090a0 })); drum.position.copy(P(x0 - 0.26, y0 + 0.48, zz)); drum.rotation.y = F.rotY + Math.PI / 2; drum.userData.dynamic = true; group.add(drum); anim.push((t) => { drum.rotation.z = t * 5; }); }
    }
  } else if (name === 'NEWSAGENT') {
    // the board outside on the pavement: today's headline
    const board = canvasTex('news', 256, 340, (g, w, h) => { g.fillStyle = '#f2eee2'; g.fillRect(0, 0, w, h); g.fillStyle = '#c01818'; g.fillRect(0, 0, w, 54); g.fillStyle = '#fff'; g.font = 'bold 34px Georgia'; g.textAlign = 'center'; g.fillText('EVENING NEWS', w / 2, 40); g.fillStyle = '#111'; g.font = 'bold 44px Georgia'; ['SEARCH', 'FOR BOY', 'GOES ON', 'INTO', 'NIGHT'].forEach((t, i) => g.fillText(t, w / 2, 112 + i * 48)); });
    const bm = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.73), new THREE.MeshStandardMaterial({ map: board, roughness: 0.8 }));
    const bp = P(sf.x + 1.6, 0.62, z + W / 2 + 0.5); bm.position.copy(bp); bm.rotation.set(-0.18, F.rotY + Math.PI / 2, 0); group.add(bm);
    A(xf(box(0.04, 0.85, 0.6), sf.x + 1.55, 0.45, z + W / 2 + 0.5, 0, 0, 0.18), 'metal', 0x2a2a2a);
    for (let k = 0; k < 4; k++) A(xf(box(0.3, 0.03, 0.42), x0 - 0.5, y0 + 0.3 + k * 0.38, z - W / 4), 'paint', r.pick([0xe0d8c0, 0xd0c8b0]));
  } else if (name === 'CHEMIST') {
    for (let k = 0; k < 3; k++) for (let j = 0; j < 5; j++) A(xf(cyl(0.07, 0.08, 0.28, 10), x0 - 0.5, y0 + 0.3 + k * 0.5, z - W / 2 + 0.3 + j * (W - 0.6) / 4), 'plastic', r.pick([0x2a6a4a, 0x6a2a2a, 0x2a3a6a, 0xa08a3a]));
  } else {
    for (let k = 0; k < 6; k++) A(xf(box(r.range(0.15, 0.35), r.range(0.1, 0.5), r.range(0.15, 0.4)), x0 - r.range(0.3, 0.8), y0 + 0.3, z + r.range(-W / 2 + 0.3, W / 2 - 0.3)), 'paint', r.pick([0x5a4a3a, 0x8a7a6a, 0x3a3a4a, 0x7a5a4a]));
  }
  // the light inside, and the glass (a faint reflection, mostly see-through)
  const L = lit ? { pos: P(x0 - d * 0.5, y0 + H - 0.2, z), color: name === 'LAUNDERETTE' || name === 'CHEMIST' ? [0.7, 0.95, 0.9] : [1.0, 0.75, 0.45], power: name === 'LAUNDERETTE' ? 1.6 : 1.0, cone: 0, kind: 'shop' } : null;
  const glass = leanMesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ envMap: U.env, color: 0x0a0c10, roughness: 0.05, metalness: 0.0, transparent: true, opacity: 0.2, envMapIntensity: 1.2, depthWrite: false }), F, sf.x + 0.02, y0 + H / 2, z, Math.PI / 2);
  glass.renderOrder = 2; group.add(glass);
  // the sign, and sometimes a little brass lamp bending over it
  const sg = leanMesh(new THREE.PlaneGeometry(sf.sign.wdt, 0.6), new THREE.MeshStandardMaterial({ map: signTex(name), roughness: 0.5, emissive: name === 'CHEMIST' ? 0x0a2a14 : 0x000000 }), F, sf.sign.x + 0.012, sf.sign.y, sf.sign.z, Math.PI / 2);
  group.add(sg);
  let signLight = null;
  if (r.chance(0.55)) {
    for (const off of [-sf.sign.wdt * 0.28, sf.sign.wdt * 0.28]) {
      const base = V3(sf.sign.x, sf.sign.y + 0.42, z + off);
      A(tube([base, V3(base.x + 0.25, base.y + 0.18, base.z), V3(base.x + 0.42, base.y + 0.05, base.z)], 0.012, 10, 4), 'metal', 0x8a6a30);
      A(xf(cone(0.07, 0.1, 10), base.x + 0.44, base.y - 0.01, base.z, 0, 0, 0.6), 'metal', 0x8a6a30);
    }
    signLight = { pos: P(sf.sign.x + 0.55, sf.sign.y + 0.35, z), color: [1.0, 0.78, 0.5], power: 0.55, cone: 1, kind: 'sign' };
  }
  if (signLight) group.userData.signLights = [...(group.userData.signLights || []), signLight];
  if (name === 'CHEMIST') { // the green cross, lit
    const cross = new THREE.Group(); const cm = new THREE.MeshBasicMaterial({ color: 0x30ff70 });
    cross.add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.16), cm), new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.5), cm));
    cross.position.copy(P(sf.x + 0.6, 3.9, z + W / 2 + 0.1)); cross.rotation.y = F.rotY; group.add(cross);
    anim.push((t) => { cross.visible = Math.sin(t * 2.2) > -0.85; });
  }
  return L;
}

// ---------------------------------------------------------------- park
function park(kit, group, town, s0, s1, anim) {
  const P = town.park;
  // railings along the park side, with stone pillars; a gap and a gate at the entrance
  for (let s = Math.max(950, s0); s < Math.min(1250, s1); s += 0.14) {
    if (s > BRIDGE.from - 7 && s < BRIDGE.to + 7) continue;
    if (Math.abs(s - P.gate.s) < 1.6 || Math.abs(s - P.gate2.s) < 1.6) continue;
    const b = roadAt(s, 4.95);
    if (Math.abs(((s - 950) % 9)) < 0.14) { kit.add(xf(box(0.42, 1.5, 0.42), b.x, b.y + 0.75, b.z), 'slab', 0xa8a49c); kit.add(xf(sphere(0.2, 10, 8), b.x, b.y + 1.65, b.z), 'slab', 0xa8a49c); continue; }
    kit.add(xf(cyl(0.012, 0.012, 1.3, 5), b.x, b.y + 0.65, b.z), 'metal', 0x16181a);
    kit.add(xf(cone(0.028, 0.1, 5), b.x, b.y + 1.33, b.z), 'metal', 0x16181a);
  }
  for (const G of [P.gate, P.gate2]) if (G.s >= s0 && G.s < s1) {
    // the gate: an iron arch, the gates standing open
    const a = roadAt(G.s - 1.6, 4.95), b = roadAt(G.s + 1.6, 4.95);
    for (const p of [a, b]) { kit.add(xf(box(0.55, 2.4, 0.55), p.x, p.y + 1.2, p.z), 'slab', 0xa8a49c); kit.add(xf(sphere(0.25, 10, 8), p.x, p.y + 2.6, p.z), 'slab', 0xa8a49c); }
    const arch = []; for (let i = 0; i <= 20; i++) { const t = i / 20; const p = a.clone ? null : null; const q = V3(a.x + (b.x - a.x) * t, a.y + 2.5 + Math.sin(t * Math.PI) * 0.9, a.z + (b.z - a.z) * t); arch.push(q); }
    kit.add(tube(arch, 0.03, 30, 5), 'metal', 0x16181a);
    for (const [p, dir] of [[a, 1], [b, -1]]) { const g = box(0.04, 1.6, 1.4); g.translate(0, 0, 0.7 * dir); kit.add(xf(g, p.x + 0.4, p.y + 0.85, p.z, 0, dir * 1.1), 'metal', 0x16181a); }
  }
  // the playground
  const pg = P.playground;
  if (pg.s >= s0 && pg.s < s1) {
    const c = roadAt(pg.s, pg.l);
    kit.add(xf(cyl(9, 9, 0.04, 28), c.x, c.y + 0.16, c.z), 'slab', 0x6a5a50); // the rubber ground
    // swings: a frame and two seats; one moves on its own
    const sw = roadAt(pg.s - 4, pg.l - 1);
    for (const dz of [-1.6, 1.6]) for (const dx of [-0.8, 0.8]) kit.add(limb(V3(sw.x + dx, sw.y + 0.15, sw.z + dz), V3(sw.x, sw.y + 2.6, sw.z + dz * 0.95), 0.05), 'metal', 0x6a2a24);
    kit.add(limb(V3(sw.x, sw.y + 2.6, sw.z - 1.55), V3(sw.x, sw.y + 2.6, sw.z + 1.55), 0.06), 'metal', 0x6a2a24);
    for (const [dz, moves] of [[-0.6, false], [0.6, true]]) {
      const pivot = new THREE.Group(); pivot.position.set(sw.x, sw.y + 2.6, sw.z + dz); group.add(pivot);
      const mat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6 });
      for (const o of [-0.2, 0.2]) { const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 2.1, 4), mat); ch.position.set(0, -1.05, o); pivot.add(ch); }
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.5), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 })); seat.position.y = -2.1; seat.castShadow = true; pivot.add(seat);
      if (moves) anim.push((t, f) => { pivot.rotation.z = Math.sin(t * 1.9) * (0.32 + 0.15 * Math.sin(t * 0.13)); pivot.userData.swing = true; });
      if (moves) group.userData.swing = pivot;
    }
    // a slide
    const sl = roadAt(pg.s + 3, pg.l + 1.5);
    kit.add(xf(box(0.6, 0.06, 3.2), sl.x, sl.y + 1.1, sl.z, 0.6, 0, 0), 'metal', 0xa8b0b8);
    for (let k = 0; k < 6; k++) kit.add(xf(box(0.5, 0.04, 0.12), sl.x, sl.y + 0.3 + k * 0.35, sl.z - 1.9), 'metal', 0x6a2a24);
    for (const dx of [-0.28, 0.28]) kit.add(limb(V3(sl.x + dx, sl.y + 0.1, sl.z - 2.0), V3(sl.x + dx, sl.y + 2.3, sl.z - 2.0), 0.03), 'metal', 0x6a2a24);
    // a roundabout, turning slowly though nobody is on it
    const ra = roadAt(pg.s + 1, pg.l - 4.5), rg = new THREE.Group(); rg.position.set(ra.x, ra.y + 0.25, ra.z); group.add(rg);
    const rm = new THREE.MeshStandardMaterial({ color: 0x3a5a7a, roughness: 0.6 }), barM = new THREE.MeshStandardMaterial({ color: 0xc8c0a0, roughness: 0.4 });
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.1, 24), rm); plat.castShadow = plat.receiveShadow = true; rg.add(plat);
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2, bar = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.025, 6, 16, Math.PI), barM); bar.position.set(Math.cos(a) * 0.75, 0.05, Math.sin(a) * 0.75); bar.rotation.y = -a; rg.add(bar); }
    anim.push((t) => { rg.rotation.y = t * 0.35; });
    const pl = roadAt(pg.s - 1, pg.l + 4.5);
    kit.add(xf(cyl(0.07, 0.1, 3.6, 10), pl.x, pl.y + 1.8, pl.z), 'metal', 0x1c241e); kit.add(xf(cone(0.32, 0.4, 6), pl.x, pl.y + 3.85, pl.z), 'metal', 0x1c241e);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe0b0 })); bulb.position.set(pl.x, pl.y + 3.58, pl.z); group.add(bulb);
    group.userData.parkLight = { pos: V3(pl.x, pl.y + 3.55, pl.z), color: [1.0, 0.82, 0.55], power: 0.9, cone: 1, kind: 'lamp' };
  }
  // benches
  for (const B of P.benches) {
    if (B.s < s0 || B.s >= s1) continue;
    const b = roadAt(B.s, B.l), n = roadN(B.s), ry = Math.atan2(n.x, n.z);
    for (let k = 0; k < 3; k++) kit.add(xf(box(0.12, 0.04, 1.8), b.x + n.x * (0.2 - k * 0.14), b.y + 0.5, b.z + n.z * (0.2 - k * 0.14), 0, ry + Math.PI / 2), 'wood', 0x6a4a30);
    for (let k = 0; k < 3; k++) kit.add(xf(box(0.04, 0.12, 1.8), b.x + n.x * 0.32, b.y + 0.72 + k * 0.15, b.z + n.z * 0.32, 0, ry + Math.PI / 2), 'wood', 0x6a4a30);
    for (const o of [-0.8, 0.8]) { const p = roadAt(B.s + o, B.l); kit.add(xf(box(0.5, 0.5, 0.06), p.x + n.x * 0.1, p.y + 0.25, p.z + n.z * 0.1, 0, ry), 'metal', 0x1a1a1a); }
  }
  // the pond, its reeds
  const pd = P.pond;
  if (pd.s >= s0 && pd.s < s1) {
    const c = roadAt(pd.s, pd.l, 0.1);
    const water = new THREE.Mesh(new THREE.CircleGeometry(pd.r, 40), new THREE.MeshStandardMaterial({ envMap: U.env, color: 0x05070a, roughness: 0.04, metalness: 0.6, envMapIntensity: 1.6 }));
    water.rotation.x = -Math.PI / 2; water.scale.set(1.4, 1, 1); water.position.copy(c); water.receiveShadow = true; group.add(water);
    const rr = makeRng('reeds');
    for (let k = 0; k < 120; k++) { const a = rr.range(0, 6.28), r = pd.r * rr.range(0.9, 1.1), p = V3(c.x + Math.cos(a) * r * 1.4, c.y, c.z + Math.sin(a) * r); kit.add(xf(cone(0.012, rr.range(0.8, 1.6), 3), p.x, p.y + 0.5, p.z, rr.range(-0.2, 0.2), 0, rr.range(-0.2, 0.2)), 'hedge', 0x8a8a5a, null, (y) => Math.max(0, y - c.y) * 0.08); }
  }
}

// ---------------------------------------------------------------- bridge and canal
function bridge(kit, group, s0, s1, anim) {
  if (s1 < BRIDGE.from - 8 || s0 > BRIDGE.to + 8) return;
  const wy = height(BRIDGE.water) - 4.4, half = BRIDGE.width / 2;
  // parapets along both sides of the deck, with coping and piers at the ends
  for (const side of [-1, 1]) {
    for (let s = Math.max(BRIDGE.from, s0); s < Math.min(BRIDGE.to, s1); s += 1) {
      const a = roadAt(s, side * 4.95), b = roadAt(s + 1, side * 4.95);
      const mid = a.clone ? a : V3(a.x, a.y, a.z), len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z), ry = Math.atan2(b.x - a.x, b.z - a.z), rx = -Math.atan2(b.y - a.y, Math.hypot(b.x - a.x, b.z - a.z));
      kit.add(xf(box(0.45, 0.42, len + 0.02), (a.x + b.x) / 2, (a.y + b.y) / 2 + 0.3, (a.z + b.z) / 2, rx, ry), 'brick', 0xb0a090);
      kit.add(xf(box(0.55, 0.1, len + 0.02), (a.x + b.x) / 2, (a.y + b.y) / 2 + 0.55, (a.z + b.z) / 2, rx, ry), 'slab', 0xa8a49c);
      // iron balusters on the stone, a rail on top: you can see down through them to the water
      for (let k = 0; k < 6; k++) { const t = k / 6; kit.add(xf(cyl(0.016, 0.016, 0.62, 5), a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t + 0.9, a.z + (b.z - a.z) * t), 'metal', 0x1a1c1e); }
      kit.add(xf(box(0.07, 0.07, len + 0.02), (a.x + b.x) / 2, (a.y + b.y) / 2 + 1.22, (a.z + b.z) / 2, rx, ry), 'metal', 0x1a1c1e);
    }
    for (const s of [BRIDGE.from, BRIDGE.to]) if (s >= s0 && s < s1) { const p = roadAt(s, side * 4.95); kit.add(xf(box(0.8, 1.6, 0.8), p.x, p.y + 0.8, p.z), 'slab', 0xa0988c); kit.add(xf(cone(0.5, 0.5, 4), p.x, p.y + 1.85, p.z, 0, Math.PI / 4), 'slab', 0xa0988c); }
  }
  // the canal: only built once, with the segment that holds its centre
  if (BRIDGE.water < s0 || BRIDGE.water >= s1) return;
  const c = roadAt(BRIDGE.water, 0);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(220, BRIDGE.width - 2.4, 1, 1), new THREE.MeshStandardMaterial({ envMap: U.env, color: 0x030507, roughness: 0.03, metalness: 0.7, envMapIntensity: 1.8 }));
  water.rotation.x = -Math.PI / 2; water.position.set(c.x, wy, c.z); water.receiveShadow = true; group.add(water);
  // canal walls (stone), the towpaths along them, the dark under the arch
  for (const sg of [-1, 1]) {
    const z = c.z + sg * (half - 0.6);
    kit.add(xf(box(220, 4.6, 0.5, 40, 2, 1), c.x, wy + 2.1, z + sg * 1.35), 'brick', 0x8a7a6a);
    kit.add(xf(box(220, 0.2, 1.3, 40, 1, 1), c.x, wy + 0.55, z + sg * 0.55), 'slab', 0x7a766e);
  }
  kit.add(xf(box(10.5, 1.2, BRIDGE.width - 0.8), c.x, height(BRIDGE.water) - 0.75, c.z), 'brick', 0x8a7a6a); // the deck
  // a narrowboat moored along the towpath, a light on inside, smoke from its stove pipe
  const nb = V3(c.x - 26, wy, c.z - (half - 2.3));
  kit.add(xf(box(18, 1.0, 2.0), nb.x, nb.y + 0.3, nb.z), 'paint', 0x1a2a3a);
  kit.add(xf(box(13, 1.1, 1.8), nb.x + 1, nb.y + 1.35, nb.z), 'paint', 0x6a2a24);
  kit.add(xf(box(13.2, 0.08, 1.95), nb.x + 1, nb.y + 1.92, nb.z), 'paint', 0x2a2a2a);
  kit.add(xf(cone(1.0, 2.8, 4, 1), nb.x - 9.5, nb.y + 0.3, nb.z, 0, Math.PI / 4, Math.PI / 2, 0.36, 1, 1), 'paint', 0x1a2a3a);
  kit.add(xf(cyl(0.08, 0.08, 0.7, 8), nb.x + 5, nb.y + 2.3, nb.z), 'metal', 0x1a1a1a);
  for (let k = 0; k < 5; k++) { const pw = new THREE.Mesh(new THREE.CircleGeometry(0.16, 16), new THREE.MeshBasicMaterial({ color: k === 2 ? 0xffb860 : 0x2a1a10 })); pw.position.set(nb.x - 4 + k * 2.4, nb.y + 1.45, nb.z + 0.92); group.add(pw); }
  group.userData.boatLight = { pos: V3(nb.x + 0.8, nb.y + 1.45, nb.z + 1.3), color: [1.0, 0.65, 0.35], power: 1.0, cone: 0, kind: 'boat' };
  group.userData.smoke = V3(nb.x + 5, nb.y + 2.7, nb.z);
}

// ---------------------------------------------------------------- home
export function homeSpec() {
  return { id: 9999, s: HOME.s, side: 0, region: 'hill', w: 7.2, d: 6, h: 6.2, rh: 3.6, lean: 0, twist: 0, taper: 0, wall: 'render', wallColor: 0xd8c8a8, roof: 0x5a4642, door: 0x2a4a6a, trim: 0xf0e8d8, shutter: 0x3a5a7a, turret: false, chimney: true, dormer: false, porch: true, porchLamp: true, shop: false, boundary: 'picket', doorZ: 0, seed: 424242, rows: 1, home: true };
}

export function regionContent(kit, group, town, s0, s1) {
  const anim = [], lights = [];
  posters(group, town, s0, s1);
  park(kit, group, town, s0, s1, anim);
  bridge(kit, group, s0, s1, anim);
  if (group.userData.boatLight) lights.push(group.userData.boatLight);
  if (group.userData.parkLight) lights.push(group.userData.parkLight);
  for (const l of group.userData.signLights || []) lights.push(l);
  return { anim, lights };
}
export { shopWindow };
