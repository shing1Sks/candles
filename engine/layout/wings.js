// WINGS (research/07 phase 3, research/05 R15): the school is made of parts that each look, sound and
// feel like themselves, so you can tell where you are and a new part is an event. A wing covers a
// 2 x 2 block of chunks on one floor. The block you start in is always the main corridor (the
// baseline everything else is measured against).
//   main      grey plaster, lockers, notices                         the everyday school
//   infants   lino, coat pegs, drawings at child height (ground only) warm, small, the worst things
//   science   glazed tiles, stains, puddles, a drip                  cold
//   old       dark panelling, portraits, a stopped clock              the oldest part, nearest the Hall
import { hash32 } from '../rng.js';

export const WINGS = {
  main: { lockerP: 0.85, partialP: 0.35 },
  infants: { lockerP: 0.1, partialP: 1 },
  science: { lockerP: 0.5, partialP: 0.6 },
  old: { lockerP: 0.25, partialP: 0.8 },
};

const DECK = [['main', 40], ['infants', 20], ['science', 20], ['old', 20]];
const DECK_UP = [['main', 45], ['science', 30], ['old', 25]];

export function wingOf(seed, floor, i, j) {
  const bi = Math.floor(i / 2), bj = Math.floor(j / 2);
  if (floor === 0 && bi === 0 && bj === 0) return 'main';
  const deck = floor === 0 ? DECK : DECK_UP;
  let h = hash32(seed, 'wing', floor, bi, bj) % 100;
  for (const [w, p] of deck) { if (h < p) return w; h -= p; }
  return 'main';
}
