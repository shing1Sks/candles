// An episode: one game of a kid bot against a monster mind, fully defined by a small config, so any recorded game
// can be rebuilt exactly. Both controllers decide every 3rd tick (20 a second) and hold their input for the 3 ticks
// (a button press counts on the first only): that is the rate the data is recorded at.
import { parseLevel } from './level.js';
import { createGame, stepWorld } from './game.js';
import { observe } from './senses.js';
import { createMind, think } from './mind/index.js';
import { createKidBot, observeKid, KID_STYLES } from './bots/kid.js';
import { randomStart } from './bots/start.js';
import { PERSONA_TYPES } from './mind/personas.js';
import { rng, hash } from './rng.js';
import { STATE_SIZE, KI_SIZE, GI_SIZE, encode, encodeKI, encodeGI, eventId } from './schema.js';

export const DT = 1 / 60, SUB = 3, STEP = DT * SUB;
const L = parseLevel();
const KID_PRESS = ['use', 'throw'], GIANT_PRESS = ['lunge', 'use', 'bash', 'yell', 'light', 'reach'];

// episode i of a batch: everything about it comes from (batch, i) - one of the five monster types, a kid style
// (5% chaos) and skill, and 30% of the time a random mid-game start
export function configFor(batch, i) {
  const seed = hash(batch, i), r = rng(hash(seed, 'config'));
  const persona = { type: PERSONA_TYPES[Math.floor(r() * PERSONA_TYPES.length)] };
  const chaos = r() < 0.05;
  const kid = { style: chaos ? 'chaos' : KID_STYLES[Math.floor(r() * KID_STYLES.length)], skill: 0.2 + 0.8 * r() };
  const start = r() < 0.3 ? 'mid' : 'fresh';
  return { id: `${batch}:${i}`, seed, persona, kid, start, maxT: 300 };
}

// three random streams: the world rng(seed), the mind's, and the kid bot's
export function createEpisode(config) {
  const G = createGame(L, config.seed);
  G.mind = createMind(G, config.persona, hash(config.seed, 1));
  const kidBot = createKidBot(G, config.kid, rng(config.kidSeed ?? hash(config.seed, 2)));
  if (config.start === 'mid') randomStart(G, rng(hash(config.seed, 3)));
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

// An episode stepped one record at a time (the browser viewer drives it frame by frame; runEpisode loops it).
export function startEpisode(config) {
  const { G, kidBot } = createEpisode(config);
  return { config, G, kidBot, h: hash(config.seed), ticks: 0, rows: 0, ki: null, gi: null, t0: G.t }; // t0: a mid-game start's clock
}
// both controllers decide, then 3 ticks run; the events stay in G.events for the caller
export function stepEpisode(ep) {
  const G = ep.G;
  const ki = ep.kidBot(observeKid(G), STEP), gi = think(G, G.mind, observe(G), STEP);
  for (let s = 0; s < SUB && G.state === 'play'; s++) {
    stepWorld(G, s ? held(ki, KID_PRESS) : ki, s ? held(gi, GIANT_PRESS) : gi, DT);
    if (++ep.ticks % 60 === 0) ep.h = hash(ep.h, stateKey(G));
  }
  ep.ki = ki; ep.gi = gi; ep.rows++;
}
// maxT is how long the episode may run (a mid-game start begins with the clock already at 60-200 s)
export const episodeOver = (ep) => ep.G.state !== 'play' || ep.G.t - ep.t0 >= ep.config.maxT - 1e-9;
export const episodeHash = (ep) => hash(ep.h, stateKey(ep.G));

// a growing typed array (doubles when full)
function grower(Type, n) {
  let a = new Type(n), len = 0;
  return {
    push(fill, size) { if (len + size > a.length) { const b = new Type(Math.max(a.length * 2, len + size)); b.set(a); a = b; } len = fill(a, len); },
    done: () => a.slice(0, len),
  };
}

// onRecord(row, G, ki, gi, events): called after every step with what happened in it.
// record: also return the encoded rows: states (rows + 1: the start, then after every step; step r takes states[r]
// to states[r + 1]), the inputs ki and gi of every step, and its events [row, type, x, z, id].
export function runEpisode(config, { onRecord, record = false } = {}) {
  const ep = startEpisode(config), G = ep.G;
  const st = record && grower(Float32Array, STATE_SIZE * 512), k = record && grower(Float32Array, KI_SIZE * 512), g = record && grower(Float32Array, GI_SIZE * 512);
  const events = [];
  if (record) st.push((a, o) => encode(G, a, o), STATE_SIZE); // the state before the first step
  while (!episodeOver(ep)) {
    const row = ep.rows;
    stepEpisode(ep);
    if (record) {
      st.push((a, o) => encode(G, a, o), STATE_SIZE);
      k.push((a, o) => encodeKI(ep.ki, a, o), KI_SIZE);
      g.push((a, o) => encodeGI(ep.gi, a, o), GI_SIZE);
      for (const e of G.events) events.push([row, eventId(e.type), e.x ?? -1, e.z ?? -1, e.id ?? -1]);
    }
    onRecord?.(row, G, ep.ki, ep.gi, G.events);
    G.events.length = 0;
  }
  // t: seconds played in this episode; clock: the game's clock at the end
  const out = { config, outcome: G.state === 'play' ? 'timeout' : G.state, t: G.t - ep.t0, clock: G.t, counts: {}, hash: episodeHash(ep), rows: ep.rows, G };
  if (record) Object.assign(out, { states: st.done(), ki: k.done(), gi: g.done(), events });
  return out;
}
