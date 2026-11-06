// Controller and views. Screens render from session state; every action goes
// through the agent loop (act), policies, or a confirmation card.
import { createSession, PHASES, STAGES, stageIndex, phaseOf } from '../state/machine.js';
import { act, decline, note } from '../agent/loop.js';
import { emit } from '../events/log.js';
import { evaluateSafety } from '../policy/safe.js';
import { classifyClinical, CLINICAL_REFUSAL } from '../policy/clinical.js';
import { extractConcerns, topicWords } from '../agent/concerns.js';
import { TOOLS, TOOL_CONTRACTS, fmtSlot, clinicianById } from '../tools/index.js';
import { PLANS, SELF_PAY_PRICE } from '../tools/data.js';
import { REVIEWER, TESTS, FRICTION, GOALS } from '../reviewer/content.js';
import { PERSONAS, SCENARIOS } from './personas.js';
import { esc, badge, icon, btn } from './dom.js';

let S; // session
// 'patient' = only what a patient sees; 'reviewer' = notes, demo patients, test switches. null = not chosen yet.
let MODE = null;
const loadMode = () => { const q = new URLSearchParams(location.search).get('mode'); if (q === 'patient' || q === 'reviewer') return q; try { return localStorage.getItem('legion-proto-mode'); } catch (e) { return null; } };
const saveMode = (m) => { try { localStorage.setItem('legion-proto-mode', m); } catch (e) { /* storage blocked: the choice lasts for this visit */ } };
let ui;
// Card types that are single questions: Back works between these.
const QUESTION = new Set(['state', 'otherstate', 'story', 'safety', 'adult', 'signin', 'code', 'pay', 'insurance', 'times']);
const $ = (sel) => document.querySelector(sel);

// ---------- copy ----------
const SAFETY_LINE = {
  welcome: "If you're not safe right now, call or text 988. You don't have to finish this first.",
  understand: "If you're not safe right now, call or text 988. You don't have to finish this first.",
  fit: "If you're not safe right now, call or text 988. You don't have to finish this first.",
  signin: "If you're not safe right now, call or text 988. You don't have to finish this first.",
  coverage: "If cost is what's stopping you, 988 is free and open now.",
  options: 'If things get worse before your visit, call or text 988 any time, day or night.',
  recommend: 'If things get worse before your visit, call or text 988 any time, day or night.',
  hold: 'If things get worse before your visit, call or text 988 any time, day or night.',
  cost: "If cost is what's stopping you, 988 is free and open now.",
  book: "If cost is what's stopping you, 988 is free and open now.",
  prepare: "If you feel worse before your visit, call or text 988. Don't wait for the appointment.",
  visit: "If you feel worse before your visit, call or text 988. Don't wait for the appointment.",
  done: 'If you ever feel unsafe, call or text 988, day or night.',
};
const TIMES = { morning: 'Weekday mornings', afternoon: 'Weekday afternoons', evening: 'Weekday evenings', weekend: 'Saturdays', any: 'Any time' };
const PAY = { insurance: 'Insurance', selfpay: 'Pay myself', unsure: 'Not sure yet' };
const STATES = { TX: 'Texas', UT: 'Utah', CA: 'California', OK: 'Oklahoma', LA: 'Louisiana', NM: 'New Mexico', NY: 'New York', FL: 'Florida', OTHER: 'Somewhere else' };

// Where the prototype ends a path, it says so, in both views.
const stopHere = (txt) => `<p class="proto-stop" data-testid="proto-stop">${icon('info')}<span><strong>The prototype stops here.</strong> ${esc(txt)}</span></p>`;

// ---------- session ----------
function persona() { return S.persona; }
function answerFor(q) { return S.persona?.answers?.[q]; }
const planName = () => PLANS.find((p) => p.id === S.answers.plan)?.name || 'your plan';
const INSURERS = { ...Object.fromEntries(PLANS.map((p) => [p.id, p.name])), other: 'Another plan' };
const payPath = () => (S.answers.pay === 'insurance' ? 'insurance' : 'selfpay');
const docName = (c) => (c.creds === 'MD' ? `Dr. ${c.name.split(' ').at(-1)}` : c.name.split(' ')[0] + ' ' + c.name.split(' ').at(-1));

export function start(scenarioId = null, { clinicians = null } = {}) {
  const sc = SCENARIOS.find((x) => x.id === scenarioId) || null;
  const p = sc?.persona && MODE === 'reviewer' ? structuredClone(PERSONAS[sc.persona]) : null;
  if (p && sc.override) Object.assign(p.answers, sc.override);
  S = createSession({ persona: p, now: new Date() });
  Object.assign(S.flags, sc?.flags || {});
  if (clinicians) S.clinicians = structuredClone(clinicians);
  S.answers = {};
  S.onEvent = () => ui && ui.drawer && renderDrawer();
  ui = { thread: [], card: null, prev: null, drawer: ui?.drawer && false, tab: ui?.tab || 'screen', raw: false, panel: false,
    why: {}, multi: {}, scenario: sc, history: [], noteStart: 0, lastSetLen: 0, delta: ui ? ui.delta !== false : true, convo: false, lpNote: false, rec: null, avail: null, horizon: 14, prefs: {}, tasks: [], errors: {}, closed: false, saved: null };
  if (sc?.provider) return providerStart();
  emit(S, 'onboarding_started', { variant: S.variants['T-01'], persona: p?.id || null });
  setCard({ type: 'landing' });
}

// ---------- thread ----------
function ai(text, actions = '') { ui.thread.push({ role: 'ai', html: `<p>${esc(text)}</p>`, actions }); }
function aiHtml(html, actions = '') { ui.thread.push({ role: 'ai', html, actions }); }
function me(text) { ui.thread.push({ role: 'me', html: `<p>${esc(text)}</p>` }); }
function toolLine(r, text) {
  ui.thread.push({ role: 'tool', html: `${icon(r.ok ? 'check' : 'info')}<span>${esc(text)}</span>${badge(r.label)}<span class="src">${esc(r.source)}</span>` });
}
function run(tool, input, opts = {}) {
  const r = act(S, tool, input, opts);
  if (r.error !== 'needs_confirmation' && opts.reason) toolLine(r, opts.reason);
  return r;
}

// ---------- questions ----------
function setCard(card) {
  if (ui.card && QUESTION.has(ui.card.type) && QUESTION.has(card.type) && ui.card.type !== card.type) ui.history.push(ui.card);
  if (!QUESTION.has(card.type)) ui.history = [];
  ui.noteStart = ui.lastSetLen; ui.lastSetLen = ui.thread.length;
  ui.card = card; render();
}

function askStory() {
  S.stage = 'welcome';
  ai("I'm Legion's care navigator, an AI assistant. I'll ask one thing at a time and do the legwork, always with your OK. A clinician makes every clinical decision.");
  setCard({ type: 'story' });
}
function onStory(text) {
  text = text.trim();
  if (!text) { ui.errors.story = 'Tell me a little, even one line is enough.'; return render(); }
  ui.errors.story = null;
  me(text);
  const concerns = extractConcerns(text);
  S.concerns = concerns;
  S.memory.story = text;
  S.memory.topics = topicWords(concerns);
  emit(S, 'question_answered', { questionId: 'story', topics: concerns });
  const safe = evaluateSafety({ text });
  emit(S, 'safety_policy_evaluated', { outcome: safe.route ? 'route' : 'clear', ruleId: safe.ruleId, questionId: 'story' });
  if (safe.route) return routeCrisis(safe.ruleId, askSafety);
  ai("Thank you for telling me. I've kept it in your words, so you won't have to repeat it.");
  if (classifyClinical(text)) refuseClinical(text);
  askSafety();
}
function askSafety() { S.stage = 'understand'; setCard({ type: 'safety' }); }
function onSafety(v) {
  me({ no: 'No', yes: 'Yes', unsure: "I'd rather not say" }[v]);
  const r = evaluateSafety({ answer: v });
  emit(S, 'safety_policy_evaluated', { outcome: r.route ? 'route' : 'clear', ruleId: r.ruleId, questionId: 'safety' });
  if (r.route) return routeCrisis(r.ruleId, () => setCard({ type: 'state' }));
  if (v === 'unsure') ai("That's okay. If that changes, you can call or text 988 any time, or talk to a person here.");
  else ai('Thanks for answering. Two quick basics next.');
  setCard({ type: 'state' });
}
function onState(v) {
  me(STATES[v] || v); S.answers.state = v; S.memory.state = STATES[v] || v;
  emit(S, 'question_answered', { questionId: 'state' });
  if (v !== 'TX') return runFit();
  if (S.variants['T-01'] === 'control') return setCard({ type: 'oldentry' });
  setCard({ type: 'adult' });
}
function onAdult(v) {
  me(v === 'yes' ? 'Yes' : 'No'); S.answers.adult = v === 'yes'; S.memory.adult = v === 'yes' ? '18 or older' : 'Under 18';
  emit(S, 'question_answered', { questionId: 'adult' });
  runFit();
}

function runFit() {
  const r = run('check_service_fit', { state: S.answers.state, adult: S.answers.adult, concerns: S.concerns || ['unsure'], emergency: false },
    { reason: "Checked whether Legion can help, using Legion's published rules", observe: 'State, age and topics you gave' });
  S.fit = r.data;
  emit(S, 'fit_decided', { fit: r.data.fit, ruleId: r.data.ruleId });
  if (r.data.fit === 'yes') {
    S.stage = 'fit';
    ui.planShown = S.variants['T-16'] === 'variant';
    ai(`Legion can help with this. ${r.data.reason}`);
    if (ui.planShown) ai("I've started your plan. It shows what's done, what's next, and who does each part. It updates as we go.");
    return askSignin();
  }
  S.stage = 'fit';
  ai(r.data.reason);
  setCard({ type: 'notfit', rule: r.data.ruleId });
}

// ---------- sign-in (D-22, D-24): after fit, email and a code. Simulated: nothing is sent, the code is 123456. ----------
function askSignin() {
  S.stage = 'signin';
  ai("Next, your email, so everything you've told me is saved. I'll send a 6-digit code. No password.");
  setCard({ type: 'signin' });
}
function onSigninEmail(value) {
  const v = String(value || '').trim();
  const r = run('start_sign_in', { email: v }, { confirmed: true, reason: 'Sent you a sign-in code (simulated: nothing was sent)' });
  if (!r.ok) { ui.errors.signin = "That email doesn't look complete. Check for a typo."; return render(); }
  ui.errors.signin = null;
  me(v); S.memory.email = v;
  emit(S, 'sign_in_started', { result: r.data.returning ? 'returning' : 'new' });
  setCard({ type: 'code' });
}
function onCode(value) {
  const r = run('verify_sign_in_code', { code: value }, { reason: 'Checked your sign-in code' });
  if (!r.ok) { ui.errors.code = "That code doesn't match. Check it and try again."; emit(S, 'sign_in_failed', { error: 'wrong_code' }); return render(); }
  ui.errors.code = null;
  S.signedIn = true;
  emit(S, 'sign_in_verified', { result: r.data.returning ? 'returning' : 'new' });
  if (r.data.returning) return restoreReturning();
  ai("You're signed in. Your progress is saved from here.");
  askPay();
}
// E-14: a returning patient's saved payment and coverage check come back; nothing is asked again.
function restoreReturning() {
  // Restores what was saved last time. No new check runs and nothing is sent to the insurer.
  if (answerFor('pay') === 'selfpay') {
    S.answers.pay = 'selfpay'; S.memory.payLabel = PAY.selfpay; S.memory.cost = `$${SELF_PAY_PRICE} a visit (to be verified)`;
  } else {
    const plan = PLANS.find((x) => x.id === (answerFor('insurance') || 'lonestar'));
    S.answers.pay = 'insurance'; S.answers.plan = plan.id; S.coverage = 'checked';
    S.eligibility = { planId: plan.id, plan: plan.name, status: 'active', inNetwork: true, copay: plan.copay, basis: plan.basis, deductibleRemaining: 420, telehealth: true, priorAuth: false, memberLast4: String(answerFor('memberId') || '').replace(/\s/g, '').slice(-4) };
    S.memory.payLabel = 'Insurance'; S.memory.plan = plan.name; S.memory.cost = `About $${plan.copay} a visit (estimate)`;
  }
  note(S, 'Restored your saved payment choice and coverage check. Nothing new was sent', 'Verified');
  ai(`Welcome back${S.persona ? `, ${S.persona.name}` : ''}. I kept how you're paying and your coverage check from last time, so you don't need to enter them again.`);
  matchPath();
}

// ---------- payment and coverage (D-23): one insurance screen, checked inline ----------
function askPay() {
  S.stage = 'coverage';
  ui.payOptions = run('get_payment_options', { state: S.answers.state, preference: null }, { reason: 'Looked up payment options and prices' });
  setCard({ type: 'pay' });
}
function onPay(v) {
  me(PAY[v]); S.answers.pay = v === 'selfpay' ? 'selfpay' : 'insurance'; S.memory.payLabel = PAY[v];
  emit(S, 'question_answered', { questionId: 'pay', preference: v });
  if (v === 'selfpay') { S.memory.cost = `$${SELF_PAY_PRICE} a visit (to be verified)`; return matchPath(); }
  ui.ins = ui.ins || { planId: '', inName: true, method: 'typed' };
  setCard({ type: 'insurance' });
}
function readInsurance() {
  const v = (id) => $(`#${id}`)?.value ?? '';
  ui.ins = { ...ui.ins, planId: v('input-insurer') || ui.ins.planId, name: v('input-legal-name'), dob: v('input-dob'), memberId: v('input-member'),
    inName: $('#input-in-name') ? $('#input-in-name').checked : ui.ins.inName };
}
function checkInsurance() {
  if (!ui.ins.planId) ui.ins.planId = 'other';
  const ins = ui.ins; const label = INSURERS[ins.planId];
  ui.errors.insurance = null; ui.insNotFound = false;
  emit(S, 'insurance_entered', { method: ins.method, category: ins.planId });
  const r = run('check_insurance_eligibility', { planId: ins.planId, memberId: ins.memberId, name: ins.name, dob: ins.dob },
    { confirmed: true, reason: `Checked your coverage with ${label}`, observe: 'Insurer, name, birth date and member ID you entered' });
  let res = r;
  if (!res.ok && res.error === 'no_response') res = run('check_insurance_eligibility', { planId: ins.planId, memberId: ins.memberId, name: ins.name, dob: ins.dob }, { confirmed: true, reason: `Tried ${label} again` });
  const result = !res.ok ? res.error : res.data.status !== 'active' ? res.data.status : !res.data.inNetwork ? 'out_of_network' : res.data.carveOut ? 'carve_out' : 'active';
  emit(S, 'eligibility_checked', { result, category: ins.planId });
  S.answers.pay = 'insurance'; S.answers.plan = ins.planId; S.memory.plan = label;
  if (result === 'name_mismatch') { ui.errors.insurance = 'Use your full legal name as it appears on the plan, no nicknames.'; return render(); }
  if (result === 'not_found') {
    ui.insNotFound = true;
    ui.errors.insurance = "We couldn't find a plan with those details. Check your member ID, and your name and birth date exactly as they appear on your card.";
    return render();
  }
  if (result === 'no_response') { emit(S, 'recovery_path_taken', { path: 'coverage_unknown' }); return setCard({ type: 'coverage-unknown' }); }
  if (result === 'inactive') { emit(S, 'recovery_path_taken', { path: 'plan_inactive' }); return setCard({ type: 'inactive' }); }
  if (result === 'out_of_network') { emit(S, 'recovery_path_taken', { path: 'out_of_network' }); return setCard({ type: 'oon' }); }
  S.eligibility = res.data; S.coverage = 'checked'; S.memory.payLabel = 'Insurance';
  S.memory.cost = res.data.copay != null ? `About $${res.data.copay} a visit (estimate)` : 'Copay still being checked';
  matchPath();
}
function skipCoverage(path) {
  S.answers.pay = 'insurance'; S.answers.plan = ui.ins?.planId && ui.ins.planId !== 'other' ? ui.ins.planId : null;
  S.memory.payLabel = 'Insurance'; S.memory.plan = S.answers.plan ? planName() : undefined;
  S.coverage = path === 'skip_check' ? 'unknown' : 'pending';
  S.memory.cost = path === 'skip_check' ? 'Coverage not checked yet' : 'Coverage to be confirmed before any charge';
  emit(S, 'recovery_path_taken', { path });
  note(S, path === 'skip_check' ? 'You skipped the coverage check. Nothing was sent to your insurer.' : 'Legion will confirm your coverage before anything is charged', path === 'skip_check' ? null : 'Simulated');
  matchPath();
}

