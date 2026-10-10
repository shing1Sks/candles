// Outside the maze: the board sits in its wooden box on a dark table in an endless dark, and across the
// table the giant plays the monster (giant.js). Its searchlight is a shaft from its eye down onto the board.
// Everything out here is lit only by the glow coming off the board, so it fades as the candles go out.
import * as THREE from 'three';
import { OU, outMat } from './outlit.js';
import { createGiant } from './giant.js';
import { BEAM } from '../sim/rules.js';

function universe() {
  const g = new THREE.SphereGeometry(600, 48, 24);
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: OU.uTime },
    vertexShader: 'varying vec3 vD; void main() { vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec3 vD;
      float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float n3(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
      void main() {
        vec3 d = normalize(vD);
        // slow grey dust drifting in the void
        float neb = n3(d * 4.0 + uTime * 0.01);
        float c = pow(neb, 3.0) * 0.03;
        // stars: one per cell, a few of them bright, all faintly breathing
        vec3 p = d * 140.0, cell = floor(p);
        float h = h3(cell);
        if (h > 0.985) {
          vec3 sp = cell + 0.5 + 0.35 * (vec3(h3(cell + 7.1), h3(cell + 3.3), h3(cell + 1.9)) - 0.5);
          float s = smoothstep(0.22, 0.0, length(p - sp));
          c += s * (h > 0.997 ? 0.9 : 0.25) * (0.75 + 0.25 * sin(uTime * (1.0 + h * 3.0) + h * 40.0));
        }
        gl_FragColor = vec4(vec3(c), 1.0);
      }`,
    side: THREE.BackSide, depthWrite: false,
  });
  const s = new THREE.Mesh(g, m);
  s.renderOrder = -1;
  return s;
}

// the searchlight shaft: an open cone, brightest where you look straight through it
function beamShaft() {
  const g = new THREE.CylinderGeometry(0.5, BEAM.radius, 1, 40, 1, true);
  g.translate(0, -0.5, 0);
  const m = new THREE.ShaderMaterial({
    uniforms: { uI: { value: 0 }, uTime: OU.uTime },
    vertexShader: /* glsl */ `
      varying vec3 vW; varying vec3 vN; varying vec2 vUv;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vUv = uv;
        gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform float uI, uTime; varying vec3 vW; varying vec3 vN; varying vec2 vUv;
      void main() {
        float edge = abs(dot(normalize(vN), normalize(cameraPosition - vW)));
        float dust = 0.75 + 0.25 * sin(vW.y * 3.0 + uTime * 0.7 + vW.x * 2.0) * sin(vW.z * 2.3 - uTime * 0.5);
        float a = uI * 0.1 * pow(edge, 1.4) * mix(0.55, 1.0, vUv.y) * dust;
        gl_FragColor = vec4(vec3(a), 1.0);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  return mesh;
}

export function createTable(scene, camera, L) {
  OU.uBoard.value.set(0, 0, L.w, L.h);
  const cx = L.w / 2;
  scene.add(universe());

  // the table ends just past the board's far side, where the giant sits; the box the maze is built in
  const table = new THREE.Mesh(new THREE.BoxGeometry(150, 2, 58), outMat(0.2, { wood: true }));
  table.position.set(cx, -1.9, 22);
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(L.w + 1.4, 0.88, L.h + 1.4), outMat(0.12, { wood: true }));
  plinth.position.set(cx, -0.46, L.h / 2);
  scene.add(table, plinth);

  const giant = createGiant(L, camera);
  scene.add(giant.root);
  const shaft = beamShaft();
  scene.add(shaft);
  const eyeW = new THREE.Vector3(), up = new THREE.Vector3(0, -1, 0), dir = new THREE.Vector3();
  let beam = 0;

  return {
    giant,
    event(e) { giant.event(e); },
    update(G, dt, t, input, glow) {
      OU.uTime.value = t;
      OU.uGlow.value += (glow - OU.uGlow.value) * Math.min(1, dt * 2);
      giant.update(G, dt, t);
      const B = G.beam;
      beam += ((B.state === 'on' ? 1 : B.state === 'warn' ? (B.t / BEAM.warn) * 0.6 : 0) - beam) * Math.min(1, dt * 5);
      OU.uBeam.value.set(B.x, B.z, beam, 0);
      shaft.visible = beam > 0.01;
      if (shaft.visible) {
        giant.eye.getWorldPosition(eyeW);
        dir.set(B.x - eyeW.x, -eyeW.y, B.z - eyeW.z);
        const len = dir.length();
        shaft.position.copy(eyeW);
        shaft.quaternion.setFromUnitVectors(up, dir.normalize());
        shaft.scale.set(1, len, 1);
        shaft.material.uniforms.uI.value = beam;
      }
    },
  };
}
