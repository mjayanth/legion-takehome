# Legion Onboarding — Observations (v1)

Nov 5, 2026 · @Jay Madduru

## How to read this

The current onboarding asks for commitment before it gives anything back, then often has no clinician to offer. It also missed a suicide disclosure typed into free text. This doc has 26 observations from Jay's two walkthroughs. Each one is tied to a screen in the funnel map and, where there is one, a PostHog milestone.

**Version:** v1 of the current-state analysis, Nov 5, 2026.

**Visual summary:** [Legion Onboarding Findings v1](../01-current-state/findings-v1.html) puts both flows, the funnel and all 26 observations on one page.

**Types**

- **Safety:** a clinical or patient-safety gap. Fix before anything else.
- **Friction:** something that makes a patient slow down, doubt or leave. These are the likely drop-off points.
- **Data gap:** information the flow fails to collect, collects twice, or collects without checking it.
- **Functional:** a bug, inconsistency or missing control.

**Screen IDs** (A1, B8, C7…) match the Screen-by-screen map in *Legion Onboarding — Current Funnel Map (v1)*. **Seen at** gives the recording round and mm:ss. Quotes are Jay's own words, cleaned up lightly from the transcript.

**Persona:** a prospective patient in Texas, unsure what kind of care she needs. Round 1 used an email that already had an account. Round 2 used a new email in incognito: self-pay in the care flow, then UnitedHealthcare, BCBS and Aetna in the portal.

## Observations by funnel step

Observations run in the order a patient meets them: marketing site, care flow, then portal. O-11 is the one to fix first. O-14, O-20 and O-22 explain the 36.6% drop at provider selection.

| ID | Screen · seen at | What happens | In Jay's words | Type | Funnel link |
| --- | --- | --- | --- | --- | --- |
| O-01 | A1, A2 · R1 01:40–02:40 | Both hero CTAs go straight into booking. Browse Providers shows ratings and bios, but every card says "No availability found in the next few days". Nothing asks why the patient is here. | "Browse providers is not where I would start because I don't have much of an understanding." | Friction | Before 1. Start |
| O-02 | A1 · R1 03:10 | The hero promises "No waitlists" and registration "in under 3 minutes". The carousel and the portal match page show the opposite. | — | Friction | Before 1. Start |
| O-03 | B2, B3 · R1 03:35 | Account creation (email and a 6-digit code) comes before any question about care. | "Sign up before you even know what I'm looking for." | Friction | Not tracked |
| O-04 | B3 · R1 03:50 | An email that already has an account jumps straight to Find a provider at 85%, skipping intake. Jay had to sign out, try another email, then go incognito. | "Straight to provider. Why?" | Functional | Not tracked |
| O-05 | B4 · R2 01:25 | The progress bar drops from 18% to 4% after the account is created. | — | Functional | Not tracked |
| O-06 | B4 · R2 01:10 | Plan tiles ask for a carrier only. No member ID and no eligibility check, so the patient can't tell if they're covered. Medicaid and Medicare are "Coming soon". | "What if the email is not connected to one of these accounts?" | Data gap | Not tracked |
| O-07 | B5 · R2 01:45 | The date-of-birth picker opens on Nov 1996, with no reason given. | "Automatic choosing, I'm guessing. But why?" | Functional | Not tracked |
| O-08 | B6, B7 · R2 02:05–02:45 | The phone check fails into a manual form. The address isn't validated: a Fremont city with Texas ZIP 78701 saved. | "It has no idea what my address is." | Data gap | Not tracked |
| O-09 | B8, B9 · R2 02:58–03:30 | The safety and hospitalization questions are right to ask. They assume the patient is the account holder, and nothing says whether someone can book for another adult. | "This is clearly asking for you, not on behalf of." | Functional | Not tracked |
| O-10 | B10 · R2 03:32 | 14 diagnostic labels, including Borderline personality and Schizophrenia. A patient without a diagnosis falls back to "Not sure yet". | "I don't know these terminologies. I just want to talk to some psychiatrist." | Friction | Not tracked |
| O-11 | B12 · R2 04:05–05:10 | Jay answered No to the safety question, then typed "suicidal thoughts" into the free-text box. The flow moved on to records consent and booking. No follow-up question, no crisis resource, no visible flag. | — | Safety | Not tracked |
| O-12 | B12 to B14 · R2 05:10–06:00 | The free text carried real context: stress, a single parent, a son struggling at school. The next screen sorts clinicians by earliest opening and ignores it. | "It has no idea what I really need." | Data gap | Not tracked |
| O-13 | B13 · R2 05:30 | Records consent has one Continue button. No opt-out, no list of which records, no word on who sees them. | — | Functional | Not tracked |
| O-14 | B14 · R2 06:00–06:50 | Find a provider is sorted by soonest opening. Cards show near-identical chips (ADHD, Anxiety, Bipolar, Depression), no ratings (the marketing site had them), no filters, no reason to pick one. | "Is availability really the promise that we want to show?" | Friction | Like 7. Provider selected |
| O-15 | B14 · R2 07:10 | For a self-pay patient, "Update your insurance" ends at a phone number. | "So now I have to make a call." | Friction | Not tracked |
| O-16 | B15–B17 · R2 07:40–08:40 | The $250 first visit comes with no word on what it covers or when it's charged; "You won't be charged today" doesn't say when. Card entry is manual, with no Link, Apple Pay or Google Pay. Jay stopped before confirming. | "I don't know what I'm paying for, when I'm gonna be paid." | Friction | Like 11. Payment page |
| O-17 | C3 · R2 10:50–12:15 | Signed in on the same account, the portal asks "What brings you here?" again, with 7 options instead of 14. Nothing from the care flow carries over. | "I'm the same account, I don't know why you're asking me again." | Data gap | 3. Conditions |
| O-18 | C5 · R2 12:50 | "Already diagnosed or new diagnosis" is the most useful routing question. It only exists in the portal, at step 3; the care flow never asks it. | "This question exists, but it exists at a different point." | Data gap | 5. Needs |
| O-19 | C4 · R2 12:40 | Picking a plan returns "Great! We accept your insurance plan. Most patients pay $0–$40 per session" with no member ID or eligibility check. | "What is the scope? Is this based off of my plan?" | Data gap | 4. Insurance |
| O-20 | C6 · R2 13:20 | Five animated checks, then "Perfect match found!" Right under it: "All our providers who work with UNITED HEALTHCARE are unavailable. Please call…" | "Perfect match found, how? On what basis?" | Friction | 6. Provider match |
| O-21 | C6 · R2 16:50 | Jay picked Blue Cross Blue Shield; the banner says "TEXAS BLUE SHIELD". | — | Functional | 6. Provider match |
| O-22 | C7 · R2 13:40–15:50 | Every matched clinician is "fully booked". No next-available date, no waitlist, no filter; Show More Providers adds more booked cards. Ratings show, but reviews can't be read, and the order is unclear (4.9 sits above 5.0). | "If everybody's booked, why am I here? You have nothing to give me." | Friction | 7. Provider selected |
| O-23 | B14 vs C7 · R2 06:00, 16:40 | Self-pay in the care flow showed openings the next day. All three plans tried in the portal showed none. Availability may depend on payer network, but neither screen says so. | "For new diagnosis there is nothing available. That's what I'm guessing, but that's not what it's saying." | Data gap | 6. and 7. |
| O-24 | B15 · R2 07:50 | The patient first learns the visit is a 60-minute video call on the confirm screen. Nothing explains what happens in it. | "I don't know what I get out of this platform." (R1) | Friction | Not tracked |
| O-25 | All · both rounds | Neither flow handles "I don't know what I need yet". Both assume the patient knows their diagnosis and is just booking. | "The assumption is that the user already knows everything about what they want to do." | Friction | 2. to 7. |
| O-26 | After booking | Nothing after booking is tracked or shown: no confirmation, reminders, pre-visit steps, or visit-joined event. | — | Data gap | After 11. |

