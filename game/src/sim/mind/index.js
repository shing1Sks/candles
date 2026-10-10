// The giant's mind: it reads what the monster senses (senses.js observe) and presses the giant's buttons.
// Every mind keeps the same public fields (mode, target, moods, beliefs), so the recorder can store any of them.
import { rng, hash } from '../rng.js';
import { createClassic, thinkClassic } from './classic.js';

export const MODES = ['sleep', 'idle', 'patrol', 'guard', 'hunt', 'search', 'chase', 'ambush', 'intercept', 'check', 'breather', 'fury', 'spent'];

export function createMind(G, persona = { type: 'classic' }, seed = G.seed) {
  const mind = {
    persona, rand: rng(hash(seed, 'mind')),
    mode: 'sleep', modeT: 0, target: null, lastSeen: null,
    anger: 0, frustration: 0, confidence: 0, furyT: 0, spentT: 0, menace: 0, beliefs: [],
  };
  if (persona.type === 'classic') { Object.assign(mind, createClassic()); mind.think = thinkClassic; }
  else throw new Error(`unknown persona ${persona.type}`);
  return mind;
}

export function think(G, mind, obs, dt) {
  return mind.think(G, mind, obs, dt);
}
