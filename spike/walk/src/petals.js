// Coloured paper petals: the only colour in the world.
// Strays drift through the forest; walk into one (or hold reach) to catch it and it gets pinned to
// the back of your hand. You can let one go. When the field blooms, your petals fly back into it.
// Kinds: ambient (a stray), dropped (let go, lies on the ground), rise (lifting off the field,
// losing colour), fly (released toward a point), collect (flying to your hand).
import * as THREE from 'three';
import { COLOURS, paperMat } from './art.js';
import { RULES, rand } from './rules.js';
import { emit, forwardOf, rightOf, viewAngle } from './state.js';

const R = RULES.petals;
const POOL = 360;

export class Petals {
  constructor(scene, sprites, A) {
    this.items = [];
    for (let i = 0; i < POOL; i++) {
      const m = new THREE.Mesh(A.petalGeo, paperMat(A.petalTex, { side: THREE.DoubleSide }));
      m.visible = false;
      scene.add(m);
      sprites.add({ root: m, meshes: [m], billboard: false });
      this.items.push({ m, life: 0, max: 1, age: 0, v: new THREE.Vector3(), spin: new THREE.Vector3(), kind: '', colour: 0, y0: 0, to: new THREE.Vector3(), from: new THREE.Vector3() });
    }
    this.spawnT = 3;
    this.ambientOn = true;
  }

