import './style.css';
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

// The monster: ?persona= (stalker, brute, hound, warden, pathfinder, classic, nightmare). The nightmare is the learned
// monster (train/rl), and the one the v4 models (?model=v4_...) were trained against, so theirs unless asked;
// its weights load in a moment (until then it simply chases)
const PERSONA = new URLSearchParams(location.search).get('persona') || (/^v[45]/.test(new URLSearchParams(location.search).get('model') || '') ? 'nightmare' : 'classic');
if (PERSONA === 'nightmare') fetch('/nightmare.json').then((r) => r.json()).then((w) => setNightmarePolicy(mlpPolicy(w)));

const q = new URLSearchParams(location.search);
// &manual=1 (recording clips): the page only moves when the recorder calls window.__frame(dt), one exact frame at a time
const manual = q.has('manual');
const L = parseLevel();
const view = createView(document.getElementById('c'), L);
const audio = createAudio();
const $ = (id) => document.getElementById(id);

let G, phase = 'title', endT = 0, endTimer = 0, seed = Number(q.get('seed')) || (Date.now() % 100000);
// ?watch=batch:i plays a recorded episode (its bots drive both sides) instead of your controller.
// &from=ROW starts at that step (run silently up to it), &to=ROW stops there, &rec=1 starts at once (for recording)
const watch = q.get('watch'), clipFrom = Number(q.get('from')) || 0, clipTo = Number(q.get('to')) || 0;
let ep = null, watchSpeed = Number(q.get('speed')) || 1;
let dream = null; // ?model=: the main model runs the world (below)
let kidBot = null;
const dreamIn = { mx: 0, mz: 0, creep: false, blow: false, use: false, throw: false }; // your latest input, for its next step
const watchLog = [];
function newGame() {
  if (watch) {
    const [batch, i] = watch.split(':');
    const config = configFor(batch, Number(i), { keys: Number(q.get('keys') || 0) }); // &keys=: as the batch was made
    if (q.has('persona')) config.persona = { type: q.get('persona') }; // watch a chosen monster type
    ep = startEpisode(config);
    G = ep.G;
    while (ep.rows < clipFrom && !episodeOver(ep)) { stepEpisode(ep); G.events.length = 0; }
    watchLog.length = 0;
  } else {
    G = createGame(L, seed++);
    G.mind = createMind(G, { type: PERSONA });
  }
  if (q.has('at')) { const [x, z] = q.get('at').split(',').map(Number); G.kid.x = x; G.kid.z = z; }
  if (q.has('mon')) { const [x, z] = q.get('mon').split(',').map(Number); G.monster.x = x; G.monster.z = z; }
  view.st.flash = 0; view.st.dark = 0;
  clearTimeout(endTimer);
  $('end').classList.add('hide');
  view.reset?.(G);
  dream?.reset(G);
  Object.assign(dreamIn, { mx: 0, mz: 0, creep: false, blow: false, use: false, throw: false });
  // &bot=sneaker (or sprinter, hider, trickster, greedy): a kid bot plays in the model's world instead of you
  if (q.has('model') && q.has('bot')) { kidBot = createKidBot(G, { style: q.get('bot'), skill: Number(q.get('skill') || 0.8) }, rng(seed)); dream?.input(dreamIn, true); }
  drawCandles();
}
newGame();
// ?model=play_M: the main model plays the whole game (src/model/dream.js); &ep=wasm to run it on the CPU
if (q.has('model')) {
  $('prompt').textContent = 'loading the model...';
  // a kid bot decides once per model step, on the row that just landed
  const onStep = (g) => {
    if (manual) { landedFrame?.(); landedFrame = null; return; } // recording: __dreamFrame paces every step
    if (kidBot) dream.input(kidBot(observeKid(g), STEP * dream.stride), phase === 'play');
  };
  createDream(q.get('model'), G, { ep: q.get('ep') || 'webgpu', temp: Number(q.get('temp') || 1), mix: Number(q.get('mix') ?? 0.3), topP: Number(q.get('top_p') ?? 0.9),
    // the defaults are the ones that played best (the rollout exam, .work/day.md): your kid exact (&kid=), the monster's
    // mind drawn (&mind=), the rest at &mix; &game= draws the game's state (play, won, caught) at that mix
    mixFor: { ...Object.fromEntries(['mind', 'belief', 'pending', 'sense'].map((k) => [k, Number(q.get('mind') ?? 1)])), kid: Number(q.get('kid') ?? 0),
      ...(q.has('game') ? { game: Number(q.get('game')) } : {}) }, int8: q.has('int8'), snap: q.get('snap') !== '0', peak: q.get('peak') !== '0', walls: q.get('walls') !== '0', lockstep: q.has('bot') || manual, onStep,
    // &brain=1: the monster's brain plays the monster (src/model/brain.js) and the model is the world; on for the v5 models
    brain: q.has('brain') ? q.get('brain') !== '0' : (q.get('model') || '').startsWith('v5') })
    .then((d) => { dream = d; $('prompt').textContent = ''; if (kidBot && !manual) d.input(dreamIn, true); }, (e) => { $('prompt').textContent = `model failed: ${e.message}`; console.error(e); });
}
if (q.has('rec')) { $('hints').style.display = 'none'; begin(); } // recording a clip: no title, no hints
if (q.has('zoom')) view.setZoom(Number(q.get('zoom')));
if (q.has('reveal')) view.reveal();
if (q.has('dist')) view.setDist(Number(q.get('dist')));

