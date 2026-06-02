# Project File Templates

Templates for `.shepherd/` project files. Customize them from repo truth; do
not keep placeholder rules that are not real for the target project.

The `spec.md` template lives in `skills/spec/SKILL.md` (single canonical source).
The `plan.md` template lives in `skills/plan/SKILL.md` (single canonical source).
The templates below cover the artifacts that have no backing skill.

## standards.md

```markdown
# Project Standards

Project rules, relevant skill guidance, verification commands, and accepted
waivers for this Shepherd run. The planner and subagents read this before
choosing task architecture or editing.

## Code Quality

- [Project-specific rules discovered from repo docs and relevant skills]

## Relevant Skill Guidance

- Relevant skills studied: [skill names]
- Current external docs checked: [library/API docs or "not applicable"]
- Applicable patterns: [project-applicable best practices or architectural patterns]
- Patterns to avoid: [anti-patterns, deprecated approaches, or repo-specific prohibitions]
- Ownership boundaries: [client/server/API/module/data-flow ownership]
- Planning implications: [how these rules change task order, task boundaries, or verification]

## Testing

- Unit test command: [command]
- Integration/e2e command: [command or "not configured"]
- Lint/type command: [command or "not configured"]
- Hardening command: [command or "not configured"]
- Behavior-changing implementation follows `tdd-mutation`; integration/e2e checks supplement it.
- Accepted limitations: [none or explicit signed-off gaps]

## Architecture

- [Project-specific boundary, dependency, and adapter rules]
```

## progress.md

```markdown
# Project Progress

## Current Status
**Phase:** Setup / Milestone N / Complete
**Current milestone:** [name]
**Current stage:** [Intent / Spec Draft / Spec Review / Spec Approval / Verification Plan / Standards / Plan / Select / Implement / Refactor / Evidence / QA / Architect / Repair / Close / Final QA / Final Architect / Validators / Cleanup and Report]
**Next action:** [specific dispatch, repair, command, or user decision]
**Last action:** [what just happened]

## Source Artifact Revisions

- Spec: `.shepherd/spec.md` at [commit, dirty-worktree fingerprint, or pending]
- Verification: `.shepherd/verification.md` at [commit, dirty-worktree fingerprint, or pending]
- Standards: `.shepherd/standards.md` at [commit, dirty-worktree fingerprint, or pending]
- Plan: `.shepherd/plan.md` at [commit, dirty-worktree fingerprint, or pending]
- Latest behavior revision: [commit, dirty-worktree fingerprint, state-file path, or pending]

## Open Blockers

- [blocker, owner artifact, required next action, or "none"]

## Run Log

### [timestamp] [Stage]
- Input artifacts read: [spec, verification, standards, plan, progress, logs]
- Decision: [pass/fail/request changes/waived/blocked]
- Evidence checked: [commands, output paths, evidence paths, validator output]
- Changes made: [files, branches, commits, or "none"]
- Next action: [specific dispatch, repair, command, or user decision]

## Setup Gate State

- Intent: pending/passed/blocked, evidence [path or note]
- Spec Draft: pending/passed/blocked, evidence [path or note]
- Spec Review: pending/passed/blocked, evidence [review output path, HTML path]
- Spec Approval: pending/passed/blocked, evidence [approval note, revision]
- Verification Plan: pending/passed/blocked, evidence [validator output path]
- Standards: pending/passed/blocked, evidence [repo docs and skill guidance checked]
- Plan: pending/passed/blocked, evidence [plan status and sign-off]

## Current Milestone

### Scope
- Milestone: [name]
- AC IDs: [AC-001, AC-002]
- Plan tasks: [task names]
- Worktrees/branches: [coordinator-named paths and branches]

### Stage Verdicts
- Implementer: pending/passed/failed, commit/evidence [details]
- Refactorer: pending/passed/failed/waived, commit/evidence [details]
- Validators: pending/passed/failed, output [details]
- QA: pending/pass/fail/waived, report [details]
- Architect: pending/approve/request changes, report [details]

### Evidence State
- Accepted evidence: [AC -> artifact path, revision, freshness]
- Stale evidence: [AC -> reason, required rerun]
- Candidate evidence not yet accepted by QA: [AC -> artifact path]
- Waivers: [AC -> user approval text and scope]

### Repair Cycles
- Cycle 1: [finding source, repair task, commit, verification, QA/architect result]
- Cycle 2: [if any]
- Cycle 3: [if any]

## Completed Milestones

### Milestone 1: [Name] COMPLETE
- Closed at: [revision]
- ACs accepted: [IDs]
- Evidence: [paths]
- Repair iterations: [N]
- Deferred items: [any issues punted]

## Decisions Log

### Decision: [topic]
- Options considered: [A, B, C]
- Chose: [B]
- Rationale: [why]
- Trade-offs accepted: [what you gave up]

## Architecture State

### Components
- [Component]: [purpose, key files]

### Connections
- [Component A] -> [Component B]: [how they communicate]

### Patterns Established
- [Pattern]: [where used, why chosen]

### Known Issues
- [Issue]: [severity, plan to address]
```
