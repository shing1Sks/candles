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
};

const FRAG = /* glsl */`
  uniform float uTime, uCloud; uniform vec3 uMoonDir, uHorizon, uZenith, uGlow;
  varying vec3 vDir;
  float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); float a = h(vec3(i, 0.)), b = h(vec3(i + vec2(1, 0), 0.)), c = h(vec3(i + vec2(0, 1), 0.)), d = h(vec3(i + 1., 0.)); return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
  float fbm(vec2 p){ float s = 0., a = 0.5; for (int i = 0; i < 5; i++) { s += a * n2(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
  void main(){
    vec3 d = normalize(vDir); float el = d.y;
    vec3 col = mix(uHorizon, uZenith, smoothstep(-0.02, 0.45, el));
    col += uGlow * exp(-max(el, 0.) * 9.0) * 0.8;                               // the town's glow
    // stars
    vec3 sp = floor(d * 380.); float st = step(0.9975, h(sp)) * smoothstep(0.05, 0.3, el);
    col += vec3(0.8, 0.85, 1.0) * st * (0.5 + 0.5 * sin(uTime * (1.0 + h(sp + 1.) * 3.) + h(sp) * 40.));
    // the moon and its halo
    float md = dot(d, uMoonDir), disc = smoothstep(0.99935, 0.99955, md);
    vec2 mp = vec2(dot(d, normalize(cross(uMoonDir, vec3(0,1,0)))), d.y - uMoonDir.y) * 60.;
    float maria = fbm(mp * 1.2 + 3.) * 0.35;
    vec3 moon = vec3(1.0, 0.95, 0.82) * (1.15 - maria) * disc * 2.4;
    float halo = pow(max(md, 0.), 600.) * 0.5 + pow(max(md, 0.), 40.) * 0.06;
    // cloud: drifting fbm, lit from behind where the moon is
    vec2 cp = d.xz / max(el + 0.15, 0.05) * 0.9 + vec2(uTime * 0.012, uTime * 0.004);
    float cl = smoothstep(1.0 - uCloud, 1.0 - uCloud + 0.35, fbm(cp)) * smoothstep(-0.05, 0.2, el);
    vec3 cloudCol = mix(vec3(0.03, 0.028, 0.045), vec3(0.18, 0.17, 0.2), pow(max(md, 0.), 30.)) + uGlow * 0.25 * exp(-max(el, 0.) * 4.);
    col += vec3(0.75, 0.78, 0.95) * halo * (1. - cl * 0.8);
    col = mix(col + moon, cloudCol, cl * 0.92);
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
