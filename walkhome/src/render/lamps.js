// LIGHT. Street lamps, porch lamps and lit windows are not three.js lights: each frame the nearest
// NL of them (by how much they'd matter: power over distance squared) are written into the shared
// lamp uniforms that every town material reads (materials.js). The shaft of a lamp in the mist is
// a soft additive cone with dust drifting in it. Beyond the built segments, every lamp on the road
// is still there as a point of light, all the way up the hill to the one window that's home.
import * as THREE from 'three';
import { U, NL } from './materials.js';
import { at as roadAt } from '../sim/road.js';

export const SODIUM = [1.0, 0.6, 0.28];
// what the street lamps are, street by street (1970s Britain had all three): old tungsten in your
// own street (warm, homely), low-pressure sodium on the long street (that orange), mercury on the
// high street (a cold blue-green that makes faces look dead), sodium again after
export const LAMP_COL = { ourStreet: [1.0, 0.74, 0.46], longStreet: SODIUM, highStreet: [0.72, 0.9, 0.86], parkEdge: [1.0, 0.62, 0.32], hill: [1.0, 0.58, 0.26] };
export const lampColour = (region) => LAMP_COL[region] || SODIUM;

export function beamMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uH: { value: 6 }, uI: { value: 1 }, uSeed: { value: 0 }, uColor: { value: new THREE.Color(1.0, 0.62, 0.32) } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      varying float vY; varying vec3 vN, vV, vW;
      void main(){ vY = position.y; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vec4 mv = viewMatrix * w; vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uH, uI, uSeed; uniform vec3 uColor; varying float vY; varying vec3 vN, vV, vW;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
        return mix(mix(mix(h(i), h(i + vec3(1,0,0)), f.x), mix(h(i + vec3(0,1,0)), h(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(h(i + vec3(0,0,1)), h(i + vec3(1,0,1)), f.x), mix(h(i + vec3(0,1,1)), h(i + vec3(1,1,1)), f.x), f.y), f.z); }
      void main(){
        float t = clamp(0.5 - vY / uH, 0., 1.);                 // 0 at the bulb, 1 at the ground
        float rim = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
        // mist moving through the beam, and specks of dust catching the light
        // mist moving through it (cheap: two slow waves, not noise: this covers a lot of screen)
        float mist = 0.7 + 0.18 * sin(vW.x * 1.7 + vW.y * 0.9 + uTime * 0.4) + 0.12 * sin(vW.z * 2.3 - vW.y * 1.3 - uTime * 0.27);
        float dust = smoothstep(0.985, 1.0, h(floor(vW * 14.0 + vec3(0., -uTime * 2.0, 0.)) + uSeed));
        float a = rim * (1. - t * 0.8) * mist * 0.11 + dust * rim * 0.25 * (1. - t * 0.5);
        gl_FragColor = vec4(uColor * a * uI, 1.);
      }`,
  });
}

// pick the NL lights that matter most to the camera, write them into the shared uniforms
const _v = new THREE.Vector3();
export class LightRig {
  constructor() { this.list = []; }
  update(camera, sources) {
    const cp = camera.position;
    let n = 0; const best = [];
    for (const L of sources) {
      if (L.power <= 0.001) continue;
      const d2 = L.pos.distanceToSquared(cp), score = L.power * (L.prio || 1) / (1 + d2 * 0.02);
      if (d2 > 1600) continue;
      best.push([score, L]);
    }
    best.sort((a, b) => b[0] - a[0]);
    const pos = U.uLampPos.value, col = U.uLampCol.value;
    for (n = 0; n < NL; n++) {
      const L = best[n]?.[1];
      if (!L) { col[n].set(0, 0, 0); pos[n].set(0, -999, 0); U.uLampCone.value[n] = 0; continue; }
      U.uLampCone.value[n] = L.cone ? 1 : 0;
      pos[n].copy(L.pos).applyMatrix4(camera.matrixWorldInverse);
      // street lamps throw down a cone; porch and window light is a soft omni (cone weight encoded by power sign trick is avoided: windows sit low and close)
      col[n].set(L.color[0], L.color[1], L.color[2]).multiplyScalar(L.power * (L.cone ? 22 : 4));
    }
    U.uLampDown.value.set(0, -1, 0).transformDirection(camera.matrixWorldInverse);
    this.count = Math.min(NL, best.length);
  }
}

// every lamp on the road as a point of light, for the stretch beyond the built segments
export class FarLamps {
  constructor(scene, lamps, homePos) {
    this.lamps = lamps;
    const n = lamps.length + 1, pos = new Float32Array(n * 3), on = new Float32Array(n), size = new Float32Array(n);
    lamps.forEach((L, i) => { const b = roadAt(L.s, L.side * 2.0, 6.4); pos.set([b.x, b.y, b.z], i * 3); on[i] = 1; size[i] = 1; });
    pos.set([homePos.x, homePos.y, homePos.z], lamps.length * 3); on[lamps.length] = 1; size[lamps.length] = 2.6;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aOn', new THREE.BufferAttribute(on, 1)); g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    this.onAttr = g.attributes.aOn;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uNear: { value: 60 }, uScale: { value: 300 }, uFogD: { value: 0.006 }, uTime: U.uTime },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
        attribute float aOn, aSize; uniform float uNear, uScale, uFogD, uTime; varying float vA; varying float vHome;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); float d = -mv.z;
          vHome = step(2.0, aSize);
          // fade in beyond the built stretch (near lamps are drawn for real), fade into the mist far away
          vA = aOn * smoothstep(uNear * 0.8, uNear * 1.25, d) * exp(-d * uFogD) * (vHome > 0.5 ? 2.5 : 1.0);
          if (vHome > 0.5) vA = exp(-d * uFogD * 0.35) * (0.85 + 0.15 * sin(uTime * 0.7));
          gl_PointSize = clamp(uScale * aSize / d, 2.0, 64.0);
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */`
        varying float vA; varying float vHome;
        void main(){ vec2 c = gl_PointCoord - 0.5; float r = length(c); float core = smoothstep(0.12, 0.0, r), halo = smoothstep(0.5, 0.0, r);
          vec3 col = vHome > 0.5 ? vec3(1.0, 0.78, 0.45) : vec3(1.0, 0.6, 0.28);
          gl_FragColor = vec4(col * (core * 2.0 + halo * 0.35) * vA, 1.0); }`,
    });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 5;
    scene.add(this.points);
  }
  setStates(states) { for (let i = 0; i < this.lamps.length; i++) this.onAttr.array[i] = states[i] ?? 1; this.onAttr.needsUpdate = true; }
}
