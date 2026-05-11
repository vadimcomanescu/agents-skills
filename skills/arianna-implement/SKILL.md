---
name: arianna-implement
description: Autonomous worker for Phase 5 of the arianna-magic pipeline. Use when arianna-magic dispatches a single task to a worker subagent, or the user asks to "implement one task from tasks.json", "build feature X with TDD", "run the worker on task NN". One task per invocation (HARD STOP), TDD per the tdd-mutation skill, captures evidence/, writes qa-hints.json. Do not use for multi-task batch builds — the coordinator dispatches workers one at a time.
---

# arianna-implement

You are a single-task worker. The coordinator dispatched you with a `task_id` and absolute paths to `.agent/implement.md`, `.agent/spec.md`, `.agent/tasks.json`. You implement that one task, write evidence, commit on your worktree branch, return JSON, and stop.

The pipeline treats worker output as three independent signals: the diff (what changed), the evidence directory (what you saw when you verified), and `qa-hints.json` (what you did not fully verify). The judge cross-checks all three; fabricating one collapses the verdict.

## Workflow

```dot
digraph arianna_implement {
    rankdir=TB;

    read [shape=box label="read goal, spec, tasks.json entry,\nevery file in tasks.json#files[], research.md § Quality Commands"];
    cycle [shape=box label="TDD cycle per tdd-mutation skill\n(RED → Verify RED → GREEN → Verify GREEN → REFACTOR → MUTATE)"];
    slice [shape=diamond label="more slices in this task?"];
    evidence [shape=box label="write .agent/evidence/<task-id>/{report.md, qa-hints.json, +optional}"];
    scope [shape=diamond label="diff stays inside tasks.json#files[]?"];
    surface [shape=box label="status=blocked; surface in concerns[]"];
    validate [shape=box label="run quality commands; quote outputs in report.md"];
    commit [shape=box label="commit on worktree branch\n(refactor and behavior in separate commits)"];
    ret [shape=box style=filled fillcolor=lightgreen label="emit return JSON as last block; exit"];

    read -> cycle;
    cycle -> slice;
    slice -> cycle [label="yes — one test, one impl, repeat"];
    slice -> evidence [label="no"];
    evidence -> scope;
    scope -> validate [label="yes"];
    scope -> surface [label="no"];
    surface -> ret;
    validate -> commit -> ret;
}
```

The TDD cycle nodes are not expanded here. Load `skills/tdd-mutation/SKILL.md` and follow it directly — the Iron Law (no production code without a failing test first), the Quality Law (no "done" without mutation evidence the tests bite), vertical slicing (one test → one impl → repeat, never five-then-five), and the Prove-It Pattern for bug fixes all live there. For browser-rendered output, the cycle includes VERIFY-IN-BROWSER as a final step; capture before/after screenshots into the evidence directory.

If a dispatched task's `depends_on` are not green, or the task is not in `tasks.json`, return `status: "blocked"` immediately. Do not improvise the missing dependency.

## Evidence

`.agent/evidence/<task-id>/` is a separate, judge-readable record. The diff says what you changed; the evidence directory says what you observed at the moment you verified. Filenames are exact — the judge reads by name.

| File | Required | Purpose |
|---|---|---|
| `report.md` | always | One page: what you built, files touched, tests added, edge-case decisions, quality-command output quoted line-for-line. |
| `qa-hints.json` | always | The honesty channel to the judge. Schema below. The judge reads this first. |
| `before.png`, `after.png` | UI tasks | Same viewport, same data, paired. |
| `flow.webm` | UI tasks with interactions | Short screen recording of the user-facing flow. Optional when stills cover the change. |
| `request.http`, `response.json` | API tasks | The exact request sent and response received. |
| `golden.json` | tasks producing a fixture or snapshot | Canonical output for future regression tests. |

## qa-hints.json

`qa-hints.json` declares what you did NOT fully verify. The judge focuses scrutiny on `needs_deeper_qa[]`; hiding a known gap wastes a fix-cycle. Be honest about needs_deeper_qa — auth, persistence, concurrency, money, and untrusted-input tasks almost always have at least one verification dimension you did not fully cover.

```json
{
  "feature_id": "redo-5.1",
  "tests_written": [
    "rejects empty title",
    "trims whitespace from title",
    "enforces max title length of 255"
  ],
  "needs_deeper_qa": [
    "Cascade delete: only tested FK presence, not actual cascade",
    "Concurrent write to same row: not tested",
    "Token expiry on the boundary of the clock-skew window: not tested"
  ]
}
```

`tests_written[]` matches `tests_added[]` in the return JSON — the judge cross-checks. Empty `tests_written[]` is a Stage 2 fail unless the task is explicitly a non-behavior change. Empty `needs_deeper_qa[]` is allowed only when you genuinely verified every acceptance dimension; the judge tests that claim.

## Anti-cheat

Operational rules baked into the worker contract. Treat them as load-bearing prompt material.

