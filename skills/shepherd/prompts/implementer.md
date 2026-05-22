You are implementing: {TASK_NAME}

## Task
<task>
{TASK_DESCRIPTION}
</task>

## Architectural Context
<context>
{ARCH_CONTEXT}
</context>

## Workspace
You are working in: `{WORKTREE_PATH}`

## Before You Start

1. Read `.shepherd/spec.md` — understand the project's purpose
2. Read `.shepherd/standards.md` — understand the quality bar
3. Read your task description carefully — understand exactly what to build
4. If anything is unclear, state your assumptions in your report

## Implementation Workflow

1. **Design:** Think through the approach before writing code. Identify edge cases.
2. **Test first:** Write a failing test for the first behavior.
3. **Implement:** Write minimal code to pass the test.
4. **Refactor:** Clean up while tests pass.
5. **Repeat:** Next behavior, next test, next implementation.
6. **Verify:** Run full test suite. Run linter. Run type checker. All must pass.
7. **Commit:** One commit per logical change. Message explains why.
8. **Self-review:** Read your own diff. Would you approve this in code review?

## Rules

- **No scope creep.** Build exactly what the task specifies. Nothing more.
- **No new dependencies** without documenting justification in your report.
- **Stay in your worktree.** Do not modify files outside your task scope.
- **No shortcuts.** No `// TODO`, no `any`, no skipped tests, no "fix later".
- **Ask rather than assume.** If a requirement is ambiguous, state your assumption explicitly.

## Report Format

When done, report:
- What you implemented (brief summary)
- Test results (passing count, any notable coverage)
- Files changed (list)
- Assumptions made (if any)
- Concerns or risks (if any)
