# Build Spec

## Existing Architecture
This is an existing nextjs repository. Source roots: app, lib.
Test roots: tests.

## Constraints
- Extend the current repository.
- Preserve current architecture unless a PRD item requires change.
- Verify through `make check` and `make test`.

## Architecture Decisions
- ADR-001: Derive the evidence review status summary from existing client-side review state in `app/evidence-review-workflow.tsx`. Use `seededEvidenceReview.criteria`, `criterionStates`, and selected evidence IDs rather than adding persistence, API routes, or duplicated verdict state.
- ADR-002: Render the blocker callout from the existing `calculateReviewVerdict` result. Blocked and rejected states list `verdict.reasons`; accepted state renders the accepted verdict message.
- ADR-003: Build the status summary before the blocker callout because `prd.json` marks `evidence-review-blocker-callout` as dependent on `evidence-review-status-summary`.

## Build Order
1. Add derived status summary data for required criteria in `app/evidence-review-workflow.tsx`: passing with selected evidence, failing, unreviewed, and missing evidence.
2. Render the status summary near the existing final verdict section with stable test IDs and `aria-live` behavior so browser tests can observe updates after verdict/evidence changes.
3. Add the blocker callout beside the final verdict UI using the existing `verdict.status` and `verdict.reasons`.
4. Extend tests to cover the initial blocked summary, changes after marking a criterion pass and choosing evidence, blocked/rejected reason visibility, and the accepted-state callout.
5. Verify with the repository make targets from `BUILD_GUIDE.md`: `make check`, `make test`, and, if UI changes are exercised end to end, `make test-e2e`.

## Feature Work
- evidence-review-status-summary: Add a compact status summary to the evidence review workflow so a developer can immediately see how many required acceptance criteria are passing, failing, unreviewed, or missing evidence. (When the evidence review workflow is open, the UI shows a status summary derived from the current criterion review state, and that summary updates when a criterion verdict or selected evidence changes.)
- evidence-review-blocker-callout: Add a visible blocker callout to the evidence review workflow that lists the concrete reasons the current review cannot be accepted. (When the evidence review workflow is blocked or rejected, the UI lists the current verdict reasons in a stable, testable callout; when the review becomes accepted, the callout changes to an accepted-state message.)
