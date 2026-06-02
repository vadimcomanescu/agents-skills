# Acceptance Mutation Mechanics

Read this when the work has executable behavior examples (Gherkin `.feature`
files). It explains how to use the
[`acceptance-pipeline-kit`](https://github.com/vadimcomanescu/acceptance-pipeline-kit)
directly and how to judge its result. Sequencing lives in `SKILL.md`; role
ownership lives in `prompts/*.md`.

Executable acceptance matters because a passing test suite can still be blind to
the spec: if a generated assertion never reads the example value, the example is
decorative. Acceptance-spec mutation flips one example value at a time and reruns
the tests — a test that still passes proves the example was never bound to
behaviour.

## The Tool

Shepherd does not wrap or reimplement this pipeline; it installs the kit and
calls the kit's own per-language scripts. [source: acceptance-pipeline-kit
AGENTS.md "MUST NOT reimplement parsing or mutation"] The kit ships two shared Go
binaries (`gherkin-parser`, `gherkin-mutator`) plus a script pair per language.

Install once, into the run's environment:

```bash
bash <kit>/install.sh            # gherkin-parser + gherkin-mutator onto PATH
# then the language package + project deps per <kit>/<lang>/README.md
```

## Per-Language Invocation

There is no universal command — pick the language directory. Each script bakes in
that language's test runner; the binaries are language-agnostic. [source:
acceptance-pipeline-kit <lang>/scripts/*.sh]

| Language | `acceptance.sh` runs | handler wiring | extra env |
|---|---|---|---|
| python | `pytest` | `conftest.py` imports handlers | — |
| typescript | `npx vitest run` | `vitest.config.ts` `setupFiles` | — |
| go | `go test ./...` | blank-import `_test.go` | `APS_PACKAGE` |
| rust | `cargo test` | `register()` via `std::sync::Once` | `APS_HANDLERS_CRATE` |

```bash
# normal acceptance — proves the app meets the examples
( cd <project> && FEATURES_DIR=features bash <kit>/<lang>/scripts/acceptance.sh )

# acceptance-spec mutation — proves the examples are bound to behaviour
( cd <project> && bash <kit>/<lang>/scripts/acceptance-mutation.sh --json --level full )
```

Record the project's exact chosen commands (kit path, language, env) in
`.shepherd/standards.md`, the same place Shepherd records every real verification
command. That is where the language-specific invocation lives for a given run;
nothing else needs to know the language.

## Two Layers

```text
NORMAL ACCEPTANCE        feature -> parser -> IR -> generator
                         -> generated tests -> language test runner
ACCEPTANCE-SPEC MUTATION base IR -> generate tests once
                         -> mutator flips one example value per mutation
                         -> rerun generated tests against mutated IR -> report
```

The mutator changes only scenario example values — never feature/scenario names,
step text, background, example headers, generated test logic, or source code.
[source: acceptance-pipeline-kit specs/mutator-spec.md "Mutation Scope"]
Source-code mutation is a separate concern owned by `tdd-mutation`.

## Reading The Result

Use `--level full` for gating. The kit default `hard` applies differential skip
rules and can report `total=0` (nothing mutated) while still exiting `0` — a
false green. [source: acceptance-pipeline-kit specs/mutator-spec.md `--level`] [my
synthesis: full for gating]

Exit codes: `0` all killed and no errors, `1` at least one survivor or error,
`2` usage error. [source: acceptance-pipeline-kit specs/mutator-spec.md]
The `--json` report goes to stdout (progress lines go to stderr) as
`{"summary": {Total, Killed, Survived, Errors, ...}, "results": [...]}`.

Result terms — use exactly: [source: acceptance-pipeline-kit specs/mutator-spec.md]

- `killed` — tests failed after the example value was mutated. Good.
- `survived` — tests passed after the mutation. The spec, generated assertion,
  step binding, or implementation is too weak.
- `error` — parser, IR, generation, runner, worker, or timeout failed. The
  evidence pipeline is broken.

## Gate

A milestone is provable only when, for every example-backed feature: [my synthesis]

- exit code `0`, and
- the report shows `survived == 0`, `errors == 0`, and `total > 0`.

Block otherwise. Read `results[]` to route the repair:

- `survived` → implementer binding-fix (bind the example to behaviour; do not
  delete the example or loosen the generated test).
- `error` → fix the pipeline/handlers.
- `total == 0` while `.feature` files exist → the examples cannot prove binding;
  confirm `--level full` and that handlers are wired, then treat as a block.

## Evidence To Record

In `.shepherd/standards.md`: kit path, language, the exact normal-acceptance and
acceptance-spec mutation commands, and any accepted waiver with reason and date.

In `.shepherd/progress.md`, per mutation run: command, exit code, report path,
total/killed/survived/errors, surviving mutation paths, infrastructure error
text, and the decision (proceed, fix spec, fix binding, fix implementation, fix
pipeline, or accepted limitation). Do not hand-edit the kit report or its
generated mutation manifest; let the kit write them.
