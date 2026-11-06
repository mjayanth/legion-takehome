// Synthetic data for the prototype. Every name, plan and clinician is made up.

export const SELF_PAY_PRICE = 250; // assumption, shown as "To be verified"

export const PLANS = [
  { id: 'lonestar', name: 'Lone Star Health PPO', copay: 30, basis: 'specialist copay' },
  { id: 'bluebonnet', name: 'Bluebonnet Choice EPO', copay: 45, basis: 'specialist copay' },
  { id: 'gulfcoast', name: 'Gulf Coast HMO', copay: 20, basis: 'specialist copay', firstOpeningDay: 16 },
];

export const TYPICAL_INSURED_RANGE = { low: 20, high: 45 };

// focus: concern -> confidence (1 to 3), self-reported then calibrated by a clinical lead.
export const CLINICIANS = [
  { id: 'ruiz', name: 'Elena Ruiz', creds: 'PMHNP', title: 'Psychiatric nurse practitioner', focus: { anxiety: 3, stress: 2 },
    languages: ['English', 'Spanish'], gender: 'woman', style: 'gentle', affirming: true,
    plans: ['lonestar', 'bluebonnet', 'gulfcoast'], windows: ['evening'], seed: 1 },
  { id: 'cho', name: 'Sarah Cho', creds: 'MD', title: 'Psychiatrist', focus: { anxiety: 3, depression: 2, sleep: 2 },
    languages: ['English', 'Korean'], gender: 'woman', style: 'direct', affirming: false,
    plans: ['lonestar'], windows: ['morning', 'afternoon'], seed: 2 },
  { id: 'lee', name: 'Marcus Lee', creds: 'MD', title: 'Psychiatrist', focus: { depression: 3, medication: 3, mood: 2 },
    languages: ['English'], gender: 'man', style: 'direct', affirming: false,
    plans: ['lonestar', 'gulfcoast'], windows: ['morning', 'afternoon'], seed: 0 },
  { id: 'khan', name: 'Aisha Khan', creds: 'MD', title: 'Psychiatrist', focus: { adhd: 3, anxiety: 2 },
    languages: ['English', 'Urdu'], gender: 'woman', style: 'direct', affirming: false,
    plans: ['lonestar', 'bluebonnet'], windows: ['morning', 'evening'], seed: 2 },
  { id: 'pierce', name: 'Jordan Pierce', creds: 'PMHNP', title: 'Psychiatric nurse practitioner', focus: { depression: 3, trauma: 3, stress: 2 },
    languages: ['English'], gender: 'nonbinary', style: 'gentle', affirming: true,
    plans: ['bluebonnet', 'gulfcoast'], windows: ['evening', 'weekend'], seed: 1 },
];

export const WINDOW_TIMES = { morning: '09:30', afternoon: '14:00', evening: '18:00', weekend: '10:00' };

const DAY = 864e5;
const OFFSET = '-06:00'; // Central time in November

export function centralDate(now) {
  return new Date(now.getTime() - 6 * 3600e3).toISOString().slice(0, 10);
}

function addDays(isoDate, n) {
  return new Date(Date.parse(isoDate + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);
}

function weekday(isoDate) {
  return new Date(isoDate + 'T00:00:00Z').getUTCDay(); // 0 Sun ... 6 Sat
}

// Deterministic slots for one clinician over the next `days` days.
export function slotsFor(clinician, now, days = 30) {
  const start = centralDate(now);
  const out = [];
  for (let d = 1; d <= days; d++) {
    if ((d + clinician.seed) % 3 !== 0 && (d + clinician.seed) % 5 !== 0) continue;
    const date = addDays(start, d);
    const wd = weekday(date);
    for (const w of clinician.windows) {
      const isWeekend = wd === 0 || wd === 6;
      if (w === 'weekend' ? wd !== 6 : isWeekend) continue;
      const startIso = `${date}T${WINDOW_TIMES[w]}:00${OFFSET}`;
      out.push({ id: `${clinician.id}@${date}T${WINDOW_TIMES[w]}`, clinicianId: clinician.id, start: startIso, window: w, dayOffset: d });
    }
  }
  return out;
}

export function daysBetween(fromDate, toIso) {
  return Math.floor((Date.parse(toIso) - fromDate.getTime()) / DAY);
}
