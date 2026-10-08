// THE BOY'S HANDS, first person, on a 2D overlay (ported from the forest). Fingers hang from their
// knuckle pins on springs. Gold stars are stuck in a ring on the back of the left hand. When you
// carry the papers, both hands come together and hold the stack; showing the hall pass holds it up.
import { Painter } from '../art/paint.js';
import { piece } from '../art/designs.js';
import { goldStar, hallPass } from '../art/school.js';

const lerp = (a, b, k) => a + (b - a) * k;
const PALM = [[-50, 0], [-62, -70], [-60, -118], [-34, -138], [4, -146], [40, -134], [60, -110], [60, -60], [52, 0]];
const FINGERS = [[-62, -82, -1.0, 64, -10], [-44, -126, -0.12, 92, -18], [-8, -138, 0.0, 104, -8], [26, -130, 0.1, 96, 6], [50, -112, 0.26, 72, 16]];
const SKIN = { tone: 0.74, vary: 0.06, w: 8, len: [0.03, 0.09], angJit: 0.12, sheen: 0.18, sheenTone: 0.9, edgeTone: 0.64 };

function paintCanvas(bbox, draw, seed, scale) {
  const [x0, y0, x1, y1] = bbox, c = document.createElement('canvas');
  c.width = Math.ceil((x1 - x0) * scale); c.height = Math.ceil((y1 - y0) * scale);
  const ctx = c.getContext('2d'); ctx.scale(scale, scale); ctx.translate(-x0, -y0);
  draw(new Painter(ctx, seed));
  return c;
}

