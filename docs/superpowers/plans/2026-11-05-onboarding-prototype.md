# Empathetic, Agentic Onboarding Prototype: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A deployed, single-page prototype of the PRD v2 funnel: a navigator that understands first, simulated tools that do the work with permission, deterministic policies for safety, fit, confirmation and clinical boundaries, and a reviewer drawer that explains the friction each screen fixes and the A/B test behind it.

**Architecture:** ES modules under `prototype/src/` (state, policy, tools, agent, events, reviewer, ui). Logic modules are pure and unit-tested with `node --test`. `build.mjs` bundles with esbuild, compiles Tailwind, and inlines both into `prototype/index.html`. Playwright drives the built page through the evaluation scenarios.

**Tech Stack:** Vanilla JS (ES2020), Tailwind CSS 3 (compiled at build), esbuild, node:test, Playwright, axe-core.

**Spec:** [Prototype Spec v2](https://claude.ai/artifact/9HXARy6CfUHcgWdMT9tzuM), [PRD v2](https://claude.ai/artifact/8hMhwBGYCUfopEeGw1dFC6)

## Global Constraints

- Synthetic data only. Member IDs must start with `TEST-`; anything else is rejected with an explanation.
- Self-pay price: `$250 per visit`, always shown with the label `To be verified`.
- Every figure carries one label: `Verified`, `Estimate`, `Simulated`, `Unknown`.
- Every AI message and AI action carries an `AI` mark.
- P-CONFIRM actions: `hold`, `book`, `pay`, `consent`, `records`, `send`, `share_summary`. None runs without a confirmation.
- No account, member ID, detailed history or records requested before the options stage.
- 988 links: `tel:988`, `sms:988`. Present in the header on every screen.
- Design tokens and fonts match the submission hub (`index.html`): teal accent, Lexend and Source Sans 3; light and dark.
- WCAG 2.1 AA, keyboard-complete, visible focus, 44 px targets, reduced motion, no emoji icons.

## Review Focus

- A safety phrase typed into ANY free-text box (concern, composer, summary edit) routes, not just the first question. Test: `safe.test.mjs` runs `evaluateSafety` on composer text; e2e E-9 types into the composer.
- Misspelled or spaced-out disclosures ("sucidal", "kill  my self") still route. Test: `safe.test.mjs`.
- Declining a confirmation leaves state unchanged and offers an alternative. Test: `loop.test.mjs` `declined action does not run`.
- A real-looking member ID or card number is refused before any tool call. Test: `tools.test.mjs` `estimate rejects non-TEST member id`.
- Event props never carry free text, even when a caller passes it by mistake. Test: `redact.test.mjs` allowlist.

---

### Task 1: Scaffold, policies

**Files:** Create `prototype/package.json`, `prototype/src/policy/{safe,fit,confirm,clinical}.js`, `prototype/tests/policy.test.mjs`, `prototype/tests/safe.test.mjs`

**Produces:** `evaluateSafety({text?, answer?}) -> {route:boolean, ruleId:string|null}`; `checkFitRules({state, adult, concerns, emergency}) -> {fit:'yes'|'no'|'person', ruleId, reason}`; `needsConfirmation(action) -> boolean`; `classifyClinical(text) -> null|'diagnosis'|'medication'`; `CLINICAL_REFUSAL`.

- [ ] Write failing tests: E-9 phrase routes; typo and spacing variants route; "I can't sleep" does not; safety answer `yes` routes; Texas adult with anxiety fits; California -> `no` rule `FIT-STATE`; under 18 -> `no` rule `FIT-AGE`; `detox` -> `person` rule `FIT-SCOPE`; every P-CONFIRM action true, `search` false; "Do I have bipolar?" -> diagnosis; "Should I go back on Lexapro?" -> medication; "I feel anxious" -> null.
- [ ] Run `node --test`: FAIL (modules missing).
- [ ] Implement the four modules as rule tables.
- [ ] Run `node --test`: PASS.

### Task 2: Synthetic data and tools

**Files:** Create `src/tools/data.js`, `src/tools/index.js`, `tests/tools.test.mjs`

**Produces:** twelve tools `(session, input) -> {ok, data, source, label, error}` named as in the spec; `TOOL_CONTRACTS` (inputs, label, confirm, failures, recovery).

- [ ] Failing tests: `get_payment_options` lists insurance and self-pay with self-pay `$250` labelled `To be verified`; `search_provider_availability` returns evening slots for evenings; Gulf Coast HMO returns none within 14 days; `recommend_provider` returns 1 + 2 alternatives with reason codes; `hold_appointment` fails with `slot_taken` when persona flag set; `estimate_patient_cost` rejects non-`TEST-` IDs, returns `Unknown` on timeout flag; `prepare_intake_summary` is labelled AI draft and contains the patient's own words.
- [ ] Run: FAIL. Implement. Run: PASS.

### Task 3: Agent loop, events, redaction, state machine

**Files:** Create `src/agent/loop.js`, `src/agent/concerns.js`, `src/events/{redact,log}.js`, `src/state/machine.js`, `tests/{loop,redact,machine}.test.mjs`

**Produces:** `createSession({persona, variants, now}) -> session`; `act(session, tool, input, {confirmed}) -> result` (P-SAFE never inside; P-CONFIRM enforced; timeline line per call; `tool_called` event); `redact(props) -> props` (allowlist); `emit(session, name, props)`; `STAGES`, `PHASES`, `stageIndex()`, `identifiersAllowed(stage)`; `extractConcerns(text) -> string[]`.

- [ ] Failing tests: confirm-required tool without `confirmed` returns `{ok:false, error:'needs_confirmation'}` and leaves state unchanged; confirmed runs and adds a timeline line; redact drops name, email, dob, memberId, address, text, keeps `stage`, `tool`, `label`; identifiersAllowed false before `hold`.
- [ ] Run: FAIL. Implement. Run: PASS.

### Task 4: Reviewer content

**Files:** Create `src/reviewer/content.js`, `tests/reviewer.test.mjs`

**Produces:** `REVIEWER[stage] = {title, friction:[{fp, was, quote?}], change, hypotheses, tests:[{id, control, variant, metric, power}], goals, flippable:[testId]}`.

- [ ] Failing test: every stage in `STAGES` has an entry with at least one friction item or goal and every test id referenced exists in `TESTS`.
- [ ] Implement from Hypotheses v2 and PRD v2. PASS.

### Task 5: UI, build, end-to-end scenarios

**Files:** Create `src/ui/app.js`, `src/ui/render.js`, `src/ui/styles.css`, `src/index.template.html`, `build.mjs`, `tailwind.config.js`, `tests/e2e/scenarios.mjs`

- [ ] Write the e2e script first: for each scenario E-1 to E-12, start from the scenario menu, click persona answers by `data-testid`, assert the pass condition from the spec; run at 390 px and 1280 px; collect console errors; run axe on each stage.
- [ ] Run: FAIL (no page).
- [ ] Build the UI: header (Talk to a person, 988, How this works), navigator thread, active card, composer, care plan, memory, timeline, reviewer drawer with variant switches.
- [ ] `node build.mjs && node tests/e2e/scenarios.mjs`: PASS, zero console errors, zero serious axe issues.

### Task 6: Copy, verification, delivery

- [ ] no-ai-slop pass on all patient-facing copy in `src/ui/copy.js` and reviewer copy.
- [ ] Full suite green; screenshots at 390 and 1280, light and dark.
- [ ] Publish the built page as a private preview; copy into the repo folder on Jay's computer. No git push until Jay finalizes.
