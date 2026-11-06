// "Why we ask" content for every question (explain_question).
export const EXPLAIN = {
  story: { why: 'Your own words tell your clinician more than a checklist. They also help us find someone who works with what you are going through.', who: 'Your clinician, and our care team if you need help booking.', required: true },
  safety: { why: 'We ask everyone. If you are not safe right now, we want to get you help today, not at a visit next week.', who: 'Our clinical team, only if you need support today.', required: true },
  state: { why: 'Clinicians can only treat people in states where they are licensed. Legion is licensed in Texas.', who: 'Used only to check fit.', required: true },
  adult: { why: 'Legion treats adults for now. We do not need your date of birth yet.', who: 'Used only to check fit.', required: true },
  pay: { why: 'So we only show clinicians you can actually book, at a price you know.', who: 'Used to search appointments.', required: true },
  plan: { why: 'Plan name only, so we can show clinicians in your network. No member ID yet.', who: 'Used to search appointments.', required: true },
  times: { why: 'So the first time we suggest is one you can actually make.', who: 'Used to search appointments.', required: true },
  signin: { why: 'So your progress is saved and you can come back to it, and so we can send your appointment details. We will not use it for marketing.', who: 'Legion only.', required: true },
  insurance: { why: 'Your insurer needs your name and birth date exactly as on the plan, plus your member ID, to tell us whether you are covered and what a visit costs. We only send them when you tap Check.', who: 'Your insurer, through a secure check. Legion keeps the result, not your full member ID.', required: false },
  email: { why: 'To send your confirmation and a link to come back to this exact spot. We will not use it for marketing.', who: 'Legion only.', required: true },
  memberId: { why: 'Your plan needs it to tell us what your visit will cost you. We only send it when you say so.', who: 'Your insurance plan, through a secure check.', required: false },
  prefs: { why: 'Optional. It helps us find someone you will feel comfortable with. Skip anything you like.', who: 'Used only for matching.', required: false },
};
