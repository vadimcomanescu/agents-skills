# Plan Sections Reference

**Table of contents**
1. [Per-unit field list](#per-unit-field-list)
2. [U-ID stability rule](#u-id-stability-rule)
3. [Test scenario category catalog](#test-scenario-category-catalog)
4. [Specificity bar](#specificity-bar)
5. [AE-link convention](#ae-link-convention)
6. [No-test form](#no-test-form)
7. [Section depth table](#section-depth-table)

---

## Per-unit field list

Each implementation unit is a level-3 heading: `### U<N>. <Short descriptive title>`

Fields in this order, all flush-left (not indented under a list item):

**Goal:** One sentence — what this unit delivers to the user or system.

**Requirements:** Stable R-IDs from the spec this unit advances (e.g., `R1, R3`). When the plan originates from an upstream requirements document, include origin A/F/AE IDs here too.

**Dependencies:** U-IDs this unit depends on (e.g., `U1, U2`), or `None`.

**Files:** Repo-relative paths only (e.g., `src/auth/session.ts`, `tests/auth/session.test.ts`). Never absolute paths. List every file the unit creates or modifies.

**Approach:** Decisions and direction in plain prose. What pattern to use, what the key tradeoffs are, what to avoid. No pre-written implementation code, no exact method signatures, no shell-command choreography. Pseudo-code is acceptable only when framed explicitly as directional guidance — label it `[directional only]`.

**Test scenarios:** Enumerated scenarios (see catalog below).

**Verification:** Concrete commands or checks the implementer runs to confirm the unit is done. Commands must be executable in the actual workspace — no placeholder paths or hypothetical CLI flags.

---

## U-ID stability rule

U-IDs are assigned sequentially starting at `U1`. Once assigned:

- A U-ID is **never renumbered**. Reordering, splitting, or deleting a unit leaves a gap (e.g., U1, U3, U5 is correct after deleting U2 and U4).
- New units always take the **next unused integer** regardless of insertion position.
- Stable IDs let downstream tools, PRs, and implementers reference units across plan edits without ambiguity.

Units must be `###` headings, not bulleted or checkbox items. Per-unit fields are multi-block flush-left content (paragraphs, lists, code fences) that terminates CommonMark list continuation — a list item parent would detach them from the unit.

---

## Test scenario category catalog

For each feature-bearing unit, cover every applicable category. Skip categories with no relevant scenarios — do not pad.

### Happy-path

The primary success case. For each scenario: name the input, describe the action, state the expected outcome.

Format: `[input description] → [action] → [expected outcome]`

Example: `Valid credentials, active account → POST /auth/login → 200 OK with session cookie set`

### Edge cases

Boundary values, empty or null states, concurrent or race conditions. Each scenario names input + action + expected outcome.

Sub-rules:
- Boundary values: test at the limit and one step past it (not just a representative middle value)
- Empty/null: cover missing required fields, empty collections, null foreign keys
- Concurrent access: cover simultaneous writes to the same resource when the unit touches shared mutable state

### Error and failure paths

Invalid input, downstream service failures, timeouts, permission denials, missing resources. Each scenario names input + action + expected outcome.

Sub-rules:
- Invalid input: cover type mismatches, out-of-range values, malformed payloads
- Downstream failures: cover the unit's behavior when a dependency returns an error or is unavailable
- Timeouts: cover long-running operations that exceed the expected window
- Permission denials: cover requests from callers who lack the required role or scope

### Integration scenarios

Multi-layer interactions that unit tests with mocks alone cannot prove. Name the layers involved and the expected outcome.

Sub-rules:
- At least one integration scenario is required whenever the unit spans two or more system layers (e.g., API endpoint + database, UI component + API client + server)
- State persistence must be an integration scenario (not a mocked assertion)
- External-contract scenarios (webhook delivery, third-party API call) are integration scenarios

---

## Specificity bar

Every scenario must be specific enough that an implementer does not need to invent coverage. Reject vague forms:

| Too vague | Specific |
|---|---|
| "ensure login works" | `Valid user, correct password → POST /auth/login → session cookie set, redirect to /dashboard` |
| "handle errors" | `Missing email field → POST /auth/login → 400 Bad Request with field error message` |
| "test edge cases" | `5 failed attempts in 15 min from same IP → POST /auth/login → 429 Too Many Requests` |

If you cannot write the input and expected outcome, the requirement is not clear enough to plan — surface it as a call-out before proceeding.

---

## AE-link convention

When a scenario directly enforces a named Acceptance Example from an upstream requirements document, prefix it with `Covers AE<N>.`:

```
Covers AE3. User with 5 failed attempts in 15 min → POST /auth/login → 429 response
```

Use this prefix sparingly — most test scenarios are finer-grained than AEs and do not need the tag. Forcing an AE tag onto every scenario adds noise without adding traceability value.

---

## No-test form

For units with no behavioral change (pure config, scaffolding, file moves, dependency pinning, styling), use:

```
**Test scenarios:** Test expectation: none -- [reason]
```

Do not leave the field blank. A blank field is ambiguous — it could mean the scenarios were forgotten. The explicit form proves intent.

---

## Section depth table

Which sections are required at every depth vs. included only when they add material value:

| Section | Lightweight | Standard | Deep |
|---|---|---|---|
| Goal | Required | Required | Required |
| Requirements (R-IDs) | Required | Required | Required |
| Dependencies (U-IDs) | Required | Required | Required |
| Files | Required | Required | Required |
| Approach | Required | Required | Required |
| Test scenarios | Required | Required | Required |
| Verification | Required | Required | Required |
| High-Level Technical Design | Omit unless shape doesn't carry in prose | Include when multi-component | Required when architecture is non-obvious |
| Risks (per-unit inline) | Omit | Include when a unit carries an identified blocker | Required |
| Deferred to Follow-Up Work (plan-level) | Include when tangential items surfaced | Include | Include |
