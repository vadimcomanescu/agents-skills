# Confidence Rubric

Applied by the plan editor during up-the-hill review to determine whether a deepening pass is warranted. A plan that looks complete can still rest on unverified assumptions — this rubric surfaces those before the plan ships as READY.

**Table of contents**
1. [Mandatory scoring overrides](#mandatory-scoring-overrides)
2. [High-risk domain list](#high-risk-domain-list)
3. [Deepening rubric by depth](#deepening-rubric-by-depth)
4. [Passed report form](#passed-report-form)
5. [What strengthening means per section type](#what-strengthening-means-per-section-type)

---

## Mandatory scoring overrides

Run the confidence check regardless of how grounded the plan appears when either override fires:

**Override A — thin local patterns:** The plan was built when the codebase had fewer than 3 direct examples of the needed pattern. Thin local patterns mean the plan's approach decisions were not anchored in established conventions; the approach section and KTDs need explicit justification rather than pattern-reference shorthand.

**Override B — load-bearing external research:** External research materially shaped at least one of: a Key Technical Decision, an Alternative considered, a Scope Boundary, or a Risk entry. When external sources drove the plan, confirm that the reasoning still holds and is not just a verbatim paraphrase of the source.

When neither override fires and the domain is not high-risk, the confidence check passes without deepening.

---

## High-risk domain list

The following domains force the scoring pass regardless of apparent grounding. A plan touching any of these is treated as potentially under-specified until reviewed:

- **Authentication and authorization** — session handling, token lifecycle, permission checks, OAuth flows
- **Payments and financial transactions** — charge creation, refund handling, webhook verification, idempotency
- **Data migrations** — schema changes, FK constraints, rollback procedures, data backfill order
- **External APIs and webhooks** — rate limits, error contracts, retry behavior, payload validation
- **Privacy and compliance** — PII handling, data retention, consent flows, audit logging
- **Encryption and key management** — key rotation, storage of secrets, algorithm selection

---

## Deepening rubric by depth

| Plan depth | Default | When to deepen |
|---|---|---|
| **Lightweight** | Skip confidence check | When a high-risk domain is involved (override fires) or either mandatory override fires |
| **Standard** | Run a targeted check | When important sections look thin — missing risk entries, vague approach prose, under-specified test scenarios |
| **Deep** | Run a full check | Always; the scope justifies a second pass; focus on the most consequential units first |
| **High-risk (any depth)** | Run a full check | Always; domain override fires unconditionally |

A targeted check means reviewing only the sections most likely to be under-specified for the domain; a full check means reading every unit's Approach, Test scenarios, and Verification fields.

---

## Passed report form

When neither mandatory override fires and the domain is not high-risk, emit exactly:

```
Confidence check passed — no sections need strengthening.
```

Do not add a rationale paragraph. The absence of a deepening note is the signal.

---

## What strengthening means per section type

| Section type | What thin looks like | What strengthening adds |
|---|---|---|
| **Key Technical Decisions (KTDs) / Approach** | "Use the standard pattern" with no justification; no alternatives mentioned | Name the alternatives considered; state the specific reason this approach was chosen over them; identify what would invalidate the choice |
| **Risks** | No risk entries, or "might be slow" with no mitigation | Name the specific failure mode; state probability and impact; give a concrete mitigation or a deferred spike |
| **Test scenarios** | "Ensure it works" or category absent; no error paths | Add scenario with named input, action, expected outcome; cover the failure path most likely to occur in production |
| **Scope Boundaries** | Missing; or only "in scope / out of scope" with no explicit deferred list | Name each tangential item that surfaced during research; state why it is deferred; link to U-ID or plan section where it was mentioned |
| **Verification** | "Run tests" with no command; placeholder paths | Replace with an executable command in the actual workspace; name the test file or assertion that proves the unit is done |
