// The game's decode of the main model's outputs matches the trainer's (play.json carries a check row from export.py).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { decode } from '../src/model/decode.js';

const root = new URL('../public/models/', import.meta.url);
const exported = existsSync(root) ? readdirSync(root).filter((d) => existsSync(new URL(`${d}/play.json`, root))) : [];

test('decode matches the trainer on every exported model', { skip: exported.length ? false : 'no exported model in public/models' }, () => {
  for (const d of exported) {
    const meta = JSON.parse(readFileSync(new URL(`${d}/play.json`, root), 'utf8'));
    if (!meta.check) continue;
    const next = decode(meta, meta.check.world, meta.check.cur);
    let worst = 0;
    for (let i = 0; i < next.length; i++) worst = Math.max(worst, Math.abs(next[i] - meta.check.next[i]));
    assert.ok(worst < 1e-4, `${d}: worst difference ${worst}`);
  }
});

test('mix 1 draws: numbers stay within the bins, choices stay one-hot', () => {
  const meta = { nb: 3, scale: 1, bins: [-1, 0, 1], kinds: [{ count: 2, width: 4, offset: 0, num: [0], flag: [1], cat: [[2, 2]], head: 6, at: 0 }] };
  const world = [0, 0, 5, 3, 1, -1, 5, 0, 0, -3, -1, 1];
  for (let t = 0; t < 50; t++) {
    const n = decode(meta, world, new Float32Array(8), { mix: 1 });
    for (const i of [0, 4]) assert.ok(Math.abs(n[i]) <= Math.E - 1 + 1e-6);
    assert.equal(n[2] + n[3], 1); assert.equal(n[6] + n[7], 1);
  }
});

test('topP: a near-certain flag or choice is never drawn the other way; real doubt still is', () => {
  const meta = { nb: 3, scale: 1, bins: [-1, 0, 1], kinds: [{ count: 1, width: 3, offset: 0, num: [], flag: [0], cat: [[1, 2]], head: 3, at: 0 }] };
  let flips = 0, catFlips = 0, doubt = 0;
  for (let t = 0; t < 4000; t++) {
    const n = decode(meta, [7, 7, 0], new Float32Array(3), { mix: 1, topP: 0.9 }); // flag p ~ 0.999, choice p ~ 0.999
    if (n[0] === 0) flips++;
    if (n[2] === 1) catFlips++;
    const m = decode(meta, [0, 0, 0], new Float32Array(3), { mix: 1, topP: 0.9 }); // 50/50: drawn
    doubt += m[0];
  }
  assert.equal(flips, 0); assert.equal(catFlips, 0);
  assert.ok(doubt > 1700 && doubt < 2300, `50/50 flag drawn ${doubt}/4000`);
});
