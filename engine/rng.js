// Seeded randomness for the whole engine. Nothing in engine/ may use Math.random: every draw comes
// from a named stream, so a night replays exactly from its seed, and adding a module never shifts
// another module's dice.

// FNV-1a over the joined parts, then a murmur3 finaliser for good bit mixing
export function hash32(...parts) {
  const s = parts.join('|');
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

// mulberry32
export function makeRng(seed) {
  let a = hash32(seed);
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const range = (lo, hi) => lo + (hi - lo) * next();
  return {
    next,
    range,
    // [lo, hi] given as an array is common in the rulebook
    span: ([lo, hi]) => range(lo, hi),
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    // weighted({ a: 0.6, b: 0.4 }) -> 'a' or 'b'
    weighted: (w) => {
      const keys = Object.keys(w);
      let total = 0;
      for (const k of keys) total += w[k];
      let x = next() * total;
      for (const k of keys) { x -= w[k]; if (x < 0) return k; }
      return keys[keys.length - 1];
    },
  };
}

export class Streams {
  constructor(seed) { this.seed = seed; this.map = new Map(); }
  get(name) {
    if (!this.map.has(name)) this.map.set(name, makeRng(hash32(this.seed, name)));
    return this.map.get(name);
  }
}
