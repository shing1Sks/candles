// GameNet walkable prototype: a first-person 2.5D paper forest.
// Smooth camera; the world moves in 12 fps stop-motion steps. All systems share one game state (S)
// and talk through events; the rulebook (rules.js) holds every number.
import * as THREE from 'three';
import { buildAssets, paintCanvas } from './art.js';
import { RULES, rand } from './rules.js';
import { createState, emit, forwardOf, rightOf } from './state.js';
import { Sprites } from './sprites.js';
import { World } from './world.js';
import { Petals } from './petals.js';
import { Field } from './field.js';
import { Entity } from './entity.js';
import { Mist } from './mist.js';
import { Hands } from './hands.js';
import { FX } from './fx.js';
import { Sound } from './audio.js';
import { Dialogue } from './dialogue.js';

const $ = (id) => document.getElementById(id);
const PARAMS = new URLSearchParams(location.search);
const AUTO = PARAMS.has('auto'); // hands-free, for screenshots: ?auto walks, ?auto=still stands
const AUTO_WALK = AUTO && PARAMS.get('auto') !== 'still';
const PL = RULES.player;

const FOG = new THREE.Color(0xb2afa8), FOG_DREAD = new THREE.Color(0x77736d), FOG_MIST = new THREE.Color(0xc4c2bc);
const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: $('gl') });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
const scene = new THREE.Scene();
scene.background = FOG.clone();
scene.fog = new THREE.Fog(FOG.clone(), RULES.mist.nearClear, RULES.mist.farClear);
const camera = new THREE.PerspectiveCamera(PL.fov, innerWidth / innerHeight, 0.05, 500);
camera.rotation.order = 'YXZ';
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

// paper grain over everything; it jitters at 12 fps like a film of paper
const grain = paintCanvas([0, 0, 512, 512], (p) => {
  p.paper(512, 512, 0.86);
  for (let i = 0; i < 90; i++) {
    const x = p.rand(0, 512), y = p.rand(0, 512), L = p.rand(8, 40), a = p.rand(0, 6.3);
    p.brush([[x, y], [x + Math.cos(a) * L, y + Math.sin(a) * L]], { w: 1, tone: p.rand(0.6, 0.8), alpha: 0.35, bristles: 1, body: false });
  }
}, 99, 1);
const grainUrl = `url(${grain.toDataURL()})`;
for (const id of ['grain', 'start']) $(id).style.backgroundImage = grainUrl;

const S = createState();
const P = S.player;
const keys = new Set();
let locked = false, reachHeld = false, turnV = 0, lastStepSign = 1;

const act = () => (locked || AUTO) && !fx.busy;
addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'KeyE') reachHeld = true;
  if (e.code === 'KeyQ' && act() && !e.repeat) petals?.drop(S);
});
addEventListener('keyup', (e) => { keys.delete(e.code); if (e.code === 'KeyE') reachHeld = false; });
addEventListener('mousedown', (e) => {
  if (!locked) return;
  if (e.button === 0) reachHeld = true;
  if (e.button === 2 && act()) petals?.drop(S);
});
addEventListener('mouseup', (e) => { if (e.button === 0 && !keys.has('KeyE')) reachHeld = false; });
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('mousemove', (e) => {
  if (!locked || fx.busy) return;
  // Chrome on Windows sometimes reports one huge jump under pointer lock: drop those
  if (Math.abs(e.movementX) > 300 || Math.abs(e.movementY) > 200) return;
  const L = RULES.player;
  P.yaw -= e.movementX * L.lookYaw;
  P.pitch = Math.max(-L.pitchMax, Math.min(L.pitchMax, P.pitch - e.movementY * L.lookPitch));
  turnV += e.movementX * L.lookYaw;
});
// raw mouse input avoids the OS acceleration and the jumps; fall back where it isn't supported
const lockPointer = () => {
  const el = $('gl');
  try { el.requestPointerLock({ unadjustedMovement: true })?.catch?.(() => el.requestPointerLock()); }
  catch { el.requestPointerLock(); }
};
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === $('gl');
  $('start').classList.toggle('hidden', locked || AUTO || fx.busy);
  $('go').textContent = 'click to keep walking';
});

const sprites = new Sprites();
const sound = new Sound();
const dialogue = new Dialogue($('line'));
const fx = new FX();
let world, petals, field, entity, mist, hands;

