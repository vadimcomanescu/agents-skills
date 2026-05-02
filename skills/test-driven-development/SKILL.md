---
name: test-driven-development
description: Drives implementation with strict TDD discipline. Use when implementing any feature, fixing any bug, refactoring code that has tests, or changing observable behavior. Use when the user says "implement", "add", "fix", "make it do X", or "change how Y works". Do not use for pure config, docs, or spike code committed for deletion.
---

# Test-Driven Development

> **The Iron Law:** No production code without a failing test first.

> **Violating the letter of the rules is violating the spirit of the rules.** If you find yourself negotiating with these rules, you are rationalizing.

## Uncle Bob's Three Laws of TDD (verbatim)

1. You may not write production code until you have written a failing unit test.
2. You may not write more of a unit test than is sufficient to fail (compilation failures are failures).
3. You may not write more production code than is sufficient to pass the currently failing test.

These are the canon. Everything below is how to apply them under real conditions, and how to keep an LLM from cheating them.

## When to use

**Always:**
- Implementing any new feature, logic, or behavior
- Fixing any bug — see `references/bug-fix-pattern.md` (Prove-It Pattern)
- Refactoring code that has tests (run them; they ARE the safety net)
- Adding edge case handling
- Any change that could alter observable behavior

**Exceptions (require an explicit human decision):**
- Pure documentation, comment, or static-content changes
- Pure configuration (no behavior implied)
- Spike code that you commit to **delete** before merge

If you find yourself thinking *"skip TDD just this once"* — stop. That is the rationalization the Iron Law exists to defeat. See `references/rationalizations.md`.

## The cycle

```
   ┌──────────────────── repeat ────────────────────┐
   ▼                                                │
 RED  ──►  Verify RED  ──►  GREEN  ──►  Verify GREEN  ──►  REFACTOR
write    watch it fail    minimal      all tests        clean up
failing  for the right    code to      green; output    while green
test     reason           pass         pristine         (Tidy First)
```

### RED — write a failing test

One behavior. One test. Clear, behavioral name. Real code, not mocks-of-mocks. Test names read like specifications. See `references/test-design.md` for AAA, DAMP, sizes, and naming.

### Verify RED — watch it fail (MANDATORY)

```
Run only the new test. Confirm:
  [ ] It fails (does not pass, does not error on a typo)
  [ ] The failure message is the one you expected
  [ ] It fails because the feature is missing, not because of a bug in the test
```

If it passes, you are testing existing behavior — fix the test. If it errors on a typo, fix the typo and re-run until it fails for the **right** reason. Never skip this step. Tests written after code pass immediately and prove nothing.

### GREEN — minimal code to pass

Write the simplest code that makes the test pass. Not the most general. Not the most "future-proof". The smallest delta that turns the bar green. See `references/red-green-refactor.md`.

### Verify GREEN — all tests pass, output pristine

```
[ ] New test passes
[ ] All other tests still pass
[ ] Output is pristine (no warnings, no stack traces, no flake)
```

### REFACTOR — clean up, never while red

Refactor only with green tests. Improve names, extract duplication, deepen modules. **Do not add behavior here.** See `references/tidy-first.md` — structural changes (tidyings) and behavioral changes never share a commit.

## Vertical slicing — one test, one impl, repeat

**Anti-pattern: horizontal slicing.** Writing all tests first, then all implementation. This produces tests of *imagined* behavior, not *observed* behavior. Tests written in bulk drift from reality before the code catches up.

**Rule: vertical slices via tracer bullets.** ONE test → ONE implementation → repeat. Each cycle responds to what the previous cycle taught you. See `references/vertical-slicing.md`.

```
WRONG (horizontal):                  RIGHT (vertical):
  RED:   t1, t2, t3, t4, t5            RED→GREEN: t1 → impl1
  GREEN: i1, i2, i3, i4, i5            RED→GREEN: t2 → impl2
                                       RED→GREEN: t3 → impl3
```

## Bug fixes — the Prove-It Pattern

```
Bug report → write a test that reproduces it → test FAILS (bug confirmed)
          → fix the code → test PASSES → run full suite (no regressions)
```

A bug fix without a reproduction test is not a fix; it is a hope. See `references/bug-fix-pattern.md`.

## Per-cycle checklist

Before moving to the next test:

- [ ] One behavior; one test
- [ ] Test name describes the behavior, not the method
- [ ] Test uses the public interface (not internals)
- [ ] Watched it fail for the right reason
- [ ] Wrote minimal code to make it pass
- [ ] All tests still pass
- [ ] Output pristine (no warnings, no flake)
- [ ] Refactor (if any) kept tests green and is a separate commit from new behavior

