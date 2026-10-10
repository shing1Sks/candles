// Ties the renderer together. The maze is a board on a table; the giant playing the monster sits across it.
// Two ways to look (Z switches):
//   in    - you are in the house: a low camera just behind the kid, nearly level, always facing across the
//           board toward the giant (it never turns). Walls block what is ahead; the board's far edge is the
//           horizon and the giant rises beyond it.
//   table - sit back at the table and see the whole board and the giant.
// Then a grey film pass (gamma, vignette, grain, fear).
import * as THREE from 'three';
import { U } from './shade.js';
import { createMaps } from './maps.js';
import { buildWorld } from './world.js';
import { createKid, createMonster } from './actors.js';
import { createCandles, createDetails } from './fx.js';
import { createTable } from './table.js';
import { createProps } from './props.js';
import { WALL_H } from './world.js';
import { los } from '../sim/grid.js';
import { HEART } from '../sim/rules.js';

const lerp = (a, b, t) => a + (b - a) * t;

export function createView(canvas, L) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.autoClear = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0, 0, 0);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.3, 1500);

  const maps = createMaps(renderer, L);
  U.uVis.value = maps.vis; U.uLight.value = maps.light; U.uBounce.value = maps.bounce; U.uAO.value = maps.ao;
  buildWorld(L, scene);
  const kid = createKid(), monster = createMonster();
  scene.add(kid.root, monster.root);
  const candles = createCandles(scene, L.candles);
  createDetails(scene, L, U);
  const table = createTable(scene, camera, L);
  const props = createProps(scene, L);
  // the giant's fist hits the table: the whole board jumps
  table.giant.onImpact(() => { shake = Math.max(shake, 0.8); impact = 1; });
  const center = new THREE.Vector3(L.w / 2, 0, L.h / 2);

  // film pass
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
  const post = new THREE.ShaderMaterial({
    uniforms: { tScene: { value: rt.texture }, tBloom: { value: null }, uTime: { value: 0 }, uFear: { value: 0 }, uFlash: { value: 0 }, uDark: { value: 0 }, uHide: { value: 0 }, uAspect: { value: 1 }, uRes: { value: new THREE.Vector2() } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform sampler2D tScene, tBloom; uniform float uTime, uFear, uFlash, uDark, uAspect, uHide; uniform vec2 uRes;
      varying vec2 vUv;
      float hash(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
      void main() {
        // fear squeezes the picture a little toward the middle
        vec2 q = vUv - 0.5;
        vec2 uv = 0.5 + q * (1.0 - uFear * 0.015 * (0.5 + 0.5 * sin(uTime * 9.0)));
        vec3 c = texture2D(tScene, uv).rgb + texture2D(tBloom, uv).rgb * 0.55;
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        l = pow(max(l, 0.0), 1.0 / 2.2);
        l = l * l * (3.0 - 2.0 * l) * 0.35 + l * 0.65;
        q.x *= uAspect;
        float v = 1.0 - smoothstep(0.3, 0.95, length(q)) * (0.7 + 0.3 * uFear);
        l *= v;
        l += (hash(floor(vUv * uRes) + fract(uTime * 7.3) * 91.0) - 0.5) * 0.07;
        // hiding in a wardrobe: you look out between the slats of its door
        float slat = smoothstep(0.38, 0.46, abs(fract(vUv.y * 11.0 + 0.2) - 0.5) * 2.0);
        l *= mix(1.0, (0.06 + 0.94 * (1.0 - slat)) * (1.0 - smoothstep(0.15, 0.6, length(q)) * 0.8), uHide);
        l = mix(l, 1.0, uFlash);
        l *= 1.0 - uDark;
        gl_FragColor = vec4(vec3(l), 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post);
  quad.frustumCulled = false;
  const postScene = new THREE.Scene(); postScene.add(quad);
  // bloom at quarter size: keep what is bright, blur it twice, add it back in the film pass
  const bloomA = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType }), bloomB = bloomA.clone();
  const fsVert = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const brightMat = new THREE.ShaderMaterial({
    uniforms: { tScene: { value: rt.texture } }, vertexShader: fsVert, depthTest: false, depthWrite: false,
    fragmentShader: 'uniform sampler2D tScene; varying vec2 vUv; void main() { vec3 c = texture2D(tScene, vUv).rgb; float l = dot(c, vec3(0.333)); gl_FragColor = vec4(c * smoothstep(0.35, 1.2, l), 1.0); }',
  });
  const blurMat = new THREE.ShaderMaterial({
    uniforms: { tIn: { value: null }, uDir: { value: new THREE.Vector2() } }, vertexShader: fsVert, depthTest: false, depthWrite: false,
    fragmentShader: `uniform sampler2D tIn; uniform vec2 uDir; varying vec2 vUv;
      void main() { vec3 c = texture2D(tIn, vUv).rgb * 0.227;
        c += (texture2D(tIn, vUv + uDir * 1.385).rgb + texture2D(tIn, vUv - uDir * 1.385).rgb) * 0.316;
        c += (texture2D(tIn, vUv + uDir * 3.231).rgb + texture2D(tIn, vUv - uDir * 3.231).rgb) * 0.07;
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const fsQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), brightMat);
  fsQuad.frustumCulled = false;
  const fsScene = new THREE.Scene(); fsScene.add(fsQuad);
  function bloom() {
    fsQuad.material = brightMat; renderer.setRenderTarget(bloomA); renderer.render(fsScene, postCam);
    fsQuad.material = blurMat;
    for (const [src, dst, dx, dy] of [[bloomA, bloomB, 1, 0], [bloomB, bloomA, 0, 1], [bloomA, bloomB, 2, 0], [bloomB, bloomA, 0, 2]]) {
      blurMat.uniforms.tIn.value = src.texture;
      blurMat.uniforms.uDir.value.set(dx / src.width, dy / src.height);
      renderer.setRenderTarget(dst); renderer.render(fsScene, postCam);
    }
  }
  const postCam = new THREE.Camera();

  const target = new THREE.Vector3(), tmp = new THREE.Vector3();
  let impact = 0, hide = 0, shake = 0, first = true, zoom = 0.9, zoomWant = 0.9, mode = 'in', yaw = 0, inDist = 4.4;
  const camPos = new THREE.Vector3(), look = new THREE.Vector3(), right = { x: 1, z: 0 };
  const st = { flash: 0, dark: 0 };

  function resize() {
    // render at most ~1 megapixel and let the browser scale it up: big screens stay smooth on laptop GPUs
    const w = canvas.clientWidth, h = canvas.clientHeight, pr = Math.min(1, Math.sqrt(1.0e6 / (w * h)));
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    rt.setSize(Math.round(w * pr), Math.round(h * pr));
    bloomA.setSize(Math.round(w * pr / 4), Math.round(h * pr / 4)); bloomB.setSize(Math.round(w * pr / 4), Math.round(h * pr / 4));
    camera.aspect = w / h; camera.updateProjectionMatrix();
    post.uniforms.uAspect.value = w / h; post.uniforms.uRes.value.set(w * pr, h * pr);
    U.uCutR.value = h * pr * 0.2;
  }
  window.addEventListener('resize', resize);
  resize();

  return {
    renderer, camera, st,
    shake(a) { shake = Math.max(shake, a); },
    event(e) { props.event(e); table.event(e); },
    get mode() { return mode; },
    toggleMode() { mode = mode === 'in' ? 'table' : 'in'; if (mode === 'table') zoomWant = zoom = 0.15; first = true; },
    turn(a) { yaw += a; },
    right,
    // table view: 0 whole board and the giant, 1 down in the board. In the house: how far behind the kid.
    zoomBy(d) { if (mode === 'in') inDist = Math.max(2.6, Math.min(8, inDist - d * 8)); else zoomWant = Math.max(0, Math.min(1, zoomWant + d)); },
    // stick input is relative to where the camera looks; the rules want world directions
    toWorld(inp) {
      const s = Math.sin(yaw), c = Math.cos(yaw);
      return { ...inp, mx: inp.mx * c + inp.mz * s, mz: -inp.mx * s + inp.mz * c };
    },
    get zoom() { return zoomWant; },
    setZoom(z) { zoom = zoomWant = z; mode = 'table'; },
    setDist(d) { inDist = d; },
    frame(G, dt, t, input = {}) {
      const k = G.kid, M = G.monster;
      zoom += (zoomWant - zoom) * Math.min(1, dt * 3);
      shake = Math.max(0, shake - dt * 2.5);
      if (mode === 'table') {
      // your head: leaning in, it drops low over your piece and looks across the board toward the giant,
      // the board's edges running off past the sides of your view
      tmp.set(k.x + k.vx * 0.3, 0, k.z + k.vz * 0.3).lerp(center, lerp(0.7, 0, zoom));
      tmp.z -= (1 - zoom) * 4 + zoom * 2.2; tmp.y += (1 - zoom) * 2;
      if (first) { target.copy(tmp); first = false; }
      target.lerp(tmp, Math.min(1, dt * 3));
      const D = lerp(62, 13, zoom), pitch = lerp(0.6, 0.68, zoom), fov = lerp(35, 58, zoom);
      if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
      camera.position.set(target.x, Math.sin(pitch) * D, target.z + Math.cos(pitch) * D);
      camera.position.x += Math.sin(t * 0.31) * 0.25 * (1 - zoom); camera.position.y += Math.sin(t * 0.43) * 0.15;
      camera.position.x += (Math.random() - 0.5) * shake * 0.3;
      camera.position.z += (Math.random() - 0.5) * shake * 0.3;
      camera.lookAt(target);
      }
      if (mode === 'in') {
        const fx = -Math.sin(yaw), fz = -Math.cos(yaw), H = 0.9 + inDist * 0.36;
        tmp.set(k.x - fx * inDist, H, k.z - fz * inDist);
        if (first) { camPos.copy(tmp); first = false; }
        camPos.lerp(tmp, Math.min(1, dt * 7));
        camera.position.copy(camPos);
        camera.position.x += (Math.random() - 0.5) * shake * 0.12; camera.position.y += Math.sin(t * 1.7) * 0.02;
        look.set(k.x + fx * 2.2, 0.55, k.z + fz * 2.2);
        camera.lookAt(look);
        if (camera.fov !== 62) { camera.fov = 62; camera.updateProjectionMatrix(); }
      }
      right.x = mode === 'in' ? Math.cos(yaw) : 1; right.z = mode === 'in' ? -Math.sin(yaw) : 0;
      {
        const dx = camera.position.x - k.x, dz = camera.position.z - k.z, n = Math.hypot(dx, dz) || 1;
        U.uCamDir.value.set(dx / n, dz / n);
      }

      const inWall = L.sightBlocked(Math.floor(k.x), Math.floor(k.z));
      const intensities = candles.update(G, dt, t);
      maps.update(G, k.x, k.z, inWall, intensities, dt);
      props.update(G, dt, t);
      kid.root.visible = k.hidden < 0;
      hide += ((k.hidden >= 0 ? 1 : 0) - hide) * Math.min(1, dt * 5);
      post.uniforms.uHide.value = hide;

      const d = Math.hypot(M.x - k.x, M.z - k.z);
      const awake = M.mode !== 'sleep';
      k.fear = awake ? Math.max(0, 1 - d / HEART.radius) : 0;
      kid.update(k, dt, t, M);
      monster.update(M, k, dt, t);
      // you only see it if the kid could
      // behind walls you still see its eye on the stalk poking up over them
      const seen = !inWall && !L.sightBlocked(Math.floor(M.x), Math.floor(M.z)) && d < 16 && los(L, k.x, k.z, M.x, M.z);
      monster.setSeen(seen, WALL_H + 0.02);
      const lit = intensities.reduce((s, v) => s + v, 0) / intensities.length;
      // from inside the house the giant is a dark mass overhead; at the table you see it lit by the board
      table.update(G, dt, t, input, (0.25 + 0.75 * lit) * (mode === 'in' ? 0.35 : 1), mode === 'in' ? 1 : zoom);

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
      bloom();
      post.uniforms.tBloom.value = bloomA.texture;
      renderer.setRenderTarget(null);
      renderer.render(postScene, postCam);
    },
  };
}
