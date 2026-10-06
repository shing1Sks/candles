// Concept designs from the user's doodles (research/img/01_concepts_hands_entity.png).
// THROWAWAY spike code. Each design paints onto a transparent card of size [W, H].
// Look: grey oil paint on cut paper; parts are joined by split pins (joints) and staples.
// Every pin is a pivot the game will animate later.
import { ellipse } from './paint.js';

// The only colour in the world: what drips out of the entity and blooms in the far field.
export const COLOURS = [[205, 38, 52], [232, 166, 28], [38, 92, 205], [28, 156, 104], [205, 52, 150]];

export function blob(p, cx, cy, rx, ry, n = 14, rough = 0.18) {
  const ph = p.rand(0, 100);
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const r = 1 + (p.noise(ph + i * 0.7) - 0.5) * 2 * rough;
    return [cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r];
  });
}

// Leafy, scalloped outline for canopy clusters.
export function scallop(p, cx, cy, rx, ry, n = 28, bumps = 9) {
  const ph = p.rand(0, 100);
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const r = 1 + 0.1 * Math.abs(Math.sin((a * bumps) / 2)) + (p.noise(ph + i * 0.5) - 0.5) * 0.25;
    return [cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r];
  });
}

export function leaf(p, x, y, s, ang, tone) {
  const c = p.ctx;
  c.save();
  c.translate(x, y);
  c.rotate(ang);
  p.brush([[0, 0], [s * 0.5, -s * 0.28], [s, 0]], { w: s * 0.32, tone, bristles: 4, body: true });
  p.brush([[0, 0], [s * 0.5, s * 0.22], [s, 0]], { w: s * 0.28, tone: tone - 0.12, bristles: 3, body: true });
  c.restore();
}

// A cut-paper piece: cast shadow, painted fill, paper edge.
export function piece(p, poly, o, sh = [6, 9, 7, 0.38]) {
  p.shadow(poly, ...sh);
  p.fill(poly, o);
  p.paperEdge(poly, (o.tone ?? 0.5) + 0.1);
}

