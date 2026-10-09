// THINGS ON THE WAY. The director deals these as you walk, one at a time, spaced out, never the same
// one twice in a night, preferring ones you haven't met before (remembered between nights, 05 R19).
// Each is a small scene with its own pieces, sounds, and an end. Grouped by what they do (05 §2):
//   teacher   the gnome: it's somewhere else every time you look back. The Tall Man's rule, taught
//             safely in our street before he ever comes (05 R25)
//   texture   a cat on a wall; a ball rolls out of an alley; a phone box ringing
//   wrongness curtains close house by house as you pass; the lights go out window by window
//             toward you; people standing in rooms; a front door standing open, then slammed
//   people    a neighbour at her gate who knows Biscuit's name; an ice-cream van that knows it too,
//             and then follows you; a car that slows down beside you
//   startle   a big dog lunging at a gate (a false scare: something real, nothing to do with him)
import * as THREE from 'three';
import { at as roadAt, N as roadN, T as roadT, regionAt, groundAt, toRoad } from '../sim/road.js';
import { houseFrame } from './house.js';
import { TallManView } from './tallman.js';
import { ROAD, height } from '../sim/road.js';
import { BRIDGE } from '../sim/town.js';
import { carMeshes, vanMeshes } from './car.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a, b) => a + Math.random() * (b - a);
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
const shadowed = (o) => { o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };
const P3 = (p) => V3(p.x, p.y, p.z);
// is a point in the middle of your view?
function looking(cam, fwd, p, cosT = 0.8) { const d = V3(p.x - cam.position.x, (p.y ?? cam.position.y) - cam.position.y, p.z - cam.position.z); const l = d.length(); return d.dot(fwd) / l > cosT && l < 45; }
function faceYaw(from, to) { return Math.atan2(to.x - from.x, to.z - from.z); }

// ---------------------------------------------------------------- captions (the only words in the game)
let capEl = null, capT = 0;
export function caption(text, secs = 4) {
  capEl ||= document.getElementById('caption');
  if (!capEl) return; capEl.textContent = text; capEl.style.opacity = 1; capT = secs;
}
export function captionTick(dt) { if (capT > 0) { capT -= dt; if (capT <= 0 && capEl) capEl.style.opacity = 0; } }

// ---------------------------------------------------------------- little models
function gnomeModel() {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 0.28, 12), std(0x2e4f8a)); b.position.y = 0.14; g.add(b);
  const h = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), std(0xe2b898, { roughness: 0.5 })); h.position.y = 0.36; g.add(h);
  const beard = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.2, 12), std(0xece6dc)); beard.position.set(0, 0.26, -0.05); beard.rotation.x = Math.PI + 0.3; g.add(beard);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.32, 12), std(0xa82820)); hat.position.y = 0.56; hat.rotation.z = 0.2; g.add(hat);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), std(0x050505, { roughness: 0.1 })); e.position.set(s * 0.035, 0.38, -0.09); g.add(e); }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), std(0xd88a78)); nose.position.set(0, 0.34, -0.1); g.add(nose);
  return shadowed(g);
}
function catModel() {
  const g = new THREE.Group(), fur = std(0x0c0b0e, { roughness: 0.95 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), fur); body.scale.set(0.9, 1.15, 1.3); body.position.y = 0.15; g.add(body);
  const head = new THREE.Group(); head.position.set(0, 0.34, -0.1); g.add(head);
  const hd = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), fur); head.add(hd);
  for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.06, 4), fur); ear.position.set(s * 0.045, 0.07, 0); head.add(ear);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), new THREE.MeshBasicMaterial({ color: 0xc8ff60 })); eye.position.set(s * 0.028, 0.01, -0.066); head.add(eye); }
  const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(V3(0.08 + Math.sin(t * 3) * 0.08, 0.04 + t * 0.05, 0.18 + t * 0.1)); }
  const tail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.016, 6), fur); g.add(tail);
  g.userData = { head, tail };
  return shadowed(g);
}
function faceTex(wide) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#d8b8a0'; g.fillRect(0, 0, 256, 256);
  const cx = 192, cy = 122;
  g.fillStyle = '#2a1a14'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(cx + s * 17, cy - 8, 6, wide ? 4 : 5, 0, 0, 7); g.fill(); }
  g.strokeStyle = 'rgba(80,40,30,0.6)'; g.lineWidth = 1.2; for (const s of [-1, 1]) { g.beginPath(); g.arc(cx + s * 17, cy - 3, 9, 0.2, Math.PI - 0.2); g.stroke(); }
  g.fillStyle = '#8a2a2a'; g.beginPath();
  if (wide) { g.moveTo(cx - 42, cy + 14); g.quadraticCurveTo(cx, cy + 46, cx + 42, cy + 14); g.quadraticCurveTo(cx, cy + 30, cx - 42, cy + 14); g.fill(); g.fillStyle = '#f0eadc'; g.fillRect(cx - 30, cy + 20, 60, 5); }
  else { g.moveTo(cx - 16, cy + 22); g.quadraticCurveTo(cx, cy + 30, cx + 16, cy + 22); g.quadraticCurveTo(cx, cy + 25, cx - 16, cy + 22); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function neighbourModel() {
  const g = new THREE.Group(), gown = std(0x6a4a5a, { roughness: 0.95 }), skin = std(0xd8b8a0, { roughness: 0.6 });
  const prof = [[0.0, 1.45], [0.17, 1.42], [0.2, 1.2], [0.19, 0.9], [0.24, 0.4], [0.27, 0.06], [0.0, 0.06]].map(([r, y]) => new THREE.Vector2(r, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 24), gown); body.scale.z = 0.75; g.add(body);
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.015, 6, 20), std(0x4a2a3a)); belt.rotation.x = Math.PI / 2; belt.position.y = 1.0; belt.scale.y = 0.75; g.add(belt);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.12, 8), skin); neck.position.y = 1.5; g.add(neck);
  const head = new THREE.Group(); head.position.y = 1.66; g.add(head);
  const faceM = new THREE.MeshStandardMaterial({ map: faceTex(false), roughness: 0.55 });
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 16), faceM); face.scale.set(0.88, 1.12, 0.92); head.add(face);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.118, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), std(0x9a968e)); hair.position.set(0, 0.015, 0.012); head.add(hair);
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), std(0x9a968e)); bun.position.set(0, 0.06, 0.1); head.add(bun);
  const arm = new THREE.Group(); arm.position.set(0.19, 1.36, 0); g.add(arm);
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.55, 8), gown); sleeve.position.set(0, -0.1, -0.25); sleeve.rotation.x = Math.PI / 2 - 0.4; arm.add(sleeve);
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), skin); hand.position.set(0, -0.2, -0.52); arm.add(hand);
  const biscuit = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.012, 14), std(0xc89058)); biscuit.position.set(0, -0.17, -0.57); biscuit.rotation.x = Math.PI / 2; arm.add(biscuit);
  g.userData = { head, faceM, wide: faceTex(true), narrow: faceM.map };
  return shadowed(g);
}
function vanModel() { return shadowed(vanMeshes()); }
function phoneBoxModel() {
  const g = new THREE.Group(), red = std(0xa81818, { roughness: 0.5 }), pane = new THREE.MeshStandardMaterial({ color: 0x1a1612, roughness: 0.1, emissive: 0x3a3020 });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.95, 2.5, 0.95), red); frame.position.y = 1.25; g.add(frame);
  for (let a = 0; a < 4; a++) for (let r = 0; r < 4; r++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.32), pane); const ang = a * Math.PI / 2; p.position.set(Math.sin(ang) * 0.48, 0.75 + r * 0.38, Math.cos(ang) * 0.48); p.rotation.y = ang; for (const dx of [-0.13, 0.13]) { const q = p.clone(); q.position.x += Math.cos(ang) * dx; q.position.z -= Math.sin(ang) * dx; g.add(q); } }
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.52, 0.25, 4, 1), red); crown.position.y = 2.62; crown.rotation.y = Math.PI / 4; g.add(crown);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.16, 0.98), new THREE.MeshStandardMaterial({ color: 0xe8e0c8, emissive: 0x6a6040 })); sign.position.y = 2.35; g.add(sign);
  g.userData = { pane };
  return shadowed(g);
}
function bigDogModel() {
  const g = new THREE.Group(), fur = std(0x0e0c0c, { roughness: 1 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.7, 4, 10), fur); body.rotation.x = Math.PI / 2; body.position.y = 0.7; g.add(body);
  const head = new THREE.Group(); head.position.set(0, 0.95, -0.6); g.add(head);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), fur));
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.13, 0.25), fur); snout.position.set(0, -0.05, -0.2); head.add(snout);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffd080 })); e.position.set(s * 0.08, 0.04, -0.16); head.add(e); const ear = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 4), fur); ear.position.set(s * 0.1, 0.18, 0); head.add(ear); }
  const teeth = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.1), std(0xe8e0d0)); teeth.position.set(0, -0.1, -0.24); head.add(teeth);
  for (const [x, z] of [[-0.15, -0.4], [0.15, -0.4], [-0.15, 0.4], [0.15, 0.4]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.6, 6), fur); l.position.set(x, 0.3, z); g.add(l); }
  g.userData = { head };
  return shadowed(g);
}
function carModel(color) {
  const g = carMeshes(color, 4.2, 1.68);
  const heads = []; for (const sx of [-0.55, 0.55]) { const h = new THREE.Mesh(new THREE.CircleGeometry(0.095, 14), new THREE.MeshBasicMaterial({ color: 0xfff4d8 })); h.position.set(sx, 0.62, -2.15); h.rotation.y = Math.PI; g.add(h); heads.push(h); }
  for (const sx of [-0.56, 0.56]) { const t = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.11), new THREE.MeshBasicMaterial({ color: 0x8a0a0a })); t.position.set(sx, 0.66, 2.13); g.add(t); }
  g.userData = { heads };
  return shadowed(g);
}

