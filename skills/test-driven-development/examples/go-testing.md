# Go + testing + gremlins — a full TDD cycle

Tooling: built-in `testing` package, `gotestsum` for ergonomic output, `gremlins` for mutation testing.

```bash
go install gotest.tools/gotestsum@latest
go install github.com/go-gremlins/gremlins/cmd/gremlins@latest
```

> **Heads-up:** `go-mutesting` is widely cited but its `golang.org/x/tools` dependency is from 2019 and crashes on Go 1.22+ toolchains. Use `gremlins` instead. (`gremlins unleash` is the modern, actively-maintained alternative.)

Project layout — Go convention, tests colocated as `*_test.go`:

```
discount/
  discount.go
  discount_test.go
go.mod
```

## Cycle 1 — feature add (tracer bullet)

**Goal:** apply a percent discount.

### RED — `discount/discount_test.go`

```go
package discount

import "testing"

func TestReduces100By10PercentTo90(t *testing.T) {
    got, err := Discount(100, 10)
    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }
    if got != 90 {
        t.Errorf("Discount(100, 10) = %v, want 90", got)
    }
}
```

### Verify RED

```bash
gotestsum -- ./discount/...
# FAIL: discount.go: undefined: Discount
```

Add a stub so the failure is at the assertion, not the import:

```go
// discount/discount.go
package discount

func Discount(amount, percent float64) (float64, error) {
    return 0, nil
}
```

```bash
gotestsum -- ./discount/...
# FAIL: Discount(100, 10) = 0, want 90  ← clean RED
```

### GREEN — minimum

```go
package discount

func Discount(amount, percent float64) (float64, error) {
    return amount - (amount * percent / 100), nil
}
```

```bash
gotestsum -- ./discount/...
# PASS
```

### Verify GREEN

```bash
go vet ./...
gotestsum -- ./...
# All green.
```

### Commit (behavioral)

```
Add: Discount(amount, percent) reduces by percent

Tracer bullet for the discount package: 100 - 10% = 90.
```

## Cycle 2 — error path

### RED

```go
import "errors"

func TestErrorsWhenPercentAbove100(t *testing.T) {
    _, err := Discount(100, 150)
    if !errors.Is(err, ErrPercentOutOfRange) {
        t.Errorf("Discount(100, 150) err = %v, want ErrPercentOutOfRange", err)
    }
}
```

### Verify RED

```bash
gotestsum -- -run TestErrorsWhenPercentAbove100 ./discount/...
# FAIL: undefined: ErrPercentOutOfRange  → after stub: err = nil, want ErrPercentOutOfRange
```

### GREEN

```go
package discount

import "errors"

var (
    ErrNegativeAmount    = errors.New("amount must be non-negative")
    ErrPercentOutOfRange = errors.New("percent must be 0..=100")
)

func Discount(amount, percent float64) (float64, error) {
    if percent < 0 || percent > 100 {
        return 0, ErrPercentOutOfRange
    }
    return amount - (amount * percent / 100), nil
}
```

### Verify GREEN

```bash
go vet ./... && gotestsum -- ./...
# All green.
```

### Commit (behavioral)

```
Add: Discount returns ErrPercentOutOfRange for percent outside 0..=100
```

## Cycle 3 — bug fix (Prove-It Pattern)

**Bug:** `Discount(-100, 10)` returns `(-90, nil)`; should return `ErrNegativeAmount`.

### RED

```go
func TestErrorsOnNegativeAmount(t *testing.T) {
    _, err := Discount(-100, 10)
    if !errors.Is(err, ErrNegativeAmount) {
        t.Errorf("Discount(-100, 10) err = %v, want ErrNegativeAmount", err)
    }
}
```

### Verify RED

```bash
gotestsum -- -run TestErrorsOnNegativeAmount ./discount/...
# FAIL: err = <nil>, want ErrNegativeAmount  ← bug confirmed
```

### Fix

