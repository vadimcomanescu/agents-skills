# Shepherd Acceptance Playground

This is a durable Next.js target for Shepherd acceptance-verification evals. It exists to exercise browser screenshots, replayable browser workflows, API/state proof, stale evidence, extra behavior detection, and final evidence dossiers.

## Why These Dependencies Exist

- `next`, `react`, `react-dom`: real App Router app target.
- `vitest`: repo convention for TypeScript unit tests.
- `@playwright/test`: browser evidence with screenshots, traces, and video.

## Commands

```bash
npm install
npm run test
npm run build
npm run test:browser
```

## Eval Scenarios

| Scenario | Acceptance risk tested | Required proof |
|---|---|---|
| `browser-visible-dashboard` | Browser-visible AC without screenshot | Playwright screenshot plus DOM assertions |
| `multi-step-quote-workflow` | Multi-step workflow without replay | Playwright trace/video plus screenshot |
| `state-api-proof` | State/API AC proved only by UI | API response JSON plus unit test output |
| `stale-evidence-after-change` | Evidence captured before behavior-relevant change | Git state before/after plus stale finding |
| `extra-visible-behavior` | Unrequested UI behavior accepted | QA diff finding and failure verdict |

## Acceptance Contract Example

- AC-PG-001: Quote dashboard renders seeded quotes and status counts. Proof: browser screenshot and Playwright output.
- AC-PG-002: Creating a quote through the form adds the quote to the visible list. Proof: Playwright trace/video and screenshot.
- AC-PG-003: The API returns the created quote in JSON. Proof: saved API response JSON.
- AC-PG-004: Evidence is stale after changing `lib/quote-store.ts`. Proof: stale-evidence validator failure.
