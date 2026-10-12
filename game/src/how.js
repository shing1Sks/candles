// "How it works": a real bot game, the kind GameNet learned from, played live on the house's plan, and the row of
// numbers the network sees for each moment of it. Runs only while the popup is open.
import { startEpisode, stepEpisode, episodeOver, STEP } from './sim/episode.js';
import { encode, STATE_SIZE } from './sim/schema.js';
import { T } from './sim/level.js';
import { KID_STYLES } from './sim/bots/kid.js';
import { BEAM, REACH } from './sim/rules.js';

const S = 16; // px a tile
const TRAIL = 46; // steps of trail (2.3 s)

export function createHow(L, ready) {
  const $ = (id) => document.getElementById(id);
  const box = $('howModal'), map = $('howMap'), strip = $('howStrip'), cap = $('howCap');
  const dpr = Math.min(2, devicePixelRatio || 1), W = L.w * S, H = L.h * S;
  map.width = W * dpr; map.height = H * dpr; map.style.aspectRatio = `${W} / ${H}`;
  const g = map.getContext('2d'), sg = strip.getContext('2d');
  const plan = drawPlan(L, dpr);
  const row = new Float32Array(STATE_SIZE);
  let ep = null, n = 0, raf = 0, last = 0, acc = 0, endAt = 0, open = false;
  const trail = { kid: [], mon: [] };

  function next() {
    n++;
    ep = startEpisode({ id: `how:${n}`, seed: 7919 * n + 13, persona: { type: 'nightmare' }, kid: { style: KID_STYLES[n % KID_STYLES.length], skill: 0.9 }, start: n % 3 === 2 ? 'mid' : 'fresh', maxT: 90 });
    trail.kid.length = trail.mon.length = 0; endAt = 0;
  }

  function frame(now) {
    if (!open) return;
    raf = requestAnimationFrame(frame);
    acc += Math.min(0.1, (now - last) / 1000); last = now;
    if (!ep) return;
    if (endAt) { if (now - endAt > 2200) next(); }
    else while (acc >= STEP) {
      acc -= STEP;
      stepEpisode(ep); ep.G.events.length = 0;
      push(trail.kid, ep.G.kid); push(trail.mon, ep.G.monster);
      if (episodeOver(ep)) { endAt = now; break; }
    }
    if (endAt) acc = 0;
    draw();
  }
  const push = (a, o) => { a.push([o.x, o.z]); if (a.length > TRAIL) a.shift(); };

  function draw() {
    const G = ep.G, k = G.kid, M = G.monster;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.drawImage(plan, 0, 0, W, H);
    // doors: a bar along the wall when shut
    g.fillStyle = '#9a9a9a';
    for (const d of G.doors) {
      if (d.open) continue;
      for (const [x, z] of d.tiles) {
        const along = (dx, dz) => L.at(x + dx, z + dz) === T.WALL || L.doorAt(x + dx, z + dz) >= 0;
        if (along(-1, 0) && along(1, 0)) g.fillRect(x * S, z * S + S / 2 - 1.5, S, 3);
        else g.fillRect(x * S + S / 2 - 1.5, z * S, 3, S);
      }
    }
    // the giant's searchlight and hand
    if (G.beam.state !== 'idle') ring(G.beam.x, G.beam.z, BEAM.radius, G.beam.state === 'on' ? 0.16 : 0.07, '#fff');
    if (G.reach.state !== 'idle') ring(G.reach.x, G.reach.z, REACH.radius, 0.22, '#000', true);
    // candles
    for (const c of G.candles) {
      if (c.lit) {
        const r = g.createRadialGradient(c.x * S, c.z * S, 0, c.x * S, c.z * S, S * 2.2);
        r.addColorStop(0, 'rgba(255,255,255,0.35)'); r.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = r; g.fillRect(c.x * S - S * 2.2, c.z * S - S * 2.2, S * 4.4, S * 4.4);
      }
      dot(c.x, c.z, 2.6, c.lit ? '#fff' : '#3d3d3d');
    }
    // trails, then the two of them
    path(trail.mon, 'rgba(160,160,160,', 2.2); path(trail.kid, 'rgba(255,255,255,', 1.6);
    g.beginPath(); g.arc(M.x * S, M.z * S, S * 0.48, 0, 7); g.fillStyle = '#000'; g.fill();
    g.lineWidth = 2; g.strokeStyle = M.awake ? '#cfcfcf' : '#555'; g.stroke();
    dot(M.x + M.hx * 0.22, M.z + M.hz * 0.22, 2.2, M.awake ? '#fff' : '#555'); // its eye, where it looks
    if (k.hidden < 0) dot(k.x, k.z, 4, '#fff');
    // the row the network sees
    encode(G, row, 0);
    const sw = strip.clientWidth || 600, sh = strip.clientHeight || 30;
    if (strip.width !== sw * dpr) { strip.width = sw * dpr; strip.height = sh * dpr; }
    sg.setTransform(dpr, 0, 0, dpr, 0, 0); sg.fillStyle = '#000'; sg.fillRect(0, 0, sw, sh);
    const cw = sw / STATE_SIZE;
    for (let i = 0; i < STATE_SIZE; i++) {
      const v = Math.round(18 + 237 * (0.5 + 0.5 * Math.tanh(row[i] * 1.5)));
      sg.fillStyle = `rgb(${v},${v},${v})`; sg.fillRect(i * cw, 0, Math.max(1, cw - 0.4), sh);
    }
    const out = G.candles.filter((c) => !c.lit).length, t = (G.t - ep.t0).toFixed(1);
    cap.textContent = endAt
      ? (G.state === 'caught' ? `caught after ${t} s · ${out} of 6 candles out` : G.state === 'won' ? `the kid won in ${t} s` : `${t} s, nobody won`)
      : `${ep.config.kid.style} kid bot vs the monster · ${t} s · ${out} of 6 candles out`;
  }
  const dot = (x, z, r, c) => { g.beginPath(); g.arc(x * S, z * S, r, 0, 7); g.fillStyle = c; g.fill(); };
  function ring(x, z, r, a, c, fill) { g.globalAlpha = a; g.beginPath(); g.arc(x * S, z * S, r * S, 0, 7); g.fillStyle = fill ? c : '#fff'; g.fill(); g.globalAlpha = 1; }
  function path(a, rgba, w) {
    g.lineWidth = w; g.lineCap = 'round';
    for (let i = 1; i < a.length; i++) {
      if (Math.hypot(a[i][0] - a[i - 1][0], a[i][1] - a[i - 1][1]) > 1) continue;
      g.strokeStyle = `${rgba}${(0.5 * i) / a.length})`;
      g.beginPath(); g.moveTo(a[i - 1][0] * S, a[i - 1][1] * S); g.lineTo(a[i][0] * S, a[i][1] * S); g.stroke();
    }
  }

  return {
    get open() { return open; },
    show() {
      if (open) return;
      open = true; box.classList.remove('hide');
      Promise.resolve(ready()).then(() => { if (!ep) next(); last = performance.now(); raf = requestAnimationFrame(frame); });
    },
    hide() { open = false; cancelAnimationFrame(raf); box.classList.add('hide'); },
  };
}