```go
func Discount(amount, percent float64) (float64, error) {
    if amount < 0 {
        return 0, ErrNegativeAmount
    }
    if percent < 0 || percent > 100 {
        return 0, ErrPercentOutOfRange
    }
    return amount - (amount * percent / 100), nil
}
```

### Verify GREEN

```bash
go vet ./... && gotestsum -- ./...
# All green.
```

### Commit (behavioral)

```
Fix: Discount rejects negative amounts

Reproduces the bug with a test; fix adds the input guard.
```

## Refactor (Tidy First — separate commit)

Extract validation into a helper.

```go
func validate(amount, percent float64) error {
    switch {
    case amount < 0:
        return ErrNegativeAmount
    case percent < 0 || percent > 100:
        return ErrPercentOutOfRange
    default:
        return nil
    }
}

func Discount(amount, percent float64) (float64, error) {
    if err := validate(amount, percent); err != nil {
        return 0, err
    }
    return amount - (amount * percent / 100), nil
}
```

```bash
go vet ./... && gotestsum -- ./...
# Green.
```

### Commit (structural)

```
Refactor: extract validate() helper in discount package
```

## Mutation testing

```bash
gremlins unleash ./discount
```

(Pass a single package path. `./discount/...` doesn't currently match through gremlins' coverage step.)

Output looks like:

```
KILLED CONDITIONALS_BOUNDARY at discount.go:14:13
KILLED ARITHMETIC_BASE at discount.go:17:36
LIVED  CONDITIONALS_BOUNDARY at discount.go:11:12
...
Killed: 9, Lived: 1, Test efficacy: 90.00%
```

For each `LIVED` mutant:

1. Identify which test would have caught it.
2. Add or strengthen an assertion.
3. Re-run.

Common survivors gremlins flags:

- **`ARITHMETIC_BASE`** — `+` ↔ `-`, `*` ↔ `/` in the formula. Caught by exact-value asserts (`got != 90`); weak asserts (`got > 0`) miss it.
- **`CONDITIONALS_BOUNDARY`** — `<` ↔ `<=`, `>` ↔ `>=`. Caught by tests at the exact boundary (`Discount(0, 10)`, `Discount(100, 100)`, `Discount(100, 101)`).
- **`CONDITIONALS_NEGATION`** — `<` ↔ `>=`, `==` ↔ `!=`. Caught by having tests on both sides of the condition.
- **`INVERT_NEGATIVES`** — `-x` ↔ `x`. Caught by asserting on the actual numeric output.

## Table-driven tests (Go idiom)

Once you have multiple cases, the Go convention is table-driven tests. Apply this in REFACTOR, not during early cycles — collapsing tests prematurely hides the per-cycle thinking.

```go
func TestDiscount(t *testing.T) {
    cases := []struct {
        name        string
        amount      float64
        percent     float64
        wantResult  float64
        wantErr     error
    }{
        {"100 minus 10%", 100, 10, 90, nil},
        {"percent over 100", 100, 150, 0, ErrPercentOutOfRange},
        {"negative amount", -100, 10, 0, ErrNegativeAmount},
        {"percent boundary 100", 100, 100, 0, nil},
        {"percent boundary 0", 100, 0, 100, nil},
    }
    for _, tc := range cases {
        t.Run(tc.name, func(t *testing.T) {
            got, err := Discount(tc.amount, tc.percent)
            if !errors.Is(err, tc.wantErr) {
                t.Errorf("err = %v, want %v", err, tc.wantErr)
            }
            if got != tc.wantResult {
                t.Errorf("got %v, want %v", got, tc.wantResult)
            }
        })
    }
}
```

When you collapse to a table, each case still reads as a self-contained behavior — DAMP applies (see `references/test-design.md`).

## Notes on Go conventions

- Test name `TestXxx` only — required by the `testing` package.
- Subtests via `t.Run(name, ...)` — names should still read as sentences.
- `errors.Is` for sentinel errors; `errors.As` for typed errors.
- `go vet ./...` before claiming complete.
- Race detector (`go test -race ./...`) for any code with goroutines.
