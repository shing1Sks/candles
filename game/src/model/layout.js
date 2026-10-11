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

// Constrained decoding: a drawn row the model's own world contradicts is not taken. A catch stands only with the
// model's monster within 2 m of the kid (a touch reaches 0.72 m, a lunge further) or its hand out and within 1.5 m;
// a win only with every candle out; a candle out stays out. Nothing is forced, only refused (row is changed in place).
export function cohere(prev, row, col, map) {
  const st = col('game', 'state'), cat = (r) => (r[st.c + 1] > r[st.c] && r[st.c + 1] >= r[st.c + 2] ? 1 : r[st.c + 2] > r[st.c] ? 2 : 0);
  const was = cat(prev), now = cat(row);
  const setPlay = () => { row[st.c] = 1; row[st.c + 1] = 0; row[st.c + 2] = 0; };
  const pos = (k) => [row[col(k, 'x').c] * map.w, row[col(k, 'z').c] * map.h];
  const [kx, kz] = pos('kid');
  if (was === 0 && now === 2) {
    const [mx, mz] = pos('monster'), [hx, hz] = pos('hand');
    const hs = col('hand', 'state'), handOut = row[hs.c] < 0.5; // hand state 0 = idle
    if (Math.hypot(kx - mx, kz - mz) > 2 && !(handOut && Math.hypot(kx - hx, kz - hz) < 1.5)) setPlay();
  }
  for (let i = 0; i < 6; i++) { const c = col('candle', 'lit', i).c; if (prev[c] < 0.5) row[c] = 0; }
  if (was === 0 && now === 1) for (let i = 0; i < 6; i++) if (row[col('candle', 'lit', i).c] > 0.5) { setPlay(); break; }
  return row;
}
