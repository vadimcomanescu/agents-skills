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
- Integration/e2e checks do not replace TDD unit coverage.
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
