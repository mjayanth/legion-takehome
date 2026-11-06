# Prototype v2: Sign-up After Fit and an Insurance Check Before Matching. Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change prototype v1 (PRD v2) into v2 (PRD v3): sign-up with an email code right after the fit checks, then one insurance screen with an inline coverage check, then the match choice.

**Architecture:** The existing state machine, tool contracts, agent loop and policies stay. Two stages and three simulated tools are added. `ui/app.js` gets new cards and a reordered flow, and the email-at-hold and member-ID-at-cost cards are removed.

**Tech Stack:** Vanilla JS ES modules, esbuild, Tailwind 3 inlined by `build.mjs`, `node --test`, Playwright with axe-core.

**Spec:** `docs/03-funnels/prd-v3.md` (R-09 to R-26), `docs/03-funnels/prototype-spec-v3.md` (tools, E-13 to E-19)

## Global Constraints

- Sign-in code is always `123456`. No email is sent, and there is no mail server. The code screen says so in a "Prototype" note.
- Insurance fields are not validated. Any value passes, and failures come only from scenario flags.
- Insurers in the prototype are the synthetic plans (Lone Star Health PPO, Bluebonnet Choice EPO, Gulf Coast HMO) plus "Other". Real insurer names are not used, so nothing implies real network status.
- No email, member ID, name or birth date in any event or URL. Events carry only categories.
- Self-pay is $250 a visit, marked "To be verified". Insurance and self-pay are shown as equals.
- Every eligibility number carries Verified or Estimate, plus Simulated.

## Review Focus

1. A wrong code and then the right one: the error clears and sign-in proceeds. Owner: Task 3, E-13.
2. "Skip for now" on the insurance screen: no `check_insurance_eligibility` call, and coverage shows as Unknown through booking. Owner: Task 3, E-19.
3. Self-pay never shows an insurance field or calls an eligibility tool. Owner: Task 4, E-2.
4. The back button from the insurance screen returns to the payment question without losing the sign-in. Owner: Task 4, E-1.
5. Interrupt and resume (E-6) still restores the session after sign-in, with nothing asked again. Owner: Task 4, E-6.

---

### Task 1: Stages, phases and reviewer content

**Files:** Modify `src/state/machine.js`, `src/reviewer/content.js`. Test `tests/loop.test.mjs`, `tests/reviewer.test.mjs`.

**Produces:**
- `STAGES = ['welcome','understand','fit','signin','coverage','options','recommend','hold','cost','book','prepare','visit','done']`
- `PHASES`, still 5:
  - talk: welcome to fit
  - account: signin, coverage ("Sign up and check coverage")
  - match: options, recommend ("Find your clinician")
  - book: hold to book
  - prepare: prepare, visit, done
- `identifiersAllowed(stage)` is true from `signin` onward.
- `REVIEWER.signin` and `REVIEWER.coverage`, plus `TESTS['T-17']` and `TESTS['T-18']`, neither flippable.

- [ ] Test: in `loop.test.mjs`, `identifiersAllowed('fit') === false`, `identifiersAllowed('signin') === true`, and phases still flatten to `STAGES`. Run `node --test tests/loop.test.mjs` and expect a FAIL.
- [ ] Implement, then run `node --test tests/*.test.mjs` and expect a PASS (the reviewer tests cover the new stages).

### Task 2: Sign-in and eligibility tools

**Files:** Modify `src/tools/index.js`, `src/tools/data.js`, `src/tools/explain.js`. Test `tests/tools.test.mjs`.

