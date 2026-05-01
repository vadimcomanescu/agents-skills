# Red-Green-Refactor in detail

The cycle is five steps, not three. The two extra steps — *Verify RED* and *Verify GREEN* — are the ones LLMs most often skip.

## RED — write one failing test

- One behavior. If the test name contains "and", split it.
- A name a non-author can read as a specification: `rejects empty email`, not `test_email_1`.
- Use the public interface only. If the public interface does not exist yet, write the test against the wished-for API; the missing symbol *is* the failure.
- Real code where possible. Mocks only at boundaries you cannot run cheaply (network, time, randomness). See `mocking-and-fakes.md`.
- Arrange-Act-Assert structure (see `test-design.md`).

## Verify RED — watch it fail (MANDATORY)

This is the step that distinguishes TDD from "I wrote some tests".

```
Run only the new test. Verify three things:
  1. It fails (does not pass).
  2. It does not error on a typo or missing import.
  3. The failure message is the one you expected for this behavior.
```

Common failure modes for this step:

| What you see | What it means | What to do |
|---|---|---|
| Test passes immediately | You are testing existing behavior, not new behavior. | Rewrite the test until it forces a new line of production code. |
| Test errors on `ReferenceError`/`NameError` | You haven't written the symbol yet — that's fine, but it is *not yet* a clean RED. | Add a stub that compiles; the test should now fail at the assertion, not at the import. |
| Test fails for the wrong reason | You introduced a bug in the test. | Fix the test until the failure message matches your intent. |

You did not skip this step? Good. **You skipped this step?** You don't know if your test tests anything.

## GREEN — minimum code to pass

The smallest delta that makes the bar green. Not the prettiest. Not the most general. Not the most "scalable".

Heuristics:

- If you can pass the test by **returning a constant**, do that. The next test will force you to generalize. (This is "fake it till you make it" — Kent Beck, *TDD by Example*.)
- If you can pass the test with a literal `if` for the new case alongside an existing branch, do that. Don't refactor yet — refactoring while red is forbidden.
- Do not add error handling, logging, validation, or fields the test does not demand. *Speculative generality* is how dead code accumulates.

## Verify GREEN — full bar green and pristine

```
[ ] The new test passes.
[ ] All other tests still pass.
[ ] Output is pristine: no warnings, no stack traces, no swallowed errors.
```

A passing-but-noisy run is a future flake. Treat warnings as errors during this step.

If other tests broke: you changed shared behavior. Decide deliberately whether the broken tests describe behavior you want to *keep* (in which case your new behavior is wrong) or *change* (in which case update them, but only with explicit reasoning). Do not silently update tests to match new code.

## REFACTOR — clean up while green

Now and **only now**, you may improve the code without changing behavior:

- Rename for clarity.
- Extract duplication (DRY in production code, *not* in tests — see `test-design.md`).
- Deepen modules: hide complexity behind a small interface (Ousterhout, *A Philosophy of Software Design*).
- Apply the patterns from POEEA (Repository, Service Layer, Domain Model) when the duplication you see lines up with one of them.

Run the full test suite after each refactor. If a test fails, you changed behavior — back out and try again. Refactoring is the discipline of staying inside the safety net.

**Critical:** structural changes (refactors / tidyings) and behavioral changes never share a commit. See `tidy-first.md`.

## The cycle, with the gates highlighted

```
        ╔═══════════════════════════════════════════════╗
        ║                                               ║
        ▼                                               ║
       RED  ────►  ① VERIFY RED  ────►  GREEN  ────►  ② VERIFY GREEN  ────►  REFACTOR
                  (must fail for                      (full bar green;        (only while
                   the right reason)                   output pristine)        green; tidy-
                                                                               first commit
                                                                               discipline)
```

Gates ① and ② are non-negotiable. They are the difference between TDD and "tests written close to the code".

## Common LLM failure modes for the cycle

- **Skipping ①** because "the test obviously fails — it references a function that doesn't exist." Run it anyway. Surprises are common.
- **Doing too much in GREEN** because you "already know" the next three tests. Stop. Write the next test instead. Speculative GREEN code lives forever.
- **Refactoring during RED** because the new test reveals an ugly seam. Get to GREEN first, then refactor with the safety net on.
- **Skipping ②** because the new test passed and you already moved on. Run the full suite. You may have broken something elsewhere.
