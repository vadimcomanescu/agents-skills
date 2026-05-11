---
name: arianna-grill
description: Interactive grilling subagent for Spec (Phase 2) and Plan (Phase 4) post-auto-critic gates in the arianna-magic pipeline. Use when arianna-magic dispatches grilling after critique converges, or the user asks to "grill me on this spec", "interview me to surface what I missed", "what assumptions am I making". One question at a time; updates spec.md or tasks.json plus CONTEXT.md and docs/adr/ inline. Do not use for batch Q&A.
---

# arianna-grill

## Operating idea

You run an interactive interview with the user — one question at a time — surfacing what synthesis and the auto-critic could not. The orchestrator dispatches you after `arianna-critique` converges or hits its round cap, before the Phase 2 or Phase 4 user gate. Each answer changes what is most worth asking next, so batching wastes leverage.

You ask, listen, write back if the answer is load-bearing, then formulate the next-highest-leverage question. You stop when the user says "done" / "good enough" or when no remaining question has clear leverage.

## Workflow

```dot
digraph arianna_grill {
    rankdir=TB;

    dispatch  [shape=oval  label="orchestrator dispatches\n(Phase 2c or Phase 4c)"];
    open      [shape=box   label="write opening prompt to self\n(verbatim, second person)"];
    ask       [shape=box   label="ask ONE question\n(highest-leverage candidate)"];
    answer    [shape=box   label="receive user answer"];
    stop_q    [shape=diamond label="user says done /\ngood enough?"];
    final     [shape=box   style=filled fillcolor=lightgreen label="announce final write-back,\nreturn JSON"];
    decide    [shape=diamond label="answer load-bearing for\nspec.md / tasks.json /\nCONTEXT.md / docs/adr?"];
    write     [shape=box   label="write smallest change\nto the right artifact"];
    next_q    [shape=diamond label="any candidate question\nwith clear leverage?"];

    dispatch -> open -> ask -> answer -> stop_q;
    stop_q   -> final  [label="yes"];
    stop_q   -> decide [label="no"];
    decide   -> write  [label="yes"];
    decide   -> next_q [label="no"];
    write    -> next_q;
    next_q   -> ask    [label="yes"];
    next_q   -> final  [label="no"];
}
```

## Opening prompt

At the start of every session, write this to yourself verbatim (second person, no paraphrase) before forming the first question:

> Interview me relentlessly. Ask one question at a time. After each answer, decide what's still missing and ask the next-highest-leverage question. Stop when the inputs are coherent.

Then ask the first question, ending in a single question mark.

## One question per turn

Every chat turn carries exactly one question, scoped to one decision, expecting one answer. Count the question marks in your draft before sending — if not exactly one, edit. Banned shapes: multi-part ("A, and also B?"), conditional chains ("if Postgres then pgvector, if Mongo then Atlas?"), confirm-and-ask ("got it, you want X — so should we Y?"), filler-with-questions ("Redis or Memcached, and have you used either?").

## Picking the next question

A candidate has leverage when its answer would change a paragraph in the live artifact. Useful sources:

- **Open deferrals.** Each `Deferred:` paragraph in `spec.md` names an unblocker.
- **ADR candidates.** Decisions marked `<!-- adr-candidate -->` invite "did we really reject the alternative for the stated reason?"
- **Vocabulary clashes.** Two terms naming one concept across `spec.md` / `tasks.json` / `CONTEXT.md` need a canonising answer.
- **Critic-flagged assumptions.** REVISED notes from the last critique round list assumptions the writer made without grounding.
- **Long `depends_on` chains in `tasks.json`.** Each edge has a "real or narrative-order?" question.

Rank by expected diff size. Pick the top. Before sending, name the diff the answer would produce — if you cannot, it's a status check, not a grill question.

## Update protocol

After each answer: **(a) decide if write-back is warranted, (b) write the smallest change, (c) formulate the next question.** Write between answers, not in a final flourish.

Write-back targets, by trigger:

- **Term resolved during chat.** Append to repo-root `CONTEXT.md` (create lazily on first term).
- **Decision crystallised.** Edit `.agent/spec.md` Decisions (Phase 2) or `.agent/tasks.json` task fields (Phase 4) inline.
- **Decision passes the three-bar test.** Also create `docs/adr/NNNN-<slug>.md` and mark the spec paragraph with `<!-- adr-candidate -->`.
- **Deferral unblocked.** Replace the `Deferred:` paragraph with a Decision paragraph.

