# Mutation testing — proving the tests bite

**Load this when:** you've finished a TDD cycle (or a PR's worth of cycles) and need to prove the tests would actually catch a bug, or you're auditing an existing module's test quality.

## Idea

A **mutant** is a small, mechanical change to production code: flip `+` → `-`, `>` → `>=`, remove a `return`, replace a literal with a default. The mutation tool generates many mutants and runs the test suite against each.

- **Killed:** at least one test failed → tests detected the change. Good.
- **Survived:** all tests passed despite the change → tests cannot tell correct from corrupted. Bad.

The **mutation score** is the percentage killed. It answers the question coverage cannot: *do these tests verify behavior?*

> Coverage proves your tests *executed* the line.
> Mutation testing proves your tests *care* about the line.

## How TDD relates

Under strict TDD, every line of production code exists because some failing test demanded it. So **every mutation of that line should kill a test**, because the line is load-bearing.

When a mutant survives:
- The test asserted on a too-weak property (`toBeTruthy()` instead of `toBe(80)`).
- The test missed an edge boundary (tested `> 0` but not `>= 0`).
- The test missed a side effect entirely.
- The line is dead code — no test forced it. You wrote more than the failing test demanded (Law 3 violation).

Each is a TDD signal. Mutation testing finds the test gaps the cycle missed.

## Tools by language

| Language | Tool | Install | Run |
|---|---|---|---|
| TypeScript / JavaScript | Stryker | `npm i -D @stryker-mutator/core` | `npx stryker run` |
| Python | mutmut (3.x) | `uv add --dev mutmut` (or `pip install mutmut`) | configure `[tool.mutmut]` in `pyproject.toml`, then `mutmut run && mutmut results` |
| Rust | cargo-mutants | `cargo install cargo-mutants` | `cargo mutants --jobs 4` |
| Go | gremlins | `go install github.com/go-gremlins/gremlins/cmd/gremlins@latest` | `gremlins unleash ./<package>` |
| JVM | PIT | Maven/Gradle plugin | `mvn pitest:mutationCoverage` |
| .NET | Stryker.NET | `dotnet tool install -g dotnet-stryker` | `dotnet stryker` |

`go-mutesting` is widely cited but its `golang.org/x/tools` dep is from 2019 and crashes on modern Go toolchains — use **gremlins**.

## Mutation operators (priority order)

| Priority | Operator | Example | A surviving mutant means... |
|---|---|---|---|
| 1 | **Boundary** | `<` ↔ `<=`, `>` ↔ `>=` | Boundary cases untested |
| 2 | **Boolean** | `&&` ↔ `\|\|`, drop `!` | Logic branches uncovered |
| 3 | **Return** | `return x` → `return null`, `true` ↔ `false` | Return paths unchecked |
| 4 | **Statement removal** | delete `array.push()`, `await save()`, `emit()` | Side effects unasserted |
| 5 | **Arithmetic** | `+` ↔ `-`, `*` ↔ `/` | Calculation result unasserted |
| 6 | **Literal** | `0` ↔ `1`, `""` ↔ `"X"` | Literal value doesn't matter to the test |

A literal-mutation survivor almost always means the assert uses `toBeTruthy`, `is_not_None`, or `is_ok()`. Strengthen to a value comparison.

## Quality gates

```
Default kill-rate floor:  80%   (project-wide)
Critical-path target:     100%  (auth, billing, persistence, security)
PR-level rule:            no NEW surviving mutants from the diff
```

The PR-level rule scales — it does not require getting the whole codebase to 100% in one go, but it stops the rot. 100% kill rate is achievable for new code under TDD. Older modules become a triage queue, not a release blocker.

## Operating workflow

1. **Scope the run.** Mutation testing is slow. Run on the changed files only:
   - **Stryker:** configure `mutate: ['src/**/changed.ts']` or use `--incremental`.
   - **cargo-mutants:** `cargo mutants --in-diff origin/main`.
   - **mutmut:** configure `paths_to_mutate = ["src/<changed_module>/"]` in `[tool.mutmut]` in `pyproject.toml` (mutmut 3.x dropped the `--paths-to-mutate` flag).
   - **gremlins:** `gremlins unleash ./<changed-package>`.

2. **Read the report.** Each survivor has a file, a line, and a description ("replaced `+` with `-`").

3. **Diagnose each survivor.** Ask: *what assertion would have caught this?* The answer is the missing test. Common causes:
   - Weak assertion (`toBeDefined`, `not None`, `is_ok()`) — strengthen to value comparison.
   - Missing boundary case — add a test at the exact threshold.
   - Missing error path — assert that the failure mode produces the expected error.
   - Dead code — if no test demands this line, you wrote more than the test forced (Law 3). Delete the line **or** write the test that demands it. Do not add a test that exists only to kill the mutant; it must have a behavioral name and reason.

4. **Add the test, re-run.** The mutant should now be killed. Run again to confirm.