// ---------------------------------------------------------------- the encounters
const E = {};
// the first lit lamp at least `min` metres ahead (things are staged in light, or you'd never see them)
function litLampAhead(c, min, max = 70) { return c.town.lamps.find((L) => L.s > c.P.s + min && L.s < c.P.s + max && c.lampState[L.id].on); }

// THE GNOME. Act I. It teaches the rule without anyone getting hurt.
E.gnome = {
  regions: ['ourStreet'], fixed: true, weight: 0,
  start(c) { this.g = gnomeModel(); this.g.scale.setScalar(1.25); c.scene.add(this.g); this.stage = 0; const L = litLampAhead(c, 12); this.place(c, L ? L.s + 1.2 : c.P.s + 16, L ? L.side * 4.55 : 5.9); this.t = 0; return true; },
  place(c, s, l) { const p = roadAt(s, l); this.s = s; this.l = l; this.g.position.set(p.x, groundAt(p.x, p.z), p.z); this.g.rotation.y = faceYaw(p, c.camera.position); this.g.userData.moved = (this.g.userData.moved || 0) + 1; },
  update(dt, c) {
    this.t += dt;
    const p = this.g.position, seen = looking(c.camera, c.fwd, { x: p.x, y: p.y + 0.3, z: p.z }, 0.65), passed = c.P.s > this.s + 2.5;
    if (passed && !seen) {
      // somewhere else: further on, a little nearer the middle of your way each time
      if (this.stage === 0) { const L = litLampAhead(c, 10); this.place(c, L ? L.s + 1 : c.P.s + 15, L ? L.side * 4.2 : 4.4); this.stage = 1; }
      else if (this.stage === 1) { const L = litLampAhead(c, 9); this.place(c, L ? L.s : c.P.s + 13, L ? L.side * 3.7 : 3.6); this.stage = 2; c.D.poiExtra = { x: this.g.position.x, z: this.g.position.z, kind: 'gnome', id: 'gnome' }; }
      else if (this.stage === 2) { this.g.rotation.y = faceYaw(this.g.position, c.camera.position); this.stage = 3; this.t = 0; }
    }
    if (this.stage === 2 && Math.hypot(c.D.x - p.x, c.D.z - p.z) < 1.5 && !this.growled) { this.growled = true; c.emit('growl', { level: 0.3 }); }
    if (this.stage === 3 && !seen) this.g.rotation.y = faceYaw(this.g.position, c.camera.position); // it always faces your back
    return this.stage === 3 && this.t > 25;
  },
  dispose(c) { c.scene.remove(this.g); c.D.poiExtra = null; },
};

