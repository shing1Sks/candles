// A CAR. An old British saloon, the kind that sat outside every house in the 1970s: a long bonnet
// that curves down at the nose, a boot, a glasshouse of thin pillars, chrome bumpers, round lamps,
// a yellow plate at the back and a white one at the front, wing mirrors on stalks. Built from
// extruded side profiles (bevelled, so every edge is soft), in the car's own frame: front toward -z.
// Returns parts as [geometry, material key, colour (null = the body colour)] for the kit, or meshes.
import * as THREE from 'three';
import { box, cyl, xf } from './kit.js';

function profile(pts, w, bevel = 0.06) {
  const sh = new THREE.Shape(); pts.forEach(([z, y], i) => (i ? sh.lineTo(z, y) : sh.moveTo(z, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: w - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 6 });
  // the shape is in (x, y) with depth along z: turn it so the length runs along z and the width along x
  g.rotateY(-Math.PI / 2); g.translate((w - bevel * 2) / 2, 0, 0);
  return g;
}
// points along an arc (for wheel arches and the curve of the nose)
const arc = (cz, cy, r, a0, a1, n = 8) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cz + Math.cos(a) * r, cy + Math.sin(a) * r]; });

export function carParts(len = 4.1, w = 1.66, opts = {}) {
  const P = [], half = len / 2, wb = half - 0.78, wr = 0.36;
  // the lower body: nose, bonnet, (the cabin sits on top), boot, tail; arches cut up round the wheels
  const lower = [
    [-half, 0.32], [-half, 0.6], ...arc(-half + 0.16, 0.6, 0.16, Math.PI, Math.PI / 2, 4), [-half + 0.9, 0.84], [half - 0.7, 0.86], [half - 0.12, 0.84], ...arc(half - 0.12, 0.72, 0.12, Math.PI / 2, 0, 3), [half, 0.32],
    ...arc(wb, 0.3, wr + 0.06, 0, Math.PI, 8), [-wb + wr + 0.06, 0.32], ...arc(-wb, 0.3, wr + 0.06, 0, Math.PI, 8),
  ];
  P.push([profile(lower, w, 0.07), 'carpaint', null]);
  // the glasshouse: windscreen raked back, roof, rear window; slightly narrower than the body
  const cab = [[-half + 1.02, 0.86], [-half + 1.62, 1.32], [half - 1.25, 1.34], [half - 0.72, 0.88]];
  const glass = profile(cab, w * 0.86, 0.04); glass.translate(0, -0.005, 0);
  P.push([glass, 'gutter', 0x0c0e12]);
  // the roof and the pillars, body colour, standing proud of the glass
  P.push([xf(profile([[-half + 1.6, 1.31], [-half + 1.66, 1.37], [half - 1.28, 1.39], [half - 1.24, 1.33]], w * 0.88, 0.03), 0, 0, 0), 'carpaint', null]);
  for (const sx of [-1, 1]) {
    const x = sx * (w * 0.43 + 0.008);
    // A pillar (along the windscreen's edge), B pillar (the middle), C pillar (the back)
    const a = box(0.06, 0.62, 0.07); a.rotateX(-0.66); P.push([xf(a, x, 1.09, -half + 1.32), 'carpaint', null]);
    P.push([xf(box(0.06, 0.48, 0.1), x, 1.1, -0.05), 'carpaint', null]);
    const c = box(0.06, 0.6, 0.14); c.rotateX(0.7); P.push([xf(c, x, 1.1, half - 0.98), 'carpaint', null]);
    // a door seam and a chrome handle
    P.push([xf(box(0.012, 0.42, 0.02), sx * (w / 2 + 0.002), 0.6, -0.08), 'dark', 0x050505]);
    P.push([xf(box(0.02, 0.03, 0.14), sx * (w / 2 + 0.01), 0.74, 0.1), 'metal', 0xc8c8d0]);
    // a wing mirror on its stalk
    P.push([xf(box(0.08, 0.02, 0.02), sx * (w / 2 + 0.04), 0.9, -half + 1.15), 'metal', 0xc0c0c8]);
    P.push([xf(box(0.04, 0.08, 0.1), sx * (w / 2 + 0.09), 0.93, -half + 1.15), 'metal', 0xb0b0b8]);
    // a chrome strip along the side
    P.push([xf(box(0.01, 0.018, len - 0.5), sx * (w / 2 + 0.004), 0.66, 0), 'metal', 0xb8b8c0]);
  }
  // bumpers: chrome bars, a little wider than the car
  for (const sz of [-1, 1]) P.push([xf(box(w + 0.06, 0.1, 0.1), 0, 0.42, sz * (half + 0.03)), 'metal', 0xc0c0c8]);
  // wheels: a black tyre, a chrome hubcap
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const t = cyl(wr, wr, 0.2, 18); t.rotateZ(Math.PI / 2); P.push([xf(t, sx * (w / 2 - 0.1), wr, sz * wb), 'dark', 0x0a0a0a]);
    const h = cyl(0.16, 0.16, 0.22, 14); h.rotateZ(Math.PI / 2); P.push([xf(h, sx * (w / 2 - 0.09), wr, sz * wb), 'metal', 0xa8a8b0]);
  }
  // lamps: round headlamps and a grille at the front; red lamps at the back; the number plates
  for (const sx of [-1, 1]) {
    const h = cyl(0.09, 0.09, 0.06, 14); h.rotateX(Math.PI / 2); P.push([xf(h, sx * 0.55, 0.62, -half - 0.01), 'plastic', opts.headlamps ?? 0xd8d4c0]);
    P.push([xf(box(0.26, 0.11, 0.04), sx * 0.56, 0.66, half + 0.005), 'plastic', 0x7a1610]);
  }
  P.push([xf(box(0.62, 0.16, 0.03), 0, 0.6, -half - 0.01), 'dark', 0x111114]);
  P.push([xf(box(0.52, 0.11, 0.02), 0, 0.44, -half - 0.06), 'plastic', 0xe8e4d8]);
  P.push([xf(box(0.52, 0.11, 0.02), 0, 0.56, half + 0.03), 'plastic', 0xd8b020]);
  return P;
}

