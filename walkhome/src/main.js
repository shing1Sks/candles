// The Long Way Home: boot, the frame loop, segment streaming, and the glue between the sim and
// the render. URL params for tools: ?seed= ?s= (start distance) ?l= ?yaw= ?pitch= ?go (skip the title)
// ?stats (fps overlay) ?fear= (force the director's fear, 0..1)
import * as THREE from 'three';
import { ROAD, at as roadAt, regionAt } from './sim/road.js';
import { buildTown } from './sim/town.js';
import { makePlayer, stepPlayer, PLAYER } from './sim/player.js';
import { makeTextures } from './render/textures.js';
import { makeMaterials, U, lampify } from './render/materials.js';
import { buildSegment, buildSegmentLOD, disposeSegment } from './render/street.js';
import { LightRig, FarLamps, SODIUM } from './render/lamps.js';
import { makeSky, bakeEnv, SKY_U } from './render/sky.js';
import { WIN_U } from './render/windows.js';
import { Post } from './render/post.js';
import { Input } from './input.js';
import { makeDog, stepDog } from './sim/puppy.js';
import { Puppy } from './render/puppy.js';
import { Viewmodel } from './render/viewmodel.js';
import { groundAt } from './sim/road.js';
import { makeRng } from '../../engine/rng.js';
import { makeDirector, stepDirector, respawn } from './sim/director.js';
import { makeTall, stepTall } from './sim/tallman.js';
import { TallManView } from './render/tallman.js';
import { Sound } from './audio.js';
import { Fx } from './render/fx.js';
import { Deck } from './render/encounters.js';
import { Ending } from './render/ending.js';
import { Bot } from './bot.js';

const Q = new URLSearchParams(location.search);
const SEED = Q.get('seed') || 'biscuit';
if (Q.has('studio')) { const { studio } = await import('./studio.js'); studio(Q.get('studio')); throw new Error('studio mode'); }

// ---------------------------------------------------------------- renderer, scene, camera
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: Q.has('shots') });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = false;
let frameNo = 0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.05, 600);
scene.add(camera);
const post = new Post(renderer); post.setSize(innerWidth, innerHeight);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); post.setSize(innerWidth, innerHeight); });

// sky, fog, moonlight
const sky = makeSky(); scene.add(sky);
const env = bakeEnv(renderer);
scene.fog = new THREE.FogExp2(SKY_U.uHorizon.value.clone().multiplyScalar(0.9), 0.024);
const hemi = new THREE.HemisphereLight(0x2a3456, 0x08070a, 0.14); scene.add(hemi);
const moon = new THREE.DirectionalLight(0x8a9cc8, 0.32);
moon.castShadow = !Q.has('noshadow'); moon.shadow.mapSize.set(1536, 1536); moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.04;
Object.assign(moon.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 120 });
scene.add(moon, moon.target);

// ---------------------------------------------------------------- the town
const T = makeTextures();
const M = makeMaterials(T, env);
U.env = env;
if (Q.has('nonormal')) for (const m of Object.values(M)) { m.normalMap = null; m.needsUpdate = true; }
if (Q.has('nolamps')) U.uLampCol.value.forEach((v) => v.set(0, 0, 0));
const town = buildTown(SEED);
// lamps as the sim sees them: where they stand, whether they're on (a quarter are dead from the start past our street)
const lampRng = makeRng(SEED + ':lamps');
const lampState = town.lamps.map((L) => { const b = roadAt(L.s, L.side * 3.75), on = L.region === 'ourStreet' ? 1 : lampRng.chance(0.72) ? 1 : 0; return { id: L.id, s: L.s, side: L.side, x: b.x, z: b.z, on, base: on, dying: 0, flick: 0, level: 1 }; });
const homePos = roadAt(ROAD.homeS, 0, 3.0);
const far = new FarLamps(scene, town.lamps, homePos);
const rig = new LightRig();
const segs = new Map();
let obstacles = [], pois = [];

function lampObstacles() {
  obstacles = [];
  for (const seg of segs.values()) for (const L of seg.lamps) { const b = roadAt(L.s, L.side * 3.75); obstacles.push({ x: b.x, z: b.z, r: 0.28 }); }
  for (const p of town.props) if (Math.abs(p.s - player.s) < 30 && p.r) { const c = roadAt(p.s, p.l); obstacles.push({ x: c.x, z: c.z, r: p.r }); }
  for (const seg of segs.values()) for (const o of seg.obstacles || []) obstacles.push(o);
}