// ---------- matches now, or a closer match first ----------
function matchPath() {
  S.stage = 'options';
  setCard({ type: 'matchpath' });
}
function matchesNow() {
  emit(S, 'match_path_chosen', { path: 'now' });
  S.answers.times = ['any']; S.memory.timesLabel = TIMES.any;
  ui.personalize = false;
  search(); recommend();
}
function personalize() {
  emit(S, 'match_path_chosen', { path: 'personalize' });
  ui.personalize = true;
  setCard({ type: 'times' });
}
function onTimes(list, again = false) {
  if (!list.length) { ui.errors.times = 'Pick at least one, or "Any time".'; return render(); }
  ui.errors.times = null;
  S.answers.times = list; S.memory.timesLabel = list.map((t) => TIMES[t]).join(', ');
  me(S.memory.timesLabel);
  emit(S, 'question_answered', { questionId: again ? 'times_again' : 'times', windows: list });
  if (again) { search(); return recommend(); }
  if (ui.personalize) { ui.prefStep = 0; ui.prefs = {}; return setCard({ type: 'prefs' }); }
  search(); recommend();
}

// ---------- options and recommendation ----------
function search(horizonDays = ui.horizon) {
  ui.avail = run('search_provider_availability', { payPath: payPath(), planId: S.answers.plan, windows: S.answers.times, concerns: S.concerns, horizonDays },
    { reason: `Searched openings for ${S.memory.timesLabel.toLowerCase()} in the next ${horizonDays} days` });
}
function recommend() {
  S.stage = 'recommend';
  if (!ui.avail?.ok) return noSlot();
  const r = run('recommend_provider', { slots: ui.avail.data.slots, concerns: S.concerns, prefs: ui.prefs, payPath: payPath(), planId: S.answers.plan },
    { reason: 'Ranked clinicians on what you told me, how you pay, and your times' });
  ui.rec = r.data; ui.showAlts = false;
  emit(S, 'recommendation_shown', { variant: S.variants['T-09'], count: 1 + (r.data?.alternatives?.length || 0) });
  ai(S.variants['T-09'] === 'variant' ? "Here's who I'd suggest, and why. You can see other options or ask for a closer match." : 'Available providers:');
  setCard({ type: 'recommend' });
}
function noSlot() {
  emit(S, 'recovery_path_taken', { path: 'no_slot', variant: S.variants['T-10'] });
  if (S.variants['T-10'] === 'control') { ai('All providers are unavailable. Please call (512) 555-0100 to schedule.'); return setCard({ type: 'noslot-control' }); }
  const where = S.answers.pay === 'insurance' ? `in ${planName()}` : 'for self-pay';
  ai(`No clinician ${where} has an opening in the next ${ui.horizon} days. Here are other ways to get seen.`);
  setCard({ type: 'noslot' });
}

const PREF_Q = [
  { key: 'gender', title: 'Would you like to see a clinician of a particular gender?', opts: { woman: 'A woman', man: 'A man', nonbinary: 'A nonbinary clinician', any: 'No preference' } },
  { key: 'language', title: 'Which language would you like your visits in?', opts: { English: 'English', Spanish: 'Spanish', Korean: 'Korean', Urdu: 'Urdu' } },
  { key: 'style', title: 'What kind of style suits you?', opts: { gentle: 'Gentle, go at my pace', direct: 'Direct and practical', any: 'No preference' } },
  { key: 'affirming', title: 'Is LGBTQ+ affirming care important to you?', opts: { yes: 'Yes', no: 'No preference' } },
];
function onPref(key, v) {
  const q = PREF_Q[ui.prefStep];
  if (v !== null) { ui.prefs[key] = key === 'affirming' ? v === 'yes' : v; me(q.opts[v]); } else me('Skip');
  ui.prefStep += 1;
  if (ui.prefStep < PREF_Q.length) return render();
  S.memory.prefs = Object.entries(ui.prefs).filter(([, x]) => x && x !== 'any').map(([k, x]) => (k === 'affirming' ? 'LGBTQ+ affirming' : String(x))).join(', ') || 'No preferences';
  emit(S, 'question_answered', { questionId: 'prefs', count: Object.keys(ui.prefs).length });
  if (ui.personalize) search();
  recommend();
}

// ---------- hold, save, cost, book ----------
function chooseSlot(clinicianId, slotId) {
  const sl = ui.avail.data.slots.find((x) => x.id === slotId);
  ui.pending = { clinician: clinicianById(S, clinicianId), slot: sl };
  S.stage = 'hold';
  emit(S, 'alternative_chosen', { rank: ui.rec?.primary?.slot?.id === slotId ? 0 : 1 });
  setCard({ type: 'confirm', action: 'hold', title: `Hold ${fmtSlot(sl.start)} with ${ui.pending.clinician.name}?`,
    body: "I'll keep this time for you while you finish. Nothing is booked or charged yet.", yes: 'Hold this time', no: 'Not yet', onYes: 'hold', onNo: 'backToRec' });
}
function doHold() {
  const { clinician, slot } = ui.pending;
  const r = run('hold_appointment', { slotId: slot.id }, { confirmed: true, reason: `Held ${fmtSlot(slot.start)} with ${clinician.name}` });
  if (!r.ok) {
    const next = ui.avail.data.slots.find((x) => x.clinicianId === clinician.id && !S.taken.includes(x.id));
    emit(S, 'recovery_path_taken', { path: 'slot_taken' });
    if (next) {
      ai(`I'm sorry, someone else just took that time. ${clinician.name} also has ${fmtSlot(next.start)}. Want me to hold that instead?`);
      return chooseSlot(clinician.id, next.id);
    }
    ai("I'm sorry, someone else just took that time. Here are the other options.");
    return recommend();
  }
  S.hold = { clinicianId: clinician.id, slot, holdId: r.data.holdId };
  S.memory.appointment = `${fmtSlot(slot.start)} with ${clinician.name} (held)`;
  ai(`Done. I'm holding ${fmtSlot(slot.start)} with ${clinician.name}. Nothing is booked or charged yet.`);
  if (S.memory.email) return cost();
  setCard({ type: 'email' });
}
// The cost for the held visit comes from the coverage check the patient already agreed to (D-23). Nothing new is sent.
function cost() {
  S.stage = 'cost';
  if (payPath() === 'selfpay') return setCard({ type: 'selfpay' });
  if (S.coverage === 'pending') { S.cost = { pending: true }; return book(); }
  if (S.coverage === 'unknown' || !S.eligibility) return setCard({ type: 'coverage-unknown' });
  const r = run('estimate_patient_cost', { eligibility: S.eligibility }, { reason: `Worked out your cost for this visit from your ${planName()} check` });
  if (!r.ok) return setCard({ type: 'coverage-unknown' });
  if (r.data.pending) {
    S.cost = { pending: true, label: 'To be verified' };
    ai(`Your copay is still being checked with ${r.data.carveOut || 'your plan'}. Nothing is charged until it's confirmed.`);
    return book();
  }
  S.cost = { amount: r.data.estimate, label: 'Estimate', basis: r.data.basis };
  aiHtml(`<p>Your visit should cost you about <strong>$${r.data.estimate}</strong>, your plan's ${esc(r.data.basis)}. ${badge('Estimate')} ${badge('Simulated')}</p><p class="muted">Your plan makes the final call after the visit. Nothing is charged today.</p>`);
  book();
}
function switchToSelfPay() {
  S.answers.pay = 'selfpay'; S.memory.payLabel = 'Pay myself'; S.memory.plan = undefined;
  emit(S, 'recovery_path_taken', { path: 'switch_selfpay' });
  S.memory.cost = `$${SELF_PAY_PRICE} a visit (to be verified)`; S.coverage = null; S.eligibility = null;
  ai(`Switched to self-pay. It's $${SELF_PAY_PRICE} a visit, a price Legion still has to confirm.`);
  if (stageIndex(S.stage) < stageIndex('options')) return matchPath();
  if (stageIndex(S.stage) <= stageIndex('recommend') || !S.hold) { ui.horizon = 14; search(); return recommend(); }
  cost();
}
function book() {
  S.stage = 'book';
  setCard({ type: 'confirm', action: 'book', summary: true, title: 'Book this visit?', body: '', yes: 'Book this visit', no: 'Not yet', onYes: 'doBook', onNo: 'backToCost' });
}
function doBook() {
  const c = clinicianById(S, S.hold.clinicianId);
  const r = run('book_appointment', { holdId: S.hold.holdId, slot: S.hold.slot, clinicianId: c.id, payPath: payPath() }, { confirmed: true, reason: `Booked ${fmtSlot(S.hold.slot.start)} with ${c.name}` });
  S.booking = { id: r.data.id, slot: S.hold.slot, clinician: c };
  S.memory.appointment = `${fmtSlot(S.hold.slot.start)} with ${c.name} (booked)`;
  emit(S, 'booking_confirmed', { payPath: payPath() });
  ai(`You're booked with ${c.name}.`);
  if (payPath() === 'selfpay') return setCard({ type: 'payment' });
  prepare();
}
function choosePayment(method) {
  ui.pendingMethod = method;
  const free = S.variants['T-15'] === 'variant';
  setCard({ type: 'confirm', action: 'pay', title: `Save ${method} to pay after your visit?`,
    body: free ? `Nothing is charged today. Your first 5 minutes are free. If you continue, the visit is $${SELF_PAY_PRICE}, charged after the call.` : `Nothing is charged today. The visit is $${SELF_PAY_PRICE}, charged after the call.`,
    yes: 'Save it', no: 'Choose another way', onYes: 'savePayment', onNo: 'backToPayment' });
}
function savePayment() {
  run('save_payment_method', { method: ui.pendingMethod }, { confirmed: true, reason: `Saved ${ui.pendingMethod} for after the visit. $0 charged today` });
  S.memory.payment = `${ui.pendingMethod}, nothing charged yet`;
  prepare();
}

// ---------- prepare and visit ----------
function prepare() {
  S.stage = 'prepare';
  ui.planShown = true;
  const r = run('check_previsit_requirements', { payPath: payPath() }, { reason: 'Checked what you need before your visit' });
  ui.tasks = r.data.tasks.map((t) => ({ ...t, done: t.id === 'reminders' }));
  note(S, 'Set reminders for 24 hours and 1 hour before your visit', 'Simulated');
  ai("A few things before your visit. I've already set your reminders.");
  setCard({ type: 'prepare' });
}
function markTask(id, text) {
  const t = ui.tasks.find((x) => x.id === id);
  t.done = true;
  emit(S, 'previsit_task_done', { task: id });
  if (text) ai(text);
  setCard({ type: 'prepare' });
}
function startTask(id) {
  const c = clinicianById(S, S.hold.clinicianId);
  if (id === 'summary') {
    const r = run('prepare_intake_summary', {}, { reason: 'Drafted your intake summary from your own words' });
    ui.summary = r.data;
    return setCard({ type: 'confirm', action: 'share_summary', isSummary: true, title: `Share this summary with ${c.name}?`, body: '', yes: `Share with ${c.name}`, no: 'Not yet', onYes: 'shareSummary', onNo: 'backToPrepare' });
  }
  if (id === 'consent') return setCard({ type: 'confirm', action: 'consent', title: 'Agree to treatment and telehealth care?',
    body: 'Legion clinicians treat you by secure video. You can stop care at any time. Your information is private and only shared as the law allows. (Sample consent text for the prototype.)', yes: 'I agree', no: 'I have questions', onYes: 'giveConsent', onNo: 'human' });
  if (id === 'records') return setCard({ type: 'records' });
  if (id === 'card') return setCard({ type: 'inscard' });
  if (id === 'device') return setCard({ type: 'device' });
}
function visit() { S.stage = 'visit'; setCard({ type: 'visit', phase: 'before' }); }
function endVisit() {
  const c = S.booking.clinician;
  note(S, `${c.name} confirmed your first visit is complete`, 'Simulated');
  const r = run('mark_first_visit_complete', { bookingId: S.booking.id, clinicianConfirmed: true }, { reason: 'Recorded your first visit as completed' });
  emit(S, 'visit_completed', { daysSinceStart: r.data.daysSinceStart });
  S.stage = 'done';
  ui.daysSinceStart = r.data.daysSinceStart;
  ai('Your first visit is done.');
  setCard({ type: 'done' });
}

// ---------- safety, clinical, human ----------
// Returns true when the input was handled by a policy.
function policyCheck(text, after) {
  const s = evaluateSafety({ text });
  emit(S, 'safety_policy_evaluated', { outcome: s.route ? 'route' : 'clear', ruleId: s.ruleId });
  if (s.route) { routeCrisis(s.ruleId, after); return true; }
  if (classifyClinical(text)) { refuseClinical(text); render(); return true; }
  return false;
}
function refuseClinical(text) {
  emit(S, 'clinical_question_refused', { category: classifyClinical(text) });
  ai(CLINICAL_REFUSAL, `${btn('Add it to my summary', { id: 'btn-add-question', action: 'addQuestion', data: { q: text } })} ${btn('No thanks', { id: 'btn-no-thanks', action: 'noThanks' })}`);
}
function routeCrisis(ruleId, after) {
  ui.prev = ui.card; ui.afterCrisis = after;
  emit(S, 'safety_route_fired', { ruleId, stage: S.stage });
  note(S, `Safety policy rule ${ruleId} showed 988 and started same-day clinician contact. The AI did not make this decision.`, 'Simulated');
  setCard({ type: 'crisis' });
}
function keepGoing() {
  ai("Okay. I'm here when you're ready. 988 stays at the top of the screen.");
  const fn = ui.afterCrisis; ui.afterCrisis = null;
  if (ui.prev && ui.prev.type !== 'crisis' && ui.prev.type !== 'story') { ui.card = ui.prev; return render(); }
  if (fn) return fn();
  render();
}
function askHuman() {
  if (ui.card?.type !== 'confirm' || ui.card.onYes !== 'sendHuman') ui.prev = ui.card;
  setCard({ type: 'confirm', action: 'send', title: 'Talk to a person?', body: "I'll send your notes to Legion's care team so you don't have to repeat yourself. They usually reply within 1 business hour (estimate). Your progress here stays put.",
    yes: 'Send to the care team', no: 'Not now', onYes: 'sendHuman', onNo: 'back' });
}
function composer(text) {
  text = text.trim();
  if (!text) return;
  if (ui.card?.type === 'story') return onStory(text);
  me(text); ui.thread.at(-1).typed = true;
  if (policyCheck(text, null)) return;
  if (/\b(person|human|someone real|real person|call me)\b/i.test(text)) return askHuman();
  S.memory.notes = [...(S.memory.notes || []), text];
  ai("Thanks. I've added that to your notes for your clinician.");
  render();
}

