// Building blocks for creatures: fur strands over an ellipsoid, tapered bones placed between two points,
// and two-bone IK for arms and legs.
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);

// A strand: a thin 4-sided cone from (0,0,0) to (0,1,0), dark at the root and paler at the tip.
function strandGeometry() {
  const g = new THREE.ConeGeometry(0.5, 1, 4, 2, true);
  g.translate(0, 0.5, 0);
  const p = g.attributes.position, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) c.fill(0.55 + 0.9 * p.getY(i), i * 3, i * 3 + 3);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
const STRAND = strandGeometry();

// Fur over an ellipsoid (radii rx, ry, rz) in its own local space; strands droop toward local -y by `droop`.
export function fur(n, rx, ry, rz, len, thick, material, { droop = 0.35, front = -1, seed = 1 } = {}) {
  const m = new THREE.InstancedMesh(STRAND, material, n);
  const q = new THREE.Quaternion(), s = new THREE.Vector3(), pos = new THREE.Vector3(), nrm = new THREE.Vector3(), mtx = new THREE.Matrix4();
  let r = seed * 9301;
  const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  let i = 0;
  while (i < n) {
    // even points on a sphere, stretched to the ellipsoid
    const y = 1 - 2 * rnd(), a = rnd() * Math.PI * 2, rr = Math.sqrt(1 - y * y);
    const ux = Math.cos(a) * rr, uz = Math.sin(a) * rr;
    if (front > -1 && uz > front) continue; // leave a face bare
    pos.set(ux * rx, y * ry, uz * rz);
    nrm.set(ux / rx, y / ry, uz / rz).normalize();
    nrm.y -= droop; nrm.x += (rnd() - 0.5) * 0.5; nrm.z += (rnd() - 0.5) * 0.5; nrm.normalize();
    q.setFromUnitVectors(UP, nrm);
    const L = len * (0.55 + rnd() * 0.9), T = thick * (0.7 + rnd() * 0.6);
    s.set(T, L, T);
    mtx.compose(pos.multiplyScalar(0.96), q, s);
    m.setMatrixAt(i++, mtx);
  }
  m.frustumCulled = false;
  return m;
}

// two-bone IK: elbow position for shoulder a, wrist c, bone lengths l1, l2, bending toward `pole`
const _d = new THREE.Vector3(), _p = new THREE.Vector3();
export function ik(a, c, l1, l2, pole, out) {
  const d = _d.subVectors(c, a);
  const dist = Math.min(Math.max(d.length(), 0.01), l1 + l2 - 0.01);
  d.normalize();
  const x = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  const p = _p.subVectors(pole, a);
  p.addScaledVector(d, -p.dot(d)).normalize();
  return out.copy(a).addScaledVector(d, x).addScaledVector(p, h);
}

// a tapered tube between two points (updated every frame)
export function bone(r1, r2, material) {
  const g = new THREE.CylinderGeometry(r2, r1, 1, 12, 1);
  g.translate(0, 0.5, 0);
  return new THREE.Mesh(g, material);
}
export function place(mesh, a, b) {
  mesh.position.copy(a);
  const d = _d.subVectors(b, a), L = d.length();
  mesh.quaternion.setFromUnitVectors(UP, d.divideScalar(L || 1));
  mesh.scale.set(1, L, 1);
}