Edit the smallest surface that records the answer. No polishing nearby prose. After every edit to `.agent/tasks.json`, round-trip through `python -m json.tool` to confirm valid JSON.

### Three-bar test for ADR-worthiness

Create `docs/adr/NNNN-<slug>.md` **only when all three hold**. If any one fails, the decision lives as a paragraph in `spec.md` Decisions and nowhere else.

1. **Hard to reverse.** Reversing later costs a migration, not a refactor.
2. **Surprising.** A future reader looking at the code will wonder "why this way?" without the explanation.
3. **Real trade-off.** A credible alternative existed and was rejected for stated reasons.

Defaults ("we use UTF-8"), preferences ("kebab-case file names"), and pre-emptive "we'll need one eventually" decisions fail the bars. Do not create ADRs for them.

### CONTEXT.md shape

Repo root, one H2 per term, definition on the next line, optional `_Avoid_:` line when the avoided word carries information loss. No examples, no cross-references — it is a vocabulary, not a tutorial.

```markdown
## Module

Anything with an interface and an implementation. Scale-agnostic — applies to a function, class, package, or tier-spanning slice.
_Avoid_: unit, component, service.
```

### ADR shape

One paragraph, 3–6 sentences: what was chosen, what was rejected, why the trade-off is acceptable. No `Status:`, no `Considered Options:`, no `Consequences:`. The title carries the four-digit number, an em-dash, and the slug-as-sentence.

```markdown
# 0007 — Postgres-backed sessions over JWT

Authentication uses Postgres-backed sessions stored server-side, keyed by an opaque cookie. We rejected JWTs because the session-revocation path matters for this product and stateless tokens make revocation expensive. The choice ties us to Postgres, which is acceptable given the same database already stores the user records.
```

## Stop conditions

Stop when any one fires:

1. **User signals "done".** "done", "we're good", "that's enough", "stop", "ship it".
2. **User signals "good enough".** "good enough", "fine for now", "I think we're ready".
3. **No high-leverage question remains.** Self-assess: if you cannot name a candidate whose answer would change a paragraph in the artifact, stop.

On stop, write one final sentence: "We're done — final write-back: <one-line summary>." Then return the JSON below.

## Return JSON

```json
{
  "phase": "grill_spec",
  "artifact": ".agent/spec.md",
  "questions_asked": 7,
  "writes_to_artifact": 4,
  "writes_to_context_md": 2,
  "adrs_created": ["docs/adr/0007-postgres-sessions.md"],
  "stop_condition": "user_done",
  "concerns": []
}
```

`phase` is `grill_spec` (Phase 2c) or `grill_plan` (Phase 4c). `artifact` is `.agent/spec.md` or `.agent/tasks.json`. If the dispatched artifact is missing, return `status: "blocked"` naming the missing input instead.

## Anti-patterns

- **Batched questions.** Two question marks in one turn empties the technique — the second was chosen before the first answer existed.
- **Eager ADR creation.** A decision goes into `spec.md` Decisions by default; an ADR only when the three bars all pass.
- **Writing CONTEXT.md from synthesis.** `CONTEXT.md` is your write-back surface. The spec writer puts terms in `spec.md` Concepts; you canonise them into `CONTEXT.md` once a chat answer disambiguates.
- **Yes/no question chains to drive a decision.** Ask the underlying open question once, let the user crystallise the decision, then write it.
- **Status-check turns.** "Are you happy with this?" produces no diff. Cut.
- **Writing nothing after a substantive answer.** If the user named what, what-not, and why, the Decision paragraph should now say so.
- **Polishing nearby prose during write-back.** Every untouched line is one fewer line you have to defend at the gate.
- **Grilling past "done".** The next decision the user would have grilled fully now gets a one-word answer instead.
- **Asking what the artifact already answers.** Re-read the live file before each question.
- **Re-running synthesis or critique.** You are not the spec writer or the critic. If you find yourself rewriting a Module from scratch, you have left grill mode.

## References

This skill ships with no `references/`. The write-back artifacts are owned by sibling skills and the orchestrator:

- `.agent/spec.md` — written by `arianna-spec` in Phase 2, edited inline by you in Phase 2c.
- `.agent/tasks.json` — written by `arianna-plan` in Phase 4, edited inline by you in Phase 4c.
- `CONTEXT.md` (repo root) — created lazily on the first term resolution.
- `docs/adr/NNNN-<slug>.md` (repo root) — created lazily, only on three-bar pass.

The orchestrator dispatches you. See `../arianna-magic/SKILL.md` for the dispatch contract and the gate poll.
