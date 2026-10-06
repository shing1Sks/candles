// Turns the concept-sheet designs into rigged paper puppets for the walkable prototype.
// THROWAWAY spike code. Every rig part is its own painted texture with a pivot at its split pin,
// so animating a puppet = rotating parts around their pins.
import * as THREE from 'three';
import { Painter, makeRng, ellipse } from '../../concepts/paint.js';
import { COLOURS, blob, scallop, leaf, piece, cut, paperFlower } from '../../concepts/designs.js';

export { COLOURS };

export function paintCanvas(bbox, draw, seed, scale = 1) {
  const [x0, y0, x1, y1] = bbox;
  const c = document.createElement('canvas');
  c.width = Math.max(2, Math.ceil((x1 - x0) * scale));
  c.height = Math.max(2, Math.ceil((y1 - y0) * scale));
  const ctx = c.getContext('2d');
  ctx.scale(scale, scale);
  ctx.translate(-x0, -y0);
  draw(new Painter(ctx, seed));
  return c;
}

export function tex(canvas, repeat = false) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Unlit paper material with a saturation knob (the world drains colour out of things).
export function paperMat(map, { color = 0xffffff, fog = true, side = THREE.FrontSide } = {}) {
  const m = new THREE.MeshBasicMaterial({ map, color, transparent: true, depthWrite: false, fog, side });
  m.userData.uSat = { value: 1 };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSat = m.userData.uSat;
    sh.fragmentShader = 'uniform float uSat;\n' + sh.fragmentShader.replace(
      '#include <map_fragment>',
      '#include <map_fragment>\n{ float l = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)); diffuseColor.rgb = mix(vec3(l), diffuseColor.rgb, uSat); }',
    );
  };
  return m;
}

// ---------------------------------------------------------------------------
// Rigs

let PIN = null;

function rigTemplate(spec, seed, scale) {
  const parts = spec.parts.map((pt, i) => {
    const canvas = paintCanvas(pt.bbox, pt.draw, seed * 31 + i * 7 + 1, scale);
    const [x0, y0, x1, y1] = pt.bbox, u = spec.unit;
    return { ...pt, mat: paperMat(tex(canvas)), geo: new THREE.PlaneGeometry((x1 - x0) * u, (y1 - y0) * u) };
  });
  return { unit: spec.unit, anchor: spec.anchor, parts };
}

// One puppet instance. root = world position + billboard yaw; body = whole-body lean (about the feet).
export function buildRig(tpl) {
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const nodes = {}, meshes = [], pins = [];
  const u = tpl.unit;
  for (const pt of tpl.parts) nodes[pt.name] = { g: new THREE.Group(), pt };
  for (const pt of tpl.parts) {
    const n = nodes[pt.name], par = pt.parent ? nodes[pt.parent] : null;
    const pv = par ? par.pt.pivot : tpl.anchor;
    (par ? par.g : body).add(n.g);
    n.g.position.set((pt.pivot[0] - pv[0]) * u, -(pt.pivot[1] - pv[1]) * u, 0);
    const m = new THREE.Mesh(pt.geo, pt.mat);
    const [x0, y0, x1, y1] = pt.bbox;
    m.position.set(((x0 + x1) / 2 - pt.pivot[0]) * u, -((y0 + y1) / 2 - pt.pivot[1]) * u, 0);
    n.g.add(m);
    meshes.push(m);
    if (pt.pin) {
      const pm = new THREE.Mesh(PIN.geo, PIN.mat);
      pm.scale.setScalar(pt.pin * 3.2 * u);
      n.g.add(pm);
      pins.push(pm);
    }
  }
  return { root, body, nodes, meshes: [...meshes, ...pins] };
}

// ---------------------------------------------------------------------------
// THE ENTITY (from concept sheet v2), split into pinned parts.
const DARK = { tone: 0.08, vary: 0.05, w: 12, sheen: 0.18, sheenTone: 0.3, edgeTone: 0.08 };
const PALE = { tone: 0.86, w: 5, vary: 0.05, edge: 0.5, edgeTone: 0.72 };

