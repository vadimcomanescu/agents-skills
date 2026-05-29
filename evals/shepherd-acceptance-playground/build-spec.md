# Build Spec

## Existing Architecture
This is an existing node repository. Source roots: app, lib.
Test roots: tests.

## Constraints
- Extend the current repository.
- Preserve current architecture unless a PRD item requires change.
- Verify through `make check` and `make test`.

## Feature Work
- evidence-review-affordance: Add a small UI affordance that makes the evidence review workflow easier to inspect without changing existing behavior. (A developer can identify the evidence review workflow state from the playground UI while existing quote and evidence tests keep passing.)

## Architecture Decisions

1. Add the evidence review affordance inside `app/evidence-review-workflow.tsx`.
   - Extend the existing evidence review UI instead of adding a route, API, persistence surface, or new architecture layer.
   - Evidence: `app/page.tsx` already renders `EvidenceReviewWorkflow`; `target-docs/INDEX.md` and `BUILD_GUIDE.md` identify `app` and `lib` as the source roots.

2. Derive the affordance from existing review state.
   - Use the current computed verdict, workflow mode, and seeded review metadata already owned by `EvidenceReviewWorkflow`.
   - Evidence: `lib/evidence-review.ts` defines verdict behavior; `app/evidence-review-workflow.tsx` already computes the verdict and renders current workflow mode.

3. Verify through the existing Node and browser checks.
   - Add or update focused browser coverage for the visible affordance, then run `make check` and `make test-e2e`.
   - Evidence: `BUILD_GUIDE.md` maps `check` to `npm test` and `test-e2e` to `npm run test:browser`; `tests/acceptance.spec.ts` already covers review workflow UI behavior.

## Build Order

1. Add a small state affordance to `app/evidence-review-workflow.tsx` near the existing seeded review item or opened workflow header.
2. Reuse existing values from `seededEvidenceReview`, `verdict`, and `workflowMode`; do not add new domain state.
3. Keep styling in `app/globals.css`, matching the existing review card/panel patterns.
4. Update focused browser coverage in `tests/acceptance.spec.ts` so a developer can locate the evidence review workflow state from the playground UI.
5. Run `make check` and `make test-e2e`; use `make build` if the UI or framework compilation surface changes.
