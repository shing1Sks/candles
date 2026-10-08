// HOME TIME: the app. It paints the textures, builds a night from a seed, and then each frame:
// steps the engine at a fixed 60 Hz with your input, draws the state, and routes the events.
// The app decides nothing about the game; all of that is in ../engine.
//   title -> a night (play / detention) -> expelled or home time -> title -> the next night
import * as THREE from 'three';
import { createWorld, stepWorld, NO_INPUT } from '../../engine/world.js';
import { TRUE_ENDING } from '../../engine/story.js';
import { RULES } from '../../engine/rules.js';
import { paintTextures, friezeCanvas, pageCanvas, rugCanvas } from './art/textures.js';
import { headmaster as paintHeadmaster, teacher as paintTeacher, hallPass as paintHallPass } from './art/school.js';
import { Painter } from './art/paint.js';
import { cached, cachedJob } from './art/cache.js';
import { studentBack, teacherBack, blackboardTexture } from './art/rooms.js';
import { kidSpec, paintKid, roadSafetyCutout } from './art/kids.js';
import { ChunkView } from './render/chunks.js';
import { RoomView } from './render/rooms.js';
import { EntranceView } from './render/entrance.js';
import { HallView } from './render/hall.js';
import { DetentionView } from './render/detention.js';
import { People, paintCard } from './render/people.js';
import { Hands } from './render/hands.js';
import { setLights, lightAt, LIGHT } from './render/paperlit.js';
import { Input } from './input.js';
import { FX } from './fx.js';
import { Sound } from './audio.js';
import { startRecorder } from './record.js';
import { wander } from '../../engine/agents/wander.js';
import { lesson } from '../../engine/agents/lesson.js';
import { makeRng } from '../../engine/rng.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const AUTO = params.has('auto') || params.has('agent'); // scenario scripts drive the game without pointer lock
// ?agent=wander|lesson: a scripted agent plays instead of you (soak tests, and watching it play)
const AGENT = { wander, lesson }[params.get('agent')] || null;
const agentRng = makeRng(7);
let agentMem = AGENT?.init(), agentLast = [];
const savedPages = () => JSON.parse(localStorage.getItem('homeTime.pages') || '[]');

const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
const camera = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, 0.05, 60);
camera.rotation.order = 'YXZ';
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

// ---- paint everything once ----
const input = new Input();
const bootT0 = performance.now(), bootMark = (what) => console.log(`BOOT ${what} ${Math.round(performance.now() - bootT0)} ms`);
const T = await paintTextures((label, k) => { $('load').textContent = `painting the school…`; $('bar').firstElementChild.style.width = `${Math.round(k * 100)}%`; }, cachedJob);
bootMark('textures');
$('load').textContent = 'painting the staff…';
await new Promise((r) => setTimeout(r, 0));
// every card is painted once and then kept (art/cache.js): the first launch paints, later ones load
const card = (name, w, h, seed, draw, scale = 1) => cached(name, Math.round(w * scale), Math.round(h * scale), (c) => {
  const x = c.getContext('2d'); x.scale(scale, scale); draw(new Painter(x, seed));
});
const copyOf = (name, make) => { const src = make; return cached(name, src.width, src.height, (c) => c.getContext('2d').drawImage(src, 0, 0)); };
// the big cards are painted in parallel by worker threads; the small ones here
const STAFF = ['headmaster', 'teacher', 'teacherBack', 'passCard', 'cutout', 'board', 'boardEyes', 'boardStory', 'frieze', 'rug'];
const cards = Object.fromEntries(STAFF.map((n, i) => [n, null]));
const painted = await Promise.all([...STAFF.map((n) => cachedJob(n, n)), cachedJob('page0', 'page', { n: 0 })]);
STAFF.forEach((n, i) => { cards[n] = painted[i]; });
cards.pageCard = painted[STAFF.length];
bootMark('staff cards');
// the children: no two alike. 9 ordinary, 6 with one wrong thing about them. Painted at 60% size (plenty
// at the size they appear), a few before the night starts and the rest while you play.
const KID_SCALE = 0.6, KIDS = 15;
cards.kids = [];
async function paintKidVariant(i) {
  const wrong = i >= 9, spec = kidSpec(200 + i, { wrong });
  const k = (view) => cachedJob(`kid${i}${view}`, 'kid', { i, view, scale: KID_SCALE, wrong });
  const [front, back, snap] = await Promise.all([k('f'), k('b'), k('s')]);
  cards.kids.push({ spec, front, back, snap });
}
$('load').textContent = 'painting the children…';
await Promise.all([0, 1, 2, 9].map(paintKidVariant));
bootMark('first children');
(async () => { for (let i = 0; i < KIDS; i++) if (![0, 1, 2, 9].includes(i)) { await new Promise((r) => setTimeout(r, 60)); await paintKidVariant(i); } })();
// the teachers: the first is the one painted above; the rest arrive while you play (art/school.js TEACHERS)
cards.teachers = [{ front: cards.teacher, back: cards.teacherBack, i: 0 }];
(async () => { for (let i = 1; i < 5; i++) { const [front, back] = await Promise.all(['f', 'b'].map((view) => cachedJob(`teacher${i}${view}`, 'teacherVariant', { i, view }))); cards.teachers.push({ front, back, i }); } })();
const hands = new Hands($('hands'));
cards.hand = hands.P.palm.canvas;
// the five torn pages are only needed once found: painted in the background
const pageCards = [];
Promise.all([1, 2, 3, 4, 5].map((n) => cachedJob(`page${n}`, 'page', { n }))).then((c) => { pageCards.push(...c); showPagesOnTitle(); });
bootMark('hands and pages');
$('load').textContent = '';
const fx = new FX();
const sound = new Sound();
const detentionView = new DetentionView(T, cards);
bootMark('detention view');

