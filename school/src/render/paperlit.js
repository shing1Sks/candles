// THE PAPER-LIT MATERIAL. Painted paper, lit only by the ceiling tubes near you: each tube throws a
// pool of light straight down (a gaussian) plus a little light all round, the same function the
// concept frames were painted with. Tubes are just uniforms, so they can die, flicker and come back.
// Everything fades to black with distance. One shared set of uniforms for every material.
import * as THREE from 'three';

export const MAX_LIGHTS = 12;

export const LIGHT = {
  uLights: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector4(0, -100, 0, 0)) },
  uLightCount: { value: 0 },
  uAmb: { value: 0.012 },
  uFogNear: { value: 3 },
  uFogFar: { value: 17 }, // black fog: you never see a corridor's end (research/05 R9)
  uExposure: { value: 1.0 },
  uRes: { value: new THREE.Vector2(1280, 720) }, // for the vignette
  uTime: { value: 0 },                           // for the film grain
};

const VERT_DECL = 'varying vec3 vWorld;\n';
const FRAG_DECL = `
varying vec3 vWorld;
uniform vec4 uLights[${MAX_LIGHTS}];
uniform int uLightCount;
uniform float uAmb, uFogNear, uFogFar, uExposure, uTime;
uniform vec2 uRes;
`;
const FRAG_LIGHT = `
{
  float L = uAmb;
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    if (i >= uLightCount) break;
    vec4 l = uLights[i];
    vec2 dh = vWorld.xz - l.xz;
    float h = dot(dh, dh);
    float dv = vWorld.y - l.y;
    float v = dv * dv;
    L += l.w * (0.85 * exp(-h / 3.2) * (0.55 + 0.45 * min(1.0, v / 8.0)) + 0.16 / (1.0 + (h + v) / 2.5));
  }
  diffuseColor.rgb *= min(L * uExposure, 1.15);
  float d = distance(vWorld, cameraPosition);
  diffuseColor.rgb *= 1.0 - smoothstep(uFogNear, uFogFar, d);
  // the edges of your sight close in a little, and the dark has grain in it, like old film
  vec2 q = gl_FragCoord.xy / uRes - 0.5;
  diffuseColor.rgb *= 1.0 - dot(q, q) * 1.1;
  float n = fract(sin(dot(floor(gl_FragCoord.xy * 0.5) + floor(uTime * 24.0) * vec2(7.13, 3.71), vec2(12.9898, 78.233))) * 43758.5453);
  diffuseColor.rgb += (n - 0.5) * 0.045 * (0.35 + diffuseColor.rgb);
}
`;

// opaque: walls, floors, ceilings, lockers. cutout: cards and decals with transparent edges.
export function makePaperLit(map, { transparent = false, side = THREE.FrontSide, color = 0xffffff } = {}) {
  const m = new THREE.MeshBasicMaterial({ map, color, transparent, side, depthWrite: !transparent, alphaTest: transparent ? 0.02 : 0 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, LIGHT);
    sh.vertexShader = VERT_DECL + sh.vertexShader.replace(
      '#include <worldpos_vertex>',
      '#include <worldpos_vertex>\nvWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
    );
    sh.fragmentShader = FRAG_DECL + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n' + FRAG_LIGHT);
  };
  // world position must be computed even without fog/shadows
  m.defines = { ...(m.defines || {}), USE_WORLDPOS: '' };
  return m;
}

// pick the nearest lights to the camera and load them into the uniforms
export function setLights(list, cam) {
  const arr = LIGHT.uLights.value;
  const lit = list.filter((l) => l.I > 0.01);
  lit.sort((a, b) => ((a.x - cam.x) ** 2 + (a.y - cam.y) ** 2 * 4 + (a.z - cam.z) ** 2) - ((b.x - cam.x) ** 2 + (b.y - cam.y) ** 2 * 4 + (b.z - cam.z) ** 2));
  const n = Math.min(MAX_LIGHTS, lit.length);
  for (let i = 0; i < n; i++) arr[i].set(lit[i].x, lit[i].y, lit[i].z, lit[i].I);
  LIGHT.uLightCount.value = n;
}

// how lit a point is (the same light the shader computes): used to darken the hands in the dark
export function lightAt(x, y, z) {
  let L = LIGHT.uAmb.value;
  const arr = LIGHT.uLights.value;
  for (let i = 0; i < LIGHT.uLightCount.value; i++) {
    const l = arr[i], h = (x - l.x) ** 2 + (z - l.z) ** 2, v = (y - l.y) ** 2;
    L += l.w * (0.85 * Math.exp(-h / 3.2) * (0.55 + 0.45 * Math.min(1, v / 8)) + 0.16 / (1 + (h + v) / 2.5));
  }
  return L * LIGHT.uExposure.value;
}
