# Prototype: empathetic, agentic onboarding (v2)

**Open [`index.html`](index.html).** One self-contained page. Synthetic data only; nothing you type leaves the page.

It implements [PRD v3](../docs/03-funnels/prd-v3.md) and [Prototype Spec v3](../docs/03-funnels/prototype-spec-v3.md). The flow follows [D-10](../docs/decision-log.md): the first screen asks what brought the patient here and safety questions come right after. Once the fit checks pass, the patient signs up with an email code ([D-22](../docs/decision-log.md)), says how they will pay, and insured patients check coverage on one screen before matching ([D-23](../docs/decision-log.md)).

**New in v2:** sign-up after fit (code `123456`, nothing is sent), one insurance screen with a sample card scan and the consent line, an inline coverage check (any details pass), then "See 3 matches now" or "Answer a few questions for a closer match". Insurers are synthetic plans so nothing implies real network status. v1 implemented PRD v2. When the repo is pushed, the prototype is built on the `prototype` branch and opened as a pull request into `main`.

## Design

The screens use the look of Legion's live onboarding at care.legionhealth.com, as of Nov 5, 2026: Geist type, one blue for actions, pill-shaped answers, a segmented progress bar, and a two-column layout. The changes sit inside that flow instead of a separate app:

- The starting page matches app.legionhealth.com as of Nov 5, 2026: the same navigation, hero, buttons, insurer row and "Top-Rated Specialists" section, in the same places. Every button on it ("Get Started", "Book Appointment Now", "Book with ...") opens the care navigator's first screen: "In your own words, what can we help with?", with the answer box right there. The specialist cards show each clinician's next opening instead of "No availability found".
- Substitutions on that page: the logo is plain text, the hero photo of a person is replaced by an abstract painted panel, insurer logos are plain names, specialists are synthetic clinicians with initials, and star ratings are left out.
- "Where are you located?", Legion's first screen today, comes after that, with the safety questions in between. Utah is shown but switched off; this prototype covers Texas.
- "Create your account", step 2 today, moves to right after the fit checks, as one email field and a code.
- The left column, a brand panel today, holds the patient's plan, what the navigator remembers, and every action it takes.
- A short navigator note above each question says what the AI just did or why it asks. The composer at the bottom takes free text, which the safety and clinical policies screen.
- A purple tag on each screen says what changed from today's flow: New, Moved, Changed, Reworded, or Same as today. Purple marks reviewer notes, so they never read as part of the product. Turn them off from the banner.

Legion's name is plain text and its logo is not used. The page is marked as a prototype.

## What's built, and what isn't

One path is built end to end: a Texas adult paying with insurance or self-pay, from the first question to a completed first visit. Every coverage failure, no openings, a taken slot, closing the tab, and clinical questions are built with a way forward.

Other paths go as far as the handoff, and the screen says "The prototype stops here":
- the crisis route (988 links are real; the clinician contact is not sent)
- not a fit (no follow-up is sent)
- talk to a person (no one replies)
- the waitlist, reminders and records requests (nothing is sent)

Not built: real insurer, scheduling, payment, email, text and health-record connections; a live model; Utah; booking for another adult or a minor; anything after the first visit. [The new flow](../docs/03-funnels/new-flow.html) maps all of it and explains why.

## What to try

The page opens with a choice, and you can switch at any time:

- **Patient view:** exactly what a patient sees, with nothing added. Type your own answers. Open it directly with `index.html?mode=patient`.
- **Reviewer view:** the same flow plus a note on every screen saying what changed from today, synthetic patients whose answers you can click, and the "How this works" panel (or press `R`). Open it directly with `index.html?mode=reviewer`, and pick a patient with `&scenario=E-9`, for example.
- **The reviewer panel**, on every screen:
  - *This screen*: the friction patients hit today (with the walkthrough quote and funnel numbers), what changed, what the agent does, the A/B test with both arms, and a switch to flip the arm live.
  - *Agent loop*: the seven loop steps for the last action, the tool contract, and which policy decided what.
  - *Events*: what Legion would store after redaction, with a toggle that shows what was removed.
  - *Scenarios*: E-1 to E-12, jump ahead, simulate closing the tab, and every switchable test.