// ---------- provider side (E-12) ----------
function providerStart() {
  S.stage = 'recommend';
  const r = clinicianById(S, 'ruiz');
  ui.provider = { focus: { ...r.focus }, windows: [...r.windows] };
  ai('This is the provider side. Elena Ruiz, a psychiatric nurse practitioner, is updating what she treats and when she sees patients. Matching uses this profile once a clinical lead approves it.');
  setCard({ type: 'provider' });
}

// ---------- confirm handlers ----------
const ON = {
  hold: doHold,
  backToRec: () => { decline(S, 'hold'); S.stage = 'recommend'; setCard({ type: 'recommend' }); },
  backToCost: () => { decline(S, ui.card.action); cost(); },
  doBook,
  savePayment,
  backToPayment: () => { decline(S, 'pay'); setCard({ type: 'payment' }); },
  shareSummary: () => { run('complete_previsit_task', { task: 'summary' }, { confirmed: true, reason: `Shared your summary with ${S.booking.clinician.name}` }); markTask('summary', 'Shared. Your clinician will read it before your visit.'); },
  giveConsent: () => { run('complete_previsit_task', { task: 'consent' }, { confirmed: true, reason: 'Recorded your consent to treatment' }); markTask('consent'); },
  giveRecords: () => { run('complete_previsit_task', { task: 'records' }, { confirmed: true, reason: 'Asked your past clinician for records' }); markTask('records'); },
  backToPrepare: () => { decline(S, ui.card.action); setCard({ type: 'prepare' }); },
  sendHuman: () => {
    const r = run('request_human_support', { reason: 'patient_request' }, { confirmed: true, reason: 'Sent your notes to the care team' });
    emit(S, 'human_requested', { stage: S.stage });
    aiHtml(`<p>Sent. Your ticket is ${esc(r.data.ticket)}. Someone from the care team will reply ${esc(r.data.replyWithin)} ${badge('Estimate')}. You can keep going here in the meantime.</p>${stopHere("The care team's side isn't built, so no one will reply.")}`);
    ON.back(true);
  },
  sendKit: () => {
    const r = run('save_patient_progress', { email: ui.kit.email, purpose: 'keep_in_touch' }, { confirmed: true, reason: 'Saved your request to hear from Legion later' });
    if (!r.ok) { ui.errors.kit = 'That email didn\'t work. Use an @example.com address in this demo.'; return setCard({ type: 'notfit', rule: S.fit.ruleId }); }
    emit(S, 'kept_for_later', { reasonCategory: S.fit.ruleId, channel: ui.kit.sms ? 'email_sms' : 'email' });
    ai("Done. We'll write once, when Legion can help, and you can stop it any time. Until then, the places above can help now.");
    setCard({ type: 'kept' });
  },
  sendStory: () => {
    run('save_patient_progress', { email: ui.kit.email, purpose: 'summary' }, { confirmed: true, reason: 'Emailed you what you told me' });
    ai('Sent. Share it with any clinician you see, so you don\'t have to start over.');
    setCard({ type: 'notfit', rule: S.fit.ruleId });
  },
  back: (sent) => { if (sent !== true) decline(S, 'send'); ui.card = ui.prev || ui.card; ui.prev = null; render(); },
  human: () => askHuman(),
};

// ---------- event delegation ----------
const ACTIONS = {
  persona: (d) => applyPersona(d.q),
  answer: (d) => ({ safety: onSafety, state: onState, adult: onAdult, pay: onPay }[d.q])(d.v),
  pref: (d) => onPref(d.k, d.v === '__skip' ? null : d.v),
  toggle: (d) => { const set = new Set(ui.multi[d.q] || []); if (d.v === 'any') set.clear(); else set.delete('any'); set.has(d.v) ? set.delete(d.v) : set.add(d.v); ui.multi[d.q] = [...set]; render(); },
  starter: (d) => { const el = $('#input-story'); el.value = (el.value ? el.value.trim() + ' ' : '') + d.v; el.focus(); },
  submitStory: () => onStory(S.variants['T-06'] === 'control' ? (ui.multi.chips || []).join(', ') : $('#input-story').value),
  submitTimes: (d) => onTimes(ui.multi[d.q] || [], d.q === 'times2'),
  why: (d) => {
    if (!ui.why[d.q]) { const r = act(S, 'explain_question', { questionId: d.q }, { reason: 'Explained why we ask' }); ui.why[d.q] = r.data; emit(S, 'question_explained', { questionId: d.q }); }
    else ui.why[d.q] = null;
    render();
  },
  matchesNow: () => matchesNow(),
  personalize: () => personalize(),
  submitSignin: () => onSigninEmail($('#input-email').value),
  submitCode: () => onCode($('#input-code').value),
  newCode: () => { ui.errors.code = null; note(S, 'Sent a new code (simulated: nothing was sent)'); render(); $('#input-code')?.focus(); },
  submitInsurance: () => { readInsurance(); ui.checking = true; render(); setTimeout(() => { ui.checking = false; checkInsurance(); }, 600); },
  scanCard: () => { readInsurance(); const id = answerFor('insurance') || ui.ins.planId || 'lonestar'; ui.ins = { ...ui.ins, planId: id, memberId: answerFor('memberId') || 'LSH 2041 0093', method: 'scan' }; note(S, 'Read the insurer and member ID from the sample card (demo)', 'Simulated'); render(); },
  inName: () => { readInsurance(); render(); },
  skipInsurance: () => { readInsurance(); skipCoverage('skip_check'); },
  verifyLater: () => { readInsurance(); skipCoverage('verify_by_hand'); },
  updatePlan: () => { ui.errors.insurance = null; delete S.flags.eligibility; delete S.flags.coverageTimeout; S.stage = 'coverage'; ui.ins = { ...(ui.ins || {}), planId: '' }; setCard({ type: 'insurance' }); ui.history = [{ type: 'pay' }]; render(); },
  coverageDetails: () => { ui.covOpen = !ui.covOpen; render(); },
  oonWaitlist: () => { note(S, 'Saved your request to hear when Legion takes your plan', 'Simulated'); emit(S, 'kept_for_later', { reasonCategory: 'out_of_network', channel: 'email' }); ai("I'll let you know when Legion is in network with your plan. You can still see clinicians now with self-pay."); render(); },
  begin: (d) => {
    emit(S, 'entry_clicked', { channel: d.cta?.startsWith('btn-book-clin') ? 'book_with_clinician' : d.cta, variant: S.variants['T-01'] });
    S.stage = 'welcome';
    if (S.variants['T-01'] === 'control') return setCard({ type: 'state' });
    askStory();
    if (d.clin) {
      const c = clinicianById(S, d.clin);
      const theyre = { man: "he's", nonbinary: "they're" }[c.gender] || "she's";
      S.memory.askedAbout = c.name;
      ai(`You picked ${c.name}. I'll check whether ${theyre} a good fit and has times that work for you.`);
      render();
    }
  },
  otherState: () => setCard({ type: 'otherstate' }),
  submitOtherState: () => onState($('#input-otherstate').value),
  back: () => { let prev = ui.history.pop(); while (prev && S.signedIn && ['signin', 'code'].includes(prev.type)) prev = ui.history.pop(); if (prev) { ui.card = prev; ui.noteStart = ui.thread.length; render(); } },
  toggleDelta: () => { ui.delta = !ui.delta; render(); },
  chooseMode: (d) => { MODE = d.m; saveMode(MODE); emit(S, 'view_chosen', { variant: MODE }); start(MODE === 'reviewer' ? 'E-1' : null); },
  switchMode: () => { MODE = MODE === 'patient' ? 'reviewer' : 'patient'; saveMode(MODE); if (MODE === 'patient') { ui.drawer = false; } else { ui.delta = true; } render(); },
  lpNote: () => { ui.lpNote = !ui.lpNote; render(); },
  convo: () => { ui.convo = !ui.convo; $('#convo').hidden = !ui.convo; if (ui.convo) $('#convo-title')?.focus(); },
  hold: (d) => chooseSlot(d.c, d.s),
  otherTimes: () => { ui.multi.times2 = []; setCard({ type: 'times2' }); },
  alts: () => { ui.showAlts = !ui.showAlts; render(); },
  closer: () => { ui.prefStep = 0; ui.prefs = {}; setCard({ type: 'prefs' }); },
  widen: () => { ui.horizon = 30; ai('Looking further out, at the next 30 days.'); search(30); recommend(); },
  waitlist: () => { note(S, 'Added you to the waitlist. The first opening will be held for you to confirm', 'Simulated'); emit(S, 'recovery_path_taken', { path: 'waitlist' });
    ai("You're on the waitlist. When a time opens, I'll hold it and text you to confirm. Nothing is booked until you say yes."); setCard({ type: 'waitlisted' }); },
  selfpaySwitch: () => switchToSelfPay(),
  human: () => askHuman(),
  confirmYes: () => ON[ui.card.onYes](),
  confirmNo: () => ON[ui.card.onNo](),
  bookPending: () => { if (!S.hold) { ai("Okay. You can choose a clinician now. Legion will confirm your coverage before anything is charged."); return skipCoverage('verify_by_hand'); }
    S.cost = { pending: true }; S.memory.cost = 'Coverage to be confirmed before any charge';
    ai("Okay. I'll book it, and Legion will confirm your coverage before anything is charged. If you're not covered, nothing is charged and you choose what to do next."); book(); },
  continueSelfPay: () => { S.cost = { amount: SELF_PAY_PRICE, label: 'To be verified' }; book(); },
  wallet: (d) => choosePayment(d.m),
  submitCard: () => { const v = $('#input-card').value.replace(/\s/g, ''); if (v !== '4242424242424242') { ui.errors.card = 'This is a demo. Use the test card 4242 4242 4242 4242.'; return render(); } ui.errors.card = null; choosePayment('test card ending 4242'); },
  task: (d) => startTask(d.t),
  skipRecords: () => { const t = ui.tasks.find((x) => x.id === 'records'); t.done = true; t.skipped = true; emit(S, 'previsit_task_done', { task: 'records', result: 'skipped' }); ai('Skipped. Your clinician can see you without them.'); setCard({ type: 'prepare' }); },
  allowRecords: () => setCard({ type: 'confirm', action: 'records', title: 'Let Legion request your past records?', body: 'We\'d ask your previous clinician for notes and medication history. Only your Legion clinician sees them.', yes: 'Allow', no: 'Not now', onYes: 'giveRecords', onNo: 'backToPrepare' }),
  cardPhoto: () => { run('complete_previsit_task', { task: 'card' }, { reason: 'Added the sample insurance card photo' }); markTask('card'); },
  deviceCheck: () => { run('complete_previsit_task', { task: 'device' }, { reason: 'Checked your camera and microphone' }); markTask('device', 'Your camera and microphone work.'); },
  editSummary: () => { ui.editingSummary = !ui.editingSummary; render(); },
  saveSummary: () => { const v = $('#input-summary').value; if (policyCheck(v, null)) return; ui.summary.text = v; S.memory.summaryEdited = true; emit(S, 'memory_edited', { field: 'summary' }); ui.editingSummary = false; render(); },
  ready: () => visit(),
  join: () => { const free = payPath() === 'selfpay' && S.variants['T-15'] === 'variant'; emit(S, 'visit_joined', {}); setCard({ type: 'visit', phase: free ? 'minute5' : 'call' }); },
  continueVisit: () => { emit(S, 'self_pay_continued', { result: 'continued' }); setCard({ type: 'visit', phase: 'call' }); },
  stopVisit: () => { emit(S, 'self_pay_continued', { result: 'ended' }); ai('The visit ended at no charge. If you want to try another clinician, I can help.'); S.stage = 'recommend'; recommend(); },
  endVisit: () => endVisit(),
  addQuestion: (d, el) => { S.memory.questions = [...new Set([...(S.memory.questions || []), d.q])]; markThreadDone(el); ai("Added. Your clinician will see it in your summary."); render(); },
  noThanks: (d, el) => { markThreadDone(el); render(); },
  submitKit: () => {
    const email = $('#input-kit-email').value.trim(); const consent = $('#kit-consent').checked; const sms = $('#kit-sms')?.checked;
    if (!consent) { ui.errors.kit = 'Tick the box so we know you want to hear from us.'; return render(); }
    ui.kit = { email, sms }; ui.errors.kit = null;
    setCard({ type: 'confirm', action: 'send', title: `Save ${email} to hear from Legion later?`, body: 'One message when Legion can help. You can stop it any time.', yes: 'Save it', no: 'Not now', onYes: 'sendKit', onNo: 'back' });
  },
  emailStory: () => { const email = $('#input-kit-email').value.trim(); if (!email) { ui.errors.kit = 'Add an email first.'; return render(); }
    ui.kit = { email }; ui.prev = ui.card;
    setCard({ type: 'confirm', action: 'send', title: `Email what you told me to ${email}?`, body: 'Only your own words and the topics you mentioned.', yes: 'Send it', no: 'Not now', onYes: 'sendStory', onNo: 'back' }); },
  keepGoing: () => keepGoing(),
  composerSend: () => { const el = $('#composer'); const v = el.value; el.value = ''; composer(v); },
  editMemory: (d) => { ui.editing = d.k; render(); $('#mem-input')?.focus(); },
  saveMemory: (d) => { const v = $('#mem-input').value.trim(); if (d.k === 'story' && v) { if (policyCheck(v, null)) { ui.editing = null; return; } S.memory.story = v; S.concerns = extractConcerns(v); S.memory.topics = topicWords(S.concerns); }
    emit(S, 'memory_edited', { field: d.k }); ui.editing = null; ai('Updated. I\'ll use the new version from here on.'); render(); },
  changeTimes: () => { ui.multi.times2 = []; if (stageIndex(S.stage) <= stageIndex('recommend') && S.answers.times) { ui.panel = false; setCard({ type: 'times2' }); } },
  // drawer and panels
  toggleDrawer: () => toggleDrawer(),
  tab: (d) => { ui.tab = d.t; renderDrawer(); },
  flip: (d) => { S.variants[d.t] = S.variants[d.t] === 'variant' ? 'control' : 'variant'; emit(S, 'variant_flipped', { test: d.t, variant: S.variants[d.t] }); if (d.t === 'T-16' && stageIndex(S.stage) < stageIndex('prepare')) ui.planShown = S.variants['T-16'] === 'variant' && stageIndex(S.stage) >= stageIndex('fit'); if (['T-01', 'T-06'].includes(d.t) && stageIndex(S.stage) <= stageIndex('welcome')) return start(ui.scenario?.id); render(); },
  rawToggle: () => { ui.raw = !ui.raw; renderDrawer(); },
  scenario: (d) => { const keepDrawer = window.innerWidth >= 1280; start(d.s); ui.drawer = keepDrawer; render(); },
  restart: () => start(ui.scenario?.id || null),
  interrupt: () => interrupt(),
  resume: () => resume(),
  jump: (d) => autoplayTo(d.s),
  panel: () => { ui.panel = !ui.panel; render(); if (ui.panel) $('#btn-close-panel')?.focus(); },
  closePanel: () => { ui.panel = false; render(); },
  // provider (E-12)
  profileSample: () => { ui.provider.focus = { anxiety: 3, stress: 2, sleep: 3 }; ui.provider.windows = ['afternoon', 'evening']; render(); },
  focusLevel: () => {},
  submitProfile: () => { readProviderForm(); ai('Saved. A clinical lead checks every profile before matching uses it, so it reflects what the clinician actually does.'); setCard({ type: 'calibrate' }); },
  calibrate: () => { const c = clinicianById(S, 'ruiz'); c.focus = { ...ui.provider.focus }; c.windows = [...ui.provider.windows]; c.profileUpdated = true;
    note(S, "A clinical lead approved Elena Ruiz's updated profile", 'Simulated'); ai('Approved. Matching now uses the updated profile.'); setCard({ type: 'calibrated' }); },
  runMaya: () => { const cl = S.clinicians; start('E-1', { clinicians: cl }); ui.scenario = { ...ui.scenario, id: 'E-12', title: 'A provider profile changes the match' }; autoplayTo('recommend'); },
};
function markThreadDone(el) { const i = Number(el.closest('.msg')?.dataset.i); if (ui.thread[i]) ui.thread[i].actions = ''; }
function readProviderForm() {
  document.querySelectorAll('[data-focus]').forEach((sel) => { const v = Number(sel.value); if (v) ui.provider.focus[sel.dataset.focus] = v; else delete ui.provider.focus[sel.dataset.focus]; });
  ui.provider.windows = [...document.querySelectorAll('[data-window]:checked')].map((x) => x.dataset.window);
}

