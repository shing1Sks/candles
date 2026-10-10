import { CANDLE } from './rules.js';
import { los } from './grid.js';

// How much candlelight reaches a point (0 = dark). The renderer draws the same falloff.
export function lightAt(G, x, z) {
  let s = 0;
  for (const c of G.candles) {
    if (!c.lit) continue;
    const d = Math.hypot(x - c.x, z - c.z);
    if (d < CANDLE.light && los(G.L, c.x, c.z, x, z)) s += (1 - d / CANDLE.light) ** 2;
  }
  return s;
}
