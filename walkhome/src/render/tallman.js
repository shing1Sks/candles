// THE TALL MAN, drawn. Three metres. A long black wool frock coat that flares and folds, thin
// trousered legs and long pointed shoes, a stovepipe hat, arms that hang past his knees ending in
// fingers too long by half, and a white porcelain face with a painted smile and painted black eyes.
// When he walks (only ever when you're not looking) it is a long slow stride, knees too high.
// When you look, he is caught mid-stride, a foot off the ground, and stays exactly like that.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function faceTexture() {
  const S = 512, c = document.createElement('canvas'); c.width = S; c.height = S; const g = c.getContext('2d');
  // porcelain, greyer toward the edges, a little yellowed
  const bg = g.createRadialGradient(S / 2, S * 0.45, S * 0.1, S / 2, S / 2, S * 0.62); bg.addColorStop(0, '#ece6da'); bg.addColorStop(0.7, '#cfc6b6'); bg.addColorStop(1, '#8a8274');
  g.fillStyle = bg; g.fillRect(0, 0, S, S);
  // fine crazing, and one long crack
  g.strokeStyle = 'rgba(90,80,70,0.25)'; g.lineWidth = 1;
  for (let i = 0; i < 26; i++) { g.beginPath(); let x = Math.random() * S, y = Math.random() * S; g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (Math.random() - 0.5) * 60; y += (Math.random() - 0.5) * 60; g.lineTo(x, y); } g.stroke(); }
  g.strokeStyle = 'rgba(40,30,25,0.7)'; g.lineWidth = 2; g.beginPath(); g.moveTo(S * 0.62, S * 0.05); g.lineTo(S * 0.58, S * 0.22); g.lineTo(S * 0.64, S * 0.3); g.lineTo(S * 0.6, S * 0.38); g.stroke();
  // the eyes: tall black almond voids, a little uneven, the outer corners dragging down. A pale point
  // in each, turned toward the middle, toward you.
  const EYES = [[-1, 0.405], [1, 0.395]];
  for (const [sx, ey] of EYES) {
    const cx = S / 2 + sx * S * 0.16, cy = S * ey;
    g.save(); g.translate(cx, cy); g.rotate(sx * 0.32);
    const eg = g.createRadialGradient(0, 0, 2, 0, 0, S * 0.11); eg.addColorStop(0, '#000'); eg.addColorStop(0.75, '#060303'); eg.addColorStop(1, 'rgba(50,30,30,0)');
    g.fillStyle = eg; g.beginPath(); g.ellipse(0, 0, S * 0.062, S * 0.105, 0, 0, 7); g.fill();
    g.restore();
    g.fillStyle = 'rgba(235,228,212,0.95)'; g.beginPath(); g.arc(cx - sx * 7, cy - 6, 3.2, 0, 7); g.fill();
  }
  // the mouth: a slit of a smile pulled out to the cheeks, black inside, stitched shut
  g.fillStyle = '#0a0404'; g.beginPath(); g.moveTo(S * 0.13, S * 0.6); g.quadraticCurveTo(S / 2, S * 0.83, S * 0.87, S * 0.6); g.quadraticCurveTo(S / 2, S * 0.76, S * 0.13, S * 0.6); g.fill();
  g.strokeStyle = '#3a1a14'; g.lineWidth = 2.2; for (let k = 1; k < 14; k++) { const t = k / 14, x = S * (0.13 + 0.74 * t), y = S * 0.6 + Math.sin(t * Math.PI) * S * 0.165; g.beginPath(); g.moveTo(x - 2, y - 12); g.lineTo(x + 2, y + 8); g.stroke(); }
  // rouge, faded
  g.fillStyle = 'rgba(150,50,50,0.16)'; for (const sx of [-1, 1]) { g.beginPath(); g.arc(S / 2 + sx * S * 0.22, S * 0.58, S * 0.06, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export class TallManView {
  constructor(scene) {
    this.root = new THREE.Group(); scene.add(this.root); this.root.visible = false;
    const wool = new THREE.MeshStandardMaterial({ color: 0x15131a, roughness: 0.97 });
    const satin = new THREE.MeshStandardMaterial({ color: 0x0c0b0e, roughness: 0.35, metalness: 0.1 });
    const leather = new THREE.MeshStandardMaterial({ color: 0x0a0909, roughness: 0.3 });
    const skin = new THREE.MeshStandardMaterial({ color: 0x9a9088, roughness: 0.6 });
    const porcelain = this.porcelain = new THREE.MeshStandardMaterial({ map: faceTexture(), color: 0xd8d2c8, roughness: 0.32, metalness: 0, emissive: 0x1c1a14 });
    const pale = new THREE.MeshStandardMaterial({ color: 0xcfc6b6, roughness: 0.3 });
    const sh = (o) => { o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };
    // the coat: a lathe profile (shoulders down to the flared hem), with folds pressed into it
    const prof = [[0.0, 2.32], [0.16, 2.3], [0.27, 2.24], [0.25, 1.9], [0.21, 1.55], [0.26, 1.2], [0.34, 0.8], [0.44, 0.45], [0.47, 0.42]].map(([r, y]) => new THREE.Vector2(r, y));
    const coat = new THREE.LatheGeometry(prof, 40);
    const p = coat.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 + Math.sin(a * 9) * 0.05 * Math.max(0, 1.4 - y) + (z < 0 && Math.abs(x) < 0.05 && y < 1.3 ? -0.08 : 0);
      p.setXYZ(i, x * k, y, z * k * 0.72);
    }
    coat.computeVertexNormals();
    this.body = new THREE.Group(); this.root.add(this.body);
    this.coat = sh(new THREE.Mesh(coat, wool)); this.body.add(this.coat);
    for (let k = 0; k < 6; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), new THREE.MeshStandardMaterial({ color: 0x2a2620, roughness: 0.4, metalness: 0.5 })); b.position.set(0.02, 2.05 - k * 0.15, -0.19 - (k > 3 ? 0.02 : 0)); this.body.add(b); }
    for (const sx of [-1, 1]) { const lap = sh(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 0.02), wool)); lap.position.set(sx * 0.09, 2.08, -0.19); lap.rotation.set(0.12, sx * 0.3, sx * 0.25); this.body.add(lap); }
    // legs below the hem: thin trousers, long shoes
    this.legs = [];
    for (const s of [-1, 1]) {
      const hip = new THREE.Group(); hip.position.set(s * 0.1, 1.15, 0); this.body.add(hip);
      const th = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.62, 8), wool)); th.position.y = -0.31; hip.add(th);
      const knee = new THREE.Group(); knee.position.y = -0.6; hip.add(knee);
      const sn = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.04, 0.56, 8), wool)); sn.position.y = -0.28; knee.add(sn);
      const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 6), leather); shoe.scale.set(0.9, 0.55, 3.0); shoe.position.set(0, -0.56, -0.12); knee.add(shoe);
      this.legs.push({ hip, knee });
    }
    // arms: shoulder -> elbow -> wrist, fingers
    this.arms = [];
    for (const s of [-1, 1]) {
      const sh0 = new THREE.Group(); sh0.position.set(s * 0.28, 2.22, 0); this.body.add(sh0);
      const up = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.78, 8), wool)); up.position.y = -0.39; sh0.add(up);
      const el = new THREE.Group(); el.position.y = -0.78; sh0.add(el);
      const lo = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.036, 0.74, 8), wool)); lo.position.y = -0.37; el.add(lo);
      const hand = new THREE.Group(); hand.position.y = -0.76; el.add(hand);
      const palm = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), skin); palm.scale.set(0.7, 1.3, 0.45); hand.add(palm);
      const fingers = [];
      for (let f = 0; f < 4; f++) {
        const g = new THREE.Group(); g.position.set((f - 1.5) * 0.018, -0.05, 0); hand.add(g);
        const a = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.006, 0.2, 5), skin); a.position.y = -0.1; g.add(a);
        const g2 = new THREE.Group(); g2.position.y = -0.2; g.add(g2);
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.003, 0.16, 5), skin); b.position.y = -0.08; g2.add(b);
        fingers.push([g, g2]);
      }
      this.arms.push({ sh: sh0, el, hand, fingers, s });
    }
    // neck, head, hat
    this.neck = new THREE.Group(); this.neck.position.set(0, 2.3, 0); this.body.add(this.neck);
    // a high wing collar and a scarf: no neck to be seen
    const collar = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.17, 0.26, 14, 1, true), wool)); collar.position.y = 0.06; this.neck.add(collar);
    const scarf = sh(new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.045, 8, 18), new THREE.MeshStandardMaterial({ color: 0x2a1418, roughness: 0.95 }))); scarf.rotation.x = Math.PI / 2; scarf.position.y = 0.0; this.neck.add(scarf);
    const nk = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.22, 8), skin); nk.position.y = 0.16; this.neck.add(nk);
    this.head = new THREE.Group(); this.head.position.y = 0.38; this.neck.add(this.head);
    // the head: a long narrow skull, and the porcelain face as a mask on its front
    const skull = sh(new THREE.Mesh(new THREE.SphereGeometry(0.15, 24, 18), pale)); skull.scale.set(0.78, 1.32, 0.86); this.head.add(skull);
    const mask = sh(new THREE.Mesh(new THREE.SphereGeometry(0.153, 28, 20, Math.PI * 1.5 - 0.95, 1.9, 0.35, 2.35), porcelain)); mask.scale.set(0.79, 1.33, 0.87); this.head.add(mask);
    // the eye sockets, sunk in: real depth, so the dark holds even when a lamp is full on his face
    for (const [u, v] of [[0.5 - 0.16, 0.405], [0.5 + 0.16, 0.395]]) {
      const ph = Math.PI * 1.5 - 0.95 + u * 1.9, th = 0.35 + v * 2.35, r = 0.147;
      const sock = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), new THREE.MeshBasicMaterial({ color: 0x000000 }));
      sock.position.set(-r * Math.cos(ph) * Math.sin(th) * 0.79, r * Math.cos(th) * 1.33, r * Math.sin(ph) * Math.sin(th) * 0.87);
      sock.scale.set(0.018, 0.032, 0.012); sock.lookAt(sock.position.clone().multiplyScalar(2)); this.head.add(sock);
    }
    const brim = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.02, 24), satin)); brim.position.y = 0.15; this.head.add(brim);
    const crown = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.145, 0.52, 20), satin)); crown.position.y = 0.42; this.head.add(crown);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.149, 0.149, 0.06, 20), new THREE.MeshStandardMaterial({ color: 0x3a0e10, roughness: 0.6 })); band.position.y = 0.2; this.head.add(band);
    this.t = 0; this.headYaw = 0;
  }

  // M: tall man sim state
  // the catch: he folds down over you until his face is level with yours
  stoop(k) {
    // fold at the hips (pivot 1.3 m up): the torso goes over toward you until the face is level with yours
    const a = -k * 1.78, h = 1.3;
    this.body.rotation.x = a; this.body.position.set(0, h * (1 - Math.cos(a)), -h * Math.sin(a));
    this.neck.rotation.x = k * 0.3; this.neck.rotation.y = 0; this.head.rotation.set(k * 1.05, 0, -0.42 + k * 0.3);
    this.legs.forEach((L) => { L.hip.rotation.x = -a; L.knee.rotation.x = 0; });
    this.arms.forEach((A) => { A.sh.rotation.x = k * 0.5; A.sh.rotation.z = A.s * (0.08 + k * 0.5); A.el.rotation.x = k * 0.9; A.fingers.forEach(([f1, f2]) => { f1.rotation.x = 0.4 + k * 0.5; f2.rotation.x = 0.6 + k * 0.7; }); });
  }

  update(M, dt, camera) {
    this.root.visible = M.active && !M.vanished;
    if (!M.active) return;
    if (M.catching) return;
    this.root.position.set(M.x, M.y, M.z); this.root.rotation.y = M.yaw;
    // caught mid-stride: nothing moves while you look. Nothing. Except, once, if you hold him long
    // enough: the head goes over a little further, as if he's curious about you
    if (M.seen) { if (M.seenFor > 3.2 && !this.twitched) { this.twitched = true; this.head.rotation.z -= 0.16; this.neck.rotation.y += this.neck.rotation.y > 0 ? -0.1 : 0.1; } return; }
    this.twitched = false;
    this.t += dt;
    const ph = M.phase * Math.PI * 2, moving = M.speed > 0.05;
    // the stride: long, the knee lifting too high, the body dipping
    this.legs.forEach((L, i) => {
      const o = i ? Math.PI : 0, a = moving ? Math.sin(ph + o) : 0;
      L.hip.rotation.x = a * 0.55 + (moving ? 0.1 : 0);
      L.knee.rotation.x = moving ? -Math.max(0, Math.sin(ph + o + 1.2)) * 1.3 : 0;
    });
    this.body.position.y = moving ? -Math.abs(Math.sin(ph)) * 0.06 : 0;
    this.body.rotation.x = moving ? 0.12 : 0.04;
    // arms hang and swing a little late; when hunting they reach
    this.arms.forEach((A, i) => {
      const reach = M.mode === 'hunt' && moving ? 0.9 : 0;
      A.sh.rotation.x = (moving ? -Math.sin(ph + (i ? 0 : Math.PI)) * 0.25 : 0) + reach;
      A.sh.rotation.z = A.s * 0.08;
      A.el.rotation.x = moving ? 0.25 + reach * 0.3 : 0.12;
      A.fingers.forEach(([a, b], f) => { a.rotation.x = 0.2 + Math.sin(this.t * 1.3 + f) * 0.08; b.rotation.x = 0.3 + reach * 0.5; });
    });
    // the head: turned toward you, tilted. It turns a little further each time you look away
    let want = Math.atan2(-(camera.position.x - M.x), -(camera.position.z - M.z)) - M.yaw;
    while (want > Math.PI) want -= Math.PI * 2; while (want < -Math.PI) want += Math.PI * 2;
    this.headYaw += (want - this.headYaw) * Math.min(1, dt * 2);
    this.neck.rotation.y = Math.max(-1.4, Math.min(1.4, this.headYaw));
    this.head.rotation.z = -0.42 + Math.sin(this.t * 0.4) * 0.05; this.head.rotation.x = 0.14;
  }
}