## How it works

| Part | Where | Job |
| --- | --- | --- |
| State machine | `src/state/machine.js` | 13 stages in 5 patient-facing plan steps; default test arms |
| Agent loop | `src/agent/loop.js` | One bounded tool call per action; P-CONFIRM enforced; a timeline line and an event per call |
| Policies | `src/policy/` | P-SAFE (safety routing), P-FIT (service fit), P-CONFIRM (permission), P-CLINICAL (no diagnosis or medication advice). Rules, not the model |
| Tools | `src/tools/` | The spec's 12 tools, `start_sign_in`, `verify_sign_in_code` and `check_insurance_eligibility` (v3), plus `book_appointment`, `save_payment_method` and `complete_previsit_task`. All simulated, all labelled, sending ones confirmation-gated |
| Events | `src/events/` | Allowlist `redact()`; only categories and IDs are stored |
| Reviewer content | `src/reviewer/content.js` | FP-01 to FP-13, goals and tests per stage |
| UI | `src/ui/` | Navigator thread, one card at a time, plan, memory, activity timeline, reviewer drawer |

The navigator is scripted for v1, behind the same seam a live model would use. The P-SAFE phrase list and the P-FIT scope list are placeholders for Legion's clinical team.

## Build and test

```bash
npm install
npm test            # 44 unit tests: policies, tools, loop, redaction, reviewer content
npm run build       # writes index.html (esbuild + Tailwind, inlined)
npm run e2e         # E-1 to E-19 in Chromium at 1280 px and 390 px, E-1 in dark mode, axe on every stage

# The same runs against the GitHub Pages copy (or any served URL)
PAGE_URL=https://mjayanth.github.io/legion-takehome/prototype/ npm run e2e
```

Last run: 44/44 unit tests, 33/33 scenario runs (including two that type like a real patient in patient view), both from the file and from a local server laid out like GitHub Pages (including design checks of the landing, state, Back, change tags, and the patient and reviewer views), 0 serious or critical accessibility issues.

## Evaluation scenarios

| ID | The agent must | Synthetic patient |
| --- | --- | --- |
| E-1 | Help an eligible insured patient find and prepare for care | Maya, Lone Star Health PPO |
| E-2 | Support self-pay without treating insurance as the default | Daniel |
| E-3 | Recover when coverage can't be verified | Maya, the insurer doesn't respond |
| E-4 | Adjust when the recommended time doesn't fit | Maya, evenings only |
| E-5 | Explain why sensitive information is requested | Daniel taps "Why we ask" |
| E-6 | Keep progress after an interruption | Maya closes the tab |
| E-7 | Handle no openings and a taken slot without a dead end | Maya on Gulf Coast HMO |
| E-8 | Refuse to diagnose or advise on medication | Daniel |
| E-9 | Route a safety concern through the deterministic policy | Priya |
| E-10 | Keep supporting through first-visit completion | Maya |
| E-11 | Hand off respectfully when Legion isn't right | Sam (California), Alex (16) |
| E-12 | Use provider profile data in matching | Elena Ruiz updates her profile |
| E-13 | Sign up after fit, wrong code first | Maya |
| E-14 | Sign a returning patient back in, nothing asked again | Maya |
| E-15 | Member not found, fixed on retry | Daniel on insurance |
| E-16 | Coverage inactive, switch to self-pay | Priya |
| E-17 | Mental health benefits managed by another company | Maya |
| E-18 | Plan not in network with Legion | Maya |
| E-19 | Skip the coverage check, still reach matches | Maya |

## Not in v1

A live model; real insurer, scheduling, payment or EHR integrations; real video calls; storage between visits; the clinician app beyond the profile screen.
