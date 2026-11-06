import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, STAGES, PHASES, identifiersAllowed, phaseOf } from '../src/state/machine.js';
import { act, decline } from '../src/agent/loop.js';
import { redact } from '../src/events/redact.js';
import { emit } from '../src/events/log.js';
import { extractConcerns, topicWords } from '../src/agent/concerns.js';

const NOW = new Date('2026-11-05T09:00:00-06:00');

test('stages run welcome to done and group into five patient phases', () => {
  assert.equal(STAGES[0], 'welcome');
  assert.equal(STAGES.at(-1), 'done');
  assert.equal(PHASES.length, 5);
  assert.deepEqual(PHASES.flatMap((p) => p.stages), STAGES);
  assert.equal(phaseOf('recommend').id, 'match');
  assert.equal(phaseOf('signin').id, 'account');
  assert.equal(phaseOf('coverage').id, 'account');
  assert.ok(STAGES.indexOf('signin') === STAGES.indexOf('fit') + 1, 'sign-in comes right after fit (D-22)');
  assert.ok(STAGES.indexOf('coverage') < STAGES.indexOf('options'), 'coverage before matching (D-23)');
});

test('no identifiers before the fit result; sign-up allowed from signin on (D-22)', () => {
  for (const s of ['welcome', 'understand', 'fit']) assert.equal(identifiersAllowed(s), false, s);
  for (const s of ['signin', 'coverage', 'options', 'hold', 'cost', 'book', 'prepare']) assert.equal(identifiersAllowed(s), true, s);
});

test('a confirm-gated tool does not run without confirmation and leaves state unchanged', () => {
  const s = createSession({ now: NOW });
  const before = JSON.stringify({ t: s.timeline, taken: s.taken });
  const r = act(s, 'hold_appointment', { slotId: 'ruiz@2026-11-07T18:00' });
  assert.deepEqual([r.ok, r.error, r.action], [false, 'needs_confirmation', 'hold']);
  assert.equal(JSON.stringify({ t: s.timeline, taken: s.taken }), before);
});

test('a confirmed tool runs, logs confirmation, and adds one timeline line', () => {
  const s = createSession({ now: NOW });
  const r = act(s, 'hold_appointment', { slotId: 'ruiz@2026-11-07T18:00' }, { confirmed: true, reason: 'Held Sat 6 pm with Elena Ruiz' });
  assert.equal(r.ok, true);
  assert.equal(s.timeline.length, 1);
  assert.equal(s.timeline[0].confirmed, true);
  assert.ok(s.events.some((e) => e.name === 'confirmation_given' && e.props.action === 'hold'));
  assert.ok(s.events.some((e) => e.name === 'tool_called' && e.props.tool === 'hold_appointment'));
  assert.equal(s.trace.confirm, 'You confirmed');
});

test('declining a confirmation is logged and runs nothing', () => {
  const s = createSession({ now: NOW });
  decline(s, 'hold');
  assert.ok(s.events.some((e) => e.name === 'confirmation_declined'));
  assert.equal(s.timeline.at(-1).tool, null);
});

test('redact keeps categories and drops anything personal', () => {
  const out = redact({ stage: 'cost', tool: 'estimate_patient_cost', label: 'Estimate', name: 'Maya Ortiz', email: 'maya@example.com',
    dob: '1997-03-02', memberId: 'TEST-1234', address: '12 Elm St', text: 'I worry all the time', story: 'I worry', reason: 'x'.repeat(80) });
  assert.deepEqual(Object.keys(out).sort(), ['label', 'stage', 'tool']);
});

test('emit stores only redacted props', () => {
  const s = createSession({ now: NOW });
  emit(s, 'question_answered', { questionId: 'story', text: 'I worry all the time' });
  const e = s.events.at(-1);
  assert.deepEqual(e.props, { questionId: 'story' });
});

test('extractConcerns maps everyday words to topics, never diagnoses', () => {
  assert.deepEqual(extractConcerns("I've been worried all the time and I can't sleep"), ['anxiety', 'sleep']);
  assert.deepEqual(extractConcerns('I want to restart my medication, I have been really down'), ['depression', 'medication']);
  assert.deepEqual(extractConcerns('not sure, just off'), ['unsure']);
  assert.deepEqual(topicWords(['anxiety', 'sleep']), ['worry', 'sleep']);
});

test('createSession applies persona flags and default variants', () => {
  const s = createSession({ now: NOW, persona: { id: 'maya', flags: { coverageTimeout: true } } });
  assert.equal(s.flags.coverageTimeout, true);
  assert.equal(s.variants['T-09'], 'variant');
  assert.equal(s.variants['T-15'], 'control');
  assert.equal(s.stage, 'welcome');
});
