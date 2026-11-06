// Turns the patient's own words into matching topics. Topics are everyday
// words used for matching, never diagnoses.
const RULES = [
  ['anxiety', /\b(anxi\w*|worr\w*|panic\w*|nervous|on edge|overthink\w*)/],
  ['sleep', /\b(sleep\w*|insomnia|awake at night|can'?t rest)/],
  ['depression', /\b(depress\w*|down|sad|hopeless|low mood|empty|numb)\b/],
  ['medication', /\b(medication|meds|restart\w*|refill\w*|prescription)/],
  ['adhd', /\b(adhd|focus|attention|distract\w*)/],
  ['stress', /\b(stress\w*|overwhelm\w*|burn(ed|t)? ?out)/],
  ['trauma', /\b(trauma\w*|ptsd|flashback\w*|nightmare\w*)/],
  ['detox', /\b(detox|withdrawal)/],
  ['eating', /\b(eating disorder|binge\w*|purg\w*)/],
];

const WORDS = { anxiety: 'worry', sleep: 'sleep', depression: 'low mood', medication: 'medication', adhd: 'focus',
  stress: 'stress', trauma: 'past trauma', detox: 'substance use', eating: 'eating', unsure: 'not sure yet' };

export function extractConcerns(text) {
  const t = String(text || '').toLowerCase();
  const found = RULES.filter(([, re]) => re.test(t)).map(([k]) => k);
  return found.length ? found : ['unsure'];
}

export const topicWords = (keys) => keys.map((k) => WORDS[k] || k);
