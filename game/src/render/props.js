// Things in the house that move: double doors in their frames, wardrobes (their doors swing when you hide
// or when it looks inside), toys you can throw, squeaky toys that skid away underfoot.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mat } from './shade.js';
import { WALL_H } from './world.js';
import { KID } from '../sim/rules.js';

const DOOR_H = 1.38, OPEN = 1.7;

function tint(g, t) {
  const n = g.attributes.position.count;
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(t), 3));
  const o = g.index ? g.toNonIndexed() : g;
  const out = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'uv', 'color']) out.setAttribute(k, o.attributes[k]);
  return out;
}
function boxAt(x, y, z, w, h, d, t = 1) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return tint(g, t);
}

// one door leaf, built along +x from its hinge: frame, two sunk panels each side, a knob
function leafGeometry(w) {
  const parts = [boxAt(w / 2, DOOR_H / 2, 0, w, DOOR_H, 0.05, 1)];
  for (const s of [-1, 1]) {
    parts.push(boxAt(w / 2, DOOR_H * 0.71, s * 0.027, w * 0.66, DOOR_H * 0.36, 0.008, 0.82));
    parts.push(boxAt(w / 2, DOOR_H * 0.28, s * 0.027, w * 0.66, DOOR_H * 0.34, 0.008, 0.82));
    const knob = new THREE.SphereGeometry(0.035, 10, 8);
    knob.translate(w - 0.1, DOOR_H * 0.48, s * 0.045);
    parts.push(tint(knob, 1.6));
  }
  return mergeGeometries(parts);
}

function doorFrame(d) {
  const parts = [];
  const along = d.axis === 'x';
  const len = along ? d.x1 - d.x0 : d.z1 - d.z0;
  // the casing stands proud of the wall on both sides: two posts and a lintel
  const post = (o) => (along ? boxAt(d.x0 + o, WALL_H / 2, d.z0 + 0.5, 0.1, WALL_H, 1.08, 0.75) : boxAt(d.x0 + 0.5, WALL_H / 2, d.z0 + o, 1.08, WALL_H, 0.1, 0.75));
  parts.push(post(0.05), post(len - 0.05));
  parts.push(along ? boxAt(d.x0 + len / 2, DOOR_H + 0.06, d.z0 + 0.5, len, 0.12, 1.08, 0.75) : boxAt(d.x0 + 0.5, DOOR_H + 0.06, d.z0 + len / 2, 1.08, 0.12, len, 0.75));
  // a strip of wall over the door, so the opening reads as a doorway and not a gap
  parts.push(along ? boxAt(d.x0 + len / 2, (DOOR_H + 0.12 + WALL_H) / 2, d.z0 + 0.5, len, WALL_H - DOOR_H - 0.12, 1, 1) : boxAt(d.x0 + 0.5, (DOOR_H + 0.12 + WALL_H) / 2, d.z0 + len / 2, 1, WALL_H - DOOR_H - 0.12, len, 1));
  return parts;
}

function wardrobe(w, L) {
  const g = new THREE.Group();
  g.position.set(w.tx + 0.5, 0, w.tz + 0.5);
  g.rotation.y = Math.atan2(w.fx - (w.tx + 0.5), w.fz - (w.tz + 0.5)); // +z faces the room
  const body = mergeGeometries([
    boxAt(0, 0.98, -0.02, 0.9, 1.96, 0.84, 0.62), // carcass
    boxAt(0, 2.0, 0, 0.98, 0.08, 0.92, 0.75), // cornice
    boxAt(0, 0.06, 0.02, 0.92, 0.12, 0.9, 0.5), // plinth
    boxAt(0, 1.0, 0.38, 0.84, 1.8, 0.02, 0.06), // the dark inside, seen when the doors open
  ]);
  g.add(new THREE.Mesh(body, mat({ color: 0.42, vcol: true, cut: true })));
  const doorMat = mat({ color: 0.42, vcol: true, cut: true });
  const doors = [-1, 1].map((s) => {
    const p = new THREE.Group();
    p.position.set(s * 0.43, 0, 0.41);
    const leaf = mergeGeometries([
      boxAt(-s * 0.21, 1.0, 0.012, 0.42, 1.8, 0.025, 0.7),
      boxAt(-s * 0.21, 1.35, 0.03, 0.3, 0.7, 0.01, 0.6),
      boxAt(-s * 0.21, 0.6, 0.03, 0.3, 0.6, 0.01, 0.6),
      // slats you can see out through
      ...[0, 1, 2, 3, 4].map((i) => boxAt(-s * 0.21, 1.15 + i * 0.09, 0.034, 0.26, 0.025, 0.012, 0.25)),
      boxAt(-s * 0.36, 1.0, 0.045, 0.025, 0.08, 0.025, 1.5),
    ]);
    p.add(new THREE.Mesh(leaf, doorMat));
    g.add(p);
    return { p, s };
  });
  return { g, doors, w, ang: 0 };
}

