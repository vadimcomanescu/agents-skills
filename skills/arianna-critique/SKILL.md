---
name: arianna-critique
description: Fresh-subagent critic for Spec (Phase 2) and Plan (Phase 4) auto-critic loops in the arianna-magic pipeline. Use when arianna-magic dispatches a critique round, or the user asks to "auto-critique this spec", "run the planner critic loop", "READY or REVISED on this draft". Stateless per round; verdict is READY or REVISED with reasoning; max 3 rounds at Spec, max 5 at Plan. Do not use for interactive grilling — that is arianna-grill.
---

# arianna-critique

A fresh subagent runs one round and returns one verdict. The orchestrator owns the loop; the round is yours. Reading prior rounds is contamination — your context window contains the draft, its source artifacts, and nothing else.

## Workflow

```dot
digraph arianna_critique {
    rankdir=TB;

    dispatch [shape=oval label="orchestrator dispatch\n(Phase 2b or 4b, round N)"];
    phase    [shape=diamond label="phase?"];
    load_spec  [shape=box label="load ONLY .agent/spec.md\n+ research.md, goal.md,\nCONTEXT.md, docs/adr/"];
    load_plan  [shape=box label="load ONLY .agent/tasks.json\n+ spec.md, research.md"];
    contam   [shape=diamond label="prior critique-round-N.json\nin reading list?"];
    refuse   [shape=box style=filled fillcolor="#ffcccc" label="status: blocked\n(contaminated spawn)"];
    scan     [shape=box label="walk phase checklist top to bottom"];
    failed   [shape=diamond label="any checklist row fails?"];
    issues   [shape=box label="emit specific_issues[]:\nlocation + issue + suggested_fix\n(one entry per failure)"];
    ready    [shape=box style=filled fillcolor="#ccffcc" label="verdict: READY\nspecific_issues: []"];
    revised  [shape=box style=filled fillcolor="#ffffcc" label="verdict: REVISED\nwith specific_issues[]"];
    out      [shape=oval label="return JSON, stop"];

    dispatch -> phase;
    phase    -> load_spec [label="spec"];
    phase    -> load_plan [label="plan"];
    load_spec -> contam;
    load_plan -> contam;
    contam   -> refuse [label="yes"];
    contam   -> scan   [label="no"];
    scan     -> failed;
    failed   -> issues  [label="yes"];
    failed   -> ready   [label="no"];
    issues   -> revised;
    refuse   -> out;
    ready    -> out;
    revised  -> out;
}
```

Fresh per round: each spawn loads the current draft cold. A critic who already argued the prior round defends the prior verdict; that is theatre, not critique. The orchestrator dispatches a clean subagent every round and never passes your prior JSON forward — if you find it in your inputs, the dispatch is broken and you return `status: "blocked"`.

## What you read

| Phase | Draft | Source artifacts | Anything else |
|---|---|---|---|
| Spec (2b) | `.agent/spec.md` | `.agent/research.md`, `.agent/goal.md`, repo-root `CONTEXT.md`, `docs/adr/` | Nothing |
| Plan (4b) | `.agent/tasks.json` | `.agent/spec.md`, `.agent/research.md` § Quality Commands | Nothing |

No prior critique rounds. No prior writer drafts. No code diffs (that is `arianna-review`). No design screens (Phase 3 has no auto-critic). If your inputs do not match the table, return `status: "out_of_scope"`.

## Spec checklist

The bar is internal coherence — every concept earns its keep, every decision names a rejected alternative, every module passes the deletion test, every deferral names its unblocker.

| Section | Pass criterion | Failure example |
|---|---|---|
| Concepts | Every term is referenced by a Story, Decision, or Module in the same file | `Concepts: "Session Vault"` defined but never used — delete |
| User Stories | Each story names actor, want, so-that, and the observable signal | "User logs in" with no signal — what test would the planner write? |
| User Stories | Each story uses only Concepts vocabulary | Story uses `session-token` while Concepts defines `session-cookie` — pick one |
| Decisions | Each decision names the rejected alternative and the trade-off | "We use Postgres" with no rejected option — that is a default, not a decision |
| Decisions | Hard-to-reverse + surprising + real-trade-off decisions carry `<!-- adr-candidate -->` | A migration-cost decision left unmarked |
| Modules | Each Module names Interface, Seam, Depth justification, and Deletion-test outcome | Module lists Interface only — Depth and Deletion-test missing |
| Modules | Every Module passes the deletion test (complexity reappears across callers if deleted) | One-caller helper — fold into the caller, delete the section |
| Modules | No file paths, no code snippets (unless schema/state-machine IS the decision) | `app/routes/login.py:42` in a Module body — those go stale |
| Deferrals | Every `Deferred:` names a single fact whose value would flip the decision | `Deferred: TBD` with no unblocker — hand-waving |
| Coverage | Every goal acceptance bullet maps to a Story, Decision, or Module | Goal commits to "2FA" with no spec presence — coverage failure |

## Plan checklist

The bar is atomicity, clean tagging, sound DAG, parallel-wave width estimation against the orchestrator's 5-worker cap.

