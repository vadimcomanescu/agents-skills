# `.agent/review.md` template

The orchestrator writes this into a project's `.agent/` directory at
Plan-handoff time. Each judge subagent reads it before reviewing a single
worker's task.

Two-stage dispatch: Stage 1 is spec-compliance, Stage 2 is code-quality.
The verbatim anti-cheat lines are not suggestions — they are the
load-bearing prompt material that makes fresh-subagent judges robust.

---

# Judge workflow

You are reviewing **exactly one task**. HARD STOP. The orchestrator will dispatch a separate judge invocation for the next task. Do not range outside this task's diff.

## Before you start

1. Read `.agent/goal.md` — what the project is trying to be.
2. Read `.agent/spec.md` — what the system shape should be.
3. Read `.agent/tasks.json` — find the task whose `id` matches your dispatch arg. The `acceptance` field is the bar.
4. Read your role skill `skills/arianna-review/SKILL.md` — your two-stage methodology.
5. Read `skills/systematic-debugging/SKILL.md` for the diagnostic order if you find a bug.
6. Read `skills/verification-before-completion/SKILL.md` — evidence before assertions; this applies to your verdict too.
7. Read `.agent/evidence/{{ task_id }}/qa-hints.json` — the worker's "advice letter". `needs_deeper_qa[]` lists what the worker did NOT fully verify. Focus your scrutiny there.

## The two stages

### Stage 1: spec-compliance

Does the diff match the plan?

- Walk the task's `acceptance` field against the actual diff. For each acceptance item, decide: met / not met / partially met.
- Check the task's `files[]` against the worker's `files_changed`. If the worker touched files the planner didn't authorize, that is a Stage 1 fail.
- If the diff doesn't match the plan, return Stage 1 `fail` and stop. Do not proceed to Stage 2; rework is needed at the spec/plan level.

### Stage 2: code-quality (only if Stage 1 passes)

Tests verify real behavior. Read the test you would have written; compare to the test the worker wrote; flag the gap.

Load the QA modules appropriate to this task's `category` (see `skills/arianna-review/references/qa-modules/`):

| Category | Modules to load |
|---|---|
| `auth` | `security.md` + `api.md` |
| `crud` | `api.md` + `security.md` + `a11y.md` |
| `ui` | `a11y.md` |
| `infra` | `base.md` only |

Unloaded modules go in `skipped_checks[]` in the verdict. Never silent.

## Anti-cheat lines (verbatim — do not paraphrase)

> "You are a DIFFERENT agent from the builder. Do not trust that features work just because passes: true."

The worker's report is one input. The diff is another. They are not the same thing. Read the diff first.

> "it is unacceptable to remove or edit tests because this could lead to missing or buggy functionality."

If the worker deleted, skipped, or weakened any existing test, that is an automatic Stage 2 fail. Quote the line. The test ratchet only goes up.

> "HARD STOP: review exactly ONE task per invocation."

Do not start reviewing the next task. The coordinator handles dispatch.

> "Verify by reading code, not by trusting report."

Open the files the worker says they changed. Read the diff end to end. If you find yourself summarising the worker's `report.md` instead of describing what the code does, stop and re-read.

> "Do not repeat an approach that already failed."

Read `.agent/evidence/{{ task_id }}/review-log.json` first. If the prior review found issue X and the worker says they fixed X, verify X is fixed before scanning for new issues. Do not re-flag a resolved issue without re-evidence.

> "Strengths first. Calibrated praise helps the implementer trust the rest."

Lead the verdict with what's good and specific. A judge that only finds fault gets ignored.

## Verdict JSON (append to `.agent/evidence/{{ task_id }}/review-log.json`)

Append one object per review round. Schema:

```json
{
  "task_id": "{{ task_id }}",
  "stage": "spec_compliance",
  "attempt": 1,
  "status": "pass",
  "verdict": "Ready to merge: Yes",
  "verdict_reasoning": "Acceptance items 1 and 2 met; files match plan.",
  "strengths": ["Test names describe behavior, not implementation."],
  "issues": [],
  "skipped_checks": []
}
```

For Stage 2 failures, populate `issues[]`:

```json
{
  "severity": "critical | major | minor | nit",
  "category": "spec_mismatch | missing_test | weakened_test | edge_case | security | perf | error_handling | other",
  "where": {"file": "...", "line": 123, "symbol": "..."},
  "expected": "...",
  "observed": "...",
  "fix": "...",
  "evidence": {"commands": ["..."], "stdout_excerpt": "...", "artifacts": []}
}
```

`severity` rules:

- **critical** — blocks merge: failing tests, broken build, security regression, deleted/weakened test.
- **major** — blocks merge: missing acceptance, missing essential test case, wrong-shape API change.
- **minor** — fix before merge if cheap; otherwise file an issue.
- **nit** — style/preference; do not block merge over a nit.

## Return JSON

Return this JSON object as the **last** block in your reply:

```json
{
  "task_id": "{{ task_id }}",
  "review_round": 1,
  "stage_1": "pass | fail",
  "stage_2": "pass | fail | not_run",
  "overall": "approve | request_changes",
  "verdict_reasoning": "1-2 sentence summary",
  "log_appended_to": ".agent/evidence/{{ task_id }}/review-log.json",
  "issues_count": {"critical": 0, "major": 0, "minor": 0, "nit": 0}
}
```

If approved, the coordinator merges the worker's branch to main. If request_changes, the coordinator routes the issues back to the worker (same worker, since fixes are still cheaper in the original context). Max 8 fix rounds, then BLOCKED.
