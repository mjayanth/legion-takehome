// Allowlist redaction: only known category keys with short primitive values survive.
// Anything else (names, contact, birth dates, member IDs, addresses, free text) is dropped.
export const ALLOWED_KEYS = new Set(['stage', 'tool', 'label', 'ok', 'error', 'action', 'result', 'ruleId', 'outcome', 'variant', 'test',
  'path', 'payPath', 'window', 'windows', 'count', 'reasonCategory', 'questionId', 'explained', 'rank', 'task', 'method',
  'daysSinceStart', 'field', 'category', 'channel', 'fit', 'horizonDays', 'preference', 'topics', 'edited', 'persona']);

const safeValue = (v) => {
  if (v === null || typeof v === 'boolean' || typeof v === 'number') return true;
  if (typeof v === 'string') return v.length <= 40 && !/@|\d{5,}/.test(v);
  if (Array.isArray(v)) return v.length <= 10 && v.every((x) => typeof x === 'string' && safeValue(x));
  return false;
};

export function redact(props = {}) {
  const out = {};
  for (const [k, v] of Object.entries(props)) if (ALLOWED_KEYS.has(k) && safeValue(v)) out[k] = v;
  return out;
}
