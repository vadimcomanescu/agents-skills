# Shepherd acceptance-pipeline-kit evals

Behavioral evals for the integration of
[`acceptance-pipeline-kit`](https://github.com/vadimcomanescu/acceptance-pipeline-kit)
into the Shepherd skill. Two layers, mirroring the creating-skills eval-type split.

## Run

```bash
# source-surface only (text assertions over the skill files; no kit needed)
python3 evals/shepherd-acceptance-mutation/run_behavioral_evals.py

# also drive the real kit (installs APS binaries + a venv on demand)
git clone https://github.com/vadimcomanescu/acceptance-pipeline-kit /tmp/apk
python3 evals/shepherd-acceptance-mutation/run_behavioral_evals.py --live --kit-dir /tmp/apk
```

`evals.json` documents the cases. `run_behavioral_evals.py` writes `last-run.json`.

## Live cases (real kit, fixtures derived from the kit's calculator example)

| Case | Setup | Expected |
|---|---|---|
| `normal-acceptance-passes` | unmodified example | exit 0 |
| `killed` | unmodified example | mutation PASS, survived=0 errors=0 |
| `survivor` | handler ignores the example value | mutation BLOCK, survived>0 |
| `no-mutations` | scenario with no examples + `--require-mutations` | mutation BLOCK |
| `error` | broken handler import | mutation BLOCK, errors>0 |

## Recorded live-code repair run

A before/after on the **same code**, proving the architect-finding → implementer-repair loop
catches a real blind spot the unit/acceptance suite misses:

1. Implementer ships a weak binding — the `the result is <sum>` handler asserts
   `isinstance(value, int)` instead of `value == int(ex["sum"])`.
   Normal acceptance still reports **5 passed**.
2. Architect hardening runs acceptance-spec mutation:
   `total=15 killed=6 survived=9 errors=0` → **BLOCK** (examples not bound to behavior).
3. Implementer repair binds the example:

   ```diff
   -    assert isinstance(world["calc"].value, int)  # weak: never reads ex["sum"]
   +    assert world["calc"].value == int(ex["sum"]), (
   +        f"expected {ex['sum']}, got {world['calc'].value}"
   +    )
   ```

4. Rerun: `total=15 killed=15 survived=0 errors=0` → **PASS**.

Reproduce by weakening the same assertion in
`<kit>/python/examples/calculator/handlers/calculator_handlers.py`, stripping the
`# mutation-stamp` header from the feature, and running
`skills/shepherd/scripts/acceptance_pipeline.py mutation` before and after the repair.
