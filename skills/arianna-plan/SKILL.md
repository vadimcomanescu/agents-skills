---
name: arianna-plan
description: Planner for Phase 4 of the arianna-magic pipeline. Use when arianna-magic dispatches Phase 4 (Plan), or the user asks to "break this into tasks", "produce tasks.json", "make the build plan", "atomize the work". Outputs atomic tasks (at most 3 files and 50 LOC each) tagged refactor or behavior per Beck, with a depends_on DAG. Do not use for high-level roadmap planning — that is arianna-spec territory.
---

# arianna-plan

## Operating idea

**You produce `.agent/tasks.json` — a DAG of atomic tasks the autonomous loop can execute without you in the room.** The plan is the final pre-handoff artifact. Once it ships through the gate, no human reviews phase output again until the dashboard says "done" or "blocked". Every task must therefore be small enough to verify in a single review round, scoped so a worker cannot accidentally widen it, and tagged so the worker knows whether they are changing behavior or tidying shape.

You do not write code. You do not invent acceptance criteria the spec did not commit to. You read `.agent/spec.md`, slice its modules into atomic units, wire their dependencies, and emit JSON.

**Falsifiable test.** If a single task in your plan touches more than three files, exceeds 50 lines of changed code, or carries more than one acceptance bullet, the task is not atomic — split it before you save.

_Avoid_: "story", "epic", "ticket". Say _task_.

### Why atomic

Atomic tasks make the autonomous loop sound. A judge can fully read a 50-line diff in one pass; a worker can land a 3-file change without bumping into adjacent work; a fresh subagent can recover from a blocked task because the blast radius is bounded. The autonomous Phase 5–6 loop runs hours-to-days unattended — every minute the loop spends arguing about scope is a minute the human is not watching. Atomicity is the prophylactic.

## When to use

The description carries the trigger phrases. The non-trigger to remember: this is not the place to argue about scope. If the spec is wrong, the gate to push back is arianna-spec or arianna-grill — not here. By Phase 4 the spec is frozen. Your job is to translate it, not to relitigate it.

## Atomic-task rules

**A task is atomic when it touches at most three files, changes at most 50 lines of code, has exactly one named acceptance test, and lists only dependencies that are guaranteed satisfied at dispatch time.** The four numbers are the contract. Below the contract, workers move fast and judges read fast. Above it, scope creep and partial-merges show up.

_Avoid_: "small task", "quick win", "easy task". Say _atomic_ and check the four numbers.

### The four caps

| Cap | Limit | Why |
|---|---|---|
| Files touched | ≤ 3 | A judge can hold three files in working memory; the fourth is where they start skimming |
| Lines of code changed | ≤ 50 (`estimate_loc`) | A 50-line diff is reviewable end-to-end in one pass |
| Acceptance tests | exactly 1 | One failing test is a clear signal; two muddies the verdict |
| `depends_on` open at dispatch | 0 | The worker should never wait; if it must wait, it is not eligible yet |

When the spec demands more, split. A 200-LOC module becomes four 50-LOC tasks with a `depends_on` chain. A two-test feature becomes two tasks where the second `depends_on` the first.

**Falsifiable test.** If a worker returns `status: "blocked"` citing "a file I needed wasn't in `files[]`" or "the test I had to add belongs to a different concern", your plan failed the atomic-task rule on that task. Re-split.

### Acceptance is a single named test

The `acceptance` field is one sentence describing one test the judge can run. "`tests/test_login.py::test_invalid_password_returns_401` passes" is acceptable. "Login works correctly" is not — `correctly` is unbounded. The test is the bar; the spec's wording is the rationale; the worker writes the test under tdd-mutation discipline.

_Avoid_: "works", "is correct", "looks good", "handles edge cases". Name the test.

### `depends_on` satisfied at dispatch

`depends_on[]` lists task IDs that must be merged to main before this task can be dispatched. The coordinator filters eligible tasks by this list every poll. If you find yourself wanting to express "this task waits for that task only sometimes", you are mixing two tasks — split.

## Refactor or behavior — never both

**Tag every task with exactly one of `tag: "refactor"` or `tag: "behavior"`. Never both.** A refactor task changes structure without changing observable behavior; tests should pass before and after with no edits. A behavior task adds, removes, or alters observable behavior; tests change too. Mixing them in one diff destroys the ability to bisect: when a test fails, you cannot tell whether the new behavior is wrong or the old behavior was misplaced by refactor.

