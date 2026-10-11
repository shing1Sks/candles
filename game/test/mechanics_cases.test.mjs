// Every case of the model's mechanics exam (tools/mechanics/cases.mjs) must pass by the rules: a case the rules fail
// is a broken case, not a model that is wrong.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CASES } from '../tools/mechanics/cases.mjs';
import { playRules } from '../tools/mechanics/play.mjs';

for (const c of CASES) {
  test(`${c.id} ${c.what} (by the rules)`, () => {
    const { why } = playRules(c);
    assert.equal(why, null, why);
  });
}