function applyPersona(q) {
  const a = answerFor(q);
  if (q === 'story') { if (S.variants['T-06'] === 'control') ui.multi.chips = ['Generalized anxiety disorder', 'Insomnia disorder']; else { const el = $('#input-story'); if (el) el.value = a; } return ACTIONS.submitStory(); }
  if (q === 'times' || q === 'times2') { ui.multi[q] = q === 'times2' ? ['evening'] : a; return onTimes(ui.multi[q], q === 'times2'); }
  if (q === 'signin') return onSigninEmail(a);
  if (q === 'code') return onCode(a);
  if (q === 'insurance') { ui.ins = { ...ui.ins, planId: a, name: answerFor('legalName'), dob: answerFor('dob'), memberId: answerFor('memberId'), inName: true, method: 'typed' }; return checkInsurance(); }
  return ACTIONS.answer({ q, v: a });
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const fn = ACTIONS[el.dataset.action];
  if (fn) { e.preventDefault(); fn(el.dataset, el); }
});
// Keep the chosen insurer in state, so a redraw (and the consent line) uses it.
document.addEventListener('change', (e) => { if (e.target.id === 'input-insurer' && ui?.ins) { ui.ins.planId = e.target.value; const keep = { name: $('#input-legal-name')?.value, dob: $('#input-dob')?.value, memberId: $('#input-member')?.value }; Object.assign(ui.ins, keep); render(); } });
document.addEventListener('keydown', (e) => {
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
  if (e.key === 'Escape' && ui?.drawer) { toggleDrawer(); return; }
  if (e.key === 'Escape' && ui?.panel) { ui.panel = false; render(); return; }
  if (MODE === 'reviewer' && !typing && (e.key === 'r' || e.key === 'R') && !e.metaKey && !e.ctrlKey) { toggleDrawer(); return; }
  if (e.key === 'Enter' && !e.shiftKey && document.activeElement?.id === 'composer') { e.preventDefault(); ACTIONS.composerSend(); }
  if (e.key === 'Enter' && document.activeElement?.id === 'input-email') { e.preventDefault(); ACTIONS.submitSignin(); }
  if (e.key === 'Enter' && document.activeElement?.id === 'input-code') { e.preventDefault(); ACTIONS.submitCode(); }
});

function toggleDrawer() {
  ui.drawer = !ui.drawer; render();
  if (ui.drawer) $('#drawer-title')?.focus(); else $('[data-testid="reviewer-toggle"]')?.focus();
}

// ---------- interrupt and resume (E-6) ----------
function interrupt() {
  const { onEvent, ...rest } = S;
  ui.saved = { S: structuredClone(rest), ui: structuredClone({ ...ui, saved: null }) };
  ui.closed = true;
  emit(S, 'session_interrupted', {});
  render();
}
function resume() {
  const saved = ui.saved;
  S = Object.assign(saved.S, { onEvent: () => ui.drawer && renderDrawer() });
  ui = saved.ui; ui.closed = false;
  emit(S, 'session_resumed', {});
  ai(`Welcome back${S.persona ? `, ${S.persona.name}` : ''}. Everything you told me is still here, and your time is still held.`);
  render();
}

// ---------- autoplay (reviewer jump and E-12) ----------
function autoplayTo(stage) {
  for (let i = 0; i < 60 && stageIndex(S.stage) < stageIndex(stage); i++) {
    const p = document.querySelector('[data-testid="persona-answer"]') || [...document.querySelectorAll('[data-primary]')].at(-1);
    if (!p) break;
    p.click();
  }
}

// ---------- views ----------
const DELTA = {
  landing: ['Changed', 'Same page and placements as app.legionhealth.com. Every button now opens the care navigator\'s first question instead of an account or a provider list (T-01). Specialist cards show the next opening instead of "No availability found" (FP-01).'],
  state: ['Moved', "Legion's first screen today. Now it comes after the patient has said what they need. Utah shows but is switched off in this prototype."],
  otherstate: ['Changed', 'Today this is a waitlist link and nothing else. Now: where to get help now, then keep in touch.'],
  oldentry: ['Today', 'Control arm of T-01: the account screen comes second, as it does on the live site.'],
  story: ['New', 'The first screen after Get started, with the answer box right on it. Replaces "Create your account", which comes second today. No diagnostic labels.'],
  safety: ['Moved earlier', 'Asked right after the first answer, in plain words. Every typed line is screened as well.'],
  adult: ['Reworded', 'Was a date of birth that defaulted to 1996. Now one yes or no.'],
  signin: ['Moved', 'Was "Create your account" at step 2, before anything else. Now it comes once the fit checks pass: one email field and a code, no password (D-22).'],
  code: ['New', 'A 6-digit code instead of a password. In the prototype it is always 123456 and nothing is sent.'],
  pay: ['Changed', 'Both paths side by side with their prices, neither as the default.'],
  insurance: ['Changed', 'Was a grid of insurer logos and no check. Now one screen with the consent stated, checked on one tap, before matching (D-23).'],
  matchpath: ['New', 'Coverage known up front, then the patient picks: three matches now or a closer match.'],
  inactive: ['New', 'Inactive coverage is explained, with self-pay as an equal way forward.'],
  oon: ['New', 'Out of network says so plainly and offers self-pay or a heads-up when Legion takes the plan.'],
  times: ['New', 'Part of the closer match: so the first time we suggest is one the patient can make.'],
  times2: ['New', 'One question, then a new search. Today there is no way to say "not that time".'],
  recommend: ['Changed', 'Was a long list under "Perfect match found", with no reasons.'],
  prefs: ['New', 'Optional and skippable, offered after the patient has seen matches.'],
  noslot: ['Changed', 'Was "All providers unavailable. Please call."'],
  'noslot-control': ['Today', 'Control arm of T-10.'],
  waitlisted: ['New', ''],
  'coverage-unknown': ['New', 'An honest recovery when coverage cannot be checked. No invented price.'],
  selfpay: ['Changed', 'Was $250 with no breakdown and no charge date.'],
  payment: ['Changed', 'Nothing charged today, wallets first. Was a manual card form.'],
  prepare: ['New', 'Today nothing happens between booking and the visit.'],
  records: ['New', ''], inscard: ['New', ''], device: ['New', ''],
  visit: ['New', 'Onboarding ends at the completed visit, not at booking.'],
  done: ['New', ''],
  crisis: ['New', 'Fired by the safety policy. Today a typed disclosure got no follow-up.'],
  notfit: ['Changed', 'Today: a waitlist link only. Now: why, where to get help now, and keep in touch with consent.'],
  kept: ['New', ''],
  confirm: ['New', 'The navigator asks before it acts.'],
  provider: ['New', 'Provider side (F-30, simulated).'], calibrate: ['New', ''], calibrated: ['New', ''],
};
function deltaTag(c) {
  const d = DELTA[c.type];
  if (MODE !== 'reviewer' || !ui.delta || !d) return '';
  const cls = { New: 'd-new', Changed: 'd-changed', Moved: 'd-moved', 'Moved earlier': 'd-moved', Reworded: 'd-changed', 'Same as today': 'd-same', Today: 'd-same' }[d[0]] || 'd-new';
  return `<p class="delta ${cls}"><span class="delta-k">${esc(d[0])}</span>${d[1] ? `<span>${esc(d[1])}</span>` : ''}</p>`;
}

function render() {
  if (!S) return;
  document.body.dataset.stage = S.stage;
  document.body.dataset.card = ui.card?.type || '';
  renderHeader();
  renderProgress();
  if (ui.closed) {
    $('#note').innerHTML = '';
    $('#card').innerHTML = `<section class="card" data-testid="card-resume"><h2 class="card-title" tabindex="-1">You closed the tab</h2><p class="card-body">In real life, the link in your email brings you back here. Nothing you told the navigator is lost.</p><div class="actions">${btn('Open the link from my email (demo)', { id: 'btn-resume', action: 'resume', primary: true })}</div></section>`;
    renderSide(); renderDrawer(); return;
  }
  renderThread();
  renderNote();
  const prevType = $('#card section')?.dataset.testid;
  // A redraw rebuilds the card from state; typed values that aren't in state yet are kept for the same card.
  const typed = {};
  $('#card').querySelectorAll('input[id]:not([type=checkbox]), textarea[id]').forEach((el) => { if (el.value) typed[el.id] = el.value; });
  $('#card').innerHTML = renderCard().replace(/(<section[^>]*>)/, (m) => m + deltaTag(ui.card));
  if (prevType && prevType === $('#card section')?.dataset.testid) {
    for (const [id, v] of Object.entries(typed)) { const el = document.getElementById(id); if (el && !el.value) el.value = v; }
  }
  const nowType = $('#card section')?.dataset.testid;
  if (prevType !== nowType) {
    $('#stage-wrap').scrollTop = 0;
    if (prevType && document.activeElement && (document.activeElement === document.body || $('#card').contains(document.activeElement) || !document.activeElement.isConnected)) $('#card .card-title')?.focus({ preventScroll: true });
  }
  $('#safety-line').innerHTML = `${icon('shield')}<span>${esc(SAFETY_LINE[S.stage] || SAFETY_LINE.welcome)}</span>`;
  renderSide();
  renderDrawer();
  const lastAi = [...ui.thread].reverse().find((m) => m.role === 'ai');
  if (lastAi && lastAi !== ui.announced) { ui.announced = lastAi; $('#live').textContent = lastAi.html.replace(/<[^>]+>/g, ' '); }
}

function renderHeader() {
  const sc = ui.scenario;
  document.body.dataset.mode = MODE || 'choose';
  const pill = $('#mode-pill');
  if (MODE === 'patient') {
    pill.hidden = false;
    pill.innerHTML = `<span><strong>Prototype</strong> · patient view</span><button type="button" class="link" data-action="switchMode" data-testid="switch-mode">Switch to reviewer view</button>`;
    $('#scenario-banner').innerHTML = '';
    return;
  }
  pill.hidden = true;
  const switchLink = MODE === 'reviewer' ? `<button type="button" class="link" data-action="switchMode" data-testid="switch-mode">Switch to patient view</button>` : '';
  document.body.classList.toggle('lp-note-open', !!ui.lpNote && ui.card?.type === 'landing');
  if (ui.card?.type === 'landing') {
    $('#scenario-banner').innerHTML = `<span><strong>Prototype</strong> · synthetic data</span><button type="button" class="link" data-action="lpNote" aria-expanded="${!!ui.lpNote}" data-testid="btn-lp-note">${ui.lpNote ? 'Hide note' : 'What changed'}</button><button type="button" class="link" data-action="toggleDrawer">How this works</button>${switchLink}`;
    const tg = $('[data-testid="reviewer-toggle"]'); if (tg) tg.setAttribute('aria-expanded', String(!!ui.drawer));
    return;
  }
  $('#scenario-banner').innerHTML = `<span>${sc ? `<strong>Demo ${esc(sc.id)}</strong> · ${esc(sc.title)}${S.persona ? ` · synthetic patient ${esc(S.persona.name)}` : ''}` : 'Prototype with synthetic data. Nothing you type leaves this page.'}</span>
    <span class="banner-actions"><button type="button" class="link" data-action="toggleDelta" aria-pressed="${!!ui.delta}" data-testid="toggle-delta">${ui.delta ? 'Hide' : 'Show'} what changed from today</button><button type="button" class="link" data-action="toggleDrawer">${sc ? 'How this works' : 'Try a scenario'}</button>${switchLink}</span>`;
  const t = $('[data-testid="reviewer-toggle"]'); if (t) t.setAttribute('aria-expanded', String(!!ui.drawer));
}

function renderProgress() {
  const landing = ui.card?.type === 'landing';
  const pi = PHASES.findIndex((p) => p.stages.includes(S.stage));
  const segs = PHASES.map((p, i) => {
    let f = i < pi ? 100 : i > pi ? 0 : Math.round(((p.stages.indexOf(S.stage) + 1) / (p.stages.length + 1)) * 100);
    if (S.stage === 'done') f = 100;
    if (landing) f = 0;
    return `<span class="seg" title="${esc(p.label)}"><span class="seg-fill" style="width:${f}%"></span></span>`;
  }).join('');
  const pct = landing ? 0 : S.stage === 'done' ? 100 : Math.max(2, Math.round((stageIndex(S.stage) / (STAGES.length - 1)) * 100));
  const bar = $('#progress');
  bar.innerHTML = segs;
  bar.setAttribute('aria-valuenow', String(pct));
  bar.setAttribute('aria-valuetext', `${pct}% · ${phaseOf(S.stage).label}`);
  $('#pct').textContent = `${pct}%`;
  $('#btn-back').hidden = !(ui.history.length && QUESTION.has(ui.card?.type));
}

// Full conversation, shown in the "Conversation" sheet.
function renderThread() {
  $('#thread').innerHTML = ui.thread.map((m, i) => {
    if (m.role === 'tool') return `<li class="msg msg-tool" data-i="${i}"><span class="ai-mark">AI action</span>${m.html}</li>`;
    if (m.role === 'me') return `<li class="msg msg-me" data-i="${i}"><span class="who">You</span>${m.html}</li>`;
    return `<li class="msg msg-ai" data-i="${i}"><span class="ai-mark">AI</span>${m.html}</li>`;
  }).join('');
}

