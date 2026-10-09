// Throwaway style mockups for the walk-home pivot: one suburban street at night, a small boy, his
// puppy on a lead, something following. The same street rendered four ways (?style=):
//   retro       low-poly late-90s 3D, low resolution, wobbling vertices, dithered colour; camera behind the boy
//   diorama     miniature, soft shadows, tilt-shift; the boy hides behind a bin while a van crawls past
//   torch       steep top-down, almost no light but the boy's torch; something at the edge of the beam
//   silhouette  side-on, black shapes against layered fog; running with the puppy in his arms
import * as THREE from 'three';

const Q = new URLSearchParams(location.search);
const STYLE = Q.get('style') || 'retro';
const W = 1280, H = 720;
const RETRO = STYLE === 'retro', SIL = STYLE === 'silhouette', TORCH = STYLE === 'torch', DIO = STYLE === 'diorama';
const SHADOWS = DIO || TORCH;
let _s = 20261009;
const rnd = () => ((_s = (Math.imul(_s, 1664525) + 1013904223) >>> 0) / 4294967296);
const pick = (a) => a[Math.floor(rnd() * a.length)];

// ---------------------------------------------------------------- textures (neutral grey; materials tint them)
function tex(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  if (RETRO) { t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; } else t.anisotropy = 8;
  return t;
}
function speckle(g, s, n, sz, a) {
  for (let i = 0; i < n; i++) { g.fillStyle = rnd() < 0.5 ? `rgba(255,255,255,${a * rnd()})` : `rgba(0,0,0,${a * rnd()})`; g.fillRect(rnd() * s, rnd() * s, sz, sz); }
}
const TEXGEN = {
  asphalt: () => tex(128, (g, s) => {
    g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, s, s); speckle(g, s, 4000, 1.5, 0.4);
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.moveTo(5, 70); g.bezierCurveTo(40, 58, 60, 96, 124, 80); g.stroke();
  }),
  slab: () => tex(128, (g, s) => {
    g.fillStyle = '#a8a8a6'; g.fillRect(0, 0, s, s); speckle(g, s, 1800, 1.5, 0.3);
    g.fillStyle = 'rgba(0,0,0,0.5)'; for (let k = 0; k < 2; k++) { g.fillRect(0, k * 64, s, 2); g.fillRect(k * 64 + (k ? 0 : 20), 0, 2, s); }
  }),
  brick: () => tex(128, (g, s) => {
    g.fillStyle = '#c9c6c0'; g.fillRect(0, 0, s, s);
    for (let r = 0; r < 16; r++) for (let b = -1; b < 5; b++) {
      const v = 120 + rnd() * 50 | 0; g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(b * 28 + (r % 2) * 14 + 1, r * 8 + 1, 26, 6);
    }
    speckle(g, s, 800, 1, 0.25);
  }),
  render: () => tex(128, (g, s) => { g.fillStyle = '#b4b4b4'; g.fillRect(0, 0, s, s); speckle(g, s, 6000, 1, 0.35); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 90, s, 38); }),
  siding: () => tex(128, (g, s) => {
    g.fillStyle = '#b8b8b8'; g.fillRect(0, 0, s, s);
    for (let r = 0; r < 8; r++) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, r * 16 + 14, s, 2); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, r * 16, s, 3); }
    speckle(g, s, 600, 1, 0.2);
  }),
  roof: () => tex(128, (g, s) => {
    g.fillStyle = '#909090'; g.fillRect(0, 0, s, s);
    for (let r = 0; r < 10; r++) { g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, r * 13, s, 2); for (let b = 0; b < 6; b++) g.fillRect(b * 22 + (r % 2) * 11, r * 13, 2, 13); }
    speckle(g, s, 1500, 1.5, 0.3);
  }),
  grass: () => tex(128, (g, s) => {
    g.fillStyle = '#8a8a8a'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 2500; i++) { const v = 90 + rnd() * 110 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(rnd() * s, rnd() * s, 1, 2 + rnd() * 4); }
  }),
  hedge: () => tex(128, (g, s) => {
    g.fillStyle = '#7a7a7a'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) { const v = 50 + rnd() * 140 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.beginPath(); g.arc(rnd() * s, rnd() * s, 1 + rnd() * 3, 0, 7); g.fill(); }
  }),
  wood: () => tex(64, (g, s) => { g.fillStyle = '#a0a0a0'; g.fillRect(0, 0, s, s); for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(0, rnd() * s, s, 1); } }),
};
const TEXC = {};

