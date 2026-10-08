// Every surface of the school, painted once at boot by the procedural brush and handed to three.js.
// Sizes are in texture pixels; each texture knows how many metres it covers (m: [width, height]).
import * as THREE from 'three';
import { Painter } from './paint.js';
import { wallTexture, floorTexture, ceilingTexture, doorTexture, noticeTexture, photoTexture, rectP, texCanvas, densify, crayon, label } from './school.js';
import { windowTexture, displayTexture, planksTexture } from './rooms.js';

function tex(canvas, repeat = true) {
  const t = new THREE.CanvasTexture(canvas);
  t.premultiplyAlpha = true; // opaque surfaces: skips a slow per-pixel alpha conversion on upload
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// one locker front, 0.5 x 1.95 m
export function lockerTexture(seed) {
  return texCanvas(64, 250, seed, (p, c) => {
    c.fillStyle = p.grey(0.12); c.fillRect(0, 0, 64, 250);
    const poly = rectP(3, 3, 61, 247, 8);
    p.fill(poly, { tone: 0.4 + p.rand(-0.04, 0.04), w: 8, angle: Math.PI / 2, angJit: 0.06, vary: 0.05, len: [0.1, 0.3], sheen: 0.25, sheenTone: 0.55, edge: 0 });
    p.paperEdge(poly, 0.42);
    for (let v = 0; v < 4; v++) p.brush([[16, 22 + v * 9], [48, 22 + v * 9]], { w: 3.2, tone: 0.1, bristles: 2, body: false, taper: 0.3 });
    const tag = rectP(22, 68, 42, 82, 3);
    p.fill(tag, { tone: 0.82, w: 3, edge: 0 }); p.paperEdge(tag, 0.8);
    c.fillStyle = 'rgba(30,28,26,0.8)'; c.font = 'bold 10px Georgia'; c.textAlign = 'center'; c.fillText(String(100 + (seed % 90)), 32, 79);
    p.fill(rectP(50, 128, 55, 154, 2), { tone: 0.72, w: 2, edge: 0 });
    p.pin(32, 10, 3.5);
  });
}

// the alphabet frieze over the board: a crayon-coloured card per letter
export function friezeCanvas() {
  const CR = [[205, 38, 52], [232, 166, 28], [38, 92, 205], [28, 156, 104], [126, 62, 168]];
  return texCanvas(1400, 82, 1201, (p, c) => {
    const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let i = 0; i < 26; i++) {
      const x = i * 53.8, poly = rectP(x + 3, 6, x + 50, 76, 2), col = CR[i % 5];
      p.fill(poly, { tone: 0.88, w: 3, edge: 0 }); p.paperEdge(poly, 0.85);
      c.fillStyle = `rgba(${col.join(',')},0.9)`; c.font = 'bold 28px Georgia'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(L[i] + L[i].toLowerCase(), x + 27, 42);
    }
  });
}

// how many metres each texture covers
const METRES = {
  wall: [4, 2.85], wall2: [4, 2.85], floor: [3.4, 2], ceiling: [3.4, 2], planks: [2, 2],
  locker: [0.5, 1.95], locker2: [0.5, 1.95], locker3: [0.5, 1.95],
  door: [1.16, 2.25], door2: [1.16, 2.25], door3: [1.16, 2.25], doorFace: [1.16, 2.25],
  wallTile: [4, 2.85], wallPanel: [4, 2.85], floorLino: [3.4, 2], dress: [1, 1], hallDoors: [2.4, 2.55],
  notice: [2.1, 0.95], photo1: [0.7, 0.44], photo2: [0.7, 0.44], photo3: [0.7, 0.44], window: [2, 1.7], display: [3.6, 1.15],
};

// all of them painted in parallel by the painter workers (and cached after the first launch)
export async function paintTextures(progress = () => {}, cachedJob) {
  const names = Object.keys(METRES);
  let done = 0;
  const canvases = await Promise.all(names.map((n) => cachedJob(`tex:${n}`, n).then((c) => { progress(n, ++done / names.length); return c; })));
  const out = {};
  names.forEach((n, i) => { out[n] = { canvas: canvases[i], tex: tex(canvases[i]), m: METRES[n] }; });
  progress('done', 1);
  return out;
}

export { tex, Painter };

