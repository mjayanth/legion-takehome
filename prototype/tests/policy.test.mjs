import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSafety } from '../src/policy/safe.js';
import { checkFitRules } from '../src/policy/fit.js';
import { needsConfirmation, CONFIRM_ACTIONS } from '../src/policy/confirm.js';
import { classifyClinical, CLINICAL_REFUSAL } from '../src/policy/clinical.js';

test('P-SAFE routes the E-9 free-text disclosure', () => {
  const r = evaluateSafety({ text: "Honestly I've had thoughts of not wanting to be here anymore" });
  assert.equal(r.route, true);
  assert.ok(r.ruleId.startsWith('SAFE-'));
});

test('P-SAFE routes misspelled and spaced-out disclosures', () => {
  for (const t of ['been feeling sucidal lately', 'I want to kill  my self', 'thinking about ending my life', 'I want to DIE']) {
    assert.equal(evaluateSafety({ text: t }).route, true, t);
  }
});

test('P-SAFE does not route ordinary text', () => {
  for (const t of ["I can't sleep and I worry all the time", 'I want to restart my medication', 'my job is killing me with stress deadlines']) {
    assert.equal(evaluateSafety({ text: t }).route, false, t);
  }
});

test('P-SAFE routes a yes on the safety question', () => {
  assert.equal(evaluateSafety({ answer: 'yes' }).route, true);
  assert.equal(evaluateSafety({ answer: 'no' }).route, false);
});

test('P-FIT accepts a Texas adult with a treated concern', () => {
  const r = checkFitRules({ state: 'TX', adult: true, concerns: ['anxiety', 'sleep'], emergency: false });
  assert.equal(r.fit, 'yes');
});

test('P-FIT declines other states with rule FIT-STATE', () => {
  const r = checkFitRules({ state: 'CA', adult: true, concerns: ['anxiety'], emergency: false });
  assert.deepEqual([r.fit, r.ruleId], ['no', 'FIT-STATE']);
  assert.ok(r.reason.length > 10);
});

test('P-FIT declines under 18 with rule FIT-AGE', () => {
  const r = checkFitRules({ state: 'TX', adult: false, concerns: ['anxiety'], emergency: false });
  assert.deepEqual([r.fit, r.ruleId], ['no', 'FIT-AGE']);
});

test('P-FIT sends out-of-scope needs to a person with FIT-SCOPE', () => {
  const r = checkFitRules({ state: 'TX', adult: true, concerns: ['detox'], emergency: false });
  assert.deepEqual([r.fit, r.ruleId], ['person', 'FIT-SCOPE']);
});

test('P-FIT asks for the missing input instead of guessing', () => {
  const r = checkFitRules({ adult: true, concerns: ['anxiety'] });
  assert.deepEqual([r.fit, r.ruleId], ['missing', 'FIT-MISSING-state']);
});

test('P-CONFIRM covers every consequential action and nothing else', () => {
  for (const a of ['hold', 'book', 'pay', 'consent', 'records', 'send', 'share_summary']) assert.equal(needsConfirmation(a), true, a);
  assert.equal(CONFIRM_ACTIONS.length, 7);
  assert.equal(needsConfirmation('search'), false);
});

test('P-CLINICAL catches diagnosis and medication questions', () => {
  assert.equal(classifyClinical('Do I have bipolar?'), 'diagnosis');
  assert.equal(classifyClinical('am i depressed or just tired'), 'diagnosis');
  assert.equal(classifyClinical('Should I go back on Lexapro?'), 'medication');
  assert.equal(classifyClinical('what dose of sertraline is normal'), 'medication');
  assert.equal(classifyClinical('I feel anxious most days'), null);
  assert.match(CLINICAL_REFUSAL, /clinician/);
});

test('P-CLINICAL does not refuse a patient stating their own history', () => {
  assert.equal(classifyClinical('I was diagnosed with depression years ago and stopped my meds'), null);
  assert.equal(classifyClinical('Can you diagnose me?'), 'diagnosis');
});

test('P-CLINICAL allows a patient naming a medication they used to take', () => {
  assert.equal(classifyClinical('I used to take Lexapro a few years back'), null);
  assert.equal(classifyClinical('is lexapro better than zoloft?'), 'medication');
});

test('P-FIT declines another state right away, before age is known', () => {
  const r = checkFitRules({ state: 'CA' });
  assert.deepEqual([r.fit, r.ruleId], ['no', 'FIT-STATE']);
});
