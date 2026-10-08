// THE SCHOOL, interior art (copied from spike/concepts/rooms.js, scene frames removed).
// Original header: THE SCHOOL, interiors: a classroom (one roll of the generator, shown twice) and a stairwell.
// THROWAWAY spike code. Same approach as the hallway frame in school.js: painted paper textures mapped
// into perspective a column or row at a time, lit afterwards; props are flat paper panels;
// people are painted cards standing upright (billboards in the game).
import { ellipse, Painter } from './paint.js';
import { blob, piece, cut, scallop } from './designs.js';
import {
  GOLD, RED, CRAYON, TEACHERS, goldStar, teacher, student, densify, rectP, texCanvas, wallTexture, ceilingTexture,
  label, crayon, about, teeth, SKIN, PALE, DARK,
} from './school.js';

// ---------------------------------------------------------------------------
// CARDS SEEN FROM BEHIND
// A student from the back: the hair covers the head, the neck pin shows, arms forward to the desk.
function studentBack(p) {
  const JUMPER = { tone: 0.36, vary: 0.05, w: 8, sheen: 0.2, sheenTone: 0.48, edgeTone: 0.26 };
  for (const [top, foot] of [[[182, 500], [178, 606]], [[238, 500], [242, 606]]]) piece(p, p.limb([top, foot], 24, 20), { ...SKIN, tone: 0.78 });
  piece(p, [[148, 436], [272, 436], [282, 518], [226, 522], [210, 488], [194, 522], [138, 518]], { ...DARK, tone: 0.2, w: 7 });
  piece(p, p.limb([[150, 318], [140, 380], [160, 420]], 30, 24), JUMPER);
  piece(p, p.limb([[270, 318], [280, 380], [260, 420]], 30, 24), JUMPER);
  piece(p, [[156, 298], [264, 298], [284, 330], [278, 452], [142, 452], [136, 330]], JUMPER, [8, 10, 10, 0.35]);
  piece(p, p.limb([[210, 270], [210, 304]], 32, 28), { ...SKIN, tone: 0.74 });
  piece(p, blob(p, 120, 190, 16, 24, 8, 0.1), SKIN, [3, 4, 4, 0.3]);
  piece(p, blob(p, 300, 190, 16, 24, 8, 0.1), SKIN, [3, 4, 4, 0.3]);
  piece(p, blob(p, 210, 180, 92, 100, 16, 0.05), { ...DARK, tone: 0.17, w: 7, angle: Math.PI / 2, sheen: 0.25, sheenTone: 0.3 }, [8, 12, 10, 0.38]);
  for (let i = 0; i < 18; i++) { const x = 130 + i * 9; p.brush([[x, 100 + Math.abs(i - 9) * 3], [x + p.rand(-6, 6), 262 - Math.abs(i - 9) * 2]], { w: 2, tone: 0.06, bristles: 2, body: false, alpha: 0.6 }); }
  piece(p, p.limb([[186, 88], [176, 58], [158, 34]], 12, 5), { ...DARK, tone: 0.14, w: 3 }, [3, 4, 4, 0.4]);
  piece(p, p.limb([[232, 86], [246, 56], [268, 38]], 12, 5), { ...DARK, tone: 0.14, w: 3 }, [3, 4, 4, 0.4]);
  p.staple(178, 96, 194, 86); p.staple(226, 88, 242, 98);
  p.pin(210, 296, 7); p.pin(152, 320, 6.5); p.pin(268, 320, 6.5);
}

