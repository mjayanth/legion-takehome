// P-CONFIRM: actions that always need the patient's explicit yes.
export const CONFIRM_ACTIONS = ['hold', 'book', 'pay', 'consent', 'records', 'send', 'share_summary'];

export function needsConfirmation(action) {
  return CONFIRM_ACTIONS.includes(action);
}
