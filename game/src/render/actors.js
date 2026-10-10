// The kid (small, pale, in pyjamas) and the monster (a hunched heap of dark spikes with one white eye
// on a stalk). Both are built from primitives and animated by hand.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mat } from './shade.js';

function part(geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  return m;
}
function pivot(x, y, z, ...children) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  children.forEach((c) => g.add(c));
  return g;
}

function shadowBlob(r) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 24), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.45, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.01;
  return m;
}

export function createKid() {
  const pj = mat({ color: 0.78 }), skin = mat({ color: 0.86 }), hair = mat({ color: 0.12 }), dark = mat({ color: 0.25 });
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(shadowBlob(0.26), body);
  const torso = part(new THREE.CapsuleGeometry(0.13, 0.2, 4, 10), pj, 0, 0.47, 0);
  const head = pivot(0, 0.78, 0, part(new THREE.SphereGeometry(0.15, 16, 12), skin));
  const hairCap = part(new THREE.SphereGeometry(0.155, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, 0, 0.02, -0.01);
  hairCap.rotation.x = -0.35; head.add(hairCap);
  for (const s of [-1, 1]) head.add(part(new THREE.SphereGeometry(0.022, 8, 6), dark, s * 0.055, 0.0, 0.135)); // eyes
  const legL = pivot(-0.06, 0.3, 0, part(new THREE.CapsuleGeometry(0.05, 0.16, 3, 8), pj, 0, -0.13, 0));
  const legR = pivot(0.06, 0.3, 0, part(new THREE.CapsuleGeometry(0.05, 0.16, 3, 8), pj, 0, -0.13, 0));
  const armL = pivot(-0.17, 0.6, 0, part(new THREE.CapsuleGeometry(0.04, 0.17, 3, 8), pj, 0, -0.12, 0));
  const armR = pivot(0.17, 0.6, 0, part(new THREE.CapsuleGeometry(0.04, 0.17, 3, 8), pj, 0, -0.12, 0));
  body.add(torso, head, legL, legR, armL, armR);
  let phase = 0, crawl = 0, lean = 0, yaw = 0;
  return {
    root,
    update(k, dt, t) {
      root.position.set(k.x, 0, k.z);
      const want = Math.atan2(k.fx, k.fz);
      let dy = want - yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      yaw += dy * Math.min(1, dt * 14);
      body.rotation.y = yaw;
      crawl += ((k.crawl ? 1 : 0) - crawl) * Math.min(1, dt * 10);
      lean += ((k.blowing >= 0 ? 1 : 0) - lean) * Math.min(1, dt * 8);
      const sp = k.speed;
      phase += dt * sp * (k.crawl ? 5 : 3.6);
      const sw = Math.sin(phase) * Math.min(1, sp / 2) * (k.running ? 0.9 : 0.55);
      legL.rotation.x = sw; legR.rotation.x = -sw;
      armL.rotation.x = -sw * 0.9 + crawl * -1.4; armR.rotation.x = sw * 0.9 + crawl * -1.4;
      // crawling: the whole body tips forward and drops to the floor
      body.rotation.x = crawl * 1.25 + lean * 0.25;
      body.position.y = -crawl * 0.12 + Math.abs(Math.sin(phase)) * 0.03 * Math.min(1, sp / 2);
      body.position.z = 0;
      // scared: a little tremble when the monster is near (set by view)
      head.rotation.z = Math.sin(t * 40) * 0.03 * (k.fear || 0);
      head.scale.setScalar(1 + lean * 0.06 * Math.sin(t * 30));
    },
  };
}

// fur: a shell of dark spikes on an egg-shaped body
function spikes(n, rx, ry, rz, len) {
  const geos = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 1.7, r = Math.sqrt(Math.max(0, 1 - y * y)), a = i * 2.399963;
    const dir = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r).normalize();
    const L = len * (0.6 + ((i * 7919) % 100) / 100 * 0.8);
    const c = new THREE.ConeGeometry(0.045, L, 5);
    c.translate(0, L / 2, 0);
    c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, dir.clone().add(new THREE.Vector3(0, 0.25, 0)).normalize()));
    c.translate(dir.x * rx, dir.y * ry, dir.z * rz);
    geos.push(c.toNonIndexed());
  }
  return mergeGeometries(geos.map((g) => { const o = new THREE.BufferGeometry(); for (const k of ['position', 'normal', 'uv']) o.setAttribute(k, g.attributes[k]); return o; }));
}