$('go').addEventListener('click', () => { sound.start(); lockPointer(); });
// clicking the world also gets you back in (e.g. after an effect ended without the lock)
$('gl').addEventListener('click', () => { if (!locked && !fx.busy && !$('go').disabled) { sound.start(); lockPointer(); } });
const refreshOverlay = () => $('start').classList.toggle('hidden', locked || AUTO || fx.busy);

const A = await buildAssets((label, k) => { $('load').textContent = `${label}…`; $('bar').style.width = `${Math.round(k * 100)}%`; });
world = new World(scene, sprites, A);
petals = new Petals(scene, sprites, A);
field = new Field(scene, sprites, A, petals);
entity = new Entity(scene, sprites, A, world);
mist = new Mist(scene, sprites, A);
hands = new Hands($('hands'), A);
world.update(0, 0);
$('load').textContent = 'the forest is ready.';
$('bar').style.width = '100%';
$('go').disabled = false;
if (AUTO) $('start').classList.add('hidden');

// ---- events -> voice, sound, effects ----
function onEvent(ev) {
  switch (ev.type) {
    case 'petalCaught':
      sound.play('pickup');
      if (ev.held === 1 && !S.saidFirstPetal) { S.saidFirstPetal = true; dialogue.say('firstPetal'); }
      else if (ev.held % 3 === 0) dialogue.say('petals');
      break;
    case 'petalDropped': sound.play('drop'); break;
    case 'dropEmpty': dialogue.say('dropEmpty'); break;
    case 'bloom': sound.play('bloom'); dialogue.say('bloom', true); break;
    case 'dissolve': sound.play('dissolve'); break;
    case 'fieldGone': dialogue.say('gone'); break;
    case 'reached':
      dialogue.say('reached', true);
      fx.floodIn(AUTO).then(() => { field.letGo(S); if (!AUTO) lockPointer(); refreshOverlay(); });
      document.exitPointerLock?.();
      break;
    case 'peekSeen': dialogue.say('peek'); sound.play('staple'); break;
    case 'waveSeen': dialogue.say('wave'); break;
    case 'behindSeen': dialogue.say('behind'); break;
    case 'turned': sound.play('flip'); dialogue.say('turned', true); setTimeout(() => dialogue.say('hunt'), 3000); break;
    case 'lunge': sound.play('lunge'); break;
    case 'distracted': dialogue.say('distracted', true); break;
    case 'remember': sound.play('flip'); dialogue.say('remember'); break;
    case 'caught':
      if (fx.busy || field.phase === 'held') entity.reset(); // never two endings at once
      else caught();
      break;
    case 'mistIn': sound.play('mist'); dialogue.say('mist'); break;
  }
}

function caught() {
  sound.play('caught');
  S.caught++;
  fx.crumple(() => {
    // you wake somewhere else in the forest, your hand empty
    const a = Math.random() * Math.PI * 2, d = rand(RULES.caught.teleport);
    P.x += Math.cos(a) * d; P.z += Math.sin(a) * d; P.yaw = Math.random() * 6.28; P.vx = P.vz = 0;
    S.held = [];
    S.dread = 0;
    S.shake = 0;
    entity.reset();
    world.update(P.x, P.z);
    emit(S, 'woke', { x: +P.x.toFixed(1), z: +P.z.toFixed(1) });
    setTimeout(() => dialogue.say('caught', true), 2600);
  }, RULES.caught.wakeDelay).then(refreshOverlay);
}

