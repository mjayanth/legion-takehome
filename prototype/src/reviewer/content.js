// Reviewer content: what each screen fixes, the evidence, and how we test it.
// Sources: Observations v2, Friction Hypotheses and Experiments v2, PRD v2.

export const FRICTION = {
  'FP-01': { where: 'Marketing site', was: 'Entry button says "Book Appointment Now" and never asks what is going on; top-rated specialists all show no availability.', numbers: 'Not measured' },
  'FP-02': { where: 'Care flow: email and code', was: 'An account and a code come before any question about care.', quote: 'Sign up before you even know what I\'m looking for.', numbers: 'Not measured' },
  'FP-03': { where: 'Care flow: email and code', was: 'A returning email jumps past intake straight to Find a provider.', numbers: 'Not measured' },
  'FP-04': { where: 'Care flow: plan; portal: insurance', was: 'Plan picked from logos; "we accept your plan, $0 to $40" with no real check.', quote: 'What is the scope? Is this based off of my plan?', numbers: 'Insurance to needs: 7.3% of sessions lost (243)' },
  'FP-05': { where: 'Care flow: name, phone, address', was: 'Birth date defaults to 1996; an address with a mismatched city and ZIP saves without a check.', numbers: 'Not measured' },
  'FP-06': { where: 'Care flow: reasons; portal: conditions', was: 'Intake asks the patient to pick diagnostic labels, with no plain-language path.', quote: 'I don\'t know these terminologies. I just want to talk to some psychiatrist.', numbers: 'Fit check to conditions: 34.8% of sessions lost (1,912), the largest drop' },
  'FP-07': { where: 'Care flow: free text', was: 'A typed suicide disclosure after a "No" on the safety question got no follow-up.', numbers: 'Safety, not conversion' },
  'FP-08': { where: 'Portal: conditions and needs', was: 'The same questions are asked twice; "diagnosed or new" exists in one flow only.', quote: 'I\'m the same account, I don\'t know why you\'re asking me again.', numbers: 'Repeat starts inflate session counts' },
  'FP-09': { where: 'Care flow: find a provider; portal: match', was: '"Perfect match found" with no reason to choose anyone and no filters.', quote: 'Perfect match found, how? On what basis?', numbers: 'Match to provider selected: 36.6% of sessions lost (1,104)' },
  'FP-10': { where: 'Portal: match', was: 'Insured patients find every clinician fully booked, and the next step is a phone number.', quote: 'If everybody\'s booked, why am I here?', numbers: 'Same 36.6% drop' },
  'FP-11': { where: 'Care flow: find a provider', was: 'Changing insurance as a self-pay patient needs a phone call.', quote: 'So now I have to make a call.', numbers: 'Not measured' },
  'FP-12': { where: 'Care flow: confirm and card', was: '$250 shown with no breakdown and no charge date; manual card entry.', quote: 'I don\'t know what I\'m paying for, when I\'m gonna be paid.', numbers: 'Patient details to account: 20.4% lost (360); payment success not tracked' },
  'FP-13': { where: 'Care flow: confirm and card', was: 'The visit itself is not explained until the confirm screen.', quote: 'I don\'t know what I get out of this platform.', numbers: 'Show rate not tracked' },
};

export const GOALS = {
  G1: 'Understand before asking', G2: 'Establish fit early and compassionately', G3: 'Deliver value before collecting details',
  G4: 'Build and keep a personalized plan', G5: 'Act for the patient, with permission', G6: 'Explain every recommendation',
  G7: 'Remember without being invasive', G8: 'Recognize uncertainty and recover', G9: 'Keep clinical authority and safety boundaries clear',
  G10: 'Continue until the first visit is done',
  M01: 'AI is always labelled', M02: 'Confirm before consequential actions', M03: 'Every figure carries a label', M04: 'Insurance and self-pay as equals',
  M05: 'Self-pay $250, to be verified', M06: 'No fake urgency, hidden costs or forced accounts', M07: 'A person one tap away', M08: 'Activity timeline',
};