function toyMesh(kind, m) {
  let g;
  switch (kind) {
    case 'ball': g = new THREE.SphereGeometry(0.11, 14, 10); g.translate(0, 0.11, 0); break;
    case 'can': g = new THREE.CylinderGeometry(0.05, 0.05, 0.13, 14); g.translate(0, 0.065, 0); break;
    case 'bottle': {
      const a = new THREE.CylinderGeometry(0.045, 0.05, 0.17, 12); a.translate(0, 0.085, 0);
      const b = new THREE.CylinderGeometry(0.018, 0.04, 0.08, 10); b.translate(0, 0.21, 0);
      g = mergeGeometries([tint(a, 1), tint(b, 1)]); break;
    }
    case 'car': {
      const parts = [boxAt(0, 0.07, 0, 0.12, 0.06, 0.22, 1), boxAt(0, 0.12, -0.02, 0.1, 0.05, 0.11, 1.1)];
      for (const [x, z] of [[-0.06, -0.07], [0.06, -0.07], [-0.06, 0.07], [0.06, 0.07]]) {
        const w = new THREE.CylinderGeometry(0.028, 0.028, 0.02, 10); w.rotateZ(Math.PI / 2); w.translate(x, 0.03, z);
        parts.push(tint(w, 0.3));
      }
      g = mergeGeometries(parts); break;
    }
    default: g = new THREE.BoxGeometry(0.14, 0.14, 0.14); g.translate(0, 0.07, 0);
  }
  if (!g.attributes.color) g = tint(g, 1);
  return new THREE.Mesh(g, m);
}

function squeakMesh(kind, m) {
  const parts = [];
  const sph = (r, x, y, z, t = 1, sx = 1, sy = 1, sz = 1) => { const g = new THREE.SphereGeometry(r, 12, 9); g.scale(sx, sy, sz); g.translate(x, y, z); parts.push(tint(g, t)); };
  if (kind === 'duck') {
    sph(0.08, 0, 0.07, 0, 1.4, 1, 0.8, 1.3); sph(0.05, 0, 0.15, 0.06, 1.4);
    const beak = new THREE.ConeGeometry(0.022, 0.05, 8); beak.rotateX(Math.PI / 2); beak.translate(0, 0.145, 0.115); parts.push(tint(beak, 0.7));
  } else if (kind === 'bear') {
    sph(0.075, 0, 0.075, 0, 0.8); sph(0.055, 0, 0.18, 0, 0.8); sph(0.022, -0.04, 0.23, 0, 0.8); sph(0.022, 0.04, 0.23, 0, 0.8);
    sph(0.025, -0.075, 0.1, 0.02, 0.8); sph(0.025, 0.075, 0.1, 0.02, 0.8);
  } else {
    sph(0.06, 0, 0.17, 0, 1.3);
    const h = new THREE.CylinderGeometry(0.015, 0.015, 0.12, 8); h.translate(0, 0.06, 0); parts.push(tint(h, 1));
  }
  return new THREE.Mesh(mergeGeometries(parts), m);
}