// The navigator's note on the current screen: what it said or did since the last screen.
function renderNote() {
  const items = ui.thread.map((m, i) => ({ ...m, i })).slice(ui.noteStart).filter((m) => m.role !== 'me' || m.typed);
  if (!items.length || ui.card?.type === 'landing') { $('#note').innerHTML = ''; return; }
  $('#note').innerHTML = `<div class="note" data-testid="navigator-note"><p class="note-head"><span class="ai-mark">AI</span>Care navigator</p>${items.map((m) => {
    if (m.role === 'tool') return `<div class="msg note-tool" data-i="${m.i}">${m.html}</div>`;
    if (m.role === 'me') return `<div class="msg note-me" data-i="${m.i}"><span class="who">You asked</span>${m.html}</div>`;
    return `<div class="msg note-ai" data-i="${m.i}">${m.html}${m.actions ? `<div class="msg-actions">${m.actions}</div>` : ''}</div>`;
  }).join('')}</div>`;
}

// Question card builder, styled like Legion's one-question screens.
function q({ id, title, body = '', options = null, more = '', multi = null, mkey = null, input = null, submit = null, why = true, extra = '', chip = null }) {
  const mk = mkey || id;
  const a = answerFor(id);
  const label = (x) => options?.[x] || TIMES[x] || STATES[x] || x;
  const personaChip = MODE === 'reviewer' && S.persona && a !== undefined && ui.card.type !== 'times2'
    ? `<button type="button" class="persona" data-action="persona" data-q="${id}" data-testid="persona-answer">${icon('user')}<span>${chip ? esc(chip) : `Use ${esc(S.persona.name)}'s answer: ${esc(Array.isArray(a) ? a.map(label).join(', ') : label(a))}`}</span></button>` : '';
  const whyHtml = why ? `<button type="button" class="link why" data-action="why" data-q="${id}" data-testid="why-${id}" aria-expanded="${!!ui.why[id]}">${icon('info')}Why we ask</button>${ui.why[id] ? `<div class="why-box" role="note"><p>${esc(ui.why[id].why)}</p><p class="muted">Who sees it: ${esc(ui.why[id].who)}${ui.why[id].required ? '' : ' · Optional'}</p></div>` : ''}` : '';
  const opts = options ? `<div class="opts-col" role="group" aria-label="${esc(title)}">${Object.entries(options).map(([v, l]) => `<button type="button" class="opt-row" data-action="answer" data-q="${id}" data-v="${v}" data-testid="opt-${v}">${esc(l)}</button>`).join('')}${more}</div>` : '';
  const chips = multi ? `<div class="opts-col" role="group" aria-label="${esc(title)}">${Object.entries(multi).map(([v, l]) => { const on = (ui.multi[mk] || []).includes(v); return `<button type="button" class="opt-row multi" aria-pressed="${on}" data-action="toggle" data-q="${mk}" data-v="${v}" data-testid="opt-${v}"><span class="box" aria-hidden="true">${on ? icon('check') : ''}</span>${esc(l)}</button>`; }).join('')}</div>` : '';
  const err = ui.errors[id] ? `<p class="err" role="alert" id="err-${id}">${esc(ui.errors[id])}</p>` : '';
  const foot = personaChip || whyHtml ? `<div class="card-foot">${whyHtml}${personaChip}</div>` : '';
  return `<section class="card q" data-testid="card-${ui.card.type === 'times2' ? 'times2' : id}" aria-labelledby="t-${id}">
    <h2 class="card-title" id="t-${id}" tabindex="-1">${esc(title)}</h2>${body ? `<p class="card-body">${body}</p>` : ''}
    ${opts}${chips}${input || ''}${err}
    ${submit ? `<div class="actions stretch">${submit}</div>` : ''}${extra}
    ${foot}</section>`;
}

function renderCard() {
  const c = ui.card;
  if (!c) return '';
  switch (c.type) {
    case 'landing': return landingCard();
    case 'mode': return `<section class="chooser" data-testid="card-mode" aria-labelledby="mode-h">
      <p class="eyebrow-mono">Legion Health · onboarding prototype</p>
      <h1 id="mode-h" class="chooser-h" tabindex="-1">How would you like to see it?</h1>
      <p class="chooser-sub">Same flow either way. Synthetic data only; nothing you type leaves this page. You can switch at any time.</p>
      <p class="chooser-scope" data-testid="scope-note"><strong>What's built:</strong> one path, end to end. A Texas adult paying with insurance or self-pay, from the first question to a completed first visit. Other paths (not a fit, a crisis, talking to a person, a waitlist) go as far as the handoff and say where the prototype stops.</p>
      <div class="chooser-grid">
        <button type="button" class="choice" data-action="chooseMode" data-m="patient" data-testid="mode-patient">
          <span class="choice-k">Patient view</span>
          <span class="choice-t">Go through it as a patient would</span>
          <span class="choice-d">Exactly what a patient sees, with nothing added. Type your own answers.</span>
          <span class="choice-go">Start as a patient ${icon('arrow-right')}</span>
        </button>
        <button type="button" class="choice" data-action="chooseMode" data-m="reviewer" data-testid="mode-reviewer">
          <span class="choice-k">Reviewer view</span>
          <span class="choice-t">See what changed and why</span>
          <span class="choice-d">A note on every screen saying what changed from today's flow, synthetic patients you can play, the A/B test behind each screen, and the agent's reasoning.</span>
          <span class="choice-go">Start reviewing ${icon('arrow-right')}</span>
        </button>
      </div></section>`;
    case 'state': return q({ id: 'state', title: 'Where are you located?', body: 'Legion is licensed in Texas and Utah. This prototype covers Texas.', why: true,
      options: { TX: 'Texas' }, more: `<button type="button" class="opt-row" disabled aria-disabled="true" data-testid="opt-UT">Utah <span class="opt-note">Not in this prototype</span></button>`,
      extra: `<p class="center"><button type="button" class="link" data-action="otherState" data-testid="link-waitlist">Not in Texas or Utah? Tell us where you are</button></p>` });
    case 'otherstate': return q({ id: 'otherstate', title: 'Which state do you live in?', body: "We'll tell you where to get help now, and let you know when Legion can treat you there.", why: false,
      input: `<label class="lab" for="input-otherstate">State</label><select id="input-otherstate" class="field" data-testid="input-otherstate">${Object.entries(STATES).filter(([k]) => !['TX', 'UT'].includes(k)).map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select>`,
      submit: btn('Continue', { id: 'submit-otherstate', action: 'submitOtherState', primary: true }) });
    case 'oldentry': return `<section class="card" data-testid="card-oldentry"><h2 class="card-title" tabindex="-1">Create your account</h2><p class="card-body">This is the control arm of T-01: today's entry asks for an account before anything else. Flip T-01 back in the reviewer panel to see the new entry.</p><label class="lab" for="old-email">Email</label><input id="old-email" class="field" type="email" autocomplete="off"><div class="actions">${btn('Continue', { id: 'btn-old', action: 'flip', data: { t: 'T-01' } })}</div></section>`;
    case 'story':
      if (S.variants['T-06'] === 'control') {
        return q({ id: 'story', title: 'Select the conditions you need help with', body: 'Control arm of T-06: today\'s diagnostic labels.', why: false,
          multi: { 'Generalized anxiety disorder': 'Generalized anxiety disorder', 'Major depressive disorder': 'Major depressive disorder', 'Insomnia disorder': 'Insomnia disorder', ADHD: 'ADHD', 'Bipolar disorder': 'Bipolar disorder', Other: 'Other' },
          mkey: 'chips', submit: btn('Continue', { id: 'submit-story', action: 'submitStory', primary: true }) });
      }
      return q({ id: 'story', title: 'In your own words, what can we help with?', body: "You can say how you've been feeling, what you'd like help with, or anything else on your mind.",
        input: `<label class="sr-only" for="input-story">What's going on</label><textarea id="input-story" class="field" rows="4" data-testid="input-story" placeholder="For example: I haven't been sleeping, and I worry about everything." aria-describedby="${ui.errors.story ? 'err-story' : ''}"></textarea>
          <div class="starters" role="group" aria-label="Ways to start">${["I can't sleep", 'I worry a lot', 'I feel down most days', 'I want to restart medication', "I'm not sure"].map((s) => `<button type="button" class="starter" data-action="starter" data-v="${esc(s)}">${esc(s)}</button>`).join('')}</div>`,
        submit: btn('Continue', { id: 'submit-story', action: 'submitStory', primary: true }) });
    case 'safety': return q({ id: 'safety', title: "Before we go on, I want to check how you're doing right now.", body: "In the past few weeks, have you had thoughts that you'd be better off dead, or of hurting yourself?", options: { no: 'No', yes: 'Yes', unsure: "I'd rather not say" } });
    case 'adult': return q({ id: 'adult', title: 'Are you 18 or older?', body: "We don't need your date of birth yet.", options: { yes: 'Yes', no: 'No' } });
    case 'signin': return q({ id: 'signin', title: "What's your email?", body: "I'll send a 6-digit code so your progress is saved. No password. If you've been here before, use the same email to sign in.",
      input: `<label class="lab" for="input-email">Email</label><input id="input-email" class="field" type="email" autocomplete="email" inputmode="email" data-testid="input-email" placeholder="you@example.com" aria-describedby="${ui.errors.signin ? 'err-signin' : ''}">`,
      submit: btn('Send me a code', { id: 'submit-email', action: 'submitSignin', primary: true }) });
    case 'code': return q({ id: 'code', title: 'Enter the 6-digit code', body: `The code goes to ${esc(S.memory.email || 'your email')}.`, why: false, chip: S.persona ? `Use the prototype code: 123456` : null,
      input: `<label class="lab" for="input-code">Code</label><input id="input-code" class="field code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" data-testid="input-code" aria-describedby="code-note${ui.errors.code ? ' err-code' : ''}">
        <p class="proto-note" id="code-note">Prototype: no email is sent. Use <strong>123456</strong>.</p>`,
      submit: btn('Continue', { id: 'submit-code', action: 'submitCode', primary: true }),
      extra: `<p class="center"><button type="button" class="link" data-action="newCode" data-testid="btn-new-code">Send a new code</button></p>` });
    case 'pay': { const po = ui.payOptions?.data?.paths;
      return q({ id: 'pay', title: 'How would you like to pay?',
        options: { insurance: 'Insurance', selfpay: 'Pay myself', unsure: 'Not sure yet' },
        extra: po ? `<div class="pay-facts"><p><strong>Insurance:</strong> most plans cost $${po.insurance.typicalLow} to $${po.insurance.typicalHigh} a visit ${badge('Estimate')}. We check yours next, only with your OK.</p><p><strong>Pay myself:</strong> $${po.selfPay.price} a visit ${badge('To be verified')}, charged after the visit.</p></div>` : '' }); }
    case 'insurance': return insuranceCard();
    case 'times': return q({ id: 'times', title: 'When could you usually meet?', body: 'Pick any that work.', multi: TIMES, submit: btn('Continue', { id: 'submit-times', action: 'submitTimes', data: { q: 'times' } , primary: true }) });
    case 'times2': return q({ id: 'times2', title: 'What times work better?', body: "I'll search again with these.", multi: TIMES, why: false, submit: btn('Search again', { id: 'submit-times2', action: 'submitTimes', data: { q: 'times2' } , primary: true }) });
    case 'matchpath': return matchPathCard();
    case 'recommend': return recommendCard();
    case 'prefs': { const p = PREF_Q[ui.prefStep];
      return `<section class="card q" data-testid="card-prefs"><p class="eyebrow">Closer match · ${ui.prefStep + 1} of ${PREF_Q.length} · all optional</p><h2 class="card-title" tabindex="-1">${esc(p.title)}</h2>
        <div class="opts-col">${Object.entries(p.opts).map(([v, l]) => `<button type="button" class="opt-row" data-action="pref" data-k="${p.key}" data-v="${v}" data-testid="opt-${v}">${esc(l)}</button>`).join('')}</div>
        <div class="actions">${btn('Skip', { id: 'btn-skip', action: 'pref', data: { k: p.key, v: '__skip' }, primary: true })}</div></section>`; }
    case 'noslot': return `<section class="card" data-testid="card-noslot"><h2 class="card-title" tabindex="-1">Ways forward</h2>
      <div class="stack">${btn(`Look at the next 30 days`, { id: 'btn-widen', action: 'widen', primary: true })}${btn('Join the waitlist. I hold the first opening and you confirm it', { id: 'btn-waitlist', action: 'waitlist' })}${S.answers.pay === 'insurance' ? btn(`See self-pay times ($${SELF_PAY_PRICE}, to be verified)`, { id: 'btn-selfpay-switch', action: 'selfpaySwitch' }) : ''}${btn('Talk to a person', { id: 'btn-human', action: 'human', iconName: 'user' })}</div></section>`;
    case 'noslot-control': return `<section class="card" data-testid="card-noslot-control"><h2 class="card-title" tabindex="-1">All providers are unavailable</h2><p class="card-body">Control arm of T-10. This is today's dead end: a phone number and nothing else. Flip T-10 in the reviewer panel to see the recovery paths.</p></section>`;
    case 'waitlisted': return `<section class="card" data-testid="card-waitlisted"><h2 class="card-title" tabindex="-1">You're on the waitlist</h2><p class="card-body">Want to keep looking in the meantime?</p>${stopHere('No text goes out when a time opens; the waitlist is simulated.')}<div class="stack">${btn('Look at the next 30 days', { id: 'btn-widen', action: 'widen', primary: true })}${S.answers.pay === 'insurance' ? btn(`See self-pay times ($${SELF_PAY_PRICE}, to be verified)`, { id: 'btn-selfpay-switch', action: 'selfpaySwitch' }) : ''}</div></section>`;
    case 'confirm': return confirmCard();
    case 'coverage-unknown': return `<section class="card" data-testid="card-coverage-unknown"><h2 class="card-title" tabindex="-1">${S.coverage === 'unknown' ? "Your coverage hasn't been checked" : "I couldn't confirm your coverage"} ${badge('Unknown')}</h2>
      <p class="card-body">${S.coverage === 'unknown' ? 'You skipped the check, so' : `${esc(planName())} isn't responding right now, so`} I won't guess what you'd pay.${S.coverage === 'unknown' ? '' : " Legion's team will confirm it within 1 business day."} Here's what you can do:</p>
      <div class="stack">${btn(S.hold ? 'Book now. Legion confirms coverage before anything is charged' : 'Keep going. Legion confirms coverage before anything is charged', { id: 'btn-book-pending', action: 'bookPending', primary: true })}${S.hold ? '' : btn('Try the check again', { id: 'btn-retry-check', action: 'updatePlan' })}${btn(`Switch to self-pay ($${SELF_PAY_PRICE}, to be verified)`, { id: 'btn-selfpay-switch', action: 'selfpaySwitch' })}${btn('Talk to a person', { id: 'btn-human', action: 'human', iconName: 'user' })}</div></section>`;
    case 'inactive': return `<section class="card" data-testid="card-inactive"><h2 class="card-title" tabindex="-1">This plan shows as inactive ${badge('Verified')}</h2>
      <p class="card-body">${esc(planName())} says this coverage isn't active. It may have ended or changed. You can enter a different plan, or pay yourself and still see someone soon.</p>
      <div class="stack">${btn('Enter a different plan', { id: 'btn-update-plan', action: 'updatePlan' })}${btn(`Pay myself ($${SELF_PAY_PRICE} a visit, to be verified)`, { id: 'btn-selfpay-switch', action: 'selfpaySwitch', primary: true })}${btn('Talk to a person', { id: 'btn-human', action: 'human', iconName: 'user' })}</div></section>`;
    case 'oon': return `<section class="card" data-testid="card-oon"><h2 class="card-title" tabindex="-1">Legion isn't in network with this plan yet</h2>
      <p class="card-body">You're covered by ${esc(planName())}, but Legion's clinicians can't bill it yet. Nothing has been charged.</p>
      <div class="stack">${btn(`See clinicians with self-pay ($${SELF_PAY_PRICE} a visit, to be verified)`, { id: 'btn-selfpay-switch', action: 'selfpaySwitch', primary: true })}${btn('Tell me when Legion takes my plan', { id: 'btn-oon-waitlist', action: 'oonWaitlist' })}${btn('Enter a different plan', { id: 'btn-update-plan', action: 'updatePlan' })}</div></section>`;
    case 'selfpay': { const free = S.variants['T-15'] === 'variant';
      return `<section class="card" data-testid="card-selfpay"><h2 class="card-title" tabindex="-1">Self-pay: $${SELF_PAY_PRICE} per visit ${badge('To be verified')}</h2>
        <ul class="facts">${free ? `<li>Your first 5 minutes are free. If you and your clinician decide to keep going, the visit is $${SELF_PAY_PRICE}.</li>` : ''}<li>Charged after your visit, not today.</li><li>Free to cancel up to 24 hours before. <span class="muted">(Placeholder policy for Legion to confirm.)</span></li><li>No other fees.</li></ul>
        <div class="actions">${btn('Continue', { id: 'btn-continue', action: 'continueSelfPay', primary: true })}</div></section>`; }
    case 'payment': return paymentCard();
    case 'prepare': return prepareCard();
    case 'records': return `<section class="card" data-testid="card-records"><h2 class="card-title" tabindex="-1">Records from past care <span class="tag">Optional</span></h2><p class="card-body">If you've seen a clinician before, we can ask them for notes and medication history. Your visit doesn't depend on it.</p><div class="actions">${btn('Skip for now', { id: 'skip-records', action: 'skipRecords', primary: true })}${btn('Allow', { id: 'btn-allow-records', action: 'allowRecords' })}</div></section>`;
    case 'inscard': return `<section class="card" data-testid="card-inscard"><h2 class="card-title" tabindex="-1">Add a photo of your insurance card</h2><p class="card-body">Your clinician's office needs it on file. In this demo, use the sample card.</p><div class="actions">${btn('Use the sample card photo', { id: 'btn-sample-card-photo', action: 'cardPhoto', primary: true })}</div></section>`;
    case 'device': return `<section class="card" data-testid="card-device"><h2 class="card-title" tabindex="-1">Check your camera and microphone</h2><p class="card-body">Takes about 20 seconds. Better now than at the start of your visit.</p><div class="actions">${btn('Run the check (demo)', { id: 'btn-device-check', action: 'deviceCheck', primary: true, iconName: 'video' })}</div></section>`;
    case 'visit': return visitCard();
    case 'done': return `<section class="card done" data-testid="card-done"><h2 class="card-title" tabindex="-1">First visit completed ${badge('Verified')}</h2>
      <p class="card-body">${ui.daysSinceStart == null ? '' : ui.daysSinceStart === 0 ? 'You went from your first message to a completed visit on the same day.' : `That took ${ui.daysSinceStart} day${ui.daysSinceStart === 1 ? '' : 's'} from your first message.`} Your clinician will set up follow-ups with you. I'm still here if you need to reschedule or have a question.</p>${stopHere('Onboarding ends at the first completed visit. Follow-up visits, prescriptions, rescheduling and billing are outside this prototype.')}</section>`;
    case 'crisis': return `<section class="card crisis" data-testid="card-crisis" aria-labelledby="t-crisis"><p class="sr-only" role="alert">Safety support: you can call or text 988 now.</p><h2 class="card-title" id="t-crisis" tabindex="-1">You don't have to finish this first</h2>
      <p class="card-body">What you shared matters. If you're thinking about ending your life or you're not safe right now, you can talk to someone now.</p>
      <div class="actions"><a class="btn btn-danger" href="tel:988">${icon('phone')}<span>Call 988</span></a><a class="btn btn-secondary" href="sms:988"><span>Text 988</span></a></div>
      <p class="card-body">A Legion clinician will also reach out to you today. If you're in immediate danger, call 911.</p>${stopHere('The 988 links are real. The same-day clinician contact is simulated: no one is notified.')}
      <div class="actions">${btn("I'm safe right now. Keep going", { id: 'btn-keep-going', action: 'keepGoing' })}</div></section>`;
    case 'notfit': return notFitCard();
    case 'kept': return `<section class="card" data-testid="card-kept"><h2 class="card-title" tabindex="-1">We'll be in touch when we can help</h2><p class="card-body">In the meantime, 988 is open any time, and a person on our team can help you find care now.</p>${stopHere('No follow-up message is sent; keep-in-touch is simulated.')}<div class="actions">${btn('Talk to a person', { id: 'btn-human', action: 'human', iconName: 'user' })}</div></section>`;
    case 'provider': return providerCard();
    case 'calibrate': return `<section class="card" data-testid="card-calibrate"><p class="eyebrow">Clinical lead review</p><h2 class="card-title" tabindex="-1">Approve Elena Ruiz's profile update?</h2><p class="card-body">Adds sleep problems (confidence 3 of 3) and weekday afternoons. A clinical lead checks each change against her actual caseload before matching uses it.</p><div class="actions">${btn('Approve as clinical lead (demo)', { id: 'btn-calibrate', action: 'calibrate', primary: true })}</div></section>`;
    case 'calibrated': return `<section class="card" data-testid="card-calibrated"><h2 class="card-title" tabindex="-1">Profile approved</h2><p class="card-body">Before this update, Maya's match was Sarah Cho. See who she's matched with now.</p><div class="actions">${btn("See Maya's match now", { id: 'btn-run-maya', action: 'runMaya', primary: true })}</div></section>`;
    default: return '';
  }
}