// ---------------------------------------------------------------------------
// THE ENTITY: a paper puppet, pinned at every joint. Cat-eared, smiling.
// One friendly side waving; the other melting, colour dripping out on stapled paper strips.
export const entity = {
  name: 'entity', W: 700, H: 1000,
  caption: 'The entity: a paper puppet pinned at every joint. One eye stapled on, one pinned. One side waves; the other melts, the lost colour dripping out of it.',
  draw(p) {
    const DARK = { tone: 0.08, vary: 0.05, w: 12, sheen: 0.18, sheenTone: 0.3, edgeTone: 0.08 };
    const PALE = { tone: 0.86, w: 5, vary: 0.05, edge: 0.5, edgeTone: 0.72 };
    const pins = [], staples = [];

    // pool at its feet, with scraps of colour in it
    p.shadow(ellipse(340, 962, 220, 26), 0, 0, 16, 0.4);
    piece(p, blob(p, 330, 958, 170, 16, 16, 0.25), { ...DARK, tone: 0.06, angle: 0, angJit: 0.1 }, [0, 4, 8, 0.4]);
    for (let i = 0; i < 4; i++) {
      piece(p, blob(p, p.rand(220, 310), p.rand(950, 964), p.rand(14, 24), p.rand(4, 6), 10, 0.3),
        { rgb: COLOURS[i], w: 4, angle: 0, angJit: 0.1, alpha: 0.9, edge: 0, tone: 0.5 }, [1, 2, 3, 0.4]);
    }

    // legs: shin + thigh, pinned at knee and hip
    for (const [hip, knee, foot, s] of [[[322, 585], [316, 772], [306, 948], -1], [[384, 585], [392, 772], [402, 948], 1]]) {
      piece(p, p.limb([[knee[0], knee[1] - 10], foot], 28, 22), { ...DARK, tone: 0.07 });
      piece(p, blob(p, foot[0] + s * 12, foot[1] + 4, 22, 9, 10, 0.1), { ...DARK, tone: 0.07, angle: 0 });
      piece(p, p.limb([[hip[0], hip[1] - 14], [knee[0], knee[1] + 12]], 38, 30), { ...DARK, tone: 0.09 });
      pins.push([...knee, 8.5], [...hip, 8.5]);
    }

    // torso
    const torso = [[300, 286], [372, 270], [432, 292], [426, 380], [410, 470], [404, 560], [392, 612], [318, 612], [302, 560], [290, 470], [286, 380]];
    piece(p, torso, { ...DARK, w: 14 }, [10, 14, 12, 0.32]);
    p.fill([[410, 300], [430, 296], [424, 400], [408, 500], [398, 400]], { tone: 0.3, w: 7, alpha: 0.4, base: false, edge: 0 });

    // the melting side: a sagging mass pinned at the shoulder, colour veins running through it
    const melt = [[302, 292], [262, 312], [232, 370], [216, 450], [220, 540], [230, 612], [240, 566], [252, 640], [262, 580], [274, 618], [284, 548], [296, 470], [300, 380]];
    piece(p, melt, { ...DARK, tone: 0.1, w: 12 });
    for (let i = 0; i < 10; i++) {
      const x = p.rand(232, 292), y = p.rand(360, 540);
      p.brush([[x, y], [x + p.rand(-6, 6), y + 30], [x + p.rand(-8, 8), y + p.rand(50, 90)]],
        { w: p.rand(2, 5), rgb: COLOURS[i % COLOURS.length], alpha: 0.55, taper: 1, body: false });
    }
    // drips: paper strips hanging behind the melting side, some carrying colour, stapled on
    for (let i = 0; i < 13; i++) {
      const t = i / 12;
      const x = 226 + t * 66 + p.rand(-4, 4), y0 = 560 + p.rand(0, 40);
      const col = i % 4 === 1 ? COLOURS[(i / 4) | 0] : null;
      const L = (col ? p.rand(90, 220) : p.rand(60, 330)) * (0.7 + t * 0.5);
      const w = col ? p.rand(8, 11) : p.rand(10, 16);
      const end = [x + p.rand(-8, 8), Math.min(940, y0 + L)];
      const strip = p.limb([[x, y0], [x + p.rand(-6, 6), (y0 + end[1]) / 2], end], w, w * 0.55);
      piece(p, strip, col ? { rgb: col, tone: 0.5, w: 4, alpha: 0.95, angle: Math.PI / 2, angJit: 0.1, edge: 0 } : { ...DARK, w: 6, edge: 0.3 }, [4, 6, 5, 0.35]);
      piece(p, blob(p, end[0], end[1], w * 0.55, w * 0.7, 8, 0.12), col ? { rgb: col, tone: 0.5, w: 3, alpha: 0.95, edge: 0 } : { ...DARK, w: 3, edge: 0 }, [3, 4, 4, 0.3]);
      if (col || p.r() < 0.4) staples.push([x - 7, y0 + p.rand(-4, 4), x + 7, y0 - 4 + p.rand(-4, 4)]);
    }

    pins.push([296, 312, 9]);

    // waving arm: upper arm, forearm, hand, each finger its own strip; pinned at every joint
    piece(p, p.limb([[416, 298], [512, 350]], 32, 26), DARK);
    piece(p, p.limb([[510, 360], [540, 206]], 26, 20), { ...DARK, angle: -1.4 });
    pins.push([420, 302, 9], [508, 350, 8.5]);
    const fingers = [[-0.55, 72, -14], [-0.2, 86, -8], [0.15, 84, 6], [0.5, 68, 14]];
    const knuckles = [];
    for (const [a, L, bend] of fingers) {
      const bx = 547 + Math.sin(a) * 15, by = 176 - Math.cos(a) * 14;
      const dx = Math.sin(a), dy = -Math.cos(a);
      piece(p, p.limb([[bx, by + 6], [bx + dx * L * 0.5 + bend, by + dy * L * 0.5], [bx + dx * L + bend * 2.6, by + dy * L + L * 0.2]], 11, 6),
        { ...DARK, w: 5, angle: Math.atan2(dy, dx), angJit: 0.2, edge: 0.6 }, [3, 5, 4, 0.35]);
      knuckles.push([bx, by, 3.2]);
    }
    piece(p, p.limb([[536, 200], [512, 184], [494, 162]], 11, 6), { ...DARK, w: 5, edge: 0.6 }, [3, 5, 4, 0.35]);
    piece(p, blob(p, 547, 192, 20, 25, 10, 0.12), DARK);
    pins.push([541, 210, 7], ...knuckles, [532, 196, 3.2]);

    // head: ears are separate pieces pinned on
    piece(p, [[282, 152], [270, 60], [326, 126]], { ...DARK, tone: 0.06 });
    piece(p, [[380, 124], [428, 56], [418, 150]], { ...DARK, tone: 0.06 });
    const head = [[288, 252], [276, 196], [290, 146], [318, 124], [350, 118], [384, 122], [412, 148], [424, 198], [410, 254], [350, 280]];
    piece(p, head, { ...DARK, tone: 0.05, w: 10, angle: Math.PI / 2 + 0.2 }, [8, 12, 10, 0.38]);
    pins.push([302, 146, 6.5], [398, 142, 6.5]);

    // eyes: the melting-side eye is stapled on and runs; the other has a pin for a pupil
    const eyeL = [[308, 182], [322, 166], [336, 182], [334, 204], [326, 226], [318, 206]];
    piece(p, eyeL, PALE, [2, 3, 3, 0.5]);
    p.brush([[326, 226], [322, 262], [318, 312]], { w: 4, rgb: COLOURS[0], alpha: 0.9, taper: 0.6, body: false });
    staples.push([309, 174, 335, 198], [335, 172, 310, 200]);
    piece(p, ellipse(378, 184, 16, 20), PALE, [2, 3, 3, 0.5]);
    pins.push([378, 186, 6.5]);

    // the smile: a pale strip, too wide, too many teeth, stapled at the corners
    piece(p, [[294, 232], [350, 236], [406, 218], [398, 238], [372, 256], [350, 262], [322, 260], [300, 248]], PALE, [2, 3, 3, 0.5]);
    for (let i = 0; i < 11; i++) {
      const x = 304 + i * 9.5, t = (x - 350) / 56;
      const y = 236 - (x - 350) * 0.12 - t * t * 4;
      p.brush([[x, y], [x + 0.5, y + 13 - t * t * 6]], { w: 2.4, tone: 0.08, bristles: 2, taper: 0.5, body: false });
    }
    staples.push([290, 228, 302, 246], [400, 212, 408, 230]);
    pins.push([350, 284, 9]);

    for (const s of staples) p.staple(...s);
    for (const [x, y, r] of pins) p.pin(x, y, r);
  },
};

