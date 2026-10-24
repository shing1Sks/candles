import './style.css';
import { inject } from '@vercel/analytics';
import { parseLevel } from './sim/level.js';
import { createGame, step, actionHint } from './sim/game.js';
import { createMind } from './sim/mind/index.js';
import { createView } from './render/view.js';
import { createAudio } from './audio.js';
import { configFor, startEpisode, stepEpisode, episodeOver, episodeHash, STEP } from './sim/episode.js';
import { eventDetail } from './sim/schema.js';
import { createDream } from './model/dream.js';
import { createKidBot, observeKid } from './sim/bots/kid.js';
import { rng } from './sim/rng.js';
import { setNightmarePolicy, mlpPolicy } from './sim/mind/nightmare.js';
import { createHow } from './how.js';

inject();

// Two ways to play, picked on the first screen (or ?mode=classic / ?mode=gamenet):
//   classic: the rules run the house (src/sim) and the nightmare, the learned monster (train/rl), hunts you
//   gamenet: the main model is the house (src/model/dream.js) and the same nightmare plays the monster inside it
// A dev link skips the first screen:
//   ?persona= (stalker, brute, hound, warden, pathfinder, classic, nightmare) the monster; ?model=NAME a model of
//   public/models; ?watch=batch:i a recorded episode; &seed= &at=x,z &mon=x,z &zoom= &reveal &dist= &debug
const PLAY_MODEL = 'v5_M_s2u'; // the model GameNet plays (shipped: tools/ship_model.mjs)
const q = new URLSearchParams(location.search);
const devLink = ['watch', 'model', 'persona', 'rec', 'manual', 'seed', 'at', 'mon', 'zoom', 'reveal', 'dist', 'bot'].some((k) => q.has(k)); // not ?utm_ and the like
let mode = q.get('mode') || (q.has('model') ? 'gamenet' : devLink ? 'classic' : null);
// the nightmare for both modes; a dev link without ?persona= keeps the coded one (or the nightmare for v4/v5 models)
let nightmare = q.has('mode') || /^v[45]/.test(q.get('model') || ''); // a mode chosen on the first screen sets it
const persona = () => q.get('persona') || (nightmare ? 'nightmare' : 'classic');
let policy = null; // the nightmare's weights (until they load it simply chases)
// &seedpolicy=N (recording): its choices drawn from a seeded stream, so a ?watch= game replays as simulated in Node
const loadPolicy = () => (policy ||= fetch('/nightmare.json').then((r) => r.json()).then((w) => setNightmarePolicy(mlpPolicy(w, q.has('seedpolicy') ? { rand: rng(Number(q.get('seedpolicy'))) } : undefined))));
if (persona() === 'nightmare') loadPolicy();

// &manual=1 (recording clips): the page only moves when the recorder calls window.__frame(dt), one exact frame at a time
const manual = q.has('manual');
const debug = q.has('debug');
const L = parseLevel();
const view = createView(document.getElementById('c'), L);
const audio = createAudio();
const $ = (id) => document.getElementById(id);

