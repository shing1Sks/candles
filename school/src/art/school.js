// THE SCHOOL: the painted cards and textures (copied from spike/concepts/school.js, scene frames removed).
// Original header: THE SCHOOL: concept designs from the user's second sketch (research/img/04_sketch_school.jpg).
// THROWAWAY spike code, same pinned-paper language as designs.js: grey oil paint on cut paper,
// every joint a split pin (a pivot the game animates), attachments stapled.
// Only three colours exist in the school: GOLD (star stickers), RED (marking pen, danger), CRAYON (memory).
import { ellipse, Painter } from './paint.js';
import { blob, piece, cut, scallop } from './designs.js';

export const GOLD = [226, 176, 40];
export const RED = [188, 26, 34];
export const CRAYON = [[205, 38, 52], [232, 166, 28], [38, 92, 205], [28, 156, 104], [126, 62, 168]];

const SKIN = { tone: 0.84, vary: 0.04, w: 7, len: [0.03, 0.09], angJit: 0.15, sheen: 0.15, sheenTone: 0.93, edgeTone: 0.66 };
const PALE = { tone: 0.93, w: 5, vary: 0.03, edge: 0.5, edgeTone: 0.78 };
const DARK = { tone: 0.1, vary: 0.05, w: 12, sheen: 0.18, sheenTone: 0.28, edgeTone: 0.08 };
const rgbS = (c) => `rgb(${c.join(',')})`;

// paint fn() rotated by ang about a pin at (x, y): this is how the game will pose a part
function about(p, x, y, ang, fn) {
  const c = p.ctx;
  c.save(); c.translate(x, y); c.rotate(ang); c.translate(-x, -y); fn(); c.restore();
}

function starPath(cx, cy, R, rot = -Math.PI / 2, inner = 0.45) {
  const path = new Path2D(), pts = [];
  for (let i = 0; i < 10; i++) {
    const a = rot + (i * Math.PI) / 5, r = i % 2 ? R * inner : R;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  pts.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
  path.closePath();
  return { path, pts };
}

// A gold foil star sticker: cut paper, each arm creased into a light and a dark half.
export function goldStar(p, cx, cy, R, rot = -Math.PI / 2, sh = [2, 3, 3, 0.45]) {
  const { path, pts } = starPath(cx, cy, R, rot);
  cut(p, path, p.rgbJit(GOLD, 1, 10), sh);
  const c = p.ctx;
  for (let i = 0; i < 10; i += 2) {
    const tip = pts[i], a = pts[(i + 9) % 10], b = pts[(i + 1) % 10];
    for (const [side, col] of [[a, 'rgba(255,240,170,0.55)'], [b, 'rgba(120,80,10,0.35)']]) {
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(...tip); c.lineTo(...side); c.closePath();
      c.fillStyle = col; c.fill();
    }
  }
  c.save(); c.lineWidth = Math.max(0.6, R * 0.05); c.strokeStyle = 'rgba(90,60,6,0.6)'; c.stroke(path); c.restore();
}

function label(p, text, x, y, o = {}) {
  const { size = 20, col = 'rgba(30,28,26,0.9)', rot = 0, font = 'Georgia, serif', weight = 'bold', align = 'center' } = o;
  const c = p.ctx;
  c.save(); c.translate(x, y); c.rotate(rot);
  c.font = `${weight} ${size}px ${font}`; c.textAlign = align; c.textBaseline = 'middle'; c.fillStyle = col;
  c.fillText(text, 0, 0);
  c.restore();
}

// a crayon line: thin, waxy, gappy
function crayon(p, pts, col, w = 4, alpha = 0.85) {
  p.brush(pts, { w, rgb: col, alpha, dry: 0.35, bristles: 4, taper: 0.2, body: false, wobble: 0.3 });
}

// a row of teeth inside a pale mouth strip, between two curves
function teeth(p, x0, x1, yTop, yBot, n, o = {}) {
  const { tone = 0.1, sharp = false, w = 2.2 } = o;
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = x0 + (x1 - x0) * t;
    const yt = yTop(t), yb = yBot(t);
    if (sharp) {
      p.brush([[x, yt], [x + (x1 - x0) / n / 2, yb]], { w, tone, bristles: 2, taper: 0.4, body: false });
      p.brush([[x + (x1 - x0) / n, yt], [x + (x1 - x0) / n / 2, yb]], { w, tone, bristles: 2, taper: 0.4, body: false });
    } else p.brush([[x, yt], [x + 0.5, yb]], { w, tone, bristles: 2, taper: 0.5, body: false });
  }
}

