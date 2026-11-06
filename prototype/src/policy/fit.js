// P-FIT: published, deterministic service-fit rules. The treated and
// out-of-scope lists are PLACEHOLDERS for Legion's clinical team.

export const TREATED = ['anxiety', 'depression', 'sleep', 'adhd', 'stress', 'trauma', 'medication', 'mood', 'unsure'];
export const NEEDS_PERSON = ['detox', 'inpatient', 'eating'];

export const FIT_RULES = {
  'FIT-STATE': 'This prototype covers Texas only. Legion also treats people in Utah. Clinicians can only treat people in states where they are licensed, so this is a licensing rule, not a judgment about you.',
  'FIT-AGE': 'Legion only treats adults, 18 and older, for now.',
  'FIT-SCOPE': 'What you described may need a kind of care Legion does not offer online. A person on our team can help you find the right place.',
  'FIT-EMERGENCY': 'This sounds like it needs help right away, not an appointment.',
  'FIT-OK': 'You live in Texas, you are 18 or older, and Legion treats what you described.',
};

export function checkFitRules({ state, adult, concerns = [], emergency = false } = {}) {
  if (!state) return { fit: 'missing', ruleId: 'FIT-MISSING-state', reason: 'Which state do you live in?' };
  if (emergency) return { fit: 'person', ruleId: 'FIT-EMERGENCY', reason: FIT_RULES['FIT-EMERGENCY'] };
  if (state !== 'TX') return { fit: 'no', ruleId: 'FIT-STATE', reason: FIT_RULES['FIT-STATE'] };
  if (adult === undefined || adult === null) return { fit: 'missing', ruleId: 'FIT-MISSING-age', reason: 'Are you 18 or older?' };
  if (!adult) return { fit: 'no', ruleId: 'FIT-AGE', reason: FIT_RULES['FIT-AGE'] };
  if (concerns.some((c) => NEEDS_PERSON.includes(c))) return { fit: 'person', ruleId: 'FIT-SCOPE', reason: FIT_RULES['FIT-SCOPE'] };
  return { fit: 'yes', ruleId: 'FIT-OK', reason: FIT_RULES['FIT-OK'] };
}
