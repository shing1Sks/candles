// WINDOWS WITH ROOMS BEHIND THEM. Every pane is one quad, but the shader casts the view ray into
// an imaginary room behind it (interior mapping): wallpaper on three walls, floorboards and a rug,
// a ceiling with a lamp, a wardrobe or a doorway, a sofa or a bed standing in the room, curtains
// just behind the glass. Lit rooms glow warm, a TV room flickers blue, dark rooms are near black
// with a little moon. The glass on top: fresnel reflection of the sky, a smear of dirt.
// Things the director can turn: uEvil (figures start standing in rooms, watching), and windows
// marked 'watcher' close their curtains as you walk past.
import * as THREE from 'three';
import { U } from './materials.js';

export const WIN_U = {
  uEvil: { value: 0 },                       // 0..1: how many rooms have someone standing in them
  uPlayer: { value: new THREE.Vector3() },   // world position, for the curtains that close as you pass
  uMoon: { value: new THREE.Color(0x3a4460) },
  uSkyRefl: { value: new THREE.Color(0x232a40) },
  // waves along the street (world z from, z to, strength): curtains closing house by house; lights going out
  uCurtainWave: { value: new THREE.Vector3(0, 0, 0) },
  uLightsOut: { value: new THREE.Vector3(0, 0, 0) },
};

