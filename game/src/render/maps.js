// Two top-down textures the whole world is lit from:
//   vis   - r: what the kid can see right now (line of sight), g: the faint glow around the kid
//   light - r: candlelight, each candle's light stopped by walls
// Both are drawn as 2D polygons straight into clip space, so texture uv = (x / w, z / h).
import * as THREE from 'three';
import { CANDLE } from '../sim/rules.js';

const PX = 12; // texels per metre

// Wall outlines: edges between sight-blocking tiles and open ones, merged into long segments.
export function wallSegments(L) {
  const segs = [];
  const B = (x, z) => L.sightBlocked(x, z);
  for (let z = 0; z <= L.h; z++) { // horizontal edges at z
    let run = null;
    for (let x = 0; x <= L.w; x++) {
      const edge = x < L.w && B(x, z - 1) !== B(x, z);
      if (edge && run === null) run = x;
      if (!edge && run !== null) { segs.push([run, z, x, z]); run = null; }
    }
  }
  for (let x = 0; x <= L.w; x++) {
    let run = null;
    for (let z = 0; z <= L.h; z++) {
      const edge = z < L.h && B(x - 1, z) !== B(x, z);
      if (edge && run === null) run = z;
      if (!edge && run !== null) { segs.push([x, run, x, z]); run = null; }
    }
  }
  return segs;
}

// The visibility polygon around (ox, oz), clipped to radius R. Returns [x0, z0, x1, z1, ...].
export function visPolygon(segs, ox, oz, R) {
  const near = [];
  for (const s of segs) {
    const [x1, z1, x2, z2] = s;
    // distance from the origin to the segment
    const dx = x2 - x1, dz = z2 - z1, t = Math.max(0, Math.min(1, ((ox - x1) * dx + (oz - z1) * dz) / (dx * dx + dz * dz)));
    if (Math.hypot(x1 + dx * t - ox, z1 + dz * t - oz) < R) near.push(s);
  }
  const angles = [];
  for (let i = 0; i < 64; i++) angles.push((i / 64) * Math.PI * 2 - Math.PI);
  for (const [x1, z1, x2, z2] of near) for (const [x, z] of [[x1, z1], [x2, z2]]) {
    if (Math.hypot(x - ox, z - oz) > R + 1) continue;
    const a = Math.atan2(z - oz, x - ox);
    angles.push(a - 1e-4, a, a + 1e-4);
  }
  angles.sort((a, b) => a - b);
  const out = new Float32Array(angles.length * 2);
  angles.forEach((a, i) => {
    const dx = Math.cos(a), dz = Math.sin(a);
    let best = R;
    for (const [x1, z1, x2, z2] of near) {
      const sx = x2 - x1, sz = z2 - z1, den = dx * sz - dz * sx;
      if (Math.abs(den) < 1e-9) continue;
      const t = ((x1 - ox) * sz - (z1 - oz) * sx) / den, u = ((x1 - ox) * dz - (z1 - oz) * dx) / den;
      if (t > 0 && t < best && u >= 0 && u <= 1) best = t;
    }
    out[i * 2] = ox + dx * best; out[i * 2 + 1] = oz + dz * best;
  });
  return out;
}

// A fan of triangles from the origin through the polygon.
function fanGeometry(cap) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cap * 9), 3));
  g.setDrawRange(0, 0);
  return g;
}
function fillFan(g, ox, oz, poly) {
  const p = g.attributes.position.array, n = poly.length / 2;
  let o = 0;
  for (let i = 0; i < n && o + 9 <= p.length; i++) {
    const j = (i + 1) % n;
    p[o++] = ox; p[o++] = 0; p[o++] = oz;
    p[o++] = poly[i * 2]; p[o++] = 0; p[o++] = poly[i * 2 + 1];
    p[o++] = poly[j * 2]; p[o++] = 0; p[o++] = poly[j * 2 + 1];
  }
  g.setDrawRange(0, o / 3);
  g.attributes.position.needsUpdate = true;
}

