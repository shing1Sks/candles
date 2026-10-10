import './style.css';
import { parseLevel } from './sim/level.js';
import { createGame, step } from './sim/game.js';
import { createView } from './render/view.js';
import { createAudio } from './audio.js';
import { los } from './sim/grid.js';

const q = new URLSearchParams(location.search);
const L = parseLevel();
const view = createView(document.getElementById('c'), L);
const audio = createAudio();
const $ = (id) => document.getElementById(id);

let G, phase = 'title', endT = 0, seed = Number(q.get('seed')) || (Date.now() % 100000);
function newGame() {
  G = createGame(L, seed++);
  if (q.has('at')) { const [x, z] = q.get('at').split(',').map(Number); G.kid.x = x; G.kid.z = z; }
  if (q.has('mon')) { const [x, z] = q.get('mon').split(',').map(Number); G.monster.x = x; G.monster.z = z; }
  view.st.flash = 0; view.st.dark = 0;
  drawCandles();
}
newGame();
if (q.has('zoom')) view.setZoom(Number(q.get('zoom')));

// ---------- input ----------
const keys = new Set();
const input = { mx: 0, mz: 0, creep: false, blow: false };
addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (phase === 'title') begin();
  else if ((phase === 'caught' || phase === 'won') && performance.now() - endT > 1200 && (e.code === 'KeyR' || e.code === 'Space' || e.code === 'Enter')) { newGame(); begin(); }
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('wheel', (e) => view.zoomBy(-Math.sign(e.deltaY) * 0.12), { passive: true });
addEventListener('keydown', (e) => { if (e.code === 'KeyZ') view.zoomBy(view.zoom > 0.5 ? -1 : 1); });
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
    if (pad.buttons[6]?.pressed || pad.buttons[4]?.pressed) creep = true;
    if (phase !== 'play' && pad.buttons[9]?.pressed && performance.now() - endT > 1200) { if (phase !== 'title') newGame(); begin(); }
  }
  input.mx = mx; input.mz = mz; input.creep = creep; input.blow = blow;
  return input;
}

function begin() {
  audio.start();
  phase = 'play';
  $('title').classList.add('hide'); $('end').classList.add('hide');
}

// ---------- hud ----------
function drawCandles() {
  $('candles').innerHTML = G.candles.map((c) => `<i class="${c.lit ? 'lit' : ''}"></i>`).join('');
}
function end(kind) {
  phase = kind; endT = performance.now();
  setTimeout(() => {
    $('endTitle').textContent = kind === 'won' ? 'The house is dark.' : 'It caught you.';
    const out = G.candles.filter((c) => !c.lit).length;
    $('endSub').textContent = kind === 'won' ? `Every candle out in ${Math.round(G.t)} seconds.` : `${out} of ${G.candles.length} candles out, ${Math.round(G.t)} seconds.`;
    $('end').classList.remove('hide');
  }, kind === 'won' ? 2600 : 1400);
}

// ---------- loop ----------
const DT = 1 / 60;
let last = performance.now(), acc = 0, t = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now; t += dt;
  if (phase === 'play') {
    acc += dt;
    const inp = readInput();
    while (acc >= DT) { step(G, inp, DT); acc -= DT; }
  } else { readInput(); acc = 0; }

  const k = G.kid, M = G.monster;
  const near = los(L, k.x, k.z, M.x, M.z);
  for (const e of G.events) {
    audio.event(e, G, near);
    if (e.type === 'candleOut') drawCandles();
    if (e.type === 'lunge') view.shake(0.5);
    if (e.type === 'caught') { view.shake(1.2); view.st.flash = 1; end('caught'); }
    if (e.type === 'won') end('won');
  }
  G.events.length = 0;
  if (phase === 'caught') { view.st.flash = Math.max(0, view.st.flash - dt * 3); view.st.dark = Math.min(0.85, view.st.dark + dt * 0.8); }
  if (phase === 'won') view.st.dark = Math.min(0.6, view.st.dark + dt * 0.3);
  audio.update(G, dt, near);
  view.frame(G, dt, t, input);
}
requestAnimationFrame(frame);

// for test tools
window.__g = { get G() { return G; }, L, view, input, keys, newGame, begin, get phase() { return phase; } };