let G, phase = 'landing', endT = 0, endTimer = 0, seed = Number(q.get('seed')) || (Date.now() % 100000);
// ?watch=batch:i plays a recorded episode (its bots drive both sides) instead of your controller.
// &from=ROW starts at that step (run silently up to it), &to=ROW stops there, &rec=1 starts at once (for recording)
const watch = q.get('watch'), clipFrom = Number(q.get('from')) || 0, clipTo = Number(q.get('to')) || 0;
let ep = null, watchSpeed = Number(q.get('speed')) || 1;
let dream = null, modelName = null, loading = null; // GameNet: the main model runs the world (below)
let ready = false; // the start screen waits for the monster's weights or the model
let kidBot = null;
const dreamIn = { mx: 0, mz: 0, creep: false, blow: false, use: false, throw: false }; // your latest input, for its next step
const watchLog = [];
function newGame() {
  if (watch) {
    const [batch, i] = watch.split(':');
    const config = configFor(batch, Number(i), { keys: Number(q.get('keys') || 0), crawl: Number(q.get('crawl') || 0) }); // &keys=, &crawl=: as the batch was made
    if (q.has('persona')) config.persona = { type: q.get('persona') }; // watch a chosen monster type
    ep = startEpisode(config);
    G = ep.G;
    while (ep.rows < clipFrom && !episodeOver(ep)) { stepEpisode(ep); G.events.length = 0; }
    watchLog.length = 0;
  } else {
    G = createGame(L, seed++);
    G.mind = createMind(G, { type: persona() });
  }
  if (q.has('at')) { const [x, z] = q.get('at').split(',').map(Number); G.kid.x = x; G.kid.z = z; }
  if (q.has('mon')) { const [x, z] = q.get('mon').split(',').map(Number); G.monster.x = x; G.monster.z = z; }
  view.st.flash = 0; view.st.dark = 0;
  clearTimeout(endTimer);
  view.reset?.(G);
  dream?.reset(G);
  Object.assign(dreamIn, { mx: 0, mz: 0, creep: false, blow: false, use: false, throw: false });
  // &bot=sneaker (or sprinter, hider, trickster, greedy): a kid bot plays in the model's world instead of you
  if (modelName && q.has('bot')) { kidBot = createKidBot(G, { style: q.get('bot'), skill: Number(q.get('skill') || 0.8) }, rng(seed)); dream?.input(dreamIn, true); }
  drawCandles();
}
newGame();

// ---------- screens: landing -> title (a mode, its loading) -> play <-> paused -> end ----------
const SCREENS = ['landing', 'title', 'pause', 'end'];
function show(screen) {
  document.activeElement?.blur(); // a card or button just used keeps no focus behind the next screen
  for (const s of SCREENS) $(s).classList.toggle('hide', s !== screen);
  $('hud').classList.toggle('hide', screen === 'landing' || screen === 'title');
  $('corner').classList.toggle('quiet', !screen); // in play the corner keeps out of the way
  document.body.dataset.screen = screen || 'play';
}

function landing() {
  phase = 'landing';
  if (!devLink) history.replaceState(null, '', location.pathname);
  newGame();
  show('landing');
}

// a mode chosen: its start screen, and what it needs loaded before you can start
function choose(m) {
  mode = m;
  if (!devLink) nightmare = true;
  if (!devLink) history.replaceState(null, '', `?mode=${m}`);
  modelName = m === 'gamenet' ? q.get('model') || PLAY_MODEL : null; // a loaded model stays loaded for a way back
  phase = 'title';
  newGame();
  $('titleKicker').textContent = watch ? 'A recorded game' : m === 'gamenet' ? 'GameNet' : 'Classic';
  $('titleSub').textContent = watch ? `${watch}: bots on both sides` : m === 'gamenet'
    ? 'No rules are running. The house you see is a neural network\'s guess, a tenth of a second at a time.'
    : 'The monster learned to hunt by playing thousands of games. It reaches under beds and squeezes into vents.';
  show('title');
  ready = false; drawReady();
  $('load').classList.toggle('hide', m !== 'gamenet');
  if (m === 'gamenet') loadModel();
  else (persona() === 'nightmare' ? loadPolicy() : Promise.resolve()).then(() => { if (mode === 'classic') isReady(); });
}
function isReady() {
  ready = true; drawReady();
  if (q.has('rec') && phase === 'title') begin(); // recording a clip: no title
}

function drawReady() {
  const go = $('titleGo');
  go.textContent = ready ? (matchMedia('(pointer: coarse)').matches ? 'tap to begin' : 'press any key') : mode === 'gamenet' ? '' : 'one moment';
  go.classList.toggle('ready', ready);
}

