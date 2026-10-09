// Materials for the whole town: three.js standard (physically based) materials with three things
// injected into their shaders.
//   LEAN   every vertex carries aLean, how far it bends toward the road at full fear. The houses
//          breathe a little always, and lean in over you as the director's fear rises.
//   LAMPS  the nearest NL street lamps light every surface through the real BRDF (so wet cobbles
//          and slates catch proper highlights) without being three.js lights: no per-light shader
//          variants, one loop, cheap enough for the Iris Xe.
//   WIND   foliage and cloth sway (aWind = how loose this vertex is).
import * as THREE from 'three';

export const NL = 6;
export const U = {
  uTime: { value: 0 },
  uLean: { value: 1 },        // 1 = the town at rest; up to ~1.9 at the height of fear
  uBreath: { value: 0.03 },   // how much the houses breathe
  uLampPos: { value: Array.from({ length: NL }, () => new THREE.Vector3(0, -999, 0)) }, // view space
  uLampCol: { value: Array.from({ length: NL }, () => new THREE.Vector3()) },
  uLampDown: { value: new THREE.Vector3(0, -1, 0) },
  uLampCone: { value: new Array(NL).fill(1) },
  uWind: { value: new THREE.Vector2(1, 0.3) },
};

const LEAN_VERT_PARS = /* glsl */`
  uniform float uTime, uLean, uBreath;
  uniform vec2 uWind;
  #ifdef HAS_LEAN
    attribute vec3 aLean;
  #endif
  #ifdef HAS_WIND
    attribute float aWind;
  #endif
`;
const LEAN_VERT = /* glsl */`
  #ifdef HAS_LEAN
    // the house breathes (slow, out of step with its neighbours) and leans with the fear
    float breath = sin(uTime * 0.55 + position.x * 0.13 + position.z * 0.07) * uBreath;
    transformed += aLean * (uLean + breath);
  #endif
  #ifdef HAS_WIND
    float gust = 0.6 + 0.4 * sin(uTime * 0.7 + position.x * 0.05) * sin(uTime * 0.23 + position.z * 0.04);
    transformed.x += aWind * uWind.x * gust * (sin(uTime * 2.1 + position.y * 1.7 + position.z) * 0.6 + 0.4);
    transformed.z += aWind * uWind.y * gust * sin(uTime * 1.7 + position.x * 1.3);
    transformed.y += aWind * 0.15 * sin(uTime * 2.7 + position.x * 2.0 + position.z);
  #endif
`;
const LAMP_FRAG_PARS = /* glsl */`
  #define NL ${NL}
  uniform vec3 uLampPos[NL];
  uniform vec3 uLampCol[NL];
  uniform vec3 uLampDown;
  uniform float uLampCone[NL];
`;
// added after three's own direct lights: each lamp is a hooded bulb throwing a cone down
const LAMP_FRAG = /* glsl */`
  for (int i = 0; i < NL; i++) {
    vec3 Lv = uLampPos[i] - geometryPosition;
    float d2 = dot(Lv, Lv);
    if (d2 > 576.0 || dot(uLampCol[i], uLampCol[i]) < 1e-6) continue;
    float d = sqrt(d2);
    vec3 ld = Lv / d;
    float cone = mix(1.0, smoothstep(0.25, 0.8, dot(-ld, uLampDown)), uLampCone[i]);
    float att = 1.0 / (0.6 + d2 * 0.55) * smoothstep(24.0, 14.0, d);
    IncidentLight il;
    il.color = uLampCol[i] * att * (0.06 + 0.94 * cone);
    il.direction = ld;
    il.visible = true;
    RE_Direct(il, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight);
  }
`;

export function inject(mat, { lean = false, wind = false, lamps = true } = {}) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    if (lean) sh.defines = { ...(sh.defines || {}), HAS_LEAN: '' };
    if (wind) sh.defines = { ...(sh.defines || {}), HAS_WIND: '' };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + LEAN_VERT_PARS)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + LEAN_VERT);
    if (lamps) {
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + LAMP_FRAG_PARS)
        .replace('#include <lights_fragment_maps>', LAMP_FRAG + '\n#include <lights_fragment_maps>');
    }
  };
  mat.customProgramCacheKey = () => `town:${lean}:${wind}:${lamps}`;
  mat.userData.flags = { lean, wind };
  return mat;
}

