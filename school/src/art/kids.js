// THE CHILDREN, generated: no two the same. Each kid is a spec rolled from a seed (hair, head, eyes,
// mouth, nose, uniform, height, small wrongnesses, and a name tag), painted front, back and snapped
// on the same 420 x 660 card the renderer expects (feet at y=616, neck pin at 210,296).
// The names are the register's names: the children who were at the concert.
import { ellipse, makeRng } from './paint.js';
import { blob, piece } from './designs.js';
import { goldStar, label } from './school.js';

export const NAMES = ['Alice', 'Tommy', 'Edith', 'Arthur', 'May', 'Sidney', 'Ivy', 'Walter', 'Rose', 'Albert', 'Doris', 'Frank',
  'Elsie', 'Harold', 'Violet', 'Stanley', 'Lily', 'Ernest', 'Mabel', 'George', 'Winnie', 'Percy', 'Ada', 'Cyril', 'Hilda',
  'Reggie', 'Nora', 'Leonard', 'Peggy', 'Bertie', 'Dot', 'Clifford'];

const HAIR_BOY = ['tufts', 'cap', 'parted', 'buzz', 'curls', 'fringe', 'cowlick'];
const HAIR_GIRL = ['bob', 'pigtails', 'plaits', 'fringe', 'curls', 'bun', 'long'];
const NOSES = ['point', 'round', 'button', 'none', 'long'];

// wrong = one uncanny trait allowed (research/05 R17: one wrongness is creepy; three is a monster)
const EYES_OK = ['round', 'dots', 'glasses', 'sleepy', 'round', 'dots'], MOUTHS_OK = ['flat', 'smile', 'sad', 'o', 'grin', 'smile'];
const EYES_WRONG = ['hollow', 'buttons', 'stapled', 'mismatch'], MOUTHS_WRONG = ['stitched', 'toothy', 'none'];

export function kidSpec(seed, { wrong = false } = {}) {
  const r = makeRng(seed * 7919 + 13);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const girl = r() < 0.5;
  const extras = new Set();
  for (const [x, p] of [['plaster', 0.18], ['freckles', 0.22], ['bandage', 0.06], ['bow', girl ? 0.45 : 0]]) if (r() < p) extras.add(x);
  // exactly one wrong thing, if this is one of the wrong ones
  const wrongTrait = wrong ? pick(['eyes', 'mouth', 'scribble', 'soot', 'tornEar']) : null;
  if (wrongTrait === 'scribble' || wrongTrait === 'soot' || wrongTrait === 'tornEar') extras.add(wrongTrait);
  return {
    wrong: !!wrong, wrongTrait,
    seed, girl,
    height: 0.92 + r() * 0.2,
    headRx: 82 + r() * 18, headRy: 90 + r() * 18,
    skin: 0.78 + r() * 0.1,
    hair: pick(girl ? HAIR_GIRL : HAIR_BOY), hairTone: 0.07 + r() * 0.36,
    eyes: wrongTrait === 'eyes' ? pick(EYES_WRONG) : pick(EYES_OK), mouth: wrongTrait === 'mouth' ? pick(MOUTHS_WRONG) : pick(MOUTHS_OK), nose: pick(NOSES),
    jumper: 0.22 + r() * 0.3, pinafore: girl && r() < 0.65, tie: !girl && r() < 0.4, cardigan: r() < 0.25,
    socks: r() < 0.5 ? 'long' : 'short',
    holds: pick(['paper', 'paper', 'pencil', 'empty', 'paper']),
    extras: [...extras],
    name: NAMES[Math.floor(r() * NAMES.length)],
    look: (r() - 0.5) * 8, // where the pupils point
  };
}

