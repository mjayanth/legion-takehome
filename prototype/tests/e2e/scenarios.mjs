// End-to-end evaluation scenarios E-1 to E-19 against the built index.html.
// Usage: node tests/e2e/scenarios.mjs [E-1 E-9 ...]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright'); // pre-installed globally
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const PAGE_URL = process.env.PAGE_URL || ('file://' + path.join(ROOT, 'index.html'));
const AXE = fs.readFileSync(path.join(ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8');

const T = (id) => `[data-testid="${id}"]`;
const results = [];
const axeIssues = new Map();

async function open(browser, width, colorScheme = 'light') {
  const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme });
  page.errors = [];
  page.on('console', (m) => m.type() === 'error' && page.errors.push(m.text()));
  page.on('pageerror', (e) => page.errors.push(String(e)));
  await page.goto(PAGE_URL);
  return page;
}

async function start(page, id) {
  await page.evaluate((sid) => window.__proto.start(sid), id);
  await page.waitForSelector('[data-testid^="card-"]');
}

const snap = (page) => page.evaluate(() => window.__proto.snapshot());
const stage = async (page) => (await snap(page)).stage;
const visible = (page, id) => page.locator(T(id)).first().isVisible().catch(() => false);

async function axe(page, label) {
  await page.evaluate(AXE);
  const r = await page.evaluate(async () => {
    const res = await window.axe.run(document, { resultTypes: ['violations'] });
    return res.violations.filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => `${v.id}: ${v.nodes[0]?.target}`);
  });
  for (const v of r) axeIssues.set(v, label);
}

// Click the persona's answer if offered, else the card's primary action.
async function step(page) {
  const persona = page.locator(T('persona-answer'));
  if (await persona.count()) { await persona.last().click(); return true; }
  const primary = page.locator('[data-primary]:visible');
  if (await primary.count()) { await primary.last().click(); return true; }
  return false;
}

async function advanceUntil(page, done, { max = 80, axeEachStage = false } = {}) {
  let last = '';
  for (let i = 0; i < max; i++) {
    if (await done()) return;
    const s = await stage(page);
    if (axeEachStage && s !== last) { await axe(page, s); last = s; }
    if (!(await step(page))) throw new Error(`stuck at stage ${s}`);
    await page.waitForTimeout(30);
  }
  throw new Error(`did not finish in ${max} steps (stage ${await stage(page)})`);
}