// ---------------------------------------------------------------------------
// THE HEADMASTER: walks the halls. Tall hat, round glasses with split pins for pupils, a moustache
// wider than his face, too many teeth on a jaw pinned at both corners (it can drop open).
// The punishment book under one arm, a fist raised. His coat is covered in children's gold stars.
function headmaster(p) {
  const SUIT = { tone: 0.12, vary: 0.05, w: 12, sheen: 0.2, sheenTone: 0.3, edgeTone: 0.09 };
  const pins = [], staples = [];
  const c = p.ctx;

  p.shadow(ellipse(324, 1118, 190, 20), 0, 0, 14, 0.4);
  // legs: thigh + shin per side, pinned at hip and knee; long shoes
  for (const [hip, knee, foot, s] of [[[292, 690], [282, 900], [278, 1094], -1], [[354, 690], [368, 900], [376, 1094], 1]]) {
    piece(p, p.limb([[knee[0], knee[1] - 8], foot], 38, 32), { ...SUIT, tone: 0.1 });
    piece(p, p.limb([[foot[0] - s * 4, 1098], [foot[0] + s * 30, 1110], [foot[0] + s * 56, 1112]], 26, 20), { ...SUIT, tone: 0.06, angle: 0 });
    piece(p, p.limb([[hip[0], hip[1] - 10], [knee[0], knee[1] + 10]], 48, 40), { ...SUIT, tone: 0.13 });
    pins.push([...knee, 8], [...hip, 8.5]);
  }

  // the coat: long, split tails
  const coat = [[270, 322], [226, 348], [222, 430], [252, 560], [238, 700], [228, 800], [300, 806], [322, 712], [344, 806], [418, 800], [406, 700], [392, 560], [424, 430], [420, 348], [376, 322]];
  piece(p, coat, { ...SUIT, w: 14 }, [12, 16, 14, 0.36]);
  const coatPath = p.pathOf(coat).path;

  // shirt, lapels, a red tie
  piece(p, [[296, 326], [350, 326], [323, 470]], { ...PALE, tone: 0.88 }, [1, 2, 2, 0.3]);
  piece(p, [[296, 326], [278, 340], [312, 470], [323, 474]], { ...SUIT, tone: 0.2, w: 6, edge: 0.4 }, [3, 4, 4, 0.4]);
  piece(p, [[350, 326], [368, 340], [334, 470], [323, 474]], { ...SUIT, tone: 0.2, w: 6, edge: 0.4 }, [3, 4, 4, 0.4]);
  piece(p, [[316, 334], [331, 334], [336, 430], [323, 462], [311, 430]], { rgb: RED, tone: 0.4, w: 5, alpha: 0.95, edge: 0.4, angle: Math.PI / 2 }, [3, 4, 4, 0.4]);
  staples.push([316, 340, 330, 346]);

  // the stars he kept: dozens of gold stickers stuck all over the coat, a few pinned
  let n = 0;
  for (let tries = 0; tries < 900 && n < 58; tries++) {
    const x = p.rand(222, 424), y = p.rand(340, 800);
    if (!c.isPointInPath(coatPath, x, y)) continue;
    if (y < 480 && Math.abs(x - 323) < (480 - y) * 0.2 + 22) continue; // keep clear of the shirt
    const R = p.rand(7, 14);
    goldStar(p, x, y, R, p.rand(0, Math.PI * 2), [1.5, 2, 2, 0.5]);
    if (n % 9 === 4) pins.push([x, y, 3.2]);
    n++;
  }

  // the punishment book, held against his side
  const book = densify([[112, 432], [268, 466], [252, 652], [96, 618]], 8);
  piece(p, book, { tone: 0.2, vary: 0.05, w: 10, angle: 0.2, sheen: 0.2, sheenTone: 0.34, edgeTone: 0.12 }, [10, 12, 12, 0.4]);
  piece(p, densify([[96, 618], [252, 652], [250, 664], [94, 630]], 5), { ...PALE, tone: 0.8, w: 3, angle: 0.2, edge: 0 }, [2, 3, 3, 0.3]);
  piece(p, densify([[122, 494], [244, 520], [238, 572], [116, 546]], 4), { ...PALE, tone: 0.86, w: 4, angle: 0.2, edge: 0.3 }, [2, 3, 3, 0.35]);
  label(p, 'PUNISHMENT', 180, 524, { size: 14, rot: 0.2, col: 'rgba(110,14,20,0.9)' });
  label(p, 'BOOK', 178, 548, { size: 14, rot: 0.2, col: 'rgba(110,14,20,0.9)' });
  staples.push([136, 504, 148, 494], [218, 562, 230, 552]);

  // left arm crossing over the book, hand gripping its edge
  piece(p, p.limb([[234, 352], [210, 420], [196, 482]], 42, 36), SUIT);
  piece(p, p.limb([[196, 482], [230, 528], [262, 556]], 36, 30), { ...SUIT, angle: 0.8 });
  piece(p, p.limb([[256, 550], [266, 560]], 24, 24), { ...PALE, tone: 0.86, w: 3 });
  piece(p, blob(p, 280, 572, 22, 18, 10, 0.12), SKIN);
  for (const k of [0, 1, 2]) piece(p, p.limb([[270 + k * 8, 584], [268 + k * 9, 600]], 9, 7), { ...SKIN, w: 3, edge: 0.4 }, [2, 3, 3, 0.35]);
  pins.push([234, 356, 9], [198, 484, 8], [262, 556, 6.5]);

  // the raised fist
  piece(p, p.limb([[412, 352], [456, 336], [494, 326]], 42, 36), SUIT);
  piece(p, p.limb([[494, 330], [500, 260], [504, 206]], 36, 30), { ...SUIT, angle: -1.5 });
  piece(p, p.limb([[504, 214], [504, 200]], 34, 34), { ...PALE, tone: 0.86, w: 3, angle: 0 });
  piece(p, blob(p, 506, 172, 30, 32, 12, 0.1), { ...SKIN, angle: -1.2 });
  for (let k = 0; k < 4; k++) p.brush([[484 + k * 13, 150], [486 + k * 13, 166]], { w: 2, tone: 0.45, bristles: 2, body: false });
  piece(p, p.limb([[480, 188], [500, 176], [520, 182]], 14, 10), { ...SKIN, w: 3, edge: 0.4 }, [2, 3, 3, 0.35]);
  pins.push([414, 354, 9], [494, 330, 8], [504, 208, 6.5]);

  // head: long pale face, tilted on the neck pin; its own pins and staples turn with it
  about(p, 323, 330, -0.09, () => {
    const hp = [], hs = [];
    piece(p, p.limb([[323, 296], [323, 330]], 40, 40), { ...SKIN, tone: 0.78 });
    piece(p, blob(p, 274, 244, 14, 22, 8, 0.1), SKIN, [3, 4, 4, 0.3]);
    piece(p, blob(p, 372, 244, 14, 22, 8, 0.1), SKIN, [3, 4, 4, 0.3]);
    const face = [[323, 322], [286, 304], [276, 252], [282, 200], [294, 172], [352, 172], [364, 200], [370, 252], [360, 304]];
    piece(p, face, { ...SKIN, angle: Math.PI / 2 }, [8, 12, 10, 0.4]);
    hp.push([276, 246, 4.5], [370, 246, 4.5]);

    // tall hat, pinned through the brim, band stapled on
    piece(p, [[284, 176], [276, 44], [372, 38], [364, 176]], { ...SUIT, tone: 0.07, w: 10, angle: Math.PI / 2 }, [8, 10, 10, 0.4]);
    piece(p, [[280, 150], [366, 150], [366, 174], [280, 174]], { ...SUIT, tone: 0.25, w: 5, angle: 0 }, [2, 3, 3, 0.4]);
    piece(p, ellipse(323, 178, 80, 13, 16), { ...SUIT, tone: 0.05, w: 8, angle: 0 }, [6, 8, 8, 0.4]);
    goldStar(p, 352, 160, 9, 0.3);
    hs.push([288, 156, 300, 168]);
    hp.push([300, 178, 5]);

    // sunken sockets behind round glasses; split pins for pupils
    for (const x of [302, 346]) piece(p, ellipse(x, 230, 27, 25, 14), { tone: 0.42, w: 4, vary: 0.05, edge: 0, alpha: 0.75 }, [0, 0, 2, 0]);
    for (const x of [302, 346]) {
      piece(p, ellipse(x, 228, 21, 21, 14), { ...PALE, tone: 0.95 }, [2, 3, 3, 0.4]);
      c.save(); c.lineWidth = 3.2; c.strokeStyle = 'rgba(16,14,12,0.9)'; c.beginPath(); c.arc(x, 228, 22, 0, Math.PI * 2); c.stroke(); c.restore();
      hp.push([x + 2, 231, 6]);
    }
    p.brush([[322, 226], [326, 224]], { w: 3, tone: 0.08, bristles: 2, body: false });
    // nose
    piece(p, [[318, 236], [334, 236], [342, 266], [326, 272], [314, 266]], { ...SKIN, tone: 0.78, w: 4 }, [3, 5, 4, 0.4]);

    // the grin: a jaw pinned at both corners, too wide, too many teeth
    piece(p, [[258, 274], [323, 288], [388, 274], [380, 300], [350, 324], [323, 330], [296, 324], [266, 300]], { ...PALE, tone: 0.95 }, [3, 4, 4, 0.5]);
    teeth(p, 266, 380, (t) => 282 + Math.abs(t - 0.5) * 2 * -6 + 4, (t) => 322 - Math.abs(t - 0.5) * 2 * 18, 18, { w: 2.2 });
    p.brush([[266, 298], [323, 312], [380, 298]], { w: 2.4, tone: 0.08, bristles: 2, body: false });
    hp.push([260, 280, 4.5], [386, 280, 4.5]);
    // moustache wider than the face
    const mou = [[323, 262], [298, 258], [266, 266], [244, 288], [272, 282], [300, 280], [323, 284], [346, 280], [374, 282], [402, 288], [380, 266], [348, 258]];
    piece(p, mou, { ...DARK, tone: 0.07, w: 6, angle: 0, angJit: 0.3 }, [3, 5, 5, 0.45]);
    for (let i = 0; i < 26; i++) {
      const s = i < 13 ? -1 : 1, t = (i % 13) / 12, x = 323 + s * (8 + t * 70);
      p.brush([[x, 268 + t * 4], [x + s * 10, 280 + t * 10]], { w: 2, tone: 0.04, bristles: 2, body: false, taper: 1 });
    }

    for (const s of hs) p.staple(...s);
    for (const [x, y, r] of hp) p.pin(x, y, r);
  });
  pins.push([323, 330, 8]);

  for (const s of staples) p.staple(...s);
  for (const [x, y, r] of pins) p.pin(x, y, r);
}

// ---------------------------------------------------------------------------
// THE TEACHER: hunched, her neck thrust forward, bun stabbed through with pencils, a hooked nose,
// a mouth that opens too far, lined in red. Claw fingers pinned at every knuckle, red nails. The red pen.
// Every teacher is one of a few (teacherSpec): dress colour, shawl, hair, eyes, mouth. Spec 0 is the
// original. The same spec paints her front and her back.
export const TEACHERS = [
  { dress: null, shawl: 0.44, hair: 'bun', hairTone: 0.42, eyes: 'monocle', mouth: 'wide' },
  { dress: [92, 30, 36], shawl: null, hair: 'bun', hairTone: 0.78, eyes: 'glasses', mouth: 'smile' },
  { dress: [70, 76, 44], shawl: 0.2, hair: 'long', hairTone: 0.1, eyes: 'holes', mouth: 'stitched' },
  { dress: [34, 40, 66], shawl: 0.7, hair: 'bun', hairTone: 0.3, eyes: 'glasses', mouth: 'wide' },
  { dress: [84, 72, 60], shawl: null, hair: 'long', hairTone: 0.72, eyes: 'monocle', mouth: 'smile' },
];
const dressOf = (sp) => (sp.dress ? { rgb: sp.dress } : { tone: 0.18 });