const SK = (t) => ({ tone: t, vary: 0.04, w: 7, len: [0.03, 0.09], angJit: 0.15, sheen: 0.15, sheenTone: Math.min(0.96, t + 0.09), edgeTone: t - 0.18 });
const DK = (t) => ({ tone: t, vary: 0.05, w: 6, sheen: 0.18, sheenTone: t + 0.16, edgeTone: Math.max(0.02, t - 0.06) });
const PL = { tone: 0.93, w: 5, vary: 0.03, edge: 0.5, edgeTone: 0.78 };

function about(p, x, y, ang, fn) { const c = p.ctx; c.save(); c.translate(x, y); c.rotate(ang); c.translate(-x, -y); fn(); c.restore(); }

// body, front or back (the same silhouette both ways)
function body(p, k, back) {
  const J = { tone: k.jumper, vary: 0.05, w: 8, sheen: 0.2, sheenTone: k.jumper + 0.12, edgeTone: k.jumper - 0.1 };
  const pins = [];
  p.shadow(ellipse(210, 640, 118, 13), 0, 0, 10, 0.4);
  for (const [top, foot, s] of [[[182, 500], [178, 606], -1], [[238, 500], [242, 606], 1]]) {
    piece(p, p.limb([top, [top[0] + s * 2, 560]], 24, 20), SK(k.skin - 0.04));
    const sockTop = k.socks === 'long' ? 520 : 572;
    piece(p, p.limb([[top[0] + s * 2, sockTop], foot], 22, 22), { ...PL, tone: 0.86, w: 4 }, [3, 5, 4, 0.35]);
    piece(p, blob(p, foot[0] + s * 8, 616, 24, 11, 10, 0.1), { ...DK(0.07), angle: 0 });
  }
  if (k.pinafore) piece(p, [[150, 420], [270, 420], [290, 528], [210, 536], [130, 528]], { ...DK(Math.max(0.12, k.jumper - 0.1)), angle: Math.PI / 2 });
  else piece(p, [[148, 436], [272, 436], [282, 518], [226, 522], [210, 488], [194, 522], [138, 518]], DK(0.2));
  pins.push([182, 500, 6], [238, 500, 6]);
  // arms
  if (back) {
    piece(p, p.limb([[150, 318], [140, 380], [160, 420]], 30, 24), J);
    piece(p, p.limb([[270, 318], [280, 380], [260, 420]], 30, 24), J);
  } else {
    piece(p, p.limb([[152, 318], [134, 390], [124, 448]], 30, 24), J);
    piece(p, p.limb([[268, 318], [286, 390], [296, 446]], 30, 24), J);
    if (k.holds === 'paper') {
      piece(p, [[86, 450], [140, 446], [146, 520], [92, 526]], { ...PL, tone: 0.95, w: 3, angle: 0 }, [3, 4, 4, 0.35]);
      for (let i = 0; i < 5; i++) p.brush([[96, 462 + i * 11], [p.rand(118, 136), 462 + i * 11 + p.rand(-2, 2)]], { w: 1.4, tone: 0.35, bristles: 1, body: false, dry: 0.3 });
    }
    piece(p, blob(p, 124, 460, 15, 15, 9, 0.12), SK(k.skin));
    piece(p, blob(p, 298, 458, 15, 15, 9, 0.12), SK(k.skin));
    if (k.holds === 'pencil' || k.holds === 'paper') piece(p, p.limb([[290, 440], [322, 494]], 7, 6), { tone: 0.62, w: 2, edge: 0 }, [2, 3, 3, 0.4]);
  }
  pins.push([152, 320, 6.5], [268, 320, 6.5]);
  const torso = [[156, 298], [264, 298], [284, 330], [278, 452], [142, 452], [136, 330]];
  piece(p, torso, J, [8, 10, 10, 0.35]);
  if (!back) {
    piece(p, [[186, 300], [210, 334], [234, 300], [222, 296], [210, 312], [198, 296]], { ...PL, tone: 0.9, w: 3 }, [2, 3, 3, 0.4]);
    if (k.tie) piece(p, [[205, 318], [215, 318], [218, 380], [210, 392], [202, 380]], { ...DK(0.12), angle: Math.PI / 2 }, [2, 3, 3, 0.4]);
    if (k.pinafore) piece(p, [[166, 330], [254, 330], [258, 440], [162, 440]], { ...DK(Math.max(0.12, k.jumper - 0.1)), angle: Math.PI / 2 }, [3, 4, 4, 0.35]);
    if (k.cardigan) for (const y of [350, 380, 410]) p.pin(214, y, 4);
    // the name tag
    piece(p, [[226, 346], [270, 344], [272, 368], [228, 370]], { ...PL, tone: 0.92, w: 3 }, [2, 3, 3, 0.35]);
    label(p, k.name, 249, 357, { size: 10, font: 'cursive', weight: 'normal', col: 'rgba(40,40,46,0.9)' });
    p.staple(226, 348, 236, 344);
  }
  return pins;
}

