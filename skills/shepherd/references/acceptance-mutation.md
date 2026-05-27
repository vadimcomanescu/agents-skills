# Acceptance Mutation Mechanics

Use this reference when configuring or judging executable acceptance evidence. It
defines mechanics and result terms only; Shepherd sequencing lives in `SKILL.md`
and role ownership lives in `prompts/*.md`.

## Normal Acceptance

Normal acceptance proves the current app satisfies executable behavior examples:

```text
feature file
  -> parser
  -> JSON IR
  -> acceptance entrypoint generator
  -> generated test entry points
  -> project test runner
```

Project-specific normal acceptance components are the entrypoint generator,
runtime, step handlers, and scripts.

## Acceptance-Spec Mutation

Acceptance-spec mutation checks whether example values in executable specs are
actually connected to behavior:

```text
feature file
  -> parser
  -> base JSON IR
  -> reusable generated test entry points
  -> mutator changes one example value per mutation
  -> runner adapter executes generated tests against mutated IR
  -> mutation report
```

Acceptance-spec mutation mutates specification-derived example values. It does
not mutate application source code, generated test logic, step text, scenario
names, or feature names.

Source-code mutation is separate: it mutates application code to test the
strength of unit or implementation tests.

## Result Terms

Use these terms exactly:

- `killed`: generated tests failed after the mutated spec value was used.
- `survived`: generated tests passed after the mutated spec value was used.
- `error`: parser, IR writing, generation, timeout, runner startup, worker
  protocol, or other infrastructure failed.

`survived` means the spec, generated assertion, step binding, or implementation
is too weak. `error` means the evidence pipeline failed. Neither is passing
evidence.

## Evidence To Record

In `.shepherd/standards.md`, record the commands and paths:

- parser command and IR path
- generator command and generated test location
- normal acceptance command
- acceptance-spec mutation command
- mutation runner adapter command
- mutation report path and format
- timeout and progress/status expectation
- source-code mutation command when configured
- accepted waivers with reason and date

In `.shepherd/progress.md`, record each mutation run:

- command
- exit code
- report path
- total, killed, survived, errors
- survivor paths
- infrastructure error text
- decision: proceed, fix spec, fix binding, fix implementation, fix pipeline, or
  accepted limitation

Do not edit mutation manifests by hand. Let the configured mutator update them
as part of its normal run.