function teacher(p, sp = TEACHERS[0]) {
  const DRESS = { ...dressOf(sp), vary: 0.05, w: 12, sheen: 0.22, sheenTone: 0.34, edgeTone: 0.12 };
  const pins = [], staples = [];
  const c = p.ctx;
  p.shadow(ellipse(392, 976, 210, 18), 0, 0, 14, 0.4);
  // thin legs, pointed shoes
  for (const [top, foot, s] of [[[352, 840], [340, 948], -1], [[440, 840], [452, 948], 1]]) {
    piece(p, p.limb([top, foot], 22, 16), { ...DARK, tone: 0.16 });
    piece(p, [[foot[0] - 14, 944], [foot[0] + 12, 944], [foot[0] + 14, 964], [foot[0] + s * 76, 972], [foot[0] - 12, 968]], { ...DARK, tone: 0.05, angle: 0 });
    pins.push([...top, 6.5]);
  }
  // long skirt, pleated, flaring
  const skirt = [[300, 600], [500, 600], [530, 720], [566, 852], [470, 862], [390, 858], [300, 862], [228, 852], [262, 720]];
  piece(p, skirt, { ...DRESS, angle: Math.PI / 2 }, [12, 16, 14, 0.36]);
  for (let i = 0; i < 9; i++) { const x = 290 + i * 26; p.brush([[x + 6, 612], [x - (4 - i) * 6, 850]], { w: 3, tone: 0.08, bristles: 2, body: false, alpha: 0.7 }); }
  // hunched torso: the back rises into a hump, the shoulders roll forward
  const torso = [[292, 612], [270, 520], [258, 440], [270, 384], [318, 336], [392, 300], [462, 304], [510, 352], [526, 440], [516, 540], [504, 612]];
  piece(p, torso, { ...DRESS, tone: 0.24, angle: Math.PI / 2 + 0.4 }, [12, 16, 14, 0.36]);
  for (const y of [452, 500, 548]) pins.push([286 + (y - 452) * 0.05, y, 5]);
  // a knitted shawl over the hump, its fringe hanging
  piece(p, densify([[262, 608], [520, 608], [522, 632], [262, 632]], 5), { tone: 0.08, w: 6, angle: 0, edge: 0.4 }, [3, 5, 5, 0.4]);
  pins.push([300, 620, 6]);
  if (sp.shawl !== null) {
  const shawl = [[264, 392], [300, 344], [376, 306], [456, 304], [512, 344], [528, 420], [500, 500], [470, 556], [440, 508], [380, 452], [300, 424]];
  piece(p, shawl, { tone: sp.shawl, w: 6, vary: 0.07, angle: 0.3, angJit: 0.6, curve: 0.5, sheen: 0.3, sheenTone: 0.56, edgeTone: 0.34 }, [6, 9, 8, 0.38]);
  const fringe = [[300, 424], [380, 452], [440, 508], [470, 556], [500, 500], [528, 420]];
  for (let i = 0; i < fringe.length - 1; i++) for (let k = 0; k < 6; k++) {
    const t = k / 6, [ax, ay] = fringe[i], [bx, by] = fringe[i + 1], x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
    p.brush([[x, y], [x + p.rand(-3, 3), y + p.rand(14, 26)]], { w: 2, tone: 0.36, bristles: 2, body: false });
  }
  staples.push([476, 318, 492, 330]);
  }

  // long hair hangs down her back, under everything else on the head
  if (sp.hair === 'long') piece(p, [[150, 210], [214, 168], [286, 196], [330, 280], [352, 400], [336, 470], [300, 452], [282, 360], [250, 290], [200, 250]], { tone: sp.hairTone, w: 6, vary: 0.06, angle: Math.PI / 2 - 0.4, sheen: 0.25, edgeTone: sp.hairTone - 0.05 }, [6, 8, 8, 0.4]);

  // the neck, thrust forward
  piece(p, p.limb([[318, 370], [276, 338], [246, 318]], 34, 28), { ...SKIN, tone: 0.76 });
  pins.push([300, 356, 7]);

  // the back arm: claws spread low, holding the red pen
  const claw = (cx, cy, angs, len) => {
    piece(p, blob(p, cx, cy, 20, 16, 10, 0.12), SKIN);
    for (const a of angs) {
      const dx = Math.cos(a), dy = Math.sin(a);
      const tip = [cx + dx * len, cy + dy * len + 14];
      piece(p, p.limb([[cx + dx * 12, cy + dy * 12], [cx + dx * len * 0.55, cy + dy * len * 0.55 + 4], tip], 9, 3), { ...SKIN, w: 3, edge: 0.4, angle: a }, [2, 4, 3, 0.35]);
      piece(p, p.limb([[tip[0] - dx * 9, tip[1] - dy * 9 - 4], [tip[0] + dx * 3, tip[1] + dy * 3]], 5, 1.5), { rgb: RED, tone: 0.4, w: 2, alpha: 0.95, edge: 0 }, [1, 2, 2, 0.4]);
      pins.push([cx + dx * 12, cy + dy * 12, 3]);
    }
  };
  piece(p, p.limb([[336, 392], [290, 476], [246, 512]], 32, 26), { ...DRESS, tone: 0.3 });
  piece(p, p.limb([[246, 512], [206, 506], [170, 500]], 26, 20), { ...DRESS, tone: 0.3, angle: Math.PI });
  pins.push([336, 394, 7.5], [246, 512, 6.5]);
  piece(p, p.limb([[172, 490], [94, 456]], 11, 9), { rgb: RED, tone: 0.4, w: 4, alpha: 0.95, edge: 0.3, angle: 0.5 }, [3, 4, 4, 0.4]);
  piece(p, p.limb([[96, 457], [80, 450]], 7, 2), { tone: 0.15, w: 2, edge: 0 }, [1, 2, 2, 0.4]);
  claw(164, 500, [-2.7, -2.25, -1.85, 2.6], 48);

  // head: big, low, thrust out ahead of her
  const head = blob(p, 204, 270, 80, 92, 16, 0.05);
  piece(p, head, { ...SKIN, tone: 0.8, angle: Math.PI / 2 }, [10, 14, 12, 0.4]);
  // hair scraped back into a bun, pencils stabbed through it
  piece(p, [[132, 222], [150, 190], [196, 172], [244, 178], [282, 206], [290, 252], [262, 226], [226, 210], [184, 212], [150, 230]], { tone: sp.hairTone, w: 6, vary: 0.06, angle: 0.2, sheen: 0.3, edgeTone: 0.3 }, [4, 6, 6, 0.4]);
  for (let k = 0; k < 8; k++) p.brush([[150 + k * 16, 214 - k * 3], [210 + k * 10, 190 + k * 2]], { w: 1.4, tone: 0.3, bristles: 1, body: false });
  if (sp.hair === 'bun') {
  piece(p, p.limb([[322, 108], [298, 170], [286, 216]], 9, 9), { rgb: RED, tone: 0.4, w: 3, alpha: 0.95, edge: 0.2 }, [3, 4, 4, 0.4]);
  piece(p, scallop(p, 300, 188, 50, 46, 26, 10), { tone: sp.hairTone - 0.02, w: 5, vary: 0.06, angJit: Math.PI, curve: 0.8, sheen: 0.3, edgeTone: 0.3 }, [6, 8, 8, 0.4]);
  for (let k = 0; k < 4; k++) {
    const pts = []; for (let a = 0; a < 5.5; a += 0.5) pts.push([300 + Math.cos(a + k) * (8 + a * 6.4), 188 + Math.sin(a + k) * (8 + a * 6)]);
    p.brush(pts, { w: 2, tone: 0.26, bristles: 2, body: false, taper: 0.5 });
  }
  piece(p, p.limb([[360, 140], [306, 194], [266, 232]], 9, 9), { tone: 0.74, w: 3, edge: 0.2 }, [3, 4, 4, 0.4]);
  pins.push([300, 188, 6]);
  }
  // the hooked nose
  piece(p, [[170, 250], [134, 262], [98, 290], [88, 314], [110, 310], [134, 296], [166, 286]], { ...SKIN, tone: 0.74, w: 4, angle: 2.6 }, [4, 6, 6, 0.4]);
  if (sp.eyes === 'monocle') {
    // eyes: a squint, and one wide behind a monocle on a chain
    piece(p, [[166, 236], [190, 228], [200, 240], [168, 244]], { ...DARK, tone: 0.06, w: 3 }, [1, 2, 2, 0.3]);
    p.brush([[160, 226], [196, 216]], { w: 4, tone: 0.2, bristles: 3, body: false });
    piece(p, ellipse(232, 236, 20, 20, 14), { ...PALE, tone: 0.96 }, [2, 3, 3, 0.4]);
    c.save(); c.lineWidth = 3; c.strokeStyle = 'rgba(16,14,12,0.9)'; c.beginPath(); c.arc(232, 236, 22, 0, Math.PI * 2); c.stroke(); c.restore();
    p.brush([[250, 250], [262, 300], [262, 352]], { w: 1.4, tone: 0.3, bristles: 1, body: false, dry: 0.5 });
    pins.push([230, 238, 5.5]);
  } else if (sp.eyes === 'glasses') {
    // small round spectacles, the lenses gone milky, a pin for each pupil
    for (const x of [180, 232]) { piece(p, ellipse(x, 238, 17, 15, 14), { ...PALE, tone: 0.86 }, [2, 3, 3, 0.4]); pins.push([x + 2, 240, 4]); }
    c.save(); c.lineWidth = 3; c.strokeStyle = 'rgba(16,14,12,0.9)';
    for (const x of [180, 232]) { c.beginPath(); c.arc(x, 238, 19, 0, Math.PI * 2); c.stroke(); }
    c.beginPath(); c.moveTo(199, 236); c.lineTo(213, 236); c.stroke(); c.restore();
  } else {
    // no eyes at all: two holes punched clean through the paper
    for (const x of [178, 230]) piece(p, ellipse(x, 238, 11, 12, 12), { tone: 0.0, w: 3, edge: 0 }, [0, 0, 1, 0]);
  }
  if (sp.mouth === 'stitched') {
    // the mouth sewn shut with black thread
    p.brush([[128, 334], [190, 340], [252, 326]], { w: 4, tone: 0.1, bristles: 2, body: false });
    for (let k = 0; k < 9; k++) { const x = 136 + k * 14; p.brush([[x - 4, 324 + Math.sin(k) * 2], [x + 4, 348 - Math.sin(k) * 2]], { w: 2.4, tone: 0.04, bristles: 1, body: false, taper: 0 }); }
  } else if (sp.mouth === 'smile') {
    // a thin closed smile, too wide, painted on in red
    p.brush([[110, 318], [150, 338], [200, 344], [248, 330], [270, 304]], { w: 5, rgb: RED, alpha: 0.95, bristles: 3, body: true, taper: 0.6 });
  }
  if (sp.mouth === 'wide') {
  // the mouth: open far too wide, lined in red, two rows of sharp teeth
  const mouth = [[120, 318], [160, 316], [204, 322], [248, 306], [262, 316], [246, 350], [210, 372], [168, 374], [136, 356]];
  piece(p, mouth, { tone: 0.04, w: 4, vary: 0.02, edge: 0.6, edgeTone: 0.02 }, [2, 3, 3, 0.4]);
  const tri = (x, y, w, h) => { const t = new Path2D(); t.moveTo(x - w / 2, y); t.lineTo(x + w / 2, y); t.lineTo(x + p.rand(-1.5, 1.5), y + h); t.closePath(); cut(p, t, p.grey(0.92), [1, 1.5, 1, 0.5]); };
  for (let i = 0; i < 12; i++) { const t = i / 11, x = 130 + t * 120, y = 318 + Math.sin(t * Math.PI) * 4 - t * 6; tri(x, y, 10, p.rand(12, 20)); }
  for (let i = 0; i < 10; i++) { const t = i / 9, x = 146 + t * 92, y = 368 - Math.sin(t * Math.PI) * 2 - t * 14; tri(x, y, 10, -p.rand(10, 16)); }
  p.ctx.save(); p.ctx.strokeStyle = 'rgba(176,22,30,0.85)'; p.ctx.lineWidth = 3; p.ctx.beginPath();
  mouth.forEach(([x, y], i) => (i ? p.ctx.lineTo(x, y) : p.ctx.moveTo(x, y))); p.ctx.closePath(); p.ctx.stroke(); p.ctx.restore();
  staples.push([112, 312, 124, 326], [256, 300, 266, 316]);
  }

  // the front arm: raised, claws up, reaching for you
  piece(p, p.limb([[318, 380], [262, 436], [222, 446]], 32, 26), { ...DRESS, tone: 0.32 });
  piece(p, p.limb([[222, 446], [160, 420], [118, 398]], 26, 20), { ...DRESS, tone: 0.32, angle: -2.6 });
  pins.push([318, 382, 7.5], [222, 446, 6.5]);
  claw(108, 392, [-2.75, -2.35, -1.95, -1.55], 60);

  for (const s of staples) p.staple(...s);
  for (const [x, y, r] of pins) p.pin(x, y, r);
}

