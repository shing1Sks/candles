// Procedural PBR textures, painted on canvases at boot: albedo, a height field turned into a normal
// map, and roughness. Everything tiles. The shapes are storybook (fish-scale slates, fat cobbles,
// crooked bricks), the surfaces are real: relief that catches the lamps, wet stone that mirrors them.
import * as THREE from 'three';
import { makeRng } from '../../../engine/rng.js';

function canvas(size) { const c = document.createElement('canvas'); c.width = c.height = size; return c; }

// draw something so it wraps: call f at the 9 tile offsets that could reach into the tile
function wrap(size, x, y, r, f) {
  for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
    if (x + ox + r < 0 || x + ox - r > size || y + oy + r < 0 || y + oy - r > size) continue;
    f(x + ox, y + oy);
  }
}

function normalFromHeight(hc, strength) {
  const s = hc.width, src = hc.getContext('2d').getImageData(0, 0, s, s).data;
  const out = canvas(s), og = out.getContext('2d'), img = og.createImageData(s, s), d = img.data;
  const H = (x, y) => src[(((y + s) % s) * s + ((x + s) % s)) * 4] / 255;
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1), i = (y * s + x) * 4;
    d[i] = (-dx / l * 0.5 + 0.5) * 255; d[i + 1] = (dy / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  og.putImageData(img, 0, 0); return out;
}

function toTex(c, srgb) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return t;
}

// one material's set: draw(albedo ctx, height ctx, rough ctx, size, rng)
function set(name, size, strength, draw) {
  const a = canvas(size), h = canvas(size), r = canvas(size), rng = makeRng('tex:' + name);
  const ga = a.getContext('2d'), gh = h.getContext('2d'), gr = r.getContext('2d');
  draw(ga, gh, gr, size, rng);
  return { map: toTex(a, true), normalMap: toTex(normalFromHeight(h, strength), false), roughnessMap: toTex(r, false), canvas: a };
}
const grey = (v) => { v = Math.max(0, Math.min(255, v | 0)); return `rgb(${v},${v},${v})`; };
function speckle(g, size, rng, n, rmax, alpha, light = 255, dark = 0) {
  for (let i = 0; i < n; i++) { g.fillStyle = rng.next() < 0.5 ? `rgba(${light},${light},${light},${alpha * rng.next()})` : `rgba(${dark},${dark},${dark},${alpha * rng.next()})`; g.beginPath(); g.arc(rng.next() * size, rng.next() * size, rng.next() * rmax + 0.4, 0, 7); g.fill(); }
}

