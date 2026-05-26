# Project File Templates

Templates for `.shepherd/` project files. Customize to your project's tech stack and patterns.

The `spec.md` template lives in `skills/spec/SKILL.md` (single canonical source).
The `plan.md` template lives in `skills/plan/SKILL.md` (single canonical source).
The templates below cover the artifacts that have no backing skill.

## standards.md

```markdown
# Project Standards

These standards define the quality bar. Every line of code must meet them.
Subagents: read this file before writing any code.

## Code Quality

Write code that a senior staff engineer would be proud of. Not "good enough" — exceptional.

- Names reveal intent. If you need a comment to explain what something does, rename it.
- Functions do one thing. If you're describing what a function does with "and", split it.
- Error handling is explicit. No swallowed errors, no empty catch blocks.
- No type safety escape hatches (`as any`, `@ts-ignore`, `@ts-expect-error`).

## Testing

- Write tests first (TDD). Test describes behavior, not implementation.
- Every public API has tests. Every error path has tests.
- Tests are independent — no shared mutable state, no order dependence.
- Assertions are specific. `toBe(expected)` not `toBeTruthy()`.
- Generated acceptance tests are separate from unit tests and do not replace TDD unit coverage.

## Acceptance Specs

- Parser command: [command or "to be created in Acceptance Pipeline Setup" or "USER-APPROVED WAIVER: reason/date"]
- Structured IR path: [path]
- Generator command: [command or "to be created in Acceptance Pipeline Setup" or "USER-APPROVED WAIVER: reason/date"]
- Generated acceptance-test location: [path]
- Runner command: [command or "to be created in Acceptance Pipeline Setup" or "USER-APPROVED WAIVER: reason/date"]
- Normal acceptance command: [command or "to be created in Acceptance Pipeline Setup" or "USER-APPROVED WAIVER: reason/date"]
- Acceptance-spec mutation command: [command or "to be created in Acceptance Pipeline Setup" or "USER-APPROVED WAIVER: reason/date"]
- Acceptance mutation report location: [path]
- Timeout/status expectation: [how long-running mutation reports progress]
- Source-code mutation command: [command or "not configured for this project" or "USER-APPROVED WAIVER: reason/date"]
- Accepted limitations: [none or explicit signed-off gaps]

## Architecture

- Dependencies flow inward. Core logic never imports from infrastructure.
- Interfaces at boundaries. Concrete implementations behind abstractions at system edges.
- No premature abstraction. Three concrete uses before extracting a pattern.
- Configuration is explicit. No magic strings, no implicit defaults.

## Git

- Each commit is a single logical change that compiles and passes tests.
- Commit messages explain WHY, not WHAT. The diff shows what changed.
- No merge commits in feature work. Rebase onto main.
```

## progress.md

```markdown
# Project Progress

## Current Status
**Phase:** Setup / Milestone N / Complete
**Current milestone:** [name]
**Current task:** [name or "between tasks"]
**Last action:** [what just happened]

## Acceptance Pipeline Setup

| Item | Status | Evidence |
|------|--------|----------|
| Executable behavior examples | pending/passed/failed/accepted limitation | [path/details] |
| Parser / IR generation | pending/passed/failed/accepted limitation | [command + output path] |
| Generator / generated tests | pending/passed/failed/accepted limitation | [command + output path] |
| Runner adapter | pending/passed/failed/accepted limitation | [command + output path] |
| Normal acceptance | pending/passed/failed/accepted limitation | [command + output path] |
| Acceptance mutation | pending/passed/failed/accepted limitation | [command + report path] |

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
- Decision: proceed / fix spec / fix binding / fix implementation / accepted limitation

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