// ---------------------------------------------------------------------------
// A STUDENT: a small paper child, head too big, one eye too big, a pointed nose, a fixed grin.
// The head hangs on one split pin at the neck: snap = how far it has dropped.
function student(p, snap = 0) {
  const JUMPER = { tone: 0.36, vary: 0.05, w: 8, sheen: 0.2, sheenTone: 0.48, edgeTone: 0.26 };
  const pins = [], staples = [];
  p.shadow(ellipse(210, 640, 118, 13), 0, 0, 10, 0.4);
  // legs, socks, shoes
  for (const [top, foot, s] of [[[182, 500], [178, 606], -1], [[238, 500], [242, 606], 1]]) {
    piece(p, p.limb([top, [top[0] + s * 2, 560]], 24, 20), { ...SKIN, tone: 0.8 });
    piece(p, p.limb([[top[0] + s * 2, 556], foot], 22, 22), { ...PALE, tone: 0.9, w: 4 }, [3, 5, 4, 0.35]);
    piece(p, blob(p, foot[0] + s * 8, 616, 24, 11, 10, 0.1), { ...DARK, tone: 0.07, angle: 0 });
  }
  // shorts
  piece(p, [[148, 436], [272, 436], [282, 518], [226, 522], [210, 488], [194, 522], [138, 518]], { ...DARK, tone: 0.2, w: 7 });
  pins.push([182, 500, 6], [238, 500, 6]);
  // arms hang: a paper in one hand, a pencil in the other
  piece(p, p.limb([[152, 318], [134, 390], [124, 448]], 30, 24), JUMPER);
  piece(p, p.limb([[268, 318], [286, 390], [296, 446]], 30, 24), JUMPER);
  piece(p, [[86, 450], [140, 446], [146, 520], [92, 526]], { ...PALE, tone: 0.95, w: 3, angle: 0 }, [3, 4, 4, 0.35]);
  for (let k = 0; k < 5; k++) p.brush([[96, 462 + k * 11], [p.rand(118, 136), 462 + k * 11 + p.rand(-2, 2)]], { w: 1.4, tone: 0.35, bristles: 1, body: false, dry: 0.3 });
  piece(p, blob(p, 124, 460, 15, 15, 9, 0.12), SKIN);
  piece(p, blob(p, 298, 458, 15, 15, 9, 0.12), SKIN);
  piece(p, p.limb([[290, 440], [322, 494]], 7, 6), { tone: 0.62, w: 2, edge: 0 }, [2, 3, 3, 0.4]);
  pins.push([152, 320, 6.5], [268, 320, 6.5]);
  // jumper with a shirt collar and a star badge
  const torso = [[156, 298], [264, 298], [284, 330], [278, 452], [142, 452], [136, 330]];
  piece(p, torso, JUMPER, [8, 10, 10, 0.35]);
  piece(p, [[186, 300], [210, 334], [234, 300], [222, 296], [210, 312], [198, 296]], { ...PALE, tone: 0.9, w: 3 }, [2, 3, 3, 0.4]);
  piece(p, [[238, 352], [262, 352], [260, 378], [250, 386], [240, 378]], { ...PALE, tone: 0.82, w: 3 }, [2, 3, 3, 0.3]);
  goldStar(p, 250, 366, 7, -Math.PI / 2, [1, 1.5, 1.5, 0.4]);

  // a paper crease where the neck folds over when snapped
  if (snap > 0.3) {
    piece(p, p.limb([[210, 296], [210, 318]], 30, 26), { ...SKIN, tone: 0.7 });
    p.brush([[196, 300], [224, 306]], { w: 2, tone: 0.12, bristles: 2, body: false });
  }
  about(p, 210, 296, snap, () => {
    piece(p, p.limb([[210, 270], [210, 300]], 32, 28), { ...SKIN, tone: 0.76 });
    // ears, head, hair cap and two stapled tufts
    piece(p, blob(p, 122, 186, 16, 24, 8, 0.1), SKIN, [3, 4, 4, 0.3]);
    piece(p, blob(p, 298, 186, 16, 24, 8, 0.1), SKIN, [3, 4, 4, 0.3]);
    piece(p, blob(p, 210, 182, 92, 100, 16, 0.05), { ...SKIN, angle: Math.PI / 2 }, [8, 12, 10, 0.38]);
    piece(p, [[124, 160], [132, 112], [170, 84], [214, 76], [258, 86], [290, 118], [298, 160], [270, 132], [246, 146], [232, 124], [204, 140], [184, 120], [160, 146]], { ...DARK, tone: 0.16, w: 6 }, [4, 6, 6, 0.4]);
    piece(p, p.limb([[186, 88], [176, 58], [158, 34]], 12, 5), { ...DARK, tone: 0.14, w: 3 }, [3, 4, 4, 0.4]);
    piece(p, p.limb([[232, 86], [246, 56], [268, 38]], 12, 5), { ...DARK, tone: 0.14, w: 3 }, [3, 4, 4, 0.4]);
    staples.push([178, 96, 194, 86], [226, 88, 242, 98]);
    // eyes: one too big, one a pin
    piece(p, ellipse(174, 176, 26, 30, 14), PALE, [2, 3, 3, 0.45]);
    p.brush([[178, 186], [179, 188]], { w: 9, tone: 0.05, taper: 0 });
    piece(p, ellipse(246, 172, 13, 13, 10), PALE, [2, 3, 3, 0.45]);
    p.brush([[150, 206], [174, 212], [198, 206]], { w: 3, tone: 0.55, bristles: 2, body: false, dry: 0.3 });
    // pointed nose
    piece(p, [[206, 190], [238, 216], [204, 220]], { ...SKIN, tone: 0.76, w: 3 }, [3, 4, 4, 0.4]);
    // the grin
    piece(p, [[146, 230], [180, 244], [240, 242], [276, 224], [268, 248], [240, 266], [184, 268], [154, 252]], PALE, [2, 3, 3, 0.5]);
    teeth(p, 156, 266, (t) => 240 + Math.abs(t - 0.5) * -10, (t) => 262 - Math.abs(t - 0.5) * 14, 11, { w: 1.8 });
    p.brush([[152, 246], [210, 258], [270, 238]], { w: 1.6, tone: 0.1, bristles: 2, body: false });
    staples.push([140, 224, 152, 240], [272, 218, 278, 236]);
    // head pins and staples are drawn inside the rotation so they turn with it
    for (const s of staples.splice(0)) p.staple(...s);
    for (const [x, y, r] of [[246, 174, 5], [122, 186, 4], [298, 186, 4]]) p.pin(x, y, r);
  });
  pins.push([210, 296, 7]);
  for (const [x, y, r] of pins) p.pin(x, y, r);
}