// ---------------------------------------------------------------------------
// THE BOY'S HANDS: first person, big and close. Fingers are paper strips pinned at the knuckles,
// which is why they flop. Back of a right hand, wrist at (0,0), fingers pointing up (-y).
const PALM = [[-50, 0], [-62, -70], [-60, -118], [-34, -138], [4, -146], [40, -134], [60, -110], [60, -60], [52, 0]];
const FINGERS = [[-62, -82, -1.0, 64, -10], [-44, -126, -0.12, 92, -18], [-8, -138, 0.0, 104, -8], [26, -130, 0.1, 96, 6], [50, -112, 0.26, 72, 16]];

function arm(p, x, y, rot, mirror) {
  const c = p.ctx;
  c.save();
  c.translate(x, y);
  if (mirror) c.scale(-1, 1);
  c.rotate(rot);
  const SKIN = { tone: 0.8, vary: 0.05, w: 8, len: [0.03, 0.09], angJit: 0.12, sheen: 0.18, sheenTone: 0.9, edgeTone: 0.64 };
  // a dark sleeve, so the pale hand reads clearly
  const fore = p.limb([[0, 10], [-14, 140], [-34, 300]], 112, 156);
  piece(p, fore, { tone: 0.36, vary: 0.06, w: 12, angle: Math.PI / 2 - 0.1, sheen: 0.2, sheenTone: 0.5, edgeTone: 0.3 }, [8, 10, 10, 0.25]);
  p.fill(p.limb([[34, 20], [24, 140], [10, 300]], 22, 44), { tone: 0.22, w: 8, alpha: 0.5, edge: 0 });
  c.scale(-1, 1); // thumb toward the middle of the screen: we see the backs of the hands

  const pins = [];
  for (const [bx, by, a, L, flop] of FINGERS) {
    const dx = Math.sin(a), dy = -Math.cos(a);
    const pts = [[bx - dx * 10, by - dy * 10], [bx + dx * L * 0.5 + flop * 0.3, by + dy * L * 0.5], [bx + dx * L + flop, by + dy * L + Math.abs(flop) * 0.9]];
    piece(p, p.limb(pts, 30, 22), { ...SKIN, angle: Math.atan2(dy, dx) }, [5, 7, 6, 0.3]);
    pins.push([bx, by]);
  }
  piece(p, PALM, { ...SKIN, angle: -Math.PI / 2 }, [8, 10, 10, 0.28]);
  for (const [px, py] of pins) p.pin(px, py, 6);
  p.staple(-40, -14, -26, 12);
  p.staple(30, -12, 44, 12);
  c.restore();
}