// The teacher from behind, writing on the board: the hump, the shawl's point, the bun with its pencils,
// one claw raised with the chalk.
function teacherBack(p, sp = TEACHERS[0]) {
  const DRESS = { ...(sp.dress ? { rgb: sp.dress } : { tone: 0.18 }), vary: 0.05, w: 12, sheen: 0.22, sheenTone: 0.34, edgeTone: 0.12 };
  p.shadow(ellipse(330, 976, 200, 18), 0, 0, 14, 0.4);
  for (const [top, foot] of [[[290, 840], [282, 960]], [[372, 840], [380, 960]]]) piece(p, p.limb([top, foot], 22, 16), { ...DARK, tone: 0.16 });
  piece(p, [[200, 600], [460, 600], [490, 720], [526, 860], [330, 870], [134, 860], [170, 720]], { ...DRESS, angle: Math.PI / 2 }, [12, 16, 14, 0.36]);
  for (let i = 0; i < 9; i++) { const x = 190 + i * 32; p.brush([[x + 6, 612], [x - (4 - i) * 8, 856]], { w: 3, tone: 0.08, bristles: 2, body: false, alpha: 0.7 }); }
  piece(p, [[196, 610], [180, 480], [196, 380], [250, 320], [330, 300], [410, 320], [464, 380], [480, 480], [464, 610]], { ...DRESS, tone: 0.24, angle: Math.PI / 2 }, [12, 16, 14, 0.36]);
  piece(p, densify([[196, 600], [464, 600], [464, 624], [196, 624]], 5), { tone: 0.08, w: 6, angle: 0, edge: 0.4 }, [3, 5, 5, 0.4]);
  // the shawl hangs to a point down her back
  if (sp.shawl !== null) piece(p, [[190, 380], [250, 316], [330, 298], [410, 316], [470, 380], [440, 440], [380, 500], [330, 560], [280, 500], [220, 440]], { tone: sp.shawl, w: 6, vary: 0.07, angle: 0.3, angJit: 0.6, curve: 0.5, sheen: 0.3, sheenTone: 0.56, edgeTone: 0.34 }, [6, 9, 8, 0.38]);
  // the raised arm writing (on her right), the low arm with the red pen
  piece(p, p.limb([[440, 350], [500, 270], [520, 190]], 32, 26), { ...DRESS, tone: 0.3 });
  piece(p, p.limb([[520, 190], [516, 130], [506, 82]], 26, 20), { ...DRESS, tone: 0.3, angle: -1.5 });
  piece(p, blob(p, 504, 70, 18, 16, 10, 0.12), SKIN);
  for (const a of [-2.0, -1.6, -1.2]) piece(p, p.limb([[504 + Math.cos(a) * 10, 70 + Math.sin(a) * 10], [504 + Math.cos(a) * 40, 70 + Math.sin(a) * 40 + 6]], 7, 2.5), { ...SKIN, w: 3, edge: 0.4 }, [2, 3, 3, 0.35]);
  piece(p, p.limb([[488, 44], [500, 60]], 10, 10), { tone: 0.95, w: 3, edge: 0 }, [1, 2, 2, 0.3]);
  piece(p, p.limb([[220, 360], [172, 470], [160, 560]], 32, 26), { ...DRESS, tone: 0.3 });
  piece(p, blob(p, 158, 574, 18, 16, 10, 0.12), SKIN);
  piece(p, p.limb([[150, 560], [130, 624]], 10, 8), { rgb: RED, tone: 0.4, w: 4, alpha: 0.95, edge: 0.3 }, [2, 3, 3, 0.4]);
  // head from behind, hair scraped up into the bun; pencils stabbed through
  piece(p, p.limb([[330, 300], [330, 260]], 40, 36), { ...SKIN, tone: 0.74 });
  if (sp.hair === 'long') piece(p, [[262, 180], [330, 130], [398, 180], [410, 300], [420, 470], [330, 500], [240, 470], [250, 300]], { tone: sp.hairTone, w: 6, vary: 0.06, angle: Math.PI / 2, sheen: 0.25, edgeTone: sp.hairTone - 0.05 }, [8, 10, 10, 0.4]);
  piece(p, blob(p, 330, 210, 74, 82, 16, 0.05), { tone: sp.hairTone, w: 6, vary: 0.06, angle: Math.PI / 2, sheen: 0.3, edgeTone: 0.3 }, [10, 14, 12, 0.4]);
  for (let k = 0; k < 14; k++) p.brush([[270 + k * 9, 270 - Math.abs(k - 7) * 2], [318 + k * 2, 140]], { w: 1.4, tone: sp.hairTone - 0.12, bristles: 1, body: false });
  if (sp.hair === 'bun') {
  piece(p, scallop(p, 330, 128, 50, 44, 26, 10), { tone: sp.hairTone - 0.02, w: 5, vary: 0.06, angJit: Math.PI, curve: 0.8, sheen: 0.3, edgeTone: 0.3 }, [6, 8, 8, 0.4]);
  for (let k = 0; k < 4; k++) { const pts = []; for (let a = 0; a < 5.5; a += 0.5) pts.push([330 + Math.cos(a + k) * (8 + a * 6.4), 128 + Math.sin(a + k) * (8 + a * 6)]); p.brush(pts, { w: 2, tone: 0.26, bristles: 2, body: false, taper: 0.5 }); }
  piece(p, p.limb([[270, 70], [330, 130], [372, 170]], 9, 9), { rgb: RED, tone: 0.4, w: 3, alpha: 0.95, edge: 0.2 }, [3, 4, 4, 0.4]);
  piece(p, p.limb([[392, 64], [330, 128], [292, 168]], 9, 9), { tone: 0.74, w: 3, edge: 0.2 }, [3, 4, 4, 0.4]);
  p.pin(330, 128, 6);
  } p.pin(330, 300, 8); p.pin(440, 352, 7.5); p.pin(520, 190, 6.5); p.pin(220, 362, 7.5);
}

