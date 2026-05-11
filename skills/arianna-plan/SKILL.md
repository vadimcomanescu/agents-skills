---
name: arianna-plan
description: Plan role for the arianna-plan-loop coordinator. Reads <run_dir>/spec.md and <run_dir>/research.md, writes <run_dir>/tasks.json — atomic tasks, tagged refactor or behavior, with a sound DAG and parallel-wave width estimation (run_dir is supplied by the coordinator). Use when arianna-plan-loop dispatches the plan phase, or the user asks to "break this spec into tasks", "produce the task DAG", "give me a buildable plan". Do not use for prose plans, OKRs, or roadmaps — those are not the artifact this skill writes.
---

# arianna-plan

You produce one file: `<run_dir>/tasks.json` (`<run_dir>` supplied by the coordinator). The downstream build agent reads this and executes tasks one at a time (or, in a parallel-aware coordinator, fanned out by topological order). The bar is atomicity, clean tagging, sound DAG, and parallel-wave width estimation against a five-worker downstream cap.

A plan that reads well but mixes refactor with behavior in the same task, or carries narrative-order dependencies that do not match the actual file overlap, fails the plan phase regardless of prose quality.

## Workflow

1. Read `<run_dir>/spec.md` and `<run_dir>/research.md`. If either is missing, return `status: "blocked"`.
2. For each User Story and Module in the spec, enumerate the work needed. Separate refactor edges (move/rename/extract without changing observable behavior) from behavior edges (new test, observable change). A pure `refactor` task's diff with no test changes must leave all tests green; a `behavior` task introduces or modifies a test.
3. Atomise. Each task touches ≤ 3 files, has `estimate_loc ≤ 50`, and `acceptance` names exactly one test. If a task would exceed those bounds, split it.
4. Build the DAG. A task `B` depends on `A` only when `B.files` overlaps with `A.files`, or when `A` introduces a symbol/contract `B` consumes. Narrative-order ("we described A first") is not a dependency — strip it.
5. Topologically sort. Wave 0 has empty `depends_on`. Wave N has all deps in earlier waves. Max wave width should respect the downstream worker cap of 5; if any wave exceeds 5, flag it in `concerns[]`, do not silently let the downstream serialise.
6. Tag each task with the quality commands it must pass green from `<run_dir>/research.md § Quality Commands`. If research found no quality commands, set `green_on: []` and surface it as a concern.
7. Write `<run_dir>/tasks.json`. Round-trip through `python -m json.tool` before returning.
8. Return JSON to the coordinator.

## tasks.json schema

```json
{
  "version": 1,
  "goal_slug": "session-revoke",
  "tasks": [
    {
      "id": "session-vault-extract",
      "category": "auth",
      "tag": "refactor",
      "depends_on": [],
      "files": ["src/auth/middleware.py", "src/auth/session.py"],
      "estimate_loc": 35,
      "acceptance": "Existing test tests/auth/test_login.py::test_login_sets_cookie passes after the extraction.",
      "green_on": ["pytest", "ruff", "mypy"],
      "rationale": "Folds three duplicated session helpers into a single module so the revoke task has one place to add invalidation.",
      "spec_anchor": "Modules § Session vault"
    },
    {
      "id": "session-revoke-endpoint",
      "category": "auth",
      "tag": "behavior",
      "depends_on": ["session-vault-extract"],
      "files": ["src/auth/routes.py", "tests/auth/test_revoke.py"],
      "estimate_loc": 48,
      "acceptance": "tests/auth/test_revoke.py::test_revoke_invalidates_session_within_5s passes.",
      "green_on": ["pytest", "ruff", "mypy"],
      "rationale": "Adds the POST /api/sessions/<id> revoke endpoint behind the Session vault module.",
      "spec_anchor": "User Stories § Logged-in user can revoke a session from a second device"
    }
  ]
}
```

Enum fields:

- `tag`: `"refactor"` or `"behavior"`. Never `"refactor+behavior"` — split.
- `category`: short kebab-case domain bucket (`auth`, `billing`, `ui-shell`, ...). One per task.
- `green_on`: array of command strings copied verbatim from `<run_dir>/research.md § Quality Commands`. Empty array allowed only if research found no quality commands; flag as concern.

Required fields per task: `id`, `category`, `tag`, `depends_on`, `files`, `estimate_loc`, `acceptance`, `green_on`, `rationale`, `spec_anchor`.