export const hands = {
  name: 'hands', W: 1000, H: 560,
  caption: 'The boy (you): big paper hands, fingers pinned at the knuckles so they flop.',
  draw(p) {
    arm(p, 320, 450, 0.32, false);
    arm(p, 680, 450, 0.32, true);
  },
};

// ---------------------------------------------------------------------------
// TREE: cut-paper trunk; branches stapled on; leaf clumps pinned and stapled to them.
export const tree = {
  name: 'tree', W: 700, H: 1000,
  caption: 'Tree: paper trunk, branches stapled on, leaf clumps pinned in place. Leaves drift down.',
  draw(p) {
    const BARK = { tone: 0.3, vary: 0.08, w: 7, len: [0.04, 0.12], angJit: 0.08, sheen: 0.25, sheenTone: 0.48, edgeTone: 0.18 };
    p.shadow(ellipse(360, 975, 180, 18), 0, 0, 12, 0.3);
    const roots = [[[330, 940], [282, 970], [226, 984]], [[392, 944], [446, 972], [500, 982]]];
    for (const pts of roots) piece(p, p.limb(pts, 30, 10), { ...BARK, angle: 0 });
    const trunk = [[318, 984], [298, 952], [316, 760], [328, 520], [336, 330], [378, 330], [384, 520], [396, 760], [420, 952], [404, 986]];
    piece(p, trunk, BARK, [10, 10, 10, 0.3]);
    p.staple(300, 948, 318, 966); p.staple(398, 966, 416, 948);

    // canopy clumps, back to front, lit from above
    const clumps = [];
    for (let i = 0; i < 26; i++) {
      const a = p.rand(0, Math.PI * 2), r = Math.sqrt(p.r());
      clumps.push([350 + Math.cos(a) * r * 215, 255 + Math.sin(a) * r * 150, p.rand(52, 90), p.rand(40, 66), p.r()]);
    }
    clumps.sort((u, v) => u[4] - v[4]);
    // branches: separate strips stapled onto the trunk, reaching for the back clumps
    for (const [cx, cy] of clumps.slice(0, 7)) {
      const y0 = p.rand(400, 470);
      piece(p, p.limb([[357, y0], [(357 + cx) / 2 + p.rand(-20, 20), (y0 + cy) / 2], [cx, cy]], 20, 7), { ...BARK, angle: Math.atan2(cy - y0, cx - 357) });
      const ang = Math.atan2(cy - y0, cx - 357) + Math.PI / 2;
      p.staple(357 + Math.cos(ang) * 11, y0 + 8 + Math.sin(ang) * 11, 357 - Math.cos(ang) * 11, y0 + 8 - Math.sin(ang) * 11);
    }
    clumps.forEach(([cx, cy, rx, ry, d], i) => {
      const tone = 0.3 + d * 0.26 + ((255 - cy) / 150) * 0.06;
      const b = scallop(p, cx, cy, rx, ry, 22, 7);
      p.shadow(b, 6, 10, 8, 0.35);
      p.fill(b, { tone, w: 6, len: [0.04, 0.1], minLen: 8, density: 0.9, angJit: Math.PI, curve: 0.7, vary: 0.08, sheen: 0.25, edgeTone: tone - 0.14 });
      p.paperEdge(b, tone);
      for (let k = 0; k < 3; k++) leaf(p, cx + p.rand(-rx, rx) * 0.6, cy + p.rand(-ry, ry) * 0.6, p.rand(9, 13), p.rand(0, 6.3), tone + 0.12);
      if (i % 4 === 3) p.pin(cx + p.rand(-10, 10), cy + p.rand(-8, 8), 5);
      else if (i % 4 === 1) p.staple(cx - rx * 0.8, cy + ry * 0.5, cx - rx * 0.8 + 14, cy + ry * 0.5 + 10);
    });
    // drifting paper leaves
    for (let i = 0; i < 16; i++) leaf(p, p.rand(150, 580), p.rand(440, 940), p.rand(12, 18), p.rand(0, 6.3), p.rand(0.45, 0.65));
  },
};

