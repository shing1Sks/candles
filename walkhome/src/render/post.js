// AFTER THE RENDER. The scene is drawn into a half-float target with a depth texture, then:
//   bloom   a bright-pass and a little mip chain, so lamps and windows bleed into the mist
//   ink     a thin line wherever depth jumps (silhouettes) or bends (creases): the drawing, lit
//           like reality. Thinner and fainter with distance so the far street stays soft.
//   grade   ACES, cool violet shadows and warm sodium highlights, fear desaturates and closes in
//   film    animated grain, vignette, a hint of chromatic fringing when it's bad
// The render resolution adapts to keep the frame rate (the designer's laptop is an Iris Xe).
import * as THREE from 'three';

const FS_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';

function pass(frag, uniforms) {
  const m = new THREE.ShaderMaterial({ uniforms, vertexShader: FS_VERT, fragmentShader: frag, depthTest: false, depthWrite: false });
  const s = new THREE.Scene(), q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m); q.frustumCulled = false; s.add(q);
  return { m, s };
}
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

export class Post {
  constructor(renderer) {
    this.r = renderer; this.scale = 0.85; this.w = 0; this.h = 0;
    this.main = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(4, 4, THREE.UnsignedIntType), samples: 0 });
    this.mips = [0, 1, 2, 3].map(() => new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType }));
    this.ups = [0, 1, 2].map(() => new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType }));
    this.U = {
      tColor: { value: null }, tDepth: { value: null }, tBloom: { value: null }, uRes: { value: new THREE.Vector2() }, uNear: { value: 0.05 }, uFar: { value: 600 },
      uTime: { value: 0 }, uFear: { value: 0 }, uExposure: { value: 0.8 }, uInk: { value: 1.0 }, uFlash: { value: 0 }, uBlack: { value: 0 }, uHide: { value: 0 },
    };
    this.bright = pass(/* glsl */`
      uniform sampler2D tColor; varying vec2 vUv; uniform vec2 uTexel;
      void main(){ vec3 c = vec3(0.); for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) c += texture2D(tColor, vUv + vec2(i, j) * uTexel).rgb; c /= 9.;
        float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(0.55, 1.6, l), 1.); }`, { tColor: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.blur = pass(/* glsl */`
      uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
      void main(){ vec3 c = texture2D(tSrc, vUv).rgb * 0.25;
        c += (texture2D(tSrc, vUv + vec2(1, 1) * uTexel).rgb + texture2D(tSrc, vUv + vec2(-1, 1) * uTexel).rgb + texture2D(tSrc, vUv + vec2(1, -1) * uTexel).rgb + texture2D(tSrc, vUv + vec2(-1, -1) * uTexel).rgb) * 0.125;
        c += (texture2D(tSrc, vUv + vec2(2, 0) * uTexel).rgb + texture2D(tSrc, vUv + vec2(-2, 0) * uTexel).rgb + texture2D(tSrc, vUv + vec2(0, 2) * uTexel).rgb + texture2D(tSrc, vUv + vec2(0, -2) * uTexel).rgb) * 0.0625;
        gl_FragColor = vec4(c, 1.); }`, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.add = pass(/* glsl */`
      uniform sampler2D tA, tB; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tA, vUv).rgb + texture2D(tB, vUv).rgb * 0.8, 1.); }`, { tA: { value: null }, tB: { value: null } });
    this.final = pass(/* glsl */`
      uniform sampler2D tColor, tDepth, tBloom; uniform vec2 uRes; uniform float uNear, uFar, uTime, uFear, uExposure, uInk, uFlash, uBlack, uHide;
      varying vec2 vUv;
      float lin(vec2 uv){ float z = texture2D(tDepth, uv).x * 2. - 1.; return 2. * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0., 1.); }
      void main(){
        vec2 px = 1. / uRes, uv = vUv;
        // a breath of chromatic fringe toward the edges, more when it's bad
        vec2 cc = uv - 0.5; float ca = (0.0006 + uFear * 0.0025) * dot(cc, cc) * 4.;
        vec3 c = vec3(texture2D(tColor, uv + cc * ca).r, texture2D(tColor, uv).g, texture2D(tColor, uv - cc * ca).b);
        c += texture2D(tBloom, uv).rgb * 0.55;
        // ink: depth discontinuities (silhouettes) and depth creases, relative to distance
        float d = lin(uv), dl = lin(uv - vec2(px.x, 0.)), dr = lin(uv + vec2(px.x, 0.)), du = lin(uv + vec2(0., px.y)), dd = lin(uv - vec2(0., px.y));
        float edge = (abs(dl - d) + abs(dr - d) + abs(du - d) + abs(dd - d)) / max(d, 0.1);
        float crease = abs(dl + dr + du + dd - 4. * d) / max(d, 0.1);
        float ink = clamp(smoothstep(0.05, 0.16, edge) + smoothstep(0.012, 0.04, crease) * 0.6, 0., 1.);
        ink *= uInk * (1. - smoothstep(18., 90., d) * 0.75) * step(d, uFar * 0.9);
        c *= 1. - ink * 0.82;
        // exposure, tone, grade
        c *= uExposure;
        c = aces(c);
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        c = mix(c, c * vec3(0.82, 0.86, 1.14), (1. - smoothstep(0.0, 0.35, l)) * 0.5);     // violet shadows
        c = mix(c, c * vec3(1.08, 1.0, 0.86), smoothstep(0.35, 0.9, l) * 0.5);           // warm highlights
        c = mix(c, vec3(l), uFear * 0.45);                                                 // fear drains the colour
        // vignette closes in with fear
        float v = 1. - dot(cc * vec2(0.85, 1.0), cc * vec2(0.85, 1.0)) * (1.5 + uFear * 1.6 + uHide * 2.2);
        c *= clamp(v, 0., 1.);
        c = pow(c, vec3(1. / 2.2));
        c += (hash(floor(vUv * uRes) + fract(uTime * 13.7) * 91.) - 0.5) * (0.045 + uFear * 0.03);
        c = mix(c, vec3(1.), uFlash);
        c *= 1. - uBlack;
        gl_FragColor = vec4(c, 1.);
      }`, this.U);
  }

  setSize(w, h) {
    this.W = w; this.H = h;
    const rw = Math.max(320, Math.round(w * this.scale)), rh = Math.max(180, Math.round(h * this.scale));
    if (rw === this.w && rh === this.h) return;
    this.w = rw; this.h = rh;
    this.main.setSize(rw, rh);
    let mw = rw >> 1, mh = rh >> 1;
    for (const [i, m] of this.mips.entries()) { m.setSize(Math.max(2, mw), Math.max(2, mh)); if (this.ups[i]) this.ups[i].setSize(Math.max(2, mw), Math.max(2, mh)); mw >>= 1; mh >>= 1; }
    this.U.uRes.value.set(rw, rh);
  }

  render(scene, camera, dt) {
    const r = this.r;
    this.U.uNear.value = camera.near; this.U.uFar.value = camera.far;
    r.setRenderTarget(this.main); r.render(scene, camera);
    // bloom
    const m = this.mips;
    this.bright.m.uniforms.tColor.value = this.main.texture; this.bright.m.uniforms.uTexel.value.set(1 / this.w, 1 / this.h);
    r.setRenderTarget(m[0]); r.render(this.bright.s, cam);
    for (let i = 1; i < m.length; i++) { this.blur.m.uniforms.tSrc.value = m[i - 1].texture; this.blur.m.uniforms.uTexel.value.set(1 / m[i - 1].width, 1 / m[i - 1].height); r.setRenderTarget(m[i]); r.render(this.blur.s, cam); }
    let prev = m[m.length - 1];
    for (let i = m.length - 2; i >= 0; i--) { this.add.m.uniforms.tA.value = m[i].texture; this.add.m.uniforms.tB.value = prev.texture; r.setRenderTarget(this.ups[i]); r.render(this.add.s, cam); prev = this.ups[i]; }
    this.U.tColor.value = this.main.texture; this.U.tDepth.value = this.main.depthTexture; this.U.tBloom.value = prev.texture;
    r.setRenderTarget(null); r.render(this.final.s, cam);
  }
}