E.alley = {
  regions: ['longStreet', 'parkEdge', 'hill'], phases: ['calm', 'unease', 'dread'], weight: 3, minS: 300,
  start(c) {
    // in a front garden 15-26 m ahead, in front of a house, where no parked car is in the way
    const cars = (c.obstacles || []).filter((o) => o.car);
    for (const o of c.town.houses.filter((h) => h.s > c.P.s + 12 && h.s < c.P.s + 19 && !h.shop)) {
      if (cars.some((k) => { const r = toRoad(k.x, k.z); return Math.sign(r.l) === o.side && r.s > c.P.s && r.s < o.s + 3; })) continue;
      this.s = o.s + o.side * o.doorZ * 0.3; this.side = o.side; break;
    }
    if (this.s === undefined) return false;
    const p = roadAt(this.s, this.side * (ROAD.front - 1.5));
    this.v = new TallManView(c.scene); this.v.porcelain.emissive.setHex(0x4a463a);
    // a light on in a back garden, far down the alley, so he stands out against it
    // the porch light behind him is on: the wall glows and he stands black against it
    const bl = roadAt(this.s, this.side * (ROAD.front - 0.2), 2.3); this.light = { pos: V3(bl.x, bl.y, bl.z), color: [1.0, 0.78, 0.5], power: 1.5, cone: 0, kind: 'alley' }; c.extraLights.push(this.light);
    this.glowS = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffc890, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })); this.glowS.position.copy(this.light.pos); this.glowS.scale.set(1.2, 1.2, 1); c.scene.add(this.glowS);
    this.M = { active: true, x: p.x, z: p.z, y: groundAt(p.x, p.z), yaw: Math.atan2(-(c.camera.position.x - p.x), -(c.camera.position.z - p.z)), speed: 0, phase: 0.25, seen: false, mode: 'stalk' };
    this.t = 0; this.seenFor = 0; this.wasSeen = false; return true;
  },
  update(dt, c) {
    this.t += dt; const M = this.M, head = { x: M.x, y: M.y + 2.6, z: M.z };
    const seen = looking(c.camera, c.fwd, head, 0.86);
    M.seen = seen; if (seen) { this.seenFor += dt; if (!this.wasSeen) { this.wasSeen = true; c.emit('glimpseSeen', {}); } }
    this.v.update(M, dt, c.camera);
    // hold him with your eyes and the light behind him stutters; in the dark of it he's gone.
    // Gone, too, the moment you look away (having seen him), or when you get close, or if you never notice
    if (this.seenFor > 2.2 && !this.stutter) { this.stutter = this.t; c.emit('lampDying', { id: -1, stutter: true }); }
    if (this.stutter) { const k = this.t - this.stutter, on = k < 0.9 && Math.sin(k * 41) > 0.2; this.light.power = on ? 1.5 : 0.05; this.glowS.visible = on; if (k > 0.35 && !on) { M.vanished = true; if (k > 0.9) return true; return false; } }
    const d = Math.hypot(c.P.x - M.x, c.P.z - M.z);
    return (this.wasSeen && !seen && this.seenFor > 0.4) || d < 7 || c.P.s > this.s + 4 || this.t > 50;
  },
  dispose(c) { c.scene.remove(this.v.root); c.scene.remove(this.glowS); const i = c.extraLights.indexOf(this.light); if (i >= 0) c.extraLights.splice(i, 1); },
};

// A CAT on a garden wall, eyes catching the lamps. It watches you. Biscuit wants it.
E.cat = {
  regions: ['ourStreet', 'longStreet', 'parkEdge'], phases: ['calm', 'unease'], weight: 3,
  start(c) { this.g = catModel(); this.g.scale.setScalar(1.2); const L = litLampAhead(c, 16); const side = L ? L.side : 1; this.s = L ? L.s + 1.5 : c.P.s + rand(18, 26); const p = roadAt(this.s, side * 5.25); this.g.position.set(p.x, groundAt(p.x, p.z) + 0.72, p.z); this.g.rotation.y = faceYaw(p, c.camera.position); c.scene.add(this.g); this.t = 0; this.state = 'sit'; return true; },
  update(dt, c) {
    this.t += dt; const g = this.g, d = Math.hypot(c.P.x - g.position.x, c.P.z - g.position.z);
    g.userData.head.rotation.y = Math.atan2(c.camera.position.x - g.position.x, c.camera.position.z - g.position.z) - g.rotation.y + Math.PI;
    g.userData.tail.rotation.y = Math.sin(this.t * 2) * 0.25;
    if (this.state === 'sit' && c.P.s > this.s + 3) return true;
    if (this.state === 'sit' && d < 10.5) { c.D.lured = { x: g.position.x, z: g.position.z }; c.emit('bark', { x: c.D.x, z: c.D.z, loud: 0.4 }); this.state = 'watch'; this.t = 0; }
    if (this.state === 'watch' && (d < 4 || this.t > 4)) { c.sound?.one('cat_growl', { pos: P3(g.position), gain: 0.6, slice: false, verb: 0.3 }); this.state = 'jump'; this.t = 0; }
    if (this.state === 'jump') { g.position.y += (2.2 - this.t * 9) * dt; const back = V3(g.position.x - c.P.x, 0, g.position.z - c.P.z).normalize(); g.position.addScaledVector(back, dt * 3); if (this.t > 0.5) { c.D.lured = null; return true; } }
    return false;
  },
  dispose(c) { c.scene.remove(this.g); c.D.lured = null; },
};