// stream segments: everything from 1 behind to AHEAD in front is built, one new segment a frame
const AHEAD = 5, FAR = 13;
const lods = new Map();
function stream(force = false) {
  const cur = Math.floor(Math.max(0, player.s) / ROAD.segment);
  const want = new Set(), wantLod = new Set();
  for (let i = Math.max(0, cur - 1); i <= cur + FAR; i++) if (i * ROAD.segment < ROAD.homeS + 30) (i <= cur + AHEAD ? want : wantLod).add(i);
  for (const [i, seg] of segs) if (!want.has(i)) { disposeSegment(seg, scene); segs.delete(i); }
  for (const [i, seg] of lods) if (!wantLod.has(i) || segs.has(i)) { disposeSegment(seg, scene); lods.delete(i); }
  let built = 0;
  for (const i of [...want].sort((a, b) => a - b)) {
    if (segs.has(i)) continue;
    segs.set(i, buildSegment(M, town, i, scene)); built++;
    if (lods.has(i)) { disposeSegment(lods.get(i), scene); lods.delete(i); }
    if (!force && built >= 1) break;
  }
  if (!built || force) for (const i of [...wantLod].sort((a, b) => a - b)) { if (lods.has(i) || segs.has(i)) continue; lods.set(i, buildSegmentLOD(M, town, i, scene)); if (!force) break; }
  if (built) { lampObstacles(); refreshPois(); far.mat.uniforms.uNear.value = (cur + AHEAD) * ROAD.segment - player.s + 8; }
}

// ---------------------------------------------------------------- the player
const input = new Input();
const player = makePlayer(Number(Q.get('s') || 0), Number(Q.get('l') || 3.3));
player.blocked = town.blocked;
renderer.info.autoReset = false;
if (Q.has('yaw')) player.yaw = Number(Q.get('yaw'));
if (Q.has('pitch')) player.pitch = Number(Q.get('pitch'));
stream(true);
// ---------------------------------------------------------------- Biscuit
const dog = makeDog(player), dogRng = makeRng(SEED + ':dog');
const puppy = new Puppy(scene);
const vm = new Viewmodel(scene, camera);
const events = [];
let evId = 0, seenNoise = 0, seenCaught = 0;
const emit = (name, data) => events.push({ name, data, t: U.uTime.value, id: ++evId });
function refreshPois() {
  pois = [];
  for (const seg of segs.values()) for (const L of seg.lamps) { const b = roadAt(L.s, L.side * 3.75); pois.push({ x: b.x, z: b.z, kind: 'lamp', id: 'L' + L.id }); }
  for (const p of town.props) if (Math.abs(p.s - player.s) < 40) { const c = roadAt(p.s, p.l); pois.push({ x: c.x, z: c.z, kind: p.kind, id: 'P' + p.house + p.kind }); }
  for (const h of town.houses) if (Math.abs(h.s - player.s) < 40 && h.boundary !== 'none') { const c = roadAt(h.s - h.side * h.doorZ * 0, h.side * 4.9); pois.push({ x: c.x, z: c.z, kind: 'gate', id: 'G' + h.id }); }
}
refreshPois();
// autopilot for playtests: walks up the road weaving gently, stops now and then
const auto = Q.has('auto') ? { t: 0 } : null;
// ---------------------------------------------------------------- the director and the Tall Man
const director = makeDirector(lampState), dirRng = makeRng(SEED + ':director');
const tall = makeTall(), tallView = new TallManView(scene);
const noise = [];
let black = 0, caughtT = -1, hiddenNow = false;
const sound = new Sound();
const fx = new Fx(scene);
const deck = new Deck(), extraLights = [];
const ectx = { lampState, scene, camera, fwd: new THREE.Vector3(), P: null, D: null, sound, emit: null, WIN_U, town, director: null, input: null, extraLights, obstacles: null, caught: false, evilBoost: 0, fearAdd: 0 };
let shake = 0;
const ending = new Ending(scene);
const intro = { t: Q.has('go') ? 99 : -1 };
const bot = Q.has('bot') ? new Bot() : null, TS = Number(Q.get('ts') || 1);

// ---------------------------------------------------------------- the frame
let last = performance.now(), fpsAcc = 0, fpsN = 0, fps = 60, bob = 0;
const stats = document.getElementById('stats'); if (Q.has('stats')) stats.style.display = 'block';
const fear = { v: Number(Q.get('fear') || 0) };