- It is unacceptable to remove or edit tests because this could lead to missing or buggy functionality.
- Never weaken assertions, never xfail, never delete a test to make CI green.
- A pre-existing test that fails after your change is right until you prove otherwise in writing in `report.md`. The default is to revert the production change and re-read the spec.
- `expect(result).toBeTruthy()` is not a fix for `expect(result).toEqual({...})` failing. `skip` / `xfail` / `it.todo` is not a fix; it is hiding a regression.
- If a test is genuinely wrong (obsolete spec, implementation detail you just refactored), delete it in a separate commit with a one-paragraph justification in the commit message and `report.md`, and add the replacement in the same change. Never quietly weaken in place.
- Verify by reading code, not by trusting the test runner. A green bar is one signal; re-read the code path you changed end to end before writing `report.md`.

## Stay in scope

Your task lists exactly the files you may change in `tasks.json#files[]`. Run `git diff --name-only` before commit; every path must appear in that list. If you need a file outside the list:

1. Stop coding.
2. Record the out-of-scope dependency in `report.md` § Concerns and in the return JSON's `concerns[]`.
3. If you can complete the task without the out-of-scope file (e.g., adopt an existing helper), do that and still mention the rejected alternative.
4. If the task is now blocked, return `status: "blocked"`. Do not patch around the missing file inside the worker.

## Validate

Run the project's exact quality commands from `.agent/research.md` § Quality Commands or `.agent/spec.md`. Quote the literal output lines in `report.md` § Validation. "All green" without quoted output is not evidence. At minimum:

- The test you wrote in RED now passes.
- The full existing test suite still passes.
- The linter is clean.
- The type checker is clean (where applicable).
- The build succeeds, if separate from test/lint.

## HARD STOP

One task per invocation. Stop on green or stop on blocked. Do not pick up the next task even if it is a one-liner that depends on yours — the coordinator dispatches a fresh worker for `T13` after you finish `T12`. Fresh context is the load-bearing property, not your residual familiarity. After the return JSON is emitted, your invocation is over.

## Return JSON

Emit this as the final fenced block of your reply. Nothing after it — the orchestrator parses the last JSON block; trailing prose breaks dispatch.

```json
{
  "task_id": "redo-5.1",
  "status": "done",
  "files_changed": ["skills/arianna-implement/SKILL.md"],
  "tests_added": ["rejects empty title", "trims whitespace from title"],
  "evidence_dir": ".agent/evidence/redo-5.1/",
  "qa_hints_file": ".agent/evidence/redo-5.1/qa-hints.json",
  "branch": "task/redo-5.1-rewrite-implement-skill",
  "commit_sha": "abc1234...",
  "validation": {
    "tests": "pass",
    "lint": "pass",
    "types": "pass",
    "command": "npm test && npm run lint && npm run typecheck"
  },
  "concerns": [],
  "assumptions": []
}
```

- `status`: `"done"` or `"blocked"`. Partial is `"blocked"`.
- `files_changed`: must be a subset of `tasks.json#files[]` for this task, or `concerns[]` must explain the overflow.
- `tests_added`: test names matching `qa-hints.json#tests_written[]`.
- `concerns[]`: one entry per out-of-scope dependency, ambiguous spec, or pre-existing test failure you could not honestly fix within scope.
- `assumptions[]`: one entry per explicit assumption you made where the spec was thin (e.g., `"Assumed rate-limit window is per-IP, not per-user — spec.md silent"`). The judge cross-checks against the spec.

## Anti-patterns

- Writing production code before a failing test. The Iron Law lives in `tdd-mutation`; the judge tests that you followed it.
- Weakening, skipping, or deleting tests to make CI green. Replace with a clear commit and written justification, never quietly weaken in place.
- Touching files outside `tasks.json#files[]`. Surface the out-of-scope dependency in `concerns[]`.
- Skipping evidence capture. `report.md` and `qa-hints.json` are required every task, every time.
- Leaving `needs_deeper_qa[]` empty out of laziness on auth, persistence, concurrency, money, or untrusted-input tasks.
- Picking up the next task. HARD STOP after the return JSON; the coordinator dispatches a fresh worker.
- Refactor and behavior in the same commit. Two commits, two messages — the tdd-mutation rule survives unchanged into the worker workflow.
- Trusting the test runner without re-reading the code path. Tools and tests can be wrong together.
- Emitting prose after the return JSON. The orchestrator parses the last fenced JSON block.

## References

- `skills/tdd-mutation/SKILL.md` — load at the start of every task. The TDD cycle, Iron Law, vertical slicing, mutation testing, and the Prove-It Pattern live there. This skill points; it does not paraphrase.
- `skills/arianna-magic/references/templates/implement.md` — load when the dispatch prompt looks malformed or when initializing a new project's `.agent/implement.md`.
- `skills/arianna-magic/SKILL.md` § Dispatch — load when confirming the structured-JSON return shape the orchestrator expects.
- `skills/systematic-debugging/SKILL.md` — load when a test fails for a reason you cannot reproduce locally. Reproduce first, root-cause second, fix third.
- `skills/verification-before-completion/SKILL.md` — load before emitting the return JSON. No "done", "fixed", or "passing" claims without quoted output.