## Cross-cutting themes

Six patterns explain most of the 26 observations, and three of them sit on the two biggest drops in the PostHog funnel.

| Theme | Observations | Where it hits the funnel |
| --- | --- | --- |
| **It asks before it gives.** Account, identity and plan come before any sense of fit, price or what the visit is. | O-01, O-03, O-06, O-24, O-25 | Likely behind the 34.8% drop from fit check to conditions. The care flow has no data to check this. |
| **Matches come without reasons, and often without open slots.** Lists are sorted by availability or an unstated rank, with no reason tied to the patient's answers. When the patient is insured, every clinician shown is booked. | O-12, O-14, O-20, O-22, O-23 | The 36.6% drop from match page to provider selected |
| **Money is uncertain.** Coverage is claimed without checking, the price is given without a breakdown, the charge date isn't stated, and self-pay ends in a phone call. | O-06, O-15, O-16, O-19 | Payment page, and after it, where nothing is measured |
| **Safety signals aren't connected.** The safety screen is one yes/no for self only. What the patient types later isn't screened. | O-09, O-11 | Clinical risk on every session, whatever the conversion numbers say |
| **Two flows, no shared memory.** Same questions twice with different option lists. A returning email skips intake. The key routing question only lives in one flow. | O-04, O-05, O-17, O-18, O-21 | Splits sessions; inflates repeat starts |
| **Measurement stops at the payment page.** Nothing shows booking, payment, show rate or the first visit. | O-26 | The brief's success metric has no data |

## Open questions to verify

These decide how far the v1 read holds. Most can be answered with one more walkthrough or a question to Legion.

- [ ] What is on `/portal/join/fit`? It's the biggest drop (34.8%), and neither round saw it. Walk `/portal/join` signed out.
- [ ] Are the care flow and the portal an A/B test, a migration, or two audiences? Which one gets paid traffic? `utm.params.applied` fired in 1,717 portal sessions.
- [ ] Is clinician availability gated by payer credentialing? How much open supply is there per plan in Texas?
- [ ] What happens on "Yes" to the safety or hospitalization questions?
- [ ] Is the free text (B12) read by anyone before the visit? Is it screened for risk?
- [ ] When is the $250 self-pay charge taken, and is there a no-show or late-cancel fee?
- [ ] What are the show rate and the median days from booking to first visit? These need data outside the brief.
- [ ] Can one adult book for another adult (a spouse or parent)? Minors are out of scope for Legion today.