// ---------------------------------------------------------------------------
// THE BULLY: round, curls like a storm cloud, square eyes taped on, a jagged grin.
// His notebook is full of drawings of you.
function bully(p) {
  const JUMPER = { tone: 0.5, vary: 0.05, w: 10, sheen: 0.2, sheenTone: 0.62, edgeTone: 0.36, angJit: 0.3 };
  const pins = [], staples = [];
  p.shadow(ellipse(300, 782, 170, 16), 0, 0, 12, 0.4);
  for (const [top, foot, s] of [[[254, 612], [248, 724], -1], [[346, 612], [354, 724], 1]]) {
    piece(p, p.limb([top, [top[0], 668]], 46, 42), { ...SKIN, tone: 0.8 });
    piece(p, p.limb([[top[0] + s, 664], foot], 44, 44), { ...PALE, tone: 0.9, w: 4 }, [3, 5, 4, 0.35]);
    for (const y of [680, 700]) p.brush([[top[0] - 20, y], [top[0] + 22, y + 2]], { w: 5, tone: 0.2, bristles: 3, body: false });
    piece(p, blob(p, foot[0] + s * 10, 746, 36, 16, 10, 0.1), { ...DARK, tone: 0.07, angle: 0 });
    pins.push([...top, 7]);
  }
  piece(p, [[196, 570], [404, 570], [414, 652], [312, 660], [300, 624], [288, 660], [186, 652]], { ...DARK, tone: 0.22, w: 8 });
  // the round body
  piece(p, blob(p, 300, 462, 152, 160, 18, 0.04), { ...JUMPER, angle: Math.PI / 2 }, [14, 18, 16, 0.36]);
  for (let i = 0; i < 9; i++) p.brush([[200 + i * 25, 340 + Math.abs(i - 4) * 14], [200 + i * 25, 590 - Math.abs(i - 4) * 10]], { w: 3, tone: 0.42, bristles: 2, body: false, alpha: 0.5, dry: 0.4 });
  for (const y of [392, 456, 520]) { piece(p, ellipse(300, y, 13, 13, 10), { ...PALE, tone: 0.8, w: 3 }, [2, 3, 3, 0.4]); pins.push([300, y, 6]); }
  // small arm with a fist
  piece(p, p.limb([[420, 380], [458, 420], [474, 452]], 40, 34), JUMPER);
  piece(p, blob(p, 480, 470, 24, 24, 10, 0.12), SKIN);
  pins.push([420, 382, 8]);
  // the other arm holds the notebook: a crayon drawing of a small boy, scribbled over
  piece(p, p.limb([[180, 380], [184, 450], [190, 500]], 40, 34), JUMPER);
  const nb = densify([[66, 432], [194, 446], [186, 588], [58, 574]], 6);
  piece(p, nb, { ...PALE, tone: 0.9, w: 4, angle: 0.1 }, [8, 10, 10, 0.4]);
  for (let k = 0; k < 8; k++) p.brush([[70, 446 + k * 17], [188, 458 + k * 17]], { w: 1, tone: 0.6, bristles: 1, body: false, alpha: 0.5 });
  crayon(p, [[124, 474], [124, 476]], CRAYON[2], 14);
  crayon(p, [[124, 488], [124, 520]], CRAYON[2], 4);
  crayon(p, [[124, 520], [112, 548]], CRAYON[2], 4); crayon(p, [[124, 520], [136, 548]], CRAYON[2], 4);
  crayon(p, [[124, 496], [106, 508]], CRAYON[2], 4); crayon(p, [[124, 496], [142, 508]], CRAYON[2], 4);
  for (let k = 0; k < 7; k++) crayon(p, [[100 + p.rand(0, 10), 462 + k * 6], [150 + p.rand(0, 10), 470 + k * 6]], CRAYON[0], 3, 0.7);
  piece(p, blob(p, 192, 516, 22, 20, 10, 0.12), SKIN);
  pins.push([180, 382, 8]);
  staples.push([64, 440, 76, 428]);
  // head: big, pinned on
  piece(p, blob(p, 188, 226, 18, 26, 8, 0.1), SKIN, [3, 4, 4, 0.3]);
  piece(p, blob(p, 412, 226, 18, 26, 8, 0.1), SKIN, [3, 4, 4, 0.3]);
  piece(p, blob(p, 300, 222, 112, 104, 18, 0.04), { ...SKIN, angle: Math.PI / 2 }, [10, 14, 12, 0.38]);
  pins.push([188, 228, 4.5], [412, 228, 4.5]);
  // the curls: a storm of scalloped paper
  for (let i = 0; i < 26; i++) {
    const a = Math.PI * (1.02 + (i / 25) * 0.96), r = p.rand(96, 118);
    const x = 300 + Math.cos(a) * r * 1.08, y = 196 + Math.sin(a) * r * 0.9;
    const s = p.rand(22, 34);
    piece(p, scallop(p, x, y, s, s * 0.9, 18, 6), { tone: 0.14 + p.rand(0, 0.06), w: 4, angJit: Math.PI, curve: 0.8, edgeTone: 0.08 }, [3, 5, 5, 0.4]);
    const sp = []; for (let a2 = 0; a2 < 5; a2 += 0.6) sp.push([x + Math.cos(a2) * a2 * 3, y + Math.sin(a2) * a2 * 3]);
    p.brush(sp, { w: 1.5, tone: 0.32, bristles: 1, body: false });
  }
  // square eyes taped on, angry brows
  for (const [x, rot] of [[254, -0.12], [346, 0.1]]) {
    p.ctx.save(); p.ctx.translate(x, 214); p.ctx.rotate(rot);
    piece(p, [[-26, -22], [26, -22], [26, 22], [-26, 22]], { ...PALE, tone: 0.96, angle: 0 }, [2, 3, 3, 0.45]);
    p.ctx.fillStyle = 'rgba(230,226,214,0.55)'; p.ctx.fillRect(-34, -8, 68, 12);
    p.ctx.restore();
    pins.push([x + (x < 300 ? 6 : -6), 218, 6]);
  }
  piece(p, [[218, 172], [290, 194], [286, 206], [216, 186]], { ...DARK, tone: 0.08, w: 4 }, [2, 3, 3, 0.4]);
  piece(p, [[382, 172], [310, 194], [314, 206], [384, 186]], { ...DARK, tone: 0.08, w: 4 }, [2, 3, 3, 0.4]);
  // jagged grin
  const mouth = [[222, 262], [262, 272], [300, 270], [338, 272], [380, 260], [372, 290], [340, 306], [300, 312], [260, 306], [228, 290]];
  piece(p, mouth, PALE, [2, 3, 3, 0.5]);
  const zig = []; for (let i = 0; i <= 14; i++) zig.push([230 + i * 10.5, 286 + (i % 2 ? -12 : 10) - Math.abs(i - 7) * 0.5]);
  p.brush(zig, { w: 4, tone: 0.06, bristles: 3, body: false, taper: 0.2, steps: 2 });
  for (let i = 0; i < 9; i++) p.brush([[262 + p.rand(-30, 70), 240 + p.rand(-8, 8)], [263 + p.rand(-30, 70), 241]], { w: 3, tone: 0.55, bristles: 2, body: false });
  staples.push([216, 256, 226, 272], [376, 254, 384, 270]);
  pins.push([300, 326, 8]);
  for (const s of staples) p.staple(...s);
  for (const [x, y, r] of pins) p.pin(x, y, r);
}