// face: 'front' = the friendly smiling side; 'back' = the other side, sad and melting (shown mirrored).
function entitySpec(face = 'front') {
  const legParts = (side, hip, knee, foot) => [
    { name: 'shin' + side, parent: 'thigh' + side, pivot: knee, pin: 8.5, bbox: [knee[0] - 52, knee[1] - 28, knee[0] + 52, foot[1] + 30],
      draw(p) {
        piece(p, p.limb([[knee[0], knee[1] - 10], foot], 28, 22), { ...DARK, tone: 0.07 });
        piece(p, blob(p, foot[0] + (side === 'L' ? -12 : 12), foot[1] + 4, 22, 9, 10, 0.1), { ...DARK, tone: 0.07, angle: 0 });
      } },
    { name: 'thigh' + side, parent: 'torso', pivot: hip, pin: 8.5, bbox: [hip[0] - 40, hip[1] - 32, hip[0] + 40, knee[1] + 40],
      draw(p) { piece(p, p.limb([[hip[0], hip[1] - 14], [knee[0], knee[1] + 12]], 38, 30), { ...DARK, tone: 0.09 }); } },
  ];
  return {
    unit: 0.0027, anchor: [350, 958],
    parts: [
      { name: 'pool', parent: null, pivot: [350, 958], bbox: [110, 920, 590, 1000],
        draw(p) {
          p.shadow(ellipse(340, 962, 220, 26), 0, 0, 16, 0.4);
          piece(p, blob(p, 330, 958, 170, 16, 16, 0.25), { ...DARK, tone: 0.06, angle: 0, angJit: 0.1 }, [0, 4, 8, 0.4]);
          for (let i = 0; i < 4; i++) {
            piece(p, blob(p, p.rand(220, 310), p.rand(950, 964), p.rand(14, 24), p.rand(4, 6), 10, 0.3),
              { rgb: COLOURS[i], w: 4, angle: 0, angJit: 0.1, alpha: 0.9, edge: 0, tone: 0.5 }, [1, 2, 3, 0.4]);
          }
        } },
      ...legParts('L', [322, 585], [316, 772], [306, 948]),
      ...legParts('R', [384, 585], [392, 772], [402, 948]),
      { name: 'torso', parent: null, pivot: [353, 600], bbox: [250, 250, 455, 640],
        draw(p) {
          const torso = [[300, 286], [372, 270], [432, 292], [426, 380], [410, 470], [404, 560], [392, 612], [318, 612], [302, 560], [290, 470], [286, 380]];
          piece(p, torso, { ...DARK, w: 14 }, [10, 14, 12, 0.32]);
          p.fill([[410, 300], [430, 296], [424, 400], [408, 500], [398, 400]], { tone: 0.3, w: 7, alpha: 0.4, base: false, edge: 0 });
        } },
      { name: 'melt', parent: 'torso', pivot: [296, 312], pin: 9, bbox: [190, 280, 335, 985],
        draw(p) {
          const melt = [[302, 292], [262, 312], [232, 370], [216, 450], [220, 540], [230, 612], [240, 566], [252, 640], [262, 580], [274, 618], [284, 548], [296, 470], [300, 380]];
          piece(p, melt, { ...DARK, tone: 0.1, w: 12 });
          for (let i = 0; i < 10; i++) {
            const x = p.rand(232, 292), y = p.rand(360, 540);
            p.brush([[x, y], [x + p.rand(-6, 6), y + 30], [x + p.rand(-8, 8), y + p.rand(50, 90)]],
              { w: p.rand(2, 5), rgb: COLOURS[i % COLOURS.length], alpha: 0.55, taper: 1, body: false });
          }
          const staples = [];
          for (let i = 0; i < 13; i++) {
            const t = i / 12;
            const x = 226 + t * 66 + p.rand(-4, 4), y0 = 560 + p.rand(0, 40);
            const col = (face === 'back' ? i % 3 === 0 : i % 4 === 1) ? COLOURS[i % COLOURS.length] : null;
            const L = (col ? p.rand(90, 220) : p.rand(60, 330)) * (0.7 + t * 0.5);
            const w = col ? p.rand(8, 11) : p.rand(10, 16);
            const end = [x + p.rand(-8, 8), Math.min(940, y0 + L)];
            const strip = p.limb([[x, y0], [x + p.rand(-6, 6), (y0 + end[1]) / 2], end], w, w * 0.55);
            piece(p, strip, col ? { rgb: col, tone: 0.5, w: 4, alpha: 0.95, angle: Math.PI / 2, angJit: 0.1, edge: 0 } : { ...DARK, w: 6, edge: 0.3 }, [4, 6, 5, 0.35]);
            piece(p, blob(p, end[0], end[1], w * 0.55, w * 0.7, 8, 0.12), col ? { rgb: col, tone: 0.5, w: 3, alpha: 0.95, edge: 0 } : { ...DARK, w: 3, edge: 0 }, [3, 4, 4, 0.3]);
            if (col || p.r() < 0.4) staples.push([x - 7, y0 + p.rand(-4, 4), x + 7, y0 - 4 + p.rand(-4, 4)]);
          }
          for (const s of staples) p.staple(...s);
        } },
      { name: 'upperArm', parent: 'torso', pivot: [420, 302], pin: 9, bbox: [385, 268, 545, 388],
        draw(p) { piece(p, p.limb([[416, 298], [512, 350]], 32, 26), DARK); } },
      { name: 'forearm', parent: 'upperArm', pivot: [508, 350], pin: 8.5, bbox: [475, 180, 565, 390],
        draw(p) { piece(p, p.limb([[510, 360], [540, 206]], 26, 20), { ...DARK, angle: -1.4 }); } },
      { name: 'hand', parent: 'forearm', pivot: [541, 210], pin: 7, bbox: [465, 65, 655, 248],
        draw(p) {
          const fingers = [[-0.55, 72, -14], [-0.2, 86, -8], [0.15, 84, 6], [0.5, 68, 14]];
          const knuckles = [];
          for (const [a, L, bend] of fingers) {
            const bx = 547 + Math.sin(a) * 15, by = 176 - Math.cos(a) * 14;
            const dx = Math.sin(a), dy = -Math.cos(a);
            piece(p, p.limb([[bx, by + 6], [bx + dx * L * 0.5 + bend, by + dy * L * 0.5], [bx + dx * L + bend * 2.6, by + dy * L + L * 0.2]], 11, 6),
              { ...DARK, w: 5, angle: Math.atan2(dy, dx), angJit: 0.2, edge: 0.6 }, [3, 5, 4, 0.35]);
            knuckles.push([bx, by]);
          }
          piece(p, p.limb([[536, 200], [512, 184], [494, 162]], 11, 6), { ...DARK, w: 5, edge: 0.6 }, [3, 5, 4, 0.35]);
          piece(p, blob(p, 547, 192, 20, 25, 10, 0.12), DARK);
          for (const [x, y] of knuckles) p.pin(x, y, 3.4);
          p.pin(532, 196, 3.4);
        } },
      face === 'front' ? { name: 'head', parent: 'torso', pivot: [350, 284], pin: 9, bbox: [240, 30, 455, 320],
        draw(p) {
          piece(p, [[282, 152], [270, 60], [326, 126]], { ...DARK, tone: 0.06 });
          piece(p, [[380, 124], [428, 56], [418, 150]], { ...DARK, tone: 0.06 });
          const head = [[288, 252], [276, 196], [290, 146], [318, 124], [350, 118], [384, 122], [412, 148], [424, 198], [410, 254], [350, 280]];
          piece(p, head, { ...DARK, tone: 0.05, w: 10, angle: Math.PI / 2 + 0.2 }, [8, 12, 10, 0.38]);
          p.pin(302, 146, 6.5); p.pin(398, 142, 6.5);
          piece(p, [[308, 182], [322, 166], [336, 182], [334, 204], [326, 226], [318, 206]], PALE, [2, 3, 3, 0.5]);
          p.brush([[326, 226], [322, 262], [318, 312]], { w: 4, rgb: COLOURS[0], alpha: 0.9, taper: 0.6, body: false });
          p.staple(309, 174, 335, 198); p.staple(335, 172, 310, 200);
          piece(p, ellipse(378, 184, 16, 20), PALE, [2, 3, 3, 0.5]);
          p.pin(378, 186, 6.5);
          piece(p, [[294, 232], [350, 236], [406, 218], [398, 238], [372, 256], [350, 262], [322, 260], [300, 248]], PALE, [2, 3, 3, 0.5]);
          for (let i = 0; i < 11; i++) {
            const x = 304 + i * 9.5, t = (x - 350) / 56;
            const y = 236 - (x - 350) * 0.12 - t * t * 4;
            p.brush([[x, y], [x + 0.5, y + 13 - t * t * 6]], { w: 2.4, tone: 0.08, bristles: 2, taper: 0.5, body: false });
          }
          p.staple(290, 228, 302, 246); p.staple(400, 212, 408, 230);
        } } : (
      { name: 'head', parent: 'torso', pivot: [350, 284], pin: 9, bbox: [222, 30, 478, 330],
        draw(p) {
          // the other side: ears drooping, both eyes running, mouth stapled shut in a frown
          piece(p, [[290, 160], [232, 98], [318, 138]], { ...DARK, tone: 0.06 });
          piece(p, [[384, 138], [470, 96], [414, 162]], { ...DARK, tone: 0.06 });
          const head = [[288, 252], [276, 196], [290, 146], [318, 124], [350, 118], [384, 122], [412, 148], [424, 198], [414, 250], [402, 290], [392, 262], [380, 300], [366, 270], [350, 284], [330, 296], [320, 266], [300, 288]];
          piece(p, head, { ...DARK, tone: 0.05, w: 10, angle: Math.PI / 2 + 0.2 }, [8, 12, 10, 0.38]);
          p.pin(304, 150, 6.5); p.pin(396, 150, 6.5);
          // sad brows, slanting up toward the middle
          p.brush([[300, 170], [318, 162], [336, 152]], { w: 5, tone: 0.42, alpha: 0.9, taper: 1, body: false });
          p.brush([[364, 152], [382, 162], [400, 170]], { w: 5, tone: 0.42, alpha: 0.9, taper: 1, body: false });
          const eyeL = [[308, 190], [322, 178], [336, 190], [334, 212], [328, 240], [322, 214]];
          const eyeR = [[364, 190], [378, 178], [392, 190], [390, 212], [384, 240], [378, 214]];
          piece(p, eyeL, PALE, [2, 3, 3, 0.5]);
          piece(p, eyeR, PALE, [2, 3, 3, 0.5]);
          p.staple(309, 182, 335, 206); p.staple(335, 180, 310, 208);
          p.pin(379, 214, 6);
          p.brush([[328, 240], [324, 280], [318, 330]], { w: 4.5, rgb: COLOURS[2], alpha: 0.9, taper: 0.6, body: false });
          p.brush([[384, 240], [388, 284], [392, 328]], { w: 4.5, rgb: COLOURS[0], alpha: 0.9, taper: 0.6, body: false });
          const frown = [[300, 262], [326, 246], [350, 241], [376, 246], [402, 262], [398, 270], [374, 256], [350, 252], [326, 256], [304, 272]];
          piece(p, frown, PALE, [2, 3, 3, 0.5]);
          for (const x of [316, 338, 362, 386]) p.staple(x - 2, 244, x + 2, 270);
        } }
      ),
    ],
  };
}