// the house from above, drawn once: floor, walls, furniture, the crawl spaces
function drawPlan(L, dpr) {
  const c = document.createElement('canvas');
  c.width = L.w * S * dpr; c.height = L.h * S * dpr;
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  g.fillStyle = '#070707'; g.fillRect(0, 0, L.w * S, L.h * S);
  for (let z = 0; z < L.h; z++) for (let x = 0; x < L.w; x++) {
    const t = L.at(x, z), X = x * S, Z = z * S;
    if (t === T.WALL) { g.fillStyle = '#2c2c2c'; g.fillRect(X, Z, S, S); }
    else if (t === T.LOW || t === T.TALL) { g.fillStyle = t === T.TALL ? '#202020' : '#171717'; g.fillRect(X + 1, Z + 1, S - 2, S - 2); }
    else if (t === T.DUCT || t === T.CRACK) {
      g.fillStyle = '#121212'; g.fillRect(X, Z, S, S);
      g.fillStyle = '#4a4a4a';
      for (let i = 2; i < S; i += 5) g.fillRect(L.at(x - 1, z) === t || L.at(x + 1, z) === t ? X + i : X + S / 2 - 1, L.at(x - 1, z) === t || L.at(x + 1, z) === t ? Z + S / 2 - 1 : Z + i, 2, 2);
    } else if (t === T.TABLE || t === T.BED) {
      g.strokeStyle = '#3a3a3a'; g.lineWidth = 1; g.strokeRect(X + 0.5, Z + 0.5, S - 1, S - 1);
    } else if (L.room[z * L.w + x] >= 0) { g.fillStyle = '#0c0c0c'; g.fillRect(X, Z, S, S); }
  }
  return c;
}
