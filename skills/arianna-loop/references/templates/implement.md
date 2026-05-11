# `.agent/implement.md` template

This file is written by the orchestrator into a project's `.agent/`
directory at Plan-handoff time. Each worker subagent reads it before
implementing a single task from `.agent/tasks.json`.

The template below uses `{{ }}` placeholders the orchestrator substitutes
(project name, repo paths, etc.). The substance — TDD discipline,
anti-cheat rules, JSON return schema — stays verbatim.

---

# Worker workflow

You are implementing **exactly one task** from `.agent/tasks.json`. HARD
STOP: one task per invocation. Do not pick up adjacent work.

## Before you start

1. Read `.agent/goal.md` — the project's outcome.
2. Read `.agent/spec.md` — the agreed shape of the system.
3. Read `.agent/tasks.json` — find the task whose `id` matches your dispatch arg.
4. Read your role skill `skills/arianna-implement/SKILL.md` — your discipline.
5. Read the **tdd-mutation** skill at `skills/tdd-mutation/SKILL.md` — the TDD law you follow.
6. If your task references existing modules, read those files. Do not guess from filenames.

## Implementation workflow

Follow the **tdd-mutation** skill exactly. The short version:

1. **Red.** Write the failing test first. Describe behavior, not implementation. Run it; confirm it fails for the right reason.
2. **Green.** Smallest change that makes the test pass. Don't add anything the test doesn't demand.
3. **Refactor.** Tidy on green. No behavior changes during refactor; no refactor while red. Refactor and behavior never in the same commit.
4. **Mutate.** After green, ask: if I flipped this condition or weakened this assertion, would a test fail? If not, the test is decorative — strengthen it.

## Evidence capture

Write to `.agent/evidence/{{ task_id }}/`:

- `report.md` — a one-page summary: what you built, files touched, tests added, what the worker decided about edge cases.
- `qa-hints.json` — your "advice letter" to the judge:
  ```json
  {
    "feature_id": "{{ task_id }}",
    "tests_written": ["test_name_1", "test_name_2"],
    "needs_deeper_qa": [
      "Cascade delete: only tested FK presence, not actual cascade",
      "Concurrent write to same row: not tested"
    ]
  }
  ```
  Be honest. The judge reads this first and focuses scrutiny on `needs_deeper_qa[]`. Hiding a weakness here wastes review rounds.
- Optional artifacts where they earn their keep: `before.png` / `after.png` for UI, `flow.webm` for interactions, `request.http` / `response.json` for API calls, `golden.json` for snapshot comparisons.

## Anti-cheat (verbatim — do not paraphrase)

> "it is unacceptable to remove or edit tests because this could lead to missing or buggy functionality."

If a test fails after your change, the test is right and your change is wrong, until you can show otherwise with a written argument. Never weaken assertions, never `xfail`, never delete a test to make CI green.

> "Verify by reading code, not by trusting the report."

Do not claim a behavior works because a tool said it does. Re-read the code path you changed end to end before reporting done.

## Stay in scope

Your task lists the files you're authorized to change in `tasks.json#files[]`. If your work needs a file outside that list, **stop** and surface it in `concerns[]`. Do not silently expand scope; the planner sized the task assuming the listed files only.

## Validate

Run the quality commands listed in `.agent/spec.md` or `.agent/research.md` § "Quality Commands". At minimum: the test you wrote passes; the existing test suite still passes; the linter and type checker are clean. Quote the relevant output in your `report.md`.

## Commit

One commit per logical change. Conventional-commits format. Commit on the worktree branch the coordinator created for your task.

## Return JSON

After you commit, return this JSON object as the **last** block in your reply (nothing after it):

```json
{
  "task_id": "{{ task_id }}",
  "status": "done",
  "files_changed": ["path/to/file1", "path/to/file2"],
  "tests_added": ["test_name_1", "test_name_2"],
  "evidence_dir": ".agent/evidence/{{ task_id }}/",
  "qa_hints_file": ".agent/evidence/{{ task_id }}/qa-hints.json",
  "branch": "task/{{ task_id }}-<slug>",
  "commit_sha": "...",
  "validation": {
    "tests": "pass",
    "lint": "pass",
    "types": "pass",
    "command": "<the quality command you ran>"
  },
  "concerns": [],
  "assumptions": []
}
```

If you cannot complete the task, return `status: "blocked"` with the blocker stated plainly. The orchestrator will route the task to a fresh worker with the blocker context — do not retry blindly yourself.
