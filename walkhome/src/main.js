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
import { LightRig, FarLamps, SODIUM, lampColour } from './render/lamps.js';
import { makeSky, bakeEnv, SKY_U, makeSkyline, cloudOverMoon } from './render/sky.js';
import { WIN_U } from './render/windows.js';
import { Post } from './render/post.js';
import { Input, LOOK, setMouseSpeed } from './input.js';
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
import { Doors } from './render/doors.js';

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
const skyline = makeSkyline(); scene.add(skyline);
const env = bakeEnv(renderer);
scene.fog = new THREE.FogExp2(SKY_U.uHorizon.value.clone().multiplyScalar(0.9), 0.024);
const hemi = new THREE.HemisphereLight(0x2a3456, 0x08070a, 0.14); scene.add(hemi);
const moon = new THREE.DirectionalLight(0x8a9cc8, 0.32);
moon.castShadow = !Q.has('noshadow'); moon.shadow.mapSize.set(1024, 1024); moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.04;
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
const AHEAD = 4, FAR = 13;
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
const director = makeDirector(lampState), dirRng = makeRng(SEED + ':director' + (Q.has('seed') ? '' : ':' + Date.now())); // (the same road every time; never quite the same night)
const tall = makeTall(), tallView = new TallManView(scene);
const noise = [];
let black = 0, caughtT = -1, hiddenNow = false;
const sound = new Sound();
const fx = new Fx(scene);
// him, peering round a tree trunk (an omen): a second figure, leaning out from behind the bark
const peekView = new TallManView(scene), peek = { on: false };
const deck = new Deck(), extraLights = [];
const ectx = { lampState, scene, camera, fwd: new THREE.Vector3(), P: null, D: null, sound, emit: null, WIN_U, town, director: null, input: null, extraLights, obstacles: null, caught: false, evilBoost: 0, fearAdd: 0 };
let shake = 0;
const ending = new Ending(scene);
const doors = new Doors(town);
const nightStats = { looks: 0, blinks: 0, caught: 0, lost: false, time: 0 };
const intro = { t: Q.has('go') ? 99 : -1 };
const bot = Q.has('bot') ? new Bot() : null, TS = Number(Q.get('ts') || 1);

// ---------------------------------------------------------------- the frame
let last = performance.now(), fpsAcc = 0, fpsN = 0, fps = 60, bob = 0;
const stats = document.getElementById('stats'); if (Q.has('stats')) stats.style.display = 'block';
const fear = { v: Number(Q.get('fear') || 0) };

