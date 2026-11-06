# Legion Onboarding — Friction Hypotheses and Experiments (v1)

Nov 5, 2026 · @Jay Madduru

The 13 friction points become 13 hypotheses: 10 get an A/B test, and 3 ship to everyone. At about 197 sessions a day, we test whole new funnels first, then their parts. One-page view: [Legion Onboarding Hypotheses v1](../02-hypotheses/hypotheses-v1.html).

## Friction points

There are 13 friction points. Each red step on the [findings page](../01-current-state/findings-v1.html) is one, along with the returning-user jump, the repeated questions and the unexplained visit. The care flow has no funnel data, so its friction points rest on Jay's walkthrough alone. Portal numbers are PostHog sessions over 30 days.

| ID | Friction point | Where | Evidence | Funnel numbers that touch it |
| --- | --- | --- | --- | --- |
| FP-01 | Entry skips intent; top-rated specialists all show no availability | Marketing site | O-01, O-02 | Not measured |
| FP-02 | Account and code come before any question about care | Care: Email and code | O-03 | Not measured |
| FP-03 | A returning email jumps past intake to Find a provider | Care: Email and code | O-04 | Not measured |
| FP-04 | Plan picked from logos; coverage claimed with no check | Care: Plan; Portal: Insurance | O-06, O-19 | Insurance to needs: 7.3% lost (243) |
| FP-05 | Birth date defaults to 1996; address not validated | Care: Name, phone, address | O-07, O-08 | Not measured |
| FP-06 | Intake uses diagnostic labels, with no plain-language path | Care: Reasons; Portal: Conditions | O-10, O-25 | Fit check to conditions: 34.8% lost (1,912). Fit check screen not yet seen. |
| FP-07 | A suicide disclosure in free text drew no follow-up | Care: free text | O-11 | Safety, not conversion |
| FP-08 | The same questions are asked twice; diagnosed-or-new lives in one flow only | Portal: Conditions, Needs | O-17, O-18 | Repeat starts inflate session counts |
| FP-09 | Matches come with no reason to choose and no filters | Care: Find a provider; Portal: Match | O-12, O-14, O-20 | Match to provider selected: 36.6% lost (1,104) |
| FP-10 | Insured patients find every clinician fully booked, and the next step is a phone number | Portal: Match | O-22, O-23 | Same 36.6% drop |
| FP-11 | Changing insurance as a self-pay patient needs a phone call | Care: Find a provider | O-15 | Not measured |
| FP-12 | $250 with no breakdown or charge date; manual card entry | Care: Confirm and card | O-16 | Patient details to account: 20.4% lost (360). Payment success not tracked. |
| FP-13 | The visit isn't explained until the confirm screen | Care: Confirm and card | O-24 | Show rate not tracked |

## Hypotheses

Each friction point gets one hypothesis. Each is phrased so real patient behaviour can prove it wrong. The evidence is one person's walkthrough plus aggregate sessions, so treat every line as a bet, not a finding.

