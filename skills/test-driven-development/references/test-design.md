# Test design — pyramid, sizes, AAA, DAMP, naming

## Contents
- The test pyramid
- Test sizes (Google's resource model)
- Arrange-Act-Assert
- DAMP over DRY in tests
- One assertion per concept
- Naming
- The Beyonce Rule
- What not to test
- What to test more than you think

How to write tests that survive five years of refactors and still fail when behavior breaks.

## The test pyramid

```
          ╱╲
         ╱  ╲         E2E (~5%)              full user flows, real browser/process
        ╱    ╲
       ╱──────╲
      ╱        ╲      Integration (~15%)     component & boundary interactions
     ╱          ╲
    ╱────────────╲
   ╱              ╲   Unit (~80%)            pure logic, isolated, milliseconds each
  ╱                ╲
 ╱──────────────────╲
```

Most tests should be small and fast. The pyramid inverts when teams pad coverage with E2Es because the unit tests are hard to write — that's a design smell, not a testing strategy. See `testability-via-design.md`.

## Test sizes (Google's resource model)

A more operational classification than "unit/integration/E2E":

| Size | Constraints | Speed | Examples |
|---|---|---|---|
| **Small** | One process, no I/O, no network, no DB, no clock | milliseconds | Pure functions, data transforms, small classes |
| **Medium** | Multi-process OK, localhost only, no external services | seconds | API tests with test DB, component tests with fake backends |
| **Large** | Multi-machine, external services allowed | minutes | E2E tests, perf benchmarks, staging integration |

Defaults: most tests should be Small. Mediums for component-and-boundary work. Larges only for critical user paths.

Source: *Software Engineering at Google* (Wright, Manshreck, Winters), the original Google blog post on test sizes.

## Arrange-Act-Assert

Every test, three phases, in this order:

```typescript
it('marks overdue tasks when deadline has passed', () => {
  // Arrange — set up the world
  const task = makeTask({ deadline: new Date('2025-01-01') });

  // Act — exercise the behavior
  const result = checkOverdue(task, new Date('2025-01-02'));

  // Assert — verify the outcome
  expect(result.isOverdue).toBe(true);
});
```

When a test does not fit AAA cleanly, it usually means one of:

- The test is doing two things — split it.
- The setup is enormous — your code under test has too many collaborators (see `testability-via-design.md`).
- The act is a sequence of calls with assertions interleaved — you are testing a workflow, not a behavior. Either factor the workflow into a single behavior or write the test as a series of named sub-AAA blocks.

## DAMP over DRY in tests

In production code, **DRY** (Don't Repeat Yourself) is usually right.

In tests, **DAMP** (Descriptive And Meaningful Phrases) is better. Each test should read like a self-contained specification. A reader should not have to trace through three helper files to understand what the test verifies.

```typescript
// DAMP — each test is self-contained
it('rejects tasks with empty titles', () => {
  expect(() => createTask({ title: '', assignee: 'u-1' })).toThrow('Title is required');
});

it('trims whitespace from titles', () => {
  const task = createTask({ title: '  Buy groceries  ', assignee: 'u-1' });
  expect(task.title).toBe('Buy groceries');
});
```

Anti-pattern (over-DRY):

```typescript
const baseInput = { assignee: 'u-1' };
const tests = [
  ['empty', '', 'Title is required'],
  ['whitespace', '  Buy groceries  ', 'Buy groceries'],
];
test.each(tests)('%s', (_, title, expected) => { /* ... */ });
```

That table-driven version is fine when behavior across cases is genuinely uniform (e.g., one regex, twenty inputs). When the behaviors differ — error vs. transform — separate `it` blocks read better.

Duplication in tests is acceptable when it makes each test independently understandable.

## One assertion per concept

Not "one assertion per test" — one *concept* per test. A test for `createTask` may need three asserts to confirm the resulting object's id, title, and status, because *the concept is "creating a task produces a task with these fields"*. But:

```typescript
// BAD — three concepts in one test
it('validates titles correctly', () => {
  expect(() => createTask({ title: '' })).toThrow();
  expect(createTask({ title: '  hello  ' }).title).toBe('hello');
  expect(() => createTask({ title: 'a'.repeat(256) })).toThrow();
});

// GOOD — three tests
it('rejects empty titles', () => { /* ... */ });
it('trims whitespace from titles', () => { /* ... */ });
it('enforces a 255-char title limit', () => { /* ... */ });
```

When one test breaks, you want to know *what behavior broke*, not *which of three behaviors broke first*.

## Naming

Tests names are sentences. The grammar that works:

- `<subject> <verb> <expected outcome> [when <condition>]`
- `rejects empty email`
- `returns tasks sorted by createdAt descending`
- `is idempotent — completing an already-completed task is a no-op`
- `throws NotFoundError for non-existent task`

Names that are not sentences:

- `test1` — name says nothing
- `validates correctly` — what counts as "correctly"?
- `email` — noun, not a sentence; doesn't say what's expected
- `should work` — should it?

If you cannot name the test as a sentence, you do not yet know what behavior you are testing. Stop and figure that out before writing the test body.

## The Beyonce Rule

> If you liked it, you should have put a test on it.

Infrastructure changes, refactoring, migrations — none of those are responsible for catching your bugs. Your tests are. If a change breaks your code and you didn't have a test for it, that's on you, not on the change.

## What not to test

- Third-party code. You don't own it. Test that *your* code calls it correctly, not that the framework works.
- Trivial getters/setters with no logic. The test would just restate the field's existence.
- Generated code. Test the generator if you wrote it; trust the generator output otherwise.
- Configuration loading. Test that *the configured behavior* works, not that the config parser parsed.

## What to test more than you think

- Boundaries. Off-by-one. Empty/null/undefined. The first and last allowed values. The first disallowed value.
- Error paths. Every `throw`, every `Result::Err`, every `if (failure)`. Mutation testing (see `mutation-testing.md`) will catch the ones you forget.
- Invariants under refactor. If you renamed something, run the full suite — not just the file you touched.
