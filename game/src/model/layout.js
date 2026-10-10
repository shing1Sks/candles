// Where things sit in the main model's rows, shared by the model's worker and the game.
import { schemaJSON } from '../sim/schema.js';
import { PERSONA_TYPES } from '../sim/mind/personas.js';

// col(kind, name, i): a field's column in the state row, its scale and (for a choice) how many options
export function layout() {
  const S = schemaJSON(), at = new Map();
  for (const t of S.tokens) {
    let o = 0;
    for (const f of t.fields) { at.set(`${t.kind}.${f.name}`, { o, t, f }); o += f.type === 'cat' ? f.n : 1; }
  }
  return (kind, name, i = 0) => { const a = at.get(`${kind}.${name}`); return { c: a.t.offset + i * a.t.width + a.o, s: a.f.scale ?? 1, n: a.f.n }; };
}

// the tile types round the kid, the monster and the 7 toys, as train/model.py patch_ids: a shut door is its own type,
// off the map another. map: { w, h, tiles, doorAt } with doorAt one door id (or -1) per tile
export function patchIds(map, row, col, out) {
  const nT = 8, movers = [['kid', 0], ['monster', 0], ...Array.from({ length: 7 }, (_, i) => ['toy', i])];
  const open = Array.from({ length: 11 }, (_, i) => row[col('door', 'open', i).c]);
  let o = 0;
  for (const [k, i] of movers) {
    const x = Math.floor(row[col(k, 'x', i).c] * map.w), z = Math.floor(row[col(k, 'z', i).c] * map.h);
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      const gx = x + dx, gz = z + dz;
      if (gx < 0 || gz < 0 || gx >= map.w || gz >= map.h) { out[o++] = nT + 1; continue; }
      const d = map.doorAt[gz * map.w + gx];
      out[o++] = d >= 0 && open[d] < 0.5 ? nT : map.tiles[gz * map.w + gx];
    }
  }
  return out;
}

// the monster's traits and type, as train/data.py
export const personaVec = (p) => Float32Array.from([...schemaJSON().personaTraits.map((k) => +(p[k] ?? 0)), ...PERSONA_TYPES.map((t) => (p.type === t ? 1 : 0))]);
