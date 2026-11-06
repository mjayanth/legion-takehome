// P-CLINICAL: the navigator never diagnoses or advises on medication.
import { normalize } from './safe.js';

const MEDS = ['lexapro', 'escitalopram', 'zoloft', 'sertraline', 'prozac', 'fluoxetine', 'wellbutrin', 'bupropion',
  'xanax', 'alprazolam', 'adderall', 'ritalin', 'lithium', 'seroquel', 'trazodone', 'klonopin', 'ativan', 'buspirone', 'effexor', 'abilify'];
const CONDITIONS = 'bipolar|depress(ed|ion)?|adhd|add|ocd|ptsd|anxiety disorder|schizo\\w*|borderline|autistic|autism|a disorder|something wrong';

const DIAGNOSIS = new RegExp(`\\b(do|could|might) i (have|be) (${CONDITIONS})|\\bam i (${CONDITIONS})|\\b(can|could|would) you diagnose|\\bdiagnose me\\b|\\bwhat do i have\\b|\\bwhat'?s wrong with me\\b`);
const MED_ASK = /\b(should|can|could) i (take|try|start|stop|go back on|get|switch)|\bdos(e|age)\b|\bhow (much|many) (mg|milligrams)\b|\bmedication should\b|\bwhich (med|medication|pill)s?\b/;

export const CLINICAL_REFUSAL =
  "I can't tell you whether you have a condition or which medication is right for you. That's for your clinician to decide with you at your visit. Want me to add this question to your summary so it gets answered?";

export function classifyClinical(text) {
  const t = normalize(text);
  if (!t) return null;
  const asks = /\?/.test(String(text)) || /\b(should|can|could|is|are|would|better|safe|dose|dosage|switch|start|stop|try)\b/.test(t);
  if (MED_ASK.test(t) || (MEDS.some((m) => t.includes(m)) && asks && !/\b(used to|was on|took|tried)\b/.test(t))) return 'medication';
  if (DIAGNOSIS.test(t)) return 'diagnosis';
  return null;
}
