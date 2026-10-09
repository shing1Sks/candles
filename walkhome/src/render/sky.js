// THE SKY. A dome that follows you: deep violet overhead, the town's dirty orange glow low on the
// horizon, stars that twinkle, a big moon with a halo, and cloud drifting across it so the
// moonlight itself comes and goes. The same sky is baked once into an environment map so wet
// cobbles, slates and window glass reflect it.
import * as THREE from 'three';
import { U } from './materials.js';

export const SKY_U = {
  uMoonDir: { value: new THREE.Vector3(-0.35, 0.42, -0.84).normalize() },
  uCloud: { value: 0.55 },   // cloud cover
  uHorizon: { value: new THREE.Color(0.10, 0.075, 0.09) },
  uZenith: { value: new THREE.Color(0.012, 0.012, 0.03) },
  uGlow: { value: new THREE.Color(0.2, 0.09, 0.04) },
  uStarLimit: { value: 4.2 }, // faintest star you can see (magnitude): the lamps' glare hides the rest
  uHalo22: { value: 0 },      // the ring round the moon that comes before rain
  uMeteor: { value: new THREE.Vector4(0, 0, 0, -1) }, // a shooting star: start direction (xyz), progress 0..1 (w < 0: none)
  uMeteorDir: { value: new THREE.Vector3(1, 0, 0) },
};