// ---------------------------------------------------------------------------
// TEXTURES
function windowTexture(seed) {
  // 2 m x 1.7 m at 256 px/m: night, a moon behind cut-paper cloud, the paper forest beyond the fence
  return texCanvas(512, 436, seed, (p, c) => {
    const sky = c.createLinearGradient(0, 0, 0, 436);
    sky.addColorStop(0, 'rgb(34,35,38)'); sky.addColorStop(1, 'rgb(74,74,74)');
    c.fillStyle = sky; c.fillRect(0, 0, 512, 436);
    const mx = 120 + (seed % 7) * 40, my = 110;
    const glow = c.createRadialGradient(mx, my, 10, mx, my, 160); glow.addColorStop(0, 'rgba(230,228,215,0.35)'); glow.addColorStop(1, 'rgba(230,228,215,0)');
    c.fillStyle = glow; c.fillRect(0, 0, 512, 436);
    piece(p, ellipse(mx, my, 44, 44, 18), { tone: 0.9, w: 5, vary: 0.04, edge: 0.4 }, [3, 4, 6, 0.4]);
    for (let i = 0; i < 4; i++) { const cx = p.rand(40, 470), cy = p.rand(70, 190); const cl = scallop(p, cx, cy, p.rand(50, 90), p.rand(14, 24), 22, 6); p.fill(cl, { tone: 0.24, w: 6, angle: 0, edge: 0, alpha: 0.9 }); p.paperEdge(cl, 0.3); }
    for (let i = 0; i < 9; i++) {
      const x = i * 62 + p.rand(-14, 14), base = 436, h = p.rand(150, 240), tone = 0.1 + p.rand(0, 0.06);
      piece(p, p.limb([[x, base], [x, base - h * 0.55]], 14, 10), { tone: tone - 0.03, w: 4, edge: 0 }, [0, 0, 1, 0]);
      piece(p, scallop(p, x, base - h * 0.7, p.rand(40, 60), p.rand(48, 70), 22, 7), { tone, w: 5, angJit: Math.PI, curve: 0.7, edge: 0, alpha: 0.95 }, [2, 3, 3, 0.3]);
    }
    for (let x = 4; x < 512; x += 22) p.fill(densify([[x, 330], [x + 12, 330], [x + 12, 436], [x, 436]], 2), { tone: 0.07, w: 3, edge: 0 });
    p.fill(densify([[0, 352], [512, 352], [512, 362], [0, 362]], 4), { tone: 0.07, w: 3, edge: 0 });
    // the frame: border, two mullions, a transom
    for (const r of [[0, 0, 512, 16], [0, 420, 512, 436], [0, 0, 16, 436], [496, 0, 512, 436], [164, 0, 180, 436], [332, 0, 348, 436], [0, 150, 512, 164]]) {
      const poly = rectP(...r, 3); p.fill(poly, { tone: 0.16, w: 5, angle: 0, edge: 0 }); p.paperEdge(poly, 0.2);
    }
    for (let i = 0; i < 3; i++) p.brush([[30 + i * 168, 30], [140 + i * 168, 140]], { w: 22, tone: 0.9, alpha: 0.05, body: false });
  });
}