// Legion's marketing page (app.legionhealth.com, Nov 5, 2026), same placements.
// Substitutions: no logo image, no hero photo of a person, insurer names as text, no star ratings.
function landingCard() {
  const variant = S.variants['T-01'] === 'variant';
  const open = TOOLS.search_provider_availability(S, { payPath: 'selfpay', windows: ['any'], horizonDays: 14 });
  const firstFor = (id) => open.ok ? open.data.slots.filter((x) => x.clinicianId === id) : [];
  const specs = ['ruiz', 'cho', 'lee'].map((id) => clinicianById(S, id));
  const first = (c) => c.name.split(' ')[0];
  const cta = (text, id, cls, data = {}) => `<button type="button" class="${cls}" data-action="begin" data-testid="${id}" ${id === 'btn-start' ? 'data-primary' : ''} ${Object.entries({ cta: id, ...data }).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ')}>${esc(text)}</button>`;
  const nav = (label, href) => href ? `<a class="lp-navlink" href="${href}">${label}</a>` : `<button type="button" class="lp-navlink" disabled title="Not part of this prototype">${label}</button>`;
  return `<section class="lp" data-testid="card-landing" aria-labelledby="lp-h1">
    <header class="lp-nav">
      <span class="lp-logo" aria-label="Legion Health">legion<small>HEALTH</small></span>
      <nav class="lp-links" aria-label="Site">${nav('Find Care', '#lp-specs')}${nav('How It Works')}${nav('Testimonials')}${nav('FAQs')}</nav>
      <div class="lp-auth"><button type="button" class="lp-navlink" disabled title="Not part of this prototype">Login</button>${cta('Get Started', 'btn-start', 'lp-btn lp-btn-sm')}</div>
    </header>
    <div class="lp-hero">
      <div class="lp-art" aria-hidden="true"><span class="lp-heart"></span><span class="p1"></span><span class="p2"></span><span class="p3"></span><span class="p4"></span><span class="p5"></span><span class="p6"></span></div>
      <div class="lp-copy">
        <p class="lp-badge">${icon('shield')}Trusted by thousands of patients</p>
        <h1 id="lp-h1" class="lp-h1" tabindex="-1"><span>Feel Better—</span><span class="lp-h1b">Starting Today</span></h1>
        <p class="lp-sub">World-class psychiatric care covered by insurance. <strong>No waitlists. No referrals needed.</strong></p>
        <div class="lp-ctas">${cta('Book Appointment Now', 'btn-book', 'lp-btn')}<a class="lp-btn lp-btn-ghost" href="#lp-specs" data-testid="btn-browse">Browse Providers ${icon('arrow-down')}</a></div>
        <p class="lp-quick"><strong>Quick Booking.</strong> ${variant ? 'Start by telling us what you need, in your own words. No account until you pick a time.' : 'Most patients complete registration in under 3 minutes.'}</p>
      </div>
    </div>
    <div class="lp-ins"><p>23M+ individuals are covered by these major insurers ${icon('info')}</p><ul aria-label="Insurers">${['Aetna', 'Blue Cross Blue Shield', 'Cigna', 'Magellan Health', 'Oscar', 'UnitedHealthcare'].map((n) => `<li>${n}</li>`).join('')}</ul></div>
    <p class="lp-noins">No insurance? We welcome self-pay patients with transparent pricing.</p>
    <section class="lp-specs" id="lp-specs" aria-labelledby="lp-specs-h">
      <h2 id="lp-specs-h">Top-Rated <span>Specialists</span></h2>
      <p class="lp-specs-sub">Our board-certified providers specialize in anxiety, depression, ADHD and more. ${variant ? 'Tell us what you need and we\'ll suggest who fits.' : 'Choose your perfect match below.'}</p>
      <div class="lp-cards">${specs.map((c, i) => { const sl = firstFor(c.id); const wk = sl.filter((x) => x.dayOffset <= 7).length;
        return `<article class="lp-card"><div class="lp-card-top"><span class="lp-av" aria-hidden="true">${esc(c.name.split(' ').map((x) => x[0]).join(''))}</span><div><h3>${esc(c.name)}</h3><p>${esc(c.title === 'Psychiatrist' ? 'Psychiatrist' : 'Psychiatric Mental Health Nurse Practitioner')}</p></div></div>
          <div class="lp-tabs"><span class="on">Availability</span><span>About</span></div>
          <div class="lp-avail">${sl.length ? `<p class="lp-next">Next opening: <strong>${esc(fmtSlot(sl[0].start))}</strong> ${badge('Simulated')}</p><p class="muted">${wk > 1 ? `${wk} openings this week` : 'More openings next week'}</p>` : '<p>Openings in the next few weeks.</p>'}</div>
          ${cta(`Book with ${first(c)}`, `btn-book-clin-${i}`, 'lp-btn lp-btn-block', { clin: c.id })}</article>`; }).join('')}</div>
      <p class="lp-more"><span class="lp-navlink">Learn more about how it works ›</span></p>
    </section>
  </section>`;
}

function confirmCard() {
  const c = ui.card;
  let extra = '';
  if (c.summary) {
    const cl = clinicianById(S, S.hold.clinicianId);
    const costRow = S.cost?.pending ? `Coverage to be confirmed before any charge ${badge('Unknown')}` : S.cost?.amount != null ? `$${S.cost.amount} ${badge(S.cost.label)}` : '';
    const charged = payPath() === 'selfpay' ? (S.variants['T-15'] === 'variant' ? 'After the visit, only if you continue past the first 5 minutes' : 'After the visit') : 'Your plan bills Legion. Any copay is billed after the visit';
    extra = `<dl class="summary">${[['Clinician', `${cl.name}, ${cl.title}`], ['When', fmtSlot(S.hold.slot.start)], ['Format', '60-minute video call'], ['Cost', costRow], ['Charged', charged], ['Cancel', 'Free up to 24 hours before (placeholder policy)']]
      .map(([k, v]) => `<div><dt>${k}</dt><dd>${k === 'Cost' ? v : esc(v)}</dd></div>`).join('')}</dl>`;
  }
  if (c.isSummary) {
    extra = `<div class="draft"><p class="eyebrow">${badge('AI draft')} Not a diagnosis</p>${ui.editingSummary
      ? `<label class="lab" for="input-summary">Edit your summary</label><textarea id="input-summary" class="field" rows="6">${esc(ui.summary.text)}</textarea><div class="actions">${btn('Save changes', { id: 'btn-save-summary', action: 'saveSummary' })}</div>`
      : `<pre class="draft-text">${esc(ui.summary.text)}</pre><button type="button" class="link" data-action="editSummary" data-testid="btn-edit-summary">${icon('edit')}Edit</button>`}
      <p class="muted">${esc(ui.summary.notice)}</p></div>`;
  }
  return `<section class="card confirm" data-testid="card-confirm-${c.action}" aria-labelledby="t-confirm"><p class="eyebrow">${icon('check')}Needs your OK</p>
    <h2 class="card-title" id="t-confirm" tabindex="-1">${esc(c.title)}</h2>${c.body ? `<p class="card-body">${esc(c.body)}</p>` : ''}${extra}
    <div class="actions">${btn(c.yes, { id: `confirm-${c.action}`, action: 'confirmYes', primary: !ui.editingSummary })}${btn(c.no, { id: `decline-${c.action}`, action: 'confirmNo' })}</div></section>`;
}

function insuranceCard() {
  const ins = ui.ins || {};
  const val = (x) => esc(x || '');
  const insurer = INSURERS[ins.planId] || 'your insurer';
  const input = `<label class="lab" for="input-insurer">Insurer</label>
    <select id="input-insurer" class="field" data-testid="input-insurer"><option value="" ${ins.planId ? '' : 'selected'}>Choose your insurer</option>${Object.entries(INSURERS).map(([k, l]) => `<option value="${k}" ${ins.planId === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
    <div class="two">
      <div><label class="lab" for="input-legal-name">Legal name, as on the plan</label><input id="input-legal-name" class="field" autocomplete="name" data-testid="input-legal-name" value="${val(ins.name)}" aria-describedby="${ui.errors.insurance ? 'err-insurance' : ''}"></div>
      <div><label class="lab" for="input-dob">Date of birth</label><input id="input-dob" class="field" type="date" autocomplete="bday" data-testid="input-dob" value="${val(ins.dob)}" aria-describedby="${ui.errors.insurance ? 'err-insurance' : ''}"></div>
    </div>
    <label class="lab" for="input-member">Member ID</label><input id="input-member" class="field" autocomplete="off" data-testid="input-member" value="${val(ins.memberId)}" aria-describedby="${ui.errors.insurance ? 'err-insurance' : ''}">
    <button type="button" class="link scan" data-action="scanCard" data-testid="btn-scan-card">${icon('list')}Scan your card instead (sample card)</button>
    <label class="check"><input type="checkbox" id="input-in-name" data-action="inName" ${ins.inName !== false ? 'checked' : ''}> <span>This plan is in my name</span></label>
    ${ins.inName === false ? `<div class="two"><div><label class="lab" for="input-sub-name">Plan holder's name</label><input id="input-sub-name" class="field" autocomplete="off"></div><div><label class="lab" for="input-sub-rel">They are my</label><select id="input-sub-rel" class="field"><option>Spouse or partner</option><option>Parent</option><option>Other</option></select></div></div>` : ''}
    <p class="proto-note">Prototype: any details work. Please use made-up ones.</p>
    <p class="consent" data-testid="insurance-consent">${icon('shield')}<span>We'll share your name, birth date and plan details with ${esc(insurer)} only to check your coverage and estimate your cost. This doesn't bill you.</span></p>`;
  const submit = ui.checking
    ? `<button type="button" class="btn btn-primary" disabled data-testid="submit-insurance-busy"><span>Checking with ${esc(insurer)}…</span></button>`
    : `${btn('Check coverage and see matches', { id: 'submit-insurance', action: 'submitInsurance', primary: true })}${ui.insNotFound ? btn("Continue. We'll verify by hand", { id: 'btn-verify-later', action: 'verifyLater' }) : ''}${btn(`Pay myself instead ($${SELF_PAY_PRICE} a visit, to be verified)`, { id: 'btn-selfpay-switch', action: 'selfpaySwitch' })}`;
  return q({ id: 'insurance', title: 'Your insurance', body: 'One screen, then you\'ll see your matches.', input, submit,
    chip: S.persona ? `Use ${S.persona.name}'s card: ${INSURERS[answerFor('insurance')] || ''}` : null,
    extra: `<p class="center"><button type="button" class="link" data-action="skipInsurance" data-testid="btn-skip-insurance">Skip for now</button></p>` });
}

