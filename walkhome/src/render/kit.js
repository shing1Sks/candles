// The geometry kit. Every part of a street segment (bricks, slates, kerbs, pickets...) is added
// here with its material, a tint, and how it moves (lean toward the road, sway in the wind), then
// merged into one mesh per material: a whole 24 m segment of street is a couple of dozen draw calls.
// Primitive UVs are in metres; the kit divides by the material's tile size.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { depthFor } from './materials.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export function xf(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  return geo.applyMatrix4(_m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz)));
}

// --- primitives, UVs in metres
export function box(w, h, d, sx = 1, sy = 1, sz = 1) {
  const g = new THREE.BoxGeometry(w, h, d, sx, sy, sz), uv = g.attributes.uv;
  // faces in order +x -x +y -y +z -z; each face's UV runs 0..1 over its own extent
  const per = (sx + 1) * (sy + 1), faces = [[d, h, (sz + 1) * (sy + 1)], [d, h, (sz + 1) * (sy + 1)], [w, d, (sx + 1) * (sz + 1)], [w, d, (sx + 1) * (sz + 1)], [w, h, per], [w, h, per]];
  let i = 0;
  for (const [a, b, n] of faces) for (let k = 0; k < n; k++, i++) uv.setXY(i, uv.getX(i) * a, uv.getY(i) * b);
  return g;
}
export function cyl(rt, rb, h, seg = 10, hs = 1, open = false, t0 = 0, tl = Math.PI * 2) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg, hs, open, t0, tl), uv = g.attributes.uv, c = Math.PI * (rt + rb) * tl / (Math.PI * 2);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * c, uv.getY(i) * h);
  return g;
}
export function cone(r, h, seg = 8, hs = 1) {
  const g = new THREE.ConeGeometry(r, h, seg, hs), uv = g.attributes.uv, sl = Math.hypot(r, h);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * 2 * r, uv.getY(i) * sl);
  return g;
}
export function sphere(r, ws = 12, hs = 8, phiStart, phiLen, thStart, thLen) {
  const g = new THREE.SphereGeometry(r, ws, hs, phiStart, phiLen, thStart, thLen), uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * 2 * r, uv.getY(i) * Math.PI * r);
  return g;
}
export function tube(points, r, seg = 24, rs = 6, closed = false) {
  const curve = points.getPoint ? points : new THREE.CatmullRomCurve3(points);
  const g = new THREE.TubeGeometry(curve, seg, r, rs, closed), uv = g.attributes.uv, L = curve.getLength();
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * L, uv.getY(i) * Math.PI * 2 * r);
  return g;
}
// a cylinder from a to b
export function limb(a, b, r0, r1 = r0, seg = 8) {
  const d = b.clone().sub(a), g = cyl(r1, r0, d.length(), seg);
  return g.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), d.normalize()), V3(1, 1, 1)));
}

const _c = new THREE.Color();
export class Kit {
  constructor(M) { this.M = M; this.parts = new Map(); }
  // geo: in world space unless frame is given. frame: { matrix, warp(x,y,z)->[x,y,z], lean(x,y,z)->[lx,ly,lz] in local }
  add(geo, matName, color = 0xffffff, frame = null, wind = 0) {
    const mat = this.M[matName];
    if (!mat) throw new Error('no material ' + matName);
    let g = geo.index ? geo.toNonIndexed() : geo;
    for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(a)) g.deleteAttribute(a);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const n = g.attributes.position.count, tm = mat.userData.texMeters || 1;
    const uv = g.attributes.uv; for (let i = 0; i < n; i++) uv.setXY(i, uv.getX(i) / tm, uv.getY(i) / tm);
    const flags = mat.userData.flags || {};
    if (flags.lean) {
      const L = new Float32Array(n * 3);
      if (frame) {
        const p = g.attributes.position;
        for (let i = 0; i < n; i++) { const [lx, ly, lz] = frame.lean(p.getX(i), p.getY(i), p.getZ(i)); L[i * 3] = lx; L[i * 3 + 1] = ly; L[i * 3 + 2] = lz; }
      }
      g.setAttribute('aLean', new THREE.BufferAttribute(L, 3));
    }
    // how loose each vertex is in the wind, from its own (local) height
    let windArr = null;
    if (flags.wind) { const p = g.attributes.position; windArr = new Float32Array(n); for (let i = 0; i < n; i++) windArr[i] = typeof wind === 'function' ? wind(p.getY(i), p.getX(i), p.getZ(i)) : wind; }
    if (frame && frame.ao) { const p = g.attributes.position, ys = new Float32Array(n); for (let i = 0; i < n; i++) ys[i] = p.getY(i); frame.aoY = (i) => ys[i]; }
    if (frame?.warp && !frame.straight) { const p = g.attributes.position; for (let i = 0; i < n; i++) { const [x, y, z] = frame.warp(p.getX(i), p.getY(i), p.getZ(i)); p.setXYZ(i, x, y, z); } g.computeVertexNormals(); }
    if (frame) {
      g.applyMatrix4(frame.matrix);
      if (flags.lean) { const L = g.attributes.aLean, rot = new THREE.Matrix3().setFromMatrix4(frame.matrix); for (let i = 0; i < n; i++) { _v.fromBufferAttribute(L, i).applyMatrix3(rot); L.setXYZ(i, _v.x, _v.y, _v.z); } }
    }
    if (flags.wind) g.setAttribute('aWind', new THREE.BufferAttribute(windArr, 1));
    _c.set(color); const col = new Float32Array(n * 3); for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
    // a little baked ambient occlusion: walls darken toward the ground and up under the eaves, so
    // everything sits in the world instead of floating on it
    if (frame && frame.ao) { const p = g.attributes.position; for (let i = 0; i < n; i++) { const y = frame.aoY(i, p); const k = Math.min(1, 0.55 + y * 0.45) * (frame.aoTop ? 1 - Math.max(0, (y - frame.aoTop + 0.6) / 0.6) * 0.35 : 1); col[i * 3] *= k; col[i * 3 + 1] *= k; col[i * 3 + 2] *= k; } }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (!this.parts.has(matName)) this.parts.set(matName, []);
    this.parts.get(matName).push(g);
  }
  build(parent, { shadows = true } = {}) {
    const meshes = [];
    for (const [k, list] of this.parts) {
      // all parts of one material must agree on attributes
      const names = ['position', 'normal', 'uv', 'color', ...(list.some((g) => g.attributes.aLean) ? ['aLean'] : []), ...(list.some((g) => g.attributes.aWind) ? ['aWind'] : [])];
      for (const g of list) {
        if (names.includes('aLean') && !g.attributes.aLean) g.setAttribute('aLean', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3), 3));
        if (names.includes('aWind') && !g.attributes.aWind) g.setAttribute('aWind', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count), 1));
      }
      const geo = mergeGeometries(list);
      list.forEach((g) => g.dispose());
      const mat = this.M[k], mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = shadows && k !== 'cobble' && k !== 'grass' && k !== 'slab' && k !== 'kerb';
      mesh.receiveShadow = true;
      mesh.customDepthMaterial = depthFor(mat.userData.flags || {});
      geo.computeBoundingSphere();
      parent.add(mesh); meshes.push(mesh);
    }
    this.parts.clear();
    return meshes;
  }
}
