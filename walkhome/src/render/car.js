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
