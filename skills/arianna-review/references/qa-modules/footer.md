---

## Record & Fix

After all included sub-phases are complete, record findings in `.agent/evidence/<task-id>/review-log.json` — **append a NEW entry, never overwrite previous ones**.

For any sub-phase NOT included in this review (because the task category did not require it), list the sub-phase name in `skipped_checks[]` of the review-log entry. Skips MUST be explicit; never silent.

```json
{
  "task_id": "...",
  "stage": "spec_compliance" | "code_quality",
  "attempt": 1,
  "status": "pass" | "fail" | "partial",
  "verdict": "Ready to merge: Yes | No | With fixes",
  "verdict_reasoning": "1-2 sentence summary",
  "strengths": ["..."],
  "issues": [{
    "severity": "critical" | "major" | "minor" | "nit",
    "category": "spec_mismatch" | "missing_test" | "weakened_test" | "edge_case" | "security" | "perf" | "error_handling" | "other",
    "where": {"file": "...", "line": 123, "symbol": "..."},
    "expected": "...",
    "observed": "...",
    "fix": "...",
    "evidence": {"commands": [], "stdout_excerpt": "...", "artifacts": []}
  }],
  "skipped_checks": ["a11y", "security"]
}
```

If the `review-log.json` already contains previous attempts for this task, read every prior entry before deciding your fix strategy. Do not repeat an approach that already failed.

## After recording

Fix ALL bugs found across all sub-phases for this task, then run the project's canonical verification command set once (e.g., `make check && make test`, `npm run check && npm test`, `cargo check && cargo test`). Commit the fixes together with a message that names the task and the bug categories addressed (e.g., `fix(<task-id>): address review-round-N issues — auth bypass, missing 400 on empty body`).

Update the task entry in `.agent/tasks.json`:
- Set `qa_pass: true` if all critical bugs are fixed and the task meets its acceptance criteria end-to-end.
- Set `qa_pass: false` if critical bugs remain unfixed (so the review loop retries).
- Do NOT touch `build_pass` — that is owned by the builder.

`git add` the affected paths, write a descriptive commit message, and push if the project workflow expects pushes from review subagents.

## Rules

- **HARD STOP: review exactly ONE task per invocation.** Append the review-log entry, update `tasks.json`, commit, then stop.
- Run all included sub-phases for this task. Skip only sub-phases not provided in this prompt, and mark them explicitly in `skipped_checks[]`.
- Be skeptical. Assume things are broken until proven otherwise. Verify by reading code, not by trusting the builder's report.
- Fix ALL critical and major bugs for the task, then test once before committing.
- **NEVER weaken or delete tests to make them pass.** It is unacceptable to remove or edit tests because this could lead to missing or buggy functionality. Fix the code, not the test.
- Always update `qa_pass` in `.agent/tasks.json` before claiming completion.
- Strengths first in the verdict. Calibrated praise helps the implementer trust the rest.

---

## Final Checklist (verify before claiming this review is done)

Stop and verify each item. Only the sub-phases included in this prompt need verification — the rest should be marked in `skipped_checks[]` of the review-log entry:

- [ ] **Sub-Phase A (FUNCTIONAL)** — ran unit tests, E2E, manual verification, recorded `status`
- [ ] **All other included sub-phases** — completed per their instructions and recorded in the review-log entry
- [ ] **Excluded sub-phases** — listed in `skipped_checks[]` with a reason
- [ ] **review-log.json** — appended a NEW entry (did not overwrite previous ones)
- [ ] **tasks.json** — updated `qa_pass` for this task (true only if no critical bugs remain)
- [ ] **Project verification command set** — ran once, passed
- [ ] **Committed** with a descriptive message naming the task and bug categories addressed

If ANY checkbox is unticked, go back and do that step before reporting the review complete.