// give any standard material (Biscuit's fur, the Tall Man, the hands, the things on the way) the
// street lamps too, keeping whatever it already does to its shader
export function addLamps(mat) {
  if (mat.userData.lamped || !(mat.isMeshStandardMaterial)) return;
  mat.userData.lamped = true;
  if (mat.userData.flags) return; // town materials already have them
  const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey?.bind(mat);
  mat.onBeforeCompile = (sh, r) => {
    prev?.call(mat, sh, r);
    Object.assign(sh.uniforms, { uLampPos: U.uLampPos, uLampCol: U.uLampCol, uLampDown: U.uLampDown, uLampCone: U.uLampCone });
    if (!sh.fragmentShader.includes('uLampPos')) sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
` + LAMP_FRAG_PARS).replace('#include <lights_fragment_maps>', LAMP_FRAG + `
#include <lights_fragment_maps>`);
  };
  mat.customProgramCacheKey = () => (prevKey ? prevKey() : '') + ':lamps';
  mat.needsUpdate = true;
}
export function lampify(root) { root.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(addLamps); }); }

// shadow casters must bend the same way
const depthMats = {};
export function depthFor({ lean, wind }) {
  const k = `${lean}:${wind}`;
  if (depthMats[k]) return depthMats[k];
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    if (lean) sh.defines = { ...(sh.defines || {}), HAS_LEAN: '' };
    if (wind) sh.defines = { ...(sh.defines || {}), HAS_WIND: '' };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + LEAN_VERT_PARS).replace('#include <begin_vertex>', '#include <begin_vertex>\n' + LEAN_VERT);
  };
  m.customProgramCacheKey = () => 'depth:' + k;
  return depthMats[k] = m;
}

// texMeters: how many metres one tile of the texture covers (the geometry builders scale UVs by it)
export const TEX_METERS = { brick: 1.3, siding: 1.6, render: 2.2, slate: 1.3, cobble: 1.3, slab: 1.4, grass: 2.0, wood: 1.0, metal: 1.0, hedge: 1.1, bark: 1.2 };

export function makeMaterials(T, envMap) {
  // the sky's reflection only where it shows (wet stone, glass, metal): it costs several texture reads a pixel
  const std = (o, flags) => inject(new THREE.MeshStandardMaterial({ ...o, envMap: o.env ? envMap : null, envMapIntensity: o.envMapIntensity ?? 0.6 }), flags);
  const tex = (k, o = {}, flags = { lean: true }) => { const m = std({ map: T[k].map, normalMap: T[k].normalMap, roughnessMap: T[k].roughnessMap, roughness: 1, vertexColors: true, ...o }, flags); m.userData.texMeters = TEX_METERS[k]; return m; };
  const M = {
    // houses (lean)
    brick: tex('brick', { normalScale: new THREE.Vector2(1.2, 1.2) }),
    siding: tex('siding'),
    render: tex('render'),
    slate: tex('slate', { roughness: 0.9, envMapIntensity: 0.9, normalScale: new THREE.Vector2(1.4, 1.4) }),
    trim: std({ color: 0xffffff, roughness: 0.62, vertexColors: true, normalMap: T.siding.normalMap, normalScale: new THREE.Vector2(0.25, 0.25) }, { lean: true }),
    paintL: std({ color: 0xffffff, roughness: 0.6, vertexColors: true }, { lean: true }),
    stone: tex('slab', { roughness: 1 }),
    door: tex('wood', { roughness: 0.6 }),
    gutter: std({ color: 0x1c1c22, roughness: 0.45, metalness: 0.6, vertexColors: true, env: true }, { lean: true }),
    // the street (no lean)
    cobble: tex('cobble', { roughness: 1, env: true, envMapIntensity: 1.4, normalScale: new THREE.Vector2(1.3, 1.3) }, {}),
    kerb: tex('slab', { roughness: 0.9 }, {}),
    slab: tex('slab', {}, {}),
    grass: tex('grass', {}, { wind: false }),
    wood: tex('wood', {}, {}),
    metal: tex('metal', { metalness: 0.5, roughness: 1, env: true }, {}),
    hedge: tex('hedge', { roughness: 1 }, { wind: true }),
    bark: tex('bark', {}, { wind: true }),
    paint: std({ color: 0xffffff, roughness: 0.55, vertexColors: true }, {}),
    plastic: std({ color: 0xffffff, roughness: 0.4, vertexColors: true }, {}),
    cloth: std({ color: 0xffffff, roughness: 0.95, vertexColors: true, side: THREE.DoubleSide }, { wind: true }),
    dark: std({ color: 0x0a090c, roughness: 0.9 }, {}),
  };
  for (const [k, m] of Object.entries(M)) m.name = k;
  return M;
}