`spec_anchor` points at the spec section the task implements. The reviewer uses it to verify every task ties to spec presence — a task without one fails the deletion test.

## Bar per row

The reviewer (`arianna-review`) checks the bar below. Write to it directly.

| Property | Pass criterion |
|---|---|
| Atomic | `files[]` length ≤ 3. |
| Atomic | `estimate_loc` ≤ 50. |
| Atomic | `acceptance` is one sentence naming exactly one test. |
| Tag clean | `tag` is exactly `refactor` or `behavior`. A refactor task's diff with no test edits leaves all tests green. |
| DAG sound | No cycles. Topologically sortable. |
| DAG sound | No narrative-order pseudo-dependencies. `B depends_on A` only when files overlap or `A` produces a symbol `B` consumes. |
| DAG sound | Every refactor has at least one downstream behavior task that needs it. Refactor with no dependent fails the task-level deletion test. |
| Wave estimate | Max wave width ≤ 5, or the plan flags spillover in `concerns[]`. |
| Wave estimate | Wave count is not pathological. `waves > tasks / 2` signals over-serialisation by narrative order; flatten. |
| Schema clean | Required fields present; enums respected (`tag`, `green_on`, `category`). |
| Deletion test | Every task ties to a specific Story/Decision/Module anchor in the spec. "Set up project structure" backs no spec bullet — drop. |

## Wave estimation

Topologically sort the tasks yourself. Wave 0 has empty `depends_on`. Wave N has all deps in earlier waves. The width of a wave is the number of tasks at that level — the number of workers a parallel-aware downstream coordinator would dispatch in one batch.

The downstream cap is 5 workers (beyond that, merge conflicts dominate). If any wave's width exceeds 5, the plan either splits the wave (introduce a synthetic ordering constraint with a stated reason) or flags `concerns[]: ["wave 2 width is 9, exceeds the 5-cap, downstream will serialise"]`.

If you find yourself producing 10 tasks across 7 waves, the DAG is over-serialised by narrative order. Re-read the spec; most of those edges are not real.

## Return JSON

```json
{
  "phase": "plan",
  "round": 1,
  "plan_path": "<run_dir>/tasks.json",
  "tasks_count": 12,
  "refactor_count": 4,
  "behavior_count": 8,
  "waves_count": 4,
  "max_wave_width": 3,
  "concerns": []
}
```

`plan_path` is the path you actually wrote (e.g. `.arianna/2026-05-11-session-revoke/tasks.json`).

`round` is the revise round the coordinator passed in. On a revise, increment from the prior return.

## Anti-patterns

- **Mixed tags.** `tag: "refactor+behavior"` is a split, not a tag. The reviewer's first failure.
- **Narrative-order dependencies.** `B depends_on A` because A was described first in the spec, but the files do not overlap and A produces nothing B consumes. Strip these — they kill parallelism.
- **Refactors with no downstream.** A refactor that no later task needs is a refactor that should not exist. Fold the change into the consuming behavior task.
- **Unbounded acceptance.** "Login works correctly" is not acceptance. Name the test file and the test name.
- **Padding the task count.** Splitting one cohesive change into seven tasks "for visibility" produces wave dependency hell. Atomicity is `≤ 3 files` and `≤ 50 LOC`, not `1 file` and `5 LOC`.
- **Ignoring the wave cap silently.** A wave of 9 with no `concerns[]` line is the worst failure — downstream will serialise without telling anyone.
- **Tasks not anchored to the spec.** Every task carries a `spec_anchor`. If the anchor is "general project setup", the spec is missing a Module or the task should not exist.
- **Inventing quality commands.** Copy `green_on` verbatim from `<run_dir>/research.md § Quality Commands`. If research found none, write `[]` and flag as concern — do not guess `npm test` because most repos have it.

## References

Sibling skills and their relationship to `<run_dir>/tasks.json`:

- `arianna-spec` — your input. Every task carries a `spec_anchor` pointing at a spec section.
- `arianna-research` — your input for the `green_on` field.
- `arianna-review` — checks your output against the bar table above.
- `grill-with-docs` — interactive successor; the coordinator runs it in parent context after review converges and applies the user's answers to `tasks.json` as post-grill bookkeeping.
- `arianna-plan-loop` — coordinator that dispatches you, owns `<run_dir>`, counts revise rounds, and writes the `HANDOFF.md` referencing your plan.