// ---------- input ----------
const keys = new Set();
const input = { mx: 0, mz: 0, creep: false, blow: false, use: false, throw: false };
// presses (not holds) are caught on keydown so a quick tap between frames is never lost
let pressUse = false, pressThrow = false;
const padWas = [];
addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (phase !== 'title') audio.start(); // resumes audio if a gamepad started the game
  if (!e.repeat && (e.code === 'KeyE' || e.code === 'Space')) pressUse = true;
  if (!e.repeat && e.code === 'KeyQ') pressThrow = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (phase === 'title') begin();
  else if ((phase === 'caught' || phase === 'won') && !e.repeat && performance.now() - endT > 1200 && (e.code === 'KeyR' || e.code === 'Space' || e.code === 'Enter')) { newGame(); begin(); }
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('wheel', (e) => view.zoomBy(-Math.sign(e.deltaY) * 0.12), { passive: true });
addEventListener('pointerdown', () => { if (phase === 'title') begin(); });
addEventListener('blur', () => keys.clear());

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
    padWas[pad.index] = now;
    if (pad.buttons[6]?.pressed || pad.buttons[4]?.pressed) creep = true;
    if (phase !== 'play' && pad.buttons[9]?.pressed && performance.now() - endT > 1200) { if (phase !== 'title') newGame(); begin(); }
  }
  input.mx = mx; input.mz = mz; input.creep = creep; input.blow = blow;
  input.use = pressUse; input.throw = pressThrow; pressUse = pressThrow = false;
  return input;
}

function begin() {
  audio.start();
  phase = 'play';
  view.intro();
  $('title').classList.add('hide'); $('end').classList.add('hide');
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
    $('end').classList.remove('hide');
  }, kind === 'won' ? 2600 : 1400);
}

