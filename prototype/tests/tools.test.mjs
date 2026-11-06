import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOOLS, TOOL_CONTRACTS, confirmActionFor } from '../src/tools/index.js';

const NOW = new Date('2026-11-05T09:00:00-06:00');
const s = (over = {}) => ({ now: NOW, startedAt: NOW, flags: {}, memory: {}, taken: [], ...over });

test('the twelve spec tools exist, plus the v1 and v3 additions', () => {
  const spec = ['check_service_fit', 'explain_question', 'get_payment_options', 'estimate_patient_cost', 'search_provider_availability',
    'recommend_provider', 'hold_appointment', 'save_patient_progress', 'prepare_intake_summary', 'check_previsit_requirements',
    'request_human_support', 'mark_first_visit_complete'];
  for (const name of spec) assert.equal(typeof TOOLS[name], 'function', name);
  for (const name of ['book_appointment', 'save_payment_method', 'complete_previsit_task', 'start_sign_in', 'verify_sign_in_code', 'check_insurance_eligibility']) assert.equal(typeof TOOLS[name], 'function', name);
  for (const name of Object.keys(TOOLS)) {
    const c = TOOL_CONTRACTS[name];
    assert.ok(c && c.inputs && c.label && c.failures && c.recovery && 'confirm' in c, `contract for ${name}`);
  }
});

test('get_payment_options shows insurance and self-pay as equals, self-pay $250 to be verified', () => {
  const r = TOOLS.get_payment_options(s(), { state: 'TX', preference: 'unsure' });
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(r.data.paths), ['insurance', 'selfPay']);
  assert.equal(r.data.paths.selfPay.price, 250);
  assert.equal(r.data.paths.selfPay.label, 'To be verified');
  assert.equal(r.data.paths.insurance.label, 'Estimate');
  assert.ok(r.data.paths.insurance.plans.length >= 3);
});

test('search_provider_availability respects time windows and plan network', () => {
  const r = TOOLS.search_provider_availability(s(), { payPath: 'insurance', planId: 'lonestar', windows: ['evening'], concerns: ['anxiety'] });
  assert.equal(r.ok, true);
  assert.ok(r.data.slots.length > 0);
  assert.ok(r.data.slots.every((x) => x.window === 'evening'));
  assert.equal(r.label, 'Simulated');
});

test('Gulf Coast HMO has no openings in 14 days, and widening finds some', () => {
  const r = TOOLS.search_provider_availability(s(), { payPath: 'insurance', planId: 'gulfcoast', windows: ['any'], concerns: ['anxiety'] });
  assert.deepEqual([r.ok, r.error], [false, 'none_in_window']);
  const wide = TOOLS.search_provider_availability(s(), { payPath: 'insurance', planId: 'gulfcoast', windows: ['any'], concerns: ['anxiety'], horizonDays: 30 });
  assert.equal(wide.ok, true);
});

test('recommend_provider returns one pick and two alternatives, each with reasons', () => {
  const sess = s();
  const found = TOOLS.search_provider_availability(sess, { payPath: 'insurance', planId: 'lonestar', windows: ['evening'], concerns: ['anxiety', 'sleep'] });
  const r = TOOLS.recommend_provider(sess, { slots: found.data.slots, concerns: ['anxiety', 'sleep'], prefs: {}, payPath: 'insurance', planId: 'lonestar' });
  assert.equal(r.ok, true);
  assert.ok(r.data.primary.reasons.length >= 2);
  assert.equal(r.data.alternatives.length, 2);
  assert.equal(r.data.primary.clinician.id, 'ruiz');
});

test('a Spanish-language preference changes the reason line', () => {
  const sess = s();
  const found = TOOLS.search_provider_availability(sess, { payPath: 'insurance', planId: 'lonestar', windows: ['any'], concerns: ['anxiety'] });
  const r = TOOLS.recommend_provider(sess, { slots: found.data.slots, concerns: ['anxiety'], prefs: { language: 'Spanish' }, payPath: 'insurance', planId: 'lonestar' });
  assert.ok(r.data.primary.reasons.some((x) => /Spanish/.test(x)));
});

