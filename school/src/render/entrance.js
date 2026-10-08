// THE FRONT DOORS: when a dead end turns out to be the entrance, its end wall becomes a pair of tall
// doors with warm light coming under them, the only warm light in the school.
import * as THREE from 'three';
import { makePaperLit } from './paperlit.js';

const SIDE_VEC = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };

export class EntranceView {
  constructor(scene, T) {
    this.scene = scene;
    this.mat = makePaperLit(T.door2.tex, { side: THREE.DoubleSide, color: 0xd8d0c0 });
    this.glow = new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    this.views = new Map();
  }

  sync(S, layout) {
    for (const key of Object.keys(S.layout.entrances)) {
      if (this.views.has(key)) continue;
      const c = layout.chunkByKey(key);
      if (!c.deadEnd) continue;
      const g = new THREE.Group(), d = c.deadEnd, [nx, nz] = SIDE_VEC[d.side];
      // two leaves side by side on the end wall, 2.5 m tall, a strip of warm light at the floor
      for (const s of [-1, 1]) {
        const leaf = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 2.5), this.mat);
        const ax = nz !== 0 ? 1 : 0, az = nx !== 0 ? 1 : 0;
        leaf.position.set(d.x - nx * 0.06 + ax * s * 0.64, 1.25, d.z - nz * 0.06 + az * s * 0.64);
        leaf.rotation.y = Math.atan2(-nx, -nz);
        g.add(leaf);
      }
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.05), this.glow);
      strip.position.set(d.x - nx * 0.07, 0.03, d.z - nz * 0.07); strip.rotation.y = Math.atan2(-nx, -nz);
      g.add(strip);
      this.scene.add(g);
      this.views.set(key, { group: g, light: { x: d.x - nx * 1.2, y: 1.2, z: d.z - nz * 1.2, I: 0.9 } });
    }
    for (const [key, v] of this.views) if (!S.layout.entrances[key]) { this.scene.remove(v.group); this.views.delete(key); }
    return [...this.views.values()].map((v) => v.light);
  }

  dispose() { for (const v of this.views.values()) this.scene.remove(v.group); this.views.clear(); }
}
