# Acceptance-Spec Mutation

This reference defines how Shepherd records and judges executable acceptance
evidence. It is a verification gate, not a new orchestration topology.

## Responsibility Model

Shepherd separates responsibilities:

- `.shepherd/spec.md` owns externally visible behavior, acceptance criteria,
  and examples.
- Implementers build approved behavior slices with TDD, normal acceptance, and
  project-specific normal acceptance pipeline components when assigned.
- Refactorers preserve behavior while improving structure and testability.
- Architects run hardening after refactoring: architecture checks, configured
  source-code mutation, configured acceptance-spec mutation, and configured
  DRY/complexity checks.
- The coordinator dispatches roles and records evidence paths; it does not run
  mutation as the normal path.
- Handoffs and reports carry state and evidence. They do not tell the next role
  how to do its job.

## Pipeline Semantics

Normal acceptance proves the current app satisfies the feature file:

```text
feature file
  -> Gherkin parser
  -> JSON IR
  -> acceptance generator
  -> generated acceptance tests
  -> project test runner
```

Acceptance mutation probes whether generated acceptance tests are connected
strongly enough to fail when behavior-relevant example values change:

```text
feature file
  -> Gherkin parser
  -> base JSON IR
  -> one changed IR per mutation
  -> generated tests for each changed IR
  -> project test runner
  -> mutation report
```

Acceptance mutation mutates example values in the specification-derived JSON IR.
It does not mutate application source code.

## Result Interpretation

Use these terms exactly:

- `killed`: generated tests failed after the mutated spec value was used. The
  generated acceptance test detected the changed value.
- `survived`: generated tests passed after the mutated spec value was used. The
  spec, step binding, generated assertion, or implementation behavior is too
  weak and must be investigated.
- `error`: parsing, IR writing, generation, timeout, runner startup, or other
  infrastructure failed. This is not a test-quality result.

Survived mutations and errors both block trust. They can only be bypassed when
the limitation is explicit in `.shepherd/spec.md`, `.shepherd/standards.md`, and
`.shepherd/progress.md` before user sign-off.

## What Shepherd Must Record

In `.shepherd/spec.md`:

- User-visible behavior
- Executable acceptance criteria
- Behavior-relevant examples
- Scenarios that cannot be acceptance-mutated and why
- User-approved exceptions

In `.shepherd/standards.md`:

- Normal acceptance command
- Acceptance mutation command
- Generated acceptance-test location
- Mutation report location and format
- Timeout and status-line expectations
- Whether source-code mutation is separate and where it runs

In `.shepherd/plan.md`:

- The milestone that creates or verifies the acceptance pipeline
- Normal acceptance checks for behavior-changing slices
- Architect hardening after refactoring, including configured acceptance-spec
  mutation and source-code mutation
- Separate TDD unit-test checks for implementation behavior

In `.shepherd/progress.md`:

- Command run
- Exit code
- Report path
- `total`, `killed`, `survived`, `errors`
- Survivor mutation paths
- Error text or timeout/status evidence
- Decision: proceed, fix spec, fix binding, fix implementation, or accepted
  limitation

## Phase 1 Setup Gate

Before implementation planning, Shepherd should reject setup when:

- Behavior-changing work has no normal acceptance pipeline and no explicit
  user-approved waiver.
- Parser, IR generation, generated acceptance tests, runner adapter, or mutator
  infrastructure is missing or indistinguishable from product behavior failure.
- Acceptance examples are missing, meaningless, or not behavior-relevant.

Greenfield generated acceptance tests may fail because behavior is not
implemented yet. That is acceptable only when parser, generator, runner, and
mutator infrastructure are real and reported separately.

## Planning Gate

Before final plan sign-off, Shepherd should reject a plan when:

- Behavior-changing work has no executable acceptance evidence and no accepted
  limitation.
- Acceptance examples are missing, meaningless, or not behavior-relevant.
- Verification would pass even if generated acceptance tests ignored a changed
  example value.
- Acceptance mutation survivors or errors are summarized only as "tests passed."
- Generated acceptance tests are treated as a substitute for TDD unit tests.

## Implementation Gate

Implementers should:

1. Write focused unit tests before production code.
2. Keep generated acceptance tests separate from unit tests.
3. Run normal acceptance after behavior changes.
4. Build or repair normal acceptance pipeline components only when assigned.
5. Report exact normal acceptance commands, exit codes, output paths, and
   assumptions.

Implementers do not run source-code mutation or acceptance-spec mutation by
default. If project standards explicitly assign a mutation rerun to an
implementation task, the report must include command, exit code, report path,
survivor paths, and errors.

## Architect Hardening Gate

After the refactorer pass, the architect should run or record configured
source-code mutation and acceptance-spec mutation evidence. Missing evidence,
survived mutations, and mutation infrastructure errors block progress unless an
accepted limitation is already recorded in `.shepherd/spec.md`,
`.shepherd/standards.md`, and `.shepherd/progress.md`.

## Architect Verdict

Architects should reject a milestone when:

- The report has `survived > 0`.
- The report has `errors > 0`.
- The mutation command did not run and no accepted limitation explains why.
- The implementation relies on generated acceptance tests instead of unit tests.
- The handoff hides mutation details behind a generic verification summary.

## Source-Code Mutation Is Separate

Acceptance-spec mutation checks whether executable examples bind to behavior.
Source-code mutation checks whether unit or implementation tests catch code
defects. Shepherd may need both, but they run at different gates and their
reports must not be merged into one vague "mutation passed" claim.
