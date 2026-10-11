// The main model's head outputs -> the next state row, as the trainer decodes them (train/model.py predict_next).
// `meta` is play.json: per piece kind its place in the state row (offset, width), its numbers, flags and choices, and
// where its head outputs start in `world` (at, head). Numbers are a change, as odds over symlog bins; flags are odds;
// choices are logits.
//   mix 0: the expected change, the likelier flag, the likeliest choice (the trainer's exam decode)
//   mix 1: every number, flag and choice drawn at `temp`; in between, numbers blend the two and each flag or
//          choice is drawn with chance `mix`
//   mixFor: a mix per kind of piece, e.g. { mind: 1 }: the monster's mind drawn (it commits and varies) while the
//          bodies and the house stay near their expected values (no wandering into walls)
//   topP:  draws come only from the likeliest options holding this much of the odds (nucleus sampling). Drawing
//          every flag 20 times a second lets a 0.1% chance happen: a candle goes out by itself, a game is won at 5
//          candles. With topP 0.9 what is near certain stays certain and only real doubt is drawn.
//   snap:  when the model is sure a number does not change (over half the odds on the two bins round zero), it does
//          not change at all; the expected value is never exactly zero, so timers, cooldowns and still things crept
//   peak:  the expected value round the likeliest bin only (+-2 bins), not over all of them: where the odds have two
//          humps (blocked by a wall, or a full step) the plain mean is a half step into the wall, and steps add up
export function decode(meta, world, cur, { temp = 1, mix = 0, mixFor = null, topP = 1, snap = false, peak = false, rand = Math.random } = {}) {
  const base = mix;
  let z0 = 0;
  while (z0 < meta.nb - 1 && meta.bins[z0 + 1] < 0) z0++; // bins z0 and z0 + 1 straddle zero
  const next = Float32Array.from(cur), bins = meta.bins, NB = meta.nb, scale = meta.scale;
  const p = new Float64Array(NB);
  for (const k of meta.kinds) {
    mix = mixFor?.[k.kind] ?? base;
    for (let i = 0; i < k.count; i++) {
      const h = k.at + i * k.head, row = k.offset + i * k.width;
      let o = h;
      for (const f of k.num) {
        // the expected change, and a draw at temp
        let mx = -Infinity;
        for (let b = 0; b < NB; b++) mx = Math.max(mx, world[o + b]);
        let z = 0, mean = 0;
        for (let b = 0; b < NB; b++) { p[b] = Math.exp(world[o + b] - mx); z += p[b]; mean += p[b] * bins[b]; }
        mean /= z;
        if (peak) {
          let b0 = 0;
          for (let b = 1; b < NB; b++) if (p[b] > p[b0]) b0 = b;
          let zz = 0, mm = 0;
          for (let b = Math.max(0, b0 - 2); b <= Math.min(NB - 1, b0 + 2); b++) { zz += p[b]; mm += p[b] * bins[b]; }
          mean = mm / zz;
        }
        let v = mean;
        if (snap && (p[z0] + p[z0 + 1]) / z > 0.5) { next[row + f] = cur[row + f]; o += NB; continue; }
        if (mix > 0) {
          for (let b = 0; b < NB; b++) p[b] = Math.exp((world[o + b] - mx) / temp);
          v = mean * (1 - mix) + bins[nucleus(p, NB, topP, rand)] * mix;
        }
        next[row + f] = cur[row + f] + Math.sign(v) * Math.expm1(Math.abs(v)) * scale;
        o += NB;
      }
      for (const f of k.flag) {
        const q = 1 / (1 + Math.exp(-world[o] / temp)), sure = Math.max(q, 1 - q) >= topP;
        const draw = !sure && mix > 0 && rand() < mix;
        next[row + f] = draw ? (rand() < q ? 1 : 0) : (world[o] > 0 ? 1 : 0);
        o++;
      }
      for (const [c, n] of k.cat) {
        let pick = 0;
        if (mix > 0 && rand() < mix) {
          let mx = -Infinity;
          for (let j = 0; j < n; j++) mx = Math.max(mx, world[o + j]);
          for (let j = 0; j < n; j++) p[j] = Math.exp((world[o + j] - mx) / temp);
          pick = nucleus(p, n, topP, rand);
        } else {
          for (let j = 1; j < n; j++) if (world[o + j] > world[o + pick]) pick = j;
        }
        for (let j = 0; j < n; j++) next[row + c + j] = j === pick ? 1 : 0;
        o += n;
      }
    }
  }
  return next;
}

// a draw from the first n odds p (unnormalised), among the likeliest options holding topP of the total
const order = new Int32Array(128);
function nucleus(p, n, topP, rand) {
  let z = 0;
  for (let j = 0; j < n; j++) { z += p[j]; order[j] = j; }
  if (topP >= 1) {
    let u = rand() * z, j = 0;
    while (j < n - 1 && (u -= p[j]) > 0) j++;
    return j;
  }
  const idx = Array.prototype.slice.call(order, 0, n).sort((a, b) => p[b] - p[a]);
  let kept = 0, m = 0;
  while (m < n && kept < topP * z) kept += p[idx[m++]];
  let u = rand() * kept, j = 0;
  while (j < m - 1 && (u -= p[idx[j]]) > 0) j++;
  return idx[j];
}

export const sigmoid = (x) => 1 / (1 + Math.exp(-x));
