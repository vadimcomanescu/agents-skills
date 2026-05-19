# Project File Templates

Templates for `.shepherd/` project files. Customize to your project's tech stack and patterns.

## exploration.md

```markdown
# Codebase Exploration

## Tech Stack
- Language: [e.g., TypeScript 5.x]
- Framework: [e.g., Next.js 14]
- Database: [e.g., PostgreSQL with Prisma]
- Test framework: [e.g., Vitest]
- Build tools: [e.g., Vite, tsc]

## Key Directories
- `src/...`: [purpose]
- `tests/...`: [purpose]
- ...

## Conventions Observed
- Naming: [patterns used in this codebase]
- Layering: [how concerns are separated]
- Testing patterns: [TDD? snapshot? e2e?]
- Error handling: [conventions]

## Integration Points
- External services: [APIs, databases, queues]
- Internal dependencies: [shared libraries, modules]

## Constraints Discovered
- Legacy code: [areas to avoid or handle carefully]
- Deprecation paths: [things being phased out]
- Compatibility requirements: [browser support, runtime targets]
```

## plans.md

```markdown
# Project Plan

## Architecture Overview
[High-level description of the system. Components, data flow, key boundaries.]

## Milestones

### Milestone 1: [Name]
**Goal:** [What this milestone delivers]
**Depends on:** None

#### Tasks

##### Task 1.1: [Name]
- **Parallel:** yes/no
- **Files:** [src/auth/*, src/middleware/auth.ts]
- **Approach:** [How to implement — specific enough for a subagent]
- **Tests:** [What to test — happy path, error cases, edge cases]
- **Acceptance criteria:** [When is this task done?]
- **Status:** pending

##### Task 1.2: [Name]
- **Parallel:** yes (with 1.1) / no (depends on 1.1)
- **Files:** [...]
- **Approach:** [...]
- **Tests:** [...]
- **Acceptance criteria:** [...]
- **Status:** pending

### Milestone 2: [Name]
**Goal:** [...]
**Depends on:** Milestone 1

#### Tasks
[Same structure as above]
```

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

## Completed Milestones

### Milestone 1: [Name] — COMPLETE
- Tasks completed: [list]
- Review iterations: [N]
- Deferred items: [any issues punted]

## Current Milestone: [Name]

### Task Status
| Task | Status | Subagent | Notes |
|------|--------|----------|-------|
| [Task name] | pending/in_progress/complete/failed | [agent_id] | [notes] |

### Review Feedback
[Latest reviewer feedback, if in review cycle]

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
