// The film's drawn parts, rendered one frame at a time by tools/film/record.py (1920 x 1080):
//   grid:  bot games multiplying (8 across, 16, 32, 64) with a count running up to forty thousand
//   rules: the house's plan with the real code of each mechanic; one by one the code dissolves into weights and the
//          plan's part is drawn as the network's guess
//   head:  the title card
//   card:  the end card
// window.__film.start(name) then window.__film.frame(dt) per frame.
import { parseLevel, T } from '../../src/sim/level.js';
import { configFor, startEpisode, stepEpisode, episodeOver, STEP } from '../../src/sim/episode.js';
import { setNightmarePolicy, mlpPolicy } from '../../src/sim/mind/nightmare.js';
import { MON, VENT } from '../../src/sim/rules.js';
import gridSrc from '../../src/sim/grid.js?raw';
import gameSrc from '../../src/sim/game.js?raw';
import bodySrc from '../../src/sim/body.js?raw';
import sensesSrc from '../../src/sim/senses.js?raw';

const W = 1920, H = 1080;
const cv = document.getElementById('c'), g = cv.getContext('2d');
cv.width = W; cv.height = H;
const L = parseLevel();
const SERIF = 'Georgia, "Times New Roman", serif', SANS = 'system-ui, "Segoe UI", sans-serif', MONO = 'Consolas, "Cascadia Mono", monospace';
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const hash = (a, b, c) => { let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// a function's lines from a source file, from its first line through n lines
function snippet(src, start, n) {
  const lines = src.split('\n'), i = lines.findIndex((l) => l.includes(start));
  return lines.slice(i, i + n).map((l) => l.replace(/\r$/, '').replace(/^ {0,2}/, '').slice(0, 60));
}
const MECHANICS = [
  { name: 'Walls', file: 'src/sim/grid.js', code: snippet(gridSrc, 'export function resolve', 12), part: 'walls' },
  { name: 'Doors', file: 'src/sim/game.js', code: [...snippet(gameSrc, 'function inDoorway', 3), '', ...snippet(gameSrc, 'export function setDoor', 5)], part: 'doors' },
  { name: 'Candles', file: 'src/sim/game.js', code: snippet(gameSrc, 'const c = input.blow ? nearCandle', 12), part: 'candles' },
  { name: 'Sight', file: 'src/sim/senses.js', code: snippet(sensesSrc, 'export function canSee', 12), part: 'sight' },
  { name: "The monster's body", file: 'src/sim/body.js', code: snippet(bodySrc, 'function move(G, M, wantX', 12), part: 'body' },
  { name: 'The catch', file: 'src/sim/game.js', code: snippet(gameSrc, 'function checkCatch', 12), part: 'catch' },
];

// ---------- the plan of the house, at any scale ----------
function plan(S, { walls = true, wall = '#2e2e2e' } = {}) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(L.w * S); c.height = Math.ceil(L.h * S);
  const p = c.getContext('2d');
  p.fillStyle = '#070707'; p.fillRect(0, 0, c.width, c.height);
  for (let z = 0; z < L.h; z++) for (let x = 0; x < L.w; x++) {
    const t = L.at(x, z), X = x * S, Z = z * S;
    if (t === T.WALL) { if (walls) { p.fillStyle = wall; p.fillRect(X, Z, S + 0.5, S + 0.5); } }
    else if (t === T.LOW || t === T.TALL) { p.fillStyle = t === T.TALL ? '#1e1e1e' : '#161616'; p.fillRect(X + S * 0.06, Z + S * 0.06, S * 0.88, S * 0.88); }
    else if (t === T.DUCT || t === T.CRACK) { p.fillStyle = '#131313'; p.fillRect(X, Z, S, S); p.fillStyle = '#4a4a4a'; p.fillRect(X + S * 0.42, Z + S * 0.42, S * 0.16, S * 0.16); }
    else if (t === T.TABLE || t === T.BED) { p.strokeStyle = '#363636'; p.lineWidth = Math.max(0.5, S / 16); p.strokeRect(X + 0.5, Z + 0.5, S - 1, S - 1); }
    else if (L.room[z * L.w + x] >= 0) { p.fillStyle = '#0c0c0c'; p.fillRect(X, Z, S, S); }
  }
  return c;
}

