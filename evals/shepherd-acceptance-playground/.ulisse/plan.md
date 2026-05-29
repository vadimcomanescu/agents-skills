# Plan

## evidence-review-status-summary: Add evidence review status summary
- Behavior: When the evidence review workflow is open, the UI shows a status summary derived from the current criterion review state, and that summary updates when a criterion verdict or selected evidence changes.
- Verification: Open the playground app., Open the evidence review workflow., Review the status summary before changing any criteria., Mark a required criterion pass and choose evidence., Confirm the summary reflects the updated criterion state.

## evidence-review-blocker-callout: Add evidence review blocker callout
- Behavior: When the evidence review workflow is blocked or rejected, the UI lists the current verdict reasons in a stable, testable callout; when the review becomes accepted, the callout changes to an accepted-state message.
- Verification: Open the playground app., Open the evidence review workflow., Confirm blocked or rejected verdict reasons are visible., Complete the required review criteria with passing verdicts and selected evidence., Confirm the callout changes to the accepted-state message.