// ---------------------------------------------------------------------------
// BUNNY: the world is grey but alive. A little paper puppet too.
export const bunny = {
  name: 'bunny', W: 420, H: 320,
  caption: 'Bunny: small, grey, alive, pinned together.',
  draw(p) {
    const FUR = { tone: 0.7, vary: 0.07, w: 6, len: [0.03, 0.08], minLen: 8, angJit: 0.4, curve: 0.4, sheen: 0.3, sheenTone: 0.86, edgeTone: 0.6 };
    const part = (poly, o, sh = [4, 6, 5, 0.32]) => piece(p, poly, { ...FUR, ...o }, sh);
    p.shadow(ellipse(205, 284, 140, 13), 0, 0, 8, 0.32);
    part(p.limb([[298, 120], [284, 70], [262, 22]], 26, 16), { tone: 0.62, angle: -2 });
    part(blob(p, 196, 208, 98, 70, 14, 0.06), { angle: 0.3 }, [6, 10, 8, 0.3]);
    part(blob(p, 150, 236, 52, 38, 10, 0.08), { tone: 0.64, angle: 0.8 });
    part(p.limb([[286, 236], [300, 262], [318, 272]], 22, 14), { tone: 0.68 });
    part(blob(p, 100, 196, 20, 18, 8, 0.25), { tone: 0.92, sheen: 0 });
    part(blob(p, 296, 160, 50, 44, 12, 0.06), { tone: 0.74, angle: 0.4 });
    part(p.limb([[314, 122], [312, 70], [300, 18]], 26, 16), { tone: 0.72, angle: -1.7 });
    p.fill(p.limb([[312, 112], [310, 70], [302, 34]], 9, 5), { tone: 0.9, w: 4, alpha: 0.7, edge: 0 });
    p.brush([[318, 150], [319, 153]], { w: 8, tone: 0.06, taper: 0 });
    p.brush([[320, 149], [320, 150]], { w: 2, tone: 0.95, taper: 0 });
    p.brush([[344, 172], [346, 174]], { w: 5, tone: 0.3, taper: 0 });
    for (const [x, y, r] of [[152, 232, 4.5], [288, 240, 4], [262, 186, 4.5], [300, 116, 3.5], [313, 118, 3.5]]) p.pin(x, y, r);
    p.staple(106, 188, 118, 204);
  },
};

