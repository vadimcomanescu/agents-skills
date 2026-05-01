# Testing anti-patterns

## Contents
- The Iron Laws (of mocking, specifically)
- Anti-Pattern 1: Testing mock behavior
- Anti-Pattern 2: Test-only methods in production classes
- Anti-Pattern 3: Mocking without understanding
- Anti-Pattern 4: Incomplete mocks
- Anti-Pattern 5: Integration tests as afterthought
- Anti-Pattern 6: Horizontal slicing (LLM-specific)
- Anti-Pattern 7: Snapshot abuse
- Anti-Pattern 8: Flaky tests
- Anti-Pattern 9: Testing framework code
- Anti-Pattern 10: No test isolation
- Quick reference
- The bottom line

Patterns that produce passing tests and broken code. Adapted from `obra/superpowers/test-driven-development/testing-anti-patterns.md`, with vertical-slicing added from `mattpocock/skills`.

## The Iron Laws (of mocking, specifically)

```
1. NEVER test mock behavior.
2. NEVER add test-only methods to production classes.
3. NEVER mock without understanding the dependencies.
4. NEVER write all tests first then all implementation (horizontal slicing).
```

## Anti-Pattern 1: Testing mock behavior

**Violation:**

```typescript
// ❌ Testing that the mock exists
test('renders sidebar', () => {
  render(<Page />);
  expect(screen.getByTestId('sidebar-mock')).toBeInTheDocument();
});
```

**Why it is wrong:**

- You are verifying the mock was rendered, not that the page works.
- The test passes when the mock is present and fails when it is not — it tells you nothing about real behavior.

**Fix:**

```typescript
// ✅ Test real behavior, or do not mock
test('renders sidebar', () => {
  render(<Page />);
  expect(screen.getByRole('navigation')).toBeInTheDocument();
});
```

If the sidebar must be mocked for isolation, do not assert on the mock — assert on the *page's* behavior with the sidebar present.

**Gate:** before asserting on any mock element, ask *"Am I testing real component behavior or just mock existence?"*. If the latter: delete the assertion or unmock the component.

## Anti-Pattern 2: Test-only methods in production classes

**Violation:**

```typescript
// ❌ destroy() exists only because tests need it
class Session {
  async destroy() {
    await this._workspaceManager?.destroyWorkspace(this.id);
    // ... cleanup
  }
}

afterEach(() => session.destroy());  // only call site
```

**Why it is wrong:**

- Production class is polluted with test-only code.
- Dangerous if the method is accidentally called in production.
- Violates YAGNI and separation of concerns.
- Confuses object lifecycle with entity lifecycle.

**Fix:**

```typescript
// ✅ Move cleanup to a test utility
// (Session has no destroy() — it is stateless in production.)

// test-utils/sessions.ts
export async function cleanupSession(session: Session) {
  const workspace = session.getWorkspaceInfo();
  if (workspace) await workspaceManager.destroyWorkspace(workspace.id);
}

afterEach(() => cleanupSession(session));
```

**Gate:** before adding any method to a production class, ask *"Is this only used by tests?"*. If yes: stop. Put it in test utilities. Then ask *"Does this class own this resource's lifecycle?"*. If no: wrong class.

## Anti-Pattern 3: Mocking without understanding

**Violation:**

```typescript
// ❌ Mock prevents the side effect that the test depends on
test('detects duplicate server', async () => {
  vi.mock('ToolCatalog', () => ({
    discoverAndCacheTools: vi.fn().mockResolvedValue(undefined),
  }));

  await addServer(config);
  await addServer(config);  // should throw — but the config write was mocked away, so it won't
});
```

**Why it is wrong:**

- The mocked method had a side effect (writing config) that the test depended on.
- Over-mocking "to be safe" breaks actual behavior.
- The test passes for the wrong reason or fails mysteriously.

**Fix:**

```typescript
// ✅ Mock at the right level
test('detects duplicate server', async () => {
  vi.mock('MCPServerManager');  // mock the slow startup, NOT the config write

  await addServer(config);   // config written
  await addServer(config);   // duplicate detected
});
```

**Gate:** before mocking any method, ask:
1. What side effects does the real method have?
2. Does this test depend on any of those side effects?
3. Do I understand the dependency chain?

If you depend on side effects: mock at a lower level (the actual slow operation), or use a fake that preserves behavior. Never mock the high-level method the test depends on. If unsure: run with the real implementation first, observe, then mock minimally.

## Anti-Pattern 4: Incomplete mocks

**Violation:**

```typescript
// ❌ Partial mock — missing fields downstream code consumes
const mockResponse = {
  status: 'success',
  data: { userId: '123', name: 'Alice' },
  // Missing: metadata.requestId, which downstream code uses
};
```

**Why it is wrong:**

- Partial mocks hide structural assumptions — you only mock fields you know about.
- Downstream code may depend on fields you didn't include.
- Tests pass but integration fails.