// Power figures: 28 days at about 197 portal sessions a day, 80% power, 5% two-sided (Hypotheses v2).
export const TESTS = {
  'T-01': { name: 'Entry question', hypothesis: 'H-01', control: 'Today: "Check coverage", then a state picker, then "Create your account"', variant: '"Get started" or "Book an appointment" opens "In your own words, what can we help with?", no account', metric: 'Visitors who finish the first question', power: 'Needs marketing-site traffic, not in the brief', flippable: true },
  'T-02': { name: 'When to ask for an account', hypothesis: 'H-02', control: 'Account and code first', variant: 'Email asked only after a time is held, with the reason stated', metric: 'Starts that reach a held time', power: 'Needs care-flow tracking (F-20)' },
  'T-04': { name: 'Coverage check', hypothesis: 'H-04', control: 'Logo pick and "$0 to $40"', variant: 'Member ID with permission, labelled estimate, recovery if unknown', metric: 'Insured starts that book', power: 'Guardrail: a 2.6-point change in the insurance step is detectable (92.7% today)' },
  'T-06': { name: 'Plain words vs diagnostic labels', hypothesis: 'H-06', control: 'Pick from diagnostic chips', variant: 'Tell the navigator in your own words', metric: 'Reached fit', power: '4.6 points on 65.2% (7% relative) with three arms', flippable: true },
  'T-08': { name: 'Ask once', hypothesis: 'H-08', control: 'Questions asked again in each flow', variant: '"What I remember" reused and editable', metric: 'Returning sessions that book', power: 'Needs returning-session volume' },
  'T-09': { name: 'One recommendation with reasons', hypothesis: 'H-09', control: 'Long list sorted by soonest opening, no reasons', variant: 'One clinician and time with reasons, two alternatives, a closer-match option', metric: 'Recommendation accepted', power: '5.1 points on 63.4% (8% relative)', flippable: true },
  'T-10': { name: 'No openings', hypothesis: 'H-10', control: '"All providers are unavailable. Please call."', variant: 'Widen the window, waitlist that holds the first opening, self-pay shown neutrally, a person', metric: 'No-slot sessions that book within 14 days', power: 'Needs the share of sessions with no open slot', flippable: true },
  'T-12': { name: 'Self-pay payment', hypothesis: 'H-12', control: 'Plain card form showing $250', variant: 'What it covers, when it is charged, cancel rule, one-tap wallets', metric: 'Self-pay bookings confirmed', power: '5.6 points on the 79.6% account step as a proxy', flippable: true },
  'T-13': { name: 'Explain the visit early', hypothesis: 'H-13', control: 'Visit explained at the confirm screen', variant: 'Visit explained with the options, before anything is asked', metric: 'Show rate at visit 1', power: 'Needs visit-completed tracking' },
  'T-14': { name: 'Closer-match offer', hypothesis: 'H-09', control: 'No preference questions', variant: '"Want a closer match?" under the recommendation, two minutes, skippable', metric: 'Recommendation accepted', power: 'Run after T-09', flippable: true },
  'T-15': { name: 'Free first 5 minutes', hypothesis: 'H-12', control: '$250 (to be verified), charged after the visit', variant: 'First 5 minutes free; charged only if the patient continues', metric: 'Self-pay visits completed; refunds and chargebacks as guardrails', power: 'Needs operations and finance sign-off', flippable: true },
  'T-16': { name: 'Care plan from the start', hypothesis: 'H-13', control: 'Plan shown only after booking', variant: 'Plan visible from fit onward, updated after every action', metric: 'Pre-visit tasks done, then first visits completed', power: 'New in PRD v2', flippable: true },
  'T-17': { name: 'When to sign up', hypothesis: 'H-02', control: 'Account created after the patient holds a time', variant: 'Email and code right after the fit checks (PRD v3)', metric: 'Bookings, with drop at sign-up as a guardrail', power: 'New in PRD v3' },
  'T-18': { name: 'When to check coverage', hypothesis: 'H-04', control: 'Coverage checked after the hold', variant: 'One insurance screen and a check before matching (PRD v3)', metric: 'Recommendation accepted, then insured bookings', power: 'New in PRD v3' },
};