// ---------------------------------------------------------------- materials, one table, four renderings
// sil: the colour in the silhouette style (black unless it's something that should glow or stay soft)
const SPEC = {
  asphalt: { color: 0x34373c, tex: 'asphalt' }, paint: { color: 0xb9b4a0 }, kerb: { color: 0x8c8a84 },
  slab: { color: 0x7d7d7a, tex: 'slab' }, grass: { color: 0x3a4630, tex: 'grass' }, soil: { color: 0x2a2620 },
  brick: { colors: [0x8a5242, 0x7a4a3e, 0x96705a], tex: 'brick' }, render: { colors: [0xb7b0a0, 0x9fa49a, 0xc2b49a], tex: 'render' },
  siding: { colors: [0x8c9a98, 0xa8a090, 0x6f7a80], tex: 'siding' }, roof: { colors: [0x3c3836, 0x4a3a34, 0x33383c], tex: 'roof' },
  frame: { color: 0xd8d2c4 }, sill: { color: 0xa8a49a }, door: { colors: [0x4a2a26, 0x2a3a4a, 0x2e4030, 0x5a5a58] },
  glassDark: { color: 0x0e1216, rough: 0.15 }, glassLit: { color: 0xffc27a, emissive: 0xffa84a, ei: 1.6, sil: 0xffd9a0 },
  glassTv: { color: 0x9fc2ff, emissive: 0x7aa8ff, ei: 1.3, sil: 0xbcd4ff }, board: { color: 0x5a4a3a, tex: 'wood' },
  lampGlass: { color: 0xffc070, emissive: 0xffa040, ei: 3, sil: 0xffe0b0 }, porchGlass: { color: 0xffd28a, emissive: 0xffb860, ei: 3, sil: 0xffe6c0 },
  fence: { color: 0xc9c4b6 }, wallTop: { color: 0x8a8278 }, hedge: { color: 0x26341f, tex: 'hedge' },
  pole: { color: 0x3a3d40, rough: 0.6, metal: 0.4 }, wood: { color: 0x4a3c30, tex: 'wood' }, bark: { color: 0x2a2520 },
  bin: { colors: [0x2c4636, 0x2a2e33, 0x3a3f4a] }, car: { color: 0x6a2622, rough: 0.35, metal: 0.4 }, van: { color: 0x9c9a92, rough: 0.5, metal: 0.2 },
  carGlass: { color: 0x0a0c0e, rough: 0.1 }, tyre: { color: 0x141414 }, head: { color: 0xfff0d0, emissive: 0xfff0d0, ei: 4, sil: 0xffffff },
  rear: { color: 0x801010, emissive: 0x600808, ei: 1 },
  coat: { color: 0x2b3a5c }, jeans: { color: 0x2a2f3c }, skin: { color: 0xe3b393 }, hair: { color: 0x3a2618 },
  beanie: { color: 0xc0342a, sil: 0x3a0c08 }, boots: { color: 0xb02e26, sil: 0x2a0806 }, bag: { color: 0xc89a3a },
  eye: { color: 0x0c0a0a }, eyeHi: { color: 0xffffff, emissive: 0xffffff, ei: 0.6, sil: 0xffffff },
  dog: { color: 0xf2dcb4, emissive: 0x4a3420, ei: 1, sil: 0xe8d6b4 }, dogDark: { color: 0xb5844c, emissive: 0x2a1808, ei: 1, sil: 0xb59468 }, nose: { color: 0x1a1414 },
  collar: { color: 0xd23a2e, sil: 0x6a1410 }, leash: { color: 0xd23a2e, sil: 0x000000 },
  entity: { color: 0x070708 }, face: { color: 0xcfc6b4, emissive: 0x8a8478, ei: 1, sil: 0x000000 },
};
const mats = {};
function snap(m) {
  // late-90s consoles had no sub-pixel precision: every vertex jumps to a coarse screen grid
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\n gl_Position.xy = floor(gl_Position.xy / gl_Position.w * vec2(160.0, 90.0) + 0.5) / vec2(160.0, 90.0) * gl_Position.w;');
  };
}
function M(kind, v = 0) {
  const key = kind + ':' + v;
  if (mats[key]) return mats[key];
  const s = SPEC[kind], color = s.colors ? s.colors[v % s.colors.length] : s.color;
  const map = s.tex && !SIL ? (TEXC[s.tex] ||= TEXGEN[s.tex]()) : null;
  let m;
  if (SIL) m = new THREE.MeshBasicMaterial({ color: s.sil ?? 0x000000 });
  else if (RETRO) { m = new THREE.MeshLambertMaterial({ color, map, emissive: s.emissive ?? 0, emissiveIntensity: s.ei ?? 1 }); snap(m); }
  else m = new THREE.MeshStandardMaterial({ color, map, roughness: s.rough ?? 0.9, metalness: s.metal ?? 0, emissive: s.emissive ?? 0, emissiveIntensity: s.ei ?? 1 });
  return mats[key] = m;
}

// ---------------------------------------------------------------- geometry helpers
const scene = new THREE.Scene();
function boxGeo(w, h, d, sc = 1) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / sc, uv.getY(i) * dims[f][1] / sc); }
  return g;
}
function add(mesh, parent, x, y, z) { mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; (parent || scene).add(mesh); return mesh; }
const box = (w, h, d, kind, x, y, z, parent, v = 0, sc = 1) => add(new THREE.Mesh(boxGeo(w, h, d, sc), M(kind, v)), parent, x, y, z);
const cyl = (rt, rb, h, kind, x, y, z, parent, seg = 8) => add(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), M(kind)), parent, x, y, z);
const sph = (r, kind, x, y, z, parent, sx = 1, sy = 1, sz = 1, seg = 10) => {
  const m = add(new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(6, (seg * 0.7) | 0)), M(kind)), parent, x, y, z); m.scale.set(sx, sy, sz); return m;
};
const cap = (r, len, kind, x, y, z, parent) => add(new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), M(kind)), parent, x, y, z);
const grp = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); (parent || scene).add(g); return g; };

// lights (none at all in the silhouette style: it's all fog and flat shapes)
function spot(x, y, z, tx, ty, tz, color, I, angle, dist, shadow = false, pen = 0.6) {
  if (SIL) return null;
  const s = new THREE.SpotLight(color, I, dist, angle, pen, 2); s.position.set(x, y, z); s.target.position.set(tx, ty, tz);
  scene.add(s, s.target);
  if (shadow && SHADOWS) { s.castShadow = true; s.shadow.mapSize.set(1024, 1024); s.shadow.bias = -0.0004; s.shadow.camera.near = 0.3; }
  return s;
}
function point(x, y, z, color, I, dist) { if (SIL) return null; const p = new THREE.PointLight(color, I, dist, 2); p.position.set(x, y, z); scene.add(p); return p; }
let GLOWTEX = null;
function glow(x, y, z, color, size, op = 1, fog = true) {
  if (!GLOWTEX) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); GLOWTEX = new THREE.CanvasTexture(c);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOWTEX, color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog }));
  s.position.set(x, y, z); s.scale.set(size, size, 1); scene.add(s); return s;
}