// ---------------------------------------------------------------------------
// TREES: trunk (+ stapled branches) and three canopy layers pinned at the fork, so they sway apart.
function treeSpec(seed) {
  const r = makeRng(seed);
  const rr = (a, b) => a + (b - a) * r();
  const lean = rr(-16, 16);
  const clumps = [];
  for (let i = 0; i < 21; i++) {
    const a = rr(0, Math.PI * 2), d = Math.sqrt(r());
    clumps.push([357 + lean + Math.cos(a) * d * 205, 250 + Math.sin(a) * d * 145, rr(52, 88), rr(40, 64), r()]);
  }
  clumps.sort((u, v) => u[4] - v[4]);
  const branches = clumps.slice(0, 6).map(([cx, cy]) => [cx, cy, rr(400, 470), rr(-20, 20)]);
  const BARK = { tone: rr(0.26, 0.34), vary: 0.08, w: 7, len: [0.04, 0.12], angJit: 0.08, sheen: 0.25, sheenTone: 0.48, edgeTone: 0.18 };
  const parts = [{
    name: 'trunk', parent: null, pivot: [357, 985], bbox: [100, 60, 620, 1000],
    draw(p) {
      p.shadow(ellipse(360, 975, 180, 18), 0, 0, 12, 0.3);
      for (const pts of [[[330, 940], [282, 970], [226, 984]], [[392, 944], [446, 972], [500, 982]]]) piece(p, p.limb(pts, 30, 10), { ...BARK, angle: 0 });
      const trunk = [[318, 984], [298, 952], [316, 760], [328 + lean * 0.4, 520], [336 + lean, 330], [378 + lean, 330], [384 + lean * 0.4, 520], [396, 760], [420, 952], [404, 986]];
      piece(p, trunk, BARK, [10, 10, 10, 0.3]);
      p.staple(300, 948, 318, 966); p.staple(398, 966, 416, 948);
      for (const [cx, cy, y0, j] of branches) {
        const x0 = 357 + lean * 0.6;
        piece(p, p.limb([[x0, y0], [(x0 + cx) / 2 + j, (y0 + cy) / 2], [cx, cy]], 20, 7), { ...BARK, angle: Math.atan2(cy - y0, cx - x0) });
        const ang = Math.atan2(cy - y0, cx - x0) + Math.PI / 2;
        p.staple(x0 + Math.cos(ang) * 11, y0 + 8 + Math.sin(ang) * 11, x0 - Math.cos(ang) * 11, y0 + 8 - Math.sin(ang) * 11);
      }
    },
  }];
  const n = clumps.length;
  for (let k = 0; k < 3; k++) {
    const layer = clumps.slice(Math.floor((k * n) / 3), Math.floor(((k + 1) * n) / 3));
    parts.push({
      name: 'canopy' + k, parent: 'trunk', pivot: [357 + lean, 420], pin: k === 2 ? 8 : 0, bbox: [40, 22, 680, 485],
      draw(p) {
        layer.forEach(([cx, cy, rx, ry, d], i) => {
          const tone = 0.3 + d * 0.26 + ((255 - cy) / 150) * 0.06;
          const b = scallop(p, cx, cy, rx, ry, 22, 7);
          p.shadow(b, 6, 10, 8, 0.35);
          p.fill(b, { tone, w: 6, len: [0.04, 0.1], minLen: 8, density: 0.8, angJit: Math.PI, curve: 0.7, vary: 0.08, sheen: 0.25, edgeTone: tone - 0.14 });
          p.paperEdge(b, tone);
          for (let q = 0; q < 3; q++) leaf(p, cx + p.rand(-rx, rx) * 0.6, cy + p.rand(-ry, ry) * 0.6, p.rand(9, 13), p.rand(0, 6.3), tone + 0.12);
          if (i % 3 === 2) p.pin(cx + p.rand(-10, 10), cy + p.rand(-8, 8), 5);
          else if (i % 3 === 0) p.staple(cx - rx * 0.8, cy + ry * 0.5, cx - rx * 0.8 + 14, cy + ry * 0.5 + 10);
        });
      },
    });
  }
  return { unit: 0.0068, anchor: [357, 985], parts };
}

