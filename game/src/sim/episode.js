// An episode: one game of a kid bot against a monster mind, fully defined by a small config, so any recorded game
// can be rebuilt exactly. Both controllers decide every 3rd tick (20 a second) and hold their input for the 3 ticks
// (a button press counts on the first only): that is the rate the data is recorded at.
import { parseLevel } from './level.js';
import { createGame, stepWorld } from './game.js';
import { observe } from './senses.js';
import { createMind, think } from './mind/index.js';
import { createKidBot, observeKid } from './bots/kid.js';
import { rng, hash } from './rng.js';

export const DT = 1 / 60, SUB = 3, STEP = DT * SUB;
const L = parseLevel();
const KID_PRESS = ['use', 'throw'], GIANT_PRESS = ['lunge', 'use', 'bash', 'yell', 'light', 'reach'];

// episode i of a batch: everything about it comes from (batch, i)
export function configFor(batch, i) {
  const seed = hash(batch, i);
  return { id: `${batch}:${i}`, seed, persona: { type: 'classic' }, kid: { style: 'probe', skill: 0.6 }, start: 'fresh', maxT: 300 };
}

// three random streams: the world rng(seed), the mind's, and the kid bot's
export function createEpisode(config) {
  const G = createGame(L, config.seed);
  G.mind = createMind(G, config.persona, hash(config.seed, 1));
  const kidBot = createKidBot(G, config.kid, rng(config.kidSeed ?? hash(config.seed, 2)));
  return { G, kidBot };
}

const held = (inp, presses) => { const o = { ...inp }; for (const b of presses) o[b] = false; return o; };
const r4 = (v) => Math.round(v * 1e4);
// what the replay hash covers: where everyone is, what is lit and open, what the monster is doing
function stateKey(G) {
  const k = G.kid, M = G.monster;
  let lit = 0, open = 0;
  G.candles.forEach((c, i) => { if (c.lit) lit |= 1 << i; });
  G.doors.forEach((d, i) => { if (d.open) open |= 1 << i; });
  return [r4(k.x), r4(k.z), r4(M.x), r4(M.z), lit, open, k.hidden, k.held, M.act, G.mind.mode, G.state].join(',');
}

// onRecord(row, G, ki, gi, events): called after every 3-tick step with what happened in it
export function runEpisode(config, { onRecord } = {}) {
  const { G, kidBot } = createEpisode(config);
  const events = [];
  let h = hash(config.seed), row = 0, ticks = 0;
  while (G.state === 'play' && G.t < config.maxT - 1e-9) {
    const ki = kidBot(observeKid(G), STEP), gi = think(G, G.mind, observe(G), STEP);
    for (let s = 0; s < SUB && G.state === 'play'; s++) {
      stepWorld(G, s ? held(ki, KID_PRESS) : ki, s ? held(gi, GIANT_PRESS) : gi, DT);
      events.push(...G.events); G.events.length = 0;
      if (++ticks % 60 === 0) h = hash(h, stateKey(G));
    }
    onRecord?.(row, G, ki, gi, events);
    row++; events.length = 0;
  }
  h = hash(h, stateKey(G));
  return { config, outcome: G.state === 'play' ? 'timeout' : G.state, t: G.t, counts: {}, hash: h, rows: row, G };
}