// ---- a night ----
let N = null; // { world, scene, view, rooms, people, entrance }
function newNight(seed = Math.floor(Math.random() * 1e9)) {
  if (N) { N.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  bootMark('night: start');
  const world = createWorld({ seed, pagesFound: savedPages(), seenAnomalies: JSON.parse(localStorage.getItem('homeTime.seenAnomalies') || '[]') });
  bootMark('night: world');
  N = { seed, world, scene, view: new ChunkView(scene, T, world.layout, RULES), rooms: new RoomView(scene, T, cards, RULES), people: new People(scene, cards, RULES.layout.floorH), entrance: new EntranceView(scene, T), hall: new HallView(scene, T), over: false };
  bootMark('night: views');
  fx.blackA = 0; fx.blackTarget = 0; fx.clearCard();
  window.__night = N;
  return N;
}
newNight(params.has('seed') ? Number(params.get('seed')) : undefined);
// build the first chunks and compile every shader during the loading screen, not in the first frame
{
  const S0 = N.world.S;
  N.view.sync(S0); N.rooms.sync(S0, N.world.layout);
  camera.position.set(S0.player.x, 1.45, S0.player.z);
  $('load').textContent = 'lighting the corridors…';
  try { await renderer.compileAsync(N.scene, camera); } catch { /* older drivers: compile on first frame instead */ }
  bootMark('shaders');
  // and upload every texture now, so the first frame doesn't stall on it
  const seen = new Set();
  const up = [];
  // (on the Iris Xe the first upload waits ~3 s for the GPU to finish compiling the shaders above; it's
  // the compile, not the texture, and Chrome's shader cache makes later launches faster)
  const init = (tx) => { const t0 = performance.now(); renderer.initTexture(tx); up.push([Math.round(performance.now() - t0), tx.image?.width, tx.image?.height]); };
  N.scene.traverse((o) => { const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const mt of mats) if (mt.map && !seen.has(mt.map)) { seen.add(mt.map); init(mt.map); } });
  for (const t of Object.values(T)) if (!seen.has(t.tex)) init(t.tex);
  if (params.has('profile')) console.log('BOOT uploads ' + JSON.stringify(up.slice(0, 6)) + ' of ' + up.length);
  bootMark('textures uploaded');
}

