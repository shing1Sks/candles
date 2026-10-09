// YOUR HANDS AND THE LEAD. A navy coat sleeve with a knitted cuff and a red mitten, held out in
// front holding the lead; the lead is a real rope (verlet, 26 points) from the mitten to Biscuit's
// collar: it sags when he's close, snaps straight when he pulls, drags on the ground, swings. When
// you carry him, both arms come up around him. When you stroke him, the free hand goes down to
// his head. Everything sways with your steps and lags your turns a little.
import * as THREE from 'three';

const N = 26;
export class Viewmodel {
  constructor(scene, camera) {
    this.camera = camera; this.scene = scene;
    this.rig = new THREE.Group(); camera.add(this.rig);
    const sleeve = new THREE.MeshStandardMaterial({ color: 0x2c3858, roughness: 0.95, emissive: 0x070a14 });
    const knit = new THREE.MeshStandardMaterial({ color: 0xd8cfbc, roughness: 1, emissive: 0x1a1814 });
    const mitten = new THREE.MeshStandardMaterial({ color: 0xb02c26, roughness: 0.95, emissive: 0x2a0806 });
    const mk = (side) => {
      const g = new THREE.Group();
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.058, 0.42, 14), sleeve); s.rotation.x = Math.PI / 2; s.position.z = 0.16; g.add(s);
      const c = new THREE.Mesh(new THREE.TorusGeometry(0.043, 0.017, 8, 16), knit); c.position.z = -0.05; g.add(c);
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), mitten); m.scale.set(1.0, 0.85, 1.25); m.position.z = -0.1; g.add(m);
      const th = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), mitten); th.position.set(-side * 0.045, 0.02, -0.09); g.add(th);
      g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
      this.rig.add(g);
      return g;
    };
    this.right = mk(1); this.left = mk(-1);
    this.hold = new THREE.Object3D(); this.right.add(this.hold); this.hold.position.set(0, -0.01, -0.12);
    this.sway = new THREE.Vector2(); this.lastYaw = 0; this.lastPitch = 0; this.t = 0; this.petT = 0;
    // the lead
    this.pts = Array.from({ length: N }, () => new THREE.Vector3()); this.prev = this.pts.map((p) => p.clone()); this.ready = false;
    this.leadMat = new THREE.MeshStandardMaterial({ color: 0xb8302a, roughness: 0.7 });
    this.lead = new THREE.Mesh(new THREE.BufferGeometry(), this.leadMat); this.lead.frustumCulled = false; this.lead.castShadow = true; scene.add(this.lead);
  }

  // mode: 'lead' | 'carry' | 'pet'
  update(dt, P, D, puppy, ground) {
    this.t += dt;
    // sway: lag behind turns, bob with steps
    const dyaw = P.yaw - this.lastYaw, dp = P.pitch - this.lastPitch; this.lastYaw = P.yaw; this.lastPitch = P.pitch;
    this.sway.x += (Math.max(-0.08, Math.min(0.08, dyaw * 0.8)) - this.sway.x) * Math.min(1, dt * 10);
    this.sway.y += (Math.max(-0.06, Math.min(0.06, dp * 0.6)) - this.sway.y) * Math.min(1, dt * 10);
    const step = Math.sin(P.phase * Math.PI) * Math.min(1, P.speed / 1.4), breathe = Math.sin(this.t * 1.7) * 0.004;
    const carry = D.carried, pet = D.petting && !carry;
    this.petT += ((pet ? 1 : 0) - this.petT) * Math.min(1, dt * 6);
    // right hand: holds the lead out, or under him when carrying
    const R = this.right, L = this.left;
    if (carry) {
      R.position.set(0.17, -0.47 + breathe, -0.5); R.rotation.set(0.9, 0.7, -0.5);
      L.position.set(-0.17, -0.47 + breathe, -0.5); L.rotation.set(0.9, -0.7, 0.5);
      L.visible = true;
      if (D.petting) this.reach(L, puppy, 0.0);
    } else {
      const tens = D.tension;
      R.position.set(0.31 + this.sway.x * 0.6, -0.31 + step * 0.012 + breathe - this.sway.y * 0.4 - tens * 0.02, -0.58 - tens * 0.05);
      R.rotation.set(1.2 - tens * 0.25, 0.55 + this.sway.x, -0.1);
      // left hand: hidden at your side, unless stroking him
      L.position.set(-0.2 + this.sway.x * 0.6, -0.62, -0.3);
      L.rotation.set(0.8, -0.2, 0.3);
      if (this.petT > 0.05) this.reach(L, puppy, this.petT);
      L.visible = this.petT > 0.05;
    }
    R.visible = true;
    // puppy carried: sits in your arms in front of you
    if (carry) {
      const r = puppy.root; if (r.parent !== this.rig) { this.rig.add(r); }
      r.position.set(0, -0.5 + breathe * 2 + step * 0.01, -0.6); r.rotation.set(0.1, Math.PI + Math.sin(this.t * 0.4) * 0.15, 0); r.scale.setScalar(0.85);
    } else if (puppy.root.parent === this.rig) { this.scene.add(puppy.root); }
    this.lead.visible = !carry;
    if (!carry) this.rope(dt, puppy, ground, !!D.lost);
  }

  // the free hand goes to his head and strokes it, back from the brow over the ears
  reach(L, puppy, k) {
    const head = puppy.head.getWorldPosition(new THREE.Vector3());
    const local = this.camera.worldToLocal(head.clone());
    const base = new THREE.Vector3(-0.2, -0.55, -0.3), to = local.clone().sub(base), len = to.length();
    if (len > 0.75) to.multiplyScalar(0.75 / len);
    const stroke = Math.sin(this.t * 4.2);
    const target = base.clone().add(to).add(new THREE.Vector3(0, 0.09 + Math.max(0, stroke) * 0.02, 0.02 * stroke));
    L.position.lerp(target, Math.min(1, 0.25 + k));
    L.lookAt(this.camera.localToWorld(local.clone()));
    L.rotateX(Math.PI / 2 + 0.3);
  }

  rope(dt, puppy, ground, free = false) {
    const a = this.hold.getWorldPosition(new THREE.Vector3()), b = free ? this.pts[N - 1].clone() : puppy.collarWorld(new THREE.Vector3());
    if (!this.ready) { for (let i = 0; i < N; i++) { this.pts[i].lerpVectors(a, b, i / (N - 1)); this.prev[i].copy(this.pts[i]); } this.ready = true; }
    const len = 2.4, seg = len / (N - 1), g = -9.8 * dt * dt;
    for (let i = 1; i < (free ? N : N - 1); i++) {
      const p = this.pts[i], q = this.prev[i], vx = (p.x - q.x) * 0.97, vy = (p.y - q.y) * 0.97, vz = (p.z - q.z) * 0.97;
      q.copy(p); p.x += vx; p.y += vy + g; p.z += vz;
      const gy = ground(p.x, p.z) + 0.012; if (p.y < gy) { p.y = gy; q.x = p.x - vx * 0.4; q.z = p.z - vz * 0.4; }
    }
    this.pts[0].copy(a); if (!free) this.pts[N - 1].copy(b);
    for (let it = 0; it < 14; it++) {
      for (let i = 0; i < N - 1; i++) {
        const p = this.pts[i], q = this.pts[i + 1], dx = q.x - p.x, dy = q.y - p.y, dz = q.z - p.z, d = Math.hypot(dx, dy, dz) || 1e-6;
        const diff = (d - seg) / d * 0.5;
        if (d < seg) continue; // a rope only resists stretching
        const wp = i === 0 ? 0 : 1, wq = i + 1 === N - 1 && !free ? 0 : 1, sum = wp + wq || 1;
        p.x += dx * diff * 2 * wp / sum; p.y += dy * diff * 2 * wp / sum; p.z += dz * diff * 2 * wp / sum;
        q.x -= dx * diff * 2 * wq / sum; q.y -= dy * diff * 2 * wq / sum; q.z -= dz * diff * 2 * wq / sum;
      }
      this.pts[0].copy(a); if (!free) this.pts[N - 1].copy(b);
    }
    const curve = new THREE.CatmullRomCurve3(this.pts);
    this.lead.geometry.dispose();
    this.lead.geometry = new THREE.TubeGeometry(curve, 40, 0.0085, 5, false);
  }
}
