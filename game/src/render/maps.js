// Top-down textures the whole world is lit from:
//   vis   - r: what the kid can see right now (line of sight), g: the faint glow around the kid
//   light - r: candlelight, each candle's light stopped by walls and shut doors, its shadows swaying with
//           the flame; plus the giant's searchlight when it is over the house
//   ao    - baked once: soft dark in corners, along walls and under furniture
// vis and light are drawn as 2D polygons straight into clip space, so texture uv = (x / w, z / h).
import * as THREE from 'three';
import { CANDLE, BEAM } from '../sim/rules.js';
import { T } from '../sim/level.js';

const PX = 12; // texels per metre

// Wall outlines: edges between sight-blocking tiles and open ones, merged into long segments.
export function wallSegments(L, B = L.sightBlocked) {
  const segs = [];
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

function segNear(x1, z1, x2, z2, x, z, r) {
  const dx = x2 - x1, dz = z2 - z1, t = Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x1 + dx * t - x, z1 + dz * t - z) < r;
}

// A fan of triangles from the origin through the polygon.
function fanGeometry(cap) {
  const g = new THREE.BufferGeometry();
  const a = new THREE.BufferAttribute(new Float32Array(cap * 9), 3);
  a.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('position', a);
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
  const a = g.attributes.position;
  a.clearUpdateRanges(); a.addUpdateRange(0, o);
  a.needsUpdate = true;
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
  const bounce = new THREE.WebGLRenderTarget(L.w * 2, L.h * 2, opts); // ~0.5 m texels: light that has bounced
  const cam = new THREE.Camera();
  let segs = wallSegments(L);

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

  // candlelight: one polygon per candle, re-cast every frame from a flame that sways a little
  const lightScene = new THREE.Scene();
  const lightFrag = /* glsl */ `
    uniform vec2 uO; uniform float uI, uR; varying vec2 vP;
    void main() { float d = length(vP - uO); float f = clamp(1.0 - d / uR, 0.0, 1.0); gl_FragColor = vec4(uI * f * f, 0.0, 0.0, 1.0); }`;
  const candles = L.candles.map((c) => {
    const geo = fanGeometry(1400);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uSize: { value: size }, uO: { value: new THREE.Vector2(c.x, c.z) }, uI: { value: 1 }, uR: { value: CANDLE.light } },
      vertexShader: fanVert, fragmentShader: lightFrag,
      blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true,
    });
    const m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false;
    lightScene.add(m);
    return { c, geo, u: mat.uniforms, mesh: m };
  });

  // the giant's searchlight: a soft disc from above (nothing in the house can shadow it)
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { uSize: { value: size }, uO: { value: new THREE.Vector2() }, uI: { value: 0 }, uR: { value: BEAM.radius } },
    vertexShader: fanVert,
    fragmentShader: /* glsl */ `
      uniform vec2 uO; uniform float uI, uR; varying vec2 vP;
      void main() { float d = length(vP - uO) / uR; gl_FragColor = vec4(uI * smoothstep(1.0, 0.75, d) * (0.85 + 0.15 * (1.0 - d)), 0.0, 0.0, 1.0); }`,
    blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true,
  });
  const beamGeo = new THREE.CircleGeometry(1, 48);
  beamGeo.rotateX(Math.PI / 2);
  const beamMesh = new THREE.Mesh(beamGeo, beamMat);
  beamMesh.frustumCulled = false;
  lightScene.add(beamMesh);

  const clear = new THREE.Color(0, 0, 0);
  let doorKey = -1, t = 0, lastX = NaN, lastZ = NaN, lastWall = false;
  const oldColor = new THREE.Color(), ring16 = new Float32Array(32);
  // reveal (review clips): the kid 'sees' the whole board
  const all = new Float32Array([-2, -2, L.w + 2, -2, L.w + 2, L.h + 2, -2, L.h + 2, -2, -2]);
  return {
    reveal: false,
    vis: vis.texture, light: light.texture, bounce: bounce.texture, ao: bakeAO(L), size, get segs() { return segs; }, candles,
    // G: the game (doors, candles, beam). inWall: in a vent you only see yourself.
    update(G, kx, kz, inWall, intensities, dt) {
      t += dt;
      let key = 0;
      for (let i = 0; i < G.doors.length; i++) if (G.doors[i].open) key += 2 ** i;
      const doorsChanged = key !== doorKey;
      if (doorsChanged) {
        doorKey = key; segs = wallSegments(L, G.sightBlocked);
        for (const cd of candles) cd.near = segs.filter(([x1, z1, x2, z2]) => Math.min(Math.hypot(x1 - cd.c.x, z1 - cd.c.z), Math.hypot(x2 - cd.c.x, z2 - cd.c.z), Math.abs(x1 - x2) + Math.abs(z1 - z2)) < CANDLE.light + 1.5 || segNear(x1, z1, x2, z2, cd.c.x, cd.c.z, CANDLE.light + 0.5));
      }
      if (doorsChanged || inWall !== lastWall || Math.abs(kx - lastX) > 0.005 || Math.abs(kz - lastZ) > 0.005) {
        lastX = kx; lastZ = kz; lastWall = inWall;
        if (inWall) {
          for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; ring16[i * 2] = kx + Math.cos(a) * 0.7; ring16[i * 2 + 1] = kz + Math.sin(a) * 0.7; }
          fillFan(visGeo, kx, kz, ring16);
        } else fillFan(visGeo, kx, kz, this.reveal ? all : visPolygon(segs, kx, kz, 16));
      }
      visMat.uniforms.uO.value.set(kx, kz);
      visMat.uniforms.uGlow.value = inWall ? 1.2 : 3.2;
      candles.forEach((cd, i) => {
        const v = intensities[i];
        cd.u.uI.value = v;
        cd.mesh.visible = v > 0.005;
        if (!cd.mesh.visible) return;
        // the flame wanders a couple of centimetres and every shadow in the room breathes with it
        const ox = cd.c.x + Math.sin(t * 7.3 + i * 3) * 0.025 + Math.sin(t * 13.1 + i) * 0.012;
        const oz = cd.c.z + Math.cos(t * 6.1 + i * 2) * 0.025;
        fillFan(cd.geo, ox, oz, visPolygon(cd.near, ox, oz, CANDLE.light));
        cd.u.uO.value.set(ox, oz);
      });
      const B = G.beam;
      const bi = B.state === 'warn' ? (B.t / BEAM.warn) * 0.5 : B.state === 'on' ? 1.15 : 0;
      beamMat.uniforms.uI.value += (bi - beamMat.uniforms.uI.value) * Math.min(1, dt * 6);
      beamMesh.visible = beamMat.uniforms.uI.value > 0.01;
      beamMesh.position.set(B.x, 0, B.z);
      beamMesh.scale.setScalar(BEAM.radius * (B.state === 'warn' ? 1.3 - 0.3 * (B.t / BEAM.warn) : 1));
      beamMat.uniforms.uO.value.set(B.x, B.z);
      beamMat.uniforms.uR.value = BEAM.radius * beamMesh.scale.x / BEAM.radius;
      const old = renderer.getRenderTarget(), oc = renderer.getClearColor(oldColor), oa = renderer.getClearAlpha();
      renderer.setClearColor(clear, 1);
      renderer.setRenderTarget(vis); renderer.clear(); renderer.render(visScene, cam);
      renderer.setRenderTarget(light); renderer.clear(); renderer.render(lightScene, cam);
      renderer.setRenderTarget(bounce); renderer.clear(); renderer.render(lightScene, cam);
      renderer.setRenderTarget(old); renderer.setClearColor(oc, oa);
    },
  };
}

