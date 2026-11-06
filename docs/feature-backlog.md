# Legion Onboarding — Feature Backlog

Nov 5, 2026 · @Jay Madduru

## Backlog

These 44 features came out of the walkthroughs, this chat and the hypotheses doc. v2 tags each by whose need it serves and sets P0 on the patient-first core (F-27, F-01, F-03, F-06, F-18) and on safety (F-14), following D-10. Insurance and payment features stay, later in the flow; the rest are not ranked yet. Each links back to the observation or decision that raised it. Status: Idea, Specced (in a PRD, not built), Prototype (built in the prototype; "simulated" where an integration is faked), Test (an A/B arm), or Superseded. Source says who raised it: Jay in a recording round, Jay in chat, the brief, or the analysis.

| ID | Feature | Addresses | Hypothesis | Funnel step | Serves | Source | Priority | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| F-44 | Landing page calls to action open the "in your own words" screen; specialist cards show the next opening instead of "No availability found" | D-17, D-19 | H-01 | Landing | Patient need | Jay, chat | Unranked | Prototype |
| F-43 | Every fact labelled Verified, Estimate, Simulated or Unknown; the self-pay price marked "to be verified" | M-03, M-05 | — | All | Trust | Jay, chat | P0 | Prototype |
| F-42 | "Talk to a person" one tap away on every screen, with a respectful handoff | M-07 | H-10 | All | Patient need | Jay, chat | P0 | Prototype (simulated) |
| F-41 | "Why we ask" on every question: why, who sees it, required or optional | G1, E-5 | — | All | Trust | Jay, chat | Unranked | Prototype |
| F-40 | Visible care plan with owners, "What I remember" with edits, and an activity timeline of every agent action | G4, G7, M-08 | T-16 | All | Patient need | Jay, chat | P0 | Prototype |
| F-39 | A safety line relevant to each step on every screen; 988 and a person always in the header | D-13 | — | All | Clinical safety | Jay, chat | P0 | Prototype |
| F-38 | Coverage discovery from name, birth date and state, without a member ID (Sohar-style) | Research for PRD v3 | T-18 | Coverage | Patient need | Analysis | Unranked | Idea |
| F-37 | Second check with the behavioral health administrator when benefits are carved out (for example Magellan) | Research for PRD v3 | — | Coverage | Patient need | Analysis | Unranked | Idea |
| F-36 | Real-time eligibility check with consent before matching (X12 270/271 via a clearinghouse); network status from Legion's contract list | D-23 | T-18 | Coverage | Patient need | Jay, chat | P0 | Prototype (simulated) |
| F-35 | Insurance card scan that fills payer and member ID, each field editable | D-23 | — | Coverage | Patient need | Jay, chat | Unranked | Prototype (simulated) |
| F-34 | Email sign-in with a 6-digit code, right after the fit checks; returning patients resume | D-22, D-24 | T-17 | Account | Patient need | Jay, chat | P0 | Prototype (simulated) |
| F-33 | Self-pay: first 5 minutes free, charged only if the visit continues | PRD v2 | T-15 | Payment | Patient need | Jay, chat | Unranked | Test |
| F-32 | Keep-in-touch capture with consent for people Legion can't serve yet (a parent's email for minors) | E-11 | — | Fit | Patient need | Jay, chat | Unranked | Prototype (simulated) |
| F-31 | Background redaction of personal and health details in logs, analytics and the learning loop | M-11 | — | All | Privacy | Jay, chat | P0 | Prototype |
| F-30 | Provider capability profile that feeds matching | E-12 | — | Matching | Patient need | Jay, chat | Unranked | Prototype (simulated) |
| F-29 | Three quick matches, or a few questions for a closer match | PRD v2 | T-14 | Matching | Patient need | Jay, chat | P0 | Prototype |
| F-28 | Conversational intake whose transcripts feed a learning loop for the funnel | PRD v2 | T-06 | Understand | Patient need | Jay, chat | Unranked | Prototype (scripted) |
| F-27 | Patient-first sequencing of the whole flow: understand, reassure, match, then insurance, payment, scheduling | Obs v2 root cause | H-00 | All | Patient need | Jay, chat | P0 | Prototype |
| F-01 | Ask why the patient is here before anything else | O-03, O-25 | H-01 | Before account | Patient need | Jay, R1 | P0 | Prototype |
| F-02 | Create the account only once there's something to save | O-03 | H-02 | Account | Patient need | Jay, R1 | Unranked | Superseded by F-34 (D-22) |
| F-03 | Plain-language intake for people without a diagnosis, turned into clinical terms for the clinician | O-10, O-25 | H-06 | Conditions | Patient need | Jay, R2 | P0 | Prototype (own words kept; no clinical terms suggested, D-12) |
| F-04 | Ask "new diagnosis or already diagnosed" once, early, in every flow | O-18 | H-06, H-08 | Needs | Patient need | Jay, R2 | Unranked | Idea |
| F-05 | Carry answers across flows and sessions; never ask the same question twice | O-04, O-17 | H-03, H-08 | All | Patient need | Jay, R2 | Unranked | Prototype |
| F-06 | Explain each match: why this clinician fits what the patient said | O-12, O-14, O-20 | H-09 | Match | Patient need | Jay, R2 | P0 | Prototype |
| F-07 | Rank by fit, then availability; show booked clinicians with a next-available date, book later or join a waitlist | O-22 | H-10 | Provider selected | Business: scheduling | Jay, R2 | Unranked | Prototype (simulated) |
| F-08 | Provider filters (specialty, availability, medication management) | O-14, O-22 | H-09 | Match | Patient need | Jay, R2 | Unranked | Idea |
| F-09 | Readable reviews, with the same ratings on the marketing site and in booking | O-14, O-22 | H-09 | Match | Patient need | Jay, R2 | Unranked | Idea |
| F-10 | Real-time insurance eligibility with member ID, and an honest coverage message | O-06, O-19 | H-04 | Insurance | Business: insurance | Jay, R2 | Unranked | Superseded by F-36 |
| F-11 | Price clarity: what the first visit covers, when the card is charged, cancellation terms | O-16 | H-12 | Payment | Business: payment | Jay, R2 | Unranked | Prototype |
| F-12 | One-tap payment (Stripe Link, Apple Pay, Google Pay) | O-16 | H-12 | Payment | Business: payment | Jay, R2 | Unranked | Prototype (test T-12) |
| F-13 | Self-serve insurance changes instead of a phone call | O-15 | H-11 | Booking | Business: insurance | Jay, R2 | Unranked | Idea |
| F-14 | Screen free text for risk, route to crisis resources, flag for a clinician | O-11 | H-07 | Intake | Clinical safety | Analysis | P0 | Prototype (P-SAFE) |
| F-15 | Let an adult book for another adult | O-09 | — | Safety check | Patient need | Jay, R2 | Unranked | Idea |
| F-16 | Serve minors with guardian consent (out of scope today; D-02) | D-02 | — | All | Patient need | Jay, chat | Unranked | Idea |
| F-17 | Validate identity and address | O-08 | H-05 | Patient details | Business: identity | Jay, R2 | Unranked | Idea |
| F-18 | Explain the first visit: format, length, what happens, who it's with | O-24 | H-01, H-13 | Before booking | Patient need | Jay, R1 | P0 | Prototype |
| F-19 | Post-booking path to the first visit: confirmation, reminders, pre-visit intake, tech check | O-26 | H-13 | After payment | Patient need | Brief | Unranked | Prototype (simulated) |
| F-20 | Track the full funnel through first visit completed, with identity across sessions | O-26 | Test prerequisite | All | Measurement | Brief | Unranked | Prototype (events, redacted) |
| F-21 | Fix the progress bar reset and plan-name mismatch | O-05, O-21 | — | Insurance, Match | Execution | Jay, R2 | Unranked | Idea |
| F-22 | Records consent with clear choices and an opt-out | O-13 | — | Records | Business: records | Analysis | Unranked | Prototype |
| F-23 | Waitlist that books the first opening and confirms by SMS | O-22 | H-10 | Match | Business: scheduling | Hypotheses v1 | Unranked | Prototype (simulated) |
| F-24 | Clearly priced self-pay option when no in-network clinician is open | O-22, O-23 | H-10 | Match | Business: payment | Hypotheses v1 | Unranked | Prototype |
| F-25 | One identity per person across sessions, for test assignment and results | O-26 | Test prerequisite | All | Measurement | Hypotheses v1 | Unranked | Idea |
| F-26 | Clinical review of any variant that changes intake, safety or matching wording | O-11 | Test prerequisite | All | Clinical safety | Hypotheses v1 | Unranked | Idea |
