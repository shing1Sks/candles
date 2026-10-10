// Seeded randomness. Each game draws from separate streams (the world, the monster's mind, the kid bot), so
// changing one never shifts the others, and a seed always replays the same game.

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// mix integers (and strings) into one 32-bit seed
export function hash(...parts) {
  let h = 0x811c9dc5;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) {
      h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
      h ^= h >>> 13;
    }
    h = Math.imul(h ^ 0x9e37, 0x2c1b3c6d);
    h ^= h >>> 15;
  }
  return h >>> 0;
}
