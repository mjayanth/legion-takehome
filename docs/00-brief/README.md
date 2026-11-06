# The brief and the given telemetry

Source: [Founding Product Take-Home](https://legionhealth.notion.site/Founding-Product-Take-Home-3cb55acd66fd81a691d7fb936f921b7b) (Legion Health, Notion). Summarized here so the repo stands on its own; the Notion page is the authority.

## The ask

- Go through Legion's current onboarding as a prospective patient in Texas.
- Rebuild patient onboarding for an AI-native world.
- Onboarding ends when the patient's **first visit is completed**, not when it is booked or scheduled.
- Submit a deployed working prototype, the repository with an open pull request, a recorded walkthrough of about five minutes, and the complete, unedited history of every AI interaction (redact only credentials, secrets or unrelated personal information, and label each redaction; no real patient information).

## Telemetry given

Aggregate PostHog production data, rolling 30 days ending Aug 29, 2026, host `app.legionhealth.com` only. The unit is browser sessions, not patients. It covers the portal flow up to the payment page; there is no first-visit milestone.

| Phase | Page or action | Sessions | From previous | From start | Dropped |
| --- | --- | --- | --- | --- | --- |
| 1. Start | `/portal/join` | 5,898 | 100.0% | 100.0% | — |
| 2. Fit check | `/portal/join/fit` | 5,490 | 93.1% | 93.1% | 408 (6.9%) |
| 3. Conditions | `/portal/join/conditions` | 3,578 | 65.2% | 60.7% | 1,912 (34.8%) |
| 4. Insurance | `/portal/join/insurance` | 3,338 | 93.3% | 56.6% | 240 (6.7%) |
| 5. Needs | `/portal/join/needs` | 3,095 | 92.7% | 52.5% | 243 (7.3%) |
| 6. Provider match | `/portal/join/match` | 3,013 | 97.4% | 51.1% | 82 (2.6%) |
| 7. Provider selected | `portal.provider_selected` | 1,909 | 63.4% | 32.4% | 1,104 (36.6%) |
| 8. Reservation created | `portal.provider.reservation.created` | 1,764 | 92.4% | 29.9% | 145 (7.6%) |
| 9. Patient details | `/portal/join/patient` | 1,763 | 99.9% | 29.9% | 1 (0.1%) |
| 10. Account created | `portal.onboarding.userCreated` | 1,403 | 79.6% | 23.8% | 360 (20.4%) |
| 11. Payment page | `/portal/join/payment` | 1,403 | 100.0% | 23.8% | 0 (0.0%) |

The brief notes that a reservation is not a completed appointment, and that payment-page reach is not a successful payment: no payment-success or onboarding-complete event was observed.

## What we found about this data

The marketing site's "Book Appointment Now" now leads to a different flow on `care.legionhealth.com`, which this telemetry does not cover. See [Current state](../01-current-state/).