// GameNet: the model downloads (once: then the browser keeps it), is built for the graphics card and warmed up
function loadModel() {
  if (dream) { $('load').classList.add('hide'); isReady(); return; }
  const box = $('load'), bar = $('loadBar'), text = $('loadText');
  box.classList.remove('hide', 'failed', 'busy'); $('loadFail').hidden = true;
  const mb = (n) => (n / 1e6).toFixed(0);
  const progress = (m) => {
    box.classList.toggle('busy', m.stage !== 'download');
    if (m.stage === 'download') {
      bar.style.width = `${m.total ? (70 * m.got) / m.total : 10}%`;
      text.textContent = m.cached ? 'Loading the network from this browser' : `Downloading the network · ${mb(m.got)} of ${m.total ? mb(m.total) : '?'} MB`;
    } else text.textContent = m.stage === 'compile' ? 'Building it on your graphics card' : 'Waking it up';
  };
  if (loading) return;
  text.textContent = 'Starting'; bar.style.width = '2%';
  // a kid bot decides once per model step, on the row that just landed
  const onStep = (g) => {
    if (manual) { landedFrame?.(); landedFrame = null; return; } // recording: __dreamFrame paces every step
    if (kidBot) dream.input(kidBot(observeKid(g), STEP * dream.stride), phase === 'play');
  };
  loading = createDream(modelName, G, { ep: q.get('ep') || 'webgpu', temp: Number(q.get('temp') || 1), mix: Number(q.get('mix') ?? 0.3), topP: Number(q.get('top_p') ?? 0.9),
    // the defaults are the ones that played best (the rollout exam): your kid exact (&kid=), the monster's mind drawn
    // (&mind=), the rest at &mix; &game= draws the game's state (play, won, caught) at that mix
    mixFor: { ...Object.fromEntries(['mind', 'belief', 'pending', 'sense'].map((k) => [k, Number(q.get('mind') ?? 1)])), kid: Number(q.get('kid') ?? 0),
      ...(q.has('game') ? { game: Number(q.get('game')) } : {}) }, int8: q.has('int8'), snap: q.get('snap') !== '0', peak: q.get('peak') !== '0', walls: q.get('walls') !== '0', lockstep: q.has('bot') || manual, onStep, onProgress: progress,
    // &brain=1: the monster's brain plays the monster (src/model/brain.js) and the model is the world; on for the v5 models
    brain: q.has('brain') ? q.get('brain') !== '0' : modelName.startsWith('v5') })
    .then((d) => {
      dream = d; loading = null;
      d.reset(G); // the game the screen shows now
      if (kidBot && !manual) d.input(dreamIn, true);
      box.classList.remove('busy'); bar.style.width = '100%'; text.textContent = 'Ready';
      setTimeout(() => box.classList.add('hide'), 500);
      if (mode === 'gamenet') isReady();
    }, (e) => {
      loading = null; console.error(e);
      box.classList.remove('busy'); box.classList.add('failed');
      text.textContent = 'GameNet could not start in this browser. It needs WebGPU (Chrome or Edge on a computer) and a 99 MB download.';
      $('loadFail').hidden = false;
    });
}

function begin() {
  if (!ready) return;
  audio.start();
  phase = 'play';
  if (!q.has('nointro')) view.intro(); // &nointro (recording): straight to the kid
  show(null);
}
function pause() { if (phase !== 'play') return; phase = 'paused'; keys.clear(); show('pause'); }
function resume() { if (phase !== 'paused') return; phase = 'play'; show(null); }
function retry() { newGame(); begin(); }

for (const b of document.querySelectorAll('.mode')) {
  b.addEventListener('click', () => choose(b.dataset.mode));
}
const how = createHow(L, loadPolicy); // the how-it-works popup
$('howModal').addEventListener('pointerdown', (e) => { if (e.target === e.currentTarget) how.hide(); });
for (const b of document.querySelectorAll('[data-act]')) {
  b.addEventListener('click', (e) => { e.stopPropagation(); ({ menu: landing, resume, retry, retryLoad: loadModel, classic: () => choose('classic'), openHow: how.show, closeHow: how.hide })[b.dataset.act](); });
}
$('title').addEventListener('pointerdown', (e) => { if (!e.target.closest('button')) begin(); });
if (matchMedia('(pointer: coarse)').matches) $('touchNote').classList.remove('hide');
if (!navigator.gpu) { $('gamenetFoot').textContent = 'this browser has no WebGPU: it would run on the processor, very slowly. Try Chrome or Edge on a computer'; $('gamenetFoot').classList.add('warn'); }

