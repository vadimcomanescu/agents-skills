# Shepherd Live Code Playground

Use this playground when changing Shepherd orchestration behavior. It is for real code edits, not planning-only artifacts.

## Purpose

The playground proves whether a Shepherd workflow change improves actual implementation behavior. A planning eval can show that the right roles appear in a plan; this playground checks whether the roles change code, tests, refactoring, review, or fixes in a useful way.

## Fixture

The fixture is a tiny Node.js order workflow:

- `fixture/src/orderController.js` validates order input and calculates totals.
- `fixture/tests/orderController.test.js` verifies existing behavior.
- `fixture/.shepherd/spec.md` describes the promotion-code feature.
- `fixture/.shepherd/standards.md` defines the verification command.

## Required Evaluation Shape

1. Copy `fixture/` to a scratch directory under `.shepherd/evals/`.
2. Initialize git in the scratch directory and commit the initial fixture.
3. Run the implementer pass on the task in `prompts/promotion-code-task.md`.
4. Capture the implementer commit, code diff, test output, and risks.
5. Run the changed Shepherd role or workflow step being evaluated. For the refactorer-lens change, run the refactorer pass on the implementer output.
6. Capture the after commit or `no commit`, code diff, test output, and what changed.
7. Write a short comparison: what improved, what did not improve, and what remains unproven.

## Pass Bar

- The implementation must pass `npm test`.
- The comparison must cite concrete changed files or state `no commit`.
- The report must not claim better quality unless the after state changed code, tests, evidence, review findings, or fix behavior in a concrete way.
- If the after pass makes no change, report that the eval did not prove a quality improvement for that run.