function coverageLine() {
  if (payPath() === 'selfpay') return `<p class="cov">${icon('check')}<span>Self-pay: <strong>$${SELF_PAY_PRICE} a visit</strong>, charged after the visit. ${badge('To be verified')}</span></p>`;
  if (S.coverage === 'unknown') return `<p class="cov">${icon('info')}<span>Coverage not checked yet. Legion confirms it before anything is charged. ${badge('Unknown')}</span></p>`;
  if (S.coverage === 'pending' || !S.eligibility) return `<p class="cov">${icon('info')}<span>Legion will confirm your ${esc(planName())} coverage before anything is charged. ${badge('Unknown')}</span></p>`;
  const el = S.eligibility;
  const main = el.carveOut
    ? `Covered by ${esc(el.plan)}. Your mental health benefits are managed by ${esc(el.carveOut)}, so your copay is still being checked. ${badge('To be verified')}`
    : `Covered by ${esc(el.plan)}. In network with Legion. About <strong>$${el.copay} a visit</strong>. ${badge('Verified')} ${badge('Estimate')}`;
  const details = ui.covOpen ? `<ul class="facts cov-details">${el.memberLast4 ? `<li>Member ID ending ${esc(el.memberLast4)}</li>` : ''}${el.deductibleRemaining != null ? `<li>$${el.deductibleRemaining} left on your deductible ${badge('Estimate')}</li>` : ''}<li>Video visits covered</li><li>No prior authorization needed</li><li class="muted">Simulated check. Your plan makes the final call after the visit.</li></ul>` : '';
  return `<div class="cov-wrap"><p class="cov">${icon('shield')}<span>${main}</span></p><button type="button" class="link small" data-action="coverageDetails" data-testid="btn-coverage-details" aria-expanded="${!!ui.covOpen}">${ui.covOpen ? 'Hide details' : 'See details'}</button>${details}</div>`;
}

function matchPathCard() {
  return `<section class="card" data-testid="card-matchpath" aria-labelledby="t-mp">
    <h2 class="card-title" id="t-mp" tabindex="-1">You're all set to see clinicians</h2>
    ${coverageLine()}
    <p class="card-body">How would you like to choose?</p>
    <div class="stack">${btn('See 3 matches now', { id: 'btn-matches-now', action: 'matchesNow', primary: true })}${btn('Answer a few questions for a closer match', { id: 'btn-personalize', action: 'personalize' })}</div>
    <p class="muted small">A closer match asks when you can meet and who you'd like to see. About two minutes, and you can skip any question.</p>
    <div class="row">${icon('video')}<p><strong>Your first visit</strong> is a 60-minute video call with a psychiatric clinician. They'll talk through what you told me and what you want from care.</p></div>
  </section>`;
}

function recommendCard() {
  const r = ui.rec;
  if (S.variants['T-09'] === 'control') {
    const seen = new Set(); const rows = ui.avail.data.slots.filter((x) => !seen.has(x.clinicianId) && seen.add(x.clinicianId));
    return `<section class="card" data-testid="card-recommend"><h2 class="card-title" tabindex="-1">Available providers</h2><p class="card-body muted">Control arm of T-09: a list sorted by soonest opening, no reasons.</p>
      <ul class="plain">${rows.map((sl, i) => { const c = clinicianById(S, sl.clinicianId); return `<li class="list-row"><span><strong>${esc(c.name)}, ${esc(c.creds)}</strong><br><span class="muted">${esc(fmtSlot(sl.start))}</span></span>${btn('Select', { id: `btn-hold-list-${i}`, action: 'hold', data: { c: c.id, s: sl.id }, primary: i === 0 })}</li>`; }).join('')}</ul></section>`;
  }
  const p = r.primary;
  const matched = Object.entries(ui.prefs).filter(([, v]) => v && v !== 'any');
  return `<section class="card" data-testid="card-recommend" aria-labelledby="t-rec"><p class="eyebrow">${badge('Estimate')} My recommendation</p>
    <div class="clin"><div class="initials" aria-hidden="true">${esc(p.clinician.name.split(' ').map((x) => x[0]).join(''))}</div><div><h2 class="card-title" id="t-rec" tabindex="-1">${esc(p.clinician.name)}, ${esc(p.clinician.creds)}</h2><p class="muted">${esc(p.clinician.title)}</p></div></div>
    <p class="slot">${icon('calendar')}<strong>${esc(fmtSlot(p.slot.start))}</strong> · 60-minute video call ${badge('Simulated')}</p>
    <h3 class="sub">Why I suggest this</h3><ul class="reasons">${p.reasons.map((x) => `<li>${icon('check')}${esc(x)}</li>`).join('')}</ul>
    ${matched.length ? `<p class="matched">Matched on: ${matched.map(([k, v]) => `<span class="tag">${esc(k === 'affirming' ? 'LGBTQ+ affirming' : String(v))}</span>`).join(' ')}</p>` : ''}
    <div class="actions">${btn('Hold this time', { id: 'btn-hold', action: 'hold', data: { c: p.clinician.id, s: p.slot.id }, primary: true })}${btn('Other times', { id: 'btn-other-times', action: 'otherTimes' })}${btn(ui.showAlts ? 'Hide other options' : `See ${r.alternatives.length} other options`, { id: 'btn-alternatives', action: 'alts' })}</div>
    ${ui.showAlts ? `<ul class="plain alts">${r.alternatives.map((a, i) => `<li class="list-row" data-testid="alt-${i}"><span><strong>${esc(a.clinician.name)}, ${esc(a.clinician.creds)}</strong> · ${esc(fmtSlot(a.slot.start))}<br><span class="muted">${esc(a.reasons.slice(0, 2).join(' · '))}</span></span>${btn('Hold', { id: `btn-hold-alt-${i}`, action: 'hold', data: { c: a.clinician.id, s: a.slot.id } })}</li>`).join('')}</ul>` : ''}
    ${S.variants['T-14'] === 'variant' && !matched.length ? `<div class="closer"><p><strong>Want a closer match?</strong> Four quick questions about who you'd like to see. About two minutes, and you can skip any.</p>${btn('Find a closer match', { id: 'btn-closer', action: 'closer' })}</div>` : ''}
  </section>`;
}

function paymentCard() {
  if (S.variants['T-12'] === 'control') {
    return `<section class="card" data-testid="card-payment"><h2 class="card-title" tabindex="-1">Payment: $${SELF_PAY_PRICE}</h2><p class="card-body muted">Control arm of T-12: today's plain card form.</p>
      <label class="lab" for="input-card">Card number</label><input id="input-card" class="field" autocomplete="off" inputmode="numeric" placeholder="4242 4242 4242 4242" data-testid="input-card">
      ${ui.errors.card ? `<p class="err" role="alert">${esc(ui.errors.card)}</p>` : ''}<div class="actions">${btn('Pay', { id: 'submit-card', action: 'submitCard', primary: true })}</div></section>`;
  }
  const free = S.variants['T-15'] === 'variant';
  return `<section class="card" data-testid="card-payment" aria-labelledby="t-pay"><h2 class="card-title" id="t-pay" tabindex="-1">Save a way to pay</h2>
    <ul class="facts"><li><strong>$0 today.</strong></li><li>${free ? `First 5 minutes free. If you continue, $${SELF_PAY_PRICE} after the call.` : `$${SELF_PAY_PRICE} after the call.`} ${badge('To be verified')}</li><li>It covers your 60-minute first visit. No other fees.</li><li>Cancel free up to 24 hours before. <span class="muted">(Placeholder policy.)</span></li></ul>
    <div class="stack">${btn('Apple Pay (demo)', { id: 'btn-wallet-apple', action: 'wallet', data: { m: 'Apple Pay (demo)' }, primary: true })}${btn('Google Pay (demo)', { id: 'btn-wallet-google', action: 'wallet', data: { m: 'Google Pay (demo)' } })}${btn('Test card ending 4242', { id: 'btn-test-card', action: 'wallet', data: { m: 'test card ending 4242' } })}</div></section>`;
}

function prepareCard() {
  const nextReq = ui.tasks.find((t) => !t.done && !t.optional) || ui.tasks.find((t) => !t.done);
  const allReq = ui.tasks.filter((t) => !t.optional).every((t) => t.done);
  return `<section class="card" data-testid="card-prepare" aria-labelledby="t-prep"><h2 class="card-title" id="t-prep" tabindex="-1">Get ready for your visit</h2>
    <ul class="tasks">${ui.tasks.map((t) => `<li class="task ${t.done ? 'is-done' : ''}">${icon(t.done ? 'check' : 'circle', 'ico task-ico')}<span class="task-text"><strong>${esc(t.title)}</strong><span class="muted">${esc(t.owner === 'You' ? 'You' : t.owner)}${t.optional ? ' · Optional' : ''}${t.skipped ? ' · Skipped' : ''}${t.done && !t.skipped ? ' · Done' : ''}</span></span>${t.done ? '' : btn(t.optional ? 'Decide' : 'Start', { id: `task-${t.id}`, action: 'task', data: { t: t.id }, primary: !allReq && t === nextReq })}</li>`).join('')}</ul>
    ${allReq ? `<div class="actions">${btn("I'm ready", { id: 'btn-ready', action: 'ready', primary: true })}</div>` : ''}</section>`;
}

function visitCard() {
  const b = S.booking; const c = b.clinician; const ph = ui.card.phase;
  if (ph === 'before') return `<section class="card" data-testid="card-visit"><h2 class="card-title" tabindex="-1">Your visit: ${esc(fmtSlot(b.slot.start))}</h2><p class="card-body">With ${esc(c.name)}, by video. I'll remind you 24 hours and 1 hour before. In this demo you can join now.</p><div class="actions">${btn('Join the visit (demo)', { id: 'btn-join', action: 'join', primary: true, iconName: 'video' })}</div></section>`;
  if (ph === 'minute5') return `<section class="card" data-testid="card-minute5"><p class="eyebrow">Minute 5</p><h2 class="card-title" tabindex="-1">Want to keep going with ${esc(c.name)}?</h2><p class="card-body">The rest of the visit is $${SELF_PAY_PRICE} ${badge('To be verified')}, charged after the call. If you stop now, you pay nothing. If anything about your safety came up, the visit continues either way.</p><div class="actions">${btn('Keep going', { id: 'btn-continue-visit', action: 'continueVisit', primary: true })}${btn('Stop here, no charge', { id: 'btn-stop-visit', action: 'stopVisit' })}</div></section>`;
  return `<section class="card call" data-testid="card-call"><p class="eyebrow">${icon('video')} Video visit (demo)</p><h2 class="card-title" tabindex="-1">${esc(c.name)} has joined</h2><p class="card-body">This stands in for the real visit. When it ends, your clinician confirms it happened. The app doesn't decide that on its own.</p><div class="actions">${btn('End the visit (demo)', { id: 'btn-end-visit', action: 'endVisit', primary: true })}</div></section>`;
}

function notFitCard() {
  const minor = ui.card.rule === 'FIT-AGE';
  const stateName = S.memory.state && S.memory.state !== 'Somewhere else' ? S.memory.state : 'your state';
  return `<section class="card" data-testid="card-notfit" aria-labelledby="t-nf"><h2 class="card-title" id="t-nf" tabindex="-1">${minor ? 'Legion treats adults, for now' : `Legion can only treat people in Texas right now`}</h2>
    <p class="card-body">${minor ? "That's a rule about who we can treat, not about you. Here's where to get help now:" : `It's a licensing rule, not a judgment about you. Here's where to get help in ${esc(stateName)} now:`}</p>
    <ul class="facts"><li>Not safe right now? <a href="tel:988">Call</a> or <a href="sms:988">text</a> 988, any time.</li><li><a href="https://findtreatment.gov" target="_blank" rel="noopener">FindTreatment.gov</a> lists clinics near you.</li>${minor ? '<li>A school counselor or your doctor can help you find someone who treats teens.</li>' : '<li>The back of your insurance card has a behavioral health number.</li>'}</ul>
    <h3 class="sub">${minor ? 'Want us to let a parent or guardian know when Legion can help?' : `Want to hear from us when Legion opens in ${esc(stateName)}?`}</h3>
    <label class="lab" for="input-kit-email">${minor ? "A parent or guardian's email" : 'Your email'}</label><input id="input-kit-email" class="field" type="email" autocomplete="off" data-testid="input-kit-email" placeholder="name@example.com">
    <label class="check"><input type="checkbox" id="kit-consent" data-testid="kit-consent"> <span>${minor ? 'Contact this person once when Legion can help. They can stop it any time.' : 'Contact me once when Legion can help. I can stop it any time.'}</span></label>
    ${minor ? '' : '<label class="check"><input type="checkbox" id="kit-sms"> <span>Also text me (a separate opt-in)</span></label>'}
    ${ui.errors.kit ? `<p class="err" role="alert">${esc(ui.errors.kit)}</p>` : ''}
    <div class="actions">${btn('Keep in touch', { id: 'submit-kit', action: 'submitKit', primary: true })}${minor ? '' : btn('Email me what I told you', { id: 'btn-email-summary', action: 'emailStory' })}${btn('Talk to a person', { id: 'btn-human', action: 'human', iconName: 'user' })}</div></section>`;
}