// ---------------------------------------------------------------------------
// BUNNY
function bunnySpec() {
  const FUR = { tone: 0.7, vary: 0.07, w: 6, len: [0.03, 0.08], minLen: 8, angJit: 0.4, curve: 0.4, sheen: 0.3, sheenTone: 0.86, edgeTone: 0.6 };
  const part = (p, poly, o, sh = [4, 6, 5, 0.32]) => piece(p, poly, { ...FUR, ...o }, sh);
  return {
    unit: 0.0016, anchor: [205, 282],
    parts: [
      { name: 'earB', parent: 'head', pivot: [300, 116], pin: 3.5, bbox: [240, 5, 320, 135], draw(p) { part(p, p.limb([[298, 120], [284, 70], [262, 22]], 26, 16), { tone: 0.62, angle: -2 }); } },
      { name: 'body', parent: null, pivot: [205, 282], bbox: [70, 125, 310, 295],
        draw(p) {
          p.shadow(ellipse(205, 284, 140, 13), 0, 0, 8, 0.32);
          part(p, blob(p, 196, 208, 98, 70, 14, 0.06), { angle: 0.3 }, [6, 10, 8, 0.3]);
          part(p, blob(p, 100, 196, 20, 18, 8, 0.25), { tone: 0.92, sheen: 0 });
          p.staple(106, 188, 118, 204);
        } },
      { name: 'haunch', parent: 'body', pivot: [152, 232], pin: 4.5, bbox: [88, 188, 215, 285], draw(p) { part(p, blob(p, 150, 236, 52, 38, 10, 0.08), { tone: 0.64, angle: 0.8 }); } },
      { name: 'leg', parent: 'body', pivot: [288, 240], pin: 4, bbox: [262, 220, 335, 290], draw(p) { part(p, p.limb([[286, 236], [300, 262], [318, 272]], 22, 14), { tone: 0.68 }); } },
      { name: 'head', parent: 'body', pivot: [262, 186], pin: 4.5, bbox: [235, 105, 360, 215],
        draw(p) {
          part(p, blob(p, 296, 160, 50, 44, 12, 0.06), { tone: 0.74, angle: 0.4 });
          p.brush([[318, 150], [319, 153]], { w: 8, tone: 0.06, taper: 0 });
          p.brush([[320, 149], [320, 150]], { w: 2, tone: 0.95, taper: 0 });
          p.brush([[344, 172], [346, 174]], { w: 5, tone: 0.3, taper: 0 });
        } },
      { name: 'earF', parent: 'head', pivot: [313, 118], pin: 3.5, bbox: [280, 2, 340, 135],
        draw(p) {
          part(p, p.limb([[314, 122], [312, 70], [300, 18]], 26, 16), { tone: 0.72, angle: -1.7 });
          p.fill(p.limb([[312, 112], [310, 70], [302, 34]], 9, 5), { tone: 0.9, w: 4, alpha: 0.7, edge: 0 });
        } },
    ],
  };
}

// BIRD: a paper body with two wings pinned at the shoulder.
function birdSpec() {
  const INK = { tone: 0.3, w: 4, vary: 0.05, edge: 0.4, sheen: 0.2, edgeTone: 0.25 };
  return {
    unit: 0.006, anchor: [80, 55],
    parts: [
      { name: 'wingB', parent: 'body', pivot: [80, 50], pin: 0, bbox: [20, 0, 90, 60], draw(p) { piece(p, [[80, 50], [30, 8], [62, 46]], { ...INK, tone: 0.26 }, [2, 3, 2, 0.3]); } },
      { name: 'body', parent: null, pivot: [80, 55], bbox: [40, 30, 130, 75],
        draw(p) {
          piece(p, blob(p, 80, 55, 28, 9, 10, 0.08), INK, [2, 3, 2, 0.3]);
          piece(p, ellipse(108, 50, 9, 8), INK, [2, 3, 2, 0.3]);
          piece(p, [[116, 48], [128, 51], [116, 54]], { ...INK, tone: 0.5 }, [1, 1, 1, 0.3]);
          piece(p, [[54, 54], [40, 46], [42, 62]], INK, [1, 2, 2, 0.3]);
        } },
      { name: 'wingF', parent: 'body', pivot: [82, 50], pin: 3, bbox: [70, 0, 140, 60], draw(p) { piece(p, [[82, 50], [134, 6], [98, 46]], { ...INK, tone: 0.36 }, [2, 3, 2, 0.3]); } },
    ],
  };
}

// ---------------------------------------------------------------------------
// Small props: flowers, petals, leaves, grass tufts, pins, ground, horizon rings.

function centredPlane(canvas, worldW, baseY = null) {
  const h = (worldW * canvas.height) / canvas.width;
  const geo = new THREE.PlaneGeometry(worldW, h);
  if (baseY !== null) geo.translate(0, (baseY / canvas.height) * h - h / 2, 0); // canvas row baseY sits on the ground
  return geo;
}

function grassTuftCanvas(seed) {
  return paintCanvas([0, 0, 260, 170], (p) => {
    const n = 12 + Math.floor(p.rand(0, 8));
    for (let i = 0; i < n; i++) {
      const x = p.rand(30, 230), hh = p.rand(50, 150), w = p.rand(8, 14), lean = p.rand(-30, 30);
      const blade = new Path2D();
      blade.moveTo(x - w / 2, 166);
      blade.quadraticCurveTo(x - w * 0.3 + lean * 0.3, 166 - hh * 0.5, x + lean, 166 - hh);
      blade.quadraticCurveTo(x + w * 0.3 + lean * 0.3, 166 - hh * 0.5, x + w / 2, 166);
      blade.closePath();
      cut(p, blade, p.grey(p.rand(0.3, 0.46)), [2, 2, 3, 0.35]);
    }
  }, seed, 0.8);
}

