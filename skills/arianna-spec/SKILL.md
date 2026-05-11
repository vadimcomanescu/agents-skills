---
name: arianna-spec
description: Spec writer for Phase 2 of the arianna-magic pipeline. Use when arianna-magic dispatches Phase 2 (Spec), or the user asks to "write a spec", "draft requirements", "synthesize what we know", "produce spec.md". Uses Pocock vocab (Module, Interface, Seam, Depth, Adapter, Context, Deletion-test), writes spec.md as decisions-as-paragraphs. Do not use for interactive requirement elicitation — that is arianna-grill.
---

# arianna-spec

## Operating idea

**Synthesize what you already know — do not interview the user.** Phase 0 (`arianna-research`) and Phase 1 (`goal.md`) already collected the inputs. Your job is to fold `.agent/research.md`, `.agent/goal.md`, the codebase, and any pre-existing `CONTEXT.md` / `docs/adr/` into a single coherent `.agent/spec.md`. The interview happens later, in `arianna-grill`, after the auto-critic loop has surfaced what synthesis alone cannot.

> Pocock, `to-prd`: "Do NOT interview the user — just synthesize what you already know."

You write principle-first, in Pocock's vocabulary. Every load-bearing rule leads with a one-sentence bold statement, then a gloss, then a falsifiable test. Every term you introduce has a one-line definition paired with an `_Avoid_:` line naming what NOT to use for the same concept.

**Falsifiable test.** If your draft asks the user a question, you are doing `arianna-grill`'s job. Stop, remove the question, decide one way or the other, and mark the loser as deferred if it might come back.

_Avoid_: "elicit", "interview", "discovery questions". Say _synthesize_.

### Why synthesis-first

The pipeline already paid for one research pass and one goal-confirmation pass. A spec writer that opens with "let me ask you a few things" wastes that work and re-runs Phase 1. The auto-critic loop (`arianna-critique`, up to 3 rounds) will catch contradictions and missing decisions you could not resolve from the inputs. After the critic taps out, `arianna-grill` runs an interactive session that updates `spec.md` and lays down `CONTEXT.md` / `docs/adr/` lazily. Your job stops at the last decision the inputs actually support.

## When to use

Trigger phrases live in the description. The non-trigger to keep in mind: this is not the interactive spec writer. If the user is currently in chat asking exploratory questions, the right skill is `arianna-grill`. If `.agent/research.md` and `.agent/goal.md` do not exist, the pipeline has not reached Phase 2 yet — stop and return that as the structured-JSON failure, do not invent inputs.

## Pocock vocabulary

Use these terms exactly. Consistent language is the whole point — drift into "component", "service", "API", or "boundary" and the resulting spec stops being useful to the planner and the reviewer. Definitions are paraphrased faithfully from Pocock's `LANGUAGE.md`; rejected framings come from the same source.

### Terms

**Module**
Anything with an interface and an implementation. Deliberately scale-agnostic — applies equally to a function, class, package, or tier-spanning slice.
_Avoid_: unit, component, service.

**Interface**
Everything a caller must know to use the module correctly. Includes the type signature, but also invariants, ordering constraints, error modes, required configuration, and performance characteristics.
_Avoid_: API, signature (too narrow — those refer only to the type-level surface).

