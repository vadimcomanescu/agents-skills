# Shepherd Live Code Playground

Use this playground when changing Shepherd orchestration behavior. It is for real code edits, not planning-only artifacts.

## Purpose

The playground proves whether a Shepherd workflow change improves actual implementation behavior. A planning eval can show that the right roles appear in a plan; this playground checks whether the roles change code, tests, refactoring, architect hardening, or fixes in a useful way.

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
5. Run the changed Shepherd role or workflow step being evaluated. For role-ownership changes, run the architect-hardening pass on the implementer output.
6. Capture the after commit or `no commit`, code diff, test output, and what changed.
7. Write a short comparison: what improved, what did not improve, and what remains unproven.

## Pass Bar

- The implementation must pass `npm test`.
- The comparison must cite concrete changed files or state `no commit`.
- The report must not claim better quality unless the after state changed code, tests, evidence, architect findings, or fix behavior in a concrete way.
- If the after pass makes no change, report that the eval did not prove a quality improvement for that run.

## True Shepherd Invocation

For workflow changes that affect Shepherd role ownership, run one real Codex invocation against a disposable copy of this fixture in addition to deterministic harness checks. The invocation must point at the local source skill being edited, not a stale globally installed copy:

```bash
rm -rf /tmp/shepherd-live-role-eval
mkdir -p /tmp/shepherd-live-role-eval
cp -R evals/shepherd-live-code-playground/fixture /tmp/shepherd-live-role-eval/repo
git -C /tmp/shepherd-live-role-eval/repo init
git -C /tmp/shepherd-live-role-eval/repo add .
git -C /tmp/shepherd-live-role-eval/repo commit -m 'fixture baseline'

timeout 600 codex --sandbox workspace-write --ask-for-approval never exec \
  --json \
  -C /home/vadim/Code/agents-skills \
  --add-dir /tmp/shepherd-live-role-eval/repo \
  --output-last-message /tmp/shepherd-live-role-eval/last-message.txt \
  "Use the local agents-skills:shepherd skill from /home/vadim/Code/agents-skills/skills/shepherd/SKILL.md for this live eval. Target repo: /tmp/shepherd-live-role-eval/repo. Do not modify /home/vadim/Code/agents-skills. In the target repo, implement the promotion-code behavior described in /home/vadim/Code/agents-skills/evals/shepherd-live-code-playground/prompts/promotion-code-task.md through one compact Shepherd milestone: update .shepherd state as coordinator, make the code/test change, run npm test, then perform an architect-hardening record in .shepherd/progress.md that explicitly separates normal verification, source-code mutation, acceptance-spec mutation, and any waivers. Keep it small and autonomous; no user questions."
```

Record the scratch commit hash, `npm test` output, `.shepherd/progress.md`, and the code diff. If the globally installed skill differs from `skills/shepherd/SKILL.md`, report that fact and use the local source path for the eval.