export function createProps(scene, L) {
  // doors: frames are static, leaves swing on their hinges
  const frameParts = [];
  const leafMat = mat({ color: 0.4, vcol: true, cut: true });
  const doors = L.doors.map((d) => {
    frameParts.push(...doorFrame(d));
    const along = d.axis === 'x', len = along ? d.x1 - d.x0 : d.z1 - d.z0, w = len / 2 - 0.06;
    const geo = leafGeometry(w);
    const leaves = [0, 1].map((i) => {
      const p = new THREE.Group();
      // hinges at the two outer ends; each leaf points in toward the middle
      if (along) { p.position.set(i ? d.x1 - 0.06 : d.x0 + 0.06, 0, d.z0 + 0.5); p.rotation.y = i ? Math.PI : 0; }
      else { p.position.set(d.x0 + 0.5, 0, i ? d.z1 - 0.06 : d.z0 + 0.06); p.rotation.y = i ? Math.PI / 2 : -Math.PI / 2; }
      p.add(new THREE.Mesh(geo, leafMat));
      p.userData.base = p.rotation.y;
      scene.add(p);
      return p;
    });
    return { d, leaves, ang: d.open ? OPEN : 0, shake: 0 };
  });
  scene.add(new THREE.Mesh(mergeGeometries(frameParts), mat({ color: 0.42, vcol: true, cut: true })));

  const wardrobes = L.wardrobes.map((w) => { const o = wardrobe(w, L); scene.add(o.g); return o; });

  const toyMat = mat({ color: 0.55, vcol: true });
  const items = L.items.map((it) => { const m = toyMesh(it.kind, toyMat); scene.add(m); return m; });
  const squeaks = L.squeaks.map((s) => { const m = squeakMesh(s.kind, toyMat); scene.add(m); return { m, squash: 0 }; });

  return {
    reset(G) { doors.forEach((o) => { o.ang = G.doors[o.d.id].open ? OPEN : 0; o.shake = 0; }); wardrobes.forEach((o) => { o.ang = 0; }); },
    event(e) {
      if (e.type === 'doorTry') doors[e.id].shake = e.bash ? 1 : 0.35;
      if (e.type === 'squeak') squeaks[e.id].squash = 1;
    },
    update(G, dt, t) {
      for (const o of doors) {
        const want = G.doors[o.d.id].open ? OPEN : 0;
        o.ang += Math.sign(want - o.ang) * Math.min(Math.abs(want - o.ang), dt * (o.shake > 0.5 || G.t - G.doors[o.d.id].changedAt < 0.3 ? 9 : 4));
        o.shake = Math.max(0, o.shake - dt * 1.4);
        const rattle = Math.sin(t * 60) * 0.04 * o.shake;
        o.leaves.forEach((p, i) => { p.rotation.y = p.userData.base + (i ? -1 : 1) * (o.ang + rattle); });
      }
      for (const o of wardrobes) {
        const w = G.wardrobes[o.w.id], since = G.t - w.openAt;
        // doors swing open while someone gets in or out (or it looks inside), then close; ajar while you hide
        let want = since < 0.9 ? 1.25 : 0;
        if (G.kid.hidden === o.w.id && since >= 0.9) want = 0.06;
        o.ang += (want - o.ang) * Math.min(1, dt * 7);
        o.doors.forEach(({ p, s }) => { p.rotation.y = s * o.ang; });
      }
      G.items.forEach((it, i) => {
        const m = items[i], k = G.kid;
        if (it.held) {
          // carried in the kid's right hand
          m.position.set(k.x + k.fz * -0.18 + k.fx * 0.12, 0.38, k.z + k.fx * 0.18 + k.fz * 0.12);
        } else if (it.fly) {
          const f = Math.min(1, it.fly.d / KID.throwRange);
          m.position.set(it.x, 0.5 + Math.sin(f * Math.PI) * 0.9 - f * 0.45, it.z);
          m.rotation.x += dt * 12; m.rotation.z += dt * 7;
        } else {
          m.position.set(it.x, 0, it.z);
          m.rotation.x *= 0.8; m.rotation.z *= 0.8;
        }
      });
      G.squeaks.forEach((s, i) => {
        const o = squeaks[i];
        o.squash = Math.max(0, o.squash - dt * 4);
        o.m.position.set(s.x, 0, s.z);
        o.m.scale.set(1 + o.squash * 0.3, 1 - o.squash * 0.35, 1 + o.squash * 0.3);
      });
    },
  };
}
