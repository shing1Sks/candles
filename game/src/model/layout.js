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

// A whole-map model (play.json ids > 225) also sees the house and the line from the kid to the monster: after the
// patches, every tile row by row (a shut door its own type), then RAY tiles along the line, as train/model.py view_ids.
const RAY = 16;
export function viewIds(map, row, col, out) {
  patchIds(map, row, col, out);
  if (out.length <= 225) return out;
  const nT = 8, open = Array.from({ length: 11 }, (_, i) => row[col('door', 'open', i).c]);
  const tile = (x, z) => { const d = map.doorAt[z * map.w + x]; return d >= 0 && open[d] < 0.5 ? nT : map.tiles[z * map.w + x]; };
  let o = 225;
  for (let z = 0; z < map.h; z++) for (let x = 0; x < map.w; x++) out[o++] = tile(x, z);
  const f = Math.fround, kx = f(row[col('kid', 'x').c] * map.w), kz = f(row[col('kid', 'z').c] * map.h);
  const mx = f(row[col('monster', 'x').c] * map.w), mz = f(row[col('monster', 'z').c] * map.h);
  for (let i = 0; i < RAY; i++) {
    const t = f((i + 0.5) / RAY);
    const x = Math.min(map.w - 1, Math.max(0, Math.floor(f(kx + f(f(mx - kx) * t))))), z = Math.min(map.h - 1, Math.max(0, Math.floor(f(kz + f(f(mz - kz) * t)))));
    out[o++] = tile(x, z);
  }
  return out;
}

// the monster's traits and type, as train/data.py PERSONA_TYPES (classic first, the nightmare last); n: the model's
// persona size (models before the nightmare have one type fewer)
const TYPES = ['classic', ...PERSONA_TYPES, 'nightmare'];
export const personaVec = (p, n = 9 + TYPES.length) => Float32Array.from([...schemaJSON().personaTraits.map((k) => +(p[k] ?? 0)), ...TYPES.map((t) => (p.type === t ? 1 : 0))].slice(0, n));

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

// The same for walls (on unless &walls=0): a decoded position inside a tile the piece cannot be in (level.js KID_BLOCK /
// MON_BLOCK, or a shut door) is refused one axis at a time, so it slides along the wall instead. The model still moves
// everything; this only refuses the moves its own map patches say are impossible. Held keys pushed the kid into walls
// 4-8% of the time even after the keyboard data: a crutch until training fixes it.
const KID_BLOCK = new Set([1, 6, 7]), MON_BLOCK = new Set([1, 6, 7, 2, 3, 4, 5]); // WALL LOW TALL (+ DUCT CRACK TABLE BED)
export function unwall(prev, row, col, map) {
  const shut = (tx, tz) => { const d = map.doorAt[tz * map.w + tx]; return d >= 0 && row[col('door', 'open', d).c] < 0.5; };
  for (const [kind, blocks] of [['kid', KID_BLOCK], ['monster', MON_BLOCK]]) {
    const cx = col(kind, 'x').c, cz = col(kind, 'z').c;
    const bad = (x, z) => {
      const tx = Math.floor(x * map.w), tz = Math.floor(z * map.h);
      if (tx < 0 || tz < 0 || tx >= map.w || tz >= map.h) return true;
      return blocks.has(map.tiles[tz * map.w + tx]) || shut(tx, tz);
    };
    if (!bad(row[cx], row[cz]) || bad(prev[cx], prev[cz])) continue; // fine, or already inside (never trap it)
    if (!bad(prev[cx], row[cz])) row[cx] = prev[cx];
    else if (!bad(row[cx], prev[cz])) row[cz] = prev[cz];
    else { row[cx] = prev[cx]; row[cz] = prev[cz]; }
  }
  return row;
}
