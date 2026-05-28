# Project File Templates

Templates for `.shepherd/` project files. Customize them from repo truth; do
not keep placeholder rules that are not real for the target project.

The `spec.md` template lives in `skills/spec/SKILL.md` (single canonical source).
The `plan.md` template lives in `skills/plan/SKILL.md` (single canonical source).
The templates below cover the artifacts that have no backing skill.

## standards.md

```markdown
# Project Standards

Project rules, role-owned commands, and accepted waivers for this Shepherd run.
Subagents read this before editing.

## Code Quality

- [Project-specific rules discovered from repo docs and relevant skills]

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
**Current task:** [name or "between tasks"]
**Last action:** [what just happened]

## Verification Evidence

| Item | Status | Evidence |
|------|--------|----------|
| Unit tests | pending/passed/failed/accepted limitation | [command + output path] |
| Integration/e2e checks | pending/passed/failed/not configured/accepted limitation | [command + output path] |
| Lint/type checks | pending/passed/failed/not configured/accepted limitation | [command + output path] |
| Hardening checks | pending/passed/failed/not configured/accepted limitation | [command + output path] |
| QA | pending/passed/failed/waived | [QA report path + AC IDs] |
| Verification report | pending/fresh/stale | [verification report path + script output] |

## Completed Milestones

### Milestone 1: [Name] — COMPLETE
- Tasks completed: [list]
- Repair iterations: [N]
- Deferred items: [any issues punted]

## Current Milestone: [Name]

### Task Status
| Task | Status | Subagent | Notes |
|------|--------|----------|-------|
| [Task name] | pending/in_progress/complete/failed | [agent_id] | [notes] |

### Milestone Quality Gate
| Gate | Status | Evidence |
|------|--------|----------|
| Implementer verification | pending/passed/failed/accepted limitation | [unit/integration/lint/type results] |
| Refactorer pass | pending/passed/failed/not applicable | [worktree/branch/commit or no commit] |
| Architect hardening | pending/approved/request changes/accepted limitation | [worktree/branch/commit, hardening output, verdict] |
| QA | pending/approved/request changes/waived | [QA report, AC IDs, evidence paths] |

### Architect Feedback
[Latest architect findings, if in repair cycle]

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
- [Component A] → [Component B]: [how they communicate]

### Patterns Established
- [Pattern]: [where used, why chosen]

### Known Issues
- [Issue]: [severity, plan to address]
```

## verification.md

```markdown
# Verification Report

This generated report is derived from AC IDs in `.shepherd/spec.md`. It records how each AC will be proved and what evidence currently supports it. It must not redefine acceptance criteria or invent behavior beyond the approved spec.

| AC | Proof modality | Required artifacts | Milestone | QA result | Evidence | Verified revision | Evidence state | Waiver |
|---|---|---|---|---|---|---|---|---|
| AC-001 | [unit/browser screenshot/multi-step browser replay/API-state/manual/waiver] | [artifact types] | [milestone] | pending | pending | pending | pending | none |

## Evidence Freshness

- Latest behavior-relevant commit or worktree fingerprint: pending
- Evidence captured after latest behavior change: no
- Stale evidence requiring rerun: all ACs pending implementation
```
