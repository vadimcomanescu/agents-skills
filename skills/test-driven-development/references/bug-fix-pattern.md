# The Prove-It Pattern — bug fixes via reproduction tests

## Contents
- The five steps
- Why test-before-fix, not test-after-fix
- A worked example
- When the bug is hard to reproduce
- When the bug is "intermittent"
- When the user reports a bug that is actually a feature request
- Anti-patterns
- Combine with mutation testing
- The bottom line

A bug fix without a reproduction test is not a fix; it is a hope. The test proves the bug existed, proves the fix works, and prevents regression. All three at once.

## The five steps

```
1. Read the bug report. Understand the expected vs. actual behavior.
2. Write a test that reproduces the bug.   ← test FAILS  (bug confirmed)
3. Fix the code.                            ← test PASSES (fix verified)
4. Run the full suite.                      ← no regressions
5. Commit: behavior commit on the fix; test in the same commit.
```

The order is non-negotiable. The test is written **before** the fix.

## Why test-before-fix, not test-after-fix

You may be tempted: "Let me see if my fix works first, then write a test that documents it."

This produces two failure modes:

1. **The test is biased toward your fix.** It tests the path your fix took, not the underlying behavior. A different fix that solves the same bug differently would fail this test for the wrong reason.
2. **The test passes immediately.** You never see it fail. You don't know if it would have caught the bug.

Test-first means the test is written against the *requirement*, not the *fix*. The test fails (because the bug is present), the fix makes it pass, and from then on the test guards the requirement no matter how the fix evolves.

## A worked example

**Bug:** "Completing a task does not update the `completedAt` timestamp."

### Step 1 — read

The user expects: when `completeTask(id)` is called, the resulting task has both `status === 'completed'` and `completedAt` set to a Date.

The actual behavior: status changes, but `completedAt` is unset.

### Step 2 — reproduce (test should FAIL)

```typescript
it('sets completedAt when a task is completed', async () => {
  const task = await taskService.createTask({ title: 'Test' });

  const completed = await taskService.completeTask(task.id);

  expect(completed.status).toBe('completed');
  expect(completed.completedAt).toBeInstanceOf(Date);  // FAILS — bug confirmed
});
```

Run it. Confirm:

- It fails (it does).
- The failure message points at the missing `completedAt` (it does).
- It does not error on a typo or missing import.

### Step 3 — fix (test should PASS)

```typescript
export async function completeTask(id: string): Promise<Task> {
  return db.tasks.update(id, {
    status: 'completed',
    completedAt: new Date(),  // was missing
  });
}
```

Run it. The test now passes.

### Step 4 — full suite

Run all tests. Confirm none of them broke. If any did:

- They were testing the buggy behavior. Update them — the bug is fixed.
- Or your fix changed something unrelated. Back out, isolate the change.

### Step 5 — commit

```
Fix: set completedAt when a task is completed

The completeTask service was updating status but not the completedAt
timestamp. Reproduction test added; full suite green.
```

The test and the fix go in the same commit. Future readers can see exactly which test guards exactly which fix. (Per Tidy First — `tidy-first.md` — this is a behavioral commit, not structural.)

## When the bug is hard to reproduce

Some bugs are hard to land on a deterministic test:

- **Timing-dependent** — the bug appears under load, or in a specific clock state.
- **Concurrency-dependent** — race conditions.
- **Environment-dependent** — only on certain OSes, certain hardware, certain time zones.

The pattern is the same; the test just needs more discipline:

- For timing: inject a fake clock; force the conditions deterministically.
- For concurrency: use a deterministic scheduler (loom in Rust, ThreadSanitizer in C++, controlled goroutine yields in Go) or use a stress test (`pytest-stress`, `cargo test --test-threads=1` to force the sequence).
- For environment: test the abstraction, not the env. Mock the env at the boundary; test that *your code* responds correctly to each env state.

If you absolutely cannot reproduce deterministically, write the closest behavioral test you can (e.g., "the timestamp is monotonic across N concurrent calls") and document the limitation. The next-best thing to a reproduction test is an *invariant* test that the bug would have violated.

## When the bug is "intermittent"

Bugs reported as intermittent are usually deterministic — you just haven't found the trigger. Treat the report as a clue:

1. Read the report carefully. Note every detail (browser, OS, time of day, actions taken).
2. Try to find the *smallest input that triggers it*. Binary-search the user's actions.
3. Once it is deterministic, the Prove-It pattern applies normally.

Bugs that genuinely cannot be made deterministic almost always come from a race or a missing timeout — find the source and write the test against that, not against the symptom.

## When the user reports a bug that is actually a feature request

Sometimes the "bug" is "the code does what it was designed to do, but the design is wrong". Two options:

1. **Treat it as a feature change.** The Prove-It pattern still applies — you write a test for the *new* expected behavior, watch it fail (because the old design is in place), then change the code.
2. **Push back on the report.** Sometimes the report is wrong (the user misunderstood the spec). Discuss before writing tests.

Either way, you are writing a test before changing code. The framing is the same.

## Anti-patterns

- **"I see the bug; let me just fix it"** — you are about to skip the test. Stop. Write the test first.
- **"I'll add a test after I confirm the fix works"** — see "Why test-before-fix" above. The test will be biased.
- **Asserting on the fix's mechanism** — the test should assert on the *behavior* the user expects, not on the line of code you added. If you renamed the field tomorrow, the test should still pass as long as the behavior holds.
- **No regression test for a "trivial" bug** — every bug, no matter how small, gets a test. The trivial bugs come back; that is what makes them not-trivial.
- **Updating an existing test to "fix" the bug** — if the existing test was asserting the buggy behavior, that is a sign the test was wrong. Add a *new* test for the correct behavior; only delete the old test if it was genuinely incorrect.

## Combine with mutation testing

After fixing a bug:

1. Run mutation testing on the fixed file.
2. If a mutant survives in the area you fixed, your fix's coverage is shallow — add another test.
3. The bug fix is complete when the test passes, the suite is green, AND no new mutants survive in the changed code.

See `mutation-testing.md`.

## The bottom line

```
Bug → reproduction test → test fails → fix → test passes → full suite → commit
```

Every step. Every bug. Every time.

A regression-test suite is built one bug at a time. Each test is a "this will not happen again" promise. The promises compound; the codebase gets less brittle with every bug fix.