> Kent Beck: "Each commit is either a structural change or a behavior change, never both."

This is Beck's rule from _Tidy First?_. The plan inherits it. If the spec needs both — for example, "extract `AuthSession` into its own module and add 2FA" — the planner emits two tasks: `(refactor) extract AuthSession` first, then `(behavior) add 2FA to AuthSession` with `depends_on: ["<extract-id>"]`. Workers and judges then know which discipline they are in.

_Avoid_: "cleanup", "rework", "polish". Use _refactor_. _Avoid_: "feature", "story", "change". Use _behavior_.

**Falsifiable test.** Open the diff for a `tag: "refactor"` task. Run the project's tests against the diff with no test changes. If any test fails or any test had to be edited, the task was not a pure refactor — return it as `tag: "behavior"` or split.

## The deletion test, applied to tasks

**Imagine deleting the task from the plan. If the spec still ships, the task is not earning its keep — drop it.** The deletion test is Pocock's bar for deep modules; here it is the bar for tasks. The plan is a contract with the autonomous loop, and every task in it costs at least one worker dispatch, one judge review, and one worktree. Tasks that exist for completeness or symmetry but do not advance an acceptance bullet in `spec.md` are pure cost.

> Mat Pocock: "Imagine deleting the module. If you can, and the system still works, the module wasn't earning its keep."

The Pocock test was designed for modules; tasks have the same property. A task earns its keep when at least one acceptance bullet in `spec.md` would become unverifiable if the task were absent. If you cannot point at that bullet, delete the task.

_Avoid_: "scaffolding task", "preparatory task", "nice-to-have". Either it backs an acceptance bullet or it goes.

**Falsifiable test.** For each task, point at a specific paragraph in `.agent/spec.md` that requires it. If the only justification is "the architecture needs it" or "we'll want this later", remove the task.

### Difference from refactor

A refactor task is allowed because it unblocks the next behavior task — the deletion test passes through the dependent. A scaffolding task with no behavior dependent does not pass. Refactors are kept honest by `depends_on`: every refactor must have at least one downstream behavior task that needs it, or the refactor itself is the rot.

## Parallel-wave estimation

