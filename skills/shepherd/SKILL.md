---
name: shepherd
description: Use when asked to build an entire project end-to-end, manage multi-milestone autonomous development, "build this project", "implement this end-to-end", or orchestrate long-running development that spans hours or days without human intervention
---

# Shepherd

Use Shepherd for long autonomous builds. Keep it simple: approved spec, approved plan, verified milestones, final proof.

## When To Use

- Use when the work spans multiple milestones, hours, or days.
- Use when the user asks for autonomous end-to-end delivery.
- Do not use for one-shot fixes, single-file edits, short debugging sessions, or work that needs approval after every small step.

## Workflow

```text
Setup:      intent -> spec -> review -> verification -> standards -> plan
Milestone:  select -> implement -> refactor -> evidence -> QA -> architect -> close
Finish:     final QA -> final architect -> validators -> cleanup/report
```

Advance only when the current stage has proof. If proof is missing, repair, waive, or stop.

## Artifacts

- Product truth: `.shepherd/spec.md`
- Build order: `.shepherd/plan.md`
- Proof map: `.shepherd/verification.md`
- Repo rules: `.shepherd/standards.md`
- Run log: `.shepherd/progress.md`
- Final report: `.shepherd/final-report.md`

`progress.md` records current state; it does not override the approved spec, plan, or proof map. Use `references/project-templates.md` for `standards.md` and `progress.md`. The `spec` and `plan` skills own their own formats.

## Dispatch

Use `prompts/*.md` only when dispatching that stage: implementer for behavior or repair, refactorer for behavior-preserving cleanup, QA for spec verification, architect for post-QA hardening.

## Setup

### 1. Intent

Create `.shepherd/progress.md`, invoke `interview-me`, and write confirmed intent into `.shepherd/spec.md` under `## Confirmed Intent`.

Gate:
- `.shepherd/spec.md` has `## Confirmed Intent`.
- Intent is confirmed by the user.
- `progress.md` records setup start.

### 2. Spec Draft

Invoke `spec`. Direct it to use `.shepherd/spec.md` as locked input and complete the spec there.

Gate:
- `.shepherd/spec.md` is complete.
- Behavior-changing work has stable AC IDs, testable behavior, proof targets, manual-only cases, approved exceptions, and no-extra-behavior boundaries.

### 3. Spec Review

Dispatch `prompts/spec-review.md`.

Gate:
- Spec Review output exists.
- Each behavior-changing AC is measurable, provable, owned, stale-evidence aware, and bounded.
- Product-semantic rewrites are visible before approval.

### 4. Spec Approval

Present the full spec review artifact for sign-off.

Gate: user approval, approved spec revision or dirty-worktree fingerprint, and approved exceptions are recorded.

### 5. Verification Plan

Create `.shepherd/verification.md` from the approved spec.

Gate:
- Every behavior-changing AC has a row.
- Rows reference approved AC IDs.
- Rows do not rewrite behavior.
- Evidence, artifact, freshness, `Milestone`, and waiver fields are explicit.
- This command passes:

```bash
python3 skills/shepherd/scripts/validate_verification.py --allow-pending .shepherd/verification.md
```

### 6. Standards

Create `.shepherd/standards.md` from repo truth and relevant skill truth.

Gate: repo commands, constraints, relevant skills, current docs when needed, and waivers are recorded from real sources. No placeholder commands.

### 7. Plan

Invoke `plan`. Direct it to read `.shepherd/spec.md`, `.shepherd/verification.md`, and `.shepherd/standards.md`, then write `.shepherd/plan.md`.

Gate:
- `.shepherd/plan.md` exists.
- Verification commands are executable in the target workspace.
- Behavior-changing milestones include implementation, refactor, QA, architect, and repair.
- `plan` returns `READY`.
- If `plan` returns `USER DECISION REQUIRED`, stop and present the decision.

### 8. Setup Close

Start autonomous milestone work only after approved `spec.md`, valid pending `verification.md`, complete `standards.md`, signed-off `plan.md`, and current `progress.md` agree.

## Milestones

### Select

Read `plan.md`, `verification.md`, `standards.md`, and `progress.md`. Choose the next milestone from the approved plan. Name worktrees and branches before dispatch.

