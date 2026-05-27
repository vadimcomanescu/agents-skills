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
- Normal verification command: [command]
- Lint/type command: [command or "not configured"]
- Generated acceptance tests are separate from unit tests and do not replace TDD unit coverage.

## Normal Acceptance (Implementer)

- Parser command: [command or "implementer task required" or "USER-APPROVED WAIVER: reason/date"]
- Structured IR path: [path]
- Generator command: [command or "implementer task required" or "USER-APPROVED WAIVER: reason/date"]
- Generated acceptance-test location: [path]
- Runtime/step handler location: [path]
- Normal acceptance command: [command or "implementer task required" or "USER-APPROVED WAIVER: reason/date"]

## Mutation Hardening (Architect)

- Mutation runner adapter command: [command or "architect task required" or "USER-APPROVED WAIVER: reason/date"]
- Acceptance-spec mutation command: [command or "architect task required" or "USER-APPROVED WAIVER: reason/date"]
- Acceptance-spec mutation report location: [path]
- Timeout/status expectation: [how long-running mutation reports progress]
- Source-code mutation command: [command or "not configured for this project" or "USER-APPROVED WAIVER: reason/date"]
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

## Acceptance And Mutation Evidence

| Item | Status | Evidence |
|------|--------|----------|
| Executable behavior examples | pending/passed/failed/accepted limitation | [path/details] |
| Parser / IR generation | pending/passed/failed/accepted limitation | [command + output path] |
| Generator / generated tests | pending/passed/failed/accepted limitation | [command + output path] |
| Runtime / step handlers | pending/passed/failed/accepted limitation | [path/details] |
| Normal acceptance | pending/passed/failed/accepted limitation | [command + output path] |
| Mutation runner adapter | pending/passed/failed/accepted limitation | [command + output path] |
| Acceptance-spec mutation | pending/passed/failed/accepted limitation | [command + report path] |
| Source-code mutation | pending/passed/failed/not configured/accepted limitation | [command + report path] |

### Latest Acceptance Mutation Result

- Command: [command]
- Exit code: [code]
- Report: [path]
- Total: [N]
- Killed: [N]
- Survived: [N]
- Errors: [N]
- Survivor paths: [list]
- Error details: [text]
- Decision: proceed / fix spec / fix binding / fix implementation / fix pipeline / accepted limitation

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
| Implementer verification | pending/passed/failed/accepted limitation | [unit/acceptance/lint/type results] |
| Refactorer pass | pending/passed/failed/not applicable | [worktree/branch/commit or no commit] |
| Architect hardening | pending/approved/request changes/accepted limitation | [worktree/branch/commit, mutation/evidence paths, verdict] |

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
