// Candles: a stub of wax on a saucer, a flame that breathes, a ring that fills while you blow,
// and a curl of smoke when it goes out.
import * as THREE from 'three';
import { mat } from './shade.js';
import { glowTexture } from './actors.js';

const FLAME_Y = 0.36;

export function createCandles(scene, candles) {
  const wax = mat({ color: 0.9 }), dish = mat({ color: 0.45 });
  const tex = glowTexture();
  const items = candles.map((c) => {
    const g = new THREE.Group();
    g.position.set(c.x, 0, c.z);
    const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.03, 16), dish);
    saucer.position.y = 0.015;
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.3 - c.id * 0.02, 12), wax);
    stick.position.y = 0.03 + (0.3 - c.id * 0.02) / 2;
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    flame.position.y = FLAME_Y - c.id * 0.02;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.position.y = flame.position.y; halo.scale.setScalar(1.6);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.4, 48, 1, Math.PI / 2, 0), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02;
    g.add(saucer, stick, flame, halo, ring);
    scene.add(g);
    return { c, g, flame, halo, ring, out: 0, shown: -1, seed: c.id * 13.7 };
  });

  // smoke: a few soft sprites rising and spreading
  const puffs = [];
  for (let i = 0; i < 40; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, color: 0x9a9a9a }));
    s.visible = false; scene.add(s);
    puffs.push({ s, life: 0, vx: 0, vz: 0 });
  }
  let next = 0;
  const smoke = (x, y, z) => {
    for (let i = 0; i < 10; i++) {
      const p = puffs[next++ % puffs.length];
      p.life = 1; p.age = -i * 0.12; p.s.visible = true;
      p.s.position.set(x, y, z); p.vx = (Math.random() - 0.5) * 0.15; p.vz = (Math.random() - 0.5) * 0.15;
    }
  };

  return {
    // returns each candle's light intensity for the light map
    update(G, dt, t) {
      const out = [];
      for (const it of items) {
        const lit = it.c.id < G.candles.length && G.candles[it.c.id].lit;
        if (!lit && it.out === 0) smoke(it.c.x, it.flame.position.y, it.c.z);
        it.out = lit ? 0 : Math.min(1, it.out + dt * 5);
        const f = 0.82 + 0.1 * Math.sin(t * 11 + it.seed) + 0.08 * Math.sin(t * 23.7 + it.seed * 2) + 0.05 * Math.sin(t * 3.1 + it.seed);
        const gust = G.candles[it.c.id].progress; // the flame bends and gutters while you blow
        const k = (1 - it.out) * f * (1 - gust * 0.55 * (0.6 + 0.4 * Math.sin(t * 40)));
        it.flame.scale.set(0.16 * k, 0.3 * k, 1);
        it.flame.position.x = gust * 0.04 * Math.sin(t * 31);
        it.halo.material.opacity = 0.16 * k;
        it.flame.visible = it.halo.visible = k > 0.01;
        const p = G.candles[it.c.id].progress;
        if (p !== it.shown) {
          it.ring.geometry.dispose();
          it.ring.geometry = new THREE.RingGeometry(0.34, 0.4, 48, 1, Math.PI / 2, -p * Math.PI * 2);
          it.shown = p;
        }
        it.ring.visible = lit && p > 0;
        it.ring.position.set(G.kid.x - it.c.x, 0.03, G.kid.z - it.c.z); // drawn round the kid's feet, never behind a wall
        out.push(k);
      }
      for (const p of puffs) {
        if (!p.s.visible) continue;
        p.age += dt;
        if (p.age < 0) { p.s.material.opacity = 0; continue; }
        const a = p.age / 2.4;
        if (a >= 1) { p.s.visible = false; continue; }
        p.s.position.x += p.vx * dt; p.s.position.z += p.vz * dt; p.s.position.y += dt * 0.35;
        p.s.scale.setScalar(0.12 + a * 0.6);
        p.s.material.opacity = 0.35 * (1 - a) * Math.min(1, p.age * 6);
      }
      return out;
    },
  };
}
