// EDGE CONTRACTS. Every chunk edge either has a corridor crossing it (a port) or not, decided by the
// edge alone, so the chunks on both sides always agree and corridors line up without either chunk
// knowing about the other. A lattice of always-open ports keeps the whole floor connected:
//   even rows: east-west ports always open (main corridors)
//   columns i % 3 == 0: north-south ports always open (cross corridors)
//   odd rows hang off the row above: their north port is always open
import { hash32 } from '../rng.js';
import { RULES } from '../rules.js';

const mod = (a, n) => ((a % n) + n) % n;

// The shared edge: 'h' edges run east-west (crossed going north-south), 'v' edges run north-south.
//   N of (i,j) = h(i, j), S of (i,j) = h(i, j+1), W of (i,j) = v(i, j), E of (i,j) = v(i+1, j)
export function edgeKey(floor, i, j, side) {
  switch (side) {
    case 'N': return ['h', i, j];
    case 'S': return ['h', i, j + 1];
    case 'W': return ['v', i, j];
    case 'E': return ['v', i + 1, j];
    default: throw new Error(`bad side ${side}`);
  }
}

export function portOpen(seed, floor, i, j, side) {
  const [kind, a, b] = edgeKey(floor, i, j, side);
  if (kind === 'v' && mod(b, 2) === 0) return true;          // main corridor rows
  if (kind === 'h' && mod(a, 3) === 0) return true;          // cross corridor columns
  if (kind === 'h' && mod(b, 2) === 1) return true;          // an odd row's north edge
  return hash32(seed, 'port', floor, kind, a, b) / 4294967296 < RULES.layout.portP;
}

export const SIDES = ['N', 'S', 'E', 'W'];
export const OPPOSITE = { N: 'S', S: 'N', E: 'W', W: 'E' };