function hairBack(p, k, back) {
  const H = DK(k.hairTone), cx = 210, cy = 182, rx = k.headRx, ry = k.headRy;
  const top = cy - ry;
  if (k.hair === 'bob' || k.hair === 'long') piece(p, [[cx - rx - 12, cy - 30], [cx - rx + 4, top + 20], [cx, top - 6], [cx + rx - 4, top + 20], [cx + rx + 12, cy - 30], [cx + rx + 16, cy + (k.hair === 'long' ? 150 : 70)], [cx + rx - 16, cy + (k.hair === 'long' ? 160 : 80)], [cx - rx + 16, cy + (k.hair === 'long' ? 160 : 80)], [cx - rx - 16, cy + (k.hair === 'long' ? 150 : 70)]], H, [4, 6, 6, 0.4]);
  if (k.hair === 'pigtails') for (const s of [-1, 1]) piece(p, p.limb([[cx + s * (rx - 10), cy - 40], [cx + s * (rx + 34), cy - 10], [cx + s * (rx + 44), cy + 50]], 34, 18), H, [3, 5, 5, 0.4]);
  if (k.hair === 'plaits') for (const s of [-1, 1]) { const x = cx + s * (rx - 18); piece(p, p.limb([[x, cy + 10], [x + s * 8, cy + 90], [x + s * 4, cy + 150]], 22, 14), H, [3, 5, 5, 0.4]); for (let i = 0; i < 6; i++) p.brush([[x - 9 + s * 2, cy + 30 + i * 20], [x + 9 + s * 4, cy + 40 + i * 20]], { w: 2, tone: Math.max(0, k.hairTone - 0.06), bristles: 2, body: false }); }
  if (back) return;
}

