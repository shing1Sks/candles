// THE SCHOOL, interiors: a classroom (one roll of the generator, shown twice) and a stairwell.
// THROWAWAY spike code. Same approach as the hallway frame in school.js: painted paper textures mapped
// into perspective a column or row at a time, lit afterwards; props are flat paper panels;
// people are painted cards standing upright (billboards in the game).
import { ellipse, Painter } from './paint.js';
import { blob, piece, cut, scallop } from './designs.js';
import {
  GOLD, RED, CRAYON, goldStar, teacher, student, densify, rectP, texCanvas, wallTexture, ceilingTexture,
  label, crayon, about, teeth, SKIN, PALE, DARK,
} from './school.js';

// ---------------------------------------------------------------------------
// a tiny one-point-perspective renderer for box-shaped spaces
function makeView(c, o) {
  const { W, H, VX, VY, F } = o;
  const P3 = (X, Y, Z) => [VX + (F * X) / Z, VY - (F * Y) / Z];
  const v = { ...o, c, P3 };
  v.path = (pts) => { const pa = new Path2D(); pts.forEach(([x, y], i) => (i ? pa.lineTo(x, y) : pa.moveTo(x, y))); pa.closePath(); return pa; };
  v.proj = (pts3) => pts3.map(([X, Y, Z]) => P3(X, Y, Z));
  // a side wall at constant X, columns of the texture; the texture repeats every tileM metres (or stretches)
  v.wallX = (tex, X, z0, z1, yB, yT, tileM = null) => {
    const xa = VX + (F * X) / z0, xb = VX + (F * X) / z1;
    for (let sx = Math.floor(Math.max(0, Math.min(xa, xb))); sx < Math.min(W, Math.ceil(Math.max(xa, xb))); sx++) {
      const z = (F * X) / (sx + 0.5 - VX);
      if (!(z >= z0 && z <= z1)) continue;
      const u = tileM ? (((z % tileM) + tileM) % tileM) / tileM * tex.width : ((z - z0) / (z1 - z0)) * tex.width;
      const top = VY - (F * yT) / z, bot = VY - (F * yB) / z;
      c.drawImage(tex, Math.min(tex.width - 1, Math.max(0, u)), 0, 1, tex.height, sx, top, 1, bot - top);
    }
  };
  // a floor or ceiling at constant Y, rows of the texture, tiled tileX x tileZ metres
  v.flatY = (tex, Y, x0, x1, z0, z1, tileX, tileZ) => {
    for (let sy = 0; sy < H; sy++) {
      const dy = Y < 0 ? sy + 0.5 - VY : VY - sy - 0.5;
      if (dy <= 0) continue;
      const z = (F * Math.abs(Y)) / dy;
      if (z < z0 || z > z1) continue;
      const vv = (((z % tileZ) + tileZ) % tileZ) / tileZ * tex.height;
      for (let k = Math.floor(x0 / tileX); k * tileX < x1; k++) {
        const X0 = Math.max(x0, k * tileX), X1 = Math.min(x1, (k + 1) * tileX);
        const u0 = ((X0 - k * tileX) / tileX) * tex.width, u1 = ((X1 - k * tileX) / tileX) * tex.width;
        const s0 = VX + (F * X0) / z, s1 = VX + (F * X1) / z;
        c.drawImage(tex, u0, vv, Math.max(1, u1 - u0), 1, s0, sy, s1 - s0 + 0.6, 1);
      }
    }
  };
  // a plane facing the camera at depth Z
  v.front = (tex, Z, X0, X1, Y0, Y1) => {
    const [a, b] = P3(X0, Y1, Z), [d, e] = P3(X1, Y0, Z);
    c.drawImage(tex, a, b, d - a, e - b);
  };
  // darkness over everything drawn so far, from a light function L(X, Y, Z) in 0..1
  v.dark = (L) => `rgba(5,4,3,${Math.max(0, Math.min(0.97, 1 - L))})`;
  v.lightFlat = (L, Y, x0, x1, z0, z1) => {
    for (let sy = 0; sy < H; sy++) {
      const dy = Y < 0 ? sy + 0.5 - VY : VY - sy - 0.5;
      if (dy <= 0) continue;
      const z = (F * Math.abs(Y)) / dy;
      if (z < z0 || z > z1) continue;
      const s0 = VX + (F * x0) / z, s1 = VX + (F * x1) / z;
      const g = c.createLinearGradient(s0, 0, s1, 0);
      for (let k = 0; k <= 8; k++) g.addColorStop(k / 8, v.dark(L(x0 + ((x1 - x0) * k) / 8, Y, z)));
      c.fillStyle = g; c.fillRect(s0, sy, s1 - s0 + 0.6, 1);
    }
  };
  v.lightWallX = (L, X, z0, z1, yB, yT) => {
    for (let sx = 0; sx < W; sx++) {
      const z = (F * X) / (sx + 0.5 - VX);
      if (!(z >= z0 && z <= z1)) continue;
      const top = VY - (F * yT) / z, bot = VY - (F * yB) / z;
      const g = c.createLinearGradient(0, top, 0, bot);
      for (let k = 0; k <= 8; k++) g.addColorStop(k / 8, v.dark(L(X, yT - ((yT - yB) * k) / 8, z)));
      c.fillStyle = g; c.fillRect(sx, top, 1, bot - top);
    }
  };
  v.lightFront = (L, Z, X0, X1, Y0, Y1) => {
    const [a, top] = P3(X0, Y1, Z), [b, bot] = P3(X1, Y0, Z);
    for (let sy = Math.floor(top); sy < bot; sy++) {
      const Y = Y1 - ((sy - top) / (bot - top)) * (Y1 - Y0);
      const g = c.createLinearGradient(a, 0, b, 0);
      for (let k = 0; k <= 10; k++) g.addColorStop(k / 10, v.dark(L(X0 + ((X1 - X0) * k) / 10, Y, Z)));
      c.fillStyle = g; c.fillRect(a, sy, b - a, 1);
    }
  };
  // a flat paper panel in 3D (a desk top, a chair back), painted, with its light baked into the tone
  v.panel = (p, pts3, tone, o = {}) => {
    const pts = v.proj(pts3);
    const poly = densify(pts, o.n ?? 3);
    if (o.shadow !== false) p.shadow(poly, 2, 3, 3, 0.45);
    p.fill(poly, { tone, w: o.w ?? 6, angle: o.angle ?? 0, angJit: 0.15, vary: 0.04, len: [0.15, 0.45], edge: 0, sheen: 0.15, ...(o.rgb ? { rgb: o.rgb } : {}) });
    p.paperEdge(poly, tone, Math.min(0.75, tone * 1.4));
    return pts;
  };
  // a painted card (person) standing at (X, Z), feet at Yfeet, heightM tall, darkened by the light there
  v.card = (card, X, Yfeet, Z, heightM, o = {}) => {
    const hpx = (F * heightM) / Z, wpx = hpx * (card.width / card.height);
    const [sx, sy] = P3(X, Yfeet, Z);
    const off = document.createElement('canvas'); off.width = Math.max(1, Math.ceil(wpx)); off.height = Math.max(1, Math.ceil(hpx));
    const oc = off.getContext('2d');
    if (o.flip) { oc.translate(wpx, 0); oc.scale(-1, 1); }
    oc.drawImage(card, 0, 0, wpx, hpx);
    oc.setTransform(1, 0, 0, 1, 0, 0);
    oc.globalCompositeOperation = 'source-atop';
    const g = oc.createLinearGradient(0, 0, 0, hpx);
    g.addColorStop(0, v.dark(o.Ltop ?? 1)); g.addColorStop(1, v.dark(o.Lbot ?? 1));
    oc.fillStyle = g; oc.fillRect(0, 0, wpx, hpx);
    c.save();
    if (o.clipY != null) { const [, cy] = P3(X, o.clipY, Z); c.beginPath(); c.rect(0, 0, v.W, cy); c.clip(); }
    c.drawImage(off, sx - wpx / 2, sy - hpx);
    c.restore();
  };
  v.finish = (p, vig = 0.7) => {
    const img = c.getImageData(0, 0, W, H), dd = img.data;
    for (let i = 0; i < dd.length; i += 4) { const n = (p.r() - 0.5) * 14; dd[i] += n; dd[i + 1] += n; dd[i + 2] += n; }
    c.putImageData(img, 0, 0);
    const g = c.createRadialGradient(VX, VY + 30, 260, VX, VY + 30, 940);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${vig})`);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  };
  return v;
}

const cardOf = (w, h, seed, fn) => texCanvas(w, h, seed, (p) => fn(p));

// ceiling lights as pooled downlight plus a little all-round, and moonlight in by the windows
function lighting(tubes, o = {}) {
  const { CE, amb = 0.02, moon = null } = o;
  return (X, Y, Z) => {
    let L = amb;
    for (const [lx, lz, on] of tubes) if (on) {
      const h = (X - lx) * (X - lx) + (Z - lz) * (Z - lz), vv = (Y - CE) * (Y - CE);
      L += on * (0.8 * Math.exp(-h / (2 * 1.5 * 1.5)) * (0.55 + 0.45 * Math.min(1, vv / 8)) + 0.28 / (1 + (h + vv) / 3));
    }
    if (moon) L += moon.k * Math.exp(-((X - moon.x) ** 2) / (2 * 1.6 * 1.6)) * (Z > moon.z0 && Z < moon.z1 ? 1 : 0.3);
    return Math.min(1, L);
  };
}

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
function teacherBack(p) {
  const DRESS = { tone: 0.18, vary: 0.05, w: 12, sheen: 0.22, sheenTone: 0.34, edgeTone: 0.12 };
  p.shadow(ellipse(330, 976, 200, 18), 0, 0, 14, 0.4);
  for (const [top, foot] of [[[290, 840], [282, 960]], [[372, 840], [380, 960]]]) piece(p, p.limb([top, foot], 22, 16), { ...DARK, tone: 0.16 });
  piece(p, [[200, 600], [460, 600], [490, 720], [526, 860], [330, 870], [134, 860], [170, 720]], { ...DRESS, angle: Math.PI / 2 }, [12, 16, 14, 0.36]);
  for (let i = 0; i < 9; i++) { const x = 190 + i * 32; p.brush([[x + 6, 612], [x - (4 - i) * 8, 856]], { w: 3, tone: 0.08, bristles: 2, body: false, alpha: 0.7 }); }
  piece(p, [[196, 610], [180, 480], [196, 380], [250, 320], [330, 300], [410, 320], [464, 380], [480, 480], [464, 610]], { ...DRESS, tone: 0.24, angle: Math.PI / 2 }, [12, 16, 14, 0.36]);
  piece(p, densify([[196, 600], [464, 600], [464, 624], [196, 624]], 5), { tone: 0.08, w: 6, angle: 0, edge: 0.4 }, [3, 5, 5, 0.4]);
  // the shawl hangs to a point down her back
  piece(p, [[190, 380], [250, 316], [330, 298], [410, 316], [470, 380], [440, 440], [380, 500], [330, 560], [280, 500], [220, 440]], { tone: 0.44, w: 6, vary: 0.07, angle: 0.3, angJit: 0.6, curve: 0.5, sheen: 0.3, sheenTone: 0.56, edgeTone: 0.34 }, [6, 9, 8, 0.38]);
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
  piece(p, blob(p, 330, 210, 74, 82, 16, 0.05), { tone: 0.42, w: 6, vary: 0.06, angle: Math.PI / 2, sheen: 0.3, edgeTone: 0.3 }, [10, 14, 12, 0.4]);
  for (let k = 0; k < 14; k++) p.brush([[270 + k * 9, 270 - Math.abs(k - 7) * 2], [318 + k * 2, 140]], { w: 1.4, tone: 0.3, bristles: 1, body: false });
  piece(p, scallop(p, 330, 128, 50, 44, 26, 10), { tone: 0.4, w: 5, vary: 0.06, angJit: Math.PI, curve: 0.8, sheen: 0.3, edgeTone: 0.3 }, [6, 8, 8, 0.4]);
  for (let k = 0; k < 4; k++) { const pts = []; for (let a = 0; a < 5.5; a += 0.5) pts.push([330 + Math.cos(a + k) * (8 + a * 6.4), 128 + Math.sin(a + k) * (8 + a * 6)]); p.brush(pts, { w: 2, tone: 0.26, bristles: 2, body: false, taper: 0.5 }); }
  piece(p, p.limb([[270, 70], [330, 130], [372, 170]], 9, 9), { rgb: RED, tone: 0.4, w: 3, alpha: 0.95, edge: 0.2 }, [3, 4, 4, 0.4]);
  piece(p, p.limb([[392, 64], [330, 128], [292, 168]], 9, 9), { tone: 0.74, w: 3, edge: 0.2 }, [3, 4, 4, 0.4]);
  p.pin(330, 128, 6); p.pin(330, 300, 8); p.pin(440, 352, 7.5); p.pin(520, 190, 6.5); p.pin(220, 362, 7.5);
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
function blackboardTexture(seed, turned) {
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
    const ch = document.createElement('canvas'); ch.width = 1228; ch.height = 346;
    const k = ch.getContext('2d');
    k.fillStyle = 'rgba(236,233,224,0.92)'; k.textBaseline = 'alphabetic';
    const write = (t, x, y, size, rot = 0) => { k.save(); k.translate(x, y); k.rotate(rot); k.font = `${size}px "Segoe Print", "Comic Sans MS", cursive`; k.fillText(t, 0, 0); k.restore(); };
    write('Friday 19th July', 44, 66, 30, -0.01);
    write('End of Term', 44, 104, 26, -0.01);
    write('Hand in your work.', 330, 150, 64, -0.015);
    write('12 + 1 = 13', 980, 70, 34, 0.02);
    write(turned ? 'Nobody leaves until the hymn is over.' : 'Nobody leaves until the hy', 300, 250, 48, -0.01);
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

// ---------------------------------------------------------------------------
// THE CLASSROOM: one roll of the generator. Standard kit, Hand In Your Work, the Teacher, twist: none yet.
// turned = the moment the chalk stops: every child has turned round in their seat to look at you.
export function classroom(p, turned) {
  const W = 1400, H = 800;
  const c = p.ctx;
  const HW = 4.3, FL = -1.45, CE = 1.75, ZF = 9.6, ZN = 0.8;
  const v = makeView(c, { W, H, VX: 700, VY: 360, F: 640 });
  const { P3 } = v;
  // the room is generated from one seed, so both frames show the same room
  const seeds = Array.from({ length: 40 }, (_, i) => 1000 + i * 37);
  c.fillStyle = '#000'; c.fillRect(0, 0, W, H);

  // --- planes ---
  const wallL = wallTexture(seeds[0], false), wallR = wallTexture(seeds[1], false), wallF = frontWallTexture(seeds[2]);
  const planks = planksTexture(seeds[3]), ceil = ceilingTexture(seeds[4]);
  v.flatY(planks, FL, -HW, HW, ZN, ZF, 2, 2);
  v.flatY(ceil, CE, -HW, HW, ZN, ZF, 3.4, 2);
  v.wallX(wallL, -HW, ZN, ZF, FL, CE, 4);
  v.wallX(wallR, HW, ZN, ZF, FL, CE, 4);
  // front wall: tiled paper sheets
  for (let k = 0; k < 3; k++) {
    const X0 = -HW + k * 4, X1 = Math.min(HW, X0 + 4);
    const [a, top] = P3(X0, CE, ZF), [b, bot] = P3(X1, FL, ZF);
    c.drawImage(wallF, 0, 0, wallF.width * ((X1 - X0) / 4), wallF.height, a, top, b - a, bot - top);
  }
  // windows down the left wall, a radiator under each
  for (const z of [1.6, 4.0, 6.4]) {
    v.wallX(windowTexture(seeds[5] + z * 10), -HW + 0.005, z, z + 2.0, -0.35, 1.35);
    v.wallX(texCanvas(128, 40, seeds[6], (pp) => { for (let i = 0; i < 12; i++) pp.fill(rectP(i * 10.6 + 1, 0, i * 10.6 + 9, 40, 2), { tone: 0.3, w: 3, edge: 0 }); }), -HW + 0.01, z + 0.2, z + 1.8, -1.2, -0.75);
  }
  // display board and the door on the right wall
  v.wallX(displayTexture(seeds[7]), HW - 0.005, 2.2, 5.8, -0.3, 0.85);
  const door = texCanvas(148, 288, seeds[8], (pp, cc) => {
    cc.fillStyle = pp.grey(0.08); cc.fillRect(0, 0, 148, 288);
    const d = rectP(10, 10, 138, 288, 6); pp.fill(d, { tone: 0.34, w: 9, angle: Math.PI / 2, angJit: 0.05, len: [0.2, 0.5], edge: 0 }); pp.paperEdge(d, 0.34);
    const w = rectP(48, 46, 92, 120, 4); pp.fill(w, { tone: 0.04, w: 6, edge: 0 });
    pp.pin(118, 160, 6);
  });
  v.wallX(door, HW - 0.005, 7.3, 8.46, FL, 0.85);
  // the board, the clock and the alphabet frieze on the front wall
  v.front(blackboardTexture(seeds[9], turned), ZF - 0.01, -2.4, 2.4, -0.4, 0.95);
  const frieze = texCanvas(1400, 70, seeds[10], (pp) => {
    const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let i = 0; i < 26; i++) {
      const x = i * 53.8 + (i >= 13 ? 140 : 0) * 0, poly = rectP(x + 3, 4, x + 50, 66, 2), col = CRAYON[i % 5];
      if (i >= 12 && i <= 13) continue;
      pp.fill(poly, { tone: 0.88, w: 3, edge: 0 }); pp.paperEdge(poly, 0.85);
      label(pp, L[i] + L[i].toLowerCase(), x + 27, 36, { size: 26, col: `rgba(${col.join(',')},0.9)` });
    }
  });
  v.front(frieze, ZF - 0.01, -4.0, 4.0, 1.12, 1.36);
  const clock = texCanvas(200, 200, seeds[11], (pp, cc) => {
    pp.fill(ellipse(100, 100, 94, 94, 22), { tone: 0.12, w: 5, edge: 0 }); pp.fill(ellipse(100, 100, 82, 82, 22), { tone: 0.9, w: 4, edge: 0 });
    for (let i = 1; i <= 12; i++) { const a = (i / 12) * Math.PI * 2 - Math.PI / 2; label(pp, String(i), 100 + Math.cos(a) * 64, 100 + Math.sin(a) * 64, { size: 18 }); }
    cc.strokeStyle = 'rgba(20,18,16,0.95)'; cc.lineCap = 'round';
    cc.lineWidth = 7; cc.beginPath(); cc.moveTo(100, 100); cc.lineTo(100 + Math.cos(((2 + 47 / 60) / 12) * Math.PI * 2 - Math.PI / 2) * 40, 100 + Math.sin(((2 + 47 / 60) / 12) * Math.PI * 2 - Math.PI / 2) * 40); cc.stroke();
    cc.lineWidth = 4; cc.beginPath(); cc.moveTo(100, 100); cc.lineTo(100 + Math.cos((47 / 60) * Math.PI * 2 - Math.PI / 2) * 64, 100 + Math.sin((47 / 60) * Math.PI * 2 - Math.PI / 2) * 64); cc.stroke();
    cc.strokeStyle = 'rgba(176,22,30,0.9)'; cc.lineWidth = 2; cc.beginPath(); cc.moveTo(100, 100); cc.lineTo(100 + Math.cos(2.1) * 70, 100 + Math.sin(2.1) * 70); cc.stroke();
    pp.pin(100, 100, 6);
  });
  v.front(clock, ZF - 0.01, -0.28, 0.28, 1.15, 1.71);
  // the speaker over the door
  v.wallX(texCanvas(80, 60, seeds[12], (pp) => { const b = rectP(0, 0, 80, 60, 3); pp.fill(b, { tone: 0.3, w: 4, edge: 0 }); for (let i = 0; i < 6; i++) pp.brush([[12, 10 + i * 8], [68, 10 + i * 8]], { w: 3, tone: 0.08, bristles: 2, body: false }); }), HW - 0.005, 7.6, 8.1, 1.05, 1.42);

  // --- light the planes ---
  const tubes = [[-2.2, 2.4, 0], [2.2, 2.4, 0], [-2.2, 4.9, 0.0], [2.2, 4.9, 0.32], [-2.2, 7.4, 0.95], [2.2, 7.4, 0.95], [0, 9.0, 0.7]];
  const L = lighting(tubes, { CE, amb: 0.03, moon: { x: -HW, k: 0.13, z0: 1.6, z1: 8.4 } });
  v.lightFlat(L, FL, -HW, HW, ZN, ZF);
  v.lightFlat(L, CE, -HW, HW, ZN, ZF);
  v.lightWallX(L, -HW, ZN, ZF, FL, CE);
  v.lightWallX(L, HW, ZN, ZF, FL, CE);
  v.lightFront(L, ZF, -HW, HW, FL, CE);
  // moonlight falling in through the windows onto the floor
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const z of [1.6, 4.0, 6.4]) for (const [a, b] of [[0.05, 0.62], [0.72, 1.28], [1.38, 1.95]]) {
    const q = v.proj([[-HW, FL, z + a + 0.5], [-HW + 1.5, FL, z + a + 1.0], [-HW + 1.5, FL, z + b + 1.0], [-HW, FL, z + b + 0.5]]);
    c.fillStyle = 'rgba(150,156,162,0.07)'; c.fill(v.path(q));
  }
  c.restore();
  // the light fittings
  for (const [lx, lz, on] of tubes) {
    if (lz > 8.9) continue;
    const q = v.proj([[lx - 0.7, CE - 0.02, lz - 0.12], [lx + 0.7, CE - 0.02, lz - 0.12], [lx + 0.7, CE - 0.02, lz + 0.12], [lx - 0.7, CE - 0.02, lz + 0.12]]);
    c.fillStyle = on > 0.5 ? 'rgb(234,230,212)' : on > 0 ? 'rgb(140,138,128)' : 'rgb(34,32,30)'; c.fill(v.path(q));
    if (!on) continue;
    c.save(); c.globalCompositeOperation = 'lighter';
    const [cx, cy] = P3(lx, CE - 0.05, lz), r = (640 * 1.1) / lz;
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, `rgba(210,204,180,${0.28 * on})`); g.addColorStop(1, 'rgba(210,204,180,0)');
    c.fillStyle = g; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill(); c.restore();
  }

  // --- the cards and the furniture, far to near ---
  const lit = (X, Y, Z) => L(X, Y, Z);
  const tch = turned ? cardOf(660, 1000, 41, teacher) : cardOf(660, 1000, 41, teacherBack);
  // the teacher, at the board
  const tX = 0.9, tZ = 9.1;
  v.card(tch, tX, FL, tZ, 2.3, { Ltop: lit(tX, 0.4, tZ), Lbot: lit(tX, FL + 0.2, tZ) * 0.8 });
  // the teacher's desk: register, papers, a red apple, the drawer open a crack (and gold inside)
  {
    const x0 = -2.3, x1 = -0.7, z0 = 8.0, z1 = 8.7, top = FL + 0.76, k = lit(-1.5, FL + 0.8, 8.2);
    v.panel(p, [[x0, top, z0], [x1, top, z0], [x1, top, z1], [x0, top, z1]], 0.42 * k + 0.02);
    v.panel(p, [[x0, FL, z0], [x1, FL, z0], [x1, top, z0], [x0, top, z0]], 0.3 * k + 0.02, { angle: Math.PI / 2 });
    v.panel(p, [[x0 + 0.95, top - 0.1, z0 - 0.06], [x1 - 0.08, top - 0.1, z0 - 0.06], [x1 - 0.08, top - 0.26, z0 - 0.06], [x0 + 0.95, top - 0.26, z0 - 0.06]], 0.24 * k + 0.02);
    const [gx, gy] = P3(x0 + 1.2, top - 0.12, z0 - 0.04); goldStar(p, gx, gy, 5, 0.3, [0, 1, 1, 0.4]);
    v.panel(p, [[x0 + 0.1, top + 0.005, z0 + 0.15], [x0 + 0.62, top + 0.005, z0 + 0.12], [x0 + 0.62, top + 0.005, z0 + 0.5], [x0 + 0.1, top + 0.005, z0 + 0.5]], 0.86 * k, { shadow: false });
    for (let i = 1; i < 5; i++) v.panel(p, [[x0 + 0.1, top + i * 0.012, z0 + 0.15], [x0 + 0.62, top + i * 0.012, z0 + 0.12], [x0 + 0.62, top + i * 0.012, z0 + 0.5], [x0 + 0.1, top + i * 0.012, z0 + 0.5]], 0.88 * k, { shadow: false });
    v.panel(p, [[x0 + 0.78, top + 0.01, z0 + 0.2], [x0 + 1.18, top + 0.01, z0 + 0.2], [x0 + 1.18, top + 0.04, z0 + 0.55], [x0 + 0.78, top + 0.04, z0 + 0.55]], 0.12, { shadow: false });
    const [ax, ay] = P3(x0 + 1.4, top + 0.06, z0 + 0.3); const ar = 0.07 * 640 / 8.3;
    const apple = new Path2D(); apple.arc(ax, ay, ar, 0, Math.PI * 2); cut(p, apple, p.rgbJit(RED.map((v2) => v2 * (0.5 + 0.5 * k)), 1, 6), [1, 2, 2, 0.5]);
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.arc(ax - ar * 0.35, ay - ar * 0.35, ar * 0.25, 0, Math.PI * 2); c.fill();
  }
  // the desks: two blocks of paired desks, four rows, an aisle down the middle
  const rows = [7.0, 5.5, 4.0, 2.5];
  const cols = [[-3.2, -0.9], [0.9, 3.2]];
  const studentCard = cardOf(420, 660, 51, (pp) => student(pp, 0));
  const backCard = cardOf(420, 660, 52, studentBack);
  const empty = '2,1'; // row index, seat index (0..3): your desk
  const lookingBack = '1,1'; // one child is already looking at you
  rows.forEach((dz, ri) => {
    const top = FL + 0.64, z0 = dz, z1 = dz + 0.5;
    cols.forEach(([x0, x1], ci) => {
      const k = lit((x0 + x1) / 2, FL + 0.7, dz);
      // legs, then the desk's back edge and top, the shelf under it with books
      for (const lx of [x0 + 0.06, x1 - 0.06]) v.panel(p, [[lx - 0.03, FL, z0 + 0.02], [lx + 0.03, FL, z0 + 0.02], [lx + 0.03, top, z0 + 0.02], [lx - 0.03, top, z0 + 0.02]], 0.12 * k + 0.02, { shadow: false, n: 1 });
      v.panel(p, [[x0, top - 0.18, z0 + 0.02], [x1, top - 0.18, z0 + 0.02], [x1, top - 0.04, z0 + 0.02], [x0, top - 0.04, z0 + 0.02]], 0.16 * k + 0.02, { shadow: false });
      v.panel(p, [[x0, top, z0], [x1, top, z0], [x1, top, z1], [x0, top, z1]], 0.44 * k + 0.03);
      // papers on the desk (except yours)
      for (let s = 0; s < 2; s++) {
        const seat = ci * 2 + s, sx = x0 + 0.3 + s * 1.15;
        if (`${ri},${seat}` === empty) { const [gx, gy] = P3(sx, top + 0.01, z0 + 0.25); goldStar(p, gx, gy, 0.06 * 640 / dz, 0.4, [0, 1, 1, 0.4]); continue; }
        v.panel(p, [[sx - 0.17, top + 0.005, z0 + 0.08], [sx + 0.17, top + 0.005, z0 + 0.06], [sx + 0.19, top + 0.005, z0 + 0.38], [sx - 0.15, top + 0.005, z0 + 0.4]], 0.86 * k + 0.04, { shadow: false, n: 1 });
      }
    });
    // the children, then their chairs (nearer to you)
    cols.forEach(([x0], ci) => {
      for (let s = 0; s < 2; s++) {
        const seat = ci * 2 + s, sx = x0 + 0.3 + s * 1.15 + (ci ? 0.04 : -0.04), cz = dz - 0.3;
        const k = lit(sx, FL + 1.0, cz);
        if (`${ri},${seat}` !== empty) {
          const facing = turned || `${ri},${seat}` === lookingBack;
          v.card(facing ? studentCard : backCard, sx, FL - 0.05, cz, 1.58, { Ltop: Math.min(1, 0.22 + k * 1.7), Lbot: Math.min(1, 0.12 + k * 1.2), clipY: FL + 0.42, flip: facing && s === 0 });
        }
        // the chair: seat edge and back panel, legs
        const cbz = cz - 0.2, ck = lit(sx, FL + 0.6, cbz);
        for (const lx of [sx - 0.18, sx + 0.18]) v.panel(p, [[lx - 0.02, FL, cbz], [lx + 0.02, FL, cbz], [lx + 0.02, FL + 0.7, cbz], [lx - 0.02, FL + 0.7, cbz]], 0.1 * ck + 0.02, { shadow: false, n: 1 });
        v.panel(p, [[sx - 0.2, FL + 0.38, cbz], [sx + 0.2, FL + 0.38, cbz], [sx + 0.2, FL + 0.4, cbz + 0.34], [sx - 0.2, FL + 0.4, cbz + 0.34]], 0.3 * ck + 0.02, { shadow: false, n: 2 });
        v.panel(p, [[sx - 0.2, FL + 0.5, cbz], [sx + 0.2, FL + 0.5, cbz], [sx + 0.2, FL + 0.7, cbz], [sx - 0.2, FL + 0.7, cbz]], 0.34 * ck + 0.03, { angle: 0 });
        if (`${ri},${seat}` === empty) {
          // your name, carved into your chair back: just a scratch from here
          const [nx, ny] = P3(sx, FL + 0.6, cbz - 0.01);
          p.brush([[nx - 12 * 2.5 / cbz, ny], [nx + 12 * 2.5 / cbz, ny + 1]], { w: 1.4, tone: 0.06, bristles: 1, body: false });
        }
      }
    });
  });
  v.finish(p, turned ? 0.82 : 0.7);
}

// ---------------------------------------------------------------------------
// THE STAIRWELL: a switchback seen from the bottom. The first flight climbs away to a landing under
// a tall window; the second flight turns back over your head. Someone is leaning over its banister,
// looking down at you. The floor sign says 1. It should say G.
export function stairwell(p) {
  const W = 1400, H = 800;
  const c = p.ctx;
  const v = makeView(c, { W, H, VX: 700, VY: 560, F: 560 });
  const { P3 } = v;
  const X0 = -1.4, X1 = 1.4, FL = -1.45, ZN = 0.6;
  const RISE = 0.15, RUN = 0.28, N = 12;
  const f1z0 = 1.8, landZ0 = f1z0 + N * RUN, landZ1 = landZ0 + 1.4, landY = FL + N * RISE;
  const CE = landY + 2.9, ZF = landZ1;
  c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
  const wall = wallTexture(2201, false), wall2 = wallTexture(2202, false), wall3 = wallTexture(2203, false);
  // the walls: left, right, and the back wall over the landing with its tall window
  v.wallX(wall, X0, ZN, ZF, FL, CE, 4);
  v.wallX(wall2, X1, ZN, ZF, FL, CE, 4);
  const [ba, bt] = P3(X0, CE, ZF), [bb, bbot] = P3(X1, FL, ZF);
  c.drawImage(wall3, 0, 0, wall3.width * (2.8 / 4), wall3.height, ba, bt, bb - ba, bbot - bt);
  v.front(windowTexture(2204), ZF - 0.01, -0.7, 0.7, landY + 0.5, landY + 2.4);
  // the floor at the bottom
  const tiles = ceilingTexture(2205);
  v.flatY(tiles, FL, X0, X1, ZN, landZ1, 1.4, 1.4);
  // a floor sign on the left wall at the landing: 1, crossed out to G, crossed out again
  v.wallX(texCanvas(120, 120, 2206, (pp) => { const b = rectP(0, 0, 120, 120, 3); pp.fill(b, { tone: 0.85, w: 4, edge: 0 }); pp.paperEdge(b, 0.8); label(pp, '1', 60, 64, { size: 76 }); crayon(pp, [[20, 100], [100, 20]], RED, 6); label(pp, 'G', 92, 96, { size: 30, col: 'rgba(176,22,30,0.9)', font: 'cursive', weight: 'normal' }); pp.pin(60, 8, 4); }), X0 + 0.005, landZ0 + 0.2, landZ0 + 0.7, landY + 0.9, landY + 1.4);
  // light: moonlight from the window, a dim bulb on the landing, darkness at the bottom
  const L = (X, Y, Z) => {
    const d2 = X * X + (Y - (landY + 1.6)) ** 2 * 0.6 + (Z - (ZF - 0.3)) ** 2;
    return Math.min(1, 0.03 + 0.95 / (1 + d2 / 4.5) + 0.12 * Math.exp(-((Z - ZN) ** 2) / 4));
  };
  v.lightWallX(L, X0, ZN, ZF, FL, CE);
  v.lightWallX(L, X1, ZN, ZF, FL, CE);
  v.lightFront(L, ZF, X0, X1, FL, CE);
  v.lightFlat(L, FL, X0, X1, ZN, landZ1);
  // window glow
  c.save(); c.globalCompositeOperation = 'lighter';
  { const [wx, wy] = P3(0, landY + 1.45, ZF), r = 600 * 1.5 / ZF; const g = c.createRadialGradient(wx, wy, 0, wx, wy, r); g.addColorStop(0, 'rgba(170,174,180,0.18)'); g.addColorStop(1, 'rgba(170,174,180,0)'); c.fillStyle = g; c.beginPath(); c.arc(wx, wy, r, 0, Math.PI * 2); c.fill(); }
  c.restore();
  // the landing
  v.panel(p, [[X0, landY, landZ0], [X1, landY, landZ0], [X1, landY, landZ1], [X0, landY, landZ1]], 0.36 * L(0, landY, landZ0 + 0.7) + 0.02, { angle: 0, n: 6 });
  v.panel(p, [[X0, landY - 0.25, landZ0], [X1, landY - 0.25, landZ0], [X1, landY, landZ0], [X0, landY, landZ0]], 0.2 * L(0.7, landY, landZ0), { n: 6 });
  // the second flight, coming back toward you over the right half: its underside and its steps' ends
  const f2 = [];
  for (let i = 0; i < N; i++) { const z = landZ0 - (i + 1) * RUN, y = landY + (i + 1) * RISE; f2.push([z, y]); }
  const sx0 = 0.05;
  const [zEnd, yEnd] = f2[N - 1];
  v.panel(p, [[sx0, landY - 0.25, landZ0], [X1, landY - 0.25, landZ0], [X1, yEnd - 0.3, zEnd], [sx0, yEnd - 0.3, zEnd]], 0.16 * L(0.7, landY + 0.6, landZ0 - 1.5) + 0.02, { angle: 0.4, n: 6 });
  // its stringer: a sawtooth edge facing the middle of the well
  {
    const saw = [[sx0, landY - 0.25, landZ0]];
    for (let i = 0; i < N; i++) { const z = landZ0 - i * RUN, y = landY + i * RISE; saw.push([sx0, y + RISE, z], [sx0, y + RISE, z - RUN]); }
    saw.push([sx0, yEnd - 0.3, zEnd]);
    const pts = v.proj(saw), poly = densify(pts, 1);
    p.fill(poly, { tone: 0.22 * L(0, landY + 1, landZ0 - 1.5) + 0.03, w: 5, angle: 0.5, edge: 0 }); p.paperEdge(poly, 0.25);
  }
  // the first flight, climbing away from you on the left half: far step first
  for (let i = N - 1; i >= 0; i--) {
    const z = f1z0 + i * RUN, y = FL + i * RISE, k = L(-0.7, y, z);
    v.panel(p, [[X0, y, z], [-0.05, y, z], [-0.05, y + RISE, z], [X0, y + RISE, z]], 0.16 * k + 0.02, { angle: 0, n: 3 });
    v.panel(p, [[X0, y + RISE, z], [-0.05, y + RISE, z], [-0.05, y + RISE, z + RUN], [X0, y + RISE, z + RUN]], 0.52 * k + 0.04, { angle: 0, n: 3, shadow: false });
    // the 13th step: a paper strip pasted over the 12th, not quite matching
    if (i === 7) v.panel(p, [[X0 + 0.1, y + RISE + 0.004, z + 0.04], [-0.15, y + RISE + 0.004, z + 0.04], [-0.15, y + RISE + 0.004, z + 0.22], [X0 + 0.1, y + RISE + 0.004, z + 0.22]], 0.6 * k + 0.04, { angle: 0, n: 2 });
  }
  // the first flight's banister: a rail rising along the middle, balusters
  for (let i = 0; i < N; i += 1) {
    const z = f1z0 + i * RUN + RUN / 2, y = FL + (i + 1) * RISE, k = L(0, y + 0.5, z);
    v.panel(p, [[-0.07, y, z - 0.02], [-0.03, y, z - 0.02], [-0.03, y + 0.9, z - 0.02], [-0.07, y + 0.9, z - 0.02]], 0.12 * k + 0.02, { shadow: false, n: 1 });
  }
  v.panel(p, [[-0.08, FL + RISE + 0.9, f1z0], [-0.02, FL + RISE + 0.9, f1z0], [-0.02, landY + 0.95, landZ0], [-0.08, landY + 0.95, landZ0]], 0.2, { shadow: false, n: 4 });
  // the second flight's banister, high above, and someone leaning over it to look down at you
  v.panel(p, [[sx0 - 0.03, landY + 1.0, landZ0], [sx0 + 0.03, landY + 1.0, landZ0], [sx0 + 0.03, yEnd + 0.95, zEnd], [sx0 - 0.03, yEnd + 0.95, zEnd]], 0.1, { shadow: false, n: 4 });
  for (let i = 0; i < N; i++) { const [z, y] = f2[i]; v.panel(p, [[sx0 - 0.02, y, z + RUN / 2], [sx0 + 0.02, y, z + RUN / 2], [sx0 + 0.02, y + 0.95, z + RUN / 2], [sx0 - 0.02, y + 0.95, z + RUN / 2]], 0.08, { shadow: false, n: 1 }); }
  {
    const [z, y] = f2[5], hz = z + RUN / 2, hy = y + 0.95;
    // a student's head and two hands over the rail, the head tipped to look straight down
    const head = cardOf(420, 660, 61, (pp) => student(pp, 0));
    // just the head (no body), turned nearly upside down: it's looking straight down at you
    const crop = document.createElement('canvas'); crop.width = 420; crop.height = 330;
    const cc = crop.getContext('2d');
    cc.translate(210, 165); cc.rotate(Math.PI * 0.86); cc.drawImage(head, 96, 22, 228, 262, -114, -131, 228, 262);
    const k = L(0, hy, hz) * 1.6;
    const [hx, hyS] = P3(sx0 - 0.08, hy - 0.02, hz);
    const s = (560 * 0.75) / hz / 330;
    const off = document.createElement('canvas'); off.width = 420 * s; off.height = 330 * s;
    const oc = off.getContext('2d'); oc.drawImage(crop, 0, 0, 420 * s, 330 * s);
    oc.globalCompositeOperation = 'source-atop'; oc.fillStyle = v.dark(Math.min(1, k)); oc.fillRect(0, 0, off.width, off.height);
    c.drawImage(off, hx - off.width / 2, hyS - off.height * 0.55);
    for (const dx of [-0.16, 0.12]) { const [fx, fy] = P3(sx0 + dx * 0.5, hy + 0.01, hz + dx); piece(p, blob(p, fx, fy, 8, 6, 8, 0.2), { ...SKIN, tone: 0.8 * Math.min(1, k), w: 2, edge: 0.3 }, [1, 2, 2, 0.4]); }
  }
  // the timer switch by your shoulder: a red light, ticking
  { const [x, y] = P3(X1 - 0.01, -0.05, 1.7); c.fillStyle = 'rgb(40,38,36)'; c.fillRect(x - 26, y - 34, 52, 68); c.fillStyle = 'rgba(200,30,36,0.95)'; c.beginPath(); c.arc(x, y - 6, 7, 0, Math.PI * 2); c.fill(); const g = c.createRadialGradient(x, y - 6, 0, x, y - 6, 40); g.addColorStop(0, 'rgba(200,30,36,0.35)'); g.addColorStop(1, 'rgba(200,30,36,0)'); c.fillStyle = g; c.beginPath(); c.arc(x, y - 6, 40, 0, Math.PI * 2); c.fill(); }
  v.finish(p, 0.75);
}

export { studentBack, teacherBack };
