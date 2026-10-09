// YOUR HANDS AND THE LEAD. A navy duffel-coat sleeve, a ribbed cream cuff, and red knitted mittens
// (knitted by someone who loves you: stockinette Vs, a little fuzz). The right hand is a fist round
// the loop of the lead; the lead is a real rope (verlet, 26 points) from that loop to Biscuit's
// collar: it sags when he's close, snaps straight when he pulls (and then it pulls your arm toward
// him), drags on the ground, swings. The left hand only comes when it's needed: it pumps when you
// run, it goes down flat to stroke his head, and both come up round him when you carry him.
// Everything sways with your steps and lags your turns a little.
import * as THREE from 'three';

const N = 26, TUBE_SEG = 40, TUBE_R = 5;
const _m = new THREE.Matrix4(), _up = new THREE.Vector3(), SH_R = new THREE.Vector3(0.34, -0.72, 0.12), SH_L = new THREE.Vector3(-0.34, -0.72, 0.12);

// a knitted texture: rows of stockinette Vs (colour and bump), with a little fuzz
function knitTex(base, dark, seed = 1) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = dark; g.fillRect(0, 0, 128, 128);
  let r = seed * 9301; const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  for (let y = 0; y < 128; y += 8) for (let x = 0; x < 128; x += 8) {
    for (const s of [-1, 1]) {
      g.save(); g.translate(x + 4 + s * 1.8, y + 4); g.rotate(s * 0.55);
      const l = 0.8 + rnd() * 0.25; g.fillStyle = base; g.globalAlpha = l; g.beginPath(); g.ellipse(0, 0, 1.8, 4.4, 0, 0, Math.PI * 2); g.fill(); g.restore();
    }
  }
  g.globalAlpha = 0.12; g.strokeStyle = '#fff'; for (let i = 0; i < 160; i++) { const x = rnd() * 128, y = rnd() * 128; g.beginPath(); g.moveTo(x, y); g.lineTo(x + rnd() * 4 - 2, y + rnd() * 4 - 2); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function ribTex() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 16; const g = c.getContext('2d');
  for (let x = 0; x < 64; x++) { const v = 150 + Math.sin(x / 64 * Math.PI * 2 * 8) * 70; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, 0, 1, 16); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
// a soft lumpy wool: the sleeve
function woolTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), d = g.createImageData(128, 128);
  for (let i = 0; i < 128 * 128; i++) { const x = i % 128, y = (i / 128) | 0, v = 128 + 40 * Math.sin(x * 0.9 + Math.sin(y * 0.4) * 2) * Math.sin(y * 0.7) + (Math.random() - 0.5) * 70; d.data.set([v, v, v, 255], i * 4); }
  g.putImageData(d, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

// a mitten: a closed fist round a handle, or open and flat (for stroking). Built from a sphere,
// pushed about: a flat palm, a rounded back, fingers bunched at the front, the thumb on its own
function mittenGeo(open) {
  const g = new THREE.SphereGeometry(1, 28, 20), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (open) { x *= 0.05; y *= 0.022 * (y < 0 ? 0.7 : 1); z *= 0.082; z -= 0.012 * (1 - x * x / 0.0025); }
    else {
      // a fist: taller at the knuckles (front), the palm side flatter, a groove where the fingers fold
      x *= 0.047; y *= 0.042; z *= 0.058;
      if (z < 0) y *= 1 + (-z / 0.058) * 0.12;
      if (y < -0.02) y = -0.02 + (y + 0.02) * 0.55;
      const groove = Math.exp(-((z + 0.018) ** 2) / 0.00006) * (y < 0 ? 0.004 : 0); y += groove;
    }
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals(); return g;
}

export class Viewmodel {
  constructor(scene, camera) {
    this.camera = camera; this.scene = scene;
    this.rig = new THREE.Group(); camera.add(this.rig);
    const wool = woolTex();
    const sleeve = new THREE.MeshStandardMaterial({ color: 0x27304a, roughness: 1, bumpMap: wool, bumpScale: 1.2, emissive: 0x05070d });
    const knit = new THREE.MeshStandardMaterial({ color: 0x9a3a30, roughness: 1, bumpMap: ribTex(), bumpScale: 1.6, emissive: 0x15130f });
    const mt = knitTex('#c23a30', '#6a1612');
    mt.repeat.set(5, 4);
    const mitten = new THREE.MeshStandardMaterial({ map: mt, bumpMap: mt, bumpScale: 1.4, roughness: 1, color: 0xffffff, emissive: 0x220605 });
    const mk = (side, open) => {
      const g = new THREE.Group();
      // the sleeve runs back from the wrist toward your shoulder, soft folds round it
      const sg = new THREE.CylinderGeometry(0.05, 0.066, 0.5, 18, 10, true); const sp = sg.attributes.position;
      for (let i = 0; i < sp.count; i++) { const x = sp.getX(i), y = sp.getY(i), z = sp.getZ(i), a = Math.atan2(z, x), k = 1 + 0.06 * Math.sin(a * 3 + y * 18) * Math.max(0, 0.5 - y) + 0.03 * Math.sin(y * 40 + a); sp.setX(i, x * k); sp.setZ(i, z * k); }
      sg.computeVertexNormals(); sg.rotateX(Math.PI / 2); sg.translate(0, 0, 0.27);
      const s = new THREE.Mesh(sg, sleeve); g.add(s);
      // a turned-back cuff on the coat, then the knitted cuff of the mitten tucked inside it
      const cuffCoat = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.05, 18, 1, true), sleeve); cuffCoat.rotation.x = Math.PI / 2; cuffCoat.position.z = 0.04; g.add(cuffCoat);
      const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.041, 0.047, 0.045, 18, 1, true), knit); rib.rotation.x = Math.PI / 2; rib.position.z = 0.005; g.add(rib);
      // the mitten
      const hand = new THREE.Group(); hand.position.z = -0.075; g.add(hand);
      const m = new THREE.Mesh(mittenGeo(open), mitten); hand.add(m);
      const tg = new THREE.CapsuleGeometry(0.016, 0.03, 4, 10);
      const th = new THREE.Mesh(tg, mitten);
      if (open) { th.position.set(-side * 0.048, -0.004, 0.012); th.rotation.set(Math.PI / 2, 0, -side * 0.7); }
      else { th.position.set(-side * 0.03, 0.026, -0.03); th.rotation.set(Math.PI / 2 - 0.2, 0, side * 1.1); }
      hand.add(th);
      g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
      this.rig.add(g); g.hand = hand;
      return g;
    };
    this.right = mk(1, false); this.left = mk(-1, true); this.leftFist = mk(-1, false);
    // the lead's handle: a loop through your fist, the rope comes out of the bottom
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.006, 6, 18), new THREE.MeshStandardMaterial({ color: 0xa82a24, roughness: 0.7 }));
    loop.position.set(0.0, -0.035, -0.0); loop.rotation.set(0, Math.PI / 2, 0); loop.scale.set(1, 1.5, 1); this.right.hand.add(loop);
    this.hold = new THREE.Object3D(); this.right.hand.add(this.hold); this.hold.position.set(0, -0.078, 0.0);
    this.sway = new THREE.Vector2(); this.lastYaw = 0; this.lastPitch = 0; this.t = 0; this.petT = 0; this.runT = 0; this.pull = new THREE.Vector3();
    // the lead (a tube we rewrite in place every frame)
    this.pts = Array.from({ length: N }, () => new THREE.Vector3()); this.prev = this.pts.map((p) => p.clone()); this.ready = false;
    this.leadMat = new THREE.MeshStandardMaterial({ color: 0xb8302a, roughness: 0.7 });
    this.tube = this.makeTube();
    this.lead = new THREE.Mesh(this.tube, this.leadMat); this.lead.frustumCulled = false; this.lead.castShadow = true; scene.add(this.lead);
    this.curve = new THREE.CatmullRomCurve3(this.pts);
    this.v = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), d: new THREE.Vector3() };
  }

  // put an arm's wrist at w (camera space), the sleeve running back from it to the shoulder, so it
  // always leaves the screen at the bottom like a real arm does (never pointing at you)
  aim(G, w, shoulder, roll = 0) {
    G.position.copy(w);
    _m.lookAt(shoulder, w, _up.set(Math.sin(roll), Math.cos(roll), 0)); G.quaternion.setFromRotationMatrix(_m);
  }

  makeTube() {
    const g = new THREE.BufferGeometry(), n = (TUBE_SEG + 1) * TUBE_R;
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const idx = [];
    for (let i = 0; i < TUBE_SEG; i++) for (let j = 0; j < TUBE_R; j++) { const a = i * TUBE_R + j, b = i * TUBE_R + (j + 1) % TUBE_R, c = a + TUBE_R, d = b + TUBE_R; idx.push(a, c, b, b, c, d); }
    g.setIndex(idx); return g;
  }

  // mode: 'lead' | 'carry' | 'pet'
  update(dt, P, D, puppy, ground) {
    this.t += dt;
    // sway: lag behind turns, bob with steps
    const dyaw = P.yaw - this.lastYaw, dp = P.pitch - this.lastPitch; this.lastYaw = P.yaw; this.lastPitch = P.pitch;
    this.sway.x += (Math.max(-0.08, Math.min(0.08, dyaw * 0.8)) - this.sway.x) * Math.min(1, dt * 10);
    this.sway.y += (Math.max(-0.06, Math.min(0.06, dp * 0.6)) - this.sway.y) * Math.min(1, dt * 10);
    const mv = Math.min(1, P.speed / 1.4), step = Math.sin(P.phase * Math.PI), breathe = Math.sin(this.t * 1.7) * 0.004;
    const carry = D.carried, pet = D.petting && !carry;
    this.petT += ((pet ? 1 : 0) - this.petT) * Math.min(1, dt * 5);
    this.runT += ((P.running && !carry ? 1 : 0) - this.runT) * Math.min(1, dt * 6);
    const R = this.right, L = this.left, LF = this.leftFist;
    if (carry) {
      this.aim(R, this.v.c.set(0.15, -0.5 + breathe, -0.5), SH_R, -0.9); this.aim(LF, this.v.d.set(-0.15, -0.5 + breathe, -0.5), SH_L, 0.9); LF.visible = !D.petting;
      L.visible = D.petting; if (D.petting) this.stroke(L, puppy, 1);
    } else {
      // the lead hand: out in front, swinging a little with the walk; when he pulls, your arm goes
      // out toward him and jerks with his tugs
      const tens = D.tension;
      const col = puppy.collarWorld(this.v.a), loc = this.camera.worldToLocal(col);
      const dir = this.v.b.copy(loc).sub(this.v.c.set(0.3, -0.35, -0.55)); const dl = dir.length() || 1; dir.divideScalar(dl);
      this.pull.lerp(this.v.d.copy(dir).multiplyScalar(tens * 0.07 + (tens > 0.9 ? Math.sin(this.t * 13) * 0.006 : 0)), Math.min(1, dt * 8));
      const swingZ = Math.sin(P.phase * Math.PI) * 0.025 * mv * (1 - tens), bobY = Math.abs(step) * 0.014 * mv;
      const w = this.v.c.set(0.27 + this.sway.x * 0.6 + this.pull.x, -0.34 + bobY + breathe - this.sway.y * 0.4 + this.pull.y * 0.5 - this.runT * 0.04, -0.52 + swingZ + this.pull.z);
      this.aim(R, w, SH_R, -0.25 + Math.sin(P.phase * Math.PI) * 0.05 * mv);
      // the free hand: pumps when you run, goes flat onto his head when you stroke him
      LF.visible = this.runT > 0.05 && this.petT < 0.05;
      if (LF.visible) { const s = Math.sin(P.phase * Math.PI); this.aim(LF, this.v.d.set(-0.26 + this.sway.x * 0.6, -0.6 + this.runT * 0.16 + Math.max(0, s) * 0.07, -0.44 - s * 0.07), SH_L, 0.4); }
      L.visible = this.petT > 0.05;
      if (L.visible) { this.stroke(L, puppy, this.petT); if (D.lickT > 0.4) L.position.y += Math.sin((D.lickT - 0.4) / 0.3 * Math.PI) * 0.025; } // a lick: the hand flinches up (it tickles)
    }
    R.visible = true;
    // puppy carried: sits in your arms in front of you
    if (carry) {
      const r = puppy.root; if (r.parent !== this.rig) { this.rig.add(r); }
      r.position.set(0, -0.5 + breathe * 2 + Math.abs(step) * 0.01 * mv, -0.6); r.rotation.set(0.1, Math.PI + Math.sin(this.t * 0.4) * 0.15, 0); r.scale.setScalar(0.85);
    } else if (puppy.root.parent === this.rig) { this.scene.add(puppy.root); }
    this.lead.visible = !carry;
    if (!carry) this.rope(dt, puppy, ground, !!D.lost);
  }

  // the free hand goes down flat onto his head and strokes it, from the brow back over the ears
  // and down the neck, slowly, the way you would
  stroke(L, puppy, k) {
    const head = puppy.head.getWorldPosition(this.v.a), neck = puppy.collarWorld(this.v.b);
    const h = this.camera.worldToLocal(head.clone()), n = this.camera.worldToLocal(neck.clone());
    const back = n.clone().sub(h); back.y = 0; if (back.lengthSq() < 1e-6) back.set(0, 0, 1); back.normalize();
    const c = (Math.sin(this.t * 2.2) + 1) / 2, lift = Math.max(0, Math.sin(this.t * 2.2 + 1.6)) * 0.02; // forward, then back over the head
    const target = h.clone().addScaledVector(back, -0.03 + c * 0.11).add(new THREE.Vector3(0, 0.15 + lift, 0));
    const rest = new THREE.Vector3(-0.22, -0.62, -0.32);
    // palm down on his head, the arm reaching from your shoulder
    this.aim(L, rest.lerp(target, Math.min(1, k)), SH_L, 0);
  }

  rope(dt, puppy, ground, free = false) {
    const a = this.hold.getWorldPosition(this.v.a), b = free ? this.v.b.copy(this.pts[N - 1]) : puppy.collarWorld(this.v.b);
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
    // rewrite the tube round the curve
    const pos = this.tube.attributes.position, nor = this.tube.attributes.normal, P = this.v.c, T = this.v.d, up = new THREE.Vector3(0, 1, 0), side = new THREE.Vector3(), nrm = new THREE.Vector3();
    for (let i = 0; i <= TUBE_SEG; i++) {
      const u = i / TUBE_SEG; this.curve.getPoint(u, P); this.curve.getTangent(u, T);
      side.crossVectors(T, Math.abs(T.y) > 0.9 ? side.set(1, 0, 0) : up).normalize(); nrm.crossVectors(side, T).normalize();
      for (let j = 0; j < TUBE_R; j++) {
        const a2 = j / TUBE_R * Math.PI * 2, cx = Math.cos(a2), sy = Math.sin(a2), k = i * TUBE_R + j;
        const nx = side.x * cx + nrm.x * sy, ny = side.y * cx + nrm.y * sy, nz = side.z * cx + nrm.z * sy;
        pos.setXYZ(k, P.x + nx * 0.0085, P.y + ny * 0.0085, P.z + nz * 0.0085); nor.setXYZ(k, nx, ny, nz);
      }
    }
    pos.needsUpdate = true; nor.needsUpdate = true;
  }
}
