// The agent operating loop: observe, plan, explain, confirm, act, report, continue or escalate.
// One bounded tool call per act(); P-CONFIRM is enforced here, not in the UI.
import { TOOLS, confirmActionFor } from '../tools/index.js';
import { needsConfirmation } from '../policy/confirm.js';
import { emit } from '../events/log.js';

const clock = () => new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

export function act(session, tool, input = {}, { confirmed = false, reason = '', observe = '' } = {}) {
  const action = confirmActionFor(tool, input);
  const gated = action && needsConfirmation(action);
  session.trace = {
    observe: observe || 'What the patient has told us so far',
    plan: `Call ${tool}`,
    explain: reason || '',
    confirm: gated ? (confirmed ? 'You confirmed' : 'Waiting for your yes') : 'Not needed for this action',
    act: null,
    report: null,
    next: null,
  };
  if (gated && !confirmed) {
    emit(session, 'confirmation_requested', { action, tool });
    return { ok: false, error: 'needs_confirmation', action };
  }
  if (gated) emit(session, 'confirmation_given', { action, tool });
  const result = TOOLS[tool](session, input);
  session.trace.act = tool;
  session.trace.report = `${result.ok ? 'OK' : `Failed: ${result.error}`} · ${result.label} · source: ${result.source}`;
  session.trace.next = result.ok ? 'Update the plan and continue' : 'Offer a recovery path or a person';
  session.timeline.push({ time: clock(), tool, text: reason || tool, label: result.label, ok: result.ok, error: result.error, confirmed: gated ? true : null });
  emit(session, 'tool_called', { tool, label: result.label, ok: result.ok, error: result.error });
  return result;
}

export function decline(session, action) {
  emit(session, 'confirmation_declined', { action });
  session.timeline.push({ time: clock(), tool: null, text: 'You said not yet. Nothing was done.', label: null, ok: true, error: null, confirmed: false });
}

export function note(session, text, label = null) {
  session.timeline.push({ time: clock(), tool: null, text, label, ok: true, error: null, confirmed: null });
}