export const REVIEWER = {
  welcome: {
    title: 'Start with what the patient needs, not an account',
    friction: ['FP-01', 'FP-02'],
    change: '"Get started" and "Book an appointment" both open one question with an answer box: in your own words, what can we help with? The navigator says it is an AI and that a clinician makes every clinical decision. No sign-up, no email, no state picker first.',
    agent: 'No tool yet. Every word typed anywhere passes P-SAFE and P-CLINICAL before the navigator replies.',
    tests: ['T-01', 'T-02'], goals: ['G1', 'G3', 'M01', 'M06', 'M07'],
  },
  understand: {
    title: 'Five basics, one at a time, each with a why',
    friction: ['FP-05', 'FP-06', 'FP-07', 'FP-08'],
    change: 'Own words instead of diagnostic labels. Safety questions right after the first answer, with P-SAFE reading every line after that. "Are you 18 or older?" instead of a date of birth. Every answer lands in "What I remember", editable, never asked again.',
    agent: 'explain_question answers every "Why we ask". P-SAFE runs on each answer.',
    tests: ['T-06', 'T-08'], goals: ['G1', 'G7', 'G9'],
    note: 'Safety questions and routing are never A/B tested (D-07). Only wording and placement are.',
  },
  fit: {
    title: 'Fit decided by published rules, with a kind way out',
    friction: [],
    change: 'check_service_fit applies P-FIT and shows the rule that decided. Not a fit gets a reason, next places to go, a copy of their own words, and keep-in-touch with separate consent. A fit gets a care plan.',
    agent: 'check_service_fit (Verified against policy).',
    tests: ['T-16'], goals: ['G2', 'G4', 'M07'],
  },
  signin: {
    title: 'Sign up once we know we can help',
    friction: ['FP-02', 'FP-03'],
    change: 'After the fit checks pass, one email field and a 6-digit code. No password. Returning patients sign in on the same screen and pick up where they left off. Today "Create your account" is the second screen, before the patient has said anything.',
    agent: 'start_sign_in and verify_sign_in_code (simulated: the code is always 123456 and nothing is sent).',
    tests: ['T-17'], goals: ['G5', 'G7', 'M06'],
  },
  coverage: {
    title: 'One insurance screen, checked before matching',
    friction: ['FP-04', 'FP-11'],
    change: 'Insurance and self-pay shown as equals. Insured patients give insurer, name, birth date and member ID on one screen (or scan the card), see exactly what is shared, and the check runs on one tap. Failures keep them moving: fix and retry, verify by hand, self-pay, or the waitlist.',
    agent: 'get_payment_options, then check_insurance_eligibility behind P-CONFIRM because it sends information. Network status comes from Legion\'s contract list.',
    tests: ['T-18'], goals: ['G3', 'G5', 'G8', 'M03', 'M04', 'M05'],
  },
  options: {
    title: 'Matches now, or a closer match',
    friction: ['FP-09', 'FP-13'],
    change: 'With coverage known, the patient picks: three matches right away, or a few questions (times, then preferences) for a closer match. The coverage result sits on top in one line.',
    agent: 'search_provider_availability on the checked plan.',
    tests: ['T-13', 'T-14'], goals: ['G3', 'G6', 'M03'],
  },
  recommend: {
    title: 'One recommendation, with the reasons',
    friction: ['FP-09', 'FP-10', 'FP-11'],
    change: 'One clinician and one time, each reason tied to something the patient said, two alternatives a tap away, and an optional closer match. Wrong time: one question, a new search. Nothing open: widen, waitlist, the other payment path shown neutrally, or a person.',
    agent: 'recommend_provider ranks clinicians on topics, network, times and preferences from provider profiles (F-30, simulated).',
    tests: ['T-09', 'T-10', 'T-14'], goals: ['G6', 'G8', 'M04'],
  },
  hold: {
    title: 'Hold the time, with no countdown',
    friction: ['FP-10'],
    change: 'The patient confirms the hold. The account already exists, so nothing new is asked here.',
    agent: 'hold_appointment, behind P-CONFIRM.',
    tests: ['T-02'], goals: ['G5', 'M02', 'M06'],
  },
  cost: {
    title: 'The cost for this visit, or an honest "unknown"',
    friction: ['FP-04', 'FP-11'],
    change: 'The cost for the held visit comes from the coverage check the patient already agreed to. Nothing new is sent. If coverage is unknown, we say so, never guess, and offer three ways forward. Switching to self-pay takes one tap.',
    agent: 'estimate_patient_cost, using the earlier check.',
    tests: ['T-04'], goals: ['G5', 'G8', 'M03'],
  },
  book: {
    title: 'Book with nothing hidden',
    friction: ['FP-12'],
    change: 'One summary card: who, when, format, cost with its label, when it is charged, the cancel rule. The booking and any payment are confirmed separately. Insured patients have no payment step.',
    agent: 'book_appointment and save_payment_method, each behind P-CONFIRM.',
    tests: ['T-12', 'T-15'], goals: ['G5', 'M02', 'M05', 'M06'],
  },
  prepare: {
    title: 'The navigator keeps working after booking',
    friction: ['FP-08', 'FP-13'],
    change: 'A checklist with owners: review the intake summary (AI draft, not a diagnosis), consent, records (optional), insurance card, device check, reminders. Consent, records and sharing the summary each need a yes.',
    agent: 'check_previsit_requirements, prepare_intake_summary, complete_previsit_task.',
    tests: ['T-08', 'T-13'], goals: ['G9', 'G10', 'M02'],
  },
  visit: {
    title: 'Get them to the visit',
    friction: ['FP-13'],
    change: 'Join from the plan at the time. For self-pay in the T-15 variant, the clinician checks in at minute 5. The clinician, not the app, confirms the visit happened.',
    agent: 'mark_first_visit_complete, fired only on the clinician\'s confirmation.',
    tests: ['T-15'], goals: ['G10'],
  },
  done: {
    title: 'The north star: first visit completed',
    friction: [],
    change: 'Onboarding ends when the first visit is completed, not booked. Today PostHog stops at the payment page and counts sessions, so this event does not exist yet (F-20).',
    agent: 'visit_completed fires with days since start.',
    tests: [], goals: ['G10'],
  },
};
