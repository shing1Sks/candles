// THINGS THAT MOVE, so the street is never still:
//   leaves   blown along the road in gusts, tumbling, catching in the gutters, kicked up when you run
//   mist     low soft banks drifting across the road, thicker in the park, on the bridge, up the hill
//   moths    circling every lit lamp
//   smoke    from the chimneys of the houses near you (someone is home in all of them)
//   puddles  real ones, black glass on the setts with every lamp in them
import * as THREE from 'three';
import { at as roadAt, toRoad, groundAt, regionAt, N as roadN } from '../sim/road.js';
import { U, inject } from './materials.js';
const _fw = new THREE.Vector3(), _to = new THREE.Vector3();

function softTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  for (let i = 0; i < 14; i++) { const x = 30 + Math.random() * 68, y = 30 + Math.random() * 68, r = 20 + Math.random() * 30, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
  const t = new THREE.CanvasTexture(c); return t;
}
function leafTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.beginPath(); g.moveTo(32, 4); g.bezierCurveTo(58, 18, 52, 46, 32, 60); g.bezierCurveTo(12, 46, 6, 18, 32, 4); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(32, 6); g.lineTo(32, 60); g.stroke();
  for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(32, 16 + k * 10); g.lineTo(18, 10 + k * 10); g.moveTo(32, 16 + k * 10); g.lineTo(46, 10 + k * 10); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// soft cards that turn to face you (about the vertical axis), all in one draw
