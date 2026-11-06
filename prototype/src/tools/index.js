// Simulated tools. Each returns {ok, data, source, label, error}.
// label is one of: Verified, Estimate, Simulated, Unknown, AI draft, To be verified.
import { checkFitRules } from '../policy/fit.js';
import { PLANS, CLINICIANS, SELF_PAY_PRICE, TYPICAL_INSURED_RANGE, slotsFor, daysBetween } from './data.js';
import { EXPLAIN } from './explain.js';

const ok = (data, source, label) => ({ ok: true, data, source, label, error: null });
const fail = (error, source, label = 'Unknown', data = null) => ({ ok: false, data, source, label, error });

const planById = (id) => PLANS.find((p) => p.id === id);
export const clinicianById = (session, id) => (session.clinicians || CLINICIANS).find((c) => c.id === id);

const CONCERN_WORDS = { anxiety: 'worry and anxiety', sleep: 'sleep problems', depression: 'low mood', medication: 'restarting medication',
  adhd: 'focus and attention', stress: 'stress', trauma: 'trauma', mood: 'mood changes' };

function fmtSlot(iso) {
  const d = new Date(iso);
  const day = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/Chicago' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' });
  return `${day}, ${time}`;
}
export { fmtSlot };

export const TOOLS = {
  check_service_fit(session, input) {
    const r = checkFitRules(input);
    return ok(r, 'Legion fit policy (P-FIT)', 'Verified');
  },

  explain_question(session, { questionId }) {
    const e = EXPLAIN[questionId];
    if (!e) return fail('unknown_question', 'Content library');
    return ok(e, 'Content library', 'Verified');
  },

  get_payment_options(session, { preference }) {
    return ok({
      preference,
      paths: {
        insurance: { plans: PLANS.map((p) => p.name), typicalLow: TYPICAL_INSURED_RANGE.low, typicalHigh: TYPICAL_INSURED_RANGE.high, label: 'Estimate' },
        selfPay: { price: SELF_PAY_PRICE, label: 'To be verified' },
      },
    }, 'Legion price list (simulated)', 'Simulated');
  },

  // D-24: simulated sign-in. Nothing is sent; there is no mail server. The code is always 123456.
  start_sign_in(session, { email }) {
    const e = String(email || '').trim();
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(e)) return fail('invalid_email', 'Sign-in (simulated)', 'Unknown');
    return ok({ sent: true, returning: !!session.flags?.returning }, 'Sign-in (simulated, nothing sent)', 'Simulated');
  },

  verify_sign_in_code(session, { code }) {
    if (String(code || '').trim() !== '123456') return fail('wrong_code', 'Sign-in (simulated)', 'Unknown');
    return ok({ signedIn: true, returning: !!session.flags?.returning }, 'Sign-in (simulated)', 'Verified');
  },

  // D-23: X12 270/271-style check. No validation in the prototype; outcomes come from scenario flags.
  // Network status comes from Legion's contract list (PLANS), never from the insurer's response.
  check_insurance_eligibility(session, { planId, memberId }) {
    const src = 'Eligibility check (simulated 270/271)';
    const flag = session.flags?.eligibility || (session.flags?.coverageTimeout ? 'no_response' : null);
    if (flag === 'no_response') return fail('no_response', src, 'Unknown');
    if (flag === 'not_found_once' && !session.flags._notFoundOnce) { session.flags._notFoundOnce = true; return fail('not_found', src, 'Unknown'); }
    if (flag === 'name_mismatch') return fail('name_mismatch', src, 'Unknown');
    // R-18: any insurer passes in the prototype. "Another plan" gets a typical copay; out of network only from a flag.
    const plan = planById(planId) || { id: planId || 'other', name: 'Your plan', copay: 40, basis: 'typical specialist copay' };
    const memberLast4 = String(memberId || '').replace(/\s/g, '').slice(-4);
    const base = { planId, plan: plan?.name || 'Your plan', memberLast4, telehealth: true, priorAuth: false };
    if (flag === 'inactive') return ok({ ...base, status: 'inactive', inNetwork: !!plan }, src, 'Verified');
    if (flag === 'out_of_network') return ok({ ...base, status: 'active', inNetwork: false, copay: null }, src, 'Verified');
    if (flag === 'carve_out') return ok({ ...base, status: 'active', inNetwork: true, copay: null, basis: plan.basis, deductibleRemaining: 420, carveOut: 'Mesa Behavioral Health' }, src, 'Verified');
    return ok({ ...base, status: 'active', inNetwork: true, copay: plan.copay, basis: plan.basis, deductibleRemaining: 420 }, src, 'Verified');
  },

  // Cost for the held visit, from the check the patient already agreed to. Sends nothing new.
  estimate_patient_cost(session, { eligibility } = {}) {
    const el = eligibility;
    if (!el || el.status !== 'active' || !el.inNetwork) return fail('no_check', 'Coverage check on file', 'Unknown');
    if (el.copay == null) return ok({ pending: true, plan: el.plan, carveOut: el.carveOut || null }, 'Coverage check on file', 'To be verified');
    return ok({ covered: true, estimate: el.copay, basis: el.basis, plan: el.plan }, 'Coverage check on file', 'Estimate');
  },

  search_provider_availability(session, { payPath, planId, windows = ['any'], horizonDays = 14 }) {
    const plan = payPath === 'insurance' ? planById(planId) : null;
    const all = windows.includes('any');
    const slots = [];
    for (const c of session.clinicians || CLINICIANS) {
      if (plan && !c.plans.includes(plan.id)) continue;
      for (const sl of slotsFor(c, session.now)) {
        if (sl.dayOffset > horizonDays) continue;
        if (plan?.firstOpeningDay && sl.dayOffset < plan.firstOpeningDay) continue;
        if (!all && !windows.includes(sl.window)) continue;
        if ((session.taken || []).includes(sl.id)) continue;
        slots.push(sl);
      }
    }
    slots.sort((a, b) => a.start.localeCompare(b.start));
    if (!slots.length) return fail('none_in_window', 'Scheduling (simulated)', 'Simulated', { horizonDays });
    return ok({ slots, horizonDays }, 'Scheduling (simulated)', 'Simulated');
  },

  recommend_provider(session, { slots = [], concerns = [], prefs = {}, payPath, planId }) {
    if (!slots.length) return fail('no_fit', 'Match rules', 'Unknown');
    const byClin = new Map();
    for (const sl of slots) if (!byClin.has(sl.clinicianId)) byClin.set(sl.clinicianId, []), byClin.get(sl.clinicianId);
    for (const sl of slots) byClin.get(sl.clinicianId).push(sl);
    const plan = planById(planId);
    const scored = [...byClin.entries()].map(([id, sls]) => {
      const c = clinicianById(session, id);
      let score = 0;
      const reasons = [];
      const matched = concerns.filter((k) => c.focus[k]);
      for (const k of matched) score += c.focus[k];
      if (matched.length) reasons.push(`Works with ${matched.map((k) => CONCERN_WORDS[k] || k).join(' and ')}${c.profileUpdated ? ' (from her updated profile)' : ''}`);
      if (payPath === 'insurance' && plan) reasons.push(`In network with ${plan.name}`);
      else if (payPath !== 'insurance') reasons.push('Takes self-pay patients');
      if (prefs.language && c.languages.includes(prefs.language)) { score += 2; reasons.push(`Speaks ${prefs.language}`); }
      if (prefs.gender && prefs.gender !== 'any' && c.gender === prefs.gender) { score += 2; reasons.push(`A ${prefs.gender === 'nonbinary' ? 'nonbinary' : prefs.gender} clinician, as you asked`); }
      if (prefs.style && c.style === prefs.style) { score += 1; reasons.push(prefs.style === 'gentle' ? 'Gentle, go-at-your-pace style' : 'Direct, practical style'); }
      if (prefs.affirming && c.affirming) { score += 2; reasons.push('LGBTQ+ affirming'); }
      const first = sls[0];
      reasons.push(`Soonest opening that fits your times: ${fmtSlot(first.start)}`);
      score -= first.dayOffset * 0.05;
      return { clinician: c, slot: first, slots: sls, reasons, score };
    }).sort((a, b) => b.score - a.score);
    const [primary, ...rest] = scored;
    const alternatives = rest.slice(0, 2).map((x) => ({ clinician: x.clinician, slot: x.slot, reasons: x.reasons }));
    for (let i = 1; alternatives.length < 2 && i < primary.slots.length; i++) {
      alternatives.push({ clinician: primary.clinician, slot: primary.slots[i], reasons: [`Another time with ${primary.clinician.name}`] });
    }
    return ok({ primary: { clinician: primary.clinician, slot: primary.slot, reasons: primary.reasons }, alternatives }, 'Match rules (simulated)', 'Estimate');
  },

  hold_appointment(session, { slotId }) {
    session.taken = session.taken || [];
    if (session.flags?.slotTaken && !session.flags._takenOnce) {
      session.flags._takenOnce = true;
      session.taken.push(slotId);
      return fail('slot_taken', 'Scheduling (simulated)', 'Verified');
    }
    if (session.taken.includes(slotId)) return fail('slot_taken', 'Scheduling (simulated)', 'Verified');
    return ok({ holdId: `H-${slotId}`, slotId }, 'Scheduling (simulated)', 'Simulated');
  },

  save_patient_progress(session, { email, purpose = 'resume' }) {
    const e = String(email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[a-z]+$/.test(e)) return fail('invalid_email', 'Messaging (simulated)', 'Unknown');
    if (!/@(example\.(com|org)|test\.dev)$/.test(e)) return fail('not_test_email', 'Prototype guard', 'Unknown');
    return ok({ sent: true, purpose, resumeCode: 'RESUME-4821' }, 'Messaging (simulated)', 'Simulated');
  },

  prepare_intake_summary(session) {
    const m = session.memory || {};
    const lines = [];
    if (m.story) lines.push(`In your words: "${m.story}"`);
    if (m.topics?.length) lines.push(`Topics you mentioned: ${m.topics.join(', ')}`);
    if (m.history) lines.push(`Past care: ${m.history}`);
    if (m.payLabel) lines.push(`Paying with: ${m.payLabel}`);
    if (m.timesLabel) lines.push(`Times that work: ${m.timesLabel}`);
    if (m.questions?.length) lines.push(`Questions for your clinician: ${m.questions.map((q) => `"${q}"`).join('; ')}`);
    return ok({ text: lines.join('\n'), notice: 'AI-generated draft. Not a diagnosis. Your clinician reads it and makes every clinical decision.' },
      'Navigator (AI)', 'AI draft');
  },

  check_previsit_requirements(session, { payPath }) {
    const tasks = [
      { id: 'summary', title: 'Review your intake summary', owner: 'You', optional: false },
      { id: 'consent', title: 'Agree to treatment and telehealth consent', owner: 'You', optional: false },
      { id: 'records', title: 'Let Legion request records from past care', owner: 'You', optional: true },
      { id: 'device', title: 'Check your camera and microphone', owner: 'You', optional: false },
      { id: 'reminders', title: 'Reminders 24 hours and 1 hour before', owner: 'Legion', optional: false },
    ];
    if (payPath === 'insurance') tasks.splice(3, 0, { id: 'card', title: 'Add a photo of your insurance card', owner: 'You', optional: false });
    return ok({ tasks }, 'Care operations (simulated)', 'Simulated');
  },

  complete_previsit_task(session, { task }) {
    return ok({ task, done: true }, 'Care operations (simulated)', 'Simulated');
  },

  request_human_support(session, { reason }) {
    return ok({ ticket: 'HS-1042', reason, replyWithin: 'within 1 business hour' }, 'Support queue (simulated)', 'Estimate');
  },

  book_appointment(session, { holdId, slot, clinicianId, payPath }) {
    return ok({ id: 'B-2201', holdId, slot, clinicianId, payPath }, 'Scheduling (simulated)', 'Simulated');
  },

  save_payment_method(session, { method }) {
    return ok({ method, chargedToday: 0 }, 'Payments (simulated)', 'Simulated');
  },

  mark_first_visit_complete(session, { bookingId, clinicianConfirmed }) {
    if (!clinicianConfirmed) return fail('needs_clinician', 'EHR (simulated)', 'Unknown');
    const start = session.booking?.slot?.start;
    const days = start ? daysBetween(session.startedAt, start) : null;
    return ok({ bookingId, completed: true, daysSinceStart: days }, 'EHR (simulated)', 'Verified');
  },
};