// ---------------------------------------------------------------- the street
// The road runs along z (toward -z is "toward home"); right side x > 0. Houses front onto it
// at |x| = 11 with front gardens behind a wall, a picket fence or a hedge.
const Z0 = 24, Z1 = -127, LEN = Z0 - Z1, ZC = (Z0 + Z1) / 2;
const LEFT = !SIL; // the side-on camera stands in the left-hand gardens
box(6, 0.1, LEN, 'asphalt', 0, -0.05, ZC, null, 0, 2);
for (let z = Z0; z > Z1; z -= 4.5) box(0.12, 0.012, 2, 'paint', 0, 0.006, z);
for (const sx of [-1, 1]) {
  box(0.22, 0.16, LEN, 'kerb', sx * 3.11, 0.03, ZC);
  box(2.0, 0.14, LEN, 'slab', sx * 4.2, 0.05, ZC);
  box(16, 0.1, LEN, 'grass', sx * 13.2, 0.02, ZC, null, 0, 2);
}
// the cross street at the end, and home beyond it
box(80, 0.1, 7, 'asphalt', 0, -0.049, -130.5, null, 0, 2);
box(80, 0.14, 2, 'slab', 0, 0.05, -135, null);
box(80, 0.1, 30, 'grass', 0, 0.02, -151, null, 0, 2);

function roofGeo(w, d, rh) {
  const sh = new THREE.Shape(); sh.moveTo(-d / 2 - 0.35, 0); sh.lineTo(d / 2 + 0.35, 0); sh.lineTo(0, rh); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: w + 0.5, bevelEnabled: false });
  g.translate(0, 0, -(w + 0.5) / 2); g.rotateY(Math.PI / 2);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.6, uv.getY(i) * 0.6);
  return g;
}
const lights = { window: 0 };
function windowAt(g, lx, ly, fz, state) {
  box(1.0, 1.25, 0.1, 'frame', lx, ly, fz, g);
  if (state === 'board') { box(1.0, 1.25, 0.12, 'board', lx, ly, fz + 0.02, g); for (const r of [-0.4, 0.4]) { const b = box(1.3, 0.16, 0.05, 'board', lx, ly, fz + 0.1, g); b.rotation.z = r; } return; }
  box(0.86, 1.1, 0.12, state === 'lit' ? 'glassLit' : state === 'tv' ? 'glassTv' : 'glassDark', lx, ly, fz + 0.005, g);
  box(0.06, 1.1, 0.13, 'frame', lx, ly, fz + 0.01, g);
  box(1.12, 0.07, 0.24, 'sill', lx, ly - 0.66, fz + 0.08, g);
  if (state === 'lit' || state === 'tv') {
    // a curtain half drawn, someone's home, nobody comes to the window
    box(0.32, 1.06, 0.03, 'door', lx - 0.26, ly, fz + 0.075, g, 1);
    g.updateMatrixWorld(true);
    const p = new THREE.Vector3(lx, ly, fz + 0.3).applyMatrix4(g.matrixWorld);
    glow(p.x, p.y, p.z, state === 'tv' ? 0x8fb4ff : 0xffb060, 1.6, 0.35);
    if (lights.window++ < 6) point(p.x, p.y, p.z, state === 'tv' ? 0x7aa0ff : 0xffa850, 1.6, 7);
  }
}
function house(x, z, rotY, o) {
  const g = grp(null, x, 0, z); g.rotation.y = rotY;
  const { w, d = 8, h, wall, wv, porch } = o, fz = d / 2;
  box(w, h, d, wall, 0, h / 2, 0, g, wv);
  const rh = o.rh ?? 2.6, roof = add(new THREE.Mesh(roofGeo(w, d, rh), M('roof', o.rv ?? 0)), g, 0, h, 0);
  roof.castShadow = true;
  box(0.7, 1.4, 0.7, wall, w * 0.28, h + rh * 0.55, -0.6, g, wv); // chimney
  const doorX = o.doorX ?? -w / 2 + 1.6;
  box(1.0, 2.15, 0.12, 'door', doorX, 1.075, fz + 0.02, g, o.dv ?? 0);
  box(1.7, 0.1, 0.9, 'sill', doorX, 2.45, fz + 0.45, g); // porch canopy
  box(0.14, 0.2, 0.1, porch ? 'porchGlass' : 'glassDark', doorX + 0.7, 2.15, fz + 0.08, g);
  if (porch) {
    g.updateMatrixWorld(true);
    const p = new THREE.Vector3(doorX + 0.7, 2.15, fz + 0.4).applyMatrix4(g.matrixWorld);
    glow(p.x, p.y, p.z, 0xffc070, o.home ? 3.2 : 1.4, o.home ? 0.9 : 0.6, !o.home);
    point(p.x, p.y, p.z, 0xffb050, o.home ? 14 : 3, o.home ? 14 : 7);
  }
  const ws = o.windows;
  const down = [doorX + 2.0, doorX + 3.8, doorX + 5.6].filter((x) => x < w / 2 - 0.7);
  for (const [k, lx] of down.entries()) windowAt(g, lx, 1.45, fz, ws[k] ?? 'dark');
  for (let k = 0, n = Math.max(2, Math.floor(w / 2.6)); k < n; k++) windowAt(g, -w / 2 + (k + 0.5) * w / n, h - 1.35, fz, ws[3 + k] ?? 'dark');
  return { g, doorX };
}
function wheelieBin(x, z, yaw, v = 0) {
  const g = grp(null, x, 0, z); g.rotation.y = yaw;
  box(0.58, 0.92, 0.7, 'bin', 0, 0.5, 0, g, v); box(0.62, 0.06, 0.78, 'bin', 0, 0.98, -0.02, g, v);
  for (const s of [-1, 1]) { const t = cyl(0.1, 0.1, 0.06, 'tyre', s * 0.27, 0.1, 0.3, g, 10); t.rotation.z = Math.PI / 2; }
  return g;
}
function bareTree(x, z, h) {
  const g = grp(null, x, 0, z);
  const branch = (parent, len, r, depth) => {
    const b = cyl(r * 0.6, r, len, 'bark', 0, len / 2, 0, parent, 5);
    if (depth === 0) return;
    const tip = grp(parent, 0, len, 0);
    for (let k = 0, n = depth > 1 ? 3 : 2; k < n; k++) {
      const c = grp(tip); c.rotation.set(0.5 + rnd() * 0.4, k * 2.1 + rnd(), 0, 'YXZ');
      branch(c, len * (0.6 + rnd() * 0.15), r * 0.6, depth - 1);
    }
    return b;
  };
  branch(g, h * 0.45, 0.16, 3);
  return g;
}
function picketRun(x, z0, z1, rotY = 0) {
  const n = Math.max(1, Math.floor(Math.abs(z1 - z0) / 0.16)), geo = boxGeo(0.07, 0.95, 0.03);
  const im = new THREE.InstancedMesh(geo, M('fence'), n), m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) { m.makeTranslation(x, 0.5 + (i % 2) * 0.03, z0 + (z1 - z0) * (i + 0.5) / n); im.setMatrixAt(i, m); }
  im.castShadow = im.receiveShadow = true; scene.add(im);
  box(0.04, 0.08, Math.abs(z1 - z0), 'fence', x - 0.03 * Math.sign(x), 0.75, (z0 + z1) / 2);
  box(0.04, 0.08, Math.abs(z1 - z0), 'fence', x - 0.03 * Math.sign(x), 0.3, (z0 + z1) / 2);
}
function frontage(side, z, doorZ) {
  // the garden boundary along the pavement, with a gap for the gate; a path up to the door
  const x = side * 5.3, kind = pick(['wall', 'wall', 'picket', 'hedge', 'none']);
  const runs = [[z - 6.5, doorZ - 0.7], [doorZ + 0.7, z + 6.5]];
  for (const [a, b] of runs) {
    if (b - a < 0.2) continue;
    if (kind === 'wall') { box(0.26, 0.6, b - a, 'brick', x, 0.3, (a + b) / 2, null, 0); box(0.32, 0.06, b - a, 'wallTop', x, 0.62, (a + b) / 2); }
    else if (kind === 'picket') picketRun(x, a, b);
    else if (kind === 'hedge') box(0.8, 1.25 + rnd() * 0.3, b - a, 'hedge', x + side * 0.3, 0.65, (a + b) / 2);
  }
  box(1.1, 0.03, 5.7, 'slab', side * 8.15, 0.08, doorZ).rotation.y = Math.PI / 2;
  return kind;
}