// THE TORN PAGES: crayon drawings from the boy's notebook, one found per night at most. Together they
// say what happened without saying it. n = 0 is the picture book's missing page (Story Time).
export function pageCanvas(n) {
  const R = [205, 38, 52], Y = [232, 166, 28], B = [38, 92, 205], G = [28, 156, 104], P = [126, 62, 168], K = [26, 24, 24], S = [76, 72, 68];
  return texCanvas(540, 410, 1300 + n, (p, c) => {
    const sheet = densify([[30, 34], [492, 22], [500, 372], [40, 386]], 6);
    p.shadow(sheet, 8, 10, 10, 0.35); p.fill(sheet, { tone: 0.93, w: 6, angle: 0, edge: 0.5, edgeTone: 0.78 }); p.paperEdge(sheet, 0.9);
    // a torn edge along the left, where it came out of the notebook
    c.fillStyle = 'rgba(0,0,0,0)';
    for (let y = 30; y < 380; y += 14) p.brush([[30 + p.rand(-4, 6), y], [44 + p.rand(-4, 4), y + 7]], { w: 3, tone: 0.75, bristles: 2, body: false });
    const seg = (pts, col, w = 5) => { for (let i = 0; i < pts.length - 1; i++) crayon(p, [pts[i], pts[i + 1]], col, w); };
    const kid = (x, y, col, s = 1, faceOut = false) => {
      crayon(p, [[x, y], [x, y + 1]], col, 16 * s); seg([[x, y + 9 * s], [x, y + 38 * s]], col, 4); seg([[x, y + 38 * s], [x - 8 * s, y + 62 * s]], col, 4); seg([[x, y + 38 * s], [x + 8 * s, y + 62 * s]], col, 4);
      seg([[x - 16 * s, y + 20 * s], [x + 16 * s, y + 20 * s]], col, 4);
      if (faceOut) for (let k = 0; k < 4; k++) crayon(p, [[x - 8 * s, y - 5 * s + k * 3], [x + 8 * s, y - 2 * s + k * 3]], K, 2.5);
    };
    if (n === 0) { // the picture book: a boy at a door, the teacher behind him, very tall
      seg([[300, 330], [300, 120], [400, 120], [400, 330]], S, 6); crayon(p, [[380, 230], [381, 231]], Y, 8);
      kid(240, 240, B, 1.1);
      seg([[120, 330], [130, 110]], K, 10); crayon(p, [[130, 96], [131, 97]], K, 30); seg([[130, 150], [190, 170], [222, 160]], K, 4);
      label(p, 'and then...', 270, 72, { size: 26, font: 'cursive', weight: 'normal', col: 'rgba(40,40,44,0.8)' });
    } else if (n === 1) { // the children in a line, holding hands, singing
      for (let i = 0; i < 9; i++) kid(80 + i * 44, 170, [R, Y, G, P, B, R, G, Y, P][i]);
      for (let i = 0; i < 9; i++) crayon(p, [[76 + i * 44, 150], [84 + i * 44, 140]], K, 2); // little notes
      label(p, 'the concert', 260, 80, { size: 30, font: 'cursive', weight: 'normal', col: 'rgba(40,40,44,0.8)' });
    } else if (n === 2) { // the notice: doors locked during the performance
      const card = densify([[110, 90], [430, 84], [434, 300], [114, 306]], 4);
      p.fill(card, { tone: 0.82, w: 4, edge: 0.3 });
      label(p, 'CONCERT', 272, 130, { size: 30 });
      label(p, 'doors will be', 272, 190, { size: 24, weight: 'normal' });
      label(p, 'LOCKED', 272, 236, { size: 38, col: 'rgba(176,22,30,0.9)' });
      crayon(p, [[150, 270], [400, 262]], R, 5);
    } else if (n === 3) { // the school with smoke coming out of the roof; the windows full of faces
      seg([[150, 340], [150, 180], [270, 110], [390, 180], [390, 340], [150, 340]], S, 7);
      for (const [x, y] of [[180, 210], [300, 210], [180, 270], [300, 270]]) { seg([[x, y], [x + 60, y], [x + 60, y + 44], [x, y + 44], [x, y]], S, 4); for (let k = 0; k < 3; k++) crayon(p, [[x + 12 + k * 17, y + 22], [x + 13 + k * 17, y + 23]], [200, 196, 188], 10); }
      for (let k = 0; k < 26; k++) { const x = 270 + p.rand(-90, 120); crayon(p, [[x, 116], [x + p.rand(-30, 30), 70], [x + p.rand(-50, 50), 30]], K, 9, 0.6); }
    } else if (n === 4) { // a door, and many small hands on it, from the inside
      seg([[190, 340], [190, 80], [350, 80], [350, 340]], S, 8);
      for (let k = 0; k < 7; k++) crayon(p, [[200, 120 + k * 30], [340, 130 + k * 30]], K, 4);
      for (let k = 0; k < 14; k++) { const x = p.rand(205, 335), y = p.rand(100, 320), col = [R, Y, G, P, B][k % 5]; crayon(p, [[x, y], [x + 1, y + 1]], col, 13); for (let f = 0; f < 4; f++) crayon(p, [[x - 6 + f * 4, y - 6], [x - 7 + f * 4, y - 14]], col, 2.5); }
    } else { // the boy, outside, alone; the school behind him, small
      seg([[60, 300], [60, 220], [110, 190], [160, 220], [160, 300], [60, 300]], S, 5);
      for (let k = 0; k < 8; k++) crayon(p, [[80 + p.rand(0, 60), 190], [80 + p.rand(-20, 80), 150]], K, 5, 0.5);
      kid(380, 220, B, 1.4);
      crayon(p, [[300, 340], [500, 340]], G, 6);
      label(p, 'me', 380, 170, { size: 26, font: 'cursive', weight: 'normal', col: 'rgba(38,92,205,0.9)' });
    }
    p.pin(262, 34, 7);
  });
}