// ---------------------------------------------------------------------------
// THE ROCKING HORSE: painted toy, red saddle, a mouth full of teeth on a pinned jaw.
// When it stops rocking, it's something else.
function horse(p) {
  const WOOD = { tone: 0.66, vary: 0.05, w: 9, sheen: 0.25, sheenTone: 0.78, edgeTone: 0.5, angle: 0.1 };
  const pins = [], staples = [];
  const rocker = (dx, dy, tone) => {
    const pts = []; for (let x = 100; x <= 780; x += 40) { const t = (x - 440) / 340; pts.push([x + dx, 556 + dy + 44 * (1 - t * t) - (Math.abs(t) > 0.92 ? (Math.abs(t) - 0.92) * 300 : 0)]); }
    piece(p, p.limb(pts, 26, 26), { tone, w: 8, angle: 0, vary: 0.05, sheen: 0.2, edgeTone: tone - 0.1 }, [6, 8, 8, 0.35]);
  };
  p.shadow(ellipse(440, 618, 330, 14), 0, 0, 12, 0.4);
  rocker(26, -14, 0.22);
  // far legs
  piece(p, p.limb([[300, 332], [282, 470], [268, 560]], 36, 26), { ...WOOD, tone: 0.5 });
  piece(p, p.limb([[580, 332], [604, 470], [618, 560]], 36, 26), { ...WOOD, tone: 0.5 });
  // tail: stapled paper strips
  for (let i = 0; i < 7; i++) {
    const a = p.rand(-0.3, 0.6);
    piece(p, p.limb([[632, 262], [668 + Math.cos(a) * 30, 300 + i * 6], [690 + Math.cos(a) * 40, 420 + i * 12]], 12, 6), { ...DARK, tone: 0.16, w: 4, edge: 0.3 }, [3, 5, 5, 0.35]);
  }
  staples.push([624, 254, 640, 270]);
  // body: barrel with dapples, a red saddle
  piece(p, blob(p, 450, 300, 210, 86, 18, 0.04), WOOD, [12, 14, 14, 0.35]);
  for (let i = 0; i < 16; i++) piece(p, blob(p, p.rand(300, 610), p.rand(262, 360), p.rand(8, 16), p.rand(6, 11), 8, 0.2), { tone: 0.46, w: 4, edge: 0, alpha: 0.7 }, [0, 0, 1, 0]);
  piece(p, [[392, 226], [508, 222], [522, 270], [380, 276]], { rgb: RED, tone: 0.4, w: 6, alpha: 0.95, angle: 0, sheen: 0.2, sheenTone: 0.6 }, [4, 6, 6, 0.4]);
  piece(p, p.limb([[450, 270], [452, 360]], 12, 12), { ...DARK, tone: 0.2, w: 4 });
  piece(p, p.limb([[452, 360], [446, 392]], 4, 4), { tone: 0.3, w: 2, edge: 0 });
  piece(p, [[432, 392], [462, 392], [458, 404], [436, 404]], { tone: 0.3, w: 3, edge: 0 });
  staples.push([396, 236, 408, 252], [500, 232, 512, 248]);
  // near legs + rocker
  piece(p, p.limb([[330, 340], [320, 470], [310, 566]], 40, 28), WOOD);
  piece(p, p.limb([[560, 340], [574, 470], [584, 566]], 40, 28), WOOD);
  rocker(0, 0, 0.3);
  for (const x of [310, 584]) piece(p, blob(p, x, 562, 20, 10, 8, 0.1), { ...DARK, tone: 0.12, angle: 0 });
  pins.push([330, 342, 8], [560, 342, 8], [310, 560, 5], [584, 560, 5]);
  // neck and head, the handle peg through it
  piece(p, [[300, 240], [262, 156], [232, 112], [270, 96], [318, 150], [372, 230], [364, 300], [310, 310]], WOOD, [10, 12, 12, 0.35]);
  for (let i = 0; i < 9; i++) {
    const t = i / 8, x = 262 + t * 104, y = 108 + t * 120;
    piece(p, p.limb([[x + 6, y - 6], [x + 30, y + 6 + p.rand(-6, 6)], [x + 44 + p.rand(0, 16), y + 34]], 13, 6), { ...DARK, tone: 0.14, w: 4, edge: 0.3 }, [3, 5, 5, 0.35]);
    if (i % 3 === 1) staples.push([x - 2, y - 2, x + 12, y + 8]);
  }
  const head = [[236, 106], [196, 106], [140, 128], [96, 162], [82, 196], [104, 212], [150, 206], [202, 196], [262, 176], [282, 136]];
  piece(p, head, { ...WOOD, angle: 2.8 }, [10, 12, 12, 0.38]);
  piece(p, [[226, 98], [238, 52], [256, 104]], { ...WOOD, tone: 0.6 }, [3, 5, 5, 0.35]);
  piece(p, [[248, 104], [270, 62], [276, 116]], { ...WOOD, tone: 0.56 }, [3, 5, 5, 0.35]);
  // the open mouth: dark inside, pale teeth top and bottom, lower jaw pinned
  piece(p, [[92, 186], [160, 176], [196, 196], [150, 222], [100, 218]], { ...DARK, tone: 0.05, w: 4 }, [1, 2, 2, 0.3]);
  teeth(p, 98, 182, (t) => 184 - t * 2, (t) => 196 - t * 2, 9, { sharp: true, tone: 0.92, w: 2 });
  piece(p, [[96, 216], [150, 224], [200, 200], [196, 214], [150, 240], [98, 232]], { ...WOOD, tone: 0.62, angle: 0.2 }, [4, 6, 6, 0.4]);
  teeth(p, 104, 190, (t) => 214 - t * 10, (t) => 202 - t * 10, 9, { sharp: true, tone: 0.92, w: 2 });
  pins.push([196, 206, 5]);
  // eye: a painted ring with a split pin
  piece(p, ellipse(206, 140, 14, 12, 10), { ...PALE, tone: 0.95 }, [2, 3, 3, 0.4]);
  p.brush([[192, 128], [206, 124], [222, 132]], { w: 2.5, tone: 0.1, bristles: 2, body: false });
  pins.push([208, 142, 5.5], [300, 260, 9]);
  for (const s of staples) p.staple(...s);
  for (const [x, y, r] of pins) p.pin(x, y, r);
}

// ---------------------------------------------------------------------------
// OBJECTS
function stars(p) {
  goldStar(p, 120, 128, 74, -Math.PI / 2 + 0.12, [6, 9, 8, 0.4]);
  goldStar(p, 252, 92, 40, -0.4, [4, 6, 6, 0.4]);
  goldStar(p, 244, 212, 46, 0.5, [4, 6, 6, 0.4]);
  p.pin(244, 212, 6);
}

function hallPass(p) {
  const c = p.ctx;
  // string loop, then the card
  c.save(); c.strokeStyle = 'rgba(40,36,30,0.8)'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(150, 92); c.bezierCurveTo(120, 10, 300, 10, 270, 92); c.stroke(); c.restore();
  const card = densify([[60, 90], [360, 82], [368, 270], [66, 282]], 6);
  piece(p, card, { ...PALE, tone: 0.88, w: 5, angle: 0.03 }, [8, 10, 10, 0.4]);
  p.brush([[80, 132], [348, 124]], { w: 2, tone: 0.3, bristles: 2, body: false });
  label(p, 'HALL PASS', 212, 112, { size: 30, rot: -0.025, col: 'rgba(32,30,28,0.92)' });
  label(p, 'Pupil:', 92, 168, { size: 17, rot: -0.025, align: 'left', weight: 'normal' });
  label(p, 'Time:', 92, 206, { size: 17, rot: -0.025, align: 'left', weight: 'normal' });
  label(p, 'Signed:', 92, 244, { size: 17, rot: -0.025, align: 'left', weight: 'normal' });
  crayon(p, [[156, 170], [196, 162], [230, 172], [268, 160]], [40, 40, 44], 2.2, 0.8);
  label(p, '3:29', 156, 206, { size: 18, rot: -0.025, align: 'left', weight: 'normal', font: 'cursive', col: 'rgba(40,40,44,0.85)' });
  crayon(p, [[176, 244], [200, 232], [214, 250], [236, 236], [260, 248], [300, 236]], RED, 2.4, 0.9);
  // a red stamp: SEEN
  c.save(); c.translate(300, 196); c.rotate(-0.3);
  c.strokeStyle = 'rgba(178,24,30,0.78)'; c.lineWidth = 4; c.beginPath(); c.arc(0, 0, 40, 0, Math.PI * 2); c.stroke();
  c.lineWidth = 1.5; c.beginPath(); c.arc(0, 0, 33, 0, Math.PI * 2); c.stroke();
  c.restore();
  label(p, 'SEEN', 300, 196, { size: 20, rot: -0.3, col: 'rgba(178,24,30,0.8)' });
  p.pin(150, 96, 6); p.pin(270, 92, 6);
}

