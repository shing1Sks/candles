// HEADLESS NIGHTS: run the school with no browser, a scripted agent playing, and write the data twin.
//   node engine/sim.js --seed 7 --agent wander|lesson --minutes 10 [--out night.jsonl]
// The same seed and agent always give the same file, byte for byte. When a night ends (expelled or
// home time) the next night starts from a seed derived from the first, and the pages carry over.
import { writeFileSync } from 'node:fs';
import { createWorld, stepWorld, NO_INPUT } from './world.js';
import { hash32, makeRng } from './rng.js';
import { snapshot, TWIN_EVERY } from './twin.js';
import { wander } from './agents/wander.js';
import { lesson } from './agents/lesson.js';

const AGENTS = { wander, lesson };

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith('--') ? [...acc, [a.slice(2), arr[i + 1]]] : acc), []));
const seed = Number(args.seed ?? 1), agentName = args.agent ?? 'wander', minutes = Number(args.minutes ?? 5);
const agent = AGENTS[agentName];
if (!agent) { process.stderr.write(`unknown agent ${agentName}; one of ${Object.keys(AGENTS).join(', ')}\n`); process.exit(2); }

let night = 1, world = createWorld({ seed, night }), mem = agent.init();
const rng = makeRng(hash32(seed, 'agent', agentName));
const lines = [];
let buffered = [], last = [], input = NO_INPUT;
const total = Math.round(minutes * 60 * 60);
for (let k = 0; k < total; k++) {
  input = agent.act(world.S, world.layout, rng, mem, last);
  last = stepWorld(world, input);
  buffered.push(...last);
  if (k % TWIN_EVERY === TWIN_EVERY - 1) { lines.push(JSON.stringify(snapshot(world.S, input, buffered, night))); buffered = []; }
  if (world.S.phase === 'expelled' || world.S.phase === 'home') {
    const pages = world.S.held.pages;
    night++;
    world = createWorld({ seed: hash32(seed, 'night', night), night, pagesFound: pages });
    mem = agent.init();
  }
}
const out = lines.join('\n') + '\n';
if (args.out) writeFileSync(args.out, out); else process.stdout.write(out);