| Property | Pass criterion | Failure example |
|---|---|---|
| Atomic | `files[]` length ≤ 3 | Task touching 5 files — split |
| Atomic | `estimate_loc` ≤ 50 | `estimate_loc: 120` — split before saving |
| Atomic | `acceptance` is one sentence naming exactly one test | "Login works correctly" — unbounded; name the test |
| Atomic | `depends_on` references real task IDs in the same file | Dangling dep on a deleted task |
| Tag clean | `tag` is exactly `refactor` or `behavior` | `tag: "refactor+behavior"` — split into chained tasks |
| Tag clean | A `refactor` task's diff with no test edits leaves all tests green | Refactor task whose acceptance is a new test — that is behavior |
| DAG sound | No cycles, topologically sortable | `A depends_on B` and `B depends_on A` |
| DAG sound | No narrative-order pseudo-dependencies | `B depends_on A` only because A was described first; files do not overlap |
| DAG sound | Every refactor has at least one downstream behavior task that needs it | Refactor with no dependent — fails task-level deletion test |
| Wave estimate | Max wave width respects the 5-cap, or the plan flags spillover in `concerns[]` | Wave of 9 with no acknowledgment — orchestrator serialises silently |
| Wave estimate | Wave count is not pathological (`waves > tasks ÷ 2` signals over-serialisation) | 10 tasks, 7 waves — narrative-order deps; flatten |
| Schema clean | Required fields present; enums respected (`category`, `tag`, `built_by`, `status`) | `category: "session-management"` — not in enum; pick `auth` |
| Deletion test | Every task ties to a specific acceptance bullet in `spec.md` | "Set up project structure" backs no spec bullet — drop |

Topologically sort the tasks yourself: Wave 0 has empty `depends_on`; Wave N has all deps in earlier waves. Compute max wave width. If width > 5 and the plan did not flag it, that row fails.

## Verdict shape

Exactly one JSON block, last in your reply. `verdict` is one of `"READY"` or `"REVISED"` — no third value, no hedging. A blocked spawn returns `status` alongside, not as a verdict.

```json
{
  "phase": "plan",
  "round": 2,
  "verdict": "REVISED",
  "reasoning": "Three tasks mix refactor with behavior, and the auth-redirect → auth-cookie dependency is narrative-order — files do not overlap. Atomicity and DAG soundness fail.",
  "specific_issues": [
    {
      "location": "tasks.json task `auth-session`",
      "issue": "Mixed tag: extracts AuthSession (refactor) and adds 2FA (behavior) in one diff",
      "suggested_fix": "Split into `(refactor) extract-auth-session` and `(behavior) add-2fa-to-auth-session` with depends_on chain"
    },
    {
      "location": "tasks.json task `auth-redirect` depends_on",
      "issue": "Declares dependency on `auth-cookie` but files[] do not overlap",
      "suggested_fix": "Drop the dependency; the two tasks parallelise in the same wave"
    }
  ]
}
```

On `READY`, `specific_issues` is `[]` and `reasoning` is one paragraph naming what you checked and why the draft passes. Each `specific_issues` entry must be locatable (section name + sub-section name, or task ID) and individually actionable — collapsing failures into one entry strips the granularity the writer needs.

## Round caps

| Phase | Cap | What happens at the cap |
|---|---|---|
| Spec (2b) | 3 rounds | Orchestrator surfaces last round's `specific_issues[]` at the Phase 2 gate; user picks a direction |
| Plan (4b) | 5 rounds | Orchestrator surfaces last round's `specific_issues[]` at the Phase 4 gate; user picks a direction |

You do not count rounds. You report the current round in the JSON and apply the same bar at round 1 and at the cap. The orchestrator counts and stops dispatching. If round 3 at Spec returns `REVISED`, the next move is the user gate, not a round 4.

## Anti-patterns

- **Loading prior critique rounds.** Your input is the current draft and its source artifacts. If `.agent/critique-round-N.json` shows up in your reading list, return `status: "blocked"` — the dispatch was broken.
- **Defending a prior verdict.** You have no prior verdict. Re-read the draft cold. If you find yourself paraphrasing what last round must have said, your spawn was not fresh — escalate.
- **Soft-pedaling at the cap.** A round-5 plan critic applies the same checklist as round 1. The cap is the orchestrator's escalation trigger, not a leniency signal.
- **A third verdict.** No `PARTIAL`, `READY_WITH_NOTES`, `READY_WITH_FIXES`, `REVISED_BUT_CLOSE`. The orchestrator routes on two strings; a third value stalls the loop.
- **Editing the draft.** You return JSON. The next writer round acts on `specific_issues[]`. Touching `spec.md` or `tasks.json` yourself violates the boundary.
- **Inventing inputs.** Missing `.agent/spec.md` at Phase 2 or `.agent/tasks.json` at Phase 4 → `status: "blocked"`. Do not synthesise the draft from the goal text and critique your own synthesis.
- **Reviewing code or diffs.** That is `arianna-review` in Phase 6. If your dispatch attaches `.agent/evidence/<task-id>/`, return `status: "out_of_scope"`.
- **Collapsing issues.** "Several modules fail the deletion test" is not enough; name each module in its own `specific_issues[]` entry.
- **Voting REVISED for style.** Sentence length, heading style, paragraph rhythm — none of your business. Internal coherence is the bar.
- **Voting REVISED when only the user can decide.** If every `suggested_fix` is "ask the user", vote `READY` and let `arianna-grill` carry the questions to the gate. The writer cannot fix what the user owns.

## References

The writers you critique are siblings: `arianna-spec` writes `.agent/spec.md` at Phase 2a, `arianna-plan` writes `.agent/tasks.json` at Phase 4a. The interactive successor on both phases is `arianna-grill`; you do not invoke it. The orchestrator (`arianna-magic`) owns the loop counter, the round cap, and the gate escalation.
