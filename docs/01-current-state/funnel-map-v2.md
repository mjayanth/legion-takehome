# Legion Onboarding — Current Funnel Map (v2)

Nov 5, 2026 · @Jay Madduru

## Purpose and sources

Legion runs two onboarding flows today, and the telemetry we were given measures only one of them. The marketing site's "Book Appointment Now" leads into a newer flow on `care.legionhealth.com`. The PostHog funnel in the brief covers the older `app.legionhealth.com/portal/join/*` flow, which a signed-in user still reaches through the portal login. This map lays both out screen by screen. Each PostHog milestone sits beside the screens and sub-steps it actually covers.

**Version:** v2. Adds whose need each care-flow screen serves. v1 is kept in the repo. Context only; no redesign yet.

**Sources**

- Jay's OpenScreen walkthroughs: Round 1 (6:49, existing email, care flow) and Round 2 (18:02, new email in incognito, care flow then portal flow). Timestamps below are mm:ss into each recording.
- PostHog funnel from the [take-home brief](https://legionhealth.notion.site/Founding-Product-Take-Home-3cb55acd66fd81a691d7fb936f921b7b): rolling 30 days ending Aug 29, 2026, production host `app.legionhealth.com` only, unit = browser sessions.
- Persona used in both rounds: a prospective patient in Texas, a single mom unsure what kind of care she needs. Round 2 tested self-pay in the care flow and UnitedHealthcare, BCBS and Aetna in the portal flow.

## Funnel overview

_Chart (PostHog production telemetry from the take-home brief · sessions, rolling 30 days ending Aug 29, 2026 · portal flow only). The drawn version is on the HTML page for this section._

The two big drops sit at the two points where the flow first asks about care needs and first shows clinicians. The funnel stops at payment-page reach, which is well short of the brief's finish line: a completed first visit.

## Whose need each screen serves

The care flow first asks why the patient is here on screen 10 of 17. Twelve of its screens serve insurance, payment, identity or scheduling, three are clinical safety checks, and two ask what the patient needs.

| # | Screen | Serves |
| --- | --- | --- |
| B1 | Where are you located? | Business: eligibility |
| B2 | Create your account | Business: identity |
| B3 | Enter your code | Business: identity |
| B4 | Who is your health plan with? | Business: payment |
| B5 | Tell us who you are | Business: identity |
| B6 | Enter your phone number | Business: identity |
| B7 | Enter your details | Business: identity |
| B8 | Safety check | Clinical safety |
| B9 | Recent hospitalization | Clinical safety |
| B10 | **What brings you in today?** | **The patient's need** |
| B11 | Current medications | Clinical safety |
| B12 | **Tell us a bit more** | **The patient's need** |
| B13 | Let us build your health profile | Business: records |
| B14 | Find a provider (sorted by earliest opening) | Business: scheduling |
| B15 | Confirm and secure your visit | Business: payment |
| B16 | Card on file | Business: payment |
| B17 | Confirm booking | Business: scheduling |

The portal flow asks about conditions first (C3), then insurance (C4). Its match (C6) is still decided by plan and open slots.

## Screen-by-screen map

One PostHog milestone often covers several screens or questions. The care flow has 17 screens through booking, and none of them map to a canonical PostHog milestone.

### A. Entry: marketing site

| # | Screen | URL | Sub-steps, fields and branches | PostHog milestone | Seen at |
| --- | --- | --- | --- | --- | --- |
| A1 | Home hero | `app.legionhealth.com/` | Two CTAs: Book Appointment Now (links to `/portal/join`, lands in the care flow) and Browse Providers. Insurer logo strip. "Most patients complete registration in under 3 minutes." | None (marketing page) | R1 03:10 |
| A2 | Top-Rated Specialists carousel | `app.legionhealth.com/#providers` | Provider cards: name, rating, review count, title, Availability and About tabs. Every card seen says "No availability found in the next few days" with Book with \[name\]. | None | R1 02:05–02:40 |

### B. Care flow (`care.legionhealth.com`): the flow new patients land in

| # | Screen | URL | Sub-steps, fields and branches | PostHog milestone | Seen at |
| --- | --- | --- | --- | --- | --- |
| B1 | Where are you located? | `/onboarding/state` | Texas or Utah. Branch: "Not in Texas and Utah? Add me to the waitlist". Progress bar 2%. | Not in the brief's funnel | R1 01:15 |
| B2 | Create your account | `/get-started?redirect=…&flow=public-coverage` | Email field. Agreeing to Terms and Privacy by continuing. Branch: "Been a patient with us before?" Progress 18%. | Not in funnel | R1 03:35, R2 00:45 |
| B3 | Enter your code | same URL | 6-digit email code, expires in 5 minutes. Resend, Change email, a phone number fallback. Branch: an email with an existing account skips ahead to B14 at 85% (R1). | Not in funnel | R2 01:02 |
| B4 | Who is your health plan with? | `/onboarding/carrier?state=TX` | 6 insurer tiles, "Other insurance providers" link, Self-pay ("First visit $250, then $150 per visit"), Medicaid/Medicare marked "Coming soon". Progress 4% (it went backwards from 18%). | Not in funnel | R2 01:25 |
| B5 | Tell us who you are | `/onboarding/details?state=TX&carrier=self_pay` | First name, last name, date of birth (picker opens on Nov 1996), state, sex. "Choose a different plan" link. Shows the self-pay price again. Progress 8%. | Not in funnel | R2 01:45 |
| B6 | Enter your phone number | `/onboarding/phone` | Mobile number with SMS verification "Powered by Verified". Consent text for messaging. | Not in funnel | R2 02:05 |
| B7 | Enter your details | `/onboarding/phone` | Shown when identity can't be confirmed automatically. Name, DOB, street, apt, city, state, ZIP. No address validation; a Fremont city with a Texas ZIP was accepted. Progress 25%. | Not in funnel | R2 02:30–02:45 |
| B8 | Safety check | `/onboarding/safety` | "Are you currently thinking about harming yourself or someone else?" Yes or No. 911 and 988 text above the options. Progress 35%. | Not in funnel | R2 02:58 |
| B9 | Recent hospitalization | `/onboarding/hospitalization` | Hospitalized for mental health or substance use in the past year? Yes or No. Yes branch not explored. | Not in funnel | R2 03:15 |
| B10 | What brings you in today? | `/onboarding/reasons` | 14 chips: Depression, Anxiety, PTSD, Insomnia, ADHD, OCD, Bipolar, Borderline personality, Eating disorder, Substance use, Alcohol use, Pregnancy, Schizophrenia, Not sure yet. Progress 40%. | Not in funnel | R2 03:32 |
| B11 | Current medications | `/onboarding/medications` | Select all: stimulant, benzodiazepine, opioid incl. Suboxone or methadone, None of these. These are controlled-substance screens. Progress 43%. | Not in funnel | R2 03:56 |
| B12 | Tell us a bit more | `/onboarding/anything-else` | Optional free text. Progress 47%. | Not in funnel | R2 04:05–05:10 |
| B13 | Let us build your health profile | `/onboarding/records` | Consent to pull records from other clinics and EHRs. Single Continue, no opt-out shown. Progress 52%. | Not in funnel | R2 05:30 |
| B14 | Find a provider | `/booking` | List sorted by earliest opening. Search box, no filters. Card: photo, name, PMHNP, 4 specialty chips, "has an available initial visit", next opening, View times (opens a new tab). Update your insurance link. Progress 85%. | Not in funnel | R2 06:00–07:30, R1 06:35 |
| B15 | Confirm and secure your visit | `/booking` | Provider, 60-min initial video visit, time. Insurance details: $250 first visit, "No active insurance coverage is on file". Card on file required, "You won't be charged today". Progress 94%. | Not in funnel | R2 07:50 |
| B16 | Card on file | `/payments/card?next=booking` | Card number, expiry, country. Card is authorized for the medical practice's terms. Back to booking. | Not in funnel | R2 08:10 |
| B17 | Confirm booking | `/booking` | Confirm booking. Jay stopped here and did not book. | Not in funnel | R2 08:30 |

### C. Portal flow (`app.legionhealth.com/portal/join`): the flow PostHog measures

| # | Screen | URL | Sub-steps, fields and branches | PostHog milestone | Seen at |
| --- | --- | --- | --- | --- | --- |
| C0 | Legion Health Portal sign-in | `/portal/login` | Email with verification code, Join Legion Health, Continue with Google. | Not in funnel | R2 10:25 |
| C1 | Join start | `/portal/join` | Not seen: Jay signed in and landed on C3. | 1. Start | — |
| C2 | Fit check | `/portal/join/fit` | Not seen in either round. | 2. Fit check | — |
| C3 | What brings you here? | `/portal/join/conditions` | Step 1 of 6. 7 tiles: ADHD, Depression, Anxiety, Bipolar, PTSD, I'm not sure, Other (opens a free-text box). "Need help? Call us". "Sign in to continue" box. | 3. Conditions | R2 10:50–12:15 |
| C4 | Select your insurance provider | `/portal/join/insurance` | Step 2 of 6. Aetna, BCBS, Cigna, UHC, Oscar, Other, None. Picking a plan shows "Great! We accept your insurance plan. Most patients pay $0–$40 per session". No member ID asked. | 4. Insurance | R2 12:40, 16:10 |
| C5 | How can we help you? | `/portal/join/needs` | Step 3 of 6. Already diagnosed and need medication support / New diagnosis or medication / Not sure but need help. | 5. Needs | R2 13:00, 16:20 |
| C6 | Finding your perfect match | `/portal/join/match` | Step 4 of 6. Five animated checks then "Perfect match found!". Then a banner: "All our providers who work with \[plan\] are unavailable. Please call…". | 6. Provider match | R2 13:40, 16:40 |
| C7 | Your Matched Providers | `/portal/join/match` | Cards: name, Legion clinician badge, rating, title, areas of expertise, About. Every card seen reads "\[Name\] is fully booked". "Show More Providers (N remaining)". No filters. | 7. Provider selected, 8. Reservation created | R2 13:40–15:50 |
| C8 | Basic info | `/portal/join/patient` | Not reached: no provider could be booked. | 9. Patient details, 10. Account created | — |
| C9 | Payment method | `/portal/join/payment` | Not reached. | 11. Payment page | — |

## Branches and paths

_Chart (Entry points and branches · from Jay's Round 1 and Round 2 walkthroughs, Nov 5, 2026). The drawn version is on the HTML page for this section._

The same person can end up in either flow and answer the same questions twice. In Round 2, self-pay in the care flow showed bookable slots for the next day. In the portal, all three plans Jay tried ended with every matched clinician fully booked. Branches not explored yet: "Yes" on the safety or hospitalization questions, Medicaid or Medicare ("Coming soon"), the out-of-state waitlist, and the portal fit check.

## Measurement gaps

The metric the brief cares about, a completed first visit, isn't measured anywhere. Payment-page reach is the last thing PostHog sees.

- **The care flow has no funnel data.** All 17 screens in section B sit outside the given telemetry, and that's the flow the marketing CTA sends new patients to. We can't tell how many people it loses, or where.
- **Payment success has no event.** Payment-page reach is the last milestone. The brief says no payment-success or onboarding-complete event was observed.
- **Nothing is tracked after booking.** No events for confirmation, reminders, pre-visit intake, joining the video visit, a no-show, or a completed first visit.
- **Milestones cover several questions each.** Example: "3. Conditions" in the portal is one tile grid plus an optional free-text box. In the care flow the same intent is split across B8 to B12 (safety, hospitalization, reasons, medications, free text), and none of those questions has its own event.
- **Some exits never appear.** The insurance tile gives an instant "we accept your plan" with no member ID, and the dead end comes later at C6 ("all providers unavailable, please call"). Phone calls, waitlist joins and "Add me to the waitlist" (B1) aren't tracked as outcomes.
- **There's no identity across sessions.** The unit is a browser session. Round 1 shows one person splitting into several sessions: an existing email, a second email, then incognito. A patient who leaves and comes back counts as two partial sessions.
- **Fit check (C2) was never seen.** The 34.8% drop between fit check and conditions is the biggest in the funnel, but we haven't seen that screen yet. Next step: walk `/portal/join` signed out to capture it.