// ---------------------------------------------------------------------------
// THE COLOUR FIELD: a paper diorama. Grey paper hills and grass in layers; far away,
// a mound of coloured paper flowers whose petals come loose and fade to grey as they rise.
const GREYC = [178, 176, 170];
const mix = (col, k) => col.map((ch, j) => Math.round(ch * (1 - k) + GREYC[j] * k));

// Plain cut-paper shape (fast, no brush texture): soft shadow, flat fill, paper edge.
export function cut(p, path, fill, sh = [1.5, 2, 2, 0.4]) {
  const c = p.ctx;
  // crisp two-step offset shadow (no blur filter: thousands of small pieces must stay fast)
  for (const k of [1, 0.5]) {
    c.save(); c.translate(sh[0] * k, sh[1] * k); c.fillStyle = `rgba(20,18,16,${sh[3] * 0.55})`; c.fill(path); c.restore();
  }
  c.fillStyle = fill; c.fill(path);
  c.save(); c.lineWidth = 0.8; c.strokeStyle = 'rgba(255,255,255,0.35)'; c.translate(-0.5, -0.5); c.stroke(path); c.restore();
}

export function paperFlower(p, x, y, s, col, kind) {
  const stem = new Path2D();
  const sw = Math.max(1.2, s * 0.14), sx = x + p.rand(-s * 0.2, s * 0.2);
  stem.moveTo(x - sw / 2, y); stem.lineTo(sx - sw / 2, y + s * 1.7); stem.lineTo(sx + sw / 2, y + s * 1.7); stem.lineTo(x + sw / 2, y); stem.closePath();
  cut(p, stem, p.grey(0.42));
  if (s > 9 && p.r() < 0.5) {
    const lf = new Path2D(); lf.ellipse(sx + s * 0.3, y + s * 1.1, s * 0.35, s * 0.12, -0.6, 0, Math.PI * 2);
    cut(p, lf, p.grey(0.46));
  }
  const rgb = `rgb(${col.join(',')})`;
  const rot = p.rand(0, Math.PI);
  if (kind === 0) { // five-petal rosette
    for (let k = 0; k < 5; k++) {
      const a = rot + (k * Math.PI * 2) / 5, pe = new Path2D();
      pe.ellipse(x + Math.cos(a) * s * 0.42, y + Math.sin(a) * s * 0.42, s * 0.42, s * 0.27, a, 0, Math.PI * 2);
      cut(p, pe, rgb);
    }
  } else if (kind === 1) { // tulip cup
    const t = new Path2D();
    [[-0.45, -0.05], [-0.5, -0.75], [-0.2, -0.45], [0, -0.85], [0.2, -0.45], [0.5, -0.75], [0.45, -0.05], [0, 0.15]]
      .forEach(([u, v], i) => (i ? t.lineTo(x + u * s, y + v * s) : t.moveTo(x + u * s, y + v * s)));
    t.closePath();
    cut(p, t, rgb);
  } else { // daisy
    for (let k = 0; k < 10; k++) {
      const a = rot + (k * Math.PI * 2) / 10, pe = new Path2D();
      pe.ellipse(x + Math.cos(a) * s * 0.5, y + Math.sin(a) * s * 0.5, s * 0.45, s * 0.12, a, 0, Math.PI * 2);
      cut(p, pe, rgb);
    }
  }
  if (kind !== 1) {
    if (s > 13) p.pin(x, y, s * 0.2);
    else { const cc = new Path2D(); cc.arc(x, y, s * 0.2, 0, Math.PI * 2); cut(p, cc, p.grey(0.88)); }
  }
}