// A BALL rolls out of the dark between two houses, across the road, and stops. Nobody comes for it.
E.ball = {
  regions: ['ourStreet', 'longStreet'], phases: ['calm', 'unease'], weight: 2,
  start(c) { this.side = Math.random() < 0.5 ? -1 : 1; this.s = c.P.s + rand(10, 14); this.l = this.side * 7.2; this.v = -this.side * 2.6; this.m = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), std(0xc02020, { roughness: 0.4 })); this.m.castShadow = true; c.scene.add(this.m); this.t = 0; this.bounced = 0; return true; },
  update(dt, c) {
    this.t += dt; this.l += this.v * dt; this.v *= 1 - dt * 0.35; const p = roadAt(this.s, this.l);
    const kerb = Math.abs(this.l) > 2.8 && Math.abs(this.l) < 3.1;
    this.m.position.set(p.x, groundAt(p.x, p.z) + 0.11 + (kerb ? 0.06 : 0), p.z); this.m.rotation.z += this.v * dt / 0.11;
    if (!this.bounced && Math.abs(this.l) < 4) { this.bounced = 1; c.sound?.one('syn_ball', { pos: P3(this.m.position), gain: 0.7, slice: false, verb: 0.4 }); if (Math.random() < 0.6) c.D.lured = { x: p.x, z: p.z }; }
    if (this.bounced && this.t > 3.5) c.D.lured = null;
    if (Math.abs(this.v) < 0.05 && Math.sign(this.l) === -this.side && Math.abs(this.l) > 3.2) this.v = 0;
    return this.t > 9 && c.P.s > this.s + 10;
  },
  dispose(c) { c.scene.remove(this.m); c.D.lured = null; },
};

// CURTAINS: as you pass, every window ahead draws its curtains, house by house, toward you
E.curtains = {
  ambient: true, regions: ['longStreet', 'highStreet', 'hill'], phases: ['calm', 'unease', 'dread'], weight: 3,
  start(c) { this.t = 0; this.z0 = c.P.z - 70; return true; },
  update(dt, c) {
    this.t += dt; const w = c.WIN_U.uCurtainWave.value, front = this.z0 + Math.min(1, this.t / 7) * 66;
    w.set(this.z0, front, this.t < 22 ? 1 : 0);
    if (Math.floor(this.t * 2.5) !== this.tick && this.t < 7) { this.tick = Math.floor(this.t * 2.5); c.sound?.one('step_leaves', { pos: { x: c.P.x + (this.tick % 2 ? 9 : -9), y: 4, z: front }, gain: 0.25, rate: 1.8, verb: 0.3 }); }
    return this.t > 22;
  },
  dispose(c) { c.WIN_U.uCurtainWave.value.set(0, 0, 0); },
};

// THE LIGHTS GO OUT, window after window, coming down the street toward you
E.lightsOut = {
  ambient: true, regions: ['longStreet', 'highStreet', 'parkEdge', 'hill'], phases: ['unease', 'dread'], weight: 3,
  start(c) { this.t = 0; this.z0 = c.P.z - 90; return true; },
  update(dt, c) {
    this.t += dt; const w = c.WIN_U.uLightsOut.value, front = this.z0 + Math.min(1, this.t / 11) * 86;
    w.set(this.z0, front, this.t < 30 ? 1 : 0);
    const k = Math.floor(this.t * 1.4); if (k !== this.tick && this.t < 11) { this.tick = k; c.sound?.one('../school/light_clunk', { pos: { x: c.P.x + (k % 2 ? 10 : -10), y: 5, z: front }, gain: 0.3, rate: rand(1.3, 1.6), verb: 0.5, ref: 4 }); }
    return this.t > 30;
  },
  dispose(c) { c.WIN_U.uLightsOut.value.set(0, 0, 0); },
};

// PEOPLE STANDING IN ROOMS, for a moment
E.figures = {
  ambient: true, regions: ['longStreet', 'highStreet', 'hill'], phases: ['unease', 'dread', 'hunt'], weight: 2,
  start(c) { this.t = 0; return true; },
  update(dt, c) { this.t += dt; c.evilBoost = Math.sin(Math.min(1, this.t / 9) * Math.PI) * 0.9; return this.t > 9; },
  dispose(c) { c.evilBoost = 0; },
};

// A FRONT DOOR STANDING OPEN, light on the path. Someone's shadow moves across it. As you draw level it slams.
E.door = {
  regions: ['ourStreet', 'longStreet', 'hill'], phases: ['calm', 'unease', 'dread'], weight: 2,
  start(c) {
    const h = c.town.houses.find((o) => o.s > c.P.s + 16 && o.s < c.P.s + 40 && !o.shop && o.porch); if (!h) return false;
    this.h = h; const F = houseFrame(h), fx = h.d / 2, dz = h.doorZ;
    const L = (x, y, z) => V3(x, y, z).applyMatrix4(F.matrix);
    this.g = new THREE.Group(); c.scene.add(this.g);
    // the doorway: a dark hall, the door swung open on its hinge
    const hall = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 2.1), new THREE.MeshBasicMaterial({ color: 0x3a2814 })); hall.position.copy(L(fx + 0.06, 1.6, dz)); hall.rotation.y = F.rotY + Math.PI / 2; this.g.add(hall);
    this.hinge = new THREE.Group(); this.hinge.position.copy(L(fx + 0.07, 0.55, dz - 0.5)); this.hinge.rotation.y = F.rotY; this.g.add(this.hinge);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.12, 0.98), std(h.door, { roughness: 0.6 })); door.position.set(0.0, 1.06, 0.49); door.castShadow = true; this.hinge.add(door);
    this.hinge.rotation.y = F.rotY - 1.3; this.rot0 = F.rotY;
    this.light = { pos: L(fx + 1.0, 1.6, dz), color: [1.0, 0.7, 0.4], power: 1.4, cone: 0, kind: 'door' }; c.extraLights.push(this.light);
    this.t = 0; this.state = 'open'; this.s = h.s; return true;
  },
  update(dt, c) {
    this.t += dt;
    if (this.state === 'open') { this.light.power = 1.4 * (Math.abs(c.P.s - this.s) < 14 && Math.sin(this.t * 1.3) > 0.7 ? 0.3 : 1); if (c.P.s > this.s - 2.5) { this.state = 'slam'; this.t = 0; c.sound?.one('../licensed/sfx_door_slam', { pos: P3(this.light.pos), gain: 1, slice: false, verb: 0.5 }); c.emit('startle', { amount: 0.25 }); } }
    if (this.state === 'slam') { this.hinge.rotation.y = this.rot0 - 1.3 * Math.max(0, 1 - this.t * 7); this.light.power = Math.max(0, 1.4 - this.t * 10); }
    return this.state === 'slam' && this.t > 6;
  },
  dispose(c) { c.scene.remove(this.g); const i = c.extraLights.indexOf(this.light); if (i >= 0) c.extraLights.splice(i, 1); },
};