// both rows of houses
const RIGHT_Z = [2, -11, -24, -37, -50, -63, -76, -89, -102, -115], LEFT_Z = [-4.5, -17.5, -30.5, -43.5, -56.5, -69.5, -82.5, -95.5, -108.5, -121.5];
const plots = [];
for (const [side, zs] of [[1, RIGHT_Z], [-1, LEFT_Z]]) {
  if (side < 0 && !LEFT) continue;
  for (const z of zs) {
    const kind = pick(['brick', 'brick', 'render', 'siding']), wv = (rnd() * 3) | 0, w = 8 + rnd() * 2.4;
    const bungalow = rnd() < 0.12, boarded = rnd() < 0.1;
    const windows = Array.from({ length: 8 }, () => (boarded ? 'board' : rnd() < 0.08 ? 'lit' : rnd() < 0.04 ? 'tv' : 'dark'));
    const { doorX } = house(side * 15, z, side > 0 ? -Math.PI / 2 : Math.PI / 2, {
      w, h: bungalow ? 3.0 : 5.4 + rnd() * 0.4, wall: kind, wv, rv: (rnd() * 3) | 0, dv: (rnd() * 4) | 0, windows, porch: !boarded && rnd() < 0.15, rh: bungalow ? 2.2 : 2.6,
    });
    const doorZ = z + (side > 0 ? doorX : -doorX), fence = frontage(side, z, doorZ);
    plots.push({ side, z, doorZ, fence });
    if (rnd() < 0.45) bareTree(side * (7.4 + rnd() * 2), z + (rnd() - 0.5) * 6, 6 + rnd() * 3);
    if (rnd() < 0.6) wheelieBin(side * 5.85, doorZ + side * 1.4 * (rnd() < 0.5 ? 1 : -1), side > 0 ? Math.PI / 2 : -Math.PI / 2, (rnd() * 3) | 0);
  }
}
// home: across the T-junction at the very end, the porch light on
house(0, -142, 0, { w: 9, h: 5.6, wall: 'render', wv: 2, windows: ['dark', 'dark', 'dark', 'lit', 'dark', 'dark'], porch: true, home: true, doorX: 0 });

// street lamps (sodium orange) and telegraph poles with sagging wires
const LAMPS = { retro: [[1, -4, 'on'], [1, -28, 'dead'], [1, -52, 'on'], [1, -76, 'on'], [1, -100, 'dead'], [1, -118, 'on'], [-1, -16, 'on'], [-1, -40, 'dim'], [-1, -64, 'dead'], [-1, -88, 'on'], [-1, -112, 'on']] };
LAMPS.diorama = [[1, -15, 'on'], [1, -40, 'on'], [1, -64, 'dead'], [-1, -2, 'on'], [-1, -28, 'dim'], [-1, -52, 'on']];
LAMPS.torch = [[1, -4, 'dead'], [1, -28, 'dead'], [1, -52, 'on'], [-1, -16, 'dead'], [-1, -40, 'dim'], [-1, -64, 'dead']];
LAMPS.silhouette = [[-1, -16, 'on'], [-1, -40, 'dead'], [-1, -58, 'on'], [-1, -76, 'on']];
let shadowLamps = 0;
for (const [side, z, st] of LAMPS[STYLE]) {
  const x = side * 5.0, hx = x - side * 1.15;
  cyl(0.07, 0.1, 5.9, 'pole', x, 2.95, z);
  box(1.25, 0.07, 0.07, 'pole', x - side * 0.6, 5.85, z);
  box(0.55, 0.14, 0.26, 'pole', hx, 5.8, z);
  box(0.46, 0.05, 0.2, st === 'dead' ? 'glassDark' : 'lampGlass', hx, 5.72, z);
  if (st === 'dead') continue;
  const I = st === 'dim' ? 0.3 : 1;
  spot(hx, 5.6, z, hx - side * 0.6, 0, z, 0xff9c45, (TORCH ? 40 : 70) * I, 0.95, 20, DIO && shadowLamps++ < 2, 0.75);
  glow(hx, 5.62, z, 0xffa04a, (RETRO ? 1.5 : DIO ? 1.1 : 2.6) * (0.5 + I / 2), 0.8 * I);
}
for (let z = 14; z > Z1; z -= 32) {
  const x = 5.65, p = cyl(0.11, 0.13, 8.5, 'wood', x, 4.25, z); p.castShadow = true;
  box(0.1, 0.1, 1.6, 'wood', x, 8.0, z).rotation.y = Math.PI / 2;
  if (z - 32 <= Z1) break;
  for (const dx of [-0.6, 0, 0.6]) {
    const pts = [];
    for (let k = 0; k <= 16; k++) { const t = k / 16; pts.push(new THREE.Vector3(x + dx, 8.08 - Math.sin(t * Math.PI) * 0.9, z - t * 32)); }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: SIL ? 0x000000 : 0x15171a })));
  }
}

