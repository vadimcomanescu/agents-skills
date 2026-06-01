# Acceptance Mutation Mechanics

Read this when configuring or judging executable-acceptance evidence for a
Shepherd run. It defines the mechanics, the real tool that runs them, and the
gate. Sequencing lives in `SKILL.md`; role ownership lives in `prompts/*.md`.

Executable acceptance matters because a passing test suite can still be blind to
the spec: if a generated assertion never reads the example value, the example is
decorative. Acceptance-spec mutation flips one example value at a time and reruns
the tests — a test that still passes proves the example was never bound to
behaviour. [my synthesis]

## The Tool

Shepherd does not invent this pipeline. It drives the
[`acceptance-pipeline-kit`](https://github.com/vadimcomanescu/acceptance-pipeline-kit),
which ships per-language scaffolding (Python, TypeScript, Go, Rust) around two
upstream binaries, `gherkin-parser` and `gherkin-mutator`. [source:
acceptance-pipeline-kit AGENTS.md] The kit's own convenience scripts run the
pipeline end-to-end against installed binaries; do not reimplement parsing or
mutation. [source: acceptance-pipeline-kit AGENTS.md "MUST NOT reimplement
parsing or mutation"]

Record the kit checkout and language once in `.shepherd/acceptance.json` so any
role can invoke it the same way: [my synthesis]

```json
{
  "kit_dir": "/path/to/acceptance-pipeline-kit",
  "language": "python",
  "project_dir": ".",
  "level": "full",
  "require_mutations": true,
  "env": {}
}
```

`level: full` evaluates every candidate mutation; `hard`/`soft` apply
differential skip rules. Use `full` for milestone gating so nothing is silently
skipped. [source: acceptance-pipeline-kit specs/mutator-spec.md `--level`] [my
synthesis: full for gating]

## Two Layers

```text
NORMAL ACCEPTANCE        proves the current app satisfies the examples
  feature -> gherkin-parser -> JSON IR -> entrypoint generator
          -> generated tests -> project test runner

ACCEPTANCE-SPEC MUTATION proves the examples are bound to behaviour
  base IR -> generate tests once
          -> mutator changes one example value per mutation
          -> rerun generated tests against the mutated IR -> report
```

Acceptance-spec mutation mutates only scenario example values. It must not mutate
feature names, scenario names, step text, step keywords, background steps,
example headers, generated test logic, or application source code. [source:
acceptance-pipeline-kit specs/mutator-spec.md "Mutation Scope"]

Source-code mutation is a separate concern owned by `tdd-mutation`; it mutates
application code to test unit-test strength and is not what this pipeline does.
[my synthesis]

## Driving It

```bash
# once per run: put gherkin-parser / gherkin-mutator on PATH
python3 skills/shepherd/scripts/acceptance_pipeline.py ensure-tools

# implementer, for an example-backed slice: prove the app meets the examples
python3 skills/shepherd/scripts/acceptance_pipeline.py acceptance

# architect hardening: prove the examples are bound to behaviour
python3 skills/shepherd/scripts/acceptance_pipeline.py mutation
```

`mutation` writes the kit report to
`<evidence-dir>/acceptance-mutation.json` and a normalized
`<evidence-dir>/verdict.json`, then exits non-zero on a BLOCK. The independent
gate re-checks that evidence without rerunning the kit: [my synthesis]

```bash
python3 skills/shepherd/scripts/validate_acceptance_mutation.py \
  --require-mutations .shepherd/evidence/<milestone>/verdict.json
```

## Result Terms

Use these terms exactly: [source: acceptance-pipeline-kit specs/mutator-spec.md
exit codes + report]

- `killed` — generated tests failed after the example value was mutated. Good.
- `survived` — generated tests passed after the mutation. The spec, generated
  assertion, step binding, or implementation is too weak.
- `error` — parser, IR, generation, runner startup, worker protocol, or timeout
  failed. The evidence pipeline is broken.

Kit exit codes: `0` all killed and no errors, `1` at least one survivor or error,
`2` usage error. [source: acceptance-pipeline-kit specs/mutator-spec.md]

## Gate

`mutation` and `validate_acceptance_mutation.py` BLOCK when: [my synthesis]

- any mutation `survived` — examples are not bound to behaviour
- any mutation `error` — the evidence is unverifiable
- zero mutations executed while `require_mutations` is set — the examples cannot
  prove behaviour-relevant binding

`survived` and `error` are never passing evidence; neither is "tests are green."
A BLOCK is an architect finding routed to a focused implementer repair, not a
milestone approval. [my synthesis]

## Evidence To Record

In `.shepherd/standards.md`: kit checkout path, language, normal acceptance
command, acceptance-spec mutation command, level, report/verdict paths, and any
accepted waiver with reason and date. [my synthesis]

In `.shepherd/progress.md`, per mutation run: command, kit exit code, report
path, total/killed/survived/errors, surviving mutation paths, infrastructure
error text, and the decision (proceed, fix spec, fix binding, fix
implementation, fix pipeline, or accepted limitation). [my synthesis]

Do not hand-edit the kit report, the generated mutation manifest, or
`verdict.json`. Let the configured tools write them; `validate_acceptance_mutation.py`
re-derives the decision from the summary so a hand-edited verdict cannot pass a
weak run. [my synthesis]
