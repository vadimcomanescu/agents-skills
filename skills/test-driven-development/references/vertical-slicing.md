# Vertical slicing — tracer bullets, not horizontal layers

The most common LLM-specific TDD failure is **horizontal slicing**: writing all the tests first, then all the implementation. It looks like TDD because there is a RED phase and a GREEN phase. It is not TDD.

Credit: this anti-pattern was named and made central by Matt Pocock — see `https://github.com/mattpocock/skills/blob/main/skills/engineering/tdd/SKILL.md`.

## What goes wrong

Tests written in bulk test **imagined** behavior, not **observed** behavior. Symptoms:

- Tests assert on the *shape* of data structures and function signatures rather than user-facing outcomes.
- Tests pass when behavior breaks (because they were written against an imagined contract that the implementation drifts from).
- Tests fail when behavior is fine (because you committed to test structure before understanding the implementation).
- The implementation phase becomes one giant blob of code; you cannot tell which test forced which line.

You also "outrun your headlights" — you commit to test structure before the implementation has taught you what matters.

## The rule

```
ONE test → ONE implementation → repeat.
```

Each cycle responds to what the previous cycle taught you. Because you just wrote the code, you know exactly what behavior matters and how to verify it next.

```
WRONG (horizontal slicing):
  RED phase:    t1, t2, t3, t4, t5
  GREEN phase:  i1, i2, i3, i4, i5

RIGHT (vertical slicing / tracer bullets):
  RED→GREEN: t1 → i1   (proves the path end-to-end)
  RED→GREEN: t2 → i2   (responds to what i1 revealed)
  RED→GREEN: t3 → i3   (responds to what i2 revealed)
  ...
```

## Tracer bullets

The first test is a **tracer bullet**: the smallest end-to-end test that proves the path works. Not the most important behavior. Not the happy path. The smallest path that touches every layer the feature touches.

For a CRUD endpoint, the tracer bullet is "POST creates a row visible by GET". Not validation, not auth, not error handling — those are subsequent cycles.

For a parser, the tracer bullet is "the simplest valid input parses". Then "an empty input is rejected". Then the first edge case.

The tracer bullet validates the shape of the seams. Subsequent tests fill it in.

## Planning step

Before the first RED, do this:

1. List the behaviors to test, prioritized. Three to seven items, not thirty.
2. Pick the tracer bullet — the smallest end-to-end test.
3. Confirm with your human partner that this is the right starting point. They may know that two of the behaviors collapse, or that one is more critical than the rest.
4. Write the tracer bullet. Then iterate.

This is NOT writing tests in bulk — it is writing a TODO of behaviors. The tests themselves are written one at a time, each followed by its own implementation.

## How to recognize horizontal slicing in your own work

- A test file that grew by 100+ lines before any production code changed.
- Multiple `it(...)` or `def test_...` in the same diff with no production-code lines between them.
- A pull request whose title is "tests for X" and whose body promises "implementation in a follow-up".

Any of these means you horizontal-sliced. Squash, then redo as one-test-at-a-time cycles. The lost time is the cost of the discipline.

## When horizontal slicing is acceptable

Almost never. The closest legitimate case is **specification drafting**: when you and a human partner are sketching a contract before any implementation exists, you may write a list of `it.todo(...)` placeholders. These are not real tests; they are a checklist. The first real cycle still starts with one RED, one GREEN.
