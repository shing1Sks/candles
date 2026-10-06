// Tiny procedural "oil paint" brush engine for concept cards.
// THROWAWAY spike code: used to judge look and feel, not the final art pipeline.

export function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Catmull-Rom through [x, y] points.
export function smooth(pts, steps = 8, closed = false) {
  const n = pts.length;
  const get = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const segs = closed ? n : n - 1;
  const out = [];
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      const f = (k) =>
        0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 +
          (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
      out.push([f(0), f(1)]);
    }
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}

export function ellipse(cx, cy, rx, ry, n = 12) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
  });
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));

export class Painter {
  constructor(ctx, seed = 1) {
    this.ctx = ctx;
    this.r = makeRng(seed);
    this.tab = Array.from({ length: 256 }, () => this.r());
  }

  rand(a = 0, b = 1) { return a + (b - a) * this.r(); }

  noise(x) {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return this.tab[i & 255] * (1 - u) + this.tab[(i + 1) & 255] * u;
  }

  // Slightly warm grey: the whole world is grey oil paint.
  grey(v, a = 1) {
    const g = Math.round(clamp01(v) * 255);
    return `rgba(${Math.min(255, g + 4)},${Math.min(255, g + 2)},${Math.max(0, g - 3)},${a})`;
  }

  rgbJit([r, g, b], a = 1, j = 14) {
    const c = (v) => Math.max(0, Math.min(255, Math.round(v + (this.r() - 0.5) * 2 * j)));
    return `rgba(${c(r)},${c(g)},${c(b)},${a})`;
  }

