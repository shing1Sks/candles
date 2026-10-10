// The generator: episodes run in worker threads and land in shards; a crashing episode is logged and skipped.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { STATE_SIZE, KI_SIZE, GI_SIZE } from '../src/sim/schema.js';

test('6 episodes on 2 workers, one forced to fail: 5 recorded, 1 error, sizes match', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'gen-'));
  execFileSync(process.execPath, ['tools/gen.mjs', 't', '6', '2', '--out', out, '--maxT', '20'], {
    cwd: new URL('..', import.meta.url), env: { ...process.env, GEN_FAIL: '2' }, stdio: 'pipe',
  });
  const dir = path.join(out, 't');
  const schema = JSON.parse(fs.readFileSync(path.join(dir, 'schema.json'), 'utf8'));
  assert.equal(schema.stateSize, STATE_SIZE);
  const eps = fs.readFileSync(path.join(dir, 'shard-000', 'episodes.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(eps.length, 5);
  assert.ok(!eps.some((e) => e.i === 2));
  const errors = fs.readFileSync(path.join(dir, 'errors.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(errors.length, 1); assert.equal(errors[0].i, 2); assert.ok(errors[0].config && errors[0].stack);
  const rows = eps.reduce((s, e) => s + e.rows, 0);
  const size = (f) => fs.statSync(path.join(dir, 'shard-000', f)).size;
  // float32: positions need better than float16's centimetre steps
  assert.equal(size('states.f32'), (rows + eps.length) * STATE_SIZE * 4);
  assert.equal(size('ki.f32'), rows * KI_SIZE * 4);
  assert.equal(size('gi.f32'), rows * GI_SIZE * 4);
  const ev = fs.readFileSync(path.join(dir, 'shard-000', 'events.jsonl'), 'utf8').trim().split('\n');
  assert.equal(ev.length, 5);
  // each episode knows where its rows start
  for (const e of eps) assert.ok(e.stateRow >= 0 && e.inputRow >= 0 && e.counts);
  // the monster's actual (jittered) traits travel with each episode
  for (const e of eps) if (e.config.persona.type !== 'classic') assert.equal(typeof e.persona.smart, 'number');
  fs.rmSync(out, { recursive: true, force: true });
});
