// THE DRESSING ATLAS: everything that makes one corridor not the same as the last, painted once onto
// one sheet (8 x 5 cells of 256 px) so a whole chunk's dressing is a single draw call. Half of it is
// the ordinary furniture of a school (radiators, coats, signs, a clock), because wrongness needs a
// baseline (research/05 §1); the other half is the wrong: handprints, footprints that walk up the
// wall, a drawing pinned up forty times, lines written on the plaster, soot.
// Each cell says how big it is in the world (metres) and where it goes:
//   wall    flat on a wall, y0..y1 above the floor        floor  flat on the floor
//   stand   an upright card standing at the wall's foot   ceil   flat on the ceiling
import { rectP, densify, crayon, label, texCanvas, goldStar, CRAYON, RED } from './school.js';
import { blob, piece } from './designs.js';

export const CELL = 256, COLS = 8, ROWS = 5;

// name -> [cell index, place, width m, height m, y (wall: bottom edge above the floor)]
export const DRESS = {
  handprint: [0, 'wall', 0.18, 0.18, 1.0],
  footprint: [1, 'floor', 0.13, 0.26],
  stain: [2, 'wall', 1.3, 1.3, 1.55],
  soot: [3, 'wall', 1.2, 2.4, 0],
  drawFamily: [4, 'wall', 0.5, 0.5, 1.15],
  drawTall: [5, 'wall', 0.5, 0.5, 1.2],
  drawHall: [6, 'wall', 0.5, 0.5, 1.1],
  concert: [7, 'wall', 0.62, 0.86, 1.05],
  missing: [8, 'wall', 0.48, 0.66, 1.2],
  arrow: [9, 'floor', 0.7, 0.7],
  thisOne: [10, 'wall', 0.7, 0.5, 0.75],
  tally: [11, 'wall', 0.9, 0.9, 0.5],
  lines: [12, 'wall', 1.9, 1.9, 0.3],
  coat: [13, 'wall', 0.5, 0.95, 0.7],
  shoes: [14, 'stand', 0.28, 0.28],
  chair: [15, 'stand', 0.62, 0.62],
  bag: [16, 'stand', 0.5, 0.5],
  tile: [17, 'floor', 0.9, 0.9],
  puddle: [18, 'floor', 1.5, 1.5],
  clock: [19, 'wall', 0.42, 0.42, 2.05],
  crack: [20, 'wall', 1.4, 1.4, 1.0],
  photo: [21, 'wall', 0.62, 0.48, 1.35],
  scraps: [22, 'floor', 1.0, 1.0],
  doll: [23, 'stand', 0.42, 0.42],
  sorry: [24, 'wall', 1.0, 0.5, 0.6],
  quiet: [25, 'wall', 0.7, 0.35, 1.75],
  fireExit: [26, 'wall', 0.62, 0.31, 2.1],
  drawTeeth: [27, 'wall', 0.5, 0.5, 1.2],
  radiator: [28, 'wall', 1.3, 0.65, 0.12],
  pegs: [29, 'wall', 1.6, 0.4, 1.3],
  wellDone: [30, 'wall', 0.9, 0.6, 1.2],
  balloon: [31, 'stand', 0.45, 0.9],
  // the wings' own architecture
  bunting: [32, 'span', 3.4, 0.5],          // flags strung across an infants' corridor
  pipes: [33, 'wall', 2.0, 0.5, 2.1],       // the science wing's exposed pipes, under its low ceiling
  portrait: [34, 'wall', 0.62, 0.8, 1.35],  // a former headmaster, in oils (they are all him)
  honours: [35, 'wall', 0.9, 1.1, 1.05],    // HEAD BOYS, gold on black; the last name scratched out
  paperChain: [36, 'span', 3.4, 0.4],       // paper chains looping across
  cobweb: [37, 'wall', 0.6, 0.6, 2.9],      // in the old wing's high corners
  vent: [38, 'ceil', 0.5, 0.35],            // a ceiling vent
  ventEyes: [39, 'ceil', 0.5, 0.35],        // the same vent, later: something behind it
};

// the world-space rectangle of a cell in uv (0..1) on the sheet
export function cellUV(name) {
  const i = DRESS[name][0], u0 = (i % COLS) / COLS, v1 = 1 - Math.floor(i / COLS) / ROWS;
  const du = 1 / COLS, dv = 1 / ROWS, e = 0.5 / (CELL * COLS);
  return [u0 + e, v1 - dv + e, u0 + du - e, v1 - e]; // u0, v0 (bottom), u1, v1 (top)
}

const K = [24, 22, 20], CH = [226, 222, 210];
const paperSheet = (p, x0, y0, x1, y1, tone = 0.9) => {
  const s = densify([[x0, y0 + p.rand(-3, 3)], [x1, y0 + p.rand(-3, 3)], [x1 + p.rand(-3, 3), y1], [x0 + p.rand(-3, 3), y1]], 6);
  piece(p, s, { tone, w: 6, angle: 0, vary: 0.03, edge: 0.5 }, [4, 6, 6, 0.4]);
  return s;
};
const seg = (p, pts, col, w) => { for (let i = 0; i < pts.length - 1; i++) crayon(p, [pts[i], pts[i + 1]], col, w); };
const stick = (p, x, y, s, col, w = 5) => { // a crayon child: head, body, arms, legs
  crayon(p, [[x, y], [x, y + 1]], col, s * 0.5);
  seg(p, [[x, y + s * 0.3], [x, y + s * 1.1]], col, w); seg(p, [[x, y + s * 1.1], [x - s * 0.25, y + s * 1.7]], col, w); seg(p, [[x, y + s * 1.1], [x + s * 0.25, y + s * 1.7]], col, w);
  seg(p, [[x - s * 0.4, y + s * 0.55], [x + s * 0.4, y + s * 0.55]], col, w);
};

