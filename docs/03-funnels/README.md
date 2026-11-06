# New funnels with embedded A/B tests

> Status: *ready.* See [the new flow](new-flow.html) for every stage and how much of it is prototyped. Bundle A (talk first) is written up as [PRD v3](prd-v3.md) and [Prototype Spec v3](prototype-spec-v3.md). Earlier versions: [PRD v2](prd-v2.md), [v1](prd-v1.md); [Spec v2](prototype-spec-v2.md), [v1](prototype-spec-v1.md).

## The rule every funnel follows

**Ask about the patient's need before insurance, payment or scheduling. Safety questions stay early** ([D-10](../decision-log.md)).

Today the care flow first asks why you're here on screen 10 of 17. Changing the order of individual screens won't fix that. Each new funnel starts from the patient's need and brings in the business steps only once the patient has a reason to finish them.

## Candidate bundles

- **A. Talk first (lead):** H-00, H-01, H-02, H-06, H-07, H-08. This bundle tests the thesis most directly, so it is built first.
- **B. Know your cost first:** H-04, H-11, H-12, H-13
- **C. A real slot, explained:** H-03, H-09, H-10, H-13

B and C still open with the patient's need. They differ in what comes right after it.

Each funnel will list its screens, the tests embedded in it, how traffic is split, and the metric that decides it.