// ---------------------------------------------------------------- vehicles
function car(x, z, yaw) {
  const g = grp(null, x, 0, z); g.rotation.y = yaw;
  box(1.75, 0.62, 4.2, 'car', 0, 0.55, 0, g); box(1.55, 0.55, 2.1, 'carGlass', 0, 1.12, 0.25, g); box(1.5, 0.08, 2.0, 'car', 0, 1.42, 0.25, g);
  for (const sx of [-1, 1]) for (const sz of [-1.35, 1.35]) { const t = cyl(0.32, 0.32, 0.22, 'tyre', sx * 0.82, 0.32, sz, g, 12); t.rotation.z = Math.PI / 2; }
  return g;
}
function van(x, z, yaw, on) {
  const g = grp(null, x, 0, z); g.rotation.y = yaw;
  box(1.95, 1.85, 3.6, 'van', 0, 1.3, 0.7, g); box(1.95, 1.15, 1.3, 'van', 0, 0.95, -1.75, g);
  const ws = box(1.85, 0.6, 0.08, 'carGlass', 0, 1.82, -1.12, g); ws.rotation.x = -0.35;
  box(0.08, 0.5, 0.9, 'carGlass', 0.98, 1.75, -0.65, g); box(0.08, 0.5, 0.9, 'carGlass', -0.98, 1.75, -0.65, g);
  // the driver, a shape leaning to look out at the pavement
  sph(0.13, 'entity', 0.45, 1.78, -0.6, g); box(0.5, 0.45, 0.3, 'entity', 0.42, 1.45, -0.5, g);
  for (const sx of [-1, 1]) for (const sz of [-1.6, 1.4]) { const t = cyl(0.36, 0.36, 0.24, 'tyre', sx * 0.9, 0.36, sz, g, 12); t.rotation.z = Math.PI / 2; }
  for (const sx of [-0.7, 0.7]) box(0.32, 0.16, 0.06, on ? 'head' : 'glassDark', sx, 0.95, -2.42, g);
  for (const sx of [-0.85, 0.85]) box(0.14, 0.28, 0.05, 'rear', sx, 1.0, 2.52, g);
  g.updateMatrixWorld(true);
  if (on) for (const sx of [-0.7, 0.7]) {
    const p = new THREE.Vector3(sx, 0.95, -2.5).applyMatrix4(g.matrixWorld), t = new THREE.Vector3(sx * 2.5, 0, -16).applyMatrix4(g.matrixWorld);
    spot(p.x, p.y, p.z, t.x, t.y, t.z, 0xfff0d6, 160, 0.42, 34, sx > 0, 0.5);
    glow(p.x, p.y, p.z, 0xffffff, DIO ? 0.7 : 1.4, 0.9);
  }
  return g;
}