const CELLS = [
  // 0 a child's handprint in something dried rust-brown, smeared downward
  (p, c) => {
    const rgb = [112, 34, 26], h = [[128, 150, 46, 52]];
    for (const [x, y, rx, ry] of h) p.fill(blob(p, x, y, rx, ry, 14, 0.12), { rgb, w: 8, alpha: 0.9, edge: 0.4 });
    for (const [a, l] of [[-1.15, 62], [-0.62, 80], [-0.2, 88], [0.25, 80], [0.95, 56]]) {
      const x = 128 + Math.sin(a) * 40, y = 120 - Math.cos(a) * 30;
      p.brush([[x, y], [x + Math.sin(a) * l * 0.7, y - Math.cos(a) * l * 0.7]], { w: 20, rgb, alpha: 0.9, taper: 0.4, dry: 0.08 });
    }
    for (let k = 0; k < 5; k++) { const x = 100 + k * 13; p.brush([[x, 190], [x + p.rand(-3, 3), 230 + p.rand(0, 22)]], { w: 6, rgb, alpha: 0.6, dry: 0.4, body: false }); }
  },
  // 1 a small shoe print, rust-brown like the hands: sole and heel, the tread in it
  (p, c) => {
    const rgb = [104, 32, 24];
    p.fill(blob(p, 128, 88, 46, 74, 16, 0.06), { rgb, w: 6, alpha: 0.85, edge: 0.3 });
    p.fill(blob(p, 128, 200, 38, 40, 14, 0.08), { rgb, w: 6, alpha: 0.85, edge: 0.3 });
    for (let k = 0; k < 6; k++) p.brush([[92, 40 + k * 18], [164, 46 + k * 18]], { w: 3, tone: 0.1, alpha: 0.35, bristles: 2, body: false });
  },
  // 2 a water stain: brown rings, soft, spreading
  (p, c) => {
    for (let r = 0; r < 4; r++) p.fill(blob(p, 128, 120, 110 - r * 22, 96 - r * 18, 18, 0.22), { rgb: [72 + r * 8, 58 + r * 6, 40], alpha: 0.16 + r * 0.04, w: 18, edge: 0, len: [0.2, 0.4] });
    for (let k = 0; k < 3; k++) { const x = p.rand(80, 176); p.brush([[x, 160], [x + p.rand(-4, 4), 250]], { w: 9, rgb: [70, 56, 38], alpha: 0.3, dry: 0.3, body: false }); }
  },
  // 3 soot: black smoke licking up the wall from the floor, thinning
  (p, c) => {
    for (let k = 0; k < 40; k++) {
      const x = 128 + p.rand(-80, 80), top = p.rand(10, 140);
      p.brush([[x, 256], [x + p.rand(-30, 30), (256 + top) / 2], [x + p.rand(-50, 50), top]], { w: p.rand(14, 34), tone: 0.04, alpha: 0.18 + p.rand(0, 0.15), dry: 0.3, taper: 0.8, body: false });
    }
  },
  // 4 a crayon family in front of a house; one of them scribbled out, hard
  (p, c) => {
    paperSheet(p, 12, 18, 244, 236);
    const [R, Y, B, G] = CRAYON;
    seg(p, [[30, 120], [80, 70], [130, 120], [130, 190], [30, 190], [30, 120]], [90, 84, 80], 5);
    crayon(p, [[200, 48], [201, 48]], Y, 34);
    stick(p, 150, 120, 50, R); stick(p, 182, 118, 52, G); stick(p, 214, 140, 34, B);
    stick(p, 60, 138, 32, Y);
    for (let k = 0; k < 16; k++) crayon(p, [[44 + p.rand(-4, 4), 130 + k * 4], [78 + p.rand(-4, 4), 132 + k * 4.4]], K, 5, 0.9);
    label(p, 'my famly', 128, 222, { size: 18, font: 'cursive', weight: 'normal', col: 'rgba(38,92,205,0.9)' });
    p.pin(128, 26, 5);
  },
  // 5 the tall man with stars down his coat, children in a line holding hands, faces blank
  (p, c) => {
    paperSheet(p, 14, 14, 242, 240, 0.92);
    const S = [26, 24, 24];
    crayon(p, [[70, 52], [71, 52]], S, 22); seg(p, [[60, 40], [80, 40], [78, 18], [62, 18], [60, 40]], S, 5);
    seg(p, [[70, 64], [70, 172]], S, 18); seg(p, [[70, 172], [58, 222]], S, 6); seg(p, [[70, 172], [82, 222]], S, 6);
    seg(p, [[70, 86], [104, 70], [116, 54]], S, 5);
    for (let k = 0; k < 6; k++) crayon(p, [[66 + p.rand(0, 8), 78 + k * 15], [68 + p.rand(0, 8), 80 + k * 15]], CRAYON[1], 8);
    for (let i = 0; i < 4; i++) { const x = 130 + i * 28; stick(p, x, 150, 38, CRAYON[i % 4 === 1 ? 3 : i % 4], 4); }
    seg(p, [[118, 174], [230, 174]], CRAYON[4], 3);
    label(p, 'HIM', 70, 236, { size: 16, font: 'cursive', weight: 'normal', col: 'rgba(188,26,34,0.85)' });
    p.pin(128, 22, 5);
  },
  // 6 the hall: a long building, children inside the windows, a chain across the doors, one sun
  (p, c) => {
    paperSheet(p, 10, 22, 246, 232, 0.9);
    const S = [80, 74, 70];
    seg(p, [[26, 200], [26, 96], [128, 54], [230, 96], [230, 200], [26, 200]], S, 6);
    for (let i = 0; i < 4; i++) {
      const x = 40 + i * 48;
      seg(p, [[x, 110], [x + 30, 110], [x + 30, 140], [x, 140], [x, 110]], S, 4);
      crayon(p, [[x + 15, 122], [x + 15, 123]], CRAYON[i % 5], 12);
    }
    seg(p, [[106, 200], [106, 160], [150, 160], [150, 200]], S, 5);
    for (let k = 0; k < 6; k++) crayon(p, [[100 + k * 9, 172 + (k % 2) * 6], [108 + k * 9, 178 - (k % 2) * 6]], [140, 140, 150], 5);
    label(p, 'CONSERT', 128, 82, { size: 15, font: 'cursive', weight: 'normal', col: 'rgba(30,28,26,0.85)' });
    p.pin(128, 30, 5);
  },
  // 7 the end of term concert poster, printed, a little torn at the bottom
  (p, c) => {
    const poly = densify([[48, 10], [208, 12], [210, 214], [190, 226], [170, 212], [150, 240], [120, 222], [96, 238], [70, 220], [46, 230]], 4);
    piece(p, poly, { tone: 0.86, w: 5, angle: 0, vary: 0.03 }, [4, 6, 6, 0.4]);
    label(p, 'END OF TERM', 128, 46, { size: 20 }); label(p, 'CONCERT', 128, 74, { size: 26 });
    c.strokeStyle = 'rgba(30,28,26,0.7)'; c.lineWidth = 2; c.beginPath(); c.moveTo(70, 92); c.lineTo(186, 92); c.stroke();
    label(p, 'in the Hall', 128, 112, { size: 15, weight: 'italic' });
    label(p, 'Friday, 3 o’clock', 128, 134, { size: 15, weight: 'italic' });
    for (let k = 0; k < 5; k++) goldStar(p, 76 + k * 26, 162, 9, -Math.PI / 2 + k * 0.2, [1, 1.5, 1, 0.4]);
    label(p, 'Every child must attend', 128, 190, { size: 12, weight: 'normal' });
    p.pin(60, 20, 4); p.pin(196, 22, 4);
  },
  // 8 HAVE YOU SEEN: a photocopied child, the face scratched out with a pin
  (p, c) => {
    const poly = rectP(40, 6, 216, 250, 5);
    piece(p, poly, { tone: 0.82, w: 5, angle: 0, vary: 0.04 }, [4, 6, 6, 0.4]);
    label(p, 'HAVE YOU', 128, 34, { size: 24 }); label(p, 'SEEN', 128, 62, { size: 30 });
    p.fill(rectP(70, 84, 186, 196, 4), { tone: 0.45, w: 6, angle: 0, vary: 0.08, edge: 0 });
    p.brush([[128, 152], [128, 190]], { w: 52, tone: 0.2, bristles: 6, taper: 0.3 });
    p.fill(blob(p, 128, 126, 28, 32, 14, 0.06), { tone: 0.78, w: 5, edge: 0 });
    for (let k = 0; k < 22; k++) p.brush([[102 + p.rand(-4, 4), 104 + k * 2.2], [154 + p.rand(-4, 4), 108 + k * 2.2 + p.rand(-3, 3)]], { w: 1.5, tone: 0.03, bristles: 1, body: false, taper: 0 });
    label(p, 'last seen: the Hall', 128, 216, { size: 13, weight: 'italic' });
    label(p, 'Friday, 3 o’clock', 128, 234, { size: 12, weight: 'normal' });
    p.pin(128, 14, 4);
  },
  // 9 a red crayon arrow, scrawled on the floor, pointing right (+u)
  (p, c) => {
    for (let k = 0; k < 3; k++) {
      crayon(p, [[24, 128 + k * 5], [214, 124 + k * 4]], RED, 9);
      crayon(p, [[226, 126], [160, 72 + k * 6]], RED, 9); crayon(p, [[226, 128], [164, 184 - k * 6]], RED, 9);
    }
  },
  // 10 THIS ONE, in red crayon, big and childish, underlined twice
  (p, c) => {
    label(p, 'THIS', 128, 90, { size: 70, font: 'cursive', col: 'rgba(188,26,34,0.85)', rot: -0.06 });
    label(p, 'ONE', 128, 164, { size: 70, font: 'cursive', col: 'rgba(188,26,34,0.85)', rot: 0.04 });
    crayon(p, [[40, 206], [216, 200]], RED, 7); crayon(p, [[50, 222], [210, 218]], RED, 6);
  },
  // 11 tally marks in chalk: days, or something else, too many to count
  (p, c) => {
    for (let r = 0; r < 6; r++) for (let g = 0; g < 4; g++) {
      if (r === 5 && g > 1) continue;
      const x0 = 16 + g * 60, y0 = 12 + r * 40;
      for (let k = 0; k < 4; k++) p.brush([[x0 + k * 10, y0], [x0 + k * 10 + p.rand(-2, 2), y0 + 32]], { w: 3.5, rgb: CH, alpha: 0.8, bristles: 2, dry: 0.3, body: false });
      p.brush([[x0 - 4, y0 + 26], [x0 + 40, y0 + 6]], { w: 3.5, rgb: CH, alpha: 0.8, bristles: 2, dry: 0.3, body: false });
    }
  },
  // 12 lines, written straight onto the plaster in pencil, by a child who was made to
  (p, c) => {
    c.save(); c.font = 'italic 15px Georgia'; c.fillStyle = 'rgba(28,26,24,0.75)';
    for (let r = 0; r < 14; r++) {
      const sl = r > 9 ? (r - 9) * 0.02 : 0;
      c.save(); c.translate(8 + p.rand(0, 6), 20 + r * 17.5); c.rotate(sl + p.rand(-0.01, 0.01));
      c.fillText(r === 12 ? 'I must not leave before the bel' : 'I must not leave before the bell.', 0, 0); c.restore();
    }
    c.restore();
  },
  // 13 a navy duffle coat hanging from a peg
  (p, c) => {
    const coat = densify([[110, 18], [146, 18], [176, 50], [196, 238], [128, 248], [60, 238], [80, 50]], 4);
    piece(p, coat, { rgb: [38, 44, 70], w: 9, angle: Math.PI / 2, vary: 0.08, sheen: 0.2 }, [5, 7, 7, 0.45]);
    p.fill(densify([[100, 22], [156, 22], [140, 66], [116, 66]], 3), { rgb: [30, 34, 56], w: 5 });
    for (let k = 0; k < 3; k++) p.fill(rectP(122, 96 + k * 40, 134, 104 + k * 40, 2), { tone: 0.7, w: 2, edge: 0 });
    p.fill(rectP(112, 8, 144, 22, 2), { tone: 0.35, w: 3, edge: 0 });
    p.pin(128, 14, 5);
  },
  // 14 a pair of small white plimsolls, side by side, laces undone, a name inked on the heel
  (p, c) => {
    for (const x of [72, 168]) {
      const s = densify([[x - 48, 186], [x - 40, 150], [x + 2, 140], [x + 26, 168], [x + 52, 178], [x + 52, 214], [x - 48, 214]], 3);
      piece(p, s, { tone: 0.82, w: 6, angle: 0, vary: 0.05, sheen: 0.2, sheenTone: 0.92 }, [3, 4, 4, 0.5]);
      p.fill(rectP(x - 50, 210, x + 54, 222, 3), { tone: 0.12, w: 4, edge: 0 });
      p.brush([[x - 8, 152], [x - 30, 210], [x - 20, 236]], { w: 2.5, tone: 0.3, bristles: 2, body: false });
      for (let k = 0; k < 4; k++) p.brush([[x - 20 + k * 8, 150 + k * 2], [x - 16 + k * 8, 160 + k * 2]], { w: 1.6, tone: 0.2, bristles: 1, body: false });
    }
  },
  // 15 a small wooden classroom chair, seen side-on
  (p, c) => {
    const W = { rgb: [118, 90, 62], w: 6, angle: 0, vary: 0.05 };
    piece(p, rectP(54, 140, 196, 156, 3), W, [3, 4, 4, 0.5]);
    for (const x of [62, 184]) piece(p, rectP(x - 5, 150, x + 5, 250, 2), { ...W, angle: Math.PI / 2 }, [2, 3, 3, 0.5]);
    piece(p, rectP(174, 30, 186, 146, 2), { ...W, angle: Math.PI / 2 }, [2, 3, 3, 0.5]);
    piece(p, rectP(150, 40, 196, 92, 3), W, [2, 3, 3, 0.5]);
  },
  // 16 a schoolbag, slumped, a name tag
  (p, c) => {
    const bag = densify([[48, 120], [70, 80], [190, 84], [210, 130], [214, 242], [40, 242]], 4);
    piece(p, bag, { rgb: [104, 36, 34], w: 9, angle: 0.3, vary: 0.08, sheen: 0.2 }, [5, 7, 7, 0.45]);
    p.brush([[90, 84], [128, 26], [168, 86]], { w: 10, rgb: [70, 26, 24], alpha: 0.9 });
    p.fill(densify([[46, 120], [212, 128], [204, 170], [52, 162]], 3), { rgb: [86, 30, 28], w: 6 });
    p.fill(rectP(104, 186, 156, 214, 2), { tone: 0.86, w: 3, edge: 0 }); label(p, 'Tom', 130, 200, { size: 13, font: 'cursive', weight: 'normal' });
  },
  // 17 a ceiling tile fallen and broken on the floor, dust round it
  (p, c) => {
    p.fill(blob(p, 128, 128, 116, 110, 20, 0.25), { tone: 0.6, alpha: 0.18, w: 20, edge: 0 });
    const a = densify([[40, 48], [150, 36], [124, 132], [52, 150]], 3), b = densify([[160, 46], [218, 96], [200, 196], [130, 140]], 3), d = densify([[60, 166], [120, 150], [150, 220], [70, 224]], 3);
    for (const s of [a, b, d]) { piece(p, s, { tone: 0.3, w: 8, angle: p.rand(0, 3), vary: 0.05 }, [3, 4, 3, 0.5]); for (let k = 0; k < 5; k++) p.brush([[s[0][0] + p.rand(10, 40), s[0][1] + p.rand(10, 40)], [s[0][0] + p.rand(10, 40) + 1, s[0][1] + p.rand(10, 40)]], { w: 2, tone: 0.18, bristles: 1, body: false }); }
  },
  // 18 a puddle, black and shining, from something above
  (p, c) => {
    p.fill(blob(p, 128, 128, 112, 76, 22, 0.3), { tone: 0.03, alpha: 0.7, w: 14, edge: 0, sheen: 0.4, sheenTone: 0.2 });
    p.brush([[70, 100], [120, 92], [160, 104]], { w: 6, tone: 0.55, alpha: 0.35, body: false });
  },
  // 19 the corridor clock: stopped at three
  (p, c) => {
    p.fill(blob(p, 128, 128, 116, 116, 30, 0.01), { tone: 0.12, w: 8, edge: 0 });
    p.fill(blob(p, 128, 128, 100, 100, 30, 0.01), { tone: 0.86, w: 6, edge: 0 });
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; p.brush([[128 + Math.sin(a) * 82, 128 - Math.cos(a) * 82], [128 + Math.sin(a) * 94, 128 - Math.cos(a) * 94]], { w: k % 3 ? 3 : 6, tone: 0.1, bristles: 2, body: false, taper: 0 }); }
    p.brush([[128, 128], [128, 52]], { w: 7, tone: 0.06, bristles: 3, taper: 0.2 });
    p.brush([[128, 128], [184, 128]], { w: 9, tone: 0.06, bristles: 3, taper: 0.2 });
    p.pin(128, 128, 7);
    p.brush([[60, 80], [196, 190]], { w: 2, tone: 0.5, alpha: 0.6, bristles: 1, body: false }); // cracked glass
  },
  // 20 a crack running through the plaster
  (p, c) => {
    let x = 30, y = 40; const pts = [[x, y]];
    for (let k = 0; k < 9; k++) { x += p.rand(14, 30); y += p.rand(-6, 28); pts.push([x, y]); }
    p.brush(pts, { w: 5, tone: 0.05, bristles: 2, taper: 0.5, body: false, steps: 2, wobble: 0.6 });
    for (let k = 2; k < 8; k += 2) { const [a, b] = pts[k]; p.brush([[a, b], [a + p.rand(-30, 30), b + p.rand(18, 50)]], { w: 3, tone: 0.06, bristles: 1, taper: 0.6, body: false, steps: 2 }); }
  },
  // 21 a framed class photo, three rows, every face but one scratched out
  (p, c) => {
    p.fill(rectP(14, 36, 242, 214, 6), { tone: 0.1, w: 6, angle: 0, edge: 0 });
    p.fill(rectP(26, 48, 230, 202, 6), { tone: 0.62, w: 6, angle: 0, angJit: 0.2, edge: 0 });
    for (let r = 0; r < 3; r++) for (let k = 0; k < 6; k++) {
      const x = 48 + k * 32 + (r % 2) * 10, y = 74 + r * 42;
      p.brush([[x, y + 14], [x, y + 28]], { w: 18, tone: 0.3, bristles: 3, taper: 0.3 });
      p.brush([[x, y], [x, y + 1]], { w: 16, tone: 0.86, taper: 0 });
      if (!(r === 2 && k === 4)) for (let s = 0; s < 4; s++) p.brush([[x - 8, y - 7 + s * 4], [x + 8, y - 5 + s * 4]], { w: 1.6, tone: 0.04, bristles: 1, body: false, taper: 0 });
    }
    c.strokeStyle = 'rgba(188,26,34,0.85)'; c.lineWidth = 3; c.beginPath(); c.ellipse(186, 158, 16, 18, 0, 0, Math.PI * 2); c.stroke();
  },
  // 22 burnt paper scraps on the floor, curled, edges glowing grey
  (p, c) => {
    for (let k = 0; k < 9; k++) {
      const x = p.rand(40, 216), y = p.rand(40, 216), s = p.rand(14, 32);
      const b = blob(p, x, y, s, s * p.rand(0.5, 1), 10, 0.4);
      p.fill(b, { tone: 0.06, w: 4, edge: 0.6, edgeTone: 0.4 });
      if (k % 3 === 0) p.fill(blob(p, x + 4, y + 2, s * 0.4, s * 0.3, 8, 0.3), { tone: 0.8, w: 3, edge: 0 });
    }
  },
  // 23 a rag doll, sitting slumped, its face to the wall
  (p, c) => {
    piece(p, blob(p, 128, 172, 54, 66, 14, 0.12), { rgb: [140, 60, 64], w: 7, vary: 0.06 }, [4, 5, 5, 0.45]);
    piece(p, blob(p, 128, 82, 40, 42, 14, 0.06), { tone: 0.72, w: 5 }, [3, 4, 4, 0.45]);
    for (let k = 0; k < 14; k++) p.brush([[100 + k * 4, 54], [92 + k * 5 + p.rand(-6, 6), 128 + p.rand(0, 18)]], { w: 4, rgb: [160, 96, 40], alpha: 0.9, bristles: 2, body: false });
    for (const x of [92, 164]) p.brush([[x, 150], [x + (x < 128 ? -26 : 26), 210]], { w: 16, rgb: [140, 60, 64], alpha: 0.95 });
    for (const x of [106, 150]) p.brush([[x, 226], [x + (x < 128 ? -10 : 10), 252]], { w: 18, tone: 0.84 });
  },
  // 24 SORRY, gouged into the plaster with something sharp, over and over
  (p, c) => {
    for (let k = 0; k < 3; k++) label(p, 'SORRY', 128 + p.rand(-6, 6), 80 + k * 52, { size: 44, font: 'Georgia', weight: 'normal', col: `rgba(20,18,16,${0.55 + k * 0.15})`, rot: p.rand(-0.06, 0.06) });
    for (let k = 0; k < 12; k++) p.brush([[p.rand(20, 236), p.rand(40, 210)], [p.rand(20, 236), p.rand(40, 210)]], { w: 1.2, tone: 0.75, alpha: 0.5, bristles: 1, body: false });
  },
  // 25 QUIET IN THE CORRIDORS: the official sign, screwed to the wall
  (p, c) => {
    p.fill(rectP(6, 64, 250, 192, 4), { tone: 0.88, w: 5, angle: 0, edge: 0 }); p.paperEdge(rectP(6, 64, 250, 192, 4), 0.85);
    p.fill(rectP(14, 72, 242, 184, 4), { rgb: [30, 70, 50], w: 6, angle: 0, edge: 0 });
    label(p, 'QUIET', 128, 108, { size: 34, col: 'rgba(236,232,220,0.95)' });
    label(p, 'in the corridors', 128, 148, { size: 20, weight: 'italic', col: 'rgba(236,232,220,0.95)' });
    for (const x of [22, 234]) p.pin(x, 128, 4);
  },
  // 26 FIRE EXIT: the green running man, the arrow pointing at a blank wall
  (p, c) => {
    p.fill(rectP(4, 64, 252, 192, 4), { rgb: [28, 132, 74], w: 6, angle: 0, edge: 0 });
    p.fill(rectP(18, 78, 98, 178, 3), { tone: 0.95, w: 4, edge: 0 });
    stick(p, 58, 96, 40, [28, 132, 74], 7);
    label(p, 'FIRE EXIT', 172, 108, { size: 22, col: 'rgba(240,240,232,0.95)' });
    p.brush([[124, 152], [216, 152]], { w: 10, tone: 0.97, bristles: 3, taper: 0 }); p.brush([[200, 136], [222, 152], [200, 168]], { w: 9, tone: 0.97, bristles: 3, taper: 0 });
  },
  // 27 a child's portrait of the Headmaster: glasses, a smile with far too many teeth
  (p, c) => {
    paperSheet(p, 12, 12, 244, 244, 0.92);
    const S = [26, 24, 24];
    seg(p, [[60, 70], [196, 70], [190, 40], [66, 40], [60, 70]], S, 7);
    c.strokeStyle = 'rgba(26,24,24,0.85)'; c.lineWidth = 5; c.beginPath(); c.ellipse(128, 138, 74, 70, 0, 0, Math.PI * 2); c.stroke();
    for (const x of [98, 158]) { c.beginPath(); c.arc(x, 118, 18, 0, Math.PI * 2); c.stroke(); crayon(p, [[x, 118], [x + 1, 118]], S, 9); }
    seg(p, [[74, 158], [128, 186], [182, 158]], RED, 5); seg(p, [[74, 158], [182, 158]], RED, 4);
    for (let k = 0; k < 15; k++) { const x = 80 + k * 7; seg(p, [[x, 158 + Math.abs(k - 7) * -0.5], [x + 3, 170 - Math.abs(k - 7) * 1.4]], S, 2.5); }
    label(p, 'he smiles', 128, 228, { size: 18, font: 'cursive', weight: 'normal', col: 'rgba(38,92,205,0.85)' });
    p.pin(128, 20, 5);
  },
  // 28 a cast-iron radiator under the window line
  (p, c) => {
    p.fill(rectP(8, 70, 248, 200, 3), { tone: 0.42, w: 6, angle: Math.PI / 2, vary: 0.04, edge: 0 });
    for (let k = 0; k < 13; k++) { const x = 18 + k * 18; p.fill(rectP(x, 62, x + 12, 206, 2), { tone: 0.5 + (k % 2) * 0.04, w: 4, angle: Math.PI / 2, sheen: 0.4, sheenTone: 0.66, edge: 0 }); p.brush([[x + 13, 66], [x + 13, 204]], { w: 3, tone: 0.18, bristles: 2, body: false, taper: 0 }); }
    p.fill(rectP(4, 206, 252, 214, 2), { tone: 0.2, w: 3, edge: 0 });
  },
  // 29 a row of coat pegs, each with a name card; one has no name
  (p, c) => {
    p.fill(rectP(0, 76, 256, 108, 3), { rgb: [110, 84, 58], w: 6, angle: 0, edge: 0 });
    const names = ['Amy', 'Tom', 'Lily', '', 'Sam'];
    for (let k = 0; k < 5; k++) {
      const x = 26 + k * 51;
      p.fill(rectP(x - 14, 116, x + 14, 134, 2), { tone: 0.88, w: 3, edge: 0 });
      if (names[k]) label(p, names[k], x, 125, { size: 10, font: 'cursive', weight: 'normal' });
      p.brush([[x, 94], [x, 150], [x + 10, 160]], { w: 7, tone: 0.55, bristles: 3, taper: 0.1, sheen: 0.3 });
    }
  },
  // 30 WELL DONE CLASS 3: a cheerful sheet of gold stars, and one star torn off
  (p, c) => {
    const poly = rectP(14, 40, 242, 216, 5);
    piece(p, poly, { rgb: [196, 210, 228], w: 6, angle: 0, vary: 0.03 }, [4, 6, 6, 0.4]);
    label(p, 'WELL DONE', 128, 72, { size: 26, col: 'rgba(38,92,205,0.9)' }); label(p, 'CLASS 3!', 128, 102, { size: 22, col: 'rgba(188,26,34,0.85)' });
    for (let r = 0; r < 2; r++) for (let k = 0; k < 6; k++) {
      if (r === 1 && k === 3) { p.fill(blob(p, 50 + k * 31, 142 + r * 42, 11, 11, 10, 0.3), { tone: 0.75, w: 3, edge: 0 }); continue; }
      goldStar(p, 50 + k * 31, 142 + r * 42, 13, -Math.PI / 2 + p.rand(-0.3, 0.3), [1, 1.5, 1, 0.4]);
    }
    p.pin(128, 48, 4);
  },
  // 31 a red balloon on its string, slack, half fallen to the floor
  (p, c) => {
    piece(p, blob(p, 128, 70, 46, 56, 18, 0.06), { rgb: [176, 30, 38], w: 7, sheen: 0.4, sheenTone: 0.6 }, [4, 5, 5, 0.45]);
    p.brush([[110, 50], [118, 40]], { w: 7, tone: 0.95, alpha: 0.5, body: false });
    p.brush([[128, 126], [140, 170], [118, 214], [134, 254]], { w: 2, tone: 0.25, bristles: 1, body: false });
  },
  // 32 bunting: a sagging string of faded triangle flags
  (p, c) => {
    const sag = (x) => 30 + Math.sin((x / 256) * Math.PI) * 26;
    p.brush([[0, sag(0)], [64, sag(64)], [128, sag(128)], [192, sag(192)], [256, sag(256)]], { w: 2, tone: 0.3, bristles: 1, body: false });
    for (let k = 0; k < 9; k++) {
      const x = 10 + k * 28, y = sag(x + 10), col = CRAYON[k % 5].map((v) => Math.round(v * 0.6 + 100 * 0.4));
      const t = new Path2D(); t.moveTo(x, y); t.lineTo(x + 22, y + 1); t.lineTo(x + 11 + p.rand(-2, 2), y + 52 + p.rand(-6, 10)); t.closePath();
      c.fillStyle = `rgb(${col.join(',')})`; c.fill(t); c.strokeStyle = 'rgba(30,28,26,0.4)'; c.lineWidth = 1; c.stroke(t);
      if (k === 6) { c.fillStyle = 'rgba(20,18,16,0.7)'; c.fillRect(x + 6, y + 6, 10, 18); } // one is burnt through
    }
  },
  // 33 pipes: three painted pipes along the top of a wall, a valve wheel, rust at the joints
  (p, c) => {
    for (const [y, w, tone] of [[60, 34, 0.42], [120, 22, 0.36], [170, 16, 0.5]]) {
      p.fill(rectP(-6, y - w / 2, 262, y + w / 2, 4), { tone, w: 6, angle: 0, vary: 0.05, sheen: 0.5, sheenTone: tone + 0.25, edge: 0 });
      for (const x of [60, 190]) { p.fill(rectP(x - 6, y - w / 2 - 4, x + 6, y + w / 2 + 4, 2), { tone: tone - 0.12, w: 3, edge: 0 }); p.brush([[x, y + w / 2], [x + 2, y + w / 2 + 30]], { w: 5, rgb: [120, 60, 30], alpha: 0.5, body: false, dry: 0.4 }); }
    }
    c.strokeStyle = 'rgba(150,30,30,0.9)'; c.lineWidth = 5; c.beginPath(); c.arc(128, 60, 26, 0, 7); c.stroke();
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; c.beginPath(); c.moveTo(128, 60); c.lineTo(128 + Math.cos(a) * 26, 60 + Math.sin(a) * 26); c.stroke(); }
  },
  // 34 a portrait of a former headmaster in a gilt frame: the same tall hat, the same moustache
  (p, c) => {
    p.fill(rectP(30, 6, 226, 250, 5), { rgb: [150, 118, 60], w: 6, angle: 0, sheen: 0.5, sheenTone: 0.8, edge: 0 });
    p.fill(rectP(46, 22, 210, 234, 5), { rgb: [36, 30, 26], w: 8, angle: 0.4, vary: 0.04, edge: 0 });
    p.fill(densify([[78, 234], [90, 150], [128, 136], [166, 150], [178, 234]], 4), { tone: 0.08, w: 6, edge: 0 });
    p.fill(blob(p, 128, 110, 30, 36, 14, 0.04), { ...{ tone: 0.62, w: 5, edge: 0 } });
    p.fill(rectP(100, 34, 156, 78, 3), { tone: 0.05, w: 4, edge: 0 }); p.fill(rectP(88, 74, 168, 82, 2), { tone: 0.05, w: 3, edge: 0 });
    for (const x of [116, 140]) { c.strokeStyle = 'rgba(20,18,16,0.9)'; c.lineWidth = 2.5; c.beginPath(); c.arc(x, 106, 8, 0, 7); c.stroke(); }
    p.brush([[100, 126], [128, 120], [156, 126]], { w: 8, tone: 0.06, bristles: 3, taper: 0.3 });
    label(p, 'HEADMASTER', 128, 222, { size: 11, col: 'rgba(206,168,80,0.8)' });
  },
  // 35 the honours board: HEAD BOYS, gold names on black; the last one scratched out
  (p, c) => {
    p.fill(rectP(18, 6, 238, 250, 4), { rgb: [40, 26, 18], w: 6, angle: Math.PI / 2, sheen: 0.3, sheenTone: 0.3, edge: 0 });
    label(p, 'HEAD BOYS', 128, 28, { size: 18, col: 'rgba(214,176,86,0.9)' });
    const names = ['1952  A. Whitlock', '1953  R. Pargeter', '1954  D. Ames', '1955  P. Lowry', '1956  J. Fenwick', '1957  M. Ashby', '1958  T. Holloway', '1959  C. Dunmore', '1960'];
    names.forEach((n, k) => label(p, n, 128, 58 + k * 21, { size: 12, weight: 'normal', col: 'rgba(206,168,80,0.82)' }));
    for (let k = 0; k < 14; k++) p.brush([[150 + p.rand(-6, 6), 222 + p.rand(-4, 4)], [214 + p.rand(-6, 6), 226 + p.rand(-4, 4)]], { w: 1.4, tone: 0.7, alpha: 0.7, bristles: 1, body: false, taper: 0 });
  },
  // 36 a paper chain, crayon-coloured loops, sagging
  (p, c) => {
    for (let k = 0; k < 16; k++) {
      const x = 8 + k * 15.5, y = 34 + Math.sin(((x) / 256) * Math.PI) * 30, col = CRAYON[k % 5].map((v) => Math.round(v * 0.65 + 90 * 0.35));
      c.strokeStyle = `rgb(${col.join(',')})`; c.lineWidth = 5; c.beginPath(); c.ellipse(x, y, 9, 13, k % 2 ? 0 : Math.PI / 2, 0, 7); c.stroke();
    }
  },
  // 37 a cobweb in a corner, thick with dust
  (p, c) => {
    c.strokeStyle = 'rgba(210,206,196,0.5)'; c.lineWidth = 1.2;
    for (let k = 0; k < 9; k++) { const a = (k / 8) * Math.PI / 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * 250, Math.sin(a) * 250); c.stroke(); }
    for (let r = 30; r < 240; r += 26) { c.beginPath(); for (let k = 0; k <= 8; k++) { const a = (k / 8) * Math.PI / 2, rr = r + Math.sin(k * 3 + r) * 6; k ? c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.stroke(); }
  },
  // 38 a ceiling vent: louvres, black behind
  (p, c) => {
    p.fill(rectP(18, 46, 238, 210, 4), { tone: 0.5, w: 5, angle: 0, edge: 0 });
    p.fill(rectP(30, 58, 226, 198, 4), { tone: 0.02, w: 5, edge: 0 });
    for (let k = 0; k < 7; k++) p.fill(rectP(32, 64 + k * 19, 224, 72 + k * 19, 2), { tone: 0.42, w: 3, angle: 0, edge: 0, sheen: 0.4, sheenTone: 0.6 });
  },
  // 39 the same vent, later: two small eyes behind the louvres
  (p, c) => {
    p.fill(rectP(18, 46, 238, 210, 4), { tone: 0.5, w: 5, angle: 0, edge: 0 });
    p.fill(rectP(30, 58, 226, 198, 4), { tone: 0.02, w: 5, edge: 0 });
    for (const x of [104, 150]) { p.fill(blob(p, x, 122, 10, 7, 10, 0.1), { tone: 0.92, w: 3, edge: 0 }); p.fill(blob(p, x + 1, 122, 3.5, 3.5, 8, 0.1), { tone: 0.02, w: 2, edge: 0 }); }
    for (let k = 0; k < 7; k++) p.fill(rectP(32, 64 + k * 19, 224, 72 + k * 19, 2), { tone: 0.42, w: 3, angle: 0, edge: 0, sheen: 0.4, sheenTone: 0.6 });
  },
];

