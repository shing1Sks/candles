import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ENGINE = fileURLToPath(new URL('..', import.meta.url));
const sim = (out, agent) => execFileSync(process.execPath, [join(ENGINE, 'sim.js'), '--seed', '7', '--agent', agent, '--minutes', '2', '--out', out]);

for (const agent of ['wander', 'lesson']) {
  test(`headless ${agent} night is byte-identical across runs`, () => {
    const a0 = join(ENGINE, `tmp_${agent}_a.jsonl`), b0 = join(ENGINE, `tmp_${agent}_b.jsonl`);
    sim(a0, agent); sim(b0, agent);
    const a = readFileSync(a0, 'utf8'), b = readFileSync(b0, 'utf8');
    rmSync(a0); rmSync(b0);
    assert.equal(a, b);
    const lines = a.trim().split('\n');
    assert.ok(lines.length >= 12 * 120 - 2, `only ${lines.length} lines`);
    const first = JSON.parse(lines[0]);
    for (const k of ['t', 'night', 'input', 'player', 'held', 'clock', 'headmaster', 'rooms', 'phase', 'events']) assert.ok(k in first, `missing ${k}`);
  });
}

test('the lesson agent actually does lessons', () => {
  const out = join(ENGINE, 'tmp_lesson_c.jsonl');
  execFileSync(process.execPath, [join(ENGINE, 'sim.js'), '--seed', '11', '--agent', 'lesson', '--minutes', '4', '--out', out]);
  const rows = readFileSync(out, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  rmSync(out);
  const types = new Set(rows.flatMap((r) => r.events.map((e) => e.type)));
  assert.ok(types.has('lessonStart'), 'never started a lesson');
  assert.ok(types.has('paperTaken') || types.has('sat') || types.has('storyPageFound'), `did nothing in a lesson: ${[...types].join(',')}`);
});