// the sky, built like the real one (then pushed a little toward a picture book):
//   - the town's sodium glow sits low on the horizon, strongest toward the middle of town, and the
//     cloud base is lit dirty orange from below by it
//   - stars with a real brightness spread (most faint, a few bright), coloured by temperature,
//     twinkling more near the horizon where there's more air; how many you see depends on glare
//   - the moon: a gibbous disc lit Lommel-Seeliger style (flat, as the real one looks, not a ball),
//     seas and craters, a faint earthshine on the dark side, a corona when thin cloud crosses it
//   - two layers of cloud, lit by the moon: dark bellies, silver edges where they cross it
const FRAG = /* glsl */`
  uniform float uTime, uCloud, uStarLimit, uHalo22; uniform vec3 uMoonDir, uHorizon, uZenith, uGlow, uMeteorDir; uniform vec4 uMeteor;
  varying vec3 vDir;
  float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); float a = h2(i), b = h2(i + vec2(1, 0)), c = h2(i + vec2(0, 1)), d = h2(i + 1.); return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
  float fbm(vec2 p){ float s = 0., a = 0.5; for (int i = 0; i < 5; i++) { s += a * n2(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
  float fbm3(vec2 p){ float s = 0., a = 0.5; for (int i = 0; i < 3; i++) { s += a * n2(p); p = p * 2.1 + 9.7; a *= 0.5; } return s; }
  // craters: a few rings in a cell grid on the moon's face
  float craters(vec2 p){ vec2 i = floor(p), f = fract(p); float v = 0.;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(x, y), o = vec2(h2(i + g), h2(i + g + 3.1)); float r = 0.18 + 0.25 * h2(i + g + 7.7);
      float d = length(g + o - f); v += smoothstep(r, r * 0.7, d) * -0.5 + smoothstep(r * 1.15, r, d) * smoothstep(r * 0.85, r, d) * 0.6; }
    return v; }
  void main(){
    vec3 d = normalize(vDir); float el = d.y;
    // ---- the sky's own light: violet up high, the town's glow low down (more toward the town)
    vec3 col = mix(uHorizon, uZenith, smoothstep(-0.02, 0.5, el));
    vec2 town = normalize(vec2(-0.5, -0.86)); float toward = 0.55 + 0.45 * dot(normalize(d.xz + 1e-5), town);
    col += uGlow * (exp(-max(el, 0.) * 7.0) * 0.85 + exp(-max(el, 0.) * 2.2) * 0.12) * toward;
    // ---- stars: one per cell, at a jittered spot, magnitude from a power law
    float starsK = smoothstep(0.03, 0.35, el);
    for (int k = 0; k < 2; k++) {
      float sc = k == 0 ? 260. : 520.;
      vec3 sp = d * sc, ci = floor(sp), f = fract(sp) - 0.5; vec3 o = vec3(h(ci), h(ci + 1.3), h(ci + 2.7)) - 0.5;
      float m = 1.0 + 6.0 * pow(h(ci + 4.1), 0.45) + float(k) * 0.8;      // magnitude 1 (bright, rare) .. 7 (faint, many)
      float flux = pow(10., -0.4 * (m - 1.)) * smoothstep(uStarLimit + 0.4, uStarLimit - 0.6, m);
      float tw = 1. + (0.35 + 0.8 * (1. - smoothstep(0.05, 0.6, el))) * (n2(vec2(uTime * 6. + h(ci) * 40., h(ci + 9.) * 10.)) - 0.5);
      float r = length(f - o * 0.7) * (sc / 260.);
      vec3 tint = mix(vec3(0.75, 0.85, 1.15), vec3(1.15, 0.9, 0.7), h(ci + 5.5));
      col += tint * flux * tw * exp(-r * r * 90.) * 2.2 * starsK;
    }
    // ---- the moon
    float md = dot(d, uMoonDir);
    vec3 mx = normalize(cross(uMoonDir, vec3(0, 1, 0))), my = cross(mx, uMoonDir);
    vec2 mp = vec2(dot(d, mx), dot(d, my)) / 0.034;                         // -1..1 across the disc
    float r2 = dot(mp, mp), disc = (1. - smoothstep(0.96, 1.0, r2)) * step(0., md);
    vec3 n = vec3(mp, sqrt(max(0., 1. - r2)));
    vec3 sunM = normalize(vec3(0.75, 0.25, 0.62));                           // waning gibbous: lit from the right
    float mu0 = max(dot(n, sunM), 0.), mu = max(n.z, 0.05);
    float seas = smoothstep(0.42, 0.62, fbm(mp * 1.6 + 4.2)) * 0.42 + smoothstep(0.5, 0.7, fbm(mp * 3.1 + 1.3)) * 0.15;
    float alb = 0.95 - seas + craters(mp * 4.5) * 0.08 + craters(mp * 11.) * 0.05;
    vec3 moon = vec3(1.0, 0.96, 0.86) * alb * (mu0 / (mu0 + mu) * 2.0 + 0.025) * disc * 3.2;
    float glowM = pow(max(md, 0.), 900.) * 0.6 + pow(max(md, 0.), 60.) * 0.05 + pow(max(md, 0.), 8.) * 0.012;
    // the 22-degree halo (ice in a high thin veil: rain is coming)
    float ang = acos(clamp(md, -1., 1.)); float ring = exp(-pow((ang - 0.384) / 0.012, 2.)) * uHalo22;
    // ---- cloud: two layers on a sky plane, lit by the moon (one step toward it), bellies lit by the town
    vec2 cp = d.xz / max(el + 0.12, 0.04);
    vec2 wnd = vec2(uTime * 0.010, uTime * 0.003);
    vec2 toMoon = normalize(uMoonDir.xz / max(uMoonDir.y + 0.12, 0.04) - cp + 1e-4) * 0.06;
    float dens = fbm(cp * 0.8 + wnd), dl = fbm(cp * 0.8 + wnd + toMoon);
    float cl = smoothstep(1.0 - uCloud, 1.0 - uCloud + 0.33, dens) * smoothstep(-0.04, 0.18, el);
    float hi = smoothstep(0.45, 0.85, fbm3(cp * 0.35 + wnd * 1.7 + 30.)) * smoothstep(0.0, 0.25, el) * 0.5;   // a thin high veil
    float lit = exp(-max(dl - dens, 0.) * 6.);
    float silver = pow(max(md, 0.), 40.) * (1. - cl) * cl * 4.;                // thin edges near the moon shine
    vec3 cloudCol = vec3(0.022, 0.022, 0.034) + vec3(0.12, 0.12, 0.15) * lit * (0.25 + pow(max(md, 0.), 20.) * 1.5) + uGlow * 0.35 * exp(-max(el, 0.) * 3.5) * toward;
    cloudCol += vec3(0.7, 0.72, 0.85) * silver;
    // the corona: thin cloud over the moon makes a soft coloured disc round it
    float corona = exp(-ang / 0.03) * (hi + cl * (1. - cl) * 2.) * 0.8;
    col += vec3(0.75, 0.78, 0.95) * glowM * (1. - cl * 0.85) + vec3(0.8, 0.75, 0.7) * ring * 0.08 + vec3(0.9, 0.85, 0.8) * corona * 0.25;
    col += moon * (1. - hi * 0.5);
    // a shooting star: a short bright streak sliding along a great circle, fading at both ends
    if (uMeteor.w >= 0.) {
      vec3 a = normalize(uMeteor.xyz), b = normalize(uMeteorDir), head = normalize(a + b * uMeteor.w * 0.5), tail = normalize(a + b * max(0., uMeteor.w * 0.5 - 0.08));
      vec3 ab = head - tail; float h = clamp(dot(d - tail, ab) / dot(ab, ab), 0., 1.); float dd = length(d - tail - ab * h);
      col += vec3(1.0, 0.95, 0.85) * exp(-dd * dd / 0.0000035) * h * sin(uMeteor.w * 3.14159) * 3.0;
    }
    col = mix(col, cloudCol, cl * 0.94);
    col = mix(col, col * 0.7 + vec3(0.05, 0.05, 0.065) * (1. + pow(max(md, 0.), 30.) * 4.), hi * 0.6);
    gl_FragColor = vec4(col, 1.);
  }`;