If any box is empty, you skipped TDD. Start over.

## Quality gates beyond green

Green is the floor, not the ceiling. The full quality stack:

| Gate | What it answers | Where |
|---|---|---|
| **Cycle discipline** | Did I actually write the test first? | this file |
| **Test design** | Are the tests behavioral, isolated, fast? | `references/test-design.md` |
| **State vs interaction** | Am I asserting outcomes, not call shapes? | `references/state-vs-interaction.md` |
| **Mocking discipline** | Am I using the cheapest test double, not faking everything? | `references/mocking-and-fakes.md` |
| **Mutation score** | Do my tests actually detect bugs, or just execute lines? | `references/mutation-testing.md` |
| **Testability of design** | Is this code hard to test because it is hard to use? | `references/testability-via-design.md` |

Coverage % alone is theatre — it tells you which lines ran, not whether your tests would catch a bug. Mutation testing closes that loop.

## Common rationalizations (short)

| Excuse | Reality |
|---|---|
| "Too simple to test" | Simple code breaks. The test is 30 seconds. |
| "I'll write tests after" | Tests after pass immediately. They prove nothing. |
| "I already manually tested it" | Manual ≠ systematic. No record. Can't re-run. |
| "TDD is dogmatic, I'm being pragmatic" | Pragmatic = test-first. Debugging in prod is the slow path. |
| "Keep this code as a reference while I write tests" | You will adapt to it. That is testing-after. Delete means delete. |
| "Tests-after achieve the same goal" | Tests-after answer "what does this do?". Tests-first answer "what should this do?". |

Full table with reasoning: `references/rationalizations.md`.

## Red flags — STOP and start over

- Code written before any test
- Test passes on the first run
- "I already tested it manually"
- "This is different because..."
- "TDD theater" / "ceremony" / "ritual" — adjectives for discipline you don't want to follow
- Mock setup is more than half the test
- Asserting on a `*-mock` element
- Test fails when refactoring with no behavior change

When any of these appear: see `references/anti-patterns.md`. The fix is almost always *delete and start over with TDD*.

## Planning before the first RED

For non-trivial features, run a brief planning step:

1. Confirm with the human partner what interface changes are needed.
2. List the **behaviors** to test (not implementation steps), prioritized.
3. Identify deep-module opportunities (small interface, deep implementation) — see `references/testability-via-design.md`.
4. Pick the first **tracer-bullet** test — the smallest end-to-end behavior that proves the path.
5. Get explicit human approval on the list before writing the first test.

You cannot test everything. Confirm what matters.

## When stuck

| Symptom | What it usually means |
|---|---|
| Don't know how to test this | Write the wished-for API first; assert from the caller's view |
| Test setup is enormous | Code is too coupled — dependency-inject the seams |
| Must mock everything | Code is talking to too much — find a deep module |
| Test feels like it tests the framework | You are testing third-party code; only test yours |
| Test broke during refactor with no behavior change | You tested implementation, not behavior |

## References (load on demand)

- `references/three-laws.md` — Uncle Bob's canon, full text + commentary
- `references/red-green-refactor.md` — The cycle in detail, watch-it-fail ritual
- `references/vertical-slicing.md` — Tracer bullets; horizontal-slicing anti-pattern
- `references/test-design.md` — Pyramid, sizes, AAA, DAMP, naming
- `references/state-vs-interaction.md` — Why state-based assertions survive refactors
- `references/mocking-and-fakes.md` — Real > Fake > Stub > Mock; gate functions
- `references/testability-via-design.md` — POEEA seams, deep modules, DI
- `references/tidy-first.md` — Structural vs behavioral changes; commit discipline
- `references/mutation-testing.md` — Stryker / mutmut / cargo-mutants / gremlins; kill-rate gate; legacy-triage note
- `references/rationalizations.md` — Full excuse-to-reality table
- `references/anti-patterns.md` — Mock-behavior, test-only-methods, incomplete-mocks, horizontal-slicing
- `references/bug-fix-pattern.md` — Prove-It Pattern in full

## Examples

- `examples/typescript-vitest.md`
- `examples/python-pytest.md`
- `examples/rust-cargo.md`
- `examples/go-testing.md`

## The bottom line

```
Production code → a test exists for it AND you watched it fail first
Otherwise      → not TDD
```

No exceptions without explicit human approval, captured in writing.