const VERT = /* glsl */`
  uniform float uTime, uLean, uBreath;
  attribute vec3 aLean;
  attribute vec2 aUv;
  attribute vec4 aRoom;   // seed, lit, kind (0 room, 1 tv, 2 empty, 3 shop), curtain
  attribute vec4 aSize;   // width, height, depth, shape (0 rect, 1 arch, 2 round, 3 fan, 4 shop)
  attribute vec3 aT; attribute vec3 aB; attribute vec3 aCenter; attribute float aWatch;
  varying vec2 vUv; varying vec4 vRoom; varying vec4 vSize; varying vec3 vT, vB, vN, vWorld, vCenter; varying float vWatch;
  #include <fog_pars_vertex>
  void main() {
    vec3 transformed = position;
    float breath = sin(uTime * 0.55 + position.x * 0.13 + position.z * 0.07) * uBreath;
    transformed += aLean * (uLean + breath);
    vUv = aUv; vRoom = aRoom; vSize = aSize; vT = aT; vB = aB; vN = normalize(cross(aT, aB)); vCenter = aCenter; vWatch = aWatch;
    vec4 wp = modelMatrix * vec4(transformed, 1.0); vWorld = wp.xyz;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const FRAG = /* glsl */`
  uniform float uTime, uEvil; uniform vec3 uPlayer; uniform vec3 uMoon, uSkyRefl, uCurtainWave, uLightsOut;
  float inWave(vec3 w, float z) { return step(min(w.x, w.y), z) * step(z, max(w.x, w.y)) * w.z; }
  varying vec2 vUv; varying vec4 vRoom; varying vec4 vSize; varying vec3 vT, vB, vN, vWorld, vCenter; varying float vWatch;
  #include <fog_pars_fragment>
  float h1(float n) { return fract(sin(n) * 43758.5453); }
  float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
  vec3 pal(float t) { return vec3(0.5) + vec3(0.35, 0.3, 0.3) * cos(6.283 * (vec3(0.9, 0.8, 0.7) * t + vec3(0.0, 0.15, 0.3))); }

  void main() {
    float seed = vRoom.x, lit = vRoom.y * (1.0 - inWave(uLightsOut, vCenter.z)), kind = vRoom.z, curtain = max(vRoom.w, inWave(uCurtainWave, vCenter.z));
    float W = vSize.x, H = vSize.y, D = vSize.z, shape = vSize.w;
    vec2 q = vUv - 0.5;
    // the opening's shape
    if (shape > 0.5 && shape < 1.5) { float yr = (vUv.y * H - (H - W * 0.5)); if (yr > 0. && length(vec2(q.x * W, yr)) > W * 0.5) discard; }
    if (shape > 1.5 && shape < 2.5 && length(q) > 0.5) discard;
    if (shape > 2.5 && shape < 3.5 && (vUv.y < 0. || length(vec2(q.x, vUv.y * 0.5)) > 0.5)) discard;

    // ray into the room, in the window's frame (x across, y up, z out of the wall)
    vec3 V = normalize(vWorld - cameraPosition);
    vec3 rd = vec3(dot(V, vT), dot(V, vB), dot(V, vN));
    vec3 ro = vec3(q.x * W, q.y * H, 0.0);
    float RW = max(W + 2.2, 3.4), FL = -1.05 - H * 0.5, CE = 1.55;
    if (shape > 3.5) { RW = W + 1.0; FL = -H * 0.5 - 0.1; CE = H * 0.5 + 0.4; }
    float tx = ((rd.x > 0. ? RW * 0.5 : -RW * 0.5) - ro.x) / rd.x;
    float ty = ((rd.y > 0. ? CE : FL) - ro.y) / rd.y;
    float tz = (-D - ro.z) / rd.z;
    float t = min(min(tx, ty), tz);
    vec3 p = ro + rd * t;
    float sid = h1(seed);
    vec3 wallCol = mix(pal(sid), vec3(0.55, 0.5, 0.42), 0.45);
    vec3 col; vec3 nrm;
    if (t == tz) {
      // back wall: wallpaper (stripes or a small motif), a picture frame, a dark doorway or a wardrobe
      nrm = vec3(0, 0, 1);
      float pat = h1(seed * 3.1) > 0.5 ? smoothstep(0.45, 0.5, abs(fract(p.x * 3.0) - 0.5)) : smoothstep(0.32, 0.28, length(fract(p.xy * 2.5) - 0.5));
      col = wallCol * (0.82 + 0.18 * pat);
      float fxp = (h1(seed * 5.3) - 0.5) * RW * 0.6;
      vec2 pf = abs(p.xy - vec2(fxp, 0.35));
      if (max(pf.x - 0.32, pf.y - 0.24) < 0.0) col = max(pf.x - 0.27, pf.y - 0.19) < 0.0 ? pal(h1(seed * 7.7)) * 0.5 : vec3(0.25, 0.18, 0.1);
      float dxp = (h1(seed * 9.1) - 0.5) * RW * 0.7;
      if (abs(p.x - dxp) < 0.45 && p.y < FL + 2.0) col = h1(seed * 2.2) > 0.5 ? vec3(0.02) : vec3(0.22, 0.14, 0.09) * (0.8 + 0.2 * step(0.02, abs(p.x - dxp)));
    } else if (t == ty) {
      if (rd.y < 0.) { nrm = vec3(0, 1, 0); col = vec3(0.32, 0.22, 0.14) * (0.8 + 0.2 * step(0.5, fract(p.x * 4.0))); if (length((p.xz - vec2(0.0, -D * 0.5)) * vec2(0.6, 1.0)) < 1.0) col = pal(h1(seed * 4.4) + 0.3) * 0.45; }
      else { nrm = vec3(0, -1, 0); col = vec3(0.6, 0.58, 0.52); }
    } else { nrm = vec3(-sign(rd.x), 0, 0); col = wallCol * 0.9; }

    // furniture standing in the room: a card at mid depth (sofa, bed, armchair, a lamp on a table)
    float fz = -D * (0.45 + 0.25 * h1(seed * 6.6));
    float tf = (fz - ro.z) / rd.z;
    if (tf > 0. && tf < t) {
      vec3 pp = ro + rd * tf; float fy = pp.y - FL, fxx = pp.x - (h1(seed * 8.8) - 0.5) * RW * 0.4;
      float kindF = floor(h1(seed * 1.9) * 4.0); bool hit = false;
      if (kindF < 1.0) hit = fy < 0.85 && abs(fxx) < 1.0 && !(fy > 0.45 && abs(fxx) < 0.75);          // sofa
      else if (kindF < 2.0) hit = (fy < 1.0 && abs(fxx) < 0.42 && !(fy > 0.5 && abs(fxx) < 0.3)) ;     // armchair
      else if (kindF < 3.0) hit = (fy < 0.75 && abs(fxx) < 0.35) || (fy < 1.45 && abs(fxx - 0.2) < 0.04) || (fy > 1.35 && fy < 1.65 && abs(fxx - 0.2) < 0.2 - (fy - 1.35) * 0.4); // table and lamp
      if (hit) { col = vec3(0.12, 0.09, 0.08) * (0.7 + 0.6 * pal(h1(seed * 3.3))); t = tf; p = pp; nrm = vec3(0, 0, 1); }
    }
    // someone standing in the room, watching (only once the night has gone wrong)
    float who = h1(seed * 12.7);
    if (who < uEvil * 0.22 && shape < 3.5) {
      float zf = -D * 0.35, tw = (zf - ro.z) / rd.z;
      if (tw > 0. && tw < t) {
        vec3 pw = ro + rd * tw; float px = pw.x - (h1(seed * 13.3) - 0.5) * 0.8, py = pw.y - FL;
        float body = step(abs(px), 0.22 - max(0., py - 1.3) * 0.0) * step(py, 1.45) + step(length(vec2(px, py - 1.62)), 0.13) + step(abs(px), 0.3) * step(1.2, py) * step(py, 1.42);
        if (body > 0.5) { col = vec3(0.005); t = tw; p = pw; }
      }
    }
    // someone crossing a lit room now and then: a shadow sliding past the lamp
    if (lit > 0.5 && kind < 0.5 && h1(seed * 17.7) < 0.3) {
      float cyc = fract(uTime * 0.045 + h1(seed * 19.1)), zf2 = -D * 0.42, tw2 = (zf2 - ro.z) / rd.z;
      if (cyc < 0.25 && tw2 > 0. && tw2 < t) { vec3 pw2 = ro + rd * tw2; float wx = mix(-RW * 0.6, RW * 0.6, cyc / 0.25), px2 = pw2.x - wx, py2 = pw2.y - FL;
        float body2 = step(abs(px2), 0.2) * step(py2, 1.45) + step(length(vec2(px2, py2 - 1.6)), 0.12); if (body2 > 0.5) { col = vec3(0.01); t = tw2; p = pw2; } }
    }
    // light in the room: a ceiling lamp (warm), a TV (blue, flickering), or only the moon
    vec3 lampP = vec3((h1(seed * 4.1) - 0.5) * RW * 0.5, CE - 0.35, -D * 0.5);
    float dl = length(p - lampP);
    vec3 light = uMoon * 0.06;
    if (kind > 0.5 && kind < 1.5) {
      float fl = 0.55 + 0.45 * noise(vec2(uTime * 6.0, seed)) * (0.7 + 0.3 * sin(uTime * 17.0 + seed));
      vec3 tvP = vec3(lampP.x, FL + 0.7, -D * 0.2);
      light += vec3(0.35, 0.5, 1.0) * fl * 2.2 / (1.0 + dot(p - tvP, p - tvP) * 0.8);
    } else light += vec3(1.0, 0.72, 0.42) * lit * 2.6 / (1.0 + dl * dl * 0.45);
    col *= light;
    // the lamp shade itself
    if (lit > 0.5 && kind < 0.5) { vec3 lp = ro + rd * ((lampP.z - ro.z) / rd.z); if (length(lp.xy - lampP.xy) < 0.22) col = vec3(1.0, 0.75, 0.45) * 1.8; }

    // curtains, just behind the glass: pinch pleats; watcher windows close as you come near
    float near = 1.0 - smoothstep(6.0, 12.0, length(uPlayer - vCenter));
    float cover = clamp(curtain + vWatch * near * (1.0 - curtain), 0.0, 1.0);
    float twitch = vWatch > 0.5 ? 0.0 : 0.04 * step(0.85, h1(seed * 15.5)) * max(0., sin(uTime * 0.7 + seed * 9.0));
    float edgeL = -W * 0.5 + cover * W * 0.5 + twitch, edgeR = W * 0.5 - cover * W * 0.5;
    if (shape < 3.5 && cover > 0.01) {
      float tc = (-0.07 - ro.z) / rd.z; vec3 pc = ro + rd * tc;
      if (pc.x < edgeL || pc.x > edgeR) {
        float fold = 0.65 + 0.35 * sin(pc.x * 26.0 + seed);
        vec3 cc = pal(h1(seed * 21.1) + 0.5) * 0.55;
        col = cc * fold * (uMoon * 0.05 + (kind > 0.5 && kind < 1.5 ? vec3(0.2, 0.3, 0.6) : vec3(1.0, 0.7, 0.45)) * lit * 0.9 + 0.02);
      }
    }
    // glazing bars
    if (shape < 1.5) { float bx = abs(q.x * W), by = abs(q.y * H - 0.05); if (bx < 0.025 || by < 0.02) col = vec3(0.02); }
    if (shape > 2.5 && shape < 3.5) { float a = atan(vUv.y, q.x); if (abs(fract(a / 0.5236) - 0.5) > 0.46) col = vec3(0.02); }
    if (shape > 3.5) { if (abs(q.x * W) < 0.03) col = vec3(0.02); }
    // the glass: sky in it at grazing angles, dirt
    float fres = 0.03 + 0.55 * pow(1.0 - abs(rd.z), 4.0);
    float dirt = noise(vUv * vec2(W, H) * 6.0 + seed) * 0.5 + noise(vUv * vec2(W, H) * 20.0) * 0.5;
    vec3 refl = uSkyRefl * (0.6 + 0.6 * vUv.y) + vec3(0.05) * dirt;
    col = mix(col, refl, clamp(fres + 0.08 * dirt, 0.0, 1.0));
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

let MAT = null;
export function windowMaterial() {
  if (MAT) return MAT;
  MAT = new THREE.ShaderMaterial({
    uniforms: { ...THREE.UniformsLib.fog, ...U, ...WIN_U },
    vertexShader: VERT, fragmentShader: FRAG, fog: true,
  });
  return MAT;
}

// collects window quads for one segment. w: { center (local), T,B (local unit), wdt, hgt, depth, shape, room... }
export class WindowBatch {
  constructor() { this.q = []; }
  // corners computed in the house frame then mapped through frame.warp + matrix; lean per corner
  add(frame, { x, y, z, ry = 0, wdt, hgt, shape = 0, depth = 3.4, seed, lit, kind, curtain, watch = 0 }) {
    const c = Math.cos(ry), s = Math.sin(ry);
    // window plane faces local +x rotated by ry; across = local z rotated
    const ax = new THREE.Vector3(s, 0, -c), up = new THREE.Vector3(0, 1, 0);
    const n = new THREE.Vector3(c, 0, s), cx = x + n.x * 0.03, cz = z + n.z * 0.03;
    const corners = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
    const P = [], L = [];
    const rot = new THREE.Matrix3().setFromMatrix4(frame.matrix);
    for (const [u, v] of corners) {
      const lx = cx + ax.x * u * wdt, ly = y + v * hgt, lz = cz + ax.z * u * wdt;
      const [wx, wy, wz] = frame.warp(lx, ly, lz), p = new THREE.Vector3(wx, wy, wz).applyMatrix4(frame.matrix);
      const [l1, l2, l3] = frame.lean(lx, ly, lz), lv = new THREE.Vector3(l1, l2, l3).applyMatrix3(rot);
      P.push(p); L.push(lv);
    }
    const T = new THREE.Vector3().subVectors(P[1], P[0]).normalize(), B = new THREE.Vector3().subVectors(P[3], P[0]).normalize();
    const center = P[0].clone().add(P[2]).multiplyScalar(0.5);
    this.q.push({ P, L, T, B, center, wdt, hgt, depth, shape, seed, lit, kind, curtain, watch });
    return center;
  }
  build(parent) {
    if (!this.q.length) return null;
    const n = this.q.length * 4, pos = new Float32Array(n * 3), lean = new Float32Array(n * 3), uv = new Float32Array(n * 2), room = new Float32Array(n * 4), size = new Float32Array(n * 4), tA = new Float32Array(n * 3), bA = new Float32Array(n * 3), cA = new Float32Array(n * 3), wA = new Float32Array(n), idx = [];
    const UVS = [[0, 0], [1, 0], [1, 1], [0, 1]];
    this.q.forEach((w, i) => {
      for (let k = 0; k < 4; k++) {
        const j = i * 4 + k;
        pos.set([w.P[k].x, w.P[k].y, w.P[k].z], j * 3); lean.set([w.L[k].x, w.L[k].y, w.L[k].z], j * 3);
        uv.set(w.shape === 3 ? [UVS[k][0], UVS[k][1]] : UVS[k], j * 2);
        room.set([w.seed, w.lit, w.kind, w.curtain], j * 4); size.set([w.wdt, w.hgt, w.depth, w.shape], j * 4);
        tA.set([w.T.x, w.T.y, w.T.z], j * 3); bA.set([w.B.x, w.B.y, w.B.z], j * 3); cA.set([w.center.x, w.center.y, w.center.z], j * 3); wA[j] = w.watch;
      }
      idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aLean', new THREE.BufferAttribute(lean, 3));
    g.setAttribute('aUv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('aRoom', new THREE.BufferAttribute(room, 4)); g.setAttribute('aSize', new THREE.BufferAttribute(size, 4));
    g.setAttribute('aT', new THREE.BufferAttribute(tA, 3)); g.setAttribute('aB', new THREE.BufferAttribute(bA, 3)); g.setAttribute('aCenter', new THREE.BufferAttribute(cA, 3)); g.setAttribute('aWatch', new THREE.BufferAttribute(wA, 1));
    g.setIndex(idx); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, windowMaterial()); parent.add(m);
    return m;
  }
}