function providerCard() {
  const f = ui.provider.focus; const w = ui.provider.windows;
  const topics = { anxiety: 'Worry and anxiety', sleep: 'Sleep problems', depression: 'Low mood', stress: 'Stress', trauma: 'Trauma', adhd: 'Focus and attention' };
  return `<section class="card" data-testid="card-provider" aria-labelledby="t-prov"><p class="eyebrow">Provider profile (F-30, simulated)</p><h2 class="card-title" id="t-prov" tabindex="-1">Elena Ruiz, PMHNP: what do you treat best?</h2>
    <table class="ptable"><thead><tr><th scope="col">Topic</th><th scope="col">Confidence</th></tr></thead><tbody>${Object.entries(topics).map(([k, l]) => `<tr><th scope="row"><label for="f-${k}">${l}</label></th><td><select id="f-${k}" class="field small" data-focus="${k}">${[0, 1, 2, 3].map((n) => `<option value="${n}" ${(f[k] || 0) === n ? 'selected' : ''}>${n === 0 ? 'Not a focus' : `${n} of 3`}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table>
    <fieldset class="fs"><legend>When do you see new patients?</legend>${Object.entries({ morning: 'Weekday mornings', afternoon: 'Weekday afternoons', evening: 'Weekday evenings', weekend: 'Saturdays' }).map(([k, l]) => `<label class="check"><input type="checkbox" data-window="${k}" ${w.includes(k) ? 'checked' : ''}> <span>${l}</span></label>`).join('')}</fieldset>
    <div class="actions">${btn('Fill the sample update', { id: 'btn-profile-sample', action: 'profileSample' })}${btn('Save profile', { id: 'submit-profile', action: 'submitProfile', primary: true })}</div></section>`;
}

// ---------- side panel: plan, memory, timeline ----------
function planItems() {
  const items = [];
  const si = stageIndex(S.stage);
  for (const ph of PHASES) {
    const first = stageIndex(ph.stages[0]); const last = stageIndex(ph.stages.at(-1));
    const status = si > last || S.stage === 'done' ? 'done' : si >= first ? 'now' : 'later';
    let subs = [];
    if (ph.id === 'book') subs = [
      ['Hold a time', 'You', !!S.hold],
      [S.answers.pay === 'insurance' ? `Check your cost with ${planName() || 'your plan'}` : `Self-pay $${SELF_PAY_PRICE}, to be verified`, S.answers.pay === 'insurance' ? 'You and your insurer' : 'You', !!S.cost],
      ['Book the visit', 'You', !!S.booking],
    ];
    if (ph.id === 'prepare' && ui.tasks.length) subs = ui.tasks.map((t) => [t.title + (t.optional ? ' (optional)' : ''), t.owner, t.done]);
    if (ph.id === 'visit') subs = [['Join the video call', 'You', S.stage === 'done'], ['Confirm the visit happened', 'Your clinician', S.stage === 'done']];
    items.push({ ...ph, status, subs });
  }
  return items;
}
function renderSide() {
  const showPlan = ui.planShown || stageIndex(S.stage) >= stageIndex('prepare');
  const plan = showPlan ? `<ol class="plan">${planItems().map((p) => `<li class="plan-${p.status}">${icon(p.status === 'done' ? 'check' : p.status === 'now' ? 'dot' : 'circle', 'ico plan-ico')}<div><strong>${esc(p.label)}</strong><span class="muted"> · ${esc(p.owner)}${p.status === 'now' ? ' · Now' : ''}</span>
      ${p.status !== 'later' && p.subs.length ? `<ul class="subs">${p.subs.map(([t, o, d]) => `<li class="${d ? 'is-done' : ''}">${d ? icon('check', 'ico tiny') : icon('circle', 'ico tiny')}<span>${esc(t)}<span class="muted"> · ${esc(o)}</span></span></li>`).join('')}</ul>` : ''}</div></li>`).join('')}</ol>
      ${S.timeline.length ? `<p class="muted small">Updated after: ${esc(S.timeline.at(-1).text)}</p>` : ''}`
    : `<p class="muted">${S.variants['T-16'] === 'control' && stageIndex(S.stage) >= stageIndex('fit') ? 'Control arm of T-16: the plan appears only after booking.' : 'Your plan appears once we know Legion can help.'}</p>`;
  const MEM = [['story', "What's going on"], ['topics', 'Topics'], ['state', 'State'], ['adult', 'Age'], ['payLabel', 'Paying with'], ['plan', 'Plan'], ['timesLabel', 'Times'], ['prefs', 'Preferences'], ['appointment', 'Appointment'], ['email', 'Email'], ['cost', 'Cost'], ['payment', 'Payment'], ['questions', 'Questions for your clinician'], ['askedAbout', 'Clinician you picked']];
  const mem = MEM.filter(([k]) => S.memory[k] && (!Array.isArray(S.memory[k]) || S.memory[k].length)).map(([k, l]) => {
    const v = Array.isArray(S.memory[k]) ? S.memory[k].join(k === 'questions' ? ' · ' : ', ') : S.memory[k];
    const editable = ['story', 'email'].includes(k);
    if (ui.editing === k) return `<li><span class="mk">${esc(l)}</span><label class="sr-only" for="mem-input">${esc(l)}</label><input id="mem-input" class="field small" value="${esc(v)}"><div class="actions">${btn('Save', { id: `save-mem-${k}`, action: 'saveMemory', data: { k } })}</div></li>`;
    return `<li><div class="mrow"><span class="mk">${esc(l)}</span><span class="src-tag">· You said</span>${editable ? `<button type="button" class="link" data-action="editMemory" data-k="${k}" aria-label="Edit ${esc(l)}">${icon('edit')}Edit</button>` : k === 'timesLabel' && stageIndex(S.stage) <= stageIndex('recommend') ? `<button type="button" class="link" data-action="changeTimes" aria-label="Change times">${icon('edit')}Change</button>` : ''}</div><span class="mv">${esc(v)}</span></li>`;
  }).join('');
  const tl = S.timeline.slice().reverse().map((t) => `<li><span class="time">${esc(t.time)}</span><span>${esc(t.text)}</span><span class="tl-meta">${t.tool ? '<span class="ai-mark">AI action</span>' : ''}${badge(t.label)}${t.confirmed === true ? '<span class="tag ok">You confirmed</span>' : t.confirmed === false ? '<span class="tag">You declined</span>' : t.tool ? '<span class="tag">No confirmation needed</span>' : ''}${t.ok === false ? '<span class="tag risk">Did not work</span>' : ''}</span></li>`).join('');
  const hero = !showPlan ? `<div class="left-hero"><p class="hero-sm">Feel better<br><span class="hero-blue">starting today</span></p><p class="muted">Your plan, what we remember, and every action the navigator takes show up here as you go.</p></div>` : '';
  $('#side').innerHTML = `
    <div class="side-head">${btn('Close', { id: 'btn-close-panel', action: 'closePanel', kind: 'ghost', iconName: 'x' })}</div>
    ${hero}
    ${showPlan || ui.panel ? `<section class="panel" data-testid="plan" aria-labelledby="h-plan"><h2 id="h-plan" class="eyebrow-mono">Your plan</h2>${plan}</section>` : ''}
    <section class="panel" data-testid="memory" aria-labelledby="h-mem"><h2 id="h-mem" class="eyebrow-mono">What I remember</h2>${mem ? `<ul class="mem">${mem}</ul><p class="muted small">Only what you've told me. You can correct it.</p>` : '<p class="muted small">Nothing yet.</p>'}</section>
    <section class="panel" data-testid="timeline" aria-labelledby="h-tl"><h2 id="h-tl" class="eyebrow-mono">Activity</h2>${tl ? `<ul class="tl">${tl}</ul>` : '<p class="muted small">Every action the navigator takes shows up here.</p>'}</section>`;
  $('#left').classList.toggle('open', !!ui.panel);
}

// ---------- reviewer drawer ----------
function renderDrawer() {
  const d = $('#drawer');
  d.hidden = !ui.drawer;
  document.body.classList.toggle('drawer-open', !!ui.drawer);
  if (!ui.drawer) return;
  const tabs = [['screen', 'This screen'], ['loop', 'Agent loop'], ['events', 'Events'], ['scenarios', 'Scenarios']];
  let body = '';
  if (ui.tab === 'screen') body = drawerScreen();
  if (ui.tab === 'loop') body = drawerLoop();
  if (ui.tab === 'events') body = drawerEvents();
  if (ui.tab === 'scenarios') body = drawerScenarios();
  d.innerHTML = `<div class="dr-head"><h2 id="drawer-title" tabindex="-1">${icon('flask')}How this works</h2>${btn('Close', { id: 'btn-close-drawer', action: 'toggleDrawer', kind: 'ghost', iconName: 'x' })}</div>
    <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button type="button" role="tab" aria-selected="${ui.tab === k}" class="tab" data-action="tab" data-t="${k}" data-testid="tab-${k}">${l}</button>`).join('')}</div>
    <div class="dr-body">${body}</div>`;
}
function drawerScreen() {
  const r = REVIEWER[S.stage];
  const ph = phaseOf(S.stage);
  return `<p class="eyebrow">Stage: ${esc(S.stage)} · Plan step: ${esc(ph.label)}</p><h3 class="dr-title">${esc(r.title)}</h3>
    ${r.friction.length ? `<h4>${icon('info')}What patients hit today</h4>${r.friction.map((f) => { const x = FRICTION[f]; return `<div class="fr"><p><span class="tag risk">${f}</span> <span class="muted">${esc(x.where)}</span></p><p>${esc(x.was)}</p>${x.quote ? `<blockquote>"${esc(x.quote)}"<cite>From the walkthrough</cite></blockquote>` : ''}<p class="muted small">Funnel: ${esc(x.numbers)}</p></div>`; }).join('')}` : ''}
    <h4>${icon('lightbulb')}What we changed</h4><p>${esc(r.change)}</p>
    <h4>${icon('compass')}What the agent does here</h4><p>${esc(r.agent)}</p>
    ${r.note ? `<p class="note">${esc(r.note)}</p>` : ''}
    ${r.tests.length ? `<h4>${icon('flask')}How we test it</h4>${r.tests.map((t) => testCard(t)).join('')}` : ''}
    <h4>Goals this screen shows</h4><p>${r.goals.map((g) => `<span class="tag" title="${esc(GOALS[g])}">${g}: ${esc(GOALS[g])}</span>`).join(' ')}</p>`;
}
function testCard(id) {
  const t = TESTS[id];
  const v = S.variants[id];
  return `<div class="test"><p><strong>${id} · ${esc(t.name)}</strong> <span class="muted">(${t.hypothesis})</span></p>
    <div class="arms"><div class="${v === 'control' ? 'arm on' : 'arm'}"><span class="muted small">Control</span><p>${esc(t.control)}</p></div><div class="${v === 'variant' ? 'arm on' : 'arm'}"><span class="muted small">Variant</span><p>${esc(t.variant)}</p></div></div>
    <p class="small"><strong>Decides it:</strong> ${esc(t.metric)}</p><p class="small muted">Power at today's traffic: ${esc(t.power)}</p>
    ${t.flippable ? `<button type="button" class="switch" role="switch" aria-checked="${v === 'variant'}" data-action="flip" data-t="${id}" data-testid="variant-${id}"><span class="knob" aria-hidden="true"></span><span>Showing the ${v}. Switch to the ${v === 'variant' ? 'control' : 'variant'}</span></button>` : '<p class="small muted">Described here, not switchable in the prototype.</p>'}</div>`;
}
function drawerLoop() {
  const t = S.trace;
  const steps = [['Observe', t?.observe], ['Plan', t?.plan], ['Explain', t?.explain], ['Confirm', t?.confirm], ['Act', t?.act], ['Report', t?.report], ['Continue or escalate', t?.next]];
  const c = t?.act ? TOOL_CONTRACTS[t.act] : null;
  const lastSafe = [...S.events].reverse().find((e) => e.name === 'safety_policy_evaluated');
  return `<p>Every navigator turn runs the same seven steps. This is the last one.</p>
    <ol class="loop">${steps.map(([k, v]) => `<li><strong>${k}</strong><span>${esc(v || '—')}</span></li>`).join('')}</ol>
    ${c ? `<h4>Tool contract: <code>${esc(t.act)}</code></h4><dl class="summary">${[['Inputs', c.inputs], ['Label in production', c.label], ['Needs confirmation', c.confirm ? `Yes (${c.confirm})` : 'No'], ['Can fail with', c.failures], ['Recovery', c.recovery]].map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
    <h4>Policies</h4><ul class="plain small"><li><strong>P-SAFE</strong> last ran: ${lastSafe ? `${esc(lastSafe.props.outcome)}${lastSafe.props.ruleId ? ` (${esc(lastSafe.props.ruleId)})` : ''}` : 'not yet'}. Rules, not the AI, decide safety routing.</li><li><strong>P-FIT</strong>: ${S.fit ? `${esc(S.fit.fit)} by rule ${esc(S.fit.ruleId)}` : 'not run yet'}.</li><li><strong>P-CONFIRM</strong>: hold, book, pay, consent, records, send, share summary always need a yes.</li><li><strong>P-CLINICAL</strong>: diagnosis and medication questions get a fixed refusal and an offer to ask the clinician.</li></ul>
    <p class="small muted">The navigator is scripted in this prototype, behind the same respond() seam a live model would use.</p>`;
}
function drawerEvents() {
  const ev = S.events.slice().reverse();
  return `<p>Events as Legion would store them, after <code>redact()</code>. No names, contact details, IDs or the patient's words.</p>
    <button type="button" class="switch" role="switch" aria-checked="${ui.raw}" data-action="rawToggle" data-testid="raw-toggle"><span class="knob" aria-hidden="true"></span><span>Show what was removed (never stored)</span></button>
    <ul class="events">${ev.map((e) => `<li><code class="ev-name">${esc(e.name)}</code><code class="ev-props">${esc(JSON.stringify(e.props))}</code>${ui.raw && JSON.stringify(e.raw) !== JSON.stringify(e.props) ? `<code class="ev-raw">removed → ${esc(JSON.stringify(e.raw))}</code>` : ''}</li>`).join('')}</ul>`;
}
function drawerScenarios() {
  const flippable = Object.entries(TESTS).filter(([, t]) => t.flippable).map(([id]) => id);
  return `<p>Each scenario uses a synthetic patient. Click their suggested answers, or type your own.</p>
    <ul class="plain scen">${SCENARIOS.map((s) => `<li><button type="button" class="scen-btn ${ui.scenario?.id === s.id ? 'on' : ''}" data-action="scenario" data-s="${s.id}" data-testid="scenario-${s.id}"><strong>${s.id}</strong> ${esc(s.title)}${s.persona ? `<span class="muted small">${esc(PERSONAS[s.persona].blurb)}</span>` : '<span class="muted small">Provider side: Elena Ruiz updates her profile.</span>'}</button></li>`).join('')}</ul>
    <h4>Jump ahead with the current patient</h4><div class="stack-row">${['options', 'recommend', 'hold', 'book', 'prepare', 'visit'].map((s) => `<button type="button" class="btn btn-ghost small" data-action="jump" data-s="${s}" ${S.persona ? '' : 'disabled'}>${s}</button>`).join('')}</div>
    <h4>Interruptions</h4><div class="stack-row">${btn('Simulate closing the tab', { id: 'btn-interrupt', action: 'interrupt' })}${btn('Restart', { id: 'btn-restart', action: 'restart' })}</div>
    <h4>All switchable tests</h4>${flippable.map((id) => `<button type="button" class="switch" role="switch" aria-checked="${S.variants[id] === 'variant'}" data-action="flip" data-t="${id}"><span class="knob" aria-hidden="true"></span><span>${id} ${esc(TESTS[id].name)}: ${S.variants[id]}</span></button>`).join('')}`;
}

// ---------- boot ----------
window.__proto = {
  start: (id) => { MODE = 'reviewer'; start(id); },
  snapshot: () => ({ history: ui.history.map((h) => ({ type: h.type })), stage: S.stage, events: S.events.map((e) => ({ name: e.name, props: e.props })), timeline: S.timeline, memory: S.memory, variants: S.variants, flags: S.flags,
    rec: ui.rec?.primary ? { slot: ui.rec.primary.slot, clinician: ui.rec.primary.clinician.id } : null, hold: S.hold || null }),
  interrupt: () => interrupt(),
  autoplayTo,
};
MODE = loadMode();
if (MODE) start(MODE === 'reviewer' ? (new URLSearchParams(location.search).get('scenario') || 'E-1') : null);
else { start(null); setCard({ type: 'mode' }); }