// Soft contact shadow: darker near walls and furniture, darkest underneath tables and beds.
function bakeAO(L) {
  const R = 8, w = L.w * R, h = L.h * R, data = new Uint8Array(w * h * 4);
  const solid = (x, z) => { const t = L.at(x, z); return t === T.WALL || t === T.LOW || t === T.TALL || t === T.DUCT || t === T.CRACK; };
  const under = (x, z) => { const t = L.at(x, z); return t === T.TABLE || t === T.BED; };
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const x = (i + 0.5) / R, z = (j + 0.5) / R, tx = Math.floor(x), tz = Math.floor(z);
    let d = 1;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const ax = tx + dx, az = tz + dz;
      if (!solid(ax, az)) continue;
      const nx = Math.max(ax, Math.min(x, ax + 1)), nz = Math.max(az, Math.min(z, az + 1));
      d = Math.min(d, Math.hypot(x - nx, z - nz));
    }
    let ao = 1 - 0.55 * (1 - Math.min(1, d / 0.5)) ** 2;
    if (under(tx, tz)) {
      // fade in from the edge of the furniture so the shadow under it is soft
      const ex = Math.min(x - tx, tx + 1 - x, z - tz, tz + 1 - z);
      const inner = (under(tx - 1, tz) || x - tx > 0.5) && (under(tx + 1, tz) || x - tx < 0.5) && (under(tx, tz - 1) || z - tz > 0.5) && (under(tx, tz + 1) || z - tz < 0.5);
      ao *= inner ? 0.5 : 0.5 + 0.5 * (1 - Math.min(1, ex / 0.25));
    }
    data[(j * w + i) * 4] = Math.round(ao * 255);
  }
  const tex = new THREE.DataTexture(data, w, h);
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}
