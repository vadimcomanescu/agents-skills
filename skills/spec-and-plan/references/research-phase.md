# Research Phase Guide

**Table of contents**
1. [Intent classification](#intent-classification)
2. [External research skip/run criteria](#external-research-skiprun-criteria)
3. [Depth reclassification rules](#depth-reclassification-rules)
4. [Monorepo adjacency scoping](#monorepo-adjacency-scoping)

---

## Intent classification

Classify research intent before dispatching, because the right dispatch pattern differs per type.

| Intent type | Definition | Dispatch pattern |
|---|---|---|
| **implementation-guidance** | How to build a settled approach using known tools or patterns (e.g., "how do we paginate this query with our existing ORM?") | Search local codebase first; external search only if fewer than 3 direct local examples exist |
| **landscape-discovery** | What options exist for an unsettled decision (e.g., "what rate-limiting libraries fit our constraints?") | External search to enumerate options; then loop back to evaluate shortlist against local constraints |
| **mixed** | Both: discover options, then research how to implement the chosen one | Run landscape-discovery pass first, record the selection decision, then run implementation-guidance pass on the chosen option — never interleave |

When intent is ambiguous, treat it as mixed and run sequentially.

---

## External research skip/run criteria

Run external research when **any** of these conditions is true:

| Condition | Example signal |
|---|---|
| User or upstream doc explicitly requests it | "research the best approach", "check what's current", a URL or doc link is provided |
| Topic is high-risk | Authentication, payments, data migrations, external APIs, privacy/compliance, encryption schemes — these have failure modes that local patterns may not cover |
| Fewer than 3 direct local examples | Pattern search returns 0–2 matching usages in the relevant package; conventions may not be established |
| Option set is genuinely external and unsettled | Third-party SDK selection, infrastructure provider comparison, protocol version decisions |

Skip external research when **all** of these hold:

| Condition | Example signal |
|---|---|
| Strong local patterns exist | 3+ recent, direct usages of the exact pattern in the relevant package |
| The approach is settled in the codebase | Established conventions for testing, error handling, logging, data access |
| No high-risk topic is involved | Standard CRUD, UI components, internal utilities |

Any external finding that shaped nothing in the plan is dropped — never padded into an appendix or "Additional context" section.

---

## Depth reclassification rules

Initial depth is Lightweight / Standard / Deep based on size signals (file count, cross-system span, migration risk). Reclassify upward to **Standard** when work touches any external contract surface, regardless of initial size:

| External contract surface | Why it triggers reclassification |
|---|---|
| Environment variables consumed by external systems | Changes break callers outside the repo; requires compatibility check |
| Exported public APIs or CLI flags | Downstream consumers depend on the shape; breaking changes need explicit documentation |
| CI/CD configuration files | Changes affect the build and deployment pipeline visible to the whole team |
| Shared types imported by downstream consumers | Type contract changes cascade; may require coordinated releases |
| Documentation at external URLs | Live references may be cached; must be updated before the implementation ships |

When reclassification fires: announce it explicitly ("Reclassifying to Standard — this change touches [surface]. Continuing with full template.") before proceeding to research.

Depth never reclassifies downward during planning. If work initially looked large but turns out to touch only internal code, keep the higher depth — the extra sections add minimal cost and prevent under-documented changes.

---

## Monorepo adjacency scoping

In monorepo structures, scope research to the relevant sub-package first:

1. Identify the primary sub-package the change lives in (e.g., `packages/api`, `apps/web`).
2. Search for local patterns within that sub-package before expanding to the full repo.
3. Expand to repo-wide search only when no pattern is found at the sub-package level or when the change touches a shared package.
4. Never pull patterns from an adjacent sub-package as if they apply to the current one — verify the sub-package has the same toolchain, conventions, and dependency set before treating it as precedent.
