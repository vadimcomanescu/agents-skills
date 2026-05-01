# Mocking and fakes — the cheapest test double, not the most clever one

## Contents
- Preference order (most to least preferred)
- When real is right
- When a fake is right
- When a stub is right
- When a mock is right
- The five anti-patterns
- Gate functions before mocking
- Mock setup as a smell
- Boundary mocking — record-and-replay
- When you cannot avoid a complex mock
- The bottom line

Mocks are tools to **isolate**, not things to test. The more your tests use real code, the more confidence they give you.

## Preference order (most to least preferred)

```
1. Real implementation   — Highest confidence. Catches real bugs. Use whenever feasible.
2. Fake                  — In-memory version of a dependency (e.g., in-memory DB, fake clock, fake queue).
3. Stub                  — Returns canned data, no behavior. Cheap, narrow.
4. Mock (interaction)    — Verifies that calls happened. Use only when the call IS the behavior.
```

When in doubt, climb the ladder. A fake is almost always cheaper to maintain than a deeply-stubbed mock.

## When real is right

- Pure functions, value objects, domain logic — always real.
- Local in-process collaborators — usually real.
- Database access — real, against an ephemeral test DB (per-test transaction or per-test schema).
- File system — real, in a tmp directory the test cleans up.

The cost of "real" is speed and flake. Both are addressable: keep the test small (Google's "small" size — see `test-design.md`), and make the test set up and tear down its own state.

## When a fake is right

- Time. Use a fake clock (`vi.useFakeTimers()`, `freeze_time` in Python, `tokio::time::pause()` in Rust). Real time is non-deterministic and slow.
- External services that have a stable API. A fake S3, fake Stripe, fake email sender — written once, reused everywhere.
- Random values. Inject a deterministic seed or a fake RNG.

A fake is "real enough" — it has behavior, not just canned answers. Tests against fakes survive refactors that tests against stubs do not.

## When a stub is right

- A collaborator's response is irrelevant to the behavior you're testing — you just need *some* return value to keep the code under test running.
- The collaborator is expensive to construct in the test (e.g., a third-party SDK with deep config).

A stub returning `{ ok: true }` is fine when the test is about what your code does *after* receiving an OK; it is not fine when the test is about your code's logic for choosing the OK branch.

## When a mock is right

When the **call itself is the behavior** you are testing. Examples:

- The audit logger emits the right event for a given action.
- The publish-to-queue method fires once with the right payload when a domain event happens.
- The outbound webhook is invoked with the right shape.

Otherwise, mocking is usually a sign that you are testing implementation. See `state-vs-interaction.md`.

## The five anti-patterns

These come from `obra/superpowers/test-driven-development/testing-anti-patterns.md` and are reproduced (with credit) in `anti-patterns.md`:

1. **Testing mock behavior** — `expect(screen.getByTestId('sidebar-mock')).toBeInTheDocument()`. You are verifying the mock was rendered, not that the page works.
2. **Test-only methods in production** — `Session.destroy()` that exists only so tests can reset state. Move it to a test util.
3. **Mocking without understanding** — replacing a method whose side effect the test silently depends on, then wondering why the test passes when it shouldn't.
4. **Incomplete mocks** — partial responses missing fields that downstream code consumes. Test passes; production breaks.
5. **Integration tests as afterthought** — "implementation done, ready for testing". Testing is part of implementation, not a follow-up.

## Gate functions before mocking

Before adding a mock, ask:

```
1. What side effects does the real method have?
2. Does this test depend on any of those side effects?
3. Do I fully understand what this test needs?

IF the test depends on side effects of the thing I'm about to mock:
   Mock at a lower level (the actual slow/external operation),
   OR use a fake that preserves the necessary behavior,
   NOT the high-level method the test depends on.

IF I'm unsure what the test depends on:
   Run the test with the real implementation FIRST.
   Observe what actually happens.
   Then add minimal mocking at the right level.

Red flags:
   "I'll mock this to be safe."
   "This might be slow, better mock it."
   Mocking without tracing the dependency chain.
```

## Mock setup as a smell

Watch the size and shape of the mock setup:

| Symptom | What it means |
|---|---|
| Mock setup is more than half the test | The unit under test has too many collaborators. Find the deep module hiding inside. |
| You mocked five collaborators, then asserted that one was called | You're testing one of five interactions; the other four were mocked "to be safe". Replace four of them with reals or fakes. |
| The mock has methods the real class does not | You drifted. The test will pass against the mock and fail against production. |
| The test breaks when you change the mock, even though behavior is unchanged | You are testing the mock, not the code. |

A test whose setup is shorter than its assertions is a healthy test. A test whose setup is twice the assertions usually means the unit needs a smaller seam.

## Boundary mocking — record-and-replay

For external APIs you must call but cannot run in tests, prefer **recorded fixtures** over hand-written mocks:

- Run the real call once, record the response, commit the recording.
- Replay the recording in the test.
- When the API changes, re-record (it's a single command).

Tools: VCR (Ruby/Python), Polly.JS (Node), `wiremock` standalone, `cassette` patterns. The win is that the recorded response is *complete* — you cannot omit a field your code consumes downstream, because the field came from a real call.

## When you cannot avoid a complex mock

You are about to write a mock with five methods, ordered expectations, and conditional return values. Stop.

Two questions:

1. Should this be an integration test instead? Real collaborators, against a test DB, often less code than the mock would have been.
2. Should this be a fake? A 50-line in-memory fake reused across the suite is cheaper than 50 mock setups, one per test.

When both answers are no — the call is genuinely a behavior you must verify, the mock is the right shape — then write the mock carefully. But the answer is no for fewer cases than agents tend to assume.

## The bottom line

> Mocks are tools to isolate, not things to test.

If your test has more mock setup than behavior, the unit is wrong, not the test.

If your test asserts on the mock, you have inverted the relationship — the mock is now the system under test, and the real code is unverified.

When in doubt: less mocking, more reality.
