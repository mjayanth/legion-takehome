# Rebuilding Legion's patient onboarding

Jay Madduru's submission for the Legion Health Founding Product take-home.

**The thesis:** today's onboarding puts insurance, payment and scheduling ahead of the patient's need. The care flow first asks why you're here on screen 10 of 17. The funnel drop-offs are a symptom of that, and tweaking individual screens won't fix it.

**Start here: [`index.html`](index.html)**, also served by GitHub Pages. It walks through the work in order, from the brief to the prototype, with every artifact one click away. [`docs/README.md`](docs/README.md) lists every document with its versions.

> Start page: **https://mjayanth.github.io/legion-takehome/** · Walkthrough: **https://youtu.be/Xg0KE33J9Ug** · Prototype PR: **[#1](https://github.com/mjayanth/legion-takehome/pull/1)**
>
> The prototype (v2) implements PRD v3: sign-up after fit and an insurance check before matching. The [roadmap](docs/roadmap.html) shows where things stand.

## The brief, in one line

Go through Legion's current onboarding as a prospective patient in Texas, then rebuild it for an AI-native world. Onboarding ends when the patient's **first visit is completed**, not when it is booked. ([Brief](https://legionhealth.notion.site/Founding-Product-Take-Home-3cb55acd66fd81a691d7fb936f921b7b))

## Reading order

| Step | What | Where |
| --- | --- | --- |
| 0 | The brief and the telemetry we were given | [`docs/00-brief/`](docs/00-brief/README.md) |
| 1 | Current state: two walkthroughs, a screen-by-screen funnel map, 26 observations | [`docs/01-current-state/`](docs/01-current-state/) · [findings page v2](docs/01-current-state/findings-v2.html) |
| 2 | Friction points, hypotheses and A/B tests | [`docs/02-hypotheses/`](docs/02-hypotheses/) · [hypotheses page v2](docs/02-hypotheses/hypotheses-v2.html) |
| 3 | The new funnel: PRD and prototype spec (v3) | [PRD v3](docs/03-funnels/prd-v3.md) · [Spec v3](docs/03-funnels/prototype-spec-v3.md) · [all versions](docs/03-funnels/README.md) |
| 4 | The prototype | [`prototype/`](prototype/README.md), on the `prototype` branch and its pull request |
| 5 | Decisions and backlog, kept current throughout | [`docs/decision-log.md`](docs/decision-log.md) · [`docs/feature-backlog.md`](docs/feature-backlog.md) |
| 6 | Five-minute walkthrough video | [YouTube](https://youtu.be/Xg0KE33J9Ug) · [what it covers](video/README.md) |
| 7 | Complete AI interaction history | [`ai-history/`](ai-history/README.md): the whole conversation, unedited, with labelled redactions |

Evidence behind step 1, the raw walkthrough transcripts, is in [`evidence/walkthroughs/`](evidence/walkthroughs/README.md).

## Repository layout

```text
legion-takehome/
├── index.html                 # the submission page (GitHub Pages)
├── README.md
├── docs/
│   ├── 00-brief/              # brief summary and given telemetry
│   ├── 01-current-state/      # funnel map, observations, findings page (v1, v2)
│   ├── 02-hypotheses/         # friction points, hypotheses, A/B tests (v1, v2)
│   ├── 03-funnels/            # PRD and prototype spec (v1, v2, v3), diagrams
│   ├── README.md              # every document, with versions
│   ├── roadmap.html           # where we are and what comes next
│   ├── decision-log.md
│   └── feature-backlog.md
├── evidence/walkthroughs/     # OpenScreen transcripts; recordings hosted elsewhere
├── prototype/                 # clickable prototype (prototype branch, via PR)
├── video/                     # walkthrough video link
└── ai-history/                # full AI interaction history, with labelled redactions
```

## Versioning

Every analysis artifact carries a version (`v1`, `v2`, …). A new version is a new file next to the old one, so a reviewer can see how the thinking moved. Decisions record which version they belong to.

## Branches and the pull request

- `main` holds the analysis, the submission page and the docs.
- The prototype is built on a `prototype` branch and opened as a pull request into `main`, as the brief asks. The PR description links back to the hypotheses and decisions it implements.

## How this was made

The analysis was done with Claude (Anthropic), directed by Jay: walkthroughs recorded in OpenScreen, transcripts pulled through OpenScreen's MCP server, docs written as living Claude Docs and exported here, one-page visuals built with Archify. The full, unedited conversation is in [`ai-history/`](ai-history/README.md).