| ID | For | We believe | Because | Features |
| --- | --- | --- | --- | --- |
| H-01 | FP-01 | Opening the site with one plain question ("What's going on?") will start more people into intake than "Book Appointment Now" does. | Jay didn't know what kind of care he needed, and Browse Providers didn't help him decide. | F-01, F-18 |
| H-02 | FP-02 | Asking for email after the patient sees a match, not before intake, will get more people to the match page without lowering account creation. | Jay: "Sign up before you even know what I'm looking for." | F-02 |
| H-03 | FP-03 | Showing a returning patient what's on file to confirm will lead to better-fit bookings than jumping straight to providers. | Round 1 went straight to providers at 85% with no context. | F-05 |
| H-04 | FP-04 | A real coverage check, with member ID and an estimated cost, will raise bookings among insured patients more than the extra fields cost at the insurance step. | Jay: "What is the scope? Is this based off of my plan?" "We accept your plan" led to a dead end. | F-10 |
| H-05 | FP-05 | Address autocomplete and no default birth date will cut identity errors and drop-offs at the details step. | The birth date defaulted to 1996, and a Fremont city with a Texas ZIP saved. | F-17 |
| H-06 | FP-06 | A plain-language intake, where the patient describes things in their own words and confirms the clinical terms, will raise intake completion for people with no diagnosis. | Jay: "I don't know these terminologies. I just want to talk to some psychiatrist." | F-03, F-04 |
| H-07 | FP-07 | Screening all free text for risk will catch disclosures the yes/no question misses. | Jay answered No, then typed "suicidal thoughts", and nothing happened. | F-14 |
| H-08 | FP-08 | One shared intake record, with diagnosed-or-new asked once and early, will raise completion for returning sessions. | Jay: "I'm the same account, I don't know why you're asking me again." | F-04, F-05 |
| H-09 | FP-09 | Three matches with a stated reason each (fit to the patient's words, plan, next opening), plus filters, will raise match-to-selected more than a long list sorted by opening. | Jay: "Perfect match found, how? On what basis?" This step loses 36.6% of sessions. | F-06, F-08, F-09 |
| H-10 | FP-10 | When no in-network clinician is open, a dated next slot, a waitlist that books automatically, or a clearly priced self-pay option will keep more patients than a phone number. | Jay: "If everybody's booked, why am I here?" Self-pay had openings the next day. | F-07, F-23, F-24 |
| H-11 | FP-11 | Self-serve insurance changes will cut support calls and keep self-pay patients moving. | Jay: "So now I have to make a call." | F-13 |
| H-12 | FP-12 | Showing what the first visit covers, when the card is charged and the cancel rule, plus one-tap wallets, will raise card completion and lower no-shows. | Jay: "I don't know what I'm paying for, when I'm gonna be paid." He stopped at this screen. | F-11, F-12 |
| H-13 | FP-13 | Explaining the first visit before booking (60-minute video call, who it's with, what to prepare) will raise both booking and show rate. | Jay: "I don't know what I get out of this platform." | F-18, F-19 |

## A/B tests

There are 10 tests for 10 hypotheses. Four have a usable baseline today: T-04, T-06, T-09 and T-12 (T-04's is its guardrail, T-12's is a proxy). The other six need instrumentation first. Every test assigns a person, not a browser session, and uses the same guardrails: crisis-routing rate, show rate at the first visit, and complaints. A variant ships only if its primary metric rises and no guardrail gets worse by more than the threshold set before launch.

| Test | Hypothesis | Control | Variant(s) | Primary metric | Extra guardrails | Detectable in 28 days |
| --- | --- | --- | --- | --- | --- | --- |
| T-01 | H-01 | "Book Appointment Now" into the current flow | "Tell us what's going on" into an intent-first intake; carousel shows next-open dates instead of "no availability" | Site visitors who finish intake | Bounce rate; bookings | Needs marketing-site traffic. Not in the brief. |
| T-02 | H-02 | Account and code first | Anonymous intake; account created to save the match | Starts that reach a match | Accounts created per match; bookings | Needs care-flow tracking (F-20) |
| T-03 | H-03 | Returning email goes to Find a provider | "Here's what we have" confirm screen, then match | Returning patients who book | Provider switch after visit 1 | Needs returning-user volume |
| T-04 | H-04 | Logo pick, "we accept your plan, $0–$40" | Member ID or card photo, live eligibility, cost estimate | Insured starts that reach a reservation | Insurance-step drop: a 2.6-point change is detectable (92.7% today) | Guardrail measured today |
| T-06 | H-06 | Diagnostic chips | B: plain-language conversation that proposes terms to confirm. C: chips plus "help me describe it" | Fit check to conditions, then intake completed | Time in intake; safety flags raised; clinician rating of the intake | 4.6 points on 65.2% (7% relative), 3 arms |
| T-08 | H-08 | Ask again in each flow | Prefill from the shared record; patient confirms or edits | Returning sessions that finish intake | Wrong-prefill reports | Needs returning-session volume |
| T-09 | H-09 | Long list sorted by opening | Top 3 with a reason each, plus filters and "see all" | Match to provider selected | Visit-1 no-shows; switch requests after visit 1 | 5.1 points on 63.4% (8% relative) |
| T-10 | H-10 | "All providers unavailable, please call" | B: next dated slot to book now. C: waitlist that books the first opening by SMS, plus a priced self-pay option | No-slot sessions that book within 14 days | Self-pay share (must not be pushed); cancellations | Needs the share of sessions with no open slot |
| T-12 | H-12 | $250 line, manual card form | 2×2: price breakdown and charge date (yes/no) × one-tap wallets (yes/no) | Card saved and booking confirmed | Refunds; chargebacks; no-shows | 5.6 points on the 79.6% account step as a proxy. Needs a payment-success event. |
| T-13 | H-13 | Visit described at confirm only | "Your first visit" card before booking | Show rate at visit 1 | Booking rate | Needs visit-completed tracking |

## What we will not A/B test

Some changes go to every patient at once, because holding them back from a control group would be unsafe, unlawful or a waste of scarce traffic.

| Change | Hypothesis | Why no test | How we measure instead |
| --- | --- | --- | --- |
| Free-text risk screening, crisis routing and clinician flag (F-14) | H-07 | A control group would leave disclosures unhandled. | Disclosures caught per 1,000 intakes; false-flag rate in clinician review; time to clinician contact |
| Safety questions themselves | — | Clinically required. Only wording and placement get tested, never whether they are asked. | Crisis-routing rate is a guardrail on every test |
| Consent, terms and records authorization | — | Legal requirements. We test layout, never removal. | Consent completion rate |
| Address autocomplete, no default birth date (F-17) | H-05 | Hygiene with no realistic downside; traffic is better spent elsewhere. | Field error rate and step drop, before and after |
| Self-serve insurance change (F-13) | H-11 | Removes a phone call; low volume. | Support calls about insurance, before and after |
| Label and progress-bar fixes (F-21) | — | Bugs | Bug closed |

## Traffic and test power

The portal gets about 197 sessions a day, so we test a few bold changes, not many small ones.

_Chart (Computed from PostHog portal sessions in the take-home brief, 30 days to Aug 29, 2026 · normal approximation, two arms). The drawn version is on the HTML page for this section._

- Run tests on different steps at the same time, each with its own random assignment, so they don't block each other.
- Test only changes we expect to move a step by at least 8% relative. Smaller tweaks ship as hygiene or wait.
- A third arm costs power: T-06 drops from 5.7% to 7% detectable with three arms.
- Counts are sessions, and one person can make several, so person-level power is lower than shown. Re-run this once person-level data exists.

## Prerequisites

No test runs until we can see a patient from first click to first visit. Today PostHog stops at the payment page and counts sessions.

- [ ] Instrument the care flow: one event per screen in section B of the funnel map (F-20).
- [ ] Add events after the payment page: payment succeeded, booking confirmed, reminder sent, visit joined, visit completed, no-show (F-20).
- [ ] Tie sessions to one person once email is known, so assignment and results are per person (F-25).
- [ ] Assign variants with PostHog feature flags, sticky per person, and log the exposure event.
- [ ] Fix guardrail thresholds and the stop rule before each launch, and record them in the Decision Log.
- [ ] Clinical review of every variant that changes intake, safety or matching wording (F-26).
- [ ] Set the north-star window N (D-06).

## Candidate funnel bundles

Three starting groupings for the next step, where we combine hypotheses into new funnels. Each bundle is tested as a whole against the current flow first, then broken down with the component tests above.

| Bundle | Combines | The bet | Funnel-level test |
| --- | --- | --- | --- |
| A. Talk first | H-01, H-02, H-06, H-07, H-08 | Patients who are heard in their own words before any sign-up will finish intake and trust the match. | Current flow vs. bundle A, 50/50 per person. Primary: first visit completed within N days. |
| B. Know your cost first | H-04, H-11, H-12, H-13 | Patients who know their coverage, price and visit format early will book and show up. | Current flow vs. bundle B. Primary: first visit completed within N days; secondary: no-show rate. |
| C. A real slot, explained | H-03, H-09, H-10, H-13 | Patients who get a reason for each match and a guaranteed next step won't leave at matching. | Current flow vs. bundle C. Primary: match to visit booked. Needs the supply question answered first. |

A bundle that beats the current flow becomes the new control. Its parts are then tested one at a time to find which ones carry the lift.

## Open questions

- [ ] Is no-availability for insured patients a supply problem (credentialing, capacity) or a display problem? If supply, T-10 and Funnel C need operations work first.
- [ ] How much marketing-site traffic is there, and how many visitors start each flow? T-01 needs this.
- [ ] What share of match sessions have no open slot? T-10 needs this.
- [ ] Can intake answers be stored before an account exists, under Legion's HIPAA setup? T-02 depends on this.
- [ ] Who on the clinical team signs off on variant wording, and how fast?
- [ ] Does Legion run the care flow and the portal as an existing test? A running test would confound every new one.