function hairFront(p, k, back) {
  const H = DK(k.hairTone), cx = 210, cy = 182, rx = k.headRx, ry = k.headRy, top = cy - ry, staples = [];
  const cap = (depth) => piece(p, [[cx - rx + 2, cy - ry * 0.25], [cx - rx + 10, top + 30], [cx - rx * 0.45, top + 6], [cx, top - 4], [cx + rx * 0.45, top + 6], [cx + rx - 10, top + 30], [cx + rx - 2, cy - ry * 0.25], [cx + rx * 0.6, top + depth], [cx + rx * 0.2, top + depth + 14], [cx - rx * 0.2, top + depth], [cx - rx * 0.6, top + depth + 12]], H, [4, 6, 6, 0.4]);
  if (back) {
    // from behind the hair covers the head
    piece(p, blob(p, cx, cy, rx, ry, 16, 0.05), { ...H, angle: Math.PI / 2 }, [8, 12, 10, 0.38]);
    for (let i = 0; i < 16; i++) { const x = cx - rx * 0.8 + i * rx * 0.1; p.brush([[x, top + 20 + Math.abs(i - 8) * 3], [x + p.rand(-6, 6), cy + ry * 0.75 - Math.abs(i - 8) * 2]], { w: 2, tone: Math.max(0.02, k.hairTone - 0.08), bristles: 2, body: false, alpha: 0.6 }); }
  } else if (k.hair === 'buzz') {
    p.fill(blob(p, cx, top + 30, rx * 0.9, 34, 12, 0.08), { tone: k.hairTone, w: 3, angJit: Math.PI, alpha: 0.55, edge: 0 });
  } else if (k.hair === 'fringe') {
    cap(52);
    for (let i = 0; i < 12; i++) { const x = cx - rx * 0.7 + i * rx * 0.13; p.brush([[x, top + 24], [x + p.rand(-4, 4), top + 64 + p.rand(-6, 10)]], { w: 4, tone: k.hairTone, bristles: 3, body: false }); }
  } else if (k.hair === 'curls') {
    for (let i = 0; i < 14; i++) { const a = Math.PI * (1.05 + (i / 13) * 0.9); piece(p, ellipse(cx + Math.cos(a) * rx * 1.02, cy - 10 + Math.sin(a) * ry * 0.95, 20, 18, 10), { ...H, angJit: Math.PI }, [2, 3, 3, 0.35]); }
  } else if (k.hair === 'bun') {
    cap(34); piece(p, ellipse(cx, top - 14, 34, 28, 12), H, [3, 4, 4, 0.4]); staples.push([cx - 12, top - 6, cx + 12, top - 2]);
  } else {
    cap(k.hair === 'parted' ? 40 : k.hair === 'bob' || k.hair === 'long' ? 48 : 44);
    if (k.hair === 'parted') p.brush([[cx + rx * 0.3, top + 4], [cx + rx * 0.2, top + 40]], { w: 2, tone: Math.min(0.9, k.hairTone + 0.3), bristles: 1, body: false });
  }
  if (k.hair === 'tufts') {
    piece(p, p.limb([[cx - 24, top + 6], [cx - 34, top - 24], [cx - 52, top - 48]], 12, 5), DK(k.hairTone), [3, 4, 4, 0.4]);
    piece(p, p.limb([[cx + 22, top + 4], [cx + 36, top - 26], [cx + 58, top - 44]], 12, 5), DK(k.hairTone), [3, 4, 4, 0.4]);
    staples.push([cx - 32, top + 2, cx - 16, top - 8], [cx + 16, top - 6, cx + 32, top + 4]);
  }
  if (k.hair === 'cowlick') piece(p, p.limb([[cx + 6, top + 2], [cx + 14, top - 26], [cx - 6, top - 38]], 12, 4), DK(k.hairTone), [3, 4, 4, 0.4]);
  if (k.extras.includes('bow')) { const bx = k.hair === 'pigtails' ? cx + rx + 26 : cx + rx * 0.5, by = k.hair === 'pigtails' ? cy - 26 : top + 14; piece(p, [[bx - 26, by - 14], [bx, by], [bx - 26, by + 14]], { tone: 0.7, w: 3, edge: 0.4 }, [2, 3, 3, 0.4]); piece(p, [[bx + 26, by - 14], [bx, by], [bx + 26, by + 14]], { tone: 0.7, w: 3, edge: 0.4 }, [2, 3, 3, 0.4]); p.pin(bx, by, 5); }
  return staples;
}