// ---------- loop ----------
const DT = 1 / 60;
let lastHint = null;
let last = performance.now(), acc = 0, t = 0;
// &fps=30: draw at most this often; the model's world draws at 30 unless told (the house at 60 starves the model here)
const fpsCap = Number(q.get('fps')) || (q.has('model') ? 30 : 0);
function frame(now) {
  requestAnimationFrame(frame);
  if (fpsCap && now - last < 1000 / fpsCap - 4) return;
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;
  if (!manual) tick(dt);
}
window.__frame = (dt) => tick(dt);
// recording the model's world (?model=&manual=1): one model step, then one 50 ms frame drawn, so a video at 20 fps
// plays at real speed whatever the laptop manages
let landedFrame = null;
window.__dreamFrame = async () => {
  if (dream && phase === 'play' && G.state === 'play') {
    const landed = new Promise((r) => { landedFrame = r; });
    dream.input(kidBot ? kidBot(observeKid(G), STEP * dream.stride) : dreamIn, true);
    await Promise.race([landed, new Promise((r) => setTimeout(r, 5000))]);
  }
  tick(STEP * (dream?.stride || 1));
};
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
  } else if (phase === 'play' && q.has('model')) {
    // the model's world steps on its own thread and clock; here: your input for its next step, and the glide between
    const w = view.toWorld(readInput());
    if (!kidBot) Object.assign(dreamIn, { mx: w.mx, mz: w.mz, creep: w.creep, blow: w.blow, use: dreamIn.use || w.use, throw: dreamIn.throw || w.throw });
    if (dream && !kidBot && !manual) { dream.input(dreamIn, true); dreamIn.use = dreamIn.throw = false; }
    if (dream) { dream.blend(manual ? 1 : undefined); drawDream(); }
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
let watchEl = null;
function drawWatch() {
  if (!watchEl) {
    watchEl = document.createElement('div');
    watchEl.style.cssText = 'position:fixed;right:14px;top:12px;font:15px/1.5 monospace;color:#ccc;text-align:right;white-space:pre;pointer-events:none;text-shadow:0 0 4px #000';
    document.body.appendChild(watchEl);
  }
  const m = G.mind, c = ep.config, over = episodeOver(ep);
  watchEl.textContent = [
    `${c.id}  ${c.persona.type} vs ${c.kid.style} ${c.kid.skill.toFixed(2)}  x${watchSpeed}`,
    `${m.mode}  anger ${m.anger.toFixed(2)}  frustration ${m.frustration.toFixed(2)}  t ${G.t.toFixed(1)}`,
    over ? `ended: ${G.state === 'play' ? 'timeout' : G.state}  hash ${episodeHash(ep)}` : `step ${ep.rows}   [ ] speed`,
    '',
    ...watchLog,
  ].join(String.fromCharCode(10));
}
if (watch) addEventListener('keydown', (e) => {
  if (e.code === 'BracketRight') watchSpeed = Math.min(8, watchSpeed * 2);
  if (e.code === 'BracketLeft') watchSpeed = Math.max(0.25, watchSpeed / 2);
});

// ?model=: which model, how fast it runs here
let dreamEl = null;
let fps = 0, fpsN = 0, fpsT = performance.now();
function drawDream() {
  if (++fpsN, performance.now() - fpsT > 1000) { fps = fpsN * 1000 / (performance.now() - fpsT); fpsN = 0; fpsT = performance.now(); }
  if (!dreamEl) {
    dreamEl = document.createElement('div');
    dreamEl.style.cssText = 'position:fixed;right:14px;top:12px;font:13px/1.4 monospace;color:#888;text-align:right;white-space:pre;pointer-events:none';
    document.body.appendChild(dreamEl);
  }
  const m = G.mind; // the monster's mind, as the model has it
  dreamEl.textContent = (manual ? `${q.get('model')} · the model's world, recorded at real speed` : `${q.get('model')} · ${dream.ms.toFixed(0)} ms a step · ${dream.rate.toFixed(1)} steps/s (20 = real time) · ${fps.toFixed(0)} fps`)
    + `
monster: ${m.mode}  anger ${m.anger.toFixed(2)}  frustration ${m.frustration.toFixed(2)}${m.furyT > 0.1 ? '  FURY' : ''}`;
}

// for test tools
window.__g = { get G() { return G; }, get dream() { return dream; }, get stride() { return dream?.stride || 1; }, get fps() { return fps; }, get ep() { return ep; }, L, view, input, keys, newGame, begin, get phase() { return phase; } };
