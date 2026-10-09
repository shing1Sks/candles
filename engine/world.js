// THE ONE ENTRY POINT. createWorld() builds a night from a seed; stepWorld() advances it one fixed
// tick given the player's input. The browser app and the headless sim both drive the engine only
// through these two functions.
import { hash32, Streams } from './rng.js';
import { RULES } from './rules.js';
import { createState } from './state.js';
import { makeEmitter } from './events.js';
import { Layout } from './layout/space.js';
import { player } from './modules/player.js';
import { doors } from './modules/doors.js';
import { headmaster } from './modules/headmaster.js';
import { director } from './director.js';
import { classroom } from './modules/classroom.js';
import { stairs } from './modules/stairs.js';
import { exit } from './modules/exit.js';
import { clock } from './modules/clock.js';
import { detention } from './modules/detention.js';
import { tension } from './modules/tension.js';
import { opening } from './modules/opening.js';
import { rare } from './modules/rare.js';

export const NO_INPUT = Object.freeze({
  move: { x: 0, z: 0 }, look: { yaw: 0, pitch: 0 },
  run: false, crouch: false, use: false, useHeld: false, drop: false, show: false,
});

// the order modules step in, each tick
export const DEFAULT_MODULES = [player, opening, doors, director, rare, headmaster, classroom, stairs, exit, clock, detention, tension];

// seenAnomalies: what the corridors did last night (kinds), held back tonight so it isn't seen twice;
// seenRare: the rare nights you've had, held back the same way (forceRare: have one now, for tests)
export function createWorld({ seed, night = 1, pagesFound = [], seenAnomalies = [], seenRare = [], forceRare = null, modules = DEFAULT_MODULES } = {}) {
  const S = createState(seed, { night, pagesFound });
  if (seenAnomalies.length) S.layout.recentAnomalies = seenAnomalies.slice(-5);
  if (seenRare.length) S.layout.seenRare = seenRare.slice(-3);
  if (forceRare) S.layout.forceRare = forceRare;
  const streams = new Streams(seed);
  const world = { S, streams, layout: new Layout(seed, S), modules, emit: makeEmitter(S) };
  for (const m of modules) m.init?.(S, ctxFor(world, m));
  return world;
}

function ctxFor(world, m) {
  return { rng: world.streams.get(m.id), emit: world.emit, layout: world.layout, rules: RULES, world };
}

export function stepWorld(world, input = NO_INPUT) {
  const { S } = world;
  S.events.length = 0;
  for (const m of world.modules) m.step?.(S, input, ctxFor(world, m));
  S.tick++;
  S.t = S.tick * RULES.DT;
  return S.events.slice();
}

export const stateHash = (S) => hash32(JSON.stringify(S));