// the same car as a group of meshes (for cars that move): shared materials per key
const MATS = {};
function mat(key, color) {
  const k = key + ':' + color;
  return MATS[k] ||= new THREE.MeshStandardMaterial({ color, roughness: key === 'gutter' ? 0.08 : key === 'metal' ? 0.25 : key === 'carpaint' ? 0.32 : 0.6, metalness: key === 'metal' ? 0.8 : 0.0 });
}
export function carMeshes(color, len, w, opts) {
  const g = new THREE.Group();
  for (const [geo, key, c] of carParts(len, w, opts)) { const m = new THREE.Mesh(geo, mat(key, c ?? color)); m.castShadow = true; m.receiveShadow = true; g.add(m); }
  return g;
}

// THE ICE-CREAM VAN. A tall old Bedford: a short snub bonnet, a raked windscreen, the body behind
// the cab stepping up high and boxy, two-tone (faded pink and cream), a serving hatch on the kerb
// side with a striped awning, a cone on the roof. Front toward -z, kerb side +x.
export function vanMeshes() {
  const g = new THREE.Group(), cream = mat('carpaint', 0xd8d0bc), pink = mat('carpaint', 0xc8889a), glassM = mat('gutter', 0x0a0c10), chrome = mat('metal', 0xc0c0c8), black = mat('dark', 0x0c0c0c);
  const add = (geo, m) => { const o = new THREE.Mesh(geo, m); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
  const w = 2.0, half = 2.4, wb = 1.55, wr = 0.38;
  const body = [[-half, 0.36], [-half, 0.8], ...arc(-half + 0.2, 0.8, 0.2, Math.PI, Math.PI / 2, 4), [-half + 0.55, 1.08], [-half + 0.95, 1.95], [-half + 1.3, 2.02], [-half + 1.42, 2.5], ...arc(half - 0.18, 2.5, 0.18, Math.PI / 2, 0, 4), [half, 0.36],
    ...arc(wb, 0.36, wr + 0.07, 0, Math.PI, 8), [-wb + wr + 0.07, 0.36], ...arc(-wb + 0.15, 0.36, wr + 0.07, 0, Math.PI, 8)];
  add(profile(body, w, 0.08), cream);
  // the pink lower half: a skirt of the same profile, clipped by a slightly wider band
  const skirt = profile([[-half + 0.3, 0.42], [-half + 0.3, 0.95], [half - 0.05, 0.95], [half - 0.05, 0.42]], w + 0.06, 0.03); add(skirt, pink);
  // windscreen, side windows of the cab
  const ws = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.3, 0.8), glassM); ws.position.set(0, 1.55, -half + 0.77); ws.rotation.x = 0.66; ws.rotation.y = Math.PI; g.add(ws);
  for (const sx of [-1, 1]) { const sw = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), glassM); sw.position.set(sx * (w / 2 + 0.005), 1.55, -half + 1.15); sw.rotation.y = sx * Math.PI / 2; g.add(sw); }
  // bumpers, wheels, lamps
  for (const sz of [-1, 1]) add(xf(box(w + 0.08, 0.12, 0.12), 0, 0.46, sz * (half + 0.03)), chrome);
  for (const sx of [-1, 1]) for (const sz of [-wb + 0.15, wb]) { const t = cyl(wr, wr, 0.24, 18); t.rotateZ(Math.PI / 2); add(xf(t, sx * (w / 2 - 0.12), wr, sz), black); const hc = cyl(0.17, 0.17, 0.26, 14); hc.rotateZ(Math.PI / 2); add(xf(hc, sx * (w / 2 - 0.11), wr, sz), chrome); }
  const lights = []; for (const sx of [-1, 1]) { const h = new THREE.Mesh(new THREE.CircleGeometry(0.12, 14), new THREE.MeshBasicMaterial({ color: 0x222222 })); h.position.set(sx * 0.68, 0.88, -half - 0.015); h.rotation.y = Math.PI; g.add(h); lights.push(h); }
  // the hatch on the kerb side (+x), lit; a striped awning over it; a dark shape inside
  const hatch = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.85), new THREE.MeshBasicMaterial({ color: 0xffe0a0 })); hatch.position.set(w / 2 + 0.01, 1.65, 0.6); hatch.rotation.y = Math.PI / 2; g.add(hatch);
  const sc = document.createElement('canvas'); sc.width = 64; sc.height = 8; const s2 = sc.getContext('2d'); for (let i = 0; i < 8; i++) { s2.fillStyle = i % 2 ? '#e8e0d0' : '#c84858'; s2.fillRect(i * 8, 0, 8, 8); }
  const awn = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.5), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(sc), roughness: 0.9, side: THREE.DoubleSide })); awn.position.set(w / 2 + 0.22, 2.2, 0.6); awn.rotation.set(0, Math.PI / 2, 0); awn.rotateX(-0.9); g.add(awn);
  const man = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.4, 4, 10), mat('dark', 0x0a0a0c)); man.position.set(0.55, 1.5, 0.6); g.add(man);
  const mh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), mat('dark', 0x0a0a0c)); mh.position.set(0.57, 2.05, 0.6); g.add(mh);
  // ICES on the front above the windscreen, and the cone on the roof
  const ic = document.createElement('canvas'); ic.width = 128; ic.height = 32; const i2 = ic.getContext('2d'); i2.fillStyle = '#e8e0d0'; i2.fillRect(0, 0, 128, 32); i2.fillStyle = '#b83848'; i2.font = 'bold 26px Georgia'; i2.textAlign = 'center'; i2.fillText('ICES', 64, 26);
  const ices = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.25), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(ic), roughness: 0.6 })); ices.position.set(0, 2.3, -half + 1.05 - 0.02); ices.rotation.y = Math.PI; g.add(ices);
  const cone = add(new THREE.ConeGeometry(0.2, 0.62, 12), mat('carpaint', 0xc8a060)); cone.position.set(0, 2.9, 0.2); cone.rotation.x = Math.PI;
  const scoop = add(new THREE.SphereGeometry(0.23, 12, 10), pink); scoop.position.set(0, 3.25, 0.2);
  g.userData = { hatch, lights, man };
  return g;
}