// the morbid drawing pinned to a door: children holding hands outside a building, a tall figure
// with yellow stars, black smoke, and one small blue figure off to the side, alone
function drawing(p) {
  const sheet = densify([[30, 34], [492, 22], [500, 372], [40, 386]], 6);
  piece(p, sheet, { ...PALE, tone: 0.93, w: 6, angle: 0 }, [8, 10, 10, 0.35]);
  const [R, Y, B, G, P] = CRAYON, K = [26, 24, 24], S = [76, 72, 68];
  const seg = (pts, col, w) => { for (let i = 0; i < pts.length - 1; i++) crayon(p, [pts[i], pts[i + 1]], col, w); };
  // the school: walls, roof, four windows, a door
  seg([[236, 330], [236, 168], [334, 104], [432, 168], [432, 330], [236, 330]], S, 7);
  for (const [x, y] of [[262, 192], [370, 192], [262, 254], [370, 254]]) seg([[x, y], [x + 38, y], [x + 38, y + 36], [x, y + 36], [x, y]], S, 5);
  // fire in every window
  for (const [x, y] of [[262, 192], [370, 192], [262, 254], [370, 254]]) for (let k = 0; k < 7; k++) crayon(p, [[x + 5, y + 32 - k * 4.5], [x + 33, y + 30 - k * 4.5 + p.rand(-5, 2)]], k % 2 ? Y : R, 5, 0.9);
  // the door scribbled shut, black
  seg([[316, 330], [316, 270], [352, 270], [352, 330]], S, 6);
  for (let k = 0; k < 9; k++) crayon(p, [[316, 272 + k * 6.5], [352, 276 + k * 6.5]], K, 5);
  // smoke boiling off the roof
  for (let k = 0; k < 22; k++) { const x = 300 + p.rand(-70, 110); crayon(p, [[x, 112], [x + p.rand(-30, 30), 72], [x + p.rand(-50, 50), 36]], K, 8, 0.55); }
  // the line of children holding hands, every face scribbled out
  for (let i = 0; i < 6; i++) {
    const x = 62 + i * 30, col = [R, Y, G, P, R, G][i];
    crayon(p, [[x, 266], [x, 268]], col, 20);
    seg([[x, 276], [x, 310]], col, 6); seg([[x, 310], [x - 8, 338]], col, 5); seg([[x, 310], [x + 8, 338]], col, 5);
    seg([[x - 15, 288], [x + 15, 288]], col, 5);
    for (let k = 0; k < 5; k++) crayon(p, [[x - 9, 259 + k * 3.5], [x + 9, 263 + k * 3.5]], K, 3.5);
  }
  // the tall man with stars down his coat, a tall hat, a raised fist
  crayon(p, [[212, 110], [212, 112]], K, 24);
  seg([[212, 124], [212, 262]], K, 16);
  seg([[212, 262], [198, 336]], K, 6); seg([[212, 262], [226, 336]], K, 6);
  seg([[212, 150], [236, 120], [242, 96]], K, 5);
  seg([[200, 98], [224, 98], [222, 62], [202, 62], [200, 98]], K, 6);
  for (let k = 0; k < 7; k++) crayon(p, [[206 + p.rand(-2, 8), 140 + k * 17], [208 + p.rand(-2, 8), 142 + k * 17]], Y, 9);
  // and the boy, small, far off to the right, blue
  crayon(p, [[462, 306], [462, 308]], B, 15);
  seg([[462, 314], [462, 338]], B, 5); seg([[462, 338], [455, 356]], B, 4.5); seg([[462, 338], [469, 356]], B, 4.5);
  seg([[452, 322], [472, 322]], B, 4.5);
  label(p, 'me', 462, 280, { size: 22, font: 'cursive', weight: 'normal', col: 'rgba(38,92,205,0.9)' });
  p.pin(262, 34, 7);
  p.staple(40, 372, 58, 360);
}

// ---------------------------------------------------------------------------
// THE HALLWAY (mood frame), drawn the way the game would: every surface is a painted paper texture,
// mapped into one-point perspective a screen column (walls) or row (floor, ceiling) at a time,
// like Doom, then lit by the ceiling tubes. The lights have died one by one toward you. Far down,
// under the one tube still on, the Headmaster is standing. Someone is behind a door's window.
// Someone is in a locker.

// straight edges stay straight under the Catmull-Rom smoothing if they carry enough points
function densify(poly, n = 6) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
}
const rectP = (x0, y0, x1, y1, n = 6) => densify([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], n);

function texCanvas(w, h, seed, fn) {
  // a DOM canvas on the page, an OffscreenCanvas in a painter worker
  const cv = typeof document !== 'undefined' ? Object.assign(document.createElement('canvas'), { width: w, height: h }) : new OffscreenCanvas(w, h);
  const ctx = cv.getContext('2d', { willReadFrequently: true }); // CPU raster: faster for brush strokes, and a cheap texture upload
  fn(new Painter(ctx, seed), ctx);
  return cv;
}

const PPM = 128; // texture pixels per metre
const HW = 1.7, FL = -1.45, CE = 1.4; // half-width, floor and ceiling relative to the eye

// a wall: two stapled paper sheets above, a dark dado below, rail and skirting
function wallTexture(seed, lockers) {
  return texCanvas(512, 365, seed, (p, c) => {
    c.fillStyle = p.grey(0.34); c.fillRect(0, 0, 512, 365);
    for (const x0 of [-8, 248]) {
      const poly = rectP(x0, -6, x0 + 272, 186);
      p.shadow(poly, 4, 5, 6, 0.4);
      p.fill(poly, { tone: 0.52 + p.rand(-0.04, 0.03), w: 16, angle: 0.04, angJit: 0.12, vary: 0.06, len: [0.12, 0.32], sheen: 0.2, sheenTone: 0.62, edge: 0 });
      p.paperEdge(poly, 0.52);
      p.staple(x0 + 16, 16, x0 + 32, 12); p.staple(x0 + 236, 168, x0 + 252, 174);
      for (let k = 0; k < 3; k++) { const y = p.rand(30, 170), x = x0 + p.rand(20, 250); p.brush([[x, y], [x + p.rand(20, 60), y + p.rand(-4, 30)]], { w: p.rand(6, 16), tone: 0.42, alpha: 0.25, body: false, dry: 0.4 }); }
    }
    p.fill(rectP(-6, 190, 518, 354), { tone: 0.3, w: 12, angle: Math.PI / 2, angJit: 0.08, vary: 0.05, len: [0.08, 0.2], sheen: 0.15, edge: 0 });
    for (let x = 64; x < 512; x += 128) p.brush([[x, 194], [x, 350]], { w: 3, tone: 0.18, bristles: 2, body: false, alpha: 0.6 });
    p.fill(rectP(-6, 178, 518, 196), { tone: 0.2, w: 6, angle: 0, angJit: 0.05, edge: 0 });
    p.fill(rectP(-6, 350, 518, 370), { tone: 0.12, w: 6, angle: 0, angJit: 0.05, edge: 0 });
    if (!lockers) return;
    // a bank of paper lockers, each its own cut piece: vents, a number tag, a handle, a pin at the top
    for (let i = 0; i < 8; i++) {
      const x = i * 64;
      const poly = rectP(x + 3, 110, x + 61, 358, 8);
      p.shadow(poly, 3, 3, 4, 0.5);
      p.fill(poly, { tone: 0.4 + p.rand(-0.04, 0.04), w: 8, angle: Math.PI / 2, angJit: 0.06, vary: 0.05, len: [0.1, 0.3], sheen: 0.25, sheenTone: 0.55, edge: 0 });
      p.paperEdge(poly, 0.42);
      for (let v = 0; v < 4; v++) p.brush([[x + 16, 130 + v * 9], [x + 48, 130 + v * 9]], { w: 3.2, tone: 0.1, bristles: 2, body: false, taper: 0.3 });
      const tag = rectP(x + 22, 176, x + 42, 190, 3);
      p.fill(tag, { tone: 0.82, w: 3, edge: 0 }); p.paperEdge(tag, 0.8);
      c.fillStyle = 'rgba(30,28,26,0.8)'; c.font = 'bold 10px Georgia'; c.textAlign = 'center'; c.fillText(String(100 + ((seed * 7 + i * 13) % 90)), x + 32, 187);
      p.fill(rectP(x + 50, 236, x + 55, 262, 2), { tone: 0.72, w: 2, edge: 0 });
      p.pin(x + 32, 118, 3.5);
    }
  });
}

