import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REVIEWER, TESTS, FRICTION, GOALS } from '../src/reviewer/content.js';
import { STAGES, DEFAULT_VARIANTS } from '../src/state/machine.js';

test('every stage explains what changed and why', () => {
  for (const s of STAGES) {
    const r = REVIEWER[s];
    assert.ok(r, s);
    assert.ok(r.title && r.change && r.agent, `${s} has title, change and agent`);
    assert.ok(r.friction.length + r.goals.length > 0, `${s} has friction or goals`);
  }
});

test('every friction, test and goal referenced exists', () => {
  for (const s of STAGES) {
    for (const f of REVIEWER[s].friction) assert.ok(FRICTION[f], `${s}: ${f}`);
    for (const t of REVIEWER[s].tests) assert.ok(TESTS[t], `${s}: ${t}`);
    for (const g of REVIEWER[s].goals) assert.ok(GOALS[g], `${s}: ${g}`);
  }
});

test('all 13 friction points are addressed somewhere', () => {
  const used = new Set(STAGES.flatMap((s) => REVIEWER[s].friction));
  for (let i = 1; i <= 13; i++) assert.ok(used.has(`FP-${String(i).padStart(2, '0')}`), `FP-${i}`);
});

test('every flippable test has a default variant and both arms described', () => {
  for (const [id, t] of Object.entries(TESTS)) {
    assert.ok(t.control && t.variant && t.metric, id);
    if (t.flippable) assert.ok(id in DEFAULT_VARIANTS, id);
  }
});