// THE NEIGHBOUR at her gate in her dressing gown, a biscuit held out. She knows his name.
E.neighbour = {
  regions: ['ourStreet', 'longStreet'], phases: ['calm', 'unease'], weight: 2, minS: 160,
  start(c) {
    const h = c.town.houses.find((o) => o.s > c.P.s + 22 && o.s < c.P.s + 45 && !o.shop); if (!h) return false;
    this.g = neighbourModel(); const F = houseFrame(h), sp = V3(h.d / 2 + 1.7, 0, h.doorZ).applyMatrix4(F.matrix); this.g.position.set(sp.x, groundAt(sp.x, sp.z), sp.z); c.scene.add(this.g); this.s = h.s; this.t = 0; this.said = 0;
    // her front door is open behind her: warm light all round her
    const dp = V3(h.d / 2 + 0.6, 2.0, h.doorZ).applyMatrix4(F.matrix); this.light = { pos: dp, color: [1.0, 0.72, 0.42], power: 1.6, cone: 0, kind: 'door' }; c.extraLights.push(this.light);
    return true;
  },
  update(dt, c) {
    this.t += dt; const g = this.g, d = Math.hypot(c.P.x - g.position.x, c.P.z - g.position.z);
    g.rotation.y = faceYaw(g.position, c.camera.position) + 0; g.userData.head.rotation.z = Math.sin(this.t * 0.6) * 0.12;
    if (d < 16 && this.said === 0) { this.said = 1; caption('"Biscuit... Biscuit, come here, sweetheart."', 4); c.D.lured = { x: g.position.x, z: g.position.z }; c.sound?.one('../licensed/sfx_whispers', { pos: { x: g.position.x, y: 1.6, z: g.position.z }, gain: 0.5, rate: 1.15, verb: 0.3 }); }
    if (d < 7 && this.said === 1) { this.said = 2; caption('"I\'ve got something for you. I\'ve got something for both of you."', 4.5); g.userData.faceM.map = g.userData.wide; g.userData.faceM.needsUpdate = true; }
    if (c.P.s > this.s + 6 && this.said === 2) { this.said = 3; c.D.lured = null; caption('"...Another time, then."', 3); }
    if (c.P.s > this.s + 8 && this.said < 2) { this.said = 3; c.D.lured = null; }
    if (c.input?.tug) c.D.lured = null;
    return this.said === 3 && (c.P.s > this.s + 30 || (this.t > 60));
  },
  dispose(c) { c.scene.remove(this.g); c.D.lured = null; const i = c.extraLights.indexOf(this.light); if (i >= 0) c.extraLights.splice(i, 1); },
};

// THE ICE-CREAM VAN, parked on the high street at night, playing its tune too slowly. It knows his name too.
// Then the headlights come on behind you, and it follows.
E.van = {
  regions: ['highStreet'], phases: ['calm', 'unease', 'dread'], weight: 5,
  start(c) {
    // pulled in at the kerb where there's room; if there isn't, double-parked out in the road
    const cars = (c.obstacles || []).filter((o) => o.car).map((o) => toRoad(o.x, o.z));
    this.s = c.P.s + 50; this.l = -1.9;
    for (let s = c.P.s + 44; s < c.P.s + 70; s += 1.5) if (!cars.some((k) => k.l < 0 && Math.abs(k.s - s) < 5.2)) { this.s = s; break; }
    if (cars.some((k) => k.l < 0 && Math.abs(k.s - this.s) < 5.2)) this.l = -0.2;
    this.g = vanModel(); const p = roadAt(this.s, this.l); this.g.position.set(p.x, groundAt(p.x, p.z), p.z); this.g.rotation.y = faceYaw(p, roadAt(this.s - 5, this.l)) + Math.PI; c.scene.add(this.g); this.t = 0; this.state = 'parked'; this.chime = null; return true; },
  update(dt, c) {
    this.t += dt; const g = this.g, d = Math.hypot(c.P.x - g.position.x, c.P.z - g.position.z);
    if (this.state === 'parked') {
      if (!this.chime && d < 70) this.chime = c.sound?.loop('van', 'syn_van_slow', { pos: { x: g.position.x, y: 2.5, z: g.position.z }, gain: 0.55, bus: 'sfx', verb: 0.5, ref: 5, roll: 0.9 });
      if (d < 13 && !this.said) { this.said = 1; caption('"Is that Biscuit? Ooh. I\'ve got a treat for Biscuit."', 4.5); c.D.lured = { x: g.position.x + 1, z: g.position.z }; }
      if (c.P.s > this.s + 12) { this.state = 'quiet'; this.t = 0; this.chime?.stop(0.05); this.chime = null; c.D.lured = null; }
    } else if (this.state === 'quiet') {
      if (this.t > 3) { this.state = 'follow'; this.t = 0; g.userData.lights.forEach((h) => h.material.color.setHex(0xfff2d0)); this.light = { pos: V3(), color: [1, 0.95, 0.8], power: 2.2, cone: 0, kind: 'van' }; c.extraLights.push(this.light); this.engine = c.sound?.loop('vanEngine', 'car_idle', { pos: P3(g.position), gain: 0.5, bus: 'sfx', verb: 0.2, ref: 3 }); g.rotation.y += Math.PI; }
    } else if (this.state === 'follow') {
      // it creeps along behind you, never quite catching up
      const want = roadAt(c.P.s - 9, 0), dx = want.x - g.position.x, dz = want.z - g.position.z, dd = Math.hypot(dx, dz);
      if (dd > 0.5) { g.position.x += dx / dd * Math.min(2.2, dd) * dt; g.position.z += dz / dd * Math.min(2.2, dd) * dt; g.rotation.y = Math.atan2(-dx, -dz) + Math.PI; }
      g.position.y = groundAt(g.position.x, g.position.z);
      this.light.pos.copy(g.position).add(V3(0, 0.9, 0)).addScaledVector(V3(-Math.sin(g.rotation.y - Math.PI), 0, -Math.cos(g.rotation.y - Math.PI)), 2.8);
      this.engine?.move(P3(g.position)); c.fearAdd = 0.25;
      if (this.t > 26) { this.state = 'gone'; this.t = 0; this.engine?.stop(1.5); this.light.power = 0; g.userData.lights.forEach((h) => h.material.color.setHex(0x222222)); c.fearAdd = 0; }
    } else if (this.state === 'gone') return this.t > 4;
    return false;
  },
  dispose(c) { c.scene.remove(this.g); this.chime?.stop(0.1); this.engine?.stop(0.5); const i = c.extraLights.indexOf(this.light); if (i >= 0) c.extraLights.splice(i, 1); c.D.lured = null; c.fearAdd = 0; },
};

