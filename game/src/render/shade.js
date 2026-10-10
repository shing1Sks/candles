// The one material everything in the maze uses. There are no three.js lights: every surface looks up
// candlelight and line of sight in the two top-down maps (maps.js), so walls cast perfect shadows for
// free and anything the kid can't see sinks into the dark.
import * as THREE from 'three';

export const U = {
  uVis: { value: null }, uLight: { value: null }, uBounce: { value: null }, uRoom: { value: null }, uAO: { value: null }, uSize: { value: new THREE.Vector2(1, 1) },
  uAmb: { value: 0.012 }, uTime: { value: 0 }, uKid: { value: new THREE.Vector3() }, uKidPx: { value: new THREE.Vector2() },
  uCutR: { value: 120 }, uCamDir: { value: new THREE.Vector2(0, 1) },
};

const vert = /* glsl */ `
  uniform float uTime, uSway;
  varying vec3 vW; varying vec3 vN; varying vec3 vC; varying vec2 vUv;
  void main() {
    mat4 m = modelMatrix;
    #ifdef USE_INSTANCING
      m = modelMatrix * instanceMatrix;
    #endif
    vec4 w = m * vec4(position, 1.0);
    #ifdef USE_INSTANCING
      // fur: each strand bends toward its tip, on its own phase
      vec3 root = (m * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
      float ph = dot(root, vec3(3.7, 7.1, 5.3));
      w.xyz += uSway * position.y * position.y * vec3(sin(uTime * 2.3 + ph), -0.2, cos(uTime * 1.9 + ph * 1.3));
    #endif
    vW = w.xyz; vN = normalize(mat3(m) * normal); vUv = uv;
    #ifdef USE_COLOR
      vC = color;
    #else
      vC = vec3(1.0);
    #endif
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;

const frag = /* glsl */ `
  uniform sampler2D uVis, uLight, uBounce, uRoom, uAO; uniform vec2 uSize, uKidPx, uCamDir;
  uniform float uAmb, uTime, uCutR, uCut, uPattern, uFade, uLit, uClipY;
  uniform vec3 uColor, uEmis, uKid;
  varying vec3 vW; varying vec3 vN; varying vec3 vC; varying vec2 vUv;

  float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  // interleaved gradient noise: a stable per-pixel dither threshold
  float bayer(vec2 p) { return fract(52.9829189 * fract(dot(floor(p), vec2(0.06711056, 0.00583715)))); }
  float boards(vec2 p, float w, float shade) {
    float row = floor(p.y / w), off = hash(vec2(row, 3.1)) * 3.0;
    float seg = floor((p.x + off) / 1.6);
    float v = 0.82 + 0.3 * hash(vec2(row, seg)) + 0.12 * vnoise(vec2(p.x * 6.0, row * 9.0));
    float seam = smoothstep(0.0, 0.02, fract(p.y / w) * w) * smoothstep(0.0, 0.02, fract((p.x + off) / 1.6) * 1.6);
    return shade * v * mix(0.45, 1.0, seam);
  }
  float tiles(vec2 p, float s, float a, float b) {
    vec2 f = fract(p / s) * s;
    float grout = smoothstep(0.0, 0.015, min(f.x, f.y));
    return mix(b, a * (0.9 + 0.2 * hash(floor(p / s))), grout);
  }
  float floorShade(vec2 p) {
    float room = texture2D(uRoom, (floor(p) + 0.5) / uSize).r * 255.0;
    float grime = 0.75 + 0.35 * vnoise(p * 1.3) + 0.1 * vnoise(p * 7.0);
    float v;
    if (room < 0.5) v = boards(p.yx, 0.22, 0.30);                 // corridors: long boards
    else if (room < 1.5) v = boards(p, 0.16, 0.42);               // nursery
    else if (room < 2.5) v = tiles(p, 0.33, 0.55, 0.22);          // bathroom
    else if (room < 3.5) { vec2 c = floor(p / 0.5); v = mod(c.x + c.y, 2.0) < 0.5 ? 0.5 : 0.16; v = tiles(p, 0.5, v, 0.1); }
    else if (room < 4.5) v = 0.3 * (0.8 + 0.4 * vnoise(p * 22.0)); // bedroom carpet
    else if (room < 5.5) v = boards(p.yx, 0.2, 0.38);             // playroom
    else v = 0.26 * (0.7 + 0.5 * vnoise(p * 3.0)) * (0.85 + 0.3 * vnoise(p * 30.0)); // cellar concrete
    return v * grime;
  }
  // Wallpaper by room, panelling below the rail, tiles in the wet rooms, brick in the cellar,
  // and the house's age on all of it: damp creeping up from the floor, drips, hairline cracks.
  float wallShade(vec3 w, vec3 n, float room) {
    float along = abs(n.x) > 0.5 ? w.z : w.x;
    vec2 q = vec2(along, w.y);
    float v;
    float rail = 0.6;
    if (room > 5.5) { // cellar: rough brick all the way up
      vec2 b = vec2(q.x / 0.24 + 0.5 * mod(floor(q.y / 0.08), 2.0), q.y / 0.08);
      vec2 f = fract(b);
      float mortar = smoothstep(0.0, 0.06, min(f.x, 1.0 - f.x) * 3.0) * smoothstep(0.0, 0.12, min(f.y, 1.0 - f.y));
      v = mix(0.45, 0.75 + 0.25 * hash(floor(b)), mortar) * (0.85 + 0.2 * vnoise(q * 9.0));
      rail = -1.0;
    } else if (room > 1.5 && room < 3.5 && w.y < (room < 2.5 ? 1.05 : 0.9)) { // bathroom and kitchen: tiles to shoulder height
      vec2 s = room < 2.5 ? vec2(0.15, 0.15) : vec2(0.2, 0.1);
      vec2 b = q / s; if (room > 2.5) b.x += 0.5 * mod(floor(b.y), 2.0);
      vec2 f = fract(b);
      float grout = smoothstep(0.0, 0.07, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
      v = mix(0.5, 1.08 + 0.08 * hash(floor(b)), grout);
      rail = -1.0;
    } else if (w.y < rail) { // panelling under the rail: tall boards with grooves
      float g = fract(q.x / 0.16);
      v = 0.72 * (0.85 + 0.15 * smoothstep(0.0, 0.08, min(g, 1.0 - g))) * (0.9 + 0.12 * vnoise(vec2(q.x * 2.0, q.y * 18.0)));
    } else if (room < 0.5) { // corridors: faded diamonds
      vec2 d = abs(fract(vec2(q.x / 0.3 + q.y / 0.3, q.x / 0.3 - q.y / 0.3)) - 0.5);
      v = 0.86 + 0.08 * step(0.42, max(d.x, d.y));
    } else if (room < 1.5) { // nursery: thin stripes and little dots
      float dots = smoothstep(0.035, 0.02, length(fract(q / 0.12 + vec2(0.0, 0.5 * mod(floor(q.x / 0.12), 2.0))) - 0.5) * 0.12);
      v = 0.9 + 0.07 * step(0.82, fract(q.x / 0.12)) + 0.08 * dots;
    } else if (room < 4.5) { // bedroom: damask
      vec2 c = fract(q / vec2(0.26, 0.34)) - 0.5;
      float m = sin(atan(c.y, c.x) * 4.0) * 0.5 + 0.5;
      v = 0.84 + 0.1 * smoothstep(0.24, 0.2, length(c) * (0.8 + 0.4 * m));
    } else { // playroom: broad stripes
      v = 0.82 + 0.12 * step(0.5, fract(q.x / 0.36));
    }
    if (rail > 0.0) {
      v *= 1.0 - 0.25 * smoothstep(0.012, 0.0, abs(w.y - rail - 0.03)); // shadow line under the rail
    }
    // the age of the house
    float damp = smoothstep(0.75, 0.0, w.y) * smoothstep(0.35, 0.75, vnoise(vec2(along * 1.3, 3.1)));
    float drip = smoothstep(0.78, 0.92, vnoise(vec2(along * 9.0, 7.3))) * smoothstep(0.4, 1.5, w.y) * (0.6 + 0.4 * vnoise(vec2(along * 9.0, w.y * 2.0)));
    float crack = smoothstep(0.02, 0.0, abs(vnoise(q * vec2(7.0, 5.0) + 11.0) - 0.5)) * step(0.74, vnoise(q * 0.7 + 4.0)) * smoothstep(0.3, 0.9, w.y);
    v *= (1.0 - 0.3 * damp) * (1.0 - 0.22 * drip) * (1.0 - 0.35 * crack);
    return v * (0.9 + 0.15 * vnoise(vec2(along * 0.6, w.y * 0.4)));
  }

  void main() {
    if (uCut > 0.5) {
      float c = smoothstep(uCutR, uCutR * 0.65, length((gl_FragCoord.xy - uKidPx) * vec2(1.0, 0.7))) * smoothstep(0.15, 0.8, dot(vW.xz - uKid.xz, uCamDir)) * step(0.25, vW.y);
      c = max(c, smoothstep(1.1, 0.5, length(vW - cameraPosition))); // nothing right in front of the lens
      if (uCut > 1.5) c = max(c, smoothstep(1.3, 0.7, length(vW.xz - uKid.xz)) * step(0.6, vW.y)); // furniture: see the kid under a table or bed
      if (c * 1.02 > bayer(gl_FragCoord.xy)) discard;
    }
    if (uFade < 0.999 && uFade < bayer(gl_FragCoord.xy)) discard;
    if (vW.y < uClipY) discard; // the monster behind a wall: only what pokes above it
    vec3 n = normalize(gl_FrontFacing ? vN : -vN);
    if (uPattern > 3.5 && n.y > 0.7 && fract(vW.x * 5.0) < 0.55 && fract(vW.z * 5.0) < 0.55) discard; // vent grate
    vec2 p = vW.xz + n.xz * 0.07;
    vec2 uv = p / uSize, e = vec2(0.06) / uSize;
    vec2 vs = 0.25 * (texture2D(uVis, uv + e).rg + texture2D(uVis, uv - e).rg + texture2D(uVis, uv + vec2(e.x, -e.y)).rg + texture2D(uVis, uv + vec2(-e.x, e.y)).rg);
    float lt = texture2D(uLight, uv).r;
    // light bounced off the walls and floor: soft, spilling a little round corners and into doorways
    vec2 eb = vec2(0.6) / uSize;
    lt += 0.22 * 0.25 * (texture2D(uBounce, uv + eb).r + texture2D(uBounce, uv - eb).r + texture2D(uBounce, uv + vec2(eb.x, -eb.y)).r + texture2D(uBounce, uv + vec2(-eb.x, eb.y)).r);
    float vertical = 1.0 - abs(n.y);
    float hfall = mix(1.0, 0.5, clamp(vW.y / 1.6, 0.0, 1.0) * vertical);
    float L = uAmb + lt * 1.35 * hfall * uLit + vs.g * 0.22;
    float ao = mix(1.0, mix(0.4, 1.0, smoothstep(0.0, 0.45, vW.y)), vertical);
    ao *= mix(texture2D(uAO, uv).r, 1.0, smoothstep(0.0, 0.6, vW.y)); // contact shadow near the floor
    vec3 base = uColor * vC;
    if (uPattern > 0.5 && uPattern < 1.5) base *= floorShade(vW.xz);
    else if (uPattern > 1.5 && uPattern < 3.5) base *= wallShade(vW, n, texture2D(uRoom, (floor(p) + 0.5) / uSize).r * 255.0);
    vec3 col = base * L * ao * mix(0.14, 1.0, vs.r);
    if (p.x < 0.0 || p.y < 0.0 || p.x > uSize.x || p.y > uSize.y) col = base * 0.25 * uLit; // outside faces of the board: the table's glow
    if (uPattern > 2.5 && n.y > 0.7) {
      // wall tops: the cut edge of a dollhouse wall - plaster skins either side of a wooden core
      vec2 f = fract(vW.xz);
      float grain = 0.8 + 0.2 * vnoise(vec2(vW.x * 1.5 + vW.z * 1.5, (vW.x - vW.z) * 30.0));
      col = vec3((0.018 + 0.016 * vs.r) * grain);
    }
    col += uEmis;
    gl_FragColor = vec4(col, 1.0);
  }`;

// opts: color (grey 0..1), emis, pattern (1 floor, 2 wall, 3 wall with dark tops), cut (dither away near the kid)
export function mat({ color = 0.5, emis = 0, pattern = 0, cut = false, vcol = false, lit = 1, side = THREE.FrontSide, sway = 0 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...U,
      uColor: { value: new THREE.Color(color, color, color) }, uEmis: { value: new THREE.Color(emis, emis, emis) },
      uPattern: { value: pattern }, uCut: { value: cut === true ? 1 : cut || 0 }, uFade: { value: 1 }, uLit: { value: lit }, uClipY: { value: -100 }, uSway: { value: sway },
    },
    vertexShader: vert, fragmentShader: frag, vertexColors: vcol, side,
  });
}