const listeners = [];
const onEvent = (fn) => listeners.push(fn);
const stepListeners = [];
if (params.has('record')) window.__twin = startRecorder(() => N.world, (fn) => stepListeners.push(fn));

// subtitles: the story being read, the voice in the dark
let lineT = 0;
const say = (text, secs = 6) => { $('line').textContent = text; $('line').classList.add('on'); lineT = secs; };

// ---- what the screen does when things happen ----
onEvent((e) => {
  const S = N.world.S;
  switch (e.type) {
    case 'hmStoop': fx.face(cards.headmaster, [222, 96, 204, 250], RULES.headmaster.stoop, 'stoop'); break;
    case 'hmCatch': case 'followerCatch': if (!S.clock.bell) fx.crumple(); break;
    case 'followerAppears': fx.face(cards.student, [96, 22, 228, 262], 0.9, 'rush'); break;
    case 'detentionStart': detentionView.yaw0 = S.player.yaw; setTimeout(() => fx.fadeIn(2.2), 1600); say('Detention.', 3); break;
    case 'snoreStop': say('The snoring stopped.', 2); break;
    case 'linesReset': say('He heard the chalk.', 2.5); break;
    case 'runAlong': fx.fadeOut(0.4); setTimeout(() => fx.fadeIn(1.5), 600); say('“Run along.”', 3); break;
    case 'lessonDoom':
      rooms().startDoom(e.id);
      { const tc = rooms().views.get(e.id)?.tCard || cards.teacher; setTimeout(() => fx.face(tc, [70, 150, 250, 250], 1.4, 'rush'), 1200); }
      setTimeout(() => endNight('EXPELLED', 'the night is over'), 2500);
      break;
    case 'expelled': fx.crumple(); setTimeout(() => endNight('EXPELLED', 'caught after the bell'), 1500); break;
    case 'trueEnding': {
      localStorage.setItem('homeTime.trueEnding', '1');
      fx.fadeOut(1.5);
      TRUE_ENDING.forEach((ln, i) => setTimeout(() => fx.card([ln], 3.2), 1800 + i * 3600));
      setTimeout(() => { fx.clearCard(); fx.fadeIn(1); fx.flood(); }, 1800 + TRUE_ENDING.length * 3600);
      setTimeout(() => endNight('HOME TIME', 'everyone went home', true), 1800 + TRUE_ENDING.length * 3600 + 3800);
      break;
    }
    case 'homeTime': fx.flood(); setTimeout(() => endNight('HOME TIME', 'the doors opened onto daylight', true), 3600); break;
    case 'exitFail': say('The doors opened onto another corridor.', 4); fx.dread = 1; break;
    case 'entranceAppears': say('Somewhere below, a door is letting in light.', 4); break;
    case 'bell': say('The bell. It does not stop.', 4); break;
    case 'falseScare': if (e.kind === 'cutout') N.people.showCutout(S, N.world.layout); break;
    case 'hmArrive': if (e.mode === 'glimpse') fx.dread = Math.max(fx.dread, 0.35); break;
    case 'storyLine': say(e.text, 6.5); break;
    case 'edgeThing': rooms().edgeThing(S, e.room, e.kind); if (e.kind === 'breath') fx.dread = Math.max(fx.dread, 0.7); if (e.kind === 'whisper') say('…', 2); if (e.kind === 'lie') say(`“${e.text}”`, 3.5); break;
    case 'nearlySeen': say('She almost saw him move.', 2.5); break;
    case 'strike': say(e.n === 1 ? 'Every head lifted.' : 'She put the chalk down.', 2.5); break;
    case 'pageFound': if (pageCards.length) fx.face(pageCards[(e.n - 1) % 5], [0, 0, 540, 410], 3.4, 'page'); localStorage.setItem('homeTime.pages', JSON.stringify(S.held.pages)); break;
    case 'lockedIn': say('The door clicked behind him.', 3); break;
    case 'drawerStuck': say('Not while she is looking.', 2.5); break;
    case 'pa': say(`the PA:  “${e.text}”`, 7); break;
    case 'anomalyNear': { const seen = JSON.parse(localStorage.getItem('homeTime.seenAnomalies') || '[]').filter((k) => k !== e.kind); seen.push(e.kind); localStorage.setItem('homeTime.seenAnomalies', JSON.stringify(seen.slice(-5))); break; }
    case 'hallDoor': say(e.text, 5); fx.dread = Math.max(fx.dread, 0.5); break;
    case 'loneChildSpeaks': say(`“${e.text}”`, 6); break;
    case 'theyTurn': fx.dread = 1; say('They all turned round.', 3); break;
    case 'sceneEnter': if (e.scene === 'facingWall') say('Nobody moves.', 2.5); break;
    case 'starEarned': say(e.why === 'drawer' ? 'A gold star, from her drawer.' : 'A gold star, stamped on the back of his hand.', 2.5); break;
    default: break;
  }
});
let useFlash = 0;
onEvent((e) => { if (e.type === 'use' || e.type === 'useNothing') useFlash = 0.35; });
onEvent((e) => sound.event(e, N.world.S));
const rooms = () => N.rooms;

