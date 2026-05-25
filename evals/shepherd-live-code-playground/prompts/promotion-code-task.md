You are implementing promotion-code support in the Shepherd live-code playground.

Task:

- Add support for promo code `SAVE10`.
- `SAVE10` applies a 10 percent discount when subtotal is at least 100.
- `SAVE10` below 100 fails with a field-specific `promoCode` error.
- Unknown promotion codes fail with a field-specific `promoCode` error.
- Orders without a promotion code preserve existing behavior.
- Successful promoted orders include `discount` and `promoCode`.
- Pricing behavior must be testable outside request/controller validation code.

Verification:

- Run `npm test`.
- Do not add dependencies.
- Commit your changes in the scratch workspace.