function hillsCanvas(seed, tone, baseY, amp, treeTone) {
  const W = 2048, H = 256;
  return paintCanvas([0, 0, W, H], (p) => {
    const k1 = 3 + Math.floor(p.rand(0, 3)), k2 = 7 + Math.floor(p.rand(0, 4)), ph1 = p.rand(0, 6), ph2 = p.rand(0, 6);
    const top = (x) => baseY + amp * Math.sin((2 * Math.PI * k1 * x) / W + ph1) + amp * 0.4 * Math.sin((2 * Math.PI * k2 * x) / W + ph2);
    for (let i = 0; i < 46; i++) {
      const x = p.rand(0, W), y = top(x) + 4, s = p.rand(14, 30);
      const trunk = new Path2D(); trunk.rect(x - 2, y - s, 4, s + 4);
      cut(p, trunk, p.grey(treeTone - 0.04));
      const crown = new Path2D();
      if (p.r() < 0.5) crown.arc(x, y - s * 1.3, s * 0.6, 0, Math.PI * 2);
      else { crown.moveTo(x - s * 0.55, y - s * 0.7); crown.lineTo(x, y - s * 2.3); crown.lineTo(x + s * 0.55, y - s * 0.7); crown.closePath(); }
      cut(p, crown, p.grey(treeTone));
    }
    const hill = new Path2D();
    hill.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) hill.lineTo(x, top(x));
    hill.lineTo(W, H); hill.closePath();
    cut(p, hill, p.grey(tone), [0, -3, 4, 0.25]);
  }, seed, 1);
}

function bushCanvas(seed) {
  return paintCanvas([0, 0, 420, 250], (p) => {
    const n = 4 + Math.floor(p.rand(0, 3));
    for (let i = 0; i < n; i++) {
      const cx = 210 + p.rand(-120, 120), cy = 190 - p.rand(0, 70), rx = p.rand(60, 95), ry = p.rand(40, 62);
      const tone = p.rand(0.28, 0.44);
      const b = scallop(p, cx, Math.min(cy, 240 - ry), rx, ry, 20, 7);
      p.shadow(b, 5, 8, 6, 0.35);
      p.fill(b, { tone, w: 6, len: [0.04, 0.1], minLen: 8, density: 0.8, angJit: Math.PI, curve: 0.7, vary: 0.08, sheen: 0.25, edgeTone: tone - 0.12 });
      p.paperEdge(b, tone);
      if (i % 2) p.pin(cx + p.rand(-15, 15), cy + p.rand(-10, 10), 5);
    }
  }, seed, 0.7);
}

// Paper clouds hung on threads from the top of the diorama.
function cloudsCanvas(seed) {
  const W = 2048, H = 512;
  return paintCanvas([0, 0, W, H], (p) => {
    for (let i = 0; i < 9; i++) {
      const x = (i + p.rand(0.2, 0.8)) * (W / 9), y = p.rand(190, 330), s = p.rand(0.55, 0.95);
      const c = p.ctx;
      c.strokeStyle = 'rgba(60,58,55,0.55)'; c.lineWidth = 1.2;
      for (const dx of [-40 * s, 44 * s]) { c.beginPath(); c.moveTo(x + dx, y - 16 * s); c.lineTo(x + dx + p.rand(-3, 3), 0); c.stroke(); }
      const w = p.rand(64, 96) * s, h = p.rand(40, 54) * s;
      const cloud = scallop(p, x, y, w, h, 24, 6).map(([u, v]) => [u, Math.min(v, y + h * 0.7)]);
      p.shadow(cloud, 4, 7, 5, 0.22);
      p.fill(cloud, { tone: p.rand(0.76, 0.82), w: 8, angle: 0, angJit: 0.3, vary: 0.04, len: [0.05, 0.12], edge: 0 });
      p.paperEdge(cloud, 0.7);
    }
  }, seed, 1);
}

function groundCanvas(seed) {
  return paintCanvas([0, 0, 512, 512], (p) => {
    p.paper(512, 512, 0.6);
    for (let i = 0; i < 260; i++) {
      const x = p.rand(0, 512), y = p.rand(0, 512), L = p.rand(10, 40);
      p.brush([[x, y], [x + L / 2, y + p.rand(-3, 3)], [x + L, y + p.rand(-4, 4)]], { w: p.rand(3, 9), tone: p.rand(0.5, 0.66), alpha: 0.35, body: false, dry: 0.3 });
    }
    for (let i = 0; i < 26; i++) leaf(p, p.rand(10, 500), p.rand(10, 500), p.rand(10, 16), p.rand(0, 6.3), p.rand(0.42, 0.58));
  }, seed, 1);
}

// ---------------------------------------------------------------------------
// PROPS: things in between the trees. Each is a single painted paper card (the swing is a rig).
const WOOD = { tone: 0.32, vary: 0.08, w: 6, len: [0.05, 0.14], angJit: 0.08, sheen: 0.25, sheenTone: 0.5, edgeTone: 0.2 };
const ring = (cx, cy, rx, ry, n = 14) => [...ellipse(cx, cy, rx, ry, n), [cx + rx, cy]];