// what E does right now, and what this situation asks of you (bottom centre); the controls (bottom left)
const PROMPTS = {
  door: (S, t) => (S.doors[t.id]?.locked ? 'locked' : S.doors[t.id]?.open ? (S.held.chalk > 0 && !S.doors[t.id]?.chalked ? 'E  mark the door with chalk' : 'E  close the door') : 'E  open the door'),
  paper: () => 'hold E  take the papers', desk: (S) => `E  hand in the papers  (${S.player.carrying})`, mydesk: () => 'E  sit down',
  locker: () => 'E  hide', cupboard: () => 'E  hide', drawer: () => 'E  open the drawer', pass: () => 'E  take the hall pass', chalk: () => 'E  take the chalk',
  page: () => 'E  pick up the page', hallDoor: () => 'E  the Hall doors', storyPage: () => 'E  take the missing page', lap: () => 'E  give her the page', entrance: () => 'E  open the doors',
};
let lastPrompt = '';
function prompt(S) {
  const P = S.player, st = P.room && S.rooms[P.room];
  let text = '';
  if (S.phase !== 'play' && S.phase !== 'detention') text = ''; // an ending: nothing to do
  else if (S.phase === 'detention') text = S.detention.snore ? 'hold E  write your lines  ·  stop when the snoring stops' : 'stop writing';
  else if (P.hidden) text = 'E  come out';
  else if (P.target && PROMPTS[P.target.kind]) text = PROMPTS[P.target.kind](S, P.target);
  else if (st?.state === 'running' && st.roll.lesson === 'handin') text = st.lesson.phase === 'look' ? 'freeze' : P.carrying >= st.students.length ? 'take the papers to her desk' : 'hold E near the desks  ·  freeze when the chalk stops';
  else if (st?.state === 'running' && st.roll.lesson === 'eyes') text = P.seated ? 'hold E  write  ·  keep your eyes on your paper' : 'find your desk';
  else if (st?.state === 'running' && st.roll.lesson === 'story') text = st.lesson.page.found ? 'bring her the page' : 'find the missing page before the end of the story';
  else if (st?.state === 'still' && st.scene === 'facingWall' && !st.turned) text = 'touch nothing';
  else if (P.showing) text = 'showing the hall pass';
  else if (S.headmaster.state === 'chase' && S.held.stars > 0) text = 'Q  drop a star' + (S.held.pass ? '  ·  hold F  show the hall pass' : '');
  if (text !== lastPrompt) { $('prompt').textContent = text; $('prompt').classList.toggle('on', !!text); lastPrompt = text; }
}
input.onSpeed = (v) => say(`mouse speed ${v.toFixed(1)}`, 1.5);

// the end of a night: a card, then the title
function endNight(title, sub, home = false) {
  if (N.over) return;
  N.over = true;
  fx.fadeOut(0.6);
  setTimeout(() => fx.card([title, sub]), 700);
  setTimeout(() => { fx.clearCard(); showTitle(home ? 'Again?' : 'Another night.'); }, 5200);
}

