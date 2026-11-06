import { redact } from './redact.js';

// Stores only redacted props. `raw` stays in this browser tab for the reviewer's
// before-and-after view; it is never stored or sent anywhere.
export function emit(session, name, props = {}) {
  const e = { name, t: new Date().toISOString(), stage: session.stage, props: redact(props), raw: props };
  session.events.push(e);
  session.onEvent?.(e);
  return e;
}