**Fix:**

```typescript
// ✅ Mirror the real API completely
const mockResponse = {
  status: 'success',
  data: { userId: '123', name: 'Alice' },
  metadata: { requestId: 'req-789', timestamp: 1234567890 },
};
```

The Iron Rule: **mock the COMPLETE data structure as it exists in reality**, not just the fields the immediate test uses. Better yet, use record-and-replay (`mocking-and-fakes.md`) so the mock cannot drift from the real API.

## Anti-Pattern 5: Integration tests as afterthought

**Violation:**

```
"Implementation complete."
"No tests written."
"Ready for testing."
```

**Why it is wrong:**

- Testing is part of implementation, not an optional follow-up.
- TDD would have caught this.
- "Complete" without tests is incomplete.

**Fix:** the cycle. RED → verify RED → GREEN → verify GREEN → REFACTOR → repeat. Then claim complete.

## Anti-Pattern 6: Horizontal slicing (LLM-specific)

**Violation:** writing all tests first, then all the implementation. The diff has 100+ lines of new tests with no production-code lines, then a giant blob of implementation.

**Why it is wrong:**

- Tests written in bulk test *imagined* behavior, not *observed* behavior.
- The implementation phase becomes a single blob; you cannot trace which test forced which line.
- Tests assert on the *shape* of imagined contracts that drift as you implement.

**Fix:** vertical slicing. ONE test → ONE implementation → repeat. Each cycle responds to what the previous cycle taught you. See `vertical-slicing.md`.

**Gate:** if you have written more than one test without a corresponding piece of production code, you are horizontal-slicing. Stop. Squash. Redo as one-test-at-a-time cycles.

## Anti-Pattern 7: Snapshot abuse

**Violation:** large auto-generated snapshots that nobody reviews, that break on any change, and that get regenerated mechanically on failure.

**Why it is wrong:**

- The snapshot is too large to review meaningfully.
- "Update snapshots" becomes a reflex; the actual behavior change goes unexamined.
- Snapshots couple tests to incidental output (HTML attribute order, whitespace, ID generation).

**Fix:**

- Keep snapshots small and focused (single component or single computed value).
- Review every snapshot diff manually.
- Prefer behavioral assertions over snapshots when both work.

## Anti-Pattern 8: Flaky tests

**Violation:** tests that pass sometimes and fail sometimes, often due to timing, ordering, or shared state.

**Why it is wrong:** every flake erodes trust. Once a suite is flaky, real failures get retried away.

**Fix:**

- Replace `setTimeout`/`sleep` with deterministic waits (test events, fake timers).
- Isolate state per test — no shared globals, no shared DB rows, no shared tmp files.
- If a test is flaky, treat it as broken: quarantine it, fix the root cause, then unquarantine. Never *just* retry.

## Anti-Pattern 9: Testing framework code

**Violation:**

```typescript
test('useState updates state', () => {
  // ... testing React's useState
});
```

**Why it is wrong:** React, Vue, Express, Django, etc. have their own test suites. You don't need to verify they work. Testing them wastes time and produces noise.

**Fix:** test your code. If your code wraps a framework feature, test the *wrapping behavior*, not the framework underneath.

## Anti-Pattern 10: No test isolation

**Violation:** tests pass individually but fail when run as a suite, or fail in a different order.

**Why it is wrong:** you have shared state (a singleton, a real DB without per-test cleanup, a global config flag). Tests interact, and the interactions are usually invisible.

**Fix:**

- Each test sets up its own state and tears it down.
- Database tests run in transactions that roll back, or against a per-test schema.
- Global config flags are reset in `afterEach`.
- Module-level mutable state is reset (or eliminated).

## Quick reference

| Anti-Pattern | Tell | Fix |
|---|---|---|
| Mock behavior | `getByTestId('*-mock')` | Test real behavior, or do not mock |
| Test-only methods | Public method only called from tests | Move to test utilities |
| Mock without understanding | "I'll mock this to be safe" | Trace the dependency chain first |
| Incomplete mocks | Mock missing fields the real API has | Mirror reality; or record-and-replay |
| Tests as afterthought | "Done. Ready for testing." | TDD cycle |
| Horizontal slicing | Many tests, no impl, then one big impl blob | Vertical slices: one test → one impl |
| Snapshot abuse | Snapshots > 50 lines, mechanically updated | Small, reviewed snapshots |
| Flaky tests | Pass-fail-pass-fail | Deterministic waits, isolated state |
| Testing framework code | Asserting on framework behavior | Only test your code |
| No test isolation | Tests pass alone, fail in suite | Per-test setup/teardown |

## The bottom line

> Mocks are tools to isolate, not things to test.
> Tests verify behavior, not implementation.
> One test, one implementation, repeat.
> Production code does not exist for the convenience of tests.

If a test seems like it requires breaking one of these, that is a design signal — not a license to bend the rule.