function showTitle(sub) {
  if (document.pointerLockElement) document.exitPointerLock();
  $('sub').textContent = sub;
  showPagesOnTitle();
  $('go').textContent = 'click to begin the next night';
  $('card').classList.remove('hidden');
  newNight();
  agentMem = AGENT?.init();
  if (AUTO) $('card').classList.add('hidden');
}
function showPagesOnTitle() {
  $('pages').innerHTML = '';
  if (pageCards.length < 5) return;
  for (const n of savedPages()) { const img = document.createElement('img'); img.src = pageCards[(n - 1) % 5].toDataURL(); img.title = `page ${n}`; $('pages').append(img); }
}

// pointer lock = playing; losing it pauses the night
let locked = false;
const lock = () => {
  try { canvas.requestPointerLock({ unadjustedMovement: true })?.catch?.(() => canvas.requestPointerLock()); }
  catch { canvas.requestPointerLock(); }
};
$('go').disabled = false;
$('go').onclick = () => { sound.start(); lock(); };
canvas.addEventListener('click', () => { if (!locked && !AUTO) { sound.start(); lock(); } });
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  input.enabled = locked || AUTO;
  $('card').classList.toggle('hidden', locked || AUTO);
  // the first moment of a night: black, a line of where and when, then the corridor fades up
  if (locked && !N.started) {
    N.started = true; N.introUntil = performance.now() + 3800;
    fx.blackA = 1; fx.blackTarget = 1;
    fx.card(['Friday', 'the last day of term. You came in late.'], 3.4);
    setTimeout(() => fx.fadeIn(2.6), 3200);
  }
  if (!N.over) $('go').textContent = 'click to keep going';
  // the controls stay readable for a while, then fade back (full again whenever you pause)
  clearTimeout(window.__dimT);
  $('controls').classList.remove('dim');
  if (locked) window.__dimT = setTimeout(() => $('controls').classList.add('dim'), 25000);
});
if (AUTO) { input.enabled = true; $('card').classList.add('hidden'); if (params.has('sound')) sound.start(); }

