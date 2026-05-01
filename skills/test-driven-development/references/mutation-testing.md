# Mutation testing — proving the tests actually bite

## Contents
- The idea
- How TDD relates
- Tools by language
- Common mutation operators
- Quality gates
- Operating workflow
- Reading the difference between coverage and mutation
- When a mutant is "equivalent"
- When mutation testing is too slow to run on every change
- What mutation testing is *not*
- The bottom line
- When you inherited untested code (CRAP triage)

Coverage tells you which lines ran. Mutation testing tells you whether your tests would notice if those lines were wrong. It is the closing-loop quality gate for TDD.

## The idea

A **mutant** is a small, mechanical change to the production code: flip `+` to `-`, `>` to `>=`, remove a `return`, replace a literal with a default. The mutation tool generates many such mutants and runs the test suite against each.

- **Killed mutant:** at least one test failed. Good — your tests detected the change.
- **Survived mutant:** all tests passed despite the change. Bad — your tests cannot tell the difference between correct and corrupted code.

The **mutation score** is the percentage of mutants killed. The score is a much better signal of test quality than coverage; it answers the question coverage cannot: *do these tests actually verify behavior?*

> Coverage proves your tests *executed* the line.
> Mutation testing proves your tests *care* about the line.

## How TDD relates

In a strict TDD cycle, every line of production code exists because some failing test demanded it. That implies: **every mutation of that line should kill a test**, because the line is load-bearing.

When a mutant survives:

- Your test asserted on a too-weak property (e.g., "result is truthy" instead of "result equals 80").
- Your test asserted on a state but missed an edge boundary (`> 0` vs `>= 0`).
- Your test missed a side effect entirely.
- The line is dead code (no test forced it; you wrote more than the test demanded — Law 3 violation).

Each of these is a TDD signal. Mutation testing is how you find the test gaps the cycle missed.

## Tools by language

| Language | Tool | Install | Run |
|---|---|---|---|
| TypeScript / JavaScript | Stryker | `npm install --save-dev @stryker-mutator/core` | `npx stryker run` |
| Python | mutmut (3.x) | `uv add --dev mutmut` (or `pip install mutmut`) | configure `[tool.mutmut]` in `pyproject.toml`, then `mutmut run` and `mutmut results` |
| Rust | cargo-mutants | `cargo install cargo-mutants` | `cargo mutants --jobs 4` |
| Go | gremlins | `go install github.com/go-gremlins/gremlins/cmd/gremlins@latest` | `gremlins unleash ./<package>` |
| JVM | PIT | Maven/Gradle plugin | `mvn pitest:mutationCoverage` |
| .NET | Stryker.NET | `dotnet tool install -g dotnet-stryker` | `dotnet stryker` |

Stryker (TS/JS), mutmut (Python), cargo-mutants (Rust), and gremlins (Go) are the ones our examples target. (`go-mutesting` is widely cited but its `golang.org/x/tools` dep is from 2019 and crashes on modern Go toolchains — use gremlins instead.)

## Common mutation operators

| Operator | Example | A surviving mutant means... |
|---|---|---|
| Arithmetic | `+` ↔ `-`, `*` ↔ `/` | The calculation's result is not asserted on |
| Comparison | `>` ↔ `>=`, `==` ↔ `!=` | Boundary conditions are untested |
| Boolean | `&&` ↔ `\|\|`, `!` removed | Logic branches are uncovered |
| Return value | `true` ↔ `false`, `Ok` ↔ `Err` | Return paths aren't checked |
| Statement removal | a line deleted entirely | Side effects aren't asserted |
| Literal | `0` ↔ `1`, `""` ↔ `"X"` | The literal value doesn't matter to the test |

When a survivor lands on a *literal* mutation (the test passes whether the constant is `0` or `1`), the asserts almost certainly use `toBeTruthy()` or `not_None`. Strengthen them to `toBe(0)`.

## Quality gates

A pragmatic policy that scales:

```
Default kill-rate floor:     80%   (project-wide)
Critical-path target:        100%  (auth, billing, persistence, security)
PR-level rule:               no NEW survivors introduced by the PR's diff.
```

The PR-level rule is the most useful in practice — it does not require getting the whole codebase to 100% in one go, but it stops the rot.

A 100% kill rate is achievable for new code written under TDD. Older modules will have surviving mutants; treat them as a triage queue, not a blocker.

## Operating workflow

1. **Scope the run.** Mutation testing is slow. Run it on the changed files only:
   - Stryker: configure `mutate: ['src/**/changed.ts']` or use the incremental mode.
   - cargo-mutants: `cargo mutants --in-diff origin/main`.
   - mutmut: configure `paths_to_mutate = ["src/<changed_module>/"]` in `[tool.mutmut]` in `pyproject.toml` (mutmut 3.x dropped the `--paths-to-mutate` CLI flag).
   - gremlins: `gremlins unleash ./<changed-package>`.