test('hold_appointment fails once with slot_taken when the persona flag is set', () => {
  const sess = s({ flags: { slotTaken: true } });
  const found = TOOLS.search_provider_availability(sess, { payPath: 'selfpay', windows: ['any'], concerns: ['anxiety'] });
  const first = TOOLS.hold_appointment(sess, { slotId: found.data.slots[0].id });
  assert.deepEqual([first.ok, first.error], [false, 'slot_taken']);
  const second = TOOLS.hold_appointment(sess, { slotId: found.data.slots[1].id });
  assert.equal(second.ok, true);
});

test('sign-in: nothing is sent, a wrong code fails, 123456 passes (D-24)', () => {
  const sess = s();
  const start = TOOLS.start_sign_in(sess, { email: 'maya@example.com' });
  assert.equal(start.ok, true);
  assert.equal(start.label, 'Simulated');
  assert.equal(start.data.returning, false);
  assert.equal(TOOLS.start_sign_in(sess, { email: 'not an email' }).error, 'invalid_email');
  const wrong = TOOLS.verify_sign_in_code(sess, { email: 'maya@example.com', code: '111111' });
  assert.deepEqual([wrong.ok, wrong.error], [false, 'wrong_code']);
  const right = TOOLS.verify_sign_in_code(sess, { email: 'maya@example.com', code: ' 123456 ' });
  assert.equal(right.ok, true);
  assert.equal(right.data.signedIn, true);
});

test('sign-in knows a returning patient from the scenario flag', () => {
  const sess = s({ flags: { returning: true } });
  assert.equal(TOOLS.start_sign_in(sess, { email: 'maya@example.com' }).data.returning, true);
  assert.equal(TOOLS.verify_sign_in_code(sess, { email: 'maya@example.com', code: '123456' }).data.returning, true);
});

test('eligibility accepts any member id and returns a labelled active result', () => {
  const r = TOOLS.check_insurance_eligibility(s(), { planId: 'lonestar', memberId: 'anything 123', name: 'Maya Ortiz', dob: '1997-03-02' });
  assert.equal(r.ok, true);
  assert.equal(r.data.status, 'active');
  assert.equal(r.data.inNetwork, true);
  assert.equal(r.data.copay, 30);
  assert.equal(r.data.deductibleRemaining, 420);
  assert.equal(r.data.telehealth, true);
  assert.equal(r.label, 'Verified');
  assert.equal(r.data.memberLast4, 'g123');
});

test('eligibility flags map to their outcomes', () => {
  const run = (flag, planId = 'lonestar') => TOOLS.check_insurance_eligibility(s({ flags: { eligibility: flag } }), { planId, memberId: 'X1', name: 'A B', dob: '2000-01-01' });
  assert.deepEqual([run('no_response').ok, run('no_response').error], [false, 'no_response']);
  assert.equal(run('inactive').data.status, 'inactive');
  const carve = run('carve_out');
  assert.deepEqual([carve.data.status, carve.data.carveOut, carve.data.copay], ['active', 'Mesa Behavioral Health', null]);
  assert.equal(run('out_of_network').data.inNetwork, false);
  const other = run(undefined, 'other');
  assert.deepEqual([other.ok, other.data.status, other.data.inNetwork], [true, 'active', true], 'any insurer passes (R-18)');
  assert.ok(other.data.copay > 0);
  assert.deepEqual([run('name_mismatch').ok, run('name_mismatch').error], [false, 'name_mismatch']);
  const timeout = TOOLS.check_insurance_eligibility(s({ flags: { coverageTimeout: true } }), { planId: 'lonestar', memberId: 'X1' });
  assert.equal(timeout.error, 'no_response');
});