export function makeTextures() {
  const T = {};

  // BRICK: 1 tile = 1.2 m. Bricks a little irregular, some darker, chipped corners; mortar recessed
  T.brick = set('brick', 512, 6, (ga, gh, gr, S, rng) => {
    ga.fillStyle = '#9a948a'; ga.fillRect(0, 0, S, S); gh.fillStyle = grey(40); gh.fillRect(0, 0, S, S); gr.fillStyle = grey(240); gr.fillRect(0, 0, S, S);
    const rows = 16, bh = S / rows, bw = S / 4.5;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * bw / 2 + rng.range(-3, 3);
      for (let k = -1; k < 6; k++) {
        const x = k * bw + off + 2, y = r * bh + 2, w = bw - 4 + rng.range(-2, 1), h = bh - 4;
        const v = rng.range(0.75, 1.15), dark = rng.chance(0.12) ? 0.7 : 1;
        ga.fillStyle = `rgb(${150 * v * dark | 0},${92 * v * dark | 0},${72 * v * dark | 0})`; ga.fillRect(x, y, w, h);
        gh.fillStyle = grey(150 + rng.range(-20, 30)); gh.fillRect(x, y, w, h);
        gr.fillStyle = grey(200 + rng.range(-25, 25)); gr.fillRect(x, y, w, h);
        if (rng.chance(0.3)) { gh.fillStyle = grey(70); gh.beginPath(); gh.arc(x + (rng.chance(0.5) ? 0 : w), y + (rng.chance(0.5) ? 0 : h), rng.range(3, 7), 0, 7); gh.fill(); }
      }
    }
    speckle(ga, S, rng, 3500, 1.4, 0.25); speckle(gh, S, rng, 2500, 1.2, 0.25);
    // soot and damp: darker toward the bottom of the tile is wrong for tiling; random stains instead
    for (let i = 0; i < 6; i++) { const x = rng.next() * S, y = rng.next() * S, gg = ga.createRadialGradient(x, y, 0, x, y, rng.range(30, 90)); gg.addColorStop(0, 'rgba(20,16,14,0.25)'); gg.addColorStop(1, 'rgba(20,16,14,0)'); ga.fillStyle = gg; ga.fillRect(0, 0, S, S); }
  });

  // CLAPBOARD: painted boards, 1 tile = 1.6 m (10 boards). White-ish paint, tinted per house by vertex colour
  T.siding = set('siding', 512, 5, (ga, gh, gr, S, rng) => {
    const n = 10, bh = S / n;
    for (let r = 0; r < n; r++) {
      const y = r * bh, gg = gh.createLinearGradient(0, y, 0, y + bh); gg.addColorStop(0, grey(90)); gg.addColorStop(0.92, grey(200)); gg.addColorStop(1, grey(40));
      gh.fillStyle = gg; gh.fillRect(0, y, S, bh);
      ga.fillStyle = grey(215 + rng.range(-12, 8)); ga.fillRect(0, y, S, bh);
      ga.fillStyle = 'rgba(0,0,0,0.35)'; ga.fillRect(0, y + bh - 3, S, 3);
      gr.fillStyle = grey(150 + rng.range(-15, 15)); gr.fillRect(0, y, S, bh);
      for (let k = 0; k < 2; k++) { const x = rng.next() * S; ga.fillStyle = 'rgba(0,0,0,0.25)'; ga.fillRect(x, y + 1, 2, bh - 3); } // board joints
      for (let k = 0; k < 3; k++) { // flaked paint showing weathered wood, soft-edged
        const x = rng.next() * S, w = rng.range(6, 22), h = rng.range(2, bh * 0.35), yy = y + rng.range(3, bh - h - 4);
        ga.fillStyle = `rgba(150,138,120,0.55)`; ga.beginPath(); ga.ellipse(x, yy, w / 2, h / 2, 0, 0, 7); ga.fill(); gr.fillStyle = grey(230); gr.beginPath(); gr.ellipse(x, yy, w / 2, h / 2, 0, 0, 7); gr.fill();
      }
    }
    speckle(ga, S, rng, 2000, 1, 0.12);
  });

  // RENDER (stucco): rough plaster with cracks and long damp streaks
  T.render = set('render', 512, 4, (ga, gh, gr, S, rng) => {
    ga.fillStyle = grey(200); ga.fillRect(0, 0, S, S); gh.fillStyle = grey(128); gh.fillRect(0, 0, S, S); gr.fillStyle = grey(235); gr.fillRect(0, 0, S, S);
    speckle(gh, S, rng, 14000, 1.6, 0.5); speckle(ga, S, rng, 6000, 1.5, 0.12);
    for (let i = 0; i < 9; i++) { const x = rng.next() * S, w = rng.range(8, 30), gg = ga.createLinearGradient(0, 0, 0, S); gg.addColorStop(0, 'rgba(40,36,30,0)'); gg.addColorStop(rng.next(), 'rgba(40,36,30,0.28)'); gg.addColorStop(1, 'rgba(40,36,30,0)'); ga.fillStyle = gg; ga.fillRect(x, 0, w, S); }
    ga.strokeStyle = 'rgba(30,26,22,0.6)'; gh.strokeStyle = grey(40); ga.lineWidth = gh.lineWidth = 1.4;
    for (let i = 0; i < 5; i++) { let x = rng.next() * S, y = rng.next() * S; ga.beginPath(); gh.beginPath(); ga.moveTo(x, y); gh.moveTo(x, y); for (let k = 0; k < 8; k++) { x += rng.range(-14, 14); y += rng.range(4, 16); ga.lineTo(x, y); gh.lineTo(x, y); } ga.stroke(); gh.stroke(); }
  });

  // FISH-SCALE SLATES for the witch's-hat roofs: rows of rounded tiles, each domed, some slipped
  T.slate = set('slate', 512, 7, (ga, gh, gr, S, rng) => {
    ga.fillStyle = '#1e1d22'; ga.fillRect(0, 0, S, S); gh.fillStyle = grey(10); gh.fillRect(0, 0, S, S); gr.fillStyle = grey(200); gr.fillRect(0, 0, S, S);
    const rows = 12, rh = S / rows, tw = S / 8;
    for (let r = rows; r >= -1; r--) for (let k = -1; k < 9; k++) {
      const x = k * tw + (r % 2) * tw / 2 + rng.range(-1.5, 1.5), y = r * rh + rng.range(-1, 1), v = rng.range(0.7, 1.15);
      const shape = (g) => { g.beginPath(); g.moveTo(x, y); g.lineTo(x + tw - 1, y); g.lineTo(x + tw - 1, y + rh * 0.9); g.arc(x + tw / 2, y + rh * 0.9, tw / 2 - 1, 0, Math.PI); g.closePath(); };
      shape(ga); ga.fillStyle = `rgb(${84 * v | 0},${82 * v | 0},${92 * v | 0})`; ga.fill(); ga.strokeStyle = 'rgba(0,0,0,0.6)'; ga.lineWidth = 2; ga.stroke();
      const gg = gh.createLinearGradient(0, y, 0, y + rh * 1.4); gg.addColorStop(0, grey(60)); gg.addColorStop(1, grey(220)); shape(gh); gh.fillStyle = gg; gh.fill();
      shape(gr); gr.fillStyle = grey(rng.range(120, 190)); gr.fill(); // slate is smoother; wet slate shines
      if (rng.chance(0.15)) { shape(ga); ga.fillStyle = 'rgba(70,90,50,0.35)'; ga.fill(); } // moss
    }
  });

  // SETTS: rounded granite blocks in courses (the "cobbles" of an old street), worn and wet; water
  // sits in the joints and the polished tops catch every lamp
  T.cobble = set('cobble', 512, 6, (ga, gh, gr, S, rng) => {
    ga.fillStyle = '#1e1c22'; ga.fillRect(0, 0, S, S); gh.fillStyle = grey(0); gh.fillRect(0, 0, S, S); gr.fillStyle = grey(40); gr.fillRect(0, 0, S, S);
    const rows = 8, rh = S / rows;
    const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
    for (let r = 0; r < rows; r++) {
      let x = rng.range(0, 30);
      while (x < S + 30) {
        const w = rng.range(70, 96), y0 = r * rh + 3 + rng.range(-1.5, 1.5), h = rh - 6, v = rng.range(0.72, 1.18), tone = rng.pick([[96, 90, 104], [104, 96, 92], [86, 88, 96], [110, 104, 110], [92, 86, 84]]);
        const ww = w - 6, rough = rng.range(90, 150);
        wrap(S, x + 3 + ww / 2, y0 + h / 2, ww, (X, Y) => {
          const L = X - ww / 2, T = Y - h / 2;
          ga.fillStyle = `rgb(${tone[0] * v | 0},${tone[1] * v | 0},${tone[2] * v | 0})`; rr(ga, L, T, ww, h, 12); ga.fill();
          const hg = gh.createRadialGradient(X - ww * 0.1, Y - h * 0.15, 2, X, Y, ww * 0.62); hg.addColorStop(0, grey(235)); hg.addColorStop(0.75, grey(190)); hg.addColorStop(1, grey(60));
          gh.fillStyle = hg; rr(gh, L, T, ww, h, 12); gh.fill();
          gr.fillStyle = grey(rough); rr(gr, L, T, ww, h, 12); gr.fill();
          ga.fillStyle = 'rgba(255,255,255,0.05)'; ga.beginPath(); ga.ellipse(X, Y - 3, ww * 0.3, h * 0.25, 0, 0, 7); ga.fill();
        });
        x += w;
      }
    }
    speckle(ga, S, rng, 4000, 1.2, 0.18); speckle(gh, S, rng, 3000, 1, 0.2);
  });

  // PAVING SLABS: big worn squares, cracked, moss in the joints
  T.slab = set('slab', 256, 4, (ga, gh, gr, S, rng) => {
    ga.fillStyle = grey(150); ga.fillRect(0, 0, S, S); gh.fillStyle = grey(200); gh.fillRect(0, 0, S, S); gr.fillStyle = grey(200); gr.fillRect(0, 0, S, S);
    speckle(ga, S, rng, 3000, 1.2, 0.25); speckle(gh, S, rng, 2500, 1, 0.3);
    for (const g of [ga, gh]) { g.fillStyle = g === ga ? 'rgba(40,46,34,0.9)' : grey(20); g.fillRect(0, 0, S, 4); g.fillRect(0, 0, 4, S); g.fillRect(0, S / 2, S, 3); }
    for (let i = 0; i < 4; i++) { const v = rng.range(-14, 14); ga.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},0.07)`; ga.fillRect(rng.pick([4, S / 2 + 3]) * 0 + (i % 2) * S / 2 + 4, Math.floor(i / 2) * S / 2 + 4, S / 2 - 6, S / 2 - 6); }
    ga.strokeStyle = 'rgba(20,20,20,0.7)'; gh.strokeStyle = grey(60); ga.lineWidth = gh.lineWidth = 1.2;
    for (let i = 0; i < 2; i++) { let x = rng.next() * S, y = rng.next() * S; ga.beginPath(); gh.beginPath(); ga.moveTo(x, y); gh.moveTo(x, y); for (let k = 0; k < 6; k++) { x += rng.range(-12, 12); y += rng.range(-12, 12); ga.lineTo(x, y); gh.lineTo(x, y); } ga.stroke(); gh.stroke(); }
  });

  // GRASS: dark, tufty
  T.grass = set('grass', 256, 3, (ga, gh, gr, S, rng) => {
    ga.fillStyle = '#2a3326'; ga.fillRect(0, 0, S, S); gh.fillStyle = grey(90); gh.fillRect(0, 0, S, S); gr.fillStyle = grey(235); gr.fillRect(0, 0, S, S);
    for (let i = 0; i < 4000; i++) {
      const x = rng.next() * S, y = rng.next() * S, h = rng.range(3, 9), v = rng.range(0.6, 1.4), c = [52 * v, 66 * v, 44 * v].map((q) => q | 0);
      ga.strokeStyle = `rgb(${c})`; ga.lineWidth = 1.2; ga.beginPath(); ga.moveTo(x, y); ga.lineTo(x + rng.range(-2, 2), y - h); ga.stroke();
      gh.strokeStyle = grey(140 + h * 10); gh.beginPath(); gh.moveTo(x, y); gh.lineTo(x + rng.range(-2, 2), y - h); gh.stroke();
    }
  });

  // WOOD (doors, fences, posts): planks with grain
  T.wood = set('wood', 256, 3, (ga, gh, gr, S, rng) => {
    ga.fillStyle = grey(180); ga.fillRect(0, 0, S, S); gh.fillStyle = grey(128); gh.fillRect(0, 0, S, S); gr.fillStyle = grey(200); gr.fillRect(0, 0, S, S);
    for (let i = 0; i < 260; i++) { const y = rng.next() * S, v = rng.range(-30, 20); ga.strokeStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v) / 160})`; ga.lineWidth = rng.range(0.5, 2); ga.beginPath(); ga.moveTo(0, y); for (let x = 0; x <= S; x += 16) ga.lineTo(x, y + Math.sin(x * 0.05 + i) * 2); ga.stroke(); gh.strokeStyle = grey(128 + v); gh.beginPath(); gh.moveTo(0, y); gh.lineTo(S, y); gh.stroke(); }
    for (let k = 0; k < 4; k++) { ga.fillStyle = 'rgba(0,0,0,0.5)'; ga.fillRect(0, k * S / 4, S, 2); gh.fillStyle = grey(20); gh.fillRect(0, k * S / 4, S, 2); }
  });

  // PAINTED METAL (lamp posts, railings, bins)
  T.metal = set('metal', 256, 2, (ga, gh, gr, S, rng) => {
    ga.fillStyle = grey(190); ga.fillRect(0, 0, S, S); gh.fillStyle = grey(128); gh.fillRect(0, 0, S, S); gr.fillStyle = grey(110); gr.fillRect(0, 0, S, S);
    speckle(gh, S, rng, 1500, 1.5, 0.2); speckle(gr, S, rng, 800, 3, 0.3);
    for (let i = 0; i < 30; i++) { const x = rng.next() * S, y = rng.next() * S, r = rng.range(1, 5); ga.fillStyle = `rgba(110,60,30,${rng.range(0.3, 0.8)})`; ga.beginPath(); ga.arc(x, y, r, 0, 7); ga.fill(); gr.fillStyle = grey(240); gr.beginPath(); gr.arc(x, y, r, 0, 7); gr.fill(); }
  });

  // HEDGE: leafy clumps
  T.hedge = set('hedge', 256, 5, (ga, gh, gr, S, rng) => {
    ga.fillStyle = '#121a12'; ga.fillRect(0, 0, S, S); gh.fillStyle = grey(30); gh.fillRect(0, 0, S, S); gr.fillStyle = grey(200); gr.fillRect(0, 0, S, S);
    for (let i = 0; i < 2600; i++) {
      const x = rng.next() * S, y = rng.next() * S, r = rng.range(2, 5), v = rng.range(0.6, 1.4), a = rng.next() * 6.3;
      wrap(S, x, y, r * 2, (X, Y) => {
        ga.fillStyle = `rgb(${34 * v | 0},${52 * v | 0},${32 * v | 0})`; ga.beginPath(); ga.ellipse(X, Y, r * 1.6, r, a, 0, 7); ga.fill();
        gh.fillStyle = grey(110 + v * 90); gh.beginPath(); gh.ellipse(X, Y, r * 1.6, r, a, 0, 7); gh.fill();
        gr.fillStyle = grey(rng.range(120, 200)); gr.beginPath(); gr.ellipse(X, Y, r * 1.6, r, a, 0, 7); gr.fill();
      });
    }
  });

  // BARK
  T.bark = set('bark', 256, 6, (ga, gh, gr, S, rng) => {
    ga.fillStyle = '#2a241f'; ga.fillRect(0, 0, S, S); gh.fillStyle = grey(128); gh.fillRect(0, 0, S, S); gr.fillStyle = grey(235); gr.fillRect(0, 0, S, S);
    for (let i = 0; i < 160; i++) { const x = rng.next() * S, v = rng.range(0.6, 1.3); ga.strokeStyle = `rgba(${60 * v | 0},${52 * v | 0},${44 * v | 0},0.8)`; gh.strokeStyle = grey(rng.range(40, 220)); ga.lineWidth = gh.lineWidth = rng.range(1, 4); ga.beginPath(); gh.beginPath(); let xx = x; ga.moveTo(xx, 0); gh.moveTo(xx, 0); for (let y = 0; y <= S; y += 16) { xx += rng.range(-3, 3); ga.lineTo(xx, y); gh.lineTo(xx, y); } ga.stroke(); gh.stroke(); }
  });
  return T;
}