const PROPS = {
  stump: { bbox: [0, 0, 300, 230], base: 214, width: 1.0, solid: 0.45, draw(p) {
    p.shadow(ellipse(150, 214, 140, 14), 0, 0, 8, 0.3);
    for (const pts of [[[80, 200], [50, 214], [20, 220]], [[220, 200], [252, 214], [282, 220]]]) piece(p, p.limb(pts, 22, 6), { ...WOOD, angle: 0 });
    piece(p, [[70, 210], [76, 120], [84, 96], [216, 96], [224, 120], [230, 210]], { ...WOOD, angle: Math.PI / 2 });
    piece(p, ellipse(150, 96, 68, 20, 18), { ...WOOD, tone: 0.62, angle: 0, sheen: 0.1 }, [0, 3, 3, 0.3]);
    for (const r of [14, 28, 44, 58]) p.brush(ring(150, 96, r, r * 0.29), { w: 2, tone: 0.38, alpha: 0.7, bristles: 2, body: false, taper: 0 });
    p.pin(150, 96, 6);
  } },
  log: { bbox: [0, 0, 540, 200], base: 186, width: 2.6, solid: 0.7, draw(p) {
    p.shadow(ellipse(270, 186, 250, 12), 0, 0, 8, 0.3);
    piece(p, p.limb([[40, 140], [270, 132], [470, 140]], 92, 84), { ...WOOD, angle: 0 });
    piece(p, ellipse(474, 138, 26, 44, 16), { ...WOOD, tone: 0.6, sheen: 0.1 }, [2, 2, 3, 0.3]);
    for (const r of [10, 20, 32]) p.brush(ring(474, 138, r * 0.6, r, 12), { w: 2, tone: 0.38, alpha: 0.7, bristles: 2, body: false, taper: 0 });
    p.staple(180, 96, 196, 120); p.staple(330, 98, 316, 124);
    for (let i = 0; i < 5; i++) leaf(p, p.rand(80, 420), p.rand(92, 110), p.rand(10, 14), p.rand(0, 6), 0.5);
  } },
  rock: { bbox: [0, 0, 320, 230], base: 214, width: 1.3, solid: 0.55, draw(p) {
    p.shadow(ellipse(160, 214, 140, 14), 0, 0, 8, 0.3);
    piece(p, [[30, 212], [52, 120], [120, 60], [200, 70], [262, 120], [292, 212]], { tone: 0.5, vary: 0.06, w: 10, angle: 0.4, sheen: 0.3, edgeTone: 0.36 });
    piece(p, [[120, 60], [200, 70], [232, 104], [150, 112], [96, 96]], { tone: 0.66, w: 8, angle: 0, sheen: 0.2, edge: 0.4 }, [1, 2, 2, 0.25]);
    p.brush([[170, 120], [180, 160], [168, 200]], { w: 3, tone: 0.28, alpha: 0.8, bristles: 2, body: false });
    p.staple(162, 150, 190, 156);
  } },
  mushrooms: { bbox: [0, 0, 260, 200], base: 190, width: 0.75, solid: 0, draw(p) {
    for (const [x, s] of [[70, 0.9], [130, 1.25], [185, 0.75], [105, 0.6]]) {
      piece(p, p.limb([[x, 188], [x + 4 * s, 188 - 60 * s]], 18 * s, 14 * s), { tone: 0.78, w: 5, angle: -Math.PI / 2, sheen: 0.2 }, [2, 3, 2, 0.3]);
      const cap = [[x - 42 * s, 188 - 56 * s], [x - 30 * s, 188 - 96 * s], [x + 4 * s, 188 - 112 * s], [x + 40 * s, 188 - 96 * s], [x + 50 * s, 188 - 56 * s]];
      piece(p, cap, { tone: 0.3, w: 6, angle: 0, sheen: 0.3, sheenTone: 0.5 }, [3, 4, 3, 0.35]);
      for (let k = 0; k < 4; k++) {
        const u = x + p.rand(-30, 30) * s, v = 188 - p.rand(70, 98) * s;
        p.brush([[u, v], [u + 1, v]], { w: 6 * s, tone: 0.85, taper: 0 });
      }
      p.pin(x + 4 * s, 188 - 84 * s, 3.5 * s + 1);
    }
  } },
  signpost: { bbox: [0, 0, 280, 440], base: 428, width: 1.0, solid: 0.15, draw(p) {
    p.shadow(ellipse(140, 428, 60, 8), 0, 0, 6, 0.3);
    piece(p, p.limb([[140, 430], [138, 60]], 22, 18), { ...WOOD, angle: -Math.PI / 2 });
    // blank arrows, pointing both ways
    piece(p, [[60, 90], [210, 84], [250, 110], [212, 136], [62, 138]], { ...WOOD, tone: 0.6, angle: 0, sheen: 0.15 });
    piece(p, [[220, 170], [70, 168], [30, 196], [70, 222], [222, 220]], { ...WOOD, tone: 0.56, angle: 0, sheen: 0.15 });
    p.pin(140, 112, 6); p.pin(140, 196, 6);
  } },
  bench: { bbox: [0, 0, 480, 270], base: 256, width: 1.9, solid: 0.6, draw(p) {
    p.shadow(ellipse(240, 256, 220, 12), 0, 0, 8, 0.3);
    for (const x of [80, 400]) piece(p, p.limb([[x, 256], [x, 150]], 18, 16), { ...WOOD, angle: -Math.PI / 2 });
    for (const x of [92, 388]) piece(p, p.limb([[x, 160], [x + 6, 40]], 16, 14), { ...WOOD, angle: -Math.PI / 2 });
    piece(p, [[40, 150], [440, 146], [446, 176], [36, 180]], { ...WOOD, tone: 0.5, angle: 0 });
    piece(p, [[60, 50], [430, 44], [434, 74], [58, 82]], { ...WOOD, tone: 0.46, angle: 0 });
    piece(p, [[62, 92], [428, 88], [430, 112], [60, 118]], { ...WOOD, tone: 0.44, angle: 0 });
    for (const [x, y] of [[86, 164], [394, 160], [96, 62], [392, 58], [96, 104], [392, 100]]) p.staple(x - 7, y - 6, x + 7, y + 6);
  } },
  pond: { bbox: [0, 0, 512, 512], flat: true, width: 6, solid: 0, draw(p) {
    p.fill(blob(p, 256, 256, 240, 200, 20, 0.12), { tone: 0.5, w: 12, angle: 0, vary: 0.05, edge: 0.6, edgeTone: 0.42 });
    p.fill(blob(p, 256, 256, 214, 176, 20, 0.1), { tone: 0.3, w: 14, angle: 0.2, vary: 0.04, sheen: 0.3, sheenTone: 0.45, edge: 0 });
    for (const [r, a] of [[60, 0.5], [110, 0.35], [160, 0.2]]) p.brush(ring(220, 236, r, r * 0.8, 24), { w: 2.5, tone: 0.7, alpha: a, bristles: 2, body: false, taper: 0 });
    for (let i = 0; i < 5; i++) {
      const x = p.rand(140, 380), y = p.rand(140, 380);
      piece(p, ellipse(x, y, 26, 20, 12).filter((_, k) => k !== 1), { tone: 0.46, w: 5, angle: 0, sheen: 0.2 }, [3, 4, 3, 0.4]);
      if (i % 2) p.pin(x, y, 4);
    }
  } },
};

