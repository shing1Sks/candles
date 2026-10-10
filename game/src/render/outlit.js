// The look of everything outside the maze (table, board box, the giant): lit only by the glow coming off
// the board, with a faint edge against the void. Supports instancing (fur strands that sway).
import * as THREE from 'three';

export const OU = { uGlow: { value: 1 }, uBoard: { value: new THREE.Vector4() }, uTime: { value: 0 }, uBeam: { value: new THREE.Vector4(0, 0, 0, 0) } };

const vert = /* glsl */ `
  uniform float uTime, uSway;
  varying vec3 vW; varying vec3 vN; varying vec3 vC;
  void main() {
    vec3 p = position, n = normal;
    #ifdef USE_COLOR
      vC = color;
    #else
      vC = vec3(1.0);
    #endif
    mat4 m = modelMatrix;
    #ifdef USE_INSTANCING
      m = modelMatrix * instanceMatrix;
    #endif
    vec4 w = m * vec4(p, 1.0);
    #ifdef USE_INSTANCING
      // a strand bends more toward its tip; each one on its own phase
      vec3 root = (m * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
      float ph = dot(root, vec3(0.37, 0.71, 0.53));
      w.xyz += uSway * position.y * position.y * vec3(sin(uTime * 1.7 + ph), -0.3, cos(uTime * 1.3 + ph * 1.3));
    #endif
    vW = w.xyz; vN = normalize(mat3(m) * n);
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;

const frag = /* glsl */ `
  uniform float uGlow, uTime, uWood; uniform vec4 uBoard, uBeam; uniform vec3 uColor, uEmis;
  varying vec3 vW; varying vec3 vN; varying vec3 vC;
  float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
  void main() {
    vec3 n = normalize(gl_FrontFacing ? vN : -vN);
    // light from the nearest point of the glowing board
    vec3 b = vec3(clamp(vW.x, uBoard.x, uBoard.z), 0.6, clamp(vW.z, uBoard.y, uBoard.w));
    vec3 d = b - vW; float dist = length(d);
    float glow = uGlow * (0.12 + 0.88 * max(0.0, dot(n, d / max(dist, 1e-3)))) / (1.0 + dist * dist * 0.004);
    // the searchlight spot on the board throws a little light back up at it
    vec3 bd = vec3(uBeam.x, 0.2, uBeam.y) - vW; float bl = length(bd);
    glow += uBeam.z * 0.6 * max(0.0, dot(n, bd / max(bl, 1e-3))) / (1.0 + bl * bl * 0.01);
    float rim = 0.05 * pow(1.0 - max(0.0, dot(n, normalize(cameraPosition - vW))), 3.0); // a faint edge against the void
    vec3 base = uColor * vC;
    if (uWood > 0.5) base *= 0.88 + 0.14 * vnoise(vec2(vW.x * 0.06, vW.z * 7.0)) + 0.08 * vnoise(vW.xz * 2.5) - 0.06 * step(0.985, fract(vW.z * 0.55)); // fine grain, plank seams
    gl_FragColor = vec4(base * (0.006 + glow * 0.9 + rim) + uEmis, 1.0);
  }`;

export function outMat(color, { emis = 0, wood = false, side = THREE.FrontSide, vcol = false, sway = 0 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...OU, uColor: { value: new THREE.Color(color, color, color) }, uEmis: { value: new THREE.Color(emis, emis, emis) },
      uWood: { value: wood ? 1 : 0 }, uSway: { value: sway },
    },
    vertexShader: vert, fragmentShader: frag, side, vertexColors: vcol,
  });
}