test('eligibility not_found_once fails once, then passes on retry', () => {
  const sess = s({ flags: { eligibility: 'not_found_once' } });
  const first = TOOLS.check_insurance_eligibility(sess, { planId: 'bluebonnet', memberId: 'X1', name: 'A B', dob: '2000-01-01' });
  assert.deepEqual([first.ok, first.error], [false, 'not_found']);
  assert.equal(TOOLS.check_insurance_eligibility(sess, { planId: 'bluebonnet', memberId: 'X1', name: 'A B', dob: '2000-01-01' }).ok, true);
});

test('estimate_patient_cost uses the consented check and never invents a number', () => {
  const none = TOOLS.estimate_patient_cost(s(), {});
  assert.deepEqual([none.ok, none.error, none.label], [false, 'no_check', 'Unknown']);
  assert.equal(none.data?.estimate, undefined);
  const elig = TOOLS.check_insurance_eligibility(s(), { planId: 'lonestar', memberId: 'X1' }).data;
  const r = TOOLS.estimate_patient_cost(s(), { eligibility: elig });
  assert.deepEqual([r.ok, r.data.estimate, r.label], [true, 30, 'Estimate']);
  const carve = TOOLS.check_insurance_eligibility(s({ flags: { eligibility: 'carve_out' } }), { planId: 'lonestar', memberId: 'X1' }).data;
  const p = TOOLS.estimate_patient_cost(s(), { eligibility: carve });
  assert.deepEqual([p.ok, p.data.pending, p.label], [true, true, 'To be verified']);
  const inactive = TOOLS.check_insurance_eligibility(s({ flags: { eligibility: 'inactive' } }), { planId: 'lonestar', memberId: 'X1' }).data;
  assert.equal(TOOLS.estimate_patient_cost(s(), { eligibility: inactive }).ok, false);
});

test('save_patient_progress only accepts synthetic email addresses', () => {
  assert.equal(TOOLS.save_patient_progress(s(), { email: 'maya@gmail.com' }).error, 'not_test_email');
  assert.equal(TOOLS.save_patient_progress(s(), { email: 'maya@example.com' }).ok, true);
});

test('prepare_intake_summary is an AI draft in the patient\'s words, not a diagnosis', () => {
  const r = TOOLS.prepare_intake_summary(s({ memory: { story: 'I worry all the time and cannot sleep', topics: ['worry', 'sleep'] } }), {});
  assert.equal(r.label, 'AI draft');
  assert.match(r.data.text, /I worry all the time and cannot sleep/);
  assert.match(r.data.notice, /not a diagnosis/i);
});

test('mark_first_visit_complete needs the clinician to confirm', () => {
  assert.equal(TOOLS.mark_first_visit_complete(s(), { bookingId: 'B1', clinicianConfirmed: false }).ok, false);
  const r = TOOLS.mark_first_visit_complete(s({ booking: { id: 'B1', slot: { start: '2026-11-10T18:00:00-06:00' } } }), { bookingId: 'B1', clinicianConfirmed: true });
  assert.equal(r.ok, true);
  assert.equal(r.data.daysSinceStart, 5);
});

test('confirmActionFor maps tools to P-CONFIRM actions', () => {
  assert.equal(confirmActionFor('hold_appointment', {}), 'hold');
  assert.equal(confirmActionFor('book_appointment', {}), 'book');
  assert.equal(confirmActionFor('save_payment_method', {}), 'pay');
  assert.equal(confirmActionFor('estimate_patient_cost', {}), null);
  assert.equal(confirmActionFor('check_insurance_eligibility', {}), 'send');
  assert.equal(confirmActionFor('start_sign_in', {}), 'send');
  assert.equal(confirmActionFor('verify_sign_in_code', {}), null);
  assert.equal(confirmActionFor('complete_previsit_task', { task: 'consent' }), 'consent');
  assert.equal(confirmActionFor('complete_previsit_task', { task: 'summary' }), 'share_summary');
  assert.equal(confirmActionFor('complete_previsit_task', { task: 'device' }), null);
  assert.equal(confirmActionFor('search_provider_availability', {}), null);
});