Gate:
- Prerequisites are closed or waived.
- AC IDs and verification rows for this milestone are known.
- `progress.md` records selected tasks, branches, and expected evidence.

### Implement

Dispatch at most 5 parallel implementers in separate worktrees. Give each implementer the task, AC IDs, relevant architecture context, verification rows, and standards.

Gate:
- Repo-defined verification ran in each implementer worktree.
- Tests were not skipped, weakened, deleted, or diluted without waiver.
- Required candidate evidence exists.
- Work stayed in assigned scope.
- Only passing work is merged.

### Refactor

Dispatch refactorer from merged main for behavior-changing milestones unless explicitly waived.

Gate:
- Refactorer changes preserve behavior.
- Repo-defined verification ran if files changed.
- Affected AC evidence is marked stale when needed.

### Evidence

Update `.shepherd/verification.md` with candidate evidence paths, revision, and evidence state.

Gate:
- Validators ran after the latest verification or evidence change.
- Artifact paths exist.
- Evidence matches the proof modality in `references/verification-evidence.md`.
- Stale evidence is not accepted.

### QA

Dispatch QA from merged main after validators pass.

Gate:
- QA report gives `PASS`, `FAIL`, or `WAIVED` per AC.
- QA checked actual files, diff, commands, validators, and evidence.
- Waivers have explicit user approval.

### Architect

Dispatch architect only after QA passes.

Gate:
- Architect verdict is `APPROVE` or `REQUEST CHANGES`.
- Behavior-relevant architect changes mark affected evidence stale.
- QA reruns after behavior-relevant architect changes.

### Repair

Dispatch implementers for exact QA or architect findings. Repeat refactor, evidence, QA, and architect as needed.

Gate: the finding is fixed, verified, and rechecked by the stage that found it. Stop after 3 cycles on the same milestone and report the blocker.

### Close

Close a milestone only when implementation verification, refactor, evidence validators, QA, architect, and evidence freshness agree.

Gate: `progress.md` records summary, accepted evidence, architecture state, waivers, deferred work, and next milestone.

## Completion

### Final QA

Run QA across every AC in `.shepherd/spec.md` using `.shepherd/verification.md`.

Gate: every behavior-changing AC is `PASS` or user-approved `WAIVED`.

### Final Architect

Dispatch architect for final hardening across the full diff.

Gate:
- Final architect verdict is `APPROVE`.
- Behavior-relevant final hardening changes rerun QA.
- Critical final findings use the same repair loop, max 3 cycles.

### Validators

Run:

```bash
python3 skills/shepherd/scripts/validate_verification.py .shepherd/verification.md
python3 skills/shepherd/scripts/validate_evidence.py .shepherd/verification.md
python3 skills/shepherd/scripts/validate_freshness.py --allow-worktree-fingerprint .shepherd/verification.md
```

### Cleanup and Report

Remove non-main worktrees with `git worktree remove -f -f <path>`, then delete their branches. Keep proof artifacts cited by the final report.

Write `.shepherd/final-report.md` with shipped work, commands run, accepted limitations, deferred work, cleanup performed, and an AC matrix whose labels include `proof modality`, `required artifact`, `evidence`, `verified`, `evidence state`, `waiver`, and `qa result`.

Then run:

```bash
python3 skills/shepherd/scripts/validate_final_report.py .shepherd/verification.md .shepherd/final-report.md
```

## Blockers

Do not proceed as green when:

- verification fails without recorded pre-existing debt or waiver
- a repo-defined verification command is skipped without waiver
- `.shepherd/verification.md` is missing, incomplete, stale, or invalid
- evidence validators fail after the latest evidence or verification change
- source artifacts, validator output, stage verdicts, approval state, or `progress.md` disagree
- QA has not passed current behavior-changing ACs
- evidence, manifests, verification rows, or behavior-relevant files changed after QA without rerun
- proof requirements in `references/verification-evidence.md` are unmet
- unapproved extra user-visible behavior is present
- architect requests changes and repair has not run
- `progress.md` claims state that source artifacts do not support

## References

- `references/project-templates.md`: use when creating `standards.md` or `progress.md`.
- `references/verification-evidence.md`: use when creating `.shepherd/verification.md`, collecting evidence, running QA, or preparing completion.
- `prompts/*.md`: load only when dispatching that stage.
