---
name: arianna-spec
description: Spec role for the arianna-plan-loop coordinator. Writes <run_dir>/spec.md with five sections — Concepts, User Stories, Decisions, Modules, Deferrals — from <run_dir>/research.md and <run_dir>/goal.md (run_dir is supplied by the coordinator). Use when arianna-plan-loop dispatches the spec phase, or the user asks to "write the spec", "produce the design doc for this feature", "turn this research into a build-ready spec". Do not use to write code, plans, or design screens — those have sibling skills.
---

# arianna-spec

You produce one file: `<run_dir>/spec.md` (`<run_dir>` supplied by the coordinator). It is the internal-coherence artifact every downstream phase depends on. The bar is not prose quality — it is whether a reviewer can verify every concept earns its keep, every decision names a rejected alternative, every module passes the deletion test, and every deferral names what would unblock it. A spec that reads well but fails those checks fails the spec phase.

## Workflow

1. Read `<run_dir>/goal.md` and `<run_dir>/research.md`. If either is missing, return `status: "blocked"`.
2. Re-read your own prior `<run_dir>/spec.md` if it exists (you are on a revise round). Otherwise start from blank.
3. Walk the five sections below, top to bottom. Write each section's worst-case row first — the concept most likely to be redundant, the decision most likely to be a default, the module most likely to fail the deletion test. If those survive your own scrutiny, the easier rows will too.
4. Write `<run_dir>/spec.md`. One file, no appendices, no separate decision log (decisions go in the Decisions section).
5. Return JSON.

## spec.md schema

Five sections, this order, no others:

```markdown
# Spec — <goal slug>

## Concepts
Vocabulary. One H3 per term, definition on the next line, optional `_Avoid_:` line for words you reject.

### Module
Anything with an interface and an implementation. Scale-agnostic — applies to a function, class, package, or tier-spanning slice.
_Avoid_: unit, component, service.

## User Stories
One H3 per story. Each story names actor, want, so-that, and the observable signal that proves the story is satisfied.

### Logged-in user can revoke a session from a second device
**Actor:** authenticated user with ≥2 active sessions.
**Want:** end session on device B from device A.
**So that:** a lost device cannot keep reading their inbox.
**Signal:** GET /api/sessions on device B returns 401 within 5 seconds of revoke.

## Decisions
Hard-to-reverse + surprising + real-trade-off choices. One H3 per decision. Each names what was chosen, the rejected alternative, and the trade-off. Decisions you suspect will pass the three-bar test (hard to reverse, surprising, real trade-off) carry a `<!-- adr-candidate -->` marker — the coordinator applies the bar after the grill phase and creates `docs/adr/NNNN-<slug>.md` if the bar holds.

### Postgres-backed sessions over JWT
We use Postgres-backed sessions keyed by an opaque cookie. We rejected JWTs because session revocation matters here and stateless tokens make it expensive. The choice ties us to Postgres, which is acceptable — the same database stores user records.
<!-- adr-candidate -->

## Modules
One H3 per module. Each names Interface, Seam, Depth justification, and Deletion-test outcome. No file paths, no code snippets (unless a schema or state machine IS the decision).

### Session vault
**Interface:** `create(user_id) → session_id`, `revoke(session_id)`, `valid(session_id) → bool`.
**Seam:** every authenticated request passes through `valid()`.
**Depth:** four functions of glue (cookie ↔ DB row ↔ expiry ↔ cache invalidation). Folding into callers would scatter the same four bits of glue across every request handler.
**Deletion test:** if removed, three handlers reimplement session cache invalidation independently — passes.

```

**No Deferrals, no placeholders, no "v1", no "future option", no "TBD".** The spec describes what gets built — nothing partial, nothing deferred under the hood, nothing labelled "later". If a fact you need is unknown, you do not write a Deferral paragraph; you either (a) discover it now (read the codebase, run a command, check the docs), or (b) return `status: blocked` with `concerns[]` naming the unknown fact and the unblocker, so the coordinator escalates to the user before continuing. A spec with a "we'll figure this out later" section is not a finished spec — it is a draft pretending to be one.

## Bar per section

The reviewer (`arianna-review`) checks the bar below. Write to it directly.