function lightsNow() {
  const out = [];
  for (const seg of segs.values()) {
    for (const L of seg.lamps) {
      const st = lampState[L.id];
      st.level = st.flick > 0 ? (Math.sin(U.uTime.value * 37 + L.id) > 0.1 ? 1 : 0.15) * (Math.random() > 0.08 ? 1 : 0) : 1;
      if (st.flick > 0 && st.on && !st.dying) st.flick = Math.max(0, st.flick - 0.016);
      const lv = st.on * st.level;
      if (L.bulbMesh) { L.bulbMesh.material.color.setRGB(1.0 * lv + 0.05, 0.85 * lv + 0.05, 0.6 * lv + 0.06); L.beam.visible = lv > 0.02; L.beam.userData.mat.uniforms.uI.value = lv; }
      if (lv > 0.01 && L.bulb) out.push({ pos: L.bulb, color: SODIUM, power: lv, cone: 1, kind: 'lamp' });
    }
    for (const l of seg.lights) { if (l.tv) { const t = U.uTime.value; l.power = l.base * (0.45 + 0.35 * Math.sin(t * 7.3 + l.seed) * Math.sin(t * 2.1 + l.seed * 3) + 0.25 * (Math.sin(t * 23 + l.seed) > 0.7 ? 1 : 0)); }
      if (l.kind === 'window' && WIN_U.uLightsOut.value.z > 0.5) { const w = WIN_U.uLightsOut.value; if (l.pos.z >= Math.min(w.x, w.y) && l.pos.z <= Math.max(w.x, w.y)) continue; } out.push(l); }
  }
  for (const l of extraLights) { l.prio = 6; out.push(l); }
  return out;
}