  // One brush stroke = many bristles following a smoothed path, with taper and dry-brush gaps.
  brush(pts, o = {}) {
    const {
      w = 8, tone = 0.5, alpha = 0.85, rgb = null, dry = 0.12, taper = 1, wobble = 0.12,
      steps = 10, spread = 0.12, body = true,
    } = o;
    const bristles = o.bristles ?? Math.max(3, Math.round(w * 0.9));
    const P = smooth(pts, steps);
    const N = P.length;
    if (N < 2) return;
    const nm = P.map((_, i) => {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(N - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
      return [-dy / L, dx / L];
    });
    const ctx = this.ctx;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const tp = (i) => (taper ? Math.pow(Math.max(0, Math.sin((Math.PI * i) / (N - 1))), 0.35 * taper) : 1);

    if (body) {
      // Thin underlayer so wide strokes read as paint, not hair.
      ctx.fillStyle = rgb ? this.rgbJit(rgb, alpha * 0.35, 0) : this.grey(tone, alpha * 0.35);
      ctx.beginPath();
      for (let i = 0; i < N; i++) ctx.lineTo(P[i][0] + nm[i][0] * w * 0.42 * tp(i), P[i][1] + nm[i][1] * w * 0.42 * tp(i));
      for (let i = N - 1; i >= 0; i--) ctx.lineTo(P[i][0] - nm[i][0] * w * 0.42 * tp(i), P[i][1] - nm[i][1] * w * 0.42 * tp(i));
      ctx.fill();
    }

    for (let k = 0; k < bristles; k++) {
      const off = (this.r() - 0.5) * w;
      const ph = this.r() * 200, gph = this.r() * 200;
      const a0 = Math.floor(this.r() * taper * 0.15 * N);
      const a1 = N - 1 - Math.floor(this.r() * taper * 0.15 * N);
      const a = alpha * (0.4 + 0.6 * this.r());
      ctx.strokeStyle = rgb ? this.rgbJit(rgb, a) : this.grey(tone + (this.r() - 0.5) * spread, a);
      ctx.lineWidth = Math.max(0.5, (w / bristles) * (0.8 + this.r() * 1.6));
      ctx.beginPath();
      let pen = false;
      for (let i = a0; i <= a1; i++) {
        if (dry > 0 && this.noise(gph + i * 0.09) < dry) { pen = false; continue; }
        const wob = (this.noise(ph + i * 0.18) - 0.5) * w * wobble * 2;
        const d = off * tp(i) + wob;
        const x = P[i][0] + nm[i][0] * d, y = P[i][1] + nm[i][1] * d;
        if (!pen) { ctx.moveTo(x, y); pen = true; } else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  pathOf(poly) {
    const S = smooth(poly, 8, true);
    const path = new Path2D();
    S.forEach((p, i) => (i ? path.lineTo(p[0], p[1]) : path.moveTo(p[0], p[1])));
    path.closePath();
    return { S, path };
  }

  // Fill a closed shape with short directional dabs (clipped) on a flat underpaint,
  // then light "sheen" dabs on top and a broken, feathered edge.
  fill(poly, o = {}) {
    const {
      tone = 0.5, vary = 0.1, angle = Math.PI / 2, w = 16, density = 1.2, alpha = 0.85, curve = 0.15,
      rgb = null, base = true, len = [0.08, 0.22], minLen = 18, angJit = 0.25, sheen = 0, sheenTone = null,
      edge = 1, edgeTone = null,
    } = o;
    const ctx = this.ctx;
    const { S, path } = this.pathOf(poly);
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (const [x, y] of S) { minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); }
    const cx = (minx + maxx) / 2, cy = (miny + maxy) / 2;
    const R = Math.hypot(maxx - minx, maxy - miny) / 2 + w;

    const dab = (t, a, wScale) => {
      const ang = angle + (this.r() - 0.5) * 2 * angJit;
      const dx = Math.cos(ang), dy = Math.sin(ang), px = -dy, py = dx;
      const L = Math.max(minLen, this.rand(len[0], len[1]) * 2 * R);
      const x = this.rand(minx - w, maxx + w), y = this.rand(miny - w, maxy + w);
      const bend = (this.r() - 0.5) * L * curve;
      const A = [x - (dx * L) / 2, y - (dy * L) / 2], B = [x + (dx * L) / 2, y + (dy * L) / 2];
      const M = [x + px * bend, y + py * bend];
      this.brush([A, M, B], { w: w * wScale * this.rand(0.7, 1.3), tone: t + (this.r() - 0.5) * vary * 2, alpha: a, rgb, dry: 0.22, taper: 0.8, body: false });
    };

    ctx.save();
    ctx.clip(path);
    if (base) { ctx.fillStyle = rgb ? this.rgbJit(rgb, alpha, 0) : this.grey(tone, alpha); ctx.fill(path); }
    const area = (maxx - minx + 2 * w) * (maxy - miny + 2 * w);
    const meanL = Math.max(minLen, ((len[0] + len[1]) / 2) * 2 * R);
    const n = Math.ceil((area / (meanL * w * 0.55)) * density);
    for (let i = 0; i < n; i++) dab(tone, alpha, 1);
    for (let i = 0; i < n * sheen; i++) dab(sheenTone ?? tone + 0.18, alpha * this.rand(0.15, 0.45), 0.5);
    ctx.restore();

    // ragged edge: short strokes running along the boundary, nudged in/out, so silhouettes read as paint
    if (edge > 0) {
      let area2 = 0;
      for (let i = 0; i < S.length; i++) { const a = S[i], b = S[(i + 1) % S.length]; area2 += a[0] * b[1] - b[0] * a[1]; }
      const sgn = area2 > 0 ? 1 : -1;
      const et = edgeTone ?? tone;
      const n = S.length;
      const nrm = (i) => {
        const a = S[(i - 1 + n) % n], b = S[(i + 1) % n];
        const nx = (b[1] - a[1]) * sgn, ny = -(b[0] - a[0]) * sgn, L = Math.hypot(nx, ny) || 1;
        return [nx / L, ny / L];
      };
      for (let i = 0; i < n; i += 3) {
        if (this.r() > 0.7 * edge) continue;
        const span = 2 + Math.floor(this.r() * 4);
        const pts = [];
        for (let k = 0; k <= span; k++) {
          const j = (i + k) % n, [nx, ny] = nrm(j), d = this.rand(-1.5, 3.5);
          pts.push([S[j][0] + nx * d, S[j][1] + ny * d]);
        }
        this.brush(pts, { w: this.rand(2.5, 6), tone: et + this.rand(-0.04, 0.04), rgb, alpha: alpha * 0.9, bristles: 3, taper: 1, body: true, dry: 0.1 });
      }
    }
  }

  // Polygon around a centreline, width tapering w0 -> w1 (for limbs, fingers, ears).
  limb(pts, w0, w1 = w0) {
    const P = smooth(pts, 6);
    const N = P.length;
    const left = [], right = [];
    for (let i = 0; i < N; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(N - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
      const hw = (w0 + (w1 - w0) * (i / (N - 1))) / 2;
      left.push([P[i][0] - (dy / L) * hw, P[i][1] + (dx / L) * hw]);
      right.push([P[i][0] + (dy / L) * hw, P[i][1] - (dx / L) * hw]);
    }
    const step = Math.max(1, Math.floor(N / 10));
    const pick = (arr) => arr.filter((_, i) => i % step === 0 || i === arr.length - 1);
    return [...pick(left), ...pick(right).reverse()];
  }

  // Soft cast shadow: gives cards the "3D cut paper" depth.
  shadow(poly, ox, oy, blur = 10, a = 0.3) {
    const ctx = this.ctx;
    const { path } = this.pathOf(poly.map(([x, y]) => [x + ox, y + oy]));
    ctx.save();
    ctx.filter = `blur(${blur}px)`;
    ctx.fillStyle = `rgba(20,18,16,${a})`;
    ctx.fill(path);
    ctx.restore();
  }

  // Scribbly hand-drawn outline: a few jittered passes around the shape.
  outline(poly, o = {}) {
    const { tone = 0.15, w = 2.5, jit = 3, passes = 2, alpha = 0.8 } = o;
    for (let k = 0; k < passes; k++) {
      const pts = poly.map(([x, y]) => [x + this.rand(-jit, jit), y + this.rand(-jit, jit)]);
      pts.push(pts[0], pts[1]);
      this.brush(pts, { w, tone, alpha, bristles: 2, taper: 0.3, dry: 0.25, body: false, steps: 8 });
    }
  }

  // Cut-paper thickness: light rim offset toward the light (top-left), dark rim away from it.
  paperEdge(poly, tone = 0.3, a = 0.75) {
    const ctx = this.ctx;
    const { path } = this.pathOf(poly);
    for (const [d, t, lw] of [[0.9, tone - 0.2, 1.3], [-0.8, tone + 0.28, 1.1]]) {
      ctx.save();
      ctx.translate(d, d);
      ctx.lineWidth = lw;
      ctx.strokeStyle = this.grey(t, a);
      ctx.stroke(path);
      ctx.restore();
    }
  }

  // Steel split-pin head (paper fastener): every pin is a joint the game can move.
  pin(x, y, r = 6) {
    const ctx = this.ctx;
    ctx.save();
    ctx.filter = 'blur(2px)';
    ctx.fillStyle = 'rgba(15,14,12,0.5)';
    ctx.beginPath(); ctx.arc(x + r * 0.35, y + r * 0.5, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.08, x, y, r);
    g.addColorStop(0, 'rgb(244,242,236)'); g.addColorStop(0.35, 'rgb(172,170,164)'); g.addColorStop(1, 'rgb(66,64,60)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(28,26,24,0.85)'; ctx.lineWidth = 1; ctx.stroke();
  }

  // Staple across two points: shadow, the two punch holes, the steel bar and its glint.
  staple(x1, y1, x2, y2, w = 2.4) {
    const ctx = this.ctx;
    const line = (ax, ay, bx, by) => { ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); };
    ctx.save();
    ctx.lineCap = 'round';
    ctx.filter = 'blur(1.2px)';
    ctx.strokeStyle = 'rgba(15,14,12,0.55)'; ctx.lineWidth = w + 1;
    line(x1 + 1.2, y1 + 1.8, x2 + 1.2, y2 + 1.8);
    ctx.filter = 'none';
    ctx.fillStyle = 'rgba(18,16,14,0.9)';
    for (const [x, y] of [[x1, y1], [x2, y2]]) { ctx.beginPath(); ctx.arc(x, y, w * 0.6, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = 'rgb(128,126,121)'; ctx.lineWidth = w;
    line(x1, y1, x2, y2);
    ctx.strokeStyle = 'rgba(238,236,230,0.9)'; ctx.lineWidth = w * 0.35;
    line(x1 - 0.5, y1 - 0.6, x2 - 0.5, y2 - 0.6);
    ctx.restore();
  }

  // Grey canvas ground with faint big strokes and grain.
  paper(W, H, tone = 0.7) {
    const ctx = this.ctx;
    ctx.fillStyle = this.grey(tone);
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) {
      const y = this.rand(-50, H + 50), x = this.rand(-200, W);
      const len = this.rand(200, 600);
      this.brush([[x, y], [x + len / 2, y + this.rand(-20, 20)], [x + len, y + this.rand(-30, 30)]],
        { w: this.rand(30, 70), tone: tone + this.rand(-0.06, 0.05), alpha: 0.18, dry: 0.3, body: false });
    }
    const img = ctx.getImageData(0, 0, W, H), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (this.r() - 0.5) * 18;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
  }
}