function wavyLayer(p, top, amp, freq, from = -20, to = 1020) {
  const pts = [];
  const ph = p.rand(0, 10);
  for (let x = from; x <= to; x += 20) pts.push([x, top + Math.sin(x * freq + ph) * amp + (p.noise(ph + x * 0.02) - 0.5) * amp]);
  return [...pts, [to, 520], [from, 520]];
}

// A row of individual cut-paper grass blades; blades are skipped where the path runs through.
const PATH = { x0: 572, y0: 520, x1: 556, y1: 326, w0: 78, w1: 8 }; // path centre/half-width, bottom to top
function pathAt(y) {
  const t = (PATH.y0 - y) / (PATH.y0 - PATH.y1);
  return [PATH.x0 + (PATH.x1 - PATH.x0) * t, PATH.w0 + (PATH.w1 - PATH.w0) * t];
}
function grassRow(p, base, h, tone) {
  const [pc, pw] = pathAt(base);
  for (let x = -20; x < 1020; x += p.rand(5, 10)) {
    if (Math.abs(x - pc) < pw + p.rand(0, 10)) continue;
    const w = p.rand(7, 13), hh = h * p.rand(0.55, 1.2), lean = p.rand(-12, 12) + (x - 500) * 0.02;
    const y = base + p.rand(-4, 6);
    const blade = new Path2D();
    blade.moveTo(x - w / 2, y + 8);
    blade.quadraticCurveTo(x - w * 0.3 + lean * 0.3, y - hh * 0.5, x + lean, y - hh);
    blade.quadraticCurveTo(x + w * 0.3 + lean * 0.3, y - hh * 0.5, x + w / 2, y + 8);
    blade.closePath();
    cut(p, blade, p.grey(tone + p.rand(-0.04, 0.04)), [2, 2, 3, 0.35]);
  }
}