// the blackboard, 4.8 x 1.35 m at 256 px/m, with chalk
function blackboardTexture(seed, turned, lines = ['Hand in your work.', 'Nobody leaves until the hy']) {
  return texCanvas(1228, 346, seed, (p, c) => {
    const frame = rectP(0, 0, 1228, 346, 8);
    p.fill(frame, { tone: 0.3, w: 10, angle: 0, edge: 0 }); p.paperEdge(frame, 0.32);
    const slate = rectP(18, 16, 1210, 318, 8);
    p.fill(slate, { tone: 0.13, w: 26, angle: 0.1, angJit: 0.5, curve: 0.6, vary: 0.04, len: [0.1, 0.3], edge: 0 });
    // chalk dust: old writing half rubbed out
    for (let i = 0; i < 14; i++) { const x = p.rand(40, 1180), y = p.rand(40, 300); p.brush([[x, y], [x + p.rand(60, 200), y + p.rand(-20, 20)]], { w: p.rand(18, 40), tone: 0.42, alpha: 0.12, body: false, dry: 0.5 }); }
    p.fill(densify([[18, 318], [1210, 318], [1210, 336], [18, 336]], 6), { tone: 0.26, w: 6, angle: 0, edge: 0 });
    for (const x of [300, 318, 760]) p.fill(densify([[x, 308], [x + 14, 308], [x + 14, 318], [x, 318]], 2), { tone: 0.95, w: 2, edge: 0 });
    // the chalk layer, speckled so it reads as chalk
    const ch = typeof document !== 'undefined' ? Object.assign(document.createElement('canvas'), { width: 1228, height: 346 }) : new OffscreenCanvas(1228, 346);
    const k = ch.getContext('2d', typeof document === 'undefined' ? { willReadFrequently: true } : undefined);
    k.fillStyle = 'rgba(236,233,224,0.92)'; k.textBaseline = 'alphabetic';
    const write = (t, x, y, size, rot = 0) => { k.save(); k.translate(x, y); k.rotate(rot); k.font = `${size}px "Segoe Print", "Comic Sans MS", cursive`; k.fillText(t, 0, 0); k.restore(); };
    write('Friday 19th July', 44, 66, 30, -0.01);
    write('End of Term', 44, 104, 26, -0.01);
    write(lines[0], 330, 150, 64, -0.015);
    write('12 + 1 = 13', 980, 70, 34, 0.02);
    write(turned ? 'Nobody leaves until the hymn is over.' : lines[1], 300, 250, 48, -0.01);
    k.strokeStyle = 'rgba(236,233,224,0.92)'; k.lineWidth = 5;
    const sx = 1090, sy = 210;
    k.beginPath(); for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 22 : 54; k.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r); } k.stroke();
    if (turned) {
      // a face with too many teeth, scrawled fast
      k.lineWidth = 4; k.beginPath(); k.arc(1060, 120, 46, 0, Math.PI * 2); k.stroke();
      k.beginPath(); k.arc(1044, 108, 6, 0, Math.PI * 2); k.arc(1078, 108, 6, 0, Math.PI * 2); k.fill();
      k.beginPath(); k.moveTo(1024, 132); k.quadraticCurveTo(1060, 168, 1098, 132); k.stroke();
      for (let i = 0; i < 9; i++) { k.beginPath(); k.moveTo(1030 + i * 7.5, 136 + Math.abs(i - 4) * -1.5); k.lineTo(1031 + i * 7.5, 152 - Math.abs(i - 4) * 2); k.stroke(); }
    }
    k.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 26000; i++) { k.fillStyle = `rgba(0,0,0,${p.rand(0.3, 1)})`; k.fillRect(p.rand(0, 1228), p.rand(0, 346), p.rand(1, 3), p.rand(1, 2)); }
    c.drawImage(ch, 0, 0);
  });
}