function face(p, k) {
  const cx = 210, cy = 182, rx = k.headRx, staples = [], pins = [], ex = rx * 0.4, ey = cy - 8, lk = k.look;
  const eye = (x, r) => { piece(p, ellipse(x, ey, r, r * 1.12, 14), PL, [2, 3, 3, 0.45]); return x; };
  switch (k.eyes) {
    case 'mismatch': eye(cx - ex, 26); p.brush([[cx - ex + lk, ey + 8], [cx - ex + lk + 1, ey + 10]], { w: 9, tone: 0.05, taper: 0 }); eye(cx + ex, 13); pins.push([cx + ex, ey, 5]); break;
    case 'round': for (const s of [-1, 1]) { eye(cx + s * ex, 20); p.brush([[cx + s * ex + lk, ey + 2], [cx + s * ex + lk + 1, ey + 3]], { w: 10, tone: 0.04, taper: 0 }); } break;
    case 'dots': for (const s of [-1, 1]) p.brush([[cx + s * ex + lk * 0.5, ey], [cx + s * ex + lk * 0.5 + 1, ey + 1]], { w: 9, tone: 0.04, taper: 0 }); break;
    case 'buttons': for (const s of [-1, 1]) { piece(p, ellipse(cx + s * ex, ey, 15, 15, 12), DK(0.15), [2, 3, 3, 0.4]); for (const [dx, dy] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) p.brush([[cx + s * ex + dx, ey + dy], [cx + s * ex + dx + 0.5, ey + dy + 0.5]], { w: 3, tone: 0.8, taper: 0 }); } break;
    case 'stapled': eye(cx + ex, 18); p.brush([[cx + ex + lk, ey + 2], [cx + ex + lk + 1, ey + 3]], { w: 9, tone: 0.04, taper: 0 }); staples.push([cx - ex - 14, ey - 10, cx - ex + 14, ey + 10], [cx - ex + 14, ey - 10, cx - ex - 14, ey + 10]); break;
    case 'glasses': for (const s of [-1, 1]) { eye(cx + s * ex, 18); p.brush([[cx + s * ex + lk, ey + 2], [cx + s * ex + lk + 1, ey + 3]], { w: 7, tone: 0.04, taper: 0 }); const c = p.ctx; c.save(); c.lineWidth = 3; c.strokeStyle = 'rgba(16,14,12,0.9)'; c.beginPath(); c.arc(cx + s * ex, ey, 23, 0, 7); c.stroke(); c.restore(); } p.brush([[cx - ex + 23, ey], [cx + ex - 23, ey]], { w: 2.5, tone: 0.08, bristles: 2, body: false }); break;
    case 'hollow': for (const s of [-1, 1]) piece(p, ellipse(cx + s * ex, ey, 18, 22, 12), DK(0.03), [1, 2, 2, 0.4]); break;
    default: for (const s of [-1, 1]) { p.brush([[cx + s * ex - 16, ey + 2], [cx + s * ex, ey + 8], [cx + s * ex + 16, ey + 2]], { w: 3.5, tone: 0.08, bristles: 3, body: false }); } // sleepy
  }
  const ny = cy + 18;
  if (k.nose === 'point') piece(p, [[cx - 4, ny - 12], [cx + 26, ny + 14], [cx - 6, ny + 18]], { ...SK(k.skin - 0.08), w: 3 }, [3, 4, 4, 0.4]);
  else if (k.nose === 'long') piece(p, [[cx - 6, ny - 16], [cx + 8, ny - 16], [cx + 42, ny + 26], [cx - 2, ny + 22]], { ...SK(k.skin - 0.08), w: 3 }, [3, 4, 4, 0.4]);
  else if (k.nose === 'round') piece(p, ellipse(cx, ny + 4, 13, 11, 10), { ...SK(k.skin - 0.08), w: 3 }, [2, 3, 3, 0.4]);
  else if (k.nose === 'button') pins.push([cx, ny + 4, 4.5]);
  const my = cy + 54;
  switch (k.mouth) {
    case 'grin': case 'toothy': {
      const w = k.mouth === 'toothy' ? 70 : 58;
      piece(p, [[cx - w, my - 8], [cx - w * 0.4, my + 4], [cx + w * 0.4, my + 4], [cx + w, my - 10], [cx + w * 0.86, my + 12], [cx + w * 0.4, my + 26], [cx - w * 0.4, my + 26], [cx - w * 0.86, my + 12]], PL, [2, 3, 3, 0.5]);
      for (let i = 0; i <= 10; i++) { const x = cx - w * 0.85 + i * w * 0.17; p.brush([[x, my - 2 + Math.abs(i - 5) * -0.6], [x + 0.5, my + 20 - Math.abs(i - 5) * 1.2]], { w: 1.8, tone: 0.1, bristles: 2, body: false }); }
      staples.push([cx - w - 6, my - 14, cx - w + 6, my + 2], [cx + w - 6, my - 16, cx + w + 6, my]);
      break;
    }
    case 'flat': p.brush([[cx - 40, my + 6], [cx + 40, my + 6]], { w: 4, tone: 0.08, bristles: 3, body: false }); break;
    case 'o': piece(p, ellipse(cx, my + 8, 14, 18, 12), DK(0.04), [1, 2, 2, 0.4]); break;
    case 'stitched': p.brush([[cx - 40, my + 6], [cx + 40, my + 6]], { w: 3, tone: 0.08, bristles: 2, body: false }); for (let i = 0; i < 6; i++) staples.push([cx - 34 + i * 14, my - 2, cx - 30 + i * 14, my + 14]); break;
    case 'sad': p.brush([[cx - 36, my + 16], [cx, my + 2], [cx + 36, my + 16]], { w: 4, tone: 0.08, bristles: 3, body: false }); break;
    case 'smile': p.brush([[cx - 36, my], [cx, my + 14], [cx + 36, my]], { w: 4, tone: 0.08, bristles: 3, body: false }); break;
    default: break; // no mouth at all
  }
  if (k.extras.includes('freckles')) for (let i = 0; i < 14; i++) p.brush([[cx + p.rand(-rx * 0.6, rx * 0.6), cy + p.rand(10, 36)], [cx + p.rand(-rx * 0.6, rx * 0.6), cy + p.rand(10, 36)]], { w: 2.5, tone: 0.5, bristles: 1, body: false, alpha: 0.7, steps: 1 });
  if (k.extras.includes('plaster')) { const x = cx - rx * 0.55, y = cy + 26; p.fill([[x - 14, y - 6], [x + 14, y - 6], [x + 14, y + 6], [x - 14, y + 6]], { tone: 0.86, w: 2, edge: 0 }); p.brush([[x - 9, y - 4], [x + 9, y + 4]], { w: 1.4, tone: 0.5, bristles: 1, body: false }); p.brush([[x - 9, y + 4], [x + 9, y - 4]], { w: 1.4, tone: 0.5, bristles: 1, body: false }); }
  if (k.extras.includes('scribble')) for (let i = 0; i < 10; i++) p.brush([[cx + p.rand(-30, 30), cy + p.rand(-40, 20)], [cx + p.rand(-30, 30), cy + p.rand(-40, 20)]], { w: 2.5, rgb: [26, 24, 24], alpha: 0.75, body: false, bristles: 2 });
  if (k.extras.includes('soot')) for (let i = 0; i < 18; i++) p.brush([[cx + p.rand(-rx * 0.8, rx * 0.8), cy + p.rand(-60, 60)], [cx + p.rand(-rx * 0.8, rx * 0.8), cy + p.rand(-60, 60)]], { w: p.rand(4, 10), tone: 0.15, alpha: 0.18, body: false, dry: 0.5 });
  if (k.extras.includes('bandage')) { p.fill([[cx - rx, cy - 48], [cx + rx, cy - 58], [cx + rx, cy - 34], [cx - rx, cy - 24]], { tone: 0.9, w: 4, edge: 0.4, alpha: 0.95 }); }
  return { staples, pins };
}

