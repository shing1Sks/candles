// The main model's head outputs -> the next state row, as the trainer decodes them (train/model.py predict_next).
// `meta` is play.json: per piece kind its place in the state row (offset, width), its numbers, flags and choices, and
// where its head outputs start in `world` (at, head). Numbers are a change, as odds over symlog bins; flags are odds;
// choices are logits.
//   mix 0: the expected change, the likelier flag, the likeliest choice (the trainer's exam decode)
//   mix 1: every number, flag and choice drawn at `temp`; in between, numbers blend the two and each flag or
//          choice is drawn with chance `mix`
//   mixFor: a mix per kind of piece, e.g. { mind: 1 }: the monster's mind drawn (it commits and varies) while the
//          bodies and the house stay near their expected values (no wandering into walls)
export function decode(meta, world, cur, { temp = 1, mix = 0, mixFor = null, rand = Math.random } = {}) {
  const base = mix;
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
        let v = mean;
        if (mix > 0) {
          let zt = 0;
          for (let b = 0; b < NB; b++) { p[b] = Math.exp((world[o + b] - mx) / temp); zt += p[b]; }
          let u = rand() * zt, b = 0;
          while (b < NB - 1 && (u -= p[b]) > 0) b++;
          v = mean * (1 - mix) + bins[b] * mix;
        }
        next[row + f] = cur[row + f] + Math.sign(v) * Math.expm1(Math.abs(v)) * scale;
        o += NB;
      }
      for (const f of k.flag) {
        const draw = mix > 0 && rand() < mix;
        next[row + f] = draw ? (rand() < 1 / (1 + Math.exp(-world[o] / temp)) ? 1 : 0) : (world[o] > 0 ? 1 : 0);
        o++;
      }
      for (const [c, n] of k.cat) {
        let pick = 0;
        if (mix > 0 && rand() < mix) {
          let mx = -Infinity, zt = 0;
          for (let j = 0; j < n; j++) mx = Math.max(mx, world[o + j]);
          for (let j = 0; j < n; j++) { p[j] = Math.exp((world[o + j] - mx) / temp); zt += p[j]; }
          let u = rand() * zt;
          while (pick < n - 1 && (u -= p[pick]) > 0) pick++;
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

export const sigmoid = (x) => 1 / (1 + Math.exp(-x));