// little crayon pictures for the display board
function doodle(p, x, y, w, h, kind) {
  const [R, Y, B, G, P] = CRAYON, K = [26, 24, 24];
  const sheet = rectP(x, y, x + w, y + h, 3);
  p.shadow(sheet, 2, 3, 3, 0.4); p.fill(sheet, { tone: 0.92, w: 4, angle: 0, edge: 0 }); p.paperEdge(sheet, 0.9);
  const s = Math.min(w, h) / 100, cx = x + w / 2, cy = y + h / 2;
  const seg = (pts, col, ww = 3) => { for (let i = 0; i < pts.length - 1; i++) crayon(p, [pts[i], pts[i + 1]], col, ww * s); };
  if (kind === 0) { // house and a sun
    seg([[cx - 30 * s, cy + 30 * s], [cx - 30 * s, cy - 5 * s], [cx, cy - 30 * s], [cx + 30 * s, cy - 5 * s], [cx + 30 * s, cy + 30 * s], [cx - 30 * s, cy + 30 * s]], R);
    crayon(p, [[x + w - 18 * s, y + 16 * s], [x + w - 17 * s, y + 17 * s]], Y, 18 * s);
  } else if (kind === 1) { // a family, holding hands
    for (let i = 0; i < 4; i++) { const fx = cx - 33 * s + i * 22 * s, col = [B, R, G, Y][i], hh = i < 2 ? 1 : 0.7; crayon(p, [[fx, cy - 18 * s * hh], [fx, cy - 17 * s * hh]], col, 12 * s); seg([[fx, cy - 10 * s * hh], [fx, cy + 20 * s]], col); seg([[fx - 10 * s, cy], [fx + 10 * s, cy]], col); }
  } else if (kind === 2) { // the cat-eared one, black, smiling
    seg([[cx - 14 * s, cy - 26 * s], [cx - 8 * s, cy - 40 * s], [cx - 2 * s, cy - 26 * s]], K, 4); seg([[cx + 2 * s, cy - 26 * s], [cx + 8 * s, cy - 40 * s], [cx + 14 * s, cy - 26 * s]], K, 4);
    crayon(p, [[cx, cy - 16 * s], [cx, cy - 15 * s]], K, 30 * s); seg([[cx, cy], [cx, cy + 34 * s]], K, 10);
    seg([[cx - 9 * s, cy - 12 * s], [cx, cy - 8 * s], [cx + 9 * s, cy - 12 * s]], [235, 232, 222], 2);
    seg([[cx + 6 * s, cy + 4 * s], [cx + 26 * s, cy - 14 * s]], K, 4);
  } else if (kind === 3) { // flowers: the only colour the boy remembers
    for (let i = 0; i < 5; i++) { const fx = cx - 32 * s + i * 16 * s; seg([[fx, cy + 34 * s], [fx, cy - 4 * s]], G); crayon(p, [[fx, cy - 10 * s], [fx + 1, cy - 9 * s]], CRAYON[i], 14 * s); }
  } else if (kind === 4) { // black scribble, pressed so hard it tore
    for (let i = 0; i < 16; i++) crayon(p, [[cx + p.rand(-34, 34) * s, cy + p.rand(-34, 34) * s], [cx + p.rand(-34, 34) * s, cy + p.rand(-34, 34) * s]], K, 5 * s, 0.9);
  } else { // a tall man and a small boy
    seg([[cx - 14 * s, cy - 36 * s], [cx - 14 * s, cy + 34 * s]], K, 8); crayon(p, [[cx - 14 * s, cy - 40 * s], [cx - 13 * s, cy - 39 * s]], K, 14 * s);
    for (let i = 0; i < 4; i++) crayon(p, [[cx - 14 * s, cy - 20 * s + i * 12 * s], [cx - 13 * s, cy - 19 * s + i * 12 * s]], Y, 6 * s);
    seg([[cx + 20 * s, cy + 10 * s], [cx + 20 * s, cy + 34 * s]], B); crayon(p, [[cx + 20 * s, cy + 4 * s], [cx + 21 * s, cy + 5 * s]], B, 10 * s);
  }
  p.pin(x + w / 2, y + 5, 3.5);
}

function displayTexture(seed) {
  // 3.6 m x 1.15 m at 200 px/m: cork, crayon drawings pinned up
  return texCanvas(720, 230, seed, (p) => {
    const board = rectP(0, 0, 720, 230, 8);
    p.fill(board, { tone: 0.26, w: 8, angle: 0, angJit: Math.PI, vary: 0.06, len: [0.03, 0.08], minLen: 6, edge: 0 }); p.paperEdge(board, 0.22);
    const kinds = [0, 1, 2, 3, 1, 4, 5, 0];
    kinds.forEach((kd, i) => doodle(p, 14 + i * 88 + p.rand(-4, 4), 16 + (i % 2) * 22 + p.rand(-4, 4), 78, 92 + p.rand(-6, 10), kd));
    label(p, 'MY FAMILY', 360, 206, { size: 18, col: 'rgba(230,228,220,0.85)' });
  });
}

function planksTexture(seed) {
  // 2 m x 2 m of floorboards, running away from you
  return texCanvas(256, 256, seed, (p, c) => {
    c.fillStyle = p.grey(0.12); c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 8; i++) {
      const x = i * 32, cut0 = p.rand(20, 230);
      for (const [y0, y1] of [[-2, cut0], [cut0 + 2, 258]]) {
        const poly = rectP(x + 1, y0, x + 31, y1, 4), tone = 0.34 + p.rand(-0.05, 0.05);
        p.fill(poly, { tone, w: 5, angle: Math.PI / 2, angJit: 0.04, vary: 0.05, len: [0.2, 0.5], sheen: 0.2, edge: 0 }); p.paperEdge(poly, tone);
      }
    }
  });
}

function frontWallTexture(seed) {
  return wallTexture(seed, false);
}

export { studentBack, teacherBack, windowTexture, blackboardTexture, displayTexture, planksTexture, doodle };
