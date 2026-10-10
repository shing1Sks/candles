// Ties the renderer together: a tilted top-down camera that follows the kid, the maps, the maze,
// the actors, and a grey film pass (gamma, vignette, grain, fear).
import * as THREE from 'three';
import { U } from './shade.js';
import { createMaps } from './maps.js';
import { buildWorld } from './world.js';
import { createKid, createMonster } from './actors.js';
import { createCandles } from './fx.js';
import { los } from '../sim/grid.js';
import { HEART } from '../sim/rules.js';

const OFFSET = new THREE.Vector3(0, 15.5, 9.4);

export function createView(canvas, L) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.autoClear = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0, 0, 0);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.5, 60);

  const maps = createMaps(renderer, L);
  U.uVis.value = maps.vis; U.uLight.value = maps.light;
  buildWorld(L, scene);
  const kid = createKid(), monster = createMonster();
  scene.add(kid.root, monster.root);
  const candles = createCandles(scene, L.candles);

  // film pass
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
  const post = new THREE.ShaderMaterial({
    uniforms: { tScene: { value: rt.texture }, uTime: { value: 0 }, uFear: { value: 0 }, uFlash: { value: 0 }, uDark: { value: 0 }, uAspect: { value: 1 }, uRes: { value: new THREE.Vector2() } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform sampler2D tScene; uniform float uTime, uFear, uFlash, uDark, uAspect; uniform vec2 uRes;
      varying vec2 vUv;
      float hash(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
      void main() {
        // fear squeezes the picture a little toward the middle
        vec2 q = vUv - 0.5;
        vec2 uv = 0.5 + q * (1.0 - uFear * 0.015 * (0.5 + 0.5 * sin(uTime * 9.0)));
        vec3 c = texture2D(tScene, uv).rgb;
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        l = pow(max(l, 0.0), 1.0 / 2.2);
        l = l * l * (3.0 - 2.0 * l) * 0.35 + l * 0.65;
        q.x *= uAspect;
        float v = 1.0 - smoothstep(0.3, 0.95, length(q)) * (0.7 + 0.3 * uFear);
        l *= v;
        l += (hash(floor(vUv * uRes) + fract(uTime * 7.3) * 91.0) - 0.5) * 0.07;
        l = mix(l, 1.0, uFlash);
        l *= 1.0 - uDark;
        gl_FragColor = vec4(vec3(l), 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post);
  quad.frustumCulled = false;
  const postScene = new THREE.Scene(); postScene.add(quad);
  const postCam = new THREE.Camera();

  const target = new THREE.Vector3(), tmp = new THREE.Vector3();
  let shake = 0, fade = 0, first = true;
  const st = { flash: 0, dark: 0 };

  function resize() {
    // render at most ~1 megapixel and let the browser scale it up: big screens stay smooth on laptop GPUs
    const w = canvas.clientWidth, h = canvas.clientHeight, pr = Math.min(1, Math.sqrt(1.0e6 / (w * h)));
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    rt.setSize(Math.round(w * pr), Math.round(h * pr));
    camera.aspect = w / h; camera.updateProjectionMatrix();
    post.uniforms.uAspect.value = w / h; post.uniforms.uRes.value.set(w * pr, h * pr);
    U.uCutR.value = h * pr * 0.13;
  }
  window.addEventListener('resize', resize);
  resize();

  return {
    renderer, camera, st,
    shake(a) { shake = Math.max(shake, a); },
    frame(G, dt, t) {
      const k = G.kid, M = G.monster;
      // camera: follow with a little look-ahead
      tmp.set(k.x + k.vx * 0.3, 0, k.z + k.vz * 0.3);
      if (first) { target.copy(tmp); first = false; }
      target.lerp(tmp, Math.min(1, dt * 4));
      camera.position.copy(target).add(OFFSET);
      shake = Math.max(0, shake - dt * 2.5);
      camera.position.x += (Math.random() - 0.5) * shake * 0.3;
      camera.position.z += (Math.random() - 0.5) * shake * 0.3;
      camera.lookAt(target);

      const inWall = L.sightBlocked(Math.floor(k.x), Math.floor(k.z));
      const intensities = candles.update(G, dt, t);
      maps.update(k.x, k.z, inWall, intensities);

      const d = Math.hypot(M.x - k.x, M.z - k.z);
      const awake = M.mode !== 'sleep';
      k.fear = awake ? Math.max(0, 1 - d / HEART.radius) : 0;
      kid.update(k, dt, t);
      monster.update(M, k, dt, t);
      // you only see it if the kid could
      const seen = !inWall && !L.sightBlocked(Math.floor(M.x), Math.floor(M.z)) && d < 16 && los(L, k.x, k.z, M.x, M.z);
      fade += ((seen ? 1 : 0) - fade) * Math.min(1, dt * 10);
      monster.setFade(fade);
      monster.root.visible = fade > 0.02;

      U.uTime.value = t;
      U.uKid.value.set(k.x, 0, k.z);
      tmp.set(k.x, 0.5, k.z).project(camera);
      const sz = renderer.getDrawingBufferSize(new THREE.Vector2());
      U.uKidPx.value.set((tmp.x * 0.5 + 0.5) * sz.x, (tmp.y * 0.5 + 0.5) * sz.y);

      post.uniforms.uTime.value = t;
      post.uniforms.uFear.value = k.fear;
      post.uniforms.uFlash.value = st.flash;
      post.uniforms.uDark.value = st.dark;
      renderer.setRenderTarget(rt);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(postScene, postCam);
    },
  };
}