// A PHONE BOX, ringing, on a street where there is nobody. Pick it up (E) and someone asks about Biscuit.
E.phone = {
  regions: ['highStreet', 'longStreet', 'parkEdge'], phases: ['calm', 'unease'], weight: 2,
  start(c) { this.g = phoneBoxModel(); this.s = c.P.s + 30; const p = roadAt(this.s, -4.1); this.g.position.set(p.x, groundAt(p.x, p.z), p.z); this.g.rotation.y = faceYaw(p, roadAt(this.s, 0)); c.scene.add(this.g); this.t = 0; this.state = 'ring'; this.light = { pos: V3(p.x, p.y + 2.2, p.z), color: [1, 0.9, 0.7], power: 0.6, cone: 0, kind: 'phone' }; c.extraLights.push(this.light); c.obstacles?.push({ x: p.x, z: p.z, r: 0.6 }); return true; },
  update(dt, c) {
    this.t += dt; const g = this.g, d = Math.hypot(c.P.x - g.position.x, c.P.z - g.position.z);
    if (this.state === 'ring') {
      if (!this.ring && d < 28) this.ring = c.sound?.loop('phone', 'syn_phone', { pos: { x: g.position.x, y: 1.5, z: g.position.z }, gain: 0.7, bus: 'sfx', verb: 0.4, ref: 3 });
      if (d < 1.9 && c.input?.carry) { this.state = 'answered'; this.t = 0; this.ring?.stop(0.02); this.ring = null; caption('"...Is Biscuit with you?"', 3); setTimeout(() => caption('"Don\'t let go of him. Whatever you do."', 4), 3200); c.answeredPhone = true; }
      if (c.P.s > this.s + 3) { this.state = 'stopped'; this.t = 0; this.ring?.stop(0.02); this.ring = null; }
    } else if (this.state === 'stopped' && this.t > 6 && !this.again) { this.again = true; c.sound?.one('syn_phone', { pos: { x: g.position.x, y: 1.5, z: g.position.z }, gain: 0.5, slice: false, verb: 0.6 }); }
    return (this.state !== 'ring' && this.t > 12 && c.P.s > this.s + 20);
  },
  dispose(c) { c.scene.remove(this.g); this.ring?.stop(0.1); const i = c.extraLights.indexOf(this.light); if (i >= 0) c.extraLights.splice(i, 1); },
};

// A BIG DOG behind a gate, silent until you're right beside it
E.bigDog = {
  regions: ['longStreet', 'highStreet', 'parkEdge'], phases: ['calm', 'unease', 'dread'], weight: 2,
  start(c) { this.side = Math.random() < 0.5 ? -1 : 1; this.s = c.P.s + rand(20, 28); this.g = bigDogModel(); const p = roadAt(this.s, this.side * 5.8); this.g.position.set(p.x, groundAt(p.x, p.z) - 1.2, p.z); this.g.rotation.y = faceYaw(p, roadAt(this.s, 0)) + Math.PI; c.scene.add(this.g); this.t = 0; this.state = 'hidden'; return true; },
  update(dt, c) {
    this.t += dt; const g = this.g, p = roadAt(this.s, this.side * 5.8), gy = groundAt(p.x, p.z);
    if (this.state === 'hidden' && Math.abs(c.P.s - this.s) < 2.2 && Math.abs(c.P.l - this.side * 4) < 2.2) {
      this.state = 'lunge'; this.t = 0;
      for (let k = 0; k < 4; k++) c.sound?.one('dog_inside', { pos: { x: p.x, y: 1.2, z: p.z }, gain: 1, rate: rand(0.7, 0.8), verb: 0.3, at: k * 0.32 });
      c.sound?.one('syn_sub', { gain: 0.7, slice: false, verb: 0 }); c.emit('startle', { amount: 0.4 });
      c.D.fear = Math.min(1, c.D.fear + 0.6); c.emit('whimper', {});
    }
    if (this.state === 'lunge') { g.position.y = gy - 1.2 + Math.min(1, this.t * 8) * 1.25 + Math.sin(this.t * 14) * 0.06; g.rotation.x = -0.6; g.userData.head.rotation.x = Math.sin(this.t * 18) * 0.15; if (this.t > 2.6) { this.state = 'drop'; this.t = 0; } }
    if (this.state === 'drop') { g.position.y -= dt * 3; if (this.t > 1) return true; }
    return this.state === 'hidden' && c.P.s > this.s + 8;
  },
  dispose(c) { c.scene.remove(this.g); },
};

// A CAR comes up the road toward you, slows right down beside you, then goes on
E.car = {
  regions: ['ourStreet', 'longStreet', 'highStreet', 'hill'], phases: ['calm', 'unease'], weight: 2,
  start(c) { this.g = carModel([0x5a2a2a, 0x2a3a4a, 0x3a4a3a, 0x6a6a6a][Math.floor(Math.random() * 4)]); this.s = c.P.s + 90; this.l = 0; /* down the middle: there are cars parked both sides */ c.scene.add(this.g); this.t = 0; this.light = { pos: V3(), color: [1, 0.95, 0.85], power: 3, cone: 0, kind: 'car' }; c.extraLights.push(this.light); this.eng = c.sound?.loop('carEngine', 'car_idle', { pos: V3(), gain: 0.6, bus: 'sfx', verb: 0.3, ref: 4 }); return true; },
  update(dt, c) {
    this.t += dt; const near = Math.abs(this.s - c.P.s);
    const speed = near < 6 ? 1.2 : near < 20 ? 4 : 9; this.s -= speed * dt;
    const p = roadAt(this.s, this.l), q = roadAt(this.s - 1, this.l); this.g.position.set(p.x, groundAt(p.x, p.z), p.z); this.g.rotation.y = Math.atan2(q.x - p.x, q.z - p.z) + Math.PI;
    const f = roadAt(this.s - 2.6, this.l, 0.8); this.light.pos.set(f.x, f.y, f.z); this.eng?.move(P3(p)); if (this.eng) this.eng.src.playbackRate.value = 0.8 + speed * 0.06;
    return this.s < c.P.s - 60;
  },
  dispose(c) { c.scene.remove(this.g); this.eng?.stop(0.8); const i = c.extraLights.indexOf(this.light); if (i >= 0) c.extraLights.splice(i, 1); },
};