// the infants' rug: big crayon-bright squares, faded
export function rugCanvas() {
  return texCanvas(320, 220, 1401, (p, c) => {
    const C = [[205, 38, 52], [232, 166, 28], [38, 92, 205], [28, 156, 104], [126, 62, 168]];
    for (let i = 0; i < 8; i++) for (let j = 0; j < 5; j++) {
      const col = C[(i + j) % 5].map((v) => Math.round(v * 0.45 + 120 * 0.55));
      p.fill(rectP(i * 40 + 1, j * 44 + 1, i * 40 + 39, j * 44 + 43, 2), { rgb: col, w: 6, edge: 0, alpha: 0.9 });
    }
  });
}

// ---- the wings' own surfaces (research/07 phase 3): each part of the school looks like itself ----
// the science wing: glazed tiles to shoulder height, grimy grout, a green stripe; plaster above
export function wallTileTexture(seed) {
  return texCanvas(512, 365, seed, (p, c) => {
    c.fillStyle = p.grey(0.4); c.fillRect(0, 0, 512, 365);
    p.fill(rectP(-6, -6, 518, 150, 6), { tone: 0.5, w: 16, angle: 0.04, angJit: 0.12, vary: 0.05, len: [0.12, 0.32], sheen: 0.15, edge: 0 });
    for (let r = 0; r < 7; r++) for (let k = 0; k < 16; k++) {
      const x0 = k * 32 + (r % 2) * 16 - 16, y0 = 150 + r * 30, poly = rectP(x0 + 2, y0 + 2, x0 + 30, y0 + 28, 2);
      p.fill(poly, { rgb: r === 1 ? [70, 108, 88] : [196, 200, 190], w: 5, angle: 0, vary: 0.05, sheen: 0.4, sheenTone: 0.85, edge: 0, alpha: 0.95 });
    }
    for (let k = 0; k < 7; k++) { const x = p.rand(0, 512); p.brush([[x, 150], [x + p.rand(-6, 6), 150 + p.rand(60, 200)]], { w: p.rand(4, 12), rgb: [80, 70, 50], alpha: 0.25, dry: 0.4, body: false }); }
    p.fill(rectP(-6, 350, 518, 370, 6), { tone: 0.12, w: 6, angle: 0, edge: 0 });
  });
}
// the old wing: dark varnished panelling, full height, a picture rail
export function wallPanelTexture(seed) {
  return texCanvas(512, 365, seed, (p, c) => {
    c.fillStyle = 'rgb(70,52,38)'; c.fillRect(0, 0, 512, 365);
    for (let k = 0; k < 4; k++) {
      const x0 = k * 128;
      for (const [y0, y1] of [[40, 200], [214, 340]]) {
        const poly = rectP(x0 + 12, y0, x0 + 116, y1, 4);
        p.shadow(poly, 2, 3, 3, 0.5);
        p.fill(poly, { rgb: [128, 92, 64], w: 10, angle: Math.PI / 2, angJit: 0.04, vary: 0.06, len: [0.2, 0.5], sheen: 0.3, sheenTone: 0.6, edge: 0 });
        p.paperEdge(poly, 0.3);
      }
    }
    p.fill(rectP(-6, 20, 518, 32, 3), { rgb: [60, 42, 30], w: 5, angle: 0, edge: 0 });
    p.fill(rectP(-6, 350, 518, 370, 6), { tone: 0.08, w: 6, angle: 0, edge: 0 });
  });
}
// the infants: lino in faded squares, with a hopscotch here and there
export function floorLinoTexture(seed) {
  return texCanvas(436, 256, seed, (p, c) => {
    c.fillStyle = 'rgb(78,70,58)'; c.fillRect(0, 0, 436, 256);
    for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) {
      const x0 = k * 72.6, y0 = r * 64, poly = rectP(x0 + 1, y0 + 1, x0 + 71, y0 + 63, 3);
      p.fill(poly, { rgb: (r + k) % 3 ? [118, 104, 82] : [96, 104, 92], w: 9, angle: p.rand(0, 3), angJit: 0.3, vary: 0.05, len: [0.15, 0.4], sheen: 0.25, edge: 0 });
    }
    for (let i = 0; i < 5; i++) { const x = p.rand(0, 436), y = p.rand(0, 256); p.brush([[x, y], [x + p.rand(-40, 40), y + p.rand(10, 40)]], { w: p.rand(3, 8), tone: 0.12, alpha: 0.3, body: false, dry: 0.5 }); }
  });
}