export const field = {
  name: 'colour_field', W: 1000, H: 500, scene: true,
  caption: 'The colour field: a paper diorama. Far away, a mound of paper flowers; petals come loose and fade to grey as they rise.',
  draw(p) {
    const c = p.ctx;
    const FX = 600;
    p.paper(1000, 500, 0.74);
    const sky = c.createLinearGradient(0, 0, 0, 260);
    sky.addColorStop(0, 'rgba(140,138,133,0.45)'); sky.addColorStop(1, 'rgba(210,208,203,0.5)');
    c.fillStyle = sky; c.fillRect(0, 0, 1000, 260);

    // far hills: two layers of cut grey paper, small paper trees on them
    const hills = [[228, 18, 0.006, 0.68], [250, 14, 0.009, 0.63]];
    hills.forEach(([top, amp, freq, tone], li) => {
      const poly = wavyLayer(p, top, amp, freq);
      p.shadow(poly, 3, -3, 5, 0.25);
      p.fill(poly, { tone, w: 16, angle: 0, angJit: 0.1, alpha: 1, vary: 0.04, edge: 0, len: [0.03, 0.08] });
      p.paperEdge(poly, tone);
      for (let i = 0; i < 9; i++) {
        const x = p.r() < 0.5 ? p.rand(0, 380) : p.rand(820, 1000), y = top + 6 + li * 6, s = p.rand(10, 20) * (1 + li * 0.3);
        const trunk = new Path2D(); trunk.rect(x - 1.5, y - s, 3, s);
        cut(p, trunk, p.grey(tone - 0.14));
        const crown = new Path2D();
        if (p.r() < 0.5) crown.arc(x, y - s * 1.3, s * 0.6, 0, Math.PI * 2);
        else { crown.moveTo(x - s * 0.55, y - s * 0.7); crown.lineTo(x, y - s * 2.3); crown.lineTo(x + s * 0.55, y - s * 0.7); crown.closePath(); }
        cut(p, crown, p.grey(tone - 0.1));
      }
    });

    // the flower mound: a small rise of paper, and the only colour in the world
    const mound = [];
    for (let x = FX - 280; x <= FX + 280; x += 20) mound.push([x, 286 - 26 * Math.cos(((x - FX) / 280) * (Math.PI / 2)) ** 2 + p.rand(-2, 2)]);
    const moundPoly = [...mound, [FX + 300, 340], [FX - 300, 340]];
    p.shadow(moundPoly, 3, -3, 5, 0.25);
    p.fill(moundPoly, { tone: 0.6, w: 12, angle: 0, angJit: 0.1, alpha: 1, vary: 0.04, edge: 0, len: [0.03, 0.08] });
    p.paperEdge(moundPoly, 0.6);
    const glow = c.createRadialGradient(FX, 272, 10, FX, 272, 260);
    glow.addColorStop(0, 'rgba(255,236,200,0.35)'); glow.addColorStop(1, 'rgba(255,236,200,0)');
    c.fillStyle = glow; c.fillRect(0, 0, 1000, 500);

    const flowers = [];
    for (let i = 0; i < 320; i++) {
      const u = (p.r() + p.r() - 1) * 1.05;
      const x = FX + u * 270, top = 286 - 26 * Math.cos(Math.min(1, Math.abs(u)) * (Math.PI / 2)) ** 2;
      const y = top + p.rand(4, 30) * (1 - Math.abs(u) * 0.5);
      flowers.push([x, y, u]);
    }
    flowers.sort((a, b) => a[1] - b[1]);
    for (const [x, y, u] of flowers) {
      const depth = (y - 262) / 40;
      const s = (5 + depth * 9) * p.rand(0.8, 1.2);
      const col = mix(COLOURS[(p.r() * 5) | 0], Math.min(1, Math.abs(u) ** 1.5));
      paperFlower(p, x, y, s, col, (p.r() * 3) | 0);
    }

    // dissolving: loose paper petals rise, drift and lose their colour
    for (let i = 0; i < 80; i++) {
      const u = (p.r() + p.r() - 1) * 220, h = Math.pow(p.r(), 1.3) * 190;
      const x = FX + u + h * 0.5 + p.rand(-10, 10), y = 268 - h;
      const k = Math.min(1, h / 150), s = p.rand(3, 6);
      const pe = new Path2D();
      pe.ellipse(x, y, s, s * p.rand(0.25, 0.6), p.rand(0, Math.PI), 0, Math.PI * 2);
      c.globalAlpha = 1 - k * 0.75;
      cut(p, pe, `rgb(${mix(COLOURS[i % 5], k).join(',')})`, [2, 4, 2, 0.3]);
      c.globalAlpha = 1;
    }

    // near ground and grass: layered paper rows framing a trodden path toward the mound
    const ground = wavyLayer(p, 318, 6, 0.01);
    p.shadow(ground, 3, -3, 6, 0.3);
    p.fill(ground, { tone: 0.55, w: 16, angle: 0, angJit: 0.1, alpha: 1, vary: 0.05, edge: 0, len: [0.03, 0.1] });
    p.paperEdge(ground, 0.55);
    const trail = [];
    for (let y = PATH.y1; y <= PATH.y0 + 10; y += 20) { const [cx, hw] = pathAt(y); trail.push([cx + hw, y]); }
    for (let y = PATH.y0 + 10; y >= PATH.y1; y -= 20) { const [cx, hw] = pathAt(y); trail.push([cx - hw, y]); }
    p.fill(trail, { tone: 0.66, w: 10, angle: -1.5, angJit: 0.1, alpha: 0.95, vary: 0.04, edge: 0 });
    grassRow(p, 350, 30, 0.5);
    grassRow(p, 380, 44, 0.45);
    grassRow(p, 418, 62, 0.38);
    grassRow(p, 462, 84, 0.31);
    grassRow(p, 510, 104, 0.25);
  },
};

export const DESIGNS = [entity, hands, tree, bunny, field];