// The swing: a frame with a seat hung on two threads, pinned at the bar. It swings with no one on it.
function swingSpec() {
  return {
    unit: 0.0062, anchor: [250, 600],
    parts: [
      { name: 'frame', parent: null, pivot: [250, 600], bbox: [20, 20, 480, 615], draw(p) {
        p.shadow(ellipse(250, 600, 220, 12), 0, 0, 8, 0.3);
        for (const [a, b] of [[[60, 600], [120, 60]], [[180, 600], [130, 60]], [[440, 600], [380, 60]], [[320, 600], [370, 60]]]) piece(p, p.limb([a, b], 18, 14), { ...WOOD, angle: -Math.PI / 2 });
        piece(p, [[90, 50], [410, 46], [412, 74], [88, 78]], { ...WOOD, tone: 0.42, angle: 0 });
        p.staple(118, 54, 136, 72); p.staple(364, 52, 382, 70);
      } },
      { name: 'seat', parent: 'frame', pivot: [250, 62], pin: 6, bbox: [150, 50, 350, 470], draw(p) {
        const c = p.ctx;
        c.strokeStyle = 'rgba(40,38,35,0.85)'; c.lineWidth = 2.5;
        for (const x of [190, 310]) { c.beginPath(); c.moveTo(x, 64); c.lineTo(x, 432); c.stroke(); }
        piece(p, [[166, 426], [334, 422], [338, 452], [162, 456]], { ...WOOD, tone: 0.55, angle: 0 });
        p.staple(184, 430, 196, 446); p.staple(304, 428, 316, 444);
      } },
    ],
  };
}

// Mist: soft banks of torn paper fog.
function mistCanvas(seed) {
  return paintCanvas([0, 0, 512, 256], (p) => {
    const c = p.ctx;
    c.filter = 'blur(14px)';
    for (let i = 0; i < 9; i++) {
      c.fillStyle = `rgba(255,255,255,${p.rand(0.25, 0.5)})`;
      c.beginPath(); c.ellipse(p.rand(120, 392), p.rand(110, 170), p.rand(60, 140), p.rand(28, 60), 0, 0, Math.PI * 2); c.fill();
    }
    c.filter = 'none';
    for (let i = 0; i < 3; i++) {
      const b = scallop(p, p.rand(150, 360), p.rand(120, 160), p.rand(70, 120), p.rand(22, 34), 18, 6);
      const path = new Path2D();
      b.forEach(([x, y], k) => (k ? path.lineTo(x, y) : path.moveTo(x, y)));
      path.closePath();
      c.fillStyle = 'rgba(255,255,255,0.18)'; c.fill(path);
      c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1.5; c.stroke(path);
    }
  }, seed, 1);
}

// Ink the entity leaves behind: a dark splat with drips, and a fleck of stolen colour.
function inkCanvas(seed) {
  return paintCanvas([0, 0, 256, 256], (p) => {
    p.fill(blob(p, 128, 128, 70, 56, 16, 0.35), { tone: 0.08, w: 8, angle: 0.3, vary: 0.04, sheen: 0.15, sheenTone: 0.25, edge: 0.8, edgeTone: 0.1 });
    for (let i = 0; i < 7; i++) {
      const a = p.rand(0, 6.3), r = p.rand(70, 110);
      p.fill(ellipse(128 + Math.cos(a) * r, 128 + Math.sin(a) * r * 0.8, p.rand(5, 12), p.rand(5, 10), 8), { tone: 0.08, w: 3, edge: 0 });
    }
    p.brush([[110, 130], [128, 122], [146, 134]], { w: 5, rgb: COLOURS[seed % 5], alpha: 0.8, taper: 1, body: false });
  }, seed, 1);
}

// Pre-rendered pieces for the first-person hands overlay (drawn with the 2D canvas each frame).
const PALM = [[-50, 0], [-62, -70], [-60, -118], [-34, -138], [4, -146], [40, -134], [60, -110], [60, -60], [52, 0]];
const FINGERS = [[-62, -82, -1.0, 64, -10], [-44, -126, -0.12, 92, -18], [-8, -138, 0.0, 104, -8], [26, -130, 0.1, 96, 6], [50, -112, 0.26, 72, 16]];
const SKIN = { tone: 0.74, vary: 0.06, w: 8, len: [0.03, 0.09], angJit: 0.12, sheen: 0.18, sheenTone: 0.9, edgeTone: 0.64 };

function handParts(scale) {
  const piecesOf = (bbox, draw, seed) => ({ canvas: paintCanvas(bbox, draw, seed, scale), x: bbox[0], y: bbox[1], w: bbox[2] - bbox[0], h: bbox[3] - bbox[1] });
  const sleeve = piecesOf([-140, -40, 110, 330], (p) => {
    const fore = p.limb([[0, 10], [-14, 140], [-34, 300]], 112, 156);
    piece(p, fore, { tone: 0.36, vary: 0.06, w: 12, angle: Math.PI / 2 - 0.1, sheen: 0.2, sheenTone: 0.5, edgeTone: 0.3 }, [8, 10, 10, 0.25]);
    p.fill(p.limb([[34, 20], [24, 140], [10, 300]], 22, 44), { tone: 0.22, w: 8, alpha: 0.5, edge: 0 });
  }, 501);
  const palm = piecesOf([-90, -170, 90, 30], (p) => {
    piece(p, PALM, { ...SKIN, angle: -Math.PI / 2 }, [8, 10, 10, 0.28]);
    p.staple(-40, -14, -26, 12); p.staple(30, -12, 44, 12);
  }, 502);
  const fingers = FINGERS.map(([bx, by, a, L, flop], i) => {
    const dx = Math.sin(a), dy = -Math.cos(a);
    const pts = [[bx - dx * 10, by - dy * 10], [bx + dx * L * 0.5 + flop * 0.3, by + dy * L * 0.5], [bx + dx * L + flop, by + dy * L + Math.abs(flop) * 0.9]];
    const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
    const bbox = [Math.min(...xs) - 26, Math.min(...ys) - 26, Math.max(...xs) + 30, Math.max(...ys) + 30];
    return { ...piecesOf(bbox, (p) => piece(p, p.limb(pts, 30, 22), { ...SKIN, angle: Math.atan2(dy, dx) }, [5, 7, 6, 0.3]), 510 + i), pivot: [bx, by] };
  });
  return { sleeve, palm, fingers };
}