// ---------- games ----------
let policyReady = null;
const loadPolicy = () => (policyReady ||= fetch('/nightmare.json').then((r) => r.json()).then((w) => setNightmarePolicy(mlpPolicy(w))));
function newGame(id, gen) {
  const config = configFor(`film-grid-${gen}`, id);
  if (hash(id, gen, 7) < 0.8) config.persona = { type: 'nightmare' };
  const ep = startEpisode(config);
  const pre = Math.floor(hash(id, gen, 3) * 60);
  for (let i = 0; i < pre && !episodeOver(ep); i++) { stepEpisode(ep); ep.G.events.length = 0; }
  return ep;
}

// ---------- the grid: games multiplying ----------
const STAGES = [{ cols: 8, at: 0 }, { cols: 16, at: 1.9 }, { cols: 32, at: 3.8 }, { cols: 64, at: 5.7 }];
const GRID_T = 8.2;
function gridSeg() {
  const games = [], gens = [], plans = {};
  let t = 0, acc = 0;
  const rowsFor = (cols) => Math.ceil(H / (W / cols / (L.w / L.h)));
  return (dt) => {
    t += dt; acc += dt * 1.6;
    let si = 0; while (si + 1 < STAGES.length && t >= STAGES[si + 1].at) si++;
    const st = STAGES[si], cols = st.cols, rows = rowsFor(cols), n = cols * rows;
    const tw = W / cols, th = tw / (L.w / L.h);
    plans[cols] ||= plan(tw / L.w, { wall: '#5a5a5a' });
    // zoom out into the new stage
    const z = si ? 1 + (STAGES[si].cols / STAGES[si - 1].cols - 1) * (1 - ease((t - st.at) / 0.7)) : 1 + 0.15 * (1 - ease(t / 1.2));
    const steps = Math.floor(acc / STEP); acc -= steps * STEP;
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    for (let k = 0; k < n; k++) {
      if (!games[k]) { gens[k] = 0; games[k] = newGame(k, 0); }
      for (let s = 0; s < steps; s++) { if (episodeOver(games[k])) { gens[k]++; games[k] = newGame(k, gens[k]); } stepEpisode(games[k]); games[k].G.events.length = 0; }
      const cx = k % cols, cz = Math.floor(k / cols);
      const x = W / 2 + (cx * tw - W / 2) * z, y = H / 2 + (cz * th - H / 2) * z, w = tw * z, h = th * z;
      if (x > W || y > H || x + w < 0 || y + h < 0) continue;
      const gap = Math.max(1, w * 0.03);
      g.drawImage(plans[cols], x + gap, y + gap, w - 2 * gap, h - 2 * gap);
      const G = games[k].G, sx = (w - 2 * gap) / L.w, ox = x + gap, oy = y + gap, r = Math.max(1.6, sx * 0.62);
      for (const c of G.candles) if (c.lit) { g.fillStyle = 'rgba(255,255,255,0.13)'; g.fillRect(ox + c.x * sx - sx * 1.6, oy + c.z * sx - sx * 1.6, sx * 3.2, sx * 3.2); dot(ox + c.x * sx, oy + c.z * sx, Math.max(1, sx * 0.32), '#fff'); }
      dot(ox + G.monster.x * sx, oy + G.monster.z * sx, r * 1.3, G.monster.awake ? '#b8b8b8' : '#5a5a5a');
      dot(ox + G.kid.x * sx, oy + G.kid.z * sx, r, '#fff');
    }
    // the count
    const shown = si < STAGES.length - 1 ? n : Math.round(n + (40000 - n) * ease((t - st.at - 0.5) / (GRID_T - st.at - 1.0)));
    const a = Math.min(1, t / 0.4);
    g.fillStyle = `rgba(0,0,0,${0.62 * a})`; g.fillRect(W / 2 - 330, H - 210, 660, 150);
    g.globalAlpha = a; g.textAlign = 'center'; g.fillStyle = '#f2f2f2';
    g.font = `84px ${SERIF}`; g.fillText(shown.toLocaleString('en-US'), W / 2, H - 112);
    g.font = `600 18px ${SANS}`; g.fillStyle = '#9a9a9a';
    g.fillText(spaced(si < 2 ? 'bots playing the real game' : 'games played'), W / 2, H - 76);
    g.globalAlpha = 1;
    return t < GRID_T;
  };
}
const dot = (x, y, r, c) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = c; g.fill(); };
const spaced = (s) => s.toUpperCase().split('').join(' ');