export function createMonster() {
  const fur = mat({ color: 0.1 }), hide = mat({ color: 0.06 }), claw = mat({ color: 0.5 });
  const eyeMat = mat({ color: 0.0, emis: 1.0 }), pupilMat = mat({ color: 0.0 }), stalkMat = mat({ color: 0.14 });
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(shadowBlob(0.55), body);
  const trunk = pivot(0, 0.95, 0);
  const egg = part(new THREE.SphereGeometry(1, 20, 14), hide);
  egg.scale.set(0.42, 0.5, 0.38);
  const coat = part(spikes(150, 0.4, 0.48, 0.36, 0.3), fur);
  trunk.add(egg, coat);
  // two short legs, two long arms that drag
  const legs = [-1, 1].map((s) => {
    const p = pivot(s * 0.2, 0.55, 0, part(new THREE.CapsuleGeometry(0.09, 0.32, 4, 8), hide, 0, -0.26, 0));
    body.add(p); return p;
  });
  const arms = [-1, 1].map((s) => {
    const a = pivot(s * 0.38, 1.15, 0.05, part(new THREE.CapsuleGeometry(0.06, 0.7, 4, 8), hide, 0, -0.42, 0));
    for (let i = -1; i <= 1; i++) {
      const c = part(new THREE.ConeGeometry(0.025, 0.2, 5), claw, i * 0.04, -0.88, 0.02);
      c.rotation.x = Math.PI;
      a.add(c);
    }
    body.add(a); return a;
  });
  // the stalk: three segments, swaying, ending in the eye
  const stalk = [];
  let tip = pivot(0, 0.45, 0);
  trunk.add(tip);
  for (let i = 0; i < 3; i++) {
    const seg = part(new THREE.CylinderGeometry(0.022, 0.03, 0.2, 6), stalkMat, 0, 0.1, 0);
    tip.add(seg);
    const next = pivot(0, 0.2, 0);
    tip.add(next); stalk.push(tip); tip = next;
  }
  const eye = part(new THREE.SphereGeometry(0.1, 16, 12), eyeMat);
  const pupil = part(new THREE.SphereGeometry(0.045, 10, 8), pupilMat, 0, 0, 0.075);
  pupil.scale.set(1, 1.6, 0.6);
  eye.add(pupil); tip.add(eye);
  // a soft halo so the eye reads in the dark
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffffff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.setScalar(0.7); tip.add(halo);
  body.add(trunk);

  let phase = 0, yaw = 0, crouch = 0;
  const look = new THREE.Vector3();
  return {
    root, eye,
    materials: [fur, hide, claw, eyeMat, pupilMat, stalkMat],
    update(M, kid, dt, t) {
      root.position.set(M.x, 0, M.z);
      const want = Math.atan2(M.hx, M.hz);
      let dy = want - yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      yaw += dy * Math.min(1, dt * 10);
      body.rotation.y = yaw;
      phase += dt * (1.5 + M.speed * 2.2);
      const sw = Math.sin(phase) * Math.min(1, M.speed / 2);
      legs[0].rotation.x = sw * 0.8; legs[1].rotation.x = -sw * 0.8;
      arms[0].rotation.x = -sw * 0.5 - 0.2; arms[1].rotation.x = sw * 0.5 - 0.2;
      arms[0].rotation.z = -0.15 - Math.abs(sw) * 0.1; arms[1].rotation.z = 0.15 + Math.abs(sw) * 0.1;
      const wind = M.mode === 'windup' ? 1 : 0, lunge = M.mode === 'lunge' ? 1 : 0;
      crouch += (wind - crouch) * Math.min(1, dt * 18);
      trunk.position.y = 0.95 - crouch * 0.2 + Math.abs(sw) * 0.06;
      trunk.rotation.x = 0.25 + Math.min(1, M.speed / 3.5) * 0.3 - crouch * 0.35 + lunge * 0.6;
      if (lunge) { arms[0].rotation.x = arms[1].rotation.x = -1.6; }
      // fur shivers, faster when hunting
      const shiver = M.mode === 'chase' || lunge ? 1 : 0.35;
      trunk.children[1].scale.setScalar(1 + Math.sin(t * 23) * 0.04 * shiver);
      trunk.children[1].rotation.y = Math.sin(t * 17) * 0.05 * shiver;
      // the stalk sways; the eye turns toward the kid when it knows where you are
      stalk.forEach((s, i) => { s.rotation.x = Math.sin(t * 1.7 + i) * 0.25 - 0.1; s.rotation.z = Math.sin(t * 1.3 + i * 2) * 0.3; });
      if (M.sees || M.mode === 'windup' || M.mode === 'lunge') look.set(kid.x, 0.5, kid.z);
      else look.set(M.x + M.hx * 3, 0.3, M.z + M.hz * 3);
      eye.lookAt(look);
      eye.scale.setScalar(M.mode === 'windup' ? 1.35 : 1);
    },
    setFade(f) { for (const m of this.materials) m.uniforms.uFade.value = f; halo.material.opacity = 0.35 * f; },
  };
}

let _glow;
export function glowTexture() {
  if (_glow) return _glow;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  _glow = new THREE.CanvasTexture(c);
  return _glow;
}