// ---------------------------------------------------------------- the boy, the puppy, the follower
// A small boy, about seven: navy parka, red bobble hat and red wellies, school backpack. Facing -z.
function boy(pose) {
  const root = grp(), pel = grp(root, 0, 0.5, 0), torso = grp(pel), legs = [], arms = [];
  for (const s of [-1, 1]) {
    const hip = grp(pel, s * 0.075, 0, 0); box(0.12, 0.24, 0.13, 'jeans', 0, -0.11, 0, hip);
    const knee = grp(hip, 0, -0.22, 0); box(0.125, 0.16, 0.135, 'boots', 0, -0.13, 0, knee); box(0.11, 0.1, 0.12, 'jeans', 0, -0.03, 0, knee);
    box(0.13, 0.06, 0.2, 'boots', 0, -0.23, -0.03, knee);
    legs.push({ hip, knee });
  }
  const coat = cap(0.17, 0.2, 'coat', 0, 0.2, 0, torso); coat.scale.set(1, 1, 0.8);
  box(0.36, 0.1, 0.28, 'coat', 0, -0.02, 0, torso);
  box(0.25, 0.3, 0.12, 'bag', 0, 0.24, 0.17, torso);
  sph(0.11, 'coat', 0, 0.42, 0.08, torso, 1.25, 0.6, 0.9);
  const head = grp(torso, 0, 0.58, 0);
  sph(0.145, 'skin', 0, 0, 0, head, 1, 1.03, 1, 16);
  sph(0.15, 'hair', 0, 0.01, 0.03, head, 1.02, 0.95, 0.95, 12);
  sph(0.153, 'beanie', 0, 0.05, 0.005, head, 1, 0.82, 1, 16);
  cyl(0.156, 0.156, 0.05, 'beanie', 0, 0.02, 0.005, head, 16);
  sph(0.045, 'beanie', 0, 0.2, 0.01, head);
  for (const s of [-1, 1]) sph(0.018, 'eye', s * 0.052, -0.015, -0.135, head);
  for (const s of [-1, 1]) {
    const sh = grp(torso, s * 0.2, 0.33, 0); cap(0.05, 0.22, 'coat', 0, -0.15, 0, sh); sph(0.045, 'skin', 0, -0.31, 0, sh);
    arms.push(sh);
  }
  const hand = new THREE.Object3D(); hand.position.set(0, -0.33, 0); arms[1].add(hand);
  const carry = (lean = 0) => { for (const [k, sh] of arms.entries()) { sh.rotation.set(1.15 - lean, 0, (k ? -1 : 1) * 0.45); } };
  if (pose === 'walk') {
    legs[0].hip.rotation.x = 0.35; legs[1].hip.rotation.x = -0.28; legs[1].knee.rotation.x = -0.4;
    arms[1].rotation.set(0.7, 0, -0.15); arms[0].rotation.x = -0.25; head.rotation.set(-0.12, -0.25, 0);
  } else if (pose === 'crouch') {
    pel.position.y = 0.27; for (const L of legs) { L.hip.rotation.x = 1.55; L.knee.rotation.x = -2.5; }
    legs[0].hip.rotation.z = 0.15; legs[1].hip.rotation.z = -0.15;
    torso.rotation.x = -0.3; carry(); head.rotation.set(0.25, -0.7, 0);
  } else if (pose === 'run') {
    pel.position.y = 0.47; torso.rotation.x = -0.32;
    legs[0].hip.rotation.x = 0.95; legs[0].knee.rotation.x = -0.35; legs[1].hip.rotation.x = -0.55; legs[1].knee.rotation.x = -1.35;
    carry(); head.rotation.set(0.2, 0.95, 0);
  }
  return { root, hand, torso };
}
// A puppy: cream fluff, toffee ears, red collar. Facing -z.
function puppy(pose, lookYaw = 0) {
  const root = grp(), body = grp(root), ears = [];
  const b = cap(0.105, 0.17, 'dog', 0, 0.22, 0, body); b.rotation.x = Math.PI / 2;
  sph(0.1, 'dog', 0, 0.25, -0.1, body, 1, 1.05, 1);
  for (const fx of [-1, 1]) for (const fz of [-1, 1]) { cyl(0.032, 0.028, 0.17, 'dog', fx * 0.062, 0.085, fz * 0.1, body, 6); sph(0.036, 'dog', fx * 0.062, 0.025, fz * 0.1 - 0.012, body); }
  const head = grp(body, 0, 0.33, -0.16);
  sph(0.105, 'dog', 0, 0.04, -0.03, head, 1.05, 1, 1, 14);
  sph(0.062, 'dog', 0, -0.005, -0.115, head, 0.9, 0.75, 1.05);
  sph(0.024, 'nose', 0, 0.02, -0.18, head);
  for (const s of [-1, 1]) { sph(0.02, 'eye', s * 0.044, 0.065, -0.11, head); sph(0.007, 'eyeHi', s * 0.044 + 0.006, 0.074, -0.127, head); }
  for (const s of [-1, 1]) { const e = grp(head, s * 0.08, 0.1, -0.02); sph(0.036, 'dogDark', s * 0.012, -0.055, 0, e, 0.6, 1.7, 1.1); ears.push(e); }
  const tail = grp(body, 0, 0.27, 0.17); cap(0.026, 0.1, 'dog', 0, 0.07, 0, tail);
  const col = add(new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.014, 6, 14), M('collar')), body, 0, 0.29, -0.13); col.rotation.x = Math.PI / 2 - 0.5;
  const collar = new THREE.Object3D(); collar.position.set(0, 0.33, -0.11); body.add(collar);
  tail.rotation.x = 0.5;
  if (pose === 'sniff') { head.position.y = 0.24; head.rotation.x = -0.6; }
  else if (pose === 'alert') { head.rotation.set(0.2, lookYaw, 0); for (const [k, e] of ears.entries()) e.rotation.z = (k ? 1 : -1) * 0.9; tail.rotation.x = 0.15; }
  else if (pose === 'scared') { body.rotation.x = 0.2; body.position.y = -0.03; head.rotation.set(-0.15, lookYaw, 0); for (const e of ears) e.rotation.x = 0.9; tail.rotation.x = 2.6; }
  else if (pose === 'carried') { head.rotation.set(0.35, lookYaw, 0); tail.rotation.x = 2.2; }
  return { root, collar, head };
}
// The thing that follows you: too tall, too thin, arms down past its knees. Some nights a face.
function follower(face, reach = 0) {
  const r = grp();
  for (const s of [-1, 1]) {
    const hip = grp(r, s * 0.11, 1.38, 0); hip.rotation.set(0.32, 0, s * 0.04);
    cyl(0.065, 0.04, 0.7, 'entity', 0, -0.35, 0, hip, 6);
    const knee = grp(hip, 0, -0.68, 0); knee.rotation.x = -0.62; cyl(0.04, 0.022, 0.74, 'entity', 0, -0.37, 0, knee, 6);
    box(0.07, 0.04, 0.26, 'entity', 0, -0.74, -0.08, knee);
  }
  const spine = grp(r, 0, 1.36, 0); spine.rotation.x = -0.32;
  const t = cap(0.14, 0.58, 'entity', 0, 0.42, 0, spine); t.scale.set(1.15, 1, 0.6);
  for (const s of [-1, 1]) {
    const sh = grp(spine, s * 0.24, 0.78, 0); sh.rotation.set(reach, 0, s * 0.08);
    cyl(0.04, 0.03, 0.72, 'entity', 0, -0.36, 0, sh, 6);
    const el = grp(sh, 0, -0.72, 0); el.rotation.x = 0.35 + reach * 0.15; cyl(0.03, 0.02, 0.78, 'entity', 0, -0.39, 0, el, 6);
    for (let f = 0; f < 4; f++) { const fg = cyl(0.009, 0.004, 0.26, 'entity', (f - 1.5) * 0.022, -0.9, 0, el, 4); fg.rotation.set(0.25, 0, (f - 1.5) * 0.12); }
  }
  const neck = grp(spine, 0, 0.92, 0); neck.rotation.x = -0.55; cyl(0.035, 0.03, 0.34, 'entity', 0, 0.17, 0, neck, 6);
  const head = grp(neck, 0, 0.38, -0.02); head.rotation.set(0.55, 0, -0.42);
  sph(0.115, 'entity', 0, 0.02, 0, head, 0.85, 1.25, 0.9);
  if (face) sph(0.1, 'face', 0, 0.0, -0.055, head, 0.75, 1.12, 0.45);
  return r;
}
function leash(a, b, sag) {
  const mid = a.clone().lerp(b, 0.5); mid.y -= sag;
  const curve = new THREE.CatmullRomCurve3([a, a.clone().lerp(mid, 0.55).setY(a.y - sag * 0.7), mid, mid.clone().lerp(b, 0.45).setY(b.y - sag * 0.6), b]);
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, RETRO ? 0.016 : 0.009, 5), M('leash')));
}
const yawTo = (px, pz, tx, tz) => Math.atan2(-(tx - px), -(tz - pz));
function place(o, x, y, z, yaw = 0) { o.position.set(x, y, z); o.rotation.y = yaw; }