// ---- the frame loop: fixed engine steps, then draw ----
const DT = RULES.DT;
let acc = 0, last = performance.now(), frames = 0, fpsT = 0, bob = 0;
let prevPos = null, eyeY = 1.45; // the player's position one engine step ago, to draw smoothly between steps
let frameNo = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (frameNo < 4) bootMark(`frame ${frameNo}`);
  frameNo++;
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const world = N.world, S = world.S;
  if ((locked || AUTO) && !N.over) {
    acc += dt;
    let first = true, n = 0;
    while (acc >= DT && n < 8 && (S.phase === 'play' || S.phase === 'detention') && !(N.introUntil > now)) {
      const inp = AGENT ? AGENT.act(world.S, world.layout, agentRng, agentMem, agentLast) : input.sample(first);
      const Pp = world.S.player; prevPos = { x: Pp.x, y: Pp.y, z: Pp.z };
      const ev = stepWorld(world, inp);
      first = false; acc -= DT; n++;
      for (const e of ev) for (const fn of listeners) fn(e, world);
      for (const fn of stepListeners) fn(world, inp, ev);
      agentLast = ev;
    }
    if (n === 8) acc = 0;
  }
  const P = S.player, R = RULES.player;
  const sp = Math.hypot(P.vx, P.vz);
  bob += dt * sp * 2.4;
  let lights;
  let drawScene = N.scene;
  if (S.phase === 'detention') {
    lights = detentionView.update(S, camera, dt, RULES);
    drawScene = detentionView.scene;
  } else {
    const eye = P.crouch ? R.eyeCrouch : R.eye;
    const shake = S.clock.bell ? 0.012 : 0;
    // between engine steps: blend from the previous step's position; look turns right away
    const a = prevPos ? Math.min(1, acc / DT) : 1, pv = prevPos || P;
    const ix = pv.x + (P.x - pv.x) * a, iy = pv.y + (P.y - pv.y) * a, iz = pv.z + (P.z - pv.z) * a;
    if (Math.hypot(P.x - pv.x, P.z - pv.z) > 1) prevPos = null; // teleported: don't smear
    eyeY += ((P.y + eye) - eyeY) * Math.min(1, dt * 10);
    camera.position.set(ix + (Math.random() - 0.5) * shake, eyeY + Math.abs(Math.sin(bob)) * 0.03 * Math.min(1, sp / 2), iz);
    const lim = P.pitchMin ?? -RULES.player.pitchMax;
    const pitchNow = Math.max(lim, Math.min(RULES.player.pitchMax, P.pitch + (input.enabled && !AGENT ? input.dPitch : 0)));
    camera.rotation.set(pitchNow, P.yaw + (input.enabled && !AGENT ? input.dYaw : 0), Math.sin(bob) * 0.004 * Math.min(1, sp / 2));
    N.view.sync(S);
    N.rooms.sync(S, world.layout);
    lights = N.view.update(S, now / 1000);
    lights.push(...N.rooms.update(S, camera, dt, now / 1000));
    lights.push(...N.entrance.sync(S, world.layout));
    lights.push(...N.hall.sync(S, world.layout));
    lights.push(...N.people.update(S, camera, dt));
  }
  setLights(lights, camera.position);
  LIGHT.uTime.value = now / 1000; LIGHT.uRes.value.set(renderer.domElement.width, renderer.domElement.height);
  useFlash = Math.max(0, useFlash - dt);
  if (lineT > 0) { lineT -= dt; if (lineT <= 0) $('line').classList.remove('on'); }
  const writing = S.phase === 'detention' && input.sample(false).useHeld;
  fx.hidden = !!P.hidden;
  $('controls').style.visibility = S.phase === 'play' || S.phase === 'detention' ? '' : 'hidden';
  hands.draw(dt, { walk: Math.min(1, sp / 2.2), run: P.run, bob, turn: 0, reaching: useFlash > 0 || writing, carrying: P.carrying > 0, showing: P.showing, stars: S.held.stars, hidden: !!P.hidden, light: lightAt(camera.position.x, camera.position.y - 0.5, camera.position.z), tremble: fx.dread > 0.5 || S.clock.bell || (S.director?.tension ?? 0) > 45 });
  $('dot').classList.toggle('on', !!P.target && S.phase === 'play');
  prompt(S);
  // dread: how close he is, and whether he's coming
  const H = S.headmaster;
  const near = H.state && H.state !== 'absent' && H.floor === P.floor ? Math.hypot(H.x - P.x, H.z - P.z) : 99;
  let want = H.state === 'chase' ? Math.max(0.35, 1 - near / 16) : Math.max(0, 1 - near / 12) * 0.6;
  if (S.clock.bell) want = Math.max(want, 0.3);
  if (S.stairs?.follower) want = Math.max(want, 0.6);
  const tens = S.director?.tension ?? 0;
  if (P.seated && S.rooms[P.seated]?.roll.lesson === 'eyes') want = Math.max(want, Math.max(0, Math.min(1, (P.pitch + 0.8) / 0.25)) * 0.9);
  want = Math.max(want, Math.max(0, (tens - 35) / 65) * 0.8);
  fx.dread += (want - fx.dread) * Math.min(1, dt * 2);
  // the view narrows a little as dread builds, and opens again in the aftermath (research/05 R36)
  const fov = 64 - 6 * Math.max(0, Math.min(1, (tens - 40) / 45));
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 1.5); camera.updateProjectionMatrix(); }
  sound.update(S, camera, { lit: lightAt(camera.position.x, camera.position.y, camera.position.z) });
  renderer.render(drawScene, camera);
  fx.draw(dt);
  frames++; fpsT += dt;
  if (fpsT >= 1) { window.__fps = Math.round(frames / fpsT); frames = 0; fpsT = 0; }
}
requestAnimationFrame(frame);

window.__gn = {
  get world() { return N.world; }, get S() { return N.world.S; }, get scene() { return N.scene; }, get rooms() { return N.rooms; }, get view() { return N.view; }, get people() { return N.people; },
  RULES, camera, renderer, input, onEvent, NO_INPUT, fx, cards, hands, newNight, detentionView, sound,
};
