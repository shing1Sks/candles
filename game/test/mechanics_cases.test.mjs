// Every case of the model's mechanics exam (tools/mechanics/cases.mjs, with the generated families of families.mjs)
// must pass by the rules: a case the rules fail is a broken case, not a model that is wrong.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CASES } from '../tools/mechanics/cases.mjs';
import { playRules } from '../tools/mechanics/play.mjs';

test('every case has its own id and a family', () => {
  const seen = new Set();
  for (const c of CASES) {
    assert.ok(!seen.has(c.id), `${c.id} twice`); seen.add(c.id);
    assert.ok(c.fam, `${c.id} has no family`);
  }
});
for (const c of CASES) {
  test(`${c.id} ${c.what} (by the rules)`, () => {
    const { why } = playRules(c);
    assert.equal(why, null, why);
  });
}
