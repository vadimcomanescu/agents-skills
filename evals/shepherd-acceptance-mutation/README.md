# Shepherd acceptance-pipeline-kit evals

Behavioral evals for the integration of
[`acceptance-pipeline-kit`](https://github.com/vadimcomanescu/acceptance-pipeline-kit)
into the Shepherd skill. Shepherd installs the kit and calls its own per-language
scripts directly — there is no Shepherd-side wrapper. Two layers, mirroring the
creating-skills eval-type split.

## Run

```bash
# source-surface only (text assertions over the skill files; no kit needed)
python3 evals/shepherd-acceptance-mutation/run_behavioral_evals.py

# also drive the real kit (installs APS binaries + a venv on demand)
git clone https://github.com/vadimcomanescu/acceptance-pipeline-kit /tmp/apk
python3 evals/shepherd-acceptance-mutation/run_behavioral_evals.py --live --kit-dir /tmp/apk
```

`evals.json` documents the cases. `run_behavioral_evals.py` writes `last-run.json`.

## How Shepherd uses the kit (direct)

```bash
bash <kit>/install.sh                 # gherkin-parser + gherkin-mutator onto PATH
( cd <project> && bash <kit>/<lang>/scripts/acceptance.sh )                       # normal acceptance
( cd <project> && bash <kit>/<lang>/scripts/acceptance-mutation.sh --json --level full )  # mutation
```

The per-language script is the only thing that differs (pytest / vitest / go test /
cargo test); the chosen command is recorded per project in `.shepherd/standards.md`.
The architect judges the mutation run by exit code and the JSON report.

## Live cases (real kit, fixtures derived from the calculator example)

| Case | Setup | Expected |
|---|---|---|
| `normal-acceptance-passes` | unmodified example | `acceptance.sh` exit 0 |
| `killed` | unmodified example | exit 0, survived=0 errors=0 total>0 |
| `survivor` | handler ignores the example value | exit 1, survived>0 |
| `error` | broken handler import | exit 1, errors>0 |
| `no-mutations-total-zero` | scenario with no examples | exit 0 but total=0 — the false green the architect must catch |

## Recorded live-code repair run

A before/after on the **same code**, proving the architect-finding → implementer-repair
loop catches a blind spot the unit/acceptance suite misses:

1. Implementer ships a weak binding — the `the result is <sum>` handler asserts
   `isinstance(value, int)` instead of `value == int(ex["sum"])`. Normal
   acceptance still reports **5 passed**.
2. Architect runs `acceptance-mutation.sh --json --level full`:
   `total=15 killed=6 survived=9 errors=0`, **exit 1** → finding.
3. Implementer repair binds the example:

   ```diff
   -    assert isinstance(world["calc"].value, int)  # weak: never reads ex["sum"]
   +    assert world["calc"].value == int(ex["sum"]), (
   +        f"expected {ex['sum']}, got {world['calc'].value}"
   +    )
   ```

4. Rerun: `total=15 killed=15 survived=0 errors=0`, **exit 0** → pass.
