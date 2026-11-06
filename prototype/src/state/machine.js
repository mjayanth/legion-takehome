// The shared state machine. Every workstream builds against this file.
import { CLINICIANS } from '../tools/data.js';

export const STAGES = ['welcome', 'understand', 'fit', 'signin', 'coverage', 'options', 'recommend', 'hold', 'cost', 'book', 'prepare', 'visit', 'done'];

export const PHASES = [
  { id: 'talk', label: "Tell us what's going on", owner: 'You', stages: ['welcome', 'understand', 'fit'] },
  { id: 'account', label: 'Sign up and check coverage', owner: 'You and Legion', stages: ['signin', 'coverage'] },
  { id: 'match', label: 'Find your clinician', owner: 'Legion', stages: ['options', 'recommend'] },
  { id: 'book', label: 'Hold and book a time', owner: 'You', stages: ['hold', 'cost', 'book'] },
  { id: 'prepare', label: 'Get ready and see your clinician', owner: 'You and your clinician', stages: ['prepare', 'visit', 'done'] },
];

// Tests that can be flipped in the reviewer panel. 'variant' = the new experience.
export const DEFAULT_VARIANTS = { 'T-01': 'variant', 'T-06': 'variant', 'T-09': 'variant', 'T-10': 'variant', 'T-12': 'variant', 'T-14': 'variant', 'T-15': 'control', 'T-16': 'variant' };

export const stageIndex = (s) => STAGES.indexOf(s);
// D-22: sign-up comes right after the fit checks, so identifiers are allowed from signin on.
export const identifiersAllowed = (stage) => stageIndex(stage) >= stageIndex('signin');
export const phaseOf = (stage) => PHASES.find((p) => p.stages.includes(stage));

export function createSession({ persona = null, variants = {}, now = new Date() } = {}) {
  return {
    now,
    startedAt: now,
    persona,
    flags: { ...(persona?.flags || {}) },
    variants: { ...DEFAULT_VARIANTS, ...variants },
    stage: 'welcome',
    memory: {},
    timeline: [],
    events: [],
    taken: [],
    clinicians: JSON.parse(JSON.stringify(CLINICIANS)),
    trace: null,
  };
}
