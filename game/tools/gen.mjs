// The data factory: plays a batch of episodes (kid bots against monster minds) on worker threads and writes them
// to data/<batch>/ at the repo root.
// usage: node tools/gen.mjs <batch> <count> [workers=cores-1] [--out DIR] [--maxT SECONDS] [--keys SHARE]
//   --keys 0.35: that share of kids played as on a keyboard (data v3; see bots/kid.js keyboard)
//   --curious 0.5: that share of kids fiddle with doors, toys and the rest (bots/kid.js curious)
//   --nightmare 1 --policy POLICY.json: that share of games against the learned monster (train/rl), its weights
//   data/<batch>/schema.json                 the row layout (src/sim/schema.js)
//   data/<batch>/shard-NNN/ (256 episodes each)
//     episodes.jsonl   one line per episode: config, the monster's traits, outcome, seconds, rows, hash, case counts,
//                      where its rows start
//     states.f32       float32 states: rows + 1 per episode (the start, then after every step)
//     ki.f32, gi.f32   float32 inputs, one row per step: the kid's and the giant's
//     events.jsonl     one line per episode: [row, type, x, z, id, detail] for every event
//   data/<batch>/errors.jsonl                an episode that crashed: its config and stack (it is skipped)
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { configFor, runEpisode } from '../src/sim/episode.js';
import { schemaJSON } from '../src/sim/schema.js';
import { parseLevel } from '../src/sim/level.js';
import { setNightmarePolicy, mlpPolicy } from '../src/sim/mind/nightmare.js';

const SHARD = 256;
const NL = String.fromCharCode(10);

if (!isMainThread) {
  // a worker: run each episode it is sent, send back its rows
  const { batch, maxT, keys, curious, nightmare, policy } = workerData;
  if (policy) setNightmarePolicy(mlpPolicy(JSON.parse(fs.readFileSync(policy, 'utf8'))));
  parentPort.on('message', (i) => {
    const config = configFor(batch, i, { keys, curious, nightmare });
    if (maxT) config.maxT = maxT;
    try {
      if (process.env.GEN_FAIL !== undefined && Number(process.env.GEN_FAIL) === i) throw new Error('GEN_FAIL: a forced failure');
      const r = runEpisode(config, { record: true });
      const { states, ki, gi } = r;
      const meta = { i, id: config.id, config, persona: r.persona, outcome: r.outcome, t: +r.t.toFixed(2), clock: +r.clock.toFixed(2), rows: r.rows, hash: r.hash, counts: r.counts };
      const events = r.events.map(([row, type, x, z, id, detail]) => [row, type, +x.toFixed(2), +z.toFixed(2), id, detail]);
      parentPort.postMessage({ i, meta, events, states, ki, gi }, [states.buffer, ki.buffer, gi.buffer]);
    } catch (e) {
      parentPort.postMessage({ i, error: { i, config, message: e.message, stack: e.stack } });
    }
  });
} else {
  const args = process.argv.slice(2), flag = (name) => { const k = args.indexOf(name); if (k < 0) return null; const v = args[k + 1]; args.splice(k, 2); return v; };
  const outRoot = flag('--out') || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data');
  const maxT = Number(flag('--maxT')) || 0, keys = Number(flag('--keys')) || 0, curious = Number(flag('--curious')) || 0;
  const nightmare = Number(flag('--nightmare')) || 0, policy = flag('--policy');
  if (nightmare && !policy) { console.error('--nightmare needs --policy'); process.exit(2); }
  const [batch, countArg, workersArg] = args;
  if (!batch || !countArg) { console.error('usage: node tools/gen.mjs <batch> <count> [workers] [--out DIR] [--maxT S] [--keys SHARE]'); process.exit(2); }
  const count = Number(countArg), nWorkers = Math.max(1, Math.min(Number(workersArg) || Math.max(1, os.availableParallelism() - 1), count));
  const dir = path.join(outRoot, batch);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'schema.json'), JSON.stringify({ ...schemaJSON(parseLevel()), batch, count }, null, 1));

  // shards are appended to as episodes finish (in whatever order); each line says where its rows start
  const shards = new Map();
  const shardFor = (i) => {
    const s = Math.floor(i / SHARD);
    if (!shards.has(s)) {
      const sd = path.join(dir, `shard-${String(s).padStart(3, '0')}`);
      fs.mkdirSync(sd, { recursive: true });
      const open = (f) => fs.openSync(path.join(sd, f), 'w');
      shards.set(s, { ep: open('episodes.jsonl'), ev: open('events.jsonl'), st: open('states.f32'), ki: open('ki.f32'), gi: open('gi.f32'), stateRows: 0, inputRows: 0 });
    }
    return shards.get(s);
  };
  const errFd = fs.openSync(path.join(dir, 'errors.jsonl'), 'w');
  const bytes = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength);
  const line = (fd, obj) => fs.writeSync(fd, JSON.stringify(obj) + NL);

  let next = 0, done = 0, failed = 0, rowsAll = 0;
  const t0 = Date.now(), outcomes = { won: 0, caught: 0, timeout: 0 };
  const report = () => {
    const s = (Date.now() - t0) / 1000;
    console.log(`${done}/${count} episodes, ${rowsAll} rows, ${failed} failed, ${s.toFixed(0)} s (won ${outcomes.won}, caught ${outcomes.caught}, timeout ${outcomes.timeout})`);
  };
  await new Promise((resolve) => {
    const finish = () => { done++; if (done % 50 === 0 || done === count) report(); if (done === count) resolve(); };
    const spawn = () => {
      const worker = new Worker(new URL(import.meta.url), { workerData: { batch, maxT, keys, curious, nightmare, policy } });
      const feed = () => { if (next < count) { worker.job = next; worker.postMessage(next++); } else worker.terminate(); };
      // a worker that dies outright: log its episode as failed, carry on with a fresh worker
      worker.on('error', (e) => {
        line(errFd, { i: worker.job, config: configFor(batch, worker.job, { keys, curious, nightmare }), message: e.message, stack: e.stack });
        failed++; finish(); spawn();
      });
      worker.on('message', (m) => {
        if (m.error) { line(errFd, m.error); failed++; }
        else {
          const S = shardFor(m.i);
          fs.writeSync(S.st, bytes(m.states)); fs.writeSync(S.ki, bytes(m.ki)); fs.writeSync(S.gi, bytes(m.gi));
          line(S.ep, { ...m.meta, stateRow: S.stateRows, inputRow: S.inputRows });
          line(S.ev, { i: m.i, events: m.events });
          S.stateRows += m.meta.rows + 1; S.inputRows += m.meta.rows; rowsAll += m.meta.rows;
          outcomes[m.meta.outcome]++;
        }
        finish();
        feed();
      });
      feed();
    };
    for (let w = 0; w < nWorkers; w++) spawn();
  });
  for (const S of shards.values()) for (const k of ['ep', 'ev', 'st', 'ki', 'gi']) fs.closeSync(S[k]);
  fs.closeSync(errFd);
  console.log(`wrote ${dir}`);
}
