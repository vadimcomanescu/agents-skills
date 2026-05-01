# TypeScript + Vitest — a full TDD cycle

Tooling: `vitest` for tests, `@stryker-mutator/core` for mutation testing.

```bash
npm install --save-dev vitest @stryker-mutator/core @stryker-mutator/vitest-runner
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],   // colocated tests
    coverage: { provider: 'v8', reporter: ['text', 'json-summary'] },
  },
});
```

Test files live next to the source: `src/discount.ts` and `src/discount.test.ts`.

## Cycle 1 — feature add (tracer bullet)

**Goal:** apply a percent discount.

### RED — `src/discount.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { discount } from './discount';

describe('discount', () => {
  it('reduces 100 by 10% to 90', () => {
    expect(discount(100, 10)).toBe(90);
  });
});
```

### Verify RED

```bash
npx vitest run src/discount.test.ts
# FAIL: cannot find module './discount'
```

Add a stub so the failure is at the assertion, not the import:

```ts
// src/discount.ts
export function discount(amount: number, percent: number): number {
  return 0;
}
```

```bash
npx vitest run src/discount.test.ts
# FAIL: expected 0 to be 90  ← clean RED
```

### GREEN — minimum

```ts
// src/discount.ts
export function discount(amount: number, percent: number): number {
  return amount - (amount * percent) / 100;
}
```

```bash
npx vitest run src/discount.test.ts
# PASS
```

### Verify GREEN

```bash
npx vitest run
# All tests pass. No warnings.
```

### Commit (behavioral)

```
Add: discount(amount, percent) reduces by percent

Tracer bullet for the discount module: 100 - 10% = 90.
```

## Cycle 2 — boundary

### RED

```ts
it('returns the same amount when percent is 0', () => {
  expect(discount(100, 0)).toBe(100);
});
```

### Verify RED — wait, this passes immediately

It does. The current impl returns `100 - 0 = 100`. The test passes.

A test that passes immediately means it does not force a new line of production code. **It is not a TDD test.** Two options:

1. **Discard.** The boundary is already covered by Cycle 1's behavior; we don't need a separate test.
2. **Strengthen.** Replace with a test that *would* have failed if the implementation were wrong (e.g., a property: discount of 0% never changes the amount, across many inputs). That test belongs in a property-test framework (`fast-check`).

We choose 1. Move on.

## Cycle 3 — error path

### RED

```ts
it('throws when percent is greater than 100', () => {
  expect(() => discount(100, 150)).toThrow('percent must be 0..100');
});
```

### Verify RED

```bash
npx vitest run src/discount.test.ts
# FAIL: discount throws when percent is greater than 100
#   Expected: 'percent must be 0..100'
#   Received: undefined           ← no error was thrown
```

Clean RED.

### GREEN

```ts
export function discount(amount: number, percent: number): number {
  if (percent < 0 || percent > 100) {
    throw new Error('percent must be 0..100');
  }
  return amount - (amount * percent) / 100;
}
```

### Verify GREEN — full suite

```bash
npx vitest run
# All tests pass.
```

### Commit (behavioral)

```
Add: discount throws on percent outside 0..100
```

## Cycle 4 — bug fix (Prove-It Pattern)

**Bug report:** "negative amounts give wrong results — `discount(-100, 10)` returns `-90`, but the user expects an error".

### RED — reproduction

```ts
it('throws when amount is negative', () => {
  expect(() => discount(-100, 10)).toThrow('amount must be non-negative');
});
```

### Verify RED

```bash
npx vitest run src/discount.test.ts
# FAIL: discount throws when amount is negative
#   Expected: 'amount must be non-negative'
#   Received: undefined           ← bug confirmed (no error thrown)
```

### Fix

```ts
export function discount(amount: number, percent: number): number {
  if (amount < 0) throw new Error('amount must be non-negative');
  if (percent < 0 || percent > 100) {
    throw new Error('percent must be 0..100');
  }
  return amount - (amount * percent) / 100;
}
```

### Verify GREEN

```bash
npx vitest run
# All tests pass.
```

### Commit (behavioral)

```
Fix: discount rejects negative amounts

Reproduces the bug with a test that fails on the previous code; fix
adds the input guard. Full suite green.
```

## Refactor (Tidy First — separate commit)

Now that we have three guard clauses, extract them. Tests stay green throughout.

```ts
function assertNonNegative(amount: number): void {
  if (amount < 0) throw new Error('amount must be non-negative');
}

function assertPercent(percent: number): void {
  if (percent < 0 || percent > 100) {
    throw new Error('percent must be 0..100');
  }
}

export function discount(amount: number, percent: number): number {
  assertNonNegative(amount);
  assertPercent(percent);
  return amount - (amount * percent) / 100;
}
```

```bash
npx vitest run
# All tests pass.
```

### Commit (structural)

```
Refactor: extract assertion helpers in discount
```

Two commits per cycle (behavior, structure) keep diffs reviewable.

## Mutation testing

`stryker.conf.json`:

```json
{
  "$schema": "https://unpkg.com/@stryker-mutator/core/schema/stryker-schema.json",
  "testRunner": "vitest",
  "mutate": ["src/discount.ts"],
  "thresholds": { "high": 90, "low": 80, "break": 80 }
}
```

```bash
npx stryker run
```

Read the report. For every survivor:

1. Identify which assertion would have caught the mutation.
2. Add a test or strengthen an existing assertion.
3. Re-run.

Common survivors on this kind of code:

- `*` → `+` in the formula: tests that only assert directionality (`< 100`) miss this. Strengthen to `toBe(90)`.
- `<` → `<=` in `amount < 0`: pass `0` and assert it does *not* throw.
- `<` → `<=` in `percent > 100`: pass `100` and assert no throw; pass `101` and assert throw.

## Notes on Vadim's global rules

- ESM-only, named exports, no barrels — applies here.
- `npx tsc --noEmit && npm run build` must pass before claiming complete.
- BDD test names: `'reduces 100 by 10% to 90'` not `'discount works'`.
- Tests colocated as `*.test.ts`, never under a separate `tests/` directory in TS.
