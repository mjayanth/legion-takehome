// P-SAFE: deterministic safety policy. Runs on every answer and every line of
// free text, separately from the navigator. The phrase list is a PLACEHOLDER
// written for testing; Legion's clinical team owns and replaces it.

export const SAFE_RULES = [
  { id: 'SAFE-SUICIDE', pattern: /\bsu+i?c+i+d(e|al)?|\bsuicid|\bsucid|\bsuiside/ },
  { id: 'SAFE-KILL-SELF', pattern: /\bkill(ing)? ?(my|me|him|her)? ?self\b|\bkill myself\b|\bkill me\b/ },
  { id: 'SAFE-END-LIFE', pattern: /\bend(ing)? (my|it all|my own) ?(life)?\b|\btake my (own )?life\b/ },
  { id: 'SAFE-WANT-DIE', pattern: /\bwant(ed)? to die\b|\bwish i (was|were) dead\b|\bbetter off dead\b/ },
  { id: 'SAFE-NOT-HERE', pattern: /\b(not|don'?t|do not|dont) (want(ing)? )?to be here\b|\bnot wanting to be here\b|\bno reason to live\b/ },
  { id: 'SAFE-SELF-HARM', pattern: /\bself[- ]?harm|\bhurt(ing)? myself\b|\bcut(ting)? myself\b/ },
];

export function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// answer: response to the standard safety question ('yes' | 'no' | 'unsure').
export function evaluateSafety({ text, answer } = {}) {
  if (answer === 'yes') return { route: true, ruleId: 'SAFE-QUESTION-YES' };
  if (text) {
    const t = normalize(text);
    for (const rule of SAFE_RULES) {
      if (rule.pattern.test(t)) return { route: true, ruleId: rule.id };
    }
  }
  return { route: false, ruleId: null };
}