  spawn(pos, vel, kind, colour = Math.floor(Math.random() * COLOURS.length), life = null) {
    const P = this.items.find((q) => q.life <= 0);
    if (!P) return null;
    P.m.position.copy(pos);
    P.v.copy(vel);
    P.spin.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
    P.kind = kind; P.colour = colour; P.age = 0; P.y0 = pos.y;
    P.max = P.life = life ?? (kind === 'rise' ? 5 + Math.random() * 3 : kind === 'dropped' ? 40 : rand(R.life));
    const c = COLOURS[colour];
    P.m.material.color.setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace);
    P.m.material.userData.uSat.value = 1;
    P.m.material.opacity = 1;
    P.m.scale.setScalar(1);
    P.m.visible = true;
    return P;
  }

  ambientCount() { return this.items.reduce((n, P) => n + (P.life > 0 && P.kind === 'ambient' ? 1 : 0), 0); }

  // Let one petal go: it flutters down in front of you. Returns where it lands, or null.
  drop(S) {
    if (!S.held.length) { emit(S, 'dropEmpty'); return null; }
    const colour = S.held[S.held.length - 1];
    const p = S.player, [fx, fz] = forwardOf(p);
    const pos = new THREE.Vector3(p.x + fx * 1.2, 1.1, p.z + fz * 1.2);
    if (!this.spawn(pos, new THREE.Vector3(fx * 0.3, -0.45, fz * 0.3), 'dropped', colour)) return null; // pool full: keep it
    S.held.pop();
    S.dropped = { x: pos.x, z: pos.z, colour, t: S.t };
    emit(S, 'petalDropped', { colour, held: S.held.length });
    return pos;
  }

  // Your petals unpin and fly back into the field.
  release(S, target) {
    const p = S.player, [fx, fz] = forwardOf(p);
    S.held.forEach((colour, i) => {
      const P = this.spawn(new THREE.Vector3(p.x + fx * 0.7, 1.0 + i * 0.04, p.z + fz * 0.7), new THREE.Vector3(), 'fly', colour, 6);
      if (P) { P.to.set(target.x + (Math.random() - 0.5) * 4, 0.6, target.y + (Math.random() - 0.5) * 4); P.age = -i * 0.12; }
    });
    emit(S, 'petalsReleased', { n: S.held.length });
    S.held = [];
  }

  // Stop-motion step (12 fps).
  step(t, dt, S) {
    const p = S.player;
    const wx = Math.cos(S.windAng) * S.wind, wz = Math.sin(S.windAng) * S.wind;

    // strays: one at a time, somewhere ahead of you, drifting on the wind
    if (this.ambientOn) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT = rand(R.spawnEvery);
        if (this.ambientCount() < R.maxAmbient) {
          const a = p.yaw + (Math.random() * 2 - 1) * R.spawnCone, d = rand(R.spawnDist);
          this.spawn(new THREE.Vector3(p.x - Math.sin(a) * d, rand(R.spawnHeight), p.z - Math.cos(a) * d),
            new THREE.Vector3(wx * 0.45 + (Math.random() - 0.5) * 0.3, -0.06, wz * 0.45 + (Math.random() - 0.5) * 0.3), 'ambient');
        }
      }
    }

    const eye = new THREE.Vector3(p.x, 1.25, p.z);
    const [fx, fz] = forwardOf(p), [rx, rz] = rightOf(p);
    for (const P of this.items) {
      if (P.life <= 0) continue;
      P.life -= dt; P.age += dt;
      const m = P.m;

      if (P.kind === 'collect') {
        // fly into your left hand
        const k = Math.min(1, P.age / 0.35);
        const hx = p.x + fx * 0.55 - rx * 0.3, hz = p.z + fz * 0.55 - rz * 0.3;
        m.position.set(P.from.x + (hx - P.from.x) * k, P.from.y + (0.95 - P.from.y) * k, P.from.z + (hz - P.from.z) * k);
        m.scale.setScalar(1 - k * 0.6);
        m.rotation.z += dt * 8;
        if (k >= 1) { P.life = 0; m.visible = false; }
        continue;
      }
      if (P.kind === 'fly') {
        if (P.age < 0) continue;
        m.position.lerp(P.to, Math.min(1, dt * 1.6));
        m.rotation.x += dt * 5; m.rotation.y += dt * 3;
        if (m.position.distanceTo(P.to) < 0.4) P.life = Math.min(P.life, 0.3);
        m.material.opacity = Math.min(1, P.life / 0.3);
        if (P.life <= 0) m.visible = false;
        continue;
      }

      m.position.addScaledVector(P.v, dt);
      if (P.kind !== 'dropped' || m.position.y > 0.05) {
        m.position.x += Math.sin(t * 1.7 + P.spin.x) * 0.35 * dt;
        m.position.z += Math.cos(t * 1.3 + P.spin.y) * 0.35 * dt;
        m.rotation.x += P.spin.x * dt; m.rotation.y += P.spin.y * dt; m.rotation.z += P.spin.z * dt;
      }
      if (P.kind === 'ambient') P.v.y = -0.06 + Math.sin(t * 2.1 + P.spin.z) * 0.12;
      // rising petals lose their colour as they climb
      if (P.kind === 'rise') m.material.userData.uSat.value = Math.max(0, 1 - (m.position.y - P.y0) / 2.2);
      m.material.opacity = Math.min(1, P.life / 1.5, P.age / 0.5);
      if (m.position.y < 0.03) { m.position.y = 0.03; P.v.set(0, 0, 0); P.spin.set(0, 0, 0); m.rotation.set(-Math.PI / 2, 0, m.rotation.z); }

      // catching
      const catchable = P.kind === 'ambient' || (P.kind === 'dropped' && P.age > R.dropCatchDelay);
      if (catchable && S.held.length < R.maxHeld) {
        const d = m.position.distanceTo(eye);
        const flat = Math.hypot(m.position.x - p.x, m.position.z - p.z);
        const walkedInto = flat < R.catchRadius && m.position.y < 2.4; // includes petals lying on the ground
        const inReach = p.reaching && d < R.reachRadius && Math.abs(viewAngle(p, m.position.x, m.position.z)) < R.reachCone;
        if (walkedInto || inReach) {
          P.kind = 'collect'; P.age = 0; P.life = 1; P.from.copy(m.position);
          S.held.push(P.colour);
          emit(S, 'petalCaught', { colour: P.colour, held: S.held.length, reached: inReach });
        }
      }
      if (P.life <= 0) m.visible = false;
    }
  }
}