// sound: M, or the corner
const soundBtn = $('sound');
function setMuted(m) {
  audio.setMuted(m);
  soundBtn.classList.toggle('muted', m);
  soundBtn.setAttribute('aria-label', m ? 'Sound off (M)' : 'Sound on (M)');
  try { localStorage.setItem('candles.muted', m ? '1' : ''); } catch (e) { /* private mode */ }
}
try { if (localStorage.getItem('candles.muted')) setMuted(true); } catch (e) { /* private mode */ }
soundBtn.addEventListener('click', (e) => { e.stopPropagation(); setMuted(!audio.muted); soundBtn.blur(); });

// ---------- input ----------
const keys = new Set();
const input = { mx: 0, mz: 0, creep: false, blow: false, use: false, throw: false };
// presses (not holds) are caught on keydown so a quick tap between frames is never lost
let pressUse = false, pressThrow = false;
const padWas = [];
addEventListener('keydown', (e) => {
  if (e.code === 'KeyM' && !e.repeat) { setMuted(!audio.muted); return; }
  if (e.code === 'Escape' && how.open) { how.hide(); return; }
  if (e.code === 'Escape') {
    if (phase === 'play' && !watch) pause();
    else if (phase === 'paused') resume();
    else if (phase === 'title' || ((phase === 'caught' || phase === 'won' || phase === 'timeout') && performance.now() - endT > 600)) landing();
    return;
  }
  if (phase === 'landing') return;
  keys.add(e.code);
  if (phase === 'play') audio.start(); // resumes audio if a gamepad started the game
  if (!e.repeat && (e.code === 'KeyE' || e.code === 'Space')) pressUse = true;
  if (!e.repeat && e.code === 'KeyQ') pressThrow = true;
  if (!e.repeat && e.code === 'KeyH' && phase === 'play') $('hints').classList.toggle('off');
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (phase === 'title') begin();
  else if ((phase === 'caught' || phase === 'won' || phase === 'timeout') && !e.repeat && performance.now() - endT > 1200 && (e.code === 'KeyR' || e.code === 'Space' || e.code === 'Enter')) retry();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('wheel', (e) => { if (phase === 'play') view.zoomBy(-Math.sign(e.deltaY) * 0.12); }, { passive: true });
// leaving the tab or the window pauses a game you are playing
addEventListener('blur', () => { keys.clear(); if (!devLink) pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && !devLink) pause(); });

function readInput() {
  const k = (...c) => c.some((x) => keys.has(x));
  let mx = (k('KeyD', 'ArrowRight') ? 1 : 0) - (k('KeyA', 'ArrowLeft') ? 1 : 0);
  let mz = (k('KeyS', 'ArrowDown') ? 1 : 0) - (k('KeyW', 'ArrowUp') ? 1 : 0);
  let creep = k('ShiftLeft', 'ShiftRight'), blow = k('KeyE', 'Space');
  for (const pad of navigator.getGamepads?.() || []) {
    if (!pad) continue;
    const ax = pad.axes[0] || 0, az = pad.axes[1] || 0;
    if (Math.hypot(ax, az) > 0.2) { mx = ax; mz = az; }
    if (pad.buttons[0]?.pressed || pad.buttons[2]?.pressed) blow = true;
    const now = pad.buttons.map((b) => b.pressed), was = padWas[pad.index] || [];
    if ((now[0] && !was[0]) || (now[2] && !was[2])) pressUse = true;
    if ((now[1] && !was[1]) || (now[3] && !was[3])) pressThrow = true;
    if (now[9] && !was[9]) { if (phase === 'play') pause(); else if (phase === 'paused') resume(); else if (phase === 'title') begin(); else if (phase !== 'landing' && performance.now() - endT > 1200) retry(); }
    padWas[pad.index] = now;
    if (pad.buttons[6]?.pressed || pad.buttons[4]?.pressed) creep = true;
  }
  input.mx = mx; input.mz = mz; input.creep = creep; input.blow = blow;
  input.use = pressUse; input.throw = pressThrow; pressUse = pressThrow = false;
  return input;
}

// ---------- hud ----------
function drawCandles() {
  $('candles').innerHTML = G.candles.map((c) => `<i class="${c.lit ? 'lit' : ''}"></i>`).join('');
}
function end(kind) {
  if (phase === kind) return;
  phase = kind; endT = performance.now();
  clearTimeout(endTimer);
  endTimer = setTimeout(() => {
    $('endTitle').textContent = kind === 'won' ? 'The house is dark.' : kind === 'timeout' ? 'Time ran out.' : 'It caught you.';
    const out = G.candles.filter((c) => !c.lit).length;
    $('endSub').textContent = kind === 'won' ? `Every candle out in ${Math.round(G.t)} seconds.` : `${out} of ${G.candles.length} candles out, ${Math.round(G.t)} seconds.`;
    show('end');
  }, kind === 'won' ? 2600 : 1400);
}

// ---------- loop ----------
const DT = 1 / 60;
let lastHint = null;
let last = performance.now(), acc = 0, t = 0;
// &fps=30: draw at most this often. The model's world draws at 30 unless told (the house at 60 starves the model here),
// and so do the screens over the house (a model building on the graphics card gets it to itself)
const fpsCap = () => Number(q.get('fps')) || (modelName || phase !== 'play' ? 30 : 0);
function frame(now) {
  requestAnimationFrame(frame);
  if (fpsCap() && now - last < 1000 / fpsCap() - 4) return;
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;
  if (!manual) tick(dt);
}
window.__frame = (dt) => tick(dt);
// recording the model's world (?model=&manual=1): one model step, then one 50 ms frame drawn, so a video at 20 fps
// plays at real speed whatever the laptop manages
let landedFrame = null, blendAt = 1;
window.__dreamStep = async () => { // one model step, nothing drawn
  if (dream && phase === 'play' && G.state === 'play') {
    const landed = new Promise((r) => { landedFrame = r; });
    dream.input(kidBot ? kidBot(observeKid(G), STEP * dream.stride) : dreamIn, true);
    await Promise.race([landed, new Promise((r) => setTimeout(r, 5000))]);
  }
};
window.__dreamFrame = async () => { await window.__dreamStep(); blendAt = 1; tick(STEP * (dream?.stride || 1)); };
// smoother recordings: after a step, draw the glide to it at f (0..1] over dt seconds of the frame
window.__dreamDraw = (f, dt) => { blendAt = f; tick(dt); };
function tick(dt) {
  t += dt;
  if (phase === 'play' && ep) {
    // a recorded episode: the bots decide every step, exactly as when it was made
    acc += dt * watchSpeed;
    const stopAt = (e) => clipTo && e.rows >= clipTo;
    while (acc >= STEP && !episodeOver(ep) && !stopAt(ep)) { stepEpisode(ep); acc -= STEP; }
    if (stopAt(ep)) window.__clipDone = true;
    else if (episodeOver(ep) && G.state === 'play') end('timeout');
    readInput();
  } else if (phase === 'play' && modelName) {
    // the model's world steps on its own thread and clock; here: your input for its next step, and the glide between
    const w = view.toWorld(readInput());
    if (!kidBot) Object.assign(dreamIn, { mx: w.mx, mz: w.mz, creep: w.creep, blow: w.blow, use: dreamIn.use || w.use, throw: dreamIn.throw || w.throw });
    if (dream && !kidBot && !manual) { dream.input(dreamIn, true); dreamIn.use = dreamIn.throw = false; }
    if (dream) { dream.blend(manual ? blendAt : undefined); drawDream(); }
  } else if (phase === 'play') {
    acc += dt;
    const inp = readInput();
    const w = view.toWorld(inp);
    while (acc >= DT) { step(G, w, DT); w.use = w.throw = false; acc -= DT; }
    // a press that lands on a frame with no sim step waits for the next one
    if (w.use) pressUse = true;
    if (w.throw) pressThrow = true;
  } else { readInput(); acc = 0; if (!kidBot) dream?.input(dreamIn, false); }

  const k = G.kid, M = G.monster;
  const near = G.los(k.x, k.z, M.x, M.z);
  for (const e of G.events) {
    if (ep && !QUIET.has(e.type)) { const d = eventDetail(e); watchLog.push(`${G.t.toFixed(1)}  ${e.type}${d ? ' ' + d : ''}`); if (watchLog.length > 8) watchLog.shift(); }
    audio.event(e, G, near);
    view.event(e);
    if (e.type === 'candleOut') drawCandles();
    if (e.type === 'lunge') view.shake(0.5);
    if (e.type === 'caught') { view.shake(1.2); view.st.flash = 1; end('caught'); }
    if (e.type === 'won') end('won');
  }
  G.events.length = 0;
  if (phase === 'caught') { view.st.flash = Math.max(0, view.st.flash - dt * 3); view.st.dark = Math.min(0.85, view.st.dark + dt * 0.8); }
  if (phase === 'won') view.st.dark = Math.min(0.6, view.st.dark + dt * 0.3);
  const hint = phase === 'play' ? actionHint(G).join('   ·   ') : '';
  if (hint !== lastHint) { $('prompt').textContent = hint; lastHint = hint; }
  if (ep) drawWatch();
  audio.setRight(view.right);
  audio.update(G, dt, near);
  view.frame(G, dt, t, input);
}
requestAnimationFrame(frame);

// what the recorded episode is: the monster type, the kid bot, the monster's mood, and the replay hash
// the events worth seeing in a replay (footsteps and mode changes left out), with who and why
const QUIET = new Set(['kstep', 'mstep', 'mode', 'mood']);
function drawWatch() {
  const m = G.mind, c = ep.config, over = episodeOver(ep), b = $('badge');
  b.classList.remove('hide');
  b.textContent = [
    `${c.id}  ${c.persona.type} vs ${c.kid.style} ${c.kid.skill.toFixed(2)}  x${watchSpeed}`,
    `${m.mode}  anger ${m.anger.toFixed(2)}  frustration ${m.frustration.toFixed(2)}  t ${G.t.toFixed(1)}`,
    over ? `ended: ${G.state === 'play' ? 'timeout' : G.state}  hash ${episodeHash(ep)}` : `step ${ep.rows}   [ ] speed`,
    '',
    ...watchLog,
  ].join('\n');
}
if (watch) addEventListener('keydown', (e) => {
  if (e.code === 'BracketRight') watchSpeed = Math.min(8, watchSpeed * 2);
  if (e.code === 'BracketLeft') watchSpeed = Math.max(0.25, watchSpeed / 2);
});

// GameNet: what is running the house, and how close to real time it keeps up here (&debug: the model's numbers)
let fps = 0, fpsN = 0, fpsT = performance.now(), badgeT = 0;
function drawDream() {
  if (++fpsN, performance.now() - fpsT > 1000) { fps = fpsN * 1000 / (performance.now() - fpsT); fpsN = 0; fpsT = performance.now(); }
  if (performance.now() - badgeT < 250) return;
  badgeT = performance.now();
  const b = $('badge'), m = G.mind, speed = Math.min(100, (100 * dream.rate * dream.stride) / 20);
  b.classList.remove('hide');
  if (manual) { b.textContent = `${modelName} · the model's world, recorded at real speed`; return; }
  b.innerHTML = `<b>GAMENET</b>\na neural network is running this house\n${dream.rate ? `${speed.toFixed(0)}% of real time on this computer` : 'starting'}`;
  if (debug) b.textContent = `${modelName} · ${dream.ms.toFixed(0)} ms a step · ${dream.rate.toFixed(1)} steps/s (${20 / dream.stride} = real time) · ${fps.toFixed(0)} fps\nmonster: ${m.mode}  anger ${m.anger.toFixed(2)}  frustration ${m.frustration.toFixed(2)}${m.furyT > 0.1 ? '  FURY' : ''}`;
}

// the first screen, opening on how it works, or (a mode or a dev link) straight to the start
if (mode) choose(mode);
else { landing(); how.show(); }
if (q.has('rec')) $('hints').style.display = 'none'; // recording a clip: no hints
if (q.has('zoom')) view.setZoom(Number(q.get('zoom')));
if (q.has('reveal')) view.reveal();
if (q.has('dist')) view.setDist(Number(q.get('dist')));

// for test tools
window.__g = { get G() { return G; }, get dream() { return dream; }, get stride() { return dream?.stride || 1; }, get fps() { return fps; }, get ep() { return ep; }, L, view, input, keys, newGame, begin, get phase() { return phase; } };