class Cards {
  constructor(scene, n, tex, color, renderOrder = 3) {
    this.n = n;
    const g = new THREE.InstancedBufferGeometry(); g.copy(new THREE.PlaneGeometry(1, 1)); g.instanceCount = n;
    this.pos = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3); this.size = new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2); this.alpha = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
    g.setAttribute('iPos', this.pos); g.setAttribute('iSize', this.size); g.setAttribute('iAlpha', this.alpha);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { ...THREE.UniformsLib.fog, map: { value: tex }, uColor: { value: new THREE.Color(color) }, uOpacity: { value: 1 } }, transparent: true, depthWrite: false, fog: true,
      vertexShader: `attribute vec3 iPos; attribute vec2 iSize; attribute float iAlpha; varying vec2 vUv; varying float vA;
        #include <fog_pars_vertex>
        void main(){ vUv = uv; vA = iAlpha;
          vec3 toCam = cameraPosition - iPos; toCam.y = 0.; vec3 right = normalize(cross(vec3(0., 1., 0.), normalize(toCam + vec3(1e-4))));
          vec3 wp = iPos + right * position.x * iSize.x + vec3(0., 1., 0.) * position.y * iSize.y;
          vec4 mvPosition = viewMatrix * vec4(wp, 1.); gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform sampler2D map; uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv; varying float vA;
        #include <fog_pars_fragment>
        void main(){ vec4 t = texture2D(map, vUv); gl_FragColor = vec4(uColor, t.a * vA * uOpacity);
          #include <fog_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = renderOrder; scene.add(this.mesh);
  }
  set(i, x, y, z, w, h, a) { this.pos.setXYZ(i, x, y, z); this.size.setXY(i, w, h); this.alpha.setX(i, a); }
  done() { this.pos.needsUpdate = this.size.needsUpdate = this.alpha.needsUpdate = true; }
}

export class Fx {
  constructor(scene) {
    this.scene = scene; this.t = 0;
    // ---- rain: 2400 streaks in a box around you, falling in the shader, tilted by the wind
    { const N = 2400, pos = new Float32Array(N * 2 * 3), end = new Float32Array(N * 2);
      for (let i = 0; i < N; i++) { const x = Math.random() * 26, y = Math.random() * 14, z = Math.random() * 26; pos.set([x, y, z, x, y, z], i * 6); end[i * 2] = 0; end[i * 2 + 1] = 1; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
      this.rainU = { uTime: U.uTime, uCam: { value: new THREE.Vector3() }, uRain: { value: 0 }, uWindX: { value: 0.3 } };
      const m = new THREE.ShaderMaterial({ uniforms: this.rainU, transparent: true, depthWrite: false,
        vertexShader: `attribute float aEnd; uniform float uTime, uRain, uWindX; uniform vec3 uCam; varying float vA;
          void main(){ vec3 box = vec3(26., 14., 26.); vec3 p = position; p.y -= uTime * 9.0 + position.x * 3.1; p.x += uWindX * uTime * 9.0 * 0.15;
            p = mod(p - uCam + box * 0.5, box) + uCam - box * 0.5;
            p.y += aEnd * 0.42; p.x += aEnd * uWindX * 0.06;
            vA = uRain * (1.0 - aEnd * 0.7) * step(fract(position.z * 7.31), uRain + 0.05);
            gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.); }`,
        fragmentShader: 'varying float vA; void main(){ gl_FragColor = vec4(vec3(0.62, 0.64, 0.75), vA * 0.32); }' });
      this.rain = new THREE.LineSegments(g, m); this.rain.frustumCulled = false; this.rain.renderOrder = 6; scene.add(this.rain); }
    // ---- splashes: little rings opening on the ground all round you when it rains (all in the shader:
    // each one has its own spot in a box round you and its own moment; the ground is a plane through
    // your feet tilted with the road's slope)
    { const N = 700, g = new THREE.InstancedBufferGeometry(); g.copy(new THREE.RingGeometry(0.82, 1.0, 14, 1)); g.rotateX(-Math.PI / 2); g.instanceCount = N;
      const off = new Float32Array(N * 3); for (let i = 0; i < N; i++) off.set([Math.random() * 16, Math.random(), Math.random() * 16], i * 3);
      g.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 3));
      this.splashU = { uTime: U.uTime, uCam: { value: new THREE.Vector3() }, uRain: { value: 0 }, uGround: { value: new THREE.Vector3() } };
      const m = new THREE.ShaderMaterial({ uniforms: this.splashU, transparent: true, depthWrite: false,
        vertexShader: `attribute vec3 aOff; uniform float uTime, uRain; uniform vec3 uCam, uGround; varying float vA;
          void main(){ float ph = fract(uTime * 2.2 + aOff.y), cyc = floor(uTime * 2.2 + aOff.y);
            vec2 xz = aOff.xz + vec2(fract(sin(cyc * 12.9 + aOff.y * 78.2) * 437.5), fract(sin(cyc * 39.3 + aOff.x) * 151.7)) * 3.0;
            xz = mod(xz - uCam.xz + 8.0, 16.0) + uCam.xz - 8.0;
            float y = uGround.x + (xz.y - uGround.z) * uGround.y + 0.015;          // a plane through your feet, tilted with the road
            float r = 0.01 + ph * 0.06;
            vA = (1. - ph) * (1. - ph) * uRain * step(aOff.y, uRain);
            gl_Position = projectionMatrix * viewMatrix * vec4(xz.x + position.x * r, y, xz.y + position.z * r, 1.); }`,
        fragmentShader: 'varying float vA; void main(){ gl_FragColor = vec4(vec3(0.7, 0.72, 0.8), vA * 0.22); }' });
      this.splash = new THREE.Mesh(g, m); this.splash.frustumCulled = false; this.splash.renderOrder = 6; scene.add(this.splash); }
    // ---- leaves
    const N = 420; this.N = N;
    const lm = inject(new THREE.MeshStandardMaterial({ map: leafTex(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 }), {});
    this.leaves = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.11, 0.13), lm, N); this.leaves.frustumCulled = false; this.leaves.receiveShadow = true;
    const cols = [0x9a4a22, 0x7a3a1a, 0xb0782a, 0x6a4a2a, 0x8a5a2a, 0x5a3020];
    this.L = Array.from({ length: N }, (_, i) => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rx: Math.random() * 6, ry: Math.random() * 6, rz: Math.random() * 6, spin: 0, rest: true, init: false }));
    const c = new THREE.Color(); for (let i = 0; i < N; i++) this.leaves.setColorAt(i, c.setHex(cols[i % cols.length]));
    scene.add(this.leaves);
    this.gust = 0; this.gustT = 3;
    // ---- mist: big soft cards lying low, facing the camera on Y only
    const mt = softTex();
    this.mistC = new Cards(scene, 22, mt, 0x5e5878, 3);
    this.mist = Array.from({ length: 22 }, () => ({ s: 0, l: 0, ph: Math.random() * 10, init: false, k: 1 }));
    // ---- moths
    const mg = new THREE.BufferGeometry(); this.MN = 60; mg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.MN * 3), 3));
    this.moths = new THREE.Points(mg, new THREE.PointsMaterial({ color: 0xfff0d0, size: 0.035, transparent: true, opacity: 0.9, depthWrite: false })); this.moths.frustumCulled = false; scene.add(this.moths);
    this.mothPh = Array.from({ length: this.MN }, () => [Math.random() * 6, Math.random() * 6, 0.4 + Math.random() * 0.7, 2 + Math.random() * 3]);
    // ---- chimney smoke
    this.smokeC = new Cards(scene, 70, mt, 0x6a6670, 4);
    this.smoke = Array.from({ length: 70 }, () => ({ life: 0 }));
    // ---- eyes in a garden: two points of shine, low down, that blink and are gone when you come close
    { const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.4, 1.2), fog: true }), g = new THREE.SphereGeometry(0.02, 8, 6);
      this.eyes = new THREE.Group(); this.eyes.visible = false; scene.add(this.eyes);
      for (const x of [-0.05, 0.05]) { const e = new THREE.Mesh(g, m); e.position.x = x; this.eyes.add(e); } this.eyesM = m; }
    // ---- someone at the edge of your eye: a tall dark shape in a garden, a pale smudge of a face.
    // It's only ever there while you're not quite looking; turn to it and the garden is empty
    { const dark = new THREE.MeshStandardMaterial({ color: 0x07070a, roughness: 1 }), pale = new THREE.MeshStandardMaterial({ color: 0xb8b2a4, roughness: 0.6, emissive: 0x16140f });
      const f = this.figure = new THREE.Group(); f.visible = false; scene.add(f);
      const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.34, 2.05, 10), dark); coat.position.y = 1.08; f.add(coat);
      const sh = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), dark); sh.scale.set(1.3, 0.6, 0.8); sh.position.y = 2.08; f.add(sh);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), pale); head.scale.set(0.85, 1.15, 0.9); head.position.set(0.05, 2.36, 0); head.rotation.z = -0.4; f.add(head);
      const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.34, 12), dark); hat.position.set(0.1, 2.62, 0); hat.rotation.z = -0.4; f.add(hat);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 14), dark); brim.position.set(0.07, 2.47, 0); brim.rotation.z = -0.4; f.add(brim);
      for (const s of [-1, 1]) { const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1.25, 6), dark); arm.position.set(s * 0.27, 1.45, 0); arm.rotation.z = s * 0.06; f.add(arm); }
      f.traverse((o) => { if (o.isMesh) o.castShadow = false; }); }
  }

  // an omen you can see (the director's; the sound is in audio.js)
  omen(e, P, camera) {
    if (e.kind === 'figure' && camera) {
      // off to the side, where you'd only catch it out of the corner of your eye
      const fw = new THREE.Vector3(); camera.getWorldDirection(fw); fw.y = 0; fw.normalize();
      const side = Math.random() < 0.5 ? -1 : 1, ang = side * (1.05 + Math.random() * 0.25), d = 9 + Math.random() * 5;
      const dir = fw.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), ang), x = P.x + dir.x * d, z = P.z + dir.z * d;
      const rc = toRoad(x, z), l = Math.sign(rc.l || side) * Math.min(6.6, Math.max(5.2, Math.abs(rc.l))), p = roadAt(rc.s, l);
      this.figure.position.set(p.x, groundAt(p.x, p.z), p.z); this.figure.lookAt(P.x, this.figure.position.y, P.z); this.figure.visible = true; this.figT = 0;
    }
    if (e.kind === 'eyes') { this.eyes.position.set(e.x, e.y, e.z); this.eyes.visible = true; this.eyesT = 0; this.eyesUntil = 14; this.eyesBlink = 1.5 + Math.random() * 2; this.eyes.scale.set(1, 1, 1); this.eyesM.color.setRGB(Math.random() < 0.5 ? 2.6 : 1.4, 2.4, Math.random() < 0.5 ? 1.2 : 2.2); }
  }

  // P: player; lamps: lit bulbs near [{x,y,z}]; chimneys: [{x,y,z}] near; fear 0..1; running
  update(dt, P, camera, lamps, chimneys, fear) {
    this.t += dt;
    if (this.figure.visible) {
      // look at it (inside ~26 degrees), or leave it long enough, and it's gone
      this.figT += dt; const fw = _fw; camera.getWorldDirection(fw); const to = _to.copy(this.figure.position).setY(camera.position.y + 0.6).sub(camera.position).normalize();
      if (fw.dot(to) > 0.9 || this.figT > 7) { this.figure.visible = false; this.figGone = (this.figGone || 0) + 1; }
    }
    if (this.eyes.visible) {
      // they watch you (facing you), blink now and then, and go out when you get close or look too long
      this.eyesT += dt; this.eyes.lookAt(camera.position.x, this.eyes.position.y, camera.position.z);
      this.eyesBlink -= dt; const b = this.eyesBlink < 0 ? Math.max(0.05, 1 - Math.abs(this.eyesBlink + 0.08) * 12) : 1; if (this.eyesBlink < -0.16) this.eyesBlink = 1.5 + Math.random() * 3;
      this.eyes.scale.y = b;
      const d = Math.hypot(this.eyes.position.x - P.x, this.eyes.position.z - P.z);
      if (d < 5.5 || this.eyesT > this.eyesUntil) this.eyes.visible = false;
    }
    const reg = regionAt(P.s).id;
    // the weather turns as you go: dry until the park, a drizzle in it, rain up the hill
    const rainWant = P.s < 1000 ? 0 : P.s < 1250 ? Math.min(0.45, (P.s - 1000) / 120) : Math.min(1, 0.45 + (P.s - 1250) / 150);
    this.rainLevel = (this.rainLevel ?? 0) + (rainWant - (this.rainLevel ?? 0)) * Math.min(1, dt * 0.3);
    this.rainU.uRain.value = this.rainLevel; this.rainU.uCam.value.copy(camera.position);
    this.rain.visible = this.splash.visible = this.rainLevel > 0.01;
    this.splashU.uRain.value = this.rainLevel; this.splashU.uCam.value.copy(camera.position);
    { const a = roadAt(P.s, P.l), b = roadAt(P.s + 1, P.l); this.splashU.uGround.value.set(P.y, (b.y - a.y) / (b.z - a.z || -1), P.z); } this.rainU.uWindX.value = 0.3 + this.gust * 0.8;
    // ---- wind gusts come and go
    this.gustT -= dt; if (this.gustT < 0) { this.gust = 1; this.gustT = 6 + Math.random() * 12; }
    this.gust = Math.max(0, this.gust - dt * 0.35);
    const wind = 0.4 + this.gust * 2.6 + fear * 0.8;
    U.uWind.value.set(0.04 + this.gust * 0.08 + fear * 0.03, 0.02 + this.gust * 0.03);
    const wdx = 0.6, wdz = 0.8; // the wind blows up the road and across it
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(1, 1, 1), pos = new THREE.Vector3();
    // only leaves that move cost anything; resting ones are checked for respawn a few at a time
    this.cursor = ((this.cursor || 0) + 37) % this.N;
    let dirty = false;
    for (let i = 0; i < this.N; i++) {
      const L = this.L[i];
      const check = !L.init || (i >= this.cursor && i < this.cursor + 37);
      if (check) {
        const d2 = (L.x - P.x) ** 2 + (L.z - P.z) ** 2;
        if (!L.init || d2 > 30 * 30) {
          const s = P.s + (Math.random() * 46 - 16), l = (Math.random() < 0.6 ? (Math.random() < 0.5 ? -1 : 1) * (2.4 + Math.random() * 2.4) : Math.random() * 5.6 - 2.8);
          const p = roadAt(s, l); L.x = p.x; L.z = p.z; L.gy = groundAt(p.x, p.z) + 0.012; L.y = L.gy; L.vx = L.vy = L.vz = 0; L.rest = true; L.init = true; L.rx = -Math.PI / 2 + (Math.random() - 0.5) * 0.4; L.rz = Math.random() * 6; L.dirty = true;
        }
      }
      if (L.rest) {
        const near = P.speed > 2.2 && (L.x - P.x) ** 2 + (L.z - P.z) ** 2 < 1.2;
        if (Math.random() < dt * this.gust * 0.6 || near) { L.rest = false; L.vy = 0.6 + Math.random() * (near ? 1.6 : 1.0); L.vx = (Math.random() - 0.5) * 0.6; L.vz = (Math.random() - 0.5) * 0.6; L.spin = (Math.random() - 0.5) * 9; }
        else if (this.gust > 0.3 && Math.random() < 0.5) { L.x += wdx * this.gust * dt * 0.8; L.z -= wdz * this.gust * dt * 0.3; L.rz += dt * 3; L.dirty = true; }
      }
      if (!L.rest) {
        L.vx += (wdx * wind - L.vx) * dt * 1.4 + (Math.random() - 0.5) * dt * 3; L.vz += (-wdz * wind * 0.4 - L.vz) * dt * 1.4 + (Math.random() - 0.5) * dt * 3;
        L.vy -= dt * 1.2; L.vy *= 0.985;
        L.x += L.vx * dt; L.y += L.vy * dt; L.z += L.vz * dt;
        L.rx += L.spin * dt; L.rz += L.spin * 0.7 * dt;
        if (L.y <= L.gy) { L.gy = groundAt(L.x, L.z) + 0.012; if (L.y <= L.gy) { L.y = L.gy; if (Math.random() < 0.3 || this.gust < 0.2) { L.rest = true; L.rx = -Math.PI / 2 + (Math.random() - 0.5) * 0.4; } else L.vy = Math.abs(L.vy) * 0.3; } }
        L.dirty = true;
      }
      if (L.dirty) { e.set(L.rx, L.ry, L.rz); q.setFromEuler(e); pos.set(L.x, L.y, L.z); m4.compose(pos, q, sc); this.leaves.setMatrixAt(i, m4); L.dirty = false; dirty = true; }
    }
    if (dirty) this.leaves.instanceMatrix.needsUpdate = true;
    // ---- mist: thicker in the park, on the bridge and the hill, and when it's bad
    const thick = (reg === 'parkEdge' ? 0.5 : reg === 'hill' ? 0.55 : reg === 'longStreet' ? 0.25 : 0.15) + fear * 0.25;
    this.mistC.mat.uniforms.uOpacity.value = thick * 0.28;
    this.mist.forEach((M, i) => {
      M.ph += dt * 0.08;
      if (Math.abs(M.s - P.s) > 40 || !M.init) { M.s = P.s + 6 + Math.random() * 40 * (Math.random() < 0.85 ? 1 : -0.4); M.l = (Math.random() - 0.5) * 14; M.init = true; M.k = 0.8 + Math.random() * 1.2; }
      M.l += dt * 0.35 * (1 + this.gust);
      if (M.l > 9) M.l = -9;
      const p = roadAt(M.s, M.l, 0.45 + Math.sin(M.ph) * 0.15);
      this.mistC.set(i, p.x, p.y, p.z, 9 * M.k, 1.6 * M.k, 1);
    });
    this.mistC.done();
    // ---- moths around the nearest lit lamps
    const mp = this.moths.geometry.attributes.position;
    for (let i = 0; i < this.MN; i++) {
      const L = lamps[i % Math.max(1, Math.min(4, lamps.length))];
      if (!L) { mp.setXYZ(i, 0, -99, 0); continue; }
      const [a, b, r, sp] = this.mothPh[i], t = this.t * sp;
      mp.setXYZ(i, L.x + Math.cos(t + a) * r * (0.6 + 0.4 * Math.sin(t * 1.7 + b)), L.y - 0.2 + Math.sin(t * 1.3 + b) * 0.35, L.z + Math.sin(t * 0.9 + a) * r);
    }
    mp.needsUpdate = true;
    // ---- chimney smoke: puffs rise, lean with the wind, spread and fade
    this.smoke.forEach((S, i) => {
      if (S.life <= 0) {
        if (!chimneys.length || Math.random() > dt * 9) { this.smokeC.set(i, 0, -99, 0, 0, 0, 0); return; }
        const c = chimneys[Math.floor(Math.random() * chimneys.length)];
        S.life = 6 + Math.random() * 3; S.age = 0; S.x = c.x; S.y = c.y; S.z = c.z;
      }
      S.life -= dt; S.age += dt;
      S.x += (wdx * 0.4 * wind + Math.sin(S.age * 1.3) * 0.1) * dt; S.z -= wdz * 0.15 * wind * dt; S.y += (0.6 - S.age * 0.04) * dt;
      const k = 0.4 + S.age * 0.35;
      this.smokeC.set(i, S.x, S.y, S.z, k, k, Math.min(1, S.age * 2) * Math.max(0, S.life / 6) * 0.35);
    });
    this.smokeC.done();
  }
}

// puddles: built with each segment. Black glass that the lamps shine in (the lamp BRDF in the
// material does the highlights; the environment map gives them the sky)
let PM = null;
export function puddles(group, s0, s1, rng) {
  if (!PM) PM = inject(new THREE.MeshStandardMaterial({ envMap: U.env, color: 0x050608, roughness: 0.06, metalness: 0.1, envMapIntensity: 1.5, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }), {});
  for (let k = 0; k < 3; k++) {
    const s = s0 + rng.range(1, 23), l = rng.chance(0.6) ? (rng.chance(0.5) ? -1 : 1) * rng.range(1.9, 2.7) : rng.range(-1.5, 1.5);
    const p = roadAt(s, l), sh = new THREE.Shape(), n = 14, rx = rng.range(0.4, 1.3), rz = rng.range(0.3, 0.9);
    for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2, r = 1 + Math.sin(a * 3 + s) * 0.15 + Math.sin(a * 5) * 0.08; const x = Math.cos(a) * rx * r, y = Math.sin(a) * rz * r; i ? sh.lineTo(x, y) : sh.moveTo(x, y); }
    const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), PM);
    m.rotation.set(-Math.PI / 2, 0, rng.range(0, 6)); m.position.set(p.x, groundAt(p.x, p.z) - (Math.abs(l) < 2.9 ? 0.06 * (Math.abs(l) / 2.8) ** 2 : 0) + 0.012, p.z);
    m.receiveShadow = true; m.renderOrder = 1; group.add(m);
  }
}