const STEP = 1 / 12;
let last = performance.now(), t = 0, acc = 0, started = false, grainT = 0, fov = PL.fov;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  t += dt;
  const active = act();
  if (active && !started) { started = true; setTimeout(() => dialogue.say('start'), 2500); }

  // --- movement (smooth) ---
  const [fx_, fz_] = forwardOf(P), [rx, rz] = rightOf(P);
  let ix = 0, iz = 0;
  if (active) {
    if (keys.has('KeyW') || keys.has('ArrowUp') || AUTO_WALK) { ix += fx_; iz += fz_; }
    if (keys.has('KeyS') || keys.has('ArrowDown')) { ix -= fx_; iz -= fz_; }
    if (keys.has('KeyD') || keys.has('ArrowRight')) { ix += rx; iz += rz; }
    if (keys.has('KeyA') || keys.has('ArrowLeft')) { ix -= rx; iz -= rz; }
  }
  if (AUTO_WALK) { P.yaw += Math.sin(t * 0.3) * 0.004; turnV += Math.sin(t * 0.3) * 0.004; }
  const moving = ix !== 0 || iz !== 0;
  const il = Math.hypot(ix, iz) || 1;
  const sprinting = moving && (keys.has('ShiftLeft') || keys.has('ShiftRight'));
  const speed = sprinting ? PL.sprint : PL.walk;
  const k = Math.min(1, dt * 6);
  P.vx += ((moving ? ix / il : 0) * speed - P.vx) * k;
  P.vz += ((moving ? iz / il : 0) * speed - P.vz) * k;
  const pos = { x: P.x + P.vx * dt, z: P.z + P.vz * dt };
  world.collide(pos, PL.radius);
  P.x = pos.x; P.z = pos.z;
  const v = Math.hypot(P.vx, P.vz);
  P.walk = Math.min(1, v / PL.walk);
  P.sprint = sprinting ? 1 : 0;
  P.reaching = reachHeld && active;
  P.bob += dt * v * 2.3;
  const sgn = Math.sign(Math.sin(P.bob));
  if (sgn !== lastStepSign && v > 0.6) sound.play('step');
  lastStepSign = sgn;

  const shake = S.shake * 0.04;
  camera.position.set(P.x + (Math.random() - 0.5) * shake, PL.eyeHeight + Math.abs(Math.sin(P.bob)) * 0.045 * P.walk * (1 + P.sprint * 0.6) + (Math.random() - 0.5) * shake, P.z);
  camera.rotation.set(P.pitch, P.yaw, Math.sin(P.bob) * 0.006 * P.walk * (1 + P.sprint));
  fov += ((P.sprint ? PL.sprintFov : PL.fov) - fov) * Math.min(1, dt * 3);
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }

  world.update(P.x, P.z);
  S.wind = 0.5 + 0.35 * Math.sin(t * 0.11) + 0.15 * Math.sin(t * 0.37);
  S.windAng += dt * 0.008;

  // --- the world moves in stop-motion steps ---
  acc += dt;
  while (acc >= STEP) {
    acc -= STEP;
    S.t += STEP;
    world.step(S.t, STEP, S);
    if (active) {
      mist.step(S.t, STEP, S);
      petals.step(S.t, STEP, S);
      field.step(S.t, STEP, S);
      entity.step(S.t, STEP, S);
    }
    S.dread = entity.presence;
    fx.edges(S.dread);
    for (const fn of stepListeners) fn(S);
  }
  for (const ev of S.events.splice(0)) { onEvent(ev); for (const fn of listeners) fn(ev, S); }

  // fog: dread darkens and closes it, mist whitens and closes it further
  scene.fog.color.copy(FOG).lerp(FOG_MIST, S.mist * 0.7).lerp(FOG_DREAD, S.dread * 0.6);
  scene.background.copy(scene.fog.color);
  const M = RULES.mist;
  scene.fog.far = M.farClear + (M.farMist - M.farClear) * S.mist - S.dread * 14;
  scene.fog.near = M.nearClear + (M.nearMist - M.nearClear) * S.mist;
  mist.frame(S, scene.fog.color);
  $('vignette').style.opacity = (0.5 + S.dread * 0.5).toFixed(3);

  grainT += dt;
  if (grainT > STEP) { grainT = 0; $('grain').style.backgroundPosition = `${(Math.random() * 512) | 0}px ${(Math.random() * 512) | 0}px`; }

  sprites.update(camera, scene.fog.far + 14);
  renderer.render(scene, camera);
  turnV *= Math.pow(0.02, dt);
  const near = field.nearness(S);
  hands.draw(dt, { walk: P.walk, sprint: P.sprint, bob: P.bob, turn: Math.max(-1, Math.min(1, turnV * 8)), reaching: P.reaching, tremble: (field.phase === 'dissolving' && near > 0.5) || S.dread > 0.7, held: S.held, hidden: fx.busy && entity.state === 'caught' });
  dialogue.update(dt);
  sound.update(dt, { wind: S.wind, dread: S.dread, colour: near, mist: S.mist });
  frames++;
  requestAnimationFrame(frame);
}

// extra listeners: the data twin recorder hooks in here (per event, and per world step)
const listeners = [], stepListeners = [];

let frames = 0;
setInterval(() => { window.__fps = frames; frames = 0; }, 1000);
requestAnimationFrame(frame);
window.__gn = { RULES, S, sprites, field, entity, world, petals, mist, camera, renderer, keys, setReach: (r) => (reachHeld = r), onEvent: (fn) => listeners.push(fn), onStep: (fn) => stepListeners.push(fn) };
if (PARAMS.has('record')) import('./twin.js').then((m) => m.startRecorder(window.__gn));
