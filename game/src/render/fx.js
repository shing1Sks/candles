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

// Dust hanging in the candlelight (you only see it where the light is), and cobwebs in the corners.
export function createDetails(scene, L, U) {
  const pts = [], rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  for (const c of L.candles) for (let i = 0; i < 70; i++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 3.2;
    pts.push(c.x + Math.cos(a) * r, 0.15 + rnd() * 1.3, c.z + Math.sin(a) * r, rnd() * 100);
  }
  for (let i = 0; i < 500; i++) pts.push(rnd() * L.w, 0.1 + rnd() * 1.4, rnd() * L.h, rnd() * 100); // the searchlight finds some too
  const g = new THREE.BufferGeometry();
  const arr = new Float32Array(pts.length / 4 * 3), ph = new Float32Array(pts.length / 4);
  for (let i = 0; i < pts.length / 4; i++) { arr[i * 3] = pts[i * 4]; arr[i * 3 + 1] = pts[i * 4 + 1]; arr[i * 3 + 2] = pts[i * 4 + 2]; ph[i] = pts[i * 4 + 3]; }
  g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  g.setAttribute('phase', new THREE.BufferAttribute(ph, 1));
  const dust = new THREE.Points(g, new THREE.ShaderMaterial({
    uniforms: { uLight: U.uLight, uVis: U.uVis, uSize: U.uSize, uTime: U.uTime, uScale: { value: 300 } },
    vertexShader: /* glsl */ `
      uniform sampler2D uLight, uVis; uniform vec2 uSize; uniform float uTime, uScale;
      attribute float phase; varying float vA;
      void main() {
        vec3 p = position + vec3(sin(uTime * 0.13 + phase) * 0.35, sin(uTime * 0.07 + phase * 1.7) * 0.2, cos(uTime * 0.11 + phase * 0.6) * 0.35);
        vec2 uv = p.xz / uSize;
        vA = texture2D(uLight, uv).r * texture2D(uVis, uv).r * (0.5 + 0.5 * sin(uTime * 0.9 + phase * 3.0));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uScale * 0.012 / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() { float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(vA * 0.55 * smoothstep(0.5, 0.0, d)), 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  dust.frustumCulled = false;
  scene.add(dust);

  // cobwebs: drawn once on a canvas, hung across the top corners of the rooms
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const x = cv.getContext('2d');
  x.strokeStyle = 'rgba(255,255,255,0.7)'; x.lineWidth = 0.8;
  const spokes = 9;
  for (let i = 0; i < spokes; i++) { const a = (i / (spokes - 1)) * Math.PI / 2; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a) * 128, Math.sin(a) * 128); x.stroke(); }
  for (let r = 14; r < 128; r += 12 + rnd() * 8) {
    x.beginPath();
    for (let i = 0; i < spokes; i++) {
      const a = (i / (spokes - 1)) * Math.PI / 2, rr = r * (0.9 + rnd() * 0.15);
      const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
      if (i) x.quadraticCurveTo(Math.cos(a - 0.1) * rr * 0.92, Math.sin(a - 0.1) * rr * 0.92, px, py); else x.moveTo(px, py);
    }
    x.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  const webMat = new THREE.ShaderMaterial({
    uniforms: { tWeb: { value: tex }, uLight: U.uLight, uVis: U.uVis, uSize: U.uSize },
    vertexShader: 'varying vec2 vUv; varying vec3 vW; void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: /* glsl */ `
      uniform sampler2D tWeb, uLight, uVis; uniform vec2 uSize; varying vec2 vUv; varying vec3 vW;
      void main() { vec2 uv = vW.xz / uSize; float l = 0.02 + texture2D(uLight, uv).r * texture2D(uVis, uv).r;
        gl_FragColor = vec4(vec3(1.0), texture2D(tWeb, vUv).a * min(1.0, l) * 0.55); }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const webGeo = new THREE.PlaneGeometry(0.8, 0.8);
  webGeo.translate(0.4, -0.4, 0); // the corner of the texture sits at the plane's corner
  const corners = [[4, 4, 0], [13, 4, 1], [14, 11, 3], [24, 4, 0], [33, 11, 2], [4, 19, 3], [13, 12, 1], [24, 19, 3], [33, 12, 1], [22, 4, 1]];
  for (const [cx, cz, k] of corners) {
    const m = new THREE.Mesh(webGeo, webMat);
    // spanned between the two walls of the corner, leaning out into the room
    m.position.set(cx, 1.5, cz);
    m.rotation.set(0, Math.PI / 4 - k * Math.PI / 2 + Math.PI, 0);
    m.rotateX(-0.5);
    scene.add(m);
  }
  return { dust };
}
