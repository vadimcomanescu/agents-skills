# Rust + cargo test + cargo-mutants — a full TDD cycle

Tooling: built-in `cargo test`, plus `cargo-mutants` for mutation testing.

```bash
cargo install cargo-mutants
```

Project layout — tests are usually colocated in a `#[cfg(test)] mod tests` block:

```
src/
  lib.rs
  discount.rs
Cargo.toml
```

## Cycle 1 — feature add (tracer bullet)

**Goal:** apply a percent discount, returning a `Result` because invalid inputs are recoverable.

### RED — `src/discount.rs`

```rust
pub fn discount(amount: f64, percent: f64) -> Result<f64, DiscountError> {
    todo!()
}

#[derive(Debug, PartialEq, thiserror::Error)]
pub enum DiscountError {
    #[error("amount must be non-negative")]
    NegativeAmount,
    #[error("percent must be 0..=100")]
    PercentOutOfRange,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reduces_100_by_10_percent_to_90() {
        assert_eq!(discount(100.0, 10.0), Ok(90.0));
    }
}
```

### Verify RED

```bash
cargo test --lib discount::tests::reduces_100_by_10_percent_to_90
# FAIL: panicked at 'not yet implemented'  ← clean RED at the assertion
```

### GREEN — minimum

```rust
pub fn discount(amount: f64, percent: f64) -> Result<f64, DiscountError> {
    Ok(amount - (amount * percent / 100.0))
}
```

```bash
cargo test
# PASS
```

### Verify GREEN

```bash
cargo fmt
cargo clippy --all-features -- -D warnings
cargo test
# All clean.
```

### Commit (behavioral)

```
Add: discount(amount, percent) reduces by percent

Tracer bullet for the discount module: 100 - 10% = 90.
```

## Cycle 2 — error path

### RED

```rust
#[test]
fn errors_when_percent_above_100() {
    assert_eq!(discount(100.0, 150.0), Err(DiscountError::PercentOutOfRange));
}
```

### Verify RED

```bash
cargo test errors_when_percent_above_100
# FAIL: assertion `left == right` failed  ← clean RED
```

### GREEN

```rust
pub fn discount(amount: f64, percent: f64) -> Result<f64, DiscountError> {
    if !(0.0..=100.0).contains(&percent) {
        return Err(DiscountError::PercentOutOfRange);
    }
    Ok(amount - (amount * percent / 100.0))
}
```

### Verify GREEN

```bash
cargo test && cargo clippy --all-features -- -D warnings
# All green.
```

### Commit (behavioral)

```
Add: discount returns PercentOutOfRange for percent outside 0..=100
```

## Cycle 3 — bug fix (Prove-It Pattern)

**Bug:** `discount(-100.0, 10.0)` returns `Ok(-90.0)`; should be `Err(NegativeAmount)`.

### RED

```rust
#[test]
fn errors_on_negative_amount() {
    assert_eq!(discount(-100.0, 10.0), Err(DiscountError::NegativeAmount));
}
```

### Verify RED

```bash
cargo test errors_on_negative_amount
# FAIL: assertion `left == right` failed: left: Ok(-90.0)  ← bug confirmed
```

### Fix

```rust
pub fn discount(amount: f64, percent: f64) -> Result<f64, DiscountError> {
    if amount < 0.0 {
        return Err(DiscountError::NegativeAmount);
    }
    if !(0.0..=100.0).contains(&percent) {
        return Err(DiscountError::PercentOutOfRange);
    }
    Ok(amount - (amount * percent / 100.0))
}
```

### Verify GREEN

```bash
cargo test && cargo clippy --all-features -- -D warnings
# Green.
```

### Commit (behavioral)

```
Fix: discount rejects negative amounts

Reproduces the bug with a test; fix adds the input guard.
```

## Refactor (Tidy First — separate commit)

Pull the validation into a constructor-style function on the input. Per Vadim's Rust rules: prefer strong types over loose primitives.

```rust
#[derive(Debug, Clone, Copy)]
pub struct DiscountInput {
    amount: f64,
    percent: f64,
}

impl DiscountInput {
    pub fn new(amount: f64, percent: f64) -> Result<Self, DiscountError> {
        if amount < 0.0 {
            return Err(DiscountError::NegativeAmount);
        }
        if !(0.0..=100.0).contains(&percent) {
            return Err(DiscountError::PercentOutOfRange);
        }
        Ok(Self { amount, percent })
    }
}

pub fn discount(amount: f64, percent: f64) -> Result<f64, DiscountError> {
    let input = DiscountInput::new(amount, percent)?;
    Ok(input.amount - (input.amount * input.percent / 100.0))
}
```

```bash
cargo test && cargo clippy --all-features -- -D warnings
# Green.
```

### Commit (structural)

```
Refactor: introduce DiscountInput value object
```

## Mutation testing

Run cargo-mutants against the changed module only:

```bash
cargo mutants --file src/discount.rs --jobs 4
```

For PR gating, scope to the diff:

```bash
cargo mutants --in-diff origin/main --jobs 4
```

Inspect surviving mutants in `mutants.out/`. Common ones to watch for:

- `*` → `+` in the formula — strengthen any assertion that only checks directionality to assert exact values.
- `<` → `<=` in `amount < 0.0` — add `discount(0.0, 10.0) == Ok(0.0)`.
- Range bounds — explicitly test `0.0`, `100.0`, `100.0001`, and `-0.0001` for percent.
- Removed `?` — if removing `?` from `DiscountInput::new(amount, percent)?` does not break a test, you have no test for the negative-amount or percent-out-of-range path.

## Property-based testing (optional)

`proptest` complements example tests for numeric code:

```rust
use proptest::prelude::*;

proptest! {
    #[test]
    fn discount_never_exceeds_amount(amount in 0.0f64..1e6, percent in 0.0f64..=100.0) {
        let result = discount(amount, percent).unwrap();
        prop_assert!(result <= amount);
    }
}
```

## Notes on Vadim's global rules

- No `unwrap`/`panic` in production code; `Result<T, E>` everywhere — applied here via `DiscountError`.
- Strong types — `DiscountInput` newtype rather than passing two `f64` everywhere.
- Prefer `crate::` over `super::` outside test modules.
- Workflow before claiming complete: `cargo fmt && cargo clippy --all-features -- -D warnings && cargo test --all-features`.
- Use `Entry` API for atomic `HashMap` operations; pre-allocate vectors with `with_capacity()` (not relevant here, but standard).
