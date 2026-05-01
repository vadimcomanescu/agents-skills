# State-based vs interaction-based testing

A test should fail when the **observable behavior** changes — and only then.

If a test fails when you rename an internal helper but no externally observable behavior changed, the test was testing implementation, not behavior.

## State-based assertions

Assert on the **outcome** of the operation: what was returned, what is now true about the system, what the user can now observe.

```typescript
// GOOD — state-based
it('returns tasks sorted by createdAt, newest first', async () => {
  const tasks = await listTasks({ sortBy: 'createdAt', sortOrder: 'desc' });
  expect(tasks[0].createdAt.getTime()).toBeGreaterThan(tasks[1].createdAt.getTime());
});
```

This test will pass against any implementation — SQL `ORDER BY`, in-memory `Array.sort`, a stored view, a different ORM — as long as the *output is correctly ordered*. It is exactly as strict as it needs to be.

## Interaction-based assertions

Assert on the **calls** the code under test made: which methods, with which arguments, in which order.

```typescript
// USUALLY BAD — interaction-based
it('calls db.query with ORDER BY created_at DESC', async () => {
  await listTasks({ sortBy: 'createdAt', sortOrder: 'desc' });
  expect(db.query).toHaveBeenCalledWith(
    expect.stringContaining('ORDER BY created_at DESC')
  );
});
```

This test is over-specific. It will fail if you:

- Switch from raw SQL to an ORM.
- Cache the result and skip the call on the second invocation.
- Combine two queries into a stored procedure.
- Add a `LIMIT` for pagination — even though sorting still works.

None of those changes are bugs. The test is wrong, not the code.

## When interaction-based is correct

Interaction-based tests are correct when **the interaction itself is the behavior**:

- A logger emits an audit log: "did this thing get logged?" is a behavior, and the call to `logger.audit(...)` is what you observe.
- A message queue: "did we publish to topic X?" is the externally observable thing. There is no "state" to inspect — the queue is the world boundary.
- An outbound HTTP call to a third party: "did we call Stripe with the right args?" is the behavior. (Often combined with a recorded fixture; see `mocking-and-fakes.md`.)
- A side effect on a collaborator that the test cannot inspect cheaply.

The rule: you assert on the call when the call **crosses the boundary you are testing**, not on internal collaborators.

## Heuristic — the rename test

> If I rename an internal helper class or method, will this test fail?

If yes, and the rename did not change observable behavior, the test is implementation-coupled. Rewrite it state-based.

## Heuristic — the rewrite test

> If I rewrite the implementation in a different style (different language idiom, different library, different algorithm) but produce the same outputs, will this test still pass?

If no, the test is implementation-coupled. State-based tests survive rewrites; that is one of the main reasons to write them.

## Patterns to prefer

- **Return values over mutations.** If you can write a function that takes inputs and returns an output, your test can assert on the output. Easy to test, easy to compose. Harder when the function has side effects (DB write, network call, file system).
- **Domain types over primitive output.** Returning a `Money` aggregate gives you stronger assertions than returning a `number`. The test reads `expect(invoice.total).toEqual(Money(120, 'USD'))` — clearer than `expect(total).toBe(120)`.
- **Inspect the system after the act.** For functions with side effects, query the system afterward through its public interface: `await getTask(id)` after `createTask`, not `expect(db.tasks.insert).toHaveBeenCalled()`.

## When the public interface does not give you enough to assert on

Sometimes the only way to verify a behavior would be to inspect a private field or a collaborator. This is a **design smell**, not a testing problem.

Two fixes:

1. **Promote the missing observation to the interface.** Add a query method (`getStatus`, `listEvents`) that exposes what the test needs to assert on. This is often a feature the production code wanted anyway.
2. **Test at a higher level.** If you cannot expose the observation cheaply at the unit level, test the larger composition that *does* expose it.

What you should not do: punch through to private state with reflection or test-only methods. See `anti-patterns.md` (Anti-Pattern 2: Test-Only Methods in Production).

## The bottom line

```
Test the WHAT, not the HOW.
WHAT  = inputs, outputs, externally observable state, calls across real boundaries.
HOW   = which collaborator was called in which order with which args inside the unit.
```

Tests that test the *what* survive refactors. Tests that test the *how* are a tax on every change.