export function makeSky() {
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...SKY_U, uTime: U.uTime }, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_Position = p.xyww; }',
    fragmentShader: FRAG,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 16), mat);
  mesh.renderOrder = -10; mesh.frustumCulled = false;
  return mesh;
}

// an environment map from the sky (for reflections), baked once
export function bakeEnv(renderer) {
  const s = new THREE.Scene(), sky = makeSky(); s.add(sky);
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(s, 0, 0.1, 1000);
  pm.dispose();
  return rt.texture;
}

// THE TOWN BEYOND. Past the rows either side there's more town: roofs, chimney pots, a church spire,
// a gasholder, bare trees, the odd lit window, all fading into the glow. A ring of silhouettes far
// out (it travels with you, so it never gets nearer), drawn into a canvas once.
export function makeSkyline() {
  const W = 4096, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const base = H * 0.62;                         // the horizon line in the texture
  // three ranks: far (pale, low), middle, near (darkest, tallest); alpha encodes the rank (shade)
  for (const [rank, shade, hmin, hmax] of [[0, 0.35, 6, 18], [1, 0.65, 10, 30], [2, 1.0, 14, 44]]) {
    g.fillStyle = `rgba(255,255,255,${shade})`;
    let x = -20;
    while (x < W + 20) {
      const w = 18 + rnd() * 50, h = hmin + rnd() * (hmax - hmin), kind = rnd();
      g.beginPath(); g.moveTo(x, H);
      if (kind < 0.4) { g.lineTo(x, base - h); g.lineTo(x + w / 2, base - h - w * (0.12 + rnd() * 0.3)); g.lineTo(x + w, base - h); }  // gable
      else if (kind < 0.85) { g.lineTo(x, base - h); g.lineTo(x + w, base - h); }                                                    // flat / terrace
      else { const t = 16 + rnd() * 30; g.lineTo(x, base - h); g.lineTo(x + w * 0.3, base - h); g.lineTo(x + w * 0.3, base - h - t); g.lineTo(x + w * 0.5, base - h - t - 4); g.lineTo(x + w * 0.7, base - h - t); g.lineTo(x + w * 0.7, base - h); g.lineTo(x + w, base - h); } // a tower
      g.lineTo(x + w, H); g.fill();
      // chimney pots
      if (rnd() < 0.6) { const cx = x + w * (0.2 + rnd() * 0.6); g.fillRect(cx, base - h - 10 - rnd() * 6, 4, 14); }
      x += w * (0.7 + rnd() * 0.5);
    }
  }
  // landmarks: a spire, a gasholder, bare trees
  g.fillStyle = 'rgba(255,255,255,0.8)';
  const spire = (x, h) => { g.beginPath(); g.moveTo(x - 10, base); g.lineTo(x - 10, base - h * 0.55); g.lineTo(x, base - h); g.lineTo(x + 10, base - h * 0.55); g.lineTo(x + 10, base); g.fill(); };
  spire(900, 120); spire(2900, 95);
  g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(1800, base - 70, 110, 70); for (let k = 0; k < 7; k++) g.fillRect(1800 + k * 18, base - 80, 2, 80);
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  const tree = (x, y, len, a, d) => { if (d > 6 || len < 2) return; const x2 = x + Math.sin(a) * len, y2 = y - Math.cos(a) * len; g.lineWidth = Math.max(0.6, 7 - d * 1.2); g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke(); tree(x2, y2, len * 0.72, a - 0.35 - rnd() * 0.3, d + 1); tree(x2, y2, len * 0.72, a + 0.35 + rnd() * 0.3, d + 1); };
  for (let k = 0; k < 14; k++) tree(rnd() * W, base + 2, 12 + rnd() * 14, (rnd() - 0.5) * 0.2, 0);
  // lit windows (red channel marks them, only where there's a building)
  const img = g.getImageData(0, 0, W, H);
  // and below the horizon (from up the hill you look down over it): a sea of small windows
  for (let k = 0; k < 2600; k++) { const x = Math.floor(rnd() * W), y = Math.floor(base + 2 + Math.pow(rnd(), 0.7) * (H - base - 4)); const i = (y * W + x) * 4; if (img.data[i + 3] > 200 && rnd() < 0.8) img.data[i] = 0; }
  for (let k = 0; k < 520; k++) { const x = Math.floor(rnd() * W), y = Math.floor(base - 4 - rnd() * 34 + rnd() * 20); const i = (y * W + x) * 4; if (img.data[i + 3] > 200) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) { const j = ((y + dy) * W + x + dx) * 4; img.data[j] = 0; } }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c); tex.wrapS = THREE.RepeatWrapping; tex.repeat.x = 2;
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, uHorizon: SKY_U.uHorizon, uGlow: SKY_U.uGlow, uTime: U.uTime },
    transparent: true, depthWrite: false, fog: false, side: THREE.BackSide,
    vertexShader: 'varying vec2 vUv; varying vec3 vDir; void main(){ vUv = uv * vec2(2., 1.); vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: /* glsl */`
      uniform sampler2D map; uniform vec3 uHorizon, uGlow; uniform float uTime; varying vec2 vUv; varying vec3 vDir;
      void main(){
        vec4 t = texture2D(map, vUv); if (t.a < 0.02) discard;
        float rank = t.a;                                 // nearer ranks are darker, the far ones lost in the glow
        vec3 sky = uHorizon + uGlow * 0.7;
        vec3 col = mix(sky * 0.72, sky * 0.3, rank);
        float win = (1. - t.r) * step(0.5, t.a);          // a lit window, twinkling as someone walks past it
        col += vec3(1.0, 0.62, 0.3) * win * (0.55 + 0.25 * sin(uTime * 0.3 + vUv.x * 900.)) * 0.28;
        gl_FragColor = vec4(col, smoothstep(0.02, 0.2, t.a));
      }`,
  });
  // the ring: 240 m out; the horizon line sits at your eye
  const geo = new THREE.CylinderGeometry(240, 240, 120, 96, 1, true); geo.translate(0, 120 * (0.62 - 0.5), 0);
  const m = new THREE.Mesh(geo, mat); m.renderOrder = -9; m.frustumCulled = false;
  return m;
}