2. **Read the report.** Each surviving mutant has a file, a line, and a description ("replaced `+` with `-`").

3. **Diagnose each survivor.** For each one, ask: *what assertion would have caught this?* The answer is the missing test. Common causes:
   - Weak assertion (`toBeDefined`, `not None`, `is_ok()`) — strengthen to a value comparison.
   - Missing boundary case — add a test at the exact threshold.
   - Missing error path — assert that the failure mode produces the expected error.
   - Dead code — if no test demands this line, you wrote more than the test forced (Law 3). Either delete the line or write the test that demands it.

4. **Add the test, re-run.** The mutant should now be killed. Run again to confirm.

5. **Commit.** A separate commit titled `Test: kill surviving mutants in <file>` is fine.

## Reading the difference between coverage and mutation

```
function discount(amount: number, percent: number): number {
  return amount - (amount * percent / 100);
}

it('returns a smaller amount when percent is positive', () => {
  expect(discount(100, 10)).toBeLessThan(100);
});
```

- **Coverage:** 100%. The line ran.
- **Mutation:** survives `*` → `+`. The test passes for `discount(100, 10) = 110` because `110 < 100` is false... wait, that's killed. Try `*` → `/`: `discount(100, 10) = 100 - 10 = 90` vs `100 - 100/10/100 = 99.9`. Both are less than 100. Mutant survives. The test only asserts directionality, not the actual computation.
- **Fix:** `expect(discount(100, 10)).toBe(90)`.

Mutation testing turns weak assertions into a checkable property.

## When a mutant is "equivalent" — i.e., genuinely cannot be killed

Some mutants change the code but not its observable behavior. Example: a redundant `if` whose branches do the same thing. The tool flags these as survivors but they are unkillable.

Stryker, mutmut, and cargo-mutants all support **excluding equivalent mutants** explicitly. Use the exclusion sparingly — most "equivalent mutants" are actually a sign that the code has redundant branches that should be removed (which would kill the mutant by deletion).

## When mutation testing is too slow to run on every change

- Run it nightly in CI on the full project; gate PRs only on the changed-files subset.
- Use the tool's incremental mode (Stryker `--incremental`, cargo-mutants `--in-diff`).
- Parallelize with `--jobs` (cargo-mutants), `--concurrency` (Stryker), or `--processes` (mutmut).
- Cache the test runner. Most slowness is repeated test bootstrap, not the test itself.

## What mutation testing is *not*

- It is not a replacement for TDD. It is a check that the tests TDD produced are honest.
- It is not a coverage metric in disguise. Two suites with 80% line coverage can have mutation scores of 30% and 95%.
- It is not a substitute for thinking. It tells you *that* a test is missing; it does not tell you *what behavior* should be asserted. That is a thinking task.

## The bottom line

If your TDD discipline is real, your mutation score will be high without effort. If your mutation score is low despite high coverage, your tests are weak — they execute lines without verifying outcomes.

Run mutation testing on every PR's diff. Block new survivors. Aim for 80% project-wide and 100% on critical paths.

## When you inherited untested code (CRAP triage)

Mutation testing needs a test suite. If you walk into a legacy module with **zero or near-zero coverage**, mutation testing produces no signal — there's nothing to evaluate. For that case, sort by **CRAP** instead.

CRAP (Change Risk Anti-Patterns; Savoia & Evans, 2007) combines complexity and coverage into one number:

```
CRAP(m) = comp(m)² · (1 − cov(m)/100)³ + comp(m)
```

Where `comp(m)` is cyclomatic complexity and `cov(m)` is coverage in percent. A CRAP above **30** marks a method as risky to change. The cubic-coverage term encodes the insight: untested complex code is exponentially riskier than tested complex code, but past ~80% coverage the gain flattens fast.

**Workflow for legacy triage:**

1. Compute complexity per method (`eslint complexity`, `radon cc`, `gocyclo`, etc.).
2. Compute coverage per method (your usual coverage tool).
3. Apply the CRAP formula in a small script over your coverage report.
4. Sort methods by CRAP descending. Take the top 3–5.
5. For each: split the method (preferred — reduces complexity), or write characterization tests (until coverage is high enough to drop CRAP under 30), or both.
6. Once tests exist, switch to mutation testing for the per-method test-quality signal.

Don't run CRAP per cycle on TDD-from-scratch code. Mutation testing is the better signal there. CRAP earns its place specifically when there's no test suite to evaluate.