function handParts(scale) {
  const piecesOf = (bbox, draw, seed) => ({ canvas: paintCanvas(bbox, draw, seed, scale), x: bbox[0], y: bbox[1], w: bbox[2] - bbox[0], h: bbox[3] - bbox[1] });
  // a school jumper sleeve with a pale shirt cuff
  const sleeve = piecesOf([-140, -40, 110, 330], (p) => {
    const fore = p.limb([[0, 10], [-14, 140], [-34, 300]], 112, 156);
    piece(p, fore, { tone: 0.34, vary: 0.06, w: 12, angle: Math.PI / 2 - 0.1, sheen: 0.2, sheenTone: 0.48, edgeTone: 0.28 }, [8, 10, 10, 0.25]);
    piece(p, p.limb([[2, 6], [-2, 34]], 116, 118), { tone: 0.86, vary: 0.04, w: 6, angle: 0, edgeTone: 0.7 }, [3, 4, 4, 0.3]);
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

export class Hands {
  constructor(canvas) {
    this.c = canvas; this.ctx = canvas.getContext('2d');
    this.P = handParts(1.4);
    this.pin = paintCanvas([0, 0, 64, 64], (p) => p.pin(28, 28, 20), 1, 1);
    this.star = paintCanvas([-40, -40, 40, 40], (p) => goldStar(p, 0, 0, 30, -Math.PI / 2, [3, 4, 4, 0.4]), 3, 1.5);
    this.pass = paintCanvas([0, 0, 420, 310], (p) => hallPass(p), 4, 1);
    this.paper = paintCanvas([0, 0, 220, 290], (p) => {
      for (let k = 0; k < 6; k++) {
        const o = k * 3, c = p.ctx;
        c.save(); c.translate(110, 145); c.rotate((k - 3) * 0.03); c.translate(-110, -145);
        p.fill([[12 + o, 10 - o], [208 - o, 14 - o], [204 - o, 280 - o], [16 + o, 276 - o]], { tone: 0.9, w: 4, angle: 0, edge: 0.4, edgeTone: 0.75 });
        c.restore();
      }
      for (let l = 0; l < 12; l++) p.brush([[30, 40 + l * 18], [190 - (l % 3) * 30, 42 + l * 18]], { w: 1.4, tone: 0.35, bristles: 1, body: false, dry: 0.3 });
    }, 5, 1);
    this.reach = 0; this.run = 0; this.carry = 0; this.show = 0;
    this.sides = [-1, 1].map(() => ({ ang: this.P.fingers.map(() => 0), vel: this.P.fingers.map(() => 0) }));
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(devicePixelRatio, 1.5);
    this.c.width = innerWidth * dpr; this.c.height = innerHeight * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  draw(dt, { walk, run, bob, turn, reaching, carrying, showing, stars, hidden, tremble, light = 1 }) {
    const ctx = this.ctx, W = innerWidth, H = innerHeight;
    ctx.clearRect(0, 0, W, H);
    if (hidden) return;
    const k = (v, target, rate) => v + (target - v) * Math.min(1, dt * rate);
    this.reach = k(this.reach, reaching ? 1 : 0, 6);
    this.run = k(this.run, run ? 1 : 0, 4);
    this.carry = k(this.carry, carrying ? 1 : 0, 5);
    this.show = k(this.show, showing ? 1 : 0, 6);
    const r = Math.max(this.reach, this.carry * 0.75), sp = this.run * (1 - r), now = performance.now() / 1000;
    const s = (H / 720) * lerp(0.82, 0.9, r);
    const jolt = Math.cos(bob * 2) * walk * (1 + sp * 1.5);

    // the stack of papers, held between both hands
    if (this.carry > 0.02) {
      const pw = H * 0.32, ph = pw * 290 / 220;
      ctx.save(); ctx.globalAlpha = Math.min(1, this.carry * 1.5);
      ctx.translate(W / 2 + Math.sin(bob) * 6, H * lerp(1.25, 0.86, this.carry)); ctx.rotate(-0.04 + Math.sin(bob * 2) * 0.01);
      ctx.drawImage(this.paper, -pw / 2, -ph / 2, pw, ph);
      ctx.restore();
    }

    [-1, 1].forEach((side, si) => {
      const st = this.sides[si];
      const swing = Math.sin(bob) * side;
      let cx = W / 2 + side * H * 0.5 + turn * -30;
      let cy = H * 1.0 + swing * H * 0.035 * walk + Math.sin(now * 1.1 + si) * 4;
      let rot = 0.3 + swing * 0.05 * walk;
      cx = lerp(cx, W / 2 + side * H * 0.42, sp);
      cy = lerp(cy, H * (0.96 + swing * 0.11), sp);
      rot = lerp(rot, 0.45 + swing * 0.28, sp);
      cx = lerp(cx, W / 2 + side * H * (this.carry > 0.5 ? 0.26 : 0.2), r);
      cy = lerp(cy, H * 0.84 + Math.sin(now * 2 + si) * 3, r);
      rot = lerp(rot, 0.16, r);
      if (side > 0 && this.show > 0.02) { cx = lerp(cx, W / 2 + H * 0.12, this.show); cy = lerp(cy, H * 0.72, this.show); rot = lerp(rot, -0.05, this.show); }

      for (let i = 0; i < st.ang.length; i++) {
        const target = (i - 2) * 0.12 * (1 - r * 0.6) + 0.16 * (1 - r) + jolt * 0.16 * (i % 2 ? 1 : -1) - turn * 0.18 * side + (tremble ? Math.sin(now * 22 + i) * 0.06 : 0);
        st.vel[i] += ((target - st.ang[i]) * 60 - st.vel[i] * 7) * dt;
        st.ang[i] += st.vel[i] * dt;
      }
      ctx.save();
      ctx.translate(cx, cy); ctx.scale(s, s);
      if (side > 0) ctx.scale(-1, 1);
      ctx.rotate(rot);
      const { sleeve, palm, fingers } = this.P;
      ctx.drawImage(sleeve.canvas, sleeve.x, sleeve.y, sleeve.w, sleeve.h);
      ctx.scale(-1, 1);
      fingers.forEach((f, i) => {
        ctx.save(); ctx.translate(f.pivot[0], f.pivot[1]); ctx.rotate(st.ang[i]);
        ctx.drawImage(f.canvas, f.x - f.pivot[0], f.y - f.pivot[1], f.w, f.h);
        ctx.restore();
      });
      ctx.drawImage(palm.canvas, palm.x, palm.y, palm.w, palm.h);
      for (const f of fingers) ctx.drawImage(this.pin, f.pivot[0] - 8.3, f.pivot[1] - 8.3, 19, 19);
      if (side < 0 && stars > 0) this.starRing(ctx, stars, now);
      // the hall pass, held up in the right hand
      if (side > 0 && this.show > 0.02) {
        ctx.save(); ctx.globalAlpha = Math.min(1, this.show * 1.4); ctx.scale(-1, 1); ctx.rotate(-0.12);
        ctx.drawImage(this.pass, -150, -330, 300, 221); ctx.restore();
      }
      ctx.restore();
    });
    // your own hands are only as lit as where you're standing: in a dead stretch you barely see them
    this.lit = (this.lit ?? 1) + (Math.max(0.16, Math.min(1, light * 1.5)) - (this.lit ?? 1)) * Math.min(1, dt * 4);
    if (this.lit < 0.99) {
      ctx.save(); ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = `rgba(8,7,6,${1 - this.lit})`; ctx.fillRect(0, 0, W, H); ctx.restore();
    }
  }

  // gold stars stuck around one pin on the back of the left hand
  starRing(ctx, n, now) {
    const cx = 0, cy = -80;
    for (let i = 0; i < n; i++) {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2 + Math.sin(now * 1.3 + i) * 0.03;
      const R = i === 0 && n === 1 ? 0 : 34;
      ctx.drawImage(this.star, cx + Math.cos(a) * R - 21, cy + Math.sin(a) * R - 21, 42, 42);
    }
    ctx.drawImage(this.pin, cx - 12, cy - 12, 27, 27);
  }
}