// paint the whole sheet (in a painter worker; cached like every other card)
export function dressAtlas() {
  return texCanvas(CELL * COLS, CELL * ROWS, 4242, (p, c) => {
    CELLS.forEach((fn, i) => {
      c.save();
      c.translate((i % COLS) * CELL, Math.floor(i / COLS) * CELL);
      c.beginPath(); c.rect(0, 0, CELL, CELL); c.clip();
      fn(p, c);
      c.restore();
    });
  });
}

// THE HALL DOORS: tall, double, varnished dark; round windows painted black from inside; a chain
// through both handles and a padlock; soot licking up over the frame; small handprints low down;
// HALL in gold leaf, flaking. 2.4 x 2.55 m.
export function hallDoorsTexture() {
  return texCanvas(512, 544, 5150, (p, c) => {
    c.fillStyle = 'rgb(14,11,9)'; c.fillRect(0, 0, 512, 544);
    for (const x0 of [10, 260]) {
      const leaf = rectP(x0, 70, x0 + 242, 544, 6);
      piece(p, leaf, { rgb: [62, 42, 30], w: 10, angle: Math.PI / 2, vary: 0.06, len: [0.2, 0.5], sheen: 0.3, sheenTone: 0.5 }, [3, 4, 4, 0.5]);
      for (const [y0, y1] of [[110, 290], [320, 520]]) p.fill(rectP(x0 + 26, y0, x0 + 216, y1, 4), { rgb: [52, 35, 25], w: 8, angle: Math.PI / 2, vary: 0.05, edge: 0 });
      p.fill(blob(p, x0 + 121, 190, 42, 42, 20, 0.02), { tone: 0.03, w: 5, edge: 0 });
      c.strokeStyle = 'rgba(150,120,70,0.7)'; c.lineWidth = 5; c.beginPath(); c.arc(x0 + 121, 190, 44, 0, 7); c.stroke();
    }
    // handles, and the chain through them, and the padlock
    for (const x of [236, 276]) p.fill(rectP(x - 6, 300, x + 6, 380, 2), { rgb: [150, 132, 96], w: 3, edge: 0, sheen: 0.5, sheenTone: 0.8 });
    for (let k = 0; k < 15; k++) {
      const t = k / 14, x = 150 + t * 212, y = 330 + Math.sin(t * Math.PI) * 26;
      c.strokeStyle = 'rgba(120,118,112,0.95)'; c.lineWidth = 5; c.beginPath(); c.ellipse(x, y, 10, 6, k % 2 ? 0.5 : -0.5, 0, 7); c.stroke();
      c.strokeStyle = 'rgba(30,28,26,0.8)'; c.lineWidth = 1.5; c.stroke();
    }
    p.fill(rectP(238, 352, 276, 398, 3), { rgb: [96, 90, 80], w: 4, edge: 0, sheen: 0.4, sheenTone: 0.7 });
    c.strokeStyle = 'rgba(110,104,96,0.95)'; c.lineWidth = 6; c.beginPath(); c.arc(257, 352, 13, Math.PI, 0); c.stroke();
    // soot, up from the gap under the doors and out over the frame
    for (let k = 0; k < 60; k++) {
      const x = p.rand(0, 512), top = p.rand(0, 220);
      p.brush([[x, 544], [x + p.rand(-40, 40), (544 + top) / 2], [x + p.rand(-60, 60), top]], { w: p.rand(12, 30), tone: 0.02, alpha: 0.12 + p.rand(0, 0.12), dry: 0.3, taper: 0.8, body: false });
    }
    // small hands, low down, many
    for (let k = 0; k < 14; k++) {
      const x = p.rand(40, 470), y = p.rand(400, 520), s = p.rand(0.5, 0.8);
      p.fill(blob(p, x, y, 14 * s, 16 * s, 10, 0.15), { rgb: [96, 30, 24], w: 3, alpha: 0.7, edge: 0 });
      for (let f = 0; f < 4; f++) p.brush([[x - 9 * s + f * 6 * s, y - 10 * s], [x - 10 * s + f * 6 * s, y - 26 * s]], { w: 4 * s, rgb: [96, 30, 24], alpha: 0.7, body: false, bristles: 2 });
    }
    // HALL, gold leaf on the lintel, half gone
    c.fillStyle = 'rgba(46,32,22,1)'; c.fillRect(0, 10, 512, 54);
    label(p, 'H A L L', 256, 38, { size: 34, col: 'rgba(206,168,80,0.85)' });
    for (let k = 0; k < 30; k++) { c.fillStyle = 'rgba(46,32,22,0.9)'; c.fillRect(p.rand(170, 340), p.rand(20, 56), p.rand(2, 8), p.rand(2, 6)); }
  });
}
