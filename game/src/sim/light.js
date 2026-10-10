import { CANDLE } from './rules.js';

// How much candlelight reaches a point (0 = dark). The renderer draws the same falloff.
export function lightAt(G, x, z) {
  let s = 0;
  for (const c of G.candles) {
    if (!c.lit) continue;
    const d = Math.hypot(x - c.x, z - c.z);
    if (d < CANDLE.light && G.los(c.x, c.z, x, z)) s += (1 - d / CANDLE.light) ** 2;
  }
  const B = G.beam;
  if (B && B.state === 'on' && Math.hypot(x - B.x, z - B.z) < 2.5) s += 1; // the giant's searchlight
  return s;
}