5. **Commit.** A separate commit titled `Test: kill surviving mutants in <file>` is fine.

## Coverage vs mutation — concrete contrast

```typescript
function discount(amount: number, percent: number): number {
  return amount - (amount * percent / 100);
}

it('returns a smaller amount when percent is positive', () => {
  expect(discount(100, 10)).toBeLessThan(100);
});
```

- **Coverage:** 100%. Line ran.
- **Mutation:** survives `*` → `/`. `discount(100, 10)` becomes `100 - (100 * 10 / 100) = 90` vs the mutant `100 - (100 / 10 / 100) = 99.9`. Both `< 100`, so the directional assertion passes either way.
- **Fix:** `expect(discount(100, 10)).toBe(90)`.

Mutation testing turns weak assertions into a checkable property.

## Manual mutation when tooling doesn't exist

You will hit stacks the major tools don't support: Vitest browser-mode + Playwright, exotic targets, embedded runtimes, languages without a maintained mutator. Mutation testing is a pencil-and-paper algorithm — you can run it by hand.

**Manual loop:**

1. **Identify** functions changed in the diff.
2. **Mutate one operator** (start with priority 1: boundaries).
3. **Run the test suite** (`npm test --run`, `pytest -x`, `cargo test`, etc).
4. **Record** the result: KILLED if any test fails; SURVIVED if green.
5. **Restore the original code immediately.** Never commit a mutation.
6. **Repeat** for the next mutation.
7. **Report** survivors with suggested fixes.

**Manual rules:**
- One mutation at a time. Never combine.
- Always restore. A forgotten mutation is a regression.
- Track every mutation tried, not just the survivors. The full list is the audit.
- Keep mutations *small* — one operator per attempt.

Use the manual loop sparingly: it is human-invoked on feature branches, not CI automation. Deterministic tooling in your pipeline beats the manual approach when the stack supports it.

## Equivalent mutants — survivors that genuinely cannot be killed

Some mutants change the code but not its observable behavior. Example: a redundant `if` whose branches do the same thing. The tool flags them as survivors but they are unkillable.

Stryker, mutmut, and cargo-mutants all support **excluding equivalent mutants** explicitly. Use the exclusion sparingly — most "equivalent mutants" are actually a sign the code has redundant branches that should be **removed**, which would kill the mutant by deletion. Suspect the code first, the tool second.

## When mutation testing is too slow per change

- Run nightly in CI on the full project; gate PRs only on the changed-files subset.
- Use incremental mode (Stryker `--incremental`, cargo-mutants `--in-diff`).
- Parallelize: `--jobs` (cargo-mutants), `--concurrency` (Stryker), `--processes` (mutmut).
- Cache the test runner. Most slowness is repeated test bootstrap, not the test itself.

## What mutation testing is not

- **Not a replacement for TDD.** It is a check that the tests TDD produced are honest.
- **Not coverage in disguise.** Two suites with 80% line coverage can have mutation scores of 30% and 95%.
- **Not a substitute for thinking.** It tells you *that* a test is missing; you decide *what behavior* should be asserted.
- **Not an excuse to write tests with no behavioral meaning.** A test added solely to kill a mutant, with a name like `kills_mutant_at_line_42`, is worse than the surviving mutant — it locks the implementation in place. Add the test only if it has a behavioral name and represents a real expectation.

## Bottom line

If your TDD discipline is real, your mutation score is high without effort. If your mutation score is low despite high coverage, your tests are weak — they execute lines without verifying outcomes.

Run mutation testing on every PR's diff. Block new survivors. Aim for 80% project-wide and 100% on critical paths.

## Legacy triage — when there are no tests at all (CRAP)

Mutation testing needs a test suite. Walk into a legacy module with **zero or near-zero coverage** and mutation testing produces no signal — there is nothing to evaluate. For that case, sort by **CRAP** instead.

CRAP (Change Risk Anti-Patterns; Savoia & Evans, 2007) combines complexity and coverage into one number:

```
CRAP(m) = comp(m)² · (1 − cov(m)/100)³ + comp(m)
```

`comp(m)` is cyclomatic complexity; `cov(m)` is coverage in percent. CRAP > 30 marks a method as risky to change. The cubic-coverage term encodes the insight: untested complex code is exponentially riskier than tested complex code, but past ~80% coverage the gain flattens fast.

**Workflow for legacy triage:**

1. Compute complexity per method (`eslint complexity`, `radon cc`, `gocyclo`).
2. Compute coverage per method (your usual coverage tool).
3. Apply CRAP in a small script over the coverage report.
4. Sort methods by CRAP descending. Take the top 3–5.
5. For each: split the method (preferred — reduces complexity), write characterization tests until coverage drops CRAP under 30, or both.
6. Once tests exist, switch to mutation testing for the per-method test-quality signal.

Don't run CRAP per cycle on TDD-from-scratch code. Mutation testing is the better signal there. CRAP earns its place specifically when there is no test suite to evaluate.
