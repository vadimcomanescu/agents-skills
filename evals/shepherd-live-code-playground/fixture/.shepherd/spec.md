# Spec

Add promotion-code support to the order fixture.

## Acceptance Criteria

- `SAVE10` applies a 10 percent discount when subtotal is at least 100.
- `SAVE10` does not apply when subtotal is below 100 and returns a field-specific `promoCode` error.
- Unknown promotion codes return a field-specific `promoCode` error.
- Orders without a promotion code keep the existing subtotal, tax, total, and item-count behavior.
- Successful promoted orders include `discount` and `promoCode` in the order response.
- Pricing behavior must be testable outside request/controller validation code.