// ---------------------------------------------------------------- composition, per style
const camera = new THREE.PerspectiveCamera(60, W / H, 0.05, 400);
let post = 0;
if (RETRO) {
  // behind the boy at a child's eye height. Puppy out ahead, ears up, staring at something under the flickering lamp.
  scene.background = new THREE.Color(0x07090f); scene.fog = new THREE.FogExp2(0x07090f, 0.05);
  scene.add(new THREE.HemisphereLight(0x51648c, 0x0c0b10, 1.3));
  car(-2.15, -21, 0.03);
  const B = boy('walk'); place(B.root, 4.15, 0.12, 0, 0.08);
  const ex = 3.65, ez = -10.6, ent = follower(true); place(ent, ex, 0.12, ez, yawTo(ex, ez, 4.2, 0)); window.__ent = ent;
  const D = puppy('alert'); const dx = 4.75, dz = -1.6, dy = yawTo(dx, dz, ex, ez); place(D.root, dx, 0.12, dz, dy + 0.5);
  D.head.rotation.y = -0.45;
  scene.updateMatrixWorld(true); leash(B.hand.getWorldPosition(new THREE.Vector3()), D.collar.getWorldPosition(new THREE.Vector3()), 0.12);
  camera.fov = 56; camera.position.set(5.15, 1.1, 2.3); camera.lookAt(3.2, 1.0, -9);
  post = 0;
} else if (DIO) {
  // a miniature street at an angle from above. He's crouched behind a wheelie bin with the puppy in his arms;
  // a van crawls up the road toward him with the driver leaning to look along the gardens.
  scene.background = new THREE.Color(0x0b1418); scene.fog = new THREE.Fog(0x0b1418, 26, 80);
  scene.add(new THREE.HemisphereLight(0x5a7a88, 0x101412, 1.4));
  const moon = new THREE.DirectionalLight(0x9ab8d8, 0.35); moon.position.set(-30, 40, 20); moon.castShadow = true;
  Object.assign(moon.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, far: 120 }); moon.shadow.mapSize.set(2048, 2048); scene.add(moon, moon.target);
  car(-2.15, -21, 0.03);
  wheelieBin(5.9, -8.3, Math.PI / 2, 0); wheelieBin(5.9, -9.05, Math.PI / 2, 1);
  const B = boy('crouch'); place(B.root, 6.75, 0.08, -8.7, yawTo(6.75, -8.7, 3, -12));
  const D = puppy('carried', 0.6); B.torso.add(D.root); D.root.position.set(0, 0.06, -0.25); D.root.scale.setScalar(0.95);
  van(1.5, -18, Math.PI, true);
  camera.fov = 30; camera.position.set(-2.5, 8.5, -0.5); camera.lookAt(5.6, 0.4, -11.0);
  post = 1;
} else if (TORCH) {
  // from high above: every lamp dead but one, far ahead. The torch beam. The puppy has stopped and is pulling back.
  scene.background = new THREE.Color(0x000000); scene.fog = new THREE.Fog(0x000000, 17, 34);
  scene.add(new THREE.HemisphereLight(0x3a4a66, 0x050505, 0.8));
  car(-2.15, -21, 0.03);
  const bx = 4.0, bz = -20;
  const B = boy('walk'); place(B.root, bx, 0.12, bz, 0.12);
  const D = puppy('scared'); const dx = 4.55, dz = -18.6; place(D.root, dx, 0.12, dz, Math.PI + 0.3); D.head.rotation.y = 2.6;
  const ent = follower(false, 0.15); place(ent, 4.5, 0.12, -26.0, yawTo(4.5, -26.0, bx, bz));
  scene.updateMatrixWorld(true);
  const h = B.hand.getWorldPosition(new THREE.Vector3());
  leash(h, D.collar.getWorldPosition(new THREE.Vector3()), 0.02);
  spot(h.x, h.y + 0.1, h.z - 0.1, bx + 0.4, 0.4, bz - 6.5, 0xfff2d8, 160, 0.4, 30, true, 0.35);
  point(h.x, h.y + 0.4, h.z + 0.3, 0xfff2d8, 1.2, 4);
  glow(h.x - 0.03, h.y + 0.1, h.z - 0.15, 0xfff2d8, 0.45, 0.9);
  camera.fov = 44; camera.position.set(2.4, 10.5, -12.0); camera.lookAt(4.5, 0, -24.0);
  post = 2;
} else {
  // side-on: he runs left along the near pavement carrying the puppy; the thing is right behind, reaching.
  const sky = tex(256, (g, s) => { const gr = g.createLinearGradient(0, 0, 0, s); gr.addColorStop(0, '#3f4a50'); gr.addColorStop(0.62, '#a3aca8'); gr.addColorStop(1, '#c4c8c0'); g.fillStyle = gr; g.fillRect(0, 0, s, s); });
  sky.wrapS = sky.wrapT = THREE.ClampToEdgeWrapping; scene.background = sky;
  scene.fog = new THREE.Fog(0xa3aca8, 16, 70);
  // layers of town behind the street: roofs, trees, a water tower, all fading into the fog
  for (const [x0, n] of [[30, 16], [46, 14], [64, 12]]) {
    for (let k = 0; k < n; k++) {
      const z = 10 - k * 11 - rnd() * 5;
      if (rnd() < 0.3) bareTree(x0 + rnd() * 4, z, 8 + rnd() * 5);
      else house(x0 + rnd() * 3, z, -Math.PI / 2, { w: 7 + rnd() * 3, h: 5 + rnd() * 3, wall: 'brick', windows: Array.from({ length: 8 }, () => (rnd() < 0.12 ? 'lit' : 'dark')), rh: 2 + rnd() * 2 });
    }
  }
  const tw = grp(null, 50, 0, -62); for (const s of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl(0.15, 0.2, 16, 'pole', s[0] * 1.6, 8, s[1] * 1.6, tw);
  cyl(3, 3, 3.6, 'pole', 0, 17.5, 0, tw, 16); add(new THREE.Mesh(new THREE.ConeGeometry(3.2, 1.6, 16), M('pole')), tw, 0, 20.1, 0);
  for (let z = 10; z > -110; z -= 3 + rnd() * 5) { const t = box(0.04, 0.35 + rnd() * 0.5, 0.04, 'entity', -6.3 + rnd(), 0.2, z); t.rotation.z = (rnd() - 0.5) * 0.6; }
  const bx = -4.2, bz = -50;
  const B = boy('run'); place(B.root, bx, 0.12, bz, Math.PI / 2 + 0.25);
  B.root.rotation.y = 0; // running toward -z = screen left
  const D = puppy('carried', -0.6); B.torso.add(D.root); D.root.position.set(0, 0.07, -0.25);
  const ent = follower(false, 1.1); place(ent, -4.35, 0.12, -47.0, 0);
  camera.fov = 24; camera.position.set(-23, 1.5, -49.4); camera.lookAt(-4.2, 2.9, -49.4);
  post = 3;
}

// ---------------------------------------------------------------- render: scene into a target, then one grading pass
camera.updateProjectionMatrix();
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H); document.body.appendChild(renderer.domElement);
renderer.shadowMap.enabled = SHADOWS; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const LOW = RETRO ? [320, 180] : [W, H];
const rt = new THREE.WebGLRenderTarget(LOW[0], LOW[1], {
  type: THREE.HalfFloatType, samples: RETRO ? 0 : 4,
  magFilter: RETRO ? THREE.NearestFilter : THREE.LinearFilter, minFilter: RETRO ? THREE.NearestFilter : THREE.LinearFilter,
});
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  uniforms: { tScene: { value: rt.texture }, uRes: { value: new THREE.Vector2(W, H) }, uLow: { value: new THREE.Vector2(...LOW) }, uMode: { value: post } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
  fragmentShader: /* glsl */`
    uniform sampler2D tScene; uniform vec2 uRes, uLow; uniform int uMode; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    float bayer4(vec2 p){ int i = int(mod(p.x, 4.)) + int(mod(p.y, 4.)) * 4;
      float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.); return m[i] / 16.; }
    vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0., 1.); }
    void main(){
      vec2 uv = vUv; vec3 c = vec3(0.);
      if (uMode == 1) { // tilt-shift: sharp band through the middle, the rest out of focus like a model village
        float b = smoothstep(0.1, 0.42, abs(uv.y - 0.42)) * 8.;
        for (int i = 0; i < 24; i++) { float a = float(i) * 2.39996, r = sqrt(float(i) + 0.5) / 4.9; c += texture2D(tScene, uv + vec2(cos(a), sin(a)) * r * b / uRes).rgb; }
        c /= 24.;
      } else c = texture2D(tScene, uv).rgb;
      if (uMode == 0) { // 5-bit colour with ordered dither, on the low-res pixel grid
        c = pow(clamp(c * 1.15, 0., 1.), vec3(1. / 2.2));
        c = floor(c * 31. + bayer4(floor(uv * uLow)) ) / 31.;
      } else if (uMode == 3) c = pow(clamp(c, 0., 1.), vec3(1. / 2.2));
      else c = pow(aces(c * 1.2), vec3(1. / 2.2));
      if (uMode == 1) { float l = dot(c, vec3(.299, .587, .114)); c = mix(c, c * vec3(0.78, 1.0, 1.1), (1. - l) * 0.7); c *= mix(vec3(1.), vec3(1.1, 1.0, 0.86), l); }
      vec2 q = uv - 0.5; q.x *= 0.9;
      c *= clamp(1. - dot(q, q) * (uMode == 2 ? 2.8 : uMode == 0 ? 1.4 : 1.7), 0., 1.);
      c += (hash(floor(uv * uRes) + 0.37) - 0.5) * (uMode == 0 ? 0. : uMode == 2 ? 0.08 : 0.045);
      gl_FragColor = vec4(c, 1.);
    }`,
}));
const postScene = new THREE.Scene(); postScene.add(quad);
const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
function frame() {
  renderer.setRenderTarget(rt); renderer.render(scene, camera);
  renderer.setRenderTarget(null); renderer.render(postScene, ortho);
}
frame();
requestAnimationFrame(() => { frame(); requestAnimationFrame(() => { frame(); document.body.dataset.ready = '1'; }); });
window.__proj = () => { const v = new THREE.Vector3(); window.__ent.updateMatrixWorld(true); window.__ent.getWorldPosition(v); v.y += 2.2; const w = v.clone(); v.project(camera); return [v.x, v.y, w.x, w.z]; };
window.__THREE = THREE; window.__scene = scene;
window.__shot = () => renderer.domElement.toDataURL('image/png');