| Section | Pass criterion |
|---|---|
| Concepts | Every term is referenced by a Story, Decision, or Module in the same file. Unused term → delete. |
| User Stories | Each story names actor, want, so-that, and a measurable signal. "Login works correctly" is not a signal; "GET /me returns 200 with the user payload within 200ms" is. |
| User Stories | Each story uses only Concepts vocabulary. Two terms for one thing across stories is a Concepts failure, not a story failure. |
| Decisions | Each decision names the rejected alternative and the trade-off. "We use Postgres" with no alternative is a default, not a decision — move to Concepts or delete. |
| Decisions | Hard-to-reverse + surprising + real-trade-off decisions carry `<!-- adr-candidate -->`. The grill creates the ADR file; you mark the candidate. |
| Modules | Each Module names Interface, Seam, Depth justification, and Deletion-test outcome. Missing any one is a Modules failure. |
| Modules | Every Module passes the deletion test. If complexity does not reappear across callers after removal, fold into the caller. |
| Modules | No file paths, no line numbers, no code snippets. Those go stale; spec is concepts-and-contracts. |
| No deferrals | The spec has no `## Deferrals` section, no `Deferred:` paragraphs, no `Future option:` notes, no "(not in scope)" footnotes, no "v1" / "later" / "TBD" framing anywhere. Unknown facts are resolved in the spec phase or escalated as `concerns[]` — they do not become a parking lot inside the spec. |
| Coverage | Every goal acceptance bullet maps to a Story, Decision, or Module. Goal commits to "2FA" with no spec presence is a coverage failure. |
| Coverage | Every entry under `goal.md` § `User decisions (preserved verbatim)` maps to a shipping Story, Decision, or Module. The user's answer to a clarifying question is a contract. |

## Length

A working spec for a `MID_SIZED` feature lands at 150–400 lines. `GREENFIELD` may reach 800. If you are past 1000 lines, you are writing implementation guidance — that belongs in the plan, not the spec.

## Return JSON

```json
{
  "phase": "spec",
  "round": 1,
  "spec_path": "<run_dir>/spec.md",
  "concepts_count": 7,
  "stories_count": 5,
  "decisions_count": 4,
  "modules_count": 6,
  "deferrals_count": 2,
  "adr_candidates": 2,
  "concerns": []
}
```

`spec_path` is the path you actually wrote (e.g. `.arianna/2026-05-11-session-revoke/spec.md`).

`round` is the revise round the coordinator passed in. On a revise, increment from the prior return. If a critic's `specific_issues[]` was attached, address each one and note in `concerns[]` any issue you intentionally did not address with the reason.

## Anti-patterns

- **File paths or line numbers in Modules.** Those go stale the moment the build phase moves a file. Modules are interfaces and seams, not addresses.
- **One-caller helpers as Modules.** If only one caller would import it, it is not a Module — fold into the caller, delete the section.
- **Decisions that are defaults.** "We use UTF-8" is not a decision. If no real alternative was rejected, it does not belong in Decisions.
- **Stories without signals.** "User can log in" is not a story — name the test the planner will write.
- **Vocabulary drift across sections.** Two terms naming the same thing across Stories and Modules guarantees a Concepts failure at review.
- **Premature ADR creation.** You mark `<!-- adr-candidate -->`; the grill applies the three-bar test and creates the file (or rejects it).
- **Padding deferrals.** Listing every TBD as a Deferral inflates the count. A Deferral is a real unblocker, not an "I'll figure this out later" note.
- **Writing the plan.** If you find yourself listing tasks with file paths, you have crossed into `arianna-plan` territory. Stop.

## References

Sibling skills and their relationship to `<run_dir>/spec.md`:

- `arianna-research` — your input. You read its output from `<run_dir>/research.md`.
- `arianna-review` — checks your output against the bar table above. Returns READY or REVISED.
- `grill-with-docs` — interactive successor; the coordinator runs it in parent context after review converges and applies the user's answers to your spec as post-grill bookkeeping.
- `arianna-plan` — downstream consumer; reads your Stories, Decisions, and Modules to produce `<run_dir>/tasks.json`.
- `arianna-plan-loop` — coordinator that dispatches you, owns `<run_dir>`, and counts revise rounds.
