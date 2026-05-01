# Tidy First — structural changes and behavioral changes never share a commit

## Contents
- Why
- The rule
- What counts as structural
- What counts as behavioral
- Sequencing within a PR
- How this connects to the TDD cycle
- When you discover a tidying mid-RED
- When you discover a tidying mid-GREEN
- When the boundary blurs
- How this changes the per-commit footprint
- The bottom line

From Kent Beck's *Tidy First?* (2023). The shortest version: **structural changes (tidyings) and behavioral changes are different things. Do not mix them in one commit.**

## Why

If you fix a structural issue and add new behavior in the same commit, the behavioral change is hidden inside a pile of trivial tidying. Reviewers cannot see the actual delta. Reverts become surgical instead of mechanical. Bisects find a "yeah, this commit, but which line?" answer.

Separating them gives you:

- **Reviewable diffs.** A behavioral commit shows only the lines that change behavior; a structural commit shows only the rename/extract/move/inline.
- **Safe reverts.** Revert just the behavioral commit if it broke prod; the tidying stays.
- **Clean bisect.** When something breaks, `git bisect` lands on the commit that actually changed behavior, not on a 200-line tidy.
- **Confidence.** A pure-tidying commit changes no observable outcome. The full test suite must still pass with no edits to the tests.

## The rule

```
Structural change ≠ behavioral change.
Each commit is one or the other. Never both.
```

A pull request may contain a sequence of commits that mixes both — but each individual commit is pure.

## What counts as structural

- Rename (variable, function, file, type) — no behavior change.
- Extract function / inline function — same behavior, different shape.
- Move (between files, modules, classes) — same behavior, different location.
- Reorder declarations — same behavior, different layout.
- Replace conditional with polymorphism (or vice versa) — same behavior.
- Replace data structure (Array → Set, Map → object) — *only* if every consumer's externally observable behavior is unchanged.

If you cannot run the existing test suite unchanged and have it pass, **your "tidying" is actually a behavior change**. Treat it as such.

## What counts as behavioral

- New code path the existing tests do not exercise.
- Changed return value, exception, side effect, format, ordering.
- Removed or changed validation.
- New default value where there was none.
- Anything that requires updating an assertion to keep tests green.

## Sequencing within a PR

Beck's heuristic: tidy first when the tidying makes the upcoming behavior change easier to see. Tidy after when the tidying is suggested by the new code's shape and would have been speculative beforehand.

```
Common sequence:
  commit 1: tidy   — extract helper, rename, hoist constant
  commit 2: tidy   — split file, move type
  commit 3: behavior — add new feature
  commit 4: tidy   — refactor revealed by the new code
  commit 5: behavior — handle the edge case the new code exposed
```

Each commit message should make its category explicit. A leading verb works:

- `Refactor: ...` or `Tidy: ...` for structural commits.
- `Add: ...`, `Fix: ...`, `Change: ...` for behavioral commits.

## How this connects to the TDD cycle

The cycle is **RED → GREEN → REFACTOR**. Tidy First says:

- The REFACTOR step is structural — it must not change behavior. The full test suite passes throughout.
- The REFACTOR commit is separate from the GREEN commit. Two commits per cycle, not one.

If a refactor reveals a behavior change you want to make ("oh, this should also handle empty input"), that is a **new RED**, not a continuation of the refactor. Stop refactoring. Start a new cycle.

## When you discover a tidying mid-RED

You are in the middle of writing a test, and you realize the production code has a structural issue that is making the test harder to write. Two options:

1. **Stop, finish the cycle.** Write the test against the current shape. Get to GREEN. Then refactor (with your new test in the safety net).
2. **Stash the test, do the tidying first.** If the structural issue is blocking the test entirely, commit the tidying (with the existing tests passing), then start the cycle.

Option 1 is the default. Option 2 only when you literally cannot make progress otherwise.

The wrong answer: "I'll fix the structure as I write the test." That is mixing structure and behavior. The test ends up tangled in unrelated changes.

## When you discover a tidying mid-GREEN

You wrote the test, you wrote the minimum code to pass, and you see a clear refactor. Good. That is the REFACTOR step.

- Run the suite — green.
- Commit GREEN.
- Refactor.
- Run the suite — still green.
- Commit REFACTOR.

Two commits.

If your refactor breaks a test, you changed behavior. Back out and try again — or accept that this is a new behavior change, not a refactor, and write the test for it first.

## When the boundary blurs

Some "tidyings" claim to preserve behavior but quietly do not:

- "Switching from `for` to `map`" — usually fine, but watch for early-exit logic that the imperative form had and the functional form doesn't.
- "Replacing nested ifs with early returns" — usually fine, but watch for default values that fell through the original chain.
- "Replacing a class hierarchy with a tagged union" — fine *if* the existing tests cover every branch; if not, you are writing tests for a new design alongside the change. Split it.

The discipline: **run the existing tests, untouched, before and after each tidying.** Both must be green. If you had to update a test, you did a behavior change.

## How this changes the per-commit footprint

Vadim's global rules require commits with imperative, concise messages. Tidy-First sharpens that:

- A tidying commit's message starts with `Refactor:`, `Rename:`, `Extract:`, `Move:`, `Inline:`.
- A behavioral commit's message starts with the verb of the change: `Add:`, `Fix:`, `Change:`, `Remove:`.
- A reviewer can scan the commit log and see exactly where behavior changed.

## The bottom line

> When in doubt, separate. A six-commit PR with clear categorization is easier to review than a one-commit PR that tangles them.

Mixed commits are a habit, not a necessity. Once you build the muscle, the cost of separating is near zero, and the gain — reviewable diffs, safe reverts, clean bisects — compounds across every PR you ever write.

Source: Beck, *Tidy First?* (O'Reilly, 2023).