const prof = {}; const pm = (k, t0) => { prof[k] = (prof[k] || 0) * 0.95 + (performance.now() - t0) * 0.05; };
function frame(now) {
  const tA = performance.now();
  if (paused) { last = now; requestAnimationFrame(frame); return; }
  const realDt = Math.max(0, Math.min(0.1, (now - last) / 1000)), dt = Math.min(0.05, realDt) * TS; last = now;
  if (dt === 0) { requestAnimationFrame(frame); return; }
  U.uTime.value += dt;
  const inp = input.sample();
  if (bot && ending.state === 'waiting') bot.drive(inp, window.__wh, dt);
  if (intro.t >= 0 && intro.t < 5.5) {
    intro.t += realDt;
    const k = Math.min(1, Math.max(0, (intro.t - 1.8) / 3.2)), e = k * k * (3 - 2 * k);
    player.pitch = -0.62 + e * 0.52; inp.look.pitch = 0; inp.look.yaw = 0; if (intro.t < 3.5) { inp.move.x = inp.move.z = 0; }
    post.U.uBlack.value = Math.max(0, 1 - intro.t / 2.2);
    if (intro.t < 0.1) { const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw); Object.assign(dog, { x: player.x + fx * 1.3, z: player.z + fz * 1.3, yaw: player.yaw + Math.PI, state: 'intro', st: 0, lookBackAt: 12 }); }
  }
  if (caughtT >= 0) { inp.move.x = inp.move.z = 0; inp.look.yaw = inp.look.pitch = 0; inp.run = false; inp.carry = false; }
  if (auto) { auto.t += dt; const stop = Math.sin(auto.t * 0.21) > 0.85; inp.move.z = stop ? 0 : -1; const wantL = 2.6 + Math.sin(auto.t * 0.13) * 1.4; inp.look.yaw = (-(wantL - player.l) * 0.02 - player.yaw * 0.05) ; }
  let t0 = performance.now();
  const home = ending.update(dt, { P: player, D: dog, tall, director, extraLights, post, sound: sound.ok ? sound : null, caught: false });
  if (home && !ending.musicOn && sound.ok) { ending.musicOn = true; for (const k of ['mus_1', 'mus_2', 'mus_3', 'bed_whistle', 'bed_creak']) sound.loops.get(k)?.set(0, 1); sound.stream('end', '/audio/licensed/music_memory_music_box_choir.ogg', { gain: 0.6, bus: 'music' }); }
  if (!home) {
  stepPlayer(player, inp, dt, obstacles);
  // Biscuit
  const hand = vm.hold.getWorldPosition(new THREE.Vector3());
  const threats = tall.active && tall.mode !== 'glimpse' ? [{ x: tall.x, z: tall.z, d: Math.hypot(tall.x - player.x, tall.z - player.z), seen: tall.seen, kind: 'tall' }] : tall.active ? [{ x: tall.x, z: tall.z, d: Math.hypot(tall.x - player.x, tall.z - player.z) + 12, seen: tall.seen, kind: 'tall' }] : [];
  stepDog(dog, player, inp, dt, { pois, threats, hand: { x: hand.x, z: hand.z }, time: U.uTime.value, calm: director.phase === 'calm' || director.phase === 'after', wet: fx.rainLevel || 0 }, emit, dogRng);
  }
  // noise he can hear: barking, running
  noise.length = 0;
  for (const e of events) if (e.name === 'bark' && e.id > seenNoise) noise.push({ x: e.data.x, z: e.data.z, loud: 1 });
  seenNoise = evId;
  if (player.running) noise.push({ x: player.x, z: player.z, loud: 0.5 });
  const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
  const hidden = player.crouch > 0.6 && dog.fear < 0.8 && obstacles.some((o) => Math.hypot(o.x - player.x, o.z - player.z) < 1.4);
  hiddenNow = hidden;
  if (!home) {
  if (!tall.catching) stepTall(tall, player, { x: camera.position.x, y: camera.position.y, z: camera.position.z, fx: fwd.x, fy: fwd.y, fz: fwd.z }, dt, lampState, { hidden, noise }, emit);
  director.hold = !!(deck.active && !deck.active.ambient);
  stepDirector(director, { P: player, dog, tall, rng: dirRng }, dt, emit);
  }
  // the things on the way
  Object.assign(ectx, { P: player, D: dog, tall, emit, director, input: inp, obstacles, caught: caughtT >= 0 }); camera.getWorldDirection(ectx.fwd);
  if (!home) deck.update(dt, ectx);
  for (const e of events) if (e.name === 'startle' && e.id > (ectx.seenStartle || 0)) { director.fear = Math.min(1, director.fear + e.data.amount); shake = Math.max(shake, e.data.amount); }
  ectx.seenStartle = evId;
  if (!Q.has('go') || Q.has('hints')) {
    if (dog.fear > 0.4 && !dog.carried) hint('pet', "He's frightened. Hold F to kneel and stroke him, or E to pick him up.");
    if (dog.tension > 0.95 && dog.state === 'sniff') hint('tug', 'Right mouse to tug the lead.', 4);
    if (tall.active && tall.seen && tall.mode !== 'glimpse') hint('look', "Don't take your eyes off him.", 4);
    if (player.winded > 0) hint('wind', 'Out of breath.', 3);
    if (dog.lost) hint('lost', 'Biscuit ran. Listen for him. Look for his collar light.', 7);
  }
  director.fear = Math.min(1, director.fear + (ectx.fearAdd || 0) * dt * 0.5);
  fear.v = fear.force ?? (Q.has('fear') ? Number(Q.get('fear')) : director.fear);
  while (events.length && events[0].t < U.uTime.value - 6) events.shift();
  // caught: the screen goes, and you wake under the last lamp you passed
  if (caughtT < 0 && events.some((e) => e.name === 'caught' && e.id > seenCaught)) { caughtT = 0; tall.catching = true; ectx.catchYaw = Math.atan2(-(tall.x - player.x), -(tall.z - player.z)); }
  seenCaught = evId;
  if (caughtT >= 0 && caughtT < 1.1) {
    // you're turned round to him; he folds down over you, his face right in front of yours, lit for a moment
    const k = Math.min(1, caughtT / 0.55);
    let d = ectx.catchYaw - player.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    player.yaw += d * Math.min(1, dt * 14); player.pitch += (0.12 - player.pitch) * Math.min(1, dt * 10);
    const fx = -Math.sin(ectx.catchYaw), fz = -Math.cos(ectx.catchYaw);
    tall.x = player.x + fx * 1.82; tall.z = player.z + fz * 1.82; tall.yaw = ectx.catchYaw + Math.PI; tall.active = true;
    tallView.root.position.set(tall.x, player.y, tall.z); tallView.root.rotation.y = tall.yaw; tallView.stoop(k);
    if (!ectx.catchLight) { ectx.catchLight = { pos: new THREE.Vector3(), color: [0.9, 0.85, 0.75], power: 2.2, cone: 0, kind: 'catch' }; extraLights.push(ectx.catchLight); }
    ectx.catchLight.pos.set(player.x - fx * 0.25, player.y + 1.3, player.z - fz * 0.25); ectx.catchLight.power = 1.4;
    shake = Math.max(shake, 0.5);
  }
  if (caughtT >= 0) { caughtT += dt; black = caughtT < 0.75 ? 0 : Math.min(1, (caughtT - 0.75) * 5);
    if (caughtT > 1.0 && ectx.catchLight) { extraLights.splice(extraLights.indexOf(ectx.catchLight), 1); ectx.catchLight = null; tall.catching = false; tallView.stoop(0); } if (caughtT > 2.6 && caughtT - dt <= 2.6) respawn(director, player, tall, dog, emit); if (caughtT > 2.6) black = Math.max(0, 1 - (caughtT - 2.6) / 2.5); if (caughtT > 5.1) caughtT = -1; }
  if (!(intro.t >= 0 && intro.t < 2.2)) post.U.uBlack.value = black;
  post.U.uHide.value += ((hiddenNow ? 1 : 0) - post.U.uHide.value) * Math.min(1, dt * 3);
  pm('sim', t0); t0 = performance.now();
  stream();
  pm('stream', t0);
  // camera: child's eye, a small bounce in the step, a little sway
  const eye = PLAYER.eye + (PLAYER.eyeCrouch - PLAYER.eye) * player.crouch;
  const sp = Math.min(1, player.speed / 3.3);
  bob = Math.sin(player.phase * Math.PI) * 0.028 * Math.min(1, player.speed / 1.4) * (player.running ? 1.6 : 1);
  camera.position.set(player.x, player.y + eye + Math.abs(bob) - 0.01, player.z);
  shake = Math.max(0, shake - dt * 1.5);
  const jolt = shake * shake * 0.04;
  camera.rotation.set(player.pitch + (Math.random() - 0.5) * jolt, player.yaw + (Math.random() - 0.5) * jolt, Math.sin(player.phase * Math.PI * 0.5) * 0.006 * sp, 'YXZ');
  camera.updateMatrixWorld();
  // sky and moon follow
  sky.position.copy(camera.position);
  const md = SKY_U.uMoonDir.value; moon.position.set(player.x + md.x * 80, player.y + md.y * 80, player.z + md.z * 80); moon.target.position.set(player.x - Math.sin(player.yaw) * 14, player.y, player.z - Math.cos(player.yaw) * 14);
  // lights
  // footsteps, by what's underfoot
  if (player.stepped) { const al = Math.abs(player.l); emit('step', { surface: al > 4.8 ? (Math.random() < 0.4 ? 'leaves' : 'grass') : al < 2.9 ? 'stone' : 'stone', run: player.running, crouch: player.crouch > 0.5 }); }
  // sound: hand over what happened since last frame, then the mix
  t0 = performance.now();
  if (sound.ok) {
    const lampById = (id) => { const L = lampState[id], T = town.lamps[id]; return T.bulb ? { x: T.bulb.x, y: T.bulb.y, z: T.bulb.z } : { x: L.x, y: 5.6, z: L.z }; };
    const S = { cam: camera, fwd: camera.getWorldDirection(new THREE.Vector3()), up: new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion), player, dog, tall, director, region: regionAt(player.s).id, fear: fear.v, rain: fx.rainLevel || 0, dt, caught: caughtT >= 0, lampById,
      lamps: lampState.filter((L) => L.on && Math.abs(L.s - player.s) < 30).map((L) => ({ ...lampById(L.id), level: L.level, d: Math.hypot(L.x - player.x, L.z - player.z) })).sort((a, b) => a.d - b.d) };
    for (const e of events) if (e.id > (sound.lastId || 0)) sound.on(e, S);
    sound.lastId = evId;
    sound.update(S);
  }
  pm('sound', t0); t0 = performance.now();
  for (const seg of segs.values()) for (const f of seg.anim) f(U.uTime.value, dt);
  {
    const bulbs = [], chim = [];
    for (const seg of segs.values()) { for (const L of seg.lamps) if (L.bulb && lampState[L.id].on && Math.abs(L.s - player.s) < 25) bulbs.push(L.bulb); for (const c of seg.chimneys) if (Math.abs(c.z - player.z) < 45) chim.push(c); }
    bulbs.sort((a, b) => a.distanceToSquared(camera.position) - b.distanceToSquared(camera.position));
    fx.update(dt, player, camera, bulbs, chim, fear.v);
    M.cobble.roughness = 1 - fx.rainLevel * 0.3; M.slab.roughness = 1 - fx.rainLevel * 0.35;
  }
  pm('fx', t0); t0 = performance.now();
  puppy.root.visible = !dog.hidden;
  puppy.update(dog, dt, camera);
  tallView.update(tall, dt, camera);
  vm.update(dt, player, dog, puppy, groundAt);
  pm('vm', t0); t0 = performance.now();
  if (!Q.has('nolamps')) rig.update(camera, lightsNow()); else lightsNow();
  pm('rig', t0);
  WIN_U.uPlayer.value.set(player.x, player.y + 1, player.z);
  U.uLean.value = 1 + fear.v * 0.9;
  WIN_U.uEvil.value = Math.min(1, fear.v + (ectx.evilBoost || 0));
  post.U.uFear.value = fear.v * 0.6;
  post.U.uTime.value = U.uTime.value;
  renderer.info.reset();
  if (frameNo % 30 === 0) lampify(scene); // anything new picks up the street lamps
  if (++frameNo % 2 === 0) renderer.shadowMap.needsUpdate = true; // the moon's shadows barely move: every other frame
  t0 = performance.now();
  if (ending.stillScene) { vm.rig.visible = false; post.render(ending.stillScene, ending.stillCam, dt); } else post.render(scene, camera, dt);
  pm('render', t0); pm('frame', tA);
  // adaptive resolution: hold ~50 fps
  fpsAcc += realDt; fpsN++;
  if (fpsAcc > 1) {
    fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0;
    const want = fps < 40 ? post.scale - 0.05 : fps > 55 && post.scale < 0.95 ? post.scale + 0.05 : post.scale;
    if (want !== post.scale && !Q.has('fixres')) { post.scale = Math.max(0.6, Math.min(0.95, want)); post.setSize(innerWidth, innerHeight); }
    if (Q.has('stats')) stats.textContent = `${fps.toFixed(0)} fps  x${post.scale.toFixed(2)}  calls ${renderer.info.render.calls}  tris ${(renderer.info.render.triangles / 1000).toFixed(0)}k  s ${player.s.toFixed(0)} ${regionAt(player.s).name}`;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------------------------------------------------------------- start
const title = document.getElementById('title');
function begin() { title.style.opacity = 0; setTimeout(() => (title.style.display = 'none'), 1600); input.enabled = true; if (!sound.ctx) sound.init(); if (intro.t < 0) intro.t = 0; setTimeout(() => { const h = document.getElementById('hints'); if (h) h.style.opacity = 0.0; }, 45000); }
title.addEventListener('click', () => { renderer.domElement.requestPointerLock?.(); begin(); });
const pauseEl = document.getElementById('pause'); let paused = false;
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === renderer.domElement;
  input.enabled = locked || Q.has('go');
  // lost the mouse (Esc): the night waits for you
  if (!locked && !Q.has('go') && title.style.display === 'none' && ending.state === 'waiting') { paused = true; pauseEl.style.display = 'flex'; sound.ctx?.suspend(); }
});
pauseEl.addEventListener('click', () => { renderer.domElement.requestPointerLock?.(); paused = false; pauseEl.style.display = 'none'; sound.ctx?.resume(); last = performance.now(); });
// gentle first-time hints, each shown once
const hintEl = document.getElementById('hint'), hinted = new Set();
function hint(key, text, secs = 5) { if (hinted.has(key)) return; hinted.add(key); hintEl.textContent = text; hintEl.style.opacity = 1; setTimeout(() => (hintEl.style.opacity = 0), secs * 1000); }
if (Q.has('go')) { title.style.display = 'none'; input.enabled = true; }

// for tools
window.__wh = { bot, ending, deck, ectx, prof, sound, director, tall, tallView, dog, puppy, vm, events, scene, camera, player, town, segs, lampState, fear, post, renderer, M, U, WIN_U, SKY_U, input, stream, fps: () => fps,
  put(s, l = 0, yaw = 0, pitch = 0) { const p = roadAt(s, l); Object.assign(player, { x: p.x, z: p.z, s, l, yaw, pitch, vx: 0, vz: 0 }); stream(true); } };