**Seam**
A place where you can alter behaviour without editing in that place. The *location* at which a module's interface lives. Choosing where to put the seam is its own design decision, distinct from what goes behind it.
_Avoid_: boundary (overloaded with DDD's bounded context).

**Depth**
Leverage at the interface — the amount of behaviour a caller (or test) can exercise per unit of interface they have to learn. A module is **deep** when a large amount of behaviour sits behind a small interface. A module is **shallow** when the interface is nearly as complex as the implementation.
_Avoid_: depth-as-ratio-of-implementation-lines-to-interface-lines (rewards padding the implementation).

**Adapter**
A concrete thing that satisfies an interface at a seam. Describes *role* (what slot it fills), not substance (what's inside).
_Avoid_: "wrapper", "impl class" — those say nothing about the seam.

**Context**
The named scope inside which terms in `CONTEXT.md` mean what `CONTEXT.md` says they mean. A repo may carry one context or several; multi-context repos resolve names through `CONTEXT-MAP.md`.
_Avoid_: "bounded context", "subdomain", "aggregate root" (DDD ceremony Pocock retired).

**Deletion-test**
The test for whether a module is deep enough to deserve its interface: imagine deleting the module. If complexity vanishes, the module wasn't hiding anything. If complexity reappears across N callers, the module was earning its keep.
_Avoid_: "responsibility check", "SRP audit" — those reward narrative, not consolidation.

### Principles

- **The interface is the test surface.** Callers and tests cross the same seam. If you want to test *past* the interface, the module is probably the wrong shape.
- **Depth is a property of the interface, not the implementation.** A deep module can be internally composed of small parts — they just are not part of the interface.
- **One adapter means a hypothetical seam. Two adapters means a real one.** Do not introduce a seam unless something actually varies across it.

### Rejected framings

- **Ubiquitous language, aggregate, bounded context.** Pocock retired these. Say _shared language_, _module_, _context_.
- **"Interface" as the TypeScript `interface` keyword or a class's public methods.** Too narrow. The interface here is every fact a caller must know.
- **"Boundary"** as a synonym for seam. Boundary is overloaded with DDD. Say _seam_.
- **Service / Repository / Factory as load-bearing nouns.** They describe role at a single tier and obscure depth. Name the module after the behaviour it consolidates.

## `spec.md` output structure

**`spec.md` has four sections in this order: Concepts, User Stories, Decisions, Modules.** Anything outside these four sections is overspecification — it belongs in the plan, in the design, or nowhere.

```
.agent/spec.md
├── Concepts        — the project's shared language for this build
├── User Stories    — what callers (users, agents, other systems) get
├── Decisions       — paragraphs that record what was chosen and why
└── Modules         — the deep modules the build will land on
```

_Avoid_: "Functional Requirements", "Non-Functional Requirements", "System Architecture Diagram", "Glossary Appendix". Pocock's four-section spec carries the same load with less ceremony.

### Concepts

The terms specific to *this* build, defined in Pocock style: one-line definition plus `_Avoid_:` line. If `CONTEXT.md` exists at the repo root, copy the relevant terms verbatim and add only what is missing for this build; do not re-litigate established names. If `CONTEXT.md` does not exist, `arianna-grill` may create it later — your job is to seed the candidate terms in `spec.md` Concepts, not to write `CONTEXT.md` yourself.

Use the project's domain words, not generic architecture words. "Order intake module" beats "FooBarHandler"; "scheduling window" beats "TimeRangeService".

**Falsifiable test.** If a term you introduce in Concepts is not referenced by a User Story, a Decision, or a Module in the same `spec.md`, it does not belong in Concepts — delete it.

### User Stories

One paragraph per story. Each story names the caller, the outcome, and the observable signal that the outcome happened. No `As a / I want / So that` template — write prose.

Stories cite Concepts by name. A story that cannot be told in the Concepts vocabulary is the signal that a concept is missing — go back to Concepts and add it.

**Falsifiable test.** If a planner reading a story cannot tell what would need to be true after the story ships, the story is not testable — rewrite it until the observable signal is named.

### Decisions

Decisions are paragraphs. See the next section.

### Modules

The deep modules this build will land on. One sub-section per module, in this shape:

- **Name** (a Concept).
- **Interface.** Every fact a caller must know: signature, invariants, error modes, ordering, required configuration, performance characteristics. Not just the types.
- **Seam.** Where the interface lives (tier, layer, process boundary).
- **Depth justification.** What behaviour sits behind the interface, and what shallow alternative was rejected.
- **Deletion test.** What complexity reappears across callers if this module is deleted.

No file paths. No code snippets. Pocock's bar: "they may end up being outdated very quickly". Schemas or state machines that ARE the decision (a wire protocol, a finite state machine) MAY appear inline — they are the spec, not an illustration of it.

**Falsifiable test.** If a Module sub-section does not pass the deletion test (complexity does not concentrate when you imagine deleting it), the module is shallow — fold it into a deeper neighbour or delete it from the spec.

## Decisions are paragraphs, not formal ADRs

**By default, every decision in `spec.md` is a paragraph in the Decisions section — three to six sentences saying what was chosen, what was rejected, and why.** No `Status:`, no `Considered Options:`, no `Consequences:`, no separate file. The spec is the record of the decision.

> Pocock, `ADR-FORMAT.md`: "An ADR can be a single paragraph. The value is in recording *that* a decision was made and *why* — not in filling out sections."

A formal ADR file at `docs/adr/NNNN-<slug>.md` is reserved for decisions that meet all three of these bars:

1. **Hard to reverse** — the cost of changing your mind later is meaningful.
2. **Surprising without context** — a future reader will look at the code and wonder "why on earth did they do it this way?".
3. **The result of a real trade-off** — there were genuine alternatives and you picked one for specific reasons.

If a decision is easy to reverse, skip the ADR — you will just reverse it. If it is not surprising, no one will wonder why. If there was no real alternative, there is nothing to record beyond "we did the obvious thing".

**`arianna-spec` does not create ADRs.** That is `arianna-grill`'s job, and it happens later, lazily, when a decision crystallises during the interactive session and meets all three bars. Your job is to write the decision as a paragraph in `spec.md`. If the paragraph clearly meets the three-bar test, you MAY end it with a marker comment like `<!-- adr-candidate -->` so `arianna-grill` can pick it up; do not pre-create the ADR file.

_Avoid_: "ADR-0007 (Proposed)", "Decision Record Template", "Architectural Decision Log". Say _decision paragraph_, and let the grill skill promote it if it earns the promotion.

### Decision paragraph shape

A good decision paragraph names the decision, the rejected alternative(s), and the reason. Example shape (not a template — write prose):

> Authentication uses Postgres-backed sessions stored server-side, keyed by an opaque cookie. We rejected JWTs because the session-revocation path matters for this product and stateless tokens make revocation expensive. The choice ties us to Postgres, which is acceptable given the same database already stores the user records.

Three sentences. What, what-not, why. No headings.

**Falsifiable test.** If the paragraph does not name the rejected alternative, it is recording a default, not a decision — either delete it (defaults belong in code, not in spec) or surface the rejected alternative.

## The deep-module deletion test

**Every Module you propose must pass the deletion test before it earns a sub-section in `spec.md`.** Imagine deleting the module. If complexity vanishes, the module was a pass-through and the spec is overstating it. If complexity reappears across N callers, the module is earning its keep and deserves the interface.

> Pocock, `LANGUAGE.md`: "Imagine deleting the module. If complexity vanishes, the module wasn't hiding anything. If complexity reappears across N callers, the module was earning its keep."

The deletion test is the bar, not a hint. A module that fails it is shallow by construction. Three common shapes that fail:

- **Pass-through wrapper.** Module forwards every call to a single dependency with no added invariant. Delete it — callers can talk to the dependency directly.
- **Type-only wrapper.** Module exists to give a type a name. Delete it and inline the type.
- **One-caller helper.** Module is called from exactly one place. Delete it and inline the body.

A module that fails the deletion test today MAY still appear in `spec.md` — but only if a User Story names a future caller that creates the second use. Speculation about "we might want to swap this out" is not enough: "one adapter means a hypothetical seam, two adapters means a real one".

**Falsifiable test.** Strike the Module's Interface sub-section. Re-read the User Stories. If the stories still read coherently, the module was not load-bearing — drop it.

## Deferred vs now

**Decide everything the inputs support; mark everything else `Deferred:` with the question that would unblock it.** A decision deferred without a named unblocker is hand-waving. A decision deferred with a named unblocker is a contract with the user about what the next pass needs to surface.

Decide now when:

- `.agent/research.md` cites a load-bearing source for the choice.
- `.agent/goal.md` names a constraint that forces one option.
- The codebase or `CONTEXT.md` already commits to one option and the spec extends it.
- Two options exist and only one fits the User Stories on the page.

Defer when:

- The two options have meaningfully different cost or risk AND the inputs do not resolve which matters more — the user picks this in `arianna-grill`.
- A dependency choice (database, runtime, vendor) was scoped out of Phase 0 research.
- A reversal cost is unknown because the integration target is not yet probed.

Mark deferrals inline in the Decisions section like this:

> **Deferred:** Whether the worker model rotation includes Codex when both CLIs are installed. Unblocker: confirm whether Codex CLI is available in the user's environment.

One paragraph per deferral. Each carries a named unblocker. No `Deferred (TBD)` without a question — that is the anti-pattern.

**Falsifiable test.** Every deferral paragraph names a single fact whose value would flip the decision. If you cannot name the fact, the deferral is hand-waving — either decide it or escalate to `arianna-grill`.

## Workflow

For every Phase 2 dispatch:

1. **Read inputs.** Load `.agent/research.md`, `.agent/goal.md`, and any pre-existing `CONTEXT.md` and `docs/adr/*.md`. If any are missing, return the structured-JSON failure noting which.
2. **Extract candidate concepts.** Pull every domain term that appears in goal or research more than once or that anchors a User Story. Define each in Pocock style: one-line definition plus `_Avoid_:`.
3. **Draft User Stories.** One paragraph per story. Each names caller, outcome, observable signal. Stories cite concepts by name only — if a story needs a new word, add it to Concepts.
4. **Inventory candidate modules.** From the stories, list the named behaviours that consolidate work for multiple callers. Apply the deletion test to each candidate. Discard the ones that fail.
5. **For each surviving module, write the Module sub-section.** Interface (every caller-fact), Seam, depth justification, deletion-test outcome.
6. **Write decisions as paragraphs.** One paragraph per decision: what, what-not, why. Mark the `<!-- adr-candidate -->` only when all three ADR bars are obviously met.
7. **Defer with named unblockers.** Anything the inputs cannot resolve becomes a deferral paragraph naming the question that would unblock it.
8. **Self-check.** Run the falsifiable tests inline: every Concept is referenced; every Story is testable; every Module passes the deletion test; every Decision names the rejected alternative; every Deferral names its unblocker.
9. **Write `.agent/spec.md`.** Four sections, in the canonical order. No file paths. No code snippets (except schemas or state machines that ARE the decision).
10. **Return structured JSON.** Path to `spec.md`, count of concepts, stories, modules, decisions, deferrals, and ADR candidates. The orchestrator records this and runs `arianna-critique`.

### What you do not do

- You do not ask the user questions. The synthesis is the whole job; `arianna-grill` runs the interactive pass.
- You do not write `CONTEXT.md` or `docs/adr/`. Those are repo-root artifacts, owned by `arianna-grill`, created lazily.
- You do not write `tasks.json`, the design, or the implementation. Those are later phases.
- You do not paraphrase Pocock's vocabulary. Use the terms exactly. Drift breaks the planner's and reviewer's vocabulary downstream.

## Anti-patterns

- **Interview prose in `spec.md`.** "Should we use Postgres or Mongo?" belongs in `arianna-grill`. Decide one way or mark deferred with an unblocker — never leave a question floating.
- **DDD ceremony.** "Bounded contexts", "aggregate roots", "ubiquitous language" — Pocock dropped these. Say "context", "module", "shared language".
- **File paths and code snippets.** They go stale immediately. Exception: schemas or state machines that ARE the decision.
- **Bulk test plans.** "We will write tests for X, Y, Z" tests imagined behaviour. The spec names the observable signal per User Story; the worker writes the test against the actual seam in Phase 5.
- **`Status: Proposed` headings on every decision.** Decisions are paragraphs. The status field is for the rare formal ADR, not the default decision form.
- **Module sub-section for a pass-through.** If the deletion test does not concentrate complexity, the module is shallow — fold or drop it.
- **Deferring without an unblocker.** "Deferred (TBD)" is the anti-pattern. Every deferral names the question that would unblock it.
- **Refactoring `CONTEXT.md` from this skill.** `CONTEXT.md` is `arianna-grill`'s artifact. Seed candidates in `spec.md` Concepts; let the grill skill promote them.
- **Glossary appendix at the end of `spec.md`.** Concepts go in the Concepts section at the top. There is no appendix.

## References

- The companion skill `arianna-grill` runs the interactive pass after this skill writes `spec.md`. It owns the questions you do not ask, the `CONTEXT.md` writes you do not make, and the `docs/adr/` creation gated on the three-bar test.
- The companion skill `arianna-critique` runs between this skill and `arianna-grill`, up to three rounds, returning `READY` or `REVISED` per round. Revise on `REVISED`; pass control to the grill skill on `READY` or on cap-out.
- Pocock vocabulary lives in `improve-codebase-architecture/LANGUAGE.md` (external). The terms here are faithful paraphrases for the spec-writer's context; the canonical definitions stay in Pocock's file.
- The orchestrator (`arianna-magic`) dispatches this skill in Phase 2 with `.agent/research.md` and `.agent/goal.md` attached and expects structured JSON back. See `arianna-magic/SKILL.md` "Dispatch" for the prompt shape.
