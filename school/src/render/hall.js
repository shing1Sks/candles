// THE HALL DOORS: where a dead end is the Hall, its end wall becomes the chained double doors, lit
// from above by one weak lamp. No light comes from under them.
import * as THREE from 'three';
import { makePaperLit } from './paperlit.js';

const SIDE_VEC = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };

export class HallView {
  constructor(scene, T) {
    this.scene = scene;
    this.mat = makePaperLit(T.hallDoors.tex, { side: THREE.DoubleSide });
    this.geo = new THREE.PlaneGeometry(2.4, 2.55);
    this.views = new Map();
  }

  sync(S, layout) {
    for (const key of Object.keys(S.layout.hallDoors || {})) {
      if (this.views.has(key)) continue;
      const c = layout.chunkByKey(key);
      if (!c?.deadEnd) continue;
      const d = c.deadEnd, [nx, nz] = SIDE_VEC[d.side];
      const m = new THREE.Mesh(this.geo, this.mat);
      m.position.set(d.x - nx * 0.06, 2.55 / 2, d.z - nz * 0.06);
      m.rotation.y = Math.atan2(-nx, -nz);
      this.scene.add(m);
      this.views.set(key, { m, light: { x: d.x - nx * 1.0, y: 2.7, z: d.z - nz * 1.0, I: 0.45 } });
    }
    for (const [key, v] of this.views) if (!S.layout.hallDoors?.[key]) { this.scene.remove(v.m); this.views.delete(key); }
    return [...this.views.values()].map((v) => v.light);
  }
}
