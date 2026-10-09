// RARE NIGHTS, drawn (engine/modules/rare.js). The procession: painted children crossing the corridor
// ahead in single file, stepping at 12 fps like everyone else; the last one turns to you. The
// sanctuary: a cleaner's bucket and mop and a radio on the floor of the one corridor with every light on.
import * as THREE from 'three';
import { makeCard } from './people.js';
import { makePaperLit } from './paperlit.js';
import { pairsOf } from '../../../engine/modules/rare.js';

const STEP = 1 / 12;

export class RareView {
  constructor(scene, cards, floorH) {
    this.scene = scene; this.cards = cards; this.floorH = floorH;
    this.kids = []; this.acc = 0; this.props = null;
  }

  // the line of children, made the first time it's needed (the kid cards may still be painting at boot)
  ensureKids(n) {
    if (this.kids.length) return;
    const K = this.cards.kids;
    for (let k = 0; k < n; k++) {
      const v = K[k % K.length], fy = (c) => 616 * (c.height / 660);
      const h = [1.32, 1.5, 1.4, 1.56, 1.36, 1.46][k % 6]; // all ages, not a row of copies
      const back = makeCard(v.back, h, fy(v.back)), front = makeCard(v.front, h, fy(v.front));
      back.root.visible = front.root.visible = false;
      this.scene.add(back.root, front.root);
      this.kids.push({ back, front });
    }
  }

  ensureProps() {
    if (this.props) return;
    const g = new THREE.Group(), m = (c) => makePaperLit(null, { color: c });
    const box = (w, h, d, c, x, y, z, ry = 0, rz = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m(c)); b.position.set(x, y, z); b.rotation.set(0, ry, rz); g.add(b); return b; };
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.14, 0.3, 14, 1, true), m(0x6d7a72)); bucket.position.set(0, 0.15, 0); g.add(bucket);
    box(0.3, 0.01, 0.3, 0x2a2e2b, 0, 0.27, 0);                    // the water
    box(0.03, 1.35, 0.03, 0x8a7a5e, 0.12, 0.72, -0.05, 0, -0.22); // the mop handle, leaning in the bucket
    box(0.4, 0.22, 0.14, 0x3b3631, 0.75, 0.11, 0.2, 0.4);          // the radio
    box(0.05, 0.05, 0.02, 0xb8b0a0, 0.66, 0.15, 0.27, 0.4);         // its dial
    box(1.1, 0.01, 0.5, 0x1f2421, 0.2, 0.006, 0.6);                 // a wet patch on the floor
    g.visible = false; this.scene.add(g);
    this.props = g;
  }

  update(S, camera, dt) {
    const X = S.rare, lights = [];
    this.acc += dt;
    const tick = this.acc >= STEP;
    if (tick) this.acc %= STEP;
    // the procession
    const on = X?.kind === 'procession' && X.phase === 'on' && S.phase === 'play' && X.line.floor === S.player.floor;
    if (on) this.ensureKids(X.line.n);
    for (const [k, kid] of this.kids.entries()) {
      const A = X?.line, s = on && A ? A.from + (S.t - X.t0) * A.speed - Math.floor(k / 2) * A.gap : -99, side = (k % 2 ? 0.3 : -0.3) + [0, 0.12, -0.1, 0.18, -0.05][Math.floor(k / 2) % 5]; // two by two, not quite in step
      const vis = on && Math.abs(s) <= A.span;
      const looking = vis && k === A.n - 1 && X.turned && S.t - X.turned < 2.2;
      kid.back.root.visible = vis && !looking; kid.front.root.visible = looking;
      if (!vis || !tick) continue;
      for (const c of [kid.back, kid.front]) {
        c.root.position.set(A.x + A.px * s - A.pz * side, A.floor * this.floorH, A.z + A.pz * s + A.px * side);
        c.root.rotation.y = Math.atan2(camera.position.x - c.root.position.x, camera.position.z - c.root.position.z);
        c.mesh.position.y = looking ? 0 : Math.abs(Math.sin(s * 3.4)) * 0.035; // a step, on the beat
      }
    }
    if (on) {
      // a pool of light where they cross; down your own corridor, one over the middle of the line as it first stood
      const A = X.line, m = A.across ? 0 : A.from - (pairsOf(A) - 1) * A.gap / 2;
      lights.push({ x: A.x + A.px * m, y: A.floor * this.floorH + 2.6, z: A.z + A.pz * m, I: 0.75 });
    }
    // the sanctuary
    const sanct = X?.kind === 'sanctuary' && X.phase === 'on' && X.zone.floor === S.player.floor;
    if (sanct) {
      this.ensureProps();
      this.props.position.set(X.zone.cx + 1.1, X.zone.floor * this.floorH, X.zone.cz + 1.1);
      lights.push({ x: X.zone.cx, y: X.zone.floor * this.floorH + 2.4, z: X.zone.cz, I: 0.7 });
    }
    if (this.props) this.props.visible = !!sanct;
    return lights;
  }

  dispose() { for (const k of this.kids) this.scene.remove(k.back.root, k.front.root); this.kids = []; if (this.props) this.scene.remove(this.props); this.props = null; }
}