// one kid, front or back; snap tips the head down on its neck pin
export function paintKid(p, k, { back = false, snap = 0 } = {}) {
  const pins = body(p, k, back);
  if (snap > 0.3) { piece(p, p.limb([[210, 296], [210, 318]], 30, 26), SK(k.skin - 0.1)); p.brush([[196, 300], [224, 306]], { w: 2, tone: 0.12, bristles: 2, body: false }); }
  about(p, 210, 296, snap, () => {
    const st = [], pn = [];
    piece(p, p.limb([[210, 270], [210, 300]], 32, 28), SK(k.skin - 0.06));
    hairBack(p, k, back);
    const rx = k.headRx;
    for (const s of [-1, 1]) {
      if (k.extras.includes('tornEar') && s > 0) continue;
      piece(p, blob(p, 210 + s * (rx + 6), 188, 16, 24, 8, 0.1), SK(k.skin), [3, 4, 4, 0.3]);
      pn.push([210 + s * (rx + 6), 188, 4]);
    }
    if (!back) piece(p, blob(p, 210, 182, rx, k.headRy, 16, 0.05), { ...SK(k.skin), angle: Math.PI / 2 }, [8, 12, 10, 0.38]);
    if (!back) { const f = face(p, k); st.push(...f.staples); pn.push(...f.pins); }
    st.push(...hairFront(p, k, back));
    for (const s of st) p.staple(...s);
    for (const [x, y, r] of pn) p.pin(x, y, r);
  });
  pins.push([210, 296, 7]);
  for (const [x, y, r] of pins) p.pin(x, y, r);
  if (!back && k.extras.includes('soot')) goldStar(p, 250, 420, 6, 0.4, [1, 1, 1, 0.3]);
}