const confirmed = (s, action) => s.events.some((e) => e.name === 'confirmation_given' && e.props.action === action);
// No email, member ID, name, birth date or the patient's words in any event (M-11, R-20).
const noPersonalData = (s) => s.events.every((e) => !/@|TEST-|LSH|BCE|Ortiz|1997|I've|worr/.test(JSON.stringify(e.props)));
const used = (s, tool) => s.events.some((e) => e.name === 'tool_called' && e.props.tool === tool);
const text = (page, id) => page.locator(T(id)).innerText();

const SCENARIOS = {
  'E-1': async (page) => {
    await advanceUntil(page, async () => (await stage(page)) === 'visit', { axeEachStage: true });
    const s = await snap(page);
    for (const a of ['hold', 'send', 'book', 'consent', 'share_summary']) if (!confirmed(s, a)) throw new Error(`no confirmation for ${a}`);
    if (s.events.filter((e) => e.name === 'previsit_task_done').length < 4) throw new Error('pre-visit tasks not done');
    if (!noPersonalData(s)) throw new Error('personal data in events');
    if (s.timeline.filter((x) => x.tool).length < 8) throw new Error('timeline too short');
    const order = s.events.map((e) => e.name);
    if (!(order.indexOf('fit_decided') < order.indexOf('sign_in_started') && order.indexOf('sign_in_verified') < order.indexOf('eligibility_checked') && order.indexOf('eligibility_checked') < order.indexOf('match_path_chosen'))) throw new Error('order is not fit, sign-in, coverage, matches');
    if (!used(s, 'check_insurance_eligibility')) throw new Error('no coverage check');
  },
  'E-2': async (page) => {
    await advanceUntil(page, () => visible(page, 'card-pay'));
    const txt = (await text(page, 'card-pay')).toLowerCase();
    for (const w of ['insurance', 'pay myself', '$250', 'to be verified']) if (!txt.includes(w)) throw new Error(`payment choice missing ${w}`);
    await advanceUntil(page, async () => (await stage(page)) === 'prepare');
    const s = await snap(page);
    if (used(s, 'check_insurance_eligibility') || used(s, 'estimate_patient_cost')) throw new Error('insurance check run for self-pay');
    if (s.events.some((e) => e.name === 'insurance_entered')) throw new Error('insurance screen shown to self-pay');
    if (!confirmed(s, 'pay')) throw new Error('payment not confirmed');
  },
  'E-3': async (page) => {
    await advanceUntil(page, () => visible(page, 'card-coverage-unknown'));
    const txt = await page.locator(T('card-coverage-unknown')).innerText();
    if (/\$(?!250\b)\d/.test(txt)) throw new Error('a coverage price was shown when coverage is unknown'); // $250 is the self-pay option, not a coverage figure
    if (!/unknown/i.test(txt)) throw new Error('missing Unknown label');
    await page.click(T('btn-book-pending'));
    await page.waitForSelector(T('card-matchpath'));
    if (!/confirm/i.test(await text(page, 'card-matchpath'))) throw new Error('match screen does not say coverage will be confirmed');
    await advanceUntil(page, async () => (await stage(page)) === 'prepare');
    if (await visible(page, 'card-coverage-unknown')) throw new Error('asked about unknown coverage twice');
  },
  'E-4': async (page) => {
    await advanceUntil(page, () => visible(page, 'card-matchpath'));
    await page.click(T('btn-personalize'));
    await advanceUntil(page, () => visible(page, 'card-recommend'));
    const first = (await snap(page)).rec.slot.window;
    await page.click(T('btn-other-times'));
    await page.click(T('opt-evening'));
    await page.click(T('submit-times2'));
    await page.waitForSelector(T('card-recommend'));
    const s = await snap(page);
    if (first === 'evening' || s.rec.slot.window !== 'evening') throw new Error(`not adjusted: ${first} -> ${s.rec.slot.window}`);
  },
  'E-5': async (page) => {
    await advanceUntil(page, () => visible(page, 'card-adult'));
    await page.click(T('why-adult'));
    if (!(await page.locator(T('card-adult')).innerText()).includes('date of birth')) throw new Error('no why for age');
    await advanceUntil(page, () => visible(page, 'card-signin'));
    await page.click(T('why-signin'));
    if (!(await text(page, 'card-signin')).includes('marketing')) throw new Error('no why for email');
    const s = await snap(page);
    if (!s.events.some((e) => e.name === 'question_explained')) throw new Error('no explain event');
  },
  'E-6': async (page) => {
    // Insured patients go from the hold straight to the booking summary: the cost comes from the earlier check.
    await advanceUntil(page, async () => ['cost', 'book'].includes(await stage(page)));
    const before = await snap(page);
    await page.evaluate(() => window.__proto.interrupt());
    await page.waitForSelector(T('card-resume'));
    await page.click(T('btn-resume'));
    const after = await snap(page);
    if (after.stage !== before.stage || after.memory.story !== before.memory.story || !after.hold) throw new Error('progress not restored');
    if (await visible(page, 'card-story')) throw new Error('asked again');
  },
  'E-7': async (page) => {
    await advanceUntil(page, () => visible(page, 'card-noslot'));
    await page.click(T('btn-widen'));
    await advanceUntil(page, async () => ['cost', 'book'].includes(await stage(page)));
    const s = await snap(page);
    const holds = s.timeline.filter((x) => x.tool === 'hold_appointment');
    if (holds.length < 2 || holds[0].ok || !holds.at(-1).ok) throw new Error('slot-taken recovery not shown');
  },
  'E-8': async (page) => {
    await advanceUntil(page, () => visible(page, 'card-matchpath'));
    for (const q of ['Do I have bipolar?', 'Should I go back on Lexapro?']) {
      await page.fill(T('composer'), q);
      await page.click(T('composer-send'));
      await page.waitForSelector(T('btn-add-question'));
      await page.locator(T('btn-add-question')).last().click();
    }
    const s = await snap(page);
    if (s.events.filter((e) => e.name === 'clinical_question_refused').length !== 2) throw new Error('refusals not logged');
    if (s.memory.questions?.length !== 2) throw new Error('questions not added to summary');
    const thread = await page.locator(T('thread')).innerText();
    if (/you (likely |probably )?have (bipolar|depression)/i.test(thread)) throw new Error('diagnosis leaked');
  },
  'E-9': async (page) => {
    await advanceUntil(page, () => visible(page, 'card-pay'));
    await page.fill(T('composer'), "Honestly I've had thoughts of not wanting to be here");
    await page.click(T('composer-send'));
    await page.waitForSelector(T('card-crisis'));
    if (!(await page.locator(`${T('card-crisis')} a[href="tel:988"]`).count())) throw new Error('no 988 call link');
    const s = await snap(page);
    const fired = s.events.find((e) => e.name === 'safety_route_fired');
    if (!fired || !String(fired.props.ruleId).startsWith('SAFE-')) throw new Error('route not fired by policy');
    await page.click(T('btn-keep-going'));
    await page.waitForSelector(T('card-pay'));
  },
  'E-10': async (page) => {
    await advanceUntil(page, async () => (await stage(page)) === 'done', { max: 100 });
    const s = await snap(page);
    const v = s.events.find((e) => e.name === 'visit_completed');
    if (!v || typeof v.props.daysSinceStart !== 'number') throw new Error('visit_completed missing days');
    if (!/stops here/i.test(await text(page, 'card-done'))) throw new Error('end of the prototype not called out');
  },
  'E-11': async (page) => {
    await advanceUntil(page, () => visible(page, 'card-notfit'));
    if (!(await page.locator(T('card-notfit')).innerText()).includes('Texas')) throw new Error('no reason shown');
    if (!(await visible(page, 'btn-email-summary'))) throw new Error('no offer to email back what they told us');
    await page.fill(T('input-kit-email'), 'sam@example.com');
    await page.check(T('kit-consent'));
    await page.click(T('submit-kit'));
    await page.click(T('confirm-send'));
    const s = await snap(page);
    if (!s.events.some((e) => e.name === 'kept_for_later')) throw new Error('not kept for later');
    await start(page, 'E-11b');
    await advanceUntil(page, () => visible(page, 'card-notfit'));
    if (!/parent or guardian/i.test(await page.locator(T('card-notfit')).innerText())) throw new Error('no guardian path for under 18');
  },
  'E-13': async (page) => {
    await advanceUntil(page, () => visible(page, 'card-signin'));
    if ((await stage(page)) !== 'signin') throw new Error('sign-in is not its own stage');
    const s0 = await snap(page);
    if (!s0.events.some((e) => e.name === 'fit_decided' && e.props.fit === 'yes')) throw new Error('sign-in shown before fit');
    await step(page);
    await page.waitForSelector(T('card-code'));
    if (!/123456/.test(await text(page, 'card-code'))) throw new Error('the code screen does not show the prototype code');
    await page.fill(T('input-code'), '000000');
    await page.click(T('submit-code'));
    if (!/doesn't match/i.test(await text(page, 'card-code'))) throw new Error('no mismatch message');
    await step(page);
    await page.waitForSelector(T('card-pay'));
    const s = await snap(page);
    if (!s.events.some((e) => e.name === 'sign_in_failed') || !s.events.some((e) => e.name === 'sign_in_verified')) throw new Error('sign-in events missing');
    if (!noPersonalData(s)) throw new Error('personal data in events');
  },
  'E-14': async (page) => {
    await advanceUntil(page, () => visible(page, 'card-matchpath'));
    const s = await snap(page);
    if (s.events.some((e) => e.name === 'question_answered' && e.props.questionId === 'pay') || s.events.some((e) => e.name === 'insurance_entered')) throw new Error('returning patient asked again');
    if (!/welcome back/i.test(await page.locator(T('thread')).innerText())) throw new Error('no welcome back');
    if (!/Lone Star/.test(await text(page, 'card-matchpath'))) throw new Error('saved coverage not shown');
    if (used(s, 'check_insurance_eligibility')) throw new Error('re-ran a coverage check without consent');
    await page.click(T('btn-coverage-details'));
    if (!/ending 0093/.test(await text(page, 'card-matchpath'))) throw new Error('saved member ID ending missing');
  },
  'E-15': async (page) => {
    await advanceUntil(page, () => visible(page, 'card-insurance'));
    await step(page);
    await page.waitForSelector(`${T('card-insurance')} .err`);
    if (!/couldn't find/i.test(await text(page, 'card-insurance'))) throw new Error('no not-found message');
    if (!(await visible(page, 'btn-verify-later'))) throw new Error('no verify-by-hand option');
    await step(page);
    await page.waitForSelector(T('card-matchpath'));
    if (!/covered/i.test(await text(page, 'card-matchpath'))) throw new Error('retry did not pass');
  },
  'E-16': async (page) => {
    await advanceUntil(page, () => visible(page, 'card-inactive'));
    const txt = await text(page, 'card-inactive');
    if (!/inactive/i.test(txt) || !txt.includes('$250')) throw new Error('inactive not explained or self-pay missing');
    await page.click(T('btn-update-plan'));
    await page.waitForSelector(T('card-insurance'));
    if (!(await visible(page, 'btn-back'))) throw new Error('no Back after entering a different plan');
    await page.selectOption(T('input-insurer'), 'lonestar');
    await page.click(T('submit-insurance'));
    await page.waitForSelector(T('card-matchpath'));
    await start(page, 'E-16');
    await advanceUntil(page, () => visible(page, 'card-inactive'));
    await page.click(T('btn-selfpay-switch'));
    await page.waitForSelector(T('card-matchpath'));
    if (!/self-pay/i.test(await text(page, 'card-matchpath'))) throw new Error('did not switch to self-pay');
  },
  'E-17': async (page) => {
    await advanceUntil(page, () => visible(page, 'card-matchpath'));
    const txt = await text(page, 'card-matchpath');
    if (!/Mesa Behavioral Health/.test(txt) || !/to be verified/i.test(txt)) throw new Error('carve-out not explained');
    await advanceUntil(page, async () => (await stage(page)) === 'prepare');
  },
  'E-18': async (page) => {
    await advanceUntil(page, () => visible(page, 'card-oon'));
    if (!/isn't in network/i.test(await text(page, 'card-oon'))) throw new Error('out of network not explained');
    if (!(await visible(page, 'btn-oon-waitlist'))) throw new Error('no waitlist option');
    await page.click(T('btn-selfpay-switch'));
    await page.waitForSelector(T('card-matchpath'));
  },
  'E-19': async (page) => {
    await advanceUntil(page, () => visible(page, 'card-insurance'));
    const ins = await text(page, 'card-insurance');
    if (!/only to check your coverage/i.test(ins)) throw new Error('consent line missing');
    await page.click(T('btn-skip-insurance'));
    await page.waitForSelector(T('card-matchpath'));
    if (!/not checked/i.test(await text(page, 'card-matchpath'))) throw new Error('unknown coverage not shown');
    await advanceUntil(page, () => visible(page, 'card-coverage-unknown'));
    if (used(await snap(page), 'check_insurance_eligibility')) throw new Error('checked coverage without consent');
    await page.click(T('btn-book-pending'));
    await advanceUntil(page, async () => (await stage(page)) === 'prepare');
  },
  // Patient view, typing like a person (no synthetic answers). From the independent review of v2.
  'PATIENT': async (page) => {
    await page.goto(PAGE_URL + (PAGE_URL.includes('?') ? '&' : '?') + 'mode=patient');
    await page.click(T('btn-book'));
    await page.fill(T('input-story'), "I can't sleep and I worry all the time");
    await page.click(T('submit-story'));
    await page.click(T('opt-no'));
    await page.click(T('opt-TX'));
    await page.click(T('opt-yes'));
    await page.fill(T('input-email'), 'pat@example.com');
    await page.click(T('why-signin'));
    if ((await page.inputValue(T('input-email'))) !== 'pat@example.com') throw new Error('email wiped by a redraw');
    await page.click(T('submit-email'));
    await page.fill(T('input-code'), '123456');
    await page.click(T('submit-code'));
    await page.click(T('opt-unsure'));
    await page.waitForSelector(T('card-insurance'));
    if (!(await page.locator(`${T('card-insurance')} [data-testid="btn-selfpay-switch"]`).count())) throw new Error('self-pay not offered on the insurance screen');
    await page.fill(T('input-legal-name'), 'Pat Example');
    await page.fill(T('input-member'), 'ABC 123');
    await page.click(T('why-insurance'));
    if ((await page.inputValue(T('input-legal-name'))) !== 'Pat Example' || (await page.inputValue(T('input-member'))) !== 'ABC 123') throw new Error('insurance fields wiped by a redraw');
    await page.fill(T('composer'), 'is this covered?');
    await page.click(T('composer-send'));
    if ((await page.inputValue(T('input-member'))) !== 'ABC 123') throw new Error('insurance fields wiped by the composer');
    await page.selectOption(T('input-insurer'), 'other');
    await page.click(T('submit-insurance'));
    await page.waitForSelector(T('card-matchpath'));
    if (!/covered/i.test(await text(page, 'card-matchpath'))) throw new Error('"Another plan" did not get the good result');
    const s = await snap(page);
    if (s.memory.payLabel !== 'Insurance') throw new Error(`memory still says ${s.memory.payLabel}`);
    if (!noPersonalData(s) || /Pat Example|ABC 123/.test(JSON.stringify(s.events))) throw new Error('personal data in events');
  },
  'PATIENT-SKIP': async (page) => {
    await page.goto(PAGE_URL + (PAGE_URL.includes('?') ? '&' : '?') + 'mode=patient');
    await page.click(T('btn-book'));
    await page.fill(T('input-story'), 'I feel down most days');
    await page.click(T('submit-story'));
    await page.click(T('opt-no')); await page.click(T('opt-TX')); await page.click(T('opt-yes'));
    await page.fill(T('input-email'), 'pat@example.com'); await page.click(T('submit-email'));
    await page.fill(T('input-code'), '123456'); await page.click(T('submit-code'));
    await page.click(T('opt-insurance'));
    await page.click(T('btn-skip-insurance'));
    await page.click(T('btn-matches-now'));
    await page.waitForSelector(T('card-recommend'));
    if (/Lone Star/.test(await text(page, 'card-recommend'))) throw new Error('skipped check still matched on a plan the patient never chose');
    await page.click(T('btn-hold')); await page.click(T('confirm-hold'));
    await page.waitForSelector(T('card-coverage-unknown'));
    const s = await snap(page);
    if (s.timeline.some((x) => x.tool === 'estimate_patient_cost')) throw new Error('ran a cost check with nothing checked');
    if (s.history?.some?.((h) => h.type === 'code')) throw new Error('code screen still in Back history');
  },
  'DESIGN': async (page) => {
    await start(page, 'E-1');
    if (!(await visible(page, 'card-landing'))) throw new Error('does not open on the landing screen');
    for (const id of ['btn-start', 'btn-book', 'btn-browse']) if (!(await visible(page, id))) throw new Error(`landing missing ${id}`);
    const lp = await page.locator(T('card-landing')).textContent();
    const cards = await page.locator(`${T('card-landing')} .lp-cards`).innerText();
    for (const w of ['Find Care', 'How It Works', 'Testimonials', 'FAQs', 'Login', 'Get Started', 'Book Appointment Now', 'Browse Providers', 'Top-Rated']) if (!lp.includes(w)) throw new Error(`landing missing "${w}"`);
    if (/No availability found/i.test(cards) || !/Next opening/i.test(cards)) throw new Error('specialist cards should show the next opening');
    await page.click(T('btn-book-clin-0'));
    await page.waitForSelector(T('card-story'));
    await start(page, 'E-1');
    await page.click(T('btn-book'));
    await page.waitForSelector(T('card-story'));
    const story = await page.locator(T('card-story')).innerText();
    if (!/in your own words, what can we help with/i.test(story)) throw new Error('first screen is not the own-words question');
    if (!(await visible(page, 'input-story'))) throw new Error('no text box on the first screen');
    if (!/new/i.test(await page.locator(`${T('card-story')} .delta`).innerText())) throw new Error('story not tagged New');
    await page.fill(T('input-story'), "I haven't been sleeping and I worry all the time");
    await page.click(T('submit-story'));
    await page.click(T('opt-no'));
    await page.waitForSelector(T('card-state'));
    if (!(await page.locator(T('opt-UT')).isDisabled())) throw new Error('Utah should be disabled');
    if (!(await page.locator(`${T('card-state')} .delta`).count())) throw new Error('no what-changed tag');
    await page.click(T('btn-back'));
    await page.waitForSelector(T('card-safety'));
    if (!(await visible(page, 'composer'))) throw new Error('no composer');
    const segs = await page.locator('.seg').count();
    if (segs !== 5) throw new Error(`progress has ${segs} segments, want 5`);
  },
  'MODES': async (page) => {
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.goto(PAGE_URL);
    await page.waitForSelector(T('card-mode'));
    for (const id of ['mode-patient', 'mode-reviewer']) if (!(await visible(page, id))) throw new Error(`chooser missing ${id}`);
    if (!/end to end/i.test(await text(page, 'scope-note'))) throw new Error('chooser does not say what is built');
    await page.click(T('mode-patient'));
    await page.waitForSelector(T('card-landing'));
    if (await visible(page, 'reviewer-toggle')) throw new Error('patient view shows the reviewer button');
    if (await page.locator('.delta:visible').count()) throw new Error('patient view shows what-changed notes');
    await page.click(T('btn-book'));
    await page.waitForSelector(T('card-story'));
    if (await page.locator(T('persona-answer')).count()) throw new Error('patient view shows demo answers');
    if (await page.locator('.delta').count()) throw new Error('patient view shows what-changed notes');
    if (!(await visible(page, 'switch-mode'))) throw new Error('no way to switch to reviewer view');
    await page.click(T('switch-mode'));
    await page.waitForSelector(`${T('card-story')} .delta`);
    if (!(await visible(page, 'reviewer-toggle'))) throw new Error('reviewer view has no reviewer button');
    await page.reload();
    if (await visible(page, 'card-mode')) throw new Error('chooser shown again after a choice was made');
  },
  'E-12': async (page) => {
    await page.click(T('btn-profile-sample'));
    await page.click(T('submit-profile'));
    await page.click(T('btn-calibrate'));
    await page.click(T('btn-run-maya'));
    await advanceUntil(page, () => visible(page, 'card-recommend'));
    const txt = await page.locator(T('card-recommend')).innerText();
    if (!txt.includes('Elena Ruiz') || !txt.includes('updated profile')) throw new Error('profile did not change the match');
  },
};

const browser = await chromium.launch();
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SCENARIOS);
for (const width of [1280, 390]) {
  for (const id of wanted) {
    if (width === 390 && !['E-1', 'E-9', 'E-11', 'E-12', 'E-13', 'E-15', 'DESIGN', 'MODES', 'PATIENT'].includes(id)) continue;
    const page = await open(browser, width);
    let error = null;
    try { if (!['DESIGN', 'MODES', 'PATIENT', 'PATIENT-SKIP'].includes(id)) await start(page, id); await SCENARIOS[id](page); } catch (e) { error = e.message; }
    if (page.errors.length) error = (error ? error + '; ' : '') + 'console: ' + page.errors.join(' | ');
    results.push({ id, width, pass: !error, error });
    await page.close();
  }
}
// Dark mode: run the longest path once with axe on every stage.
if (wanted.includes('E-1')) {
  const page = await open(browser, 1280, 'dark');
  let error = null;
  try { await start(page, 'E-1'); await advanceUntil(page, async () => (await stage(page)) === 'done', { max: 100, axeEachStage: true }); } catch (e) { error = e.message; }
  results.push({ id: 'E-1 dark', width: 1280, pass: !error && !page.errors.length, error: error || page.errors.join(' | ') || null });
  await page.close();
}
await browser.close();
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.id} @${r.width}${r.error ? '  ' + r.error : ''}`);
console.log(`\naxe serious/critical: ${axeIssues.size}`);
for (const [k, v] of axeIssues) console.log(`  [${v}] ${k}`);
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} scenario runs passed`);
process.exit(failed || axeIssues.size ? 1 : 0);