// ---------- the rules, replaced ----------
const S = 30, MX = 96, MY = 232, MW = L.w * S, MH = L.h * S; // the plan on screen
const PX = MX + MW + 70, PY = MY, PW = W - PX - 90, PH = MH; // the code panel
const EACH = 2.0, FIRST = 1.0, RULES_T = FIRST + MECHANICS.length * EACH + 3.2;
function rulesSeg() {
  const base = plan(S, { walls: false });
  const ep = startEpisode({ ...configFor('film', 139), persona: { type: 'nightmare' } });
  for (let i = 0; i < 700; i++) { stepEpisode(ep); ep.G.events.length = 0; } // a game already under way
  let t = 0, acc = 0, frameN = 0;
  return (dt) => {
    t += dt; acc += dt; frameN++;
    while (acc >= STEP) { acc -= STEP; if (!episodeOver(ep)) { stepEpisode(ep); ep.G.events.length = 0; } }
    const G = ep.G, flick = Math.floor(frameN / 3);
    const cur = Math.min(MECHANICS.length - 1, Math.max(0, Math.floor((t - FIRST) / EACH)));
    const local = t - FIRST - cur * EACH;
    // how far each mechanic is replaced: 0 code, 1 learned
    const done = MECHANICS.map((_, i) => ease((t - FIRST - i * EACH - 1.25) / 0.7));
    const lit = MECHANICS.map((_, i) => (t >= FIRST && i === cur && local < EACH ? 1 - ease((local - 1.6) / 0.5) : 0)); // highlighted now
    const net = (i) => done[i] > 0.5;

    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    // the plan
    g.drawImage(base, MX, MY);
    // walls
    for (let z = 0; z < L.h; z++) for (let x = 0; x < L.w; x++) if (L.at(x, z) === T.WALL) {
      if (net(0)) cells(MX + x * S, MY + z * S, S, 3, x, z, flick, 26, 70 + 60 * lit[0]);
      else { g.fillStyle = shade(46 + 120 * lit[0]); g.fillRect(MX + x * S, MY + z * S, S + 0.5, S + 0.5); }
    }
    // doors
    for (const d of G.doors) {
      if (d.open) continue;
      for (const [x, z] of d.tiles) {
        const along = (dx, dz) => L.at(x + dx, z + dz) === T.WALL || L.doorAt(x + dx, z + dz) >= 0;
        const hz = along(-1, 0) && along(1, 0), X = MX + x * S, Z = MY + z * S;
        if (net(1)) cells(hz ? X : X + S / 2 - 3, hz ? Z + S / 2 - 3 : Z, hz ? S : 6, 2, x, z, flick, 90, 200, hz ? [S, 6] : [6, S]);
        else { g.fillStyle = shade(150 + 105 * lit[1]); hz ? g.fillRect(X, Z + S / 2 - 2, S, 4) : g.fillRect(X + S / 2 - 2, Z, 4, S); }
      }
    }
    // sight: what the monster can see, around it
    const M = G.monster, k = G.kid;
    if (lit[3] > 0 || net(3)) {
      const r = MON.sightDark * S, a = net(3) ? 0.5 : lit[3];
      if (net(3)) ringCells(MX + M.x * S, MY + M.z * S, r, 64, flick, 0.18 * a, 3);
      else { g.globalAlpha = 0.1 * a; g.beginPath(); g.arc(MX + M.x * S, MY + M.z * S, r, Math.atan2(M.hz, M.hx) - Math.PI / 2, Math.atan2(M.hz, M.hx) + Math.PI / 2); g.lineTo(MX + M.x * S, MY + M.z * S); g.fillStyle = '#fff'; g.fill(); g.globalAlpha = 1; }
    }
    // candles
    for (const c of G.candles) {
      const X = MX + c.x * S, Z = MY + c.z * S;
      if (c.lit) { const gr = g.createRadialGradient(X, Z, 0, X, Z, S * 2.4); gr.addColorStop(0, `rgba(255,255,255,${0.3 + 0.25 * lit[2]})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(X - S * 2.4, Z - S * 2.4, S * 4.8, S * 4.8); }
      if (net(2)) cells(X - 6, Z - 6, 12, 3, c.x, c.z, flick, c.lit ? 160 : 40, c.lit ? 255 : 80);
      else dot(X, Z, 4.5 + 2 * lit[2], c.lit ? '#fff' : '#3d3d3d');
    }
    // the catch: its reach
    if (lit[5] > 0 || net(5)) {
      const r = VENT.reachIn * S;
      if (net(5)) ringCells(MX + M.x * S, MY + M.z * S, r, 28, flick, 0.8, 4);
      else { g.strokeStyle = `rgba(255,255,255,${0.7 * lit[5]})`; g.lineWidth = 2; g.setLineDash([5, 5]); g.beginPath(); g.arc(MX + M.x * S, MY + M.z * S, r, 0, 7); g.stroke(); g.setLineDash([]); }
    }
    // the monster's body, then the kid
    if (net(4)) discCells(MX + M.x * S, MY + M.z * S, S * 0.5, flick);
    else { g.beginPath(); g.arc(MX + M.x * S, MY + M.z * S, S * 0.5, 0, 7); g.fillStyle = '#000'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = shade(200 + 55 * lit[4]); g.stroke(); if (lit[4]) { g.lineWidth = 1; g.strokeStyle = `rgba(255,255,255,${0.5 * lit[4]})`; g.beginPath(); g.arc(MX + M.x * S, MY + M.z * S, S * 0.9, 0, 7); g.stroke(); } }
    dot(MX + M.x * S + M.hx * S * 0.22, MY + M.z * S + M.hz * S * 0.22, 2.6, '#fff');
    if (k.hidden < 0) dot(MX + k.x * S, MY + k.z * S, 6, '#fff');

    // the code panel
    const m = MECHANICS[cur];
    g.textAlign = 'left';
    g.font = `600 15px ${SANS}`; g.fillStyle = '#8a8a8a';
    const all = t - (FIRST + MECHANICS.length * EACH);
    if (all > 0) {
      // every rule gone: what is left is the network, a field of weights
      const a = ease(all / 0.6);
      g.globalAlpha = a; g.fillText(spaced('The network'), PX, PY + 6);
      g.font = `14px ${MONO}`; g.fillStyle = '#9a9a9a'; g.fillText('25,000,000 weights', PX, PY + 32);
      for (let li = 0; li < 12; li++) for (let ci = 0; ci < 62; ci++) {
        const v = 30 + 215 * hash(li * 131 + ci, 99, Math.floor(frameN / 2)) * ease((all - (ci + li * 3) * 0.004) / 0.3);
        g.fillStyle = shade(v); g.fillRect(PX + ci * 8.8, PY + 78 + li * 27 - 13, 7.6, 16);
      }
      g.globalAlpha = 1;
      g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 1; g.strokeRect(PX - 18.5, PY + 46.5, PW + 18, 27 * 12 + 30);
    } else if (t >= FIRST) {
      g.fillText(spaced(m.name), PX, PY + 6);
      const learned = done[cur];
      g.font = `14px ${MONO}`; g.fillStyle = shade(110 - 50 * learned); g.fillText(m.file, PX, PY + 32);
      if (learned > 0) { g.fillStyle = '#ddd'; g.font = `600 13px ${SANS}`; g.globalAlpha = learned; g.fillText(spaced('learned'), PX + PW - 110, PY + 6); g.globalAlpha = 1; }
      // the code types in, then each character becomes a weight
      g.font = `16px ${MONO}`;
      const typed = ease(local / 0.55), dis = local - 1.2;
      m.code.forEach((line, li) => {
        const y = PY + 78 + li * 27, nChars = Math.floor(line.length * typed);
        for (let ci = 0; ci < nChars; ci++) {
          const ch = line[ci], x = PX + ci * 8.8, when = dis - ci * 0.006 - li * 0.035;
          if (when > 0) { if (ch !== ' ') { const v = 40 + 200 * hash(li * 131 + ci, cur, flick); g.fillStyle = shade(Math.min(255, v + 120 * (1 - ease(when / 0.25)))); g.fillRect(x, y - 13, 7.6, 16); } }
          else { g.fillStyle = '#c8c8c8'; g.fillText(ch, x, y); }
        }
      });
      // the panel's frame
      g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 1; g.strokeRect(PX - 18.5, PY + 46.5, PW + 18, 27 * 12 + 30);
    }
    // the count of rules left
    const linesLeft = Math.round(1061 * (1 - done.reduce((a, b) => a + b, 0) / MECHANICS.length));
    g.font = `600 13px ${SANS}`; g.fillStyle = '#6a6a6a'; g.textAlign = 'left';
    g.fillText(spaced(`rules left: ${linesLeft.toLocaleString('en-US')} lines`), PX, PY + 27 * 12 + 110);
    g.fillStyle = '#1a1a1a'; g.fillRect(PX, PY + 27 * 12 + 124, PW, 3);
    g.fillStyle = '#d0d0d0'; g.fillRect(PX, PY + 27 * 12 + 124, PW * (linesLeft / 1061), 3);

    // titles
    const end = ease((t - (FIRST + MECHANICS.length * EACH + 0.2)) / 0.8);
    g.textAlign = 'left'; g.font = `600 15px ${SANS}`; g.fillStyle = '#9a9a9a';
    g.fillText(spaced(end > 0.5 ? 'GameNet' : 'Candles, the rules'), MX, 120);
    g.font = `46px ${SERIF}`; g.fillStyle = '#ededed';
    g.globalAlpha = 1 - end; g.fillText('Every mechanic is code.', MX, 172);
    g.globalAlpha = end; g.fillText('No rules left. Just a network.', MX, 172);
    g.globalAlpha = 1;
    return t < RULES_T;
  };
}
const shade = (v) => { v = Math.max(0, Math.min(255, Math.round(v))); return `rgb(${v},${v},${v})`; };
// a rectangle drawn as a grid of noisy cells (the network's guess of it)
function cells(x, y, size, n, a, b, f, lo, hi, wh) {
  const [w, h] = wh || [size, size], cw = w / n, ch = h / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    g.fillStyle = shade(lo + (hi - lo) * hash(a * 97 + i, b * 89 + j, f));
    g.fillRect(x + i * cw + 0.5, y + j * ch + 0.5, cw - 1, ch - 1);
  }
}
function ringCells(cx, cy, r, n, f, alpha, size) {
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, v = hash(i, n, f); g.fillStyle = `rgba(255,255,255,${alpha * (0.4 + 0.6 * v)})`; g.fillRect(cx + Math.cos(a) * r - size / 2, cy + Math.sin(a) * r - size / 2, size, size); }
}
function discCells(cx, cy, r, f) {
  for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) { if (i * i + j * j > 10) continue; g.fillStyle = shade(90 + 150 * hash(i + 9, j + 9, f)); g.fillRect(cx + (i * r) / 3 - r / 7, cy + (j * r) / 3 - r / 7, (r / 3.5) * 1.6, (r / 3.5) * 1.6); }
}

// ---------- the head card ----------
const HEAD_T = 3.0;
function headSeg() {
  let t = 0;
  return (dt) => {
    t += dt;
    const out = 1 - ease((t - HEAD_T + 0.5) / 0.5), at = (s) => ease((t - s) / 0.7) * out;
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.textAlign = 'center';
    g.globalAlpha = at(0); g.fillStyle = '#f0f0f0'; g.font = `150px ${SERIF}`; g.fillText('GameNet', W / 2, H / 2 - 30);
    g.globalAlpha = at(0.4); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(W / 2 - 40, H / 2 + 18, 80, 1);
    g.globalAlpha = at(0.5); g.fillStyle = '#c8c8c8'; g.font = `38px ${SERIF}`; g.fillText('a 100% neural network game', W / 2, H / 2 + 90);
    g.globalAlpha = at(0.9); g.fillStyle = '#8a8a8a'; g.font = `600 21px ${SANS}`; g.fillText(spaced('0 coded mechanics'), W / 2, H / 2 + 150);
    g.globalAlpha = 1;
    return t < HEAD_T;
  };
}

// ---------- the end card ----------
const CARD_T = 4.6;
function cardSeg() {
  let t = 0;
  return (dt) => {
    t += dt;
    const a = ease(t / 0.9) * (1 - ease((t - CARD_T + 0.8) / 0.8));
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.globalAlpha = a; g.textAlign = 'center';
    const gr = g.createRadialGradient(W / 2, H / 2 - 210, 0, W / 2, H / 2 - 210, 60); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(W / 2 - 60, H / 2 - 270, 120, 120);
    g.fillStyle = '#ececec'; g.font = `128px ${SERIF}`; g.fillText('Candles', W / 2, H / 2 - 30);
    g.fillStyle = '#a8a8a8'; g.font = `30px ${SERIF}`; g.fillText('a game with no rules, only a network', W / 2, H / 2 + 34);
    g.fillStyle = '#d8d8d8'; g.font = `600 22px ${SANS}`; g.fillText(spaced('candles.shing.in'), W / 2, H / 2 + 130);
    g.fillStyle = '#555'; g.font = `15px ${SANS}`;
    g.fillText('Music: Kevin MacLeod (incompetech.com), licensed under CC BY 4.0', W / 2, H - 70);
    g.globalAlpha = 1;
    return t < CARD_T;
  };
}

let seg = null;
window.__film = {
  ready: loadPolicy(),
  start(name) { seg = { head: headSeg, grid: gridSeg, rules: rulesSeg, card: cardSeg }[name](); },
  frame(dt) { return seg(dt); },
};