// ---------------------------------------------------------------------------

export async function buildAssets(onProgress) {
  const steps = [];
  const A = {};
  const step = (label, fn) => steps.push([label, fn]);

  step('pins', () => {
    const c = paintCanvas([0, 0, 64, 64], (p) => p.pin(28, 28, 20), 1, 1);
    A.pinCanvas = c;
    PIN = { geo: new THREE.PlaneGeometry(1, 1), mat: paperMat(tex(c)) };
  });
  step('ground', () => { A.groundTex = tex(groundCanvas(7), true); });
  step('far hills', () => {
    A.hills = [
      tex(hillsCanvas(11, 0.66, 150, 26, 0.6), true),
      tex(hillsCanvas(12, 0.6, 175, 20, 0.54), true),
    ];
  });
  for (let i = 0; i < 4; i++) step(`tree ${i + 1} of 4`, () => { (A.trees ??= []).push(rigTemplate(treeSpec(1000 + i * 17), 40 + i, 0.62)); });
  step('the entity', () => { A.entity = rigTemplate(entitySpec('front'), 7, 0.9); });
  step('its other side', () => { A.entityBack = rigTemplate(entitySpec('back'), 8, 0.9); });
  step('bunny', () => { A.bunny = rigTemplate(bunnySpec(), 9, 0.9); });
  step('birds', () => { A.bird = rigTemplate(birdSpec(), 13, 1); });
  step('bushes and clouds', () => {
    A.bushes = [0, 1, 2].map((i) => { const c = bushCanvas(400 + i); return { mat: paperMat(tex(c)), geo: centredPlane(c, 2.4, 240 * 0.7) }; });
    A.clouds = tex(cloudsCanvas(21), true);
  });
  step('grass', () => {
    A.grass = [0, 1, 2, 3].map((i) => { const c = grassTuftCanvas(300 + i); return { mat: paperMat(tex(c)), geo: centredPlane(c, 1.5, 166 * 0.8) }; });
  });
  step('paper flowers', () => {
    A.flowers = [];
    for (let kind = 0; kind < 3; kind++) {
      for (let ci = 0; ci < COLOURS.length; ci++) {
        const c = paintCanvas([0, 0, 120, 120], (p) => paperFlower(p, 60, 50, 32, COLOURS[ci], kind), 700 + kind * 10 + ci, 1);
        A.flowers.push({ tex: tex(c), geo: centredPlane(c, 0.72, 50 + 32 * 1.7) });
      }
    }
  });
  step('petals and leaves', () => {
    const pc = paintCanvas([0, 0, 64, 40], (p) => {
      const pe = new Path2D(); pe.moveTo(6, 20); pe.quadraticCurveTo(24, 2, 58, 16); pe.quadraticCurveTo(62, 20, 58, 24); pe.quadraticCurveTo(24, 38, 6, 20); pe.closePath();
      cut(p, pe, 'rgb(250,250,248)', [1, 2, 2, 0.25]);
      p.brush([[12, 20], [32, 19], [52, 20]], { w: 2, tone: 0.75, alpha: 0.5, bristles: 2, body: false });
    }, 801, 1);
    A.petalTex = tex(pc);
    A.petalGeo = new THREE.PlaneGeometry(0.3, 0.19);
    const lc = paintCanvas([-4, -14, 34, 14], (p) => leaf(p, 0, 0, 28, 0, 0.55), 802, 2);
    A.leafTex = tex(lc);
    A.leafGeo = new THREE.PlaneGeometry(0.2, 0.15);
    const gc = paintCanvas([0, 0, 256, 256], (p) => {
      const g = p.ctx.createRadialGradient(128, 128, 4, 128, 128, 128);
      g.addColorStop(0, 'rgba(255,238,205,0.85)'); g.addColorStop(1, 'rgba(255,238,205,0)');
      p.ctx.fillStyle = g; p.ctx.fillRect(0, 0, 256, 256);
    }, 803, 1);
    A.glowTex = tex(gc);
  });
  step('things between the trees', () => {
    A.props = {};
    let k = 0;
    for (const [name, pr] of Object.entries(PROPS)) {
      const scale = pr.flat ? 1 : 0.8;
      const c = paintCanvas(pr.bbox, pr.draw, 900 + k++, scale);
      const geo = pr.flat ? new THREE.PlaneGeometry(pr.width, (pr.width * c.height) / c.width) : centredPlane(c, pr.width, (pr.base - pr.bbox[1]) * scale);
      A.props[name] = { geo, mat: paperMat(tex(c)), flat: !!pr.flat, solid: pr.solid };
    }
    A.swing = rigTemplate(swingSpec(), 31, 0.8);
  });
  step('mist and ink', () => {
    A.mistTex = tex(mistCanvas(41));
    A.inkTex = [0, 1, 2].map((i) => tex(inkCanvas(50 + i)));
  });
  step('your hands', () => {
    A.hands = handParts(1.4);
    // coloured petals to pin on the back of your hand
    A.handPetals = COLOURS.map((col, i) => paintCanvas([0, 0, 64, 40], (p) => {
      const pe = new Path2D();
      pe.moveTo(6, 20); pe.quadraticCurveTo(24, 2, 58, 16); pe.quadraticCurveTo(62, 20, 58, 24); pe.quadraticCurveTo(24, 38, 6, 20); pe.closePath();
      cut(p, pe, `rgb(${col.join(',')})`, [1, 2, 2, 0.35]);
      p.brush([[12, 20], [32, 19], [54, 20]], { w: 2, tone: 0.9, alpha: 0.35, bristles: 2, body: false });
    }, 820 + i, 1));
  });

  for (let i = 0; i < steps.length; i++) {
    onProgress?.(steps[i][0], i / steps.length);
    await new Promise((r) => setTimeout(r, 16));
    steps[i][1]();
  }
  onProgress?.('done', 1);
  return A;
}