function floorTexture(seed) {
  // 3.4 m across x 2 m deep: grey paper tiles, each cut and laid slightly crooked
  return texCanvas(436, 256, seed, (p, c) => {
    c.fillStyle = p.grey(0.14); c.fillRect(0, 0, 436, 256);
    for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) {
      const x0 = k * 72.6, y0 = r * 64, j = () => p.rand(-2.5, 2.5);
      const poly = densify([[x0 + 2 + j(), y0 + 2 + j()], [x0 + 70 + j(), y0 + 2 + j()], [x0 + 70 + j(), y0 + 62 + j()], [x0 + 2 + j(), y0 + 62 + j()]], 4);
      const tone = (r + k) % 2 ? 0.4 : 0.3;
      p.shadow(poly, 2, 2, 2, 0.5);
      p.fill(poly, { tone: tone + p.rand(-0.03, 0.03), w: 9, angle: p.rand(0, Math.PI), angJit: 0.3, vary: 0.06, len: [0.15, 0.4], sheen: 0.2, edge: 0 });
      p.paperEdge(poly, tone);
    }
    for (let i = 0; i < 4; i++) { const x = p.rand(0, 436), y = p.rand(0, 256); p.brush([[x, y], [x + p.rand(-40, 40), y + p.rand(10, 40)]], { w: p.rand(3, 8), tone: 0.12, alpha: 0.4, body: false, dry: 0.5 }); }
  });
}

function ceilingTexture(seed) {
  return texCanvas(436, 256, seed, (p, c) => {
    c.fillStyle = p.grey(0.1); c.fillRect(0, 0, 436, 256);
    for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) {
      const x0 = k * 109, y0 = r * 85.3;
      const poly = rectP(x0 + 3, y0 + 3, x0 + 106, y0 + 82, 4);
      p.fill(poly, { tone: 0.27 + p.rand(-0.03, 0.03), w: 10, angle: p.rand(0, 3), angJit: 0.4, vary: 0.05, len: [0.2, 0.5], edge: 0 });
      p.paperEdge(poly, 0.27);
      for (let d = 0; d < 7; d++) p.brush([[x0 + p.rand(10, 96), y0 + p.rand(10, 74)], [x0 + p.rand(10, 96) + 1, y0 + p.rand(10, 74)]], { w: 2, tone: 0.16, bristles: 1, body: false });
    }
  });
}

// a classroom door with its frame (1.16 m x 2.25 m); optionally a face pressed to the glass
function doorTexture(seed, face, number) {
  return texCanvas(148, 288, seed, (p, c) => {
    c.fillStyle = p.grey(0.08); c.fillRect(0, 0, 148, 288);
    const door = rectP(10, 10, 138, 288, 6);
    p.shadow(door, 3, 3, 4, 0.5);
    p.fill(door, { tone: 0.36, w: 9, angle: Math.PI / 2, angJit: 0.05, vary: 0.05, len: [0.2, 0.5], sheen: 0.2, sheenTone: 0.48, edge: 0 });
    p.paperEdge(door, 0.36);
    const win = rectP(48, 46, 92, 120, 4);
    p.fill(win, { tone: 0.05, w: 6, angle: 0.8, angJit: 0.3, vary: 0.02, edge: 0 });
    p.paperEdge(win, 0.2);
    if (face) {
      c.save(); c.clip(p.pathOf(win).path);
      piece(p, blob(p, 70, 90, 20, 26, 14, 0.06), { ...SKIN, tone: 0.86, w: 3 }, [0, 0, 1, 0]);
      for (const ex of [-8, 7]) p.brush([[70 + ex, 84], [70 + ex, 86]], { w: 6, tone: 0.02, taper: 0 });
      p.fill([[56, 98], [70, 104], [84, 97], [80, 106], [70, 110], [60, 106]], { tone: 0.95, w: 2, edge: 0 });
      for (let t = 0; t < 7; t++) p.brush([[59 + t * 3.8, 100 + Math.abs(t - 3) * -0.6], [59 + t * 3.8, 106]], { w: 0.8, tone: 0.1, bristles: 1, body: false });
      for (const [x0, y0] of [[46, 92], [94, 92]]) piece(p, blob(p, x0, y0, 6, 9, 8, 0.2), { ...SKIN, tone: 0.8, w: 2 }, [0, 0, 1, 0]);
      c.restore();
    }
    const plate = rectP(46, 18, 94, 36, 3);
    p.fill(plate, { tone: 0.8, w: 3, edge: 0 }); p.paperEdge(plate, 0.78);
    c.fillStyle = 'rgba(30,28,26,0.85)'; c.font = 'bold 13px Georgia'; c.textAlign = 'center'; c.fillText(number, 70, 32);
    p.fill(rectP(14, 236, 134, 282, 4), { tone: 0.26, w: 6, angle: 0, edge: 0 });
    p.pin(118, 160, 6);
  });
}

function noticeTexture(seed) {
  return texCanvas(270, 124, seed, (p, c) => {
    const board = rectP(0, 0, 270, 124, 6);
    p.fill(board, { tone: 0.22, w: 8, angle: 0, angJit: Math.PI, vary: 0.06, len: [0.03, 0.08], minLen: 6, edge: 0 });
    p.paperEdge(board, 0.2);
    const notes = [[12, 12, 70, 52], [92, 8, 84, 56], [196, 14, 62, 48], [20, 66, 58, 50], [92, 70, 54, 46], [160, 66, 92, 52]];
    notes.forEach(([x, y, w, h], i) => {
      const poly = rectP(x, y, x + w, y + h, 3);
      p.shadow(poly, 2, 3, 2, 0.5);
      p.fill(poly, { tone: 0.84 - (i % 3) * 0.05, w: 4, angle: 0, edge: 0 });
      p.paperEdge(poly, 0.8);
      for (let k = 0; k < 4; k++) p.brush([[x + 6, y + 14 + k * 8], [x + w - 8 - p.rand(0, 20), y + 14 + k * 8]], { w: 1.2, tone: 0.4, bristles: 1, body: false, alpha: 0.6 });
      p.pin(x + w / 2, y + 4, 3);
    });
    c.fillStyle = 'rgba(30,28,26,0.9)'; c.font = 'bold 9px Georgia'; c.textAlign = 'center';
    c.fillText('END OF TERM', 134, 20); c.fillText('CONCERT', 134, 30);
    c.fillStyle = 'rgba(160,20,28,0.9)'; c.font = 'italic 7px Georgia'; c.fillText('doors will be locked', 134, 42);
  });
}

function photoTexture(seed, scratched) {
  return texCanvas(240, 150, seed, (p, c) => {
    const fr = rectP(0, 0, 240, 150, 6);
    p.fill(fr, { tone: 0.12, w: 6, angle: 0, edge: 0 });
    const ph = rectP(12, 12, 228, 138, 6);
    p.fill(ph, { tone: 0.6, w: 6, angle: 0, angJit: 0.2, edge: 0 });
    for (let r = 0; r < 3; r++) for (let k = 0; k < 7; k++) {
      const x = 32 + k * 29 + (r % 2) * 12, y = 46 + r * 32;
      p.brush([[x, y + 14], [x, y + 26]], { w: 16, tone: 0.3, bristles: 3, body: true, taper: 0.3 });
      p.brush([[x, y], [x, y + 1]], { w: 15, tone: 0.84, taper: 0 });
      if ((r * 7 + k + seed) % 4 < scratched) for (let s = 0; s < 4; s++) p.brush([[x - 8 + p.rand(-2, 2), y - 7 + s * 4], [x + 8, y - 5 + s * 4]], { w: 1.6, tone: 0.04, bristles: 1, body: false, taper: 0 });
    }
  });
}


export { headmaster, teacher, student, bully, horse, drawing, stars, hallPass, densify, rectP, texCanvas, wallTexture, floorTexture, ceilingTexture, doorTexture, noticeTexture, photoTexture, label, crayon, about, teeth, SKIN, PALE, DARK };