// THE MAN FROM THE BUS STOP. Not him: a man. Sitting in the shelter with his hat down. When you've
// gone past, he gets up, and walks behind you, at your pace. Stop, and he stops. Run, and he runs.
// Look round and he's looking at the pavement. If you let him catch up he walks right up to you,
// says something about the dog, and goes on past, and away. Nothing happens. That's worse.
function strangerModel() {
  const g = new THREE.Group(), coat = std(0x2a2620, { roughness: 0.95 }), dark = std(0x121212), skin = std(0x8a7a6a, { roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.27, 0.95, 12), coat); body.position.y = 1.15; g.add(body);
  const sh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), coat); sh.scale.set(1.15, 0.5, 0.8); sh.position.y = 1.6; g.add(sh);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), skin); head.position.y = 1.78; head.rotation.x = 0.35; g.add(head);
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.08, 14), dark); hat.position.set(0, 1.88, -0.01); g.add(hat);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.015, 16), dark); brim.position.set(0, 1.85, -0.03); brim.rotation.x = 0.2; g.add(brim);
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * 0.1, 0.72, 0); g.add(hip);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.72, 8), dark); leg.position.y = -0.36; hip.add(leg);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.26), dark); shoe.position.set(0, -0.72, -0.06); hip.add(shoe); legs.push(hip);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.68, 8), coat); arm.position.set(s * 0.27, 1.25, 0.02); g.add(arm);
  }
  g.userData = { legs, head };
  return shadowed(g);
}
E.stranger = {
  regions: ['highStreet', 'longStreet'], phases: ['calm', 'unease', 'dread'], weight: 3, minS: 380, reach: 170,
  start(c) {
    // the bus shelter on the high street if it's coming up, otherwise a dark doorway
    this.s = c.P.s > 700 && c.P.s < 755 ? 760 : c.P.s + 28; this.side = this.s === 760 ? 1 : (Math.random() < 0.5 ? -1 : 1);
    const p = roadAt(this.s, this.side * 4.5); this.g = strangerModel(); this.g.position.set(p.x, groundAt(p.x, p.z), p.z); this.g.rotation.y = faceYaw(p, roadAt(this.s, 0)) + Math.PI; /* (his front is -z) */ c.scene.add(this.g);
    this.state = 'wait'; this.t = 0; this.phase = 0; this.spoke = 0; this.follow = 0; return true;
  },
  update(dt, c) {
    this.t += dt; const g = this.g, P = c.P, gp = g.position, d = Math.hypot(P.x - gp.x, P.z - gp.z);
    const seen = looking(c.camera, c.fwd, { x: gp.x, y: gp.y + 1.6, z: gp.z }, 0.9);
    if (this.state === 'wait') { if (P.s > this.s + 6) { this.state = 'follow'; this.t = 0; c.sound?.one('step_concrete', { pos: P3(gp), gain: 0.5, rate: 0.8, verb: 0.4 }); } return P.s > this.s + 60; }
    if (this.state === 'follow') {
      // keep about ten metres behind you, walking when you walk, running when you run
      const want = roadAt(P.s - 10, Math.max(-4.2, Math.min(4.2, P.l))), dx = want.x - gp.x, dz = want.z - gp.z, dd = Math.hypot(dx, dz);
      const sp = Math.min(P.running ? 3.0 : 1.5, dd > 0.3 ? dd * 1.5 : 0) * (P.speed < 0.2 && d < 11 ? 0.0 : 1);
      if (dd > 0.05 && sp > 0) { gp.x += dx / dd * sp * dt; gp.z += dz / dd * sp * dt; g.rotation.y = Math.atan2(-dx, -dz); this.phase += sp * dt / 0.75; this.follow += sp * dt; }
      gp.y = groundAt(gp.x, gp.z);
      g.userData.legs.forEach((L, i) => (L.rotation.x = Math.sin(this.phase * Math.PI + i * Math.PI) * 0.45 * Math.min(1, sp)));
      g.userData.head.rotation.x = seen ? 0.6 : 0.35;                       // when you look, he looks down
      const step = Math.floor(this.phase); if (step !== this.lastStep && sp > 0.2) { this.lastStep = step; c.sound?.one('step_concrete', { pos: P3(gp), gain: 0.45, rate: 0.78 + Math.random() * 0.06, verb: 0.45, ref: 3 }); }
      c.D.fear = Math.min(1, c.D.fear + dt * (d < 14 ? 0.06 : 0)); if (d < 14 && Math.random() < dt * 0.3) c.emit('growl', { level: 0.4 });
      c.fearAdd = d < 16 ? 0.2 : 0;
      if (seen && !this.spoke && d < 16) { this.spoke = 1; caption('"Evening."', 3); }
      // stand still long enough and he comes right up to you
      if (P.speed < 0.2) { this.still = (this.still || 0) + dt; if (this.still > 4) { this.state = 'pass'; this.t = 0; } } else this.still = 0;
      if (this.follow > 55 || this.t > 60) { this.state = 'gone'; this.t = 0; }
      return false;
    }
    if (this.state === 'pass') {
      // walks up beside you, says it, and goes on past you, up the road, and away
      const tgt = this.t < 4 ? roadAt(P.s + (this.t < 2.5 ? -0.5 : 8), P.l > 0 ? P.l - 1.1 : P.l + 1.1) : roadAt(P.s + 40, P.l > 0 ? 2.4 : -2.4);
      const dx = tgt.x - gp.x, dz = tgt.z - gp.z, dd = Math.hypot(dx, dz), sp = 1.4;
      if (dd > 0.1) { gp.x += dx / dd * sp * dt; gp.z += dz / dd * sp * dt; g.rotation.y = Math.atan2(-dx, -dz); this.phase += sp * dt / 0.75; }
      gp.y = groundAt(gp.x, gp.z); g.userData.legs.forEach((L, i) => (L.rotation.x = Math.sin(this.phase * Math.PI + i * Math.PI) * 0.45));
      if (d < 2.2 && this.spoke < 2) { this.spoke = 2; caption('"Nice dog."', 3); c.D.fear = Math.min(1, c.D.fear + 0.4); c.emit('growl', { level: 0.7 }); }
      return this.t > 22 || d > 45;
    }
    if (this.state === 'gone') { if (!seen) { g.visible = false; return true; } return this.t > 15; }
    return false;
  },
  dispose(c) { c.scene.remove(this.g); c.fearAdd = 0; },
};