const airLamps = [];
// are you looking at Biscuit? (near the middle of your view)
const _dv = new THREE.Vector3(), _fw = new THREE.Vector3();
function dogWatched() { camera.getWorldDirection(_fw); _dv.set(dog.x - camera.position.x, dog.y + 0.3 - camera.position.y, dog.z - camera.position.z); const d = _dv.length(); return d < 6 && _fw.dot(_dv) / d > 0.95; }
function lightsNow() {
  const out = []; airLamps.length = 0;
  for (const seg of segs.values()) {
    for (const L of seg.lamps) {
      const st = lampState[L.id];
      st.level = st.flick > 0 ? (Math.sin(U.uTime.value * 37 + L.id) > 0.1 ? 1 : 0.15) * (Math.random() > 0.08 ? 1 : 0) : 1;
      if (st.flick > 0 && st.on && !st.dying) st.flick = Math.max(0, st.flick - 0.016);
      const lv = st.on * st.level;
      const col = L.col ??= lampColour(L.region);
      if (L.bulbMesh) { L.bulbMesh.material.color.setRGB(col[0] * lv + 0.05, (0.3 + col[1] * 0.85) * lv + 0.05, (0.2 + col[2] * 0.8) * lv + 0.06); L.beam.visible = lv > 0.02; const bu = L.beam.userData.mat.uniforms; bu.uI.value = lv; if (!L.colSet) { L.colSet = true; bu.uColor.value.setRGB(col[0], col[1] * 1.03, col[2] * 1.1); } }
      if (lv > 0.01 && L.bulb) { out.push({ pos: L.bulb, color: col, power: lv, cone: 1, kind: 'lamp' }); const d = L.bulb.distanceTo(camera.position); if (d < 75) airLamps.push({ pos: L.bulb, ground: L.ground ??= groundAt(L.bulb.x, L.bulb.z), color: col, level: lv, d }); }
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
  const inp = input.sample(); var inpCall = inp.call;
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
  // the night, counted (for the last words on the credits)
  { const ns = nightStats, back = camera.getWorldDirection(_fw).z > 0.45; if (back && !ns.wasBack) ns.looks++; ns.wasBack = back; ns.time = director.t;
    for (const e of events) if (e.id > (ns.seen || 0)) { if (e.name === 'blink') ns.blinks++; if (e.name === 'respawn') ns.caught++; if (e.name === 'lostDog') ns.lost = true; } ns.seen = evId; }
  const home = ending.update(dt, { P: player, D: dog, tall, director, extraLights, post, sound: sound.ok ? sound : null, caught: false, stats: nightStats });
  if (home && !ending.musicOn && sound.ok) { ending.musicOn = true; for (const k of ['mus_1', 'mus_2', 'mus_3', 'bed_whistle', 'bed_creak']) sound.loops.get(k)?.set(0, 1); sound.stream('end', '/audio/licensed/music_memory_music_box_choir.ogg', { gain: 0.6, bus: 'music' }); }
  if (!home) {
  // at a front door, facing it: E rings the bell (instead of picking Biscuit up)
  { const door = caughtT < 0 ? doors.at(player, camera.getWorldDirection(_fw)) : null;
    if (door) { if (!Q.has('go') || Q.has('hints')) hint('door', 'E to ring the bell.', 4); if (inp.carry) { inp.carry = false; doors.ring(door, { sound: sound.ok ? sound : null, emit, P: player, D: dog }); } }
    doors.update(dt, { sound: sound.ok ? sound : null, emit, P: player, D: dog }); }
  player.adrenaline = !!director.finale; stepPlayer(player, inp, dt, obstacles);
  // Biscuit
  const hand = vm.hold.getWorldPosition(new THREE.Vector3());
  const om = director.omenPt, omenT = om ? [{ x: om.x, z: om.z, d: 19, seen: true, kind: 'omen' }] : [];
  const threats = omenT.length && !tall.active ? omenT : tall.active && tall.mode !== 'glimpse' ? [{ x: tall.x, z: tall.z, d: Math.hypot(tall.x - player.x, tall.z - player.z), seen: tall.seen, kind: 'tall' }] : tall.active ? [{ x: tall.x, z: tall.z, d: Math.hypot(tall.x - player.x, tall.z - player.z) + 12, seen: tall.seen, kind: 'tall' }] : [];
  stepDog(dog, player, inp, dt, { pois, threats, hand: { x: hand.x, z: hand.z }, time: U.uTime.value, calm: director.phase === 'calm' || director.phase === 'after', wet: fx.rainLevel || 0, watched: dogWatched(), park: regionAt(player.s).id === 'parkEdge', blocked: town.blocked, gateAt: town.gateAt, obstacles }, emit, dogRng);
  }
  // noise he can hear: barking, running
  noise.length = 0;
  for (const e of events) if (e.id > seenNoise) { if (e.name === 'bark') noise.push({ x: e.data.x, z: e.data.z, loud: e.data.loud ?? 1 }); if (e.name === 'whimper' && !e.data.lost) noise.push({ x: dog.x, z: dog.z, loud: 0.22 }); if (e.name === 'growl') noise.push({ x: dog.x, z: dog.z, loud: 0.18 }); if (e.name === 'ring') noise.push({ x: e.data.x, z: e.data.z, loud: 0.45 }); }
  seenNoise = evId;
  if (player.running) noise.push({ x: player.x, z: player.z, loud: 0.5 });
  if (inpCall) noise.push({ x: player.x, z: player.z, loud: 0.8 }); // you called his name out loud
  const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
  const hidden = player.crouch > 0.6 && dog.fear < 0.8 && obstacles.some((o) => Math.hypot(o.x - player.x, o.z - player.z) < 1.4);
  hiddenNow = hidden;
  if (!home) {
  if (!tall.catching) stepTall(tall, player, { x: camera.position.x, y: camera.position.y, z: camera.position.z, fx: fwd.x, fy: fwd.y, fz: fwd.z }, dt, lampState, { hidden, noise, fear: director.fear }, emit);
  director.hold = !!(deck.active && !deck.active.ambient);
  stepDirector(director, { P: player, dog, tall, rng: dirRng, caught: caughtT >= 0, lookingBack: fwd.z > 0.45 }, dt, emit);
  // the omens you can see
  for (const e of events) if (e.name === 'omen' && e.id > (ectx.seenOmen || 0)) {
    fx.omen(e.data, player, camera);
    // him, in a lit front room up ahead on your side (he's meant to be behind you)
    // him, peering round a tree up ahead
    if (e.data.kind === 'peek') { const t = town.trees.find((tr) => tr.s > player.s + 12 && tr.s < player.s + 26 && Math.abs(tr.l) > 6 && Math.abs(tr.l) < 12);
      if (t) { const b = roadAt(t.s, t.l), dx = b.x - player.x, dz = b.z - player.z, d = Math.hypot(dx, dz); Object.assign(peek, { on: true, t: 0, seen: 0, out: 0.5, side: Math.random() < 0.5 ? -1 : 1, bx: b.x, by: b.y, bz: b.z, fx: dx / d, fz: dz / d }); } }
    if (e.data.kind === 'tallWindow') { let best = null; for (const seg of segs.values()) for (const l of seg.lights) if (l.kind === 'window' && !l.tv && l.pos.y - player.y < 2.6) { const s = -l.pos.z; /* (ground floor: from the street you can't see into an upstairs room) */ if (s > player.s + 10 && s < player.s + 50 && (!best || Math.abs(s - player.s - 18) < Math.abs(-best.pos.z - player.s - 18))) best = l; }
      if (best) { WIN_U.uTallWin.value.set(best.pos.x, best.pos.y, best.pos.z, 1); ectx.tallWin = { x: best.pos.x, z: best.pos.z, t: 0 }; } }
  }
  if (ectx.tallWin) { const w = ectx.tallWin; w.t += dt; if (w.t > 16 || Math.hypot(w.x - player.x, w.z - player.z) < 5) { WIN_U.uTallWin.value.w = 0; ectx.tallWin = null; } }
  ectx.seenOmen = evId;
  }
  // the things on the way
  Object.assign(ectx, { P: player, D: dog, tall, emit, director, input: inp, obstacles, caught: caughtT >= 0 }); camera.getWorldDirection(ectx.fwd);
  if (!home) deck.update(dt, ectx);
  for (const e of events) if (e.name === 'startle' && e.id > (ectx.seenStartle || 0)) { director.fear = Math.min(1, director.fear + e.data.amount); shake = Math.max(shake, e.data.amount); dog.fear = Math.min(1, dog.fear + e.data.amount * 0.9); }
  ectx.seenStartle = evId;
  if (!Q.has('go') || Q.has('hints')) {
    if (dog.fear > 0.4 && !dog.carried) hint('pet', "He's frightened. Hold F to kneel and stroke him, or E to pick him up.");
    if (dog.tension > 0.95 && dog.state === 'sniff') hint('tug', 'Right mouse to tug the lead.', 4);
    if (dog.state === 'lured' && dog.lureUntil) hint('haul', "He's pulling toward it. Right mouse (or Q) to haul him back.", 5);
    if (tall.active && tall.seen && tall.mode !== 'glimpse') hint('look', "Don't take your eyes off him.", 4);
    if (events.some((e) => e.name === 'blink')) hint('blink', 'You blinked.', 3);
    if (events.some((e) => e.name === 'visit' && e.data.ahead)) hint('ahead', "He's in the road. Get past him. Keep your eyes on him.", 5);
    if (events.some((e) => e.name === 'finale')) hint('finale', 'Home is right there. Run.', 4);
    if (player.winded > 0) hint('wind', 'Out of breath.', 3);
    if (dog.lost) hint('lost', 'Biscuit ran. Listen for him, look for his collar light. R squeaks his toy (but it carries).', 8);
  }
  director.fear = Math.min(1, director.fear + (ectx.fearAdd || 0) * dt * 0.5);
  fear.v = fear.force ?? (Q.has('fear') ? Number(Q.get('fear')) : director.fear);
  while (events.length && events[0].t < U.uTime.value - 6) events.shift();
  // caught: the screen goes, and you wake under the last lamp you passed
  if (caughtT < 0 && events.some((e) => e.name === 'caught' && e.id > seenCaught)) { caughtT = 0; tall.catching = true; ectx.catchYaw = Math.atan2(-(tall.x - player.x), -(tall.z - player.z)); }
  seenCaught = evId;
  // (timeline: he folds down over you in 0.45 s, holds his face there a second, the mouth tears open, black)
  if (caughtT >= 0 && caughtT < 1.75) {
    // you're turned round to him; he folds down over you, his face right in front of yours, lit for a moment
    const k = Math.min(1, caughtT / 0.45) * (caughtT > 1.0 ? 1 : 0.85 + 0.15 * Math.min(1, caughtT / 0.45));
    let d = ectx.catchYaw - player.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    player.yaw += d * Math.min(1, dt * 14); player.pitch += (0.12 - player.pitch) * Math.min(1, dt * 10);
    const fx = -Math.sin(ectx.catchYaw), fz = -Math.cos(ectx.catchYaw);
    tall.x = player.x + fx * 1.82; tall.z = player.z + fz * 1.82; tall.yaw = ectx.catchYaw + Math.PI; tall.active = true;
    tallView.root.position.set(tall.x, player.y, tall.z); tallView.root.rotation.y = tall.yaw; tallView.stoop(k);
    if (!ectx.catchLight) { ectx.catchLight = { pos: new THREE.Vector3(), color: [0.9, 0.85, 0.75], power: 2.2, cone: 0, kind: 'catch' }; extraLights.push(ectx.catchLight); }
    ectx.catchLight.pos.set(player.x + fx * 0.35, player.y + 0.72, player.z + fz * 0.35); ectx.catchLight.power = 2.0 + Math.random() * 0.6; // from below, like a torch under a chin
    shake = Math.max(shake, 0.5);
  }
  if (caughtT >= 0) { caughtT += dt; black = caughtT < 1.45 ? 0 : Math.min(1, (caughtT - 1.45) * 6);
    if (caughtT > 1.7 && ectx.catchLight) { extraLights.splice(extraLights.indexOf(ectx.catchLight), 1); ectx.catchLight = null; tall.catching = false; tallView.stoop(0); } if (caughtT > 3.2 && caughtT - dt <= 3.2) respawn(director, player, tall, dog, emit); if (caughtT > 3.2) black = Math.max(0, 1 - (caughtT - 3.2) / 2.5); if (caughtT > 5.7) caughtT = -1; }
  if (!(intro.t >= 0 && intro.t < 2.2)) post.U.uBlack.value = black;
  post.U.uHide.value += ((hiddenNow ? 1 : 0) - post.U.uHide.value) * Math.min(1, dt * 3);
  // your eyes: heavy when you've held him too long, then a blink (and he's nearer)
  { const want = tall.active && tall.blink > 0 ? 1 : tall.active ? tall.heavy * 0.42 : 0, cur = post.U.uLid.value; post.U.uLid.value = cur + (want - cur) * Math.min(1, dt * (want > cur ? 38 : 9)); }
  pm('sim', t0); t0 = performance.now();
  stream();
  pm('stream', t0);
  // camera: child's eye, a small bounce in the step, a little sway
  const eye = PLAYER.eye + (PLAYER.eyeCrouch - PLAYER.eye) * player.crouch;
  const sp = Math.min(1, player.speed / 3.3);
  bob = Math.sin(player.phase * Math.PI) * 0.028 * Math.min(1, player.speed / 1.4) * (player.running ? 2.2 : 1);
  camera.position.set(player.x, player.y + eye + Math.abs(bob) - 0.01, player.z);
  shake = Math.max(0, shake - dt * 1.5);
  const jolt = shake * shake * 0.04;
  camera.rotation.set(player.pitch + (Math.random() - 0.5) * jolt + (player.running ? Math.sin(player.phase * Math.PI * 2) * 0.006 : 0), player.yaw + (Math.random() - 0.5) * jolt, Math.sin(player.phase * Math.PI * 0.5) * (player.running ? 0.016 : 0.006) * sp, 'YXZ');
  // the world narrows when he's near (tunnel vision), and the first sight of him each time pulls at it
  { const near = tall.active && !tall.vanished ? Math.max(0, 1 - Math.hypot(tall.x - player.x, tall.z - player.z) / 16) : 0;
    for (const e of events) if (e.name === 'tallSeen' && e.id > (ectx.seenFov || 0)) ectx.zoom = 1; ectx.seenFov = evId;
    ectx.zoom = Math.max(0, (ectx.zoom || 0) - dt * 0.8);
    ectx.runK = (ectx.runK || 0) + ((player.running ? 1 : 0) - (ectx.runK || 0)) * Math.min(1, dt * 3);
    const fov = 68 - near * 7 - Math.sin(Math.min(1, ectx.zoom) * Math.PI) * 5 + ectx.runK * 4; // (running: the world rushes at you)
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 4); camera.updateProjectionMatrix(); } }
  camera.updateMatrixWorld();
  // sky and moon follow
  sky.position.copy(camera.position); skyline.position.set(camera.position.x, Math.min(camera.position.y, 2), camera.position.z); // the town is down there: from the hill you look down on it
  // the moon's shadows: a fixed box round you (not swung round with your eyes, or the shadows swim)
  const md = SKY_U.uMoonDir.value; moon.target.position.set(player.x, player.y, player.z - 5); moon.position.copy(moon.target.position).addScaledVector(md, 80);
  // the sky changes as you go: more stars where it's dark (the park), fewer in the high street's
  // glare; the cloud thickens toward the hill; before the rain, a ring round the moon
  { const R = regionAt(player.s).id, k = Math.min(1, dt * 0.2), S = SKY_U;
    const lim = R === 'parkEdge' ? 5.4 : R === 'highStreet' ? 3.3 : R === 'hill' ? 3.8 : 4.3, cl = R === 'hill' ? 0.82 : R === 'parkEdge' ? 0.68 : R === 'highStreet' ? 0.58 : 0.5;
    S.uStarLimit.value += (lim + (1 - lampState.filter((L) => Math.abs(L.s - player.s) < 40 && L.on).length / 4) * 0.4 - S.uStarLimit.value) * k;
    S.uCloud.value += (cl - S.uCloud.value) * k;
    // the moonlight comes and goes as cloud crosses the moon (shadows soften and fade with it)
    { const over = cloudOverMoon(U.uTime.value); moon.intensity += (0.34 * (1 - over * 0.8) - moon.intensity) * Math.min(1, dt * 1.5); hemi.intensity = 0.12 + moon.intensity * 0.12; }
    // now and then, when it's quiet and you're looking up, a shooting star (a little wonder, for the two of you)
    if (S.uMeteor.value.w >= 0) { S.uMeteor.value.w += dt * 1.6; if (S.uMeteor.value.w > 1) S.uMeteor.value.w = -1; }
    else if (director.phase === 'calm' && player.pitch > 0.25 && S.uCloud.value < 0.7 && Math.random() < dt * 0.04) {
      const yaw = player.yaw + (Math.random() - 0.5) * 0.6, el = player.pitch + 0.15 + Math.random() * 0.2;
      S.uMeteor.value.set(-Math.sin(yaw) * Math.cos(el), Math.sin(el), -Math.cos(yaw) * Math.cos(el), 0);
      S.uMeteorDir.value.set(Math.cos(yaw) * (Math.random() < 0.5 ? 1 : -1), -0.35, 0).normalize();
    } S.uHalo22.value += ((player.s > 820 && player.s < 1150 ? 1 : 0) - S.uHalo22.value) * k; }
  // lights
  // footsteps, by what's underfoot
  if (player.stepped) { const al = Math.abs(player.l); emit('step', { surface: al > 4.8 ? (Math.random() < 0.4 ? 'leaves' : 'grass') : al < 2.9 ? 'stone' : 'stone', run: player.running, crouch: player.crouch > 0.5 }); }
  // sound: hand over what happened since last frame, then the mix
  t0 = performance.now();
  if (sound.ok) {
    const lampById = (id) => { const L = lampState[id], T = town.lamps[id]; return T.bulb ? { x: T.bulb.x, y: T.bulb.y, z: T.bulb.z } : { x: L.x, y: 5.6, z: L.z }; };
    const S = { cam: camera, fwd: camera.getWorldDirection(new THREE.Vector3()), up: new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion), player, dog, tall, director, region: regionAt(player.s).id, fear: fear.v, hidden: hiddenNow, rain: fx.rainLevel || 0, dt, caught: caughtT >= 0, lampById,
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
    fx.breathP = player; fx.update(dt, player, camera, bulbs, chim, fear.v);
    U.uRainWet.value = fx.rainLevel; M.cobble.roughness = 1 - fx.rainLevel * 0.3; M.slab.roughness = 1 - fx.rainLevel * 0.35;
  }
  pm('fx', t0); t0 = performance.now();
  puppy.root.visible = !dog.hidden; dog.nearEvil = tall.active && !tall.vanished && Math.hypot(tall.x - dog.x, tall.z - dog.z) < 15;
  puppy.update(dog, dt, camera);
  tallView.update(tall, dt, camera);
  // the peek: he stands behind the trunk, leaning out sideways so his head and a shoulder show; held in
  // your eyes a moment, he leans back in and he's gone; walked up to, he's gone
  if (peek.on) {
    peek.t += dt; const rx = peek.fz * peek.side, rz = -peek.fx * peek.side, R = peekView.root;
    R.visible = true; R.position.set(peek.bx + peek.fx * 0.45 + rx * peek.out * 0.4, peek.by - 0.05, peek.bz + peek.fz * 0.45 + rz * peek.out * 0.4);
    R.rotation.set(0, Math.atan2(-(camera.position.x - R.position.x), -(camera.position.z - R.position.z)), 0);
    peekView.body.rotation.z = -peek.side * (0.18 + peek.out * 0.32); peekView.eyes?.forEach((e2) => e2.lookAt(camera.position));
    const to = _dv.set(R.position.x - camera.position.x, R.position.y + 2.4 - camera.position.y, R.position.z - camera.position.z), dd = to.length();
    if (camera.getWorldDirection(_fw).dot(to) / dd > 0.95) peek.seen += dt;
    if (peek.seen > 0.9) peek.out -= dt * 0.8;
    // a little light on his face (it catches whatever light there is: you'd see it, pale, on the bark)
    if (!peek.light) { peek.light = { pos: new THREE.Vector3(), color: [0.75, 0.78, 0.9], power: 0.7, cone: 0, kind: 'peek' }; extraLights.push(peek.light); }
    peek.light.pos.set(R.position.x - peek.fx * 1.6, R.position.y + 2.5, R.position.z - peek.fz * 1.6);
    if (peek.out <= 0 || peek.t > 14 || dd < 8) { peek.on = false; R.visible = false; extraLights.splice(extraLights.indexOf(peek.light), 1); peek.light = null; }
  }
  vm.update(dt, player, dog, puppy, groundAt, fear.v);
  pm('vm', t0); t0 = performance.now();
  if (!Q.has('nolamps') && !window.__wh?.rigOff) rig.update(camera, lightsNow()); else lightsNow();
  // the air and the wet road: the nearest lamps' glow in the mist and their streaks on the cobbles
  airLamps.sort((a, b) => a.d - b.d); post.setLamps(post.noAir || ending.stillScene ? [] : airLamps, camera);
  { const R = regionAt(player.s).id, rain = fx.rainLevel || 0; post.U.uMist.value = (R === 'parkEdge' ? 0.05 : R === 'hill' ? 0.045 : 0.032) + rain * 0.03 + fear.v * 0.01; post.U.uWet.value = 0.2 + rain * 0.5;
    post.U.uLowMist.value += ((R === 'parkEdge' ? 0.6 : R === 'hill' ? 0.42 : R === 'highStreet' ? 0.18 : 0.28) + Math.sin(U.uTime.value * 0.05) * 0.06 - post.U.uLowMist.value) * Math.min(1, dt * 0.3);
    post.U.uGround.value = player.y; post.U.uMistCol.value.copy(scene.fog.color).multiplyScalar(0.75);
    if (ending.stillScene) post.U.uWet.value = post.U.uLowMist.value = post.U.uMist.value = 0; } // the last picture is indoors
  pm('rig', t0);
  WIN_U.uPlayer.value.set(player.x, player.y + 1, player.z);
  U.uLean.value = 1 + fear.v * 0.9;
  WIN_U.uEvil.value = Math.min(1, fear.v + (ectx.evilBoost || 0));
  WIN_U.uLate.value = Math.min(1, Math.max(0, (player.s - 200) / 1300) * 0.6 + director.t / 1500 * 0.4); // (the further you go and the later it gets, the fewer windows are lit)
  post.U.uFear.value = fear.v * 0.6;
  post.U.uTime.value = U.uTime.value;
  renderer.info.reset();
  if (frameNo % 30 === 0) { lampify(scene); far.setStates(lampState.map((L) => L.on)); } // anything new picks up the street lamps; dead lamps are dark far off too
  if (++frameNo % 3 === 0) renderer.shadowMap.needsUpdate = true; // the moon's shadows barely move: every third frame
  t0 = performance.now();
  if (ending.stillScene) { vm.rig.visible = false; post.render(ending.stillScene, ending.stillCam, dt); } else post.render(scene, camera, dt);
  pm('render', t0); pm('frame', tA);
  // adaptive resolution: hold ~50 fps
  fpsAcc += realDt; fpsN++;
  if (fpsAcc > 1) {
    fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0;
    // (only after a few seconds out of the band: resizing the render targets is itself a hitch)
    const dir = fps < 40 ? -1 : fps > 55 && post.scale < 0.95 ? 1 : 0;
    ectx.scaleRun = dir && dir === ectx.scaleDir ? (ectx.scaleRun || 0) + 1 : dir ? 1 : 0; ectx.scaleDir = dir;
    const want = ectx.scaleRun >= (dir < 0 ? 2 : 4) ? post.scale + dir * 0.05 : post.scale;
    if (want !== post.scale && !Q.has('fixres')) { post.scale = Math.max(innerWidth > 1600 ? 0.5 : 0.6, Math.min(0.95, want)); post.setSize(innerWidth, innerHeight); ectx.scaleRun = 0; }
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
pauseEl.addEventListener('click', (e) => { if (e.target.closest('#settings')) return; renderer.domElement.requestPointerLock?.(); paused = false; pauseEl.style.display = 'none'; sound.ctx?.resume(); last = performance.now(); });
// a few settings on the pause screen (kept between visits)
const SET = { vol: Number(localStorage.getItem('walkhome.vol') ?? 1.0), film: localStorage.getItem('walkhome.film') !== 'off' };
function applySettings() {
  if (sound.master) { sound.master.gain.value = SET.vol; sound.body.gain.value = SET.vol; }
  post.U.uFilm.value = SET.film ? 1 : 0;
  const el = (k) => document.querySelector(`#settings [data-k="${k}"] i`);
  if (el('vol')) { el('vol').textContent = Math.round(SET.vol * 100) + '%'; el('mouse').textContent = LOOK.speed.toFixed(1); el('film').textContent = SET.film ? 'on' : 'off'; }
}
document.querySelectorAll('#settings span').forEach((sp) => sp.addEventListener('click', (e) => {
  const b = e.target.closest('b'); if (!b) return; const up = b === sp.querySelectorAll('b')[1], k = sp.dataset.k;
  if (k === 'vol') { SET.vol = Math.max(0, Math.min(1, Math.round((SET.vol + (up ? 0.1 : -0.1)) * 10) / 10)); localStorage.setItem('walkhome.vol', SET.vol); }
  if (k === 'mouse') setMouseSpeed(LOOK.speed + (up ? 0.1 : -0.1));
  if (k === 'film') { SET.film = !SET.film; localStorage.setItem('walkhome.film', SET.film ? 'on' : 'off'); }
  applySettings();
}));
applySettings(); setInterval(() => { if (sound.master && Math.abs(sound.master.gain.value - SET.vol) > 1e-3) applySettings(); }, 2000);
// gentle first-time hints, each shown once
const hintEl = document.getElementById('hint'), hinted = new Set();
function hint(key, text, secs = 5) { if (hinted.has(key)) return; hinted.add(key); hintEl.textContent = text; hintEl.style.opacity = 1; setTimeout(() => (hintEl.style.opacity = 0), secs * 1000); }
if (Q.has('go')) { title.style.display = 'none'; input.enabled = true; }

// for tools
window.__wh = { fx, doors, bot, ending, deck, ectx, prof, sound, director, tall, tallView, dog, puppy, vm, events, scene, camera, player, town, segs, lampState, fear, post, renderer, M, U, WIN_U, SKY_U, input, stream, fps: () => fps,
  put(s, l = 0, yaw = 0, pitch = 0) { const p = roadAt(s, l); Object.assign(player, { x: p.x, z: p.z, s, l, yaw, pitch, vx: 0, vz: 0 }); stream(true); } };