// a life-size road-safety cut-out ("STOP, LOOK, LISTEN"): painted plywood, a lollipop sign, a fixed
// smile, on a little stand. The perfect false scare in a game made of flat cards.
export function roadSafetyCutout(p) {
  p.shadow(ellipse(210, 960, 120, 12), 0, 0, 10, 0.4);
  piece(p, [[160, 930], [260, 930], [276, 960], [144, 960]], { tone: 0.3, w: 5, angle: 0 }, [3, 4, 4, 0.4]);
  // the coat: a long pale coat, a cap
  piece(p, [[130, 330], [290, 330], [312, 900], [108, 900]], { tone: 0.82, w: 8, angle: Math.PI / 2, edgeTone: 0.6 }, [8, 10, 10, 0.4]);
  for (const y of [470, 520]) p.fill([[112, y], [308, y], [306, y + 22], [114, y + 22]], { tone: 0.35, w: 4, edge: 0 });
  piece(p, blob(p, 210, 230, 70, 82, 14, 0.05), { tone: 0.82, w: 5, angle: Math.PI / 2 }, [6, 8, 8, 0.4]);
  piece(p, [[132, 180], [288, 180], [270, 130], [150, 130]], { tone: 0.15, w: 5, angle: 0 }, [3, 4, 4, 0.4]);
  for (const s of [-1, 1]) p.brush([[210 + s * 26, 222], [211 + s * 26, 223]], { w: 9, tone: 0.05, taper: 0 });
  p.brush([[176, 268], [210, 286], [244, 268]], { w: 4, tone: 0.1, bristles: 3, body: false });
  // the arm up, holding the lollipop sign
  piece(p, p.limb([[286, 360], [330, 300], [350, 220]], 34, 28), { tone: 0.8, w: 5 });
  piece(p, p.limb([[352, 230], [356, 30]], 12, 12), { tone: 0.75, w: 3, angle: Math.PI / 2 });
  piece(p, ellipse(356, 40, 70, 70, 20), { tone: 0.9, w: 5, edge: 0.5 }, [4, 6, 6, 0.4]);
  piece(p, ellipse(356, 40, 58, 58, 20), { tone: 0.28, w: 4, edge: 0 }, [0, 0, 1, 0]);
  label(p, 'STOP', 356, 42, { size: 30, col: 'rgba(240,236,226,0.95)' });
  label(p, 'LOOK   LISTEN', 210, 610, { size: 24, col: 'rgba(30,28,26,0.85)' });
  p.pin(286, 360, 7); p.pin(210, 312, 7);
}