const c = (inputs, label, confirm, failures, recovery) => ({ inputs, label, confirm, failures, recovery });
export const TOOL_CONTRACTS = {
  check_service_fit: c('state, adult (18+), concern topics, emergency signal', 'Verified against policy', null, 'missing input', 'Ask the one missing question'),
  explain_question: c('question id', 'Verified', null, 'unknown question', 'Generic explanation and a person'),
  get_payment_options: c('state, payment preference', 'Verified once Legion confirms prices', null, 'plan list unavailable', 'Show self-pay and "we\'ll check your plan"'),
  start_sign_in: c('email', 'Simulated (nothing sent; code is 123456)', 'send', 'invalid email, send failed', 'Retry, or continue for this session'),
  verify_sign_in_code: c('email, 6-digit code', 'Verified', null, 'wrong code, expired', 'Say it does not match; send a new code'),
  check_insurance_eligibility: c('insurer, member ID, legal name, birth date', 'Verified for coverage; Estimate for cost', 'send', 'not found, name mismatch, no response, inactive, carve-out, out of network', 'Fix and retry, verify by hand, self-pay, waitlist, or a person'),
  estimate_patient_cost: c('the coverage check on file, visit type', 'Estimate; To be verified for a carve-out', null, 'no check yet', 'Marked Unknown: book with verification pending, self-pay, or a person'),
  search_provider_availability: c('state, pay path, plan, time windows, topics', 'Verified at search time', null, 'nothing in window', 'Widen the window, waitlist, other pay path, a person'),
  recommend_provider: c('availability, preferences, provider profiles', 'Estimate (a recommendation)', null, 'no fit', 'Show everyone, ask one preference, a person'),
  hold_appointment: c('slot id', 'Verified', 'hold', 'slot taken', 'Next time with the same clinician, then alternatives'),
  save_patient_progress: c('session state, email', 'Verified', 'send', 'invalid email, send failed', 'Keep the session, retry, or a resume code'),
  prepare_intake_summary: c('confirmed answers, patient\'s own words', 'AI draft until the patient confirms', null, 'conflicting answers', 'Ask one clarifying question'),
  check_previsit_requirements: c('booking, pay path', 'Verified', null, 'unknown requirement', 'A person'),
  request_human_support: c('reason category, channel', 'Estimate for reply time', 'send', 'outside hours', '988 for safety; book a callback'),
  mark_first_visit_complete: c('booking id, clinician confirmation', 'Verified by the clinician', null, 'no-show', 'Same-day rebooking offer'),
  book_appointment: c('hold, slot, clinician, pay path', 'Verified', 'book', 'hold expired', 'Re-hold the same time or the next one'),
  save_payment_method: c('wallet or test card', 'Verified', 'pay', 'card declined', 'Try another method or a person'),
  complete_previsit_task: c('task id', 'Verified', 'per task', 'task unavailable', 'A person'),
};

const TASK_CONFIRM = { consent: 'consent', records: 'records', summary: 'share_summary' };
export function confirmActionFor(tool, input = {}) {
  if (tool === 'complete_previsit_task') return TASK_CONFIRM[input.task] || null;
  return TOOL_CONTRACTS[tool]?.confirm || null;
}