const fanVert = /* glsl */ `
  uniform vec2 uSize;
  varying vec2 vP;
  void main() { vP = position.xz; gl_Position = vec4(position.x / uSize.x * 2.0 - 1.0, position.z / uSize.y * 2.0 - 1.0, 0.0, 1.0); }`;

export function createMaps(renderer, L) {
  const size = new THREE.Vector2(L.w, L.h);
  const opts = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
  const vis = new THREE.WebGLRenderTarget(L.w * PX, L.h * PX, opts);
  const light = new THREE.WebGLRenderTarget(L.w * PX, L.h * PX, opts);
  const cam = new THREE.Camera();
  const segs = wallSegments(L);

  // what the kid sees, plus a small glow so you are never fully blind
  const visScene = new THREE.Scene();
  const visGeo = fanGeometry(1400);
  const visMat = new THREE.ShaderMaterial({
    uniforms: { uSize: { value: size }, uO: { value: new THREE.Vector2() }, uGlow: { value: 3.2 } },
    vertexShader: fanVert,
    fragmentShader: /* glsl */ `
      uniform vec2 uO; uniform float uGlow; varying vec2 vP;
      void main() { float d = length(vP - uO); float g = clamp(1.0 - d / uGlow, 0.0, 1.0); gl_FragColor = vec4(1.0, g * g, 0.0, 1.0); }`,
    depthTest: false, depthWrite: false,
  });
  const visMesh = new THREE.Mesh(visGeo, visMat);
  visMesh.frustumCulled = false;
  visScene.add(visMesh);

  // candlelight: fixed polygons per candle, summed with a per-candle intensity
  const lightScene = new THREE.Scene();
  const candles = L.candles.map((c) => {
    const geo = fanGeometry(1400);
    fillFan(geo, c.x, c.z, visPolygon(segs, c.x, c.z, CANDLE.light));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uSize: { value: size }, uO: { value: new THREE.Vector2(c.x, c.z) }, uI: { value: 1 }, uR: { value: CANDLE.light } },
      vertexShader: fanVert,
      fragmentShader: /* glsl */ `
        uniform vec2 uO; uniform float uI, uR; varying vec2 vP;
        void main() { float d = length(vP - uO); float f = clamp(1.0 - d / uR, 0.0, 1.0); gl_FragColor = vec4(uI * f * f, 0.0, 0.0, 1.0); }`,
      blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true,
    });
    const m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false;
    lightScene.add(m);
    return mat.uniforms.uI;
  });

  const clear = new THREE.Color(0, 0, 0);
  let blind = false;
  return {
    vis: vis.texture, light: light.texture, size, segs, candles,
    // inside a vent you only see yourself
    update(kx, kz, inWall, intensities) {
      if (inWall) {
        const poly = new Float32Array(32);
        for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; poly[i * 2] = kx + Math.cos(a) * 0.7; poly[i * 2 + 1] = kz + Math.sin(a) * 0.7; }
        fillFan(visGeo, kx, kz, poly);
      } else fillFan(visGeo, kx, kz, visPolygon(segs, kx, kz, 16));
      blind = inWall;
      visMat.uniforms.uO.value.set(kx, kz);
      visMat.uniforms.uGlow.value = blind ? 1.2 : 3.2;
      intensities.forEach((v, i) => { candles[i].value = v; });
      const old = renderer.getRenderTarget(), oc = renderer.getClearColor(new THREE.Color()), oa = renderer.getClearAlpha();
      renderer.setClearColor(clear, 1);
      renderer.setRenderTarget(vis); renderer.clear(); renderer.render(visScene, cam);
      renderer.setRenderTarget(light); renderer.clear(); renderer.render(lightScene, cam);
      renderer.setRenderTarget(old); renderer.setClearColor(oc, oa);
    },
  };
}