// THE TOWPATH. Crossing the canal bridge you can see along the water both ways. Down there on the
// towpath, under the narrowboat's light, a man is standing very still with his face turned up to
// the bridge. To you. Look away, and there's a splash, and the towpath is empty.
E.towpath = {
  regions: ['parkEdge'], phases: ['calm', 'unease', 'dread'], weight: 8, minS: 1055,
  start(c) {
    if (c.P.s > 1098) return false;
    const w = roadAt(BRIDGE.water, 0), wy = height(BRIDGE.water) - 4.4, side = Math.random() < 0.5 ? -1 : 1, bank = Math.random() < 0.5 ? -1 : 1;
    this.g = strangerModel(); this.g.position.set(w.x + side * (16 + Math.random() * 8), wy + 0.65, w.z + bank * (BRIDGE.width / 2 - 0.05));
    this.g.userData.head.rotation.x = -0.55;                        // looking up
    this.g.rotation.y = Math.atan2(-(w.x - this.g.position.x), -(w.z - this.g.position.z)); c.scene.add(this.g);
    this.light = { pos: V3(this.g.position.x + side * 1.5, wy + 2.6, this.g.position.z), color: [1.0, 0.75, 0.45], power: 0.9, cone: 0, kind: 'boat' }; c.extraLights.push(this.light);
    this.t = 0; this.seenFor = 0; this.state = 'there'; return true;
  },
  update(dt, c) {
    this.t += dt; const g = this.g, head = { x: g.position.x, y: g.position.y + 1.7, z: g.position.z };
    if (this.state === 'there') {
      const seen = looking(c.camera, c.fwd, head, 0.94);
      if (seen) { this.seenFor += dt; if (this.seenFor > 0.2 && !this.felt) { this.felt = true; c.emit('glimpseSeen', {}); c.D.fear = Math.min(1, c.D.fear + 0.3); } }
      // he turns his face to follow you across the bridge
      g.rotation.y = Math.atan2(-(c.camera.position.x - g.position.x), -(c.camera.position.z - g.position.z));
      if (this.seenFor > 1.0 && !seen) { this.state = 'gone'; this.t = 0; g.visible = false; this.light.power = 0.15;
        c.sound?.one('syn_splash', { pos: { x: g.position.x, y: g.position.y, z: g.position.z }, gain: 1.0, slice: false, verb: 0.6, ref: 12, roll: 0.6, at: 0.35 }); }
      return c.P.s > BRIDGE.to + 25 || this.t > 70;
    }
    return this.t > 8;
  },
  dispose(c) { c.scene.remove(this.g); const i = c.extraLights.indexOf(this.light); if (i >= 0) c.extraLights.splice(i, 1); },
};

// ---------------------------------------------------------------- the deck
const KEY = 'walkhome.seenEncounters';
export class Deck {
  constructor() {
    this.active = null; this.nextS = 30; this.ran = new Set();
    try { this.seen = new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch { this.seen = new Set(); }
    this.log = [];
  }
  update(dt, c) {
    captionTick(dt);
    if (this.active) {
      this.activeT = (this.activeT || 0) + dt;
      // nothing may hold the deck forever: left far behind, or gone on too long, it ends
      const stale = c.P.s > this.activeS + (this.active.reach ?? 75) || this.activeT > 140;
      if (stale || this.active.update(dt, c)) { this.activeT = 0; this.active.dispose(c); this.log.push([+c.P.s.toFixed(0), this.activeId, 'end']); this.active = null; this.nextS = c.P.s + rand(26, 48); }
      return;
    }
    const bridgeTime = !this.ran.has('towpath') && c.P.s > 1072 && c.P.s < 1096;
    if ((c.P.s < this.nextS && !bridgeTime) || c.director.phase === 'peak' || c.caught) return;
    // the gnome comes first, in our street, always
    let id = null;
    if (!this.ran.has('gnome') && c.P.s > 25 && c.P.s < 160) id = 'gnome';
    else if (!this.ran.has('towpath') && c.P.s > 1072 && c.P.s < 1096 && !c.tall?.active) id = 'towpath'; // (the bridge has its own)
    else if (bridgeTime && c.P.s < this.nextS) return;
    else {
      const R = regionAt(c.P.s).id, ph = c.director.phase;
      const busy = c.tall?.active; // while he's about, only the quiet wrongness, not people
      const cand = Object.entries(E).filter(([k, e]) => !e.fixed && !this.ran.has(k) && e.regions.includes(R) && (!e.phases || e.phases.includes(ph)) && (!e.minS || c.P.s > e.minS) && (!busy || e.ambient));
      if (!cand.length) { this.nextS = c.P.s + 20; return; }
      let tot = 0; const w = cand.map(([k, e]) => { const x = e.weight * (this.seen.has(k) ? 0.4 : 1); tot += x; return x; });
      let r = Math.random() * tot; for (let i = 0; i < cand.length; i++) { r -= w[i]; if (r <= 0) { id = cand[i][0]; break; } }
    }
    const enc = Object.create(E[id]);
    if (!enc.start(c)) { this.nextS = c.P.s + 12; return; }
    this.active = enc; this.activeId = id; this.activeS = c.P.s; this.activeT = 0; this.ran.add(id); this.seen.add(id); this.log.push([+c.P.s.toFixed(0), id, 'start']);
    try { localStorage.setItem(KEY, JSON.stringify([...this.seen])); } catch {}
  }
  force(id, c) { if (this.active) { this.active.dispose(c); this.active = null; } const enc = Object.create(E[id]); if (enc.start(c)) { this.active = enc; this.activeId = id; this.activeS = c.P.s; this.activeT = 0; this.ran.add(id); } }
}