**Produces:**
- `start_sign_in(session, {email})` returns `{sent:true, returning:boolean}`. It is Simulated, its confirm is `send`, and it returns `invalid_email` if the format is bad.
- `verify_sign_in_code(session, {email, code})` returns ok with `{signedIn:true, returning}` (Verified) when `code === '123456'`, and otherwise `wrong_code`.
- `check_insurance_eligibility(session, {planId, memberId, name, dob})`. Its confirm is `send`. It reads `session.flags.eligibility`:
  - `not_found_once`: fails once with `not_found`, then passes.
  - `no_response`: fails with `no_response`. The old `coverageTimeout` flag maps here.
  - `inactive`: ok, with `status:'inactive'`.
  - `carve_out`: ok, `status:'active'`, `carveOut:'Mesa Behavioral Health'`, `copay:null`.
  - `out_of_network`: ok, `status:'active'`, `inNetwork:false`.
  - Default: ok, `status:'active'`, `inNetwork:true`, `copay` from the plan, `deductibleRemaining: 420`, `telehealth: true`, `priorAuth: false`.
  - `planId: 'other'` returns out of network.
- `estimate_patient_cost(session, {eligibility})` gives an Estimate when the plan is active and in network with a copay. A carve-out gives `pending:true` with the label "To be verified". Anything else fails with `no_check`, labelled Unknown. Its confirm is null, because it sends nothing new.

- [ ] Tests:
  - `wrong code fails, 123456 passes`
  - `eligibility accepts any member id`
  - `each flag maps to its outcome`
  - `not_found_once passes on retry`
  - `estimate_patient_cost without a check is Unknown and never a number`
  - `confirmActionFor('check_insurance_eligibility') === 'send'`

  Remove the old `TEST-` tests. Run the tool tests and expect a FAIL.
- [ ] Implement, then run `node --test tests/*.test.mjs` and expect a PASS.

### Task 3: Flow and cards

**Files:** Modify `src/ui/app.js`, `src/ui/personas.js`, `src/ui/styles.css`.

**Flow:** `runFit` (fit) leads to `signin`. Then:
1. Email card, then the code card.
2. `pay` card.
3. If insurance, the `insurance` card. On the button, `check_insurance_eligibility` runs, confirmed by the consent line plus the tap.
4. The `matchpath` card: "See 3 matches now" searches any time and recommends. "Answer a few questions for a closer match" goes to times, then prefs, then recommend.
5. The hold. The cost step uses the stored eligibility, then booking.

**Failure cards from eligibility:**
- `not_found`: stay on the insurance card with an error, plus "Continue, we'll verify by hand".
- `no_response`: the `coverage-unknown` card.
- `inactive`: the `inactive` card (update the plan, or self-pay).
- `out_of_network`: the `oon` card (self-pay, or the waitlist).
- `carve_out`: a one-line note on matchpath, with the copay "To be verified".

**Returning patients:** with `flags.returning` (E-14), verifying the code restores the saved pay path and coverage, and goes straight to matchpath.

**Scenarios:** add E-13 to E-19 to `SCENARIOS`. Persona answers gain `code`, `insurer`, `name` and `dob`. The `email` answer already exists.

**Retire:** the email card at the hold and the member-ID cost card. Add `DELTA` tags for the new cards.

- [ ] Covered by Task 4's scenarios. Write those first, run them, and expect FAILs.
- [ ] Implement until they pass.

### Task 4: Scenario runs

**Files:** Modify `tests/e2e/scenarios.mjs`.

- [ ] Update E-1 and E-3 for the new order. E-2 must have no insurance card and no eligibility call.
- [ ] Add E-13 to E-19, with the pass conditions from Spec v3. Every run also checks that no event contains `@`, `TEST-`, or digits in the member ID format.
- [ ] Run `node tests/e2e/scenarios.mjs` locally and over HTTP (`PAGE_URL`). Expect every run to pass and 0 serious axe issues.

### Task 5: Docs, copy and delivery

- [ ] `prototype/README.md`: v2 implements PRD v3, with the new scenarios and the last-run numbers. Spec v3 constraint: synthetic insurers.
- [ ] no-ai-slop pass on all new patient-facing copy.
- [ ] Build, copy to the repo staging folder, commit to Jay's folder, screenshot the new screens at 390 px and 1280 px in light and dark, and run a final independent review of the diff.