**Walk the DAG layer-by-layer; each layer is a wave; the orchestrator runs up to 5 tasks per wave.** A wave is the set of tasks whose `depends_on[]` are all in earlier waves. Wave 0 is every task with empty `depends_on`. Wave 1 is every task whose dependencies are all in Wave 0. And so on. The orchestrator caps in-flight workers at 5 (jarrodwatts' merge-conflict cap), so a wave wider than 5 spills over and serializes the remainder inside the same logical layer.

_Avoid_: "phase", "batch", "step". Say _wave_.

### How to estimate

1. Topologically sort `tasks.json`.
2. Assign each task to the lowest-numbered wave such that all `depends_on[]` are in earlier waves.
3. Record the wave count and the maximum wave width. Both signals matter:
   - **Wave count** tells you how many serial round-trips the autonomous loop will take.
   - **Max wave width** tells you whether the 5-worker cap will be saturated.

Report both at the end of the plan in a short `# Parallel-wave estimate` block at the top of `tasks.json` (as a comment in the orchestrator's hand, not in JSON — JSON has no comments; emit it in the dispatch handoff message instead).

### When the DAG is too sequential

If most tasks have `depends_on` lengths of 1 forming a long chain, the plan is over-serialised. Look for false dependencies: a task that genuinely needs another's output, versus a task that was written in narrative order. The first case is real; the second can be flattened by removing the dependency and giving both tasks non-overlapping `files[]`.

**Falsifiable test.** If your DAG has more waves than tasks ÷ 2, you have over-serialised — every wave averages fewer than two parallel tasks. Re-examine `depends_on[]` for narrative-order pseudo-dependencies and flatten.

## trycycle plan-editor loop

**The plan-editor loop runs up to five rounds of arianna-critique, each with a fresh planner subagent, terminating on a READY verdict.** This is the auto-critic loop the orchestrator wraps Phase 4 in. Each round: the planner emits a `tasks.json` draft, a fresh arianna-critique subagent reviews it stateless, returns `READY` (ship to grill/gate) or `REVISED` (with line-level notes), and a fresh planner re-drafts on `REVISED`. After five rounds without `READY`, the orchestrator surfaces the residual disagreement to the user at the Phase 4 gate.

> trycycle subagent-defaults: "Each round runs in a fresh subagent. The planner that wrote round N must not be the planner that fixes round N+1."

trycycle's up-the-hill protocol is built on context-fresh iteration. A planner that just defended a decision is the worst candidate to revise it; a fresh planner inherits no investment in the previous draft. Pair this with arianna-critique's stateless contract (no prior round context loaded), and each round is a genuine new attempt rather than an incremental edit.

_Avoid_: "feedback loop", "review cycle", "iteration". Say _plan-editor loop_.

### The five-round cap

Three rounds is normal. Five is the ceiling. If a fifth round still returns `REVISED`, the disagreement is not the planner's to resolve — it is structural, and the gate (with the user) is the right venue. Surface the open issues; do not silently re-dispatch a sixth round.

### Round structure

| Step | Actor | Reads | Writes |
|---|---|---|---|
| 1 | planner subagent (fresh) | `.agent/spec.md`, prior critique notes if any | `tasks.json` draft |
| 2 | arianna-critique subagent (fresh) | `tasks.json` draft, `.agent/spec.md` | `READY` or `REVISED` + notes |
| 3 (if REVISED) | orchestrator | critique notes | dispatches new planner with notes attached |
| 4 (if READY) | orchestrator | `tasks.json` | hands off to arianna-grill, then gate |

The orchestrator owns the loop counter and the freshness discipline. The planner skill itself is stateless across rounds — its only input is `.agent/spec.md` plus any pinned critique notes.

**Falsifiable test.** If the same subagent appears in two consecutive rounds, or the planner reads its own previous draft as input, the loop is broken. Each round must be a clean spawn with `.agent/spec.md` and (optionally) the latest critique notes — nothing else.

## tasks.json schema

**Every task has exactly these fields; nothing more, nothing less.** Schema drift means the worker template, the judge template, and the dashboard renderer all break silently. The fields below are the contract.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | Stable, kebab-case, unique. Used by workers and judges as the dispatch key |
| `title` | string | yes | One short sentence in imperative mood. "Add login form to /signin." |
| `description` | string | yes | 1–3 sentences. What the task changes and why. No implementation detail |
| `category` | enum | yes | One of `auth`, `crud`, `ui`, `infra`, `refactor`, `data`, `api`. Drives QA-module loading in arianna-review |
| `tag` | enum | yes | `refactor` or `behavior`. Exactly one |
| `files` | string[] | yes | Absolute repo paths the worker is authorised to change. Length ≤ 3 |
| `acceptance` | string | yes | One sentence naming the specific test that must pass |
| `depends_on` | string[] | yes | Task IDs that must merge before dispatch. Empty array allowed |
| `built_by` | enum | yes | `claude` or `codex`. Coordinator alternates; planner writes initial assignment |
| `status` | enum | yes | `pending`, `in_progress`, `blocked`, `done`. Planner writes `pending` |
| `estimate_loc` | integer | yes | Planner's LOC estimate, ≤ 50 |

`category` is load-bearing: arianna-review reads it to decide which QA modules to load. `auth` triggers `security.md` + `api.md`. `ui` triggers `a11y.md`. `infra` loads only `base.md`. If the category is wrong, the judge runs the wrong checks.

_Avoid_: free-form `category` strings. Stick to the enum.

### One excellent task

```json
{
  "id": "auth-session-cookie",
  "title": "Issue secure session cookie on successful login.",
  "description": "After a successful password check in POST /login, set an HTTP-only, Secure, SameSite=Lax cookie named `session` carrying a signed session id. Required so the rest of the auth flow can rely on cookie presence instead of re-validating credentials per request.",
  "category": "auth",
  "tag": "behavior",
  "files": [
    "app/routes/login.py",
    "app/auth/session.py",
    "tests/test_login.py"
  ],
  "acceptance": "tests/test_login.py::test_successful_login_sets_secure_session_cookie passes",
  "depends_on": ["auth-password-check"],
  "built_by": "claude",
  "status": "pending",
  "estimate_loc": 38
}
```

The task is atomic (3 files, ≤50 LOC, one named test). It is tagged `behavior` because it introduces a new HTTP response header. It has one upstream dependency (the password check must already be in main, or the test cannot reach this code path). Its `category` is `auth`, which tells arianna-review to load `security.md` and `api.md` and to spend its scrutiny budget on cookie-flag correctness rather than a11y.

## Workflow

When the orchestrator dispatches Phase 4:

1. **Read.** `.agent/spec.md` (the source of truth), `.agent/research.md` § Quality Commands (for test/lint commands the worker will invoke), and if a prior `tasks.json` exists, the latest critique notes.
2. **Slice.** Walk each module in the spec. For each module, list the behavior changes the spec commits to and the refactors required to enable them. Each becomes a candidate task.
3. **Atomize.** For each candidate, check the four caps. Split anything over the line until every task fits.
4. **Tag.** Apply the Beck rule. Split any mixed task into a `refactor` predecessor and a `behavior` successor.
5. **Wire.** Fill in `depends_on[]` strictly by true data/code dependency. Drop narrative-order pseudo-dependencies.
6. **Delete.** For each task, run the deletion test. If you cannot name the acceptance bullet it backs, remove the task.
7. **Estimate waves.** Topologically layer. Report wave count and max wave width. If max width > 5, the orchestrator will serialize within the wave — flag it.
8. **Emit.** Write `.agent/tasks.json` with the schema above. Round-trip it through `python -m json.tool` to confirm valid JSON.
9. **Hand off.** Return the structured JSON the orchestrator expects (see `Return JSON` below) and stop. The orchestrator runs the plan-editor loop; you do not loop yourself.

### Return JSON

After writing `.agent/tasks.json`, return this as the last block of your reply:

```json
{
  "phase": "plan",
  "tasks_file": ".agent/tasks.json",
  "task_count": 12,
  "wave_count": 4,
  "max_wave_width": 5,
  "refactor_count": 3,
  "behavior_count": 9,
  "concerns": []
}
```

If you cannot complete the plan — for example, the spec is internally contradictory on a module boundary — return `status: "blocked"` with the contradiction stated plainly. The orchestrator routes back to arianna-spec, not to a fresh planner.

## Anti-patterns

- **Story-sized tasks.** A "task" that is really a feature with sub-tasks hidden inside. If a worker would naturally split it on receipt, you should have split it in planning.
- **Mixed refactor + behavior.** The Beck rule violation. Worker writes a 60-line diff with both a rename and a new endpoint; the judge cannot tell whether the rename broke an unrelated test.
- **Narrative `depends_on`.** Task B depends on Task A only because you described A first. If B's `files[]` does not overlap A's outputs, the dependency is fake — drop it and let them parallelise.
- **Free-form `category`.** `category: "session-management"` instead of `auth`. The judge loads the wrong QA modules; security checks silently get skipped.
- **`estimate_loc: 120`.** If your honest estimate is over 50, the task is not atomic. Split it before writing the JSON.
- **Re-dispatching the loop yourself.** The plan-editor loop is the orchestrator's job. A planner that critiques its own draft is not a fresh planner — that breaks the trycycle contract.
- **Acceptance as a paragraph.** "Login works for valid users and rejects invalid users with appropriate error messages and rate-limits brute-force attempts" is three tasks, not one acceptance line.
- **Scaffolding tasks.** A task that "sets up the directory structure" with no behavior dependent. Fails the deletion test.

## References

This skill ships with no `references/`. Its surface area is `tasks.json` plus the workflow above. If a future variant of the planner needs domain-specific atomization rules (e.g., a "data migration" category with a longer LOC cap), add a `references/` file and load it conditionally — but do not bloat this body.

The downstream consumers are:

- `skills/arianna-magic/references/templates/implement.md` — worker reads `id`, `files`, `acceptance`, `depends_on`, `built_by`.
- `skills/arianna-magic/references/templates/review.md` — judge reads `id`, `acceptance`, `category`, `files`, `depends_on`.
- `skills/arianna-magic/scripts/render_dashboard.py` — dashboard reads every field for the DAG and the per-task status card.

Keep the schema stable. If you change a field name, you change three downstream files in lockstep — flag that in `concerns[]` rather than shipping an unannounced rename.
